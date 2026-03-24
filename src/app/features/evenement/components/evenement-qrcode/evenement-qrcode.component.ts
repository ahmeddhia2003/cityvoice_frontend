import {
  Component, Input, OnInit,
  ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import * as QRCode from 'qrcode';
import { Participant } from '../../models/participant.model';
import { Evenement } from '../../models/evenement.model';

@Component({
  selector: 'app-evenement-qrcode',
  templateUrl: './evenement-qrcode.component.html',
  styleUrls: ['./evenement-qrcode.component.css']
})
export class EvenementQrcodeComponent implements AfterViewInit {

  @Input() participant!: Participant;
  @Input() evenement!: Evenement;
  @ViewChild('qrCanvas') qrCanvas!: ElementRef;

  ngAfterViewInit(): void {
    setTimeout(() => this.generateQR(), 100);
  }

  private generateQR(): void {
    if (!this.qrCanvas || !this.participant || !this.evenement) return;

    const qrData = JSON.stringify({
      inscriptionId: this.participant.id,
      evenementId:   this.evenement.id,
      nom:           this.participant.nomCitoyen,
      email:         this.participant.emailCitoyen,
      evenement:     this.evenement.titre,
      date:          this.evenement.dateDebut,
      lieu:          this.evenement.lieu
    });

    QRCode.toCanvas(this.qrCanvas.nativeElement, qrData, {
      width:            220,
      margin:           2,
      color: {
        dark:  '#0C1F3F',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });
  }

  telecharger(): void {
    const canvas = this.qrCanvas.nativeElement as HTMLCanvasElement;
    const link = document.createElement('a');
    link.download = `inscription-${this.evenement.titre}-${this.participant.nomCitoyen}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}