import {DEV_MAPS,devMapHref} from './dev-map-routes.js';
// Presentation only: flight, pointer lock, and the frozen simulation belong to main.js.
export class DevFlightUI {
  constructor() {
    this.element = document.createElement('section');
    this.element.className = 'dev-inspector';
    this.element.setAttribute('aria-label', 'Free camera controls');
    this.element.hidden = true;
    this.element.innerHTML = `
      <header class="dev-camera-heading">
        <span class="dev-camera-eyebrow">DEVELOPER / WORLD INSPECTION</span>
        <h2>FREE CAMERA</h2>
        <nav class="dev-camera-maps" aria-label="Development maps">${DEV_MAPS.map(map=>`<a href="${devMapHref(map.id).replaceAll('&','&amp;')}" data-dev-map="${map.id}">${map.name}</a>`).join('')}<button type="button" data-dev-overview hidden>FULL MAP <kbd>M</kbd></button></nav>
        <span class="dev-camera-status"><i aria-hidden="true"></i>SIMULATION PAUSED</span>
      </header>
      <div class="dev-camera-dock">
        <aside class="dev-camera-help" id="dev-camera-help" aria-label="Camera controls" hidden>
          <h3>CAMERA CONTROLS</h3>
          <dl>
            <div><dt>Move</dt><dd><kbd>W A S D</kbd></dd></div>
            <div><dt>Rise / descend</dt><dd><kbd>E / Q</kbd><span>or Space / Ctrl</span></dd></div>
            <div><dt>Look</dt><dd>Mouse / arrow keys</dd></div>
            <div><dt>Speed / boost</dt><dd>Mouse wheel / <kbd>SHIFT</kbd></dd></div>
            <div><dt>Island overview</dt><dd><kbd>M</kbd> / Full Map</dd></div>
            <div><dt>Release mouse</dt><dd><kbd>TAB</kbd></dd></div>
            <div><dt>Pause menu</dt><dd><kbd>ESC</kbd></dd></div>
            <div><dt>Land on clear ground</dt><dd><kbd>F4</kbd></dd></div>
            <div><dt>God mode</dt><dd><kbd>F3</kbd><span>solo play</span></dd></div>
          </dl>
        </aside>
        <div class="dev-camera-footer">
          <div class="dev-camera-telemetry" aria-label="Camera position in metres and flight speed" aria-live="off">
            <div class="dev-camera-position"><span>X <output data-camera-x></output></span><span>Y <output data-camera-y></output></span><span>Z <output data-camera-z></output></span></div>
            <div class="dev-camera-speed"><output data-camera-speed></output><span>m/s</span></div>
          </div>
          <nav class="dev-flight-actions" aria-label="Camera actions">
            <button type="button" data-dev-route><span>RETURN STAIRS</span></button>
            <button type="button" data-dev-land><span>LAND HERE</span><kbd class="game-key">F4</kbd></button>
            <button type="button" data-dev-help aria-expanded="false" aria-controls="dev-camera-help"><span>CONTROLS</span><kbd class="game-key">H</kbd></button>
            <button type="button" data-dev-reset><span>RESET VIEW</span><kbd class="game-key">R</kbd></button>
            <button type="button" data-dev-capture><span data-camera-look>LOOK WITH MOUSE</span><kbd class="game-key" data-camera-look-key aria-hidden="true">↗</kbd></button>
            <button type="button" data-dev-inspect class="dev-camera-return"><span>RETURN TO PLAYER</span><kbd class="game-key">F2</kbd></button>
          </nav>
        </div>
      </div>`;
    this.outputs = Object.fromEntries(['x', 'y', 'z', 'speed'].map(key => [key, this.element.querySelector(`[data-camera-${key}]`)]));
    this.mapLinks = [...this.element.querySelectorAll('[data-dev-map]')];
    this.overviewButton = this.element.querySelector('[data-dev-overview]');
    this.help = this.element.querySelector('.dev-camera-help');
    this.helpButton = this.element.querySelector('[data-dev-help]');
    this.lookButton = this.element.querySelector('[data-dev-capture]');
    this.lookLabel = this.element.querySelector('[data-camera-look]');
    this.lookKey = this.element.querySelector('[data-camera-look-key]');
    this.helpButton.addEventListener('click', () => this.toggleHelp());
  }

  toggleHelp() {
    this.help.hidden = !this.help.hidden;
    this.helpButton.setAttribute('aria-expanded', String(!this.help.hidden));
  }

  update({ active, pose, speed, pointerLocked, course }) {
    this.element.hidden = !active;
    if (!active) return;
    const map = course?.coastal ? 'island' : course?.dungeon ? 'descent' : null;
    this.overviewButton.hidden = map !== 'island';
    this.element.querySelector('[data-dev-route]').hidden=!course?.basementPortal;
    for(const link of this.mapLinks) {
      if(link.dataset.devMap===map)link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    for (const key of ['x', 'y', 'z', 'speed']) {
      const text = key === 'speed' ? speed.toFixed(0) : pose[key].toFixed(1);
      if (this.outputs[key].textContent !== text) this.outputs[key].textContent = text;
    }
    if (this.lookButton.dataset.captured !== String(pointerLocked)) {
      this.lookLabel.textContent = pointerLocked ? 'RELEASE MOUSE' : 'LOOK WITH MOUSE';
      this.lookKey.innerHTML = pointerLocked ? 'TAB' : '<svg viewBox="0 0 16 20"><rect x="3" y="1" width="10" height="17" rx="5"/><path d="M8 1v7"/></svg>';
      this.lookButton.dataset.captured = String(pointerLocked);
    }
  }
}
