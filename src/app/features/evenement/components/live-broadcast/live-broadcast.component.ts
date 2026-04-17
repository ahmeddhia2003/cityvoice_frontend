import { Component, OnInit, OnDestroy, ViewChild,
         ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LiveService, ChatMessage, Spectateur } from '../../../../core/services/live.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-live-broadcast',
  templateUrl: './live-broadcast.component.html',
  styleUrls: ['./live-broadcast.component.css']
})
export class LiveBroadcastComponent implements OnInit, OnDestroy {

  @ViewChild('localVideo') localVideoRef!: ElementRef<HTMLVideoElement>;

  evenementId!: number;
  isLive       = false;
  spectateurs  = 0;
  spectateursList: Spectateur[] = [];
  loading      = false;
  erreur       = '';

  // Chat
  chatMessages: ChatMessage[] = [];
  newMessage    = '';
  pinnedMessage: ChatMessage | null = null;
  questionsOnly = false;
  showSpectateurs = false;

  // Contrôles
  micOn    = true;
  cameraOn = true;
  isFullscreen = false;

  private subs: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    public liveService: LiveService
  ) {}

  ngOnInit(): void {
    this.evenementId = Number(this.route.snapshot.paramMap.get('id'));

    this.liveService.connect(
      this.evenementId, true, 'admin', 'Administrateur'
    ).then(() => {
      this.subs.push(
        this.liveService.isLive$.subscribe(v => this.isLive = v),
        this.liveService.spectateurs$.subscribe(v => this.spectateurs = v),
        this.liveService.spectateursList$.subscribe(v => this.spectateursList = v),
        this.liveService.chatMessages$.subscribe(v => {
          this.chatMessages = v;
          this.scrollToBottom();
        }),
        this.liveService.pinnedMessage$.subscribe(v => this.pinnedMessage = v),
        this.liveService.questionsOnly$.subscribe(v => this.questionsOnly = v),
        this.liveService.micOn$.subscribe(v => this.micOn = v),
        this.liveService.cameraOn$.subscribe(v => this.cameraOn = v),
      );
    });
  }

  async demarrerLive(): Promise<void> {
    this.loading = true;
    this.erreur  = '';
    try {
      const stream = await this.liveService.startLive();
      setTimeout(() => {
        if (this.localVideoRef?.nativeElement) {
          this.localVideoRef.nativeElement.srcObject = stream;
        }
      }, 100);
    } catch (e: any) {
      this.erreur = '❌ Impossible d\'accéder à la caméra : ' + e.message;
    }
    this.loading = false;
  }

  arreterLive(): void {
    if (confirm('Arrêter le live ? Tous les spectateurs seront déconnectés.')) {
      this.liveService.stopLive();
      if (this.localVideoRef?.nativeElement) {
        this.localVideoRef.nativeElement.srcObject = null;
      }
    }
  }

  // ── Chat ──────────────────────────────────────────
  envoyerMessage(): void {
    if (!this.newMessage.trim()) return;
    this.liveService.sendMessage(this.newMessage.trim());
    this.newMessage = '';
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyerMessage();
    }
  }

  epinglerMessage(msg: ChatMessage): void {
    this.liveService.pinMessage(msg);
  }

  supprimerMessage(messageId: string): void {
    this.liveService.deleteMessage(messageId);
  }

  bannirUser(userId: string): void {
    if (confirm('Bannir cet utilisateur ?')) {
      this.liveService.banUser(userId);
    }
  }

  toggleQuestionsOnly(): void {
    this.liveService.toggleQuestionsOnly(!this.questionsOnly);
  }

  // ── Contrôles média ───────────────────────────────
  toggleMic(): void    { this.liveService.toggleMic(); }
  toggleCamera(): void { this.liveService.toggleCamera(); }

  toggleFullscreen(): void {
    const video = this.localVideoRef?.nativeElement;
    if (!document.fullscreenElement) {
      video?.requestFullscreen();
      this.isFullscreen = true;
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const chatEl = document.getElementById('chat-messages');
      if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.liveService.disconnect();
  }
}