/**
 * Web Speech API Engine with browser support fallback & simulation triggers.
 */

export class SpeechEngine {
  constructor(options = {}) {
    this.onResult = options.onResult || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onError = options.onError || (() => {});

    this.recognition = null;
    this.isListening = false;
    this.language = options.language || 'en-US';
    this.continuous = options.continuous !== undefined ? options.continuous : true;
    this.interimResults = true;

    this.initRecognition();
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported natively in this browser window.');
      this.isSupported = false;
      return;
    }

    this.isSupported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.continuous;
    this.recognition.interimResults = this.interimResults;
    this.recognition.lang = this.language;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStatusChange('listening', 'Microphone active. Listening for digits...');
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence || 0.95;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          this.onResult({
            transcript: transcript.trim(),
            isFinal: true,
            confidence: Math.round(confidence * 100)
          });
        } else {
          interimTranscript += transcript;
          this.onResult({
            transcript: interimTranscript.trim(),
            isFinal: false,
            confidence: Math.round(confidence * 100)
          });
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      let msg = `Speech error: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        msg = 'Microphone access denied or unavailable. Use the Voice Simulator buttons below to test!';
      } else if (event.error === 'no-speech') {
        msg = 'No speech detected. Speak clearly into your microphone.';
      }
      this.onError(event.error, msg);
      this.onStatusChange('error', msg);
    };

    this.recognition.onend = () => {
      // If user intended to keep listening in continuous mode, restart unless stopped manually
      if (this.isListening && this.continuous) {
        try {
          this.recognition.start();
          return;
        } catch (e) {
          // Ignore if restarting fails
        }
      }
      this.isListening = false;
      this.onStatusChange('idle', 'Microphone standby. Click Start to speak.');
    };
  }

  setLanguage(lang) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  setMode(continuous) {
    this.continuous = continuous;
    if (this.recognition) {
      this.recognition.continuous = continuous;
    }
  }

  start() {
    if (!this.isSupported) {
      this.onStatusChange('unsupported', 'Web Speech API not available on this browser. Use Voice Simulator!');
      return false;
    }
    if (this.isListening) return true;

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.error('Error starting recognition:', err);
      this.onStatusChange('error', 'Could not access microphone.');
      return false;
    }
  }

  stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        // Ignore stop errors
      }
    }
    this.onStatusChange('idle', 'Microphone standby. Click Start to speak.');
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Simulate voice result for testing environment or direct preset buttons.
   */
  simulateVoiceInput(transcriptText) {
    this.onStatusChange('simulating', `Simulating voice speech: "${transcriptText}"`);
    setTimeout(() => {
      this.onResult({
        transcript: transcriptText,
        isFinal: true,
        confidence: 98,
        isSimulated: true
      });
      setTimeout(() => {
        if (!this.isListening) {
          this.onStatusChange('idle', 'Ready. Speak or select a voice preset.');
        } else {
          this.onStatusChange('listening', 'Microphone active. Listening for digits...');
        }
      }, 800);
    }, 300);
  }
}
