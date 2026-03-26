import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { OAuthService } from '../../../core/services/oauth.service';
declare const gsap: any;

const GOOGLE_CLIENT_ID = '708809148864-3vgl3squpdptt0go0unq79njnqhci3go.apps.googleusercontent.com';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class SigninComponent implements OnInit, AfterViewInit {

  form!: FormGroup;
  showPwd  = false;
  loading  = false;
  success  = false;

  toast     = false;
  toastMsg  = '';
  toastType: 'success' | 'error' = 'success';

  // oauth
  oauthLoading: 'google' | 'facebook' | null = null;


  constructor(
    private fb: FormBuilder,
    private router: Router,
    public sound: SoundService,
    private authService: AuthService,
    private oauthService: OAuthService,
  ) {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/landing']);
    }
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    window.addEventListener('message', this.onOAuthMessage.bind(this));
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onOAuthMessage.bind(this));
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    this.runEntrance();
  }

  private runEntrance(): void {
    const tl = gsap.timeline();
    tl
      .fromTo('.auth-left', { x:-80, opacity:0 }, { x:0, opacity:1, duration:.8 }, .1)
      .fromTo('.auth-card', { opacity:0, y:30 },   { opacity:1, y:0, duration:.7 }, .5);
  }

  // ── OAuth ────────────────────────────────────────────────
  loginWithGoogle(): void {
    this.sound.click();
    this.oauthLoading = 'google';
    this.oauthService.loginWithGoogle();

    // Reset loading si popup fermée sans succès
    setTimeout(() => {
      if (this.oauthLoading === 'google') {
        this.oauthLoading = null;
      }
    }, 60000); // timeout 1 minute
  }

  loginWithFacebook(): void {
    this.sound.click();
    this.oauthLoading = 'facebook';
    this.oauthService.loginWithFacebook();

    setTimeout(() => {
      if (this.oauthLoading === 'facebook') {
        this.oauthLoading = null;
      }
    }, 60000);
  }

  private onOAuthMessage(event: MessageEvent): void {
    if (event.data?.type === 'OAUTH_SUCCESS') {
      this.oauthLoading = null;
      this.authService.handleOAuthSuccess(
        event.data.token,
        event.data.userId,
        event.data.role
      );
      setTimeout(() => {
        const role = event.data.role;
        this.router.navigate([role === 'ADMIN_VILLE' ? '/admin' : '/landing']);
      }, 1600);
    } else if (event.data?.type === 'OAUTH_ERROR') {
      this.oauthLoading = null;
      this.showToast('Erreur de connexion ❌', 'error');
    }
  }

  // ── Form ─────────────────────────────────────────────────
  togglePwd(): void { this.sound.nav(); this.showPwd = !this.showPwd; }
  onInput():   void { this.sound.nav(); }

  onSubmit(): void {
    if (this.loading) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.sound.toggle2(false);
      gsap.to('.auth-submit', { x:[-6,6,-4,4,-2,2,0], duration:.4 });
      return;
    }

    this.sound.click();
    const start  = Date.now();
    this.loading = true;

    this.authService.login(this.form.value).subscribe({
      next: () => {
        const delay = Math.max(600 - (Date.now() - start), 0);
        setTimeout(() => {
          this.loading = false;
          this.success = true;
          this.sound.success();
        }, delay);
      },
      error: (err) => {
        const delay = Math.max(600 - (Date.now() - start), 0);
        setTimeout(() => {
          this.loading = false;
          this.sound.toggle2(false);
          gsap.to('.auth-submit', { x:[-6,6,-4,4,-2,2,0], duration:.4 });

          // Parse error body (might be string or object)
          let errorBody = err.error;
          if (typeof errorBody === 'string') {
            try {
              errorBody = JSON.parse(errorBody);
            } catch {
              errorBody = {};
            }
          }

          console.log('Login error:', err.status, errorBody); // Debug

          // ── Email non vérifié ──────────────────────────────
          if (err.status === 403 && errorBody?.error === 'EMAIL_NOT_VERIFIED') {
            this.showToast(errorBody?.message || 'Veuillez vérifier votre email', 'error');
            setTimeout(() => {
              this.router.navigate(['/auth/email-pending'], {
                state: { email: this.form.value.email }
              });
            }, 1500);
            return;
          }

          // ── User Banned ──────────────────────────────
          if (err.status === 403 && errorBody?.error === 'USER_BANNED') {
            this.showToast(errorBody?.message || 'Compte suspendu', 'error');
            return;
          }

          const msg = err.status === 401
            ? 'Email ou mot de passe incorrect ❌'
            : err.status === 403
              ? errorBody?.message || 'Accès refusé'
              : 'Erreur serveur, réessayez !';
          this.showToast(msg, 'error');
        }, delay);
      }
    });
  }

  goSignup():  void { this.sound.nav(); this.router.navigate(['/auth/signup']); }
  forgotPwd(): void { this.sound.nav(); this.router.navigate(['/auth/forgot-password']); }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg  = msg;
    this.toastType = type;
    this.toast     = true;

    setTimeout(() => {
      const el = document.querySelector('.auth-toast');
      if (!el || typeof gsap === 'undefined') return;
      gsap.fromTo(el,
        { opacity:0, y:30 },
        { opacity:1, y:0, duration:.4 }
      );
      setTimeout(() => {
        gsap.to(el, {
          opacity:0, y:30, duration:.35,
          onComplete: () => { this.toast = false; }
        });
      }, 3000);
    }, 0);
  }
}
