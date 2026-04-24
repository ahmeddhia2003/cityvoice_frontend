import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SoundService } from '../../../core/services/sound.service';
import { SignalementService, SignalementResponse } from '../../../core/services/signalement.service';
import { environment } from '../../../../environments/environment';

declare const gsap: any;
declare const Chart: any;
declare const L: any;

interface FeedItem {
  cls:  'fi-signal' | 'fi-resolve' | 'fi-user' | 'fi-badge';
  text: string;
  time: string;
  pill: string;
  plbl: string;
  isNew?: boolean;
}

interface Team {
  name: string; av: string; color: string;
  missions: number; rate: number; delay: string; active: boolean;
}

interface AiItem {
  emoji: string; type: string; loc: string;
  prio: 'high' | 'med' | 'low'; equipe: string;
}

/* Map from backend enum → display info */
const TYPE_META: Record<string, { emoji: string; label: string }> = {
  TROU_CHAUSSEE:          { emoji: '🕳️', label: 'Trou chaussée' },
  LAMPADAIRE_CASSE:       { emoji: '💡', label: 'Lampadaire cassé' },
  FUITE_EAU:              { emoji: '💧', label: "Fuite d'eau" },
  DECHETS_NON_COLLECTES:  { emoji: '🗑️', label: 'Déchets non collectés' },
  POTEAU_ENDOMMAGE:       { emoji: '⚠️', label: 'Poteau endommagé' },
  SIGNALISATION_MANQUANTE:{ emoji: '🚧', label: 'Signalisation manquante' },
  CANIVEAU_BOUCHE:        { emoji: '🌊', label: 'Caniveau bouché' },
  ESPACE_VERT_DEGRADE:    { emoji: '🌿', label: 'Espace vert dégradé' },
};

const STATUT_COLOR: Record<string, string> = {
  EN_ATTENTE: '#E8532A',
  EN_COURS:   '#3B82F6',
  RESOLU:     '#0D9B76',
  REJETE:     '#9CA3AF',
};

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapEl') mapRef!: ElementRef;

  /* ── KPI state (real from API) ── */
  kpi1 = 0; kpi2 = 0; kpi3 = 0; kpi4 = 0;

  /* ── Real signalements ── */
  signalements: SignalementResponse[] = [];
  stats: Record<string, number> = {};

  /* ── Feed ── */
  feed: FeedItem[] = [
    { cls:'fi-signal',  text:'<strong>Nouveau signalement</strong> — Trou chaussée Av. Bourguiba',    time:'il y a 1 min',  pill:'fp-pending',  plbl:'En attente' },
    { cls:'fi-resolve', text:'<strong>Résolu</strong> — Lampadaire Rue de la Liberté',                time:'il y a 3 min',  pill:'fp-resolved', plbl:'Résolu' },
    { cls:'fi-user',    text:'<strong>Nouveau citoyen</strong> — Sonia Belhaj a rejoint Madina',      time:'il y a 8 min',  pill:'',            plbl:'' },
    { cls:'fi-signal',  text:'<strong>Nouveau signalement</strong> — Fuite eau Rue Ibn Khaldoun',     time:'il y a 11 min', pill:'fp-progress', plbl:'En cours' },
    { cls:'fi-badge',   text:'<strong>Badge attribué</strong> — Karim M. "Sentinelle" 🏅',           time:'il y a 14 min', pill:'',            plbl:'' },
    { cls:'fi-resolve', text:'<strong>Résolu</strong> — Caniveau Bd du 7 Novembre',                   time:'il y a 19 min', pill:'fp-resolved', plbl:'Résolu' },
  ];

  /* ── Teams ── */
  teams: Team[] = [
    { name:'Voirie Nord',   av:'VN', color:'#E8532A', missions:84, rate:91, delay:'32h', active:true  },
    { name:'Éclairage',     av:'EC', color:'#C9973E', missions:62, rate:88, delay:'41h', active:true  },
    { name:'Plomberie',     av:'PL', color:'#3B82F6', missions:51, rate:95, delay:'28h', active:true  },
    { name:'Espaces verts', av:'EV', color:'#0D9B76', missions:39, rate:77, delay:'55h', active:false },
    { name:'Voirie Sud',    av:'VS', color:'#7C3AED', missions:71, rate:84, delay:'37h', active:true  },
  ];

  /* ── AI queue (populated from real signalements) ── */
  aiItems: AiItem[] = [];

  /* ── Heatmap ── */
  heatCells: number[] = [];

  /* ── Gauge ── */
  gaugeNum = 0;

  /* ── Map ── */
  mapFilter = 'all';
  private mapMarkers: any[] = [];

  /* ── Rapport PDF ── */
  rapportLoading = false;

  private map: any;
  private charts: any[] = [];
  private feedTimer: any;
  private newFeedItems: FeedItem[] = [
    { cls:'fi-signal',  text:'<strong>Nouveau signalement</strong> — Poteau endommagé, Bardo',   time:"à l'instant", pill:'fp-pending',  plbl:'En attente' },
    { cls:'fi-resolve', text:'<strong>Résolu</strong> — Trou chaussée Av. Mohamed V',            time:"à l'instant", pill:'fp-resolved', plbl:'Résolu' },
    { cls:'fi-user',    text:'<strong>Nouveau citoyen</strong> — Lina Hamdi a rejoint Madina',   time:"à l'instant", pill:'',            plbl:'' },
  ];
  private newFeedIdx = 0;

  constructor(
    public sound: SoundService,
    private ngZone: NgZone,
    private router: Router,
    private signalementSvc: SignalementService,
    private http: HttpClient,
  ) {}

  /** Navigation vers la liste complète des signalements */
  goToSignalements(): void {
    this.sound.nav();
    this.router.navigate(['/admin/signalements']);
  }

  /** Génère et télécharge le rapport PDF mensuel depuis Madina AI */
  telechargerRapport(): void {
    if (this.rapportLoading) return;
    this.sound.click();
    this.rapportLoading = true;

    // Construire la répartition par type depuis les signalements chargés
    const typeBreakdown: Record<string, number> = {};
    this.signalements.forEach(s => {
      typeBreakdown[s.type] = (typeBreakdown[s.type] ?? 0) + 1;
    });

    // Déterminer la période (mois courant en français)
    const now = new Date();
    const moisFr = ['Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const periode = `${moisFr[now.getMonth()]} ${now.getFullYear()}`;

    const payload = {
      total:    this.stats['total']     ?? 0,
      resolus:  this.stats['resolus']   ?? 0,
      enCours:  this.stats['enCours']   ?? 0,
      enAttente:this.stats['enAttente'] ?? 0,
      rejetes:  this.stats['rejetes']   ?? 0,
      typeBreakdown,
      periode,
      ville: 'Tunis',
    };

    this.http.post(`${environment.aiUrl}/api/v1/rapport-mensuel`, payload, {
      responseType: 'blob',
    }).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-madina-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.rapportLoading = false;
        this.sound.success();
      },
      error: (err) => {
        console.error('[Rapport] Erreur génération PDF', err);
        this.rapportLoading = false;
      },
    });
  }

  ngOnInit(): void {
    this.heatCells = Array.from({ length: 364 }, () => Math.random());
    this.loadData();
  }

  ngAfterViewInit(): void {
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.kpi-card', { y:24, opacity:0 }, { y:0, opacity:1, duration:.5, stagger:.08, ease:'power3.out' });
      gsap.fromTo('.dash-card',{ y:18, opacity:0 }, { y:0, opacity:1, duration:.5, stagger:.06, ease:'power3.out', delay:.2 });
    }
    setTimeout(() => {
      this.buildSparklines();
      this.buildTrendChart();
      this.buildDonutChart();
      this.buildGauge();
      this.buildMap();
      this.startLiveFeed();
    }, 400);
  }

  ngOnDestroy(): void {
    clearInterval(this.feedTimer);
    this.charts.forEach(c => c?.destroy());
    if (this.map) this.map.remove();
  }

  // ════════════════════════════════════════════════
  // Load real data from API
  // ════════════════════════════════════════════════
  private loadData(): void {
    // Load stats for KPIs
    this.signalementSvc.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.animateKPIs(stats);
      },
      error: () => this.animateKPIsFallback(),
    });

    // Load all signalements for map + AI queue
    this.signalementSvc.getAll().subscribe({
      next: (list) => {
        this.signalements = list;
        this.buildAIQueue(list);
        // Rebuild map markers if map already initialized
        if (this.map) {
          this.refreshMapMarkers();
        }
        // Rebuild charts with real data
        this.rebuildChartsWithRealData(list);
      },
      error: () => { /* map stays with empty markers */ },
    });
  }

  // ════════════════════════════════════════════════
  // KPI counters — real data
  // ════════════════════════════════════════════════
  private animateKPIs(stats: Record<string, number>): void {
    const total    = stats['total']     ?? 0;
    const enCours  = stats['enCours']   ?? 0;
    const resolus  = stats['resolus']   ?? 0;
    const enAttente= stats['enAttente'] ?? 0;

    // resolution rate %
    const rate = total > 0 ? Math.round((resolus / total) * 100) : 0;

    const targets = [
      { prop: 'kpi1', val: total    },
      { prop: 'kpi2', val: resolus  },
      { prop: 'kpi3', val: enCours  },
      { prop: 'kpi4', val: rate     },
    ];
    if (typeof gsap !== 'undefined') {
      targets.forEach(t => {
        const o = { v: 0 };
        gsap.to(o, { v: t.val, duration: 2, ease: 'power2.out',
          onUpdate: () => { (this as any)[t.prop] = Math.round(o.v); }
        });
      });
    } else {
      this.kpi1 = total; this.kpi2 = resolus; this.kpi3 = enCours; this.kpi4 = rate;
    }
  }

  private animateKPIsFallback(): void {
    const targets = [
      { prop: 'kpi1', val: 0 },
      { prop: 'kpi2', val: 0 },
      { prop: 'kpi3', val: 0 },
      { prop: 'kpi4', val: 0 },
    ];
    targets.forEach(t => { (this as any)[t.prop] = t.val; });
  }

  // ════════════════════════════════════════════════
  // AI Queue from real signalements (EN_ATTENTE)
  // ════════════════════════════════════════════════
  private buildAIQueue(list: SignalementResponse[]): void {
    const pending = list
      .filter(s => s.statut === 'EN_ATTENTE' || s.statut === 'EN_COURS')
      .slice(0, 5);

    this.aiItems = pending.map(s => {
      const meta = TYPE_META[s.type] ?? { emoji: '📍', label: s.type };
      const prio: 'high' | 'med' | 'low' =
        (s.prioriteIA === 'HAUTE' || s.prioriteIA === 'URGENTE') ? 'high' :
        s.prioriteIA === 'MOYENNE' ? 'med' : 'low';
      return {
        emoji: meta.emoji,
        type:  meta.label,
        loc:   s.adresse || `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`,
        prio,
        equipe: s.equipeIALabel || 'En analyse…',
      };
    });

    // Fallback if nothing from API
    if (this.aiItems.length === 0) {
      this.aiItems = [
        { emoji:'🕳️', type:'Trou chaussée',   loc:'Av. Bourguiba',    prio:'high', equipe:'En analyse…' },
        { emoji:'💧', type:"Fuite d'eau",      loc:'Rue Ibn Khaldoun', prio:'high', equipe:'En analyse…' },
        { emoji:'💡', type:'Lampadaire cassé', loc:'Bd du 7 Nov.',     prio:'med',  equipe:'En analyse…' },
      ];
    }
  }

  // ════════════════════════════════════════════════
  // Rebuild charts with real data (trend + donut)
  // ════════════════════════════════════════════════
  private rebuildChartsWithRealData(list: SignalementResponse[]): void {
    // Rebuild donut with real type distribution
    this.rebuildDonutWithRealData(list);
    // Rebuild trend with real creation dates
    this.rebuildTrendWithRealData(list);
    // Update gauge with real resolution rate
    this.rebuildGaugeWithRealData(list);
  }

  private rebuildDonutWithRealData(list: SignalementResponse[]): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('donut-chart') as HTMLCanvasElement;
    if (!el) return;

    const counts: Record<string, number> = {};
    list.forEach(s => { counts[s.type] = (counts[s.type] ?? 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(([type]) => TYPE_META[type]?.label ?? type);
    const data   = sorted.map(([, count]) => count);
    const bgColors = ['#E8532A','#C9973E','#3B82F6','#7C3AED','#0D9B76'];

    // Destroy existing donut chart
    const idx = this.charts.findIndex((c: any) => c?.canvas?.id === 'donut-chart');
    if (idx !== -1) { this.charts[idx].destroy(); this.charts.splice(idx, 1); }

    const c = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: bgColors.slice(0, data.length), borderWidth: 2, borderColor: '#FFFFFF', hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        animation: { animateRotate: true, duration: 1200, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(12,31,63,.95)', borderColor: 'rgba(12,31,63,.1)', borderWidth: 1, titleColor: '#ECE8E1', bodyColor: 'rgba(236,232,225,.6)', cornerRadius: 8 }
        }
      }
    });
    this.charts.push(c);
  }

  private rebuildTrendWithRealData(list: SignalementResponse[]): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('trend-chart') as HTMLCanvasElement;
    if (!el) return;

    // Build day buckets for last 30 days
    const days = 30;
    const now = new Date();
    const buckets: Record<string, { sig: number; res: number }> = {};
    const labels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      buckets[key] = { sig: 0, res: 0 };
      labels.push(key);
    }
    list.forEach(s => {
      if (!s.dateSignalement) return;
      const d = new Date(s.dateSignalement);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      if (buckets[key]) {
        buckets[key].sig++;
        if (s.statut === 'RESOLU') buckets[key].res++;
      }
    });

    const sigData = labels.map(k => buckets[k].sig);
    const resData = labels.map(k => buckets[k].res);

    const idx = this.charts.findIndex((c: any) => c?.canvas?.id === 'trend-chart');
    if (idx !== -1) { this.charts[idx].destroy(); this.charts.splice(idx, 1); }

    const ctx = el.getContext('2d')!;
    const gS = ctx.createLinearGradient(0, 0, 0, 180); gS.addColorStop(0, 'rgba(232,83,42,.18)'); gS.addColorStop(1, 'rgba(232,83,42,.01)');
    const gR = ctx.createLinearGradient(0, 0, 0, 180); gR.addColorStop(0, 'rgba(13,155,118,.16)'); gR.addColorStop(1, 'rgba(13,155,118,.01)');

    const c = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Signalés', data: sigData, borderColor: '#E8532A', backgroundColor: gS, borderWidth: 2, tension: .4, fill: true, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Résolus',  data: resData, borderColor: '#0D9B76', backgroundColor: gR, borderWidth: 2, tension: .4, fill: true, pointRadius: 0, pointHoverRadius: 4 },
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgba(12,31,63,.95)', borderColor: 'rgba(12,31,63,.12)', borderWidth: 1, titleColor: '#ECE8E1', bodyColor: 'rgba(236,232,225,.6)', padding: 10, cornerRadius: 8 }
        },
        scales: {
          x: { ticks: { color: '#8888A8', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(12,31,63,.06)' }, border: { display: false } },
          y: { ticks: { color: '#8888A8', font: { size: 10 } }, grid: { color: 'rgba(12,31,63,.06)' }, border: { display: false } }
        }
      }
    });
    this.charts.push(c);
  }

  private rebuildGaugeWithRealData(list: SignalementResponse[]): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('gauge-chart') as HTMLCanvasElement;
    if (!el) return;

    const total   = list.length;
    const resolus = list.filter(s => s.statut === 'RESOLU').length;
    const rate    = total > 0 ? Math.round((resolus / total) * 100) : 0;

    const idx = this.charts.findIndex((c: any) => c?.canvas?.id === 'gauge-chart');
    if (idx !== -1) { this.charts[idx].destroy(); this.charts.splice(idx, 1); }

    const c = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: { datasets: [{ data: [rate, 100 - rate], backgroundColor: ['#0D9B76', 'rgba(12,31,63,.06)'], borderWidth: 0, circumference: 180, rotation: -90 }] },
      options: { responsive: false, cutout: '78%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 1600, easing: 'easeOutQuart' } }
    });
    this.charts.push(c);

    if (typeof gsap !== 'undefined') {
      const o = { v: 0 };
      gsap.to(o, { v: rate, duration: 1.8, ease: 'power2.out', delay: .4, onUpdate: () => { this.gaugeNum = Math.round(o.v); } });
    } else {
      this.gaugeNum = rate;
    }
  }

  // ════════════════════════════════════════════════
  // Sparklines (static illustrative data)
  // ════════════════════════════════════════════════
  private buildSparklines(): void {
    if (typeof Chart === 'undefined') return;
    const data = [
      [120,145,132,178,165,190,210,198,225,240,215,250],
      [90,105,110,125,118,140,152,148,165,170,158,180],
      [800,950,1100,1050,1200,1350,1280,1420,1500,1380,1460,1550],
      [52,48,44,46,42,40,38,41,39,36,37,38],
    ];
    const colors = ['#E8532A','#0D9B76','#3B82F6','#C9973E'];
    data.forEach((d, i) => {
      const el = document.getElementById(`spark${i+1}`) as HTMLCanvasElement;
      if (!el) return;
      const c = new Chart(el.getContext('2d'), {
        type: 'line',
        data: { labels: d.map((_, j) => j), datasets: [{ data: d, borderColor: colors[i], borderWidth: 1.5, fill: true, backgroundColor: colors[i] + '1A', tension: .4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
      });
      this.charts.push(c);
    });
  }

  // ════════════════════════════════════════════════
  // Trend chart (initial placeholder, replaced by real data)
  // ════════════════════════════════════════════════
  private buildTrendChart(): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('trend-chart') as HTMLCanvasElement;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    const labels = Array.from({length:30},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-29+i); return d.getDate()+'/'+(d.getMonth()+1); });
    const sig = labels.map(() => Math.round(10 + Math.random() * 30));
    const res = sig.map(v => Math.round(v * (.5 + Math.random() * .3)));
    const gS = ctx.createLinearGradient(0,0,0,180); gS.addColorStop(0,'rgba(232,83,42,.18)'); gS.addColorStop(1,'rgba(232,83,42,.01)');
    const gR = ctx.createLinearGradient(0,0,0,180); gR.addColorStop(0,'rgba(13,155,118,.16)'); gR.addColorStop(1,'rgba(13,155,118,.01)');
    const c = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label:'Signalés', data:sig, borderColor:'#E8532A', backgroundColor:gS, borderWidth:2, tension:.4, fill:true, pointRadius:0, pointHoverRadius:4 },
        { label:'Résolus',  data:res, borderColor:'#0D9B76', backgroundColor:gR, borderWidth:2, tension:.4, fill:true, pointRadius:0, pointHoverRadius:4 },
      ]},
      options: { responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
        plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(12,31,63,.95)', borderColor:'rgba(12,31,63,.12)', borderWidth:1, titleColor:'#ECE8E1', bodyColor:'rgba(236,232,225,.6)', padding:10, cornerRadius:8 }},
        scales:{ x:{ ticks:{color:'#8888A8',font:{size:10},maxTicksLimit:8}, grid:{color:'rgba(12,31,63,.06)'}, border:{display:false} }, y:{ ticks:{color:'#8888A8',font:{size:10}}, grid:{color:'rgba(12,31,63,.06)'}, border:{display:false} } }
      }
    });
    this.charts.push(c);
  }

  // ════════════════════════════════════════════════
  // Donut chart (initial placeholder, replaced by real data)
  // ════════════════════════════════════════════════
  private buildDonutChart(): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('donut-chart') as HTMLCanvasElement;
    if (!el) return;
    const c = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: { labels:['Chaussée','Éclairage','Eau','Déchets','Autres'], datasets:[{ data:[34,22,18,14,12], backgroundColor:['#E8532A','#C9973E','#3B82F6','#7C3AED','#0D9B76'], borderWidth:2, borderColor:'#FFFFFF', hoverOffset:4 }]},
      options: { responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(12,31,63,.95)', borderColor:'rgba(12,31,63,.1)', borderWidth:1, titleColor:'#ECE8E1', bodyColor:'rgba(236,232,225,.6)', cornerRadius:8 }}}
    });
    this.charts.push(c);
  }

  // ════════════════════════════════════════════════
  // Gauge (initial placeholder, replaced by real data)
  // ════════════════════════════════════════════════
  private buildGauge(): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('gauge-chart') as HTMLCanvasElement;
    if (!el) return;
    const c = new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: { datasets:[{ data:[0,100], backgroundColor:['#0D9B76','rgba(12,31,63,.06)'], borderWidth:0, circumference:180, rotation:-90 }]},
      options: { responsive:false, cutout:'78%', plugins:{ legend:{display:false}, tooltip:{enabled:false} }, animation:{duration:1200,easing:'easeOutQuart'} }
    });
    this.charts.push(c);
  }

  // ════════════════════════════════════════════════
  // Map — initialise then populate with real pins
  // ════════════════════════════════════════════════
  private buildMap(): void {
    if (typeof L === 'undefined' || !this.mapRef) return;
    this.map = L.map(this.mapRef.nativeElement, {
      center: [36.8065, 10.1815], zoom: 12,
      zoomControl: false, scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO', maxZoom: 19,
    }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    setTimeout(() => {
      try { if (this.map && this.map._loaded) this.map.invalidateSize(); } catch (_) {}
      // If data already loaded, draw markers
      if (this.signalements.length > 0) {
        this.refreshMapMarkers();
      }
    }, 200);
  }

  private refreshMapMarkers(): void {
    if (!this.map) return;

    // Remove existing markers
    this.mapMarkers.forEach(m => m.remove());
    this.mapMarkers = [];

    const filtered = this.signalements.filter(s => {
      if (this.mapFilter === 'all') return true;
      const filterMap: Record<string, string> = {
        pending:  'EN_ATTENTE',
        progress: 'EN_COURS',
        resolved: 'RESOLU',
      };
      return s.statut === filterMap[this.mapFilter];
    });

    filtered.forEach(sig => {
      if (!sig.latitude || !sig.longitude) return;
      const color = STATUT_COLOR[sig.statut] ?? '#9CA3AF';
      const meta  = TYPE_META[sig.type] ?? { emoji: '📍', label: sig.type };
      const slbl: Record<string, string> = { EN_ATTENTE: 'En attente', EN_COURS: 'En cours', RESOLU: 'Résolu', REJETE: 'Rejeté' };

      const icon = L.divIcon({
        html: `<div style="position:relative;width:20px;height:20px">
          <div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid ${color};animation:pin-pulse 2s ease-out infinite;opacity:.5"></div>
          <div style="width:20px;height:20px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 3px 12px ${color}55;display:flex;align-items:center;justify-content:center;font-size:9px">${meta.emoji}</div>
        </div>`,
        iconSize: [20, 20], iconAnchor: [10, 10], className: '',
      });

      const addr = sig.adresse || `${sig.latitude.toFixed(4)}, ${sig.longitude.toFixed(4)}`;
      const equipe = sig.equipeIALabel || 'Non affecté';

      const marker = L.marker([sig.latitude, sig.longitude], { icon })
        .addTo(this.map)
        .bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px 0;min-width:160px">
          <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#0C1F3F">${meta.emoji} ${meta.label}</p>
          <p style="font-size:11px;color:#8888A8;margin:0 0 4px">${addr}</p>
          <p style="font-size:11px;color:#8888A8;margin:0 0 8px">👥 ${equipe}</p>
          <span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:${color}18;color:${color}">${slbl[sig.statut] ?? sig.statut}</span>
        </div>`, { maxWidth: 220 });

      this.mapMarkers.push(marker);
    });
  }

  // ════════════════════════════════════════════════
  // Live feed
  // ════════════════════════════════════════════════
  private startLiveFeed(): void {
    this.feedTimer = setInterval(() => {
      this.ngZone.run(() => {
        if (this.newFeedIdx >= this.newFeedItems.length) return;
        const item = { ...this.newFeedItems[this.newFeedIdx++], isNew: true };
        this.feed.unshift(item);
        if (this.feed.length > 8) this.feed.pop();
        if (typeof gsap !== 'undefined') {
          setTimeout(() => {
            gsap.fromTo('.fi-new', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: .4, ease: 'back.out(1.5)' });
          }, 30);
          setTimeout(() => { item.isNew = false; }, 2000);
        }
      });
    }, 6000);
  }

  // ════════════════════════════════════════════════
  // Computed getters for animated stat cards
  // ════════════════════════════════════════════════
  get statutStats(): Array<{ label: string; color: string; count: number; pct: number }> {
    const total = this.stats['total'] ?? 0;
    const pct = (key: string) => total > 0 ? Math.round(((this.stats[key] ?? 0) / total) * 100) : 0;
    return [
      { label: 'En attente', color: '#E8532A', count: this.stats['enAttente'] ?? 0, pct: pct('enAttente') },
      { label: 'En cours',   color: '#3B82F6', count: this.stats['enCours']   ?? 0, pct: pct('enCours')   },
      { label: 'Résolus',    color: '#0D9B76', count: this.stats['resolus']   ?? 0, pct: pct('resolus')   },
      { label: 'Rejetés',    color: '#9CA3AF', count: this.stats['rejetes']   ?? 0, pct: pct('rejetes')   },
    ];
  }

  get typeStats(): Array<{ label: string; color: string; count: number; pct: number }> {
    const counts: Record<string, number> = {};
    this.signalements.forEach(s => { counts[s.type] = (counts[s.type] ?? 0) + 1; });
    const total = this.signalements.length;
    const palette = ['#E8532A', '#C9973E', '#3B82F6', '#7C3AED', '#0D9B76'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count], i) => ({
        label: TYPE_META[type]?.label ?? type,
        color: palette[i],
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  }

  get urgentCount(): number {
    return this.signalements.filter(s =>
      (s.prioriteIA === 'URGENTE' || s.prioriteIA === 'HAUTE') &&
      (s.statut === 'EN_ATTENTE' || s.statut === 'EN_COURS')
    ).length;
  }

  // ════════════════════════════════════════════════
  // Helpers
  // ════════════════════════════════════════════════
  setMapFilter(f: string): void {
    this.sound.nav();
    this.mapFilter = f;
    this.refreshMapMarkers();
  }

  rateColor(rate: number): string {
    return rate > 90 ? 'var(--teal)' : rate > 80 ? 'var(--gold)' : 'var(--coral)';
  }

  heatOpacity(v: number): number {
    return v < .2 ? .06 : v < .5 ? .2 : v < .75 ? .45 : v < .9 ? .75 : .95;
  }

  trackByIndex(i: number): number { return i; }
}
