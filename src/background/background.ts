let _extensionEnabled = false; // disabled by default
let _mode: "rate" | "pitch" = "pitch";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "getEnabled") {
    // always respond (even right after startup) with our in-memory flag
    sendResponse({ enabled: _extensionEnabled });
    return; // sync
  }

  if (msg.action === "getMode") {
    sendResponse({ mode: _mode });
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
    sendResponse({ success: true });
    return;
  }

  // return true; // <-- only keep this if any of the "other handlers" use sendResponse later
});
