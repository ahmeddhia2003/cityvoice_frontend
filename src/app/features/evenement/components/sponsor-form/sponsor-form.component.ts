import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvenementService } from '../../services/evenement.service';

@Component({
  selector: 'app-sponsor-form',
  templateUrl: './sponsor-form.component.html',
  styleUrls: ['./sponsor-form.component.css']
})
export class SponsorFormComponent {

  @Input() evenementId!: number;

  form: FormGroup;
  loading = false;
  succes = '';
  erreur = '';

  niveaux = ['BRONZE', 'ARGENT', 'OR', 'PLATINE'];

  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService
  ) {
    this.form = this.fb.group({
      nomEntreprise: ['', Validators.required],
      logoUrl: [''],
      siteWeb: [''],
      montantSponsorat: [null],
      niveauSponsorat: ['']
    });
  }

  soumettre(): void {
    if (this.form.invalid) return;
    this.loading = true;

    this.evenementService.ajouterSponsor(
      this.evenementId,
      this.form.value
    ).subscribe({
      next: () => {
        this.succes = 'Sponsor ajouté avec succès !';
        this.loading = false;
        this.form.reset();
      },
      error: () => {
        this.erreur = 'Erreur lors de l\'ajout';
        this.loading = false;
      }
    });
  }
}