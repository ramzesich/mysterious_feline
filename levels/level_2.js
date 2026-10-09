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
//   * `bottomless` means there is no floor at all, so the rule above holds all the way down. The
//     camera's bottom clamp (the bottom of the world) is what frames the goal window's sill, and a
//     miss from the last balcony falls out of that frame like any other.
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
    // No floor at all. The shaft runs on below the frame, and missing the last sill drops him out of
    // sight — the same death as an alley in level 1, instead of landing on a street that was drawn
    // only so it could kill him.
    bottomless: true,
    pits: [],          // No alleys: the whole level is the gap between two buildings

    // The way out: a window in the LEFT wall with the lamp on, sat on its own stone sill (the last
    // platform below). He wins by STANDING in front of it — landing on the sill and stepping in — not by
    // clipping it mid-fall. The rect is the window opening itself, which is also how it is drawn.
    // x 15 centres it on the left wall's window bay (the 50px windows at x 20 centre on 45), and 60x76
    // makes it the biggest opening on the facade without breaking that bay.
    // y 100 is the sill's slab top, and it is also where the camera stops: standing on the last balcony
    // already pins the camera at the bottom of the world, so the frame's lowest edge sits 140px below
    // this sill, with nothing in it but wall. Miss, and that is the drop.
    goal: { x: 15, y: 100, width: 60, height: 76 },

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

        // === The second floor. From here the camera has hit its bottom clamp and stops scrolling, with
        // the goal window and its sill in shot below and to the left.
        { type: 'platform', x: 250, width: 150, height: 225, side: 'right', variant: 'balcony' },

        // The goal window's sill: real footing, and the last ledge in the level. Drop 140 from the
        // balcony, needing 365 - 150 - 130 = 85px of travel against ~131 available — 46px of margin,
        // nearly double the level's 25px floor, on purpose: missing it is the one miss that costs the
        // whole second half. A plain stone ledge rather than a variant: the lamplight the window throws onto
        // its top edge (.goal-window::after) is what marks it out, and a railing here would stand in
        // the opening he has to walk into.
        // Wider than the window (0-130 against 15-75), so he can land short of the opening and walk
        // the last step in.
        { type: 'platform', x: 0, width: 130, height: 85, side: 'left' },

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
    // The first perched pigeon sits on the third ledge — the tail end of the deliberately gentle intro
    // run — on the gargoyle ledge at 3620 (230-400), under that ledge's window. It used to be parked
    // hard against the wall at x=350, which read as tucked away rather than as sat on the sill; x=310
    // puts it in the window's bay. It cannot go to the true middle (~295): a plain walk-off from the
    // ledge above lands around x=269 holding right the whole way (box 269-304), and at 310 the hitbox
    // starts at 316, so the default line still touches down ~12px clear. Drifting further right, or
    // jumping, finds it. First hazard in the level, so it keeps a margin for error.
    //
    // BIRD BUDGET. Level 1's rule — never patrol the landing side of a gap — cannot hold here, because
    // every ledge IS the landing side of one. The replacement rule is that every bird must be readable
    // from the ledge above before he commits, and beaten by waiting for it rather than by luck:
    //   * Bird hitbox is x+6..x+34, y+8..y+32 against his 35x45, for both species.
    //   * A CORRIDOR crow crosses the drop between two ledges on opposite walls (tops TA above, TB
    //     below). Its y must keep the hitbox off both standing bands — TB+37 < y < TA-37 — so it can
    //     never touch him while he stands on either and only threatens the fall. It is in frame from
    //     TA (the frame's bottom edge is TA-329), so the answer is to wait at the lip until it is
    //     on the far side or heading away. Before adding one, check no OTHER ledge top falls inside
    //     y-37..y+32 under its x range, or it quietly becomes a crow that hits a standing cat.
    //   * A SKIMMING crow does hit a standing cat, on purpose — it is the one beaten by jumping. It
    //     clears the 26px railing by a few px so it reads as flying over the iron rather than through
    //     it, which puts its hitbox ~50px up: a tapped jump (~35px) does NOT clear it, a held one does.
    //   * Pigeons walk "windowsills": gargoyle ledges with a window above, never a balcony (they would
    //     walk through the railing, and z-index puts a bird in front of iron he stands behind) and
    //     never the checkpoint ledge (he respawns there) or the sweeper's. Each patrols the WALL end, so
    //     the outer lip he leaves by is always clear: the threat is the landing, where the patrol
    //     overlaps the default walk-off line, and the fix is to drop while it is walking away. Speed
    //     <= 1.2 — under level 1's ceiling, because here he meets them on landing with less room to
    //     react than on a run-up across a roof.
    //   * PERCHED pigeons stand still, so they are placed against the line rather than timed: clear of
    //     the default landing, threatening an overshoot or standing between him and the lip as
    //     something to jump. A tapped jump clears one by only ~3px (35px apex against a hitbox top
    //     32px up); a held jump clears it easily.
    //   * No MOVING bird within a screen of the sweeper (ledges 1785 to 1380): one ambush at a time.
    //     A perched pigeon is not an ambush — it is visible and static — so 1785 carries one.
    //   * Crows fly at 1.5-2.0, slower than level 1's 2-3. A corridor crow is something he waits on
    //     at a lip, and at level 1 speeds the safe window to step off was too short to read.
    birds: [
        { x: 310, y: 3620, axis: 'walk', min: 310, max: 310, speed: 0, facing: 'left' },

        // Perched on the bare ledge at 1785 (250-400), at the wall end and facing the gap — the same
        // arrangement the first one had. He arrives by hopping the balcony rail at 1915: a tap lands
        // around x~327 (box to ~362), just clear of a hitbox starting at 364; a held jump pins him on
        // the wall at 350, on top of it. Leaving is leftward, off the outer lip, so it never stands in
        // the way — which matters here, because a jump off that lip would carry him past the pocket
        // on the sweeper's ledge below and into her reach.
        { x: 358, y: 1785, axis: 'walk', min: 358, max: 358, speed: 0, facing: 'left' },
        // Perched mid-ledge on the gargoyle at 375 (0-150), facing the gap. The hop off the 625 balcony
        // carries him to the wall end (x 0-35), so he lands behind it and has to JUMP it to reach the
        // lip — the one pigeon in the level that is an obstacle on the route rather than beside it.
        // A held jump from there clears it and carries on across the gap, landing on the last balcony
        // (250-400, top 240) at x~340. Covers the bottom of the shaft, which otherwise had only the
        // skimmer below 1025.
        { x: 60,  y: 375,  axis: 'walk', min: 60,  max: 60,  speed: 0, facing: 'right' },

        // Corridor crows, one per section, each a little faster than the last. Their ranges must COVER
        // where he actually is when he falls through their height, not just the middle of the gap: a
        // walk-off covers most of its sideways distance late in the fall, so a crow parked mid-gap at
        // mid-height met almost nothing. Each range is then run long — 230-260px, wall to wall where the
        // stonework allows — so the crow reads as working the whole shaft rather than pacing a box.
        // Widening one is free only while its band stays empty: re-check that no ledge top falls in
        // y-37..y+32 anywhere under the new range. The limits that are not the frame edge are the stone
        // hanging under the ledge above — a gargoyle head or a corbel the crow would fly through.
        // Balcony 3380 (left) -> awning 3205 (right): band 3242-3343. A tapped hop over the rail crosses
        // this crow's height at x~261-331. Nothing hangs at this height on either wall.
        { x: 220, y: 3290, axis: 'x', min: 70,  max: 330, speed: 1.6 },
        // Gargoyle 2515 (right) -> bare 2280 (left): band 2317-2478. Flies just under the lip he steps
        // off — a walk-off is still near the right-hand wall at this height (box x~69-157). Its box tops
        // out at 2500, flush with the underside of the slab, so the wings never cross the stone; max 290
        // stops it short of the gargoyle head under that slab (x 334-400). A 235px drop with ~115px of
        // reach to spare, so it is the stretch that can afford a hazard.
        { x: 160, y: 2460, axis: 'x', min: 30,  max: 290, speed: 1.8 },
        // Checkpoint ledge 2115 (right) -> balcony 1915 (left): band 1952-2078. Same flush-under-the-lip
        // placement (walk-off crosses it at box x~89-177); max 290 stops it short of the corbel under the
        // checkpoint ledge's wall end. The first thing he sees on every respawn, and it cannot reach the
        // ledge he emerges onto — its hitbox tops out at 2092, under the 2115 deck.
        { x: 150, y: 2060, axis: 'x', min: 30,  max: 290, speed: 2.0 },

        // The skimmer: just over the railing of the wide balcony at 625, the second-last proper ledge.
        // He lands into its patrol and has to jump the gap-end rail to leave, so it is met either way —
        // and the held jump that clears the rail clears the crow too. It now runs out over the gap as
        // well as along the balcony, which is the only ledge in its band. Slower than the corridor crows,
        // because here it is standing in his way rather than crossing it.
        { x: 260, y: 645, axis: 'x', min: 130, max: 355, speed: 1.5 },

        // The opening screens, which had a single perched bird on them. Not on the roof he starts on: the
        // walk-in locks his input, so a bird there could kill him before he has a key. (There was one on
        // the OPPOSITE roof, as pure scenery; a pigeon he can only reach by a pointless jump made no sense
        // and it is gone.)
        // Along the TOP RAIL of the first balcony's railing (slab top 3960 + the 26px railing = 3986).
        // Walking on the iron rather than behind it is what makes z-index 12 in front of the railing
        // correct for once. y is 3983, not 3986, because the pigeon sprite's feet are drawn ~3px above
        // the bottom of its box — invisible against a stone ledge's lit top, but on a 3px rail it left
        // the bird visibly hovering. Its hitbox (3991-4015) is at his head height on the floor below it,
        // so it is a real hazard to anyone standing under it — but it keeps to the wall end (hitbox
        // 306-389), the roof walk-off lands at x~246-281, and he leaves over the OTHER end of the railing.
        { x: 330, y: 3983, axis: 'walk', min: 300, max: 355, speed: 0.9 },
        // The bare ledge at 3755 (0-140), straight below the roof he starts on. The awkward ledge for a
        // walker: he arrives by hopping the balcony rail and lands against the WALL (a tap puts him at
        // x~19-54, a held jump pins him at 0), and leaves by the lip at the far end. A patrol on either
        // half alone would always sit on the landing or always block the exit, so this one walks the
        // whole ledge, slowly, and both answers are timing:
        //   * land against the wall while it walks away, then tap-jump over it as it comes back — a tap
        //     clears it by ~3px and carries him off the lip onto the 3620 ledge at x~210-235;
        //   * or ease off the arrow in the air, land out near the lip (x~100) while it is at the wall
        //     end, and step straight off.
        // The trap is a HELD jump from against the wall, which carries him ~315px and onto the perched
        // pigeon at 3620. That is the level's second ledge, so the speed is the slowest in the level.
        { x: 50,  y: 3755, axis: 'walk', min: 0,   max: 100, speed: 0.8 },

        // Windowsill pigeons, on the three gargoyle ledges with a window over them.
        // Gargoyle 3075 (left, 0-120). The walk-off from the awning lands at x~79; the hitbox reaches
        // that far only at the outer end of its patrol, so the default line meets it there and nowhere
        // else — the gentlest of the three, since it is the first walker he meets.
        { x: 20,  y: 3075, axis: 'walk', min: 0,   max: 55,  speed: 1.0 },
        // Gargoyle 2515 (right, 210-400). A tapped hop over the balcony rail at 2660 lands at x~323,
        // inside a 276-389 patrol; a held jump pins him on the wall at 350, right in it.
        { x: 300, y: 2515, axis: 'walk', min: 270, max: 355, speed: 1.1 },
        // Gargoyle 1025 (right, 240-400). The tapped hop over the balcony rail at 1165 lands at x~281,
        // just inside its 291-389 patrol.
        { x: 320, y: 1025, axis: 'walk', min: 285, max: 355, speed: 1.2 }
    ]
};
