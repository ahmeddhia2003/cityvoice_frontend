import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { SoundService } from '../../../core/services/sound.service';
declare const gsap: any;

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class ForgotPasswordComponent {

  form!: FormGroup;
  loading  = false;
  sent     = false;
  toast    = false;
  toastMsg = '';
  toastType = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    public sound: SoundService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.sound.toggle2(false); return; }

    this.loading = true;
    this.authService.forgotPassword(this.form.value.email).subscribe({
      next: () => {
        this.loading = false;
        this.sent    = true;
        this.sound.success();
      },
      error: () => {
        this.loading = false;
        // Afficher quand même "envoyé" pour ne pas révéler si l'email existe
        this.sent = true;
      }
    });
  }

  goSignin(): void { this.sound.nav(); this.router.navigate(['/auth/signin']); }
}
