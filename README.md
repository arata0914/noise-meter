# Noise Meter Pro

A professional-grade, web-based Noise Meter application featuring real-time audio analysis, visualizers, and recording capabilities.

![App Screenshot](https://via.placeholder.com/800x450?text=Noise+Meter+Pro+Screenshot) 
*(Note: Replace with actual screenshot URL after uploading)*

## Features

- **Real-time Decibel Meter**: Accurate dB(A) monitoring with digital and analog displays.
- **Professional Analog Gauge**: Custom-drawn canvas gauge with color-coded zones and precise needle movement.
- **Visualizers**:
  - **Real-time Waveform**: Oscilloscope-style visualization of the audio input.
  - **History Graph**: Rolling 60-second history of noise levels.
- **Audio Recording**:
  - Record audio directly from the browser.
  - **Smart Save**: Uses the File System Access API to allow saving to a specific folder with a custom filename.
  - **Auto-Extension**: Automatically detects supported audio formats (webm, mp4, ogg).
- **Interval Statistics**: Displays the average noise level over a user-adjustable interval (0.1s - 5.0s).
- **Internationalization (i18n)**: Fully supported English and Japanese interfaces.
- **Theme Support**: Toggle between Dark Mode (default) and Light Mode.
- **Responsive Design**: Fully optimized for desktop and mobile devices (including iPhone X layout).

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Build Tool**: Vite
- **APIs**: 
  - Web Audio API (AudioContext, AnalyserNode)
  - Canvas API (Visualizations)
  - MediaStream Recording API (Audio Recording)
  - File System Access API (Saving files)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/noise-meter-pro.git
   cd noise-meter-pro
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## Usage

1. **Start Monitoring**: Click the "Start" button to enable microphone access and begin monitoring.
2. **Record Audio**: Click "Record" to start capturing audio. Click "Stop Rec" to finish and save the file.
3. **Adjust Settings**: Use the slider to change the update interval for the digital display and statistics.
4. **Switch Theme/Language**: Use the toggle buttons in the header to customize your experience.

## License

This project is licensed under the MIT License.
