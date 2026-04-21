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

  // KPIs animés
  totalEvenements    = 0;
  totalInscrits      = 0;
  totalRevenus       = 0;
  evenementsPublies  = 0;
  tauxRemplissage    = 0;
  topZone            = '';
  topTypeLieu        = '';
  evenementsCetteSemaine: Evenement[] = [];

  // Valeurs cibles pour animation
  private _totalEvenements   = 0;
  private _totalInscrits     = 0;
  private _totalRevenus      = 0;
  private _evenementsPublies = 0;
  private _tauxRemplissage   = 0;

  constructor(
    public router: Router,
    private evenementService: EvenementService,
    public sound: SoundService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.evenementService.getStats().subscribe({
      next: (stats) => {
        this._totalEvenements   = stats.totalEvenements;
        this._totalInscrits     = stats.totalInscrits;
        this._totalRevenus      = Math.round(stats.totalRevenus);
        this._evenementsPublies = stats.evenementsPublies;
        this._tauxRemplissage   = Math.round(stats.tauxRemplissageMoyen);
        this.topZone            = Object.entries(
          stats.parZone as Record<string, number>
        ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        this.topTypeLieu        = Object.entries(
          stats.parTypeLieu as Record<string, number>
        ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
        this.evenementsCetteSemaine = stats.evenementsCetteSemaine || [];

        this.loading = false;
        setTimeout(() => {
          this.animerKPIs();
          this.buildChartsFromStats(stats);
        }, 500);
      },
      error: () => {
        // Fallback si endpoint stats pas dispo
        this.evenementService.getTousEvenements().subscribe({
          next: (data) => {
            this.evenements = data;
            this.calculerKPIs();
            this.loading = false;
            setTimeout(() => {
              this.animerKPIs();
              this.buildCharts();
            }, 300);
          }
        });
      }
    });
  }

  // ── Calcul KPIs fallback ──────────────────────────
  calculerKPIs(): void {
    this._totalEvenements   = this.evenements.length;
    this._totalInscrits     = this.evenements
      .reduce((s, e) => s + (e.nbInscrits || 0), 0);
    this._evenementsPublies = this.evenements
      .filter(e => e.statut === 'PUBLIE').length;
    this._totalRevenus      = this.evenements
      .filter(e => e.estPayant)
      .reduce((s, e) => s + ((e.prix as any || 0) * (e.nbInscrits || 0)), 0);

    const avecCapacite = this.evenements
      .filter(e => e.capaciteMax && e.capaciteMax > 0);
    if (avecCapacite.length > 0) {
      const totalTaux = avecCapacite.reduce((s, e) =>
        s + ((e.nbInscrits || 0) / (e.capaciteMax || 1)) * 100, 0
      );
      this._tauxRemplissage = Math.round(totalTaux / avecCapacite.length);
    }

    const maintenant = new Date();
    const finSemaine = new Date();
    finSemaine.setDate(maintenant.getDate() + 7);
    this.evenementsCetteSemaine = this.evenements.filter(e => {
      if (!e.dateDebut) return false;
      const d = new Date(e.dateDebut);
      return d >= maintenant && d <= finSemaine;
    });

    const zones: Record<string, number> = {};
    this.evenements.forEach(e => {
      if (e.zone) zones[e.zone] = (zones[e.zone] || 0) + 1;
    });
    this.topZone = Object.entries(zones)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const lieux: Record<string, number> = {};
    this.evenements.forEach(e => {
      if (e.typeLieu) lieux[e.typeLieu] = (lieux[e.typeLieu] || 0) + 1;
    });
    this.topTypeLieu = Object.entries(lieux)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  }

  // ── Animation KPIs ────────────────────────────────
  animerKPIs(): void {
    this.animateCounter('totalEvenements',   this._totalEvenements,   1200);
    this.animateCounter('totalInscrits',     this._totalInscrits,     1500);
    this.animateCounter('totalRevenus',      this._totalRevenus,      1800);
    this.animateCounter('evenementsPublies', this._evenementsPublies, 1000);
    this.animateCounter('tauxRemplissage',   this._tauxRemplissage,   2000);
  }

  animateCounter(property: string, target: number, duration: number): void {
    const start   = performance.now();
    const animate = (now: number) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3);
      (this as any)[property] = Math.round(ease * target);
      if (progress < 1) requestAnimationFrame(animate);
      else (this as any)[property] = target;
    };
    requestAnimationFrame(animate);
  }

  // ── Charts depuis backend stats ───────────────────
  buildChartsFromStats(stats: any): void {
    console.log('🎨 buildChartsFromStats appelé');
    console.log('parType:', stats.parType);
    console.log('canvas type-chart:', document.getElementById('type-chart'));
    if (typeof Chart === 'undefined') {
      console.log('❌ Chart.js non disponible');
      return;
    }

    // Type chart
    const elType = document.getElementById('type-chart') as HTMLCanvasElement;
    if (elType && Object.keys(stats.parType || {}).length > 0) {
      new Chart(elType.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(stats.parType),
          datasets: [{
            data: Object.values(stats.parType),
            backgroundColor: ['#E8532A','#0D9B76','#3B82F6',
                              '#C9973E','#7C3AED','#EC4899'],
            borderWidth: 2, borderColor: '#fff', hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          animation: { animateRotate: true, duration: 1000 },
          plugins: { legend: { position: 'bottom',
            labels: { font: { size: 11 }, padding: 14 } } }
        }
      });
    }

    // Statut chart
    const elStatut = document.getElementById('statut-chart') as HTMLCanvasElement;
    if (elStatut && Object.keys(stats.parStatut || {}).length > 0) {
      const colors: Record<string, string> = {
        PUBLIE: '#0D9B76', BROUILLON: '#C9973E',
        ANNULE: '#E8532A', TERMINE:   '#9CA3AF'
      };
      new Chart(elStatut.getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(stats.parStatut),
          datasets: [{
            data: Object.values(stats.parStatut),
            backgroundColor: Object.keys(stats.parStatut)
              .map((s: string) => colors[s] || '#9CA3AF'),
            borderRadius: 8, borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 900, easing: 'easeOutBounce' },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { stepSize: 1 },
                 grid: { color: 'rgba(12,31,63,.06)' } }
          }
        }
      });
    }

    // Zones chart
    const elZones = document.getElementById('zones-chart') as HTMLCanvasElement;
    if (elZones && Object.keys(stats.parZone || {}).length > 0) {
      new Chart(elZones.getContext('2d'), {
        type: 'bar',
        data: {
          labels: Object.keys(stats.parZone),
          datasets: [{
            data: Object.values(stats.parZone),
            backgroundColor: '#0D9B76',
            borderRadius: 8, borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 800, easing: 'easeOutCubic' },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { stepSize: 1 },
                 grid: { color: 'rgba(12,31,63,.06)' } }
          }
        }
      });
    }

    // Type lieu chart
    const elLieu = document.getElementById('type-lieu-chart') as HTMLCanvasElement;
    if (elLieu && Object.keys(stats.parTypeLieu || {}).length > 0) {
      new Chart(elLieu.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: Object.keys(stats.parTypeLieu),
          datasets: [{
            data: Object.values(stats.parTypeLieu),
            backgroundColor: ['#0C1F3F','#C9973E','#0D9B76','#E8532A','#7C3AED'],
            borderWidth: 2, borderColor: '#fff', hoverOffset: 8
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '65%',
          animation: { animateRotate: true, duration: 1000 },
          plugins: { legend: { position: 'bottom',
            labels: { font: { size: 10 }, padding: 12 } } }
        }
      });
    }

    // Top 5 inscrits
    const elTop = document.getElementById('inscrits-chart') as HTMLCanvasElement;
    if (elTop && stats.top5Inscrits?.length > 0) {
      new Chart(elTop.getContext('2d'), {
        type: 'bar',
        data: {
          labels: stats.top5Inscrits.map((e: any) =>
            e.titre?.length > 22 ? e.titre.substring(0, 22) + '…' : e.titre
          ),
          datasets: [{
            data: stats.top5Inscrits.map((e: any) => e.nbInscrits || 0),
            backgroundColor: ['#E8532A','#C9973E','#0D9B76','#3B82F6','#7C3AED'],
            borderRadius: 8, borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          animation: { duration: 1000, easing: 'easeOutQuart' },
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(12,31,63,.06)' },
                 ticks: { font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } }
          }
        }
      });
    }

    // Tendance par mois
    const elTendance = document.getElementById('tendance-chart') as HTMLCanvasElement;
    if (elTendance) {
      new Chart(elTendance.getContext('2d'), {
        type: 'line',
        data: {
          labels: Object.keys(stats.inscriptionsParMois || {}),
          datasets: [
            {
              label: 'Inscriptions',
              data: Object.values(stats.inscriptionsParMois || {}),
              borderColor: '#E8532A',
              backgroundColor: 'rgba(232,83,42,0.08)',
              borderWidth: 2.5, fill: true, tension: 0.4,
              pointBackgroundColor: '#E8532A',
              pointRadius: 5, pointHoverRadius: 7,
            },
            {
              label: 'Événements',
              data: Object.values(stats.evenementsParMois || {}),
              borderColor: '#0D9B76',
              backgroundColor: 'rgba(13,155,118,0.08)',
              borderWidth: 2.5, fill: true, tension: 0.4,
              pointBackgroundColor: '#0D9B76',
              pointRadius: 5, pointHoverRadius: 7,
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 1200, easing: 'easeInOutQuart' },
          plugins: { legend: { position: 'top',
            labels: { font: { size: 11 }, padding: 16 } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(12,31,63,.06)' },
                 ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  }

  // ── Charts fallback (depuis liste événements) ─────
  buildCharts(): void {
    if (typeof Chart === 'undefined') return;
    this.buildTypeChart();
    this.buildStatutChart();
    this.buildInscritsChart();
    this.buildZonesChart();
    this.buildTypeLieuChart();
    this.buildTendanceChart();
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
        datasets: [{
          data: Object.values(types),
          backgroundColor: ['#E8532A','#0D9B76','#3B82F6',
                            '#C9973E','#7C3AED','#EC4899'],
          borderWidth: 2, borderColor: '#fff', hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        animation: { animateRotate: true, duration: 1000 },
        plugins: { legend: { position: 'bottom',
          labels: { font: { size: 11 }, padding: 14 } } }
      }
    });
  }

  buildStatutChart(): void {
    const el = document.getElementById('statut-chart') as HTMLCanvasElement;
    if (!el) return;
    const colors: Record<string, string> = {
      PUBLIE: '#0D9B76', BROUILLON: '#C9973E',
      ANNULE: '#E8532A', TERMINE:   '#9CA3AF'
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
        datasets: [{
          data: Object.values(statuts),
          backgroundColor: Object.keys(statuts)
            .map(s => colors[s] || '#9CA3AF'),
          borderRadius: 8, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutBounce' },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, ticks: { stepSize: 1 },
               grid: { color: 'rgba(12,31,63,.06)' } }
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
        labels: top5.map(e =>
          e.titre.length > 22 ? e.titre.substring(0, 22) + '…' : e.titre
        ),
        datasets: [{
          data: top5.map(e => e.nbInscrits || 0),
          backgroundColor: ['#E8532A','#C9973E','#0D9B76','#3B82F6','#7C3AED'],
          borderRadius: 8, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(12,31,63,.06)' },
               ticks: { font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  buildZonesChart(): void {
    const el = document.getElementById('zones-chart') as HTMLCanvasElement;
    if (!el) return;
    const zones: Record<string, number> = {};
    this.evenements.forEach(e => {
      if (e.zone) zones[e.zone] = (zones[e.zone] || 0) + 1;
    });
    if (Object.keys(zones).length === 0) return;
    new Chart(el.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(zones),
        datasets: [{
          data: Object.values(zones),
          backgroundColor: '#0D9B76',
          borderRadius: 8, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutCubic' },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, ticks: { stepSize: 1 },
               grid: { color: 'rgba(12,31,63,.06)' } }
        }
      }
    });
  }

  buildTypeLieuChart(): void {
    const el = document.getElementById('type-lieu-chart') as HTMLCanvasElement;
    if (!el) return;
    const lieux: Record<string, number> = {};
    this.evenements.forEach(e => {
      if (e.typeLieu) lieux[e.typeLieu] = (lieux[e.typeLieu] || 0) + 1;
    });
    if (Object.keys(lieux).length === 0) return;
    new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(lieux),
        datasets: [{
          data: Object.values(lieux),
          backgroundColor: ['#0C1F3F','#C9973E','#0D9B76','#E8532A','#7C3AED'],
          borderWidth: 2, borderColor: '#fff', hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        animation: { animateRotate: true, duration: 1000 },
        plugins: { legend: { position: 'bottom',
          labels: { font: { size: 10 }, padding: 12 } } }
      }
    });
  }

  buildTendanceChart(): void {
    const el = document.getElementById('tendance-chart') as HTMLCanvasElement;
    if (!el) return;
    const moisLabels = ['Jan','Fév','Mar','Avr','Mai','Jun',
                        'Jul','Aoû','Sep','Oct','Nov','Déc'];
    const inscriptionsParMois = new Array(12).fill(0);
    const evenementsParMois   = new Array(12).fill(0);
    this.evenements.forEach(e => {
      if (!e.dateDebut) return;
      const mois = new Date(e.dateDebut).getMonth();
      evenementsParMois[mois]++;
      inscriptionsParMois[mois] += (e.nbInscrits || 0);
    });
    new Chart(el.getContext('2d'), {
      type: 'line',
      data: {
        labels: moisLabels,
        datasets: [
          {
            label: 'Inscriptions',
            data: inscriptionsParMois,
            borderColor: '#E8532A',
            backgroundColor: 'rgba(232,83,42,0.08)',
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointBackgroundColor: '#E8532A',
            pointRadius: 5, pointHoverRadius: 7,
          },
          {
            label: 'Événements',
            data: evenementsParMois,
            borderColor: '#0D9B76',
            backgroundColor: 'rgba(13,155,118,0.08)',
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointBackgroundColor: '#0D9B76',
            pointRadius: 5, pointHoverRadius: 7,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1200, easing: 'easeInOutQuart' },
        plugins: { legend: { position: 'top',
          labels: { font: { size: 11 }, padding: 16 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(12,31,63,.06)' },
               ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  retour(): void {
    this.sound.nav();
    this.router.navigate(['/admin/evenements']);
  }
}