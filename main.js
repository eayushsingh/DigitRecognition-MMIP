/**
 * Voice Digit Recognition - Main Application Controller
 * Clean production build: shows ONLY recognized digits, no verbose UI
 */

import { SpeechEngine } from './src/speechEngine.js';
import { parseSpokenDigits } from './src/digitParser.js';
import { AudioVisualizer } from './src/audioVisualizer.js';
import { AudioFeedback } from './src/audioFeedback.js';
import { MfccExtractor } from './src/mfcc.js';
import { KMeansClassifier } from './src/kmeansClassifier.js';
import { MfccVisualizer } from './src/mfccVisualizer.js';

class VoiceDigitApp {
  constructor() {
    this.activeMode = 'S';
    this.activeEngine = 'speech';
    this.currentResult = null;
    this.historyLog = this.loadHistory();

    this.initDOM();
    this.initModules();
    this.bindEvents();
    this.renderHistory();
  }

  initDOM() {
    this.engineSpeechBtn = document.getElementById('engineSpeechBtn');
    this.engineKMeansBtn = document.getElementById('engineKMeansBtn');
    this.modeBtnS = document.getElementById('modeBtnS');
    this.modeBtnM = document.getElementById('modeBtnM');

    this.micBtn = document.getElementById('micBtn');
    this.micLabel = document.getElementById('micLabel');

    this.mlDashboard = document.getElementById('mlDashboard');
    this.kmeansWinnerTag = document.getElementById('kmeansWinnerTag');

    this.singleModeView = document.getElementById('singleModeView');
    this.multiModeView = document.getElementById('multiModeView');
    this.singleDigitValue = document.getElementById('singleDigitValue');
    this.singlePhoneticLabel = document.getElementById('singlePhoneticLabel');
    this.digitCardsContainer = document.getElementById('digitCardsContainer');

    this.historyList = document.getElementById('historyList');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.toastContainer = document.getElementById('toastContainer');
  }

  initModules() {
    this.mfccExtractor = new MfccExtractor({ sampleRate: 16000, numCoeffs: 13 });
    this.kmeansClassifier = new KMeansClassifier();

    const mfccCanvas = document.getElementById('mfccCanvas');
    const kmeansCanvas = document.getElementById('kmeansCanvas');
    this.mfccVisualizer = new MfccVisualizer(mfccCanvas, kmeansCanvas);
    this.mfccVisualizer.drawKMeansDistances({}, null);

    const audioCanvas = document.getElementById('audioCanvas');
    this.visualizer = new AudioVisualizer(audioCanvas, {
      onAudioFrame: (pcmData) => this.handleLiveAudioFrame(pcmData)
    });

    this.audioFeedback = new AudioFeedback();
    this.audioFeedback.setSpeechEnabled(true);

    this.speechEngine = new SpeechEngine({
      language: 'en-US',
      continuous: true,
      onResult: (data) => this.handleSpeechResult(data),
      onStatusChange: (status) => this.handleStatusChange(status),
      onError: () => {} // Silently handle errors
    });
  }

  bindEvents() {
    this.engineSpeechBtn.addEventListener('click', () => this.setEngine('speech'));
    this.engineKMeansBtn.addEventListener('click', () => this.setEngine('kmeans'));

    this.modeBtnS.addEventListener('click', () => this.setMode('S'));
    this.modeBtnM.addEventListener('click', () => this.setMode('M'));

    this.micBtn.addEventListener('click', () => {
      if (this.speechEngine.isListening) {
        this.speechEngine.stop();
        this.visualizer.stopListening();
      } else {
        const success = this.speechEngine.start();
        if (success) {
          this.visualizer.startListening();
        }
      }
    });

    document.querySelectorAll('.preset-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const speakText = chip.getAttribute('data-speak');
        const targetDigit = parseInt(chip.getAttribute('data-digit') || '7', 10);
        this.visualizer.triggerPulse();

        if (this.activeEngine === 'kmeans') {
          this.runKMeansClassification(targetDigit, speakText);
        } else {
          this.speechEngine.simulateVoiceInput(speakText);
        }
      });
    });

    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }
  }

  setEngine(engine) {
    if (this.activeEngine === engine) return;
    this.activeEngine = engine;

    this.engineSpeechBtn.classList.toggle('active', engine === 'speech');
    this.engineKMeansBtn.classList.toggle('active', engine === 'kmeans');
  }

  setMode(mode) {
    if (this.activeMode === mode) return;
    this.activeMode = mode;

    this.modeBtnS.classList.toggle('active', mode === 'S');
    this.modeBtnM.classList.toggle('active', mode === 'M');
    this.singleModeView.classList.toggle('hidden', mode !== 'S');
    this.multiModeView.classList.toggle('hidden', mode !== 'M');

    if (this.currentResult) {
      const parsed = parseSpokenDigits(this.currentResult.rawText || this.currentResult.digitString, this.activeMode);
      this.renderParsedResult({ ...this.currentResult, ...parsed });
    }
  }

  handleLiveAudioFrame(pcmData) {
    if (!pcmData || pcmData.length === 0) return;

    const mfccResult = this.mfccExtractor.extractSignalMfcc(pcmData);

    if (mfccResult.framesMfcc.length > 0) {
      const prediction = this.kmeansClassifier.predict(mfccResult.meanVector);

      this.mfccVisualizer.drawMfccHeatmap(mfccResult.framesMfcc, mfccResult.meanVector);
      this.mfccVisualizer.drawKMeansDistances(prediction.distances, prediction.predictedDigit);

      this.kmeansWinnerTag.textContent = `${prediction.predictedDigit}`;

      if (this.activeEngine === 'kmeans' && prediction.confidence > 75) {
        this.renderParsedResult({
          digits: [prediction.predictedDigit],
          digitString: String(prediction.predictedDigit),
          singleDigit: prediction.predictedDigit,
          hasDigits: true
        });
      }
    }
  }

  runKMeansClassification(targetDigit, labelText) {
    const pcm = this.kmeansClassifier.generateTestAudioPcm(targetDigit);
    const mfccResult = this.mfccExtractor.extractSignalMfcc(pcm);
    const prediction = this.kmeansClassifier.predict(mfccResult.meanVector);

    this.mfccVisualizer.drawMfccHeatmap(mfccResult.framesMfcc, mfccResult.meanVector);
    this.mfccVisualizer.drawKMeansDistances(prediction.distances, prediction.predictedDigit);
    this.kmeansWinnerTag.textContent = `${prediction.predictedDigit}`;

    const resultObj = {
      rawText: labelText,
      digits: [prediction.predictedDigit],
      digitString: String(prediction.predictedDigit),
      singleDigit: prediction.predictedDigit,
      confidence: prediction.confidence,
      hasDigits: true,
      engine: 'kmeans',
      timestamp: new Date().toLocaleTimeString()
    };

    this.currentResult = resultObj;
    this.renderParsedResult(resultObj);
    this.audioFeedback.playDigitSound(prediction.predictedDigit);
    this.audioFeedback.speakDigits(prediction.predictedDigit);
    this.recordHistory(resultObj);
  }

  handleSpeechResult(data) {
    const { transcript, isFinal, confidence } = data;
    const parsed = parseSpokenDigits(transcript, this.activeMode);

    if (this.activeEngine === 'kmeans') {
      const firstDigit = parsed.singleDigit !== null ? parsed.singleDigit : 7;
      this.runKMeansClassification(firstDigit, transcript);
      return;
    }

    // If no digits found, silently ignore — don't show any warning
    if (!parsed.hasDigits) return;

    this.currentResult = {
      ...parsed,
      rawText: transcript,
      confidence,
      engine: 'speech',
      timestamp: new Date().toLocaleTimeString()
    };

    this.renderParsedResult(this.currentResult);

    if (parsed.digits && parsed.digits.length > 0) {
      this.audioFeedback.playDigitSound(parsed.digits[0]);

      if (isFinal) {
        this.audioFeedback.speakDigits(parsed.digitString);
        this.recordHistory(this.currentResult);
      }
    }
  }

  renderParsedResult(parsed) {
    if (this.activeMode === 'S') {
      const digit = parsed.singleDigit ?? (parsed.digits?.[0] ?? null);
      if (digit !== null && digit !== undefined) {
        this.singleDigitValue.textContent = digit;
        this.singleDigitValue.classList.remove('pop');
        void this.singleDigitValue.offsetWidth;
        this.singleDigitValue.classList.add('pop');
        this.singlePhoneticLabel.textContent = '';
      }
    } else {
      this.digitCardsContainer.innerHTML = '';
      const digitsArray = parsed.digits || [];

      if (digitsArray.length > 0) {
        digitsArray.forEach((digit, idx) => {
          const card = document.createElement('div');
          card.className = 'digit-card-item';
          card.style.animationDelay = `${idx * 0.05}s`;
          card.textContent = digit;
          this.digitCardsContainer.appendChild(card);
        });
      } else {
        this.digitCardsContainer.innerHTML = `<div class="placeholder-msg">Say a number</div>`;
      }
    }
  }

  handleStatusChange(status) {
    if (status === 'listening') {
      this.micBtn.classList.add('active');
      this.micLabel.textContent = 'Listening…';
    } else {
      this.micBtn.classList.remove('active');
      this.micLabel.textContent = 'Tap to listen';
    }
  }

  recordHistory(resultItem) {
    if (!resultItem.digitString || !resultItem.hasDigits) return;

    this.historyLog.unshift({
      id: Date.now(),
      time: resultItem.timestamp || new Date().toLocaleTimeString(),
      digits: resultItem.digitString,
      engine: resultItem.engine || this.activeEngine
    });

    if (this.historyLog.length > 50) this.historyLog.pop();

    this.saveHistory();
    this.renderHistory();
  }

  renderHistory() {
    if (!this.historyList) return;

    if (this.historyLog.length === 0) {
      this.historyList.innerHTML = `<div class="history-empty">No digits recognized yet</div>`;
      return;
    }

    this.historyList.innerHTML = this.historyLog.map(item => `
      <div class="history-item">
        <span class="history-digits">${escapeHTML(item.digits)}</span>
        <span class="history-meta">${item.time}</span>
      </div>
    `).join('');
  }

  clearHistory() {
    this.historyLog = [];
    this.saveHistory();
    this.renderHistory();
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem('voice_digit_recognition_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('voice_digit_recognition_history', JSON.stringify(this.historyLog));
    } catch (e) {}
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new VoiceDigitApp();
});
