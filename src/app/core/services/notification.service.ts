import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, Subscription, interval } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  id: number;
  destinataireId: string;
  type: string;
  message: string;
  lien: string | null;
  entiteId: number | null;
  lu: boolean;
  dateCreation: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly API = `${environment.apiUrl}/api/v1/notifications`;
  private readonly WS = environment.notificationWsUrl;

  private readonly notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private readonly incomingNotification$ = new Subject<AppNotification>();
  private stompClient!: Client;
  private pollSub!: Subscription;
  private wsConnected = false;
  private initialized = false;

  readonly notifs$ = this.notifications$.asObservable();
  readonly incomingNotifs$ = this.incomingNotification$.asObservable();

  get unreadCount(): number {
    return this.notifications$.value.filter(n => !n.lu).length;
  }

  constructor(private http: HttpClient, private auth: AuthService) {}

  init(): void {
    if (this.initialized) return;

    this.initialized = true;
    this.chargerDepuisAPI();
    this.connectWebSocket();
    this.startPollingFallback();
  }

  destroy(): void {
    this.initialized = false;
    this.wsConnected = false;
    this.stompClient?.deactivate();
    this.pollSub?.unsubscribe();
    this.notifications$.next([]);
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  private chargerDepuisAPI(): void {
    const userId = this.getUserId();
    if (!userId) return;

    this.http.get<AppNotification[]>(this.API, {
      headers: { 'X-User-Id': userId }
    }).subscribe({
      next: notifs => this.notifications$.next(this.applyLocalReadState(notifs)),
      error: err => console.warn('[NOTIF] Chargement API echoue', err),
    });
  }

  private connectWebSocket(): void {
    const userId = this.getUserId();
    if (!userId) return;

    this.stompClient = new Client({
      brokerURL: this.WS,
      reconnectDelay: 5000,
      onConnect: () => {
        this.wsConnected = true;

        this.stompClient.subscribe(`/topic/notifications/${userId}`, (msg: IMessage) => {
          const notif = this.applyLocalReadStateToNotification(JSON.parse(msg.body) as AppNotification);
          const current = this.notifications$.value;
          this.notifications$.next(this.mergeNotifications([notif, ...current]));
          this.incomingNotification$.next(notif);
        });
      },
      onDisconnect: () => {
        this.wsConnected = false;
      },
      onStompError: frame => {
        console.warn('[WS] Erreur STOMP', frame);
      },
    });

    this.stompClient.activate();
  }

  private startPollingFallback(): void {
    this.pollSub = interval(30_000).subscribe(() => {
      if (!this.wsConnected) {
        this.chargerDepuisAPI();
      }
    });
  }

  marquerLue(notif: AppNotification): void {
    if (notif.lu) return;

    notif.lu = true;
    this.persistReadNotificationId(notif.id);
    this.notifications$.next([...this.notifications$.value]);

    this.http.patch(`${this.API}/${notif.id}/lue`, {}, {
      headers: { 'X-User-Id': this.getUserId() ?? '' }
    }).subscribe({
      error: e => console.warn('[NOTIF] Erreur marquerLue', e),
    });
  }

  marquerToutesLues(): void {
    const userId = this.getUserId();
    if (!userId) return;

    const updated = this.notifications$.value.map(n => ({ ...n, lu: true }));
    updated.forEach(n => this.persistReadNotificationId(n.id));
    this.notifications$.next(updated);

    this.http.patch(`${this.API}/tout-lire`, {}, {
      headers: { 'X-User-Id': userId }
    }).subscribe({
      error: e => console.warn('[NOTIF] Erreur marquerToutesLues', e),
    });
  }

  private mergeNotifications(notifications: AppNotification[]): AppNotification[] {
    const byId = new Map<number, AppNotification>();

    notifications.forEach(notif => {
      const normalized = this.applyLocalReadStateToNotification(notif);
      const existing = byId.get(normalized.id);

      if (!existing) {
        byId.set(normalized.id, normalized);
        return;
      }

      byId.set(normalized.id, {
        ...existing,
        ...normalized,
        lu: existing.lu || normalized.lu,
      });
    });

    return Array.from(byId.values()).sort((a, b) =>
      new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
    );
  }

  private applyLocalReadState(notifications: AppNotification[]): AppNotification[] {
    return this.mergeNotifications(notifications);
  }

  private applyLocalReadStateToNotification(notif: AppNotification): AppNotification {
    return this.isNotificationReadLocally(notif.id)
      ? { ...notif, lu: true }
      : notif;
  }

  private persistReadNotificationId(notificationId: number): void {
    const userId = this.getUserId();
    if (!userId) return;

    const readIds = this.getReadNotificationIds(userId);
    readIds.add(notificationId);
    localStorage.setItem(this.getReadStorageKey(userId), JSON.stringify(Array.from(readIds)));
  }

  private isNotificationReadLocally(notificationId: number): boolean {
    const userId = this.getUserId();
    if (!userId) return false;

    return this.getReadNotificationIds(userId).has(notificationId);
  }

  private getReadNotificationIds(userId: string): Set<number> {
    try {
      const raw = localStorage.getItem(this.getReadStorageKey(userId));
      if (!raw) return new Set<number>();

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set<number>();

      return new Set(
        parsed
          .map(value => Number(value))
          .filter(value => Number.isFinite(value))
      );
    } catch {
      return new Set<number>();
    }
  }

  private getReadStorageKey(userId: string): string {
    return `cityvoice.notifications.read.${userId}`;
  }

  private getUserId(): string | null {
    return this.auth.getCurrentUser()?.userId ?? null;
  }

  static iconType(type: string): 'resolved' | 'progress' | 'badge' | 'info' {
    const map: Record<string, 'resolved' | 'progress' | 'badge' | 'info'> = {
      SIGNALEMENT_RESOLU: 'resolved',
      CONTRAT_ACCEPTE: 'resolved',
      SIGNALEMENT_EN_COURS: 'progress',
      CONTRAT_GENERE: 'progress',
      CONTRAT_REFUSE: 'progress',
      SIGNALEMENT_CREE: 'info',
      SIGNALEMENT_REJETE: 'badge',
      COMMENTAIRE: 'info',
      INFO: 'info',
    };

    return map[type] ?? 'info';
  }

  static timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (mins < 1) return 'a l\'instant';
    if (mins < 60) return `il y a ${mins}min`;
    if (hours < 24) return `il y a ${hours}h`;
    if (days < 7) return `il y a ${days}j`;

    return new Date(dateStr).toLocaleDateString('fr-FR');
  }
}
