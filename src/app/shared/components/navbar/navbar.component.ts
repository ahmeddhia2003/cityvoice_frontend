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
import { AutoTranslateService } from '../../../core/services/auto-translate.service';
import { EvenementNotificationService } from '../../../core/services/evenement-notification.service';
import { EvenementNotification } from '../../../features/evenement/models/evenement-notification.model';
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

  // Auth
  isAuthenticated = false;
  authLoading = true;
  currentUser: any = null;

  // Toast
  toastMsg  = '';
  toastType: 'success' | 'error' = 'success';
  toast     = false;
  private toastTimeout: any;

  private authSub!: Subscription;
  private notifSub!: Subscription;
  private incomingNotifSub!: Subscription;
  private seenNotifIds = new Set<number>();
  private notificationsHydrated = false;
  //notif evenement
  evNotifications: EvenementNotification[] = [];
  evNonLues = 0;

  notifications: AppNotification[] = [];

  get unreadCount(): number { return this.notifSvc.unreadCount; }

  constructor(
    public lang: LangService,
    public sound: SoundService,
    public theme: ThemeService,
    private authService: AuthService,
    private userService: UserService,
    public notifSvc: NotificationService,
    public autoTranslate: AutoTranslateService,
    private el: ElementRef,
    private router: Router,
    public notifService: EvenementNotificationService
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
            id:     fullUser.id,
            email:  fullUser.email,
            role:   fullUser.role,
            nom:    fullUser.nom,
            points: fullUser.points || 0,
            photo:  fullUser.photo || null,
            telephone: fullUser.telephone || null,
          };
          this.authLoading = false;
          this.animateUserIn();
          this.notifSvc.init();
          // notif
          this.notifService.init(user.userId);
          this.notifService.getNotifications().subscribe(notifs => {
            this.evNotifications = notifs;
          });
          this.notifService.getNonLues().subscribe(count => {
            this.evNonLues = count;
          });
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
          this.notifSvc.init();
          // notif
          this.notifService.init(user.userId);
          this.notifService.getNotifications().subscribe(notifs => {
            this.evNotifications = notifs;
          });
          this.notifService.getNonLues().subscribe(count => {
            this.evNonLues = count;
          });
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
    this.notifSub?.unsubscribe();
    this.incomingNotifSub?.unsubscribe();
    this.notifSvc.destroy();
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

  readNotif(n: AppNotification): void {
    this.notifSvc.marquerLue(n);
    if (n.lien) this.router.navigate([n.lien]);
  }

  //notif
  readNotiftass(n: EvenementNotification): void {
    if (!n.lu) {
      this.notifService.marquerLue(n.id);
    }
  }

  markAllRead(e: Event): void {
    e.stopPropagation();
    this.notifSvc.marquerToutesLues();
    const user = this.authService.getCurrentUser();
    if (user?.userId) {
      this.notifService.marquerToutesLues(user.userId);
    }
    this.sound.toggle2(true);
  }

  notifIconType(type: string): 'resolved' | 'progress' | 'badge' | 'info' {
    return NotificationService.iconType(type);
  }

  notifTimeAgo(dateStr: string): string {
    return NotificationService.timeAgo(dateStr);
  }

  setLang(l: Lang): void {
    this.sound.nav();
    // Conserver la synchronisation avec le LangService existant (textes i18n manuels)
    this.lang.switch(l);
    // Traduction AUTOMATIQUE du reste de la page via l'API
    this.autoTranslate.switch(l).catch(err =>
      console.warn('[navbar] auto-translate failed', err)
    );
  }

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
    this.notifService.deconnecter();
    this.authService.logout();
    this.userMenuOpen = false;
    this.sound.success();
  }

  isCitoyen(): boolean {
    return this.currentUser?.role === 'CITOYEN';
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

  isChefEquipe(): boolean {
    return this.currentUser?.role === 'CHEF_EQUIPE';
  }
}
