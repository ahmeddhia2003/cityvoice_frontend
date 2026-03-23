import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Evenement, TypeEvenement } from '../../models/evenement.model';
import { Suggestion } from '../../models/suggestion.model';
import { EvenementService } from '../../services/evenement.service';

@Component({
  selector: 'app-evenement-list',
  templateUrl: './evenement-list.component.html',
  styleUrls: ['./evenement-list.component.css']
})
export class EvenementListComponent implements OnInit, OnDestroy {

  evenements: Evenement[] = [];
  evenementsFiltres: Evenement[] = [];
  suggestions: Suggestion[] = [];
  loading = false;
  erreur = '';

  searchQuery = '';
  typeFiltre = '';
  types = Object.values(TypeEvenement);

  page = 0;
  pageSize = 6;
  totalPages = 0;

  // ─── Intéressé ────────────────────────────────────────
  interesseSet = new Set<number>();

  // ─── Countdown ────────────────────────────────────────
  private countdownInterval: any;

  // ─── Images par défaut ────────────────────────────────
  private defaultImages: { [key: string]: string } = {
    SEMINAIRE: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    EDUCATION: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80',
    RECYCLAGE: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80',
    BENEVOLE:  'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80',
    PAYANT:    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
    AUTRE:     'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80'
  };

  constructor(
    private evenementService: EvenementService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.chargerEvenements();
    this.chargerSuggestions();
    this.chargerInteresses();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  // ─── Chargement ───────────────────────────────────────
  chargerEvenements(): void {
    this.loading = true;
    this.evenementService.getEvenements().subscribe({
      next: (data) => {
        this.evenements = data;
        this.filtrer();
        this.loading = false;
      },
      error: () => {
        this.erreur = 'Impossible de charger les événements';
        this.loading = false;
      }
    });
  }

  chargerSuggestions(): void {
    this.evenementService.getSuggestions().subscribe({
      next: (data) => this.suggestions = data,
      error: () => {}
    });
  }

  // ─── Images ───────────────────────────────────────────
  getImageDefaut(type: string): string {
    return this.defaultImages[type] ||
      'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&q=80';
  }

  onImageError(event: any, type: string): void {
    event.target.src = this.getImageDefaut(type);
  }

  // ─── Intéressé ────────────────────────────────────────
  chargerInteresses(): void {
    const saved = localStorage.getItem('cityvoice_interesses');
    if (saved) {
      this.interesseSet = new Set(JSON.parse(saved));
    }
  }

  toggleInteresse(id: number): void {
    if (this.interesseSet.has(id)) {
      this.interesseSet.delete(id);
    } else {
      this.interesseSet.add(id);
    }
    localStorage.setItem('cityvoice_interesses',
      JSON.stringify([...this.interesseSet]));
  }

  isInteresse(id: number): boolean {
    return this.interesseSet.has(id);
  }

  // ─── Countdown ────────────────────────────────────────
  startCountdown(): void {
    this.countdownInterval = setInterval(() => {}, 1000);
  }

  getCountdown(dateDebut: string): string {
    if (!dateDebut) return '';
    const now = new Date().getTime();
    const eventDate = new Date(dateDebut).getTime();
    const diff = eventDate - now;

    if (diff <= 0) return 'Terminé';

    const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0)  return `${days}j ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }

  // ─── Filtres ──────────────────────────────────────────
  filtrer(): void {
    let result = [...this.evenements];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(e =>
        e.titre.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.lieu.toLowerCase().includes(q)
      );
    }

    if (this.typeFiltre) {
      result = result.filter(e => e.type === this.typeFiltre);
    }

    this.totalPages = Math.ceil(result.length / this.pageSize);
    this.evenementsFiltres = result.slice(
      this.page * this.pageSize,
      (this.page + 1) * this.pageSize
    );
  }

  changerPage(p: number): void {
    this.page = p;
    this.filtrer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getPages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  // ─── Stats ────────────────────────────────────────────
  getTotalInscrits(): number {
    return this.evenements.reduce((s, e) => s + (e.nbInscrits || 0), 0);
  }

  getEvenementsGratuits(): number {
    return this.evenements.filter(e => !e.estPayant).length;
  }

  // ─── Capacité ─────────────────────────────────────────
  getCapacitePercent(ev: Evenement): number {
    if (!ev.capaciteMax) return 0;
    return Math.min(((ev.nbInscrits || 0) / ev.capaciteMax) * 100, 100);
  }

  getCapaciteColor(ev: Evenement): string {
    const p = this.getCapacitePercent(ev);
    if (p >= 90) return 'var(--coral)';
    if (p >= 60) return 'var(--gold)';
    return 'var(--teal)';
  }

  // ─── CSS helpers ──────────────────────────────────────
  getTypePill(type: string): string {
    const map: any = {
      SEMINAIRE: 'pill-navy',  EDUCATION: 'pill-teal',
      RECYCLAGE: 'pill-teal',  BENEVOLE:  'pill-gold',
      PAYANT:    'pill-coral', AUTRE:     'pill-navy'
    };
    return map[type] || 'pill-navy';
  }

  getStatutClass(statut: string): string {
    const map: any = {
      PUBLIE:    'badge-publie',    BROUILLON: 'badge-brouillon',
      ANNULE:    'badge-annule',    TERMINE:   'badge-termine'
    };
    return map[statut] || '';
  }
  allerCalendrier(): void {
  this.router.navigate(['/evenements/calendrier']);
  }
  // ─── Navigation ───────────────────────────────────────
  voirDetail(id: number): void  { this.router.navigate(['/evenements', id]); }
  nouvelEvenement(): void       { this.router.navigate(['/evenements/nouveau']); }
  allerSuggestion(): void       { this.router.navigate(['/evenements/suggestion']); }
}