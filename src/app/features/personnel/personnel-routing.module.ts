import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FormComponent } from './candidature/form/form.component';
import { ListComponent } from './candidature/list/list.component';
import { AjouterComponent } from './candidature/ajouter/ajouter.component';
import { EquipesListComponent } from './equipes-list/equipes-list.component';

const routes: Routes = [
  { path: 'form', component: FormComponent },
  { path: 'list', component: ListComponent },
  { path: 'ajouter', component: AjouterComponent },
  { path: 'equipelist', component: EquipesListComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PersonnelRoutingModule { }
