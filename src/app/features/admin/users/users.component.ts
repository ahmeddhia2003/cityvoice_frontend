import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UserService, UserDto } from '../../../core/services/user.service';
import { SoundService } from '../../../core/services/sound.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit {

  users:        UserDto[] = [];
  filtered:     UserDto[] = [];
  loading       = true;
  search        = '';
  selectedRole  = 'ALL';
  sortField     = 'nom';
  sortDir: 'asc' | 'desc' = 'asc';

  // Suppression
  deleteConfirm: string | null = null;
  deleteLoading = false;

  // Vue détail
  selectedUser: UserDto | null = null;
  showDetail    = false;

  readonly roles = ['ALL', 'CITOYEN', 'CHEF_EQUIPE', 'MEMBRE_EQUIPE', 'MODERATEUR', 'ADMIN_VILLE'];

  constructor(
    private userService: UserService,
    private router: Router,
    public sound: SoundService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.userService.getAll().subscribe({
      next: (users) => {
        this.users   = users;
        this.loading = false;
        this.applyFilters();
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters(): void {
    let res = [...this.users];

    if (this.selectedRole !== 'ALL') {
      res = res.filter(u => u.role === this.selectedRole);
    }

    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      res = res.filter(u =>
        u.nom?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.ville?.toLowerCase().includes(q)
      );
    }

    res.sort((a, b) => {
      const va = (a as any)[this.sortField] ?? '';
      const vb = (b as any)[this.sortField] ?? '';
      return this.sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

    this.filtered = res;
  }

  sort(field: string): void {
    this.sortDir = this.sortField === field
      ? (this.sortDir === 'asc' ? 'desc' : 'asc')
      : 'asc';
    this.sortField = field;
    this.applyFilters();
  }

  setRole(role: string): void {
    this.sound.nav();
    this.selectedRole = role;
    this.applyFilters();
  }

  onSearch(): void { this.applyFilters(); }

  // ── Voir détail ──────────────────────────────────────────
  viewUser(user: UserDto): void {
    this.sound.nav();
    this.selectedUser = user;
    this.showDetail   = true;
  }

  closeDetail(): void {
    this.showDetail   = false;
    this.selectedUser = null;
  }

  // ── Suppression ──────────────────────────────────────────
  confirmDelete(id: string): void {
    this.sound.nav();
    this.deleteConfirm = id;
  }

  cancelDelete(): void {
    this.deleteConfirm = null;
  }

  doDelete(): void {
    if (!this.deleteConfirm) return;
    this.deleteLoading = true;
    const idToDelete   = this.deleteConfirm;

    this.userService.delete(idToDelete).subscribe({
      next: () => {
        this.users         = this.users.filter(u => u.id !== idToDelete);
        this.deleteConfirm = null;
        this.deleteLoading = false;
        this.applyFilters();
        // Fermer le détail si l'utilisateur supprimé était affiché
        if (this.selectedUser?.id === idToDelete) {
          this.closeDetail();
        }
      },
      error: () => {
        this.deleteLoading = false;
      }
    });
  }

  // ── Changer rôle ─────────────────────────────────────────
  changeRole(user: UserDto, role: string): void {
    this.userService.updateRole(user.id, role).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === user.id);
        if (idx !== -1) this.users[idx] = updated;
        if (this.selectedUser?.id === user.id) {
          this.selectedUser = updated;
        }
        this.applyFilters();
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  roleColor(role: string): string {
    const map: Record<string, string> = {
      CITOYEN:       '#0D9B76',
      CHEF_EQUIPE:   '#3B82F6',
      MEMBRE_EQUIPE: '#C9973E',
      MODERATEUR:    '#E8532A',
      ADMIN_VILLE:   '#7C3AED',
    };
    return map[role] ?? '#8888A8';
  }

  roleBg(role: string): string {
    const map: Record<string, string> = {
      CITOYEN:       'rgba(13,155,118,.1)',
      CHEF_EQUIPE:   'rgba(59,130,246,.1)',
      MEMBRE_EQUIPE: 'rgba(201,151,62,.1)',
      MODERATEUR:    'rgba(232,83,42,.1)',
      ADMIN_VILLE:   'rgba(124,58,237,.1)',
    };
    return map[role] ?? 'rgba(136,136,168,.1)';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      CITOYEN:       'Citoyen',
      CHEF_EQUIPE:   'Chef d\'équipe',
      MEMBRE_EQUIPE: 'Agent terrain',
      MODERATEUR:    'Modérateur',
      ADMIN_VILLE:   'Admin',
    };
    return map[role] ?? role;
  }

  initials(nom: string): string {
    if (!nom) return '?';
    return nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  countByRole(role: string): number {
    return this.users.filter(u => u.role === role).length;
  }

  trackById(_: number, u: UserDto): string { return u.id; }
}
