# Bumbot — browser platformer

A zone-based side-scrolling platformer. Play as Bumbot — a live black Bombay cat, **not** a
robot, despite what the old `triggerShortCircuitReset`/battery naming used to imply — running
across the **rooftops** of a cyberpunk city to the cat feeder waiting at the far end, dodging
razor wire, the alleys between buildings, and pigeons both airborne and on foot; collecting
snacks, and using the Sonic Meow to clear obstacles. Zone 1 (`neon-outskirts`) is 16000px of
thirteen rooftops, with a checkpoint vent pipe at its midpoint. Keep copy, comments and new
mechanics feline rather than mechanical, and keep new scenery *rooftop* — if a thing wouldn't
plausibly be bolted to the top of a building, it doesn't belong up here.

## Running it

No build, no dependencies, no tests, no lint. Open `index.html` in a browser
(`open index.html` — `file://` works fine). Scripts are plain globals loaded in order:
`map.js` defines `ZONES`, then `game.js` consumes it. There is no module system —
don't add `import`/`export` without also changing the script tags.

Verify changes by actually playing: climb out of the spawn pipe, move right, jump onto a
catwalk, touch razor wire (fur up, bail off screen, respawn out of a pipe), fall into an alley, ride a
gondola, walk into a strutting pigeon, pass the checkpoint pipe then die (should respawn there),
press `M` (ripple + installations shatter), reach the feeder and watch the munch sequence before
the win screen.

## Files

| File | Role |
|---|---|
| `index.html` | DOM skeleton: parallax layers, UI, `#world`, Bumbot's SVG sprite, win screen. Static elements only. |
| `map.js` | `ZONES` — all level data, plus a header comment stating the design budget. |
| `game.js` | Everything else: input, physics, collision, particles, camera, audio. |
| `style.css` | All visuals, hitbox-relevant sizes, and keyframe animations. |

## Zones

`map.js` exports `ZONES`, an array of self-contained zone objects: `id`, `name`,
`worldWidth`, `spawnX`, `pits`, `objects`, `pigeons`. `game.js` holds `zoneIndex` / `zone`
and everything derives from that, so **adding a zone to the array is all that's needed** for
it to be playable — the win screen automatically offers "Enter Next Zone" when a next zone
exists, via `handleWinButton()`.

End-of-zone geometry is derived, not hardcoded: `applyZoneGeometry()` sets `#world` width and
positions `#goalFeeder` at `worldWidth - goalInset`, and the win line is
`worldWidth - winInset`. Changing a zone's length is a one-number edit.

`map.js`'s header comment records the design budget implied by the physics constants (max
pit width, max platform/pillar height, the ~310px vertical ceiling). Read it before authoring
level data — it's the difference between a fair level and an impossible one. Zone 1 is
designed to be completable **without spending a single snack**; meows are optional help.

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
- The 🐦‍⬛ crow glyph leaves unpainted descender space under its feet, so `--bird-drop` (`:root`,
  5px) shifts it down in `pigeonStrut`. It is **bird-only** — Bumbot is an SVG sprite whose paws
  are authored on the bottom edge of his box, so he needs no compensation. (The variable used to
  be `--paw-drop` and applied to him too.)
- Pigeons follow the `40 + y` convention like everything else. They used to be written as
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
  `update()` next to the idle-settling block. Both are cleared in `loadZone()`,
  `startVictoryMunch()` and `triggerHurtReset()`, because those three stop the loop — leave them
  on and he chews or dies with his legs still striding.
- `spawnAfterImage()` clones the live sprite and strips the clone's `id`s: they would duplicate
  the original's, and a motion trail wants a frozen snapshot.
- Only the birds keep `brightness(0)` in their filter stacks. On Bumbot it would crush his
  per-part shading to one black shape; the dash ghosts keep it deliberately, because a trail
  should read flat.
- `sprite-lab.html` is a scratch harness for authoring: it links the real `style.css` and shows a
  sprite at 1×/2×/4× standing on a real ground segment and at an alley edge. `qlmanage -t -s 600
  -o <dir> <file>.svg` rasterizes an SVG so it can be examined without a browser.

## Entity model

`generateLevel()` turns each `zone.objects` entry into a DOM div plus a `RuntimeEntities`
record (`{...obj, dom, active}`); `zone.pigeons` become `PigeonEntities`.

- `pillar` — solid box from y=0 to `height`. Rendered as a roof installation: an optional
  `variant` (`hatch` / `ac` / `fan` / `tank` / `stack`) becomes a second CSS class, and
  `rooftopVariant()` derives one from the height when the data omits it, so no pillar ever
  renders as an anonymous grey box.
- `platform` — thin solid slab occupying y=`height`..`height+15`. Blocks from above *and*
  below (rising into one zeroes velocity); it is not a jump-through platform. With
  `hidden: true` it renders invisible and is revealed permanently on first landing. Reads as a
  service catwalk: `::after` is the under-truss, `::before` the support legs, both masked to
  fade downward — only the 15px slab collides, so the legs must never look solid.
- `mover` — a platform that oscillates. `axis: 'x'` slides between `baseX` and
  `baseX + range`; `axis: 'y'` raises between `baseHeight` and `baseHeight + range`. The axis
  also picks the machinery class (`mover-x` = gondola on cables, `mover-y` = hoist on a mast).
- `spike` — lethal, overlap-only. Optional `y` mounts it on a slab (`y = height + 15`), where
  it reads as razor wire strung along a catwalk edge. The coils are drawn by a ring gradient
  rather than a `clip-path`, because the silhouette needs to be transparent *between* loops.
- `snack` — a collectible cat treat stick, overlap-only, +1 meow charge. Drawn purely in CSS
  (`.snack` plus its two pseudo-elements), not a glyph.
- `portal` — the mid-zone checkpoint, overlap-only. Passing it sets `respawnX` to
  `obj.x + 14` (just clear of the pipe mouth) and adds `.active`, which lights the pipe from
  inside.
- `pipe` — the same `.vent-pipe` drawing as the portal, permanently `.active`, and pure
  scenery: absent from `isSolidType()`/`isSlabType()`, from the meow sweep and from
  `handleOverlapSystems()`. One sits at the zone spawn so Bumbot's arrival matches his
  respawns.

The zone's *goal* is a cat feeder (`#goalFeeder`), a static child of `#world` positioned by
`applyZoneGeometry()` — not a level object. It shares the `.feeder` class with nothing else,
which is why level clearing keys on `.level-entity` instead of type classes.

`isSolidType()` / `isSlabType()` decide collision behavior — extend those rather than adding
type checks inline. Removal pattern: set `active = false`, animate, then `setTimeout(remove)`.

Every generated node (objects, pigeons, ground segments, pit voids) gets `.level-entity`, and
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

The ground is **not** a single div. `buildGround()` emits a `.ground-segment` for each
stretch between the zone's `pits`, plus a `.pit` void div per gap. `isOverSolidGround(x)`
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

## Pigeons

`zone.pigeons` entries carry `{x, y, axis, min, max, speed}`. `axis: 'x'` patrols horizontally
in the air, `'y'` hovers up and down, and `'walk'` struts along a surface (`y: 0` is the roof
deck, a slab height puts one on a catwalk). All three are equally lethal on contact and all
three die to a meow or a catnip dash, so a walker needs no new collision code.

Walkers are crows (`🐦‍⬛`) wearing the same warm/cool rim light as Bumbot rather than the flyers'
outline — flattened by `brightness(0)`, lifted to slate grey by `invert()` (that order matters:
brightness first crushes the glyph to one flat shape, so nothing blows out), then edge-lit. They
still need the flattening because they are glyphs; Bumbot does not, because he is a sprite. The
flyers' hard red outline made a pale-headed bird glyph read as a detached head hopping along the
deck. They keep
no warning colour: a walker's threat reads from the fact that it walks at you. `pigeonStrut` owns
their `transform`, so their facing travels as `--wing` for the keyframes to re-state — the same
trick `--face` plays for Bumbot, and it mirrors the rim light with him too. Placement rules live
in `map.js`'s header: patrol range inside one roof, speed ≤ 2, never on the landing side of an
alley.

## Movers and carrying

`updateMovers()` runs **first** in `stepPhysics`, before player input, and applies its own
delta to `catX`/`catY` when `groundedOn` is that mover. `groundedOn` is set on landing and
refreshed each frame while grounded.

Carrying deliberately skips collision resolution, so a horizontal mover can push Bumbot into
a wall. Zone 1 keeps movers well clear of pillars for exactly this reason; if you place one
near a wall, expect to add push-out handling.

## Game loop

One `update(timestamp)` driven by `requestAnimationFrame`, which measures `dt` in units of
"60fps frames" and advances `stepPhysics(slice)` in slices of at most 1. Every tuning
constant is therefore still authored as a per-60fps-frame value and keeps that meaning at
any refresh rate — when adding movement or particle motion, scale it by `dt` (or by the
`dt` handed to `stepPhysics`) or it will silently become frame-rate dependent again.

The sub-stepping is not cosmetic: a single large step could carry Bumbot straight through a
15px platform slab without ever overlapping it. `dt` is clamped to `maxCatchUpFrames`.

Speed lives in the tunables block at the top of `game.js`. Jump apex is
`jumpForce² / (2 * gravity)` ≈ 141px against a 135px tallest platform, so those two
constants must be rebalanced together — bumping `gravity` alone makes platforms
unreachable, and it invalidates `map.js`'s design budget.

`update()` early-returns when `gameActive === false`, which **terminates the loop
entirely** — whoever cleared the flag must restart it with `requestAnimationFrame(update)`
*and* reset `lastFrameTime = 0`, so the pause isn't billed as one enormous frame. Existing
restart sites: `triggerHurtReset()` (after the death animation, 520-800ms depending on cause) and
`loadZone()`.

Two reset paths, deliberately different:
- `triggerHurtReset(cause)` (death) — returns to `respawnX` (the checkpoint pipe if passed, else
  the zone's spawn), keeping score and level state. It has **two presentations**, and neither
  flashes the screen or shakes him — the read is entirely on the sprite, which is the payoff of
  rigging him:
  - contact with wire or a bird: `.cat-spooked` on `#cat` reveals `bbFur` (spikes along his back),
    puffs the tail and pins the ears, then 200ms later `.cat-bail` on the container hops him up
    and drops him off the bottom of the screen. 800ms total.
  - `cause === 'pit'`: no fright and no hop, because he is already falling — `.cat-plunge` just
    carries him the rest of the way down. 520ms total.

  Both are clipped by `#gameWindow`'s `overflow: hidden`, which is all "off screen" needs to mean.
  The respawn hand-draws `left`/`bottom` before `playPipeEmerge()`, because the loop is still
  stopped and he would otherwise play one frame of climbing out of a pipe wherever he died.
- `loadZone(i)` — full reload: geometry, score back to 1, `respawnX` back to spawn, level
  regenerated, victory-munch classes cleared. `handleWinButton()` and `resetGame()` both route
  through it, and `handleWinButton` is called from an inline `onclick` in `index.html`, so it
  must stay a global function.

Both end by calling `playPipeEmerge()`, because both spawn points have a `pipe`/`portal` in the
level data and Bumbot always arrives by climbing out of one. That helper goes through
`playBodyAnimation()`, so `cat-emerge` has to stay in that function's removal list or a second
emerge won't replay.

## Winning (the munch sequence)

Crossing the win line does **not** show the win screen immediately. `startVictoryMunch()`
clears `gameActive`, snaps Bumbot to the bowl, hand-draws that final position (the loop has
already stopped, so nothing else will), runs the `.munching` chew loop with crunch tones,
empties the bowl via `.eaten`, and only after `munchDuration` reveals the overlay. The delay
exists because `#winScreen` is a full-window cover — show it right away and the animation is
invisible. Both classes are cleared in `loadZone()`.

## Camera & parallax

`cameraX = clamp(catX - 350 + 25, 0, worldWidth - 700)`, applied as `world.style.left`.
Background layers scroll via `backgroundPositionX` on `#farBuildings` (0.15×) and
`#nearBuildings` (0.40×) — they are `repeat-x` tiles, so they scroll infinitely. Don't
translate those elements; that was the earlier broken approach.

Each skyline layer is several gradient bands on **coprime tile widths** (900/700/1100 and
820/1300/540) anchored with `background-position: 0 100%`, which is what keeps the city from
reading as visibly repeating wallpaper. Two consequences: the CSS sets the shorthand so that
JS can override `background-position-x` alone and keep the bottom anchoring, and adding a
band on a width that shares a factor with the others will reintroduce a short repeat.

The same camera clamp is duplicated inside `triggerSonicMeow()` to find the visible bounds.
If you change camera math, change both.

## Sonic Meow

`M` key. Costs one snack (`snacks`, which doubles as ammo; starts at 1). Destroys every
pillar, spike, and pigeon currently on screen, spawning rubble bursts. Pits and movers are
immune. Zero snacks plays a low reject tone instead.

## Catnip (hidden dev mode)

Typing `CATNIP` toggles a developer mode, framed in-fiction as Bumbot finding a stash. It
grants: hold `Shift` for the **dash**, `[` / `]` to warp ±1500px (snapped to solid ground via
`nearestSolidX()` so you never land in a pit), `G` to toggle invulnerability, and a telemetry
readout (x / fps / grounded) in the HUD. While active, Bumbot's outline turns catnip-green and
a `🌿 CATNIP` tag shows, so you can never mistake cheat mode for normal play.

The dash (`isDashing()` — catnip mode plus `Shift`) is 4× speed and nothing stops him:
horizontal and airborne solid collision are both skipped so he runs through platforms and
movers, pits are treated as whole ground, and pillars, spikes and pigeons are destroyed on
contact via the shared `shatterEntity()` / `vaporizePigeon()` helpers. The checkpoint portal,
snacks and the win line are all overlap-only, so they keep working normally at dash speed —
every hitbox window is at least 63px against a 28px-per-slice step, so nothing gets skipped.

Two implementation constraints worth preserving:
- The code contains **no `M`** — `M` is bound unconditionally to Sonic Meow, so any code
  containing it would fire a meow per keystroke. That rules out `MEOW`, `BUMBOT`, etc.
- `trackCatnipCode()` runs *before* the `gameActive` guard in the `keydown` handler, so the
  code still works while dead or on the win screen. `Shift` keyup is likewise unguarded, or
  the sprint could stick on.

Session-only by design — nothing is persisted, and `loadZone()` calls `disableCatnip()`, so
both a reload and a restart-after-finishing give you a clean game.

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
