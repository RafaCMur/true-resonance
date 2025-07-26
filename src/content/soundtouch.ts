import { WORKLET_PATH } from "../shared/constants";
import { MediaElem } from "../shared/types";

let _audioCtx: AudioContext | null = null;
export let _globalAudioProcessor: AudioWorkletNode | null = null;
let _isSoundtouchInit = false;

const _sourceMap = new Map<MediaElem, MediaElementAudioSourceNode>();

export function getAudioContext(): AudioContext {
  // If context doesn't exist or was closed by browser, create a fresh one
  if (!_audioCtx || _audioCtx.state === "closed") {
    try {
      _audioCtx = new AudioContext();

      // Any previous global processor / modules need to be recreated
      _globalAudioProcessor = null;
      _isSoundtouchInit = false;

      // The old MediaElementSourceNodes are bound to the old context → clear map
      _sourceMap.clear();
    } catch (error) {
      console.warn('True Resonance: AudioContext creation failed (no user gesture or no media on page)', error);
      throw error;
    }
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

export async function ensureActiveAudioChain(): Promise<void> {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (error) {
        console.warn('True Resonance: Failed to resume AudioContext:', error);
      }
    }
  } catch (error) {
    // AudioContext creation failed, likely no user gesture or no media on page
    // This is expected on pages without audio/video, so we silently ignore it
    return;
  }
}

export function enablePitchPreservation(element: MediaElem): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in element) {
        (element as any)[prop] = true;
      }
    }
  );
}

// Disable pitch preservation on a video element for all browsers
export function disablePitchPreservation(element: MediaElem): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in element) {
        (element as any)[prop] = false;
      }
    }
  );
}

/**
 * Get the MediaElementAudioSourceNode for a media element (video or audio).
 * If it doesn't exist, create it.
 */
function getSource(media: MediaElem): MediaElementAudioSourceNode {
  let src = _sourceMap.get(media);
  if (!src) {
    try {
      src = getAudioContext().createMediaElementSource(media);
      _sourceMap.set(media, src);
    } catch (error) {
      console.error("Failed to create MediaElementAudioSourceNode:", error);
      throw new Error(
        `CORS error: Cannot create audio source for ${window.location.hostname}`
      );
    }
  }
  return src;
}

export function changePitch(value: number): void {
  if (!_globalAudioProcessor) return;
  _globalAudioProcessor.parameters
    .get("pitch")!
    .setValueAtTime(value, getAudioContext().currentTime);
}

export function changePlayBackRate(media: MediaElem, rate: number): void {
  media.playbackRate = rate;
}

export async function connectSoundtouch(media: MediaElem): Promise<boolean> {
  const ctx = getAudioContext();
  if (ctx.state === "suspended" || (ctx.state as any) === "interrupted") {
    await ctx.resume();
  }

  try {
    const src = getSource(media);
    const processor = await getProcessor();

    try {
      src.disconnect();
    } catch (_) {}

    src.connect(processor);
    return true;
  } catch (error) {
    console.warn(
      `Cannot connect SoundTouch on ${window.location.hostname}:`,
      error
    );
    return false;
  }
}

export function disconnectSoundtouch(media: MediaElem) {
  const src = _sourceMap.get(media);
  if (!src) return;

  try {
    src.disconnect();
  } catch (_) {}
  src.connect(getAudioContext().destination);
}

export async function resetSoundTouch(): Promise<void> {
  for (const media of _sourceMap.keys()) {
    disconnectSoundtouch(media);
  }
  if (_globalAudioProcessor) {
    _globalAudioProcessor.disconnect();
    _globalAudioProcessor = null;
  }
  _isSoundtouchInit = false;
}
