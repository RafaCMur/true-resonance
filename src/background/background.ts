let _extensionEnabled = false; // disabled by default
let _mode: "rate" | "pitch" = "pitch";
let _currentFrequency: 432 | 528 | 440 = 440;

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
    sendResponse({ success: true });
    return;
  }

  if (typeof msg.enabled === "boolean") {
    _extensionEnabled = msg.enabled;
    if (!msg.enabled) _currentFrequency = 440;
    sendResponse({ success: true });
    return;
  }

  if (msg.action === "resetPitching") {
    _currentFrequency = 440;
    sendResponse({ success: true });
    return;
  }

  if (msg.action === "setPitch" || msg.action === "setPlaybackRate") {
    _currentFrequency = msg.frequency as 432 | 528 | 440;
    sendResponse({ success: true });
    return;
  }

  // return true; // <-- only keep this if any of the "other handlers" use sendResponse later
});
