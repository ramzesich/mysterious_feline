// LEVEL 2 — The Long Way Down. Bumbot goes DOWN, from the roof he finished level 1 on to a
// half-open second-floor window, zig-zagging between two buildings a street's width apart.
// Registered into LEVELS by map.js.
//
// Design budget (vertical, 400x620). Everything about level 1's budget inverts here:
//   * The world is exactly one screen wide (worldWidth 400), so the camera never pans in x —
//     the clamp in cameraForX resolves to 0 on its own. The two buildings ARE the frame edges;
//     there is no wall entity to collide with, because catX is already clamped to 0..350.
//   * MISSING A LEDGE IS FATAL, and not because of anything at the bottom. The camera holds still
//     while he is airborne and only re-aims when he lands, so a missed drop carries him off the
//     bottom of the frame and kills him — the same read as falling into an alley in level 1. That
//     puts a hard ceiling on a drop: from a ledge top H the camera sits at H-289, the visible bottom
//     edge is H-329, and death lands at H-369. **Keep every drop under ~250px** so the target is
//     comfortably on screen before he commits to it. A 300px drop is survivable but invisible, which
//     is just cruel.
//   * Cross-wall reach is the other half of it, and the two limits pull in opposite directions.
//     Walking off the lip, he leaves the upper ledge already at its edge and gets
//         travel = 11.07 * sqrt(drop)      (moveSpeed 7 over sqrt(2*drop/gravity) frames)
//     against a requirement of
//         needed = 365 - W_upper - W_lower
//     So *narrow ledges on both walls can make a gap uncrossable no matter how far he falls* — two
//     90px ledges need 185px of travel, which a 250px drop still cannot buy. Check both numbers when
//     you move anything. Every transition below clears its requirement by at least 25px on a plain
//     walk-off, no jump needed; jumping adds ~262px of travel on top for anyone who wants slack.
//   * Spacing is deliberately UNEVEN — drops run 130 to 250 and widths 110 to 190, so the descent
//     has a rhythm instead of a metronome. Do not regularise it.
//   * ONE-WAY. Jump apex is ~141px against drops of 130+, so he can never climb back up. A missed
//     snack is missed for the run, and the checkpoint is the only mercy in the level — which is why
//     it sits at the midpoint.
//   * `lethalFloor` makes the street at y=0 fatal, but it only bites on the last couple of ledges,
//     where the camera has hit its bottom clamp and can no longer be fallen out of.
//   * Fast falls are why stepPhysics slices by distance: terminal speed down a 620px screen is
//     ~31px/frame against 15px slabs, which would tunnel clean through a balcony.
//
// Ledge variants (`variant`): balcony, gargoyle, sill, awning. Cosmetic only — collision is the
// same 15px slab as level 1's catwalks. `side` is which wall the ledge grows out from, and a right
// ledge's `x` is always 400 - width, because it is bolted to the right-hand building.

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

    // The way out: a half-open window in the LEFT wall, below the last ledge — so the final move of
    // the level is a drop *into* it rather than onto another balcony. Miss and the street has him.
    goal: { x: 0, y: 100, width: 110, height: 100 },

    objects: [
        // === The roof he arrives on, wide and safe. The level opens with him stepping off it.
        { type: 'platform', x: 0, width: 190, height: 4095, side: 'left', variant: 'balcony' },

        // === Upper storeys: gentle, to teach that walking off the lip is the whole verb. Drops
        // 150 / 205 / 135.
        { type: 'platform', x: 250, width: 150, height: 3945, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 3740, side: 'left', variant: 'sill' },
        { type: 'platform', x: 230, width: 170, height: 3605, side: 'right', variant: 'balcony' },

        // === The first long one, onto a narrow sill. Drops 240 / 175 / 130.
        { type: 'platform', x: 0, width: 130, height: 3365, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 240, width: 160, height: 3190, side: 'right', variant: 'awning' },
        { type: 'platform', x: 0, width: 120, height: 3060, side: 'left', variant: 'gargoyle' },

        // === Tightest reach in the level: two narrow ledges, 110 and 120, needing 135px of travel
        // against 166px available. Drops 225 / 190 / 145.
        { type: 'platform', x: 290, width: 110, height: 2835, side: 'right', variant: 'gargoyle' },
        { type: 'platform', x: 0, width: 150, height: 2645, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 210, width: 190, height: 2500, side: 'right', variant: 'balcony' },

        // === Halfway. A long drop onto the balcony with the window he squeezes out of on every
        // respawn from here on. Drops 235 / 165.
        { type: 'platform', x: 0, width: 120, height: 2265, side: 'left', variant: 'sill' },
        { type: 'platform', x: 230, width: 170, height: 2100, side: 'right', variant: 'balcony' },
        { type: 'portal', x: 330, y: 2115 },

        // === Lower storeys, mixed rhythm. Drops 200 / 130 / 245 / 160 / 215 / 140.
        { type: 'platform', x: 0, width: 160, height: 1900, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 250, width: 150, height: 1770, side: 'right', variant: 'sill' },
        { type: 'platform', x: 0, width: 130, height: 1525, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 220, width: 180, height: 1365, side: 'right', variant: 'awning' },
        { type: 'platform', x: 0, width: 110, height: 1150, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 240, width: 160, height: 1010, side: 'right', variant: 'balcony' },

        // === The last three, and the longest drop in the level at 250. Drops 230 / 170 / 250.
        { type: 'platform', x: 0, width: 140, height: 780, side: 'left', variant: 'sill' },
        { type: 'platform', x: 210, width: 190, height: 610, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 150, height: 360, side: 'left', variant: 'gargoyle' },

        // === The second floor. From here the camera has hit its bottom clamp, so the first floor
        // and the street are both in shot — and the drop off this ledge goes through the window.
        { type: 'platform', x: 250, width: 150, height: 225, side: 'right', variant: 'balcony' },

        // === Two snacks, each sitting on the fall line of a long drop, so they are collected in
        // passing rather than sought out. Currently that makes them easy — earning them is what the
        // disguised ledge is for, and that is still to come.
        { type: 'snack', x: 205, height: 3300 },
        { type: 'snack', x: 205, height: 1460 }
    ],

    // The wildlife arrives with the hazard pass: a pigeon perched on a ledge turning its head,
    // and the old lady with the broom.
    birds: []
};
