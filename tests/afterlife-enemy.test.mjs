import test from 'node:test';
import assert from 'node:assert/strict';
import {isAfterlifeWarning} from '../npc-afterlife.js';

test('afterlife attack telegraph follows the engine countdown and stays quiet for idle negatives', () => {
  assert.equal(isAfterlifeWarning(0, {attack: -1, attacking: false}), false, 'negative idle countdown must not warn');
  assert.equal(isAfterlifeWarning(0, {attack: .31, attacking: false}), false, 'melee countdown outside the warning window stays quiet');
  assert.equal(isAfterlifeWarning(0, {attack: .29, attacking: false}), true, 'melee countdown warns inside the engine window');
  assert.equal(isAfterlifeWarning(1, {attack: .57, attacking: false}), true, 'caster countdown uses its longer warning window');
  assert.equal(isAfterlifeWarning(1, {attack: .59, attacking: false}), false, 'caster countdown outside the warning window stays quiet');
  assert.equal(isAfterlifeWarning(0, {attack: -1, attacking: true}), true, 'committed windup can override a stale countdown');
});
