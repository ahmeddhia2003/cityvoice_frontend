import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { TypeEvenement } from '../../models/evenement.model';

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
    private router: Router
  ) {
    this.form = this.fb.group({
      titre:         ['', Validators.required],
      description:   [''],
      typeSouhaite:  [''],
      lieuSouhaite:  [''],
      dateSouhaitee: [''],
      citoyenId:     [1],
      emailCitoyen:  ['', Validators.email]
    });
  }

  soumettre(): void {
    if (this.form.invalid) return;
    this.loading = true;

    this.evenementService.soumettreSuggestion(this.form.value).subscribe({
      next: () => {
        this.succes = '✅ Votre suggestion a été soumise ! Nous l\'examinerons sous 48h.';
        this.loading = false;
        this.form.reset();
      },
      error: () => {
        this.erreur = 'Erreur lors de la soumission. Réessayez.';
        this.loading = false;
      }
    });
  }

  retour(): void { this.router.navigate(['/evenements']); }
}