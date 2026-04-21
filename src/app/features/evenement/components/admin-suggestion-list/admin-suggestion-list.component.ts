import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { Suggestion, SuggestionAnalyse } from '../../models/suggestion.model';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

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
  //Ai justif
  justifications: { [id: number]: string } = {};
  justificationEnCours: number | null = null;

  constructor(
    private evenementService: EvenementService,
    public router: Router,
    public sound: SoundService,
    public i18n: I18nService
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
      error: () => { this.erreur = this.i18n.t('adm.sug.err.load'); this.loading = false; }
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
        this.erreur = this.i18n.t('adm.sug.err.analyse');
        this.analyseEnCours = null;
      }
    });
  }

  confirmerRejet(): void {
    if (!this.commentaireModal?.id) return;
    if (!this.commentaire || this.commentaire.trim().length < 10) {
      this.erreur = this.i18n.t('adm.sug.err.commentaire');
      return;
    }
    this.sound.click(); 
    this.evenementService.traiterSuggestion(
      this.commentaireModal.id, 'REJETEE', this.commentaire
    ).subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.i18n.t('adm.sug.succes.rejeter');
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

  getStatutLabel(statut: string): string {
    const map: any = {
      'SOUMISE':  this.i18n.t('ms.statut.soumise'),
      'ACCEPTEE': this.i18n.t('ms.statut.acceptee'),
      'REJETEE':  this.i18n.t('ms.statut.rejetee'),
    };
    return map[statut] || statut;
  }
  
  getScoreColor(score: number): string {
    if (score >= 70) return '#0D9B76';
    if (score >= 40) return '#C9973E';
    return '#E8532A';
  }
  countStatut(statut: string): number {
    return this.suggestions.filter(s => s.statut === statut).length;
  }
  // ── Justification IA ───────────────────────────────
  genererJustification(s: Suggestion, statut: string): void {
    this.sound.click();
    this.justificationEnCours = s.id!;
    this.evenementService.genererJustification(s.id!, statut).subscribe({
      next: (res: any) => {
        this.justifications[s.id!] = res.justification;
        this.commentaire = res.justification; // ← pré-remplit le commentaire
        this.justificationEnCours = null;
        this.sound.success();
      },
      error: () => {
        this.justificationEnCours = null;
      }
    });
  }

  // accepter() + générer justification auto ──
  accepter(s: Suggestion): void {
    this.sound.click();
    this.justificationEnCours = s.id!;

    this.evenementService.genererJustification(s.id!, 'ACCEPTEE')
      .subscribe({
        next: (res: any) => {
          const justification = res.justification ||
            'Félicitations ! Votre suggestion a été acceptée.';
          this.justificationEnCours = null;

          // ✅ Traiter ET naviguer dans le même subscribe
          this.evenementService.traiterSuggestion(
            s.id!, 'ACCEPTEE', justification
          ).subscribe({
            next: () => {
              this.sound.success();
              this.succes = this.i18n.t('adm.sug.succes.accepter');
              this.charger();
              setTimeout(() => {
                // ✅ Navigation APRÈS sauvegarde
                this.router.navigate(['/admin/evenements/nouveau'], {
                  queryParams: {
                    titre:       s.titre,
                    description: s.description || '',
                    type:        s.typeSouhaite || '',
                    lieu:        s.lieuSouhaite || '',
                    date:        s.dateSouhaitee || ''
                  }
                });
              }, 500); // ← petit délai pour laisser charger()
              setTimeout(() => this.succes = '', 3000);
            },
            error: () => {
              this.erreur = 'Erreur lors de l\'acceptation';
            }
          });
        },
        error: () => {
          // ✅ Fallback — accepter sans justification IA
          this.justificationEnCours = null;
          this.evenementService.traiterSuggestion(
            s.id!, 'ACCEPTEE',
            'Félicitations ! Votre suggestion a été acceptée par notre équipe municipale.'
          ).subscribe({
            next: () => {
              this.sound.success();
              this.succes = this.i18n.t('adm.sug.succes.accepter');
              this.charger();
              setTimeout(() => {
                this.router.navigate(['/admin/evenements/nouveau'], {
                  queryParams: {
                    titre:       s.titre,
                    description: s.description || '',
                    type:        s.typeSouhaite || '',
                    lieu:        s.lieuSouhaite || '',
                    date:        s.dateSouhaitee || ''
                  }
                });
              }, 500);
            }
          });
        }
      });
  }
  // ── Modifier ouvrirRejet() pour pré-remplir avec IA ──
  ouvrirRejet(s: Suggestion): void {
    this.sound.nav();
    this.commentaireModal = s;
    this.commentaire = '';
    // Générer justification automatiquement
    this.genererJustification(s, 'REJETEE');
  }
}