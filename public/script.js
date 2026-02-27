/* ============================================================
   SCRIPT.JS — MediaDownloader Ultra Pro
   Features: Download, History, Search, Scroll Btns, Reveal
   ============================================================ */

// ---- HISTORY ----
const HISTORY_KEY = 'mdl_history';

function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}

function saveToHistory(url) {
    let hist = getHistory();
    hist = hist.filter(h => h.url !== url); // avoid duplicates
    hist.unshift({ url, time: Date.now() });
    if (hist.length > 20) hist = hist.slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

function deleteHistory(url) {
    let hist = getHistory().filter(h => h.url !== url);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
}

// ---- SEARCH / HISTORY DROPDOWN ----
let searchOpen = false;

function toggleSearch() {
    searchOpen = !searchOpen;
    const box = document.getElementById('searchBox');
    const toggle = document.getElementById('searchToggle');
    const dropdown = document.getElementById('searchDropdown');

    box.classList.toggle('open', searchOpen);
    toggle.classList.toggle('active', searchOpen);

    if (searchOpen) {
        setTimeout(() => document.getElementById('searchInput').focus(), 150);
        renderDropdown(getHistory());
        dropdown.classList.add('open');
    } else {
        dropdown.classList.remove('open');
        document.getElementById('searchInput').value = '';
    }
}

function filterHistory(query) {
    const hist = getHistory();
    const filtered = query
        ? hist.filter(h => h.url.toLowerCase().includes(query.toLowerCase()))
        : hist;
    renderDropdown(filtered);
    document.getElementById('searchDropdown').classList.add('open');
}

function renderDropdown(items) {
    const el = document.getElementById('searchDropdown');
    if (!items.length) {
        el.innerHTML = `<div class="search-dropdown-header">Search History</div><div class="history-empty">Belum ada history 🌙</div>`;
        return;
    }
    const rows = items.map(h => {
        const short = h.url.length > 38 ? h.url.slice(0, 38) + '…' : h.url;
        return `<div class="history-item" onclick="useHistory('${escHtml(h.url)}')">
            <span class="history-item-icon">🕐</span>
            <span class="history-item-url" title="${escHtml(h.url)}">${escHtml(short)}</span>
            <button class="history-item-del" onclick="event.stopPropagation();removeHistory('${escHtml(h.url)}')" title="Hapus">✕</button>
        </div>`;
    }).join('');
    el.innerHTML = `<div class="search-dropdown-header">Recent · ${items.length}</div>${rows}`;
}

function useHistory(url) {
    document.getElementById('urlInput').value = url;
    toggleSearch();
    document.getElementById('urlInput').focus();
}

function removeHistory(url) {
    deleteHistory(url);
    filterHistory(document.getElementById('searchInput').value || '');
}

function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    if (searchOpen && !document.getElementById('searchWrap').contains(e.target) && !document.getElementById('searchDropdown').contains(e.target)) {
        toggleSearch();
    }
});

// ---- PASTE FROM CLIPBOARD ----
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('urlInput').value = text;
        document.getElementById('urlInput').focus();
    } catch {
        document.getElementById('urlInput').focus();
    }
}

// ---- FETCH MEDIA ----
async function fetchMedia() {
    const input = document.getElementById('urlInput');
    const btn = document.getElementById('downloadBtn');
    const loading = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const errorCard = document.getElementById('error-msg');
    const errorText = document.getElementById('error-text');
    const url = input.value.trim();

    if (!url) {
        input.style.borderColor = 'rgba(239,68,68,0.5)';
        input.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
        input.focus();
        setTimeout(() => { input.style.borderColor = ''; input.style.boxShadow = ''; }, 2200);
        return;
    }

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Processing...';
    loading.classList.remove('hidden');
    resultDiv.innerHTML = '';
    errorCard.classList.add('hidden');

    try {
        const response = await fetch('/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        // Handle non-JSON responses gracefully
        const contentType = response.headers.get('content-type') || '';
        let json;
        if (contentType.includes('application/json')) {
            json = await response.json();
        } else {
            const text = await response.text();
            throw new Error('Server error: ' + (text.slice(0, 80) || 'Unknown error'));
        }

        if (!response.ok || !json.success) {
            throw new Error(json.error || 'Media tidak ditemukan / Link tidak valid.');
        }

        saveToHistory(url);
        renderResult(json.data);

        // Auto scroll to results smoothly
        setTimeout(() => {
            const firstResult = resultDiv.firstElementChild;
            if (firstResult) firstResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

    } catch (err) {
        errorText.textContent = err.message;
        errorCard.classList.remove('hidden');
        errorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Initiate Download';
        loading.classList.add('hidden');
    }
}

// ---- RENDER RESULTS ----
function renderResult(medias) {
    const resultDiv = document.getElementById('result');

    medias.forEach((media, index) => {
        const card = document.createElement('div');
        card.className = 'glass-card result-card';
        card.style.animationDelay = `${index * 100}ms`;

        const ext = media.extension || 'mp4';
        const filename = `RYAAKBAR_DL_${Date.now()}_${index}.${ext}`;

        let typeLabel = 'MEDIA FILE', typeIcon = '📁', mediaPreview = '';

        if (media.type === 'video') {
            typeLabel = `VIDEO · ${media.quality || 'HD'}`;
            typeIcon = '🎬';
            mediaPreview = `<div class="media-preview-wrap">
                <video controls playsinline poster="${media.thumbnail || ''}">
                    <source src="${media.url}" type="video/mp4">
                </video></div>`;
        } else if (media.type === 'image') {
            typeLabel = 'IMAGE';
            typeIcon = '🖼️';
            mediaPreview = `<div class="media-preview-wrap">
                <img src="${media.url}" alt="Media" loading="lazy">
            </div>`;
        } else if (media.type === 'audio') {
            typeLabel = 'AUDIO STREAM';
            typeIcon = '🎵';
            mediaPreview = `<div class="media-preview-wrap">
                <audio controls><source src="${media.url}" type="audio/mpeg"></audio>
            </div>`;
        }

        card.innerHTML = `
            <div class="result-header">
                <div class="result-type">
                    <div class="result-type-icon">${typeIcon}</div>
                    ${typeLabel}
                </div>
                <div class="result-badge">
                    <span style="width:5px;height:5px;background:#34d399;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
                    SUCCESS
                </div>
            </div>
            <div class="result-body">
                ${mediaPreview}
                <div class="result-meta">
                    <div class="meta-chip">FILE: <span>${filename}</span></div>
                    <div class="meta-chip">SIZE: <span>—</span></div>
                </div>
                <button class="btn-download" data-url="${media.url}" data-filename="${filename}" onclick="forceDownload('${encodeURIComponent(media.url)}', '${filename}', this)">
                    ⬇ Download File
                </button>
            </div>`;

        resultDiv.appendChild(card);
    });
}

// ---- FORCE DOWNLOAD ----
async function forceDownload(encodedUrl, filename, btnElement) {
    const url = decodeURIComponent(encodedUrl);
    const originalHTML = btnElement.innerHTML;
    btnElement.innerHTML = '⏳ Downloading...';
    btnElement.disabled = true;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network error');
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none'; a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        window.URL.revokeObjectURL(blobUrl); document.body.removeChild(a);
        btnElement.innerHTML = '✅ Complete!';
        setTimeout(() => { btnElement.innerHTML = originalHTML; btnElement.disabled = false; }, 2500);
    } catch {
        window.location.href = url;
        btnElement.innerHTML = originalHTML; btnElement.disabled = false;
    }
}

// ---- SMOOTH SCROLL ----
function smoothScrollTo(direction) {
    if (direction === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
}

// ---- SCROLL EVENTS: Scroll Buttons + Navbar + Scroll to update btn state ----
function handleScroll() {
    const scrollY = window.scrollY;
    const scrollMax = document.body.scrollHeight - window.innerHeight;

    // Scroll buttons visibility
    const btns = document.getElementById('scrollBtns');
    if (scrollMax > 100) {
        btns.classList.add('visible');
    } else {
        btns.classList.remove('visible');
    }

    // Navbar scrolled state
    const navbar = document.getElementById('navbar');
    navbar.classList.toggle('scrolled', scrollY > 30);
}

// ---- INTERSECTION OBSERVER: Fade-in Reveal ----
function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Also observe future result cards (dynamic content)
    const resultObserver = new MutationObserver(() => {
        document.querySelectorAll('.result-card:not(.reveal-watched)').forEach(el => {
            el.classList.add('reveal-watched');
            // Result cards use CSS animation, no observer needed
        });
    });
    resultObserver.observe(document.getElementById('result'), { childList: true });
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    // Keyboard: Enter = submit
    document.getElementById('urlInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') fetchMedia();
    });

    // Scroll handler
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // run once on load

    // Reveal animations
    initReveal();

    // Trigger reveals that are already in viewport
    setTimeout(() => {
        document.querySelectorAll('.reveal').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.95) {
                el.classList.add('visible');
            }
        });
    }, 100);
});
