import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent }         from './admin-layout/admin-layout.component';
import { AdminDashboardComponent }      from './admin-dashboard/admin-dashboard.component';
import { UsersComponent }               from './users/users.component';
import { InvitationCodesComponent }     from './invitation-codes/invitation-codes.component';
import { AdminSignalementsComponent }   from './signalements/admin-signalements.component';
import { ContratSigningComponent }      from './contrats/contrat-signing.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: '',                redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',       component: AdminDashboardComponent },
      { path: 'users',           component: UsersComponent },
      { path: 'invitation-codes', component: InvitationCodesComponent },
      // ── Signalements admin — vue dédiée avec delete ────────────────
      { path: 'signalements',    component: AdminSignalementsComponent },
      // ── Contrat de travail — signature numérique ───────────────────
      { path: 'contrats/:id',    component: ContratSigningComponent },
      // Routes à implémenter — pointent sur dashboard pour l'instant
      { path: 'carte',           redirectTo: 'signalements', pathMatch: 'full' },
      { path: 'equipes',         redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'ia',              redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'rapports',        redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'settings',        redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'projets',         redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'actualites',      redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
