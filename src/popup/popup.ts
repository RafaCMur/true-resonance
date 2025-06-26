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
let currentMode: "pitch" | "rate" = "pitch";
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

const presetButtons: Record<432 | 528, HTMLButtonElement | null> = {
  432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
};

// Toggle research dropdown when clicked
if (researchDropdownBtn && researchContent) {
  researchDropdownBtn.addEventListener("click", () => {
    // Toggle active classes for styling
    researchDropdownBtn.classList.toggle("active");
    researchContent.classList.toggle("active");
  });
}

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

// Run the check when popup opens
checkIfYouTube();

// --------- FUNCTIONS ---------

function sendMessageToActiveTab(
  message: any,
  callback?: (response: any) => void
): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id) return;

    // Use the correct overload: with or without callback
    callback
      ? chrome.tabs.sendMessage(activeTab.id, message, callback)
      : chrome.tabs.sendMessage(activeTab.id, message);
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

/** Asks the background for the stored frequency and updates the UI */
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
  currentMode = response.mode === "rate" ? "rate" : "pitch";
  pitchModeBtn.classList.toggle("active", currentMode === "pitch");
  rateModeBtn.classList.toggle("active", currentMode === "rate");
});

// Current frequency preset?
refreshHighlight();

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
    const action = currentMode === "pitch" ? "setPitch" : "setPlaybackRate";
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

// Mode buttons
pitchModeBtn.addEventListener("click", () => {
  if (currentMode !== "pitch") {
    currentMode = "pitch";
    pitchModeBtn.classList.add("active");
    rateModeBtn.classList.remove("active");
    sendToAll({ action: "setMode", mode: "pitch" });
    refreshHighlight();
  }
});

rateModeBtn.addEventListener("click", () => {
  if (currentMode !== "rate") {
    currentMode = "rate";
    rateModeBtn.classList.add("active");
    pitchModeBtn.classList.remove("active");
    sendToAll({ action: "setMode", mode: "rate" });
    refreshHighlight();
  }
});

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
