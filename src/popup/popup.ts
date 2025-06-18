// Simple popup script
console.log("Popup script loaded");

// Execute when DOM has fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Get button elements
  const backgroundButton = document.getElementById("test-background");
  const contentButton = document.getElementById("test-content");

  // Add click handler for background test
  backgroundButton?.addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "hello" }, function (response) {
      alert("Background response: " + response.response);
    });
  });

  // Add click handler for content script test
  contentButton?.addEventListener("click", function () {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]?.id) {
        // Send message to the content script
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "testAlert" },
          function (response) {
            console.log("Content script response:", response);
          }
        );
      }
    });
  });
});
