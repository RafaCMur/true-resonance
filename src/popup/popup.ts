// Simple popup script
console.log("Popup script loaded");

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

// Execute when DOM has fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Get button elements
  const pitch432Button = document.getElementById("pitch-432-btn");
  const pitch528Button = document.getElementById("pitch-528-btn");
  const resetButton = document.getElementById("reset-btn");
  const pitchMode = document.getElementById("pitch-mode") as HTMLInputElement;
  // TODO const rateMode = document.getElementById("rate-mode") as HTMLInputElement;

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

  resetButton?.addEventListener("click", function () {
    const action = pitchMode.checked ? "setPitch" : "setPlaybackRate";
    sendMessageToActiveTab({ action: action, frequency: 440 }, (response) => {
      console.log("Content script response:", response);
    });
  });
});
