import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/auth.model';

// ============================================================
// INTERFACES
// ============================================================

export interface RegisterRequest {
  nom:             string;
  email:           string;
  password:        string;
  telephone?:      string;
  role:            string;
  invitationCode?: string;
  gouvernorat?:    string;
  ville?:          string;
  codePostal?:     string;
  photo?: string;
}

// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ============================================================
  // 1. PROPRIÉTÉS PRIVÉES - CONSTANTES
  // ============================================================

  private readonly AUTH_URL  = `${environment.apiUrl}/api/auth`;
  private readonly TOKEN_KEY = 'cv_token';
  private readonly USER_KEY  = 'cv_user';

  // ============================================================
  // 2. PROPRIÉTÉS PRIVÉES - ÉTATS (SUBJECTS)
  // ============================================================

  // Auth state for navbar refresh
  private authStateSubject = new Subject<void>();
  authState$ = this.authStateSubject.asObservable();

  // Auth loading screen state
  private authLoadingSubject = new Subject<{
    loading:   boolean;
    message?:  string;
    toastMsg?: string;
    toastType?: 'success' | 'error';
  }>();
  authLoading$ = this.authLoadingSubject.asObservable();

  // ============================================================
  // 3. CONSTRUCTEUR
  // ============================================================

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // ============================================================
  // 4. MÉTHODES PRIVÉES - HELPERS INTERNES
  // ============================================================

  private setLoading(
    loading: boolean,
    message?: string,
    toastMsg?: string,
    toastType?: 'success' | 'error'
  ): void {
    this.authLoadingSubject.next({ loading, message, toastMsg, toastType });
  }

  // ============================================================
  // 5. MÉTHODES PUBLIQUES - AUTHENTIFICATION CORE
  // ============================================================

  /**
   * Login user and store token
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.AUTH_URL}/login`, credentials)
      .pipe(
        tap(res => {

          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify({
            userId: res.userId,
            role:   res.role,
            email: credentials.email
          }));

          this.setLoading(true, 'Connexion en cours…');

          setTimeout(() => {
            this.authStateSubject.next();
            this.setLoading(false, undefined, 'Bienvenue sur CityVoice 🎉', 'success');

            // Redirect based on role
            setTimeout(() => {
              if (res.role === 'ADMIN_VILLE') {
                this.router.navigate(['/admin']);
              } else if (res.role === 'CHEF_EQUIPE') {
                this.router.navigate(['/chef']);
              } else {
                this.router.navigate(['/landing']);
              }
            }, 800);
          }, 1200);
        })
      );
  }

  /**
   * Register new user
   */
  register(data: RegisterRequest): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/register`, data);
  }

  /**
   * Logout user and clear session
   */
  logout(): void {
    this.setLoading(true, 'Déconnexion…');

    setTimeout(() => {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      this.authStateSubject.next();
      this.setLoading(false, undefined, 'À bientôt 👋', 'success');

      setTimeout(() => {
        this.router.navigate(['/']);
      }, 800);
    }, 1200);
  }

  // ============================================================
  // 6. MÉTHODES PUBLIQUES - VALIDATION & MODÉRATION
  // ============================================================

  screenName(name: string): Observable<{ appropriate: boolean; reason?: string }> {
    return this.http.post<any>(
      `${environment.apiUrl}/api/ai/screen-name`,
      { name }
    );
  }

  checkEmail(email: string): Observable<{ exists: boolean }> {
    return this.http.get<{ exists: boolean }>(
      `${environment.apiUrl}/api/auth/check-email?email=${email}`
    );
  }

  moderatePhoto(base64: string): Observable<{ safe: boolean; reason: string }> {
    return this.http.post<any>(
      `${environment.apiUrl}/api/auth/moderate-photo`,
      { photo: base64 }
    );
  }

  // ============================================================
  // 7. MÉTHODES PUBLIQUES - GESTION DES MOTS DE PASSE
  // ============================================================

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/reset-password`, { token, password });
  }

  // ============================================================
  // 8. MÉTHODES PUBLIQUES - VÉRIFICATION EMAIL
  // ============================================================

  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.AUTH_URL}/verify-email?token=${token}`);
  }

  resendVerification(email: string): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/resend-verification`, { email });
  }

  // ============================================================
  // 9. MÉTHODES PUBLIQUES - GESTION DU PROFIL
  // ============================================================

  updatePhoto(userId: string, base64Photo: string): Observable<any> {
    return this.http.put(
      `${environment.apiUrl}/api/users/${userId}/photo`,
      { photo: base64Photo }
    );
  }

  // ============================================================
  // 10. MÉTHODES PUBLIQUES - ÉTAT D'AUTHENTIFICATION (GETTERS)
  // ============================================================

  refreshAuthState(): void {
    this.authStateSubject.next();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): { userId: string; role: string; email: string } | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  getCurrentUserWithEmail(): { userId: string; role: string; email: string; nom: string } | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    
    const user = JSON.parse(raw);
    
    if (!user.email) {
      const token = localStorage.getItem(this.TOKEN_KEY);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          user.email = payload.sub || '';
          user.nom = payload.sub?.split('@')[0] || '';
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        } catch (e) {}
      }
    }
    
    return user;
  }
  getRole(): string | null {
    return this.getCurrentUser()?.role ?? null;
  }

  handleOAuthSuccess(token: string, userId: string, role: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify({ userId, role, email: '' }));
    this.setLoading(true, 'Connexion en cours…');
    setTimeout(() => {
      this.authStateSubject.next();
      this.setLoading(false, undefined, 'Bienvenue sur CityVoice 🎉', 'success');
      setTimeout(() => {
        if (role === 'ADMIN_VILLE') {
          this.router.navigate(['/admin']);
        } else if (role === 'CHEF_EQUIPE') {
          this.router.navigate(['/chef']);
        } else {
          this.router.navigate(['/landing']);
        }
      }, 800);
    }, 1200);
  }

  // ============================================================
  // 11. MÉTHODES PUBLIQUES - VÉRIFICATIONS DE RÔLES
  // ============================================================

  isAdmin(): boolean {
    return this.getRole() === 'ADMIN_VILLE';
  }

  isAgent(): boolean {
    const r = this.getRole();
    return r === 'CHEF_EQUIPE' || r === 'MEMBRE_EQUIPE' || r === 'MODERATEUR';
  }

  isCitoyen(): boolean {
    return this.getRole() === 'CITOYEN';
  }
  canViewCv(): boolean {
  const role = this.getRole();

  return role !== 'CITOYEN' && role !== 'MEMBRE_EQUIPE';
}
getUserId(): string | null {
  return this.getCurrentUser()?.userId ?? null;
}


}
