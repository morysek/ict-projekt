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

// startup
fetchOptions();
startSSE();
