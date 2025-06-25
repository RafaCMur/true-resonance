function sendMessageToActiveTab(
  message: any,
  callback: (response: any) => void
) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, message, callback);
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const enableToggle = document.getElementById(
    "enable-extension-toggle"
  ) as HTMLInputElement;
  const resetButton = document.getElementById("reset-btn");
  const pitchMode = document.getElementById("pitch-mode") as HTMLInputElement;
  const rateMode = document.getElementById("rate-mode") as HTMLInputElement;
  const presetButtons = {
    432: document.getElementById("pitch-432-btn") as HTMLButtonElement,
    528: document.getElementById("pitch-528-btn") as HTMLButtonElement,
  };

  function highlight(freq: 432 | 528 | 440) {
    Object.entries(presetButtons).forEach(([hz, btn]) => {
      btn.classList.toggle("active", Number(hz) === freq);
    });
  }

  function sendMsgToTabAndBackground(msg: any, cb?: () => void) {
    sendMessageToActiveTab(msg, () => cb?.());
    chrome.runtime.sendMessage(msg);
  }

  // Get the current state of the extension
  chrome.runtime.sendMessage({ action: "getEnabled" }, (resp) => {
    enableToggle.checked = !!resp.enabled; // false if undefined
  });

  // Get the current mode and set the appropriate radio button value
  chrome.runtime.sendMessage({ action: "getMode" }, (resp) => {
    if (resp.mode === "pitch") {
      pitchMode.checked = true;
    } else {
      rateMode.checked = true;
    }
  });

  enableToggle.addEventListener("change", () => {
    const enabled = enableToggle.checked;
    chrome.runtime.sendMessage({ enabled });
    sendMessageToActiveTab({ enabled }, () => {
      if (!enabled) highlight(440);
    });
  });

  // 432 hz
  presetButtons[432]?.addEventListener("click", () => {
    const action = pitchMode.checked ? "setPitch" : "setPlaybackRate";
    const freq = 432 as const;
    sendMsgToTabAndBackground({ action, frequency: freq }, () =>
      highlight(freq)
    );
  });

  // 528 hz
  presetButtons[528]?.addEventListener("click", () => {
    const action = pitchMode.checked ? "setPitch" : "setPlaybackRate";
    const freq = 528 as const;
    sendMsgToTabAndBackground({ action, frequency: freq }, () =>
      highlight(freq)
    );
  });

  // Reset to 440 Hz
  resetButton?.addEventListener("click", () => {
    sendMsgToTabAndBackground({ action: "resetPitching" }, () =>
      highlight(440)
    );
  });

  rateMode?.addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "setMode", mode: "rate" });
    sendMessageToActiveTab({ action: "setMode", mode: "rate" }, (response) => {
      console.log("Content script response:", response);
    });
  });

  pitchMode?.addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "setMode", mode: "pitch" });
    sendMessageToActiveTab({ action: "setMode", mode: "pitch" }, (response) => {
      console.log("Content script response:", response);
    });
  });

  chrome.runtime.sendMessage({ action: "getFrequency" }, (resp) => {
    highlight(resp.frequency as 432 | 528 | 440);
  });
});
