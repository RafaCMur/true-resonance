import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { GlobalState } from "../shared/types";

let state: GlobalState = {
  enabled: false,
  mode: "pitch",
  frequency: A4_STANDARD_FREQUENCY,
};

// Load any previously persisted values so they survive service-worker restarts
let _initialized = false;
const _queue: Array<{ patch: Partial<GlobalState> }> = [];

chrome.storage.local.get("state", (res) => {
  if (res.state) state = res.state;
  _initialized = true;
  // flush any queued patches
  _queue.forEach(({ patch }) => setState(patch));
  _queue.length = 0;
});

// Saves the current state to chrome local storage
function persistState() {
  chrome.storage.local.set({ state });
}

// Updates the state and persists it
function setState(patch: Partial<GlobalState>) {
  state = { ...state, ...patch };
  persistState();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "set" && typeof msg.patch === "object") {
    if (!_initialized) {
      _queue.push({ patch: msg.patch });
      sendResponse?.({ queued: true });
      return;
    }
    setState(msg.patch);
    sendResponse({ ok: true });
    return;
  }

  // return true; // <-- only keep this if any of the "other handlers" use sendResponse later
});

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
