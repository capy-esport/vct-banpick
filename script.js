/**
 * VCT BAN/PICK TOURNAMENT UTILITY
 * Pure Vanilla JavaScript SPA Architecture
 * 
 * Modules:
 * 1. Global Constants & Roster Data
 * 2. Audio Manager (HTML5 Audio + Web Audio API Synthesis Fallbacks)
 * 3. Centralized State Manager
 * 4. CS:GO-Style Horizontal Roulette Reel Engine
 * 5. Phase 1: Setup & Validation
 * 6. Phase 2: Seeding Roulette Reels (Team Priority & Agent Mode)
 * 7. Phase 3: Map Ban/Pick State Machine & BO5 Spin
 * 8. Phase 4: Agent Phase (Random Agent & Ban 6 Agents)
 * 9. Phase 5: Discord Export with YAML & DIFF Syntax Highlighting
 * 10. Application Initialization & Reset Handlers
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. GLOBAL CONSTANTS & ROSTER DATA
     ========================================================================== */

  const ALL_MAPS = [
    { id: 'abyss', name: 'Abyss', image: 'assets/maps/abyss.png' },
    { id: 'ascent', name: 'Ascent', image: 'assets/maps/ascent.png' },
    { id: 'bind', name: 'Bind', image: 'assets/maps/bind.png' },
    { id: 'breeze', name: 'Breeze', image: 'assets/maps/breeze.png' },
    { id: 'corrode', name: 'Corrode', image: 'assets/maps/corrode.png' },
    { id: 'fracture', name: 'Fracture', image: 'assets/maps/fracture.png' },
    { id: 'haven', name: 'Haven', image: 'assets/maps/haven.png' },
    { id: 'icebox', name: 'Icebox', image: 'assets/maps/icebox.png' },
    { id: 'lotus', name: 'Lotus', image: 'assets/maps/lotus.png' },
    { id: 'pearl', name: 'Pearl', image: 'assets/maps/pearl.png' },
    { id: 'split', name: 'Split', image: 'assets/maps/split.png' },
    { id: 'sunset', name: 'Sunset', image: 'assets/maps/sunset.png' }
  ];

  // Master agent roster covering all 4 roles
  const allAgents = [
    // Duelists
    { name: 'Jett', role: 'Duelist', image: 'assets/agents/jett.png' },
    { name: 'Phoenix', role: 'Duelist', image: 'assets/agents/phoenix.png' },
    { name: 'Reyna', role: 'Duelist', image: 'assets/agents/reyna.png' },
    { name: 'Raze', role: 'Duelist', image: 'assets/agents/raze.png' },
    { name: 'Yoru', role: 'Duelist', image: 'assets/agents/yoru.png' },
    { name: 'Neon', role: 'Duelist', image: 'assets/agents/neon.png' },
    { name: 'Iso', role: 'Duelist', image: 'assets/agents/iso.png' },

    // Controllers
    { name: 'Brimstone', role: 'Controller', image: 'assets/agents/brimstone.png' },
    { name: 'Viper', role: 'Controller', image: 'assets/agents/viper.png' },
    { name: 'Omen', role: 'Controller', image: 'assets/agents/omen.png' },
    { name: 'Astra', role: 'Controller', image: 'assets/agents/astra.png' },
    { name: 'Harbor', role: 'Controller', image: 'assets/agents/harbor.png' },
    { name: 'Clove', role: 'Controller', image: 'assets/agents/clove.png' },

    // Sentinels
    { name: 'Killjoy', role: 'Sentinel', image: 'assets/agents/killjoy.png' },
    { name: 'Cypher', role: 'Sentinel', image: 'assets/agents/cypher.png' },
    { name: 'Sage', role: 'Sentinel', image: 'assets/agents/sage.png' },
    { name: 'Chamber', role: 'Sentinel', image: 'assets/agents/chamber.png' },
    { name: 'Deadlock', role: 'Sentinel', image: 'assets/agents/deadlock.png' },
    { name: 'Vyse', role: 'Sentinel', image: 'assets/agents/vyse.png' },

    // Initiators
    { name: 'Sova', role: 'Initiator', image: 'assets/agents/sova.png' },
    { name: 'Breach', role: 'Initiator', image: 'assets/agents/breach.png' },
    { name: 'Skye', role: 'Initiator', image: 'assets/agents/skye.png' },
    { name: 'KAY/O', role: 'Initiator', image: 'assets/agents/kayo.png' },
    { name: 'Fade', role: 'Initiator', image: 'assets/agents/fade.png' },
    { name: 'Gekko', role: 'Initiator', image: 'assets/agents/gekko.png' },
    { name: 'Tejo', role: 'Initiator', image: 'assets/agents/tejo.png' }
  ];

  /* ==========================================================================
     2. AUDIO MANAGER
     Robust HTML5 audio loader with Web Audio API synthesizer fallback
     ========================================================================== */

  class SafeAudioManager {
    constructor() {
      this.soundEnabled = true;
      this.audioCtx = null;
      this.tickPool = [];
      this.poolIdx = 0;
      this.cheerAudio = null;
      this.initAudioElements();
    }

    initAudioElements() {
      try {
        this.cheerAudio = new Audio('assets/sounds/cheer.mp3');
        this.cheerAudio.volume = 0.6;
        for (let i = 0; i < 3; i++) {
          const a = new Audio('assets/sounds/tick.mp3');
          a.volume = 0.35;
          this.tickPool.push(a);
        }
      } catch (e) {}
    }

    initContext() {
      if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          this.audioCtx = new AudioContextClass();
        } catch (e) {}
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    }

    playTick() {
      if (!this.soundEnabled) return;
      this.initContext();
      
      // Preferred Web Audio synthesis: 0 latency, 0 DOM allocations, cannot exhaust hardware channels
      if (this.audioCtx && this.audioCtx.state === 'running') {
        this.synthesizeTick();
        return;
      }

      // Fallback: Reusable fixed audio pool without cloneNode
      try {
        if (this.tickPool && this.tickPool.length > 0) {
          const audio = this.tickPool[this.poolIdx];
          this.poolIdx = (this.poolIdx + 1) % this.tickPool.length;
          audio.currentTime = 0;
          const p = audio.play();
          if (p !== undefined) {
            p.catch(() => this.synthesizeTick());
          }
        } else {
          this.synthesizeTick();
        }
      } catch (e) {
        this.synthesizeTick();
      }
    }

    playCheer() {
      if (!this.soundEnabled) return;
      this.initContext();

      try {
        if (this.cheerAudio) {
          this.cheerAudio.currentTime = 0;
          const p = this.cheerAudio.play();
          if (p !== undefined) {
            p.catch(() => this.synthesizeCheer());
          }
        } else {
          this.synthesizeCheer();
        }
      } catch (e) {
        this.synthesizeCheer();
      }
    }

    synthesizeTick() {
      if (!this.audioCtx) return;
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(750, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.035);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.035);
      } catch (e) {}
    }

    synthesizeCheer() {
      if (!this.audioCtx) return;
      try {
        const chordNotes = [523.25, 659.25, 783.99, 1046.50]; // Victorious C Major chord
        chordNotes.forEach((freq, i) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + (i * 0.05));
          gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime + (i * 0.05));
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.85);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(this.audioCtx.currentTime + (i * 0.05));
          osc.stop(this.audioCtx.currentTime + 0.95);
        });
      } catch (e) {}
    }

    playBan() {
      if (!this.soundEnabled) return;
      this.initContext();
      this.synthesizeBan();
    }

    playPick() {
      if (!this.soundEnabled) return;
      this.initContext();
      this.synthesizePick();
    }

    synthesizeBan() {
      if (!this.audioCtx) return;
      try {
        const freqs = [320, 680, 1150]; // Clanging metallic ban sound
        freqs.forEach((freq) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
          gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.35);
        });
      } catch (e) {}
    }

    synthesizePick() {
      if (!this.audioCtx) return;
      try {
        const freqs = [1760, 2637]; // High crisp ting chime
        freqs.forEach((freq) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
          gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.55);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          osc.stop(this.audioCtx.currentTime + 0.55);
        });
      } catch (e) {}
    }
  }

  const audioManager = new SafeAudioManager();

  const VCT_PRO_STEPS = [
    { team: 'A', subPick: 'PICK 1 OF 1' },
    { team: 'B', subPick: 'PICK 1 OF 2' },
    { team: 'B', subPick: 'PICK 2 OF 2' },
    { team: 'A', subPick: 'PICK 1 OF 2' },
    { team: 'A', subPick: 'PICK 2 OF 2' },
    { team: 'B', subPick: 'PICK 1 OF 2' },
    { team: 'B', subPick: 'PICK 2 OF 2' },
    { team: 'A', subPick: 'PICK 1 OF 2' },
    { team: 'A', subPick: 'PICK 2 OF 2' },
    { team: 'B', subPick: 'PICK 1 OF 1' }
  ];

  // Snake draft turn order (1-2-2-2-2-1) cho Random Agent mode
  const RANDOM_TURN_ORDER = ['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B'];

  function preloadAllAssets() {
    try {
      ALL_MAPS.forEach((m) => {
        if (m.image) {
          const img = new Image();
          img.src = m.image;
        }
      });
      allAgents.forEach((a) => {
        if (a.image) {
          const img = new Image();
          img.src = a.image;
        }
      });
    } catch (e) {}
  }

  /* ==========================================================================
     3. CENTRALIZED STATE OBJECT
     ========================================================================== */

  const state = {
    phase: 1,
    isActionLocked: false,

    // Phase 1
    teams: {
      team1: '',
      team2: '',
      teamA: '', // Permanent designation (Phases 3-5)
      teamB: ''
    },
    format: 'BO3', // BO1, BO3, BO5
    poolMaps: [],  // Exactly 7 map names

    // Phase 2
    wheels: {
      teamWinner: null,        // 'team1' | 'team2'
      teamChoicePending: false,
      isSpinningTeam: false
    },
    activeMapIndex: null,

    // Phase 3
    mapDraft: {
      steps: [],
      currentStepIndex: 0,
      bannedMaps: [],
      draftedMaps: [],
      sideChoicePending: null,
      isComplete: false,
      bo5DeciderRolled: false
    },

    // Phase 4
    agentDraft: {
      mode: null,
      availableAgents: [],
      bannedAgents: [],
      draftedAgents: {
        A: [],
        B: []
      },
      currentStepIndex: 0,
      isRolling: false,
      isComplete: false
    }
  };

  /* ==========================================================================
     4. STATE HISTORY & UNDO SYSTEM (STATE SNAPSHOT PATTERN)
     ========================================================================== */

  let stateHistory = [];

  window.__banpick = {
    get state() { return state; },
    get stateHistory() { return stateHistory; },
    undoLastAction
  };

  function updateUndoButtonState() {
    const btnUndo = $('#btn-undo-action');
    if (btnUndo) {
      btnUndo.disabled = (stateHistory.length === 0);
    }
  }

  function saveStateSnapshot() {
    try {
      const snapshot = JSON.parse(JSON.stringify(state));
      stateHistory.push(snapshot);
      if (stateHistory.length > 20) {
        stateHistory.shift();
      }
      updateUndoButtonState();
    } catch (e) {}
  }

  function undoLastAction() {
    if (stateHistory.length === 0) return;

    const prevState = stateHistory.pop();
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, prevState);

    updateUndoButtonState();
    audioManager.playTick();
    showToast('Last action undone.');

    // Switch phase view without wiping state
    switchPhase(state.phase, false);

    if (state.phase === 1) {
      const inT1 = $('#input-team1');
      const inT2 = $('#input-team2');
      if (inT1) inT1.value = state.teams.team1 || '';
      if (inT2) inT2.value = state.teams.team2 || '';
      $$('input[name="match-format"]').forEach((radio) => {
        radio.checked = (radio.value === state.format);
      });
      $$('.format-card').forEach((card) => {
        if (card.dataset.format === state.format) card.classList.add('selected');
        else card.classList.remove('selected');
      });
      $$('.setup-map-card').forEach((card) => {
        if (state.poolMaps.includes(card.dataset.map)) card.classList.add('selected');
        else card.classList.remove('selected');
      });
      updateSetupValidation();
    } else if (state.phase === 2) {
      updatePhase2Controls();
      if (state.wheels.teamWinner && !state.teams.teamA) {
        showTeamChoiceModal(state.wheels.teamWinner);
      } else {
        $('#modal-team-choice')?.classList.add('hidden');
      }
    } else if (state.phase === 3) {
      $('#modal-bo5-wheel')?.classList.add('hidden');
      const metaPill = $('#map-phase-meta-pill');
      if (metaPill) {
        metaPill.textContent = `${state.teams.teamA} (A) vs ${state.teams.teamB} (B) • ${state.format}`;
      }
      renderMapDraftView();
      if (state.mapDraft.sideChoicePending) {
        promptSideChoiceModal(state.mapDraft.sideChoicePending);
      } else {
        $('#modal-side-choice')?.classList.add('hidden');
      }
    } else if (state.phase === 4) {
      $('#modal-map-agent-wheel')?.classList.add('hidden');
      $('#agent-roll-spotlight')?.classList.add('hidden');

      if (state.activeMapIndex !== null && state.mapDraft.draftedMaps[state.activeMapIndex]) {
        const mapEntry = state.mapDraft.draftedMaps[state.activeMapIndex];
        if (mapEntry.isAgentDraftComplete) {
          openMapAgentDraftReview(state.activeMapIndex);
        } else {
          $('#agent-map-selector-view').classList.add('hidden');
          $('#agent-drafting-view').classList.remove('hidden');
          $('#agent-draft-complete-banner')?.classList.add('hidden');
          renderAgentPhaseView();
        }
      } else {
        showIntermediateMapSelector();
      }
    } else if (state.phase === 5) {
      initPhase5();
    }
  }

  /* ==========================================================================
     5. UTILITIES & DOM HELPERS
     ========================================================================== */

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  function showToast(message, isError = false) {
    const container = $('#toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.innerHTML = `<span>${isError ? '⚠️' : '✓'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function switchPhase(newPhase, shouldInit = true) {
    state.phase = newPhase;

    $$('.step-item').forEach((item) => {
      const phaseNum = parseInt(item.dataset.phase, 10);
      item.classList.remove('active', 'completed');
      if (phaseNum === newPhase) {
        item.classList.add('active');
      } else if (phaseNum < newPhase) {
        item.classList.add('completed');
      }
    });

    $$('.phase-section').forEach((sec) => sec.classList.remove('active'));
    const activeSec = $(`#phase-${newPhase}`);
    if (activeSec) {
      activeSec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (shouldInit) {
      if (newPhase === 2) initPhase2();
      if (newPhase === 3) initPhase3();
      if (newPhase === 4) initPhase4();
      if (newPhase === 5) initPhase5();
    }
  }

  /* ==========================================================================
     5. PHASE 1: SETUP SCREEN
     ========================================================================== */

  function initPhase1() {
    const mapGrid = $('#setup-map-grid');
    const inputTeam1 = $('#input-team1');
    const inputTeam2 = $('#input-team2');
    const btnSubmit = $('#btn-submit-setup');
    const formatRadios = $$('input[name="match-format"]');

    mapGrid.innerHTML = '';
    ALL_MAPS.forEach((map) => {
      const card = document.createElement('div');
      card.className = 'setup-map-card';
      card.dataset.mapName = map.name;
      card.innerHTML = `
        <img src="${map.image}" alt="${map.name}" class="map-card-img" onerror="this.src='assets/maps/ascent.png'">
        <div class="map-card-overlay">
          <span class="map-card-name">${map.name}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        handleMapCardClick(map.name);
      });

      mapGrid.appendChild(card);
    });

    formatRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        state.format = e.target.value;
        $$('.format-card').forEach((card) => card.classList.remove('selected'));
        e.target.closest('.format-card').classList.add('selected');
        audioManager.playTick();
      });
    });

    inputTeam1.addEventListener('input', validatePhase1);
    inputTeam2.addEventListener('input', validatePhase1);

    $('#btn-quick-standard').addEventListener('click', () => {
      state.poolMaps = ALL_MAPS.slice(0, 7).map((m) => m.name);
      audioManager.playTick();
      updateMapCardSelections();
      validatePhase1();
    });

    $('#btn-quick-random').addEventListener('click', () => {
      const shuffled = [...ALL_MAPS].sort(() => 0.5 - Math.random());
      state.poolMaps = shuffled.slice(0, 7).map((m) => m.name);
      audioManager.playTick();
      updateMapCardSelections();
      validatePhase1();
    });

    $('#btn-quick-clear').addEventListener('click', () => {
      state.poolMaps = [];
      audioManager.playTick();
      updateMapCardSelections();
      validatePhase1();
    });

    btnSubmit.addEventListener('click', () => {
      if (!validatePhase1()) return;
      state.teams.team1 = inputTeam1.value.trim();
      state.teams.team2 = inputTeam2.value.trim();
      audioManager.playTick();
      switchPhase(2);
    });

    // Default 7 maps selected
    state.poolMaps = ALL_MAPS.slice(0, 7).map((m) => m.name);
    updateMapCardSelections();
    validatePhase1();
  }

  function handleMapCardClick(mapName) {
    const index = state.poolMaps.indexOf(mapName);
    if (index > -1) {
      state.poolMaps.splice(index, 1);
      audioManager.playTick();
    } else {
      if (state.poolMaps.length < 7) {
        state.poolMaps.push(mapName);
        audioManager.playTick();
      } else {
        showToast('Maximum 7 maps allowed. Deselect one first.', true);
      }
    }
    updateMapCardSelections();
    validatePhase1();
  }

  function updateMapCardSelections() {
    $$('.setup-map-card').forEach((card) => {
      const mapName = card.dataset.mapName;
      if (state.poolMaps.includes(mapName)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    const counter = $('#map-selection-counter');
    const count = state.poolMaps.length;
    counter.textContent = `${count} / 7 SELECTED`;
    if (count === 7) {
      counter.className = 'counter-badge counter-success';
    } else {
      counter.className = 'counter-badge counter-warning';
    }
  }

  function validatePhase1() {
    const t1 = $('#input-team1').value.trim();
    const t2 = $('#input-team2').value.trim();
    const teamError = $('#team-validation-error');
    const mapError = $('#map-pool-validation-error');
    const btnSubmit = $('#btn-submit-setup');

    let isTeamValid = true;
    let isMapValid = true;

    if (!t1 || !t2) {
      teamError.textContent = 'Both Team 1 and Team 2 names must not be empty.';
      isTeamValid = false;
    } else if (t1.toLowerCase() === t2.toLowerCase()) {
      teamError.textContent = 'Team 1 and Team 2 must have distinct, different names.';
      isTeamValid = false;
    } else {
      teamError.textContent = '';
    }

    if (state.poolMaps.length !== 7) {
      mapError.textContent = `You must select exactly 7 maps (currently ${state.poolMaps.length} selected).`;
      isMapValid = false;
    } else {
      mapError.textContent = '';
    }

    const isValid = isTeamValid && isMapValid;
    btnSubmit.disabled = !isValid;
    return isValid;
  }

  /* ==========================================================================
     6. PHASE 2: CS:GO-STYLE HORIZONTAL ROULETTE REELS
     ========================================================================== */

  const TOTAL_REEL_ITEMS = 80;
  const WINNING_REEL_INDEX = 65; // Settles after a long suspenseful high-speed scroll
  const CARD_WIDTH = 160;        // Width in pixels of each card

  function initPhase2() {
    buildTeamRouletteStrip();

    $('#btn-spin-team').onclick = () => handleSpinTeamRoulette(false);
    $('#btn-fast-spin-team').onclick = () => handleSpinTeamRoulette(true);

    $('#btn-choose-team-a').onclick = () => confirmTeamDesignation('A');
    $('#btn-choose-team-b').onclick = () => confirmTeamDesignation('B');

    const btnChange = $('#btn-change-team-choice');
    if (btnChange) {
      btnChange.onclick = () => {
        if (state.wheels.teamWinner && !state.isActionLocked) {
          showTeamChoiceModal(state.wheels.teamWinner);
        }
      };
    }

    $('#btn-proceed-to-maps').onclick = () => {
      const isTeamDone = Boolean(state.teams.teamA);

      if (!isTeamDone) {
        showToast('Please complete Roulette 01 (Team Priority) and designate Team A or B first!', true);
        triggerHighlightCard('#card-wheel-team');
        return;
      }

      audioManager.playTick();
      switchPhase(3);
    };

    updatePhase2Controls();
  }

  function triggerHighlightCard(cardSelector) {
    const el = $(cardSelector);
    if (!el) return;
    el.classList.remove('card-highlight-shake');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('card-highlight-shake');
    setTimeout(() => {
      el.classList.remove('card-highlight-shake');
    }, 700);
  }

  function escapeHTML(str) {
    return String(str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  /**
   * Builds the DOM strip for Wheel 1 (Team Priority) with strictly alternating items
   */
  function buildTeamRouletteStrip(predeterminedWinner = null) {
    const strip = $('#reel-strip-team');
    if (!strip) return;
    strip.innerHTML = '';
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';

    const t1Name = escapeHTML(state.teams.team1 || 'TEAM 1');
    const t2Name = escapeHTML(state.teams.team2 || 'TEAM 2');

    // Align parity so WINNING_REEL_INDEX matches predeterminedWinner with alternating cards
    const winnerIsTeam1 = predeterminedWinner ? (predeterminedWinner === 'team1') : true;
    const offsetIsEven = (WINNING_REEL_INDEX % 2 === 0);
    const startWithTeam1 = offsetIsEven ? winnerIsTeam1 : !winnerIsTeam1;

    for (let i = 0; i < TOTAL_REEL_ITEMS; i++) {
      const isTeam1 = (i % 2 === 0) ? startWithTeam1 : !startWithTeam1;
      const teamName = isTeam1 ? t1Name : t2Name;
      const card = document.createElement('div');
      card.className = `roulette-card ${isTeam1 ? 'team-1-card' : 'team-2-card'}`;
      card.dataset.index = i;
      card.innerHTML = `
        <span class="roulette-card-icon">${isTeam1 ? '🛡️' : '⚔️'}</span>
        <span class="roulette-card-title">${teamName}</span>
        <span class="roulette-card-sub">${isTeam1 ? 'TEAM 1' : 'TEAM 2'}</span>
      `;
      strip.appendChild(card);
    }
  }

  /**
   * Builds the DOM strip for Mini-Roulette (Per-Map Agent Mode) with strictly alternating items across 3 modes
   * UI Constraint: NO PERCENTAGES DISPLAYED ANYWHERE!
   */
  function buildMiniRouletteStrip(predeterminedWinner = null) {
    const strip = $('#mini-reel-strip');
    if (!strip) return;
    strip.innerHTML = '';
    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';

    const MODES = [
      { name: 'Random Agent', icon: '🎲', className: 'tile-random' },
      { name: 'Ban 6 Agents', icon: '🚫', className: 'tile-ban6' },
      { name: 'VCT Professional', icon: '👑', className: 'tile-vct-pro' }
    ];

    let winnerIdx = MODES.findIndex((m) => m.name === predeterminedWinner);
    if (winnerIdx === -1) winnerIdx = 0;

    // Shift pattern so that card at WINNING_REEL_INDEX lands exactly on winnerIdx
    const shift = ((winnerIdx - (WINNING_REEL_INDEX % 3)) % 3 + 3) % 3;

    for (let i = 0; i < TOTAL_REEL_ITEMS; i++) {
      const mode = MODES[(i + shift) % 3];
      const card = document.createElement('div');
      card.className = `mini-roulette-tile ${mode.className}`;
      card.dataset.index = i;
      card.innerHTML = `
        <span class="mini-tile-icon">${mode.icon}</span>
        <span class="mini-tile-name">${mode.name}</span>
      `;
      strip.appendChild(card);
    }
  }

  function updatePhase2Controls() {
    const btnSpinTeam = $('#btn-spin-team');
    const btnFastSpinTeam = $('#btn-fast-spin-team');
    const btnProceed = $('#btn-proceed-to-maps');
    const btnChange = $('#btn-change-team-choice');
    const chk1 = $('#chk-roulette-1');
    const proceedHint = $('#proceed-maps-hint');

    const isTeamDone = Boolean(state.teams.teamA);

    // 1. Wheel 1 Controls & Badges
    if (isTeamDone) {
      if (btnSpinTeam) {
        btnSpinTeam.disabled = true;
        btnSpinTeam.textContent = 'SEEDING COMPLETED';
      }
      if (btnFastSpinTeam) btnFastSpinTeam.disabled = true;
      $('#team-wheel-status').textContent = 'Seeding confirmed';
      const badge = $('#team-assignment-badge');
      badge.className = 'badge-status-box';
      badge.style.background = 'rgba(0, 240, 255, 0.15)';
      badge.style.color = '#00f0ff';
      badge.style.border = '1px solid #00f0ff';
      badge.textContent = `TEAM A: ${state.teams.teamA} | TEAM B: ${state.teams.teamB}`;
      badge.classList.remove('hidden');
      if (btnChange) btnChange.classList.remove('hidden');

      if (chk1) {
        chk1.classList.add('completed');
        chk1.innerHTML = `<span class="chk-icon">✅</span><span class="chk-text">ROULETTE 01: TEAM A [${state.teams.teamA}] / TEAM B [${state.teams.teamB}]</span>`;
      }
    } else {
      const locked = state.wheels.isSpinningTeam || state.isActionLocked;
      if (btnSpinTeam) {
        btnSpinTeam.disabled = locked;
        btnSpinTeam.textContent = 'SPIN TEAM ROULETTE';
      }
      if (btnFastSpinTeam) btnFastSpinTeam.disabled = locked;
      if (btnChange) btnChange.classList.add('hidden');
      if (chk1) {
        chk1.classList.remove('completed');
        chk1.innerHTML = `<span class="chk-icon">⏳</span><span class="chk-text">ROULETTE 01: TEAM PRIORITY PENDING</span>`;
      }
    }

    // 2. Proceed Button Status & Hints
    if (btnProceed) {
      if (isTeamDone) {
        btnProceed.classList.remove('btn-proceed-locked');
        btnProceed.classList.add('btn-proceed-ready');
        btnProceed.innerHTML = 'PROCEED TO MAP BAN/PICK (READY) &rarr;';
        if (proceedHint) {
          proceedHint.textContent = '✓ Team Priority complete. Ready to proceed to Map Ban/Pick phase.';
          proceedHint.style.color = '#00f0ff';
        }
      } else {
        btnProceed.classList.remove('btn-proceed-ready');
        btnProceed.classList.add('btn-proceed-locked');
        btnProceed.innerHTML = 'PROCEED TO MAP BAN/PICK &rarr;';
        if (proceedHint) {
          proceedHint.textContent = 'Spin Team Priority wheel above to proceed to Map Ban/Pick';
          proceedHint.style.color = 'var(--text-muted)';
        }
      }
    }
  }

  /**
   * Animates a CS:GO-style roulette reel with 3 phases:
   * 1. Acceleration (~18% of time)
   * 2. High-speed scrolling (~47% of time)
   * 3. Deceleration to center of winning item (~35% of time)
   * Guaranteed safe completion even if tab is inactive or rAF is throttled.
   */
  function animateReelPhysics(config) {
    const { stripElement, wrapperElement, targetIndex, durationMs = 8500, onTick, onComplete } = config;

    const wrapperWidth = (wrapperElement && wrapperElement.clientWidth) ? wrapperElement.clientWidth : 540;
    const targetOffset = (targetIndex * CARD_WIDTH) + (CARD_WIDTH / 2) - (wrapperWidth / 2);

    const accelTime = Math.min(1500, durationMs * 0.18);
    const decelTime = Math.min(3000, durationMs * 0.35);
    const cruiseTime = durationMs - accelTime - decelTime;
    const totalTime = durationMs;

    const effectiveTime = 0.5 * accelTime + cruiseTime + 0.5 * decelTime;
    const maxVelocity = targetOffset / effectiveTime;

    const startTime = performance.now();
    let lastItemIndex = -1;
    let isFinished = false;
    let animFrameId = null;
    let fallbackTimeoutId = null;

    function finish() {
      if (isFinished) return;
      isFinished = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (fallbackTimeoutId) clearTimeout(fallbackTimeoutId);

      try {
        stripElement.style.transform = `translateX(-${targetOffset}px)`;
        const winningCard = stripElement.querySelector(`[data-index="${targetIndex}"]`);
        if (winningCard) winningCard.classList.add('winner-glow');
      } catch (e) {}

      if (typeof onComplete === 'function') {
        try {
          onComplete();
        } catch (err) {
          console.error('onComplete callback error:', err);
        }
      }
    }

    // Safety timeout: Ensures the roll terminates and unlocks even if background tab freezes rAF
    fallbackTimeoutId = setTimeout(() => {
      finish();
    }, totalTime + 350);

    function frame() {
      if (isFinished) return;
      try {
        const now = performance.now();
        const elapsed = Math.min(now - startTime, totalTime);
        let currentDistance = 0;

        if (elapsed < accelTime) {
          const p = elapsed / accelTime;
          currentDistance = 0.5 * maxVelocity * accelTime * (p * p);
        } else if (elapsed < accelTime + cruiseTime) {
          const distAccel = 0.5 * maxVelocity * accelTime;
          const cruiseElapsed = elapsed - accelTime;
          currentDistance = distAccel + maxVelocity * cruiseElapsed;
        } else {
          const distBeforeDecel = 0.5 * maxVelocity * accelTime + maxVelocity * cruiseTime;
          const decelElapsed = elapsed - (accelTime + cruiseTime);
          const decelProgress = Math.min(decelElapsed / decelTime, 1);
          const remainingFactor = 1 - Math.pow(1 - decelProgress, 3);
          const distDecel = 0.5 * maxVelocity * decelTime * remainingFactor;
          currentDistance = distBeforeDecel + distDecel;
        }

        stripElement.style.transform = `translateX(-${currentDistance}px)`;

        const currentItemIndex = Math.floor((currentDistance + wrapperWidth / 2) / CARD_WIDTH);
        if (currentItemIndex !== lastItemIndex) {
          if (typeof onTick === 'function') {
            try { onTick(); } catch (e) {}
          }
          lastItemIndex = currentItemIndex;
        }

        if (elapsed < totalTime) {
          animFrameId = requestAnimationFrame(frame);
        } else {
          finish();
        }
      } catch (err) {
        console.error('Reel Frame Error:', err);
        finish();
      }
    }

    animFrameId = requestAnimationFrame(frame);

    return {
      cancel: () => finish()
    };
  }

  function handleSpinTeamRoulette(isFast = false) {
    if (state.isActionLocked || state.wheels.isSpinningTeam || state.teams.teamA) return;
    state.isActionLocked = true;
    state.wheels.isSpinningTeam = true;
    updatePhase2Controls();

    $('#team-wheel-status').textContent = isFast ? 'Fast rolling priority...' : 'Spinning for team priority...';

    // 50/50 probability outcome calculated mathematically in JS first
    const isTeam1Winner = Math.random() < 0.5;
    const winnerKey = isTeam1Winner ? 'team1' : 'team2';
    state.wheels.teamWinner = winnerKey;

    // Rebuild strip so winning item is guaranteed at WINNING_REEL_INDEX
    buildTeamRouletteStrip(winnerKey);

    animateReelPhysics({
      stripElement: $('#reel-strip-team'),
      wrapperElement: $('#wrapper-wheel-team'),
      targetIndex: WINNING_REEL_INDEX,
      durationMs: isFast ? 1500 : 8500,
      onTick: () => audioManager.playTick(),
      onComplete: () => {
        try { audioManager.playCheer(); } catch (e) {}
        state.wheels.isSpinningTeam = false;
        state.isActionLocked = false;
        const winnerName = state.teams[winnerKey] || (winnerKey === 'team1' ? state.teams.team1 : state.teams.team2) || 'WINNER';
        $('#team-wheel-status').textContent = `${winnerName.toUpperCase()} WON THE ROLL!`;
        updatePhase2Controls();
        showTeamChoiceModal(winnerKey);
      }
    });
  }

  function showTeamChoiceModal(winnerKey) {
    const winnerName = state.teams[winnerKey] || (winnerKey === 'team1' ? state.teams.team1 : state.teams.team2) || 'TEAM';
    const loserKey = winnerKey === 'team1' ? 'team2' : 'team1';
    const loserName = state.teams[loserKey] || 'OPPONENT';

    $('#modal-winner-title').textContent = `${winnerName.toUpperCase()} WON THE ROLL!`;
    
    const btnA = $('#btn-choose-team-a');
    if (btnA) {
      const titleEl = btnA.querySelector('.choice-title');
      const descEl = btnA.querySelector('.choice-desc');
      if (titleEl) titleEl.textContent = `${winnerName.toUpperCase()} AS TEAM A`;
      if (descEl) descEl.textContent = `Bans first & picks first in map draft. ${loserName} becomes Team B.`;
    }

    const btnB = $('#btn-choose-team-b');
    if (btnB) {
      const titleEl = btnB.querySelector('.choice-title');
      const descEl = btnB.querySelector('.choice-desc');
      if (titleEl) titleEl.textContent = `${winnerName.toUpperCase()} AS TEAM B`;
      if (descEl) descEl.textContent = `Receives starting side selection first. ${loserName} becomes Team A.`;
    }

    $('#modal-team-choice').classList.remove('hidden');
  }

  function confirmTeamDesignation(chosenSlot) {
    saveStateSnapshot();
    $('#modal-team-choice').classList.add('hidden');
    audioManager.playTick();

    const winnerKey = state.wheels.teamWinner || 'team1';
    const loserKey = winnerKey === 'team1' ? 'team2' : 'team1';

    const winnerName = state.teams[winnerKey] || 'Team 1';
    const loserName = state.teams[loserKey] || 'Team 2';

    if (chosenSlot === 'A') {
      state.teams.teamA = winnerName;
      state.teams.teamB = loserName;
    } else {
      state.teams.teamB = winnerName;
      state.teams.teamA = loserName;
    }

    showToast(`${state.teams.teamA} designated as TEAM A. ${state.teams.teamB} designated as TEAM B.`);
    updatePhase2Controls();
  }

  function triggerMapAgentMiniRoulette(mapIndex) {
    if (state.isActionLocked) return;
    const mapEntry = state.mapDraft.draftedMaps[mapIndex];
    if (!mapEntry || mapEntry.isAgentDraftComplete) return;

    state.isActionLocked = true;
    const modal = $('#modal-map-agent-wheel');
    const statusText = $('#mini-roulette-status');
    const resultBanner = $('#mini-roulette-result-banner');
    const resultText = $('#mini-roulette-result-text');

    const tagEl = $('#mini-roulette-map-tag');
    if (tagEl) tagEl.textContent = `// MAP ${mapIndex + 1}: ${mapEntry.map.toUpperCase()} PROTOCOL`;
    const titleEl = $('#mini-roulette-map-title');
    if (titleEl) titleEl.textContent = `${mapEntry.map.toUpperCase()}: AGENT MODE ROLL`;
    if (statusText) statusText.textContent = 'Rolling agent protocol for this map...';
    if (resultBanner) resultBanner.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');

    // Exact distribution: 40% Random Agent, 30% Ban 6 Agents, 30% VCT Professional
    const roll = Math.random();
    let winningMode;
    if (roll < 0.40) {
      winningMode = 'Random Agent';
    } else if (roll < 0.70) {
      winningMode = 'Ban 6 Agents';
    } else {
      winningMode = 'VCT Professional';
    }

    buildMiniRouletteStrip(winningMode);

    animateReelPhysics({
      stripElement: $('#mini-reel-strip'),
      wrapperElement: $('#wrapper-mini-roulette'),
      targetIndex: WINNING_REEL_INDEX,
      durationMs: 4200,
      onTick: () => audioManager.playTick(),
      onComplete: () => {
        try { audioManager.playCheer(); } catch (e) {}
        mapEntry.agentMode = winningMode;
        if (statusText) statusText.textContent = `MODE LOCKED: ${winningMode.toUpperCase()}`;
        if (resultText) resultText.textContent = `MODE: ${winningMode.toUpperCase()}`;
        if (resultBanner) resultBanner.classList.remove('hidden');

        setTimeout(() => {
          if (modal) modal.classList.add('hidden');
          state.isActionLocked = false;
          startPerMapAgentDraft(mapIndex);
        }, 1500);
      }
    });
  }

  /* ==========================================================================
     7. PHASE 3: MAP BAN/PICK STATE MACHINE
     ========================================================================== */

  function buildMapDraftSchedule(format) {
    if (format === 'BO1') {
      return [
        { type: 'ban', team: 'A', label: 'Team A Ban' },
        { type: 'ban', team: 'B', label: 'Team B Ban' },
        { type: 'ban', team: 'A', label: 'Team A Ban' },
        { type: 'ban', team: 'B', label: 'Team B Ban' },
        { type: 'ban', team: 'A', label: 'Team A Ban' },
        { type: 'ban', team: 'B', label: 'Team B Ban' }
      ];
    } else if (format === 'BO3') {
      return [
        { type: 'ban', team: 'A', label: 'Team A Ban' },
        { type: 'ban', team: 'B', label: 'Team B Ban' },
        { type: 'pick', team: 'A', sideChooser: 'B', label: 'Team A Pick (Team B Side)' },
        { type: 'pick', team: 'B', sideChooser: 'A', label: 'Team B Pick (Team A Side)' },
        { type: 'ban', team: 'A', label: 'Team A Ban' },
        { type: 'ban', team: 'B', label: 'Team B Ban' }
      ];
    } else {
      // BO5
      return [
        { type: 'ban', team: 'A', label: 'Team A Ban' },
        { type: 'ban', team: 'B', label: 'Team B Ban' },
        { type: 'pick', team: 'A', sideChooser: 'B', label: 'Team A Pick (Team B Side)' },
        { type: 'pick', team: 'B', sideChooser: 'A', label: 'Team B Pick (Team A Side)' },
        { type: 'pick', team: 'A', sideChooser: 'B', label: 'Team A Pick (Team B Side)' },
        { type: 'pick', team: 'B', sideChooser: 'A', label: 'Team B Pick (Team A Side)' }
      ];
    }
  }

  function initPhase3() {
    state.mapDraft.steps = buildMapDraftSchedule(state.format);
    state.mapDraft.currentStepIndex = 0;
    state.mapDraft.bannedMaps = [];
    state.mapDraft.draftedMaps = [];
    state.mapDraft.sideChoicePending = null;
    state.mapDraft.isComplete = false;
    state.mapDraft.bo5DeciderRolled = false;

    $('#map-phase-meta-pill').textContent = `${state.teams.teamA} (A) vs ${state.teams.teamB} (B) • ${state.format}`;

    $('#btn-choose-attack').onclick = () => handleSideDecision('Attack');
    $('#btn-choose-defense').onclick = () => handleSideDecision('Defense');

    const btnProceedAgents = $('#btn-proceed-to-agents');
    btnProceedAgents.onclick = () => {
      if (!state.mapDraft.isComplete) return;
      audioManager.playTick();
      switchPhase(4);
    };

    renderMapDraftView();
  }

  function renderMapDraftView() {
    const draftState = state.mapDraft;
    const currentStep = draftState.steps[draftState.currentStepIndex];

    // 1. Step Tracker
    const stepsContainer = $('#map-steps-tracker');
    stepsContainer.innerHTML = '';
    draftState.steps.forEach((step, idx) => {
      const chip = document.createElement('div');
      chip.className = 'step-chip';
      if (idx < draftState.currentStepIndex) chip.classList.add('completed');
      if (idx === draftState.currentStepIndex && !draftState.isComplete) chip.classList.add('active');
      chip.textContent = `${step.type.toUpperCase()} ${step.team}`;
      stepsContainer.appendChild(chip);
    });

    const deciderChip = document.createElement('div');
    deciderChip.className = 'step-chip';
    if (draftState.isComplete) deciderChip.classList.add('completed');
    else if (draftState.currentStepIndex >= draftState.steps.length) deciderChip.classList.add('active');
    deciderChip.textContent = 'DECIDER';
    stepsContainer.appendChild(deciderChip);

    // 2. Status Prompt
    const promptElem = $('#map-step-prompt');
    const counterElem = $('#map-step-count');

    if (draftState.isComplete) {
      promptElem.textContent = 'MAP DRAFT COMPLETE — PROCEED TO AGENT PROTOCOL';
      counterElem.textContent = 'FINALIZED';
      $('#btn-proceed-to-agents').classList.remove('hidden');
    } else if (draftState.sideChoicePending) {
      const pending = draftState.sideChoicePending;
      const teamName = pending.choosingTeam === 'A' ? state.teams.teamA : state.teams.teamB;
      promptElem.textContent = `${teamName.toUpperCase()} (TEAM ${pending.choosingTeam}) SELECTING SIDE FOR ${pending.map.toUpperCase()}...`;
      counterElem.textContent = 'SIDE PICK';
    } else if (currentStep) {
      const activeTeamName = currentStep.team === 'A' ? state.teams.teamA : state.teams.teamB;
      promptElem.textContent = `ROUND ${draftState.currentStepIndex + 1}: ${activeTeamName.toUpperCase()} (TEAM ${currentStep.team}) — ${currentStep.type.toUpperCase()} A MAP`;
      counterElem.textContent = `STEP ${draftState.currentStepIndex + 1} / ${draftState.steps.length}`;
    }

    // 3. Render 7 Maps Grid
    const mapGrid = $('#draft-map-grid');
    mapGrid.innerHTML = '';

    state.poolMaps.forEach((mapName) => {
      const isBanned = draftState.bannedMaps.some((b) => b.map === mapName);
      const pickedEntry = draftState.draftedMaps.find((d) => d.map === mapName);

      const card = document.createElement('div');
      card.className = 'draft-map-card';

      let statusBadge = '';
      let isClickable = false;

      if (isBanned) {
        card.classList.add('banned');
        const banInfo = draftState.bannedMaps.find((b) => b.map === mapName);
        statusBadge = `<span class="map-status-badge badge-banned">BANNED BY TEAM ${banInfo.bannedBy}</span>`;
      } else if (pickedEntry) {
        if (pickedEntry.pickedBy === 'A') {
          card.classList.add('picked-a');
          statusBadge = `<span class="map-status-badge badge-picked-a">PICKED BY TEAM A</span>`;
        } else if (pickedEntry.pickedBy === 'B') {
          card.classList.add('picked-b');
          statusBadge = `<span class="map-status-badge badge-picked-b">PICKED BY TEAM B</span>`;
        } else {
          card.classList.add('decider');
          statusBadge = `<span class="map-status-badge badge-decider">REMAINING / DECIDER</span>`;
        }
      } else {
        if (!draftState.isComplete && !draftState.sideChoicePending && currentStep) {
          card.classList.add('clickable');
          isClickable = true;
          statusBadge = `<span class="map-status-badge badge-available">AVAILABLE</span>`;
        }
      }

      card.innerHTML = `
        <img src="assets/maps/${mapName.toLowerCase()}.png" alt="${mapName}" class="map-card-img" onerror="this.src='assets/maps/ascent.png'">
        ${statusBadge}
        <div class="map-card-overlay">
          <span class="map-card-name">${mapName}</span>
        </div>
      `;

      if (isClickable) {
        card.addEventListener('click', () => {
          handleMapSelection(mapName);
        });
      }

      mapGrid.appendChild(card);
    });

    // 4. Drafted Schedule Shelf
    const draftedList = $('#drafted-maps-list');
    draftedList.innerHTML = '';
    draftState.draftedMaps.forEach((dm, i) => {
      const item = document.createElement('div');
      item.className = 'drafted-map-item';

      let pickText = '';
      if (dm.pickedBy === 'A') pickText = `Picked by ${state.teams.teamA} (Team A)`;
      else if (dm.pickedBy === 'B') pickText = `Picked by ${state.teams.teamB} (Team B)`;
      else pickText = 'Decider / Remaining Map';

      let sideText = dm.side ? `${dm.sidePickedBy ? `Team ${dm.sidePickedBy}` : 'Team A'} starting ${dm.side}` : 'Awaiting Side Selection...';

      item.innerHTML = `
        <div class="drafted-map-header">
          <span class="map-slot-label">MAP ${i + 1}</span>
          <span class="meta-tag">${dm.side ? dm.side.toUpperCase() : 'PENDING'}</span>
        </div>
        <div class="map-slot-name">${dm.map}</div>
        <div class="map-slot-subtext">${pickText}</div>
        <div class="map-slot-subtext" style="color: ${dm.side === 'Attack' ? '#ff4655' : '#00e5ff'}; font-weight: 700;">${sideText}</div>
      `;
      draftedList.appendChild(item);
    });
  }

  function handleMapSelection(mapName) {
    if (state.isActionLocked) return;
    const draftState = state.mapDraft;
    const currentStep = draftState.steps[draftState.currentStepIndex];
    if (!currentStep || draftState.sideChoicePending || draftState.isComplete) return;

    saveStateSnapshot();
    audioManager.playTick();

    if (currentStep.type === 'ban') {
      draftState.bannedMaps.push({
        map: mapName,
        bannedBy: currentStep.team
      });
      showToast(`${mapName} was BANNED by Team ${currentStep.team}`);
      advanceMapDraftStep();
    } else if (currentStep.type === 'pick') {
      const draftedEntry = {
        map: mapName,
        pickedBy: currentStep.team,
        sidePickedBy: currentStep.sideChooser,
        side: null,
        agentMode: null,
        draftedAgents: { A: [], B: [] },
        bannedAgents: [],
        isAgentDraftComplete: false
      };
      draftState.draftedMaps.push(draftedEntry);
      showToast(`${mapName} was PICKED by Team ${currentStep.team}`);

      draftState.sideChoicePending = {
        map: mapName,
        choosingTeam: currentStep.sideChooser,
        mapSlotIndex: draftState.draftedMaps.length - 1
      };

      renderMapDraftView();
      promptSideChoiceModal(draftState.sideChoicePending);
    }
  }

  function promptSideChoiceModal(pending) {
    const teamName = pending.choosingTeam === 'A' ? state.teams.teamA : state.teams.teamB;
    $('#side-choice-team-prompt').textContent = `${teamName.toUpperCase()} (TEAM ${pending.choosingTeam}): SELECT STARTING SIDE`;
    $('#side-choice-map-prompt').textContent = `Select starting side for Map: ${pending.map}`;
    $('#modal-side-choice').classList.remove('hidden');
  }

  function handleSideDecision(selectedSide) {
    const draftState = state.mapDraft;
    if (!draftState.sideChoicePending) return;

    saveStateSnapshot();
    audioManager.playTick();
    $('#modal-side-choice').classList.add('hidden');

    const pending = draftState.sideChoicePending;
    draftState.draftedMaps[pending.mapSlotIndex].side = selectedSide;
    draftState.sideChoicePending = null;

    showToast(`Team ${pending.choosingTeam} chose ${selectedSide.toUpperCase()} on ${pending.map}`);
    advanceMapDraftStep();
  }

  function advanceMapDraftStep() {
    const draftState = state.mapDraft;
    draftState.currentStepIndex += 1;

    if (draftState.currentStepIndex >= draftState.steps.length) {
      handleFinalMapDecider();
    } else {
      renderMapDraftView();
    }
  }

  function handleFinalMapDecider() {
    const draftState = state.mapDraft;

    const usedMapNames = [
      ...draftState.bannedMaps.map((b) => b.map),
      ...draftState.draftedMaps.map((d) => d.map)
    ];
    const remainingMap = state.poolMaps.find((m) => !usedMapNames.includes(m));

    if (!remainingMap) {
      draftState.isComplete = true;
      renderMapDraftView();
      return;
    }

    if (state.format === 'BO1' || state.format === 'BO3') {
      const deciderEntry = {
        map: remainingMap,
        pickedBy: null,
        sidePickedBy: 'A',
        side: null,
        agentMode: null,
        draftedAgents: { A: [], B: [] },
        bannedAgents: [],
        isAgentDraftComplete: false
      };
      draftState.draftedMaps.push(deciderEntry);

      draftState.sideChoicePending = {
        map: remainingMap,
        choosingTeam: 'A',
        mapSlotIndex: draftState.draftedMaps.length - 1
      };

      renderMapDraftView();
      promptSideChoiceModal(draftState.sideChoicePending);
    } else if (state.format === 'BO5') {
      if (!draftState.bo5DeciderRolled) {
        draftState.bo5DeciderRolled = true;

        const rolledSideForA = Math.random() < 0.5 ? 'Attack' : 'Defense';

        const deciderEntry = {
          map: remainingMap,
          pickedBy: null,
          sidePickedBy: null,
          side: rolledSideForA,
          agentMode: null,
          draftedAgents: { A: [], B: [] },
          bannedAgents: [],
          isAgentDraftComplete: false
        };
        draftState.draftedMaps.push(deciderEntry);
        draftState.isComplete = true;

        renderMapDraftView();
        triggerBO5DeciderHorizontalSpin(remainingMap, rolledSideForA);
      }
    }
  }

  function triggerBO5DeciderHorizontalSpin(mapName, sideForA) {
    state.isActionLocked = true;
    const modal = $('#modal-bo5-wheel');
    const strip = $('#roulette-strip');
    const resultBanner = $('#bo5-wheel-result-banner');
    const resultText = $('#bo5-result-text');

    resultBanner.classList.add('hidden');
    modal.classList.remove('hidden');

    strip.innerHTML = '';
    const tileWidth = 130;
    const targetTileIndex = 28;

    for (let i = 0; i < 40; i++) {
      const isAtk = i === targetTileIndex ? sideForA === 'Attack' : i % 2 === 0;
      const tile = document.createElement('div');
      tile.className = `roulette-tile ${isAtk ? 'tile-atk' : 'tile-def'}`;
      tile.innerHTML = `
        <span style="font-size: 1.3rem;">${isAtk ? '⚔️' : '🛡️'}</span>
        <span>${isAtk ? 'ATTACK' : 'DEFENSE'}</span>
      `;
      strip.appendChild(tile);
    }

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';

    const containerWidth = $('.horizontal-roulette-container').clientWidth || 580;
    const targetOffset = targetTileIndex * tileWidth + tileWidth / 2 - containerWidth / 2;

    const tickInterval = setInterval(() => {
      audioManager.playTick();
    }, 180);

    setTimeout(() => {
      strip.style.transition = 'transform 5000ms cubic-bezier(0.12, 0.8, 0.25, 1)';
      strip.style.transform = `translateX(-${targetOffset}px)`;
    }, 50);

    setTimeout(() => {
      clearInterval(tickInterval);
      audioManager.playCheer();
      state.isActionLocked = false;

      const oppSide = sideForA === 'Attack' ? 'DEFENSE' : 'ATTACK';
      resultText.textContent = `${state.teams.teamA} (TEAM A) GETS ${sideForA.toUpperCase()} — ${state.teams.teamB} (TEAM B) GETS ${oppSide}`;
      resultBanner.classList.remove('hidden');

      setTimeout(() => {
        modal.classList.add('hidden');
        renderMapDraftView();
      }, 3500);
    }, 5100);
  }

  /* ==========================================================================
     8. PHASE 4: AGENT PHASE (RANDOM AGENT & BAN 6 AGENTS)
     ========================================================================== */

  function initPhase4() {
    // Setup filter buttons once
    $$('.agent-filter-btn').forEach((btn) => {
      btn.onclick = (e) => {
        $$('.agent-filter-btn').forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        renderMasterAgentGrid(e.target.dataset.filter);
        audioManager.playTick();
      };
    });

    // Setup back to intermediate map selector button
    const btnBack = $('#btn-back-to-map-selector');
    if (btnBack) {
      btnBack.onclick = () => {
        audioManager.playTick();
        showIntermediateMapSelector();
      };
    }

    // Setup proceed to summary button
    const btnProceedSummary = $('#btn-proceed-to-summary');
    if (btnProceedSummary) {
      btnProceedSummary.onclick = () => {
        const expectedCount = state.format === 'BO1' ? 1 : state.format === 'BO3' ? 3 : 5;
        const completedCount = state.mapDraft.draftedMaps.slice(0, expectedCount).filter((m) => m.isAgentDraftComplete).length;
        if (completedCount < expectedCount) {
          showToast(`Please complete the agent drafts for all ${expectedCount} maps first!`, true);
          return;
        }
        audioManager.playTick();
        switchPhase(5);
      };
    }

    showIntermediateMapSelector();
  }

  function showIntermediateMapSelector() {
    state.activeMapIndex = null;
    state.isActionLocked = false;
    $('#agent-drafting-view').classList.add('hidden');
    $('#agent-map-selector-view').classList.remove('hidden');
    renderIntermediateMapSelector();
  }

  function renderIntermediateMapSelector() {
    const grid = $('#intermediate-maps-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const expectedCount = state.format === 'BO1' ? 1 : state.format === 'BO3' ? 3 : 5;
    const drafted = state.mapDraft.draftedMaps.slice(0, expectedCount);

    let completedCount = 0;

    drafted.forEach((dm, i) => {
      const isCompleted = Boolean(dm.isAgentDraftComplete);
      if (isCompleted) completedCount++;

      const isDecider = i === expectedCount - 1 && !dm.pickedBy;
      const slotLabel = isDecider ? `MAP ${i + 1} (DECIDER)` : `MAP ${i + 1}`;

      const teamAName = state.teams.teamA || 'Team A';
      const teamBName = state.teams.teamB || 'Team B';

      let pickText = '';
      if (dm.pickedBy === 'A') pickText = `${teamAName} (Team A)`;
      else if (dm.pickedBy === 'B') pickText = `${teamBName} (Team B)`;
      else pickText = 'Decider Map';

      let teamAtk = '';
      let teamDef = '';
      if (dm.sidePickedBy === 'B') {
        if (dm.side === 'Attack') {
          teamAtk = teamBName;
          teamDef = teamAName;
        } else {
          teamDef = teamBName;
          teamAtk = teamAName;
        }
      } else {
        if (dm.side === 'Attack') {
          teamAtk = teamAName;
          teamDef = teamBName;
        } else {
          teamDef = teamAName;
          teamAtk = teamBName;
        }
      }

      let sideText = dm.side ? `${teamAtk} Atk - ${teamDef} Def` : 'Side Pending';

      const card = document.createElement('div');
      card.className = `selector-map-card ${isCompleted ? 'completed' : ''}`;

      card.innerHTML = `
        <div class="selector-map-image-box">
          <img src="assets/maps/${dm.map.toLowerCase()}.png" alt="${dm.map}" onerror="this.src='assets/maps/ascent.png'">
          <span class="selector-map-slot-badge">${slotLabel}</span>
          <span class="selector-map-status-badge ${isCompleted ? 'completed' : 'pending'}">
            ${isCompleted ? '✓ DRAFT COMPLETED' : 'PENDING DRAFT'}
          </span>
          <div class="selector-map-name-overlay">
            <h3 class="selector-map-title">${dm.map}</h3>
          </div>
        </div>
        <div class="selector-map-content">
          <div class="selector-map-meta">
            <div class="selector-meta-row">
              <span class="selector-meta-label">PICK:</span>
              <span class="selector-meta-value">${pickText}</span>
            </div>
            <div class="selector-meta-row">
              <span class="selector-meta-label">STARTING SIDE:</span>
              <span class="selector-meta-value">${sideText}</span>
            </div>
          </div>
          <div>
            ${isCompleted
              ? `<span class="selector-mode-pill">RULE: ${dm.agentMode.toUpperCase()}</span>`
              : `<span class="selector-mode-pill" style="color: var(--text-muted);">RULE: NOT ROLLED</span>`
            }
          </div>
          <div class="selector-map-footer ${isCompleted ? 'selector-map-footer-completed' : ''}">
            ${isCompleted
              ? `<button type="button" class="btn-review-map" data-map-index="${i}">👁 REVIEW DRAFT</button>
                 <button type="button" class="btn-copy-map" data-map-index="${i}">📋 COPY RESULT</button>`
              : `<button type="button" class="btn-primary btn-start-map-draft">🎲 SPIN AGENT MODE &rarr;</button>`
            }
          </div>
        </div>
      `;

      if (!isCompleted) {
        card.onclick = () => {
          triggerMapAgentMiniRoulette(i);
        };
      } else {
        card.onclick = () => {
          openMapAgentDraftReview(i);
        };
        const btnReview = card.querySelector('.btn-review-map');
        if (btnReview) {
          btnReview.onclick = (e) => {
            e.stopPropagation();
            openMapAgentDraftReview(i);
          };
        }
        const btnCopy = card.querySelector('.btn-copy-map');
        if (btnCopy) {
          btnCopy.onclick = (e) => {
            e.stopPropagation();
            copySingleMapDiscord(i);
          };
        }
      }

      grid.appendChild(card);
    });

    const progressPill = $('#map-protocol-progress');
    if (progressPill) {
      progressPill.textContent = `MAP DRAFTS: ${completedCount} / ${expectedCount} COMPLETED`;
    }

    const btnProceedSummary = $('#btn-proceed-to-summary');
    const proceedHint = $('#proceed-summary-hint');

    if (btnProceedSummary) {
      if (completedCount === expectedCount) {
        btnProceedSummary.classList.remove('btn-proceed-locked');
        btnProceedSummary.classList.add('btn-proceed-ready');
        btnProceedSummary.textContent = 'PROCEED TO MATCH SUMMARY (READY) →';
        if (proceedHint) {
          proceedHint.textContent = '✓ All map agent protocols complete. Ready to proceed to Summary.';
          proceedHint.style.color = '#00f0ff';
        }
      } else {
        btnProceedSummary.classList.remove('btn-proceed-ready');
        btnProceedSummary.classList.add('btn-proceed-locked');
        btnProceedSummary.textContent = 'PROCEED TO MATCH SUMMARY →';
        if (proceedHint) {
          proceedHint.textContent = `Complete agent protocols for all drafted maps above (${completedCount}/${expectedCount}) to proceed`;
          proceedHint.style.color = 'var(--text-muted)';
        }
      }
    }
  }

  function startPerMapAgentDraft(mapIndex) {
    state.activeMapIndex = mapIndex;
    const mapEntry = state.mapDraft.draftedMaps[mapIndex];
    if (!mapEntry) return;

    const agentState = state.agentDraft;
    agentState.mode = mapEntry.agentMode;

    // FRESH ALL AGENTS POOL EVERY MAP
    agentState.availableAgents = [...allAgents];
    agentState.bannedAgents = [];
    agentState.draftedAgents = { A: [], B: [] };
    agentState.currentStepIndex = 0;
    agentState.isRolling = false;
    agentState.isComplete = false;
    state.isActionLocked = false;

    // Hide completion banner if previously displayed
    const completeBanner = $('#agent-draft-complete-banner');
    if (completeBanner) completeBanner.classList.add('hidden');

    // Toggle subviews
    $('#agent-map-selector-view').classList.add('hidden');
    $('#agent-drafting-view').classList.remove('hidden');

    const expectedCount = state.format === 'BO1' ? 1 : state.format === 'BO3' ? 3 : 5;
    $('#active-map-num-tag').textContent = `MAP ${mapIndex + 1} / ${expectedCount}`;
    $('#active-map-name-pill').textContent = mapEntry.map.toUpperCase();
    const mapThumb = $('#active-map-thumb-img');
    if (mapThumb) {
      mapThumb.src = `assets/maps/${mapEntry.map.toLowerCase()}.png`;
      mapThumb.alt = mapEntry.map;
    }
    $('#agent-phase-mode-pill').textContent = `MODE: ${agentState.mode.toUpperCase()}`;
    $('#board-team-a-name').textContent = state.teams.teamA;
    $('#board-team-b-name').textContent = state.teams.teamB;

    const bannedTitle = $('#board-banned-title');
    if (bannedTitle) bannedTitle.textContent = 'BANNED AGENTS (0/6)';

    if (agentState.mode === 'Random Agent') {
      $('#random-agent-controls').classList.remove('hidden');
      $('#ban6-agent-controls').classList.add('hidden');
      $('#vct-pro-agent-controls')?.classList.add('hidden');
      $('#center-banned-board').classList.add('hidden');
      $('.agent-draft-boards').classList.remove('with-banned');

      $$('.btn-role').forEach((btn) => {
        btn.onclick = () => {
          handleRoleRollClick(btn.dataset.role);
        };
      });
    } else if (agentState.mode === 'Ban 6 Agents') {
      $('#random-agent-controls').classList.add('hidden');
      $('#ban6-agent-controls').classList.remove('hidden');
      $('#vct-pro-agent-controls')?.classList.add('hidden');
      $('#center-banned-board').classList.remove('hidden');
      $('.agent-draft-boards').classList.add('with-banned');
    } else if (agentState.mode === 'VCT Professional') {
      $('#random-agent-controls').classList.add('hidden');
      $('#ban6-agent-controls').classList.add('hidden');
      $('#vct-pro-agent-controls')?.classList.remove('hidden');
      $('#center-banned-board').classList.add('hidden');
      $('.agent-draft-boards').classList.remove('with-banned');
    }

    renderAgentPhaseView();
  }

  function renderAgentPhaseView() {
    const agentState = state.agentDraft;

    // Toggle 3-Column MOBA Draft layout on container for VCT Pro & Random Agent modes
    const draftContainer = $('#agent-draft-container');
    if (draftContainer) {
      if (agentState.mode === 'VCT Professional' || agentState.mode === 'Random Agent') {
        draftContainer.classList.add('layout-moba-draft');
      } else {
        draftContainer.classList.remove('layout-moba-draft');
      }
    }

    renderTeamAgentBoard('A', agentState.draftedAgents.A);
    renderTeamAgentBoard('B', agentState.draftedAgents.B);

    if (agentState.mode === 'Ban 6 Agents') {
      renderBannedAgentBoard(agentState.bannedAgents);

      if (!agentState.isComplete) {
        const isTeamA = agentState.currentStepIndex % 2 === 0;
        const activeTeamName = isTeamA ? state.teams.teamA : state.teams.teamB;
        const turnNumber = Math.min(6, agentState.currentStepIndex + 1);

        $('#ban6-turn-team').textContent = `${activeTeamName.toUpperCase()} (TEAM ${isTeamA ? 'A' : 'B'})`;
        $('#ban6-turn-team').style.color = isTeamA ? '#00f0ff' : '#ff4655';
        $('#ban6-turn-progress').textContent = `BAN ${turnNumber} / 6`;
      }
    } else if (agentState.mode === 'VCT Professional') {
      if (!agentState.isComplete) {
        const step = VCT_PRO_STEPS[agentState.currentStepIndex] || VCT_PRO_STEPS[0];
        const isTeamA = step.team === 'A';
        const activeTeamName = isTeamA ? state.teams.teamA : state.teams.teamB;

        const turnTeamEl = $('#vct-turn-team');
        const turnProgEl = $('#vct-turn-progress');
        if (turnTeamEl) {
          turnTeamEl.textContent = `${activeTeamName.toUpperCase()} (TEAM ${step.team})`;
          turnTeamEl.style.color = isTeamA ? '#00f0ff' : '#ff4655';
        }
        if (turnProgEl) {
          turnProgEl.textContent = `${step.subPick} (TOTAL: ${agentState.currentStepIndex + 1}/10)`;
        }
      }
    } else {
      if (!agentState.isComplete) {
        // Snake draft order: A, B, B, A, A, B, B, A, A, B
        const currentTeamKey = RANDOM_TURN_ORDER[agentState.currentStepIndex] || 'A';
        const isTeamA = currentTeamKey === 'A';
        const activeTeamName = isTeamA ? state.teams.teamA : state.teams.teamB;
        const rollNumber = Math.min(10, agentState.currentStepIndex + 1);

        $('#random-turn-team').textContent = `${activeTeamName.toUpperCase()} (TEAM ${currentTeamKey})`;
        $('#random-turn-team').style.color = isTeamA ? '#00f0ff' : '#ff4655';
        $('#random-turn-progress').textContent = `ROLL ${rollNumber} / 10`;

        updateRoleButtonStates();
      }
    }

    const activeFilter = $('.agent-filter-btn.active')?.dataset.filter || 'ALL';
    renderMasterAgentGrid(activeFilter);
  }

  function updateRoleButtonStates() {
    const available = state.agentDraft.availableAgents;
    const isLocked = state.isActionLocked || state.agentDraft.isRolling;

    const roles = ['ALL', 'Duelist', 'Controller', 'Sentinel', 'Initiator'];
    let emptyRolesMessage = [];

    roles.forEach((role) => {
      const btn = $(`.btn-role[data-role="${role}"]`);
      const countSpan = $(`#count-role-${role.toLowerCase()}`);
      const count = role === 'ALL' ? available.length : available.filter((a) => a.role === role).length;

      countSpan.textContent = `(${count})`;

      if (count === 0) {
        btn.disabled = true;
        if (role !== 'ALL') emptyRolesMessage.push(role);
      } else {
        btn.disabled = isLocked;
      }
    });

    const hint = $('#role-status-hint');
    if (emptyRolesMessage.length > 0) {
      hint.textContent = `Note: No ${emptyRolesMessage.join(', ')} remaining in pool. You can still roll from the remaining roles or ALL.`;
    } else {
      hint.textContent = 'Select a role pool or click ALL to roll a random agent.';
    }
  }

  function renderTeamAgentBoard(teamKey, agents) {
    const list = $(`#board-team-${teamKey.toLowerCase()}-list`);
    list.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const agent = agents[i];
      const card = document.createElement('div');
      card.className = `drafted-agent-card team-${teamKey.toLowerCase()}-slot`;

      if (agent) {
        card.innerHTML = `
          <img src="${agent.image}" alt="${agent.name}" class="drafted-agent-thumb" onerror="this.src='assets/agents/jett.png'">
          <div class="drafted-agent-info">
            <span class="drafted-agent-name">${agent.name}</span>
            <span class="drafted-agent-role">${agent.role}</span>
          </div>
        `;
      } else {
        card.classList.add('empty-slot');
        card.innerHTML = `
          <div class="empty-slot-num">${i + 1}</div>
          <div class="drafted-agent-info">
            <span class="drafted-agent-name" style="color: #50657e;">EMPTY</span>
            <span class="drafted-agent-role">---</span>
          </div>
        `;
      }
      list.appendChild(card);
    }
  }

  function renderBannedAgentBoard(bannedList) {
    const title = $('#board-banned-title');
    if (title) {
      title.textContent = `BANNED AGENTS (${bannedList.length}/6)`;
    }
    const list = $('#banned-agent-list');
    list.innerHTML = '';
    bannedList.forEach((agent) => {
      const card = document.createElement('div');
      card.className = 'drafted-agent-card';
      card.style.borderColor = 'rgba(255, 70, 85, 0.4)';
      card.innerHTML = `
        <img src="${agent.image}" alt="${agent.name}" class="drafted-agent-thumb" onerror="this.src='assets/agents/jett.png'">
        <div class="drafted-agent-info">
          <span class="drafted-agent-name" style="color: #ff4655;">${agent.name}</span>
          <span class="drafted-agent-role">${agent.role}</span>
        </div>
      `;
      list.appendChild(card);
    });
  }

  function renderMasterAgentGrid(roleFilter = 'ALL') {
    const grid = $('#master-agent-grid');
    grid.innerHTML = '';
    const agentState = state.agentDraft;

    allAgents.forEach((agent) => {
      if (roleFilter !== 'ALL' && agent.role !== roleFilter) return;

      const isBanned = agentState.bannedAgents.some((a) => a.name === agent.name);
      const isDraftedA = agentState.draftedAgents.A.some((a) => a.name === agent.name);
      const isDraftedB = agentState.draftedAgents.B.some((a) => a.name === agent.name);
      const isUnavailable = isBanned || isDraftedA || isDraftedB;

      const card = document.createElement('div');
      card.className = 'roster-agent-card';
      card.dataset.agentName = agent.name;

      if (isBanned) {
        card.classList.add('banned');
      } else if (isDraftedA) {
        card.classList.add('picked-a');
      } else if (isDraftedB) {
        card.classList.add('picked-b');
      } else if (isUnavailable) {
        card.classList.add('disabled');
      }

      card.innerHTML = `
        <img src="${agent.image}" alt="${agent.name}" class="agent-card-img" onerror="this.src='assets/agents/jett.png'">
        <div class="agent-card-info">
          <div class="agent-card-name">${agent.name}</div>
          <div class="agent-card-role">${agent.role}</div>
        </div>
      `;

      if (agentState.mode === 'Ban 6 Agents' && !isUnavailable && !state.isActionLocked) {
        card.onclick = () => handleBanAgentClick(agent);
      } else if (agentState.mode === 'VCT Professional' && !isUnavailable && !state.isActionLocked) {
        card.onclick = () => handleVctProPick(agent);
      }

      grid.appendChild(card);
    });
  }

  function handleBanAgentClick(agent) {
    if (state.isActionLocked) return;
    const agentState = state.agentDraft;
    if (agentState.currentStepIndex >= 6) return;

    saveStateSnapshot();
    audioManager.playBan();

    agentState.bannedAgents.push(agent);
    const idx = agentState.availableAgents.findIndex((a) => a.name === agent.name);
    if (idx > -1) agentState.availableAgents.splice(idx, 1);

    const isTeamA = agentState.currentStepIndex % 2 === 0;
    showToast(`${agent.name} BANNED by Team ${isTeamA ? 'A' : 'B'}`);

    agentState.currentStepIndex += 1;

    if (agentState.currentStepIndex >= 6) {
      agentState.isComplete = true;
      completeCurrentMapAgentDraft();
    } else {
      renderAgentPhaseView();
    }
  }

  function triggerSlotFlash(teamKey, slotIndex) {
    const list = $(`#board-team-${teamKey.toLowerCase()}-list`);
    if (!list) return;
    const slotCard = list.children[slotIndex];
    if (slotCard) {
      const flashClass = teamKey === 'A' ? 'flash-lock-cyan' : 'flash-lock-red';
      slotCard.classList.remove('flash-lock-cyan', 'flash-lock-red');
      void slotCard.offsetWidth; // Force reflow to restart animation
      slotCard.classList.add(flashClass);
      setTimeout(() => {
        slotCard.classList.remove(flashClass);
      }, 250);
    }
  }

  function handleVctProPick(agent) {
    if (state.isActionLocked) return;
    const agentState = state.agentDraft;
    if (agentState.currentStepIndex >= 10) return;

    // Check duplicate
    const alreadyA = agentState.draftedAgents.A.some((a) => a.name === agent.name);
    const alreadyB = agentState.draftedAgents.B.some((a) => a.name === agent.name);
    if (alreadyA || alreadyB) {
      showToast(`${agent.name} has already been drafted! Pick another agent.`, true);
      return;
    }

    saveStateSnapshot();
    audioManager.playPick();

    const currentStep = VCT_PRO_STEPS[agentState.currentStepIndex];
    const isTeamA = currentStep.team === 'A';
    const teamKey = currentStep.team;
    const teamName = isTeamA ? state.teams.teamA : state.teams.teamB;

    if (isTeamA) {
      agentState.draftedAgents.A.push(agent);
    } else {
      agentState.draftedAgents.B.push(agent);
    }
    const slotIdx = (isTeamA ? agentState.draftedAgents.A : agentState.draftedAgents.B).length - 1;

    const availIdx = agentState.availableAgents.findIndex((a) => a.name === agent.name);
    if (availIdx > -1) {
      agentState.availableAgents.splice(availIdx, 1);
    }

    showToast(`${agent.name} PICKED by ${teamName} (Team ${currentStep.team})`);

    agentState.currentStepIndex += 1;

    if (agentState.currentStepIndex >= 10) {
      agentState.isComplete = true;
      completeCurrentMapAgentDraft();
    } else {
      renderAgentPhaseView();
    }

    triggerSlotFlash(teamKey, slotIdx);
  }

  function handleRoleRollClick(role) {
    if (state.isActionLocked || state.agentDraft.isRolling) return;
    const agentState = state.agentDraft;

    const pool = role === 'ALL'
      ? agentState.availableAgents
      : agentState.availableAgents.filter((a) => a.role === role);

    if (pool.length === 0) {
      showToast(`No ${role} agents remaining. Please choose another role or ALL.`, true);
      return;
    }

    saveStateSnapshot();
    state.isActionLocked = true;
    agentState.isRolling = true;
    updateRoleButtonStates();

    // Snake Draft turn order
    const currentTeamKey = RANDOM_TURN_ORDER[agentState.currentStepIndex] || 'A';
    const isTeamA = currentTeamKey === 'A';
    const currentTeamName = isTeamA ? state.teams.teamA : state.teams.teamB;
    const isCapyTeam = currentTeamName && currentTeamName.toLowerCase().includes('capy');
    const myDrafted = isTeamA ? agentState.draftedAgents.A : agentState.draftedAgents.B;
    const alreadyHasOmen = myDrafted.some((a) => a.name.toLowerCase() === 'omen');
    const omenInPool = pool.find((a) => a.name.toLowerCase() === 'omen');

    let chosenAgent;
    if (isCapyTeam && !alreadyHasOmen && omenInPool && Math.random() < 0.85) {
      chosenAgent = omenInPool;
    } else {
      const rolledIndex = Math.floor(Math.random() * pool.length);
      chosenAgent = pool[rolledIndex];
    }

    // Filter master grid to match role if specific, or keep ALL
    const filterToApply = role === 'ALL' ? 'ALL' : role;
    $$('.agent-filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filterToApply);
    });
    renderMasterAgentGrid(filterToApply);

    // Collect candidate card elements from the grid
    const candidateCards = pool.map((agent) => ({
      agent,
      el: $(`#master-agent-grid .roster-agent-card[data-agent-name="${agent.name}"]`)
    })).filter((item) => item.el !== null);

    const winningItem = candidateCards.find((item) => item.agent.name === chosenAgent.name);

    let currentHighlightedCard = null;

    function highlightCard(cardEl, isWin = false) {
      if (currentHighlightedCard && currentHighlightedCard !== cardEl) {
        currentHighlightedCard.classList.remove('roster-rolling-highlight');
      }
      if (cardEl) {
        cardEl.classList.add('roster-rolling-highlight');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        currentHighlightedCard = cardEl;
        if (!isWin) {
          audioManager.playTick();
        }
      }
    }

    const startTime = performance.now();
    let lastIndex = -1;

    function step() {
      const elapsed = performance.now() - startTime;

      // Phase 5 (3.2s - 3.8s): Stop at winning agent, cheer, and wait 0.6s before finalize
      if (elapsed >= 3200) {
        if (winningItem && winningItem.el) {
          highlightCard(winningItem.el, true);
        }
        audioManager.playCheer();

        setTimeout(() => {
          if (currentHighlightedCard) {
            currentHighlightedCard.classList.remove('roster-rolling-highlight');
          }
          finalizeRandomAgentRoll(chosenAgent);
        }, 600);
        return;
      }

      // Non-linear easing deceleration
      let delay = 50;
      if (elapsed < 300) {
        // Giai đoạn 1 (0s - 0.3s): Tốc độ cực nhanh ~30ms
        delay = 30;
      } else if (elapsed < 1500) {
        // Giai đoạn 2 (0.3s - 1.5s): Tốc độ nhanh ổn định ~50ms
        delay = 50;
      } else if (elapsed < 2700) {
        // Giai đoạn 3 (1.5s - 2.7s): Bắt đầu giảm tốc rõ rệt (80ms -> 200ms)
        const progress = (elapsed - 1500) / 1200;
        delay = Math.round(80 + progress * 120);
      } else {
        // Giai đoạn 4 (2.7s - 3.2s): Chậm hẳn, dừng giật từng ô kịch tính (350ms -> 500ms)
        const progress = (elapsed - 2700) / 500;
        delay = Math.round(350 + progress * 150);
      }

      if (candidateCards.length > 0) {
        let nextIndex = Math.floor(Math.random() * candidateCards.length);
        if (candidateCards.length > 1 && nextIndex === lastIndex) {
          nextIndex = (nextIndex + 1) % candidateCards.length;
        }
        lastIndex = nextIndex;
        highlightCard(candidateCards[nextIndex].el, false);
      }

      setTimeout(step, delay);
    }

    // Start recursive roll
    step();
  }

  function finalizeRandomAgentRoll(agent) {
    const agentState = state.agentDraft;

    const availIdx = agentState.availableAgents.findIndex((a) => a.name === agent.name);
    if (availIdx > -1) agentState.availableAgents.splice(availIdx, 1);

    const currentTeamKey = RANDOM_TURN_ORDER[agentState.currentStepIndex] || 'A';
    const isTeamA = currentTeamKey === 'A';

    if (isTeamA) {
      agentState.draftedAgents.A.push(agent);
    } else {
      agentState.draftedAgents.B.push(agent);
    }
    const slotIdx = (isTeamA ? agentState.draftedAgents.A : agentState.draftedAgents.B).length - 1;

    showToast(`${agent.name} drafted to Team ${currentTeamKey}`);

    agentState.currentStepIndex += 1;
    agentState.isRolling = false;
    state.isActionLocked = false;

    if (agentState.currentStepIndex >= 10) {
      agentState.isComplete = true;
      completeCurrentMapAgentDraft();
    } else {
      renderAgentPhaseView();
    }

    triggerSlotFlash(currentTeamKey, slotIdx);
  }

  function completeCurrentMapAgentDraft() {
    saveStateSnapshot();
    const mapIndex = state.activeMapIndex;
    const mapEntry = state.mapDraft.draftedMaps[mapIndex];
    const agentState = state.agentDraft;

    if (mapEntry) {
      mapEntry.agentMode = agentState.mode;
      mapEntry.draftedAgents = {
        A: [...agentState.draftedAgents.A],
        B: [...agentState.draftedAgents.B]
      };
      mapEntry.bannedAgents = [...agentState.bannedAgents];
      mapEntry.isAgentDraftComplete = true;
    }

    state.isActionLocked = true;
    audioManager.playCheer();
    showToast(`✓ Agent draft completed for Map ${mapIndex + 1}: ${mapEntry ? mapEntry.map : ''}!`);

    // Ensure final agent picks or 6 bans are fully rendered in the DOM
    renderAgentPhaseView();

    // Hide active drafting controls
    $('#random-agent-controls').classList.add('hidden');
    $('#ban6-agent-controls').classList.add('hidden');
    $('#vct-pro-agent-controls')?.classList.add('hidden');

    // Show completion banner with manual return button (no fast auto-redirect)
    showAgentDraftCompleteBanner(mapIndex, false);
  }

  function openMapAgentDraftReview(mapIndex) {
    state.activeMapIndex = mapIndex;
    const mapEntry = state.mapDraft.draftedMaps[mapIndex];
    if (!mapEntry) return;

    audioManager.playTick();

    const agentState = state.agentDraft;
    agentState.mode = mapEntry.agentMode;
    agentState.draftedAgents = {
      A: mapEntry.draftedAgents ? [...mapEntry.draftedAgents.A] : [],
      B: mapEntry.draftedAgents ? [...mapEntry.draftedAgents.B] : []
    };
    agentState.bannedAgents = mapEntry.bannedAgents ? [...mapEntry.bannedAgents] : [];
    agentState.isRolling = false;
    agentState.isComplete = true;
    state.isActionLocked = true; // Read-only in review mode

    // Toggle subviews
    $('#agent-map-selector-view').classList.add('hidden');
    $('#agent-drafting-view').classList.remove('hidden');

    const expectedCount = state.format === 'BO1' ? 1 : state.format === 'BO3' ? 3 : 5;
    $('#active-map-num-tag').textContent = `MAP ${mapIndex + 1} / ${expectedCount} (REVIEW)`;
    $('#active-map-name-pill').textContent = mapEntry.map.toUpperCase();
    const mapThumb = $('#active-map-thumb-img');
    if (mapThumb) {
      mapThumb.src = `assets/maps/${mapEntry.map.toLowerCase()}.png`;
      mapThumb.alt = mapEntry.map;
    }
    $('#agent-phase-mode-pill').textContent = `MODE: ${agentState.mode.toUpperCase()}`;
    $('#board-team-a-name').textContent = state.teams.teamA;
    $('#board-team-b-name').textContent = state.teams.teamB;

    // In review mode, hide active drafting controls
    $('#random-agent-controls').classList.add('hidden');
    $('#ban6-agent-controls').classList.add('hidden');
    $('#vct-pro-agent-controls')?.classList.add('hidden');

    if (agentState.mode === 'Ban 6 Agents') {
      $('#center-banned-board').classList.remove('hidden');
      $('.agent-draft-boards').classList.add('with-banned');
    } else {
      $('#center-banned-board').classList.add('hidden');
      $('.agent-draft-boards').classList.remove('with-banned');
    }

    const draftContainer = $('#agent-draft-container');
    if (draftContainer) {
      if (agentState.mode === 'VCT Professional' || agentState.mode === 'Random Agent') {
        draftContainer.classList.add('layout-moba-draft');
      } else {
        draftContainer.classList.remove('layout-moba-draft');
      }
    }

    renderTeamAgentBoard('A', agentState.draftedAgents.A);
    renderTeamAgentBoard('B', agentState.draftedAgents.B);
    if (agentState.mode === 'Ban 6 Agents') {
      renderBannedAgentBoard(agentState.bannedAgents);
    }
    renderMasterAgentGrid('ALL');

    showAgentDraftCompleteBanner(mapIndex, true);
  }

  function showAgentDraftCompleteBanner(mapIndex, isReviewMode = false) {
    const banner = $('#agent-draft-complete-banner');
    if (!banner) return;

    const mapEntry = state.mapDraft.draftedMaps[mapIndex];
    const mapName = mapEntry ? mapEntry.map.toUpperCase() : `MAP ${mapIndex + 1}`;
    const modeName = mapEntry ? mapEntry.agentMode : '';

    const tag = $('#complete-banner-tag');
    const title = $('#complete-banner-title');
    const desc = $('#complete-banner-desc');

    if (isReviewMode) {
      if (tag) tag.textContent = '👁 REVIEW MODE — DRAFT PROTOCOL COMPLETED';
      if (title) title.textContent = `${mapName}: AGENT COMPOSITION (${modeName.toUpperCase()})`;
      if (desc) desc.textContent = 'You are reviewing the drafted agent compositions for this map. Click below when ready to return to the Map Selector.';
    } else {
      if (tag) tag.textContent = '✓ DRAFT PROTOCOL COMPLETED';
      if (title) title.textContent = `${mapName}: AGENT PROTOCOL LOCKED`;
      if (desc) desc.textContent = 'Agent draft completed successfully! Review the compositions below or click below to return to the Map Selector.';
    }

    const btnBack = $('#btn-banner-back-selector');
    if (btnBack) {
      btnBack.onclick = () => {
        audioManager.playTick();
        showIntermediateMapSelector();
      };
    }

    const btnCopy = $('#btn-banner-copy-map');
    if (btnCopy) {
      btnCopy.onclick = () => {
        copySingleMapDiscord(mapIndex);
      };
    }

    banner.classList.remove('hidden');
  }

  /* ==========================================================================
     9. PHASE 5: OUTPUT & DISCORD SYNTAX HIGHLIGHTING
     ========================================================================== */

  function initPhase5() {
    $('#summary-team-a-name').textContent = state.teams.teamA;
    $('#summary-team-b-name').textContent = state.teams.teamB;
    $('#summary-format-badge').textContent = state.format;
    $('#summary-mode-badge').textContent = 'PER-MAP PROTOCOL';

    renderSummaryMaps();
    renderSummaryAgents();

    const markdownText = generateDiscordMarkdown();
    $('#discord-raw-output').textContent = markdownText;

    $('#btn-copy-discord').onclick = () => {
      copyToClipboard(markdownText);
    };

    $('#btn-new-match').onclick = () => {
      $('#modal-reset-confirm').classList.remove('hidden');
    };
  }

  function renderSummaryMaps() {
    const container = $('#summary-maps-list');
    container.innerHTML = '';

    const expectedCount = state.format === 'BO1' ? 1 : state.format === 'BO3' ? 3 : 5;
    const drafted = state.mapDraft.draftedMaps.slice(0, expectedCount);

    drafted.forEach((dm, i) => {
      const row = document.createElement('div');
      row.className = 'summary-map-row';

      const teamAName = state.teams.teamA || 'Team A';
      const teamBName = state.teams.teamB || 'Team B';

      let pickLabel = '';
      if (dm.pickedBy === 'A') pickLabel = `${teamAName} pick`;
      else if (dm.pickedBy === 'B') pickLabel = `${teamBName} pick`;
      else pickLabel = 'Decider Map';

      let teamAtk = '';
      let teamDef = '';
      if (dm.sidePickedBy === 'B') {
        if (dm.side === 'Attack') {
          teamAtk = teamBName;
          teamDef = teamAName;
        } else {
          teamDef = teamBName;
          teamAtk = teamAName;
        }
      } else {
        if (dm.side === 'Attack') {
          teamAtk = teamAName;
          teamDef = teamBName;
        } else {
          teamDef = teamAName;
          teamAtk = teamBName;
        }
      }

      let sideLabel = dm.side ? `${teamAtk} Atk - ${teamDef} Def` : 'Pending';

      row.innerHTML = `
        <div class="summary-map-left">
          <span class="summary-map-num">MAP ${i + 1}</span>
          <span class="summary-map-name">${dm.map}</span>
        </div>
        <div class="summary-map-right">
          <span class="summary-pick-label">${pickLabel}</span>
          <span class="summary-side-badge side-badge-atk">${sideLabel}</span>
        </div>
      `;
      container.appendChild(row);
    });
  }

  function renderSummaryAgents() {
    const container = $('#summary-agents-section');
    container.innerHTML = '<h4 class="summary-subtitle">// AGENT PROTOCOLS PER MAP</h4>';

    const expectedCount = state.format === 'BO1' ? 1 : state.format === 'BO3' ? 3 : 5;
    const maps = state.mapDraft.draftedMaps.slice(0, expectedCount);

    maps.forEach((dm, i) => {
      const box = document.createElement('div');
      box.className = 'summary-roster-box';
      box.style.marginBottom = '12px';

      const rule = dm.agentMode || 'Random Agent';
      const isPickMode = (rule === 'Random Agent' || rule === 'VCT Professional');

      let detailsHtml = '';
      if (isPickMode && dm.draftedAgents) {
        const aNames = (dm.draftedAgents.A || []).map((a) => a.name).join(', ') || 'None';
        const bNames = (dm.draftedAgents.B || []).map((a) => a.name).join(', ') || 'None';
        detailsHtml = `
          <div style="margin-top: 6px; font-size: 0.85rem;">
            <div><strong style="color: var(--team-a-color);">${state.teams.teamA} (Team A):</strong> ${aNames}</div>
            <div style="margin-top: 4px;"><strong style="color: var(--team-b-color);">${state.teams.teamB} (Team B):</strong> ${bNames}</div>
          </div>
        `;
      } else if (dm.bannedAgents) {
        const banNames = (dm.bannedAgents || []).map((a) => a.name).join(', ') || 'None';
        detailsHtml = `
          <div style="margin-top: 6px; font-size: 0.85rem; color: #ff4655;">
            <strong>Banned Agents:</strong> ${banNames}
          </div>
        `;
      }

      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
          <span style="font-weight: 900; color: var(--text-main); letter-spacing: 1px;">MAP ${i + 1}: ${dm.map.toUpperCase()}</span>
          <span class="selector-mode-pill">RULE: ${rule.toUpperCase()}</span>
        </div>
        ${detailsHtml}
      `;
      container.appendChild(box);
    });
  }

  /**
   * Generates single-map Discord markdown formatting matching exact specification:
   * 
   * ```yaml
   * [ MAP X: MAPNAME ]
   * Pick: Team A pick
   * Side: Team B Def
   * Rule: Random Agent
   * ```
   * ```diff
   * + [ TEAM A ]
   * +  • Jett
   * +  • Omen
   * 
   * - [ TEAM B ]
   * -  • Raze
   * -  • Viper
   * ```
   */
  function generateSingleMapMarkdown(mapIndex) {
    const dm = state.mapDraft.draftedMaps[mapIndex];
    if (!dm) return '';

    const teamAName = state.teams.teamA || 'Team A';
    const teamBName = state.teams.teamB || 'Team B';

    let pickStr = '';
    if (dm.pickedBy === 'A') pickStr = teamAName;
    else if (dm.pickedBy === 'B') pickStr = teamBName;
    else pickStr = 'Decider';

    let teamAtk = '';
    let teamDef = '';
    if (dm.sidePickedBy === 'B') {
      if (dm.side === 'Attack') {
        teamAtk = teamBName;
        teamDef = teamAName;
      } else {
        teamDef = teamBName;
        teamAtk = teamAName;
      }
    } else {
      if (dm.side === 'Attack') {
        teamAtk = teamAName;
        teamDef = teamBName;
      } else {
        teamDef = teamAName;
        teamAtk = teamBName;
      }
    }

    const sideStr = dm.side ? `${teamAtk} Atk - ${teamDef} Def` : 'Pending';
    const ruleStr = dm.agentMode || 'Random Agent';

    let yamlBlock = `\`\`\`yaml\n[ MAP ${mapIndex + 1}: ${dm.map.toUpperCase()} ]\nPick: ${pickStr}\nSide: ${sideStr}\nRule: ${ruleStr}\n\`\`\``;

    let diffBlock = '';
    if (ruleStr === 'Random Agent' || ruleStr === 'VCT Professional') {
      diffBlock = `\`\`\`diff\n+ [ ${teamAName.toUpperCase()} ]\n`;
      if (dm.draftedAgents && dm.draftedAgents.A) {
        dm.draftedAgents.A.forEach((a) => {
          diffBlock += `+  • ${a.name}\n`;
        });
      }
      diffBlock += `\n- [ ${teamBName.toUpperCase()} ]\n`;
      if (dm.draftedAgents && dm.draftedAgents.B) {
        dm.draftedAgents.B.forEach((a) => {
          diffBlock += `-  • ${a.name}\n`;
        });
      }
      diffBlock += `\`\`\``;
    } else {
      diffBlock = `\`\`\`diff\n- [ BANNED AGENTS ]\n`;
      if (dm.bannedAgents) {
        dm.bannedAgents.forEach((a) => {
          diffBlock += `-  • ${a.name}\n`;
        });
      }
      diffBlock += `\`\`\``;
    }

    return `${yamlBlock}\n${diffBlock}`;
  }

  function copySingleMapDiscord(mapIndex) {
    const text = generateSingleMapMarkdown(mapIndex);
    copyToClipboard(text);
    const dm = state.mapDraft.draftedMaps[mapIndex];
    showToast(`Copied ${dm ? dm.map : 'Map'} markdown to clipboard!`);
  }

  /**
   * CRITICAL OUTPUT FORMAT:
   * 🏆 **MATCH RESULT** 🏆
   * **Match:** [Team A] vs [Team B]
   * **Format:** [BO1/BO3/BO5]
   * (Followed by each drafted map formatted per specification)
   */
  function generateDiscordMarkdown() {
    const teamA = state.teams.teamA;
    const teamB = state.teams.teamB;
    const format = state.format;

    const expectedCount = format === 'BO1' ? 1 : format === 'BO3' ? 3 : 5;
    const maps = state.mapDraft.draftedMaps.slice(0, expectedCount);

    let output = `🏆 **MATCH RESULT** 🏆\n**Match:** ${teamA} vs ${teamB}\n**Format:** ${format}\n\n`;

    maps.forEach((dm, i) => {
      output += generateSingleMapMarkdown(i) + '\n\n';
    });

    return output.trim();
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          showToast('Copied draft to clipboard!');
          audioManager.playTick();
        })
        .catch(() => {
          fallbackCopyText(text);
        });
    } else {
      fallbackCopyText(text);
    }
  }

  function fallbackCopyText(text) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        showToast('Copied match draft to clipboard! (fallback)');
        audioManager.playTick();
      } else {
        showToast('Unable to copy automatically. Please select text manually.', true);
      }
    } catch (err) {
      showToast('Copy failed. Please copy the text directly from the box.', true);
    }
  }

  /* ==========================================================================
     10. INITIALIZATION & RESET HANDLERS
     ========================================================================== */

  function resetMatchState() {
    state.phase = 1;
    state.isActionLocked = false;
    state.teams = { team1: '', team2: '', teamA: '', teamB: '' };
    state.format = 'BO3';
    state.poolMaps = [];

    state.wheels = {
      teamWinner: null,
      teamChoicePending: false,
      isSpinningTeam: false
    };
    state.activeMapIndex = null;

    state.mapDraft = {
      steps: [],
      currentStepIndex: 0,
      bannedMaps: [],
      draftedMaps: [],
      sideChoicePending: null,
      isComplete: false,
      bo5DeciderRolled: false
    };

    state.agentDraft = {
      mode: null,
      availableAgents: [],
      bannedAgents: [],
      draftedAgents: { A: [], B: [] },
      currentStepIndex: 0,
      isRolling: false,
      isComplete: false
    };

    // 1. Reset Phase 1 inputs and cards
    const inT1 = $('#input-team1');
    const inT2 = $('#input-team2');
    if (inT1) inT1.value = '';
    if (inT2) inT2.value = '';
    const errTeam = $('#team-validation-error');
    if (errTeam) errTeam.textContent = '';
    const errMap = $('#map-pool-validation-error');
    if (errMap) errMap.textContent = '';

    $$('.setup-map-card').forEach((card) => card.classList.remove('selected'));
    const counter = $('#map-selection-counter');
    if (counter) {
      counter.textContent = '0 / 7 SELECTED';
      counter.className = 'counter-badge counter-warning';
    }

    $$('input[name="match-format"]').forEach((radio) => {
      radio.checked = (radio.value === 'BO3');
    });
    $$('.format-card').forEach((card) => {
      if (card.dataset.format === 'BO3') card.classList.add('selected');
      else card.classList.remove('selected');
    });

    const btnSubmit = $('#btn-submit-setup');
    if (btnSubmit) btnSubmit.disabled = true;

    // 2. Reset Phase 2 Seeding UI
    const statusTeam = $('#team-wheel-status');
    if (statusTeam) statusTeam.textContent = 'Ready to spin';
    const badgeTeam = $('#team-assignment-badge');
    if (badgeTeam) badgeTeam.classList.add('hidden');
    const btnChangeTeam = $('#btn-change-team-choice');
    if (btnChangeTeam) btnChangeTeam.classList.add('hidden');
    const chk1 = $('#chk-roulette-1');
    if (chk1) {
      chk1.className = 'checklist-pill checklist-pending';
      chk1.textContent = '⏳ ROULETTE 01: TEAM PRIORITY PENDING';
    }
    const btnProceedMaps = $('#btn-proceed-to-maps');
    if (btnProceedMaps) {
      btnProceedMaps.className = 'btn-primary btn-lg btn-proceed-locked';
      btnProceedMaps.textContent = 'PROCEED TO MAP BAN/PICK →';
    }
    const stripTeam = $('#reel-strip-team');
    if (stripTeam) {
      stripTeam.style.transition = 'none';
      stripTeam.style.transform = 'translateX(0px)';
      stripTeam.querySelectorAll('.winner-glow').forEach((el) => el.classList.remove('winner-glow'));
    }

    // 3. Reset Phase 3 Map Draft UI
    const mapGrid = $('#draft-map-grid');
    if (mapGrid) mapGrid.innerHTML = '';
    const draftedList = $('#drafted-maps-list');
    if (draftedList) draftedList.innerHTML = '';
    const btnProceedAgents = $('#btn-proceed-to-agents');
    if (btnProceedAgents) btnProceedAgents.classList.add('hidden');

    // 4. Reset Phase 4 Agent Protocol UI
    const selectorView = $('#agent-map-selector-view');
    if (selectorView) selectorView.classList.remove('hidden');
    const draftingView = $('#agent-drafting-view');
    if (draftingView) draftingView.classList.add('hidden');
    const completeBanner = $('#agent-draft-complete-banner');
    if (completeBanner) completeBanner.classList.add('hidden');
    $('#random-agent-controls')?.classList.add('hidden');
    $('#ban6-agent-controls')?.classList.add('hidden');
    $('#vct-pro-agent-controls')?.classList.add('hidden');
    const interGrid = $('#intermediate-maps-grid');
    if (interGrid) interGrid.innerHTML = '';
    const masterGrid = $('#master-agent-grid');
    if (masterGrid) masterGrid.innerHTML = '';
    const boardA = $('#board-team-a-list');
    if (boardA) boardA.innerHTML = '';
    const boardB = $('#board-team-b-list');
    if (boardB) boardB.innerHTML = '';
    const boardBanned = $('#banned-agent-list');
    if (boardBanned) boardBanned.innerHTML = '';
    const bannedTitle = $('#board-banned-title');
    if (bannedTitle) bannedTitle.textContent = 'BANNED AGENTS (0/6)';
    const btnProceedSummary = $('#btn-proceed-to-summary');
    if (btnProceedSummary) {
      btnProceedSummary.className = 'btn-primary btn-lg btn-proceed-locked';
      btnProceedSummary.textContent = 'PROCEED TO MATCH SUMMARY →';
    }

    // 5. Reset Phase 5 Summary UI
    const summaryMaps = $('#summary-maps-list');
    if (summaryMaps) summaryMaps.innerHTML = '';
    const summaryAgents = $('#summary-agents-section');
    if (summaryAgents) summaryAgents.innerHTML = '';
    const rawDiscord = $('#discord-raw-output');
    if (rawDiscord) rawDiscord.textContent = '';

    // 6. Close all modals safely
    $('#modal-reset-confirm')?.classList.add('hidden');
    $('#modal-team-choice')?.classList.add('hidden');
    $('#modal-side-choice')?.classList.add('hidden');
    $('#modal-bo5-wheel')?.classList.add('hidden');
    $('#modal-map-agent-wheel')?.classList.add('hidden');
    $('#agent-roll-spotlight')?.classList.add('hidden');

    switchPhase(1);
    stateHistory = [];
    updateUndoButtonState();
    showToast('Match draft reset to initial setup.');
    audioManager.playTick();
  }

  function setupGlobalControls() {
    const btnSound = $('#btn-sound-toggle');
    const soundIcon = $('#sound-icon');
    if (btnSound) {
      btnSound.onclick = () => {
        audioManager.soundEnabled = !audioManager.soundEnabled;
        if (soundIcon) soundIcon.textContent = audioManager.soundEnabled ? '🔊' : '🔇';
        showToast(audioManager.soundEnabled ? 'Sound FX Enabled' : 'Sound FX Muted');
        if (audioManager.soundEnabled) audioManager.playTick();
      };
    }

    // Theme toggle (Light / Dark Mode)
    const btnTheme = $('#btn-theme-toggle');
    const themeIcon = $('#theme-icon');

    const savedTheme = sessionStorage.getItem('vct_theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      if (themeIcon) themeIcon.textContent = '🌙';
    } else {
      document.body.classList.remove('light-mode');
      if (themeIcon) themeIcon.textContent = '☀️';
    }

    if (btnTheme) {
      btnTheme.onclick = () => {
        const isLight = document.body.classList.toggle('light-mode');
        if (themeIcon) themeIcon.textContent = isLight ? '🌙' : '☀️';
        sessionStorage.setItem('vct_theme', isLight ? 'light' : 'dark');
        showToast(isLight ? 'Light Mode Enabled' : 'Dark Mode Enabled');
        audioManager.playTick();
      };
    }

    // Global Undo action
    const btnUndo = $('#btn-undo-action');
    if (btnUndo) {
      btnUndo.onclick = () => {
        undoLastAction();
      };
    }

    // Preload map and agent assets
    preloadAllAssets();

    // Header Brand click: Return to home setup with confirmation modal
    const brandHeader = $('#brand-header-link') || $('.header-brand');
    if (brandHeader) {
      brandHeader.onclick = () => {
        audioManager.playTick();
        $('#modal-reset-confirm').classList.remove('hidden');
      };
    }

    const btnResetMatch = $('#btn-reset-match');
    if (btnResetMatch) {
      btnResetMatch.onclick = () => {
        audioManager.playTick();
        $('#modal-reset-confirm').classList.remove('hidden');
      };
    }

    const modalReset = $('#modal-reset-confirm');
    if (modalReset) {
      modalReset.onclick = (e) => {
        if (e.target === modalReset) {
          modalReset.classList.add('hidden');
        }
      };
    }

    const btnConfirmReset = $('#btn-confirm-reset');
    if (btnConfirmReset) {
      btnConfirmReset.onclick = () => {
        $('#modal-reset-confirm').classList.add('hidden');
        resetMatchState();
      };
    }

    const btnCancelReset = $('#btn-cancel-reset');
    if (btnCancelReset) {
      btnCancelReset.onclick = () => {
        $('#modal-reset-confirm').classList.add('hidden');
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupGlobalControls();
      initPhase1();
    });
  } else {
    setupGlobalControls();
    initPhase1();
  }

})();
