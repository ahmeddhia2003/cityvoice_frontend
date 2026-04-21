// src/app/core/services/candidature-equipe.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Equipe } from './equipe.service';
import { CvUser } from './cvUser.service';

export interface CandidatureEquipe {
  id?: string;
  dateInscription?: string;    // LocalDateTime → string ISO
  nbcandidatsA: number;
  dateExpiration: string;      // LocalDateTime → string ISO
  statut: string;
  gouvernorat: string;         // attention : "Gouvernorat" en Java (majuscule)
  equipe?: Equipe;
  description?: string;
  fonction?: string;
  cvs?: CvUser[];
  nbCv?: number;
  
             // @ManyToOne
}

@Injectable({ providedIn: 'root' })
export class CandidatureEquipeService {

  private base = `${environment.apiUrl}/personnel/candidature`;

  constructor(private http: HttpClient) {}

  // GET /personnel/candidature/get
  getAll(): Observable<CandidatureEquipe[]> {
    return this.http.get<CandidatureEquipe[]>(`${this.base}/get`);
  }

  // GET /personnel/candidature/{id}
  getById(id: string): Observable<CandidatureEquipe> {
    return this.http.get<CandidatureEquipe>(`${this.base}/${id}`);
  }

  // GET /personnel/candidature/statut/{statut}
  getByStatut(statut: string): Observable<CandidatureEquipe> {
    return this.http.get<CandidatureEquipe>(`${this.base}/statut/${statut}`);
  }

  // GET /personnel/candidature/{id}/specialite
  getNomEquipe(id: string): Observable<string> {
    return this.http.get(`${this.base}/${id}/specialite`, { responseType: 'text' });
  }

  // POST /personnel/candidature/add
  add(candidature: CandidatureEquipe): Observable<CandidatureEquipe> {
    return this.http.post<CandidatureEquipe>(`${this.base}/add`, candidature);
  }

  // PUT /personnel/candidature/{id}
  update(id: string, candidature: CandidatureEquipe): Observable<CandidatureEquipe> {
    return this.http.put<CandidatureEquipe>(`${this.base}/${id}`, candidature);
  }

  // DELETE /personnel/candidature/{id}
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
  getCvsByCandidature(id: string): Observable<CvUser[]> {
  return this.http.get<CvUser[]>(
    `${this.base}/${id}/cvs`
  );
}

}