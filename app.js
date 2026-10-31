const GIST_FILENAME = "pkt.json";

let appData = {
  updated_at: 0,
  last_sync_display: "--:--",
  tab_order: [],
  cfl_categories: [],
  ui_labels: {
    tabs: {}
  }
};

function _k(i) {
  const t = (appData && Array.isArray(appData.tab_order) && appData.tab_order.length > 0)
    ? appData.tab_order
    : Object.keys(appData.ui_labels?.tabs || {});
  return t[i] || "";
}

function _l(i) {
  const k = _k(i);
  return (appData.ui_labels && k) ? (appData.ui_labels[k] || {}) : {};
}

function _arr(i) {
  const k = _k(i);
  if (!k) return [];
  if (!Array.isArray(appData[k])) appData[k] = [];
  return appData[k];
}

let activeTabCode = "";
let taskFilter = "all";
let shopFilter = "all";
let selectedMoodCd = "5";
let pendingShopItem = null;
let saveTimeout = null;
let isUnlocked = false;

function updateClock() {
  const now = new Date();
  const hrs = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");

  const elHrs = document.getElementById("clock-hours");
  const elMins = document.getElementById("clock-minutes");
  const elDate = document.getElementById("clock-date");

  if (elHrs) elHrs.textContent = hrs;
  if (elMins) elMins.textContent = mins;

  if (elDate) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    elDate.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
}

function handleSecretEntry() {
  const key = localStorage.getItem("key");
  const pat = localStorage.getItem("pat");
  const gistId = localStorage.getItem("id");

  if (!key || !pat || !gistId) {
    openSettingsModal();
  } else {
    unlockApp();
  }
}

function unlockApp() {
  isUnlocked = true;
  const disguise = document.getElementById("disguise-view");
  const shell = document.getElementById("app-shell");

  if (disguise) disguise.classList.add("hidden");
  if (shell) shell.classList.remove("locked");

  initAndFetchData();
}

let inactivityTimer;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (isUnlocked) {
      lockApp();
    }
  }, 5 * 60 * 1000);
}

function lockApp() {
  isUnlocked = false;
  const disguise = document.getElementById("disguise-view");
  const shell = document.getElementById("app-shell");

  if (disguise) disguise.classList.remove("hidden");
  if (shell) shell.classList.add("locked");

  appData = {
    updated_at: 0,
    last_sync_display: "--:--",
    tab_order: [],
    cfl_categories: [],
    ui_labels: { tabs: {} }
  };
  const container = document.getElementById("dyn-content-area");
  if (container) container.innerHTML = "";
  localStorage.removeItem("data");
}

async function initAndFetchData() {
  localStorage.removeItem("data");

  const pat = localStorage.getItem("pat");
  const gistId = localStorage.getItem("id");

  if (pat && gistId) {
    await syncWithGistNow();
  }
}

function persistLocalData() {
  appData.updated_at = Math.floor(Date.now() / 1000);
  
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = n => String(n).padStart(2, "0");
  appData.last_sync_display = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} · ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  updateHeaderSyncBadge();
  triggerGistSyncDebounced();
}

function fmtRupiah(num) {
  if (!num && num !== 0) return "Rp 0";
  return "Rp " + Number(num).toLocaleString("id-ID");
}

function parseCleanNumber(val) {
  return Number(String(val).replace(/\D/g, "")) || 0;
}

function formatShortDate(dStr) {
  if (!dStr) return "";
  const parts = dStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dStr;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderDynamicUI() {
  const labels = appData.ui_labels || {};
  if (!labels.tabs) return;

  updateHeaderSyncBadge();
  renderBottomNav(labels.tabs);
  injectModalLabels(labels);
  renderContentArea();
}

function updateHeaderSyncBadge() {
  const elLastSync = document.getElementById("dyn-last-sync");
  const elDot = document.getElementById("sync-dot");
  if (elLastSync) {
    elLastSync.textContent = appData.last_sync_display || "--:--";
  }
  if (elDot) {
    elDot.className = "sync-dot";
  }
}

function renderBottomNav(tabs) {
  const navContainer = document.getElementById("dyn-bottom-nav");
  if (!navContainer) return;

  const tabKeys = (appData && Array.isArray(appData.tab_order) && appData.tab_order.length > 0)
    ? appData.tab_order
    : Object.keys(tabs || {});

  if (tabKeys.length > 0 && (!activeTabCode || !tabKeys.includes(activeTabCode))) {
    activeTabCode = tabKeys[0];
  }

  const icons = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
  ];
  const defIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>';

  navContainer.innerHTML = tabKeys.map((k, i) => `
    <button class="nav-item ${activeTabCode === k ? 'active' : ''}" id="nav-${k}" onclick="switchTab('${k}')" aria-label="${tabs[k] || k}">
      ${icons[i] || defIcon}
    </button>
  `).join("");
}

function injectModalLabels(labels) {
  const m = labels.modals || {};
  const s = _l(0);
  const term = labels.terminal || {};

  setTxt("btn-cancel-price", "Cancel");
  setTxt("btn-submit-price", "Save");

  setTxt("dyn-term-title", "");
  setTxt("dyn-term-desc", "");
  setTxt("btn-cancel-terminal", "Cancel");
  setTxt("btn-submit-terminal", "Save");

  setTxt("dyn-add-shop-title", "");
  setTxt("dyn-add-shop-desc", "");
  setTxt("dyn-add-shop-name-label", m.add_shop_name_label || "Item Name");
  setPh("new-shop-name", "");
  setTxt("dyn-add-shop-ctgr-label", m.add_shop_ctgr_label || "Category");
  setTxt("dyn-add-shop-amt-label", m.add_shop_amt_label || "Amount");
  setPh("new-shop-amt", "");
  setTxt("dyn-add-shop-date-label", m.add_shop_date_label || "Date");
  setTxt("dyn-add-shop-rmk-label", m.add_shop_rmk_label || "Note");
  setPh("new-shop-rmk", "");
  setTxt("btn-cancel-add-shop", "Cancel");
  setTxt("btn-submit-add-shop", "Save");

  setTxt("dyn-add-task-title", m.add_task_title || "New Task");
  setTxt("dyn-add-task-desc", m.add_task_desc || "");
  setTxt("dyn-add-task-name-label", m.add_task_name_label || "Task Description");
  setPh("new-task-title", m.add_task_name_ph || "");
  setTxt("dyn-add-task-date-label", m.add_task_date_label || "Target Date (Optional)");
  setTxt("btn-cancel-add-task", "Cancel");
  setTxt("btn-submit-add-task", "Save");

  setTxt("btn-cancel-settings", "Cancel");
  setTxt("btn-submit-settings", "Save");

  const ctgrSelect = document.getElementById("new-shop-ctgr");
  if (ctgrSelect && appData.cfl_categories) {
    ctgrSelect.innerHTML = appData.cfl_categories.map(c => `
      <option value="${c.cd}">${c.cd} - ${c.nm}</option>
    `).join("");
  }
}

function setTxt(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function setPh(id, ph) {
  const el = document.getElementById(id);
  if (el) el.placeholder = ph;
}

function setModalLock(locked) {
  const area = document.getElementById("dyn-content-area");
  if (locked) {
    if (area) area.classList.add("modal-open");
    document.body.classList.add("modal-open");
  } else {
    const anyOpen = document.querySelectorAll(".modal-overlay.open").length > 0;
    if (!anyOpen) {
      if (area) area.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
    }
  }
}

function switchTab(tabId) {
  activeTabCode = tabId;
  document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
  const activeBtn = document.getElementById("nav-" + tabId);
  if (activeBtn) activeBtn.classList.add("active");
  renderContentArea();
}

function renderContentArea() {
  const container = document.getElementById("dyn-content-area");
  if (!container) return;

  const tabKeys = (appData && Array.isArray(appData.tab_order) && appData.tab_order.length > 0)
    ? appData.tab_order
    : Object.keys(appData.ui_labels?.tabs || {});

  const idx = tabKeys.indexOf(activeTabCode);
  const _v = [_v0, _v1, _v2, _v3];
  container.innerHTML = _v[idx] ? _v[idx](_l(idx)) : "";
}

function _v0(sLabels) {
  const items = _arr(0);

  const filtered = items.filter(it => {
    if (shopFilter === "pending") return !it.is_bought;
    if (shopFilter === "bought") return it.is_bought;
    return true;
  });

  return `
    <div class="compact-top-bar">
      <div class="filter-pills" id="shop-pills">
        <button class="pill-btn ${shopFilter === 'all' ? 'active' : ''}" onclick="setShopFilter('all')">${escapeHtml(sLabels.filter_all || 'All')}</button>
        <button class="pill-btn ${shopFilter === 'pending' ? 'active' : ''}" onclick="setShopFilter('pending')">${escapeHtml(sLabels.filter_pending || 'Pending')}</button>
        <button class="pill-btn ${shopFilter === 'bought' ? 'active' : ''}" onclick="setShopFilter('bought')">${escapeHtml(sLabels.filter_bought || 'Completed')}</button>
      </div>
      <div class="header-action-btns">
        <button class="btn-icon-action terminal" onclick="openTerminalModal()" title="Terminal" aria-label="Terminal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
        </button>
        <button class="btn-icon-action primary" onclick="openAddShopModal()" title="Add" aria-label="Add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>

    <div class="compact-list">
      ${filtered.length === 0 ? `<div class="empty-state"><p>--</p></div>` : filtered.map(it => `
        <div class="compact-card ${it.is_bought ? 'completed' : ''}">
          <button class="custom-check-btn ${it.is_bought ? 'checked' : ''}" onclick="onShopCheckClicked('${it.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <div class="card-main-info" onclick="onShopCheckClicked('${it.id}')">
            <div class="card-title-row">
              <span class="card-title">${escapeHtml(it.item_nm)}</span>
              ${it.rmk ? `<span class="meta-chip">${escapeHtml(it.rmk)}</span>` : ''}
            </div>
          </div>
          ${it.is_bought && it.actual_amt > 0 ? `
            <div class="card-price-badge">
              <div class="actual-price">${fmtRupiah(it.actual_amt)}</div>
            </div>
          ` : ''}
        </div>
      `).join("")}
    </div>
  `;
}

function setShopFilter(type) {
  shopFilter = type;
  renderContentArea();
}

function onShopCheckClicked(id) {
  const item = _arr(0).find(x => x.id === id);
  if (!item) return;

  if (item.is_bought) {
    item.is_bought = false;
    item.actual_amt = 0;
    item.bought_at = null;
    persistLocalData();
    renderContentArea();
    showToast("Done");
  } else {
    pendingShopItem = item;
    openPriceModal(item);
  }
}

function formatNumberToIdr(val) {
  if (!val && val !== 0) return "";
  const num = typeof val === "number" ? val : parseCleanNumber(val);
  if (!num && num !== 0) return "";
  return num.toLocaleString("id-ID");
}

function onPriceModalInput(input) {
  const cur = parseCleanNumber(input.value);
  input.value = cur > 0 ? formatNumberToIdr(cur) : "";
}

function onShopAmtInput(input) {
  const cur = parseCleanNumber(input.value);
  input.value = cur > 0 ? formatNumberToIdr(cur) : "";
}

function openPriceModal(item) {
  const modal = document.getElementById("price-modal");
  document.getElementById("modal-item-name").textContent = item.item_nm;
  
  const input = document.getElementById("modal-price-input");
  const rawAmt = item.actual_amt > 0 ? item.actual_amt : (item.est_amt > 0 ? item.est_amt : 0);
  input.value = rawAmt > 0 ? formatNumberToIdr(rawAmt) : "";
  
  modal.classList.add("open");
  setModalLock(true);
  input.focus();
  input.select();
}

function closePriceModal() {
  document.getElementById("price-modal").classList.remove("open");
  setModalLock(false);
  pendingShopItem = null;
}

function submitPriceModal() {
  if (!pendingShopItem) return;
  const input = document.getElementById("modal-price-input");
  const actualAmt = parseCleanNumber(input.value);

  pendingShopItem.is_bought = true;
  pendingShopItem.actual_amt = actualAmt > 0 ? actualAmt : pendingShopItem.est_amt;
  pendingShopItem.bought_at = new Date().toISOString();

  persistLocalData();
  renderContentArea();
  closePriceModal();
  showToast(`Recorded: ${fmtRupiah(pendingShopItem.actual_amt)}`);
}

function adjustPriceInput(delta) {
  const input = document.getElementById("modal-price-input");
  const cur = parseCleanNumber(input.value);
  const next = Math.max(0, cur + delta);
  input.value = next > 0 ? formatNumberToIdr(next) : "";
}

function openTerminalModal() {
  const modal = document.getElementById("terminal-modal");
  const textarea = document.getElementById("terminal-raw-input");

  modal.classList.add("open");
  setModalLock(true);
  handleTerminalInputLive();
  textarea.focus();
}

function closeTerminalModal() {
  document.getElementById("terminal-modal").classList.remove("open");
  setModalLock(false);
}

function parseTerminalCommandLines(rawText) {
  if (!rawText) return [];
  const lines = rawText.split("\n");
  const parsed = [];

  const todayDate = new Date().toISOString().split("T")[0];
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayDate = yest.toISOString().split("T")[0];
  let currentDateContext = todayDate;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return;

    const lowerLine = trimmed.toLowerCase().replace(/:$/, "");

    if (lowerLine === "kemarin" || lowerLine === "yesterday") {
      currentDateContext = yesterdayDate;
      return;
    } else if (lowerLine === "hari ini" || lowerLine === "today") {
      currentDateContext = todayDate;
      return;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(lowerLine)) {
      currentDateContext = lowerLine;
      return;
    }

    const firstColonIdx = trimmed.indexOf(":");
    if (firstColonIdx === -1) {
      parsed.push({
        id: "err-" + idx,
        item_nm: trimmed,
        isValid: false,
        raw: trimmed
      });
      return;
    }

    const ctgrCd = trimmed.slice(0, firstColonIdx).trim();
    const itemsRaw = trimmed.slice(firstColonIdx + 1).trim();

    const items = itemsRaw.split(",");
    items.forEach((itemStr, subIdx) => {
      const parts = itemStr.split(":").map(p => p.trim());
      const itemNm = parts[0] || "";
      const amtStr = parts[1] || "0";
      const rmk = parts[2] || "";
      const cleanAmt = parseCleanNumber(amtStr);

      if (itemNm) {
        const isDone = cleanAmt > 0;
        parsed.push({
          id: "shp-term-" + Date.now() + "-" + idx + "-" + subIdx,
          ctgr_cd: ctgrCd,
          item_nm: itemNm,
          est_amt: 0,
          actual_amt: cleanAmt,
          is_bought: isDone,
          bought_at: isDone ? currentDateContext + "T12:00:00+07:00" : null,
          rmk: rmk,
          isValid: true,
          dateContext: currentDateContext,
          raw: `${ctgrCd}: ${itemStr.trim()}`
        });
      } else {
        parsed.push({
          id: "err-" + idx + "-" + subIdx,
          item_nm: trimmed,
          isValid: false
        });
      }
    });
  });

  return parsed;
}

function handleTerminalInputLive() {
  const textarea = document.getElementById("terminal-raw-input");
  const previewBox = document.getElementById("terminal-parsed-preview");
  if (!textarea || !previewBox) return;

  const parsed = parseTerminalCommandLines(textarea.value);

  if (parsed.length === 0) {
    previewBox.innerHTML = `<div style="font-size: 11px; color: #94a3b8; padding: 6px;">Type command lines above to preview parsed items...</div>`;
    return;
  }

  previewBox.innerHTML = parsed.map(item => {
    if (!item.isValid) {
      return `
        <div class="terminal-preview-item invalid">
          <span style="color: #ef4444;">Invalid format: "${escapeHtml(item.item_nm)}"</span>
        </div>
      `;
    }
    const isDone = item.is_bought;
    return `
      <div class="terminal-preview-item">
        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
          <span class="meta-chip ${isDone ? 'pct' : 'adhoc'}">${isDone ? 'Done' : 'Plan'}</span>
          <span class="terminal-preview-note">${escapeHtml(item.item_nm)}</span>
          <span class="terminal-preview-code">#${item.ctgr_cd}</span>
          ${item.rmk ? `<span style="font-size: 10px; color: #64748b;">(${escapeHtml(item.rmk)})</span>` : ''}
          ${isDone ? `<span style="font-size: 10px; color: #0369a1;">📅 ${formatShortDate(item.dateContext)}</span>` : ''}
        </div>
        <span class="terminal-preview-amt">${isDone ? fmtRupiah(item.actual_amt) : 'Checklist'}</span>
      </div>
    `;
  }).join("");
}

function submitTerminalBulk() {
  const textarea = document.getElementById("terminal-raw-input");
  const parsed = parseTerminalCommandLines(textarea.value).filter(x => x.isValid);

  if (parsed.length === 0) {
    showToast("Invalid format");
    return;
  }

  const list = _arr(0);
  parsed.forEach(it => {
    list.unshift({
      id: "shp-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      item_nm: it.item_nm,
      ctgr_cd: it.ctgr_cd,
      est_amt: 0,
      actual_amt: it.actual_amt,
      is_bought: it.is_bought,
      bought_at: it.bought_at,
      rmk: it.rmk
    });
  });

  persistLocalData();
  renderContentArea();
  closeTerminalModal();
  textarea.value = "";
  showToast("Saved");
}

function _v1(tLabels) {
  const items = _arr(1);
  const filtered = items.filter(t => {
    if (taskFilter === "adhoc") return t.type === "ADHOC";
    if (taskFilter === "pct") return t.type === "PCT";
    if (taskFilter === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      return t.due_dt === todayStr || (!t.due_dt && !t.is_done);
    }
    return true;
  });

  const doneCount = items.filter(t => t.is_done).length;

  return `
    <div class="compact-top-bar">
      <div class="filter-pills" id="task-pills">
        <button class="pill-btn ${taskFilter === 'all' ? 'active' : ''}" onclick="setTaskFilter('all')">${escapeHtml(tLabels.filter_all || 'All')}</button>
        <button class="pill-btn ${taskFilter === 'today' ? 'active' : ''}" onclick="setTaskFilter('today')">${escapeHtml(tLabels.filter_today || 'Today')}</button>
        <button class="pill-btn ${taskFilter === 'adhoc' ? 'active' : ''}" onclick="setTaskFilter('adhoc')">${escapeHtml(tLabels.filter_adhoc || 'Ad-Hoc')}</button>
        <button class="pill-btn ${taskFilter === 'pct' ? 'active' : ''}" onclick="setTaskFilter('pct')">${escapeHtml(tLabels.filter_pct || 'Routine')}</button>
      </div>
      <div class="header-action-btns">
        <span class="badge-count">${doneCount}/${items.length}</span>
        <button class="btn-icon-action primary" onclick="openAddTaskModal()" title="Add" aria-label="Add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>

    <div class="compact-list">
      ${filtered.length === 0 ? `<div class="empty-state"><p>--</p></div>` : filtered.map(t => `
        <div class="compact-card ${t.is_done ? 'completed' : ''}">
          <button class="custom-check-btn ${t.is_done ? 'checked' : ''}" onclick="toggleTask('${t.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <div class="card-main-info" onclick="toggleTask('${t.id}')">
            <div class="card-title-row">
              <span class="card-title">${escapeHtml(t.title)}</span>
              <span class="meta-chip ${t.type === 'PCT' ? 'pct' : 'adhoc'}">${t.type === 'PCT' ? 'PCT' : 'Ad-Hoc'}</span>
              ${t.due_dt ? `<span class="meta-chip date">📅 ${formatShortDate(t.due_dt)}</span>` : ''}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function setTaskFilter(type) {
  taskFilter = type;
  renderContentArea();
}

function toggleTask(id) {
  const task = _arr(1).find(x => x.id === id);
  if (!task) return;
  task.is_done = !task.is_done;
  persistLocalData();
  renderContentArea();
  showToast("Done");
}

function _v2(cLabels) {
  const list = _arr(2);

  return `
    <div class="compact-list">
      ${list.length === 0 ? `<div class="empty-state"><p>--</p></div>` : list.map(c => {
        const diff = getDaysRemaining(c.date);
        const diffBadge = diff !== null 
          ? (diff === 0 ? "TODAY" : (diff > 0 ? `D-${diff}` : `Passed ${Math.abs(diff)}d`)) 
          : "-";

        return `
          <div class="feed-card">
            <div class="feed-head">
              <span class="ticker-badge">${escapeHtml(c.ticker)}</span>
              <span class="countdown-badge">${diffBadge}</span>
            </div>
            <div class="feed-event">${escapeHtml(c.event)}</div>
            ${c.target_prc ? `
              <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 4px;">
                ${cLabels.target_prefix || 'Target: '}<strong>${fmtRupiah(c.target_prc)}</strong> | ${cLabels.current_prefix || 'Current: '}${fmtRupiah(c.current_prc)}
              </div>
            ` : ''}
            ${c.note ? `<div class="feed-note">${escapeHtml(c.note)}</div>` : ''}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getDaysRemaining(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffMs = target - today;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

const MOOD_ICONS = {
  "5": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  "4": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  "3": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  "2": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`
};

const MOOD_COLORS = {
  "5": "#f59e0b",
  "4": "#10b981",
  "3": "#6b7280",
  "2": "#ef4444"
};

function _v3(jLabels) {
  const notes = _arr(3);

  return `
    <div class="compact-top-bar">
      <div class="filter-pills">
        <span class="view-title-pill">${escapeHtml(jLabels.view_title || 'Feed')}</span>
      </div>
      <div class="header-action-btns">
        <span class="badge-count">${notes.length}</span>
        <button class="btn-icon-action primary" onclick="openAddEntryModal()" title="Add" aria-label="Add">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>

    <div class="compact-list">
      ${notes.length === 0 ? `<div class="empty-state"><p>--</p></div>` : notes.map(n => {
        const d = parseEntryDate(n.date || new Date().toISOString());
        const mCd = n.moodCd || "3";
        const mColor = MOOD_COLORS[mCd] || "#6b7280";
        const mIcon = MOOD_ICONS[mCd] || MOOD_ICONS["3"];

        return `
          <div class="entry-card">
            <div class="entry-date-box">
              <span class="entry-date-day">${d.day}</span>
              <span class="entry-date-dayname">${d.dayName}</span>
            </div>
            
            <div class="entry-content-box">
              <div class="entry-header-row">
                <span class="entry-title">${escapeHtml(n.title || 'Reflection')}</span>
                <span class="mood-icon-badge" style="color: ${mColor};">
                  ${mIcon}
                </span>
              </div>
              <div class="entry-body-text">${escapeHtml(n.content || '')}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function parseEntryDate(dateStr) {
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, "0");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    day: isNaN(d.getDate()) ? "26" : pad(d.getDate()),
    dayName: isNaN(d.getDay()) ? "Mon" : days[d.getDay()]
  };
}

function selectMoodCd(cd, btn) {
  selectedMoodCd = cd;
  document.querySelectorAll(".mood-pill-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

function openAddEntryModal() {
  selectedMoodCd = "5";
  document.querySelectorAll(".mood-pill-btn").forEach(b => b.classList.remove("active"));
  const defMood = document.getElementById("mood-btn-5");
  if (defMood) defMood.classList.add("active");

  const m = appData.ui_labels?.modals || {};
  const j = _l(3);
  setTxt("dyn-add-entry-title", m.add_entry_title || "New Entry");
  setTxt("dyn-add-entry-title-label", m.add_entry_title_label || "Topic");
  setPh("new-entry-title", j.placeholder_title || "Topic / Title...");
  setTxt("dyn-add-entry-content-label", m.add_entry_content_label || "Reflection");
  setPh("new-entry-content", j.placeholder_content || "Write your reflection, thoughts, or ideas...");

  document.getElementById("add-entry-modal").classList.add("open");
  setModalLock(true);
  const titleInput = document.getElementById("new-entry-title");
  if (titleInput) titleInput.focus();
}

function closeAddEntryModal() {
  document.getElementById("add-entry-modal").classList.remove("open");
  setModalLock(false);
  const titleInput = document.getElementById("new-entry-title");
  if (titleInput) titleInput.value = "";
  const contentInput = document.getElementById("new-entry-content");
  if (contentInput) contentInput.value = "";
}

function submitNewEntryItem() {
  const inputTitle = document.getElementById("new-entry-title");
  const inputContent = document.getElementById("new-entry-content");

  const title = inputTitle ? inputTitle.value.trim() : "";
  const content = inputContent ? inputContent.value.trim() : "";

  if (!content) {
    showToast("Content cannot be empty");
    return;
  }

  const list = _arr(3);
  list.unshift({
    id: "jnl-" + Date.now(),
    title: title || "-",
    content: content,
    moodCd: selectedMoodCd,
    date: new Date().toISOString().split("T")[0]
  });

  closeAddEntryModal();
  persistLocalData();
  renderContentArea();
  showToast("Saved");
}

let addShopMode = "plan";

function setAddShopMode(mode) {
  addShopMode = mode;
  const btnPlan = document.getElementById("btn-mode-plan");
  const btnDone = document.getElementById("btn-mode-done");
  const doneFields = document.getElementById("shop-done-fields");
  
  if (btnPlan && btnDone && doneFields) {
    if (mode === "done") {
      btnPlan.classList.remove("active");
      btnDone.classList.add("active");
      doneFields.style.display = "block";
      const dateInput = document.getElementById("new-shop-date");
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
      }
    } else {
      btnPlan.classList.add("active");
      btnDone.classList.remove("active");
      doneFields.style.display = "none";
    }
  }
}

function openAddShopModal() {
  setAddShopMode("plan");
  const ctgrSelect = document.getElementById("new-shop-ctgr");
  if (ctgrSelect && appData.cfl_categories && ctgrSelect.options.length === 0) {
    ctgrSelect.innerHTML = appData.cfl_categories.map(c => `
      <option value="${c.cd}">${c.cd} - ${c.nm}</option>
    `).join("");
  }
  document.getElementById("add-shop-modal").classList.add("open");
  setModalLock(true);
  document.getElementById("new-shop-name").focus();
}

function closeAddShopModal() {
  document.getElementById("add-shop-modal").classList.remove("open");
  setModalLock(false);
  document.getElementById("new-shop-name").value = "";
  const rmkInput = document.getElementById("new-shop-rmk");
  if (rmkInput) rmkInput.value = "";
  const amtInput = document.getElementById("new-shop-amt");
  if (amtInput) amtInput.value = "";
}

function submitNewShopItem() {
  const name = document.getElementById("new-shop-name").value.trim();
  const ctgrSelect = document.getElementById("new-shop-ctgr");
  const ctgrCd = ctgrSelect ? ctgrSelect.value : "0117";
  const rmkInput = document.getElementById("new-shop-rmk");
  const rmk = rmkInput ? rmkInput.value.trim() : "";
  if (!name) return;

  const list = _arr(0);

  if (addShopMode === "done") {
    const amtInput = document.getElementById("new-shop-amt");
    const amt = parseCleanNumber(amtInput ? amtInput.value : 0);
    const dateInput = document.getElementById("new-shop-date");
    const dateVal = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split("T")[0];

    list.unshift({
      id: "shp-" + Date.now(),
      item_nm: name,
      ctgr_cd: ctgrCd,
      est_amt: 0,
      actual_amt: amt,
      is_bought: true,
      bought_at: dateVal + "T12:00:00+07:00",
      rmk: rmk || ""
    });
    showToast("Saved");
  } else {
    list.unshift({
      id: "shp-" + Date.now(),
      item_nm: name,
      ctgr_cd: ctgrCd,
      est_amt: 0,
      actual_amt: 0,
      is_bought: false,
      bought_at: null,
      rmk: rmk || ""
    });
    showToast("Saved");
  }

  persistLocalData();
  renderContentArea();
  closeAddShopModal();
}

function openAddTaskModal() {
  document.getElementById("add-task-modal").classList.add("open");
  setModalLock(true);
  document.getElementById("new-task-title").focus();
}

function closeAddTaskModal() {
  document.getElementById("add-task-modal").classList.remove("open");
  setModalLock(false);
  document.getElementById("new-task-title").value = "";
  document.getElementById("new-task-date").value = "";
}

function submitNewTaskItem() {
  const title = document.getElementById("new-task-title").value.trim();
  const dateVal = document.getElementById("new-task-date").value || null;
  if (!title) return;

  const list = _arr(1);
  list.unshift({
    id: "tsk-" + Date.now(),
    title: title,
    type: "ADHOC",
    due_dt: dateVal,
    is_done: false
  });

  persistLocalData();
  renderContentArea();
  closeAddTaskModal();
  showToast("Saved");
}

function openSettingsModal() {
  const keyInput = document.getElementById("settings-key");
  const patInput = document.getElementById("settings-pat");
  const gistInput = document.getElementById("settings-gist-id");

  if (keyInput) keyInput.value = localStorage.getItem("key") || "";
  if (patInput) patInput.value = localStorage.getItem("pat") || "";
  if (gistInput) gistInput.value = localStorage.getItem("id") || "";

  document.getElementById("settings-modal").classList.add("open");
  setModalLock(true);
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.remove("open");
  setModalLock(false);
}

async function saveSettings() {
  const key = (document.getElementById("settings-key").value || "").trim();
  const pat = (document.getElementById("settings-pat").value || "").trim();
  const gistId = (document.getElementById("settings-gist-id").value || "").trim();

  if (!key || !pat || !gistId) {
    showToast("All fields required");
    return;
  }

  let keyBytes;
  try {
    const raw = atob(key);
    if (raw.length !== 32) {
      showToast("Invalid Key");
      return;
    }
    keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) keyBytes[i] = raw.charCodeAt(i);
  } catch (e) {
    showToast("Invalid Key");
    return;
  }

  try {
    await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } catch (e) {
    showToast("Invalid Key");
    return;
  }

  if (pat.length < 10) {
    showToast("Invalid PAT");
    return;
  }
  if (gistId.length < 8) {
    showToast("Invalid ID");
    return;
  }

  const btnSubmit = document.getElementById("btn-submit-settings");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Verifying...";
  }

  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Accept": "application/vnd.github+json"
      }
    });

    if (res.status === 401) {
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Save"; }
      showToast("Invalid PAT");
      return;
    }
    if (res.status === 404) {
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Save"; }
      showToast("Invalid ID");
      return;
    }
    if (!res.ok) {
      if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Save"; }
      showToast("Connection failed");
      return;
    }

    const gistData = await res.json();
    const remoteFile = gistData.files && gistData.files[GIST_FILENAME];

    if (remoteFile && remoteFile.content) {
      try {
        await decryptGistData(remoteFile.content, key);
      } catch (decErr) {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = "Save"; }
        showToast("Invalid Key");
        return;
      }
    }

    localStorage.setItem("key", key);
    localStorage.setItem("pat", pat);
    localStorage.setItem("id", gistId);

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Save";
    }

    closeSettingsModal();
    showToast("Saved");

    if (!isUnlocked) {
      unlockApp();
    } else {
      syncWithGistNow();
    }
  } catch (netErr) {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Save";
    }
    showToast("Connection failed");
  }
}

function generateNewPocketKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  console.log("New POCKET_KEY (32-byte Base64):", b64);
  return b64;
}

async function parseCryptKey(keyStr) {
  if (!keyStr) throw new Error("Key is empty");

  let raw;
  try {
    raw = atob(keyStr);
  } catch (e) {
    throw new Error("Invalid Key: Not valid Base64");
  }

  if (raw.length !== 32) {
    throw new Error("Invalid Key: Must be exactly 32 bytes (256-bit)");
  }

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = raw.charCodeAt(i);
  return await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptGistData(appDataObj, keyStr) {
  const plainText = JSON.stringify(appDataObj);
  if (!keyStr) return plainText;

  const keyObj = await parseCryptKey(keyStr);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv, tagLength: 128 },
    keyObj,
    encoded
  );

  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  let binary = "";
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  const base64Cipher = btoa(binary);

  return JSON.stringify({
    lst_sync: appDataObj.updated_at || Math.floor(Date.now() / 1000),
    payload: base64Cipher
  }, null, 2);
}

async function decryptGistData(rawContent, keyStr) {
  if (!rawContent || !rawContent.trim()) {
    throw new Error("Empty Gist content");
  }

  const trimmed = rawContent.trim();
  let payloadBase64 = null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.payload) {
      payloadBase64 = parsed.payload;
    }
  } catch (e) {
    payloadBase64 = trimmed;
  }

  if (!payloadBase64) {
    payloadBase64 = trimmed;
  }

  if (!keyStr) {
    throw new Error("Encrypted Gist requires Key");
  }

  const keyObj = await parseCryptKey(keyStr);
  const binary = atob(payloadBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  if (bytes.length < 12 + 16) {
    throw new Error("Ciphertext too short");
  }

  const iv = bytes.subarray(0, 12);
  const ciphertext = bytes.subarray(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv, tagLength: 128 },
    keyObj,
    ciphertext
  );

  const decryptedText = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decryptedText);
}

function triggerGistSyncDebounced() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    syncWithGistNow();
  }, 1500);
}

let headerSyncTapCount = 0;
let headerSyncTapTimer = null;
function handleHeaderSyncTap() {
  headerSyncTapCount++;
  clearTimeout(headerSyncTapTimer);
  headerSyncTapTimer = setTimeout(() => {
    if (headerSyncTapCount >= 3) {
      openSettingsModal();
    } else {
      syncWithGistNow();
    }
    headerSyncTapCount = 0;
  }, 380);
}

async function syncWithGistNow() {
  const key = localStorage.getItem("key");
  const pat = localStorage.getItem("pat");
  const gistId = localStorage.getItem("id");
  const dot = document.getElementById("sync-dot");

  if (!pat || !gistId) {
    if (dot) dot.className = "sync-dot";
    return;
  }

  if (dot) dot.className = "sync-dot syncing";

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Accept": "application/vnd.github+json"
      }
    });

    if (!response.ok) throw new Error("Gist error");

    const gistData = await response.json();
    const remoteFile = gistData.files && gistData.files[GIST_FILENAME];

    if (remoteFile && remoteFile.content) {
      let remoteContent;
      try {
        remoteContent = await decryptGistData(remoteFile.content, key);
      } catch (decErr) {
        console.error("Gist decryption error:", decErr);
        if (dot) dot.className = "sync-dot offline";
        showToast("Invalid Key");
        return;
      }

      if (remoteContent) {
        if (!appData.updated_at || remoteContent.updated_at >= appData.updated_at) {
          appData = remoteContent;
          renderDynamicUI();
          if (dot) dot.className = "sync-dot";
          showToast("Synchronized");
          return;
        }
      }
    }

    let contentToUpload;
    try {
      contentToUpload = await encryptGistData(appData, key);
    } catch (encErr) {
      console.error("Gist encryption error:", encErr);
      if (dot) dot.className = "sync-dot offline";
      showToast("Sync failed");
      return;
    }

    const patchBody = {
      files: {
        [GIST_FILENAME]: {
          content: contentToUpload
        }
      }
    };

    const patchRes = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${pat}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patchBody)
    });

    if (patchRes.ok) {
      if (dot) dot.className = "sync-dot";
    }
  } catch (err) {
    if (dot) dot.className = "sync-dot offline";
  }
}

function showToast(msg) {
  const toast = document.getElementById("app-toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

document.addEventListener("DOMContentLoaded", () => {
  updateClock();
  setInterval(updateClock, 1000);

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("open");
        setModalLock(false);
      }
    });
    overlay.addEventListener("touchmove", (e) => {
      if (e.target === overlay) {
        e.preventDefault();
      }
    }, { passive: false });
  });

  ["click", "touchstart", "keydown"].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer);
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
