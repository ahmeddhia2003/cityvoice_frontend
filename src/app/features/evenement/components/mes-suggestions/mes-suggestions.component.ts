import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { EvenementService } from '../../services/evenement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Suggestion } from '../../models/suggestion.model';
import { TypeEvenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-mes-suggestions',
  templateUrl: './mes-suggestions.component.html',
  styleUrls: ['./mes-suggestions.component.css']
})
export class MesSuggestionsComponent implements OnInit {

  suggestions: Suggestion[] = [];
  loading = false;
  erreur = '';
  succes = '';

  suggestionEnEdition: Suggestion | null = null;
  editForm: FormGroup;
  editLoading = false;
  types = Object.values(TypeEvenement);

  constructor(
    private evenementService: EvenementService,
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    public sound: SoundService,
    public i18n: I18nService
  ) {
    this.editForm = this.fb.group({
      titre:         ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      description:   ['', [Validators.minLength(20), Validators.maxLength(5000)]],
      typeSouhaite:  [''],
      lieuSouhaite: ['', [Validators.minLength(3), Validators.maxLength(100)]],
      dateSouhaitee: ['', [this.dateFutureValidator]],
    });
  }

  private dateFutureValidator(control: AbstractControl) {
    if (!control.value) return null;
    const dateChoisie = new Date(control.value);
    const maintenant  = new Date();
    maintenant.setHours(0, 0, 0, 0);
    if (dateChoisie < maintenant) {
      return { datePasse: true };
    }
    return null;
  }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/signin']);
      return;
    }
    this.charger();
  }

  charger(): void {
    this.loading = true;
    const user = this.authService.getCurrentUser();
    if (!user?.userId) return;

    this.evenementService.getSuggestionsCitoyen(user.userId).subscribe({
      next: (data) => { this.suggestions = data; this.loading = false; },
      error: () => { this.erreur = this.i18n.t('ms.err.load'); this.loading = false; }
    });
  }

  ouvrirEdition(s: Suggestion): void {
    this.sound.nav();
    this.suggestionEnEdition = s;
    this.editForm.patchValue({
      titre:         s.titre,
      description:   s.description || '',
      typeSouhaite:  s.typeSouhaite || '',
      lieuSouhaite:  s.lieuSouhaite || '',
      dateSouhaitee: s.dateSouhaitee || '',
    });
  }

  fermerEdition(): void {
    this.sound.nav();
    this.suggestionEnEdition = null;
    this.editForm.reset();
    this.erreur = '';
  }

  sauvegarder(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.erreur =  this.i18n.t('ms.err.form');
      return;
    }
    this.sound.click(); 
    if (!this.suggestionEnEdition?.id) return;
    this.editLoading = true;
    this.erreur = '';

    const user = this.authService.getCurrentUser();
    const data = {
      ...this.editForm.value,
      citoyenId:    user?.userId || '',
      emailCitoyen: user?.email || ''
    };

    this.evenementService.modifierSuggestion(this.suggestionEnEdition.id, data).subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.i18n.t('ms.succes.modif');
        this.editLoading = false;
        this.fermerEdition();
        this.charger();
        setTimeout(() => this.succes = '', 3000);
      },
      error: (err) => {
        this.erreur = err.error?.message || this.i18n.t('ms.err.modif');
        this.editLoading = false;
      }
    });
  }

  supprimer(id: number): void {
    if (!confirm(this.i18n.t('ms.confirm.suppr'))) return;
    this.sound.click();
    this.evenementService.supprimerSuggestion(id).subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.i18n.t('ms.succes.suppr');
        this.charger();
        setTimeout(() => this.succes = '', 3000);
      },
      error: (err) => {
        this.erreur = err.error?.message || this.i18n.t('ms.err.suppr');
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

  getStatutIcon(statut: string): string {
    const map: any = {
      'SOUMISE':  '⏳',
      'ACCEPTEE': '✅',
      'REJETEE':  '❌'
    };
    return map[statut] || '⏳';
  }
  
  getStatutLabel(statut: string): string {
    const map: any = {
      'SOUMISE':  this.i18n.t('ms.statut.soumise'),
      'ACCEPTEE': this.i18n.t('ms.statut.acceptee'),
      'REJETEE':  this.i18n.t('ms.statut.rejetee'),
    };
    return map[statut] || statut;
  }

  peutModifier(s: Suggestion): boolean {
    return s.statut === 'SOUMISE';
  }

  allerSuggestion(): void { 
    this.sound.nav();
    this.router.navigate(['/evenements/suggestion']); }
  retour(): void { 
    this.sound.nav();
    this.router.navigate(['/evenements']); }
}