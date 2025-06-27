import {
  A4_STANDARD_FREQUENCY,
  C5_STANDARD_FREQUENCY,
  WORKLET_PATH,
} from "../shared/constants";
import { Frequency, GlobalState, Mode, SoundtouchNodes } from "../shared/types";

let _extensionEnabled = false; // extension is disabled by default
let _observer: MutationObserver | null;
let _isObserving = false;
let _currentPlaybackRate = 1;
let _currentPitch = 1; // Pitch offset from base frequency. Example 432 / 440 = 0.98
let _audioCtx: AudioContext | null = null;
let _globalAudioProcessor: AudioWorkletNode | null = null;
let _targetFrequency: Frequency = A4_STANDARD_FREQUENCY;
let _mode: Mode = "pitch";
let _isSoundtouchInit = false;

const _soundtouchMap = new Map<HTMLVideoElement, SoundtouchNodes>();
const _listenerMap = new Map<HTMLVideoElement, () => void>();

/* ------------------------ FUNCTIONS --------------------------- */

function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

async function getProcessor(): Promise<AudioWorkletNode> {
  if (_globalAudioProcessor) return _globalAudioProcessor;

  const ctx = getAudioContext();

  if (!_isSoundtouchInit) {
    await ctx.audioWorklet.addModule(WORKLET_PATH);
    _isSoundtouchInit = true;
  }

  _globalAudioProcessor = new AudioWorkletNode(ctx, "soundtouch-processor");
  _globalAudioProcessor.connect(ctx.destination);
  return _globalAudioProcessor;
}

/**
 * Get the MediaElementAudioSourceNode and AudioWorkletNode for a video element.
 * If they don't exist, create them.
 */
function getSoundtouchNodes(video: HTMLVideoElement): SoundtouchNodes {
  let nodes = _soundtouchMap.get(video);
  if (!nodes) {
    const src = getAudioContext().createMediaElementSource(video);
    nodes = { src, isSoundtouchConnected: false };
    _soundtouchMap.set(video, nodes);
  }
  return nodes;
}

async function connectSoundtouch(video: HTMLVideoElement) {
  const ctx = getAudioContext();
  if (ctx.state === "suspended" || (ctx.state as any) === "interrupted") {
    await ctx.resume();
  }

  const { src, isSoundtouchConnected } = getSoundtouchNodes(video);
  if (isSoundtouchConnected) return; // ya está

  const processor = await getProcessor(); // <— global
  try {
    src.disconnect();
  } catch (_) {}

  src.connect(processor);
  getSoundtouchNodes(video).isSoundtouchConnected = true;
}

function disconnectSoundtouch(video: HTMLVideoElement) {
  const entry = _soundtouchMap.get(video);
  if (!entry || !entry.isSoundtouchConnected) return;

  const { src } = entry;
  try {
    src.disconnect();
  } catch (_) {}
  src.connect(getAudioContext().destination);

  entry.isSoundtouchConnected = false;
}

async function resetSoundTouch(): Promise<void> {
  for (const [video, nodes] of _soundtouchMap) {
    disconnectSoundtouch(video);
    nodes.isSoundtouchConnected = false;
  }
  if (_globalAudioProcessor) {
    _globalAudioProcessor.disconnect();
    _globalAudioProcessor = null;
  }
  _isSoundtouchInit = false;
}

function getReferenceFreq(target: Frequency): number {
  if (target === 528) return C5_STANDARD_FREQUENCY; // 528 is the reference for C5 which is tuned originally to 523.25
  return A4_STANDARD_FREQUENCY;
}

function recalculateFactors() {
  const factor = _targetFrequency / getReferenceFreq(_targetFrequency); // 432→0.982…
  if (_mode === "pitch") {
    _currentPitch = factor;
    _currentPlaybackRate = 1;
  } else {
    // "rate"
    _currentPitch = 1;
    _currentPlaybackRate = factor;
  }
}

const isVideoPlaying = (video: HTMLVideoElement): boolean =>
  !video.paused &&
  !video.ended &&
  video.currentTime > 0 &&
  video.readyState >= 2;

function waitForTheVideoToPlay(video: HTMLVideoElement) {
  if (!_listenerMap.has(video)) {
    const onPlay = () => tuneVideo(video);
    video.addEventListener("playing", onPlay);
    video.addEventListener(
      "ended",
      () => {
        video.removeEventListener("playing", onPlay);
        disconnectSoundtouch(video);
        _listenerMap.delete(video);
      },
      { once: true }
    );
    _listenerMap.set(video, onPlay);
  }

  if (isVideoPlaying(video)) {
    tuneVideo(video);
  }
}

function enablePitchPreservation(video: HTMLVideoElement): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in video) {
        (video as any)[prop] = true;
      }
    }
  );
}

// Disable pitch preservation on a video element for all browsers
function disablePitchPreservation(video: HTMLVideoElement): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in video) {
        (video as any)[prop] = false;
      }
    }
  );
}

// Change playback rate and disable pitch preservation
function changePlayBackRate(video: HTMLVideoElement, rate: number): void {
  video.playbackRate = rate;
}

function changePitch(pitch: number): void {
  if (!_audioCtx || !_globalAudioProcessor) return;
  _globalAudioProcessor.parameters
    .get("pitch")!
    .setValueAtTime(pitch, _audioCtx.currentTime);
}

async function tuneVideo(video: HTMLVideoElement): Promise<void> {
  if (!_extensionEnabled) return;

  await connectSoundtouch(video);

  if (_mode === "rate") {
    changePitch(1);
    disablePitchPreservation(video);
    changePlayBackRate(video, _currentPlaybackRate);
  } else {
    changePlayBackRate(video, 1);
    enablePitchPreservation(video);
    changePitch(_currentPitch);
  }
}

/** Re-apply the current mode (rate or pitch) to every <video> on the page */
function applyCurrentSettings(): void {
  document.querySelectorAll("video").forEach((video) => {
    // If the video is not already playing, wait for it to play and then tune it
    if (!_listenerMap.has(video)) {
      waitForTheVideoToPlay(video);
    }
    // But if the video is already playing, tune it now
    tuneVideo(video);
  });
}

// Handle a node added to the DOM: if it's a video, set playback rate; if it contains videos, do the same
function handleNewNode(node: Node): void {
  if (node instanceof HTMLVideoElement) {
    waitForTheVideoToPlay(node);
  } else if (node instanceof Element) {
    node.querySelectorAll("video").forEach((video) => {
      waitForTheVideoToPlay(video);
    });
  }
}

// Observe DOM for new video elements and apply playback changes
function initVideoObservers(): void {
  if (_isObserving) return;

  _observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(handleNewNode);

      mutation.removedNodes.forEach((node) => {
        if (node instanceof HTMLVideoElement) {
          disconnectSoundtouch(node);
          _listenerMap.delete(node);
        } else if (node instanceof Element) {
          node.querySelectorAll("video").forEach((v) => {
            disconnectSoundtouch(v);
            _listenerMap.delete(v);
          });
        }
      });
    });
  });

  // Start observing changes in the DOM
  _observer.observe(document.body, { childList: true, subtree: true });

  // Apply changes to any videos already on the page
  applyCurrentSettings();

  _isObserving = true;
}

function disconnectAllVideos(): void {
  // Stop observing DOM changes
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
  _isObserving = false;

  // Reset all videos
  document.querySelectorAll("video").forEach((video) => {
    video.playbackRate = 1;
    enablePitchPreservation(video);
  });

  _listenerMap.forEach((onPlay, video) => {
    video.removeEventListener("playing", onPlay);
  });
  _listenerMap.clear();
}

function applyState(state: GlobalState): void {
  _extensionEnabled = state.enabled;
  _mode = state.mode;
  _targetFrequency = state.frequency;
  recalculateFactors();
  if (_extensionEnabled) {
    initVideoObservers();
    applyCurrentSettings();
  } else {
    disconnectAllVideos();
    _targetFrequency = 440;
    resetSoundTouch();
  }
}

/* ------------------------ EXECUTION --------------------------- */
recalculateFactors();

/* Load any previously persisted values */
chrome.storage.local.get("state", ({ state }) => {
  if (state) applyState(state as GlobalState);
});

chrome.storage.onChanged.addListener(({ state }) => {
  if (state?.newValue) applyState(state.newValue as GlobalState);
});

// Ask background if extension is enabled
// chrome.runtime.sendMessage({ action: "getEnabled" }, ({ enabled }) => {
//   _extensionEnabled = enabled;
//   if (enabled) {
//     initVideoObservers();
//   }
// });

// TODO – to be removed
// Listen for messages from the background or popup
// chrome.runtime.onMessage.addListener(async (msg, _s, send) => {
//   /* ----- Toggle ON / OFF -------------------------- */
//   if (msg.enabled !== undefined && msg.enabled !== null) {
//     _extensionEnabled = msg.enabled;

//     if (!_extensionEnabled) {
//       await resetSoundTouch();
//       disconnectAllVideos();
//       _targetFrequency = 440;
//       recalculateFactors();
//     } else {
//       initVideoObservers();
//     }
//     send?.({ success: true });
//     return;
//   }

//   /* ----- Change mode -------------------------- */
//   if (msg.action === "setMode") {
//     _mode = msg.mode;
//     recalculateFactors();
//     if (_extensionEnabled) applyCurrentSettings();
//     send?.({ success: true });
//     return;
//   }

//   /* ----- Change pitch ------------------------- */
//   if (msg.action === "setPitch" || msg.action === "setPlaybackRate") {
//     _targetFrequency = msg.frequency as 432 | 528 | 440;
//     recalculateFactors();
//     if (_extensionEnabled) applyCurrentSettings();
//     send?.({ success: true });
//     return;
//   }

//   /* ----- Reset pitch/rate --------------------- */
//   if (msg.action === "resetPitching") {
//     _targetFrequency = 440;
//     recalculateFactors();
//     if (_extensionEnabled) applyCurrentSettings();
//     send?.({ success: true });
//     return;
//   }
// });

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
