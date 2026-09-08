# The Last Dead — Build 04

The UI subagent completed the new wordmark, horror menu, pause branding and responsive layout. The live URL remains http://127.0.0.1:5200/ and the standalone folder remains Desktop/deadarrival.

The generated, rigged character now represents all three enemy roles: Warden melee, Choir ranged and Butcher heavy. They share a walk animation with speed adjustment, hit flashes and death collapse; accessories and colored attack rings distinguish the roles. AI routes around cover, telegraphs committed attacks, and can be interrupted with a punch. This is one model with three variants, not three independently generated characters.

## Verification

- 14 engine tests passed, including navigation, melee windup/interrupt and ranged windup.
- Full normal simulated combat cleared 18 enemies across three waves and reached the exit with 85 health, without health grants or skipped enemies.
- Character browser check passed: 22 active bones, walking clip, animated height 1.93m, hit flash and collapse.
- Two-browser co-op UI test passed: manual offer/answer, movement, shared combat and disconnect. This does not certify internet NAT traversal.
- Desktop and mobile browser controls passed with zero page/resource errors; mobile has no horizontal overflow. The jump check waits for simulation state instead of assuming a fixed render delay.
- Visually reviewed desktop/mobile menus and three-character lineup.

Evidence: [browser results](browser-results.json), [character results](npc-visual.json), [desktop menu](menu-desktop.png), [mobile menu](menu-mobile.png), [enemy lineup](warden-variants.png). Earlier reports describe their own earlier builds.

## Remaining scope

One combat arena, three enemy classes and three weapons. This is a playable foundation, not complete ULTRAKILL parity or a finished campaign. Enemy variants still share one base mesh; environment and weapon models need further art passes. Browser FPS samples are diagnostic, not broad hardware certification.
