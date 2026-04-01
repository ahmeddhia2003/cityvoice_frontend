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
    // Injecter jsPDF depuis CDN (déclaré dans index.html)
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    this.buildPdf(doc, this.contrat);
    doc.save(`Contrat-${this.contrat.numeroContrat}.pdf`);
  }

  buildPdf(doc: any, c: ContratTravailResponse): void {
    const W = 210, margin = 18;
    let y = 0;

    /* ─── Fond en-tête bleu marine ─── */
    doc.setFillColor(12, 31, 63);
    doc.rect(0, 0, W, 38, 'F');

    /* Logo / Nom ville */
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MADINA', margin, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Municipalité de Madina — Système de Gestion Urbaine', margin, 25);

    /* Numéro de contrat */
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`N° ${c.numeroContrat}`, W - margin, 18, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Émis le : ${new Date(c.dateCreation).toLocaleDateString('fr-FR')}`, W - margin, 24, { align: 'right' });
    doc.text(`Tentative : ${c.tentative}`, W - margin, 29, { align: 'right' });

    y = 46;

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
      `La Municipalité de Madina, agissant dans le cadre de sa mission de service public, ` +
      `confie par le présent contrat la réalisation des travaux décrits ci-dessous à l'équipe désignée.`;
    const lines = doc.splitTextToSize(preambule, W - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 6;

    /* ─── Section : Équipe assignée ─── */
    y = this.pdfSection(doc, '1. ÉQUIPE ASSIGNÉE', y, margin, W);
    y = this.pdfRow(doc, 'Équipe',       c.equipeLabel,                             y, margin);
    y = this.pdfRow(doc, 'Code équipe',  c.equipeCode.toUpperCase(),                y, margin);
    y = this.pdfRow(doc, 'Chef assigné', c.chefEquipeId ?? 'En attente d\'attribution', y, margin);
    y += 4;

    /* ─── Section : Signalement ─── */
    const sig = c.signalement;
    y = this.pdfSection(doc, '2. DÉTAILS DU SIGNALEMENT', y, margin, W);
    y = this.pdfRow(doc, 'Référence',    sig ? `#${sig.id}` : '—',            y, margin);
    y = this.pdfRow(doc, 'Type',         this.typeLabel(sig?.type ?? ''),      y, margin);
    y = this.pdfRow(doc, 'Adresse',      sig?.adresse ?? '—',                  y, margin);
    y = this.pdfRow(doc, 'Priorité',     sig?.prioriteCitoyen ?? '—',          y, margin);
    y = this.pdfRow(doc, 'Délai estimé', c.delaiEstimeHeures
                                          ? `${c.delaiEstimeHeures}h` : '—',   y, margin);
    const confPct = sig?.confidenceIA != null
      ? `${Math.round(sig.confidenceIA * 100)}%` : '—';
    y = this.pdfRow(doc, 'Confiance IA', confPct,                              y, margin);

    /* Description */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(12, 31, 63);
    doc.text('Description :', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const desc = doc.splitTextToSize(sig?.description ?? '—', W - margin * 2);
    doc.text(desc, margin, y);
    y += desc.length * 4.5 + 6;

    /* ─── Section : Obligations ─── */
    y = this.pdfSection(doc, '3. OBLIGATIONS DE L\'ÉQUIPE', y, margin, W);
    const obligations = [
      `• Prendre en charge l'intervention dans un délai de ${c.delaiEstimeHeures ?? c.signalement?.delaiEstimeHeures ?? '48'}h à compter de l'acceptation.`,
      '• Signaler tout obstacle imprévu à la direction technique dans les 24h.',
      '• Fournir un rapport d\'intervention à la clôture du chantier.',
      '• Respecter les normes de sécurité et les réglementations en vigueur.',
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
    if (y > 230) { doc.addPage(); y = 20; }
    y = this.pdfSection(doc, '4. SIGNATURES', y, margin, W);

    const colL = margin, colR = W / 2 + 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 31, 63);
    doc.text('Pour la Municipalité de Madina', colL, y);
    doc.text('Pour le Chef d\'Équipe', colR, y);
    y += 5;

    /* Cadres signature */
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(colL, y, 78, 30);
    doc.rect(colR, y, 78, 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text('Signature + Cachet', colL + 4, y + 6);
    doc.text('Signature numérique', colR + 4, y + 6);

    /* ─── Cachet numérique Madina ─── */
    this.drawCachet(doc, colL + 18, y + 17);

    y += 38;

    /* Ligne de date */
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Date : ______________________`, colL, y);
    doc.text(`Date : ______________________`, colR, y);
    y += 10;

    /* ─── Pied de page ─── */
    const pageH = 297;
    doc.setDrawColor(232, 83, 42);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 15, W - margin, pageH - 15);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('Madina — Plateforme CityVoice © 2025 — Document généré automatiquement par intelligence artificielle',
      W / 2, pageH - 10, { align: 'center' });
    doc.text(`Contrat N° ${c.numeroContrat}`, margin, pageH - 10);
    doc.text(`Page 1/1`, W - margin, pageH - 10, { align: 'right' });
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

  /** Dessine le cachet numérique Madina dans le PDF */
  private drawCachet(doc: any, cx: number, cy: number): void {
    const r = 12;
    // Cercle extérieur
    doc.setDrawColor(12, 31, 63);
    doc.setLineWidth(1);
    doc.circle(cx, cy, r, 'S');
    // Cercle intérieur
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, r - 2.5, 'S');

    // Texte circulaire simulé (haut et bas)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.5);
    doc.setTextColor(12, 31, 63);
    doc.text('• MUNICIPALITÉ DE MADINA •', cx, cy - r + 1.8, { align: 'center' });
    doc.text('• TUNISIE • CITYVOICE •', cx, cy + r - 0.8, { align: 'center' });

    // Texte central
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('MADINA', cx, cy - 1.5, { align: 'center' });
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIEL', cx, cy + 2.5, { align: 'center' });

    // Étoile centrale décorative
    doc.setFontSize(8);
    doc.setTextColor(232, 83, 42);
    doc.text('★', cx, cy + 0.5, { align: 'center' });
    doc.setTextColor(12, 31, 63);
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
