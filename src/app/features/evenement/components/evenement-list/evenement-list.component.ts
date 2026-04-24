import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Evenement, TypeEvenement } from '../../models/evenement.model';
import { Suggestion } from '../../models/suggestion.model';
import { EvenementService } from '../../services/evenement.service';
import { SoundService } from '../../../../core/services/sound.service';
import { AuthService } from '../../../../core/services/auth.service';
import { I18nService } from '../../../../core/services/i18n.service';

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
  // ─── Recommandations ──────────────────────────────────
  recommandations: Evenement[] = [];
  recommandationsFiltrees: Evenement[] = [];
  loadingRecommandations = false;

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
    private router: Router,
    public sound: SoundService,
    private authService: AuthService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void {
    if (this.authService.isAdmin()) {
      this.router.navigate(['/admin/dashboard']);
      return;
    }
    this.chargerEvenements();
    this.chargerSuggestions();
    this.chargerInteresses();
    this.startCountdown();
    this.i18n.init(); 
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  // ─── Chargement ───────────────────────────────────────
  chargerEvenements(): void {
    this.sound.nav(); 
    this.loading = true;
    this.evenementService.getEvenements().subscribe({
      next: (data) => {
        this.evenements = data;
        this.filtrer();
        this.loading = false;
      },
      error: () => {
        this.erreur = this.i18n.t('ev.list.err.load');
        this.loading = false;
      }
    });
    //window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const user = this.authService.getCurrentUser();

    if (user?.userId) {
      // ← Charger depuis la DB
      this.evenementService.getInterets(user.userId).subscribe({
        next: (ids) => {
          this.interesseSet = new Set(ids);
          // ← Charger recommandations si a des intérêts
          if (ids.length > 0 && user?.userId) {
            this.chargerRecommandations(user.userId);
          }
        },
        error: () => {
          // Fallback localStorage
          const saved = localStorage.getItem('cityvoice_interesses');
          if (saved) this.interesseSet = new Set(JSON.parse(saved));
        }
      });
    } else {
      // Non connecté → localStorage
      const saved = localStorage.getItem('cityvoice_interesses');
      if (saved) this.interesseSet = new Set(JSON.parse(saved));
    }
  }

  toggleInteresse(id: number): void {
    this.sound.toggle2(!this.interesseSet.has(id));
    const user = this.authService.getCurrentUser();

    if (user?.userId) {
      // ← Appel API
      this.evenementService.toggleInteret(user.userId, id).subscribe({
        next: (res) => {
          if (res.interesse) {
            this.interesseSet.add(id);
          } else {
            this.interesseSet.delete(id);
          }
          // ← Recharger recommandations
          if (this.interesseSet.size > 0 && user?.userId) {
            this.chargerRecommandations(user.userId);
          } else {
            this.recommandations = [];
            this.recommandationsFiltrees = [];
          }
        }
      });
    } else {
      // Non connecté → localStorage
      if (this.interesseSet.has(id)) {
        this.interesseSet.delete(id);
      } else {
        this.interesseSet.add(id);
      }
      localStorage.setItem('cityvoice_interesses',
        JSON.stringify([...this.interesseSet]));
    }
  }

  isInteresse(id: number): boolean {
    return this.interesseSet.has(id);
  }

  // ─── Recommandations ──────────────────────────────────
  chargerRecommandations(citoyenId: string): void {
    this.loadingRecommandations = true;
    this.evenementService.getRecommandations(citoyenId).subscribe({
      next: (data) => {
        this.recommandations = data;
        this.filtrerRecommandations();
        this.loadingRecommandations = false;
      },
      error: () => {
        this.loadingRecommandations = false;
      }
    });
  }

  filtrerRecommandations(): void {
    let result = [...this.recommandations];

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

    this.recommandationsFiltrees = result;
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

    if (diff <= 0) return this.i18n.t('ev.list.termine');

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
    this.filtrerRecommandations();
  }

  changerPage(p: number): void {
    this.sound.nav();  
    this.page = p;
    this.filtrer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSearch(): void {
    this.sound.nav();                                       
    this.page = 0;
    this.filtrer();
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

  getStatutLabel(statut: string): string {
    const map: any = {
      'PUBLIE':    this.i18n.t('adm.ev.statut.publie'),
      'BROUILLON': this.i18n.t('adm.ev.statut.brouillon'),
      'ANNULE':    this.i18n.t('adm.ev.statut.annule'),
      'TERMINE':   this.i18n.t('adm.ev.statut.termine'),
    };
    return map[statut] || statut;
  }

  getTypeLabel(type: string): string {
    const map: any = {
      'BENEVOLE':  this.i18n.t('adm.ev.type.benevole'),
      'EDUCATION': this.i18n.t('adm.ev.type.education'),
      'RECYCLAGE': this.i18n.t('adm.ev.type.recyclage'),
      'SEMINAIRE': this.i18n.t('adm.ev.type.seminaire'),
      'PAYANT':    this.i18n.t('adm.ev.type.payant'),
    };
    return map[type] || type;
  }
  allerCalendrier(): void {
  this.sound.nav();
  this.router.navigate(['/evenements/calendrier']);
  }
  // ─── Navigation ───────────────────────────────────────
  voirDetail(id: number): void  { 
    this.sound.click();
    this.router.navigate(['/evenements', id]); }
  nouvelEvenement(): void       { 
    this.sound.nav();
    this.router.navigate(['/evenements/nouveau']); }
  allerSuggestion(): void       { 
    this.sound.nav();
    this.router.navigate(['/evenements/suggestion']); }

  allerMesSuggestions(): void {
  this.sound.nav();
  this.router.navigate(['/evenements/mes-suggestions']);
  }
}