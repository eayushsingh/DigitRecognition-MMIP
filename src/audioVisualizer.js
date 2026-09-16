/**
 * Real-time HTML5 Canvas Audio Waveform and Live Mic PCM Buffer Streamer
 */

export class AudioVisualizer {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.audioCtx = null;
    this.analyser = null;
    this.scriptNode = null;
    this.microphone = null;
    this.isRecording = false;
    this.isSimulating = false;
    this.animationFrameId = null;
    this.phase = 0;
    this.onAudioFrame = options.onAudioFrame || null;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 600) * window.devicePixelRatio;
    this.canvas.height = (rect.height || 100) * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width || 600;
    this.height = rect.height || 100;
  }

  async startListening() {
    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext({ sampleRate: 16000 });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.microphone = this.audioCtx.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      // Connect ScriptProcessorNode to capture live PCM audio frames for MFCC processing
      if (this.audioCtx.createScriptProcessor) {
        this.scriptNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
        this.scriptNode.onaudioprocess = (e) => {
          if (!this.isRecording) return;
          const inputBuffer = e.inputBuffer.getChannelData(0);
          if (this.onAudioFrame) {
            this.onAudioFrame(inputBuffer);
          }
        };
        this.microphone.connect(this.scriptNode);
        this.scriptNode.connect(this.audioCtx.destination);
      }

      this.isRecording = true;
      this.isSimulating = false;
      this.draw();
    } catch (err) {
      console.warn('Microphone stream access restricted, falling back to simulated wave visualizer.', err);
      this.startSimulation();
    }
  }

  stopListening() {
    this.isRecording = false;
    if (this.scriptNode) {
      try {
        this.scriptNode.disconnect();
      } catch (e) {}
      this.scriptNode = null;
    }
    if (this.microphone && this.microphone.mediaStream) {
      this.microphone.mediaStream.getTracks().forEach(track => track.stop());
    }
    this.microphone = null;
    this.drawIdle();
  }

  triggerPulse() {
    this.isSimulating = true;
    let pulseCount = 0;
    const interval = setInterval(() => {
      this.phase += 0.2;
      pulseCount++;
      if (pulseCount > 30) {
        clearInterval(interval);
        this.isSimulating = false;
      }
    }, 30);
  }

  startSimulation() {
    this.isRecording = false;
    this.isSimulating = true;
    this.draw();
  }

  draw() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    const render = () => {
      this.ctx.clearRect(0, 0, this.width, this.height);

      if (this.isRecording && this.analyser) {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        const barWidth = (this.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * (this.height * 0.8);

          const gradient = this.ctx.createLinearGradient(0, this.height, 0, 0);
          gradient.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
          gradient.addColorStop(0.5, 'rgba(0, 201, 255, 0.8)');
          gradient.addColorStop(1, 'rgba(127, 0, 255, 1)');

          this.ctx.fillStyle = gradient;
          this.ctx.shadowColor = '#00f2fe';
          this.ctx.shadowBlur = 8;
          
          this.ctx.beginPath();
          this.ctx.roundRect(x, this.height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          this.ctx.fill();

          x += barWidth + 2;
        }

        // Oscilloscope Line
        const timeData = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(timeData);

        this.ctx.beginPath();
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = '#00f2fe';
        this.ctx.shadowBlur = 12;

        const sliceWidth = this.width / bufferLength;
        let lineX = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * this.height) / 2;

          if (i === 0) {
            this.ctx.moveTo(lineX, y);
          } else {
            this.ctx.lineTo(lineX, y);
          }
          lineX += sliceWidth;
        }
        this.ctx.stroke();

      } else if (this.isSimulating) {
        this.phase += 0.08;
        this.ctx.beginPath();
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#00f2fe';
        this.ctx.shadowColor = '#00f2fe';
        this.ctx.shadowBlur = 15;

        for (let x = 0; x < this.width; x += 4) {
          const y = this.height / 2 + Math.sin(x * 0.04 + this.phase) * 18 * Math.sin(this.phase * 0.5);
          if (x === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
      } else {
        this.drawIdle();
        return;
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  drawIdle() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.beginPath();
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.moveTo(0, this.height / 2);
    this.ctx.lineTo(this.width, this.height / 2);
    this.ctx.stroke();
  }
}
