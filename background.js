// 1. Listen for Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  
  // --- SHORTCUT: STACK (Alt+Shift+C) ---
  if (command === "copy-to-shelf") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: getSelectionText
    }, (results) => {
      if (results && results[0] && results[0].result) {
        addToShelf(results[0].result);
      }
    });
  }

  // --- SHORTCUT: MEGA COPY (Alt+Shift+V) ---
  if (command === "batch-copy") {
    const result = await chrome.storage.local.get(["shelfItems"]);
    const items = result.shelfItems || [];
    
    if (items.length === 0) return;

    const megaText = items.map(i => i.text).join("\n\n");
    
    // Inject the "Nuclear" Copy Function
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => {
        // 1. Create hidden input
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        
        // 2. Select it
        ta.select();
        ta.setSelectionRange(0, 99999); // Mobile fallback
        
        // 3. FORCE COPY
        try {
          document.execCommand('copy');
          console.log("Nuclear copy success!");
        } catch (err) {
          console.error("Nuclear copy failed", err);
        }
        
        // 4. Cleanup
        document.body.removeChild(ta);
      },
      args: [megaText]
    });
  }
});

// Helper: Open Side Panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

function getSelectionText() {
  return window.getSelection().toString();
}

function addToShelf(text) {
  if (!text.trim()) return;
  chrome.storage.local.get(["shelfItems"], (result) => {
    const items = result.shelfItems || [];
    items.unshift({ id: Date.now(), text: text, date: new Date().toLocaleTimeString() });
    if (items.length > 50) items.pop();
    chrome.storage.local.set({ shelfItems: items });
  });
}
