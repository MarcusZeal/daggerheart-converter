/**
 * D&D 3.5e / Pathfinder 1e Stat Block Parser
 * Extracts structured data from 3.5e and PF1e stat blocks
 * Supports: SRD format, Paizo format, PDF text
 *
 * @version 1.0.0
 * @license MIT
 */

const DnD35eParser = (function() {
  'use strict';

  const version = '1.0.0';

  // Regex patterns for 3.5e/PF1e parsing
  const PATTERNS = {
    // Name is first line
    name: /^([A-Z][A-Za-z\s\-',]+)$/m,

    // CR line: "CR 5" or "Challenge Rating 5"
    cr: /(?:CR|Challenge Rating)\s*([\d\/]+)/i,

    // Size, type, alignment: "Large Outsider (Evil, Extraplanar, Lawful)"
    typeInfo: /^(Fine|Diminutive|Tiny|Small|Medium|Large|Huge|Gargantuan|Colossal)\s+(\w+)(?:\s*\(([^)]+)\))?$/im,

    // Hit Dice: "Hit Dice: 8d10+24 (68 hp)"
    hitDice: /Hit Dice:?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*\((\d+)\s*hp\)/i,
    // Alternative HP format
    hp: /(?:hp|Hit Points)\s*(\d+)\s*(?:\(([^)]+)\))?/i,

    // Initiative: "Init +2" or "Initiative +2"
    initiative: /Init(?:iative)?\s*([+-]\d+)/i,

    // Speed: "Speed 30 ft. (6 squares), fly 60 ft."
    speed: /Speed\s*(.+?)(?=\n|$)/i,

    // AC: "AC 18, touch 12, flat-footed 16"
    ac: /AC\s*(\d+)(?:[,;]\s*touch\s*(\d+))?(?:[,;]\s*flat-footed\s*(\d+))?(?:\s*\(([^)]+)\))?/i,

    // Base Attack/Grapple or BAB/CMB: "Base Atk +6; Grp +10" or "BAB +6; CMB +10; CMD 22"
    bab: /Base Atk?\s*\+(\d+)[;,]\s*(?:Grp|Grapple|CMB)\s*\+(\d+)/i,
    cmd: /CMD\s*(\d+)/i,

    // Space/Reach: "Space/Reach 10 ft./10 ft."
    spaceReach: /Space\/Reach\s*(\d+)\s*ft\.?\s*\/\s*(\d+)\s*ft\.?/i,

    // Attack: "Attack Longsword +10 melee (1d8+4/19-20)"
    attack: /Attack\s+(.+?)(?=\n|Full Attack|$)/i,

    // Full Attack: "Full Attack 2 claws +12 melee (1d6+4)"
    fullAttack: /Full Attack\s+(.+?)(?=\n|Space|Special|$)/i,

    // Special Attacks/Qualities
    specialAttacks: /Special Attacks?\s+(.+?)(?=\n|Special Qualities|$)/i,
    specialQualities: /Special Qualit(?:y|ies)\s+(.+?)(?=\n|Saves|$)/i,

    // Saves: "Fort +8, Ref +6, Will +4"
    saves: /(?:Saves?\s+)?Fort\s*([+-]\d+)[,;]\s*Ref\s*([+-]\d+)[,;]\s*Will\s*([+-]\d+)/i,

    // Abilities: "Str 18, Dex 14, Con 16, Int 10, Wis 12, Cha 8"
    abilities: /Str\s*(\d+|-)[,;]\s*Dex\s*(\d+|-)[,;]\s*Con\s*(\d+|-)[,;]\s*Int\s*(\d+|-)[,;]\s*Wis\s*(\d+|-)[,;]\s*Cha\s*(\d+|-)/i,

    // Skills
    skills: /Skills\s+(.+?)(?=\n|Feats|$)/i,

    // Feats
    feats: /Feats\s+(.+?)(?=\n|Environment|Organization|$)/i,

    // Environment
    environment: /Environment\s+(.+?)(?=\n|Organization|$)/i,

    // Languages
    languages: /Languages?\s+(.+?)(?=\n|$)/i,

    // Damage Reduction, Spell Resistance, Regeneration
    dr: /(?:DR|Damage Reduction)\s*(\d+)\/([^,;\n]+)/i,
    sr: /(?:SR|Spell Resistance)\s*(\d+)/i,
    regeneration: /Regeneration\s*(\d+)/i,

    // Attack string parser
    attackString: /([^+]+?)\s*\+(\d+)\s*(melee|ranged)?\s*\(([^)]+)\)/gi,

    // Damage in parentheses: "(1d8+4/19-20)" or "(2d6+6 plus 1d6 fire)"
    damageString: /(\d+d\d+(?:\s*[+-]\s*\d+)?)/,
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

  function getModifier(score) {
    if (score === '-' || score === null) return 0;
    return Math.floor((parseInt(score) - 10) / 2);
  }

  /**
   * Extract name
   */
  function extractName(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      // First non-empty line that isn't a CR line
      for (const line of lines) {
        if (!line.match(/^CR\s/i) && !line.match(/^\d+$/)) {
          return line.trim();
        }
      }
    }
    return 'Unknown Creature';
  }

  /**
   * Extract CR
   */
  function extractCR(text) {
    const match = text.match(PATTERNS.cr);
    if (match) {
      const crString = match[1];
      const CR_VALUES = typeof ParserManager !== 'undefined'
        ? ParserManager.CR_VALUES
        : { '1/8': 0.125, '1/6': 0.167, '1/4': 0.25, '1/3': 0.33, '1/2': 0.5 };
      return {
        string: crString,
        numeric: CR_VALUES[crString] !== undefined ? CR_VALUES[crString] : parseFloat(crString)
      };
    }
    return { string: '1', numeric: 1 };
  }

  /**
   * Extract type info
   */
  function extractTypeInfo(text) {
    const match = text.match(PATTERNS.typeInfo);
    if (match) {
      const subtypes = match[3] ? match[3].split(',').map(s => s.trim()) : [];
      // Try to extract alignment from subtypes
      const alignmentWords = ['lawful', 'chaotic', 'neutral', 'good', 'evil'];
      const alignmentParts = subtypes.filter(s =>
        alignmentWords.some(a => s.toLowerCase().includes(a))
      );
      const otherSubtypes = subtypes.filter(s =>
        !alignmentWords.some(a => s.toLowerCase().includes(a))
      );

      return {
        size: match[1] || 'Medium',
        type: match[2].toLowerCase() || 'creature',
        subtype: otherSubtypes.join(', ') || null,
        alignment: alignmentParts.join(' ').toLowerCase() || null
      };
    }
    return { size: 'Medium', type: 'creature', subtype: null, alignment: null };
  }

  /**
   * Extract HP
   */
  function extractHP(text) {
    const hdMatch = text.match(PATTERNS.hitDice);
    if (hdMatch) {
      return {
        value: parseInt(hdMatch[2]),
        formula: hdMatch[1]
      };
    }

    const hpMatch = text.match(PATTERNS.hp);
    if (hpMatch) {
      return {
        value: parseInt(hpMatch[1]),
        formula: hpMatch[2] || null
      };
    }

    return { value: 10, formula: null };
  }

  /**
   * Extract AC
   */
  function extractAC(text) {
    const match = text.match(PATTERNS.ac);
    if (match) {
      return {
        value: parseInt(match[1]),
        touch: match[2] ? parseInt(match[2]) : null,
        flatFooted: match[3] ? parseInt(match[3]) : null,
        type: match[4] || null
      };
    }
    return { value: 10, touch: 10, flatFooted: 10, type: null };
  }

  /**
   * Extract speed
   */
  function extractSpeed(text) {
    const match = text.match(PATTERNS.speed);
    if (match) {
      const speedText = match[1].trim();
      const speeds = {};

      const walkMatch = speedText.match(/^(\d+)\s*ft/);
      if (walkMatch) speeds.walk = parseInt(walkMatch[1]);

      const flyMatch = speedText.match(/fly\s+(\d+)\s*ft/i);
      if (flyMatch) speeds.fly = parseInt(flyMatch[1]);

      const swimMatch = speedText.match(/swim\s+(\d+)\s*ft/i);
      if (swimMatch) speeds.swim = parseInt(swimMatch[1]);

      const climbMatch = speedText.match(/climb\s+(\d+)\s*ft/i);
      if (climbMatch) speeds.climb = parseInt(climbMatch[1]);

      const burrowMatch = speedText.match(/burrow\s+(\d+)\s*ft/i);
      if (burrowMatch) speeds.burrow = parseInt(burrowMatch[1]);

      return speeds;
    }
    return { walk: 30 };
  }

  /**
   * Extract ability scores
   */
  function extractAbilityScores(text) {
    const match = text.match(PATTERNS.abilities);
    if (match) {
      return {
        str: match[1] === '-' ? 10 : parseInt(match[1]),
        dex: match[2] === '-' ? 10 : parseInt(match[2]),
        con: match[3] === '-' ? 10 : parseInt(match[3]),
        int: match[4] === '-' ? 10 : parseInt(match[4]),
        wis: match[5] === '-' ? 10 : parseInt(match[5]),
        cha: match[6] === '-' ? 10 : parseInt(match[6])
      };
    }
    return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  }

  /**
   * Extract saves
   */
  function extractSaves(text) {
    const match = text.match(PATTERNS.saves);
    if (match) {
      return {
        fort: parseInt(match[1]),
        ref: parseInt(match[2]),
        will: parseInt(match[3])
      };
    }
    return { fort: 0, ref: 0, will: 0 };
  }

  /**
   * Extract skills
   */
  function extractSkills(text) {
    const match = text.match(PATTERNS.skills);
    if (match) {
      const skillText = match[1].trim();
      const skills = {};
      const skillPattern = /([\w\s]+)\s*([+-]\d+)/g;
      let skillMatch;
      while ((skillMatch = skillPattern.exec(skillText)) !== null) {
        const skillName = skillMatch[1].trim().toLowerCase();
        if (skillName && !skillName.match(/^(and|or)$/i)) {
          skills[skillName] = parseInt(skillMatch[2]);
        }
      }
      return skills;
    }
    return {};
  }

  /**
   * Extract special abilities
   */
  function extractSpecialAbilities(text) {
    const attacks = text.match(PATTERNS.specialAttacks);
    const qualities = text.match(PATTERNS.specialQualities);

    return {
      attacks: attacks ? attacks[1].trim().split(/,\s*/).map(a => a.trim()) : [],
      qualities: qualities ? qualities[1].trim().split(/,\s*/).map(q => q.trim()) : []
    };
  }

  /**
   * Extract damage info (DR, SR, immunities, etc.)
   */
  function extractDamageInfo(text) {
    const special = extractSpecialAbilities(text);
    const qualitiesText = special.qualities.join(' ').toLowerCase();

    const resistances = [];
    const immunities = [];

    // Parse from special qualities
    if (qualitiesText.includes('fire resistance')) {
      const match = qualitiesText.match(/fire resistance\s*(\d+)/);
      if (match) resistances.push(`fire ${match[1]}`);
    }
    if (qualitiesText.includes('cold resistance')) {
      const match = qualitiesText.match(/cold resistance\s*(\d+)/);
      if (match) resistances.push(`cold ${match[1]}`);
    }
    if (qualitiesText.includes('immunity to fire')) immunities.push('fire');
    if (qualitiesText.includes('immunity to cold')) immunities.push('cold');
    if (qualitiesText.includes('immunity to poison')) immunities.push('poison');

    const drMatch = text.match(PATTERNS.dr);
    const srMatch = text.match(PATTERNS.sr);

    return {
      resistances: resistances,
      immunities: immunities,
      vulnerabilities: [],
      conditionImmunities: [],
      damageReduction: drMatch ? { value: parseInt(drMatch[1]), bypass: drMatch[2] } : null,
      spellResistance: srMatch ? parseInt(srMatch[1]) : null
    };
  }

  /**
   * Extract senses from special qualities
   */
  function extractSenses(text) {
    const special = extractSpecialAbilities(text);
    const qualitiesText = special.qualities.join(' ').toLowerCase();
    const senses = {};

    if (qualitiesText.includes('darkvision')) {
      const match = qualitiesText.match(/darkvision\s*(\d+)/);
      senses.darkvision = match ? parseInt(match[1]) : 60;
    }
    if (qualitiesText.includes('low-light vision')) {
      senses.lowLightVision = true;
    }
    if (qualitiesText.includes('blindsense')) {
      const match = qualitiesText.match(/blindsense\s*(\d+)/);
      senses.blindsense = match ? parseInt(match[1]) : 30;
    }
    if (qualitiesText.includes('blindsight')) {
      const match = qualitiesText.match(/blindsight\s*(\d+)/);
      senses.blindsight = match ? parseInt(match[1]) : 30;
    }
    if (qualitiesText.includes('tremorsense')) {
      const match = qualitiesText.match(/tremorsense\s*(\d+)/);
      senses.tremorsense = match ? parseInt(match[1]) : 60;
    }
    if (qualitiesText.includes('scent')) {
      senses.scent = true;
    }

    return senses;
  }

  /**
   * Extract languages
   */
  function extractLanguages(text) {
    const match = text.match(PATTERNS.languages);
    if (match) {
      const langText = match[1].trim();
      if (langText.toLowerCase() === '-' || langText.toLowerCase() === 'none') {
        return [];
      }
      return langText.split(/,\s*/).map(l => l.trim()).filter(l => l);
    }
    return [];
  }

  /**
   * Parse attack string into structured data
   */
  function parseAttacks(attackText) {
    if (!attackText) return [];

    const attacks = [];
    // Pattern: "2 claws +12 melee (1d6+4)" or "bite +14 (2d6+6)"
    const attackPattern = /(\d+\s+)?([^+]+?)\s*\+(\d+)\s*(melee|ranged)?\s*\(([^)]+)\)/gi;
    let match;

    while ((match = attackPattern.exec(attackText)) !== null) {
      const count = match[1] ? parseInt(match[1]) : 1;
      const name = match[2].trim();
      const toHit = parseInt(match[3]);
      const type = (match[4] || 'melee').toLowerCase();
      const damageInfo = match[5];

      const damageMatch = damageInfo.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/);
      const damageDice = damageMatch ? damageMatch[1] : '1d4';
      const damageTypeMatch = damageInfo.match(/(slashing|piercing|bludgeoning|fire|cold|acid|electricity|sonic)/i);
      const damageType = damageTypeMatch ? damageTypeMatch[1].toLowerCase() : 'physical';

      attacks.push({
        name: name,
        count: count,
        description: `${type} attack: +${toHit} to hit, ${damageInfo}`,
        isAttack: true,
        attackInfo: {
          type: type,
          toHit: toHit,
          range: type === 'melee' ? '5' : '30',
          damageDice: damageDice,
          damageType: damageType,
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
    return 0;
  }

  /**
   * Convert special abilities to traits
   */
  function parseTraits(text) {
    const special = extractSpecialAbilities(text);
    const traits = [];

    for (const ability of [...special.attacks, ...special.qualities]) {
      if (ability && ability.length > 2) {
        traits.push({
          name: ability,
          description: ability,
          isAttack: false,
          attackInfo: null
        });
      }
    }

    return traits;
  }

  /**
   * Main parse function
   */
  function parse(rawText) {
    const text = normalizeText(rawText);
    const attackMatch = text.match(PATTERNS.attack);
    const fullAttackMatch = text.match(PATTERNS.fullAttack);

    const attacks = parseAttacks(fullAttackMatch ? fullAttackMatch[1] : (attackMatch ? attackMatch[1] : ''));
    const abilityScores = extractAbilityScores(text);

    const parsed = {
      name: extractName(text),
      typeInfo: extractTypeInfo(text),
      ac: extractAC(text),
      hp: extractHP(text),
      speed: extractSpeed(text),
      abilityScores: abilityScores,
      cr: extractCR(text),
      skills: extractSkills(text),
      damageInfo: extractDamageInfo(text),
      senses: extractSenses(text),
      languages: extractLanguages(text),
      saves: extractSaves(text),
      traits: parseTraits(text),
      actions: attacks,
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      lairActions: [],
      raw: { text: text }
    };

    // Add computed modifiers
    parsed.modifiers = {
      str: getModifier(abilityScores.str),
      dex: getModifier(abilityScores.dex),
      con: getModifier(abilityScores.con),
      int: getModifier(abilityScores.int),
      wis: getModifier(abilityScores.wis),
      cha: getModifier(abilityScores.cha)
    };

    // Find primary attack
    if (attacks.length > 0) {
      parsed.primaryAttack = attacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      );
    } else {
      parsed.primaryAttack = null;
    }

    // Check for full attack (similar to multiattack)
    parsed.hasMultiattack = !!fullAttackMatch;
    parsed.multiattackDesc = fullAttackMatch ? fullAttackMatch[1] : null;
    parsed.legendaryActionCount = 0;

    // Check for spellcasting
    parsed.hasSpellcasting = text.toLowerCase().includes('spells') ||
      text.toLowerCase().includes('spell-like') ||
      text.toLowerCase().includes('caster level');

    return parsed;
  }

  // Public API
  const api = {
    parse: parse,
    normalizeText: normalizeText,
    getModifier: getModifier,
    version: version,
    systemId: 'dnd35e'
  };

  // Register with ParserManager if available
  if (typeof ParserManager !== 'undefined') {
    ParserManager.registerParser('dnd35e', api);
  }

  return api;
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DnD35eParser;
}
