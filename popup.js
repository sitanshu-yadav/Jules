document.addEventListener('DOMContentLoaded', () => {
  const selectAreaButton = document.getElementById('select-area');
  const startTrackingButton = document.getElementById('start-tracking');
  const stopTrackingButton = document.getElementById('stop-tracking');
  const alertPhraseInput = document.getElementById('alert-phrase');
  const intervalInput = document.getElementById('interval');

  // Load saved settings
  chrome.storage.local.get(['alertPhrase', 'interval', 'isTracking'], (result) => {
    if (result.alertPhrase) {
      alertPhraseInput.value = result.alertPhrase;
    }
    if (result.interval) {
      intervalInput.value = result.interval;
    }
    if (result.isTracking) {
      startTrackingButton.disabled = true;
      stopTrackingButton.disabled = false;
      selectAreaButton.disabled = true;
    }
  });

  selectAreaButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content.js']
      }, () => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'selectArea' });
      });
    });
  });

  startTrackingButton.addEventListener('click', () => {
    const alertPhrase = alertPhraseInput.value;
    const interval = parseInt(intervalInput.value, 10);

    if (!alertPhrase) {
      alert('Please enter an alert phrase.');
      return;
    }

    if (isNaN(interval) || interval < 1) {
      alert('Please enter a valid interval in seconds.');
      return;
    }

    chrome.storage.local.set({ alertPhrase, interval, isTracking: true }, () => {
        chrome.runtime.sendMessage({ action: 'startTracking' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                // Handle the error, e.g., by alerting the user
                alert('An error occurred while starting tracking. Please make sure an area is selected.');
                chrome.storage.local.set({ isTracking: false });
            } else if (response && response.status === 'tracking started') {
                startTrackingButton.disabled = true;
                stopTrackingButton.disabled = false;
                selectAreaButton.disabled = true;
            } else {
                alert('Please select an area to track first.');
                chrome.storage.local.set({ isTracking: false });
            }
        });
    });
  });

  stopTrackingButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'stopTracking' }, (response) => {
      if (response.status === 'tracking stopped') {
        chrome.storage.local.set({ isTracking: false }, () => {
          startTrackingButton.disabled = false;
          stopTrackingButton.disabled = true;
          selectAreaButton.disabled = false;
        });
      }
    });
  });
});
