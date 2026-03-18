import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, NgZone,
} from '@angular/core';
import {SoundService} from '../../../core/services/sound.service';

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

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapEl') mapRef!: ElementRef;

  /* ── KPI state ── */
  kpi1 = 0; kpi2 = 0; kpi3 = 0; kpi4 = 0;

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

  /* ── AI queue ── */
  aiItems: AiItem[] = [
    { emoji:'🕳️', type:'Trou chaussée',   loc:'Av. Bourguiba',    prio:'high', equipe:'Voirie Nord' },
    { emoji:'💧', type:"Fuite d'eau",     loc:'Rue Ibn Khaldoun', prio:'high', equipe:'Plomberie'   },
    { emoji:'💡', type:'Lampadaire cassé',loc:'Bd du 7 Nov.',     prio:'med',  equipe:'Éclairage'   },
    { emoji:'🗑️', type:'Déchets',          loc:'Cité El Menzah',   prio:'low',  equipe:'En analyse'  },
    { emoji:'🌊', type:'Caniveau bouché', loc:'Rue de la Liberté',prio:'med',  equipe:'Voirie Sud'  },
  ];

  /* ── Heatmap ── */
  heatCells: number[] = [];

  /* ── Gauge ── */
  gaugeNum = 0;

  /* ── Map filter ── */
  mapFilter = 'all';

  private map: any;
  private charts: any[] = [];
  private feedTimer: any;
  private newFeedItems: FeedItem[] = [
    { cls:'fi-signal',  text:'<strong>Nouveau signalement</strong> — Poteau endommagé, Bardo',   time:"à l'instant", pill:'fp-pending',  plbl:'En attente' },
    { cls:'fi-resolve', text:'<strong>Résolu</strong> — Trou chaussée Av. Mohamed V',            time:"à l'instant", pill:'fp-resolved', plbl:'Résolu' },
    { cls:'fi-user',    text:'<strong>Nouveau citoyen</strong> — Lina Hamdi a rejoint Madina',   time:"à l'instant", pill:'',            plbl:'' },
  ];
  private newFeedIdx = 0;

  constructor(public sound: SoundService, private ngZone: NgZone) {}

  ngOnInit(): void {
    // Build heatmap data
    this.heatCells = Array.from({ length: 364 }, () => Math.random());
  }

  ngAfterViewInit(): void {
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.kpi-card', { y:24, opacity:0 }, { y:0, opacity:1, duration:.5, stagger:.08, ease:'power3.out' });
      gsap.fromTo('.dash-card',{ y:18, opacity:0 }, { y:0, opacity:1, duration:.5, stagger:.06, ease:'power3.out', delay:.2 });
    }
    setTimeout(() => {
      this.animateKPIs();
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

  /* ── KPI counters ── */
  private animateKPIs(): void {
    const targets = [
      { prop: 'kpi1', val: 4827  },
      { prop: 'kpi2', val: 3241  },
      { prop: 'kpi3', val: 12406 },
      { prop: 'kpi4', val: 38    },
    ];
    targets.forEach(t => {
      const o = { v: 0 };
      gsap.to(o, { v: t.val, duration: 2, ease: 'power2.out',
        onUpdate: () => { (this as any)[t.prop] = Math.round(o.v); }
      });
    });
  }

  /* ── Sparklines ── */
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
        data: { labels: d.map((_,j)=>j), datasets: [{ data:d, borderColor:colors[i], borderWidth:1.5, fill:true, backgroundColor:colors[i]+'1A', tension:.4, pointRadius:0 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{enabled:false} }, scales:{ x:{display:false}, y:{display:false} } }
      });
      this.charts.push(c);
    });
  }

  /* ── Trend chart ── */
  private buildTrendChart(): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('trend-chart') as HTMLCanvasElement;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    const labels = Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-29+i);return d.getDate()+'/'+(d.getMonth()+1);});
    const sig = labels.map(()=>Math.round(50+Math.random()*120));
    const res = sig.map(v=>Math.round(v*(0.65+Math.random()*.2)));
    const gS = ctx.createLinearGradient(0,0,0,180); gS.addColorStop(0,'rgba(232,83,42,.18)'); gS.addColorStop(1,'rgba(232,83,42,.01)');
    const gR = ctx.createLinearGradient(0,0,0,180); gR.addColorStop(0,'rgba(13,155,118,.16)');  gR.addColorStop(1,'rgba(13,155,118,.01)');
    const c = new Chart(ctx, {
      type:'line',
      data:{ labels, datasets:[
          { label:'Signalés', data:sig, borderColor:'#E8532A', backgroundColor:gS, borderWidth:2, tension:.4, fill:true, pointRadius:0, pointHoverRadius:4 },
          { label:'Résolus',  data:res, borderColor:'#0D9B76', backgroundColor:gR, borderWidth:2, tension:.4, fill:true, pointRadius:0, pointHoverRadius:4 },
        ]},
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
        plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(12,31,63,.95)', borderColor:'rgba(12,31,63,.12)', borderWidth:1, titleColor:'#ECE8E1', bodyColor:'rgba(236,232,225,.6)', padding:10, cornerRadius:8 }},
        scales:{ x:{ ticks:{color:'#8888A8',font:{size:10},maxTicksLimit:8}, grid:{color:'rgba(12,31,63,.06)'}, border:{display:false} }, y:{ ticks:{color:'#8888A8',font:{size:10}}, grid:{color:'rgba(12,31,63,.06)'}, border:{display:false} } }
      }
    });
    this.charts.push(c);
  }

  /* ── Donut chart ── */
  private buildDonutChart(): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('donut-chart') as HTMLCanvasElement;
    if (!el) return;
    const c = new Chart(el.getContext('2d'), {
      type:'doughnut',
      data:{ labels:['Chaussée','Éclairage','Eau','Déchets','Autres'], datasets:[{ data:[34,22,18,14,12], backgroundColor:['#E8532A','#C9973E','#3B82F6','#7C3AED','#0D9B76'], borderWidth:2, borderColor:'#FFFFFF', hoverOffset:4 }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{ legend:{display:false}, tooltip:{ backgroundColor:'rgba(12,31,63,.95)', borderColor:'rgba(12,31,63,.1)', borderWidth:1, titleColor:'#ECE8E1', bodyColor:'rgba(236,232,225,.6)', cornerRadius:8 }}}
    });
    this.charts.push(c);
  }

  /* ── Gauge ── */
  private buildGauge(): void {
    if (typeof Chart === 'undefined') return;
    const el = document.getElementById('gauge-chart') as HTMLCanvasElement;
    if (!el) return;
    const c = new Chart(el.getContext('2d'), {
      type:'doughnut',
      data:{ datasets:[{ data:[94,6], backgroundColor:['#0D9B76','rgba(12,31,63,.06)'], borderWidth:0, circumference:180, rotation:-90 }]},
      options:{ responsive:false, cutout:'78%', plugins:{ legend:{display:false}, tooltip:{enabled:false} }, animation:{duration:1600,easing:'easeOutQuart'} }
    });
    this.charts.push(c);
    if (typeof gsap !== 'undefined') {
      const o = {v:0};
      gsap.to(o, { v:94, duration:1.8, ease:'power2.out', delay:.6,
        onUpdate: () => { this.gaugeNum = Math.round(o.v); }
      });
    }
  }

  /* ── Map ── */
  private buildMap(): void {
    if (typeof L === 'undefined' || !this.mapRef) return;
    this.map = L.map(this.mapRef.nativeElement, { center:[36.8065,10.1815], zoom:12, zoomControl:false, scrollWheelZoom:false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{ attribution:'© CARTO', maxZoom:19 }).addTo(this.map);
    L.control.zoom({position:'bottomright'}).addTo(this.map);
    const pins = [
      {lat:36.8065,lng:10.1815,type:'Trou chaussée',s:'pending',   team:'Voirie Nord'},
      {lat:36.8120,lng:10.1750,type:'Lampadaire',   s:'progress',  team:'Éclairage'},
      {lat:36.8000,lng:10.1900,type:'Poteau',        s:'pending',   team:'Non affecté'},
      {lat:36.8200,lng:10.1680,type:'Fuite eau',     s:'resolved',  team:'Plomberie'},
      {lat:36.7950,lng:10.1850,type:'Déchets',       s:'pending',   team:'Non affecté'},
      {lat:36.8150,lng:10.1920,type:'Trou chaussée', s:'progress',  team:'Voirie Sud'},
      {lat:36.8080,lng:10.1600,type:'Signalisation', s:'resolved',  team:'Voirie Nord'},
      {lat:36.8250,lng:10.1780,type:'Caniveau',      s:'pending',   team:'Non affecté'},
    ];
    const clr: Record<string,string> = { pending:'#E8532A', progress:'#3B82F6', resolved:'#0D9B76' };
    const slbl: Record<string,string> = { pending:'En attente', progress:'En cours', resolved:'Résolu' };
    pins.forEach(p => {
      const c = clr[p.s];
      const icon = L.divIcon({ html:`<div style="position:relative;width:20px;height:20px"><div style="position:absolute;inset:-4px;border-radius:50%;border:1.5px solid ${c};animation:pin-pulse 2s ease-out infinite;opacity:.5"></div><div style="width:20px;height:20px;border-radius:50%;background:${c};border:2.5px solid white;box-shadow:0 3px 12px ${c}55"></div></div>`, iconSize:[20,20], iconAnchor:[10,10], className:'' });
      L.marker([p.lat,p.lng],{icon}).addTo(this.map).bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px 0;min-width:160px"><p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#0C1F3F">${p.type}</p><p style="font-size:11px;color:#8888A8;margin:0 0 8px">${p.team}</p><span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:100px;background:${c}18;color:${c}">${slbl[p.s]}</span></div>`,{maxWidth:200});
    });
    setTimeout(()=>this.map.invalidateSize(),200);
  }

  /* ── Live feed ── */
  private startLiveFeed(): void {
    this.feedTimer = setInterval(() => {
      this.ngZone.run(() => {
        if (this.newFeedIdx >= this.newFeedItems.length) return;
        const item = { ...this.newFeedItems[this.newFeedIdx++], isNew: true };
        this.feed.unshift(item);
        if (this.feed.length > 8) this.feed.pop();
        if (typeof gsap !== 'undefined') {
          setTimeout(() => {
            gsap.fromTo('.fi-new', { opacity:0, y:-14 }, { opacity:1, y:0, duration:.4, ease:'back.out(1.5)' });
          }, 30);
          setTimeout(() => { item.isNew = false; }, 2000);
        }
      });
    }, 6000);
  }

  /* ── Helpers ── */
  setMapFilter(f: string): void { this.sound.nav(); this.mapFilter = f; }

  rateColor(rate: number): string {
    return rate > 90 ? 'var(--teal)' : rate > 80 ? 'var(--gold)' : 'var(--coral)';
  }

  heatOpacity(v: number): number {
    return v < .2 ? .06 : v < .5 ? .2 : v < .75 ? .45 : v < .9 ? .75 : .95;
  }

  trackByIndex(i: number): number { return i; }
}
