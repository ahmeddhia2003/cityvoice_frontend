import {
  Component, Output, EventEmitter,
  ElementRef, ViewChild, OnDestroy, NgZone
} from '@angular/core';
import { SoundService } from '../../../core/services/sound.service';

declare const gsap: any;

@Component({
  selector: 'app-camera-modal',
  templateUrl: './camera-modal.component.html',
  styleUrls: ['./camera-modal.component.css'],
})
export class CameraModalComponent implements OnDestroy {

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Output() photoCaptured = new EventEmitter<string>(); // base64 JPEG
  @Output() closed        = new EventEmitter<void>();

  stream:       MediaStream | null = null;
  isOpen        = false;
  isReady       = false;      // flux vidéo prêt
  shutterAnim   = false;      // animation obturateur
  error:        string | null = null;
  facingMode    = 'environment'; // 'environment' = arrière, 'user' = avant
  isMobile      = /Mobi|Android/i.test(navigator.userAgent);

  constructor(private ngZone: NgZone, public sound: SoundService) {}

  ngOnDestroy(): void { this.stopStream(); }

  /* ── Ouvrir la modal et démarrer la caméra ── */
  async open(): Promise<void> {
    this.isOpen  = true;
    this.isReady = false;
    this.error   = null;

    // Animer l'entrée de la modal
    setTimeout(() => {
      if (typeof gsap !== 'undefined') {
        gsap.fromTo('.cam-modal-box',
          { scale: .88, opacity: 0, y: 30 },
          { scale: 1,   opacity: 1, y: 0, duration: .45, ease: 'back.out(1.6)' }
        );
        gsap.fromTo('.cam-overlay',
          { opacity: 0 }, { opacity: 1, duration: .3 }
        );
      }
      this.startCamera();
    }, 30);
  }

  async startCamera(): Promise<void> {
    try {
      // Arrêter le flux précédent si existant
      this.stopStream();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.facingMode,
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Attacher le flux à la vidéo
      const video = this.videoRef?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        video.onloadedmetadata = () => {
          video.play();
          this.ngZone.run(() => {
            this.isReady = true;
            if (typeof gsap !== 'undefined') {
              gsap.fromTo('.cam-video-wrap',
                { opacity: 0, scale: .97 },
                { opacity: 1, scale: 1, duration: .4, ease: 'power2.out' }
              );
            }
          });
        };
      }
    } catch (err: any) {
      this.ngZone.run(() => {
        if (err.name === 'NotAllowedError') {
          this.error = 'Accès à la caméra refusé. Autorisez la caméra dans les paramètres du navigateur.';
        } else if (err.name === 'NotFoundError') {
          this.error = 'Aucune caméra détectée sur cet appareil.';
        } else {
          this.error = `Erreur caméra : ${err.message}`;
        }
      });
    }
  }

  /* ── Capturer la photo avec animation obturateur ── */
  capture(): void {
    if (!this.isReady) return;
    this.sound.click();
    this.playShutter();
  }

  private playShutter(): void {
    this.shutterAnim = true;

    if (typeof gsap === 'undefined') {
      this.doCapture();
      return;
    }

    const tl = gsap.timeline();

    // 1. Lames se ferment
    tl.to('.cam-blade', {
      scaleY: 0,
      transformOrigin: 'top center',
      duration: .15,
      stagger: .02,
      ease: 'power3.in',
    })
    // 2. Flash blanc
    .to('.cam-flash', {
      opacity: 1,
      duration: .06,
      ease: 'none',
    })
    // 3. Capturer l'image au moment du flash
    .call(() => { this.doCapture(); })
    // 4. Flash disparaît
    .to('.cam-flash', {
      opacity: 0,
      duration: .25,
      ease: 'power2.out',
    })
    // 5. Lames se rouvrent
    .to('.cam-blade', {
      scaleY: 1,
      transformOrigin: 'top center',
      duration: .2,
      stagger: .018,
      ease: 'power2.out',
      onComplete: () => {
        this.ngZone.run(() => { this.shutterAnim = false; });
      }
    }, '-=.1');
  }

  private doCapture(): void {
    const video  = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    this.ngZone.run(() => {
      this.photoCaptured.emit(dataUrl);
      this.close();
    });
  }

  /* ── Retourner la caméra (mobile) ── */
  async flipCamera(): Promise<void> {
    this.sound.nav();
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    this.isReady = false;

    if (typeof gsap !== 'undefined') {
      gsap.to('.cam-video-wrap', {
        scaleX: -1, duration: .2, ease: 'power2.in',
        onComplete: () => {
          gsap.to('.cam-video-wrap', {
            scaleX: 1, duration: .2, ease: 'power2.out',
          });
        }
      });
    }

    await this.startCamera();
  }

  /* ── Fermer ── */
  close(): void {
    if (typeof gsap !== 'undefined') {
      gsap.to('.cam-modal-box', {
        scale: .88, opacity: 0, y: 20, duration: .3, ease: 'power2.in',
        onComplete: () => {
          this.ngZone.run(() => {
            this.stopStream();
            this.isOpen = false;
            this.closed.emit();
          });
        }
      });
      gsap.to('.cam-overlay', { opacity: 0, duration: .3 });
    } else {
      this.stopStream();
      this.isOpen = false;
      this.closed.emit();
    }
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.isReady = false;
  }
}
