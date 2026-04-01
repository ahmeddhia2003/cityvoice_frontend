import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserDto, PointTransactionDto } from '../../../core/services/user.service';
declare const gsap: any;

@Component({
  selector: 'app-mes-points',
  templateUrl: './mes-points.component.html',
  styleUrls: ['./mes-points.component.css'],
})
export class MesPointsComponent implements OnInit {

  user:         UserDto | null = null;
  transactions: PointTransactionDto[] = [];
  loading       = true;

  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    this.userService.getById(auth.userId).subscribe({
      next: (u) => {
        this.user = u;
        this.userService.getPoints(auth.userId).subscribe({
          next: (txs) => {
            this.transactions = txs;
            this.loading = false;
          }
        });
      }
    });
  }

  get totalGained(): number {
    return this.transactions
      .filter(t => t.points > 0)
      .reduce((sum, t) => sum + t.points, 0);
  }

  get totalLost(): number {
    return this.transactions
      .filter(t => t.points < 0)
      .reduce((sum, t) => sum + t.points, 0);
  }

  reasonIcon(reason: string): string {
    const map: Record<string, string> = {
      INSCRIPTION:        '🎉',
      PROFIL_COMPLETE:    '✅',
      PHOTO_AJOUTEE:      '📸',
      PREMIERE_CONNEXION: '👋',
      SIGNALEMENT_SOUMIS: '📍',
      SIGNALEMENT_RESOLU: '🔧',
      SIGNALEMENT_VALIDE: '✨',
      VOTE_PROJET:        '🗳️',
      BADGE_OBTENU:       '🏅',
      INACTIVITE:         '😴',
      SIGNALEMENT_REJETE: '❌',
    };
    return map[reason] ?? '⭐';
  }

  reasonLabel(reason: string): string {
    const map: Record<string, string> = {
      INSCRIPTION:        'Inscription',
      PROFIL_COMPLETE:    'Profil complété',
      PHOTO_AJOUTEE:      'Photo ajoutée',
      PREMIERE_CONNEXION: 'Première connexion',
      SIGNALEMENT_SOUMIS: 'Signalement soumis',
      SIGNALEMENT_RESOLU: 'Signalement résolu',
      SIGNALEMENT_VALIDE: 'Signalement validé',
      VOTE_PROJET:        'Vote pour un projet',
      BADGE_OBTENU:       'Badge obtenu',
      INACTIVITE:         'Inactivité',
      SIGNALEMENT_REJETE: 'Signalement rejeté',
    };
    return map[reason] ?? reason;
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  trackById(_: number, t: PointTransactionDto): string { return t.id; }
}
