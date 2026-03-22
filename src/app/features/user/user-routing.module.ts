import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {ProfileComponent} from './profile/profile.component';
import {MesPointsComponent} from './mes-points/mes-points.component';

const routes: Routes = [
  { path: 'profile', component: ProfileComponent },
  { path: 'mes-points', component: MesPointsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserRoutingModule { }
