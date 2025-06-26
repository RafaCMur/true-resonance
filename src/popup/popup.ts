const enableToggle = document.getElementById(
  "enable-extension-toggle"
) as HTMLInputElement;

const resetButton = document.getElementById("reset-btn") as HTMLButtonElement;
const pitchMode = document.getElementById("pitch-mode") as HTMLInputElement;
const rateMode = document.getElementById("rate-mode") as HTMLInputElement;
const appContainer = document.querySelector(".app-container") as HTMLElement;
const youtubeOnlyMessage = document.getElementById(
  "youtube-only-message"
) as HTMLElement;
const goToYoutubeBtn = document.getElementById(
  "go-to-youtube-btn"
) as HTMLButtonElement;

const presetButtons: Record<432 | 528, HTMLButtonElement | null> = {
  432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
  528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
};

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

if (goToYoutubeBtn) {
  goToYoutubeBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.youtube.com" });
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
  (response.mode === "pitch" ? pitchMode : rateMode).checked = true;
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

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
