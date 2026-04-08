import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Equipe, EquipeService, Etat } from '../../../core/services/equipe.service';

@Component({
  selector: 'app-equipes-list',
  templateUrl: './equipes-list.component.html',
  styleUrls: ['./equipes-list.component.css']
})
export class EquipesListComponent implements OnInit, OnDestroy {

  equipes:  Equipe[] = [];
  filtered: Equipe[] = [];
  loading = true;

  searchTerm = '';
  filterEtat = '';

  selectedId?:     string;
  selectedEquipe?: Equipe;

  /* ── Sous-navbar ── */
  activeSection = 'equipes';
  private scrollHandler!: () => void;

  constructor(
    private equipeService: EquipeService,
    private router: Router
  ) {}

  /* ══ Lifecycle ══════════════════════════════════════════ */
  ngOnInit(): void {
    this.loadEquipes();

    /* Détection de la section active au scroll */
    this.scrollHandler = this.onScroll.bind(this);
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollHandler);
  }

  /* ══ Sous-navbar ════════════════════════════════════════ */
  scrollTo(section: string): void {
    this.activeSection = section;

    /* Offset = grande navbar (72px) + sous-navbar (49px) + marge (8px) */
    const offset = 72 + 49 + 8;
    const el = document.getElementById(section);
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  onScroll(): void {
    const sections = ['equipes', 'ressources', 'signalements'];
    const offset = 72 + 49 + 40;

    for (const id of [...sections].reverse()) {
      const el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - offset) {
        this.activeSection = id;
        break;
      }
    }
  }

  /* ══ Data ═══════════════════════════════════════════════ */
  loadEquipes(): void {
    this.equipeService.getAll().subscribe({
      next: (data) => {
        this.equipes  = data || [];
        this.filtered = data || [];
        this.loading  = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /* ══ Filtres ════════════════════════════════════════════ */
  setFilter(etat: string): void {
    this.filterEtat = etat;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filtered = this.equipes.filter(e => {
      const matchSearch =
        !this.searchTerm ||
        (e.name ?? '').toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (e.specialite ?? '').toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchEtat =
        !this.filterEtat || e.etat === this.filterEtat;

      return matchSearch && matchEtat;
    });
  }

  /* ══ Stats ══════════════════════════════════════════════ */
  get totalMembres(): number {
    return this.equipes.reduce((a, e) => a + (e.membresEquipe?.length || 0), 0);
  }

  countByEtat(etat: Etat): number {
    return this.equipes.filter(e => e.etat === etat).length;
  }

  /* ══ Actions ════════════════════════════════════════════ */
  selectEquipe(e: Equipe): void {
    if (this.selectedId === e.id) { this.closeDetail(); return; }
    this.selectedEquipe = e;
    this.selectedId     = e.id;
  }

  voirDetail(e: Equipe): void {
    this.selectedEquipe = e;
    this.selectedId     = e.id;
  }

  closeDetail(): void {
    this.selectedEquipe = undefined;
    this.selectedId     = undefined;
  }

  modifier(e: Equipe): void {
    this.router.navigate(['/personnel/equipes/modifier', e.id]);
  }

  supprimer(e: Equipe): void {
    if (!e.id) return;
    if (!confirm(`Supprimer "${e.name}" ?`)) return;

    this.equipeService.delete(e.id).subscribe({
      next: () => {
        this.equipes  = this.equipes.filter(x => x.id !== e.id);
        this.applyFilters();
        if (this.selectedId === e.id) this.closeDetail();
      },
      error: (err) => console.error('Erreur suppression', err)
    });
  }

  /* ══ Helpers visuels ════════════════════════════════════ */
  etatLabel(etat?: Etat): string {
    const map: Record<Etat, string> = {
      LIBRE:        'Libre',
      EN_EXECUTION: 'En mission',
      N_ATTENTE:    'En attente',
    };
    return etat ? (map[etat] ?? etat) : 'Inconnu';
  }

  etatClass(etat?: Etat): string {
    const map: Record<Etat, string> = {
      LIBRE:        'etat-libre',
      EN_EXECUTION: 'etat-exec',
      N_ATTENTE:    'etat-wait',
    };
    return etat ? (map[etat] ?? '') : '';
  }

  etatGradient(etat?: Etat): string {
    const map: Record<Etat, string> = {
      LIBRE:        'linear-gradient(135deg, #4ADE80, #22C55E)',
      EN_EXECUTION: 'linear-gradient(135deg, #FB923C, #F97316)',
      N_ATTENTE:    'linear-gradient(135deg, #94A3B8, #64748B)',
    };
    return etat ? (map[etat] ?? '#ccc') : '#ccc';
  }

  initiales(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  avatarBg(name: string): string {
    const colors = ['#00b4a6', '#E8532A', '#8B5CF6', '#10B981', '#3B82F6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  membresPercent(e: Equipe): number {
    return Math.min(((e.membresEquipe?.length || 0) / 10) * 100, 100);
  }

  trackById(_: number, e: Equipe): string | undefined {
    return e.id;
  }
}