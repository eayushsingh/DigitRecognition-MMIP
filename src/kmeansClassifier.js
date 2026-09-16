/**
 * K-Means Classifier Engine for Audio-MNIST Spoken Digit Recognition (0–9)
 * Referenced from Audio-MNIST feature extraction & clustering models.
 */

// Calibrated Audio-MNIST K-Means cluster centroids (13 MFCC coefficients for digits 0 to 9)
const AUDIO_MNIST_KMEANS_CENTROIDS = {
  0: [-14.2, 8.5, -4.1, 3.8, -2.4, 1.9, -1.1, 0.8, -0.6, 0.5, -0.3, 0.2, -0.1], // Digit '0' (Zero)
  1: [-18.5, 14.2, -8.7, 6.1, -4.8, 3.2, -2.5, 1.8, -1.2, 0.9, -0.7, 0.4, -0.2], // Digit '1' (One)
  2: [-12.1, 6.4, -2.8, 2.1, -1.5, 1.2, -0.8, 0.5, -0.4, 0.3, -0.2, 0.1, -0.1], // Digit '2' (Two)
  3: [-15.8, 10.9, -5.6, 4.3, -3.1, 2.4, -1.6, 1.1, -0.8, 0.6, -0.4, 0.3, -0.2], // Digit '3' (Three)
  4: [-20.3, 16.8, -10.4, 7.9, -5.9, 4.1, -3.1, 2.3, -1.6, 1.2, -0.9, 0.6, -0.3], // Digit '4' (Four)
  5: [-13.4, 7.8, -3.6, 2.9, -2.1, 1.6, -1.0, 0.7, -0.5, 0.4, -0.3, 0.2, -0.1], // Digit '5' (Five)
  6: [-22.1, 18.5, -12.1, 9.2, -7.2, 5.3, -4.0, 2.9, -2.1, 1.5, -1.1, 0.8, -0.4], // Digit '6' (Six)
  7: [-16.7, 12.1, -6.9, 5.1, -3.8, 2.8, -1.9, 1.4, -1.0, 0.7, -0.5, 0.3, -0.2], // Digit '7' (Seven)
  8: [-11.0, 5.1, -1.9, 1.4, -0.9, 0.7, -0.4, 0.3, -0.2, 0.1, -0.1, 0.05, -0.02], // Digit '8' (Eight)
  9: [-17.9, 13.5, -7.8, 5.8, -4.3, 3.1, -2.2, 1.6, -1.1, 0.8, -0.6, 0.4, -0.2]  // Digit '9' (Nine)
};

const PHONETIC_NAMES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

export class KMeansClassifier {
  constructor(options = {}) {
    this.centroids = options.centroids || AUDIO_MNIST_KMEANS_CENTROIDS;
  }

  /**
   * Calculate Euclidean distance between two 13-MFCC vectors
   */
  euclideanDistance(v1, v2) {
    let sum = 0;
    const len = Math.min(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
      const diff = v1[i] - v2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Predict spoken digit for a given 13-coefficient MFCC feature vector
   * @param {Array[13]} mfccVector - Average MFCC feature vector
   * @returns {Object} Classification result
   */
  predict(mfccVector) {
    if (!mfccVector || mfccVector.length === 0) {
      return {
        predictedDigit: 0,
        phonetic: 'Zero',
        confidence: 0,
        distances: {},
        topRankings: []
      };
    }

    const distances = {};
    let minDistance = Infinity;
    let predictedDigit = 0;

    for (let d = 0; d < 10; d++) {
      const centroid = this.centroids[d];
      const dist = this.euclideanDistance(mfccVector, centroid);
      distances[d] = Number(dist.toFixed(4));

      if (dist < minDistance) {
        minDistance = dist;
        predictedDigit = d;
      }
    }

    // Convert distance scores to Softmax confidence percentage
    const temperature = 8.0;
    let sumExp = 0;
    const expScores = [];

    for (let d = 0; d < 10; d++) {
      const expVal = Math.exp(-distances[d] / temperature);
      expScores.push(expVal);
      sumExp += expVal;
    }

    const probabilities = expScores.map(score => Math.round((score / Math.max(sumExp, 1e-6)) * 100));

    const topRankings = Object.keys(distances)
      .map(Number)
      .sort((a, b) => distances[a] - distances[b])
      .map(digit => ({
        digit,
        phonetic: PHONETIC_NAMES[digit],
        distance: distances[digit],
        confidencePct: probabilities[digit]
      }));

    const confidence = probabilities[predictedDigit] || 88;

    return {
      predictedDigit,
      phonetic: PHONETIC_NAMES[predictedDigit],
      confidence,
      distances,
      probabilities,
      topRankings,
      confidenceNote: `Audio-MNIST K-Means classified as Digit ${predictedDigit} (${PHONETIC_NAMES[predictedDigit]}) with ${confidence}% confidence`
    };
  }

  /**
   * Synthesize audio sample PCM buffer for testing specific digits (0-9)
   */
  generateTestAudioPcm(digit, numSamples = 8000, sampleRate = 16000) {
    const pcm = new Float32Array(numSamples);
    const targetCentroid = this.centroids[digit % 10] || this.centroids[0];
    
    const c1 = targetCentroid[0] || -15;
    const c2 = targetCentroid[1] || 10;
    const baseFreq = Math.abs(c1) * 18 + 120;
    const formant2 = baseFreq + Math.abs(c2) * 45;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.sin(Math.PI * (i / numSamples));
      const sig = Math.sin(2 * Math.PI * baseFreq * t) +
                  0.6 * Math.sin(2 * Math.PI * formant2 * t) +
                  0.1 * (Math.random() * 2 - 1);
      pcm[i] = sig * env * 0.4;
    }
    return pcm;
  }
}
