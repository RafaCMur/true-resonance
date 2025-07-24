# True Resonance

Chrome extension that lets you retune music to popular "healing" frequencies (e.g. 432 Hz, 528 Hz) in real-time.

- Supports YouTube videos, YouTube Music, Suno, etc.
- Pitch-shift or playback-rate modes.
- Preset buttons and quick reset to standard 440 Hz.
- Audio chain automatically recovers after tab inactivity.
- Built with TypeScript + Webpack.
- Uses **SoundTouch** (via a custom AudioWorklet) for high-quality pitch processing.

## Build & load locally

```bash
npm install
npm run build # Compiles the extension
```

1. Open `chrome://extensions` in Chrome.
2. Enable "Developer mode".
3. Click "Load unpacked" and select the **dist** folder.

The extension **must be compiled** before loading it into Chrome.

## Folder overview

- `src/` – TypeScript sources (content, popup, background).
- `public/` – popup UI, worklet script, icons.
- `manifest.json` – Chrome extension manifest v3.

## Credits

Audio processing powered by the [SoundTouch AudioWorklet](https://github.com/cutterbl/soundtouchjs-audio-worklet) algorithm compiled for Web Audio.

---

## License

The source code of **True Resonance** is released under the **GNU Affero General Public License v3.0 or later** (see `LICENSE`).

Commercial use is allowed **provided that** the entire derivative work is also released under the AGPL.  
If you need to embed the code without disclosing your modifications, please contact <rafacmurdev@gmail.com> for a commercial licence.

Third-party components keep their original licences. In particular, **SoundTouch** is distributed under the **LGPL-2.1** (see `https://github.com/cutterbl/soundtouchjs-audio-worklet`).
