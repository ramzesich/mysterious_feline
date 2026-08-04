// The level list, and the contract every level file has to satisfy. One file per level in
// `levels/` — level_1.js, level_2.js, and so on — each declaring a single named const and carrying
// its own design budget in its header comment. Those budgets are genuinely per-level and do not
// generalise: level 1 is a letterbox you run across, level 2 is a portrait you fall down, and a
// number that is fair in one is unfair in the other.
//
// NOTE ON VOCABULARY: the engine calls these *levels* throughout (LEVELS, levelIndex, loadLevel,
// level.frame) while the files call them *levels*. Same thing, two words, and worth unifying.
//
// There is no module system here (see CLAUDE.md), so the level files are plain globals and
// **index.html must load every one of them before this file**. A missing script tag shows up as a
// ReferenceError naming the level, which is the reason for named consts rather than anonymous
// object literals: a typo fails loudly instead of leaving a hole in the array.
//
// ADDING A LEVEL is three edits: write levels/level_N.js, add its <script> tag above map.js, and
// add its const to LEVELS below. Everything else derives — game.js holds levelIndex,
// applyLevelGeometry() reads the frame and geometry from whatever level is current, and the win
// screen offers "Enter Next Level" whenever a next entry exists.
//
// --- The schema ---------------------------------------------------------------------------
// Shared by every level:
//   id, name      — the slug and the display name shown on the win screen.
//   theme         — how the level LOOKS. Becomes a `theme-<name>` class on #gameWindow, and picks
//                   the artwork for shared furniture via THEME_ART in game.js. Current themes:
//                   'rooftops' (level 1) and 'facade' (level 2).
//                   **Never derive artwork from `axis` instead.** The axis is a mechanic and the
//                   theme is presentation; conflating them means the next vertical level silently
//                   inherits level 2's brickwork and sash windows. Each level gets its own look.
//   frame         — { width, height } of the game window while this level is loaded. Levels are
//                   not all the same shape; applyLevelGeometry() resizes #gameWindow and the
//                   instructions bar to match, and adds `narrow-frame` below 500px wide.
//   axis          — 'horizontal' or 'vertical'. Decides which way the camera scrolls and how
//                   the level is won. See below.
//   worldWidth    — the world's width in px.
//   spawnX        — where Bumbot starts, and where he respawns until a checkpoint is passed.
//   pits          — [{ x, width }] lethal gaps in the floor. May be empty.
//   arrival       — how Bumbot shows up at the level's own spawn: 'emerge' (climbs out of the
//                   pipe/window there, the default), 'drop' (walks off and falls onto the first
//                   ledge with input locked — level 2's opening), or 'stand' (already there).
//                   A checkpoint always overrides this with 'emerge'. 'drop' also reads
//                   `arrivalDir` ('left' | 'right') for which way to step off.
//   objects       — the level. See "Entity model" in CLAUDE.md for the types.
//   birds         — the wildlife. `axis` picks species and behaviour together.
//
// Horizontal levels additionally use:
//   (nothing)     — the goal is derived: the feeder sits at worldWidth - goalInset and the win
//                   line is worldWidth - winInset, so a level's length is a one-number edit.
//
// Vertical levels additionally require:
//   worldHeight   — the world's height in px. Horizontal levels fall back to the frame height.
//   spawnY        — the height he starts at, since 0 is no longer a safe floor.
//   lethalFloor   — true when touching y=0 kills. Falling is the route in a vertical level, so
//                   the failure state moves to the bottom of the shaft.
//   goal          — { x, y, width, height }. Overlapping it wins the level, because "the far
//                   right-hand edge" means nothing when the level runs downward.
// -------------------------------------------------------------------------------------------

const LEVELS = [
    LEVEL_1,
    LEVEL_2
];
