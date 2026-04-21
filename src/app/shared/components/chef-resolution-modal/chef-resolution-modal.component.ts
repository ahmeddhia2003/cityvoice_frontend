import {
  Component, Input, OnChanges, SimpleChanges, Output, EventEmitter,
  OnDestroy, NgZone, ChangeDetectorRef, ElementRef,
} from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { SignalementService } from '../../../core/services/signalement.service';

declare const gsap: any;

interface ResolutionState {
  sigId:        number;
  sigType:      string;
  sigDesc:      string;
  photoAvant:   string | null;
  photoApres:   string | null;
  commentaire:  string;
  loading:      boolean;
  done:         boolean;
  rapport:      string;
  resoluIA:     boolean;
  confiance:    number;
  observations: string;
}

@Component({
  selector:    'app-chef-resolution-modal',
  templateUrl: './chef-resolution-modal.component.html',
  styleUrls:   ['./chef-resolution-modal.component.css'],
})
export class ChefResolutionModalComponent implements OnChanges, OnDestroy {

  @Input({ required: true }) signalement!: any;

  @Output() closed       = new EventEmitter<void>();
  @Output() resolved     = new EventEmitter<void>();
  @Output() notifyError  = new EventEmitter<string>();

  readonly fileInputId = 'photo-apres-' + Math.random().toString(36).slice(2, 10);

  resolution: ResolutionState = this._empty();

  private chefId = '';

  constructor(
    private auth:   AuthService,
    private sigSvc: SignalementService,
    private zone:   NgZone,
    private cd:     ChangeDetectorRef,
    private host:   ElementRef<HTMLElement>,
  ) {
    this.chefId = this.auth.getCurrentUser()?.userId ?? '';
  }

  ngOnChanges(c: SimpleChanges): void {
    if (c['signalement'] && this.signalement) {
      this._bootstrap(this.signalement);
      setTimeout(() => this._animateEnter(), 80);
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  private _bootstrap(sig: any): void {
    const photoAvant = sig.mediaUrls?.length ? sig.mediaUrls[0] : null;
    this.resolution = {
      sigId:        sig.id,
      sigType:      sig.type ?? '',
      sigDesc:      sig.description ?? '',
      photoAvant,
      photoApres:   null,
      commentaire:  '',
      loading:      false,
      done:         false,
      rapport:      '',
      resoluIA:     false,
      confiance:    0,
      observations: '',
    };
    document.body.style.overflow = 'hidden';
  }

  onBackdropClick(): void {
    if (this.resolution.loading) return;
    this._emitClose();
  }

  tryClose(): void {
    if (this.resolution.loading) return;
    this._emitClose();
  }

  removePhotoApres(): void {
    this.resolution.photoApres = null;
  }

  closeAfterSuccess(): void {
    this._emitClose();
  }

  private _emitClose(): void {
    document.body.style.overflow = '';
    this.closed.emit();
  }

  onPhotoApresChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.notifyError.emit('Image trop grande (max 5 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => this.zone.run(() => {
      this.resolution.photoApres = e.target?.result as string;
      this.cd.detectChanges();
      setTimeout(() => this._animatePhotoIn('.ce-res-photo-frame--upload img'), 30);
    });
    reader.readAsDataURL(file);
  }

  confirmerResolution(): void {
    if (!this.resolution.photoApres) {
      this.notifyError.emit('Veuillez uploader une photo « après ».');
      return;
    }
    if (!this.chefId) {
      this.notifyError.emit('Session expirée — reconnectez-vous.');
      return;
    }
    this.resolution.loading = true;
    this.cd.detectChanges();
    this._animateLoading();
    this.sigSvc.resoudreParChef(
      this.resolution.sigId,
      this.resolution.photoApres,
      this.resolution.commentaire,
      this.chefId
    ).subscribe({
      next: (res: {
        rapport: string;
        resoluIA: boolean;
        scoreConfiance?: number;
        observations?: string;
      }) => this.zone.run(() => {
        this.resolution.loading       = false;
        this.resolution.done          = true;
        this.resolution.rapport       = res.rapport;
        this.resolution.resoluIA      = res.resoluIA;
        this.resolution.confiance     = Math.round((res.scoreConfiance ?? 0.85) * 100);
        this.resolution.observations  = res.observations ?? '';
        this.resolved.emit();
        this._animateSuccess();
        this.cd.detectChanges();
      }),
      error: () => this.zone.run(() => {
        this.resolution.loading = false;
        this.notifyError.emit('Erreur lors de la résolution.');
        this.cd.detectChanges();
      }),
    });
  }

  private _empty(): ResolutionState {
    return {
      sigId: 0, sigType: '', sigDesc: '', photoAvant: null, photoApres: null,
      commentaire: '', loading: false, done: false, rapport: '',
      resoluIA: false, confiance: 0, observations: '',
    };
  }

  private _animateEnter(): void {
    if (typeof gsap === 'undefined') return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.crm-root .ce-res-compare',
      { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .45 }, 0.1);
    tl.fromTo('.crm-root .ce-res-col',
      { scale: .95, opacity: 0 },
      { scale: 1, opacity: 1, duration: .38, stagger: .12 }, 0.2);
    tl.fromTo('.crm-root .ce-ai-badge',
      { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .35 }, 0.4);
    tl.fromTo('.crm-root .ce-res-sig-info',
      { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .35 }, 0.5);
    tl.fromTo('.crm-root .ce-field, .crm-root .ce-btn-confirm',
      { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .3, stagger: .08 }, 0.55);
  }

  private _animatePhotoIn(selector: string): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo(selector,
      { scale: .88, opacity: 0 },
      { scale: 1, opacity: 1, duration: .4, ease: 'back.out(1.5)' });
  }

  private _animateLoading(): void {
    if (typeof gsap === 'undefined') return;
    gsap.to('.crm-root .ce-loading-orb', {
      rotation: 360, duration: 1.2, ease: 'none', repeat: -1,
    });
    gsap.to('.crm-root .ce-loading-orb-inner', {
      scale: 1.15, duration: .6, ease: 'sine.inOut', yoyo: true, repeat: -1,
    });
  }

  private _animateSuccess(): void {
    if (typeof gsap === 'undefined') return;
    const tl = gsap.timeline();
    tl.fromTo('.crm-root .res-result-card',
      { scale: .88, opacity: 0, y: 24 },
      { scale: 1, opacity: 1, y: 0, duration: .55, ease: 'back.out(1.8)' });
    tl.fromTo('.crm-root .res-status-icon',
      { scale: 0, rotation: -45, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: .45, ease: 'back.out(2.2)' }, '-=.3');
    tl.fromTo('.crm-root .res-score-bar-fill',
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: .9, ease: 'expo.out' }, '-=.2');
    tl.fromTo('.crm-root .res-section',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: .35, stagger: .1, ease: 'power2.out' }, '-=.4');
    tl.fromTo('.crm-root .res-photo-col:first-child',
      { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: .4, ease: 'power3.out' }, '-=.2');
    tl.fromTo('.crm-root .res-photo-col:last-child',
      { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: .4, ease: 'power3.out' }, '-=.35');
    if (this.resolution.resoluIA) {
      tl.add(() => this._burstParticles(), '-=.3');
    }
    tl.fromTo('.crm-root .res-back-btn',
      { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: .3 }, '-=.1');
  }

  private _burstParticles(): void {
    if (typeof gsap === 'undefined') return;
    const container = this.host.nativeElement.querySelector('.res-particles');
    if (!container) return;
    const colors = ['#0D9B76', '#3B82F6', '#C9973E', '#E8532A', '#7C3AED'];
    for (let i = 0; i < 28; i++) {
      const dot = document.createElement('div');
      dot.className = 'res-particle';
      dot.style.background = colors[i % colors.length];
      container.appendChild(dot);
      const angle  = (i / 28) * 360;
      const radius = 60 + Math.random() * 80;
      const rad    = angle * (Math.PI / 180);
      const tx     = Math.cos(rad) * radius;
      const ty     = Math.sin(rad) * radius;
      const size   = 5 + Math.random() * 7;
      gsap.set(dot, {
        x: 0, y: 0, width: size, height: size, borderRadius: '50%',
        position: 'absolute', top: '50%', left: '50%', opacity: 1,
      });
      gsap.to(dot, {
        x: tx, y: ty, opacity: 0, scale: 0,
        duration: .7 + Math.random() * .5,
        ease: 'power2.out',
        delay: Math.random() * .15,
        onComplete: () => dot.remove(),
      });
    }
  }
}
