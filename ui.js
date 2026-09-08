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
  } = {}) {
    if (!root) throw new Error('The Last Dead UI requires #ui');
    this.root = root;
    this.callbacks = { onStart, onResume, onRestart, onMenu, onPause, onHost, onJoin, onAccept, onDisconnect, onSettings };
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
    if (open) drawer.querySelector('input, button')?.focus();
  }

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
    this.screen = 'menu';
    this.run = null;
    this.root.innerHTML = `<section class="screen menu-screen" aria-label="The Last Dead main menu">
      <div class="menu-shell">
        <div class="menu-copy">
          <div class="brand-lockup"><span class="brand-eyebrow">DESCENT PROTOCOL // THREE SECTORS</span><h1 class="brand-title"><span>THE</span><em>LAST DEAD</em></h1><span class="brand-stamp">TLD<br />07<br />LIVE</span><p class="brand-tagline">Three floors below mercy. Fast feet. Heavy weapons. Nothing leaves clean.</p></div>
          <div class="menu-copy-foot"><div class="menu-footer"><button class="text-button" type="button" data-action="settings">Settings</button><small class="build-revision">BUILD 07 / THE LAST DEAD</small></div><span class="menu-status">NO SAFE ROOM // SIGNAL OPEN</span></div>
        </div>
        <div class="menu-actions">
          <div class="course-heading"><div><span class="kicker">CAMPAIGN // DESCENT</span><h2>The <em>Bloodworks</em></h2></div><span class="course-index">01 / 03</span></div>
          <p class="course-blurb">Descend through three condemned sectors. Threats evolve, reinforcements arrive in pulses, and every sealed exit demands a clean sweep.</p>
          <ol class="campaign-route" aria-label="Campaign descent">${CAMPAIGN_SECTORS.map((sector,i)=>`<li class="${i===0?'is-current':''}"><span>${String(i+1).padStart(2,'0')}</span><b>${esc(sector.name.replace(/^The /,''))}</b></li>`).join('')}</ol><div class="course-meta"><div><span class="tiny-label">Protocol</span><strong>3 SECTORS // 9 WAVES</strong></div><div><span class="tiny-label">Threat profile</span><strong>MUTATIONS + HEAVY ORDNANCE</strong></div></div>
          <button class="primary-button start-button" type="button" data-action="start">Start solo <span>-></span></button>
          <div class="combat-note"><span class="field-label">Combat doctrine</span><strong>4: RELIQUARY // ROCKETS // FUSE CONTROL</strong></div>
          <div class="coop-access"><button class="coop-toggle" type="button" data-action="coop-toggle" aria-expanded="false" aria-controls="coop-form"><span><b>Co-op uplink</b><small>Optional peer-to-peer breach</small></span><i data-coop-icon>+</i></button>
            <div class="coop-panel" id="coop-form" data-coop-panel hidden>
              <div class="network-panel"><span class="field-label">Host a breach</span><div class="network-row"><input class="code-input" name="offer" autocomplete="off" spellcheck="false" placeholder="Offer code appears here" aria-label="Host offer code" readonly /><button class="network-button" type="button" data-action="host">Create offer</button></div><div class="network-row"><button class="text-button" type="button" data-action="copy-offer">Copy offer code</button><span></span></div></div>
              <div class="network-panel"><span class="field-label">Join a breach</span><div class="network-row"><input class="code-input" name="joinOffer" autocomplete="off" spellcheck="false" placeholder="Paste host offer" aria-label="Join offer code" /><button class="network-button" type="button" data-action="join">Make answer</button></div><div class="network-row"><input class="code-input" name="answer" autocomplete="off" spellcheck="false" placeholder="Answer code appears here" aria-label="Answer code" readonly /><button class="network-button" type="button" data-action="copy-answer">Copy</button></div><div class="network-row"><input class="code-input" name="acceptAnswer" autocomplete="off" spellcheck="false" placeholder="Host: paste answer here" aria-label="Accept answer code" /><button class="network-button" type="button" data-action="accept">Accept</button></div><div class="network-row"><button class="text-button" type="button" data-action="disconnect">Disconnect uplink</button><button class="text-button" type="button" data-action="clear-network">Clear codes</button></div><span class="network-state" data-network-message>Codes stay in this browser until you clear them.</span></div>
            </div>
          </div>
          <div class="controls-strip controls-compact" aria-label="Controls"><span class="control-key"><b class="keycap">WASD</b> move</span><span class="control-key"><b class="keycap">MOUSE</b> look / fire</span><span class="control-key"><b class="keycap">SPACE</b> jump</span><span class="control-key"><b class="keycap">SHIFT</b> dash</span><span class="control-key"><b class="keycap">CTRL</b> slide</span><span class="control-key"><b class="keycap">F</b> parry</span><span class="control-key"><b class="keycap">E</b> tether</span><span class="control-key"><b class="keycap">1 2 3 4</b> weapons</span><span class="control-key"><b class="keycap">ESC</b> pause</span></div>
        </div>
      </div>
    </section>${this._settingsMarkup()}`;
    this._applyPrefs();
    return this;
  }

  pause() {
    this.screen = 'pause';
    const old = this.root.querySelector('.screen');
    if (old) old.remove();
    this.root.insertAdjacentHTML('afterbegin', `<section class="screen pause-screen" aria-label="Paused">
      <div class="pause-backdrop"></div><div class="pause-card"><span class="kicker">SIGNAL HELD // THE LAST DEAD</span><h2>Stay <em>alive.</em></h2><p class="pause-copy">The arena is waiting. Pick a line, find a target, and keep your momentum when the signal returns.</p><div class="pause-actions"><button class="primary-button" type="button" data-action="resume">Resume breach <span>-></span></button><button class="secondary-button" type="button" data-action="restart">Restart arena</button><button class="secondary-button" type="button" data-action="settings">Settings</button><button class="text-button" type="button" data-action="menu">Abort to menu</button></div></div>
    </section>${this._settingsMarkup()}`);
    this._applyPrefs();
    return this;
  }

  /** Remove modal UI and return input focus to the arena. */
  play() {
    this.screen = 'play';
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
  hit() {
    const reticle = this.root.querySelector('[data-hud="crosshair"]');
    if (!reticle) return this;
    reticle.classList.add('is-hit');
    window.clearTimeout(this._hitTimer);
    this._hitTimer = window.setTimeout(() => reticle.classList.remove('is-hit'), this.prefs.reducedMotion ? 40 : 130);
    return this;
  }
  finish(run = {}, win = run.mode === 'win') {
    this.screen = win ? 'win' : 'dead';
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
    this.root.insertAdjacentHTML('afterbegin', `<section class="screen finish-screen" aria-label="${win ? 'Arena cleared' : 'Run over'}"><div class="finish-backdrop"></div><div class="finish-card ${win ? 'is-win' : 'is-dead'}"><span class="kicker">${win ? 'SUBJECT COMPLETE // EXIT SIGNAL FOUND' : 'LIFE SIGNAL LOST // RELOAD REQUIRED'}</span><h2>${win ? 'Blood <em>paid.</em>' : 'You got <em>opened.</em>'}</h2><p class="finish-copy">${win ? `${esc(courseName)} is quiet for now. Keep the style high and make the next pass hurt more.` : 'The arena keeps moving. Go again with a faster line, a sharper parry, and no respect for the incoming fire.'}</p><div class="results"><div class="result"><strong>${fmt(time, 1)}s</strong><span class="result-label">run time</span></div><div class="result"><strong>${String(kills).padStart(2, '0')}</strong><span class="result-label">eliminated</span></div><div class="result"><strong>${String(combo).padStart(2, '0')}</strong><span class="result-label">best combo</span></div></div><div class="results"><div class="result"><strong>${String(wave).padStart(2, '0')} / 03</strong><span class="result-label">sectors cleared</span></div><div class="result"><strong>${Math.round(style)}</strong><span class="result-label">style earned</span></div><div class="result"><strong>${esc(run.rank || (win ? 'S' : 'D'))}</strong><span class="result-label">final rank</span></div></div><div class="finish-actions"><button class="primary-button" type="button" data-action="restart">${win ? 'Run it back' : 'Retry the breach'} <span>-></span></button><button class="secondary-button" type="button" data-action="menu">Return to menu</button></div></div></section>`);
    return this;
  }

  _hudMarkup() {
    return `<div class="hud" aria-label="The Last Dead combat HUD"><div class="hud-top"><div class="hud-cluster"><div class="hud-plate objective"><span class="hud-label"><span data-hud="sector">Sector 01 // Bloodworks</span></span><strong class="hud-value" data-hud="objective">CLEAR THE WAVES</strong><span class="hud-sub" data-hud="objective-sub">Reach the exit after wave 03</span><div class="objective-progress"><i data-hud="objective-progress"></i></div></div></div><div class="hud-cluster"><div class="hud-plate network"><span class="hud-label">Uplink</span><strong class="hud-value" data-hud="network">OFFLINE</strong><span class="hud-sub" data-hud="fps">-- FPS</span></div><div class="hud-plate rank"><span class="hud-label">Style rank</span><strong class="hud-value" data-hud="rank">D</strong><span class="hud-sub" data-hud="style-label">GET CLOSE. GET LOUD.</span></div><button class="hud-pause" type="button" data-action="pause" aria-label="Pause game">II</button></div></div><div class="crosshair" data-hud="crosshair" aria-hidden="true"><span class="hitmarker"></span></div><div class="hud-bottom"><div class="hud-bottom-left"><div class="vitals"><div class="vitals-line"><span class="hud-label">Life signal</span><strong data-hud="health">100</strong></div><div class="meter"><i class="health-fill" data-hud="health-fill"></i></div><div class="vitals-foot"><span>energy <b data-hud="energy">100%</b></span><span data-hud="speed">0.0 m/s</span></div><div class="meter"><i class="energy-fill" data-hud="energy-fill"></i></div></div><div class="dash-cluster"><span class="hud-label">Dash cells</span><div class="dash-pips"><i class="dash-pip" data-dash="0"></i><i class="dash-pip" data-dash="1"></i><i class="dash-pip" data-dash="2"></i></div><span class="hud-sub">shift</span></div></div><div class="hud-bottom-right"><div class="weapon-card"><div class="weapon-line"><span class="weapon-slot" data-hud="weapon-slot">01 / 04</span><strong class="weapon-name" data-hud="weapon">OSSUARY</strong></div><span class="weapon-foot"><span data-hud="weapon-hint">SEMI-AUTO // KEEP MOVING</span><span data-hud="weapon-resource">COIN x4</span><span data-hud="cooldown-label">READY</span></span><div class="cooldown"><i data-hud="cooldown"></i></div></div></div></div></div>`;
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
      hud = this.root.querySelector('.hud');
    }
    this.screen = 'play';
    const mode = run.mode || 'play';
    hud.hidden = mode !== 'play' && mode !== 'ready';
    const touch = this.root.querySelector('.touch-layer');
    if (touch) touch.hidden = false;
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
    const hit = Array.isArray(run.events) && run.events.some((event) => event.type === 'hit' || event.type === 'kill' || event.type === 'parry');
    crosshair?.classList.toggle('is-hit', hit);
    crosshair?.classList.toggle('is-shot', Number(run.shot) > 0);
    this._setHud('health', fmt(health));
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
    this._setHud('weapon-slot', `${String(weapon + 1).padStart(2, '0')} / 04`);
    this._setHud('weapon-hint', WEAPON_HINTS[weapon]);
    const coins = clamp(run.coinCharges, 0, 4);
    const altCooldown = Math.max(0, Number(run.altCooldown || 0));
    this._setHud('weapon-resource', weapon === 0 ? `COIN x${Math.floor(coins)}` : weapon === 1 ? (altCooldown > 0 ? `CORE ${fmt(altCooldown, 1)}s` : 'CORE READY') : weapon === 2 ? 'RAIL PIERCE' : 'BURST READY');
    this._setHud('cooldown-label', cooldown > 0.01 ? `${fmt(cooldown, 2)}s` : 'READY');
    this._setHud('cooldown', '', maxCooldown ? (1 - cooldown / maxCooldown) * 100 : 100);
    this._setHud('network', network || 'OFFLINE');
    const fpsNode = this.root.querySelector('[data-hud="fps"]');
    if (fpsNode) { fpsNode.hidden = !this.debug; if (this.debug) fpsNode.textContent = fps ? `${Math.round(fps)} FPS` : '-- FPS'; }
    this._setHud('sector', `Sector ${String((run.sectorIndex||0)+1).padStart(2,'0')} / ${String(run.sectorCount||3).padStart(2,'0')} // ${run.sectorName||run.course?.name||'Bloodworks'}`);
    this._setHud('objective', exitReady ? ((run.sectorIndex||0)<(run.sectorCount||3)-1?'DESCEND THROUGH EXIT':'REACH THE FINAL EXIT') : run.director?.state==='intermission' ? `NEXT WAVE IN ${Math.ceil(run.waveDelay||0)}s` : `CLEAR WAVE ${String(Math.max(1,currentWave)).padStart(2,'0')} / ${waveCount}`);
    this._setHud('objective-sub', exitReady ? 'Green exit signal is live' : `${remaining} active // ${pending} reinforcements${run.director?.aliveCap?' // cap '+run.director.aliveCap:''}`);
    this._setHud('objective-progress', '', exitReady ? 100 : (Math.max(0,currentWave-1)+(total?Math.max(0,total-remaining)/(total+pending):0))/waveCount*100);
    this.root.querySelectorAll('[data-dash]').forEach((pip, index) => pip.classList.toggle('is-ready', energy >= (index + 1) * 33));
    this._applyPrefs();
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
    toast.textContent = text;
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
