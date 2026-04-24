import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ChangeDetectorRef, NgZone
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ContratTravailService, ContratTravailResponse } from '../../core/services/contrat-travail.service';
import { SignalementService } from '../../core/services/signalement.service';
import { EquipeService } from '../../core/services/equipe.service';
import { MembreEquipeService } from '../../core/services/membre.service';

declare const gsap: any;

export type ChefView = 'dashboard' | 'contrats' | 'signalements';

@Component({
  selector:    'app-chef-equipe',
  templateUrl: './chef-equipe.component.html',
  styleUrls:   ['./chef-equipe.component.css'],
})
export class ChefEquipeComponent implements OnInit, OnDestroy, AfterViewInit {

  // ── Auth ─────────────────────────────────────────────────────────
  chefId     = '';
  chefNom    = '';
  equipeCode = '';
  equipeLabel = '';

  // ── Navigation ───────────────────────────────────────────────────
  activeView: ChefView = 'dashboard';

  // ── Contrats ─────────────────────────────────────────────────────
  contrats:          ContratTravailResponse[] = [];
  contratsLoading    = false;
  contratsError      = '';
  contratSearch      = '';
  contratFilter      = 'TOUS';   // TOUS | EN_ATTENTE_SIGNATURE | ACCEPTE | REFUSE
  contratPage        = 0;
  readonly contratPageSize = 6;

  /** Contrat ouvert en vue détail complète (pleine page, comme l'admin) */
  selectedContrat:  ContratTravailResponse | null = null;
  /** Panneau signature inline dans la vue détail */
  inlineSignMode  = false;
  /** Panneau refus inline dans la vue détail */
  inlineRefusMode = false;

  // Signature modal (quick-sign depuis le dashboard)
  signatureMode:  ContratTravailResponse | null = null;
  signatureData   = '';
  // Refus modal
  refusMode:      ContratTravailResponse | null = null;
  motifRefus      = '';
  actionLoading   = false;

  // ── Signalements ─────────────────────────────────────────────────
  signalements:   any[] = [];
  sigLoading      = false;
  sigFilter       = 'EN_COURS';
  sigSearch       = '';
  sigSortBy       = 'date';   // 'date' | 'priorite'
  sigPage         = 0;
  readonly sigPageSize = 8;
  /** Signalement ouvert en vue détail complète */
  selectedSignalement: any | null = null;

  // ── Toast ─────────────────────────────────────────────────────────
  toast     = false;
  toastMsg  = '';
  toastType: 'success' | 'error' = 'success';
  private toastTO: any;

  /** Signalement ouvert dans le modal de résolution (composant partagé) */
  resolutionSig: any | null = null;

  // ── Canvas signature ──────────────────────────────────────────────
  private signCanvas: HTMLCanvasElement | null = null;
  private signCtx:    CanvasRenderingContext2D | null = null;
  private drawing = false;
  private lastX = 0;
  private lastY = 0;

  private subs: Subscription[] = [];

  constructor(
    private auth:        AuthService,
    private contratSvc:  ContratTravailService,
    private sigSvc:      SignalementService,
    private equipeSvc:   EquipeService,
    private membreSvc:   MembreEquipeService,
    private router:      Router,
    private route:       ActivatedRoute,
    private cd:          ChangeDetectorRef,
    private zone:        NgZone,
  ) {}

  // ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (!user) { this.router.navigate(['/auth/login']); return; }

    this.chefId     = user.userId;
    this.chefNom    = user.email ?? '';
    this.equipeCode = (user as any).equipeCode ?? localStorage.getItem('equipeCode') ?? '';
    this.equipeLabel = localStorage.getItem('equipeLabel') ?? '';

    if (!this.chefId) { this.router.navigate(['/auth/login']); return; }

    // Deep-link via ?tab= query param (from navbar shortcuts)
    const tab = this.route.snapshot.queryParamMap.get('tab') as ChefView | null;
    if (tab && ['dashboard', 'contrats', 'signalements'].includes(tab)) {
      this.activeView = tab;
    }

    // Load contracts immediately (may use chefId or empty equipeCode)
    this.loadContrats();
    this.loadSignalements();

    this._subscribeResolutionQueryParams();

    // If equipeCode not yet cached, resolve it from personnel-service
    // This enriches the fallback path and subsequent loads
    if (!this.equipeCode) {
      this._resolveEquipeFromPersonnel();
    }
  }

  /**
   * Look up which equipe this chef belongs to via personnel-service.
   * Stratégie 1 : member.userId === chefId (liaison déjà faite)
   * Stratégie 2 : member.fonction === CHEF_EQUIPE|CHEF sans userId → auto-link
   */
  private _resolveEquipeFromPersonnel(): void {
    this.equipeSvc.getAll().subscribe({
      next: equipes => {
        // ── Stratégie 1 : membre déjà lié via userId ─────────────
        for (const eq of equipes) {
          const isMine = (eq.membresEquipe || []).some(
            (m: any) => m.userId && m.userId === this.chefId
          );
          if (isMine) { this._applyEquipe(eq); return; }
        }

        // ── Stratégie 2 : CHEF_EQUIPE sans userId → auto-link ────
        // Cherche le premier membre chef sans userId et le lie à ce compte
        for (const eq of equipes) {
          const chefMember = (eq.membresEquipe || []).find(
            (m: any) =>
              (m.fonction === 'CHEF_EQUIPE' || m.fonction === 'CHEF') &&
              (!m.userId || m.userId === '')
          );
          if (chefMember?.id) {
            // Tenter de lier côté personnel-service (best-effort)
            this.membreSvc.linkUser(chefMember.id, this.chefId).subscribe({
              next: () => { this._applyEquipe(eq); },
              error: () => { this._applyEquipe(eq); }   // lien échoué mais équipe trouvée
            });
            return;
          }
        }

        console.warn('[Chef] Aucune équipe trouvée pour ce chef via personnel-service');
      },
      error: () => {
        console.warn('[Chef] Personnel-service unavailable, equipeCode not resolved');
      }
    });
  }

  /** Applique l'équipe résolue, met en cache et recharge les données. */
  private _applyEquipe(eq: any): void {
    this.equipeCode  = eq.specialite;
    this.equipeLabel = eq.name ?? '';
    localStorage.setItem('equipeCode',  eq.specialite ?? '');
    localStorage.setItem('equipeLabel', eq.name ?? '');
    try {
      const raw = localStorage.getItem('cv_user');
      if (raw) {
        const u = JSON.parse(raw);
        u.equipeCode  = eq.specialite;
        u.equipeLabel = eq.name;
        localStorage.setItem('cv_user', JSON.stringify(u));
      }
    } catch (_) {}
    this.loadContrats();
    this.loadSignalements();
    this.cd.detectChanges();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this._animateDashboard(), 80);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    clearTimeout(this.toastTO);
    this._detachCanvas();
  }

  // ── Navigation ────────────────────────────────────────────────────
  setView(v: ChefView): void {
    this.activeView = v;
    setTimeout(() => this._animateView(), 50);
  }

  /**
   * Les contrats générés par l’IA peuvent avoir chefEquipeId = null (chef pas encore lié côté personnel).
   * Ils n’apparaissent pas dans GET /contrats/chef/{id}. On les récupère via /equipe/{code}/en-attente.
   * Ancien bug : le fallback équipe ne s’exécutait que si la liste « par chef » était vide — dès qu’un
   * ancien contrat avait le userId du chef, les nouveaux contrats sans chefId restaient invisibles.
   * Dès qu’on connaît equipeCode, on fusionne toujours les deux sources (déduplication par id).
   */
  private _mergeContratsParId(
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

  // ── Chargement contrats ───────────────────────────────────────────
  loadContrats(): void {
    this.contratsLoading = true;
    this.contratsError   = '';

    const finish = (list: ContratTravailResponse[]) => {
      this.contrats        = list;
      this.contratsLoading = false;
      this.cd.detectChanges();
    };

    const sub = this.contratSvc.getContratsParChef(this.chefId).subscribe({
      next: listChef => {
        if (this.equipeCode) {
          this.contratSvc.getContratsEquipeEnAttente(this.equipeCode).subscribe({
            next:  listEquipe => finish(this._mergeContratsParId(listChef, listEquipe)),
            error: () => finish(listChef),
          });
        } else {
          finish(listChef);
        }
      },
      error: () => {
        if (this.equipeCode) {
          this.contratSvc.getContratsEquipeEnAttente(this.equipeCode).subscribe({
            next:  eq => finish(eq),
            error: () => {
              this.contratsError   = 'Impossible de charger les contrats.';
              this.contratsLoading = false;
              this.cd.detectChanges();
            },
          });
        } else {
          this.contratsError   = 'Impossible de charger les contrats.';
          this.contratsLoading = false;
          this.cd.detectChanges();
        }
      },
    });
    this.subs.push(sub);
  }

  // ── Chargement signalements ───────────────────────────────────────
  loadSignalements(): void {
    this.sigLoading = true;
    const sub = this.sigSvc.getAll().subscribe({
      next: all => {
        // Garder uniquement ceux de notre équipe
        this.signalements = all.filter((s: any) => {
          const code  = (s.equipeIA ?? '').toLowerCase();
          const label = (s.equipeIALabel ?? '').toLowerCase();
          const mine  = this.equipeCode.toLowerCase();
          return mine && (code === mine || label.includes(mine));
        });
        this.sigLoading = false;
        this.cd.detectChanges();
      },
      error: () => { this.sigLoading = false; this.cd.detectChanges(); }
    });
    this.subs.push(sub);
  }

  // ── Vue détail complète (pleine page) ────────────────────────────
  openContrat(c: ContratTravailResponse): void {
    this.selectedContrat  = c;
    this.inlineSignMode   = false;
    this.inlineRefusMode  = false;
    this.signatureData    = '';
    this.motifRefus       = '';
  }

  closeContrat(): void {
    this._detachCanvas();
    this.selectedContrat  = null;
    this.inlineSignMode   = false;
    this.inlineRefusMode  = false;
    this.signatureData    = '';
    this.motifRefus       = '';
  }

  initInlineCanvas(): void {
    setTimeout(() => this._initCanvas(), 80);
  }

  accepterContratDetail(): void {
    if (!this.selectedContrat) return;
    this.actionLoading = true;
    this.contratSvc.accepter(this.selectedContrat.id, { signatureBase64: this.signatureData }, this.chefId)
      .subscribe({
        next: (updated) => {
          this.actionLoading   = false;
          this.inlineSignMode  = false;
          this.selectedContrat = updated;           // rafraîchir la vue détail
          this.loadContrats();
          this.loadSignalements();
          this.showToast('Contrat accepté — le signalement est maintenant EN COURS.', 'success');
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
          this.actionLoading    = false;
          this.inlineRefusMode  = false;
          this.motifRefus       = '';
          this.selectedContrat  = null;           // retour à la liste
          this.loadContrats();
          this.showToast(
            `Contrat refusé. Réaffectation automatique → ${nouveau.equipeLabel}.`, 'success'
          );
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors du refus.', 'error'); }
      });
  }

  // ── Accepter : ouvrir signature (modal rapide depuis dashboard) ──
  openSignature(c: ContratTravailResponse): void {
    this.signatureMode = c;
    this.signatureData = '';
    setTimeout(() => this._initCanvas(), 80);
  }

  closeSignature(): void { this.signatureMode = null; this.signatureData = ''; }

  accepterContrat(): void {
    if (!this.signatureMode) return;
    this.actionLoading = true;
    this.contratSvc.accepter(this.signatureMode.id, { signatureBase64: this.signatureData }, this.chefId)
      .subscribe({
        next: () => {
          this.actionLoading = false;
          this.closeSignature();
          this.loadContrats();
          this.loadSignalements();
          this.showToast('Contrat accepté — le signalement est maintenant EN COURS.', 'success');
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors de l\'acceptation.', 'error'); }
      });
  }

  // ── Refuser (modal rapide depuis dashboard) ────────────────────────
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
          this.showToast('Contrat refusé. Réaffectation automatique en cours…', 'success');
        },
        error: () => { this.actionLoading = false; this.showToast('Erreur lors du refus.', 'error'); }
      });
  }

  // ── Export PDF (identique à la vue admin) ─────────────────────────
  exportPdf(): void {
    if (!this.selectedContrat) return;
    const { jsPDF } = (window as any).jspdf;
    if (!jsPDF) { this.showToast('jsPDF non chargé — ajoutez le script dans index.html.', 'error'); return; }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this._buildPdf(doc, this.selectedContrat);
    doc.save(`Contrat-${this.selectedContrat.numeroContrat}.pdf`);
  }

  private _buildPdf(doc: any, c: ContratTravailResponse): void {
    const W = 210, margin = 18;
    let y = 0;

    doc.setFillColor(12, 31, 63);
    doc.rect(0, 0, W, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('MADINA', margin, 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Municipalité de Madina — Système de Gestion Urbaine', margin, 25);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`N° ${c.numeroContrat}`, W - margin, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Émis le : ${new Date(c.dateCreation).toLocaleDateString('fr-FR')}`, W - margin, 24, { align: 'right' });
    doc.text(`Tentative : ${c.tentative}`, W - margin, 29, { align: 'right' });

    y = 46;
    doc.setTextColor(12, 31, 63); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text('CONTRAT DE MISSION DE TRAVAUX', W / 2, y, { align: 'center' });
    doc.setDrawColor(232, 83, 42); doc.setLineWidth(0.8);
    doc.line(margin, y + 3, W - margin, y + 3);
    y += 12;

    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    const preambule = `La Municipalité de Madina, agissant dans le cadre de sa mission de service public, confie par le présent contrat la réalisation des travaux décrits ci-dessous à l'équipe désignée.`;
    const lines = doc.splitTextToSize(preambule, W - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 5 + 6;

    y = this._pdfSection(doc, '1. ÉQUIPE ASSIGNÉE', y, margin, W);
    y = this._pdfRow(doc, 'Équipe',       c.equipeLabel,                                  y, margin);
    y = this._pdfRow(doc, 'Code équipe',  c.equipeCode?.toUpperCase() ?? '—',             y, margin);
    y = this._pdfRow(doc, 'Délai estimé', c.delaiEstimeHeures ? `${c.delaiEstimeHeures}h` : '—', y, margin);
    y = this._pdfRow(doc, 'Chef assigné', c.chefEquipeNom ?? c.chefEquipeId ?? 'En attente d\'attribution',  y, margin);
    y += 4;

    const sig = c.signalement;
    y = this._pdfSection(doc, '2. DÉTAILS DU SIGNALEMENT', y, margin, W);
    y = this._pdfRow(doc, 'Référence',    sig ? `#${sig.id}` : '—',                       y, margin);
    y = this._pdfRow(doc, 'Type',         this._pdfTypeLabel(sig?.type ?? ''),             y, margin);
    y = this._pdfRow(doc, 'Adresse',      sig?.adresse ?? '—',                            y, margin);
    y = this._pdfRow(doc, 'Priorité',     sig?.prioriteCitoyen ?? '—',                    y, margin);
    if (sig?.confidenceIA != null)
      y = this._pdfRow(doc, 'Confiance IA', `${Math.round(sig.confidenceIA * 100)}%`,     y, margin);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(12, 31, 63);
    doc.text('Description :', margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    const desc = doc.splitTextToSize(sig?.description ?? '—', W - margin * 2);
    doc.text(desc, margin, y); y += desc.length * 4.5 + 6;

    y = this._pdfSection(doc, '3. OBLIGATIONS DE L\'ÉQUIPE', y, margin, W);
    const obligations = [
      `• Prendre en charge l'intervention dans un délai de ${c.delaiEstimeHeures ?? 48}h à compter de l'acceptation.`,
      '• Signaler tout obstacle imprévu à la direction technique dans les 24h.',
      '• Fournir un rapport d\'intervention à la clôture du chantier.',
      '• Respecter les normes de sécurité et les réglementations en vigueur.',
    ];
    doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
    obligations.forEach(o => { const ls = doc.splitTextToSize(o, W - margin * 2); doc.text(ls, margin, y); y += ls.length * 4.5 + 1.5; });
    y += 4;

    if (y > 230) { doc.addPage(); y = 20; }
    y = this._pdfSection(doc, '4. SIGNATURES', y, margin, W);
    const colL = margin, colR = W / 2 + 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(12, 31, 63);
    doc.text('Pour la Municipalité de Madina', colL, y);
    doc.text('Pour le Chef d\'Équipe', colR, y); y += 5;
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
    doc.rect(colL, y, 78, 30); doc.rect(colR, y, 78, 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text('Signature + Cachet', colL + 4, y + 6);
    doc.text('Signature numérique', colR + 4, y + 6);
    this._drawCachet(doc, colL + 18, y + 17); y += 38;
    doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(`Date : ______________________`, colL, y); doc.text(`Date : ______________________`, colR, y); y += 10;
    const pageH = 297;
    doc.setDrawColor(232, 83, 42); doc.setLineWidth(0.5);
    doc.line(margin, pageH - 15, W - margin, pageH - 15);
    doc.setFontSize(7); doc.setTextColor(120, 120, 120);
    doc.text('Madina — Plateforme CityVoice © 2025 — Document généré automatiquement par intelligence artificielle', W / 2, pageH - 10, { align: 'center' });
    doc.text(`Contrat N° ${c.numeroContrat}`, margin, pageH - 10);
    doc.text(`Page 1/1`, W - margin, pageH - 10, { align: 'right' });
  }

  private _pdfSection(doc: any, title: string, y: number, margin: number, W: number): number {
    doc.setFillColor(232, 83, 42); doc.rect(margin, y, W - margin * 2, 6.5, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(title, margin + 3, y + 4.5); return y + 11;
  }

  private _pdfRow(doc: any, label: string, value: string, y: number, margin: number): number {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(12, 31, 63);
    doc.text(`${label} :`, margin, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    doc.text(value ?? '—', margin + 38, y);
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.2);
    doc.line(margin, y + 1.5, 195, y + 1.5); return y + 6.5;
  }

  private _drawCachet(doc: any, cx: number, cy: number): void {
    const r = 12;
    doc.setDrawColor(12, 31, 63); doc.setLineWidth(1);
    doc.circle(cx, cy, r, 'S'); doc.setLineWidth(0.4); doc.circle(cx, cy, r - 2.5, 'S');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(4.5); doc.setTextColor(12, 31, 63);
    doc.text('• MUNICIPALITÉ DE MADINA •', cx, cy - r + 1.8, { align: 'center' });
    doc.text('• TUNISIE • CITYVOICE •', cx, cy + r - 0.8, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('MADINA', cx, cy - 1.5, { align: 'center' });
    doc.setFontSize(5); doc.setFont('helvetica', 'normal');
    doc.text('OFFICIEL', cx, cy + 2.5, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(232, 83, 42);
    doc.text('★', cx, cy + 0.5, { align: 'center' });
    doc.setTextColor(12, 31, 63);
  }

  private _pdfTypeLabel(type: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE: 'Trou dans la chaussée', LAMPADAIRE_CASSE: 'Lampadaire cassé',
      FUITE_EAU: "Fuite d'eau", DECHETS_NON_COLLECTES: 'Déchets non collectés',
      POTEAU_ENDOMMAGE: 'Poteau endommagé', SIGNALISATION_MANQUANTE: 'Signalisation manquante',
      CANIVEAU_BOUCHE: 'Caniveau bouché', ESPACE_VERT_DEGRADE: 'Espace vert dégradé', AUTRE: 'Autre',
    };
    return map[type] ?? type;
  }

  // ── Ouvrir / fermer détail signalement ───────────────────────────
  openSignalement(s: any): void {
    this.selectedSignalement = s;
  }
  closeSignalement(): void {
    this.selectedSignalement = null;
  }
  openResolutionFromDetail(): void {
    if (!this.selectedSignalement) return;
    this.resolutionSig = this.selectedSignalement;
    this.selectedSignalement = null;
  }

  /** Libellé complet pour un type de signalement */
  typeFullLabel(t: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE:         'Trou dans la chaussée',
      LAMPADAIRE_CASSE:      'Lampadaire cassé',
      FUITE_EAU:             "Fuite d'eau",
      DECHETS_NON_COLLECTES: 'Déchets non collectés',
      POTEAU_ENDOMMAGE:      'Poteau endommagé',
      SIGNALISATION_MANQUANTE: 'Signalisation manquante',
      CANIVEAU_BOUCHE:       'Caniveau bouché',
      ESPACE_VERT_DEGRADE:   'Espace vert dégradé',
      ECLAIRAGE_DEFAILLANT:  'Éclairage défaillant',
      INFRASTRUCTURE_ENDOMMAGEE: 'Infrastructure endommagée',
      AUTRE:                 'Autre signalement',
    };
    return map[t] ?? (t?.replace(/_/g, ' ') ?? '');
  }

  // ── Ouvrir résolution (popup partagé) ────────────────────────────
  openResolution(sig: any): void {
    this.resolutionSig = sig;
  }

  /** Deep-link /chef?tab=resolution&sigId=… */
  private _subscribeResolutionQueryParams(): void {
    const sub = this.route.queryParamMap.subscribe(pm => {
      const tab   = pm.get('tab');
      const sigId = pm.get('sigId');
      if (tab !== 'resolution' || !sigId) return;
      const id = +sigId;
      if (!Number.isFinite(id) || id <= 0) return;
      if (this.resolutionSig?.id === id) return;
      this.sigSvc.getById(id).subscribe({
        next: (sig) => this.zone.run(() => {
          this.resolutionSig = sig;
          this.cd.detectChanges();
        }),
        error: () => this.zone.run(() => {
          this.showToast('Signalement introuvable ou inaccessible.', 'error');
        }),
      });
    });
    this.subs.push(sub);
  }

  onResolutionModalClosed(): void {
    this.resolutionSig = null;
    const hasDeepLink =
      this.route.snapshot.queryParamMap.get('tab') === 'resolution' ||
      !!this.route.snapshot.queryParamMap.get('sigId');
    if (hasDeepLink) {
      this.router.navigate(['/chef'], { replaceUrl: true });
    }
    this.cd.detectChanges();
  }

  onResolutionModalResolved(): void {
    this.loadContrats();
    this.loadSignalements();
  }

  // ── Getters filtrage ──────────────────────────────────────────────
  get contratsEnAttente(): ContratTravailResponse[] {
    return this.contrats.filter(c => c.statut === 'EN_ATTENTE_SIGNATURE');
  }
  get contratsAcceptes(): ContratTravailResponse[] {
    return this.contrats.filter(c => c.statut === 'ACCEPTE');
  }

  // ── Contrats : filtre + recherche + pagination ────────────────────
  get contratsFiltered(): ContratTravailResponse[] {
    let list = this.contrats;
    if (this.contratFilter !== 'TOUS') {
      list = list.filter(c => c.statut === this.contratFilter);
    }
    const q = this.contratSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        (c.numeroContrat ?? '').toLowerCase().includes(q) ||
        (c.equipeLabel   ?? '').toLowerCase().includes(q) ||
        (c.chefEquipeNom ?? '').toLowerCase().includes(q) ||
        (c.signalement?.type ?? '').toLowerCase().includes(q) ||
        (c.signalement?.adresse ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }
  get contratsPageCount(): number {
    return Math.max(1, Math.ceil(this.contratsFiltered.length / this.contratPageSize));
  }
  get contratsPaged(): ContratTravailResponse[] {
    const start = this.contratPage * this.contratPageSize;
    return this.contratsFiltered.slice(start, start + this.contratPageSize);
  }
  setContratFilter(f: string): void { this.contratFilter = f; this.contratPage = 0; }
  setContratSearch(q: string): void { this.contratSearch = q; this.contratPage = 0; }

  // ── Signalements : pagination ─────────────────────────────────────
  get sigPageCount(): number {
    return Math.max(1, Math.ceil(this.sigFiltered.length / this.sigPageSize));
  }
  get sigPaged(): any[] {
    const start = this.sigPage * this.sigPageSize;
    return this.sigFiltered.slice(start, start + this.sigPageSize);
  }
  setSigFilter(f: string): void { this.sigFilter = f; this.sigPage = 0; }
  setSigSearch(q: string): void { this.sigSearch = q; this.sigPage = 0; }
  get sigEnCours(): any[] {
    return this.signalements.filter(s => s.statut === 'EN_COURS');
  }
  get sigResolus(): any[] {
    return this.signalements.filter(s => s.statut === 'RESOLU');
  }
  get sigFiltered(): any[] {
    let list = this.signalements;
    // Status filter
    if (this.sigFilter === 'URGENTS') {
      list = list.filter(s => s.prioriteIA === 'URGENTE' || s.prioriteCitoyen === 'URGENTE');
    } else if (this.sigFilter !== 'TOUS') {
      list = list.filter(s => s.statut === this.sigFilter);
    }
    // Text search
    const q = this.sigSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(s =>
        (s.description ?? '').toLowerCase().includes(q) ||
        (s.adresse     ?? '').toLowerCase().includes(q) ||
        (s.type        ?? '').toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    }
    // Sort
    if (this.sigSortBy === 'priorite') {
      const pOrd: Record<string, number> = { URGENTE: 0, HAUTE: 1, MOYENNE: 2, FAIBLE: 3 };
      list = [...list].sort((a, b) => {
        const pa = pOrd[a.prioriteIA ?? a.prioriteCitoyen ?? ''] ?? 4;
        const pb = pOrd[b.prioriteIA ?? b.prioriteCitoyen ?? ''] ?? 4;
        return pa - pb;
      });
    }
    return list;
  }
  get sigUrgents(): number {
    return this.signalements.filter(s =>
      s.prioriteIA === 'URGENTE' || s.prioriteCitoyen === 'URGENTE'
    ).length;
  }
  get sigResolutionRate(): number {
    if (!this.signalements.length) return 0;
    return Math.round((this.sigResolus.length / this.signalements.length) * 100);
  }

  // ── Badge helpers ─────────────────────────────────────────────────
  statutClass(statut: string): string {
    return ({ EN_ATTENTE_SIGNATURE: 'badge-warning', ACCEPTE: 'badge-success',
              REFUSE: 'badge-danger', REASSIGNE: 'badge-info' } as any)[statut] ?? 'badge-muted';
  }
  statutLabel(statut: string): string {
    return ({ EN_ATTENTE_SIGNATURE: 'En attente', ACCEPTE: 'Accepté',
              REFUSE: 'Refusé', REASSIGNE: 'Réassigné' } as any)[statut] ?? statut;
  }
  typeLabel(t: string): string {
    return t?.replace(/_/g, ' ') ?? '';
  }

  // ── Signalement priority/status helpers ───────────────────────────
  prioClass(p: string): string {
    return ({ URGENTE: 'sig-prio--urgente', HAUTE: 'sig-prio--haute',
              MOYENNE: 'sig-prio--moyenne', FAIBLE: 'sig-prio--faible' } as any)[p] ?? 'sig-prio--faible';
  }
  prioLabel(p: string): string {
    return ({ URGENTE: '🔴 Urgente', HAUTE: '🟠 Haute',
              MOYENNE: '🟡 Moyenne', FAIBLE: '🟢 Faible' } as any)[p] ?? (p ?? '');
  }
  sigStatutClass(s: string): string {
    return ({ EN_COURS: 'sstat--en-cours', RESOLU: 'sstat--resolu',
              EN_ATTENTE: 'sstat--en-attente', REJETE: 'sstat--rejete' } as any)[s] ?? 'sstat--en-attente';
  }
  sigStatutLabel(s: string): string {
    return ({ EN_COURS: 'En cours', RESOLU: 'Résolu',
              EN_ATTENTE: 'En attente', REJETE: 'Rejeté',
              CREE: 'Créé', EN_TRAITEMENT: 'En traitement' } as any)[s] ?? s?.replace(/_/g, ' ');
  }
  timeAgo(date: string): string {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return `À l'instant`;
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Hier';
    if (d < 7)  return `Il y a ${d} jours`;
    return new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  }

  // ── Toast ─────────────────────────────────────────────────────────
  showToast(msg: string, type: 'success' | 'error' = 'success'): void {
    clearTimeout(this.toastTO);
    this.toastMsg  = msg;
    this.toastType = type;
    this.toast     = true;
    this.cd.detectChanges();
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.ce-toast', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .3 });
    }
    this.toastTO = setTimeout(() => {
      if (typeof gsap !== 'undefined') {
        gsap.to('.ce-toast', { y: 24, opacity: 0, duration: .25,
          onComplete: () => this.zone.run(() => { this.toast = false; this.cd.detectChanges(); }) });
      } else { this.toast = false; this.cd.detectChanges(); }
    }, 3500);
  }

  // ── Canvas signature ──────────────────────────────────────────────
  private _initCanvas(): void {
    this.signCanvas = document.querySelector('.sign-canvas');
    if (!this.signCanvas) return;
    this.signCtx = this.signCanvas.getContext('2d')!;
    this.signCtx.strokeStyle = '#0C1F3F';
    this.signCtx.lineWidth   = 2.5;
    this.signCtx.lineCap     = 'round';
    this.signCtx.lineJoin    = 'round';
    const c = this.signCanvas;
    c.addEventListener('mousedown',  this._startDraw);
    c.addEventListener('mousemove',  this._drawLine);
    c.addEventListener('mouseup',    this._stopDraw);
    c.addEventListener('mouseleave', this._stopDraw);
    c.addEventListener('touchstart', this._touchStart, { passive: false });
    c.addEventListener('touchmove',  this._touchMove,  { passive: false });
    c.addEventListener('touchend',   this._stopDraw);
  }

  private _detachCanvas(): void {
    if (!this.signCanvas) return;
    this.signCanvas.removeEventListener('mousedown',  this._startDraw);
    this.signCanvas.removeEventListener('mousemove',  this._drawLine);
    this.signCanvas.removeEventListener('mouseup',    this._stopDraw);
    this.signCanvas.removeEventListener('mouseleave', this._stopDraw);
    this.signCanvas.removeEventListener('touchstart', this._touchStart);
    this.signCanvas.removeEventListener('touchmove',  this._touchMove);
    this.signCanvas.removeEventListener('touchend',   this._stopDraw);
  }

  private _startDraw = (e: MouseEvent) => {
    this.drawing = true;
    const r = this.signCanvas!.getBoundingClientRect();
    this.lastX = e.clientX - r.left; this.lastY = e.clientY - r.top;
  };
  private _drawLine = (e: MouseEvent) => {
    if (!this.drawing) return;
    const r = this.signCanvas!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    this.signCtx!.beginPath(); this.signCtx!.moveTo(this.lastX, this.lastY);
    this.signCtx!.lineTo(x, y); this.signCtx!.stroke();
    this.lastX = x; this.lastY = y;
    this.signatureData = this.signCanvas!.toDataURL();
  };
  private _stopDraw    = () => { this.drawing = false; };
  private _touchStart  = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0], r = this.signCanvas!.getBoundingClientRect();
    this.drawing = true; this.lastX = t.clientX - r.left; this.lastY = t.clientY - r.top;
  };
  private _touchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.drawing) return;
    const t = e.touches[0], r = this.signCanvas!.getBoundingClientRect();
    const x = t.clientX - r.left, y = t.clientY - r.top;
    this.signCtx!.beginPath(); this.signCtx!.moveTo(this.lastX, this.lastY);
    this.signCtx!.lineTo(x, y); this.signCtx!.stroke();
    this.lastX = x; this.lastY = y;
    this.signatureData = this.signCanvas!.toDataURL();
  };

  clearSignature(): void {
    if (!this.signCanvas || !this.signCtx) return;
    this.signCtx.clearRect(0, 0, this.signCanvas.width, this.signCanvas.height);
    this.signatureData = '';
  }

  // ── Animations GSAP ───────────────────────────────────────────────
  private _animateDashboard(): void {
    if (typeof gsap === 'undefined') return;

    gsap.fromTo('.ce-sidebar',
      { x: -32, opacity: 0 },
      { x: 0, opacity: 1, duration: .55, ease: 'power3.out' });

    gsap.fromTo('.ce-main',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: .5, ease: 'power3.out', delay: .1 });

    gsap.fromTo('.ce-kpi-card',
      { y: 24, opacity: 0, scale: .94 },
      { y: 0, opacity: 1, scale: 1, duration: .4, stagger: .08,
        ease: 'back.out(1.6)', delay: .22 });

    // Anime les valeurs KPI de 0 → valeur réelle
    setTimeout(() => this._animateKpiCounters(), 450);
  }

  private _animateKpiCounters(): void {
    if (typeof gsap === 'undefined') return;
    document.querySelectorAll('.ce-kpi-val').forEach(el => {
      const target = parseInt(el.textContent ?? '0', 10);
      if (isNaN(target) || target === 0) return;
      gsap.fromTo({ val: 0 }, { val: target, duration: .9, ease: 'power2.out',
        onUpdate: function() { el.textContent = String(Math.round(this.targets()[0].val)); }
      });
    });
  }

  private _animateView(): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo('.ce-view-content',
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: .35, ease: 'power3.out' });

    // Stagger les cartes listées dans la vue active
    setTimeout(() => {
      const cards = document.querySelectorAll('.ce-contrat-card, .ce-sig-card');
      if (cards.length) {
        gsap.fromTo(cards,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: .32, stagger: .06, ease: 'power2.out' });
      }
    }, 60);
  }

}
