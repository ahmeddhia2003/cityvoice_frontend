import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { LangService } from '../../core/services/lang.service';
import { SoundService } from '../../core/services/sound.service';
import { environment } from '../../../environments/environment';

declare const gsap: any;
declare const ScrollTrigger: any;
declare const L: any;

interface LiveItem {
  id: number;
  type: string;
  emoji: string;
  address: string;
  status: 'resolved' | 'in-progress' | 'pending';
  time: string;
  isNew?: boolean;
}

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl')  mapElRef!: ElementRef;
  @ViewChild('progEl') progRef!: ElementRef;

  private map:       any;
  private heatLayer: any;
  private sts:  any[] = [];
  private subs: Subscription[] = [];
  private statsDone  = false;
  private mapDone    = false;
  private ctaDone    = false;
  private feedTimer: any;

  // All signalement coords for the heatmap [lat, lng, intensity]
  heatPoints: [number, number, number][] = [];

  statCurrents = [0,0,0,0];
  ctaCurrents  = [0,0,0];
  liveResolved = 0;
  liveProgress = 0;
  livePending  = 0;

  // Banner heights (for hero padding-top compensation)
  weatherBannerHeight  = 0;
  festiveBannerHeight  = 0;

  liveFeed: LiveItem[] = [
    { id:1, type:'Trou chaussée',    emoji:'🕳️', address:'Av. Habib Bourguiba', status:'resolved',    time:'il y a 3 min' },
    { id:2, type:'Lampadaire cassé', emoji:'💡', address:'Rue de la Liberté',   status:'in-progress', time:'il y a 8 min' },
    { id:3, type:'Fuite d\'eau',     emoji:'💧', address:'Cité El Menzah 6',    status:'resolved',    time:'il y a 12 min'},
    { id:4, type:'Déchets',          emoji:'🗑️', address:'Rue Ibn Khaldoun',    status:'pending',     time:'il y a 18 min'},
    { id:5, type:'Poteau endommagé', emoji:'⚡', address:'Av. Mohamed V',       status:'in-progress', time:'il y a 24 min'},
  ];

  private newItems: LiveItem[] = [
    { id:6, type:'Caniveau bouché',  emoji:'🌊', address:'Bd du 7 Novembre',  status:'pending',     time:'à l\'instant' },
    { id:7, type:'Trou chaussée',    emoji:'🕳️', address:'Av. Farhat Hached', status:'resolved',    time:'à l\'instant' },
    { id:8, type:'Signalisation',    emoji:'🚦', address:'Bab Bhar',          status:'in-progress', time:'à l\'instant' },
  ];
  private newIdx = 0;

  stats = [
    { val:4827,  cls:'coral', suffix:'',  trend:true  },
    { val:3241,  cls:'teal',  suffix:'',  trend:false },
    { val:12400, cls:'gold',  suffix:'+', trend:false },
    { val:38,    cls:'white', suffix:'h', trend:false },
  ];
  ctaStats = [ { val:4827 }, { val:3241 }, { val:12400, suffix:'+' } ];

  steps = [
    { num:'01', icon:'camera' },
    { num:'02', icon:'cpu' },
    { num:'03', icon:'tool' },
  ];

  marqueeItems = [
    '🕳️ Trous chaussée',
    '✓ 4 827 problèmes résolus',
    '💡 Lampadaires cassés',
    '🏙️ Tunis · Ariana · La Marsa',
    '💧 Fuites d\'eau',
    '⚡ Délai moyen : 38h',
    '🗑️ Déchets non collectés',
    '👥 12 400 citoyens actifs',
    '⚡ Poteaux endommagés',
    '🤖 IA · Précision 94%',
    '🚦 Signalisation absente',
    '🌊 Caniveaux bouchés',
  ];

  testimonials = [
    { av:'SB', name:'Sonia Belhaj',   loc:'Tunis Centre', accent:'coral', text_fr:'"Mon signalement concernant un trou dangereux a été traité en moins de 48h. Enfin une application qui fonctionne !"', text_en:'"My report was handled in less than 48h. Finally an app that actually works!"' },
    { av:'KM', name:'Karim Mansouri', loc:'Ariana',       accent:'teal',  text_fr:'"Simple, rapide, efficace. On voit vraiment les équipes intervenir sur le terrain. Bravo !"',                          text_en:'"Simple, fast, effective. You can really see the teams working on the ground!"'                },
    { av:'LH', name:'Lina Hamdi',     loc:'La Marsa',     accent:'gold',  text_fr:'"J\'ai suivi en temps réel la résolution du problème dans ma rue. Transparence totale."',                              text_en:'"I tracked the resolution in real time. Total transparency."'                                    },
  ];

  /* ── FAQ ──────────────────────────────────────────────────── */
  faqOpenIndex: number | null = 0;
  faqItems = [
    {
      q: 'Comment soumettre un signalement ?',
      a: 'Créez un compte gratuitement, cliquez sur "Signaler un problème", prenez une photo ou décrivez le problème, confirmez la localisation et envoyez. L\'IA prend en charge le reste en quelques secondes.',
    },
    {
      q: 'Combien de temps avant qu\'un problème soit traité ?',
      a: 'Le délai dépend du type de problème et de la municipalité. En moyenne, les problèmes urgents (fuites d\'eau, poteaux dangereux) sont traités en moins de 48h. Madina AI estime un délai pour chaque signalement selon l\'historique local.',
    },
    {
      q: 'Est-ce que mes données personnelles sont protégées ?',
      a: 'Oui. Vos données sont chiffrées et ne sont jamais partagées avec des tiers. Seules les informations nécessaires au traitement du signalement (localisation, type de problème) sont visibles par la municipalité concernée.',
    },
    {
      q: 'Comment fonctionne le système de points et de badges ?',
      a: 'Chaque signalement soumis, chaque vote et chaque confirmation vous rapporte des points. Les badges récompensent des actions spécifiques : premier signalement, signalement résolu, contribution communautaire, etc.',
    },
    {
      q: 'La plateforme est-elle disponible pour toutes les villes de Tunisie ?',
      a: 'Madina est actuellement en phase pilote à Tunis. Le déploiement vers d\'autres villes tunisiennes est prévu progressivement. Les municipalités intéressées peuvent contacter notre équipe pour rejoindre le programme.',
    },
  ];

  toggleFaq(i: number): void {
    this.faqOpenIndex = this.faqOpenIndex === i ? null : i;
    if (typeof gsap === 'undefined') return;
    // Animate chevron
    const chevrons = document.querySelectorAll('.faq-chevron');
    const answers  = document.querySelectorAll('.faq-answer');
    chevrons.forEach((c, idx) => {
      gsap.to(c, { rotation: this.faqOpenIndex === idx ? 180 : 0, duration: .25, ease: 'power2.out' });
    });
    answers.forEach((a, idx) => {
      if (this.faqOpenIndex === idx) {
        gsap.fromTo(a, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .32, ease: 'power2.out' });
      } else {
        gsap.to(a, { height: 0, opacity: 0, duration: .22, ease: 'power2.in' });
      }
    });
  }

  private pins = [
    { lat:36.8065, lng:10.1815, type:'Trou chaussée',    status:'resolved',    label:'Av. Habib Bourguiba' },
    { lat:36.8120, lng:10.1750, type:'Lampadaire cassé', status:'in-progress', label:'Rue de la Liberté' },
    { lat:36.8000, lng:10.1900, type:'Poteau endommagé', status:'pending',     label:'Av. Mohamed V' },
    { lat:36.8200, lng:10.1680, type:"Fuite d'eau",      status:'resolved',    label:'Menzah 6' },
    { lat:36.7950, lng:10.1850, type:'Déchets',          status:'pending',     label:'Rue Ibn Khaldoun' },
    { lat:36.8150, lng:10.1920, type:'Trou chaussée',    status:'in-progress', label:'Bardo' },
    { lat:36.8080, lng:10.1600, type:'Signalisation',    status:'resolved',    label:'Bab Bhar' },
    { lat:36.8250, lng:10.1780, type:'Caniveau bouché',  status:'pending',     label:'Montplaisir' },
  ];

  constructor(public lang: LangService, public sound: SoundService, private http: HttpClient) {}

  ngOnInit(): void {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    this.calcLive();
    this.loadRealData();
    this.feedTimer = setInterval(() => {
      if (this.newIdx < this.newItems.length) {
        const item = { ...this.newItems[this.newIdx++], isNew: true };
        this.liveFeed.unshift(item);
        if (this.liveFeed.length > 6) this.liveFeed.pop();
        this.calcLive();
        setTimeout(() => {
          if (typeof gsap !== 'undefined') gsap.fromTo('.live-item:first-child', { opacity:0, y:-18, scale:.97 }, { opacity:1, y:0, scale:1, duration:.5, ease:'back.out(1.5)' });
          setTimeout(() => item.isNew = false, 2200);
        }, 50);
      }
    }, 5500);
  }

  private calcLive(): void {
    this.liveResolved = this.liveFeed.filter(i=>i.status==='resolved').length;
    this.liveProgress = this.liveFeed.filter(i=>i.status==='in-progress').length;
    this.livePending  = this.liveFeed.filter(i=>i.status==='pending').length;
  }

  // ── Real data from API ─────────────────────────────────────────────────────
  private loadRealData(): void {
    const base = `${environment.apiUrl}/api/v1/signalements`;

    // 1. Stats (/stats endpoint)
    this.http.get<any>(`${base}/stats`).subscribe({
      next: (s) => {
        // Update KPI values (animation reads from stats[i].val)
        this.stats[0].val = s.total      ?? this.stats[0].val;
        this.stats[1].val = s.resolus    ?? this.stats[1].val;
        // stats[2] = citoyens actifs, stats[3] = délai moyen → not in API, keep hardcoded
        this.ctaStats[0].val = s.total   ?? this.ctaStats[0].val;
        this.ctaStats[1].val = s.resolus ?? this.ctaStats[1].val;

        // Live panel counters
        this.liveResolved = s.resolus   ?? this.liveResolved;
        this.liveProgress = s.enCours   ?? this.liveProgress;
        this.livePending  = s.enAttente ?? this.livePending;

        // Update marquee with real numbers
        this.marqueeItems[1] = `✓ ${(s.resolus ?? 0).toLocaleString('fr-FR')} problèmes résolus`;
        this.marqueeItems[5] = `⚡ Délai moyen : 38h`; // keep static (no endpoint)
        this.marqueeItems[7] = `👥 ${(s.total ?? 0).toLocaleString('fr-FR')} signalements reçus`;

        // If stats counter already scrolled past, re-animate with real values
        if (this.statsDone) {
          this.stats.forEach((st, i) => {
            const o = { v: 0 };
            if (typeof gsap !== 'undefined') {
              gsap.to(o, { v: st.val, duration: 2.2, ease: 'power2.out',
                onUpdate: () => { this.statCurrents[i] = Math.round(o.v); } });
            } else {
              this.statCurrents[i] = st.val;
            }
          });
        }
      },
      error: () => { /* silently keep hardcoded fallback */ }
    });

    // 2. Last signalements → live feed + map pins
    this.http.get<any[]>(base).subscribe({
      next: (list) => {
        if (!list || !list.length) return;

        // Sort by date desc, take last 6 for live feed
        const sorted = [...list].sort((a, b) =>
          new Date(b.dateSignalement).getTime() - new Date(a.dateSignalement).getTime()
        );

        const emojiMap: Record<string, string> = {
          TROU_CHAUSSEE: '🕳️', LAMPADAIRE_CASSE: '💡', FUITE_EAU: '💧',
          DECHETS_NON_COLLECTES: '🗑️', POTEAU_ENDOMMAGE: '⚡',
          SIGNALISATION_MANQUANTE: '🚦', CANIVEAU_BOUCHE: '🌊',
          ESPACE_VERT_DEGRADE: '🌿',
        };
        const labelMap: Record<string, string> = {
          TROU_CHAUSSEE: 'Trou chaussée', LAMPADAIRE_CASSE: 'Lampadaire cassé',
          FUITE_EAU: "Fuite d'eau", DECHETS_NON_COLLECTES: 'Déchets non collectés',
          POTEAU_ENDOMMAGE: 'Poteau endommagé', SIGNALISATION_MANQUANTE: 'Signalisation',
          CANIVEAU_BOUCHE: 'Caniveau bouché', ESPACE_VERT_DEGRADE: 'Espace vert dégradé',
        };
        const statutFeed: Record<string, 'resolved' | 'in-progress' | 'pending'> = {
          RESOLU: 'resolved', EN_COURS: 'in-progress',
          EN_ATTENTE: 'pending', REJETE: 'pending',
        };
        const statutPin: Record<string, string> = {
          RESOLU: 'resolved', EN_COURS: 'in-progress',
          EN_ATTENTE: 'pending', REJETE: 'pending',
        };

        // Live feed (first 6 most recent)
        this.liveFeed = sorted.slice(0, 6).map((s, i) => ({
          id:      s.id,
          type:    labelMap[s.type] ?? s.type,
          emoji:   emojiMap[s.type] ?? '📍',
          address: s.adresse ?? 'Tunis',
          status:  statutFeed[s.statut] ?? 'pending',
          time:    this._timeAgo(s.dateSignalement),
          isNew:   false,
        }));
        this.calcLive();

        // Map pins (up to 20, those with valid coordinates)
        const withCoords = sorted.filter(s => s.latitude && s.longitude);
        this.pins = withCoords.slice(0, 20).map(s => ({
          lat:    s.latitude,
          lng:    s.longitude,
          type:   labelMap[s.type] ?? s.type,
          status: statutPin[s.statut] ?? 'pending',
          label:  s.adresse ?? 'Tunis',
        }));

        // Heatmap points — ALL signalements, intensity by urgency
        const intensityMap: Record<string, number> = {
          EN_ATTENTE: 1.0, EN_COURS: 0.65, RESOLU: 0.2, REJETE: 0.1,
        };
        this.heatPoints = withCoords.map(s => [
          s.latitude, s.longitude,
          intensityMap[s.statut] ?? 0.5,
        ] as [number, number, number]);

        // Update heatmap layer if map already rendered
        if (this.mapDone && this.map) {
          this._applyHeatmap();
        }

        // If map already initialized, add real markers
        if (this.mapDone && this.map) {
          const clr: Record<string, string> = { pending: '#E8532A', 'in-progress': '#3B82F6', resolved: '#0D9B76' };
          const slbl: Record<string, string> = { pending: 'En attente', 'in-progress': 'En cours', resolved: 'Résolu' };
          this.pins.forEach(p => {
            const c = clr[p.status] ?? '#6B7280';
            const icon = L.divIcon({ html: `<div style="position:relative;width:22px;height:22px"><div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${c};animation:pin-pulse 2s ease-out infinite;opacity:.5"></div><div style="width:22px;height:22px;border-radius:50%;background:${c};border:2.5px solid white;box-shadow:0 3px 12px ${c}55"></div></div>`, iconSize: [22, 22], iconAnchor: [11, 11], className: '' });
            L.marker([p.lat, p.lng], { icon }).addTo(this.map)
              .bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px 0;min-width:170px"><p style="font-weight:700;font-size:13.5px;margin:0 0 4px;color:#0C1F3F">${p.type}</p><p style="font-size:12px;color:#8888A8;margin:0 0 8px">${p.label}</p><span style="font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:100px;background:${c}18;color:${c}">${slbl[p.status]}</span></div>`, { maxWidth: 200 });
          });
        }
      },
      error: () => { /* silently keep hardcoded fallback */ }
    });
  }

  private _timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60)   return `il y a ${diff}s`;
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
    return `il y a ${Math.floor(diff / 86400)}j`;
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initHero();
      this.initScrollAnimations();
      this.initMap();
    }, 80);
  }

  ngOnDestroy(): void {
    clearInterval(this.feedTimer);
    this.sts.forEach(s=>s.kill());
    ScrollTrigger?.getAll().forEach((t:any)=>t.kill());
    if (this.map) this.map.remove();
    this.subs.forEach(s=>s.unsubscribe());
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.progRef?.nativeElement) return;
    const pct = window.scrollY/(document.body.scrollHeight-window.innerHeight);
    gsap.set(this.progRef.nativeElement,{scaleX:pct});
  }

  private initHero(): void {
    const tl = gsap.timeline({ defaults:{ ease:'power4.out' } });
    tl
      .fromTo('.hero-eyebrow',    {opacity:0,y:16},       {opacity:1,y:0,duration:.6},       .4)
      .fromTo('.hero-title-word', {y:'110%',skewY:3},     {y:'0%',skewY:0,duration:.9,stagger:.07}, .55)
      .fromTo('.hero-desc',       {opacity:0,y:20},       {opacity:1,y:0,duration:.7},       .95)
      .fromTo('.hero-buttons',    {opacity:0,y:16},       {opacity:1,y:0,duration:.6},       1.1)
      .fromTo('.hero-trust',      {opacity:0},            {opacity:1,duration:.5},           1.3)
      .fromTo('.live-panel',      {opacity:0,x:50,scale:.96},{opacity:1,x:0,scale:1,duration:1,ease:'power3.out'}, .65)
      .fromTo('.live-stat-card',  {opacity:0,y:20},       {opacity:1,y:0,duration:.5,stagger:.08,ease:'back.out(1.5)'}, 1.05)
      .fromTo('.live-item',       {opacity:0,x:16},       {opacity:1,x:0,duration:.4,stagger:.07}, 1.25);

    gsap.to('.btn-pulse', {boxShadow:'0 10px 36px rgba(232,83,42,.52)',scale:1.025,duration:1.4,yoyo:true,repeat:-1,ease:'sine.inOut'});
    gsap.to('.live-dot',  {scale:1.5,opacity:.4,duration:1,yoyo:true,repeat:-1,ease:'sine.inOut'});
  }

  private initScrollAnimations(): void {
    if (typeof ScrollTrigger==='undefined') return;

    gsap.utils.toArray('.reveal-heading').forEach((el:Element) => {
      const st = ScrollTrigger.create({trigger:el,start:'top 85%',
        onEnter:()=>gsap.fromTo(el,{opacity:0,y:30,clipPath:'inset(0 0 80% 0)'},{opacity:1,y:0,clipPath:'inset(0 0 0% 0)',duration:.8,ease:'power3.out'})
      });
      this.sts.push(st);
    });

    gsap.utils.toArray('.step-card').forEach((el:Element,i:number) => {
      const st = ScrollTrigger.create({trigger:el,start:'top 82%',
        onEnter:()=>gsap.to(el,{opacity:1,y:0,duration:.7,delay:i*.12,ease:'power3.out'})
      });
      this.sts.push(st);
    });

    const s1 = ScrollTrigger.create({trigger:'.stats-section',start:'top 72%',
      onEnter:()=>{
        if(this.statsDone)return; this.statsDone=true;
        gsap.utils.toArray('.stat-cell').forEach((el:Element,i:number)=>gsap.to(el,{opacity:1,y:0,duration:.7,delay:i*.1,ease:'power3.out'}));
        this.stats.forEach((s,i)=>{const o={v:0};gsap.to(o,{v:s.val,duration:2.4,ease:'power2.out',onUpdate:()=>{this.statCurrents[i]=Math.round(o.v);}});});
      }
    });
    this.sts.push(s1);

    gsap.utils.toArray('.testi-card').forEach((el:Element,i:number) => {
      const st = ScrollTrigger.create({trigger:el,start:'top 85%',
        onEnter:()=>gsap.to(el,{opacity:1,y:0,duration:.7,delay:i*.12,ease:'power3.out'})
      });
      this.sts.push(st);
    });

    const s2 = ScrollTrigger.create({trigger:'.cta-section',start:'top 75%',
      onEnter:()=>{
        if(this.ctaDone)return; this.ctaDone=true;
        this.ctaStats.forEach((s,i)=>{const o={v:0};gsap.to(o,{v:s.val,duration:2.2,ease:'power2.out',onUpdate:()=>{this.ctaCurrents[i]=Math.round(o.v);}});});
      }
    });
    this.sts.push(s2);
  }

  private initMap(): void {
    if (typeof L==='undefined'||!this.mapElRef) return;
    const st = ScrollTrigger.create({trigger:'.map-shell',start:'top 80%',
      onEnter:()=>{
        gsap.to('.map-shell',{opacity:1,y:0,scale:1,duration:.8,ease:'power3.out'});
        if(this.mapDone)return; this.mapDone=true;
        this.map=L.map(this.mapElRef.nativeElement,{center:[36.8065,10.1815],zoom:13,zoomControl:false,scrollWheelZoom:false});
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© CARTO',maxZoom:19}).addTo(this.map);
        L.control.zoom({position:'bottomright'}).addTo(this.map);

        // ── Heatmap layer ──────────────────────────────────────────
        this._applyHeatmap();

        // ── Markers on top of heatmap ──────────────────────────────
        const clr:Record<string,string>={pending:'#E8532A','in-progress':'#3B82F6',resolved:'#0D9B76'};
        const slbl:Record<string,string>={pending:'En attente','in-progress':'En cours',resolved:'Résolu'};
        this.pins.forEach(p=>{
          const c=clr[p.status];
          const icon=L.divIcon({html:`<div style="position:relative;width:22px;height:22px"><div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${c};animation:pin-pulse 2s ease-out infinite;opacity:.5"></div><div style="width:22px;height:22px;border-radius:50%;background:${c};border:2.5px solid white;box-shadow:0 3px 12px ${c}55"></div></div>`,iconSize:[22,22],iconAnchor:[11,11],className:''});
          L.marker([p.lat,p.lng],{icon}).addTo(this.map).bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px 0;min-width:170px"><p style="font-weight:700;font-size:13.5px;margin:0 0 4px;color:#0C1F3F">${p.type}</p><p style="font-size:12px;color:#8888A8;margin:0 0 8px">${p.label}</p><span style="font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:100px;background:${c}18;color:${c}">${slbl[p.status]}</span></div>`,{maxWidth:200});
        });
        setTimeout(()=>this.map.invalidateSize(),200);

        // ── GSAP entrance + pulse on heat legend card ────────────
        gsap.fromTo('.heat-legend-card',
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, duration: .7, ease: 'power3.out', delay: .4 }
        );
        gsap.fromTo('.heat-counter-badge',
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: .6, ease: 'back.out(1.6)', delay: .6 }
        );
        // Subtle neon border pulse on the counter badge
        gsap.to('.heat-counter-badge', {
          boxShadow: '0 4px 20px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.07), 0 0 14px rgba(255,0,170,.3)',
          duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut',
        });
      }
    });
    this.sts.push(st);
  }

  // ── Heatmap radius by zoom level ─────────────────────────────────────────
  private _heatRadius(): number {
    if (!this.map) return 40;
    const z = this.map.getZoom();
    // More zoom → smaller radius (points separate)
    if (z >= 16) return 18;
    if (z >= 15) return 24;
    if (z >= 14) return 30;
    if (z >= 13) return 40;
    if (z >= 12) return 55;
    return 70;
  }

  private _applyHeatmap(): void {
    if (typeof (L as any).heatLayer === 'undefined' || !this.map) return;

    // Remove existing heat layer
    if (this.heatLayer) { this.map.removeLayer(this.heatLayer); }

    // Fallback demo points if no real data yet (spread across Tunis area)
    const points: [number,number,number][] = this.heatPoints.length
      ? this.heatPoints
      : [
          // Dense cluster around centre
          [36.8065,10.1815,1.0],[36.8070,10.1820,0.95],[36.8060,10.1810,0.90],
          [36.8075,10.1800,0.85],[36.8058,10.1825,0.92],
          // Secondary clusters
          [36.8120,10.1750,0.80],[36.8125,10.1745,0.75],[36.8115,10.1758,0.70],
          [36.8000,10.1900,0.88],[36.8005,10.1895,0.82],[36.7998,10.1905,0.78],
          [36.8200,10.1680,0.72],[36.8195,10.1685,0.68],
          // Scattered
          [36.7950,10.1850,0.55],[36.8150,10.1920,0.65],[36.8080,10.1600,0.45],
          [36.8250,10.1780,0.90],[36.8300,10.1850,0.60],[36.7900,10.1700,0.80],
          [36.8100,10.2000,0.50],[36.8050,10.1550,0.70],[36.8320,10.1900,0.40],
          [36.7850,10.1950,0.60],[36.8400,10.1700,0.50],[36.8180,10.2100,0.55],
        ];

    const radius = this._heatRadius();

    this.heatLayer = (L as any).heatLayer(points, {
      radius,
      blur:       Math.round(radius * 0.72),
      maxZoom:    18,
      max:        1.0,
      minOpacity: 0.38,
      gradient: {
        0.00: '#0F0035',   // near-black deep purple   — empty
        0.15: '#1E3A8A',   // deep navy blue
        0.30: '#2563EB',   // bright blue
        0.45: '#06B6D4',   // cyan
        0.58: '#10B981',   // emerald green
        0.70: '#FACC15',   // vivid yellow
        0.82: '#F97316',   // orange
        0.92: '#EF4444',   // red
        1.00: '#FF00AA',   // hot pink/magenta — extreme hotspot
      },
    }).addTo(this.map);

    // Listen for zoom → re-render heatmap with correct radius
    this.map.off('zoomend.heat');
    this.map.on('zoomend.heat', () => this._applyHeatmap());

    // Animated opacity breathe on the heat canvas
    setTimeout(() => {
      const heatCanvas: HTMLCanvasElement | null =
        this.mapElRef?.nativeElement?.querySelector('canvas.leaflet-heatmap-layer')
        ?? this.mapElRef?.nativeElement?.querySelector('canvas');
      if (heatCanvas && typeof gsap !== 'undefined') {
        gsap.killTweensOf(heatCanvas);
        gsap.to(heatCanvas, {
          opacity: 0.72,
          duration: 2.6,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
    }, 500);

    // Hot-spot pulse markers — add neon rings on the top-3 densest points
    this._addHotspotMarkers(points.slice().sort((a, b) => b[2] - a[2]).slice(0, 3));
  }

  private _addHotspotMarkers(hotPoints: [number,number,number][]): void {
    hotPoints.forEach(([lat, lng, intensity]) => {
      const size  = Math.round(22 + intensity * 14);
      const glow  = intensity > 0.85 ? '#FF00AA' : intensity > 0.7 ? '#EF4444' : '#F97316';
      const icon  = L.divIcon({
        html: `
          <div style="position:relative;width:${size}px;height:${size}px">
            <div style="position:absolute;inset:-6px;border-radius:50%;
              border:2px solid ${glow};
              animation:pin-pulse 1.8s ease-out infinite;
              opacity:.6"></div>
            <div style="position:absolute;inset:-12px;border-radius:50%;
              border:1px solid ${glow};
              animation:pin-pulse 1.8s ease-out infinite .45s;
              opacity:.35"></div>
            <div style="width:${size}px;height:${size}px;border-radius:50%;
              background:radial-gradient(circle,${glow}cc,${glow}44);
              border:2px solid rgba(255,255,255,.5);
              box-shadow:0 0 ${Math.round(intensity * 18)}px ${glow}88"></div>
          </div>`,
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
        className:  '',
      });
      L.marker([lat, lng], { icon, interactive: false }).addTo(this.map);
    });
  }

  getTestiText(t:any):string { return this.lang.current==='fr'?t.text_fr:t.text_en; }
  trackItem(_:number,item:LiveItem):number{return item.id;}
  statusLabel(s:string):string { return ({resolved:'Résolu','in-progress':'En cours',pending:'En attente'} as any)[s]??s; }
}

// Appended patch
