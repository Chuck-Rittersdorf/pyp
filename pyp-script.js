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
        VSCO_BASE_URL: 'https://nbrosowsky.github.io/tonejs-instruments/samples/',
        DEFAULT_BPM: 100,
        DEFAULT_TEMPO_PERCENT: 100,
        DEFAULT_PART_VOLUME: 80,
        HIGHLIGHT_MAIN_VOLUME: 100,
        HIGHLIGHT_OTHER_VOLUME: 50,
        MIN_TEMPO_PERCENT: 25,
        MAX_TEMPO_PERCENT: 200,
        MIN_ZOOM: 0.5,
        MAX_ZOOM: 1.8,
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

    const VSCO_URLS = {
        violin: buildUrlMap(`${CONFIG.VSCO_BASE_URL}violin/`, {
            'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'G4': 'G4.mp3',
            'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'G5': 'G5.mp3',
            'A5': 'A5.mp3', 'C6': 'C6.mp3', 'E6': 'E6.mp3', 'G6': 'G6.mp3',
            'A6': 'A6.mp3', 'C7': 'C7.mp3',
        }),
        cello: buildUrlMap(`${CONFIG.VSCO_BASE_URL}cello/`, {
            'C2': 'C2.mp3', 'E2': 'E2.mp3', 'G2': 'G2.mp3', 'A2': 'A2.mp3',
            'C3': 'C3.mp3', 'E3': 'E3.mp3', 'G3': 'G3.mp3', 'A3': 'A3.mp3',
            'C4': 'C4.mp3', 'E4': 'E4.mp3', 'G4': 'G4.mp3', 'A4': 'A4.mp3',
            'C5': 'C5.mp3',
        }),
        contrabass: buildUrlMap(`${CONFIG.VSCO_BASE_URL}contrabass/`, {
            'F#1': 'Fs1.mp3', 'G1': 'G1.mp3', 'A#1': 'As1.mp3', 'C2': 'C2.mp3',
            'D2': 'D2.mp3', 'E2': 'E2.mp3', 'F#2': 'Fs2.mp3', 'G#2': 'Gs2.mp3',
            'A2': 'A2.mp3', 'C#3': 'Cs3.mp3', 'E3': 'E3.mp3', 'G#3': 'Gs3.mp3',
            'B3': 'B3.mp3',
        }),
        flute: buildUrlMap(`${CONFIG.VSCO_BASE_URL}flute/`, {
            'C4': 'C4.mp3', 'E4': 'E4.mp3', 'A4': 'A4.mp3',
            'C5': 'C5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3',
            'C6': 'C6.mp3', 'E6': 'E6.mp3', 'A6': 'A6.mp3', 'C7': 'C7.mp3',
        }),
        clarinet: buildUrlMap(`${CONFIG.VSCO_BASE_URL}clarinet/`, {
            'D3': 'D3.mp3', 'F3': 'F3.mp3', 'A#3': 'As3.mp3',
            'D4': 'D4.mp3', 'F4': 'F4.mp3', 'A#4': 'As4.mp3',
            'D5': 'D5.mp3', 'F5': 'F5.mp3', 'A#5': 'As5.mp3',
            'D6': 'D6.mp3', 'F#6': 'Fs6.mp3',
        }),
        bassoon: buildUrlMap(`${CONFIG.VSCO_BASE_URL}bassoon/`, {
            'G2': 'G2.mp3', 'A2': 'A2.mp3', 'C3': 'C3.mp3', 'G3': 'G3.mp3',
            'A3': 'A3.mp3', 'C4': 'C4.mp3', 'E4': 'E4.mp3', 'G4': 'G4.mp3',
            'A4': 'A4.mp3', 'C5': 'C5.mp3',
        }),
        frenchHorn: buildUrlMap(`${CONFIG.VSCO_BASE_URL}french-horn/`, {
            'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'G2': 'G2.mp3',
            'D3': 'D3.mp3', 'F3': 'F3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3',
            'D5': 'D5.mp3', 'F5': 'F5.mp3',
        }),
        trumpet: buildUrlMap(`${CONFIG.VSCO_BASE_URL}trumpet/`, {
            'F3': 'F3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3',
            'F4': 'F4.mp3', 'G4': 'G4.mp3', 'A#4': 'As4.mp3', 'D5': 'D5.mp3',
            'F5': 'F5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3',
        }),
        trombone: buildUrlMap(`${CONFIG.VSCO_BASE_URL}trombone/`, {
            'A#1': 'As1.mp3', 'C#2': 'Cs2.mp3', 'D#2': 'Ds2.mp3', 'F2': 'F2.mp3',
            'G#2': 'Gs2.mp3', 'A#2': 'As2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3',
            'F3': 'F3.mp3', 'G#3': 'Gs3.mp3', 'A#3': 'As3.mp3', 'C4': 'C4.mp3',
            'D4': 'D4.mp3', 'F4': 'F4.mp3',
        }),
        tuba: buildUrlMap(`${CONFIG.VSCO_BASE_URL}tuba/`, {
            'F1': 'F1.mp3', 'A#1': 'As1.mp3', 'D#2': 'Ds2.mp3', 'F2': 'F2.mp3',
            'A#2': 'As2.mp3', 'D3': 'D3.mp3', 'F3': 'F3.mp3', 'A#3': 'As3.mp3',
            'D4': 'D4.mp3',
        }),
        harp: buildUrlMap(`${CONFIG.VSCO_BASE_URL}harp/`, {
            'E1': 'E1.mp3', 'G1': 'G1.mp3', 'B1': 'B1.mp3', 'D2': 'D2.mp3',
            'F2': 'F2.mp3', 'A2': 'A2.mp3', 'C3': 'C3.mp3', 'E3': 'E3.mp3',
            'G3': 'G3.mp3', 'B3': 'B3.mp3', 'D4': 'D4.mp3', 'F4': 'F4.mp3',
            'A4': 'A4.mp3', 'C5': 'C5.mp3', 'E5': 'E5.mp3', 'G5': 'G5.mp3',
            'B5': 'B5.mp3', 'D6': 'D6.mp3', 'F6': 'F6.mp3', 'A6': 'A6.mp3',
            'B6': 'B6.mp3', 'D7': 'D7.mp3',
        }),
        organ: buildUrlMap(`${CONFIG.VSCO_BASE_URL}organ/`, {
            'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', 'A1': 'A1.mp3',
            'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', 'A2': 'A2.mp3',
            'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3',
            'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3',
            'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3',
            'C6': 'C6.mp3',
        }),
        harmonium: buildUrlMap(`${CONFIG.VSCO_BASE_URL}harmonium/`, {
            'C2': 'C2.mp3', 'E2': 'E2.mp3', 'G2': 'G2.mp3', 'A2': 'A2.mp3',
            'C3': 'C3.mp3', 'E3': 'E3.mp3', 'G3': 'G3.mp3', 'A3': 'A3.mp3',
            'C4': 'C4.mp3', 'E4': 'E4.mp3', 'G4': 'G4.mp3', 'A4': 'A4.mp3',
            'C5': 'C5.mp3', 'D5': 'D5.mp3',
        }),
        guitarNylon: buildUrlMap(`${CONFIG.VSCO_BASE_URL}guitar-nylon/`, {
            'B1': 'B1.mp3', 'D2': 'D2.mp3', 'E2': 'E2.mp3', 'F#2': 'Fs2.mp3',
            'G#2': 'Gs2.mp3', 'A2': 'A2.mp3', 'B2': 'B2.mp3', 'D3': 'D3.mp3',
            'E3': 'E3.mp3', 'G3': 'G3.mp3', 'A3': 'A3.mp3', 'B3': 'B3.mp3',
            'C#4': 'Cs4.mp3', 'E4': 'E4.mp3', 'G#4': 'Gs4.mp3', 'A4': 'A4.mp3',
            'B4': 'B4.mp3', 'D5': 'D5.mp3', 'E5': 'E5.mp3', 'A5': 'A5.mp3',
        }),
        saxophone: buildUrlMap(`${CONFIG.VSCO_BASE_URL}saxophone/`, {
            'D3': 'D3.mp3', 'F3': 'F3.mp3', 'G#3': 'Gs3.mp3', 'B3': 'B3.mp3',
            'D4': 'D4.mp3', 'F4': 'F4.mp3', 'G#4': 'Gs4.mp3', 'B4': 'B4.mp3',
            'D5': 'D5.mp3', 'F5': 'F5.mp3', 'G#5': 'Gs5.mp3', 'A5': 'A5.mp3',
        }),
        xylophone: buildUrlMap(`${CONFIG.VSCO_BASE_URL}xylophone/`, {
            'G4': 'G4.mp3', 'C5': 'C5.mp3', 'G5': 'G5.mp3', 'C6': 'C6.mp3',
            'G6': 'G6.mp3', 'C7': 'C7.mp3', 'G7': 'G7.mp3', 'C8': 'C8.mp3',
        }),
    };

    // Composite acoustic multi-sample maps for Viola, Oboe, English Horn, String Ensemble, and Piccolo
    const COMPOSITE_URLS = {
        viola: {
            'C3': `${CONFIG.VSCO_BASE_URL}cello/C3.mp3`,
            'D3': `${CONFIG.VSCO_BASE_URL}cello/D3.mp3`,
            'E3': `${CONFIG.VSCO_BASE_URL}cello/E3.mp3`,
            'F3': `${CONFIG.VSCO_BASE_URL}cello/F3.mp3`,
            'G3': `${CONFIG.VSCO_BASE_URL}cello/G3.mp3`,
            'A3': `${CONFIG.VSCO_BASE_URL}cello/A3.mp3`,
            'B3': `${CONFIG.VSCO_BASE_URL}cello/B3.mp3`,
            'C4': `${CONFIG.VSCO_BASE_URL}violin/C4.mp3`,
            'E4': `${CONFIG.VSCO_BASE_URL}violin/E4.mp3`,
            'G4': `${CONFIG.VSCO_BASE_URL}violin/G4.mp3`,
            'A4': `${CONFIG.VSCO_BASE_URL}violin/A4.mp3`,
            'C5': `${CONFIG.VSCO_BASE_URL}violin/C5.mp3`,
            'E5': `${CONFIG.VSCO_BASE_URL}violin/E5.mp3`,
            'G5': `${CONFIG.VSCO_BASE_URL}violin/G5.mp3`,
            'A5': `${CONFIG.VSCO_BASE_URL}violin/A5.mp3`,
            'C6': `${CONFIG.VSCO_BASE_URL}violin/C6.mp3`,
        },
        strings: {
            'G1': `${CONFIG.VSCO_BASE_URL}contrabass/G1.mp3`,
            'C2': `${CONFIG.VSCO_BASE_URL}cello/C2.mp3`,
            'E2': `${CONFIG.VSCO_BASE_URL}cello/E2.mp3`,
            'G2': `${CONFIG.VSCO_BASE_URL}cello/G2.mp3`,
            'A2': `${CONFIG.VSCO_BASE_URL}cello/A2.mp3`,
            'C3': `${CONFIG.VSCO_BASE_URL}cello/C3.mp3`,
            'E3': `${CONFIG.VSCO_BASE_URL}cello/E3.mp3`,
            'G3': `${CONFIG.VSCO_BASE_URL}cello/G3.mp3`,
            'A3': `${CONFIG.VSCO_BASE_URL}violin/A3.mp3`,
            'C4': `${CONFIG.VSCO_BASE_URL}violin/C4.mp3`,
            'E4': `${CONFIG.VSCO_BASE_URL}violin/E4.mp3`,
            'G4': `${CONFIG.VSCO_BASE_URL}violin/G4.mp3`,
            'A4': `${CONFIG.VSCO_BASE_URL}violin/A4.mp3`,
            'C5': `${CONFIG.VSCO_BASE_URL}violin/C5.mp3`,
            'E5': `${CONFIG.VSCO_BASE_URL}violin/E5.mp3`,
            'G5': `${CONFIG.VSCO_BASE_URL}violin/G5.mp3`,
            'A5': `${CONFIG.VSCO_BASE_URL}violin/A5.mp3`,
            'C6': `${CONFIG.VSCO_BASE_URL}violin/C6.mp3`,
            'E6': `${CONFIG.VSCO_BASE_URL}violin/E6.mp3`,
            'A6': `${CONFIG.VSCO_BASE_URL}violin/A6.mp3`,
            'C7': `${CONFIG.VSCO_BASE_URL}violin/C7.mp3`,
        },
        oboe: {
            'A3': `${CONFIG.VSCO_BASE_URL}bassoon/A3.mp3`,
            'C4': `${CONFIG.VSCO_BASE_URL}bassoon/C4.mp3`,
            'E4': `${CONFIG.VSCO_BASE_URL}bassoon/E4.mp3`,
            'G4': `${CONFIG.VSCO_BASE_URL}bassoon/G4.mp3`,
            'A4': `${CONFIG.VSCO_BASE_URL}bassoon/A4.mp3`,
            'C5': `${CONFIG.VSCO_BASE_URL}bassoon/C5.mp3`,
            'D5': `${CONFIG.VSCO_BASE_URL}clarinet/D5.mp3`,
            'F5': `${CONFIG.VSCO_BASE_URL}clarinet/F5.mp3`,
            'A#5': `${CONFIG.VSCO_BASE_URL}clarinet/As5.mp3`,
            'D6': `${CONFIG.VSCO_BASE_URL}clarinet/D6.mp3`,
            'F#6': `${CONFIG.VSCO_BASE_URL}clarinet/Fs6.mp3`,
        },
        englishHorn: {
            'G3': `${CONFIG.VSCO_BASE_URL}bassoon/G3.mp3`,
            'A3': `${CONFIG.VSCO_BASE_URL}bassoon/A3.mp3`,
            'C4': `${CONFIG.VSCO_BASE_URL}bassoon/C4.mp3`,
            'E4': `${CONFIG.VSCO_BASE_URL}bassoon/E4.mp3`,
            'G4': `${CONFIG.VSCO_BASE_URL}bassoon/G4.mp3`,
            'A4': `${CONFIG.VSCO_BASE_URL}bassoon/A4.mp3`,
            'C5': `${CONFIG.VSCO_BASE_URL}bassoon/C5.mp3`,
            'D5': `${CONFIG.VSCO_BASE_URL}clarinet/D5.mp3`,
            'F5': `${CONFIG.VSCO_BASE_URL}clarinet/F5.mp3`,
        },
    };

    /**
     * Classical Instrument Catalog
     * Ordered and grouped by musical family for the per-part Mixer selector.
     */
    const INSTRUMENT_CATALOG = {
        // --- Keyboard & Vocal Rehearsal ---
        'piano': {
            id: 'piano',
            label: 'Grand Piano',
            category: 'Keyboard & Vocal',
            urls: SALAMANDER_PIANO_URLS,
            release: 0.85,
            attack: 0.005,
            volumeDb: -1,
            durationFactor: 0.95,
            synthFamily: 'piano',
        },
        'organ': {
            id: 'organ',
            label: 'Pipe Organ',
            category: 'Keyboard & Vocal',
            urls: VSCO_URLS.organ,
            release: 0.25,
            attack: 0.02,
            volumeDb: -5,
            durationFactor: 0.99,
            synthFamily: 'organ',
        },
        'harpsichord': {
            id: 'harpsichord',
            label: 'Harpsichord (Cembalo)',
            category: 'Keyboard & Vocal',
            urls: VSCO_URLS.harp,
            release: 0.35,
            attack: 0.003,
            volumeDb: -3,
            durationFactor: 0.92,
            filter: { type: 'highpass', frequency: 240, Q: 0.9 },
            synthFamily: 'plucked',
        },
        'harmonium': {
            id: 'harmonium',
            label: 'Harmonium / Reed Organ',
            category: 'Keyboard & Vocal',
            urls: VSCO_URLS.harmonium,
            release: 0.25,
            attack: 0.025,
            volumeDb: -5,
            durationFactor: 0.98,
            synthFamily: 'organ',
        },

        // --- Strings ---
        'violin': {
            id: 'violin',
            label: 'Violin',
            category: 'Strings',
            urls: VSCO_URLS.violin,
            release: 0.38,
            attack: 0.025,
            volumeDb: -4,
            durationFactor: 0.98,
            synthFamily: 'strings',
        },
        'viola': {
            id: 'viola',
            label: 'Viola',
            category: 'Strings',
            urls: COMPOSITE_URLS.viola,
            release: 0.38,
            attack: 0.025,
            volumeDb: -3,
            durationFactor: 0.98,
            filter: { type: 'lowpass', frequency: 3300, Q: 0.7 },
            synthFamily: 'strings',
        },
        'cello': {
            id: 'cello',
            label: 'Violoncello (Cello)',
            category: 'Strings',
            urls: VSCO_URLS.cello,
            release: 0.42,
            attack: 0.025,
            volumeDb: -3,
            durationFactor: 0.98,
            synthFamily: 'strings',
        },
        'contrabass': {
            id: 'contrabass',
            label: 'Contrabass (Double Bass)',
            category: 'Strings',
            urls: VSCO_URLS.contrabass,
            release: 0.45,
            attack: 0.03,
            volumeDb: -2,
            durationFactor: 0.98,
            synthFamily: 'strings',
        },
        'strings': {
            id: 'strings',
            label: 'String Ensemble',
            category: 'Strings',
            urls: COMPOSITE_URLS.strings,
            release: 0.48,
            attack: 0.035,
            volumeDb: -4,
            durationFactor: 0.99,
            synthFamily: 'strings',
        },
        'harp': {
            id: 'harp',
            label: 'Concert Harp',
            category: 'Strings',
            urls: VSCO_URLS.harp,
            release: 1.1,
            attack: 0.005,
            volumeDb: -2,
            durationFactor: 1.0,
            synthFamily: 'plucked',
        },
        'guitar-nylon': {
            id: 'guitar-nylon',
            label: 'Classical Guitar',
            category: 'Strings',
            urls: VSCO_URLS.guitarNylon,
            release: 0.75,
            attack: 0.005,
            volumeDb: -3,
            durationFactor: 0.96,
            synthFamily: 'plucked',
        },

        // --- Woodwinds ---
        'flute': {
            id: 'flute',
            label: 'Flute',
            category: 'Woodwinds',
            urls: VSCO_URLS.flute,
            release: 0.28,
            attack: 0.02,
            volumeDb: -3,
            durationFactor: 0.96,
            synthFamily: 'woodwind',
        },
        'piccolo': {
            id: 'piccolo',
            label: 'Piccolo',
            category: 'Woodwinds',
            urls: VSCO_URLS.flute,
            release: 0.22,
            attack: 0.015,
            volumeDb: -4,
            durationFactor: 0.95,
            synthFamily: 'woodwind',
        },
        'oboe': {
            id: 'oboe',
            label: 'Oboe',
            category: 'Woodwinds',
            urls: COMPOSITE_URLS.oboe,
            release: 0.25,
            attack: 0.018,
            volumeDb: -3,
            durationFactor: 0.97,
            filter: { type: 'peaking', frequency: 1450, Q: 1.8, gain: 7 },
            synthFamily: 'reed',
        },
        'english-horn': {
            id: 'english-horn',
            label: 'English Horn (Cor Anglais)',
            category: 'Woodwinds',
            urls: COMPOSITE_URLS.englishHorn,
            release: 0.28,
            attack: 0.02,
            volumeDb: -3,
            durationFactor: 0.97,
            filter: { type: 'peaking', frequency: 1050, Q: 1.6, gain: 6 },
            synthFamily: 'reed',
        },
        'clarinet': {
            id: 'clarinet',
            label: 'Clarinet',
            category: 'Woodwinds',
            urls: VSCO_URLS.clarinet,
            release: 0.26,
            attack: 0.018,
            volumeDb: -3,
            durationFactor: 0.97,
            synthFamily: 'woodwind',
        },
        'bassoon': {
            id: 'bassoon',
            label: 'Bassoon (Fagotto)',
            category: 'Woodwinds',
            urls: VSCO_URLS.bassoon,
            release: 0.3,
            attack: 0.02,
            volumeDb: -2,
            durationFactor: 0.97,
            synthFamily: 'reed',
        },
        'saxophone': {
            id: 'saxophone',
            label: 'Saxophone',
            category: 'Woodwinds',
            urls: VSCO_URLS.saxophone,
            release: 0.28,
            attack: 0.018,
            volumeDb: -4,
            durationFactor: 0.96,
            synthFamily: 'reed',
        },

        // --- Brass ---
        'french-horn': {
            id: 'french-horn',
            label: 'French Horn (Corno)',
            category: 'Brass',
            urls: VSCO_URLS.frenchHorn,
            release: 0.32,
            attack: 0.022,
            volumeDb: -3,
            durationFactor: 0.97,
            synthFamily: 'brass',
        },
        'trumpet': {
            id: 'trumpet',
            label: 'Trumpet (Tromba)',
            category: 'Brass',
            urls: VSCO_URLS.trumpet,
            release: 0.26,
            attack: 0.015,
            volumeDb: -5,
            durationFactor: 0.96,
            synthFamily: 'brass',
        },
        'trombone': {
            id: 'trombone',
            label: 'Trombone (Posaune)',
            category: 'Brass',
            urls: VSCO_URLS.trombone,
            release: 0.3,
            attack: 0.02,
            volumeDb: -4,
            durationFactor: 0.97,
            synthFamily: 'brass',
        },
        'tuba': {
            id: 'tuba',
            label: 'Tuba',
            category: 'Brass',
            urls: VSCO_URLS.tuba,
            release: 0.34,
            attack: 0.025,
            volumeDb: -3,
            durationFactor: 0.97,
            synthFamily: 'brass',
        },

        // --- Percussion & Mallets ---
        'timpani': {
            id: 'timpani',
            label: 'Timpani (Pauken)',
            category: 'Percussion',
            urls: null, // Uses tuned orchestral kettle-drum synth
            release: 0.8,
            attack: 0.004,
            volumeDb: -2,
            durationFactor: 0.9,
            synthFamily: 'timpani',
        },
        'xylophone': {
            id: 'xylophone',
            label: 'Xylophone / Mallets',
            category: 'Percussion',
            urls: VSCO_URLS.xylophone,
            release: 0.5,
            attack: 0.003,
            volumeDb: -4,
            durationFactor: 0.92,
            synthFamily: 'plucked',
        },
    };

    // ===========================================
    // DOM REFERENCES
    // ===========================================

    const dom = {
        brandHomeBtn: document.getElementById('brandHomeBtn'),
        loadScoreButton: document.getElementById('loadScoreButton'),
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
        audioReadyPromise: null,
        auditionRestoreTimer: null,
        baseScoreBpm: CONFIG.DEFAULT_BPM,
        activeBarBaseBpm: CONFIG.DEFAULT_BPM,
        tempoPercent: CONFIG.DEFAULT_TEMPO_PERCENT,

        // Extracted score structures
        notes: [],          // { ticks, durationWhole, midi, partId, velocity, stepIdx }
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
        soundPreset: 'auto',        // 'auto' = from score (Singers -> Piano), or global patchId override
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
     * Determines the best classical instrument patch for a score part.
     * RULE: Any Singer / Vocal / SATB / Choir part is ALWAYS mapped to 'piano' (Grand Piano).
     * All classical orchestral/chamber instruments map to their corresponding acoustic samples.
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

        // Normalize MIDI program to 1-indexed General MIDI (1..128)
        let gmProg1 = null;
        if (typeof partInfo.xmlMeta?.midiProgram === 'number' && !Number.isNaN(partInfo.xmlMeta.midiProgram)) {
            gmProg1 = partInfo.xmlMeta.midiProgram;
        } else if (typeof partInfo.midiInstrumentId === 'number' && !Number.isNaN(partInfo.midiInstrumentId)) {
            // OSMD stores 0-indexed MidiInstrumentId (or 1-indexed in some cases)
            gmProg1 = partInfo.midiInstrumentId <= 127 ? partInfo.midiInstrumentId + 1 : partInfo.midiInstrumentId;
        }

        // Check if any sibling part is explicitly vocal (helps disambiguate "Alto" and "Bass" in SATB scores)
        const scoreHasExplicitVocalSibling = allPartInfos.some((p) => {
            const t = `${p.name || ''} ${p.xmlMeta?.partName || ''} ${p.xmlMeta?.instrumentSound || ''}`.toLowerCase();
            return /\b(sopran|soprano|sopraan|mezzo|contralto|countertenor|tenor|tenore|bariton|baritone|choir|chorus|koor|coro|chor|voce|vocal|voice|singstimme|zang|canto|cantus)\b/.test(t) ||
                Boolean(p.hasLyrics);
        });

        // Helper: check if text contains an explicit non-vocal instrument noun
        // (so "Soprano Saxophone", "Tenor Trombone", "Alto Flute", "Bass Clarinet", "Double Bass", "Basso Continuo" are not treated as singers)
        const hasInstrumentalNoun = /\b(sax|saxophone|saxofoon|trombone|posaune|flute|flauto|flöte|fluit|recorder|blockflöte|blokfluit|oboe|hobo|hautbois|clarinet|clarinetto|klarinette|klarinet|bassoon|fagotto|fagott|fagot|horn|corno|hoorn|trumpet|tromba|trompete|trompet|tuba|violin|violino|violine|viool|viola|bratsche|altviool|cello|violoncello|contrabass|kontrabass|contrebasse|contrabas|double\s*bass|string\s*bass|violone|continuo|cembalo|harpsichord|klavecimbel|clavecin|organ|organo|orgel|orgue|harmonium|piano|pianoforte|klavier|harp|arpa|harfe|guitar|chitarra|gitarre|gitaar|timpani|pauken|xylophone|marimba|glockenspiel|drum|percussion)\b/.test(rawText);

        // --------------------------------------------------
        // 1. SINGERS / VOCAL PARTS -> GRAND PIANO ('piano')
        // --------------------------------------------------
        if (soundId.startsWith('voice.') || soundId.includes('vocal') || soundId.includes('choir')) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal → Piano' };
        }

        // Explicit vocal keywords (when not modifying an instrument like "Tenor Saxophone" or "Bass Clarinet")
        const hasExplicitVocalWord = /\b(soprano|sopraan|sopran|mezzo[-\s]*soprano|mezzo|contralto|countertenor|contratenor|tenor|tenore|baritone|bariton|baritono|baryton|voice|voices|vocal|voce|voci|stimme|singstimme|zang|canto|cantus|altus|bassus|quintus|sextus|choir|chorus|koor|chor|coro|chœur|choeur|soli|soloist|singer|satb|ssa|ssaa|ttbb|sab)\b/.test(rawText);

        if (hasExplicitVocalWord && !hasInstrumentalNoun) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal → Piano' };
        }

        // Shorthand vocal part names: "S", "A", "T", "B", "S1", "S2", "A1", "A2", "T1", "T2", "B1", "B2", "S.", "A.", "T.", "B."
        if (/^(s|a|t|b|sop|alt|ten|bas|sopr)\.?(\s*[1234i]+)?$/i.test(partInfo.name.trim()) && !hasInstrumentalNoun) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal → Piano' };
        }

        // "Alto" / "Alt" or "Bass" / "Bas" / "Basso" without an instrumental noun
        const isBareAltoOrBass = /\b(alto|alt|bass|bas|basso)\b/.test(rawText) && !hasInstrumentalNoun;
        if (isBareAltoOrBass) {
            // In French orchestral scores without vocals, "Alto" can be Viola (GM 42) and "Basso" can be Contrabass (GM 44)
            const isGmViola = gmProg1 === 42 && !hasLyrics && !scoreHasExplicitVocalSibling;
            const isGmContrabass = (gmProg1 === 43 || gmProg1 === 44) && !hasLyrics && !scoreHasExplicitVocalSibling;
            if (!isGmViola && !isGmContrabass) {
                return { patchId: 'piano', isVocal: true, roleTag: 'Vocal → Piano' };
            }
        }

        // Any part with vocal lyrics (unless explicitly labeled Piano/Organ/Harpsichord/Guitar)
        if (hasLyrics && !hasInstrumentalNoun) {
            return { patchId: 'piano', isVocal: true, roleTag: 'Vocal → Piano' };
        }

        // --------------------------------------------------
        // 2. MUSICXML <instrument-sound> STANDARD TAXONOMY
        // --------------------------------------------------
        if (soundId) {
            if (soundId.includes('piccolo')) return { patchId: 'piccolo', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('flute') || soundId.includes('recorder')) return { patchId: 'flute', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('english-horn') || soundId.includes('cor-anglais')) return { patchId: 'english-horn', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('oboe')) return { patchId: 'oboe', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('clarinet')) return { patchId: 'clarinet', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('bassoon') || soundId.includes('contrabassoon')) return { patchId: 'bassoon', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('saxophone')) return { patchId: 'saxophone', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('horn')) return { patchId: 'french-horn', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('trumpet') || soundId.includes('cornet') || soundId.includes('flugelhorn')) return { patchId: 'trumpet', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('trombone')) return { patchId: 'trombone', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('tuba') || soundId.includes('euphonium')) return { patchId: 'tuba', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('violin')) return { patchId: 'violin', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('viola')) return { patchId: 'viola', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('cello') || soundId.includes('violoncello')) return { patchId: 'cello', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('contrabass') || soundId.includes('double-bass')) return { patchId: 'contrabass', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('harp')) return { patchId: 'harp', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('guitar') || soundId.includes('lute') || soundId.includes('pluck')) return { patchId: 'guitar-nylon', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('harpsichord') || soundId.includes('clavichord')) return { patchId: 'harpsichord', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('harmonium') || soundId.includes('accordion')) return { patchId: 'harmonium', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('organ')) return { patchId: 'organ', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('piano') || soundId.includes('keyboard')) return { patchId: 'piano', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('timpani')) return { patchId: 'timpani', isVocal: false, roleTag: 'Score' };
            if (soundId.includes('xylophone') || soundId.includes('marimba') || soundId.includes('glockenspiel') || soundId.includes('vibraphone')) {
                return { patchId: 'xylophone', isVocal: false, roleTag: 'Score' };
            }
            if (soundId.startsWith('strings.')) return { patchId: 'strings', isVocal: false, roleTag: 'Score' };
        }

        // --------------------------------------------------
        // 3. CLASSICAL PART NAME MATCHING (EN / IT / DE / FR / NL)
        // --------------------------------------------------
        // Woodwinds
        if (/\b(piccolo|ottavino|kleine\s*flöte|picc\.?)\b/.test(rawText)) return { patchId: 'piccolo', isVocal: false, roleTag: 'Score' };
        if (/\b(flute|flutes|flauto|flauti|flöte|flöten|flûte|fluit|dwarsfluit|recorder|blockflöte|blokfluit|traverso)\b/.test(rawText) || /^fl\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'flute', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(english\s*horn|cor\s*anglais|englischhorn|corno\s*inglese|althobo)\b/.test(rawText)) {
            return { patchId: 'english-horn', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(oboe|oboes|oboi|hautbois|hobo)\b/.test(rawText) || /^ob\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'oboe', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(clarinet|clarinets|clarinetto|clarinetti|klarinette|klarinetten|clarinette|klarinet|basset\s*horn)\b/.test(rawText) || /^cl\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'clarinet', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(bassoon|bassoons|fagotto|fagotti|fagott|fagotte|fagot|basson|contrabassoon|contrafagotto|kontrafagott)\b/.test(rawText) || /^(bsn|fg)\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'bassoon', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(saxophone|saxofoon|saxophon|sax)\b/.test(rawText)) {
            return { patchId: 'saxophone', isVocal: false, roleTag: 'Score' };
        }

        // Brass
        if (/\b(french\s*horn|horn|horns|corno|corni|waldhorn|hoorn|hoorns|cor\s+in|cor\s+en)\b/.test(rawText) || /^(hn|cor)\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'french-horn', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(trumpet|trumpets|tromba|trombe|trompete|trompeten|trompette|trompet|cornet|clarino|flugelhorn)\b/.test(rawText) || /^(tpt|tr|trp)\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'trumpet', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(trombone|trombones|posaune|posaunen|sackbut)\b/.test(rawText) || /^(trb|tbn|pos)\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'trombone', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(tuba|euphonium|bombardino|ophicleide|sousaphone)\b/.test(rawText)) {
            return { patchId: 'tuba', isVocal: false, roleTag: 'Score' };
        }

        // Strings (Check Contrabass before Cello/Bass; Viola before Violin)
        if (/\b(contrabass|kontrabass|contrebasse|contrabas|double\s*bass|string\s*bass|violone)\b/.test(rawText) || /^(cb|db|kb)\.?$/i.test(abbrev)) {
            return { patchId: 'contrabass', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(violoncello|violoncelli|violoncelle|violoncel|cello|celli)\b/.test(rawText) || /^(vc|vlc)\.?$/i.test(abbrev)) {
            return { patchId: 'cello', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(viola|viole|bratsche|altviool|viola\s+da\s+gamba)\b/.test(rawText) || /^(vla|va)\.?$/i.test(abbrev)) {
            return { patchId: 'viola', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(violin|violins|violino|violini|violine|violinen|violon|violons|viool|fiddle)\b/.test(rawText) || /^(vln|vl)\.?\s*[1234i]*$/i.test(abbrev)) {
            return { patchId: 'violin', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(harp|arpa|harfe|harpe)\b/.test(rawText)) {
            return { patchId: 'harp', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(guitar|chitarra|gitarre|guitare|gitaar|lute|liuto|laute|theorbo|mandolin)\b/.test(rawText)) {
            return { patchId: 'guitar-nylon', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(strings|string\s*orchestra|archi|streicher|cordes|strijkers)\b/.test(rawText)) {
            return { patchId: 'strings', isVocal: false, roleTag: 'Score' };
        }

        // Keyboards & Continuo
        if (/\b(harpsichord|cembalo|clavicembalo|clavecin|klavecimbel|virginal|spinet|continuo|basso\s*continuo)\b/.test(rawText) || /^(cemb|b\.?c\.?)$/i.test(abbrev)) {
            return { patchId: 'harpsichord', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(harmonium|reed\s*organ|accordion|akkordeon|bandoneon)\b/.test(rawText)) {
            return { patchId: 'harmonium', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(organ|organo|orgel|orgue|pipe\s*organ|positif)\b/.test(rawText) || /^org\.?$/i.test(abbrev)) {
            return { patchId: 'organ', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(piano|pianoforte|klavier|fortepiano)\b/.test(rawText) || /^(pno|pf)\.?$/i.test(abbrev)) {
            return { patchId: 'piano', isVocal: false, roleTag: 'Score' };
        }

        // Percussion & Mallets
        if (/\b(timpani|pauken|timbales)\b/.test(rawText) || /^timp\.?$/i.test(abbrev)) {
            return { patchId: 'timpani', isVocal: false, roleTag: 'Score' };
        }
        if (/\b(xylophone|marimba|glockenspiel|vibraphone|celesta|campanelli|chimes|tubular\s*bells)\b/.test(rawText)) {
            return { patchId: 'xylophone', isVocal: false, roleTag: 'Score' };
        }

        // --------------------------------------------------
        // 4. GENERAL MIDI PROGRAM FALLBACK (1..128)
        // --------------------------------------------------
        if (gmProg1 !== null && gmProg1 >= 1 && gmProg1 <= 128) {
            if (gmProg1 >= 53 && gmProg1 <= 55) return { patchId: 'piano', isVocal: true, roleTag: 'Vocal → Piano' };
            if (gmProg1 >= 1 && gmProg1 <= 6) return { patchId: 'piano', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 7 && gmProg1 <= 8) return { patchId: 'harpsichord', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 9 && gmProg1 <= 16) return { patchId: 'xylophone', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 17 && gmProg1 <= 21) return { patchId: 'organ', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 22 && gmProg1 <= 24) return { patchId: 'harmonium', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 25 && gmProg1 <= 32) return { patchId: 'guitar-nylon', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 33 && gmProg1 <= 40) return { patchId: 'contrabass', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 41) return { patchId: 'violin', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 42) return { patchId: 'viola', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 43) return { patchId: 'cello', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 44) return { patchId: 'contrabass', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 47) return { patchId: 'harp', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 48) return { patchId: 'timpani', isVocal: false, roleTag: 'Score' };
            if ((gmProg1 >= 45 && gmProg1 <= 46) || (gmProg1 >= 49 && gmProg1 <= 52)) {
                return { patchId: 'strings', isVocal: false, roleTag: 'Score' };
            }
            if (gmProg1 === 57 || gmProg1 === 60) return { patchId: 'trumpet', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 58) return { patchId: 'trombone', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 59) return { patchId: 'tuba', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 61 && gmProg1 <= 64) return { patchId: 'french-horn', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 65 && gmProg1 <= 68) return { patchId: 'saxophone', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 69) return { patchId: 'oboe', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 70) return { patchId: 'english-horn', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 71) return { patchId: 'bassoon', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 72) return { patchId: 'clarinet', isVocal: false, roleTag: 'Score' };
            if (gmProg1 === 73) return { patchId: 'piccolo', isVocal: false, roleTag: 'Score' };
            if (gmProg1 >= 74 && gmProg1 <= 80) return { patchId: 'flute', isVocal: false, roleTag: 'Score' };
        }

        // Default to Grand Piano
        return { patchId: 'piano', isVocal: false, roleTag: 'Piano' };
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

    /**
     * Loads and caches the ToneAudioBuffers for a classical instrument patch on demand.
     * Multiple parts sharing the same patch reuse the single cached buffer set.
     */
    async function loadInstrumentBuffersOnce(patchId) {
        const def = INSTRUMENT_CATALOG[patchId] || INSTRUMENT_CATALOG.piano;
        if (!def.urls) return null; // Synth-only instrument (e.g. timpani)
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
            case 'timpani':
                return new Tone.PolySynth(Tone.MembraneSynth, {
                    maxPolyphony: 8,
                    pitchDecay: 0.015,
                    octaves: 1.4,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.004, decay: 0.65, sustain: 0.05, release: 0.5 },
                    volume: -4,
                }).connect(destinationNode);
            case 'strings':
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16,
                    oscillator: { type: 'fatsawtooth', count: 3, spread: 16 },
                    envelope: { attack: 0.055, decay: 0.15, sustain: 0.82, release: 0.38 },
                    volume: -10,
                }).connect(destinationNode);
            case 'woodwind':
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 12,
                    oscillator: { type: 'triangle2' },
                    envelope: { attack: 0.03, decay: 0.1, sustain: 0.85, release: 0.25 },
                    volume: -7,
                }).connect(destinationNode);
            case 'reed':
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 12,
                    oscillator: { type: 'pulse', width: 0.35 },
                    envelope: { attack: 0.025, decay: 0.12, sustain: 0.8, release: 0.24 },
                    volume: -11,
                }).connect(destinationNode);
            case 'brass':
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 12,
                    oscillator: { type: 'sawtooth4' },
                    envelope: { attack: 0.03, decay: 0.14, sustain: 0.82, release: 0.28 },
                    volume: -9,
                }).connect(destinationNode);
            case 'organ':
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16,
                    oscillator: { type: 'sine2' },
                    envelope: { attack: 0.035, decay: 0.1, sustain: 0.88, release: 0.22 },
                    volume: -8,
                }).connect(destinationNode);
            case 'plucked':
                return new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16,
                    oscillator: { type: 'sawtooth6' },
                    envelope: { attack: 0.004, decay: 0.38, sustain: 0.08, release: 0.25 },
                    volume: -9,
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
            part.gainNode = new Tone.Gain((part.volume ?? CONFIG.DEFAULT_PART_VOLUME) / 100).connect(state.masterGain);
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
        if (state.audioReadyPromise) return state.audioReadyPromise;
        state.isLoadingAudio = true;
        updatePlayPauseButtonUI();

        state.audioReadyPromise = (async () => {
            try {
                if (!state.audioInitialized) {
                    await Tone.start();
                    // Minimize scheduling lookahead (default 100ms -> 30ms) for snappy mobile & desktop sync
                    try {
                        const ctx = typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context;
                        if (ctx && typeof ctx.lookAhead === 'number') {
                            ctx.lookAhead = 0.03;
                        }
                    } catch (_) { /* ignore */ }
                    ensureMasterAudioChain();
                    state.audioInitialized = true;
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
        if (part.gainNode && part.gainNode.gain.value < 0.1) {
            const auditionGain = Math.max(0.75, (part.volume || CONFIG.DEFAULT_PART_VOLUME) / 100);
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
            const part = state.parts[ev.partId];
            if (!part || !part.instrument) return;

            const def = INSTRUMENT_CATALOG[part.patchId] || INSTRUMENT_CATALOG.piano;

            // Live concert pitch frequency (supports real-time 440Hz / 415Hz switching!)
            const freqHz = state.concertPitchHz * Math.pow(2, (ev.midi - 69) / 12);

            // Live tempo-scaled duration with instrument-specific legato/articulation factor
            const liveBpm = Math.max(10, Tone.Transport.bpm.value || getEffectiveBpm());
            const secPerWhole = (60 / liveBpm) * 4;
            const durFactor = def.durationFactor ?? 0.95;
            const durationSec = Math.max(0.05, ev.durationWhole * secPerWhole * durFactor);

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
            const rawPartInfos = osmd.sheet.Instruments.map((inst, idx) => {
                const partId = inst.IdString || `part_${inst.Id ?? idx}`;
                const xmlMeta = state.rawXmlPartMeta[partId] || null;
                const partName = (inst.Name || inst.NameLabel?.text || xmlMeta?.partName || `Part ${idx + 1}`).trim();
                const subInst = inst.SubInstruments && inst.SubInstruments[0];

                // Check if any voice in this instrument contains vocal lyrics
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
                };
            });

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

            // Capture graphical note SVG elements & sourceNote map at this cursor step
            const svgNotes = [];
            const gNoteBySource = new Map();
            const clickableNotes = [];
            try {
                if (typeof osmd.cursor.GNotesUnderCursor === 'function') {
                    const gNotes = osmd.cursor.GNotesUnderCursor();
                    if (gNotes) {
                        for (const gn of gNotes) {
                            const svgEl = typeof gn.getSVGGElement === 'function' ? gn.getSVGGElement() : null;
                            if (svgEl) {
                                const gnInst = gn.sourceNote?.ParentVoiceEntry?.ParentVoice?.Parent;
                                const gnPartId = gnInst ? (gnInst.IdString || `part_${gnInst.Id ?? 0}`) : 'part_0';
                                svgEl.dataset.partId = gnPartId;
                                svgNotes.push(svgEl);
                            }
                            if (gn && gn.sourceNote) {
                                gNoteBySource.set(gn.sourceNote, { gn, svgEl });
                            }
                        }
                    }
                }
            } catch (_) { /* optional highlight */ }

            const voiceEntries = iter.CurrentVoiceEntries;
            if (voiceEntries) {
                for (const ve of voiceEntries) {
                    const inst = ve.ParentVoice?.Parent;
                    const partId = inst ? (inst.IdString || `part_${inst.Id ?? 0}`) : 'part_0';
                    const partName = inst ? (inst.Name || inst.NameLabel?.text || `Part ${(inst.Id ?? 0) + 1}`).trim() : 'Part 1';

                    if (!nextParts[partId]) {
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

                    for (const note of ve.Notes) {
                        if (note.isRest() || !note.Pitch || note.isGrace) continue;

                        const writtenDurationWhole = note.Length?.RealValue ?? 0;
                        if (writtenDurationWhole <= 0.0005) continue;

                        const midi = extractMidiNote(note);
                        if (midi === null) continue;

                        // Record every visible pitched notehead (including tied continuations) for click selection & auditioning
                        const gEntry = gNoteBySource.get(note);
                        const pos = gEntry?.gn?.PositionAndShape?.AbsolutePosition;
                        const noteX = (pos && typeof pos.x === 'number') ? (pos.x * 10 * state.zoom) : (coords.x + 6 * state.zoom);
                        const noteY = (pos && typeof pos.y === 'number') ? (pos.y * 10 * state.zoom) : null;

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

                        // For scheduled playback: skip tied continuation notes and sum full tied duration on the start note
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

            const hitX = clickableNotes.length > 0
                ? (clickableNotes.reduce((sum, cn) => sum + cn.noteX, 0) / clickableNotes.length)
                : (coords.x + 6 * state.zoom);

            cursorSteps.push({
                stepIdx,
                ticks,
                realValue,
                measureIndex,
                x: coords.x,
                hitX,
                y: coords.y,
                height: coords.height,
                svgNotes,
                clickableNotes,
            });

            osmd.cursor.next();
            stepIdx++;
        }

        // Compute total playable duration in ticks
        const lastBarEnd = barData.length ? barData[barData.length - 1].endTicks : 0;
        const lastStepTick = cursorSteps.length ? cursorSteps[cursorSteps.length - 1].ticks : 0;
        state.totalMusicalTicks = Math.max(lastBarEnd, maxNoteEndTicks, lastStepTick, 1);

        // Compute horizontal end X of final barline for smooth continuous panning through the last measure
        const lastStepX = cursorSteps.length ? cursorSteps[cursorSteps.length - 1].x : 0;
        let scoreEndX = lastStepX + 60;
        try {
            const mList = osmd.GraphicSheet?.MeasureList;
            if (Array.isArray(mList) && mList.length > 0) {
                const lastCol = mList[mList.length - 1];
                const gm = Array.isArray(lastCol) ? lastCol[0] : null;
                if (gm && gm.PositionAndShape) {
                    const rightUnits = (gm.PositionAndShape.AbsolutePosition?.x ?? 0) + (gm.PositionAndShape.Size?.width ?? 0);
                    const rightPx = rightUnits * 10 * state.zoom;
                    if (rightPx > lastStepX) {
                        scoreEndX = rightPx;
                    }
                }
            }
        } catch (_) { /* fallback used */ }
        state.scoreEndX = scoreEndX;

        state.parts = nextParts;
        state.notes = notes;
        state.cursorSteps = cursorSteps;
        state.barData = barData;
        state.metronomeBeats = metronomeBeats;

        // Reset cursor back to step 0 (very beginning of score) cleanly
        osmd.cursor.reset();
        osmd.cursor.show();
        applyCursorStyle();
        state.currentStepIndex = 0;

        if (!preserveMixerSettings) {
            state.currentTicks = 0;
            state.smoothTicks = 0;
            if (barData.length > 0) {
                state.loopStartBar = 1;
                state.loopEndBar = Math.min(barData.length, Math.max(2, Math.min(4, barData.length)));
                syncLoopInputsUI();
            }
        }

        // Apply 50% horizontal padding in Continuous View and position camera at start
        updateContinuousHorizontalPadding(false);
        if (!preserveMixerSettings) {
            updateCameraForTicks(0, 0, true);
        }

        // Rebuild UI elements
        updateTempoReadoutUI();
        setupTimelineUI();
        renderPartMixerUI();
        renderStaffHighlights();

        // Schedule audio parts if audio already started
        if (state.audioInitialized) {
            if (!preserveMixerSettings) {
                loadAndBuildAllPartInstruments();
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

        updateContinuousHorizontalPadding(true);

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

    function updateContinuousHorizontalPadding(resetForRender = false) {
        const box = dom.scoreDisplayArea;
        const track = box ? box.querySelector('.osmd-score-track') : null;
        const inner = box ? box.querySelector('.osmd-score-inner') : null;
        if (!box || !track) {
            state.continuousPadX = 0;
            return;
        }

        track.classList.toggle('page-mode', !state.continuousScrollMode);

        if (resetForRender || !state.continuousScrollMode) {
            state.continuousPadX = 0;
            track.style.paddingLeft = '0px';
            track.style.paddingRight = '0px';
            if (inner) inner.style.transform = '';
            return;
        }

        const padX = Math.max(0, Math.round(box.clientWidth * CONFIG.CONTINUOUS_CURSOR_ANCHOR_X));
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
        if (targetIndex > state.currentStepIndex) {
            const delta = targetIndex - state.currentStepIndex;
            if (delta === 1) {
                cursor.next();
            } else {
                // Temporarily suppress intermediate DOM updates for instant O(1)-DOM fast-forward
                // while preserving 100% of OSMD's native cursor.next() traversal logic
                const origUpdate = cursor.update;
                cursor.update = () => { };
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
            cursor.update = () => { };
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

    function updateCameraForTicks(nowTicks, dt, snap = false, keepViewport = false) {
        const box = dom.scoreDisplayArea;
        const steps = state.cursorSteps;
        if (!box || !steps.length) return;

        const stepIdx = state.currentStepIndex;
        const curr = steps[stepIdx];
        if (!curr) return;

        if (state.continuousScrollMode) {
            // Smoothly interpolate playhead X across the score at 60fps+
            const interpX = getInterpolatedCursorX(nowTicks);

            // Glide the cursor element smoothly with the interpolated playhead
            const cursorEl = state.osmd?.cursor?.cursorElement;
            const cursorType = getCurrentCursorType();
            const isMeasureCursor = cursorType === 3 || cursorType === 4;
            if (cursorEl && !isMeasureCursor) {
                cursorEl.style.left = `${interpX.toFixed(2)}px`;
            }

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
            const desiredX = Math.max(0, Math.min(maxScrollX, (state.continuousPadX + interpX) - anchorOffset));

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

            // Vertical scroll: ONLY auto-center vertically when a part is highlighted ('H')!
            // When no part is highlighted, leave box.scrollTop completely untouched so mobile & desktop
            // users can scroll vertically without ever rubberbanding back to the top.
            if (state.highlightedStaffBands && state.highlightedStaffBands.length > 0) {
                updateVerticalCenteringForHighlight(snap, dt);
            }
        } else {
            // Page View: if a part is highlighted, keep the active system's highlighted staff vertically centered
            if (state.highlightedStaffBands && state.highlightedStaffBands.length > 0) {
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
        const liveBpm = getEffectiveBpm();
        const ppq = state.ticksPerWhole / 4;
        const ticksPerSec = (liveBpm / 60) * ppq;
        state.smoothTicks += dt * ticksPerSec;

        const drift = audibleTicks - state.smoothTicks;
        if (Math.abs(drift) > ppq * 0.45) {
            state.smoothTicks = audibleTicks;
        } else {
            state.smoothTicks += drift * Math.min(1, dt * 12);
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
        releaseAllInstruments();
        clearAllNoteHighlights();

        const bar = getBarObjAtTicks(targetTicks);
        if (bar) {
            state.activeBarBaseBpm = bar.bpm;
            Tone.Transport.bpm.value = getEffectiveBpm();
            updateTempoReadoutUI();
        }

        // Pause -> set exact ticks -> rebuild fresh Tone.Part (so backward & forward jumps always trigger!) -> start immediately
        Tone.Transport.pause();
        Tone.Transport.ticks = targetTicks;
        state.currentTicks = targetTicks;
        state.smoothTicks = targetTicks;
        state.playbackStartTicks = targetTicks;
        scheduleToneParts();

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

        Tone.Transport.start();
    }

    // ===========================================
    // PLAY / PAUSE / STOP / SEEK CONTROLS
    // ===========================================

    async function startPlayback() {
        if (!state.scoreLoaded || !state.notes.length) return;
        if (state.isPlaying) return;

        const ready = await ensureAudioReady();
        if (!ready) return;

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
        Tone.Transport.ticks = startTicks;
        scheduleToneParts();
        Tone.Transport.start();

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
        state.smoothTicks = state.currentTicks;
        state.isPlaying = false;

        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }

        if (state.audioInitialized && Tone.Transport.state === 'started') {
            Tone.Transport.pause();
        }

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
            btn.title = 'Loading instrument samples…';
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
        const isModified = partList.some(
            (p) => p.muted || p.soloed || p.highlighted || p.volume !== CONFIG.DEFAULT_PART_VOLUME || (p.detectedPatchId && p.patchId !== p.detectedPatchId)
        );
        dom.resetMixerBtn.hidden = !isModified;
    }

    /**
     * Renders a bright yellow marker highlight across the staff (or staves) of any highlighted part.
     * Works seamlessly in both Continuous View and multi-system Page View.
     */
    function renderStaffHighlights() {
        const box = dom.scoreDisplayArea;
        const inner = box ? (box.querySelector('.osmd-score-inner') || box) : null;
        if (!inner) return;

        let layer = inner.querySelector('.staff-highlight-layer');
        const highlightedPartIds = new Set(
            Object.values(state.parts)
                .filter((p) => p.highlighted)
                .map((p) => p.id)
        );

        state.highlightedStaffBands = [];

        if (!state.scoreLoaded || !state.osmd || highlightedPartIds.size === 0) {
            if (layer) layer.remove();
            updateVerticalCenteringForHighlight(true);
            return;
        }

        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'staff-highlight-layer';
            inner.insertBefore(layer, inner.firstChild);
        } else {
            layer.innerHTML = '';
        }

        const osmd = state.osmd;
        const unitToPx = 10 * state.zoom;

        // Build lookup from OSMD Staff object and staff index to partId
        const staffToPartId = new Map();
        const staffIndexToPartId = [];
        if (osmd.sheet?.Instruments) {
            osmd.sheet.Instruments.forEach((inst, instIdx) => {
                const pid = inst.IdString || `part_${inst.Id ?? instIdx}`;
                if (Array.isArray(inst.Staves) && inst.Staves.length > 0) {
                    for (const st of inst.Staves) {
                        staffToPartId.set(st, pid);
                        staffIndexToPartId.push(pid);
                    }
                } else {
                    staffIndexToPartId.push(pid);
                }
            });
        }

        const frag = document.createDocumentFragment();
        let bandsAdded = 0;

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

                        if (!partId || !highlightedPartIds.has(partId)) continue;

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

                        const band = document.createElement('div');
                        band.className = 'staff-marker-band';
                        band.style.left = `${leftPx.toFixed(1)}px`;
                        band.style.top = `${topPx.toFixed(1)}px`;
                        band.style.width = `${widthPx.toFixed(1)}px`;
                        band.style.height = `${heightPx.toFixed(1)}px`;
                        frag.appendChild(band);
                        state.highlightedStaffBands.push({
                            topPx,
                            heightPx,
                            centerY: topPx + heightPx * 0.5,
                        });
                        bandsAdded++;
                    }
                }
            }
        }

        // Fallback via MeasureList if MusicSystems.StaffLines was unavailable
        if (bandsAdded === 0 && Array.isArray(osmd.GraphicSheet?.MeasureList)) {
            const mList = osmd.GraphicSheet.MeasureList;
            const rowBounds = new Map();
            for (let mIdx = 0; mIdx < mList.length; mIdx++) {
                const col = mList[mIdx];
                if (!Array.isArray(col)) continue;
                for (let sIdx = 0; sIdx < col.length; sIdx++) {
                    const partId = staffIndexToPartId[sIdx];
                    if (!partId || !highlightedPartIds.has(partId)) continue;
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
                const topPx = Math.max(0, (b.y - 1.35) * unitToPx);
                const heightPx = (b.h + 2.7) * unitToPx;
                const band = document.createElement('div');
                band.className = 'staff-marker-band';
                band.style.left = `${Math.max(0, (b.minX - 0.6) * unitToPx).toFixed(1)}px`;
                band.style.top = `${topPx.toFixed(1)}px`;
                band.style.width = `${((b.maxX - b.minX + 1.2) * unitToPx).toFixed(1)}px`;
                band.style.height = `${heightPx.toFixed(1)}px`;
                frag.appendChild(band);
                state.highlightedStaffBands.push({
                    topPx,
                    heightPx,
                    centerY: topPx + heightPx * 0.5,
                });
            }
        }

        layer.appendChild(frag);
        updateVerticalCenteringForHighlight(true);
    }

    /**
     * Vertically centers the currently highlighted part's staff in the middle of the score viewport.
     * Adds dynamic top/bottom padding to `.osmd-score-track` only when a part is highlighted so even
     * the top-most or bottom-most staff can sit in the exact vertical center. When no part is
     * highlighted, removes vertical padding and leaves `box.scrollTop` untouched for free scrolling.
     */
    function updateVerticalCenteringForHighlight(snap = true, dt = 1 / 60) {
        const box = dom.scoreDisplayArea;
        const track = box ? box.querySelector('.osmd-score-track') : null;
        const inner = box ? box.querySelector('.osmd-score-inner') : null;
        if (!box || !track) return;

        const bands = state.highlightedStaffBands;
        if (!bands || bands.length === 0) {
            track.style.paddingTop = '0px';
            track.style.paddingBottom = '0px';
            return;
        }

        // Pick the highlighted staff band on the active system (closest to current cursor step Y)
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

        const viewportH = box.clientHeight;
        if (viewportH <= 0) return;
        const halfH = viewportH * 0.5;
        const innerH = inner ? inner.offsetHeight : box.scrollHeight;
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

    function buildPartInstrumentSelect(part) {
        const select = document.createElement('select');
        select.className = 'part-instrument-select';
        select.title = `Select playback instrument for ${part.name} (Score default: ${INSTRUMENT_CATALOG[part.detectedPatchId]?.label || 'Grand Piano'})`;
        select.setAttribute('aria-label', `${part.name} Instrument`);

        // Group catalog entries by category
        const groups = {};
        for (const def of Object.values(INSTRUMENT_CATALOG)) {
            if (!groups[def.category]) groups[def.category] = [];
            groups[def.category].push(def);
        }

        for (const [category, items] of Object.entries(groups)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;

            for (const def of items) {
                const opt = document.createElement('option');
                opt.value = def.id;
                const isScoreDefault = def.id === part.detectedPatchId;
                const defaultSuffix = isScoreDefault
                    ? (part.isVocal ? ' ★ (Vocal)' : ' ★ (Score)')
                    : '';
                opt.textContent = `${def.label}${defaultSuffix}`;
                optgroup.appendChild(opt);
            }
            select.appendChild(optgroup);
        }

        select.value = part.patchId || 'piano';

        select.addEventListener('change', () => {
            const chosenPatch = select.value;
            if (dom.soundSelect && dom.soundSelect.value !== 'auto') {
                state.soundPreset = 'auto';
                dom.soundSelect.value = 'auto';
            }
            setPartInstrument(part.id, chosenPatch, true);
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

            // Row 1: Part Name + Vocal/Score Tag + Mute / Solo / Highlight Buttons
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
            highlightBtn.title = `Highlight ${part.name} (Yellow staff marker, 100% volume, other parts 50%)`;
            highlightBtn.setAttribute('aria-pressed', String(Boolean(part.highlighted)));
            highlightBtn.addEventListener('click', () => {
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
                refreshActiveNoteHighlightColors();
                applyAllPartGains(false);
                if (willHighlight) {
                    toast(`Highlighted ${part.name} (100% volume, other parts 50%)`);
                }
            });

            btnGroup.appendChild(muteBtn);
            btnGroup.appendChild(soloBtn);
            btnGroup.appendChild(highlightBtn);
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
            osmd.zoom = state.zoom;
            osmd.render();

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

        // If A-B Loop is active and the user clicked a note outside the loop range, shift loop range to include it
        if (state.loopEnabled && state.barData.length > 0) {
            const { startTicks: loopStart, endTicks: loopEnd } = getLoopBoundsTicks();
            if (bestStep.ticks < loopStart || bestStep.ticks >= loopEnd) {
                const clickedBarNum = getBarNumberAtTicks(bestStep.ticks);
                const span = Math.max(0, state.loopEndBar - state.loopStartBar);
                state.loopStartBar = clickedBarNum;
                state.loopEndBar = Math.min(state.barData.length, clickedBarNum + span);
                syncLoopInputsUI();
            }
        }

        if (state.isPlaying) {
            // During playback: jump immediately to the clicked note and continue playing smoothly from there
            seekToTicks(bestStep.ticks, { snapScroll: false, keepPlaying: true, glideCamera: true });
        } else {
            // While paused: place cursor on clicked note without jerking the score away from the mouse,
            // highlight the selected note, and play its pitch & note value
            seekToTicks(bestStep.ticks, { snapScroll: false, keepPlaying: false, keepViewport: true });
            highlightStepNotes(bestStep.stepIdx, clickedNote?.svgEl || null);
            if (clickedNote) {
                auditionClickedNote(clickedNote);
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
    // EVENT LISTENERS
    // ===========================================

    function bindWelcomeScreenActions() {
        const welcomeOpenBtn = document.getElementById('welcomeOpenBtn');
        const demoChoraleBtn = document.getElementById('loadDemoScoreBtn');
        const demoEnsembleBtn = document.getElementById('loadDemoEnsembleBtn');

        if (welcomeOpenBtn) {
            welcomeOpenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (dom.fileInput) dom.fileInput.click();
            });
        }
        if (demoChoraleBtn) {
            demoChoraleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadMusicXMLContent(getDemoChoraleMusicXML(), 'Chorale in C Major (SATB)');
            });
        }
        if (demoEnsembleBtn) {
            demoEnsembleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                loadMusicXMLContent(getDemoEnsembleMusicXML(), 'Quartet in G Major (Fl/Ob/Vln/Vc)');
            });
        }
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
        state.cursorSteps = [];
        state.barData = [];
        state.metronomeBeats = [];
        state.highlightedStaffBands = [];
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
        state.soundPreset = 'auto';

        if (dom.soundSelect) dom.soundSelect.value = 'auto';
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

        // File Open buttons
        const triggerOpen = (e) => {
            if (e) e.stopPropagation();
            if (dom.fileInput) dom.fileInput.click();
        };
        if (dom.loadScoreButton) dom.loadScoreButton.addEventListener('click', triggerOpen);

        if (dom.fileInput) {
            dom.fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) loadScoreFromFile(file);
                dom.fileInput.value = '';
            });
        }

        bindWelcomeScreenActions();

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
            const isInteractiveWelcomeTarget = (target) => {
                if (!target || typeof target.closest !== 'function') return false;
                return Boolean(target.closest('#scorePlaceholder, .empty-state, .score-loading-state, .score-error-state, button, a, input, select'));
            };

            dom.scoreDisplayArea.addEventListener('pointerdown', (e) => {
                if (!state.scoreLoaded || isInteractiveWelcomeTarget(e.target)) {
                    pointerDownPos = null;
                    return;
                }
                pointerDownPos = { x: e.clientX, y: e.clientY };
            });
            dom.scoreDisplayArea.addEventListener('click', (e) => {
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
                state.soundPreset = dom.soundSelect.value;
                for (const part of Object.values(state.parts)) {
                    if (state.soundPreset === 'auto') {
                        part.patchId = part.detectedPatchId || 'piano';
                    } else if (INSTRUMENT_CATALOG[state.soundPreset]) {
                        part.patchId = state.soundPreset;
                    }
                }
                renderPartMixerUI();

                if (state.audioInitialized && Object.keys(state.parts).length > 0) {
                    await loadAndBuildAllPartInstruments();
                }
                const label = dom.soundSelect.options[dom.soundSelect.selectedIndex]?.textContent || state.soundPreset;
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

        // Reset Mixer button (Restores volume, mute/solo, AND score-default instruments!)
        if (dom.resetMixerBtn) {
            dom.resetMixerBtn.addEventListener('click', async () => {
                state.soundPreset = 'auto';
                if (dom.soundSelect) dom.soundSelect.value = 'auto';

                for (const part of Object.values(state.parts)) {
                    part.volume = CONFIG.DEFAULT_PART_VOLUME;
                    part.muted = false;
                    part.soloed = false;
                    part.highlighted = false;
                    part.patchId = part.detectedPatchId || 'piano';
                }
                renderPartMixerUI();
                renderStaffHighlights();
                refreshActiveNoteHighlightColors();
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
                        updateCameraForTicks(state.isPlaying ? state.smoothTicks : state.currentTicks, 0, true);
                    } else {
                        const newW = dom.scoreDisplayArea.clientWidth;
                        if (Math.abs(newW - lastBoxWidth) > 24) {
                            lastBoxWidth = newW;
                            reRenderScorePreservingState();
                        }
                    }
                }
            }, 220);
        });

        // MuseScore-Style Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
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
