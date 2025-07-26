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
    chrome.desktopCapture.chooseDesktopMedia(['tab'], (streamId) => {
        if (streamId) {
            const mediaStream = new MediaStream([
                new MediaStreamTrackGenerator({ kind: 'video' }),
            ]);
            const video = document.createElement('video');
            video.srcObject = mediaStream;
            video.onloadedmetadata = () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext('2d');
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const newImageData = canvas.toDataURL();

                try {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'compareImages',
                        newImageData,
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
            };
        }
    });
}
