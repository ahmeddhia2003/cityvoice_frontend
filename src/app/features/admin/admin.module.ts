import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormsModule} from '@angular/forms';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminSidebarComponent } from './admin-sidebar/admin-sidebar.component';
import { AdminTopbarComponent } from './admin-topbar/admin-topbar.component';
import { UsersComponent } from './users/users.component';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { InvitationCodesComponent } from './invitation-codes/invitation-codes.component';


@NgModule({
  declarations: [
    AdminLayoutComponent,
    AdminDashboardComponent,
    AdminSidebarComponent,
    AdminTopbarComponent,
    UsersComponent,
    InvitationCodesComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    AdminRoutingModule
  ]
})
export class AdminModule { }
