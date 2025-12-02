export class AudioManager {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.isInitialized = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStartTime = 0;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();

      // FFT Size determines frequency resolution. 2048 is standard for good detail.
      this.analyser.fftSize = 2048;
      this.microphone.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      this.isInitialized = true;

      // Setup Recorder
      this.setupRecorder(stream);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  setupRecorder(stream) {
    // Check supported types
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    const mimeType = types.find(type => MediaRecorder.isTypeSupported(type)) || '';

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
  }

  startRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'recording') return;
    this.recordedChunks = [];
    this.mediaRecorder.start();
    this.recordingStartTime = Date.now();
  }

  async stopRecording(filenameSuffix = '') {
    // 1. Prepare filename and extension info *before* stopping (needed for file picker)
    let mimeType = this.mediaRecorder ? this.mediaRecorder.mimeType : '';
    if (!mimeType || mimeType === '') {
      mimeType = 'audio/webm';
    }

    let ext = 'webm';
    if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('webm')) ext = 'webm';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `recording_${timestamp}_${filenameSuffix}.${ext}`;

    // 2. Try to get File Handle *immediately* to preserve user gesture
    let fileHandle = null;
    if (window.showSaveFilePicker) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Audio File',
            accept: { [mimeType]: [`.${ext}`] },
          }],
        });
      } catch (err) {
        console.log('User cancelled save dialog or API failed:', err);
        // If user cancelled, we might still want to stop recording but maybe not save?
        // Or fallback? Usually if user cancels "Save As", they mean "Don't Save" or "Cancel Action".
        // But here "Stop" button was clicked. We must stop recording.
        // If they cancelled the picker, we probably shouldn't download automatically as fallback, 
        // but for safety let's just stop.
        // However, the user might have clicked "Cancel" by mistake. 
        // Let's assume if they cancel the picker, they don't want to save to a specific file, 
        // but we should still stop the recorder.
        // For now, let's proceed to stop. If fileHandle is null, we can decide to fallback or not.
        // Let's fallback to automatic download so data isn't lost.
      }
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { type: mimeType });

        if (fileHandle) {
          try {
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            resolve(filename);
          } catch (writeErr) {
            console.error('Write failed:', writeErr);
            // Fallback if write fails
            this.downloadBlob(blob, filename);
            resolve(filename);
          }
        } else {
          // Fallback: Automatic download
          this.downloadBlob(blob, filename);
          resolve(filename);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }

  getVolume() {
    if (!this.isInitialized) return 0;

    // Get time domain data for waveform and RMS
    this.analyser.getByteTimeDomainData(this.dataArray);

    let sum = 0;
    // Calculate RMS (Root Mean Square)
    // dataArray values are 0-255, 128 is silence.
    // We normalize to -1 to 1 range.
    for (let i = 0; i < this.dataArray.length; i++) {
      const x = (this.dataArray[i] - 128) / 128;
      sum += x * x;
    }

    const rms = Math.sqrt(sum / this.dataArray.length);

    // Convert to dB
    // Reference: 20*log10(rms). 
    // However, raw RMS from microphone needs calibration to match real SPL.
    // We'll add an offset (gain) to approximate typical mic sensitivity.
    // A typical quiet room is ~30-40dB.
    // Silence (rms near 0) -> -Infinity.

    const db = 20 * Math.log10(rms) + 100; // +100 is an arbitrary calibration offset for web audio

    // Clamp values to realistic range (0 - 140)
    return Math.max(0, Math.min(140, db));
  }

  getWaveformData() {
    if (!this.isInitialized) return new Uint8Array(0);
    this.analyser.getByteTimeDomainData(this.dataArray);
    return this.dataArray;
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  suspend() {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }
}
