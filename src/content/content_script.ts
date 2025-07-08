import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { GlobalState } from "../shared/types";
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
import { getState, recalculateFactors, setMode, setFrequency } from "./state";

let _extensionEnabled = false; // extension is disabled by default
let _observer: MutationObserver | null;
let _isObserving = false;

const _videoListenerMap = new Map<HTMLVideoElement, () => void>();

/* ------------------------ FUNCTIONS --------------------------- */

const isVideoPlaying = (video: HTMLVideoElement): boolean =>
  !video.paused &&
  !video.ended &&
  video.currentTime > 0 &&
  video.readyState >= 2;

// Wait for the video to play and then tune it. If the video is already playing, tune it now.
function waitForTheVideoToPlay(video: HTMLVideoElement) {
  if (!_videoListenerMap.has(video)) {
    const onPlay = () => tuneVideo(video);
    const onLoaded = () => tuneVideo(video);
    video.addEventListener("playing", onPlay);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("ended", () => disconnectSoundtouch(video), {
      once: true,
    });
    _videoListenerMap.set(video, onPlay);
  }

  if (isVideoPlaying(video)) {
    tuneVideo(video);
  }
}

async function tuneVideo(video: HTMLVideoElement): Promise<void> {
  if (!_extensionEnabled) return;

  await ensureActiveAudioChain();

  if (getState().mode === "rate") {
    disconnectSoundtouch(video);

    changePitch(1);
    disablePitchPreservation(video);
    changePlayBackRate(video, getState().currentPlaybackRate);
  } else {
    await connectSoundtouch(video);

    changePlayBackRate(video, 1);
    enablePitchPreservation(video);
    changePitch(getState().currentPitch);
  }
}

// Re-apply the current mode (rate or pitch) to every <video> on the page
function applyCurrentSettings(): void {
  document.querySelectorAll("video").forEach((video) => {
    // If the video is not already playing, wait for it to play and then tune it
    if (!_videoListenerMap.has(video)) {
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
          _videoListenerMap.delete(node);
        } else if (node instanceof Element) {
          node.querySelectorAll("video").forEach((v) => {
            disconnectSoundtouch(v);
            _videoListenerMap.delete(v);
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

  _videoListenerMap.forEach((onPlay, video) => {
    video.removeEventListener("playing", onPlay);
  });
  _videoListenerMap.clear();
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
    disconnectAllVideos();
    setFrequency(A4_STANDARD_FREQUENCY);
    resetSoundTouch();
  }
}

/* ------------------------ EXECUTION --------------------------- */

// Resume AudioContext and re-apply tuning when user returns to the tab
document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) {
    await ensureActiveAudioChain();
    if (_extensionEnabled) applyCurrentSettings();
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
