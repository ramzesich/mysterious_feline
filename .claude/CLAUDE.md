# Bumbot — browser platformer

A single-level side-scrolling platformer. Play as Bumbot (a robot cat) across an 8000px
cyberpunk city to the extraction portal, dodging spikes and pigeon drones, collecting
batteries, and using the Sonic Meow to clear obstacles.

## Running it

No build, no dependencies, no tests, no lint. Open `index.html` in a browser
(`open index.html` — `file://` works fine). Scripts are plain globals loaded in order:
`map.js` defines `levelObjects`, then `game.js` consumes it. There is no module system —
don't add `import`/`export` without also changing the script tags.

Verify changes by actually playing: move right, jump onto a platform, hit a spike (death
flash + respawn), press `M` (ripple + obstacles shatter), grab a battery, reach the portal.

## Files

| File | Role |
|---|---|
| `index.html` | DOM skeleton: parallax layers, UI, `#world`, cat, win screen. Static elements only. |
| `map.js` | `levelObjects` — the entire level as plain data, grouped in zone comments. |
| `game.js` | Everything else: input, physics, collision, particles, camera, audio. |
| `style.css` | All visuals, hitbox-relevant sizes, and keyframe animations. |

## Coordinate system (the main thing to get right)

Game logic works in **pixels up from the top of the ground**, so `catY = 0` and
`obj.height` are ground-relative. The ground is 40px tall (`#ground` in CSS), so *every*
DOM write adds that offset:

```js
element.style.bottom = (40 + y) + 'px';
```

That `40` is hardcoded in ~8 places (entity spawning, particles, dust, the cat container).
Any new entity or effect must follow the same convention or it will float/sink by 40px.
Horizontal `left` is absolute world-space; `#world` is shifted by the camera instead.

## Entity model

`generateLevel()` turns each `levelObjects` entry into a DOM div plus a `RuntimeEntities`
record (`{...obj, dom, active}`). Pigeons come from the separate `pigeonSpawns` array in
`game.js` into `PigeonEntities`.

- `pillar` — solid box from y=0 to `height`. Width comes from CSS (40px), not inline style.
- `platform` — thin solid slab occupying y=`height`..`height+15`. Blocks from above *and*
  below (rising into one zeroes velocity); it is not a jump-through platform.
- `spike` — lethal, skipped by solid collision.
- `battery` — collectible, skipped by solid collision, +1 ammo.
- `arrow` — purely decorative signage; deliberately **excluded** from `RuntimeEntities`
  so it never collides.

Removal pattern: set `active = false`, animate the DOM node, then `setTimeout(remove)`.

**Gotcha:** `generateLevel()` wipes the level with a hardcoded selector list
(`game.js:72`). A new entity CSS class must be added there or stale nodes leak across
resets.

**Gotcha:** collision uses the *data* dimensions while rendering uses CSS ones, and they
disagree — spikes are `width: 30` in data but 45px in CSS; the cat hitbox is 35×45 in
`checkSolidCollision` while `#catContainer` is 50×42. This is load-bearing for game feel;
don't "fix" the mismatch casually.

## Game loop

One `update()` driven by `requestAnimationFrame`. It early-returns when
`gameActive === false`, which **terminates the loop entirely** — whoever cleared the flag
must restart it with `requestAnimationFrame(update)`. Existing restart sites:
`triggerShortCircuitReset()` (after 600ms) and `resetGame()`. Freezing the game without a
restart path is the easiest way to hard-lock it.

Two reset paths, deliberately different:
- `triggerShortCircuitReset()` (death) — teleports to spawn, keeps score and level state.
- `resetGame()` (win screen replay) — regenerates the level and resets score to 1. Called
  from an inline `onclick` in `index.html`, so it must stay a global function.

## Camera & parallax

`cameraX = clamp(catX - 350 + 25, 0, worldWidth - 700)`, applied as `world.style.left`.
Background layers scroll via `backgroundPositionX` on `#farBuildings` (0.15×) and
`#nearBuildings` (0.40×) — they are `repeat-x` tiles, so they scroll infinitely. Don't
translate those elements; that was the earlier broken approach.

The same camera clamp is duplicated inside `triggerSonicMeow()` to find the visible bounds.
If you change camera math, change both.

## Level geometry is hardcoded in five places

Extending or shrinking the world means updating all of: `worldWidth` (game.js), `#world`
width (style.css — **declared twice**, the second block at the bottom wins), `#portal`
`left: 7800px`, `#extractionPad` `left: 7770px`, and the `catX >= 7780` win check in
`handleOverlapSystems()`.

## Sonic Meow

`M` key. Costs one battery (`score`, which doubles as ammo; starts at 1). Destroys every
pillar, spike, and pigeon currently on screen, spawning rubble bursts. Zero batteries plays
a low reject tone instead.

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
