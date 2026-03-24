import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class VerifyEmailComponent implements OnInit {

  state: 'loading' | 'success' | 'error' | 'resend' = 'loading';
  email = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.state = 'error';
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.state = 'success';
        setTimeout(() => this.router.navigate(['/auth/signin']), 3000);
      },
      error: () => {
        this.state = 'error';
      }
    });
  }

  resend(): void {
    if (!this.email) return;
    this.authService.resendVerification(this.email).subscribe({
      next: () => { this.state = 'resend'; }
    });
  }
}
