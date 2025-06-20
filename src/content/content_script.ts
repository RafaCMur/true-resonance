const WORKLET_PATH = chrome.runtime.getURL("soundtouch-worklet.js");
let _extensionEnabled = true;
let _observer: MutationObserver | null;
let _isObserving = false;
let _actualPlaybackRate = 1;
let _actualPitch = 1; // Pitch offset from base frequency. Example 432 / 440 = 0.98
let _audioCtx: AudioContext | null = null;
let _baseFrequency = 440;
let mode: "pitch" | "rate" = "pitch";
let isSoundtouchInit = false;
let soundtouchNode: AudioWorkletNode | null = null;
let srcNode: MediaElementAudioSourceNode | null = null;

function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new AudioContext();
  }
  return _audioCtx;
}

async function initSoundtouch(video: HTMLVideoElement) {
  const audioCtx = getAudioContext();

  console.log("disconnecting old nodes");
  // 1. Teardown old graph (always)
  if (srcNode) srcNode.disconnect();
  if (soundtouchNode) soundtouchNode.disconnect();
  srcNode = null;
  soundtouchNode = null;

  // 2. Initialize the audio context (just once)
  if (!isSoundtouchInit) {
    try {
      await audioCtx.audioWorklet.addModule(WORKLET_PATH);
      console.log("(OK) worklet loaded");
    } catch (err) {
      console.log("(ERROR) failed to load worklet", err);
    }

    await audioCtx.resume(); // Make sure the context is running
    console.log("AudioContext state:", audioCtx.state);
    isSoundtouchInit = true;
  }

  console.log("creating new worklet node");
  // 3. Create the SoundTouch node
  soundtouchNode = new AudioWorkletNode(audioCtx, "soundtouch-processor");
  console.log("node:", soundtouchNode);
  console.log("pitch param:", soundtouchNode.parameters.get("pitch"));

  console.log("connecting srcNode");
  // 4. Point the worklet at your <video> element’s audio
  srcNode = audioCtx.createMediaElementSource(video);

  console.log("connecting to destination");
  // 5. Wire it up: Video → SoundTouch → speakers
  srcNode.connect(soundtouchNode).connect(audioCtx.destination);
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

function changePitch(video: HTMLVideoElement, pitch: number): void {
  console.log(video.id + " " + pitch);
  if (soundtouchNode && _audioCtx) {
    soundtouchNode.parameters
      .get("pitch")!
      .setValueAtTime(pitch, _audioCtx.currentTime);
  } else {
    console.log("(ERROR) SoundTouch node or audio context not initialized");
  }
}

async function tuneVideo(video: HTMLVideoElement): Promise<void> {
  if (!_extensionEnabled) return;

  if (mode === "rate") {
    changePlayBackRate(video, _actualPlaybackRate);
  } else {
    if (!soundtouchNode) {
      await initSoundtouch(video);
    }
    changePitch(video, _actualPitch);
  }
}

/** Re-apply the current mode (rate or pitch) to every <video> on the page */
function applyCurrentSettings(): void {
  document.querySelectorAll("video").forEach(tuneVideo);
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

// function resetTuning(): void {
//   _actualPlaybackRate = 1;
//   _actualPitch = 1;

//   // TODO: Disconnect soundtouch
// }

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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Handle ON/OFF first
  if (message.enabled !== undefined && message.enabled !== null) {
    _extensionEnabled = message.enabled;

    if (!_extensionEnabled) {
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

  if (message.mode === "rate" || message.mode === "pitch") {
    mode = message.mode;
    applyCurrentSettings();
    sendResponse?.({ success: true });
    return;
  }
});
