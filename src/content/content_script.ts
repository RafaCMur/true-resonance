// Simple content script
console.log("Content script loaded");

let _observer: MutationObserver;
let videoEls: NodeListOf<HTMLVideoElement>;

function disablePitchPreservation(video: HTMLVideoElement): void {
  // Disable pitch preservation across all browsers
  // Standard property
  if ("preservesPitch" in video) {
    (video as any).preservesPitch = false;
  }

  // Chrome/Safari
  if ("webkitPreservesPitch" in video) {
    (video as any).webkitPreservesPitch = false;
  }

  // Firefox
  if ("mozPreservesPitch" in video) {
    (video as any).mozPreservesPitch = false;
  }
}

function changePlayBackRate(video: HTMLVideoElement, rate: number): void {
  disablePitchPreservation(video);
  video.playbackRate = rate;
  disablePitchPreservation(video);
}

/**
 * Initialize video observers to detect when new videos are added to the page
 */
function initVideoObservers(): void {
  // Create a mutation observer to detect when new videos are added to the page
  _observer = new MutationObserver((mutations: MutationRecord[]) => {
    mutations.forEach((mutation: MutationRecord) => {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Check each added node
        for (const node of mutation.addedNodes) {
          // If it's a video element, log it
          if (node instanceof HTMLVideoElement) {
            console.log("Video element found:", node);
            changePlayBackRate(node, 2);
          }
          // If it might contain videos, look inside it
          else if (node instanceof Element && node.querySelectorAll) {
            const videos = node.querySelectorAll("video");
            videos.forEach((video) => {
              console.log("Video element found inside new DOM node:", video);
              changePlayBackRate(video, 2);
            });
          }
        }
      }
    });
  });

  // Configure the observer
  const observerConfig = {
    childList: true, // Watch for changes to children
    subtree: true, // Watch the entire subtree
  };

  // Start observing the document body
  _observer.observe(document.body, observerConfig);

  // Find and log any existing videos
  videoEls = document.querySelectorAll("video");
  if (videoEls.length > 0) {
    console.log(`Found ${videoEls.length} existing video elements`);
    videoEls.forEach((video) => {
      console.log("Existing video element:", video);
    });
  }
}

// Listen for messages from popup (via background)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "testAlert") {
    alert("Hello from content script!");
    sendResponse({ success: true });
  }
  return true;
});

// Example: Send a message to background when page loads
function sendTestMessage() {
  chrome.runtime.sendMessage({ action: "hello" }, (response) => {
    console.log("Got response:", response);
  });
}

// Run when content script loads
sendTestMessage();
initVideoObservers();
