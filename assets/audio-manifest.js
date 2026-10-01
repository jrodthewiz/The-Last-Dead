// Measured source correction only: Carrion exports are 13–20dB below the other
// firearm reports. These authored trims preserve all other source dynamics.
export const AUDIO_ASSET_TRIMS_DB = Object.freeze({
  'shot:4:0': 16, 'shot:4:1': 13, 'shot:4:2': 13,
  'shot:5:0': 5, 'shot:5:1': 7, 'shot:5:2': 7,
  'shot:3:0': 6,
});
// Physical scratch/clothing/impact arrangements, not recordings of animals.
// Canonical events trigger short one-shots; a shared voice budget keeps them
// beneath weapon reports and creature attack warnings.
export const VERMIN_CUES=Object.freeze({
  'vermin-pickup':[{pool:'vermin-rustle',volume:.12,rate:.90,highpass:700,lowpass:4900,duration:.25}],
  'vermin-throw':[{pool:'dash',volume:.065,rate:1.12,highpass:420,lowpass:4200,duration:.20}],
  'vermin-stuff':[{pool:'vermin-rustle',volume:.11,rate:.80,highpass:400,lowpass:3800,duration:.28}],
  'vermin-infest':[
    {pool:'blood',volume:.17,rate:1.05,highpass:140,lowpass:3700,duration:.30},
    {pool:'vermin-rustle',volume:.07,rate:1.12,highpass:650,lowpass:4300,delay:.055,duration:.28},
  ],
  'vermin-bite':[
    {pool:'melee-hit',volume:.10,rate:1.14,highpass:260,lowpass:2900,duration:.12},
    {pool:'blood',volume:.10,rate:1.2,highpass:240,lowpass:3500,delay:.025,duration:.19},
  ],
  'vermin-drop':[{pool:'vermin-rustle',volume:.055,rate:1.1,highpass:750,lowpass:4400,duration:.17}],
  'vermin-land':[{pool:'land',volume:.06,rate:1.25,highpass:300,lowpass:3000,duration:.15}],
  'vermin-crawl':[
    {pool:'vermin-rustle',volume:.10,rate:1.15,highpass:900,lowpass:5200,duration:.25},
    {pool:'vermin-rustle',volume:.07,rate:.91,highpass:800,lowpass:4700,delay:.20,duration:.28},
  ],
  'vermin-swarm-warning':[{pool:'vermin-rustle',volume:.065,rate:.82,highpass:600,lowpass:4000,duration:.40}],
  'vermin-swarm':[
    {pool:'vermin-rustle',volume:.075,rate:1.06,highpass:700,lowpass:4600,duration:.33},
    {pool:'vermin-rustle',volume:.055,rate:.85,highpass:950,lowpass:4300,delay:.22,duration:.32},
  ],
});
// Counter foley is scheduled from authoritative action boundaries. These
// arrangements reuse the licensed bundled samples and never loop.
export const BRUTAL_COMBAT_CUES=Object.freeze({
  start:[
    {pool:'dash',volume:.13,rate:1.12,highpass:220,lowpass:4800,duration:.20},
    {pool:'slide',volume:.09,rate:1.05,highpass:380,lowpass:2700,delay:.035,duration:.20},
  ],
  chop:[
    {pool:'melee-hit',variant:1,volume:.30,rate:.86,highpass:65,lowpass:3800,duration:.23},
    {pool:'blood',volume:.31,rate:1.04,highpass:130,lowpass:4100,delay:.035,duration:.38},
  ],
  twist:[
    {pool:'melee-hit',variant:2,volume:.32,rate:.64,highpass:75,lowpass:2800,duration:.27},
    {pool:'blood',volume:.28,rate:.81,highpass:140,lowpass:3600,delay:.065,duration:.45},
  ],
  rip:[
    {pool:'melee-hit',variant:0,volume:.24,rate:.71,highpass:55,lowpass:2600,duration:.24},
    {pool:'blood',volume:.37,rate:.70,highpass:90,lowpass:3300,delay:.045,duration:.52},
    {pool:'slide',volume:.10,rate:.74,highpass:470,lowpass:2400,delay:.10,duration:.27},
  ],
  pierce:[
    {pool:'melee-hit',variant:0,volume:.29,rate:.69,highpass:60,lowpass:2800,duration:.26},
    {pool:'blood',volume:.32,rate:.92,highpass:115,lowpass:3900,delay:.018,duration:.38},
  ],
  'pierce-extract':[
    {pool:'blood',volume:.31,rate:.71,highpass:95,lowpass:3300,duration:.42},
    {pool:'slide',volume:.08,rate:.80,highpass:420,lowpass:2500,delay:.045,duration:.20},
  ],
  'pierce-release':[
    {pool:'land',volume:.15,rate:.87,highpass:80,lowpass:2200,delay:.10,duration:.19},
  ],
});
// Replace individual event pools here. Paths resolve relative to assets/audio.js.
// Local-player injury arrangements reuse these licensed bundled pools. Times
// are seconds; duration bounds each texture so a grapple never becomes a loop.
export const PLAYER_INJURY_CUES = Object.freeze({
  'bite-windup': { cooldown: .45, duck: .72, layers: [
    { pool:'enemyattack', group:'voice', volume:.29, rate:.82, highpass:120, lowpass:3100, duration:.48 },
    { pool:'slide', volume:.10, rate:.85, highpass:350, lowpass:2800, delay:.035, duration:.26 },
  ] },
  'bite-start': { cooldown: .3, duck: .42, layers: [
    { pool:'melee-hit', variant:0, volume:.46, rate:.77, highpass:55, lowpass:3300, duration:.26 },
    { pool:'blood', volume:.31, rate:.73, highpass:100, lowpass:3600, delay:.045, duration:.43 },
    { pool:'enemyattack', group:'voice', volume:.20, rate:.74, highpass:130, lowpass:2500, delay:.025, duration:.5 },
  ] },
  'bite-struggle': { cooldown: .28, duck: .68, layers: [
    { pool:'land', volume:.27, rate:.91, highpass:70, lowpass:2100, duration:.18 },
    { pool:'slide', volume:.20, rate:.86, highpass:320, lowpass:3100, delay:.025, duration:.32 },
  ] },
  'bite-damage': { cooldown: .2, duck: .4, layers: [
    { pool:'melee-hit', variant:1, volume:.38, rate:.73, highpass:50, lowpass:2700, duration:.27 },
    { pool:'blood', volume:.41, rate:.78, highpass:95, lowpass:4100, delay:.045, duration:.51 },
    { pool:'enemyattack', group:'voice', volume:.15, rate:.81, highpass:150, lowpass:2300, delay:.09, duration:.4 },
  ] },
  'bite-release': { cooldown: .22, duck: .75, layers: [
    { pool:'blood', volume:.20, rate:1.18, highpass:140, lowpass:4400, duration:.27 },
    { pool:'dash', volume:.14, rate:.87, highpass:260, lowpass:2900, delay:.025, duration:.29 },
    { pool:'land', volume:.14, rate:.95, highpass:65, lowpass:1900, delay:.08, duration:.18 },
  ] },
  'bite-terminal': { cooldown: .8, duck: .3, layers: [
    { pool:'melee-hit', variant:2, volume:.46, rate:.65, highpass:45, lowpass:2600, duration:.33 },
    { pool:'blood', volume:.46, rate:.61, highpass:75, lowpass:3400, delay:.07, duration:.72 },
    { pool:'enemyattack', group:'voice', volume:.20, rate:.63, highpass:100, lowpass:1900, delay:.035, duration:.65 },
  ] },
  'player-injury': { cooldown: .18, duck: .57, layers: [
    { pool:'damage', volume:.35, rate:.88, highpass:70, lowpass:3200, duration:.26 },
    { pool:'blood', volume:.20, rate:.9, highpass:160, lowpass:2700, delay:.035, duration:.31 },
  ] },
});

export const AUDIO_ASSET_MANIFEST = Object.freeze({
  'secret-whisper': ['./audio/atmosphere/secret-whisper-01.ogg','./audio/atmosphere/secret-whisper-02.ogg','./audio/atmosphere/secret-whisper-03.ogg'],
  'cloth-rustle': ['./audio/atmosphere/cloth-rustle-01.ogg','./audio/atmosphere/cloth-rustle-02.ogg','./audio/atmosphere/cloth-rustle-03.ogg'],
  'vermin-rustle':[
    './audio/baseline/interface-scratch_001.ogg',
    './audio/baseline/interface-scratch_002.ogg',
  ],
  "ambience": [
    "./audio/ambience/ossuary-dungeon.ogg",
    "./audio/sourced/horror/ward-wind-loop.ogg",
    "./audio/sourced/horror/dark-cavern-loop.ogg"
  ],
  "horror-sting": [
    "./audio/sourced/horror/string-sting.ogg"
  ],
  "horror-reveal": [
    "./audio/sourced/horror/foundry-door-reveal.ogg"
  ],
  "distant-scream": [
    "./audio/sourced/horror/distant-scream-rough.ogg"
  ],
  "ceiling-scream": [
    "./audio/sourced/horror/ceiling-screamer-human.ogg"
  ],
  "window-scream": [
    "./audio/sourced/horror/window-screamer-human.ogg"
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
      "./audio/sourced/industrial/arc-spark.ogg",
      "./audio/sourced/industrial/arc-crackle.ogg"
    ],
    [
      "./audio/sourced/industrial/rocket-launch.ogg"
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
    "./audio/sfx/cc0-splat-hit.wav"
  ],
  "explosion": [
    "./audio/sourced/industrial/dull-blast.ogg"
  ],
  "rocket": [
    "./audio/sourced/industrial/rocket-launch.ogg"
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
    "./audio/sourced/industrial/air-dash.ogg"
  ],
  "slide": [
    "./audio/sourced/industrial/slide-scrape-01.ogg",
    "./audio/sourced/industrial/slide-scrape-02.ogg"
  ],
  "hook": [
    "./audio/sourced/industrial/air-dash.ogg"
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
    "./audio/sourced/enemies/zombie-attack-12.ogg"
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
    "./audio/sourced/horror/wood-creak.ogg"
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
    "./audio/sourced/industrial/spawn-metal-01.ogg",
    "./audio/sourced/industrial/spawn-metal-02.ogg"
  ],
  "wave": [
    "./audio/baseline/impact-impactBell_heavy_000.ogg"
  ],
  "win": [
    "./audio/sourced/industrial/victory-bell.ogg"
  ],
  "death": [
    "./audio/sourced/industrial/dull-blast.ogg"
  ],
  "heartbeat": [
    "./audio/baseline/impact-impactSoft_medium_000.ogg"
  ],
  "coin": [
    "./audio/baseline/impact-impactMetal_light_000.ogg",
    "./audio/baseline/impact-impactMetal_light_001.ogg"
  ],
  "ui": [
    "./audio/sourced/physical-ui/squeakyclick1.ogg",
    "./audio/sourced/physical-ui/squeakyclick2.ogg"
  ],
  "hover": [
    "./audio/sourced/physical-ui/typewriter.ogg"
  ],
  "confirm": [
    "./audio/sourced/physical-ui/clank1.ogg"
  ],
  "cancel": [
    "./audio/sourced/physical-ui/lightclunk1.ogg"
  ],
  "pause": [
    "./audio/sourced/physical-ui/lightclunk2.ogg"
  ],
  "fail": [
    "./audio/sourced/physical-ui/rattle1.ogg"
  ],
  "toggle": [
    "./audio/sourced/physical-ui/mechanical1.ogg",
    "./audio/sourced/physical-ui/mechanical2.ogg"
  ],
  "equip": [
    "./audio/sourced/industrial/weapon-pickup.ogg"
  ]
});
