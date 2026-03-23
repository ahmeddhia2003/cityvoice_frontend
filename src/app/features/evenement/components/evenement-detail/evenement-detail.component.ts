import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Evenement } from '../../models/evenement.model';
import { Sponsor } from '../../models/sponsor.model';
import { EvenementService } from '../../services/evenement.service';

@Component({
  selector: 'app-evenement-detail',
  templateUrl: './evenement-detail.component.html',
  styleUrls: ['./evenement-detail.component.css']
})
export class EvenementDetailComponent implements OnInit {

  evenement: Evenement | null = null;
  sponsors: Sponsor[] = [];
  loading = false;
  inscriptionLoading = false;
  erreur = '';
  succes = '';
  inscriptionForm: FormGroup;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private evenementService: EvenementService
  ) {
    this.inscriptionForm = this.fb.group({
       citoyenId: [Date.now()],
      email: ['', [Validators.required, Validators.email]],
      nom:   ['',  Validators.required]
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.chargerEvenement(id);
    this.chargerSponsors(id);
  }

  chargerEvenement(id: number): void {
    this.loading = true;
    this.evenementService.getEvenementById(id).subscribe({
      next: (data) => { this.evenement = data; this.loading = false; },
      error: () => { this.erreur = 'Événement introuvable'; this.loading = false; }
    });
  }

  chargerSponsors(id: number): void {
    this.evenementService.getSponsors(id).subscribe({
      next: (data) => this.sponsors = data,
      error: () => {}
    });
  }

  inscrire(): void {
    if (this.inscriptionForm.invalid || !this.evenement?.id) return;
    this.inscriptionLoading = true;
    this.evenementService.inscrireParticipant(
      this.evenement.id, this.inscriptionForm.value
    ).subscribe({
      next: () => {
        this.succes = '✅ Inscription confirmée ! Vous recevrez une confirmation.';
        this.inscriptionLoading = false;
        this.inscriptionForm.reset();
      },
      error: (err) => {
        this.erreur = err.error?.erreur || 'Erreur lors de l\'inscription';
        this.inscriptionLoading = false;
      }
    });
  }

  publier(): void {
    if (!this.evenement?.id) return;
    this.evenementService.publierEvenement(this.evenement.id).subscribe({
      next: (ev) => { this.evenement = ev; this.succes = 'Événement publié !'; },
      error: () => this.erreur = 'Erreur lors de la publication'
    });
  }

  getCapacitePercent(): number {
    if (!this.evenement?.capaciteMax) return 0;
    return Math.min(((this.evenement.nbInscrits || 0) / this.evenement.capaciteMax) * 100, 100);
  }

  getPlacesRestantes(): number {
    if (!this.evenement?.capaciteMax) return 0;
    return this.evenement.capaciteMax - (this.evenement.nbInscrits || 0);
  }

  getCapaciteColor(): string {
    const p = this.getCapacitePercent();
    if (p >= 90) return 'var(--coral)';
    if (p >= 60) return 'var(--gold)';
    return 'var(--teal)';
  }

  getStatutClass(statut: string): string {
    const map: any = {
      PUBLIE: 'badge-publie', BROUILLON: 'badge-brouillon',
      ANNULE: 'badge-annule', TERMINE:   'badge-termine'
    };
    return map[statut] || '';
  }

  getNiveauClass(niveau: string): string {
    const map: any = {
      PLATINE: 'niveau-platine', OR: 'niveau-or',
      ARGENT:  'niveau-argent',  BRONZE: 'niveau-bronze'
    };
    return map[niveau] || 'niveau-bronze';
  }

  retour(): void { this.router.navigate(['/evenements']); }
}