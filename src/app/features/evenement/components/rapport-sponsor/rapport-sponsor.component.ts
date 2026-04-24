import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-rapport-sponsor',
  templateUrl: './rapport-sponsor.component.html',
  styleUrls: ['./rapport-sponsor.component.css']
})
export class RapportSponsorComponent implements OnInit {

  rapports: any[] = [];
  dernierRapport: any = null;
  loading = false;
  generationLoading = false;
  erreur = '';
  succes = '';

  private readonly API = 'http://localhost:8084/api/sponsors/rapport';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.chargerHistorique();
    this.chargerDernier();
  }

  chargerHistorique(): void {
    this.loading = true;
    this.http.get<any[]>(`${this.API}/historique`).subscribe({
      next: (data) => {
        this.rapports = data;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  chargerDernier(): void {
    this.http.get<any>(`${this.API}/dernier`).subscribe({
      next: (data) => { this.dernierRapport = data; },
      error: () => {}
    });
  }

  genererRapport(): void {
    this.generationLoading = true;
    this.erreur = '';
    this.succes = '';

    this.http.post<any>(`${this.API}/generer`, {}).subscribe({
      next: (data) => {
        this.succes = '✅ Rapport généré et envoyé par email !';
        this.dernierRapport = data;
        this.generationLoading = false;
        this.chargerHistorique();
      },
      error: (err) => {
        this.erreur = '❌ Erreur lors de la génération du rapport.';
        this.generationLoading = false;
      }
    });
  }

  telechargerPdf(rapport: any): void {
    if (!rapport.pdfBase64) return;
    const byteChars = atob(rapport.pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `rapport_sponsors_${rapport.dateRapport}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  previewPdf(rapport: any): void {
    if (!rapport.pdfBase64) return;
    const byteChars = atob(rapport.pdfBase64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}