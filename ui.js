import {CAMPAIGN_SECTORS} from './campaign.js';
import {weapons} from './engine.js';
const PREFS_KEY = 'dead-arrival-prefs-v1';

const DEFAULT_PREFS = Object.freeze({
  sensitivity: 1,
  volume: 0.5,
  reducedMotion: false,
  gore: true,
  autoRun: false,
});

const WEAPON_NAMES = ['OSSUARY', 'BREACH SHOTGUN', 'ARC LANCE', 'RELIQUARY'];
const WEAPON_HINTS = ['BONEFORGED // COIN RICOCHET', 'CLOSE RANGE // WIDE SPREAD', 'RAIL PUNCH // PIERCE', 'ROCKETS // FUSE CONTROL'];


const WEAPON_SIGILS = [
 'M9 24L18 14H44L50 19H83V29H49L43 35H31L24 48H14L19 31H9Z M29 17V31 M36 17V31 M44 20H78 M52 25H86',
 'M8 20H39L48 14H85V21H47V27H85V34H47L39 30H29L23 48H13L17 30H8Z M52 17H82 M52 30H82',
 'M8 22H27L35 14H55L65 22H88 M8 32H27L35 40H55L65 32H88 M21 22V33 M39 17V37 M49 17V37 M58 20L73 27L58 34 M30 34L24 48H14L18 32',
 'M6 20L18 12H38L46 17H78L89 10V42L78 35H46L38 40H18L6 32Z M21 16V36 M31 16V36 M49 20V32 M58 20V32 M68 20V32 M83 16V36'
];
const weaponSigil=(index)=>`<svg viewBox="0 0 96 56" aria-hidden="true"><path d="${WEAPON_SIGILS[index]}"/></svg>`;

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const fmt = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : (digits ? (0).toFixed(digits) : '0');
const pct = (value) => `${clamp(value, 0, 100).toFixed(0)}%`;

function loadPrefs() {
  const normalise = (saved) => {
    const merged = { ...DEFAULT_PREFS, ...(saved && typeof saved === 'object' ? saved : {}) };
    return {
      sensitivity: clamp(merged.sensitivity, 0.25, 2),
      volume: clamp(merged.volume, 0, 1),
      reducedMotion: merged.reducedMotion === true || merged.reducedMotion === 'true' || merged.reducedMotion === 1,
      gore: merged.gore !== false && merged.gore !== 'false' && merged.gore !== 0,
      autoRun: merged.autoRun === true || merged.autoRun === 'true' || merged.autoRun === 1,
    };
  };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return normalise(saved);
  } catch {
    return normalise(DEFAULT_PREFS);
  }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private browsing can reject storage */ }
}

function enemyCount(run) {
  return Array.isArray(run?.course?.enemies) ? run.course.enemies.filter((enemy) => !enemy.dead).length : 0;
}

function enemyTotal(run) {
  return Array.isArray(run?.course?.enemies) ? run.course.enemies.length : 0;
}

export class UI {
  constructor({
    root = document.querySelector('#ui'),
    onStart = () => {},
    onResume = () => {},
    onRestart = () => {},
    onMenu = () => {},
    onPause = () => {},
    onHost = () => {},
    onJoin = () => {},
    onAccept = () => {},
    onDisconnect = () => {},
    onSettings = () => {},
    onWeapon = () => {},
  } = {}) {
    if (!root) throw new Error('The Last Dead UI requires #ui');
    this.root = root;
    this.callbacks = { onStart, onResume, onRestart, onMenu, onPause, onHost, onJoin, onAccept, onDisconnect, onSettings, onWeapon };
    this.prefs = loadPrefs();
    this.screen = 'menu';
    this.run = null;
    this._toastTimer = 0;
    this._lastEventCount = 0;
    this._network = 'OFFLINE';
    this.debug = new URLSearchParams(location.search).has('debug');
    this._wireRoot();
    this._applyPrefs();
  }

  _wireRoot() {
    this.root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target || !this.root.contains(target)) return;
      const action = target.dataset.action;
      if (target.disabled) return;
      if (['forward', 'back', 'left', 'right', 'jump', 'dash', 'slide', 'fire', 'alt', 'parry', 'weapon', 'look'].includes(action)) return;
      event.preventDefault();
      this._dispatch(action, target);
    });

    this.root.addEventListener('input', (event) => {
      const control = event.target.closest('[data-setting]');
      if (!control || !this.root.contains(control)) return;
      this._updatePref(control.dataset.setting, control.type === 'checkbox' ? control.checked : control.value);
    });

    this.root.addEventListener('change', (event) => {
      const control = event.target.closest('[data-setting]');
      if (!control || !this.root.contains(control)) return;
      this._updatePref(control.dataset.setting, control.type === 'checkbox' ? control.checked : control.value);
    });

    this.root.addEventListener('pointerdown', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target || !this.root.contains(target)) return;
      if (['forward', 'back', 'left', 'right', 'jump', 'dash', 'slide', 'fire', 'alt', 'parry', 'weapon'].includes(target.dataset.action)) {
        // Keep the browser from turning a held combat control into a scroll/selection gesture.
        event.preventDefault();
      }
    }, { passive: false });

    this.root.addEventListener('contextmenu', (event) => {
      if (event.target.closest('[data-action], [data-touch-look]')) event.preventDefault();
    });
  }

  _dispatch(action, target) {
    switch (action) {
      case 'equip': this.callbacks.onWeapon(Number(target.dataset.weapon)); break;
      case 'guide': {const guide=this.root.querySelector('.field-guide');if(guide){guide.hidden=!guide.hidden;target.setAttribute('aria-expanded',String(!guide.hidden));}break;}
      case 'start': this.callbacks.onStart(); break;
      case 'resume': this.callbacks.onResume(); break;
      case 'restart': this.callbacks.onRestart(); break;
      case 'menu': this.callbacks.onMenu(); break;
      case 'pause': this.callbacks.onPause(); break;
      case 'host': this.callbacks.onHost(); break;
      case 'join': this.callbacks.onJoin(this.root.querySelector('[name="joinOffer"]')?.value.trim() || ''); break;
      case 'accept': {
        const acceptCode = this.root.querySelector('[name="acceptAnswer"]')?.value.trim() || this.root.querySelector('[name="answer"]')?.value.trim() || '';
        this.callbacks.onAccept(acceptCode);
        break;
      }
      case 'disconnect': this.callbacks.onDisconnect(); break;
      case 'coop-toggle': this._toggleCoop(); break;
      case 'settings': this._setSettingsOpen(true); break;
      case 'close-settings': this._setSettingsOpen(false); break;
      case 'copy-offer': this._copyCode('offer', target); break;
      case 'copy-answer': this._copyCode('answer', target); break;
      case 'clear-network': this._clearNetwork(); break;
      default: break;
    }
  }

  _copyCode(name, target) {
    const input = this.root.querySelector(`[name="${name}"]`);
    if (!input?.value) {
      this._setNetworkMessage('Nothing to copy yet.', 'error');
      return;
    }
    const done = () => {
      const original = target.textContent;
      target.textContent = 'COPIED';
      window.setTimeout(() => { if (target.isConnected) target.textContent = original; }, 1200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(input.value).then(done).catch(() => this._fallbackCopy(input, done));
    else this._fallbackCopy(input, done);
  }

  _fallbackCopy(input, done) {
    input.focus();
    input.select();
    try { document.execCommand('copy'); done(); } catch { this._setNetworkMessage('Select the code and copy it manually.', 'error'); }
  }

  _clearNetwork() {
    const offer = this.root.querySelector('[name="offer"]');
    const answer = this.root.querySelector('[name="answer"]');
    const joinOffer = this.root.querySelector('[name="joinOffer"]');
    if (offer) offer.value = '';
    if (answer) answer.value = '';
    if (joinOffer) joinOffer.value = '';
    this._setNetworkMessage('Co-op signaling cleared.', '');
  }

  _toggleCoop() {
    const panel = this.root.querySelector('[data-coop-panel]');
    const trigger = this.root.querySelector('[data-action="coop-toggle"]');
    if (!panel || !trigger) return;
    const open = panel.hidden;
    panel.hidden = !open;
    panel.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    trigger.querySelector('[data-coop-icon]')?.replaceChildren(document.createTextNode(open ? '-' : '+'));
    if (open) panel.querySelector('input, button')?.focus();
  }

  _setSettingsOpen(open) {
    const drawer = this.root.querySelector('.settings-drawer');
    if (!drawer) return;
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    this.root.dataset.settingsOpen=String(open);
    if (open) drawer.querySelector('input, button')?.focus();
  }

  escape(){if(this.root.querySelector('.settings-drawer.is-open')){this._setSettingsOpen(false);this.root.querySelector('.screen button')?.focus();return true;}return false;}

  _updatePref(name, value) {
    if (!(name in DEFAULT_PREFS)) return;
    let next = value;
    if (typeof DEFAULT_PREFS[name] === 'number') next = clamp(value, name === 'sensitivity' ? 0.25 : 0, 2);
    if (typeof DEFAULT_PREFS[name] === 'boolean') next = Boolean(value === true || value === 'true' || value === 'on');
    this.prefs = { ...this.prefs, [name]: next };
    savePrefs(this.prefs);
    this._applyPrefs();
    this.callbacks.onSettings({ ...this.prefs });
  }

  _applyPrefs() {
    this.root.dataset.reducedMotion = this.prefs.reducedMotion ? 'true' : 'false';
    this.root.dataset.gore = this.prefs.gore ? 'true' : 'false';
    this.root.style.setProperty('--ui-sensitivity', String(this.prefs.sensitivity));
    const sensitivityValue = this.root.querySelector('[data-setting-value="sensitivity"]');
    const volumeValue = this.root.querySelector('[data-setting-value="volume"]');
    if (sensitivityValue) sensitivityValue.textContent = `${Number(this.prefs.sensitivity).toFixed(2)}x`;
    if (volumeValue) volumeValue.textContent = `${Math.round(Number(this.prefs.volume) * 100)}%`;
    const settings = this.root.querySelectorAll('[data-setting]');
    settings.forEach((control) => {
      const value = this.prefs[control.dataset.setting];
      if (control.type === 'checkbox') control.checked = Boolean(value);
      else control.value = value;
    });
  }

  _clearToasts() {
    const stack = this.root.querySelector('.toast-stack');
    if (!stack) return;
    stack.replaceChildren();
    stack.hidden = true;
  }

  _setNetworkMessage(text, state = '') {
    const node = this.root.querySelector('[data-network-message]');
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state;
  }

  _shell(content, className = 'screen') {
    const existing = this.root.querySelector(`.${className}`);
    if (existing) existing.remove();
    const node = document.createElement('section');
    node.className = className;
    node.innerHTML = content;
    this.root.append(node);
    return node;
  }

  _settingsMarkup() {
    return `<aside class="settings-drawer" aria-hidden="true" aria-label="Settings">
      <div class="settings-heading"><div><span class="kicker">FIELD OPTIONS</span><h2>Settings</h2></div><button class="icon-button" type="button" data-action="close-settings" aria-label="Close settings">x</button></div>
      <div class="setting-row"><div class="setting-copy"><strong>Look sensitivity</strong><span>Mouse and touch camera response</span></div><output class="setting-value" data-setting-value="sensitivity">${Number(this.prefs.sensitivity).toFixed(2)}x</output><input type="range" min="0.25" max="2" step="0.05" value="${esc(this.prefs.sensitivity)}" data-setting="sensitivity" aria-label="Look sensitivity" /></div>
      <div class="setting-row"><div class="setting-copy"><strong>Signal volume</strong><span>Weapon, impact, and arena audio</span></div><output class="setting-value" data-setting-value="volume">${Math.round(this.prefs.volume * 100)}%</output><input type="range" min="0" max="1" step="0.05" value="${esc(this.prefs.volume)}" data-setting="volume" aria-label="Signal volume" /></div>
      <label class="setting-row"><span class="setting-copy"><strong>Reduced motion</strong><span>Lower screen shake and interface motion</span></span><span class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.prefs.reducedMotion ? 'checked' : ''} /><span class="toggle-track"></span></span></label>
      <label class="setting-row"><span class="setting-copy"><strong>Gore effects</strong><span>Blood spray and impact fragments</span></span><span class="toggle"><input type="checkbox" data-setting="gore" ${this.prefs.gore ? 'checked' : ''} /><span class="toggle-track"></span></span></label>
      <label class="setting-row"><span class="setting-copy"><strong>Auto-run</strong><span>Hold the line without holding forward</span></span><span class="toggle"><input type="checkbox" data-setting="autoRun" ${this.prefs.autoRun ? 'checked' : ''} /><span class="toggle-track"></span></span></label>
      <p class="network-state">Preferences are stored on this device. Auto-run can also be changed before each run.</p>
    </aside>`;
  }

  menu() {
    this.screen='menu';this.root.dataset.screen='menu';this.root.dataset.settingsOpen='false';this.run=null;
    this.root.innerHTML=`<section class="screen menu-screen" aria-label="The Last Dead main menu">
     <div class="menu-shell"><div class="menu-copy"><div class="brand-lockup"><span class="brand-eyebrow">A DESCENT INTO VIOLENCE</span><h1 class="brand-title"><span>THE</span><em>LAST<br>DEAD</em></h1><p class="brand-tagline">BLOOD IS FUEL. KEEP MOVING.</p></div></div>
     <nav class="menu-actions" aria-label="Main menu"><button class="primary-button start-button" type="button" data-action="start"><span class="menu-choice">DESCEND</span><small>NEW RUN / THE BLOODWORKS</small></button>
          <div class="coop-access"><button class="coop-toggle" type="button" data-action="coop-toggle" aria-expanded="false" aria-controls="coop-form"><span><b>Co-op uplink</b><small>Optional peer-to-peer breach</small></span><i data-coop-icon>+</i></button>
            <div class="coop-panel" id="coop-form" data-coop-panel hidden>
              <div class="network-panel"><span class="field-label">Host a breach</span><div class="network-row"><input class="code-input" name="offer" autocomplete="off" spellcheck="false" placeholder="Offer code appears here" aria-label="Host offer code" readonly /><button class="network-button" type="button" data-action="host">Create offer</button></div><div class="network-row"><button class="text-button" type="button" data-action="copy-offer">Copy offer code</button><span></span></div></div>
              <div class="network-panel"><span class="field-label">Join a breach</span><div class="network-row"><input class="code-input" name="joinOffer" autocomplete="off" spellcheck="false" placeholder="Paste host offer" aria-label="Join offer code" /><button class="network-button" type="button" data-action="join">Make answer</button></div><div class="network-row"><input class="code-input" name="answer" autocomplete="off" spellcheck="false" placeholder="Answer code appears here" aria-label="Answer code" readonly /><button class="network-button" type="button" data-action="copy-answer">Copy</button></div><div class="network-row"><input class="code-input" name="acceptAnswer" autocomplete="off" spellcheck="false" placeholder="Host: paste answer here" aria-label="Accept answer code" /><button class="network-button" type="button" data-action="accept">Accept</button></div><div class="network-row"><button class="text-button" type="button" data-action="disconnect">Disconnect uplink</button><button class="text-button" type="button" data-action="clear-network">Clear codes</button></div><span class="network-state" data-network-message>Codes stay in this browser until you clear them.</span></div>
            </div>
          </div>

      <button class="menu-link" type="button" data-action="settings">OPTIONS <span>03</span></button>
      <button class="menu-link" type="button" data-action="guide" aria-expanded="false">HOW TO SURVIVE <span>04</span></button>
      <div class="field-guide" hidden><h2>Move. Kill. Recover.</h2><p>Damage enemies up close to heal. Switch weapons, parry incoming attacks, and keep your momentum.</p><div class="guide-controls"><b>WASD</b><span>Move / mouse to aim</span><b>SPACE / SHIFT</b><span>Jump / dash</span><b>CTRL / F / E</b><span>Slide / parry / tether</span><b>1 2 3 4</b><span>Switch weapons</span><b>RIGHT CLICK</b><span>Coin / core / rocket airburst</span></div><p>Clear the waves. Find the exit. Descend.</p></div>
     </nav><div class="descent-route"><span>THE DESCENT</span><ol>${CAMPAIGN_SECTORS.map((sector,i)=>`<li><b>${String(i+1).padStart(2,'0')}</b>${esc(sector.name.replace(/^The /,''))}</li>`).join('')}</ol></div><small class="build-revision">THE LAST DEAD / BUILD 08</small></div>
    </section>${this._settingsMarkup()}`;
    this._applyPrefs();queueMicrotask(()=>this.root.querySelector('.start-button')?.focus({preventScroll:true}));return this;
  }

  pause() {
    this.screen = 'pause';this.root.dataset.screen='pause';this.root.querySelectorAll('.settings-drawer').forEach(n=>n.remove());
    const old = this.root.querySelector('.screen');
    if (old) old.remove();
    this.root.insertAdjacentHTML('afterbegin', `<section class="screen pause-screen" aria-label="Paused">
      <div class="pause-backdrop"></div><div class="pause-card"><span class="kicker">THE LAST DEAD / PAUSED</span><h2>STILL<br><em>BREATHING.</em></h2><p class="pause-copy">The arena is waiting. Pick a line, find a target, and keep your momentum when the signal returns.</p><div class="pause-actions"><button class="primary-button" type="button" data-action="resume">RESUME <span>01</span></button><button class="secondary-button" type="button" data-action="restart">RESTART RUN</button><button class="secondary-button" type="button" data-action="settings">Settings</button><button class="text-button" type="button" data-action="menu">RETURN TO TITLE</button></div></div>
    </section>${this._settingsMarkup()}`);
    this._applyPrefs();
    return this;
  }

  /** Remove modal UI and return input focus to the arena. */
  play() {
    this.screen = 'play';this.root.dataset.screen='play';
    this._clearToasts();
    this.root.querySelector('.screen')?.remove();
    this._setSettingsOpen(false);
    const hud = this.root.querySelector('.hud');
    if (hud) hud.hidden = false;
    const touch = this.root.querySelector('.touch-layer');
    if (touch) touch.hidden = false;
    return this;
  }

  /** Alias used by the root loop when it transitions from a modal state. */
  hide() {
    this.root.querySelector('.screen')?.remove();
    this._setSettingsOpen(false);
    return this;
  }

  /** Briefly pulse the center reticle after a hit, kill, or parry event. */
  hit(type='hit') {
    this._hitUntil=performance.now()+(this.prefs.reducedMotion?80:180);
    this._hitType=type;const crosshair=this.root.querySelector('[data-hud="crosshair"]');crosshair?.classList.add('is-hit');crosshair?.classList.toggle('is-kill',type==='kill');crosshair?.classList.toggle('is-parry',type==='parry');return this;
  }
  combatEvent(event={}) {
    if(['hit','kill','parry'].includes(event.type))this.hit(event.type);
    if(event.type==='kill'||event.type==='parry'){
      const feed=this.root.querySelector('.combat-feed');if(feed){const line=document.createElement('span');line.textContent=event.type==='parry'?'+ PARRY':'+ KILL';line.className=event.type;feed.prepend(line);while(feed.children.length>3)feed.lastElementChild.remove();setTimeout(()=>line.remove(),1800);}
    }
  }
  finish(run = {}, win = run.mode === 'win') {
    this.screen = win ? 'win' : 'dead';this.root.dataset.screen=this.screen;this._setSettingsOpen(false);
    this._clearToasts();
    this.run = run;
    const courseName = run.course?.name || 'The Bloodworks';
    const kills = Number(run.kills) || 0;
    const wave = win ? (run.sectorCount||3) : (run.sectorIndex||0);
    const style = Number(run.styleTotal) || Number(run.style) || 0;
    const combo = Number(run.bestCombo) || Number(run.combo) || 0;
    const time = Number(run.time) || 0;
    const old = this.root.querySelector('.screen');
    if (old) old.remove();
    this.root.insertAdjacentHTML('afterbegin', `<section class="screen finish-screen" aria-label="${win ? 'Arena cleared' : 'Run over'}"><div class="finish-backdrop"></div><div class="finish-card ${win ? 'is-win' : 'is-dead'}"><span class="kicker">${win ? 'SUBJECT COMPLETE // EXIT SIGNAL FOUND' : 'THE DESCENT CLAIMS ANOTHER.'}</span><h2>${win ? 'DEBT <em>PAID.</em>' : 'YOU ARE <em>DEAD.</em>'}</h2><p class="finish-copy">${win ? `${esc(courseName)} is quiet for now. Keep the style high and make the next pass hurt more.` : 'The arena keeps moving. Go again with a faster line, a sharper parry, and no respect for the incoming fire.'}</p><div class="results"><div class="result"><strong>${fmt(time, 1)}s</strong><span class="result-label">run time</span></div><div class="result"><strong>${String(kills).padStart(2, '0')}</strong><span class="result-label">eliminated</span></div><div class="result"><strong>${String(combo).padStart(2, '0')}</strong><span class="result-label">best combo</span></div></div><div class="results"><div class="result"><strong>${String(wave).padStart(2, '0')} / 03</strong><span class="result-label">sectors cleared</span></div><div class="result"><strong>${Math.round(style)}</strong><span class="result-label">style earned</span></div><div class="result"><strong>${esc(run.rank || (win ? 'S' : 'D'))}</strong><span class="result-label">final rank</span></div></div><div class="finish-actions"><button class="primary-button" type="button" data-action="restart">${win ? 'Run it back' : 'RISE AGAIN'} <span>-></span></button><button class="secondary-button" type="button" data-action="menu">Return to menu</button></div></div></section>`);
    return this;
  }

  _hudMarkup() {
    return `<div class="hud" aria-label="The Last Dead combat HUD">
      <div class="blood-veil" aria-hidden="true"><svg viewBox="0 0 1600 900" preserveAspectRatio="none"><path d="M0 0H390L270 24L210 13L188 70L165 35L139 118L112 46L75 190L52 84L0 256ZM1600 0H1300L1380 24L1395 86L1420 34L1460 151L1482 66L1525 218L1554 92L1600 267ZM0 900V580L28 689L61 648L43 738L96 716L88 810L158 773L149 868L280 900ZM1600 900V572L1575 665L1542 640L1550 752L1509 734L1496 841L1433 801L1418 884L1310 900Z"/><g><ellipse cx="57" cy="340" rx="9" ry="25"/><ellipse cx="1518" cy="392" rx="12" ry="33"/><ellipse cx="233" cy="53" rx="8" ry="19"/><ellipse cx="1384" cy="850" rx="13" ry="8"/></g></svg></div>
      <div class="hud-top"><div class="hud-cluster"><div class="objective"><span class="hud-label" data-hud="sector">I / BLOODWORKS</span><strong class="hud-value" data-hud="objective">WAVE 01 / 03</strong><span class="hud-sub" data-hud="objective-sub">HUNT THEM DOWN</span><div class="objective-progress"><i data-hud="objective-progress"></i></div></div></div>
       <div class="run-clock"><span data-hud="run-clock">00:00</span><small data-hud="network">SOLO</small><small data-hud="fps" hidden></small></div>
       <div class="hud-cluster"><div class="rank"><span class="rank-caption">STYLE</span><strong data-hud="rank">D</strong><div class="rank-meter"><i data-hud="style-fill"></i></div><span data-hud="style-label">GET CLOSE.</span><div class="combat-feed" aria-live="off"></div></div><button class="hud-pause" type="button" data-action="pause" aria-label="Pause game">II</button></div></div>
      <div class="crosshair" data-hud="crosshair" aria-hidden="true"><span class="hitmarker"></span><i></i><b></b></div>
      <div class="hud-bottom"><div class="hud-bottom-left"><div class="vitals"><div class="vitals-line"><svg class="blood-mark" viewBox="0 0 40 60" aria-hidden="true"><path d="M20 0C18 15 2 30 2 40a18 18 0 0 0 36 0C38 29 23 15 20 0Z"/><path class="blood-cut" d="M7 41L24 23L17 42L31 35L18 56"/></svg><strong data-hud="health">100</strong><span class="vital-caption">BLOOD<br><b>VITALS</b></span></div><div class="meter health-meter"><i class="health-trail" data-hud="health-trail"></i><i class="health-fill" data-hud="health-fill"></i></div><span class="critical-label">FEED OR DIE</span></div><div class="dash-cluster"><div class="dash-pips"><i class="dash-pip" data-dash="0"></i><i class="dash-pip" data-dash="1"></i><i class="dash-pip" data-dash="2"></i></div><span>DASH</span></div></div>
       <div class="hud-bottom-right"><div class="weapon-card"><div class="weapon-line"><span class="weapon-slot" data-hud="weapon-slot">01</span><strong class="weapon-name" data-hud="weapon">OSSUARY</strong></div><div class="weapon-rack">${WEAPON_NAMES.map((name,i)=>`<button type="button" data-action="equip" data-weapon="${i}" data-weapon-slot="${i}" aria-label="Equip ${name}">${weaponSigil(i)}<span>${i+1}</span></button>`).join('')}</div><span class="weapon-foot"><span data-hud="weapon-resource">COIN x4</span><span data-hud="cooldown-label">READY</span></span><div class="cooldown"><i data-hud="cooldown"></i></div></div></div></div>
    </div>`;
  }

  _touchMarkup() {
    return `<div class="touch-layer" aria-label="Touch controls" hidden><div class="touch-look" data-touch-look="true" aria-label="Drag to look"></div><div class="touch-cluster touch-left"><button class="touch-button dash" type="button" data-action="dash" aria-label="Dash">DASH</button><button class="touch-button forward" type="button" data-action="forward" aria-label="Move forward">UP</button><button class="touch-button left" type="button" data-action="left" aria-label="Strafe left">LEFT</button><button class="touch-button back" type="button" data-action="back" aria-label="Move backward">DOWN</button><button class="touch-button right" type="button" data-action="right" aria-label="Strafe right">RIGHT</button><button class="touch-button slide" type="button" data-action="slide" aria-label="Slide or slam">SLAM</button></div><div class="touch-cluster touch-right"><button class="touch-button weapon" type="button" data-action="weapon" aria-label="Switch weapon">WEAP</button><button class="touch-button hook" type="button" data-action="hook" aria-label="Tether or pull">HOOK</button><button class="touch-button alt" type="button" data-action="alt" aria-label="Alternate fire">ALT</button><button class="touch-button parry" type="button" data-action="parry" aria-label="Punch or parry">PARRY</button><button class="touch-button fire" type="button" data-action="fire" aria-label="Fire">FIRE</button><button class="touch-button jump" type="button" data-action="jump" aria-label="Jump">JUMP</button></div></div>`;
  }

  hud(run = this.run, { network = this._network, fps = null } = {}) {
    if (!run) return this;
    this.run = run;
    let hud = this.root.querySelector('.hud');
    if (!hud) {
      this.root.insertAdjacentHTML('beforeend', `${this._hudMarkup()}${this._touchMarkup()}<div class="toast-stack" hidden></div>`);
      hud = this.root.querySelector('.hud');this._applyPrefs();
    }
    const mode = run.mode || 'play';
    hud.hidden = this.screen!=='play'||(mode!=='play'&&mode!=='ready');
    const touch = this.root.querySelector('.touch-layer');
    if (touch) touch.hidden = this.screen!=='play';
    const health = clamp(run.health, 0, 100);
    const energy = clamp(run.energy, 0, 100);
    const style = clamp(run.style, 0, 1800);
    const waveCount = run.waveCount || 3;
    const currentWave = clamp(run.wave, 0, waveCount);
    const pending = Math.max(0, run.director?.pending || 0);
    const exitReady = currentWave >= waveCount && enemyCount(run) === 0 && pending === 0;
    const remaining = enemyCount(run);
    const total = enemyTotal(run);
    const weapon = clamp(run.weapon, 0, WEAPON_NAMES.length - 1);
    const cooldown = Math.max(0, Number(run.cooldowns?.[weapon] || run.fireCooldown || 0));
    const maxCooldown = weapons[weapon]?.interval || 1;
    const crosshair = this.root.querySelector('[data-hud="crosshair"]');
    const now=performance.now();const hit=now<(this._hitUntil||0);
    crosshair?.classList.toggle('is-hit', hit);crosshair?.classList.toggle('is-kill',hit&&this._hitType==='kill');crosshair?.classList.toggle('is-parry',hit&&this._hitType==='parry');
    crosshair?.classList.toggle('is-shot', Number(run.shot) > 0);
    const reset=run.time<(this._hudTime||0);if(!reset&&this._lastHealth!==undefined&&health<this._lastHealth){this._damageAt=now;this._damageStrength=Math.min(.8,.25+(this._lastHealth-health)/60);}if(reset)this._damageAt=0;this._hudTime=run.time;this._lastHealth=health;hud.classList.toggle('is-critical',health>0&&health<=30);hud.style.setProperty('--damage',String(Math.max(0,1-(now-(this._damageAt||0))/650)*(this._damageStrength||0)));
    this._setHud('health', fmt(health));this._setHud('health-trail','',health);
    this._setHud('run-clock',`${String(Math.floor((run.time||0)/60)).padStart(2,'0')}:${String(Math.floor((run.time||0)%60)).padStart(2,'0')}`);
    this._setHud('health-fill', '', health);
    this._setHud('energy', pct(energy));
    this._setHud('energy-fill', '', energy);
    this._setHud('speed', `${fmt(run.speed, 1)} m/s`);
    this._setHud('rank', run.rank || 'D');
    this._setHud('rank-bottom', run.rank || 'D');
    this._setHud('style-label', run.styleLabel || 'GET CLOSE. GET LOUD.');
    this._setHud('style-total', `${Math.round(Number(run.styleTotal) || style)} pts`);
    this._setHud('style-fill', '', (style / 1800) * 100);
    this._setHud('weapon', WEAPON_NAMES[weapon]);
    this._setHud('weapon-slot', `${String(weapon + 1).padStart(2, '0')}`);
    this.root.querySelectorAll('[data-weapon-slot]').forEach(node=>{node.classList.toggle('is-equipped',Number(node.dataset.weaponSlot)===weapon);node.setAttribute('aria-pressed',String(Number(node.dataset.weaponSlot)===weapon));});
    this._setHud('weapon-hint', WEAPON_HINTS[weapon]);
    const coins = clamp(run.coinCharges, 0, 4);
    const altCooldown = Math.max(0, Number(run.altCooldown || 0));
    this._setHud('weapon-resource', weapon === 0 ? `COIN x${Math.floor(coins)}` : weapon === 1 ? (altCooldown > 0 ? `CORE ${fmt(altCooldown, 1)}s` : 'CORE READY') : weapon === 2 ? 'RAIL PIERCE' : 'BURST READY');
    this._setHud('cooldown-label', cooldown > 0.01 ? `${fmt(cooldown, 2)}s` : 'READY');
    this._setHud('cooldown', '', maxCooldown ? (1 - cooldown / maxCooldown) * 100 : 100);
    this._setHud('network', network || 'OFFLINE');
    const fpsNode = this.root.querySelector('[data-hud="fps"]');
    if (fpsNode) { fpsNode.hidden = !this.debug; if (this.debug) fpsNode.textContent = fps ? `${Math.round(fps)} FPS` : '-- FPS'; }
    this._setHud('sector', `${['I','II','III'][run.sectorIndex||0]} / ${(run.sectorName||run.course?.name||'Bloodworks').replace(/^The /,'')}`);
    this._setHud('objective', exitReady ? ((run.sectorIndex||0)<(run.sectorCount||3)-1?'DESCEND THROUGH EXIT':'REACH THE FINAL EXIT') : run.director?.state==='intermission' ? `NEXT WAVE IN ${Math.ceil(run.waveDelay||0)}s` : `WAVE ${String(Math.max(1,currentWave)).padStart(2,'0')} / ${waveCount}`);
    this._setHud('objective-sub', exitReady ? 'Green exit signal is live' : `${remaining} REMAIN${pending?' / '+pending+' INCOMING':''}`);
    this._setHud('objective-progress', '', exitReady ? 100 : (Math.max(0,currentWave-1)+(total?Math.max(0,total-remaining)/(total+pending):0))/waveCount*100);
    this.root.querySelectorAll('[data-dash]').forEach((pip, index) => pip.classList.toggle('is-ready', energy >= (index + 1) * 33));
    return this;
  }

  _setHud(name, text, width) {
    const node = this.root.querySelector(`[data-hud="${name}"]`);
    if (!node) return;
    if (text !== '') node.textContent = text;
    if (width !== undefined) node.style.width = `${clamp(width, 0, 100)}%`;
  }

  toast(text) {
    let stack = this.root.querySelector('.toast-stack');
    if (!stack) {
      this.root.insertAdjacentHTML('beforeend', '<div class="toast-stack"></div>');
      stack = this.root.querySelector('.toast-stack');
    }
    stack.replaceChildren();
    stack.hidden = false;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const parts=String(text).split(' // ');toast.innerHTML=parts.length>1?`<small>${esc(parts.shift())}</small><strong>${esc(parts.join(' // '))}</strong>`:esc(text);
    stack.append(toast);
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => {
      if (!stack.isConnected) return;
      const first = stack.firstElementChild;
      first?.remove();
      if (!stack.children.length) stack.hidden = true;
    }, 2100);
    return this;
  }

  networkStatus(text) {
    this._network = text || 'OFFLINE';
    this._setHud('network', this._network);
    this._setNetworkMessage(this._network, 'ready');
    return this;
  }

  setOffer(code) {
    const input = this.root.querySelector('[name="offer"]');
    if (input) input.value = code || '';
    this._setNetworkMessage(code ? 'Offer ready. Send it to your breach partner.' : 'Waiting for a host offer.', code ? 'ready' : '');
    return this;
  }

  setAnswer(code) {
    const input = this.root.querySelector('[name="answer"]');
    if (input) input.value = code || '';
    this._setNetworkMessage(code ? 'Answer ready. Host can accept this code.' : 'Waiting for an answer.', code ? 'ready' : '');
    return this;
  }
}

export default UI;
