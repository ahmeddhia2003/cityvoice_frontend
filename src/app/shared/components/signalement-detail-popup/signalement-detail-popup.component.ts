import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnDestroy, SimpleChanges,
  NgZone, ElementRef, ViewChild,
} from '@angular/core';
import { SignalementResponse } from '../../../core/services/signalement.service';
import { environment } from '../../../../environments/environment';

declare const gsap: any;
declare const L: any;

@Component({
  selector: 'app-signalement-detail-popup',
  templateUrl: './signalement-detail-popup.component.html',
  styleUrls:  ['./signalement-detail-popup.component.css'],
})
export class SignalementDetailPopupComponent implements OnChanges, OnDestroy {

  @Input()  sig: SignalementResponse | null = null;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('backdrop') backdropRef!: ElementRef;
  @ViewChild('card')     cardRef!:     ElementRef;
  @ViewChild('miniMap')  miniMapRef!:  ElementRef;

  lightboxUrl: string | null = null;
  lightboxIdx  = 0;

  /** Retourne l'URL d'écoute de l'audio vocal (description ou localisation) */
  voiceAudioUrl(step: 'description' | 'location'): string | null {
    if (!this.sig?.voiceSessionId) return null;
    return `${environment.apiUrl}/api/v1/hybrid-voice/audio/${this.sig.voiceSessionId}/${step}`;
  }

  get hasVoiceAudio(): boolean {
    return !!this.sig?.voiceSessionId;
  }

  private leafletMap: any = null;

  constructor(private zone: NgZone) {}

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnChanges(c: SimpleChanges): void {
    if (c['sig']) {
      if (this.sig) {
        this._lockScroll(true);
        setTimeout(() => this._animateOpen(), 20);
        setTimeout(() => this._initMap(),     380);
      }
    }
  }

  ngOnDestroy(): void {
    this._destroyMap();
    this._lockScroll(false);
  }

  // ── Public API ─────────────────────────────────────────────
  close(): void {
    if (typeof gsap === 'undefined') { this._doClose(); return; }
    const card     = this.cardRef?.nativeElement;
    const backdrop = this.backdropRef?.nativeElement;

    const tl = gsap.timeline({ onComplete: () => this.zone.run(() => this._doClose()) });
    tl.to(card,     { scale: 0.88, y: 40, opacity: 0, duration: .28, ease: 'power3.in' })
      .to(backdrop, { opacity: 0,          duration: .22, ease: 'power2.in' }, '-=.1');
  }

  closeOnBackdrop(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('sp-backdrop')) this.close();
  }

  openLightbox(imgs: string[], i: number): void {
    this.lightboxUrl = imgs[i];
    this.lightboxIdx = i;
  }
  closeLightbox(): void { this.lightboxUrl = null; }
  lbPrev(imgs: string[]): void {
    this.lightboxIdx = (this.lightboxIdx - 1 + imgs.length) % imgs.length;
    this.lightboxUrl = imgs[this.lightboxIdx];
  }
  lbNext(imgs: string[]): void {
    this.lightboxIdx = (this.lightboxIdx + 1) % imgs.length;
    this.lightboxUrl = imgs[this.lightboxIdx];
  }

  // ── Helpers ────────────────────────────────────────────────
  typeLabel(t: string): string {
    const m: Record<string, string> = {
      TROU_CHAUSSEE:           '🕳️ Trou dans la chaussée',
      LAMPADAIRE_CASSE:        '💡 Lampadaire cassé',
      FUITE_EAU:               "💧 Fuite d'eau",
      DECHETS_NON_COLLECTES:   '🗑️ Déchets non collectés',
      POTEAU_ENDOMMAGE:        '⚡ Poteau endommagé',
      SIGNALISATION_MANQUANTE: '🚦 Signalisation manquante',
      CANIVEAU_BOUCHE:         '🌊 Caniveau bouché',
      ESPACE_VERT_DEGRADE:     '🌿 Espace vert dégradé',
    };
    return m[t] ?? t;
  }

  typeEmoji(t: string): string {
    const m: Record<string,string> = {
      TROU_CHAUSSEE:'🕳️', LAMPADAIRE_CASSE:'💡', FUITE_EAU:'💧',
      DECHETS_NON_COLLECTES:'🗑️', POTEAU_ENDOMMAGE:'⚡',
      SIGNALISATION_MANQUANTE:'🚦', CANIVEAU_BOUCHE:'🌊', ESPACE_VERT_DEGRADE:'🌿',
    };
    return m[t] ?? '📍';
  }

  typeColor(t: string): string {
    const m: Record<string,string> = {
      TROU_CHAUSSEE:'#78716C', LAMPADAIRE_CASSE:'#D97706', FUITE_EAU:'#2563EB',
      DECHETS_NON_COLLECTES:'#16A34A', POTEAU_ENDOMMAGE:'#E8532A',
      SIGNALISATION_MANQUANTE:'#7C3AED', CANIVEAU_BOUCHE:'#0891B2', ESPACE_VERT_DEGRADE:'#15803D',
    };
    return m[t] ?? '#6B7280';
  }

  statutLabel(s: string): string {
    return ({ EN_ATTENTE:'En attente', EN_COURS:'En cours', RESOLU:'Résolu', REJETE:'Rejeté' } as any)[s] ?? s;
  }

  statutColor(s: string): string {
    return ({ EN_ATTENTE:'#E8532A', EN_COURS:'#3B82F6', RESOLU:'#0D9B76', REJETE:'#9CA3AF' } as any)[s] ?? '#9CA3AF';
  }

  prioriteLabel(p: string): string {
    return ({ URGENTE:'🔴 Urgente', HAUTE:'🟠 Haute', MOYENNE:'🟡 Moyenne', FAIBLE:'🟢 Faible' } as any)[p] ?? p;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  progressPct(s: string): number {
    return ({ EN_ATTENTE: 10, EN_COURS: 55, RESOLU: 100, REJETE: 100 } as any)[s] ?? 0;
  }

  confidencePct(v: number | undefined): number {
    return v ? Math.round(v * 100) : 0;
  }

  teamColor(label: string | undefined): string {
    if (!label) return '#3B82F6';
    const h = [...(label)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const palette = ['#3B82F6','#0D9B76','#E8532A','#D97706','#7C3AED','#0891B2','#DB2777'];
    return palette[h % palette.length];
  }

  // ── Private ────────────────────────────────────────────────
  private _animateOpen(): void {
    if (typeof gsap === 'undefined') return;
    const card     = this.cardRef?.nativeElement;
    const backdrop = this.backdropRef?.nativeElement;
    if (!card || !backdrop) return;

    // Reset initial states
    gsap.set(backdrop, { opacity: 0 });
    gsap.set(card,     { opacity: 0, scale: 0.82, y: 70, rotateX: 8 });
    gsap.set('.sp-header-content', { opacity: 0, x: -30 });
    gsap.set('.sp-status-badge',   { opacity: 0, scale: 0, rotation: -15 });
    gsap.set('.sp-map-shell',      { opacity: 0, y: 18 });
    gsap.set('.sp-info-row',       { opacity: 0, x: -18 });
    gsap.set('.sp-section-title',  { opacity: 0, y: 10 });
    gsap.set('.sp-actions',        { opacity: 0, y: 16 });
    gsap.set('.sp-close',          { opacity: 0, scale: 0, rotation: 45 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // 1 — Backdrop
    tl.to(backdrop, { opacity: 1, duration: .35 })

    // 2 — Card morphs in with 3D spring
      .to(card, {
        opacity: 1, scale: 1, y: 0, rotateX: 0,
        duration: .6, ease: 'back.out(1.5)',
      }, '-=.2')

    // 3 — Close button spins in
      .to('.sp-close', {
        opacity: 1, scale: 1, rotation: 0,
        duration: .35, ease: 'back.out(2.2)',
      }, '-=.4')

    // 4 — Header content slides in
      .to('.sp-header-content', {
        opacity: 1, x: 0, duration: .4, ease: 'power3.out',
      }, '-=.35')

    // 5 — Status badge bounces in
      .to('.sp-status-badge', {
        opacity: 1, scale: 1, rotation: 0,
        duration: .35, ease: 'back.out(2.8)',
      }, '-=.25')

    // 6 — Map fades up
      .to('.sp-map-shell', {
        opacity: 1, y: 0, duration: .4,
      }, '-=.2')

    // 7 — Section titles
      .to('.sp-section-title', {
        opacity: 1, y: 0, duration: .3, stagger: .06,
      }, '-=.3')

    // 8 — Info rows stagger in
      .to('.sp-info-row', {
        opacity: 1, x: 0, duration: .28, stagger: .055,
      }, '-=.25')

    // 9 — Progress bar animates
      .fromTo('.sp-prog-fill',
        { scaleX: 0 },
        { scaleX: 1, duration: .7, ease: 'power2.out', transformOrigin: 'left center' },
        '-=.3')

    // 10 — Actions slide up
      .to('.sp-actions', {
        opacity: 1, y: 0, duration: .35, ease: 'back.out(1.6)',
      }, '-=.2');
  }

  private _initMap(): void {
    if (typeof L === 'undefined' || !this.sig || !this.miniMapRef) return;
    if (!this.sig.latitude || !this.sig.longitude) return;

    this._destroyMap();

    const el = this.miniMapRef.nativeElement;
    this.leafletMap = L.map(el, {
      center: [this.sig.latitude, this.sig.longitude],
      zoom: 15,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(this.leafletMap);

    const color = this.typeColor(this.sig.type);
    const emoji = this.typeEmoji(this.sig.type);

    const icon = L.divIcon({
      html: `
        <div style="position:relative;width:36px;height:36px">
          <div style="
            position:absolute;inset:-6px;border-radius:50%;
            border:2px solid ${color};
            animation:sp-pulse 2s ease-out infinite;opacity:.45;
          "></div>
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:${color};border:3px solid white;
            box-shadow:0 4px 16px ${color}55;
            display:flex;align-items:center;justify-content:center;
            font-size:16px;
          ">${emoji}</div>
        </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      className: '',
    });

    L.marker([this.sig.latitude, this.sig.longitude], { icon })
      .addTo(this.leafletMap);

    // Circle radius 150m
    L.circle([this.sig.latitude, this.sig.longitude], {
      radius: 150,
      color: color,
      fillColor: color,
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '4 4',
    }).addTo(this.leafletMap);

    setTimeout(() => {
      try { this.leafletMap?.invalidateSize(); } catch (_) {}
    }, 100);
  }

  private _destroyMap(): void {
    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }
  }

  private _doClose(): void {
    this._destroyMap();
    this._lockScroll(false);
    this.closed.emit();
  }

  private _lockScroll(lock: boolean): void {
    document.body.style.overflow = lock ? 'hidden' : '';
  }
}
