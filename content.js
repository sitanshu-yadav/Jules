let selectionBox = null;
let startX, startY;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'selectArea') {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousedown', startSelection);
    document.addEventListener('mouseup', endSelection);
  } else if (request.action === 'compareImages') {
    compareImages(request, sendResponse);
    return true; // Indicates that the response is sent asynchronously
  }
});

function startSelection(e) {
  e.preventDefault();
  startX = e.clientX;
  startY = e.clientY;

  selectionBox = document.createElement('div');
  selectionBox.style.position = 'fixed';
  selectionBox.style.border = '2px dashed #00f';
  selectionBox.style.backgroundColor = 'rgba(0, 0, 255, 0.1)';
  selectionBox.style.zIndex = '999999';
  selectionBox.style.left = startX + 'px';
  selectionBox.style.top = startY + 'px';

  document.body.appendChild(selectionBox);
  document.addEventListener('mousemove', dragSelection);
}

function dragSelection(e) {
  if (!selectionBox) return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const width = currentX - startX;
  const height = currentY - startY;

  selectionBox.style.width = Math.abs(width) + 'px';
  selectionBox.style.height = Math.abs(height) + 'px';
  selectionBox.style.left = (width > 0 ? startX : currentX) + 'px';
  selectionBox.style.top = (height > 0 ? startY : currentY) + 'px';
}

function endSelection(e) {
    document.body.style.cursor = 'default';
    document.removeEventListener('mousedown', startSelection);
    document.removeEventListener('mousemove', dragSelection);
    document.removeEventListener('mouseup', endSelection);

    if (selectionBox) {
        const rect = selectionBox.getBoundingClientRect();
        document.body.removeChild(selectionBox);
        selectionBox = null;

        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        const absoluteRect = {
            top: rect.top + scrollY,
            left: rect.left + scrollX,
            width: rect.width,
            height: rect.height,
            right: rect.right + scrollX,
            bottom: rect.bottom + scrollY
        };

        chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (response) => {
            if (response.imageData) {
                const image = new Image();
                image.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = absoluteRect.width;
                    canvas.height = absoluteRect.height;
                    const context = canvas.getContext('2d');
                    context.drawImage(image, absoluteRect.left, absoluteRect.top, absoluteRect.width, absoluteRect.height, 0, 0, absoluteRect.width, absoluteRect.height);
                    const selectedImageData = canvas.toDataURL();
                    chrome.storage.local.set({
                        selectedArea: {
                            rect: absoluteRect,
                            imageData: selectedImageData
                        }
                    });
                };
                image.src = response.imageData;
            }
        });
    }
}

function compareImages(request, sendResponse) {
    const { newImageData, selectedArea, trackFullPage } = request;

    if (trackFullPage) {
        chrome.storage.local.get(['fullPageImageData'], (result) => {
            const hasChanged = result.fullPageImageData && result.fullPageImageData !== newImageData;
            chrome.storage.local.set({ fullPageImageData: newImageData });
            sendResponse({ hasChanged, newImageData });
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

            const hasChanged = selectedArea.imageData && selectedArea.imageData !== newSelectedImageData;
            sendResponse({ hasChanged, newImageData: newSelectedImageData });
        };
        image.src = newImageData;
    }
}
