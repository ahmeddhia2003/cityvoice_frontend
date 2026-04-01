import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OAuthService {

  private readonly BASE = 'http://localhost:8081';

  loginWithGoogle(): void {
    this.openPopup(`${this.BASE}/oauth2/authorization/google`, 'Google Login');
  }

  loginWithFacebook(): void {
    this.openPopup(`${this.BASE}/oauth2/authorization/facebook`, 'Facebook Login');
  }

  private openPopup(url: string, title: string): void {
    const width  = 500;
    const height = 600;
    const left   = window.screenX + (window.outerWidth  - width)  / 2;
    const top    = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      title,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    // Écouter quand la popup se ferme (après redirect vers callback)
    const timer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(timer);
        // Vérifier si le token a été stocké par OAuth2CallbackComponent
        const token = localStorage.getItem('cv_token');
        if (token) {
          window.location.href = '/landing';
        }
      }
    }, 500);
  }
}
