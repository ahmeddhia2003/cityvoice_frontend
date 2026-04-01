import { NgModule } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminSidebarComponent } from './admin-sidebar/admin-sidebar.component';
import { AdminTopbarComponent } from './admin-topbar/admin-topbar.component';
import { UsersComponent } from './users/users.component';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { InvitationCodesComponent } from './invitation-codes/invitation-codes.component';
import { AdminSignalementsComponent } from './signalements/admin-signalements.component';
import { ContratSigningComponent } from './contrats/contrat-signing.component';


@NgModule({
  declarations: [
    AdminLayoutComponent,
    AdminDashboardComponent,
    AdminSidebarComponent,
    AdminTopbarComponent,
    UsersComponent,
    InvitationCodesComponent,
    AdminSignalementsComponent,
    ContratSigningComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminRoutingModule
  ],
  providers: [
    DatePipe,
    UpperCasePipe
  ]
})
export class AdminModule { }
