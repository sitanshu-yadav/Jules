let selectionBox = null;
let startX, startY;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'selectArea') {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousedown', startSelection);
    document.addEventListener('mouseup', endSelection);
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

      // Get the content of the selected area
      const selectedContent = getSelectedContent(absoluteRect);

      chrome.storage.local.set({
        selectedArea: {
          rect: absoluteRect,
          content: selectedContent
        }
      });
    }
  }

  function getSelectedContent(rect) {
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
