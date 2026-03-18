import { Component, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {SoundService} from '../../../core/services/sound.service';
export interface NavItem {
  label:  string;
  route:  string;
  icon:   string;
  badge?: number;
  badgeColor?: 'coral' | 'teal';
}

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css'],
})
export class AdminSidebarComponent {

  activeRoute = '/admin';

  sections: { label: string; items: NavItem[] }[] = [
    {
      label: 'Tableau de bord',
      items: [
        { label: 'Vue d\'ensemble', route: '/admin',          icon: 'grid'     },
        { label: 'Carte live',      route: '/admin/carte',    icon: 'map',      badge: 3, badgeColor: 'teal' },
      ],
    },
    {
      label: 'Gestion',
      items: [
        { label: 'Signalements',    route: '/admin/signalements', icon: 'tool',     badge: 12, badgeColor: 'coral' },
        { label: 'Équipes terrain', route: '/admin/equipes',      icon: 'users'    },
        { label: 'Citoyens',        route: '/admin/citoyens',     icon: 'user'     },
        { label: 'Projets',         route: '/admin/projets',      icon: 'monitor'  },
        { label: 'Actualités',      route: '/admin/actualites',   icon: 'book'     },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { label: 'Analyse IA',      route: '/admin/ia',       icon: 'cpu',  badge: 5, badgeColor: 'coral' },
        { label: 'Rapports',        route: '/admin/rapports', icon: 'bar-chart' },
      ],
    },
    {
      label: 'Système',
      items: [
        { label: 'Paramètres',      route: '/admin/settings', icon: 'settings' },
      ],
    },
  ];

  constructor(
    private router: Router,
    public sound: SoundService,
  ) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.activeRoute = e.urlAfterRedirects;
    });
  }

  navigate(route: string): void {
    this.sound.nav();
    this.router.navigate([route]);
  }

  isActive(route: string): boolean {
    return this.activeRoute === route ||
      (route !== '/admin' && this.activeRoute.startsWith(route));
  }
}
