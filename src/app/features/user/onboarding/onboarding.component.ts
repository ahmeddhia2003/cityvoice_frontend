import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserDto } from '../../../core/services/user.service';
import {Subject, takeUntil} from 'rxjs';
declare const gsap: any;

interface OnboardingStep {
  id:       string;
  icon:     string;
  title:    string;
  desc:     string;
  route:    string;
  done:     boolean;
  btnLabel: string;
}

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html',
  styleUrls: ['./onboarding.component.css'],
})
export class OnboardingComponent implements OnInit {

  @Output() dismissed = new EventEmitter<void>();

  user:      UserDto | null = null;
  minimized  = false;
  visible    = false;
  private destroy$ = new Subject<void>();

  steps: OnboardingStep[] = [
    {
      id:       'profile',
      icon:     '👤',
      title:    'Complétez votre profil',
      desc:     'Ajoutez vos infos et une photo',
      route:    '/user/profile',
      done:     false,
      btnLabel: 'Compléter',
    },
    {
      id:       'leaderboard',
      icon:     '🏆',
      title:    'Explorez le classement',
      desc:     'Voyez les citoyens les plus actifs',
      route:    '/user/leaderboard',
      done:     false,
      btnLabel: 'Explorer',
    },
    {
      id:       'badges',
      icon:     '🏅',
      title:    'Découvrez vos badges',
      desc:     'Débloquez des récompenses',
      route:    '/user/mes-badges',
      done:     false,
      btnLabel: 'Voir les badges',
    },
  ];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.tryShow();  // tentative initiale (page refresh)

    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.tryShow());  // déclenché à chaque login/logout
  }

  ngOnDestroy(): void {  // ← ajouter
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Renommer l'ancien ngOnInit en tryShow() :
  tryShow(): void {
    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    // ═══════════════════════════════════════════════════════
    // ONLY SHOW FOR CITOYEN
    // ═══════════════════════════════════════════════════════
    if (!this.authService.isCitoyen()) {
      this.visible = false;
      return;
    }

    const key = `onboarding_done_${auth.userId}`;
    if (localStorage.getItem(key)) return;

    this.visible = false;

    this.userService.getById(auth.userId).subscribe({
      next: (u) => {
        this.user    = u;
        this.visible = true;
        this.updateSteps(u);

        setTimeout(() => {
          if (typeof gsap !== 'undefined') {
            gsap.fromTo('.onboarding-widget',
              { opacity: 0, y: 40, scale: .9 },
              { opacity: 1, y: 0, scale: 1, duration: .5, ease: 'back.out(1.6)' }
            );
          }
        }, 500);
      }
    });
  }

  updateSteps(u: UserDto): void {
    const visited = JSON.parse(
      localStorage.getItem(`onboarding_visited_${u.id}`) ?? '[]'  // ← clé avec userId
    ) as string[];

    this.steps[0].done = !!(u.nom && u.telephone && u.gouvernorat && u.photo);
    this.steps[1].done = visited.includes('leaderboard');
    this.steps[2].done = visited.includes('badges');

    if (this.allDone) {
      setTimeout(() => this.dismiss(), 2000);
    }
  }

  get allDone(): boolean {
    return this.steps.every(s => s.done);
  }

  get doneCount(): number {
    return this.steps.filter(s => s.done).length;
  }

  get progress(): number {
    return Math.round((this.doneCount / this.steps.length) * 100);
  }

  go(step: OnboardingStep): void {
    const auth = this.authService.getCurrentUser();
    if (!auth?.userId) return;

    const key = `onboarding_visited_${auth.userId}`;
    const visited = JSON.parse(
      localStorage.getItem(key) ?? '[]'
    ) as string[];

    if (!visited.includes(step.id)) {
      visited.push(step.id);
      localStorage.setItem(key, JSON.stringify(visited));
    }

    // ← Marquer instantanément dans le state sans attendre reload
    step.done = true;

    // ← Re-check si tout est done
    if (this.allDone) {
      setTimeout(() => this.dismiss(), 2000);
    }

    this.router.navigate([step.route]);
  }

  toggle(): void {
    this.minimized = !this.minimized;
  }

  dismiss(): void {
    const auth = this.authService.getCurrentUser();
    if (auth?.userId) {
      localStorage.setItem(`onboarding_done_${auth.userId}`, '1');
    }

    if (typeof gsap !== 'undefined') {
      gsap.to('.onboarding-widget', {
        opacity: 0, y: 40, scale: .9, duration: .3,
        onComplete: () => {
          this.visible = false;
          this.dismissed.emit();
        }
      });
    } else {
      this.visible = false;
      this.dismissed.emit();
    }
  }
}
