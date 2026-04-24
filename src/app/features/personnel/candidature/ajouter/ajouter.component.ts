import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../../../environments/environment';
import { UserService } from '../../../../core/services/user.service';
import { Equipe, EquipeService, Etat } from '../../../../core/services/equipe.service';

declare const gsap: any;

// ── VALIDATION PASSWORD ─────────────────────
function passwordMatchValidator(g: AbstractControl): ValidationErrors | null {
  const p = g.get('newPassword')?.value;
  const c = g.get('confirmPassword')?.value;
  return p && c && p !== c ? { mismatch: true } : null;
}

@Component({
  selector: 'app-ajouter',
  templateUrl: './ajouter.component.html',
  styleUrls: ['./ajouter.component.css']
})
export class AjouterComponent implements OnInit {

  // ───────────── FORM ─────────────
  infoForm!: FormGroup;
  pwdForm!: FormGroup;
  saving = false;

  // ───────────── PHOTO ────────────
  photoPreview: string | null = null;

  // ───────────── TOAST ────────────
  toast = false;
  toastMsg = '';
  toastType: 'success' | 'error' = 'success';

  // ───────────── EQUIPES (TON CODE) ─────────────
  equipes:  Equipe[] = [];
  filtered: Equipe[] = [];
  loading   = true;

  searchTerm  = '';
  filterEtat  = '';

  selectedId?: string;
  selectedEquipe?: Equipe;

  private readonly MAX_MEMBRES = 10;

  // ───────────── DATA ─────────────
  readonly gouvernorats = [
    'Ariana','Béja','Ben Arous','Bizerte','Gabès','Gafsa','Jendouba',
    'Kairouan','Kasserine','Kébili','Le Kef','Mahdia','La Manouba',
    'Médenine','Monastir','Nabeul','Sfax','Sidi Bouzid','Siliana',
    'Sousse','Tataouine','Tozeur','Tunis','Zaghouan',
  ];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private userService: UserService,
    private equipeService: EquipeService,
    private router: Router
  ) {}

  // ───────────── INIT ─────────────
  ngOnInit(): void {

    // FORM INFO
    this.infoForm = this.fb.group({
      nom: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', [Validators.pattern(/^[0-9+\s]{8,15}$/)]],
      gouvernorat: [''],
      ville: [''],
      codePostal: ['', Validators.pattern(/^[0-9]{4}$/)],
    });

    // FORM PASSWORD
    this.pwdForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    }, { validators: passwordMatchValidator });

    // LOAD EQUIPES
    this.equipeService.getAll().subscribe({
      next: (data) => {
        this.equipes  = data;
        this.filtered = data;
        this.loading  = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ───────────── FILTERS ─────────────
  setFilter(etat: string): void {
    this.filterEtat = etat;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filtered = this.equipes.filter(e => {
      const matchSearch =
        !this.searchTerm ||
        e.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        e.specialite.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchEtat =
        !this.filterEtat || e.etat === this.filterEtat;

      return matchSearch && matchEtat;
    });
  }

  // ───────────── STATS ─────────────
  get totalMembres(): number {
    return this.equipes.reduce(
      (acc, e) => acc + (e.membresEquipe?.length ?? 0), 0
    );
  }

  countByEtat(etat: Etat): number {
    return this.equipes.filter(e => e.etat === etat).length;
  }

  // ───────────── CLICK EQUIPE ─────────────
  selectEquipe(e: Equipe): void {
    if (this.selectedId === e.id) {
      this.closeDetail();
      return;
    }
    this.selectedId = e.id;
    this.selectedEquipe = e;
  }

  closeDetail(): void {
    this.selectedId = undefined;
    this.selectedEquipe = undefined;
  }

  // ───────────── NAVIGATION ─────────────
  voirDetail(e: Equipe): void {
    if (!e.id) return;
    this.router.navigate(['/equipes', e.id]);
  }

  // ───────────── DELETE ─────────────
  supprimer(e: Equipe): void {
    if (!e.id) return;
    if (!confirm(`Supprimer "${e.name}" ?`)) return;

    this.equipeService.delete(e.id).subscribe(() => {
      this.equipes  = this.equipes.filter(x => x.id !== e.id);
      this.filtered = this.filtered.filter(x => x.id !== e.id);
      if (this.selectedId === e.id) this.closeDetail();
    });
  }

  // ───────────── CREATE USER ─────────────
  createUser(): void {
    this.infoForm.markAllAsTouched();
    if (this.infoForm.invalid) return;

    this.saving = true;

    const payload = {
      ...this.infoForm.value,
      photo: this.photoPreview || null,
      password: this.pwdForm.value.newPassword
    };

    this.http.post(`${environment.apiUrl}/api/users`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.showToast('Utilisateur créé ✓', 'success');
        this.resetForms();
      },
      error: () => {
        this.saving = false;
        this.showToast('Erreur création', 'error');
      }
    });
  }

  // ───────────── HELPERS ─────────────
  etatLabel(etat?: Etat): string {
    const map: Record<Etat, string> = {
      LIBRE: 'Libre',
      EN_EXECUTION: 'En mission',
      EN_ATTENTE: 'En attente',
    };
    return etat ? map[etat] : 'Inconnu';
  }

  membresPercent(e: Equipe): number {
    return Math.min(((e.membresEquipe?.length ?? 0) / this.MAX_MEMBRES) * 100, 100);
  }

  // ───────────── TOAST ─────────────
  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg = msg;
    this.toastType = type;
    this.toast = true;

    setTimeout(() => this.toast = false, 3000);
  }

  // ───────────── RESET ─────────────
  resetForms(): void {
    this.infoForm.reset();
    this.pwdForm.reset();
    this.photoPreview = null;
  }
  trackById(index: number, e: Equipe): string {
  return e.id ?? index.toString();
}
etatGradient(etat?: Etat): string {
  const map: Record<Etat, string> = {
    LIBRE:        'linear-gradient(135deg, #059669, #10b981)',
    EN_EXECUTION: 'linear-gradient(135deg, #EA580C, #FB923C)',
    EN_ATTENTE:    'linear-gradient(135deg, #475569, #94A3B8)',
  };

  return etat ? (map[etat] ?? 'linear-gradient(135deg, #0d1b2a, #1e3a52)')
              : 'linear-gradient(135deg, #0d1b2a, #1e3a52)';
}
avatarBg(name: string): string {
  const palettes = [
    '#0d1b2a', '#00b4a6', '#E8532A', '#8B5CF6',
    '#0D9B76', '#C9973E', '#3B82F6', '#EC4899',
  ];

  let hash = 0;
  for (const c of name) {
    hash = (hash * 31 + c.charCodeAt(0)) % palettes.length;
  }

  return palettes[Math.abs(hash)];
}
initiales(name: string): string {
  if (!name) return '';

  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}
etatClass(etat?: Etat): string {
  const map: Record<Etat, string> = {
    LIBRE: 'etat-libre',
    EN_EXECUTION: 'etat-exec',
    EN_ATTENTE: 'etat-wait',
  };

  return etat ? (map[etat] ?? '') : '';
}

}
