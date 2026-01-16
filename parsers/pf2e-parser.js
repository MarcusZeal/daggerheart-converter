/**
 * Pathfinder 2e Stat Block Parser
 * Extracts structured data from Pathfinder 2nd Edition stat blocks
 * Supports: Archives of Nethys, PDF text, Foundry VTT export
 *
 * @version 1.0.0
 * @license MIT
 */

const PF2eParser = (function() {
  'use strict';

  const version = '1.0.0';

  // PF2e Level to CR approximation (for Daggerheart conversion)
  // PF2e levels roughly map: Level -1 to 0 = CR 1/4-1, Level 1-4 = CR 1-4, etc.
  const LEVEL_TO_CR = {
    '-1': 0.25, '0': 0.5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, '11': 11, '12': 12,
    '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
    '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25
  };

  // Regex patterns for PF2e parsing
  const PATTERNS = {
    // Name and level: "Bearded Devil" followed by "Creature 5"
    name: /^([A-Z][A-Za-z\s\-']+?)(?:\s+Creature\s+(-?\d+))?$/m,
    level: /(?:Creature|Level)\s+(-?\d+)/i,

    // Traits line: "[Uncommon] [Devil] [Fiend] [Lawful] [Evil]"
    traits: /\[([\w\s]+)\]/g,
    traitLine: /^(?:\[[\w\s]+\]\s*)+$/m,

    // Perception: "Perception +13; greater darkvision"
    perception: /Perception\s*\+(\d+)(?:[;,]\s*(.+?))?(?=\n|$)/i,

    // Languages: "Languages Celestial, Draconic, Infernal; telepathy 100 feet"
    languages: /Languages\s+(.+?)(?=\n|Skills|$)/i,

    // Skills: "Skills Athletics +12, Intimidation +11, Religion +11"
    skills: /Skills\s+(.+?)(?=\n|Str|$)/i,

    // Ability scores: "Str +4, Dex +2, Con +4, Int +0, Wis +2, Cha +1"
    abilityMods: /Str\s*([+-]\d+),?\s*Dex\s*([+-]\d+),?\s*Con\s*([+-]\d+),?\s*Int\s*([+-]\d+),?\s*Wis\s*([+-]\d+),?\s*Cha\s*([+-]\d+)/i,

    // AC, Saves: "AC 22; Fort +15, Ref +11, Will +13"
    acSaves: /AC\s+(\d+)(?:\s*\(([^)]+)\))?[;,]\s*Fort\s*\+(\d+),?\s*Ref\s*\+(\d+),?\s*Will\s*\+(\d+)/i,

    // HP: "HP 75;" or "HP 75; Immunities fire; Weaknesses good 5"
    hp: /HP\s+(\d+)(?:\s*\(([^)]+)\))?(?:[;,]|$)/i,

    // Immunities, Resistances, Weaknesses
    immunities: /Immunities?\s+([^;]+?)(?=;|Resistances?|Weaknesses?|$)/i,
    resistances: /Resistances?\s+([^;]+?)(?=;|Weaknesses?|$)/i,
    weaknesses: /Weaknesses?\s+([^;]+?)(?=;|$)/i,

    // Speed: "Speed 35 feet, fly 35 feet"
    speed: /Speed\s+(.+?)(?=\n|$)/i,

    // Melee/Ranged Strikes: "Melee [one-action] glaive +14 (deadly d8, forceful, reach 10 feet), Damage 1d8+7 slashing"
    strike: /(?:Melee|Ranged)\s*(?:\[[\w-]+\])?\s*(.+?)\s*\+(\d+)\s*(?:\(([^)]+)\))?,?\s*(?:Damage\s*)?(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(\w+)/gi,

    // Action patterns with icons
    actionIcons: /\[(one-action|two-actions?|three-actions?|reaction|free-action)\]/gi,

    // Special abilities section markers
    abilities: /^([A-Z][^.]+?)\s*(?:\[[\w-]+\])?\s*(?:\(([^)]+)\))?\s*(.+?)$/gm,
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
   * Convert PF2e modifier to ability score (reverse of standard formula)
   */
  function modToScore(mod) {
    return (mod * 2) + 10;
  }

  /**
   * Extract name from stat block
   */
  function extractName(text) {
    const lines = text.split('\n').filter(l => l.trim());
    // Skip trait lines (lines with [brackets])
    for (const line of lines) {
      if (!line.match(/^\[/) && !line.match(/^Creature\s+\d+/i)) {
        return line.trim().replace(/\s+Creature\s+(-?\d+)$/i, '');
      }
    }
    return 'Unknown Creature';
  }

  /**
   * Extract level
   */
  function extractLevel(text) {
    const match = text.match(PATTERNS.level);
    if (match) {
      const level = parseInt(match[1]);
      return {
        level: level,
        cr: LEVEL_TO_CR[match[1]] !== undefined ? LEVEL_TO_CR[match[1]] : Math.max(0, level)
      };
    }
    return { level: 1, cr: 1 };
  }

  /**
   * Extract traits (creature types, alignments, etc.)
   */
  function extractTraits(text) {
    const traits = [];
    let match;
    const pattern = /\[([\w\s]+)\]/g;
    while ((match = pattern.exec(text)) !== null) {
      // Skip action icons
      if (!match[1].match(/action|reaction|free/i)) {
        traits.push(match[1].trim());
      }
    }
    return traits;
  }

  /**
   * Determine size and type from traits
   */
  function extractTypeInfo(traits) {
    const sizes = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    const alignments = ['Lawful', 'Chaotic', 'Neutral', 'Good', 'Evil', 'LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'];
    const creatureTypes = ['Aberration', 'Animal', 'Astral', 'Beast', 'Celestial', 'Construct',
      'Dragon', 'Elemental', 'Ethereal', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monitor',
      'Ooze', 'Plant', 'Spirit', 'Undead', 'Devil', 'Demon', 'Daemon'];

    let size = 'Medium';
    let type = 'creature';
    let subtype = null;
    let alignment = null;

    for (const trait of traits) {
      const lowerTrait = trait.toLowerCase();

      if (sizes.some(s => s.toLowerCase() === lowerTrait)) {
        size = trait;
      } else if (creatureTypes.some(t => lowerTrait.includes(t.toLowerCase()))) {
        type = trait.toLowerCase();
      } else if (alignments.some(a => a.toLowerCase() === lowerTrait)) {
        alignment = alignment ? `${alignment} ${trait.toLowerCase()}` : trait.toLowerCase();
      }
    }

    return { size, type, subtype, alignment };
  }

  /**
   * Extract AC and saves
   */
  function extractDefenses(text) {
    const match = text.match(PATTERNS.acSaves);
    if (match) {
      return {
        ac: { value: parseInt(match[1]), type: match[2] || null },
        fort: parseInt(match[3]),
        ref: parseInt(match[4]),
        will: parseInt(match[5])
      };
    }
    return {
      ac: { value: 10, type: null },
      fort: 0, ref: 0, will: 0
    };
  }

  /**
   * Extract HP
   */
  function extractHP(text) {
    const match = text.match(PATTERNS.hp);
    if (match) {
      return {
        value: parseInt(match[1]),
        formula: match[2] || null
      };
    }
    return { value: 10, formula: null };
  }

  /**
   * Extract immunities, resistances, weaknesses
   */
  function extractDamageInfo(text) {
    const immuneMatch = text.match(PATTERNS.immunities);
    const resistMatch = text.match(PATTERNS.resistances);
    const weakMatch = text.match(PATTERNS.weaknesses);

    return {
      immunities: immuneMatch ? immuneMatch[1].trim().split(/,\s*/) : [],
      resistances: resistMatch ? resistMatch[1].trim().split(/,\s*/) : [],
      vulnerabilities: weakMatch ? weakMatch[1].trim().split(/,\s*/) : [],
      conditionImmunities: []
    };
  }

  /**
   * Extract perception
   */
  function extractPerception(text) {
    const match = text.match(PATTERNS.perception);
    if (match) {
      return {
        bonus: parseInt(match[1]),
        senses: match[2] ? match[2].trim() : null
      };
    }
    return { bonus: 0, senses: null };
  }

  /**
   * Extract senses from perception line
   */
  function extractSenses(text) {
    const perception = extractPerception(text);
    const senses = {};

    if (perception.senses) {
      const senseText = perception.senses;

      const darkMatch = senseText.match(/(?:greater\s+)?darkvision/i);
      if (darkMatch) senses.darkvision = darkMatch[0].includes('greater') ? 120 : 60;

      const lowLightMatch = senseText.match(/low-light vision/i);
      if (lowLightMatch) senses.lowLightVision = true;

      const tremMatch = senseText.match(/tremorsense\s*(\d+)/i);
      if (tremMatch) senses.tremorsense = parseInt(tremMatch[1]);

      const scentMatch = senseText.match(/scent\s*\(?(?:imprecise\s*)?(\d+)/i);
      if (scentMatch) senses.scent = parseInt(scentMatch[1]);
    }

    senses.passivePerception = 10 + perception.bonus;
    return senses;
  }

  /**
   * Extract speed
   */
  function extractSpeed(text) {
    const match = text.match(PATTERNS.speed);
    if (match) {
      const speedText = match[1].trim();
      const speeds = {};

      const walkMatch = speedText.match(/^(\d+)\s*feet/);
      if (walkMatch) speeds.walk = parseInt(walkMatch[1]);

      const flyMatch = speedText.match(/fly\s+(\d+)\s*feet/i);
      if (flyMatch) speeds.fly = parseInt(flyMatch[1]);

      const swimMatch = speedText.match(/swim\s+(\d+)\s*feet/i);
      if (swimMatch) speeds.swim = parseInt(swimMatch[1]);

      const climbMatch = speedText.match(/climb\s+(\d+)\s*feet/i);
      if (climbMatch) speeds.climb = parseInt(climbMatch[1]);

      const burrowMatch = speedText.match(/burrow\s+(\d+)\s*feet/i);
      if (burrowMatch) speeds.burrow = parseInt(burrowMatch[1]);

      return speeds;
    }
    return { walk: 25 };
  }

  /**
   * Extract ability modifiers and convert to scores
   */
  function extractAbilityScores(text) {
    const match = text.match(PATTERNS.abilityMods);
    if (match) {
      return {
        str: modToScore(parseInt(match[1])),
        dex: modToScore(parseInt(match[2])),
        con: modToScore(parseInt(match[3])),
        int: modToScore(parseInt(match[4])),
        wis: modToScore(parseInt(match[5])),
        cha: modToScore(parseInt(match[6]))
      };
    }
    return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  }

  /**
   * Extract skills
   */
  function extractSkills(text) {
    const match = text.match(PATTERNS.skills);
    if (match) {
      const skillText = match[1].trim();
      const skills = {};
      const skillPattern = /([\w\s]+)\s*\+(\d+)/g;
      let skillMatch;
      while ((skillMatch = skillPattern.exec(skillText)) !== null) {
        skills[skillMatch[1].trim().toLowerCase()] = parseInt(skillMatch[2]);
      }
      return skills;
    }
    return {};
  }

  /**
   * Extract languages
   */
  function extractLanguages(text) {
    const match = text.match(PATTERNS.languages);
    if (match) {
      const langText = match[1].trim();
      // Remove telepathy part if present
      const cleanedLang = langText.replace(/;\s*telepathy.*/i, '');
      if (cleanedLang.toLowerCase() === '-' || cleanedLang.toLowerCase() === 'none') {
        return [];
      }
      return cleanedLang.split(/,\s*/).map(l => l.trim()).filter(l => l);
    }
    return [];
  }

  /**
   * Parse strikes (melee/ranged attacks)
   */
  function parseStrikes(text) {
    const strikes = [];
    const strikePattern = /(Melee|Ranged)\s*(?:\[[\w-]+\])?\s*([^+]+?)\s*\+(\d+)\s*(?:\(([^)]+)\))?,?\s*(?:Damage\s*)?(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(\w+)/gi;
    let match;

    while ((match = strikePattern.exec(text)) !== null) {
      const traits = match[4] ? match[4].split(',').map(t => t.trim()) : [];
      const reachMatch = traits.find(t => t.match(/reach\s+\d+/i));
      const rangeMatch = traits.find(t => t.match(/range\s+\d+/i));

      strikes.push({
        name: match[2].trim(),
        type: match[1].toLowerCase(),
        toHit: parseInt(match[3]),
        traits: traits,
        range: reachMatch ? reachMatch.match(/\d+/)[0] : (rangeMatch ? rangeMatch.match(/\d+/)[0] : '5'),
        damageDice: match[5],
        damageType: match[6].toLowerCase(),
        isAttack: true,
        attackInfo: {
          type: match[1].toLowerCase(),
          toHit: parseInt(match[3]),
          range: reachMatch ? reachMatch.match(/\d+/)[0] : (rangeMatch ? rangeMatch.match(/\d+/)[0] : '5'),
          damageDice: match[5],
          damageType: match[6].toLowerCase(),
          avgDamage: calculateAvgDamage(match[5])
        }
      });
    }

    return strikes;
  }

  /**
   * Calculate average damage from dice string
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
    return 0;
  }

  /**
   * Parse abilities/actions from text
   */
  function parseAbilities(text, startMarker, endMarkers) {
    const abilities = [];

    // Find section boundaries
    let startIdx = 0;
    if (startMarker) {
      const startMatch = text.search(startMarker);
      if (startMatch >= 0) startIdx = startMatch;
    }

    let endIdx = text.length;
    for (const endMarker of endMarkers || []) {
      const endMatch = text.substring(startIdx + 10).search(endMarker);
      if (endMatch >= 0 && endMatch + startIdx + 10 < endIdx) {
        endIdx = endMatch + startIdx + 10;
      }
    }

    const section = text.substring(startIdx, endIdx);

    // Parse abilities with action costs
    const abilityPattern = /^([A-Z][^(\n]+?)(?:\s*\[([\w-]+)\])?\s*(?:\(([^)]+)\))?\s*(.+?)(?=\n[A-Z]|\n\n|$)/gms;
    let match;

    while ((match = abilityPattern.exec(section)) !== null) {
      const name = match[1].trim();
      // Skip section headers and strikes
      if (name.match(/^(Melee|Ranged|Speed|AC|HP|Fort|Str|Skills|Languages|Perception)/i)) continue;

      const actionCost = match[2] || null;
      const traits = match[3] ? match[3].split(',').map(t => t.trim()) : [];
      const desc = match[4].trim().replace(/\n/g, ' ');

      abilities.push({
        name: name,
        description: desc,
        actionCost: actionCost,
        traits: traits,
        isAttack: false,
        attackInfo: null
      });
    }

    return abilities;
  }

  /**
   * Main parse function
   */
  function parse(rawText) {
    const text = normalizeText(rawText);
    const traits = extractTraits(text);
    const levelInfo = extractLevel(text);
    const defenses = extractDefenses(text);
    const strikes = parseStrikes(text);

    const parsed = {
      name: extractName(text),
      typeInfo: extractTypeInfo(traits),
      ac: defenses.ac,
      hp: extractHP(text),
      speed: extractSpeed(text),
      abilityScores: extractAbilityScores(text),
      cr: { string: String(levelInfo.level), numeric: levelInfo.cr },
      level: levelInfo.level,
      skills: extractSkills(text),
      damageInfo: extractDamageInfo(text),
      senses: extractSenses(text),
      languages: extractLanguages(text),
      saves: {
        fort: defenses.fort,
        ref: defenses.ref,
        will: defenses.will
      },
      traits: parseAbilities(text, null, [/^Speed\s/im]),
      actions: strikes,
      bonusActions: [], // PF2e doesn't have bonus actions (uses action economy)
      reactions: parseAbilities(text, /Reaction/i, [/\n\n/]),
      legendaryActions: [], // PF2e uses different mechanics
      lairActions: [],
      pf2eTraits: traits,
      raw: { text: text }
    };

    // Add computed modifiers
    parsed.modifiers = {
      str: Math.floor((parsed.abilityScores.str - 10) / 2),
      dex: Math.floor((parsed.abilityScores.dex - 10) / 2),
      con: Math.floor((parsed.abilityScores.con - 10) / 2),
      int: Math.floor((parsed.abilityScores.int - 10) / 2),
      wis: Math.floor((parsed.abilityScores.wis - 10) / 2),
      cha: Math.floor((parsed.abilityScores.cha - 10) / 2)
    };

    // Find primary attack
    if (strikes.length > 0) {
      parsed.primaryAttack = strikes.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      );
    } else {
      parsed.primaryAttack = null;
    }

    // PF2e doesn't have traditional multiattack
    parsed.hasMultiattack = strikes.length > 1;
    parsed.multiattackDesc = null;
    parsed.legendaryActionCount = 0;
    parsed.hasSpellcasting = text.toLowerCase().includes('spellcasting') ||
      text.toLowerCase().includes('innate') ||
      text.toLowerCase().includes('focus spells');

    return parsed;
  }

  // Public API
  const api = {
    parse: parse,
    normalizeText: normalizeText,
    version: version,
    systemId: 'pf2e',
    LEVEL_TO_CR: LEVEL_TO_CR
  };

  // Register with ParserManager if available
  if (typeof ParserManager !== 'undefined') {
    ParserManager.registerParser('pf2e', api);
  }

  return api;
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PF2eParser;
}
