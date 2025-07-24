import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { Frequency, GlobalState } from "../shared/types";

/* ------------------------ VARIABLES --------------------------- */

// Top Control Bar Elements
const powerToggle = document.getElementById("powerToggle") as HTMLButtonElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;
const languageBtn = document.getElementById("languageBtn") as HTMLButtonElement;
const languageMenu = document.getElementById("languageMenu") as HTMLElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;

// Legacy toggle (keeping for compatibility)
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

  // Update power toggle
  if (powerToggle) {
    powerToggle.classList.toggle("active", state.enabled);
  }
  
  // Update legacy toggle if it exists
  if (enableToggle) {
    enableToggle.checked = state.enabled;
  }

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

// Top Control Bar Event Listeners

// Power toggle
if (powerToggle) {
  powerToggle.addEventListener("click", () => {
    const isEnabled = powerToggle.classList.contains("active");
    if (isEnabled) {
      sendPatch({ enabled: false });
    } else {
      sendPatch({ enabled: true, frequency: _currentFrequency });
    }
  });
}

// Theme toggle
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    // Toggle theme logic will be implemented later
    console.log("Theme toggle clicked");
    themeToggle.classList.toggle("active");
  });
}

// Language dropdown
if (languageBtn && languageMenu) {
  languageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    languageMenu.classList.toggle("show");
  });
  
  // Close dropdown when clicking outside
  document.addEventListener("click", () => {
    languageMenu.classList.remove("show");
  });
  
  // Language selection
  const languageItems = languageMenu.querySelectorAll(".dropdown-item");
  languageItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const lang = (item as HTMLElement).dataset.lang;
      
      // Update active state
      languageItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      // Update button text
      languageBtn.textContent = lang?.toUpperCase() || "ES";
      
      // Close dropdown
      languageMenu.classList.remove("show");
      
      // Language change logic will be implemented later
      console.log("Language changed to:", lang);
    });
  });
}

// Settings button
if (settingsBtn) {
  settingsBtn.addEventListener("click", () => {
    // Settings logic will be implemented later
    console.log("Settings clicked");
    settingsBtn.classList.toggle("active");
  });
}

// Legacy enable/disable toggle (keeping for compatibility)
if (enableToggle) {
  enableToggle.addEventListener("change", () => {
    if (enableToggle.checked) {
      sendPatch({ enabled: true, frequency: _currentFrequency });
    } else {
      sendPatch({ enabled: false });
    }
  });
}

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
