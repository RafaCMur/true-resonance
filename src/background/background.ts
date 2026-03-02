import { A4_STANDARD_FREQUENCY } from "../shared/constants";
import { GlobalState } from "../shared/types";

const DEFAULT_STATE: GlobalState = {
  enabled: false,
  mode: "pitch",
  frequency: A4_STANDARD_FREQUENCY,
};

let state: GlobalState = { ...DEFAULT_STATE };

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

// Initialize state and badge
function initializeExtension() {
  chrome.storage.local.get("state", (res) => {
    if (res.state) {
      state = res.state;
    } else {
      // No previous state: set default state
      state = { ...DEFAULT_STATE };
      persistState();
    }
    _initialized = true;
    updateBadge(state);
    // flush any queued patches
    _queue.forEach(({ patch }) => setState(patch));
    _queue.length = 0;
  });
}

// Initialize on startup
initializeExtension();

// Re-initialize when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  initializeExtension();
});

// Initialize when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

// Update badge when switching tabs (ensures badge is always visible)
chrome.tabs.onActivated.addListener(() => {
  if (_initialized) {
    updateBadge(state);
  }
});

// Stop tabCapture when the captured tab is closed to clean up the offscreen document
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === _capturedTabId) {
    handleStopTabCapture();
  }
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

const OFFSCREEN_URL = chrome.runtime.getURL("offscreen.html");
let _capturedTabId: number | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [OFFSCREEN_URL],
  });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [
        chrome.offscreen.Reason.USER_MEDIA,
        chrome.offscreen.Reason.AUDIO_PLAYBACK,
      ],
      justification:
        "Process captured tab audio through SoundTouch for pitch shifting",
    });
  }
}

function notifyTabCaptureReset(tabId: number): void {
  // Tell the content script in that tab its tabCapture was displaced
  chrome.tabs.sendMessage(tabId, { action: "tabCaptureReset" }).catch(() => {});
}

async function handleStartTabCapture(
  tabId: number,
  pitch: number,
): Promise<{ success: boolean }> {
  try {
    if (_capturedTabId === tabId) {
      // Already capturing this tab - just forward the pitch update
      chrome.runtime.sendMessage({
        target: "offscreen",
        action: "setPitch",
        value: pitch,
      });
      return { success: true };
    }

    if (_capturedTabId !== null) {
      // Notify the displaced tab so it can reset its _tabCaptureActive flag
      notifyTabCaptureReset(_capturedTabId);
      await handleStopTabCapture();
    }

    // Get stream ID without consumerTabId so the offscreen document can consume it
    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(id);
        }
      });
    });

    await ensureOffscreenDocument();

    const result = await new Promise<{ success: boolean }>((resolve) => {
      chrome.runtime.sendMessage(
        { target: "offscreen", action: "startCapture", streamId, pitch },
        (res) => resolve(res ?? { success: false }),
      );
    });

    if (result?.success) {
      _capturedTabId = tabId;
    }
    return result;
  } catch (error: any) {
    console.error("[True Resonance BG] startTabCapture failed:", error);
    return { success: false };
  }
}

async function handleStopTabCapture(): Promise<void> {
  _capturedTabId = null;
  try {
    chrome.runtime.sendMessage({ target: "offscreen", action: "stopCapture" });
  } catch (_) {}
  try {
    await chrome.offscreen.closeDocument();
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "set" && typeof msg.patch === "object") {
    if (!_initialized) {
      _queue.push({ patch: msg.patch });
      sendResponse?.({ queued: true });
      return false;
    }
    setState(msg.patch);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === "startTabCapture") {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ success: false });
      return false;
    }
    handleStartTabCapture(tabId, msg.pitch).then(sendResponse);
    return true;
  }

  if (msg.action === "stopTabCapture") {
    handleStopTabCapture().then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === "setTabCapturePitch") {
    const senderTabId = sender.tab?.id;
    chrome.runtime.sendMessage(
      { target: "offscreen", action: "setPitch", value: msg.value },
      () => {
        // If the offscreen is gone, lastError fires and _capturedTabId is now stale
        if (chrome.runtime.lastError && senderTabId !== undefined) {
          _capturedTabId = null;
          notifyTabCaptureReset(senderTabId);
        }
      },
    );
    return false;
  }

  return false;
});

export {}; // This is to prevent the file from being a module and isolates the variables (errors from typescript)
