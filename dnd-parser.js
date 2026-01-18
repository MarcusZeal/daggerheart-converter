/**
 * D&D 5e Stat Block Parser
 * Extracts structured data from pasted D&D 5e stat blocks
 * Supports: Classic 5e, 5e 2024, D&D Beyond, PDF text
 *
 * @version 1.0.0
 * @license MIT
 */

const DnDParser = (function() {
  'use strict';

  // Regex patterns for parsing
  const PATTERNS = {
    // Name is typically the first non-empty line
    name: /^([A-Z][A-Za-z\s\-']+)$/m,

    // Size, type, alignment: "Medium fiend (devil), lawful evil"
    typeInfo: /^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(\w+)(?:\s*\(([^)]+)\))?(?:,\s*(.+))?$/im,

    // Armor Class: "AC 13" or "Armor Class 13 (natural armor)"
    ac: /(?:Armor Class|AC)\s*(\d+)(?:\s*\(([^)]+)\))?/i,

    // Hit Points: "HP 52 (8d8 + 16)" or "Hit Points 52 (8d8+16)"
    hp: /(?:Hit Points|HP)\s*(\d+)(?:\s*\(([^)]+)\))?/i,

    // Speed: "Speed 30 ft." or "30 ft., fly 60 ft."
    speed: /Speed\s*(.+?)(?=\n|$)/i,

    // Ability scores - multiple formats
    // Format 1: "STR 16 (+3) DEX 15 (+2)..."
    // Format 2: "STR DEX CON INT WIS CHA\n16 15 15 9 11 11"
    abilityScores: /STR\s+(\d+)\s*(?:\([+-]?\d+\))?\s*DEX\s+(\d+)\s*(?:\([+-]?\d+\))?\s*CON\s+(\d+)\s*(?:\([+-]?\d+\))?\s*INT\s+(\d+)\s*(?:\([+-]?\d+\))?\s*WIS\s+(\d+)\s*(?:\([+-]?\d+\))?\s*CHA\s+(\d+)/i,
    abilityScoresAlt: /STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\s*\n\s*(\d+)\s*(?:\([+-]?\d+\))?\s*(\d+)\s*(?:\([+-]?\d+\))?\s*(\d+)\s*(?:\([+-]?\d+\))?\s*(\d+)\s*(?:\([+-]?\d+\))?\s*(\d+)\s*(?:\([+-]?\d+\))?\s*(\d+)/i,

    // Challenge Rating: "CR 3" or "Challenge 3 (700 XP)"
    cr: /(?:Challenge|CR)\s*([\d\/]+)(?:\s*\([\d,]+\s*XP\))?/i,

    // Proficiency Bonus: "PB +2" or "Proficiency Bonus +2"
    pb: /(?:Proficiency Bonus|PB)\s*\+?(\d+)/i,

    // Skills: "Skills Perception +5, Stealth +4"
    skills: /Skills\s+(.+?)(?=\n|Senses|$)/i,

    // Damage Resistances/Immunities/Vulnerabilities
    damageResist: /Damage Resistances?\s+(.+?)(?=\n|Damage|Condition|$)/i,
    damageImmune: /Damage Immunit(?:y|ies)\s+(.+?)(?=\n|Damage|Condition|$)/i,
    damageVuln: /Damage Vulnerabilit(?:y|ies)\s+(.+?)(?=\n|Damage|Condition|$)/i,

    // Condition Immunities
    conditionImmune: /Condition Immunit(?:y|ies)\s+(.+?)(?=\n|Senses|$)/i,

    // Senses: "Senses darkvision 60 ft., passive Perception 15"
    senses: /Senses\s+(.+?)(?=\n|Languages|$)/i,

    // Languages
    languages: /Languages\s+(.+?)(?=\n|Challenge|CR|$)/i,

    // Section headers
    traits: /^(?:Traits?|Special Abilities)\s*$/im,
    actions: /^Actions?\s*$/im,
    bonusActions: /^Bonus Actions?\s*$/im,
    reactions: /^Reactions?\s*$/im,
    legendaryActions: /^Legendary Actions?\s*$/im,
    lairActions: /^Lair Actions?\s*$/im,

    // Attack pattern: "Bite. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) piercing damage"
    attack: /^(.+?)\.\s*(?:(Melee|Ranged)\s+(?:Weapon|Spell)\s+Attack:)\s*\+(\d+)\s+to hit,\s*(?:reach|range)\s*([\d\/]+)\s*ft\.?,?\s*(?:one|[^.]+)?\s*(?:target|creature)?[^.]*\.\s*Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/i,

    // Multiattack pattern
    multiattack: /Multiattack\.\s*(.+?)(?=\n\n|\n[A-Z]|$)/is,

    // Generic ability/trait pattern
    ability: /^([A-Z][^.]+)\.\s*(.+?)(?=\n[A-Z]|\n\n|$)/gms,

    // Spellcasting
    spellcasting: /Spellcasting\.\s*(.+?)(?=\n\n[A-Z]|Actions|$)/is,
    innateSpellcasting: /Innate Spellcasting\.\s*(.+?)(?=\n\n[A-Z]|Actions|$)/is,

    // Legendary action description
    legendaryDesc: /can take (\d+) legendary actions/i,

    // Damage dice pattern
    damageDice: /(\d+d\d+(?:\s*[+-]\s*\d+)?)/i,
  };

  // CR to numeric value mapping
  const CR_VALUES = {
    '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
    '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
    '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '26': 26,
    '27': 27, '28': 28, '29': 29, '30': 30
  };

  /**
   * Clean and normalize input text
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
      .trim();
  }

  /**
   * Extract name from stat block
   */
  function extractName(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      // First non-empty line is usually the name
      return lines[0].trim();
    }
    return 'Unknown Creature';
  }

  /**
   * Extract type information (size, type, subtype, alignment)
   */
  function extractTypeInfo(text) {
    const match = text.match(PATTERNS.typeInfo);
    if (match) {
      return {
        size: match[1] || 'Medium',
        type: match[2] || 'creature',
        subtype: match[3] || null,
        alignment: match[4] || null
      };
    }
    return { size: 'Medium', type: 'creature', subtype: null, alignment: null };
  }

  /**
   * Extract AC
   */
  function extractAC(text) {
    const match = text.match(PATTERNS.ac);
    if (match) {
      return {
        value: parseInt(match[1]),
        type: match[2] || null
      };
    }
    return { value: 10, type: null };
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
   * Extract Speed
   */
  function extractSpeed(text) {
    const match = text.match(PATTERNS.speed);
    if (match) {
      const speedText = match[1].trim();
      const speeds = {};

      // Parse different movement types
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
    let match = text.match(PATTERNS.abilityScores);
    if (!match) {
      match = text.match(PATTERNS.abilityScoresAlt);
    }

    if (match) {
      return {
        str: parseInt(match[1]),
        dex: parseInt(match[2]),
        con: parseInt(match[3]),
        int: parseInt(match[4]),
        wis: parseInt(match[5]),
        cha: parseInt(match[6])
      };
    }
    return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  }

  /**
   * Calculate ability modifier
   */
  function getModifier(score) {
    return Math.floor((score - 10) / 2);
  }

  /**
   * Extract Challenge Rating
   */
  function extractCR(text) {
    const match = text.match(PATTERNS.cr);
    if (match) {
      const crString = match[1];
      return {
        string: crString,
        numeric: CR_VALUES[crString] !== undefined ? CR_VALUES[crString] : parseFloat(crString)
      };
    }
    return { string: '1', numeric: 1 };
  }

  /**
   * Extract skills
   */
  function extractSkills(text) {
    const match = text.match(PATTERNS.skills);
    if (match) {
      const skillText = match[1].trim();
      const skills = {};
      const skillPattern = /(\w+(?:\s+\w+)?)\s*\+(\d+)/g;
      let skillMatch;
      while ((skillMatch = skillPattern.exec(skillText)) !== null) {
        skills[skillMatch[1].toLowerCase()] = parseInt(skillMatch[2]);
      }
      return skills;
    }
    return {};
  }

  /**
   * Extract damage resistances/immunities/vulnerabilities
   */
  function extractDamageInfo(text) {
    const resistMatch = text.match(PATTERNS.damageResist);
    const immuneMatch = text.match(PATTERNS.damageImmune);
    const vulnMatch = text.match(PATTERNS.damageVuln);
    const conditionMatch = text.match(PATTERNS.conditionImmune);

    return {
      resistances: resistMatch ? resistMatch[1].trim().split(/,\s*/) : [],
      immunities: immuneMatch ? immuneMatch[1].trim().split(/,\s*/) : [],
      vulnerabilities: vulnMatch ? vulnMatch[1].trim().split(/,\s*/) : [],
      conditionImmunities: conditionMatch ? conditionMatch[1].trim().split(/,\s*/) : []
    };
  }

  /**
   * Extract senses
   */
  function extractSenses(text) {
    const match = text.match(PATTERNS.senses);
    if (match) {
      const senseText = match[1].trim();
      const senses = {};

      const darkMatch = senseText.match(/darkvision\s+(\d+)\s*ft/i);
      if (darkMatch) senses.darkvision = parseInt(darkMatch[1]);

      const blindMatch = senseText.match(/blindsight\s+(\d+)\s*ft/i);
      if (blindMatch) senses.blindsight = parseInt(blindMatch[1]);

      const trueMatch = senseText.match(/truesight\s+(\d+)\s*ft/i);
      if (trueMatch) senses.truesight = parseInt(trueMatch[1]);

      const tremMatch = senseText.match(/tremorsense\s+(\d+)\s*ft/i);
      if (tremMatch) senses.tremorsense = parseInt(tremMatch[1]);

      const passiveMatch = senseText.match(/passive Perception\s+(\d+)/i);
      if (passiveMatch) senses.passivePerception = parseInt(passiveMatch[1]);

      return senses;
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
      if (langText.toLowerCase() === '-' || langText.toLowerCase() === 'none') {
        return [];
      }
      return langText.split(/,\s*/);
    }
    return [];
  }

  /**
   * Split text into sections (Traits, Actions, Reactions, etc.)
   */
  function splitIntoSections(text) {
    const sections = {
      traits: '',
      actions: '',
      bonusActions: '',
      reactions: '',
      legendaryActions: '',
      lairActions: ''
    };

    // Find section boundaries
    const actionIndex = text.search(/\n\s*Actions?\s*\n/i);
    const bonusIndex = text.search(/\n\s*Bonus Actions?\s*\n/i);
    const reactionIndex = text.search(/\n\s*Reactions?\s*\n/i);
    const legendaryIndex = text.search(/\n\s*Legendary Actions?\s*\n/i);
    const lairIndex = text.search(/\n\s*Lair Actions?\s*\n/i);

    // Find where stat block header ends (after CR line typically)
    const crMatch = text.match(PATTERNS.cr);
    let headerEnd = 0;
    if (crMatch) {
      headerEnd = text.indexOf(crMatch[0]) + crMatch[0].length;
    }

    // Determine section boundaries
    const indices = [
      { name: 'traits', start: headerEnd, end: Infinity },
      { name: 'actions', start: actionIndex, end: Infinity },
      { name: 'bonusActions', start: bonusIndex, end: Infinity },
      { name: 'reactions', start: reactionIndex, end: Infinity },
      { name: 'legendaryActions', start: legendaryIndex, end: Infinity },
      { name: 'lairActions', start: lairIndex, end: Infinity }
    ].filter(s => s.start >= 0).sort((a, b) => a.start - b.start);

    // Set end boundaries
    for (let i = 0; i < indices.length; i++) {
      if (i + 1 < indices.length) {
        indices[i].end = indices[i + 1].start;
      } else {
        indices[i].end = text.length;
      }
    }

    // Extract section content
    for (const section of indices) {
      let content = text.substring(section.start, section.end).trim();
      // Remove section header
      content = content.replace(/^(?:Traits?|Actions?|Bonus Actions?|Reactions?|Legendary Actions?|Lair Actions?)\s*/i, '');
      sections[section.name] = content.trim();
    }

    return sections;
  }

  /**
   * Strip legendary action boilerplate intro text
   * Removes: "The X can take Y legendary actions, choosing from the options below..."
   */
  function stripLegendaryBoilerplate(text) {
    if (!text) return text;

    let cleaned = text;

    // Remove any sentence containing "can take" and "legendary action" (the intro sentence)
    cleaned = cleaned.replace(/[^.]*can take \d+ legendary action[^.]*\.\s*/gi, '');

    // Remove "Only one legendary action" sentence
    cleaned = cleaned.replace(/[^.]*only one legendary action[^.]*\.\s*/gi, '');

    // Remove "regains spent legendary actions" sentence
    cleaned = cleaned.replace(/[^.]*regains spent legendary action[^.]*\.\s*/gi, '');

    // Remove any remaining "choosing from the options" fragments
    cleaned = cleaned.replace(/[^.]*choosing from the options[^.]*\.\s*/gi, '');

    return cleaned.trim();
  }

  /**
   * Parse abilities/traits from a section
   */
  function parseAbilities(sectionText) {
    if (!sectionText) return [];

    const abilities = [];

    // Match ability patterns: "Ability Name. Description text..."
    const abilityPattern = /^([A-Z][^.]+)\.\s*(.+?)(?=\n[A-Z][^.]+\.|$)/gms;
    let match;

    while ((match = abilityPattern.exec(sectionText)) !== null) {
      const name = match[1].trim();
      const desc = match[2].trim().replace(/\n/g, ' ');

      abilities.push({
        name: name,
        description: desc,
        isAttack: isAttackAction(desc),
        attackInfo: parseAttackInfo(desc)
      });
    }

    return abilities;
  }

  /**
   * Check if an ability is an attack action
   */
  function isAttackAction(desc) {
    return /(?:Melee|Ranged)\s+(?:Weapon|Spell)\s+Attack/i.test(desc);
  }

  /**
   * Parse attack information from description
   */
  function parseAttackInfo(desc) {
    const attackMatch = desc.match(/(?:(Melee|Ranged)\s+(?:Weapon|Spell)\s+Attack:)\s*\+(\d+)\s+to hit,\s*(?:reach|range)\s*([\d\/]+)\s*ft/i);
    const damageMatch = desc.match(/Hit:\s*(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/i);

    if (attackMatch) {
      return {
        type: attackMatch[1].toLowerCase(),
        toHit: parseInt(attackMatch[2]),
        range: attackMatch[3],
        avgDamage: damageMatch ? parseInt(damageMatch[1]) : 0,
        damageDice: damageMatch ? damageMatch[2] : null,
        damageType: damageMatch ? damageMatch[3].toLowerCase() : null
      };
    }
    return null;
  }

  /**
   * Main parse function - entry point
   */
  function parse(rawText) {
    const text = normalizeText(rawText);
    const sections = splitIntoSections(text);

    const parsed = {
      name: extractName(text),
      typeInfo: extractTypeInfo(text),
      ac: extractAC(text),
      hp: extractHP(text),
      speed: extractSpeed(text),
      abilityScores: extractAbilityScores(text),
      cr: extractCR(text),
      skills: extractSkills(text),
      damageInfo: extractDamageInfo(text),
      senses: extractSenses(text),
      languages: extractLanguages(text),
      traits: parseAbilities(sections.traits),
      actions: parseAbilities(sections.actions),
      bonusActions: parseAbilities(sections.bonusActions),
      reactions: parseAbilities(sections.reactions),
      legendaryActions: parseAbilities(stripLegendaryBoilerplate(sections.legendaryActions)),
      lairActions: parseAbilities(sections.lairActions),
      raw: {
        text: text,
        sections: sections
      }
    };

    // Add computed values
    parsed.modifiers = {
      str: getModifier(parsed.abilityScores.str),
      dex: getModifier(parsed.abilityScores.dex),
      con: getModifier(parsed.abilityScores.con),
      int: getModifier(parsed.abilityScores.int),
      wis: getModifier(parsed.abilityScores.wis),
      cha: getModifier(parsed.abilityScores.cha)
    };

    // Find primary attack (highest damage)
    const allAttacks = [...parsed.actions, ...parsed.bonusActions]
      .filter(a => a.isAttack && a.attackInfo);

    if (allAttacks.length > 0) {
      parsed.primaryAttack = allAttacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      );
    } else {
      parsed.primaryAttack = null;
    }

    // Check for multiattack
    const multiattack = parsed.actions.find(a =>
      a.name.toLowerCase() === 'multiattack'
    );
    parsed.hasMultiattack = !!multiattack;
    parsed.multiattackDesc = multiattack ? multiattack.description : null;

    // Check for legendary actions count
    const legendaryMatch = text.match(PATTERNS.legendaryDesc);
    parsed.legendaryActionCount = legendaryMatch ? parseInt(legendaryMatch[1]) : 0;

    // Check for spellcasting
    parsed.hasSpellcasting = parsed.traits.some(t =>
      t.name.toLowerCase().includes('spellcasting')
    );

    return parsed;
  }

  // Public API
  return {
    parse: parse,
    normalizeText: normalizeText,
    getModifier: getModifier,
    CR_VALUES: CR_VALUES
  };
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DnDParser;
}
