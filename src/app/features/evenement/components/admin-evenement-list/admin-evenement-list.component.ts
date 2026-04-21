import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { Evenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { LangService } from '../../../../core/services/lang.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-admin-evenement-list',
  templateUrl: './admin-evenement-list.component.html',
  styleUrls: ['./admin-evenement-list.component.css']
})
export class AdminEvenementListComponent implements OnInit {

  evenements: Evenement[] = [];
  evenementsFiltres: Evenement[] = [];
  loading = false;
  erreur = '';
  succes = '';

  page = 1;
  pageSize = 8;
  totalPages = 1;

  recherche = '';
  filtreStatut = '';
  filtreType = '';

  constructor(
    public router: Router,
    private evenementService: EvenementService,
    public sound: SoundService,
    public lang: LangService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading = true;
    this.evenementService.getTousEvenements().subscribe({
      next: (data) => {
        this.evenements = data;
        this.appliquerFiltres();
        this.loading = false;
      },
      error: () => { 
        this.erreur = this.i18n.t('adm.ev.err.load');
        this.loading = false; }
    });
  }

  appliquerFiltres(): void {
    let result = [...this.evenements];
    if (this.recherche) {
      const q = this.recherche.toLowerCase();
      result = result.filter(e =>
        e.titre.toLowerCase().includes(q) || e.lieu.toLowerCase().includes(q)
      );
    }
    if (this.filtreStatut) result = result.filter(e => e.statut === this.filtreStatut);
    if (this.filtreType)   result = result.filter(e => e.type   === this.filtreType);

    this.totalPages = Math.ceil(result.length / this.pageSize) || 1;
    if (this.page > this.totalPages) this.page = 1;
    const start = (this.page - 1) * this.pageSize;
    this.evenementsFiltres = result.slice(start, start + this.pageSize);
  }

  publier(id: number): void {
    this.sound.click();
    this.evenementService.publierEvenement(id).subscribe({
      next: () => { 
        this.sound.success();
        this.succes = this.i18n.t('adm.ev.succes.publish'); this.charger(); setTimeout(() => this.succes = '', 3000); },
      error: () => this.erreur = this.i18n.t('adm.ev.err.publish')
    });
  }

  annuler(id: number): void {
    this.sound.click();
    this.evenementService.annulerEvenement(id).subscribe({
      next: () => { 
        this.sound.success();
        this.succes = this.i18n.t('adm.ev.succes.cancel'); this.charger(); setTimeout(() => this.succes = '', 3000); },
      error: () => this.erreur = this.i18n.t('adm.ev.err.cancel')
    });
  }

  supprimer(id: number): void {
    if (!confirm(this.i18n.t('adm.ev.confirm.delete'))) return;
    this.sound.click(); 
    this.evenementService.supprimerEvenement(id).subscribe({
      next: () => { 
        this.sound.success(); 
        this.succes = this.i18n.t('adm.ev.succes.delete'); this.charger(); setTimeout(() => this.succes = '', 3000); },
      error: () => this.erreur = this.i18n.t('adm.ev.err.delete')
    });
  }

  exportCSV(): void {
    this.sound.click(); 
    const headers = ['ID','Titre','Type','Statut','Date début','Lieu','Inscrits','Payant','Prix'];
    const rows = this.evenements.map(e => [
      e.id, `"${e.titre}"`, e.type, e.statut,
      new Date(e.dateDebut).toLocaleDateString('fr-FR'),
      `"${e.lieu}"`, e.nbInscrits || 0,
      e.estPayant ? 'Oui' : 'Non', e.prix || 0
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv, ], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `evenements_${new Date().toLocaleDateString('fr-FR')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  exportPDF(): void {
    this.sound.click(); 
    const win = window.open('', '_blank')!;
    win.document.write(`
      <html><head><title>Événements — CityVoice</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 32px; color: #0C1F3F; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 2px solid #E8532A; }
        .logo { font-size: 24px; font-weight: 800; color: #0C1F3F; }
        .logo span { color: #E8532A; }
        .meta { font-size: 12px; color: #9CA3AF; text-align: right; }
        .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 24px; }
        .kpi { padding: 14px; border-radius: 8px; background: #F7F4EF; border-left: 3px solid #E8532A; }
        .kpi-num { font-size: 24px; font-weight: 800; }
        .kpi-label { font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: .06em; margin-top: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #0C1F3F; color: white; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
        td { padding: 9px 12px; border-bottom: 1px solid #F3F4F6; font-size: 12px; }
        tr:nth-child(even) td { background: #FAFAFA; }
        .badge { padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .PUBLIE    { background: #d1fae5; color: #065f46; }
        .BROUILLON { background: #fef3c7; color: #92400e; }
        .ANNULE    { background: #fee2e2; color: #991b1b; }
        .TERMINE   { background: #f3f4f6; color: #6b7280; }
        .gratuit   { color: #0D9B76; font-weight: 700; }
        .payant    { color: #E8532A; font-weight: 700; }
      </style></head><body>
      <div class="header">
        <div class="logo">City<span>Voice</span> — Événements</div>
        <div class="meta">Exporté le ${new Date().toLocaleDateString('fr-FR')}<br>${this.evenements.length} événements au total</div>
      </div>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-num">${this.evenements.length}</div><div class="kpi-label">Total</div></div>
        <div class="kpi"><div class="kpi-num">${this.evenements.filter(e=>e.statut==='PUBLIE').length}</div><div class="kpi-label">Publiés</div></div>
        <div class="kpi"><div class="kpi-num">${this.evenements.reduce((s,e)=>s+(e.nbInscrits||0),0)}</div><div class="kpi-label">Inscrits</div></div>
        <div class="kpi"><div class="kpi-num">${this.evenements.filter(e=>e.estPayant).length}</div><div class="kpi-label">Payants</div></div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Titre</th><th>Type</th><th>Statut</th>
          <th>Date début</th><th>Lieu</th><th>Inscrits</th><th>Prix</th>
        </tr></thead>
        <tbody>
          ${this.evenements.map(e => `
            <tr>
              <td style="color:#9CA3AF">${e.id}</td>
              <td><strong>${e.titre}</strong></td>
              <td>${e.type}</td>
              <td><span class="badge ${e.statut}">${e.statut}</span></td>
              <td>${new Date(e.dateDebut).toLocaleDateString('fr-FR')}</td>
              <td>${e.lieu}</td>
              <td style="text-align:center;font-weight:700">${e.nbInscrits || 0}</td>
              <td class="${e.estPayant ? 'payant' : 'gratuit'}">${e.estPayant ? (e.prix + ' TND') : 'Gratuit'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  getStatutClass(statut: string): string {
    const map: any = {
      PUBLIE: 'badge-publie', BROUILLON: 'badge-brouillon',
      ANNULE: 'badge-annule', TERMINE: 'badge-termine'
    };
    return map[statut] || '';
  }
  getStatutLabel(statut: string): string {
    const map: any = {
      'PUBLIE':    this.i18n.t('adm.ev.statut.publie'),
      'BROUILLON': this.i18n.t('adm.ev.statut.brouillon'),
      'ANNULE':    this.i18n.t('adm.ev.statut.annule'),
      'TERMINE':   this.i18n.t('adm.ev.statut.termine'),
    };
    return map[statut] || statut;
  }

  getTypeLabel(type: string): string {
    const map: any = {
      'BENEVOLE':  this.i18n.t('adm.ev.type.benevole'),
      'EDUCATION': this.i18n.t('adm.ev.type.education'),
      'RECYCLAGE': this.i18n.t('adm.ev.type.recyclage'),
      'SEMINAIRE': this.i18n.t('adm.ev.type.seminaire'),
      'PAYANT':    this.i18n.t('adm.ev.type.payant'),
    };
    return map[type] || type;
  }
  clearMessages(): void { this.erreur = ''; this.succes = ''; }
}