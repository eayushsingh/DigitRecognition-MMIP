# Voice Digit Recognition S/M &bull; Audio-MNIST MFCC + K-Means Engine

A real-time Web Application for **Spoken Digit & Number Recognition (0–9)** featuring dual recognition engines (**Web Speech API** and **Audio-MNIST MFCC Feature Extraction + K-Means Clustering**), real-time audio waveform & spectrogram visualizers, dual display modes (Single Digit S vs Multiple Digits M), audio synthesis feedback, and historical logging.

![Voice Digit Recognition UI](https://raw.githubusercontent.com/eayushsingh/DigitRecognition-MMIP/main/docs/screenshot.png)

---

## 🌟 Key Features

### 1. Dual Recognition Engines
- **Web Speech API Engine**: Native browser speech recognition providing speech-to-text transcript parsing.
- **Audio-MNIST MFCC + K-Means ML Engine**: Client-side audio processing pipeline that computes **13 Mel-Frequency Cepstral Coefficients (MFCC)** per frame (26 Mel filterbanks + DCT-II) and classifies spoken digits against trained Audio-MNIST $K_0 \dots K_9$ cluster centroids.

### 2. Dual Display Modes (S / M)
- **Single Digit Mode (S)**: Ultra-large glowing LED display tuned for recognizing individual spoken digits (`0`–`9`) with phonetic spellings (`"Seven (Digit 7)"`).
- **Multiple Digits Mode (M)**: Continuous recognition for digit sequences, codes, and multi-digit numbers (`9`, `2`, `5`, `6`, `8`, `7` $\rightarrow$ formatted value `925,687`).

### 3. Live Canvas Visualizers
- **Oscilloscope Waveform**: Real-time microphone frequency & time-domain oscilloscope wave.
- **13-Coefficient MFCC Spectrogram**: Live heatmap canvas displaying 13 MFCC energy coefficients across time frames.
- **K-Means Centroid Distances Chart**: Real-time bar chart showing Euclidean feature distances to digit clusters 0–9.

### 4. Interactive Voice Simulator & Audio Feedback
- **Voice Test Simulator**: Built-in sample chips (`"Seven"`, `"Three"`, `"Nine Five Two Zero"`, `"Double Zero Seven"`, `"Forty Two"`) to test recognition without a microphone.
- **Audio Feedback**: Musical chime synthesis on digit detection and Text-to-Speech (`window.speechSynthesis`) read-aloud support.

---

## 🏗️ Architecture Overview

```
[ Microphone Input / Audio Buffer ]
              │
              ├───► Web Speech API ────────► Word-to-Digit Parser ───┐
              │                                                     │
              └───► 13-Coefficient MFCC Extractor                   ├───► Hero Digit Display (S/M)
                          │                                         │     & Live Visualizers
                          ▼                                         │
                    K-Means Classifier (Audio-MNIST Centroids 0-9) ─┘
```

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/eayushsingh/DigitRecognition-MMIP.git
   cd DigitRecognition-MMIP
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173/`.

4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🔬 Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES Modules), CSS3 (Glassmorphism & Cyberpunk Neon aesthetics)
- **Bundler**: Vite 5
- **Audio ML**: Web Audio API (`AudioContext`, `AnalyserNode`, `ScriptProcessorNode`), Mel Filterbank Matrix, Discrete Cosine Transform (DCT-II), K-Means Centroid Nearest-Neighbor Classifier
- **Fonts**: Outfit, Fira Code (Google Fonts)

---

## 📜 License

MIT License &copy; 2026 Ayush Singh. Free for academic, educational, and commercial use.
