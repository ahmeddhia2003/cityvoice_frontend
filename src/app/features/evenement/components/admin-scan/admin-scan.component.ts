import { Component, OnDestroy, ElementRef, ViewChild, NgZone, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import jsQR from 'jsqr';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

interface QrVerificationResponse {
  statut: 'VALIDE' | 'DEJA_SCANNE' | 'INVALIDE';
  message: string;
  nomCitoyen?: string;
  emailCitoyen?: string;
  nomEvenement?: string;
}

@Component({
  selector: 'app-admin-scan',
  templateUrl: './admin-scan.component.html',
  styleUrls: ['./admin-scan.component.css']
})
export class AdminScanComponent implements AfterViewInit, OnDestroy {
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasEl') canvasEl!: ElementRef<HTMLCanvasElement>;

  scanActif = false;
  verification = false;
  resultat: QrVerificationResponse | null = null;
  erreurCamera = '';
  
  private stream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private readonly API_URL = 'http://localhost:8084/api/qr/verify';
    
  constructor(private http: HttpClient, private zone: NgZone, public sound: SoundService, public i18n: I18nService) {}

  ngAfterViewInit() {
    console.log("Scanner prêt");
  }

  async demarrerScan() {
    this.sound.click();
    this.erreurCamera = '';
    this.resultat = null;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      
      const video = this.videoEl.nativeElement;
      video.srcObject = this.stream;
      video.setAttribute('playsinline', 'true'); 
      
      await video.play();
      this.scanActif = true;
      this.scannerFrame();
    } catch (err) {
      this.erreurCamera = "Accès caméra refusé ou non supporté.";
    }
  }

  private scannerFrame() {
    if (!this.scanActif) return;

    const video = this.videoEl?.nativeElement;
    const canvas = this.canvasEl?.nativeElement;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });

      if (code && !this.verification) {
        // LOG CRITIQUE POUR DEBUGGER LE PORT 8080
        console.log("🔍 CONTENU DU QR DÉTECTÉ :", code.data);
        this.zone.run(() => this.verifierToken(code.data));
        return;
      }
    }
    this.animFrameId = requestAnimationFrame(() => this.scannerFrame());
  }

  private verifierToken(token: string) {
    this.verification = true;
    this.arreterStream();

    console.log("🚀 Envoi vers :", this.API_URL);

    this.http.post<QrVerificationResponse>(this.API_URL, { qrToken: token })
      .subscribe({
        next: (res) => {
          this.resultat = res;
          this.verification = false;
          // ← son selon résultat
          if (res.statut === 'VALIDE')        this.sound.success();
          else if (res.statut === 'INVALIDE') this.sound.click();
          else                                this.sound.nav(); // DEJA_SCANNE
        },
        error: (err) => {
          console.error("❌ Détail de l'erreur :", err);
          this.resultat = { statut: 'INVALIDE', message: 'Erreur réseau (vérifiez port 8084)' };
          this.verification = false;
          this.sound.click();
        }
      });
  }

  scannerSuivant() {
    this.sound.nav();
    this.resultat = null;
    this.demarrerScan();
  }

  arreter() {
    this.sound.nav();
    this.scanActif = false;
    this.resultat = null;
    this.arreterStream();
  }

  private arreterStream() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  ngOnDestroy() { 
    this.arreterStream(); 
  }
}