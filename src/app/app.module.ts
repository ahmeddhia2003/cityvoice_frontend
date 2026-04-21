import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CoreModule } from './core/core.module';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {CommonModule} from '@angular/common';
import {SharedModule} from './shared/shared.module';
import { LandingComponent } from './features/landing/landing.component';
import {ReactiveFormsModule} from '@angular/forms';
import {UserModule} from './features/user/user.module';
import { EquipesListComponent } from './features/equipes/equipes-list/equipes-list.component';


@NgModule({
  declarations: [
    AppComponent,
    LandingComponent,
    EquipesListComponent
    
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    AppRoutingModule,
    CoreModule,
    SharedModule,
    ReactiveFormsModule,
    UserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
