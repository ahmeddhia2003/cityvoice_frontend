import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Evenement, InscriptionRequest } from '../models/evenement.model';
import { Suggestion } from '../models/suggestion.model';
import { Sponsor } from '../models/sponsor.model';

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

  publierEvenement(id: number): Observable<Evenement> {
    return this.http.put<Evenement>(`${this.apiUrl}/evenements/${id}/publier`, {});
  }

  annulerEvenement(id: number): Observable<Evenement> {
    return this.http.put<Evenement>(`${this.apiUrl}/evenements/${id}/annuler`, {});
  }

  inscrireParticipant(id: number, req: InscriptionRequest): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/evenements/${id}/inscrire`,
      req,
      { responseType: 'text' } 
    );
  }

  supprimerEvenement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/evenements/${id}`);
  }

  // ── Suggestions ─────────────────────────────────────
  getSuggestions(): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(`${this.apiUrl}/suggestions`);
  }

  soumettreSuggestion(suggestion: Suggestion): Observable<Suggestion> {
    return this.http.post<Suggestion>(`${this.apiUrl}/suggestions`, suggestion);
  }

  traiterSuggestion(id: number, statut: string, commentaire?: string): Observable<Suggestion> {
    return this.http.put<Suggestion>(
      `${this.apiUrl}/suggestions/${id}/traiter?statut=${statut}&commentaire=${commentaire || ''}`, {}
    );
  }

  // ── Sponsors ────────────────────────────────────────
  getSponsors(evenementId: number): Observable<Sponsor[]> {
    return this.http.get<Sponsor[]>(`${this.apiUrl}/evenements/${evenementId}/sponsors`);
  }

  ajouterSponsor(evenementId: number, sponsor: Sponsor): Observable<Sponsor> {
    return this.http.post<Sponsor>(`${this.apiUrl}/evenements/${evenementId}/sponsors`, sponsor);
  }

  supprimerSponsor(evenementId: number, sponsorId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/evenements/${evenementId}/sponsors/${sponsorId}`);
  }
}