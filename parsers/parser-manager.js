/**
 * Parser Manager - Handles system detection and parser routing
 * Provides common utilities for all parsers
 *
 * @version 1.0.0
 * @license MIT
 */

const ParserManager = (function() {
  'use strict';

  // Registry of available parsers
  const parsers = {};

  // System detection patterns
  const SYSTEM_PATTERNS = {
    // Pathfinder 2e - Uses Level instead of CR, has specific action icons/formatting
    pf2e: [
      /Perception\s*\+\d+[;,]/i,                    // "Perception +12;"
      /^Level\s+\d+$/m,                              // "Level 5"
      /\[one-action\]|\[two-actions?\]|\[three-actions?\]|\[reaction\]|\[free-action\]/i,
      /AC\s+\d+[;,]\s*Fort\s*\+\d+/i,               // "AC 22; Fort +15"
      /HP\s+\d+[;,]/i,                               // "HP 75;"
    ],

    // D&D 3.5e / Pathfinder 1e - Uses HD prominently, different stat block format
    dnd35e: [
      /Hit Dice:\s*\d+d\d+/i,                        // "Hit Dice: 4d10+8"
      /Full Attack:/i,                               // "Full Attack:"
      /Base Atk\s*\+\d+/i,                          // "Base Atk +4"
      /Grapple\s*\+\d+/i,                           // "Grapple +8"
      /Space\/Reach:/i,                              // "Space/Reach:"
      /Fort\s*\+\d+,\s*Ref\s*\+\d+,\s*Will\s*\+\d+/i, // "Fort +6, Ref +4, Will +1"
    ],

    // OSR / B/X / Old-School - Uses THAC0 or simple AC, HD-based
    osr: [
      /THAC0\s*\d+/i,                                // "THAC0 15"
      /Morale:\s*\d+/i,                              // "Morale: 8"
      /No\.\s*Appearing:/i,                          // "No. Appearing:"
      /Treasure Type:/i,                             // "Treasure Type:"
      /HD:\s*\d+/i,                                  // "HD: 4"
      /XP Value:\s*\d+/i,                            // "XP Value: 175"
      /Movement:\s*\d+/i,                            // "Movement: 120'"
    ],

    // D&D 4e - Uses roles, at-will/encounter/daily powers
    dnd4e: [
      /\(Standard|Minor|Move|Free|Immediate\s+\w+\)/i,  // "(Standard Action)"
      /At-Will|Encounter|Daily|Recharge/i,               // Power types
      /Level\s+\d+\s+\w+\s+\w+/i,                        // "Level 5 Skirmisher"
      /HP\s+\d+;\s*Bloodied\s+\d+/i,                     // "HP 45; Bloodied 22"
      /Initiative\s*\+\d+/i,                              // "Initiative +5"
    ],

    // D&D 5e - Default fallback (most common)
    dnd5e: [
      /Challenge\s*[\d\/]+\s*\([\d,]+\s*XP\)/i,     // "Challenge 3 (700 XP)"
      /^(?:Armor Class|AC)\s+\d+/im,                 // "Armor Class 15"
      /^(?:Hit Points|HP)\s+\d+\s*\(\d+d/im,        // "Hit Points 52 (8d8"
      /STR\s+\d+\s*\([+-]?\d+\)/i,                  // "STR 16 (+3)"
    ],
  };

  // System display names and info
  const SYSTEM_INFO = {
    dnd5e: { name: 'D&D 5th Edition', shortName: '5e', color: '#c9a227' },
    pf2e: { name: 'Pathfinder 2nd Edition', shortName: 'PF2e', color: '#5d0000' },
    dnd35e: { name: 'D&D 3.5e / Pathfinder 1e', shortName: '3.5e/PF1e', color: '#1e3a5f' },
    osr: { name: 'OSR / B/X / Old-School', shortName: 'OSR', color: '#2d5016' },
    dnd4e: { name: 'D&D 4th Edition', shortName: '4e', color: '#4a1c7a' },
  };

  /**
   * Common text normalization used by all parsers
   */
  function normalizeText(text) {
    return text
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\t/g, ' ')              // Replace tabs with spaces
      .replace(/[ ]+/g, ' ')            // Collapse multiple spaces
      .replace(/\u2014/g, '-')          // Em dash to hyphen
      .replace(/\u2013/g, '-')          // En dash to hyphen
      .replace(/[\u2018\u2019]/g, "'")  // Smart quotes
      .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
      .replace(/\u2019/g, "'")          // Right single quote
      .trim();
  }

  /**
   * Calculate ability modifier (standard D&D formula)
   */
  function getModifier(score) {
    return Math.floor((score - 10) / 2);
  }

  /**
   * Detect which system a stat block is from
   * Returns: { system: 'dnd5e', confidence: 0.85 }
   */
  function detectSystem(text) {
    const normalizedText = normalizeText(text);
    const scores = {};

    // Score each system based on pattern matches
    for (const [system, patterns] of Object.entries(SYSTEM_PATTERNS)) {
      let matches = 0;
      for (const pattern of patterns) {
        if (pattern.test(normalizedText)) {
          matches++;
        }
      }
      scores[system] = matches / patterns.length;
    }

    // Find best match
    let bestSystem = 'dnd5e';
    let bestScore = 0;

    for (const [system, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestSystem = system;
      }
    }

    // If no clear winner, default to 5e
    if (bestScore < 0.2) {
      bestSystem = 'dnd5e';
      bestScore = 0.5; // Low confidence default
    }

    return {
      system: bestSystem,
      confidence: bestScore,
      info: SYSTEM_INFO[bestSystem],
      allScores: scores
    };
  }

  /**
   * Register a parser for a system
   */
  function registerParser(systemId, parser) {
    parsers[systemId] = parser;
  }

  /**
   * Get a parser by system ID
   */
  function getParser(systemId) {
    return parsers[systemId] || parsers['dnd5e'];
  }

  /**
   * Parse a stat block, auto-detecting system if not specified
   */
  function parse(text, options = {}) {
    const systemOverride = options.system;
    let detected = null;

    if (!systemOverride || systemOverride === 'auto') {
      detected = detectSystem(text);
    }

    const system = systemOverride && systemOverride !== 'auto'
      ? systemOverride
      : detected.system;

    const parser = getParser(system);
    if (!parser) {
      throw new Error(`No parser registered for system: ${system}`);
    }

    const result = parser.parse(text);
    result._meta = {
      system: system,
      systemInfo: SYSTEM_INFO[system],
      detected: detected,
      parserVersion: parser.version || '1.0.0'
    };

    return result;
  }

  /**
   * Get list of available systems
   */
  function getAvailableSystems() {
    return Object.entries(SYSTEM_INFO).map(([id, info]) => ({
      id,
      ...info,
      available: !!parsers[id]
    }));
  }

  // Common CR/Level to numeric conversion
  const CR_VALUES = {
    '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
    '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '26': 26,
    '27': 27, '28': 28, '29': 29, '30': 30
  };

  /**
   * Parse a CR string to numeric value
   */
  function parseCR(crString) {
    if (CR_VALUES[crString] !== undefined) {
      return CR_VALUES[crString];
    }
    return parseFloat(crString) || 1;
  }

  // Public API
  return {
    // Core functions
    parse,
    detectSystem,
    registerParser,
    getParser,
    getAvailableSystems,

    // Utilities for parsers
    normalizeText,
    getModifier,
    parseCR,
    CR_VALUES,
    SYSTEM_INFO,

    // Version
    version: '1.0.0'
  };
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParserManager;
}
