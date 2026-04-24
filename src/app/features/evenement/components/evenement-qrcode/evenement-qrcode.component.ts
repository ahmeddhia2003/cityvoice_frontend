import { 
  Component, Input, ViewChild, ElementRef, 
  AfterViewInit, OnChanges, SimpleChanges 
} from '@angular/core';
import * as QRCode from 'qrcode';
import { Participant } from '../../models/participant.model';
import { Evenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-evenement-qrcode',
  templateUrl: './evenement-qrcode.component.html',
  styleUrls: ['./evenement-qrcode.component.css']
})
export class EvenementQrcodeComponent implements AfterViewInit, OnChanges {

  @Input() participant!: Participant;
  @Input() evenement!: Evenement;
  @ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    // Petit délai pour laisser le ViewChild s'initialiser
    setTimeout(() => this.generateQR(), 200);
  }

  // Déclenché si l'objet participant change (ex: après un chargement asynchrone)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['participant'] && !changes['participant'].firstChange) {
      this.generateQR();
    }
  }
  constructor(
      public sound: SoundService,
      public i18n: I18nService
    ) {}

 private generateQR(): void {
  if (!this.qrCanvas || !this.participant) return;

  // EXTRACTION DU TOKEN : On récupère uniquement la chaîne de caractères
  // On ne veut pas de JSON.stringify(...) ici
  const qrData = this.participant.qrToken || (this.participant as any).qr_token;

  console.log("DEBUG Badge - Token envoyé au QR:", qrData);

  if (!qrData) {
    console.error("ERREUR: qrToken manquant !");
    return;
  }

  // On génère le QR avec uniquement la chaîne 'qrData'
  QRCode.toCanvas(this.qrCanvas.nativeElement, qrData, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: 'M'
    }).then(() => {
      this.sound.success();
  });
}

  telecharger(): void {
    this.sound.click();
    const canvas = this.qrCanvas.nativeElement;
    const link = document.createElement('a');
    const nomFichier = this.evenement?.titre || 'evenement';
    const nomCitoyen = this.participant?.nomCitoyen || 'participant';
    
    link.download = `Pass-${nomFichier}-${nomCitoyen}.png`.replace(/\s+/g, '_');
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}