import { Component, Input,EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EvenementService } from '../../services/evenement.service';
import { I18nService } from '../../../../core/services/i18n.service';

export interface BudgetPrediction {
  budget_recommande: number;
  fourchette_min: number;
  fourchette_max: number;
  explication: string;
  decomposition: {
    logistique: number;
    marketing: number;
    technique: number;
  };
  nb_sponsors_recommande: number;
  recette_estimee: number;
  budget_net: number;
  facteurs: { [key: string]: any };
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
  @Input() typeLieu!: string;
  @Input() zone!: string;
  @Input() mediaPrevu!: boolean;
  @Input() streamingPrevu!: boolean;
  @Input() prix!: number;
  @Input() dateDebut!: string;
  @Input() dateFin!: string;
  @Output() budgetPrédit = new EventEmitter<number>();

  form: FormGroup;
  prediction: BudgetPrediction | null = null;
  loading = false;
  erreur = '';

  constructor(
    private fb: FormBuilder,
    private evenementService: EvenementService,
    public i18n: I18nService
  ) {
    this.form = this.fb.group({});
  }
  get dureeHeures(): number {
    if (!this.dateDebut || !this.dateFin) return 4;
    const diff = new Date(this.dateFin).getTime() - 
                new Date(this.dateDebut).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60)));
  }
  predire(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.erreur = '';
    this.prediction = null;

    const payload = {
      typeEvenement:  this.typeEvenement,
      capaciteMax:    this.capaciteMax,
      typeLieu:       this.typeLieu       || 'SALLE',
      zone:           this.zone           || 'CENTRE_VILLE',
      mediaPrevu:     this.mediaPrevu     ? 1 : 0,
      streamingPrevu: this.streamingPrevu ? 1 : 0,
      estPayant:      this.estPayant      ? 1 : 0,
      prixBillet:     this.prix           || 0,
      dureeHeures:    this.dureeHeures,
      dateDebut:      this.dateDebut      || '',
      //langue: this.i18n.lang || 'fr'
    };

    this.evenementService.predictBudget(payload).subscribe({
      next: (res) => { this.prediction = res; this.loading = false; this.budgetPrédit.emit(res.budget_recommande);},
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