// ─────────────────────────────────────────────────────────────
//  SIMON GAME — script.js
//  Concepts covered: arrays, async/await, Promises, DOM events,
//  Web Audio API, game state management
// ─────────────────────────────────────────────────────────────


// ─── 1. GAME STATE ───────────────────────────────────────────
// These variables track everything about the current game.

let sequence    = [];      // The growing list of colours Simon picks
let playerIndex = 0;       // How far the player is through the sequence
let isSimonsTurn = true;   // Locks player input while Simon is flashing
let isPlaying   = false;   // Is a game currently running?
let bestScore   = 0;       // Highest round reached this session
let animSpeed   = 600;     // Flash duration in milliseconds


// ─── 2. DOM REFERENCES ───────────────────────────────────────
// Grab all the elements we'll need to read or update.

const buttons = {
  green:  document.getElementById('btn-green'),
  red:    document.getElementById('btn-red'),
  yellow: document.getElementById('btn-yellow'),
  blue:   document.getElementById('btn-blue'),
};

const statusEl   = document.getElementById('status');
const roundEl    = document.getElementById('round');
const bestEl     = document.getElementById('best');
const startBtn   = document.getElementById('start-btn');
const startLabel = document.getElementById('start-label');
const speedSelect = document.getElementById('speed-select');
const streakEl   = document.getElementById('streak');


// ─── 3. SOUND (Web Audio API) ─────────────────────────────────
// We generate tones in real time — no audio files needed!
// Each colour has a distinct musical frequency (Hz).

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContext ? new AudioContext() : null;

const tones = {
  green:  392,   // G4
  red:    330,   // E4
  yellow: 262,   // C4
  blue:   220,   // A3
};

function playTone(color, duration = 300) {
  if (!audioCtx) return;

  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.frequency.value = tones[color];
  osc.type = 'sine';

  // Start loud and fade out smoothly
  gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioCtx.currentTime + duration / 1000
  );

  osc.start();
  osc.stop(audioCtx.currentTime + duration / 1000);
}

function playErrorSound() {
  if (!audioCtx) return;

  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.frequency.value = 100;  // Low, buzzy tone
  osc.type = 'sawtooth';

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.6);
}


// ─── 4. FLASH A BUTTON ────────────────────────────────────────
// Lights up a button (adds .active CSS class) and plays its tone.
// Returns a Promise so we can await it in playSequence().

function flashButton(color, duration) {
  return new Promise(resolve => {
    const btn = buttons[color];

    playTone(color, duration * 0.8);
    btn.classList.add('active');

    setTimeout(() => {
      btn.classList.remove('active');
      resolve();             // Signal: "flash is done, you can continue"
    }, duration);
  });
}


// ─── 5. SIMON PLAYS THE SEQUENCE ──────────────────────────────
// Loops through the full sequence and flashes each colour in order.
// Uses async/await so each flash finishes before the next starts.

async function playSequence() {
  isSimonsTurn = true;
  setStatus('Watch carefully…');

  const gap = animSpeed * 0.4;  // Pause between flashes

  for (let i = 0; i < sequence.length; i++) {
    await sleep(gap);                          // Wait before each flash
    await flashButton(sequence[i], animSpeed * 0.6);  // Flash and wait for it to finish
  }

  await sleep(300);
  isSimonsTurn = false;   // Now it's the player's turn
  playerIndex = 0;
  setStatus('Your turn!');
}


// ─── 6. ADD A RANDOM COLOUR TO THE SEQUENCE ───────────────────
function addToSequence() {
  const colors = ['green', 'red', 'yellow', 'blue'];
  const pick = colors[Math.floor(Math.random() * colors.length)];
  sequence.push(pick);
}


// ─── 7. START THE NEXT ROUND ──────────────────────────────────
async function nextRound() {
  addToSequence();
  roundEl.textContent = sequence.length;
  await playSequence();
}


// ─── 8. START A NEW GAME ──────────────────────────────────────
async function startGame() {
  // Browsers require a user gesture before playing audio.
  // Resuming the AudioContext here satisfies that requirement.
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  sequence     = [];
  playerIndex  = 0;
  isPlaying    = true;
  startLabel.textContent = 'STOP';
  roundEl.textContent    = '0';

  setStatus('Get ready…');
  await sleep(800);
  await nextRound();
}


// ─── 9. HANDLE PLAYER INPUT ───────────────────────────────────
// Called whenever the player clicks a coloured button.

async function handlePlayerInput(color) {
  // Ignore clicks when it's Simon's turn or no game is running
  if (!isPlaying || isSimonsTurn) return;

  flashButton(color, 200);   // Visual + audio feedback for the click

  // Check: did the player press the correct colour?
  if (color === sequence[playerIndex]) {
    playerIndex++;

    // Did the player successfully complete the whole sequence?
    if (playerIndex === sequence.length) {
      setStatus('Correct! ✓', 'success');

      // Update best score if needed
      if (sequence.length > bestScore) {
        bestScore = sequence.length;
        bestEl.textContent = bestScore;
      }

      isSimonsTurn = true;
      await sleep(900);
      await nextRound();    // Add one more colour and go again
    }
    // If playerIndex < sequence.length, just wait for the next click

  } else {
    // Wrong colour — game over!
    gameOver();
  }
}


// ─── 10. GAME OVER ────────────────────────────────────────────
async function gameOver() {
  isPlaying    = false;
  isSimonsTurn = true;

  playErrorSound();

  // Flash ALL buttons red as a visual "wrong!" signal
  Object.keys(buttons).forEach(c => buttons[c].classList.add('active'));
  await sleep(600);
  Object.keys(buttons).forEach(c => buttons[c].classList.remove('active'));

  const reached = sequence.length;
  setStatus(`Game over! You reached round ${reached}`, 'error');

  if (reached > bestScore) {
    bestScore = reached;
    bestEl.textContent = bestScore;
    streakEl.textContent = '🏆 New best!';
    setTimeout(() => { streakEl.textContent = ''; }, 2500);
  }

  startLabel.textContent = 'START';
  roundEl.textContent    = '0';
}


// ─── 11. EVENT LISTENERS ──────────────────────────────────────

// Start / Stop button (center circle)
startBtn.addEventListener('click', () => {
  if (isPlaying) {
    // Stop the current game
    isPlaying    = false;
    isSimonsTurn = true;
    sequence     = [];
    startLabel.textContent = 'START';
    roundEl.textContent    = '0';
    setStatus('Press Start to play');
  } else {
    startGame();
  }
});

// Colour buttons — attach a click handler to each one
Object.keys(buttons).forEach(color => {
  buttons[color].addEventListener('click', () => handlePlayerInput(color));
});

// Speed selector
speedSelect.addEventListener('change', () => {
  animSpeed = parseInt(speedSelect.value);
});


// ─── 12. HELPERS ──────────────────────────────────────────────

// Pauses execution for `ms` milliseconds.
// Used with: await sleep(500)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Updates the status message and applies an optional CSS class
// for colour coding (e.g. 'error' = red, 'success' = green).
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className   = 'status-msg ' + type;
}