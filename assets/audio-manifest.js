// Replace individual event pools here. Paths resolve relative to assets/audio.js.
export const AUDIO_ASSET_MANIFEST = Object.freeze({
  "ambience": [
    "./audio/ambience/ossuary-dungeon.ogg",
    "./audio/afterlife/air-corridor-loop.ogg",
    "./audio/sourced/horror/dark-cavern-loop.ogg"
  ],
  "horror-sting": [
    "./audio/sourced/horror/string-sting.ogg"
  ],
  "horror-reveal": [
    "./audio/sourced/horror/industrial-reveal.ogg"
  ],
  "distant-scream": [
    "./audio/sourced/horror/distant-scream-rough.ogg"
  ],
  "ceiling-scream": [
    "./audio/playground/ceiling-human-scream.ogg"
  ],
  "window-scream": [
    "./audio/playground/window-human-scream.ogg"
  ],
  "music-menu": [
    "./audio/music/insistent-menu.ogg"
  ],
  "music-play": [
    "./audio/music/abandoned-passages.ogg"
  ],
  "shot": [
    [
      "./audio/sfx/processed/ossuary-shot.wav",
      "./audio/sourced/weapons/ossuary-02.ogg",
      "./audio/sourced/weapons/ossuary-03.ogg"
    ],
    [
      "./audio/sfx/processed/breach-shot.wav",
      "./audio/sourced/weapons/breach-02.ogg"
    ],
    [
      "./audio/sfx/processed/arc-lance.wav",
      "./audio/baseline/scifi-laserLarge_000.ogg",
      "./audio/baseline/scifi-laserLarge_001.ogg"
    ],
    [
      "./audio/sfx/processed/reliquary-launch.wav",
      "./audio/sourced/weapons/reliquary-02.ogg"
    ],
    [
      "./audio/sfx/processed/carrion-auto-rifle.wav",
      "./audio/sourced/weapons/carrion-sks-01.ogg",
      "./audio/sourced/weapons/carrion-sks-02.ogg"
    ],
    [
      "./audio/sfx/processed/mourning-marksman.wav",
      "./audio/sourced/weapons/mourning-mosin-01.ogg",
      "./audio/sourced/weapons/mourning-mosin-02.ogg"
    ]
  ],
  // Short, low-level mechanical tails are layered by AudioSystem.play('shot')
  // so each weapon keeps its main report while gaining a distinct tactile
  // latch without increasing gameplay event traffic.
  "mechanism": [
    [
      "./audio/afterlife/weapon-latch-metal.ogg"
    ],
    [
      "./audio/sourced/weapons/breach-pump.ogg"
    ],
    [
      "./audio/afterlife/weapon-latch-metal.ogg"
    ],
    [
      "./audio/afterlife/weapon-latch-bone.ogg"
    ],
    [
      "./audio/sourced/weapons/carrion-action.ogg"
    ],
    [
      "./audio/sourced/weapons/mourning-action.ogg"
    ]
  ],
  // One-shot cue when Mourning enters its held alternate-fire charge.
  // The latch keeps the cue tactile without introducing a looping charge bed.
  "rifle-charge": [
    "./audio/afterlife/weapon-latch-bone.ogg"
  ],
  // Melee events use dedicated sampled pools so a bat never falls through to
  // a rifle report. The impacts reuse the bundled CC0/Kenney foley set.
  "bat-swing": [
    "./audio/melee/bat-swing-01.ogg",
    "./audio/melee/bat-swing-02.ogg"
  ],
  "melee-hit": [
    "./audio/baseline/impact-impactPunch_heavy_000.ogg",
    "./audio/baseline/impact-impactPunch_heavy_001.ogg",
    "./audio/baseline/impact-impactPunch_heavy_002.ogg",
    "./audio/sfx/cc0-splat-hit.wav"
  ],
  "melee-wall": [
    "./audio/baseline/impact-impactMetal_medium_000.ogg",
    "./audio/baseline/impact-impactMetal_medium_001.ogg",
    "./audio/baseline/impact-impactMetal_medium_002.ogg"
  ],
  // Chainsaw has separate start, engine, cut, and stop layers. The engine
  // buffer is looped by AudioSystem.updateMelee; contact is only looped while
  // the authoritative sawContact flag is live.
  "chainsaw-start": [
    "./audio/melee/chainsaw-start.ogg"
  ],
  "chainsaw-motor": [
    "./audio/melee/chainsaw-idle.ogg"
  ],
  "chainsaw-contact": [
    "./audio/melee/chainsaw-contact.ogg"
  ],
  "chainsaw-hit": [
    "./audio/melee/chainsaw-hit.ogg"
  ],
  "chainsaw-wall": [
    "./audio/baseline/impact-impactMetal_medium_001.ogg",
    "./audio/baseline/impact-impactMetal_medium_002.ogg"
  ],
  "chainsaw-stop": [
    "./audio/melee/chainsaw-stop.ogg"
  ],
  "hit": [
    "./audio/sfx/processed/impact-metal-flesh.wav",
    "./audio/sfx/cc0-bullet-hit.wav",
    "./audio/baseline/impact-impactPunch_medium_000.ogg",
    "./audio/baseline/impact-impactPunch_medium_001.ogg",
    "./audio/baseline/impact-impactPunch_medium_002.ogg"
  ],
  "blood": [
    "./audio/sfx/processed/blood-burst.wav",
    "./audio/sfx/cc0-splat-hit.wav"
  ],
  "explosion": [
    "./audio/baseline/scifi-explosionCrunch_000.ogg",
    "./audio/baseline/scifi-explosionCrunch_001.ogg",
    "./audio/baseline/scifi-explosionCrunch_002.ogg"
  ],
  "rocket": [
    "./audio/sfx/processed/reliquary-launch.wav",
    "./audio/sourced/weapons/reliquary-02.ogg"
  ],
  "bulletcrackle": [
    "./audio/sfx/cc0-bullet-crackle.wav"
  ],
  "footstep": [
    "./audio/baseline/impact-footstep_concrete_000.ogg",
    "./audio/baseline/impact-footstep_concrete_001.ogg",
    "./audio/baseline/impact-footstep_concrete_002.ogg",
    "./audio/baseline/impact-footstep_concrete_003.ogg",
    "./audio/baseline/impact-footstep_concrete_004.ogg"
  ],
  "jump": [
    "./audio/baseline/impact-footstep_concrete_000.ogg",
    "./audio/baseline/impact-footstep_concrete_001.ogg"
  ],
  "land": [
    "./audio/baseline/impact-impactSoft_heavy_000.ogg",
    "./audio/baseline/impact-impactSoft_heavy_001.ogg",
    "./audio/baseline/impact-impactSoft_heavy_002.ogg"
  ],
  "dash": [
    "./audio/baseline/scifi-doorOpen_000.ogg"
  ],
  "slide": [
    "./audio/baseline/interface-scratch_001.ogg",
    "./audio/baseline/interface-scratch_002.ogg"
  ],
  "hook": [
    "./audio/baseline/scifi-doorOpen_001.ogg"
  ],
  "parry": [
    "./audio/baseline/impact-impactMetal_medium_000.ogg",
    "./audio/baseline/impact-impactMetal_medium_001.ogg",
    "./audio/baseline/impact-impactMetal_medium_002.ogg"
  ],
  "punch": [
    "./audio/baseline/impact-impactPunch_heavy_000.ogg",
    "./audio/baseline/impact-impactPunch_heavy_001.ogg",
    "./audio/baseline/impact-impactPunch_heavy_002.ogg"
  ],
  "damage": [
    "./audio/baseline/impact-impactPunch_medium_000.ogg",
    "./audio/baseline/impact-impactPunch_medium_001.ogg",
    "./audio/baseline/impact-impactPunch_medium_002.ogg"
  ],
  "enemyattack": [
    "./audio/sourced/enemies/zombie-attack-01.ogg",
    "./audio/sourced/enemies/zombie-attack-02.ogg",
    "./audio/sourced/enemies/zombie-attack-03.ogg",
    "./audio/sourced/enemies/zombie-attack-04.ogg",
    "./audio/sourced/enemies/zombie-attack-05.ogg",
    "./audio/sourced/enemies/zombie-attack-06.ogg",
    "./audio/sourced/enemies/zombie-attack-07.ogg",
    "./audio/sourced/enemies/zombie-attack-08.ogg",
    "./audio/sourced/enemies/zombie-attack-09.ogg",
    "./audio/sourced/enemies/zombie-attack-10.ogg",
    "./audio/sourced/enemies/zombie-attack-11.ogg",
    "./audio/sourced/enemies/zombie-attack-12.ogg",
    "./audio/afterlife/enemy-onset.ogg"
  ],
  "moan": [
    "./audio/sourced/enemies/zombie-moan-01.ogg",
    "./audio/sourced/enemies/zombie-moan-02.ogg",
    "./audio/sourced/enemies/zombie-moan-03.ogg",
    "./audio/sourced/enemies/zombie-moan-04.ogg",
    "./audio/sourced/enemies/zombie-moan-05.ogg",
    "./audio/sourced/enemies/zombie-moan-06.ogg",
    "./audio/sourced/enemies/zombie-moan-07.ogg",
    "./audio/sourced/enemies/zombie-moan-08.ogg",
    "./audio/sourced/enemies/zombie-moan-09.ogg",
    "./audio/sourced/enemies/zombie-moan-10.ogg",
    "./audio/sourced/enemies/zombie-moan-11.ogg",
    "./audio/sourced/enemies/zombie-moan-12.ogg",
    "./audio/afterlife/room-creak.ogg"
  ],
  "enemydeath": [
    "./audio/enemy/enemy-death-01.wav",
    "./audio/enemy/enemy-death-02.wav"
  ],
  "enemyjump": [
    "./audio/enemy/enemy-jump.wav"
  ],
  "enemyland": [
    "./audio/baseline/impact-impactSoft_heavy_000.ogg",
    "./audio/baseline/impact-impactSoft_heavy_001.ogg",
    "./audio/baseline/impact-impactSoft_heavy_002.ogg"
  ],
  "spawn": [
    "./audio/baseline/scifi-forceField_000.ogg",
    "./audio/baseline/scifi-forceField_001.ogg"
  ],
  "wave": [
    "./audio/baseline/impact-impactBell_heavy_000.ogg"
  ],
  "win": [
    "./audio/baseline/interface-confirmation_004.ogg"
  ],
  "death": [
    "./audio/baseline/scifi-lowFrequency_explosion_000.ogg"
  ],
  "heartbeat": [
    "./audio/baseline/impact-impactSoft_medium_000.ogg"
  ],
  "coin": [
    "./audio/baseline/impact-impactMetal_light_000.ogg",
    "./audio/baseline/impact-impactMetal_light_001.ogg"
  ],
  "ui": [
    "./audio/baseline/interface-click_001.ogg",
    "./audio/baseline/interface-click_002.ogg"
  ],
  "hover": [
    "./audio/baseline/interface-tick_001.ogg"
  ],
  "confirm": [
    "./audio/baseline/interface-confirmation_001.ogg"
  ],
  "cancel": [
    "./audio/baseline/interface-back_001.ogg"
  ],
  "pause": [
    "./audio/baseline/interface-close_001.ogg"
  ],
  "fail": [
    "./audio/baseline/interface-error_001.ogg"
  ],
  "toggle": [
    "./audio/baseline/interface-switch_001.ogg",
    "./audio/baseline/interface-switch_002.ogg"
  ],
  "equip": [
    "./audio/baseline/interface-select_002.ogg"
  ]
});
