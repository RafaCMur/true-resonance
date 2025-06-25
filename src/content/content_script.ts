const WORKLET_PATH = chrome.runtime.getURL("soundtouch-worklet.js");
let _extensionEnabled = false; // extension is disabled by default
let _observer: MutationObserver | null;
let _isObserving = false;
let _actualPlaybackRate = 1;
let _actualPitch = 1; // Pitch offset from base frequency. Example 432 / 440 = 0.98
let _audioCtx: AudioContext | null = null;
let _globalAudioProcessor: AudioWorkletNode | null = null;
let _baseFrequency = 440;
let _mode: "pitch" | "rate" = "pitch";
let _isSoundtouchInit = false;
interface SoundtouchNodes {
  src: MediaElementAudioSourceNode;
  isSoundtouchConnected: boolean;
}

const _soundtouchMap = new Map<HTMLVideoElement, SoundtouchNodes>();
const _listenerMap = new Map<HTMLVideoElement, () => void>();

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
  } catch (e) {
    console.error(e);
  }

  src.connect(processor);
  getSoundtouchNodes(video).isSoundtouchConnected = true;
}

function disconnectSoundtouch(video: HTMLVideoElement) {
  const entry = _soundtouchMap.get(video);
  if (!entry || !entry.isSoundtouchConnected) return;

  const { src } = entry;
  try {
    src.disconnect();
  } catch (e) {
    console.error(e);
  }
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
    changePlayBackRate(video, _actualPlaybackRate);
    disablePitchPreservation(video);
  } else {
    changePlayBackRate(video, 1);
    enablePitchPreservation(video);
    changePitch(_actualPitch);
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

// Ask background if extension is enabled
chrome.runtime.sendMessage({ action: "getEnabled" }, ({ enabled }) => {
  _extensionEnabled = enabled;
  if (enabled) {
    initVideoObservers();
  }
});

// Listen for messages from the background or popup
chrome.runtime.onMessage.addListener(async (msg, _s, send) => {
  /* ----- Toggle ON / OFF -------------------------- */
  if (msg.enabled !== undefined && msg.enabled !== null) {
    _extensionEnabled = msg.enabled;

    if (!_extensionEnabled) {
      await resetSoundTouch();
      disconnectAllVideos();
    } else {
      initVideoObservers();
    }
    send?.({ success: true });
    return;
  }

  /* ----- Change mode -------------------------- */
  if (msg.action === "setMode") {
    _mode = msg.mode;
    if (_extensionEnabled) applyCurrentSettings();
    send?.({ success: true });
    return;
  }

  /* ----- Change pitch ------------------------- */
  if (msg.action === "setPitch") {
    _actualPitch = msg.frequency / _baseFrequency;
    if (_extensionEnabled) applyCurrentSettings();
    send?.({ success: true });
    return;
  }

  /* ----- Change rate -------------------------- */
  if (msg.action === "setPlaybackRate") {
    _actualPlaybackRate = msg.frequency / _baseFrequency;
    if (_extensionEnabled) applyCurrentSettings();
    send?.({ success: true });
    return;
  }

  /* ----- Reset pitch/rate --------------------- */
  if (msg.action === "resetPitching") {
    await resetPitching();
    send?.({ success: true });
    return;
  }
});
