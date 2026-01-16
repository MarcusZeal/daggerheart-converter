/**
 * OSR / B/X / Old-School D&D Stat Block Parser
 * Extracts structured data from OSR stat blocks
 * Supports: B/X, BECMI, OSE, Labyrinth Lord, Swords & Wizardry, AD&D 1e/2e
 *
 * @version 1.0.0
 * @license MIT
 */

const OSRParser = (function() {
  'use strict';

  const version = '1.0.0';

  // HD to approximate CR mapping
  // OSR HD roughly maps to CR in modern terms
  const HD_TO_CR = {
    '0': 0, '1/2': 0.5, '1': 1, '1+1': 1, '1+2': 1, '2': 2, '2+1': 2,
    '3': 3, '3+1': 3, '4': 4, '4+1': 4, '5': 5, '5+1': 5, '6': 6,
    '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12, '13': 13,
    '14': 14, '15': 15, '16': 16, '17': 17, '18': 18, '19': 19, '20': 20
  };

  // Regex patterns for OSR parsing
  const PATTERNS = {
    // Name - first line
    name: /^([A-Z][A-Za-z\s\-',]+)$/m,

    // HD: "HD: 4" or "HD 4+2" or "Hit Dice: 4"
    hd: /(?:HD|Hit Dice):?\s*(\d+(?:\+\d+)?|\*+)/i,

    // HP: "hp 18" or "HP: 18"
    hp: /(?:hp|Hit Points):?\s*(\d+)/i,

    // AC: "AC: 5" or "AC 5 [14]" (ascending in brackets) or "Armor Class: 5"
    ac: /(?:AC|Armor Class):?\s*(\d+)(?:\s*\[(\d+)\])?/i,

    // THAC0: "THAC0: 17" or "THAC0 17"
    thac0: /THAC0:?\s*(\d+)/i,

    // Attack Bonus (ascending): "Atk +4" or "Attack Bonus: +4"
    attackBonus: /(?:Atk|Attack(?:\s+Bonus)?):?\s*\+?(\d+)/i,

    // Movement: "MV: 120' (40')" or "Move: 30" or "Movement: 120'"
    movement: /(?:MV|Move(?:ment)?):?\s*(\d+)'?(?:\s*\((\d+)'?\))?/i,

    // Attacks: "Att: 2 claws/1 bite" or "Attacks: 1 (sword)"
    attacks: /(?:Att(?:acks?)?|#AT):?\s*(.+?)(?=\n|Dmg|Damage|$)/i,

    // Damage: "Dmg: 1d6/1d6/2d6" or "Damage: 1d8"
    damage: /(?:Dmg|Damage):?\s*(.+?)(?=\n|Save|SV|$)/i,

    // Save: "SV: F4" or "Save: Fighter 4" or "Save As: F4"
    save: /(?:SV|Save(?:\s+As)?):?\s*(\w+)\s*(\d+)?/i,

    // Morale: "ML: 9" or "Morale: 9"
    morale: /(?:ML|Morale):?\s*(\d+)/i,

    // Alignment: "AL: Chaotic" or "Alignment: Neutral"
    alignment: /(?:AL|Alignment):?\s*(\w+)/i,

    // XP: "XP: 175" or "XP Value: 175"
    xp: /(?:XP|XP Value|Experience):?\s*([\d,]+)/i,

    // Treasure Type: "TT: D" or "Treasure Type: D"
    treasure: /(?:TT|Treasure(?: Type)?):?\s*(\w+)/i,

    // No. Appearing: "NA: 1d6" or "No. Appearing: 2-12"
    numAppearing: /(?:NA|No\.?\s*Appearing):?\s*(.+?)(?=\n|$)/i,

    // Intelligence: "Int: Average" or "Intelligence: Low"
    intelligence: /(?:Int(?:elligence)?):?\s*(\w+)/i,

    // Size
    size: /(?:Size):?\s*(Tiny|Small|Medium|Large|Huge|Gargantuan)/i,

    // Type
    type: /(?:Type):?\s*(\w+)/i,

    // Special abilities section
    special: /(?:Special|SA|Special Abilities):?\s*(.+?)(?=\n\n|$)/is,
  };

  /**
   * Get normalizeText from ParserManager or use local
   */
  function normalizeText(text) {
    if (typeof ParserManager !== 'undefined') {
      return ParserManager.normalizeText(text);
    }
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ ]+/g, ' ')
      .replace(/\u2014/g, '-')
      .replace(/\u2013/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .trim();
  }

  /**
   * Extract name
   */
  function extractName(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      // First line is usually the name
      return lines[0].trim();
    }
    return 'Unknown Creature';
  }

  /**
   * Extract Hit Dice and calculate HP
   */
  function extractHD(text) {
    const hdMatch = text.match(PATTERNS.hd);
    const hpMatch = text.match(PATTERNS.hp);

    let hd = '1';
    let hp = 4;

    if (hdMatch) {
      hd = hdMatch[1];
      // Calculate average HP from HD
      const hdParts = hd.match(/(\d+)(?:\+(\d+))?/);
      if (hdParts) {
        const dice = parseInt(hdParts[1]);
        const bonus = hdParts[2] ? parseInt(hdParts[2]) : 0;
        hp = Math.floor(dice * 4.5) + bonus; // d8 average is 4.5
      }
    }

    if (hpMatch) {
      hp = parseInt(hpMatch[1]);
    }

    return { hd, hp };
  }

  /**
   * Convert HD to approximate CR
   */
  function hdToCR(hd) {
    const hdNum = hd.match(/(\d+)/);
    if (hdNum) {
      const num = parseInt(hdNum[1]);
      return Math.max(0.25, Math.min(20, num));
    }
    return 1;
  }

  /**
   * Extract AC (handle both ascending and descending)
   */
  function extractAC(text) {
    const match = text.match(PATTERNS.ac);
    if (match) {
      const descendingAC = parseInt(match[1]);
      // Check for ascending AC in brackets
      if (match[2]) {
        return { value: parseInt(match[2]), type: 'ascending', descending: descendingAC };
      }
      // If AC is 10 or higher, it's likely ascending already
      // If below 10, convert from descending
      if (descendingAC <= 9) {
        // Convert descending to ascending: ascending = 19 - descending
        return { value: 19 - descendingAC, type: 'converted', descending: descendingAC };
      }
      return { value: descendingAC, type: 'ascending', descending: null };
    }
    return { value: 10, type: null, descending: null };
  }

  /**
   * Extract attack bonus (from THAC0 or direct)
   */
  function extractAttackBonus(text, hd) {
    const atkMatch = text.match(PATTERNS.attackBonus);
    if (atkMatch) {
      return parseInt(atkMatch[1]);
    }

    const thac0Match = text.match(PATTERNS.thac0);
    if (thac0Match) {
      // Convert THAC0 to attack bonus: bonus = 20 - THAC0
      return 20 - parseInt(thac0Match[1]);
    }

    // Default based on HD
    const hdNum = hd.match(/(\d+)/);
    return hdNum ? Math.floor(parseInt(hdNum[1]) / 2) : 0;
  }

  /**
   * Extract movement/speed
   */
  function extractSpeed(text) {
    const match = text.match(PATTERNS.movement);
    if (match) {
      let walk = parseInt(match[1]);
      // If in dungeon format (e.g., 120' with 40' in parens), use the first value
      // Convert to standard 5e-style if needed (OSR often uses 120' = 40 yards = 40 5ft squares)
      if (walk > 100) {
        walk = Math.floor(walk / 3); // Rough conversion from feet per turn to feet per round
      }
      return { walk };
    }
    return { walk: 30 };
  }

  /**
   * Extract alignment
   */
  function extractAlignment(text) {
    const match = text.match(PATTERNS.alignment);
    if (match) {
      const al = match[1].toLowerCase();
      if (al.startsWith('l')) return 'lawful';
      if (al.startsWith('c')) return 'chaotic';
      return 'neutral';
    }
    return 'neutral';
  }

  /**
   * Extract morale
   */
  function extractMorale(text) {
    const match = text.match(PATTERNS.morale);
    return match ? parseInt(match[1]) : 7;
  }

  /**
   * Parse attacks and damage
   */
  function parseAttacks(text) {
    const attacks = [];
    const atkMatch = text.match(PATTERNS.attacks);
    const dmgMatch = text.match(PATTERNS.damage);

    if (!atkMatch && !dmgMatch) {
      // Default melee attack
      attacks.push({
        name: 'Attack',
        description: 'Melee attack',
        isAttack: true,
        attackInfo: {
          type: 'melee',
          toHit: 0,
          range: '5',
          damageDice: '1d6',
          damageType: 'physical',
          avgDamage: 3
        }
      });
      return attacks;
    }

    const attackText = atkMatch ? atkMatch[1].trim() : '';
    const damageText = dmgMatch ? dmgMatch[1].trim() : '';

    // Parse attack count and types
    // Format: "2 claws/1 bite" or "1 (sword)" or "1 weapon"
    const attackParts = attackText.split(/[\/,]/).map(a => a.trim());
    const damageParts = damageText.split(/[\/,]/).map(d => d.trim());

    for (let i = 0; i < Math.max(attackParts.length, 1); i++) {
      const atkPart = attackParts[i] || 'attack';
      const dmgPart = damageParts[i] || damageParts[0] || '1d6';

      // Parse attack name and count
      const countMatch = atkPart.match(/^(\d+)\s*(.+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 1;
      let name = countMatch ? countMatch[2].trim() : atkPart;
      name = name.replace(/[()]/g, '').trim() || 'Attack';

      // Parse damage
      const diceMatch = dmgPart.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/);
      const damageDice = diceMatch ? diceMatch[1] : '1d6';

      attacks.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        description: `${count > 1 ? count + 'x ' : ''}${name}: ${dmgPart}`,
        isAttack: true,
        attackInfo: {
          type: 'melee',
          toHit: 0, // Will be set later
          range: '5',
          damageDice: damageDice,
          damageType: 'physical',
          avgDamage: calculateAvgDamage(damageDice)
        }
      });
    }

    return attacks;
  }

  /**
   * Calculate average damage
   */
  function calculateAvgDamage(diceStr) {
    const match = diceStr.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
    if (match) {
      const numDice = parseInt(match[1]);
      const dieSize = parseInt(match[2]);
      const modifier = match[3] && match[4]
        ? (match[3] === '+' ? parseInt(match[4]) : -parseInt(match[4]))
        : 0;
      return Math.floor(numDice * (dieSize + 1) / 2) + modifier;
    }
    return 3;
  }

  /**
   * Parse special abilities
   */
  function parseSpecialAbilities(text) {
    const match = text.match(PATTERNS.special);
    if (!match) return [];

    const abilities = [];
    const specialText = match[1].trim();

    // Split by common delimiters
    const parts = specialText.split(/[,;]/).map(p => p.trim()).filter(p => p);

    for (const part of parts) {
      if (part.length > 2) {
        abilities.push({
          name: part,
          description: part,
          isAttack: false,
          attackInfo: null
        });
      }
    }

    return abilities;
  }

  /**
   * Extract XP value and estimate CR from it
   */
  function extractXP(text) {
    const match = text.match(PATTERNS.xp);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''));
    }
    return 0;
  }

  /**
   * Determine type info from text
   */
  function extractTypeInfo(text) {
    const sizeMatch = text.match(PATTERNS.size);
    const typeMatch = text.match(PATTERNS.type);
    const alignment = extractAlignment(text);

    // Try to infer type from name/description
    const lowerText = text.toLowerCase();
    let type = 'creature';

    if (lowerText.includes('undead') || lowerText.includes('skeleton') || lowerText.includes('zombie') || lowerText.includes('ghost')) {
      type = 'undead';
    } else if (lowerText.includes('dragon')) {
      type = 'dragon';
    } else if (lowerText.includes('demon') || lowerText.includes('devil')) {
      type = 'fiend';
    } else if (lowerText.includes('elemental')) {
      type = 'elemental';
    } else if (lowerText.includes('giant') || lowerText.includes('ogre') || lowerText.includes('troll')) {
      type = 'giant';
    } else if (lowerText.includes('goblin') || lowerText.includes('orc') || lowerText.includes('kobold') || lowerText.includes('human')) {
      type = 'humanoid';
    } else if (lowerText.includes('animal') || lowerText.includes('beast') || lowerText.includes('bear') || lowerText.includes('wolf')) {
      type = 'beast';
    }

    return {
      size: sizeMatch ? sizeMatch[1] : 'Medium',
      type: typeMatch ? typeMatch[1].toLowerCase() : type,
      subtype: null,
      alignment: alignment
    };
  }

  /**
   * Generate ability scores based on HD and type
   */
  function generateAbilityScores(hd, typeInfo) {
    const hdNum = parseInt(hd.match(/(\d+)/)?.[1] || '1');

    // Base scores modified by HD
    const base = 10 + Math.min(hdNum, 10);

    // Adjust based on type
    let str = base, dex = 10, con = base, int = 10, wis = 10, cha = 10;

    if (typeInfo.type === 'undead') {
      con = 10; // Undead have no Con
      cha = 8;
    } else if (typeInfo.type === 'beast') {
      int = 2;
      wis = 12;
    } else if (typeInfo.type === 'dragon') {
      str = base + 4;
      int = 14;
      cha = 14;
    }

    return { str, dex, con, int, wis, cha };
  }

  /**
   * Main parse function
   */
  function parse(rawText) {
    const text = normalizeText(rawText);
    const hdInfo = extractHD(text);
    const typeInfo = extractTypeInfo(text);
    const ac = extractAC(text);
    const attackBonus = extractAttackBonus(text, hdInfo.hd);
    const attacks = parseAttacks(text);

    // Set attack bonus on all attacks
    for (const attack of attacks) {
      if (attack.attackInfo) {
        attack.attackInfo.toHit = attackBonus;
      }
    }

    const abilityScores = generateAbilityScores(hdInfo.hd, typeInfo);
    const cr = hdToCR(hdInfo.hd);

    const parsed = {
      name: extractName(text),
      typeInfo: typeInfo,
      ac: ac,
      hp: { value: hdInfo.hp, formula: hdInfo.hd + 'd8' },
      speed: extractSpeed(text),
      abilityScores: abilityScores,
      cr: { string: String(Math.floor(cr)), numeric: cr },
      hd: hdInfo.hd,
      skills: {},
      damageInfo: {
        resistances: [],
        immunities: [],
        vulnerabilities: [],
        conditionImmunities: []
      },
      senses: {},
      languages: [],
      morale: extractMorale(text),
      traits: parseSpecialAbilities(text),
      actions: attacks,
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      lairActions: [],
      xp: extractXP(text),
      raw: { text: text }
    };

    // Add computed modifiers
    parsed.modifiers = {
      str: Math.floor((abilityScores.str - 10) / 2),
      dex: Math.floor((abilityScores.dex - 10) / 2),
      con: Math.floor((abilityScores.con - 10) / 2),
      int: Math.floor((abilityScores.int - 10) / 2),
      wis: Math.floor((abilityScores.wis - 10) / 2),
      cha: Math.floor((abilityScores.cha - 10) / 2)
    };

    // Find primary attack
    if (attacks.length > 0) {
      parsed.primaryAttack = attacks.reduce((best, current) =>
        (current.attackInfo?.avgDamage > best.attackInfo?.avgDamage) ? current : best
      );
    } else {
      parsed.primaryAttack = null;
    }

    parsed.hasMultiattack = attacks.length > 1;
    parsed.multiattackDesc = null;
    parsed.legendaryActionCount = 0;
    parsed.hasSpellcasting = text.toLowerCase().includes('spell') ||
      text.toLowerCase().includes('magic');

    return parsed;
  }

  // Public API
  const api = {
    parse: parse,
    normalizeText: normalizeText,
    version: version,
    systemId: 'osr',
    HD_TO_CR: HD_TO_CR
  };

  // Register with ParserManager if available
  if (typeof ParserManager !== 'undefined') {
    ParserManager.registerParser('osr', api);
  }

  return api;
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OSRParser;
}
