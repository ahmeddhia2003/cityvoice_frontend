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
}


// ============================================================
// SERVICE
// ============================================================

@Injectable({ providedIn: 'root' })
export class AuthService {

  // ============================================================
  // CONSTANTS
  // ============================================================

  private readonly AUTH_URL  = `${environment.apiUrl}/api/auth`;
  private readonly TOKEN_KEY = 'cv_token';
  private readonly USER_KEY  = 'cv_user';


  // ============================================================
  // STATE SUBJECTS
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
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}


  // ============================================================
  // PRIVATE METHODS
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
  // AUTHENTICATION CORE
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
            email:  credentials.email,
          }));

          this.setLoading(true, 'Connexion en cours…');

          setTimeout(() => {
            this.authStateSubject.next();
            this.setLoading(false, undefined, 'Bienvenue sur CityVoice 🎉', 'success');

            // Redirect based on role
            setTimeout(() => {
              if (res.role === 'ADMIN_VILLE') {
                this.router.navigate(['/admin']);
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
  // PASSWORD MANAGEMENT
  // ============================================================

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/reset-password`, { token, password });
  }


  // ============================================================
  // EMAIL VERIFICATION
  // ============================================================

  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.AUTH_URL}/verify-email?token=${token}`);
  }

  resendVerification(email: string): Observable<any> {
    return this.http.post(`${this.AUTH_URL}/resend-verification`, { email });
  }


  // ============================================================
  // USER PROFILE
  // ============================================================

  updatePhoto(userId: string, base64Photo: string): Observable<any> {
    return this.http.put(
      `${environment.apiUrl}/api/users/${userId}/photo`,
      { photo: base64Photo }
    );
  }


  // ============================================================
  // AUTH STATE HELPERS
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

  getRole(): string | null {
    return this.getCurrentUser()?.role ?? null;
  }


  // ============================================================
  // ROLE CHECKERS
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
}
