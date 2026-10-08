import {lowTideObjective,lowTidePrompt,lowTideJournal,LOW_TIDE_TITLE} from './low-tide.js';
import {basementPrompt} from './island-basement.js';
import {harborRoomPrompt} from './harbor-interiors.js';
import {journeyPrompt,journeyTransmission} from './journey-presentation.js';
import {harborNavigation,harborLocation} from './harbor-navigation.js';
import {CAMPAIGN_SECTORS} from './campaign.js';
import {getRoom, getRoomSequence} from './room-progression.js';
import {weapons,brutalCandidate,chestCandidate,nearestRat,verminTarget} from './engine.js';
const PREFS_KEY = 'dead-arrival-prefs-v1';

const DEFAULT_PREFS = Object.freeze({
  sensitivity: 1,
  volume: 0.5,
  sfxVolume: 1,
  voiceVolume: 1,
  musicVolume: 1,
  ambienceVolume: 1,
  uiVolume: 1,
  reducedMotion: false,
  gore: true,
  bodycam: true,
  autoRun: false,
});

const WEAPON_NAMES = ['OSSUARY', 'BREACH SHOTGUN', 'ARC LANCE', 'RELIQUARY', 'CARRION RIFLE', 'MOURNING RIFLE', 'WAKE BAT', 'RIPPER CHAINSAW'];
const WEAPON_HINTS = [
  'PRECISION FIRE',
  'WIDE SPREAD / UNDERBARREL',
  'RAIL PIERCE',
  'ROCKET FUSE',
  'AUTOMATIC FIRE',
  'PRECISION SHOT',
  'HEAVY SWING',
  'REV + CUT',
];


const WEAPON_SIGILS = [
 'M9 24L18 14H44L50 19H83V29H49L43 35H31L24 48H14L19 31H9Z M29 17V31 M36 17V31 M44 20H78 M52 25H86',
 'M8 20H39L48 14H85V21H47V27H85V34H47L39 30H29L23 48H13L17 30H8Z M52 17H82 M52 30H82',
 'M8 22H27L35 14H55L65 22H88 M8 32H27L35 40H55L65 32H88 M21 22V33 M39 17V37 M49 17V37 M58 20L73 27L58 34 M30 34L24 48H14L18 32',
 'M6 20L18 12H38L46 17H78L89 10V42L78 35H46L38 40H18L6 32Z M21 16V36 M31 16V36 M49 20V32 M58 20V32 M68 20V32 M83 16V36',
 'M4 23H18L25 16H64L73 20H91V32H73L64 37H25L18 31H4Z M28 18V35 M39 18V35 M52 18V35 M65 21V32 M76 23V30 M12 27H84',
 'M5 20H22L30 12H62L69 17H91V39H69L62 44H30L22 36H5Z M30 17H60V39H30 M68 20V36 M78 20V36 M12 27H84',
 'M9 45L14 50L35 29L70 14Q79 8 75 3Q70 0 65 5L28 23Z M24 29L30 35 M18 36L24 42 M45 17L51 23 M59 10L65 17',
 'M8 24H39V44H8Z M14 24V12H31V24 M39 27H77Q91 27 91 34Q91 41 77 41H39 M45 24L49 29 M57 24L61 29 M70 24L74 29 M47 40L51 45 M61 40L65 45 M75 40L79 45 M15 30V39 M24 30V39'
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
const compactHudCopy = (value) => String(value ?? '')
  .replace(/^NEXT THREAT ZONE:\s*/i, 'NEXT ZONE: ')
  .replace(/\s+REQUIRED FOR THE LIFT$/i, ' NEEDED')
  .replace(/^KEY SECURED · /i, 'SECURED · ')
  .trim();
const roomSequenceCache = new Map();
const roomCatalogFor = sectorId => {
  if (!roomSequenceCache.has(sectorId)) roomSequenceCache.set(sectorId, getRoomSequence(sectorId));
  return roomSequenceCache.get(sectorId);
};

function loadPrefs() {
  const normalise = (saved) => {
    const merged = { ...DEFAULT_PREFS, ...(saved && typeof saved === 'object' ? saved : {}) };
    return {
      sensitivity: clamp(merged.sensitivity, 0.25, 2),
      volume: clamp(merged.volume, 0, 1),
      sfxVolume: clamp(merged.sfxVolume, 0, 1),
      voiceVolume: clamp(merged.voiceVolume, 0, 1),
      musicVolume: clamp(merged.musicVolume, 0, 1),
      ambienceVolume: clamp(merged.ambienceVolume, 0, 1),
      uiVolume: clamp(merged.uiVolume, 0, 1),
      reducedMotion: merged.reducedMotion === true || merged.reducedMotion === 'true' || merged.reducedMotion === 1,
      gore: merged.gore !== false && merged.gore !== 'false' && merged.gore !== 0,
      bodycam: merged.bodycam !== false && merged.bodycam !== 'false' && merged.bodycam !== 0,
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

// The room director is the source of truth for the campaign route.  Keep the
// fallback here deliberately display-only so older snapshots and the menu
// preview remain readable while the live run migrates to room_progression.
export function roomProgression(run = {}) {
  if (run.course?.dungeon) {
    const course = run.course;
    const state = run.dungeonProgression || {};
    const encounter = state.encounter || {};
    const rooms = Array.isArray(course.rooms) ? course.rooms : [];
    const roomId = value => typeof value === 'string' ? value : value?.id;
    const roomFor = id => id ? rooms.find(room => room.id === id) || null : null;
    const sequence = (Array.isArray(course.encounterRoute) ? course.encounterRoute : Array.isArray(state.roomSequence) ? state.roomSequence : rooms)
      .map(roomId).filter(Boolean);
    const roomCount = Math.max(1, Math.round(course.encounterRoute?.length || Number(state.roomCount) || sequence.length || rooms.length || 1));
    const activeRoomId = roomId(state.activeRoomId);
    const encounterRoomId = roomId(state.encounterRoomId)
      || roomId(state.currentEncounterRoomId)
      || roomId(encounter.roomId)
      || activeRoomId;
    const activeRoom = roomFor(activeRoomId);
    const encounterRoom = roomFor(encounterRoomId) || activeRoom;
    const routeTarget=state.currentEncounterRoomId||state.navigation?.roomId||state.nextRoomId||encounterRoomId;
    const indexFromId = sequence.indexOf(routeTarget);
    const suppliedRoomIndex = Number(state.roomIndex);
    const roomIndex = Math.max(0, Math.min(roomCount - 1, Math.round(course.encounterRoute&&indexFromId>=0?indexFromId:Number.isFinite(suppliedRoomIndex) ? suppliedRoomIndex : (indexFromId >= 0 ? indexFromId : 0))));
    const nextRoomId = roomId(state.nextRoomId) || sequence[roomIndex + 1] || null;
    const nextRoom = roomFor(nextRoomId);
    const waveCount = Math.max(1, Math.round(Number(encounter.waveCount ?? run.waveCount ?? course.waveCount) || 1));
    const wave = clamp(encounter.wave ?? run.wave ?? 0, 0, waveCount);
    const fallbackActive = Array.isArray(run.course?.enemies)
      ? run.course.enemies.filter(enemy => !enemy.dead && (!encounterRoomId || enemy.roomId === encounterRoomId)).length
      : enemyCount(run);
    const active = Math.max(0, Math.round(Number(encounter.active ?? fallbackActive) || 0));
    const pending = Math.max(0, Math.round(Number(encounter.pending ?? run.director?.pending ?? 0) || 0));
    const remaining = Math.max(0, Math.round(Number(encounter.remaining ?? (active + pending)) || 0));
    const fallbackTotal = Math.max(remaining, active + pending, enemyTotal(run));
    const total = Math.max(0, Math.round(Number(encounter.total ?? fallbackTotal) || 0));
    const completedValue = state.roomsCompleted;
    const completedCount = Array.isArray(completedValue)
      ? completedValue.length
      : Math.max(0, Math.round(Number(completedValue) || 0));
    const phaseBeforeEncounter = String(state.phase || encounter.state || '').toLowerCase();
    const encounterProgress = total > 0
      ? clamp((total - remaining) / total, 0, 1)
      : ['key', 'exit'].includes(phaseBeforeEncounter) || (phaseBeforeEncounter === 'exploration' && completedCount > 0) ? 1 : 0;
    const suppliedProgress = Number(state.progress);
    const progress = clamp(Number.isFinite(suppliedProgress)
      ? (suppliedProgress > 1 ? suppliedProgress / 100 : suppliedProgress)
      : (completedCount + encounterProgress) / roomCount, 0, 1);
    const keys = course.keys || [];
    const collected = state.keysCollected || [];
    const missingKey = keys.find(key => !collected.includes(key.id));
    const rawPhase = phaseBeforeEncounter;
    const phase = rawPhase === 'spawning' ? 'telegraph' : rawPhase === 'intermission' ? 'exploration' : rawPhase || (remaining || pending ? 'combat' : 'exploration');
    const exitReady = state.exitReady === true || phase === 'exit';
    const objective = String(state.objective || (exitReady
      ? 'Reach the descent lift'
      : phase === 'exploration'
        ? (nextRoom ? `Reach ${nextRoom.name}` : 'Explore the room')
        : phase === 'key'
          ? (missingKey ? `Find ${missingKey.name}` : 'Find the floor key')
          : `Clear ${encounterRoom?.name || activeRoom?.name || 'the room'}`));
    const subtitle = phase === 'combat' || phase === 'telegraph'
      ? (encounterRoom?.encounter?.tactic || 'Hold the room and read the next approach.')
      : phase === 'exploration'
        ? (nextRoom ? `Next room: ${nextRoom.name}` : 'The path is open.')
        : exitReady ? `Floor ${course.dungeonIndex + 1} complete` : missingKey ? `${missingKey.name} required for the lift` : 'Explore the floor';
    const explorationThreat = completedCount > 0 ? 'ROOM CLEAR' : 'NO ACTIVE THREATS';
    const threat = phase === 'telegraph'
      ? (pending ? `${pending} INCOMING` : 'THREATS STAGING')
      : phase === 'combat'
        ? (active ? `${active} ACTIVE${pending ? ` / ${pending} INCOMING` : ''}` : pending ? `${pending} INCOMING` : 'NO ACTIVE THREATS')
        : phase === 'exploration' ? explorationThreat : phase === 'key' ? 'KEY REQUIRED' : 'EXIT SIGNAL LIVE';
    return {
      dungeon: true,
      sectorIndex: course.dungeonIndex,
      sectorCount: course.dungeonCount,
      sectorName: course.name,
      roomIndex,
      roomCount,
      roomName: activeRoom?.name || encounterRoom?.name || nextRoom?.name || `Threshold ${roomIndex + 1}`,
      activeRoomId,
      encounterRoomId,
      nextRoomId,
      roomSequence: sequence,
      completedRoomIds: Array.isArray(state.roomsCompleted)?state.roomsCompleted:null,
      wave,
      waveCount,
      active,
      remaining,
      total,
      pending,
      state: phase,
      exitReady,
      progress,
      encounterProgress,
      sync: true,
      objective,
      subtitle,
      threat,
    };
  }
  // `roomProgression` is the live contract owned by room-progression.js. The
  // snake_case keys are retained only for older snapshots during migration.
  const hasLiveContract = !!run.roomProgression;
  const hasLegacyContract = !hasLiveContract && !!run.room_progression;
  const source = run.roomProgression || run.room_progression || {};
  const hasLiveSequence = Array.isArray(source.sequence) && source.sequence.length > 0;
  const read = (...keys) => {
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) return source[key];
    }
    return undefined;
  };
  const sectorId = String(read('sectorId', 'sector_id') ?? run.sectorId ?? run.course?.sectorId ?? 'bloodworks');
  const sector = CAMPAIGN_SECTORS.find(item => item.id === sectorId) || CAMPAIGN_SECTORS[Math.max(0, Math.min(CAMPAIGN_SECTORS.length - 1, Math.round(Number(read('sectorIndex', 'sector_index') ?? run.sectorIndex) || 0)))];
  const sectorIndex = clamp(read('sectorIndex', 'sector_index') ?? run.sectorIndex ?? sector?.index, 0, 99);
  const sectorCount = Math.max(1, Math.round(Number(read('sectorCount', 'sector_count') ?? run.sectorCount ?? CAMPAIGN_SECTORS.length)) || CAMPAIGN_SECTORS.length);
  const sequence = hasLiveSequence ? source.sequence : [];
  const roomCount = Math.max(1, sequence.length || (hasLiveContract ? Math.round(Number(read('roomCount', 'room_count')) || 1) : Math.round(Number(read('roomCount', 'room_count') ?? sectorCount)) || sectorCount));
  const requestedIndex = Math.round(Number(read('currentIndex', 'roomIndex', 'room_index')) || 0);
  const roomIndex = Math.max(0, Math.min(roomCount - 1, requestedIndex));
  const activeRoomId = String(read('activeRoomId', 'active_room_id') ?? sequence[roomIndex] ?? '');
  const indexedRoomId = sequence[roomIndex] ? String(sequence[roomIndex]) : '';
  const roomCatalog = roomCatalogFor(sectorId);
  const activeRoom = activeRoomId ? getRoom(activeRoomId) : null;
  const indexedRoom = indexedRoomId ? getRoom(indexedRoomId) : null;
  // A partially applied network snapshot can briefly disagree. Showing a
  // neutral sync label is safer than presenting the wrong authored room.
  const roomInCatalog = room => !!room && roomCatalog.some(item => item.id === room.id);
  const roomInSync = hasLiveContract
    ? (hasLiveSequence && roomInCatalog(activeRoom) && roomInCatalog(indexedRoom) && activeRoom.id === indexedRoom.id)
    : !hasLegacyContract || !hasLiveSequence || (roomInCatalog(activeRoom) && roomInCatalog(indexedRoom) && activeRoom.id === indexedRoom.id);
  const sectorName = String(read('sectorName', 'sector_name') ?? sector?.name ?? run.sectorName ?? run.course?.name ?? 'The Bloodworks');
  const roomName = hasLiveContract || hasLiveSequence
    ? (roomInSync ? String(activeRoom?.name || indexedRoom?.name || `Room ${roomIndex + 1}`) : 'ROOM SYNCING')
    : String(read('roomName', 'room_name', 'name') ?? sectorName);
  const waveCount = Math.max(1, Math.round(Number(read('waveCount', 'wave_count') ?? run.waveCount ?? 3)) || 3);
  const wave = clamp(read('wave', 'waveIndex', 'wave_index') ?? run.wave, 0, waveCount);
  const remaining = Math.max(0, Math.round(Number(read('threatRemaining', 'threat_remaining', 'remaining') ?? enemyCount(run))) || 0);
  const total = Math.max(0, Math.round(Number(read('threatTotal', 'threat_total', 'total') ?? enemyTotal(run))) || 0);
  const pending = Math.max(0, Math.round(Number(read('threatPending', 'threat_pending', 'pending') ?? run.director?.pending ?? 0)) || 0);
  const state = String(read('phase', 'state') ?? run.director?.state ?? 'combat').toLowerCase();
  const exitReady = hasLiveSequence ? state === 'exit' : Boolean(read('exitUnlocked', 'exit_unlocked', 'exit_ready', 'exitReady') ?? (wave >= waveCount && remaining === 0 && pending === 0));
  const completed = Array.isArray(source.completed) ? source.completed : [];
  const waveProgress = exitReady
    ? 1
    : (Math.max(0, wave - 1) + (total ? Math.max(0, total - remaining) / Math.max(1, total + pending) : 0)) / waveCount;
  const suppliedProgress = Number(read('progress', 'roomProgress', 'room_progress'));
  const progress = clamp(Number.isFinite(suppliedProgress)
    ? (suppliedProgress > 1 ? suppliedProgress / 100 : suppliedProgress)
    : hasLiveSequence
      ? (completed.length + (state === 'exit' ? 1 : waveProgress)) / roomCount
      : waveProgress, 0, 1);
  return {
    sectorIndex,
    sectorCount,
    sectorName,
    roomIndex,
    roomCount,
    roomName,
    wave,
    waveCount,
    active: Math.max(0, Math.round(Number(read('active', 'threatActive') ?? run.director?.active ?? remaining) || 0)),
    remaining,
    total,
    pending,
    state,
    exitReady,
    progress,
    sync: roomInSync,
    objective: String(read('objective', 'objective_text', 'objectiveText') ?? ''),
    subtitle: String(read('subtitle', 'subtext', 'statusText', 'status_text') ?? ''),
    threat: String(read('threat', 'threatText', 'threat_text') ?? ''),
  };
}

// Guidance describes the next local turn, not the straight-line direction to
// a remote room or one fleeing enemy. Engine waypoints own wall/door routing.
export function dungeonNavigationView(run={}){
 const state=run.dungeonProgression,nav=state?.navigation;
 if(!run.course?.dungeon||!nav)return{visible:false};
 const room=run.course.rooms?.find(room=>room.id===(state.currentEncounterRoomId||nav.roomId));
 const inside=state.activeRoomId===(state.currentEncounterRoomId||nav.roomId);
 const holding=nav.hold||nav.kind==='hold'||(nav.kind==='combat'&&inside);
 if(holding){
  const alive=state.encounter?.active??0,pending=state.encounter?.pending??0;
  return{visible:true,holding:true,bearing:0,label:alive?`Hold this room · ${alive} threats`:pending?'Hold this room · listen for the next approach':'Room secured'};
 }
 if(inside&&nav.kind==='advance')return{visible:true,holding:true,bearing:0,label:'Ready your weapon · watch the entrances'};
 if(nav.blocked||!nav.waypoint)return{visible:true,holding:true,bearing:0,label:'Route sealed · finish the current encounter'};
 const dx=nav.waypoint.x-run.x,dy=nav.waypoint.y-run.y;
 const bearing=Math.atan2(Math.sin(Math.atan2(dy,dx)-(run.angle||0)),Math.cos(Math.atan2(dy,dx)-(run.angle||0)));
 const magnitude=Math.abs(bearing),turn=magnitude>2.35?'Turn back':magnitude>.48?(bearing>0?'Turn right':'Turn left'):'Straight ahead';
 const meters=Math.max(1,Math.round(Math.hypot(dx,dy)*4));
 const returning=state.currentEncounterRoomId&&!inside;
 return{visible:true,holding:false,bearing,label:returning?`${turn} · return to ${room?.name||'the fight'}`:`${turn} · ${meters} m`};
}

export class UI {
  constructor({
    root = document.querySelector('#ui'),
    onStart = () => {},
    onHarbor = () => {},
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
    onSound = () => {},
  } = {}) {
    if (!root) throw new Error('The Last Dead UI requires #ui');
    this.root = root;
    this.callbacks = { onStart, onHarbor, onResume, onRestart, onMenu, onPause, onHost, onJoin, onAccept, onDisconnect, onSettings, onWeapon, onSound };
    this.prefs = loadPrefs();
    this.screen = 'menu';
    this.inputDevice = 'keyboard';
    this.run = null;
    this._toastTimer = 0;
    this._lastEventCount = 0;
    this._network = 'OFFLINE';
    this._roomCode = '';
    this._connectionBusy = false;
    this.debug = new URLSearchParams(location.search).has('debug');
    this._wireRoot();
    this._applyPrefs();
  }

  _wireRoot() {
    const hover = event => {
      const target = event.target.closest('button');
      if (target && !target.disabled && this.screen !== 'play' && !target.contains(event.relatedTarget)) this.callbacks.onSound('hover');
    };
    this.root.addEventListener('pointerover', hover);
    this.root.addEventListener('focusin', hover);
    this.root.addEventListener('keydown', event => {
      const drawer=this.root.querySelector('.settings-drawer.is-open');
      if(event.key!=='Tab'||!drawer)return;
      const controls=[...drawer.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    this.root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target || !this.root.contains(target)) return;
      const action = target.dataset.action;
      if (target.disabled) return;
      if (['forward', 'back', 'left', 'right', 'jump', 'dash', 'slide', 'fire', 'alt', 'parry', 'weapon', 'look'].includes(action)) return;
      event.preventDefault();
      this.callbacks.onSound(['menu','close-settings','disconnect'].includes(action) ? 'cancel' : ['start','restart','resume','accept'].includes(action) ? 'confirm' : 'ui');
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
      this.callbacks.onSound('toggle');
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
      case 'harbor': this.callbacks.onHarbor(); break;
      case 'reload': window.location.reload(); break;
      case 'resume': this.callbacks.onResume(); break;
      case 'records': {
        const archive=this.root.querySelector('.records-archive');
        if(archive){archive.hidden=!archive.hidden;target.setAttribute('aria-expanded',String(!archive.hidden));}
        break;
      }
      case 'restart': this.callbacks.onRestart(); break;
      case 'menu': this.callbacks.onMenu(); break;
      case 'pause': this.callbacks.onPause(); break;
      case 'host': this.callbacks.onHost(); break;
      case 'join': this.callbacks.onJoin(this.root.querySelector('[name="joinCode"]')?.value.trim() || this.root.querySelector('[name="joinOffer"]')?.value.trim() || ''); break;
      case 'accept': {
        const acceptCode = this.root.querySelector('[name="acceptAnswer"]')?.value.trim() || this.root.querySelector('[name="answer"]')?.value.trim() || '';
        this.callbacks.onAccept(acceptCode);
        break;
      }
      case 'disconnect': this.callbacks.onDisconnect(); break;
      case 'coop-toggle': this._toggleCoop(); break;
      case 'settings': this._setSettingsOpen(true); break;
      case 'close-settings': this._setSettingsOpen(false); break;
      case 'copy-offer': this._copyCode('roomCode', target); break;
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
    for (const name of ['roomCode', 'offer', 'answer', 'joinCode', 'joinOffer', 'acceptAnswer']) {
      const input = this.root.querySelector('[name="' + name + '"]');
      if (input) input.value = '';
    }
    this._roomCode = '';
    this._syncCoopControls();
    this._setNetworkMessage('Co-op code cleared.', '');
  }

  _syncCoopControls() {
    const panel = this.root.querySelector('[data-coop-panel]');
    if (!panel) return;
    const busy = this._connectionBusy === true;
    const roomCode = this._roomCode || panel.querySelector('[name="roomCode"]')?.value.trim() || '';
    panel.setAttribute('aria-busy', String(busy));
    panel.querySelectorAll('button').forEach((button) => {
      const action = button.dataset.action;
      button.disabled = action === 'disconnect' ? false : action === 'copy-offer' ? !roomCode : busy;
    });
    const joinCode = panel.querySelector('[name="joinCode"]');
    if (joinCode) joinCode.disabled = busy;
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
    if (open) panel.querySelector('[name="joinCode"], input, button')?.focus();
  }

  _setSettingsOpen(open) {
    const drawer = this.root.querySelector('.settings-drawer');
    if (!drawer) return;
    if(open&&!drawer.classList.contains('is-open'))this._settingsReturnFocus=this.root.contains(document.activeElement)?document.activeElement:this.root.querySelector('.screen button');
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    drawer.inert=!open;
    this.root.querySelectorAll('.screen').forEach(screen=>{screen.inert=open;});
    this.root.dataset.settingsOpen=String(open);
    if (open) drawer.querySelector('input, button')?.focus();
    else if(this._settingsReturnFocus?.isConnected)this._settingsReturnFocus.focus();
  }

  escape(){if(this.root.querySelector('.settings-drawer.is-open')){this._setSettingsOpen(false);return true;}return false;}

  setInputDevice(device){this.inputDevice=device==='gamepad'?'gamepad':'keyboard';this.root.dataset.inputDevice=this.inputDevice;const key=this.root.querySelector('[data-resume-key]');if(key)key.textContent=this.inputDevice==='gamepad'?'START':'ESC';}

  gamepadNavigate(action){
    if(action==='cancel'){
      if(this.escape())return true;
      for(const selector of ['.field-guide','.records-archive','[data-coop-panel]']){
        const panel=this.root.querySelector(selector);
        if(panel&&!panel.hidden){panel.hidden=true;const trigger=selector==='.field-guide'?'[data-action="guide"]':`[aria-controls="${panel.id}"]`;this.root.querySelector(trigger)?.setAttribute('aria-expanded','false');return true;}
      }
      return false;
    }
    const settings=this.root.querySelector('.settings-drawer.is-open'),guide=this.root.querySelector('.field-guide');
    if(guide&&!guide.hidden&&!settings){
      if(action==='up'||action==='down'){
        // The sheet lives inside the existing menu rather than its own overlay.
        // Scroll whichever ancestor actually owns overflow without moving focus
        // away from Controls, so A can close the same sheet after reading it.
        let scroller=null;
        for(let node=guide;node&&this.root.contains(node);node=node.parentElement){
          if(node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(getComputedStyle(node).overflowY)){scroller=node;break;}
        }
        if(scroller){const step=Math.max(120,Math.min(320,scroller.clientHeight*.45));scroller.scrollTop=clamp(scroller.scrollTop+(action==='down'?step:-step),0,scroller.scrollHeight-scroller.clientHeight);}
        return true;
      }
      if(action==='confirm'){
        const toggle=this.root.querySelector('[data-action="guide"]');
        if(toggle){toggle.focus({preventScroll:true});toggle.click();return true;}
      }
    }
    const scope=settings||this.root.querySelector('.screen:not([hidden])')||this.root;
    const controls=[...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
      .filter(node=>!node.closest('[hidden],.hud,.touch-layer')&&node.getClientRects().length>0);
    if(!controls.length)return false;
    const focused=controls.indexOf(document.activeElement),current=controls[focused<0?0:focused];
    if(action==='confirm'){
      current.focus({preventScroll:true});
      if(current.tagName==='BUTTON'||current.type==='checkbox')current.click();
      return true;
    }
    if((action==='left'||action==='right')&&focused>=0&&current.type==='range'){
      const delta=action==='right'?1:-1,step=Number(current.step)||1;
      current.value=String(clamp(Number(current.value)+delta*step,Number(current.min)||0,Number(current.max)||100));
      current.dispatchEvent(new Event('input',{bubbles:true}));return true;
    }
    const delta=action==='up'||action==='left'?-1:1;
    const index=focused<0?0:(focused+delta+controls.length)%controls.length;
    controls[index].focus({preventScroll:true});if(settings)controls[index].scrollIntoView({block:'nearest',inline:'nearest'});return true;
  }

  _updatePref(name, value) {
    if (!(name in DEFAULT_PREFS)) return;
    let next = value;
    if (typeof DEFAULT_PREFS[name] === 'number') next = clamp(value, name === 'sensitivity' ? 0.25 : 0, name === 'sensitivity' ? 2 : 1);
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
    this.root.querySelectorAll('[data-setting-value]').forEach((output) => {
      const name = output.dataset.settingValue;
      const value = Number(this.prefs[name]) || 0;
      output.textContent = name === 'sensitivity' ? `${value.toFixed(2)}x` : `${Math.round(value * 100)}%`;
    });
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
    const audioSlider = (name, title, description) => `<div class="setting-row"><div class="setting-copy"><strong>${title}</strong><span>${description}</span></div><output class="setting-value" data-setting-value="${name}">${Math.round(Number(this.prefs[name]) * 100)}%</output><input type="range" min="0" max="1" step="0.01" value="${esc(this.prefs[name])}" data-setting="${name}" aria-label="${title}" /></div>`;
    return `<aside class="settings-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Settings" inert>
      <div class="settings-heading"><h2>Settings</h2><button class="icon-button" type="button" data-action="close-settings" aria-label="Close settings">x</button></div>
      <p class="settings-note">Audio changes apply immediately and save on this device.</p>
      <div class="setting-section-title">Audio mix</div>
      ${audioSlider('volume', 'Master volume', 'All game audio')}
      ${audioSlider('sfxVolume', 'Sound effects', 'Weapons, impacts, and movement')}
      ${audioSlider('voiceVolume', 'Enemy voices', 'Attacks, moans, and deaths')}
      ${audioSlider('musicVolume', 'Music', 'Menu and gameplay score')}
      ${audioSlider('ambienceVolume', 'Ambience', 'Room tone and atmosphere')}
      ${audioSlider('uiVolume', 'Interface', 'Menus and setting cues')}
      <div class="setting-section-title">Gameplay</div>
      <div class="setting-row"><div class="setting-copy"><strong>Look sensitivity</strong></div><output class="setting-value" data-setting-value="sensitivity">${Number(this.prefs.sensitivity).toFixed(2)}x</output><input type="range" min="0.25" max="2" step="0.05" value="${esc(this.prefs.sensitivity)}" data-setting="sensitivity" aria-label="Look sensitivity" /></div>
      <label class="setting-row"><span class="setting-copy"><strong>Reduced motion</strong></span><span class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.prefs.reducedMotion ? 'checked' : ''} /><span class="toggle-track"></span></span></label>
      <label class="setting-row"><span class="setting-copy"><strong>Gore effects</strong></span><span class="toggle"><input type="checkbox" data-setting="gore" ${this.prefs.gore ? 'checked' : ''} /><span class="toggle-track"></span></span></label>
      <label class="setting-row"><span class="setting-copy"><strong>Adaptive exposure</strong></span><span class="toggle"><input type="checkbox" data-setting="bodycam" ${this.prefs.bodycam ? 'checked' : ''} /><span class="toggle-track"></span></span></label>
      <label class="setting-row"><span class="setting-copy"><strong>Auto-run</strong></span><span class="toggle"><input type="checkbox" data-setting="autoRun" ${this.prefs.autoRun ? 'checked' : ''} /><span class="toggle-track"></span></span></label>

    </aside>`;
  }

  menu() {
    this.clearLoading();
    this.screen='menu';this.root.dataset.experience='standard';this.root.dataset.screen='menu';this.root.dataset.settingsOpen='false';this.run=null;this._roomCode='';this._connectionBusy=false;
    this.root.innerHTML=`<section class="screen menu-screen" aria-label="The Last Dead main menu">
     <div class="cinema-frame" aria-hidden="true"><span>BLACKWATER</span><span>NO ONE LEAVES ALONE</span></div>
     <div class="menu-shell"><div class="menu-copy"><div class="brand-lockup"><p class="menu-eyebrow">SOMETHING REMEMBERS YOU.</p><h1 class="brand-title"><span>THE LAST</span><em>DEAD</em></h1><p class="menu-whisper">NO FURTHER TRANSFERS.</p></div></div>
     <nav class="menu-actions" aria-label="Main menu"><button class="primary-button start-button" type="button" data-action="start"><span class="menu-choice">PLAY CAMPAIGN<small>BLACKWATER / OPEN WORLD</small></span><span class="menu-enter-arrow" aria-hidden="true">⟶</span></button>
      ${this.devEnabled?'<button class="menu-link dev-mode-button" type="button" data-dev-inspect><span>FREE CAMERA <small>DEV</small></span><kbd class="game-key">F2</kbd></button>':''}
          <div class="coop-access"><button class="coop-toggle" type="button" data-action="coop-toggle" aria-expanded="false" aria-controls="coop-form"><span><b>CO-OP</b></span><i data-coop-icon>+</i></button>
                        <div class="coop-panel" id="coop-form" data-coop-panel hidden aria-label="Co-op connection">
              <div class="network-panel">
                <div class="network-row network-heading"><span class="field-label">CO-OP ARENA</span><span class="network-state" data-network-message role="status">Ready</span></div>
                <div class="network-row network-code-row"><input class="code-input room-code" name="roomCode" autocomplete="off" spellcheck="false" placeholder="Host code" aria-label="Room code" readonly /><button class="network-button" type="button" data-action="copy-offer">Copy</button></div>
                <div class="network-row network-actions" data-coop-actions><button class="network-button" type="button" data-action="host">Host</button><button class="network-button" type="button" data-action="disconnect">Cancel</button></div>
                <div class="network-row network-join-row"><input class="code-input" name="joinCode" autocomplete="off" spellcheck="false" placeholder="Enter 6-character code" aria-label="Join code" maxlength="6" inputmode="text" autocapitalize="characters" /><button class="network-button" type="button" data-action="join">Join</button></div>
              </div>
            </div>
          </div>

      <button class="menu-link" type="button" data-action="settings">SETTINGS</button>
      <button class="menu-link" type="button" data-action="guide" aria-expanded="false"><span class="guide-open-label">CONTROLS</span><span class="guide-close-label">Close controls</span></button>
  <div class="field-guide" hidden aria-labelledby="field-guide-title"><header class="guide-heading"><small>BLACKWATER / FIELD MANUAL</small><h2 id="field-guide-title">Controls</h2></header><div class="guide-sections"><section class="guide-section"><h3><small>01</small>Movement & weapons</h3><div class="guide-controls"><b>WASD</b><span>Move / aim</span><b>SPACE / SHIFT</b><span>Jump / dash</span><b>CTRL / F / E</b><span>Slide / parry / tether</span><b>RIGHT CLICK</b><span>Aim / steady firearm · heavy strike with melee</span><b>1 2 3 4 5 6 7 8</b><span>Switch weapons</span><b>R</b><span>Weapon status · weapons replenish automatically; no reload needed</span><b>C / MIDDLE CLICK</b><span>Breach underbarrel grenade launcher</span><b>ESC</b><span>Pause / resume · restart from the pause menu</span><b>ENTER AFTER A RUN</b><span>Retry after death or completion</span></div></section><section class="guide-section"><h3><small>02</small>Close combat & extraction</h3><div class="guide-controls"><b>F CLOSE UP</b><span>Chop an arm; twist a weakened, staggered target's neck. During a bite, parry twice to rip free.</span><b>V / R3 CLOSE UP</b><span>Pierce a wounded, staggered target's chest, pull the heart, then release the body (15 energy)</span><b>G / X (TAP)</b><span>Look down to grab a nearby rat; tap again to throw</span><b>F / RB + RAT</b><span>Feed a held rat into a close zombie; aim down for its stomach</span><b>HOLD Q / VIEW</b><span>Operate chapter machinery; keep moving and fighting</span><b>HOLD G</b><span>Drain a corpse, then remove its heart to bank points</span></div></section><section class="guide-section"><h3><small>03</small>Standard controller</h3><div class="guide-controls"><b>L / R STICK</b><span>Move / look · standard-mapped controller</span><b>RT / LT</b><span>Fire / aim · LT with melee: heavy strike</span><b>RB / LB</b><span>Parry, counter or bite escape / tether</span><b>A / B / L3</b><span>Jump / hold slide / dash</span><b>HOLD X</b><span>Extract a corpse and bank points</span><b>Y / D-PAD</b><span>Cycle weapons</span><b>LT + RB</b><span>Breach underbarrel launcher while aiming</span><b>START</b><span>Pause / resume · menus: stick or D-pad, A confirm, B back</span></div></section></div></div>
     </nav></div><div class="cinema-footer" aria-hidden="true"><span>KEEP BREATHING.</span><span>DON'T LOOK AWAY.</span></div>
    </section>${this._settingsMarkup()}`;
    this._applyPrefs();this._syncCoopControls();queueMicrotask(()=>this.root.querySelector('.start-button')?.focus({preventScroll:true}));return this;
  }

  pause() {
    this.screen = 'pause';this.root.dataset.screen='pause';this.root.querySelectorAll('.settings-drawer').forEach(n=>n.remove());
    const old = this.root.querySelector('.screen');
    if (old) old.remove();
    const story=this.run?.course?.dungeon===true;
    const records=this.run?.storyRecords||[];
    const total=(this.run?.course?.evidenceTotal||0)+(this.run?.course?.dungeonCount||0);
    const journeyArchive=this.run?.journey ? `<div class="journey-archive"><span class="kicker">NO FURTHER TRANSFERS / JOURNEY</span>${this.run.journey.completed.map(chapter=>`<article class="record-entry"><strong>${esc(chapter.title)}</strong><p>${esc(chapter.aftermath)}</p></article>`).join('')}${this.run.journey.log.map(entry=>`<article class="record-entry"><span>${esc(entry.speaker)}</span><p>${esc(entry.text)}</p></article>`).join('')}</div>`:'';
    const archive=records.length
      ? records.map(record=>`<article class="record-entry"><span>${String(record.floorIndex+1).padStart(2,'0')} / ${esc(record.floorName)} · ${record.kind==='key'?'KEY RECORD':'FOUND EVIDENCE'}</span><strong>${esc(record.title)}</strong><p>${esc(record.text)}</p></article>`).join('')
      : '<p class="records-empty">No records recovered yet. Check side rooms and sealed caches as you descend.</p>';
    this.root.insertAdjacentHTML('afterbegin', `<section class="screen pause-screen${story?' is-story':''}" aria-label="Paused">
      <div class="pause-backdrop"></div><div class="pause-layout"><div class="pause-card"><span class="kicker">THE LAST DEAD / PAUSED</span><h2>${this.run?.lowTide?'SIGNAL<br><em>PAUSED.</em>':'STILL<br><em>BREATHING.</em>'}</h2><p class="pause-copy">${this.run?.lowTide?(this.run.lowTide.shelter?'Your checkpoint is at Netmakers. Open B / Journal to review recovered records.':'Claim Netmakers safehouse to secure your first checkpoint. Open B / Field Map to find your way.'):story?'Follow the signal through receiving, isolation, burial and the bells to stop further transfers. Side-room records reveal what happened along the way.':'The arena is waiting. Pick a line, find a target, and keep your momentum when the signal returns.'}</p><div class="pause-actions"><button class="primary-button" type="button" data-action="resume"><span>RESUME</span><kbd class="game-key" data-resume-key>${this.inputDevice==='gamepad'?'START':'ESC'}</kbd></button>${story?`<button class="secondary-button" type="button" data-action="records" aria-controls="story-records" aria-expanded="false">RECORDS ${records.length} / ${total}</button>`:''}<button class="secondary-button" type="button" data-action="restart">${this.run?.lowTide?(this.run.lowTide.shelter?'RETURN TO CHECKPOINT':'RESTART FROM DOCKS'):'RESTART RUN'}</button><button class="secondary-button" type="button" data-action="settings">SETTINGS</button>${this.devEnabled?'<button class="secondary-button" type="button" data-dev-inspect><span>FREE CAMERA</span><kbd class="game-key">F2</kbd></button>':''}<button class="text-button" type="button" data-action="menu">RETURN TO TITLE</button></div></div>${story?`<aside class="records-archive" id="story-records" aria-label="Recovered records" hidden><span class="kicker">RECOVERED EVIDENCE / ${records.length} OF ${total}</span><h3>THE DESCENT<br><em>REMEMBERS.</em></h3><div class="records-list">${journeyArchive}${archive}</div></aside>`:''}</div>
    </section>${this._settingsMarkup()}`);
    this._applyPrefs();
    return this;
  }

  /** Remove modal UI and return input focus to the arena. */
  play() {
    this.clearLoading();
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

  loading(stage = 'Preparing the campaign', failed = false) {
    let overlay = this.root.querySelector('.descent-loading');
    if (!overlay) {
      this._loadingInert = [...this.root.children].map(node => [node, node.inert]);
      for (const [node] of this._loadingInert) node.inert = true;
      overlay = document.createElement('section');
      overlay.className = 'descent-loading';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'descent-loading-title');
      overlay.tabIndex = -1;
      overlay.innerHTML = `<div class="descent-loading-copy"><span class="loading-kicker">THE LAST DEAD</span><h2 id="descent-loading-title">LOADING<br><em>THE WORLD</em></h2><div class="loading-track" aria-hidden="true"><span></span></div><p class="loading-stage" role="status" aria-live="polite"></p><p class="loading-note">Keep breathing. You'll enter when it's ready.</p><button class="primary-button" data-action="reload" hidden>RELOAD AND RETRY</button></div>`;
      this.root.append(overlay);
      overlay.focus({ preventScroll: true });
    }
    const status = overlay.querySelector('.loading-stage');
    if (status.textContent !== stage) status.textContent = stage;
    overlay.classList.toggle('is-failed', failed);
    overlay.querySelector('.loading-track').hidden = failed;
    overlay.querySelector('.loading-note').hidden = failed;
    overlay.querySelector('[data-action="reload"]').hidden = !failed;
    if (failed) {
      overlay.querySelector('h2').textContent = 'UNABLE TO LOAD THE WORLD';
      overlay.querySelector('button').focus({ preventScroll: true });
    }
    return this;
  }

  clearLoading() {
    this.root.querySelector('.descent-loading')?.remove();
    for (const [node, inert] of this._loadingInert || []) node.inert = inert;
    this._loadingInert = null;
    return this;
  }

  /** Briefly pulse the center reticle after a hit, kill, or parry event. */
  hit(type='hit') {
    this._hitUntil=performance.now()+(this.prefs.reducedMotion?80:180);
    this._hitType=type;const crosshair=this.root.querySelector('[data-hud="crosshair"]');crosshair?.classList.add('is-hit');crosshair?.classList.toggle('is-kill',type==='kill');crosshair?.classList.toggle('is-parry',type==='parry');return this;
  }
  combatEvent(event={}) {
    if(['hit','kill','parry'].includes(event.type))this.hit(event.type);
    if(event.type==='kill'||event.type==='parry'||event.type==='extract-complete'){
      const feed=this.root.querySelector('.combat-feed');if(feed){const line=document.createElement('span');line.textContent=event.type==='parry'?'+ PARRY':event.type==='extract-complete'?`+ ${Math.round(Number(event.points)||0)} BANKED`:'+ KILL';line.className=event.type;feed.prepend(line);while(feed.children.length>3)feed.lastElementChild.remove();setTimeout(()=>line.remove(),1800);}
    }
  }
  finish(run = {}, win = run.mode === 'win') {
    this.screen = win ? 'win' : 'dead';this.root.dataset.screen=this.screen;this._setSettingsOpen(false);
    this._clearToasts();
    this.run = run;
    this.root.dataset.experience=run.lowTide?'low-tide':'standard';
    if(run.lowTide){
      const records=lowTideJournal(run),home=run.lowTide.shelter;
      this.root.dataset.experience='low-tide';
      this.root.querySelector('.screen')?.remove();
      this.root.insertAdjacentHTML('afterbegin', `<section class="screen finish-screen low-tide-recovery" aria-label="Low Tide recovery"><div class="finish-backdrop"></div><div class="finish-card"><span class="kicker">BLACKWATER / SIGNAL LOST</span><h2>THE TIDE<br><em>KEEPS COUNT.</em></h2><p class="finish-copy">${home?'Your last checkpoint is at Netmakers. Return with your saved records and equipment.':'No safehouse established. Return to the docks and find Netmakers to secure your first checkpoint.'}</p><dl class="recovery-ledger"><div><dt>RETURN POINT</dt><dd>${home?'Netmakers safehouse':'Dock arrival'}</dd></div><div><dt>RECOVERED RECORDS</dt><dd>${records.length} / 7</dd></div></dl><p class="recovery-objective">${esc(lowTideObjective(run).label)}</p><div class="finish-actions"><button class="primary-button" type="button" data-action="restart">${home?'RETURN TO CHECKPOINT':'TRY AGAIN'} <span>ENTER ↵</span></button><button class="secondary-button" type="button" data-action="menu">Return to title</button></div></div></section>`);
      return this;
    }
    const courseName = run.course?.name || 'The Bloodworks';
    const fatalBite=!win&&run.bite?.phase==='terminal';
    const kills = Number(run.kills) || 0;
    const dungeon = run.course?.dungeon === true;
    const harbor = run.course?.harbor === true;
    const wave = harbor ? Math.min(3,run.backpack?.weaponPickups?.length||0) : dungeon ? (win ? run.dungeonProgression?.floorsCleared || run.course.dungeonIndex + 1 : run.course.dungeonIndex + 1) : (win ? (run.sectorCount||3) : (run.sectorIndex||0));
    const total = dungeon ? run.course.dungeonCount : 3;
    const progressLabel = harbor ? 'weapons recovered' : dungeon ? 'floors cleared' : 'sectors cleared';
    const endingCopy = run.lowTide ? (run.lowTide.shelter?'Return to the Netmakers checkpoint. Saved records, equipment and your stash remain. The streets will be dangerous again.':'Claim Netmakers to establish your first checkpoint. Your search begins again at the docks.') : harbor ? (win ? 'You reached the ferry with your recovered weapons. The harbor expedition is complete. Start a fresh run to try another route.' : 'The quarantine holds your supplies. Start a fresh expedition and find a safer route to the ferry.') : dungeon
      ? win
        ? run.journey ? (run.journey.completed.some(chapter=>chapter.chapterId==='names') ? 'The missing evacuees were trapped in the return circuit. Their names are restored; further transfers have stopped. You leave through the final threshold carrying the record of who they were.' : 'Further transfers have stopped. The engine is contained, and the final threshold opens.') : 'The bells go quiet. The breach is sealed below, and for the first time the dead stay dead.'
        : 'The descent takes another witness. The records and the weapons remain below for whoever follows.'
      : win
        ? `${courseName} is quiet for now. Keep the style high and make the next pass hurt more.`
        : 'The arena keeps moving. Go again with a faster line, a sharper parry, and no respect for the incoming fire.';
    const style = Number(run.styleTotal) || Number(run.style) || 0;
    const combo = Number(run.bestCombo) || Number(run.combo) || 0;
    const time = Number(run.time) || 0;
    const old = this.root.querySelector('.screen');
    if (old) old.remove();
    this.root.insertAdjacentHTML('afterbegin', `<section class="screen finish-screen" aria-label="${win ? dungeon ? 'Descent cleared' : 'Arena cleared' : 'Run over'}"><div class="finish-backdrop"></div><div class="finish-card ${win ? 'is-win' : 'is-dead'}"><span class="kicker">${win ? 'SUBJECT COMPLETE // EXIT SIGNAL FOUND' : fatalBite ? 'NECK BITE // SIGNAL LOST' : 'THE DESCENT CLAIMS ANOTHER.'}</span><h2>${win ? 'DEBT <em>PAID.</em>' : fatalBite ? 'TORN <em>APART.</em>' : 'YOU ARE <em>DEAD.</em>'}</h2><p class="finish-copy">${esc(fatalBite?'It caught you at the throat. Fight free faster on the next descent.':endingCopy)}</p><div class="results"><div class="result"><strong>${fmt(time, 1)}s</strong><span class="result-label">run time</span></div><div class="result"><strong>${String(kills).padStart(2, '0')}</strong><span class="result-label">eliminated</span></div><div class="result"><strong>${String(combo).padStart(2, '0')}</strong><span class="result-label">best combo</span></div></div><div class="results"><div class="result"><strong>${String(wave).padStart(2, '0')} / ${String(total).padStart(2, '0')}</strong><span class="result-label">${progressLabel}</span></div><div class="result"><strong>${Math.round(style)}</strong><span class="result-label">style earned</span></div><div class="result"><strong>${esc(run.rank || (win ? 'S' : 'D'))}</strong><span class="result-label">final rank</span></div></div><div class="finish-actions"><button class="primary-button" type="button" data-action="restart">${win ? 'Run it back' : 'RISE AGAIN'} <span>ENTER ↵</span></button><button class="secondary-button" type="button" data-action="menu">Return to menu</button></div></div></section>`);
    return this;
  }

  _hudMarkup() {
    return `<div class="hud" aria-label="The Last Dead combat HUD">
      <div class="blood-veil" aria-hidden="true"><svg viewBox="0 0 1600 900" preserveAspectRatio="none"><path d="M0 0H390L270 24L210 13L188 70L165 35L139 118L112 46L75 190L52 84L0 256ZM1600 0H1300L1380 24L1395 86L1420 34L1460 151L1482 66L1525 218L1554 92L1600 267ZM0 900V580L28 689L61 648L43 738L96 716L88 810L158 773L149 868L280 900ZM1600 900V572L1575 665L1542 640L1550 752L1509 734L1496 841L1433 801L1418 884L1310 900Z"/><g><ellipse cx="57" cy="340" rx="9" ry="25"/><ellipse cx="1518" cy="392" rx="12" ry="33"/><ellipse cx="233" cy="53" rx="8" ry="19"/><ellipse cx="1384" cy="850" rx="13" ry="8"/></g></svg></div>
      <div class="hud-top"><div class="hud-cluster"><div class="objective" data-progression="room">
        <div class="objective-context"><span class="hud-label" data-hud="sector">I / BLOODWORKS</span><span class="objective-divider" aria-hidden="true">/</span><span class="room-index" data-hud="room-index">ROOM 01 / 04</span></div>
        <strong class="room-name" data-hud="room-name">INTAKE BAY</strong>
        <div class="objective-line"><strong class="hud-value" data-hud="objective">CLEAR INTAKE BAY</strong><span class="room-threat" data-hud="room-threat">THREAT ACTIVE</span></div>
        <span class="hud-sub" data-hud="objective-sub">HUNT THEM DOWN</span>
        <div class="route-guidance" data-hud="route-guidance" hidden><i data-hud="route-bearing" aria-hidden="true">↑</i><span data-hud="route-label"></span></div>
        <div class="objective-progressline"><div class="objective-progress"><i data-hud="objective-progress"></i></div><span class="room-progress-label" data-hud="room-progress-label">00% CLEAR</span></div>
        <aside class="journey-transmission" data-journey-transmission hidden><span data-hud="journey-source"></span><p data-hud="journey-text"></p></aside>
        <div class="room-route" data-hud="room-route" role="progressbar" aria-label="Encounter progression" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
      </div></div>
       <div class="run-clock"><span data-hud="run-clock">00:00</span><small class="hud-kills" data-hud="kills" aria-label="Kills">KILLS 00</small><small data-hud="network">SOLO</small><small data-hud="fps" hidden></small></div>
       <div class="hud-cluster"><div class="rank"><span class="rank-caption">STYLE</span><strong data-hud="rank">D</strong><div class="rank-meter"><i data-hud="style-fill"></i></div><span data-hud="style-label">GET CLOSE.</span><span class="style-pending" data-hud="style-pending" hidden>0 UNBANKED</span><div class="combat-feed" aria-live="off"></div></div><button class="hud-pause" type="button" data-action="pause" aria-label="Pause game">II</button></div></div>
      <div class="crosshair" data-hud="crosshair" aria-hidden="true"><span class="hitmarker"></span><i></i><b></b></div>
      <aside class="bite-prompt" data-bite-prompt role="status" aria-live="polite" hidden><span class="bite-kicker" data-hud="bite-kicker">CLOSE CONTACT</span><strong data-hud="bite-label">BREAK THE GRIP</strong><span class="bite-instruction" data-hud="bite-instruction">${this.inputDevice==='gamepad'?'RB':'F'} PARRY / MOVE / KEEP FIRING</span><span class="bite-meter" aria-hidden="true"><i data-hud="bite-fill"></i></span></aside>
      <aside class="journey-prompt" data-journey-prompt hidden><strong data-hud="journey-action"></strong><span class="journey-meter"><i data-hud="journey-fill"></i></span></aside>
      <div class="extraction-prompt" data-extraction-prompt hidden><span class="extraction-kicker">CORPSE EXTRACTION</span><strong data-hud="extraction-label">HOLD ${this.inputDevice==='gamepad'?'X':'G'} / DRAIN BODY</strong><span class="extraction-meter"><i data-hud="extraction-fill"></i></span></div>
      <div class="hud-bottom"><div class="hud-bottom-left"><div class="vitals"><div class="vitals-line"><span class="life-dial" aria-hidden="true"><svg class="life-sigil" viewBox="0 0 96 96"><circle class="life-rim" cx="48" cy="48" r="44"/><circle class="life-track" cx="48" cy="48" r="35"/><circle class="life-arc" cx="48" cy="48" r="35" pathLength="100"/><path class="life-skull" d="M34 44c-2-11 3-19 14-19s16 8 14 19l-5 7v10H39V51Z"/><path class="life-cut" d="m37 38 8 3-3 7-7-3Zm22 0-8 3 3 7 7-3ZM48 45l-4 8h8M43 56v5m10-5v5"/><path class="life-tide" d="M29 66q6-4 12 0t13 0 13 0M35 71q6-4 12 0t13 0"/></svg></span><strong data-hud="health" aria-label="Health">100</strong><span class="vital-caption">LIFE</span></div><div class="meter health-meter"><i class="health-trail" data-hud="health-trail"></i><i class="health-fill" data-hud="health-fill"></i></div><span class="wound-status" data-hud="wounds" hidden></span><span class="critical-label">FEED OR DIE</span></div><div class="dash-cluster"><div class="dash-pips"><i class="dash-pip" data-dash="0"></i><i class="dash-pip" data-dash="1"></i><i class="dash-pip" data-dash="2"></i></div><span>DASH</span></div></div>
       <div class="hud-bottom-right"><div class="weapon-card"><div class="weapon-line"><span class="weapon-slot" data-hud="weapon-slot">01</span><strong class="weapon-name" data-hud="weapon">OSSUARY</strong></div><span class="weapon-hint" data-hud="weapon-hint">PRECISION FIRE</span><span class="arsenal-count" data-hud="arsenal-count">FULL ARSENAL</span><div class="weapon-rack">${WEAPON_NAMES.map((name,i)=>`<button type="button" data-action="equip" data-weapon="${i}" data-weapon-slot="${i}" aria-label="Equip ${name}">${weaponSigil(i)}<span>${i+1}</span></button>`).join('')}</div><span class="weapon-foot"><span data-hud="weapon-resource">RMB / AIM</span><span data-hud="cooldown-label">READY</span></span><div class="rifle-meter" data-rifle-meter-wrap hidden><i data-hud="rifle-meter"></i></div><div class="cooldown"><i data-hud="cooldown"></i></div></div></div></div>
    </div>`;
  }

  _touchMarkup() {
    return `<div class="touch-layer" aria-label="Touch controls" hidden><div class="touch-look" data-touch-look="true" aria-label="Drag to look"></div><div class="touch-cluster touch-left"><button class="touch-button dash" type="button" data-action="dash" aria-label="Dash">DASH</button><button class="touch-button forward" type="button" data-action="forward" aria-label="Move forward">UP</button><button class="touch-button left" type="button" data-action="left" aria-label="Strafe left">LEFT</button><button class="touch-button back" type="button" data-action="back" aria-label="Move backward">DOWN</button><button class="touch-button right" type="button" data-action="right" aria-label="Strafe right">RIGHT</button><button class="touch-button slide" type="button" data-action="slide" aria-label="Slide or slam">SLAM</button></div><button class="touch-operate" type="button" data-action="interact" aria-label="Hold to operate chapter machinery" hidden>HOLD<br>OPERATE</button><button class="touch-extract" type="button" data-action="harvest" aria-label="Hold to extract blood and heart" hidden>HOLD<br>EXTRACT</button><button class="touch-attachment" type="button" data-action="attachment" aria-label="Fire underbarrel grenade launcher" hidden>GRENADE</button><div class="touch-cluster touch-right"><button class="touch-button weapon" type="button" data-action="weapon" aria-label="Switch weapon">WEAP</button><button class="touch-button hook" type="button" data-action="hook" aria-label="Tether or pull">HOOK</button><button class="touch-button alt" type="button" data-action="alt" aria-label="Aim firearm or heavy melee strike">AIM</button><button class="touch-button parry" type="button" data-action="parry" aria-label="Punch or parry">PARRY</button><button class="touch-button fire" type="button" data-action="fire" aria-label="Fire">FIRE</button><button class="touch-button jump" type="button" data-action="jump" aria-label="Jump">JUMP</button></div></div>`;
  }

  _updateRoomRoute(progression) {
    const route = this.root.querySelector('[data-hud="room-route"]');
    if (!route) return;
    const stageLabel = 'Room';
    const count = Math.max(1, Math.min(12, Math.round(progression.roomCount) || 1));
    if (this._roomRouteCount !== count || route.children.length !== count) {
      route.replaceChildren(...Array.from({ length: count }, (_, index) => {
        const step = document.createElement('i');
        step.className = 'room-step';
        step.dataset.roomStep = String(index);
        step.setAttribute('aria-hidden', 'true');
        return step;
      }));
      this._roomRouteCount = count;
    }
    if (!progression.sync) {
      route.querySelectorAll('[data-room-step]').forEach(step => {
        step.classList.remove('is-complete', 'is-active');
        step.style.setProperty('--step-progress', '0%');
      });
      route.setAttribute('aria-valuenow', '0');
      route.setAttribute('aria-label', `${stageLabel} progression synchronizing`);
      return;
    }
    const current = Math.max(0, Math.min(count - 1, Math.round(progression.roomIndex) || 0));
    const fraction = Math.max(0, Math.min(1, Number.isFinite(Number(progression.encounterProgress))
      ? Number(progression.encounterProgress)
      : progression.progress * count - current));
    route.querySelectorAll('[data-room-step]').forEach((step, index) => {
      const complete = progression.completedRoomIds?progression.completedRoomIds.includes(progression.roomSequence[index]):index < current;
      step.classList.toggle('is-complete', complete);
      step.classList.toggle('is-active', index === current);
      step.style.setProperty('--step-progress', complete ? '100%' : index === current ? `${Math.round(fraction * 100)}%` : '0%');
    });
    const overall = ((current + fraction) / count) * 100;
    route.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(100, overall)))));
    route.setAttribute('aria-label', `${stageLabel} ${current + 1} of ${count}, ${Math.round(fraction * 100)} percent clear`);
  }

  hud(run = this.run, { network = this._network, fps = null } = {}) {
    if (!run) return this;
    this.run = run;
    this.root.dataset.experience=run.lowTide?'low-tide':'standard';
    let hud = this.root.querySelector('.hud');
    if (!hud) {
      this.root.insertAdjacentHTML('beforeend', `${this._hudMarkup()}${this._touchMarkup()}<div class="toast-stack" hidden></div>`);
      hud = this.root.querySelector('.hud');this._applyPrefs();
    }
    const transmission=journeyTransmission(run),transmissionNode=this.root.querySelector('[data-journey-transmission]');
    if(transmissionNode){transmissionNode.hidden=!transmission;this._setHud('journey-source',transmission?`${transmission.speaker} / ${transmission.title}`:'');this._setHud('journey-text',transmission?.text||'');}
    const mode = run.mode || 'play';
    const fatalBiteBeat=mode==='dead'&&run.bite?.phase==='terminal';
    hud.hidden = this.screen!=='play'||(mode!=='play'&&mode!=='ready'&&!fatalBiteBeat);
    const touch = this.root.querySelector('.touch-layer');
    if (touch) touch.hidden = this.screen!=='play';
    const progression = roomProgression(run);
    const health = clamp(run.health, 0, 100);
    if(hud._lifeHealth!==health){hud._lifeHealth=health;hud.style.setProperty('--life',String(health));}
    const energy = clamp(run.energy, 0, 100);
    const style = clamp(run.style, 0, 1800);
    const waveCount = progression.waveCount;
    const currentWave = progression.wave;
    const pending = progression.pending;
    const exitReady = progression.exitReady;
    const remaining = progression.remaining;
    const total = progression.total;
    const weapon = clamp(run.weapon, 0, WEAPON_NAMES.length - 1);
    const cooldown = Math.max(0, Number(run.cooldowns?.[weapon] || run.fireCooldown || 0));
    const maxCooldown = weapon >= 6 && run.meleeDuration > 0 ? run.meleeDuration + .04 : weapon === 4 && run.lastShotMode === 'burst'
      ? .5
      : weapon === 5 && run.lastShotMode === 'charged'
        ? 1.2
        : weapons[weapon]?.interval || 1;
    const crosshair = this.root.querySelector('[data-hud="crosshair"]');
    const now=performance.now();const hit=now<(this._hitUntil||0);
    crosshair?.classList.toggle('is-hit', hit);crosshair?.classList.toggle('is-kill',hit&&this._hitType==='kill');crosshair?.classList.toggle('is-parry',hit&&this._hitType==='parry');
    crosshair?.classList.toggle('is-shot', Number(run.shot) > 0);
    const reset=run.time<(this._hudTime||0);if(!reset&&this._lastHealth!==undefined&&health<this._lastHealth){this._damageAt=now;this._damageStrength=Math.min(.8,.25+(this._lastHealth-health)/60);}if(reset)this._damageAt=0;this._hudTime=run.time;this._lastHealth=health;hud.classList.toggle('is-critical',health>0&&health<=30);hud.style.setProperty('--damage',String(Math.max(0,1-(now-(this._damageAt||0))/650)*(this._damageStrength||0)));
    this._setHud('health', fmt(health));this._setHud('health-trail','',health);
    const bite=run.bite||{},bitePrompt=this.root.querySelector('[data-bite-prompt]');
    const biteActive=['windup','held','terminal'].includes(bite.phase);
    if(bitePrompt){
      const counter=run.brutal,counterActive=counter&&counter.phase!=='idle',candidate=counterActive?null:chestCandidate(run)||brutalCandidate(run);
      const swarmWarning=run.vermin?.swarm?.phase==='warning';
      const hand=run.verminHand||{},verminActive=hand.phase&&hand.phase!=='idle',rat=counterActive||verminActive||swarmWarning?null:nearestRat(run),target=verminTarget(run);
      bitePrompt.hidden=!biteActive&&!counterActive&&!candidate&&!verminActive&&!rat&&!swarmWarning;
      bitePrompt.dataset.phase=counterActive?'counter':verminActive||rat?'vermin':swarmWarning?'warning':bite.phase||'idle';
      const biteInstruction=bitePrompt.querySelector('[data-hud="bite-instruction"]');
      if(biteInstruction)biteInstruction.hidden=(!biteActive&&!!counterActive)||bite.phase==='terminal';
      if(biteActive){
        const held=bite.phase==='held',terminal=bite.phase==='terminal';
        const parryHint=this.inputDevice==='gamepad'?'RB PARRY':'F PARRY';
        this._setHud('bite-kicker',terminal?'SIGNAL LOST':held?'NECK BITE':'CLOSE CONTACT');
        this._setHud('bite-label',terminal?'FATAL BITE':held?'BREAK THE GRIP':'DODGE NOW');
        this._setHud('bite-instruction',held&&target?`${this.inputDevice==='gamepad'?'RB':'F'} / FEED RAT`:held?`${parryHint} · MOVE / FIRE`:`${parryHint} · DASH / JUMP`);
        this._setHud('bite-fill','',held?clamp(Number(bite.escape)||0,0,1)*100:0);
      }else if(verminActive&&!counterActive||rat){
        const grab=this.inputDevice==='gamepad'?'X':'G',attack=this.inputDevice==='gamepad'?'RB':'F';
        const labels={pickup:'GRABBING RAT',held:`${grab} / THROW RAT`,stuff:hand.channel==='stomach'?'INTO THE STOMACH':'INTO THE MOUTH',release:'RAT RELEASED'};
        this._setHud('bite-kicker',hand.phase==='held'?'BITING / LET GO SOON':'VERMIN');
        this._setHud('bite-label',rat?`${grab} / GRAB RAT`:labels[hand.phase]||'');
        this._setHud('bite-instruction',target?`${attack} / ${target.channel==='stomach'?'STOMACH':'MOUTH'}`:hand.phase==='held'?'AIM / THROW · GET CLOSE / FEED':'');
        if(biteInstruction)biteInstruction.hidden=!target&&hand.phase!=='held';
        this._setHud('bite-fill','',hand.phase==='held'?Math.min(100,(hand.holdAge||0)/8*100):rat?0:clamp((hand.elapsed||0)/(hand.duration||1),0,1)*100);
      }else if(counterActive||candidate){
        const kind=counterActive?counter.kind:candidate.kind,labels={chop:'CHOP THE ARM',twist:'TWIST THE NECK',rip:'RIP FREE',pierce:counter?.phase==='extract'?'TAKE THE HEART':counter?.phase==='recover'?'RELEASE THE BODY':'SPEAR THE BODY'};
        const input=this.inputDevice==='gamepad'?(kind==='pierce'?'R3':'RB'):(kind==='pierce'?'V':'F');
        this._setHud('bite-kicker',counterActive?'CLOSE CONTACT':'COUNTER OPENING');
        this._setHud('bite-label',counterActive?labels[kind]:`${input} / ${labels[kind]}`);
        this._setHud('bite-instruction',kind==='pierce'?'15 ENERGY':kind==='twist'?'STAGGERED TARGET':kind==='rip'?'BREAK THE GRIP':'10 ENERGY');
        this._setHud('bite-fill','',counterActive?clamp(counter.elapsed/counter.duration,0,1)*100:0);
      }else if(swarmWarning){
        this._setHud('bite-kicker','BLOOD SCENT');this._setHud('bite-label','SWARM APPROACHING');
        this._setHud('bite-instruction','');if(biteInstruction)biteInstruction.hidden=true;
        this._setHud('bite-fill','',clamp((run.vermin.swarm.elapsed||0)/(run.vermin.swarm.duration||2.2),0,1)*100);
      }
    }
    const wounds=run.playerWounds||{},woundLabels={leftArm:'L ARM',rightArm:'R ARM',leftLeg:'L LEG',rightLeg:'R LEG'};
    const woundParts=Object.entries(woundLabels).filter(([part])=>wounds[part]&&wounds[part]!=='intact').map(([part,label])=>`${label} ${wounds[part]==='severed'?'LOST':'BITTEN'}`);
    if(Number(wounds.neck)>0)woundParts.push('NECK WOUND');
    if(Number(wounds.torso)>0)woundParts.push(wounds.eviscerated?'TORSO TORN':'TORSO WOUND');
    const woundNode=this.root.querySelector('[data-hud="wounds"]');
    if(woundNode){woundNode.hidden=!woundParts.length;woundNode.textContent=woundParts.slice(0,2).join(' · ')+(woundParts.length>2?` +${woundParts.length-2}`:'');woundNode.title=woundParts.join(' / ');}
    this._setHud('run-clock',`${String(Math.floor((run.time||0)/60)).padStart(2,'0')}:${String(Math.floor((run.time||0)%60)).padStart(2,'0')}`);
    this._setHud('kills', `KILLS ${String(Math.max(0, Math.round(Number(run.kills) || 0))).padStart(2, '0')}`);
    this._setHud('health-fill', '', health);
    this._setHud('energy', pct(energy));
    this._setHud('energy-fill', '', energy);
    this._setHud('speed', `${fmt(run.speed, 1)} m/s`);
    this._setHud('rank', run.rank || 'D');
    this._setHud('rank-bottom', run.rank || 'D');
    this._setHud('style-label', run.styleLabel || 'GET CLOSE. GET LOUD.');
    this._setHud('style-total', `${Math.round(Number(run.styleTotal) || style)} pts`);
    this._setHud('style-fill', '', (style / 1800) * 100);
    const pendingStyle=Math.max(0,Math.round(Number(run.stylePending)||0));
    hud.dataset.styleActive=String(style>0||pendingStyle>0);
    const pendingNode=this.root.querySelector('[data-hud="style-pending"]');
    if(pendingNode){pendingNode.hidden=pendingStyle===0;pendingNode.textContent=`${pendingStyle} UNBANKED`;}
    const extraction=run.extraction;
    const extracting=!!extraction&&extraction.targetId!=null&&['draw','incise','rip'].includes(extraction.phase);
    const candidate=run.extractCandidateId!=null&&(!run.brutal||run.brutal.phase==='idle');
    const extractionPrompt=this.root.querySelector('[data-extraction-prompt]');
    if(extractionPrompt){
      extractionPrompt.hidden=!extracting&&!candidate;
      extractionPrompt.dataset.phase=extracting?extraction.phase:'ready';
      this._setHud('extraction-label',extracting?({draw:'DRAWING BLOOD',incise:'OPENING THE CHEST',rip:'PULLING THE HEART'}[extraction.phase]):this.inputDevice==='gamepad'?'HOLD X / EXTRACT':'HOLD G / EXTRACT');
      this._setHud('extraction-fill','',extracting?clamp(Number(extraction.progress)||0,0,1)*100:0);
    }
    const chapterPrompt=journeyPrompt(run,this.inputDevice),chapterNode=this.root.querySelector('[data-journey-prompt]'),touchOperate=this.root.querySelector('.touch-operate');
    const chapterVisible=!!chapterPrompt&&!biteActive&&!extracting&&(!run.brutal||run.brutal.phase==='idle');
    if(chapterNode){chapterNode.hidden=!chapterVisible;this._setHud('journey-action',chapterPrompt?.text||'');this._setHud('journey-fill','',(chapterPrompt?.progress||0)*100);}
    if(touchOperate)touchOperate.hidden=!chapterVisible||!chapterPrompt.available;
    const touchExtract=this.root.querySelector('.touch-extract');
    if(touchExtract)touchExtract.hidden=!extracting&&!candidate;
    this._setHud('weapon', WEAPON_NAMES[weapon]);
    this._setHud('weapon-slot', `${String(weapon + 1).padStart(2, '0')}`);
    this._setHud('arsenal-count',run.course?.dungeon||run.course?.scavenging?`ARSENAL ${run.ownedWeapons?.length||1} / ${WEAPON_NAMES.length}`:'FULL ARSENAL');
    this.root.querySelectorAll('[data-weapon-slot]').forEach(node=>{const index=Number(node.dataset.weaponSlot),owned=!(run.course?.dungeon||run.course?.scavenging)||run.ownedWeapons?.includes(index);node.classList.toggle('is-equipped',index===weapon);node.classList.toggle('is-locked',!owned);node.disabled=!owned;node.setAttribute('aria-pressed',String(index===weapon));node.setAttribute('aria-label',`${owned?'Equip':'Undiscovered'} ${WEAPON_NAMES[index]}`);});
    this._setHud('weapon-hint', WEAPON_HINTS[weapon]);
    const rifleHeat = clamp(run.rifleHeat, 0, 1) * 100;
    const touchAttachment=this.root.querySelector('.touch-attachment');if(touchAttachment)touchAttachment.hidden=weapon!==1;
    const rifleResource = weapon === 1 ? ((run.attachmentCooldown||0)>.01 ? `GRENADE ${fmt(run.attachmentCooldown,1)}s` : this.inputDevice==='gamepad'?'LT + RB / GRENADE':'C / GRENADE') : weapon === 6
      ? (run.meleeActive ? (run.meleeProgress < .4 ? (run.meleeHeavy ? 'HEAVY SWING' : 'SWING') : 'RECOVERING') : 'ALT / HEAVY STRIKE')
      : weapon === 7 ? (run.meleeActive ? 'SHOVE' : run.sawContact > 0 ? 'CUTTING' : run.sawActive ? `REV ${fmt(run.sawRev * 100)}%` : 'HOLD FIRE / REV')
      : weapon === 4
      ? `HEAT ${fmt(rifleHeat)}%`
      : run.aim > .1 ? 'AIMING' : 'RMB / AIM';
    this._setHud('weapon-resource', this.inputDevice==='gamepad'?rifleResource.replace(/\bALT\b|\bRMB\b/g,'LT').replace(/\bFIRE\b/g,'RT'):rifleResource);
    const cooldownLabel = weapon === 7 && !run.meleeActive ? (run.sawActive ? 'RUNNING' : 'IDLE')
      : cooldown > 0.01 ? `${fmt(cooldown, 2)}s` : 'READY';
    this._setHud('cooldown-label', cooldownLabel);
    const cooldownNode=this.root.querySelector('[data-hud="cooldown-label"]');
    if(cooldownNode)cooldownNode.hidden=['READY','IDLE','CHARGING'].includes(cooldownLabel);
    this._setHud('cooldown', '', maxCooldown ? (1 - cooldown / maxCooldown) * 100 : 100);
    const rifleMeter = this.root.querySelector('[data-rifle-meter-wrap]');
    rifleMeter?.toggleAttribute('hidden', weapon !== 4 && weapon !== 7);
    rifleMeter?.classList.toggle('is-heat', weapon === 4);
    rifleMeter?.classList.toggle('is-charge', weapon === 5);
    rifleMeter?.classList.toggle('is-saw', weapon === 7);
    this._setHud('rifle-meter', '', weapon === 7 ? clamp(run.sawRev,0,1)*100 : weapon === 4 ? rifleHeat : 0);
    this._setHud('network', network || 'OFFLINE');
    const networkNode=this.root.querySelector('[data-hud="network"]');
    if(networkNode)networkNode.hidden=!network||['SOLO','OFFLINE'].includes(network);
    const fpsNode = this.root.querySelector('[data-hud="fps"]');
    if (fpsNode) { fpsNode.hidden = !this.debug; if (this.debug) fpsNode.textContent = fps ? `${Math.round(fps)} FPS` : '-- FPS'; }
    const floorIndex = Math.max(0, Math.round(run.course?.dungeon ? run.course.dungeonIndex : progression.sectorIndex));
    const sectorRoman = ['I', 'II', 'III', 'IV', 'V'][floorIndex] || String(floorIndex + 1).padStart(2, '0');
    const sectorTitle = progression.sectorName.replace(/^The /, '');
    const intermission = progression.state === 'intermission';
    const fallbackObjective = exitReady
      ? (progression.sectorIndex < progression.sectorCount - 1 ? 'DESCEND THROUGH EXIT' : 'REACH THE FINAL EXIT')
      : intermission
        ? 'EXPLORE THE NEXT ROOM'
        : `CLEAR ROOM ${String(Math.max(1, currentWave)).padStart(2, '0')}`;
    const fallbackSubtitle = exitReady ? 'EXIT SIGNAL LIVE' : intermission ? 'PATH OPEN' : 'HUNT THEM DOWN';
    const fallbackThreat = progression.active
      ? `${progression.active} ACTIVE${pending ? ` / ${pending} INCOMING` : ''}`
      : pending ? `${pending} INCOMING` : 'NO ACTIVE THREATS';
    this._setHud('sector', `${sectorRoman} / ${sectorTitle}`);
    this._setHud('room-index', progression.sync ? `${progression.dungeon?'ROUTE':'ROOM'} ${String(Math.round(progression.roomIndex) + 1).padStart(2, '0')} / ${String(progression.roomCount).padStart(2, '0')}` : 'ROOM -- / --');
    this._setHud('room-name', progression.roomName);
    this._setHud('objective', progression.objective || fallbackObjective);
    const approach=this._approachCue;
    const approachLabel=approach&&approach.until>Date.now()&&approach.roomId===progression.encounterRoomId?`Movement at ${approach.label}`:null;
    const phase=run.dungeonProgression?.encounter;
    const phaseLabel=phase?.phaseCount>1&&['combat','telegraph'].includes(progression.state)?`${phase.phase||'Approach'} ${phase.phaseIndex+1}/${phase.phaseCount}`:null;
    this._setHud('objective-sub', compactHudCopy(approachLabel||phaseLabel||progression.subtitle||fallbackSubtitle));
    const objectiveSub=this.root.querySelector('[data-hud="objective-sub"]');
    if(objectiveSub)objectiveSub.hidden=!approachLabel&&!phaseLabel&&progression.state!=='key';
    const navigation=dungeonNavigationView(run);
    const guidance=hud.querySelector('[data-hud="route-guidance"]');
    if(guidance){
      guidance.hidden=!navigation.visible||(!!navigation.holding&&!run.dungeonProgression?.navigation?.blocked);
      if(!guidance.hidden){
        const arrow=guidance.querySelector('[data-hud="route-bearing"]');
        if(arrow){arrow.style.transform=`rotate(${navigation.bearing}rad)`;arrow.textContent=navigation.holding?'◇':'↑';}
        guidance.dataset.holding=String(!!navigation.holding);
        this._setHud('route-label',navigation.label);
      }
    }
    this._setHud('room-threat', progression.threat || fallbackThreat);
    const threatNode=this.root.querySelector('[data-hud="room-threat"]');
    if(threatNode)threatNode.hidden=['NO ACTIVE THREATS','ROOM CLEAR'].includes(progression.threat||fallbackThreat);
    const encounterState = String(progression.state || '').toLowerCase();
    const encounterPercent = Math.round(clamp((progression.encounterProgress ?? progression.progress) * 100, 0, 100));
    const floorPercent = Math.round(clamp(progression.progress * 100, 0, 100));
    const progressLabel = progression.dungeon
      ? (encounterState === 'combat' || encounterState === 'telegraph' ? `${encounterPercent}% ENCOUNTER` : encounterState === 'exploration' ? (progression.progress > 0 ? 'ROOM CLEAR' : 'EXPLORE') : `${floorPercent}% FLOOR`)
      : `${floorPercent}% CLEAR`;
    this._setHud('room-progress-label', progressLabel);
    this._setHud('objective-progress', '', floorPercent);
    hud.dataset.progressionPhase = encounterState;
    this._updateRoomRoute(progression);
    this.root.querySelectorAll('[data-dash]').forEach((pip, index) => pip.classList.toggle('is-ready', energy >= (index + 1) * 33));
    if(run.course.harbor){
      const count=Math.min(3,run.backpack.weaponPickups?.length||0),travel=Math.min(32,Math.floor((run.vehicle?.distance||0)*4));
      const driving=!!run.vehicle?.occupied,nearTruck=run.vehicle&&Math.hypot(run.x-run.vehicle.x,run.y-run.vehicle.y)<1.5;
      const roomAction=lowTidePrompt(run)||harborRoomPrompt(run);
      if(chapterNode){chapterNode.hidden=!driving&&!nearTruck&&!roomAction;this._setHud('journey-action',roomAction?roomAction.label:driving?`${Math.round(Math.abs(run.vehicle.speed)*14.4)} KM/H · SPACE BRAKE · Q EXIT`:'Q · DRIVE DOCK TRUCK');}
      if(touchOperate){touchOperate.hidden=!driving&&!nearTruck;touchOperate.textContent=driving?'EXIT':'DRIVE';touchOperate.setAttribute('aria-label',driving?'Exit truck':'Drive truck');}
      this._setHud('sector',run.lowTide?'BLACKWATER':'BLACKWATER / COASTAL QUARANTINE');this._setHud('room-index',run.course.coastal?'OPEN COAST':run.lowTide?'LOW TIDE / 01':'HARBOR EXPEDITION');
      this._setHud('room-name',harborLocation(run));
      if(!this._harborNavAt||performance.now()-this._harborNavAt>250||this._harborNavCourse!==run.course||this._harborNavRevision!==run.lowTide?.revision||this._harborNavInterior!==run.course.activeInterior?.id){
        this._harborNav=harborNavigation(run);this._harborNavAt=performance.now();this._harborNavCourse=run.course;this._harborNavRevision=run.lowTide?.revision;this._harborNavInterior=run.course.activeInterior?.id;
      }
      const nav=this._harborNav,route=this.root.querySelector('[data-hud="route-guidance"]');
      if(route){route.hidden=!nav||driving;route.dataset.holding='false';if(nav&&!driving){
        const arrow=route.querySelector('[data-hud="route-bearing"]');arrow.textContent='↑';arrow.style.transform=`rotate(${nav.bearing}rad)`;
        this._setHud('route-label',`${nav.target.label.toUpperCase()} · ${nav.distance} M · B / MAP`);
      }}
      this._setHud('objective',count<3?`STASH WEAPONS ${count} / 3`:travel<32?`DRIVE THE TRUCK ${travel} / 32 M`:'REACH THE FERRY EXTRACTION');
      this._setHud('objective-sub',run.vehicle?.occupied?'W/S DRIVE · A/D STEER · SPACE BRAKE · Q EXIT':'WALK OVER WEAPONS TO STASH · B BACKPACK');
      if(objectiveSub)objectiveSub.hidden=false;
      this._setHud('room-progress-label','SALVAGE RUN');this._setHud('objective-progress','',(count/3+travel/32)*50);
      this._setHud('room-threat',`${run.course.enemies.filter(e=>!e.dead).length} INFECTED IN DISTRICT`);
      if(run.lowTide){
        const mission=lowTideObjective(run),records=lowTideJournal(run);
        if(chapterNode)chapterNode.dataset.available=String(roomAction?.enabled!==false);
        if(nav&&!driving)this._setHud('route-label',nav.distance<2?'AT DESTINATION':`${nav.distance} M / ${run.course.activeInterior?'ROOM ROUTE':'STREET ROUTE'}`);
        this._setHud('objective',mission.label.toUpperCase());
        this._setHud('objective-sub',run.lowTide.bellRemaining>0&&!run.course.activeInterior?'SHIFT BELL ACTIVE · WATCH THE SERVICE LANES':'B · FIELD KIT / JOURNAL');
        this._setHud('room-progress-label',run.lowTide.answered?'CHAPTER COMPLETE':LOW_TIDE_TITLE);
        this._setHud('objective-progress','',records.length/7*100);
        const transmission=this.root.querySelector('[data-journey-transmission]');
        if(transmission){transmission.hidden=!(run.lowTideNotice&&run.time<run.lowTideNotice.until);if(!transmission.hidden){this._setHud('journey-source',run.lowTideNotice.title);this._setHud('journey-text',run.lowTide.answered?run.lowTideNotice.text:'Record filed / B to read in your journal');}}
      }
      if(run.coastalDestination&&nav&&!run.course.activeInterior){this._setHud('objective',`EXPLORE / ${nav.target.label.toUpperCase()}`);this._setHud('objective-sub','B · FIELD MAP / CHOOSE A DESTINATION');this._setHud('route-label',nav.distance<6?'DESTINATION REACHED':`${nav.distance} M / COAST ROAD`);}
    }
    const stairPrompt=basementPrompt(run,this.inputDevice);
    if(stairPrompt){
      if(chapterNode){chapterNode.hidden=false;this._setHud('journey-action',stairPrompt.text);this._setHud('journey-fill','',0);}
      if(touchOperate){touchOperate.hidden=false;touchOperate.textContent='STAIRS';touchOperate.setAttribute('aria-label','Use Customs service stairs');}
    }
    return this;
  }

  _setHud(name, text, width) {
    const node = this.root.querySelector(`[data-hud="${name}"]`);
    if (!node) return;
    if (text !== '' && node.textContent !== String(text)) node.textContent = text;
    if (width !== undefined) node.style.width = `${clamp(width, 0, 100)}%`;
  }

  approachCue(event){this._approachCue={roomId:event.roomId,label:String(event.label||'the entrance'),until:Date.now()+4200};}

  lootDiscovery(item) {
    const hud=this.root.querySelector('.hud');if(!hud)return this;
    hud.querySelector('.loot-discovery')?.remove();
    const panel=document.createElement('aside');panel.className='loot-discovery';panel.dataset.rarity=item.rarity||'rare';panel.setAttribute('role','status');
    const tier=document.createElement('span');tier.className='loot-tier';tier.textContent=item.kicker||`${(item.rarity||'rare').toUpperCase()} / WEAPON FOUND`;
    const name=document.createElement('strong');name.textContent=item.weaponName||'WEAPON';
    const story=document.createElement('p');story.textContent=item.story||'';
    panel.append(tier,name,story);hud.append(panel);
    window.clearTimeout(this._lootTimer);
    this._lootTimer=window.setTimeout(()=>panel.remove(),5100);
    return this;
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

  setRoomCode(code) {
    const value = String(code || '').trim();
    this._roomCode = value;
    const input = this.root.querySelector('[name="roomCode"]') || this.root.querySelector('[name="offer"]');
    if (input) input.value = value;
    this._syncCoopControls();
    this._setNetworkMessage(value ? 'Room code ready. Copy it for your partner.' : 'Waiting for a host code.', value ? 'ready' : '');
    return this;
  }

  setConnectionBusy(busy, message = '') {
    this._connectionBusy = Boolean(busy);
    this.root.dataset.connectionBusy = String(this._connectionBusy);
    this._syncCoopControls();
    if (message) this._setNetworkMessage(message, this._connectionBusy ? 'busy' : '');
    return this;
  }

  setOffer(code) {
    return this.setRoomCode(code);
  }

  setAnswer(code) {
    const input = this.root.querySelector('[name="answer"]');
    if (input) input.value = code || '';
    this._setNetworkMessage(code ? 'Answer ready. Host can accept this code.' : 'Waiting for an answer.', code ? 'ready' : '');
    return this;
  }
}

export default UI;
