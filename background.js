let trackingIntervalId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (imageData) => {
      sendResponse({ imageData: imageData });
    });
    return true;
  } else if (request.action === 'startTracking') {
    chrome.storage.local.get(['selectedArea', 'interval', 'alertPhrase', 'trackFullPage', 'tabId', 'streamId'], (result) => {
        if ((result.selectedArea || result.trackFullPage) && result.interval && result.alertPhrase && result.tabId && result.streamId) {
            startTracking(result.selectedArea, result.interval, result.alertPhrase, result.trackFullPage, result.tabId, result.streamId);
            sendResponse({ status: 'tracking started' });
        } else {
            sendResponse({ status: 'missing data' });
        }
    });
    return true;
  } else if (request.action === 'stopTracking') {
    stopTracking();
    sendResponse({ status: 'tracking stopped' });
  }
});

function startTracking(selectedArea, interval, alertPhrase, trackFullPage, tabId, streamId) {
    if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
    }

    trackingIntervalId = setInterval(() => {
        checkForChanges(selectedArea, alertPhrase, trackFullPage, tabId, streamId);
    }, interval * 1000);
}

function stopTracking() {
    if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
        trackingIntervalId = null;
    }
}

function checkForChanges(selectedArea, alertPhrase, trackFullPage, tabId, streamId) {
    try {
        chrome.tabs.sendMessage(tabId, {
            action: 'processStream',
            streamId,
            selectedArea,
            trackFullPage
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }

            if (response && response.hasChanged) {
                chrome.tts.speak(alertPhrase);
                if (trackFullPage) {
                    chrome.storage.local.set({ fullPageImageData: response.newImageData });
                } else {
                    chrome.storage.local.set({
                        selectedArea: {
                            ...selectedArea,
                            imageData: response.newImageData
                        }
                    });
                }
            }
        });
    } catch (error) {
        console.error(error);
    }
}
