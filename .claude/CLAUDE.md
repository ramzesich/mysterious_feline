# Bumbot — browser platformer

A level-based platformer. Play as Bumbot — a live black Bombay cat, **not** a robot, despite what
the old `triggerShortCircuitReset`/battery naming used to imply — making his way across a cyberpunk
city, dodging razor wire, birds both airborne and on foot, and the drop; collecting snacks, and
using the Sonic Meow to clear obstacles. Keep copy, comments and new mechanics feline rather than
mechanical, and keep new scenery plausible for wherever the level is set.

Two levels, and they do not share a shape:

- **Level 1, `neon-outskirts`** — a 700×350 letterbox you run right across: 16000px of thirteen
  rooftops with a checkpoint vent pipe at the midpoint. New scenery here must be *rooftop* — if a
  thing wouldn't plausibly be bolted to the top of a building, it doesn't belong up there.
- **Level 2, `the-long-way-down`** — a 400×620 portrait you fall down: 4200px of masonry between
  two buildings, zig-zagging balcony to gargoyle to sill, from the roof to a half-open second-floor
  window, with the street lethal at the bottom. Scenery here is old stonework seen from *outside* a
  building.

## Running it

No build, no dependencies, no tests, no lint. Open `index.html` in a browser
(`open index.html` — `file://` works fine). Scripts are plain globals loaded **in order**: every
`levels/level_N.js` declares one const, then `map.js` collects them into `LEVELS`, then `game.js`
consumes it. There is no module system — don't add `import`/`export` without also changing the
script tags.

`index.html?level=2` boots straight into that level, skipping the title card; add `#fast` to arm
the catnip rush with it. 1-based, and an out-of-range value falls back to the menu rather than
being clamped.

Verify changes by actually playing. Level 1: press Start, climb out of the spawn pipe, move right,
jump onto a catwalk, touch razor wire (fur up, bail off screen, respawn out of a pipe), fall into an
alley, ride a gondola, walk into a strutting pigeon, get hit by a crow, pass the checkpoint pipe
then die (should respawn there), press `M` (ripple + installations shatter), reach the feeder and
watch the munch sequence. Level 2: check the frame actually resizes to portrait, watch him walk in from
off screen and stop on the roof with both rooftops and the sky above them in shot, drop from ledge to
ledge down both walls, get swatted by the old woman with the broom, fall down the middle slot to the
street (should die), pass the checkpoint window then die (should respawn there — walking in again if you
died before it), and reach the goal window (should shrink into it).

## Files

| File | Role |
|---|---|
| `index.html` | DOM skeleton: parallax layers, UI, `#world`, Bumbot's SVG sprite, bird templates, win screen, title card. Static elements only. |
| `levels/level_N.js` | One level each. A single named const (`LEVEL_1`, `LEVEL_2`) plus that level's design budget in its header comment. |
| `map.js` | The registry: the `LEVELS` array and the schema contract every level file satisfies. No level data of its own. |
| `game.js` | Everything else: input, physics, collision, particles, camera, audio. |
| `style.css` | All visuals, hitbox-relevant sizes, and keyframe animations. Level 2's material language is a marked block at the end. |

## Levels

`map.js` holds `LEVELS`, an array of the consts declared by the files in `levels/`. `game.js` holds
`levelIndex` / `level` and everything derives from that — the win screen automatically offers
"Enter Next Level" when a next level exists, via `handleWinButton()`.

**Adding a level is three edits**: write `levels/level_N.js`, add its `<script>` tag above `map.js`,
and add its const to `LEVELS`. The consts are named rather than inline object literals so a missing
script tag fails loudly with a `ReferenceError` naming the level, instead of leaving a hole in the
array.

Each level declares its own `frame` (the game window is resized per level) and `axis`. `map.js`'s
header documents the full schema, including the extra fields a vertical level needs
(`worldHeight`, `spawnY`, `lethalFloor`, `goal`).

Each level file's header records **its own** design budget, and the two do not generalise to each
other — level 1's ~310px vertical ceiling and 200px max alley say nothing about level 2, whose
budget is about fall distance against ledge spacing. Read the one above the level you're editing;
it's the difference between a fair level and an impossible one. Level 1 is completable **without
spending a single snack**; meows are optional help.

For a horizontal level, end-of-level geometry is derived rather than hardcoded:
`applyLevelGeometry()` positions `#goalFeeder` at `worldWidth - goalInset` and the win line is
`worldWidth - winInset`, so changing a level's length is a one-number edit. A vertical level instead
names an explicit `goal` rect, because "the far right-hand edge" means nothing running downward.

## Themes (look) vs axis (mechanics)

**Every level has its own theme, and artwork must never be derived from the axis.** The axis is a
mechanic — camera direction, win condition, whether the floor kills. The theme is presentation. They
happen to correlate in the two levels that exist, which makes it tempting to key CSS off
`isVertical`; don't. The next vertical level will be set somewhere else and would silently inherit
level 2's brickwork and sash windows.

Each level declares `theme`, and `applyLevelGeometry()` puts three things on `#gameWindow`:

| Hook | Means | Example |
|---|---|---|
| `theme-<name>` | how it looks | `theme-facade` draws the two wall faces and hides the skyline layers |
| `narrow-frame` | how much room there is (frame width < 500) | shrinks the win-screen title |
| (inline width/height) | the frame itself, from `level.frame` | 700×350 vs 400×620 |

`narrow-frame` is separate on purpose: overlay type shrinking is about available space, not about the
setting or the direction of travel.

Shared *furniture* resolves its artwork through `THEME_ART` in `game.js`, which maps a theme to
default drawings — currently just the checkpoint (`rooftops` → vent pipe, `facade` → sash window).
An entity can always override with its own `variant`, exactly as a `pillar` does; that is how level
2's rooftop vent pipe survives inside a masonry-fronted level. Resolution happens in JS
(`portalArt()`, mirroring `rooftopVariant()`) so each element gets exactly one drawing class, rather
than the stylesheet fighting itself with `:not()` chains.

Both checkpoints glow **cyan** whatever the theme, because that is the checkpoint colour language;
the goal is the warm one. Keep that split — it is the only warm light below level 2's roofline, which
is what makes the way out readable from a long way up.


Everything that branches on `level.axis` lives in **six** places, and it is worth keeping it that
way. If a seventh appears, that's the signal to split the engine per axis rather than keep threading
`isVertical` through it:

| Where | Horizontal | Vertical |
|---|---|---|
| `applyLevelGeometry()` | `#world` at `top: 0`, `height: 100%` | `#world` taller than the frame and anchored by its **bottom**, so `bottom: 40 + y` still lands right; `#goalFeeder` hidden |
| `applyCamera()` | `left` only | also `bottom`, via `cameraForY()` |
| `buildTerrain()` | `buildGround()` — a segment per stretch between pits, plus a void per gap | one lethal `.street` segment across the full width |
| `hasReachedGoal()` | `catX >= winX` | overlaps `level.goal` |
| `hasPassedCheckpoint()` | crossed its `x` | descended to its `y` (one-way, which only a one-way level can assume) |
| `checkpointRespawn()` | clear of the pipe mouth | on the ledge outside the window |

Two things are driven by a **data flag** rather than the axis, deliberately, so a horizontal level
could use them too: `level.lethalFloor` (touching `y = 0` kills) and `level.goal`.

`isVertical` is recomputed in `applyLevelGeometry()`, so it is always in sync with `level`. It governs
*behaviour only* — see "Themes vs axis" above for why no stylesheet rule may key off it.

## Level 2's architecture

The facade is built from the same `platform` entity as level 1's catwalks — identical 15px collision
slab — reskinned by `side` (which wall it grows from) and `variant` (what it is). `generateLevel()`
adds `.ledge`, `.ledge-<side>` and `.ledge-<variant>`, declared *after* `.platform` so they win on
equal specificity and replace both the blue safety edge and the truss/legs pseudo-elements.

The two pseudo-elements are budgeted, and every variant respects the split:

- **`::before` — everything above the slab.** Balcony railing, sill window, awning valance.
- **`::after` — everything below it.** Stone corbels, the gargoyle's head, awning struts.

Only the 15px slab is solid, so **nothing either pseudo-element draws may look like footing or like a
wall** — the same trap level 1's support legs had to avoid.

| Variant | What it is |
|---|---|
| `balcony` | Wrought-iron railing over stone. The strongest "someone lives here" cue in the level. |
| `gargoyle` | A carved head on a short bracket, replacing the corbel — the one piece of the facade with a face. |
| `sill` | A window ledge with the window above it: dark glass, mullion cross, cold interior light. |
| `awning` | Stretched canvas, the only non-stone ledge. Striped slab, scalloped valance, iron struts. |

Periodic pattern is *correct* for the railing balusters and the awning stripes — real railings and
awnings are evenly spaced. That is the same distinction level 1 draws between a pillar's face (never
periodic) and an AC unit's louvres (rightly periodic).

The wall faces themselves carry **no window rows** on purpose: the sills and the two portals draw the
windows, because they know where they actually are. Adding rows to the wall put them behind ledges at
random offsets.

## Coordinate system (the main thing to get right)

Game logic works in **pixels up from the top of the ground**, so `catY = 0` and
`obj.height` are ground-relative. The ground is 40px tall, so *every* DOM write adds that
offset:

```js
element.style.bottom = (40 + y) + 'px';
```

That `40` is hardcoded in ~10 places (entity spawning, particles, dust, movers, the cat
container). Any new entity or effect must follow the same convention or it will float/sink by
40px. Horizontal `left` is absolute world-space; `#world` is shifted by the camera instead.

Two rendering corrections keep that convention *visually* honest, and they were tuned against
each other — change one and re-check the other:

- `.ground-segment` and `.pit` are 40px tall with `box-sizing: border-box`. The segment's 4px
  `border-top` would otherwise paint the walkable surface at 44px while physics stands at 40.
- Descender compensation is gone entirely. It existed because an emoji's ink stops short of the
  bottom of its line box; Bumbot and the pigeons are now sprites whose feet are authored on the
  bottom edge of their boxes. (It was `--paw-drop`, then bird-only as `--bird-drop`, now deleted
  along with the `pigeonStrut` keyframes it fed. Crows never used it — the flying glyph is not
  standing on anything.)
- Birds follow the `40 + y` convention like everything else. They used to be written as
  `bottom = pig.y` while collision compared `pig.y` against ground-relative `catY`, so every
  flyer rendered 40px below its own hitbox.

## Bumbot's sprite

Bumbot is **not** an emoji — he is an inline SVG in `index.html` inside `#cat`, on a
`viewBox="0 0 50 42"`, authored **facing left** (as the old glyph was, so `--face: -1` still
means "mirrored to face right"). Fills are presentation attributes on the shapes, near-black with
a slightly lighter chest and haunch; the far-side legs are darkest so they read as behind. The
birds are still emoji on purpose — they get converted once his shape has proven itself.

Three layers of animation, and mixing them up is the easy mistake:

| Layer | Element | Examples |
|---|---|---|
| Whole-body squash/emerge | `#catContainer` | `catLaunch`, `catLand`, `catIdle`, `catEmerge` |
| Whole-body chew | `#cat` — **owns its `transform`** | `bumbotMunch` |
| Dying | `#catContainer` | `catBail`, `catPlunge` |
| Parts | `<g>`s inside the svg | `bbStride`, `bbTailSway`, `bbEarTwitch`, `bbChew` |

Because `.munching` overwrites `#cat`'s transform wholesale, **part animation must
live on descendants, never on `#cat`.**

Rig notes:

- Every animated part sets **`transform-box: fill-box`**. Without it an SVG transform pivots on
  the viewBox origin, so a leg swings from the corner of the box — that is the first thing to
  check if the gait ever looks unhinged.
- Legs pivot at the hip (`transform-origin: 50% 0%`), the tail at its base, the jaw at its back.
- The gait is a four-beat: diagonal pairs (front-near + back-far) share a cycle, the other pair
  runs the same animation with a `-0.17s` delay — half of 0.34s — so it starts mid-stride.
- `game.js` toggles `cat-run` and `cat-air` on `#cat` from `isGrounded` and the arrow keys, in
  `update()` next to the idle-settling block. Both are cleared in `loadLevel()`,
  `startVictoryMunch()`, `triggerHurtReset()` and `showStartMenu()`, because those four stop the
  loop — leave them on and he chews or dies with his legs still striding.
- `cloneCatSprite()` takes a frozen snapshot of the live sprite for the dash trail and the title
  card. It strips the clone's `id`s (they would duplicate the original's, and a snapshot does not
  want parts still animating) and **removes `#bbFur` first** — the raised-fur spikes are hidden by
  an *id* selector, so a stripped clone would otherwise render permanently spooked.
- Only the birds keep `brightness(0)` in their filter stacks. On Bumbot it would crush his
  per-part shading to one black shape; the dash ghosts keep it deliberately, because a trail
  should read flat.
- For authoring sprites: `qlmanage -t -s 600 -o <dir> <file>.svg` rasterizes an SVG so it can be
  examined without a browser. There was also a `sprite-lab.html` scratch harness (real `style.css`,
  a sprite at 1×/2×/4× standing on a real ground segment and at an alley edge). It was never
  committed and has since been deleted on purpose — so it is **not** in the repo, and git can't
  bring it back. Rebuild it if a sprite ever needs that kind of isolated look again.

## Entity model

`generateLevel()` turns each `level.objects` entry into a DOM div plus a `RuntimeEntities`
record (`{...obj, dom, active}`); `level.birds` become `BirdEntities`.

- `pillar` — solid box from y=0 to `height`. Rendered as a roof installation: an optional
  `variant` (`hatch` / `ac` / `fan` / `tank` / `stack`) becomes a second CSS class, and
  `rooftopVariant()` derives one from the height when the data omits it, so no pillar ever
  renders as an anonymous grey box.
- `platform` — thin solid slab occupying y=`height`..`height+15`. Blocks from above *and*
  below (rising into one zeroes velocity); it is not a jump-through platform. With
  `hidden: true` it renders invisible and is revealed permanently on first landing. Reads as a
  service catwalk: `::after` is the under-truss, `::before` the support legs, both masked to
  fade downward — only the 15px slab collides, so the legs must never look solid.
  In a vertical level the same type is a **ledge**: `side: 'left'|'right'` says which wall it grows
  out of and `variant` (`balcony` / `gargoyle` / `sill` / `awning`) picks the stonework. Those add
  `.ledge`, `.ledge-<side>` and `.ledge-<variant>`, declared *after* `.platform` in the stylesheet
  so they win on equal specificity and replace both the blue safety edge (level 1's "static
  platform" cue, meaningless here) and the truss/legs pseudo-elements with stone corbels. Collision
  is identical — it is the same 15px slab either way.
- `mover` — a platform that oscillates. `axis: 'x'` slides between `baseX` and
  `baseX + range`; `axis: 'y'` raises between `baseHeight` and `baseHeight + range`. The axis
  also picks the machinery class (`mover-x` = gondola on cables, `mover-y` = hoist on a mast).
- `spike` — lethal, overlap-only. Optional `y` mounts it on a slab (`y = height + 15`), where
  it reads as razor wire strung along a catwalk edge. The coils are drawn by a ring gradient
  rather than a `clip-path`, because the silhouette needs to be transparent *between* loops.
- `snack` — a collectible cat treat stick, overlap-only, +1 meow charge. Drawn purely in CSS
  (`.snack` plus its two pseudo-elements), not a glyph.
- `portal` — the mid-level checkpoint, overlap-only. `hasPassedCheckpoint()` decides when it counts
  and `checkpointRespawn()` where it puts you (both axis-dependent — see the table above); it then
  sets `respawnX`/`respawnY` and adds `.active`, which lights the pipe from inside. Optional `y`
  mounts it partway up a wall, which is what a vertical level's checkpoint window needs. Optional
  `side` (vertical levels only) says which wall it's set into, which `respawnFace` reads to face him
  back into the gap on respawn — a checkpoint on the right wall has to send him back out facing
  *left*, not level 1's blanket "face right."
- `pipe` — the same `.vent-pipe` drawing as the portal, permanently `.active`, and pure
  scenery: absent from `isSolidType()`/`isSlabType()`, from the meow sweep and from
  `handleOverlapSystems()`. One sits at the level spawn so Bumbot's arrival matches his
  respawns.
- `sweeper` — level 2's ambush hazard: an old woman who looks like a shuttered window
  (`.sweeper`/`.sweeper-window`, same lintel-and-sill stone as `.sash-window`) until Bumbot enters
  her proximity zone, then leans out and swats. `side` picks the wall exactly like a ledge's, and
  which way the rig mirrors (`.sweeper-right .sweeper-rig { scaleX(-1) }`, the same one-drawing
  trick a pigeon's `--wing` uses). Overlap-only and absent from `isSolidType()`, but unlike every
  other hazard she runs her own **state machine** (`updateSweepers()`, called from `stepPhysics`
  right after the birds): `idle` → (proximity) `telegraph` → `swing` (the only lethal state,
  checked in `handleOverlapSystems()` against a reach rectangle extending `sweeperReach` out from
  her wall) → `cooldown` → back to `idle`. Immune to Sonic Meow on purpose, same as pits and
  movers — the meow sweep only ever tests `pillar`/`spike`, and a person is not a thing to blast
  away with a sound wave. Tier 1 catnip contact does **not** delete her the way `shatterEntity`
  deletes a pillar; it just forces her to `cooldown` early (a flinch, not a kill) — see Catnip
  below for why every new hazard has to opt into that check by hand.

  **Placing one is where she goes wrong**, and both failures are silent — she runs her whole
  animation and simply never connects. Her lethal rectangle is her window's own box grown out by
  `sweeperReach`, so: mount her `x` at the wall's **inner** face (`wallWidth - sweeperWidth`, not 0,
  or she is set into the far side of her own building and sweeps 60px of brick), and mount her `y`
  just above the ledge she guards, because the band is her window's vertical span — a window mounted
  a comfortable 75px up cannot reach a 45px cat standing below it, at any x, on any frame. `reach`
  must span that ledge edge to edge too; stopping short leaves a safe pocket at the outer lip, which
  is exactly where he stands to drop. The telegraph gets its air time from `sweeperDetectVPad`, and
  that pad wants to stay *small* — pad it generously and she burns the whole telegraph while he is
  still falling, so the broom turns lethal on the frame he lands, which is unavoidable rather than
  hard.

  Mounting her where she can reach also means she **overlaps Bumbot**, and all of her belongs *behind*
  him, at z-index 5 with the other windows in this wall. That is structural, not aesthetic:
  `.sweeper-mask` clips her to the window opening, so the figure is inside the wall by construction and
  can never be in front of it. Two attempts went wrong from the same false premise — that "she reaches
  into his space", which is true of her hitbox and not of her drawing. z-index 12 on the whole element
  put her window over him; splitting the window behind and the figure in front left him sandwiched
  between two halves of one object.

  That mask is also the thing that has to grow when `sweeperReach` does. It clipped at the window's own
  box, so the outer 21px of the swing — the part crossing the ledge he stands on — was invisible while
  still killing him. Its clip needs to be **vertical only** (above the lintel, below the sill, which is
  all the tuck needs); it now runs 80px out into the gap. Two knock-ons: the right-hand mirror moved from
  `.sweeper-rig` up to `.sweeper` so the reach mirrors with it, and `.sweeper-rig`'s `left` had to stop
  being `50%`, which silently meant 50% *of the mask* and shifted her out of her own window.

The goal is not a level object in either level, but it is a different thing in each. A horizontal
level's is the cat feeder (`#goalFeeder`), a **static** child of `#world` positioned by
`applyLevelGeometry()`; it shares the `.feeder` class with nothing else, which is why level clearing
keys on `.level-entity` instead of type classes. A vertical level's is a `.goal-window` div that
`generateLevel()` **does** generate from `level.goal` — and `applyLevelGeometry()` hides
`#goalFeeder` outright, since a feeder makes no sense partway down a wall.

`isSolidType()` / `isSlabType()` decide collision behavior — extend those rather than adding
type checks inline. Removal pattern: set `active = false`, animate, then `setTimeout(remove)`.

Every generated node (objects, birds, ground segments, pit voids) gets `.level-entity`, and
`generateLevel()` clears exactly that. Add the class to anything new you generate.

**Gotcha:** collision uses the *data* dimensions while rendering uses CSS ones, and they
disagree — spikes are `width: 30` in data but 45px in CSS; the cat hitbox is 35×45 in
`checkSolidCollision` while `#catContainer` is 50×42. This is load-bearing for game feel;
don't "fix" the mismatch casually.

**Material language:** pillars, platforms and movers are all cast concrete (irregular grit +
blotch + gradient background stacks, warm grey), with a thin machine skin over the top of each
installation. The important constraint is **no periodic pattern on a pillar's face** — an even
rhythm of horizontal lines makes a grey box read as a server rack or shelving unit, not stone.
(Periodic detail *is* right for things that are genuinely repetitive: roofing seams on the deck,
the louvres inside an `ac` unit's plainly machine-shaped panel, the loops of a wire coil.)
Behaviour is encoded in the painted top edge, not the body: blue = a static platform, amber = a
mover, pale = a pillar's weathered cap. All three set `box-sizing: border-box`, which is
required — their borders would otherwise render them taller than the height physics collides
with.

## Ground, pits and falling

The floor is chosen by `buildTerrain()`, and the two levels want opposite things from it.

**Horizontal.** The ground is **not** a single div. `buildGround()` emits a `.ground-segment` for
each stretch between the level's `pits`, plus a `.pit` void div per gap. `isOverSolidGround(x)`
tests the cat's *centre* (x + 17) against the pit list, which keeps ledges forgiving instead
of making a 1px overhang fatal.

Visually a segment is a building's roof — only its top few px are the deck Bumbot runs on, and
the rest of the 40px band is the storey below falling into shadow. A `.pit` is the alley between
two buildings, with a sodium street glow at the bottom of it. `.ground-segment::before/::after`
paint a 9px parapet coping on each end of every segment, which is what makes a gap read as the
space between two buildings rather than a hole in a floor. Those lips are **decoration only** —
Bumbot walks straight through them, and that's the deliberate trade.

Consequences worth knowing: the ground clamp at `catY <= 0` is now conditional, falling past
`fallDeathY` triggers the death reset, and the standing branch has to re-check support every
frame. A pit is the one hazard a meow cannot remove — that's deliberate, and it's what keeps
the no-snack route honest.

**Vertical.** One `.ground-segment.street` across the full width, and `level.lethalFloor` makes
touching it fatal on contact — the whole failure state moves to the bottom of the shaft, because
falling is the *route* here rather than the mistake. The flag also forces the standing branch to
drop him, so he can never come to rest on the street. `.street` suppresses the parapet
pseudo-elements: a coping stone is the cue that a gap is the space between two roofs, and down here
the gap is the entire level.

The dash does not save him from a lethal floor — there is nothing below the street to drop through.

Level 2 has no `pits` at all (`pits: []`). The clear 120px slot down the middle of the shaft is not
a barrier and doesn't need to be: hugging it means a 4000px fall to the street, so the shortcut
punishes itself.

## Birds

`level.birds` entries carry `{x, y, axis, min, max, speed}`, and **`axis` picks the species as well
as the behaviour**, because on a rooftop they are the same thing:

| `axis` | Species | Behaviour |
|---|---|---|
| `walk` | pigeon | struts a surface at `y` — 0 is the roof deck, a slab height puts one on a catwalk |
| `x` | crow | patrols horizontally through the air between `min` and `max` |
| `y` | crow | hovers up and down |

All three are equally lethal on contact and all three die to a meow or a catnip dash, so no
species needs its own collision code. `generateLevel()` adds `.bird` plus `.pigeon` or `.crow`;
the stylesheet keys both the artwork and the lighting off the species class.

**Nothing here is an emoji any more.** Each bird is a clone of a `<template>` at the bottom of
`index.html` — `#pigeonSprite` or `#crowSprite` — a template rather than a live node because there
are many of them, and their parts carry **classes** (`.pig-head`, `.crw-wing-near`, …) rather than
ids for the same reason. Real pigeon greys with a warm beak and feet and a visible
eye, wearing only Bumbot's rim light: the `brightness(0) invert()` flattening that a glyph needed
is gone, because authored geometry has no pale-headed artwork to fight.

Facing is a plain `transform: scaleX(var(--wing))` on the box now, *not* something keyframes must
re-state, because the strut lives on the parts. The rig follows Bumbot's rules — `transform-box:
fill-box` on everything animated, joint-shaped origins (tail base, shoulder, neck base, throat,
hips). Neck and head are **nested** so two motions can run at once: the neck carries the 0.88s
walking bob, the head a 4.6s peck. One element cannot animate `transform` twice.

Everything is keyed off a 0.44s step so the body rise, the leg swap and the tail flick land
together, with the head nodding once per pair of steps.

Crows have lost the hard red outline they wore as a glyph: a drawn bird with beating wings is
legible without a warning colour, so they carry the same city rim light as everything else alive up
here, with a deep brown eye. Both species' threat now reads from behaviour — a pigeon walks at you,
a crow flies at you.

The crow's flap beats both wings together (alternating them reads as a wounded bird), with the far
wing on a shallower arc and a darker fill so the two never merge into one shape, and the body
rising on the downstroke to sell the effort. **The downstroke is deliberately shallower than the
upstroke:** past about 25° the wing swings in behind the body and, everything being near-black, the
bird reads as briefly wingless. That was visible in the first cut and is the thing to re-check if
the wing geometry is ever changed.

The pigeon sprite's ink spans roughly `y+3` to `y+33` against a hitbox of `y+8`..`y+32`, so its
legs stick out below the lethal band. That is deliberate and forgiving; the hitbox was not touched.

Placement rules live in `map.js`'s header: a walker's patrol range stays inside one roof, speed
≤ 2, and never on the landing side of an alley.

## Movers and carrying

`updateMovers()` runs **first** in `stepPhysics`, before player input, and applies its own
delta to `catX`/`catY` when `groundedOn` is that mover. `groundedOn` is set on landing and
refreshed each frame while grounded.

Carrying deliberately skips collision resolution, so a horizontal mover can push Bumbot into
a wall. Level 1 keeps movers well clear of pillars for exactly this reason; if you place one
near a wall, expect to add push-out handling.

## Game loop

One `update(timestamp)` driven by `requestAnimationFrame`, which measures `dt` in units of
"60fps frames" and advances `stepPhysics(slice)` in slices. Every tuning
constant is therefore still authored as a per-60fps-frame value and keeps that meaning at
any refresh rate — when adding movement or particle motion, scale it by `dt` (or by the
`dt` handed to `stepPhysics`) or it will silently become frame-rate dependent again.

The sub-stepping is not cosmetic, and it has **two independent limits**:

- **at most one frame per slice.** A single large `dt` could carry Bumbot straight through a 15px
  platform slab without ever overlapping it. `dt` itself is clamped to `maxCatchUpFrames`.
- **at most `maxSliceTravel` (10px) of *fall* per slice.** Time-slicing alone stopped being enough
  once a level ran downward: falling the height of a 620px portrait reaches ~31px per frame, which
  clears a 15px ledge in one step no matter how small `dt` is. This is deliberately a
  *subdivision*, not a speed cap — capping velocity would have changed how level 1 falls, whose
  tallest drop already peaks at ~14.7px/frame. Keep `maxSliceTravel` below the 15px slab thickness.

Speed lives in the tunables block at the top of `game.js`. Jump apex is
`jumpForce² / (2 * gravity)` ≈ 141px against a 135px tallest platform, so those two
constants must be rebalanced together — bumping `gravity` alone makes platforms
unreachable, and it invalidates **both** level files' design budgets (level 2's ledge spacing is
derived from fall time against jump distance).

`update()` early-returns when `gameActive === false`, which **terminates the loop
entirely** — whoever cleared the flag must restart it with `requestAnimationFrame(update)`
*and* reset `lastFrameTime = 0`, so the pause isn't billed as one enormous frame. Existing
restart sites: `triggerHurtReset()` (after the death animation, 520-800ms depending on cause) and
`loadLevel()`. The page now *loads* with the flag clear, because it opens on the title card.

Two reset paths, deliberately different:
- `triggerHurtReset(cause)` (death) — returns to `respawnX` / `respawnY` (the checkpoint if passed,
  else the level's own spawn), keeping score and level state. A death **never** costs you more than
  the current level. Both axes are tracked because level 2's checkpoint is a window partway *down*:
  respawning at `y = 0` there would drop him on the lethal street. It has **two presentations**, and
  neither flashes the screen or shakes him — the read is entirely on the sprite, which is the payoff
  of rigging him:
  - contact with wire or a bird: `.cat-spooked` on `#cat` reveals `bbFur` (spikes along his back),
    puffs the tail and pins the ears, then 200ms later `.cat-bail` on the container hops him up
    and drops him off the bottom of the screen. 800ms total.
  - `cause === 'pit'`: no fright and no hop, because he is already falling — `.cat-plunge` just
    carries him the rest of the way down. 520ms total. A `lethalFloor` death uses this too, since
    hitting the street is the same story.

  Both are clipped by `#gameWindow`'s `overflow: hidden`, which is all "off screen" needs to mean.
  The respawn hand-draws `left`/`bottom` **and calls `applyCamera()`** before `playPipeEmerge()`,
  because the loop is still stopped and he would otherwise play one frame of climbing out of a pipe
  wherever he died, at whatever scroll position the camera was left at.
- `loadLevel(i)` — full reload: frame, geometry, score back to 1, respawn back to spawn, level
  regenerated, victory classes cleared. `handleWinButton()` and `resetGame()` both route
  through it, and `handleWinButton` is called from an inline `onclick` in `index.html`, so it
  must stay a global function. It hand-draws its opening frame for the same reason the respawn does.

Both end by calling `playArrival()`, because Bumbot never simply blinks into existence — but *how* he
arrives is per-level data, not a constant:

| `level.arrival` | What happens | Used by |
|---|---|---|
| `'emerge'` (default) | `playPipeEmerge()` — climbs out of the pipe/window at the spawn | level 1 |
| `'walk-in'` | Walks on from off screen, **input locked**, stops at `arrivalStopX` | level 2 |
| `'drop'` | Walks off the roof and falls onto the first ledge, **input locked**, then hands over | — |
| `'stand'` | Nothing. He is already there. | — |

A **checkpoint always overrides this with `'emerge'`**, whatever the level says, because a checkpoint
is by definition a thing he squeezes out of. `respawnArrival` tracks which one the *current* respawn
point uses, so dying before level 2's checkpoint replays the walk-in and dying after it climbs out
of the window.

Neither scripted arrival is a CSS animation — both are the real physics engine with the player's hands
tied, so he ends up wherever collision actually puts him rather than wherever a keyframe guessed.
`introHold` locks input (checked in `keydown`, and `advanceIntro()` overwrites the key state each frame
so a key already held cannot steer it). `advanceIntro()` runs at the top of `stepPhysics` *before* input
is read, and tests its end condition before re-forcing the key, or he takes one extra step past it. The
two shapes end differently, which is why `introMode` exists: `'drop'` ends once he is grounded below
where he started; `'walk-in'` never leaves the ground at all, so it ends on reaching `introStopX`.

Level 2's walk-in starts at `spawnX: -70` — **off the left-hand edge of the world**. That works because
`worldWidth` equals the frame width there, so `cameraForX` clamps to 0 and never pans, and everything
left of 0 is permanently clipped by `#gameWindow`; and because only the left-walk branch clamps `catX`
to 0, so walking rightward out of negative x needs no special case. The catch is *floor*: the roof
platform is widened to `x: -90, width: 200` so there is deck under him while he is still off screen. Its
right edge stays at 110, so the roof still reads as the flush 110px one.

It replaced a `'drop'` arrival that walked him off the roof onto the first balcony automatically, which
spent the level's opening move before the player had touched a key. `'drop'` is still supported.

`playPipeEmerge()` goes through `playBodyAnimation()`, so `cat-emerge` has to stay in that function's
removal list or a second emerge won't replay.

## Winning (two sequences)

Reaching the goal does **not** show the win screen immediately, in either level: `#winScreen` is a
full-window cover, so showing it right away makes the animation underneath invisible.
`hasReachedGoal()` clears `gameActive` and `startVictorySequence()` picks the ending that matches
what the level's goal actually *is*. Both hand-draw their final frame, because the loop has already
stopped and nothing else will draw it, and both finish through `revealWinScreen()`, which owns the
overlay copy and the fanfare.

- **`startVictoryMunch()`** (horizontal) — snaps him beside the bowl (38px back, or his 50px box
  hides the thing the sequence is about), runs the `.munching` chew loop with crunch tones, empties
  the bowl via `.eaten`, waits `munchDuration`.
- **`startWindowEntry()`** (vertical) — snaps him to the window mouth and runs `.cat-enter`, which
  is deliberately the exact reverse of `catEmerge`: every entrance and exit in this game is Bumbot
  squeezing through a gap too small for him. Waits `windowEntryDuration`.

`.munching` and `.cat-enter` are both cleared in `loadLevel()` and `showStartMenu()`.

## Camera & parallax

`cameraForX(x) = clamp(x - windowWidth/2 + 25, 0, worldWidth - windowWidth)`, applied as
`world.style.left`. `cameraForY(y)` is the same shape against `windowHeight` / `worldHeight`, and
`applyCamera()` writes it to `world.style.bottom` **only in a vertical level**. Note that the frame
size is per-level now, so nothing may assume 700×350.

In a vertical level `worldWidth` equals the frame width, so `cameraForX` clamps to 0 on its own and
the camera simply never pans sideways — no special case is needed for that.

Background layers scroll via `backgroundPositionX` on `#farBuildings` (0.15×) and
`#nearBuildings` (0.40×) — they are `repeat-x` tiles, so they scroll infinitely. Don't
translate those elements; that was the earlier broken approach. Both are **hidden** in the facade
theme: they are a skyline anchored to a horizon that setting doesn't have, and `#skyBg`'s violet
radial is overridden there too — between two walls it read as a bright purple column, the brightest
thing on screen in the one place nothing should draw the eye.

The two wall faces are generated per level into `#world` by `buildWalls()` from `level.walls`
(`{ side, width, top }`). They were originally painted on the frame as `::before`/`::after`, on the
reasoning that the masonry is identical all the way down so there is nothing to scroll. That was
wrong for one specific reason: **a wall painted on the frame can never end anywhere.** Level 2's left
building has to stop at the roof deck Bumbot starts on — the patch of open sky above his head (291px
of the 620px frame at spawn) is the only thing that makes the opening read as "off a rooftop" rather
than "off another ledge". **Both** walls end at 4110 with sky above them, and each carries a `roof`
ledge as its deck, so the opening is two facing rooftops at the same height — different *widths* (110
and 130) rather than different heights. The right one's deck is a real `platform`, not scenery: it is
the same drawing as the one he is standing on, and this level's art rules forbid anything that looks
like footing without being it.

Two dead ends there, both easy to re-invent:

- **A decorative second roofline** painted across a wall that carries on past it (the right wall used
  to run to 4450 with a cap drawn at 4110). A rooftop with 340px of masonry standing on it reads as a
  ledge whatever it is drawn like. Move a wall's `top` instead.
- **Ending below `worldHeight` is not the same as ending on screen.** `camera = catY - 289`, so standing
  on level 2's first balcony (catY 3960) puts the frame top at 4291; a wall topping out at 4270 ends 21px
  above the visible edge, against a sky within a few points of the masonry's own value, and looks
  exactly like a wall that never ends. Whatever a wall's top is, it needs room above it.

Consequences: the walls scroll, so their staining drifts past as he descends; each carries a parapet
coping at its own top (`.facade-wall::before`); and the roof deck is flush with its wall (130 wide,
no overhang, no corbel) because it is the top of a building rather than a slab bolted to one.

Each skyline layer is several gradient bands on **coprime tile widths** (900/700/1100 and
820/1300/540) anchored with `background-position: 0 100%`, which is what keeps the city from
reading as visibly repeating wallpaper. Two consequences: the CSS sets the shorthand so that
JS can override `background-position-x` alone and keep the bottom anchoring, and adding a
band on a width that shares a factor with the others will reintroduce a short repeat.

The camera clamps are wanted in several places — the loop, `triggerSonicMeow()`'s visible bounds,
the still frame behind the title card, the respawn, and `loadLevel()` — so they live in
`cameraForX` / `cameraForY` with `applyCamera()` doing the writing. They used to be copied into the
meow by hand; don't re-fork them.

## The start menu

The page opens on `#startScreen`, not in play: `gameActive` starts `false`, `menuActive` starts
`true`, and the bottom of `game.js` calls `showStartMenu()` — unless `?level=N` asked for a
specific level, in which case it calls `loadLevel()` directly and skips the card.

The card is deliberately **translucent over a real still frame** — `showStartMenu()` builds level 1,
parks Bumbot at his spawn pipe, then hand-draws that one frame (`catContainer` position plus
`applyCamera()`) because the loop is not running and nothing else will draw it. Anything that stops
the loop and moves him has to hand-draw, exactly as the respawn and the victory sequences do.

- `menuActive` is checked in `keydown` *after* `trackCatnipCode()` (so the stash can still be
  found from the menu) but *before* the `gameActive` guard, where it takes Enter/Space as Start
  and swallows everything else — that's what stops a `Space` press to start from also being
  buffered as a jump.
- `handleStartButton()` and `showStartMenu()` are both called from inline `onclick`s in
  `index.html`, so like `handleWinButton()` they must stay global functions.
- `loadLevel()` clears `menuActive` and hides the card itself, so every route into a level leaves
  the menu behind whether or not it came through Start.
- Start is also the user gesture browsers require before an `AudioContext` will sound, so the
  level's opening tones are now the first ones that reliably play.
- `#menuCat` is a `cloneCatSprite()` snapshot, built once. Its ids are gone, so none of the
  id-driven part animations reach it — the breathing is `catIdle` on the box instead. Give the
  parts class hooks if the menu ever needs a tail sway.

## Sonic Meow

`M` key. Costs one snack (`snacks`, which doubles as ammo; starts at 1). Destroys every
pillar, spike, and bird currently on screen, spawning rubble bursts. Pits and movers are
immune. Zero snacks plays a low reject tone instead.

"On screen" is tested on **both axes** by the local `onScreen(x, y)` helper. An x-only test was
fine while every level was a long horizontal strip, but in a portrait level every entity shares the
same narrow x range — so one meow would have cleared the entire level.

The ripple is positioned by `bottom`, in the same `40 + y` convention as every other entity, which
is why `.sonic-ripple`'s transform is `translate(-50%, 50%)`. It used to be positioned from the top
against a hardcoded `310` (the 350px frame minus the ground) — exactly the kind of assumption a
620px portrait frame breaks.

## Catnip (hidden dev mode)

Typing `CATNIP` toggles a developer mode, framed in-fiction as Bumbot finding a stash. It has **two
tiers**, and the split is deliberate: the first is discoverable by just walking into something, the
second needs a key.

**Tier 1 — catnip on, no key held.** Anything alive or sharp dies on contact instead of killing him:
birds vaporize, spikes shatter, via the shared `vaporizeBird()` / `shatterEntity()` helpers. Gated on
`catnipMode` alone (the `smashesHazards` flag in `handleOverlapSystems`).

What tier 1 pointedly does **not** do — and this is the whole shape of the design:

- **Geometry stays solid.** Pillars, platforms and movers still block him. The pillar-shatter branch
  stays gated on `dashing`, because catnip alone can never reach the inside of a pillar to trigger it.
- **Falling still kills.** Pits, `lethalFloor` and the vertical off-screen rule all ignore catnip.

So tier 1 makes him invincible to *things* without letting him ignore the level.

**Tier 2 — hold `Shift`.** The dash: `isDashing()` (catnip mode plus `Shift`) is 4× speed, and
geometry splits into two kinds. This split is load-bearing, and the reason is level 2:

- **Pillars are obstacles** and lose — destroyed rather than collided with, by `smashPillarsAt()` on
  the horizontal step and `dashLandingCollision()` on the way down.
- **Slabs (platforms and movers) are footing.** He is too fast to be stopped *sideways* by one, but
  he still **lands on top** of one.

The dash used to skip vertical collision as well, which was harmless in level 1 — the only thing
under you there is the ground — and fatal in level 2, where the ledges *are* the ground: holding
`Shift` dropped him through every one of them to his death. Don't reintroduce it.

Pits are still treated as whole ground while dashing, so level 1's 4× run crosses the alleys. The
checkpoint portal, snacks and the goal are all overlap-only, so they keep working at dash speed.

Note the one thing a `lethalFloor` does not yield to even here: there is nothing below the street to
drop through, so the dash does not save him from it.

Residual worth knowing: at 4× a walk-off carries him ~4× as far sideways, so in level 2 he pins
against the far wall and lands on whichever ledges are on *that* wall, skipping the ones opposite.
Holding a single direction the whole way down can therefore still miss a wall's worth of ledges and
fall out of frame. Steering with the drops descends the whole level safely.

While active, Bumbot's outline turns catnip-green and the HUD shows `🌿 CATNIP` plus a hint line
naming both tiers. The hint exists because the mode was previously undiscoverable — the green outline
said "something changed" but not what, and the only power was invisible until you guessed `Shift`.
`#devPanel` is a right-aligned column for that reason: the hint is too long to sit in a row beside
the snack counter in a 400px portrait frame.

Two implementation constraints worth preserving:
- The code contains **no `M`** — `M` is bound unconditionally to Sonic Meow, so any code
  containing it would fire a meow per keystroke. That rules out `MEOW`, `BUMBOT`, etc. The same
  constraint applies to the typed `LEVELx` code, which is why it is spelled that way.
- `trackCatnipCode()` runs *before* the `gameActive` guard in the `keydown` handler, so the
  code still works while dead or on the win screen. The `Shift` keydown and keyup are likewise
  unguarded, or the sprint could stick on.

When a new hazard is added (the broom, the perched pigeon), it has to opt into tier 1 — i.e. route its
contact through the same `smashesHazards` check — or catnip will silently fail to protect against it.

Session-only by design — nothing is persisted, and `loadLevel()` calls `disableCatnip()`, so
both a reload and a restart-after-finishing give you a clean game. The one exception is the
`?level=N#fast` test URL, which re-arms it *after* `loadLevel()` for exactly that reason.

## Level select (two ways in)

Neither is part of catnip: skipping to a level is not a power Bumbot has, it's a way for you to look
at one.

- **Typed `LEVELx`** — type `LEVEL2` anywhere (title card, mid-run, dead, win screen) to jump there.
  A digit with no level behind it does **nothing at all**, silently, because a wrong guess at a hidden
  code shouldn't announce itself. Single digit, so levels 1-9. Own buffer, separate from catnip's, so
  the two codes can't interfere.
- **`?level=N` URL** — boots straight in, skipping the title card; `#fast` also arms catnip. Handy as
  a bookmark. Out-of-range falls back to the menu rather than being clamped.

The typed code is why `scheduleFrame()` exists: it can call `loadLevel()` while the loop is still
running, and every other caller reached `loadLevel()` only once the loop had already stopped. Two
outstanding `requestAnimationFrame` callbacks would step physics twice per frame. **Never call
`requestAnimationFrame(update)` directly** — go through `scheduleFrame()`.

## Audio

All sound is synthesized through `playAudioTone(freq, type, duration)` — one lazily created
`AudioContext`, one oscillator + gain envelope per call. Chords are just multiple calls;
melodies use `setTimeout`. Browsers keep the context suspended until a user gesture, so the
first tones of a page load may be silent.

## Style

Comments in this codebase are chatty and often narrate history (`// NEW:`, `// FIXED:`).
Match the surrounding density when editing, but don't add new `NEW:`/`FIXED:` markers —
they age badly. Everything is untyped vanilla ES; state lives in module-level `let`
globals.
