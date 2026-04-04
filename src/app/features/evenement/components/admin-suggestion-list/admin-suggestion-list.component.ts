import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { Suggestion, SuggestionAnalyse } from '../../models/suggestion.model';
import { SoundService } from '../../../../core/services/sound.service';

@Component({
  selector: 'app-admin-suggestion-list',
  templateUrl: './admin-suggestion-list.component.html',
  styleUrls: ['./admin-suggestion-list.component.css']
})
export class AdminSuggestionListComponent implements OnInit {

  suggestions: Suggestion[] = [];
  suggestionsFiltrees: Suggestion[] = [];
  loading = false;
  erreur = '';
  succes = '';

  filtreStatut = '';

  // Analyse AI
  analyseEnCours: number | null = null;
  analyses: { [id: number]: SuggestionAnalyse } = {};

  // Commentaire rejet
  commentaireModal: Suggestion | null = null;
  commentaire = '';

  constructor(
    private evenementService: EvenementService,
    public router: Router,
    public sound: SoundService
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    this.evenementService.getSuggestions().subscribe({
      next: (data) => {
        this.suggestions = data.sort((a, b) =>
          new Date(b.soumisLe || '').getTime() - new Date(a.soumisLe || '').getTime()
        );
        this.appliquerFiltre();
        this.loading = false;
      },
      error: () => { this.erreur = 'Erreur chargement'; this.loading = false; }
    });
  }

  appliquerFiltre(): void {
    if (this.filtreStatut) {
      this.suggestionsFiltrees = this.suggestions.filter(s => s.statut === this.filtreStatut);
    } else {
      this.suggestionsFiltrees = [...this.suggestions];
    }
  }

  analyser(id: number): void {
    this.sound.click();
    this.analyseEnCours = id;
    this.evenementService.analyserSuggestion(id).subscribe({
      next: (res) => {
        this.analyses[id] = res;
        this.analyseEnCours = null;
        this.sound.success();
      },
      error: () => {
        this.erreur = 'Erreur lors de l\'analyse AI';
        this.analyseEnCours = null;
      }
    });
  }

  accepter(s: Suggestion): void {
    this.sound.success();
    this.evenementService.traiterSuggestion(s.id!, 'ACCEPTEE', 'Suggestion acceptée').subscribe({
      next: () => {
        this.succes = '✅ Suggestion acceptée !';
        this.charger();
        // Naviguer vers création événement pré-rempli
        this.router.navigate(['/admin/evenements/nouveau'], {
          queryParams: {
            titre:        s.titre,
            description:  s.description || '',
            type:         s.typeSouhaite || '',
            lieu:         s.lieuSouhaite || '',
            date:         s.dateSouhaitee || ''
          }
        });
        setTimeout(() => this.succes = '', 3000);
      }
    });
  }

  ouvrirRejet(s: Suggestion): void {
    this.sound.nav();
    this.commentaireModal = s;
    this.commentaire = '';
  }

  confirmerRejet(): void {
    if (!this.commentaireModal?.id) return;
    if (!this.commentaire || this.commentaire.trim().length < 10) {
      this.erreur = '⚠️ Le commentaire doit contenir au moins 10 caractères.';
      return;
    }
    this.sound.click(); 
    this.evenementService.traiterSuggestion(
      this.commentaireModal.id, 'REJETEE', this.commentaire
    ).subscribe({
      next: () => {
        this.sound.success();
        this.succes = '❌ Suggestion rejetée';
        this.commentaireModal = null;
        this.charger();
        setTimeout(() => this.succes = '', 3000);
      }
    });
  }

  getStatutClass(statut: string): string {
    const map: any = {
      'SOUMISE':  'statut-soumise',
      'ACCEPTEE': 'statut-acceptee',
      'REJETEE':  'statut-rejetee'
    };
    return map[statut] || 'statut-soumise';
  }

  getScoreColor(score: number): string {
    if (score >= 70) return '#0D9B76';
    if (score >= 40) return '#C9973E';
    return '#E8532A';
  }
  countStatut(statut: string): number {
  return this.suggestions.filter(s => s.statut === statut).length;
}
}