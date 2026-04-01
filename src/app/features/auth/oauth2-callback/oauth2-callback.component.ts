import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-oauth2-callback',
  template: `
    <div style="display:flex;align-items:center;justify-content:center;
                min-height:100vh;background:#F7F4EF;flex-direction:column;gap:16px">
      <div style="width:40px;height:40px;border:3px solid #E8532A;
                  border-top-color:transparent;border-radius:50%;
                  animation:spin .7s linear infinite"></div>
      <p style="font-family:'Plus Jakarta Sans',sans-serif;color:#8888A8;font-size:14px">
        Connexion en cours...
      </p>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </div>
  `,
})
export class OAuth2CallbackComponent implements OnInit {

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const token  = this.route.snapshot.queryParamMap.get('token');
    const userId = this.route.snapshot.queryParamMap.get('userId');
    const role   = this.route.snapshot.queryParamMap.get('role');
    const error  = this.route.snapshot.queryParamMap.get('error');

    if (error || !token) {
      // Fermer la popup et signaler l'erreur à la fenêtre parent
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_ERROR' }, '*');
        window.close();
      }
      return;
    }

    // Stocker le token dans la fenêtre PARENT
    if (window.opener) {
      window.opener.localStorage.setItem('cv_token', token);
      window.opener.localStorage.setItem('cv_user', JSON.stringify({ userId, role }));
      window.opener.postMessage({ type: 'OAUTH_SUCCESS' }, '*');
      window.close();
    } else {
      // Fallback si pas de popup (navigation directe)
      localStorage.setItem('cv_token', token!);
      localStorage.setItem('cv_user', JSON.stringify({ userId, role }));
      window.location.href = '/dashboard';
    }
  }
}
