import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-payment-cancel',
  templateUrl: './payment-cancel.component.html',
  styleUrls: ['./payment-cancel.component.css']
})
export class PaymentCancelComponent {
  constructor(private router: Router, public sound: SoundService, public i18n: I18nService) {}
  retour(): void { 
    this.sound.nav(); 
    this.router.navigate(['/evenements']); }
}