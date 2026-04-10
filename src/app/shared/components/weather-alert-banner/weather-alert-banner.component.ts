import {
  Component, OnInit, OnDestroy, Output, EventEmitter,
  ChangeDetectorRef, ElementRef, AfterViewInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { WeatherService, WeatherAlert, WeatherLevel } from '../../../core/services/weather.service';
import { Subscription } from 'rxjs';

declare const gsap: any;

// ── Rain drop particle ─────────────────────────────────────────────────────
interface Drop {
  x: number; y: number;
  len: number; speed: number;
  opacity: number; width: number;
}

@Component({
  selector: 'app-weather-alert-banner',
  templateUrl: './weather-alert-banner.component.html',
  styleUrls:   ['./weather-alert-banner.component.css'],
})
export class WeatherAlertBannerComponent implements OnInit, AfterViewInit, OnDestroy {

  @Output() typeSelected = new EventEmitter<string>();
  @Output() heightChange = new EventEmitter<number>();

  alert:    WeatherAlert | null = null;
  visible   = false;
  dismissed = false;
  expanded  = false;

  private sub?: Subscription;

  // Canvas rain
  private canvas:  HTMLCanvasElement | null = null;
  private ctx:     CanvasRenderingContext2D | null = null;
  private drops:   Drop[] = [];
  private raf:     number | null = null;
  private angle    = 5;   // degrees of tilt
  private lightning: HTMLDivElement | null = null;
  private lightningTimer: any = null;

  constructor(
    private weather: WeatherService,
    private router:  Router,
    private cdr:     ChangeDetectorRef,
    private el:      ElementRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.weather.getAlert().subscribe(a => {
      this.alert = a;
      this.visible = !!a;
      this.cdr.detectChanges();
      if (a) {
        setTimeout(() => {
          this._animateBanner();
          this._emitHeight();
          this._startWeatherFx(a.level);
        }, 80);
      } else {
        this.heightChange.emit(0);
      }
    });
  }

  ngAfterViewInit(): void { this._emitHeight(); }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.heightChange.emit(0);
    this._stopWeatherFx();
  }

  // ── Public ───────────────────────────────────────────────────────────────
  dismiss(): void {
    this._stopWeatherFx();
    if (typeof gsap !== 'undefined') {
      gsap.to('.wab-banner', {
        y: -8, opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0,
        duration: .35, ease: 'power2.in',
        onComplete: () => {
          this.dismissed = true;
          this.heightChange.emit(0);
          this.cdr.detectChanges();
        },
      });
    } else {
      this.dismissed = true;
      this.heightChange.emit(0);
    }
  }

  toggleExpanded(): void { this.expanded = !this.expanded; }

  selectType(code: string): void {
    this.typeSelected.emit(code);
    this.router.navigate(['/signaler/new'], { queryParams: { type: code } });
  }

  goSignaler(): void { this.router.navigate(['/signaler/choix']); }

  // ── Banner animation ─────────────────────────────────────────────────────
  private _animateBanner(): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo('.wab-banner',
      { y: -70, opacity: 0 },
      { y: 0, opacity: 1, duration: .6, ease: 'back.out(1.4)' }
    );
    gsap.fromTo('.wab-chip',
      { opacity: 0, y: 10, scale: .85 },
      { opacity: 1, y: 0, scale: 1, duration: .35, stagger: .08,
        ease: 'back.out(1.6)', delay: .5 }
    );
    gsap.fromTo('.wab-icon-wrap',
      { rotation: -15, scale: .6, opacity: 0 },
      { rotation: 0, scale: 1, opacity: 1, duration: .5, ease: 'back.out(2)', delay: .2 }
    );
  }

  private _emitHeight(): void {
    const banner = this.el.nativeElement.querySelector('.wab-banner');
    this.heightChange.emit(banner ? (banner as HTMLElement).offsetHeight : 0);
  }

  // ── Weather FX ───────────────────────────────────────────────────────────
  private _startWeatherFx(level: WeatherLevel): void {
    if (!level) return;
    if (level === 'fog')  { this._startFog(); return; }
    if (level === 'heat') { this._startHeatShimmer(); return; }
    this._startRain(level);
    if (level === 'storm') this._startLightning();
  }

  private _stopWeatherFx(): void {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    if (this.canvas) { this.canvas.remove(); this.canvas = null; }
    if (this.lightning) { this.lightning.remove(); this.lightning = null; }
    if (this.lightningTimer) { clearTimeout(this.lightningTimer); this.lightningTimer = null; }
    // Remove fog/heat overlay if any
    document.querySelector('.wab-fog-overlay')?.remove();
    document.querySelector('.wab-heat-overlay')?.remove();
  }

  // ── Rain canvas ──────────────────────────────────────────────────────────
  private _startRain(level: WeatherLevel): void {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:48;';
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    // Configure by level
    const isStorm = level === 'storm';
    const isWind  = level === 'wind';
    this.angle = isWind ? 35 : isStorm ? 20 : 8;
    const count  = isStorm ? 280 : isWind ? 200 : 140;
    const minLen = isStorm ? 14 : isWind ? 6  : 10;
    const maxLen = isStorm ? 32 : isWind ? 18 : 22;
    const minSpd = isStorm ? 14 : isWind ? 18 : 7;
    const maxSpd = isStorm ? 26 : isWind ? 32 : 14;
    const minOpa = isStorm ? .3  : isWind ? .15 : .18;
    const maxOpa = isStorm ? .55 : isWind ? .35 : .38;

    const W = this.canvas.width;
    const H = this.canvas.height;
    this.drops = Array.from({ length: count }, () => ({
      x:       Math.random() * (W + 200) - 100,
      y:       Math.random() * H,
      len:     minLen + Math.random() * (maxLen - minLen),
      speed:   minSpd + Math.random() * (maxSpd - minSpd),
      opacity: minOpa + Math.random() * (maxOpa - minOpa),
      width:   isStorm ? .9 + Math.random() * .8 : .5 + Math.random() * .6,
    }));

    this._rainLoop();
  }

  private _rainLoop(): void {
    if (!this.ctx || !this.canvas) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const rad = (this.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);

    this.ctx.clearRect(0, 0, W, H);

    for (const d of this.drops) {
      this.ctx.beginPath();
      this.ctx.moveTo(d.x, d.y);
      this.ctx.lineTo(d.x - d.len * dx, d.y - d.len * dy);
      this.ctx.strokeStyle = `rgba(180,210,255,${d.opacity})`;
      this.ctx.lineWidth = d.width;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();

      d.x += d.speed * dx;
      d.y += d.speed * dy;

      if (d.y > H + 30 || d.x > W + 30) {
        d.x = Math.random() * (W + 200) - 200;
        d.y = -d.len - Math.random() * 60;
      }
    }

    this.raf = requestAnimationFrame(() => this._rainLoop());
  }

  private _resizeCanvas(): void {
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // ── Lightning (storm only) ───────────────────────────────────────────────
  private _startLightning(): void {
    this.lightning = document.createElement('div');
    this.lightning.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:47;'
      + 'background:rgba(220,230,255,0);transition:none;';
    document.body.appendChild(this.lightning);
    this._scheduleLightning();
  }

  private _scheduleLightning(): void {
    const delay = 2500 + Math.random() * 5000;
    this.lightningTimer = setTimeout(() => {
      if (!this.lightning) return;
      if (typeof gsap !== 'undefined') {
        // Double flash like real lightning
        gsap.timeline()
          .to(this.lightning, { background: 'rgba(220,230,255,0.35)', duration: .06 })
          .to(this.lightning, { background: 'rgba(220,230,255,0)',    duration: .08 })
          .to(this.lightning, { background: 'rgba(220,230,255,0.22)', duration: .05 })
          .to(this.lightning, { background: 'rgba(220,230,255,0)',    duration: .18 });
      }
      this._scheduleLightning();
    }, delay);
  }

  // ── Heat shimmer ─────────────────────────────────────────────────────────
  private _startHeatShimmer(): void {
    const heat = document.createElement('div');
    heat.className = 'wab-heat-overlay';
    heat.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:48;overflow:hidden;';

    // Wavy heat distortion bands
    for (let i = 0; i < 8; i++) {
      const band = document.createElement('div');
      const topPct = 10 + i * 11;
      band.style.cssText = `
        position:absolute;
        left:0; right:0;
        top:${topPct}%;
        height:${4 + Math.random() * 4}px;
        background:linear-gradient(90deg,
          transparent 0%,
          rgba(255,160,50,0.04) 30%,
          rgba(255,80,0,0.06) 50%,
          rgba(255,160,50,0.04) 70%,
          transparent 100%);
        filter:blur(${2 + Math.random() * 3}px);
        border-radius:50%;
      `;
      heat.appendChild(band);

      if (typeof gsap !== 'undefined') {
        gsap.to(band, {
          scaleX: 0.85 + Math.random() * 0.3,
          y: (Math.random() - 0.5) * 18,
          opacity: 0.3 + Math.random() * 0.6,
          duration: 1.5 + Math.random() * 2,
          repeat: -1, yoyo: true,
          ease: 'sine.inOut',
          delay: Math.random() * 2,
        });
      }
    }

    // Heat particles (rising hot air dots)
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      const size = 3 + Math.random() * 5;
      const leftPct = Math.random() * 100;
      const startBottom = Math.random() * 30;
      p.style.cssText = `
        position:absolute;
        width:${size}px; height:${size}px;
        border-radius:50%;
        background:rgba(255,${100 + Math.floor(Math.random() * 100)},0,0.12);
        filter:blur(${1 + Math.random() * 2}px);
        left:${leftPct}%;
        bottom:${startBottom}%;
      `;
      heat.appendChild(p);

      if (typeof gsap !== 'undefined') {
        gsap.to(p, {
          y: -(200 + Math.random() * 400),
          x: (Math.random() - 0.5) * 80,
          opacity: 0,
          duration: 3 + Math.random() * 4,
          repeat: -1,
          delay: Math.random() * 4,
          ease: 'power1.out',
          onRepeat() {
            gsap.set(p, { y: 0, x: 0, opacity: 0.12 + Math.random() * 0.1 });
          },
        });
      }
    }

    document.body.appendChild(heat);
  }

  // ── Fog overlay ──────────────────────────────────────────────────────────
  private _startFog(): void {
    const fog = document.createElement('div');
    fog.className = 'wab-fog-overlay';
    fog.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:48;overflow:hidden;';

    // Create floating fog particles
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      const size = 180 + Math.random() * 280;
      p.style.cssText = `
        position:absolute;
        width:${size}px; height:${size * .5}px;
        border-radius:50%;
        background:rgba(200,210,220,0.07);
        filter:blur(${30 + Math.random() * 40}px);
        left:${Math.random() * 110 - 10}%;
        top:${Math.random() * 100}%;
      `;
      fog.appendChild(p);

      if (typeof gsap !== 'undefined') {
        gsap.to(p, {
          x: (Math.random() - .5) * 300,
          y: (Math.random() - .5) * 120,
          opacity: .4 + Math.random() * .5,
          duration: 6 + Math.random() * 8,
          repeat: -1, yoyo: true,
          ease: 'sine.inOut',
          delay: Math.random() * 4,
        });
      }
    }
    document.body.appendChild(fog);
  }
}
