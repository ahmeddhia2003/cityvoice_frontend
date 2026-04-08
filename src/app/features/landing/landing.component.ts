import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ElementRef, ViewChild, HostListener
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LangService } from '../../core/services/lang.service';
import { SoundService } from '../../core/services/sound.service';

declare const gsap: any;
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
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mapEl') mapElRef!: ElementRef;
  @ViewChild('progEl') progRef!: ElementRef;

  private map: any;
  private subs: Subscription[] = [];
  private feedTimer: any;

  statCurrents = [0, 0, 0, 0];
  ctaCurrents = [0, 0, 0];

  liveResolved = 0;
  liveProgress = 0;
  livePending = 0;

  liveFeed: LiveItem[] = [
    { id: 1, type: 'Trou chaussée', emoji: '🕳️', address: 'Av. Habib Bourguiba', status: 'resolved', time: '3 min' },
    { id: 2, type: 'Lampadaire cassé', emoji: '💡', address: 'Rue de la Liberté', status: 'in-progress', time: '8 min' },
    { id: 3, type: 'Fuite d\'eau', emoji: '💧', address: 'Menzah 6', status: 'resolved', time: '12 min' },
    { id: 4, type: 'Déchets', emoji: '🗑️', address: 'Rue Ibn Khaldoun', status: 'pending', time: '18 min' }
  ];

  // données UI
  stats = [
    { suffix: '%', cls: 'stat1', trend: true },
    { suffix: '+', cls: 'stat2' },
    { suffix: '', cls: 'stat3' },
    { suffix: '', cls: 'stat4' }
  ];

  steps = [
    { num: '01', icon: 'camera' },
    { num: '02', icon: 'cpu' },
    { num: '03', icon: 'tool' }
  ];

  ctaStats = [
    { suffix: '+' },
    { suffix: '%' },
    { suffix: '' }
  ];

  testimonials = [
    { name: 'Amine', loc: 'Tunis', av: 'A', accent: 'coral' },
    { name: 'Sara', loc: 'Sfax', av: 'S', accent: 'teal' },
    { name: 'Youssef', loc: 'Sousse', av: 'Y', accent: 'gold' }
  ];

  marqueeItems = [
    'Signalement rapide',
    'Ville propre',
    'Communauté active'
  ];

  constructor(
    public lang: LangService,
    public sound: SoundService
  ) {}

  ngOnInit(): void {
    this.calcLive();

    this.feedTimer = setInterval(() => {
      const item: LiveItem = {
        id: Date.now(),
        type: 'Nouveau signalement',
        emoji: '🚨',
        address: 'Zone inconnue',
        status: 'pending',
        time: 'à l\'instant',
        isNew: true
      };

      this.liveFeed.unshift(item);
      if (this.liveFeed.length > 6) this.liveFeed.pop();

      this.calcLive();
    }, 5000);
  }

  private calcLive(): void {
    this.liveResolved = this.liveFeed.filter(i => i.status === 'resolved').length;
    this.liveProgress = this.liveFeed.filter(i => i.status === 'in-progress').length;
    this.livePending = this.liveFeed.filter(i => i.status === 'pending').length;
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy(): void {
    clearInterval(this.feedTimer);
    this.subs.forEach(s => s.unsubscribe());
    if (this.map) this.map.remove();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (!this.progRef) return;

    const pct =
      window.scrollY /
      (document.body.scrollHeight - window.innerHeight);

    gsap.set(this.progRef.nativeElement, { scaleX: pct });
  }

  private initMap(): void {
    if (!this.mapElRef || typeof L === 'undefined') return;

    this.map = L.map(this.mapElRef.nativeElement).setView([36.8065, 10.1815], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
      .addTo(this.map);

    L.marker([36.8065, 10.1815])
      .addTo(this.map)
      .bindPopup('Tunis');
  }

  trackItem(index: number, item: LiveItem): number {
    return item.id;
  }

  statusLabel(s: string): string {
    return {
      resolved: 'Résolu',
      'in-progress': 'En cours',
      pending: 'En attente'
    }[s] || s;
  }

  getTestiText(t: any): string {
    return 'Super application !';
  }
}
