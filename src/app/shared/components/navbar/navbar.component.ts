import {
  Component, HostListener, AfterViewInit,
  ElementRef, OnInit, OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LangService, Lang } from '../../../core/services/lang.service';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
declare const gsap: any;

export interface Notification {
  id: number;
  type: 'resolved' | 'progress' | 'badge' | 'info';
  message: string;
  time: string;
  read: boolean;
}

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  scrolled     = false;
  notifsOpen   = false;
  userMenuOpen = false;

  // Auth
  isAuthenticated = false;
  authLoading     = true;   // ← nouveau : état de chargement
  currentUser: any = null;

  // Toast
  toastMsg  = '';
  toastType: 'success' | 'error' = 'success';
  toast     = false;
  private toastTimeout: any;

  private authSub!: Subscription;

  notifications: Notification[] = [
    { id:1, type:'resolved', message:'Votre signalement "Trou chaussée – Av. Bourguiba" a été résolu.', time:'il y a 2h', read:false },
    { id:2, type:'progress', message:'L\'équipe Voirie Nord a pris en charge votre signalement.',        time:'il y a 5h', read:false },
    { id:3, type:'badge',    message:'Vous avez obtenu le badge "Sentinelle de la ville" 🏅',            time:'hier',      read:false },
    { id:4, type:'info',     message:'Nouvel événement : Plantation d\'arbres – Parc El Menzah.',        time:'il y a 2j', read:true  },
    { id:5, type:'resolved', message:'Le lampadaire cassé rue de la Liberté a été réparé.',              time:'il y a 3j', read:true  },
  ];

  get unreadCount(): number { return this.notifications.filter(n => !n.read).length; }

  constructor(
    public lang: LangService,
    public sound: SoundService,
    private authService: AuthService,
    private userService: UserService,
    private el: ElementRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.authState$.subscribe(() => {
      this.updateAuthState();
    });
    this.updateAuthState();
  }

  private updateAuthState(): void {
    this.isAuthenticated = this.authService.isLoggedIn();
    const user = this.authService.getCurrentUser();

    if (this.isAuthenticated && user) {
      this.authLoading = true;  // commence le chargement
      this.userService.getById(user.userId).subscribe({
        next: (fullUser) => {
          this.currentUser = {
            id:     fullUser.id,
            email:  fullUser.email,
            role:   fullUser.role,
            nom:    fullUser.nom,
            points: fullUser.points || 0,
            photo:  fullUser.photo || null,
            telephone: fullUser.telephone || null,
          };
          this.authLoading = false;  // chargement terminé
          this.animateUserIn();
        },
        error: () => {
          this.currentUser = {
            id:     user.userId,
            email:  user.email,
            role:   user.role,
            nom:    user.email?.split('@')[0] || 'Utilisateur',
            points: 0,
            photo:  null,
            telephone: null,
          };
          this.authLoading = false;
          this.animateUserIn();
        }
      });
    } else {
      this.currentUser  = null;
      this.authLoading  = false;
    }
  }

  // Animation d'apparition du bloc utilisateur
  private animateUserIn(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      const el = document.querySelector('.user-menu-wrap');
      if (el) {
        gsap.fromTo(el,
          { opacity: 0, x: 20, scale: 0.92 },
          { opacity: 1, x: 0,  scale: 1, duration: .5, ease: 'back.out(1.6)' }
        );
      }
    }, 50);
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    gsap.fromTo(
      this.el.nativeElement.querySelector('nav'),
      { y: -80, opacity: 0 },
      { y: 0, opacity: 1, duration: .8, ease: 'power3.out', delay: .3 }
    );
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  @HostListener('window:scroll')
  onScroll(): void { this.scrolled = window.scrollY > 50; }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.notifsOpen  = false;
    this.userMenuOpen = false;
  }

  toggleNotifs(): void {
    this.sound.nav();
    this.notifsOpen = !this.notifsOpen;
    if (this.notifsOpen && typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('.nd-item',
          { opacity:0, y:8 },
          { opacity:1, y:0, duration:.3, stagger:.05, ease:'power2.out' }
        );
      }, 10);
    }
  }

  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; this.sound.nav(); }
  closeUserMenu():  void { this.userMenuOpen = false; }

  readNotif(n: Notification): void  { n.read = true; }
  markAllRead(e: Event): void {
    e.stopPropagation();
    this.notifications.forEach(n => n.read = true);
    this.sound.toggle2(true);
  }

  setLang(l: Lang): void { this.sound.nav(); this.lang.switch(l); }

  toggleSound(): void {
    this.sound.toggle();
    if (this.sound.isEnabled) this.sound.click();
  }

  onBtnClick(): void { this.sound.click(); }

  getFullName(): string {
    if (!this.currentUser) return 'Utilisateur';
    const nom = this.currentUser.nom || this.currentUser.email?.split('@')[0] || 'Utilisateur';
    return nom.split(' ').map((w: string) =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
  }

  getFirstName(): string {
    return this.getFullName().split(' ')[0];
  }

  getUserInitials(): string {
    const parts = this.getFullName().split(' ');
    return parts.length === 1
      ? parts[0].charAt(0).toUpperCase()
      : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getUserPoints(): number { return this.currentUser?.points || 0; }

  getRoleLabel(): string {
    const map: Record<string, string> = {
      CITOYEN:       'Citoyen',
      CHEF_EQUIPE:   'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain',
      MODERATEUR:    'Modérateur',
      ADMIN_VILLE:   'Admin',
    };
    return map[this.currentUser?.role ?? ''] ?? 'Utilisateur';
  }

  getRoleColor(): string {
    const map: Record<string, string> = {
      CITOYEN:       '#0D9B76',
      CHEF_EQUIPE:   '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E',
      MODERATEUR:    '#E8532A',
      ADMIN_VILLE:   '#7C3AED',
    };
    return map[this.currentUser?.role ?? ''] ?? '#8888A8';
  }

  getRoleBg(): string {
    const map: Record<string, string> = {
      CITOYEN:       'rgba(13,155,118,.1)',
      CHEF_EQUIPE:   'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)',
      MODERATEUR:    'rgba(232,83,42,.1)',
      ADMIN_VILLE:   'rgba(124,58,237,.1)',
    };
    return map[this.currentUser?.role ?? ''] ?? 'rgba(136,136,168,.1)';
  }

  logout(): void {
    // Animer la sortie du bloc user avant de déconnecter
    const el = document.querySelector('.user-menu-wrap');
    if (el && typeof gsap !== 'undefined') {
      gsap.to(el, {
        opacity: 0, x: 20, scale: 0.92, duration: .3, ease: 'power2.in',
        onComplete: () => { this.doLogout(); }
      });
    } else {
      this.doLogout();
    }
  }

  private doLogout(): void {
    this.authService.logout();
    this.userMenuOpen = false;
    this.sound.success();
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg  = msg;
    this.toastType = type;
    this.toast     = true;

    setTimeout(() => {
      const el = document.querySelector('.nav-toast');
      if (!el || typeof gsap === 'undefined') {
        setTimeout(() => { this.toast = false; }, 3000);
        return;
      }
      gsap.killTweensOf(el);
      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0,  duration: .4, ease: 'back.out(1.6)' }
      );
      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        gsap.to(el, {
          opacity: 0, y: 30, duration: .35, ease: 'power2.in',
          onComplete: () => { this.toast = false; }
        });
      }, 3000);
    }, 50);
  }
  isChefEquipe(): boolean {
  return this.currentUser?.role === 'CHEF_EQUIPE';
}


}
