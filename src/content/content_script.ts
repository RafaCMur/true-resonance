const WORKLET_PATH = chrome.runtime.getURL("soundtouch-worklet.js");
let _extensionEnabled = false; // extension is disabled by default
let _observer: MutationObserver | null;
let _isObserving = false;
let _actualPlaybackRate = 1;
let _actualPitch = 1; // Pitch offset from base frequency. Example 432 / 440 = 0.98
let _audioCtx: AudioContext | null = null;
let _baseFrequency = 440;
let _mode: "pitch" | "rate" = "pitch";
let _isSoundtouchInit = false;
let _soundtouchNode: AudioWorkletNode | null = null;
let _srcNode: MediaElementAudioSourceNode | null = null;

function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

async function initSoundtouch(video: HTMLVideoElement) {
  const audioCtx = getAudioContext();

  // 1) Worklet can only be loaded once
  if (!_isSoundtouchInit) {
    try {
      await audioCtx.audioWorklet.addModule(WORKLET_PATH);
    } catch (err) {
      console.log("(ERROR) failed to load worklet", err);
    }
    await audioCtx.resume();
    _isSoundtouchInit = true;
  }

  // 2) Only wire up the graph if it doesn’t already exist
  if (!_srcNode || !_soundtouchNode) {
    _srcNode = audioCtx.createMediaElementSource(video);
    _soundtouchNode = new AudioWorkletNode(audioCtx, "soundtouch-processor");
    _srcNode.connect(_soundtouchNode).connect(audioCtx.destination);
  }
}

async function resetSoundTouch(): Promise<void> {
  // Disconnect old nodes
  if (_srcNode) _srcNode.disconnect();
  if (_soundtouchNode) _soundtouchNode.disconnect();

  // Close audio context
  await _audioCtx?.close();
  _audioCtx = null;

  // Reset variables
  _isSoundtouchInit = false;
  _soundtouchNode = null;
  _srcNode = null;
}

async function resetPitching(): Promise<void> {
  _actualPitch = 1;
  _actualPlaybackRate = 1;
  applyCurrentSettings();
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
  disablePitchPreservation(video);
  video.playbackRate = rate;
  disablePitchPreservation(video);
}

function changePitch(pitch: number): void {
  if (_soundtouchNode && _audioCtx) {
    _soundtouchNode.parameters
      .get("pitch")!
      .setValueAtTime(pitch, _audioCtx.currentTime);
  } else {
    console.log("(ERROR) SoundTouch node or audio context not initialized");
  }
}

async function tuneVideo(video: HTMLVideoElement): Promise<void> {
  if (!_extensionEnabled) return;

  if (_mode === "rate") {
    changePlayBackRate(video, _actualPlaybackRate);
  } else {
    await initSoundtouch(video);
    changePitch(_actualPitch);
  }
}

async function resetBothModes(video: HTMLVideoElement): Promise<void> {
  changePlayBackRate(video, 1);
  changePitch(1);
}

/** Re-apply the current mode (rate or pitch) to every <video> on the page */
function applyCurrentSettings(): void {
  document.querySelectorAll("video").forEach(tuneVideo);
}

function resetAllVideosTune(): void {
  _actualPlaybackRate = 1;
  _actualPitch = 1;
  document.querySelectorAll("video").forEach(resetBothModes);
}

// Handle a node added to the DOM: if it's a video, set playback rate; if it contains videos, do the same
function handleNewNode(node: Node): void {
  if (node instanceof HTMLVideoElement) {
    tuneVideo(node);
  } else if (node instanceof Element) {
    node.querySelectorAll("video").forEach((video) => {
      tuneVideo(video);
    });
  }
}

// Observe DOM for new video elements and apply playback changes
function initVideoObservers(): void {
  if (_isObserving) return;

  _observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(handleNewNode);
    });
  });

  // Start observing changes in the DOM
  _observer.observe(document.body, { childList: true, subtree: true });

  // Apply changes to any videos already on the page
  document.querySelectorAll("video").forEach((video) => {
    tuneVideo(video);
  });

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
}

// Ask background if extension is enabled
chrome.runtime.sendMessage({ action: "getEnabled" }, ({ enabled }) => {
  if (enabled) {
    initVideoObservers();
  }
});

// Listen for messages from the background or popup
chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  // Handle ON/OFF first
  if (message.enabled !== undefined && message.enabled !== null) {
    _extensionEnabled = message.enabled;

    if (!_extensionEnabled) {
      await resetSoundTouch();
      disconnectAllVideos();
    } else {
      initVideoObservers();
    }

    sendResponse?.({ success: true });
    return; // sync response done
  }

  if (!_extensionEnabled) return;

  //If the extension is enabled, we do all the other checks and initialize the observers
  if (message.action === "setPitch") {
    _actualPitch = message.frequency / _baseFrequency;
    applyCurrentSettings();
    sendResponse({ success: true });
  }

  if (message.action === "setPlaybackRate") {
    _actualPlaybackRate = message.frequency / _baseFrequency;
    applyCurrentSettings();
    sendResponse({ success: true });
  }

  if (message.action === "resetPitching") {
    await resetPitching();
    sendResponse({ success: true });
  }

  if (
    message.action === "setMode" &&
    (message.mode === "rate" || message.mode === "pitch")
  ) {
    _mode = message.mode;
    resetAllVideosTune();
    sendResponse({ success: true });
    return;
  }
});
