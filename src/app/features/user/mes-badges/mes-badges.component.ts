import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, BadgeDto, UserBadgeDto } from '../../../core/services/user.service';
import { Location } from '@angular/common';
import { forkJoin } from 'rxjs';
declare const gsap: any;

interface BadgeWithStatus extends BadgeDto {
  obtained:   boolean;
  obtainedAt: string | null;
}

@Component({
  selector: 'app-mes-badges',
  templateUrl: './mes-badges.component.html',
  styleUrls: ['./mes-badges.component.css'],
})
export class MesBadgesComponent implements OnInit {

  badges:   BadgeWithStatus[] = [];
  loading   = true;
  filter:   'ALL' | 'OBTAINED' | 'LOCKED' = 'ALL';
  selected: BadgeWithStatus | null = null;

  readonly categories = ['PROFIL', 'COMMUNAUTE', 'ENGAGEMENT', 'SPECIAL'];

  readonly catLabels: Record<string, string> = {
    PROFIL:      'Profil',
    COMMUNAUTE:  'Communauté',
    ENGAGEMENT:  'Engagement',
    SPECIAL:     'Spécial',
  };

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private location: Location,
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    forkJoin({
      all:      this.userService.getAllBadges(),
      obtained: this.userService.getUserBadges(auth.userId),
    }).subscribe({
      next: ({ all, obtained }) => {
        const obtainedMap = new Map(obtained.map(ub => [ub.badge.code, ub.obtainedAt]));
        this.badges = all.map(b => ({
          ...b,
          obtained:   obtainedMap.has(b.code),
          obtainedAt: obtainedMap.get(b.code) ?? null,
        }));
        this.loading = false;
        this.animateIn();
      }
    });
  }

  private animateIn(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      gsap.fromTo('.badge-card',
        { opacity: 0, y: 20, scale: .9 },
        { opacity: 1, y: 0,  scale: 1,
          duration: .4, stagger: .06, ease: 'back.out(1.4)' }
      );
    }, 50);
  }

  get filtered(): BadgeWithStatus[] {
    return this.badges.filter(b => {
      if (this.filter === 'OBTAINED') return b.obtained;
      if (this.filter === 'LOCKED')   return !b.obtained;
      return true;
    });
  }

  byCategory(cat: string): BadgeWithStatus[] {
    return this.filtered.filter(b => b.category === cat);
  }

  get obtainedCount(): number {
    return this.badges.filter(b => b.obtained).length;
  }

  get totalPoints(): number {
    return this.badges.filter(b => b.obtained)
      .reduce((s, b) => s + b.pointsReward, 0);
  }

  setFilter(f: 'ALL' | 'OBTAINED' | 'LOCKED'): void {
    this.filter = f;
    this.animateIn();
  }

  openDetail(b: BadgeWithStatus): void {
    this.selected = b;
  }

  closeDetail(): void {
    this.selected = null;
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric'
    });
  }
}
