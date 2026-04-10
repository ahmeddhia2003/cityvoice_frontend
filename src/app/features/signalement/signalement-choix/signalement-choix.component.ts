import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-signalement-choix',
  templateUrl: './signalement-choix.component.html',
  styleUrls: ['./signalement-choix.component.css'],
})
export class SignalementChoixComponent {
  constructor(private router: Router) {}

  goForm()  { this.router.navigate(['/signaler/new']); }
  goVoice() { this.router.navigate(['/signaler/voice']); }
}
