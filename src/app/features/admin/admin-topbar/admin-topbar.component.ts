import { Component, OnInit } from '@angular/core';
import {SoundService} from '../../../core/services/sound.service';
import {LangService,Lang } from '../../../core/services/lang.service';
@Component({
  selector: 'app-admin-topbar',
  templateUrl: './admin-topbar.component.html',
  styleUrls: ['./admin-topbar.component.css'],
})
export class AdminTopbarComponent implements OnInit {

  today   = '';
  search  = '';

  constructor(
    public sound: SoundService,
    public lang: LangService,
  ) {}

  ngOnInit(): void {
    this.today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }
  setLang(l: Lang): void { this.sound.nav(); this.lang.switch(l); }
}
