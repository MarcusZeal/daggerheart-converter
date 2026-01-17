/**
 * Daggerheart Converter
 * Converts parsed D&D 5e stat blocks to Daggerheart format
 *
 * @version 1.0.0
 * @license MIT
 */

const DaggerheartConverter = (function() {
  'use strict';

  // CR to Tier mapping
  const CR_TO_TIER = [
    { maxCR: 1, tier: 1 },
    { maxCR: 4, tier: 2 },
    { maxCR: 10, tier: 3 },
    { maxCR: Infinity, tier: 4 }
  ];

  // CR to suggested adversary type
  const CR_TO_TYPE = [
    { maxCR: 0.25, types: ['Minion'] },
    { maxCR: 1, types: ['Standard', 'Skulk'] },
    { maxCR: 3, types: ['Bruiser', 'Ranged', 'Standard', 'Horde'] },
    { maxCR: 6, types: ['Leader', 'Bruiser'] },
    { maxCR: Infinity, types: ['Solo', 'Leader'] }
  ];

  // Tier-based statistics
  const TIER_STATS = {
    1: { difficulty: 11, majorThresh: 7, severeThresh: 12, atkMod: 1, baseDamage: '1d8+2', hp: 3, stress: 2 },
    2: { difficulty: 14, majorThresh: 10, severeThresh: 20, atkMod: 2, baseDamage: '2d8+3', hp: 5, stress: 3 },
    3: { difficulty: 17, majorThresh: 20, severeThresh: 32, atkMod: 3, baseDamage: '3d8+4', hp: 8, stress: 4 },
    4: { difficulty: 20, majorThresh: 25, severeThresh: 45, atkMod: 4, baseDamage: '4d8+6', hp: 12, stress: 5 }
  };

  // Type modifiers
  const TYPE_MODIFIERS = {
    Bruiser: { hp: 3, stress: 1, threshMod: 1.2, atkMod: 0 },
    Horde: { hp: -1, stress: 0, threshMod: 0.8, atkMod: 0 },
    Leader: { hp: 1, stress: 2, threshMod: 1.1, atkMod: 1 },
    Minion: { hp: -99, stress: 0, threshMod: 0.5, atkMod: -1 }, // HP becomes 1
    Ranged: { hp: -1, stress: 0, threshMod: 0.9, atkMod: 1 },
    Skulk: { hp: 0, stress: 1, threshMod: 0.9, atkMod: 0 },
    Social: { hp: -1, stress: 2, threshMod: 0.7, atkMod: -1 },
    Solo: { hp: 5, stress: 3, threshMod: 1.5, atkMod: 1 },
    Standard: { hp: 0, stress: 0, threshMod: 1.0, atkMod: 0 },
    Support: { hp: -1, stress: 1, threshMod: 0.8, atkMod: 0 }
  };

  // D&D damage types to Daggerheart
  const DAMAGE_TYPE_MAP = {
    slashing: 'phy',
    piercing: 'phy',
    bludgeoning: 'phy',
    fire: 'mag',
    cold: 'mag',
    lightning: 'mag',
    acid: 'mag',
    poison: 'mag',
    necrotic: 'mag',
    radiant: 'mag',
    force: 'mag',
    psychic: 'mag',
    thunder: 'mag'
  };

  // D&D range to Daggerheart range
  const RANGE_MAP = [
    { maxFt: 5, range: 'Melee' },
    { maxFt: 10, range: 'Very Close' },
    { maxFt: 30, range: 'Close' },
    { maxFt: 60, range: 'Far' },
    { maxFt: Infinity, range: 'Very Far' }
  ];

  // Creature type to common tags
  const TYPE_TO_TAGS = {
    aberration: ['aberration', 'horror'],
    beast: ['beast', 'animal'],
    celestial: ['celestial', 'divine'],
    construct: ['construct', 'artificial'],
    dragon: ['dragon', 'legendary'],
    elemental: ['elemental', 'planar'],
    fey: ['fey', 'trickster'],
    fiend: ['fiend', 'infernal'],
    giant: ['giant', 'humanoid'],
    humanoid: ['humanoid'],
    monstrosity: ['monstrosity', 'monster'],
    ooze: ['ooze', 'mindless'],
    plant: ['plant', 'nature'],
    undead: ['undead', 'horror']
  };

  // Common D&D feature to Daggerheart feature mappings
  const FEATURE_TEMPLATES = {
    'magic resistance': {
      name: 'Magic Resistance',
      type: 'Passive',
      desc: 'Has advantage on saves against magic effects. Reduce incoming magic damage by half.'
    },
    'pack tactics': {
      name: 'Pack Tactics',
      type: 'Passive',
      desc: 'Gains +2 to attack rolls when an ally is within Very Close range of the target.'
    },
    'multiattack': {
      name: 'Relentless',
      type: 'Passive',
      desc: 'Can make multiple attacks on its turn. After being attacked, may immediately make one attack as a reaction.'
    },
    'legendary resistance': {
      name: 'Indomitable',
      type: 'Reaction',
      desc: 'When this creature would fail a save, it can choose to succeed instead. Can use this feature 3 times per encounter.'
    },
    'regeneration': {
      name: 'Regeneration',
      type: 'Passive',
      desc: 'At the start of each round, regain HP equal to tier. Stops if dealt fire or radiant damage.'
    },
    'sunlight sensitivity': {
      name: 'Sunlight Sensitivity',
      type: 'Passive',
      desc: 'In direct sunlight, attacks are made with disadvantage and perception checks that rely on sight automatically fail.'
    },
    'spider climb': {
      name: 'Wall Crawler',
      type: 'Passive',
      desc: 'Can move along walls and ceilings without making checks. Ignores difficult terrain from webs.'
    },
    'flyby': {
      name: 'Flyby',
      type: 'Passive',
      desc: 'Does not provoke reactions when flying out of an enemy\'s reach.'
    },
    'keen senses': {
      name: 'Keen Senses',
      type: 'Passive',
      desc: 'Has advantage on Perception checks. Cannot be surprised while conscious.'
    },
    'devil\'s sight': {
      name: 'Devil\'s Sight',
      type: 'Passive',
      desc: 'Can see perfectly in magical and nonmagical darkness.'
    },
    'innate spellcasting': {
      name: 'Innate Magic',
      type: 'Action',
      desc: 'Can cast spells without components. See spell list for available spells.'
    },
    'frightful presence': {
      name: 'Frightful Presence',
      type: 'Action',
      desc: 'All enemies within Far range must make a Presence save or become Frightened and lose 1 Hope.'
    },
    'breath weapon': {
      name: 'Breath Weapon',
      type: 'Action',
      desc: 'Exhales destructive energy in a cone or line. Targets make Agility save or take heavy magic damage. Recharge: Roll d6 at start of turn, recharges on 5-6.'
    }
  };

  /**
   * Determine Daggerheart tier from CR
   */
  function getTier(cr) {
    const numericCR = typeof cr === 'object' ? cr.numeric : cr;
    for (const entry of CR_TO_TIER) {
      if (numericCR <= entry.maxCR) {
        return entry.tier;
      }
    }
    return 4;
  }

  /**
   * Suggest adversary type based on CR and creature traits
   */
  function suggestType(parsed) {
    const cr = parsed.cr.numeric;

    // Check for legendary actions -> Solo
    if (parsed.legendaryActionCount > 0) {
      return 'Solo';
    }

    // Check for multiattack with high CR -> Leader
    if (parsed.hasMultiattack && cr >= 4) {
      return 'Leader';
    }

    // Check if primarily ranged
    if (parsed.primaryAttack && parsed.primaryAttack.attackInfo) {
      if (parsed.primaryAttack.attackInfo.type === 'ranged') {
        return 'Ranged';
      }
    }

    // Check for support-style abilities
    const supportKeywords = ['heal', 'buff', 'aid', 'bless', 'protection'];
    const hasSupport = parsed.traits.some(t =>
      t.description && supportKeywords.some(kw => t.description.toLowerCase().includes(kw))
    ) || parsed.actions.some(a =>
      a.description && supportKeywords.some(kw => a.description.toLowerCase().includes(kw))
    );
    if (hasSupport && cr <= 3) {
      return 'Support';
    }

    // Check for stealth/ambush -> Skulk
    const skulkKeywords = ['stealth', 'sneak', 'ambush', 'surprise', 'hidden'];
    const hasSkulk = parsed.skills.stealth ||
      parsed.traits.some(t => t.name && skulkKeywords.some(kw => t.name.toLowerCase().includes(kw)));
    if (hasSkulk) {
      return 'Skulk';
    }

    // Check HP for bruiser
    if (parsed.hp.value > 50 && cr >= 2) {
      return 'Bruiser';
    }

    // Default based on CR
    for (const entry of CR_TO_TYPE) {
      if (cr <= entry.maxCR) {
        return entry.types[0];
      }
    }

    return 'Standard';
  }

  /**
   * Convert D&D damage type to Daggerheart
   */
  function convertDamageType(dndType) {
    if (!dndType) return 'phy';
    const lower = dndType.toLowerCase();
    return DAMAGE_TYPE_MAP[lower] || 'phy';
  }

  /**
   * Convert D&D range to Daggerheart range
   */
  function convertRange(rangeFt) {
    if (!rangeFt) return 'Melee';

    // Handle "X/Y" format (short/long range)
    const rangeNum = parseInt(rangeFt.toString().split('/')[0]);

    for (const entry of RANGE_MAP) {
      if (rangeNum <= entry.maxFt) {
        return entry.range;
      }
    }
    return 'Very Far';
  }

  /**
   * Scale D&D damage dice to Daggerheart damage
   */
  function convertDamage(avgDamage, damageDice, tier) {
    // Use average damage to determine appropriate Daggerheart damage
    // Daggerheart damage scales differently than 5e

    const baseDamageByTier = {
      1: { low: '1d6+2', mid: '1d8+3', high: '1d10+4', max: '1d12+5' },
      2: { low: '2d6+2', mid: '2d8+3', high: '2d10+4', max: '2d12+5' },
      3: { low: '3d6+3', mid: '3d8+4', high: '3d10+5', max: '3d12+6' },
      4: { low: '4d6+5', mid: '4d8+8', high: '4d10+10', max: '4d12+15' }
    };

    const tierDamage = baseDamageByTier[tier] || baseDamageByTier[2];

    // Map average damage to tier-appropriate Daggerheart damage
    if (!avgDamage || avgDamage <= 5) return tierDamage.low;
    if (avgDamage <= 10) return tierDamage.mid;
    if (avgDamage <= 20) return tierDamage.high;
    return tierDamage.max;
  }

  /**
   * Generate description from D&D creature info
   */
  function generateDescription(parsed) {
    const size = parsed.typeInfo.size.toLowerCase();
    const type = parsed.typeInfo.type.toLowerCase();
    const subtype = parsed.typeInfo.subtype;

    let desc = `A ${size} ${type}`;
    if (subtype) {
      desc += ` (${subtype})`;
    }

    // Add flavor based on creature type
    const flavorByType = {
      fiend: ' radiating malevolent energy.',
      celestial: ' glowing with divine light.',
      undead: ' animated by dark magic.',
      dragon: ' ancient and powerful.',
      aberration: ' defying natural law.',
      construct: ' crafted for a singular purpose.',
      fey: ' with an otherworldly presence.',
      elemental: ' formed of pure elemental essence.'
    };

    desc += flavorByType[type] || '.';
    return desc;
  }

  /**
   * Generate motives based on creature type
   */
  function generateMotives(parsed) {
    const type = parsed.typeInfo.type.toLowerCase();
    const alignment = parsed.typeInfo.alignment?.toLowerCase() || '';

    const motivesByType = {
      fiend: 'Corrupt souls, spread suffering, fulfill dark contracts',
      celestial: 'Protect the innocent, uphold justice, serve divine will',
      undead: 'Feed on the living, spread death, serve dark masters',
      dragon: 'Hoard treasure, dominate territory, display power',
      aberration: 'Consume, corrupt, spread madness',
      construct: 'Follow directives, protect location, eliminate threats',
      fey: 'Pursue amusement, make deals, protect wild places',
      elemental: 'Embody element, destroy opposition, follow summoner',
      beast: 'Hunt prey, protect territory, survive',
      humanoid: 'Achieve goals, protect allies, gain power',
      monstrosity: 'Hunt, feed, protect lair'
    };

    let motives = motivesByType[type] || 'Achieve objectives, eliminate threats';

    // Modify by alignment
    if (alignment.includes('evil')) {
      motives = motives.replace('protect', 'dominate');
    }
    if (alignment.includes('chaotic')) {
      motives += ', cause chaos';
    }

    return motives;
  }

  /**
   * Generate tactics based on abilities
   */
  function generateTactics(parsed) {
    const tactics = [];

    // Based on attack type
    if (parsed.primaryAttack) {
      if (parsed.primaryAttack.attackInfo?.type === 'ranged') {
        tactics.push('Keep distance from enemies');
        tactics.push('Use cover when available');
      } else {
        tactics.push('Close to melee range quickly');
      }
    }

    // Based on multiattack
    if (parsed.hasMultiattack) {
      tactics.push('Focus attacks on single targets');
    }

    // Based on special abilities
    const hasBreath = parsed.actions.some(a =>
      a.name && a.name.toLowerCase().includes('breath')
    );
    if (hasBreath) {
      tactics.push('Open with breath weapon on grouped enemies');
    }

    const hasFlight = parsed.speed.fly;
    if (hasFlight) {
      tactics.push('Use flight to stay out of reach');
    }

    // Default tactics
    if (tactics.length === 0) {
      tactics.push('Engage the nearest threat');
      tactics.push('Retreat if badly wounded');
    }

    return tactics.join('. ') + '.';
  }

  /**
   * Convert D&D feature to Daggerheart feature
   */
  function convertFeature(dndFeature, tier) {
    const nameLower = dndFeature.name.toLowerCase();

    // Check for known feature templates
    for (const [key, template] of Object.entries(FEATURE_TEMPLATES)) {
      if (nameLower.includes(key)) {
        return { ...template };
      }
    }

    // Determine feature type
    let featureType = 'Passive';

    // Check if it's an action
    if (dndFeature.isAttack ||
        dndFeature.description.toLowerCase().includes('can use') ||
        dndFeature.description.toLowerCase().includes('as an action')) {
      featureType = 'Action';
    }

    // Check if it's a reaction
    if (dndFeature.description.toLowerCase().includes('reaction') ||
        dndFeature.description.toLowerCase().includes('when')) {
      featureType = 'Reaction';
    }

    // Convert the description
    let desc = dndFeature.description;

    // Replace DC references with Daggerheart difficulty
    const dcMatch = desc.match(/DC\s*(\d+)/i);
    if (dcMatch) {
      const dc = parseInt(dcMatch[1]);
      const dhDifficulty = TIER_STATS[tier].difficulty;
      desc = desc.replace(/DC\s*\d+/gi, `DC ${dhDifficulty}`);
    }

    // Simplify verbose 5e language
    desc = desc
      .replace(/succeeds on a|makes a|must make a/gi, 'makes')
      .replace(/saving throw/gi, 'save')
      .replace(/the target/gi, 'target')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      name: dndFeature.name,
      type: featureType,
      desc: desc,
      fearCost: 0 // Default no fear cost
    };
  }

  /**
   * Convert attack action to Daggerheart feature
   */
  function convertAttack(attack, tier) {
    const info = attack.attackInfo;
    if (!info) return null;

    const range = convertRange(info.range);
    const damageType = convertDamageType(info.damageType);
    const damage = convertDamage(info.avgDamage, info.damageDice, tier);

    return {
      name: attack.name,
      type: 'Action',
      desc: `${range} attack. ${damage} ${damageType} damage.`,
      isMainAttack: true,
      attackData: {
        range: range,
        damage: damage,
        damageType: damageType,
        toHit: info.toHit
      }
    };
  }

  /**
   * Generate tags from creature info
   */
  function generateTags(parsed) {
    const tags = [];

    // Add type tags
    const typeTags = TYPE_TO_TAGS[parsed.typeInfo.type.toLowerCase()];
    if (typeTags) {
      tags.push(...typeTags);
    }

    // Add subtype as tag
    if (parsed.typeInfo.subtype) {
      tags.push(parsed.typeInfo.subtype.toLowerCase());
    }

    // Add capability tags
    if (parsed.speed.fly) tags.push('flying');
    if (parsed.speed.swim) tags.push('aquatic');
    if (parsed.speed.burrow) tags.push('burrowing');
    if (parsed.senses.darkvision) tags.push('darkvision');
    if (parsed.senses.blindsight) tags.push('blindsight');
    if (parsed.hasSpellcasting) tags.push('spellcaster');
    if (parsed.legendaryActionCount > 0) tags.push('legendary');

    // Add resistance/immunity tags
    if (parsed.damageInfo.immunities.length > 0) {
      tags.push('damage-immune');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Determine best experience skill
   */
  function determineExperience(parsed) {
    const skills = parsed.skills;

    // Map D&D skills to Daggerheart experiences
    const skillMap = {
      perception: 'Perception',
      stealth: 'Stealth',
      intimidation: 'Intimidation',
      deception: 'Deception',
      persuasion: 'Persuasion',
      insight: 'Insight',
      athletics: 'Athletics',
      acrobatics: 'Acrobatics',
      arcana: 'Arcana',
      history: 'History',
      investigation: 'Investigation',
      nature: 'Nature',
      religion: 'Religion',
      survival: 'Survival'
    };

    // Find highest skill
    let bestSkill = null;
    let bestValue = 0;

    for (const [skill, value] of Object.entries(skills)) {
      if (value > bestValue) {
        bestValue = value;
        bestSkill = skillMap[skill.toLowerCase()] || skill;
      }
    }

    if (bestSkill) {
      // Convert 5e bonus to simpler Daggerheart modifier
      const dhMod = Math.max(1, Math.floor(bestValue / 2));
      return `${bestSkill} +${dhMod}`;
    }

    // Default based on creature type
    const typeExperience = {
      fiend: 'Intimidation +2',
      celestial: 'Insight +2',
      undead: 'Intimidation +1',
      dragon: 'Intimidation +3',
      aberration: 'Arcana +2',
      beast: 'Survival +1',
      humanoid: 'Perception +1'
    };

    return typeExperience[parsed.typeInfo.type.toLowerCase()] || 'Perception +1';
  }

  /**
   * Main conversion function
   */
  function convert(parsed, options = {}) {
    const tier = options.tier || getTier(parsed.cr);
    const advType = options.type || suggestType(parsed);

    const tierStats = TIER_STATS[tier];
    const typeMod = TYPE_MODIFIERS[advType] || TYPE_MODIFIERS.Standard;

    // Calculate stats with type modifiers
    let hp = tierStats.hp + typeMod.hp;
    if (advType === 'Minion') hp = 1;
    hp = Math.max(1, hp);

    const stress = Math.max(1, tierStats.stress + typeMod.stress);
    const majorThresh = Math.round(tierStats.majorThresh * typeMod.threshMod);
    const severeThresh = Math.round(tierStats.severeThresh * typeMod.threshMod);
    const atkMod = tierStats.atkMod + typeMod.atkMod;

    // Convert features
    const features = [];

    // Add traits
    for (const trait of parsed.traits) {
      const converted = convertFeature(trait, tier);
      if (converted) features.push(converted);
    }

    // Add non-attack actions as features
    for (const action of parsed.actions) {
      if (!action.isAttack) {
        const converted = convertFeature(action, tier);
        if (converted) features.push(converted);
      }
    }

    // Add reactions
    for (const reaction of parsed.reactions) {
      const converted = convertFeature(reaction, tier);
      if (converted) {
        converted.type = 'Reaction';
        features.push(converted);
      }
    }

    // Add legendary actions as features
    if (parsed.legendaryActionCount > 0) {
      features.push({
        name: `Relentless (${parsed.legendaryActionCount})`,
        type: 'Passive',
        desc: `Can take ${parsed.legendaryActionCount} additional actions per round, usable at the end of another creature's turn.`
      });
    }

    // Find primary attack for main stats
    let weapon = 'Natural Weapon';
    let range = 'Melee';
    let damage = tierStats.baseDamage;
    let dmgType = 'phy';

    if (parsed.primaryAttack && parsed.primaryAttack.attackInfo) {
      weapon = parsed.primaryAttack.name;
      const attackFeature = convertAttack(parsed.primaryAttack, tier);
      if (attackFeature && attackFeature.attackData) {
        range = attackFeature.attackData.range;
        damage = attackFeature.attackData.damage;
        dmgType = attackFeature.attackData.damageType;
      }
    }

    // Add secondary attacks as features
    const secondaryAttacks = parsed.actions.filter(a =>
      a.isAttack && a !== parsed.primaryAttack
    );
    for (const attack of secondaryAttacks) {
      const attackFeature = convertAttack(attack, tier);
      if (attackFeature) {
        features.push(attackFeature);
      }
    }

    // Build the Daggerheart adversary object
    const daggerheart = {
      id: `adv-${parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      category: 'adversary',
      name: parsed.name,
      tier: tier.toString(),
      description: options.description || generateDescription(parsed),
      imageUrl: options.imageUrl || '',
      advType: advType,
      difficulty: tierStats.difficulty,
      majorThresh: majorThresh,
      severeThresh: severeThresh,
      hp: hp,
      stress: stress,
      motives: options.motives || generateMotives(parsed),
      tactics: options.tactics || generateTactics(parsed),
      atkMod: `+${atkMod}`,
      weapon: weapon,
      range: range,
      damage: damage,
      dmgType: dmgType,
      experience: determineExperience(parsed),
      tags: generateTags(parsed),
      features: features,

      // Metadata
      _converted: true,
      _sourceCR: parsed.cr.string,
      _sourceHP: parsed.hp.value
    };

    return daggerheart;
  }

  /**
   * Quick convert - parse and convert in one step
   */
  function quickConvert(rawText, options = {}) {
    // Assumes DnDParser is available
    if (typeof DnDParser === 'undefined') {
      throw new Error('DnDParser must be loaded before DaggerheartConverter');
    }

    const parsed = DnDParser.parse(rawText);
    return convert(parsed, options);
  }

  // Public API
  return {
    convert: convert,
    quickConvert: quickConvert,
    getTier: getTier,
    suggestType: suggestType,
    convertDamageType: convertDamageType,
    convertRange: convertRange,
    convertDamage: convertDamage,
    TIER_STATS: TIER_STATS,
    TYPE_MODIFIERS: TYPE_MODIFIERS
  };
})();

// Export for Node.js / ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DaggerheartConverter;
}
