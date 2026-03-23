import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import {LandingComponent} from './features/landing/landing.component';

const routes: Routes = [

  // Landing page publique
  {
    path : '',
    component: LandingComponent
  },
  // Auth (public)
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.module').then(m => m.AuthModule),
  },

  // Protégées par AuthGuard
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'signaler',
    loadChildren: () =>
      import('./features/signalement/signalement.module').then(m => m.SignalementModule),
    //canActivate: [AuthGuard],
  },
  {
    path: 'evenements',
    loadChildren: () =>
      import('./features/evenement/evenement.module').then(m => m.EvenementModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'projets',
    loadChildren: () =>
      import('./features/projet/projet.module').then(m => m.ProjetModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'actualites',
    loadChildren: () =>
      import('./features/actualite/actualite.module').then(m => m.ActualiteModule),
    canActivate: [AuthGuard],
  },
  
  {
    path: 'personnel',
    loadChildren: () =>
      import('./features/personnel/personnel.module').then(m => m.PersonnelModule),
    canActivate: [AuthGuard],
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./features/admin/admin.module').then(m => m.AdminModule),
  },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
