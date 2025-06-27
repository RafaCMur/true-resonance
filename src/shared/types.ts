export type Frequency = 300 | 432 | 440 | 528 | 680;
export type Mode = "rate" | "pitch";

export interface SoundtouchNodes {
  src: MediaElementAudioSourceNode;
  isSoundtouchConnected: boolean;
}

export interface GlobalState {
  enabled: boolean;
  mode: Mode;
  frequency: Frequency;
}
