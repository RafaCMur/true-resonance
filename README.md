# True Resonance

Chrome extension that lets you retune YouTube videos to popular "healing" frequencies (e.g. 432 Hz, 528 Hz) in real-time.

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

The source code of **True Resonance** is released under the **True Resonance Non-Commercial License 1.0** (see `LICENSE`).

• You are free to read, modify and redistribute the code **for non-commercial purposes**.
• Any commercial or revenue-generating use requires prior written permission from the author.

Third-party components retain their original licenses. In particular, **SoundTouch** is distributed under the **LGPL-2.1** (license file included in `node_modules/@soundtouchjs/audio-worklet/`).
