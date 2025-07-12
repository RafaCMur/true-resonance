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

function updateBadge(state: GlobalState): void {
  if (state.enabled && state.frequency !== A4_STANDARD_FREQUENCY) {
    chrome.action.setBadgeText({ text: String(state.frequency) });
    chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.storage.local.get("state", (res) => {
  if (res.state) state = res.state;
  _initialized = true;
  updateBadge(state);
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
  updateBadge(state);
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
