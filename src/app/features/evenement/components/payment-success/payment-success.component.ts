import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EvenementService } from '../../services/evenement.service';
import { Participant } from '../../models/participant.model';
import { SoundService } from '../../../../core/services/sound.service';
import { I18nService } from '../../../../core/services/i18n.service';

@Component({
  selector: 'app-payment-success',
  templateUrl: './payment-success.component.html',
  styleUrls: ['./payment-success.component.css']
})
export class PaymentSuccessComponent implements OnInit {

  participant: Participant | null = null;
  loading = true;
  erreur = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private evenementService: EvenementService,
    public sound: SoundService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void {
    const participantId = Number(this.route.snapshot.queryParams['participantId']);
    if (!participantId) {
      this.sound.nav();
      this.router.navigate(['/evenements']);
      return;
    }
    // Confirmer le paiement
    this.evenementService.confirmerPaiement(participantId).subscribe({
      next: (p) => { 
        this.participant = p; 
        this.loading = false;
        this.sound.success();
        // ← Redirection vers détail événement après 2 secondes
        setTimeout(() => {
          const evenementId = p.evenementId; // ← extraire ici
          if (evenementId) {
            this.router.navigate(['/evenements', evenementId], {
              queryParams: { participantId: p.id }
            });
          } else {
            this.router.navigate(['/evenements']);
          }
        }, 2000);
      },
      error: () => { this.erreur = this.i18n.t('pay.succes.err'); this.loading = false; }
    });
  }
  retour(): void {
  this.sound.nav(); 
  this.router.navigate(['/evenements']);
}
}