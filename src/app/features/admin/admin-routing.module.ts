import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent }    from './admin-layout/admin-layout.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UsersComponent }          from './users/users.component';
import {InvitationCodesComponent} from './invitation-codes/invitation-codes.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,   // ← layout parent
    children: [
      { path: '',          redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users',     component: UsersComponent },
      { path: 'invitation-codes', component: InvitationCodesComponent }
      // Ajoute ici tes futures pages admin
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule {}
