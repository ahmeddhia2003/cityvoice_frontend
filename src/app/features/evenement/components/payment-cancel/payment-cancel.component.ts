import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SoundService } from '../../../../core/services/sound.service';

@Component({
  selector: 'app-payment-cancel',
  templateUrl: './payment-cancel.component.html',
  styleUrls: ['./payment-cancel.component.css']
})
export class PaymentCancelComponent {
  constructor(private router: Router, public sound: SoundService) {}
  retour(): void { 
    this.sound.nav(); 
    this.router.navigate(['/evenements']); }
}