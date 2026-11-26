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
        SALAMANDER_BASE_URL: 'https://tonejs.github.io/audio/salamander/',
        DEFAULT_BPM: 100,
        DEFAULT_TEMPO_PERCENT: 100,
        DEFAULT_PART_VOLUME: 80,
        HIGHLIGHT_MAIN_VOLUME: 100,
        HIGHLIGHT_OTHER_VOLUME: 70,
        MIN_TEMPO_PERCENT: 25,
        MAX_TEMPO_PERCENT: 200,
        BASE_OSMD_ZOOM: 0.70, // 100% UI zoom corresponds to what was previously 70% OSMD zoom
        MIN_ZOOM: 0.5,
        MAX_ZOOM: 2.0,
        ZOOM_STEP: 0.1,
        CONTINUOUS_CURSOR_ANCHOR_X: 0.50, // Keep cursor centered in middle (50%) for MuseScore 4 smooth right-to-left panning
        PAGE_SCROLL_TOP_ANCHOR: 0.22,
        CURSOR_COLOR: '#0288D1',
        CURSOR_ALPHA: 0.45,
        MAX_CURSOR_STEPS: 60000,
        DEFAULT_PITCH_HZ: 440,
        BAROQUE_PITCH_HZ: 415,
    };

    // Helper to build full URL map for an instrument folder
    function buildUrlMap(baseUrl, noteToFile) {
        const result = {};
        for (const [note, file] of Object.entries(noteToFile)) {
            result[note] = file.startsWith('http') ? file : `${baseUrl}${file}`;
        }
        return result;
    }

    const SALAMANDER_PIANO_URLS = buildUrlMap(CONFIG.SALAMANDER_BASE_URL, {
        'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
        'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
        'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
        'A7': 'A7.mp3', 'C8': 'C8.mp3',
    });

    /**
     * Instrument Catalog
     * Strictly contains the 2 core rehearsal instruments:
     * 1. Grand Piano (Salamander multi-sample acoustic grand)
     * 2. Smooth Wave (Warm, pitch-accurate harmonic wave tailored for vocal rehearsal)
     */
    const INSTRUMENT_CATALOG = {
        'piano': {
            id: 'piano',
            label: 'Grand Piano',
            urls: SALAMANDER_PIANO_URLS,
            release: 0.85,
            attack: 0.005,
            volumeDb: -1,
            durationFactor: 0.95,
            synthFamily: 'piano',
        },
        'wave': {
            id: 'wave',
            label: 'Smooth Wave',
            urls: null, // Pure, warm harmonic wave with clear pitch center & clean headroom on mobile speakers
            release: 0.16,
            attack: 0.024,
            volumeDb: -12,
            durationFactor: 0.98,
            filter: { type: 'lowpass', frequency: 1900, Q: 0.5 },
            synthFamily: 'wave',
        },
    };

    // ===========================================
    // DOM REFERENCES
    // ===========================================

    const dom = {
        brandHomeBtn: document.getElementById('brandHomeBtn'),
        loadScoreButton: document.getElementById('loadScoreButton'),
        scoresFolderSelect: document.getElementById('scoresFolderSelect'),
        welcomeOpenBtn: document.getElementById('welcomeOpenBtn'),
        loadDemoScoreBtn: document.getElementById('loadDemoScoreBtn'),
        loadDemoEnsembleBtn: document.getElementById('loadDemoEnsembleBtn'),
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

        // View, Zoom, Pitch, Fullscreen
        viewContinuousBtn: document.getElementById('viewContinuousBtn'),
        viewPageBtn: document.getElementById('viewPageBtn'),
        zoomOutBtn: document.getElementById('zoomOutBtn'),
        zoomResetBtn: document.getElementById('zoomResetBtn'),
        zoomInBtn: document.getElementById('zoomInBtn'),
        a440Button: document.getElementById('a440'),
        a415Button: document.getElementById('a415'),
        viewportFullscreenBtn: document.getElementById('viewportFullscreenBtn'),
        appFullscreenBtn: document.getElementById('appFullscreenBtn'),
        viewportFloatingHud: document.getElementById('viewportFloatingHud'),
        viewportFloatingPlayBtn: document.getElementById('viewportFloatingPlayBtn'),
        viewportFloatingFsBtn: document.getElementById('viewportFloatingFsBtn'),
        viewportFloatingFsLabel: document.getElementById('viewportFloatingFsLabel'),

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

    // Preserve initial welcome screen markup so clicking the PYP logo can reset cleanly to Home
    const initialWelcomeMarkup = dom.scoreDisplayArea ? dom.scoreDisplayArea.innerHTML : '';

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
        rawXmlPartMeta: {}, // { [partId]: { partName, partAbbrev, instrumentName, instrumentSound, midiProgram } }

        // Musical timeline (in Tone.Transport ticks: 1 whole note = 4 * PPQ)
        ticksPerWhole: 768,
        totalMusicalTicks: 0,
        currentTicks: 0,
        smoothTicks: 0,
        playbackStartTicks: 0,
        scoreEndX: 0,
        continuousPadX: 0,
        cameraScrollX: 0,
        isCameraGliding: false,
        highlightedStaffBands: [],
        centeredStaffBands: [],
        audioReadyPromise: null,
        auditionRestoreTimer: null,
        baseScoreBpm: CONFIG.DEFAULT_BPM,
        activeBarBaseBpm: CONFIG.DEFAULT_BPM,
        tempoPercent: CONFIG.DEFAULT_TEMPO_PERCENT,

        // Extracted score structures
        notes: [],          // { ticks, durationWhole, midi, partId, velocity, stepIdx }
        allScoreNotes: [],  // Full note list preserved even when individual staves are visually hidden
        cursorSteps: [],    // { stepIdx, ticks, realValue, measureIndex, x, y, height, svgNotes }
        barData: [],        // { barNumber, measureIndex, startTicks, endTicks, numerator, denominator, bpm }
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

        // Audio Engine & Multi-Instrument Sample Cache
        audioInitialized: false,
        instrumentBuffers: {},      // { [patchId]: Tone.ToneAudioBuffers }
        instrumentLoadPromises: {}, // { [patchId]: Promise<Tone.ToneAudioBuffers | null> }
        instrumentFailed: {},       // { [patchId]: boolean }
        soundPreset: 'piano',       // 'piano', 'harpsichord', 'wave', or 'custom'
        concertPitchHz: CONFIG.DEFAULT_PITCH_HZ,
        masterVolume: 80,
        masterMuted: false,
        masterGain: null,
        masterLimiter: null,
        metronomeSynth: null,
        metronomeGain: null,
        playbackPart: null,
        metronomePart: null,

        // Per-part mixer:
        // { [partId]: { id, name, volume, muted, soloed, patchId, detectedPatchId, isVocal, roleTag, isLoadingPatch, gainNode, filterNode, instrument } }
        parts: {},

        // Active SVG highlights so we can clear cleanly on pause/seek/stop
        highlightedElements: new Set(),
    };

    // ===========================================
    // SCORE INSTRUMENT & VOCAL AUTO-DETECTION
    // ===========================================

    /**
     * Parses <score-part> metadata from uncompressed MusicXML string if available.
     */
    function parseRawXmlPartMetadata(xmlContent) {
        const metaMap = {};
        if (typeof xmlContent !== 'string' || !xmlContent.trim().startsWith('<')) {
            return metaMap;
        }
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlContent, 'application/xml');
            const scoreParts = doc.querySelectorAll('score-part');
            scoreParts.forEach((sp) => {
                const id = sp.getAttribute('id');
                if (!id) return;
                const partName = sp.querySelector('part-name')?.textContent?.trim() || '';
                const partAbbrev = sp.querySelector('part-abbreviation')?.textContent?.trim() || '';
                const instrumentName = sp.querySelector('score-instrument > instrument-name')?.textContent?.trim() || '';
                const instrumentSound = sp.querySelector('score-instrument > instrument-sound')?.textContent?.trim()?.toLowerCase() || '';
                const midiProgText = sp.querySelector('midi-instrument > midi-program')?.textContent?.trim();
                const midiProgram = midiProgText ? parseInt(midiProgText, 10) : null;

                metaMap[id] = {
                    partName,
                    partAbbrev,
                    instrumentName,
                    instrumentSound,
                    midiProgram,
                };
            });
        } catch (e) {
            console.warn('[PYP] Could not parse raw XML score-part headers:', e);
        }
        return metaMap;
    }

    /**
     * Determines whether a part is a vocal part and sets its default instrument patch ('piano' or 'harpsichord').
     */
    function detectPartInstrument(partInfo, allPartInfos = []) {
        const rawText = [
            partInfo.name || '',
            partInfo.xmlMeta?.partName || '',
            partInfo.xmlMeta?.instrumentName || '',
            partInfo.subInstrumentName || '',
        ].join(' ').toLowerCase().trim();

        const abbrev = (partInfo.xmlMeta?.partAbbrev || partInfo.name || '').toLowerCase().trim();
        const soundId = (partInfo.xmlMeta?.instrumentSound || '').toLowerCase().trim();
        const hasLyrics = Boolean(partInfo.hasLyrics);

        let gmProg1 = null;
        if (typeof partInfo.xmlMeta?.midiProgram === 'number' && !Number.isNaN(partInfo.xmlMeta.midiProgram)) {
            gmProg1 = partInfo.xmlMeta.midiProgram;
        } else if (typeof partInfo.midiInstrumentId === 'number' && !Number.isNaN(partInfo.midiInstrumentId)) {
            gmProg1 = partInfo.midiInstrumentId <= 127 ? partInfo.midiInstrumentId + 1 : partInfo.midiInstrumentId;
        }

        const scoreHasExplicitVocalSibling = allPartInfos.some((p) => {
            const t = `${p.name || ''} ${p.xmlMeta?.partName || ''} ${p.xmlMeta?.instrumentSound || ''}`.toLowerCase();
            return /\b(sopran|soprano|sopraan|mezzo|contralto|countertenor|tenor|tenore|bariton|baritone|choir|chorus|koor|coro|chor|voce|vocal|voice|singstimme|zang|canto|cantus)\b/.test(t) ||
                Boolean(p.hasLyrics);
        });

        const hasInstrumentalNoun = /\b(sax|saxophone|saxofoon|trombone|posaune|flute|flauto|flöte|fluit|recorder|blockflöte|blokfluit|oboe|hobo|hautbois|clarinet|clarinetto|klarinette|klarinet|bassoon|fagotto|fagott|fagot|horn|corno|hoorn|trumpet|tromba|trompete|trompet|tuba|violin|violino|violine|viool|viola|bratsche|altviool|cello|violoncello|contrabass|kontrabass|contrebasse|contrabas|double\s*bass|string\s*bass|violone|continuo|cembalo|harpsichord|klavecimbel|clavecin|organ|organo|orgel|orgue|harmonium|piano|pianoforte|klavier|harp|arpa|harfe|guitar|chitarra|gitarre|gitaar|timpani|pauken|xylophone|marimba|glockenspiel|drum|percussion)\b/.test(rawText);

        // 1. Vocal detection
        if (soundId.startsWith('voice.') || soundId.includes('vocal') || soundId.includes('choir')) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal' };
        }

        const hasExplicitVocalWord = /\b(soprano|sopraan|sopran|mezzo[-\s]*soprano|mezzo|contralto|countertenor|contratenor|tenor|tenore|baritone|bariton|baritono|baryton|voice|voices|vocal|voce|voci|stimme|singstimme|zang|canto|cantus|altus|bassus|quintus|sextus|choir|chorus|koor|chor|coro|chœur|choeur|soli|soloist|singer|satb|ssa|ssaa|ttbb|sab)\b/.test(rawText);
        if (hasExplicitVocalWord && !hasInstrumentalNoun) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal' };
        }

        if (/^(s|a|t|b|sop|alt|ten|bas|sopr)\.?(\s*[1234i]+)?$/i.test(partInfo.name.trim()) && !hasInstrumentalNoun) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal' };
        }

        const isBareAltoOrBass = /\b(alto|alt|bass|bas|basso)\b/.test(rawText) && !hasInstrumentalNoun;
        if (isBareAltoOrBass) {
            const isGmViola = gmProg1 === 42 && !hasLyrics && !scoreHasExplicitVocalSibling;
            const isGmContrabass = (gmProg1 === 43 || gmProg1 === 44) && !hasLyrics && !scoreHasExplicitVocalSibling;
            if (!isGmViola && !isGmContrabass) {
                return { patchId: 'piano', isVocal: true, roleTag: 'Vocal' };
            }
        }

        if (hasLyrics && !hasInstrumentalNoun) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal' };
        }

        // Default to Grand Piano
        return { patchId: 'piano', isVocal: false, roleTag: 'Piano' };
    }

    /**
     * Checks whether a score part is a Harpsichord, Piano, or Continuo keyboard accompaniment part
     * that should have its staff hidden by default when a multi-part score is loaded.
     */
    function isHarpsichordOrPianoPart(partInfo, allPartInfos = []) {
        const detected = detectPartInstrument(partInfo, allPartInfos);
        if (detected.isVocal) return false;

        const rawText = [
            partInfo.name || '',
            partInfo.xmlMeta?.partName || '',
            partInfo.xmlMeta?.instrumentName || '',
            partInfo.subInstrumentName || '',
        ].join(' ').toLowerCase().trim();

        const abbrev = (partInfo.xmlMeta?.partAbbrev || partInfo.name || '').toLowerCase().trim();
        const soundId = (partInfo.xmlMeta?.instrumentSound || '').toLowerCase().trim();

        if (
            soundId.includes('harpsichord') ||
            soundId.includes('clavichord') ||
            soundId.includes('piano') ||
            soundId.startsWith('keyboard.')
        ) {
            return true;
        }

        if (/\b(harpsichord|cembalo|clavicembalo|clavecin|klavecimbel|clavichord|virginal|spinet|continuo|basso\s*continuo|generalbass|piano|pianoforte|klavier|fortepiano)\b/i.test(rawText)) {
            return true;
        }

        if (/^(hch|cemb|b\.?c\.?|pno|pf)\.?$/i.test(abbrev)) {
            return true;
        }

        return false;
    }

    /**
     * Auto-hides Harpsichord / Piano / Continuo staves on initial score load
     * (as long as at least one non-keyboard part remains visible in the score).
     */
    function applyAutoHideKeyboardPartsOnLoad(osmd) {
        if (!osmd || !osmd.sheet || !Array.isArray(osmd.sheet.Instruments)) return;
        const instruments = osmd.sheet.Instruments;

        const infos = instruments.map((inst, idx) => {
            const partId = inst.IdString || `part_${inst.Id ?? idx}`;
            const xmlMeta = state.rawXmlPartMeta[partId] || null;
            const partName = (inst.Name || inst.NameLabel?.text || xmlMeta?.partName || `Part ${idx + 1}`).trim();
            const subInst = inst.SubInstruments && inst.SubInstruments[0];
            let hasLyrics = false;
            try {
                if (Array.isArray(inst.Voices)) {
                    for (const v of inst.Voices) {
                        if (Array.isArray(v.VoiceEntries)) {
                            for (const ve of v.VoiceEntries) {
                                if (ve.LyricsEntries && (ve.LyricsEntries.length > 0 || ve.LyricsEntries.size > 0)) {
                                    hasLyrics = true;
                                    break;
                                }
                            }
                        }
                        if (hasLyrics) break;
                    }
                }
            } catch (_) { /* ignore */ }

            return {
                inst,
                partId,
                name: partName,
                xmlMeta,
                subInstrumentName: subInst?.name || '',
                midiInstrumentId: inst.MidiInstrumentId ?? subInst?.midiInstrumentID,
                hasLyrics,
            };
        });

        const flags = infos.map((info) => isHarpsichordOrPianoPart(info, infos));
        const hasVisibleNonKeyboardPart = flags.some((isKb) => !isKb);

        infos.forEach((info, idx) => {
            const shouldHide = hasVisibleNonKeyboardPart && flags[idx];
            info.inst._autoHiddenOnLoad = shouldHide;
            info.inst.Visible = !shouldHide;
        });
    }

    function getEffectiveOsmdZoom() {
        return state.zoom * CONFIG.BASE_OSMD_ZOOM;
    }

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
     */
    function extractMidiNote(note) {
        if (!note || note.isRest() || !note.Pitch) return null;

        const pitchHalfTone = typeof note.Pitch.getHalfTone === 'function'
            ? note.Pitch.getHalfTone()
            : note.Pitch.halfTone;

        let midi;
        if (typeof note.halfTone === 'number' && !Number.isNaN(note.halfTone)) {
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

        return Math.max(21, Math.min(108, Math.round(midi)));
    }

    // ===========================================
    // AUDIO ENGINE & MULTI-SAMPLE LOADER
    // ===========================================

    /**
     * Converts a 0–100% UI slider value to a perceptual (logarithmic/power) audio gain multiplier.
     * Human hearing is logarithmic (dB): a linear 0.5 vs 1.0 is only -6 dB, which sounds barely softer
     * when multiple accompaniment parts sum together. Using an exponent of 2.4 with a +2.6 dB presence
     * headroom at 100% yields:
     *   - 100% -> gain 1.35 (+2.6 dB foreground presence boost)
     *   -  80% -> gain 0.79 (-2.0 dB standard balanced ensemble level)
     *   -  50% -> gain 0.255 (-11.9 dB, i.e. ~14.5 dB below 100% so the highlighted part stands out clearly!)
     */
    function volumePercentToGain(pct) {
        const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
        if (clamped <= 0) return 0;
        return 1.35 * Math.pow(clamped / 100, 2.4);
    }

    function masterVolumeToGain(pct) {
        const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
        if (clamped <= 0) return 0;
        return Math.pow(clamped / 100, 1.8);
    }

    function ensureMasterAudioChain() {
        if (state.masterGain) return;
        // Use a smooth, slow-release compressor (250ms release, soft 12dB knee) before a -3dB ceiling limiter.
        // A bare Tone.Limiter(-1) has a 10ms release time that modulates individual wave cycles on sustained tones,
        // causing audible overdrive/intermodulation distortion on mobile devices when multiple voices sum together.
        state.masterLimiter = new Tone.Limiter(-3).toDestination();
        state.masterCompressor = new Tone.Compressor({
            threshold: -12,
            ratio: 3,
            attack: 0.015,
            release: 0.25,
            knee: 12,
        }).connect(state.masterLimiter);
        state.masterGain = new Tone.Gain(state.masterMuted ? 0 : masterVolumeToGain(state.masterVolume)).connect(state.masterCompressor);

        state.metronomeGain = new Tone.Gain(0.45).connect(state.masterGain);
        state.metronomeSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.002, decay: 0.045, sustain: 0, release: 0.02 },
        }).connect(state.metronomeGain);
    }

    /**
     * Loads and caches the ToneAudioBuffers for an instrument patch on demand.
     * Multiple parts sharing the same patch reuse the single cached buffer set.
     */
    async function loadInstrumentBuffersOnce(patchId) {
        const def = INSTRUMENT_CATALOG[patchId] || INSTRUMENT_CATALOG.piano;
        if (!def.urls) return null; // Synth-only instrument (e.g. wave)
        if (state.instrumentBuffers[patchId]) return state.instrumentBuffers[patchId];
        if (state.instrumentFailed[patchId]) return null;
        if (state.instrumentLoadPromises[patchId]) return state.instrumentLoadPromises[patchId];

        const promise = new Promise((resolve) => {
            let settled = false;
            const timeoutId = window.setTimeout(() => {
                if (!settled) {
                    settled = true;
                    console.warn(`[PYP] Sample load timed out for ${patchId}; using synth fallback.`);
                    state.instrumentFailed[patchId] = true;
                    resolve(null);
                }
            }, 14000);

            const buffers = new Tone.ToneAudioBuffers({
                urls: def.urls,
                baseUrl: '',
                onload: () => {
                    if (!settled) {
                        settled = true;
                        window.clearTimeout(timeoutId);
                        state.instrumentBuffers[patchId] = buffers;
                        resolve(buffers);
                    }
                },
                onerror: (err) => {
                    if (!settled) {
                        settled = true;
                        window.clearTimeout(timeoutId);
                        console.warn(`[PYP] Failed to load samples for ${patchId}; using synth fallback.`, err);
                        state.instrumentFailed[patchId] = true;
                        resolve(null);
                    }
                },
            });
        });

        state.instrumentLoadPromises[patchId] = promise;
        const result = await promise;
        delete state.instrumentLoadPromises[patchId];
        return result;
    }

    function createFallbackSynth(synthFamily, destinationNode) {
        switch (synthFamily) {
            case 'wave':
                // Smooth, pitch-pure vocal rehearsal wave:
                // Tuned with -12 dB per-voice headroom and Q=0.5 lowpass smoothing so polyphonic sustained
                // voices never clip or overdrive mobile phone/tablet speakers or the master bus.
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 24,
                    oscillator: {
                        type: 'custom',
                        partials: [1, 0.32, 0.10, 0.03],
                    },
                    envelope: {
                        attack: 0.024,
                        decay: 0.1,
                        sustain: 0.82,
                        release: 0.16,
                    },
                    volume: -12,
                }).connect(destinationNode);

            case 'piano':
            default:
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16,
                    oscillator: { type: 'triangle4' },
                    envelope: { attack: 0.008, decay: 0.45, sustain: 0.25, release: 0.45 },
                    volume: -6,
                }).connect(destinationNode);
        }
    }

    function disposeSinglePartInstrument(part) {
        if (part.instrument) {
            try {
                part.instrument.releaseAll?.();
                part.instrument.dispose();
            } catch (_) { /* ignore */ }
            part.instrument = null;
        }
        if (part.filterNode) {
            try {
                part.filterNode.dispose();
            } catch (_) { /* ignore */ }
            part.filterNode = null;
        }
    }

    function disposePartAudioNodes() {
        for (const part of Object.values(state.parts)) {
            disposeSinglePartInstrument(part);
            if (part.gainNode) {
                try {
                    part.gainNode.dispose();
                } catch (_) { /* ignore */ }
                part.gainNode = null;
            }
        }
    }

    function createInstrumentNodeForPart(part) {
        if (!state.audioInitialized) return;
        ensureMasterAudioChain();

        if (!part.gainNode) {
            part.gainNode = new Tone.Gain(volumePercentToGain(part.volume ?? CONFIG.DEFAULT_PART_VOLUME)).connect(state.masterGain);
        }

        disposeSinglePartInstrument(part);

        const patchId = part.patchId || 'piano';
        const def = INSTRUMENT_CATALOG[patchId] || INSTRUMENT_CATALOG.piano;
        const cachedBuffers = state.instrumentBuffers[patchId];

        let targetDest = part.gainNode;
        if (def.filter) {
            part.filterNode = new Tone.Filter({
                type: def.filter.type || 'lowpass',
                frequency: def.filter.frequency || 2000,
                Q: def.filter.Q ?? 1,
                gain: def.filter.gain ?? 0,
            }).connect(part.gainNode);
            targetDest = part.filterNode;
        }

        if (def.urls && cachedBuffers && !state.instrumentFailed[patchId]) {
            const bufferMap = {};
            for (const noteName of Object.keys(def.urls)) {
                if (cachedBuffers.has(noteName)) {
                    bufferMap[noteName] = cachedBuffers.get(noteName);
                }
            }
            part.instrument = new Tone.Sampler({
                urls: bufferMap,
                attack: 0.002,
                release: def.release ?? 0.5,
                volume: def.volumeDb ?? -2,
            }).connect(targetDest);
        } else {
            part.instrument = createFallbackSynth(def.synthFamily, targetDest);
        }
    }

    async function loadAndBuildAllPartInstruments() {
        if (!state.audioInitialized) return;
        ensureMasterAudioChain();

        const uniquePatches = [...new Set(Object.values(state.parts).map((p) => p.patchId || 'piano'))];
        await Promise.all(uniquePatches.map((pid) => loadInstrumentBuffersOnce(pid)));

        for (const part of Object.values(state.parts)) {
            createInstrumentNodeForPart(part);
        }
        applyAllPartGains(true);
    }

    /**
     * Hot-swaps a single part's instrument (called when user changes a part's dropdown in the Mixer).
     */
    async function setPartInstrument(partId, newPatchId, announce = true) {
        const part = state.parts[partId];
        if (!part || !INSTRUMENT_CATALOG[newPatchId]) return;

        part.patchId = newPatchId;
        const def = INSTRUMENT_CATALOG[newPatchId];

        if (state.audioInitialized) {
            const needsDownload = Boolean(def.urls && !state.instrumentBuffers[newPatchId] && !state.instrumentFailed[newPatchId]);
            if (needsDownload) {
                part.isLoadingPatch = true;
                renderPartMixerUI();
                await loadInstrumentBuffersOnce(newPatchId);
                part.isLoadingPatch = false;
            }
            createInstrumentNodeForPart(part);
            applyAllPartGains(false);
        }

        renderPartMixerUI();
        if (announce) {
            toast(`${part.name}: ${def.label}`);
        }
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
        const gainVal = state.masterMuted ? 0 : masterVolumeToGain(state.masterVolume);
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
            let effective = volumePercentToGain(part.volume);
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

    // ===========================================
    // OS AUDIO FOCUS, MEDIA SESSION & USB/BLUETOOTH RECOVERY
    // ===========================================

    function getRawAudioContext() {
        try {
            const ctx = (typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context) || {};
            return ctx.rawContext || ctx._context || ctx || null;
        } catch (_) {
            return null;
        }
    }

    /**
     * Generates an in-memory 1-second 44.1kHz 16-bit PCM WAV data URL with an inaudible ±1 LSB (-90 dBFS) signal.
     * Playing this in a hidden <audio loop> element during playback forces Android, iOS, Windows, and macOS
     * to grant exclusive OS Media Audio Focus (automatically pausing background Podcasts, YouTube tabs, or Spotify)
     * and prevents the OS from suspending Web Audio or dropping USB/Bluetooth audio routing.
     */
    function getOrCreateAudioFocusElement() {
        if (state.focusAudioEl) return state.focusAudioEl;
        try {
            const sampleRate = 8000;
            const numSamples = sampleRate; // 1 second loop
            const dataBytes = numSamples * 2;
            const buffer = new ArrayBuffer(44 + dataBytes);
            const view = new DataView(buffer);

            const writeStr = (offset, str) => {
                for (let i = 0; i < str.length; i++) {
                    view.setUint8(offset + i, str.charCodeAt(i));
                }
            };

            writeStr(0, 'RIFF');
            view.setUint32(4, 36 + dataBytes, true);
            writeStr(8, 'WAVE');
            writeStr(12, 'fmt ');
            view.setUint32(16, 16, true); // PCM chunk size
            view.setUint16(20, 1, true);  // AudioFormat = 1 (PCM)
            view.setUint16(22, 1, true);  // NumChannels = 1
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);  // BlockAlign
            view.setUint16(34, 16, true); // BitsPerSample
            writeStr(36, 'data');
            view.setUint32(40, dataBytes, true);

            // Alternating ±1 LSB (-90.3 dBFS) so OS silence detectors treat it as an active media stream
            for (let i = 0; i < numSamples; i++) {
                view.setInt16(44 + i * 2, (i & 1) ? 1 : -1, true);
            }

            const blob = new Blob([buffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.loop = true;
            audio.playsInline = true;
            audio.preload = 'auto';
            audio.volume = 0.01;
            audio.setAttribute('playsinline', '');
            audio.setAttribute('webkit-playsinline', '');
            state.focusAudioEl = audio;
            return audio;
        } catch (_) {
            return null;
        }
    }

    function configureMediaSessionHandlers() {
        if (state.mediaSessionConfigured || !('mediaSession' in navigator)) return;
        state.mediaSessionConfigured = true;

        const safeSetHandler = (action, fn) => {
            try {
                navigator.mediaSession.setActionHandler(action, fn);
            } catch (_) { /* unsupported action */ }
        };

        safeSetHandler('play', () => {
            if (!state.isPlaying && state.scoreLoaded) startPlayback();
        });
        safeSetHandler('pause', () => {
            if (state.isPlaying) pausePlayback(true);
        });
        safeSetHandler('stop', () => {
            if (state.scoreLoaded) stopPlayback();
        });
        safeSetHandler('previoustrack', () => {
            if (state.scoreLoaded) stepBar(-1);
        });
        safeSetHandler('nexttrack', () => {
            if (state.scoreLoaded) stepBar(1);
        });
    }

    /**
     * Claims OS Media Audio Focus so background apps (Podcasts, YouTube, Spotify) automatically pause
     * and Bluetooth/USB audio interfaces lock onto PYP's playback stream.
     */
    function claimOsAudioFocus() {
        try {
            if (navigator.audioSession && navigator.audioSession.type !== 'playback') {
                navigator.audioSession.type = 'playback';
            }
        } catch (_) { /* ignore */ }

        const focusAudio = getOrCreateAudioFocusElement();
        if (focusAudio && focusAudio.paused) {
            const p = focusAudio.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => { /* ignore autoplay policy if outside gesture */ });
            }
        }

        try {
            if ('mediaSession' in navigator) {
                configureMediaSessionHandlers();
                if (typeof MediaMetadata === 'function') {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: state.scoreTitle || 'PYP Rehearsal Score',
                        artist: 'PYP — Prepare Your Part',
                        album: 'Score Rehearsal',
                    });
                }
                navigator.mediaSession.playbackState = 'playing';
            }
        } catch (_) { /* ignore */ }
    }

    function releaseOsAudioFocus() {
        try {
            if (state.focusAudioEl && !state.focusAudioEl.paused) {
                state.focusAudioEl.pause();
            }
        } catch (_) { /* ignore */ }

        try {
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'paused';
            }
        } catch (_) { /* ignore */ }
    }

    /**
     * Automatically wakes up the Web Audio context if it was suspended or interrupted by another app,
     * OS notification, or a USB / Bluetooth audio output route change.
     */
    async function keepAudioContextAlive(rebindDefaultSink = false) {
        if (!state.audioInitialized) return;
        const rawCtx = getRawAudioContext();
        if (!rawCtx) return;

        try {
            if (rebindDefaultSink && typeof rawCtx.setSinkId === 'function') {
                await rawCtx.setSinkId('');
            }
        } catch (_) { /* ignore sink rebind error */ }

        try {
            if (rawCtx.state === 'suspended' || rawCtx.state === 'interrupted') {
                await rawCtx.resume();
            }
            if (typeof Tone.start === 'function' && Tone.context?.state !== 'running') {
                await Tone.start();
            }
        } catch (_) { /* ignore */ }

        if (state.isPlaying) {
            claimOsAudioFocus();
            if (Tone.Transport.state !== 'started') {
                try {
                    Tone.Transport.start(Tone.now());
                } catch (_) { /* ignore */ }
            }
        }
    }

    function bindAudioDeviceAndContextRecovery() {
        if (state.audioRecoveryBound) return;
        state.audioRecoveryBound = true;

        const rawCtx = getRawAudioContext();
        if (rawCtx && typeof rawCtx.addEventListener === 'function') {
            rawCtx.addEventListener('statechange', () => {
                if (state.isPlaying && (rawCtx.state === 'suspended' || rawCtx.state === 'interrupted')) {
                    keepAudioContextAlive(false);
                }
            });
        }

        // Handle USB DAC / headset & Bluetooth headphone hot-plugging without audio dropouts
        if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
            navigator.mediaDevices.addEventListener('devicechange', () => {
                if (state.audioInitialized) {
                    keepAudioContextAlive(true);
                }
            });
        }

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && state.isPlaying) {
                keepAudioContextAlive(false);
            }
        });

        window.addEventListener('focus', () => {
            if (state.isPlaying) {
                keepAudioContextAlive(false);
            }
        });
    }

    async function ensureAudioReady() {
        if (state.audioReadyPromise) return state.audioReadyPromise;
        state.isLoadingAudio = true;
        updatePlayPauseButtonUI();

        state.audioReadyPromise = (async () => {
            try {
                try {
                    if (navigator.audioSession) {
                        navigator.audioSession.type = 'playback';
                    }
                } catch (_) { /* ignore */ }

                if (!state.audioInitialized) {
                    await Tone.start();
                    // Set scheduling lookahead to 80ms (compensated in getAudibleTransportTicks) so UI interactions never starve audio
                    try {
                        const ctx = typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context;
                        if (ctx && typeof ctx.lookAhead === 'number') {
                            ctx.lookAhead = 0.08;
                        }
                    } catch (_) { /* ignore */ }
                    ensureMasterAudioChain();
                    state.audioInitialized = true;
                    bindAudioDeviceAndContextRecovery();
                } else {
                    await keepAudioContextAlive(false);
                }

                // Ensure all currently selected part instruments have their buffers loaded & nodes built
                const partsList = Object.values(state.parts);
                const anyMissingBuffer = partsList.some((p) => {
                    const def = INSTRUMENT_CATALOG[p.patchId || 'piano'];
                    return def?.urls && !state.instrumentBuffers[p.patchId] && !state.instrumentFailed[p.patchId];
                });
                const anyMissingNode = partsList.some((p) => !p.instrument || !p.gainNode);

                if (anyMissingBuffer || anyMissingNode) {
                    await loadAndBuildAllPartInstruments();
                }

                applyMasterVolume();
                return true;
            } catch (err) {
                console.error('[PYP] Failed to initialize audio:', err);
                toast('Audio initialization failed. Try clicking Play again.', 'error');
                return false;
            } finally {
                state.isLoadingAudio = false;
                state.audioReadyPromise = null;
                updatePlayPauseButtonUI();
            }
        })();

        return state.audioReadyPromise;
    }

    // ===========================================
    // NOTE HIGHLIGHTING & CLICK AUDITIONING
    // ===========================================

    function clearAllNoteHighlights() {
        for (const el of state.highlightedElements) {
            if (el && el.classList) {
                el.classList.remove('note-highlighted', 'note-highlighted-part');
            }
        }
        state.highlightedElements.clear();
    }

    function applyNoteHighlightClass(svgEl) {
        if (!svgEl || !svgEl.classList) return;
        const partId = svgEl.dataset?.partId;
        const isPartHighlighted = Boolean(partId && state.parts[partId]?.highlighted);
        svgEl.classList.remove('note-highlighted', 'note-highlighted-part');
        svgEl.classList.add(isPartHighlighted ? 'note-highlighted-part' : 'note-highlighted');
        state.highlightedElements.add(svgEl);
    }

    function refreshActiveNoteHighlightColors() {
        for (const svgEl of state.highlightedElements) {
            applyNoteHighlightClass(svgEl);
        }
    }

    function highlightStepNotes(stepIdx, specificSvgEl = null) {
        clearAllNoteHighlights();
        if (specificSvgEl && specificSvgEl.classList) {
            applyNoteHighlightClass(specificSvgEl);
            return;
        }
        const step = state.cursorSteps[stepIdx];
        if (!step || !step.svgNotes) return;
        for (const svgEl of step.svgNotes) {
            applyNoteHighlightClass(svgEl);
        }
    }

    async function auditionClickedNote(noteItem) {
        if (!noteItem || state.isPlaying) return;

        const ready = await ensureAudioReady();
        if (!ready || state.isPlaying) return;

        const part = state.parts[noteItem.partId] || Object.values(state.parts)[0];
        if (!part || !part.instrument) return;

        if (state.auditionRestoreTimer) {
            window.clearTimeout(state.auditionRestoreTimer);
            state.auditionRestoreTimer = null;
        }
        releaseAllInstruments();

        // Ensure the clicked note is audible even if the user muted this part in the mixer
        if (part.gainNode && part.gainNode.gain.value < 0.15) {
            const auditionGain = Math.max(0.8, volumePercentToGain(part.volume || CONFIG.DEFAULT_PART_VOLUME));
            part.gainNode.gain.setValueAtTime(auditionGain, Tone.now());
        }

        const freqHz = state.concertPitchHz * Math.pow(2, (noteItem.midi - 69) / 12);
        const bar = getBarObjAtTicks(noteItem.ticks);
        const baseBpm = bar ? bar.bpm : state.activeBarBaseBpm;
        const liveBpm = Math.max(10, baseBpm * (state.tempoPercent / 100));
        const secPerWhole = (60 / liveBpm) * 4;
        const def = INSTRUMENT_CATALOG[part.patchId] || INSTRUMENT_CATALOG.piano;
        const durFactor = def.durationFactor ?? 0.95;
        const durationSec = Math.max(0.14, Math.min(4.0, (noteItem.durationWhole || 0.25) * secPerWhole * durFactor));

        try {
            part.instrument.triggerAttackRelease(freqHz, durationSec, Tone.now(), 0.85);
        } catch (err) {
            console.warn('[PYP] Audition note trigger error:', err);
        }

        state.auditionRestoreTimer = window.setTimeout(() => {
            state.auditionRestoreTimer = null;
            if (!state.isPlaying) {
                applyAllPartGains(false);
            }
        }, Math.round(durationSec * 1000) + 60);
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
            if (state.masterMuted || state.masterVolume <= 0) return;
            const part = state.parts[ev.partId];
            if (!part || !part.instrument || part.muted || part.volume <= 0) return;

            const partList = Object.values(state.parts);
            let anySoloed = false;
            let anyHighlighted = false;
            for (let i = 0; i < partList.length; i++) {
                if (partList[i].soloed) anySoloed = true;
                if (partList[i].highlighted) anyHighlighted = true;
            }
            if (anySoloed && !part.soloed) return;

            const def = INSTRUMENT_CATALOG[part.patchId] || INSTRUMENT_CATALOG.piano;

            // Live concert pitch frequency (supports real-time 440Hz / 415Hz switching!)
            const freqHz = state.concertPitchHz * Math.pow(2, (ev.midi - 69) / 12);

            // Live tempo-scaled duration with instrument-specific legato/articulation factor
            const liveBpm = Math.max(10, Tone.Transport.bpm.value || getEffectiveBpm());
            const secPerWhole = (60 / liveBpm) * 4;
            const durFactor = def.durationFactor ?? 0.95;
            const durationSec = Math.max(0.05, ev.durationWhole * secPerWhole * durFactor);

            // Enhance articulation contrast when a part is highlighted ('H')
            const noteVel = part.highlighted
                ? Math.min(1, ev.velocity * 1.15)
                : (anyHighlighted ? ev.velocity * 0.72 : ev.velocity);

            try {
                part.instrument.triggerAttackRelease(freqHz, durationSec, audioTime, noteVel);
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

    /**
     * Reuses the already-built Tone.Part instances on seek/skip (<0.1ms) instead of disposing and
     * rebuilding 15,000+ timeline events. Uses cancel(0) + start(0) rather than stop(0) so Tone.Part's
     * TimelineState at time 0 never gets stuck in a 'stopped' state.
     */
    function ensureTonePartsScheduled() {
        if (!state.playbackPart) {
            scheduleToneParts();
            return;
        }
        try {
            if (state.playbackPart.state !== 'started') {
                state.playbackPart.cancel(0);
                state.playbackPart.start(0);
            }
            if (state.metronomePart && state.metronomePart.state !== 'started') {
                state.metronomePart.cancel(0);
                state.metronomePart.start(0);
            }
        } catch (_) {
            scheduleToneParts();
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
     * - `parts` map (preserving existing mixer settings when re-rendering on zoom/view/hide toggle!)
     *
     * PERFORMANCE: Suppresses `osmd.cursor.update()` during traversal and computes coordinates directly
     * from OSMD's in-memory GraphicSheet (`MeasureList` + `GNotesUnderCursor`), eliminating ratusan/thousands
     * of synchronous `<canvas>.toDataURL()` calls and DOM layout reflows (>200x faster).
     */
    function extractScoreData(preserveMixerSettings = false) {
        const osmd = state.osmd;
        if (!osmd || !osmd.sheet || !osmd.cursor) return;

        state.ticksPerWhole = getTicksPerWhole();
        const canFastRebuild = Boolean(
            preserveMixerSettings &&
            state.barData.length > 0 &&
            state.allScoreNotes.length > 0 &&
            Object.keys(state.parts).length > 0
        );

        const prevParts = preserveMixerSettings ? { ...state.parts } : {};
        if (!preserveMixerSettings) {
            disposePartAudioNodes();
        }

        const nextParts = canFastRebuild ? state.parts : {};
        const notes = [];
        const cursorSteps = [];

        if (!canFastRebuild) {
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
        }

        // Extract Bar / Measure Data + Metronome Beats (or reuse on visual-only re-render)
        let barData = state.barData;
        let metronomeBeats = state.metronomeBeats;
        const sourceMeasures = osmd.sheet.SourceMeasures || [];

        if (!canFastRebuild) {
            barData = [];
            metronomeBeats = [];
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
                const rawPartInfos = osmd.sheet.Instruments.map((inst, idx) => {
                    const partId = inst.IdString || `part_${inst.Id ?? idx}`;
                    const xmlMeta = state.rawXmlPartMeta[partId] || null;
                    const partName = (inst.Name || inst.NameLabel?.text || xmlMeta?.partName || `Part ${idx + 1}`).trim();
                    const subInst = inst.SubInstruments && inst.SubInstruments[0];

                    let hasLyrics = false;
                    try {
                        if (Array.isArray(inst.Voices)) {
                            for (const v of inst.Voices) {
                                if (Array.isArray(v.VoiceEntries)) {
                                    for (const ve of v.VoiceEntries) {
                                        if (ve.LyricsEntries && (ve.LyricsEntries.length > 0 || ve.LyricsEntries.size > 0)) {
                                            hasLyrics = true;
                                            break;
                                        }
                                    }
                                }
                                if (hasLyrics) break;
                            }
                        }
                    } catch (_) { /* ignore */ }

                    return {
                        partId,
                        name: partName,
                        xmlMeta,
                        subInstrumentName: subInst?.name || '',
                        midiInstrumentId: inst.MidiInstrumentId ?? subInst?.midiInstrumentID,
                        hasLyrics,
                        autoHiddenOnLoad: Boolean(inst._autoHiddenOnLoad),
                    };
                });

                // Disambiguate duplicate part names by appending 1, 2, 3... (e.g. "Tromba 1", "Tromba 2", "Tromba 3")
                const partNameCounts = new Map();
                for (const pInfo of rawPartInfos) {
                    const key = (pInfo.name || 'Part').trim().toLowerCase();
                    partNameCounts.set(key, (partNameCounts.get(key) || 0) + 1);
                }
                const partNameIndex = new Map();
                for (const pInfo of rawPartInfos) {
                    const baseName = (pInfo.name || 'Part').trim();
                    const key = baseName.toLowerCase();
                    if ((partNameCounts.get(key) || 0) > 1) {
                        const num = (partNameIndex.get(key) || 0) + 1;
                        partNameIndex.set(key, num);
                        pInfo.name = `${baseName} ${num}`;
                    } else {
                        pInfo.name = baseName;
                    }
                }

                rawPartInfos.forEach((pInfo) => {
                    const { partId, name: partName } = pInfo;
                    if (!nextParts[partId]) {
                        const prev = prevParts[partId];
                        const detected = detectPartInstrument(pInfo, rawPartInfos);
                        const defaultPatch = (state.soundPreset !== 'auto' && INSTRUMENT_CATALOG[state.soundPreset])
                            ? state.soundPreset
                            : detected.patchId;

                        nextParts[partId] = {
                            id: partId,
                            name: partName,
                            volume: prev ? prev.volume : CONFIG.DEFAULT_PART_VOLUME,
                            muted: prev ? prev.muted : false,
                            soloed: prev ? prev.soloed : false,
                            highlighted: prev ? Boolean(prev.highlighted) : false,
                            centered: prev ? Boolean(prev.centered) : false,
                            hidden: prev ? Boolean(prev.hidden) : Boolean(pInfo.autoHiddenOnLoad),
                            defaultHidden: prev ? Boolean(prev.defaultHidden) : Boolean(pInfo.autoHiddenOnLoad),
                            patchId: prev ? prev.patchId : defaultPatch,
                            detectedPatchId: prev ? prev.detectedPatchId : detected.patchId,
                            isVocal: prev ? prev.isVocal : detected.isVocal,
                            roleTag: prev ? prev.roleTag : detected.roleTag,
                            isLoadingPatch: false,
                            gainNode: prev ? prev.gainNode : null,
                            filterNode: prev ? prev.filterNode : null,
                            instrument: prev ? prev.instrument : null,
                        };
                    }
                });
            }
        }

        // Precompute in-memory pixel bounds for each measure column from GraphicSheet.MeasureList,
        // grouping compactified multi-measure rests so absorbed bars interpolate smoothly across the visible multi-rest bar.
        const effZoom = getEffectiveOsmdZoom();
        const unitToPx = 10 * effZoom;
        const mList = osmd.GraphicSheet?.MeasureList || [];
        const measureBounds = new Array(mList.length);

        for (let mIdx = 0; mIdx < mList.length; mIdx++) {
            const col = mList[mIdx];
            let minY = Infinity;
            let maxY = -Infinity;
            let minX = 0;
            let width = 0;
            let hasRenderedMeasure = false;
            let multiRestCount = osmd.sheet?.SourceMeasures?.[mIdx]?.multipleRestMeasures || 0;

            if (Array.isArray(col)) {
                for (let sIdx = 0; sIdx < col.length; sIdx++) {
                    const gm = col[sIdx];
                    if (!gm || gm.isReducedToMultiRest) continue;
                    const pos = gm.PositionAndShape?.AbsolutePosition;
                    const size = gm.PositionAndShape?.Size;
                    if (!pos || !size || !(size.width > 0.01)) continue;
                    if (mIdx > 0 && pos.x <= 0.01) continue;

                    if (!hasRenderedMeasure) {
                        minX = pos.x;
                        width = size.width;
                        hasRenderedMeasure = true;
                    } else {
                        minX = Math.min(minX, pos.x);
                        width = Math.max(width, size.width);
                    }
                    if (gm.multipleRestMeasures > multiRestCount) {
                        multiRestCount = gm.multipleRestMeasures;
                    }
                    if (pos.y < minY) minY = pos.y;
                    const bot = pos.y + (size.height > 0 ? size.height : 4.0);
                    if (bot > maxY) maxY = bot;
                }
            }

            const bar = barData[mIdx];
            const barStart = bar ? bar.startTicks : 0;
            const barEnd = bar ? bar.endTicks : (barStart + state.ticksPerWhole);

            if (!hasRenderedMeasure) {
                measureBounds[mIdx] = {
                    isReduced: true,
                    isMultiRest: true,
                    xPx: 0,
                    widthPx: 0,
                    yPx: 0,
                    heightPx: 60,
                    spanStartTicks: barStart,
                    spanEndTicks: barEnd,
                };
            } else {
                measureBounds[mIdx] = {
                    isReduced: false,
                    isMultiRest: multiRestCount > 1,
                    xPx: minX * unitToPx,
                    widthPx: width * unitToPx,
                    yPx: Math.max(0, (minY - 1.0) * unitToPx),
                    heightPx: Math.max(40, (maxY - minY + 2.0) * unitToPx),
                    spanStartTicks: barStart,
                    spanEndTicks: barEnd,
                };
            }
        }

        // Link absorbed multi-measure rest bars to their visible multi-measure rest head bar
        for (let mIdx = 0; mIdx < measureBounds.length; mIdx++) {
            const head = measureBounds[mIdx];
            if (!head || head.isReduced) continue;

            let endIdx = mIdx;
            while (endIdx + 1 < measureBounds.length && measureBounds[endIdx + 1]?.isReduced) {
                endIdx++;
            }

            if (endIdx > mIdx) {
                const spanStart = barData[mIdx]?.startTicks ?? head.spanStartTicks;
                const spanEnd = barData[endIdx]?.endTicks ?? head.spanEndTicks;
                head.isMultiRest = true;
                head.spanStartTicks = spanStart;
                head.spanEndTicks = spanEnd;

                for (let k = mIdx + 1; k <= endIdx; k++) {
                    measureBounds[k] = {
                        isReduced: true,
                        isMultiRest: true,
                        xPx: head.xPx,
                        widthPx: head.widthPx,
                        yPx: head.yPx,
                        heightPx: head.heightPx,
                        spanStartTicks: spanStart,
                        spanEndTicks: spanEnd,
                    };
                }
                mIdx = endIdx;
            }
        }

        // Walk OSMD cursor once with cursor.update() suppressed (zero DOM reflows / canvas.toDataURL calls during walk!)
        osmd.cursor.show();
        const origCursorUpdate = osmd.cursor.update;
        osmd.cursor.update = () => { };

        let stepIdx = 0;
        let maxNoteEndTicks = 0;

        try {
            // On initial load (!canFastRebuild), temporarily enable all instruments during the silent iterator walk
            // so that auto-hidden keyboard parts (Harpsichord / Piano) still have their audio notes extracted into allScoreNotes.
            if (!canFastRebuild && Array.isArray(osmd.sheet?.Instruments)) {
                osmd.sheet.Instruments.forEach((inst) => { inst.Visible = true; });
            }
            osmd.cursor.reset();

            while (!osmd.cursor.Iterator.EndReached && stepIdx < CONFIG.MAX_CURSOR_STEPS) {
                const iter = osmd.cursor.Iterator;
                const realValue = iter.currentTimeStamp?.RealValue ?? 0;
                const ticks = realValueToTicks(realValue);
                const measureIndex = iter.CurrentMeasureIndex ?? 0;
                const mBounds = measureBounds[measureIndex] || {
                    isReduced: false,
                    isMultiRest: false,
                    xPx: 0,
                    widthPx: 100,
                    yPx: 0,
                    heightPx: 60,
                    spanStartTicks: 0,
                    spanEndTicks: state.ticksPerWhole,
                };

                const svgNotes = [];
                const gNoteBySource = new Map();
                const clickableNotes = [];
                let minVisibleGNoteXUnits = null;
                let minVisibleGraceXUnits = null;

                try {
                    if (typeof osmd.cursor.GNotesUnderCursor === 'function') {
                        const gNotes = osmd.cursor.GNotesUnderCursor();
                        if (gNotes) {
                            for (const gn of gNotes) {
                                const gnInst = gn?.sourceNote?.ParentVoiceEntry?.ParentVoice?.Parent;
                                const gnPartId = gnInst ? (gnInst.IdString || `part_${gnInst.Id ?? 0}`) : 'part_0';
                                const isInstVisible = !nextParts[gnPartId]?.hidden && (!gnInst || !gnInst._autoHiddenOnLoad || Boolean(nextParts[gnPartId] && !nextParts[gnPartId].hidden));
                                const svgEl = typeof gn.getSVGGElement === 'function' ? gn.getSVGGElement() : null;
                                const gnPos = gn?.PositionAndShape?.AbsolutePosition;
                                const isGraceNote = Boolean(gn?.sourceNote?.isGrace);

                                // Use the leftmost (primary stem-aligned) graphical note X among visible parts in this measure,
                                // ignoring grace notes and right-displaced chord seconds so trills/chords never jitter horizontally
                                if (
                                    !mBounds.isMultiRest &&
                                    isInstVisible &&
                                    svgEl &&
                                    gnPos &&
                                    typeof gnPos.x === 'number' &&
                                    gnPos.x > 0.01 &&
                                    (gnPos.x * unitToPx) >= (mBounds.xPx - 6)
                                ) {
                                    if (isGraceNote) {
                                        if (minVisibleGraceXUnits === null || gnPos.x < minVisibleGraceXUnits) {
                                            minVisibleGraceXUnits = gnPos.x;
                                        }
                                    } else if (minVisibleGNoteXUnits === null || gnPos.x < minVisibleGNoteXUnits) {
                                        minVisibleGNoteXUnits = gnPos.x;
                                    }
                                }

                                if (svgEl && isInstVisible) {
                                    svgEl.dataset.partId = gnPartId;
                                    svgNotes.push(svgEl);
                                }
                                if (gn && gn.sourceNote && isInstVisible) {
                                    gNoteBySource.set(gn.sourceNote, { gn, svgEl });
                                }
                            }
                        }
                    }
                } catch (_) { /* optional highlight */ }

                const chosenGNoteXUnits = minVisibleGNoteXUnits !== null ? minVisibleGNoteXUnits : minVisibleGraceXUnits;
                const rawVisibleX = chosenGNoteXUnits !== null ? ((chosenGNoteXUnits - 0.45) * unitToPx) : null;

                // Initial fallback X before per-measure anchor interpolation & sub-beat trill stabilization
                let stepX = mBounds.xPx;
                if (rawVisibleX !== null) {
                    stepX = rawVisibleX;
                } else {
                    const spanStart = mBounds.spanStartTicks;
                    const spanEnd = mBounds.spanEndTicks;
                    if (spanEnd > spanStart) {
                        const frac = Math.max(0, Math.min(1, (ticks - spanStart) / (spanEnd - spanStart)));
                        const insetLeft = Math.min(mBounds.widthPx * 0.12, 14 * effZoom);
                        const usableW = Math.max(4, mBounds.widthPx - insetLeft - 4 * effZoom);
                        stepX = mBounds.xPx + insetLeft + usableW * frac;
                    }
                }

                const voiceEntries = iter.CurrentVoiceEntries;
                if (voiceEntries) {
                    for (const ve of voiceEntries) {
                        const inst = ve.ParentVoice?.Parent;
                        const partId = inst ? (inst.IdString || `part_${inst.Id ?? 0}`) : 'part_0';
                        const partName = inst ? (inst.Name || inst.NameLabel?.text || `Part ${(inst.Id ?? 0) + 1}`).trim() : 'Part 1';

                        if (!canFastRebuild && !nextParts[partId]) {
                            const prev = prevParts[partId];
                            const detected = detectPartInstrument({
                                partId,
                                name: partName,
                                xmlMeta: state.rawXmlPartMeta[partId] || null,
                                subInstrumentName: inst?.SubInstruments?.[0]?.name || '',
                                midiInstrumentId: inst?.MidiInstrumentId,
                                hasLyrics: Boolean(ve.LyricsEntries && (ve.LyricsEntries.length > 0 || ve.LyricsEntries.size > 0)),
                            });
                            const defaultPatch = (state.soundPreset !== 'auto' && INSTRUMENT_CATALOG[state.soundPreset])
                                ? state.soundPreset
                                : detected.patchId;

                            nextParts[partId] = {
                                id: partId,
                                name: partName,
                                volume: prev ? prev.volume : CONFIG.DEFAULT_PART_VOLUME,
                                muted: prev ? prev.muted : false,
                                soloed: prev ? prev.soloed : false,
                                highlighted: prev ? Boolean(prev.highlighted) : false,
                                centered: prev ? Boolean(prev.centered) : false,
                                hidden: prev ? Boolean(prev.hidden) : Boolean(inst?._autoHiddenOnLoad),
                                defaultHidden: prev ? Boolean(prev.defaultHidden) : Boolean(inst?._autoHiddenOnLoad),
                                patchId: prev ? prev.patchId : defaultPatch,
                                detectedPatchId: prev ? prev.detectedPatchId : detected.patchId,
                                isVocal: prev ? prev.isVocal : detected.isVocal,
                                roleTag: prev ? prev.roleTag : detected.roleTag,
                                isLoadingPatch: false,
                                gainNode: prev ? prev.gainNode : null,
                                filterNode: prev ? prev.filterNode : null,
                                instrument: prev ? prev.instrument : null,
                            };
                        }

                        const isPartVisible = !nextParts[partId]?.hidden;

                        for (const note of ve.Notes) {
                            if (note.isRest() || !note.Pitch || note.isGrace) continue;

                            const writtenDurationWhole = note.Length?.RealValue ?? 0;
                            if (writtenDurationWhole <= 0.0005) continue;

                            const midi = extractMidiNote(note);
                            if (midi === null) continue;

                            if (isPartVisible) {
                                const gEntry = gNoteBySource.get(note);
                                const pos = gEntry?.gn?.PositionAndShape?.AbsolutePosition;
                                const noteX = (pos && typeof pos.x === 'number') ? (pos.x * unitToPx) : (stepX + 6 * effZoom);
                                const noteY = (pos && typeof pos.y === 'number') ? (pos.y * unitToPx) : null;

                                clickableNotes.push({
                                    stepIdx,
                                    ticks,
                                    midi,
                                    durationWhole: writtenDurationWhole,
                                    partId,
                                    svgEl: gEntry?.svgEl || null,
                                    noteX,
                                    noteY,
                                });
                            }

                            if (!canFastRebuild) {
                                let durationWhole = writtenDurationWhole;
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
                }

                const hitX = clickableNotes.length > 0
                    ? (clickableNotes.reduce((sum, cn) => sum + cn.noteX, 0) / clickableNotes.length)
                    : (stepX + 6 * effZoom);

                cursorSteps.push({
                    stepIdx,
                    ticks,
                    realValue,
                    measureIndex,
                    x: stepX,
                    rawVisibleX,
                    hitX,
                    y: mBounds.yPx,
                    height: mBounds.heightPx,
                    svgNotes,
                    clickableNotes,
                });

                osmd.cursor.next();
                stepIdx++;
            }

            stabilizeCursorStepCoordinates(cursorSteps, measureBounds, effZoom);

            if (!canFastRebuild && Array.isArray(osmd.sheet?.Instruments)) {
                osmd.sheet.Instruments.forEach((inst, idx) => {
                    const pid = inst.IdString || `part_${inst.Id ?? idx}`;
                    const pObj = nextParts[pid];
                    if (pObj) inst.Visible = !pObj.hidden;
                });
            }
            osmd.cursor.reset();
        } finally {
            osmd.cursor.update = origCursorUpdate;
        }

        // Update cursor DOM once after silent traversal
        applyCursorStyle();
        state.currentStepIndex = 0;

        if (!canFastRebuild) {
            // Ensure any fallback-discovered parts with duplicate names are also numbered (1, 2, 3...)
            const allPartsList = Object.values(nextParts);
            const fallbackCounts = new Map();
            for (const p of allPartsList) {
                const key = (p.name || 'Part').trim().toLowerCase();
                fallbackCounts.set(key, (fallbackCounts.get(key) || 0) + 1);
            }
            const fallbackSeen = new Map();
            for (const p of allPartsList) {
                const base = (p.name || 'Part').trim();
                const key = base.toLowerCase();
                if ((fallbackCounts.get(key) || 0) > 1) {
                    const num = (fallbackSeen.get(key) || 0) + 1;
                    fallbackSeen.set(key, num);
                    p.name = `${base} ${num}`;
                }
            }

            const lastBarEnd = barData.length ? barData[barData.length - 1].endTicks : 0;
            const lastStepTick = cursorSteps.length ? cursorSteps[cursorSteps.length - 1].ticks : 0;
            state.totalMusicalTicks = Math.max(lastBarEnd, maxNoteEndTicks, lastStepTick, 1);
            state.parts = nextParts;
            state.allScoreNotes = notes;
            state.notes = state.allScoreNotes;
            state.barData = barData;
            state.metronomeBeats = metronomeBeats;
        }

        // Compute horizontal end X of final barline for smooth continuous panning through the last measure
        const lastStepX = cursorSteps.length ? cursorSteps[cursorSteps.length - 1].x : 0;
        let scoreEndX = lastStepX + 60;
        if (measureBounds.length > 0) {
            const lastMB = measureBounds[measureBounds.length - 1];
            const rightPx = lastMB.xPx + lastMB.widthPx;
            if (rightPx > lastStepX) {
                scoreEndX = rightPx;
            }
        }
        state.scoreEndX = scoreEndX;
        state.cursorSteps = cursorSteps;

        if (!preserveMixerSettings) {
            state.currentTicks = 0;
            state.smoothTicks = 0;
            if (barData.length > 0) {
                state.loopStartBar = 1;
                state.loopEndBar = Math.min(barData.length, Math.max(2, Math.min(4, barData.length)));
                syncLoopInputsUI();
            }
        }

        // Apply 50% horizontal padding in Continuous View
        updateContinuousHorizontalPadding(false);
        if (!preserveMixerSettings) {
            updateCameraForTicks(0, 0, true);
        }

        // Rebuild UI elements (skip full timeline bar tick DOM rebuild on visual-only re-renders)
        if (!canFastRebuild) {
            updateTempoReadoutUI();
            setupTimelineUI();
        }
        renderPartMixerUI();
        syncGlobalSoundSelectUI();
        renderStaffHighlights();
        renderStaffBarNumbers();
        renderStaffStartPartPointers();
        renderMultiRestSkipPointers();

        // Schedule audio parts only on initial score load (never interrupt active playback on visual re-render!)
        if (state.audioInitialized && !canFastRebuild) {
            if (!preserveMixerSettings) {
                loadAndBuildAllPartInstruments();
            }
            scheduleToneParts();
        }
    }

    function syncOsmdInstrumentVisibility() {
        if (!state.osmd || !state.osmd.sheet || !Array.isArray(state.osmd.sheet.Instruments)) return;
        state.osmd.sheet.Instruments.forEach((inst, idx) => {
            const pid = inst.IdString || `part_${inst.Id ?? idx}`;
            const partObj = state.parts[pid];
            if (partObj) {
                inst.Visible = !partObj.hidden;
            }
        });
    }

    /**
     * Stabilizes cursor X coordinates across every measure:
     * 1. When a hidden part plays 32nd/64th notes or trills while visible parts hold longer notes,
     *    interpolates missing sub-beat X coordinates between the surrounding visible notehead anchors
     *    in that measure instead of jumping back and forth to an uncalibrated measure formula.
     * 2. Across rapid sub-beat passages (16th/32nd/64th notes and written-out trills), regularizes
     *    uneven VexFlow notehead/accidental spacing into a constant-velocity trajectory anchored at beat landmarks.
     * 3. Enforces strict left-to-right monotonicity within each horizontal system row.
     */
    function stabilizeCursorStepCoordinates(cursorSteps, measureBounds, effZoom) {
        if (!Array.isArray(cursorSteps) || cursorSteps.length === 0) return;

        const fastStepTicks = Math.round(state.ticksPerWhole / 12);      // <= 16th notes / 16th triplets
        const ultraFastStepTicks = Math.round(state.ticksPerWhole / 20); // <= 32nd & 64th notes / written-out trills
        const beatWindowTicks = Math.round(state.ticksPerWhole / 4);     // 1 quarter-note beat window

        // Process contiguous measure slices
        let segStart = 0;
        while (segStart < cursorSteps.length) {
            const mIdx = cursorSteps[segStart].measureIndex;
            let segEnd = segStart;
            while (segEnd + 1 < cursorSteps.length && cursorSteps[segEnd + 1].measureIndex === mIdx) {
                segEnd++;
            }

            const mSteps = cursorSteps.slice(segStart, segEnd + 1);
            const mBounds = measureBounds[mIdx] || {
                xPx: mSteps[0].x,
                yPx: mSteps[0].y,
                widthPx: 140,
                heightPx: mSteps[0].height,
                spanStartTicks: mSteps[0].ticks,
                spanEndTicks: mSteps[mSteps.length - 1].ticks + beatWindowTicks,
            };

            const insetLeft = Math.min(mBounds.widthPx * 0.12, 14 * effZoom);
            const defaultStartX = mBounds.xPx + insetLeft;
            const defaultEndX = mBounds.xPx + Math.max(insetLeft + 4, mBounds.widthPx - 4 * effZoom);
            const spanStart = mBounds.spanStartTicks;
            const spanEnd = Math.max(spanStart + 1, mBounds.spanEndTicks);

            // 1. Collect visible notehead anchors and make them monotonically non-decreasing
            const visIndices = [];
            let runningVisX = -Infinity;
            for (let i = 0; i < mSteps.length; i++) {
                const s = mSteps[i];
                if (typeof s.rawVisibleX === 'number' && !Number.isNaN(s.rawVisibleX)) {
                    if (s.rawVisibleX < runningVisX) {
                        s.rawVisibleX = runningVisX;
                    } else {
                        runningVisX = s.rawVisibleX;
                    }
                    visIndices.push(i);
                }
            }

            if (visIndices.length === 0) {
                // Multi-measure rest or full-bar rest in visible parts: linear glide across measure
                for (let i = 0; i < mSteps.length; i++) {
                    const s = mSteps[i];
                    const frac = Math.max(0, Math.min(1, (s.ticks - spanStart) / (spanEnd - spanStart)));
                    s.x = defaultStartX + (defaultEndX - defaultStartX) * frac;
                }
            } else {
                // Anchor-based interpolation for any step where only hidden parts have notes
                const firstVisIdx = visIndices[0];
                const firstVis = mSteps[firstVisIdx];
                const leadStartX = Math.min(defaultStartX, firstVis.rawVisibleX);
                for (let i = 0; i < firstVisIdx; i++) {
                    const s = mSteps[i];
                    const denom = Math.max(1, firstVis.ticks - spanStart);
                    const frac = Math.max(0, Math.min(1, (s.ticks - spanStart) / denom));
                    s.x = leadStartX + (firstVis.rawVisibleX - leadStartX) * frac;
                }

                for (let v = 0; v < visIndices.length; v++) {
                    const curIdx = visIndices[v];
                    const curStep = mSteps[curIdx];
                    curStep.x = curStep.rawVisibleX;

                    if (v + 1 < visIndices.length) {
                        const nextIdx = visIndices[v + 1];
                        const nextStep = mSteps[nextIdx];
                        const denom = Math.max(1, nextStep.ticks - curStep.ticks);
                        for (let i = curIdx + 1; i < nextIdx; i++) {
                            const s = mSteps[i];
                            const frac = Math.max(0, Math.min(1, (s.ticks - curStep.ticks) / denom));
                            s.x = curStep.rawVisibleX + (nextStep.rawVisibleX - curStep.rawVisibleX) * frac;
                        }
                    }
                }

                const lastVisIdx = visIndices[visIndices.length - 1];
                const lastVis = mSteps[lastVisIdx];
                const tailEndX = Math.max(lastVis.rawVisibleX + 4 * effZoom, defaultEndX);
                const tailDenom = Math.max(1, spanEnd - lastVis.ticks);
                for (let i = lastVisIdx + 1; i < mSteps.length; i++) {
                    const s = mSteps[i];
                    const frac = Math.max(0, Math.min(1, (s.ticks - lastVis.ticks) / tailDenom));
                    s.x = lastVis.rawVisibleX + (tailEndX - lastVis.rawVisibleX) * frac;
                }
            }

            // 2. Sub-beat velocity regularization for rapid runs (16th/32nd/64th notes & written-out trills)
            if (mSteps.length >= 3) {
                let rStart = 0;
                while (rStart < mSteps.length - 1) {
                    if ((mSteps[rStart + 1].ticks - mSteps[rStart].ticks) > fastStepTicks) {
                        rStart++;
                        continue;
                    }
                    let rEnd = rStart + 1;
                    while (
                        rEnd + 1 < mSteps.length &&
                        (mSteps[rEnd + 1].ticks - mSteps[rEnd].ticks) <= fastStepTicks
                    ) {
                        rEnd++;
                    }

                    if (rEnd - rStart >= 2) {
                        // Select beat landmarks along the rapid run (every ~quarter note, plus endpoints)
                        const anchors = [rStart];
                        let lastAnchorTicks = mSteps[rStart].ticks;
                        for (let i = rStart + 1; i < rEnd; i++) {
                            const sinceLast = mSteps[i].ticks - lastAnchorTicks;
                            const toEnd = mSteps[rEnd].ticks - mSteps[i].ticks;
                            if (sinceLast >= beatWindowTicks && toEnd >= Math.round(beatWindowTicks * 0.5)) {
                                anchors.push(i);
                                lastAnchorTicks = mSteps[i].ticks;
                            }
                        }
                        anchors.push(rEnd);

                        // Lightly smooth interior beat landmarks so velocity doesn't kink at beat boundaries
                        if (anchors.length >= 3) {
                            const smoothedAnchorX = anchors.map((idx) => mSteps[idx].x);
                            for (let a = 1; a < anchors.length - 1; a++) {
                                const prevA = mSteps[anchors[a - 1]];
                                const currA = mSteps[anchors[a]];
                                const nextA = mSteps[anchors[a + 1]];
                                const denom = Math.max(1, nextA.ticks - prevA.ticks);
                                const frac = (currA.ticks - prevA.ticks) / denom;
                                const interpAnchorX = prevA.x + (nextA.x - prevA.x) * frac;
                                smoothedAnchorX[a] = currA.x * 0.65 + interpAnchorX * 0.35;
                            }
                            for (let a = 1; a < anchors.length - 1; a++) {
                                mSteps[anchors[a]].x = smoothedAnchorX[a];
                            }
                        }

                        // Piece-wise time-linear regularization between landmarks
                        for (let a = 0; a < anchors.length - 1; a++) {
                            const i0 = anchors[a];
                            const i1 = anchors[a + 1];
                            const s0 = mSteps[i0];
                            const s1 = mSteps[i1];
                            const segTicks = Math.max(1, s1.ticks - s0.ticks);
                            const avgDt = segTicks / Math.max(1, i1 - i0);
                            // 32nd/64th notes & trills get 94% constant-velocity regularization
                            const linearWeight = avgDt <= ultraFastStepTicks ? 0.94 : 0.80;

                            for (let i = i0 + 1; i < i1; i++) {
                                const s = mSteps[i];
                                const frac = Math.max(0, Math.min(1, (s.ticks - s0.ticks) / segTicks));
                                const linearX = s0.x + (s1.x - s0.x) * frac;
                                s.x = linearX * linearWeight + s.x * (1 - linearWeight);
                            }
                        }

                        // Final local time-weighted smoothing pass across ultra-fast (32nd/64th/trill) interior steps
                        const passX = mSteps.map((s) => s.x);
                        for (let i = rStart + 1; i < rEnd; i++) {
                            const dtPrev = mSteps[i].ticks - mSteps[i - 1].ticks;
                            const dtNext = mSteps[i + 1].ticks - mSteps[i].ticks;
                            if (dtPrev <= ultraFastStepTicks && dtNext <= ultraFastStepTicks && (dtPrev + dtNext) > 0) {
                                const expectedX = mSteps[i - 1].x + (mSteps[i + 1].x - mSteps[i - 1].x) * (dtPrev / (dtPrev + dtNext));
                                passX[i] = expectedX * 0.85 + mSteps[i].x * 0.15;
                            }
                        }
                        for (let i = rStart + 1; i < rEnd; i++) {
                            mSteps[i].x = passX[i];
                        }
                    }

                    rStart = rEnd + 1;
                }
            }

            // 3. Enforce strict monotonicity within the measure
            for (let i = 1; i < mSteps.length; i++) {
                if (mSteps[i].x < mSteps[i - 1].x) {
                    mSteps[i].x = mSteps[i - 1].x;
                }
            }

            segStart = segEnd + 1;
        }

        // 4. Enforce strict monotonicity across measure boundaries on the same horizontal system row
        for (let i = 1; i < cursorSteps.length; i++) {
            const prev = cursorSteps[i - 1];
            const curr = cursorSteps[i];
            if (Math.abs(curr.y - prev.y) < 10 && curr.x < prev.x) {
                curr.x = prev.x;
            }
        }
    }

    /**
     * Checks whether a SourceMeasure contains any non-rest notes in currently visible staves.
     */
    function sourceMeasureHasVisibleNotes(sm) {
        if (!sm || !Array.isArray(sm.VerticalSourceStaffEntryContainers)) return false;
        for (const container of sm.VerticalSourceStaffEntryContainers) {
            if (!container || !Array.isArray(container.StaffEntries)) continue;
            for (const se of container.StaffEntries) {
                if (!se || !se.ParentStaff) continue;
                const isStaffVisible = typeof se.ParentStaff.isVisible === 'function'
                    ? se.ParentStaff.isVisible()
                    : (se.ParentStaff.ParentInstrument?.Visible !== false);
                if (!isStaffVisible || !Array.isArray(se.VoiceEntries)) continue;
                for (const ve of se.VoiceEntries) {
                    if (!ve || !Array.isArray(ve.Notes)) continue;
                    for (const note of ve.Notes) {
                        if (note && typeof note.isRest === 'function' && !note.isRest()) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /**
     * Configures OSMD's multi-measure rest generator so that whenever a multi-bar rest precedes a measure
     * where visible parts have notes again, the final bar of the rest is left expanded as a standalone 1-bar rest
     * ("multi-bar rest minus one at the end"). This gives singers a full count-in bar before their entry.
     */
    function configureMultiRestMinusOneRule(osmd) {
        const measures = osmd?.sheet?.SourceMeasures;
        if (!Array.isArray(measures) || measures.length === 0) return;

        for (let i = 0; i < measures.length; i++) {
            const sm = measures[i];
            if (!sm) continue;
            if (typeof sm._origCanBeReducedToMultiRest !== 'function' && typeof sm.canBeReducedToMultiRest === 'function') {
                sm._origCanBeReducedToMultiRest = sm.canBeReducedToMultiRest.bind(sm);
            }
            // Clear any static XML multi-rest flags so OSMD recalculates dynamically from visible parts
            sm.multipleRestMeasures = 0;
            sm.multipleRestMeasureNumber = 0;
            sm.isReducedToMultiRest = false;
        }

        for (let i = 0; i < measures.length; i++) {
            const sm = measures[i];
            if (!sm || typeof sm._origCanBeReducedToMultiRest !== 'function') continue;

            sm.canBeReducedToMultiRest = () => {
                if (!sm._origCanBeReducedToMultiRest()) return false;
                const nextSm = measures[i + 1];
                if (nextSm) {
                    const nextCannotReduce = typeof nextSm._origCanBeReducedToMultiRest === 'function'
                        ? !nextSm._origCanBeReducedToMultiRest()
                        : sourceMeasureHasVisibleNotes(nextSm);
                    if (nextCannotReduce || sourceMeasureHasVisibleNotes(nextSm)) {
                        return false;
                    }
                }
                return true;
            };
        }
    }

    /**
     * Rebuilds only the visual score & cursor coordinates after zoom, view mode, or part visibility re-render,
     * keeping Tone.Transport running 100% uninterrupted during active playback!
     */
    function reRenderScorePreservingState() {
        if (!state.osmd || !state.scoreLoaded) return;

        clearAllNoteHighlights();
        updateContinuousHorizontalPadding(true);
        syncOsmdInstrumentVisibility();
        configureMultiRestMinusOneRule(state.osmd);

        state.osmd.setOptions({
            renderSingleHorizontalStaffline: state.continuousScrollMode,
        });
        if (state.osmd.EngravingRules) {
            state.osmd.EngravingRules.RenderMeasureNumbers = false;
        }
        state.osmd.zoom = getEffectiveOsmdZoom();
        state.osmd.render();
        captureBaseSvgDimensions();

        extractScoreData(true);

        // Sync cursor & camera to the live musical position without pausing or restarting Tone.Transport
        const liveTicks = state.isPlaying
            ? Math.max(0, Math.min(state.totalMusicalTicks, Tone.Transport.ticks))
            : state.currentTicks;
        state.currentTicks = liveTicks;
        state.smoothTicks = liveTicks;

        const targetStep = getStepIndexAtTicks(liveTicks);
        moveCursorToStep(targetStep);
        if (state.isPlaying) {
            highlightStepNotes(targetStep);
            state.lastFrameTime = performance.now();
        }
        updateCameraForTicks(liveTicks, 0, true, false);
        updateTimelineReadout(liveTicks);
    }

    /**
     * Captures the rendered <svg> base dimensions and locks their viewBox after osmd.render()
     * so subsequent zoom changes can scale the vector SVG and precomputed coordinates in <1ms
     * without ever calling osmd.render() or blocking Tone.js audio playback.
     */
    function captureBaseSvgDimensions() {
        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        state.renderedEffZoom = getEffectiveOsmdZoom();
        const svgs = inner.querySelectorAll('svg');
        svgs.forEach((svg) => {
            const w = parseFloat(svg.getAttribute('width')) || svg.clientWidth || 0;
            const h = parseFloat(svg.getAttribute('height')) || svg.clientHeight || 0;
            if (w > 0 && h > 0) {
                svg.dataset.baseWidth = String(w);
                svg.dataset.baseHeight = String(h);
                if (!svg.getAttribute('viewBox')) {
                    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
                }
            }
        });
    }

    /**
     * Scales the vector <svg> score and all precomputed cursor/note/overlay coordinates in <1ms
     * without invoking osmd.render() or extractScoreData(), ensuring 100% uninterrupted audio playback.
     */
    function applyFastVectorZoom(prevEffZoom, newEffZoom) {
        if (!state.osmd || !state.scoreLoaded || !(prevEffZoom > 0) || !(newEffZoom > 0)) return;

        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        const stepRatio = newEffZoom / prevEffZoom;
        const baseEffZoom = state.renderedEffZoom || prevEffZoom;
        const baseRatio = newEffZoom / baseEffZoom;

        // 1. Resize vector <svg> elements via viewBox scaling (100% crisp vectors, zero VexFlow re-engraving)
        const svgs = inner.querySelectorAll('svg');
        svgs.forEach((svg) => {
            const baseW = parseFloat(svg.dataset.baseWidth) || 0;
            const baseH = parseFloat(svg.dataset.baseHeight) || 0;
            if (baseW > 0 && baseH > 0) {
                const newW = baseW * baseRatio;
                const newH = baseH * baseRatio;
                svg.setAttribute('width', newW.toFixed(2));
                svg.setAttribute('height', newH.toFixed(2));
                const pageDiv = svg.parentElement;
                if (pageDiv && pageDiv !== inner) {
                    pageDiv.style.width = `${newW.toFixed(2)}px`;
                    pageDiv.style.height = `${newH.toFixed(2)}px`;
                }
            }
        });

        // 2. Scale precomputed cursor & note hit coordinates in-place in O(N) microseconds
        for (let i = 0; i < state.cursorSteps.length; i++) {
            const s = state.cursorSteps[i];
            s.x *= stepRatio;
            if (typeof s.rawVisibleX === 'number') s.rawVisibleX *= stepRatio;
            s.hitX *= stepRatio;
            s.y *= stepRatio;
            s.height *= stepRatio;
            if (Array.isArray(s.clickableNotes)) {
                for (let j = 0; j < s.clickableNotes.length; j++) {
                    const cn = s.clickableNotes[j];
                    if (typeof cn.noteX === 'number') cn.noteX *= stepRatio;
                    if (typeof cn.noteY === 'number') cn.noteY *= stepRatio;
                }
            }
        }
        state.scoreEndX *= stepRatio;
        state.osmd.zoom = newEffZoom;

        // 3. Scale the cursor element dimensions to match the zoomed staff height
        const currStep = state.cursorSteps[state.currentStepIndex];
        const cursorEl = state.osmd?.cursor?.cursorElement;
        if (cursorEl && currStep) {
            cursorEl.style.height = `${currStep.height.toFixed(1)}px`;
            cursorEl.style.top = `${currStep.y.toFixed(2)}px`;
            const cursorType = getCurrentCursorType();
            if (cursorType === 3 || cursorType === 4) {
                const prevW = parseFloat(cursorEl.style.width) || cursorEl.width || 0;
                if (prevW > 0) {
                    cursorEl.style.width = `${(prevW * stepRatio).toFixed(1)}px`;
                }
            }
        }

        // 4. Refresh lightweight overlay layers & camera alignment
        updateContinuousHorizontalPadding(false);
        renderStaffHighlights();
        renderStaffBarNumbers();
        renderStaffStartPartPointers();
        renderMultiRestSkipPointers();

        const liveTicks = state.isPlaying ? state.smoothTicks : state.currentTicks;
        updateCameraForTicks(liveTicks, 0, true, false);
    }

    // ===========================================
    // FAST OSMD CURSOR MOVEMENT & 60FPS CAMERA
    // ===========================================

    function updateContinuousHorizontalPadding(resetForRender = false) {
        const box = dom.scoreDisplayArea;
        const track = box ? box.querySelector('.osmd-score-track') : null;
        const inner = box ? box.querySelector('.osmd-score-inner') : null;
        if (!box || !track) {
            state.continuousPadX = 0;
            return;
        }

        track.classList.toggle('page-mode', !state.continuousScrollMode);

        if (resetForRender) {
            state.continuousPadX = 0;
            track.style.paddingLeft = '0px';
            track.style.paddingRight = '0px';
            if (inner) inner.style.transform = '';
            return;
        }

        if (!state.continuousScrollMode) {
            // In Page View, reserve left margin on the track so the part name and "This is my part ->" button
            // sit cleanly in front of the first system's staves without overlapping the clef or notes
            const pageLeftPad = window.innerWidth <= 768 ? 148 : 184;
            state.continuousPadX = pageLeftPad;
            track.style.paddingLeft = `${pageLeftPad}px`;
            track.style.paddingRight = '0px';
            if (inner) inner.style.transform = '';
            return;
        }

        const padX = Math.max(188, Math.round(box.clientWidth * CONFIG.CONTINUOUS_CURSOR_ANCHOR_X));
        state.continuousPadX = padX;
        track.style.paddingLeft = `${padX}px`;
        track.style.paddingRight = `${padX}px`;
    }

    function getInterpolatedCursorX(nowTicks) {
        const steps = state.cursorSteps;
        if (!steps.length) return 0;

        const idx = getStepIndexAtTicks(nowTicks);
        const curr = steps[idx];
        if (!curr) return 0;

        const next = steps[idx + 1];
        if (next && next.ticks > curr.ticks && next.x >= curr.x) {
            const frac = Math.max(0, Math.min(1, (nowTicks - curr.ticks) / (next.ticks - curr.ticks)));
            return curr.x + (next.x - curr.x) * frac;
        }

        // Smoothly pan through the final note/bar to the end barline
        if (idx === steps.length - 1 && state.totalMusicalTicks > curr.ticks && state.scoreEndX > curr.x) {
            const frac = Math.max(0, Math.min(1, (nowTicks - curr.ticks) / (state.totalMusicalTicks - curr.ticks)));
            return curr.x + (state.scoreEndX - curr.x) * frac;
        }

        return curr.x;
    }

    function moveCursorToStep(targetIndex) {
        const osmd = state.osmd;
        if (!osmd || !osmd.cursor || !state.cursorSteps.length) return;

        targetIndex = Math.max(0, Math.min(state.cursorSteps.length - 1, targetIndex));
        if (targetIndex === state.currentStepIndex) return;

        const cursor = osmd.cursor;
        const prevStep = state.cursorSteps[state.currentStepIndex];
        const step = state.cursorSteps[targetIndex];
        const cursorType = getCurrentCursorType();
        const isMeasureCursor = cursorType === 3 || cursorType === 4;
        // Only run OSMD's heavy <canvas>.toDataURL() cursor.update() when measure-box cursor is active
        // or when the cursor moves to a system row with a different vertical position or height
        const needsNativeCursorRedraw = isMeasureCursor ||
            !prevStep ||
            !step ||
            Math.abs(step.y - prevStep.y) > 0.5 ||
            Math.abs(step.height - prevStep.height) > 0.5;

        const origUpdate = cursor.update;
        cursor.update = () => { };
        try {
            if (targetIndex > state.currentStepIndex) {
                const delta = targetIndex - state.currentStepIndex;
                for (let i = 0; i < delta && !cursor.Iterator.EndReached; i++) {
                    cursor.next();
                }
            } else {
                cursor.reset();
                for (let i = 0; i < targetIndex && !cursor.Iterator.EndReached; i++) {
                    cursor.next();
                }
            }
        } finally {
            cursor.update = origUpdate;
        }

        if (needsNativeCursorRedraw) {
            cursor.update();
        }

        ensureCursorZIndex();
        state.currentStepIndex = targetIndex;

        // Enforce precomputed stabilized step (x, y) so compactified multi-measure rests and 32nd/64th trills stay smooth
        const cursorEl = cursor.cursorElement;
        if (cursorEl && step) {
            if (!isMeasureCursor) {
                cursorEl.style.left = `${step.x.toFixed(2)}px`;
            }
            cursorEl.style.top = `${step.y.toFixed(2)}px`;
        }

        if (state.isPlaying) {
            highlightStepNotes(targetIndex);
        }
        updateActiveMultiRestSkipVisibility(false);
    }

    function updateCameraForTicks(nowTicks, dt, snap = false, keepViewport = false) {
        const box = dom.scoreDisplayArea;
        const steps = state.cursorSteps;
        if (!box || !steps.length) return;

        const stepIdx = state.isPlaying ? getStepIndexAtTicks(nowTicks) : state.currentStepIndex;
        const curr = steps[stepIdx] || steps[state.currentStepIndex];
        if (!curr) return;

        // Smoothly interpolate playhead X across the score (including across multi-measure rests!) at 60fps+
        const interpX = getInterpolatedCursorX(nowTicks);
        const cursorEl = state.osmd?.cursor?.cursorElement;
        const cursorType = getCurrentCursorType();
        const isMeasureCursor = cursorType === 3 || cursorType === 4;
        if (cursorEl) {
            if (!isMeasureCursor) {
                cursorEl.style.left = `${interpX.toFixed(2)}px`;
            }
            cursorEl.style.top = `${curr.y.toFixed(2)}px`;
        }

        if (state.continuousScrollMode) {

            if (keepViewport) {
                // When clicking a note while paused, keep the score paper stationary under the mouse
                // and mark camera to glide smoothly to center when Play is pressed!
                state.cameraScrollX = box.scrollLeft;
                state.isCameraGliding = true;
                const inner = box.querySelector('.osmd-score-inner');
                if (inner) inner.style.transform = '';
                return;
            }

            const viewportW = box.clientWidth;
            const maxScrollX = Math.max(0, box.scrollWidth - viewportW);
            const anchorOffset = viewportW * CONFIG.CONTINUOUS_CURSOR_ANCHOR_X;
            let desiredX = Math.max(0, Math.min(maxScrollX, (state.continuousPadX + interpX) - anchorOffset));

            // When paused at the very start of the score (ticks === 0), keep the front of the staves,
            // part names, and "This is my part" arrow buttons in view
            if (!state.isPlaying && nowTicks <= 0) {
                const maxStartScroll = Math.max(0, (state.continuousPadX || 0) - 188);
                desiredX = Math.min(desiredX, maxStartScroll);
            }

            if (snap) {
                state.cameraScrollX = desiredX;
                state.isCameraGliding = false;
            } else if (state.isCameraGliding) {
                const diff = desiredX - state.cameraScrollX;
                if (Math.abs(diff) < 0.75) {
                    state.cameraScrollX = desiredX;
                    state.isCameraGliding = false;
                } else {
                    const alpha = 1 - Math.exp(-12 * Math.min(dt, 0.05));
                    state.cameraScrollX += diff * alpha;
                }
            } else {
                state.cameraScrollX = desiredX;
            }

            const intScroll = Math.round(state.cameraScrollX);
            if (box.scrollLeft !== intScroll) {
                box.scrollLeft = intScroll;
            }

            // Sub-pixel GPU transform compensation eliminates 1px integer scrollLeft stepping
            const inner = box.querySelector('.osmd-score-inner');
            if (inner) {
                if (state.isPlaying) {
                    const residual = state.cameraScrollX - box.scrollLeft;
                    inner.style.transform = `translate3d(${-residual.toFixed(3)}px, 0, 0)`;
                } else {
                    inner.style.transform = '';
                }
            }

            // Vertical scroll: ONLY auto-center vertically when a part has Center ('C') selected!
            // When no part is centered ('C'), leave box.scrollTop completely untouched so mobile & desktop
            // users can scroll vertically without ever rubberbanding back to the top.
            if (state.centeredStaffBands && state.centeredStaffBands.length > 0) {
                updateVerticalCenteringForHighlight(snap, dt);
            }
        } else {
            // Page View: if a part has Center ('C') selected, keep the active system's centered staff vertically centered
            if (state.centeredStaffBands && state.centeredStaffBands.length > 0) {
                updateVerticalCenteringForHighlight(snap, dt);
                return;
            }

            // Page View without highlight: only scroll vertically when cursor moves out of visible viewport band
            if (keepViewport) return;
            const viewportH = box.clientHeight;
            const maxScrollY = Math.max(0, box.scrollHeight - viewportH);
            const desiredY = Math.max(0, Math.min(maxScrollY, curr.y - viewportH * CONFIG.PAGE_SCROLL_TOP_ANCHOR));

            if (snap) {
                const isCurrVisible = curr.y >= box.scrollTop + 16 && (curr.y + curr.height) <= (box.scrollTop + viewportH - 16);
                if (!isCurrVisible || state.currentTicks === 0) {
                    box.scrollTop = desiredY;
                }
                state.pageScrollTargetY = null;
            } else if (state.isPlaying) {
                const topLimit = box.scrollTop + viewportH * 0.10;
                const bottomLimit = box.scrollTop + viewportH * 0.78 - curr.height;
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

    /**
     * Computes the exact musical tick of the audio currently leaving the device speaker.
     * Compensates for Tone.js scheduling lookAhead + Web Audio hardware baseLatency/outputLatency
     * so the visual cursor never leads ahead of the sound on mobile or desktop devices.
     */
    function getAudibleTransportTicks() {
        const rawTicks = Math.max(0, Tone.Transport.ticks);
        if (!state.audioInitialized) return rawTicks;

        const ctx = (typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context) || {};
        const rawCtx = ctx.rawContext || ctx._context || ctx;
        const lookAheadSec = typeof ctx.lookAhead === 'number' ? ctx.lookAhead : 0.03;
        const baseLat = typeof rawCtx?.baseLatency === 'number' ? rawCtx.baseLatency : 0.012;
        const outLat = typeof rawCtx?.outputLatency === 'number' ? rawCtx.outputLatency : 0;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
        const hardwareLatSec = outLat > 0
            ? (baseLat + outLat)
            : (baseLat + (isMobile ? 0.065 : 0.018));

        const totalLatencySec = lookAheadSec + hardwareLatSec;
        const liveBpm = getEffectiveBpm();
        const ppq = state.ticksPerWhole / 4;
        const latencyTicks = totalLatencySec * (liveBpm / 60) * ppq;

        const floorTick = state.playbackStartTicks ?? 0;
        return Math.max(floorTick, rawTicks - latencyTicks);
    }

    // ===========================================
    // 60 FPS PLAYBACK LOOP (AUDIO = SOURCE OF TRUTH)
    // ===========================================

    function playbackFrameLoop(timestamp) {
        if (!state.isPlaying) return;

        const dt = state.lastFrameTime
            ? Math.min(0.1, Math.max(0.001, (timestamp - state.lastFrameTime) / 1000))
            : (1 / 60);
        state.lastFrameTime = timestamp;

        // Periodic watchdog (every ~400ms): automatically recover if the OS, another tab,
        // or a USB/Bluetooth audio route transition suspended the AudioContext mid-playback
        if (!state.lastAudioWatchdogTime || (timestamp - state.lastAudioWatchdogTime) > 400) {
            state.lastAudioWatchdogTime = timestamp;
            const rawCtx = getRawAudioContext();
            if (rawCtx && (rawCtx.state === 'suspended' || rawCtx.state === 'interrupted')) {
                keepAudioContextAlive(false);
            } else if (state.audioInitialized && Tone.Transport.state !== 'started') {
                try {
                    Tone.Transport.start(Tone.now());
                } catch (_) { /* ignore */ }
            }
        }

        const rawTicks = Math.max(0, Tone.Transport.ticks);
        const audibleTicks = getAudibleTransportTicks();

        // 1. Handle A-B Bar Loop seamlessly
        if (state.loopEnabled && state.barData.length > 0) {
            const { startTicks, endTicks } = getLoopBoundsTicks();
            if (audibleTicks >= endTicks - 2) {
                jumpTransportWhilePlaying(startTicks);
                state.rafId = requestAnimationFrame(playbackFrameLoop);
                return;
            }
        }

        // 2. Handle End of Piece cleanly: stop and reset cursor back to the beginning
        if (audibleTicks >= state.totalMusicalTicks) {
            stopAtEndOfPiece();
            return;
        }

        state.currentTicks = audibleTicks;

        // 3. Apply mid-score tempo changes if crossing into a bar with a new base BPM
        const currentBar = getBarObjAtTicks(audibleTicks);
        if (currentBar && currentBar.bpm !== state.activeBarBaseBpm) {
            state.activeBarBaseBpm = currentBar.bpm;
            Tone.Transport.bpm.value = getEffectiveBpm();
            updateTempoReadoutUI();
        }

        // 4. Advance high-res floating-point ticks phase-locked to latency-compensated audibleTicks
        // Uses a rate-clamped low-pass PLL so AudioContext buffer-quantum steps never cause micro-stutter
        // on wide 32nd/64th-note or written-out trill bars
        const liveBpm = getEffectiveBpm();
        const ppq = state.ticksPerWhole / 4;
        const ticksPerSec = (liveBpm / 60) * ppq;
        const nominalDelta = dt * ticksPerSec;
        const nextNominalTicks = state.smoothTicks + nominalDelta;

        const drift = audibleTicks - nextNominalTicks;
        if (Math.abs(drift) > ppq * 0.55) {
            state.smoothTicks = audibleTicks;
            state.smoothedTickDrift = 0;
        } else {
            state.smoothedTickDrift = (state.smoothedTickDrift || 0) * 0.85 + drift * 0.15;
            const maxRateAdjust = nominalDelta * 0.12;
            const rateCorrection = Math.max(-maxRateAdjust, Math.min(maxRateAdjust, state.smoothedTickDrift * dt * 4.5));
            state.smoothTicks = nextNominalTicks + rateCorrection;
        }
        state.smoothTicks = Math.max(state.playbackStartTicks ?? 0, Math.min(state.totalMusicalTicks, state.smoothTicks));

        // 5. Advance OSMD step & note highlight on exact audible beat boundaries
        const targetStep = getStepIndexAtTicks(audibleTicks);
        moveCursorToStep(targetStep);

        // 6. Smooth 60fps+ MuseScore-style panning with cursor centered
        updateCameraForTicks(state.smoothTicks, dt, false);

        // 7. Update timeline slider & bar display
        if (!state.isSliderDragging) {
            updateTimelineReadout(audibleTicks);
        }

        state.rafId = requestAnimationFrame(playbackFrameLoop);
    }

    function stopAtEndOfPiece() {
        state.isPlaying = false;
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
        if (state.audioInitialized) {
            Tone.Transport.stop();
        }
        releaseOsAudioFocus();
        const inner = dom.scoreDisplayArea ? dom.scoreDisplayArea.querySelector('.osmd-score-inner') : null;
        if (inner) inner.style.transform = '';
        releaseAllInstruments();
        clearAllNoteHighlights();

        // Reset cursor and viewport back to the beginning of the score
        seekToTicks(0, { snapScroll: true, keepPlaying: false });
        updatePlayPauseButtonUI();
    }

    function jumpTransportWhilePlaying(targetTicks, { glideCamera = false } = {}) {
        if (state.auditionRestoreTimer) {
            window.clearTimeout(state.auditionRestoreTimer);
            state.auditionRestoreTimer = null;
        }

        // 1. Pause transport & silence ringing notes immediately
        Tone.Transport.pause();
        releaseAllInstruments();
        clearAllNoteHighlights();

        const bar = getBarObjAtTicks(targetTicks);
        if (bar) {
            state.activeBarBaseBpm = bar.bpm;
            Tone.Transport.bpm.value = getEffectiveBpm();
            updateTempoReadoutUI();
        }

        // 2. Reuse existing Tone.Part in <0.1ms and complete all cursor/DOM updates BEFORE restarting the audio clock
        ensureTonePartsScheduled();

        state.currentTicks = targetTicks;
        state.smoothTicks = targetTicks;
        state.playbackStartTicks = targetTicks;
        state.smoothedTickDrift = 0;

        const targetStep = getStepIndexAtTicks(targetTicks);
        moveCursorToStep(targetStep);
        highlightStepNotes(targetStep);

        if (glideCamera && state.continuousScrollMode && dom.scoreDisplayArea) {
            state.cameraScrollX = dom.scoreDisplayArea.scrollLeft;
            state.isCameraGliding = true;
            updateCameraForTicks(targetTicks, 1 / 60, false, false);
        } else {
            updateCameraForTicks(targetTicks, 0, true, false);
        }
        updateTimelineReadout(targetTicks);

        // 3. Lock exact tick and restart transport at Tone.now() so zero musical time is lost during the jump
        state.lastFrameTime = performance.now();
        Tone.Transport.ticks = targetTicks;
        Tone.Transport.start(Tone.now());
    }

    // ===========================================
    // PLAY / PAUSE / STOP / SEEK CONTROLS
    // ===========================================

    async function startPlayback() {
        if (!state.scoreLoaded || !state.notes.length) return;
        if (state.isPlaying) return;

        const ready = await ensureAudioReady();
        if (!ready) return;

        // Claim OS Media Audio Focus immediately so background Podcasts, YouTube tabs, or Spotify pause
        claimOsAudioFocus();
        await keepAudioContextAlive(false);

        if (state.auditionRestoreTimer) {
            window.clearTimeout(state.auditionRestoreTimer);
            state.auditionRestoreTimer = null;
        }
        releaseAllInstruments();
        applyAllPartGains(true);

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
        state.smoothTicks = startTicks;
        state.playbackStartTicks = startTicks;
        const startStep = getStepIndexAtTicks(startTicks);
        moveCursorToStep(startStep);

        // If user clicked a note while paused, glide smoothly to center on playback start
        if (state.isCameraGliding && state.continuousScrollMode && dom.scoreDisplayArea) {
            state.cameraScrollX = dom.scoreDisplayArea.scrollLeft;
            updateCameraForTicks(startTicks, 1 / 60, false, false);
        } else {
            updateCameraForTicks(startTicks, 0, true, false);
        }
        updateTimelineReadout(startTicks);

        Tone.Transport.pause();
        ensureTonePartsScheduled();
        highlightStepNotes(state.currentStepIndex);

        state.isPlaying = true;
        state.smoothedTickDrift = 0;
        state.lastFrameTime = performance.now();
        updatePlayPauseButtonUI();

        Tone.Transport.ticks = startTicks;
        Tone.Transport.start(Tone.now());

        if (state.rafId) cancelAnimationFrame(state.rafId);
        state.rafId = requestAnimationFrame(playbackFrameLoop);
    }

    function pausePlayback(updateUI = true) {
        if (!state.isPlaying) return;

        state.currentTicks = Math.max(0, Math.min(state.totalMusicalTicks, Tone.Transport.ticks));
        state.smoothTicks = state.currentTicks;
        state.isPlaying = false;

        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }

        if (state.audioInitialized && Tone.Transport.state === 'started') {
            Tone.Transport.pause();
        }
        releaseOsAudioFocus();

        const inner = dom.scoreDisplayArea ? dom.scoreDisplayArea.querySelector('.osmd-score-inner') : null;
        if (inner) inner.style.transform = '';

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

    function seekToTicks(targetTicks, { snapScroll = true, keepPlaying = state.isPlaying, keepViewport = false, glideCamera = false } = {}) {
        if (!state.scoreLoaded || !state.cursorSteps.length) return;

        const clamped = Math.max(0, Math.min(state.totalMusicalTicks, Math.round(targetTicks)));
        const targetStep = getStepIndexAtTicks(clamped);
        const snappedTicks = state.cursorSteps[targetStep]?.ticks ?? clamped;

        if (keepPlaying && state.isPlaying) {
            jumpTransportWhilePlaying(snappedTicks, { glideCamera });
            return;
        }

        state.currentTicks = snappedTicks;
        state.smoothTicks = snappedTicks;
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
        updateCameraForTicks(snappedTicks, 0, snapScroll, keepViewport);
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

    function setElHidden(el, isHidden) {
        if (!el) return;
        const hide = Boolean(isHidden);
        el.hidden = hide;
        el.style.display = hide ? 'none' : '';
        if (hide) {
            el.setAttribute('hidden', '');
        } else {
            el.removeAttribute('hidden');
        }
    }

    function updatePlayPauseButtonUI() {
        const btn = dom.playPauseButton;
        if (!btn) return;

        const playIcon = btn.querySelector('.icon-play');
        const pauseIcon = btn.querySelector('.icon-pause');
        const spinner = dom.audioLoadingSpinner;

        btn.disabled = !state.scoreLoaded || !state.notes.length || state.isLoadingAudio;
        btn.classList.toggle('playing', Boolean(state.isPlaying && !state.isLoadingAudio));
        btn.classList.toggle('loading', Boolean(state.isLoadingAudio));

        if (state.isLoadingAudio) {
            setElHidden(playIcon, true);
            setElHidden(pauseIcon, true);
            setElHidden(spinner, false);
            btn.title = 'Loading instrument samples…';
            btn.setAttribute('aria-label', 'Loading audio');
            btn.setAttribute('aria-pressed', 'false');
        } else if (state.isPlaying) {
            setElHidden(playIcon, true);
            setElHidden(pauseIcon, false);
            setElHidden(spinner, true);
            btn.title = 'Pause (Space)';
            btn.setAttribute('aria-label', 'Pause');
            btn.setAttribute('aria-pressed', 'true');
        } else {
            setElHidden(playIcon, false);
            setElHidden(pauseIcon, true);
            setElHidden(spinner, true);
            btn.title = 'Play (Space)';
            btn.setAttribute('aria-label', 'Play');
            btn.setAttribute('aria-pressed', 'false');
        }

        // Sync floating score-viewport Play/Pause button
        if (dom.viewportFloatingPlayBtn) {
            dom.viewportFloatingPlayBtn.disabled = btn.disabled;
            dom.viewportFloatingPlayBtn.classList.toggle('playing', Boolean(state.isPlaying));
            const fPlay = dom.viewportFloatingPlayBtn.querySelector('.icon-play');
            const fPause = dom.viewportFloatingPlayBtn.querySelector('.icon-pause');
            setElHidden(fPlay, state.isPlaying);
            setElHidden(fPause, !state.isPlaying);
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
        if (dom.viewportFloatingHud) {
            dom.viewportFloatingHud.hidden = !enabled && !state.viewportFullscreen;
        }
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
        const isModified = partList.some(
            (p) =>
                p.muted ||
                p.soloed ||
                p.highlighted ||
                p.centered ||
                Boolean(p.hidden) !== Boolean(p.defaultHidden) ||
                p.volume !== CONFIG.DEFAULT_PART_VOLUME ||
                (p.detectedPatchId && p.patchId !== p.detectedPatchId)
        );
        dom.resetMixerBtn.hidden = !isModified;
    }

    /**
     * Collects the vertical staff bands `{ leftPx, topPx, widthPx, heightPx, centerY }`
     * for any visible parts matching `targetPartIds`.
     */
    function collectStaffBandsForPartIds(targetPartIds) {
        const bands = [];
        if (!state.scoreLoaded || !state.osmd || !targetPartIds || targetPartIds.size === 0) {
            return bands;
        }

        const osmd = state.osmd;
        const unitToPx = 10 * getEffectiveOsmdZoom();

        const staffToPartId = new Map();
        const staffIndexToPartId = [];
        if (osmd.sheet?.Instruments) {
            osmd.sheet.Instruments.forEach((inst, instIdx) => {
                const pid = inst.IdString || `part_${inst.Id ?? instIdx}`;
                const isVisible = inst.Visible !== false;
                if (Array.isArray(inst.Staves) && inst.Staves.length > 0) {
                    for (const st of inst.Staves) {
                        staffToPartId.set(st, pid);
                        if (isVisible) {
                            staffIndexToPartId.push(pid);
                        }
                    }
                } else if (isVisible) {
                    staffIndexToPartId.push(pid);
                }
            });
        }

        const pages = osmd.GraphicSheet?.MusicPages;
        if (Array.isArray(pages)) {
            for (const page of pages) {
                const systems = page?.MusicSystems;
                if (!Array.isArray(systems)) continue;
                for (const system of systems) {
                    const staffLines = system?.StaffLines;
                    if (!Array.isArray(staffLines)) continue;
                    for (let sIdx = 0; sIdx < staffLines.length; sIdx++) {
                        const sl = staffLines[sIdx];
                        if (!sl || !sl.PositionAndShape) continue;

                        const parentInst = sl.ParentStaff?.ParentInstrument;
                        const partId = staffToPartId.get(sl.ParentStaff) ||
                            (parentInst ? (parentInst.IdString || `part_${parentInst.Id ?? 0}`) : null) ||
                            staffIndexToPartId[sIdx];

                        if (!partId || !targetPartIds.has(partId)) continue;

                        const absPos = sl.PositionAndShape.AbsolutePosition;
                        const size = sl.PositionAndShape.Size;
                        if (!absPos || !size || !(size.width > 0)) continue;

                        const padTopUnits = 1.35;
                        const padBottomUnits = 1.35;
                        const padXUnits = 0.6;
                        const staffHeightUnits = size.height > 0 ? size.height : 4.0;

                        const leftPx = Math.max(0, (absPos.x - padXUnits) * unitToPx);
                        const topPx = Math.max(0, (absPos.y - padTopUnits) * unitToPx);
                        const widthPx = (size.width + padXUnits * 2) * unitToPx;
                        const heightPx = (staffHeightUnits + padTopUnits + padBottomUnits) * unitToPx;

                        bands.push({
                            leftPx,
                            topPx,
                            widthPx,
                            heightPx,
                            centerY: topPx + heightPx * 0.5,
                        });
                    }
                }
            }
        }

        // Fallback via MeasureList if MusicSystems.StaffLines was unavailable
        if (bands.length === 0 && Array.isArray(osmd.GraphicSheet?.MeasureList)) {
            const mList = osmd.GraphicSheet.MeasureList;
            const rowBounds = new Map();
            for (let mIdx = 0; mIdx < mList.length; mIdx++) {
                const col = mList[mIdx];
                if (!Array.isArray(col)) continue;
                for (let sIdx = 0; sIdx < col.length; sIdx++) {
                    const partId = staffIndexToPartId[sIdx];
                    if (!partId || !targetPartIds.has(partId)) continue;
                    const gm = col[sIdx];
                    const absPos = gm?.PositionAndShape?.AbsolutePosition;
                    const size = gm?.PositionAndShape?.Size;
                    if (!absPos || !size) continue;
                    const key = `${sIdx}_${Math.round(absPos.y * 2)}`;
                    const right = absPos.x + size.width;
                    const existing = rowBounds.get(key);
                    if (!existing) {
                        rowBounds.set(key, { minX: absPos.x, maxX: right, y: absPos.y, h: size.height || 4.0 });
                    } else {
                        existing.minX = Math.min(existing.minX, absPos.x);
                        existing.maxX = Math.max(existing.maxX, right);
                    }
                }
            }
            for (const b of rowBounds.values()) {
                const leftPx = Math.max(0, (b.minX - 0.6) * unitToPx);
                const topPx = Math.max(0, (b.y - 1.35) * unitToPx);
                const widthPx = (b.maxX - b.minX + 1.2) * unitToPx;
                const heightPx = (b.h + 2.7) * unitToPx;
                bands.push({
                    leftPx,
                    topPx,
                    widthPx,
                    heightPx,
                    centerY: topPx + heightPx * 0.5,
                });
            }
        }

        return bands;
    }

    /**
     * Updates vertical centering bands for any part that has the 'C' (Center) button active.
     */
    function updateCenteredStaffBands(snap = true) {
        const centeredPartIds = new Set(
            Object.values(state.parts)
                .filter((p) => p.centered && !p.hidden)
                .map((p) => p.id)
        );
        state.centeredStaffBands = collectStaffBandsForPartIds(centeredPartIds);
        updateVerticalCenteringForHighlight(snap);
    }

    /**
     * Renders a bright yellow marker highlight across the staff (or staves) of any highlighted ('H') part.
     * Note: Highlight ('H') does NOT vertically center the staff; the separate 'C' button controls vertical centering.
     */
    function renderStaffHighlights() {
        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        let layer = inner.querySelector('.staff-highlight-layer');
        const highlightedPartIds = new Set(
            Object.values(state.parts)
                .filter((p) => p.highlighted && !p.hidden)
                .map((p) => p.id)
        );

        state.highlightedStaffBands = collectStaffBandsForPartIds(highlightedPartIds);

        if (!state.scoreLoaded || !state.osmd || state.highlightedStaffBands.length === 0) {
            if (layer) layer.remove();
            updateCenteredStaffBands(true);
            return;
        }

        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'staff-highlight-layer';
            inner.insertBefore(layer, inner.firstChild);
        } else {
            layer.innerHTML = '';
        }

        const frag = document.createDocumentFragment();
        for (const b of state.highlightedStaffBands) {
            const band = document.createElement('div');
            band.className = 'staff-marker-band';
            band.style.left = `${b.leftPx.toFixed(1)}px`;
            band.style.top = `${b.topPx.toFixed(1)}px`;
            band.style.width = `${b.widthPx.toFixed(1)}px`;
            band.style.height = `${b.heightPx.toFixed(1)}px`;
            frag.appendChild(band);
        }

        layer.appendChild(frag);
        updateCenteredStaffBands(true);
    }

    /**
     * Renders clear bar numbers above EVERY visible staff on every measure
     * so the bar number is always visible on all staves.
     */
    function renderStaffBarNumbers() {
        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        let layer = inner.querySelector('.staff-bar-numbers-layer');
        if (!state.scoreLoaded || !state.osmd) {
            if (layer) layer.remove();
            return;
        }

        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'staff-bar-numbers-layer';
            inner.appendChild(layer);
        } else {
            layer.innerHTML = '';
        }

        const osmd = state.osmd;
        const mList = osmd.GraphicSheet?.MeasureList;
        if (!Array.isArray(mList) || mList.length === 0) return;

        const effZoom = getEffectiveOsmdZoom();
        const unitToPx = 10 * effZoom;
        const fontSizePx = Math.max(9, Math.round(11.5 * effZoom));
        const frag = document.createDocumentFragment();

        for (let mIdx = 0; mIdx < mList.length; mIdx++) {
            const col = mList[mIdx];
            if (!Array.isArray(col)) continue;

            const rawBarNum = state.barData[mIdx]?.barNumber ??
                osmd.sheet?.SourceMeasures?.[mIdx]?.MeasureNumber ??
                (mIdx + 1);

            for (let sIdx = 0; sIdx < col.length; sIdx++) {
                const gm = col[sIdx];
                if (!gm || gm.isReducedToMultiRest) continue;
                const absPos = gm.PositionAndShape?.AbsolutePosition;
                const size = gm.PositionAndShape?.Size;
                if (!absPos || !size || !(size.width > 0.01) || typeof absPos.x !== 'number' || typeof absPos.y !== 'number') continue;
                if (mIdx > 0 && absPos.x <= 0.01) continue;

                const leftPx = Math.max(2, (absPos.x + 0.15) * unitToPx);
                const topPx = Math.max(1, (absPos.y - 1.85) * unitToPx);

                const badge = document.createElement('span');
                badge.className = 'staff-bar-number';
                badge.textContent = String(rawBarNum);
                badge.style.left = `${leftPx.toFixed(1)}px`;
                badge.style.top = `${topPx.toFixed(1)}px`;
                badge.style.fontSize = `${fontSizePx}px`;
                frag.appendChild(badge);
            }
        }

        layer.appendChild(frag);
    }

    /**
     * Renders an interactive "Click to skip ahead ↓" arrow badge above the count-in bar
     * at the end of every compactified multi-measure rest so users know they can click
     * that bar (or the arrow badge itself) to skip straight to the bar before the entry.
     */
    function renderMultiRestSkipPointers() {
        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        let layer = inner.querySelector('.multirest-skip-layer');
        if (!state.scoreLoaded || !state.osmd) {
            if (layer) layer.remove();
            return;
        }

        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'multirest-skip-layer';
            inner.appendChild(layer);
        } else {
            layer.innerHTML = '';
        }

        const osmd = state.osmd;
        const mList = osmd.GraphicSheet?.MeasureList;
        if (!Array.isArray(mList) || mList.length === 0) return;

        const effZoom = getEffectiveOsmdZoom();
        const unitToPx = 10 * effZoom;

        // Map visible staff index -> partId so we can place the badge on the top visible staff
        // plus any currently highlighted ('H') or centered ('C') part's staff
        const staffIndexToPartId = [];
        if (osmd.sheet?.Instruments) {
            osmd.sheet.Instruments.forEach((inst, instIdx) => {
                const pid = inst.IdString || `part_${inst.Id ?? instIdx}`;
                if (inst.Visible === false) return;
                if (Array.isArray(inst.Staves) && inst.Staves.length > 0) {
                    for (let i = 0; i < inst.Staves.length; i++) {
                        staffIndexToPartId.push(pid);
                    }
                } else {
                    staffIndexToPartId.push(pid);
                }
            });
        }

        const targetStaffIndices = new Set([0]);
        for (let sIdx = 0; sIdx < staffIndexToPartId.length; sIdx++) {
            const pid = staffIndexToPartId[sIdx];
            const p = state.parts[pid];
            if (p && !p.hidden && (p.highlighted || p.centered)) {
                targetStaffIndices.add(sIdx);
            }
        }

        const frag = document.createDocumentFragment();

        for (let mIdx = 0; mIdx < mList.length; mIdx++) {
            const col = mList[mIdx];
            if (!Array.isArray(col)) continue;

            let multiRestCount = osmd.sheet?.SourceMeasures?.[mIdx]?.multipleRestMeasures || 0;
            let hasVisibleHead = false;
            for (let sIdx = 0; sIdx < col.length; sIdx++) {
                const gm = col[sIdx];
                if (!gm || gm.isReducedToMultiRest) continue;
                hasVisibleHead = true;
                if (gm.multipleRestMeasures > multiRestCount) {
                    multiRestCount = gm.multipleRestMeasures;
                }
            }

            if (!hasVisibleHead || multiRestCount <= 1) continue;

            // The -1 bar right at the end of the multi-measure rest (the 1-bar count-in rest before notes resume)
            const targetMeasureIdx = mIdx + multiRestCount;
            if (targetMeasureIdx >= mList.length) continue;

            const targetCol = mList[targetMeasureIdx];
            const targetBar = state.barData[targetMeasureIdx];
            if (!Array.isArray(targetCol) || !targetBar) continue;

            // Find the exact cursor X and tick of Beat 1 (the beginning) of the -1 bar
            const firstBeatStepIdx = getStepIndexAtTicks(targetBar.startTicks);
            const firstBeatStep = state.cursorSteps[firstBeatStepIdx];
            const firstBeatTicks = (firstBeatStep && firstBeatStep.measureIndex === targetMeasureIdx)
                ? firstBeatStep.ticks
                : targetBar.startTicks;

            for (const sIdx of targetStaffIndices) {
                const targetGm = targetCol[sIdx];
                if (!targetGm || targetGm.isReducedToMultiRest) continue;

                const absPos = targetGm.PositionAndShape?.AbsolutePosition;
                const size = targetGm.PositionAndShape?.Size;
                if (!absPos || !size || !(size.width > 0.01) || typeof absPos.x !== 'number' || typeof absPos.y !== 'number') continue;

                const barLeftPx = absPos.x * unitToPx;
                const insetLeft = Math.min((size.width * unitToPx) * 0.12, 14 * effZoom);
                const firstBeatX = (firstBeatStep && firstBeatStep.measureIndex === targetMeasureIdx && firstBeatStep.x >= barLeftPx - 4)
                    ? firstBeatStep.x
                    : (barLeftPx + insetLeft);
                const anchorY = Math.max(14, (absPos.y - 0.7) * unitToPx);

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'multirest-skip-btn';
                btn.dataset.restStartMeasure = String(mIdx);
                btn.dataset.restEndMeasure = String(mIdx + multiRestCount - 1);
                btn.hidden = true;
                btn.title = `Skip ${multiRestCount}-bar rest directly to beat 1 of Bar ${targetBar.barNumber}`;
                btn.style.left = `${firstBeatX.toFixed(1)}px`;
                btn.style.top = `${anchorY.toFixed(1)}px`;

                btn.innerHTML = `
                    <span class="skip-rest-text">Click to skip ahead</span>
                    <svg class="skip-rest-arrow" viewBox="0 0 14 16" width="11" height="12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <line x1="7" y1="1.5" x2="7" y2="13.5"></line>
                        <polyline points="2.5 9.5 7 14 11.5 9.5"></polyline>
                    </svg>
                `;

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    btn.hidden = true;
                    // If A-B Loop is active and targetBar is outside loop range, shift loop range
                    if (state.loopEnabled && state.barData.length > 0) {
                        const { startTicks: loopStart, endTicks: loopEnd } = getLoopBoundsTicks();
                        if (firstBeatTicks < loopStart || firstBeatTicks >= loopEnd) {
                            const span = Math.max(0, state.loopEndBar - state.loopStartBar);
                            state.loopStartBar = targetBar.barNumber;
                            state.loopEndBar = Math.min(state.barData.length, targetBar.barNumber + span);
                            syncLoopInputsUI();
                        }
                    }

                    if (state.isPlaying) {
                        seekToTicks(firstBeatTicks, { snapScroll: false, keepPlaying: true, glideCamera: true });
                    } else {
                        seekToTicks(firstBeatTicks, { snapScroll: false, keepPlaying: false, keepViewport: true });
                    }
                    updateActiveMultiRestSkipVisibility(true);
                    toast(`Skipped multi-bar rest to Bar ${targetBar.barNumber}`);
                });

                frag.appendChild(btn);
            }
        }

        layer.appendChild(frag);
        updateActiveMultiRestSkipVisibility(true);
    }

    /**
     * Shows the "Click to skip ahead ↓" badge ONLY while the cursor is inside that multi-measure rest,
     * and hides it immediately when the cursor exits the multi-measure rest or when the badge is clicked.
     */
    function updateActiveMultiRestSkipVisibility(force = false) {
        const box = dom.scoreDisplayArea;
        if (!box || !state.scoreLoaded || !state.cursorSteps.length) return;

        const currStep = state.cursorSteps[state.currentStepIndex] || state.cursorSteps[0];
        const currMeasureIdx = currStep ? currStep.measureIndex : -1;
        if (!force && state.lastSkipBadgeMeasureIdx === currMeasureIdx) return;
        state.lastSkipBadgeMeasureIdx = currMeasureIdx;

        const layer = box.querySelector('.multirest-skip-layer');
        if (!layer) return;

        const buttons = layer.querySelectorAll('.multirest-skip-btn');
        buttons.forEach((btn) => {
            const startM = parseInt(btn.dataset.restStartMeasure, 10);
            const endM = parseInt(btn.dataset.restEndMeasure, 10);
            const isCursorInsideRest = currMeasureIdx >= startM && currMeasureIdx <= endM;
            btn.hidden = !isCursorInsideRest;
        });
    }

    /**
     * Toggles Highlight ('H') for a given partId:
     * - Marks the part's staff in yellow, sets its volume to 100% and other parts to 70%.
     * - Shared by the Part Mixer 'H' button and the "This is my part" arrow button in front of each staff.
     */
    function togglePartHighlight(partId) {
        const part = state.parts[partId];
        if (!part) return;

        const willHighlight = !part.highlighted;
        for (const p of Object.values(state.parts)) {
            if (willHighlight) {
                if (p.id === part.id) {
                    p.highlighted = true;
                    p.muted = false;
                    p.volume = CONFIG.HIGHLIGHT_MAIN_VOLUME;
                } else {
                    p.highlighted = false;
                    p.soloed = false;
                    p.volume = CONFIG.HIGHLIGHT_OTHER_VOLUME;
                }
            } else {
                p.highlighted = false;
                p.volume = CONFIG.DEFAULT_PART_VOLUME;
            }
        }
        renderPartMixerUI();
        renderStaffHighlights();
        renderStaffStartPartPointers();
        renderMultiRestSkipPointers();
        refreshActiveNoteHighlightColors();
        applyAllPartGains(false);
        if (willHighlight) {
            toast(`Highlighted ${part.name} (${CONFIG.HIGHLIGHT_MAIN_VOLUME}% volume, other parts ${CONFIG.HIGHLIGHT_OTHER_VOLUME}%)`);
        }
    }

    /**
     * Renders an interactive "This is my part" arrow button in front of each visible part's staff
     * at the beginning of the score so users can highlight their part directly on the sheet music.
     */
    function renderStaffStartPartPointers() {
        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        let layer = inner.querySelector('.staff-part-pointers-layer');
        if (!state.scoreLoaded || !state.osmd) {
            if (layer) layer.remove();
            return;
        }

        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'staff-part-pointers-layer';
            inner.appendChild(layer);
        } else {
            layer.innerHTML = '';
        }

        const osmd = state.osmd;
        const effZoom = getEffectiveOsmdZoom();
        const unitToPx = 10 * effZoom;

        const staffToPartId = new Map();
        const staffIndexToPartId = [];
        if (osmd.sheet?.Instruments) {
            osmd.sheet.Instruments.forEach((inst, instIdx) => {
                const pid = inst.IdString || `part_${inst.Id ?? instIdx}`;
                const isVisible = inst.Visible !== false;
                if (Array.isArray(inst.Staves) && inst.Staves.length > 0) {
                    for (const st of inst.Staves) {
                        staffToPartId.set(st, pid);
                        if (isVisible) {
                            staffIndexToPartId.push(pid);
                        }
                    }
                } else if (isVisible) {
                    staffIndexToPartId.push(pid);
                }
            });
        }

        const entries = [];
        const seenPartIds = new Set();
        const firstSystem = osmd.GraphicSheet?.MusicPages?.[0]?.MusicSystems?.[0];

        const fiveLineStaffUnits = (typeof osmd.EngravingRules?.StaffHeight === 'number' && osmd.EngravingRules.StaffHeight > 0)
            ? osmd.EngravingRules.StaffHeight
            : 4.0;

        if (firstSystem && Array.isArray(firstSystem.StaffLines) && firstSystem.StaffLines.length > 0) {
            for (let sIdx = 0; sIdx < firstSystem.StaffLines.length; sIdx++) {
                const sl = firstSystem.StaffLines[sIdx];
                if (!sl || !sl.PositionAndShape) continue;

                const parentInst = sl.ParentStaff?.ParentInstrument;
                const partId = staffToPartId.get(sl.ParentStaff) ||
                    (parentInst ? (parentInst.IdString || `part_${parentInst.Id ?? 0}`) : null) ||
                    staffIndexToPartId[sIdx];

                if (!partId || seenPartIds.has(partId)) continue;
                const part = state.parts[partId];
                if (!part || part.hidden) continue;

                const absPos = sl.PositionAndShape.AbsolutePosition;
                if (!absPos || typeof absPos.x !== 'number' || typeof absPos.y !== 'number') continue;

                // Use the actual 5-line staff height (4.0 units from top line to bottom line),
                // NOT size.height (which includes bottom lyrics, dynamics, and inter-staff whitespace)
                const linesArr = sl.StaffLines;
                const lineSpanUnits = (Array.isArray(linesArr) && linesArr.length >= 5 && typeof linesArr[4]?.Position?.y === 'number' && linesArr[4].Position.y > 0)
                    ? linesArr[4].Position.y
                    : fiveLineStaffUnits;

                seenPartIds.add(partId);
                entries.push({
                    part,
                    staffStartX: absPos.x * unitToPx,
                    staffTopY: absPos.y * unitToPx,
                    staffHeightPx: lineSpanUnits * unitToPx,
                });
            }
        } else if (Array.isArray(osmd.GraphicSheet?.MeasureList?.[0])) {
            const firstCol = osmd.GraphicSheet.MeasureList[0];
            for (let sIdx = 0; sIdx < firstCol.length; sIdx++) {
                const gm = firstCol[sIdx];
                const partId = staffIndexToPartId[sIdx];
                if (!gm || !partId || seenPartIds.has(partId)) continue;
                const part = state.parts[partId];
                if (!part || part.hidden) continue;

                const absPos = gm.PositionAndShape?.AbsolutePosition;
                if (!absPos || typeof absPos.x !== 'number' || typeof absPos.y !== 'number') continue;

                seenPartIds.add(partId);
                entries.push({
                    part,
                    staffStartX: absPos.x * unitToPx,
                    staffTopY: absPos.y * unitToPx,
                    staffHeightPx: fiveLineStaffUnits * unitToPx,
                });
            }
        }

        if (entries.length === 0) return;

        const frag = document.createDocumentFragment();
        const padLeft = state.continuousPadX || 0;
        const minRightAnchorX = Math.max(4, 180 - padLeft);

        for (const item of entries) {
            const { part, staffStartX, staffTopY, staffHeightPx } = item;
            const isHighlighted = Boolean(part.highlighted);

            // Position right in front of the beginning of the staff, vertically centered on the 5-line staff
            const rightAnchorX = Math.max(minRightAnchorX, staffStartX - 6 * effZoom);
            const centerAnchorY = staffTopY + staffHeightPx * 0.5;

            const group = document.createElement('div');
            group.className = `staff-start-part-group${isHighlighted ? ' active' : ''}`;
            group.style.left = `${rightAnchorX.toFixed(1)}px`;
            group.style.top = `${centerAnchorY.toFixed(1)}px`;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'staff-start-part-name';
            nameSpan.textContent = part.name;
            nameSpan.title = part.name;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `staff-my-part-btn${isHighlighted ? ' active' : ''}`;
            btn.title = isHighlighted
                ? `${part.name} is highlighted — click to remove highlight`
                : `Highlight ${part.name} ("This is my part")`;
            btn.setAttribute('aria-pressed', String(isHighlighted));

            btn.innerHTML = `
                <span class="my-part-text">${isHighlighted ? 'My part' : 'This is my part'}</span>
                <svg class="my-part-arrow" viewBox="0 0 18 14" width="13" height="11" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="1" y1="7" x2="15" y2="7"></line>
                    <polyline points="10 2 15.5 7 10 12"></polyline>
                </svg>
            `;

            const handleToggle = (e) => {
                e.stopPropagation();
                togglePartHighlight(part.id);
            };
            btn.addEventListener('click', handleToggle);
            nameSpan.addEventListener('click', handleToggle);

            group.appendChild(nameSpan);
            group.appendChild(btn);
            frag.appendChild(group);
        }

        layer.appendChild(frag);
    }

    /**
     * Vertically centers the score in the viewport:
     * - When a part has Center ('C') selected: centers that part's staff in the exact vertical middle.
     * - Standard (no part has 'C' selected, even if a part is highlighted with 'H'): centers the whole score
     *   vertically in the viewport (using top padding when the score fits inside the viewport, or initial centered
     *   scrollTop when taller than the viewport, without rubberbanding during playback or manual mobile scrolling).
     */
    function updateVerticalCenteringForHighlight(snap = true, dt = 1 / 60, allowStandardScrollReset = true) {
        const box = dom.scoreDisplayArea;
        const track = box ? box.querySelector('.osmd-score-track') : null;
        const inner = box ? box.querySelector('.osmd-score-inner') : null;
        if (!box || !track) return;

        const viewportH = box.clientHeight;
        if (viewportH <= 0) return;
        const halfH = viewportH * 0.5;
        const innerH = inner ? inner.offsetHeight : box.scrollHeight;

        const bands = state.centeredStaffBands;
        if (!bands || bands.length === 0) {
            track.style.paddingBottom = '0px';

            // Standard un-centered vertical layout
            if (!state.continuousScrollMode && innerH > viewportH) {
                track.style.paddingTop = '0px';
                return;
            }

            const firstStep = state.cursorSteps[0];
            const systemCenterY = (state.continuousScrollMode && firstStep && firstStep.height > 0)
                ? (firstStep.y + firstStep.height * 0.5)
                : (innerH * 0.5);

            if (innerH <= viewportH) {
                // Score fits vertically in viewport: center via top padding without causing vertical overflow
                const maxPadWithoutOverflow = Math.max(0, viewportH - innerH);
                const idealPadTop = Math.max(0, Math.round(halfH - systemCenterY));
                const padTop = Math.min(maxPadWithoutOverflow, idealPadTop);
                if (track.style.paddingTop !== `${padTop}px`) {
                    track.style.paddingTop = `${padTop}px`;
                }
            } else {
                // Score is taller than viewport (e.g. mobile or large ensemble): center initial scrollTop once,
                // then leave scrollTop untouched so the user can freely scroll without rubberbanding
                if (track.style.paddingTop !== '0px') {
                    track.style.paddingTop = '0px';
                }
                if (snap && allowStandardScrollReset) {
                    const maxScrollY = Math.max(0, innerH - viewportH);
                    box.scrollTop = Math.max(0, Math.min(maxScrollY, Math.round(systemCenterY - halfH)));
                }
            }
            return;
        }

        // Centered part ('C'): pick the centered staff band on the active system
        const currStep = state.cursorSteps[state.currentStepIndex];
        let targetBand = bands[0];
        if (currStep && bands.length > 1) {
            const currMidY = currStep.y + currStep.height * 0.5;
            let bestDist = Infinity;
            for (const b of bands) {
                const dist = Math.abs(b.centerY - currMidY);
                if (dist < bestDist) {
                    bestDist = dist;
                    targetBand = b;
                }
            }
        }

        const bandCenterY = targetBand.centerY;

        const padTop = Math.max(0, Math.round(halfH - bandCenterY));
        const padBottom = Math.max(0, Math.round(halfH - Math.max(0, innerH - bandCenterY)));

        if (track.style.paddingTop !== `${padTop}px`) {
            track.style.paddingTop = `${padTop}px`;
        }
        if (track.style.paddingBottom !== `${padBottom}px`) {
            track.style.paddingBottom = `${padBottom}px`;
        }

        const maxScrollY = Math.max(0, box.scrollHeight - viewportH);
        const desiredY = Math.max(0, Math.min(maxScrollY, Math.round((padTop + bandCenterY) - halfH)));

        if (snap) {
            box.scrollTop = desiredY;
        } else {
            const diffY = desiredY - box.scrollTop;
            if (Math.abs(diffY) <= 1) {
                box.scrollTop = desiredY;
            } else {
                const alphaY = 1 - Math.exp(-12 * Math.min(dt, 0.05));
                box.scrollTop = box.scrollTop + diffY * alphaY;
            }
        }
    }

    function syncGlobalSoundSelectUI() {
        if (!dom.soundSelect) return;
        const partList = Object.values(state.parts);
        if (!partList.length) {
            dom.soundSelect.value = INSTRUMENT_CATALOG[state.soundPreset] ? state.soundPreset : 'piano';
            return;
        }
        const firstPatch = partList[0].patchId || 'piano';
        const allSame = partList.every((p) => (p.patchId || 'piano') === firstPatch);
        if (allSame && INSTRUMENT_CATALOG[firstPatch]) {
            state.soundPreset = firstPatch;
            dom.soundSelect.value = firstPatch;
        } else {
            state.soundPreset = 'custom';
            dom.soundSelect.value = 'custom';
        }
    }

    function buildPartInstrumentSelect(part) {
        const select = document.createElement('select');
        select.className = 'part-instrument-select';
        select.title = `Select playback instrument for ${part.name}`;
        select.setAttribute('aria-label', `${part.name} Instrument`);

        for (const def of Object.values(INSTRUMENT_CATALOG)) {
            const opt = document.createElement('option');
            opt.value = def.id;
            opt.textContent = def.label;
            select.appendChild(opt);
        }

        select.value = INSTRUMENT_CATALOG[part.patchId] ? part.patchId : 'piano';

        select.addEventListener('change', () => {
            const chosenPatch = select.value;
            setPartInstrument(part.id, chosenPatch, true);
            syncGlobalSoundSelectUI();
        });

        return select;
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
            wrapper.innerHTML = '<span class="mixer-empty-hint">Load a score to mix individual parts &amp; select classical instruments.</span>';
            updateResetMixerVisibility();
            return;
        }

        const frag = document.createDocumentFragment();

        for (const part of partList) {
            const card = document.createElement('div');
            card.className = 'part-control-entry';
            if (part.muted) card.classList.add('is-muted');
            if (part.soloed) card.classList.add('is-soloed');
            if (part.highlighted) card.classList.add('is-highlighted');
            if (part.hidden) card.classList.add('is-hidden-part');

            // Row 1: Part Name + Vocal/Score Tag + Mute / Solo / Highlight / Visibility (Eye) Buttons
            const headerRow = document.createElement('div');
            headerRow.className = 'part-header-row';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'part-title-wrap';

            const label = document.createElement('span');
            label.className = 'part-label';
            label.textContent = part.name;
            label.title = part.name;
            titleWrap.appendChild(label);

            if (part.isVocal) {
                const roleTag = document.createElement('span');
                roleTag.className = 'part-role-tag';
                roleTag.textContent = 'Vocal';
                roleTag.title = 'Singing voice automatically assigned to Grand Piano';
                titleWrap.appendChild(roleTag);
            }

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

            const highlightBtn = document.createElement('button');
            highlightBtn.className = `part-button highlight-btn${part.highlighted ? ' active' : ''}`;
            highlightBtn.textContent = 'H';
            highlightBtn.title = `Highlight ${part.name} (Yellow staff marker, ${CONFIG.HIGHLIGHT_MAIN_VOLUME}% volume, other parts ${CONFIG.HIGHLIGHT_OTHER_VOLUME}%)`;
            highlightBtn.setAttribute('aria-pressed', String(Boolean(part.highlighted)));
            highlightBtn.addEventListener('click', () => {
                togglePartHighlight(part.id);
            });

            const centerBtn = document.createElement('button');
            centerBtn.className = `part-button center-btn${part.centered ? ' active' : ''}`;
            centerBtn.textContent = 'C';
            centerBtn.title = `Center ${part.name} staff vertically in the viewport`;
            centerBtn.setAttribute('aria-pressed', String(Boolean(part.centered)));
            centerBtn.addEventListener('click', () => {
                const willCenter = !part.centered;
                for (const p of Object.values(state.parts)) {
                    p.centered = willCenter && p.id === part.id;
                }
                if (willCenter && part.hidden) {
                    part.hidden = false;
                    renderPartMixerUI();
                    toast(`Centered & showing ${part.name} staff`);
                    if (state.pendingVisibilityRaf) {
                        cancelAnimationFrame(state.pendingVisibilityRaf);
                    }
                    state.pendingVisibilityRaf = requestAnimationFrame(() => {
                        state.pendingVisibilityRaf = null;
                        reRenderScorePreservingState();
                    });
                    return;
                }
                renderPartMixerUI();
                updateCenteredStaffBands(true);
                renderMultiRestSkipPointers();
                if (willCenter) {
                    toast(`Centered ${part.name} staff vertically`);
                }
            });

            const visibilityBtn = document.createElement('button');
            visibilityBtn.className = `part-button visibility-btn${part.hidden ? ' is-hidden' : ''}`;
            visibilityBtn.title = part.hidden ? `Show ${part.name} in score` : `Hide ${part.name} from score`;
            visibilityBtn.setAttribute('aria-label', part.hidden ? `Show ${part.name} in score` : `Hide ${part.name} from score`);
            visibilityBtn.setAttribute('aria-pressed', String(Boolean(part.hidden)));
            visibilityBtn.innerHTML = part.hidden
                ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
                : `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            visibilityBtn.addEventListener('click', () => {
                if (!part.hidden) {
                    const visibleCount = Object.values(state.parts).filter((p) => !p.hidden).length;
                    if (visibleCount <= 1) {
                        toast('At least one part must remain visible in the score', 'info');
                        return;
                    }
                }
                part.hidden = !part.hidden;
                if (part.hidden && part.centered) {
                    part.centered = false;
                }
                renderPartMixerUI();
                toast(part.hidden ? `Hidden ${part.name} staff` : `Showing ${part.name} staff`);
                if (state.pendingVisibilityRaf) {
                    cancelAnimationFrame(state.pendingVisibilityRaf);
                }
                state.pendingVisibilityRaf = requestAnimationFrame(() => {
                    state.pendingVisibilityRaf = null;
                    reRenderScorePreservingState();
                });
            });

            btnGroup.appendChild(muteBtn);
            btnGroup.appendChild(soloBtn);
            btnGroup.appendChild(highlightBtn);
            btnGroup.appendChild(centerBtn);
            btnGroup.appendChild(visibilityBtn);
            headerRow.appendChild(titleWrap);
            headerRow.appendChild(btnGroup);
            card.appendChild(headerRow);

            // Row 2: Per-Part Classical Instrument Selector
            const instRow = document.createElement('div');
            instRow.className = 'part-instrument-row';
            instRow.appendChild(buildPartInstrumentSelect(part));

            if (part.isLoadingPatch) {
                const dot = document.createElement('span');
                dot.className = 'part-loading-dot';
                dot.title = 'Loading instrument samples…';
                instRow.appendChild(dot);
            }
            card.appendChild(instRow);

            // Row 3: Part Volume Slider + Percentage Readout
            const volRow = document.createElement('div');
            volRow.className = 'part-volume-row';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.className = 'part-volume-slider';
            slider.min = '0';
            slider.max = '100';
            slider.value = String(part.volume);
            slider.title = `${part.name} Volume (Double-click to reset to ${CONFIG.DEFAULT_PART_VOLUME}%)`;
            slider.setAttribute('aria-label', `${part.name} Volume`);

            const volReadout = document.createElement('span');
            volReadout.className = 'part-vol-value';
            volReadout.textContent = `${part.volume}%`;
            volReadout.title = `Double-click to reset to ${CONFIG.DEFAULT_PART_VOLUME}%`;

            const resetPartVolumeToDefault = () => {
                part.volume = CONFIG.DEFAULT_PART_VOLUME;
                slider.value = String(CONFIG.DEFAULT_PART_VOLUME);
                volReadout.textContent = `${CONFIG.DEFAULT_PART_VOLUME}%`;
                applyAllPartGains(false);
            };

            slider.addEventListener('input', () => {
                part.volume = parseInt(slider.value, 10);
                volReadout.textContent = `${part.volume}%`;
                applyAllPartGains(false);
            });

            slider.addEventListener('dblclick', resetPartVolumeToDefault);
            volReadout.addEventListener('dblclick', resetPartVolumeToDefault);

            volRow.appendChild(slider);
            volRow.appendChild(volReadout);
            card.appendChild(volRow);

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
        state.rawXmlPartMeta = parseRawXmlPartMetadata(content);
        state.parts = {};
        state.currentTicks = 0;
        state.smoothTicks = 0;
        state.currentStepIndex = 0;
        state.notes = [];
        state.allScoreNotes = [];
        state.cursorSteps = [];
        state.barData = [];
        state.metronomeBeats = [];
        state.highlightedStaffBands = [];
        state.centeredStaffBands = [];
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
            // Prepare dedicated track + inner container so OSMD SVG & cursor share (0,0) origin
            // and Continuous View can add 50% horizontal padding on both sides for centered panning
            dom.scoreDisplayArea.innerHTML = `
                <div class="osmd-score-track${state.continuousScrollMode ? '' : ' page-mode'}" id="osmdScoreTrack">
                    <div class="osmd-score-inner" id="osmdScoreInner"></div>
                </div>
            `;
            const scoreInner = document.getElementById('osmdScoreInner') || dom.scoreDisplayArea;

            // Create fresh OSMD instance with autoResize: false & followCursor: false
            // (We handle resize and smooth 60fps camera scrolling ourselves with zero conflicts!)
            const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(scoreInner, {
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
            if (osmd.EngravingRules) {
                osmd.EngravingRules.RenderMeasureNumbers = false;
            }
            applyAutoHideKeyboardPartsOnLoad(osmd);
            configureMultiRestMinusOneRule(osmd);
            osmd.zoom = getEffectiveOsmdZoom();
            osmd.render();
            captureBaseSvgDimensions();

            state.osmd = osmd;
            state.scoreLoaded = true;
            dom.scoreDisplayArea.classList.add('score-loaded');

            // Automatically expand part mixer before extracting/centering so viewport height is final
            extractScoreData(false);
            setScoreControlsEnabled(true);
            syncLoopInputsUI();

            if (window.PYP_UX && Object.keys(state.parts).length > 1) {
                window.PYP_UX.setMixerExpanded(true);
            }

            // Ensure cursor and centered camera are locked at step 0 (Bar 1, Beat 1)
            updateContinuousHorizontalPadding(false);
            updateVerticalCenteringForHighlight(true, 1 / 60, true);
            seekToTicks(0, { snapScroll: true, keepPlaying: false });

            const numParts = Object.keys(state.parts).length;
            const numBars = state.barData.length;
            const summaryInstruments = [...new Set(
                Object.values(state.parts).map((p) => INSTRUMENT_CATALOG[p.patchId]?.label || 'Piano')
            )].slice(0, 3).join(', ');
            toast(`Loaded "${state.scoreTitle}" (${numParts} parts, ${numBars} bars — ${summaryInstruments})`, 'success', 3400);
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

    // ===========================================
    // STANDARD MIDI (.MID / .MIDI) -> MUSICXML CONVERTER
    // ===========================================

    const MIDI_GM_PROGRAM_NAMES = [
        'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
        'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
        'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
        'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
        'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
        'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
        'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
        'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
        'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2', 'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
        'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
        'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
        'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    ];

    function escapeXmlText(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    function decodeMidiTextBytes(bytes) {
        if (!bytes || !bytes.length) return '';
        try {
            const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            return utf8.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
        } catch (_) {
            let s = '';
            for (let i = 0; i < bytes.length; i++) {
                const c = bytes[i];
                if (c >= 32 && c !== 127) s += String.fromCharCode(c);
            }
            return s.trim();
        }
    }

    function parseStandardMidiFile(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        if (bytes.length < 14) {
            throw new Error('MIDI file is too short.');
        }

        const headerTag = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        if (headerTag !== 'MThd') {
            throw new Error('Invalid MIDI header (missing MThd).');
        }

        const headerLen = view.getUint32(4, false);
        const format = view.getUint16(8, false);
        const numTracks = view.getUint16(10, false);
        const rawDivision = view.getUint16(12, false);
        let ticksPerQuarter = 480;
        if ((rawDivision & 0x8000) === 0 && rawDivision > 0) {
            ticksPerQuarter = rawDivision;
        }

        let offset = 8 + headerLen;
        const rawTracks = [];
        const tempoEvents = [];
        const timeSigEvents = [];
        const keySigEvents = [];

        const readVarLen = (posObj, maxEnd) => {
            let val = 0;
            let count = 0;
            while (posObj.pos < maxEnd && count < 4) {
                const b = bytes[posObj.pos++];
                val = (val << 7) | (b & 0x7F);
                count++;
                if ((b & 0x80) === 0) break;
            }
            return val;
        };

        for (let tIdx = 0; tIdx < numTracks && offset + 8 <= bytes.length; tIdx++) {
            const chunkTag = String.fromCharCode(
                bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]
            );
            const chunkLen = view.getUint32(offset + 4, false);
            const trackStart = offset + 8;
            const trackEnd = Math.min(bytes.length, trackStart + chunkLen);
            offset = trackEnd;

            if (chunkTag !== 'MTrk') continue;

            const posObj = { pos: trackStart };
            let absTick = 0;
            let runningStatus = 0;

            let trackName = '';
            let instrumentName = '';
            const programsByChannel = new Map();
            const openNotes = new Map();
            const notes = [];
            const lyrics = [];

            while (posObj.pos < trackEnd) {
                const delta = readVarLen(posObj, trackEnd);
                absTick += delta;
                if (posObj.pos >= trackEnd) break;

                let status = bytes[posObj.pos];
                if (status < 0x80) {
                    if (!runningStatus) {
                        posObj.pos++;
                        continue;
                    }
                    status = runningStatus;
                } else {
                    posObj.pos++;
                    if (status < 0xF0) {
                        runningStatus = status;
                    } else if (status === 0xF0 || status === 0xF7) {
                        runningStatus = 0;
                    }
                }

                if (status === 0xFF) {
                    if (posObj.pos >= trackEnd) break;
                    const metaType = bytes[posObj.pos++];
                    const metaLen = readVarLen(posObj, trackEnd);
                    const metaEnd = Math.min(trackEnd, posObj.pos + metaLen);
                    const data = bytes.subarray(posObj.pos, metaEnd);
                    posObj.pos = metaEnd;

                    if (metaType === 0x03 && !trackName) {
                        trackName = decodeMidiTextBytes(data);
                    } else if (metaType === 0x04 && !instrumentName) {
                        instrumentName = decodeMidiTextBytes(data);
                    } else if (metaType === 0x05) {
                        const text = decodeMidiTextBytes(data);
                        if (text && !/^[@\\]/.test(text)) {
                            lyrics.push({ tick: absTick, text });
                        }
                    } else if (metaType === 0x51 && data.length === 3) {
                        const usPerQuarter = (data[0] << 16) | (data[1] << 8) | data[2];
                        if (usPerQuarter > 0) {
                            const bpm = Math.max(20, Math.min(320, Math.round(60000000 / usPerQuarter)));
                            tempoEvents.push({ tick: absTick, bpm });
                        }
                    } else if (metaType === 0x58 && data.length >= 2) {
                        const num = Math.max(1, data[0]);
                        const den = Math.max(1, Math.pow(2, data[1]));
                        timeSigEvents.push({ tick: absTick, num, den });
                    } else if (metaType === 0x59 && data.length >= 2) {
                        const rawFifths = data[0] & 0x80 ? data[0] - 256 : data[0];
                        const fifths = Math.max(-7, Math.min(7, rawFifths));
                        const mode = data[1] === 1 ? 'minor' : 'major';
                        keySigEvents.push({ tick: absTick, fifths, mode });
                    }
                    continue;
                }

                if (status === 0xF0 || status === 0xF7) {
                    const sysLen = readVarLen(posObj, trackEnd);
                    posObj.pos = Math.min(trackEnd, posObj.pos + sysLen);
                    continue;
                }

                const highNibble = status & 0xF0;
                const channel = status & 0x0F;

                if (highNibble === 0x80 || highNibble === 0x90) {
                    const pitch = bytes[posObj.pos++] ?? 60;
                    const vel = bytes[posObj.pos++] ?? 0;
                    const isNoteOn = highNibble === 0x90 && vel > 0;
                    const key = `${channel}_${pitch}`;

                    if (isNoteOn) {
                        const prevStack = openNotes.get(key);
                        if (prevStack && prevStack.length > 0) {
                            const prev = prevStack.shift();
                            if (absTick > prev.startTick) {
                                notes.push({
                                    startTick: prev.startTick,
                                    endTick: absTick,
                                    midi: pitch,
                                    velocity: prev.velocity,
                                    channel,
                                });
                            }
                        }
                        if (!openNotes.has(key)) openNotes.set(key, []);
                        openNotes.get(key).push({ startTick: absTick, velocity: vel });
                    } else {
                        const stack = openNotes.get(key);
                        if (stack && stack.length > 0) {
                            const started = stack.shift();
                            if (absTick > started.startTick) {
                                notes.push({
                                    startTick: started.startTick,
                                    endTick: absTick,
                                    midi: pitch,
                                    velocity: started.velocity,
                                    channel,
                                });
                            }
                        }
                    }
                } else if (highNibble === 0xA0 || highNibble === 0xB0 || highNibble === 0xE0) {
                    posObj.pos = Math.min(trackEnd, posObj.pos + 2);
                } else if (highNibble === 0xC0) {
                    const prog = bytes[posObj.pos++] ?? 0;
                    if (!programsByChannel.has(channel)) {
                        programsByChannel.set(channel, prog);
                    }
                } else if (highNibble === 0xD0) {
                    posObj.pos = Math.min(trackEnd, posObj.pos + 1);
                } else {
                    posObj.pos = Math.min(trackEnd, posObj.pos + 1);
                }
            }

            rawTracks.push({
                trackIndex: tIdx,
                name: trackName || instrumentName || '',
                instrumentName,
                programsByChannel,
                notes,
                lyrics,
            });
        }

        return {
            format,
            ticksPerQuarter,
            rawTracks,
            tempoEvents,
            timeSigEvents,
            keySigEvents,
        };
    }

    function spellMidiPitchForKey(midi, fifths = 0) {
        const clamped = Math.max(12, Math.min(108, Math.round(midi)));
        const pc = ((clamped % 12) + 12) % 12;
        const octave = Math.floor(clamped / 12) - 1;

        const sharpTable = [
            { step: 'C', alter: 0 },
            { step: 'C', alter: 1 },
            { step: 'D', alter: 0 },
            { step: 'D', alter: 1 },
            { step: 'E', alter: 0 },
            { step: 'F', alter: 0 },
            { step: 'F', alter: 1 },
            { step: 'G', alter: 0 },
            { step: 'G', alter: 1 },
            { step: 'A', alter: 0 },
            { step: 'A', alter: 1 },
            { step: 'B', alter: 0 },
        ];
        const flatTable = [
            { step: 'C', alter: 0 },
            { step: 'D', alter: -1 },
            { step: 'D', alter: 0 },
            { step: 'E', alter: -1 },
            { step: 'E', alter: 0 },
            { step: 'F', alter: 0 },
            { step: 'G', alter: -1 },
            { step: 'G', alter: 0 },
            { step: 'A', alter: -1 },
            { step: 'A', alter: 0 },
            { step: 'B', alter: -1 },
            { step: 'B', alter: 0 },
        ];

        const entry = fifths < 0 ? flatTable[pc] : sharpTable[pc];
        return {
            step: entry.step,
            alter: entry.alter,
            octave,
        };
    }

    function detectClefForMidiPart(partName, notes) {
        const lower = String(partName || '').toLowerCase();
        if (/\b(bass|basso|continuo|cello|violoncello|fagott|bassoon|contrabass|tuba|trombone|left\s*hand|lh)\b/i.test(lower)) {
            return { sign: 'F', line: 4, octaveChange: 0 };
        }
        if (/\b(tenor)\b/i.test(lower)) {
            return { sign: 'G', line: 2, octaveChange: -1 };
        }
        if (/\b(soprano|alto|flute|flauto|oboe|violin|violino|trumpet|tromba|clarinet|right\s*hand|rh)\b/i.test(lower)) {
            return { sign: 'G', line: 2, octaveChange: 0 };
        }

        if (notes && notes.length > 0) {
            const sortedMidis = notes.map((n) => n.midi).sort((a, b) => a - b);
            const median = sortedMidis[Math.floor(sortedMidis.length * 0.5)];
            if (median < 55) {
                return { sign: 'F', line: 4, octaveChange: 0 };
            }
        }
        return { sign: 'G', line: 2, octaveChange: 0 };
    }

    function convertMidiBufferToMusicXML(arrayBuffer, fallbackTitle = 'MIDI Score') {
        const parsed = parseStandardMidiFile(arrayBuffer);
        const tpq = parsed.ticksPerQuarter || 480;
        const XML_DIVISIONS = 24; // 24 divisions per quarter note (3 divisions = 32nd note)
        const GRID_STEP = 3;      // Quantize to 32nd-note grid so all durations decompose cleanly

        // Build logical parts from tracks (splitting multi-channel Format 0 tracks by channel)
        let candidateTracks = parsed.rawTracks.filter((t) => t.notes.length > 0);
        if (candidateTracks.length === 0) {
            throw new Error('No playable MIDI notes found in this file.');
        }

        // Filter out General MIDI percussion channel 9 unless every note in the file is on channel 9
        const hasNonDrumNotes = candidateTracks.some((t) => t.notes.some((n) => n.channel !== 9));
        const logicalParts = [];

        if (candidateTracks.length === 1) {
            const single = candidateTracks[0];
            const filteredNotes = hasNonDrumNotes ? single.notes.filter((n) => n.channel !== 9) : single.notes;
            const byChannel = new Map();
            for (const n of filteredNotes) {
                if (!byChannel.has(n.channel)) byChannel.set(n.channel, []);
                byChannel.get(n.channel).push(n);
            }
            if (byChannel.size > 1) {
                let idx = 1;
                for (const [ch, chNotes] of byChannel.entries()) {
                    const prog = single.programsByChannel.get(ch);
                    const gmName = (typeof prog === 'number' && MIDI_GM_PROGRAM_NAMES[prog])
                        ? MIDI_GM_PROGRAM_NAMES[prog]
                        : `Part ${idx}`;
                    logicalParts.push({
                        id: `P${idx}`,
                        name: gmName,
                        midiProgram: typeof prog === 'number' ? (prog + 1) : 1,
                        notes: chNotes,
                        lyrics: idx === 1 ? single.lyrics : [],
                    });
                    idx++;
                }
            } else {
                const ch = filteredNotes[0]?.channel ?? 0;
                const prog = single.programsByChannel.get(ch);
                const gmName = (typeof prog === 'number' && MIDI_GM_PROGRAM_NAMES[prog]) ? MIDI_GM_PROGRAM_NAMES[prog] : '';
                logicalParts.push({
                    id: 'P1',
                    name: single.name || gmName || 'Part 1',
                    midiProgram: typeof prog === 'number' ? (prog + 1) : 1,
                    notes: filteredNotes,
                    lyrics: single.lyrics,
                });
            }
        } else {
            let idx = 1;
            for (const tr of candidateTracks) {
                const filteredNotes = hasNonDrumNotes ? tr.notes.filter((n) => n.channel !== 9) : tr.notes;
                if (filteredNotes.length === 0) continue;
                const ch = filteredNotes[0].channel;
                const prog = tr.programsByChannel.get(ch);
                const gmName = (typeof prog === 'number' && MIDI_GM_PROGRAM_NAMES[prog]) ? MIDI_GM_PROGRAM_NAMES[prog] : '';
                logicalParts.push({
                    id: `P${idx}`,
                    name: tr.name || gmName || `Part ${idx}`,
                    midiProgram: typeof prog === 'number' ? (prog + 1) : 1,
                    notes: filteredNotes,
                    lyrics: tr.lyrics,
                });
                idx++;
            }
        }

        if (logicalParts.length === 0) {
            throw new Error('No playable pitched tracks found in MIDI file.');
        }

        // Determine initial & mid-score tempo, time signature, and key signature
        const initialTempo = parsed.tempoEvents.length > 0 ? parsed.tempoEvents[0].bpm : 120;
        const initialTimeSig = parsed.timeSigEvents.length > 0
            ? parsed.timeSigEvents[0]
            : { num: 4, den: 4 };
        const initialKeySig = parsed.keySigEvents.length > 0
            ? parsed.keySigEvents[0]
            : { fifths: 0, mode: 'major' };

        const measureDivisions = Math.max(
            GRID_STEP,
            Math.round((initialTimeSig.num * (4 / initialTimeSig.den)) * XML_DIVISIONS / GRID_STEP) * GRID_STEP
        );

        const tickToQuantizedDiv = (tick) => {
            const rawDiv = (tick / tpq) * XML_DIVISIONS;
            return Math.max(0, Math.round(rawDiv / GRID_STEP) * GRID_STEP);
        };

        // Quantize notes & group simultaneous notes into chords per part
        let maxScoreDiv = measureDivisions;
        for (const part of logicalParts) {
            const lyricMap = new Map();
            if (Array.isArray(part.lyrics)) {
                for (const lyr of part.lyrics) {
                    const qDiv = tickToQuantizedDiv(lyr.tick);
                    if (!lyricMap.has(qDiv)) {
                        lyricMap.set(qDiv, lyr.text);
                    }
                }
            }

            const qNotes = [];
            for (const n of part.notes) {
                const qStart = tickToQuantizedDiv(n.startTick);
                const qEnd = Math.max(qStart + GRID_STEP, tickToQuantizedDiv(n.endTick));
                qNotes.push({
                    qStart,
                    qEnd,
                    midi: n.midi,
                });
                if (qEnd > maxScoreDiv) maxScoreDiv = qEnd;
            }

            qNotes.sort((a, b) => (a.qStart - b.qStart) || (a.midi - b.midi));

            // Group simultaneous note onsets into clean non-overlapping chord events
            const chordEvents = [];
            for (const qn of qNotes) {
                const last = chordEvents[chordEvents.length - 1];
                if (last && last.qStart === qn.qStart) {
                    if (!last.midis.includes(qn.midi) && last.midis.length < 4) {
                        last.midis.push(qn.midi);
                        last.qEnd = Math.max(last.qEnd, qn.qEnd);
                    }
                } else {
                    if (last && last.qEnd > qn.qStart) {
                        last.qEnd = qn.qStart;
                    }
                    chordEvents.push({
                        qStart: qn.qStart,
                        qEnd: qn.qEnd,
                        midis: [qn.midi],
                        lyric: lyricMap.get(qn.qStart) || null,
                    });
                }
            }

            part.chordEvents = chordEvents.filter((ev) => ev.qEnd > ev.qStart);
            part.clef = detectClefForMidiPart(part.name, part.notes);
        }

        const totalMeasures = Math.max(1, Math.min(600, Math.ceil(maxScoreDiv / measureDivisions)));

        // Map tempo changes to measure numbers
        const tempoByMeasure = new Map();
        tempoByMeasure.set(0, initialTempo);
        for (const te of parsed.tempoEvents) {
            const mIdx = Math.floor(tickToQuantizedDiv(te.tick) / measureDivisions);
            if (mIdx >= 0 && mIdx < totalMeasures) {
                tempoByMeasure.set(mIdx, te.bpm);
            }
        }

        const VALID_CHUNKS = [
            { div: 96, type: 'whole', dot: false },
            { div: 72, type: 'half', dot: true },
            { div: 48, type: 'half', dot: false },
            { div: 36, type: 'quarter', dot: true },
            { div: 24, type: 'quarter', dot: false },
            { div: 18, type: 'eighth', dot: true },
            { div: 12, type: 'eighth', dot: false },
            { div: 9,  type: '16th', dot: true },
            { div: 6,  type: '16th', dot: false },
            { div: 3,  type: '32nd', dot: false },
        ];

        const decomposeDuration = (durDiv) => {
            const chunks = [];
            let rem = Math.max(0, Math.round(durDiv / GRID_STEP) * GRID_STEP);
            while (rem > 0) {
                let matched = VALID_CHUNKS[VALID_CHUNKS.length - 1];
                for (const cand of VALID_CHUNKS) {
                    if (cand.div <= rem) {
                        matched = cand;
                        break;
                    }
                }
                chunks.push(matched);
                rem -= matched.div;
            }
            return chunks;
        };

        const emitRestXml = (durDiv, isFullMeasure = false) => {
            if (isFullMeasure) {
                return `<note><rest measure="yes"/><duration>${durDiv}</duration><voice>1</voice></note>`;
            }
            const chunks = decomposeDuration(durDiv);
            let out = '';
            for (const c of chunks) {
                out += `<note><rest/><duration>${c.div}</duration><voice>1</voice><type>${c.type}</type>${c.dot ? '<dot/>' : ''}</note>`;
            }
            return out;
        };

        const emitChordSpanXml = (midis, durDiv, tieStopFromPrev, tieStartToNext, lyricText, fifths) => {
            const chunks = decomposeDuration(durDiv);
            let out = '';
            for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
                const chunk = chunks[cIdx];
                const hasTieStop = (cIdx === 0 && tieStopFromPrev) || cIdx > 0;
                const hasTieStart = (cIdx === chunks.length - 1 && tieStartToNext) || cIdx < chunks.length - 1;

                for (let mIdx = 0; mIdx < midis.length; mIdx++) {
                    const pitch = spellMidiPitchForKey(midis[mIdx], fifths);
                    const isChordNote = mIdx > 0;
                    out += '<note>';
                    if (isChordNote) out += '<chord/>';
                    out += `<pitch><step>${pitch.step}</step>${pitch.alter !== 0 ? `<alter>${pitch.alter}</alter>` : ''}<octave>${pitch.octave}</octave></pitch>`;
                    out += `<duration>${chunk.div}</duration>`;
                    if (hasTieStop) out += '<tie type="stop"/>';
                    if (hasTieStart) out += '<tie type="start"/>';
                    out += '<voice>1</voice>';
                    out += `<type>${chunk.type}</type>`;
                    if (chunk.dot) out += '<dot/>';
                    if (hasTieStop || hasTieStart) {
                        out += '<notations>';
                        if (hasTieStop) out += '<tied type="stop"/>';
                        if (hasTieStart) out += '<tied type="start"/>';
                        out += '</notations>';
                    }
                    if (cIdx === 0 && mIdx === 0 && lyricText) {
                        out += `<lyric number="1"><syllabic>single</syllabic><text>${escapeXmlText(lyricText)}</text></lyric>`;
                    }
                    out += '</note>';
                }
            }
            return out;
        };

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n`;
        xml += `<score-partwise version="3.1">\n`;
        xml += `  <work><work-title>${escapeXmlText(fallbackTitle)}</work-title></work>\n`;
        xml += `  <part-list>\n`;

        for (const part of logicalParts) {
            const safeName = escapeXmlText(part.name);
            xml += `    <score-part id="${part.id}">\n`;
            xml += `      <part-name>${safeName}</part-name>\n`;
            xml += `      <score-instrument id="${part.id}-I1"><instrument-name>${safeName}</instrument-name></score-instrument>\n`;
            xml += `      <midi-instrument id="${part.id}-I1"><midi-program>${part.midiProgram}</midi-program></midi-instrument>\n`;
            xml += `    </score-part>\n`;
        }
        xml += `  </part-list>\n`;

        for (let pIdx = 0; pIdx < logicalParts.length; pIdx++) {
            const part = logicalParts[pIdx];
            xml += `  <part id="${part.id}">\n`;

            let evIdx = 0;
            const events = part.chordEvents;

            for (let mIdx = 0; mIdx < totalMeasures; mIdx++) {
                const mStart = mIdx * measureDivisions;
                const mEnd = mStart + measureDivisions;
                xml += `    <measure number="${mIdx + 1}">\n`;

                if (mIdx === 0) {
                    xml += `      <attributes>\n`;
                    xml += `        <divisions>${XML_DIVISIONS}</divisions>\n`;
                    xml += `        <key><fifths>${initialKeySig.fifths}</fifths><mode>${initialKeySig.mode}</mode></key>\n`;
                    xml += `        <time><beats>${initialTimeSig.num}</beats><beat-type>${initialTimeSig.den}</beat-type></time>\n`;
                    xml += `        <clef><sign>${part.clef.sign}</sign><line>${part.clef.line}</line>${part.clef.octaveChange ? `<clef-octave-change>${part.clef.octaveChange}</clef-octave-change>` : ''}</clef>\n`;
                    xml += `      </attributes>\n`;
                }

                if (pIdx === 0 && tempoByMeasure.has(mIdx)) {
                    const bpm = tempoByMeasure.get(mIdx);
                    xml += `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>\n`;
                }

                // Advance evIdx to the first event overlapping [mStart, mEnd)
                while (evIdx < events.length && events[evIdx].qEnd <= mStart) {
                    evIdx++;
                }

                let cursor = mStart;
                let k = evIdx;
                let hasAnyNotesInMeasure = false;
                let measureNotesXml = '';

                while (k < events.length && events[k].qStart < mEnd) {
                    const ev = events[k];
                    const segStart = Math.max(mStart, ev.qStart);
                    const segEnd = Math.min(mEnd, ev.qEnd);

                    if (segStart > cursor) {
                        measureNotesXml += emitRestXml(segStart - cursor, false);
                        cursor = segStart;
                    }

                    if (segEnd > segStart) {
                        hasAnyNotesInMeasure = true;
                        const tieStopFromPrev = ev.qStart < mStart;
                        const tieStartToNext = ev.qEnd > mEnd;
                        const lyricText = (!tieStopFromPrev && ev.lyric) ? ev.lyric : null;
                        measureNotesXml += emitChordSpanXml(
                            ev.midis,
                            segEnd - segStart,
                            tieStopFromPrev,
                            tieStartToNext,
                            lyricText,
                            initialKeySig.fifths
                        );
                        cursor = segEnd;
                    }

                    if (ev.qEnd <= mEnd) {
                        k++;
                    } else {
                        break;
                    }
                }

                if (!hasAnyNotesInMeasure) {
                    xml += `      ${emitRestXml(measureDivisions, true)}\n`;
                } else {
                    if (cursor < mEnd) {
                        measureNotesXml += emitRestXml(mEnd - cursor, false);
                    }
                    xml += `      ${measureNotesXml}\n`;
                }

                xml += `    </measure>\n`;
            }

            xml += `  </part>\n`;
        }

        xml += `</score-partwise>\n`;
        return xml;
    }

    function loadScoreFromFile(file) {
        if (!file) return;
        const nameLower = file.name.toLowerCase();
        const isMxl = nameLower.endsWith('.mxl');
        const isXml = nameLower.endsWith('.xml') || nameLower.endsWith('.musicxml');
        const isMidi = nameLower.endsWith('.mid') || nameLower.endsWith('.midi');

        if (!isMxl && !isXml && !isMidi) {
            toast('Unsupported file type. Please choose .xml, .musicxml, .mxl, or .mid/.midi', 'error');
            return;
        }

        const cleanTitle = file.name.replace(/\.(musicxml|xml|mxl|midi|mid)$/i, '');
        const reader = new FileReader();

        reader.onload = (e) => {
            if (isMidi) {
                try {
                    const generatedXml = convertMidiBufferToMusicXML(e.target.result, cleanTitle);
                    loadMusicXMLContent(generatedXml, cleanTitle);
                } catch (err) {
                    console.error('[PYP] Failed to convert MIDI file:', err);
                    toast(`Could not load MIDI file: ${err.message || 'Invalid MIDI format'}`, 'error');
                }
                return;
            }
            loadMusicXMLContent(e.target.result, cleanTitle);
        };
        reader.onerror = () => {
            toast('Error reading file from disk.', 'error');
        };

        if (isMidi) {
            reader.readAsArrayBuffer(file);
        } else if (isMxl) {
            // IMPORTANT: Compressed .mxl files are binary ZIP archives and must NOT be read as UTF-8 text!
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    }

    // ===========================================
    // 'SCORES' FOLDER & SUBFOLDER CATALOG & LOADER
    // ===========================================

    const DEFAULT_SCORES_FOLDER_FILES = [
        'BWV248_01_jauchzet_frohlocket_johann_sebastian_bach.mxl',
        'Johann Kuhnau Magnificat/01_Magnifcat_anima_mea_Johann_Kuhnau.mxl',
        'Johann Kuhnau Magnificat/04_Quia_fecit_mihi_magna_Johann_Kuhnau.mxl',
        'Johann Kuhnau Magnificat/06_Fecit_potentiam_Johann_Kuhnau.mxl',
        'Johann Kuhnau Magnificat/08_Sicut locutus est_Johann_Kuhnau.mxl',
        'Johann Kuhnau Magnificat/10_Sicut_erat_in_principio_Johann_Kuhnau.mxl',
    ];

    const KNOWN_SCORE_SUBFOLDERS = [
        'Johann Kuhnau Magnificat',
    ];

    function extractFolderFromRelPath(relPath) {
        const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^Scores\//i, '');
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash > 0 ? normalized.slice(0, lastSlash) : '';
    }

    function encodeScoreRelativePath(relPath) {
        const normalized = String(relPath || '').replace(/\\/g, '/').replace(/^Scores\//i, '');
        return normalized
            .split('/')
            .filter(Boolean)
            .map((seg) => encodeURIComponent(seg))
            .join('/');
    }

    function formatScoreFileLabel(fileName) {
        const base = String(fileName || '')
            .replace(/^.*[\\/]/, '')
            .replace(/\.(mxl|musicxml|xml|midi|mid)$/i, '');
        const words = base.split(/[_\s-]+/).filter(Boolean);
        return words
            .map((w) => {
                if (/^bwv\d+$/i.test(w)) return w.toUpperCase();
                if (/^\d+$/.test(w)) return w;
                return w.charAt(0).toUpperCase() + w.slice(1);
            })
            .join(' ');
    }

    function getScoresFolderEntries() {
        const entriesByFile = new Map();

        const registerEntry = (rawFileName, item = {}) => {
            const relFileName = String(rawFileName || '').replace(/\\/g, '/').replace(/^Scores\//i, '');
            if (!relFileName) return;
            const folder = item.folder !== undefined ? item.folder : extractFolderFromRelPath(relFileName);
            const existing = entriesByFile.get(relFileName);
            entriesByFile.set(relFileName, {
                fileName: relFileName,
                folder,
                path: item.path || `Scores/${relFileName}`,
                format: (item.format || relFileName.split('.').pop() || 'mxl').toLowerCase(),
                base64: item.base64 || existing?.base64 || null,
                label: item.label || existing?.label || formatScoreFileLabel(relFileName),
            });
        };

        // 1. Pre-bundled manifest entries (works on both file:// and http://)
        let hasManifestEntries = false;
        if (Array.isArray(window.PYP_SCORES_MANIFEST)) {
            for (const item of window.PYP_SCORES_MANIFEST) {
                if (!item || !item.fileName) continue;
                registerEntry(item.fileName, item);
                hasManifestEntries = true;
            }
        } else if (window.PYP_SCORES_MANIFEST && typeof window.PYP_SCORES_MANIFEST === 'object') {
            for (const [fn, val] of Object.entries(window.PYP_SCORES_MANIFEST)) {
                if (!fn) continue;
                if (typeof val === 'string') {
                    registerEntry(fn, { fileName: fn, base64: val });
                    hasManifestEntries = true;
                } else if (val && typeof val === 'object') {
                    registerEntry(fn, val);
                    hasManifestEntries = true;
                }
            }
        }

        // 2. Any dynamically discovered files from Scores/ & subfolder HTTP directory listings
        let hasDiscoveredEntries = false;
        if (Array.isArray(state.discoveredScoresFolderFiles) && state.discoveredScoresFolderFiles.length > 0) {
            hasDiscoveredEntries = true;
            for (const fn of state.discoveredScoresFolderFiles) {
                if (!entriesByFile.has(fn)) {
                    registerEntry(fn);
                }
            }
        }

        // 3. Fallback known files ONLY when neither scores-manifest.js nor HTTP directory discovery is available
        if (!hasManifestEntries && !hasDiscoveredEntries) {
            for (const fn of DEFAULT_SCORES_FOLDER_FILES) {
                if (!entriesByFile.has(fn)) {
                    registerEntry(fn);
                }
            }
        }

        return Array.from(entriesByFile.values());
    }

    async function scanHttpDirectoryForScores(dirPrefix = '') {
        const cleanPrefix = String(dirPrefix || '').replace(/^\/+|\/+$/g, '');
        const urlPath = cleanPrefix
            ? `Scores/${encodeScoreRelativePath(cleanPrefix)}/`
            : 'Scores/';
        const resp = await fetch(urlPath);
        if (!resp.ok) return { files: [], subfolders: [] };

        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a[href]');
        const files = [];
        const subfolders = [];

        links.forEach((a) => {
            const rawHref = a.getAttribute('href') || '';
            const stripped = rawHref.split('?')[0].split('#')[0];
            if (!stripped || stripped === '../' || stripped === './' || stripped === '/') return;

            const decoded = decodeURIComponent(stripped).replace(/\\/g, '/');
            const isDir = decoded.endsWith('/');
            const trimmed = decoded.replace(/\/+$/, '');
            const baseName = trimmed.replace(/^.*\//, '');
            if (!baseName || baseName.startsWith('.')) return;

            if (isDir && !cleanPrefix) {
                subfolders.push(baseName);
            } else if (/\.(mxl|musicxml|xml|midi|mid)$/i.test(baseName)) {
                files.push(cleanPrefix ? `${cleanPrefix}/${baseName}` : baseName);
            }
        });

        return { files, subfolders };
    }

    async function discoverScoresFolderOverHttp() {
        if (window.location.protocol === 'file:') return;
        try {
            const rootResult = await scanHttpDirectoryForScores('');
            const allFiles = [...rootResult.files];
            const foldersToScan = new Set([
                ...KNOWN_SCORE_SUBFOLDERS,
                ...rootResult.subfolders,
            ]);

            for (const sub of foldersToScan) {
                try {
                    const subResult = await scanHttpDirectoryForScores(sub);
                    for (const f of subResult.files) {
                        if (!allFiles.includes(f)) {
                            allFiles.push(f);
                        }
                    }
                } catch (_) { /* ignore subfolder without listing */ }
            }

            if (allFiles.length > 0) {
                state.discoveredScoresFolderFiles = allFiles;
                renderScoresFolderUI();
            }
        } catch (_) {
            // Static servers without directory listing use manifest + default catalog
        }
    }

    async function loadScoreFromScoresFolder(fileName) {
        if (!fileName) return;
        const normalizedFile = String(fileName).replace(/\\/g, '/').replace(/^Scores\//i, '');
        const entries = getScoresFolderEntries();
        const entry = entries.find((e) => e.fileName === normalizedFile) || {
            fileName: normalizedFile,
            folder: extractFolderFromRelPath(normalizedFile),
            path: `Scores/${normalizedFile}`,
            format: (normalizedFile.split('.').pop() || 'mxl').toLowerCase(),
            base64: null,
            label: formatScoreFileLabel(normalizedFile),
        };

        const isMxl = entry.format === 'mxl' || entry.fileName.toLowerCase().endsWith('.mxl');
        const isMidi = entry.format === 'mid' || entry.format === 'midi' || /\.(mid|midi)$/i.test(entry.fileName);

        // 1. If pre-bundled base64 data is available in manifest, decode directly in memory (works on file:// & http://)
        if (entry.base64) {
            try {
                if (isMidi) {
                    const bytes = Uint8Array.from(window.atob(entry.base64), (c) => c.charCodeAt(0));
                    const generatedXml = convertMidiBufferToMusicXML(bytes.buffer, entry.label);
                    await loadMusicXMLContent(generatedXml, entry.label);
                    return;
                } else if (isMxl) {
                    const binaryStr = window.atob(entry.base64);
                    await loadMusicXMLContent(binaryStr, entry.label);
                    return;
                } else {
                    const bytes = Uint8Array.from(window.atob(entry.base64), (c) => c.charCodeAt(0));
                    const xmlText = new TextDecoder('utf-8').decode(bytes);
                    await loadMusicXMLContent(xmlText, entry.label);
                    return;
                }
            } catch (err) {
                console.warn('[PYP] Manifest base64 decode failed, trying HTTP fetch:', err);
            }
        }

        // 2. Otherwise fetch from Scores/<relPath> over HTTP (encoding each path segment safely)
        try {
            const encodedPath = `Scores/${encodeScoreRelativePath(entry.fileName)}`;
            const resp = await fetch(encodedPath);
            if (!resp.ok) {
                throw new Error(`HTTP ${resp.status}`);
            }
            if (isMidi) {
                const buf = await resp.arrayBuffer();
                const generatedXml = convertMidiBufferToMusicXML(buf, entry.label);
                await loadMusicXMLContent(generatedXml, entry.label);
            } else if (isMxl) {
                const blob = await resp.blob();
                const reader = new FileReader();
                reader.onload = (e) => {
                    loadMusicXMLContent(e.target.result, entry.label);
                };
                reader.onerror = () => {
                    toast(`Could not read ${entry.fileName}`, 'error');
                };
                reader.readAsBinaryString(blob);
            } else {
                const xmlText = await resp.text();
                await loadMusicXMLContent(xmlText, entry.label);
            }
        } catch (err) {
            console.error('[PYP] Failed to fetch score from Scores folder:', err);
            toast(`Could not load Scores/${entry.fileName}`, 'error');
        }
    }

    function renderScoresFolderUI() {
        const entries = getScoresFolderEntries();

        // Group entries by folder (root files vs subfolder collections such as "Johann Kuhnau Magnificat")
        const rootEntries = entries.filter((e) => !e.folder);
        const foldersMap = new Map();
        for (const entry of entries) {
            if (!entry.folder) continue;
            if (!foldersMap.has(entry.folder)) {
                foldersMap.set(entry.folder, []);
            }
            foldersMap.get(entry.folder).push(entry);
        }

        // 1. Top Toolbar dropdown (with <optgroup> for subfolders like "Johann Kuhnau Magnificat")
        if (dom.scoresFolderSelect) {
            const currentVal = dom.scoresFolderSelect.value;
            dom.scoresFolderSelect.innerHTML = '<option value="">Scores Folder…</option>';

            for (const [folderName, folderEntries] of foldersMap.entries()) {
                const group = document.createElement('optgroup');
                group.label = folderName;
                for (const entry of folderEntries) {
                    const opt = document.createElement('option');
                    opt.value = entry.fileName;
                    opt.textContent = entry.label;
                    opt.title = `Scores/${entry.fileName}`;
                    group.appendChild(opt);
                }
                dom.scoresFolderSelect.appendChild(group);
            }

            for (const entry of rootEntries) {
                const opt = document.createElement('option');
                opt.value = entry.fileName;
                opt.textContent = entry.label;
                opt.title = `Scores/${entry.fileName}`;
                dom.scoresFolderSelect.appendChild(opt);
            }

            if (currentVal && entries.some((e) => e.fileName === currentVal)) {
                dom.scoresFolderSelect.value = currentVal;
            }
        }

        // 2. Welcome Screen Scores Folder list (with folder headers for subfolders)
        const sectionEl = document.getElementById('welcomeScoresFolderSection');
        const listEl = document.getElementById('welcomeScoresFolderList');
        if (sectionEl && listEl) {
            listEl.innerHTML = '';
            if (entries.length === 0) {
                sectionEl.hidden = true;
                return;
            }
            sectionEl.hidden = false;
            const frag = document.createDocumentFragment();

            const createScoreButton = (entry) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'score-folder-item-btn';
                btn.title = `Load Scores/${entry.fileName}`;
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                    <span class="score-folder-item-name">${entry.label}</span>
                `;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (dom.scoresFolderSelect) {
                        dom.scoresFolderSelect.value = entry.fileName;
                    }
                    loadScoreFromScoresFolder(entry.fileName);
                });
                return btn;
            };

            for (const [folderName, folderEntries] of foldersMap.entries()) {
                const folderGroup = document.createElement('div');
                folderGroup.className = 'score-subfolder-group';

                const folderHeader = document.createElement('div');
                folderHeader.className = 'score-subfolder-title';
                folderHeader.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>${folderName}</span>
                `;
                folderGroup.appendChild(folderHeader);

                for (const entry of folderEntries) {
                    folderGroup.appendChild(createScoreButton(entry));
                }
                frag.appendChild(folderGroup);
            }

            for (const entry of rootEntries) {
                frag.appendChild(createScoreButton(entry));
            }

            listEl.appendChild(frag);
        }
    }

    // ===========================================
    // CLICK-ON-SCORE TO SEEK (MUSESCORE STYLE)
    // ===========================================

    function handleScoreClick(event) {
        if (!state.scoreLoaded || !state.cursorSteps.length) return;

        // Ignore clicks on scrollbars using viewport-relative coordinates (NOT event.offsetX!)
        const box = dom.scoreDisplayArea;
        const boxRect = box.getBoundingClientRect();
        const relBoxX = event.clientX - boxRect.left;
        const relBoxY = event.clientY - boxRect.top;
        if (relBoxX < 0 || relBoxY < 0 || relBoxX > box.clientWidth || relBoxY > box.clientHeight) return;

        // Focus score area so Space / arrow keys immediately control playback
        box.focus({ preventScroll: true });

        const innerEl = box.querySelector('.osmd-score-inner') || box;
        const innerRect = innerEl.getBoundingClientRect();
        const clickX = event.clientX - innerRect.left;
        const clickY = event.clientY - innerRect.top;

        const clickedSvgGroup = typeof event.target?.closest === 'function'
            ? event.target.closest('g.vf-stavenote')
            : null;

        let bestStep = null;
        let clickedNote = null;

        // 1. If the user clicked directly on a rendered VexFlow stavenote group, match it immediately
        if (clickedSvgGroup) {
            for (const step of state.cursorSteps) {
                if (!step.clickableNotes) continue;
                const matchingNotes = step.clickableNotes.filter((cn) => cn.svgEl === clickedSvgGroup);
                if (matchingNotes.length > 0) {
                    bestStep = step;
                    // If chord shares a stavenote group, pick note closest vertically to clickY
                    let bestNoteDistY = Infinity;
                    for (const cn of matchingNotes) {
                        const dy = cn.noteY !== null ? Math.abs(clickY - cn.noteY) : 0;
                        if (dy < bestNoteDistY) {
                            bestNoteDistY = dy;
                            clickedNote = cn;
                        }
                    }
                    break;
                }
            }
        }

        // 2. Otherwise, find the closest beat step using actual notehead center X (hitX)
        if (!bestStep) {
            let bestDist = Infinity;
            for (const step of state.cursorSteps) {
                const stepHitX = step.hitX ?? step.x;
                if (state.continuousScrollMode) {
                    const dist = Math.abs(stepHitX - clickX);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestStep = step;
                    }
                } else {
                    // In Page View, strongly prefer steps on the same vertical staff system
                    const stepMidY = step.y + step.height * 0.5;
                    const dy = Math.abs(stepMidY - clickY);
                    const dx = Math.abs(stepHitX - clickX);
                    const withinSystem = clickY >= (step.y - 28) && clickY <= (step.y + step.height + 28);
                    const weightedDist = withinSystem ? dx : (dy * 12 + dx);
                    if (weightedDist < bestDist) {
                        bestDist = weightedDist;
                        bestStep = step;
                    }
                }
            }

            // Refine among nearby steps using actual DOM notehead bounding boxes on screen
            if (bestStep) {
                const startIdx = Math.max(0, bestStep.stepIdx - 2);
                const endIdx = Math.min(state.cursorSteps.length - 1, bestStep.stepIdx + 2);
                let bestBoxScore = Infinity;

                for (let idx = startIdx; idx <= endIdx; idx++) {
                    const candStep = state.cursorSteps[idx];
                    if (!state.continuousScrollMode && Math.abs(candStep.y - bestStep.y) > 40) continue;
                    if (!candStep.clickableNotes || !candStep.clickableNotes.length) continue;

                    for (const cn of candStep.clickableNotes) {
                        if (!cn.svgEl) continue;
                        const headEl = cn.svgEl.querySelector('.vf-notehead') || cn.svgEl;
                        const r = headEl.getBoundingClientRect();
                        if (r.width <= 0 && r.height <= 0) continue;

                        const cx = (r.left + r.right) * 0.5;
                        const cy = (r.top + r.bottom) * 0.5;
                        const dx = Math.abs(event.clientX - cx);
                        const dy = Math.abs(event.clientY - cy);
                        // Weight horizontal precision strongly so beat selection is exact, while vertical selects the staff/voice
                        const score = dx * 2.4 + dy * 0.55;
                        if (score < bestBoxScore) {
                            bestBoxScore = score;
                            bestStep = candStep;
                            clickedNote = cn;
                        }
                    }
                }
            }
        }

        // 3. Ensure we have the closest individual note in bestStep for vertical staff selection & auditioning
        if (bestStep && !clickedNote && bestStep.clickableNotes && bestStep.clickableNotes.length > 0) {
            let bestVerticalDist = Infinity;
            for (const cn of bestStep.clickableNotes) {
                let dy = Infinity;
                if (cn.svgEl) {
                    const headEl = cn.svgEl.querySelector('.vf-notehead') || cn.svgEl;
                    const r = headEl.getBoundingClientRect();
                    if (r.height > 0) {
                        dy = Math.abs(event.clientY - ((r.top + r.bottom) * 0.5));
                    }
                }
                if (!Number.isFinite(dy) && cn.noteY !== null) {
                    dy = Math.abs(clickY - cn.noteY);
                }
                if (dy < bestVerticalDist) {
                    bestVerticalDist = dy;
                    clickedNote = cn;
                }
            }
            if (!clickedNote) {
                clickedNote = bestStep.clickableNotes[0];
            }
        }

        if (!bestStep) return;

        // When the user clicks inside a measure where visible parts have only rests (such as the 1-bar count-in
        // rest at the end of a multi-measure rest), snap to Beat 1 of that bar so they get a full count-in bar!
        const hasVisibleNoteAtStep = Boolean(bestStep.clickableNotes && bestStep.clickableNotes.length > 0);
        const targetSeekTicks = (!hasVisibleNoteAtStep && state.barData[bestStep.measureIndex])
            ? state.barData[bestStep.measureIndex].startTicks
            : bestStep.ticks;

        // If A-B Loop is active and the user clicked a note outside the loop range, shift loop range to include it
        if (state.loopEnabled && state.barData.length > 0) {
            const { startTicks: loopStart, endTicks: loopEnd } = getLoopBoundsTicks();
            if (targetSeekTicks < loopStart || targetSeekTicks >= loopEnd) {
                const clickedBarNum = getBarNumberAtTicks(targetSeekTicks);
                const span = Math.max(0, state.loopEndBar - state.loopStartBar);
                state.loopStartBar = clickedBarNum;
                state.loopEndBar = Math.min(state.barData.length, clickedBarNum + span);
                syncLoopInputsUI();
            }
        }

        if (state.isPlaying) {
            // During playback: jump immediately to the clicked note/bar and continue playing smoothly from there
            seekToTicks(targetSeekTicks, { snapScroll: false, keepPlaying: true, glideCamera: true });
        } else {
            // While paused: place cursor on clicked note/bar without jerking the score away from the mouse,
            // highlight the selected note, and play its pitch & note value
            seekToTicks(targetSeekTicks, { snapScroll: false, keepPlaying: false, keepViewport: true });
            if (hasVisibleNoteAtStep) {
                highlightStepNotes(bestStep.stepIdx, clickedNote?.svgEl || null);
                if (clickedNote) {
                    auditionClickedNote(clickedNote);
                }
            }
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
    <score-part id="P1"><part-name>Soprano</part-name><score-instrument id="P1-I1"><instrument-name>Soprano</instrument-name><instrument-sound>voice.soprano</instrument-sound></score-instrument></score-part>
    <score-part id="P2"><part-name>Alto</part-name><score-instrument id="P2-I1"><instrument-name>Alto</instrument-name><instrument-sound>voice.alto</instrument-sound></score-instrument></score-part>
    <score-part id="P3"><part-name>Tenor</part-name><score-instrument id="P3-I1"><instrument-name>Tenor</instrument-name><instrument-sound>voice.tenor</instrument-sound></score-instrument></score-part>
    <score-part id="P4"><part-name>Bass</part-name><score-instrument id="P4-I1"><instrument-name>Bass</instrument-name><instrument-sound>voice.bass</instrument-sound></score-instrument></score-part>
  </part-list>
  ${buildPart('P1', 'G', 2, 0, soprano)}
  ${buildPart('P2', 'G', 2, 0, alto)}
  ${buildPart('P3', 'G', 2, -1, tenor)}
  ${buildPart('P4', 'F', 4, 0, bass)}
</score-partwise>`;
    }

    /**
     * Built-in 4-Part Classical Chamber Quartet Demo (Flute, Oboe, Violin, Violoncello)
     * Demonstrates automatic classical instrument detection from MusicXML.
     */
    function getDemoEnsembleMusicXML() {
        const makeNote = (step, octave, duration, type, alter = 0) => {
            const alterTag = alter !== 0 ? `<alter>${alter}</alter>` : '';
            return `<note><pitch><step>${step}</step>${alterTag}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>1</voice><type>${type}</type></note>`;
        };

        const buildPart = (id, clefSign, clefLine, measuresXml) => {
            const attrs = `<attributes><divisions>2</divisions><key><fifths>1</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${clefSign}</sign><line>${clefLine}</line></clef></attributes>`;
            const tempoDir = id === 'P1'
                ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>104</per-minute></metronome></direction-type><sound tempo="104"/></direction>`
                : '';
            return `<part id="${id}">${measuresXml.map((m, i) => `<measure number="${i + 1}">${i === 0 ? attrs + tempoDir : ''}${m}</measure>`).join('')}</part>`;
        };

        // 8-bar Classical Quartet in G major (Flute, Oboe, Violin, Violoncello)
        const flute = [
            makeNote('D', 5, 4, 'half') + makeNote('B', 4, 2, 'quarter') + makeNote('G', 5, 2, 'quarter'),
            makeNote('F', 5, 2, 'quarter', 1) + makeNote('E', 5, 2, 'quarter') + makeNote('D', 5, 4, 'half'),
            makeNote('E', 5, 2, 'quarter') + makeNote('G', 5, 2, 'quarter') + makeNote('F', 5, 2, 'quarter', 1) + makeNote('E', 5, 2, 'quarter'),
            makeNote('D', 5, 4, 'half') + makeNote('A', 5, 4, 'half'),
            makeNote('B', 5, 2, 'quarter') + makeNote('G', 5, 2, 'quarter') + makeNote('E', 5, 2, 'quarter') + makeNote('C', 5, 2, 'quarter'),
            makeNote('D', 5, 2, 'quarter') + makeNote('G', 5, 2, 'quarter') + makeNote('F', 5, 2, 'quarter', 1) + makeNote('G', 5, 2, 'quarter'),
            makeNote('E', 5, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('D', 5, 2, 'quarter') + makeNote('F', 5, 2, 'quarter', 1),
            makeNote('G', 5, 8, 'whole'),
        ];

        const oboe = [
            makeNote('B', 4, 4, 'half') + makeNote('G', 4, 2, 'quarter') + makeNote('B', 4, 2, 'quarter'),
            makeNote('A', 4, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('B', 4, 4, 'half'),
            makeNote('C', 5, 2, 'quarter') + makeNote('B', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter'),
            makeNote('F', 4, 4, 'half', 1) + makeNote('D', 5, 4, 'half'),
            makeNote('D', 5, 2, 'quarter') + makeNote('B', 4, 2, 'quarter') + makeNote('C', 5, 2, 'quarter') + makeNote('A', 4, 2, 'quarter'),
            makeNote('B', 4, 2, 'quarter') + makeNote('B', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('B', 4, 2, 'quarter'),
            makeNote('C', 5, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter') + makeNote('A', 4, 2, 'quarter'),
            makeNote('B', 4, 8, 'whole'),
        ];

        const violin = [
            makeNote('G', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter'),
            makeNote('D', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('G', 4, 4, 'half'),
            makeNote('G', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('C', 4, 2, 'quarter', 1),
            makeNote('D', 4, 4, 'half') + makeNote('F', 4, 4, 'half', 1),
            makeNote('G', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('G', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter'),
            makeNote('G', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter') + makeNote('D', 4, 2, 'quarter'),
            makeNote('G', 4, 2, 'quarter') + makeNote('E', 4, 2, 'quarter') + makeNote('F', 4, 2, 'quarter', 1) + makeNote('D', 4, 2, 'quarter'),
            makeNote('D', 4, 8, 'whole'),
        ];

        const cello = [
            makeNote('G', 2, 4, 'half') + makeNote('G', 2, 2, 'quarter') + makeNote('E', 3, 2, 'quarter'),
            makeNote('D', 3, 2, 'quarter') + makeNote('C', 3, 2, 'quarter') + makeNote('G', 2, 4, 'half'),
            makeNote('C', 3, 2, 'quarter') + makeNote('G', 2, 2, 'quarter') + makeNote('A', 2, 2, 'quarter') + makeNote('A', 2, 2, 'quarter'),
            makeNote('D', 3, 4, 'half') + makeNote('D', 3, 4, 'half'),
            makeNote('G', 2, 2, 'quarter') + makeNote('B', 2, 2, 'quarter') + makeNote('C', 3, 2, 'quarter') + makeNote('A', 2, 2, 'quarter'),
            makeNote('G', 2, 2, 'quarter') + makeNote('G', 2, 2, 'quarter') + makeNote('D', 3, 2, 'quarter') + makeNote('G', 2, 2, 'quarter'),
            makeNote('C', 3, 2, 'quarter') + makeNote('A', 2, 2, 'quarter') + makeNote('D', 3, 2, 'quarter') + makeNote('D', 2, 2, 'quarter'),
            makeNote('G', 2, 8, 'whole'),
        ];

        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Quartet in G Major (Flute, Oboe, Violin, Cello)</work-title></work>
  <identification><creator type="composer">PYP Classical Suite</creator></identification>
  <part-list>
    <score-part id="P1">
      <part-name>Flute</part-name>
      <score-instrument id="P1-I1"><instrument-name>Flute</instrument-name><instrument-sound>wind.flutes.flute</instrument-sound></score-instrument>
      <midi-instrument id="P1-I1"><midi-program>74</midi-program></midi-instrument>
    </score-part>
    <score-part id="P2">
      <part-name>Oboe</part-name>
      <score-instrument id="P2-I1"><instrument-name>Oboe</instrument-name><instrument-sound>wind.reed.oboe</instrument-sound></score-instrument>
      <midi-instrument id="P2-I1"><midi-program>69</midi-program></midi-instrument>
    </score-part>
    <score-part id="P3">
      <part-name>Violin</part-name>
      <score-instrument id="P3-I1"><instrument-name>Violin</instrument-name><instrument-sound>strings.violin</instrument-sound></score-instrument>
      <midi-instrument id="P3-I1"><midi-program>41</midi-program></midi-instrument>
    </score-part>
    <score-part id="P4">
      <part-name>Violoncello</part-name>
      <score-instrument id="P4-I1"><instrument-name>Violoncello</instrument-name><instrument-sound>strings.cello</instrument-sound></score-instrument>
      <midi-instrument id="P4-I1"><midi-program>43</midi-program></midi-instrument>
    </score-part>
  </part-list>
  ${buildPart('P1', 'G', 2, flute)}
  ${buildPart('P2', 'G', 2, oboe)}
  ${buildPart('P3', 'G', 2, violin)}
  ${buildPart('P4', 'F', 4, cello)}
</score-partwise>`;
    }

    // ===========================================
    // INTERACTIVE ARROW-GUIDED APP TOUR
    // ===========================================

    const TOUR_STORAGE_KEY = 'pyp_tour_invite_dismissed_v1';
    let tourActive = false;
    let tourStepIndex = 0;
    let tourInjectedPreviewParts = false;
    let tourSwipeDemoTimer = null;

    function isTourInviteDismissed() {
        try {
            return window.localStorage.getItem(TOUR_STORAGE_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function setTourInviteDismissed() {
        try {
            window.localStorage.setItem(TOUR_STORAGE_KEY, '1');
        } catch (_) { /* ignore */ }
        const banner = document.getElementById('tourInviteBanner');
        if (banner) banner.hidden = true;
    }

    function ensureTourPreviewPartCards() {
        if (state.scoreLoaded || Object.keys(state.parts).length > 0) return;
        const wrapper = dom.partControlsContentWrapper;
        if (!wrapper) return;

        tourInjectedPreviewParts = true;
        if (window.PYP_UX && typeof window.PYP_UX.setMixerExpanded === 'function') {
            window.PYP_UX.setMixerExpanded(true);
        }

        const sampleParts = [
            { name: 'Soprano', isVocal: true, highlighted: true, vol: 100 },
            { name: 'Alto', isVocal: true, highlighted: false, vol: 70 },
            { name: 'Tenor', isVocal: true, highlighted: false, vol: 70 },
            { name: 'Bass', isVocal: true, highlighted: false, vol: 70 },
            { name: 'Violin I', isVocal: false, highlighted: false, vol: 70 },
            { name: 'Violin II', isVocal: false, highlighted: false, vol: 70 },
            { name: 'Continuo', isVocal: false, highlighted: false, vol: 70 },
        ];

        wrapper.innerHTML = '';
        if (dom.partCountBadge) {
            dom.partCountBadge.textContent = String(sampleParts.length);
            dom.partCountBadge.hidden = false;
        }

        const frag = document.createDocumentFragment();
        sampleParts.forEach((sp, idx) => {
            const card = document.createElement('div');
            card.className = `part-control-entry${sp.highlighted ? ' is-highlighted' : ''}`;
            if (idx === 0) card.id = 'tourPreviewFirstPartCard';
            card.innerHTML = `
                <div class="part-header-row">
                    <div class="part-title-wrap">
                        <span class="part-label">${sp.name}</span>
                        ${sp.isVocal ? '<span class="part-role-tag">Vocal</span>' : ''}
                    </div>
                    <div class="part-btn-group">
                        <button type="button" class="part-button mute-btn" tabindex="-1">M</button>
                        <button type="button" class="part-button solo-btn" tabindex="-1">S</button>
                        <button type="button" class="part-button highlight-btn${sp.highlighted ? ' active' : ''}" tabindex="-1">H</button>
                        <button type="button" class="part-button center-btn${sp.highlighted ? ' active' : ''}" tabindex="-1">C</button>
                        <button type="button" class="part-button visibility-btn" tabindex="-1">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                    </div>
                </div>
                <div class="part-instrument-row">
                    <select class="part-instrument-select" tabindex="-1"><option>Grand Piano</option><option>Smooth Wave</option></select>
                </div>
                <div class="part-volume-row">
                    <input type="range" class="part-volume-slider" min="0" max="100" value="${sp.vol}" tabindex="-1">
                    <span class="part-vol-value">${sp.vol}%</span>
                </div>
            `;
            frag.appendChild(card);
        });
        wrapper.appendChild(frag);
    }

    function cleanupTourPreviewPartCards() {
        if (tourSwipeDemoTimer) {
            window.clearInterval(tourSwipeDemoTimer);
            tourSwipeDemoTimer = null;
        }
        const swipePill = document.getElementById('tourSwipeHintPill');
        if (swipePill) swipePill.hidden = true;

        if (!tourInjectedPreviewParts) return;
        tourInjectedPreviewParts = false;
        if (!state.scoreLoaded && Object.keys(state.parts).length === 0) {
            renderPartMixerUI();
        }
    }

    function getTourSteps() {
        return [
            {
                title: '1. Choose or Open a Score',
                desc: 'Select a score directly from the Scores list, or click Open to load any MusicXML (.mxl, .musicxml, .xml) file from your device.',
                getTarget: () => document.getElementById('welcomeScoresFolderSection') || document.getElementById('scoresFolderSelect') || dom.loadScoreButton,
            },
            {
                title: '2. Playback, Bar Loop & Metronome',
                desc: 'Play or pause (Space), step backward/forward bar by bar, toggle an A–B Bar Loop (L) to practice tricky sections, or switch on the Metronome (M).',
                getTarget: () => document.querySelector('.toolbar-center'),
            },
            {
                title: '3. Click Notes & Scrub by Bar',
                desc: 'Click any note in the sheet music to hear its pitch and play from that exact beat, or drag this Bar Timeline slider to jump to any bar.',
                getTarget: () => document.querySelector('.timeline-row'),
            },
            {
                title: '4. Live Tempo & Instrument Sounds',
                desc: 'Adjust playback Tempo from 25% to 200% live without stopping, and choose between Grand Piano and Smooth Wave (a clear sustained tone for singing).',
                getTarget: () => document.querySelector('.tempo-pill') || document.querySelector('.audio-controls-row'),
            },
            {
                title: '5. Highlight (H), Center (C), Mute (M), Solo (S) & Hide (👁)',
                desc: 'Tap H (Highlight) to mark your staff in yellow and set its volume to 100% (others to 70%). Tap C (Center) to lock your staff in the vertical center of the screen, M to mute, S to solo, or the Eye icon to hide staves.',
                onEnter: () => {
                    ensureTourPreviewPartCards();
                    if (window.PYP_UX && typeof window.PYP_UX.setMixerExpanded === 'function') {
                        window.PYP_UX.setMixerExpanded(true);
                    }
                    if (dom.partControlsContentWrapper) {
                        dom.partControlsContentWrapper.scrollLeft = 0;
                    }
                },
                getTarget: () => document.querySelector('.part-control-entry') || dom.partControlsContentWrapper,
            },
            {
                title: '6. Swipe Sideways for More Parts!',
                desc: 'Important on mobile & multi-part scores: not all parts fit on screen at once—extra parts are off-screen to the right. Swipe left and right across the part cards to reach every part!',
                isSwipeStep: true,
                onEnter: () => {
                    ensureTourPreviewPartCards();
                    if (window.PYP_UX && typeof window.PYP_UX.setMixerExpanded === 'function') {
                        window.PYP_UX.setMixerExpanded(true);
                    }
                    const wrapper = dom.partControlsContentWrapper;
                    if (wrapper) {
                        let dir = 1;
                        wrapper.scrollTo({ left: Math.min(180, wrapper.scrollWidth - wrapper.clientWidth), behavior: 'smooth' });
                        tourSwipeDemoTimer = window.setInterval(() => {
                            if (!wrapper) return;
                            const maxScroll = Math.max(0, wrapper.scrollWidth - wrapper.clientWidth);
                            const targetX = dir > 0 ? Math.min(200, maxScroll) : 0;
                            wrapper.scrollTo({ left: targetX, behavior: 'smooth' });
                            dir *= -1;
                        }, 1500);
                    }
                },
                getTarget: () => dom.partControlsContentWrapper || document.getElementById('partControlsBar'),
            },
            {
                title: '7. View Mode, Zoom, Pitch & Home',
                desc: 'Switch between smooth Continuous panning and Page view, zoom in/out, toggle 440Hz / 415Hz Baroque pitch, and click the PYP logo on the top-left anytime to return to the home screen.',
                getTarget: () => document.querySelector('.toolbar-right') || dom.brandHomeBtn,
            },
        ];
    }

    function positionTourStep() {
        if (!tourActive) return;
        const steps = getTourSteps();
        const step = steps[tourStepIndex];
        if (!step) return;

        const overlay = document.getElementById('tourOverlay');
        const spotlight = document.getElementById('tourSpotlight');
        const popover = document.getElementById('tourPopover');
        const arrow = document.getElementById('tourArrow');
        const swipePill = document.getElementById('tourSwipeHintPill');
        const badgeEl = document.getElementById('tourStepBadge');
        const titleEl = document.getElementById('tourStepTitle');
        const descEl = document.getElementById('tourStepDesc');
        const prevBtn = document.getElementById('tourPrevBtn');
        const nextBtn = document.getElementById('tourNextBtn');

        if (!overlay || !spotlight || !popover || !arrow) return;

        badgeEl.textContent = `Step ${tourStepIndex + 1} of ${steps.length}`;
        titleEl.textContent = step.title;
        descEl.textContent = step.desc;
        prevBtn.disabled = tourStepIndex === 0;
        nextBtn.textContent = tourStepIndex === steps.length - 1 ? 'Finish' : 'Next';

        const target = step.getTarget && step.getTarget();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pad = 6;

        let rect = target ? target.getBoundingClientRect() : null;
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            rect = { top: vh * 0.4, left: vw * 0.3, width: vw * 0.4, height: 60, bottom: vh * 0.4 + 60, right: vw * 0.7 };
        }

        const spotTop = Math.max(4, rect.top - pad);
        const spotLeft = Math.max(4, rect.left - pad);
        const spotWidth = Math.min(vw - spotLeft - 4, rect.width + pad * 2);
        const spotHeight = Math.min(vh - spotTop - 4, rect.height + pad * 2);

        spotlight.style.top = `${spotTop}px`;
        spotlight.style.left = `${spotLeft}px`;
        spotlight.style.width = `${spotWidth}px`;
        spotlight.style.height = `${spotHeight}px`;

        // Show animated swipe badge right on the Part Mixer row during Step 6
        if (swipePill) {
            if (step.isSwipeStep) {
                swipePill.hidden = false;
                swipePill.style.left = `${spotLeft + spotWidth * 0.5}px`;
                swipePill.style.top = `${Math.max(12, spotTop + spotHeight * 0.5 - 16)}px`;
            } else {
                swipePill.hidden = true;
            }
        }

        // Measure popover dimensions
        const popRect = popover.getBoundingClientRect();
        const popW = popRect.width || Math.min(340, vw - 24);
        const popH = popRect.height || 180;

        const targetCenterX = spotLeft + spotWidth * 0.5;
        const spaceAbove = spotTop;
        const spaceBelow = vh - (spotTop + spotHeight);

        // Place popover below target if target is in top half or more room below; otherwise place above target
        const placeBelow = spaceBelow >= popH + 28 || spaceBelow > spaceAbove;

        let popTop;
        if (placeBelow) {
            popTop = Math.min(vh - popH - 12, spotTop + spotHeight + 22);
            arrow.className = 'tour-arrow arrow-top';
        } else {
            popTop = Math.max(12, spotTop - popH - 22);
            arrow.className = 'tour-arrow arrow-bottom';
        }

        const popLeft = Math.max(12, Math.min(vw - popW - 12, targetCenterX - popW * 0.5));
        popover.style.top = `${Math.round(popTop)}px`;
        popover.style.left = `${Math.round(popLeft)}px`;

        // Aim arrow directly at targetCenterX
        const arrowLeft = Math.max(16, Math.min(popW - 52, targetCenterX - popLeft - 18));
        arrow.style.left = `${Math.round(arrowLeft)}px`;
    }

    function goToTourStep(newIndex) {
        if (tourSwipeDemoTimer) {
            window.clearInterval(tourSwipeDemoTimer);
            tourSwipeDemoTimer = null;
        }
        const steps = getTourSteps();
        if (newIndex < 0 || newIndex >= steps.length) {
            endGuidedTour();
            return;
        }
        tourStepIndex = newIndex;
        const step = steps[tourStepIndex];
        if (typeof step.onEnter === 'function') {
            step.onEnter();
        }
        requestAnimationFrame(() => {
            positionTourStep();
        });
    }

    function startGuidedTour() {
        setTourInviteDismissed();
        const overlay = document.getElementById('tourOverlay');
        if (!overlay) return;
        tourActive = true;
        overlay.hidden = false;
        goToTourStep(0);
    }

    function endGuidedTour() {
        tourActive = false;
        const overlay = document.getElementById('tourOverlay');
        if (overlay) overlay.hidden = true;
        cleanupTourPreviewPartCards();
        setTourInviteDismissed();
    }

    function initGuidedTourControls() {
        const prevBtn = document.getElementById('tourPrevBtn');
        const nextBtn = document.getElementById('tourNextBtn');
        const skipBtn = document.getElementById('tourSkipBtn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => goToTourStep(tourStepIndex - 1));
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => goToTourStep(tourStepIndex + 1));
        }
        if (skipBtn) {
            skipBtn.addEventListener('click', () => endGuidedTour());
        }

        window.addEventListener('resize', () => {
            if (tourActive) positionTourStep();
        });

        document.addEventListener('keydown', (e) => {
            if (!tourActive) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                endGuidedTour();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                e.preventDefault();
                goToTourStep(tourStepIndex + 1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (tourStepIndex > 0) goToTourStep(tourStepIndex - 1);
            }
        });
    }

    // ===========================================
    // EVENT LISTENERS
    // ===========================================

    function bindWelcomeScreenActions() {
        const welcomeOpenBtn = document.getElementById('welcomeOpenBtn');
        const welcomeStartTourBtn = document.getElementById('welcomeStartTourBtn');
        const tourInviteBanner = document.getElementById('tourInviteBanner');
        const tourInviteStartBtn = document.getElementById('tourInviteStartBtn');
        const tourInviteDismissBtn = document.getElementById('tourInviteDismissBtn');

        if (tourInviteBanner) {
            tourInviteBanner.hidden = isTourInviteDismissed();
        }
        if (tourInviteStartBtn) {
            tourInviteStartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startGuidedTour();
            });
        }
        if (tourInviteDismissBtn) {
            tourInviteDismissBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setTourInviteDismissed();
            });
        }
        if (welcomeStartTourBtn) {
            welcomeStartTourBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startGuidedTour();
            });
        }
        if (welcomeOpenBtn) {
            welcomeOpenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dom.fileInput) dom.fileInput.click();
            });
        }
        renderScoresFolderUI();
    }

    function resetAppToHome() {
        if (state.auditionRestoreTimer) {
            window.clearTimeout(state.auditionRestoreTimer);
            state.auditionRestoreTimer = null;
        }
        if (state.isPlaying) {
            pausePlayback(false);
        }
        if (state.audioInitialized) {
            Tone.Transport.stop();
            Tone.Transport.ticks = 0;
        }
        releaseAllInstruments();
        disposeToneParts();
        disposePartAudioNodes();
        clearAllNoteHighlights();

        state.osmd = null;
        state.scoreLoaded = false;
        state.scoreTitle = '';
        state.rawXmlPartMeta = {};
        state.parts = {};
        state.notes = [];
        state.allScoreNotes = [];
        state.cursorSteps = [];
        state.barData = [];
        state.metronomeBeats = [];
        state.highlightedStaffBands = [];
        state.centeredStaffBands = [];
        state.totalMusicalTicks = 0;
        state.currentTicks = 0;
        state.smoothTicks = 0;
        state.playbackStartTicks = 0;
        state.currentStepIndex = 0;
        state.loopEnabled = false;
        state.loopStartBar = 1;
        state.loopEndBar = 4;
        state.baseScoreBpm = CONFIG.DEFAULT_BPM;
        state.activeBarBaseBpm = CONFIG.DEFAULT_BPM;
        state.tempoPercent = CONFIG.DEFAULT_TEMPO_PERCENT;
        state.zoom = 1.0;
        state.soundPreset = 'piano';

        if (dom.soundSelect) dom.soundSelect.value = 'piano';
        if (dom.scoresFolderSelect) dom.scoresFolderSelect.value = '';
        if (dom.zoomResetBtn) dom.zoomResetBtn.textContent = '100%';
        if (dom.fileInput) dom.fileInput.value = '';

        if (dom.scoreDisplayArea) {
            dom.scoreDisplayArea.classList.remove('score-loaded');
            dom.scoreDisplayArea.innerHTML = initialWelcomeMarkup;
            dom.scoreDisplayArea.scrollLeft = 0;
            dom.scoreDisplayArea.scrollTop = 0;
            bindWelcomeScreenActions();
        }

        updateScoreTitleUI();
        setScoreControlsEnabled(false);
        syncLoopInputsUI();
        updateTempoReadoutUI();
        setupTimelineUI();
        renderPartMixerUI();
    }

    function bindEvents() {
        // PYP Brand Logo -> Return to Home Screen (Reset App)
        if (dom.brandHomeBtn) {
            dom.brandHomeBtn.addEventListener('click', () => {
                resetAppToHome();
            });
            dom.brandHomeBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    resetAppToHome();
                }
            });
        }

        // Re-center vertically when the Part Mixer drawer is expanded or collapsed
        const toggleMixerBtn = document.getElementById('togglePartControlsButton');
        if (toggleMixerBtn) {
            toggleMixerBtn.addEventListener('click', () => {
                requestAnimationFrame(() => {
                    if (state.scoreLoaded) {
                        updateVerticalCenteringForHighlight(true, 1 / 60, false);
                    }
                });
            });
        }

        // File Open buttons
        const triggerOpen = (e) => {
            if (e) e.stopPropagation();
            if (dom.fileInput) dom.fileInput.click();
        };
        if (dom.loadScoreButton) dom.loadScoreButton.addEventListener('click', triggerOpen);

        if (dom.fileInput) {
            dom.fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    if (dom.scoresFolderSelect) dom.scoresFolderSelect.value = '';
                    loadScoreFromFile(file);
                }
                dom.fileInput.value = '';
            });
        }

        if (dom.scoresFolderSelect) {
            dom.scoresFolderSelect.addEventListener('change', () => {
                const chosenFile = dom.scoresFolderSelect.value;
                if (chosenFile) {
                    loadScoreFromScoresFolder(chosenFile);
                }
            });
        }

        bindWelcomeScreenActions();
        initGuidedTourControls();
        discoverScoresFolderOverHttp();

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

        // Zoom Controls (supports button steps, keyboard shortcuts, and 2-finger pinch focal zoom)
        const setZoom = (newZoom, options = {}) => {
            const { fineGrain = false, focalClientX = null, focalClientY = null } = options;
            const factor = fineGrain ? 100 : 100;
            const clamped = Math.round(Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, newZoom)) * factor) / factor;
            if (clamped === state.zoom) return;

            const box = dom.scoreDisplayArea;
            const track = box ? box.querySelector('.osmd-score-track') : null;
            const prevZoom = state.zoom;
            const prevEffZoom = getEffectiveOsmdZoom();
            const scaleRatio = prevZoom > 0 ? (clamped / prevZoom) : 1;

            let focalViewportX = null;
            let focalViewportY = null;
            let prevInnerX = null;
            let prevInnerY = null;

            if (box && track && state.scoreLoaded && typeof focalClientX === 'number' && typeof focalClientY === 'number') {
                const rect = box.getBoundingClientRect();
                focalViewportX = focalClientX - rect.left;
                focalViewportY = focalClientY - rect.top;
                const prevPadTop = parseFloat(track.style.paddingTop) || 0;
                prevInnerX = Math.max(0, (box.scrollLeft + focalViewportX) - (state.continuousPadX || 0));
                prevInnerY = Math.max(0, (box.scrollTop + focalViewportY) - prevPadTop);
            }

            state.zoom = clamped;
            const newEffZoom = getEffectiveOsmdZoom();
            if (dom.zoomResetBtn) dom.zoomResetBtn.textContent = `${Math.round(state.zoom * 100)}%`;
            if (state.scoreLoaded) {
                applyFastVectorZoom(prevEffZoom, newEffZoom);

                // Preserve user's pinch focal point after vector zoom
                if (box && track && focalViewportX !== null && focalViewportY !== null) {
                    const hasCenteredPart = state.centeredStaffBands && state.centeredStaffBands.length > 0;
                    if (!hasCenteredPart && prevInnerY !== null) {
                        const newPadTop = parseFloat(track.style.paddingTop) || 0;
                        const maxScrollY = Math.max(0, box.scrollHeight - box.clientHeight);
                        box.scrollTop = Math.max(0, Math.min(maxScrollY, Math.round((newPadTop + prevInnerY * scaleRatio) - focalViewportY)));
                    }
                    if (!state.isPlaying && state.continuousScrollMode && prevInnerX !== null) {
                        const maxScrollX = Math.max(0, box.scrollWidth - box.clientWidth);
                        box.scrollLeft = Math.max(0, Math.min(maxScrollX, Math.round(((state.continuousPadX || 0) + prevInnerX * scaleRatio) - focalViewportX)));
                        state.cameraScrollX = box.scrollLeft;
                        state.isCameraGliding = true;
                    }
                }
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

        // Fullscreen Modes:
        // 1. Score Viewport Full Screen (expands #scoreWorkspace edge-to-edge, hiding toolbars with a floating HUD)
        // 2. App Full Screen (uses browser Fullscreen API to run the entire PYP app full screen)
        const syncViewportFullscreenUI = () => {
            const active = Boolean(state.viewportFullscreen);
            document.body.classList.toggle('viewport-fullscreen', active);

            if (dom.viewportFullscreenBtn) {
                dom.viewportFullscreenBtn.classList.toggle('active', active);
                dom.viewportFullscreenBtn.setAttribute('aria-pressed', String(active));
                const exp = dom.viewportFullscreenBtn.querySelector('.icon-vp-expand');
                const col = dom.viewportFullscreenBtn.querySelector('.icon-vp-collapse');
                if (exp) exp.hidden = active;
                if (col) col.hidden = !active;
                dom.viewportFullscreenBtn.title = active
                    ? 'Exit Score Viewport Full Screen (V / Esc)'
                    : 'Score Viewport Full Screen (V)';
            }

            if (dom.viewportFloatingHud) {
                dom.viewportFloatingHud.hidden = !state.scoreLoaded && !active;
            }
            if (dom.viewportFloatingPlayBtn) {
                dom.viewportFloatingPlayBtn.hidden = !active || !state.scoreLoaded;
            }
            if (dom.viewportFloatingFsBtn) {
                const exp = dom.viewportFloatingFsBtn.querySelector('.icon-vp-expand');
                const col = dom.viewportFloatingFsBtn.querySelector('.icon-vp-collapse');
                if (exp) exp.hidden = active;
                if (col) col.hidden = !active;
                dom.viewportFloatingFsBtn.title = active
                    ? 'Exit Score Full Screen (V / Esc)'
                    : 'Score Full Screen (V)';
            }
            if (dom.viewportFloatingFsLabel) {
                dom.viewportFloatingFsLabel.textContent = active ? 'Exit Full' : 'Score Full';
            }

            requestAnimationFrame(() => {
                renderBarTickMarks();
                updateLoopTrackHighlight();
                if (state.scoreLoaded && dom.scoreDisplayArea) {
                    if (state.continuousScrollMode) {
                        updateContinuousHorizontalPadding(false);
                        updateVerticalCenteringForHighlight(true, 1 / 60, false);
                        updateCameraForTicks(state.isPlaying ? state.smoothTicks : state.currentTicks, 0, true);
                    } else {
                        reRenderScorePreservingState();
                    }
                }
            });
        };

        const toggleViewportFullscreen = (forceState) => {
            const nextState = typeof forceState === 'boolean' ? forceState : !state.viewportFullscreen;
            if (Boolean(state.viewportFullscreen) === nextState) return;
            state.viewportFullscreen = nextState;
            syncViewportFullscreenUI();
        };

        const getNativeFullscreenElement = () =>
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement ||
            null;

        const syncAppFullscreenUI = () => {
            const isFs = Boolean(getNativeFullscreenElement());
            if (dom.appFullscreenBtn) {
                dom.appFullscreenBtn.classList.toggle('active', isFs);
                dom.appFullscreenBtn.setAttribute('aria-pressed', String(isFs));
                const enterIcon = dom.appFullscreenBtn.querySelector('.icon-fs-enter');
                const exitIcon = dom.appFullscreenBtn.querySelector('.icon-fs-exit');
                if (enterIcon) enterIcon.hidden = isFs;
                if (exitIcon) exitIcon.hidden = !isFs;
                dom.appFullscreenBtn.title = isFs
                    ? 'Exit App Full Screen (F)'
                    : 'App Full Screen (F)';
            }
        };

        const toggleAppFullscreen = async () => {
            const root = document.documentElement;
            const currentFs = getNativeFullscreenElement();
            try {
                if (!currentFs) {
                    if (typeof root.requestFullscreen === 'function') {
                        await root.requestFullscreen();
                    } else if (typeof root.webkitRequestFullscreen === 'function') {
                        root.webkitRequestFullscreen();
                    } else {
                        // iOS iPhone Safari fallback where Fullscreen API is unavailable on documentElement
                        toggleViewportFullscreen();
                        return;
                    }
                } else {
                    if (typeof document.exitFullscreen === 'function') {
                        await document.exitFullscreen();
                    } else if (typeof document.webkitExitFullscreen === 'function') {
                        document.webkitExitFullscreen();
                    }
                }
            } catch (_) {
                toggleViewportFullscreen();
            }
            syncAppFullscreenUI();
        };

        if (dom.viewportFullscreenBtn) {
            dom.viewportFullscreenBtn.addEventListener('click', () => toggleViewportFullscreen());
        }
        if (dom.viewportFloatingFsBtn) {
            dom.viewportFloatingFsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleViewportFullscreen();
            });
        }
        if (dom.viewportFloatingPlayBtn) {
            dom.viewportFloatingPlayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!state.scoreLoaded) return;
                if (state.isPlaying) {
                    pausePlayback(true);
                } else {
                    startPlayback();
                }
            });
        }
        if (dom.appFullscreenBtn) {
            dom.appFullscreenBtn.addEventListener('click', () => toggleAppFullscreen());
        }

        document.addEventListener('fullscreenchange', syncAppFullscreenUI);
        document.addEventListener('webkitfullscreenchange', syncAppFullscreenUI);

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

        // Click on Score to Jump Cursor + Two-Finger Pinch-to-Zoom in Mobile/Touch Viewport
        if (dom.scoreDisplayArea) {
            let pointerDownPos = null;
            let pinchActive = false;
            let pinchStartDist = 0;
            let pinchStartZoom = 1.0;
            let pinchPreviewZoom = 1.0;
            let pinchMidClientX = 0;
            let pinchMidClientY = 0;
            let pinchOriginX = 0;
            let pinchOriginY = 0;
            let lastPinchEndTime = 0;

            const isInteractiveWelcomeTarget = (target) => {
                if (!target || typeof target.closest !== 'function') return false;
                return Boolean(target.closest('#scorePlaceholder, .empty-state, .score-loading-state, .score-error-state, button, a, input, select'));
            };

            const getTouchDistance = (t0, t1) => Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

            dom.scoreDisplayArea.addEventListener('touchstart', (e) => {
                if (!state.scoreLoaded || e.touches.length !== 2) return;
                const d = getTouchDistance(e.touches[0], e.touches[1]);
                if (d < 12) return;

                e.preventDefault();
                pointerDownPos = null;
                pinchActive = true;
                pinchStartDist = d;
                pinchStartZoom = state.zoom;
                pinchPreviewZoom = state.zoom;
                pinchMidClientX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
                pinchMidClientY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;

                const box = dom.scoreDisplayArea;
                const track = box.querySelector('.osmd-score-track');
                const rect = box.getBoundingClientRect();
                pinchOriginX = (pinchMidClientX - rect.left) + box.scrollLeft;
                pinchOriginY = (pinchMidClientY - rect.top) + box.scrollTop;

                if (track) {
                    track.style.transformOrigin = `${pinchOriginX.toFixed(1)}px ${pinchOriginY.toFixed(1)}px`;
                    track.style.willChange = 'transform';
                }
            }, { passive: false });

            dom.scoreDisplayArea.addEventListener('touchmove', (e) => {
                if (!pinchActive || !state.scoreLoaded || e.touches.length !== 2) return;
                e.preventDefault();

                const d = getTouchDistance(e.touches[0], e.touches[1]);
                if (d < 8 || pinchStartDist <= 0) return;

                pinchMidClientX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
                pinchMidClientY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;

                const rawZoom = pinchStartZoom * (d / pinchStartDist);
                pinchPreviewZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, rawZoom));
                const liveScale = pinchPreviewZoom / state.zoom;

                const track = dom.scoreDisplayArea.querySelector('.osmd-score-track');
                if (track) {
                    track.style.transform = `scale(${liveScale.toFixed(4)})`;
                }
                if (dom.zoomResetBtn) {
                    dom.zoomResetBtn.textContent = `${Math.round(pinchPreviewZoom * 100)}%`;
                }
            }, { passive: false });

            const finishPinchGesture = (e) => {
                if (!pinchActive) return;
                if (e && e.touches && e.touches.length >= 2) return;

                pinchActive = false;
                pointerDownPos = null;
                lastPinchEndTime = performance.now();

                const track = dom.scoreDisplayArea.querySelector('.osmd-score-track');
                if (track) {
                    track.style.transform = '';
                    track.style.transformOrigin = '';
                    track.style.willChange = '';
                }

                const finalZoom = Math.round(pinchPreviewZoom * 100) / 100;
                if (Math.abs(finalZoom - state.zoom) >= 0.02) {
                    setZoom(finalZoom, {
                        fineGrain: true,
                        focalClientX: pinchMidClientX,
                        focalClientY: pinchMidClientY,
                    });
                } else if (dom.zoomResetBtn) {
                    dom.zoomResetBtn.textContent = `${Math.round(state.zoom * 100)}%`;
                }
            };

            dom.scoreDisplayArea.addEventListener('touchend', finishPinchGesture);
            dom.scoreDisplayArea.addEventListener('touchcancel', finishPinchGesture);

            // Trackpad / touchscreen Ctrl+Wheel pinch zoom inside the score viewport
            let wheelZoomTimer = null;
            let wheelPreviewZoom = null;
            dom.scoreDisplayArea.addEventListener('wheel', (e) => {
                if (!state.scoreLoaded || !e.ctrlKey) return;
                e.preventDefault();

                const baseZoom = wheelPreviewZoom !== null ? wheelPreviewZoom : state.zoom;
                const factor = Math.exp(-e.deltaY * 0.0045);
                wheelPreviewZoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, baseZoom * factor));

                const box = dom.scoreDisplayArea;
                const track = box.querySelector('.osmd-score-track');
                const rect = box.getBoundingClientRect();
                const originX = (e.clientX - rect.left) + box.scrollLeft;
                const originY = (e.clientY - rect.top) + box.scrollTop;
                const liveScale = wheelPreviewZoom / state.zoom;

                if (track) {
                    track.style.transformOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;
                    track.style.transform = `scale(${liveScale.toFixed(4)})`;
                }
                if (dom.zoomResetBtn) {
                    dom.zoomResetBtn.textContent = `${Math.round(wheelPreviewZoom * 100)}%`;
                }

                const clientX = e.clientX;
                const clientY = e.clientY;
                window.clearTimeout(wheelZoomTimer);
                wheelZoomTimer = window.setTimeout(() => {
                    const targetZoom = wheelPreviewZoom;
                    wheelPreviewZoom = null;
                    if (track) {
                        track.style.transform = '';
                        track.style.transformOrigin = '';
                    }
                    if (targetZoom !== null) {
                        setZoom(targetZoom, {
                            fineGrain: true,
                            focalClientX: clientX,
                            focalClientY: clientY,
                        });
                    }
                }, 140);
            }, { passive: false });

            dom.scoreDisplayArea.addEventListener('pointerdown', (e) => {
                if (pinchActive || (performance.now() - lastPinchEndTime) < 350) {
                    pointerDownPos = null;
                    return;
                }
                if (!state.scoreLoaded || isInteractiveWelcomeTarget(e.target)) {
                    pointerDownPos = null;
                    return;
                }
                pointerDownPos = { x: e.clientX, y: e.clientY };
            });
            dom.scoreDisplayArea.addEventListener('click', (e) => {
                if (pinchActive || (performance.now() - lastPinchEndTime) < 350) {
                    pointerDownPos = null;
                    return;
                }
                if (!state.scoreLoaded || !pointerDownPos || isInteractiveWelcomeTarget(e.target)) {
                    pointerDownPos = null;
                    return;
                }
                const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
                pointerDownPos = null;
                if (moved > 18) return; // Ignore large drags / scrollbar drags while tolerating slight hand movement during playback
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

            dom.masterVolumeSlider.addEventListener('dblclick', () => {
                state.masterVolume = CONFIG.DEFAULT_PART_VOLUME;
                dom.masterVolumeSlider.value = String(CONFIG.DEFAULT_PART_VOLUME);
                if (state.masterMuted) {
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

        // Global Instrument Preset / Override Selector
        if (dom.soundSelect) {
            dom.soundSelect.addEventListener('change', async () => {
                const chosen = dom.soundSelect.value;
                if (!INSTRUMENT_CATALOG[chosen]) return;
                state.soundPreset = chosen;
                for (const part of Object.values(state.parts)) {
                    part.patchId = chosen;
                }
                renderPartMixerUI();

                if (state.audioInitialized && Object.keys(state.parts).length > 0) {
                    await loadAndBuildAllPartInstruments();
                }
                const label = dom.soundSelect.options[dom.soundSelect.selectedIndex]?.textContent || chosen;
                toast(`Instruments: ${label}`);
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
            dom.cursorTypeSelect.addEventListener('change', () => {
                applyCursorStyle();
                if (state.scoreLoaded && state.cursorSteps.length > 0) {
                    updateCameraForTicks(state.isPlaying ? state.smoothTicks : state.currentTicks, 0, true);
                }
            });
        }

        // Reset Mixer button (Restores volume, mute/solo, AND default instruments!)
        if (dom.resetMixerBtn) {
            dom.resetMixerBtn.addEventListener('click', async () => {
                state.soundPreset = 'piano';
                if (dom.soundSelect) dom.soundSelect.value = 'piano';

                const anyVisibilityChanged = Object.values(state.parts).some((p) => Boolean(p.hidden) !== Boolean(p.defaultHidden));
                for (const part of Object.values(state.parts)) {
                    part.volume = CONFIG.DEFAULT_PART_VOLUME;
                    part.muted = false;
                    part.soloed = false;
                    part.highlighted = false;
                    part.centered = false;
                    part.hidden = Boolean(part.defaultHidden);
                    part.patchId = part.detectedPatchId || 'piano';
                }
                syncGlobalSoundSelectUI();
                if (anyVisibilityChanged) {
                    reRenderScorePreservingState();
                } else {
                    renderPartMixerUI();
                    renderStaffHighlights();
                    renderStaffStartPartPointers();
                    refreshActiveNoteHighlightColors();
                }
                if (state.audioInitialized && Object.keys(state.parts).length > 0) {
                    await loadAndBuildAllPartInstruments();
                } else {
                    applyAllPartGains(false);
                }
                toast('Part mixer & instruments reset to score defaults');
            });
        }

        // Responsive Window Resize (Debounced: re-align bar ticks, update Continuous View centering, or re-render Page View)
        let resizeTimer = null;
        let lastBoxWidth = dom.scoreDisplayArea ? dom.scoreDisplayArea.clientWidth : 0;
        window.addEventListener('resize', () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                renderBarTickMarks();
                updateLoopTrackHighlight();
                if (state.scoreLoaded && dom.scoreDisplayArea) {
                    if (state.continuousScrollMode) {
                        updateContinuousHorizontalPadding(false);
                        updateVerticalCenteringForHighlight(true, 1 / 60, false);
                        updateCameraForTicks(state.isPlaying ? state.smoothTicks : state.currentTicks, 0, true);
                    } else {
                        const newW = dom.scoreDisplayArea.clientWidth;
                        if (Math.abs(newW - lastBoxWidth) > 24) {
                            lastBoxWidth = newW;
                            reRenderScorePreservingState();
                        } else {
                            updateVerticalCenteringForHighlight(true, 1 / 60, false);
                        }
                    }
                }
            }, 220);
        });

        // MuseScore-Style Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (tourActive) return;
            const activeEl = document.activeElement;
            const tag = activeEl?.tagName;
            const isTextInput = tag === 'TEXTAREA' ||
                (tag === 'INPUT' && activeEl.type !== 'range' && activeEl.type !== 'button' && activeEl.type !== 'checkbox');
            if (isTextInput) return;
            if (tag === 'SELECT' && e.key !== ' ') return;

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
                case 'v':
                case 'V':
                    e.preventDefault();
                    toggleViewportFullscreen();
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    toggleAppFullscreen();
                    break;
                case 'Escape':
                    if (state.viewportFullscreen) {
                        e.preventDefault();
                        toggleViewportFullscreen(false);
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
