import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';

import { EvenementDetailComponent } from './components/evenement-detail/evenement-detail.component';
import { EvenementFormComponent }   from './components/evenement-form/evenement-form.component';
import { EvenementMapComponent }    from './components/evenement-map/evenement-map.component';
import { EvenementQrcodeComponent } from './components/evenement-qrcode/evenement-qrcode.component';

@NgModule({
  declarations: [
    EvenementDetailComponent,
    EvenementFormComponent,
    EvenementMapComponent,
    EvenementQrcodeComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    FullCalendarModule,
  ],
  exports: [
    EvenementDetailComponent,
    EvenementFormComponent,
    EvenementMapComponent,
    EvenementQrcodeComponent,
  ]
})
export class SharedEvenementModule {}