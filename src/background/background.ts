import { Frequency, Mode } from "../shared/types";

let _extensionEnabled = false; // disabled by default
let _mode: Mode = "pitch";
let _currentFrequency: Frequency = 440;

// Load any previously persisted values so they survive service-worker restarts
chrome.storage.local.get(
  ["extensionEnabled", "mode", "currentFrequency"],
  (res) => {
    if (typeof res.extensionEnabled === "boolean") _extensionEnabled = res.extensionEnabled;
    if (res.mode === "rate" || res.mode === "pitch") _mode = res.mode;
    if (typeof res.currentFrequency === "number") _currentFrequency = res.currentFrequency as Frequency;
  }
);

function persistState() {
  chrome.storage.local.set({
    extensionEnabled: _extensionEnabled,
    mode: _mode,
    currentFrequency: _currentFrequency,
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "getEnabled") {
    sendResponse({ enabled: _extensionEnabled });
    return; // sync
  }

  if (msg.action === "getMode") {
    sendResponse({ mode: _mode });
    return; // sync
  }

  if (msg.action === "getFrequency") {
    sendResponse({ frequency: _currentFrequency });
    return; // sync
  }

  if (
    msg.action === "setMode" &&
    (msg.mode === "rate" || msg.mode === "pitch")
  ) {
    _mode = msg.mode;
    persistState();
    sendResponse({ success: true });
    return;
  }

  if (typeof msg.enabled === "boolean") {
    _extensionEnabled = msg.enabled;
    if (!msg.enabled) _currentFrequency = 440;
    persistState();
    sendResponse({ success: true });
    return;
  }

  if (msg.action === "resetPitching") {
    _currentFrequency = 440;
    persistState();
    sendResponse({ success: true });
    return;
  }

  if (msg.action === "setPitch" || msg.action === "setPlaybackRate") {
    _currentFrequency = msg.frequency as 432 | 528 | 440;
    persistState();
    sendResponse({ success: true });
    return;
  }

  // return true; // <-- only keep this if any of the "other handlers" use sendResponse later
});

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
