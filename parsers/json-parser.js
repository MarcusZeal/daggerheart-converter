/**
 * Universal JSON Stat Block Parser
 * Auto-detects and parses multiple JSON formats:
 * - 5e.tools Homebrew format
 * - Open5e / D&D 5e SRD format
 * - World Anvil format
 * - CritterDB format
 * - Foundry VTT format
 * - Improved Initiative format
 *
 * @version 1.0.0
 * @license MIT
 */

const JSONParser = (function() {
  'use strict';

  const version = '1.0.0';

  // ============================================================================
  // FORMAT DETECTION
  // ============================================================================

  /**
   * Detect which JSON format the input is
   * Returns: { format: 'fivetools' | 'open5e' | 'worldanvil' | 'critterdb' | 'foundry' | 'improved-initiative' | 'unknown', confidence: 0-1 }
   */
  function detectFormat(data) {
    if (!data || typeof data !== 'object') {
      return { format: 'unknown', confidence: 0 };
    }

    // Handle arrays - check first element
    const obj = Array.isArray(data) ? data[0] : data;
    if (!obj) return { format: 'unknown', confidence: 0 };

    const scores = {
      fivetools: scoreFiveTools(obj),
      open5e: scoreOpen5e(obj),
      worldanvil: scoreWorldAnvil(obj),
      critterdb: scoreCritterDB(obj),
      foundry: scoreFoundry(obj),
      improvedinitiative: scoreImprovedInitiative(obj)
    };

    // Find best match
    let bestFormat = 'unknown';
    let bestScore = 0;

    for (const [format, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestFormat = format;
      }
    }

    return {
      format: bestScore >= 0.3 ? bestFormat : 'unknown',
      confidence: bestScore,
      allScores: scores
    };
  }

  // 5e.tools format: lowercase fields, specific structure
  function scoreFiveTools(obj) {
    let score = 0;
    const fields = ['source', 'size', 'type', 'ac', 'hp', 'speed', 'str', 'dex', 'con', 'int', 'wis', 'cha', 'cr', 'trait', 'action'];
    const matchedFields = fields.filter(f => f in obj);
    score += matchedFields.length / fields.length * 0.5;

    // 5e.tools specific patterns
    if (obj.hp && typeof obj.hp === 'object' && 'average' in obj.hp) score += 0.2;
    if (obj.ac && Array.isArray(obj.ac)) score += 0.15;
    if (obj.speed && typeof obj.speed === 'object' && 'walk' in obj.speed) score += 0.1;
    if ('source' in obj && typeof obj.source === 'string') score += 0.1;
    if (obj.trait && Array.isArray(obj.trait)) score += 0.1;

    return Math.min(1, score);
  }

  // Open5e/SRD format: Title Case field names, HTML in content
  function scoreOpen5e(obj) {
    let score = 0;
    const fields = ['Armor Class', 'Hit Points', 'Speed', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'Challenge', 'Actions', 'Traits'];
    const matchedFields = fields.filter(f => f in obj);
    score += matchedFields.length / fields.length * 0.6;

    // Open5e specific patterns
    if ('meta' in obj && typeof obj.meta === 'string') score += 0.2;
    if ('STR_mod' in obj || 'DEX_mod' in obj) score += 0.15;
    if (obj.Actions && typeof obj.Actions === 'string' && obj.Actions.includes('<p>')) score += 0.1;
    if ('img_url' in obj) score += 0.05;

    return Math.min(1, score);
  }

  // World Anvil format: snake_case, BBCode formatting
  function scoreWorldAnvil(obj) {
    let score = 0;
    const fields = ['challenge_rating', 'armor_class', 'hit_points', 'special_abilities', 'base_movement_in_ft', 'strength', 'dexterity', 'constitution'];
    const matchedFields = fields.filter(f => f in obj);
    score += matchedFields.length / fields.length * 0.6;

    // World Anvil specific patterns
    if ('types' in obj && typeof obj.types === 'string') score += 0.15;
    if ('templateId' in obj || 'blockId' in obj) score += 0.2;
    const hasBBCode = ['special_abilities', 'actions', 'description'].some(f =>
      obj[f] && typeof obj[f] === 'string' && /\[h[1-6]\]|\[b\]|\[table\]/i.test(obj[f])
    );
    if (hasBBCode) score += 0.2;

    return Math.min(1, score);
  }

  // CritterDB format
  function scoreCritterDB(obj) {
    let score = 0;
    const fields = ['stats', 'armor', 'hitPoints', 'challenge', 'abilities'];
    const matchedFields = fields.filter(f => f in obj);
    score += matchedFields.length / fields.length * 0.5;

    // CritterDB specific patterns
    if (obj.stats && typeof obj.stats === 'object' && 'strength' in obj.stats) score += 0.25;
    if (obj.armor && typeof obj.armor === 'object' && 'value' in obj.armor) score += 0.15;
    if ('flavor' in obj) score += 0.1;

    return Math.min(1, score);
  }

  // Foundry VTT format
  function scoreFoundry(obj) {
    let score = 0;

    // Foundry uses specific nested structure
    if (obj.system || obj.data) score += 0.3;
    if (obj.type === 'npc' || obj.type === 'character') score += 0.2;
    if (obj.prototypeToken || obj.token) score += 0.15;
    if (obj.items && Array.isArray(obj.items)) score += 0.15;
    if (obj.flags) score += 0.1;
    if (obj._id && typeof obj._id === 'string') score += 0.1;

    return Math.min(1, score);
  }

  // Improved Initiative format
  function scoreImprovedInitiative(obj) {
    let score = 0;
    const fields = ['HP', 'AC', 'InitiativeModifier', 'Abilities', 'DamageVulnerabilities', 'DamageResistances', 'DamageImmunities'];
    const matchedFields = fields.filter(f => f in obj);
    score += matchedFields.length / fields.length * 0.5;

    // Improved Initiative specific
    if (obj.Abilities && typeof obj.Abilities === 'object' && 'Str' in obj.Abilities) score += 0.25;
    if ('InitiativeModifier' in obj) score += 0.15;
    if ('Player' in obj) score += 0.1;
    if (obj.HP && typeof obj.HP === 'object' && 'Value' in obj.HP) score += 0.1;

    return Math.min(1, score);
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function getModifier(score) {
    return Math.floor((score - 10) / 2);
  }

  function parseCR(crValue) {
    const CR_VALUES = {
      '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18,
      '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '26': 26,
      '27': 27, '28': 28, '29': 29, '30': 30
    };

    if (typeof crValue === 'number') {
      return { string: String(crValue), numeric: crValue };
    }

    const str = String(crValue).trim();
    // Handle "10 (5,900 XP)" format
    const match = str.match(/^([\d\/]+)/);
    const crString = match ? match[1] : str;

    return {
      string: crString,
      numeric: CR_VALUES[crString] !== undefined ? CR_VALUES[crString] : parseFloat(crString) || 1
    };
  }

  function stripHtml(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripBBCode(text) {
    if (!text) return '';
    return text
      .replace(/\[h[1-6]\](.*?)\[\/h[1-6]\]/gi, '$1')
      .replace(/\[b\](.*?)\[\/b\]/gi, '$1')
      .replace(/\[i\](.*?)\[\/i\]/gi, '$1')
      .replace(/\[u\](.*?)\[\/u\]/gi, '$1')
      .replace(/\[url=[^\]]*\](.*?)\[\/url\]/gi, '$1')
      .replace(/\[table\].*?\[\/table\]/gis, '')
      .replace(/\[\/?(table|tr|td|th)\]/gi, '')
      .replace(/\[roll:[^\]]*\]/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function parseAbilitiesFromBBCode(text) {
    if (!text) return [];
    const abilities = [];
    const parts = text.split(/\[h3\]/i);

    for (const part of parts) {
      if (!part.trim()) continue;
      const h3End = part.indexOf('[/h3]');
      if (h3End === -1) continue;

      const name = part.substring(0, h3End).trim();
      let description = stripBBCode(part.substring(h3End + 5));

      if (!name || !description) continue;

      abilities.push({
        name: name,
        description: description,
        isAttack: isAttackDescription(description),
        attackInfo: parseAttackInfo(description)
      });
    }
    return abilities;
  }

  function parseAbilitiesFromHtml(text) {
    if (!text) return [];
    const abilities = [];

    // Match patterns like "<p><em><strong>Name.</strong></em> Description</p>"
    const pattern = /<p>(?:<em>)?(?:<strong>)?([^<.]+)\.?(?:<\/strong>)?(?:<\/em>)?\s*(.+?)<\/p>/gi;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const name = stripHtml(match[1]).trim();
      const description = stripHtml(match[2]).trim();

      if (name && description) {
        abilities.push({
          name: name,
          description: description,
          isAttack: isAttackDescription(description),
          attackInfo: parseAttackInfo(description)
        });
      }
    }
    return abilities;
  }

  function isAttackDescription(desc) {
    return /(?:Melee|Ranged)\s+(?:Weapon|Spell)\s+Attack/i.test(desc);
  }

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

  function parseSenses(sensesInput) {
    const senses = {};
    const text = typeof sensesInput === 'string' ? sensesInput :
                 Array.isArray(sensesInput) ? sensesInput.join(', ') : '';

    const darkMatch = text.match(/darkvision\s+(\d+)\s*ft/i);
    if (darkMatch) senses.darkvision = parseInt(darkMatch[1]);

    const blindMatch = text.match(/blindsight\s+(\d+)\s*ft/i);
    if (blindMatch) senses.blindsight = parseInt(blindMatch[1]);

    const trueMatch = text.match(/truesight\s+(\d+)\s*ft/i);
    if (trueMatch) senses.truesight = parseInt(trueMatch[1]);

    const tremMatch = text.match(/tremorsense\s+(\d+)\s*ft/i);
    if (tremMatch) senses.tremorsense = parseInt(tremMatch[1]);

    const passiveMatch = text.match(/passive\s*Perception\s+(\d+)/i);
    if (passiveMatch) senses.passivePerception = parseInt(passiveMatch[1]);

    return senses;
  }

  function parseSkills(skillsInput) {
    const skills = {};
    const text = typeof skillsInput === 'string' ? skillsInput :
                 typeof skillsInput === 'object' ? JSON.stringify(skillsInput) : '';

    const pattern = /(\w+(?:\s+\w+)?)\s*\+(\d+)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      skills[match[1].toLowerCase()] = parseInt(match[2]);
    }
    return skills;
  }

  // ============================================================================
  // FORMAT-SPECIFIC PARSERS
  // ============================================================================

  /**
   * Parse 5e.tools format
   */
  function parseFiveTools(obj) {
    // Parse AC (can be array or number)
    let acValue = 10;
    let acType = null;
    if (obj.ac) {
      if (Array.isArray(obj.ac)) {
        const acEntry = obj.ac[0];
        if (typeof acEntry === 'number') {
          acValue = acEntry;
        } else if (typeof acEntry === 'object') {
          acValue = acEntry.ac || acEntry.special || 10;
          acType = acEntry.from ? acEntry.from.join(', ') : null;
        }
      } else {
        acValue = parseInt(obj.ac) || 10;
      }
    }

    // Parse HP
    let hpValue = 10;
    let hpFormula = null;
    if (obj.hp) {
      if (typeof obj.hp === 'object') {
        hpValue = obj.hp.average || obj.hp.special || 10;
        hpFormula = obj.hp.formula || null;
      } else {
        hpValue = parseInt(obj.hp) || 10;
      }
    }

    // Parse speed
    const speed = {};
    if (obj.speed) {
      if (typeof obj.speed === 'object') {
        if (obj.speed.walk) speed.walk = typeof obj.speed.walk === 'object' ? obj.speed.walk.number : parseInt(obj.speed.walk);
        else if (typeof obj.speed.walk === 'undefined' && obj.speed.number) speed.walk = obj.speed.number;
        if (obj.speed.fly) speed.fly = typeof obj.speed.fly === 'object' ? obj.speed.fly.number : parseInt(obj.speed.fly);
        if (obj.speed.swim) speed.swim = typeof obj.speed.swim === 'object' ? obj.speed.swim.number : parseInt(obj.speed.swim);
        if (obj.speed.climb) speed.climb = typeof obj.speed.climb === 'object' ? obj.speed.climb.number : parseInt(obj.speed.climb);
        if (obj.speed.burrow) speed.burrow = typeof obj.speed.burrow === 'object' ? obj.speed.burrow.number : parseInt(obj.speed.burrow);
      } else {
        speed.walk = parseInt(obj.speed) || 30;
      }
    }
    if (Object.keys(speed).length === 0) speed.walk = 30;

    // Parse type info
    let typeInfo = { size: 'Medium', type: 'creature', subtype: null, alignment: null };
    if (obj.size) {
      const sizeMap = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
      const sizeVal = Array.isArray(obj.size) ? obj.size[0] : obj.size;
      typeInfo.size = sizeMap[sizeVal] || sizeVal;
    }
    if (obj.type) {
      if (typeof obj.type === 'string') {
        typeInfo.type = obj.type;
      } else if (typeof obj.type === 'object') {
        typeInfo.type = obj.type.type || 'creature';
        if (obj.type.tags) typeInfo.subtype = obj.type.tags.join(', ');
      }
    }
    if (obj.alignment) {
      typeInfo.alignment = Array.isArray(obj.alignment) ? obj.alignment.join(' ') : obj.alignment;
    }

    // Parse abilities
    const abilityScores = {
      str: obj.str || 10,
      dex: obj.dex || 10,
      con: obj.con || 10,
      int: obj.int || 10,
      wis: obj.wis || 10,
      cha: obj.cha || 10
    };

    // Parse traits and actions
    const traits = [];
    const actions = [];
    const reactions = [];
    const legendaryActions = [];

    if (obj.trait) {
      for (const t of obj.trait) {
        const desc = Array.isArray(t.entries) ? t.entries.join(' ') : String(t.entries || '');
        traits.push({
          name: t.name,
          description: desc,
          isAttack: false,
          attackInfo: null
        });
      }
    }

    if (obj.action) {
      for (const a of obj.action) {
        const desc = Array.isArray(a.entries) ? a.entries.join(' ') : String(a.entries || '');
        actions.push({
          name: a.name,
          description: desc,
          isAttack: isAttackDescription(desc),
          attackInfo: parseAttackInfo(desc)
        });
      }
    }

    if (obj.reaction) {
      for (const r of obj.reaction) {
        const desc = Array.isArray(r.entries) ? r.entries.join(' ') : String(r.entries || '');
        reactions.push({
          name: r.name,
          description: desc,
          isAttack: false,
          attackInfo: null
        });
      }
    }

    if (obj.legendary) {
      for (const l of obj.legendary) {
        const desc = Array.isArray(l.entries) ? l.entries.join(' ') : String(l.entries || '');
        legendaryActions.push({
          name: l.name,
          description: desc,
          isAttack: false,
          attackInfo: null
        });
      }
    }

    // Find primary attack
    const allAttacks = actions.filter(a => a.isAttack && a.attackInfo);
    const primaryAttack = allAttacks.length > 0 ?
      allAttacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      ) : null;

    // Damage info
    const damageInfo = {
      resistances: obj.resist || [],
      immunities: obj.immune || [],
      vulnerabilities: obj.vulnerable || [],
      conditionImmunities: obj.conditionImmune || []
    };

    return {
      name: obj.name || 'Unknown Creature',
      typeInfo: typeInfo,
      ac: { value: acValue, type: acType },
      hp: { value: hpValue, formula: hpFormula },
      speed: speed,
      abilityScores: abilityScores,
      modifiers: {
        str: getModifier(abilityScores.str),
        dex: getModifier(abilityScores.dex),
        con: getModifier(abilityScores.con),
        int: getModifier(abilityScores.int),
        wis: getModifier(abilityScores.wis),
        cha: getModifier(abilityScores.cha)
      },
      cr: parseCR(obj.cr),
      skills: parseSkills(obj.skill),
      damageInfo: damageInfo,
      senses: parseSenses(obj.senses),
      languages: obj.languages || [],
      traits: traits,
      actions: actions,
      bonusActions: [],
      reactions: reactions,
      legendaryActions: legendaryActions,
      lairActions: [],
      primaryAttack: primaryAttack,
      hasMultiattack: actions.some(a => a.name && a.name.toLowerCase() === 'multiattack'),
      multiattackDesc: null,
      legendaryActionCount: legendaryActions.length > 0 ? 3 : 0,
      hasSpellcasting: traits.some(t => t.name && t.name.toLowerCase().includes('spellcasting')),
      raw: { json: obj }
    };
  }

  /**
   * Parse Open5e/SRD format
   */
  function parseOpen5e(obj) {
    // Parse meta line "Large aberration, lawful evil"
    let typeInfo = { size: 'Medium', type: 'creature', subtype: null, alignment: null };
    if (obj.meta) {
      const metaMatch = obj.meta.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(\w+)(?:\s*\(([^)]+)\))?(?:,\s*(.+))?$/i);
      if (metaMatch) {
        typeInfo.size = metaMatch[1];
        typeInfo.type = metaMatch[2];
        typeInfo.subtype = metaMatch[3] || null;
        typeInfo.alignment = metaMatch[4] || null;
      }
    }

    // Parse AC "17 (Natural Armor)"
    let acValue = 10;
    let acType = null;
    if (obj['Armor Class']) {
      const acMatch = obj['Armor Class'].match(/(\d+)(?:\s*\(([^)]+)\))?/);
      if (acMatch) {
        acValue = parseInt(acMatch[1]);
        acType = acMatch[2] || null;
      }
    }

    // Parse HP "135 (18d10 + 36)"
    let hpValue = 10;
    let hpFormula = null;
    if (obj['Hit Points']) {
      const hpMatch = obj['Hit Points'].match(/(\d+)(?:\s*\(([^)]+)\))?/);
      if (hpMatch) {
        hpValue = parseInt(hpMatch[1]);
        hpFormula = hpMatch[2] || null;
      }
    }

    // Parse speed "10 ft., swim 40 ft."
    const speed = {};
    if (obj.Speed) {
      const walkMatch = obj.Speed.match(/^(\d+)\s*ft/);
      if (walkMatch) speed.walk = parseInt(walkMatch[1]);

      const flyMatch = obj.Speed.match(/fly\s+(\d+)\s*ft/i);
      if (flyMatch) speed.fly = parseInt(flyMatch[1]);

      const swimMatch = obj.Speed.match(/swim\s+(\d+)\s*ft/i);
      if (swimMatch) speed.swim = parseInt(swimMatch[1]);

      const climbMatch = obj.Speed.match(/climb\s+(\d+)\s*ft/i);
      if (climbMatch) speed.climb = parseInt(climbMatch[1]);

      const burrowMatch = obj.Speed.match(/burrow\s+(\d+)\s*ft/i);
      if (burrowMatch) speed.burrow = parseInt(burrowMatch[1]);
    }
    if (Object.keys(speed).length === 0) speed.walk = 30;

    // Parse ability scores
    const abilityScores = {
      str: parseInt(obj.STR) || 10,
      dex: parseInt(obj.DEX) || 10,
      con: parseInt(obj.CON) || 10,
      int: parseInt(obj.INT) || 10,
      wis: parseInt(obj.WIS) || 10,
      cha: parseInt(obj.CHA) || 10
    };

    // Parse traits and actions from HTML
    const traits = parseAbilitiesFromHtml(obj.Traits || '');
    const actions = parseAbilitiesFromHtml(obj.Actions || '');
    const reactions = parseAbilitiesFromHtml(obj.Reactions || '');
    const legendaryActions = parseAbilitiesFromHtml(obj['Legendary Actions'] || '');

    // Find primary attack
    const allAttacks = actions.filter(a => a.isAttack && a.attackInfo);
    const primaryAttack = allAttacks.length > 0 ?
      allAttacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      ) : null;

    return {
      name: obj.name || 'Unknown Creature',
      typeInfo: typeInfo,
      ac: { value: acValue, type: acType },
      hp: { value: hpValue, formula: hpFormula },
      speed: speed,
      abilityScores: abilityScores,
      modifiers: {
        str: getModifier(abilityScores.str),
        dex: getModifier(abilityScores.dex),
        con: getModifier(abilityScores.con),
        int: getModifier(abilityScores.int),
        wis: getModifier(abilityScores.wis),
        cha: getModifier(abilityScores.cha)
      },
      cr: parseCR(obj.Challenge),
      skills: parseSkills(obj.Skills),
      damageInfo: {
        resistances: obj['Damage Resistances'] ? obj['Damage Resistances'].split(/,\s*/) : [],
        immunities: obj['Damage Immunities'] ? obj['Damage Immunities'].split(/,\s*/) : [],
        vulnerabilities: obj['Damage Vulnerabilities'] ? obj['Damage Vulnerabilities'].split(/,\s*/) : [],
        conditionImmunities: obj['Condition Immunities'] ? obj['Condition Immunities'].split(/,\s*/) : []
      },
      senses: parseSenses(obj.Senses),
      languages: obj.Languages ? obj.Languages.split(/,\s*/) : [],
      traits: traits,
      actions: actions,
      bonusActions: [],
      reactions: reactions,
      legendaryActions: legendaryActions,
      lairActions: [],
      primaryAttack: primaryAttack,
      hasMultiattack: actions.some(a => a.name && a.name.toLowerCase() === 'multiattack'),
      multiattackDesc: null,
      legendaryActionCount: legendaryActions.length > 0 ? 3 : 0,
      hasSpellcasting: traits.some(t => t.name && t.name.toLowerCase().includes('spellcasting')),
      raw: { json: obj }
    };
  }

  /**
   * Parse World Anvil format
   */
  function parseWorldAnvil(obj) {
    const size = obj.size || obj.sizer || 'Medium';
    const finalSize = size.charAt(0).toUpperCase() + size.slice(1).toLowerCase();

    const speed = {};
    if (obj.base_movement_in_ft) speed.walk = parseInt(obj.base_movement_in_ft) || 30;
    if (obj.fly_movement_in_ft) speed.fly = parseInt(obj.fly_movement_in_ft);
    if (obj.swim_movement_in_ft) speed.swim = parseInt(obj.swim_movement_in_ft);
    if (obj.climb_movement_in_ft) speed.climb = parseInt(obj.climb_movement_in_ft);
    if (obj.burrow_movement_in_ft) speed.burrow = parseInt(obj.burrow_movement_in_ft);
    if (Object.keys(speed).length === 0) speed.walk = 30;

    const abilityScores = {
      str: parseInt(obj.strength) || 10,
      dex: parseInt(obj.dexterity) || 10,
      con: parseInt(obj.constitution) || 10,
      int: parseInt(obj.intelligence) || 10,
      wis: parseInt(obj.wisdom) || 10,
      cha: parseInt(obj.charisma) || 10
    };

    // Parse HP "32hp (5d6+15) [roll:5d6+15]"
    let hpValue = 10;
    let hpFormula = null;
    if (obj.hit_points) {
      const hpMatch = obj.hit_points.match(/(\d+)\s*(?:hp)?/i);
      const formulaMatch = obj.hit_points.match(/\(([^)]+)\)/);
      hpValue = hpMatch ? parseInt(hpMatch[1]) : 10;
      hpFormula = formulaMatch ? formulaMatch[1].replace(/\s/g, '') : null;
    }

    const traits = parseAbilitiesFromBBCode(obj.special_abilities || '');
    const actions = parseAbilitiesFromBBCode(obj.actions || '');
    const bonusActions = parseAbilitiesFromBBCode(obj.bonus_actions || '');
    const reactions = parseAbilitiesFromBBCode(obj.reactions || '');
    const legendaryActions = parseAbilitiesFromBBCode(obj.legendary_actions || '');

    const allAttacks = [...actions, ...bonusActions].filter(a => a.isAttack && a.attackInfo);
    const primaryAttack = allAttacks.length > 0 ?
      allAttacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      ) : null;

    return {
      name: obj.name || 'Unknown Creature',
      typeInfo: {
        size: finalSize,
        type: obj.types || 'creature',
        subtype: null,
        alignment: obj.alignment || null
      },
      ac: { value: parseInt(obj.armor_class) || 10, type: null },
      hp: { value: hpValue, formula: hpFormula },
      speed: speed,
      abilityScores: abilityScores,
      modifiers: {
        str: getModifier(abilityScores.str),
        dex: getModifier(abilityScores.dex),
        con: getModifier(abilityScores.con),
        int: getModifier(abilityScores.int),
        wis: getModifier(abilityScores.wis),
        cha: getModifier(abilityScores.cha)
      },
      cr: parseCR(obj.challenge_rating),
      skills: parseSkills(obj.skills),
      damageInfo: {
        resistances: obj.damage_resistances ? obj.damage_resistances.split(/,\s*/).filter(Boolean) : [],
        immunities: obj.damage_immunities ? obj.damage_immunities.split(/,\s*/).filter(Boolean) : [],
        vulnerabilities: obj.damage_vulnerabilities ? obj.damage_vulnerabilities.split(/,\s*/).filter(Boolean) : [],
        conditionImmunities: obj.condition_immunities ? obj.condition_immunities.split(/,\s*/).filter(Boolean) : []
      },
      senses: parseSenses(obj.senses),
      languages: obj.languages ? obj.languages.split(/,\s*/).filter(Boolean) : [],
      traits: traits,
      actions: actions,
      bonusActions: bonusActions,
      reactions: reactions,
      legendaryActions: legendaryActions,
      lairActions: [],
      primaryAttack: primaryAttack,
      hasMultiattack: actions.some(a => a.name && a.name.toLowerCase() === 'multiattack'),
      multiattackDesc: null,
      legendaryActionCount: legendaryActions.length > 0 ? 3 : 0,
      hasSpellcasting: !!(obj.spellcasting || traits.some(t => t.name && t.name.toLowerCase().includes('spellcasting'))),
      description: obj.description ? stripBBCode(obj.description) : null,
      source: obj.source || null,
      raw: { json: obj }
    };
  }

  /**
   * Parse CritterDB format
   */
  function parseCritterDB(obj) {
    const stats = obj.stats || {};

    const abilityScores = {
      str: stats.strength || 10,
      dex: stats.dexterity || 10,
      con: stats.constitution || 10,
      int: stats.intelligence || 10,
      wis: stats.wisdom || 10,
      cha: stats.charisma || 10
    };

    const acValue = obj.armor?.value || obj.armorClass || 10;
    const hpValue = obj.hitPoints?.average || obj.hitPoints || 10;

    return {
      name: obj.name || 'Unknown Creature',
      typeInfo: {
        size: obj.size || 'Medium',
        type: obj.type || 'creature',
        subtype: obj.subtype || null,
        alignment: obj.alignment || null
      },
      ac: { value: acValue, type: obj.armor?.type || null },
      hp: { value: hpValue, formula: obj.hitPoints?.formula || null },
      speed: obj.speed || { walk: 30 },
      abilityScores: abilityScores,
      modifiers: {
        str: getModifier(abilityScores.str),
        dex: getModifier(abilityScores.dex),
        con: getModifier(abilityScores.con),
        int: getModifier(abilityScores.int),
        wis: getModifier(abilityScores.wis),
        cha: getModifier(abilityScores.cha)
      },
      cr: parseCR(obj.challenge),
      skills: obj.skills || {},
      damageInfo: {
        resistances: obj.damageResistances || [],
        immunities: obj.damageImmunities || [],
        vulnerabilities: obj.damageVulnerabilities || [],
        conditionImmunities: obj.conditionImmunities || []
      },
      senses: parseSenses(obj.senses),
      languages: obj.languages || [],
      traits: (obj.abilities || []).map(a => ({ name: a.name, description: a.description, isAttack: false, attackInfo: null })),
      actions: (obj.actions || []).map(a => ({ name: a.name, description: a.description, isAttack: isAttackDescription(a.description), attackInfo: parseAttackInfo(a.description) })),
      bonusActions: [],
      reactions: (obj.reactions || []).map(r => ({ name: r.name, description: r.description, isAttack: false, attackInfo: null })),
      legendaryActions: (obj.legendaryActions || []).map(l => ({ name: l.name, description: l.description, isAttack: false, attackInfo: null })),
      lairActions: [],
      primaryAttack: null,
      hasMultiattack: false,
      multiattackDesc: null,
      legendaryActionCount: (obj.legendaryActions || []).length > 0 ? 3 : 0,
      hasSpellcasting: false,
      raw: { json: obj }
    };
  }

  /**
   * Parse Foundry VTT format
   */
  function parseFoundry(obj) {
    const system = obj.system || obj.data || {};
    const details = system.details || {};
    const attributes = system.attributes || {};
    const abilities = system.abilities || {};

    const abilityScores = {
      str: abilities.str?.value || 10,
      dex: abilities.dex?.value || 10,
      con: abilities.con?.value || 10,
      int: abilities.int?.value || 10,
      wis: abilities.wis?.value || 10,
      cha: abilities.cha?.value || 10
    };

    const speed = {};
    if (attributes.movement) {
      if (attributes.movement.walk) speed.walk = attributes.movement.walk;
      if (attributes.movement.fly) speed.fly = attributes.movement.fly;
      if (attributes.movement.swim) speed.swim = attributes.movement.swim;
      if (attributes.movement.climb) speed.climb = attributes.movement.climb;
      if (attributes.movement.burrow) speed.burrow = attributes.movement.burrow;
    }
    if (Object.keys(speed).length === 0) speed.walk = 30;

    return {
      name: obj.name || 'Unknown Creature',
      typeInfo: {
        size: details.type?.size || system.traits?.size || 'med',
        type: details.type?.value || 'creature',
        subtype: details.type?.subtype || null,
        alignment: details.alignment || null
      },
      ac: { value: attributes.ac?.value || 10, type: attributes.ac?.calc || null },
      hp: { value: attributes.hp?.value || attributes.hp?.max || 10, formula: attributes.hp?.formula || null },
      speed: speed,
      abilityScores: abilityScores,
      modifiers: {
        str: getModifier(abilityScores.str),
        dex: getModifier(abilityScores.dex),
        con: getModifier(abilityScores.con),
        int: getModifier(abilityScores.int),
        wis: getModifier(abilityScores.wis),
        cha: getModifier(abilityScores.cha)
      },
      cr: parseCR(details.cr),
      skills: {},
      damageInfo: {
        resistances: system.traits?.dr?.value || [],
        immunities: system.traits?.di?.value || [],
        vulnerabilities: system.traits?.dv?.value || [],
        conditionImmunities: system.traits?.ci?.value || []
      },
      senses: parseSenses(system.traits?.senses || ''),
      languages: system.traits?.languages?.value || [],
      traits: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActions: [],
      lairActions: [],
      primaryAttack: null,
      hasMultiattack: false,
      multiattackDesc: null,
      legendaryActionCount: 0,
      hasSpellcasting: false,
      raw: { json: obj }
    };
  }

  /**
   * Parse Improved Initiative format
   */
  function parseImprovedInitiative(obj) {
    const abilities = obj.Abilities || {};

    const abilityScores = {
      str: abilities.Str || 10,
      dex: abilities.Dex || 10,
      con: abilities.Con || 10,
      int: abilities.Int || 10,
      wis: abilities.Wis || 10,
      cha: abilities.Cha || 10
    };

    const speed = {};
    if (obj.Speed) {
      for (const s of obj.Speed) {
        const match = s.match(/^(\w+)\s+(\d+)/i);
        if (match) {
          const type = match[1].toLowerCase();
          speed[type === 'walk' || !['fly', 'swim', 'climb', 'burrow'].includes(type) ? 'walk' : type] = parseInt(match[2]);
        }
      }
    }
    if (Object.keys(speed).length === 0) speed.walk = 30;

    const parseIIAbilities = (arr) => (arr || []).map(a => ({
      name: a.Name,
      description: a.Content,
      isAttack: isAttackDescription(a.Content),
      attackInfo: parseAttackInfo(a.Content)
    }));

    const traits = parseIIAbilities(obj.Traits);
    const actions = parseIIAbilities(obj.Actions);
    const reactions = parseIIAbilities(obj.Reactions);
    const legendaryActions = parseIIAbilities(obj.LegendaryActions);

    const allAttacks = actions.filter(a => a.isAttack && a.attackInfo);
    const primaryAttack = allAttacks.length > 0 ?
      allAttacks.reduce((best, current) =>
        (current.attackInfo.avgDamage > best.attackInfo.avgDamage) ? current : best
      ) : null;

    return {
      name: obj.Name || 'Unknown Creature',
      typeInfo: {
        size: obj.Size || 'Medium',
        type: obj.Type || 'creature',
        subtype: null,
        alignment: obj.Alignment || null
      },
      ac: { value: obj.AC?.Value || 10, type: obj.AC?.Notes || null },
      hp: { value: obj.HP?.Value || 10, formula: obj.HP?.Notes || null },
      speed: speed,
      abilityScores: abilityScores,
      modifiers: {
        str: getModifier(abilityScores.str),
        dex: getModifier(abilityScores.dex),
        con: getModifier(abilityScores.con),
        int: getModifier(abilityScores.int),
        wis: getModifier(abilityScores.wis),
        cha: getModifier(abilityScores.cha)
      },
      cr: parseCR(obj.Challenge),
      skills: parseSkills((obj.Skills || []).join(', ')),
      damageInfo: {
        resistances: obj.DamageResistances || [],
        immunities: obj.DamageImmunities || [],
        vulnerabilities: obj.DamageVulnerabilities || [],
        conditionImmunities: obj.ConditionImmunities || []
      },
      senses: parseSenses((obj.Senses || []).join(', ')),
      languages: obj.Languages || [],
      traits: traits,
      actions: actions,
      bonusActions: [],
      reactions: reactions,
      legendaryActions: legendaryActions,
      lairActions: [],
      primaryAttack: primaryAttack,
      hasMultiattack: actions.some(a => a.name && a.name.toLowerCase() === 'multiattack'),
      multiattackDesc: null,
      legendaryActionCount: legendaryActions.length > 0 ? 3 : 0,
      hasSpellcasting: traits.some(t => t.name && t.name.toLowerCase().includes('spellcasting')),
      raw: { json: obj }
    };
  }

  // ============================================================================
  // MAIN PARSE FUNCTION
  // ============================================================================

  /**
   * Check if input is valid JSON
   */
  function isJSON(input) {
    if (typeof input !== 'string') return typeof input === 'object';
    const trimmed = input.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  /**
   * Main parse function - auto-detects format and parses
   */
  function parse(input) {
    let data;

    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error('Invalid JSON: ' + e.message);
      }
    } else {
      data = input;
    }

    // Handle arrays - parse first element
    const obj = Array.isArray(data) ? data[0] : data;
    if (!obj) throw new Error('Empty JSON data');

    // Detect format
    const detection = detectFormat(obj);

    // Parse based on detected format
    let parsed;
    switch (detection.format) {
      case 'fivetools':
        parsed = parseFiveTools(obj);
        break;
      case 'open5e':
        parsed = parseOpen5e(obj);
        break;
      case 'worldanvil':
        parsed = parseWorldAnvil(obj);
        break;
      case 'critterdb':
        parsed = parseCritterDB(obj);
        break;
      case 'foundry':
        parsed = parseFoundry(obj);
        break;
      case 'improvedinitiative':
        parsed = parseImprovedInitiative(obj);
        break;
      default:
        // Try to parse as generic JSON with common field names
        parsed = parseFiveTools(obj); // Fall back to 5e.tools parser as it's most flexible
    }

    // Add detection metadata
    parsed._meta = {
      system: 'json-' + detection.format,
      systemInfo: {
        name: getFormatName(detection.format),
        shortName: 'JSON',
        color: '#4a7c59'
      },
      detected: detection
    };

    return parsed;
  }

  function getFormatName(format) {
    const names = {
      fivetools: '5e.tools JSON',
      open5e: 'Open5e/SRD JSON',
      worldanvil: 'World Anvil JSON',
      critterdb: 'CritterDB JSON',
      foundry: 'Foundry VTT JSON',
      improvedinitiative: 'Improved Initiative JSON',
      unknown: 'Unknown JSON'
    };
    return names[format] || 'JSON';
  }

  // Public API
  const api = {
    parse: parse,
    isJSON: isJSON,
    detectFormat: detectFormat,
    version: version,
    systemId: 'json'
  };

  // Register with ParserManager if available
  if (typeof ParserManager !== 'undefined') {
    ParserManager.registerParser('json', api);
  }

  return api;
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JSONParser;
}
