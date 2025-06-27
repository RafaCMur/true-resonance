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
const appContainer = document.querySelector(".app-container") as HTMLElement;
const youtubeOnlyMessage = document.getElementById(
  "youtube-only-message"
) as HTMLElement;
const researchDropdownBtn = document.getElementById(
  "research-dropdown-btn"
) as HTMLButtonElement;
const researchContent = document.getElementById(
  "research-content"
) as HTMLElement;

let _currentFrequency: Frequency = 440;

const presetButtons: Record<300 | 432 | 528 | 680, HTMLButtonElement | null> = {
  300: document.getElementById("pitch-300-btn") as HTMLButtonElement,
  432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
  680: document.getElementById("pitch-680-btn") as HTMLButtonElement,
};

/* ------------------------ FUNCTIONS --------------------------- */

// TODO is this called once?
// Check if current page is YouTube
function checkIfYouTube() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const url = activeTab?.url || "";
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

    // Show/hide appropriate elements
    appContainer.style.display = isYouTube ? "block" : "none";
    youtubeOnlyMessage.style.display = isYouTube ? "none" : "block";
  });
}

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

// Run the check when popup opens
checkIfYouTube();

chrome.storage.local.get("state", ({ state }) => paintUI(state));

chrome.storage.onChanged.addListener(({ state }) => {
  if (state?.newValue) paintUI(state.newValue as GlobalState);
});

// Toggle research dropdown when clicked
if (researchDropdownBtn && researchContent) {
  researchDropdownBtn.addEventListener("click", () => {
    // Toggle active classes for styling
    researchDropdownBtn.classList.toggle("active");
    researchContent.classList.toggle("active");
  });
}

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
