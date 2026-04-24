import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TypeEvenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-suggestion-form',
  templateUrl: './suggestion-form.component.html',
  styleUrls: ['./suggestion-form.component.css']
})
export class SuggestionFormComponent {

  form: FormGroup;
  types = Object.values(TypeEvenement);
  loading = false;
  succes = '';
  erreur = '';

  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService,
    private authService: AuthService,
    private router: Router,
    public sound: SoundService,
    public i18n: I18nService
  ) {
    const user = this.authService.getCurrentUser();
    this.form = this.fb.group({
      titre:         ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      description:   ['', [Validators.minLength(20), Validators.maxLength(5000)]],
      typeSouhaite:  [''],
      lieuSouhaite: ['', [Validators.minLength(3), Validators.maxLength(100)]],
      dateSouhaitee: ['', [this.dateFutureValidator]],
      citoyenId:     [user?.userId || ''],
      emailCitoyen:  [user?.email || '', [Validators.email]]
    });
  }

  private dateFutureValidator(control: AbstractControl) {
    if (!control.value) return null;
    const dateChoisie = new Date(control.value);
    const maintenant  = new Date();
    maintenant.setHours(0, 0, 0, 0);
    dateChoisie.setHours(0, 0, 0, 0);
    if (dateChoisie <= maintenant) {
      return { datePasse: true };
    }
    return null;
  }

  soumettre(): void {
    if (!this.authService.isLoggedIn()) {
      this.erreur = this.i18n.t('sug.form.err.login');
      setTimeout(() => this.router.navigate(['/auth/signin']), 2000);
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.erreur = this.i18n.t('sug.form.err.form');
      return;
    }
    this.sound.click();
    this.loading = true;
    this.erreur = '';

    this.evenementService.soumettreSuggestion(this.form.value).subscribe({
      next: () => {
        this.sound.success();
        this.succes = this.i18n.t('sug.form.succes');
        this.loading = false;
        this.form.reset();
        setTimeout(() => this.router.navigate(['/evenements/mes-suggestions']), 2000);
      },
      error: () => {
        this.erreur = this.i18n.t('sug.form.err.submit');
        this.loading = false;
      }
    });
  }

  retour(): void { 
    this.sound.nav();
    this.router.navigate(['/evenements']); }
}