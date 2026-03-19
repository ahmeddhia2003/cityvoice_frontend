import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { SignalementComponent }   from './signalement.component';
import { SignalerFormComponent }  from './signaler-form/signaler-form.component';
import { CameraModalComponent } from '../../shared/components/camera-modal/camera-modal.component'; 
const routes: Routes = [
  { path: '',    component: SignalementComponent,  title: 'Signalement — CityVoice' },
  { path: 'new', component: SignalerFormComponent, title: 'Signaler un problème' },
];

@NgModule({
  declarations: [
    SignalementComponent,
    SignalerFormComponent,
    CameraModalComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forChild(routes),
    
  ],
})
export class SignalementModule {}
