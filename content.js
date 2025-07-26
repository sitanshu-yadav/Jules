if (typeof selectionBox === 'undefined') {
    let selectionBox = null;
    let startX, startY;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'selectArea') {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousedown', startSelection);
    document.addEventListener('mouseup', endSelection);
  } else if (request.action === 'compareImages') {
    compareImages(request, sendResponse);
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'processStream') {
    processStream(request, sendResponse);
    return true;
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
  selectionBox.style.zIndex = '2147483647';
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

function processStream(request, sendResponse) {
    const { streamId, selectedArea, trackFullPage } = request;
    navigator.mediaDevices.getUserMedia({
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: streamId
            }
        }
    }).then((stream) => {
        const track = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(track);
        imageCapture.grabFrame().then((imageBitmap) => {
            const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
            const context = canvas.getContext('2d');
            context.drawImage(imageBitmap, 0, 0);
            const newImageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);

            compareImages({
                newImageData: newImageData.data.buffer,
                width: newImageData.width,
                height: newImageData.height,
                selectedArea,
                trackFullPage
            }, sendResponse);
            track.stop();
        }).catch((err) => {
            console.error(err);
        });
    }).catch((err) => {
        console.error(err);
    });
}

function compareImages(request, sendResponse) {
    const { newImageData, width, height, selectedArea, trackFullPage } = request;
    const newImageDataArray = new Uint8ClampedArray(newImageData);

    if (trackFullPage) {
        chrome.storage.local.get(['fullPageImageData'], (result) => {
            const oldImageData = result.fullPageImageData ? new Uint8ClampedArray(result.fullPageImageData) : null;
            const hasChanged = oldImageData && !areImagesEqual(oldImageData, newImageDataArray);
            chrome.storage.local.set({ fullPageImageData: newImageDataArray.buffer });
            sendResponse({ hasChanged });
        });
    } else {
        const newSelectedCanvas = new OffscreenCanvas(selectedArea.rect.width, selectedArea.rect.height);
        const newSelectedContext = newSelectedCanvas.getContext('2d');
        const newCanvas = new OffscreenCanvas(width, height);
        const newContext = newCanvas.getContext('2d');
        newContext.putImageData(new ImageData(newImageDataArray, width, height), 0, 0);
        newSelectedContext.drawImage(newCanvas, selectedArea.rect.left, selectedArea.rect.top, selectedArea.rect.width, selectedArea.rect.height, 0, 0, selectedArea.rect.width, selectedArea.rect.height);
        const newSelectedImageData = newSelectedContext.getImageData(0, 0, newSelectedCanvas.width, newSelectedCanvas.height).data;

        chrome.storage.local.get(['selectedArea'], (result) => {
            const oldImageData = result.selectedArea && result.selectedArea.imageData ? new Uint8ClampedArray(result.selectedArea.imageData) : null;
            const hasChanged = oldImageData && !areImagesEqual(oldImageData, newSelectedImageData);
            chrome.storage.local.set({ selectedArea: { ...result.selectedArea, imageData: newSelectedImageData.buffer } });
            sendResponse({ hasChanged });
        });
    }
}

function areImagesEqual(image1, image2) {
    if (image1.length !== image2.length) {
        return false;
    }
    for (let i = 0; i < image1.length; i++) {
        if (image1[i] !== image2[i]) {
            return false;
        }
    }
    return true;
}
