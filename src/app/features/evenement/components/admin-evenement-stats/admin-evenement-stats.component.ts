import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { Evenement } from '../../models/evenement.model';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

declare const Chart: any;

@Component({
  selector: 'app-admin-evenement-stats',
  templateUrl: './admin-evenement-stats.component.html',
  styleUrls: ['./admin-evenement-stats.component.css']
})
export class AdminEvenementStatsComponent implements OnInit {

  evenements: Evenement[] = [];
  loading = true;
  totalEvenements = 0;
  totalInscrits   = 0;
  totalRevenus    = 0;
  evenementsPublies = 0;

  constructor(public router: Router, private evenementService: EvenementService, public sound: SoundService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.evenementService.getTousEvenements().subscribe({
      next: (data) => {
        this.evenements = data;
        this.calculerKPIs();
        this.loading = false;
        setTimeout(() => this.buildCharts(), 300);
      }
    });
  }

  calculerKPIs(): void {
    this.totalEvenements   = this.evenements.length;
    this.totalInscrits     = this.evenements.reduce((s, e) => s + (e.nbInscrits || 0), 0);
    this.evenementsPublies = this.evenements.filter(e => e.statut === 'PUBLIE').length;
    this.totalRevenus      = this.evenements
      .filter(e => e.estPayant)
      .reduce((s, e) => s + ((e.prix as any || 0) * (e.nbInscrits || 0)), 0);
  }

  buildCharts(): void {
    if (typeof Chart === 'undefined') return;
    this.buildTypeChart();
    this.buildStatutChart();
    this.buildInscritsChart();
  }

  buildTypeChart(): void {
    const el = document.getElementById('type-chart') as HTMLCanvasElement;
    if (!el) return;
    const types: Record<string, number> = {};
    this.evenements.forEach(e => { types[e.type] = (types[e.type] || 0) + 1; });
    new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(types),
        datasets: [{ data: Object.values(types),
          backgroundColor: ['#E8532A','#0D9B76','#3B82F6','#C9973E','#7C3AED','#EC4899'],
          borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 14 } } } }
    });
  }

  buildStatutChart(): void {
    const el = document.getElementById('statut-chart') as HTMLCanvasElement;
    if (!el) return;
    const colors: Record<string, string> = {
      PUBLIE: '#0D9B76', BROUILLON: '#C9973E', ANNULE: '#E8532A', TERMINE: '#9CA3AF'
    };
    const statuts: Record<string, number> = {};
    this.evenements.forEach(e => {
      const s = e.statut || 'BROUILLON';
      statuts[s] = (statuts[s] || 0) + 1;
    });
    new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(statuts),
        datasets: [{ data: Object.values(statuts),
          backgroundColor: Object.keys(statuts).map(s => colors[s] || '#9CA3AF'),
          borderRadius: 8, borderSkipped: false }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: 'rgba(12,31,63,.06)' } }
        }
      }
    });
  }

  buildInscritsChart(): void {
    const el = document.getElementById('inscrits-chart') as HTMLCanvasElement;
    if (!el) return;
    const top5 = [...this.evenements]
      .sort((a, b) => (b.nbInscrits || 0) - (a.nbInscrits || 0))
      .slice(0, 5);
    new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top5.map(e => e.titre.length > 22 ? e.titre.substring(0, 22) + '…' : e.titre),
        datasets: [{ data: top5.map(e => e.nbInscrits || 0),
          backgroundColor: '#E8532A', borderRadius: 8, borderSkipped: false }]
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(12,31,63,.06)' }, ticks: { font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }
  retour(): void {
  this.sound.nav(); // ← navigation
  this.router.navigate(['/admin/evenements']);
}
}