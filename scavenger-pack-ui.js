import {lowTideObjective,lowTideJournal,LOW_TIDE_TITLE} from './low-tide.js';
import * as THREE from './vendor/three.module.js';
import {harborMapSvg,harborNavigation,harborLocation} from './harbor-navigation.js';
import {PACK_CAPACITY, WEAPON_FITTING, ensureScavengerPack} from './scavenger-pack.js';

const DEFAULT_WEAPONS = ['OSSUARY', 'BREACH SHOTGUN', 'ARC LANCE', 'RELIQUARY',
  'CARRION', 'MOURNING', 'WAKE BAT', 'RIPPER'];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const packIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6V4a4 4 0 0 1 8 0v2M6 6h12l2 4v11H4V10ZM7 13h10v5H7ZM8 9h8"/></svg>';
const TYPES = ['SIDEARM', 'SHOTGUN', 'ENERGY', 'LAUNCHER', 'AUTOMATIC', 'MARKSMAN', 'HEAVY MELEE', 'CHAINSAW'];
const SILHOUETTES = [
  'M13 21h58v12H45l-6 22H24l5-22H13Z',
  'M8 25h70v8H39l-4 9H20l-2-9H8ZM48 35h23v5H48Z',
  'M9 24h55l15 6-15 7H41l-8 18H21l5-18H9ZM44 16h8v8h-8Z',
  'M8 22h67v20H8ZM28 42h10v13H26ZM75 26h8v12h-8Z',
  'M6 26h22l5-7h19l7 7h22v7H48l-4 17H33l-2-17H6ZM60 33h13v7H60Z',
  'M7 30h76v6H42l-9 12H17l4-12H7ZM36 19h25v6H36ZM44 25h6v5h-6Z',
  'M15 55 9 49l29-29 4-8 11-8 10 10-8 11-8 4ZM12 52l-5 5 3 3 5-5Z',
  'M9 28h32v23H9ZM40 29l31-15q13-3 15 5t-6 13L41 45ZM15 19h19v9H15Z',
];
const weaponIcon = index => `<svg class="pack-item-art" viewBox="0 0 94 64" aria-hidden="true"><path d="${SILHOUETTES[index]}"/></svg>`;

// The caller owns pause/resume and the authoritative upgrade action. Opening
// this panel never changes movement, weapons, or run state itself.
export function createScavengerPackUI({getRun, onOpen = () => {}, onClose = () => {},
  onUpgrade = () => ({ok: false, reason: 'inactive'}), onEquip = () => false, weapons = DEFAULT_WEAPONS,
  parent = document.body} = {}) {
  const root = document.createElement('div');
  root.className = 'scavenger-ui';
  root.innerHTML = `<button class="pack-launcher" type="button" aria-label="Open backpack (B)"
    aria-haspopup="dialog" aria-expanded="false" hidden>${packIcon}<span>PACK <kbd>B</kbd></span>
    <output>00 / ${PACK_CAPACITY}</output></button>
    <div class="pack-overlay" hidden><section class="pack-panel" role="dialog" aria-modal="true"
      aria-labelledby="pack-title" aria-describedby="pack-context" tabindex="-1">
      <header class="pack-header"><div><span class="pack-kicker">SURVIVOR FIELD KIT</span>
        <h2 id="pack-title">BACKPACK</h2></div><button class="pack-close" type="button"
        aria-label="Close backpack and return to game">×</button></header>
      <nav class="pack-tabs" aria-label="Field equipment views" hidden><button type="button" data-pack-view="gear" aria-pressed="true">EQUIPMENT</button><button type="button" data-pack-view="map" aria-pressed="false">FIELD MAP</button></nav>
      <p id="pack-context" class="pack-context"></p><div class="pack-content"><div class="pack-gear"><div class="pack-resource"><span>SALVAGED FITTINGS</span><strong><output data-pack-scrap>00</output>
        <small>/ ${PACK_CAPACITY}</small></strong><meter min="0" max="${PACK_CAPACITY}" value="0"
        aria-label="Backpack capacity"></meter></div>
      <p id="pack-description">Scavenge weapons. Keep what you find. Use salvaged fittings to make them hit harder.</p>
      <div class="pack-inventory-heading"><span>WEAPON RACK</span><output data-pack-count></output></div>
      <div class="pack-weapons" aria-label="Choose a weapon to customize"></div>
      <div class="pack-item-detail"><div data-pack-art></div><div><span class="pack-kicker" data-pack-type></span>
      <h3 data-pack-name></h3><p data-pack-damage></p></div><button class="pack-equip" type="button">EQUIP</button></div>
      <div class="pack-fitting"><div><span class="pack-kicker">${escape(WEAPON_FITTING.name.toUpperCase())}</span>
        <strong>+25% DAMAGE</strong><p data-pack-target></p></div><button class="pack-upgrade" type="button">
        FIT WEAPON <span>${WEAPON_FITTING.cost} SCRAP</span></button></div>
      <p class="pack-status" role="status" aria-live="polite"></p></div>
      <section class="pack-journal" aria-label="Low Tide field journal" hidden></section>
      <section class="pack-map" aria-label="Harbor field map" hidden></section>
      </div><footer>Weapons & fittings stay with you between floors.<span>B / ESC · RETURN</span></footer>
    </section></div>`;
  parent.append(root);
  const launcher = root.querySelector('.pack-launcher'), overlay = root.querySelector('.pack-overlay');
  const panel = root.querySelector('.pack-panel'), closeButton = root.querySelector('.pack-close');
  const list = root.querySelector('.pack-weapons'), upgradeButton = root.querySelector('.pack-upgrade');
  const status = root.querySelector('.pack-status');
  const equipButton = root.querySelector('.pack-equip');
  let current = null, active = false, visible = false, canUpgrade = true, selected = 0, previousFocus = null;
  let renderKey = '', panelKey = '', launcherKey = '';
  let view='gear',mapKey='',journalKey='';
  const weaponName = index => typeof weapons[index] === 'object' ? weapons[index].name : weapons[index];
  function render(run) {
    if (!run) return;
    current = run;
    const pack = ensureScavengerPack(run);
    const owned = [...new Set(Array.isArray(run.ownedWeapons) ? run.ownedWeapons : [])]
      .filter(index => Number.isInteger(index) && index >= 0 && index < 8);
    if (!owned.includes(selected)) selected = owned.includes(run.weapon) ? run.weapon : owned[0] ?? 0;
    const resourceKey = `${pack.scrap}/${pack.capacity}`;
    if (resourceKey !== launcherKey) {
      launcher.querySelector('output').textContent = `${String(pack.scrap).padStart(2, '0')} / ${pack.capacity}`;
      launcher.setAttribute('aria-label', `Open backpack (B), ${pack.scrap} of ${pack.capacity} scrap`);
      launcherKey = resourceKey;
    }
    if (!active) return;
    if(!run.course?.harbor||view==='journal'&&!run.lowTide)view='gear';
    const title=view==='journal'?'FIELD JOURNAL':view==='map'?'FIELD MAP':'FIELD EQUIPMENT';
    if(root.querySelector('#pack-title').textContent!==title)root.querySelector('#pack-title').textContent=title;
    const context=root.querySelector('#pack-context');
    const contextText=view==='journal'?'Recovered evidence / newest record first':view==='map'?'Your position, destination and accessible routes':'Select a weapon to equip or improve.';
    if(context.textContent!==contextText)context.textContent=contextText;
    const footer=root.querySelector('.pack-panel footer');
    if(footer.dataset.lowTide!==String(!!run.lowTide)){footer.dataset.lowTide=String(!!run.lowTide);footer.innerHTML=run.lowTide?'Progress saves after claiming Netmakers.<span>B / ESC - RETURN</span>':'Weapons & fittings stay with you between floors.<span>B / ESC - RETURN</span>';}
    const tabs=root.querySelector('.pack-tabs');if(tabs.hidden===!!run.course?.harbor)tabs.hidden=!run.course?.harbor;
    const journalButton=root.querySelector('[data-pack-view=journal]');
    if(run.lowTide&&!journalButton)tabs.insertAdjacentHTML('beforeend','<button type="button" data-pack-view="journal" aria-pressed="false">JOURNAL</button>');
    if(!run.lowTide&&journalButton)journalButton.remove();
    const gear=root.querySelector('.pack-gear'),map=root.querySelector('.pack-map');
    if(gear.hidden!==(view!=='gear'))gear.hidden=view!=='gear';if(map.hidden!==(view!=='map'))map.hidden=view!=='map';
    const journal=root.querySelector('.pack-journal');if(journal.hidden!==(view!=='journal'))journal.hidden=view!=='journal';
    if(view==='journal'&&run.lowTide){
      const key=JSON.stringify([run.lowTide,run.lowTideSaveStatus]);
      if(key!==journalKey){journalKey=key;const mission=lowTideObjective(run),s=run.lowTide;
        const records=lowTideJournal(run).reverse();
        journal.innerHTML=`<span class="pack-kicker">CHAPTER 01 / ${s.answered?'COMPLETE':'IN PROGRESS'}</span><h3>${LOW_TIDE_TITLE}</h3><p class="journal-objective">${escape(mission.label)}</p><p class="journal-save" data-warning="${/unavailable/i.test(run.lowTideSaveStatus||'')}">${escape(run.lowTideSaveStatus||'No checkpoint / claim Netmakers')}</p><div class="journal-supplies"><span>STASH <b>${s.bank}/99</b></span><span>${s.powered?'DOCK CIRCUIT ONLINE':`BATTERY ${s.battery?'SECURED':'--'} / DIESEL ${s.fuel?'SECURED':'--'}`}</span></div><h4 class="journal-section">RECOVERED RECORDS <span>${records.length} / 7</span></h4>${records.map((r,i)=>`<article><details ${i===0?'open':''}><summary><span class="record-number">${String(records.length-i).padStart(2,'0')}</span>${escape(r.title)}</summary><p>${escape(r.text)}</p></details></article>`).join('')||'<p>Find the marked Netmakers entrance beyond the salvage yard. Claim the radio desk to establish your safehouse.</p>'}<p class="journal-note">Mission supplies use a separate pouch. At Netmakers, use the radio to rest and the supply bin to store or retrieve scrap.</p>`;
      }
    }
    for(const button of tabs.querySelectorAll('button')){const pressed=String(button.dataset.packView===view);if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);}
    if(view==='map'){
      const key=JSON.stringify([run.course.id,run.x,run.y,run.angle,pack.weaponPickups,run.vehicle?.x,run.vehicle?.y,run.vehicle?.distance,run.course.activeInterior?.id,run.harborRooms,run.lowTide?.revision,run.coastalDestination]);
      if(key!==mapKey){
        const nav=harborNavigation(run);mapKey=key;
        const indoors=!!run.course.activeInterior;
        root.querySelector('.pack-map').innerHTML=`<div>${harborMapSvg(run)}</div><div class="pack-map-notes"><span class="pack-kicker">${indoors?'ROOM PLAN':'DISTRICT MAP'}</span><h3>${escape(harborLocation(run))}</h3><p class="map-destination">${escape(nav?.target.label||'Explore the district')}<strong>${nav?`${nav.distance} m ${indoors?'away':'by street'}`:'No active route'}</strong></p><p class="pack-map-legend">${indoors?'&#9650; YOU &nbsp; &#9679; SUPPLIES &nbsp; &#9671; OBJECTIVE<br>Green marker / exit / Q':'&#9650; YOU &nbsp; &#9679; WEAPON &nbsp; &#9644; TRUCK<br>&#9647; ROOM / Q &nbsp; &#9873; FERRY LOCATION<br>Gold dashes / walking route'}</p>${indoors?'<p>Walls and solid furniture block movement. Use Q at the marked door to return outside.</p>':`${run.course.coastal?`<div class="coastal-destinations"><span class="pack-kicker">SET A WALKING ROUTE</span>${run.course.coastal.landmarks.map((p,i)=>`<button type="button" data-coast-destination="${escape(p.id)}" aria-pressed="${run.coastalDestination===p.id}">${String.fromCharCode(65+i)} / ${escape(p.name)}</button>`).join('')}<button type="button" data-coast-destination="" aria-pressed="${!run.coastalDestination}">Follow chapter objective</button></div>`:''}<ol>${run.course.buildings.map(b=>`<li>${escape(b.name)}</li>`).join('')}</ol><p>Room entrances are marked in green. The Netmakers gate faces the waterfront.</p>`}</div>`;
      }
    }
    const nextPanelKey = JSON.stringify([owned, selected, run.weapon, pack.weaponMods, resourceKey, canUpgrade, !!run.lowTide]);
    if (nextPanelKey === panelKey) return;
    panelKey = nextPanelKey;
    root.querySelector('[data-pack-scrap]').textContent = String(pack.scrap).padStart(2, '0');
    root.querySelector('meter').value = pack.scrap;
    root.querySelector('[data-pack-count]').textContent = `${owned.length} / 8 CARRIED`;
    const key = JSON.stringify([owned, selected, run.weapon, pack.weaponMods, !!run.lowTide]);
    if (key !== renderKey) {
      const focusedIndex = document.activeElement?.dataset?.packWeapon;
      list.innerHTML = owned.map(index => `<button class="pack-weapon ${selected === index ? 'selected' : ''}"
        type="button" data-pack-weapon="${index}" aria-pressed="${selected === index}">
        <span class="pack-slot">${String(index + 1).padStart(2, '0')}<span>${run.weapon === index ? 'IN HAND' : TYPES[index]}</span></span>
        ${weaponIcon(index)}<strong>${escape(weaponName(index))}</strong><small>${pack.weaponMods[index] ? '+25% · FITTED' : 'STANDARD'}</small>
      </button>`).join('') + Array.from({length: Math.max(0, (run.lowTide?Math.max(4,owned.length):8) - owned.length)}, () => '<div class="pack-empty" aria-label="Empty weapon slot"><span>+</span>EMPTY SLOT</div>').join('');
      renderKey = key;
      if (focusedIndex !== undefined) list.querySelector(`[data-pack-weapon="${focusedIndex}"]`)?.focus();
    }
    const fitted = pack.weaponMods[selected] === WEAPON_FITTING.id;
    root.querySelector('[data-pack-art]').innerHTML = owned.length ? weaponIcon(selected) : '';
    root.querySelector('[data-pack-type]').textContent = owned.length ? TYPES[selected] : 'EMPTY BACKPACK';
    root.querySelector('[data-pack-name]').textContent = owned.length ? weaponName(selected) : 'FIND YOUR FIRST WEAPON';
    const definition = weapons[selected], damage = typeof definition === 'object' ? definition.damage : null;
    root.querySelector('[data-pack-damage]').textContent = owned.length
      ? `${damage != null ? `${Number((damage * (fitted ? 1.25 : 1)).toFixed(2))} DAMAGE${selected === 1 ? ' / PELLET' : ' / HIT'} · ` : ''}${fitted ? 'HARDENED +25%' : 'STANDARD FITTING'}` : 'Weapon pickups fill a free slot.';
    equipButton.disabled = !owned.length || run.weapon === selected;
    equipButton.textContent = run.weapon === selected && owned.length ? 'EQUIPPED' : 'EQUIP';
    root.querySelector('[data-pack-target]').textContent = !owned.length ? 'Find a weapon before fitting.' : damage != null && !fitted ? `${damage} → ${Number((damage * 1.25).toFixed(2))} DAMAGE${selected === 1 ? ' / PELLET' : ' / HIT'}` : weaponName(selected);
    upgradeButton.disabled = !canUpgrade || fitted || pack.scrap < WEAPON_FITTING.cost || !owned.length;
    upgradeButton.innerHTML = fitted ? 'FITTED <span>+25% DAMAGE</span>' : `FIT WEAPON <span>${WEAPON_FITTING.cost} SCRAP</span>`;
    status.dataset.state='idle';
    if (!owned.length) status.textContent = 'Find a weapon in the district to begin your loadout.';
    else if (!canUpgrade) status.textContent = 'The host fits equipment for this shared backpack.';
    else if (fitted) status.textContent = 'This weapon already has a hardened fitting.';
    else if (pack.scrap < WEAPON_FITTING.cost) status.textContent = `Collect ${WEAPON_FITTING.cost - pack.scrap} more scrap to fit this weapon.`;
    else status.textContent = 'Ready to fit. Choose carefully: one fitting per weapon.';
  }
  function open() {
    if (active || !visible) return false;
    current = getRun?.() || current;
    if (!current || current.health <= 0) return false;
    previousFocus = document.activeElement;
    selected = current.weapon || 0;
    panelKey = '';
    active = true;
    onOpen();
    overlay.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    render(current);
    closeButton.focus();
    return true;
  }
  function close({resume = true} = {}) {
    if (!active) return false;
    active = false;
    overlay.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    if (resume) onClose();
    if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus();
    previousFocus = null;
    return true;
  }
  launcher.addEventListener('click', open);
  root.querySelector('.pack-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-pack-view]');if(!button)return;view=button.dataset.packView;root.querySelector('.pack-content').scrollTop=0;render(getRun?.()||current);});
  root.querySelector('.pack-map').addEventListener('click',event=>{const button=event.target.closest('[data-coast-destination]');if(!button)return;const run=getRun?.()||current;run.coastalDestination=button.dataset.coastDestination||null;mapKey='';render(run);});
  closeButton.addEventListener('click', () => close());
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-pack-weapon]');
    if (!button) return;
    selected = Number(button.dataset.packWeapon);
    render(getRun?.() || current);
  });
  upgradeButton.addEventListener('click', () => {
    if (upgradeButton.disabled) return;
    const result = onUpgrade(selected);
    render(getRun?.() || current);
    status.dataset.state=result?.ok?'success':'error';
    status.textContent=result?.ok?`${weaponName(selected)} fitted. Damage increased by 25%.`:'Fitting unavailable. Your equipment has not changed; check your scrap and try again.';
  });
  equipButton.addEventListener('click', () => {
    if (equipButton.disabled) return;
    const result = onEquip(selected);
    render(getRun?.() || current);
    const success=result === true || result?.ok;
    status.dataset.state=success?'success':'error';
    status.textContent=success?`${weaponName(selected)} equipped. Ready when you return.`:'Cannot equip this weapon right now. Select it again to retry.';
  });
  const keydown = event => {
    if (!active) return;
    if (event.code === 'Escape' || event.code === 'KeyB') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) close();
      return;
    }
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.code) && document.activeElement?.matches('[data-pack-view]')) {
      const tabs=[...root.querySelectorAll('[data-pack-view]')];
      const index=tabs.indexOf(document.activeElement);
      const next=event.code==='Home'?0:event.code==='End'?tabs.length-1:(index+(event.code==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      event.preventDefault();event.stopImmediatePropagation();tabs[next].click();tabs[next].focus();return;
    }
    if (event.code !== 'Tab') return;
    const buttons = [...panel.querySelectorAll('button:not(:disabled),summary')].filter(button => !button.closest('[hidden]'));
    const index = buttons.indexOf(document.activeElement);
    const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
    event.preventDefault(); event.stopImmediatePropagation();
    buttons[next]?.focus();
  };
  addEventListener('keydown', keydown, true);
  return {
    root, get isOpen() { return active; }, open, close,
    toggle() { return active ? close() : open(); },
    update(run = getRun?.(), options = {}) {
      visible = options.visible ?? visible;
      canUpgrade = options.canUpgrade ?? true;
      if (launcher.hidden === visible) launcher.hidden = !visible;
      if (!visible) close({resume: false});
      render(run);
    },
    destroy() { removeEventListener('keydown', keydown, true); close({resume: false}); root.remove(); },
  };
}

// Three pooled draws: a rusty toolbox, steel hardware, and a raised amber
// fitting mark. Marks sit above the lid; no coplanar decals or new colliders.
export class ScavengerCaches {
  constructor(parent, course) {
    this.items = (course.scavengerPickups || []).slice(0, 12);
    this.root = new THREE.Group(); this.root.name = 'SalvagedFittingsCaches';
    this.root.userData.noBatch = true; this.root.userData.afterlifeSkip = true;
    parent.add(this.root);
    const body = new THREE.BoxGeometry(.80, .30, .48); body.translate(0, .18, 0);
    const hardware = new THREE.BoxGeometry(.52, .10, .09); hardware.translate(0, .37, 0);
    const mark = new THREE.TorusGeometry(.085, .022, 6, 12); mark.rotateX(-Math.PI / 2); mark.translate(.20, .355, .10);
    const materials = [new THREE.MeshStandardMaterial({color: 0x895536, roughness: .88, metalness: .20}),
      new THREE.MeshStandardMaterial({color: 0xa4a59c, roughness: .52, metalness: .65}),
      new THREE.MeshStandardMaterial({color: 0xffbf68, roughness: .65, metalness: .3,
        emissive: 0xb36b2e, emissiveIntensity: .7})];
    this.meshes = [body, hardware, mark].map((geometry, index) => {
      const mesh = new THREE.InstancedMesh(geometry, materials[index], Math.max(1, this.items.length));
      mesh.name = ['ScrapToolCase', 'ScrapHandle', 'AmberFittingMark'][index];
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
      this.root.add(mesh); return mesh;
    });
    this.object = new THREE.Object3D(); this.update([]);
  }
  update(collected = []) {
    const key = collected.join('|'); if (this.key === key) return; this.key = key;
    const removed = new Set(collected); let count = 0;
    for (const item of this.items) {
      if (removed.has(item.id)) continue;
      this.object.position.set(item.x * 4, .025, item.y * 4);
      this.object.rotation.y = ((item.x * 11 + item.y * 7) % 7) * .11;
      this.object.updateMatrix();
      for (const mesh of this.meshes) mesh.setMatrixAt(count, this.object.matrix);
      count++;
    }
    for (const mesh of this.meshes) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; }
  }
}
