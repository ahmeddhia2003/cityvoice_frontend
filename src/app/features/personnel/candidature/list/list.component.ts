import { Component, OnInit } from '@angular/core';
import { CandidatureEquipe, CandidatureEquipeService } from '../../../../core/services/candidature.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CvUserService } from '../../../../core/services/cvUser.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.css'] // ✅ corrigé
})
export class ListComponent implements OnInit {

  candidatures: CandidatureEquipe[] = [];
  filteredCandidatures: CandidatureEquipe[] = [];

  isLoading = true;

  searchTerm = '';
  selectedGouvernorat = '';
  gouvernorats: string[] = [];

  showModal = false;

  selectedFile: File | null = null; // ✅ sécurisé
  selectedCandidatureId: string | null = null;

  selectedCandidature?: CandidatureEquipe;

  appliedMap: { [key: string]: boolean } = {};

  constructor(
    private candidatureService: CandidatureEquipeService,
    private authService: AuthService,
    private cvService: CvUserService
  ) {}

  ngOnInit(): void {
    this.loadCandidatures();
  }

  loadCandidatures(): void {
    this.candidatureService.getAll().subscribe({
      next: (data) => {
        this.candidatures = data;
        this.filteredCandidatures = data;

        this.extractGouvernorats();

        const userId = this.authService.getUserId();

        // ⚠️ Optimisation: éviter N appels si possible côté backend
        if (userId) {
          this.candidatures.forEach(c => {
            if (c.id) {
              this.cvService.hasApplied(c.id, userId).subscribe({
                next: (res) => {
                  this.appliedMap[c.id!] = res;
                },
                error: err => console.error(err)
              });
            }
          });
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });
  }

  extractGouvernorats(): void {
    const set = new Set(
      this.candidatures
        .map(c => c.gouvernorat)
        .filter(Boolean)
    );
    this.gouvernorats = Array.from(set).sort();
  }

  applyFilters(): void {
    this.filteredCandidatures = this.candidatures.filter(c => {
      const search = this.searchTerm.toLowerCase();

      const matchSearch =
        !search ||
        c.statut?.toLowerCase().includes(search) ||
        c.equipe?.name?.toLowerCase().includes(search) ||
        c.gouvernorat?.toLowerCase().includes(search);

      const matchGouv =
        !this.selectedGouvernorat ||
        c.gouvernorat === this.selectedGouvernorat;

      return matchSearch && matchGouv;
    });
  }

  getInitiales(name?: string): string {
    if (!name) return '??';
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('');
  }

  isExpiringSoon(dateExpiration?: string): boolean {
    if (!dateExpiration) return false;

    const expiry = new Date(dateExpiration).getTime();
    const now = Date.now();

    return expiry > now && expiry - now < 7 * 24 * 60 * 60 * 1000;
  }

  trackById(index: number, item: CandidatureEquipe): string {
    return item.id ?? index.toString();
  }

  voirDetails(c: CandidatureEquipe): void {
    if (!c.id) return;

    this.candidatureService.getById(c.id).subscribe({
      next: (data) => this.selectedCandidature = data,
      error: err => console.error(err)
    });
  }

  closeDetails(): void {
    this.selectedCandidature = undefined;
  }

  modifier(c: CandidatureEquipe): void {
    console.log('Modifier', c);
  }

  supprimer(c: CandidatureEquipe): void {
    if (!c.id) return;

    if (!confirm('Supprimer cette candidature ?')) return;

    this.candidatureService.delete(c.id).subscribe({
      next: () => {
        this.candidatures = this.candidatures.filter(x => x.id !== c.id);
        this.applyFilters();
      },
      error: err => console.error(err)
    });
  }

  isCitoyen(): boolean {
    return this.authService.isCitoyen();
  }

  canViewCv(): boolean {
    return this.authService.canViewCv();
  }

  openCvModal(c: CandidatureEquipe): void {
    if (!c.id) return;

    this.selectedCandidatureId = c.id;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedFile = null;
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files?.[0] ?? null;
  }

  uploadCV(): void {
    if (!this.selectedFile) {
      alert('Choisir un fichier');
      return;
    }

    if (!this.selectedCandidatureId) {
      alert('Candidature invalide');
      return;
    }

    const userId = this.authService.getUserId();

    if (!userId) {
      alert('Utilisateur non connecté');
      return;
    }

    this.cvService.uploadCV(this.selectedCandidatureId, userId, this.selectedFile)
      .subscribe({
        next: () => {
          alert('CV envoyé avec succès ✅');
          this.closeModal();
        },
        error: err => {
          console.error(err);
          alert('Erreur upload ❌');
        }
      });
  }

  retirerCandidature(c: CandidatureEquipe): void {
    const userId = this.authService.getUserId();

    if (!c.cvs || c.cvs.length === 0 || !userId) return;

    const myCv = c.cvs.find(cv => cv.userId === userId);
    if (!myCv || !myCv.id) return;

    if (!confirm('Êtes-vous sûr de vouloir retirer votre dépôt ?')) return;

    this.cvService.deleteCV(myCv.id).subscribe({
      next: () => {
        c.cvs = [];
        if (c.id) this.appliedMap[c.id] = false;
      },
      error: err => {
        console.error(err);
        alert('Erreur lors du retrait ❌');
      }
    });
  }

  getCvBadgeClass(count: number): string {
    if (count === 0) return 'cv-zero';
    if (count <= 2) return 'cv-low';
    if (count <= 5) return 'cv-mid';
    return 'cv-high';
  }
}
