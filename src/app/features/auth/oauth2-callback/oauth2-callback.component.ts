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
    const email  = this.route.snapshot.queryParamMap.get('email'); // optional
    const error  = this.route.snapshot.queryParamMap.get('error');

    if (error || !token) {
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_ERROR' }, '*');
        window.close();
      }
      return;
    }

    if (window.opener) {
      // Store in parent window
      window.opener.localStorage.setItem('cv_token', token);
      window.opener.localStorage.setItem(
        'cv_user',
        JSON.stringify({
          userId,
          role,
          email: email ?? ''
        })
      );

      // 🔥 FIX: send full payload (not just type)
      window.opener.postMessage({
        type: 'OAUTH_SUCCESS',
        token,
        userId,
        role,
        email
      }, '*');

      window.close();

    } else {
      // fallback (no popup)
      localStorage.setItem('cv_token', token);
      localStorage.setItem(
        'cv_user',
        JSON.stringify({
          userId,
          role,
          email: email ?? ''
        })
      );

      window.location.href = '/dashboard';
    }
  }
}
