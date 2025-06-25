const enableToggle = document.getElementById(
  "enable-extension-toggle"
) as HTMLInputElement;

const resetButton = document.getElementById("reset-btn") as HTMLButtonElement;
const pitchMode = document.getElementById("pitch-mode") as HTMLInputElement;
const rateMode = document.getElementById("rate-mode") as HTMLInputElement;

const presetButtons: Record<432 | 528, HTMLButtonElement | null> = {
  432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
};

function sendMessageToActiveTab(
  message: any,
  callback?: (response: any) => void
): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) return;

    // Use the correct overload: with or without callback
    callback
      ? chrome.tabs.sendMessage(activeTab.id, message, callback) // 3-argument
      : chrome.tabs.sendMessage(activeTab.id, message); // 2-argument
  });
}

/** Sends the same message to the background script and the active tab */
function sendToAll(message: any): void {
  sendMessageToActiveTab(message);
  chrome.runtime.sendMessage(message);
}

/** Highlights the button that matches the current frequency */
function highlightButton(freq: 432 | 528 | 440): void {
  Object.entries(presetButtons).forEach(([hz, btn]) => {
    if (btn) btn.classList.toggle("active", Number(hz) === freq);
  });
}

/** Queries the background for the stored frequency and updates the UI */
function refreshHighlight(): void {
  chrome.runtime.sendMessage({ action: "getFrequency" }, (response) => {
    highlightButton(response.frequency as 432 | 528 | 440);
  });
}

// Is the extension enabled?
chrome.runtime.sendMessage({ action: "getEnabled" }, (response) => {
  enableToggle.checked = !!response.enabled;
});

// Current mode (pitch vs. rate)?
chrome.runtime.sendMessage({ action: "getMode" }, (response) => {
  (response.mode === "pitch" ? pitchMode : rateMode).checked = true;
});

// Current frequency preset?
refreshHighlight();

/* ---------- Event listeners ---------- */

// Master enable / disable toggle
enableToggle.addEventListener("change", () => {
  const enabled = enableToggle.checked;
  sendToAll({ enabled });
  if (!enabled) highlightButton(440);
});

// Preset buttons (432 Hz and 528 Hz)
Object.entries(presetButtons).forEach(([hz, btn]) => {
  if (!btn) return;

  btn.addEventListener("click", () => {
    const action = pitchMode.checked ? "setPitch" : "setPlaybackRate";
    const frequency = Number(hz) as 432 | 528;
    sendToAll({ action, frequency });
    highlightButton(frequency);
  });
});

// Reset button → back to 440 Hz
resetButton.addEventListener("click", () => {
  sendToAll({ action: "resetPitching" });
  highlightButton(440);
});

// Mode radio buttons
rateMode.addEventListener("click", () => {
  sendToAll({ action: "setMode", mode: "rate" });
  refreshHighlight();
});

pitchMode.addEventListener("click", () => {
  sendToAll({ action: "setMode", mode: "pitch" });
  refreshHighlight();
});
