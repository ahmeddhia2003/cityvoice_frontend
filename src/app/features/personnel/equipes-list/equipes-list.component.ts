import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Equipe, EquipeService, Etat } from '../../../core/services/equipe.service';
import { AuthService } from '../../../core/services/auth.service';
import { ContratTravailService, ContratTravailResponse } from '../../../core/services/contrat-travail.service';
import { SignalementService } from '../../../core/services/signalement.service';
import { EquipeService as EquipeSvc } from '../../../core/services/equipe.service';
import { MembreEquipeService } from '../../../core/services/membre.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-equipes-list',
  templateUrl: './equipes-list.component.html',
  styleUrls: ['./equipes-list.component.css']
})
export class EquipesListComponent implements OnInit, OnDestroy {

  /* ── État utilisateur ───────────────────────────────────── */
  isChef   = false;
  chefId   = '';
  equipeCode = '';
  /** Nom réel de l'utilisateur connecté (pour signature PDF) */
  currentUserNom = '';

  /* ── Équipes ────────────────────────────────────────────── */
  equipes:  Equipe[] = [];
  filtered: Equipe[] = [];
  loading = true;

  searchTerm = '';
  filterEtat = '';

  selectedId?:     string;
  selectedEquipe?: Equipe;

  /* ── Contrats (chef seulement) ──────────────────────────── */
  contrats:        ContratTravailResponse[] = [];
  contratsLoading  = false;
  contratsError    = '';

  contratSearch  = '';
  contratFilter  = 'TOUS';
  contratPage    = 0;
  readonly contratPageSize = 6;

  /** Contrat ouvert en vue document complète */
  selectedContrat: ContratTravailResponse | null = null;
  inlineSignMode   = false;
  inlineRefusMode  = false;

  /* Modal signature (legacy — utilisé seulement hors détail) */
  signatureMode:   ContratTravailResponse | null = null;
  signatureData    = '';
  /* Modal refus */
  refusMode:       ContratTravailResponse | null = null;
  motifRefus       = '';
  actionLoading    = false;

  /* ── Signalements (chef seulement) ─────────────────────── */
  signalements:    any[]  = [];
  sigLoading       = false;
  sigFilter        = '';
  sigSearch        = '';
  sigPage          = 0;
  readonly sigPageSize = 8;
  /** Signalement ouvert en vue détail */
  selectedSignalement: any | null = null;
  /** Modal résolution sans quitter la page équipes */
  resolutionSig:   any | null = null;

  /* ── Toast ─────────────────────────────────────────────── */
  toast      = false;
  toastMsg   = '';
  toastType: 'success' | 'error' = 'success';
  private toastTO: any;

  /* ── Sous-navbar ────────────────────────────────────────── */
  activeSection = 'equipes';
  tabAnimating  = false;
  private subs: Subscription[] = [];

  /* ── Canvas signature ───────────────────────────────────── */
  private signCanvas: HTMLCanvasElement | null = null;
  private signCtx:    CanvasRenderingContext2D | null = null;
  private drawing = false;
  private lastX = 0; private lastY = 0;

  constructor(
    private equipeService: EquipeService,
    private authService:   AuthService,
    private contratSvc:    ContratTravailService,
    private sigSvc:        SignalementService,
    private membreSvc:     MembreEquipeService,
    private userSvc:       UserService,
    private cd:            ChangeDetectorRef,
    private router:        Router
  ) {}

  /* ══ Lifecycle ══════════════════════════════════════════════ */
  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.isChef    = user?.role === 'CHEF_EQUIPE';
    this.chefId    = user?.userId ?? '';
    this.equipeCode = (user as any)?.equipeCode ?? localStorage.getItem('equipeCode') ?? '';

    // Récupère le nom réel du chef connecté (pour la signature PDF)
    if (this.chefId) {
      this.userSvc.getById(this.chefId).subscribe({
        next: (u) => { this.currentUserNom = (u?.nom || '').trim(); },
        error: () => { /* fallback sur chefEquipeNom du contrat */ },
      });
    }

    // Animate sub-nav on entrance
    setTimeout(() => {
      const gs = this._gsap();
      if (gs) {
        gs.fromTo('.sub-nav', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
        gs.fromTo('.snav-item', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, delay: 0.1, ease: 'power2.out' });
      }
    }, 50);

    this.loadEquipes(); // loadContrats() est appelé depuis loadEquipes() une fois equipeCode connu

    if (this.isChef) {
      this.loadSignalements();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTO);
    this._detachCanvas();
  }

  /* ══ Sous-navbar — tab switching ═══════════════════════════ */
  setTab(section: string): void {
    if (this.activeSection === section || this.tabAnimating) return;
    this.tabAnimating = true;
    const gs = this._gsap();
    const shell = document.querySelector('.equipes-shell');
    if (gs && shell) {
      gs.to(shell, { opacity: 0, y: 10, duration: 0.15, ease: 'power2.in', onComplete: () => {
        this.activeSection = section;
        this.tabAnimating  = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.cd.detectChanges();
        setTimeout(() => {
          gs.fromTo(shell, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });
          this._animateCurrentSection();
        }, 30);
      }});
    } else {
      setTimeout(() => {
        this.activeSection = section;
        this.tabAnimating  = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.cd.detectChanges();
        setTimeout(() => this._animateCurrentSection(), 80);
      }, 120);
    }
  }

  /* ══ Data : Équipes ═════════════════════════════════════════ */
  loadEquipes(): void {
    this.equipeService.getAll().subscribe({
      next: (data) => {
        const all = data || [];
        if (this.isChef && this.chefId) {
          // ── Stratégie 1 : membre déjà lié (userId === chefId) ──────
          const mine = all.filter(eq =>
            (eq.membresEquipe || []).some((m: any) => m.userId && m.userId === this.chefId)
          );
          if (mine.length > 0) {
            this._applyEquipes(mine);
          } else {
            // ── Stratégie 2 : CHEF_EQUIPE sans userId → auto-link ──
            let linked = false;
            for (const eq of all) {
              const chefMember = (eq.membresEquipe || []).find(
                (m: any) =>
                  (m.fonction === 'CHEF_EQUIPE' || m.fonction === 'CHEF') &&
                  (!m.userId || m.userId === '')
              );
              if (chefMember?.id) {
                linked = true;
                this.membreSvc.linkUser(chefMember.id, this.chefId).subscribe({
                  next: () => { this._applyEquipes([eq]); },
                  error: () => { this._applyEquipes([eq]); }
                });
                break;
              }
            }
            if (!linked) {
              // ── Stratégie 3 : equipeCode localStorage / toutes ──
              const byCode = this.equipeCode
                ? all.filter(eq => eq.specialite?.toLowerCase() === this.equipeCode.toLowerCase())
                : all;
              this._applyEquipes(byCode.length > 0 ? byCode : all);
            }
          }
        } else {
          this.equipes  = all;
          this.filtered = all;
          this.loading  = false;
          this.cd.detectChanges();
        }

        // ── Charger les contrats APRÈS que equipeCode est connu ──────
        if (this.isChef && this.contrats.length === 0) {
          this.loadContrats();
        }
      },
      error: () => { this.loading = false; }
    });
  }

  /** Applique la liste d'équipes résolue, met à jour equipeCode et cache localStorage. */
  private _applyEquipes(equipes: Equipe[]): void {
    this.equipes  = equipes;
    this.filtered = equipes;
    if (!this.equipeCode && equipes.length > 0 && equipes[0].specialite) {
      this.equipeCode = equipes[0].specialite;
      localStorage.setItem('equipeCode', this.equipeCode);
    }
    this.loading = false;
    this.cd.detectChanges();
    setTimeout(() => this._animateCards(), 60);
  }

  /** Même logique que chef-equipe : fusionner chef + en-attente équipe quand equipeCode est connu. */
  private mergeContratsParId(
    a: ContratTravailResponse[],
    b: ContratTravailResponse[]
  ): ContratTravailResponse[] {
    const map = new Map<number, ContratTravailResponse>();
    for (const c of a) map.set(c.id, c);
    for (const c of b) map.set(c.id, c);
    return Array.from(map.values()).sort(
      (x, y) => new Date(y.dateCreation).getTime() - new Date(x.dateCreation).getTime()
    );
  }

  /* ══ Data : Contrats ════════════════════════════════════════ */
  loadContrats(): void {
    this.contratsLoading = true;
    this.contratsError   = '';

    // Stratégie à 3 niveaux :
    //   1) par chefId + fusion en-attente équipe si equipeCode (contrats IA sans chefEquipeId)
    //   2) par equipeCode tous statuts — cas où userId n'est pas encore lié
    //   3) par equipeCode EN_ATTENTE seulement — dernier recours
    const tryByEquipeCode = () => {
      if (!this.equipeCode) {
        this.contratsError   = 'Impossible de charger les contrats.';
        this.contratsLoading = false;
        this.cd.detectChanges();
        return;
      }
      // Niveau 2 : tous statuts pour cette équipe
      this.contratSvc.getContratsParEquipe(this.equipeCode).subscribe({
        next: eq => {
          this.contrats        = eq;
          this.contratsLoading = false;
          this.cd.detectChanges();
        },
        error: () => {
          // Niveau 3 : uniquement EN_ATTENTE
          this.contratSvc.getContratsEquipeEnAttente(this.equipeCode).subscribe({
            next: eq2 => { this.contrats = eq2; this.contratsLoading = false; this.cd.detectChanges(); },
            error: ()  => { this.contratsError = 'Impossible de charger les contrats.'; this.contratsLoading = false; this.cd.detectChanges(); }
          });
        }
      });
    };

    if (this.chefId) {
      const sub = this.contratSvc.getContratsParChef(this.chefId).subscribe({
        next: list => {
          if (this.equipeCode) {
            this.contratSvc.getContratsEquipeEnAttente(this.equipeCode).subscribe({
              next: eq => {
                this.contrats        = this.mergeContratsParId(list, eq);
                this.contratsLoading = false;
                this.cd.detectChanges();
              },
              error: () => {
                this.contrats        = list;
                this.contratsLoading = false;
                this.cd.detectChanges();
              },
            });
          } else if (list.length > 0) {
            this.contrats        = list;
            this.contratsLoading = false;
            this.cd.detectChanges();
          } else {
            tryByEquipeCode();
          }
        },
        error: () => tryByEquipeCode()
      });
      this.subs.push(sub);
    } else {
      tryByEquipeCode();
    }
  }

  /* ══ Data : Signalements ════════════════════════════════════ */
  loadSignalements(): void {
    this.sigLoading = true;
    const sub = this.sigSvc.getAll().subscribe({
      next: all => {
        this.signalements = all.filter((s: any) => {
          const code  = (s.equipeIA ?? '').toLowerCase();
          const label = (s.equipeIALabel ?? '').toLowerCase();
          const mine  = this.equipeCode.toLowerCase();
          return mine ? (code === mine || label.includes(mine)) : false;
        });
        this.sigLoading = false;
        this.cd.detectChanges();
        setTimeout(() => { this._animateSigKpis(); this._animateSigCards(); }, 80);
      },
      error: () => { this.sigLoading = false; this.cd.detectChanges(); }
    });
    this.subs.push(sub);
  }

  /* ══ Contrats — Vue document complète ══════════════════════ */
  openContrat(c: ContratTravailResponse): void {
    this.selectedContrat = c;
    this.inlineSignMode  = false;
    this.inlineRefusMode = false;
    this.signatureData   = '';
    this.motifRefus      = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => this._animateDocOpen(), 60);
  }
  closeContrat(): void {
    const gs = this._gsap();
    const doc = document.querySelector('.el-doc-wrapper');
    if (gs && doc) {
      gs.to(doc, { opacity: 0, x: 40, duration: 0.25, ease: 'power2.in', onComplete: () => {
        this.selectedContrat = null;
        this.inlineSignMode  = false;
        this.inlineRefusMode = false;
        this._detachCanvas();
        this.cd.detectChanges();
        setTimeout(() => this._animateContratItems(), 80);
      }});
    } else {
      this.selectedContrat = null;
      this.inlineSignMode  = false;
      this.inlineRefusMode = false;
      this._detachCanvas();
    }
  }

  openInlineSign(): void {
    this.inlineSignMode  = true;
    this.inlineRefusMode = false;
    this.signatureData   = '';
    setTimeout(() => this._initInlineCanvas(), 80);
  }
  openInlineRefus(): void {
    this.inlineRefusMode = true;
    this.inlineSignMode  = false;
    this.motifRefus      = '';
  }

  accepterContratDetail(): void {
    if (!this.selectedContrat) return;
    this.actionLoading = true;
    this.contratSvc.accepter(this.selectedContrat.id, { signatureBase64: this.signatureData }, this.chefId)
      .subscribe({
        next: (updated) => {
          this.actionLoading  = false;
          this.inlineSignMode = false;
          this.selectedContrat = updated;
          // Contrat signé → équipe passe EN MISSION
          this._setEquipeEtatForContrat(updated, 'EN_EXECUTION');
          this.loadContrats();
          this.loadSignalements();
          this.showToast('Contrat accepté — équipe en mission.', 'success');
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors de l\'acceptation.', 'error'); }
      });
  }

  refuserContratDetail(): void {
    if (!this.selectedContrat) return;
    this.actionLoading = true;
    this.contratSvc.refuser(this.selectedContrat.id, { motifRefus: this.motifRefus }, this.chefId)
      .subscribe({
        next: (nouveau) => {
          this.actionLoading   = false;
          this.inlineRefusMode = false;
          this.motifRefus      = '';
          this.selectedContrat = null;
          this.loadContrats();
          this.showToast(`Contrat refusé. Réaffectation → ${nouveau.equipeLabel}.`, 'success');
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors du refus.', 'error'); }
      });
  }

  /* ══ Contrats — Actions (legacy modal) ═════════════════════ */
  openSignature(c: ContratTravailResponse): void {
    this.openContrat(c);   // redirige vers la vue document
  }
  closeSignature(): void { this.signatureMode = null; this.signatureData = ''; this._detachCanvas(); }

  accepterContrat(): void {
    if (!this.signatureMode) return;
    const contratRef = this.signatureMode;
    this.actionLoading = true;
    this.contratSvc.accepter(contratRef.id, { signatureBase64: this.signatureData }, this.chefId)
      .subscribe({
        next: (updated) => {
          this.actionLoading = false;
          this.closeSignature();
          // Contrat signé → équipe passe EN MISSION
          this._setEquipeEtatForContrat(updated ?? contratRef, 'EN_EXECUTION');
          this.loadContrats();
          this.loadSignalements();
          this.showToast('Contrat accepté — équipe en mission.', 'success');
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors de l\'acceptation.', 'error'); }
      });
  }

  openRefus(c: ContratTravailResponse): void { this.refusMode = c; this.motifRefus = ''; }
  closeRefus(): void { this.refusMode = null; }

  refuserContrat(): void {
    if (!this.refusMode) return;
    this.actionLoading = true;
    this.contratSvc.refuser(this.refusMode.id, { motifRefus: this.motifRefus }, this.chefId)
      .subscribe({
        next: () => {
          this.actionLoading = false;
          this.closeRefus();
          this.loadContrats();
          this.showToast('Contrat refusé — réaffectation automatique.', 'success');
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors du refus.', 'error'); }
      });
  }

  /* ══ Signalements — vue détail ══════════════════════════════ */
  openSignalement(s: any): void {
    this.selectedSignalement = s;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => this._animateDocOpen(), 60);
  }
  closeSignalement(): void {
    const gs = this._gsap();
    const doc = document.querySelector('.el-doc-wrapper');
    if (gs && doc) {
      gs.to(doc, { opacity: 0, x: 40, duration: 0.25, ease: 'power2.in', onComplete: () => {
        this.selectedSignalement = null;
        this.cd.detectChanges();
        setTimeout(() => { this._animateSigKpis(); this._animateSigCards(); }, 80);
      }});
    } else {
      this.selectedSignalement = null;
    }
  }
  openResolutionFromDetail(): void {
    if (!this.selectedSignalement) return;
    this.resolutionSig = this.selectedSignalement;
    this.selectedSignalement = null;
  }

  /* ══ Helpers labels ══════════════════════════════════════════ */
  typeFullLabel(t: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE: 'Trou dans la chaussée', LAMPADAIRE_CASSE: 'Lampadaire cassé',
      FUITE_EAU: "Fuite d'eau", DECHETS_NON_COLLECTES: 'Déchets non collectés',
      POTEAU_ENDOMMAGE: 'Poteau endommagé', SIGNALISATION_MANQUANTE: 'Signalisation manquante',
      CANIVEAU_BOUCHE: 'Caniveau bouché', ESPACE_VERT_DEGRADE: 'Espace vert dégradé',
      ECLAIRAGE_DEFAILLANT: 'Éclairage défaillant', AUTRE: 'Autre signalement',
    };
    return map[t] ?? (t?.replace(/_/g, ' ') ?? '');
  }

  /* ══ Export PDF ══════════════════════════════════════════════ */
  exportPdf(): void {
    if (!this.selectedContrat) return;
    const jspdf = (window as any).jspdf;
    if (!jspdf?.jsPDF) { this.showToast('jsPDF non disponible.', 'error'); return; }
    try {
      const doc = new jspdf.jsPDF({
        orientation: 'portrait', unit: 'mm', format: 'a4',
        putOnlyUsedFonts: true, compress: true,
      });
      this._buildPdf(doc, this.selectedContrat);
      doc.save(`Contrat-${this.selectedContrat.numeroContrat}.pdf`);
    } catch (err) {
      console.error('[exportPdf] Erreur pendant la génération :', err);
      this.showToast('Erreur lors de la génération du PDF.', 'error');
    }
  }

  /** Helper : nom du chef (priorité au user connecté si c'est son contrat). */
  private _chefDisplay(c: ContratTravailResponse): string {
    // Si l'utilisateur connecté est bien le chef assigné, on privilégie son nom réel
    if (this.isChef && this.currentUserNom &&
        c.chefEquipeId && c.chefEquipeId === this.chefId) {
      return this.currentUserNom;
    }
    // Sinon fallback sur le nom envoyé par le backend
    const nom = (c.chefEquipeNom || '').trim();
    if (nom) return nom;
    // Puis sur le nom récupéré via UserService si disponible
    if (this.currentUserNom) return this.currentUserNom;
    if (c.chefEquipeId && c.chefEquipeId.trim()) return c.chefEquipeId;
    return "En attente d'attribution";
  }

  /** Normalise les caractères "jolis" vers ASCII-safe pour jsPDF helvetica. */
  private _asciiSafe(s: string): string {
    if (!s) return '-';
    return s
      .replace(/[\u2013\u2014]/g, '-')   // em/en dash
      .replace(/[\u2018\u2019]/g, "'")   // smart quotes
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/[\u2022\u25CF]/g, '-');
  }

  private _buildPdf(doc: any, c: ContratTravailResponse): void {
    const W = 210, m = 18; let y = 0;

    /* ── En-tête bleu marine ── */
    doc.setFillColor(12,31,63); doc.rect(0,0,W,38,'F');
    doc.setFillColor(232,83,42); doc.rect(0,36,W,2,'F');

    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont('helvetica','bold');
    doc.text('MADINA', m, 18);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('Municipalite de Madina - Systeme de Gestion Urbaine', m, 25);
    doc.setFontSize(7.5); doc.setTextColor(200,210,230);
    doc.text('Plateforme CityVoice - Republique Tunisienne', m, 30);

    doc.setTextColor(255,255,255);
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(`N${'\u00B0'} ${c.numeroContrat}`, W-m, 17, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text(`Emis le : ${new Date(c.dateCreation).toLocaleDateString('fr-FR')}`, W-m, 23, {align:'right'});
    doc.text(`Tentative : ${c.tentative}`, W-m, 28, {align:'right'});

    y = 48;

    /* ── Titre ── */
    doc.setTextColor(12,31,63); doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text('CONTRAT DE MISSION DE TRAVAUX', W/2, y, {align:'center'});
    doc.setDrawColor(232,83,42); doc.setLineWidth(0.8); doc.line(m, y+3, W-m, y+3); y+=12;

    /* ── Preambule ── */
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    const preambule =
      "La Municipalite de Madina, agissant dans le cadre de sa mission de service public, " +
      "confie par le present contrat la realisation des travaux decrits ci-dessous a l'equipe designee.";
    const pre = doc.splitTextToSize(preambule, W-m*2);
    doc.text(pre, m, y); y += pre.length*5+6;

    /* ── 1. Equipe assignee ── */
    y = this._pdfSec(doc,'1. EQUIPE ASSIGNEE',y,m,W);
    y = this._pdfRow(doc,'Equipe',      c.equipeLabel,                 y,m);
    y = this._pdfRow(doc,'Code equipe', (c.equipeCode??'').toUpperCase(), y,m);
    y = this._pdfRow(doc,'Chef assigne',this._chefDisplay(c),           y,m);
    y += 4;

    /* ── 2. Details du signalement ── */
    const sig = c.signalement;
    y = this._pdfSec(doc,'2. DETAILS DU SIGNALEMENT',y,m,W);
    y = this._pdfRow(doc,'Reference',    sig ? `#${sig.id}` : '-',                            y,m);
    y = this._pdfRow(doc,'Type',         this._asciiSafe(this.typeFullLabel(sig?.type??'')),  y,m);
    y = this._pdfRow(doc,'Adresse',      this._asciiSafe(sig?.adresse??'-'),                  y,m);
    y = this._pdfRow(doc,'Priorite',     sig?.prioriteCitoyen??'-',                           y,m);
    y = this._pdfRow(doc,'Delai estime', c.delaiEstimeHeures ? `${c.delaiEstimeHeures}h` : '-', y,m);
    const confPct = sig?.confidenceIA != null
      ? `${Math.round(sig.confidenceIA * 100)}%` : '-';
    y = this._pdfRow(doc,'Confiance IA', confPct, y, m);

    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(12,31,63);
    doc.text('Description :', m, y); y+=5;
    doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    const desc = doc.splitTextToSize(this._asciiSafe(sig?.description??'-'), W-m*2);
    doc.text(desc, m, y); y+=desc.length*4.5+6;

    /* ── 3. Obligations ── */
    y = this._pdfSec(doc,"3. OBLIGATIONS DE L'EQUIPE",y,m,W);
    const obligations = [
      `- Prendre en charge l'intervention dans un delai de ${c.delaiEstimeHeures ?? sig?.delaiEstimeHeures ?? '48'}h a compter de l'acceptation.`,
      "- Signaler tout obstacle imprevu a la direction technique dans les 24h.",
      "- Fournir un rapport d'intervention a la cloture du chantier.",
      "- Respecter les normes de securite et les reglementations en vigueur.",
    ];
    doc.setFontSize(8.5); doc.setTextColor(60,60,60);
    obligations.forEach(o => {
      const ls = doc.splitTextToSize(o, W-m*2);
      doc.text(ls, m, y); y += ls.length*4.5 + 1.5;
    });
    y += 4;

    /* ── 4. Signatures ── */
    if (y > 210) { doc.addPage(); y = 20; }
    y = this._pdfSec(doc,'4. SIGNATURES',y,m,W);
    const cL = m, cR = W/2 + 5;
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(12,31,63);
    doc.text('Pour la Municipalite de Madina', cL, y);
    doc.text("Pour le Chef d'Equipe", cR, y);
    y += 5;

    doc.setDrawColor(200,200,200); doc.setLineWidth(0.3);
    doc.rect(cL, y, 78, 40); doc.rect(cR, y, 78, 40);

    doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(150,150,150);
    doc.text('Signature + Cachet officiel', cL+4, y+6);
    doc.text('Signature numerique du chef', cR+4, y+6);

    /* Cachet officiel Madina côté municipalité */
    this._drawCachet(doc, cL + 39, y + 24, c);

    /* ── Signature numérique côté chef ──────────────────────── */
    const chefName = this._chefDisplay(c);
    const isSigned = c.statut === 'ACCEPTE';

    if (isSigned) {
      // Signature manuscrite (canvas) si disponible en mémoire, sinon signature stylisée
      if (this.signatureData && this.signatureData.startsWith('data:image')) {
        try {
          doc.addImage(this.signatureData, 'PNG', cR + 6, y + 10, 48, 14);
        } catch {
          this._drawStylizedSignature(doc, chefName, cR + 6, y + 20);
        }
      } else {
        this._drawStylizedSignature(doc, chefName, cR + 6, y + 20);
      }
      // Trait sous la signature
      doc.setDrawColor(12, 31, 63); doc.setLineWidth(0.3);
      doc.line(cR + 6, y + 26, cR + 72, y + 26);
    }

    /* Nom du chef imprimé sous la signature */
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(12,31,63);
    doc.text(chefName, cR+6, y+31);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
    doc.text(`Equipe : ${(c.equipeCode??'').toUpperCase()}`, cR+6, y+36);

    y += 48;

    /* ── Dates auto-remplies ──────────────────────────────── */
    const dateMun  = c.dateCreation
      ? new Date(c.dateCreation).toLocaleDateString('fr-FR')
      : '';
    const dateChef = c.dateReponse
      ? new Date(c.dateReponse).toLocaleDateString('fr-FR')
      : (isSigned ? new Date().toLocaleDateString('fr-FR') : '');

    doc.setFontSize(8); doc.setTextColor(60,60,60); doc.setFont('helvetica','normal');
    doc.text('Date :', cL, y);
    doc.setFont('helvetica','bold'); doc.setTextColor(12,31,63);
    doc.text(dateMun || '______________________', cL + 12, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    doc.text('Date :', cR, y);
    doc.setFont('helvetica','bold'); doc.setTextColor(12,31,63);
    doc.text(dateChef || '______________________', cR + 12, y);

    // Soulignement pour les dates imprimées
    doc.setDrawColor(180,180,180); doc.setLineWidth(0.2);
    if (dateMun)  doc.line(cL + 12, y + 1, cL + 60, y + 1);
    if (dateChef) doc.line(cR + 12, y + 1, cR + 60, y + 1);

    y += 10;

    /* ── Footer ── */
    const pH = 297;
    doc.setDrawColor(232,83,42); doc.setLineWidth(0.5);
    doc.line(m, pH-15, W-m, pH-15);
    doc.setFontSize(7); doc.setTextColor(120,120,120);
    doc.text('Madina - Plateforme CityVoice (c) 2026 - Document genere automatiquement par intelligence artificielle',
      W/2, pH-10, {align:'center'});
    doc.text(`Contrat N${'\u00B0'} ${c.numeroContrat}`, m, pH-10);
    doc.text('Page 1/1', W-m, pH-10, {align:'right'});
  }

  private _pdfSec(doc:any, t:string, y:number, m:number, W:number): number {
    doc.setFillColor(232,83,42); doc.rect(m,y,W-m*2,6.5,'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text(t, m+3, y+4.5);
    return y + 11;
  }

  private _pdfRow(doc:any, lbl:string, val:string, y:number, m:number): number {
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(12,31,63);
    doc.text(`${lbl} :`, m, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    doc.text(val ?? '-', m+38, y);
    doc.setDrawColor(230,230,230); doc.setLineWidth(0.2);
    doc.line(m, y+1.5, 195, y+1.5);
    return y + 6.5;
  }

  /**
   * Cachet officiel Madina : double cercle, texte circulaire,
   * étoiles cardinales, bloc central + numéro de contrat & date.
   */
  private _drawCachet(doc: any, cx: number, cy: number, c: ContratTravailResponse): void {
    const rOut = 14, rMid = 12, rIn = 9.5;

    doc.setDrawColor(12,31,63);
    doc.setLineWidth(1.1); doc.circle(cx, cy, rOut, 'S');
    doc.setLineWidth(0.3); doc.circle(cx, cy, rMid, 'S');
    doc.setLineWidth(0.25); doc.circle(cx, cy, rIn, 'S');

    doc.setFont('helvetica','bold');
    doc.setFontSize(3.6);
    doc.setTextColor(12,31,63);
    this._drawCircularText(doc, 'MUNICIPALITE DE MADINA',   cx, cy, rMid - 1.1, -Math.PI / 2, 'top');
    this._drawCircularText(doc, 'REPUBLIQUE TUNISIENNE * CITYVOICE', cx, cy, rMid - 1.1,  Math.PI / 2, 'bottom');

    doc.setFont('helvetica','bold'); doc.setFontSize(4.5);
    doc.setTextColor(232,83,42);
    doc.text('*', cx - rMid + 0.9, cy + 0.6, {align:'center'});
    doc.text('*', cx + rMid - 0.9, cy + 0.6, {align:'center'});

    doc.setTextColor(12,31,63); doc.setFont('helvetica','bold'); doc.setFontSize(6.8);
    doc.text('MADINA', cx, cy - 2.1, {align:'center'});

    doc.setFontSize(7.5); doc.setTextColor(232,83,42);
    doc.text('*', cx, cy + 0.3, {align:'center'});

    doc.setTextColor(12,31,63); doc.setFont('helvetica','normal'); doc.setFontSize(3.8);
    doc.text('OFFICIEL', cx, cy + 3.1, {align:'center'});

    doc.setFont('helvetica','bold'); doc.setFontSize(3.2); doc.setTextColor(80,80,80);
    const numShort = (c.numeroContrat || '').slice(-10);
    doc.text(`N${'\u00B0'} ${numShort}`, cx, cy + 5.2, {align:'center'});

    const dateStr = c.dateCreation
      ? new Date(c.dateCreation).toLocaleDateString('fr-FR')
      : '';
    doc.setFont('helvetica','normal'); doc.setFontSize(3);
    doc.text(dateStr, cx, cy + 7.3, {align:'center'});

    doc.setTextColor(12,31,63); doc.setDrawColor(12,31,63);
  }

  /**
   * Dessine une signature stylisée à partir du nom du chef :
   * - Font helvetica italic, grande taille, couleur encre
   * - Petit paraphe décoratif sous le nom (arc + point)
   */
  private _drawStylizedSignature(doc: any, name: string, x: number, y: number): void {
    const cleaned = this._asciiSafe((name || 'Signature').trim());
    doc.setFont('times', 'italic');
    doc.setFontSize(18);
    doc.setTextColor(18, 43, 86);
    doc.text(cleaned, x, y);

    // Paraphe : petite courbe sous la signature
    const w = doc.getTextWidth(cleaned);
    doc.setDrawColor(18, 43, 86);
    doc.setLineWidth(0.4);
    doc.lines(
      [
        [w * 0.25, 1.5],
        [w * 0.5,  -0.8],
        [w * 0.25,  1.2],
      ],
      x, y + 2.2, [1, 1], 'S'
    );
    // Petit point final
    doc.setFillColor(18, 43, 86);
    doc.circle(x + w + 1.5, y + 1.8, 0.4, 'F');

    // Reset
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
  }

  /** Texte circulaire : chaque lettre posée individuellement avec rotation. */
  private _drawCircularText(
    doc: any, text: string,
    cx: number, cy: number, radius: number,
    angleCenter: number, position: 'top' | 'bottom'
  ): void {
    const chars = text.split('');
    const angleStep = 0.135;
    const totalAngle = (chars.length - 1) * angleStep;
    const startAngle = angleCenter - totalAngle / 2;

    chars.forEach((ch, i) => {
      const a = startAngle + i * angleStep;
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      const deg = position === 'top'
        ? (a * 180 / Math.PI) + 90
        : (a * 180 / Math.PI) - 90;
      doc.text(ch, x, y, { align: 'center', angle: -deg });
    });
  }

  /* ══ Filtres équipes ════════════════════════════════════════ */
  setFilter(etat: string): void { this.filterEtat = etat; this.applyFilters(); }

  applyFilters(): void {
    this.filtered = this.equipes.filter(e => {
      const matchSearch =
        !this.searchTerm ||
        (e.name ?? '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (e.specialite ?? '').toLowerCase().includes(this.searchTerm.toLowerCase());
      const matchEtat = !this.filterEtat || e.etat === this.filterEtat;
      return matchSearch && matchEtat;
    });
  }

  /* ══ Filtres signalements ═══════════════════════════════════ */
  setSigFilter(f: string): void {
    this.sigFilter = f;
    this.sigPage   = 0;
    this.cd.detectChanges();
    setTimeout(() => this._animateSigCards(), 30);
  }
  setSigSearch(q: string): void { this.sigSearch = q; this.sigPage = 0; }

  get filteredSig(): any[] {
    let list = this.signalements;
    if (this.sigFilter) list = list.filter(s => s.statut === this.sigFilter);
    const q = this.sigSearch.trim().toLowerCase();
    if (q) list = list.filter(s =>
      (s.description??'').toLowerCase().includes(q) ||
      (s.adresse??'').toLowerCase().includes(q) ||
      (s.type??'').toLowerCase().includes(q)
    );
    return list;
  }
  get sigPageCount(): number { return Math.max(1, Math.ceil(this.filteredSig.length / this.sigPageSize)); }
  get sigPaged(): any[] { const s = this.sigPage * this.sigPageSize; return this.filteredSig.slice(s, s + this.sigPageSize); }

  get sigEnCours(): number  { return this.signalements.filter(s => s.statut==='EN_COURS').length; }
  get sigResolus(): number  { return this.signalements.filter(s => s.statut==='RESOLU').length; }
  get sigUrgents(): number  { return this.signalements.filter(s => s.prioriteIA==='URGENTE'||s.prioriteCitoyen==='URGENTE').length; }
  get sigResolutionRate(): number {
    if (!this.signalements.length) return 0;
    return Math.round((this.sigResolus / this.signalements.length) * 100);
  }

  /* ══ Filtres contrats ════════════════════════════════════════ */
  setContratFilter(f: string): void { this.contratFilter = f; this.contratPage = 0; }
  setContratSearch(q: string): void { this.contratSearch = q; this.contratPage = 0; }

  get contratsFiltered(): ContratTravailResponse[] {
    let list = this.contrats;
    if (this.contratFilter !== 'TOUS') list = list.filter(c => c.statut === this.contratFilter);
    const q = this.contratSearch.trim().toLowerCase();
    if (q) list = list.filter(c =>
      (c.numeroContrat??'').toLowerCase().includes(q) ||
      (c.equipeLabel??'').toLowerCase().includes(q) ||
      (c.signalement?.description??'').toLowerCase().includes(q) ||
      (c.signalement?.adresse??'').toLowerCase().includes(q)
    );
    return list;
  }
  get contratsPageCount(): number { return Math.max(1, Math.ceil(this.contratsFiltered.length / this.contratPageSize)); }
  get contratsPaged(): ContratTravailResponse[] { const s = this.contratPage * this.contratPageSize; return this.contratsFiltered.slice(s, s + this.contratPageSize); }

  /* ══ Stats ══════════════════════════════════════════════════ */
  get totalMembres(): number {
    return this.equipes.reduce((a, e) => a + (e.membresEquipe?.length || 0), 0);
  }
  countByEtat(etat: Etat): number { return this.equipes.filter(e => e.etat === etat).length; }

  get contratsEnAttente(): ContratTravailResponse[] {
    return this.contrats.filter(c => c.statut === 'EN_ATTENTE_SIGNATURE');
  }
  get contratsAcceptes(): ContratTravailResponse[] {
    return this.contrats.filter(c => c.statut === 'ACCEPTE');
  }
  countSig(statut: string): number {
    return this.signalements.filter(s => s.statut === statut).length;
  }

  /* ══ Actions équipes ════════════════════════════════════════ */
  selectEquipe(e: Equipe): void {
    if (this.selectedId === e.id) { this.closeDetail(); return; }
    this.selectedEquipe = e; this.selectedId = e.id;
  }
  voirDetail(e: Equipe): void { this.selectedEquipe = e; this.selectedId = e.id; }
  closeDetail(): void { this.selectedEquipe = undefined; this.selectedId = undefined; }
  modifier(e: Equipe): void { this.router.navigate(['/personnel/equipes/modifier', e.id]); }
  supprimer(e: Equipe): void {
    if (!e.id) return;
    if (!confirm(`Supprimer "${e.name}" ?`)) return;
    this.equipeService.delete(e.id).subscribe({
      next: () => { this.equipes = this.equipes.filter(x => x.id !== e.id); this.applyFilters(); if (this.selectedId === e.id) this.closeDetail(); },
      error: (err) => console.error('Erreur suppression', err)
    });
  }

  voirResolution(sig: any): void {
    this.resolutionSig = sig;
  }

  onResolutionModalClosed(): void {
    this.resolutionSig = null;
  }

  onResolutionModalResolved(): void {
    // Signalement résolu → équipe redevient LIBRE
    const sig = this.resolutionSig;
    const equipeCode = sig?.equipeIA || this.equipeCode;
    this._setEquipeEtatByCode(equipeCode, 'LIBRE');
    this.loadSignalements();
  }

  /* ══ Synchronisation état d'équipe avec cycle de vie contrat ══ */

  /** Met à jour l'état de l'équipe liée à un contrat (accepté / résolu). */
  private _setEquipeEtatForContrat(c: ContratTravailResponse | null, etat: Etat): void {
    if (!c) return;
    this._setEquipeEtatByCode(c.equipeCode, etat);
  }

  /** Met à jour l'état d'une équipe identifiée par son code (specialite). */
  private _setEquipeEtatByCode(equipeCode: string | null | undefined, etat: Etat): void {
    if (!equipeCode) return;
    const code = equipeCode.toLowerCase();
    const eq = this.equipes.find(
      e => (e.specialite || '').toLowerCase() === code
    );
    if (!eq?.id) return;

    this.equipeService.updateStatut(eq.id, etat).subscribe({
      next: () => {
        // Mise à jour optimiste de la liste locale pour feedback immédiat
        eq.etat = etat;
        this.applyFilters();
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('[equipe] updateStatut a échoué', err);
      },
    });
  }

  /* ══ Helpers visuels ════════════════════════════════════════ */
  etatLabel(etat?: Etat): string {
    const map: Record<Etat, string> = { LIBRE: 'Libre', EN_EXECUTION: 'En mission', EN_ATTENTE: 'En attente' };
    return etat ? (map[etat] ?? etat) : 'Inconnu';
  }
  etatClass(etat?: Etat): string {
    const map: Record<Etat, string> = { LIBRE: 'etat-libre', EN_EXECUTION: 'etat-exec', EN_ATTENTE: 'etat-wait' };
    return etat ? (map[etat] ?? '') : '';
  }
  etatGradient(etat?: Etat): string {
    const map: Record<Etat, string> = {
      LIBRE: 'linear-gradient(135deg,#4ADE80,#22C55E)',
      EN_EXECUTION: 'linear-gradient(135deg,#FB923C,#F97316)',
      EN_ATTENTE: 'linear-gradient(135deg,#94A3B8,#64748B)'
    };
    return etat ? (map[etat] ?? '#ccc') : '#ccc';
  }

  statutContratLabel(s: string): string {
    const m: Record<string,string> = {
      EN_ATTENTE_SIGNATURE: 'À signer', ACCEPTE: 'Accepté', REFUSE: 'Refusé', REASSIGNE: 'Réassigné'
    };
    return m[s] ?? s;
  }
  statutContratClass(s: string): string {
    const m: Record<string,string> = {
      EN_ATTENTE_SIGNATURE: 'sc-attente', ACCEPTE: 'sc-accepte', REFUSE: 'sc-refuse', REASSIGNE: 'sc-reassigne'
    };
    return m[s] ?? '';
  }

  statutSigLabel(s: string): string {
    const m: Record<string,string> = {
      SOUMIS: 'Soumis', EN_COURS: 'En cours', RESOLU: 'Résolu', REJETE: 'Rejeté'
    };
    return m[s] ?? s;
  }
  statutSigClass(s: string): string {
    const m: Record<string,string> = {
      SOUMIS: 'ss-soumis', EN_COURS: 'ss-encours', RESOLU: 'ss-resolu', REJETE: 'ss-rejete'
    };
    return m[s] ?? '';
  }

  prioriteLabel(p: string): string {
    const m: Record<string,string> = { FAIBLE: 'Faible', NORMALE: 'Normale', URGENT: 'Urgent', CRITIQUE: 'Critique' };
    return m[p] ?? p;
  }
  prioriteClass(p: string): string {
    const m: Record<string,string> = { FAIBLE: 'pr-faible', NORMALE: 'pr-normale', URGENT: 'pr-urgent', CRITIQUE: 'pr-critique' };
    return m[p] ?? '';
  }

  initiales(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
  avatarBg(name: string): string {
    const colors = ['#00b4a6', '#E8532A', '#8B5CF6', '#10B981', '#3B82F6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
  membresPercent(e: Equipe): number { return Math.min(((e.membresEquipe?.length || 0) / 10) * 100, 100); }
  trackById(_: number, e: any): string | undefined { return e.id; }

  timeAgo(d: string): string {
    if (!d) return '';
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60)  return 'À l\'instant';
    if (diff < 3600) return `${Math.floor(diff/60)} min`;
    if (diff < 86400) return `${Math.floor(diff/3600)} h`;
    return `${Math.floor(diff/86400)} j`;
  }

  /* ══ GSAP Animations ════════════════════════════════════════ */
  private _gsap(): any { return (window as any).gsap ?? null; }

  /** Animate equipe cards on load */
  private _animateCards(): void {
    const gs = this._gsap();
    if (!gs) return;
    const cards = document.querySelectorAll('.equipe-card');
    if (!cards.length) return;
    gs.fromTo(cards,
      { opacity: 0, y: 30, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'opacity,transform' }
    );
    const hero = document.querySelector('.equipes-hero');
    if (hero) gs.fromTo(hero, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    const hstats = document.querySelectorAll('.hstat');
    if (hstats.length) {
      gs.fromTo(hstats, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.1, delay: 0.2, ease: 'power2.out' });
    }
  }

  /** Animate signalement KPI counters */
  private _animateSigKpis(): void {
    const gs = this._gsap();
    if (!gs) return;
    const kpis = document.querySelectorAll('.el-sig-kpi');
    if (!kpis.length) return;
    gs.fromTo(kpis,
      { opacity: 0, y: 20, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(1.4)' }
    );
    // Counter animation on kpi numbers
    document.querySelectorAll('.el-sig-kpi-num').forEach(el => {
      const target = parseInt((el as HTMLElement).innerText, 10) || 0;
      if (!target) return;
      const obj = { val: 0 };
      gs.to(obj, {
        val: target, duration: 1.2, ease: 'power2.out', delay: 0.2,
        onUpdate: () => { (el as HTMLElement).innerText = Math.round(obj.val).toString(); }
      });
    });
  }

  /** Animate signalement cards on load / filter change */
  private _animateSigCards(): void {
    const gs = this._gsap();
    if (!gs) return;
    const cards = document.querySelectorAll('.el-sig-card');
    if (!cards.length) return;
    gs.fromTo(cards,
      { opacity: 0, y: 28, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'opacity,transform' }
    );
  }

  /** Animate contrat list items */
  private _animateContratItems(): void {
    const gs = this._gsap();
    if (!gs) return;
    const items = document.querySelectorAll('.el-contrat-item');
    if (!items.length) return;
    gs.fromTo(items,
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: 0.45, stagger: 0.07, ease: 'power3.out', clearProps: 'opacity,transform' }
    );
    const cstats = document.querySelectorAll('.cstat');
    if (cstats.length) {
      gs.fromTo(cstats, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'back.out(1.5)' });
    }
  }

  /** Animate document detail slide-in */
  private _animateDocOpen(): void {
    const gs = this._gsap();
    if (!gs) return;
    const wrapper = document.querySelector('.el-doc-wrapper');
    if (!wrapper) return;
    gs.fromTo(wrapper, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 0.45, ease: 'power3.out' });
    const sections = document.querySelectorAll('.el-doc-section');
    if (sections.length) {
      gs.fromTo(sections,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, delay: 0.15, ease: 'power2.out' }
      );
    }
  }

  /** Called after each tab switch to animate the right section's content */
  private _animateCurrentSection(): void {
    switch (this.activeSection) {
      case 'equipes':    setTimeout(() => this._animateCards(), 30); break;
      case 'contrats':   setTimeout(() => this._animateContratItems(), 30); break;
      case 'signalements':
        setTimeout(() => { this._animateSigKpis(); this._animateSigCards(); }, 30);
        break;
    }
  }

  /* ══ Toast ══════════════════════════════════════════════════ */
  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg = msg; this.toastType = type; this.toast = true;
    clearTimeout(this.toastTO);
    this.toastTO = setTimeout(() => { this.toast = false; }, 3500);
  }

  /* ══ Canvas Signature ═══════════════════════════════════════ */
  private _initInlineCanvas(): void {
    const el = document.querySelector('.el-inline-canvas') as HTMLCanvasElement;
    if (!el) return;
    this.signCanvas = el;
    this.signCtx    = el.getContext('2d')!;
    this.signCtx.strokeStyle = '#0C1F3F';
    this.signCtx.lineWidth   = 2.5;
    this.signCtx.lineCap     = 'round';
    el.addEventListener('mousedown',  this._onDown.bind(this));
    el.addEventListener('mousemove',  this._onMove.bind(this));
    el.addEventListener('mouseup',    this._onUp.bind(this));
    el.addEventListener('mouseleave', this._onUp.bind(this));
    el.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    el.addEventListener('touchend',   this._onUp.bind(this));
  }

  private _initCanvas(): void {
    const el = document.getElementById('act-sign-canvas') as HTMLCanvasElement;
    if (!el) return;
    this.signCanvas = el;
    this.signCtx    = el.getContext('2d')!;
    this.signCtx.strokeStyle = '#00b4a6';
    this.signCtx.lineWidth   = 2.5;
    this.signCtx.lineCap     = 'round';

    el.addEventListener('mousedown',  this._onDown.bind(this));
    el.addEventListener('mousemove',  this._onMove.bind(this));
    el.addEventListener('mouseup',    this._onUp.bind(this));
    el.addEventListener('mouseleave', this._onUp.bind(this));
    el.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    el.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    el.addEventListener('touchend',   this._onUp.bind(this));
  }

  private _detachCanvas(): void {
    if (!this.signCanvas) return;
    // remove listeners by replacing node
    const clone = this.signCanvas.cloneNode(true) as HTMLCanvasElement;
    this.signCanvas.parentNode?.replaceChild(clone, this.signCanvas);
    this.signCanvas = null; this.signCtx = null;
  }

  private _pos(e: MouseEvent | Touch): { x: number; y: number } {
    const r = (this.signCanvas as HTMLCanvasElement).getBoundingClientRect();
    const src = (e as any).clientX !== undefined ? (e as MouseEvent) : (e as Touch);
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  private _onDown(e: MouseEvent): void { this.drawing = true; const p = this._pos(e); this.lastX = p.x; this.lastY = p.y; }
  private _onMove(e: MouseEvent): void {
    if (!this.drawing || !this.signCtx) return;
    const p = this._pos(e);
    this.signCtx.beginPath();
    this.signCtx.moveTo(this.lastX, this.lastY);
    this.signCtx.lineTo(p.x, p.y);
    this.signCtx.stroke();
    this.lastX = p.x; this.lastY = p.y;
  }
  private _onUp(): void {
    this.drawing = false;
    this.signatureData = this.signCanvas?.toDataURL('image/png') ?? '';
  }
  private _onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const t = e.touches[0];
    const p = this._pos(t); this.drawing = true; this.lastX = p.x; this.lastY = p.y;
  }
  private _onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.drawing || !this.signCtx) return;
    const t = e.touches[0];
    const p = this._pos(t);
    this.signCtx.beginPath();
    this.signCtx.moveTo(this.lastX, this.lastY);
    this.signCtx.lineTo(p.x, p.y);
    this.signCtx.stroke();
    this.lastX = p.x; this.lastY = p.y;
  }

  clearSignature(): void {
    if (!this.signCtx || !this.signCanvas) return;
    this.signCtx.clearRect(0, 0, this.signCanvas.width, this.signCanvas.height);
    this.signatureData = '';
  }
}
