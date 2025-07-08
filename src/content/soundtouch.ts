import { WORKLET_PATH } from "../shared/constants";
import { SoundtouchNodes } from "../shared/types";

let _audioCtx: AudioContext | null = null;
export let _globalAudioProcessor: AudioWorkletNode | null = null;
let _isSoundtouchInit = false;

const _soundtouchMap = new Map<HTMLVideoElement, SoundtouchNodes>();

export function getAudioContext(): AudioContext {
  // If context doesn't exist or was closed by browser, create a fresh one
  if (!_audioCtx || _audioCtx.state === "closed") {
    _audioCtx = new AudioContext();

    // Any previous global processor / modules need to be recreated
    _globalAudioProcessor = null;
    _isSoundtouchInit = false;

    // The old MediaElementSourceNodes are bound to the old context → clear map
    _soundtouchMap.clear();
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
 * Get the MediaElementAudioSourceNode and AudioWorkletNode for a video element.
 * If they don't exist, create them.
 */
function getSoundtouchNodes(video: HTMLVideoElement): SoundtouchNodes {
  let nodes = _soundtouchMap.get(video);
  if (!nodes) {
    const src = getAudioContext().createMediaElementSource(video);
    nodes = { src };
    _soundtouchMap.set(video, nodes);
  }
  return nodes;
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

  const { src } = getSoundtouchNodes(video);

  const processor = await getProcessor();
  try {
    src.disconnect();
  } catch (_) {}

  src.connect(processor);
}

export function disconnectSoundtouch(video: HTMLVideoElement) {
  const entry = _soundtouchMap.get(video);
  if (!entry) return;

  const { src } = entry;
  try {
    src.disconnect();
  } catch (_) {}
  src.connect(getAudioContext().destination);
}

export async function resetSoundTouch(): Promise<void> {
  for (const video of _soundtouchMap.keys()) {
    disconnectSoundtouch(video);
  }
  if (_globalAudioProcessor) {
    _globalAudioProcessor.disconnect();
    _globalAudioProcessor = null;
  }
  _isSoundtouchInit = false;
}
