import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LoaderComponent } from './components/loader/loader.component';
import { FooterComponent } from './components/footer/footer.component';
import {TranslatePipe} from './pipes/translate.pipe';
import {RouterModule} from '@angular/router';



@NgModule({
  declarations: [
    NavbarComponent,
    LoaderComponent,
    FooterComponent,
    TranslatePipe
  ],
  imports: [
    CommonModule,
    RouterModule,
  ],
  exports: [
    NavbarComponent,
    FooterComponent,
    LoaderComponent,
    TranslatePipe,
    RouterModule
  ],
})
export class SharedModule {
  constructor() {
    console.log('PIPE REGISTERED');
  }
 }
