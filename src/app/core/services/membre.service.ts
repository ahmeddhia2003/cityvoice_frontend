import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CV } from './cv.service';

/** Valeurs exactes de l'enum Fonction.java côté backend */
export type Fonction =
  | 'CHEF_EQUIPE'
  | 'OUVRIER_SPECIALISTE'
  | 'OUVRIER_GENERALISTE'
  | 'TECHNICIEN'
  | 'RESPONSABLE_SECURITE';

export interface MembreEquipe {
  id?: string;
  nom: string;
  prenom: string;
  fonction: Fonction;
  dateAdhesion?: string;   // LocalDateTime → string ISO (auto via @PrePersist)
  cv?: CV;
  mail?: string;
  /** UUID du compte utilisateur associé (rôle CHEF_EQUIPE dans user-service) */
  userId?: string;
}

@Injectable({ providedIn: 'root' })
export class MembreEquipeService {

  private base = `${environment.apiUrl}/personnel/membres`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<MembreEquipe[]> {
    return this.http.get<MembreEquipe[]>(`${this.base}/get`);
  }

  getById(id: string): Observable<MembreEquipe> {
    return this.http.get<MembreEquipe>(`${this.base}/${id}`);
  }

  getByNom(nom: string): Observable<MembreEquipe[]> {
    return this.http.get<MembreEquipe[]>(`${this.base}/nom/${nom}`);
  }

  getByFonction(fonction: Fonction): Observable<MembreEquipe[]> {
    return this.http.get<MembreEquipe[]>(`${this.base}/fonction/${fonction}`);
  }

  add(membre: MembreEquipe): Observable<MembreEquipe> {
    return this.http.post<MembreEquipe>(`${this.base}/add`, membre);
  }

  update(id: string, membre: MembreEquipe): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, membre);
  }

  updateFonction(id: string, fonction: Fonction): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/${fonction}`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /** Lie un compte utilisateur (userId) à un membre d'équipe existant */
  linkUser(membreId: string, userId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${membreId}/link-user/${userId}`, {});
  }
}