import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OAuthService {

  private readonly BASE = 'http://localhost:8081';
  private popup: Window | null = null;
  private pollTimer: any = null;

  loginWithGoogle(): void {
    this.openPopup(
      `${this.BASE}/oauth2/authorization/google`,
      'Connexion Google'
    );
  }

  loginWithFacebook(): void {
    this.openPopup(
      `${this.BASE}/oauth2/authorization/facebook`,
      'Connexion Facebook'
    );
  }

  private openPopup(url: string, title: string): void {
    // Fermer un popup existant
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    const width  = 500;
    const height = 640;
    const left   = window.screenX + (window.outerWidth  - width)  / 2;
    const top    = window.screenY + (window.outerHeight - height) / 2;

    this.popup = window.open(
      url,
      title,
      `width=${width},height=${height},left=${left},top=${top},` +
      `resizable=yes,scrollbars=yes,status=yes`
    );

    // Focus sur le popup
    if (this.popup) {
      this.popup.focus();
    }

    // Écouter la fermeture
    this.pollTimer = setInterval(() => {
      if (this.popup?.closed) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
        // Le token est géré par OAuth2CallbackComponent via postMessage
      }
    }, 500);
  }

  closePopup(): void {
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }
}
