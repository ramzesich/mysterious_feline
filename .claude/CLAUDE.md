# Bumbot — browser platformer

A zone-based side-scrolling platformer. Play as Bumbot (a robot cat) across a cyberpunk city
to the extraction portal, dodging spikes, pits and pigeon drones, collecting batteries, and
using the Sonic Meow to clear obstacles. Zone 1 (`neon-outskirts`) is 16000px.

## Running it

No build, no dependencies, no tests, no lint. Open `index.html` in a browser
(`open index.html` — `file://` works fine). Scripts are plain globals loaded in order:
`map.js` defines `ZONES`, then `game.js` consumes it. There is no module system —
don't add `import`/`export` without also changing the script tags.

Verify changes by actually playing: move right, jump onto a platform, hit a spike (death
flash + respawn), fall into a pit, ride a mover, pass the feeder then die (should respawn at
the feeder), press `M` (ripple + obstacles shatter), reach the portal.

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
positions `#portal` / `#extractionPad` from `worldWidth` minus `portalInset` / `padInset`,
and the win line is `worldWidth - winInset`. Changing a zone's length is a one-number edit.

`map.js`'s header comment records the design budget implied by the physics constants (max
pit width, max platform/pillar height, the ~310px vertical ceiling). Read it before authoring
level data — it's the difference between a fair level and an impossible one. Zone 1 is
designed to be completable **without spending a single battery**; meows are optional help.

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
- `battery` — collectible, overlap-only, +1 ammo.
- `feeder` — the checkpoint, overlap-only. Passing it sets `respawnX` and adds `.active`.

`isSolidType()` / `isSlabType()` decide collision behavior — extend those rather than adding
type checks inline. Removal pattern: set `active = false`, animate, then `setTimeout(remove)`.

**Gotcha:** `generateLevel()` wipes the level with a hardcoded selector list. A new entity
CSS class must be added there or stale nodes leak across resets.

**Gotcha:** collision uses the *data* dimensions while rendering uses CSS ones, and they
disagree — spikes are `width: 30` in data but 45px in CSS; the cat hitbox is 35×45 in
`checkSolidCollision` while `#catContainer` is 50×42. This is load-bearing for game feel;
don't "fix" the mismatch casually.

## Ground, pits and falling

The ground is **not** a single div. `buildGround()` emits a `.ground-segment` for each
stretch between the zone's `pits`, plus a `.pit` void div per gap. `isOverSolidGround(x)`
tests the cat's *centre* (x + 17) against the pit list, which keeps ledges forgiving instead
of making a 1px overhang fatal.

Consequences worth knowing: the ground clamp at `catY <= 0` is now conditional, falling past
`fallDeathY` triggers the death reset, and the standing branch has to re-check support every
frame. A pit is the one hazard a meow cannot remove — that's deliberate, and it's what keeps
the no-battery route honest.

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
restart sites: `triggerShortCircuitReset()` (after 600ms) and `loadZone()`.

Two reset paths, deliberately different:
- `triggerShortCircuitReset()` (death) — returns to `respawnX` (the feeder if passed, else
  the zone's spawn), keeping score and level state.
- `loadZone(i)` — full reload: geometry, score back to 1, `respawnX` back to spawn, level
  regenerated. `handleWinButton()` and `resetGame()` both route through it, and
  `handleWinButton` is called from an inline `onclick` in `index.html`, so it must stay a
  global function.

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

`M` key. Costs one battery (`score`, which doubles as ammo; starts at 1). Destroys every
pillar, spike, and pigeon currently on screen, spawning rubble bursts. Pits and movers are
immune. Zero batteries plays a low reject tone instead.

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
