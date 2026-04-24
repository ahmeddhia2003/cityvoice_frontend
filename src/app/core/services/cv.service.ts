import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CV {
  id?: string;
  competences?: string;
  diplome?: string;      // "Diplome" en Java (majuscule)
  experience?: string;   // "Experience" en Java (majuscule)
}

@Injectable({ providedIn: 'root' })
export class CvService {

  private base = `${environment.apiUrl}/personnel/cv`;

  constructor(private http: HttpClient) {}

  // GET /personnel/cv/get
  getAll(): Observable<CV[]> {
    return this.http.get<CV[]>(`${this.base}/get`);
  }

  // POST /personnel/cv
  add(cv: CV): Observable<CV> {
    return this.http.post<CV>(this.base, cv);
  }

  // PUT /personnel/cv/{id}
  update(id: string, cv: CV): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, cv);
  }

  // DELETE /personnel/cv/{id}
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}