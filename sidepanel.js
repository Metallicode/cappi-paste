updateList();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.shelfItems) updateList();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.storage.local.set({ shelfItems: [] });
});

document.getElementById('copyAllBtn').addEventListener('click', () => {
    chrome.storage.local.get(["shelfItems"], (result) => {
        const items = result.shelfItems || [];
        const megaText = items.map(i => i.text).join("\n\n");
        
        nuclearCopy(megaText);
        
        // BETTER FEEDBACK
        const btn = document.getElementById('copyAllBtn');
        const originalText = btn.innerText;
        
        // visual cue
        btn.innerText = "Ready! Press Ctrl+V";
        btn.style.background = "#333";
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#2ed573";
        }, 2000); // Show message for 2 seconds
    });
});

function updateList() {
  chrome.storage.local.get(["shelfItems"], (result) => {
    const list = document.getElementById('list');
    list.innerHTML = ''; 

    const items = result.shelfItems || [];

    if (items.length === 0) {
      list.innerHTML = '<div style="color:#aaa; text-align:center; margin-top:30px; font-size:12px">Shelf is empty.<br><br>Highlight text & press<br><b>Alt + Shift + C</b></div>';
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('draggable', 'true');
      
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.text);
        e.dataTransfer.effectAllowed = "copy";
        card.style.opacity = '0.5';
      });
      
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });

      card.innerHTML = `
        <div class="card-text">${escapeHtml(item.text)}</div>
        <div class="card-meta">
          <span>${item.date}</span>
          <span class="delete-btn" data-index="${index}">✖</span>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return; 
        nuclearCopy(item.text); // Use Nuclear Copy
        card.style.backgroundColor = "#d1ccc0";
        setTimeout(() => card.style.backgroundColor = "white", 200);
      });

      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation(); 
        items.splice(index, 1);
        chrome.storage.local.set({ shelfItems: items });
      });

      list.appendChild(card);
    });
  });
}

// --- THE NUCLEAR COPY FUNCTION ---
function nuclearCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        console.log("Copied to clipboard via fallback");
    } catch (err) {
        console.error("Copy failed", err);
    }
    document.body.removeChild(ta);
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
