import { Injectable } from '@angular/core';

/**
 * SoundService — sons UI smooth via Web Audio API
 * Aucun fichier audio externe requis.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private ctx: AudioContext | null = null;
  private _enabled = true;

  private get audioCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  get isEnabled(): boolean { return this._enabled; }
  toggle(): void { this._enabled = !this._enabled; }

  /** Boutons d'action principaux */
  click(): void {
    if (!this._enabled) return;
    try {
      const ctx = this.audioCtx, t = ctx.currentTime;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 2400;
      osc.connect(flt); flt.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(820, t + .04);
      osc.frequency.exponentialRampToValueAtTime(680, t + .12);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.07, t + .01);
      gain.gain.exponentialRampToValueAtTime(.001, t + .18);
      osc.start(t); osc.stop(t + .18);
    } catch {}
  }

  /** Navigation, onglets, steps */
  nav(): void {
    if (!this._enabled) return;
    try {
      const ctx = this.audioCtx, t = ctx.currentTime;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(640, t + .06);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.05, t + .008);
      gain.gain.exponentialRampToValueAtTime(.001, t + .12);
      osc.start(t); osc.stop(t + .12);
    } catch {}
  }

  /** Succès — accord do-mi-sol */
  success(): void {
    if (!this._enabled) return;
    try {
      const ctx = this.audioCtx;
      [523, 659, 784].forEach((freq, i) => {
        const t = ctx.currentTime + i * .1;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(.07, t + .01);
        gain.gain.exponentialRampToValueAtTime(.001, t + .24);
        osc.start(t); osc.stop(t + .24);
      });
    } catch {}
  }

  notification(): void {
    if (!this._enabled) return;
    try {
      const ctx = this.audioCtx;
      [880, 1174].forEach((freq, i) => {
        const t = ctx.currentTime + i * .08;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(2600, t);
        osc.connect(flt);
        flt.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * .96, t + .18);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(.06, t + .01);
        gain.gain.exponentialRampToValueAtTime(.001, t + .22);
        osc.start(t);
        osc.stop(t + .22);
      });
    } catch {}
  }

  /** Toggle switch on/off */
  toggle2(on: boolean): void {
    if (!this._enabled) return;
    try {
      const ctx = this.audioCtx, t = ctx.currentTime;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = on ? 740 : 480;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(.05, t + .008);
      gain.gain.exponentialRampToValueAtTime(.001, t + .09);
      osc.start(t); osc.stop(t + .09);
    } catch {}
  }
}
