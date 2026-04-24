import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import { EvenementDetailComponent } from './components/evenement-detail/evenement-detail.component';
import { EvenementFormComponent }   from './components/evenement-form/evenement-form.component';
import { EvenementMapComponent }    from './components/evenement-map/evenement-map.component';
import { EvenementQrcodeComponent } from './components/evenement-qrcode/evenement-qrcode.component';
import { SharedModule } from '../../shared/shared.module';
import { SponsorPredictionComponent } from './components/sponsor-prediction/sponsor-prediction.component';
import { BudgetPredictionComponent } from './components/budget-prediction/budget-prediction.component';

@NgModule({
  declarations: [
    EvenementDetailComponent,
    EvenementFormComponent,
    EvenementMapComponent,
    EvenementQrcodeComponent,
    SponsorPredictionComponent,
    BudgetPredictionComponent, 
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    FullCalendarModule,
    SharedModule,
  ],
  exports: [
    EvenementDetailComponent,
    EvenementFormComponent,
    EvenementMapComponent,
    EvenementQrcodeComponent,
    SponsorPredictionComponent,
    BudgetPredictionComponent, 
  ]
})
export class SharedEvenementModule {}