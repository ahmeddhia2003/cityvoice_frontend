import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Evenement, InscriptionRequest } from '../models/evenement.model';
import { Suggestion, SuggestionAnalyse  } from '../models/suggestion.model';
import { Sponsor } from '../models/sponsor.model';
import { Participant } from '../models/participant.model';

@Injectable({
  providedIn: 'root'
})
export class EvenementService {

  private apiUrl = 'http://localhost:8084/api';

  constructor(private http: HttpClient) {}

  // ── Événements ──────────────────────────────────────
  getEvenements(): Observable<Evenement[]> {
    return this.http.get<Evenement[]>(`${this.apiUrl}/evenements`);
  }

  getTousEvenements(): Observable<Evenement[]> {
    return this.http.get<Evenement[]>(`${this.apiUrl}/evenements/tous`);
  }

  getEvenementById(id: number): Observable<Evenement> {
    return this.http.get<Evenement>(`${this.apiUrl}/evenements/${id}`);
  }

  creerEvenement(evenement: Evenement): Observable<Evenement> {
    return this.http.post<Evenement>(`${this.apiUrl}/evenements`, evenement);
  }
  modifierEvenement(id: number, evenement: any): Observable<Evenement> {
    return this.http.put<Evenement>(`${this.apiUrl}/evenements/${id}`, evenement);
  }
  publierEvenement(id: number): Observable<Evenement> {
    return this.http.put<Evenement>(`${this.apiUrl}/evenements/${id}/publier`, {});
  }

  annulerEvenement(id: number): Observable<Evenement> {
    return this.http.put<Evenement>(`${this.apiUrl}/evenements/${id}/annuler`, {});
  }

  inscrireParticipant(id: number, req: InscriptionRequest): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/evenements/${id}/inscrire`,
      req
    );
  }
  getParticipants(evenementId: number): Observable<Participant[]> {
    return this.http.get<Participant[]>(
      `${this.apiUrl}/evenements/${evenementId}/participants`
    );
  }

  supprimerParticipant(participantId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/evenements/participants/${participantId}`
    );
  }

  confirmerPresence(participantId: number): Observable<Participant> {
    return this.http.put<Participant>(
      `${this.apiUrl}/evenements/participants/${participantId}/confirmer`, {}
    );
  }
  supprimerEvenement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/evenements/${id}`);
  }

  // ── Suggestions ─────────────────────────────────────
  getSuggestions(): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(`${this.apiUrl}/suggestions`);
  }

  getSuggestionsCitoyen(citoyenId: string): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(
      `${this.apiUrl}/suggestions/citoyen/${citoyenId}`
    );
  }

  soumettreSuggestion(suggestion: any): Observable<Suggestion> {
    return this.http.post<Suggestion>(`${this.apiUrl}/suggestions`, suggestion);
  }

  modifierSuggestion(id: number, suggestion: any): Observable<Suggestion> {
    return this.http.put<Suggestion>(
      `${this.apiUrl}/suggestions/${id}`, suggestion
    );
  }

  supprimerSuggestion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/suggestions/${id}`);
  }

  traiterSuggestion(id: number, statut: string, commentaire?: string): Observable<Suggestion> {
    return this.http.put<Suggestion>(
      `${this.apiUrl}/suggestions/${id}/traiter?statut=${statut}`,
      { commentaire: commentaire || '' }
    );
  }

  analyserSuggestion(id: number): Observable<SuggestionAnalyse> {
    return this.http.post<SuggestionAnalyse>(
      `${this.apiUrl}/suggestions/${id}/analyser`, {}
    );
  }

  // ── Sponsors ────────────────────────────────────────
  getTousSponsors(): Observable<Sponsor[]> {
    return this.http.get<Sponsor[]>(`${this.apiUrl}/sponsors`);
  }

  getSponsors(evenementId: number): Observable<Sponsor[]> {
    return this.http.get<Sponsor[]>(`${this.apiUrl}/evenements/${evenementId}/sponsors`);
  }

  creerSponsor(sponsor: any): Observable<Sponsor> {
    return this.http.post<Sponsor>(`${this.apiUrl}/sponsors`, sponsor);
  }

  modifierSponsor(id: number, sponsor: any): Observable<Sponsor> {
    return this.http.put<Sponsor>(`${this.apiUrl}/sponsors/${id}`, sponsor);
  }

  supprimerSponsor(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sponsors/${id}`);
  }

  associerSponsor(sponsorId: number, evenementId: number, niveau: string, montant: number): Observable<Sponsor> {
    return this.http.post<Sponsor>(
      `${this.apiUrl}/sponsors/${sponsorId}/evenements/${evenementId}?niveau=${niveau}&montant=${montant}`, {}
    );
  }

  dissocierSponsor(sponsorId: number, evenementId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/sponsors/${sponsorId}/evenements/${evenementId}`
    );
  }
  // ── Paiement ────────────────────────────────────────
    creerSessionPaiement(evenementId: number, req: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/payment/create-session?evenementId=${evenementId}`,
        req);
    }

    confirmerPaiement(participantId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/payment/confirm/${participantId}`, {});
    }

    reserverEspeces(participantId: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/payment/especes/${participantId}`, {});
    }
    // ── Intérêts & Recommandations ──────────────────────
    toggleInteret(citoyenId: string, evenementId: number): Observable<{ interesse: boolean }> {
      return this.http.post<{ interesse: boolean }>(
        `${this.apiUrl}/interets/${citoyenId}/${evenementId}`, {}
      );
    }

    getInterets(citoyenId: string): Observable<number[]> {
      return this.http.get<number[]>(
        `${this.apiUrl}/interets/${citoyenId}`
      );
    }

    getRecommandations(citoyenId: string): Observable<Evenement[]> {
      return this.http.get<Evenement[]>(
        `${this.apiUrl}/interets/${citoyenId}/recommandations`
      );
    }
    traduire(texte: string, langue: string): Observable<any> {
      return this.http.post(
        `${this.apiUrl}/traduction`,
        { texte, langue }
      );
    }
    predictSponsor(payload: any): Observable<any> {
      return this.http.post(`${this.apiUrl}/sponsors/predict`, payload);
    }
    predictBudget(payload: any): Observable<any> {
      return this.http.post(`${this.apiUrl}/budget/predict`, payload);
    }
    getStats(): Observable<any> {
      return this.http.get(`${this.apiUrl}/evenements/stats`);
    }
    getPostSocial(id: number, plateforme = 'facebook'): Observable<any> {
      return this.http.get(
        `${this.apiUrl}/resume/${id}/social?plateforme=${plateforme}`
      );
    }
    genererJustification(id: number, statut: string): Observable<any> {
      return this.http.get(
        `${this.apiUrl}/suggestions/${id}/justification?statut=${statut}`
      );
    }
}