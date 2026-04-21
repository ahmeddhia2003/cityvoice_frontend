import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BehaviorSubject, Subject } from 'rxjs';

export interface ChatMessage {
  id:       string;
  type:     'message' | 'system';
  message:  string;
  userId?:  string;
  userName: string;
  role?:    string;
  time:     string;
}

export interface Spectateur {
  userId:   string;
  userName: string;
  joinedAt: string;
}

@Injectable({ providedIn: 'root' })
export class LiveService {

  private stompClient!: Client;
  private peerConnection!: RTCPeerConnection;
  private localStream!: MediaStream;

  // État du live
  isLive$          = new BehaviorSubject<boolean>(false);
  spectateurs$     = new BehaviorSubject<number>(0);
  spectateursList$ = new BehaviorSubject<Spectateur[]>([]);
  remoteStream$    = new Subject<MediaStream>();
  liveStarted$     = new Subject<void>();
  liveStopped$     = new Subject<void>();
  chatMessages$    = new BehaviorSubject<ChatMessage[]>([]);
  pinnedMessage$   = new BehaviorSubject<ChatMessage | null>(null);
  isBanned$        = new Subject<string>();
  questionsOnly$   = new BehaviorSubject<boolean>(false);

  // Contrôles media
  micOn$    = new BehaviorSubject<boolean>(true);
  cameraOn$ = new BehaviorSubject<boolean>(true);

  private evenementId!: number;
  private isAdmin  = false;
  private userId   = '';
  private userName = '';

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  // ── Connexion WebSocket ────────────────────────────
  connect(evenementId: number, isAdmin: boolean,
          userId = '', userName = 'Citoyen'): Promise<void> {
    this.evenementId = evenementId;
    this.isAdmin     = isAdmin;
    this.userId      = userId   || 'user-' + Math.random().toString(36).substr(2, 9);
    this.userName    = userName || 'Citoyen';

    return new Promise((resolve, reject) => {
      this.stompClient = new Client({
        webSocketFactory: () => new SockJS('http://localhost:8084/ws-live'),
        reconnectDelay: 5000,
        onConnect: () => {
          console.log('✅ WebSocket connecté');
          this.subscribeToTopics();
          resolve();
        },
        onStompError: (error) => {
          console.error('❌ WebSocket erreur:', error);
          reject(error);
        }
      });
      this.stompClient.activate();
    });
  }

  // ── Souscriptions ──────────────────────────────────
  private subscribeToTopics(): void {
    const id = this.evenementId;

    // Statut live
    this.stompClient.subscribe(
      `/topic/live/${id}/status`,
      (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data.status === 'STARTED') {
          this.isLive$.next(true);
          this.liveStarted$.next();
          if (!this.isAdmin) {
            this.joinAsViewer();
            setTimeout(() => this.demanderOffer(), 500);
          }
        } else if (data.status === 'STOPPED') {
          if (this.isLive$.value) {
            this.isLive$.next(false);
            this.liveStopped$.next();
            this.cleanup();
          }
        }
      }
    );

    // Spectateurs
    this.stompClient.subscribe(
      `/topic/live/${id}/spectateurs`,
      (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        this.spectateurs$.next(data.count || 0);
        this.spectateursList$.next(data.liste || []);
      }
    );

    // Chat messages
    this.stompClient.subscribe(
      `/topic/live/${id}/chat`,
      (msg: IMessage) => {
        const data: ChatMessage = JSON.parse(msg.body);
        const current = this.chatMessages$.value;
        this.chatMessages$.next([...current, data]);
      }
    );

    // Historique chat
    this.stompClient.subscribe(
      `/topic/live/${id}/chat-history`,
      (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        this.chatMessages$.next(data.messages || []);
      }
    );

    // Message épinglé
    this.stompClient.subscribe(
      `/topic/live/${id}/pinned`,
      (msg: IMessage) => {
        this.pinnedMessage$.next(JSON.parse(msg.body));
      }
    );

    // Message supprimé
    this.stompClient.subscribe(
      `/topic/live/${id}/message-deleted`,
      (msg: IMessage) => {
        const { messageId } = JSON.parse(msg.body);
        const current = this.chatMessages$.value;
        this.chatMessages$.next(
          current.filter(m => m.id !== messageId)
        );
      }
    );

    // Mode questions
    this.stompClient.subscribe(
      `/topic/live/${id}/mode`,
      (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        this.questionsOnly$.next(data.questionsOnly);
      }
    );

    // Banni
    this.stompClient.subscribe(
      `/topic/live/${id}/banned/${this.userId}`,
      (msg: IMessage) => {
        const data = JSON.parse(msg.body);
        if (data.banned) {
          this.isBanned$.next(data.reason || 'Banni');
          this.cleanup();
        }
      }
    );

    // Offer (spectateur)
    if (!this.isAdmin) {
      this.stompClient.subscribe(
        `/topic/live/${id}/offer`,
        async (msg: IMessage) => {
          const offer = JSON.parse(msg.body);
          await this.handleOffer(offer);
        }
      );
    }

    // Answer + need-offer (admin)
    if (this.isAdmin) {
      this.stompClient.subscribe(
        `/topic/live/${id}/answer`,
        async (msg: IMessage) => {
          const answer = JSON.parse(msg.body);
          await this.handleAnswer(answer);
        }
      );

      this.stompClient.subscribe(
        `/topic/live/${id}/need-offer`,
        async (_msg: IMessage) => {
          if (this.peerConnection && this.localStream) {
            try {
              const offer = await this.peerConnection.createOffer();
              await this.peerConnection.setLocalDescription(offer);
              this.stompClient.publish({
                destination: `/app/live/${this.evenementId}/offer`,
                body: JSON.stringify(offer)
              });
            } catch (e) {
              console.error('❌ Erreur renvoi offer:', e);
            }
          }
        }
      );
    }

    // ICE
    this.stompClient.subscribe(
      `/topic/live/${id}/ice`,
      async (msg: IMessage) => {
        const candidate = JSON.parse(msg.body);
        await this.handleIceCandidate(candidate);
      }
    );

    // Check
    this.stompClient.publish({
      destination: `/app/live/${id}/check`,
      body: JSON.stringify({})
    });
  }

  private demanderOffer(): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/request-offer`,
      body: JSON.stringify({})
    });
  }

  // ── Admin démarre live ─────────────────────────────
  async startLive(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true
    });

    this.createPeerConnection();
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/start`,
      body: JSON.stringify({ evenementId: this.evenementId })
    });

    setTimeout(() => {
      this.stompClient.publish({
        destination: `/app/live/${this.evenementId}/offer`,
        body: JSON.stringify(offer)
      });
    }, 300);

    this.isLive$.next(true);
    return this.localStream;
  }

  stopLive(): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/stop`,
      body: JSON.stringify({})
    });
    this.cleanup();
    this.isLive$.next(false);
  }

  // ── 💬 Chat ────────────────────────────────────────
  sendMessage(message: string): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/chat`,
      body: JSON.stringify({
        message,
        userId:   this.userId,
        userName: this.userName,
        role:     this.isAdmin ? 'admin' : 'citoyen'
      })
    });
  }

  // ── 📌 Épingler ────────────────────────────────────
  pinMessage(msg: ChatMessage): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/pin`,
      body: JSON.stringify(msg)
    });
  }

  // ── 🗑️ Supprimer message ──────────────────────────
  deleteMessage(messageId: string): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/delete-message`,
      body: JSON.stringify({ messageId })
    });
  }

  // ── 🚫 Bannir ──────────────────────────────────────
  banUser(userId: string): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/ban`,
      body: JSON.stringify({ userId })
    });
  }

  // ── ❓ Mode questions ──────────────────────────────
  toggleQuestionsOnly(enabled: boolean): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/questions-only`,
      body: JSON.stringify({ enabled })
    });
  }

  // ── 🎛️ Contrôles média ────────────────────────────
  toggleMic(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.micOn$.next(audioTrack.enabled);
      }
    }
  }

  toggleCamera(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.cameraOn$.next(videoTrack.enabled);
      }
    }
  }

  // ── Spectateur rejoint/quitte ──────────────────────
  private joinAsViewer(): void {
    this.createPeerConnection();
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/join`,
      body: JSON.stringify({
        userId:   this.userId,
        userName: this.userName
      })
    });
  }

  leaveAsViewer(): void {
    this.stompClient.publish({
      destination: `/app/live/${this.evenementId}/leave`,
      body: JSON.stringify({
        userId:   this.userId,
        userName: this.userName
      })
    });
    this.cleanup();
  }

  // ── RTCPeerConnection ──────────────────────────────
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(this.iceServers);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.stompClient.publish({
          destination: `/app/live/${this.evenementId}/ice`,
          body: JSON.stringify(event.candidate)
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams[0]) {
        this.remoteStream$.next(event.streams[0]);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 État:', this.peerConnection.connectionState);
    };
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!this.peerConnection) this.createPeerConnection();
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.stompClient.publish({
        destination: `/app/live/${this.evenementId}/answer`,
        body: JSON.stringify(answer)
      });
    } catch (e) { console.error('❌ handleOffer:', e); }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (e) { console.error('❌ handleAnswer:', e); }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (this.peerConnection && candidate?.candidate) {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    } catch (e) { console.error('❌ ICE:', e); }
  }

  getUserId(): string { return this.userId; }
  isAdminMode(): boolean { return this.isAdmin; }

  cleanup(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
  }

  disconnect(): void {
    this.cleanup();
    if (this.stompClient?.active) {
      this.stompClient.deactivate();
    }
  }
}