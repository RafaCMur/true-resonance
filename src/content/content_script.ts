import {
  A4_STANDARD_FREQUENCY,
  C5_STANDARD_FREQUENCY,
} from "../shared/constants";
import { GlobalState, MediaElem } from "../shared/types";
import {
  changePitch,
  changePlayBackRate,
  connectSoundtouch,
  disablePitchPreservation,
  disconnectSoundtouch,
  enablePitchPreservation,
  ensureActiveAudioChain,
  resetSoundTouch,
} from "./soundtouch";
import {
  calculatePlaybackRate,
  getState,
  recalculateFactors,
  setFrequency,
  setMode,
} from "./state";

let _extensionEnabled = false; // extension is disabled by default
let _observer: MutationObserver | null;
let _isObserving = false;

const _mediaListenerMap = new Map<MediaElem, () => void>();

/* ------------------------ FUNCTIONS --------------------------- */

const isMediaPlaying = (media: MediaElem): boolean =>
  !media.paused &&
  !media.ended &&
  media.currentTime > 0 &&
  media.readyState >= 2;

// Wait for the video to play and then tune it. If the video is already playing, tune it now.
function waitForTheMediaToPlay(media: MediaElem) {
  if (!_mediaListenerMap.has(media)) {
    const onPlay = () => tuneMedia(media);
    const onLoaded = () => tuneMedia(media);
    media.addEventListener("playing", onPlay);
    media.addEventListener("loadeddata", onLoaded);
    if (media instanceof HTMLVideoElement) {
      media.addEventListener("ended", () => disconnectSoundtouch(media), {
        once: true,
      });
    }
    _mediaListenerMap.set(media, onPlay);
  }

  if (isMediaPlaying(media)) {
    tuneMedia(media);
  }
}

async function tuneMedia(media: MediaElem): Promise<void> {
  if (!_extensionEnabled) return;
  await ensureActiveAudioChain();

  if (getState().mode === "rate") {
    // For rate mode, disconnect SoundTouch and just change playback rate
    disconnectSoundtouch(media);
    changePitch(1);
    disablePitchPreservation(media);
    changePlayBackRate(media, getState().currentPlaybackRate);
  } else {
    // Try to connect SoundTouch for pitch mode
    const connected = await connectSoundtouch(media);

    if (connected) {
      // SoundTouch connected successfully
      const currentRate = getState().currentPlaybackRate;
      if (
        currentRate === 432 / A4_STANDARD_FREQUENCY ||
        currentRate === C5_STANDARD_FREQUENCY / A4_STANDARD_FREQUENCY
      ) {
        changePlayBackRate(media, 1);
      }
      enablePitchPreservation(media);
      changePitch(getState().currentPitch);
    } else {
      // SoundTouch failed (probably CORS), fallback to rate mode
      console.warn(
        `Pitch mode not available on ${window.location.hostname}, using rate mode instead`
      );
      disconnectSoundtouch(media);
      disablePitchPreservation(media);
      changePlayBackRate(media, calculatePlaybackRate());
    }
  }
}

// Re-apply the current mode (rate or pitch) to every <video> or <audio> on the page
function applyCurrentSettings(): void {
  document.querySelectorAll("video,audio").forEach((el) => {
    const media = el as MediaElem;
    // If the element is not already tracked, start listening and tune when ready
    if (!_mediaListenerMap.has(media)) {
      waitForTheMediaToPlay(media);
    } else if (isMediaPlaying(media)) {
      // If it's already playing ensure tuning is applied immediately
      tuneMedia(media);
    }
  });
}

// Handle a node added to the DOM: if it's a video, set playback rate; if it contains videos, do the same
function handleNewNode(node: Node): void {
  if (node instanceof HTMLVideoElement || node instanceof HTMLAudioElement) {
    waitForTheMediaToPlay(node);
  } else if (node instanceof Element) {
    node.querySelectorAll("video,audio").forEach((el) => {
      waitForTheMediaToPlay(el as MediaElem);
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
        if (
          node instanceof HTMLVideoElement ||
          node instanceof HTMLAudioElement
        ) {
          disconnectSoundtouch(node);
          _mediaListenerMap.delete(node);
        } else if (node instanceof Element) {
          node.querySelectorAll("video,audio").forEach((media) => {
            disconnectSoundtouch(media as MediaElem);
            _mediaListenerMap.delete(media as MediaElem);
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

function disconnectAllMedia(): void {
  // Stop observing DOM changes
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
  _isObserving = false;

  // Reset all media elements
  document.querySelectorAll("video,audio").forEach((el) => {
    const media = el as MediaElem;
    media.playbackRate = 1;
    if (media instanceof HTMLVideoElement) {
      enablePitchPreservation(media);
    }
  });

  _mediaListenerMap.forEach((onPlay, el) => {
    el.removeEventListener("playing", onPlay);
  });
  _mediaListenerMap.clear();
}

function applyState(state: GlobalState): void {
  _extensionEnabled = state.enabled;
  setMode(state.mode);
  setFrequency(state.frequency);
  recalculateFactors();
  if (_extensionEnabled) {
    initVideoObservers();
    applyCurrentSettings();
  } else {
    disconnectAllMedia();
    setFrequency(A4_STANDARD_FREQUENCY);
    resetSoundTouch();
  }
}

/* ------------------------ EXECUTION --------------------------- */

// Resume AudioContext and re-apply tuning when user returns to the tab
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden && _extensionEnabled) {
    // Only resume audio chain if there are media elements on the page
    const hasMedia = document.querySelectorAll("video, audio").length > 0;
    if (hasMedia) {
      await ensureActiveAudioChain();
    }
    applyCurrentSettings();
  }
});

// Load any previously persisted values
chrome.storage.local.get("state", ({ state }) => {
  if (state) applyState(state as GlobalState);
});

// Update state when it changes
chrome.storage.onChanged.addListener(({ state }) => {
  if (state?.newValue) applyState(state.newValue as GlobalState);
});

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
