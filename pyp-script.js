// pyp-script.js


// ===========================================
// CONFIGURATION AND CONSTANTS
// ===========================================

/**
 * UI text strings used throughout the application
 * These are centralized here to make text changes easier
 */
const UI_STRINGS = {
    LOADING_PIANO: "loading piano...",
    PLAY: "play",
    SAMPLE_ERROR: "sample error",
    LOADING_SCORE_MESSAGE: "Loading score...",
    ERROR_LOADING_SCORE_HTML: '<p style="color: red; text-align:center; padding: 20px;">Error loading score. Ensure it\'s a valid MusicXML file.</p>',
    ERROR_READING_FILE_HTML: '<p style="color: red; text-align:center; padding: 20px;">Error reading file.</p>',
};

/**
 * Application configuration settings
 * Contains all the important parameters that control how the application behaves
 */
const CONFIG = {
    // Visual settings
    CURSOR_CENTER_OFFSET_Y: 0.33,
    CURSOR_SCROLL_DEAD_ZONE_RATIO: 0.25,
    NOTE_HIGHLIGHT_CLASS: 'note-highlighted',
    OSMD_DRAWING_PARAMETERS: "compacttight",
    DEFAULT_CURSOR_COLOR: "#33E290",
    DEFAULT_CURSOR_ALPHA: 0.6,

    // Audio settings
    PIANO_SAMPLER_VOLUME_DB: 0,
    AUDIO_SAMPLES_BASE_URL: "https://tonejs.github.io/audio/salamander/",

    // Playback settings
    NOTE_EXTRACTION_SAFETY_BREAK: 20000,
    NOTE_UNHIGHLIGHT_OFFSET_S: 0.05,
    SLIDER_UPDATE_INTERVAL_S: "0.1",
    INITIAL_TEMPO_BPM: 120,
    DEFAULT_TEMPO_PERCENTAGE: 100,
    PLAYBACK_START_OFFSET: "+0.05",
    CURSOR_SYNC_TOLERANCE: 0.25,
    FUTURE_EVENT_TIME_OFFSET: 0.001,
    MIN_BPM_SAFETY: 0.01,
};

/**
 * Piano sample files mapping
 * Maps note names to their corresponding audio file names
 */
const PIANO_SAMPLE_FILES = {
    'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
    'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
    'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
    'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
    'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
    'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
    'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
    'A7': 'A7.mp3', 'C8': 'C8.mp3'
};

// ===========================================
// DOM ELEMENTS
// ===========================================

/**
 * Object containing all DOM elements used in the application
 * Centralizes all element references for easier management
 */
const dom = {
    // Score related elements
    loadScoreButton: document.getElementById('loadScoreButton'),
    fileInput: document.getElementById('fileInput'),
    scoreDisplayArea: document.getElementById('scoreDisplayArea'),
    scorePlaceholder: document.getElementById('scorePlaceholder'),

    // Playback control elements
    playButton: document.getElementById('playButton'),
    pauseButton: document.getElementById('pauseButton'),
    startButton: document.getElementById('startButton'),

    // Navigation elements
    navigationSlider: document.getElementById('navigationSlider'),
    currentTimeDisplay: document.getElementById('currentTimeDisplay'),
    totalTimeDisplay: document.getElementById('totalTimeDisplay'),

    // Tuning elements
    a440Button: document.getElementById('a440'),
    a415Button: document.getElementById('a415'),

    // Volume and tempo controls
    masterVolumeSlider: document.getElementById('masterVolume'),
    volumeValueOutput: document.getElementById('volumeValueOutput'),
    cursorTypeSelect: document.getElementById('cursorTypeSelect'),
    tempoSlider: document.getElementById('tempoSlider'),
    tempoValueOutput: document.getElementById('tempoValueOutput'),
};

// ===========================================
// GLOBAL STATE VARIABLES
// ===========================================

/**
 * These variables maintain the application's state
 * They are modified throughout the application's lifecycle
 */
let osmd;                           // OpenSheetMusicDisplay instance
let playbackPart;                  // Tone.Part instance for playing notes
let toneSynth;                     // Tone.Sampler instance (piano sound)
let audioContextStarted = false;    // Tracks if audio context is initialized
let notesToSchedule = [];          // Array of notes to be played
let currentScoreTempo = CONFIG.INITIAL_TEMPO_BPM;  // Current tempo in BPM
let currentTempoPercentage = CONFIG.DEFAULT_TEMPO_PERCENTAGE;
let cursorEventTimes = [];         // Times when cursor should move
let scheduledCursorUpdateIDs = []; // IDs of scheduled cursor updates
let totalPlayableDuration = 0;     // Total duration of the piece
let sliderUpdateIntervalID = null; // ID for slider update interval
let wholeNoteDurationForSeek = (60 / CONFIG.INITIAL_TEMPO_BPM) * 4;
let isSliderDragging = false;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Formats time in seconds to MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

/**
 * Ensures the cursor is visible in the viewport
 * Scrolls the score if necessary to keep cursor in view
 */
function ensureCursorIsVisible(centerOffsetY = CONFIG.CURSOR_CENTER_OFFSET_Y) {
    if (!osmd || !osmd.cursor || !osmd.cursor.cursorElement || !dom.scoreDisplayArea) { return; }
    
    const cursorElement = osmd.cursor.cursorElement;
    if (typeof cursorElement.getBoundingClientRect !== 'function') { return; }
    
    try {
        if (cursorElement.style.display === "none" || osmd.cursor.Hidden) { return; }
        
        const scoreDisplayRect = dom.scoreDisplayArea.getBoundingClientRect();
        const cursorRect = cursorElement.getBoundingClientRect();
        
        // Skip if cursor element is not truly visible
        if ((cursorRect.width === 0 && cursorRect.height === 0) || 
            (cursorRect.top === 0 && cursorRect.left === 0 && 
             cursorRect.right === 0 && cursorRect.bottom === 0)) { return; }
        
        const containerHeight = dom.scoreDisplayArea.clientHeight;
        const currentScrollTop = dom.scoreDisplayArea.scrollTop;
        const cursorTopRelativeToContainerViewport = cursorRect.top - scoreDisplayRect.top;
        const cursorYInScrollableContent = currentScrollTop + cursorTopRelativeToContainerViewport;
        const cursorHeight = cursorRect.height;
        const desiredCursorViewPosition = containerHeight * centerOffsetY;
        const targetScrollTop = cursorYInScrollableContent - desiredCursorViewPosition;
        
        // Calculate dead zone for smoother scrolling
        const deadZoneRatio = CONFIG.CURSOR_SCROLL_DEAD_ZONE_RATIO;
        const deadZoneTopLimit = currentScrollTop + (containerHeight * deadZoneRatio);
        const deadZoneBottomLimit = currentScrollTop + containerHeight - 
                                  (containerHeight * deadZoneRatio) - cursorHeight;
        
        // Only scroll if cursor is outside the dead zone
        if (cursorYInScrollableContent < deadZoneTopLimit || 
            cursorYInScrollableContent > deadZoneBottomLimit) {
            dom.scoreDisplayArea.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }
    } catch (e) { 
        console.warn("[ensureCursorIsVisible] Error:", e); 
    }
}


// --- Helper Function to Scroll View to Cursor ---

function ensureCursorIsVisible(centerOffsetY = CONFIG.CURSOR_CENTER_OFFSET_Y) {

    if (!osmd || !osmd.cursor || !osmd.cursor.cursorElement || !dom.scoreDisplayArea) { return; }

    const cursorElement = osmd.cursor.cursorElement;

    if (typeof cursorElement.getBoundingClientRect !== 'function') { return; }

    try {

        if (cursorElement.style.display === "none" || osmd.cursor.Hidden) { return; }

        const scoreDisplayRect = dom.scoreDisplayArea.getBoundingClientRect();

        const cursorRect = cursorElement.getBoundingClientRect();

        if ((cursorRect.width === 0 && cursorRect.height === 0) || (cursorRect.top === 0 && cursorRect.left === 0 && cursorRect.right === 0 && cursorRect.bottom === 0 )) { return; } // Element not truly visible

        const containerHeight = dom.scoreDisplayArea.clientHeight;

        const currentScrollTop = dom.scoreDisplayArea.scrollTop;

        const cursorTopRelativeToContainerViewport = cursorRect.top - scoreDisplayRect.top;

        const cursorYInScrollableContent = currentScrollTop + cursorTopRelativeToContainerViewport;

        const cursorHeight = cursorRect.height;

        const desiredCursorViewPosition = containerHeight * centerOffsetY;

        const targetScrollTop = cursorYInScrollableContent - desiredCursorViewPosition;

        const deadZoneRatio = CONFIG.CURSOR_SCROLL_DEAD_ZONE_RATIO;

        const deadZoneTopLimit = currentScrollTop + (containerHeight * deadZoneRatio);

        const deadZoneBottomLimit = currentScrollTop + containerHeight - (containerHeight * deadZoneRatio) - cursorHeight;

        if (cursorYInScrollableContent < deadZoneTopLimit || cursorYInScrollableContent > deadZoneBottomLimit) {

            dom.scoreDisplayArea.scrollTo({ top: targetScrollTop, behavior: 'smooth' });

        }

    } catch (e) { console.warn("[ensureCursorIsVisible] Error:", e); }

}


// --- Helper to Update Play Button State ---

/**
 * Updates the play button state based on the application status
 * @param {string} status - Current status ('loading', 'error', 'ready')
 * @param {boolean} hasNotes - Whether there are notes available to play
 */
function updatePlayButtonState(status, hasNotes = false) {
    if (!dom.playButton) return;

    switch (status) {
        case "loading": 
            dom.playButton.disabled = true; 
            dom.playButton.textContent = UI_STRINGS.LOADING_PIANO; 
            break;
        case "error": 
            dom.playButton.disabled = true; 
            dom.playButton.textContent = UI_STRINGS.SAMPLE_ERROR; 
            break;
        case "ready": 
            dom.playButton.disabled = !hasNotes; 
            dom.playButton.textContent = UI_STRINGS.PLAY; 
            break;
        default: 
            dom.playButton.disabled = true; 
            dom.playButton.textContent = UI_STRINGS.PLAY;
    }
}


// ===========================================
// AUDIO INITIALIZATION
// ===========================================

/**
 * Initializes the audio context and loads piano samples
 * This must be called before any audio can be played
 */
async function initializeAudio() {
    const initSynthAndLoadSamples = async () => {
        if (!toneSynth) {
            console.log("Initializing Tone.Sampler (piano) and loading samples...");
            updatePlayButtonState("loading");

            const samplerOptions = {
                urls: PIANO_SAMPLE_FILES,
                baseUrl: CONFIG.AUDIO_SAMPLES_BASE_URL,
                release: 1,
                volume: CONFIG.PIANO_SAMPLER_VOLUME_DB
            };

            toneSynth = new Tone.Sampler(samplerOptions).toDestination();

            try {
                await Tone.loaded();
                console.log("Piano samples loaded.");
                updatePlayButtonState("ready", notesToSchedule.length > 0);

                 // Apply initial master volume if context is now started
                if (dom.masterVolumeSlider) {
                    setGlobalVolume(parseInt(dom.masterVolumeSlider.value));
                }
            } catch (error) {
                console.error("Error loading piano samples:", error);
                updatePlayButtonState("error");
                throw error;
            }
        } else {
            updatePlayButtonState("ready", notesToSchedule.length > 0);
        }
    };

    if (!audioContextStarted) {
        try {
            await Tone.start();
            console.log("AudioContext started.");
            audioContextStarted = true;
            await initSynthAndLoadSamples();
        } catch (e) {
            console.error("Error starting AudioContext/loading samples:", e);
            updatePlayButtonState("error");
            throw e;
        }
    } else {
        await initSynthAndLoadSamples();
    }
}


// ===========================================
// PLAYBACK STATE MANAGEMENT
// ===========================================

/**
 * Resets the playback state of the application
 * @param {boolean} fullReset - Whether to perform a complete reset including score data
 */
function resetPlaybackState(fullReset = true) {
    console.log(`Resetting playback state (full: ${fullReset})...`);

    // Stop and clear transport
    if (Tone.Transport.state !== "stopped") Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Tone.Transport.position = "0:0:0";
    
    // Clear playback part
    if (playbackPart) {
        playbackPart.stop(0);
        playbackPart.clear();
        playbackPart.dispose();
        playbackPart = null;
    }
    
    // Clear scheduled updates
    scheduledCursorUpdateIDs.forEach(id => Tone.Transport.clear(id));
    scheduledCursorUpdateIDs = [];
    
    if (sliderUpdateIntervalID !== null) {
        Tone.Transport.clear(sliderUpdateIntervalID);
        sliderUpdateIntervalID = null;
    }

    if (fullReset) {
        // Reset all score-related data
        notesToSchedule = [];
        cursorEventTimes = [];
        totalPlayableDuration = 0;
        currentScoreTempo = CONFIG.INITIAL_TEMPO_BPM;
        currentTempoPercentage = CONFIG.DEFAULT_TEMPO_PERCENTAGE;

        if (dom.tempoSlider) dom.tempoSlider.value = CONFIG.DEFAULT_TEMPO_PERCENTAGE;
        if (dom.tempoValueOutput) dom.tempoValueOutput.textContent = `${CONFIG.DEFAULT_TEMPO_PERCENTAGE}%`;

        wholeNoteDurationForSeek = (60 / CONFIG.INITIAL_TEMPO_BPM) * 4;

        if (dom.scoreDisplayArea) dom.scoreDisplayArea.innerHTML = '';
        if (dom.scorePlaceholder) dom.scorePlaceholder.style.display = 'block';
    }
    
    // Reset cursor and UI elements
    if (osmd && osmd.cursor) {
        osmd.cursor.reset();
        if (osmd.cursor.Hidden) osmd.cursor.show();
        else osmd.cursor.update();
        ensureCursorIsVisible();
    }
    
    if (dom.navigationSlider) {
        dom.navigationSlider.disabled = true;
        dom.navigationSlider.value = 0;
    }

    if (dom.currentTimeDisplay) dom.currentTimeDisplay.textContent = formatTime(0);
    if (dom.totalTimeDisplay) dom.totalTimeDisplay.textContent = formatTime(0);

    if (dom.playButton) {
        dom.playButton.classList.remove('active');
        updatePlayButtonState("ready", notesToSchedule.length > 0 && fullReset ? false : notesToSchedule.length > 0);
        if (fullReset) dom.playButton.disabled = true;
    }

    if (dom.pauseButton) dom.pauseButton.classList.remove('active');

    console.log("Playback state reset complete.");
}


// ===========================================
// SCORE LOADING AND PREPARATION
// ===========================================

/**
 * Prepares playback data from the loaded score
 * Extracts notes, tempo, and cursor event times
 * @param {OpenSheetMusicDisplay} currentOSMD - The loaded OSMD instance
 */
function preparePlaybackData(currentOSMD) {
    if (!currentOSMD || !currentOSMD.sheet) {
        console.error("OSMD not ready for data prep.");
        notesToSchedule = [];
        cursorEventTimes = [];
        totalPlayableDuration = 0;
        return;
    }
    
    console.log("Preparing playback data...");
    notesToSchedule = [];
    const uniqueTimeSet = new Set();
    
    // Get tempo from score or use default
    currentScoreTempo = currentOSMD.sheet.DefaultStartTempoInBpm || CONFIG.INITIAL_TEMPO_BPM;
    console.log(`Original Score Tempo: ${currentScoreTempo} BPM.`);

    // Apply current tempo percentage
    const targetBPM = currentScoreTempo * (currentTempoPercentage / 100);
    Tone.Transport.bpm.value = Math.max(CONFIG.MIN_BPM_SAFETY, targetBPM);
    console.log(`Initial Playback Tempo (at ${currentTempoPercentage}%): ${Tone.Transport.bpm.value.toFixed(2)} BPM.`);

    // Calculate whole note duration for seeking
    wholeNoteDurationForSeek = (60 / currentScoreTempo) * 4;

    let noteCount = 0;
    if (currentOSMD.cursor) currentOSMD.cursor.reset();

    // Extract notes and cursor events
    while (currentOSMD.cursor && !currentOSMD.cursor.Iterator.EndReached) {
        const entryStartTimeInSeconds = currentOSMD.cursor.Iterator.currentTimeStamp.RealValue * wholeNoteDurationForSeek;
        uniqueTimeSet.add(entryStartTimeInSeconds);

        const voiceEntries = currentOSMD.cursor.Iterator.CurrentVoiceEntries;
        if (voiceEntries) {
            for (const voiceEntry of voiceEntries) {
                for (const note of voiceEntry.Notes) {
                    if (note.isRest() || !note.Pitch) continue;

                    const noteDurationInSeconds = note.Length.RealValue * wholeNoteDurationForSeek;
                    let pitchName = "N/A";

                    try {
                        pitchName = Tone.Midi(note.Pitch.halfTone).toNote();
                    } catch (e) {
                        pitchName = "ErrorPitch";
                    }
                    
                    noteCount++;
                    let noteheadSvgElement = note.Notehead?.getSVGElement?.();

                    if (["N/A", "ErrorPitch"].indexOf(pitchName) === -1 && noteDurationInSeconds > 0.001) {
                        notesToSchedule.push({
                            time: entryStartTimeInSeconds,
                            pitch: pitchName,
                            duration: noteDurationInSeconds,
                            svgElement: noteheadSvgElement
                        });
                    }
                }
            }
        }
        
        currentOSMD.cursor.next();
        if (noteCount > CONFIG.NOTE_EXTRACTION_SAFETY_BREAK) {
            console.warn("Note extraction safety break.");
            break;
        }
    }
    
    // Sort notes and cursor events
    notesToSchedule.sort((a, b) => a.time - b.time);
    cursorEventTimes = Array.from(uniqueTimeSet).sort((a, b) => a - b);
    
    console.log(`Notes scheduled: ${notesToSchedule.length}. Unique Cursor Event Times: ${cursorEventTimes.length}`);
    
    // Calculate total duration
    totalPlayableDuration = notesToSchedule.length > 0 
        ? Math.max(...notesToSchedule.map(n => n.time + n.duration))
        : (cursorEventTimes.length > 0 ? cursorEventTimes[cursorEventTimes.length - 1] : 0);
    
    // Update UI elements
    if (dom.navigationSlider) {
        dom.navigationSlider.max = totalPlayableDuration.toFixed(3);
        dom.navigationSlider.value = 0;
        dom.totalTimeDisplay.textContent = formatTime(totalPlayableDuration);
        dom.currentTimeDisplay.textContent = formatTime(0);
        dom.navigationSlider.disabled = totalPlayableDuration === 0;
    }
    
    // Update tempo slider UI
    if (dom.tempoSlider) dom.tempoSlider.value = currentTempoPercentage;
    if (dom.tempoValueOutput) dom.tempoValueOutput.textContent = `${currentTempoPercentage}%`;
    
    // Reset cursor position
    if (currentOSMD.cursor) {
        currentOSMD.cursor.reset();
        ensureCursorIsVisible();
    }
    
    console.log("Playback data preparation complete.");
}


// ===========================================
// FILE LOADING AND SCORE INITIALIZATION
// ===========================================

// Setup file loading functionality if necessary DOM elements exist
if (dom.loadScoreButton && dom.fileInput && dom.scoreDisplayArea) {
    // Trigger file input when load button is clicked
    dom.loadScoreButton.addEventListener('click', () => dom.fileInput.click());
    
    // Handle file selection
    dom.fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        // Reset state for new file
        resetPlaybackState(true);
        
        // Update UI for loading state
        if (dom.scorePlaceholder) dom.scorePlaceholder.style.display = 'none';
        dom.scoreDisplayArea.innerHTML = UI_STRINGS.LOADING_SCORE_MESSAGE;
        dom.scoreDisplayArea.scrollTop = 0;
        
        // Read and process the file
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // Initialize OSMD with settings
                osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(dom.scoreDisplayArea, {
                    autoResize: true,
                    backend: "svg",
                    drawTitle: false,
                    drawingParameters: CONFIG.OSMD_DRAWING_PARAMETERS,
                    followCursor: true,
                    cursorOptions: {
                        type: dom.cursorTypeSelect ? getCurrentCursorType() : (opensheetmusicdisplay.CursorType?.ThinLeft ?? 1),
                        color: "#FF69B4",
                        alpha: 0.72,
                        follow: false,
                    }
                });
                
                // Load and render the score
                osmd.load(e.target.result).then(() => {
                    dom.scoreDisplayArea.innerHTML = '';
                    osmd.render();
                    console.log("Score loaded and rendered.");
                    
                    if (osmd.cursor) {
                        // Set cursor appearance
                        osmd.cursor.cursorOptions.type = dom.cursorTypeSelect 
                            ? getCurrentCursorType() 
                            : (opensheetmusicdisplay.CursorType?.ThinLeft ?? 1);
                        osmd.cursor.cursorOptions.color = "#FF69B4";
                        osmd.cursor.cursorOptions.alpha = 0.72;
                        
                        osmd.cursor.show();
                        osmd.cursor.reset();
                        ensureCursorIsVisible();
                        
                        console.log("OSMD cursor visible at start.");
                    }
                    
                    // Prepare data for playback
                    preparePlaybackData(osmd);
                    
                    // Update UI state
                    updatePlayButtonState("ready", notesToSchedule.length > 0);
                    if (dom.navigationSlider) {
                        dom.navigationSlider.disabled = notesToSchedule.length === 0;
                    }
                }).catch((err) => {
                    console.error("OSMD Error:", err);
                    dom.scoreDisplayArea.innerHTML = UI_STRINGS.ERROR_LOADING_SCORE_HTML;
                    updatePlayButtonState("ready", false);
                });
            } catch (osmdError) {
                console.error("Error initializing OSMD:", osmdError);
                dom.scoreDisplayArea.innerHTML = UI_STRINGS.ERROR_LOADING_SCORE_HTML;
                updatePlayButtonState("ready", false);
            }
        };
        
        reader.onerror = function(err) {
            console.error("FileReader error:", err);
            dom.scoreDisplayArea.innerHTML = UI_STRINGS.ERROR_READING_FILE_HTML;
            updatePlayButtonState("ready", false);
        };
        
        reader.readAsText(file);
        dom.fileInput.value = null; // Reset file input
    });
} else {
    console.error("Essential DOM elements for file loading missing.");
}


// ===========================================
// PLAYBACK CONTROL AND NAVIGATION
// ===========================================

/**
 * Seeks to a specific time in the score
 * Updates both audio transport and visual cursor position
 * @param {number} targetTimeInSeconds - The time to seek to
 */
function seekToTime(targetTimeInSeconds) {
    if (!osmd || !osmd.sheet || !audioContextStarted || !cursorEventTimes || cursorEventTimes.length === 0) {
        console.warn("Seek aborted: Dependencies not ready or no events.");
        if (dom.navigationSlider && Tone.Transport) {
            dom.navigationSlider.value = Tone.Transport.seconds;
        }
        return;
    }

    const wasPlaying = Tone.Transport.state === "started";
    if (wasPlaying) Tone.Transport.pause();
    
    let actualSeekEventTime = cursorEventTimes[0];
    osmd.cursor.reset();

    let foundEvent = false;
    for (let i = 0; i < cursorEventTimes.length; i++) {
        const eventTime = cursorEventTimes[i];
        if (eventTime >= targetTimeInSeconds) {
            actualSeekEventTime = eventTime;

            // Iterate OSMD cursor to this eventTime
            let currentIteratorTime = osmd.cursor.Iterator.currentTimeStamp.RealValue * wholeNoteDurationForSeek;
            while (currentIteratorTime < actualSeekEventTime && 
                   !osmd.cursor.Iterator.EndReached && 
                   Math.abs(currentIteratorTime - actualSeekEventTime) > 0.001) {
                 osmd.cursor.next();
                 currentIteratorTime = osmd.cursor.Iterator.currentTimeStamp.RealValue * wholeNoteDurationForSeek;

                 // Optimization: if we've passed the target but there's a closer next event, break
                if (currentIteratorTime > actualSeekEventTime && 
                    i < cursorEventTimes.length - 1 && 
                    cursorEventTimes[i+1] > actualSeekEventTime) break;
            }
            
            foundEvent = true;
            break;
        }
    }
    
    if (!foundEvent && cursorEventTimes.length > 0) {
        // Target time is beyond the last event, snap to last event
        actualSeekEventTime = cursorEventTimes[cursorEventTimes.length - 1];
        while (!osmd.cursor.Iterator.EndReached) {
            let iteratorTime = osmd.cursor.Iterator.currentTimeStamp.RealValue * wholeNoteDurationForSeek;
            if (iteratorTime >= actualSeekEventTime || 
                Math.abs(iteratorTime - actualSeekEventTime) < 0.001) break;
            osmd.cursor.next();
            if (osmd.cursor.Iterator.EndReached) break;
        }
    } else if (cursorEventTimes.length === 0) {
        // No events, just seek transport time
        actualSeekEventTime = Math.max(0, targetTimeInSeconds);
    }
    
    // Set audio transport position
    Tone.Transport.seconds = actualSeekEventTime;
    
    // Update visual cursor
    if (osmd.cursor) {
        osmd.cursor.update();
        requestAnimationFrame(() => ensureCursorIsVisible());

        const finalIteratorTimeVal = osmd.cursor.Iterator.currentTimeStamp.RealValue * wholeNoteDurationForSeek;
        console.log(`Seek: target=${targetTimeInSeconds.toFixed(2)}, actual audio/cursor @ ${actualSeekEventTime.toFixed(2)}, iterator raw @ ${finalIteratorTimeVal.toFixed(2)}`);
    }
    
    // Update UI
    if (dom.currentTimeDisplay) {
        dom.currentTimeDisplay.textContent = formatTime(actualSeekEventTime);
    }
    if (dom.navigationSlider) {
        dom.navigationSlider.value = actualSeekEventTime;
    }
    
    // Resume playback if it was playing
    if (wasPlaying) {
        Tone.Transport.start(undefined, Tone.Transport.seconds);
        
        if (sliderUpdateIntervalID === null && Tone.Transport.state === "started") {
            sliderUpdateIntervalID = Tone.Transport.scheduleRepeat((audioTime) => {
                Tone.Draw.schedule(() => {
                    const currentTime = Tone.Transport.seconds;
                    if (dom.navigationSlider && !isSliderDragging) {
                        dom.navigationSlider.value = currentTime;
                    }
                    if (dom.currentTimeDisplay) {
                        dom.currentTimeDisplay.textContent = formatTime(currentTime);
                    }
                }, audioTime);
            }, CONFIG.SLIDER_UPDATE_INTERVAL_S);
        }
    }
}

/**
 * Sets up and starts playback from a specific time
 * @param {number} startTime - Time to start playback from
 * @param {boolean} isResumeAfterTempoChange - Whether this is resuming after a tempo change
 */
function setupAndStartPlayback(startTime, isResumeAfterTempoChange = false) {
    if (currentScoreTempo <= 0) {
        console.warn("Cannot start playback: Original score tempo not determined or is zero.");
        return;
    }

    if (!notesToSchedule || notesToSchedule.length === 0) {
        console.warn("Cannot start playback: No notes to schedule.");
        if (dom.playButton) dom.playButton.classList.remove('active');
        if (dom.pauseButton) dom.pauseButton.classList.remove('active');
        return;
    }

    console.log(`Setting up playback. Start time: ${startTime.toFixed(2)}, Is resume after tempo change: ${isResumeAfterTempoChange}`);

    // Set correct BPM based on tempo percentage
    const targetBPM = currentScoreTempo * (currentTempoPercentage / 100);
    Tone.Transport.bpm.value = Math.max(CONFIG.MIN_BPM_SAFETY, targetBPM);
    console.log(`Playback BPM set to ${Tone.Transport.bpm.value.toFixed(2)} (Target from slider: ${targetBPM.toFixed(2)})`);

    // Setup Tone.Part for note playback
    if (!isResumeAfterTempoChange || !playbackPart) {
        if (playbackPart) {
            playbackPart.stop(0);
            playbackPart.clear();
            playbackPart.dispose();
            playbackPart = null;
        }

        playbackPart = new Tone.Part((audioTime, event) => {
            if (toneSynth) {
                toneSynth.triggerAttackRelease(event.pitch, event.duration, audioTime);

                if (event.svgElement) {
                    event.svgElement.classList.add(CONFIG.NOTE_HIGHLIGHT_CLASS);

                    Tone.Transport.scheduleOnce(() => {
                        if (event.svgElement) {
                            event.svgElement.classList.remove(CONFIG.NOTE_HIGHLIGHT_CLASS);
                        }
                    }, audioTime + event.duration - CONFIG.NOTE_UNHIGHLIGHT_OFFSET_S);
                }
            }
        }, notesToSchedule);

        playbackPart.start(0);
        playbackPart.loop = false;
        console.log("Tone.Part created/re-created and scheduled.");
    } else {
        console.log("Reusing existing Tone.Part for tempo change resume.");
    }
    
    // Position transport and OSMD cursor
    seekToTime(startTime);
    const actualPlaybackTime = Tone.Transport.seconds;
    
    // Schedule visual cursor updates
    scheduledCursorUpdateIDs.forEach(id => Tone.Transport.clear(id));
    scheduledCursorUpdateIDs = [];

    if (osmd && osmd.cursor && cursorEventTimes.length > 0) {
        console.log(`Scheduling cursor 'next' calls starting after: ${actualPlaybackTime.toFixed(2)}s`);

        cursorEventTimes.forEach(timeSec => {
            if (timeSec > actualPlaybackTime + CONFIG.FUTURE_EVENT_TIME_OFFSET) {
                const eventId = Tone.Transport.scheduleOnce(() => {
                    if (Tone.Transport.state === "started" && 
                        Math.abs(Tone.Transport.seconds - timeSec) < CONFIG.CURSOR_SYNC_TOLERANCE) {
                        if (osmd.cursor && !osmd.cursor.Iterator.EndReached) {
                            osmd.cursor.next();
                            requestAnimationFrame(() => ensureCursorIsVisible());
                        }
                    }
                }, timeSec);

                scheduledCursorUpdateIDs.push(eventId);
            }
        });

        console.log(`Scheduled ${scheduledCursorUpdateIDs.length} cursor 'next' calls.`);
    }
    
    // Start playback
    Tone.Transport.start(CONFIG.PLAYBACK_START_OFFSET, actualPlaybackTime);
    console.log(`Tone.Transport started from ${actualPlaybackTime.toFixed(2)}s.`);

    // Setup UI updates
    if (sliderUpdateIntervalID !== null) Tone.Transport.clear(sliderUpdateIntervalID);

    sliderUpdateIntervalID = Tone.Transport.scheduleRepeat((audioTime) => {
        Tone.Draw.schedule(() => {
            const ct = Tone.Transport.seconds;
            if (dom.navigationSlider && !isSliderDragging) {
                dom.navigationSlider.value = ct;
            }
            if (dom.currentTimeDisplay) {
                dom.currentTimeDisplay.textContent = formatTime(ct);
            }
        }, audioTime);
    }, CONFIG.SLIDER_UPDATE_INTERVAL_S);

    // Update button states
    if (dom.playButton) dom.playButton.classList.add('active');
    if (dom.pauseButton) dom.pauseButton.classList.remove('active');
}

// ===========================================
// EVENT LISTENERS AND UI CONTROLS
// ===========================================

/**
 * Gets the current cursor type from the select element
 * @returns {number} The selected cursor type or default value
 */
function getCurrentCursorType() {
    if (dom.cursorTypeSelect) {
        return parseInt(dom.cursorTypeSelect.value, 10);
    }
    return opensheetmusicdisplay.CursorType?.ThinLeft ?? 1;
}

/**
 * Updates the OSMD cursor appearance with current settings
 */
function updateOSMDCursorAppearance() {
    if (osmd && osmd.cursor) {
        try {
            const newType = getCurrentCursorType();
            const newColor = "#FF69B4"; // Pink (fixed)
            const newAlpha = 0.72;      // 72% Opacity (fixed)
            
            if (osmd.cursor.cursorOptions) {
                osmd.cursor.cursorOptions.type = newType;
                osmd.cursor.cursorOptions.color = newColor;
                osmd.cursor.cursorOptions.alpha = newAlpha;
            }
            
            osmd.cursor.update();
            console.log(`Cursor updated: Type=${newType}, Color=${newColor}, Alpha=${newAlpha}`);
        } catch (error) {
            console.error("Error updating OSMD cursor appearance:", error);
        }
    }
}

/**
 * Sets the global volume level
 * @param {number} percentage - Volume level as percentage (0-100)
 */
const setGlobalVolume = (percentage) => {
    if (audioContextStarted && Tone.Destination) {
        let dbValue = Tone.gainToDb(percentage / 100);
        if (percentage === 0) dbValue = -Infinity; // Mute
        Tone.Destination.volume.value = dbValue;
    }
};

// Navigation Slider Event Listeners
if (dom.navigationSlider) {
    // Handle slider drag start
    dom.navigationSlider.addEventListener('mousedown', () => isSliderDragging = true);
    
    // Handle slider drag end
    dom.navigationSlider.addEventListener('mouseup', () => isSliderDragging = false);
    
    // Handle slider value changes during drag
    dom.navigationSlider.addEventListener('input', () => {
        if (!osmd || notesToSchedule.length === 0 || !audioContextStarted) return;
        
        const targetTime = parseFloat(dom.navigationSlider.value);
        if (dom.currentTimeDisplay) {
            dom.currentTimeDisplay.textContent = formatTime(targetTime);
        }
        
        // Seek if dragging or if playback is not active
        if (isSliderDragging || Tone.Transport.state !== "started") {
            seekToTime(targetTime);
        }
    });
    
    // Handle slider click without drag
    dom.navigationSlider.addEventListener('change', () => {
        if (!osmd || notesToSchedule.length === 0 || !audioContextStarted) return;
        
        if (!isSliderDragging) {
            const targetTime = parseFloat(dom.navigationSlider.value);
            seekToTime(targetTime);
        }
        isSliderDragging = false;
    });
}

// Playback Control Button Listeners
if (dom.playButton) {
    dom.playButton.disabled = true;
    
    dom.playButton.addEventListener('click', async () => {
        try {
            await initializeAudio();
            
            if ((!notesToSchedule || notesToSchedule.length === 0) && osmd && osmd.sheet) {
                console.log("Play button: notesToSchedule is empty. Re-running preparePlaybackData.");
                preparePlaybackData(osmd);
            }
            
            if (!notesToSchedule || notesToSchedule.length === 0) {
                console.log("No notes available to play.");
                updatePlayButtonState("ready", false);
                if (dom.navigationSlider) dom.navigationSlider.disabled = true;
                return;
            }

            updatePlayButtonState("ready", true);
            if (dom.navigationSlider) dom.navigationSlider.disabled = false;

            if (osmd && osmd.cursor && osmd.cursor.Hidden) {
                osmd.cursor.show();
            }

            const startTimeSlider = parseFloat(dom.navigationSlider.value) || 0;
            setupAndStartPlayback(startTimeSlider, false);

        } catch (error) {
            console.error("Error during play button click handling:", error);
            if (dom.playButton) dom.playButton.classList.remove('active');
        }
    });
}

if (dom.pauseButton) {
    dom.pauseButton.addEventListener('click', () => {
        if (Tone.Transport.state === "started") {
            Tone.Transport.pause();

            if (sliderUpdateIntervalID !== null) {
                Tone.Transport.clear(sliderUpdateIntervalID);
                sliderUpdateIntervalID = null;
            }

            console.log("Playback paused at: " + Tone.Transport.seconds.toFixed(2));

            dom.pauseButton.classList.add('active');
            if (dom.playButton) dom.playButton.classList.remove('active');
        }
    });
}

if (dom.startButton) {
    dom.startButton.addEventListener('click', () => {
        const wasPlaying = Tone.Transport.state === "started";
        resetPlaybackState(false);
        seekToTime(0);

        console.log("Playback stopped and UI reset to start.");

        if (dom.playButton) dom.playButton.classList.remove('active');
        if (dom.pauseButton) dom.pauseButton.classList.remove('active');
    });
}

// Volume Control Listener
if (dom.masterVolumeSlider && dom.volumeValueOutput) {
    const initialVolumePercent = parseInt(dom.masterVolumeSlider.value);
    dom.volumeValueOutput.textContent = initialVolumePercent + '%';

    dom.masterVolumeSlider.addEventListener('input', () => {
        const percentage = parseInt(dom.masterVolumeSlider.value);
        dom.volumeValueOutput.textContent = percentage + '%';
        setGlobalVolume(percentage);
    });
}

// Tempo Slider Listener
if (dom.tempoSlider && dom.tempoValueOutput) {
    dom.tempoSlider.addEventListener('input', () => {
        currentTempoPercentage = parseInt(dom.tempoSlider.value, 10);
        dom.tempoValueOutput.textContent = `${currentTempoPercentage}%`;

        const wasPlaying = Tone.Transport.state === "started";
        let pauseTimeSeconds = 0;

        if (currentScoreTempo > 0) {
            const newBPM = currentScoreTempo * (currentTempoPercentage / 100);
            const effectiveBPM = Math.max(CONFIG.MIN_BPM_SAFETY, newBPM);

            let logMessage = `Tempo slider: ${currentTempoPercentage}%. Target BPM: ${effectiveBPM.toFixed(2)}.`;

            if (wasPlaying) {
                pauseTimeSeconds = Tone.Transport.seconds;
                Tone.Transport.pause();

                if (sliderUpdateIntervalID !== null) {
                    Tone.Transport.clear(sliderUpdateIntervalID);
                    sliderUpdateIntervalID = null;
                }

                console.log(`Tempo change during playback: Paused at ${pauseTimeSeconds.toFixed(2)}s.`);
                logMessage += ` Resuming with new tempo.`;

                setupAndStartPlayback(pauseTimeSeconds, true);
            } else if (audioContextStarted) {
                Tone.Transport.bpm.value = effectiveBPM;
                logMessage += ` BPM set to ${effectiveBPM.toFixed(2)} for next playback.`;
            } else {
                logMessage += " Audio not started, new tempo percentage stored and will apply on play.";
            }

            console.log(logMessage);
        } else {
            console.warn("Tempo percentage changed, but original score tempo (currentScoreTempo) is not yet determined. Value stored.");
        }
    });
}

// Cursor Type Selection Listener
if (dom.cursorTypeSelect) {
    if (opensheetmusicdisplay.CursorType) {
        // Populate select options from OSMD's CursorType enum
        for (const typeName in opensheetmusicdisplay.CursorType) {
            if (isNaN(parseInt(typeName, 10))) {
                const option = document.createElement('option');
                option.value = opensheetmusicdisplay.CursorType[typeName];
                option.textContent = typeName;
                dom.cursorTypeSelect.appendChild(option);
            }
            }

        dom.cursorTypeSelect.value = opensheetmusicdisplay.CursorType?.ThinLeft ?? "1";
    } else {
        console.warn("opensheetmusicdisplay.CursorType not available for select population.");
        }

    dom.cursorTypeSelect.addEventListener('change', updateOSMDCursorAppearance);
}

// Tuning Button Listeners (A440/A415)
if (dom.a440Button && dom.a415Button) {
    dom.a440Button.addEventListener('click', () => {
        console.log("Set to A440 (conceptual)");
        dom.a440Button.classList.add('active');
        dom.a415Button.classList.remove('active');
    });
    
    dom.a415Button.addEventListener('click', () => {
        console.log("Set to A415 (conceptual)");
        dom.a415Button.classList.add('active');
        dom.a440Button.classList.remove('active');
    });
}

// ===========================================
// INITIALIZATION ON PAGE LOAD
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize button states
    if (dom.playButton) dom.playButton.disabled = true;
    if (dom.navigationSlider) dom.navigationSlider.disabled = true;
    if (dom.scorePlaceholder) dom.scorePlaceholder.style.display = 'block';

    // Initialize tempo controls
    currentTempoPercentage = CONFIG.DEFAULT_TEMPO_PERCENTAGE;
    if (dom.tempoSlider) dom.tempoSlider.value = currentTempoPercentage;
    if (dom.tempoValueOutput) dom.tempoValueOutput.textContent = `${currentTempoPercentage}%`;

    // Initialize volume controls
    if (dom.masterVolumeSlider && dom.volumeValueOutput) {
        const initialVolumePercent = parseInt(dom.masterVolumeSlider.value);
        dom.volumeValueOutput.textContent = initialVolumePercent + '%';
    }
    
    // Set default tuning
    if (dom.a440Button) dom.a440Button.classList.add('active');
});