updateList();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.shelfItems) updateList();
});

// --- UI BUTTONS ---
document.getElementById('clearBtn').addEventListener('click', () => {
  if(confirm("Clear all items?")) {
    chrome.storage.local.set({ shelfItems: [] });
  }
});

document.getElementById('copyAllBtn').addEventListener('click', () => {
    chrome.storage.local.get(["shelfItems"], (result) => {
        const items = result.shelfItems || [];
        const megaText = items.map(i => i.text).join("\n\n");
        nuclearCopy(megaText);
        
        const btn = document.getElementById('copyAllBtn');
        const originalText = btn.innerText;
        btn.innerText = "Ready! Press Ctrl+V";
        btn.style.background = "#333";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#2ed573";
        }, 2000);
    });
});

// --- LIST RENDERER WITH SORTING ---
function updateList() {
  chrome.storage.local.get(["shelfItems"], (result) => {
    const list = document.getElementById('list');
    list.innerHTML = ''; 

    let items = result.shelfItems || [];

    if (items.length === 0) {
      list.innerHTML = '<div style="color:#aaa; text-align:center; margin-top:30px; font-size:12px">Shelf is empty.<br><br>Highlight text & press<br><b>Alt + Shift + C</b></div>';
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('draggable', 'true');
      
      // 1. DRAG START
      card.addEventListener('dragstart', (e) => {
        // A. Payload for External Apps (Word, Docs)
        e.dataTransfer.setData('text/plain', item.text);
        
        // B. Payload for Internal Sorting (The Index)
        e.dataTransfer.setData('application/cappi-index', index);
        
        e.dataTransfer.effectAllowed = "copyMove";
        card.style.opacity = '0.4';
      });
      
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });

      // 2. DRAG OVER (Allow Dropping)
      card.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping
        card.style.borderTop = "2px solid #2ed573"; // Visual guide
      });

      card.addEventListener('dragleave', () => {
        card.style.borderTop = "none";
      });

      // 3. DROP (Handle Sort)
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.style.borderTop = "none";

        const fromIndex = e.dataTransfer.getData('application/cappi-index');
        
        // If "fromIndex" exists, it's an internal sort!
        if (fromIndex !== "") {
          const oldIndex = parseInt(fromIndex);
          const newIndex = index;

          if (oldIndex !== newIndex) {
            // Reorder Array
            const movedItem = items.splice(oldIndex, 1)[0];
            items.splice(newIndex, 0, movedItem);
            
            // Save new order
            chrome.storage.local.set({ shelfItems: items });
          }
        }
      });

      // --- CARD HTML CONTENT ---
card.innerHTML = `
        <div class="card-text">${escapeHtml(item.text)}</div>
        <div class="card-meta">
          <span>${item.date}</span>
          <span class="delete-btn" data-index="${index}" title="Delete">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </span>
        </div>
      `;

      // Copy Single Item
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return; 
        nuclearCopy(item.text); 
        card.style.backgroundColor = "#d1ccc0";
        setTimeout(() => card.style.backgroundColor = "white", 200);
      });

      // Delete Single Item
      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation(); 
        items.splice(index, 1);
        chrome.storage.local.set({ shelfItems: items });
      });

      list.appendChild(card);
    });
  });
}

function nuclearCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(ta);
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
