import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { SharedModule } from '../../shared/shared.module';
import { MesSignalementsComponent } from './mes-signalements/mes-signalements.component';

import { SignalementComponent }   from './signalement.component';
import { SignalerFormComponent }  from './signaler-form/signaler-form.component';
import { VoiceSignalementComponent } from './voice-signalement/voice-signalement.component';
import { SignalementChoixComponent } from './signalement-choix/signalement-choix.component';
import { CameraModalComponent } from '../../shared/components/camera-modal/camera-modal.component';
const routes: Routes = [
  { path: '',               component: SignalementComponent,      title: 'Signalement — CityVoice' },
  { path: 'choix',          component: SignalementChoixComponent, title: 'Choisir une méthode — CityVoice' },
  { path: 'new',            component: SignalerFormComponent,     title: 'Signaler un problème' },
  { path: 'voice',          component: VoiceSignalementComponent, title: 'Signalement vocal' },
  { path: 'mes-signalements', component: MesSignalementsComponent, title: 'Mes signalements' },
];


@NgModule({
  declarations: [
    SignalementComponent,
    SignalerFormComponent,
    VoiceSignalementComponent,
    SignalementChoixComponent,
    CameraModalComponent,
    MesSignalementsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class SignalementModule {}
