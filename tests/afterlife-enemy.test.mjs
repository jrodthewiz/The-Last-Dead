import test from 'node:test';
import assert from 'node:assert/strict';
import {isAfterlifeWarning} from '../npc-afterlife.js';

test('afterlife telegraph follows committed windup or strike, never cooldown readiness', () => {
  assert.equal(isAfterlifeWarning(0, {attack: -1, attacking: false, strike: 0}), false, 'negative idle countdown must not warn');
  assert.equal(isAfterlifeWarning(0, {attack: 0, attacking: false, strike: 0}), false, 'cooldown zero means ready, not attacking');
  assert.equal(isAfterlifeWarning(1, {attack: .1, attacking: false, strike: 0}), false, 'low cooldown alone must stay quiet');
  assert.equal(isAfterlifeWarning(0, {attack: 0, attacking: true, windup: .12}), true, 'committed melee windup warns');
  assert.equal(isAfterlifeWarning(1, {attack: 0, attacking: true, windup: .3}), true, 'committed caster windup warns');
  assert.equal(isAfterlifeWarning(0, {attack: 4, attacking: false, strike: .14}), true, 'post-release melee strike warns');
  assert.equal(isAfterlifeWarning(1, {attack: 4, attacking: false, strike: .22}), true, 'post-release caster strike warns');
});
