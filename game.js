const world = document.getElementById('world');
const catContainer = document.getElementById('catContainer');
const cat = document.getElementById('cat');
const meowBubble = document.getElementById('meowBubble');
const energyDisplay = document.getElementById('energyDisplay');
const winScreen = document.getElementById('winScreen');
const winButton = document.getElementById('winButton');
const finalScore = document.getElementById('finalScore');
const startScreen = document.getElementById('startScreen');
const menuCat = document.getElementById('menuCat');
const gameWindow = document.getElementById('gameWindow');
const instructionsBar = document.querySelector('.instructions');
const goalFeeder = document.getElementById('goalFeeder');
const farBuildings = document.getElementById('farBuildings');
const nearBuildings = document.getElementById('nearBuildings');
const devPanel = document.getElementById('devPanel');
const pigeonSprite = document.getElementById('pigeonSprite'); // <template>, cloned per walking bird
const crowSprite = document.getElementById('crowSprite');     // <template>, cloned per flying bird

// The frame is per-level now: level 1 is a 700x350 letterbox you run across, level 2 a 400x620
// portrait you fall down. These follow the loaded level via applyLevelGeometry(), so anything
// deriving from the viewport has to read them rather than assume 700.
let windowWidth = 700;
let windowHeight = 350;

// The end of a horizontal level is measured back from its right edge, so a level's length is a
// single number in its level file instead of several hardcoded positions. Vertical levels use an
// explicit `goal` rect instead, because "the far right-hand edge" means nothing running downward.
const goalInset = 200;
const winInset = 220;

let levelIndex = 0;
let level = LEVELS[levelIndex];
let worldWidth = level.worldWidth;
let worldHeight = level.worldHeight || level.frame.height;
let isVertical = level.axis === 'vertical';
let winX = worldWidth - winInset;

const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, Space: false };

let catX = level.spawnX;
let catY = level.spawnY || 0;
let velocityY = 0;
let isGrounded = true;
let groundedOn = null; // The entity Bumbot is standing on, so movers can carry him
// Where a death sends him back to. Both axes are tracked because a vertical level's checkpoint is
// a window partway *down* — respawning at y=0 there would drop him on the lethal street.
let respawnX = level.spawnX;
let respawnY = level.spawnY || 0;
let snacks = 1; // Snacks in the pouch; each one powers exactly one Sonic Meow
// The page now opens on the title card, so play does not begin until Start is pressed:
// gameActive stays false and the loop is never started until then.
let gameActive = false;
let menuActive = true;
let faceDirection = 1;

// --- Tunables. Values are "per 60fps frame" and get scaled by dt, so they mean
// --- the same thing at any refresh rate. Raise moveSpeed to cross the map faster.
const moveSpeed = 7;
const gravity = 0.8;
const jumpForce = 15;

// Jump apex is jumpForce^2 / (2 * gravity) ~= 141px. The tallest platform sits at
// 120 + 15 for the slab = 135px, so there is only ~6px of headroom: raising gravity
// or lowering jumpForce without rebalancing the other will make platforms unreachable.
// map.js documents the level-design limits these constants imply.

const fallDeathY = -80; // How far below the ground line a pit becomes fatal

// The furthest Bumbot may fall within a single physics slice, in px. Must stay below the 15px slab
// thickness or a fast fall tunnels straight through a ledge — see the slicing loop in update().
const maxSliceTravel = 10;

const frameMs = 1000 / 60;  // Reference frame duration that the constants above assume
const maxCatchUpFrames = 4; // Ceiling on dt so a stall can't teleport Bumbot across the map
let lastFrameTime = 0;

let audioCtx = null;
function playAudioTone(freq, type, duration) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// --- The catnip stash: a hidden developer mode. Type CATNIP to toggle it.
// Deliberately spelled with letters that are all unbound — any code containing M would fire a
// Sonic Meow on every keystroke, which rules out MEOW, BUMBOT and most obvious words.
// Session-only on purpose: nothing is persisted, so a reload is always a clean game.
//
// It grants exactly ONE thing: hold Shift and nothing stops him. The warp keys, god mode and the
// telemetry readout were all removed — a single verb that reads the same in both levels is worth
// more than a panel of switches. What that verb *means* falls out of the level's axis for free:
// running level 1 he ploughs through obstacles, falling level 2 he drops through every ledge.
const catnipCode = 'CATNIP';
const overclockMultiplier = 4; // Hold Shift: crosses level 1 in ~10s instead of ~38s
let catnipBuffer = '';
let catnipMode = false;
let overclocking = false;
let ghostFrame = 0;   // Rate-limits the afterimage trail

// Shared by the CATNIP toggle and by loadLevel, so there is exactly one teardown path
function disableCatnip() {
    const wasActive = catnipMode;
    catnipMode = false;
    overclocking = false;
    catnipBuffer = '';
    cat.classList.remove('catnip');
    devPanel.classList.remove('visible');
    return wasActive;
}

function trackCatnipCode(e) {
    if (!e.key || e.key.length !== 1) return;
    catnipBuffer = (catnipBuffer + e.key.toUpperCase()).slice(-catnipCode.length);
    if (catnipBuffer !== catnipCode) return;

    if (catnipMode) {
        disableCatnip();
        playAudioTone(300, 'sine', 0.12);
        return;
    }

    catnipBuffer = '';
    catnipMode = true;
    cat.classList.add('catnip');
    devPanel.classList.add('visible');
    // A rising trill: Bumbot found the good stuff
    playAudioTone(523.25, 'triangle', 0.09);
    setTimeout(() => playAudioTone(698.46, 'triangle', 0.09), 80);
    setTimeout(() => playAudioTone(880, 'triangle', 0.16), 160);
}

// A frozen snapshot of however Bumbot is currently drawn, safe to put anywhere in the document.
// Shared by the dash trail and the title card, and it has to do two things:
//   * strip the ids — they would duplicate the live sprite's, and a snapshot does not want
//     parts that carry on animating on their own.
//   * drop #bbFur first. Its "hidden unless spooked" state is an *id* selector, so once the
//     ids are gone the raised-fur spikes render — a snapshot has no fright state to show.
function cloneCatSprite() {
    const svg = cat.firstElementChild.cloneNode(true);
    const fur = svg.querySelector('#bbFur');
    if (fur) fur.remove();
    svg.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    return svg;
}

function spawnAfterImage() {
    const ghost = document.createElement('div');
    ghost.classList.add('after-image');
    ghost.appendChild(cloneCatSprite());
    ghost.style.left = catX + 'px';
    ghost.style.bottom = (40 + catY) + 'px';
    ghost.style.transform = 'scaleX(' + (-faceDirection) + ')';
    world.appendChild(ghost);
    setTimeout(() => ghost.remove(), 360);
}

window.addEventListener('keydown', (e) => {
    // Ahead of the gameActive guard, so the code still works while dead or on the win screen
    trackCatnipCode(e);
    // The whole of catnip's input surface. Unguarded like the code itself, so the rush is never
    // half-engaged after a death or a win.
    if (catnipMode && e.key === 'Shift') overclocking = true;

    // The title card answers to Enter or Space as well as the button, so a run can be started
    // without reaching for the mouse. Everything below is play input and stays blocked.
    if (menuActive) {
        if (e.key === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            handleStartButton();
        }
        return;
    }

    if (!gameActive) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.code === 'Space') {
        e.preventDefault();
        const keyName = e.code === 'Space' ? 'Space' : e.key;
        keys[keyName] = true;
    }
    if (e.code === 'KeyM') triggerSonicMeow();
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') overclocking = false; // Unguarded, so the rush can't stick on
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.code === 'Space') {
        const keyName = e.code === 'Space' ? 'Space' : e.key;
        keys[keyName] = false;
    }
});

let RuntimeEntities = [];
let BirdEntities = [];

// Only these types take part in solid collision. Spikes, snacks and the checkpoint portal
// are overlap-only, so they are handled in handleOverlapSystems instead.
function isSolidType(type) {
    return type === 'pillar' || type === 'platform' || type === 'mover';
}

// Platforms and movers are thin slabs you land on top of; pillars are full-height blocks.
function isSlabType(type) {
    return type === 'platform' || type === 'mover';
}

// Which piece of roof machinery a pillar is. The map data can name it outright; without one,
// height decides, so no pillar ever renders as an anonymous grey box.
function rooftopVariant(obj) {
    if (obj.variant) return obj.variant;
    if (obj.height <= 45) return 'hatch';
    if (obj.height <= 65) return 'ac';
    if (obj.height <= 95) return 'tank';
    return 'stack';
}

// A pit is only fatal once Bumbot's centre is past its edge, which keeps the edges
// forgiving rather than making a 1px overhang deadly.
function isOverSolidGround(x) {
    const center = x + 17;
    return !level.pits.some(pit => center > pit.x && center < pit.x + pit.width);
}

function applyLevelGeometry() {
    // The frame first: everything below derives from the viewport size, and so does the camera.
    windowWidth = level.frame.width;
    windowHeight = level.frame.height;
    isVertical = level.axis === 'vertical';
    worldWidth = level.worldWidth;
    worldHeight = level.worldHeight || windowHeight;
    winX = worldWidth - winInset;

    gameWindow.style.width = windowWidth + 'px';
    gameWindow.style.height = windowHeight + 'px';
    // The bar is fused to the window as one frame, so it has to match the window's OUTER width:
    // 4px of border on each side, same as the 708px the stylesheet hardcoded for level 1.
    instructionsBar.style.width = (windowWidth + 8) + 'px';
    // Lets the stylesheet reshape anything that only makes sense in one orientation — the
    // skyline layers, for one, sit on the horizon of a landscape frame and nowhere in a portrait.
    gameWindow.classList.toggle('vertical-level', isVertical);

    world.style.width = worldWidth + 'px';

    if (isVertical) {
        // #world has to be taller than the frame and anchored to its BOTTOM, so a child written
        // at `bottom: 40 + y` lands where the ground-relative convention says it should. The
        // camera then slides the whole thing down past the window (see applyCamera).
        world.style.height = (worldHeight + 40) + 'px';
        world.style.top = 'auto';
        world.style.left = '0px';
        goalFeeder.style.display = 'none'; // A vertical level's goal is its window, not the feeder
    } else {
        world.style.height = '100%';
        world.style.top = '0';
        world.style.bottom = 'auto';
        goalFeeder.style.display = '';
        goalFeeder.style.left = (worldWidth - goalInset) + 'px';
    }
}

function buildGround() {
    // The ground is no longer one wide div: it is the stretches between the level's pits.
    const ordered = [...level.pits].sort((a, b) => a.x - b.x);
    let cursor = 0;

    ordered.forEach(pit => {
        addGroundSegment(cursor, pit.x - cursor);

        const void_ = document.createElement('div');
        void_.classList.add('pit', 'level-entity');
        void_.style.left = pit.x + 'px';
        void_.style.width = pit.width + 'px';
        world.appendChild(void_);

        cursor = pit.x + pit.width;
    });

    addGroundSegment(cursor, worldWidth - cursor);
}

function addGroundSegment(left, width, extraClass) {
    if (width <= 0) return;
    const segment = document.createElement('div');
    segment.classList.add('ground-segment', 'level-entity');
    // A vertical level's floor is the street, not a roof: same box, different material and no
    // parapets, and touching it is fatal rather than safe.
    if (extraClass) segment.classList.add(extraClass);
    segment.style.left = left + 'px';
    segment.style.width = width + 'px';
    world.appendChild(segment);
}

// --- Everything that genuinely depends on level.axis lives in one of these four functions, plus
// --- applyLevelGeometry and applyCamera. Six branch points in total; keep it that way. If a
// --- seventh appears, that is the signal to split the engine per axis rather than keep threading
// --- `isVertical` through it. See "Axis-dependent behaviour" in CLAUDE.md.

// The floor. A horizontal level's is the roofline: one segment per stretch between its pits, with
// a void div per gap. A vertical level's is the street at the bottom of the shaft — one segment
// across the full width, lethal to touch, there to be looked down at rather than walked on.
function buildTerrain() {
    if (isVertical) {
        addGroundSegment(0, worldWidth, 'street');
        return;
    }
    buildGround();
}

// Has the level been completed? Horizontal levels win at a line measured back from the right-hand
// edge; vertical levels win by overlapping the `goal` rect, because "the far right-hand edge"
// means nothing when the level runs downward.
function hasReachedGoal() {
    if (!isVertical) return catX >= winX;

    const g = level.goal;
    if (!g) return false;
    return catX < g.x + g.width && catX + 35 > g.x &&
           catY < g.y + g.height && catY + 45 > g.y;
}

// Has the checkpoint been passed? Running right, that means crossing its x.
//
// Falling, it means being *stood on the balcony outside the window* — deliberately not merely
// "descended past its height". A bare `catY <= obj.y` test opened a level skip: dive down the clear
// middle slot, collect the checkpoint mid-plummet, hit the street, and respawn halfway down the
// level having played none of it. Requiring `isGrounded` closes it, because a diving player is
// airborne for the whole fall. The x band is belt-and-braces for a future level that puts two
// ledges at the same height.
function hasPassedCheckpoint(obj) {
    if (!isVertical) return catX + 35 > obj.x;

    const y = obj.y || 0;
    return isGrounded && Math.abs(catY - y) < 24 && Math.abs(catX - obj.x) < 180;
}

// Where a checkpoint sends him back to. Clear of the pipe mouth in a horizontal level; standing on
// the ledge outside the window in a vertical one.
function checkpointRespawn(obj) {
    if (isVertical) return { x: obj.x - 30, y: (obj.y || 0) };
    return { x: obj.x + 14, y: 0 };
}

function generateLevel() {
    // Everything generated per level carries .level-entity, so clearing never depends on
    // an up-to-date list of type classes — and never touches the static goal feeder,
    // which shares the .feeder class with nothing else in the world.
    document.querySelectorAll('.level-entity').forEach(el => el.remove());
    RuntimeEntities = [];
    BirdEntities = [];

    // Sync our top dashboard display panel instantly on load
    energyDisplay.innerText = "Snacks: " + snacks;
    meowBubble.innerText = "I am Bumbot!!!";

    buildTerrain();

    // A vertical level's goal is a window in the wall, so it is drawn as an entity rather than
    // being the static #goalFeeder that applyLevelGeometry parks at the end of a horizontal level.
    if (isVertical && level.goal) {
        const goalEl = document.createElement('div');
        goalEl.classList.add('goal-window', 'level-entity');
        goalEl.style.left = level.goal.x + 'px';
        goalEl.style.width = level.goal.width + 'px';
        goalEl.style.height = level.goal.height + 'px';
        goalEl.style.bottom = (40 + level.goal.y) + 'px';
        world.appendChild(goalEl);
    }

    level.objects.forEach((obj, index) => {
        const element = document.createElement('div');
        element.id = "ent-" + index;
        element.classList.add('level-entity');

        if (obj.type === 'pillar') {
            element.classList.add('obstacle', rooftopVariant(obj));
            element.style.left = obj.x + 'px';
            element.style.width = obj.width + 'px';
            element.style.height = obj.height + 'px';
        } else if (obj.type === 'spike') {
            element.classList.add('spike');
            element.style.left = obj.x + 'px';
            element.style.bottom = (40 + (obj.y || 0)) + 'px'; // y lets spikes sit on slabs
        } else if (obj.type === 'platform') {
            element.classList.add('platform');
            if (obj.hidden) element.classList.add('hidden-platform');
            // A vertical level's slabs are architecture growing out of a wall, so they carry which
            // wall and which kind. Cosmetic only — collision is the same 15px slab either way.
            if (obj.side) element.classList.add('ledge', 'ledge-' + obj.side);
            if (obj.variant) element.classList.add('ledge-' + obj.variant);
            element.style.left = obj.x + 'px';
            element.style.width = obj.width + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'mover') {
            // The axis class picks the machinery: a gondola on cables or a hoist on a mast
            element.classList.add('mover', obj.axis === 'y' ? 'mover-y' : 'mover-x');
            element.style.left = obj.x + 'px';
            element.style.width = obj.width + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'snack') {
            element.classList.add('snack'); // Drawn entirely in CSS, no glyph
            element.style.left = obj.x + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'portal' || obj.type === 'pipe') {
            // Both are the same vent pipe. The checkpoint lights up when reached; a plain
            // 'pipe' is scenery that Bumbot climbs out of and is lit from the start.
            element.classList.add('vent-pipe'); // Drawn entirely in CSS, no glyph
            if (obj.type === 'pipe') element.classList.add('active');
            element.style.left = obj.x + 'px';
            // A vertical level's checkpoint is partway down a wall, so it needs a height. Level 1's
            // sit on the deck and omit y, which is why this falls back to 0.
            element.style.bottom = (40 + (obj.y || 0)) + 'px';
        }

        world.appendChild(element);

        const entity = { ...obj, dom: element, active: true };
        if (obj.type === 'mover') {
            // Movers oscillate around where the data placed them, so remember the origin
            entity.baseX = obj.x;
            entity.baseHeight = obj.height;
            entity.dir = 1;
        }
        RuntimeEntities.push(entity);
    });

    level.birds.forEach((pig) => {
        const element = document.createElement('div');
        // Species and behaviour are one and the same up here: pigeons are the ones strutting the
        // deck on foot, crows are the ones working the air. The class carries the species so the
        // stylesheet can light each one its own way.
        const walker = pig.axis === 'walk';
        element.classList.add('bird', walker ? 'pigeon' : 'crow', 'level-entity');
        // Both species are drawn sprites now, cloned per bird from the templates at the bottom of
        // index.html. Their parts carry classes rather than ids, so any number can coexist.
        element.appendChild((walker ? pigeonSprite : crowSprite).content.cloneNode(true));
        element.style.left = pig.x + 'px';
        // Same ground-relative convention as every other entity, and the same one the collision
        // check below already assumed — birds used to render 40px below their own hitbox.
        element.style.bottom = (40 + pig.y) + 'px';
        world.appendChild(element);

        BirdEntities.push({
            dom: element, x: pig.x, y: pig.y,
            axis: pig.axis || 'x',
            min: pig.min, max: pig.max,
            speed: pig.speed || 2, dir: 1, active: true
        });
    });
}

let activeParticles = [];

function createShatterBurst(originX, originY, obstacleHeight) {
    // Generate 15 individual flying debris vectors distributed vertically over the obstacle's original height
    for (let i = 0; i < 15; i++) {
        const pElement = document.createElement('div');
        pElement.classList.add('rubble-particle');

        // Randomly scatter start coordinates inside the target obstacle's frame space
        let startX = originX + (Math.random() * 40);
        let startY = originY + (Math.random() * obstacleHeight);

        pElement.style.left = startX + 'px';
        pElement.style.bottom = (40 + startY) + 'px';
        world.appendChild(pElement);

        // Initialize independent directional trajectory velocities
        activeParticles.push({
            dom: pElement,
            x: startX,
            y: startY,
            vx: (Math.random() * 8 - 4), // Left or right spray velocity
            vy: (Math.random() * 6 + 4),  // Initial upward explosion velocity kick
            alpha: 1,
            life: 1.0 // Fades out completely over 1 second
        });
    }
}

// Shared by the Sonic Meow and the catnip dash, so a smashed pillar looks and sounds
// identical however it was smashed.
function shatterEntity(ent) {
    if (!ent.active) return;
    ent.active = false;

    createShatterBurst(ent.x, ent.y || 0, ent.height || 40);

    const crackLayer = document.createElement('div');
    crackLayer.classList.add('cracked');
    ent.dom.appendChild(crackLayer);

    ent.dom.style.transition = "transform 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97), opacity 0.4s ease-out";
    ent.dom.style.transform = "scale(0) rotate(" + (Math.random() * 30 - 15) + "deg)";
    ent.dom.style.opacity = "0";

    setTimeout(() => ent.dom.remove(), 400);
    playAudioTone(120, 'sawtooth', 0.2);
}

function vaporizeBird(pig) {
    if (!pig.active) return;
    pig.active = false; // Stops the patrol clamp from resurrecting it

    createShatterBurst(pig.x, pig.y, 20);
    pig.dom.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
    pig.dom.style.transform = "translateY(-50px) scale(0)";
    pig.dom.style.opacity = "0";
    setTimeout(() => pig.dom.remove(), 300);
}

// The catnip dash: Shift held in catnip mode. Nothing stops him — pillars and spikes
// shatter, birds vaporize, pits are crossed as if the ground were whole.
function isDashing() {
    return catnipMode && overclocking;
}

// The camera clamps, in one place. Several callers need them and they used to each carry their own
// copy: the game loop, the Sonic Meow's screen-clearing bounds, and the still frame drawn
// behind the title card.
function cameraForX(x) {
    let cameraX = x - (windowWidth / 2) + 25;
    if (cameraX < 0) cameraX = 0;
    // In a vertical level the world is exactly one screen wide, so this resolves to 0 and the
    // camera simply never pans sideways. No special case needed.
    if (cameraX > worldWidth - windowWidth) cameraX = worldWidth - windowWidth;
    return cameraX;
}

function cameraForY(y) {
    let cameraY = y - (windowHeight / 2) + 21; // 21 = half of Bumbot's 42px box
    if (cameraY < 0) cameraY = 0;
    if (cameraY > worldHeight - windowHeight) cameraY = worldHeight - windowHeight;
    return cameraY;
}

function applyCamera() {
    const cameraX = cameraForX(catX);
    world.style.left = (-cameraX) + 'px';

    // Vertical levels slide #world DOWN past the window. It is anchored by its bottom edge (see
    // applyLevelGeometry), so pushing that edge below the frame scrolls the view up through the
    // world while every child stays exactly where `bottom: 40 + y` put it.
    if (isVertical) world.style.bottom = (-cameraForY(catY)) + 'px';

    // Instead of sliding elements left, we shift their internal vector textures infinitely
    farBuildings.style.backgroundPositionX = (-(cameraX * 0.15)) + 'px';
    nearBuildings.style.backgroundPositionX = (-(cameraX * 0.40)) + 'px';
}

function triggerSonicMeow() {
    if (snacks <= 0) {
        playAudioTone(150, 'sine', 0.1);
        return;
    }

    snacks--;
    energyDisplay.innerText = "Snacks: " + snacks;

    playAudioTone(200, 'sawtooth', 0.4);
    playAudioTone(400, 'square', 0.4);
    playAudioTone(800, 'triangle', 0.5);

    meowBubble.style.display = 'block';
    setTimeout(() => { meowBubble.style.display = 'none'; }, 1600);

    const ripple = document.createElement('div');
    ripple.classList.add('sonic-ripple');

    // Centred on Bumbot, written in the same ground-relative `40 + y` convention as every other
    // entity — it used to be positioned from the top against a hardcoded 310 (the 350px frame
    // minus the ground), which is exactly the kind of thing a 620px portrait breaks. The 21 lifts
    // it from his paws to his middle, and .sonic-ripple's transform does the centring.
    ripple.style.left = (catX + 25) + 'px';
    ripple.style.bottom = (40 + catY + 21) + 'px';
    world.appendChild(ripple);

    // Automatically delete the ripple node from the DOM once the animation ends
    setTimeout(() => ripple.remove(), 600);

    // What counts as "on screen". Both axes are tested, always: in a vertical level every entity
    // shares the same narrow x range, so an x-only test would clear the entire level with one meow.
    const viewLeftBound = cameraForX(catX);
    const viewRightBound = viewLeftBound + windowWidth;
    const viewBottomBound = isVertical ? cameraForY(catY) : 0;
    const viewTopBound = viewBottomBound + windowHeight;

    function onScreen(x, y) {
        return x >= viewLeftBound - 40 && x <= viewRightBound &&
               y >= viewBottomBound - 40 && y <= viewTopBound;
    }

    // Core screen-clearing logic for pillars and spikes. Pits and movers are immune,
    // which is what keeps the level's route snack-free by design.
    RuntimeEntities.forEach(ent => {
        if (!ent.active || (ent.type !== 'pillar' && ent.type !== 'spike')) return;
        if (onScreen(ent.x, ent.y || 0)) shatterEntity(ent);
    });

    // Also blast away visible birds
    BirdEntities.forEach(pig => {
        if (pig.active && onScreen(pig.x, pig.y)) vaporizeBird(pig);
    });
}

function checkSolidCollision(targetX, targetY) {
    const catWidth = 35;
    const catHeight = 45;
    for (let obj of RuntimeEntities) {
        if (!obj.active || !isSolidType(obj.type)) continue;
        let objMinX = obj.x;
        let objMaxX = obj.x + obj.width;
        let objMinY = 0;
        let objMaxY = obj.height;
        if (isSlabType(obj.type)) {
            objMinY = obj.height;
            objMaxY = obj.height + 15;
        }
        if (targetX < objMaxX && targetX + catWidth > objMinX && targetY < objMaxY && targetY + catHeight > objMinY) {
            return obj;
        }
    }
    return null;
}

function updateMovers(dt) {
    RuntimeEntities.forEach(ent => {
        if (!ent.active || ent.type !== 'mover') return;

        if (ent.axis === 'y') {
            const previous = ent.height;
            let next = previous + (ent.speed * ent.dir * dt);
            if (next >= ent.baseHeight + ent.range) { next = ent.baseHeight + ent.range; ent.dir = -1; }
            else if (next <= ent.baseHeight) { next = ent.baseHeight; ent.dir = 1; }
            ent.height = next;
            ent.dom.style.bottom = (40 + next) + 'px';
            if (groundedOn === ent) catY += next - previous; // Carry the passenger
        } else {
            const previous = ent.x;
            let next = previous + (ent.speed * ent.dir * dt);
            if (next >= ent.baseX + ent.range) { next = ent.baseX + ent.range; ent.dir = -1; }
            else if (next <= ent.baseX) { next = ent.baseX; ent.dir = 1; }
            ent.x = next;
            ent.dom.style.left = next + 'px';
            if (groundedOn === ent) catX += next - previous;
        }
    });
}

function handleOverlapSystems() {
    const catWidth = 35;
    const catHeight = 45;

    if (hasReachedGoal()) {
        gameActive = false;
        startVictorySequence();
        return;
    }

    const dashing = isDashing();

    BirdEntities.forEach(pig => {
        if (!pig.active) return;
        // The glyph floats inside a 40px box, so the hitbox is inset to match the bird
        if (catX < pig.x + 34 && catX + catWidth > pig.x + 6 && catY < pig.y + 32 && catY + catHeight > pig.y + 8) {
            if (dashing) vaporizeBird(pig);
            else triggerHurtReset();
        }
    });

    RuntimeEntities.forEach(obj => {
        if (!obj.active) return;

        if (obj.type === 'spike') {
            const base = obj.y || 0;
            if (catX < obj.x + obj.width && catX + catWidth > obj.x && catY < base + obj.height && catY + catHeight > base) {
                if (dashing) shatterEntity(obj);
                else triggerHurtReset();
            }
        }

        // Pillars are solid, so they are normally never checked here — only a dash can
        // occupy the same space as one, and when it does the pillar loses.
        if (dashing && obj.type === 'pillar') {
            if (catX < obj.x + obj.width && catX + catWidth > obj.x && catY < obj.height && catY + catHeight > 0) {
                shatterEntity(obj);
            }
        }

        if (obj.type === 'snack') {
            // 34 wide matches the drawn stick; the 25 of vertical reach is deliberately
            // generous so a snack can be grabbed in passing at the top of a jump
            if (catX < obj.x + 34 && catX + catWidth > obj.x && catY < obj.height + 25 && catY + catHeight > obj.height) {
                obj.active = false;
                obj.dom.remove();
                snacks++;
                energyDisplay.innerText = "Snacks: " + snacks;
                playAudioTone(880, 'sine', 0.08);
            }
        }

        if (obj.type === 'portal' && !obj.triggered && hasPassedCheckpoint(obj)) {
            obj.triggered = true;
            obj.dom.classList.add('active');
            const spot = checkpointRespawn(obj);
            respawnX = spot.x;
            respawnY = spot.y;

            meowBubble.innerText = "Checkpoint!";
            meowBubble.style.display = 'block';
            setTimeout(() => {
                meowBubble.style.display = 'none';
                meowBubble.innerText = "I am Bumbot!!!";
            }, 1400);

            playAudioTone(660, 'sine', 0.1);
            setTimeout(() => playAudioTone(990, 'sine', 0.15), 110);
        }
    });
}

const munchDuration = 1900; // How long Bumbot eats before the win screen covers the scene
const windowEntryDuration = 1200; // How long he takes to squeeze through the goal window

// The win screen is a full-window overlay, so it always has to wait for the animation underneath
// it to finish — show it immediately and the payoff is invisible. Which animation depends on what
// the level's goal actually is: a bowl to eat from, or a window to get through.
function startVictorySequence() {
    if (isVertical) startWindowEntry();
    else startVictoryMunch();
}

// Shared tail of both sequences: the overlay, its copy, and the fanfare.
function revealWinScreen(message) {
    const hasNextLevel = levelIndex + 1 < LEVELS.length;
    winButton.innerText = hasNextLevel ? 'Enter Next Level' : 'Replay Level';
    finalScore.innerText = message;
    winScreen.style.display = 'flex';

    playAudioTone(523.25, 'sine', 0.1);
    setTimeout(() => playAudioTone(659.25, 'sine', 0.15), 100);
    setTimeout(() => playAudioTone(783.99, 'sine', 0.3), 200);
}

function startVictoryMunch() {
    // Standing beside the bowl, not on top of it: his 50px box parked flush over the feeder hid
    // the whole thing, so the emptying kibble — the point of the sequence — was invisible.
    // 38px back puts his nose at the rim with the bowl left in clear view.
    catX = worldWidth - goalInset - 38;
    catY = 0;
    velocityY = 0;
    isGrounded = true;
    groundedOn = null;

    // update() has already stopped running, so the last frame has to be drawn by hand
    catContainer.style.left = catX + 'px';
    catContainer.style.bottom = '40px';
    catContainer.style.setProperty('--face', -1); // Face the feeder
    catContainer.classList.remove('cat-idle', 'cat-launch', 'cat-land');
    cat.classList.add('munching');
    // update() has stopped, so nothing will clear the gait classes for us — and a cat whose legs
    // are still striding while he eats looks broken.
    cat.classList.remove('cat-run', 'cat-air');

    // Kibble disappears partway through, so the bowl ends up visibly emptied
    setTimeout(() => goalFeeder.classList.add('eaten'), 950);

    for (let i = 0; i < 7; i++) {
        setTimeout(() => playAudioTone(150 + (i % 3) * 45, 'square', 0.05), i * 230);
    }

    setTimeout(() => {
        cat.classList.remove('munching');
        // One line, always. There used to be a second variant here for "a next level exists" that
        // named the level and counted leftover snacks — dead code for as long as there was only one
        // level (grammar bug included: "with 1 snacks to spare"), and not wanted once level 2 made
        // it reachable. The button label still varies; the copy does not.
        revealWinScreen("Bumbot safely made it to his lunch!");
    }, munchDuration);
}

// A vertical level ends by getting *in* rather than by eating. He is snapped to the window's mouth
// and shrinks into it — the reverse of the pipe emerge he arrives by, which is the whole point:
// every entrance and exit in this game is Bumbot squeezing through a gap too small for him.
function startWindowEntry() {
    const g = level.goal;
    catX = g.x + 8;
    catY = g.y;
    velocityY = 0;
    isGrounded = true;
    groundedOn = null;

    // The loop has stopped, so this final frame is drawn by hand — same reason as the munch above
    catContainer.style.left = catX + 'px';
    catContainer.style.bottom = (40 + catY) + 'px';
    catContainer.style.setProperty('--face', -1);
    catContainer.classList.remove('cat-idle', 'cat-launch', 'cat-land', 'cat-emerge');
    cat.classList.remove('cat-run', 'cat-air', 'munching');
    void catContainer.offsetWidth; // Force the reflow, or a replay would not re-run the animation
    catContainer.classList.add('cat-enter');

    playAudioTone(430, 'sine', 0.09);
    setTimeout(() => playAudioTone(300, 'sine', 0.14), 150);

    setTimeout(() => {
        // Also one line, matching level 1. This copy is invented rather than inherited, so it is
        // the first thing to change if it doesn't sound like Bumbot.
        revealWinScreen("Bumbot squeezed inside, off the street and out of the cold.");
    }, windowEntryDuration);
}

// Two ways to die, and they look different. cause 'pit' is a fall into an alley, where he is
// already dropping and just keeps going; anything else is contact with wire or a bird, where his
// fur stands up and he bails off the bottom of the screen in fright. Neither flashes the screen —
// the whole read is on the sprite.
function triggerHurtReset(cause) {
    if (!gameActive) return;

    // Step 1: Lock player controls and physics instantly
    gameActive = false;
    cat.classList.remove('cat-run', 'cat-air'); // The loop has stopped; don't freeze him mid-stride

    const fellInAlley = cause === 'pit';

    // Step 2: The sound of it. A pained yowl for a hit; for a fall, the same yowl dropping away
    // further and slower, as though it is going down the alley with him.
    if (fellInAlley) {
        playAudioTone(430, 'sawtooth', 0.22);
        setTimeout(() => playAudioTone(250, 'sawtooth', 0.26), 120);
        setTimeout(() => playAudioTone(120, 'sine', 0.34), 260);
    } else {
        playAudioTone(520, 'sawtooth', 0.18);
        setTimeout(() => playAudioTone(340, 'sawtooth', 0.18), 90);
        setTimeout(() => playAudioTone(190, 'square', 0.24), 180);
    }

    // Step 3: Fur up, then bail — or, in an alley, simply carry on down out of sight
    let hold;
    if (fellInAlley) {
        catContainer.classList.add('cat-plunge');
        hold = 520;
    } else {
        cat.classList.add('cat-spooked');
        setTimeout(() => catContainer.classList.add('cat-bail'), 200);
        hold = 800;
    }

    // Step 4: Hold the failure scene until he is off screen, then bring him back out of a pipe
    setTimeout(() => {
        // Clear layout modifiers cleanly
        cat.classList.remove('cat-spooked');
        catContainer.classList.remove('cat-bail', 'cat-plunge');

        // Back to the checkpoint if one has been passed, otherwise the level's own spawn. Never
        // back to the start of the game — a death costs you this level's progress and nothing more.
        catX = respawnX;
        catY = respawnY;
        velocityY = 0;
        isGrounded = true;
        groundedOn = null;
        wasInAirBefore = false;
        catContainer.style.setProperty('--face', -1); // Out of the pipe facing the way he runs
        // Draw the new position by hand before the emerge starts: the loop is still stopped, and
        // without this he would play one frame of climbing out of a pipe wherever he died.
        catContainer.style.left = catX + 'px';
        catContainer.style.bottom = (40 + catY) + 'px';
        applyCamera(); // Likewise the camera, or one frame renders at the old scroll position
        playPipeEmerge();

        // Re-engage main updating runtime loops loop
        gameActive = true;
        lastFrameTime = 0; // Discard the death pause so it is not treated as one huge frame
        requestAnimationFrame(update);
    }, hold);
}

let activeDust = [];
let wasInAirBefore = false; // Internal tracking state flag for gravity thresholds
let idleFrames = 0;
const idleThreshold = 180; // ~3 seconds of standing still before he settles

// Restarting a CSS animation needs the class gone and a reflow forced in between,
// otherwise a second jump in quick succession would not replay the squash.
function playBodyAnimation(className, duration) {
    catContainer.classList.remove('cat-launch', 'cat-land', 'cat-idle', 'cat-emerge');
    void catContainer.offsetWidth;
    catContainer.classList.add(className);
    setTimeout(() => catContainer.classList.remove(className), duration);
}

// Every place Bumbot appears — the level opening and every respawn — he is coming out of a vent
// pipe, so both spawn points have one in the level data and both play this.
function playPipeEmerge() {
    playBodyAnimation('cat-emerge', 420);
    playAudioTone(300, 'sine', 0.07);
    setTimeout(() => playAudioTone(460, 'sine', 0.09), 120);
}

function createLandingDust(originX, originY) {
    // Generate 6 small smoke cloud rings expanding sideways outwards from Bumbot's paws
    for (let i = 0; i < 6; i++) {
        const dustElement = document.createElement('div');
        dustElement.classList.add('dust-particle');

        dustElement.style.left = (originX + 20) + 'px'; // Center horizontally under Bumbot's 50px box
        dustElement.style.bottom = (40 + originY) + 'px';
        world.appendChild(dustElement);

        activeDust.push({
            dom: dustElement,
            x: originX + 20,
            y: originY,
            vx: (Math.random() * 4 - 2), // Shoots outwards left and right
            vy: (Math.random() * 1.5),   // Floats gently upward
            life: 1.0
        });
    }
}

function stepPhysics(dt) {
    // 0. Move the platforms before the player, so a passenger rides along cleanly
    updateMovers(dt);

    // Catnip rush. 4x of 7px is 28px per slice, still under the 40px pillar width, so
    // sprinting cannot tunnel through a solid. While dashing nothing blocks him at all —
    // solid collision is skipped and whatever he hits is destroyed in handleOverlapSystems.
    const dashing = isDashing();
    const speed = moveSpeed * (dashing ? overclockMultiplier : 1);

    // 1. Horizontal Inputs
    if (keys.ArrowRight) {
        faceDirection = 1;
        catContainer.style.setProperty('--face', -1);
        const step = speed * dt;
        if (dashing || !checkSolidCollision(catX + step, catY)) catX += step;
        if (catX > worldWidth - 50) catX = worldWidth - 50;
    }
    if (keys.ArrowLeft) {
        faceDirection = -1;
        catContainer.style.setProperty('--face', 1);
        const step = speed * dt;
        if (dashing || !checkSolidCollision(catX - step, catY)) catX -= step;
        if (catX < 0) catX = 0;
    }

    // 2. Vertical Jump Physics Engine
    if ((keys.ArrowUp || keys.Space) && isGrounded) {
        velocityY = jumpForce; // An instant impulse, so this one is not dt-scaled
        isGrounded = false;
        groundedOn = null;
        wasInAirBefore = true; // Flag that Bumbot took off
        playBodyAnimation('cat-launch', 170);
    }

    if (!isGrounded) {
        velocityY -= gravity * dt;
        let nextY = catY + velocityY * dt;
        // Dashing runs straight through platforms and movers instead of landing on them
        let hitObj = dashing ? null : checkSolidCollision(catX, nextY);

        if (hitObj) {
            if (velocityY < 0) {
                nextY = isSlabType(hitObj.type) ? hitObj.height + 15 : hitObj.height;
                isGrounded = true;
                velocityY = 0;
                groundedOn = hitObj;

                // Landing is what makes a hidden platform materialise, permanently
                if (hitObj.hidden && !hitObj.revealed) {
                    hitObj.revealed = true;
                    hitObj.dom.classList.add('revealed');
                    playAudioTone(660, 'triangle', 0.12);
                    setTimeout(() => playAudioTone(880, 'triangle', 0.18), 90);
                }
            } else {
                velocityY = 0; nextY = catY;
            }
        }

        catY = nextY;

        if (catY <= 0) {
            // A lethal floor is the bottom of a vertical level: the street, forty storeys down.
            // Falling is the route in that level, so the failure state has to live here rather
            // than in the pit list — and a dash does not save him from it either, because there
            // is nothing below the street to drop through.
            if (level.lethalFloor) {
                triggerHurtReset('pit');
                return;
            }
            // Dashing treats every pit as if the ground were whole, so he runs straight over
            if (isOverSolidGround(catX) || dashing) {
                catY = 0; velocityY = 0; isGrounded = true; groundedOn = null;
            } else if (catY < fallDeathY) {
                triggerHurtReset('pit'); // Fell into an alley: no fright, he just keeps going down
                return;
            }
        }
    } else {
        if (catY > 0) {
            // Standing on something: keep track of what, so movers keep carrying us
            const support = checkSolidCollision(catX, catY - 1);
            if (support) {
                groundedOn = support;
            } else {
                isGrounded = false; velocityY = 0; groundedOn = null;
                wasInAirBefore = true;
            }
        } else if (!isOverSolidGround(catX) || level.lethalFloor) {
            // Walked off the lip of a pit — or is standing on a floor that was never safe
            isGrounded = false; velocityY = 0; groundedOn = null;
            wasInAirBefore = true;
        }
    }

    // Detects the exact frame Bumbot hits solid surface ground/platform
    if (isGrounded && wasInAirBefore) {
        createLandingDust(catX, catY);
        wasInAirBefore = false; // Reset takeoff state flag
        playBodyAnimation('cat-land', 190); // Absorbs the impact through his legs
        playAudioTone(250, 'sine', 0.04); // Deep quiet thump landing frequency note bleep
    }

    // 3. Update the birds — the crows working the air and the pigeons strutting the deck
    BirdEntities.forEach(pig => {
        if (!pig.active) return;
        const travel = pig.speed * pig.dir * dt;

        if (pig.axis === 'y') {
            pig.y += travel;
            if (pig.y >= pig.max) { pig.y = pig.max; pig.dir = -1; }
            else if (pig.y <= pig.min) { pig.y = pig.min; pig.dir = 1; }
            pig.dom.style.bottom = (40 + pig.y) + 'px';
        } else {
            // Both 'x' (hovering patrol) and 'walk' (strutting the roof) travel horizontally;
            // a pigeon's y never changes, so it is only written once, at spawn.
            pig.x += travel;
            if (pig.x >= pig.max) { pig.x = pig.max; pig.dir = -1; }
            else if (pig.x <= pig.min) { pig.x = pig.min; pig.dir = 1; }
            pig.dom.style.left = pig.x + 'px';
            if (pig.axis === 'walk') {
                // The strut animation owns `transform`, so facing has to travel as a variable
                // the keyframes re-state — the same trick --face plays for Bumbot.
                pig.dom.style.setProperty('--wing', pig.dir === 1 ? -1 : 1);
            } else {
                pig.dom.style.transform = pig.dir === 1 ? 'scaleX(-1)' : 'scaleX(1)';
            }
        }
    });

    handleOverlapSystems();
}

function update(timestamp) {
    if (!gameActive) return;

    // Measure how long the last frame actually took, expressed in 60fps frames, so a
    // display running at 30fps or a browser dropping frames plays at the same speed
    // instead of going into slow motion.
    let dt = 1;
    if (lastFrameTime && timestamp) {
        dt = Math.min((timestamp - lastFrameTime) / frameMs, maxCatchUpFrames);
    }
    lastFrameTime = timestamp || 0;

    // Advance physics in slices. Two separate limits, and both matter:
    //
    //   * at most one frame per slice — a single big dt could carry Bumbot straight through a
    //     15px platform slab without ever overlapping it.
    //   * at most maxSliceTravel px of *fall* per slice. Time-slicing alone is not enough once a
    //     level runs downward: falling the height of a 620px portrait screen reaches ~31px per
    //     frame, which clears a 15px ledge in one step no matter how small dt is. Level 1 never
    //     falls far enough to trip this (its tallest drop peaks at ~14.7px/frame), so its feel is
    //     untouched — this is deliberately a subdivision, not a speed cap, precisely so that
    //     nothing about how fast he falls changes.
    let remaining = dt;
    while (remaining > 0 && gameActive) {
        let slice = Math.min(remaining, 1);
        const fallPerFrame = Math.abs(velocityY);
        if (fallPerFrame * slice > maxSliceTravel) slice = maxSliceTravel / fallPerFrame;
        stepPhysics(slice);
        remaining -= slice;
    }

    // Death and win both clear gameActive and own restarting the loop themselves
    if (!gameActive) return;

    // Update active landing smoke particles vector simulation
    for (let i = activeDust.length - 1; i >= 0; i--) {
        let d = activeDust[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= 0.04 * dt; // Fast fade rate parameters

        d.dom.style.left = d.x + 'px';
        d.dom.style.bottom = (40 + d.y) + 'px';
        d.dom.style.opacity = d.life;
        d.dom.style.transform = "scale(" + (2 - d.life) + ")"; // Expands as it dissipates

        if (d.life <= 0) {
            d.dom.remove();
            activeDust.splice(i, 1);
        }
    }

    // 4. Update Shatter Block Particles System
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        let p = activeParticles[i];
        p.vy -= 0.3 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= 0.02 * dt;
        p.dom.style.left = p.x + 'px';
        p.dom.style.bottom = (40 + p.y) + 'px';
        p.dom.style.opacity = p.life;
        if (p.life <= 0 || p.y < -40) { p.dom.remove(); activeParticles.splice(i, 1); }
    }

    catContainer.style.left = catX + 'px';
    catContainer.style.bottom = (40 + catY) + 'px';

    // Idle settling. Only kicks in while he is grounded and not being driven, and any input
    // cancels it immediately so it can never fight the launch/land squash.
    if (isGrounded && !keys.ArrowLeft && !keys.ArrowRight) {
        idleFrames += dt;
        if (idleFrames > idleThreshold) catContainer.classList.add('cat-idle');
    } else {
        idleFrames = 0;
        catContainer.classList.remove('cat-idle');
    }

    // Gait. These drive the sprite's legs and tail, so they go on #cat rather than the
    // container — the container's transform belongs to the squash and emerge animations.
    const striding = isGrounded && (keys.ArrowLeft || keys.ArrowRight);
    cat.classList.toggle('cat-run', striding);
    cat.classList.toggle('cat-air', !isGrounded);

    // Catnip's one remaining visible extra: a motion trail while the rush is held. Falling counts
    // as moving — in a vertical level the rush is mostly gravity, with no direction key held at all.
    if (catnipMode && overclocking) {
        ghostFrame++;
        const moving = keys.ArrowLeft || keys.ArrowRight || !isGrounded;
        if (moving && ghostFrame % 3 === 0) spawnAfterImage();
    }

    // 5. Camera & Infinite Parallax Layer Tracking
    applyCamera();

    requestAnimationFrame(update);
}

function loadLevel(index) {
    levelIndex = index;
    level = LEVELS[levelIndex];
    applyLevelGeometry();

    const spawnY = level.spawnY || 0;
    catX = level.spawnX; catY = spawnY; velocityY = 0; isGrounded = true; groundedOn = null;
    wasInAirBefore = false;
    // A fresh run starts without the checkpoint
    respawnX = level.spawnX;
    respawnY = spawnY;
    snacks = 1; // Restores the one snack Bumbot always starts a run with
    gameActive = true;
    lastFrameTime = 0; // However long the win screen was up, it is not a game frame

    energyDisplay.innerText = "Snacks: " + snacks;
    winScreen.style.display = 'none';
    // Any route into a level leaves the title card behind, whether it came through Start or not
    startScreen.style.display = 'none';
    menuActive = false;

    // Clear everything the victory sequence and idle settling left on him
    cat.classList.remove('munching', 'cat-run', 'cat-air');
    catContainer.classList.remove('cat-idle', 'cat-launch', 'cat-land', 'cat-emerge', 'cat-enter');
    catContainer.style.setProperty('--face', -1);
    idleFrames = 0;
    goalFeeder.classList.remove('eaten'); // Refill the bowl for the next run

    // A fresh run is a fresh run: the catnip wears off rather than carrying over
    disableCatnip();

    generateLevel();
    // The loop has not started yet, so the opening frame is drawn by hand — without this a
    // vertical level shows one frame scrolled to wherever the camera last was.
    catContainer.style.left = catX + 'px';
    catContainer.style.bottom = (40 + catY) + 'px';
    applyCamera();
    playPipeEmerge(); // Every level opens with him climbing out of something
    requestAnimationFrame(update);
}

// --- The title card. The page opens here, and Main Menu on the win screen comes back here.
// It is not a flat colour over nothing: the level is built and one frame is hand-drawn behind the
// overlay, so the menu shows the actual rooftops with Bumbot standing at his pipe. The game loop
// stays stopped the whole time it is up.
function showStartMenu() {
    menuActive = true;
    gameActive = false;
    winScreen.style.display = 'none';
    startScreen.style.display = 'flex';

    // A menu is not a run, so the catnip wears off here for the same reason it does in loadLevel
    disableCatnip();

    // Level 1's opening is the backdrop, whichever level was last played
    levelIndex = 0;
    level = LEVELS[levelIndex];
    applyLevelGeometry();

    const spawnY = level.spawnY || 0;
    catX = level.spawnX; catY = spawnY; velocityY = 0; isGrounded = true; groundedOn = null;
    wasInAirBefore = false;
    respawnX = level.spawnX;
    respawnY = spawnY;
    snacks = 1;
    idleFrames = 0;

    // Everything a win or a death may have left on him, cleared before he is drawn standing still
    cat.classList.remove('munching', 'cat-run', 'cat-air', 'cat-spooked');
    catContainer.classList.remove('cat-idle', 'cat-launch', 'cat-land', 'cat-emerge',
                                  'cat-bail', 'cat-plunge', 'cat-enter');
    catContainer.style.setProperty('--face', -1);
    goalFeeder.classList.remove('eaten');

    generateLevel();

    // update() is not running and will not run until Start, so this one frame is drawn by hand —
    // the same reason startVictoryMunch and the respawn both hand-draw their positions.
    catContainer.style.left = catX + 'px';
    catContainer.style.bottom = (40 + catY) + 'px';
    applyCamera();

    // The cat on the card itself. Built once: it is a frozen snapshot and never needs refreshing.
    if (!menuCat.firstElementChild) menuCat.appendChild(cloneCatSprite());
}

// Wired to the Start button and to Enter/Space on the title card
function handleStartButton() {
    startScreen.style.display = 'none';
    menuActive = false;
    // Whichever way Start was pressed, it is a user gesture — which is what lets the
    // AudioContext actually make a sound, so the level's opening tones are the first
    // ones that reliably play.
    loadLevel(0);
}

// Wired to the win screen button: move on if another level exists, otherwise replay
function handleWinButton() {
    loadLevel(levelIndex + 1 < LEVELS.length ? levelIndex + 1 : levelIndex);
}

function resetGame() {
    loadLevel(levelIndex);
}

// --- Level select, for testing. Deliberately NOT part of catnip: catnip has exactly one verb now,
// and this is not a power Bumbot has, it is a way to skip to the level you want to look at.
//
//     index.html?level=2      boots straight into level 2, no title card
//     index.html?level=2#fast turns the catnip rush on with it, so you can dive to the bottom
//
// Out-of-range values are ignored rather than clamped, so a typo shows you the menu instead of
// silently starting somewhere you did not ask for. Nothing is persisted, so closing the query
// string is all it takes to get the normal game back.
function requestedStartLevel() {
    const asked = new URLSearchParams(window.location.search).get('level');
    if (asked === null) return -1;
    const n = parseInt(asked, 10) - 1; // 1-based in the URL, because level 1 is level 1
    return (Number.isInteger(n) && n >= 0 && n < LEVELS.length) ? n : -1;
}

const jumpTo = requestedStartLevel();
if (jumpTo >= 0) {
    menuActive = false;
    startScreen.style.display = 'none';
    loadLevel(jumpTo);
    // loadLevel calls disableCatnip, so the rush has to be re-armed after it, not before
    if (window.location.hash === '#fast') {
        catnipMode = true;
        cat.classList.add('catnip');
        devPanel.classList.add('visible');
    }
} else {
    showStartMenu();
}
