import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    // ── Non connecté → login ───────────────────────────
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/signin']);
      return false;
    }

    // ── Vérifier le rôle requis si spécifié ───────────
    const requiredRole = route.data['role'] as string | undefined;

    if (requiredRole) {
      const userRole = this.authService.getRole();
      if (userRole !== requiredRole) {
        // Rôle insuffisant → rediriger selon le rôle réel
        if (userRole === 'ADMIN_VILLE') {
          this.router.navigate(['/admin']);
        } else if (userRole === 'CHEF_EQUIPE') {
          this.router.navigate(['/chef']);
        } else {
          this.router.navigate(['/landing']);
        }
        return false;
      }
    }

    return true;
  }
}
