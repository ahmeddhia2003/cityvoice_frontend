import { Injectable } from '@angular/core';

/**
 * VoteStorageService
 * Persiste localement les IDs des signalements votés via localStorage.
 * Empêche le re-vote après refresh de page.
 */
@Injectable({ providedIn: 'root' })
export class VoteStorageService {

  private readonly KEY = 'cv_voted_ids';

  /** Charge les IDs votés depuis localStorage */
  load(): Set<number> {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return new Set();
      const arr: number[] = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  /** Ajoute un ID et sauvegarde */
  add(id: number): void {
    const ids = this.load();
    ids.add(id);
    this.save(ids);
  }

  /** Retire un ID (rollback) et sauvegarde */
  remove(id: number): void {
    const ids = this.load();
    ids.delete(id);
    this.save(ids);
  }

  /** Vérifie si un ID a déjà été voté */
  has(id: number): boolean {
    return this.load().has(id);
  }

  private save(ids: Set<number>): void {
    try {
      localStorage.setItem(this.KEY, JSON.stringify([...ids]));
    } catch { /* quota exceeded – on ignore */ }
  }
}
