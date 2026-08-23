const Client = (() => {
  let state = { url: '', key: '', token: '', user: null, categories: [], view: { cat: null, topic: null } };

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
  function loading(show, text) {
    document.getElementById('loading').classList.toggle('hidden', !show);
    if (text) document.getElementById('loadingText').textContent = text;
  }
  function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json', 'X-Access-Key': state.key }, opts.headers || {});
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch(state.url + '/api/' + path, Object.assign({}, opts, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'خطای ناشناخته');
    return data;
  }

  function showScreen(name) {
    ['connect', 'login', 'main'].forEach(s => document.getElementById('screen-' + s).classList.toggle('hidden', s !== name));
  }

  function saveConnection() {
    const raw = document.getElementById('connectionCodeInput').value.trim();
    try {
      const decoded = JSON.parse(atob(raw));
      if (!decoded.url || !decoded.key) throw new Error();
      state.url = decoded.url; state.key = decoded.key;
      localStorage.setItem('conn_url', state.url);
      localStorage.setItem('conn_key', state.key);
      document.getElementById('connectError').textContent = '';
      showScreen('login');
    } catch (e) { document.getElementById('connectError').textContent = 'کد اتصال نامعتبر است.'; }
  }
  function resetConnection() {
    localStorage.clear();
    state = { url: '', key: '', token: '', user: null, categories: [], view: { cat: null, topic: null } };
    showScreen('connect');
  }

  async function login() {
    const personnel_code = document.getElementById('loginPersonnel').value.trim();
    const national_code = document.getElementById('loginNational').value.trim();
    const errEl = document.getElementById('loginError'); errEl.textContent = '';
    loading(true, 'در حال ورود…');
    try {
      const data = await api('login.php', { method: 'POST', body: JSON.stringify({ personnel_code, national_code }) });
      state.token = data.token; state.user = data.user;
      localStorage.setItem('session_token', state.token);
      await enterApp();
    } catch (e) { errEl.textContent = e.message; } finally { loading(false); }
  }
  function logout() {
    localStorage.removeItem('session_token');
    state.token = ''; state.user = null;
    showScreen('login');
  }
  function toggleTheme() {
    const root = document.getElementById('htmlRoot');
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  async function enterApp() {
    showScreen('main');
    try {
      const s = await api('settings.php');
      const name = s.settings.app_name || 'اپ کاربر';
      document.getElementById('mainBrand').textContent = name;
      document.title = name;
    } catch (e) {}
    const data = await api('categories.php');
    state.categories = data.categories;
    state.view = { cat: null, topic: null };
    renderHome();
  }

  // ---------------- خانه: دسته‌بندی‌ها + جست‌وجو ----------------
  function renderHome() {
    const el = document.getElementById('mainContent');
    el.innerHTML = `
      <div style="position:relative;margin-bottom:16px">
        <input type="text" id="searchInput" placeholder="جست‌وجو در مطالبی که به آن‌ها دسترسی دارید…" onkeyup="if(event.key==='Enter')Client.search()">
        <button class="btn secondary" style="margin-top:8px;width:100%" onclick="Client.search()">جست‌وجو</button>
      </div>
      <div id="homeBody"></div>`;
    if (!state.categories.length) {
      document.getElementById('homeBody').innerHTML = '<div class="note">دسترسی به هیچ دسته‌بندی‌ای برای شما تعریف نشده است.</div>';
      return;
    }
    document.getElementById('homeBody').innerHTML =
      '<div class="note" style="font-weight:700;color:var(--ink)">دسته‌بندی‌های در دسترس شما</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">' +
      state.categories.map(c => `
        <button class="card" style="text-align:right;cursor:pointer;margin-bottom:0" onclick="Client.openCategory(${c.id})">
          <div style="font-weight:700;font-size:13.5px">${escapeHtml(c.name)}</div>
        </button>`).join('') + '</div>';
  }

  async function openCategory(id) {
    loading(true);
    try {
      const data = await api('topics.php?category_id=' + id);
      const cat = state.categories.find(c => c.id === id);
      renderTopicList(data.topics, cat ? cat.name : '', () => renderHome());
    } catch (e) { toast(e.message); } finally { loading(false); }
  }

  async function search() {
    const q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    loading(true);
    try {
      const data = await api('topics.php?q=' + encodeURIComponent(q));
      renderTopicList(data.topics, 'نتایج جست‌وجو برای «' + q + '»', () => renderHome());
    } catch (e) { toast(e.message); } finally { loading(false); }
  }

  function renderTopicList(topics, title, onBack) {
    const el = document.getElementById('mainContent');
    el.innerHTML = `
      <button class="btn secondary" style="padding:6px 12px;font-size:12px;margin-bottom:12px" id="backBtn">← بازگشت</button>
      <div class="note" style="font-weight:700;color:var(--ink)">${escapeHtml(title)}</div>
      <div id="listBody" style="margin-top:8px"></div>`;
    document.getElementById('backBtn').onclick = onBack;
    document.getElementById('listBody').innerHTML = topics.length
      ? topics.map(t => `
        <button class="card" style="text-align:right;cursor:pointer;width:100%" onclick="Client.openTopic(${t.id})">
          <div style="font-weight:700;font-size:13.5px">${escapeHtml(t.title)}</div>
          <div class="note" style="margin:4px 0 0;-webkit-line-clamp:2;overflow:hidden">${escapeHtml(t.summary || '')}</div>
        </button>`).join('')
      : '<div class="note">موردی یافت نشد.</div>';
  }

  async function openTopic(id) {
    loading(true, 'در حال بارگذاری مطلب…');
    try {
      const data = await api('topics.php?id=' + id);
      renderTopicDetail(data.topic);
    } catch (e) { toast(e.message); } finally { loading(false); }
  }

  function renderTopicDetail(t) {
    const el = document.getElementById('mainContent');
    el.innerHTML = `
      <button class="btn secondary" style="padding:6px 12px;font-size:12px;margin-bottom:12px" onclick="Client.goHomeFresh()">← بازگشت به فهرست</button>
      <h1>${escapeHtml(t.title)}</h1>
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <span class="pill active" id="pill-summary" onclick="Client.setMode('summary')">خلاصه</span>
        <span class="pill" id="pill-full" onclick="Client.setMode('full')">متن کامل</span>
      </div>
      <div class="card" id="topicBody" style="white-space:pre-wrap;line-height:2;font-size:14px"></div>
      <div id="attachmentsBox" style="margin-top:16px"></div>`;
    state.view.topic = t; state.view.mode = 'summary';
    updateTopicBody();

    if (t.attachments && t.attachments.length) {
      const box = document.getElementById('attachmentsBox');
      box.innerHTML = '<div class="note" style="font-weight:700;color:var(--ink)">پیوست‌ها (فقط مشاهده)</div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px" id="attachRow"></div>';
      const row = document.getElementById('attachRow');
      t.attachments.forEach(a => {
        const url = state.url + '/' + a.file_path;
        if (a.type === 'image') {
          const b = document.createElement('button');
          b.className = 'card'; b.style.cssText = 'padding:0;width:84px;height:84px;overflow:hidden;margin:0;cursor:pointer';
          b.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
          b.onclick = () => openLightbox(url);
          row.appendChild(b);
        } else {
          const link = document.createElement('a');
          link.href = url; link.target = '_blank'; link.className = 'card';
          link.style.cssText = 'width:84px;height:84px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;margin:0';
          link.textContent = '📄 ' + a.file_name;
          row.appendChild(link);
        }
      });
    }
  }
  function setMode(mode) {
    state.view.mode = mode;
    document.getElementById('pill-summary').classList.toggle('active', mode === 'summary');
    document.getElementById('pill-full').classList.toggle('active', mode === 'full');
    updateTopicBody();
  }
  function updateTopicBody() {
    const t = state.view.topic;
    document.getElementById('topicBody').textContent = state.view.mode === 'full' ? t.content : t.summary;
  }
  function openLightbox(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightbox').classList.remove('hidden');
  }
  function closeLightbox() { document.getElementById('lightbox').classList.add('hidden'); }
  function goHomeFresh() { renderHome(); }

  async function init() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) document.getElementById('htmlRoot').setAttribute('data-theme', savedTheme);

    state.url = localStorage.getItem('conn_url') || '';
    state.key = localStorage.getItem('conn_key') || '';
    state.token = localStorage.getItem('session_token') || '';

    if (!state.url || !state.key) { showScreen('connect'); return; }

    if (state.token) {
      loading(true, 'در حال اتصال…');
      try { await enterApp(); }
      catch (e) { localStorage.removeItem('session_token'); showScreen('login'); }
      finally { loading(false); }
    } else {
      showScreen('login');
    }
  }

  return { init, saveConnection, resetConnection, login, logout, toggleTheme,
    openCategory, search, openTopic, setMode, closeLightbox, goHomeFresh };
})();

window.addEventListener('DOMContentLoaded', Client.init);
