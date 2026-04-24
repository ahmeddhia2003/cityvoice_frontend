import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ContratTravailService, ContratTravailResponse } from '../../../core/services/contrat-travail.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-contrat-signing',
  templateUrl: './contrat-signing.component.html',
  styleUrls:  ['./contrat-signing.component.css'],
})
export class ContratSigningComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('signatureCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  contrat: ContratTravailResponse | null = null;
  loading   = true;
  error:    string | null = null;
  action:   'idle' | 'signing' | 'refusing' | 'submitting' | 'done' = 'idle';
  motifRefus = '';
  signatureEmpty = true;
  successMsg: string | null = null;

  private ctx!:          CanvasRenderingContext2D;
  private drawing        = false;
  private lastX          = 0;
  private lastY          = 0;
  private boundMove!:    (e: MouseEvent | TouchEvent) => void;
  private boundUp!:      () => void;

  constructor(
    private route:   ActivatedRoute,
    private router:  Router,
    private svc:     ContratTravailService,
    private auth:    AuthService,
    private ngZone:  NgZone,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.svc.getById(id).subscribe({
      next:  c  => { this.contrat = c; this.loading = false; },
      error: () => { this.error = 'Contrat introuvable.'; this.loading = false; },
    });
  }

  ngAfterViewInit(): void {
    // Canvas initialisé après que le contrat soit chargé
  }

  private initCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.strokeStyle = '#0C1F3F';
    this.ctx.lineWidth   = 2.5;
    this.ctx.lineCap     = 'round';
    this.ctx.lineJoin    = 'round';

    this.boundMove = (e: MouseEvent | TouchEvent) => this.onDraw(e);
    this.boundUp   = () => { this.drawing = false; };

    canvas.addEventListener('mousedown',  (e: MouseEvent)  => this.startDraw(e));
    canvas.addEventListener('mousemove',  this.boundMove as EventListener);
    canvas.addEventListener('mouseup',    this.boundUp);
    canvas.addEventListener('mouseleave', this.boundUp);
    canvas.addEventListener('touchstart', (e: TouchEvent)  => { e.preventDefault(); this.startDraw(e); }, { passive: false });
    canvas.addEventListener('touchmove',  this.boundMove as EventListener, { passive: false });
    canvas.addEventListener('touchend',   this.boundUp);
  }

  ngOnDestroy(): void {}

  /* ── Dessin ─────────────────────────────────── */
  private getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    if (e instanceof TouchEvent) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  }

  private startDraw(e: MouseEvent | TouchEvent): void {
    this.drawing = true;
    const pos = this.getPos(e);
    this.lastX = pos.x; this.lastY = pos.y;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.signatureEmpty = false;
  }

  private onDraw(e: MouseEvent | TouchEvent): void {
    if (!this.drawing) return;
    if (e instanceof TouchEvent) e.preventDefault();
    const pos = this.getPos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.lastX = pos.x; this.lastY = pos.y;
  }

  clearSignature(): void {
    const c = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, c.width, c.height);
    this.signatureEmpty = true;
  }

  /* ── Actions ─────────────────────────────────── */
  openSignPanel(): void {
    this.action = 'signing';
    setTimeout(() => this.initCanvas(), 100);
  }

  openRefusePanel(): void {
    this.action = 'refusing';
  }

  cancel(): void {
    this.action = 'idle';
    this.motifRefus = '';
  }

  accepter(): void {
    if (!this.contrat || this.signatureEmpty) return;
    const sigData = this.canvasRef.nativeElement.toDataURL('image/png');
    const userId  = this.auth.getCurrentUser()?.userId ?? 'chef';
    this.action   = 'submitting';

    this.svc.accepter(this.contrat.id, { signatureBase64: sigData }, userId).subscribe({
      next: (updated) => this.ngZone.run(() => {
        this.contrat    = updated;
        this.action     = 'done';
        this.successMsg = `✅ Contrat ${updated.numeroContrat} accepté — le signalement passe EN COURS.`;
      }),
      error: () => this.ngZone.run(() => {
        this.error  = 'Erreur lors de l\'acceptation. Réessayez.';
        this.action = 'signing';
      }),
    });
  }

  refuser(): void {
    if (!this.contrat || !this.motifRefus.trim()) return;
    const userId = this.auth.getCurrentUser()?.userId ?? 'chef';
    this.action  = 'submitting';

    this.svc.refuser(this.contrat.id, { motifRefus: this.motifRefus }, userId).subscribe({
      next: (newContrat) => this.ngZone.run(() => {
        this.action     = 'done';
        this.successMsg = `🔄 Contrat refusé — nouveau contrat ${newContrat.numeroContrat} généré pour ${newContrat.equipeLabel}.`;
      }),
      error: () => this.ngZone.run(() => {
        this.error  = 'Erreur lors du refus. Réessayez.';
        this.action = 'refusing';
      }),
    });
  }

  /* ── PDF Export ─────────────────────────────── */
  exportPdf(): void {
    if (!this.contrat) return;

    // Vérifier que jsPDF a bien été chargé via CDN (index.html).
    const jspdfLib = (window as any).jspdf;
    if (!jspdfLib || !jspdfLib.jsPDF) {
      this.error = "Bibliothèque PDF indisponible. Rechargez la page puis réessayez.";
      console.error('[exportPdf] jsPDF non chargé — vérifier le <script> CDN dans index.html');
      return;
    }

    try {
      const { jsPDF } = jspdfLib;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit:        'mm',
        format:      'a4',
        putOnlyUsedFonts: true,
        compress:    true,
      });
      this.buildPdf(doc, this.contrat);
      doc.save(`Contrat-${this.contrat.numeroContrat}.pdf`);
    } catch (err) {
      console.error('[exportPdf] Erreur pendant la génération :', err);
      this.error = "Impossible de générer le PDF. Consultez la console pour plus de détails.";
    }
  }

  /** Récupère le nom complet du chef (fallback sur ID puis placeholder). */
  private chefDisplay(c: ContratTravailResponse): string {
    const nom = (c.chefEquipeNom || '').trim();
    if (nom) return nom;
    if (c.chefEquipeId && c.chefEquipeId.trim()) return c.chefEquipeId;
    return "En attente d'attribution";
  }

  buildPdf(doc: any, c: ContratTravailResponse): void {
    const W = 210, margin = 18;
    let y = 0;

    /* ─── Fond en-tête bleu marine ─── */
    doc.setFillColor(12, 31, 63);
    doc.rect(0, 0, W, 38, 'F');

    /* Bande orange décorative */
    doc.setFillColor(232, 83, 42);
    doc.rect(0, 36, W, 2, 'F');

    /* Logo / Nom ville */
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MADINA', margin, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Municipalite de Madina - Systeme de Gestion Urbaine', margin, 25);
    doc.setFontSize(7.5);
    doc.setTextColor(200, 210, 230);
    doc.text('Plateforme CityVoice - Republique Tunisienne', margin, 30);

    /* Numéro de contrat */
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`N${'\u00B0'} ${c.numeroContrat}`, W - margin, 17, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Emis le : ${new Date(c.dateCreation).toLocaleDateString('fr-FR')}`, W - margin, 23, { align: 'right' });
    doc.text(`Tentative : ${c.tentative}`, W - margin, 28, { align: 'right' });

    y = 48;

    /* ─── Titre ─── */
    doc.setTextColor(12, 31, 63);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRAT DE MISSION DE TRAVAUX', W / 2, y, { align: 'center' });
    doc.setDrawColor(232, 83, 42);
    doc.setLineWidth(0.8);
    doc.line(margin, y + 3, W - margin, y + 3);
    y += 12;

    /* ─── Préambule ─── */
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const preambule =
      "La Municipalite de Madina, agissant dans le cadre de sa mission de service public, " +
      "confie par le present contrat la realisation des travaux decrits ci-dessous a l'equipe designee.";
    const lines = doc.splitTextToSize(preambule, W - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;

    /* ─── Section : Équipe assignée ─── */
    y = this.pdfSection(doc, '1. EQUIPE ASSIGNEE', y, margin, W);
    y = this.pdfRow(doc, 'Equipe',       c.equipeLabel,                y, margin);
    y = this.pdfRow(doc, 'Code equipe',  c.equipeCode.toUpperCase(),   y, margin);
    y = this.pdfRow(doc, 'Chef assigne', this.chefDisplay(c),          y, margin);
    y += 4;

    /* ─── Section : Signalement ─── */
    const sig = c.signalement;
    y = this.pdfSection(doc, '2. DETAILS DU SIGNALEMENT', y, margin, W);
    y = this.pdfRow(doc, 'Reference',    sig ? `#${sig.id}` : '-',            y, margin);
    y = this.pdfRow(doc, 'Type',         this.asciiSafe(this.typeLabel(sig?.type ?? '')), y, margin);
    y = this.pdfRow(doc, 'Adresse',      this.asciiSafe(sig?.adresse ?? '-'), y, margin);
    y = this.pdfRow(doc, 'Priorite',     sig?.prioriteCitoyen ?? '-',         y, margin);
    y = this.pdfRow(doc, 'Delai estime', c.delaiEstimeHeures
                                          ? `${c.delaiEstimeHeures}h` : '-', y, margin);
    const confPct = sig?.confidenceIA != null
      ? `${Math.round(sig.confidenceIA * 100)}%` : '-';
    y = this.pdfRow(doc, 'Confiance IA', confPct,                            y, margin);

    /* Description */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(12, 31, 63);
    doc.text('Description :', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const desc = doc.splitTextToSize(this.asciiSafe(sig?.description ?? '-'), W - margin * 2);
    doc.text(desc, margin, y);
    y += desc.length * 4.5 + 6;

    /* ─── Section : Obligations ─── */
    y = this.pdfSection(doc, '3. OBLIGATIONS DE L\'EQUIPE', y, margin, W);
    const obligations = [
      `- Prendre en charge l'intervention dans un delai de ${c.delaiEstimeHeures ?? c.signalement?.delaiEstimeHeures ?? '48'}h a compter de l'acceptation.`,
      "- Signaler tout obstacle imprevu a la direction technique dans les 24h.",
      "- Fournir un rapport d'intervention a la cloture du chantier.",
      "- Respecter les normes de securite et les reglementations en vigueur.",
    ];
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    obligations.forEach(o => {
      const ls = doc.splitTextToSize(o, W - margin * 2);
      doc.text(ls, margin, y);
      y += ls.length * 4.5 + 1.5;
    });
    y += 4;

    /* ─── Signatures ─── */
    if (y > 210) { doc.addPage(); y = 20; }
    y = this.pdfSection(doc, '4. SIGNATURES', y, margin, W);

    const colL = margin, colR = W / 2 + 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 31, 63);
    doc.text('Pour la Municipalite de Madina', colL, y);
    doc.text("Pour le Chef d'Equipe", colR, y);
    y += 5;

    /* Cadres signature */
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(colL, y, 78, 40);
    doc.rect(colR, y, 78, 40);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Signature + Cachet officiel', colL + 4, y + 6);
    doc.text('Signature numerique du chef', colR + 4, y + 6);

    /* ─── Cachet numérique Madina (côté municipalité) ─── */
    this.drawCachet(doc, colL + 39, y + 24, c);

    /* ─── Nom du chef côté droit, si dispo ─── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(12, 31, 63);
    doc.text(this.chefDisplay(c), colR + 4, y + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`Equipe : ${c.equipeCode.toUpperCase()}`, colR + 4, y + 35);

    y += 48;

    /* Ligne de date */
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Date : ______________________", colL, y);
    doc.text("Date : ______________________", colR, y);
    y += 10;

    /* ─── Pied de page ─── */
    const pageH = 297;
    doc.setDrawColor(232, 83, 42);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 15, W - margin, pageH - 15);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('Madina - Plateforme CityVoice (c) 2026 - Document genere automatiquement par intelligence artificielle',
      W / 2, pageH - 10, { align: 'center' });
    doc.text(`Contrat N${'\u00B0'} ${c.numeroContrat}`, margin, pageH - 10);
    doc.text('Page 1/1', W - margin, pageH - 10, { align: 'right' });
  }

  /** Retourne une version ASCII-safe (utile pour les champs libres).
   *  jsPDF helvetica gère Latin-1 mais certains caractères spéciaux (emoji,
   *  tirets longs) passent mal — on les normalise. */
  private asciiSafe(s: string): string {
    if (!s) return '-';
    return s
      .replace(/[\u2013\u2014]/g, '-')   // em/en dash → -
      .replace(/[\u2018\u2019]/g, "'")   // smart quotes → '
      .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → "
      .replace(/\u2026/g, '...')         // ellipsis
      .replace(/[\u2022\u25CF]/g, '-');  // bullets → -
  }

  private pdfSection(doc: any, title: string, y: number, margin: number, W: number): number {
    doc.setFillColor(232, 83, 42);
    doc.rect(margin, y, W - margin * 2, 6.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin + 3, y + 4.5);
    return y + 11;
  }

  private pdfRow(doc: any, label: string, value: string, y: number, margin: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(12, 31, 63);
    doc.text(`${label} :`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(value ?? '—', margin + 38, y);
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1.5, 195, y + 1.5);
    return y + 6.5;
  }

  /**
   * Dessine le cachet officiel Madina dans le PDF.
   * Design professionnel : double cercle avec texte circulaire (simulé),
   * étoiles cardinales, logo central + numéro de contrat & date.
   */
  private drawCachet(doc: any, cx: number, cy: number, c: ContratTravailResponse): void {
    const rOut = 14;
    const rMid = 12;
    const rIn  = 9.5;

    /* ─── Cercle extérieur (épais, bleu marine) ─── */
    doc.setDrawColor(12, 31, 63);
    doc.setLineWidth(1.1);
    doc.circle(cx, cy, rOut, 'S');

    /* ─── Cercle intermédiaire (fin, crée effet "double trait") ─── */
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, rMid, 'S');

    /* ─── Cercle intérieur (plus fin) ─── */
    doc.setLineWidth(0.25);
    doc.circle(cx, cy, rIn, 'S');

    /* ─── Texte circulaire simulé (haut) : "MUNICIPALITE DE MADINA"
     *     on répartit les lettres en arc de cercle (approximation). */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.6);
    doc.setTextColor(12, 31, 63);
    this.drawCircularText(doc, 'MUNICIPALITE DE MADINA', cx, cy, rMid - 1.1, -Math.PI / 2, 'top');

    /* ─── Texte circulaire (bas) : "REPUBLIQUE TUNISIENNE * CITYVOICE *" ─── */
    this.drawCircularText(doc, 'REPUBLIQUE TUNISIENNE * CITYVOICE', cx, cy, rMid - 1.1, Math.PI / 2, 'bottom');

    /* ─── Étoiles décoratives cardinales (gauche & droite) ─── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(232, 83, 42);
    doc.text('*', cx - rMid + 0.9, cy + 0.6, { align: 'center' });
    doc.text('*', cx + rMid - 0.9, cy + 0.6, { align: 'center' });

    /* ─── Bloc central : logo + nom + étoile ─── */
    doc.setTextColor(12, 31, 63);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('MADINA', cx, cy - 2.1, { align: 'center' });

    // Étoile centrale (orange, signature visuelle de la marque)
    doc.setFontSize(7.5);
    doc.setTextColor(232, 83, 42);
    doc.text('*', cx, cy + 0.3, { align: 'center' });

    doc.setTextColor(12, 31, 63);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3.8);
    doc.text('OFFICIEL', cx, cy + 3.1, { align: 'center' });

    /* ─── Numéro de contrat et date (dans le cercle intérieur) ─── */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.2);
    doc.setTextColor(80, 80, 80);
    const numShort = (c.numeroContrat || '').slice(-10);
    doc.text(`N${'\u00B0'} ${numShort}`, cx, cy + 5.2, { align: 'center' });

    const dateStr = c.dateCreation
      ? new Date(c.dateCreation).toLocaleDateString('fr-FR')
      : '';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3);
    doc.text(dateStr, cx, cy + 7.3, { align: 'center' });

    /* ─── Reset couleurs ─── */
    doc.setTextColor(12, 31, 63);
    doc.setDrawColor(12, 31, 63);
  }

  /**
   * Simule un texte circulaire en plaçant chaque caractère avec une rotation
   * individuelle le long d'un arc. `angleCenter` est l'angle du centre du texte
   * (en radians, 0 = droite, -π/2 = haut, π/2 = bas).
   * `position` = 'top' (lettres tournées vers le centre du haut) ou
   * 'bottom' (lettres tournées vers le centre du bas).
   */
  private drawCircularText(
    doc: any,
    text: string,
    cx: number,
    cy: number,
    radius: number,
    angleCenter: number,
    position: 'top' | 'bottom'
  ): void {
    const chars = text.split('');
    // Largeur angulaire par caractère — ajustée empiriquement à 3.6pt
    const angleStep = 0.135;
    const totalAngle = (chars.length - 1) * angleStep;
    const startAngle = angleCenter - totalAngle / 2;

    chars.forEach((ch, i) => {
      const a = startAngle + i * angleStep;
      const x = cx + radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      // Rotation : pour le haut, on oriente les lettres vers l'extérieur (radial)
      // jsPDF angle est en degrés, sens horaire inverse.
      const deg = position === 'top'
        ? (a * 180 / Math.PI) + 90
        : (a * 180 / Math.PI) - 90;
      doc.text(ch, x, y, { align: 'center', angle: -deg });
    });
  }

  /* ── Helpers ─────────────────────────────────── */
  typeLabel(type: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE:           'Trou dans la chaussée',
      LAMPADAIRE_CASSE:        'Lampadaire cassé',
      FUITE_EAU:               "Fuite d'eau",
      DECHETS_NON_COLLECTES:   'Déchets non collectés',
      POTEAU_ENDOMMAGE:        'Poteau endommagé',
      SIGNALISATION_MANQUANTE: 'Signalisation manquante',
      CANIVEAU_BOUCHE:         'Caniveau bouché',
      ESPACE_VERT_DEGRADE:     'Espace vert dégradé',
      AUTRE:                   'Autre',
    };
    return map[type] ?? type;
  }

  prioriteClass(p: string): string {
    const m: Record<string, string> = {
      URGENTE: 'prio-urgente', HAUTE: 'prio-haute',
      MOYENNE: 'prio-moyenne', FAIBLE: 'prio-faible',
    };
    return m[p] ?? '';
  }

  statutLabel(s: string): string {
    const m: Record<string, string> = {
      EN_ATTENTE_SIGNATURE: '⏳ En attente de signature',
      ACCEPTE:              '✅ Accepté',
      REFUSE:               '❌ Refusé',
      REASSIGNE:            '🔄 Réassigné',
    };
    return m[s] ?? s;
  }

  goBack(): void { this.router.navigate(['/admin/signalements']); }
}
