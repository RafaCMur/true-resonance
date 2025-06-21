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
  const pitch432Button = document.getElementById("pitch-432-btn");
  const pitch528Button = document.getElementById("pitch-528-btn");
  const resetButton = document.getElementById("reset-btn");
  const pitchMode = document.getElementById("pitch-mode") as HTMLInputElement;
  const rateMode = document.getElementById("rate-mode") as HTMLInputElement;

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

  enableToggle?.addEventListener("change", function () {
    chrome.runtime.sendMessage({ enabled: enableToggle.checked });
    sendMessageToActiveTab({ enabled: enableToggle.checked }, (response) => {
      console.log("Content script response:", response);
    });
  });

  pitch432Button?.addEventListener("click", function () {
    const action = pitchMode.checked ? "setPitch" : "setPlaybackRate";
    sendMessageToActiveTab({ action: action, frequency: 432 }, (response) => {
      console.log("Content script response:", response);
    });
  });

  pitch528Button?.addEventListener("click", function () {
    const action = pitchMode.checked ? "setPitch" : "setPlaybackRate";
    sendMessageToActiveTab({ action: action, frequency: 528 }, (response) => {
      console.log("Content script response:", response);
    });
  });

  resetButton?.addEventListener("click", () => {
    sendMessageToActiveTab({ action: "resetPitching" }, (response) => {
      console.log("Content script response:", response);
    });
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
});
