// Content script loaded
console.log("Content script loaded");

let _observer: MutationObserver;
let _actualPlaybackRate = 1;
let _baseFrequency = 440;

// Disable pitch preservation on a video element for all browsers
function disablePitchPreservation(video: HTMLVideoElement): void {
  ["preservesPitch", "webkitPreservesPitch", "mozPreservesPitch"].forEach(
    (prop) => {
      if (prop in video) {
        (video as any)[prop] = false;
      }
    }
  );
}

// Change playback rate and disable pitch preservation
function changePlayBackRate(video: HTMLVideoElement, rate: number): void {
  disablePitchPreservation(video);
  video.playbackRate = rate;
  disablePitchPreservation(video);
  alert("Playback rate changed to: " + rate);
}

// Handle a node added to the DOM: if it's a video, set playback rate; if it contains videos, do the same
function handleNewNode(node: Node): void {
  if (node instanceof HTMLVideoElement) {
    changePlayBackRate(node, _actualPlaybackRate);
  } else if (node instanceof Element) {
    node.querySelectorAll("video").forEach((video) => {
      changePlayBackRate(video, _actualPlaybackRate);
    });
  }
}

// Observe DOM for new video elements and apply playback changes
function initVideoObservers(): void {
  _observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(handleNewNode);
    });
  });

  // Start observing changes in the DOM
  _observer.observe(document.body, { childList: true, subtree: true });

  // Apply changes to any videos already on the page
  document.querySelectorAll("video").forEach((video) => {
    changePlayBackRate(video, _actualPlaybackRate);
  });
}

// Listen for messages from the background or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "setPitch") {
    console.log("Pitch set to: " + message.frequency);
    sendResponse({ success: true });
  }

  if (message.action === "setPlaybackRate") {
    console.log("Playback rate set to: " + message.frequency);
    _actualPlaybackRate = message.frequency / _baseFrequency;
    sendResponse({ success: true });
    initVideoObservers();
  }

  return true;
});
