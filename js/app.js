// ==================== STATE ====================
let currentParsed = null;
let currentConverted = null;
let parseDebounceTimer = null;
let saveDebounceTimer = null;
let currentMode = 'single';
let currentSystem = 'auto';
let detectedSystem = null;
let batchResults = [];

// Undo/Redo history
let undoHistory = [];
let historyIndex = -1;
const MAX_HISTORY = 50;

// Recent conversions
const MAX_RECENT = 10;
const STORAGE_KEYS = {
  recent: 'dnd-dh-recent',
  draft: 'dnd-dh-draft'
};

// ==================== SAMPLES BY SYSTEM ====================
// These samples use SRD content (CC-BY-4.0 for 5e, OGL for 3.5e) or original creations
const SAMPLES = {
  dnd5e: {
    // From 5e SRD (CC-BY-4.0)
    ogre: `Ogre
Large giant, chaotic evil
Armor Class 11 (hide armor)
Hit Points 59 (7d10 + 21)
Speed 40 ft.
STR 19 (+4) DEX 8 (-1) CON 16 (+3) INT 5 (-3) WIS 7 (-2) CHA 7 (-2)
Senses darkvision 60 ft., passive Perception 8
Languages Common, Giant
Challenge 2 (450 XP)

Actions
Greatclub. Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 13 (2d8 + 4) bludgeoning damage.

Javelin. Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 30/120 ft., one target. Hit: 11 (2d6 + 4) piercing damage.`,

    // From 5e SRD (CC-BY-4.0)
    wight: `Wight
Medium undead, neutral evil
Armor Class 14 (studded leather)
Hit Points 45 (6d8 + 18)
Speed 30 ft.
STR 15 (+2) DEX 14 (+2) CON 16 (+3) INT 10 (+0) WIS 13 (+1) CHA 15 (+2)
Skills Perception +3, Stealth +4
Damage Resistances necrotic; bludgeoning, piercing, and slashing from nonmagical attacks
Damage Immunities poison
Condition Immunities exhaustion, poisoned
Senses darkvision 60 ft., passive Perception 13
Languages the languages it knew in life
Challenge 3 (700 XP)

Sunlight Sensitivity. While in sunlight, the wight has disadvantage on attack rolls, as well as on Wisdom (Perception) checks that rely on sight.

Actions
Multiattack. The wight makes two longsword attacks or two longbow attacks. It can use its Life Drain in place of one longsword attack.

Life Drain. Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) necrotic damage. The target must succeed on a DC 13 Constitution saving throw or its hit point maximum is reduced by an amount equal to the damage taken.

Longsword. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.`
  },

  pf2e: {
    // Original creation in PF2e format
    ironscale: `Ironscale Warrior
Creature 3
[N] [Medium] [Humanoid] [Lizardfolk]
Perception +9; low-light vision
Languages Common, Draconic
Skills Athletics +10, Intimidation +7, Stealth +8, Survival +9
Str +4, Dex +2, Con +3, Int +0, Wis +2, Cha +1
Items hide armor, steel shield, trident
AC 19 (21 with shield raised); Fort +10, Ref +7, Will +7
HP 45
Shield Block [reaction]
Speed 25 feet, swim 20 feet

Melee [one-action] trident +11 (reach 10 feet), Damage 1d8+6 piercing
Melee [one-action] jaws +11, Damage 1d6+6 piercing
Melee [one-action] tail +11 (agile), Damage 1d4+6 bludgeoning
Ranged [one-action] trident +9 (thrown 20 feet), Damage 1d8+4 piercing

Deep Breath The ironscale warrior can hold their breath for 10 minutes.

Tail Sweep [two-actions] The warrior makes a tail Strike against each enemy within reach. Each attack counts toward their multiple attack penalty, but the penalty doesn't increase until after all attacks.`
  },

  dnd35e: {
    // From 3.5e SRD (OGL)
    ogre: `Ogre
CR 3
CE Large Giant
Init -1; Senses darkvision 60 ft., low-light vision; Listen +2, Spot +2

AC 16, touch 8, flat-footed 16 (-1 size, -1 Dex, +5 natural, +3 hide armor)
hp 29 (4d8+11)
Fort +6, Ref +0, Will +1

Speed 30 ft. (40 ft. base)
Melee greatclub +8 (2d8+7) or
Melee javelin +7 (1d8+5)
Ranged javelin +1 (1d8+5)
Space 10 ft.; Reach 10 ft.

Abilities Str 21, Dex 8, Con 15, Int 6, Wis 10, Cha 7
Base Atk +3; Grp +12
Feats Toughness, Weapon Focus (greatclub)
Skills Climb +5, Listen +2, Spot +2

Ogres are brutish creatures standing 9 to 10 feet tall and weighing 600 to 650 pounds. They favor overwhelming odds and ambush tactics.`
  },

  osr: {
    // Generic OSR stat block (common across many retroclones)
    skeleton: `Skeleton
AC: 7 [12]
HD: 1
Move: 60' (20')
Attacks: 1 (weapon)
Damage: 1d6 or by weapon
No. Appearing: 3d4 (3d10)
Save As: Fighter 1
Morale: 12
Treasure Type: None
Alignment: Chaotic

Animated bones of the dead, driven by dark magic. Immune to sleep, charm, and hold spells. Edged weapons deal half damage. Can be turned by clerics.`,

    // Generic OSR stat block
    goblin: `Goblin
AC: 6 [13]
HD: 1-1
Move: 60' (20')
Attacks: 1 (weapon)
Damage: 1d6 or by weapon
No. Appearing: 2d4 (6d10)
Save As: Normal Human
Morale: 7 (9 with leader)
Treasure Type: R (C)
Alignment: Chaotic

Small, cruel humanoids with sharp teeth and pointed ears. Fight with -1 penalty in bright sunlight. Often led by a chieftain (HD 2, 11 hp). Favor ambushes and overwhelming numbers.`
  }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  setupKeyboardShortcuts();
  loadDraft();
  renderRecentList();
  loadThemePreference();
  setupToastInteraction();
  checkAuthState();
  handleAuthRedirect();
  handleUrlRouting();
  loadFromURL();
  initDiceTooltips();
  initStickyHeaders();
});

// ==================== THEME TOGGLE ====================
function toggleTheme() {
  const isLight = document.documentElement.classList.toggle('light-mode');
  localStorage.setItem('dnd-dh-theme', isLight ? 'light' : 'dark');
  showToast(isLight ? 'Light mode enabled' : 'Dark mode enabled', 'info');
}

function loadThemePreference() {
  const savedTheme = localStorage.getItem('dnd-dh-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
    document.documentElement.classList.add('light-mode');
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('dnd-dh-theme')) {
      document.documentElement.classList.toggle('light-mode', !e.matches);
    }
  });

  // Sync theme across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'dnd-dh-theme') {
      document.documentElement.classList.toggle('light-mode', e.newValue === 'light');
    }
  });
}

// ==================== DRAG AND DROP ====================
function setupDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  const textarea = document.getElementById('inputText');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'));
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
  });

  dropZone.addEventListener('drop', handleDrop);

  function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          textarea.value = event.target.result;
          handleLiveParse();
          saveDraft();
          showToast('File loaded: ' + file.name, 'info');
        };
        reader.readAsText(file);
      } else {
        showToast('Please drop a .txt file', 'error');
      }
    }
  }
}

// ==================== KEYBOARD SHORTCUTS ====================
const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
              (navigator.userAgentData?.platform === 'macOS');
const modKey = isMac ? 'Cmd' : 'Ctrl';

function hasModifier(e) {
  return isMac ? e.metaKey : e.ctrlKey;
}

function updateKeyboardHints() {
  // Update inline hints
  document.querySelectorAll('.keyboard-hint kbd, .shortcut-row kbd').forEach(kbd => {
    if (kbd.textContent === 'Ctrl' || kbd.textContent === 'Cmd') {
      kbd.textContent = modKey;
    }
  });
}

function setupKeyboardShortcuts() {
  // Update displayed keys on load
  updateKeyboardHints();

  document.addEventListener('keydown', (e) => {
    const isTyping = document.activeElement.tagName === 'TEXTAREA' ||
                     document.activeElement.tagName === 'INPUT';

    // ?: Show keyboard shortcuts (only when not typing)
    if (e.key === '?' && !isTyping) {
      e.preventDefault();
      openKeyboardModal();
      return;
    }
    // Cmd/Ctrl+Enter: Convert
    if (hasModifier(e) && e.key === 'Enter') {
      e.preventDefault();
      convert();
    }
    // Cmd/Ctrl+Shift+C: Copy JSON
    if (hasModifier(e) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      copyJSON();
    }
    // Cmd/Ctrl+Z: Undo
    if (hasModifier(e) && e.key === 'z' && !e.shiftKey) {
      if (!isTyping) {
        e.preventDefault();
        undo();
      }
    }
    // Cmd/Ctrl+Y or Cmd/Ctrl+Shift+Z: Redo
    if ((hasModifier(e) && e.key === 'y') || (hasModifier(e) && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      redo();
    }
    // Escape: Clear (only when not in modals)
    if (e.key === 'Escape') {
      const keyboardModal = document.getElementById('keyboardModal');
      if (keyboardModal && !keyboardModal.classList.contains('hidden')) {
        closeKeyboardModal();
        return;
      }
      e.preventDefault();
      clearAll();
    }
  });
}

// ==================== MODE TOGGLE ====================
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
    btn.setAttribute('aria-selected', btn.dataset.mode === mode);
  });
}

// ==================== DRAFT AUTO-SAVE ====================
function saveDraft() {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    const input = document.getElementById('inputText').value;
    if (input.trim()) {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify({
        input: input,
        timestamp: Date.now()
      }));
      document.getElementById('draftIndicator').classList.remove('hidden');
      setTimeout(() => {
        document.getElementById('draftIndicator').classList.add('hidden');
      }, 2000);
    }
  }, 1000);
}

function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(STORAGE_KEYS.draft));
    if (draft && draft.input) {
      const age = Date.now() - draft.timestamp;
      // Only load drafts less than 24 hours old
      if (age < 24 * 60 * 60 * 1000) {
        document.getElementById('inputText').value = draft.input;
        handleLiveParse();
        showToast('Draft restored', 'info');
      }
    }
  } catch (e) {
    // Ignore errors
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.draft);
}

// ==================== RECENT CONVERSIONS ====================
function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.recent)) || [];
  } catch (e) {
    return [];
  }
}

function saveToRecent(converted) {
  const recent = getRecent();
  // Remove duplicates
  const filtered = recent.filter(r => r.id !== converted.id);
  // Add to front
  filtered.unshift({
    id: converted.id,
    name: converted.name,
    tier: converted.tier,
    advType: converted.advType,
    data: converted,
    timestamp: Date.now()
  });
  // Limit size
  const limited = filtered.slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(limited));
  renderRecentList();
}

function renderRecentList() {
  const recent = getRecent();
  const list = document.getElementById('recentList');

  if (recent.length === 0) {
    list.innerHTML = '<div class="recent-item" style="color: var(--text-secondary);">No recent conversions</div>';
    return;
  }

  list.innerHTML = recent.map((r, i) => `
    <div class="recent-item" role="menuitem" onclick="loadRecent(${i})">
      <div>
        <span class="recent-item-name">${escapeHtml(r.name)}</span>
        <span class="recent-item-tier">T${r.tier} ${r.advType}</span>
      </div>
      <span class="recent-item-delete" onclick="event.stopPropagation(); deleteRecent(${i})"
            title="Remove" aria-label="Remove from recent">×</span>
    </div>
  `).join('');
}

function loadRecent(index) {
  const recent = getRecent();
  if (recent[index]) {
    currentConverted = recent[index].data;
    currentParsed = null; // We don't have the parsed data
    pushHistory();
    renderPreview();
    renderJSON();
    renderMarkdown();
    renderText();
    enableButtons();
    toggleRecentMenu();
    showToast('Loaded: ' + recent[index].name, 'info');
  }
}

function deleteRecent(index) {
  const recent = getRecent();
  recent.splice(index, 1);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(recent));
  renderRecentList();
}

function toggleRecentMenu() {
  const menu = document.getElementById('recentMenu');
  const btn = document.getElementById('recentBtn');
  const isOpen = menu.classList.toggle('show');
  btn.setAttribute('aria-expanded', isOpen);
}

function toggleCopyMenu() {
  closeMoreMenu();
  document.getElementById('copyMenu').classList.toggle('show');
}

function closeCopyMenu() {
  document.getElementById('copyMenu').classList.remove('show');
}

function toggleMoreMenu() {
  closeCopyMenu();
  document.getElementById('moreMenu').classList.toggle('show');
}

function closeMoreMenu() {
  document.getElementById('moreMenu').classList.remove('show');
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.recent-dropdown')) {
    document.getElementById('recentMenu').classList.remove('show');
    document.getElementById('recentBtn').setAttribute('aria-expanded', 'false');
  }
  if (!e.target.closest('.action-dropdown')) {
    closeCopyMenu();
    closeMoreMenu();
  }
});

// ==================== UNDO/REDO ====================
function pushHistory() {
  if (!currentConverted) return;

  // Remove any redo history
  history = undoHistory.slice(0, historyIndex + 1);

  // Add current state
  undoHistory.push(JSON.stringify(currentConverted));

  // Limit history size
  if (undoHistory.length > MAX_HISTORY) {
    undoHistory.shift();
  }

  historyIndex = undoHistory.length - 1;
  updateUndoRedoButtons();
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--;
    currentConverted = JSON.parse(history[historyIndex]);
    renderAll();
    updateUndoRedoButtons();
    showToast('Undo', 'info');
  }
}

function redo() {
  if (historyIndex < undoHistory.length - 1) {
    historyIndex++;
    currentConverted = JSON.parse(history[historyIndex]);
    renderAll();
    updateUndoRedoButtons();
    showToast('Redo', 'info');
  }
}

function updateUndoRedoButtons() {
  document.getElementById('undoBtn').disabled = historyIndex <= 0;
  document.getElementById('redoBtn').disabled = historyIndex >= undoHistory.length - 1;
}

// ==================== LIVE PARSING ====================
function handleLiveParse() {
  saveDraft();

  clearTimeout(parseDebounceTimer);
  parseDebounceTimer = setTimeout(() => {
    const input = document.getElementById('inputText').value.trim();

    if (input.length < 20) {
      document.getElementById('liveParsePreview').classList.add('hidden');
      updateDetectedSystemDisplay(null);
      return;
    }

    try {
      // For batch mode, only parse the first block for preview
      const firstBlock = currentMode === 'batch'
        ? input.split(/\n-{3,}\n/)[0]
        : input;

      let parsed;

      // Check for JSON input first (supports 5e.tools, Open5e, World Anvil, CritterDB, Foundry, Improved Initiative)
      if (typeof JSONParser !== 'undefined' && isJSONInput(firstBlock)) {
        try {
          parsed = JSONParser.parse(firstBlock);
          detectedSystem = parsed._meta?.system || 'json';
          updateDetectedSystemDisplay(parsed._meta?.detected);
          renderLivePreview(parsed);
          document.getElementById('liveParsePreview').classList.remove('hidden');
          return;
        } catch (e) {
          // Fall through to text parsers
          console.log('JSON parse failed, trying text parsers:', e.message);
        }
      }

      // Detect system if in auto mode
      if (typeof ParserManager !== 'undefined' && currentSystem === 'auto') {
        const detected = ParserManager.detectSystem(firstBlock);
        detectedSystem = detected.system;
        updateDetectedSystemDisplay(detected);
      }

      // Parse using appropriate parser
      if (typeof ParserManager !== 'undefined') {
        parsed = ParserManager.parse(firstBlock, { system: currentSystem });
      } else {
        parsed = DnDParser.parse(firstBlock);
      }

      renderLivePreview(parsed);
      document.getElementById('liveParsePreview').classList.remove('hidden');
    } catch (e) {
      console.error('Parse error:', e);
      document.getElementById('liveParsePreview').classList.add('hidden');
    }
  }, 300);
}

function renderLivePreview(parsed) {
  // Add system info if available
  const systemInfo = parsed._meta?.systemInfo;
  const systemLabel = systemInfo ? systemInfo.shortName : 'Unknown';

  const fields = [
    { label: 'System', value: systemLabel, confidence: parsed._meta?.detected?.confidence > 0.5 ? 'high' : 'medium' },
    { label: 'Name', value: parsed.name, confidence: parsed.name !== 'Unknown Creature' ? 'high' : 'low' },
    { label: 'CR/Lvl', value: parsed.level ? `Lvl ${parsed.level}` : parsed.cr.string, confidence: parsed.cr.numeric > 0 || parsed.level ? 'high' : 'medium' },
    { label: 'HP', value: parsed.hp.value, confidence: parsed.hp.value > 0 ? 'high' : 'low' },
    { label: 'AC', value: parsed.ac.value, confidence: parsed.ac.value > 0 ? 'high' : 'low' },
    { label: 'Type', value: parsed.typeInfo.type, confidence: parsed.typeInfo.type !== 'creature' ? 'high' : 'medium' },
    { label: 'Size', value: parsed.typeInfo.size, confidence: 'high' },
    { label: 'Actions', value: parsed.actions.length, confidence: parsed.actions.length > 0 ? 'high' : 'low' },
  ];

  document.getElementById('liveParseGrid').innerHTML = fields.map(f => `
    <div class="parse-field">
      <span class="confidence-badge confidence-${f.confidence}" aria-label="${f.confidence} confidence"></span>
      <span class="parse-field-label">${f.label}:</span>
      <span class="parse-field-value">${f.value}</span>
    </div>
  `).join('');
}

// ==================== SYSTEM HANDLING ====================
function handleSystemChange() {
  currentSystem = document.getElementById('systemSelect').value;
  handleLiveParse();
}

function getActiveParser() {
  const system = currentSystem === 'auto' ? (detectedSystem || 'dnd5e') : currentSystem;

  // Use ParserManager if available, otherwise fall back to DnDParser
  if (typeof ParserManager !== 'undefined') {
    return { parser: ParserManager, system: system };
  }
  return { parser: DnDParser, system: 'dnd5e' };
}

function updateDetectedSystemDisplay(detected) {
  const display = document.getElementById('detectedSystem');
  if (detected && currentSystem === 'auto') {
    const confidence = Math.round(detected.confidence * 100);
    const name = detected.info?.shortName || detected.system;
    display.textContent = `Detected: ${name} (${confidence}%)`;
    display.style.color = confidence > 60 ? 'var(--success)' : 'var(--warning)';
  } else {
    display.textContent = '';
  }
}

// ==================== LOAD SAMPLE ====================
function loadSample(system, name) {
  if (SAMPLES[system] && SAMPLES[system][name]) {
    document.getElementById('inputText').value = SAMPLES[system][name];
    // Set the system selector to match the sample
    document.getElementById('systemSelect').value = system;
    currentSystem = system;
    handleLiveParse();
    convert();
  } else {
    showToast('Sample not found', 'error');
  }
}

// ==================== CONVERT ====================
function convert() {
  const input = document.getElementById('inputText').value.trim();
  if (!input) {
    showToast('Please paste a stat block to convert', 'error');
    return;
  }

  try {
    if (currentMode === 'batch') {
      convertBatch(input);
    } else {
      convertSingle(input);
    }

    clearDraft();
    showToast('Converted successfully!', 'success');
  } catch (e) {
    console.error('Conversion error:', e);
    handleParserError(e, input);
  }
}

function handleParserError(error, input) {
  let message = 'Error parsing stat block';
  let details = '';

  // Identify common parsing issues
  if (!input || input.length < 10) {
    message = 'Input too short';
    details = 'Please paste a complete stat block.';
  } else if (error.message.includes('undefined') || error.message.includes('null')) {
    message = 'Could not extract required fields';
    details = 'The stat block format may not be recognized. Try a different source format.';
  } else if (error.message.includes('name')) {
    message = 'Could not find creature name';
    details = 'Make sure the stat block includes the creature name at the top.';
  } else if (error.message.includes('HP') || error.message.includes('hit point')) {
    message = 'Could not parse hit points';
    details = 'Check that HP/Hit Points are included in the stat block.';
  } else if (error.message.includes('AC') || error.message.includes('armor')) {
    message = 'Could not parse armor class';
    details = 'Check that AC is included in the stat block.';
  } else {
    details = error.message;
  }

  showToast(`${message}: ${details}`, 'error');

  // Show more help in the preview area
  document.getElementById('statBlockPreview').innerHTML = `
    <div class="parser-error">
      <h3>Parsing Failed</h3>
      <p><strong>${message}</strong></p>
      <p>${details}</p>
      <h4>Tips:</h4>
      <ul>
        <li>Make sure you're pasting a complete stat block</li>
        <li>Try selecting "Auto-detect" for the source system</li>
        <li>Supported formats: D&D 5e, D&D 2024, Pathfinder 2e, 13th Age</li>
        <li>Copy stat blocks from official sources or VTTs</li>
      </ul>
    </div>
  `;
}

function convertSingle(input) {
  // Check for JSON input first (supports 5e.tools, Open5e, World Anvil, CritterDB, Foundry, Improved Initiative)
  if (typeof JSONParser !== 'undefined' && isJSONInput(input)) {
    try {
      currentParsed = JSONParser.parse(input);
      detectedSystem = currentParsed._meta?.system || 'json';
      updateDetectedSystemDisplay(currentParsed._meta?.detected);
      document.getElementById('adjustments').classList.remove('hidden');
      reconvert();
      return;
    } catch (e) {
      console.log('JSON parse failed, trying text parsers:', e.message);
    }
  }

  // Use ParserManager if available, otherwise fall back to DnDParser
  if (typeof ParserManager !== 'undefined') {
    currentParsed = ParserManager.parse(input, { system: currentSystem });
    // Update detected system display
    if (currentParsed._meta && currentParsed._meta.detected) {
      updateDetectedSystemDisplay(currentParsed._meta.detected);
    }
  } else {
    currentParsed = DnDParser.parse(input);
  }
  document.getElementById('adjustments').classList.remove('hidden');
  reconvert();
}

// Helper to detect if input looks like JSON
function isJSONInput(input) {
  const trimmed = input.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function convertBatch(input) {
  const blocks = input.split(/\n-{3,}\n/).filter(b => b.trim());
  batchResults = [];

  const overrideTier = document.getElementById('overrideTier').value;
  const overrideType = document.getElementById('overrideType').value;
  const options = {};
  if (overrideTier) options.tier = parseInt(overrideTier);
  if (overrideType) options.type = overrideType;

  for (const block of blocks) {
    try {
      // Use ParserManager if available
      let parsed;
      if (typeof ParserManager !== 'undefined') {
        parsed = ParserManager.parse(block.trim(), { system: currentSystem });
      } else {
        parsed = DnDParser.parse(block.trim());
      }
      const converted = DaggerheartConverter.convert(parsed, options);
      batchResults.push({ success: true, data: converted });
      saveToRecent(converted);
    } catch (e) {
      batchResults.push({ success: false, error: e.message, input: block.substring(0, 50) });
    }
  }

  renderBatchResults();
  enableButtons();
}

function renderBatchResults() {
  const container = document.getElementById('statBlockPreview');

  const html = batchResults.map((result, i) => {
    if (result.success) {
      return `
        <div class="batch-item" data-index="${i}">
          <div class="batch-item-header" onclick="toggleBatchItem(${i})">
            <span><strong>${escapeHtml(result.data.name)}</strong> - Tier ${result.data.tier} ${result.data.advType}</span>
            <span class="collapsible-icon">▼</span>
          </div>
          <div class="batch-item-content">
            ${renderStatBlockHTML(result.data)}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="batch-item" style="border-color: var(--error);">
          <div class="batch-item-header">
            <span style="color: var(--error);">Failed: ${escapeHtml(result.input)}...</span>
          </div>
          <div class="batch-item-content">
            <p style="color: var(--error);">${escapeHtml(result.error)}</p>
          </div>
        </div>
      `;
    }
  }).join('');

  container.innerHTML = `<div class="batch-results">${html}</div>`;

  // Set first successful result as current
  const firstSuccess = batchResults.find(r => r.success);
  if (firstSuccess) {
    currentConverted = firstSuccess.data;
    pushHistory();
    renderJSON();
    renderMarkdown();
    renderText();
  }
}

function toggleBatchItem(index) {
  const item = document.querySelector(`.batch-item[data-index="${index}"]`);
  item.classList.toggle('collapsed');
}

function reconvert() {
  if (!currentParsed) return;

  const overrideTier = document.getElementById('overrideTier').value;
  const overrideType = document.getElementById('overrideType').value;

  const options = {};
  if (overrideTier) options.tier = parseInt(overrideTier);
  if (overrideType) options.type = overrideType;

  currentConverted = DaggerheartConverter.convert(currentParsed, options);

  pushHistory();
  saveToRecent(currentConverted);
  renderAll();
  enableButtons();
}

function renderAll() {
  renderPreview();
  renderJSON();
  renderMarkdown();
  renderText();
}

function enableButtons() {
  document.getElementById('copyBtn').disabled = false;
  document.getElementById('copyDropdownBtn').disabled = false;
  document.getElementById('copyMdBtn').disabled = false;
  document.getElementById('copyTextBtn').disabled = false;
  document.getElementById('downloadBtn').disabled = false;
  document.getElementById('libraryBtn').disabled = false;
  document.getElementById('groupBtn').disabled = false;
  document.getElementById('shareBtn').disabled = false;
  document.getElementById('saveBtn').disabled = false;
  document.getElementById('moreBtn').disabled = false;
  document.getElementById('printBtn').disabled = false;
  document.getElementById('urlBtn').disabled = false;
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    if (!currentUser) {
      saveBtn.disabled = true;
      saveBtn.title = 'Sign in to save and publish';
    } else if (!currentConverted) {
      saveBtn.disabled = true;
      saveBtn.title = 'Convert a stat block first';
    } else {
      saveBtn.disabled = false;
      saveBtn.title = 'Save to library and publish to community';
    }
  }
}

// ==================== RENDER PREVIEW ====================
function renderPreview() {
  if (!currentConverted) return;
  document.getElementById('statBlockPreview').innerHTML = renderStatBlockHTML(currentConverted);
  // Auto-resize all textareas
  document.querySelectorAll('.feature-desc-input').forEach(autoResizeTextarea);
}

function renderStatBlockHTML(c) {
  const featuresHTML = c.features.map((f, i) => `
    <div class="feature" data-index="${i}">
      <div class="feature-header">
        <input type="text" class="feature-name-input" value="${escapeHtml(f.name)}"
               onchange="updateFeature(${i}, 'name', this.value)"
               aria-label="Feature name">
        <button class="feature-type feature-type-${f.type.toLowerCase()}"
              onclick="cycleFeatureType(${i})" title="Click to change type"
              aria-label="Feature type: ${f.type}. Click to cycle.">${f.type}</button>
        <span class="feature-actions">
          <button class="feature-btn" onclick="removeFeature(${i})" title="Remove feature"
                  aria-label="Remove feature">✕</button>
        </span>
      </div>
      <textarea class="feature-desc-input"
                onchange="updateFeature(${i}, 'desc', this.value)"
                oninput="autoResizeTextarea(this)"
                aria-label="Feature description">${escapeHtml(f.desc)}</textarea>
    </div>
  `).join('');

  const tagsHTML = c.tags.map((t, i) => `
    <span class="tag" onclick="removeTag(${i})">
      ${escapeHtml(t)}<span class="tag-remove" aria-label="Remove tag">×</span>
    </span>
  `).join('');

  const imageHTML = c.imageUrl
    ? `<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name)}"
           class="stat-block-image-preview" onclick="document.getElementById('imageUrlInput').focus()"
           onerror="this.style.display='none'; document.querySelector('.image-placeholder').style.display='flex';">`
    : `<div class="image-placeholder" onclick="document.getElementById('imageUrlInput').focus()">
         Click to add image URL
       </div>`;

  return `
    <div class="stat-block-header">
      <input type="text" class="stat-block-name-input" value="${escapeHtml(c.name)}"
             onchange="updateName(this.value)" aria-label="Adversary name">
      <div class="stat-block-type">Tier ${c.tier} ${c.advType}</div>
    </div>

    <div class="stat-block-image-section">
      ${imageHTML}
      <div class="image-input-row">
        <input type="url" id="imageUrlInput" class="image-url-input"
               placeholder="Paste image URL or upload file"
               value="${c.imageUrl ? escapeHtml(c.imageUrl) : ''}"
               onchange="updateImageUrl(this.value)"
               aria-label="Image URL">
        <label class="image-upload-btn" for="imageFileInput">Upload</label>
        <input type="file" id="imageFileInput" class="image-upload-input"
               accept="image/*" onchange="handleImageUpload(this)">
      </div>
      <div class="image-hint">
        Max 1MB. Auto-resized to 600px wide, converted to WebP.
        <span class="image-hint-icon">?
          <span class="image-tooltip">
            Large image? Try <a href="https://squoosh.app" target="_blank" rel="noopener">Squoosh.app</a> to compress it first.
          </span>
        </span>
      </div>
      <div id="imageProcessing" class="image-processing" style="display: none;">Processing image...</div>
    </div>

    <div class="stat-block-desc">${escapeHtml(c.description)}</div>

    <div class="stat-line">
      <span class="stat-label">Motives:</span>
      <input type="text" class="stat-value-editable" value="${escapeHtml(c.motives)}"
             onchange="updateStat('motives', this.value)" aria-label="Motives">
    </div>
    <div class="stat-line">
      <span class="stat-label">Tactics:</span>
      <input type="text" class="stat-value-editable" value="${escapeHtml(c.tactics)}"
             onchange="updateStat('tactics', this.value)" aria-label="Tactics">
    </div>

    <div class="stat-grid">
      <div class="stat-item">
        <div class="stat-item-label">Difficulty</div>
        <input type="number" class="stat-item-input" value="${c.difficulty}"
               onchange="updateStat('difficulty', parseInt(this.value))" aria-label="Difficulty">
      </div>
      <div class="stat-item">
        <div class="stat-item-label">Major</div>
        <input type="number" class="stat-item-input" value="${c.majorThresh}"
               onchange="updateStat('majorThresh', parseInt(this.value))" aria-label="Major threshold">
      </div>
      <div class="stat-item">
        <div class="stat-item-label">Severe</div>
        <input type="number" class="stat-item-input" value="${c.severeThresh}"
               onchange="updateStat('severeThresh', parseInt(this.value))" aria-label="Severe threshold">
      </div>
      <div class="stat-item">
        <div class="stat-item-label">HP</div>
        <input type="number" class="stat-item-input" value="${c.hp}"
               onchange="updateStat('hp', parseInt(this.value))" aria-label="Hit points">
      </div>
      <div class="stat-item">
        <div class="stat-item-label">Stress</div>
        <input type="number" class="stat-item-input" value="${c.stress}"
               onchange="updateStat('stress', parseInt(this.value))" aria-label="Stress">
      </div>
      <div class="stat-item">
        <div class="stat-item-label">Attack</div>
        <input type="text" class="stat-item-input" value="${c.atkMod}"
               onchange="updateStat('atkMod', this.value)" aria-label="Attack modifier">
      </div>
    </div>

    <div class="stat-line">
      <span class="stat-label">Weapon:</span>
      <input type="text" class="stat-value-editable" value="${escapeHtml(c.weapon)}"
             onchange="updateStat('weapon', this.value)" style="width: 120px;" aria-label="Weapon">
      <span>(</span>
      <input type="text" class="stat-value-editable" value="${c.range}"
             onchange="updateStat('range', this.value)" style="width: 80px;" aria-label="Range">
      <span>)</span>
    </div>
    <div class="stat-line">
      <span class="stat-label">Damage:</span>
      <input type="text" class="stat-value-editable" value="${c.damage}"
             onchange="updateStat('damage', this.value)" style="width: 80px;" aria-label="Damage dice">
      <input type="text" class="stat-value-editable" value="${c.dmgType}"
             onchange="updateStat('dmgType', this.value)" style="width: 40px;" aria-label="Damage type">
    </div>
    <div class="stat-line">
      <span class="stat-label">Experience:</span>
      <input type="text" class="stat-value-editable" value="${escapeHtml(c.experience)}"
             onchange="updateStat('experience', this.value)" aria-label="Experience">
    </div>

    <!-- Features Section -->
    <div class="collapsible" id="featuresCollapsible">
      <div class="collapsible-header" onclick="toggleCollapsible('featuresCollapsible')"
           role="button" aria-expanded="true" tabindex="0"
           onkeypress="if(event.key==='Enter')toggleCollapsible('featuresCollapsible')">
        <span class="collapsible-title">
          Features (${c.features.length})
          <span style="font-weight: normal; font-size: 0.75rem; color: var(--text-secondary);">click to edit</span>
        </span>
        <span class="collapsible-icon" aria-hidden="true">▼</span>
      </div>
      <div class="collapsible-content features-section">
        ${featuresHTML}
        <button class="add-feature-btn" onclick="addFeature()" aria-label="Add new feature">
          + Add Feature
        </button>
      </div>
    </div>

    <!-- Tags Section -->
    <div class="collapsible" id="tagsCollapsible">
      <div class="collapsible-header" onclick="toggleCollapsible('tagsCollapsible')"
           role="button" aria-expanded="true" tabindex="0"
           onkeypress="if(event.key==='Enter')toggleCollapsible('tagsCollapsible')">
        <span class="collapsible-title">Tags (${c.tags.length})</span>
        <span class="collapsible-icon" aria-hidden="true">▼</span>
      </div>
      <div class="collapsible-content tags-section">
        <div class="tags">
          ${tagsHTML}
          <input type="text" class="add-tag-input" placeholder="+ tag"
                 onkeypress="if(event.key==='Enter'){addTag(this.value);this.value='';}"
                 aria-label="Add new tag">
        </div>
      </div>
    </div>
  `;
}

function toggleCollapsible(id) {
  const el = document.getElementById(id);
  el.classList.toggle('collapsed');
  const header = el.querySelector('.collapsible-header');
  header.setAttribute('aria-expanded', !el.classList.contains('collapsed'));
}

// Read-only version for community viewing - Daggerheart rulebook style
function renderStatBlockReadOnly(c) {
  if (!c) return '<p>No data available</p>';

  // Build features HTML
  const featuresHTML = (c.features || []).map(f => {
    const typeClass = (f.type || 'passive').toLowerCase();
    // Escape first, then highlight dice rolls
    const descWithDice = highlightDiceRolls(escapeHtml(f.desc || ''));
    return `
      <div class="dh-stat-block-feature">
        <span class="dh-stat-block-feature-name">${escapeHtml(f.name)}</span> -
        <span class="dh-stat-block-feature-type ${typeClass}">${f.type || 'Passive'}</span>:
        ${descWithDice}
      </div>
    `;
  }).join('');

  // Build tags HTML
  const tagsHTML = (c.tags || []).map(t => `
    <span class="dh-stat-block-tag">${escapeHtml(t)}</span>
  `).join('');

  // Build motives & tactics line
  let motivesLine = '';
  if (c.motives || c.tactics) {
    const parts = [];
    if (c.motives) parts.push(escapeHtml(c.motives));
    if (c.tactics) parts.push(escapeHtml(c.tactics));
    motivesLine = `
      <div class="dh-stat-block-motives">
        <strong>Motives & Tactics:</strong> ${parts.join('. ')}
      </div>
    `;
  }

  // Build attack line with dice highlighting
  let attackLine = '';
  if (c.atkMod) {
    const damageWithHighlight = highlightDiceRolls(escapeHtml(c.damage || '?'));
    attackLine = `
      <div class="dh-stat-block-stats-line">
        <span class="stat-item"><span class="label">ATK:</span> ${c.atkMod}</span><span class="separator">|</span><span class="stat-item"><span class="label">${escapeHtml(c.weapon || 'Attack')}:</span> ${c.range || 'Melee'}</span><span class="separator">|</span><span class="stat-item">${damageWithHighlight} ${c.dmgType || 'phy'}</span>
      </div>
    `;
  }

  // Build experience line
  let expLine = '';
  if (c.experience) {
    expLine = `
      <div class="dh-stat-block-experience">
        <strong>Experience:</strong> ${escapeHtml(c.experience)}
      </div>
    `;
  }

  // Image (floated right if present)
  const imageHTML = c.imageUrl
    ? `<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name)}" class="dh-stat-block-image">`
    : '';

  const advTypeClass = (c.advType || 'standard').toLowerCase().trim();

  return `
    <div class="dh-stat-block">
      <div class="dh-stat-block-header" data-type="${advTypeClass}">
        <div class="dh-header-main">
          <div class="dh-stat-block-name">${escapeHtml(c.name || 'Unknown')}</div>
          <div class="dh-stat-block-tier">Tier ${c.tier || '?'} ${c.advType || 'Standard'}</div>
        </div>
        <div class="dh-compact-stats">
          <span class="dh-compact-stat"><strong>Diff:</strong> ${c.difficulty || '?'}</span>
          <span class="dh-compact-divider">|</span>
          <span class="dh-compact-stat">${c.majorThresh || '?'}/${c.severeThresh || '?'}</span>
          <span class="dh-compact-divider">|</span>
          <span class="dh-compact-stat"><i class="fa-solid fa-heart"></i> ${c.hp || '?'}</span>
          <span class="dh-compact-divider">|</span>
          <span class="dh-compact-stat"><i class="fa-solid fa-bolt"></i> ${c.stress || '?'}</span>
        </div>
      </div>
      <div class="dh-stat-block-body">
        ${imageHTML}
        ${c.description ? `<div class="dh-stat-block-desc">${escapeHtml(c.description)}</div>` : ''}
        ${motivesLine}
        <div class="dh-vitals-row">
          <div class="dh-vital-box difficulty">
            <span class="dh-vital-value">${c.difficulty || '?'}</span>
            <span class="dh-vital-label">Difficulty</span>
          </div>
          <div class="dh-vital-box hp">
            <span class="dh-vital-value">${c.hp || '?'}</span>
            <span class="dh-vital-label">HP</span>
          </div>
          <div class="dh-vital-box stress">
            <span class="dh-vital-value">${c.stress || '?'}</span>
            <span class="dh-vital-label">Stress</span>
          </div>
        </div>
        <div class="damage-tracker-container">
          <div class="damage-scale-wrapper">
            <div class="damage-cards-row">
              <!-- Card 1: Minor Damage (Symmetrical notches) -->
              <div class="damage-card-wrapper">
                <div class="damage-card-container">
                  <div class="damage-card-body">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 120">
                      <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975" stroke="none">
                        <path d="M -974.223 2292.978 L -974.223 2042.978 L -874.223 1942.978 L -874.223 1442.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                      </g>
                    </svg>
                  </div>
                  <div class="damage-card-text">Minor<br>Damage</div>
                </div>
                <div class="damage-card-footer">
                  <p class="damage-card-footer-text">Mark 1 HP</p>
                </div>
              </div>

              <!-- Connector 1 -->
              <div class="damage-connector">
                <span class="damage-connector-number">${c.majorThresh || '?'}</span>
              </div>

              <!-- Card 2: Major Damage (Arrow on left) -->
              <div class="damage-card-wrapper">
                <div class="damage-card-container">
                  <div class="damage-card-body">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 120">
                      <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975" stroke="none">
                        <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                        <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                      </g>
                    </svg>
                  </div>
                  <div class="damage-card-text">Major<br>Damage</div>
                </div>
                <div class="damage-card-footer">
                  <p class="damage-card-footer-text">Mark 2 HP</p>
                </div>
              </div>

              <!-- Connector 2 -->
              <div class="damage-connector">
                <span class="damage-connector-number">${c.severeThresh || '?'}</span>
              </div>

              <!-- Card 3: Severe Damage (Arrow on left) -->
              <div class="damage-card-wrapper">
                <div class="damage-card-container">
                  <div class="damage-card-body">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 120">
                      <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975" stroke="none">
                        <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                        <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                      </g>
                    </svg>
                  </div>
                  <div class="damage-card-text">Severe<br>Damage</div>
                </div>
                <div class="damage-card-footer">
                  <p class="damage-card-footer-text">Mark 3 HP</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        ${attackLine}
        ${expLine}
        ${(c.features && c.features.length > 0) ? `
          <div class="dh-stat-block-features">
            <div class="dh-stat-block-features-title">Features</div>
            ${featuresHTML}
          </div>
        ` : ''}
        ${(c.tags && c.tags.length > 0) ? `
          <div class="dh-stat-block-tags">${tagsHTML}</div>
        ` : ''}
      </div>
    </div>
  `;
}

// ==================== EDITING FUNCTIONS ====================
function updateStat(key, value) {
  if (currentConverted) {
    currentConverted[key] = value;
    pushHistory();
    renderJSON();
    renderMarkdown();
    renderText();
  }
}

function updateImageUrl(url) {
  if (currentConverted) {
    currentConverted.imageUrl = url.trim();
    pushHistory();
    renderPreview();
    renderJSON();
    renderMarkdown();
    renderText();
  }
}

function updateName(name) {
  if (currentConverted) {
    currentConverted.name = name.trim();
    currentConverted.id = 'adv-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
    pushHistory();
    renderJSON();
    renderMarkdown();
    renderText();
  }
}

async function handleImageUpload(input) {
  const file = input.files?.[0];
  if (!file) return;

  const MAX_SIZE = 1 * 1024 * 1024; // 1MB
  const TARGET_WIDTH = 600;

  // Check file size
  if (file.size > MAX_SIZE) {
    showToast('Image too large. Max size is 1MB. Try compressing it with Squoosh.app', 'error');
    input.value = '';
    return;
  }

  const processingEl = document.getElementById('imageProcessing');
  if (processingEl) processingEl.style.display = 'block';

  try {
    // Read file as data URL
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // Load image
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    // Calculate new dimensions (resize to 600px wide, maintain aspect ratio)
    let width = img.width;
    let height = img.height;

    if (width > TARGET_WIDTH) {
      height = Math.round((height * TARGET_WIDTH) / width);
      width = TARGET_WIDTH;
    }

    // Create canvas and draw resized image
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to WebP
    const webpDataUrl = canvas.toDataURL('image/webp', 0.85);

    // Check final size
    const base64Length = webpDataUrl.length - 'data:image/webp;base64,'.length;
    const finalSize = Math.ceil(base64Length * 0.75);

    if (finalSize > MAX_SIZE) {
      showToast('Processed image still too large. Try a smaller image or use Squoosh.app', 'error');
      input.value = '';
      return;
    }

    // Update the image URL input and save
    document.getElementById('imageUrlInput').value = webpDataUrl;
    updateImageUrl(webpDataUrl);

    const sizeKB = Math.round(finalSize / 1024);
    showToast(`Image uploaded: ${width}x${height}, ${sizeKB}KB`, 'success');

  } catch (err) {
    showToast('Failed to process image: ' + err.message, 'error');
  } finally {
    if (processingEl) processingEl.style.display = 'none';
    input.value = ''; // Reset input for future uploads
  }
}

function updateFeature(index, field, value) {
  if (currentConverted && currentConverted.features[index]) {
    currentConverted.features[index][field] = value;
    pushHistory();
    renderJSON();
    renderMarkdown();
    renderText();
  }
}

function cycleFeatureType(index) {
  if (!currentConverted || !currentConverted.features[index]) return;
  const types = ['Passive', 'Action', 'Reaction'];
  const current = currentConverted.features[index].type;
  const nextIndex = (types.indexOf(current) + 1) % types.length;
  currentConverted.features[index].type = types[nextIndex];
  pushHistory();
  renderPreview();
  renderJSON();
  renderMarkdown();
  renderText();
}

function removeFeature(index) {
  if (currentConverted && currentConverted.features[index]) {
    currentConverted.features.splice(index, 1);
    pushHistory();
    renderPreview();
    renderJSON();
    renderMarkdown();
    renderText();
    showToast('Feature removed', 'info');
  }
}

function addFeature() {
  if (!currentConverted) return;
  currentConverted.features.push({
    name: 'New Feature',
    type: 'Passive',
    desc: 'Description here...'
  });
  pushHistory();
  renderPreview();
  renderJSON();
  renderMarkdown();
  renderText();
  // Focus the new feature name input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.feature-name-input');
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus();
      inputs[inputs.length - 1].select();
    }
  }, 50);
}

function addTag(tag) {
  if (!currentConverted || !tag.trim()) return;
  currentConverted.tags.push(tag.trim().toLowerCase());
  pushHistory();
  renderPreview();
  renderJSON();
}

function removeTag(index) {
  if (currentConverted && currentConverted.tags[index] !== undefined) {
    currentConverted.tags.splice(index, 1);
    pushHistory();
    renderPreview();
    renderJSON();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Calculate dice roll range (min and max)
 * @param {string} diceNotation - e.g., "2d6+3", "1d8", "3d12-2"
 * @returns {object} - { min, max, avg }
 */
function calculateDiceRange(diceNotation) {
  // Pattern: XdY+Z or XdY-Z or just XdY
  const match = diceNotation.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return null;

  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  const min = numDice + modifier; // All 1s
  const max = (numDice * dieSize) + modifier; // All max
  const avg = Math.floor((min + max) / 2);

  return { min, max, avg };
}

/**
 * Highlight dice notation in text with interactive tooltips
 * @param {string} text - Text containing dice notation
 * @returns {string} - HTML with highlighted dice rolls
 */
function highlightDiceRolls(text) {
  if (!text) return '';

  // Pattern to match dice notation: 1d6, 2d8+3, 3d12-2, etc.
  const dicePattern = /(\d+d\d+(?:[+-]\d+)?)/gi;

  return text.replace(dicePattern, (match) => {
    const range = calculateDiceRange(match);
    if (range) {
      const rangeText = `Range: ${range.min}–${range.max} (avg ${range.avg})`;
      return `<span class="dice-roll" data-range="${rangeText}">${match}</span>`;
    }
    return match;
  });
}

/**
 * Initialize dice roll tooltip system
 * Uses a fixed-position element to escape modal overflow clipping
 */
function initDiceTooltips() {
  const tooltip = document.getElementById('dice-tooltip');
  if (!tooltip) return;

  // Use event delegation on document to catch all dice rolls
  document.addEventListener('mouseenter', (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    const diceRoll = e.target.closest('.dice-roll[data-range]');
    if (!diceRoll) return;

    const range = diceRoll.getAttribute('data-range');
    if (!range) return;

    tooltip.textContent = range;

    // Position the tooltip
    const rect = diceRoll.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Calculate center position above the element
    let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
    let top = rect.top - tooltip.offsetHeight - 8;

    // Ensure tooltip stays within viewport bounds
    const padding = 10;

    // Check left edge
    if (left < padding) {
      left = padding;
    }
    // Check right edge
    if (left + tooltip.offsetWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltip.offsetWidth - padding;
    }
    // If too close to top, show below instead
    if (top < padding) {
      top = rect.bottom + 8;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
  }, true);

  document.addEventListener('mouseleave', (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    const diceRoll = e.target.closest('.dice-roll[data-range]');
    if (!diceRoll) return;
    tooltip.classList.remove('visible');
  }, true);
}

// Legacy function - now a no-op since tooltips use event delegation
function positionDiceTooltips(container) {
  // Tooltips now use fixed positioning with event delegation
  // This function is kept for backward compatibility
}

/**
 * Initialize sticky header scroll behavior for modals
 * Headers shrink when user scrolls down
 */
function initStickyHeaders() {
  // Use event delegation for scroll events on modal cards
  document.querySelectorAll('.dh-modal-card').forEach(modal => {
    modal.addEventListener('scroll', () => {
      const header = modal.querySelector('.dh-stat-block-header');
      if (header) {
        // Use hysteresis: compact at 30px, but only expand back at 5px
        // This prevents the animation from interfering with scroll-to-top
        if (modal.scrollTop > 30) {
          header.classList.add('compact');
        } else if (modal.scrollTop <= 5) {
          header.classList.remove('compact');
        }
      }
    });
  });
}

// Escape for use in JavaScript string literals inside HTML attributes
// Must escape for JS first, then HTML-encode for the attribute context
function escapeJsString(text) {
  if (!text) return '';
  return String(text)
    // First: escape for JavaScript
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    // Then: HTML-encode special chars for the HTML attribute context
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

// ==================== RENDER JSON ====================
function renderJSON() {
  if (!currentConverted) return;
  const exportObj = getExportObject();
  document.getElementById('jsonOutput').textContent = JSON.stringify(exportObj, null, 2);
}

// ==================== RENDER MARKDOWN ====================
function renderMarkdown() {
  if (!currentConverted) return;
  const c = currentConverted;

  const featuresText = c.features.map(f =>
    `**${f.name}** *(${f.type})*: ${f.desc}`
  ).join('\n\n');

  const imageSection = c.imageUrl ? `![${c.name}](${c.imageUrl})\n\n` : '';

  const md = `# ${c.name}
*Tier ${c.tier} ${c.advType}*

${imageSection}${c.description}

**Motives:** ${c.motives}
**Tactics:** ${c.tactics}

| Stat | Value |
|------|-------|
| Difficulty | ${c.difficulty} |
| Thresholds | ${c.majorThresh}/${c.severeThresh} |
| HP | ${c.hp} |
| Stress | ${c.stress} |
| Attack | ${c.atkMod} |
| Damage | ${c.damage} ${c.dmgType} |

**Weapon:** ${c.weapon} (${c.range})
**Experience:** ${c.experience}

## Features

${featuresText}

---
*Tags: ${c.tags.join(', ')}*`;

  document.getElementById('markdownOutput').textContent = md;
}

// ==================== RENDER TEXT ====================
function renderText() {
  if (!currentConverted) return;
  const c = currentConverted;

  const featuresText = c.features.map(f =>
    `${f.name} - ${f.type}: ${f.desc}`
  ).join('\n');

  const imageSection = c.imageUrl ? `Image: ${c.imageUrl}\n\n` : '';

  const text = `${c.name.toUpperCase()}
Tier ${c.tier} ${c.advType}

${imageSection}${c.description}
Motives & Tactics: ${c.motives}
Difficulty: ${c.difficulty} | Thresholds: ${c.majorThresh}/${c.severeThresh} | HP: ${c.hp} | Stress: ${c.stress}
ATK: ${c.atkMod} | ${c.weapon}: ${c.range} | ${c.damage} ${c.dmgType}
Experience: ${c.experience}

FEATURES
${featuresText}

Tags: ${c.tags.join(', ')}`;

  document.getElementById('textOutput').textContent = text;
}

// ==================== TABS ====================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => {
    const isActive = t.dataset.tab === tab;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
  });

  ['preview', 'json', 'markdown', 'text'].forEach(t => {
    document.getElementById(t + 'Tab').classList.toggle('hidden', t !== tab);
  });
}

// ==================== EXPORT FUNCTIONS ====================
function getExportObject() {
  const exportObj = { ...currentConverted };
  delete exportObj._converted;
  delete exportObj._sourceCR;
  delete exportObj._sourceHP;
  return exportObj;
}

function animateCopyButton(buttonId, originalText) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.innerHTML = '✓ Copied!';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.classList.remove('copied');
  }, 2000);
}

function copyJSON() {
  if (!currentConverted) {
    showToast('Nothing to copy. Convert a stat block first.', 'error');
    return;
  }
  const exportObj = getExportObject();
  navigator.clipboard.writeText(JSON.stringify(exportObj, null, 2))
    .then(() => {
      showToast('JSON copied!', 'success');
      animateCopyButton('copyBtn', 'Copy JSON');
    })
    .catch(() => showToast('Failed to copy', 'error'));
}

function copyMarkdown() {
  if (!currentConverted) {
    showToast('Nothing to copy. Convert a stat block first.', 'error');
    return;
  }
  navigator.clipboard.writeText(document.getElementById('markdownOutput').textContent)
    .then(() => {
      showToast('Markdown copied!', 'success');
      animateCopyButton('copyMdBtn', 'Copy MD');
    })
    .catch(() => showToast('Failed to copy', 'error'));
}

function copyText() {
  if (!currentConverted) {
    showToast('Nothing to copy. Convert a stat block first.', 'error');
    return;
  }
  navigator.clipboard.writeText(document.getElementById('textOutput').textContent)
    .then(() => {
      showToast('Text copied!', 'success');
      animateCopyButton('copyTextBtn', 'Copy Text');
    })
    .catch(() => showToast('Failed to copy', 'error'));
}

function downloadJSON() {
  if (!currentConverted) {
    showToast('Nothing to download. Convert a stat block first.', 'error');
    return;
  }
  const exportObj = getExportObject();
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentConverted.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded: ' + currentConverted.id + '.json', 'success');
}

function shareAsURL() {
  if (!currentConverted) {
    showToast('Nothing to share. Convert a stat block first.', 'error');
    return;
  }
  try {
    const exportObj = getExportObject();
    const json = JSON.stringify(exportObj);
    const encoded = btoa(encodeURIComponent(json));
    const shareUrl = `${window.location.origin}${window.location.pathname}?d=${encoded}`;

    if (shareUrl.length > 8000) {
      showToast('Conversion too large to share via URL. Use JSON copy instead.', 'warning');
      return;
    }

    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        showToast('Share URL copied! Anyone with this link can view this conversion.', 'success');
        animateCopyButton('urlBtn', 'URL');
      })
      .catch(() => showToast('Failed to copy URL', 'error'));
  } catch (e) {
    console.error('Share URL error:', e);
    showToast('Failed to create share URL', 'error');
  }
}

function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('d');

  if (data) {
    try {
      const json = decodeURIComponent(atob(data));
      const conversion = JSON.parse(json);

      // Validate it looks like a conversion
      if (!conversion.name || !conversion.category) {
        throw new Error('Invalid conversion data');
      }

      // Load the conversion
      currentConverted = conversion;
      renderAll();
      enableButtons();

      // Clear the URL parameter to avoid confusion
      window.history.replaceState({}, '', window.location.pathname);

      showToast(`Loaded shared conversion: ${conversion.name}`, 'success');
      showPage('converter');
    } catch (e) {
      console.error('Failed to load from URL:', e);
      showToast('Invalid or corrupted share link', 'error');
    }
  }
}

function addToLibrary() {
  if (!currentConverted) {
    showToast('Nothing to add. Convert a stat block first.', 'error');
    return;
  }

  // Try to add to the main app's library if available
  try {
    // Check if we're in an iframe or have access to parent
    if (window.opener && window.opener.addToLibraryFromConverter) {
      window.opener.addToLibraryFromConverter(getExportObject());
      showToast('Added to library!', 'success');
      return;
    }

    // Check localStorage for the main app's library
    const existingLibrary = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    const exportObj = getExportObject();
    exportObj._userCreated = true;

    // Check for duplicates
    const exists = existingLibrary.some(item => item.id === exportObj.id);
    if (exists) {
      // Update existing
      const index = existingLibrary.findIndex(item => item.id === exportObj.id);
      existingLibrary[index] = exportObj;
      showToast('Updated in library!', 'success');
    } else {
      existingLibrary.push(exportObj);
      showToast('Added to library!', 'success');
    }

    localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));
  } catch (e) {
    console.error(e);
    showToast('Could not add to library: ' + e.message, 'error');
  }
}

function addConvertedToGroup() {
  if (!currentConverted) {
    showToast('Nothing to add. Convert a stat block first.', 'error');
    return;
  }

  // First add to library if not already there
  try {
    const existingLibrary = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    const exportObj = getExportObject();
    exportObj._userCreated = true;

    const existing = existingLibrary.findIndex(item => item.id === exportObj.id);
    if (existing < 0) {
      existingLibrary.push(exportObj);
      localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));
    }

    // Then open group selection modal
    addAdversaryToGroup(exportObj);
  } catch (e) {
    console.error(e);
    showToast('Could not add to group: ' + e.message, 'error');
  }
}

// ==================== CLEAR ====================
function clearAll() {
  document.getElementById('inputText').value = '';
  document.getElementById('liveParsePreview').classList.add('hidden');
  document.getElementById('adjustments').classList.add('hidden');
  document.getElementById('overrideTier').value = '';
  document.getElementById('overrideType').value = '';

  ['copyBtn', 'copyDropdownBtn', 'copyMdBtn', 'copyTextBtn', 'downloadBtn', 'libraryBtn', 'groupBtn', 'shareBtn', 'saveBtn', 'moreBtn', 'printBtn', 'urlBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  document.getElementById('statBlockPreview').innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">⚔️</div>
      <div>Paste a stat block and press <kbd>Ctrl</kbd>+<kbd>Enter</kbd></div>
      <div style="margin-top: 0.5rem; font-size: 0.85rem;">or click "Convert to Daggerheart"</div>
    </div>
  `;
  document.getElementById('jsonOutput').textContent = '// JSON output will appear here';
  document.getElementById('markdownOutput').textContent = 'Markdown output will appear here';
  document.getElementById('textOutput').textContent = 'Text output will appear here';

  currentParsed = null;
  currentConverted = null;
  batchResults = [];
  history = [];
  historyIndex = -1;
  updateUndoRedoButtons();

  clearDraft();
  showToast('Cleared', 'info');
}

// ==================== TOAST ====================
let toastTimeout = null;
let toastStartTime = null;
let toastDuration = 3000;
let toastRemainingTime = 0;
let toastProgressInterval = null;

function setupToastInteraction() {
  const toast = document.getElementById('toast');

  toast.addEventListener('mouseenter', () => {
    pauseToast();
  });

  toast.addEventListener('mouseleave', () => {
    resumeToast();
  });

  // Also pause on focus (for keyboard users)
  toast.addEventListener('focusin', () => {
    pauseToast();
  });

  toast.addEventListener('focusout', (e) => {
    // Only resume if focus left the toast entirely
    if (!toast.contains(e.relatedTarget)) {
      resumeToast();
    }
  });
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastProgress = document.getElementById('toastProgress');

  // Clear any existing timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  if (toastProgressInterval) {
    clearInterval(toastProgressInterval);
  }

  toastMessage.textContent = message;
  toast.className = `toast toast-${type} show`;
  toastProgress.style.width = '100%';

  toastDuration = 3000;
  toastStartTime = Date.now();
  toastRemainingTime = toastDuration;

  // Animate progress bar
  toastProgressInterval = setInterval(() => {
    const elapsed = Date.now() - toastStartTime;
    const remaining = Math.max(0, toastDuration - elapsed);
    const percent = (remaining / toastDuration) * 100;
    toastProgress.style.width = percent + '%';
  }, 50);

  // Auto-dismiss after duration
  toastTimeout = setTimeout(() => {
    dismissToast();
  }, toastDuration);
}

function pauseToast() {
  const toast = document.getElementById('toast');
  if (!toast.classList.contains('show')) return;

  toast.classList.add('paused');
  toastRemainingTime = Math.max(0, toastDuration - (Date.now() - toastStartTime));

  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (toastProgressInterval) {
    clearInterval(toastProgressInterval);
    toastProgressInterval = null;
  }
}

function resumeToast() {
  const toast = document.getElementById('toast');
  const toastProgress = document.getElementById('toastProgress');
  if (!toast.classList.contains('show')) return;

  toast.classList.remove('paused');
  toastStartTime = Date.now();
  toastDuration = toastRemainingTime;

  // Resume progress bar animation
  toastProgressInterval = setInterval(() => {
    const elapsed = Date.now() - toastStartTime;
    const remaining = Math.max(0, toastDuration - elapsed);
    const percent = (remaining / toastDuration) * 100;
    toastProgress.style.width = percent + '%';
  }, 50);

  // Resume auto-dismiss
  toastTimeout = setTimeout(() => {
    dismissToast();
  }, toastRemainingTime);
}

function dismissToast() {
  const toast = document.getElementById('toast');
  const toastProgress = document.getElementById('toastProgress');

  toast.classList.remove('show', 'paused');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (toastProgressInterval) {
    clearInterval(toastProgressInterval);
    toastProgressInterval = null;
  }

  toastProgress.style.width = '0%';
}

// ==================== AUTH STATE ====================
let currentUser = null;

async function checkAuthState() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    currentUser = data.user;
    renderAuthUI();
  } catch (err) {
    console.log('Auth check failed (server may not be running):', err.message);
    currentUser = null;
    renderAuthUI();
  }
}

function handleAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'success') {
    showToast('Logged in successfully!', 'success');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('error') === 'auth_failed') {
    showToast('Login failed. Please try again.', 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function renderAuthUI() {
  const authSection = document.getElementById('authSection');
  if (!authSection) return;

  // Show/hide My Submissions filter button
  const mySubmissionsBtn = document.getElementById('mySubmissionsBtn');
  if (mySubmissionsBtn) {
    mySubmissionsBtn.style.display = currentUser ? '' : 'none';
  }

  // Update save button state based on login
  updateSaveButtonState();

  // Show/hide admin elements
  const adminNavLink = document.getElementById('adminNavLink');
  if (adminNavLink) {
    adminNavLink.classList.toggle('hidden', !currentUser?.is_admin);
  }

  if (currentUser) {
    const initial = currentUser.username.charAt(0).toUpperCase();
    authSection.innerHTML = `
      <div class="user-menu">
        <button class="user-menu-toggle" onclick="toggleUserMenu()" aria-haspopup="true" aria-expanded="false">
          <div class="user-avatar">
            ${currentUser.avatar_url
              ? `<img src="${currentUser.avatar_url}" alt="${currentUser.username}">`
              : initial}
          </div>
          <span>${currentUser.username}</span>
        </button>
        <div class="user-dropdown" id="userDropdown">
          <button class="user-dropdown-item" onclick="navigateTo('community'); setCommunityFilter('mine'); toggleUserMenu();">My Submissions</button>
          <button class="user-dropdown-item danger" onclick="logout()">Logout</button>
        </div>
      </div>
    `;
  } else {
    authSection.innerHTML = `
      <button class="btn-login" onclick="openLoginModal()">
        Sign In
      </button>
    `;
  }
}

// ==================== PAGE NAVIGATION ====================
let currentPage = 'converter';

// Map URL paths to page names
const URL_TO_PAGE = {
  '/': 'converter',
  '/converter': 'converter',
  '/community': 'community',
  '/collection': 'myLibrary',
  '/encounters': 'encounter-builder',
  '/admin': 'admin'
};

// Map page names to URL paths
const PAGE_TO_URL = {
  'converter': '/',
  'community': '/community',
  'myLibrary': '/collection',
  'encounter-builder': '/encounters',
  'admin': '/admin'
};

function navigateTo(page, updateUrl = true) {
  // Block non-admins from admin page
  if (page === 'admin' && !currentUser?.is_admin) {
    page = 'converter';
  }

  currentPage = page;

  // Update URL without page reload
  if (updateUrl) {
    const url = PAGE_TO_URL[page] || '/';
    window.history.pushState({ page }, '', url);
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Update page views
  document.querySelectorAll('.page-view').forEach(view => {
    view.classList.toggle('active', view.id === page + 'Page');
  });

  // Load community when navigating to it
  if (page === 'community' && !communityLoaded) {
    loadCommunityConversions();
  }

  // Load My Library when navigating to it
  if (page === 'myLibrary') {
    loadMyLibrary();
  }

  // Load admin data when navigating to it
  if (page === 'admin' && currentUser?.is_admin) {
    loadAdminData();
  }

  // Initialize encounter builder when navigating to it
  if (page === 'encounter-builder') {
    initEncounterBuilder();
  }
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (event) => {
  const page = event.state?.page || URL_TO_PAGE[window.location.pathname] || 'converter';
  navigateTo(page, false);
});

// Initialize page from URL on load
function initRouting() {
  const page = URL_TO_PAGE[window.location.pathname] || 'converter';
  // Replace current history entry with proper state
  window.history.replaceState({ page }, '', window.location.pathname);
  navigateTo(page, false);
}

// ==================== ENCOUNTER BUILDER ====================

// Battle Points costs by adversary type
const ADV_TYPE_BATTLE_POINTS = {
  'Minion': 1, 'Social': 1, 'Support': 1,
  'Horde': 2, 'Ranged': 2, 'Skulk': 2, 'Standard': 2,
  'Leader': 3, 'Bruiser': 4, 'Solo': 5
};

// Encounter state
let encounterState = {
  partySize: 4,
  name: '',
  budgetAdjustment: 0,
  roster: [] // [{adversaryId, adversary, count, tierOverride}]
};

// Tier scaling statistics
const TIER_STATS = {
  1: { atkMod: '+1', damage: '1d6+2 to 1d12+4', difficulty: 11, majorThresh: 7, severeThresh: 12 },
  2: { atkMod: '+2', damage: '2d6+3 to 2d12+4', difficulty: 14, majorThresh: 10, severeThresh: 20 },
  3: { atkMod: '+3', damage: '3d8+3 to 3d12+5', difficulty: 17, majorThresh: 20, severeThresh: 32 },
  4: { atkMod: '+4', damage: '4d8+10 to 4d12+15', difficulty: 20, majorThresh: 25, severeThresh: 45 }
};

// ==================== COMBAT MODE ====================

// Daggerheart conditions
const DH_CONDITIONS = ['Restrained', 'Vulnerable', 'Hidden', 'Frightened', 'Slowed', 'Weakened', 'Empowered', 'Marked'];

// Combat state
let combatState = {
  active: false,
  encounterName: '',
  fear: 0,
  hope: 0,
  adversaries: [], // [{id, name, advType, maxHp, currentDamage, maxStress, currentStress, conditions, notes, defeated}]
  party: [], // [{name, hp, stress, armor}]
  log: [],
  undoStack: []
};

// Start combat from current encounter roster
function startCombat() {
  if (encounterState.roster.length === 0) {
    showToast('Add adversaries to start combat', 'error');
    return;
  }

  // Initialize combat state
  combatState.active = true;
  combatState.encounterName = encounterState.name || 'Unnamed Encounter';
  combatState.fear = 0;
  combatState.hope = 0;
  combatState.adversaries = [];
  combatState.log = [];
  combatState.undoStack = [];

  // Create combat instances for each adversary
  let instanceId = 0;
  encounterState.roster.forEach(item => {
    const adv = item.adversary;
    const scaled = getScaledStats(adv, item.tierOverride);
    const hp = parseInt(scaled.hp) || parseInt(adv.hp) || 5;
    const stress = parseInt(adv.stress) || 3;
    const majorThresh = parseInt(scaled.majorThresh) || parseInt(adv.majorThresh) || Math.floor(hp * 0.5);
    const severeThresh = parseInt(scaled.severeThresh) || parseInt(adv.severeThresh) || Math.floor(hp * 0.8);

    for (let i = 0; i < item.count; i++) {
      combatState.adversaries.push({
        id: `combat-${instanceId++}`,
        name: item.count > 1 ? `${adv.name} #${i + 1}` : adv.name,
        advType: adv.advType || 'Standard',
        tier: item.tierOverride || parseInt(adv.tier) || 2,
        maxHp: hp,
        currentDamage: 0,
        majorThresh,
        severeThresh,
        maxStress: stress,
        stressTaken: 0,
        damage: scaled.damage || adv.damage || '2d6+3',
        conditions: [],
        notes: '',
        defeated: false
      });
    }
  });

  // Load saved party or create default
  const savedParty = JSON.parse(localStorage.getItem('dh-combat-party') || '[]');
  combatState.party = savedParty.length > 0 ? savedParty : [
    { name: 'Player 1', hp: 0, maxHp: 6, stress: 0, maxStress: 6, armor: 0 },
    { name: 'Player 2', hp: 0, maxHp: 6, stress: 0, maxStress: 6, armor: 0 },
    { name: 'Player 3', hp: 0, maxHp: 6, stress: 0, maxStress: 6, armor: 0 },
    { name: 'Player 4', hp: 0, maxHp: 6, stress: 0, maxStress: 6, armor: 0 }
  ];

  // Log combat start
  addCombatLog(`Combat started: ${combatState.encounterName}`, 'info');

  // Show combat mode
  document.querySelector('.encounter-builder-container').classList.add('combat-active');
  document.getElementById('combat-mode').classList.add('active');
  document.getElementById('combat-encounter-name').textContent = combatState.encounterName;

  renderCombatAdversaries();
  renderPartyTracker();
  updateCombatPools();
  saveCombatState();
}

// End combat
function endCombat() {
  if (!confirm('End combat and return to encounter builder?')) return;

  combatState.active = false;
  document.querySelector('.encounter-builder-container').classList.remove('combat-active');
  document.getElementById('combat-mode').classList.remove('active');

  addCombatLog('Combat ended', 'info');
  localStorage.removeItem('dh-active-combat');
}

// Render combat adversary cards
function renderCombatAdversaries() {
  const container = document.getElementById('combat-adversaries');

  container.innerHTML = combatState.adversaries.map(adv => {
    const hpPercent = (adv.currentDamage / adv.maxHp) * 100;
    const isDefeated = adv.currentDamage >= adv.maxHp;
    const isMajor = adv.currentDamage >= adv.majorThresh && !isDefeated;
    const isSevere = adv.currentDamage >= adv.severeThresh && !isDefeated;

    // Build HP boxes
    let hpBoxesHtml = '<div class="combat-hp-boxes">';
    for (let i = 1; i <= adv.maxHp; i++) {
      const isFilled = i <= adv.currentDamage;
      const isMajorBox = i === adv.majorThresh;
      const isSevereBox = i === adv.severeThresh;
      let boxClass = 'hp-box';
      if (isFilled) boxClass += ' filled';
      if (i > adv.majorThresh && i <= adv.severeThresh) boxClass += ' major-threshold';
      if (i > adv.severeThresh) boxClass += ' severe-threshold';

      // Add threshold markers
      if (i === adv.majorThresh) {
        hpBoxesHtml += `<div class="hp-threshold-marker major" data-label="Major"></div>`;
      }
      if (i === adv.severeThresh) {
        hpBoxesHtml += `<div class="hp-threshold-marker severe" data-label="Severe"></div>`;
      }

      hpBoxesHtml += `<div class="${boxClass}" onclick="toggleHpBox('${adv.id}', ${i})" title="HP ${i}/${adv.maxHp}"></div>`;
    }
    hpBoxesHtml += '</div>';

    // Build stress boxes (fill up like HP)
    let stressHtml = '<div class="combat-stress-boxes">';
    for (let i = 0; i < adv.maxStress; i++) {
      const isFilled = i < adv.stressTaken;
      stressHtml += `<div class="stress-box ${isFilled ? 'filled' : ''}" onclick="toggleStressBox('${adv.id}', ${i})" title="Click to ${isFilled ? 'remove' : 'mark'} stress"></div>`;
    }
    stressHtml += '</div>';

    // Build conditions
    let conditionsHtml = '<div class="combat-conditions">';
    adv.conditions.forEach(cond => {
      conditionsHtml += `<span class="condition-tag">${cond} <span class="remove-condition" onclick="removeCondition('${adv.id}', '${cond}')">&times;</span></span>`;
    });
    conditionsHtml += `<div class="condition-dropdown">
      <button class="add-condition-btn" onclick="toggleConditionMenu('${adv.id}')">+ Condition</button>
      <div class="condition-menu" id="condition-menu-${adv.id}">
        ${DH_CONDITIONS.filter(c => !adv.conditions.includes(c)).map(c =>
          `<div class="condition-option" onclick="addCondition('${adv.id}', '${c}')">${c}</div>`
        ).join('')}
      </div>
    </div></div>`;

    const cardClass = `combat-card ${isDefeated ? 'defeated' : ''} ${isSevere ? 'threshold-severe' : isMajor ? 'threshold-major' : ''}`;

    return `
      <div class="${cardClass}" id="combat-card-${adv.id}">
        <div class="combat-card-header">
          <div>
            <span class="combat-card-name">${isDefeated ? '<s>' + adv.name + '</s>' : adv.name}</span>
            <span class="combat-card-meta">T${adv.tier} ${adv.advType}</span>
          </div>
          <span class="combat-card-meta">${adv.currentDamage}/${adv.maxHp} damage${isDefeated ? ' - DEFEATED' : ''}</span>
        </div>
        <div class="combat-card-body">
          <div class="combat-hp-section">
            <div class="combat-hp-label">
              <span>Damage (click to mark)</span>
              <span>${isSevere ? '⚠️ SEVERE' : isMajor ? '⚠️ Major' : ''}</span>
            </div>
            ${hpBoxesHtml}
          </div>

          <div class="combat-stress-section">
            <span class="combat-stress-label">Stress:</span>
            ${stressHtml}
          </div>

          <div class="combat-damage-controls">
            <button class="damage-btn" onclick="dealDamage('${adv.id}', 1)">+1</button>
            <button class="damage-btn" onclick="dealDamage('${adv.id}', 5)">+5</button>
            <button class="damage-btn" onclick="dealDamage('${adv.id}', 10)">+10</button>
            <input type="number" class="damage-input" id="custom-dmg-${adv.id}" placeholder="#" min="1">
            <button class="damage-btn custom" onclick="dealCustomDamage('${adv.id}')">Deal</button>
            <button class="damage-btn heal" onclick="healDamage('${adv.id}', 1)">−1</button>
            ${adv.damage ? `<button class="combat-damage-dice" onclick="rollDamage('${adv.damage}')" title="Click to roll ${adv.damage}"><i class="fas fa-dice-d20"></i> ${adv.damage}</button>` : ''}
          </div>

          ${conditionsHtml}

          <div class="combat-notes">
            <textarea class="combat-notes-input" placeholder="Notes..." rows="1" onchange="updateCombatNotes('${adv.id}', this.value)">${adv.notes}</textarea>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle HP box (click to fill/unfill)
function toggleHpBox(advId, boxNum) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv) return;

  saveUndoState();

  // If clicking on a filled box, unfill from there to the end
  // If clicking on an empty box, fill up to and including that box
  if (boxNum <= adv.currentDamage) {
    // Clicking on filled box - heal to this point
    const healed = adv.currentDamage - (boxNum - 1);
    adv.currentDamage = boxNum - 1;
    addCombatLog(`${adv.name} healed ${healed} damage (${adv.currentDamage}/${adv.maxHp})`, 'heal');
  } else {
    // Clicking on empty box - deal damage to this point
    const dealt = boxNum - adv.currentDamage;
    adv.currentDamage = boxNum;

    if (adv.currentDamage >= adv.maxHp) {
      adv.defeated = true;
      addCombatLog(`${adv.name} DEFEATED!`, 'defeated');
    } else if (adv.currentDamage >= adv.severeThresh) {
      addCombatLog(`${adv.name} took ${dealt} damage - SEVERE THRESHOLD! (${adv.currentDamage}/${adv.maxHp})`, 'damage');
    } else if (adv.currentDamage >= adv.majorThresh) {
      addCombatLog(`${adv.name} took ${dealt} damage - Major threshold (${adv.currentDamage}/${adv.maxHp})`, 'damage');
    } else {
      addCombatLog(`${adv.name} took ${dealt} damage (${adv.currentDamage}/${adv.maxHp})`, 'damage');
    }
  }

  renderCombatAdversaries();
  saveCombatState();
}

// Deal damage
function dealDamage(advId, amount) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv || adv.defeated) return;

  saveUndoState();
  adv.currentDamage = Math.min(adv.maxHp, adv.currentDamage + amount);

  if (adv.currentDamage >= adv.maxHp) {
    adv.defeated = true;
    addCombatLog(`${adv.name} took ${amount} damage - DEFEATED!`, 'defeated');
  } else if (adv.currentDamage >= adv.severeThresh && adv.currentDamage - amount < adv.severeThresh) {
    addCombatLog(`${adv.name} took ${amount} damage - SEVERE THRESHOLD! (${adv.currentDamage}/${adv.maxHp})`, 'damage');
  } else if (adv.currentDamage >= adv.majorThresh && adv.currentDamage - amount < adv.majorThresh) {
    addCombatLog(`${adv.name} took ${amount} damage - Major threshold (${adv.currentDamage}/${adv.maxHp})`, 'damage');
  } else {
    addCombatLog(`${adv.name} took ${amount} damage (${adv.currentDamage}/${adv.maxHp})`, 'damage');
  }

  renderCombatAdversaries();
  saveCombatState();
}

// Deal custom damage
function dealCustomDamage(advId) {
  const input = document.getElementById(`custom-dmg-${advId}`);
  const amount = parseInt(input.value);
  if (!amount || amount < 1) return;
  dealDamage(advId, amount);
  input.value = '';
}

// Heal damage
function healDamage(advId, amount) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv) return;

  saveUndoState();
  const oldDamage = adv.currentDamage;
  adv.currentDamage = Math.max(0, adv.currentDamage - amount);
  adv.defeated = adv.currentDamage >= adv.maxHp;

  if (oldDamage !== adv.currentDamage) {
    addCombatLog(`${adv.name} healed ${oldDamage - adv.currentDamage} damage (${adv.currentDamage}/${adv.maxHp})`, 'heal');
  }

  renderCombatAdversaries();
  saveCombatState();
}

// Toggle stress pip
function toggleStressBox(advId, boxIndex) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv) return;

  saveUndoState();

  if (boxIndex < adv.stressTaken) {
    // Remove stress (clicking a filled box)
    adv.stressTaken = boxIndex;
    addCombatLog(`${adv.name} cleared stress (${adv.stressTaken}/${adv.maxStress})`, 'heal');
  } else {
    // Add stress (clicking an empty box)
    adv.stressTaken = boxIndex + 1;
    addCombatLog(`${adv.name} took stress (${adv.stressTaken}/${adv.maxStress})`, 'stress');
  }

  renderCombatAdversaries();
  saveCombatState();
}

// Condition management
function toggleConditionMenu(advId) {
  const menu = document.getElementById(`condition-menu-${advId}`);
  document.querySelectorAll('.condition-menu').forEach(m => {
    if (m !== menu) m.classList.remove('open');
  });
  menu.classList.toggle('open');
}

function addCondition(advId, condition) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv || adv.conditions.includes(condition)) return;

  saveUndoState();
  adv.conditions.push(condition);
  addCombatLog(`${adv.name} gained condition: ${condition}`, 'info');

  document.getElementById(`condition-menu-${advId}`).classList.remove('open');
  renderCombatAdversaries();
  saveCombatState();
}

function removeCondition(advId, condition) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv) return;

  saveUndoState();
  adv.conditions = adv.conditions.filter(c => c !== condition);
  addCombatLog(`${adv.name} lost condition: ${condition}`, 'info');

  renderCombatAdversaries();
  saveCombatState();
}

// Update notes
function updateCombatNotes(advId, notes) {
  const adv = combatState.adversaries.find(a => a.id === advId);
  if (!adv) return;
  adv.notes = notes;
  saveCombatState();
}

// Fear/Hope pools
function adjustFear(amount) {
  saveUndoState();
  combatState.fear = Math.max(0, combatState.fear + amount);
  updateCombatPools();
  addCombatLog(`Fear ${amount > 0 ? 'gained' : 'spent'}: now ${combatState.fear}`, 'fear');
  saveCombatState();
}

function adjustHope(amount) {
  saveUndoState();
  combatState.hope = Math.max(0, combatState.hope + amount);
  updateCombatPools();
  addCombatLog(`Hope ${amount > 0 ? 'gained' : 'spent'}: now ${combatState.hope}`, 'hope');
  saveCombatState();
}

function updateCombatPools() {
  document.getElementById('fear-value').textContent = combatState.fear;
  document.getElementById('hope-value').textContent = combatState.hope;
}

// Dice roller
function rollDamage(diceNotation) {
  const result = rollDice(diceNotation);
  if (!result) return;

  // Show roll result popup
  const popup = document.createElement('div');
  popup.className = 'dice-roller-result';
  popup.innerHTML = `
    <div class="dice-roll-value">${result.total}</div>
    <div class="dice-roll-notation">${diceNotation}</div>
    <div class="dice-roll-breakdown">[${result.rolls.join(', ')}]${result.modifier ? ` ${result.modifier >= 0 ? '+' : ''}${result.modifier}` : ''}</div>
  `;
  document.body.appendChild(popup);

  addCombatLog(`Rolled ${diceNotation}: ${result.total} [${result.rolls.join(', ')}]${result.modifier ? ` ${result.modifier >= 0 ? '+' : ''}${result.modifier}` : ''}`, 'info');

  setTimeout(() => popup.remove(), 2000);
}

function rollDice(notation) {
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/i);
  if (!match) return null;

  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;

  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    rolls.push(Math.floor(Math.random() * dieSize) + 1);
  }

  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { rolls, modifier, total };
}

// Party tracker
function renderPartyTracker() {
  const container = document.getElementById('party-members');

  container.innerHTML = combatState.party.map((member, idx) => `
    <div class="party-member">
      <div class="party-member-name">
        <input type="text" value="${member.name}" onchange="updatePartyMember(${idx}, 'name', this.value)" placeholder="Name">
      </div>
      <div class="party-stat">
        <span>HP:</span>
        <input type="number" class="party-stat-input" value="${member.hp}" onchange="updatePartyMember(${idx}, 'hp', this.value)" min="0">
        <span>/</span>
        <input type="number" class="party-stat-input" value="${member.maxHp}" onchange="updatePartyMember(${idx}, 'maxHp', this.value)" min="1">
      </div>
      <div class="party-stat">
        <span>Stress:</span>
        <input type="number" class="party-stat-input" value="${member.stress}" onchange="updatePartyMember(${idx}, 'stress', this.value)" min="0">
        <span>/</span>
        <input type="number" class="party-stat-input" value="${member.maxStress}" onchange="updatePartyMember(${idx}, 'maxStress', this.value)" min="1">
      </div>
      <button class="btn btn-secondary btn-small" onclick="removePartyMember(${idx})" title="Remove">&times;</button>
    </div>
  `).join('');
}

function addPartyMember() {
  combatState.party.push({ name: `Player ${combatState.party.length + 1}`, hp: 0, maxHp: 6, stress: 0, maxStress: 6, armor: 0 });
  renderPartyTracker();
  savePartyState();
}

function removePartyMember(idx) {
  combatState.party.splice(idx, 1);
  renderPartyTracker();
  savePartyState();
}

function updatePartyMember(idx, field, value) {
  if (field === 'name') {
    combatState.party[idx][field] = value;
  } else {
    combatState.party[idx][field] = parseInt(value) || 0;
  }
  savePartyState();
}

function savePartyState() {
  localStorage.setItem('dh-combat-party', JSON.stringify(combatState.party));
}

// Combat log
function addCombatLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  combatState.log.unshift({ message, type, time });

  // Keep log size manageable
  if (combatState.log.length > 100) combatState.log.pop();

  renderCombatLog();
}

function renderCombatLog() {
  const container = document.getElementById('combat-log-entries');
  if (!container) return;

  container.innerHTML = combatState.log.slice(0, 50).map(entry => `
    <div class="log-entry ${entry.type}">
      <span class="log-entry-time">${entry.time}</span> ${entry.message}
    </div>
  `).join('');
}

function clearCombatLog() {
  combatState.log = [];
  renderCombatLog();
}

// Undo system
function saveUndoState() {
  const state = JSON.stringify({
    fear: combatState.fear,
    hope: combatState.hope,
    adversaries: combatState.adversaries.map(a => ({...a, conditions: [...a.conditions]}))
  });
  combatState.undoStack.push(state);
  if (combatState.undoStack.length > 50) combatState.undoStack.shift();
}

function undoCombatAction() {
  if (combatState.undoStack.length === 0) {
    showToast('Nothing to undo', 'info');
    return;
  }

  const state = JSON.parse(combatState.undoStack.pop());
  combatState.fear = state.fear;
  combatState.hope = state.hope;
  combatState.adversaries = state.adversaries;

  addCombatLog('Action undone', 'info');
  renderCombatAdversaries();
  updateCombatPools();
  saveCombatState();
}

// Save/Load combat state
function saveCombatState() {
  if (!combatState.active) return;
  localStorage.setItem('dh-active-combat', JSON.stringify(combatState));
}

function loadCombatState() {
  const saved = localStorage.getItem('dh-active-combat');
  if (!saved) return false;

  try {
    const loaded = JSON.parse(saved);
    if (loaded.active) {
      combatState = loaded;
      return true;
    }
  } catch (e) {
    console.error('Failed to load combat state:', e);
  }
  return false;
}

// Resume combat if there was an active combat
function checkForActiveCombat() {
  if (loadCombatState() && combatState.active) {
    document.querySelector('.encounter-builder-container').classList.add('combat-active');
    document.getElementById('combat-mode').classList.add('active');
    document.getElementById('combat-encounter-name').textContent = combatState.encounterName;
    renderCombatAdversaries();
    renderPartyTracker();
    updateCombatPools();
    renderCombatLog();
    showToast('Resumed active combat', 'info');
  }
}

// Export combat summary
function exportCombatSummary() {
  const defeated = combatState.adversaries.filter(a => a.defeated).length;
  const remaining = combatState.adversaries.filter(a => !a.defeated).length;

  let summary = `# Combat Summary: ${combatState.encounterName}\n\n`;
  summary += `## Results\n`;
  summary += `- Adversaries Defeated: ${defeated}\n`;
  summary += `- Adversaries Remaining: ${remaining}\n`;
  summary += `- Final Fear: ${combatState.fear}\n`;
  summary += `- Final Hope: ${combatState.hope}\n\n`;

  summary += `## Adversary Status\n`;
  combatState.adversaries.forEach(adv => {
    summary += `- **${adv.name}** (${adv.advType}): ${adv.defeated ? 'DEFEATED' : `${adv.currentDamage}/${adv.maxHp} damage`}`;
    if (adv.conditions.length > 0) summary += ` [${adv.conditions.join(', ')}]`;
    if (adv.notes) summary += ` - ${adv.notes}`;
    summary += '\n';
  });

  summary += `\n## Combat Log\n`;
  combatState.log.slice().reverse().forEach(entry => {
    summary += `[${entry.time}] ${entry.message}\n`;
  });

  // Copy to clipboard
  navigator.clipboard.writeText(summary).then(() => {
    showToast('Combat summary copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback: show in modal or alert
    alert(summary);
  });
}

// Debounce for search
let encounterSearchTimeout = null;
function debouncedFilterEncounterLibrary() {
  clearTimeout(encounterSearchTimeout);
  encounterSearchTimeout = setTimeout(renderEncounterLibrary, 150);
}

// XSS prevention
function escapeHtmlEncounter(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getAdvTypeBattlePoints(advType) {
  return ADV_TYPE_BATTLE_POINTS[advType] || 2;
}

function calculateBudget(partySize) {
  return (3 * partySize) + 2 + encounterState.budgetAdjustment;
}

function updateBudgetAdjustments() {
  let adjustment = 0;
  if (document.getElementById('adj-easier')?.checked) adjustment -= 1;
  if (document.getElementById('adj-multi-solo')?.checked) adjustment -= 2;
  if (document.getElementById('adj-damage-boost')?.checked) adjustment -= 2;
  if (document.getElementById('adj-lower-tier')?.checked) adjustment += 1;
  if (document.getElementById('adj-no-heavy')?.checked) adjustment += 1;
  if (document.getElementById('adj-harder')?.checked) adjustment += 2;

  encounterState.budgetAdjustment = adjustment;

  // Update summary display
  const summaryEl = document.getElementById('adjustment-summary');
  if (summaryEl) {
    const sign = adjustment >= 0 ? '+' : '';
    summaryEl.textContent = `(${sign}${adjustment})`;
  }

  updateBudgetDisplay();
}

function scaleTier(adversaryId, delta) {
  const item = encounterState.roster.find(r => r.adversaryId === adversaryId);
  if (!item) return;

  const baseTier = parseInt(item.adversary.tier) || 2;
  const currentTier = item.tierOverride || baseTier;
  const newTier = Math.max(1, Math.min(4, currentTier + delta));

  item.tierOverride = newTier;
  renderEncounterRoster();
}

function getScaledStats(adversary, tierOverride) {
  const baseTier = parseInt(adversary.tier) || 2;
  const targetTier = tierOverride || baseTier;

  if (targetTier === baseTier) {
    return {
      tier: baseTier,
      difficulty: adversary.difficulty,
      majorThresh: adversary.majorThresh,
      severeThresh: adversary.severeThresh,
      atkMod: adversary.atkMod,
      damage: adversary.damage,
      hp: adversary.hp,
      stress: adversary.stress,
      scaled: false
    };
  }

  const tierStats = TIER_STATS[targetTier];

  // Calculate HP/Stress adjustment when scaling between tier groups
  let hpAdjust = 0;
  let stressAdjust = 0;
  if ((baseTier <= 2 && targetTier >= 3) || (baseTier >= 3 && targetTier <= 2)) {
    hpAdjust = targetTier > baseTier ? 2 : -2;
    stressAdjust = targetTier > baseTier ? 1 : -1;
  }

  return {
    tier: targetTier,
    difficulty: tierStats.difficulty,
    majorThresh: tierStats.majorThresh,
    severeThresh: tierStats.severeThresh,
    atkMod: tierStats.atkMod,
    damage: tierStats.damage.split(' to ')[0], // Use lower end of range
    hp: Math.max(1, (parseInt(adversary.hp) || 3) + hpAdjust),
    stress: Math.max(1, (parseInt(adversary.stress) || 2) + stressAdjust),
    scaled: true
  };
}

function calculateUsedPoints() {
  return encounterState.roster.reduce((sum, item) => {
    const bp = getAdvTypeBattlePoints(item.adversary.advType);
    return sum + (bp * item.count);
  }, 0);
}

function adjustPartySize(delta) {
  encounterState.partySize = Math.max(1, Math.min(10, encounterState.partySize + delta));
  document.getElementById('party-size-value').textContent = encounterState.partySize;
  updateBudgetDisplay();
}

function updateBudgetDisplay() {
  const budget = calculateBudget(encounterState.partySize);
  const used = calculateUsedPoints();
  const percent = Math.min(100, (used / budget) * 100);

  document.getElementById('budget-total').textContent = budget;
  document.getElementById('budget-used').textContent = used;
  document.getElementById('encounter-total-bp').textContent = used;

  const fill = document.getElementById('budget-bar-fill');
  fill.style.width = percent + '%';
  fill.classList.remove('warning', 'danger');
  if (used > budget) fill.classList.add('danger');
  else if (percent > 75) fill.classList.add('warning');
}

function addToEncounter(adversaryId) {
  const existing = encounterState.roster.find(r => r.adversaryId === adversaryId);
  if (existing) {
    existing.count++;
  } else {
    const adversary = getAllLibraryAdversaries().find(a => a.id === adversaryId);
    if (adversary) {
      encounterState.roster.push({ adversaryId, adversary, count: 1 });
    }
  }
  renderEncounterRoster();
  updateBudgetDisplay();
}

function removeFromEncounter(adversaryId) {
  const idx = encounterState.roster.findIndex(r => r.adversaryId === adversaryId);
  if (idx !== -1) {
    if (encounterState.roster[idx].count > 1) {
      encounterState.roster[idx].count--;
    } else {
      encounterState.roster.splice(idx, 1);
    }
  }
  renderEncounterRoster();
  updateBudgetDisplay();
}

function renderEncounterLibrary() {
  const container = document.getElementById('encounter-library-list');
  if (!container) return;

  const search = document.getElementById('encounter-library-search')?.value?.toLowerCase() || '';
  const adversaries = getAllLibraryAdversaries().filter(a =>
    a.name.toLowerCase().includes(search) ||
    (a.advType || '').toLowerCase().includes(search)
  );

  if (adversaries.length === 0) {
    container.innerHTML = '<div class="empty-state">No adversaries in library. Add some from the Converter!</div>';
    return;
  }

  container.innerHTML = adversaries.map(adv => {
    const bp = getAdvTypeBattlePoints(adv.advType);
    const cardTypeClass = (adv.advType || 'standard').toLowerCase().trim();
    const difficulty = adv.difficulty || '?';
    const hp = adv.hp || '?';
    const stress = adv.stress || '?';
    const majorThresh = adv.majorThresh || '?';
    const severeThresh = adv.severeThresh || '?';
    const description = adv.description || '';
    const motives = adv.motives || adv.tactics || '';

    // Build attack line
    let attackLine = '';
    if (adv.atkMod && adv.atkMod !== '?') {
      attackLine = `<span class="dh-stat-item"><span class="dh-stat-label">ATK:</span> ${adv.atkMod}</span>`;
      if (adv.weapon) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${adv.weapon}: ${adv.range || ''}</span>`;
      if (adv.damage) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${highlightDiceRolls(adv.damage)}${adv.dmgType ? ' ' + adv.dmgType : ''}</span>`;
    }

    return `
      <div class="community-item library-draggable encounter-library-card"
           draggable="true"
           data-adversary-id="${escapeHtmlEncounter(adv.id)}"
           ondragstart="handleEncounterDragStart(event, '${escapeHtmlEncounter(adv.id)}')"
           ondragend="handleEncounterDragEnd(event)"
           onclick="addToEncounter('${escapeHtmlEncounter(adv.id)}')">
        <div class="dh-card-header" data-type="${cardTypeClass}">
          <div class="dh-card-name">${escapeHtmlEncounter(adv.name || 'Unknown')}</div>
          <div class="dh-card-tier-type">Tier ${adv.tier || '?'} ${adv.advType || 'Standard'}</div>
        </div>
        <div class="dh-card-body">
          ${description ? `<div class="dh-card-description">${escapeHtmlEncounter(description)}</div>` : ''}
          ${motives ? `<div class="dh-card-motives"><strong>Motives & Tactics:</strong> ${escapeHtmlEncounter(motives)}</div>` : ''}
          <div class="mini-stats-container">
            <div class="mini-vitals-row">
              <div class="mini-vital-box difficulty">
                <span class="mini-vital-value">${difficulty}</span>
                <span class="mini-vital-label">Diff</span>
              </div>
              <div class="mini-vital-box hp">
                <span class="mini-vital-value">${hp}</span>
                <span class="mini-vital-label">HP</span>
              </div>
              <div class="mini-vital-box stress">
                <span class="mini-vital-value">${stress}</span>
                <span class="mini-vital-label">Stress</span>
              </div>
            </div>
            <div class="mini-damage-tracker">
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -874.223 1942.978 L -874.223 1442.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Minor</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${majorThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Major</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${severeThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Severe</span>
              </div>
            </div>
            ${attackLine ? `<div class="dh-card-stats-row">${attackLine}</div>` : ''}
          </div>
        </div>
        <div class="encounter-bp-overlay">${bp} BP</div>
        <div class="library-drag-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/>
            <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
            <circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');
}

// Encounter-specific drag handlers
let encounterDraggedAdversary = null;

function handleEncounterDragStart(event, adversaryId) {
  const adv = getAllLibraryAdversaries().find(a => a.id === adversaryId);
  if (!adv) return;

  encounterDraggedAdversary = adv;
  event.target.classList.add('dragging');
  event.dataTransfer.setData('text/plain', adversaryId);
  event.dataTransfer.effectAllowed = 'copy';
}

function handleEncounterDragEnd(event) {
  event.target.classList.remove('dragging');
  encounterDraggedAdversary = null;
  document.getElementById('encounter-roster')?.classList.remove('drag-over');
}

function handleEncounterRosterDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  document.getElementById('encounter-roster')?.classList.add('drag-over');
}

function handleEncounterRosterDragLeave(event) {
  // Only remove if leaving the roster entirely
  if (!event.currentTarget.contains(event.relatedTarget)) {
    document.getElementById('encounter-roster')?.classList.remove('drag-over');
  }
}

function handleEncounterRosterDrop(event) {
  event.preventDefault();
  document.getElementById('encounter-roster')?.classList.remove('drag-over');

  const adversaryId = event.dataTransfer.getData('text/plain');
  if (adversaryId) {
    addToEncounter(adversaryId);
  }
}

function renderEncounterRoster() {
  const container = document.getElementById('encounter-roster');
  if (!container) return;

  if (encounterState.roster.length === 0) {
    container.innerHTML = '<div class="empty-state">Click or drag adversaries from your library to add them</div>';
    return;
  }

  container.innerHTML = encounterState.roster.map(item => {
    const adv = item.adversary;
    const bp = getAdvTypeBattlePoints(adv.advType);
    const totalBp = bp * item.count;
    const cardTypeClass = (adv.advType || 'standard').toLowerCase().trim();

    // Get scaled stats
    const scaled = getScaledStats(adv, item.tierOverride);
    const baseTier = parseInt(adv.tier) || 2;
    const currentTier = item.tierOverride || baseTier;

    const difficulty = scaled.difficulty || '?';
    const hp = scaled.hp || '?';
    const stress = scaled.stress || '?';
    const majorThresh = scaled.majorThresh || '?';
    const severeThresh = scaled.severeThresh || '?';
    const description = adv.description || '';
    const motives = adv.motives || adv.tactics || '';

    // Build attack line with scaled values
    let attackLine = '';
    const atkMod = scaled.atkMod || adv.atkMod;
    const damage = scaled.scaled ? scaled.damage : adv.damage;
    if (atkMod && atkMod !== '?') {
      attackLine = `<span class="dh-stat-item"><span class="dh-stat-label">ATK:</span> ${atkMod}</span>`;
      if (adv.weapon) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${adv.weapon}: ${adv.range || ''}</span>`;
      if (damage) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${highlightDiceRolls(damage)}${adv.dmgType ? ' ' + adv.dmgType : ''}</span>`;
    }

    return `
      <div class="community-item encounter-roster-card"
           data-adversary-id="${escapeHtmlEncounter(item.adversaryId)}"
           onclick="openMyLibraryAdversary('${escapeHtmlEncounter(item.adversaryId)}')">
        <div class="dh-card-header" data-type="${cardTypeClass}">
          <div class="dh-card-name">${escapeHtmlEncounter(adv.name || 'Unknown')}</div>
          <div class="dh-card-tier-type">Tier ${currentTier} ${adv.advType || 'Standard'}</div>
        </div>
        <div class="dh-card-body">
          ${description ? `<div class="dh-card-description">${escapeHtmlEncounter(description)}</div>` : ''}
          ${motives ? `<div class="dh-card-motives"><strong>Motives & Tactics:</strong> ${escapeHtmlEncounter(motives)}</div>` : ''}
          <div class="mini-stats-container">
            <div class="mini-vitals-row">
              <div class="mini-vital-box difficulty">
                <span class="mini-vital-value">${difficulty}</span>
                <span class="mini-vital-label">Diff</span>
              </div>
              <div class="mini-vital-box hp">
                <span class="mini-vital-value">${hp}</span>
                <span class="mini-vital-label">HP</span>
              </div>
              <div class="mini-vital-box stress">
                <span class="mini-vital-value">${stress}</span>
                <span class="mini-vital-label">Stress</span>
              </div>
            </div>
            <div class="mini-damage-tracker">
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -874.223 1942.978 L -874.223 1442.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Minor</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${majorThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Major</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${severeThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Severe</span>
              </div>
            </div>
            ${attackLine ? `<div class="dh-card-stats-row">${attackLine}</div>` : ''}
          </div>
        </div>
        <div class="encounter-roster-controls" onclick="event.stopPropagation()">
          <div class="tier-scale-controls">
            <button class="tier-scale-btn" onclick="scaleTier('${escapeHtmlEncounter(item.adversaryId)}', -1)" ${currentTier <= 1 ? 'disabled' : ''}>▼</button>
            <span class="tier-scale-display">T${currentTier}</span>
            <button class="tier-scale-btn" onclick="scaleTier('${escapeHtmlEncounter(item.adversaryId)}', 1)" ${currentTier >= 4 ? 'disabled' : ''}>▲</button>
          </div>
          <button class="party-btn" onclick="removeFromEncounter('${escapeHtmlEncounter(item.adversaryId)}')">−</button>
          <span class="encounter-count">${item.count}</span>
          <button class="party-btn" onclick="addToEncounter('${escapeHtmlEncounter(item.adversaryId)}')">+</button>
        </div>
        <div class="encounter-bp-overlay">${totalBp} BP</div>
        ${scaled.scaled ? `<div class="tier-scaled-badge">Scaled from T${baseTier}</div>` : ''}
      </div>
    `;
  }).join('');
}

function clearEncounter() {
  encounterState.roster = [];
  encounterState.name = '';
  const nameInput = document.getElementById('encounter-name');
  if (nameInput) nameInput.value = '';
  renderEncounterRoster();
  updateBudgetDisplay();
}

function saveEncounter() {
  if (encounterState.roster.length === 0) {
    showToast('Add adversaries before saving', 'error');
    return;
  }

  const saved = JSON.parse(localStorage.getItem('dh-saved-encounters') || '[]');
  const encounter = {
    id: 'enc-' + Date.now(),
    name: encounterState.name || 'Unnamed Encounter',
    partySize: encounterState.partySize,
    totalBp: calculateUsedPoints(),
    roster: encounterState.roster.map(r => ({
      adversaryId: r.adversaryId,
      name: r.adversary.name,
      advType: r.adversary.advType,
      tier: r.adversary.tier,
      count: r.count
    })),
    createdAt: new Date().toISOString()
  };

  saved.unshift(encounter);
  localStorage.setItem('dh-saved-encounters', JSON.stringify(saved));
  showToast('Encounter saved!', 'success');
  renderSavedEncounters();
}

function loadEncounter(encounterId) {
  const saved = JSON.parse(localStorage.getItem('dh-saved-encounters') || '[]');
  const encounter = saved.find(e => e.id === encounterId);
  if (!encounter) return;

  encounterState.partySize = encounter.partySize;
  encounterState.name = encounter.name;
  encounterState.roster = [];

  // Rebuild roster from library
  const library = getAllLibraryAdversaries();
  const missingAdversaries = [];

  for (const item of encounter.roster) {
    const adversary = library.find(a => a.id === item.adversaryId);
    if (adversary) {
      encounterState.roster.push({
        adversaryId: item.adversaryId,
        adversary,
        count: item.count
      });
    } else {
      missingAdversaries.push(item.name);
    }
  }

  // Warn about missing adversaries
  if (missingAdversaries.length > 0) {
    showToast(`Warning: ${missingAdversaries.length} adversary(s) no longer in library: ${missingAdversaries.join(', ')}`, 'error');
  }

  document.getElementById('party-size-value').textContent = encounterState.partySize;
  const nameInput = document.getElementById('encounter-name');
  if (nameInput) nameInput.value = encounterState.name;
  renderEncounterRoster();
  updateBudgetDisplay();
}

function deleteEncounter(encounterId) {
  const saved = JSON.parse(localStorage.getItem('dh-saved-encounters') || '[]');
  const filtered = saved.filter(e => e.id !== encounterId);
  localStorage.setItem('dh-saved-encounters', JSON.stringify(filtered));
  showToast('Encounter deleted', 'success');
  renderSavedEncounters();
}

function renderSavedEncounters() {
  const container = document.getElementById('saved-encounters-list');
  if (!container) return;

  const saved = JSON.parse(localStorage.getItem('dh-saved-encounters') || '[]');

  if (saved.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved encounters yet</div>';
    return;
  }

  container.innerHTML = saved.map(enc => `
    <div class="saved-encounter-item">
      <div>
        <strong>${escapeHtmlEncounter(enc.name)}</strong>
        <span class="encounter-item-meta">${enc.roster.length} type${enc.roster.length !== 1 ? 's' : ''} • ${enc.totalBp} BP • ${enc.partySize} players</span>
      </div>
      <div class="encounter-item-controls">
        <button class="btn btn-secondary btn-small" onclick="loadEncounter('${escapeHtmlEncounter(enc.id)}')">Load</button>
        <button class="btn btn-secondary btn-small" onclick="deleteEncounter('${escapeHtmlEncounter(enc.id)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function initEncounterBuilder() {
  renderEncounterLibrary();
  renderEncounterRoster();
  renderSavedEncounters();
  updateBudgetDisplay();
  checkForActiveCombat();
}

// ==================== ADMIN PANEL ====================
let adminConversionsPage = 1;
let adminUsersPage = 1;
let adminSearchTimeout = null;

async function loadAdminData() {
  loadAdminStats();
  loadAdminConversions();
}

async function loadAdminStats() {
  try {
    const response = await fetch('/api/admin/stats');
    if (!response.ok) throw new Error('Failed to load stats');
    const stats = await response.json();

    document.getElementById('statUsers').textContent = stats.totalUsers;
    document.getElementById('statConversions').textContent = stats.totalConversions;
    document.getElementById('statVotes').textContent = stats.totalVotes;
    document.getElementById('statRecentConversions').textContent = stats.recentConversions;

    // Update pending reports badge
    const badge = document.getElementById('pendingReportsBadge');
    if (badge) {
      badge.textContent = stats.pendingReports > 0 ? stats.pendingReports : '';
    }
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

let analyticsVisible = false;

function toggleAnalytics() {
  analyticsVisible = !analyticsVisible;
  const content = document.getElementById('analyticsContent');
  content.style.display = analyticsVisible ? 'block' : 'none';
  if (analyticsVisible) {
    loadAdminAnalytics();
  }
}

async function loadAdminAnalytics() {
  try {
    const response = await fetch('/api/admin/analytics?days=30');
    if (!response.ok) throw new Error('Failed to load analytics');
    const data = await response.json();

    // Render charts
    renderLineChart('conversionsChart', data.conversionsOverTime, '#22c55e');
    renderLineChart('usersChart', data.usersOverTime, '#3b82f6');
    renderLineChart('reportsChart', data.reportsOverTime, '#ef4444');
    renderLineChart('votesChart', data.votesOverTime, '#e1b74a');

    // Render suspicious activity
    renderSuspiciousActivity(data.suspiciousActivity);
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

function renderLineChart(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const width = rect.width;
  const height = rect.height;
  const padding = { top: 10, right: 10, bottom: 25, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  if (!data || data.length === 0) {
    ctx.fillStyle = '#888';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('No data', width / 2, height / 2);
    return;
  }

  // Fill dates for last 30 days
  const today = new Date();
  const filledData = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const existing = data.find(d => d.date === dateStr);
    filledData.push({ date: dateStr, count: existing ? existing.count : 0 });
  }

  const maxValue = Math.max(...filledData.map(d => d.count), 1);
  const xStep = chartWidth / (filledData.length - 1 || 1);

  // Draw grid lines
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Draw line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  filledData.forEach((d, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + chartHeight - (d.count / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Fill area under line
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = color;
  ctx.lineTo(padding.left + (filledData.length - 1) * xStep, padding.top + chartHeight);
  ctx.lineTo(padding.left, padding.top + chartHeight);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Draw dots on data points
  ctx.fillStyle = color;
  filledData.forEach((d, i) => {
    if (d.count > 0) {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.count / maxValue) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw Y-axis labels
  ctx.fillStyle = '#888';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const value = Math.round((maxValue / 4) * (4 - i));
    const y = padding.top + (chartHeight / 4) * i + 3;
    ctx.fillText(value.toString(), padding.left - 5, y);
  }

  // Draw X-axis labels (first and last date)
  ctx.textAlign = 'center';
  ctx.fillText(filledData[0].date.slice(5), padding.left, height - 5);
  ctx.fillText(filledData[filledData.length - 1].date.slice(5), width - padding.right, height - 5);
}

function renderSuspiciousActivity(data) {
  // High activity users
  const highActivityEl = document.getElementById('suspiciousHighActivity');
  if (highActivityEl) {
    if (data.highActivityUsers && data.highActivityUsers.length > 0) {
      highActivityEl.innerHTML = data.highActivityUsers.map(u =>
        `<li>@${escapeHtml(u.username)} - ${u.conversions_24h} conversions, ${u.votes_24h} votes</li>`
      ).join('');
    } else {
      highActivityEl.innerHTML = '<li class="empty">None detected</li>';
    }
  }

  // Heavily reported
  const heavilyReportedEl = document.getElementById('suspiciousHeavilyReported');
  if (heavilyReportedEl) {
    if (data.heavilyReported && data.heavilyReported.length > 0) {
      heavilyReportedEl.innerHTML = data.heavilyReported.map(c =>
        `<li>"${escapeHtml(c.name)}" - ${c.report_count} reports</li>`
      ).join('');
    } else {
      heavilyReportedEl.innerHTML = '<li class="empty">None detected</li>';
    }
  }

  // Recent bans
  const recentBansEl = document.getElementById('suspiciousRecentBans');
  if (recentBansEl) {
    if (data.recentBans && data.recentBans.length > 0) {
      recentBansEl.innerHTML = data.recentBans.map(u =>
        `<li>@${escapeHtml(u.username)}</li>`
      ).join('');
    } else {
      recentBansEl.innerHTML = '<li class="empty">None</li>';
    }
  }
}

async function loadAdminConversions(page = 1) {
  adminConversionsPage = page;
  const search = document.getElementById('adminConversionSearch')?.value || '';
  const tbody = document.getElementById('adminConversionsBody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';

  try {
    const response = await fetch(`/api/admin/conversions?page=${page}&search=${encodeURIComponent(search)}`);
    if (!response.ok) throw new Error('Failed to load conversions');
    const data = await response.json();

    if (data.conversions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading">No conversions found</td></tr>';
      renderAdminPagination('adminConversionsPagination', data.pagination, loadAdminConversions);
      return;
    }

    tbody.innerHTML = data.conversions.map(c => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>
          <div class="admin-author">
            ${c.author.avatarUrl ? `<img src="${c.author.avatarUrl}" alt="">` : ''}
            <span>${escapeHtml(c.author.username || 'Unknown')}${c.author.isBanned ? ' <span class="admin-badge banned">Banned</span>' : ''}</span>
          </div>
        </td>
        <td>T${c.tier}</td>
        <td>${c.advType}</td>
        <td>${c.score}</td>
        <td><span class="admin-badge ${c.isPublished ? 'published' : 'unpublished'}">${c.isPublished ? 'Published' : 'Hidden'}</span></td>
        <td>${new Date(c.createdAt).toLocaleDateString()}</td>
        <td>
          <div class="admin-actions">
            <button class="admin-btn" onclick="adminTogglePublish('${c.id}', ${!c.isPublished})">${c.isPublished ? 'Hide' : 'Show'}</button>
            <button class="admin-btn danger" onclick="adminDeleteConversion('${c.id}', '${escapeJsString(c.name)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderAdminPagination('adminConversionsPagination', data.pagination, loadAdminConversions);
  } catch (err) {
    console.error('Failed to load admin conversions:', err);
    tbody.innerHTML = '<tr><td colspan="8" class="loading">Failed to load conversions</td></tr>';
  }
}

async function loadAdminUsers(page = 1) {
  adminUsersPage = page;
  const search = document.getElementById('adminUserSearch')?.value || '';
  const tbody = document.getElementById('adminUsersBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading...</td></tr>';

  try {
    const response = await fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`);
    if (!response.ok) throw new Error('Failed to load users');
    const data = await response.json();

    if (data.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading">No users found</td></tr>';
      renderAdminPagination('adminUsersPagination', data.pagination, loadAdminUsers);
      return;
    }

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td>
          <div class="admin-author">
            ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="">` : ''}
            <span>${escapeHtml(u.username)}</span>
          </div>
        </td>
        <td>${u.provider}</td>
        <td>${u.conversionCount}</td>
        <td>${u.voteCount}</td>
        <td>
          ${u.isAdmin ? '<span class="admin-badge admin">Admin</span>' : ''}
          ${u.isBanned ? '<span class="admin-badge banned">Banned</span>' : '<span class="admin-badge active">Active</span>'}
        </td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
        <td>
          <div class="admin-actions">
            ${!u.isAdmin ? `<button class="admin-btn ${u.isBanned ? '' : 'danger'}" onclick="adminToggleBan('${u.id}', ${!u.isBanned}, '${escapeHtml(u.username)}')">${u.isBanned ? 'Unban' : 'Ban'}</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    renderAdminPagination('adminUsersPagination', data.pagination, loadAdminUsers);
  } catch (err) {
    console.error('Failed to load admin users:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Failed to load users</td></tr>';
  }
}

function renderAdminPagination(containerId, pagination, loadFn) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <button class="btn btn-secondary btn-small" onclick="${loadFn.name}(${pagination.page - 1})" ${pagination.page <= 1 ? 'disabled' : ''}>Prev</button>
    <span>Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)</span>
    <button class="btn btn-secondary btn-small" onclick="${loadFn.name}(${pagination.page + 1})" ${pagination.page >= pagination.totalPages ? 'disabled' : ''}>Next</button>
  `;
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

  document.querySelector(`.admin-tab[onclick*="${tab}"]`)?.classList.add('active');
  document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`)?.classList.remove('hidden');

  if (tab === 'users') {
    loadAdminUsers();
  } else if (tab === 'reports') {
    loadAdminReports();
  } else {
    loadAdminConversions();
  }
}

function debounceAdminSearch(type) {
  clearTimeout(adminSearchTimeout);
  adminSearchTimeout = setTimeout(() => {
    if (type === 'conversions') {
      loadAdminConversions(1);
    } else {
      loadAdminUsers(1);
    }
  }, 300);
}

async function adminTogglePublish(id, publish) {
  try {
    const response = await fetch(`/api/admin/conversions/${id}/publish`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublished: publish })
    });
    if (!response.ok) throw new Error('Failed to update');
    showToast(publish ? 'Conversion published' : 'Conversion hidden', 'success');
    loadAdminConversions(adminConversionsPage);
  } catch (err) {
    showToast('Failed to update conversion', 'error');
  }
}

async function adminDeleteConversion(id, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  try {
    const response = await fetch(`/api/admin/conversions/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete');
    }
    showToast('Conversion deleted', 'success');
    loadAdminConversions(adminConversionsPage);
    loadAdminStats();
  } catch (err) {
    showToast(err.message || 'Failed to delete conversion', 'error');
  }
}

async function adminToggleBan(id, ban, username) {
  if (ban && !confirm(`Ban user "${username}"? They will no longer be able to log in.`)) return;

  try {
    const response = await fetch(`/api/admin/users/${id}/ban`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isBanned: ban })
    });
    if (!response.ok) throw new Error('Failed to update');
    showToast(ban ? 'User banned' : 'User unbanned', 'success');
    loadAdminUsers(adminUsersPage);
    loadAdminStats();
  } catch (err) {
    showToast('Failed to update user', 'error');
  }
}

// ==================== ADMIN REPORTS ====================
let adminReportsPage = 1;

async function loadAdminReports(page = 1) {
  adminReportsPage = page;
  const status = document.getElementById('adminReportStatusFilter')?.value || 'pending';
  const tbody = document.getElementById('adminReportsBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';

  try {
    const response = await fetch(`/api/admin/reports?page=${page}&status=${status}`);
    const data = await response.json();

    if (data.reports.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">No reports found</td></tr>';
      renderAdminPagination('adminReportsPagination', data.pagination, loadAdminReports);
      return;
    }

    tbody.innerHTML = data.reports.map(r => `
      <tr>
        <td>
          <div><strong>${escapeHtml(r.conversion.name)}</strong></div>
          <div style="font-size: 0.75rem; color: var(--text-secondary);">
            T${r.conversion.tier} ${r.conversion.type} · by @${escapeHtml(r.author.username)}
          </div>
        </td>
        <td>
          <div class="admin-author">
            ${r.reporter.avatarUrl ? `<img src="${r.reporter.avatarUrl}" alt="">` : ''}
            <span>@${escapeHtml(r.reporter.username)}</span>
          </div>
        </td>
        <td><div class="admin-report-reason" title="${escapeHtml(r.reason)}">${escapeHtml(r.reason)}</div></td>
        <td><span class="admin-badge ${r.status}">${r.status}</span></td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
        <td>
          <div class="admin-actions">
            <button class="admin-btn" onclick="viewReportedConversion('${r.conversion.id}')" title="View">View</button>
            ${r.status === 'pending' ? `
              <button class="admin-btn" onclick="dismissReport('${r.id}')" title="Dismiss">Dismiss</button>
              <button class="admin-btn danger" onclick="actionReport('${r.id}', 'hide')" title="Hide conversion">Hide</button>
              <button class="admin-btn danger" onclick="actionReport('${r.id}', 'delete')" title="Delete conversion">Delete</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    renderAdminPagination('adminReportsPagination', data.pagination, loadAdminReports);
  } catch (err) {
    console.error('Failed to load reports:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Failed to load reports</td></tr>';
  }
}

async function viewReportedConversion(conversionId) {
  // Switch to community and open the modal
  navigateTo('community');
  setTimeout(() => openCommunityModal(conversionId), 300);
}

async function dismissReport(reportId) {
  if (!confirm('Dismiss this report? The conversion will remain visible.')) return;

  try {
    const response = await fetch(`/api/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', adminNotes: 'Dismissed by admin' })
    });
    if (!response.ok) throw new Error('Failed to dismiss');
    showToast('Report dismissed', 'success');
    loadAdminReports(adminReportsPage);
    loadAdminStats();
  } catch (err) {
    showToast('Failed to dismiss report', 'error');
  }
}

async function actionReport(reportId, action) {
  const actionLabel = action === 'hide' ? 'hide' : 'delete';
  if (!confirm(`${action === 'hide' ? 'Hide' : 'Delete'} this conversion? ${action === 'delete' ? 'This cannot be undone.' : ''}`)) return;

  try {
    const response = await fetch(`/api/admin/reports/${reportId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!response.ok) throw new Error('Failed to action');
    showToast(`Conversion ${actionLabel}d and report resolved`, 'success');
    loadAdminReports(adminReportsPage);
    loadAdminStats();
  } catch (err) {
    showToast('Failed to action report', 'error');
  }
}

// ==================== MY LIBRARY (Drag & Drop Folder System) ====================
let myLibraryGroups = [];
let selectedFolderId = 'all';
let selectedMyLibraryAdversary = null;
let adversaryToAdd = null;
let draggedAdversary = null;
let librarySearchFilter = '';

function loadMyLibrary() {
  loadGroupsFromStorage();
  renderFoldersList();
  updateFolderCounts();
  selectFolder(selectedFolderId || 'all');
}

function loadGroupsFromStorage() {
  try {
    const stored = localStorage.getItem('dh-groups');
    myLibraryGroups = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load groups:', e);
    myLibraryGroups = [];
  }
}

function saveGroupsToStorage() {
  try {
    localStorage.setItem('dh-groups', JSON.stringify(myLibraryGroups));
  } catch (e) {
    console.error('Failed to save groups:', e);
    showToast('Failed to save', 'error');
  }
}

function getAllLibraryAdversaries() {
  try {
    return JSON.parse(localStorage.getItem('dh-user-library') || '[]');
  } catch (e) {
    return [];
  }
}

function getUngroupedAdversaries() {
  const library = getAllLibraryAdversaries();
  const groupedIds = new Set();
  myLibraryGroups.forEach(g => {
    (g.adversaries || []).forEach(a => groupedIds.add(a.id));
  });
  return library.filter(a => !groupedIds.has(a.id));
}

function renderFoldersList() {
  const container = document.getElementById('foldersList');
  if (!container) return;

  if (myLibraryGroups.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = myLibraryGroups.map(folder => `
    <div class="folder-item ${selectedFolderId === folder.id ? 'active' : ''}"
         data-folder="${folder.id}"
         onclick="selectFolder('${folder.id}')"
         ondragover="handleFolderDragOver(event)"
         ondragleave="handleFolderDragLeave(event)"
         ondrop="handleFolderDrop(event, '${folder.id}')">
      <span class="folder-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
        </svg>
      </span>
      <span class="folder-name">${escapeHtml(folder.name)}</span>
      <span class="folder-count">${(folder.adversaries || []).length}</span>
    </div>
  `).join('');
}

function updateFolderCounts() {
  const allCount = document.getElementById('allCount');
  const ungroupedCount = document.getElementById('ungroupedCount');
  if (allCount) allCount.textContent = getAllLibraryAdversaries().length;
  if (ungroupedCount) ungroupedCount.textContent = getUngroupedAdversaries().length;
}

function selectFolder(folderId) {
  selectedFolderId = folderId;

  // Update folder selection in sidebar
  document.querySelectorAll('.folder-item').forEach(el => {
    el.classList.toggle('active', el.dataset.folder === folderId);
  });

  // Update content header
  const nameEl = document.getElementById('currentFolderName');
  const countEl = document.getElementById('folderItemCount');
  const editActionsEl = document.getElementById('folderEditActions');

  let adversaries = [];
  let folderName = 'All Adversaries';

  if (folderId === 'all') {
    adversaries = getAllLibraryAdversaries();
    folderName = 'All Adversaries';
    if (editActionsEl) editActionsEl.style.display = 'none';
  } else if (folderId === 'ungrouped') {
    adversaries = getUngroupedAdversaries();
    folderName = 'Ungrouped';
    if (editActionsEl) editActionsEl.style.display = 'none';
  } else {
    const folder = myLibraryGroups.find(g => g.id === folderId);
    if (folder) {
      adversaries = folder.adversaries || [];
      folderName = folder.name;
      if (editActionsEl) editActionsEl.style.display = 'flex';
    }
  }

  if (nameEl) nameEl.textContent = folderName;
  if (countEl) countEl.textContent = `(${adversaries.length} items)`;

  renderLibraryItems(adversaries);
}

function renderLibraryItems(adversaries) {
  const container = document.getElementById('libraryItems');
  const emptyState = document.getElementById('libraryEmptyState');
  if (!container) return;

  // Apply search filter
  let filtered = adversaries;
  if (librarySearchFilter) {
    const search = librarySearchFilter.toLowerCase();
    filtered = adversaries.filter(a =>
      (a.name || '').toLowerCase().includes(search) ||
      (a.advType || '').toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  container.innerHTML = filtered.map(adv => {
    const hp = adv.hp || '?';
    const stress = adv.stress || '?';
    const difficulty = adv.difficulty || '?';
    const majorThresh = adv.majorThresh || '?';
    const severeThresh = adv.severeThresh || '?';
    const description = adv.description || '';
    const motives = adv.motives || '';
    const cardTypeClass = (adv.advType || 'standard').toLowerCase().trim();

    // Build attack line
    let attackLine = '';
    if (adv.atkMod && adv.atkMod !== '?') {
      attackLine = `<span class="dh-stat-item"><span class="dh-stat-label">ATK:</span> ${adv.atkMod}</span>`;
      if (adv.weapon) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${adv.weapon}: ${adv.range || ''}</span>`;
      if (adv.damage) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${highlightDiceRolls(adv.damage)}${adv.dmgType ? ' ' + adv.dmgType : ''}</span>`;
    }

    return `
      <div class="community-item library-draggable"
           draggable="true"
           data-adversary-id="${adv.id}"
           ondragstart="handleAdversaryDragStart(event, '${adv.id}')"
           ondragend="handleAdversaryDragEnd(event)"
           onclick="openMyLibraryAdversary('${adv.id}')">
        <div class="dh-card-header" data-type="${cardTypeClass}">
          <div class="dh-card-name">${escapeHtml(adv.name || 'Unknown')}</div>
          <div class="dh-card-tier-type">Tier ${adv.tier || '?'} ${adv.advType || 'Standard'}</div>
        </div>
        <div class="dh-card-body">
          ${description ? `<div class="dh-card-description">${escapeHtml(description)}</div>` : ''}
          ${motives ? `<div class="dh-card-motives"><strong>Motives & Tactics:</strong> ${escapeHtml(motives)}</div>` : ''}
          <div class="mini-stats-container">
            <div class="mini-vitals-row">
              <div class="mini-vital-box difficulty">
                <span class="mini-vital-value">${difficulty}</span>
                <span class="mini-vital-label">Diff</span>
              </div>
              <div class="mini-vital-box hp">
                <span class="mini-vital-value">${hp}</span>
                <span class="mini-vital-label">HP</span>
              </div>
              <div class="mini-vital-box stress">
                <span class="mini-vital-value">${stress}</span>
                <span class="mini-vital-label">Stress</span>
              </div>
            </div>
            <div class="mini-damage-tracker">
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -874.223 1942.978 L -874.223 1442.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Minor</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${majorThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Major</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${severeThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Severe</span>
              </div>
            </div>
            ${attackLine ? `<div class="dh-card-stats-row">${attackLine}</div>` : ''}
          </div>
        </div>
        <div class="library-drag-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/>
            <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
            <circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/>
          </svg>
        </div>
      </div>
    `;
  }).join('');
}

function filterLibraryItems() {
  const input = document.getElementById('librarySearch');
  librarySearchFilter = input ? input.value : '';
  selectFolder(selectedFolderId);
}

// ==================== DRAG & DROP HANDLERS ====================
function handleAdversaryDragStart(event, adversaryId) {
  // Find the adversary data
  let adv = getAllLibraryAdversaries().find(a => a.id === adversaryId);
  if (!adv) return;

  draggedAdversary = adv;
  event.target.classList.add('dragging');

  // Set drag data
  event.dataTransfer.setData('text/plain', adversaryId);
  event.dataTransfer.effectAllowed = 'move';
}

function handleAdversaryDragEnd(event) {
  event.target.classList.remove('dragging');
  draggedAdversary = null;

  // Remove drag-over from all folders
  document.querySelectorAll('.folder-item').forEach(el => {
    el.classList.remove('drag-over');
  });
}

function handleFolderDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function handleFolderDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function handleFolderDrop(event, targetFolderId) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  if (!draggedAdversary) return;

  const advId = draggedAdversary.id;

  // Special handling for 'all' folder - do nothing (can't move to "all")
  if (targetFolderId === 'all') {
    showToast('Items are always visible in All Adversaries', 'info');
    return;
  }

  // Remove from all groups first
  myLibraryGroups.forEach(g => {
    g.adversaries = (g.adversaries || []).filter(a => a.id !== advId);
  });

  // If target is a specific folder (not ungrouped), add to it
  if (targetFolderId !== 'ungrouped') {
    const targetFolder = myLibraryGroups.find(g => g.id === targetFolderId);
    if (targetFolder) {
      if (!targetFolder.adversaries) targetFolder.adversaries = [];
      targetFolder.adversaries.push(draggedAdversary);
      showToast(`Moved to "${targetFolder.name}"`, 'success');
    }
  } else {
    showToast('Moved to Ungrouped', 'success');
  }

  saveGroupsToStorage();
  renderFoldersList();
  updateFolderCounts();
  selectFolder(selectedFolderId);
}

function handleContainerDragOver(event) {
  event.preventDefault();
}

function handleContainerDrop(event) {
  event.preventDefault();
  // Container drops do nothing extra - folder drops handle everything
}

// ==================== FOLDER MANAGEMENT ====================
function createNewGroup() {
  const name = prompt('Enter folder name:');
  if (!name || !name.trim()) return;

  const newFolder = {
    id: 'folder-' + Date.now(),
    name: name.trim(),
    adversaries: [],
    createdAt: new Date().toISOString()
  };

  myLibraryGroups.push(newFolder);
  saveGroupsToStorage();
  renderFoldersList();
  updateFolderCounts();
  selectFolder(newFolder.id);
  showToast(`Folder "${name}" created`, 'success');
}

function startRenameFolder() {
  if (!selectedFolderId || selectedFolderId === 'all' || selectedFolderId === 'ungrouped') return;

  const folder = myLibraryGroups.find(g => g.id === selectedFolderId);
  if (!folder) return;

  const newName = prompt('Enter new name:', folder.name);
  if (!newName || !newName.trim()) return;

  folder.name = newName.trim();
  saveGroupsToStorage();
  renderFoldersList();
  document.getElementById('currentFolderName').textContent = folder.name;
  showToast('Folder renamed', 'success');
}

function deleteCurrentGroup() {
  if (!selectedFolderId || selectedFolderId === 'all' || selectedFolderId === 'ungrouped') return;

  const folder = myLibraryGroups.find(g => g.id === selectedFolderId);
  if (!folder) return;

  if (!confirm(`Delete folder "${folder.name}"? Adversaries will be moved to Ungrouped.`)) {
    return;
  }

  myLibraryGroups = myLibraryGroups.filter(g => g.id !== selectedFolderId);
  saveGroupsToStorage();
  selectedFolderId = 'all';
  renderFoldersList();
  updateFolderCounts();
  selectFolder('all');
  showToast(`Folder deleted`, 'info');
}

// ==================== ADVERSARY DETAIL MODAL ====================
function openMyLibraryAdversary(adversaryId) {
  const adversary = getAllLibraryAdversaries().find(a => a.id === adversaryId);
  if (!adversary) {
    showToast('Adversary not found', 'error');
    return;
  }

  selectedMyLibraryAdversary = adversary;
  document.getElementById('myLibraryModalStatBlock').innerHTML = renderStatBlockReadOnly(adversary);

  // Show delete from server button only if user is creator and logged in
  const deleteServerBtn = document.getElementById('deleteFromServerBtn');
  if (deleteServerBtn) {
    const canDeleteFromServer = currentUser && adversary._isCreator && adversary._communityId;
    deleteServerBtn.classList.toggle('hidden', !canDeleteFromServer);
  }

  document.getElementById('myLibraryModal').classList.remove('hidden');

  // Position dice tooltips after modal is visible
  setTimeout(() => positionDiceTooltips(document.getElementById('myLibraryModal')), 50);
}

function closeMyLibraryModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('myLibraryModal').classList.add('hidden');
  selectedMyLibraryAdversary = null;
}

function copyMyLibraryJSON() {
  if (!selectedMyLibraryAdversary) return;
  navigator.clipboard.writeText(JSON.stringify(selectedMyLibraryAdversary, null, 2));
  showToast('JSON copied', 'success');
}

function moveToGroup() {
  if (!selectedMyLibraryAdversary) return;
  adversaryToAdd = selectedMyLibraryAdversary;
  openAddToGroupModal(selectedMyLibraryAdversary.name, true);
}

function removeFromLibrary() {
  if (!selectedMyLibraryAdversary) return;
  if (!confirm(`Remove "${selectedMyLibraryAdversary.name}" from your library?`)) return;

  const advId = selectedMyLibraryAdversary.id;

  // Remove from groups
  myLibraryGroups.forEach(g => {
    g.adversaries = (g.adversaries || []).filter(a => a.id !== advId);
  });
  saveGroupsToStorage();

  // Remove from main library
  try {
    let library = getAllLibraryAdversaries().filter(a => a.id !== advId);
    localStorage.setItem('dh-user-library', JSON.stringify(library));
  } catch (e) {
    console.error('Failed to remove:', e);
  }

  closeMyLibraryModal();
  loadMyLibrary();
  showToast('Removed from library', 'info');
}

async function deleteFromServer() {
  if (!selectedMyLibraryAdversary) return;
  if (!currentUser) {
    showToast('Please sign in to delete', 'error');
    return;
  }

  const communityId = selectedMyLibraryAdversary._communityId;
  if (!communityId) {
    showToast('This monster is not on the server', 'error');
    return;
  }

  if (!confirm(`Delete "${selectedMyLibraryAdversary.name}" from the community server? This will remove it for everyone and cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/community/conversions/${communityId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete');
    }

    // Also remove from local library
    const advId = selectedMyLibraryAdversary.id;
    myLibraryGroups.forEach(g => {
      g.adversaries = (g.adversaries || []).filter(a => a.id !== advId);
    });
    saveGroupsToStorage();

    try {
      let library = getAllLibraryAdversaries().filter(a => a.id !== advId);
      localStorage.setItem('dh-user-library', JSON.stringify(library));
    } catch (e) {
      console.error('Failed to remove from local library:', e);
    }

    closeMyLibraryModal();
    loadMyLibrary();

    // Reload community if loaded
    if (communityLoaded) {
      communityPage = 1;
      loadCommunityConversions();
    }

    showToast('Deleted from server', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== ADD TO GROUP MODAL ====================
function openAddToGroupModal(adversaryName, isMove = false) {
  document.getElementById('addToGroupAdversaryName').textContent =
    isMove ? `Move "${adversaryName}" to:` : `Add "${adversaryName}" to:`;

  const listEl = document.getElementById('groupSelectList');

  if (myLibraryGroups.length === 0) {
    listEl.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No folders yet. Create one below.</p>`;
  } else {
    listEl.innerHTML = myLibraryGroups.map(folder => `
      <div class="group-select-item" onclick="addToGroup('${folder.id}')">
        <span class="folder-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg></span>
        <span class="folder-name">${escapeHtml(folder.name)}</span>
        <span class="folder-count">${(folder.adversaries || []).length}</span>
      </div>
    `).join('');
  }

  document.getElementById('newGroupNameInline').value = '';
  document.getElementById('addToGroupModal').classList.remove('hidden');
}

function closeAddToGroupModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('addToGroupModal').classList.add('hidden');
  adversaryToAdd = null;
}

function addToGroup(folderId) {
  if (!adversaryToAdd) return;

  const folder = myLibraryGroups.find(g => g.id === folderId);
  if (!folder) {
    showToast('Folder not found', 'error');
    return;
  }

  // Remove from other groups
  myLibraryGroups.forEach(g => {
    g.adversaries = (g.adversaries || []).filter(a => a.id !== adversaryToAdd.id);
  });

  // Add to target folder
  if (!folder.adversaries) folder.adversaries = [];
  folder.adversaries.push(adversaryToAdd);

  saveGroupsToStorage();
  closeAddToGroupModal();
  closeMyLibraryModal();

  if (currentPage === 'myLibrary') {
    loadMyLibrary();
    selectFolder(folderId);
  }

  showToast(`Added to "${folder.name}"`, 'success');
}

function createGroupAndAdd() {
  const nameInput = document.getElementById('newGroupNameInline');
  const name = nameInput.value.trim();
  if (!name) {
    showToast('Enter a folder name', 'error');
    return;
  }

  const newFolder = {
    id: 'folder-' + Date.now(),
    name: name,
    adversaries: adversaryToAdd ? [adversaryToAdd] : [],
    createdAt: new Date().toISOString()
  };

  // Remove from other groups if adding
  if (adversaryToAdd) {
    myLibraryGroups.forEach(g => {
      g.adversaries = (g.adversaries || []).filter(a => a.id !== adversaryToAdd.id);
    });
  }

  myLibraryGroups.push(newFolder);
  saveGroupsToStorage();

  closeAddToGroupModal();
  closeMyLibraryModal();

  if (currentPage === 'myLibrary') {
    loadMyLibrary();
    selectFolder(newFolder.id);
  }

  showToast(`Folder "${name}" created`, 'success');
}

function addAdversaryToGroup(adversary) {
  adversaryToAdd = adversary;
  loadGroupsFromStorage();
  openAddToGroupModal(adversary.name);
}

// Backward compatibility aliases
function selectGroup(id) { selectFolder(id); }
function renderGroupsList() { renderFoldersList(); }
function renderUngroupedCount() { updateFolderCounts(); }

// ==================== LOGIN MODAL ====================
function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
}

function closeLoginModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('loginModal').classList.add('hidden');
}

// ==================== KEYBOARD SHORTCUTS MODAL ====================
function openKeyboardModal() {
  document.getElementById('keyboardModal').classList.remove('hidden');
}

function closeKeyboardModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('keyboardModal').classList.add('hidden');
}

// ==================== PRIVACY MODAL ====================
function openPrivacyModal() {
  document.getElementById('privacyModal').classList.add('active');
}

function closePrivacyModal() {
  document.getElementById('privacyModal').classList.remove('active');
}

function openFAQModal() {
  document.getElementById('faqModal').classList.remove('hidden');
  document.getElementById('faqModal').classList.add('active');
}

function closeFAQModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('faqModal').classList.remove('active');
  document.getElementById('faqModal').classList.add('hidden');
}

function toggleUserMenu() {
  const dropdown = document.getElementById('userDropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

async function logout() {
  try {
    await fetch('/auth/logout', { method: 'POST' });
    currentUser = null;
    renderAuthUI();
    showToast('Logged out successfully', 'info');
  } catch (err) {
    showToast('Logout failed', 'error');
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-menu')) {
    const dropdown = document.getElementById('userDropdown');
    if (dropdown) dropdown.classList.remove('show');
  }
});

// ==================== COMMUNITY LIBRARY ====================
let communityLoaded = false;
let communityConversions = [];
let communityPage = 1;
let communityTotalPages = 1;
let communitySearchDebounce = null;
let selectedConversion = null;

// Multi-select filter state
let selectedTiers = [];
let selectedTypes = [];
let currentFilterType = null; // 'tier' or 'type'

const TIER_OPTIONS = [
  { value: '1', label: 'Tier 1' },
  { value: '2', label: 'Tier 2' },
  { value: '3', label: 'Tier 3' },
  { value: '4', label: 'Tier 4' }
];

const TYPE_OPTIONS = [
  { value: 'Bruiser', label: 'Bruiser' },
  { value: 'Horde', label: 'Horde' },
  { value: 'Leader', label: 'Leader' },
  { value: 'Minion', label: 'Minion' },
  { value: 'Ranged', label: 'Ranged' },
  { value: 'Skulk', label: 'Skulk' },
  { value: 'Social', label: 'Social' },
  { value: 'Solo', label: 'Solo' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Support', label: 'Support' }
];

function openFilterModal(filterType) {
  currentFilterType = filterType;
  const modal = document.getElementById('filterModal');
  const title = document.getElementById('filterModalTitle');
  const optionsContainer = document.getElementById('filterOptions');

  const options = filterType === 'tier' ? TIER_OPTIONS : TYPE_OPTIONS;
  const selected = filterType === 'tier' ? selectedTiers : selectedTypes;

  title.textContent = filterType === 'tier' ? 'Select Tiers' : 'Select Types';

  optionsContainer.innerHTML = options.map(opt => `
    <div class="filter-option ${selected.includes(opt.value) ? 'selected' : ''}" onclick="toggleFilterOption('${opt.value}')">
      <input type="checkbox" id="filter-${opt.value}" ${selected.includes(opt.value) ? 'checked' : ''}>
      <label for="filter-${opt.value}">${opt.label}</label>
    </div>
  `).join('');

  modal.classList.remove('hidden');
}

function closeFilterModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('filterModal').classList.add('hidden');
  currentFilterType = null;
}

function toggleFilterOption(value) {
  const selected = currentFilterType === 'tier' ? selectedTiers : selectedTypes;
  const index = selected.indexOf(value);

  if (index === -1) {
    selected.push(value);
  } else {
    selected.splice(index, 1);
  }

  // Update UI
  const optionEl = document.querySelector(`.filter-option input[id="filter-${value}"]`);
  if (optionEl) {
    optionEl.checked = selected.includes(value);
    optionEl.closest('.filter-option').classList.toggle('selected', selected.includes(value));
  }
}

function clearFilterSelection() {
  if (currentFilterType === 'tier') {
    selectedTiers = [];
  } else {
    selectedTypes = [];
  }

  // Uncheck all
  document.querySelectorAll('.filter-option').forEach(opt => {
    opt.classList.remove('selected');
    opt.querySelector('input').checked = false;
  });
}

function applyFilter() {
  updateFilterButtonLabels();
  closeFilterModal();
  communityPage = 1;
  loadCommunityConversions();
}

function updateFilterButtonLabels() {
  const tierBtn = document.getElementById('tierFilterBtn');
  const typeBtn = document.getElementById('typeFilterBtn');
  const tierLabel = document.getElementById('tierFilterLabel');
  const typeLabel = document.getElementById('typeFilterLabel');

  if (selectedTiers.length === 0) {
    tierLabel.textContent = 'All Tiers';
    tierBtn.classList.remove('has-selection');
  } else if (selectedTiers.length === 1) {
    tierLabel.textContent = `Tier ${selectedTiers[0]}`;
    tierBtn.classList.add('has-selection');
  } else {
    tierLabel.textContent = `${selectedTiers.length} Tiers`;
    tierBtn.classList.add('has-selection');
  }

  if (selectedTypes.length === 0) {
    typeLabel.textContent = 'All Types';
    typeBtn.classList.remove('has-selection');
  } else if (selectedTypes.length === 1) {
    typeLabel.textContent = selectedTypes[0];
    typeBtn.classList.add('has-selection');
  } else {
    typeLabel.textContent = `${selectedTypes.length} Types`;
    typeBtn.classList.add('has-selection');
  }
}

async function loadCommunityConversions() {
  const listEl = document.getElementById('communityList');
  listEl.innerHTML = `
    <div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton-tags"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-tag"></div></div></div>
    <div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton-tags"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-tag"></div></div></div>
    <div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton-tags"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-tag"></div></div></div>
    <div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton-tags"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-tag"></div></div></div>
  `;

  try {
    const search = document.getElementById('communitySearch').value;
    const sort = document.getElementById('communitySort').value;

    const params = new URLSearchParams({
      page: communityPage,
      limit: 20,
      search,
      sort
    });

    // Add multi-select filters as comma-separated values
    if (selectedTiers.length > 0) {
      params.set('tier', selectedTiers.join(','));
    }
    if (selectedTypes.length > 0) {
      params.set('type', selectedTypes.join(','));
    }

    const response = await fetch(`/api/community/conversions?${params}`);
    const data = await response.json();

    communityConversions = data.conversions || [];
    communityTotalPages = data.pagination?.totalPages || 1;
    communityLoaded = true;

    renderCommunityList();
    updateCommunityPagination();

  } catch (err) {
    console.error('Failed to load community conversions:', err);
    listEl.innerHTML = `
      <div class="community-empty">
        <p>Could not load community conversions.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Make sure the server is running.</p>
      </div>
    `;
  }
}

function renderCommunityList() {
  const listEl = document.getElementById('communityList');

  if (communityConversions.length === 0) {
    listEl.innerHTML = `
      <div class="community-empty">
        <p>No conversions found.</p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Be the first to share your creation!</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = communityConversions.map(conv => {
    const data = conv.data || {};
    const hp = data.hp || '?';
    const stress = data.stress || '?';
    const difficulty = data.difficulty || '?';
    const majorThresh = data.majorThresh || data.thresholds?.major || '?';
    const severeThresh = data.severeThresh || data.thresholds?.severe || '?';
    const description = data.description || '';
    const motives = data.motives || '';
    const atkMod = data.atkMod || data.attack?.modifier || '?';
    const weapon = data.weapon || data.attack?.name || '';
    const range = data.range || data.attack?.range || '';
    const damage = data.damage || data.attack?.damage || '';
    const dmgType = data.dmgType || data.attack?.type || '';
    const sourceSystem = conv.sourceSystem || data.sourceSystem;
    const authorAvatar = conv.author?.avatarUrl
      ? `<img src="${conv.author.avatarUrl}" alt="">`
      : '';

    // Build attack line
    let attackLine = '';
    if (atkMod && atkMod !== '?') {
      attackLine = `<span class="dh-stat-item"><span class="dh-stat-label">ATK:</span> ${atkMod}</span>`;
      if (weapon) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${weapon}: ${range}</span>`;
      if (damage) attackLine += `<span class="dh-stat-separator">|</span><span class="dh-stat-item">${highlightDiceRolls(damage)}${dmgType ? ' ' + dmgType : ''}</span>`;
    }

    const cardTypeClass = (conv.advType || 'standard').toLowerCase().trim();

    return `
      <div class="community-item" onclick="openCommunityModal('${conv.id}')">
        <div class="dh-card-header" data-type="${cardTypeClass}">
          <div class="dh-card-name">${escapeHtml(conv.name)}</div>
          <div class="dh-card-tier-type">Tier ${conv.tier} ${conv.advType}</div>
        </div>
        <div class="dh-card-body">
          ${description ? `<div class="dh-card-description">${escapeHtml(description)}</div>` : ''}
          ${motives ? `<div class="dh-card-motives"><strong>Motives & Tactics:</strong> ${escapeHtml(motives)}</div>` : ''}
          <div class="mini-stats-container">
            <div class="mini-vitals-row">
              <div class="mini-vital-box difficulty">
                <span class="mini-vital-value">${difficulty}</span>
                <span class="mini-vital-label">Diff</span>
              </div>
              <div class="mini-vital-box hp">
                <span class="mini-vital-value">${hp}</span>
                <span class="mini-vital-label">HP</span>
              </div>
              <div class="mini-vital-box stress">
                <span class="mini-vital-value">${stress}</span>
                <span class="mini-vital-label">Stress</span>
              </div>
            </div>
            <div class="mini-damage-tracker">
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -874.223 1942.978 L -874.223 1442.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Minor</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${majorThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Major</span>
              </div>
              <div class="mini-connector"><span class="mini-connector-number">${severeThresh}</span></div>
              <div class="mini-damage-card">
                <svg viewBox="0 0 250 120" preserveAspectRatio="xMidYMid meet">
                  <g transform="matrix(0.1, 0, 0, -0.1, 97.422302, 229.297806)" fill="#5F6975">
                    <path d="M -974.223 2292.978 L -974.223 2042.978 L -624.223 1692.978 L -974.223 1342.978 L -974.223 1092.978 L -724.223 1092.978 L -624.223 1192.978 L 1175.777 1192.978 L 1275.777 1092.978 L 1525.777 1092.978 L 1525.777 1342.978 L 1425.777 1442.978 L 1425.777 1942.978 L 1525.777 2042.978 L 1525.777 2292.978 L 1275.777 2292.978 L 1175.777 2192.978 L -624.223 2192.978 L -724.223 2292.978 L -974.223 2292.978 Z"/>
                    <path d="M -974.223 1842.978 L -974.223 1542.978 L -824.223 1692.978 L -974.223 1842.978 Z"/>
                  </g>
                </svg>
                <span class="mini-card-label">Severe</span>
              </div>
            </div>
            ${attackLine ? `<div class="dh-card-stats-row">${attackLine}</div>` : ''}
          </div>
        </div>
        <div class="dh-card-footer">
          <div class="dh-card-author">${authorAvatar}@${escapeHtml(conv.author?.username || 'Unknown')}</div>
          <div class="dh-card-footer-right">
            ${sourceSystem ? `<span class="dh-card-source">${escapeHtml(sourceSystem)}</span>` : ''}
            <button class="share-link-btn" onclick="event.stopPropagation(); copyShareLinkFor('${conv.id}')" title="Copy share link">&#128279;</button>
          </div>
        </div>
        <div class="community-item-votes">
          <button class="vote-btn upvote ${conv.userVote === 1 ? 'active' : ''}"
                  onclick="event.stopPropagation(); quickVote('${conv.id}', 1)">&#9650;</button>
          <span class="vote-score ${conv.score > 0 ? 'positive' : conv.score < 0 ? 'negative' : ''}">${conv.score}</span>
          <button class="vote-btn downvote ${conv.userVote === -1 ? 'active' : ''}"
                  onclick="event.stopPropagation(); quickVote('${conv.id}', -1)">&#9660;</button>
          <button class="quick-save-btn ${isInLibrary(conv.data?.id) ? 'saved' : ''}"
                  onclick="event.stopPropagation(); quickSaveToLibrary('${conv.id}')"
                  title="${isInLibrary(conv.data?.id) ? 'Remove from library' : 'Save to library'}">
            ${isInLibrary(conv.data?.id) ? '★' : '☆'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateCommunityPagination() {
  const paginationEl = document.getElementById('communityPagination');
  const pageInfo = document.getElementById('communityPageInfo');
  const prevBtn = document.getElementById('communityPrevBtn');
  const nextBtn = document.getElementById('communityNextBtn');

  if (communityTotalPages <= 1) {
    paginationEl.classList.add('hidden');
    return;
  }

  paginationEl.classList.remove('hidden');
  pageInfo.textContent = `Page ${communityPage} of ${communityTotalPages}`;
  prevBtn.disabled = communityPage <= 1;
  nextBtn.disabled = communityPage >= communityTotalPages;
}

function communityPrevPage() {
  if (communityPage > 1) {
    communityPage--;
    loadCommunityConversions();
  }
}

function communityNextPage() {
  if (communityPage < communityTotalPages) {
    communityPage++;
    loadCommunityConversions();
  }
}

function debounceCommunitySearch() {
  clearTimeout(communitySearchDebounce);
  communitySearchDebounce = setTimeout(() => {
    communityPage = 1;
    loadCommunityConversions();
  }, 300);
}

async function quickVote(conversionId, vote) {
  if (!currentUser) {
    showToast('Please log in to vote', 'info');
    return;
  }

  const conv = communityConversions.find(c => c.id === conversionId);
  if (!conv) return;

  // Toggle vote if clicking the same button
  const newVote = conv.userVote === vote ? 0 : vote;

  try {
    const response = await fetch(`/api/community/conversions/${conversionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: newVote })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Vote failed');
    }

    const data = await response.json();

    // Update local state
    conv.userVote = data.userVote;
    conv.upvotes = data.upvotes;
    conv.downvotes = data.downvotes;
    conv.score = data.score;

    renderCommunityList();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== COMMUNITY MODAL ====================
async function openCommunityModal(conversionId) {
  const modal = document.getElementById('communityModal');
  const statBlockEl = document.getElementById('modalStatBlock');

  // Find in local cache first
  selectedConversion = communityConversions.find(c => c.id === conversionId);

  if (!selectedConversion) {
    // Fetch from server
    try {
      const response = await fetch(`/api/community/conversions/${conversionId}`);
      selectedConversion = await response.json();
    } catch (err) {
      showToast('Failed to load conversion', 'error');
      return;
    }
  }

  statBlockEl.innerHTML = renderStatBlockReadOnly(selectedConversion.data);
  updateModalVotes();
  updateModalAuthor();
  updateDeleteButton();

  // Update URL for direct linking (only if not already on this URL)
  if (window.location.pathname !== `/community/${conversionId}`) {
    window.history.pushState({ conversionId }, '', `/community/${conversionId}`);
  }

  modal.classList.remove('hidden');

  // Position dice tooltips after modal is visible
  setTimeout(() => positionDiceTooltips(modal), 50);
}

function updateDeleteButton() {
  const deleteBtn = document.getElementById('modalDeleteBtn');
  if (!deleteBtn) return;

  // Show delete button only if user owns this conversion
  deleteBtn.classList.toggle('hidden', !selectedConversion?.isOwner);
}

async function deleteMyConversion() {
  if (!selectedConversion || !currentUser) return;

  if (!confirm(`Are you sure you want to delete "${selectedConversion.name || selectedConversion.data?.name || 'this conversion'}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/community/conversions/${selectedConversion.id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete');
    }

    showToast('Conversion deleted', 'success');
    closeCommunityModal();
    loadCommunityConversions();
  } catch (err) {
    showToast(err.message || 'Failed to delete conversion', 'error');
  }
}

function closeCommunityModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('communityModal').classList.add('hidden');
  selectedConversion = null;
  // Reset URL if we're on a community detail page
  if (window.location.pathname.startsWith('/community/')) {
    window.history.pushState({}, '', '/');
  }
}

function updateModalAuthor() {
  const authorEl = document.getElementById('modalAuthor');
  if (!selectedConversion || !authorEl) return;

  const author = selectedConversion.author;
  if (author) {
    const avatarHtml = author.avatarUrl
      ? `<img src="${author.avatarUrl}" alt="">`
      : '';
    const date = selectedConversion.createdAt
      ? new Date(selectedConversion.createdAt).toLocaleDateString()
      : '';
    authorEl.innerHTML = `${avatarHtml}Shared by @${escapeHtml(author.username)}${date ? ` on ${date}` : ''}`;
  } else {
    authorEl.innerHTML = '';
  }
}

function updateModalVotes() {
  if (!selectedConversion) return;

  const scoreEl = document.getElementById('modalVoteScore');
  const upBtn = document.getElementById('modalUpvoteBtn');
  const downBtn = document.getElementById('modalDownvoteBtn');

  scoreEl.textContent = selectedConversion.score;
  scoreEl.className = 'vote-score';
  if (selectedConversion.score > 0) scoreEl.classList.add('positive');
  if (selectedConversion.score < 0) scoreEl.classList.add('negative');

  upBtn.classList.toggle('active', selectedConversion.userVote === 1);
  downBtn.classList.toggle('active', selectedConversion.userVote === -1);
}

async function voteOnConversion(vote) {
  if (!currentUser) {
    showToast('Please log in to vote', 'info');
    return;
  }

  if (!selectedConversion) return;

  const newVote = selectedConversion.userVote === vote ? 0 : vote;

  try {
    const response = await fetch(`/api/community/conversions/${selectedConversion.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: newVote })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Vote failed');
    }

    const data = await response.json();

    selectedConversion.userVote = data.userVote;
    selectedConversion.score = data.score;

    // Update in list if exists
    const listConv = communityConversions.find(c => c.id === selectedConversion.id);
    if (listConv) {
      listConv.userVote = data.userVote;
      listConv.score = data.score;
      listConv.upvotes = data.upvotes;
      listConv.downvotes = data.downvotes;
    }

    updateModalVotes();
    renderCommunityList();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function copyModalJSON() {
  if (!selectedConversion) return;
  navigator.clipboard.writeText(JSON.stringify(selectedConversion.data, null, 2))
    .then(() => showToast('JSON copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy', 'error'));
}

function addModalToLibrary() {
  if (!selectedConversion) return;

  try {
    const existingLibrary = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    const data = {
      ...selectedConversion.data,
      _communityId: selectedConversion.id,
      _isCreator: selectedConversion.isOwner || false
    };

    const existing = existingLibrary.findIndex(item => item.id === data.id);
    if (existing >= 0) {
      existingLibrary[existing] = data;
      showToast('Updated in library!', 'success');
    } else {
      existingLibrary.push(data);
      showToast('Added to library!', 'success');
    }

    localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));
  } catch (err) {
    showToast('Could not add to library: ' + err.message, 'error');
  }
}

function quickSaveToLibrary(conversionId) {
  const conv = communityConversions.find(c => c.id === conversionId);
  if (!conv) return;

  try {
    const existingLibrary = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    const data = {
      ...conv.data,
      _communityId: conv.id,
      _isCreator: conv.isOwner || false
    };

    const existingIdx = existingLibrary.findIndex(item => item.id === data.id);
    if (existingIdx >= 0) {
      // Already in library - remove it (toggle off)
      existingLibrary.splice(existingIdx, 1);
      localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));
      showToast('Removed from library', 'info');
    } else {
      // Add to library
      existingLibrary.push(data);
      localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));
      showToast('Saved to library!', 'success');
    }

    // Re-render to update star state
    renderCommunityList();
  } catch (err) {
    showToast('Could not save: ' + err.message, 'error');
  }
}

function isInLibrary(dataId) {
  try {
    const library = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    return library.some(item => item.id === dataId);
  } catch {
    return false;
  }
}

function addModalToGroup() {
  if (!selectedConversion) return;

  // First add to library if not already there
  try {
    const existingLibrary = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    const data = { ...selectedConversion.data, _userCreated: true };

    const existing = existingLibrary.findIndex(item => item.id === data.id);
    if (existing < 0) {
      existingLibrary.push(data);
      localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));
    }
  } catch (err) {
    console.error('Failed to add to library:', err);
  }

  // Then open group selection modal
  addAdversaryToGroup(selectedConversion.data);
}

function copyShareLink() {
  if (!selectedConversion) return;
  const url = `${window.location.origin}/community/${selectedConversion.id}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Share link copied!', 'success'))
    .catch(() => showToast('Failed to copy link', 'error'));
}

function copyShareLinkFor(conversionId) {
  const url = `${window.location.origin}/community/${conversionId}`;
  navigator.clipboard.writeText(url)
    .then(() => showToast('Share link copied!', 'success'))
    .catch(() => showToast('Failed to copy link', 'error'));
}

function openReportModal() {
  if (!selectedConversion) return;
  if (!currentUser) {
    showToast('Please log in to report content', 'info');
    return;
  }
  document.getElementById('reportConversionName').textContent = `Reporting: ${selectedConversion.name}`;
  document.getElementById('reportReason').value = '';
  document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('reportModal').classList.add('hidden');
}

async function submitReport() {
  if (!selectedConversion) return;

  const reason = document.getElementById('reportReason').value.trim();
  if (reason.length < 10) {
    showToast('Please provide more detail (at least 10 characters)', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/community/conversions/${selectedConversion.id}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to submit report');
    }

    closeReportModal();
    showToast('Report submitted. Thank you for helping keep the community safe.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== COMMUNITY FILTERS ====================
let communityFilterMode = 'all';

function setCommunityFilter(mode) {
  communityFilterMode = mode;
  communityPage = 1;

  // Update active state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === mode);
  });

  if (mode === 'mine') {
    loadMySubmissions();
  } else {
    loadCommunityConversions();
  }
}

async function loadMySubmissions() {
  const listEl = document.getElementById('communityList');
  listEl.innerHTML = `
    <div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton-tags"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-tag"></div></div></div>
    <div class="skeleton-card"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div><div class="skeleton-tags"><div class="skeleton skeleton-tag"></div><div class="skeleton skeleton-tag"></div></div></div>
  `;

  try {
    const response = await fetch('/api/community/my-submissions');
    if (!response.ok) throw new Error('Failed to load');

    const data = await response.json();
    communityConversions = data.conversions || [];
    communityTotalPages = 1;

    if (communityConversions.length === 0) {
      listEl.innerHTML = `
        <div class="community-empty">
          <h3>No submissions yet</h3>
          <p>Convert a stat block and click "Share to Community" to get started!</p>
        </div>
      `;
    } else {
      renderCommunityList();
    }

    document.getElementById('communityPagination').classList.add('hidden');

  } catch (err) {
    listEl.innerHTML = `
      <div class="community-empty">
        <p>Could not load your submissions.</p>
      </div>
    `;
  }
}

// ==================== URL ROUTING ====================
function handleUrlRouting() {
  const path = window.location.pathname;

  // Handle /community/:id routes (specific conversion)
  const communityMatch = path.match(/^\/community\/(.+)$/);
  if (communityMatch) {
    const conversionId = communityMatch[1];
    navigateTo('community', false);
    // Wait for community page to load, then open modal
    setTimeout(() => openCommunityModal(conversionId), 100);
    return;
  }

  // Handle base page routes
  const page = URL_TO_PAGE[path];
  if (page) {
    // Replace history state with page info
    window.history.replaceState({ page }, '', path);
    navigateTo(page, false);
  }
}

// ==================== SAVE AND PUBLISH ====================
async function saveAndPublish() {
  if (!currentUser) {
    showToast('Please sign in to save and publish', 'info');
    return;
  }

  if (!currentConverted) {
    showToast('Nothing to save. Convert a stat block first.', 'error');
    return;
  }

  try {
    // Publish to community
    const response = await fetch('/api/community/conversions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: currentConverted.name,
        tier: currentConverted.tier,
        advType: currentConverted.advType,
        sourceSystem: detectedSystem,
        data: getExportObject()
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save');
    }

    const result = await response.json();
    const communityId = result.id;

    // Save to local library with creator info
    const existingLibrary = JSON.parse(localStorage.getItem('dh-user-library') || '[]');
    const exportObj = getExportObject();
    exportObj._communityId = communityId;
    exportObj._isCreator = true;

    const existingIdx = existingLibrary.findIndex(item => item.id === exportObj.id);
    if (existingIdx >= 0) {
      existingLibrary[existingIdx] = exportObj;
    } else {
      existingLibrary.push(exportObj);
    }
    localStorage.setItem('dh-user-library', JSON.stringify(existingLibrary));

    showToast('Saved and published!', 'success');

    // Reload if on community tab
    if (communityLoaded) {
      communityPage = 1;
      loadCommunityConversions();
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Legacy function for backwards compatibility
async function shareToCommunity() {
  return saveAndPublish();
}

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const communityModal = document.getElementById('communityModal');
    const loginModal = document.getElementById('loginModal');
    const keyboardModal = document.getElementById('keyboardModal');

    if (keyboardModal && !keyboardModal.classList.contains('hidden')) {
      closeKeyboardModal();
    }
    if (communityModal && !communityModal.classList.contains('hidden')) {
      closeCommunityModal();
    }
    if (loginModal && !loginModal.classList.contains('hidden')) {
      closeLoginModal();
    }
  }
});
