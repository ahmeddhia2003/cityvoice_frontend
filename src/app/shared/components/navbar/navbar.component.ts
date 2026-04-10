import {
  Component, HostListener, AfterViewInit,
  ElementRef, OnInit, OnDestroy
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LangService, Lang } from '../../../core/services/lang.service';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { NotificationService, AppNotification } from '../../../core/services/notification.service';
import { ThemeService } from '../../../core/services/theme.service';
declare const gsap: any;

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  scrolled = false;
  isHomePage = true;
  notifsOpen = false;
  userMenuOpen = false;

  isAuthenticated = false;
  authLoading = true;
  currentUser: any = null;

  toastMsg = '';
  toastType: 'success' | 'error' = 'success';
  toast = false;
  private toastTimeout: any;

  private authSub!: Subscription;
  private notifSub!: Subscription;
  private incomingNotifSub!: Subscription;
  private seenNotifIds = new Set<number>();
  private notificationsHydrated = false;

  notifications: AppNotification[] = [];

  get unreadCount(): number { return this.notifSvc.unreadCount; }

  constructor(
    public lang: LangService,
    public sound: SoundService,
    public theme: ThemeService,
    private authService: AuthService,
    private userService: UserService,
    public notifSvc: NotificationService,
    private el: ElementRef,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.authSub = this.authService.authState$.subscribe(() => {
      this.updateAuthState();
    });
    this.updateAuthState();

    this.notifSub = this.notifSvc.notifs$.subscribe(notifs => {
      this.notifications = notifs;
      this.handleNotificationPopup(notifs);
    });

    this.incomingNotifSub = this.notifSvc.incomingNotifs$.subscribe(notif => {
      if (notif.lu) return;
      this.showToast(notif.message, 'success');
      this.sound.notification();
    });

    this.isHomePage = this.router.url === '/';
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isHomePage = (e.urlAfterRedirects ?? e.url) === '/';
    });
  }

  private updateAuthState(): void {
    this.isAuthenticated = this.authService.isLoggedIn();
    const user = this.authService.getCurrentUser();

    if (this.isAuthenticated && user) {
      this.authLoading = true;
      this.userService.getById(user.userId).subscribe({
        next: (fullUser) => {
          this.currentUser = {
            id: fullUser.id,
            email: fullUser.email,
            role: fullUser.role,
            nom: fullUser.nom,
            points: fullUser.points || 0,
            photo: fullUser.photo || null,
            telephone: fullUser.telephone || null,
          };
          this.authLoading = false;
          this.animateUserIn();
          this.notifSvc.init();
        },
        error: () => {
          this.currentUser = {
            id: user.userId,
            email: user.email,
            role: user.role,
            nom: user.email?.split('@')[0] || 'Utilisateur',
            points: 0,
            photo: null,
            telephone: null,
          };
          this.authLoading = false;
          this.animateUserIn();
          this.notifSvc.init();
        }
      });
    } else {
      this.currentUser = null;
      this.authLoading = false;
      this.notificationsHydrated = false;
      this.seenNotifIds.clear();
      this.notifSvc.destroy();
    }
  }

  private animateUserIn(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      const el = document.querySelector('.user-menu-wrap');
      if (el) {
        gsap.fromTo(el,
          { opacity: 0, x: 20, scale: 0.92 },
          { opacity: 1, x: 0, scale: 1, duration: .5, ease: 'back.out(1.6)' }
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
    this.notifSub?.unsubscribe();
    this.incomingNotifSub?.unsubscribe();
    this.notifSvc.destroy();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  @HostListener('window:scroll')
  onScroll(): void { this.scrolled = window.scrollY > 50; }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.notifsOpen = false;
    this.userMenuOpen = false;
  }

  toggleNotifs(): void {
    this.sound.nav();
    this.notifsOpen = !this.notifsOpen;
    if (this.notifsOpen && typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('.nd-item',
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: .3, stagger: .05, ease: 'power2.out' }
        );
      }, 10);
    }
  }

  toggleUserMenu(): void { this.userMenuOpen = !this.userMenuOpen; this.sound.nav(); }
  closeUserMenu(): void { this.userMenuOpen = false; }

  readNotif(n: AppNotification): void {
    this.notifSvc.marquerLue(n);
    if (n.lien) this.router.navigate([n.lien]);
  }

  markAllRead(e: Event): void {
    e.stopPropagation();
    this.notifSvc.marquerToutesLues();
    this.sound.toggle2(true);
  }

  notifIconType(type: string): 'resolved' | 'progress' | 'badge' | 'info' {
    return NotificationService.iconType(type);
  }

  notifTimeAgo(dateStr: string): string {
    return NotificationService.timeAgo(dateStr);
  }

  setLang(l: Lang): void { this.sound.nav(); this.lang.switch(l); }

  toggleSound(): void {
    this.sound.toggle();
    if (this.sound.isEnabled) this.sound.click();
  }

  toggleTheme(event: MouseEvent): void {
    this.sound.nav();
    this.theme.toggle(event.currentTarget as HTMLElement);
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
      CITOYEN: 'Citoyen',
      CHEF_EQUIPE: 'Chef d\'equipe',
      MEMBRE_EQUIPE: 'Agent terrain',
      MODERATEUR: 'Moderateur',
      ADMIN_VILLE: 'Admin',
    };
    return map[this.currentUser?.role ?? ''] ?? 'Utilisateur';
  }

  getRoleColor(): string {
    const map: Record<string, string> = {
      CITOYEN: '#0D9B76',
      CHEF_EQUIPE: '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E',
      MODERATEUR: '#E8532A',
      ADMIN_VILLE: '#7C3AED',
    };
    return map[this.currentUser?.role ?? ''] ?? '#8888A8';
  }

  getRoleBg(): string {
    const map: Record<string, string> = {
      CITOYEN: 'rgba(13,155,118,.1)',
      CHEF_EQUIPE: 'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)',
      MODERATEUR: 'rgba(232,83,42,.1)',
      ADMIN_VILLE: 'rgba(124,58,237,.1)',
    };
    return map[this.currentUser?.role ?? ''] ?? 'rgba(136,136,168,.1)';
  }

  logout(): void {
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

  isCitoyen(): boolean {
    return this.currentUser?.role === 'CITOYEN';
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg = msg;
    this.toastType = type;
    this.toast = true;

    setTimeout(() => {
      const el = document.querySelector('.nav-toast');
      if (!el || typeof gsap === 'undefined') {
        setTimeout(() => { this.toast = false; }, 3000);
        return;
      }

      gsap.killTweensOf(el);
      gsap.fromTo(el,
        { opacity: 0, x: 32 },
        { opacity: 1, x: 0, duration: .35, ease: 'power3.out' }
      );

      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        gsap.to(el, {
          opacity: 0, x: 32, duration: .3, ease: 'power2.in',
          onComplete: () => { this.toast = false; }
        });
      }, 3500);
    }, 50);
  }

  private handleNotificationPopup(notifs: AppNotification[]): void {
    if (!this.notificationsHydrated) {
      this.seenNotifIds = new Set(notifs.map(n => n.id));
      this.notificationsHydrated = true;
      return;
    }

    const newUnread = notifs.filter(n => !this.seenNotifIds.has(n.id) && !n.lu);
    notifs.forEach(n => this.seenNotifIds.add(n.id));

    if (newUnread.length === 0) return;

    const latest = newUnread.sort((a, b) =>
      new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
    )[0];

    this.showToast(latest.message, 'success');
    this.sound.notification();
  }
}
