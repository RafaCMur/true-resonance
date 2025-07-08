import { WORKLET_PATH } from "../shared/constants";

let _audioCtx: AudioContext | null = null;
export let _globalAudioProcessor: AudioWorkletNode | null = null;
let _isSoundtouchInit = false;

const _sourceMap = new Map<HTMLVideoElement, MediaElementAudioSourceNode>();

export function getAudioContext(): AudioContext {
  // If context doesn't exist or was closed by browser, create a fresh one
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();

    // Any previous global processor / modules need to be recreated
    _globalAudioProcessor = null;
    _isSoundtouchInit = false;

    // The old MediaElementSourceNodes are bound to the old context → clear map
    _sourceMap.clear();
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
  const ctx = getAudioContext();

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch (_) {}
  }
}

export function enablePitchPreservation(video: HTMLVideoElement): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in video) {
        (video as any)[prop] = true;
      }
    }
  );
}

// Disable pitch preservation on a video element for all browsers
export function disablePitchPreservation(video: HTMLVideoElement): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in video) {
        (video as any)[prop] = false;
      }
    }
  );
}

/**
 * Get the MediaElementAudioSourceNode for a video element.
 * If it doesn't exist, create it.
 */
function getSource(video: HTMLVideoElement): MediaElementAudioSourceNode {
  let src = _sourceMap.get(video);
  if (!src) {
    src = getAudioContext().createMediaElementSource(video);
    _sourceMap.set(video, src);
  }
  return src;
}

export function changePitch(value: number): void {
  if (!_globalAudioProcessor) return;
  _globalAudioProcessor.parameters
    .get("pitch")!
    .setValueAtTime(value, getAudioContext().currentTime);
}

export function changePlayBackRate(
  video: HTMLVideoElement,
  rate: number
): void {
  video.playbackRate = rate;
}

export async function connectSoundtouch(video: HTMLVideoElement) {
  const ctx = getAudioContext();
  if (ctx.state === "suspended" || (ctx.state as any) === "interrupted") {
    await ctx.resume();
  }

  const src = getSource(video);

  const processor = await getProcessor();
  try {
    src.disconnect();
  } catch (_) {}

  src.connect(processor);
}

export function disconnectSoundtouch(video: HTMLVideoElement) {
  const src = _sourceMap.get(video);
  if (!src) return;

  try {
    src.disconnect();
  } catch (_) {}
  src.connect(getAudioContext().destination);
}

export async function resetSoundTouch(): Promise<void> {
  for (const video of _sourceMap.keys()) {
    disconnectSoundtouch(video);
  }
  if (_globalAudioProcessor) {
    _globalAudioProcessor.disconnect();
    _globalAudioProcessor = null;
  }
  _isSoundtouchInit = false;
}
