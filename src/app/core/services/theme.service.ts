import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare const gsap: any;

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private _isDark = new BehaviorSubject<boolean>(false);
  isDark$ = this._isDark.asObservable();

  get isDark(): boolean { return this._isDark.value; }

  constructor() {
    // Respect saved preference, then OS preference
    const saved = localStorage.getItem('madina-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    this._apply(dark, false);

    // Listen for OS preference changes (if no explicit choice saved)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('madina-theme')) {
        this._apply(e.matches, false);
      }
    });
  }

  toggle(originEl?: HTMLElement): void {
    const next = !this._isDark.value;
    localStorage.setItem('madina-theme', next ? 'dark' : 'light');

    // GSAP ripple animation from button origin
    if (typeof gsap !== 'undefined' && originEl) {
      const rect = originEl.getBoundingClientRect();
      const ripple = document.createElement('div');
      const size   = Math.max(window.innerWidth, window.innerHeight) * 2.4;
      Object.assign(ripple.style, {
        position:     'fixed',
        width:        size + 'px',
        height:       size + 'px',
        borderRadius: '50%',
        background:   next ? '#0D1117' : '#F7F4EF',
        left:         (rect.left + rect.width / 2 - size / 2) + 'px',
        top:          (rect.top  + rect.height / 2 - size / 2) + 'px',
        zIndex:       '9999',
        pointerEvents:'none',
        transform:    'scale(0)',
      });
      document.body.appendChild(ripple);

      gsap.to(ripple, {
        scale: 1,
        duration: 0.6,
        ease: 'power3.inOut',
        onComplete: () => {
          this._apply(next, false);
          ripple.remove();
        },
      });
    } else {
      this._apply(next, true);
    }
  }

  private _apply(dark: boolean, animate: boolean): void {
    this._isDark.next(dark);
    const html = document.documentElement;

    if (animate && typeof gsap !== 'undefined') {
      gsap.to('body', {
        opacity: 0.6, duration: 0.15, ease: 'power2.in',
        onComplete: () => {
          html.classList.toggle('dark', dark);
          gsap.to('body', { opacity: 1, duration: 0.25, ease: 'power2.out' });
        },
      });
    } else {
      html.classList.toggle('dark', dark);
    }
  }
}
