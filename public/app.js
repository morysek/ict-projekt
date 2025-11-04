// app.js
const optsContainer = document.getElementById('options');
const floating = document.getElementById('floating');
const actionBtn = document.getElementById('actionBtn');
const toast = document.getElementById('toast');

let options = [];
let selectedId = null;

function showToast(text, ms = 1800) {
  toast.textContent = text;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
  }, ms);
}

async function fetchOptions() {
  const res = await fetch('/api/options');
  const json = await res.json();
  options = json.options || [];
  renderOptions();
}

function renderOptions() {
  optsContainer.innerHTML = '';
  for (const o of options) {
    const card = document.createElement('article');
    card.className = 'card';
    if (o.id === selectedId) card.classList.add('selected');

    // image layer
    const img = document.createElement('div');
    img.className = 'img';
    img.style.backgroundImage = `url('${o.image}')`;
    card.appendChild(img);

    // meta layer
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div class="left">
        <div class="name">${escapeHtml(o.name)}</div>
        <div class="desc">${escapeHtml(o.description || '')}</div>
      </div>
      <div class="count" aria-label="count">${Number(o.count || 0).toLocaleString()}</div>
    `;
    card.appendChild(meta);

    // click to select
    card.addEventListener('click', () => {
      if (selectedId === o.id) {
        // toggle off
        selectedId = null;
        floating.classList.remove('visible');
      } else {
        selectedId = o.id;
        floating.classList.add('visible');
      }
      renderOptions();
    });

    optsContainer.appendChild(card);
  }

  // hide floating if nothing selected
  if (!selectedId) floating.classList.remove('visible');
}

// helper: escape
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

// handle action click
actionBtn.addEventListener('click', async () => {
  if (!selectedId) return;
  actionBtn.disabled = true;
  actionBtn.textContent = 'Sending…';

  try {
    const res = await fetch(`/api/options/${selectedId}/click`, { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Request failed');
    }
    const json = await res.json();
    // server broadcast will handle updating all tabs, but update locally as immediate feedback
    const updated = json.option;
    updateLocalOption(updated.id, updated.count);
    showToast('Saved ✅');
  } catch (err) {
    console.error(err);
    showToast('Failed to save');
  } finally {
    actionBtn.disabled = false;
    actionBtn.textContent = 'Confirm selection';
  }
});

function updateLocalOption(id, count) {
  const idx = options.findIndex(o => o.id === id);
  if (idx >= 0) {
    options[idx].count = count;
    renderOptions();
  }
}

// SSE to receive updates
function startSSE() {
  const es = new EventSource('/events');

  es.addEventListener('init', e => {
    try {
      const payload = JSON.parse(e.data);
      if (payload.options) {
        options = payload.options;
        renderOptions();
      }
    } catch (err) { console.error('init parse', err); }
  });

  es.addEventListener('message', e => {
    // generic message event => JSON payload
    try {
      const payload = JSON.parse(e.data);
      if (payload.type === 'update' && payload.option) {
        updateLocalOption(payload.option.id, payload.option.count);
      }
    } catch (err) { console.error('msg parse', err); }
  });

  es.onerror = (err) => {
    console.error('SSE error', err);
    es.close();
    // try reconnect after a delay
    setTimeout(startSSE, 2000);
  };
}
async function uploadStudents() {
  const fileInput = document.getElementById('studentsFile');
  const statusDiv = document.getElementById('uploadStatus');
  
  if (!fileInput.files.length) {
    statusDiv.textContent = 'Vyber soubor!';
    statusDiv.style.color = 'red';
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    const res = await fetch(`/api/admin/upload-students?secret=${adminSecret}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.ok) {
      statusDiv.textContent = data.message;
      statusDiv.style.color = 'green';
    } else {
      statusDiv.textContent = data.error || 'Chyba při nahrávání';
      statusDiv.style.color = 'red';
    }
  } catch (err) {
    statusDiv.textContent = 'Chyba: ' + err.message;
    statusDiv.style.color = 'red';
  }
}

async function uploadSeminars() {
  const fileInput = document.getElementById('seminarsFile');
  const statusDiv = document.getElementById('uploadStatus');
  
  if (!fileInput.files.length) {
    statusDiv.textContent = 'Vyber soubor!';
    statusDiv.style.color = 'red';
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    const res = await fetch(`/api/admin/upload-seminars?secret=${adminSecret}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.ok) {
      statusDiv.textContent = data.message;
      statusDiv.style.color = 'green';
      // Aktualizovat seznam seminářů
      location.reload();
    } else {
      statusDiv.textContent = data.error || 'Chyba při nahrávání';
      statusDiv.style.color = 'red';
    }
  } catch (err) {
    statusDiv.textContent = 'Chyba: ' + err.message;
    statusDiv.style.color = 'red';
  }
}
// Globální proměnná pro admin secret (už by měla existovat v kódu)
let adminSecret = '';

// Funkce pro zobrazení notifikace
function showUploadNotification(message, isSuccess) {
  const statusDiv = document.getElementById('uploadStatus');
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
  
  if (isSuccess) {
    statusDiv.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    statusDiv.style.color = 'white';
  } else {
    statusDiv.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    statusDiv.style.color = 'white';
  }
  
  // Automaticky skrýt po 5 sekundách
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

// Upload studentů
async function uploadStudents() {
  const fileInput = document.getElementById('studentsFile');
  
  if (!fileInput.files.length) {
    showUploadNotification('❌ Vyber soubor se studenty!', false);
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    showUploadNotification('⏳ Nahrávám studenty...', true);
    
    const res = await fetch(`/api/admin/upload-students?secret=${adminSecret}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.ok) {
      showUploadNotification(`✅ ${data.message}`, true);
      // Vymazat pole s nahraným souborem
      fileInput.value = '';
    } else {
      showUploadNotification(`❌ ${data.error || 'Chyba při nahrávání'}`, false);
    }
  } catch (err) {
    showUploadNotification(`❌ Chyba: ${err.message}`, false);
  }
}

// Upload seminářů
async function uploadSeminars() {
  const fileInput = document.getElementById('seminarsFile');
  
  if (!fileInput.files.length) {
    showUploadNotification('❌ Vyber soubor se semináři!', false);
    return;
  }
  
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  
  try {
    showUploadNotification('⏳ Nahrávám semináře...', true);
    
    const res = await fetch(`/api/admin/upload-seminars?secret=${adminSecret}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await res.json();
    
    if (data.ok) {
      showUploadNotification(`✅ ${data.message}`, true);
      // Vymazat pole s nahraným souborem
      fileInput.value = '';
      
      // Aktualizovat seznam seminářů na stránce
      setTimeout(() => {
        showUploadNotification('🔄 Aktualizuji seznam seminářů...', true);
        location.reload();
      }, 2000);
    } else {
      showUploadNotification(`❌ ${data.error || 'Chyba při nahrávání'}`, false);
    }
  } catch (err) {
    showUploadNotification(`❌ Chyba: ${err.message}`, false);
  }
}

// startup
fetchOptions();
startSSE();
