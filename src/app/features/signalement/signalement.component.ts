import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';

declare const gsap: any;
declare const L: any;

export interface Signalement {
  id: number;
  type: string;
  description: string;
  adresse: string;
  quartier: string;
  status: 'pending' | 'in-progress' | 'resolved';
  priorite: 'faible' | 'moyenne' | 'haute' | 'urgente';
  date: Date;
  lat: number;
  lng: number;
  votes: number;
  media?: string;
}

@Component({
  selector: 'app-signalement',
  templateUrl: './signalement.component.html',
  styleUrls: ['./signalement.component.css'],
})
export class SignalementComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapElRef!: ElementRef;

  private map: any;
  activeFilter = 'all';
  searchQuery = '';
  viewMode: 'list' | 'map' = 'list';

  filters = [
    { key: 'all',         label: 'Tous',            count: 0 },
    { key: 'pending',     label: 'En attente',       count: 0 },
    { key: 'in-progress', label: 'En cours',         count: 0 },
    { key: 'resolved',    label: 'Résolus',          count: 0 },
  ];

  signalements: Signalement[] = [
    { id:1,  type:'Trou chaussée',         description:'Grand trou dangereux pour les voitures et scooters.',    adresse:'Av. Habib Bourguiba',    quartier:'Tunis Centre',  status:'resolved',    priorite:'haute',    date:new Date('2025-03-10'), lat:36.8065, lng:10.1815, votes:24 },
    { id:2,  type:'Lampadaire cassé',      description:'Lampadaire hors service depuis 2 semaines. Zone sombre.', adresse:'Rue de la Liberté',     quartier:'Lac 1',         status:'in-progress', priorite:'moyenne',  date:new Date('2025-03-12'), lat:36.8120, lng:10.1750, votes:18 },
    { id:3,  type:'Poteau endommagé',      description:'Poteau électrique penché après accident de voiture.',    adresse:'Av. Mohamed V',          quartier:'Bab Bhar',      status:'pending',     priorite:'urgente',  date:new Date('2025-03-15'), lat:36.8000, lng:10.1900, votes:31 },
    { id:4,  type:'Fuite d\'eau',          description:'Fuite importante avec eau qui ruisselle sur le trottoir.',adresse:'Cité El Menzah',         quartier:'Menzah 6',      status:'resolved',    priorite:'haute',    date:new Date('2025-03-08'), lat:36.8200, lng:10.1680, votes:14 },
    { id:5,  type:'Déchets non collectés', description:'Poubelles débordantes depuis 5 jours.',                  adresse:'Rue Ibn Khaldoun',       quartier:'El Manar',      status:'pending',     priorite:'moyenne',  date:new Date('2025-03-14'), lat:36.7950, lng:10.1850, votes:9  },
    { id:6,  type:'Trou chaussée',         description:'Nid-de-poule profond. Deux pneus crevés signalés.',       adresse:'Bd du 7 Novembre',       quartier:'Bardo',         status:'in-progress', priorite:'haute',    date:new Date('2025-03-13'), lat:36.8150, lng:10.1920, votes:27 },
    { id:7,  type:'Signalisation absente', description:'Panneau stop arraché. Croisement très dangereux.',       adresse:'Carrefour Bab Bhar',     quartier:'Bab Bhar',      status:'resolved',    priorite:'urgente',  date:new Date('2025-03-07'), lat:36.8080, lng:10.1600, votes:41 },
    { id:8,  type:'Caniveau bouché',       description:'Inondation à chaque pluie. Caniveau complètement obstrué.',adresse:'Av. Farhat Hached',    quartier:'Montplaisir',   status:'pending',     priorite:'moyenne',  date:new Date('2025-03-16'), lat:36.8250, lng:10.1780, votes:7  },
    { id:9,  type:'Banc dégradé',          description:'Banc public cassé, risque de blessure.',                  adresse:'Parc du Belvédère',      quartier:'Belvédère',     status:'pending',     priorite:'faible',   date:new Date('2025-03-17'), lat:36.8170, lng:10.1560, votes:5  },
    { id:10, type:'Lampadaire cassé',      description:'3 lampadaires en panne côté pair de l\'avenue.',         adresse:'Av. de la République',   quartier:'Centre Ville',  status:'in-progress', priorite:'haute',    date:new Date('2025-03-11'), lat:36.8095, lng:10.1830, votes:22 },
  ];

  get filtered(): Signalement[] {
    return this.signalements.filter(s => {
      const matchFilter = this.activeFilter === 'all' || s.status === this.activeFilter;
      const matchSearch = !this.searchQuery ||
        s.type.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        s.adresse.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        s.quartier.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  ngOnInit(): void {
    // Calcul des counts
    this.filters.forEach(f => {
      f.count = f.key === 'all'
        ? this.signalements.length
        : this.signalements.filter(s => s.status === f.key).length;
    });
  }

  ngAfterViewInit(): void {
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.page-header',
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
      );
      gsap.fromTo('.filter-bar',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.5, delay: 0.2, ease: 'power2.out' }
      );
    }
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  setFilter(key: string): void {
    this.activeFilter = key;
  }

  setView(mode: 'list' | 'map'): void {
    this.viewMode = mode;
    if (mode === 'map') {
      setTimeout(() => this.initMap(), 150);
    }
  }

  private initMap(): void {
    if (typeof L === 'undefined' || !this.mapElRef || this.map) return;
    this.map = L.map(this.mapElRef.nativeElement, {
      center: [36.8065, 10.1815],
      zoom: 13,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(this.map);

    const colorMap: Record<string, string> = {
      'pending': '#FF6B35', 'in-progress': '#1A56DB', 'resolved': '#00C9A7',
    };
    const labelMap: Record<string, string> = {
      'pending': 'En attente', 'in-progress': 'En cours', 'resolved': 'Résolu',
    };

    this.signalements.forEach(s => {
      const c = colorMap[s.status];
      const icon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 7.875 14 22 14 22S28 21.875 28 14C28 6.268 21.732 0 14 0z" fill="${c}" opacity=".95"/>
          <circle cx="14" cy="14" r="6" fill="white"/>
        </svg>`,
        iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -38], className: '',
      });
      L.marker([s.lat, s.lng], { icon }).addTo(this.map)
        .bindPopup(`<div style="font-family:'DM Sans',sans-serif;padding:4px 0;min-width:170px">
          <p style="font-weight:600;font-size:13px;margin:0 0 4px;color:#111827">${s.type}</p>
          <p style="font-size:12px;color:#6B7280;margin:0 0 6px">${s.adresse}</p>
          <span style="display:inline-block;padding:2px 10px;border-radius:100px;font-size:11px;font-weight:500;background:${c}22;color:${c}">
            ${labelMap[s.status]}</span>
        </div>`, { maxWidth: 200 });
    });
    setTimeout(() => this.map.invalidateSize(), 200);
  }

  statusLabel(s: string): string {
    return ({ pending: 'En attente', 'in-progress': 'En cours', resolved: 'Résolu' } as any)[s] ?? s;
  }

  prioriteLabel(p: string): string {
    return ({ faible: 'Faible', moyenne: 'Moyenne', haute: 'Haute', urgente: 'Urgente' } as any)[p] ?? p;
  }
}
