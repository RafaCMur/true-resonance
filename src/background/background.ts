// Simple background script
console.log("Background script loaded");

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "hello") {
    // Send response back
    sendResponse({ response: "Hello from background!" });
  }
  return true; // Required for async response
});

// Basic extension setup
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});
