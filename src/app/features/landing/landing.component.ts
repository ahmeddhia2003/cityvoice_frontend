import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { Subscription } from 'rxjs';
import {LangService} from '../../core/services/lang.service';
import {SoundService} from '../../core/services/sound.service';

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

  private map: any;
  private sts: any[] = [];
  private subs: Subscription[] = [];
  private statsDone = false;
  private mapDone   = false;
  private ctaDone   = false;
  private feedTimer: any;

  statCurrents = [0,0,0,0];
  ctaCurrents  = [0,0,0];
  liveResolved = 0;
  liveProgress = 0;
  livePending  = 0;

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

  marqueeItems = ['Trous chaussée','Lampadaires cassés','Fuites d\'eau','Déchets non collectés','Poteaux endommagés','Signalisation absente','Caniveaux bouchés'];

  testimonials = [
    { av:'SB', name:'Sonia Belhaj',   loc:'Tunis Centre', accent:'coral', text_fr:'"Mon signalement concernant un trou dangereux a été traité en moins de 48h. Enfin une application qui fonctionne !"', text_en:'"My report was handled in less than 48h. Finally an app that actually works!"' },
    { av:'KM', name:'Karim Mansouri', loc:'Ariana',       accent:'teal',  text_fr:'"Simple, rapide, efficace. On voit vraiment les équipes intervenir sur le terrain. Bravo !"',                          text_en:'"Simple, fast, effective. You can really see the teams working on the ground!"'                },
    { av:'LH', name:'Lina Hamdi',     loc:'La Marsa',     accent:'gold',  text_fr:'"J\'ai suivi en temps réel la résolution du problème dans ma rue. Transparence totale."',                              text_en:'"I tracked the resolution in real time. Total transparency."'                                    },
  ];

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

  constructor(public lang: LangService, public sound: SoundService) {}

  ngOnInit(): void {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
    this.calcLive();
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
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'© CARTO',maxZoom:19}).addTo(this.map);
        L.control.zoom({position:'bottomright'}).addTo(this.map);
        const clr:Record<string,string>={pending:'#E8532A','in-progress':'#3B82F6',resolved:'#0D9B76'};
        const slbl:Record<string,string>={pending:'En attente','in-progress':'En cours',resolved:'Résolu'};
        this.pins.forEach(p=>{
          const c=clr[p.status];
          const icon=L.divIcon({html:`<div style="position:relative;width:22px;height:22px"><div style="position:absolute;inset:-5px;border-radius:50%;border:2px solid ${c};animation:pin-pulse 2s ease-out infinite;opacity:.5"></div><div style="width:22px;height:22px;border-radius:50%;background:${c};border:2.5px solid white;box-shadow:0 3px 12px ${c}55"></div></div>`,iconSize:[22,22],iconAnchor:[11,11],className:''});
          L.marker([p.lat,p.lng],{icon}).addTo(this.map).bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px 0;min-width:170px"><p style="font-weight:700;font-size:13.5px;margin:0 0 4px;color:#0C1F3F">${p.type}</p><p style="font-size:12px;color:#8888A8;margin:0 0 8px">${p.label}</p><span style="font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:100px;background:${c}18;color:${c}">${slbl[p.status]}</span></div>`,{maxWidth:200});
        });
        setTimeout(()=>this.map.invalidateSize(),200);
      }
    });
    this.sts.push(st);
  }

  getTestiText(t:any):string { return this.lang.current==='fr'?t.text_fr:t.text_en; }
  trackItem(_:number,item:LiveItem):number{return item.id;}
  statusLabel(s:string):string { return ({resolved:'Résolu','in-progress':'En cours',pending:'En attente'} as any)[s]??s; }
}

// Appended patch
