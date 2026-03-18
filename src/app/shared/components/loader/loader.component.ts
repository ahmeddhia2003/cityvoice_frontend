import {
  Component, AfterViewInit, OnDestroy, Output,
  EventEmitter, ElementRef, ViewChild,
  ChangeDetectionStrategy, ChangeDetectorRef, NgZone,
} from '@angular/core';

declare const gsap: any;

@Component({
  selector: 'app-loader',
  templateUrl: './loader.component.html',
  styleUrls: ['./loader.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoaderComponent implements AfterViewInit, OnDestroy {

  @Output() loadingComplete = new EventEmitter<void>();
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  pct        = 0;
  ringLabel  = 'Chargement';
  ringReady  = false;
  currentMsg = 'Initialisation du système';
  msgReady   = false;
  dots       = [false, false, false, false, false, false];

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private W = 0; private H = 0;
  private cx = 0; private cy = 0;

  private particles: any[] = [];
  private connections: any[] = [];
  private streets: any[] = [];
  private phase = 'scatter';
  private dataRainAlpha = 0;
  private streetAlpha   = 0;
  private connectionAlpha = 0;
  private scanY = -50;
  private scanActive = false;
  private scanAlpha  = 0;
  private frameCount = 0;
  private rafId = 0;
  private timeline: any;
  private msgIndex = 0;

  private dataColumns: any[] = [];
  private readonly dataChars = '01アイ2489';
  private readonly CORAL  = '#E8532A';
  private readonly TEAL   = '#0D9B76';
  private readonly CREAM  = '#ECE8E1';

  getTicks() { const t=[]; for(let i=0;i<60;i++){const a=(i/60)*Math.PI*2-Math.PI/2,l=i%5===0?8:4,r1=98,r2=r1-l;t.push({x1:+(100+Math.cos(a)*r1).toFixed(2),y1:+(100+Math.sin(a)*r1).toFixed(2),x2:+(100+Math.cos(a)*r2).toFixed(2),y2:+(100+Math.sin(a)*r2).toFixed(2),major:i%5===0});} return t; }

  private readonly MESSAGES = [
    'Initialisation du système',
    'Construction du réseau urbain',
    'Chargement des signalements',
    'Analyse IA en cours',
    'Synchronisation terrain',
    'Madina est prêt ✓',
  ];

  constructor(private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.onResize);

    this.ngZone.runOutsideAngular(() => {
      this.buildScene();
      setTimeout(() => this.buildConnections(), 120);
      this.loop();
      setTimeout(() => this.orchestrate(), 80);
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.rafId);
    this.timeline?.kill();
  }

  private onResize = () => this.resize();

  private resize(): void {
    this.W  = this.canvas.width  = window.innerWidth;
    this.H  = this.canvas.height = window.innerHeight;
    this.cx = this.W / 2;
    this.cy = this.H / 2;
  }

  // ── Particle ──────────────────────────────────────────────
  private randomColor(): string {
    const arr = [
      `rgba(13,155,118,${0.35+Math.random()*0.45})`,
      `rgba(232,83,42,${0.3+Math.random()*0.4})`,
      `rgba(59,130,246,${0.28+Math.random()*0.35})`,
      `rgba(201,151,62,${0.28+Math.random()*0.32})`,
      `rgba(236,232,225,${0.12+Math.random()*0.28})`,
    ];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private buildCityGrid() {
    const pos: any[] = [];
    const cols = 28, rows = 16;
    const sx = this.W * 0.72 / cols;
    const sy = this.H * 0.62 / rows;
    const ox = this.cx - (cols * sx) / 2;
    const oy = this.cy - (rows * sy) / 2 + 20;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r===4||r===9||r===13||c===6||c===14||c===21) continue;
        const dx = c/cols - 0.5, dy = r/rows - 0.5;
        if (Math.random() > 1 - Math.sqrt(dx*dx+dy*dy)*0.5) continue;
        pos.push({
          x: ox + c*sx + (Math.random()-.5)*4,
          y: oy + r*sy + (Math.random()-.5)*4,
          type: Math.random() < 0.05 ? 'pin' : 'node'
        });
      }
    }
    return pos;
  }

  private buildStreets(): void {
    this.streets = [];
    const rows = [0.28, 0.52, 0.72], cols = [0.22, 0.45, 0.68, 0.82];
    rows.forEach(ry => this.streets.push({
      x1: this.cx - this.W*.36, y1: this.cy + (ry-.5)*this.H*.6,
      x2: this.cx + this.W*.36, y2: this.cy + (ry-.5)*this.H*.6 + (Math.random()-.5)*20,
    }));
    cols.forEach(rx => this.streets.push({
      x1: this.cx + (rx-.5)*this.W*.72, y1: this.cy - this.H*.3,
      x2: this.cx + (rx-.5)*this.W*.72 + (Math.random()-.5)*10, y2: this.cy + this.H*.3,
    }));
    this.streets.push({ x1:this.cx-this.W*.3, y1:this.cy-this.H*.25, x2:this.cx+this.W*.1, y2:this.cy+this.H*.28 });
    this.streets.push({ x1:this.cx-this.W*.05, y1:this.cy-this.H*.28, x2:this.cx+this.W*.32, y2:this.cy+this.H*.22 });
  }

  private buildScene(): void {
    const grid = this.buildCityGrid();
    this.buildStreets();
    const count = Math.min(600, Math.floor(this.W * this.H / 3000));

    for (let i = 0; i < count; i++) {
      const pos = grid[i % grid.length];
      this.particles.push({
        x: this.cx + (Math.random()-.5)*this.W*2,
        y: this.cy + (Math.random()-.5)*this.H*2,
        tx: pos.x, ty: pos.y,
        r:  pos.type==='pin' ? 3.5 : Math.random()*1.5+0.5,
        color: pos.type==='pin' ? this.CORAL : this.randomColor(),
        alpha: 0,
        speed: 0.04 + Math.random()*0.06,
        twinkle: Math.random()*Math.PI*2,
        ts: 0.03+Math.random()*0.05,
      });
    }

    const colCount = Math.min(18, Math.floor(this.W / 60));
    for (let i = 0; i < colCount; i++) {
      this.dataColumns.push({
        x: Math.random()*this.W, y: Math.random()*this.H-this.H,
        speed: 0.8+Math.random()*1.5,
        char: this.dataChars[Math.floor(Math.random()*this.dataChars.length)],
        alpha: 0.3+Math.random()*0.4,
      });
    }
  }

  private buildConnections(): void {
    this.connections = [];
    const thr = Math.min(this.W, this.H) * 0.065;
    for (let i = 0; i < this.particles.length; i+=4) {
      for (let j = i+1; j < this.particles.length; j+=4) {
        const dx = this.particles[i].tx - this.particles[j].tx;
        const dy = this.particles[i].ty - this.particles[j].ty;
        const d  = Math.sqrt(dx*dx+dy*dy);
        if (d < thr) this.connections.push([i, j, 1-d/thr]);
      }
    }
  }

  // ── Render loop ──────────────────────────────────────────
  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    this.frameCount++;
    const ctx = this.ctx;

    ctx.fillStyle = '#060D1F';
    ctx.fillRect(0, 0, this.W, this.H);

    this.drawDataRain(ctx);
    this.drawStreets(ctx);
    this.drawConnections(ctx);
    this.drawScan(ctx);
    this.updateParticles();
    this.drawParticles(ctx);

    if (this.scanActive) {
      this.scanY += (this.H + 100) / 60;
      if (this.scanY > this.H + 60) this.scanActive = false;
    }
  };

  private updateParticles(): void {
    this.particles.forEach(p => {
      p.twinkle += p.ts;
      const tw = (Math.sin(p.twinkle)+1)*.5;
      if (this.phase === 'scatter') {
        p.x += (this.cx+(Math.random()-.5)*400-p.x)*.015;
        p.y += (this.cy+(Math.random()-.5)*300-p.y)*.015;
        p.alpha = Math.min(p.alpha+.025, .6+tw*.3);
      } else if (this.phase === 'converge') {
        p.x += (p.tx-p.x)*p.speed;
        p.y += (p.ty-p.y)*p.speed;
        p.alpha = Math.min(p.alpha+.03, .7+tw*.25);
      } else if (this.phase === 'city') {
        p.x += Math.sin(p.twinkle*.4)*.3;
        p.y += Math.cos(p.twinkle*.5)*.3;
        p.alpha = .5+tw*.4;
      } else if (this.phase === 'exit') {
        p.x += (p.x-this.cx)*.04+(Math.random()-.5)*3;
        p.y += (p.y-this.cy)*.04+(Math.random()-.5)*3;
        p.alpha = Math.max(0, p.alpha-.03);
      }
    });
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach(p => {
      if (p.alpha<=0) return;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = p.r*3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }

  private drawStreets(ctx: CanvasRenderingContext2D): void {
    if (this.streetAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.streetAlpha * .12;
    ctx.strokeStyle = this.CREAM;
    ctx.lineWidth = 1.5;
    this.streets.forEach(s => {
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
    });
    ctx.restore();
  }

  private drawConnections(ctx: CanvasRenderingContext2D): void {
    if (this.connectionAlpha<=0 || !this.connections.length) return;
    ctx.save();
    this.connections.forEach(([i,j,str]) => {
      const a = this.particles[i], b = this.particles[j];
      if (!a||!b) return;
      ctx.globalAlpha = this.connectionAlpha*str*.18;
      ctx.strokeStyle = this.TEAL;
      ctx.lineWidth   = 0.5;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    });
    ctx.restore();
  }

  private drawScan(ctx: CanvasRenderingContext2D): void {
    if (!this.scanActive || this.scanAlpha<=0) return;
    ctx.save();
    const grad = ctx.createLinearGradient(0,this.scanY-60,0,this.scanY+20);
    grad.addColorStop(0,'rgba(13,155,118,0)');
    grad.addColorStop(0.7,`rgba(13,155,118,${.06*this.scanAlpha})`);
    grad.addColorStop(1,`rgba(13,155,118,${.12*this.scanAlpha})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0,this.scanY-60,this.W,80);
    ctx.strokeStyle=`rgba(13,155,118,${.7*this.scanAlpha})`;
    ctx.lineWidth=1.5; ctx.shadowColor=this.TEAL; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(0,this.scanY); ctx.lineTo(this.W,this.scanY); ctx.stroke();
    ctx.restore();
  }

  private drawDataRain(ctx: CanvasRenderingContext2D): void {
    if (this.dataRainAlpha<=0) return;
    ctx.save();
    ctx.font='11px monospace';
    ctx.fillStyle=this.TEAL;
    this.dataColumns.forEach(col => {
      ctx.globalAlpha=this.dataRainAlpha*col.alpha*.5;
      ctx.fillText(col.char,col.x,col.y);
      col.y+=col.speed;
      if (Math.random()<.04) col.char=this.dataChars[Math.floor(Math.random()*this.dataChars.length)];
      if (col.y>this.H+20) col.y=-20;
    });
    ctx.restore();
  }

  // ── GSAP orchestration ───────────────────────────────────
  private orchestrate(): void {
    if (typeof gsap === 'undefined') {
      setTimeout(() => this.loadingComplete.emit(), 1000);
      return;
    }

    // ── Ring SVG references ──────────────────────────────
    const ring1C = 565, ring2C = 477, ring3C = 389;
    const rf1 = document.querySelector('.ld-rf1') as SVGCircleElement;
    const rf2 = document.querySelector('.ld-rf2') as SVGCircleElement;
    const rf3 = document.querySelector('.ld-rf3') as SVGCircleElement;

    const setRing = (pct: number) => {
      if (rf1) rf1.style.strokeDashoffset = String(ring1C - (pct / 100) * ring1C);
      if (rf2) rf2.style.strokeDashoffset = String(ring2C - (Math.max(0, pct - 15) * 1.18 / 100) * ring2C);
      if (rf3) rf3.style.strokeDashoffset = String(ring3C - (Math.max(0, pct - 30) * 1.43 / 100) * ring3C);
      this.pct = Math.round(pct);
      this.cdr.markForCheck();
    };

    // ── Helper: animate ring progress ───────────────────
    // CORRECT pattern: capture target object in a const,
    // use arrow function so `this` stays the Angular component
    const animRing = (from: number, to: number, duration: number) => {
      const obj = { v: from };
      gsap.to(obj, {
        v: to,
        duration,
        ease: 'power1.out',
        onUpdate: () => setRing(obj.v),   // ← arrow fn + closure var
      });
    };

    // ── Helper: message swap ─────────────────────────────
    const msg = (idx: number, delay: number) => {
      this.timeline.call(() => {
        this.ngZone.run(() => {
          gsap.to('.ld-msg-text', {
            opacity: 0, y: -8, duration: .2, ease: 'power2.in',
            onComplete: () => {
              this.currentMsg = this.MESSAGES[idx];
              this.msgReady = idx === this.MESSAGES.length - 1;
              this.cdr.markForCheck();
              gsap.fromTo('.ld-msg-text',
                { opacity: 0, y: 8 },
                { opacity: 1, y: 0, duration: .3, ease: 'power2.out' }
              );
            }
          });
        });
      }, [], delay);
    };

    // ── Helper: activate progress dot ───────────────────
    const dot = (i: number, delay: number) => {
      this.timeline.call(() => {
        this.ngZone.run(() => {
          this.dots[i] = true;
          this.cdr.markForCheck();
        });
      }, [], delay);
    };

    // ── Build master timeline ────────────────────────────
    this.timeline = gsap.timeline({
      onComplete: () => { this.ngZone.run(() => this.loadingComplete.emit()); }
    });
    const tl = this.timeline;

    // ─── PHASE 0 : data rain scatter (0 → 0.9s) ─────────
    tl.call(() => {
      const o = { v: 0 };
      gsap.to(o, {
        v: 1, duration: .8, ease: 'power2.in',
        onUpdate: () => { this.dataRainAlpha = o.v * .6; },  // ← fixed
      });
    }, [], '0');

    tl.to('.ld-glitch', { opacity: 1, duration: .06 }, .15);
    tl.to('.ld-glitch', { opacity: 0, duration: .08 }, .21);
    tl.to('.ld-glitch', { opacity: .6, duration: .04 }, .34);
    tl.to('.ld-glitch', { opacity: 0, duration: .06 }, .38);

    tl.to('.ld-ring',      { opacity: 1, duration: .5, ease: 'power2.out' }, .3);
    tl.to('.ld-msg-wrap',  { opacity: 1, duration: .4 }, .5);
    tl.to('.ld-dots-row',  { opacity: 1, duration: .4 }, .6);

    tl.call(() => { animRing(0, 18, .85); dot(0, .01); }, [], .4);

    // ─── PHASE 1 : converge to city grid (0.9 → 1.85s) ──
    tl.call(() => {
      this.phase = 'converge';

      const oRain = { v: .6 };
      gsap.to(oRain, {
        v: 0, duration: .6, ease: 'power2.out',
        onUpdate: () => { this.dataRainAlpha = oRain.v; },   // ← fixed
      });

      const oStreet = { v: 0 };
      gsap.to(oStreet, {
        v: 1, duration: .8, ease: 'power2.out',
        onUpdate: () => { this.streetAlpha = oStreet.v; },   // ← fixed
      });

      animRing(18, 42, .9);
    }, [], .9);

    msg(1, 1.0); dot(1, 1.0);

    // ─── PHASE 2 : city stable + connections (1.85 → 2.1s) ─
    tl.call(() => {
      this.phase = 'city';

      const oCon = { v: 0 };
      gsap.to(oCon, {
        v: 1, duration: .7, ease: 'power2.out',
        onUpdate: () => { this.connectionAlpha = oCon.v; },  // ← fixed
      });

      animRing(42, 65, .7);
    }, [], 1.85);

    msg(2, 1.85); dot(2, 1.85);

    tl.to('.ld-glitch', { opacity: .8, duration: .05 }, 2.0);
    tl.to('.ld-glitch', { opacity: 0,  duration: .07 }, 2.05);

    // ─── PHASE 3 : scan wave (2.1 → 2.65s) ──────────────
    tl.call(() => {
      this.scanY = -30;
      this.scanActive = true;
      this.scanAlpha = 1;
      animRing(65, 82, .65);
    }, [], 2.1);

    msg(3, 2.1); dot(3, 2.1);

    // Logo burst in
    tl.to('.ld-logo-wrap', { opacity: 1, scale: 1, duration: .55, ease: 'back.out(1.8)' }, 2.2);
    tl.to('.ld-logo-text', { clipPath: 'inset(0 0% 0 0)', duration: .7, ease: 'power3.out' }, 2.35);
    tl.to('.ld-logo-sub',  { opacity: 1, duration: .4 }, 2.7);

    // ─── PHASE 4 : pin pulse + 100% (2.65 → 3.0s) ───────
    tl.call(() => {
      this.particles.forEach(p => {
        if (p.color === this.CORAL && Math.random() < .15) {
          gsap.to(p, { r: p.r * 2.5, duration: .3, yoyo: true, repeat: 3,
            ease: 'sine.inOut', delay: Math.random() * .4 });
        }
      });
      animRing(82, 100, .55);
    }, [], 2.65);

    msg(4, 2.65); dot(4, 2.65);

    tl.call(() => {
      this.ngZone.run(() => {
        this.ringLabel = 'Prêt';
        this.ringReady = true;
        this.cdr.markForCheck();
        msg(5, 0); dot(5, 0);
      });
      gsap.to('.ld-logo-icon', {
        boxShadow: '0 0 50px rgba(232,83,42,.7), 0 0 100px rgba(232,83,42,.3)',
        duration: .4, yoyo: true, repeat: 1, ease: 'sine.inOut',
      });
    }, [], 3.0);

    // ─── PHASE 5 : portal exit (3.25 → 4.0s) ────────────
    tl.call(() => {
      this.phase = 'exit';
      this.connectionAlpha = 0;
      this.streetAlpha = 0;
      this.scanAlpha = 0;
    }, [], 3.25);

    tl.to(['.ld-ring', '.ld-msg-wrap', '.ld-dots-row', '.ld-logo-wrap'], {
      opacity: 0, scale: .9, duration: .4, ease: 'power2.in', stagger: .04,
    }, 3.25);

    // Triple glitch burst
    tl.to('.ld-glitch', { opacity: 1, duration: .04 }, 3.3);
    tl.to('.ld-glitch', { opacity: 0, duration: .04 }, 3.34);
    tl.to('.ld-glitch', { opacity: 1, duration: .03 }, 3.37);
    tl.to('.ld-glitch', { opacity: 0, duration: .05 }, 3.4);

    // Portal circle expands from center
    tl.call(() => {
      const maxR = Math.sqrt(this.W * this.W + this.H * this.H);
      gsap.to('.ld-portal', {
        width:      maxR * 2.2 + 'px',
        height:     maxR * 2.2 + 'px',
        marginLeft: -(maxR * 1.1) + 'px',
        marginTop:  -(maxR * 1.1) + 'px',
        scale: 1,
        duration: .65,
        ease: 'power3.inOut',
      });
    }, [], 3.42);

    tl.to('.ld-container', { opacity: 0, duration: .2, ease: 'none' }, 3.95);
  }
}
