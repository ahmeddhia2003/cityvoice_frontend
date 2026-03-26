import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { UserRoutingModule } from './user-routing.module';
import { ProfileComponent } from './profile/profile.component';
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {SharedModule} from "../../shared/shared.module";
import { MesPointsComponent } from './mes-points/mes-points.component';
import { MesBadgesComponent } from './mes-badges/mes-badges.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { PublicProfileComponent } from './public-profile/public-profile.component';
import { OnboardingComponent } from './onboarding/onboarding.component';


@NgModule({
  declarations: [
    ProfileComponent,
    MesPointsComponent,
    MesBadgesComponent,
    LeaderboardComponent,
    PublicProfileComponent,
    OnboardingComponent,
  ],
  exports: [
    OnboardingComponent
  ],
  imports: [
    CommonModule,
    UserRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule
  ]
})
export class UserModule { }
