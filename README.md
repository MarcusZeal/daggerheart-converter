# TTRPG to Daggerheart Converter

A standalone, zero-dependency tool for converting stat blocks from multiple TTRPG systems to Daggerheart format.

## Supported Systems

| System | Status | Notes |
|--------|--------|-------|
| **D&D 5th Edition** | Full Support | 2014 & 2024 editions, D&D Beyond, PDF text |
| **Pathfinder 2e** | Full Support | Archives of Nethys format, Level-based |
| **D&D 3.5e / Pathfinder 1e** | Full Support | SRD format, Full Attack parsing |
| **OSR / B/X** | Full Support | THAC0, HD-based, Old School Essentials |

## Features

- **Multi-System Support** - Auto-detects source system or select manually
- **No API Required** - Pure JavaScript, runs entirely in the browser
- **Live Parsing** - See detected fields as you type with confidence indicators
- **Smart Conversion** - Automatically suggests Tier and Type based on CR/Level
- **Inline Editing** - Edit feature names, descriptions, and types directly in the preview
- **Drag & Drop** - Drop .txt files onto the input area
- **Keyboard Shortcuts** - Fast workflow with Ctrl+Enter, Ctrl+Shift+C, Esc
- **Export Options** - JSON, Markdown, Plain Text, Print

## Quick Start

### Standalone Usage

1. Open `index.html` in any web browser
2. Select source system (or leave on Auto-Detect)
3. Paste a stat block (or drag & drop a .txt file)
4. Watch the live detection show what's being parsed
5. Press `Ctrl+Enter` or click "Convert to Daggerheart"
6. Edit features inline if needed
7. Copy JSON, Markdown, or download

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Convert stat block |
| `Ctrl+Shift+C` | Copy JSON to clipboard |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Esc` | Clear all |

### Files

```
tools/dnd-converter/
├── index.html                    # Standalone web interface
├── dnd-parser.js                 # Legacy D&D 5e parser (for compatibility)
├── daggerheart-converter.js      # Conversion logic
└── parsers/
    ├── parser-manager.js         # Multi-system parser manager
    ├── dnd5e-parser.js           # D&D 5th Edition parser
    ├── pf2e-parser.js            # Pathfinder 2e parser
    ├── dnd35e-parser.js          # D&D 3.5e / PF1e parser
    └── osr-parser.js             # OSR / B/X parser
```

## Integration Guide

### Option 1: Multi-System (Recommended)

```html
<script src="parsers/parser-manager.js"></script>
<script src="parsers/dnd5e-parser.js"></script>
<script src="parsers/pf2e-parser.js"></script>
<script src="parsers/dnd35e-parser.js"></script>
<script src="parsers/osr-parser.js"></script>
<script src="daggerheart-converter.js"></script>

<script>
  // Auto-detect system and parse
  const parsed = ParserManager.parse(statBlockText);
  console.log('Detected system:', parsed._meta.system);

  // Or specify system explicitly
  const parsed5e = ParserManager.parse(statBlockText, { system: 'dnd5e' });
  const parsedPf2e = ParserManager.parse(statBlockText, { system: 'pf2e' });

  // Convert to Daggerheart
  const daggerheart = DaggerheartConverter.convert(parsed);
</script>
```

### Option 2: Single System (Legacy)

```html
<script src="dnd-parser.js"></script>
<script src="daggerheart-converter.js"></script>

<script>
  const parsed = DnDParser.parse(dnd5eStatBlock);
  const daggerheart = DaggerheartConverter.convert(parsed);
</script>
```

## API Reference

### ParserManager

#### `ParserManager.parse(text, options)`

Parses a stat block, auto-detecting system if not specified.

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `system` | string | Force specific system: `'dnd5e'`, `'pf2e'`, `'dnd35e'`, `'osr'`, or `'auto'` |

**Output includes:**
```javascript
{
  name: "Bearded Devil",
  typeInfo: { size: "Medium", type: "fiend", ... },
  ac: { value: 13, type: "natural armor" },
  hp: { value: 52, formula: "8d8 + 16" },
  cr: { string: "3", numeric: 3 },
  // ... other parsed data
  _meta: {
    system: "dnd5e",
    systemInfo: { name: "D&D 5th Edition", shortName: "5e" },
    detected: { system: "dnd5e", confidence: 0.85 }
  }
}
```

#### `ParserManager.detectSystem(text)`

Detects which system a stat block is from.

```javascript
const detected = ParserManager.detectSystem(statBlockText);
// { system: 'pf2e', confidence: 0.8, info: { name: 'Pathfinder 2e', ... } }
```

#### `ParserManager.getAvailableSystems()`

Returns list of available parsers.

```javascript
const systems = ParserManager.getAvailableSystems();
// [{ id: 'dnd5e', name: 'D&D 5th Edition', available: true }, ...]
```

### DaggerheartConverter

#### `DaggerheartConverter.convert(parsed, options)`

Converts parsed data to Daggerheart format. Works with output from any parser.

**Options:**
| Option | Type | Description |
|--------|------|-------------|
| `tier` | number | Override auto-detected tier (1-4) |
| `type` | string | Override suggested type |

## System-Specific Notes

### D&D 5e
- Supports Challenge Rating (CR) format
- Parses Multiattack, Legendary Actions, Lair Actions
- Handles D&D Beyond copy/paste format

### Pathfinder 2e
- Uses Level instead of CR (Level roughly maps to CR for conversion)
- Parses 3-action economy notation: `[one-action]`, `[two-actions]`, etc.
- Extracts traits from bracketed format: `[Fiend] [Devil] [Lawful]`

### D&D 3.5e / Pathfinder 1e
- Parses Hit Dice (HD) format
- Handles Base Attack Bonus and Grapple/CMB
- Supports Full Attack notation
- Extracts DR, SR, and other 3.x-specific stats

### OSR / B/X
- Converts THAC0 to attack bonus
- Handles descending AC (auto-converts to ascending)
- Parses HD-based HP
- Extracts Morale score
- Generates ability scores based on HD and type

## Conversion Rules

### Level/CR to Tier

| Source | Daggerheart Tier |
|--------|------------------|
| CR/Level 0-1 | Tier 1 |
| CR/Level 2-4 | Tier 2 |
| CR/Level 5-10 | Tier 3 |
| CR/Level 11+ | Tier 4 |

### Damage Types

| Source Type | Daggerheart |
|-------------|-------------|
| Slashing, Piercing, Bludgeoning | Physical (phy) |
| Fire, Cold, Lightning, Acid, etc. | Magic (mag) |

### Range Conversion

| Source Range | Daggerheart |
|--------------|-------------|
| 5 ft / Melee | Melee |
| 10 ft | Very Close |
| 30 ft | Close |
| 60 ft | Far |
| 120+ ft | Very Far |

## UI Features

### System Detection

The tool automatically detects which system a stat block is from:
- **Green indicator**: High confidence detection (>60%)
- **Yellow indicator**: Lower confidence, may want to manually select

### Live Detection

As you type, the tool shows what it's detecting:
- **System**: Detected source system
- **Name, CR/Level, HP, AC**: Core stats
- **Type, Size**: Creature classification
- **Actions**: Number of attacks/abilities found

### Sample Stat Blocks

Click sample buttons to load example stat blocks from each system:
- **5e Ogre** - D&D 5e SRD Ogre
- **5e Wight** - D&D 5e SRD Wight
- **PF2e Warrior** - Original Ironscale Warrior
- **3.5e Ogre** - D&D 3.5e SRD Ogre
- **OSR Goblin** - Generic OSR Goblin

## Troubleshooting

### Wrong System Detected

- Use the system dropdown to manually select the correct system
- Some stat blocks mix formats; manual selection helps

### Stats Not Parsing Correctly

- Check that the stat block follows the system's standard format
- Some PDF extractions may need manual cleanup
- Unusual formatting may require editing after conversion

### Features Not Converting Well

- Use inline editing to fix feature names and descriptions
- Click the type badge to change Passive/Action/Reaction
- Add custom features with the "+ Add Feature" button

## Legal Notices

### Trademarks

This tool is not affiliated with, endorsed, sponsored, or specifically approved by Wizards of the Coast LLC, Paizo Inc., or Darrington Press LLC.

- **Dungeons & Dragons**, **D&D**, and **D&D Beyond** are trademarks of Wizards of the Coast LLC.
- **Pathfinder** is a trademark of Paizo Inc.
- **Daggerheart** is a trademark of Darrington Press LLC.

All other trademarks are the property of their respective owners.

### Content Licenses

**D&D 5e SRD Content**: The D&D 5th Edition System Reference Document is licensed under the [Creative Commons Attribution 4.0 International License (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/). Sample stat blocks from the 5e SRD are used under this license.

**D&D 3.5e SRD Content**: The D&D 3.5 System Reference Document is used under the [Open Game License v1.0a](https://opengamingfoundation.org/ogl.html).

**Original Content**: The Pathfinder 2e sample (Ironscale Warrior) and tool code are original creations.

**OSR Content**: Generic OSR stat blocks follow common conventions shared across multiple retroclones and are not derived from any single copyrighted source.

### User Responsibility

This tool processes text that users paste into it. Users are responsible for ensuring they have appropriate rights to use any content they convert. The conversion output is for personal use; redistribution of converted content may require additional licenses.

## License

MIT License - Free to use, modify, and distribute.

```
MIT License

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
