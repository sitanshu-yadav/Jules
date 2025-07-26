let trackingIntervalId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (imageData) => {
      sendResponse({ imageData: imageData });
    });
    return true;
  } else if (request.action === 'startTracking') {
    chrome.storage.local.get(['selectedArea', 'interval', 'alertPhrase', 'trackFullPage'], (result) => {
        if ((result.selectedArea || result.trackFullPage) && result.interval && result.alertPhrase) {
            startTracking(result.selectedArea, result.interval, result.alertPhrase, result.trackFullPage);
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

function startTracking(selectedArea, interval, alertPhrase, trackFullPage) {
    if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
    }

    trackingIntervalId = setInterval(() => {
        checkForChanges(selectedArea, alertPhrase, trackFullPage);
    }, interval * 1000);
}

function stopTracking() {
    if (trackingIntervalId) {
        clearInterval(trackingIntervalId);
        trackingIntervalId = null;
    }
}

function checkForChanges(selectedArea, alertPhrase, trackFullPage) {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (newImageData) => {
        if (trackFullPage) {
            chrome.storage.local.get(['fullPageImageData'], (result) => {
                if (result.fullPageImageData && result.fullPageImageData !== newImageData) {
                    chrome.tts.speak(alertPhrase);
                }
                chrome.storage.local.set({ fullPageImageData: newImageData });
            });
        } else {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = selectedArea.rect.width;
                canvas.height = selectedArea.rect.height;
                const context = canvas.getContext('2d');
                context.drawImage(image, selectedArea.rect.left, selectedArea.rect.top, selectedArea.rect.width, selectedArea.rect.height, 0, 0, selectedArea.rect.width, selectedArea.rect.height);
                const newSelectedImageData = canvas.toDataURL();

                if (selectedArea.imageData && selectedArea.imageData !== newSelectedImageData) {
                    chrome.tts.speak(alertPhrase);
                }
                chrome.storage.local.set({
                    selectedArea: {
                        ...selectedArea,
                        imageData: newSelectedImageData
                    }
                });
            };
            image.src = newImageData;
        }
    });
}
