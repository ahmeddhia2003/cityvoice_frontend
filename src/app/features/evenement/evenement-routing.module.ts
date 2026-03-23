import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EvenementListComponent } from './components/evenement-list/evenement-list.component';
import { EvenementFormComponent } from './components/evenement-form/evenement-form.component';
import { EvenementDetailComponent } from './components/evenement-detail/evenement-detail.component';
import { SuggestionFormComponent } from './components/suggestion-form/suggestion-form.component';
import { EvenementCalendrierComponent } from './components/evenement-calendrier/evenement-calendrier.component';

const routes: Routes = [
  { path: '', component: EvenementListComponent },
  { path: 'nouveau', component: EvenementFormComponent },
  { path: 'suggestion', component: SuggestionFormComponent },
   { path: 'calendrier', component: EvenementCalendrierComponent },
  { path: ':id', component: EvenementDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EvenementRoutingModule {}