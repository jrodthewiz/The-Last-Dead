# Dead Arrival combat foundation

Original arena FPS inspired by ULTRAKILL's high-mobility, varied-weapon, blood-healing loop. Official reference: https://store.steampowered.com/app/1229490/ULTRAKILL/

## Implemented simulation
- Free WASD movement, mouse pitch/yaw, optional automatic forward running.
- Ground movement 8.2m/s; slide 13m/s; dash 24m/s with three regenerating charges and brief damage immunity.
- Jump, air dash, three wall jumps, ground slam and air control.
- Revolver, nine-pellet shotgun, penetrating rail lance. No magazines or reload interruption.
- Revolver alternate tosses regenerating coins; shooting a coin ricochets toward a visible enemy.
- Shotgun alternate launches an explosive core; walls block blast damage. Shoot a core to detonate it; an arc-lance hit amplifies the explosion.
- Melee punch and a short timed parry window reflect projectiles.
- Tether pulls light enemies to you or draws you toward heavy enemies.
- Close-range enemy damage restores health, with bounded blood pools and debris.
- Style decays over time, rewards weapon variety and movement attacks; repeated weapons earn less.
- Three enemy classes and three waves. Eliminate all enemies, then reach the exit.
- Two-player shared-enemy simulation with host authority; a downed player revives after three seconds if the partner survives. Both down ends the run.

## Architecture
engine.js owns simulation in four-metre grid cells. Fixed 1/120s steps, circle/segment world collision with movement substeps capped at 0.04 cells; ray-based wall occlusion for hitscan and projectile sweeps. Tall cover blocks are solid. Renderer owns only visual objects and camera projection. main.js maps inputs and synchronizes authority through peer.js. No API credentials are shipped to browsers.

## Honest scope
This is a focused original combat arena, not feature-complete ULTRAKILL parity. A campaign, bosses, all weapon variants, full coin-chain tech, destructible/multi-level traversal geometry, matchmaking, relay hosting, host migration, and production anti-cheat remain beyond this foundation. Network tests on one computer do not establish internet/NAT coverage or physical mobile performance.

## Automated engine evidence
engine.test.mjs covers movement release/auto-run, cover/corner tunneling, jump/dash/slide/slam, vertical aim, occlusion, cooldown, blood healing, bounded gore, coin ricochet, projectile parry, core blast occlusion, peer authoritative kills, wave/exit/death/retry, and tether behaviors.
