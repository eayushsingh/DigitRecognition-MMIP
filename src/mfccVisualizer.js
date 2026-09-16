/**
 * MFCC Heatmap Spectrogram & K-Means Distance Chart Canvas Renderer
 */

export class MfccVisualizer {
  constructor(mfccCanvas, kmeansCanvas) {
    this.mfccCanvas = mfccCanvas;
    this.kmeansCanvas = kmeansCanvas;

    this.mfccCtx = this.mfccCanvas ? this.mfccCanvas.getContext('2d') : null;
    this.kmeansCtx = this.kmeansCanvas ? this.kmeansCanvas.getContext('2d') : null;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    if (this.mfccCanvas) {
      const rect = this.mfccCanvas.getBoundingClientRect();
      this.mfccCanvas.width = (rect.width || 400) * window.devicePixelRatio;
      this.mfccCanvas.height = (rect.height || 120) * window.devicePixelRatio;
      this.mfccCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.mfccWidth = rect.width || 400;
      this.mfccHeight = rect.height || 120;
    }

    if (this.kmeansCanvas) {
      const rect = this.kmeansCanvas.getBoundingClientRect();
      this.kmeansCanvas.width = (rect.width || 400) * window.devicePixelRatio;
      this.kmeansCanvas.height = (rect.height || 120) * window.devicePixelRatio;
      this.kmeansCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
      this.kmeansWidth = rect.width || 400;
      this.kmeansHeight = rect.height || 120;
    }
  }

  /**
   * Render 13-coefficient MFCC Heatmap Spectrogram
   * @param {Array[Array[13]]} framesMfcc - Matrix of MFCC frames
   * @param {Array[13]} meanVector - Mean feature vector
   */
  drawMfccHeatmap(framesMfcc, meanVector) {
    if (!this.mfccCtx) return;
    const ctx = this.mfccCtx;
    const w = this.mfccWidth;
    const h = this.mfccHeight;

    ctx.clearRect(0, 0, w, h);

    const data = (framesMfcc && framesMfcc.length > 0) ? framesMfcc : [meanVector || new Array(13).fill(0)];
    const numFrames = data.length;
    const numCoeffs = 13;

    const cellWidth = w / numFrames;
    const cellHeight = h / numCoeffs;

    for (let f = 0; f < numFrames; f++) {
      for (let c = 0; c < numCoeffs; c++) {
        const val = data[f][c] || 0;
        // Normalize val to range [0, 1] for color mapping
        const norm = Math.min(1.0, Math.max(0.0, (val + 25) / 45));

        // Color mapping: Cyan (low) -> Violet (mid) -> Amber/White (high)
        const r = Math.round(norm * 255);
        const g = Math.round((1 - Math.abs(norm - 0.5) * 2) * 242);
        const b = Math.round((1 - norm) * 254);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(f * cellWidth, (numCoeffs - 1 - c) * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
      }
    }

    // Overlay Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '9px "Fira Code", monospace';
    ctx.fillText('c13', 4, 12);
    ctx.fillText('c1', 4, h - 4);
  }

  /**
   * Render K-Means Centroid Distances Bar Chart for digits 0-9
   * @param {Object} distances - { 0: dist0, 1: dist1, ..., 9: dist9 }
   * @param {number} predictedDigit - Winner digit (0-9)
   */
  drawKMeansDistances(distances, predictedDigit) {
    if (!this.kmeansCtx) return;
    const ctx = this.kmeansCtx;
    const w = this.kmeansWidth;
    const h = this.kmeansHeight;

    ctx.clearRect(0, 0, w, h);

    if (!distances || Object.keys(distances).length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('K-Means Centroid Distances (0–9)', w / 2, h / 2);
      return;
    }

    const maxDist = Math.max(...Object.values(distances), 30);
    const numBars = 10;
    const padding = 12;
    const barGap = 6;
    const availableWidth = w - padding * 2;
    const barWidth = (availableWidth - (numBars - 1) * barGap) / numBars;

    for (let d = 0; d < 10; d++) {
      const dist = distances[d] || 0;
      const normHeight = Math.min(1.0, dist / maxDist);
      const barH = normHeight * (h - 32);
      const x = padding + d * (barWidth + barGap);
      const y = h - 20 - barH;

      const isWinner = d === predictedDigit;

      // Gradient for bar
      const grad = ctx.createLinearGradient(0, h - 20, 0, y);
      if (isWinner) {
        grad.addColorStop(0, '#00f2fe');
        grad.addColorStop(1, '#7f00ff');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        grad.addColorStop(1, 'rgba(79, 172, 254, 0.4)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
      ctx.fill();

      // Border glow for winner
      if (isWinner) {
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // X Label (Digit Number)
      ctx.fillStyle = isWinner ? '#00f2fe' : 'rgba(255, 255, 255, 0.6)';
      ctx.font = isWinner ? 'bold 11px "Fira Code"' : '10px "Fira Code"';
      ctx.textAlign = 'center';
      ctx.fillText(String(d), x + barWidth / 2, h - 6);
    }
  }
}
