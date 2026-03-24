import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
declare const gsap: any;

@Component({
  selector: 'app-email-pending',
  templateUrl: './email-pending.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class EmailPendingComponent implements OnInit {

  email        = '';
  resending    = false;
  justSent     = false;

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Récupérer l'email passé depuis signup
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { email?: string };
    this.email = state?.email ?? history.state?.email ?? '';

    // Si pas d'email → rediriger vers signup
    if (!this.email) {
      this.router.navigate(['/auth/signup']);
    }
  }

  resend(): void {
    if (this.resending) return;
    this.resending = true;
    this.justSent  = false;

    this.authService.resendVerification(this.email).subscribe({
      next: () => {
        this.resending = false;
        this.justSent  = true;

        // Animer le checkmark
        if (typeof gsap !== 'undefined') {
          setTimeout(() => {
            gsap.fromTo('.sent-badge',
              { scale: 0, opacity: 0 },
              { scale: 1, opacity: 1, duration: .4, ease: 'back.out(1.8)' }
            );
          }, 30);
        }

        // Reset "justSent" après 5s pour permettre un nouveau renvoi
        setTimeout(() => { this.justSent = false; }, 5000);
      },
      error: () => {
        this.resending = false;
        this.justSent  = true;
        setTimeout(() => { this.justSent = false; }, 5000);
      }
    });
  }

  goSignin(): void {
    this.router.navigate(['/auth/signin']);
  }
}
