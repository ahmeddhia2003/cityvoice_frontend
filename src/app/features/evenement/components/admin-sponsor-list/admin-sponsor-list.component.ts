import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvenementService } from '../../services/evenement.service';
import { Sponsor } from '../../models/sponsor.model';
import { Evenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { LangService } from '../../../../core/services/lang.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-admin-sponsor-list',
  templateUrl: './admin-sponsor-list.component.html',
  styleUrls: ['./admin-sponsor-list.component.css']
})
export class AdminSponsorListComponent implements OnInit {

  sponsors: Sponsor[] = [];
  sponsorsFiltres: Sponsor[] = [];
  sponsorsPagines: Sponsor[] = [];
  evenements: Evenement[] = [];
  loading = false;
  erreur = '';
  succes = '';

  // Vue grille ou liste
  vue: 'grille' | 'liste' = 'grille';

  // Recherche + tri + filtre
  recherche = '';
  filtreNiveau = '';
  triPar: 'nom' | 'evenements' | 'niveau' = 'nom';
  triDesc = false;

  // Pagination
  page = 1;
  pageSize = 6;
  totalPages = 1;

  // Modal création/édition
  modalOuvert = false;
  modeEdition = false;
  sponsorEnEdition: Sponsor | null = null;
  sponsorForm: FormGroup;
  formLoading = false;

  // Modal association
  associationModal: Sponsor | null = null;
  associationForm: FormGroup;
  associationLoading = false;

  niveaux = ['BRONZE', 'ARGENT', 'OR', 'PLATINE'];

  constructor(
    private evenementService: EvenementService,
    private fb: FormBuilder,
    public sound: SoundService,
    public lang: LangService,
    public i18n: I18nService
  ) {
    this.sponsorForm = this.fb.group({
      nomEntreprise: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      logoUrl:       ['', [Validators.pattern('https?://.+')]],
      siteWeb:       ['', [Validators.pattern('https?://.+')]],
      secteurActivite:  ['', Validators.required],
      tailleEntreprise: ['', Validators.required],
      zoneGeographique: ['', Validators.required],
      actifSponsoring:  [true]
    });

    this.associationForm = this.fb.group({
      evenementId:      ['', Validators.required],
      niveauSponsorat:  ['OR', Validators.required],
      montantSponsorat: [null, [Validators.required, Validators.min(100)]],
    });
  }

  ngOnInit(): void {
    this.charger();
    this.chargerEvenements();
  }

  charger(): void {
    this.loading = true;
    this.evenementService.getTousSponsors().subscribe({
      next: (data) => {
        this.sponsors = data;
        this.appliquerFiltres();
        this.loading = false;
      },
      error: () => { this.erreur = this.i18n.t('adm.sp.err.load'); this.loading = false; }
    });
  }

  chargerEvenements(): void {
    this.evenementService.getTousEvenements().subscribe({
      next: (data) => this.evenements = data,
      error: () => {}
    });
  }

  appliquerFiltres(): void {
    let result = [...this.sponsors];

    // Recherche
    if (this.recherche.trim()) {
      const q = this.recherche.trim().toLowerCase();
      result = result.filter(s =>
        s.nomEntreprise.toLowerCase().includes(q) ||
        s.siteWeb?.toLowerCase().includes(q)
      );
    }

    // Filtre niveau
    if (this.filtreNiveau) {
      result = result.filter(s => s.niveauSponsorat === this.filtreNiveau);
    }

    // Tri
    result.sort((a, b) => {
      let compare = 0;
      if (this.triPar === 'nom') {
        compare = a.nomEntreprise.localeCompare(b.nomEntreprise);
      } else if (this.triPar === 'evenements') {
        compare = (a.evenementIds?.length || 0) - (b.evenementIds?.length || 0);
      } else if (this.triPar === 'niveau') {
        const ordre = ['BRONZE', 'ARGENT', 'OR', 'PLATINE'];
        compare = ordre.indexOf(a.niveauSponsorat || '') - ordre.indexOf(b.niveauSponsorat || '');
      }
      return this.triDesc ? -compare : compare;
    });

    this.sponsorsFiltres = result;
    this.totalPages = Math.ceil(result.length / this.pageSize) || 1;
    if (this.page > this.totalPages) this.page = 1;
    this.paginer();
  }

  paginer(): void {
    const start = (this.page - 1) * this.pageSize;
    this.sponsorsPagines = this.sponsorsFiltres.slice(start, start + this.pageSize);
  }

  changerPage(p: number): void {
    this.sound.nav();
    this.page = p;
    this.paginer();
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // ── KPIs ──────────────────────────────────────────────
  get totalSponsors(): number { return this.sponsors.length; }

  get totalMontant(): number {
    return this.sponsors.reduce((s, sp) => s + (sp.montantSponsorat || 0), 0);
  }

  get sponsorsActifs(): number {
    return this.sponsors.filter(s => s.evenementIds && s.evenementIds.length > 0).length;
  }

  get sponsorsPremium(): number {
    return this.sponsors.filter(s =>
      s.niveauSponsorat === 'OR' || s.niveauSponsorat === 'PLATINE'
    ).length;
  }

  // ── Export CSV ────────────────────────────────────────
  exportCSV(): void {
    this.sound.click();
    const headers = ['ID', 'Nom entreprise', 'Site web', 'Niveau', 'Montant (TND)', 'Nb événements'];
    const rows = this.sponsors.map(s => [
      s.id,
      `"${s.nomEntreprise}"`,
      s.siteWeb || '',
      s.niveauSponsorat || '',
      s.montantSponsorat || 0,
      s.evenementIds?.length || 0
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sponsors_${new Date().toLocaleDateString('fr-FR')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export PDF ────────────────────────────────────────
  exportPDF(): void {
    this.sound.click();
    const win = window.open('', '_blank')!;
    win.document.write(`
      <html><head><title>Sponsors — CityVoice</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Georgia, serif; padding: 40px; background: #fff; color: #0C1F3F; }
        .header { display:flex; justify-content:space-between; align-items:center;
          margin-bottom:32px; padding-bottom:20px;
          border-bottom: 3px solid #C9973E; }
        .logo { font-size:28px; font-weight:900; letter-spacing:-.02em; }
        .logo span { color:#C9973E; }
        .meta { font-size:12px; color:#9CA3AF; text-align:right; line-height:1.8; }
        .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:32px; }
        .kpi { padding:18px; border-radius:12px; background:#F7F4EF;
          border-top:3px solid #C9973E; text-align:center; }
        .kpi-num { font-size:28px; font-weight:900; color:#0C1F3F; }
        .kpi-label { font-size:10px; color:#9CA3AF; text-transform:uppercase;
          letter-spacing:.08em; margin-top:4px; }
        .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        .card { padding:20px; border-radius:12px; border:1px solid #E5E7EB;
          text-align:center; }
        .card-logo { width:60px; height:60px; border-radius:8px;
          background:#0C1F3F; color:#fff; font-size:24px; font-weight:900;
          display:flex; align-items:center; justify-content:center;
          margin:0 auto 12px; }
        .card-nom { font-size:14px; font-weight:700; margin-bottom:6px; }
        .card-site { font-size:11px; color:#3B82F6; margin-bottom:10px; }
        .badge { display:inline-block; padding:3px 10px; border-radius:20px;
          font-size:10px; font-weight:700; margin-bottom:8px; }
        .PLATINE { background:#ede9fe; color:#6366F1; }
        .OR      { background:#fef3c7; color:#C9973E; }
        .ARGENT  { background:#f3f4f6; color:#6B7280; }
        .BRONZE  { background:#fef3c7; color:#B45309; }
        .montant { font-size:13px; font-weight:700; color:#0D9B76; }
        .ev-count { font-size:11px; color:#9CA3AF; margin-top:4px; }
      </style></head><body>
      <div class="header">
        <div class="logo">City<span>Voice</span> — Sponsors</div>
        <div class="meta">
          Exporté le ${new Date().toLocaleDateString('fr-FR')}<br>
          ${this.sponsors.length} sponsors au total<br>
          Montant total : ${this.totalMontant.toLocaleString('fr-FR')} TND
        </div>
      </div>
      <div class="kpi-row">
        <div class="kpi">
          <div class="kpi-num">${this.totalSponsors}</div>
          <div class="kpi-label">Total sponsors</div>
        </div>
        <div class="kpi">
          <div class="kpi-num">${this.sponsorsActifs}</div>
          <div class="kpi-label">Sponsors actifs</div>
        </div>
        <div class="kpi">
          <div class="kpi-num">${this.sponsorsPremium}</div>
          <div class="kpi-label">Niveau Or/Platine</div>
        </div>
        <div class="kpi">
          <div class="kpi-num">${this.totalMontant.toLocaleString('fr-FR')}</div>
          <div class="kpi-label">Montant total TND</div>
        </div>
      </div>
      <div class="grid">
        ${this.sponsors.map(s => `
          <div class="card">
            <div class="card-logo">${s.nomEntreprise.charAt(0).toUpperCase()}</div>
            <div class="card-nom">${s.nomEntreprise}</div>
            ${s.siteWeb ? `<div class="card-site">${s.siteWeb}</div>` : ''}
            ${s.niveauSponsorat ? `<div><span class="badge ${s.niveauSponsorat}">${s.niveauSponsorat}</span></div>` : ''}
            ${s.montantSponsorat ? `<div class="montant">${s.montantSponsorat.toLocaleString('fr-FR')} TND</div>` : ''}
            <div class="ev-count">📅 ${s.evenementIds?.length || 0} événement(s)</div>
          </div>
        `).join('')}
      </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  // ── Modals ────────────────────────────────────────────
  ouvrirCreation(): void {
    this.sound.nav();
    this.modeEdition = false;
    this.sponsorEnEdition = null;
    this.sponsorForm.reset();
    this.modalOuvert = true;
  }

  ouvrirEdition(s: Sponsor): void {
    this.sound.nav();
    this.modeEdition = true;
    this.sponsorEnEdition = s;
    this.sponsorForm.patchValue({
      nomEntreprise: s.nomEntreprise,
      logoUrl:       s.logoUrl || '',
      siteWeb:       s.siteWeb || '',
      secteurActivite:  s.secteurActivite  || '',
      tailleEntreprise: s.tailleEntreprise || '',
      zoneGeographique: s.zoneGeographique || '',
      actifSponsoring:  s.actifSponsoring  ?? true
    });
    this.modalOuvert = true;
  }

  fermerModal(): void {
    this.sound.nav();
    this.modalOuvert = false;
    this.sponsorForm.reset();
    this.erreur = '';
  }

  sauvegarder(): void {
    if (this.sponsorForm.invalid) {
      this.sponsorForm.markAllAsTouched();
      return;
    }
    this.sound.click();
    this.formLoading = true;
    const payload = {
    ...this.sponsorForm.value,
    secteurActivite:  this.sponsorForm.value.secteurActivite  || null,
    tailleEntreprise: this.sponsorForm.value.tailleEntreprise || null,
    zoneGeographique: this.sponsorForm.value.zoneGeographique || null,
    };
    const action = this.modeEdition && this.sponsorEnEdition?.id
      ? this.evenementService.modifierSponsor(this.sponsorEnEdition.id, payload)
      : this.evenementService.creerSponsor(payload);

    action.subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.modeEdition
        ? this.i18n.t('adm.sp.succes.modif')
        : this.i18n.t('adm.sp.succes.cree');
        this.formLoading = false;
        this.fermerModal();
        this.charger();
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => {
        this.erreur = this.i18n.t('adm.sp.err.save'); 
        this.formLoading = false;
      }
    });
  }

  supprimer(id: number): void {
    if (!confirm(this.i18n.t('adm.sp.confirm.suppr'))) return;
    this.sound.click();
    this.evenementService.supprimerSponsor(id).subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.i18n.t('adm.sp.succes.suppr');
        this.charger();
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => this.erreur = this.i18n.t('adm.sp.err.suppr')
    });
  }

  ouvrirAssociation(s: Sponsor): void {
    this.sound.nav();
    this.associationModal = s;
    this.associationForm.reset({ niveauSponsorat: 'OR' });
    this.erreur = '';
  }

  fermerAssociation(): void {
    this.sound.nav();
    this.associationModal = null;
    this.associationForm.reset();
    this.erreur = '';
  }

  associer(): void {
    if (this.associationForm.invalid) {
      this.associationForm.markAllAsTouched();
      return;
    }
    if (!this.associationModal?.id) return;
    this.sound.click();
    this.associationLoading = true;

    const { evenementId, niveauSponsorat, montantSponsorat } = this.associationForm.value;

    this.evenementService.associerSponsor(
      this.associationModal.id, evenementId, niveauSponsorat, montantSponsorat
    ).subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.i18n.t('adm.sp.succes.assoc');
        this.associationLoading = false;
        this.fermerAssociation();
        this.charger();
        setTimeout(() => this.succes = '', 3000);
      },
      error: () => {
        this.erreur = this.i18n.t('adm.sp.err.assoc');
        this.associationLoading = false;
      }
    });
  }

  getNiveauClass(niveau: string): string {
    const map: any = {
      'PLATINE': 'niveau-platine',
      'OR':      'niveau-or',
      'ARGENT':  'niveau-argent',
      'BRONZE':  'niveau-bronze',
    };
    return map[niveau] || 'niveau-bronze';
  }

  getNiveauIcon(niveau: string): string {
    const map: any = {
      'PLATINE': '💎',
      'OR':      '🥇',
      'ARGENT':  '🥈',
      'BRONZE':  '🥉',
    };
    return map[niveau] || '🥉';
  }
}