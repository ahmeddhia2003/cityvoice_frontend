import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EvenementRoutingModule } from './evenement-routing.module';
import { EvenementListComponent } from './components/evenement-list/evenement-list.component';
import { EvenementFormComponent } from './components/evenement-form/evenement-form.component';
import { EvenementDetailComponent } from './components/evenement-detail/evenement-detail.component';
import { SuggestionFormComponent } from './components/suggestion-form/suggestion-form.component';
import { SponsorFormComponent } from './components/sponsor-form/sponsor-form.component';
import { ReactiveFormsModule, FormsModule } from '@angular/forms'; 
import { EvenementMapComponent } from './components/evenement-map/evenement-map.component';
import { FullCalendarModule } from '@fullcalendar/angular'; 
import { EvenementCalendrierComponent } from './components/evenement-calendrier/evenement-calendrier.component';

@NgModule({
  declarations: [
    EvenementListComponent,
    EvenementFormComponent,
    EvenementDetailComponent,
    SuggestionFormComponent,
    SponsorFormComponent,
    EvenementMapComponent,
    EvenementCalendrierComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EvenementRoutingModule,
    FormsModule, 
    FullCalendarModule   
  ]
})
export class EvenementModule {}