import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { ChefEquipeComponent } from './chef-equipe.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: ChefEquipeComponent }
];

@NgModule({
  declarations: [ChefEquipeComponent],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule.forChild(routes),
    SharedModule,
  ],
})
export class ChefEquipeModule {}
