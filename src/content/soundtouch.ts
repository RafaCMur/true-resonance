import { WORKLET_PATH } from "../shared/constants";
import { MediaElem } from "../shared/types";

let _audioCtx: AudioContext | null = null;
export let _globalAudioProcessor: AudioWorkletNode | null = null;
let _isSoundtouchInit = false;

const _sourceMap = new Map<MediaElem, MediaElementAudioSourceNode>();

// Check for both "suspended" (Windows/Linux) and "interrupted" (macOS)
export function isAudioContextSuspended(ctx: AudioContext): boolean {
  return ctx.state === "suspended" || (ctx.state as any) === "interrupted";
}

export function getAudioContext(): AudioContext {
  // If context doesn't exist or was closed by browser, create a fresh one
  if (!_audioCtx || _audioCtx.state === "closed") {
    // Check if there are any media elements on the page before creating AudioContext
    const hasMedia = document.querySelectorAll("video, audio").length > 0;
    if (!hasMedia) {
      throw new Error("No media elements found on page");
    }

    try {
      _audioCtx = new AudioContext();

      // Any previous global processor / modules need to be recreated
      _globalAudioProcessor = null;
      _isSoundtouchInit = false;

      // The old MediaElementSourceNodes are bound to the old context → clear map
      _sourceMap.clear();
    } catch (error) {
      // AudioContext creation failed - this is expected on pages without media elements
      // or when there's no user gesture. We silently throw to let callers handle it.
      throw error;
    }
  }
  return _audioCtx;
}

async function getProcessor(): Promise<AudioWorkletNode> {
  if (_globalAudioProcessor) return _globalAudioProcessor;

  try {
    const ctx = getAudioContext();

    if (!_isSoundtouchInit) {
      await ctx.audioWorklet.addModule(WORKLET_PATH);
      _isSoundtouchInit = true;
    }

    _globalAudioProcessor = new AudioWorkletNode(ctx, "soundtouch-processor");
    _globalAudioProcessor.connect(ctx.destination);
    return _globalAudioProcessor;
  } catch (error) {
    // AudioContext creation failed - no media elements on page
    throw error;
  }
}

export async function ensureActiveAudioChain(): Promise<void> {
  try {
    const ctx = getAudioContext();

    if (isAudioContextSuspended(ctx)) {
      try {
        await ctx.resume();
      } catch (error) {
        // Failed to resume - this can happen on pages without user interaction
        // We silently ignore this as it's expected behavior
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
  try {
    const ctx = getAudioContext();
    if (isAudioContextSuspended(ctx)) {
      await ctx.resume();
    }

    const src = getSource(media);
    const processor = await getProcessor();

    try {
      src.disconnect();
    } catch (_) {}

    src.connect(processor);
    return true;
  } catch (error) {
    // Only show warning if there are media elements on the page
    // If no media elements, this error is expected and we silently ignore it
    const hasMedia = document.querySelectorAll("video, audio").length > 0;
    if (hasMedia) {
      console.warn(
        `Cannot connect SoundTouch on ${window.location.hostname}:`,
        error
      );
    }
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
