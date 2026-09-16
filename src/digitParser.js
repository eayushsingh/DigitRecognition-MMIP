/**
 * Digit Parser Utility for Voice-Based Digit Recognition S/M
 * Strict Digit Extractor: Converts spoken text into numeric digits, stripping non-number conversational filler words.
 */

// Basic single digit word mapping & common Speech API homophones
const SINGLE_DIGIT_MAP = {
  'zero': 0, 'oh': 0, 'o': 0, 'nought': 0, 'nil': 0, 'null': 0,
  'one': 1, 'won': 1, 'wan': 1,
  'two': 2, 'to': 2, 'too': 2, 'tu': 2,
  'three': 3, 'tree': 3, 'tri': 3,
  'four': 4, 'for': 4, 'fore': 4, 'ford': 4,
  'five': 5, 'hive': 5, 'fiv': 5,
  'six': 6, 'sex': 6, 'fix': 6, 'sicks': 6,
  'seven': 7, 'sevin': 7,
  'eight': 8, 'ate': 8, 'ait': 8,
  'nine': 9, 'nigh': 9, 'nyne': 9
};

const PHONETIC_NAMES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

const TEENS = {
  'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
  'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19
};

const TENS = {
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fourty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
};

const MULTIPLIERS = {
  'hundred': 100,
  'thousand': 1000,
  'million': 1000000
};

/**
 * Parse a phrase into digit arrays and structured number representations, stripping non-digit filler words.
 * @param {string} text - Raw speech transcript text
 * @param {string} mode - 'S' (Single Digit Focus) or 'M' (Multiple Digits)
 * @returns {Object} Parse result
 */
export function parseSpokenDigits(text, mode = 'M') {
  if (!text || typeof text !== 'string') {
    return {
      rawText: text || '',
      digits: [],
      digitString: '',
      cleanSpokenDigitsText: '',
      formattedNumber: '',
      singleDigit: null,
      phonetic: '',
      hasDigits: false,
      confidenceNote: 'No input text detected'
    };
  }

  const normalized = text.toLowerCase().trim();

  // Handle modifier phrases like "double 7" -> "7 7", "triple 0" -> "0 0 0"
  let processedText = expandModifiers(normalized);

  let digitsExtracted = [];

  // Split into token words
  const tokens = processedText.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Case 1: Token is numeric string (e.g. "45", "7")
    if (/^\d+$/.test(token)) {
      const nums = token.split('').map(Number);
      digitsExtracted.push(...nums);
      i++;
      continue;
    }

    // Case 2: Multi-word number sequence (e.g., "three hundred and fifteen")
    const wordNumResult = parseWordNumberSequence(tokens, i);
    if (wordNumResult.parsedLength > 1 && wordNumResult.hasMultiplier) {
      const val = wordNumResult.value;
      digitsExtracted.push(...String(val).split('').map(Number));
      i += wordNumResult.parsedLength;
      continue;
    }

    // Case 3: Check for single digit word
    if (SINGLE_DIGIT_MAP.hasOwnProperty(token)) {
      digitsExtracted.push(SINGLE_DIGIT_MAP[token]);
      i++;
      continue;
    }

    // Case 4: Check for teen number
    if (TEENS.hasOwnProperty(token)) {
      const val = TEENS[token];
      digitsExtracted.push(...String(val).split('').map(Number));
      i++;
      continue;
    }

    // Case 5: Check for tens + units (e.g. "twenty five")
    if (TENS.hasOwnProperty(token)) {
      let val = TENS[token];
      if (i + 1 < tokens.length && SINGLE_DIGIT_MAP.hasOwnProperty(tokens[i + 1])) {
        val += SINGLE_DIGIT_MAP[tokens[i + 1]];
        i++;
      }
      digitsExtracted.push(...String(val).split('').map(Number));
      i++;
      continue;
    }

    // Non-digit word token - ignored / stripped out
    i++;
  }

  const digitString = digitsExtracted.join('');
  const hasDigits = digitsExtracted.length > 0;
  const cleanSpokenDigitsText = hasDigits ? digitsExtracted.join(' ') : '';

  if (mode === 'S') {
    // Single Digit Mode: Take primary digit
    const singleDigit = hasDigits ? digitsExtracted[0] : null;
    const phonetic = singleDigit !== null ? PHONETIC_NAMES[singleDigit] : '';
    
    return {
      rawText: text,
      digits: singleDigit !== null ? [singleDigit] : [],
      digitString: singleDigit !== null ? String(singleDigit) : '',
      cleanSpokenDigitsText: singleDigit !== null ? String(singleDigit) : '',
      formattedNumber: singleDigit !== null ? String(singleDigit) : 'N/A',
      singleDigit,
      phonetic,
      hasDigits: singleDigit !== null,
      confidenceNote: singleDigit !== null ? `Single Digit '${singleDigit}' (${phonetic}) recognized` : 'No digit detected'
    };
  } else {
    // Multiple Digits Mode (M)
    return {
      rawText: text,
      digits: digitsExtracted,
      digitString,
      cleanSpokenDigitsText,
      formattedNumber: digitString ? formatLargeDigitSequence(digitString) : 'N/A',
      singleDigit: hasDigits ? digitsExtracted[0] : null,
      phonetic: hasDigits ? PHONETIC_NAMES[digitsExtracted[0]] : '',
      hasDigits,
      confidenceNote: hasDigits ? `Extracted ${digitsExtracted.length} digit(s): ${cleanSpokenDigitsText}` : 'No digits detected'
    };
  }
}

/**
 * Expand repeat modifier phrases like "double five" -> "five five"
 */
function expandModifiers(text) {
  return text
    .replace(/\bdouble\s+([a-z0-9]+)\b/g, (match, word) => `${word} ${word}`)
    .replace(/\btriple\s+([a-z0-9]+)\b/g, (match, word) => `${word} ${word} ${word}`)
    .replace(/\bquadruple\s+([a-z0-9]+)\b/g, (match, word) => `${word} ${word} ${word} ${word}`);
}

/**
 * Parses word sequences like "one hundred twenty five" into a numeric value
 */
function parseWordNumberSequence(tokens, startIndex) {
  let total = 0;
  let current = 0;
  let idx = startIndex;
  let matched = 0;
  let hasMultiplier = false;

  while (idx < tokens.length) {
    const word = tokens[idx];

    if (word === 'and') {
      idx++;
      matched++;
      continue;
    }

    if (SINGLE_DIGIT_MAP.hasOwnProperty(word)) {
      current += SINGLE_DIGIT_MAP[word];
      idx++;
      matched++;
    } else if (TEENS.hasOwnProperty(word)) {
      current += TEENS[word];
      idx++;
      matched++;
    } else if (TENS.hasOwnProperty(word)) {
      current += TENS[word];
      idx++;
      matched++;
    } else if (MULTIPLIERS.hasOwnProperty(word)) {
      const mult = MULTIPLIERS[word];
      hasMultiplier = true;
      if (mult === 100) {
        current = (current === 0 ? 1 : current) * 100;
      } else {
        total += (current === 0 ? 1 : current) * mult;
        current = 0;
      }
      idx++;
      matched++;
    } else {
      break;
    }
  }

  total += current;

  return {
    value: total,
    parsedLength: total > 0 ? matched : 0,
    hasMultiplier
  };
}

/**
 * Formats a sequence of digit strings for readable output (e.g., adding spaces or commas)
 */
function formatLargeDigitSequence(digitsStr) {
  if (!digitsStr) return '';
  if (digitsStr.length <= 15 && !digitsStr.startsWith('0')) {
    const num = Number(digitsStr);
    if (!isNaN(num)) {
      return num.toLocaleString();
    }
  }
  return digitsStr.replace(/(.{4})/g, '$1 ').trim();
}
