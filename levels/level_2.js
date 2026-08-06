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
// Ledge variants (`variant`): balcony, gargoyle, awning — or none at all, which is a plain stone
// ledge with just its corbel. Cosmetic only — collision is the
// same 15px slab as level 1's catwalks. `side` is which wall the ledge grows out from, and a right
// ledge's `x` is always 400 - width, because it is bolted to the right-hand building.
// There was a fourth variant, `sill`, which drew a window above the slab. It is gone: a window
// belongs to the WALL, where the `window` entity already draws it and knows where in the masonry it
// actually sits. Four ledges (3740, 2265, 1770, 780) are the bare ones left behind.
//
// SCENERY DISTRIBUTION is a separate concern from the drop rhythm above, and it wants the opposite
// thing. Drops are deliberately uneven; the variants should be *even*, because a variant is a piece
// of set dressing rather than a beat of gameplay. The gargoyles in particular were all bunched — five
// of six on the left wall, three of them inside one 530px stretch and then a 1310px stretch with
// none — which read as "the artist got bored here" instead of as a facade. They now alternate walls
// strictly, right/left all the way down, 515-650px apart.
// The check that matters when moving one: does any pair on the SAME wall fall within one frame
// height (620px) of each other? That is what reads as a cluster; the raw spacing barely matters.
//
// The one deliberate exception is the 975px stretch between 2500 and 1525, which carries no gargoyle
// at all. That is the CHECKPOINT's stretch — it already holds two plain ledges and the respawn
// balcony, and
// the one landmark in the level should own the part of the wall it sits on.
//
// Two ledges are pinned and neither is about spacing:
//   * 2100 carries NO railing — it is bare stone. It is the checkpoint ledge, and the sash window sits
//     in the wall directly above its slab: the window's lower third is an open gap he squeezes out of,
//     and a railing stood right in it. Worse, the lit state of that window is translucent there, so the
//     balusters showed *through* the glow. A railing is also the last thing wanted at the one merciful
//     moment in the level now that a railing is something to climb.
//   * 1525 stays a gargoyle, because a gargoyle is the only variant that draws NOTHING above the
//     slab. The sweeper leans out at 1550, and a railing there would reach into her stonework — and
//     since she is z-index 5 against a ledge's 2, *her* sill would paint over it, the reverse of how
//     the decorative windows sit behind one. That inconsistency is precisely what would make her
//     identifiable before she moves.
//
// Where a gargoyle can go is constrained too, and both constraints are about the head hanging BELOW
// the slab. It must sit entirely over its own wall and entirely under its own slab, or the spout
// projects into open air and reads as footing — which on a left ledge means anywhere (the sprite is
// 66px and the wall 110), but on a right ledge means the ledge's right edge is at 400 and the head
// occupies 334-400, so the wall must reach that far.

const LEVEL_2 = {
    id: 'the-long-way-down',
    name: 'The Long Way Down',
    theme: 'facade', // Old masonry seen from outside — see THEME_ART in game.js
    frame: { width: 400, height: 620 },
    axis: 'vertical',
    worldWidth: 400,
    // Deliberately ~340px taller than the spawn ledge. cameraForY wants to centre him, and if the
    // world ends much above his head the clamp wins instead and pins him against the top of the
    // frame with nothing visible above — which reads as broken rather than as high up.
    worldHeight: 4450,
    // He starts OFF SCREEN to the left and walks on. Negative x is permanently invisible in this
    // level — worldWidth equals the frame width, so cameraForX clamps to 0 and never pans, and
    // #gameWindow clips the rest — which is what makes the entrance possible without a wider world.
    // Only the left-walk branch clamps catX to 0, so walking rightward out of negative x needs no
    // special case.
    spawnX: -70,
    spawnY: 4110,      // Standing on the roof below, which tops out at 4095 + 15
    // How he arrives, in place of level 1's climb out of a vent pipe. 'walk-in' walks him on from off
    // screen with player input locked and stops him once he is fully in frame — still up on the roof,
    // with the whole descent ahead of him and the first step down left to the player. It replaced a
    // 'drop' arrival that walked him off the roof and onto the first balcony automatically, which
    // spent the level's opening move before anyone had touched a key.
    // A checkpoint always overrides this with 'emerge', because a checkpoint is by definition a
    // thing he squeezes out of.
    arrival: 'walk-in',
    arrivalDir: 'right',  // Coming from the left, so he walks rightward
    arrivalStopX: 30,     // Clear of the frame edge and near the middle of a 110px roof
    lethalFloor: true, // The street at y=0 kills; there is no safe ground in this level
    pits: [],          // No alleys: the whole level is the gap between two buildings

    // The way out: a half-open window in the LEFT wall, below the last ledge — so the final move of
    // the level is a drop *into* it rather than onto another balcony. Miss and the street has him.
    goal: { x: 0, y: 100, width: 110, height: 100 },

    // The two buildings. They are different WIDTHS (110 and 130) but their roofs are at the same
    // height, so the opening reads as one street seen from between two facing rooftops. Both walls
    // end at 4110 with open sky above them — that patch of sky is the only thing that makes the start
    // read as "off a rooftop" rather than "off another ledge". They live in #world and scroll, because
    // a wall painted on the frame can never end anywhere, and a roof with three more storeys stacked
    // on top of it is not a roof.
    //
    // Two dead ends, kept here because both are easy to re-invent. The right wall first ran past the
    // top of the frame (top: 4450) with a decorative second roofline painted across it at the left
    // roof's height — a rooftop with 340px of masonry standing on it is a ledge, whatever it is drawn
    // like. Then it ended at 4270, which is *worse than it sounds*: `camera = catY - 289`, so the
    // arrival drop onto the first balcony puts the frame top at 4291, and a top 21px above the visible
    // edge — against a sky within a few points of the masonry's own value — is indistinguishable from
    // a wall that never ends at all.
    walls: [
        { side: 'left', width: 110, top: 4110 },
        { side: 'right', width: 130, top: 4110 }
    ],

    objects: [
        // === The roof he arrives on, straight off the end of level 1. Its right edge is flush with
        // its building at 110 — smaller than any balcony below it, and flush rather than cantilevered,
        // because it is the top of the building rather than something bolted to its face. The
        // balconies further down are wider than this and overhang their wall, which is the contrast
        // that makes them read as balconies.
        // It starts at -90 so the walk-in arrival has deck under his feet while he is still off
        // screen. Everything left of 0 is permanently outside the frame in this level, so the roof
        // still *reads* as the 110px one flush with the wall; only the gravel's phase changes.
        { type: 'platform', x: -90, width: 200, height: 4095, side: 'left', variant: 'roof' },
        // Its twin across the street, at the same height and on the same drawing — `.ledge-roof` has
        // no side-specific pseudo-elements, so "mirrored" costs nothing but the `side`. It is a real
        // platform rather than scenery on purpose: it is pixel-for-pixel the deck he is standing on,
        // so it has to behave like one. A decorative twin he dropped through would be the one thing
        // this level's art rules forbid outright — nothing may look like footing unless it is.
        // It never gets in the way of the first step down: walking off the left roof, he has fallen
        // ~128px by the time his box reaches x=235, so he passes this slab's height long before its
        // edge and carries on to the balcony below. He *can* jump across to it (160px gap against
        // ~262px of jump travel), which strands him nowhere — dropping off its left lip lands on that
        // same balcony.
        { type: 'platform', x: 270, width: 130, height: 4095, side: 'right', variant: 'roof' },

        // === Upper storeys: gentle, to teach that walking off the lip is the whole verb. Drops
        // 150 / 205 / 135.
        { type: 'platform', x: 250, width: 150, height: 3945, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 140, height: 3740, side: 'left' },
        { type: 'platform', x: 230, width: 170, height: 3605, side: 'right', variant: 'gargoyle' },

        // === The first long one, onto a narrow sill. Drops 240 / 175 / 130.
        { type: 'platform', x: 0, width: 130, height: 3365, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 240, width: 160, height: 3190, side: 'right', variant: 'awning' },
        { type: 'platform', x: 0, width: 120, height: 3060, side: 'left', variant: 'gargoyle' },

        // === Tightest reach in the level: two narrow ledges, 110 and 120, needing 135px of travel
        // against 166px available. Drops 225 / 190 / 145.
        { type: 'platform', x: 290, width: 110, height: 2835, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 150, height: 2645, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 210, width: 190, height: 2500, side: 'right', variant: 'gargoyle' },

        // === Halfway. A long drop onto the balcony with the window he squeezes out of on every
        // respawn from here on. Drops 235 / 165.
        { type: 'platform', x: 0, width: 120, height: 2265, side: 'left' },
        { type: 'platform', x: 230, width: 170, height: 2100, side: 'right' },
        // `side` here isn't cosmetic like a ledge's — it's what tells the respawn which way is
        // "back into the gap" so he doesn't climb out facing the bricks (see respawnFace in game.js).
        { type: 'portal', x: 330, y: 2115, side: 'right' },

        // === Lower storeys, mixed rhythm. Drops 200 / 130 / 245 / 160 / 215 / 140.
        { type: 'platform', x: 0, width: 160, height: 1900, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 250, width: 150, height: 1770, side: 'right' },
        // The sweeper, mounted on the left wall he's already committed to by the time he's this
        // close (the 245px drop off the sill is the longest horizontal traverse in the level).
        // TWO placement rules, and she is inert if either is broken — she was, both ways, at first:
        //   * x decides how much of the ledge she threatens, since her reach is measured from it.
        //     At 0 she sits at the outer edge of her own building with 60px of masonry between her
        //     and the gap, and the broom sweeps nothing but brick. At 20 her stroke dies at ~95,
        //     which leaves the ledge's last ~35px — its overhang past the wall — as a pocket he can
        //     land in and watch her swipe short. Holding left the whole way down off the sill lands
        //     him at ~77, inside her reach; easing off the key drops him straighter, into the pocket.
        //   * y sits just above the ledge below (slab tops out at 1540), because the lethal band is
        //     her window's own span. Mounted 75px up "so the telegraph has room to play out in the
        //     air", her band started 15px above his ears — she could not have hit him at any x, on
        //     any frame. The telegraph gets its air time from the detect zone instead.
        { type: 'sweeper', x: 20, y: 1550, side: 'left' },
        { type: 'platform', x: 0, width: 130, height: 1525, side: 'left', variant: 'gargoyle' },
        { type: 'platform', x: 220, width: 180, height: 1365, side: 'right', variant: 'awning' },
        { type: 'platform', x: 0, width: 110, height: 1150, side: 'left', variant: 'balcony' },
        { type: 'platform', x: 240, width: 160, height: 1010, side: 'right', variant: 'gargoyle' },

        // === The last three, and the longest drop in the level at 250. Drops 230 / 170 / 250.
        { type: 'platform', x: 0, width: 140, height: 780, side: 'left' },
        { type: 'platform', x: 210, width: 190, height: 610, side: 'right', variant: 'balcony' },
        { type: 'platform', x: 0, width: 150, height: 360, side: 'left', variant: 'gargoyle' },

        // === The second floor. From here the camera has hit its bottom clamp, so the first floor
        // and the street are both in shot — and the drop off this ledge goes through the window.
        { type: 'platform', x: 250, width: 150, height: 225, side: 'right', variant: 'balcony' },

        // The first snack sits on the awning (slab tops out at 3205), at its WALL end — so reaching it
        // means walking back along the canvas, away from the onward route, which is down and to the
        // left. The second is left on its fall line — one of the two stays "collected in passing" on
        // purpose, so the level teaches the easy read before asking for the careful one.
        // It used to sit at x:195 over a hidden ledge at 3245, which is gone; left there it would have
        // floated in the middle of the open slot, reachable only by falling down the one channel that
        // kills you.
        { type: 'snack', x: 360, height: 3215 },
        { type: 'snack', x: 205, height: 1460 },

        // === Windows. Pure scenery — no collision, nothing to collect — and they do two jobs. They
        // give the masonry somewhere for people to live, and they are the sweeper's camouflage: she is
        // the same 50x64 `.wall-window` drawing, so with only her own window in the level she was the
        // one thing on the facade worth looking at.
        //
        // Coverage: these 8, plus the checkpoint's sash window and the sweeper = 10 of the 21 wall
        // ledges. It used to be 14, because the four `sill` ledges drew a window of their own; that
        // variant is gone, so these are now the only ordinary windows in the level and they carry the
        // sweeper's camouflage on their own. If this list ever shrinks, check her first — she is only
        // hidden for as long as an unremarkable window is a common sight on this facade.
        // `y` is the ledge's slab top + 10 throughout, matching hers, which puts the window's stone
        // sill just clear of the slab. On a balcony the 18px railing then crosses the bottom of the
        // glass, which is what a balcony looks like — z-index 1 keeps the glass behind it.
        // `x` is ONE value per wall — 20 on the left, 312 on the right — so every window on a face lines
        // up in a single vertical bay, which is how a real building is built. They used to be scattered
        // across 24px on the left and 18px on the right, which read as sloppy rather than as variety, and
        // the outlier at x=38 pushed its stone sill 4px into the downpipe.
        // The left value is 20 because that is the SWEEPER's x, and hers is not free — it is tuned so her
        // stroke dies short of the ledge's outer lip. So the windows align to her rather than the other
        // way round, which makes her camouflage better than it was: before, she was the only window on
        // the wall at x=20.
        // Both values also have to clear the wall furniture. A window's stone surround runs 6px past its
        // box each side, so x=20 spans 14-76 against the left pipe's knee at 78, and x=312 spans 306-368
        // against the right pipe's knee ending at 297.
        //
        // The un-windowed third is chosen, not left over: both awnings (canvas belongs over a shop
        // front, not under a bedroom) and the whole bottom of the shaft — below 780 there is nothing
        // but the goal window, so it stays the only lit thing down there.
        { type: 'window', x: 312, y: 3970 },  // over the first balcony
        { type: 'window', x: 312, y: 3630 },
        { type: 'window', x: 20,  y: 3390 },
        { type: 'window', x: 20,  y: 3085 },
        { type: 'window', x: 20,  y: 2670 },
        { type: 'window', x: 312, y: 2525 },
        { type: 'window', x: 20,  y: 1175 },
        { type: 'window', x: 312, y: 1035 },

        // === Wall furniture. Pure scenery like the windows, and the answer to a facade whose ledges
        // had four looks while the masonry between them had none.
        //
        // WHERE THEY CAN GO IS ALMOST FULLY DETERMINED, which is worth knowing before moving one. The
        // windows sit in one bay per wall — x 14-76 on the left including their stone surrounds, and
        // x 306-368 on the right — and the gargoyle sprites take x 0-66 and 334-400. That leaves exactly
        // two clear vertical strips: x 76-110 and x 270-306 — both at the walls' INNER faces, looking
        // into the gap. That is lucky rather than awkward: a downpipe and a fire escape belong on the
        // light-well elevation of a building, not on its street front.
        //
        // Spacing follows the same rule as the gargoyles, applied PER TYPE: no two of a kind on the
        // same wall close enough to share a 620px frame. Each type here has one per wall, so the rule
        // is satisfied by construction.
        //
        // Two long pipe runs, on opposite walls and in opposite halves of the shaft. Length is the
        // point — they are the only decoration that can tie storeys together, so they are what stops
        // the wall reading as one flat surface for 4000px.
        // `side` is which wall, and it decides which way BOTH knees turn: a pipe run has to arrive from
        // somewhere and go somewhere, so each end bends into the masonry rather than stopping in mid-air.
        // The elbow is a true right angle on screen; the 45° turn into the wall is carried by
        // foreshortening and shading, not by drawing a diagonal (see .downpipe::before in style.css).
        // Each knee projects 12px past the barrel, so a pipe needs that much wall beside it — which is
        // why these sit at x 90 and x 276 rather than hard against the walls' inner faces.
        // The bottom of the left run also had to move up from 2680 to 2720: the balcony at 2645 carries
        // its railing to 2686, and at z-index 11 against a pipe's 1 that railing painted over the lower
        // 6px of the knee, hiding part of the one detail that stops the run ending in mid-air.
        { type: 'downpipe', x: 90,  y: 2720, height: 1140, side: 'left' },
        { type: 'downpipe', x: 276, y: 560,  height: 1120, side: 'right' },

        // The ladders are BROKEN — see .fire-ladder in style.css. Short runs, deliberately: a long one
        // starts to look like a route, and there is no climbing in this game. Each one ends in mid-air
        // with two snapped stubs, which is what makes it scenery rather than a promise.
        { type: 'ladder', x: 88,  y: 880,  height: 280 },
        { type: 'ladder', x: 274, y: 2200, height: 300, side: 'right' },

        // Both ropes run ALONG a wall, strung between two brackets on the same face. There was a third
        // arrangement — one spanning the full gap, which is the iconic look — and it is gone on purpose.
        // A taut-ish line across the shaft is the one silhouette in this level that can be mistaken for
        // something to land on, and no amount of sag or hung cloth fixes that reliably: the middle 90px
        // of the span had no ledge under it at all, so reaching for it was simply a fall. An along-wall
        // rope carries the same "someone lives here" cue with none of that ambiguity, which is the whole
        // reason to prefer it.
        { type: 'laundry', x: 8,   y: 2380, width: 96 },
        { type: 'laundry', x: 284, y: 3300, width: 106 },

        // A window over each rope, because washing does not appear on a blank wall — somebody leaned out
        // of something to hang it. These use the `scullery` variant: the same 50x64 opening and the same
        // stone lintel and sill as every other window, six small panes instead of four large ones, and
        // the sash pushed up so the bottom of it is open. That open sash is what ties the two together.
        // Sat 2px above each rope, so each window's stone sill just laps the rope's top and the rope
        // reads as tied under it. Neither needed the rope moved down — both landed in clear stretches of
        // wall with no ledge, gargoyle sprite or existing window in the way.
        // `x` matches the rest of its wall's bay rather than centring on the rope — alignment down the
        // facade matters more than being centred on one piece of string, and washing hung out of a window
        // does not politely centre itself anyway. The left rope runs 8-104 under a window at 14-76, so it
        // trails off to the right of the opening, which is what a real line does.
        { type: 'window', x: 20,  y: 2420, variant: 'scullery' },
        { type: 'window', x: 312, y: 3340, variant: 'scullery' }
    ],

    // The wildlife arrives with the hazard pass: a pigeon perched on a ledge turning its head
    // (below), and the old lady with the broom (the `sweeper` object above, in `objects` rather
    // than here — she's proximity-triggered rather than patrolling, so she's built like the
    // portal/platform furniture instead of a bird).
    //
    // The pigeon sits on the third ledge — the tail end of the deliberately gentle intro run —
    // parked at the far right of a 170px balcony (flush right wall, so x=350 is 50px from the
    // edge). A plain walk-off from the sill above lands around x=269 holding right the whole way,
    // so the default line touches down well clear of it; only drifting further right finds it.
    // First hazard in the level, so it gets the widest possible margin for error.
    birds: [
        { x: 350, y: 3620, axis: 'walk', min: 350, max: 350, speed: 0, facing: 'left' }
    ]
};
