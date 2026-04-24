import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EvenementRoutingModule } from './evenement-routing.module';
import { EvenementListComponent } from './components/evenement-list/evenement-list.component';
import { EvenementFormComponent } from './components/evenement-form/evenement-form.component';
import { EvenementDetailComponent } from './components/evenement-detail/evenement-detail.component';
import { SuggestionFormComponent } from './components/suggestion-form/suggestion-form.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { EvenementMapComponent } from './components/evenement-map/evenement-map.component';
import { FullCalendarModule } from '@fullcalendar/angular';
import { EvenementCalendrierComponent } from './components/evenement-calendrier/evenement-calendrier.component';
import { EvenementQrcodeComponent } from './components/evenement-qrcode/evenement-qrcode.component';
import { SharedEvenementModule }     from './shared-evenement.module';
import { MesSuggestionsComponent } from './components/mes-suggestions/mes-suggestions.component';
import { PaymentSuccessComponent } from './components/payment-success/payment-success.component';
import { PaymentCancelComponent }  from './components/payment-cancel/payment-cancel.component';
import { SharedModule } from '../../shared/shared.module';
import { LiveBroadcastComponent } from './components/live-broadcast/live-broadcast.component';
import { LiveViewerComponent }    from './components/live-viewer/live-viewer.component';

@NgModule({
  declarations: [
    EvenementListComponent,
    //EvenementFormComponent,
    //EvenementDetailComponent,
    SuggestionFormComponent,
    //EvenementMapComponent,
    EvenementCalendrierComponent,
    //EvenementQrcodeComponent
    MesSuggestionsComponent,
    PaymentSuccessComponent,
    PaymentCancelComponent,
    LiveBroadcastComponent,  
    LiveViewerComponent, 
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EvenementRoutingModule,
    FormsModule,
    FullCalendarModule,
    SharedEvenementModule,
    SharedModule
  ]
})
export class EvenementModule {}