/**
 * Audio Feedback System (Speech Synthesis & Synthesized Audio Beeps)
 */

export class AudioFeedback {
  constructor() {
    this.speechEnabled = true;
    this.synth = window.speechSynthesis || null;
    this.audioCtx = null;
  }

  setSpeechEnabled(enabled) {
    this.speechEnabled = enabled;
  }

  playDigitSound(digit) {
    // Play a friendly synth chime
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Map digit 0-9 to musical scale frequencies (C5 scale)
      const frequencies = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51];
      const freq = frequencies[digit % 10] || 600;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.25);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  speakText(text) {
    if (!this.speechEnabled || !this.synth) return;

    // Cancel ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    
    // Select standard English voice if available
    const voices = this.synth.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    this.synth.speak(utterance);
  }

  speakDigits(digitSequence) {
    if (!digitSequence) return;
    const spoken = String(digitSequence).split('').join(' ');
    this.speakText(`Digits: ${spoken}`);
  }
}
