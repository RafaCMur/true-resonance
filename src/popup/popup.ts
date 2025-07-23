import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { Frequency, GlobalState } from "../shared/types";

/* ------------------------ VARIABLES --------------------------- */

const enableToggle = document.getElementById(
  "enable-extension-toggle"
) as HTMLInputElement;

const resetButton = document.getElementById("reset-btn") as HTMLButtonElement;
const pitchModeBtn = document.getElementById(
  "pitch-mode-btn"
) as HTMLButtonElement;
const rateModeBtn = document.getElementById(
  "rate-mode-btn"
) as HTMLButtonElement;

let _currentFrequency: Frequency = A4_STANDARD_FREQUENCY;

const presetButtons: Record<432 | 528, HTMLButtonElement | null> = {
  432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
};

/* ------------------------ FUNCTIONS --------------------------- */

/**
 * Sends a patch to the background script
 * @param patch The patch is an object only with the properties to update
 */
function sendPatch(patch: Partial<GlobalState>) {
  chrome.runtime.sendMessage({ action: "set", patch });
}

/** Highlights the button that matches the current frequency */
function highlightButton(freq: Frequency): void {
  Object.entries(presetButtons).forEach(([hz, btn]) => {
    if (btn) btn.classList.toggle("active", Number(hz) === freq);
  });
}

function paintUI(state?: GlobalState) {
  if (!state) return;

  enableToggle.checked = state.enabled;

  if (state.mode === "rate") {
    rateModeBtn.classList.add("active");
    pitchModeBtn.classList.remove("active");
  } else {
    pitchModeBtn.classList.add("active");
    rateModeBtn.classList.remove("active");
  }

  _currentFrequency = state.frequency;
  highlightButton(state.frequency);
}

/* ------------------------ EXECUTION --------------------------- */

chrome.storage.local.get("state", ({ state }) => paintUI(state));

chrome.storage.onChanged.addListener(({ state }) => {
  if (state?.newValue) paintUI(state.newValue as GlobalState);
});

// Master enable / disable toggle
enableToggle.addEventListener("change", () => {
  if (enableToggle.checked) {
    sendPatch({ enabled: true, frequency: _currentFrequency });
  } else {
    sendPatch({ enabled: false });
  }
});

// Preset buttons (432 Hz and 528 Hz)
Object.entries(presetButtons).forEach(([hz, btn]) => {
  if (!btn) return;

  btn.addEventListener("click", () => {
    const freq = Number(hz) as Frequency;
    _currentFrequency = freq;
    sendPatch({ frequency: freq });
  });
});

// Reset button → back to 440 Hz
resetButton.addEventListener("click", () =>
  sendPatch({ frequency: A4_STANDARD_FREQUENCY })
);

// Mode buttons
rateModeBtn.addEventListener("click", () => sendPatch({ mode: "rate" }));
pitchModeBtn.addEventListener("click", () => sendPatch({ mode: "pitch" }));

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
