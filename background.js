let trackingIntervalId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (imageData) => {
      sendResponse({ imageData: imageData });
    });
    return true;
  } else if (request.action === 'startTracking') {
    chrome.storage.local.get(['selectedArea', 'interval', 'alertPhrase', 'trackFullPage', 'tabId'], (result) => {
        if ((result.selectedArea || result.trackFullPage) && result.interval && result.alertPhrase && result.tabId) {
            startTracking(result.selectedArea, result.interval, result.alertPhrase, result.trackFullPage, result.tabId);
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

function startTracking(selectedArea, interval, alertPhrase, trackFullPage, tabId) {
    if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
    }

    trackingIntervalId = setInterval(() => {
        checkForChanges(selectedArea, alertPhrase, trackFullPage, tabId);
    }, interval * 1000);
}

function stopTracking() {
    if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
        trackingIntervalId = null;
    }
}

function checkForChanges(selectedArea, alertPhrase, trackFullPage, tabId) {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            stopTracking();
            return;
        }

        if (tab.active) {
            captureAndCompare(tabId, selectedArea, alertPhrase, trackFullPage);
        } else {
            chrome.tabs.update(tabId, { active: true }, () => {
                setTimeout(() => {
                    captureAndCompare(tabId, selectedArea, alertPhrase, trackFullPage, () => {
                        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                            if (activeTabs.length > 0 && activeTabs[0].id !== tabId) {
                                chrome.tabs.update(activeTabs[0].id, { active: true });
                            }
                        });
                    });
                }, 100);
            });
        }
    });
}

function captureAndCompare(tabId, selectedArea, alertPhrase, trackFullPage, callback) {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (newImageData) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            if (callback) callback();
            return;
        }
        try {
            chrome.tabs.sendMessage(tabId, {
                action: 'compareImages',
                newImageData,
                selectedArea,
                trackFullPage
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    if (callback) callback();
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
                if (callback) callback();
            });
        } catch (error) {
            console.error(error);
            if (callback) callback();
        }
    });
}
