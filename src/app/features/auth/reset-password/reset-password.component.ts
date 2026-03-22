import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SoundService } from '../../../core/services/sound.service';
declare const gsap: any;

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pwd     = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return pwd && confirm && pwd !== confirm ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class ResetPasswordComponent implements OnInit {

  form!: FormGroup;
  token    = '';
  loading  = false;
  success  = false;
  showPwd  = false;
  showConfirmPwd = false;

  pwdScore = 0;
  pwdLabel = 'Force du mot de passe';
  pwdColor = '#8888A8';

  get pwdBars(): string[] {
    const map = ['', 'weak', 'fair', 'good', 'good'];
    return [0,1,2,3].map(i => i < this.pwdScore ? (map[this.pwdScore] ?? '') : '');
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    public sound: SoundService,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    this.form = this.fb.group({
      password:       ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword:['', Validators.required],
    }, { validators: passwordMatchValidator });

    this.form.get('password')?.valueChanges.subscribe(v => this.checkPwd(v));
  }

  private checkPwd(val: string): void {
    let score = 0;
    if (val.length >= 8)           score++;
    if (/[A-Z]/.test(val))         score++;
    if (/[0-9]/.test(val))         score++;
    if (/[^A-Za-z0-9]/.test(val))  score++;
    this.pwdScore = score;
    const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
    const colors = ['#8888A8','#E8532A','#C9973E','#0D9B76','#0D9B76'];
    this.pwdLabel = score > 0 ? `Mot de passe ${labels[score]}` : 'Force du mot de passe';
    this.pwdColor = colors[score];
  }

  togglePwd():        void { this.showPwd        = !this.showPwd; }
  toggleConfirmPwd(): void { this.showConfirmPwd = !this.showConfirmPwd; }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) { this.sound.toggle2(false); return; }

    this.loading = true;
    this.authService.resetPassword(this.token, this.form.value.password).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.sound.success();
        setTimeout(() => this.router.navigate(['/auth/signin']), 2500);
      },
      error: (err) => {
        this.loading = false;
        this.sound.toggle2(false);
        if (typeof gsap !== 'undefined') {
          gsap.to('.auth-submit', { x:[-6,6,-4,4,0], duration:.4, ease:'none' });
        }
      }
    });
  }
}
