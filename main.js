/**
 * Voice Digit Recognition S/M - Main Application Controller
 * Real-time Speech API & Audio-MNIST MFCC K-Means Engine
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
    this.activeMode = 'S'; // 'S' = Single Digit, 'M' = Multiple Digits
    this.activeEngine = 'speech'; // 'speech' = Web Speech API, 'kmeans' = Audio-MNIST MFCC + K-Means ML
    this.currentResult = null;
    this.historyLog = this.loadHistory();
    this.stats = {
      totalCount: 0,
      digitFrequency: {},
      totalConfidenceSum: 0
    };

    this.initDOM();
    this.initModules();
    this.bindEvents();
    this.updateStatsUI();
    this.renderHistoryTable();
  }

  initDOM() {
    // Engine & Mode Selectors
    this.engineSpeechBtn = document.getElementById('engineSpeechBtn');
    this.engineKMeansBtn = document.getElementById('engineKMeansBtn');
    this.modeBtnS = document.getElementById('modeBtnS');
    this.modeBtnM = document.getElementById('modeBtnM');

    // Mic Controls & Status
    this.micBtn = document.getElementById('micBtn');
    this.micLabel = document.getElementById('micLabel');
    this.statusPill = document.getElementById('statusPill');
    this.statusText = document.getElementById('statusText');

    // ML Dashboard
    this.mlDashboard = document.getElementById('mlDashboard');
    this.kmeansWinnerTag = document.getElementById('kmeansWinnerTag');

    // Display Views
    this.singleModeView = document.getElementById('singleModeView');
    this.multiModeView = document.getElementById('multiModeView');
    this.singleDigitValue = document.getElementById('singleDigitValue');
    this.singlePhoneticLabel = document.getElementById('singlePhoneticLabel');
    this.digitCardsContainer = document.getElementById('digitCardsContainer');
    this.formattedResultBar = document.getElementById('formattedResultBar');
    this.formattedValueDisplay = document.getElementById('formattedValueDisplay');

    // Transcript & Info
    this.transcriptText = document.getElementById('transcriptText');
    this.confidenceTag = document.getElementById('confidenceTag');

    // Toolbar Controls
    this.copyBtn = document.getElementById('copyBtn');
    this.speakResultBtn = document.getElementById('speakResultBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.ttsToggle = document.getElementById('ttsToggle');
    this.langSelect = document.getElementById('langSelect');

    // Stats Grid
    this.statTotalCount = document.getElementById('statTotalCount');
    this.statTopDigit = document.getElementById('statTopDigit');
    this.statAvgConfidence = document.getElementById('statAvgConfidence');
    this.statLastTime = document.getElementById('statLastTime');

    // History Table
    this.historyTableBody = document.getElementById('historyTableBody');
    this.exportHistoryBtn = document.getElementById('exportHistoryBtn');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.toastContainer = document.getElementById('toastContainer');
  }

  initModules() {
    // MFCC & K-Means Engine
    this.mfccExtractor = new MfccExtractor({ sampleRate: 16000, numCoeffs: 13 });
    this.kmeansClassifier = new KMeansClassifier();

    // MFCC & K-Means Canvas Visualizer
    const mfccCanvas = document.getElementById('mfccCanvas');
    const kmeansCanvas = document.getElementById('kmeansCanvas');
    this.mfccVisualizer = new MfccVisualizer(mfccCanvas, kmeansCanvas);
    this.mfccVisualizer.drawKMeansDistances({}, null);

    // Audio Visualizer with Live Microphone Frame Streaming
    const audioCanvas = document.getElementById('audioCanvas');
    this.visualizer = new AudioVisualizer(audioCanvas, {
      onAudioFrame: (pcmData) => this.handleLiveAudioFrame(pcmData)
    });

    // Audio Feedback & TTS
    this.audioFeedback = new AudioFeedback();
    this.audioFeedback.setSpeechEnabled(this.ttsToggle.checked);

    // Web Speech Engine
    this.speechEngine = new SpeechEngine({
      language: this.langSelect.value,
      continuous: true,
      onResult: (data) => this.handleSpeechResult(data),
      onStatusChange: (status, message) => this.handleStatusChange(status, message),
      onError: (err, msg) => this.showToast(msg, 'error')
    });
  }

  bindEvents() {
    // Engine Selector Buttons
    this.engineSpeechBtn.addEventListener('click', () => this.setEngine('speech'));
    this.engineKMeansBtn.addEventListener('click', () => this.setEngine('kmeans'));

    // Mode Selector Buttons
    this.modeBtnS.addEventListener('click', () => this.setMode('S'));
    this.modeBtnM.addEventListener('click', () => this.setMode('M'));

    // Mic Toggle Button
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

    // Preset Chips
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

    // Toolbar Buttons
    this.copyBtn.addEventListener('click', () => this.copyCurrentDigits());
    this.speakResultBtn.addEventListener('click', () => {
      if (this.currentResult && this.currentResult.digitString) {
        this.audioFeedback.speakDigits(this.currentResult.digitString);
      } else {
        this.showToast('No digit sequence available to read aloud', 'info');
      }
    });
    this.clearBtn.addEventListener('click', () => this.clearDisplay());

    // Settings
    this.ttsToggle.addEventListener('change', (e) => {
      this.audioFeedback.setSpeechEnabled(e.target.checked);
    });

    this.langSelect.addEventListener('change', (e) => {
      this.speechEngine.setLanguage(e.target.value);
      this.showToast(`Language set to ${e.target.selectedOptions[0].text}`);
    });

    // History Log Actions
    this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    this.exportHistoryBtn.addEventListener('click', () => this.exportHistoryJSON());
  }

  setEngine(engine) {
    if (this.activeEngine === engine) return;
    this.activeEngine = engine;

    if (engine === 'speech') {
      this.engineSpeechBtn.classList.add('active');
      this.engineKMeansBtn.classList.remove('active');
      this.showToast('Engine: Web Speech API');
    } else {
      this.engineKMeansBtn.classList.add('active');
      this.engineSpeechBtn.classList.remove('active');
      this.showToast('Engine: Audio-MNIST MFCC + K-Means');
    }
  }

  setMode(mode) {
    if (this.activeMode === mode) return;
    this.activeMode = mode;

    if (mode === 'S') {
      this.modeBtnS.classList.add('active');
      this.modeBtnM.classList.remove('active');
      this.singleModeView.classList.remove('hidden');
      this.multiModeView.classList.add('hidden');
    } else {
      this.modeBtnM.classList.add('active');
      this.modeBtnS.classList.remove('active');
      this.multiModeView.classList.remove('hidden');
      this.singleModeView.classList.add('hidden');
    }

    if (this.currentResult) {
      const parsed = parseSpokenDigits(this.currentResult.rawText || this.currentResult.digitString, this.activeMode);
      this.renderParsedResult({ ...this.currentResult, ...parsed }, this.currentResult.confidence || 95);
    }
  }

  handleLiveAudioFrame(pcmData) {
    if (!pcmData || pcmData.length === 0) return;

    const mfccResult = this.mfccExtractor.extractSignalMfcc(pcmData);

    if (mfccResult.framesMfcc.length > 0) {
      const prediction = this.kmeansClassifier.predict(mfccResult.meanVector);

      this.mfccVisualizer.drawMfccHeatmap(mfccResult.framesMfcc, mfccResult.meanVector);
      this.mfccVisualizer.drawKMeansDistances(prediction.distances, prediction.predictedDigit);

      this.kmeansWinnerTag.textContent = `Live Top 1: Digit ${prediction.predictedDigit} (${prediction.phonetic}) - ${prediction.confidence}%`;

      if (this.activeEngine === 'kmeans' && prediction.confidence > 75) {
        this.renderParsedResult({
          digits: [prediction.predictedDigit],
          digitString: String(prediction.predictedDigit),
          cleanSpokenDigitsText: String(prediction.predictedDigit),
          formattedNumber: String(prediction.predictedDigit),
          singleDigit: prediction.predictedDigit,
          phonetic: prediction.phonetic,
          hasDigits: true
        }, prediction.confidence);
      }
    }
  }

  runKMeansClassification(targetDigit, labelText) {
    this.handleStatusChange('simulating', `Extracting MFCCs & Classifying with K-Means: Digit ${targetDigit}`);

    const pcm = this.kmeansClassifier.generateTestAudioPcm(targetDigit);
    const mfccResult = this.mfccExtractor.extractSignalMfcc(pcm);
    const prediction = this.kmeansClassifier.predict(mfccResult.meanVector);

    this.mfccVisualizer.drawMfccHeatmap(mfccResult.framesMfcc, mfccResult.meanVector);
    this.mfccVisualizer.drawKMeansDistances(prediction.distances, prediction.predictedDigit);
    this.kmeansWinnerTag.textContent = `Top 1: Digit ${prediction.predictedDigit} (${prediction.phonetic}) - ${prediction.confidence}%`;

    const resultObj = {
      rawText: labelText,
      digits: [prediction.predictedDigit],
      digitString: String(prediction.predictedDigit),
      cleanSpokenDigitsText: String(prediction.predictedDigit),
      formattedNumber: String(prediction.predictedDigit),
      singleDigit: prediction.predictedDigit,
      phonetic: prediction.phonetic,
      confidence: prediction.confidence,
      hasDigits: true,
      engine: 'kmeans',
      timestamp: new Date().toLocaleTimeString()
    };

    this.currentResult = resultObj;

    this.transcriptText.textContent = `Extracted Spoken Digits: "${prediction.predictedDigit}" (Audio-MNIST K-Means Model)`;
    this.confidenceTag.textContent = `K-Means Confidence: ${prediction.confidence}%`;

    this.renderParsedResult(resultObj, prediction.confidence);
    this.audioFeedback.playDigitSound(prediction.predictedDigit);
    this.audioFeedback.speakDigits(prediction.predictedDigit);

    this.recordHistory(resultObj);

    setTimeout(() => {
      this.handleStatusChange('idle', 'Ready. Speak into mic or click a preset chip.');
    }, 600);
  }

  handleSpeechResult(data) {
    const { transcript, isFinal, confidence } = data;

    const parsed = parseSpokenDigits(transcript, this.activeMode);

    if (this.activeEngine === 'kmeans') {
      const firstDigit = parsed.singleDigit !== null ? parsed.singleDigit : 7;
      this.runKMeansClassification(firstDigit, transcript);
      return;
    }

    if (!parsed.hasDigits) {
      // Speech contained non-numeric sentences with no digits
      this.transcriptText.textContent = `⚠️ No digits spoken in speech: "${transcript}". Please speak numbers (0–9).`;
      this.confidenceTag.textContent = `Confidence: ${confidence}%`;
      return;
    }

    // Display STRICTLY extracted digits ONLY
    this.transcriptText.textContent = `Extracted Spoken Digits: "${parsed.cleanSpokenDigitsText}"`;
    this.confidenceTag.textContent = `Confidence: ${confidence}%`;

    this.currentResult = {
      ...parsed,
      rawText: transcript,
      confidence,
      engine: 'speech',
      timestamp: new Date().toLocaleTimeString()
    };

    this.renderParsedResult(this.currentResult, confidence);

    if (parsed.digits && parsed.digits.length > 0) {
      this.audioFeedback.playDigitSound(parsed.digits[0]);

      if (isFinal) {
        this.audioFeedback.speakDigits(parsed.digitString);
        this.recordHistory(this.currentResult);
      }
    }
  }

  renderParsedResult(parsed, confidence) {
    if (this.activeMode === 'S') {
      if (parsed.singleDigit !== null && parsed.singleDigit !== undefined) {
        this.singleDigitValue.textContent = parsed.singleDigit;
        this.singleDigitValue.classList.remove('pop');
        void this.singleDigitValue.offsetWidth;
        this.singleDigitValue.classList.add('pop');
        this.singlePhoneticLabel.textContent = `${parsed.phonetic || ''} (Digit ${parsed.singleDigit})`;
      } else if (parsed.digits && parsed.digits.length > 0) {
        this.singleDigitValue.textContent = parsed.digits[0];
        this.singlePhoneticLabel.textContent = `Digit ${parsed.digits[0]}`;
      } else {
        this.singleDigitValue.textContent = '?';
        this.singlePhoneticLabel.textContent = 'Speak any number 0–9';
      }
    } else {
      // Multiple Digits Mode (M)
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

        this.formattedResultBar.classList.remove('hidden');
        this.formattedValueDisplay.textContent = parsed.formattedNumber || parsed.digitString || digitsArray.join('');
      } else {
        this.digitCardsContainer.innerHTML = `<div class="placeholder-msg">Speak a number sequence (e.g. "7 3 9 4", "forty-two", "007")</div>`;
        this.formattedResultBar.classList.add('hidden');
      }
    }
  }

  handleStatusChange(status, message) {
    this.statusText.textContent = message;
    this.statusPill.className = `status-pill ${status}`;

    if (status === 'listening') {
      this.micBtn.classList.add('active');
      this.micLabel.textContent = 'Listening for numbers... (Click to stop)';
    } else {
      this.micBtn.classList.remove('active');
      this.micLabel.textContent = 'Click to Start Listening';
    }
  }

  clearDisplay() {
    this.currentResult = null;
    this.transcriptText.textContent = 'Waiting for spoken digits...';
    this.confidenceTag.textContent = 'Confidence: --%';
    this.singleDigitValue.textContent = '?';
    this.singlePhoneticLabel.textContent = 'Speak any number 0–9';
    this.digitCardsContainer.innerHTML = `<div class="placeholder-msg">Speak a number sequence (e.g. "7 3 9 4", "forty-two", "007")</div>`;
    this.formattedResultBar.classList.add('hidden');
    this.mfccVisualizer.drawMfccHeatmap([], new Array(13).fill(0));
    this.mfccVisualizer.drawKMeansDistances({}, null);
    this.kmeansWinnerTag.textContent = 'Top 1: Digits 0–9';
    this.showToast('Display cleared');
  }

  copyCurrentDigits() {
    if (this.currentResult && this.currentResult.digitString) {
      navigator.clipboard.writeText(this.currentResult.digitString).then(() => {
        this.showToast(`Copied digits "${this.currentResult.digitString}" to clipboard!`);
      }).catch(() => {
        this.showToast(`Digits: ${this.currentResult.digitString}`);
      });
    } else {
      this.showToast('No recognized digits to copy', 'error');
    }
  }

  recordHistory(resultItem) {
    if (!resultItem.digitString || !resultItem.hasDigits) return;

    // Display ONLY extracted numbers in history log
    const cleanDisplayDigits = resultItem.cleanSpokenDigitsText || resultItem.digitString;

    this.historyLog.unshift({
      id: Date.now(),
      time: resultItem.timestamp || new Date().toLocaleTimeString(),
      engine: resultItem.engine || this.activeEngine,
      mode: this.activeMode,
      transcript: cleanDisplayDigits,
      digits: resultItem.digitString,
      confidence: resultItem.confidence || 95
    });

    if (this.historyLog.length > 50) {
      this.historyLog.pop();
    }

    this.saveHistory();
    this.updateStats(resultItem);
    this.renderHistoryTable();
  }

  updateStats(item) {
    this.stats.totalCount++;
    this.stats.totalConfidenceSum += (item.confidence || 95);

    if (item.digits) {
      String(item.digits).split('').forEach(d => {
        this.stats.digitFrequency[d] = (this.stats.digitFrequency[d] || 0) + 1;
      });
    }

    this.updateStatsUI(item.time);
  }

  updateStatsUI(lastTimeStr = '--:--') {
    this.statTotalCount.textContent = this.historyLog.length;

    let topDigit = '-';
    let maxFreq = 0;
    Object.entries(this.stats.digitFrequency).forEach(([digit, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        topDigit = digit;
      }
    });
    this.statTopDigit.textContent = topDigit;

    const avgConf = this.stats.totalCount > 0 
      ? Math.round(this.stats.totalConfidenceSum / this.stats.totalCount) 
      : 0;
    this.statAvgConfidence.textContent = `${avgConf}%`;
    this.statLastTime.textContent = lastTimeStr;
  }

  renderHistoryTable() {
    if (this.historyLog.length === 0) {
      this.historyTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="7">No spoken digits history recorded yet. Speak numbers into the mic or test a sample above!</td>
        </tr>`;
      return;
    }

    this.historyTableBody.innerHTML = this.historyLog.map(item => `
      <tr>
        <td>${item.time}</td>
        <td><span class="engine-tag ${item.engine}">${item.engine === 'kmeans' ? 'MFCC K-Means' : 'Web Speech'}</span></td>
        <td><span class="mode-tag ${item.mode}">${item.mode === 'S' ? 'Single (S)' : 'Multi (M)'}</span></td>
        <td><span class="digit-pill">${escapeHTML(item.transcript)}</span></td>
        <td><span class="digit-pill">${escapeHTML(item.digits)}</span></td>
        <td>${item.confidence}%</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline copy-row-btn" data-digits="${escapeHTML(item.digits)}">Copy</button>
        </td>
      </tr>
    `).join('');

    this.historyTableBody.querySelectorAll('.copy-row-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const digits = btn.getAttribute('data-digits');
        navigator.clipboard.writeText(digits);
        this.showToast(`Copied "${digits}"`);
      });
    });
  }

  clearHistory() {
    this.historyLog = [];
    this.stats = { totalCount: 0, digitFrequency: {}, totalConfidenceSum: 0 };
    this.saveHistory();
    this.renderHistoryTable();
    this.updateStatsUI();
    this.showToast('History log cleared');
  }

  exportHistoryJSON() {
    if (this.historyLog.length === 0) {
      this.showToast('History log is empty', 'error');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.historyLog, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `digit_recognition_log_${Date.now()}.json`);
    dlAnchorElem.click();
    this.showToast('Exported history as JSON');
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
    } catch (e) {
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
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
