import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent implements OnInit {
title = 'Madina';
  showLoader   = true;
  isAdminRoute = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (sessionStorage.getItem('madina_loaded')) {
      this.showLoader = false;
    }

    /* Écouter les changements de route pour masquer navbar/footer sur /admin */
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      this.isAdminRoute = (e.urlAfterRedirects as string).startsWith('/admin');
    });

    /* Vérifier la route initiale */
    this.isAdminRoute = this.router.url.startsWith('/admin');
  }

  onLoadingComplete(): void {
    this.showLoader = false;
    sessionStorage.setItem('madina_loaded', '1');
  }
}

