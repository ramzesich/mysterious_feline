// LEVEL 2 — The Long Way Down. Bumbot goes DOWN, from the roof he finished level 1 on to a
// half-open second-floor window, zig-zagging between two buildings a street's width apart.
// Registered into LEVELS by map.js.
//
// Design budget (vertical, 400x620). Everything about level 1's budget inverts here:
//   * The world is exactly one screen wide (worldWidth 400), so the camera never pans in x —
//     the clamp in cameraForX resolves to 0 on its own. The two buildings ARE the frame edges;
//     there is no wall entity to collide with, because catX is already clamped to 0..350.
//   * Ledges reach 140px out from each wall, leaving a 120px slot down the middle. That slot is
//     clear the whole way down on purpose: a player who hugs it falls 4000px to the street and
//     dies, so the shortcut punishes itself rather than needing a barrier.
//   * Vertical spacing is ~185px. A 185px fall takes ~21.5 frames, which carries him ~150px
//     sideways at moveSpeed 7 — against a 120px gap that is ~30px of margin before he even
//     jumps. Tighten the spacing and the gap stops being crossable; widen it past ~260px and
//     he outruns the ledge below.
//   * ONE-WAY. Jump apex is ~141px against 185px spacing, so he can never climb back up. A
//     missed snack is missed for the run, and the checkpoint is the only mercy in the level —
//     which is why it sits at the midpoint.
//   * The floor at y=0 is the street, and `lethalFloor` makes touching it fatal. Falling is the
//     route here, so the failure state had to move to the bottom of the shaft.
//   * Fast falls are why stepPhysics slices by distance: terminal speed down a 620px screen is
//     ~31px/frame against 15px slabs, which would tunnel clean through a balcony.
//
// Ledge variants (`variant`): balcony, gargoyle, sill, awning. Cosmetic only — collision is the
// same 15px slab as level 1's catwalks. `side` is which wall the ledge grows out from.

const LEVEL_2 = {
    id: 'the-long-way-down',
    name: 'The Long Way Down',
    frame: { width: 400, height: 620 },
    axis: 'vertical',
    worldWidth: 400,
    // Deliberately ~340px taller than the spawn ledge. cameraForY wants to centre him, and if the
    // world ends much above his head the clamp wins instead and pins him against the top of the
    // frame with nothing visible above — which reads as broken rather than as high up.
    worldHeight: 4450,
    spawnX: 40,
    spawnY: 4110,      // Standing on the roof ledge below, which tops out at 4095 + 15
    lethalFloor: true, // The street at y=0 kills; there is no safe ground in this level
    pits: [],          // No alleys: the whole level is the gap between two buildings

    // Reaching this wins the level. A rect rather than level 1's win line, because "the far
    // right-hand edge" means nothing when the level runs downward.
    goal: { x: 304, y: 240, width: 96, height: 84 },

    objects: [
        // === The roof he arrives on. The level opens with him stepping off it.
        { type: 'platform', x: 0, width: 170, height: 4095, side: 'left', variant: 'balcony' },

        // === The descent. Alternating walls, ~185px apart, all the way down.
        { type: 'platform', x: 260, width: 140, height: 3910, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 3725, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 260, width: 140, height: 3540, side: 'right', variant: 'sill' },
        { type: 'platform', x: 0, width: 170, height: 3355, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 260, width: 140, height: 3170, side: 'right', variant: 'awning' },
        { type: 'platform', x: 0, width: 140, height: 2985, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 260, width: 140, height: 2800, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 2615, side: 'left', variant: 'sill' },
        { type: 'platform', x: 260, width: 170, height: 2430, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 2245, side: 'left', variant: 'awning' },

        // === Halfway. The window he squeezes out of on every respawn from here on.
        { type: 'platform', x: 260, width: 140, height: 2060, side: 'right', variant: 'balcony' },
        { type: 'portal', x: 300, y: 2075 },

        { type: 'platform', x: 0, width: 140, height: 1875, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 260, width: 140, height: 1690, side: 'right', variant: 'sill' },
        { type: 'platform', x: 0, width: 170, height: 1505, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 260, width: 140, height: 1320, side: 'right', variant: 'awning' },
        { type: 'platform', x: 0, width: 140, height: 1135, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 260, width: 140, height: 950, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 765, side: 'left', variant: 'sill' },
        { type: 'platform', x: 260, width: 170, height: 580, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 395, side: 'left', variant: 'gargoyle' },

        // === The second floor. The last ledge, with the open window along the wall from it, and
        // the street close enough below to see what the drop would have cost.
        { type: 'platform', x: 260, width: 140, height: 225, side: 'right', variant: 'balcony' },

        // === Two snacks, sitting in the middle slot. NOT on the ledge-to-ledge route: a headless
        // descent holding one direction per drop collects neither, because holding a direction
        // carries him ~150px sideways and past them. As placed, the only way to reach one is to
        // walk off and *release* the key so he drops nearly straight down the slot — then re-press
        // to catch the next ledge before the street. That is a genuinely nice risk/reward, but it is
        // currently an accident of the numbers rather than a designed line: verify both are actually
        // grabbable, and that a failed attempt is survivable, before calling this finished.
        { type: 'snack', x: 180, height: 3290 },
        { type: 'snack', x: 170, height: 1420 }
    ],

    // The wildlife arrives with the hazard pass: a pigeon perched on a ledge turning its head,
    // and the old lady with the broom.
    birds: []
};
