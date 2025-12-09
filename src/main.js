import './style.css'
import { AudioManager } from './audioManager.js'
import { UIController } from './uiController.js'

const audioManager = new AudioManager();
const uiController = new UIController();

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const recordBtn = document.getElementById('record-btn');
const recordingTimer = document.getElementById('recording-timer');

let animationId = null;
let isRecording = false;
let recordingInterval = null;

// Language Toggle
const langToggle = document.getElementById('lang-toggle');
langToggle.addEventListener('click', () => {
  const newLang = uiController.currentLang === 'ja' ? 'en' : 'ja';
  uiController.setLanguage(newLang);
});

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
  uiController.toggleTheme();
});

// Event Listeners
startBtn.addEventListener('click', async () => {
  try {
    await audioManager.initialize();
    audioManager.resume();
    startLoop();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    uiController.setStatus('status_listening');
  } catch (error) {
    alert('Microphone access denied or error occurred.');
    console.error(error);
  }
});

stopBtn.addEventListener('click', () => {
  audioManager.suspend();
  stopLoop();

  if (isRecording) {
    stopRecording();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
  uiController.setStatus('status_paused');
});

// recordBtn.addEventListener('click', () => {
//   if (!audioManager.isInitialized) {
//     alert('Please start the meter first.');
//     return;
//   }

//   if (!isRecording) {
//     startRecording();
//   } else {
//     stopRecording();
//   }
// });

function startRecording() {
  isRecording = true;
  audioManager.startRecording();

  recordBtn.classList.add('recording');
  // Text update handled by setStatus via translations

  recordingTimer.classList.remove('hidden');
  uiController.setStatus('status_recording');

  const startTime = Date.now();
  recordingInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const s = Math.floor(elapsed / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    recordingTimer.textContent = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }, 1000);
}

async function stopRecording() {
  isRecording = false;
  clearInterval(recordingInterval);
  recordingTimer.classList.add('hidden');
  recordingTimer.textContent = '00:00';

  recordBtn.classList.remove('recording');
  // Text update handled by setStatus via translations

  // Get max dB during session for filename? 
  // For now just use current dB or generic.
  // The user asked for "title to include db info".
  // Let's use the current average or max of the session if we tracked it.
  // Since we didn't track session-specific max in audioManager explicitly for the filename,
  // we can just pass the current Max value from UIController or similar.

  const maxDb = uiController.maxDb.toFixed(1);
  const filenameSuffix = `max_${maxDb}dB`;

  uiController.setStatus('status_saving');
  await audioManager.stopRecording(filenameSuffix);

  if (audioManager.audioContext.state === 'running') {
    uiController.setStatus('status_listening');
  } else {
    uiController.setStatus('status_paused');
  }
}

const intervalSlider = document.getElementById('interval-slider');
const intervalValue = document.getElementById('interval-value');

intervalSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  intervalValue.textContent = `${val}s`;
  uiController.setUpdateInterval(parseFloat(val));
});

function startLoop() {
  if (animationId) return;

  let lastGraphUpdate = 0;

  function loop(timestamp) {
    const db = audioManager.getVolume();
    const waveform = audioManager.getWaveformData();

    uiController.updateDisplay(db, timestamp);
    uiController.drawWaveform(waveform);

    // Update history graph every 100ms (10fps)
    if (timestamp - lastGraphUpdate > 100) {
      uiController.updateHistoryGraph(db);
      lastGraphUpdate = timestamp;
    }

    animationId = requestAnimationFrame(loop);
  }

  animationId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}
