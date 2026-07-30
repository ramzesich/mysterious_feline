// Level data. Each zone is self-contained: its own length, spawn, ground gaps, objects
// and birds. game.js reads ZONES[zoneIndex], so adding a second zone here is all that
// is needed for it to become playable — the win screen will offer it as the next zone.
//
// Zone 1 runs along the rooftops, and the ground data says so: every pit is the alley between
// two buildings, so gaps only ever land on a building boundary and each stretch of ground
// between them is one roof with its own character. Read that rhythm before moving anything —
// a gap dropped mid-roof breaks the whole read.
//
// Design budget for zone 1's physics (moveSpeed 7 / gravity 0.8 / jumpForce 15):
//   * Jump apex ~141px, so a platform's `height` must stay <= 125 (its slab sits at
//     height + 15) or it cannot be reached from the ground.
//   * Max horizontal jump ~260px. Alleys are kept <= 200px so every gap has landing margin.
//   * Installations (pillar type) stay <= 125. Above ~130 there is not enough time above the
//     top to clear a 40px-wide box, which would silently make a Sonic Meow mandatory.
//   * Hazards stay ~120px clear of an alley edge, so clearing one never throws Bumbot in.
//   * Pigeons on foot are as lethal as the crows in the air. Their min/max must stay inside one
//     roof, speed <= 2 so an approaching bird can be jumped, and none of them patrols the
//     landing side of a gap.
//   * The whole zone is completable without spending a single snack. Meows are a
//     convenience, never a requirement.
//   * Only ~310px of air exists above the ground and the camera never pans vertically,
//     so nothing playable should sit above y ~265.
//
// Installation variants (pillar `variant`): hatch, ac, fan, tank, stack. Omitting it lets
// game.js pick one from the height, so no box ever renders anonymous.

const ZONES = [
    {
        id: 'neon-outskirts',
        name: 'Neon Outskirts',
        worldWidth: 16000,
        spawnX: 50,

        // Building boundaries. Falling into an alley is lethal, and no meow can remove one,
        // which is what keeps the snack economy optional. Widths ramp up across the zone.
        pits: [
            { x: 2300, width: 110 },  // First alley: deliberately narrow enough to walk-jump
            { x: 3400, width: 120 },
            { x: 4500, width: 140 },
            { x: 5700, width: 150 },
            { x: 6900, width: 160 },
            { x: 8450, width: 170 },  // Spanned by a gondola for anyone who wants the safe way
            { x: 9550, width: 160 },
            { x: 10450, width: 180 },
            { x: 11700, width: 190 },
            { x: 12900, width: 190 },
            { x: 13950, width: 200 }, // The widest alley in the zone, at the max fair width
            { x: 15250, width: 150 }
        ],

        objects: [
            // === Roof 1 (0 - 2300) — the quiet roof: basics on one long, unbroken building
            // The pipe Bumbot climbs out of. Scenery only: nothing collides with it and the
            // meow cannot clear it, so it can sit right on top of the spawn.
            { type: 'pipe', x: 36 },
            { type: 'pillar', x: 300, width: 40, height: 40, variant: 'hatch' },
            { type: 'spike', x: 560, width: 30, height: 15 },
            { type: 'pillar', x: 1150, width: 40, height: 60, variant: 'ac' },
            { type: 'platform', x: 1350, width: 150, height: 80 },
            { type: 'spike', x: 1620, width: 30, height: 15 },
            { type: 'pillar', x: 1800, width: 40, height: 50, variant: 'fan' },
            // First snack, impossible to miss, on the roof's last catwalk
            { type: 'platform', x: 2020, width: 120, height: 90 },
            { type: 'snack', x: 2070, height: 115 },

            // === Roof 2 (2410 - 3400) — the plant room: a bank of condensers to hop
            { type: 'pillar', x: 2500, width: 40, height: 55, variant: 'ac' },
            { type: 'pillar', x: 2620, width: 40, height: 65, variant: 'ac' },
            { type: 'spike', x: 2820, width: 30, height: 15 },
            { type: 'pillar', x: 3000, width: 40, height: 90, variant: 'tank' },
            { type: 'platform', x: 3160, width: 150, height: 70 },

            // === Roof 3 (3520 - 4500) — bare gravel: mostly a running stretch with a resident
            { type: 'spike', x: 3700, width: 30, height: 15 },
            { type: 'pillar', x: 4180, width: 40, height: 100, variant: 'stack' },
            { type: 'spike', x: 4350, width: 30, height: 15 },

            // === Roof 4 (4640 - 5700) — the fan roof, and wire strung along a catwalk
            { type: 'platform', x: 4800, width: 180, height: 85 },
            { type: 'spike', x: 4900, width: 30, height: 15, y: 100 }, // Strung along the catwalk above
            { type: 'pillar', x: 5100, width: 40, height: 90, variant: 'tank' },
            { type: 'pillar', x: 5320, width: 40, height: 50, variant: 'fan' },
            { type: 'spike', x: 5500, width: 30, height: 15 },

            // === Roof 5 (5850 - 6900) — first gondola, kept well clear of the vent stack
            { type: 'pillar', x: 6020, width: 40, height: 110, variant: 'stack' },
            { type: 'mover', x: 6150, width: 110, height: 70, axis: 'x', range: 220, speed: 1.6 },
            { type: 'platform', x: 6500, width: 180, height: 100 },
            { type: 'spike', x: 6620, width: 30, height: 15, y: 115 },
            { type: 'spike', x: 6720, width: 30, height: 15 },

            // === Roof 6 (7060 - 8450) — the long checkpoint roof
            { type: 'pillar', x: 7200, width: 40, height: 120, variant: 'stack' },
            { type: 'platform', x: 7450, width: 150, height: 60 },
            { type: 'spike', x: 7700, width: 30, height: 15 },
            // The checkpoint pipe, mid-map on guaranteed solid ground
            { type: 'portal', x: 8000 },
            { type: 'pillar', x: 8250, width: 40, height: 60, variant: 'ac' },

            // === The 8450 alley — a gondola crossing it, for anyone who does not want to jump
            { type: 'mover', x: 8340, width: 120, height: 95, axis: 'x', range: 300, speed: 1.8 },

            // === Roof 7 (8620 - 9550)
            { type: 'spike', x: 8800, width: 30, height: 15 },
            { type: 'platform', x: 9000, width: 180, height: 85 },
            { type: 'spike', x: 9120, width: 30, height: 15, y: 100 },
            { type: 'pillar', x: 9350, width: 40, height: 100, variant: 'stack' },

            // === Roof 8 (9710 - 10450) — the hoist roof, short and vertical
            { type: 'mover', x: 9800, width: 110, height: 60, axis: 'y', range: 90, speed: 1.2 },
            { type: 'platform', x: 10050, width: 200, height: 120 },
            { type: 'spike', x: 10250, width: 30, height: 15 },

            // === Roof 9 (10630 - 11700) — the secret.
            // The snack below is visible from the deck but out of reach from the low catwalk
            // (apex from its slab tops out at 241). The only way up is the invisible platform
            // between them.
            { type: 'platform', x: 10800, width: 150, height: 40 },
            { type: 'platform', x: 11020, width: 100, height: 120, hidden: true },
            { type: 'snack', x: 11050, height: 250 },
            { type: 'spike', x: 11250, width: 30, height: 15 },

            // === Roof 10 (11890 - 12900) — everything at once
            { type: 'pillar', x: 12020, width: 40, height: 80, variant: 'tank' },
            { type: 'platform', x: 12200, width: 200, height: 90 },
            { type: 'spike', x: 12340, width: 30, height: 15, y: 105 },
            { type: 'spike', x: 12550, width: 30, height: 15 },
            { type: 'mover', x: 12650, width: 120, height: 80, axis: 'x', range: 190, speed: 2.0 },

            // === Roof 11 (13090 - 13950)
            { type: 'pillar', x: 13200, width: 40, height: 110, variant: 'stack' },
            { type: 'spike', x: 13450, width: 30, height: 15 },
            { type: 'platform', x: 13600, width: 180, height: 105 },
            { type: 'spike', x: 13710, width: 30, height: 15, y: 120 },

            // === Roof 12 (14150 - 15250) — the last gauntlet
            { type: 'pillar', x: 14250, width: 40, height: 120, variant: 'stack' },
            { type: 'spike', x: 14550, width: 30, height: 15 },
            { type: 'mover', x: 14700, width: 110, height: 70, axis: 'y', range: 100, speed: 1.4 },
            { type: 'platform', x: 14980, width: 180, height: 75 },

            // === Roof 13 (15400 - 16000) — the feeder's roof, kept clear for a clean finish
            { type: 'pillar', x: 15550, width: 40, height: 40, variant: 'hatch' }
        ],

        // The zone's wildlife. `axis` picks both the behaviour and the species, because up here
        // they are the same thing: 'walk' is a pigeon strutting a surface at `y` (0 is the roof
        // deck), while 'x' and 'y' are crows working the air — patrolling across, or hovering up
        // and down. All three are equally lethal on contact.
        birds: [
            { x: 800, y: 0, axis: 'walk', min: 700, max: 1000, speed: 1.4 },   // Roof 1's resident
            { x: 1200, y: 150, axis: 'x', min: 1000, max: 1400, speed: 2 },
            { x: 2560, y: 180, axis: 'x', min: 2450, max: 2800, speed: 2.2 },
            { x: 3900, y: 0, axis: 'walk', min: 3800, max: 4100, speed: 1.6 }, // Owns the bare roof
            { x: 5250, y: 60, axis: 'y', min: 60, max: 200, speed: 1.6 },      // Between two catwalks
            { x: 6400, y: 170, axis: 'x', min: 6200, max: 6700, speed: 2.6 },
            { x: 7350, y: 170, axis: 'x', min: 7150, max: 7600, speed: 2.4 },
            { x: 8900, y: 70, axis: 'y', min: 70, max: 210, speed: 2 },
            { x: 10800, y: 130, axis: 'x', min: 10700, max: 10980, speed: 2.8 }, // Guards the secret
            { x: 11450, y: 0, axis: 'walk', min: 11380, max: 11550, speed: 1.5 },
            { x: 12400, y: 150, axis: 'x', min: 12250, max: 12750, speed: 3 },
            { x: 13800, y: 60, axis: 'y', min: 60, max: 220, speed: 2.2 },
            { x: 14380, y: 0, axis: 'walk', min: 14300, max: 14460, speed: 1.4 },
            { x: 15100, y: 170, axis: 'x', min: 14900, max: 15200, speed: 2.4 }
        ]
    }
];
