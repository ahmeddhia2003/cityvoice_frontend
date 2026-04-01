import { Component, OnInit, OnDestroy, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { SignalementService, SignalementResponse } from '../../../core/services/signalement.service';
import { AuthService } from '../../../core/services/auth.service';
import { SoundService } from '../../../core/services/sound.service';
import { ContratTravailService, ContratTravailResponse } from '../../../core/services/contrat-travail.service';

declare const gsap: any;
declare const L: any;

type SortField = 'id' | 'type' | 'statut' | 'priorite' | 'dateSignalement' | 'votes';
type SortDir   = 'asc' | 'desc';
type ChartPeriod = '7d' | '30d';
type ViewMode    = 'table' | 'map';

@Component({
  selector: 'app-admin-signalements',
  templateUrl: './admin-signalements.component.html',
  styleUrls: ['./admin-signalements.component.css'],
})
export class AdminSignalementsComponent implements OnInit, OnDestroy, AfterViewChecked {

  signalements: SignalementResponse[] = [];
  filtered:     SignalementResponse[] = [];
  paginated:    SignalementResponse[] = [];
  loading  = true;
  error: string | null = null;

  /* ── Filtres de base ──────────────────────────────── */
  search         = '';
  filterStatut   = 'TOUS';
  filterPriorite = 'TOUS';

  readonly statutOptions   = ['TOUS', 'EN_ATTENTE', 'EN_COURS', 'RESOLU', 'REJETE'];
  readonly prioriteOptions = ['TOUS', 'URGENTE', 'HAUTE', 'MOYENNE', 'FAIBLE'];

  /* ── Filtres avancés ──────────────────────────────── */
  filterDateFrom = '';
  filterDateTo   = '';
  filterEquipe   = 'TOUS';

  /* ── Vue ──────────────────────────────────────────── */
  viewMode: ViewMode = 'table';
  private mapNeedsInit = false;

  /* ── Graphique évolution ──────────────────────────── */
  chartPeriod: ChartPeriod = '7d';

  /* ── Tri ──────────────────────────────────────────── */
  sortField: SortField = 'dateSignalement';
  sortDir:   SortDir   = 'desc';

  /* ── Pagination ───────────────────────────────────── */
  pageSize    = 12;
  currentPage = 1;
  readonly pageSizes = [8, 12, 20, 50];

  /* ── Drawer détail ────────────────────────────────── */
  detailItem: SignalementResponse | null = null;

  /* ── Contrats (cache par signalement ID) ─────────── */
  contratMap: Record<number, ContratTravailResponse> = {};

  /* ── Statut change ────────────────────────────────── */
  editingStatut: SignalementResponse | null = null;
  statutComment = '';
  statutPending = false;
  nouveauStatutChoix = '';

  /* ── Suppression ──────────────────────────────────── */
  deleteTarget:  SignalementResponse | null = null;
  deleteLoading  = false;

  /* ── Sélection multiple ───────────────────────────── */
  selectedIds    = new Set<number>();
  bulkDeleteMode = false;
  bulkLoading    = false;

  /* ── Lightbox image ───────────────────────────────── */
  lightboxUrl: string | null = null;
  lightboxIndex = 0;

  /* ── Toast ────────────────────────────────────────── */
  toast: { msg: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any;

  /* ── Leaflet map ──────────────────────────────────── */
  private leafletMap:     any = null;
  private mapMarkers:     any[] = [];
  private markerCluster:  any = null;

  constructor(
    private sigService:    SignalementService,
    private authService:   AuthService,
    public  sound:         SoundService,
    private contratService: ContratTravailService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void {
    this.destroyMap();
    clearTimeout(this.toastTimer);
  }

  ngAfterViewChecked(): void {
    if (this.mapNeedsInit && this.viewMode === 'map') {
      const el = document.getElementById('sig-map');
      if (el) {
        this.mapNeedsInit = false;
        setTimeout(() => this.initMap(), 60);
      }
    }
  }

  /* ══════════════════════════════════════════════════
     CHARGEMENT
  ══════════════════════════════════════════════════ */
  load(): void {
    this.loading = true;
    this.error   = null;
    this.sigService.getAll().subscribe({
      next: (data) => {
        this.signalements = data;
        this.loading      = false;
        this.applyAll();
        setTimeout(() => this.animateRows(), 80);
        if (this.viewMode === 'map') {
          setTimeout(() => this.updateMapMarkers(), 200);
        }
      },
      error: () => {
        this.loading = false;
        this.error   = 'Impossible de charger les signalements.';
      },
    });
  }

  /* ══════════════════════════════════════════════════
     PIPELINE FILTRE → TRI → PAGINATION
  ══════════════════════════════════════════════════ */
  applyAll(): void {
    let res = [...this.signalements];

    // Filtre statut
    if (this.filterStatut !== 'TOUS') {
      res = res.filter(s => s.statut === this.filterStatut);
    }
    // Filtre priorité
    if (this.filterPriorite !== 'TOUS') {
      res = res.filter(s => s.prioriteCitoyen === this.filterPriorite);
    }
    // Filtre équipe IA
    if (this.filterEquipe !== 'TOUS') {
      res = res.filter(s =>
        this.filterEquipe === 'AUCUNE'
          ? !s.equipeIALabel
          : s.equipeIALabel === this.filterEquipe
      );
    }
    // Filtre date de début
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom).getTime();
      res = res.filter(s => s.dateSignalement && new Date(s.dateSignalement).getTime() >= from);
    }
    // Filtre date de fin
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo + 'T23:59:59').getTime();
      res = res.filter(s => s.dateSignalement && new Date(s.dateSignalement).getTime() <= to);
    }
    // Recherche texte
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      res = res.filter(s =>
        (s.type        ?? '').toLowerCase().includes(q) ||
        (s.adresse     ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    }

    // Tri
    res.sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortField) {
        case 'id':              va = a.id;              vb = b.id;              break;
        case 'type':            va = a.type;            vb = b.type;            break;
        case 'statut':          va = a.statut;          vb = b.statut;          break;
        case 'priorite':        va = this.prioOrder(a); vb = this.prioOrder(b); break;
        case 'votes':           va = a.votes;           vb = b.votes;           break;
        case 'dateSignalement':
        default:
          va = new Date(a.dateSignalement).getTime();
          vb = new Date(b.dateSignalement).getTime();
      }
      if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
      if (va > vb) return this.sortDir === 'asc' ?  1 : -1;
      return 0;
    });

    this.filtered = res;
    this.currentPage = 1;
    this.buildPage();
  }

  private prioOrder(s: SignalementResponse): number {
    const map: Record<string, number> = { URGENTE: 0, HAUTE: 1, MOYENNE: 2, FAIBLE: 3 };
    return map[s.prioriteCitoyen] ?? 99;
  }

  buildPage(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginated = this.filtered.slice(start, start + this.pageSize);
    setTimeout(() => this.animateRows(), 40);
  }

  /* ══════════════════════════════════════════════════
     TRI COLONNES
  ══════════════════════════════════════════════════ */
  sortBy(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir   = field === 'dateSignalement' ? 'desc' : 'asc';
    }
    this.applyAll();
  }

  /* ══════════════════════════════════════════════════
     PAGINATION
  ══════════════════════════════════════════════════ */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)   return [1, 2, 3, 4, 5, -1, total];
    if (cur >= total - 3) return [1, -1, total-4, total-3, total-2, total-1, total];
    return [1, -1, cur - 1, cur, cur + 1, -1, total];
  }

  goPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.currentPage) return;
    this.currentPage = p;
    this.buildPage();
  }
  prevPage(): void { this.goPage(this.currentPage - 1); }
  nextPage(): void { this.goPage(this.currentPage + 1); }

  onPageSize(n: number): void {
    this.pageSize    = n;
    this.currentPage = 1;
    this.buildPage();
  }

  /* ══════════════════════════════════════════════════
     FILTRES
  ══════════════════════════════════════════════════ */
  onSearch():              void { this.applyAll(); }
  setStatut(v: string):    void { this.filterStatut   = v; this.applyAll(); }
  setPriorite(v: string):  void { this.filterPriorite = v; this.applyAll(); }
  setEquipe(v: string):    void { this.filterEquipe   = v; this.applyAll(); }
  onDateFilter():          void { this.applyAll(); }
  clearDateFilter():       void { this.filterDateFrom = ''; this.filterDateTo = ''; this.applyAll(); }
  setChartPeriod(p: ChartPeriod): void { this.chartPeriod = p; }

  get hasActiveAdvancedFilters(): boolean {
    return !!this.filterDateFrom || !!this.filterDateTo || this.filterEquipe !== 'TOUS';
  }
  resetAllFilters(): void {
    this.search = ''; this.filterStatut = 'TOUS'; this.filterPriorite = 'TOUS';
    this.filterEquipe = 'TOUS'; this.filterDateFrom = ''; this.filterDateTo = '';
    this.applyAll();
  }

  /* ══════════════════════════════════════════════════
     VUE TABLE / CARTE
  ══════════════════════════════════════════════════ */
  setView(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    if (mode === 'map') {
      this.mapNeedsInit = true;
      this.cdr.detectChanges();
    } else {
      this.destroyMap();
      setTimeout(() => this.animateRows(), 60);
    }
  }

  /* ══════════════════════════════════════════════════
     CARTE LEAFLET
  ══════════════════════════════════════════════════ */
  private initMap(): void {
    if (typeof L === 'undefined') return;
    const el = document.getElementById('sig-map');
    if (!el) return;

    this.destroyMap();
    this.leafletMap = L.map('sig-map', {
      center: [36.8, 10.18],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.leafletMap);

    this.updateMapMarkers();
  }

  private destroyMap(): void {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
      this.mapMarkers = [];
    }
  }

  updateMapMarkers(): void {
    if (!this.leafletMap) return;
    // Supprimer anciens marqueurs
    this.mapMarkers.forEach(m => this.leafletMap.removeLayer(m));
    this.mapMarkers = [];

    this.filtered.forEach(s => {
      if (!s.latitude || !s.longitude) return;

      const color   = this.statutMapColor(s.statut);
      const icon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:14px;height:14px;">
      <div style="
        position:absolute;inset:-5px;border-radius:50%;
        border:2px solid ${color};
        animation:pin-pulse 2s ease-out infinite;
        opacity:.5">
      </div>
      <div style="
        width:14px;height:14px;border-radius:50%;
        background:${color};border:2.5px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35);">
      </div>
    </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

      const marker = L.marker([s.latitude, s.longitude], { icon })
        .addTo(this.leafletMap)
        .bindPopup(`
          <div style="min-width:180px;font-family:-apple-system,sans-serif">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">
              #${s.id} — ${this.typeLabel(s.type)}
            </div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:6px">
              ${s.adresse || 'Coordonnées : ' + s.latitude.toFixed(4) + ', ' + s.longitude.toFixed(4)}
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="background:${color}22;color:${color};border:1px solid ${color}44;
                border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600">
                ${this.statutLabel(s.statut)}
              </span>
              <span style="font-size:11px;color:#374151">
                ${this.prioriteLabel(s.prioriteCitoyen)}
              </span>
            </div>
            ${s.equipeIALabel ? `<div style="font-size:11px;color:#7c3aed;margin-top:4px">⚡ ${s.equipeIALabel}</div>` : ''}
          </div>
        `);

      marker.on('click', () => {
        this.openDetail(s);
        this.cdr.detectChanges();
      });

      this.mapMarkers.push(marker);
    });

    // Auto-fit bounds si marqueurs présents
    if (this.mapMarkers.length > 0) {
      try {
        const group = L.featureGroup(this.mapMarkers);
        this.leafletMap.fitBounds(group.getBounds().pad(0.15));
      } catch {}
    }
  }

  private statutMapColor(statut: string): string {
    const m: Record<string, string> = {
      EN_ATTENTE: '#E8532A',
      EN_COURS:   '#3B82F6',
      RESOLU:     '#0D9B76',
      REJETE:     '#9CA3AF',
    };
    return m[statut] ?? '#6B7280';
  }

  /* ══════════════════════════════════════════════════
     DRAWER DÉTAIL
  ══════════════════════════════════════════════════ */
  openDetail(s: SignalementResponse): void {
    this.detailItem = s;
    setTimeout(() => {
      const el = document.getElementById('detail-drawer');
      if (el && typeof gsap !== 'undefined') {
        gsap.fromTo(el, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: 'power3.out' });
      }
    }, 10);
    if (s.id !== undefined) {
      this.contratService.getContratActifParSignalement(s.id).subscribe({
        next:  c  => { if (c) this.contratMap[s.id!] = c; },
        error: (err) => { console.warn('[Contrat] Aucun contrat trouvé pour signalement', s.id, err?.status); },
      });
    }
  }
  closeDetail(): void { this.detailItem = null; }

  /* ══════════════════════════════════════════════════
     CHANGEMENT STATUT
  ══════════════════════════════════════════════════ */
  openEditStatut(s: SignalementResponse, event: Event): void {
    event.stopPropagation();
    this.sound.nav();
    this.editingStatut     = s;
    this.nouveauStatutChoix = s.statut;
    this.statutComment     = '';
    setTimeout(() => {
      const modal = document.getElementById('statut-modal');
      if (modal && typeof gsap !== 'undefined') {
        gsap.fromTo(modal,
          { opacity: 0, scale: 0.94, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
        );
      }
    }, 10);
  }
  closeEditStatut(): void { this.editingStatut = null; this.statutComment = ''; }

  confirmStatut(): void {
    if (!this.editingStatut || this.statutPending) return;
    this.statutPending = true;
    const userId = this.authService.getCurrentUser()?.userId ?? '0';
    this.sigService.changerStatut(
      this.editingStatut.id, this.nouveauStatutChoix, this.statutComment, userId
    ).subscribe({
      next: (updated) => {
        const idx = this.signalements.findIndex(s => s.id === updated.id);
        if (idx !== -1) this.signalements[idx] = updated;
        if (this.detailItem?.id === updated.id) this.detailItem = updated;
        this.applyAll();
        if (this.viewMode === 'map') this.updateMapMarkers();
        this.statutPending = false;
        this.editingStatut = null;
        this.showToast('Statut mis à jour avec succès', 'success');
      },
      error: () => {
        this.statutPending = false;
        this.showToast('Erreur lors de la mise à jour', 'error');
      },
    });
  }

  /* ══════════════════════════════════════════════════
     SUPPRESSION
  ══════════════════════════════════════════════════ */
  openDelete(s: SignalementResponse, event: Event): void {
    event.stopPropagation();
    this.sound.nav();
    this.deleteTarget = s;
    setTimeout(() => {
      const modal = document.getElementById('delete-modal');
      if (modal && typeof gsap !== 'undefined') {
        gsap.fromTo(modal,
          { opacity: 0, scale: 0.94, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(1.5)' }
        );
      }
    }, 10);
  }
  closeDelete(): void { this.deleteTarget = null; this.deleteLoading = false; }

  confirmDelete(): void {
    if (!this.deleteTarget || this.deleteLoading) return;
    this.deleteLoading = true;
    const userId = this.authService.getCurrentUser()?.userId ?? '0';
    this.sigService.delete(this.deleteTarget.id, userId).subscribe({
      next: () => {
        this.signalements  = this.signalements.filter(s => s.id !== this.deleteTarget!.id);
        if (this.detailItem?.id === this.deleteTarget!.id) this.detailItem = null;
        this.applyAll();
        if (this.viewMode === 'map') this.updateMapMarkers();
        this.deleteLoading = false;
        this.deleteTarget  = null;
        this.showToast('Signalement supprimé', 'success');
      },
      error: () => {
        this.deleteLoading = false;
        this.showToast('Erreur lors de la suppression', 'error');
      },
    });
  }

  /* ══════════════════════════════════════════════════
     SÉLECTION MULTIPLE
  ══════════════════════════════════════════════════ */
  toggleSelect(id: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }
  toggleSelectAll(): void {
    if (this.selectedIds.size === this.paginated.length) {
      this.selectedIds.clear();
    } else {
      this.paginated.forEach(s => this.selectedIds.add(s.id));
    }
  }
  get allPageSelected(): boolean {
    return this.paginated.length > 0 && this.paginated.every(s => this.selectedIds.has(s.id));
  }
  clearSelection(): void { this.selectedIds.clear(); this.bulkDeleteMode = false; }

  openBulkDelete(): void { this.bulkDeleteMode = true; }
  closeBulkDelete(): void { this.bulkDeleteMode = false; }

  confirmBulkDelete(): void {
    if (this.bulkLoading || this.selectedIds.size === 0) return;
    this.bulkLoading = true;
    const userId = this.authService.getCurrentUser()?.userId ?? '0';
    const ids = [...this.selectedIds];
    let done = 0;
    ids.forEach(id => {
      this.sigService.delete(id, userId).subscribe({
        next: () => {
          done++;
          if (done === ids.length) {
            this.signalements = this.signalements.filter(s => !ids.includes(s.id));
            this.applyAll();
            if (this.viewMode === 'map') this.updateMapMarkers();
            this.selectedIds.clear();
            this.bulkLoading    = false;
            this.bulkDeleteMode = false;
            this.showToast(`${ids.length} signalement(s) supprimé(s)`, 'success');
          }
        },
        error: () => { done++; if (done === ids.length) { this.bulkLoading = false; } },
      });
    });
  }

  /* ══════════════════════════════════════════════════
     EXPORT CSV
  ══════════════════════════════════════════════════ */
  exportCsv(): void {
    const header = ['ID','Type','Description','Adresse','Latitude','Longitude',
                    'Priorité Citoyen','Priorité IA','Statut','Équipe IA',
                    'Délai (h)','Confiance IA (%)','Votes','Date'];
    const rows = this.filtered.map(s => [
      s.id,
      this.typeLabel(s.type),
      `"${(s.description ?? '').replace(/"/g, '""')}"`,
      `"${(s.adresse ?? '').replace(/"/g, '""')}"`,
      s.latitude, s.longitude,
      this.prioriteLabel(s.prioriteCitoyen),
      s.prioriteIA ? this.prioriteLabel(s.prioriteIA) : '',
      this.statutLabel(s.statut),
      s.equipeIALabel ?? '',
      s.delaiEstimeHeures ?? '',
      s.confidenceIA != null ? Math.round(s.confidenceIA * 100) : '',
      s.votes,
      this.formatDate(s.dateSignalement),
    ]);
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `signalements_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(`${this.filtered.length} lignes exportées`, 'success');
  }

  /* ══════════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════════ */
  showToast(msg: string, type: 'success' | 'error'): void {
    clearTimeout(this.toastTimer);
    this.toast = { msg, type };
    this.toastTimer = setTimeout(() => { this.toast = null; }, 3500);
  }

  /* ══════════════════════════════════════════════════
     LIGHTBOX
  ══════════════════════════════════════════════════ */
  openLightbox(urls: string[], index: number): void {
    this.lightboxUrl   = urls[index];
    this.lightboxIndex = index;
  }
  closeLightbox(): void { this.lightboxUrl = null; }
  lightboxPrev(urls: string[]): void {
    this.lightboxIndex = (this.lightboxIndex - 1 + urls.length) % urls.length;
    this.lightboxUrl   = urls[this.lightboxIndex];
  }
  lightboxNext(urls: string[]): void {
    this.lightboxIndex = (this.lightboxIndex + 1) % urls.length;
    this.lightboxUrl   = urls[this.lightboxIndex];
  }

  /* ══════════════════════════════════════════════════
     ANIMATION
  ══════════════════════════════════════════════════ */
  private animateRows(): void {
    if (typeof gsap === 'undefined') return;
    const rows = document.querySelectorAll<HTMLElement>('.sig-row');
    if (!rows.length) return;
    gsap.fromTo(rows,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.32, stagger: 0.03, ease: 'power3.out', clearProps: 'transform' }
    );
  }

  /* ══════════════════════════════════════════════════
     KPIs AVANCÉS
  ══════════════════════════════════════════════════ */
  get resolutionRate(): number {
    if (!this.signalements.length) return 0;
    return Math.round((this.resoluCount / this.signalements.length) * 100);
  }

  get urgentPendingCount(): number {
    return this.signalements.filter(s =>
      s.prioriteCitoyen === 'URGENTE' && s.statut === 'EN_ATTENTE'
    ).length;
  }

  get totalVotes(): number {
    return this.signalements.reduce((acc, s) => acc + (s.votes || 0), 0);
  }

  get avgConfidenceIA(): number {
    const withConf = this.signalements.filter(s => s.confidenceIA != null && s.confidenceIA > 0);
    if (!withConf.length) return 0;
    const sum = withConf.reduce((acc, s) => acc + (s.confidenceIA ?? 0), 0);
    return Math.round((sum / withConf.length) * 100);
  }

  /* ══════════════════════════════════════════════════
     GRAPHIQUE ÉVOLUTION (SVG pur)
  ══════════════════════════════════════════════════ */
  get evolutionBars(): Array<{ label: string; count: number; height: number; dateStr: string }> {
    const days = this.chartPeriod === '7d' ? 7 : 30;
    const now  = new Date();
    const bars: Array<{ label: string; count: number; height: number; dateStr: string }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = this.signalements.filter(s =>
        s.dateSignalement && s.dateSignalement.slice(0, 10) === dateStr
      ).length;
      const label = this.chartPeriod === '7d'
        ? d.toLocaleDateString('fr-FR', { weekday: 'short' })
        : d.getDate().toString();
      bars.push({ label, count, height: 0, dateStr });
    }

    const max = Math.max(...bars.map(b => b.count), 1);
    bars.forEach(b => { b.height = Math.round((b.count / max) * 100); });
    return bars;
  }

  get evolutionMax(): number {
    return Math.max(...this.evolutionBars.map(b => b.count), 1);
  }

  get evolutionPeriodTotal(): number {
    return this.evolutionBars.reduce((acc, b) => acc + b.count, 0);
  }

  /* ══════════════════════════════════════════════════
     FILTRE ÉQUIPES DYNAMIQUE
  ══════════════════════════════════════════════════ */
  get equipeOptions(): string[] {
    const set = new Set<string>();
    this.signalements.forEach(s => { if (s.equipeIALabel) set.add(s.equipeIALabel); });
    return ['TOUS', 'AUCUNE', ...Array.from(set).sort()];
  }

  /* ══════════════════════════════════════════════════
     LABELS / HELPERS
  ══════════════════════════════════════════════════ */
  typeLabel(t: string): string {
    const m: Record<string,string> = {
      TROU_CHAUSSEE:           'Trou chaussée',
      LAMPADAIRE_CASSE:        'Lampadaire cassé',
      POTEAU_ENDOMMAGE:        'Poteau endommagé',
      FUITE_EAU:               'Fuite d\'eau',
      DECHETS_NON_COLLECTES:   'Déchets non collectés',
      SIGNALISATION_MANQUANTE: 'Signalisation manquante',
      CANIVEAU_BOUCHE:         'Caniveau bouché',
      ESPACE_VERT_DEGRADE:     'Espace vert dégradé',
    };
    return m[t] ?? t;
  }

  typeColor(t: string): string {
    const m: Record<string,string> = {
      TROU_CHAUSSEE:           '#78716C',
      LAMPADAIRE_CASSE:        '#D97706',
      POTEAU_ENDOMMAGE:        '#DC2626',
      FUITE_EAU:               '#2563EB',
      DECHETS_NON_COLLECTES:   '#16A34A',
      SIGNALISATION_MANQUANTE: '#7C3AED',
      CANIVEAU_BOUCHE:         '#0891B2',
      ESPACE_VERT_DEGRADE:     '#15803D',
    };
    return m[t] ?? '#6B7280';
  }

  typeIcon(t: string): string {
    const m: Record<string,string> = {
      TROU_CHAUSSEE:           'M',
      LAMPADAIRE_CASSE:        'L',
      POTEAU_ENDOMMAGE:        'P',
      FUITE_EAU:               'F',
      DECHETS_NON_COLLECTES:   'D',
      SIGNALISATION_MANQUANTE: 'S',
      CANIVEAU_BOUCHE:         'C',
      ESPACE_VERT_DEGRADE:     'E',
    };
    return m[t] ?? '?';
  }

  statutLabel(s: string): string {
    const m: Record<string,string> = {
      EN_ATTENTE: 'En attente', EN_COURS: 'En cours',
      RESOLU: 'Résolu', REJETE: 'Rejeté',
    };
    return m[s] ?? s;
  }

  prioriteLabel(p: string): string {
    const m: Record<string,string> = {
      URGENTE: 'Urgente', HAUTE: 'Haute', MOYENNE: 'Moyenne', FAIBLE: 'Faible',
    };
    return m[p] ?? p;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  formatDateShort(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  countByStatut(statut: string): number {
    return this.signalements.filter(s => s.statut === statut).length;
  }

  get totalCount():     number { return this.signalements.length; }
  get enAttenteCount(): number { return this.countByStatut('EN_ATTENTE'); }
  get enCoursCount():   number { return this.countByStatut('EN_COURS'); }
  get resoluCount():    number { return this.countByStatut('RESOLU'); }
  get rejeteCount():    number { return this.countByStatut('REJETE'); }

  get startIndex(): number { return (this.currentPage - 1) * this.pageSize + 1; }
  get endIndex():   number { return Math.min(this.currentPage * this.pageSize, this.filtered.length); }

  get statutStats(): Array<{ label: string; color: string; count: number; pct: number }> {
    const total = this.totalCount || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    return [
      { label: 'En attente', color: '#E8532A', count: this.enAttenteCount, pct: pct(this.enAttenteCount) },
      { label: 'En cours',   color: '#3B82F6', count: this.enCoursCount,   pct: pct(this.enCoursCount)   },
      { label: 'Résolus',    color: '#0D9B76', count: this.resoluCount,    pct: pct(this.resoluCount)    },
      { label: 'Rejetés',    color: '#9CA3AF', count: this.rejeteCount,    pct: pct(this.rejeteCount)    },
    ];
  }

  get typeStats(): Array<{ label: string; color: string; count: number; pct: number }> {
    const palette = ['#E8532A', '#C9973E', '#3B82F6', '#7C3AED', '#0D9B76'];
    const counts: Record<string, number> = {};
    this.signalements.forEach(s => { counts[s.type] = (counts[s.type] ?? 0) + 1; });
    const total = this.signalements.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([type, count], i) => ({
        label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        color: palette[i % palette.length],
        count: count as number,
        pct:   Math.round(((count as number) / total) * 100),
      }));
  }

  trackById(_: number, s: any): any { return s.id; }
}
