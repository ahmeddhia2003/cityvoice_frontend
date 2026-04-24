import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LiveService, ChatMessage } from '../../../../core/services/live.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-live-viewer',
  templateUrl: './live-viewer.component.html',
  styleUrls: ['./live-viewer.component.css']
})
export class LiveViewerComponent implements OnInit, OnDestroy {

  @ViewChild('remoteVideo') remoteVideoRef!: ElementRef<HTMLVideoElement>;

  evenementId!: number;
  isLive           = false;
  spectateurs      = 0;
  connecting       = true;
  liveStopped      = false;
  liveDejaCommence = false;
  isBanned         = false;
  banReason        = '';

  // Chat
  chatMessages: ChatMessage[] = [];
  newMessage    = '';
  pinnedMessage: ChatMessage | null = null;
  questionsOnly = false;

  private subs: Subscription[] = [];

  constructor(
    private route:       ActivatedRoute,
    private router:      Router,
    public  liveService: LiveService
  ) {}

  ngOnInit(): void {
    this.evenementId = Number(this.route.snapshot.paramMap.get('id'));

    // Récupérer infos user depuis localStorage
    const userId   = localStorage.getItem('userId')   || '';
    const userName = localStorage.getItem('userName') || 'Citoyen';

    this.liveService.connect(
      this.evenementId, false, userId, userName
    ).then(() => {
      this.connecting = false;

      this.subs.push(
        this.liveService.isLive$.subscribe(v => this.isLive = v),
        this.liveService.spectateurs$.subscribe(v => this.spectateurs = v),

        this.liveService.liveStarted$.subscribe(() => {
          this.liveDejaCommence = true;
          this.liveStopped      = false;
        }),

        this.liveService.liveStopped$.subscribe(() => {
          if (this.liveDejaCommence) this.liveStopped = true;
          if (this.remoteVideoRef?.nativeElement) {
            this.remoteVideoRef.nativeElement.srcObject = null;
          }
        }),

        this.liveService.remoteStream$.subscribe(stream => {
          setTimeout(() => {
            if (this.remoteVideoRef?.nativeElement) {
              this.remoteVideoRef.nativeElement.srcObject = stream;
              this.remoteVideoRef.nativeElement.play().catch(console.error);
            }
          }, 100);
        }),

        this.liveService.chatMessages$.subscribe(v => {
          this.chatMessages = v;
          this.scrollToBottom();
        }),

        this.liveService.pinnedMessage$.subscribe(v => {
          this.pinnedMessage = v;
        }),

        this.liveService.questionsOnly$.subscribe(v => {
          this.questionsOnly = v;
        }),

        this.liveService.isBanned$.subscribe(reason => {
          this.isBanned  = true;
          this.banReason = reason;
        })
      );
    });
  }

  envoyerMessage(): void {
    if (!this.newMessage.trim() || this.isBanned) return;
    this.liveService.sendMessage(this.newMessage.trim());
    this.newMessage = '';
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.envoyerMessage();
    }
  }

  toggleFullscreen(): void {
    const video = this.remoteVideoRef?.nativeElement;
    if (!document.fullscreenElement) {
      video?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  retourEvenement(): void {
    this.router.navigate(['/evenements', this.evenementId]);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = document.getElementById('viewer-chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (!this.isBanned && this.liveService.isLive$.value) {
      this.liveService.leaveAsViewer();
    }
    this.liveService.disconnect();
  }
}