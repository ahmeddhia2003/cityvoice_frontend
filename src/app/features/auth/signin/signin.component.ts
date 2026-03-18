import { Component, OnInit, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {SoundService} from '../../../core/services/sound.service';
import {AuthService} from '../../../core/services/auth.service';
declare const gsap: any;

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['../auth.shared.css'],
})
export class SigninComponent implements OnInit, AfterViewInit {

  form!: FormGroup;
  showPwd   = false;
  loading   = false;
  success   = false;
  toast     = false;
  toastMsg  = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    public sound: SoundService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  ngAfterViewInit(): void {
    if (typeof gsap === 'undefined') return;
    this.runEntrance();
  }

  private runEntrance(): void {
    const tl = gsap.timeline();
    tl
      .fromTo('.auth-left',  { x:-80,opacity:0 }, { x:0,opacity:1,duration:.8,ease:'power3.out' }, .1)
      .fromTo('.auth-logo',  { opacity:0,y:-16 },  { opacity:1,y:0,duration:.5 }, .3)
      .fromTo('.lt-word',    { y:'100%' },          { y:'0%',duration:.7,stagger:.08,ease:'power4.out' }, .4)
      .fromTo('.auth-desc',  { opacity:0,y:20 },    { opacity:1,y:0,duration:.5 }, .8)
      .fromTo('.stat-chip',  { opacity:0,scale:.85 },{ opacity:1,scale:1,duration:.4,stagger:.08,ease:'back.out(1.5)' }, 1.0)
      .fromTo('.auth-proof', { opacity:0 },          { opacity:1,duration:.4 }, 1.2)
      .fromTo('.auth-card',  { opacity:0,y:30 },     { opacity:1,y:0,duration:.7,ease:'power3.out' }, .5)
      .fromTo('.auth-pin-1', { opacity:0,x:20 },     { opacity:1,x:0,duration:.5,ease:'back.out(2)' }, 1.1)
      .fromTo('.auth-pin-2', { opacity:0,x:20 },     { opacity:1,x:0,duration:.5,ease:'back.out(2)' }, 1.3);

    gsap.to('.auth-pin-1', { y:-8, duration:3,   yoyo:true, repeat:-1, ease:'sine.inOut', delay:1.2 });
    gsap.to('.auth-pin-2', { y:-6, duration:3.5, yoyo:true, repeat:-1, ease:'sine.inOut', delay:1.8 });
    gsap.to('.auth-orb-1', { x:20, y:-20, duration:5, yoyo:true, repeat:-1, ease:'sine.inOut' });
    gsap.to('.auth-orb-2', { x:-15,y:15,  duration:6, yoyo:true, repeat:-1, ease:'sine.inOut', delay:1 });
  }

  togglePwd(): void {
    this.sound.nav();
    this.showPwd = !this.showPwd;
  }

  onInput(): void { this.sound.nav(); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.sound.toggle2(false);
      gsap.to('.auth-submit', { x:[-6,6,-4,4,-2,2,0], duration:.4, ease:'none' });
      return;
    }
    this.sound.click();
    this.loading = true;

    // Simulate API call
    setTimeout(() => {
      this.loading = false;
      this.success = true;
      this.sound.success();
      this.showToast('Bienvenue sur Madina !');
      setTimeout(() => this.router.navigate(['/']), 1800);
    }, 1600);
  }

  goSignup(): void {
    this.sound.nav();
    this.router.navigate(['/auth/signup']);
  }

  forgotPwd(): void { this.sound.nav(); }

  showToast(msg: string): void {
    this.toastMsg = msg;
    this.toast = true;
    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.auth-toast',
        { opacity:0, y:30 },
        { opacity:1, y:0, duration:.4, ease:'back.out(1.6)' }
      );
      setTimeout(() => {
        gsap.to('.auth-toast', { opacity:0, y:30, duration:.35, ease:'power2.in',
          onComplete: () => { this.toast = false; }
        });
      }, 3000);
    }
  }
}
