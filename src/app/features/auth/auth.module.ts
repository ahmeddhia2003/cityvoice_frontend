import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthRoutingModule } from './auth-routing.module';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { SigninComponent } from './signin/signin.component';
import { SignupComponent } from './signup/signup.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import {RouterModule} from '@angular/router';
import {OAuth2CallbackComponent} from './oauth2-callback/oauth2-callback.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';
import { EmailPendingComponent } from './email-pending/email-pending.component';

@NgModule({
  declarations: [
    SigninComponent,
    SignupComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent,
    OAuth2CallbackComponent,
    VerifyEmailComponent,
    EmailPendingComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AuthModule { }
