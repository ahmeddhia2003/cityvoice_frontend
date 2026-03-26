import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserDto } from '../../../core/services/user.service';
import { Location } from '@angular/common';
declare const gsap: any;

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.css'],
})
export class LeaderboardComponent implements OnInit {

  leaders:     UserDto[] = [];
  loading      = true;
  currentUser: UserDto | null = null;
  currentRank  = 0;

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

    this.userService.getLeaderboard(20).subscribe({
      next: (users) => {
        this.leaders = users;
        this.loading = false;

        if (auth?.userId) {
          this.currentRank = users.findIndex(u => u.id === auth.userId) + 1;
          this.userService.getById(auth.userId).subscribe(u => {
            this.currentUser = u;
          });
        }

        this.animateIn();
      }
    });
  }

  private animateIn(): void {
    if (typeof gsap === 'undefined') return;
    setTimeout(() => {
      gsap.fromTo('.lb-row',
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: .35, stagger: .04, ease: 'power2.out' }
      );
      gsap.fromTo('.podium-item',
        { opacity: 0, y: 40, scale: .8 },
        { opacity: 1, y: 0, scale: 1, duration: .5, stagger: .1, ease: 'back.out(1.6)', delay: .2 }
      );
    }, 50);
  }

  get top3(): UserDto[] { return this.leaders.slice(0, 3); }
  get rest(): UserDto[] { return this.leaders.slice(3); }

  isCurrentUser(user: UserDto): boolean {
    return user.id === this.authService.getCurrentUser()?.userId;
  }

  initials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  medalEmoji(rank: number): string {
    return ['🥇', '🥈', '🥉'][rank - 1] ?? '';
  }

  podiumOrder(): UserDto[] {
    if (this.top3.length < 3) return this.top3;
    return [this.top3[1], this.top3[0], this.top3[2]];
  }

  podiumHeight(rank: number): string {
    return ['140px', '180px', '110px'][rank - 1] ?? '100px';
  }

  formatName(name: string): string {
    if (!name) return '';

    return name
      .split(' ')
      .map(n => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
      .join(' ');
  }
}
