import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PersonnelRoutingModule } from './personnel-routing.module';
import { ListComponent } from './candidature/list/list.component';
import { FormComponent } from './candidature/form/form.component';
import { AjouterComponent } from './candidature/ajouter/ajouter.component';
import { EquipesListComponent } from './equipes-list/equipes-list.component';

import { SharedModule } from '../../shared/shared.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ListComponent,
    FormComponent,
    AjouterComponent,
    EquipesListComponent
  ],
  imports: [
    CommonModule,
    PersonnelRoutingModule,
    SharedModule,
    FormsModule
  ]
})
export class PersonnelModule { }
