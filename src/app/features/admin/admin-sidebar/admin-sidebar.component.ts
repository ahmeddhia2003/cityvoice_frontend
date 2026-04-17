import { Component, OnInit, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SoundService } from '../../../core/services/sound.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserDto } from '../../../core/services/user.service';

export interface NavItem {
  label:       string;
  route:       string;
  icon:        string;
  badge?:      number;
  badgeColor?: 'coral' | 'teal';
  children?:   NavItem[]; 
}

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css'],
})
export class AdminSidebarComponent implements OnInit {

  activeRoute  = '/admin';
  userMenuOpen = false;
  currentUser: UserDto | null = null;

  sections: { label: string; items: NavItem[] }[] = [
    {
      label: 'Tableau de bord',
      items: [
        { label: 'Vue d\'ensemble', route: '/admin',          icon: 'grid'      },
        { label: 'Carte live',      route: '/admin/carte',    icon: 'map',       badge: 3, badgeColor: 'teal' },
      ],
    },
    {
      label: 'Gestion',
      items: [
        { label: 'Signalements',    route: '/admin/signalements',       icon: 'tool',      badge: 12, badgeColor: 'coral' },
        { label: 'Équipes terrain', route: '/admin/equipes',            icon: 'users'     },
        { label: 'Utilisateurs',    route: '/admin/users',              icon: 'user'      },
        { 
          label: 'Événements', 
          route: '/admin/evenements', 
          icon: 'calendar',
          children: [
            { label: 'Scanner QR', route: '/admin/scan', icon: 'qr' },
            { label: 'Suggestions',  route: '/admin/suggestions', icon: 'suggestions' },
            { label: 'Sponsors', route: '/admin/sponsors', icon: 'handshake'},
            { label: 'Rapports hebdomadaires',  route: '/admin/sponsors/rapport',  icon: 'bar-chart'   },
          ]
        },
        { label: 'Projets',         route: '/admin/projets',            icon: 'monitor'   },
        { label: 'Actualités',      route: '/admin/actualites',         icon: 'book'      },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { label: 'Analyse IA',      route: '/admin/ia',                 icon: 'cpu',       badge: 5, badgeColor: 'coral' },
        { label: 'Rapports',        route: '/admin/rapports',           icon: 'bar-chart' },
      ],
    },
    {
      label: 'Système',
      items: [
        { label: 'Codes invitation', route: '/admin/invitation-codes',  icon: 'key'       },
        { label: 'Paramètres',       route: '/admin/settings',          icon: 'settings'  },
      ],
    },
  ];

  constructor(
    private router: Router,
    public sound: SoundService,
    private authService: AuthService,
    private userService: UserService,
  ) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.activeRoute = e.urlAfterRedirects;
    });
  }

  ngOnInit(): void {
    const auth = this.authService.getCurrentUser();
    if (auth?.userId) {
      this.userService.getById(auth.userId).subscribe({
        next: (u) => { this.currentUser = u; }
      });
    }
  }

  // Fermer le menu si clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.sb-user-wrap')) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(): void {
    this.sound.nav();
    this.userMenuOpen = !this.userMenuOpen;
  }

  navigate(route: string): void {
    this.sound.nav();
    this.router.navigate([route]);
  }

  navigateAndClose(route: string): void {
    this.sound.nav();
    this.userMenuOpen = false;
    this.router.navigate([route]);
  }

  logout(): void {
    this.sound.nav();
    this.userMenuOpen = false;
    this.authService.logout();
  }

  isActive(route: string): boolean {
    return this.activeRoute === route ||
      (route !== '/admin' && this.activeRoute.startsWith(route));
  }

  get userInitials(): string {
    if (!this.currentUser?.nom) return 'AD';
    return this.currentUser.nom
      .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
  }

  get userRoleLabel(): string {
    const map: Record<string, string> = {
      ADMIN_VILLE:   'Super Admin',
      MODERATEUR:    'Modérateur',
      CHEF_EQUIPE:   'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain',
    };
    return map[this.currentUser?.role ?? ''] ?? 'Admin';
  }
}
