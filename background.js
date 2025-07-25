let trackingIntervalId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTracking') {
    chrome.storage.local.get(['selectedArea', 'interval', 'alertPhrase'], (result) => {
        if (result.selectedArea && result.interval && result.alertPhrase) {
            startTracking(result.selectedArea, result.interval, result.alertPhrase);
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

function startTracking(selectedArea, interval, alertPhrase) {
  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
  }

  trackingIntervalId = setInterval(() => {
    checkforChanges(selectedArea, alertPhrase);
  }, interval * 1000);
}

function stopTracking() {
  if (trackingIntervalId) {
    clearInterval(trackingIntervalId);
    trackingIntervalId = null;
  }
}

function checkforChanges(selectedArea, alertPhrase) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            return;
        }
        const tabId = tabs[0].id;
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: getPageContent,
            args: [selectedArea.rect]
        }, (injectionResults) => {
            if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                // Handle error
                return;
            }

            const newContent = injectionResults[0].result;
            if (newContent && newContent.trim() !== selectedArea.content.trim()) {
                chrome.tts.speak(alertPhrase);
                chrome.storage.local.set({
                    selectedArea: {
                        ...selectedArea,
                        content: newContent
                    }
                });
            }
        });
    });
}

function getPageContent(rect) {
    const elements = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    let content = '';
    for (const element of elements) {
      const elementRect = element.getBoundingClientRect();
      if (
        elementRect.top >= rect.top &&
        elementRect.left >= rect.left &&
        elementRect.bottom <= rect.bottom &&
        elementRect.right <= rect.right
      ) {
        content += element.innerText || '';
      }
    }
    return content.trim();
}
