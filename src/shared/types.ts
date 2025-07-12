export type Frequency = 432 | 440 | 528;
export type Mode = "rate" | "pitch";
export type MediaElem = HTMLVideoElement | HTMLAudioElement;

export interface SoundtouchNodes {
  src: MediaElementAudioSourceNode;
}

export interface GlobalState {
  enabled: boolean;
  mode: Mode;
  frequency: Frequency;
}
