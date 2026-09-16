/**
 * Mel-Frequency Cepstral Coefficients (MFCC) Feature Extractor
 * Pure JavaScript implementation for Audio Signal Processing
 */

export class MfccExtractor {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 16000;
    this.frameSize = options.frameSize || 512;
    this.hopSize = options.hopSize || 256;
    this.numMelFilters = options.numMelFilters || 26;
    this.numCoeffs = options.numCoeffs || 13;
    this.minFreq = options.minFreq || 300;
    this.maxFreq = options.maxFreq || this.sampleRate / 2;
    this.preEmphasisCoeff = 0.97;

    this.initMelFilterbank();
  }

  /**
   * Hertz to Mel conversion formula
   */
  hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Mel to Hertz conversion formula
   */
  melToHz(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Pre-compute 26 Mel Filterbank triangular weights
   */
  initMelFilterbank() {
    const minMel = this.hzToMel(this.minFreq);
    const maxMel = this.hzToMel(this.maxFreq);

    // Create numMelFilters + 2 linearly spaced points in Mel scale
    const melPoints = [];
    const melStep = (maxMel - minMel) / (this.numMelFilters + 1);
    for (let i = 0; i < this.numMelFilters + 2; i++) {
      melPoints.push(minMel + i * melStep);
    }

    // Convert Mel points back to Hz and FFT bin indices
    const fftSize = this.frameSize;
    const binIndices = melPoints.map(mel => {
      const hz = this.melToHz(mel);
      return Math.floor((fftSize + 1) * hz / this.sampleRate);
    });

    // Construct triangular filterbank matrix
    this.filterbank = [];
    const numBins = Math.floor(fftSize / 2) + 1;

    for (let m = 1; m <= this.numMelFilters; m++) {
      const filter = new Float32Array(numBins);
      const leftBin = binIndices[m - 1];
      const centerBin = binIndices[m];
      const rightBin = binIndices[m + 1];

      for (let k = leftBin; k < centerBin; k++) {
        if (centerBin > leftBin) {
          filter[k] = (k - leftBin) / (centerBin - leftBin);
        }
      }
      for (let k = centerBin; k < rightBin; k++) {
        if (rightBin > centerBin) {
          filter[k] = (rightBin - k) / (rightBin - centerBin);
        }
      }
      this.filterbank.push(filter);
    }

    // Precompute DCT matrix (Discrete Cosine Transform - II)
    this.dctMatrix = [];
    for (let i = 0; i < this.numCoeffs; i++) {
      const row = new Float32Array(this.numMelFilters);
      for (let j = 0; j < this.numMelFilters; j++) {
        row[j] = Math.cos((Math.PI * i / this.numMelFilters) * (j + 0.5));
      }
      this.dctMatrix.push(row);
    }
  }

  /**
   * Apply pre-emphasis filter y[n] = x[n] - 0.97 * x[n-1]
   */
  applyPreEmphasis(buffer) {
    const out = new Float32Array(buffer.length);
    out[0] = buffer[0];
    for (let i = 1; i < buffer.length; i++) {
      out[i] = buffer[i] - this.preEmphasisCoeff * buffer[i - 1];
    }
    return out;
  }

  /**
   * Apply Hamming Window to a single audio frame
   */
  applyHammingWindow(frame) {
    const N = frame.length;
    const windowed = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const hamming = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
      windowed[n] = frame[n] * hamming;
    }
    return windowed;
  }

  /**
   * Cooley-Tukey Radix-2 FFT (Fast Fourier Transform)
   */
  fft(realInput) {
    const N = realInput.length;
    const real = new Float32Array(realInput);
    const imag = new Float32Array(N);

    // Bit reversal permutation
    let j = 0;
    for (let i = 0; i < N - 1; i++) {
      if (i < j) {
        const tempR = real[i]; real[i] = real[j]; real[j] = tempR;
        const tempI = imag[i]; imag[i] = imag[j]; imag[j] = tempI;
      }
      let k = N >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey Radix-2 computation loops
    for (let len = 2; len <= N; len <<= 1) {
      const halfLen = len >> 1;
      const angle = -2 * Math.PI / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < N; i += len) {
        let wR = 1.0;
        let wI = 0.0;
        for (let k = 0; k < halfLen; k++) {
          const pos1 = i + k;
          const pos2 = i + k + halfLen;

          const tR = wR * real[pos2] - wI * imag[pos2];
          const tI = wR * imag[pos2] + wI * real[pos2];

          real[pos2] = real[pos1] - tR;
          imag[pos2] = imag[pos1] - tI;
          real[pos1] += tR;
          imag[pos1] += tI;

          const nextWR = wR * wStepR - wI * wStepI;
          const nextWI = wR * wStepI + wI * wStepR;
          wR = nextWR;
          wI = nextWI;
        }
      }
    }

    // Power spectrum calculation P = (|FFT|^2) / N
    const numBins = Math.floor(N / 2) + 1;
    const powerSpectrum = new Float32Array(numBins);
    for (let k = 0; k < numBins; k++) {
      powerSpectrum[k] = (real[k] * real[k] + imag[k] * imag[k]) / N;
    }
    return powerSpectrum;
  }

  /**
   * Extract 13 MFCC coefficients for a single windowed frame
   */
  extractFrameMfcc(frame) {
    const windowed = this.applyHammingWindow(frame);
    const powerSpectrum = this.fft(windowed);

    // Apply 26 Mel filterbank filters
    const filterEnergies = new Float32Array(this.numMelFilters);
    for (let m = 0; m < this.numMelFilters; m++) {
      let sum = 0;
      const filter = this.filterbank[m];
      for (let k = 0; k < powerSpectrum.length; k++) {
        sum += powerSpectrum[k] * filter[k];
      }
      // Take log energy with small epsilon to avoid log(0)
      filterEnergies[m] = Math.log(Math.max(sum, 1e-10));
    }

    // Apply DCT-II to get 13 MFCC coefficients
    const mfccCoeffs = new Float32Array(this.numCoeffs);
    for (let i = 0; i < this.numCoeffs; i++) {
      let sum = 0;
      const dctRow = this.dctMatrix[i];
      for (let j = 0; j < this.numMelFilters; j++) {
        sum += filterEnergies[j] * dctRow[j];
      }
      mfccCoeffs[i] = sum;
    }

    return mfccCoeffs;
  }

  /**
   * Extract full MFCC matrix and mean feature vector across audio PCM buffer
   * @param {Float32Array|Array} pcmData - Audio samples in range [-1.0, 1.0]
   * @returns {Object} { framesMfcc: Matrix, meanVector: Array[13] }
   */
  extractSignalMfcc(pcmData) {
    if (!pcmData || pcmData.length < this.frameSize) {
      // Fallback dummy vector if signal too short
      return {
        framesMfcc: [],
        meanVector: new Array(this.numCoeffs).fill(0)
      };
    }

    const preEmphasized = this.applyPreEmphasis(pcmData);
    const framesMfcc = [];

    for (let offset = 0; offset + this.frameSize <= preEmphasized.length; offset += this.hopSize) {
      const frame = preEmphasized.subarray(offset, offset + this.frameSize);
      // Check frame energy to skip silent frames
      let energy = 0;
      for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
      if (energy / frame.length < 1e-4) continue; // Skip silence

      const mfcc = this.extractFrameMfcc(frame);
      framesMfcc.push(Array.from(mfcc));
    }

    if (framesMfcc.length === 0) {
      return {
        framesMfcc: [],
        meanVector: new Array(this.numCoeffs).fill(0)
      };
    }

    // Compute average MFCC feature vector across active frames
    const meanVector = new Array(this.numCoeffs).fill(0);
    for (let f = 0; f < framesMfcc.length; f++) {
      for (let c = 0; c < this.numCoeffs; c++) {
        meanVector[c] += framesMfcc[f][c];
      }
    }
    for (let c = 0; c < this.numCoeffs; c++) {
      meanVector[c] /= framesMfcc.length;
    }

    return {
      framesMfcc,
      meanVector
    };
  }
}
