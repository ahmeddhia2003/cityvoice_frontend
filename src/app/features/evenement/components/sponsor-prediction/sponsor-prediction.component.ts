import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvenementService } from '../../services/evenement.service';

export interface SponsorPrediction {
  niveau_recommande: string;
  montant_optimal: number;
  probabilite_acceptation: number;
  probabilites_par_niveau: { [key: string]: number };
  explication: string;
  email_demarche: string;
}

@Component({
  selector: 'app-sponsor-prediction',
  templateUrl: './sponsor-prediction.component.html',
  styleUrls: ['./sponsor-prediction.component.css']
})
export class SponsorPredictionComponent implements OnInit {

  @Input() evenementId!: number;
  @Input() typeEvenement!: string;
  @Input() capaciteMax!: number;
  @Input() lieu!: string;

  form: FormGroup;
  prediction: SponsorPrediction | null = null;
  loading = false;
  erreur = '';
  emailCopied = false;

  niveauColors: { [key: string]: string } = {
    PLATINE: '#7C3AED',
    OR:      '#C9973E',
    ARGENT:  '#8888A8',
    BRONZE:  '#CD7F32'
  };

  niveauIcons: { [key: string]: string } = {
    PLATINE: '💎', OR: '🥇', ARGENT: '🥈', BRONZE: '🥉'
  };

  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService
  ) {
    this.form = this.fb.group({
      budgetEvenement: [5000, [Validators.required, Validators.min(100)]]
    });
  }

  ngOnInit(): void {}

  predire(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.erreur = '';
    this.prediction = null;

    const payload = {
      typeEvenement:   this.typeEvenement,
      capaciteMax:     this.capaciteMax,
      lieu:            this.lieu,
      budgetEvenement: this.form.value.budgetEvenement
    };

    this.evenementService.predictSponsor(payload).subscribe({
      next: (res) => {
        this.prediction = res;
        this.loading = false;
      },
      error: () => {
        this.erreur = '❌ Service ML indisponible';
        this.loading = false;
      }
    });
  }

  copierEmail(): void {
    if (!this.prediction?.email_demarche) return;
    navigator.clipboard.writeText(this.prediction.email_demarche).then(() => {
      this.emailCopied = true;
      setTimeout(() => this.emailCopied = false, 2000);
    });
  }

  getNiveauColor(niveau: string): string {
    return this.niveauColors[niveau] || '#0D9B76';
  }

  getNiveauIcon(niveau: string): string {
    return this.niveauIcons[niveau] || '🏅';
  }

  getBarWidth(niveau: string): number {
    return this.prediction?.probabilites_par_niveau[niveau] || 0;
  }
}