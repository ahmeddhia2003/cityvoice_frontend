import {
  Component, OnInit, OnDestroy, NgZone,
  ChangeDetectorRef, AfterViewInit
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

declare const gsap: any;

interface VoiceSessionState {
  sessionId: string;
  step: 'idle' | 'description' | 'location' | 'processing' | 'completed' | 'error';
  descriptionTranscription?: string;
  locationTranscription?: string;
  descriptionAudioBlob?: Blob;
  locationAudioBlob?: Blob;
  signalementId?: number;
  errorMessage?: string;
}

@Component({
  selector: 'app-voice-signalement',
  templateUrl: './voice-signalement.component.html',
  styleUrls: ['./voice-signalement.component.css']
})
export class VoiceSignalementComponent implements OnInit, AfterViewInit, OnDestroy {

  state: VoiceSessionState = { sessionId: '', step: 'idle' };

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private synth = window.speechSynthesis;
  private audioCtx: AudioContext | null = null;

  private recordingTimer: number | null = null;
  private waveformTween: any = null;
  private idleOrbTween: any = null;
  private procArcTween: any = null;
  private dotTween: any = null;

  recordingSeconds = 0;
  isRecording = false;
  isProcessing = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.generateSessionId();
  }

  ngAfterViewInit() {
    // Petite pause pour que *ngIf render l'état idle
    setTimeout(() => this.animateIdle(), 80);
  }

  ngOnDestroy() {
    this.killAllTweens();
    this.cleanup();
  }

  // ─────────────────────────────────────────────────────────────
  // ANIMATIONS GSAP
  // ─────────────────────────────────────────────────────────────

  private gsapAvailable(): boolean {
    return typeof gsap !== 'undefined';
  }

  /** Tue toutes les animations en cours */
  private killAllTweens() {
    if (!this.gsapAvailable()) return;
    if (this.waveformTween)  { this.waveformTween.kill();  this.waveformTween  = null; }
    if (this.idleOrbTween)   { this.idleOrbTween.kill();   this.idleOrbTween   = null; }
    if (this.procArcTween)   { this.procArcTween.kill();   this.procArcTween   = null; }
    if (this.dotTween)       { this.dotTween.kill();       this.dotTween       = null; }
    gsap.killTweensOf('.vc-bar');
    gsap.killTweensOf('.vc-orb__ring');
    gsap.killTweensOf('#proc-arc');
    gsap.killTweensOf('.vc-dot-rec');
    gsap.killTweensOf('#pin-anim');
  }

  /** IDLE : entrée carte + pulsations orb */
  private animateIdle() {
    if (!this.gsapAvailable()) return;
    const tl = gsap.timeline();

    // Carte apparaît
    tl.fromTo('#vc-card',
      { opacity: 0, y: 30, scale: .97 },
      { opacity: 1, y: 0, scale: 1, duration: .55, ease: 'power3.out' }
    )
    // Orbe micro entre avec bounce
    .fromTo('#idle-orb',
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: .55, ease: 'back.out(1.8)' }, '-=.2'
    )
    // Intro glisse vers le haut
    .fromTo('#idle-intro',
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: .4, ease: 'power2.out' }, '-=.1'
    )
    // Flow steps en cascade
    .fromTo('#idle-flow .vc-flow__step',
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: .35, stagger: .08, ease: 'power2.out' }, '-=.05'
    )
    // Perks
    .fromTo('#idle-perks li',
      { x: -12, opacity: 0 },
      { x: 0, opacity: 1, duration: .3, stagger: .07, ease: 'power2.out' }, '-=.05'
    )
    // Bouton
    .fromTo('#idle-btn',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: .35, ease: 'back.out(1.4)' }, '-=.05'
    );

    // Rings pulsants en loop infini
    this.idleOrbTween = gsap.to('.vc-orb__ring--1', {
      scale: 1.6, opacity: .5,
      duration: 1.4, ease: 'power1.inOut',
      repeat: -1, yoyo: true
    });
    gsap.to('.vc-orb__ring--2', {
      scale: 1.4, opacity: .25,
      duration: 1.8, ease: 'power1.inOut',
      repeat: -1, yoyo: true,
      delay: .3
    });
  }

  /** DESCRIPTION / LOCATION : entrée état enregistrement + waveform */
  private animateRecording(step: 'description' | 'location') {
    if (!this.gsapAvailable()) return;
    this.killAllTweens();

    const prefix = step === 'description' ? '#state-desc' : '#state-loc';
    const bars   = step === 'description' ? '#waveform-desc .vc-bar' : '#waveform-loc .vc-bar';
    const dotSel = step === 'description' ? '.vc-dot-rec' : '.vc-dot-rec--amber';

    const tl = gsap.timeline();
    tl.fromTo(prefix,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: .45, ease: 'power3.out' }
    );

    // Si location, animer le pin
    if (step === 'location') {
      tl.fromTo('#pin-anim',
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: .5, ease: 'bounce.out' }, '-=.2'
      );
    }

    // Waveform bars en loop : chaque barre monte/descend avec délai aléatoire
    const barEls = document.querySelectorAll(bars);
    barEls.forEach((bar, i) => {
      const h = 8 + Math.random() * 36;
      gsap.to(bar, {
        scaleY: h / 8,
        duration: 0.3 + Math.random() * .3,
        repeat: -1,
        yoyo: true,
        ease: 'power1.inOut',
        delay: i * .06,
        transformOrigin: 'center center'
      });
    });

    // Dot REC clignote
    this.dotTween = gsap.to(dotSel, {
      opacity: 0,
      duration: .5,
      repeat: -1,
      yoyo: true,
      ease: 'none'
    });
  }

  /** PROCESSING : arc SVG rotatif + orb spin */
  private animateProcessing() {
    if (!this.gsapAvailable()) return;
    this.killAllTweens();

    const tl = gsap.timeline();
    tl.fromTo('#state-proc',
      { opacity: 0, scale: .96 },
      { opacity: 1, scale: 1, duration: .4, ease: 'power2.out' }
    )
    .fromTo('#proc-orb',
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: .5, ease: 'back.out(1.6)' }, '-=.1'
    )
    .fromTo('#proc-title',
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: .35, ease: 'power2.out' }, '-=.1'
    );

    // Arc qui tourne
    this.procArcTween = gsap.to('#proc-arc', {
      strokeDashoffset: -276,
      duration: 1.2,
      repeat: -1,
      ease: 'none'
    });

    // Orbe intérieure qui pulse doucement
    gsap.to('.vc-proc-inner', {
      scale: 1.08,
      duration: .8,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut'
    });
  }

  /** Quand une transcription arrive en temps réel → slide in */
  animateTranscriptionAppear(id: string) {
    if (!this.gsapAvailable()) return;
    setTimeout(() => {
      gsap.fromTo(`#${id}`,
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, duration: .4, ease: 'power2.out' }
      );
    }, 50);
  }

  /** COMPLETED : checkmark SVG animé + confettis */
  private animateCompleted() {
    if (!this.gsapAvailable()) return;
    this.killAllTweens();

    setTimeout(() => {
      const tl = gsap.timeline();

      // Cercle se dessine
      tl.fromTo('#check-circle',
        { strokeDashoffset: 276 },
        { strokeDashoffset: 0, duration: .7, ease: 'power2.inOut' }
      )
      // Checkmark se dessine
      .fromTo('#check-mark',
        { strokeDashoffset: 60 },
        { strokeDashoffset: 0, duration: .45, ease: 'power2.out' }, '-=.1'
      )
      // Titre bounce in
      .fromTo('#done-title',
        { scale: .7, opacity: 0 },
        { scale: 1, opacity: 1, duration: .45, ease: 'back.out(1.8)' }, '-=.1'
      )
      .fromTo('#done-id',
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: .3, ease: 'power2.out' }
      )
      .fromTo('#done-summary',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: .35, ease: 'power2.out' }
      )
      .fromTo('#done-redirect',
        { opacity: 0 },
        { opacity: 1, duration: .3, ease: 'none' }
      );

      // Confettis
      this.spawnConfetti();
    }, 60);
  }

  private spawnConfetti() {
    if (!this.gsapAvailable()) return;
    const colors = ['#E8532A', '#0D9B76', '#C9973E', '#0C1F3F', '#93C5FD'];
    const card = document.querySelector('.vc-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * .3;

    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      const size = 5 + Math.random() * 7;
      p.style.cssText = `
        position:fixed;width:${size}px;height:${size}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        border-radius:${Math.random() > .5 ? '50%' : '2px'};
        left:${cx}px;top:${cy}px;pointer-events:none;z-index:9999;opacity:0;`;
      document.body.appendChild(p);

      const angle = (Math.random() * 360) * (Math.PI / 180);
      const dist  = 80 + Math.random() * 160;
      gsap.to(p, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 60,
        opacity: 1,
        duration: .1,
        onComplete: () => gsap.to(p, {
          y: `+=${120 + Math.random() * 80}`,
          opacity: 0,
          duration: .7 + Math.random() * .5,
          ease: 'power1.in',
          onComplete: () => p.remove()
        })
      });
    }
  }

  /** ERROR */
  private animateError() {
    if (!this.gsapAvailable()) return;
    this.killAllTweens();
    setTimeout(() => {
      const tl = gsap.timeline();
      tl.fromTo('#state-err',
        { opacity: 0, scale: .95 },
        { opacity: 1, scale: 1, duration: .4, ease: 'power2.out' }
      )
      .fromTo('#err-icon',
        { scale: 0, rotation: -15 },
        { scale: 1, rotation: 0, duration: .45, ease: 'back.out(1.8)' }, '-=.1'
      )
      .fromTo('#err-title',
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: .3, ease: 'power2.out' }
      );
      // Petite secousse
      gsap.to('#err-icon', {
        x: 6, duration: .07, repeat: 5, yoyo: true, ease: 'none', delay: .5
      });
    }, 60);
  }

  // ─────────────────────────────────────────────────────────────
  // LOGIQUE VOCALE (inchangée)
  // ─────────────────────────────────────────────────────────────

  async startCall() {
    try {
      try { this.audioCtx = new AudioContext(); } catch (e) {}

      this.state.step = 'description';
      this.cdr.detectChanges();

      // Animer après le rendu
      setTimeout(() => this.animateRecording('description'), 50);

      await this.requestMicrophone();
      this.playTTS('Quel est votre signalement ?');
      this.scheduleBeep(2.5);
      setTimeout(() => {
        this.ngZone.run(() => this.startRecording());
      }, 3000);

    } catch (error: any) {
      this.handleError('Impossible d\'accéder au microphone: ' + (error?.message || String(error)));
    }
  }

  private async requestMicrophone(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
      .find(t => MediaRecorder.isTypeSupported(t)) || '';
    this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : {});

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.audioChunks.push(event.data);
    };
    this.mediaRecorder.onstop = () => { this.onRecordingStopped(); };
  }

  private startRecording() {
    if (!this.mediaRecorder) return;
    this.audioChunks = [];
    this.mediaRecorder.start();
    this.isRecording = true;
    this.recordingSeconds = 0;

    this.recordingTimer = window.setInterval(() => {
      this.ngZone.run(() => {
        this.recordingSeconds++;
        if (this.recordingSeconds >= 90) this.stopRecording();
      });
    }, 1000);
  }

  stopRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    if (this.recordingTimer) { clearInterval(this.recordingTimer); this.recordingTimer = null; }
  }

  private async onRecordingStopped() {
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    if (this.state.step === 'description') {
      this.state.descriptionAudioBlob = audioBlob;
      this.state.descriptionTranscription = 'Envoi en cours…';
      this.isProcessing = true;
      try { await this.uploadAudio(audioBlob, 'description'); } catch (e) { return; }
      this.isProcessing = false;

      this.ngZone.run(() => {
        this.state.step = 'location';
        this.recordingSeconds = 0;
        this.cdr.detectChanges();
        setTimeout(() => this.animateRecording('location'), 50);
      });

      this.playTTS('Merci. Indiquez maintenant l\'adresse ou un point de repère.');
      this.scheduleBeep(2.5);
      setTimeout(() => { this.ngZone.run(() => this.startRecording()); }, 3000);

    } else if (this.state.step === 'location') {
      this.state.locationAudioBlob = audioBlob;
      this.state.locationTranscription = 'Envoi en cours…';
      this.isProcessing = true;
      try { await this.uploadAudio(audioBlob, 'location'); } catch (e) { return; }
      this.isProcessing = false;

      this.ngZone.run(() => {
        this.state.step = 'processing';
        this.cdr.detectChanges();
        setTimeout(() => this.animateProcessing(), 50);
      });

      this.playTTS('Merci. Votre signalement vocal a été reçu et sera analysé automatiquement.');
      this.waitForCompletion();
    }
  }

  private async uploadAudio(audioBlob: Blob, step: 'description' | 'location'): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const currentUser = this.authService.getCurrentUser();
          const response = await this.http.post<any>(
            `${environment.apiUrl}/api/v1/hybrid-voice/upload`,
            { sessionId: this.state.sessionId, source: 'web', step, audioBase64: base64, userId: currentUser?.userId ?? null }
          ).toPromise();

          if (response?.sessionId) { this.state.sessionId = response.sessionId; resolve(); }
          else reject('Réponse serveur invalide');
        } catch (error: any) {
          const status = error?.status;
          const detail = error?.error?.error || error?.error?.message || error?.message || '';
          this.handleError(`Erreur ${status || ''} upload audio${detail ? ': ' + detail : ''}`);
          reject(error);
        }
      };
      reader.onerror = () => reject('Erreur lecture blob audio');
      reader.readAsDataURL(audioBlob);
    });
  }

  private waitForCompletion() {
    this.isProcessing = true;
    let attempts = 0;
    let descShown = false;
    let locShown  = false;

    const checkInterval = setInterval(async () => {
      attempts++;
      try {
        const session = await this.http.get<any>(
          `${environment.apiUrl}/api/v1/hybrid-voice/session/${this.state.sessionId}`
        ).toPromise();

        if (session) {
          this.ngZone.run(() => {
            if (session.descriptionTranscription && !descShown) {
              this.state.descriptionTranscription = session.descriptionTranscription;
              descShown = true;
              this.cdr.detectChanges();
              this.animateTranscriptionAppear('trans-desc');
            }
            if (session.locationTranscription && !locShown) {
              this.state.locationTranscription = session.locationTranscription;
              locShown = true;
              this.cdr.detectChanges();
              this.animateTranscriptionAppear('trans-loc');
            }
          });

          if (session.completed) {
            clearInterval(checkInterval);
            this.ngZone.run(() => {
              this.state.signalementId = session.signalementId;
              this.state.step = 'completed';
              this.isProcessing = false;
              this.cdr.detectChanges();
              this.animateCompleted();
            });
            this.playTTS('Signalement créé avec succès. Merci!');
            this.redirectAfterDelay();
          }

          if (session.errorMessage && !session.completed) {
            clearInterval(checkInterval);
            this.ngZone.run(() => this.handleError('Erreur traitement: ' + session.errorMessage));
          }
        }
      } catch (error: any) {
        if (error?.status !== 404) console.error('[VOICE] Erreur session:', error);
      }

      if (attempts > 60) {
        clearInterval(checkInterval);
        this.ngZone.run(() => this.handleError('Délai dépassé — veuillez réessayer'));
      }
    }, 1000);
  }

  private redirectAfterDelay() {
    setTimeout(() => {
      this.router.navigate(['/signaler/mes-signalements']);
    }, 5000);
  }

  private playTTS(text: string) {
    try {
      if (!('speechSynthesis' in window)) return;
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      this.synth.speak(utterance);
    } catch (e) {}
  }

  private scheduleBeep(delaySeconds: number) {
    try {
      const ctx = this.audioCtx;
      if (!ctx) return;
      if (ctx.state === 'suspended') { ctx.resume().then(() => this._doBeep(ctx, delaySeconds)); }
      else { this._doBeep(ctx, delaySeconds); }
    } catch (e) {}
  }

  private _doBeep(ctx: AudioContext, delaySeconds: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime + delaySeconds);
      osc.stop(ctx.currentTime + delaySeconds + 0.5);
    } catch (e) {}
  }

  private generateSessionId() {
    this.state.sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  private handleError(message: string) {
    console.error('[VOICE]', message);
    this.state.step = 'error';
    this.state.errorMessage = message;
    this.isRecording = false;
    this.isProcessing = false;
    this.cleanup();
    this.cdr.detectChanges();
    this.animateError();
  }

  private cleanup() {
    if (this.recordingTimer) clearInterval(this.recordingTimer);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
    if (this.mediaStream) this.mediaStream.getTracks().forEach(t => t.stop());
    this.synth.cancel();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────

  get canStartCall(): boolean {
    return this.state.step === 'idle' && !this.isRecording && !this.isProcessing;
  }
  get canStopRecording(): boolean {
    return this.isRecording && this.recordingSeconds > 2;
  }

  retry() {
    this.killAllTweens();
    this.state = { sessionId: '', step: 'idle' };
    this.generateSessionId();
    this.cdr.detectChanges();
    setTimeout(() => this.animateIdle(), 80);
  }
}
