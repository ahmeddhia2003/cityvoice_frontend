import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
import { UserService, UserBadgeDto } from '../../../core/services/user.service';
declare const gsap: any;

@Component({
  selector: 'app-public-profile',
  templateUrl: './public-profile.component.html',
  styleUrls: ['./public-profile.component.css'],
})
export class PublicProfileComponent implements OnInit {

  user:    any = null;
  badges:  UserBadgeDto[] = [];
  rank:    number = 0;
  loading  = true;

  constructor(
    private route:       ActivatedRoute,
    private location:    Location,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    forkJoin({
      profile:     this.userService.getPublicProfile(id),
      badges:      this.userService.getUserBadges(id),
      leaderboard: this.userService.getLeaderboard(100),
    }).subscribe({
      next: ({ profile, badges, leaderboard }) => {
        this.user    = profile;
        this.badges  = badges.slice(0, 6); // Top 6 badges
        this.rank    = leaderboard.findIndex((u: any) => u.id === id) + 1;
        this.loading = false;
        this.animateIn();
      },
      error: () => { this.loading = false; }
    });
  }

  private animateIn(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      gsap.fromTo('.pp-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: .4, stagger: .08, ease: 'power2.out' }
      );
    }, 50);
  }

  goBack(): void { this.location.back(); }

  initials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'Citoyen', CHEF_EQUIPE: 'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain', MODERATEUR: 'Modérateur',
      ADMIN_VILLE: 'Admin',
    };
    return map[role] ?? role;
  }

  roleColor(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: '#0D9B76', CHEF_EQUIPE: '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E', MODERATEUR: '#E8532A', ADMIN_VILLE: '#7C3AED',
    };
    return map[role] ?? '#8888A8';
  }

  roleBg(role: string): string {
    const map: Record<string, string> = {
      CITOYEN: 'rgba(13,155,118,.1)', CHEF_EQUIPE: 'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)', MODERATEUR: 'rgba(232,83,42,.1)',
      ADMIN_VILLE: 'rgba(124,58,237,.1)',
    };
    return map[role] ?? 'rgba(136,136,168,.1)';
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }
}
