import {
  Component, OnInit, OnDestroy, Output, EventEmitter, Input,
  ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { HolidayService, TunisianHoliday, HolidayType } from '../../../core/services/holiday.service';

declare const gsap: any;

// ── Confetti particle ───────────────────────────────────────────────────────
interface Confetti {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  rotation: number;
  rotSpeed: number;
  shape: 'rect' | 'circle' | 'star';
  alpha: number;
}

// Color palettes by holiday type
const PALETTES: Record<HolidayType, string[]> = {
  national:  ['#E4002B', '#FFFFFF', '#C0392B', '#F1C40F', '#BDC3C7'],
  eid_fitr:  ['#10B981', '#F59E0B', '#FFFFFF', '#34D399', '#FCD34D', '#6EE7B7'],
  eid_adha:  ['#D97706', '#FFFFFF', '#F59E0B', '#92400E', '#FDE68A'],
  islamic:   ['#10B981', '#F59E0B', '#FFFFFF', '#059669'],
};

@Component({
  selector:    'app-festive-banner',
  templateUrl: './festive-banner.component.html',
  styleUrls:   ['./festive-banner.component.css'],
})
export class FestiveBannerComponent implements OnInit, AfterViewInit, OnDestroy {

  private _weatherBannerHeight = 0;
  @Input() set weatherBannerHeight(val: number) {
    this._weatherBannerHeight = val;
    // Re-emit height so parent recalculates total offset
    if (this.holiday && !this.dismissed) {
      setTimeout(() => this._emitHeight(), 0);
    }
  }
  get weatherBannerHeight(): number { return this._weatherBannerHeight; }
  @Output() heightChange = new EventEmitter<number>();
  @ViewChild('confettiCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  holiday:   TunisianHoliday | null = null;
  dismissed  = false;

  private ctx:      CanvasRenderingContext2D | null = null;
  private confetti: Confetti[] = [];
  private raf:      number | null = null;
  private palette:  string[] = [];

  constructor(
    private holidayService: HolidayService,
    private router:         Router,
    private cdr:            ChangeDetectorRef,
    private el:             ElementRef,
  ) {}

  ngOnInit(): void {
    // Démo synchro (URL ?demo=…) — pour pouvoir tester même hors-ligne
    const demo = this.holidayService.getTodayHoliday();
    if (demo) {
      this.holiday = demo;
      this.cdr.detectChanges();
      return;
    }

    // Sinon on appelle l'API date.nager.at (async)
    this.holidayService.getTodayHoliday$().subscribe(h => {
      this.holiday = h;
      this.cdr.detectChanges();
      if (h) {
        this._emitHeight();
        setTimeout(() => {
          this._animateBanner();
          this._startConfetti();
        }, 120);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.holiday) {
      this._emitHeight();
      setTimeout(() => {
        this._animateBanner();
        this._startConfetti();
      }, 120);
    }
  }

  ngOnDestroy(): void {
    this._stopConfetti();
    this.heightChange.emit(0);
  }

  // ── Public ───────────────────────────────────────────────────────────────
  dismiss(): void {
    this._stopConfetti();
    if (typeof gsap !== 'undefined') {
      gsap.to('.fb-banner', {
        y: -8, opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0,
        duration: .3, ease: 'power2.in',
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

  shareCivic(): void {
    this.router.navigate(['/signaler/choix']);
  }

  // ── Banner animation ─────────────────────────────────────────────────────
  private _animateBanner(): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo('.fb-banner',
      { y: -60, opacity: 0 },
      { y: 0, opacity: 1, duration: .7, ease: 'back.out(1.4)' }
    );
    gsap.fromTo('.fb-emoji',
      { scale: 0, rotation: -20 },
      { scale: 1, rotation: 0, duration: .6, ease: 'back.out(2)', delay: .25 }
    );
  }

  private _emitHeight(): void {
    const banner = this.el.nativeElement.querySelector('.fb-banner');
    this.heightChange.emit(banner ? (banner as HTMLElement).offsetHeight : 0);
  }

  // ── Confetti ─────────────────────────────────────────────────────────────
  private _startConfetti(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d');
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this.palette = this.holiday ? PALETTES[this.holiday.type] ?? PALETTES.national : PALETTES.national;

    // Spawn initial burst
    this._spawnBurst(60);

    // Keep spawning slowly
    this._confettiLoop();
  }

  private _spawnBurst(count: number): void {
    const W = this.canvasRef?.nativeElement.width  ?? window.innerWidth;
    for (let i = 0; i < count; i++) {
      this.confetti.push(this._makeConfetti(Math.random() * W));
    }
  }

  private _makeConfetti(x: number): Confetti {
    const shapes: Confetti['shape'][] = ['rect', 'circle', 'star'];
    return {
      x,
      y:        -10 - Math.random() * 30,
      vx:       (Math.random() - .5) * 3,
      vy:       2 + Math.random() * 3,
      color:    this.palette[Math.floor(Math.random() * this.palette.length)],
      size:     4 + Math.random() * 7,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - .5) * 8,
      shape:    shapes[Math.floor(Math.random() * shapes.length)],
      alpha:    0.7 + Math.random() * 0.3,
    };
  }

  private _confettiLoop(): void {
    if (!this.ctx || !this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const W = canvas.width;
    const H = canvas.height;

    this.ctx.clearRect(0, 0, W, H);

    // Occasionally spawn new confetti
    if (Math.random() < 0.18) {
      this.confetti.push(this._makeConfetti(Math.random() * W));
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x        += c.vx;
      c.y        += c.vy;
      c.rotation += c.rotSpeed;
      c.vy       *= 0.998; // slight drag

      if (c.y > H + 20) {
        this.confetti.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = c.alpha;
      this.ctx.fillStyle   = c.color;
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate((c.rotation * Math.PI) / 180);

      if (c.shape === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      } else if (c.shape === 'rect') {
        this.ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
      } else {
        // Star
        this._drawStar(this.ctx, c.size * .6);
      }

      this.ctx.restore();
    }

    this.raf = requestAnimationFrame(() => this._confettiLoop());
  }

  private _drawStar(ctx: CanvasRenderingContext2D, r: number): void {
    const pts = 5;
    const inner = r * 0.4;
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const angle  = (i * Math.PI) / pts - Math.PI / 2;
      const radius = i % 2 === 0 ? r : inner;
      if (i === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      else          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
  }

  private _resizeCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const banner = this.el.nativeElement.querySelector('.fb-banner') as HTMLElement;
    canvas.width  = banner?.offsetWidth  ?? window.innerWidth;
    canvas.height = banner?.offsetHeight ?? 80;
  }

  private _stopConfetti(): void {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    this.confetti = [];
  }
}
