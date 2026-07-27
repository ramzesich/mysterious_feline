const world = document.getElementById('world');
const catContainer = document.getElementById('catContainer');
const cat = document.getElementById('cat');
const meowBubble = document.getElementById('meowBubble');
const energyDisplay = document.getElementById('energyDisplay');
const winScreen = document.getElementById('winScreen');
const winButton = document.getElementById('winButton');
const finalScore = document.getElementById('finalScore');
const portal = document.getElementById('portal');
const extractionPad = document.getElementById('extractionPad');
const farBuildings = document.getElementById('farBuildings');
const nearBuildings = document.getElementById('nearBuildings');

const windowWidth = 700;

// Everything at the end of a zone is measured back from its right edge, so a zone's
// length is now a single number in map.js instead of four hardcoded positions.
const portalInset = 200;
const padInset = 230;
const winInset = 220;

let zoneIndex = 0;
let zone = ZONES[zoneIndex];
let worldWidth = zone.worldWidth;
let winX = worldWidth - winInset;

const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, Space: false };

let catX = zone.spawnX;
let catY = 0;
let velocityY = 0;
let isGrounded = true;
let groundedOn = null; // The entity Bumbot is standing on, so movers can carry him
let respawnX = zone.spawnX; // Moved forward by the cat feeder checkpoint
let score = 1; // Acts as our battery fuel ammo clip counter
let gameActive = true;
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

window.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.code === 'Space') {
        e.preventDefault();
        const keyName = e.code === 'Space' ? 'Space' : e.key;
        keys[keyName] = true;
    }
    if (e.code === 'KeyM') triggerSonicMeow();
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.code === 'Space') {
        const keyName = e.code === 'Space' ? 'Space' : e.key;
        keys[keyName] = false;
    }
});

let RuntimeEntities = [];
let PigeonEntities = [];

// Only these types take part in solid collision. Spikes, batteries and the feeder are
// overlap-only, so they are handled in handleOverlapSystems instead.
function isSolidType(type) {
    return type === 'pillar' || type === 'platform' || type === 'mover';
}

// Platforms and movers are thin slabs you land on top of; pillars are full-height blocks.
function isSlabType(type) {
    return type === 'platform' || type === 'mover';
}

// A pit is only fatal once Bumbot's centre is past its edge, which keeps the edges
// forgiving rather than making a 1px overhang deadly.
function isOverSolidGround(x) {
    const center = x + 17;
    return !zone.pits.some(pit => center > pit.x && center < pit.x + pit.width);
}

function applyZoneGeometry() {
    worldWidth = zone.worldWidth;
    winX = worldWidth - winInset;
    world.style.width = worldWidth + 'px';
    portal.style.left = (worldWidth - portalInset) + 'px';
    extractionPad.style.left = (worldWidth - padInset) + 'px';
}

function buildGround() {
    // The ground is no longer one wide div: it is the stretches between the zone's pits.
    const ordered = [...zone.pits].sort((a, b) => a.x - b.x);
    let cursor = 0;

    ordered.forEach(pit => {
        addGroundSegment(cursor, pit.x - cursor);

        const void_ = document.createElement('div');
        void_.classList.add('pit');
        void_.style.left = pit.x + 'px';
        void_.style.width = pit.width + 'px';
        world.appendChild(void_);

        cursor = pit.x + pit.width;
    });

    addGroundSegment(cursor, worldWidth - cursor);
}

function addGroundSegment(left, width) {
    if (width <= 0) return;
    const segment = document.createElement('div');
    segment.classList.add('ground-segment');
    segment.style.left = left + 'px';
    segment.style.width = width + 'px';
    world.appendChild(segment);
}

function generateLevel() {
    document.querySelectorAll('.obstacle, .spike, .platform, .battery, .pigeon, .mover, .feeder, .ground-segment, .pit').forEach(el => el.remove());
    RuntimeEntities = [];
    PigeonEntities = [];

    // Sync our top dashboard display panel instantly on load
    energyDisplay.innerText = "Batteries: " + score;
    meowBubble.innerText = "I am Bumbot!!!";

    buildGround();

    zone.objects.forEach((obj, index) => {
        const element = document.createElement('div');
        element.id = "ent-" + index;

        if (obj.type === 'pillar') {
            element.classList.add('obstacle');
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
            element.style.left = obj.x + 'px';
            element.style.width = obj.width + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'mover') {
            element.classList.add('mover');
            element.style.left = obj.x + 'px';
            element.style.width = obj.width + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'battery') {
            element.classList.add('battery');
            element.innerText = '🔋';
            element.style.left = obj.x + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'feeder') {
            element.classList.add('feeder');
            element.innerHTML = '<div class="feeder-led"></div><div class="feeder-kibble"></div>';
            element.style.left = obj.x + 'px';
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

    zone.pigeons.forEach((pig) => {
        const element = document.createElement('div');
        element.classList.add('pigeon');
        element.innerText = '🕊️';
        element.style.left = pig.x + 'px';
        element.style.bottom = pig.y + 'px';
        world.appendChild(element);

        PigeonEntities.push({
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

function triggerSonicMeow() {
    if (score <= 0) {
        playAudioTone(150, 'sine', 0.1);
        return;
    }

    score--;
    energyDisplay.innerText = "Batteries: " + score;

    playAudioTone(200, 'sawtooth', 0.4);
    playAudioTone(400, 'square', 0.4);
    playAudioTone(800, 'triangle', 0.5);

    meowBubble.style.display = 'block';
    setTimeout(() => { meowBubble.style.display = 'none'; }, 1600);

    const ripple = document.createElement('div');
    ripple.classList.add('sonic-ripple');

    // Calculate the absolute center pixel position of Bumbot
    let spawnX = catX + 25;
    let spawnTop = 310 - catY - 21;

    ripple.style.left = spawnX + 'px';
    ripple.style.top = spawnTop + 'px';
    world.appendChild(ripple);

    // Automatically delete the ripple node from the DOM once the animation ends
    setTimeout(() => ripple.remove(), 600);

    // Dynamic viewport boundary limits calculation
    let currentCameraX = catX - (windowWidth / 2) + 25;
    if (currentCameraX < 0) currentCameraX = 0;
    if (currentCameraX > worldWidth - windowWidth) currentCameraX = worldWidth - windowWidth;

    let viewLeftBound = currentCameraX;
    let viewRightBound = currentCameraX + windowWidth;

    // Core screen-clearing logic for pillars and spikes. Pits and movers are immune,
    // which is what keeps the zone's route battery-free by design.
    RuntimeEntities.forEach(ent => {
        if (!ent.active || (ent.type !== 'pillar' && ent.type !== 'spike')) return;

        if (ent.x >= viewLeftBound - 40 && ent.x <= viewRightBound) {
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
    });

    // Also blast away visible pigeons
    PigeonEntities.forEach(pig => {
        if (pig.active && pig.x >= viewLeftBound && pig.x <= viewRightBound) {
            createShatterBurst(pig.x, pig.y, 20);
            pig.active = false; // Stops the patrol clamp from resurrecting it
            pig.dom.style.transition = "transform 0.3s ease-out, opacity 0.3s ease-out";
            pig.dom.style.transform = "translateY(-50px) scale(0)";
            pig.dom.style.opacity = "0";
            setTimeout(() => pig.dom.remove(), 300);
        }
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

    if (catX >= winX) {
        gameActive = false;
        const hasNextZone = zoneIndex + 1 < ZONES.length;
        winButton.innerText = hasNextZone ? 'Enter Next Zone' : 'Replay Zone';
        finalScore.innerText = hasNextZone
            ? "Bumbot cleared " + zone.name + " with " + score + " batteries to spare."
            : "Bumbot safely made it to the station core!";
        winScreen.style.display = 'flex';
        playAudioTone(523.25, 'sine', 0.1);
        setTimeout(() => playAudioTone(659.25, 'sine', 0.15), 100);
        setTimeout(() => playAudioTone(783.99, 'sine', 0.3), 200);
        return;
    }

    PigeonEntities.forEach(pig => {
        if (!pig.active) return;
        // The glyph floats inside a 40px box, so the hitbox is inset to match the bird
        if (catX < pig.x + 34 && catX + catWidth > pig.x + 6 && catY < pig.y + 32 && catY + catHeight > pig.y + 8) {
            triggerShortCircuitReset();
        }
    });

    RuntimeEntities.forEach(obj => {
        if (!obj.active) return;

        if (obj.type === 'spike') {
            const base = obj.y || 0;
            if (catX < obj.x + obj.width && catX + catWidth > obj.x && catY < base + obj.height && catY + catHeight > base) {
                triggerShortCircuitReset();
            }
        }

        if (obj.type === 'battery') {
            if (catX < obj.x + 25 && catX + catWidth > obj.x && catY < obj.height + 25 && catY + catHeight > obj.height) {
                obj.active = false;
                obj.dom.remove();
                score++;
                energyDisplay.innerText = "Batteries: " + score;
                playAudioTone(880, 'sine', 0.08);
            }
        }

        if (obj.type === 'feeder' && !obj.triggered && catX + catWidth > obj.x) {
            obj.triggered = true;
            obj.dom.classList.add('active');
            respawnX = obj.x;

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

function triggerShortCircuitReset() {
    if (!gameActive) return;

    // Step 1: Lock player controls and physics instantly
    gameActive = false;

    // Step 2: Trigger heavy static electrical glitch synthesizer sequence sound profile
    playAudioTone(90, 'sawtooth', 0.4);
    playAudioTone(120, 'square', 0.4);

    // Step 3: Inject CSS glitch classes to flash the interface and shake Bumbot
    const flashElement = document.getElementById('damageFlash');
    flashElement.style.display = 'block';
    cat.classList.add('glitching');

    // Step 4: Hold the frozen failure scene visible for 600 milliseconds before resetting
    setTimeout(() => {
        // Clear layout modifiers cleanly
        flashElement.style.display = 'none';
        cat.classList.remove('glitching');

        // Back to the cat feeder if one has been passed, otherwise the zone's spawn
        catX = respawnX;
        catY = 0;
        velocityY = 0;
        isGrounded = true;
        groundedOn = null;
        wasInAirBefore = false;

        // Re-engage main updating runtime loops loop
        gameActive = true;
        lastFrameTime = 0; // Discard the 600ms pause so it is not treated as one huge frame
        requestAnimationFrame(update);
    }, 600);
}

let activeDust = [];
let wasInAirBefore = false; // Internal tracking state flag for gravity thresholds

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

    // 1. Horizontal Inputs
    if (keys.ArrowRight) {
        faceDirection = 1;
        cat.style.setProperty('--face', -1);
        const step = moveSpeed * dt;
        if (!checkSolidCollision(catX + step, catY)) catX += step;
        if (catX > worldWidth - 50) catX = worldWidth - 50;
    }
    if (keys.ArrowLeft) {
        faceDirection = -1;
        cat.style.setProperty('--face', 1);
        const step = moveSpeed * dt;
        if (!checkSolidCollision(catX - step, catY)) catX -= step;
        if (catX < 0) catX = 0;
    }

    // 2. Vertical Jump Physics Engine
    if ((keys.ArrowUp || keys.Space) && isGrounded) {
        velocityY = jumpForce; // An instant impulse, so this one is not dt-scaled
        isGrounded = false;
        groundedOn = null;
        wasInAirBefore = true; // Flag that Bumbot took off
    }

    if (!isGrounded) {
        velocityY -= gravity * dt;
        let nextY = catY + velocityY * dt;
        let hitObj = checkSolidCollision(catX, nextY);

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
            if (isOverSolidGround(catX)) {
                catY = 0; velocityY = 0; isGrounded = true; groundedOn = null;
            } else if (catY < fallDeathY) {
                triggerShortCircuitReset(); // Fell into a pit
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
        } else if (!isOverSolidGround(catX)) {
            // Walked off the lip of a pit
            isGrounded = false; velocityY = 0; groundedOn = null;
            wasInAirBefore = true;
        }
    }

    // Detects the exact frame Bumbot hits solid surface ground/platform
    if (isGrounded && wasInAirBefore) {
        createLandingDust(catX, catY);
        wasInAirBefore = false; // Reset takeoff state flag
        playAudioTone(250, 'sine', 0.04); // Deep quiet thump landing frequency note bleep
    }

    // 3. Update Avian Drones
    PigeonEntities.forEach(pig => {
        if (!pig.active) return;
        const travel = pig.speed * pig.dir * dt;

        if (pig.axis === 'y') {
            pig.y += travel;
            if (pig.y >= pig.max) { pig.y = pig.max; pig.dir = -1; }
            else if (pig.y <= pig.min) { pig.y = pig.min; pig.dir = 1; }
            pig.dom.style.bottom = pig.y + 'px';
        } else {
            pig.x += travel;
            if (pig.x >= pig.max) { pig.x = pig.max; pig.dir = -1; }
            else if (pig.x <= pig.min) { pig.x = pig.min; pig.dir = 1; }
            pig.dom.style.left = pig.x + 'px';
            pig.dom.style.transform = pig.dir === 1 ? 'scaleX(-1)' : 'scaleX(1)';
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

    // Advance physics in slices of at most one frame. A single big step could carry
    // Bumbot straight through a 15px platform slab without ever overlapping it.
    let remaining = dt;
    while (remaining > 0 && gameActive) {
        const slice = Math.min(remaining, 1);
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

    // 5. Camera & Infinite Parallax Layer Tracking
    let cameraX = catX - (windowWidth / 2) + 25;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > worldWidth - windowWidth) cameraX = worldWidth - windowWidth;
    world.style.left = (-cameraX) + 'px';

    // Instead of sliding elements left, we shift their internal vector textures infinitely
    farBuildings.style.backgroundPositionX = (-(cameraX * 0.15)) + 'px';
    nearBuildings.style.backgroundPositionX = (-(cameraX * 0.40)) + 'px';

    requestAnimationFrame(update);
}

function loadZone(index) {
    zoneIndex = index;
    zone = ZONES[zoneIndex];
    applyZoneGeometry();

    catX = zone.spawnX; catY = 0; velocityY = 0; isGrounded = true; groundedOn = null;
    wasInAirBefore = false;
    respawnX = zone.spawnX; // A fresh run starts without the checkpoint
    score = 1; // Restores your initial emergency blast charge on death/replay resets
    gameActive = true;
    lastFrameTime = 0; // However long the win screen was up, it is not a game frame

    energyDisplay.innerText = "Batteries: " + score;
    winScreen.style.display = 'none';
    generateLevel();
    requestAnimationFrame(update);
}

// Wired to the win screen button: move on if another zone exists, otherwise replay
function handleWinButton() {
    loadZone(zoneIndex + 1 < ZONES.length ? zoneIndex + 1 : zoneIndex);
}

function resetGame() {
    loadZone(zoneIndex);
}

loadZone(0);
