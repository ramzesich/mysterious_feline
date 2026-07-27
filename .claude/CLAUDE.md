# Bumbot — browser platformer

A zone-based side-scrolling platformer. Play as Bumbot — a live black Bombay cat, **not** a
robot, despite what the old `triggerShortCircuitReset`/battery naming used to imply — across a
cyberpunk city to the cat feeder waiting at the far end, dodging spikes, pits and pigeon
drones, collecting snacks, and using the Sonic Meow to clear obstacles. Zone 1
(`neon-outskirts`) is 16000px, with a checkpoint portal at its midpoint. Keep copy, comments
and new mechanics feline rather than mechanical.

## Running it

No build, no dependencies, no tests, no lint. Open `index.html` in a browser
(`open index.html` — `file://` works fine). Scripts are plain globals loaded in order:
`map.js` defines `ZONES`, then `game.js` consumes it. There is no module system —
don't add `import`/`export` without also changing the script tags.

Verify changes by actually playing: move right, jump onto a platform, hit a spike (death
flash + respawn), fall into a pit, ride a mover, pass the checkpoint portal then die (should
respawn at the portal), press `M` (ripple + obstacles shatter), reach the feeder and watch
the munch sequence before the win screen.

## Files

| File | Role |
|---|---|
| `index.html` | DOM skeleton: parallax layers, UI, `#world`, cat, win screen. Static elements only. |
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

## Entity model

`generateLevel()` turns each `zone.objects` entry into a DOM div plus a `RuntimeEntities`
record (`{...obj, dom, active}`); `zone.pigeons` become `PigeonEntities`.

- `pillar` — solid box from y=0 to `height`.
- `platform` — thin solid slab occupying y=`height`..`height+15`. Blocks from above *and*
  below (rising into one zeroes velocity); it is not a jump-through platform. With
  `hidden: true` it renders invisible and is revealed permanently on first landing.
- `mover` — a platform that oscillates. `axis: 'x'` slides between `baseX` and
  `baseX + range`; `axis: 'y'` raises between `baseHeight` and `baseHeight + range`.
- `spike` — lethal, overlap-only. Optional `y` mounts it on a slab (`y = height + 15`).
- `snack` — a collectible cat treat stick, overlap-only, +1 meow charge. Drawn purely in CSS
  (`.snack` plus its two pseudo-elements), not a glyph.
- `portal` — the mid-zone checkpoint, overlap-only. Passing it sets `respawnX`, and `.active`
  switches it from dim/grey to spinning and glowing.

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
blotch + gradient background stacks, warm grey). The important constraint is **no periodic
pattern on the pillars** — an even rhythm of horizontal lines makes a grey box read as a
server rack or shelving unit, not stone. Behaviour is encoded in the painted top edge, not the
body: blue = a static platform, amber = a mover, pale = a pillar's weathered cap. All three
set `box-sizing: border-box`, which is required — their borders would otherwise render them
taller than the height physics collides with.

## Ground, pits and falling

The ground is **not** a single div. `buildGround()` emits a `.ground-segment` for each
stretch between the zone's `pits`, plus a `.pit` void div per gap. `isOverSolidGround(x)`
tests the cat's *centre* (x + 17) against the pit list, which keeps ledges forgiving instead
of making a 1px overhang fatal.

Consequences worth knowing: the ground clamp at `catY <= 0` is now conditional, falling past
`fallDeathY` triggers the death reset, and the standing branch has to re-check support every
frame. A pit is the one hazard a meow cannot remove — that's deliberate, and it's what keeps
the no-snack route honest.

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
restart sites: `triggerHurtReset()` (after 600ms) and `loadZone()`.

Two reset paths, deliberately different:
- `triggerHurtReset()` (death) — returns to `respawnX` (the checkpoint portal if
  passed, else the zone's spawn), keeping score and level state.
- `loadZone(i)` — full reload: geometry, score back to 1, `respawnX` back to spawn, level
  regenerated, victory-munch classes cleared. `handleWinButton()` and `resetGame()` both route
  through it, and `handleWinButton` is called from an inline `onclick` in `index.html`, so it
  must stay a global function.

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
