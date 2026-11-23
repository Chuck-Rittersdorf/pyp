// pyp-script.js
// PYP — Prepare Your Part
// MuseScore-inspired MusicXML/MXL rehearsal player built on OpenSheetMusicDisplay + Tone.js

(() => {
    'use strict';

    // ===========================================
    // CONFIGURATION & CONSTANTS
    // ===========================================

    const CONFIG = {
        OSMD_DRAWING_PARAMETERS: 'compacttight',
        AUDIO_SAMPLES_BASE_URL: 'https://tonejs.github.io/audio/salamander/',
        DEFAULT_BPM: 100,
        DEFAULT_TEMPO_PERCENT: 100,
        DEFAULT_PART_VOLUME: 80,
        MIN_TEMPO_PERCENT: 25,
        MAX_TEMPO_PERCENT: 200,
        MIN_ZOOM: 0.5,
        MAX_ZOOM: 1.8,
        ZOOM_STEP: 0.1,
        CONTINUOUS_CURSOR_ANCHOR_X: 0.30, // Keep cursor ~30% from left edge for generous lookahead
        PAGE_SCROLL_TOP_ANCHOR: 0.22,
        CURSOR_COLOR: '#0288D1',
        CURSOR_ALPHA: 0.45,
        MAX_CURSOR_STEPS: 60000,
        DEFAULT_PITCH_HZ: 440,
        BAROQUE_PITCH_HZ: 415,
    };

    const PIANO_SAMPLE_FILES = {
        'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
        'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
        'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
        'A7': 'A7.mp3', 'C8': 'C8.mp3',
    };

    // ===========================================
    // DOM REFERENCES
    // ===========================================

    const dom = {
        loadScoreButton: document.getElementById('loadScoreButton'),
        welcomeOpenBtn: document.getElementById('welcomeOpenBtn'),
        loadDemoScoreBtn: document.getElementById('loadDemoScoreBtn'),
        fileInput: document.getElementById('fileInput'),
        scoreDisplayArea: document.getElementById('scoreDisplayArea'),
        scoreTitleChip: document.getElementById('scoreTitleChip'),
        scoreTitleText: document.getElementById('scoreTitleText'),

        // Transport
        startButton: document.getElementById('startButton'),
        prevBarButton: document.getElementById('prevBarButton'),
        playPauseButton: document.getElementById('playPauseButton'),
        stopButton: document.getElementById('stopButton'),
        nextBarButton: document.getElementById('nextBarButton'),
        audioLoadingSpinner: document.getElementById('audioLoadingSpinner'),

        // Loop & Metronome
        loopToggleButton: document.getElementById('loopToggleButton'),
        loopRangeInputs: document.getElementById('loopRangeInputs'),
        loopStartInput: document.getElementById('loopStartInput'),
        loopEndInput: document.getElementById('loopEndInput'),
        loopTrackHighlight: document.getElementById('loopTrackHighlight'),
        metronomeToggleButton: document.getElementById('metronomeToggleButton'),

        // View, Zoom, Pitch
        viewContinuousBtn: document.getElementById('viewContinuousBtn'),
        viewPageBtn: document.getElementById('viewPageBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        zoomResetBtn: document.getElementById('zoomResetBtn'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        a440Button: document.getElementById('a440'),
        a415Button: document.getElementById('a415'),

        // Timeline / Bar Scrubber
        sliderWithTicks: document.getElementById('sliderWithTicks'),
        navigationSlider: document.getElementById('navigationSlider'),
        barTicksContainer: document.getElementById('barTicksContainer'),
        sliderHoverTooltip: document.getElementById('sliderHoverTooltip'),
        currentTimeDisplay: document.getElementById('currentTimeDisplay'),
        totalTimeDisplay: document.getElementById('totalTimeDisplay'),

        // Audio controls
        masterMuteBtn: document.getElementById('masterMuteBtn'),
        masterVolumeSlider: document.getElementById('masterVolume'),
        volumeValueOutput: document.getElementById('volumeValueOutput'),
        tempoDownBtn: document.getElementById('tempoDownBtn'),
        tempoSlider: document.getElementById('tempoSlider'),
        tempoUpBtn: document.getElementById('tempoUpBtn'),
        tempoResetBtn: document.getElementById('tempoResetBtn'),
        tempoValueOutput: document.getElementById('tempoValueOutput'),
        tempoBpmOutput: document.getElementById('tempoBpmOutput'),
        soundSelect: document.getElementById('soundSelect'),
        cursorTypeSelect: document.getElementById('cursorTypeSelect'),

        // Part Mixer
        partControlsContentWrapper: document.getElementById('partControlsContentWrapper'),
        partCountBadge: document.getElementById('partCountBadge'),
        resetMixerBtn: document.getElementById('resetMixerBtn'),
    };

    // Preserve original welcome markup so resetting never loses it
    const welcomeMarkup = dom.scoreDisplayArea ? dom.scoreDisplayArea.innerHTML : '';

    // ===========================================
    // APPLICATION STATE
    // ===========================================

    const state = {
        // Score & OSMD
        osmd: null,
        scoreLoaded: false,
        scoreTitle: '',
        continuousScrollMode: true,
        zoom: 1.0,

        // Musical timeline (in Tone.Transport ticks: 1 whole note = 4 * PPQ)
        ticksPerWhole: 768,
        totalMusicalTicks: 0,
        currentTicks: 0,
        baseScoreBpm: CONFIG.DEFAULT_BPM,
        activeBarBaseBpm: CONFIG.DEFAULT_BPM,
        tempoPercent: CONFIG.DEFAULT_TEMPO_PERCENT,

        // Extracted score structures
        notes: [],         // { ticks, durationWhole, midi, partId, velocity, stepIdx }
        cursorSteps: [],   // { stepIdx, ticks, realValue, measureIndex, x, y, height, svgNotes }
        barData: [],       // { barNumber, measureIndex, startTicks, endTicks, beats, beatValue, bpm }
        metronomeBeats: [], // { ticks, isDownbeat }
        currentStepIndex: 0,

        // Playback state
        isPlaying: false,
        isLoadingAudio: false,
        rafId: null,
        lastFrameTime: 0,
        pageScrollTargetY: null,
        isSliderDragging: false,
        wasPlayingBeforeDrag: false,

        // Loop & Metronome
        loopEnabled: false,
        loopStartBar: 1,
        loopEndBar: 4,
        metronomeEnabled: false,

        // Audio Engine
        audioInitialized: false,
        pianoBuffers: null,
        pianoBuffersFailed: false,
        soundPatch: 'piano',
        concertPitchHz: CONFIG.DEFAULT_PITCH_HZ,
        masterVolume: 80,
        masterMuted: false,
        masterGain: null,
        masterLimiter: null,
        metronomeSynth: null,
        metronomeGain: null,
        playbackPart: null,
        metronomePart: null,

        // Per-part mixer: { [partId]: { id, name, volume, muted, soloed, gainNode, instrument } }
        parts: {},

        // Active SVG highlights so we can clear cleanly on pause/seek/stop
        highlightedElements: new Set(),
    };

    // ===========================================
    // UTILITY HELPERS
    // ===========================================

    function toast(message, type = 'info') {
        if (window.PYP_UX && typeof window.PYP_UX.showToast === 'function') {
            window.PYP_UX.showToast(message, type);
        }
    }

    function getTicksPerWhole() {
        const ppq = (typeof Tone !== 'undefined' && Tone.Transport && Tone.Transport.PPQ) ? Tone.Transport.PPQ : 192;
        return 4 * ppq;
    }

    function realValueToTicks(rv) {
        return Math.max(0, Math.round(rv * state.ticksPerWhole));
    }

    function getEffectiveBpm() {
        return Math.max(10, state.activeBarBaseBpm * (state.tempoPercent / 100));
    }

    function getBarObjAtTicks(ticks) {
        const bars = state.barData;
        if (!bars.length) return null;
        // Binary search for bar containing ticks
        let lo = 0;
        let hi = bars.length - 1;
        let result = bars[0];
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (bars[mid].startTicks <= ticks) {
                result = bars[mid];
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return result;
    }

    function getBarNumberAtTicks(ticks) {
        const bar = getBarObjAtTicks(ticks);
        return bar ? bar.barNumber : 1;
    }

    function getStepIndexAtTicks(ticks) {
        const steps = state.cursorSteps;
        if (!steps.length) return 0;
        let lo = 0;
        let hi = steps.length - 1;
        let ans = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (steps[mid].ticks <= ticks + 2) {
                ans = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return ans;
    }

    function getLoopBoundsTicks() {
        if (!state.barData.length) return { startTicks: 0, endTicks: state.totalMusicalTicks };
        const startIdx = Math.max(0, Math.min(state.barData.length - 1, state.loopStartBar - 1));
        const endIdx = Math.max(startIdx, Math.min(state.barData.length - 1, state.loopEndBar - 1));
        return {
            startTicks: state.barData[startIdx].startTicks,
            endTicks: state.barData[endIdx].endTicks,
        };
    }

    /**
     * Extract accurate concert-pitch MIDI number from an OSMD Note.
     * In OSMD: Pitch.getHalfTone() uses C4 = 48 (octave 1 -> (1+3)*12 = 48),
     * while Note.halfTone returns the sounding MIDI number (C4 = 60) or Pitch + transpose + 12.
     */
    function extractMidiNote(note) {
        if (!note || note.isRest() || !note.Pitch) return null;

        // OSMD Note.halfTone already accounts for instrument transposition & octave shift (C4 = 60 in OSMD >= 1.x)
        // Cross-check against Pitch.halfTone to protect against OSMD version differences.
        const pitchHalfTone = typeof note.Pitch.getHalfTone === 'function'
            ? note.Pitch.getHalfTone()
            : note.Pitch.halfTone;

        let midi;
        if (typeof note.halfTone === 'number' && !Number.isNaN(note.halfTone)) {
            // In OSMD, note.halfTone is typically pitchHalfTone + 12 (+ instrument transpose).
            // Verify: if note.halfTone differs from pitchHalfTone by roughly +12 (modulo transpose), use it directly.
            // If an older build returns C4 = 48 for note.halfTone, note.halfTone === pitchHalfTone when untransposed.
            const transpose = note.ParentVoiceEntry?.ParentVoice?.Parent?.MidiInstrumentId !== undefined
                ? (note.ParentVoiceEntry?.ParentVoice?.Parent?.SubInstruments?.[0]?.Transpose || 0)
                : 0;
            if (Math.abs((note.halfTone - pitchHalfTone) - (12 + transpose)) <= 1) {
                midi = note.halfTone;
            } else if (Math.abs((note.halfTone - pitchHalfTone) - transpose) <= 1) {
                midi = note.halfTone + 12;
            } else {
                midi = note.halfTone;
            }
        } else if (typeof pitchHalfTone === 'number' && !Number.isNaN(pitchHalfTone)) {
            midi = pitchHalfTone + 12;
        } else {
            return null;
        }

        // Clamp to playable MIDI range [21 (A0) .. 108 (C8)]
        return Math.max(21, Math.min(108, Math.round(midi)));
    }

    // ===========================================
    // AUDIO ENGINE (TONE.JS v15)
    // ===========================================

    function ensureMasterAudioChain() {
        if (state.masterGain) return;
        state.masterLimiter = new Tone.Limiter(-1).toDestination();
        state.masterGain = new Tone.Gain(state.masterMuted ? 0 : state.masterVolume / 100).connect(state.masterLimiter);

        state.metronomeGain = new Tone.Gain(0.45).connect(state.masterGain);
        state.metronomeSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.002, decay: 0.045, sustain: 0, release: 0.02 },
        }).connect(state.metronomeGain);
    }

    async function loadPianoBuffersOnce() {
        if (state.pianoBuffers || state.pianoBuffersFailed) return;

        try {
            state.pianoBuffers = await new Promise((resolve, reject) => {
                let settled = false;
                const timeoutId = window.setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        reject(new Error('Piano sample loading timed out'));
                    }
                }, 12000);

                const buffers = new Tone.ToneAudioBuffers({
                    urls: PIANO_SAMPLE_FILES,
                    baseUrl: CONFIG.AUDIO_SAMPLES_BASE_URL,
                    onload: () => {
                        if (!settled) {
                            settled = true;
                            window.clearTimeout(timeoutId);
                            resolve(buffers);
                        }
                    },
                    onerror: (err) => {
                        if (!settled) {
                            settled = true;
                            window.clearTimeout(timeoutId);
                            reject(err);
                        }
                    },
                });
            });
        } catch (err) {
            console.warn('[PYP] Piano sample CDN unavailable; falling back to built-in synth.', err);
            state.pianoBuffersFailed = true;
            toast('Using built-in piano synth (offline fallback)', 'info');
        }
    }

    function createInstrumentForPatch(patch, destinationNode) {
        if (patch === 'piano' && state.pianoBuffers && !state.pianoBuffersFailed) {
            const bufferMap = {};
            for (const noteName of Object.keys(PIANO_SAMPLE_FILES)) {
                if (state.pianoBuffers.has(noteName)) {
                    bufferMap[noteName] = state.pianoBuffers.get(noteName);
                }
            }
            return new Tone.Sampler({
                urls: bufferMap,
                release: 0.7,
                volume: -2,
            }).connect(destinationNode);
        }

        if (patch === 'organ') {
            return new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 16,
                oscillator: { type: 'sine2' },
                envelope: { attack: 0.04, decay: 0.1, sustain: 0.82, release: 0.25 },
                volume: -8,
            }).connect(destinationNode);
        }

        if (patch === 'harpsichord') {
            return new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 16,
                oscillator: { type: 'sawtooth6' },
                envelope: { attack: 0.004, decay: 0.35, sustain: 0.08, release: 0.12 },
                volume: -10,
            }).connect(destinationNode);
        }

        // Fallback soft piano synth (when offline or samples failed)
        return new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 16,
            oscillator: { type: 'triangle4' },
            envelope: { attack: 0.008, decay: 0.45, sustain: 0.25, release: 0.45 },
            volume: -6,
        }).connect(destinationNode);
    }

    function disposePartAudioNodes() {
        for (const part of Object.values(state.parts)) {
            if (part.instrument) {
                try {
                    part.instrument.releaseAll?.();
                    part.instrument.dispose();
                } catch (_) { /* ignore */ }
                part.instrument = null;
            }
            if (part.gainNode) {
                try {
                    part.gainNode.dispose();
                } catch (_) { /* ignore */ }
                part.gainNode = null;
            }
        }
    }

    function buildPartAudioNodes() {
        if (!state.audioInitialized) return;
        ensureMasterAudioChain();

        for (const part of Object.values(state.parts)) {
            if (!part.gainNode) {
                part.gainNode = new Tone.Gain(1).connect(state.masterGain);
            }
            if (part.instrument) {
                try {
                    part.instrument.releaseAll?.();
                    part.instrument.dispose();
                } catch (_) { /* ignore */ }
            }
            part.instrument = createInstrumentForPatch(state.soundPatch, part.gainNode);
        }
        applyAllPartGains(true);
    }

    function releaseAllInstruments() {
        for (const part of Object.values(state.parts)) {
            if (part.instrument && typeof part.instrument.releaseAll === 'function') {
                try {
                    part.instrument.releaseAll(Tone.now());
                } catch (_) {
                    try { part.instrument.releaseAll(); } catch (__) { /* ignore */ }
                }
            }
        }
    }

    function applyMasterVolume() {
        const gainVal = state.masterMuted ? 0 : (state.masterVolume / 100);
        if (state.masterGain) {
            state.masterGain.gain.rampTo(gainVal, 0.02);
        }
        if (dom.volumeValueOutput) {
            dom.volumeValueOutput.textContent = state.masterMuted ? '0%' : `${state.masterVolume}%`;
        }
        if (dom.masterMuteBtn) {
            const onIcon = dom.masterMuteBtn.querySelector('.icon-vol-on');
            const mutedIcon = dom.masterMuteBtn.querySelector('.icon-vol-muted');
            const isSilent = state.masterMuted || state.masterVolume === 0;
            if (onIcon) onIcon.hidden = isSilent;
            if (mutedIcon) mutedIcon.hidden = !isSilent;
            dom.masterMuteBtn.classList.toggle('active', state.masterMuted);
        }
    }

    function applyAllPartGains(immediate = false) {
        const partList = Object.values(state.parts);
        const anySoloed = partList.some((p) => p.soloed);

        for (const part of partList) {
            let effective = part.volume / 100;
            if (part.muted || (anySoloed && !part.soloed)) {
                effective = 0;
            }
            if (part.gainNode) {
                if (immediate) {
                    part.gainNode.gain.value = effective;
                } else {
                    part.gainNode.gain.rampTo(effective, 0.02);
                }
            }
        }
        updateResetMixerVisibility();
    }

    async function ensureAudioReady() {
        if (state.isLoadingAudio) return false;
        state.isLoadingAudio = true;
        updatePlayPauseButtonUI();

        try {
            if (!state.audioInitialized) {
                await Tone.start();
                ensureMasterAudioChain();
                state.audioInitialized = true;
            }

            if (state.soundPatch === 'piano' && !state.pianoBuffers && !state.pianoBuffersFailed) {
                await loadPianoBuffersOnce();
            }

            // Ensure every loaded part has gain + instrument
            const needsBuild = Object.values(state.parts).some((p) => !p.instrument || !p.gainNode);
            if (needsBuild) {
                buildPartAudioNodes();
            }

            applyMasterVolume();
            return true;
        } catch (err) {
            console.error('[PYP] Failed to initialize audio:', err);
            toast('Audio initialization failed. Try clicking Play again.', 'error');
            return false;
        } finally {
            state.isLoadingAudio = false;
            updatePlayPauseButtonUI();
        }
    }

    // ===========================================
    // NOTE HIGHLIGHTING (SAFE & CLEAN)
    // ===========================================

    function clearAllNoteHighlights() {
        for (const el of state.highlightedElements) {
            if (el && el.classList) {
                el.classList.remove('note-highlighted');
            }
        }
        state.highlightedElements.clear();
    }

    function highlightStepNotes(stepIdx) {
        clearAllNoteHighlights();
        const step = state.cursorSteps[stepIdx];
        if (!step || !step.svgNotes) return;
        for (const svgEl of step.svgNotes) {
            if (svgEl && svgEl.classList) {
                svgEl.classList.add('note-highlighted');
                state.highlightedElements.add(svgEl);
            }
        }
    }

    // ===========================================
    // TONE.PART SCHEDULING (TICK-INVARIANT!)
    // ===========================================

    function disposeToneParts() {
        if (state.playbackPart) {
            try {
                state.playbackPart.stop(0);
                state.playbackPart.clear();
                state.playbackPart.dispose();
            } catch (_) { /* ignore */ }
            state.playbackPart = null;
        }
        if (state.metronomePart) {
            try {
                state.metronomePart.stop(0);
                state.metronomePart.clear();
                state.metronomePart.dispose();
            } catch (_) { /* ignore */ }
            state.metronomePart = null;
        }
    }

    function scheduleToneParts() {
        disposeToneParts();

        if (!state.notes.length) return;

        // Schedule every note on exact musical ticks ("${ticks}i") — 100% invariant to live BPM changes!
        const partEvents = state.notes.map((n) => ({
            time: `${n.ticks}i`,
            midi: n.midi,
            durationWhole: n.durationWhole,
            partId: n.partId,
            velocity: n.velocity,
        }));

        state.playbackPart = new Tone.Part((audioTime, ev) => {
            const part = state.parts[ev.partId];
            if (!part || !part.instrument) return;

            // Live concert pitch frequency (supports real-time 440Hz / 415Hz switching!)
            const freqHz = state.concertPitchHz * Math.pow(2, (ev.midi - 69) / 12);

            // Live tempo-scaled duration
            const liveBpm = Math.max(10, Tone.Transport.bpm.value || getEffectiveBpm());
            const secPerWhole = (60 / liveBpm) * 4;
            const durationSec = Math.max(0.05, ev.durationWhole * secPerWhole * 0.94);

            try {
                part.instrument.triggerAttackRelease(freqHz, durationSec, audioTime, ev.velocity);
            } catch (err) {
                console.warn('[PYP] Note trigger error:', err);
            }
        }, partEvents);

        state.playbackPart.start(0);
        state.playbackPart.loop = false;

        // Schedule Metronome clicks on exact musical beat ticks
        if (state.metronomeBeats.length > 0) {
            const metroEvents = state.metronomeBeats.map((b) => ({
                time: `${b.ticks}i`,
                isDownbeat: b.isDownbeat,
            }));

            state.metronomePart = new Tone.Part((audioTime, ev) => {
                if (!state.metronomeEnabled || !state.metronomeSynth) return;
                const clickFreq = ev.isDownbeat ? 1180 : 820;
                const clickVel = ev.isDownbeat ? 0.9 : 0.5;
                try {
                    state.metronomeSynth.triggerAttackRelease(clickFreq, 0.03, audioTime, clickVel);
                } catch (_) { /* ignore */ }
            }, metroEvents);

            state.metronomePart.start(0);
            state.metronomePart.loop = false;
        }
    }

    // ===========================================
    // OSMD SCORE EXTRACTION & CURSOR STEP MAP
    // ===========================================

    function getCurrentCursorType() {
        if (dom.cursorTypeSelect && dom.cursorTypeSelect.value !== '') {
            return parseInt(dom.cursorTypeSelect.value, 10);
        }
        return (typeof opensheetmusicdisplay !== 'undefined' && opensheetmusicdisplay.CursorType)
            ? opensheetmusicdisplay.CursorType.ThinLeft
            : 1;
    }

    function applyCursorStyle() {
        if (!state.osmd || !state.osmd.cursor) return;
        const type = getCurrentCursorType();
        if (state.osmd.cursor.cursorOptions) {
            state.osmd.cursor.cursorOptions.type = type;
            state.osmd.cursor.cursorOptions.color = CONFIG.CURSOR_COLOR;
            state.osmd.cursor.cursorOptions.alpha = CONFIG.CURSOR_ALPHA;
            state.osmd.cursor.cursorOptions.follow = false;
        }
        state.osmd.cursor.update();
        ensureCursorZIndex();
    }

    function ensureCursorZIndex() {
        const el = state.osmd?.cursor?.cursorElement;
        if (el) {
            el.style.zIndex = '5';
            el.style.pointerEvents = 'none';
        }
    }

    function readCursorCoords() {
        const el = state.osmd?.cursor?.cursorElement;
        if (!el) return { x: 0, y: 0, height: 60 };
        const x = parseFloat(el.style.left) || el.offsetLeft || 0;
        const y = parseFloat(el.style.top) || el.offsetTop || 0;
        const height = parseFloat(el.style.height) || el.offsetHeight || 60;
        return { x, y, height };
    }

    /**
     * Walks the rendered OSMD cursor once to build:
     * - 1-to-1 `cursorSteps` array with exact pixel coordinates (x, y, height)
     * - `notes` array (with tied notes properly merged)
     * - `barData` & `metronomeBeats`
     * - `parts` map (preserving existing mixer settings when re-rendering on zoom/view toggle!)
     */
    function extractScoreData(preserveMixerSettings = false) {
        const osmd = state.osmd;
        if (!osmd || !osmd.sheet || !osmd.cursor) return;

        state.ticksPerWhole = getTicksPerWhole();
        const prevParts = preserveMixerSettings ? { ...state.parts } : {};
        if (!preserveMixerSettings) {
            disposePartAudioNodes();
        }

        const nextParts = {};
        const notes = [];
        const cursorSteps = [];

        // Extract title / composer for header chip
        const title = osmd.sheet.TitleString || osmd.sheet.Title?.text || '';
        const composer = osmd.sheet.ComposerString || osmd.sheet.Composer?.text || '';
        state.scoreTitle = title
            ? (composer ? `${title} — ${composer}` : title)
            : (state.scoreTitle || 'Untitled Score');
        updateScoreTitleUI();

        // Extract base tempo
        state.baseScoreBpm = osmd.sheet.DefaultStartTempoInBpm || CONFIG.DEFAULT_BPM;
        state.activeBarBaseBpm = state.baseScoreBpm;

        // Extract Bar / Measure Data + Metronome Beats
        const barData = [];
        const metronomeBeats = [];
        const sourceMeasures = osmd.sheet.SourceMeasures || [];
        let runningBpm = state.baseScoreBpm;

        for (let i = 0; i < sourceMeasures.length; i++) {
            const m = sourceMeasures[i];
            if (m.TempoInBPM && m.TempoInBPM > 0) {
                runningBpm = m.TempoInBPM;
            }
            const startWhole = m.AbsoluteTimestamp?.RealValue ?? 0;
            const durWhole = m.Duration?.RealValue ?? 1;
            const startTicks = realValueToTicks(startWhole);
            const endTicks = realValueToTicks(startWhole + durWhole);

            const ts = m.ActiveTimeSignature;
            const numerator = ts?.Numerator || 4;
            const denominator = ts?.Denominator || 4;

            barData.push({
                barNumber: m.MeasureNumber || (i + 1),
                measureIndex: i,
                startTicks,
                endTicks,
                numerator,
                denominator,
                bpm: runningBpm,
            });

            // Build beat ticks for metronome
            const beatWhole = (numerator === 6 || numerator === 9 || numerator === 12) && denominator === 8
                ? 3 / 8
                : 1 / denominator;
            const beatTicks = Math.max(1, Math.round(beatWhole * state.ticksPerWhole));
            let beatPos = startTicks;
            let beatIdx = 0;
            while (beatPos < endTicks - 2) {
                metronomeBeats.push({
                    ticks: beatPos,
                    isDownbeat: beatIdx === 0,
                });
                beatPos += beatTicks;
                beatIdx++;
                if (beatIdx > 32) break;
            }
        }

        // Pre-register instruments from sheet so part order matches score order top-to-bottom
        if (osmd.sheet.Instruments) {
            osmd.sheet.Instruments.forEach((inst, idx) => {
                const partId = inst.IdString || `part_${inst.Id ?? idx}`;
                const partName = (inst.Name || inst.NameLabel?.text || `Part ${idx + 1}`).trim();
                if (!nextParts[partId]) {
                    const prev = prevParts[partId];
                    nextParts[partId] = {
                        id: partId,
                        name: partName,
                        volume: prev ? prev.volume : CONFIG.DEFAULT_PART_VOLUME,
                        muted: prev ? prev.muted : false,
                        soloed: prev ? prev.soloed : false,
                        gainNode: prev ? prev.gainNode : null,
                        instrument: prev ? prev.instrument : null,
                    };
                }
            });
        }

        // Walk OSMD cursor once to capture exact 1-to-1 step map & notes
        osmd.cursor.show();
        osmd.cursor.reset();
        applyCursorStyle();

        let stepIdx = 0;
        let maxNoteEndTicks = 0;

        while (!osmd.cursor.Iterator.EndReached && stepIdx < CONFIG.MAX_CURSOR_STEPS) {
            const iter = osmd.cursor.Iterator;
            const realValue = iter.currentTimeStamp?.RealValue ?? 0;
            const ticks = realValueToTicks(realValue);
            const measureIndex = iter.CurrentMeasureIndex ?? 0;
            const coords = readCursorCoords();

            // Capture graphical note SVG elements at this cursor step for clean highlighting
            const svgNotes = [];
            try {
                if (typeof osmd.cursor.GNotesUnderCursor === 'function') {
                    const gNotes = osmd.cursor.GNotesUnderCursor();
                    if (gNotes) {
                        for (const gn of gNotes) {
                            const svgEl = typeof gn.getSVGGElement === 'function' ? gn.getSVGGElement() : null;
                            if (svgEl) svgNotes.push(svgEl);
                        }
                    }
                }
            } catch (_) { /* optional highlight */ }

            cursorSteps.push({
                stepIdx,
                ticks,
                realValue,
                measureIndex,
                x: coords.x,
                y: coords.y,
                height: coords.height,
                svgNotes,
            });

            const voiceEntries = iter.CurrentVoiceEntries;
            if (voiceEntries) {
                for (const ve of voiceEntries) {
                    const inst = ve.ParentVoice?.Parent;
                    const partId = inst ? (inst.IdString || `part_${inst.Id ?? 0}`) : 'part_0';
                    const partName = inst ? (inst.Name || inst.NameLabel?.text || `Part ${(inst.Id ?? 0) + 1}`).trim() : 'Part 1';

                    if (!nextParts[partId]) {
                        const prev = prevParts[partId];
                        nextParts[partId] = {
                            id: partId,
                            name: partName,
                            volume: prev ? prev.volume : CONFIG.DEFAULT_PART_VOLUME,
                            muted: prev ? prev.muted : false,
                            soloed: prev ? prev.soloed : false,
                            gainNode: prev ? prev.gainNode : null,
                            instrument: prev ? prev.instrument : null,
                        };
                    }

                    for (const note of ve.Notes) {
                        if (note.isRest() || !note.Pitch || note.isGrace) continue;

                        // Handle tied notes: skip continuation notes and sum duration on the start note
                        let durationWhole = note.Length?.RealValue ?? 0;
                        if (note.NoteTie) {
                            if (note.NoteTie.StartNote !== note) {
                                continue;
                            }
                            if (Array.isArray(note.NoteTie.Notes) && note.NoteTie.Notes.length > 0) {
                                durationWhole = note.NoteTie.Notes.reduce(
                                    (sum, tn) => sum + (tn.Length?.RealValue ?? 0),
                                    0
                                );
                            }
                        }

                        if (durationWhole <= 0.0005) continue;

                        const midi = extractMidiNote(note);
                        if (midi === null) continue;

                        const noteEndTicks = ticks + realValueToTicks(durationWhole);
                        if (noteEndTicks > maxNoteEndTicks) {
                            maxNoteEndTicks = noteEndTicks;
                        }

                        notes.push({
                            ticks,
                            durationWhole,
                            midi,
                            partId,
                            velocity: 0.85,
                            stepIdx,
                        });
                    }
                }
            }

            osmd.cursor.next();
            stepIdx++;
        }

        // Compute total playable duration in ticks
        const lastBarEnd = barData.length ? barData[barData.length - 1].endTicks : 0;
        const lastStepTick = cursorSteps.length ? cursorSteps[cursorSteps.length - 1].ticks : 0;
        state.totalMusicalTicks = Math.max(lastBarEnd, maxNoteEndTicks, lastStepTick, 1);

        state.parts = nextParts;
        state.notes = notes;
        state.cursorSteps = cursorSteps;
        state.barData = barData;
        state.metronomeBeats = metronomeBeats;

        // Reset cursor back to step 0 cleanly
        osmd.cursor.reset();
        ensureCursorZIndex();
        state.currentStepIndex = 0;

        // Initialize loop bar bounds if fresh score
        if (!preserveMixerSettings && barData.length > 0) {
            state.loopStartBar = 1;
            state.loopEndBar = Math.min(barData.length, Math.max(2, Math.min(4, barData.length)));
            syncLoopInputsUI();
        }

        // Rebuild UI elements
        updateTempoReadoutUI();
        setupTimelineUI();
        renderPartMixerUI();

        // Schedule audio parts if audio already started
        if (state.audioInitialized) {
            if (!preserveMixerSettings) {
                buildPartAudioNodes();
            }
            scheduleToneParts();
        }
    }

    /**
     * Rebuilds only the visual cursor coordinates after zoom or view mode re-render,
     * preserving exact musical position and playing state.
     */
    function reRenderScorePreservingState() {
        if (!state.osmd || !state.scoreLoaded) return;

        const wasPlaying = state.isPlaying;
        const savedTicks = state.isPlaying ? Tone.Transport.ticks : state.currentTicks;
        if (wasPlaying) {
            pausePlayback(false);
        }

        state.osmd.setOptions({
            renderSingleHorizontalStaffline: state.continuousScrollMode,
        });
        state.osmd.zoom = state.zoom;
        state.osmd.render();

        extractScoreData(true);

        // Restore exact cursor position & scroll smoothly there
        seekToTicks(savedTicks, { snapScroll: true, keepPlaying: false });

        if (wasPlaying) {
            startPlayback();
        }
    }

    // ===========================================
    // FAST OSMD CURSOR MOVEMENT & 60FPS CAMERA
    // ===========================================

    function moveCursorToStep(targetIndex) {
        const osmd = state.osmd;
        if (!osmd || !osmd.cursor || !state.cursorSteps.length) return;

        targetIndex = Math.max(0, Math.min(state.cursorSteps.length - 1, targetIndex));
        if (targetIndex === state.currentStepIndex) return;

        const cursor = osmd.cursor;
        if (targetIndex > state.currentStepIndex) {
            const delta = targetIndex - state.currentStepIndex;
            if (delta === 1) {
                cursor.next();
            } else {
                // Temporarily suppress intermediate DOM updates for instant O(1)-DOM fast-forward
                // while preserving 100% of OSMD's native cursor.next() traversal logic
                const origUpdate = cursor.update;
                cursor.update = () => {};
                try {
                    for (let i = 0; i < delta && !cursor.Iterator.EndReached; i++) {
                        cursor.next();
                    }
                } finally {
                    cursor.update = origUpdate;
                }
                cursor.update();
            }
        } else {
            // Seeking backwards: reset and fast-forward silently, then update DOM ONCE
            const origUpdate = cursor.update;
            cursor.update = () => {};
            try {
                cursor.reset();
                for (let i = 0; i < targetIndex && !cursor.Iterator.EndReached; i++) {
                    cursor.next();
                }
            } finally {
                cursor.update = origUpdate;
            }
            cursor.update();
        }

        ensureCursorZIndex();
        state.currentStepIndex = targetIndex;

        if (state.isPlaying) {
            highlightStepNotes(targetIndex);
        }
    }

    function updateCameraForTicks(nowTicks, dt, snap = false) {
        const box = dom.scoreDisplayArea;
        const steps = state.cursorSteps;
        if (!box || !steps.length) return;

        const stepIdx = state.currentStepIndex;
        const curr = steps[stepIdx];
        if (!curr) return;

        if (state.continuousScrollMode) {
            // Interpolate smoothly between current step and next step at 60fps!
            let interpX = curr.x;
            const next = steps[stepIdx + 1];
            if (next && next.ticks > curr.ticks && next.x >= curr.x) {
                const frac = Math.max(0, Math.min(1, (nowTicks - curr.ticks) / (next.ticks - curr.ticks)));
                interpX = curr.x + (next.x - curr.x) * frac;
            }

            const viewportW = box.clientWidth;
            const maxScrollX = Math.max(0, box.scrollWidth - viewportW);
            const desiredX = Math.max(0, Math.min(maxScrollX, interpX - viewportW * CONFIG.CONTINUOUS_CURSOR_ANCHOR_X));

            if (snap || Math.abs(desiredX - box.scrollLeft) > viewportW * 0.75) {
                box.scrollLeft = desiredX;
            } else {
                // Frame-rate-independent smooth camera follow
                const alpha = 1 - Math.exp(-14 * Math.min(dt, 0.05));
                box.scrollLeft = box.scrollLeft + (desiredX - box.scrollLeft) * alpha;
            }

            // Ensure vertical scroll keeps the staff visible
            const viewportH = box.clientHeight;
            if (box.scrollHeight > viewportH + 4) {
                const desiredY = Math.max(0, curr.y - viewportH * 0.2);
                if (snap) {
                    box.scrollTop = desiredY;
                } else {
                    const alphaY = 1 - Math.exp(-10 * Math.min(dt, 0.05));
                    box.scrollTop = box.scrollTop + (desiredY - box.scrollTop) * alphaY;
                }
            }
        } else {
            // Page View: scroll vertically when cursor moves out of comfortable middle band
            const viewportH = box.clientHeight;
            const maxScrollY = Math.max(0, box.scrollHeight - viewportH);
            const desiredY = Math.max(0, Math.min(maxScrollY, curr.y - viewportH * CONFIG.PAGE_SCROLL_TOP_ANCHOR));

            if (snap) {
                box.scrollTop = desiredY;
                state.pageScrollTargetY = null;
            } else {
                const topLimit = box.scrollTop + viewportH * 0.12;
                const bottomLimit = box.scrollTop + viewportH * 0.74 - curr.height;
                if (curr.y < topLimit || curr.y > bottomLimit) {
                    state.pageScrollTargetY = desiredY;
                }

                if (state.pageScrollTargetY !== null) {
                    const diff = state.pageScrollTargetY - box.scrollTop;
                    if (Math.abs(diff) < 1) {
                        box.scrollTop = state.pageScrollTargetY;
                        state.pageScrollTargetY = null;
                    } else {
                        const alpha = 1 - Math.exp(-12 * Math.min(dt, 0.05));
                        box.scrollTop += diff * alpha;
                    }
                }
            }
        }
    }

    // ===========================================
    // 60 FPS PLAYBACK LOOP (AUDIO = SOURCE OF TRUTH)
    // ===========================================

    function playbackFrameLoop(timestamp) {
        if (!state.isPlaying) return;

        const dt = state.lastFrameTime ? (timestamp - state.lastFrameTime) / 1000 : 1 / 60;
        state.lastFrameTime = timestamp;

        const rawTicks = Math.max(0, Tone.Transport.ticks);

        // 1. Handle A-B Bar Loop seamlessly
        if (state.loopEnabled && state.barData.length > 0) {
            const { startTicks, endTicks } = getLoopBoundsTicks();
            if (rawTicks >= endTicks - 2) {
                jumpTransportWhilePlaying(startTicks);
                state.rafId = requestAnimationFrame(playbackFrameLoop);
                return;
            }
        }

        // 2. Handle End of Piece cleanly
        if (rawTicks >= state.totalMusicalTicks) {
            state.currentTicks = state.totalMusicalTicks;
            const lastStep = Math.max(0, state.cursorSteps.length - 1);
            moveCursorToStep(lastStep);
            updateTimelineReadout(state.totalMusicalTicks);
            stopAtEndOfPiece();
            return;
        }

        state.currentTicks = rawTicks;

        // 3. Apply mid-score tempo changes if crossing into a bar with a new base BPM
        const currentBar = getBarObjAtTicks(rawTicks);
        if (currentBar && currentBar.bpm !== state.activeBarBaseBpm) {
            state.activeBarBaseBpm = currentBar.bpm;
            Tone.Transport.bpm.value = getEffectiveBpm();
            updateTempoReadoutUI();
        }

        // 4. Advance cursor to exact step matching live audio ticks
        const targetStep = getStepIndexAtTicks(rawTicks);
        moveCursorToStep(targetStep);

        // 5. Smooth 60fps camera scroll
        updateCameraForTicks(rawTicks, dt, false);

        // 6. Update timeline slider & bar display
        if (!state.isSliderDragging) {
            updateTimelineReadout(rawTicks);
        }

        state.rafId = requestAnimationFrame(playbackFrameLoop);
    }

    function stopAtEndOfPiece() {
        state.isPlaying = false;
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
        Tone.Transport.pause();
        clearAllNoteHighlights();
        updatePlayPauseButtonUI();
    }

    function jumpTransportWhilePlaying(targetTicks) {
        releaseAllInstruments();
        clearAllNoteHighlights();

        const bar = getBarObjAtTicks(targetTicks);
        if (bar) {
            state.activeBarBaseBpm = bar.bpm;
            Tone.Transport.bpm.value = getEffectiveBpm();
            updateTempoReadoutUI();
        }

        // Pause -> set exact ticks -> resume cleanly so Tone.Part re-indexes with zero double-triggers
        Tone.Transport.pause();
        Tone.Transport.ticks = targetTicks;
        state.currentTicks = targetTicks;

        const targetStep = getStepIndexAtTicks(targetTicks);
        moveCursorToStep(targetStep);
        updateCameraForTicks(targetTicks, 0, true);
        updateTimelineReadout(targetTicks);

        Tone.Transport.start('+0.02');
    }

    // ===========================================
    // PLAY / PAUSE / STOP / SEEK CONTROLS
    // ===========================================

    async function startPlayback() {
        if (!state.scoreLoaded || !state.notes.length) return;
        if (state.isPlaying) return;

        const ready = await ensureAudioReady();
        if (!ready) return;

        if (!state.playbackPart) {
            scheduleToneParts();
        }

        // Determine starting tick
        let startTicks = state.currentTicks;
        if (state.loopEnabled && state.barData.length > 0) {
            const { startTicks: loopStart, endTicks: loopEnd } = getLoopBoundsTicks();
            if (startTicks < loopStart || startTicks >= loopEnd - 4) {
                startTicks = loopStart;
            }
        } else if (startTicks >= state.totalMusicalTicks - 4) {
            startTicks = 0;
        }

        // Ensure bar base tempo is accurate for startTicks
        const startBar = getBarObjAtTicks(startTicks);
        if (startBar) {
            state.activeBarBaseBpm = startBar.bpm;
        }
        Tone.Transport.bpm.value = getEffectiveBpm();
        updateTempoReadoutUI();

        // Sync cursor & transport to startTicks
        state.currentTicks = startTicks;
        const startStep = getStepIndexAtTicks(startTicks);
        moveCursorToStep(startStep);
        updateCameraForTicks(startTicks, 0, true);
        updateTimelineReadout(startTicks);

        if (Tone.Transport.state === 'started') {
            Tone.Transport.pause();
        }
        Tone.Transport.ticks = startTicks;
        Tone.Transport.start('+0.03');

        state.isPlaying = true;
        state.lastFrameTime = 0;
        highlightStepNotes(state.currentStepIndex);
        updatePlayPauseButtonUI();

        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = requestAnimationFrame(playbackFrameLoop);
    }

    function pausePlayback(updateUI = true) {
        if (!state.isPlaying) return;

        state.currentTicks = Math.max(0, Math.min(state.totalMusicalTicks, Tone.Transport.ticks));
        state.isPlaying = false;

        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }

        if (state.audioInitialized && Tone.Transport.state === 'started') {
            Tone.Transport.pause();
        }

        releaseAllInstruments();
        clearAllNoteHighlights();

        if (updateUI) {
            updatePlayPauseButtonUI();
        }
    }

    function stopPlayback() {
        if (state.isPlaying) {
            pausePlayback(false);
        }
        if (state.audioInitialized) {
            Tone.Transport.stop();
        }
        releaseAllInstruments();
        clearAllNoteHighlights();

        const targetTicks = state.loopEnabled ? getLoopBoundsTicks().startTicks : 0;
        seekToTicks(targetTicks, { snapScroll: true });
        updatePlayPauseButtonUI();
    }

    function rewindToStart() {
        const wasPlaying = state.isPlaying;
        let targetTicks = 0;
        if (state.loopEnabled) {
            const loopStart = getLoopBoundsTicks().startTicks;
            // First press rewinds to loop start; pressing again at loop start goes to bar 1
            if (state.currentTicks > loopStart + 10) {
                targetTicks = loopStart;
            }
        }
        seekToTicks(targetTicks, { snapScroll: true, keepPlaying: wasPlaying });
    }

    function seekToTicks(targetTicks, { snapScroll = true, keepPlaying = state.isPlaying } = {}) {
        if (!state.scoreLoaded || !state.cursorSteps.length) return;

        const clamped = Math.max(0, Math.min(state.totalMusicalTicks, Math.round(targetTicks)));
        const targetStep = getStepIndexAtTicks(clamped);
        const snappedTicks = state.cursorSteps[targetStep]?.ticks ?? clamped;

        if (keepPlaying && state.isPlaying) {
            jumpTransportWhilePlaying(snappedTicks);
            return;
        }

        state.currentTicks = snappedTicks;
        if (state.audioInitialized) {
            Tone.Transport.ticks = snappedTicks;
        }

        const bar = getBarObjAtTicks(snappedTicks);
        if (bar) {
            state.activeBarBaseBpm = bar.bpm;
            if (state.audioInitialized) {
                Tone.Transport.bpm.value = getEffectiveBpm();
            }
            updateTempoReadoutUI();
        }

        moveCursorToStep(targetStep);
        updateCameraForTicks(snappedTicks, 0, snapScroll);
        updateTimelineReadout(snappedTicks);
    }

    function jumpToBar(barIndexZeroBased) {
        if (!state.barData.length) return;
        const clamped = Math.max(0, Math.min(state.barData.length - 1, barIndexZeroBased));
        seekToTicks(state.barData[clamped].startTicks, { snapScroll: true, keepPlaying: state.isPlaying });
    }

    function stepBar(delta) {
        if (!state.barData.length) return;
        const currBarObj = getBarObjAtTicks(state.currentTicks);
        const currIdx = currBarObj ? currBarObj.measureIndex : 0;

        // MuseScore feel: pressing Left mid-bar snaps to start of current bar; near start goes to previous bar
        if (delta < 0 && currBarObj && (state.currentTicks - currBarObj.startTicks) > state.ticksPerWhole * 0.25) {
            jumpToBar(currIdx);
        } else {
            jumpToBar(currIdx + delta);
        }
    }

    // ===========================================
    // UI RENDERERS & UPDATES
    // ===========================================

    function updatePlayPauseButtonUI() {
        const btn = dom.playPauseButton;
        if (!btn) return;

        const playIcon = btn.querySelector('.icon-play');
        const pauseIcon = btn.querySelector('.icon-pause');
        const spinner = dom.audioLoadingSpinner;

        btn.disabled = !state.scoreLoaded || !state.notes.length || state.isLoadingAudio;
        btn.classList.toggle('playing', state.isPlaying);

        if (state.isLoadingAudio) {
            if (playIcon) playIcon.hidden = true;
            if (pauseIcon) pauseIcon.hidden = true;
            if (spinner) spinner.hidden = false;
            btn.title = 'Loading piano samples…';
            btn.setAttribute('aria-label', 'Loading audio');
        } else if (state.isPlaying) {
            if (playIcon) playIcon.hidden = true;
            if (pauseIcon) pauseIcon.hidden = false;
            if (spinner) spinner.hidden = true;
            btn.title = 'Pause (Space)';
            btn.setAttribute('aria-label', 'Pause');
        } else {
            if (playIcon) playIcon.hidden = false;
            if (pauseIcon) pauseIcon.hidden = true;
            if (spinner) spinner.hidden = true;
            btn.title = 'Play (Space)';
            btn.setAttribute('aria-label', 'Play');
        }
    }

    function setScoreControlsEnabled(enabled) {
        const buttons = [
            dom.startButton,
            dom.prevBarButton,
            dom.stopButton,
            dom.nextBarButton,
            dom.loopToggleButton,
            dom.zoomOutBtn,
            dom.zoomResetBtn,
            dom.zoomInBtn,
        ];
        buttons.forEach((b) => { if (b) b.disabled = !enabled; });
        if (dom.navigationSlider) dom.navigationSlider.disabled = !enabled;
        updatePlayPauseButtonUI();
    }

    function updateScoreTitleUI() {
        if (!dom.scoreTitleText || !dom.scoreTitleChip) return;
        if (state.scoreLoaded) {
            dom.scoreTitleText.textContent = state.scoreTitle;
            dom.scoreTitleChip.title = state.scoreTitle;
            dom.scoreTitleChip.classList.add('loaded');
        } else {
            dom.scoreTitleText.textContent = 'No score loaded';
            dom.scoreTitleChip.title = 'No score loaded';
            dom.scoreTitleChip.classList.remove('loaded');
        }
    }

    function updateTempoReadoutUI() {
        const effectiveBpm = Math.round(getEffectiveBpm());
        if (dom.tempoSlider) dom.tempoSlider.value = String(state.tempoPercent);
        if (dom.tempoValueOutput) dom.tempoValueOutput.textContent = `${state.tempoPercent}%`;
        if (dom.tempoBpmOutput) dom.tempoBpmOutput.textContent = `(${effectiveBpm} BPM)`;
    }

    function updateTimelineReadout(ticks) {
        if (dom.navigationSlider) {
            dom.navigationSlider.value = String(Math.round(ticks));
        }
        if (dom.currentTimeDisplay) {
            dom.currentTimeDisplay.textContent = `Bar ${getBarNumberAtTicks(ticks)}`;
        }
    }

    function setupTimelineUI() {
        const totalBars = state.barData.length;
        if (dom.navigationSlider) {
            dom.navigationSlider.min = '0';
            dom.navigationSlider.max = String(state.totalMusicalTicks);
            dom.navigationSlider.value = String(state.currentTicks);
            dom.navigationSlider.disabled = !state.scoreLoaded || state.totalMusicalTicks <= 0;
        }
        if (dom.currentTimeDisplay) {
            dom.currentTimeDisplay.textContent = `Bar ${getBarNumberAtTicks(state.currentTicks)}`;
        }
        if (dom.totalTimeDisplay) {
            dom.totalTimeDisplay.textContent = totalBars > 0 ? `Bar ${state.barData[totalBars - 1].barNumber}` : 'Bar 1';
        }
        renderBarTickMarks();
        updateLoopTrackHighlight();
    }

    function renderBarTickMarks() {
        const container = dom.barTicksContainer;
        if (!container) return;
        container.innerHTML = '';

        const bars = state.barData;
        const totalTicks = state.totalMusicalTicks;
        if (!bars.length || totalTicks <= 0) return;

        // Calculate clean label interval based on available pixel width so labels NEVER overlap!
        const containerWidth = container.clientWidth || 600;
        const maxLabels = Math.max(2, Math.floor(containerWidth / 34));
        const rawInterval = Math.ceil(bars.length / maxLabels);

        // Snap interval to musical-friendly numbers (1, 2, 4, 5, 8, 10, 16, 20, 25, 50)
        const niceSteps = [1, 2, 4, 5, 8, 10, 16, 20, 25, 50, 100];
        const labelInterval = niceSteps.find((s) => s >= rawInterval) || rawInterval;

        const lastBarPosPct = (bars[bars.length - 1].startTicks / totalTicks) * 100;
        const minGapPct = (26 / Math.max(containerWidth, 200)) * 100;
        let lastLabeledPct = -999;

        const frag = document.createDocumentFragment();
        for (let i = 0; i < bars.length; i++) {
            const bar = bars[i];
            const posPct = (bar.startTicks / totalTicks) * 100;
            const isFirst = i === 0;
            const isLast = i === bars.length - 1;
            const isInterval = (bar.barNumber % labelInterval === 0);

            const tick = document.createElement('div');
            tick.className = 'bar-tick';
            tick.style.left = `${posPct.toFixed(3)}%`;

            let shouldLabel = false;
            if (isFirst || isLast) {
                shouldLabel = true;
            } else if (isInterval && (posPct - lastLabeledPct) >= minGapPct && (lastBarPosPct - posPct) >= minGapPct) {
                shouldLabel = true;
            }

            if (shouldLabel) {
                tick.classList.add('labeled');
                const lbl = document.createElement('span');
                lbl.className = 'bar-tick-label';
                lbl.textContent = String(bar.barNumber);
                tick.appendChild(lbl);
                lastLabeledPct = posPct;
            }

            frag.appendChild(tick);
        }

        container.appendChild(frag);
    }

    function syncLoopInputsUI() {
        const totalBars = Math.max(1, state.barData.length);
        if (dom.loopStartInput) {
            dom.loopStartInput.min = '1';
            dom.loopStartInput.max = String(totalBars);
            dom.loopStartInput.value = String(state.loopStartBar);
        }
        if (dom.loopEndInput) {
            dom.loopEndInput.min = '1';
            dom.loopEndInput.max = String(totalBars);
            dom.loopEndInput.value = String(state.loopEndBar);
        }
        if (dom.loopToggleButton) {
            dom.loopToggleButton.classList.toggle('active', state.loopEnabled);
            dom.loopToggleButton.setAttribute('aria-pressed', String(state.loopEnabled));
        }
        if (dom.loopRangeInputs) {
            dom.loopRangeInputs.hidden = !state.loopEnabled;
        }
        updateLoopTrackHighlight();
    }

    function updateLoopTrackHighlight() {
        const el = dom.loopTrackHighlight;
        if (!el) return;
        if (!state.loopEnabled || !state.barData.length || state.totalMusicalTicks <= 0) {
            el.hidden = true;
            return;
        }
        const { startTicks, endTicks } = getLoopBoundsTicks();
        const leftPct = (startTicks / state.totalMusicalTicks) * 100;
        const widthPct = Math.max(0.5, ((endTicks - startTicks) / state.totalMusicalTicks) * 100);
        el.style.left = `calc(7px + (100% - 14px) * ${(leftPct / 100).toFixed(4)})`;
        el.style.width = `calc((100% - 14px) * ${(widthPct / 100).toFixed(4)})`;
        el.hidden = false;
    }

    function updateResetMixerVisibility() {
        if (!dom.resetMixerBtn) return;
        const partList = Object.values(state.parts);
        const isModified = partList.some((p) => p.muted || p.soloed || p.volume !== CONFIG.DEFAULT_PART_VOLUME);
        dom.resetMixerBtn.hidden = !isModified;
    }

    function renderPartMixerUI() {
        const wrapper = dom.partControlsContentWrapper;
        if (!wrapper) return;
        wrapper.innerHTML = '';

        const partList = Object.values(state.parts);
        if (dom.partCountBadge) {
            dom.partCountBadge.textContent = String(partList.length);
            dom.partCountBadge.hidden = partList.length === 0;
        }

        if (!partList.length) {
            wrapper.innerHTML = '<span class="mixer-empty-hint">Load a score to mix individual parts (Volume, Mute &amp; Solo).</span>';
            updateResetMixerVisibility();
            return;
        }

        const frag = document.createDocumentFragment();

        for (const part of partList) {
            const card = document.createElement('div');
            card.className = 'part-control-entry';
            if (part.muted) card.classList.add('is-muted');
            if (part.soloed) card.classList.add('is-soloed');

            const label = document.createElement('span');
            label.className = 'part-label';
            label.textContent = part.name;
            label.title = part.name;
            card.appendChild(label);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'part-volume-slider';
            slider.min = '0';
            slider.max = '100';
            slider.value = String(part.volume);
            slider.title = `${part.name} Volume`;
            slider.setAttribute('aria-label', `${part.name} Volume`);

            const volReadout = document.createElement('span');
            volReadout.className = 'part-vol-value';
            volReadout.textContent = `${part.volume}%`;

            slider.addEventListener('input', () => {
                part.volume = parseInt(slider.value, 10);
                volReadout.textContent = `${part.volume}%`;
                applyAllPartGains(false);
            });

            card.appendChild(slider);
            card.appendChild(volReadout);

            const btnGroup = document.createElement('div');
            btnGroup.className = 'part-btn-group';

            const muteBtn = document.createElement('button');
            muteBtn.className = `part-button mute-btn${part.muted ? ' active' : ''}`;
            muteBtn.textContent = 'M';
            muteBtn.title = `Mute ${part.name}`;
            muteBtn.setAttribute('aria-pressed', String(part.muted));
            muteBtn.addEventListener('click', () => {
                part.muted = !part.muted;
                if (part.muted) part.soloed = false;
                renderPartMixerUI();
                applyAllPartGains(false);
            });

            const soloBtn = document.createElement('button');
            soloBtn.className = `part-button solo-btn${part.soloed ? ' active' : ''}`;
            soloBtn.textContent = 'S';
            soloBtn.title = `Solo ${part.name}`;
            soloBtn.setAttribute('aria-pressed', String(part.soloed));
            soloBtn.addEventListener('click', () => {
                part.soloed = !part.soloed;
                if (part.soloed) part.muted = false;
                renderPartMixerUI();
                applyAllPartGains(false);
            });

            btnGroup.appendChild(muteBtn);
            btnGroup.appendChild(soloBtn);
            card.appendChild(btnGroup);

            frag.appendChild(card);
        }

        wrapper.appendChild(frag);
        updateResetMixerVisibility();
    }

    // ===========================================
    // SCORE LOADING (XML, MUSICXML, MXL, DEMO)
    // ===========================================

    async function loadMusicXMLContent(content, fallbackTitle = 'Loaded Score') {
        // Stop any existing playback cleanly
        if (state.isPlaying) {
            pausePlayback(false);
        }
        if (state.audioInitialized) {
            Tone.Transport.stop();
            Tone.Transport.ticks = 0;
        }
        disposeToneParts();
        disposePartAudioNodes();
        clearAllNoteHighlights();

        state.scoreLoaded = false;
        state.scoreTitle = fallbackTitle;
        state.currentTicks = 0;
        state.currentStepIndex = 0;
        state.notes = [];
        state.cursorSteps = [];
        state.barData = [];
        state.metronomeBeats = [];
        state.loopEnabled = false;
        setScoreControlsEnabled(false);

        dom.scoreDisplayArea.classList.remove('score-loaded');
        dom.scoreDisplayArea.innerHTML = `
            <div class="score-loading-state">
                <div class="loading-spinner-lg"></div>
                <span>Rendering score…</span>
            </div>
        `;
        dom.scoreDisplayArea.scrollLeft = 0;
        dom.scoreDisplayArea.scrollTop = 0;

        try {
            // Create fresh OSMD instance with autoResize: false & followCursor: false
            // (We handle resize and smooth 60fps camera scrolling ourselves with zero conflicts!)
            const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(dom.scoreDisplayArea, {
                autoResize: false,
                backend: 'svg',
                drawTitle: false,
                drawingParameters: CONFIG.OSMD_DRAWING_PARAMETERS,
                followCursor: false,
                renderSingleHorizontalStaffline: state.continuousScrollMode,
                cursorsOptions: [
                    {
                        type: getCurrentCursorType(),
                        color: CONFIG.CURSOR_COLOR,
                        alpha: CONFIG.CURSOR_ALPHA,
                        follow: false,
                    },
                ],
            });

            await osmd.load(content);
            dom.scoreDisplayArea.innerHTML = '';
            osmd.zoom = state.zoom;
            osmd.render();

            state.osmd = osmd;
            state.scoreLoaded = true;
            dom.scoreDisplayArea.classList.add('score-loaded');

            extractScoreData(false);
            setScoreControlsEnabled(true);
            syncLoopInputsUI();

            // Automatically expand part mixer when loading a multi-part score
            if (window.PYP_UX && Object.keys(state.parts).length > 1) {
                window.PYP_UX.setMixerExpanded(true);
            }

            const numParts = Object.keys(state.parts).length;
            const numBars = state.barData.length;
            toast(`Loaded "${state.scoreTitle}" (${numParts} ${numParts === 1 ? 'part' : 'parts'}, ${numBars} bars)`, 'success');
        } catch (err) {
            console.error('[PYP] Error loading score:', err);
            state.osmd = null;
            state.scoreLoaded = false;
            dom.scoreDisplayArea.innerHTML = `
                <div class="score-error-state">
                    <strong>Could not load score</strong>
                    <span>Please verify that this is a valid MusicXML (.xml, .musicxml) or compressed .mxl file.</span>
                </div>
            `;
            setScoreControlsEnabled(false);
            toast('Failed to parse MusicXML / MXL file', 'error');
        }
    }

    function loadScoreFromFile(file) {
        if (!file) return;
        const nameLower = file.name.toLowerCase();
        const isMxl = nameLower.endsWith('.mxl');
        const isXml = nameLower.endsWith('.xml') || nameLower.endsWith('.musicxml');

        if (!isMxl && !isXml) {
            toast('Unsupported file type. Please choose .xml, .musicxml, or .mxl', 'error');
            return;
        }

        const cleanTitle = file.name.replace(/\.(musicxml|xml|mxl)$/i, '');
        const reader = new FileReader();

        reader.onload = (e) => {
            loadMusicXMLContent(e.target.result, cleanTitle);
        };
        reader.onerror = () => {
            toast('Error reading file from disk.', 'error');
        };

        // IMPORTANT: Compressed .mxl files are binary ZIP archives and must NOT be read as UTF-8 text!
        if (isMxl) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    }

    // ===========================================
    // CLICK-ON-SCORE TO SEEK (MUSESCORE STYLE)
    // ===========================================

    function handleScoreClick(event) {
        if (!state.scoreLoaded || !state.cursorSteps.length) return;
        // Ignore clicks on scrollbars
        const box = dom.scoreDisplayArea;
        if (event.offsetX > box.clientWidth || event.offsetY > box.clientHeight) return;

        const rect = box.getBoundingClientRect();
        const clickX = (event.clientX - rect.left) + box.scrollLeft;
        const clickY = (event.clientY - rect.top) + box.scrollTop;

        let bestStep = null;
        let bestDist = Infinity;

        for (const step of state.cursorSteps) {
            if (state.continuousScrollMode) {
                const dist = Math.abs(step.x - clickX);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestStep = step;
                }
            } else {
                // In Page View, strongly prefer steps on the same vertical staff system
                const stepMidY = step.y + step.height * 0.5;
                const dy = Math.abs(stepMidY - clickY);
                const dx = Math.abs(step.x - clickX);
                const withinSystem = clickY >= (step.y - 24) && clickY <= (step.y + step.height + 24);
                const weightedDist = withinSystem ? dx : (dy * 12 + dx);
                if (weightedDist < bestDist) {
                    bestDist = weightedDist;
                    bestStep = step;
                }
            }
        }

        if (bestStep) {
            seekToTicks(bestStep.ticks, { snapScroll: false, keepPlaying: state.isPlaying });
        }
    }

    // ===========================================
    // BUILT-IN 4-PART DEMO CHORALE (SATB, 8 BARS)
    // ===========================================

    function getDemoChoraleMusicXML() {
        const makeNote = (step, octave, duration, type, alter = 0, tieStart = false, tieStop = false) => {
            const alterTag = alter !== 0 ? `<alter>${alter}</alter>` : '';
            const tieTags = `${tieStop ? '<tie type="stop"/>' : ''}${tieStart ? '<tie type="start"/>' : ''}`;
            const tiedNotations = (tieStart || tieStop)
                ? `<notations>${tieStop ? '<tied type="stop"/>' : ''}${tieStart ? '<tied type="start"/>' : ''}</notations>`
                : '';
            return `<note><pitch><step>${step}</step>${alterTag}<octave>${octave}</octave></pitch><duration>${duration}</duration>${tieTags}<voice>1</voice><type>${type}</type>${tiedNotations}</note>`;
        };

        const buildPart = (id, clefSign, clefLine, clefOctaveChange, measuresXml) => {
            const octTag = clefOctaveChange ? `<clef-octave-change>${clefOctaveChange}</clef-octave-change>` : '';
            const attrs = `<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${clefSign}</sign><line>${clefLine}</line>${octTag}</clef></attributes>`;
            const tempoDir = id === 'P1'
                ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>92</per-minute></metronome></direction-type><sound tempo="92"/></direction>`
                : '';
            return `<part id="${id}">${measuresXml.map((m, i) => `<measure number="${i + 1}">${i === 0 ? attrs + tempoDir : ''}${m}</measure>`).join('')}</part>`;
        };

        // 8-bar SATB chorale in C major with idiomatic vocal ranges & a tied 4-3 suspension across bars 5-6
        const soprano = [
            makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter'),
            makeNote('A', 4, 2, 'quarter') + makeNote('B', 4, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('B', 4, 2, 'quarter'),
            makeNote('C', 5, 2, 'quarter') + makeNote('B', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter'),
            makeNote('A', 4, 4, 'half') + makeNote('G', 4, 4, 'half'),
            makeNote('G', 4, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('C', 5, 2, 'quarter', 0, true, false),
            makeNote('C', 5, 2, 'quarter', 0, false, true) + makeNote('B', 4, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('D', 5, 2, 'quarter'),
            makeNote('E', 5, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('D', 5, 2, 'quarter') + makeNote('B', 4, 2, 'quarter'),
            makeNote('C', 5, 8, 'whole'),
        ];

        const alto = [
            makeNote('E', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter') + makeNote('F', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter'),
            makeNote('F', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter'),
            makeNote('E', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('F', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter'),
            makeNote('F', 4, 4, 'half') + makeNote('D', 4, 4, 'half'),
            makeNote('E', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter'),
            makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter') + makeNote('F', 4, 2, 'quarter'),
            makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('F', 4, 2, 'quarter'),
            makeNote('E', 4, 8, 'whole'),
        ];

        const tenor = [
            makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter'),
            makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter'),
            makeNote('A', 3, 2, 'quarter') + makeNote('B', 3, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter'),
            makeNote('D', 4, 4, 'half') + makeNote('B', 3, 4, 'half'),
            makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter'),
            makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('A', 3, 2, 'quarter'),
            makeNote('C', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter') + makeNote('B', 3, 2, 'quarter') + makeNote('D', 4, 2, 'quarter'),
            makeNote('C', 4, 8, 'whole'),
        ];

        const bass = [
            makeNote('C', 3, 2, 'quarter') + makeNote('C', 3, 2, 'quarter') + makeNote('F', 3, 2, 'quarter') + makeNote('E', 3, 2, 'quarter'),
            makeNote('F', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter') + makeNote('C', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter'),
            makeNote('A', 2, 2, 'quarter') + makeNote('E', 3, 2, 'quarter') + makeNote('F', 3, 2, 'quarter') + makeNote('C', 3, 2, 'quarter'),
            makeNote('F', 3, 4, 'half') + makeNote('G', 3, 4, 'half'),
            makeNote('C', 3, 2, 'quarter') + makeNote('E', 3, 2, 'quarter') + makeNote('F', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter'),
            makeNote('G', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter') + makeNote('A', 3, 2, 'quarter') + makeNote('F', 3, 2, 'quarter'),
            makeNote('G', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter') + makeNote('G', 3, 2, 'quarter'),
            makeNote('C', 3, 8, 'whole'),
        ];

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Chorale in C Major (Demo)</work-title></work>
  <identification><creator type="composer">PYP Practice Suite</creator></identification>
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
    <score-part id="P2"><part-name>Alto</part-name></score-part>
    <score-part id="P3"><part-name>Tenor</part-name></score-part>
    <score-part id="P4"><part-name>Bass</part-name></score-part>
  </part-list>
  ${buildPart('P1', 'G', 2, 0, soprano)}
  ${buildPart('P2', 'G', 2, 0, alto)}
  ${buildPart('P3', 'G', 2, -1, tenor)}
  ${buildPart('P4', 'F', 4, 0, bass)}
</score-partwise>`;
    }

    // ===========================================
    // EVENT LISTENERS
    // ===========================================

    function bindEvents() {
        // File Open buttons
        const triggerOpen = () => dom.fileInput && dom.fileInput.click();
        if (dom.loadScoreButton) dom.loadScoreButton.addEventListener('click', triggerOpen);
        if (dom.welcomeOpenBtn) dom.welcomeOpenBtn.addEventListener('click', triggerOpen);

        if (dom.fileInput) {
            dom.fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) loadScoreFromFile(file);
                dom.fileInput.value = '';
            });
        }

        if (dom.loadDemoScoreBtn) {
            dom.loadDemoScoreBtn.addEventListener('click', () => {
                loadMusicXMLContent(getDemoChoraleMusicXML(), 'Chorale in C Major (Demo)');
            });
        }

        // Drag & Drop support
        if (window.PYP_UX && typeof window.PYP_UX.initDropZone === 'function') {
            window.PYP_UX.initDropZone((file) => loadScoreFromFile(file));
        }

        // Transport Controls
        if (dom.playPauseButton) {
            dom.playPauseButton.addEventListener('click', () => {
                if (state.isPlaying) {
                    pausePlayback(true);
                } else {
                    startPlayback();
                }
            });
        }

        if (dom.stopButton) {
            dom.stopButton.addEventListener('click', stopPlayback);
        }

        if (dom.startButton) {
            dom.startButton.addEventListener('click', rewindToStart);
        }

        if (dom.prevBarButton) {
            dom.prevBarButton.addEventListener('click', () => stepBar(-1));
        }

        if (dom.nextBarButton) {
            dom.nextBarButton.addEventListener('click', () => stepBar(1));
        }

        // Loop Controls
        if (dom.loopToggleButton) {
            dom.loopToggleButton.addEventListener('click', () => {
                if (!state.scoreLoaded || !state.barData.length) return;
                state.loopEnabled = !state.loopEnabled;
                if (state.loopEnabled) {
                    // Default loop to current bar + 3 bars if invalid
                    const currBarNum = getBarNumberAtTicks(state.currentTicks);
                    if (state.loopStartBar < 1 || state.loopEndBar > state.barData.length || state.loopEndBar < state.loopStartBar) {
                        state.loopStartBar = currBarNum;
                        state.loopEndBar = Math.min(state.barData.length, currBarNum + 3);
                    }
                    toast(`Loop enabled: Bars ${state.loopStartBar}–${state.loopEndBar}`);
                }
                syncLoopInputsUI();
            });
        }

        const handleLoopRangeChange = () => {
            const maxBar = Math.max(1, state.barData.length);
            let s = parseInt(dom.loopStartInput.value, 10) || 1;
            let e = parseInt(dom.loopEndInput.value, 10) || maxBar;
            s = Math.max(1, Math.min(maxBar, s));
            e = Math.max(s, Math.min(maxBar, e));
            state.loopStartBar = s;
            state.loopEndBar = e;
            syncLoopInputsUI();
        };

        if (dom.loopStartInput) dom.loopStartInput.addEventListener('change', handleLoopRangeChange);
        if (dom.loopEndInput) dom.loopEndInput.addEventListener('change', handleLoopRangeChange);

        // Metronome Toggle
        if (dom.metronomeToggleButton) {
            dom.metronomeToggleButton.addEventListener('click', () => {
                state.metronomeEnabled = !state.metronomeEnabled;
                dom.metronomeToggleButton.classList.toggle('active', state.metronomeEnabled);
                dom.metronomeToggleButton.setAttribute('aria-pressed', String(state.metronomeEnabled));
                toast(state.metronomeEnabled ? 'Metronome ON' : 'Metronome OFF');
            });
        }

        // View Mode Segmented Switch (Continuous vs Page)
        const setViewMode = (continuous) => {
            if (state.continuousScrollMode === continuous) return;
            state.continuousScrollMode = continuous;
            if (dom.viewContinuousBtn) dom.viewContinuousBtn.classList.toggle('active', continuous);
            if (dom.viewPageBtn) dom.viewPageBtn.classList.toggle('active', !continuous);
            if (state.scoreLoaded) {
                reRenderScorePreservingState();
            }
        };

        if (dom.viewContinuousBtn) dom.viewContinuousBtn.addEventListener('click', () => setViewMode(true));
        if (dom.viewPageBtn) dom.viewPageBtn.addEventListener('click', () => setViewMode(false));

        // Zoom Controls
        const setZoom = (newZoom) => {
            const clamped = Math.round(Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, newZoom)) * 100) / 100;
            if (clamped === state.zoom) return;
            state.zoom = clamped;
            if (dom.zoomResetBtn) dom.zoomResetBtn.textContent = `${Math.round(state.zoom * 100)}%`;
            if (state.scoreLoaded) {
                reRenderScorePreservingState();
            }
        };

        if (dom.zoomOutBtn) dom.zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - CONFIG.ZOOM_STEP));
        if (dom.zoomInBtn) dom.zoomInBtn.addEventListener('click', () => setZoom(state.zoom + CONFIG.ZOOM_STEP));
        if (dom.zoomResetBtn) dom.zoomResetBtn.addEventListener('click', () => setZoom(1.0));

        // Concert Pitch Switch (A=440Hz / A=415Hz — Live Acoustic Pitch!)
        const setConcertPitch = (hz) => {
            state.concertPitchHz = hz;
            if (dom.a440Button) dom.a440Button.classList.toggle('active', hz === CONFIG.DEFAULT_PITCH_HZ);
            if (dom.a415Button) dom.a415Button.classList.toggle('active', hz === CONFIG.BAROQUE_PITCH_HZ);
            toast(`Concert pitch set to A = ${hz} Hz`);
        };

        if (dom.a440Button) dom.a440Button.addEventListener('click', () => setConcertPitch(CONFIG.DEFAULT_PITCH_HZ));
        if (dom.a415Button) dom.a415Button.addEventListener('click', () => setConcertPitch(CONFIG.BAROQUE_PITCH_HZ));

        // Unified Navigation Slider (Single clean listener set — ZERO duplicates, ZERO freezing!)
        if (dom.navigationSlider) {
            let dragJustEnded = false;

            const beginDrag = () => {
                if (!state.scoreLoaded) return;
                dragJustEnded = false;
                state.isSliderDragging = true;
                state.wasPlayingBeforeDrag = state.isPlaying;
                if (state.isPlaying) {
                    pausePlayback(false);
                }
            };

            const endDrag = () => {
                if (!state.isSliderDragging) return;
                state.isSliderDragging = false;
                dragJustEnded = true;
                window.setTimeout(() => { dragJustEnded = false; }, 0);

                const targetTicks = parseFloat(dom.navigationSlider.value) || 0;
                const shouldResume = state.wasPlayingBeforeDrag;
                state.wasPlayingBeforeDrag = false;

                seekToTicks(targetTicks, { snapScroll: true, keepPlaying: false });
                if (shouldResume) {
                    startPlayback();
                }
            };

            dom.navigationSlider.addEventListener('pointerdown', beginDrag);

            // Live lightweight bar preview + instant cursor preview while dragging
            dom.navigationSlider.addEventListener('input', () => {
                if (!state.scoreLoaded) return;
                const targetTicks = parseFloat(dom.navigationSlider.value) || 0;
                if (dom.currentTimeDisplay) {
                    dom.currentTimeDisplay.textContent = `Bar ${getBarNumberAtTicks(targetTicks)}`;
                }
                // Move cursor cleanly on drag without audio glitches
                const targetStep = getStepIndexAtTicks(targetTicks);
                moveCursorToStep(targetStep);
                updateCameraForTicks(targetTicks, 0, true);
            });

            dom.navigationSlider.addEventListener('change', () => {
                if (state.isSliderDragging) {
                    endDrag();
                } else if (!dragJustEnded && state.scoreLoaded) {
                    // Handles keyboard changes on focused range slider
                    const targetTicks = parseFloat(dom.navigationSlider.value) || 0;
                    seekToTicks(targetTicks, { snapScroll: true, keepPlaying: state.isPlaying });
                }
            });

            window.addEventListener('pointerup', () => {
                if (state.isSliderDragging) endDrag();
            });

            // Hover Bar Preview Tooltip
            if (dom.sliderWithTicks && dom.sliderHoverTooltip) {
                dom.navigationSlider.addEventListener('mousemove', (e) => {
                    if (!state.scoreLoaded || !state.barData.length || state.totalMusicalTicks <= 0) return;
                    const rect = dom.navigationSlider.getBoundingClientRect();
                    const usableW = Math.max(1, rect.width - 14);
                    const relX = Math.max(0, Math.min(usableW, e.clientX - rect.left - 7));
                    const frac = relX / usableW;
                    const hoverTicks = frac * state.totalMusicalTicks;
                    dom.sliderHoverTooltip.textContent = `Bar ${getBarNumberAtTicks(hoverTicks)}`;
                    dom.sliderHoverTooltip.style.left = `${7 + relX}px`;
                    dom.sliderHoverTooltip.hidden = false;
                });

                dom.navigationSlider.addEventListener('mouseleave', () => {
                    dom.sliderHoverTooltip.hidden = true;
                });
            }
        }

        // Click on Score to Jump Cursor
        if (dom.scoreDisplayArea) {
            let pointerDownPos = null;
            dom.scoreDisplayArea.addEventListener('pointerdown', (e) => {
                pointerDownPos = { x: e.clientX, y: e.clientY };
            });
            dom.scoreDisplayArea.addEventListener('click', (e) => {
                if (!pointerDownPos) return;
                const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
                pointerDownPos = null;
                if (moved > 6) return; // Ignore drags / text selection
                handleScoreClick(e);
            });
        }

        // Master Volume & Mute
        if (dom.masterVolumeSlider) {
            dom.masterVolumeSlider.addEventListener('input', () => {
                state.masterVolume = parseInt(dom.masterVolumeSlider.value, 10);
                if (state.masterVolume > 0 && state.masterMuted) {
                    state.masterMuted = false;
                }
                applyMasterVolume();
            });
        }

        if (dom.masterMuteBtn) {
            dom.masterMuteBtn.addEventListener('click', () => {
                state.masterMuted = !state.masterMuted;
                applyMasterVolume();
            });
        }

        // Live Tempo Control (NO pause, NO restart — instant seamless speed scaling!)
        const applyTempoPercent = (pct) => {
            state.tempoPercent = Math.max(CONFIG.MIN_TEMPO_PERCENT, Math.min(CONFIG.MAX_TEMPO_PERCENT, Math.round(pct)));
            if (state.audioInitialized) {
                Tone.Transport.bpm.value = getEffectiveBpm();
            }
            updateTempoReadoutUI();
        };

        if (dom.tempoSlider) {
            dom.tempoSlider.addEventListener('input', () => {
                applyTempoPercent(parseInt(dom.tempoSlider.value, 10));
            });
        }
        if (dom.tempoDownBtn) dom.tempoDownBtn.addEventListener('click', () => applyTempoPercent(state.tempoPercent - 5));
        if (dom.tempoUpBtn) dom.tempoUpBtn.addEventListener('click', () => applyTempoPercent(state.tempoPercent + 5));
        if (dom.tempoResetBtn) dom.tempoResetBtn.addEventListener('click', () => applyTempoPercent(100));

        // Sound Patch Selector
        if (dom.soundSelect) {
            dom.soundSelect.addEventListener('change', async () => {
                state.soundPatch = dom.soundSelect.value;
                if (state.audioInitialized) {
                    if (state.soundPatch === 'piano' && !state.pianoBuffers && !state.pianoBuffersFailed) {
                        await loadPianoBuffersOnce();
                    }
                    buildPartAudioNodes();
                }
                const label = dom.soundSelect.options[dom.soundSelect.selectedIndex]?.textContent || state.soundPatch;
                toast(`Sound: ${label}`);
            });
        }

        // Cursor Type Selector
        if (dom.cursorTypeSelect) {
            if (typeof opensheetmusicdisplay !== 'undefined' && opensheetmusicdisplay.CursorType) {
                const friendlyNames = {
                    Standard: 'Highlight Bar',
                    ThinLeft: 'Thin Line (MuseScore)',
                    ShortThinTopLeft: 'Short Top Line',
                    CurrentArea: 'Current Measure',
                    CurrentAreaLeft: 'Measure Left',
                };
                for (const key in opensheetmusicdisplay.CursorType) {
                    if (Number.isNaN(parseInt(key, 10))) {
                        const opt = document.createElement('option');
                        opt.value = String(opensheetmusicdisplay.CursorType[key]);
                        opt.textContent = friendlyNames[key] || key;
                        dom.cursorTypeSelect.appendChild(opt);
                    }
                }
                dom.cursorTypeSelect.value = String(opensheetmusicdisplay.CursorType.ThinLeft ?? 1);
            }
            dom.cursorTypeSelect.addEventListener('change', applyCursorStyle);
        }

        // Reset Mixer button
        if (dom.resetMixerBtn) {
            dom.resetMixerBtn.addEventListener('click', () => {
                for (const part of Object.values(state.parts)) {
                    part.volume = CONFIG.DEFAULT_PART_VOLUME;
                    part.muted = false;
                    part.soloed = false;
                }
                renderPartMixerUI();
                applyAllPartGains(false);
                toast('Part mixer reset');
            });
        }

        // Responsive Window Resize (Debounced: re-align bar ticks, and re-render Page View only on width change)
        let resizeTimer = null;
        let lastBoxWidth = dom.scoreDisplayArea ? dom.scoreDisplayArea.clientWidth : 0;
        window.addEventListener('resize', () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                renderBarTickMarks();
                updateLoopTrackHighlight();
                if (state.scoreLoaded && !state.continuousScrollMode && dom.scoreDisplayArea) {
                    const newW = dom.scoreDisplayArea.clientWidth;
                    if (Math.abs(newW - lastBoxWidth) > 24) {
                        lastBoxWidth = newW;
                        reRenderScorePreservingState();
                    }
                }
            }, 220);
        });

        // MuseScore-Style Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            const tag = document.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                triggerOpen();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (state.scoreLoaded) {
                        if (state.isPlaying) pausePlayback(true);
                        else startPlayback();
                    }
                    break;
                case 'Home':
                    if (state.scoreLoaded) {
                        e.preventDefault();
                        rewindToStart();
                    }
                    break;
                case 'ArrowLeft':
                    if (state.scoreLoaded) {
                        e.preventDefault();
                        stepBar(-1);
                    }
                    break;
                case 'ArrowRight':
                    if (state.scoreLoaded) {
                        e.preventDefault();
                        stepBar(1);
                    }
                    break;
                case 'l':
                case 'L':
                    if (state.scoreLoaded && dom.loopToggleButton) {
                        e.preventDefault();
                        dom.loopToggleButton.click();
                    }
                    break;
                case 'm':
                case 'M':
                    if (dom.metronomeToggleButton) {
                        e.preventDefault();
                        dom.metronomeToggleButton.click();
                    }
                    break;
                case '+':
                case '=':
                    if (state.scoreLoaded) {
                        e.preventDefault();
                        setZoom(state.zoom + CONFIG.ZOOM_STEP);
                    }
                    break;
                case '-':
                    if (state.scoreLoaded) {
                        e.preventDefault();
                        setZoom(state.zoom - CONFIG.ZOOM_STEP);
                    }
                    break;
                case '0':
                    if (state.scoreLoaded) {
                        e.preventDefault();
                        setZoom(1.0);
                    }
                    break;
                default:
                    break;
            }
        });
    }

    // ===========================================
    // INITIALIZATION
    // ===========================================

    document.addEventListener('DOMContentLoaded', () => {
        applyMasterVolume();
        updateTempoReadoutUI();
        setScoreControlsEnabled(false);
        bindEvents();

        // Expose lightweight debug handle for diagnostics
        window.__PYP_STATE__ = state;
    });
})();
