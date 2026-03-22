import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {SigninComponent} from './signin/signin.component';
import {SignupComponent} from './signup/signup.component';
import {ResetPasswordComponent} from './reset-password/reset-password.component';
import {ForgotPasswordComponent} from './forgot-password/forgot-password.component';
import {OAuth2CallbackComponent} from './oauth2-callback/oauth2-callback.component';

const routes: Routes = [
  { path: '',               redirectTo: 'signin', pathMatch: 'full' },
  { path: 'signin',         component: SigninComponent },
  { path: 'signup',         component: SignupComponent },
  { path: 'forgot-password',component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'oauth2/callback', component: OAuth2CallbackComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
