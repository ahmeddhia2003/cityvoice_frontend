import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  SignalementService,
  SignalementResponse,
} from '../../../core/services/signalement.service';
import { VoteStorageService } from '../../../core/services/vote-storage.service';

declare const gsap: any;

@Component({
  selector: 'app-mes-signalements',
  templateUrl: './mes-signalements.component.html',
  styleUrls: ['./mes-signalements.component.css'],
})
export class MesSignalementsComponent implements OnInit, OnDestroy {

  signalements: SignalementResponse[] = [];
  filtered:     SignalementResponse[] = [];
  loading       = true;
  error: string | null = null;

  activeFilter  = 'TOUS';
  searchQuery   = '';

  /* ── Pagination ──────────────────────────────── */
  currentPage         = 0;
  readonly pageSize   = 8;

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get paged(): SignalementResponse[] {
    const start = this.currentPage * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  /* ── Vote ────────────────────────────────── */
  votedIds  = new Set<number>();
  votingIds = new Set<number>();

  /* ── Weather banner ──────────────────────── */
  weatherBannerHeight  = 0;
  festiveBannerHeight  = 0;

  /* ── Detail popup ────────────────────────── */
  selectedSig: SignalementResponse | null = null;

  openPopup(sig: SignalementResponse): void {
    this.selectedSig = sig;
  }
  closePopup(): void {
    this.selectedSig = null;
  }

  /* ── Toast ───────────────────────────────── */
  toast: { msg: string; type: 'success' | 'error' } | null = null;
  private toastTimer: any;

  filters = [
    { key: 'TOUS',       label: 'Tous',       icon: '📋', count: 0 },
    { key: 'EN_ATTENTE', label: 'En attente', icon: '⏳', count: 0 },
    { key: 'EN_COURS',   label: 'En cours',   icon: '🔧', count: 0 },
    { key: 'RESOLU',     label: 'Résolus',    icon: '✅', count: 0 },
  ];

  constructor(
    private auth:        AuthService,
    private sigService:  SignalementService,
    private router:      Router,
    private ngZone:      NgZone,
    private voteStorage: VoteStorageService,
  ) {}

  ngOnInit(): void {
    /* Charger les votes persistés depuis localStorage */
    this.votedIds = this.voteStorage.load();

    const user = this.auth.getCurrentUser();
    if (!user?.userId) {
      this.router.navigate(['/auth/signin']);
      return;
    }

    this.sigService.getMes(user.userId).subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.signalements = data.sort((a, b) =>
            new Date(b.dateSignalement).getTime() - new Date(a.dateSignalement).getTime()
          );
          this.updateFilters();
          this.applyFilter();
          this.loading = false;
          this.animateEntrance();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.error   = 'Impossible de charger vos signalements.';
          this.loading = false;
        });
      },
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
  }

  /* ── Filtres ─────────────────────────────── */
  private updateFilters(): void {
    this.filters.forEach(f => {
      f.count = f.key === 'TOUS'
        ? this.signalements.length
        : this.signalements.filter(s => s.statut === f.key).length;
    });
  }

  setFilter(key: string): void {
    if (key === this.activeFilter) return;
    this.activeFilter = key;
    this.currentPage = 0;
    this.applyFilter();
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.ms-card',
        { opacity: 0, y: 12, scale: .97 },
        { opacity: 1, y: 0,  scale: 1, duration: .35, ease: 'power3.out', stagger: .05 }
      );
    }
  }

  applyFilter(): void {
    this.currentPage = 0;
    this.filtered = this.signalements.filter(s => {
      const matchF = this.activeFilter === 'TOUS' || s.statut === this.activeFilter;
      const matchS = !this.searchQuery
        || (s.type        ?? '').toLowerCase().includes(this.searchQuery.toLowerCase())
        || (s.adresse     ?? '').toLowerCase().includes(this.searchQuery.toLowerCase())
        || (s.description ?? '').toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchF && matchS;
    });
  }

  /* ── Vote ────────────────────────────────── */
  voter(sig: SignalementResponse): void {
    if (this.votedIds.has(sig.id) || this.votingIds.has(sig.id)) return;

    this.votingIds.add(sig.id);
    const prevVotes = sig.votes ?? 0;

    /* Optimistic update + persistance localStorage */
    sig.votes = prevVotes + 1;
    this.votedIds.add(sig.id);
    this.voteStorage.add(sig.id);   // ← persistance localStorage

    /* Animation bouton */
    const btn = document.querySelector(`#ms-vote-btn-${sig.id}`);
    if (btn && typeof gsap !== 'undefined') {
      const tl = gsap.timeline();
      tl.to(btn,          { scale: 1.3,   duration: .15, ease: 'back.out(3)' })
        .to(btn,          { scale: 1,     duration: .3,  ease: 'elastic.out(1,.4)' })
        .to(`#ms-vi-${sig.id}`, { rotation: 20, duration: .1  }, 0)
        .to(`#ms-vi-${sig.id}`, { rotation: 0,  duration: .25, ease: 'back.out(2)' }, .1);

      /* Confettis micro */
      this.burstParticles(btn as HTMLElement);
    }

    /* Animation compteur */
    this.animateCounter(`#ms-vc-${sig.id}`, prevVotes, sig.votes);

    this.sigService.voter(sig.id).subscribe({
      next: (updated) => this.ngZone.run(() => {
        const idx = this.signalements.findIndex(s => s.id === sig.id);
        if (idx !== -1) this.signalements[idx].votes = updated.votes;
        this.votingIds.delete(sig.id);
        this.applyFilter();
        this.showToast('Vote enregistré ! 👍', 'success');
      }),
      error: () => this.ngZone.run(() => {
        /* Rollback optimiste */
        sig.votes = prevVotes;
        this.votedIds.delete(sig.id);
        this.voteStorage.remove(sig.id);   // ← rollback localStorage
        this.votingIds.delete(sig.id);
        this.applyFilter();
        this.showToast('Impossible de voter. Réessayez.', 'error');
      }),
    });
  }

  private burstParticles(anchor: HTMLElement): void {
    if (typeof gsap === 'undefined') return;
    const rect   = anchor.getBoundingClientRect();
    const cx     = rect.left + rect.width  / 2;
    const cy     = rect.top  + rect.height / 2;
    const colors = ['#0D9B76', '#E8532A', '#C9973E', '#1A56DB'];

    for (let i = 0; i < 12; i++) {
      const p  = document.createElement('div');
      const sz = Math.random() * 7 + 4;
      p.style.cssText = `
        position:fixed;width:${sz}px;height:${sz}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > .4 ? '50%' : '2px'};
        left:${cx}px;top:${cy}px;opacity:1;
        pointer-events:none;z-index:9999;`;
      document.body.appendChild(p);
      gsap.to(p, {
        x: (Math.random() - .5) * 100,
        y: (Math.random() - .5) * 80 - 20,
        opacity: 0,
        scale: Math.random() * .5 + .5,
        duration: .65 + Math.random() * .4,
        ease: 'power2.out',
        onComplete: () => p.remove(),
      });
    }
  }

  private animateCounter(selector: string, from: number, to: number): void {
    if (typeof gsap === 'undefined') return;
    const el  = document.querySelector(selector);
    if (!el) return;
    const obj = { val: from };
    gsap.to(obj, {
      val: to, duration: .55, ease: 'power2.out',
      onUpdate: () => { el.textContent = Math.round(obj.val).toString(); },
    });
  }

  /* ── Toast ───────────────────────────────── */
  showToast(msg: string, type: 'success' | 'error'): void {
    clearTimeout(this.toastTimer);
    this.toast = { msg, type };
    if (typeof gsap !== 'undefined') {
      setTimeout(() => {
        gsap.fromTo('.ms-toast',
          { opacity: 0, y: 20, scale: .9 },
          { opacity: 1, y: 0,  scale: 1, duration: .38, ease: 'back.out(1.8)' }
        );
      }, 10);
    }
    this.toastTimer = setTimeout(() => {
      if (typeof gsap !== 'undefined') {
        gsap.to('.ms-toast', {
          opacity: 0, y: 14, duration: .25, ease: 'power2.in',
          onComplete: () => this.ngZone.run(() => { this.toast = null; }),
        });
      } else { this.toast = null; }
    }, 2800);
  }

  /* ── Animations entrée ───────────────────── */
  private animateEntrance(): void {
    if (typeof gsap === 'undefined') return;
    const tl = gsap.timeline();
    tl.fromTo('.ms-header',
        { opacity: 0, y: -22 },
        { opacity: 1, y: 0, duration: .55, ease: 'power3.out' })
      .fromTo('.ms-stats .ms-stat',
        { opacity: 0, y: 16, scale: .92 },
        { opacity: 1, y: 0,  scale: 1, duration: .4, ease: 'back.out(1.8)', stagger: .07 }, '-=.2')
      .fromTo('.ms-toolbar',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: .35, ease: 'power2.out' }, '-=.15');

    /* Animate stat counters */
    setTimeout(() => {
      this.filters.forEach(f => {
        const el = document.querySelector(`.stat-count-${f.key.toLowerCase()}`);
        if (!el) return;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: f.count, duration: .7, ease: 'power2.out', delay: .3,
          onUpdate: () => { el.textContent = Math.round(obj.val).toString(); },
        });
      });
      gsap.fromTo('.ms-card',
        { opacity: 0, y: 20, scale: .97 },
        { opacity: 1, y: 0,  scale: 1, duration: .45, ease: 'power3.out', stagger: .065, delay: .3 }
      );
      /* Animate progress bars */
      gsap.fromTo('.ms-progress-fill',
        { scaleX: 0 },
        { scaleX: 1, duration: .8, ease: 'power2.out', stagger: .07, delay: .5, transformOrigin: 'left center' }
      );
    }, 60);
  }

  /* ── Navigation ──────────────────────────── */
  goNew(): void { this.router.navigate(['/signaler/choix']); }

  /* ── Helpers ─────────────────────────────── */
  typeLabel(type: string): string {
    const map: Record<string, string> = {
      TROU_CHAUSSEE:           '🚧 Trou chaussée',
      LAMPADAIRE_CASSE:        '💡 Lampadaire cassé',
      FUITE_EAU:               "💧 Fuite d'eau",
      DECHETS_NON_COLLECTES:   '🗑️ Déchets',
      POTEAU_ENDOMMAGE:        '⚡ Poteau endommagé',
      SIGNALISATION_MANQUANTE: '🚦 Signalisation',
      CANIVEAU_BOUCHE:         '🌊 Caniveau bouché',
      ESPACE_VERT_DEGRADE:     '🌿 Espace vert',
      AUTRE:                   '📌 Autre',
    };
    return map[type] ?? type;
  }

  statutLabel(s: string): string {
    return ({ EN_ATTENTE:'En attente', EN_COURS:'En cours', RESOLU:'Résolu', REJETE:'Rejeté' } as any)[s] ?? s;
  }

  prioriteLabel(p: string): string {
    const m: Record<string,string> = {
      FAIBLE:'Faible', MOYENNE:'Moyenne', HAUTE:'Haute', URGENTE:'Urgente',
      faible:'Faible', moyenne:'Moyenne', haute:'Haute', urgente:'Urgente',
    };
    return m[p] ?? p;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  progressPct(sig: SignalementResponse): number {
    return ({ EN_ATTENTE: 10, EN_COURS: 55, RESOLU: 100, REJETE: 100 } as any)[sig.statut] ?? 0;
  }
}
