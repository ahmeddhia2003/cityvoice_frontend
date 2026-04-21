import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type AutoLang = 'fr' | 'en';

interface TranslateResponse {
  translations: string[];
  source:       string;
  target:       string;
  elapsed_ms:   number;
}

/**
 * AutoTranslateService — traduit AUTOMATIQUEMENT toute page Angular
 * FR ↔ EN en scannant le DOM, sans que l'on doive écrire manuellement
 * les chaînes dans chaque template.
 *
 * Approche :
 *   1. Parcourt tous les nœuds texte + quelques attributs (placeholder,
 *      title, alt, aria-label) sous <body>.
 *   2. Mémorise le texte FR original sur chaque nœud (data attr / Map).
 *   3. Envoie un batch de textes uniques au backend `/api/v1/translate`.
 *   4. Remplace les nœuds par leur traduction.
 *   5. Observe les mutations du DOM (navigation, composants qui arrivent
 *      après coup) pour traduire les nouveaux nœuds.
 *   6. Revenir en FR = restaurer les originaux depuis la cache.
 */
@Injectable({ providedIn: 'root' })
export class AutoTranslateService {

  /* ── État ──────────────────────────────────────────────── */
  private _current$ = new BehaviorSubject<AutoLang>('fr');
  readonly current$ = this._current$.asObservable();
  get current(): AutoLang { return this._current$.value; }

  private _busy$ = new BehaviorSubject<boolean>(false);
  readonly busy$ = this._busy$.asObservable();

  /** Cache local de traductions : key = texte FR source, value = texte EN cible */
  private translationCache = new Map<string, string>();

  /** Nœuds texte déjà "adoptés" (ont un originalFR). Détecté via WeakMap. */
  private originalText = new WeakMap<Node, string>();

  /** Attributs déjà adoptés, key = Element, value = { attr -> originalFR }. */
  private originalAttrs = new WeakMap<Element, Record<string, string>>();

  /** Observer des mutations pour attraper les nouveaux nœuds. */
  private observer: MutationObserver | null = null;

  /** Batch pending pour les nouveaux nœuds ajoutés dynamiquement. */
  private pendingDynamicFlush: any = null;

  /* ── Config ───────────────────────────────────────────── */
  private readonly API = `${environment.aiUrl}/api/v1/translate`;
  /** Taille max d'un batch — backend parallélise en interne (16 workers). */
  private readonly BATCH_SIZE = 60;
  /** Batches envoyés en parallèle depuis le navigateur (limite pragmatique). */
  private readonly PARALLEL_BATCHES = 4;
  /** Timeout dur côté client — au-delà, on abandonne le batch. */
  private readonly REQUEST_TIMEOUT_MS = 12_000;
  /** Jeton incrémenté à chaque switch(); permet d'abandonner les traductions d'un ancien toggle. */
  private runToken = 0;
  /** Attributs traduits en plus du textContent. */
  private readonly TRANSLATABLE_ATTRS = [
    'placeholder', 'title', 'alt',
    'aria-label', 'aria-placeholder',
  ];
  /** Balises à ignorer complètement. */
  private readonly SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA',
    'INPUT', 'KBD', 'SAMP', 'VAR', 'TIME',
  ]);

  constructor(private http: HttpClient, private zone: NgZone) {
    // Restaurer la langue persistée au démarrage.
    const saved = localStorage.getItem('madina_auto_lang') as AutoLang | null;
    if (saved === 'en') {
      // On applique après un petit délai pour laisser l'app boot.
      setTimeout(() => this.switch('en'), 600);
    }
  }

  /* ══════════════════════════════════════════════════════════
     API publique
     ══════════════════════════════════════════════════════════ */

  /** Bascule toute la page vers la langue demandée. */
  switch(lang: AutoLang): Promise<void> {
    if (lang === this.current) return Promise.resolve();

    // Nouveau cycle : invalide toutes les requêtes en vol du cycle précédent.
    this.runToken++;

    localStorage.setItem('madina_auto_lang', lang);
    this._current$.next(lang);
    document.documentElement.lang = lang;

    if (lang === 'fr') {
      // Revenir au FR = restaurer les originaux
      this.restoreOriginals();
      this.stopObserver();
      this._busy$.next(false);
      return Promise.resolve();
    }

    // Aller en EN = scanner + traduire
    this._busy$.next(true);
    return this.translateAll('fr', 'en')
      .finally(() => {
        this._busy$.next(false);
        this.startObserver();
      });
  }

  /* ══════════════════════════════════════════════════════════
     Scan + traduction complète
     ══════════════════════════════════════════════════════════ */

  private async translateAll(source: AutoLang, target: AutoLang): Promise<void> {
    const { texts, textNodes, attrSlots } = this.collectTranslatable(document.body);
    if (texts.length === 0) return;

    // Déduplication : regrouper par chaîne unique
    const uniqueTexts = Array.from(new Set(texts));
    // Ne retraduire que ce qui n'est pas déjà en cache
    const toTranslate = uniqueTexts.filter(t => !this.translationCache.has(t));

    if (toTranslate.length > 0) {
      await this.fetchTranslations(toTranslate, source, target);
    }

    // Appliquer sur les nœuds texte
    for (const node of textNodes) {
      const original = this.originalText.get(node);
      if (!original) continue;
      const tr = this.translationCache.get(original);
      if (tr && tr !== node.nodeValue) {
        node.nodeValue = this.preserveWhitespace(original, tr);
      }
    }

    // Appliquer sur les attributs
    for (const slot of attrSlots) {
      const tr = this.translationCache.get(slot.originalValue);
      if (tr) slot.el.setAttribute(slot.attr, tr);
    }
  }

  /** Envoie des batches au backend en PARALLÈLE (vague par vague). */
  private async fetchTranslations(
    texts: string[], source: AutoLang, target: AutoLang,
  ): Promise<void> {
    const myToken = this.runToken;

    // Découper en chunks
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
      chunks.push(texts.slice(i, i + this.BATCH_SIZE));
    }

    // Envoyer par vagues de PARALLEL_BATCHES
    for (let i = 0; i < chunks.length; i += this.PARALLEL_BATCHES) {
      if (myToken !== this.runToken) return; // toggle annulé par l'utilisateur
      const wave = chunks.slice(i, i + this.PARALLEL_BATCHES);
      await Promise.all(wave.map(chunk => this.fetchOneChunk(chunk, source, target, myToken)));
    }
  }

  /** Envoie UN batch au backend avec timeout + abort propre. */
  private async fetchOneChunk(
    chunk: string[], source: AutoLang, target: AutoLang, myToken: number,
  ): Promise<void> {
    // Si un autre switch() a été lancé entre-temps, on renonce immédiatement.
    if (myToken !== this.runToken) return;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.REQUEST_TIMEOUT_MS);

    try {
      // fetch() natif — supporte AbortController (HttpClient n'expose pas nativement abort)
      const resp = await fetch(this.API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ texts: chunk, source, target }),
        signal:  ctrl.signal,
      });

      if (myToken !== this.runToken) return; // switch annulé pendant le vol
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json() as TranslateResponse;
      const arr  = data?.translations || [];
      chunk.forEach((src, idx) => {
        const tr = arr[idx];
        if (tr && tr.trim()) {
          this.translationCache.set(src, tr);
        } else {
          this.translationCache.set(src, src); // fallback identité
        }
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn('[auto-translate] batch annulé (timeout ou switch)');
      } else {
        console.warn('[auto-translate] batch échoué', err);
      }
      // Cache identité pour éviter la boucle.
      chunk.forEach(src => this.translationCache.set(src, src));
    } finally {
      clearTimeout(timer);
    }
  }

  /* ══════════════════════════════════════════════════════════
     Collecte des textes traduisibles
     ══════════════════════════════════════════════════════════ */

  private collectTranslatable(root: Node): {
    texts:     string[];
    textNodes: Text[];
    attrSlots: Array<{ el: Element; attr: string; originalValue: string }>;
  } {
    const texts: string[] = [];
    const textNodes: Text[] = [];
    const attrSlots: Array<{ el: Element; attr: string; originalValue: string }> = [];

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Node) => {
          // Element : filtrer les balises interdites et le flag no-translate
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (this.SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
            if (el.hasAttribute('data-no-translate')) return NodeFilter.FILTER_REJECT;
            if (el.classList?.contains('no-translate'))  return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
          // Text : filtrer les textes sans substance
          if (node.nodeType === Node.TEXT_NODE) {
            const t = (node.nodeValue || '').trim();
            if (!t) return NodeFilter.FILTER_REJECT;
            if (!this.shouldTranslate(t)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      },
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const tn = node as Text;
        const raw = (tn.nodeValue || '').trim();
        if (!raw) continue;

        // Mémoriser l'original (première fois seulement)
        if (!this.originalText.has(tn)) {
          this.originalText.set(tn, raw);
        }
        const original = this.originalText.get(tn)!;
        textNodes.push(tn);
        texts.push(original);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        let map = this.originalAttrs.get(el);
        for (const attr of this.TRANSLATABLE_ATTRS) {
          const val = el.getAttribute(attr);
          if (!val || !this.shouldTranslate(val)) continue;

          if (!map) { map = {}; this.originalAttrs.set(el, map); }
          if (map[attr] == null) map[attr] = val;

          const originalValue = map[attr];
          attrSlots.push({ el, attr, originalValue });
          texts.push(originalValue);
        }
      }
    }

    return { texts, textNodes, attrSlots };
  }

  /** Renvoie true si le texte mérite une traduction (≥2 lettres, pas que du bruit). */
  private shouldTranslate(text: string): boolean {
    const t = text.trim();
    if (t.length < 2) return false;
    // Pas de lettre alphabétique → ignorer (nombres, symboles, …)
    if (!/\p{L}/u.test(t)) return false;
    // URLs / e-mails / identifiants techniques
    if (/^https?:\/\//i.test(t)) return false;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(t)) return false;
    // Déjà anglais pur (heuristique très basique) : liste courte de mots purement techniques
    // On laisse passer quand même, le backend ne "casse" pas un texte EN.
    return true;
  }

  /** Conserve les espaces de bord du texte original (important pour le layout). */
  private preserveWhitespace(original: string, translated: string): string {
    const m = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m) return translated;
    const leading = m[1] ?? '';
    const trailing = m[3] ?? '';
    return `${leading}${translated.trim()}${trailing}`;
  }

  /* ══════════════════════════════════════════════════════════
     Restaurer le FR original
     ══════════════════════════════════════════════════════════ */

  private restoreOriginals(): void {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null,
    );
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        const original = this.originalText.get(node);
        if (original != null && node.nodeValue !== original) {
          node.nodeValue = original;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const map = this.originalAttrs.get(el);
        if (!map) continue;
        for (const attr of Object.keys(map)) {
          if (el.getAttribute(attr) !== map[attr]) {
            el.setAttribute(attr, map[attr]);
          }
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     MutationObserver — traduit les nouveaux nœuds
     ══════════════════════════════════════════════════════════ */

  private startObserver(): void {
    if (this.observer) return;
    // Hors zone Angular pour éviter de re-déclencher la change-detection.
    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(muts => {
        let hasNew = false;
        for (const m of muts) {
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            for (const added of Array.from(m.addedNodes)) {
              if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
                hasNew = true;
                break;
              }
            }
          }
          if (m.type === 'characterData') hasNew = true;
          if (hasNew) break;
        }
        if (!hasNew) return;
        // Debounce les flushs
        if (this.pendingDynamicFlush) clearTimeout(this.pendingDynamicFlush);
        this.pendingDynamicFlush = setTimeout(() => {
          this.pendingDynamicFlush = null;
          if (this.current !== 'en') return;
          this.translateAll('fr', 'en').catch(err =>
            console.warn('[auto-translate] flush dynamique échoué', err),
          );
        }, 250);
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    });
  }

  private stopObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pendingDynamicFlush) {
      clearTimeout(this.pendingDynamicFlush);
      this.pendingDynamicFlush = null;
    }
  }
}
