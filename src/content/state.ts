import {
  A4_STANDARD_FREQUENCY,
  C5_STANDARD_FREQUENCY,
} from "../shared/constants";
import { Frequency, Mode } from "../shared/types";

let _currentPlaybackRate = 1;
let _currentPitch = 1; // Pitch offset from base frequency. Example 432 / 440 = 0.98
let _targetFrequency: Frequency = A4_STANDARD_FREQUENCY;
let _mode: Mode = "pitch"; // Pitch is default mode

export function getReferenceFreq(target: Frequency): number {
  if (target === 528) return C5_STANDARD_FREQUENCY; // 528 is the reference for C5 which is tuned originally to 523.25
  return A4_STANDARD_FREQUENCY;
}

export function recalculateFactors() {
  const factor = _targetFrequency / getReferenceFreq(_targetFrequency); // 432→0.982…
  if (_mode === "rate") {
    _currentPitch = 1;
    _currentPlaybackRate = factor;
  } else {
    _currentPlaybackRate = 1;
    _currentPitch = factor;
  }
}

export function setMode(mode: Mode) {
  _mode = mode;
}

export function setFrequency(freq: Frequency) {
  _targetFrequency = freq;
}

export function getState() {
  return {
    mode: _mode,
    targetFrequency: _targetFrequency,
    currentPlaybackRate: _currentPlaybackRate,
    currentPitch: _currentPitch,
  };
}

// Calculate the playback rate needed to achieve the target frequency
export function calculatePlaybackRate(): number {
  return _targetFrequency / getReferenceFreq(_targetFrequency);
}
