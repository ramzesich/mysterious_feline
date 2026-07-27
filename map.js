// Level data. Each zone is self-contained: its own length, spawn, ground gaps, objects
// and pigeons. game.js reads ZONES[zoneIndex], so adding a second zone here is all that
// is needed for it to become playable — the win screen will offer it as the next zone.
//
// Design budget for zone 1's physics (moveSpeed 7 / gravity 0.8 / jumpForce 15):
//   * Jump apex ~141px, so a platform's `height` must stay <= 125 (its slab sits at
//     height + 15) or it cannot be reached from the ground.
//   * Max horizontal jump ~260px. Pits are kept <= 200px so every gap has landing margin.
//   * Pillars stay <= 125. Above ~130 there is not enough time above the top to clear a
//     40px-wide pillar, which would silently make a Sonic Meow mandatory.
//   * The whole zone is completable without spending a single battery. Meows are a
//     convenience, never a requirement.
//   * Only ~310px of air exists above the ground and the camera never pans vertically,
//     so nothing playable should sit above y ~265.

const ZONES = [
    {
        id: 'neon-outskirts',
        name: 'Neon Outskirts',
        worldWidth: 16000,
        spawnX: 50,

        // Gaps in the ground. Falling into one is lethal, and no meow can remove them,
        // which is what keeps the battery economy optional.
        pits: [
            { x: 2900, width: 110 },  // First pit: deliberately narrow enough to walk-jump
            { x: 3400, width: 140 },
            { x: 4050, width: 160 },
            { x: 4750, width: 180 },
            { x: 5950, width: 150 },
            { x: 7050, width: 170 },
            { x: 8500, width: 190 },  // Spanned by a mover for anyone who wants the safe way
            { x: 9300, width: 160 },
            { x: 10500, width: 180 },
            { x: 11850, width: 170 },
            { x: 12900, width: 190 },
            { x: 13900, width: 200 }, // The widest gap in the zone, at the max fair width
            { x: 15300, width: 150 }
        ],

        objects: [
            // --- Beat A (0 - 2000): the basics on safe, continuous ground
            { type: 'pillar', x: 300, width: 40, height: 40 },
            { type: 'spike', x: 550, width: 30, height: 15 },
            { type: 'pillar', x: 750, width: 40, height: 60 },
            { type: 'platform', x: 1000, width: 150, height: 80 },
            { type: 'spike', x: 1300, width: 30, height: 15 },
            { type: 'pillar', x: 1600, width: 40, height: 50 },
            { type: 'spike', x: 1850, width: 30, height: 15 },

            // --- Beat B (2100 - 5200): first battery, then pits are introduced
            { type: 'platform', x: 2100, width: 120, height: 90 },
            { type: 'battery', x: 2150, height: 115 }, // Early reward, impossible to miss
            { type: 'pillar', x: 2400, width: 40, height: 90 },
            { type: 'spike', x: 2650, width: 30, height: 15 },
            { type: 'pillar', x: 3150, width: 40, height: 50 },
            { type: 'spike', x: 3650, width: 30, height: 15 },
            { type: 'platform', x: 3800, width: 150, height: 70 },
            { type: 'spike', x: 4300, width: 30, height: 15 },
            { type: 'pillar', x: 4500, width: 40, height: 100 },
            { type: 'platform', x: 5000, width: 180, height: 85 },

            // --- Beat C (5300 - 7800): the high route stops being safe, first mover
            { type: 'platform', x: 5300, width: 200, height: 80 },
            { type: 'spike', x: 5450, width: 30, height: 15, y: 95 }, // Mounted on the slab above
            { type: 'pillar', x: 5700, width: 40, height: 110 },
            { type: 'mover', x: 6150, width: 110, height: 70, axis: 'x', range: 220, speed: 1.6 },
            { type: 'platform', x: 6500, width: 180, height: 100 },
            { type: 'spike', x: 6620, width: 30, height: 15, y: 115 },
            { type: 'spike', x: 6850, width: 30, height: 15 },
            { type: 'pillar', x: 7300, width: 40, height: 120 },
            { type: 'platform', x: 7550, width: 150, height: 60 },
            { type: 'spike', x: 7750, width: 30, height: 15 },

            // --- The checkpoint, mid-map on guaranteed solid ground
            { type: 'feeder', x: 8000 },

            // --- Beat D (8250 - 11300): movers over pits, then the hidden battery
            { type: 'pillar', x: 8250, width: 40, height: 70 },
            { type: 'mover', x: 8480, width: 120, height: 95, axis: 'x', range: 230, speed: 1.8 },
            { type: 'spike', x: 8850, width: 30, height: 15 },
            { type: 'platform', x: 9050, width: 180, height: 85 },
            { type: 'spike', x: 9170, width: 30, height: 15, y: 100 },
            { type: 'pillar', x: 9550, width: 40, height: 100 },
            { type: 'mover', x: 9800, width: 110, height: 60, axis: 'y', range: 90, speed: 1.2 }, // Elevator
            { type: 'platform', x: 10050, width: 200, height: 120 },
            { type: 'spike', x: 10250, width: 30, height: 15 },

            // The battery below is visible from the ground but out of reach from the low
            // platform (apex from its slab tops out at 241). The only way up is the
            // invisible platform between them.
            { type: 'platform', x: 10800, width: 150, height: 40 },
            { type: 'platform', x: 11020, width: 100, height: 120, hidden: true },
            { type: 'battery', x: 11050, height: 250 },
            { type: 'spike', x: 11250, width: 30, height: 15 },

            // --- Beat E (11600 - 15100): everything at once, then a clean run to the portal
            { type: 'pillar', x: 11600, width: 40, height: 80 },
            { type: 'platform', x: 12050, width: 200, height: 90 },
            { type: 'spike', x: 12190, width: 30, height: 15, y: 105 },
            { type: 'spike', x: 12400, width: 30, height: 15 },
            { type: 'mover', x: 12550, width: 120, height: 80, axis: 'x', range: 240, speed: 2.0 },
            { type: 'pillar', x: 13150, width: 40, height: 110 },
            { type: 'spike', x: 13400, width: 30, height: 15 },
            { type: 'platform', x: 13600, width: 180, height: 105 },
            { type: 'spike', x: 13710, width: 30, height: 15, y: 120 },
            { type: 'pillar', x: 14200, width: 40, height: 120 },
            { type: 'spike', x: 14450, width: 30, height: 15 },
            { type: 'mover', x: 14650, width: 110, height: 70, axis: 'y', range: 100, speed: 1.4 },
            { type: 'platform', x: 14950, width: 180, height: 75 }
        ],

        // axis 'x' patrols horizontally between min/max; axis 'y' hovers up and down.
        pigeons: [
            { x: 1200, y: 150, axis: 'x', min: 1000, max: 1400, speed: 2 },
            { x: 2300, y: 180, axis: 'x', min: 2150, max: 2550, speed: 2.2 },
            { x: 3250, y: 120, axis: 'x', min: 3050, max: 3280, speed: 2.4 }, // Stops short of the 3400 pit
            { x: 5250, y: 60, axis: 'y', min: 60, max: 200, speed: 1.6 },    // Hovers between two platforms, never over one
            { x: 6400, y: 170, axis: 'x', min: 6200, max: 6700, speed: 2.6 },
            { x: 8900, y: 70, axis: 'y', min: 70, max: 210, speed: 2 },
            { x: 10800, y: 130, axis: 'x', min: 10700, max: 10980, speed: 2.8 }, // Guards the approach to the secret
            { x: 12400, y: 150, axis: 'x', min: 12250, max: 12750, speed: 3 },
            { x: 14300, y: 60, axis: 'y', min: 60, max: 220, speed: 2.2 },
            { x: 15100, y: 170, axis: 'x', min: 14900, max: 15250, speed: 2.4 }
        ]
    }
];
