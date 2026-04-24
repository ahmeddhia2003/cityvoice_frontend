import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
declare const gsap: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {

  showLoader     = true;
  isAdminRoute   = false;
  isAuthRoute    = false;   // hide banners on signin/signup/etc.
  showAuthLoader = false;
  authLoaderMsg  = '';
  showFooter = true;


  // Banner heights — fed by the two banner components in the template
  private _weatherBannerHeight = 0;
  private _festiveBannerHeight = 0;

  get weatherBannerHeight() { return this._weatherBannerHeight; }
  set weatherBannerHeight(v: number) {
    // setTimeout(0) évite NG0100 ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => { this._weatherBannerHeight = v; this.cdr.detectChanges(); });
  }

  get festiveBannerHeight() { return this._festiveBannerHeight; }
  set festiveBannerHeight(v: number) {
    setTimeout(() => { this._festiveBannerHeight = v; this.cdr.detectChanges(); });
  }

  /** Total extra offset que les bannières ajoutent — lu via CSS var */
  get bannerOffset(): number { return this._weatherBannerHeight + this._festiveBannerHeight; }


  // ── Toast sur le loading screen ──────────────────────
  showLoaderToast    = false;
  loaderToastMsg     = '';
  loaderToastType: 'success' | 'error' = 'success';

  constructor(
    private router: Router,
    private authService: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (sessionStorage.getItem('madina_loaded')) {
      this.showLoader = false;
    }

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const url = e.urlAfterRedirects as string;
      this.isAdminRoute = url.startsWith('/admin');
      this.isAuthRoute  = url.startsWith('/auth');
    });

    this.isAdminRoute = this.router.url.startsWith('/admin');
    this.isAuthRoute  = this.router.url.startsWith('/auth');

    // ── Auth loading screen ──────────────────────────
    this.authService.authLoading$.subscribe(({ loading, message, toastMsg, toastType }) => {
      this.ngZone.run(() => {
        if (loading) {
          this.authLoaderMsg  = message || '';
          this.showAuthLoader = true;

          // Attendre le rendu Angular puis animer
          setTimeout(() => {
            if (typeof gsap !== 'undefined') {
              const el = document.querySelector('.auth-loader');
              if (el) {
                gsap.killTweensOf(el);
                gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .35 });
              }
            }
          }, 30);

        } else {
          // Afficher le toast AVANT de fermer le loader
          if (toastMsg) {
            this.loaderToastMsg  = toastMsg;
            this.loaderToastType = toastType ?? 'success';
            this.showLoaderToast = true;
          }

          if (typeof gsap !== 'undefined') {
            const el = document.querySelector('.auth-loader');
            if (el) {
              gsap.killTweensOf(el);
              // Délai pour laisser le toast visible sur le loader
              setTimeout(() => {
                gsap.to(el, {
                  opacity: 0, duration: .4, delay: toastMsg ? .8 : 0,
                  onComplete: () => {
                    this.ngZone.run(() => {
                      this.showAuthLoader  = false;
                      this.showLoaderToast = false;
                    });
                  }
                });
              }, 50);
            } else {
              this.showAuthLoader  = false;
              this.showLoaderToast = false;
            }
          } else {
            this.showAuthLoader  = false;
            this.showLoaderToast = false;
          }
        }
      });
    });
  }

  onLoadingComplete(): void {
    this.showLoader = false;
    sessionStorage.setItem('madina_loaded', '1');
  }
}
