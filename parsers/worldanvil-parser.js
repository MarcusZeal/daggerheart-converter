/**
 * World Anvil JSON Stat Block Parser
 * Parses D&D 5e stat blocks exported from World Anvil in JSON format
 * Supports BBCode-style formatting in text fields
 *
 * @version 1.0.0
 * @license MIT
 */

const WorldAnvilParser = (function() {
  'use strict';

  const version = '1.0.0';

  /**
   * Convert BBCode-style markup to plain text
   */
  function stripBBCode(text) {
    if (!text) return '';

    return text
      // Remove headers
      .replace(/\[h[1-6]\](.*?)\[\/h[1-6]\]/gi, '$1')
      // Remove bold/italic
      .replace(/\[b\](.*?)\[\/b\]/gi, '$1')
      .replace(/\[i\](.*?)\[\/i\]/gi, '$1')
      .replace(/\[u\](.*?)\[\/u\]/gi, '$1')
      // Remove URLs but keep text
      .replace(/\[url=[^\]]*\](.*?)\[\/url\]/gi, '$1')
      // Remove tables - extract cell contents
      .replace(/\[table\].*?\[\/table\]/gis, (match) => {
        // Extract all td/th content
        const cells = [];
        match.replace(/\[t[dh]\](.*?)\[\/t[dh]\]/gi, (_, content) => {
          cells.push(content.trim());
          return '';
        });
        return cells.join(', ');
      })
      // Remove remaining table tags
      .replace(/\[\/?(table|tr|td|th)\]/gi, '')
      // Remove roll tags
      .replace(/\[roll:[^\]]*\]/gi, '')
      // Clean up whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Parse BBCode text into structured abilities
   */
  function parseBBCodeAbilities(text) {
    if (!text) return [];

    const abilities = [];

    // Split by h3 headers which typically denote ability names
    const parts = text.split(/\[h3\]/i);

    for (const part of parts) {
      if (!part.trim()) continue;

      // Find the closing h3 tag
      const h3End = part.indexOf('[/h3]');
      if (h3End === -1) continue;

      const name = part.substring(0, h3End).trim();
      let description = part.substring(h3End + 5).trim();

      // Strip BBCode from description
      description = stripBBCode(description);

      // Skip empty abilities
      if (!name || !description) continue;

      // Parse attack info if present
      const attackInfo = parseAttackInfo(description);

      abilities.push({
        name: name,
        description: description,
        isAttack: !!attackInfo,
        attackInfo: attackInfo
      });
    }

    return abilities;
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
   * Get modifier from ability score
   */
  function getModifier(score) {
    if (typeof ParserManager !== 'undefined') {
      return ParserManager.getModifier(score);
    }
    return Math.floor((score - 10) / 2);
  }

  /**
   * Parse CR string to numeric value
   */
  function parseCR(crString) {
    if (!crString) return { string: '1', numeric: 1 };

    const CR_VALUES = {
      '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
      '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25
    };

    const str = String(crString).trim();
    return {
      string: str,
      numeric: CR_VALUES[str] !== undefined ? CR_VALUES[str] : parseFloat(str) || 1
    };
  }

  /**
   * Parse HP string like "32hp (5d6+15) [roll:5d6+15]"
   */
  function parseHP(hpString) {
    if (!hpString) return { value: 10, formula: null };

    // Extract numeric HP
    const hpMatch = hpString.match(/(\d+)\s*(?:hp)?/i);
    const formulaMatch = hpString.match(/\(([^)]+)\)/);

    return {
      value: hpMatch ? parseInt(hpMatch[1]) : 10,
      formula: formulaMatch ? formulaMatch[1].replace(/\s/g, '') : null
    };
  }

  /**
   * Parse skills string like "Perception +8"
   */
  function parseSkills(skillsString) {
    if (!skillsString) return {};

    const skills = {};
    const skillPattern = /(\w+(?:\s+\w+)?)\s*\+(\d+)/g;
    let match;

    while ((match = skillPattern.exec(skillsString)) !== null) {
      skills[match[1].toLowerCase()] = parseInt(match[2]);
    }

    return skills;
  }

  /**
   * Parse senses string
   */
  function parseSenses(sensesString) {
    if (!sensesString) return {};

    const senses = {};

    const darkMatch = sensesString.match(/darkvision\s+(\d+)\s*ft/i);
    if (darkMatch) senses.darkvision = parseInt(darkMatch[1]);

    const blindMatch = sensesString.match(/blindsight\s+(\d+)\s*ft/i);
    if (blindMatch) senses.blindsight = parseInt(blindMatch[1]);

    const trueMatch = sensesString.match(/truesight\s+(\d+)\s*ft/i);
    if (trueMatch) senses.truesight = parseInt(trueMatch[1]);

    const tremMatch = sensesString.match(/tremorsense\s+(\d+)\s*ft/i);
    if (tremMatch) senses.tremorsense = parseInt(tremMatch[1]);

    const passiveMatch = sensesString.match(/passive\s*Perception\s+(\d+)/i);
    if (passiveMatch) senses.passivePerception = parseInt(passiveMatch[1]);

    return senses;
  }

  /**
   * Check if input is World Anvil JSON format
   */
  function isWorldAnvilJSON(input) {
    if (typeof input === 'string') {
      try {
        const data = JSON.parse(input);
        return isWorldAnvilObject(data);
      } catch {
        return false;
      }
    }
    return isWorldAnvilObject(input);
  }

  /**
   * Check if object matches World Anvil structure
   */
  function isWorldAnvilObject(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Check for characteristic World Anvil fields
    const worldAnvilFields = ['challenge_rating', 'special_abilities', 'types', 'armor_class', 'hit_points'];
    const hasWorldAnvilFields = worldAnvilFields.some(field => field in obj);

    // Also check for BBCode in text fields
    const hasBBCode = ['special_abilities', 'actions', 'description'].some(field => {
      const val = obj[field];
      return val && typeof val === 'string' && /\[h[1-6]\]|\[b\]|\[table\]/i.test(val);
    });

    return hasWorldAnvilFields || hasBBCode;
  }

  /**
   * Main parse function
   */
  function parse(input) {
    let data;

    // Parse JSON if string
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error('Invalid JSON input: ' + e.message);
      }
    } else {
      data = input;
    }

    // Extract size - handle size range (size to sizer)
    const size = data.size || data.sizer || 'Medium';
    const finalSize = size.charAt(0).toUpperCase() + size.slice(1).toLowerCase();

    // Build speed object
    const speed = {};
    if (data.base_movement_in_ft) speed.walk = parseInt(data.base_movement_in_ft) || 30;
    if (data.fly_movement_in_ft) speed.fly = parseInt(data.fly_movement_in_ft);
    if (data.swim_movement_in_ft) speed.swim = parseInt(data.swim_movement_in_ft);
    if (data.climb_movement_in_ft) speed.climb = parseInt(data.climb_movement_in_ft);
    if (data.burrow_movement_in_ft) speed.burrow = parseInt(data.burrow_movement_in_ft);
    if (Object.keys(speed).length === 0) speed.walk = 30;

    // Parse ability scores
    const abilityScores = {
      str: parseInt(data.strength) || 10,
      dex: parseInt(data.dexterity) || 10,
      con: parseInt(data.constitution) || 10,
      int: parseInt(data.intelligence) || 10,
      wis: parseInt(data.wisdom) || 10,
      cha: parseInt(data.charisma) || 10
    };

    // Parse damage info
    const damageInfo = {
      resistances: data.damage_resistances ? data.damage_resistances.split(/,\s*/).filter(Boolean) : [],
      immunities: data.damage_immunities ? data.damage_immunities.split(/,\s*/).filter(Boolean) : [],
      vulnerabilities: data.damage_vulnerabilities ? data.damage_vulnerabilities.split(/,\s*/).filter(Boolean) : [],
      conditionImmunities: data.condition_immunities ? data.condition_immunities.split(/,\s*/).filter(Boolean) : []
    };

    // Parse abilities from BBCode sections
    const traits = parseBBCodeAbilities(data.special_abilities || '');
    const actions = parseBBCodeAbilities(data.actions || '');
    const bonusActions = parseBBCodeAbilities(data.bonus_actions || '');
    const reactions = parseBBCodeAbilities(data.reactions || '');
    const legendaryActions = parseBBCodeAbilities(data.legendary_actions || '');
    const lairActions = parseBBCodeAbilities(data.lair_actions || '');

    // Build parsed result matching D&D5e parser output format
    const parsed = {
      name: data.name || 'Unknown Creature',
      typeInfo: {
        size: finalSize,
        type: data.types || 'creature',
        subtype: null,
        alignment: data.alignment || null
      },
      ac: {
        value: parseInt(data.armor_class) || 10,
        type: null
      },
      hp: parseHP(data.hit_points),
      speed: speed,
      abilityScores: abilityScores,
      cr: parseCR(data.challenge_rating),
      skills: parseSkills(data.skills),
      damageInfo: damageInfo,
      senses: parseSenses(data.senses),
      languages: data.languages ? data.languages.split(/,\s*/).filter(Boolean) : [],
      traits: traits,
      actions: actions,
      bonusActions: bonusActions,
      reactions: reactions,
      legendaryActions: legendaryActions,
      lairActions: lairActions,
      raw: {
        text: JSON.stringify(data, null, 2),
        json: data
      }
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
    const allAttacks = [...actions, ...bonusActions].filter(a => a.isAttack && a.attackInfo);
    if (allAttacks.length > 0) {
      parsed.primaryAttack = allAttacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      );
    } else {
      parsed.primaryAttack = null;
    }

    // Check for multiattack
    const multiattack = actions.find(a => a.name.toLowerCase() === 'multiattack');
    parsed.hasMultiattack = !!multiattack;
    parsed.multiattackDesc = multiattack ? multiattack.description : null;

    // Check for legendary actions
    parsed.legendaryActionCount = legendaryActions.length > 0 ? 3 : 0;

    // Check for spellcasting
    parsed.hasSpellcasting = !!(data.spellcasting || traits.some(t =>
      t.name.toLowerCase().includes('spellcasting')
    ));

    // Add description if present
    if (data.description) {
      parsed.description = stripBBCode(data.description);
    }

    // Add source if present
    if (data.source) {
      parsed.source = data.source;
    }

    return parsed;
  }

  // Public API
  const api = {
    parse: parse,
    isWorldAnvilJSON: isWorldAnvilJSON,
    stripBBCode: stripBBCode,
    version: version,
    systemId: 'worldanvil'
  };

  // Register with ParserManager if available
  if (typeof ParserManager !== 'undefined') {
    ParserManager.registerParser('worldanvil', api);
  }

  return api;
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorldAnvilParser;
}
