import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvenementService } from '../../services/evenement.service';

export interface BudgetPrediction {
  budget_recommande: number;
  fourchette_min: number;
  fourchette_max: number;
  explication: string;
}

@Component({
  selector: 'app-budget-prediction',
  templateUrl: './budget-prediction.component.html',
  styleUrls: ['./budget-prediction.component.css']
})
export class BudgetPredictionComponent {

  @Input() typeEvenement!: string;
  @Input() capaciteMax!: number;
  @Input() lieu!: string;
  @Input() estPayant!: boolean;

  form: FormGroup;
  prediction: BudgetPrediction | null = null;
  loading = false;
  erreur = '';

  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService
  ) {
    this.form = this.fb.group({
      nbSponsors: [3, [Validators.required, Validators.min(0), Validators.max(20)]]
    });
  }

  predire(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.erreur = '';
    this.prediction = null;

    const payload = {
      typeEvenement: this.typeEvenement,
      capaciteMax:   this.capaciteMax,
      lieu:          this.lieu,
      nbSponsors:    this.form.value.nbSponsors,
      estPayant:     this.estPayant ? 1 : 0
    };

    this.evenementService.predictBudget(payload).subscribe({
      next: (res) => { this.prediction = res; this.loading = false; },
      error: () => { this.erreur = '❌ Service ML indisponible'; this.loading = false; }
    });
  }

  getBarWidth(): number {
    if (!this.prediction) return 0;
    const range = this.prediction.fourchette_max - this.prediction.fourchette_min;
    const position = this.prediction.budget_recommande - this.prediction.fourchette_min;
    return Math.round((position / range) * 100);
  }
}