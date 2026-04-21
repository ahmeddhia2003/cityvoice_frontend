import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
} from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import {
  SignalementService,
  SignalementResponse,
} from '../../core/services/signalement.service';
import { VoteStorageService } from '../../core/services/vote-storage.service';

declare const gsap: any;
declare const L: any;

@Component({
  selector: 'app-signalement',
  templateUrl: './signalement.component.html',
  styleUrls: ['./signalement.component.css'],
})
export class SignalementComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapElRef!: ElementRef;

  private map: any;

  /* ── Données ───────────────────────────────────────── */
  signalements: SignalementResponse[] = [];
  loading      = true;
  error: string | null = null;

  /* ── Vue ───────────────────────────────────────────── */
  viewScope: 'proximite' | 'tous' = 'proximite';
  viewMode: 'list' | 'map' = 'list';
  activeFilter = 'TOUS';
  searchQuery  = '';

  /* ── Géolocalisation ───────────────────────────────── */
  userLat: number | null = null;
  userLng: number | null = null;
  geoLoading   = false;
  geoError     = false;
  proximiteKm  = 5;
  readonly kmOptions = [1, 2, 5, 10, 20];

  /* ── Vote ──────────────────────────────────────────── */
  votedIds  = new Set<number>();   // chargé depuis localStorage au démarrage
  votingIds = new Set<number>();   // en-cours seulement (mémoire)

  /* ── Weather banner ────────────────────────────────── */
  weatherBannerHeight  = 0;
  festiveBannerHeight  = 0;

  /* ── Detail popup ──────────────────────────────────── */
  selectedSig: SignalementResponse | null = null;

  openPopup(sig: SignalementResponse): void  { this.selectedSig = sig; }
  closePopup(): void                         { this.selectedSig = null; }

  /* ── Toast ─────────────────────────────────────────── */
  toast: { msg: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any;

  filters = [
    { key: 'TOUS',       label: 'Tous',       icon: '📋', count: 0 },
    { key: 'EN_ATTENTE', label: 'En attente', icon: '⏳', count: 0 },
    { key: 'EN_COURS',   label: 'En cours',   icon: '🔧', count: 0 },
    { key: 'RESOLU',     label: 'Résolus',    icon: '✅', count: 0 },
  ];

  /* ── Pagination ──────────────────────────────────── */
  currentPage = 0;                          // 0-based
  pageSize    = 12;
  readonly pageSizeOptions = [6, 12, 24, 48];

  get filtered(): SignalementResponse[] {
    return this.signalements.filter(s => {
      const matchFilter = this.activeFilter === 'TOUS' || s.statut === this.activeFilter;
      const matchSearch = !this.searchQuery ||
        (s.type        ?? '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (s.adresse     ?? '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (s.description ?? '').toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  /** Sous-ensemble de `filtered` correspondant à la page courante. */
  get paginated(): SignalementResponse[] {
    const total = this.filtered.length;
    if (total === 0) return [];
    // Si la page courante est hors bornes (ex : changement de filtre), on clamp.
    const maxPage = Math.max(0, Math.ceil(total / this.pageSize) - 1);
    if (this.currentPage > maxPage) this.currentPage = maxPage;
    const start = this.currentPage * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  /** Liste compacte des numéros de page à afficher (avec ellipses éventuelles). */
  get pageNumbers(): (number | '…')[] {
    const total   = this.totalPages;
    const current = this.currentPage;                // 0-based
    const out: (number | '…')[] = [];

    if (total <= 7) {
      for (let i = 0; i < total; i++) out.push(i);
      return out;
    }

    // Toujours la première
    out.push(0);

    const windowStart = Math.max(1, current - 1);
    const windowEnd   = Math.min(total - 2, current + 1);

    if (windowStart > 1) out.push('…');
    for (let i = windowStart; i <= windowEnd; i++) out.push(i);
    if (windowEnd < total - 2) out.push('…');

    // Toujours la dernière
    out.push(total - 1);
    return out;
  }

  /** Fenêtre d'affichage : "Affichage 1–12 sur 47" */
  get pageRangeStart(): number {
    return this.filtered.length === 0 ? 0 : this.currentPage * this.pageSize + 1;
  }
  get pageRangeEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.filtered.length);
  }

  goToPage(p: number | '…'): void {
    if (p === '…') return;
    if (p < 0 || p >= this.totalPages || p === this.currentPage) return;
    this.currentPage = p;
    this.scrollGridIntoView();
    this.animateCards();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.scrollGridIntoView();
      this.animateCards();
    }
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.scrollGridIntoView();
      this.animateCards();
    }
  }

  changePageSize(n: number | string): void {
    const size = typeof n === 'string' ? parseInt(n, 10) : n;
    if (!size || size === this.pageSize) return;
    this.pageSize    = size;
    this.currentPage = 0;
    this.animateCards();
  }

  /** Réinitialise la pagination (appelé quand la recherche change). */
  onSearchChanged(): void {
    this.currentPage = 0;
  }

  private scrollGridIntoView(): void {
    if (typeof document === 'undefined') return;
    const el = document.querySelector('.signalements-grid');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  constructor(
    private sigService:   SignalementService,
    private authService:  AuthService,
    private ngZone:       NgZone,
    private voteStorage:  VoteStorageService,
  ) {}

  /* ── Lifecycle ─────────────────────────────────────── */
  ngOnInit(): void {
    /* Charger les votes persistés depuis localStorage */
    this.votedIds = this.voteStorage.load();
    this.startProximite();
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    const tl = gsap.timeline();
    tl.fromTo('.page-header',
        { opacity: 0, y: -28 },
        { opacity: 1, y: 0, duration: .7, ease: 'power3.out' })
      .fromTo('.scope-switcher',
        { opacity: 0, scale: .88, y: 10 },
        { opacity: 1, scale: 1,   y: 0,  duration: .5, ease: 'back.out(1.8)' }, '-=.3')
      .fromTo('.filter-bar',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: .45, ease: 'power2.out' }, '-=.2');
  }

  ngOnDestroy(): void {
    this.destroyMap();
    clearTimeout(this.toastTimer);
  }

  /* ── Détruire proprement l'instance Leaflet ────────── */
  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  /* ── Chargement ────────────────────────────────────── */
  private startProximite(): void {
    this.loading    = true;
    this.error      = null;
    this.geoLoading = true;
    this.geoError   = false;

    if (!navigator.geolocation) { this.fallbackAll(); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => this.ngZone.run(() => {
        this.userLat    = pos.coords.latitude;
        this.userLng    = pos.coords.longitude;
        this.geoLoading = false;
        this.fetchProximite();
      }),
      () => this.ngZone.run(() => {
        this.geoLoading = false;
        this.geoError   = true;
        this.fallbackAll();
      }),
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }

  private fetchProximite(): void {
    this.sigService.getProximite(this.userLat!, this.userLng!, this.proximiteKm).subscribe({
      next:  (data) => this.ngZone.run(() => this.onData(data)),
      error: ()     => this.ngZone.run(() => this.fallbackAll()),
    });
  }

  private fallbackAll(): void {
    this.viewScope = 'tous';
    this.sigService.getAll().subscribe({
      next:  (data) => this.ngZone.run(() => this.onData(data)),
      error: ()     => this.ngZone.run(() => {
        this.error   = 'Impossible de charger les signalements.';
        this.loading = false;
      }),
    });
  }

  private onData(data: SignalementResponse[]): void {
    this.signalements = data.sort((a, b) =>
      new Date(b.dateSignalement).getTime() - new Date(a.dateSignalement).getTime()
    );
    this.updateFilters();
    this.currentPage = 0;
    this.loading = false;

    if (this.viewMode === 'map') {
      // Réinitialiser la carte avec les nouvelles données (ex: changement de rayon)
      this.destroyMap();
      setTimeout(() => {
        if (typeof gsap !== 'undefined' && this.mapElRef?.nativeElement) {
          gsap.set(this.mapElRef.nativeElement, { opacity: 0, scale: 0.96 });
        }
        this.initMap();
      }, 60);
    } else {
      this.animateCards();
    }
  }

  /* ── Scope switch ──────────────────────────────────── */
  switchScope(scope: 'proximite' | 'tous'): void {
    if (scope === this.viewScope && !this.loading) return;

    const wasMapMode  = this.viewMode === 'map';
    this.destroyMap();          // libère la carte avant de changer les données
    this.viewMode     = 'list'; // toujours revenir en liste lors d'un changement de scope
    this.viewScope    = scope;
    this.activeFilter = 'TOUS';
    this.searchQuery  = '';
    this.currentPage  = 0;
    this.loading      = true;
    this.error        = null;

    const doLoad = () => {
      if (scope === 'proximite' && this.userLat && this.userLng) {
        this.fetchProximite();
      } else {
        this.fallbackAll();
      }
    };

    if (typeof gsap !== 'undefined') {
      gsap.to('.sig-card', {
        opacity: 0, y: -10, scale: .96,
        duration: .18, stagger: .02, ease: 'power2.in',
        onComplete: () => this.ngZone.run(doLoad),
      });
    } else { doLoad(); }
  }

  changeRadius(km: number): void {
    this.proximiteKm = km;
    this.currentPage = 0;
    if (this.viewScope === 'proximite' && this.userLat && this.userLng) {
      this.loading = true;
      if (this.viewMode === 'map') this.destroyMap(); // réinitialisé dans onData()
      this.fetchProximite();
    }
  }

  /* ── Filtres / recherche ───────────────────────────── */
  private updateFilters(): void {
    this.filters.forEach(f => {
      f.count = f.key === 'TOUS'
        ? this.signalements.length
        : this.signalements.filter(s => s.statut === f.key).length;
    });
  }

  setFilter(key: string): void {
    if (key === this.activeFilter) return;
    this.activeFilter = key;
    this.currentPage  = 0;
    // Délai nécessaire : Angular doit rendre les nouvelles cartes
    // avant que GSAP puisse les animer (sinon animation sur l'ancien DOM)
    if (typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('.sig-card',
          { opacity: 0, y: 14, scale: .97 },
          { opacity: 1, y: 0,  scale: 1,  duration: .35, ease: 'power3.out', stagger: .045 }
        );
      }, 30);
    }
  }

  setView(mode: 'list' | 'map'): void {
    if (mode === this.viewMode) return;
    if (mode === 'list') {
      this.destroyMap();        // libère Leaflet quand on revient en liste
    }
    this.viewMode = mode;
    if (mode === 'map') {
      this.destroyMap();        // détruit tout résidu avant de créer une nouvelle carte
      setTimeout(() => {
        if (typeof gsap !== 'undefined' && this.mapElRef?.nativeElement) {
          gsap.set(this.mapElRef.nativeElement, { opacity: 0, scale: 0.96 });
        }
        this.initMap();
      }, 60);
    }
  }

  /* ── Vote ──────────────────────────────────────────── */
  voter(sig: SignalementResponse): void {
    if (this.votedIds.has(sig.id) || this.votingIds.has(sig.id)) return;

    this.votingIds.add(sig.id);
    const prevVotes = sig.votes ?? 0;

    /* Optimistic update + persister immédiatement */
    sig.votes = prevVotes + 1;
    this.votedIds.add(sig.id);
    this.voteStorage.add(sig.id);   // ← persistance localStorage

    /* Animation bouton */
    const btn = document.querySelector(`#vote-btn-${sig.id}`);
    if (btn && typeof gsap !== 'undefined') {
      const tl = gsap.timeline();
      tl.to(btn,         { scale: 1.35, duration: .15, ease: 'back.out(3)' })
        .to(btn,         { scale: 1,    duration: .25, ease: 'elastic.out(1,.4)' })
        .to(`#vote-icon-${sig.id}`, { rotation: 15, duration: .1 }, 0)
        .to(`#vote-icon-${sig.id}`, { rotation: 0,  duration: .2, ease: 'back.out(2)' }, .1);

      /* Mini particules */
      this.spawnVoteParticles(btn as HTMLElement);
    }

    /* Animation compteur */
    this.animateCounter(`#vote-count-${sig.id}`, prevVotes, sig.votes);

    this.sigService.voter(sig.id).subscribe({
      next: (updated) => this.ngZone.run(() => {
        const idx = this.signalements.findIndex(s => s.id === sig.id);
        if (idx !== -1) this.signalements[idx].votes = updated.votes;
        this.votingIds.delete(sig.id);
        this.showToast('Vote enregistré !', 'success');
      }),
      error: () => this.ngZone.run(() => {
        /* Rollback : annuler l'optimistic update */
        sig.votes = prevVotes;
        this.votedIds.delete(sig.id);
        this.voteStorage.remove(sig.id);   // ← rollback localStorage
        this.votingIds.delete(sig.id);
        this.showToast('Erreur lors du vote.', 'error');
      }),
    });
  }

  private spawnVoteParticles(anchor: HTMLElement): void {
    if (typeof gsap === 'undefined') return;
    const rect = anchor.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const colors = ['#0D9B76', '#E8532A', '#C9973E', '#3B82F6'];

    for (let i = 0; i < 10; i++) {
      const p = document.createElement('div');
      const sz = Math.random() * 6 + 4;
      p.style.cssText = `
        position:fixed;width:${sz}px;height:${sz}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:50%;left:${cx}px;top:${cy}px;
        opacity:1;pointer-events:none;z-index:9999;`;
      document.body.appendChild(p);
      gsap.to(p, {
        x: (Math.random() - .5) * 90,
        y: (Math.random() - .5) * 70 - 30,
        opacity: 0,
        duration: .7 + Math.random() * .4,
        ease: 'power2.out',
        onComplete: () => p.remove(),
      });
    }
  }

  private animateCounter(selector: string, from: number, to: number): void {
    if (typeof gsap === 'undefined') return;
    const el = document.querySelector(selector);
    if (!el) return;
    const obj = { val: from };
    gsap.to(obj, {
      val: to, duration: .55, ease: 'power2.out',
      onUpdate: () => { el.textContent = Math.round(obj.val).toString(); },
    });
  }

  /* ── Toast ─────────────────────────────────────────── */
  private showToast(msg: string, type: 'success' | 'error'): void {
    clearTimeout(this.toastTimer);
    this.toast = { msg, type };
    if (typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('.global-toast',
          { opacity: 0, y: 20, scale: .92 },
          { opacity: 1, y: 0,  scale: 1, duration: .35, ease: 'back.out(1.8)' }
        );
      }, 10);
    }
    this.toastTimer = setTimeout(() => {
      if (typeof gsap !== 'undefined') {
        gsap.to('.global-toast', {
          opacity: 0, y: 12, duration: .25, ease: 'power2.in',
          onComplete: () => { this.ngZone.run(() => { this.toast = null; }); },
        });
      } else { this.toast = null; }
    }, 2600);
  }

  /* ── Carte Leaflet ─────────────────────────────────── */
  private initMap(): void {
    if (typeof L === 'undefined' || !this.mapElRef) return;
    // destroyMap() doit être appelé avant initMap() — on part d'une ardoise vierge

    const cLat = this.userLat ?? 36.8065;
    const cLng = this.userLng ?? 10.1815;

    this.map = L.map(this.mapElRef.nativeElement, { center: [cLat, cLng], zoom: 13, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO', maxZoom: 19,
    }).addTo(this.map);

    /* Cercle de proximité */
    if (this.viewScope === 'proximite' && this.userLat && this.userLng) {
      L.circle([this.userLat, this.userLng], {
        radius: this.proximiteKm * 1000,
        color: '#E8532A', fillColor: '#E8532A',
        fillOpacity: .05, weight: 2, dashArray: '7,5',
      }).addTo(this.map);

      const meIcon = L.divIcon({
        html: `<div class="me-dot"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9], className: '',
      });
      L.marker([this.userLat, this.userLng], { icon: meIcon })
        .addTo(this.map).bindPopup('<b>📍 Votre position</b>');
    }

    const colorMap: Record<string, string> = {
      EN_ATTENTE: '#FF6B35', EN_COURS: '#1A56DB', RESOLU: '#00C9A7', REJETE: '#E24B4A',
    };

    // ── Premium Apple Maps marker elements (for GSAP access) ──────
    const premiumMarkerEls: HTMLElement[] = [];
    const premiumMarkers: any[] = [];

    this.signalements.forEach((s, idx) => {
      const c = colorMap[s.statut] ?? '#9CA3AF';
      const dist = this.calcDistanceNum(s.latitude, s.longitude);

      // ── Build premium divIcon HTML ─────────────────────────────
      const markerHtml = `
        <div class="apm-root" data-idx="${idx}" data-statut="${s.statut}">
          <div class="apm-shadow"></div>
          <div class="apm-halo" style="--halo-color:${c}"></div>
          <div class="apm-halo apm-halo-2" style="--halo-color:${c}"></div>
          <div class="apm-pin" style="--pin-color:${c}">
            <div class="apm-pin-body">
              <div class="apm-pin-inner"></div>
            </div>
            <div class="apm-pin-tail"></div>
          </div>
          <div class="apm-glow" style="--glow-color:${c}"></div>
        </div>`;

      const icon = L.divIcon({
        html: markerHtml,
        iconSize:    [36, 48],
        iconAnchor:  [18, 48],
        popupAnchor: [0, -52],
        className:   '',
      });

      const marker = L.marker([s.latitude, s.longitude], { icon }).addTo(this.map)
        .bindPopup(`
          <div class="apm-popup">
            <div class="apm-popup-type">${this.typeEmoji(s.type)} ${this.typeLabel(s.type)}</div>
            <div class="apm-popup-addr">${s.adresse ?? ''}</div>
            ${dist !== null ? `<div class="apm-popup-dist">📏 À ${dist < 1 ? Math.round(dist*1000)+'m' : dist.toFixed(1)+'km'}</div>` : ''}
            <span class="apm-popup-pill" style="background:${c}22;color:${c}">${this.statutLabel(s.statut)}</span>
          </div>`, { maxWidth: 240, className: 'apm-popup-wrap' });

      premiumMarkers.push(marker);
    });

    // ── Step 1 @ 280ms: collect all DOM elements + init GSAP state ──
    // (Leaflet finishes icon injection well within 280ms)
    setTimeout(() => {
      const mapEl = this.mapElRef?.nativeElement as HTMLElement;
      if (!mapEl) return;
      const roots = mapEl.querySelectorAll<HTMLElement>('.apm-root');

      // Collect first so allEls is full when hover runs
      roots.forEach(el => premiumMarkerEls.push(el));

      // Pre-compute spawn timing for each marker so idle starts at the right time
      roots.forEach((el, i) => {
        const c          = colorMap[this.signalements[i]?.statut] ?? '#9CA3AF';
        const spawnDelay = 380 + i * 70;     // ms from now (matches spawnMarker call below)
        this.attachPremiumMarkerEvents(el, premiumMarkers[i], premiumMarkerEls, c, spawnDelay);
      });
    }, 280);

    // Store for external access
    (this as any)._premiumMarkerEls = premiumMarkerEls;

    setTimeout(() => {
      this.map.invalidateSize();
      this.runMapScenario();
    }, 220);
  }

  /* ══════════════════════════════════════════════════════
     APPLE MAPS PREMIUM MARKER ANIMATIONS  (bug-free v2)
     ══════════════════════════════════════════════════════

     KEY DESIGN RULES:
     • GSAP owns the pin transform 100% — no CSS transform on .apm-pin
     • xPercent:-50 replaces translateX(-50%) so centering is preserved
     • transformOrigin set once via gsap.set(), never in CSS
     • Idle timelines stored per-pin so hover can pause/resume them cleanly
     • scaleX/scaleY never mixed with scale in the same tween
     ══════════════════════════════════════════════════════ */

  /** Initialise un pin et démarre les boucles idle APRÈS le spawn */
  private attachPremiumMarkerEvents(
    el: HTMLElement,
    _marker: any,
    allEls: HTMLElement[],
    color: string,
    spawnDoneAt: number,   // ms from now when spawn will be complete
  ): void {
    if (typeof gsap === 'undefined') return;

    const pin    = el.querySelector<HTMLElement>('.apm-pin');
    const halo1  = el.querySelector<HTMLElement>('.apm-halo:not(.apm-halo-2)');
    const halo2  = el.querySelector<HTMLElement>('.apm-halo-2');
    const glow   = el.querySelector<HTMLElement>('.apm-glow');
    const shadow = el.querySelector<HTMLElement>('.apm-shadow');
    if (!pin) return;

    /* ── Set GSAP as owner of transform immediately ─────── */
    gsap.set(pin, {
      xPercent: -50,
      transformOrigin: 'bottom center',
      scale: 0,
      opacity: 0,
    });
    if (shadow) gsap.set(shadow, { xPercent: -50, opacity: 0.2 });

    /* ── Idle timelines (created paused, start after spawn) ─ */
    const breathTl = gsap.timeline({ repeat: -1, yoyo: true, paused: true });
    breathTl.to(pin, {
      scaleX: 1.045, scaleY: 1.03,
      duration: 1.6 + Math.random() * 0.8,
      ease: 'sine.inOut',
    });

    const floatTl = gsap.timeline({ repeat: -1, yoyo: true, paused: true });
    floatTl.to(pin, {
      y: -3.5,
      duration: 2.2 + Math.random() * 0.6,
      ease: 'sine.inOut',
    });

    /* ── Halo pulse (recursive, starts after spawn) ─────── */
    const startHaloPulse = () => {
      if (!el.isConnected) return;
      gsap.set(halo1, { scale: 0.6, opacity: 0.55 });
      gsap.set(halo2, { scale: 0.6, opacity: 0.35 });

      const fire = () => {
        if (!el.isConnected) return;
        const tl = gsap.timeline({
          onComplete: () => setTimeout(fire, 1600 + Math.random() * 900),
        });
        tl.to(halo1, { scale: 2.4, opacity: 0, duration: 1.3, ease: 'power2.out' }, 0)
          .set(halo1, { scale: 0.6, opacity: 0.55 }, '>')
          .to(halo2, { scale: 3.0, opacity: 0, duration: 1.7, ease: 'power1.out' }, 0.18)
          .set(halo2, { scale: 0.6, opacity: 0.35 }, '>');
      };
      fire();
    };

    /* ── Start idle loops after spawn finishes ──────────── */
    const idleOffset = spawnDoneAt + 80 + Math.random() * 150;
    setTimeout(() => {
      if (!el.isConnected) return;
      breathTl.play();
      floatTl.play();
      startHaloPulse();
    }, idleOffset);

    /* ── Hover enter ────────────────────────────────────── */
    el.addEventListener('mouseenter', () => {
      if (typeof gsap === 'undefined') return;

      // Pause idle so they don't fight hover tween
      breathTl.pause();
      floatTl.pause();
      gsap.killTweensOf(pin);   // kill any lingering tween on pin

      gsap.to(pin, {
        y: -10, scaleX: 1.18, scaleY: 1.18,
        duration: 0.28, ease: 'back.out(2)',
        overwrite: true,
      });
      if (glow)   gsap.to(glow,   { opacity: 0.5, scale: 1.6, duration: 0.28, overwrite: true });
      if (shadow) gsap.to(shadow, { opacity: 0.45, scaleX: 1.35, duration: 0.28, overwrite: true });

      // Dim all other pins
      allEls.forEach(other => {
        if (other === el) return;
        const op = other.querySelector<HTMLElement>('.apm-pin');
        if (op) gsap.to(op, { opacity: 0.38, scaleX: 0.88, scaleY: 0.88, duration: 0.25, overwrite: true });
      });
    });

    /* ── Hover leave ────────────────────────────────────── */
    el.addEventListener('mouseleave', () => {
      if (typeof gsap === 'undefined') return;

      gsap.killTweensOf(pin);
      gsap.to(pin, {
        y: 0, scaleX: 1, scaleY: 1,
        duration: 0.55, ease: 'elastic.out(1.1, 0.5)',
        overwrite: true,
        onComplete: () => {
          // Resume idle only once we're back at rest
          breathTl.resume();
          floatTl.resume();
        },
      });
      if (glow)   gsap.to(glow,   { opacity: 0,    scale: 1,    duration: 0.3,  overwrite: true });
      if (shadow) gsap.to(shadow, { opacity: 0.2,  scaleX: 1,   duration: 0.3,  overwrite: true });

      allEls.forEach(other => {
        if (other === el) return;
        const op = other.querySelector<HTMLElement>('.apm-pin');
        if (op) gsap.to(op, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.32, overwrite: true });
      });
    });

    /* ── Click — squash-bounce + ripple rings ────────────── */
    el.addEventListener('click', () => {
      if (typeof gsap === 'undefined') return;

      gsap.killTweensOf(pin);
      const clickTl = gsap.timeline();
      clickTl
        .to(pin, { scaleY: 0.8, scaleX: 1.2,  duration: 0.09, ease: 'power2.in',  overwrite: true })
        .to(pin, { scaleY: 1.3, scaleX: 0.88, duration: 0.12, ease: 'power2.out' })
        .to(pin, { scaleX: 1,   scaleY: 1,    duration: 0.55, ease: 'elastic.out(1.3, 0.4)' });

      // Three staggered ripple rings
      [0, 0.15, 0.32].forEach((ringDelay, r) => {
        const ring = document.createElement('div');
        ring.style.cssText = `
          position:absolute; top:50%; left:50%;
          width:32px; height:32px;
          margin:-20px 0 0 -16px;
          border-radius:50%;
          border:${r === 0 ? '2' : '1.5'}px solid ${color};
          pointer-events:none; z-index:5;
          opacity:0;`;
        el.appendChild(ring);
        gsap.fromTo(ring,
          { scale: 0.5, opacity: 0.75 },
          {
            scale: 2.6 + r * 0.7,
            opacity: 0,
            duration: 0.85 + r * 0.2,
            delay: ringDelay,
            ease: 'power2.out',
            onComplete: () => ring.remove(),
          }
        );
      });
    });
  }

  /* ── Spawn: hidden → elegant entry ──────────────────── */
  private spawnMarker(el: HTMLElement, delayMs: number): number {
    /* Returns ms until animation is fully complete (for idle offset) */
    if (typeof gsap === 'undefined') return delayMs;
    const pin = el.querySelector<HTMLElement>('.apm-pin');
    if (!pin) return delayMs;

    const jitterMs  = (Math.random() - 0.5) * 60;   // ±30ms organic jitter
    const totalMs   = delayMs + jitterMs;
    const delaySec  = Math.max(0, totalMs) / 1000;

    // gsap.set already ran in attachPremiumMarkerEvents (scale:0, xPercent:-50)
    const spawnDuration = 0.36 + 0.1 + 0.5;         // 0.96s total

    const tl = gsap.timeline({ delay: delaySec });
    tl
      // 1. Drop from above with slight rotation
      .to(pin, {
        y: 0, rotation: 0, scale: 1.2, opacity: 1,
        duration: 0.36,
        ease: 'expo.out',
      })
      // 2. Squash on ground contact
      .to(pin, {
        scaleX: 1.15, scaleY: 0.85,
        duration: 0.10,
        ease: 'power3.in',
      })
      // 3. Elastic rebound to natural size
      .to(pin, {
        scaleX: 1, scaleY: 1,
        duration: 0.50,
        ease: 'elastic.out(1.4, 0.4)',
      });

    // Apply initial hidden position with slight randomised drop start
    gsap.set(pin, {
      y: -(16 + Math.random() * 10),
      rotation: (Math.random() - 0.5) * 14,
    });

    return totalMs + spawnDuration * 1000;
  }

  /* ── Exit (for future use) ───────────────────────────── */
  private exitMarker(el: HTMLElement, onComplete?: () => void): void {
    if (typeof gsap === 'undefined') { onComplete?.(); return; }
    const pin = el.querySelector<HTMLElement>('.apm-pin');
    if (!pin) { onComplete?.(); return; }
    gsap.killTweensOf(pin);
    gsap.to(pin, {
      scale: 0, y: 8, opacity: 0,
      duration: 0.28, ease: 'power3.in',
      overwrite: true,
      onComplete,
    });
  }

  /* ── Scénario d'animation carte — City Reveal ──────── */
  private runMapScenario(): void {
    if (typeof gsap === 'undefined') return;
    const mapEl = this.mapElRef.nativeElement as HTMLElement;
    const count  = this.signalements.length;

    // ── 1. Carte : fondu doux avec légère montée ───────────────────
    gsap.to(mapEl, {
      opacity: 1, scale: 1, y: 0,
      duration: 0.8,
      ease: 'power2.out',
    });

    // ── 2. Légende — glisse depuis le bas ──────────────────────────
    gsap.fromTo('.map-legend',
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.25 }
    );
    gsap.fromTo('.map-legend .legend-item',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out',
        stagger: 0.08, delay: 0.35 }
    );

    // ── 3. Marqueurs premium — spawn après init GSAP (380ms) ──────
    setTimeout(() => {
      const roots = mapEl.querySelectorAll<HTMLElement>('.apm-root');
      roots.forEach((el, i) => {
        // stagger: 70ms between pins, 0-base delay so first pin fires immediately
        this.spawnMarker(el, i * 70);
      });
    }, 380);

    // ── 4. Pulse discret sur le marqueur de position ───────────────
    if (this.userLat !== null && this.userLng !== null && this.map) {
      setTimeout(() => {
        const meDots = mapEl.querySelectorAll<HTMLElement>('.me-dot');
        if (meDots.length) {
          gsap.fromTo(meDots,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.5)' }
          );
        }
      }, 700);
    }

    // ── 5. Chip flottant — résultats, apparaît puis se retire ──────
    setTimeout(() => {
      const chip = document.createElement('div');
      const label = this.viewScope === 'proximite'
        ? `${count} signalement${count > 1 ? 's' : ''} · ${this.proximiteKm} km`
        : `${count} signalement${count > 1 ? 's' : ''} au total`;

      chip.style.cssText = `
        position:absolute; bottom:20px; left:50%;
        transform:translateX(-50%) translateY(12px);
        background:#fff;
        color:#0C1F3F; padding:8px 18px; border-radius:100px;
        font-size:12.5px; font-weight:600;
        font-family:'DM Sans',sans-serif;
        border:1px solid rgba(12,31,63,0.1);
        box-shadow:0 4px 20px rgba(0,0,0,0.12);
        white-space:nowrap; z-index:800; pointer-events:none; opacity:0;`;
      chip.textContent = `📍 ${label}`;
      mapEl.appendChild(chip);

      gsap.to(chip, {
        opacity: 1, y: 0,
        duration: 0.45, ease: 'power3.out',
        onComplete: () => {
          gsap.to(chip, {
            opacity: 0, y: 8,
            duration: 0.35, ease: 'power2.in',
            delay: 2.5,
            onComplete: () => chip.remove(),
          });
        },
      });
    }, 900);
  }

  /* ── Animations internes ───────────────────────────── */
  private animateCards(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      gsap.fromTo('.sig-card',
        { opacity: 0, y: 28, scale: .96 },
        { opacity: 1, y: 0,  scale: 1,  duration: .5, ease: 'power3.out', stagger: .055 }
      );
      gsap.fromTo('.results-meta',
        { opacity: 0 },
        { opacity: 1, duration: .4, delay: .1 }
      );
    }, 60);
  }

  /* ── Utilitaires ───────────────────────────────────── */
  calcDistanceNum(lat: number, lng: number): number | null {
    if (this.userLat === null || this.userLng === null) return null;
    const R    = 6371;
    const dLat = (lat - this.userLat)  * Math.PI / 180;
    const dLng = (lng - this.userLng)  * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
               + Math.cos(this.userLat * Math.PI / 180)
               * Math.cos(lat * Math.PI / 180)
               * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  distanceLabel(lat: number, lng: number): string {
    const d = this.calcDistanceNum(lat, lng);
    if (d === null) return '';
    return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE:           '🕳️ Trou chaussée',
      LAMPADAIRE_CASSE:        '💡 Lampadaire cassé',
      FUITE_EAU:               "💧 Fuite d'eau",
      DECHETS_NON_COLLECTES:   '🗑️ Déchets',
      POTEAU_ENDOMMAGE:        '⚡ Poteau endommagé',
      SIGNALISATION_MANQUANTE: '🚦 Signalisation',
      CANIVEAU_BOUCHE:         '🌊 Caniveau bouché',
      ESPACE_VERT_DEGRADE:     '🌿 Espace vert',
      AUTRE:                   '📌 Autre',
    };
    return map[type] ?? type;
  }

  /** Emoji illustratif pour l'absence de photo */
  typeEmoji(type: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE:           '🕳️',
      LAMPADAIRE_CASSE:        '💡',
      FUITE_EAU:               '💧',
      DECHETS_NON_COLLECTES:   '🗑️',
      POTEAU_ENDOMMAGE:        '⚡',
      SIGNALISATION_MANQUANTE: '🚦',
      CANIVEAU_BOUCHE:         '🌊',
      ESPACE_VERT_DEGRADE:     '🌿',
    };
    return map[type] ?? '📌';
  }

  /** Gradient de fond de la zone image selon le statut */
  cardGradient(statut: string): string {
    const map: Record<string, string> = {
      EN_ATTENTE: 'linear-gradient(135deg, #FF6B35 0%, #E8532A 100%)',
      EN_COURS:   'linear-gradient(135deg, #3B82F6 0%, #1A56DB 100%)',
      RESOLU:     'linear-gradient(135deg, #00C9A7 0%, #0D9B76 100%)',
      REJETE:     'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
    };
    return map[statut] ?? 'linear-gradient(135deg, #6B7280 0%, #374151 100%)';
  }

  statutLabel(s: string): string {
    return ({ EN_ATTENTE: 'En attente', EN_COURS: 'En cours', RESOLU: 'Résolu', REJETE: 'Rejeté' } as any)[s] ?? s;
  }

  prioriteLabel(p: string): string {
    const m: Record<string, string> = {
      FAIBLE:'Faible', MOYENNE:'Moyenne', HAUTE:'Haute', URGENTE:'Urgente',
      faible:'Faible', moyenne:'Moyenne', haute:'Haute', urgente:'Urgente',
    };
    return m[p] ?? p;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
