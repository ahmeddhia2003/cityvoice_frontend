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
  {
    path : 'landing',
    component: LandingComponent,
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
    canActivate: [AuthGuard],
    data: { role: 'ADMIN_VILLE' },
    loadChildren: () => import('./features/admin/admin.module')
      .then(m => m.AdminModule)
  },
  {
    path: 'user',
    canActivate: [AuthGuard],
    loadChildren: () => import('./features/user/user.module').then(m => m.UserModule)
  },
  {
    path: 'chef',
    canActivate: [AuthGuard],
    data: { role: 'CHEF_EQUIPE' },
    loadChildren: () =>
      import('./features/chef-equipe/chef-equipe.module').then(m => m.ChefEquipeModule),
  },
  {
    path: 'mes-signalements',
    redirectTo: 'signaler/mes-signalements',
    pathMatch: 'full'
  },
  {
    path: 'signalement/voice',
    redirectTo: 'signaler/voice',
    pathMatch: 'full'
  },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    anchorScrolling: 'enabled',
    scrollPositionRestoration: 'enabled'
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
