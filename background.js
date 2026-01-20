chrome.commands.onCommand.addListener(async (command) => {
  
  // --- SHORTCUT: STACK (Alt+Shift+C) ---
  if (command === "copy-to-shelf") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || tab.url.startsWith("chrome://")) return;

    // 1. Try Standard Selection (Fastest)
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    }, async (results) => {
      
      let text = results && results[0] ? results[0].result : "";

      // 2. If empty, check if we are on Google Docs/Slides
      if (!text && tab.url.includes("google.com")) {
        text = await handleGoogleDocsStrategy(tab.id);
      }

      // 3. Save or Warn
      if (text) {
        addToShelf(text);
        showToast(tab.id, "Saved to Shelf! 📋", "#2ed573"); // Success Green
      } else if (tab.url.includes("docs.google.com")) {
        // If we still have nothing, Docs blocked us. Tell the user.
        showToast(tab.id, "⚠️ Docs blocked auto-copy. Press Ctrl+C, then try again.", "#ff4757");
      }
    });
  }

  // --- SHORTCUT: MEGA PASTE (Alt+Shift+V) ---
  if (command === "batch-copy") {
    const result = await chrome.storage.local.get(["shelfItems"]);
    const items = result.shelfItems || [];
    if (items.length === 0) return;

    const megaText = items.map(i => i.text).join("\n\n");
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(ta);
      },
      args: [megaText]
    });
    
    showToast(tab.id, "All items copied! Press Ctrl+V to paste.", "#2ed573");
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// --- GOOGLE DOCS STRATEGIES ---
async function handleGoogleDocsStrategy(tabId) {
  try {
    // STRATEGY A: The "Accessibility Iframe" (Cleanest)
    const iframeResult = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Docs often hides text in this iframe for screen readers
        const iframe = document.querySelector('.docs-texteventtarget-iframe');
        if (iframe && iframe.contentDocument) {
            return iframe.contentDocument.getSelection().toString();
        }
        return "";
      }
    });
    
    if (iframeResult[0] && iframeResult[0].result) {
        return iframeResult[0].result;
    }

    // STRATEGY B: The "Main World" Fake Keypress (Aggressive)
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      world: 'MAIN', 
      func: () => {
        // Simulate Ctrl+C
        const keyEvent = new KeyboardEvent('keydown', {
            key: 'c', code: 'KeyC', keyCode: 67,
            ctrlKey: true, metaKey: true, bubbles: true
        });
        document.activeElement.dispatchEvent(keyEvent);
        document.execCommand('copy');
      }
    });

    // Wait for clipboard to update (Docs is slow)
    await new Promise(r => setTimeout(r, 300));

    // Read System Clipboard
    const clipResult = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async () => {
        try { return await navigator.clipboard.readText(); } catch (e) { return ""; }
      }
    });

    return clipResult[0].result;

  } catch (err) {
    console.error("Docs strategy failed", err);
    return "";
  }
}

function addToShelf(text) {
  if (!text || !text.trim()) return;
  chrome.storage.local.get(["shelfItems"], (result) => {
    const items = result.shelfItems || [];
    // Debounce: Don't add if it's identical to the top item
    if (items.length > 0 && items[0].text === text) return;

    items.unshift({ id: Date.now(), text: text, date: new Date().toLocaleTimeString() });
    if (items.length > 50) items.pop();
    chrome.storage.local.set({ shelfItems: items });
  });
}

// --- VISUAL FEEDBACK (THE TOAST) ---
function showToast(tabId, message, color) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (msg, bgColor) => {
            const div = document.createElement("div");
            div.innerText = msg;
            div.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                background-color: ${bgColor}; color: white;
                padding: 12px 24px; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                font-family: sans-serif; font-size: 14px;
                z-index: 999999; transition: opacity 0.5s;
            `;
            document.body.appendChild(div);
            setTimeout(() => {
                div.style.opacity = "0";
                setTimeout(() => document.body.removeChild(div), 500);
            }, 3000);
        },
        args: [message, color]
    });
}
