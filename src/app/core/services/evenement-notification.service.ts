import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { EvenementNotification } from '../../features/evenement/models/evenement-notification.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class EvenementNotificationService implements OnDestroy {

  private readonly API = 'http://localhost:8084/api/notifications';
  private eventSource: EventSource | null = null;

  // State
  private notifications$ = new BehaviorSubject<EvenementNotification[]>([]);
  private nonLues$        = new BehaviorSubject<number>(0);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // ── Initialiser (appelé au login / au démarrage) ──
  init(destinataireId: string): void {
    this.charger(destinataireId);
    this.connecterSSE(destinataireId);
  }

  // ── Charger les notifs existantes ─────────────────
  charger(destinataireId: string): void {
    this.http.get<EvenementNotification[]>(
      `${this.API}/${destinataireId}`
    ).subscribe({
      next: (data) => {
        this.notifications$.next(data);
        this.mettreAJourCount(data);
      },
      error: () => {}
    });
  }

  // ── SSE ───────────────────────────────────────────
  private connecterSSE(destinataireId: string): void {
    // Fermer connexion existante
    this.deconnecter();

    this.eventSource = new EventSource(
      `${this.API}/stream/${destinataireId}`
    );

    // Événement "notification" — nouvelle notif reçue
    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      const notif: EvenementNotification = JSON.parse(event.data);
      const current = this.notifications$.value;
      this.notifications$.next([notif, ...current]);
      this.nonLues$.next(this.nonLues$.value + 1);
    });

    this.eventSource.onerror = () => {
      // Reconnexion automatique après 5s
      setTimeout(() => this.connecterSSE(destinataireId), 5000);
    };
  }

  deconnecter(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // ── Observables pour les composants ──────────────
  getNotifications(): Observable<EvenementNotification[]> {
    return this.notifications$.asObservable();
  }

  getNonLues(): Observable<number> {
    return this.nonLues$.asObservable();
  }

  // ── Actions ───────────────────────────────────────
  marquerLue(id: number): void {
    this.http.put(`${this.API}/${id}/lire`, {}).subscribe({
      next: () => {
        const updated = this.notifications$.value.map(n =>
          n.id === id ? { ...n, lu: true } : n
        );
        this.notifications$.next(updated);
        this.mettreAJourCount(updated);
      }
    });
  }

  marquerToutesLues(destinataireId: string): void {
    this.http.put(`${this.API}/${destinataireId}/tout-lire`, {}).subscribe({
      next: () => {
        const updated = this.notifications$.value.map(n => ({ ...n, lu: true }));
        this.notifications$.next(updated);
        this.nonLues$.next(0);
      }
    });
  }

  // ── Helpers ───────────────────────────────────────
  private mettreAJourCount(notifs: EvenementNotification[]): void {
    this.nonLues$.next(notifs.filter(n => !n.lu).length);
  }

  getIconType(type: string): string {
    const map: any = {
      'INSCRIPTION':          '✅',
      'PAIEMENT':             '💳',
      'SUGGESTION_ACCEPTEE':  '🎉',
      'SUGGESTION_REJETEE':   '❌',
      'EVENEMENT_ANNULE':     '⚠️',
      'NOUVEAU_PARTICIPANT':  '👤',
      'NOUVELLE_SUGGESTION':  '💡',
    };
    return map[type] || '🔔';
  }

  getColorType(type: string): string {
    const map: any = {
      'INSCRIPTION':          '#0D9B76',
      'PAIEMENT':             '#3B82F6',
      'SUGGESTION_ACCEPTEE':  '#0D9B76',
      'SUGGESTION_REJETEE':   '#E8532A',
      'EVENEMENT_ANNULE':     '#C9973E',
      'NOUVEAU_PARTICIPANT':  '#6366F1',
      'NOUVELLE_SUGGESTION':  '#C9973E',
    };
    return map[type] || '#9CA3AF';
  }

  ngOnDestroy(): void {
    this.deconnecter();
  }
}