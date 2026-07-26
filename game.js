const world = document.getElementById('world');
const catContainer = document.getElementById('catContainer');
const cat = document.getElementById('cat');
const meowBubble = document.getElementById('meowBubble');
const energyDisplay = document.getElementById('energyDisplay');
const winScreen = document.getElementById('winScreen');
const farBuildings = document.getElementById('farBuildings');
const nearBuildings = document.getElementById('nearBuildings');

const worldWidth = 8000;
const windowWidth = 700;

const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, Space: false };

let catX = 50;
let catY = 0;
let velocityY = 0;
let isGrounded = true;
let score = 0;
let gameActive = true;
let faceDirection = 1; 

const moveSpeed = 5;
const gravity = 0.6;
const jumpForce = 13;

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

const pigeonSpawns = [
    { x: 1200, left: 1000, right: 1400, y: 150 },
    { x: 2300, left: 2100, right: 2500, y: 180 },
    { x: 3200, left: 2900, right: 3500, y: 160 },
    { x: 5000, left: 4700, right: 5300, y: 200 },
    { x: 6800, left: 6500, right: 7100, y: 220 }
];

function generateLevel() {
    document.querySelectorAll('.obstacle, .spike, .platform, .battery, .pigeon').forEach(el => el.remove());
    RuntimeEntities = [];
    PigeonEntities = [];

    levelObjects.forEach((obj, index) => {
        const element = document.createElement('div');
        element.id = "ent-" + index;
        
        if (obj.type === 'pillar') {
            element.classList.add('obstacle');
            element.style.left = obj.x + 'px';
            element.style.height = obj.height + 'px';
        } else if (obj.type === 'spike') {
            element.classList.add('spike');
            element.style.left = obj.x + 'px';
        } else if (obj.type === 'platform') {
            element.classList.add('platform');
            element.style.left = obj.x + 'px';
            element.style.width = obj.width + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        } else if (obj.type === 'battery') {
            element.classList.add('battery');
            element.innerText = '🔋';
            element.style.left = obj.x + 'px';
            element.style.bottom = (40 + obj.height) + 'px';
        }
        
        world.appendChild(element);
        RuntimeEntities.push({ ...obj, dom: element, active: true });
    });

    pigeonSpawns.forEach((pig) => {
        const element = document.createElement('div');
        element.classList.add('pigeon');
        element.innerText = '🐦';
        element.style.left = pig.x + 'px';
        element.style.bottom = pig.y + 'px';
        world.appendChild(element);

        PigeonEntities.push({
            dom: element, x: pig.x, y: pig.y,
            leftBound: pig.left, rightBound: pig.right,
            speed: 2, dir: 1
        });
    });
}
function triggerSonicMeow() {
    playAudioTone(300, 'sawtooth', 0.15);
    playAudioTone(600, 'triangle', 0.2);
    meowBubble.style.display = 'block';
    setTimeout(() => { meowBubble.style.display = 'none'; }, 600);

    RuntimeEntities.forEach(ent => {
        if (ent.type !== 'pillar' || !ent.active) return;
        let distance = ent.x - catX;
        let withinRange = false;
        if (faceDirection === 1 && distance > 0 && distance < 120) withinRange = true;
        if (faceDirection === -1 && distance < 0 && distance > -120) withinRange = true;
        if (withinRange) {
            ent.active = false;
            ent.dom.style.transform = "scale(0)";
            ent.dom.style.transition = "transform 0.2s ease-out";
            setTimeout(() => ent.dom.remove(), 200);
            playAudioTone(150, 'square', 0.3); 
        }
    });
}

function checkSolidCollision(targetX, targetY) {
    const catWidth = 35; 
    const catHeight = 45;
    for (let obj of RuntimeEntities) {
        if (!obj.active || obj.type === 'spike' || obj.type === 'battery') continue;
        let objMinX = obj.x;
        let objMaxX = obj.x + obj.width;
        let objMinY = 0;
        let objMaxY = obj.height;
        if (obj.type === 'platform') {
            objMinY = obj.height;
            objMaxY = obj.height + 15;
        }
        if (targetX < objMaxX && targetX + catWidth > objMinX && targetY < objMaxY && targetY + catHeight > objMinY) {
            return obj;
        }
    }
    return null;
}

function handleOverlapSystems() {
    const catWidth = 35;
    const catHeight = 45;

    if (catX >= 7780) {
        gameActive = false;
        winScreen.style.display = 'flex';
        playAudioTone(523.25, 'sine', 0.1);
        setTimeout(() => playAudioTone(659.25, 'sine', 0.15), 100);
        setTimeout(() => playAudioTone(783.99, 'sine', 0.3), 200);
        return;
    }

    PigeonEntities.forEach(pig => {
        if (catX < pig.x + 25 && catX + catWidth > pig.x && catY < pig.y - 15 && catY + catHeight > pig.y - 40) {
            triggerShortCircuitReset();
        }
    });

    RuntimeEntities.forEach(obj => {
        if (!obj.active) return;
        if (obj.type === 'spike') {
            if (catX < obj.x + obj.width && catX + catWidth > obj.x && catY < obj.height && catY + catHeight > 0) {
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
    });
}

function triggerShortCircuitReset() {
    playAudioTone(100, 'sawtooth', 0.25); 
    catX = 50; catY = 0; velocityY = 0; isGrounded = true;
}

function update() {
    if (!gameActive) return;

    if (keys.ArrowRight) {
        faceDirection = 1;
        cat.style.transform = 'scaleX(-1)'; 
        if (!checkSolidCollision(catX + moveSpeed, catY)) catX += moveSpeed;
        if (catX > worldWidth - 50) catX = worldWidth - 50;
    }
    if (keys.ArrowLeft) {
        faceDirection = -1;
        cat.style.transform = 'scaleX(1)'; 
        if (!checkSolidCollision(catX - moveSpeed, catY)) catX -= moveSpeed;
        if (catX < 0) catX = 0;
    }

    if ((keys.ArrowUp || keys.Space) && isGrounded) {
        velocityY = jumpForce;
        isGrounded = false;
    }

    if (!isGrounded) {
        velocityY -= gravity;
        let nextY = catY + velocityY;
        let hitObj = checkSolidCollision(catX, nextY);
        if (hitObj) {
            if (velocityY < 0) {
                nextY = (hitObj.type === 'platform') ? hitObj.height + 15 : hitObj.height;
                isGrounded = true;
                velocityY = 0;
            } else {
                velocityY = 0; nextY = catY;
            }
        }
        catY = nextY;
        if (catY <= 0) { catY = 0; velocityY = 0; isGrounded = true; }
    } else {
        if (catY > 0 && !checkSolidCollision(catX, catY - 1)) { isGrounded = false; velocityY = 0; }
    }

    PigeonEntities.forEach(pig => {
        pig.x += (pig.speed * pig.dir);
        pig.dom.style.left = pig.x + 'px';
        pig.dom.style.transform = pig.dir === 1 ? 'scaleX(-1)' : 'scaleX(1)';
        if (pig.x >= pig.rightBound) pig.dir = -1;
        if (pig.x <= pig.leftBound) pig.dir = 1;
    });

    handleOverlapSystems();

    catContainer.style.left = catX + 'px';
    catContainer.style.bottom = (40 + catY) + 'px';

    let cameraX = catX - (windowWidth / 2) + 25;
    if (cameraX < 0) cameraX = 0;
    if (cameraX > worldWidth - windowWidth) cameraX = worldWidth - windowWidth;
    world.style.left = (-cameraX) + 'px';

    farBuildings.style.left = (-(cameraX * 0.15)) + 'px'; 
    nearBuildings.style.left = (-(cameraX * 0.40)) + 'px'; 

    requestAnimationFrame(update);
}

function resetGame() {
    catX = 50; catY = 0; velocityY = 0; isGrounded = true; score = 0; gameActive = true;
    energyDisplay.innerText = "Batteries: 0";
    winScreen.style.display = 'none';
    generateLevel();
    requestAnimationFrame(update);
}

generateLevel();
requestAnimationFrame(update);
