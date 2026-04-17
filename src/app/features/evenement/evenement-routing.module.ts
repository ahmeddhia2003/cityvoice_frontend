import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EvenementListComponent } from './components/evenement-list/evenement-list.component';
import { EvenementFormComponent } from './components/evenement-form/evenement-form.component';
import { EvenementDetailComponent } from './components/evenement-detail/evenement-detail.component';
import { SuggestionFormComponent } from './components/suggestion-form/suggestion-form.component';
import { EvenementCalendrierComponent } from './components/evenement-calendrier/evenement-calendrier.component';
import { MesSuggestionsComponent } from './components/mes-suggestions/mes-suggestions.component';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';
import { PaymentCancelComponent }  from './components/payment-cancel/payment-cancel.component';
import { LiveBroadcastComponent } from './components/live-broadcast/live-broadcast.component';
import { LiveViewerComponent }    from './components/live-viewer/live-viewer.component';

const routes: Routes = [
  { path: '', component: EvenementListComponent },
  { path: 'nouveau', component: EvenementFormComponent },
  { path: 'suggestion', component: SuggestionFormComponent },
  { path: 'mes-suggestions', component: MesSuggestionsComponent },
  { path: 'calendrier', component: EvenementCalendrierComponent },
  { path: 'payment-success', component: PaymentSuccessComponent },
  { path: 'payment-cancel',  component: PaymentCancelComponent  },
  { path: ':id/live/broadcast', component: LiveBroadcastComponent },
  { path: ':id/live/watch', component: LiveViewerComponent },
  { path: ':id', component: EvenementDetailComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EvenementRoutingModule {}