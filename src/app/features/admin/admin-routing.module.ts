import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent }    from './admin-layout/admin-layout.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UsersComponent }          from './users/users.component';
import {InvitationCodesComponent} from './invitation-codes/invitation-codes.component';
import { AdminEvenementListComponent } from '../evenement/components/admin-evenement-list/admin-evenement-list.component';
import { AdminEvenementStatsComponent } from '../evenement/components/admin-evenement-stats/admin-evenement-stats.component';
import { EvenementFormComponent }       from '../evenement/components/evenement-form/evenement-form.component';
import { EvenementDetailComponent } from '../evenement/components/evenement-detail/evenement-detail.component';
import { AdminScanComponent } from '../evenement/components/admin-scan/admin-scan.component';
import { AdminSuggestionListComponent } from '../evenement/components/admin-suggestion-list/admin-suggestion-list.component';
import { AdminSponsorListComponent } from '../evenement/components/admin-sponsor-list/admin-sponsor-list.component';
import { RapportSponsorComponent } from '../evenement/components/rapport-sponsor/rapport-sponsor.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,   // ← layout parent
    children: [
      { path: '',          redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users',     component: UsersComponent },
      { path: 'invitation-codes', component: InvitationCodesComponent },
      // Ajoute ici tes futures pages admin
      //evenements
      { path: 'evenements',        component: AdminEvenementListComponent },
      { path: 'evenements/stats',  component: AdminEvenementStatsComponent },
      { path: 'evenements/nouveau',  component: EvenementFormComponent }, 
      { path: 'evenements/:id/edit', component: EvenementFormComponent }, 
      { path: 'evenements/:id',      component: EvenementDetailComponent },
      { path: 'scan', component: AdminScanComponent },
      { path: 'suggestions', component: AdminSuggestionListComponent },
      { path: 'sponsors', component: AdminSponsorListComponent },
      { path: 'sponsors/rapport', component: RapportSponsorComponent },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
