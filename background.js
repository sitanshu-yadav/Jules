let trackingIntervalId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startTracking') {
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
        if (tab.status === 'complete') {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: getPageContent,
                args: [selectedArea ? selectedArea.rect : null, trackFullPage]
            }, (injectionResults) => {
                if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
                    // Handle error
                    return;
                }

                const newContent = injectionResults[0].result;
                if (trackFullPage) {
                    chrome.storage.local.get(['fullPageContent'], (result) => {
                        if (result.fullPageContent && result.fullPageContent !== newContent) {
                            chrome.tts.speak(alertPhrase);
                        }
                        chrome.storage.local.set({ fullPageContent: newContent });
                    });
                } else {
                    if (selectedArea && newContent.trim() !== selectedArea.content.trim()) {
                        chrome.tts.speak(alertPhrase);
                        chrome.storage.local.set({
                            selectedArea: {
                                ...selectedArea,
                                content: newContent
                            }
                        });
                    }
                }
            });
        }
    });
}

function getPageContent(rect, trackFullPage) {
    if (trackFullPage) {
        return document.body.innerText;
    }

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
