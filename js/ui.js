/* =========================================================================
 * ui.js  —  상단바 / 베이스화면(공원·공장) / 오버레이(상점·연구·통계) / 옵션
 * ========================================================================= */
window.G = window.G || {};

G.UI = (function () {
  const S = G.State;
  const C = G.CONFIG;
  const BASE = [{ id: 'park', label: '① 공원' }, { id: 'factory', label: '③ 공장' }];
  const OVL = [{ id: 'shop', label: '② 거래' }, { id: 'research', label: '④ 연구' }, { id: 'stats', label: '⑤ 통계' }];
  let lastWhSig = '', lastSoldSig = '', lastPenSig = '', lastInventorySig = '';   // 재고/판매/우리 목록 갱신 시그니처
  const PEN_SELL_TYPES = ['사육실장', '새끼사육실장', '독라', '새끼독라'];
  let optionsEl;
  let optionsTab = 'save';
  let optionsMessage = '';
  let lastSaveSlotSig = '';
  let resetArmedUntil = 0;
  let hiddenCheatCount = 0;
  let hiddenCheatTimer = 0;
  let lastMoney = null;

  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
  function productIcon(type, cls) {
    const def = G.PRODUCTS[type];
    if (!def || !def.img) return `<span class="${cls}" style="background:${def ? def.color : '#888'}"></span>`;
    return `<span class="${cls}" style="background-image:url('assets/images/products/${escAttr(def.img)}');background-size:contain;background-position:center;"></span>`;
  }
  function creatureIcon(type, cls) {
    const def = G.CREATURES[type];
    if (!def || !def.img) return `<span class="${cls}" style="background:${def ? def.color : '#888'}"></span>`;
    return `<span class="${cls} creature-ui-icon" style="background-image:url('assets/images/creatures/${escAttr(def.img)}');background-size:400% 400%;background-position:0 0;"></span>`;
  }
  function itemIcon(type, cls) {
    if (G.PRODUCTS[type]) return productIcon(type, cls);
    if (G.CREATURES[type]) return creatureIcon(type, cls);
    return `<span class="${cls}" style="background:#888"></span>`;
  }
  function creatureLabel(type) {
    if (type === '성체실장') return '성체실장석';
    if (type === '자실장') return '자실장';
    return (G.CREATURES[type] && G.CREATURES[type].label) || type;
  }

  function init() {
    buildTopbar();
    buildOverlays();
    bindKeys();
    switchScreen(S.screen);
  }

  /* ---- 상단바 --------------------------------------------------------- */
  function buildTopbar() {
    const bar = document.getElementById('topbar');
    bar.innerHTML = `
      <div class="tb-res tb-money">💰 <span id="tb-money">0</span></div>
      <div class="tb-res tb-power" title="전력">⚡ <span id="tb-power">0</span></div>
      <div class="tb-counts">
        <span class="tb-ct" title="성체실장석">${creatureIcon('성체실장', 'res-icon')}<b id="tb-c-adult">0</b></span>
        <span class="tb-ct" title="자실장">${creatureIcon('자실장', 'res-icon')}<b id="tb-c-child">0</b></span>
        <span class="tb-ct" title="독라">${creatureIcon('독라', 'res-icon')}<b id="tb-c-dok">0</b></span>
        <span class="tb-ct" title="사육실장 새끼">${creatureIcon('새끼사육실장', 'res-icon')}<b id="tb-c-petchild">0</b></span>
        <span class="tb-ct" title="사육실장 성체">${creatureIcon('사육실장', 'res-icon')}<b id="tb-c-pet">0</b></span>
        <span class="tb-ct tb-labor" title="노동석 (현재/최대)">${creatureIcon('독라', 'res-icon')}🔨<b id="tb-labor">0/0</b></span>
      </div>
      <div class="tb-feeds" id="tb-feeds"></div>
      <div class="research-queue-strip" id="research-queue-strip"></div>
      <div class="tb-tabs" id="tb-tabs"></div>
      <button class="tb-options" id="tb-options" title="옵션">...</button>
      <div class="options-menu" id="options-menu"></div>
      <div class="raid-timer" id="raid-timer">다음 레이드 --:--</div>`;
    const tabs = document.getElementById('tb-tabs');
    BASE.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tab-btn'; b.textContent = t.label; b.dataset.base = t.id;
      b.addEventListener('click', () => switchScreen(t.id));
      tabs.appendChild(b);
    });
    OVL.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tab-btn ovl-btn'; b.textContent = t.label; b.dataset.ovl = t.id;
      b.addEventListener('click', () => toggleOverlay(t.id));
      tabs.appendChild(b);
    });
    const raidTimer = document.getElementById('raid-timer');
    if (raidTimer) raidTimer.addEventListener('click', () => {
      if (G.Factory && G.Factory.triggerRaidCountdown) {
        G.Factory.triggerRaidCountdown();
        G.Assets.playSfx('click');
        renderTop();
      }
    });
    const rq = document.getElementById('research-queue-strip');
    if (rq) rq.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cancel-top-research]');
      if (!btn) return;
      cancelResearch('current');
      renderResearch();
      renderTop();
    });
    buildOptionsMenu();
  }

  function switchScreen(id) {
    if (id !== 'park' && id !== 'factory') return;
    S.screen = id;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    const bt = document.getElementById('blueprint-tab'); if (bt) bt.style.display = (id === 'factory') ? 'block' : 'none'; // 청사진은 공장에서만
    const lg = document.getElementById('linggal-btn'); if (lg) lg.style.display = (id === 'factory') ? 'block' : 'none'; // 링갈도 공장에서만
    refreshTabs(); hideInfo();
  }
  function toggleOverlay(id) {
    S.overlay = (S.overlay === id) ? null : id;
    document.getElementById('overlay-root').style.display = S.overlay ? 'flex' : 'none';
    document.querySelectorAll('.ovl-panel').forEach(p => p.classList.toggle('active', p.id === 'ovl-' + S.overlay));
    refreshTabs(); hideInfo();
  }
  function closeOverlay() { if (S.overlay) toggleOverlay(S.overlay); }
  function refreshTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.base) b.classList.toggle('active', b.dataset.base === S.screen && !S.overlay);
      if (b.dataset.ovl) b.classList.toggle('active', b.dataset.ovl === S.overlay);
    });
  }

  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (e.key === '`' || e.code === 'Backquote') {
        e.preventDefault();
        const now = performance.now();
        hiddenCheatCount = (now - hiddenCheatTimer < 900) ? hiddenCheatCount + 1 : 1;
        hiddenCheatTimer = now;
        if (hiddenCheatCount >= 3) {
          hiddenCheatCount = 0;
          doHiddenCheat();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (optionsEl && optionsEl.classList.contains('open')) { closeOptions(); return; }
        if (S.overlay) closeOverlay();
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    });
  }

  function togglePause() {
    G.paused = !G.paused;
    updatePauseIndicator();
    G.Assets.playSfx('click');
  }
  let pauseEl;
  function updatePauseIndicator() {
    if (!pauseEl) {
      pauseEl = document.createElement('div');
      pauseEl.id = 'pause-indicator';
      pauseEl.textContent = '⏸ 일시정지 (Space)';
      document.getElementById('game').appendChild(pauseEl);
    }
    pauseEl.style.display = G.paused ? 'block' : 'none';
  }

  // 치트 메뉴(`을 3번 누르면 열림) — 4가지 치트 선택창
  let cheatEl;
  const CHEATS = [
    { id: 'money', label: '💰 돈 +' + (C.CHEAT_MONEY || 9999999).toLocaleString() },
    { id: 'scrap', label: '🔩 철조각 +9,999' },
    { id: 'creatures', label: '🐾 실장석 +' + (C.CHEAT_CREATURES || 10) + '마리' },
    { id: 'research', label: '🔬 연구 즉시 완료' },
    { id: 'killinvaders', label: '☠ 모든 침입 실장석 소멸' },
  ];
  function doHiddenCheat() { toggleCheatMenu(); }
  function buildCheatMenu() {
    cheatEl = document.createElement('div');
    cheatEl.id = 'cheat-menu'; cheatEl.style.display = 'none';
    cheatEl.innerHTML = `<div class="cheat-title">치트</div>` +
      CHEATS.map(c => `<button class="cheat-btn" data-cheat="${c.id}">${c.label}</button>`).join('') +
      `<button class="cheat-close" data-cheat="close">닫기</button>`;
    document.getElementById('game').appendChild(cheatEl);
    cheatEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cheat]'); if (!b) return;
      applyCheat(b.dataset.cheat);
    });
    document.addEventListener('mousedown', (e) => {
      if (cheatEl.style.display === 'none') return;
      if (!cheatEl.contains(e.target)) cheatEl.style.display = 'none';
    });
  }
  function toggleCheatMenu() {
    if (!cheatEl) buildCheatMenu();
    cheatEl.style.display = (cheatEl.style.display === 'none') ? 'block' : 'none';
    G.Assets.playSfx('click');
  }
  function applyCheat(id) {
    if (id === 'close') { cheatEl.style.display = 'none'; return; }
    if (id === 'money') {
      S.money += C.CHEAT_MONEY || 9999999;
      flash('💰+' + (C.CHEAT_MONEY || 9999999).toLocaleString());
    } else if (id === 'scrap') {
      if (!S.warehouse['철조각']) S.warehouse['철조각'] = [];
      for (let i = 0; i < 9999; i++) S.warehouse['철조각'].push({ type: '철조각', isProduct: false, amount: 1, stats: { 크기: 0 } });
      lastWhSig = ''; lastInventorySig = '';
      flash('철조각 +9,999');
    } else if (id === 'creatures') {
      for (let i = 0; i < (C.CHEAT_CREATURES || 10); i++) G.Factory.dropToFactory(G.Creatures.newAdult());
      flash('성체 ' + (C.CHEAT_CREATURES || 10) + '마리 추가');
    } else if (id === 'research') {
      (G.UPGRADES || []).forEach(u => { S.upgrades[u.key] = u.maxLevel || (u.costMult ? (u.maxLevel || 20) : 5); });
      if (G.Factory && G.Factory.refreshMenu) G.Factory.refreshMenu();
      renderResearch();
      flash('연구 즉시 완료');
    } else if (id === 'killinvaders') {
      const n = (G.Factory && G.Factory.clearInvaders) ? G.Factory.clearInvaders() : 0;
      flash('침입 실장석 ' + n + '마리 소멸');
    }
    G.Assets.playSfx('click');
  }

  /* ---- 옵션 ----------------------------------------------------------- */
  function buildOptionsMenu() {
    optionsEl = document.getElementById('options-menu');
    const btn = document.getElementById('tb-options');
    optionsEl.innerHTML = `
      <div class="opt-title">옵션</div>
      <div class="opt-tabs">
        <button class="opt-tab" data-opt-tab="save">저장</button>
        <button class="opt-tab" data-opt-tab="audio">음량</button>
      </div>
      <div class="opt-pane" data-pane="save">
        <div class="opt-slots" id="opt-slots"></div>
        <button data-opt="reset">초기화</button>
        <div class="opt-message" id="opt-message"></div>
        <div class="opt-save-time" id="opt-save-time"></div>
      </div>
      <div class="opt-pane" data-pane="audio">
        <label class="opt-slider">BGM <input type="range" min="0" max="100" step="1" data-volume="bgm"><b id="opt-bgm-val">0%</b></label>
        <label class="opt-slider">효과음 <input type="range" min="0" max="100" step="1" data-volume="sfx"><b id="opt-sfx-val">0%</b></label>
      </div>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleOptions(); });
    optionsEl.addEventListener('click', onOptionClick);
    optionsEl.addEventListener('input', onOptionInput);
    document.addEventListener('mousedown', (e) => {
      if (!optionsEl.classList.contains('open')) return;
      if (!optionsEl.contains(e.target) && e.target !== btn) closeOptions();
    });
    renderOptions();
  }
  function toggleOptions() {
    optionsEl.classList.toggle('open');
    renderOptions();
  }
  function closeOptions() { if (optionsEl) optionsEl.classList.remove('open'); }
  function renderOptions() {
    if (!optionsEl) return;
    renderSaveSlots();
    const t = G.Save && G.Save.savedAt ? G.Save.savedAt() : null;
    const line = document.getElementById('opt-save-time');
    if (line) line.textContent = t ? ('최근 자동저장: ' + formatTime(t)) : '자동저장 없음';
    const msg = document.getElementById('opt-message');
    if (msg) {
      msg.textContent = optionsMessage;
      msg.classList.toggle('show', !!optionsMessage);
      msg.classList.toggle('error', optionsMessage.includes('실패'));
    }
    optionsEl.querySelectorAll('.opt-tab').forEach(b => b.classList.toggle('active', b.dataset.optTab === optionsTab));
    optionsEl.querySelectorAll('.opt-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === optionsTab));
    const audio = S.audio || (S.audio = { bgm: 0.35, sfx: 1 });
    const bgm = optionsEl.querySelector('[data-volume="bgm"]');
    const sfx = optionsEl.querySelector('[data-volume="sfx"]');
    if (bgm) bgm.value = Math.round((audio.bgm == null ? 0.35 : audio.bgm) * 100);
    if (sfx) sfx.value = Math.round((audio.sfx == null ? 1 : audio.sfx) * 100);
    const bv = document.getElementById('opt-bgm-val'); if (bv && bgm) bv.textContent = bgm.value + '%';
    const sv = document.getElementById('opt-sfx-val'); if (sv && sfx) sv.textContent = sfx.value + '%';
  }
  function renderSaveSlots() {
    const wrap = document.getElementById('opt-slots'); if (!wrap || !G.Save || !G.Save.slotCount) return;
    const n = G.Save.slotCount();
    let sig = '';
    let html = '';
    for (let i = 1; i <= n; i++) {
      const t = G.Save.slotSavedAt(i);
      sig += i + ':' + (t || 0) + '|';
      const info = t ? formatDateTime(t) : '';
      html += `<div class="opt-slot-row"><span class="opt-slot-name">슬롯 ${i}</span><span class="opt-slot-time">${info}</span>` +
        `<button data-slot-save="${i}">저장</button>` +
        `<button data-slot-load="${i}" ${t ? '' : 'disabled'}>로드</button></div>`;
    }
    if (sig === lastSaveSlotSig) return;
    lastSaveSlotSig = sig;
    wrap.innerHTML = html;
  }
  function formatTime(t) {
    const d = new Date(t);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatDateTime(t) {
    const d = new Date(t);
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) + ' ' + formatTime(t);
  }
  function onOptionClick(e) {
    const tab = e.target.closest('[data-opt-tab]');
    if (tab) { optionsTab = tab.dataset.optTab; renderOptions(); G.Assets.playSfx('click'); return; }
    const saveBtn = e.target.closest('button[data-slot-save]');
    if (saveBtn) {
      const n = +saveBtn.dataset.slotSave;
      const ok = G.Save.saveSlot(n);
      optionsMessage = ok ? ('슬롯 ' + n + ' 저장 완료') : ('슬롯 ' + n + ' 저장 실패' + (G.Save.error ? ' (' + G.Save.error() + ')' : ''));
      renderOptions();
      flash(optionsMessage);
      G.Assets.playSfx('click'); return;
    }
    const loadBtn = e.target.closest('button[data-slot-load]');
    if (loadBtn) {
      const n = +loadBtn.dataset.slotLoad;
      if (!G.Save.hasSlot(n)) { flash('슬롯 ' + n + ' 비어 있음'); return; }
      const ok = G.Save.loadSlot(n);
      optionsMessage = ok ? ('슬롯 ' + n + ' 로드 완료') : ('슬롯 ' + n + ' 로드 실패' + (G.Save.error ? ' (' + G.Save.error() + ')' : ''));
      renderOptions();
      flash(optionsMessage);
      if (ok) closeOptions();
      G.Assets.playSfx('click'); return;
    }
    const b = e.target.closest('button[data-opt]'); if (!b) return;
    const opt = b.dataset.opt;
    if (opt === 'reset') {
      const now = performance.now();
      if (now < resetArmedUntil) {
        resetArmedUntil = 0;
        G.Save.reset(); optionsMessage = '초기화 완료'; lastSaveSlotSig = ''; renderOptions(); flash(optionsMessage);
      } else {
        resetArmedUntil = now + 4000;
        optionsMessage = '초기화를 한 번 더 누르면 진행';
        renderOptions();
      }
      G.Assets.playSfx('click'); return;
    }
    closeOptions();
    G.Assets.playSfx('click');
  }
  function onOptionInput(e) {
    const el = e.target.closest('[data-volume]'); if (!el) return;
    const key = el.dataset.volume;
    const v = Math.max(0, Math.min(100, +el.value || 0)) / 100;
    if (!S.audio) S.audio = { bgm: 0.35, sfx: 1 };
    S.audio[key] = v;
    if (key === 'bgm' && G.Assets.setBgmVolume) G.Assets.setBgmVolume(v);
    if (key === 'sfx' && G.Assets.setSfxVolume) G.Assets.setSfxVolume(v);
    renderOptions();
  }
  let flashEl;
  function flash(msg) {
    if (!flashEl) { flashEl = document.createElement('div'); flashEl.className = 'cheat-flash'; document.getElementById('game').appendChild(flashEl); }
    flashEl.textContent = msg; flashEl.classList.add('show');
    clearTimeout(flashEl._t); flashEl._t = setTimeout(() => flashEl.classList.remove('show'), 1400);
  }

  /* ---- 정보창 -------------------------------------------------------- */
  let infoEl;
  function showCreatureInfo(c, x, y) {
    if (!infoEl) {
      infoEl = document.createElement('div'); infoEl.className = 'creature-info';
      document.getElementById('game').appendChild(infoEl);
      document.addEventListener('mousedown', (e) => { if (infoEl && !infoEl.contains(e.target)) hideInfo(); });
    }
    const def = G.CREATURES[c.type] || { label: c.type, color: '#999' };
    let growthRow = '';
    if (G.CONFIG.GROWTH_NEXT[c.type]) {
      const at = (G.CONFIG.SIZE_EVOLVE_AT && G.CONFIG.SIZE_EVOLVE_AT[c.type]) || 0;
      if (at) growthRow = `<div class="ci-row"><span>진화 크기</span><b>${Math.floor(c.stats.크기 || 0)}/${at}</b></div>`;
    }
    const grd = c.stats ? G.Creatures.gradeOfStats(c.stats) : null;
    const gradeRow = grd ? `<div class="ci-row"><span>등급</span><b style="color:${grd.color}">${grd.label}</b></div>` : '';
    if (G.Creatures.ensureVitals) G.Creatures.ensureVitals(c);
    const hpMax = G.Creatures.hpMaxOf ? G.Creatures.hpMaxOf(c) : Math.floor(c.stats.크기 || 1);
    const hpRow = `<div class="ci-row"><span>체력</span><b>${Math.floor(c.hp != null ? c.hp : hpMax)}/${hpMax}</b></div>`;
    const happyRow = `<div class="ci-row"><span>행복</span><b>${Math.floor(c.행복 != null ? c.행복 : 100)}/${G.CONFIG.CREATURE_HAPPY_MAX || 100}</b></div>`;
    infoEl.innerHTML = `
      <div class="ci-head" style="border-color:${def.color}">#${c.id} · ${def.label}</div>
      ${gradeRow}
      <div class="ci-row"><span>육질</span><b>${Math.floor(c.stats.육질)}</b></div>
      <div class="ci-row"><span>개념</span><b>${Math.floor(c.stats.개념)}</b></div>
      <div class="ci-row"><span>크기</span><b>${Math.floor(c.stats.크기)}</b></div>
      ${hpRow}${happyRow}${growthRow}`;
    const g = document.getElementById('game').getBoundingClientRect();
    const sc = g.width / C.GAME_W;
    infoEl.style.left = ((x - g.left) / sc + 12) + 'px';
    infoEl.style.top = ((y - g.top) / sc + 12) + 'px';
    infoEl.style.display = 'block';
  }
  function hideInfo() { if (infoEl) infoEl.style.display = 'none'; }

  /* ---- 오버레이 구성 ------------------------------------------------- */
  function buildOverlays() {
    const root = document.createElement('div');
    root.id = 'overlay-root';
    root.innerHTML = `
      <div class="ovl-backdrop"></div>
      <div class="ovl-panel" id="ovl-shop"></div>
      <div class="ovl-panel" id="ovl-research"></div>
      <div class="ovl-panel" id="ovl-stats"></div>`;
    document.getElementById('game').appendChild(root);
    root.querySelector('.ovl-backdrop').addEventListener('click', closeOverlay);

    // ② 거래 (구매 + 판매)
    document.getElementById('ovl-shop').innerHTML = `
      <div class="ovl-head">② 거래 <button class="ovl-close">✕</button></div>
      <div class="ovl-body">
        <div class="stat-big">보유금 💰<b id="shop-money">0</b> · ${productIcon('실장푸드', 'res-icon')}실장푸드 <b id="shop-food">0</b></div>
        <div class="res-bar" id="shop-resbar"></div>
        <h3>${productIcon('실장푸드', 'res-icon')}실장푸드 구매 (개당 ₩${C.FOOD_PRICE})</h3>
        <div class="shop-buy" id="shop-buy-food"></div>
        <h3>${productIcon('조미료', 'res-icon')}조미료 구매 (개당 💰<span id="shop-seasoning-price">0</span> · 1분마다 변동)</h3>
        <div class="shop-buy" id="shop-buy-seasoning"></div>
        <h3>특수 아이템 구매</h3>
        <div class="shop-buy" id="shop-buy-special"></div>
        <h3>🐾 실장석 구매</h3>
        <div class="shop-buy" id="shop-buy-cre"></div>
        <h3>${productIcon('짓소산 푸드', 'res-icon')}짓소산 푸드 판매 (개당 ₩${C.JISSO_FOOD_PRICE || 5})</h3>
        <div class="warehouse-list" id="jissofood-sell-list"></div>
        <h3>🏠 우리 실장석 판매 <span class="muted">(사육실장=새끼 기본가+개념↑, 성체는 절반 / 독라=육질·크기)</span></h3>
        <div class="warehouse-list" id="pen-sell-list"></div>
        <h3>⚙ 자동판매 (생기는 즉시 판매)</h3>
        <div class="autosell-list" id="autosell-list"></div>
        <h3>📦 창고 판매 (가치 💰<span id="wh-value">0</span>) <button class="sell-btn" id="sell-btn">전량 판매</button></h3>
        <div class="warehouse-list" id="warehouse-list"></div>
      </div>`;
    const buyF = document.getElementById('shop-buy-food');
    [10, 50, 100, 1000].forEach(n => {
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.innerHTML = `${productIcon('실장푸드', 'shop-icon')}+${n}개<small>₩${(n * C.FOOD_PRICE).toLocaleString()}</small>`;
      b.addEventListener('click', () => buyFood(n));
      buyF.appendChild(b);
    });
    const buyS = document.getElementById('shop-buy-seasoning');
    [1, 10, 50].forEach(n => {
      const b = document.createElement('button');
      b.className = 'shop-btn'; b.dataset.season = n;
      b.innerHTML = `${productIcon('조미료', 'shop-icon')}+${n}개<small>₩0</small>`;
      b.addEventListener('click', () => buySeasoning(n));
      buyS.appendChild(b);
    });
    const buySp = document.getElementById('shop-buy-special');
    ['콘페이토', '도돈파', '코로리', '도로리'].forEach(t => {
      const price = (G.PRODUCTS[t] && G.PRODUCTS[t].shopPrice) || 0;
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.innerHTML = `${productIcon(t, 'shop-icon')}${t}<small>₩${price.toLocaleString()}</small>`;
      b.addEventListener('click', () => buySpecialItem(t));
      buySp.appendChild(b);
    });
    const buyC = document.getElementById('shop-buy-cre');
    [['성체실장', C.BUY_ADULT], ['자실장', C.BUY_CHILD]].forEach(([t, cost]) => {
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.innerHTML = `${creatureIcon(t, 'shop-icon')}${creatureLabel(t)}<small>₩${cost.toLocaleString()}</small>`;
      b.addEventListener('click', () => buyCreature(t, cost));
      buyC.appendChild(b);
    });
    // 자동판매 토글(생산품마다)
    const asWrap = document.getElementById('autosell-list');
    Object.keys(G.PRODUCTS).filter(p => G.PRODUCTS[p].isProduct).forEach(t => {
      const b = document.createElement('button');
      b.className = 'autosell-btn'; b.dataset.type = t; b.innerHTML = `${productIcon(t, 'mini-icon')}${t}`;
      b.addEventListener('click', () => {
        S.autoSell[t] = !S.autoSell[t];
        if (S.autoSell[t]) G.Factory.sellSomeType(t, Infinity);   // 켜는 즉시 기존 재고 판매
        b.classList.toggle('on', !!S.autoSell[t]);
        G.Assets.playSfx('click');
      });
      asWrap.appendChild(b);
    });

    // ④ 연구소
    document.getElementById('ovl-research').innerHTML = `
      <div class="ovl-head">④ 연구소 <button class="ovl-close">✕</button></div>
      <div class="ovl-body"><div class="research-status" id="research-status"></div><div class="research-tier-board" id="research-list"></div></div>`;
    const rlist = document.getElementById('research-list');
    for (let t = 0; t <= 3; t++) {
      const sec = document.createElement('section');
      sec.className = 'research-tier-section';
      sec.dataset.tier = t;
      sec.innerHTML = `<h3>콜로니 T${t}</h3><div class="research-grid" data-tier-grid="${t}"></div>`;
      rlist.appendChild(sec);
    }
    G.UPGRADES.forEach(u => {
      const card = document.createElement('div');
      card.className = 'research-card'; card.dataset.key = u.key;
      card.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p><small class="rc-tier">콜로니 T0 연구</small>
        <div class="rc-foot">Lv.<b class="rc-lv">0</b> <button class="rc-buy">₩${u.cost}</button></div>`;
      card.querySelector('.rc-buy').addEventListener('click', () => buyUpgrade(u));
      const grid = rlist.querySelector(`[data-tier-grid="${upgradeTier(u, 1)}"]`) || rlist.querySelector('[data-tier-grid="0"]');
      grid.appendChild(card);
    });
    document.getElementById('research-status').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cancel-research]');
      if (!btn) return;
      if (btn.dataset.cancelResearch === 'current') cancelResearch('current');
      else cancelResearch('queue', +btn.dataset.idx);
      renderResearch();
      renderTop();
    });

    // ⑤ 통계 (판매는 거래탭으로 이동)
    document.getElementById('ovl-stats').innerHTML = `
      <div class="ovl-head">⑤ 통계 <button class="ovl-close">✕</button></div>
      <div class="ovl-body">
        <div class="stat-big">분당 판매 <b id="stat-rate">0.0</b> · 누적매출 💰<b id="stat-sales">0</b></div>
        <div class="stat-sub">화물 <span id="stat-cargo">0</span> · 배회 <span id="stat-wander">0</span> · 장치 <span id="stat-build">0</span>
          · 실장푸드 수요 <span id="stat-demand">0</span>/분 · 운치 <span id="stat-unchi">0</span>/분</div>
        <div class="stat-sub">자원 — ${productIcon('실장푸드', 'res-icon')}실장푸드 <b id="stat-food">0</b> · ${productIcon('짓소산 푸드', 'res-icon')}짓소산 푸드 <b id="stat-jisso-food">0</b> · ${productIcon('운치', 'res-icon')}운치 <b id="stat-unchistock">0</b></div>
        <h3>📦 소지 물자</h3>
        <div class="warehouse-list" id="inventory-list"></div>
        <h3>📈 누적 판매</h3>
        <div class="warehouse-list" id="sold-list"></div>
        <h3>💲 가격 계수 (데이터 파일에서 수정)</h3>
        <div id="price-editor" class="price-editor"></div>
      </div>`;

    root.querySelectorAll('.ovl-close').forEach(b => b.addEventListener('click', closeOverlay));
    document.getElementById('sell-btn').addEventListener('click', () => {
      const r = G.Factory.sellAllWarehouse();
      flash(r.count ? ('판매! 💰+' + r.gained.toLocaleString() + ' (' + r.count + '개)') : '판매할 재고 없음');
    });
    document.getElementById('warehouse-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-sell]'); if (!btn) return;
      const n = btn.dataset.sell === 'all' ? Infinity : +btn.dataset.sell;
      const r = G.Factory.sellSomeType(btn.dataset.type, n);
      if (r.count) flash('판매 💰+' + r.gained.toLocaleString() + ' (' + r.count + '개)');
    });
    document.getElementById('pen-sell-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-pensell]'); if (!btn) return;
      const n = btn.dataset.pensell === 'all' ? Infinity : +btn.dataset.pensell;
      const r = G.Factory.sellPenCreatures(btn.dataset.type, n);
      flash(r.count ? ('판매 💰+' + r.gained.toLocaleString() + ' (' + r.count + '마리)') : '판매할 실장석 없음');
    });
    document.getElementById('jissofood-sell-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-jfsell]'); if (!btn) return;
      const n = btn.dataset.jfsell === 'all' ? Infinity : +btn.dataset.jfsell;
      const r = G.Factory.sellJissoFood(n);
      flash(r.count ? ('판매 💰+' + r.gained.toLocaleString() + ' (' + r.count + '개)') : '판매할 짓소산 푸드 없음');
    });
    buildPriceEditor();
  }

  function buyFood(n) {
    const cost = n * C.FOOD_PRICE;
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.food += n; G.Assets.playSfx('click');
    flash('실장푸드 +' + n + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buySeasoning(n) {
    const max = C.SEASONING_MAX || 50;
    n = Math.min(n, Math.max(0, max - (S.seasoning || 0)));
    if (n <= 0) { flash('조미료 비축 최대치(' + max + '개)'); return; }
    const cost = n * Math.round(S.seasoningPrice || C.SEASONING_BASE);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.seasoning = Math.min(max, (S.seasoning || 0) + n); G.Assets.playSfx('click');
    flash('조미료 +' + n + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buyCreature(type, cost) {
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    const c = G.Creatures.newWild(type);
    G.Factory.dropToFactory(c);
    S.money -= cost; G.Assets.playSfx('click');
    flash(creatureLabel(type) + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buySpecialItem(type) {
    const def = G.PRODUCTS[type];
    const cost = (def && def.shopPrice) || 0;
    if (!def || !cost) return;
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost;
    if (!S.warehouse[type]) S.warehouse[type] = [];
    S.warehouse[type].push({ id: G.uid(), type, isProduct: false, amount: 1, stats: { 크기: 0 } });
    G.Assets.playSfx('click');
    flash(type + ' 구매 (창고 +1, 💰-' + cost.toLocaleString() + ')');
  }
  function queuedLevels(key) {
    let n = 0;
    if (S.currentResearch && S.currentResearch.key === key) n++;
    for (const r of (S.researchQueue || [])) if (r.key === key) n++;
    return n;
  }
  function nextResearchLevel(u) {
    return (S.upgrades[u.key] || 0) + queuedLevels(u.key) + 1;
  }
  function researchCost(u, targetLevel) {
    const lv = targetLevel - 1;
    return u.costMult ? Math.round(u.cost * Math.pow(u.costMult, lv)) : u.cost * targetLevel;
  }
  function researchProgressKey(r) {
    return r ? (r.key + '|' + (r.targetLevel || 0)) : '';
  }
  function isLevelResearch(u) {
    return !!(u && (!u.maxLevel || u.maxLevel > 1));
  }
  function levelResearchTier(targetLevel) {
    if (targetLevel <= 5) return 0;
    if (targetLevel <= 10) return 1;
    if (targetLevel <= 15) return 2;
    return 3;
  }
  function upgradeTier(u, targetLevel) {
    const base = Math.max(0, u && u.tier || 0);
    if (!isLevelResearch(u)) return base;
    return Math.max(base, levelResearchTier(targetLevel || 1));
  }
  function colonyTierReady(u) {
    return (S.colonyTier || 0) >= upgradeTier(u, nextResearchLevel(u));
  }
  function buyUpgrade(u) {
    if (!S.researchQueue) S.researchQueue = [];
    const needTier = upgradeTier(u, nextResearchLevel(u));
    if ((S.colonyTier || 0) < needTier) { flash('콜로니 센터 T' + needTier + ' 필요'); return; }
    const targetLevel = nextResearchLevel(u);
    if (u.maxLevel && targetLevel > u.maxLevel) { flash('이미 연구 완료/예약됨'); return; }
    if ((S.researchQueue.length + (S.currentResearch ? 1 : 0)) >= (C.RESEARCH_QUEUE_MAX || 5)) { flash('연구 예약은 최대 ' + (C.RESEARCH_QUEUE_MAX || 5) + '개'); return; }
    const cost = researchCost(u, targetLevel);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost;
    const saved = (S.researchProgressBank && S.researchProgressBank[u.key + '|' + targetLevel]) || 0;
    S.researchQueue.push({ key: u.key, name: u.name, cost, targetLevel, savedProgress: saved });
    G.Assets.playSfx('click');
    flash(u.name + ' Lv.' + targetLevel + ' 연구 예약' + (saved ? ' (진행도 이어서)' : '') + ' (💰-' + cost.toLocaleString() + ')');
  }
  function cancelResearch(which, idx) {
    let r = null;
    if (which === 'current') {
      r = S.currentResearch;
      if (r) {
        if (!S.researchProgressBank) S.researchProgressBank = {};
        const k = researchProgressKey(r);
        S.researchProgressBank[k] = Math.max(S.researchProgressBank[k] || 0, Math.min(r.cost || Infinity, S.researchProgress || 0));
      }
      S.currentResearch = null;
      S.researchProgress = 0;
    }
    else if (S.researchQueue && S.researchQueue[idx]) r = S.researchQueue.splice(idx, 1)[0];
    if (!r) return;
    S.money += r.cost || 0;
    G.Assets.playSfx('click');
    flash(r.name + ' 연구 취소' + (which === 'current' ? ' (진행도 보존)' : '') + ' (💰+' + (r.cost || 0).toLocaleString() + ')');
  }

  function buildPriceEditor() {
    const wrap = document.getElementById('price-editor');
    let html = `<p class="muted">가격 계수는 데이터 파일(js/config.js의 G.PRICE_DEFAULTS)에서 직접 수정하세요. (게임 내 편집 비활성)</p>`;
    Object.keys(S.prices).forEach(prod => {
      const p = S.prices[prod];
      const parts = Object.keys(p).map(key => `${key}: ${p[key]}`).join(' · ');
      html += `<div class="price-row"><b style="color:${G.PRODUCTS[prod] ? G.PRODUCTS[prod].color : '#fff'}">${prod}</b><span class="price-vals">${parts}</span></div>`;
    });
    wrap.innerHTML = html;
  }

  /* ---- 오버레이 동적 갱신 -------------------------------------------- */
  function renderOverlay() {
    if (!S.overlay) return;
    if (S.overlay === 'shop') renderShop();
    else if (S.overlay === 'stats') renderStats();
    else if (S.overlay === 'research') renderResearch();
  }

  function renderPenSell() {
    // 우리 안 사육실장/독라 집계 (판매금지 우리는 제외)
    const groups = {}; PEN_SELL_TYPES.forEach(t => groups[t] = { n: 0, val: 0 });
    G.Pens.allPens().forEach(pen => { if (pen.noSell) return; pen.creatures.forEach(c => {
      const g = groups[c.type]; if (!g) return;
      g.n++; g.val += G.Creatures.priceOf(c.type, c.stats);
    }); });
    const sig = PEN_SELL_TYPES.map(t => t + ':' + groups[t].n + ':' + groups[t].val).join('|');
    if (sig === lastPenSig) return;
    lastPenSig = sig;
    const rows = PEN_SELL_TYPES.filter(t => groups[t].n > 0).map(t => {
      const g = groups[t];
      const unit = Math.round(g.val / g.n);
      const label = { 사육실장: '사육실장 성체', 새끼사육실장: '사육실장 새끼', 독라: '독라 성체', 새끼독라: '독라 새끼' }[t] || t;
      return `<div class="wh-item">${creatureIcon(t, 'wh-icon')}<span class="wh-name">${label} ×${g.n} <small class="unit">개당 💰${unit.toLocaleString()}</small></span><b>💰${g.val.toLocaleString()}</b>
        <span class="sell-mini"><button data-pensell="1" data-type="${t}">1</button><button data-pensell="10" data-type="${t}">10</button><button data-pensell="100" data-type="${t}">100</button><button data-pensell="all" data-type="${t}">전부</button></span></div>`;
    }).join('');
    document.getElementById('pen-sell-list').innerHTML = rows || '<div class="muted">우리에 판매할 사육실장/독라 없음</div>';
  }

  let lastJfSig = '';
  function renderJissoFoodSell() {
    const el = document.getElementById('jissofood-sell-list'); if (!el) return;
    const have = Math.floor(S.jissoFood || 0);
    const unit = C.JISSO_FOOD_PRICE || 5;
    const sig = String(have);
    if (sig === lastJfSig) return;
    lastJfSig = sig;
    if (have <= 0) { el.innerHTML = '<div class="muted">짓소산 푸드 없음 (배합기로 생산)</div>'; return; }
    el.innerHTML = `<div class="wh-item">${productIcon('짓소산 푸드', 'wh-icon')}<span class="wh-name">짓소산 푸드 ×${have} <small class="unit">개당 💰${unit.toLocaleString()}</small></span><b>💰${(have * unit).toLocaleString()}</b>
      <span class="sell-mini"><button data-jfsell="1">1</button><button data-jfsell="10">10</button><button data-jfsell="100">100</button><button data-jfsell="all">전부</button></span></div>`;
  }

  function renderShop() {
    document.getElementById('shop-food').textContent = Math.floor(S.food);
    document.getElementById('shop-money').textContent = Math.floor(S.money).toLocaleString();
    const resbar = document.getElementById('shop-resbar');
    if (resbar) resbar.innerHTML =
      `${productIcon('짓소산 푸드', 'res-icon')}짓소산 푸드 <b>${Math.floor(S.jissoFood || 0)}</b> · ` +
      `${productIcon('운치', 'res-icon')}운치 <b>${Math.floor(S.unchi || 0)}</b> · ` +
      `${productIcon('조미료', 'res-icon')}조미료 <b>${Math.floor(S.seasoning || 0)}</b> · ` +
      `⚡전력 <b>${Math.floor(S.powerUsed || 0).toLocaleString()}/${Math.floor(S.power || 0).toLocaleString()}</b>`;
    const sp = Math.round(S.seasoningPrice || C.SEASONING_BASE);
    document.getElementById('shop-seasoning-price').textContent = sp.toLocaleString();
    document.querySelectorAll('#shop-buy-seasoning .shop-btn').forEach(b => {
      const n = +b.dataset.season;
      b.querySelector('small').textContent = '₩' + (n * sp).toLocaleString();
    });
    renderPenSell();
    renderJissoFoodSell();
    // 창고 재고(판매) — 변경 시에만 갱신(클릭 무효화 방지)
    let total = 0;
    const whKeys = Object.keys(S.warehouse).filter(k => S.warehouse[k] && S.warehouse[k].length);
    whKeys.forEach(k => S.warehouse[k].forEach(d => { total += (d.isProduct ? (d.price || 1) : 2); }));
    document.getElementById('wh-value').textContent = total.toLocaleString();
    const whSig = whKeys.map(k => k + ':' + S.warehouse[k].length).join('|');
    if (whSig !== lastWhSig) {
      lastWhSig = whSig;
      const whHtml = whKeys.map(k => {
        const list = S.warehouse[k];
        const val = list.reduce((s, d) => s + (d.isProduct ? (d.price || 1) : 2), 0);
        const unit = Math.round(val / list.length);
        return `<div class="wh-item">${itemIcon(k, 'wh-icon')}<span class="wh-name">${k} ×${list.length} <small class="unit">개당 💰${unit.toLocaleString()}</small></span><b>💰${val.toLocaleString()}</b>
          <span class="sell-mini"><button data-sell="1" data-type="${k}">1</button><button data-sell="10" data-type="${k}">10</button><button data-sell="100" data-type="${k}">100</button><button data-sell="all" data-type="${k}">전부</button></span></div>`;
      }).join('');
      document.getElementById('warehouse-list').innerHTML = whHtml || '<div class="muted">재고 없음 (도축기 등으로 생산)</div>';
    }
  }

  function renderResearch() {
    const status = document.getElementById('research-status');
    if (status) {
      const cur = S.currentResearch;
      const need = cur ? (cur.cost || 0) : 0;
      const pct = cur ? Math.min(100, Math.floor(((S.researchProgress || 0) / Math.max(1, need)) * 100)) : 0;
      const curHtml = cur
        ? `<div class="research-current"><b>${cur.name} Lv.${cur.targetLevel}</b><span>${Math.floor(S.researchProgress || 0).toLocaleString()}/${need.toLocaleString()} · ${pct}%</span><button data-cancel-research="current">취소</button></div>`
        : '<div class="muted">진행 중인 연구 없음</div>';
      const qHtml = (S.researchQueue || []).map((r, i) =>
        `<button class="research-chip" data-cancel-research="queue" data-idx="${i}" title="클릭하면 취소">${r.name} Lv.${r.targetLevel}</button>`).join('');
      status.innerHTML = curHtml + `<div class="research-queued">${qHtml || '<span class="muted">예약 없음</span>'}</div>`;
    }
    document.querySelectorAll('#research-list .research-card').forEach(card => {
      const u = G.UPGRADES.find(x => x.key === card.dataset.key); if (!u) return;
      const lv = S.upgrades[u.key] || 0;
      const targetLevel = nextResearchLevel(u);
      const cost = researchCost(u, targetLevel);
      card.querySelector('.rc-lv').textContent = lv;
      const done = u.maxLevel && targetLevel > u.maxLevel;
      const needTier = upgradeTier(u, targetLevel);
      const tierGrid = document.querySelector(`#research-list [data-tier-grid="${needTier}"]`);
      if (tierGrid && card.parentElement !== tierGrid) tierGrid.appendChild(card);
      const tierLabel = card.querySelector('.rc-tier');
      if (tierLabel) tierLabel.textContent = '콜로니 T' + needTier + ' 연구';
      const tierLocked = (S.colonyTier || 0) < needTier;
      card.classList.toggle('locked', !!tierLocked);
      const btn = card.querySelector('.rc-buy'); btn.textContent = done ? '완료/예약' : (tierLocked ? ('콜로니 T' + needTier + ' 필요') : '예약 ₩' + cost.toLocaleString());
      btn.classList.toggle('owned', !!done);
      btn.classList.toggle('afford', !done && !tierLocked && S.money >= cost && ((S.researchQueue || []).length + (S.currentResearch ? 1 : 0)) < (C.RESEARCH_QUEUE_MAX || 5));
    });
  }

  function renderStats() {
    const now = performance.now();
    while (S.produceLog.length && now - S.produceLog[0] > 60000) S.produceLog.shift();
    document.getElementById('stat-rate').textContent = S.produceLog.length.toFixed(1);
    document.getElementById('stat-sales').textContent = Math.floor(S.soldValue).toLocaleString();
    document.getElementById('stat-cargo').textContent = S.cargo.length;
    document.getElementById('stat-wander').textContent = S.wanderers.length;
    document.getElementById('stat-build').textContent = S.buildings.length;
    document.getElementById('stat-demand').textContent = S.foodDemandPerMin.toFixed(0);
    document.getElementById('stat-unchi').textContent = S.unchiPerMin.toFixed(0);
    document.getElementById('stat-food').textContent = Math.floor(S.food);
    const jf = document.getElementById('stat-jisso-food'); if (jf) jf.textContent = Math.floor(S.jissoFood || 0);
    document.getElementById('stat-unchistock').textContent = Math.floor(S.unchi);
    renderInventoryStats();
    const soldSig = Object.keys(S.sold).filter(k => S.sold[k]).map(k => k + ':' + S.sold[k] + ':' + ((S.soldValueByType && S.soldValueByType[k]) || 0)).join('|');
    if (soldSig !== lastSoldSig) {
      lastSoldSig = soldSig;
      document.getElementById('sold-list').innerHTML = Object.keys(S.sold).filter(k => S.sold[k]).map(k => {
        const value = (S.soldValueByType && S.soldValueByType[k]) || 0;
        return `<div class="wh-item">${itemIcon(k, 'wh-icon')}<span class="wh-name">${k} ×${S.sold[k]}</span><b>💰${Math.floor(value).toLocaleString()}</b></div>`;
      }).join('') || '<div class="muted">판매 기록 없음</div>';
    }
  }
  function ownedMaterialCounts() {
    const counts = {};
    const add = (type, n) => {
      n = Math.floor(n || 0);
      if (n > 0) counts[type] = (counts[type] || 0) + n;
    };
    add('실장푸드', S.food);
    add('짓소산 푸드', S.jissoFood);
    add('우마이푸드', S.umaiFood);
    add('다이어트푸드', S.dietFood);
    add('운치', S.unchi);
    add('조미료', S.seasoning);
    Object.keys(S.warehouse || {}).forEach(k => add(k, S.warehouse[k] && S.warehouse[k].length));
    return counts;
  }
  function renderInventoryStats() {
    const el = document.getElementById('inventory-list'); if (!el) return;
    const counts = ownedMaterialCounts();
    const keys = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'ko'));
    const sig = keys.map(k => k + ':' + counts[k]).join('|');
    if (sig === lastInventorySig) return;
    lastInventorySig = sig;
    el.innerHTML = keys.map(k => `<div class="wh-item">${itemIcon(k, 'wh-icon')}<span class="wh-name">${k}</span><b>×${counts[k].toLocaleString()}</b></div>`).join('') || '<div class="muted">소지 물자 없음</div>';
  }

  function fmtTimer(sec) {
    sec = Math.max(0, Math.ceil(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function raidTimerText() {
    const untilUnlock = Math.max(0, (C.RAID_START || 0) - (S.playTime || 0));
    if (untilUnlock > 0) return '레이드 해금 ' + fmtTimer(untilUnlock);
    if (!S.raidIn || S.raidIn <= 0) return '다음 레이드 예약중';
    return '다음 레이드 ' + fmtTimer(S.raidIn);
  }
  function moneyUiPoint() {
    const game = document.getElementById('game'), money = document.getElementById('tb-money');
    if (!game || !money) return null;
    const gr = game.getBoundingClientRect(), mr = money.getBoundingClientRect();
    const sc = gr.width / C.GAME_W || 1;
    return { x: (mr.left + mr.width / 2 - gr.left) / sc, y: (mr.top + mr.height / 2 - gr.top) / sc };
  }
  function spawnMoneyUiParticles(delta) {
    const game = document.getElementById('game'), pt = moneyUiPoint();
    if (!game || !pt) return;
    const mag = Math.min(12, Math.max(4, Math.floor(Math.log10(Math.abs(delta) + 10) * 3)));
    for (let i = 0; i < mag; i++) {
      const el = document.createElement('div');
      el.className = 'coin-fx money-ui-fx' + (delta < 0 ? ' out' : '');
      const ang = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 38;
      const sx = pt.x + Math.cos(ang) * dist;
      const sy = pt.y + Math.sin(ang) * dist;
      el.style.setProperty('--sx', sx + 'px');
      el.style.setProperty('--sy', sy + 'px');
      el.style.setProperty('--tx', (pt.x + (Math.random() - 0.5) * 8) + 'px');
      el.style.setProperty('--ty', (pt.y + (Math.random() - 0.5) * 8) + 'px');
      el.style.animationDelay = (Math.random() * 0.08) + 's';
      game.appendChild(el);
      window.setTimeout(() => el.remove(), 780);
    }
  }
  // 사료분배기가 사용 중인 사료 종류의 재고를 상단에 아이콘+숫자로 표시
  function feedStock(type) {
    if (type === '운치') return S.unchi || 0;
    if (type === '짓소산 푸드') return S.jissoFood || 0;
    if (type === '우마이푸드') return S.umaiFood || 0;
    if (type === '다이어트푸드') return S.dietFood || 0;
    if (type === '실장푸드') return S.food || 0;
    return 0;
  }
  let lastFeedSig = '';
  function renderFeedStocks() {
    const el = document.getElementById('tb-feeds'); if (!el) return;
    const types = [];
    (S.buildings || []).forEach(b => { if (b.type === 'feeder' && b.feedType && types.indexOf(b.feedType) < 0) types.push(b.feedType); });
    const sig = types.join('|');
    if (sig !== lastFeedSig) {
      lastFeedSig = sig;
      el.innerHTML = types.map(t => `<span class="tb-ct" data-feed="${escAttr(t)}" title="${escAttr(t)} 재고">${productIcon(t, 'res-icon')}<b>0</b></span>`).join('');
    }
    types.forEach(t => { const s = el.querySelector(`[data-feed="${escAttr(t)}"] b`); if (s) s.textContent = Math.floor(feedStock(t)); });
  }
  // 우리 안 종류별 개체 수 집계
  function penCounts() {
    const c = { 성체실장: 0, 자실장: 0, 독라: 0, 새끼사육실장: 0, 사육실장: 0 };
    G.Pens.allPens().forEach(p => p.creatures.forEach(cr => { if (c[cr.type] != null) c[cr.type]++; }));
    return c;
  }
  function renderResearchQueueStrip() {
    const el = document.getElementById('research-queue-strip'); if (!el) return;
    const cur = S.currentResearch;
    const q = S.researchQueue || [];
    if (!cur && !q.length) { el.innerHTML = '<span class="rq-empty">연구 없음</span>'; return; }
    const queueText = q.length ? `<span class="rq-next">예약 ${q.length}</span>` : '';
    if (cur) {
      const need = cur.cost || 1;
      const pct = Math.min(100, Math.floor(((S.researchProgress || 0) / Math.max(1, need)) * 100));
      el.innerHTML = `<div class="rq-main" title="${escAttr(cur.name)} 진행 중">
        <span class="rq-name">연구: ${escAttr(cur.name)} Lv.${cur.targetLevel || ''}</span>
        <span class="rq-pct">${pct}% <button data-cancel-top-research="1" title="진행도 보존 후 취소">취소</button></span>
        <span class="rq-bar"><i style="width:${pct}%"></i></span>
        <span class="rq-num">${Math.floor(S.researchProgress || 0).toLocaleString()}/${need.toLocaleString()}</span>
        ${queueText}
      </div>`;
    } else {
      el.innerHTML = `<div class="rq-main idle"><span class="rq-name">대기 중</span>${queueText}</div>`;
    }
  }
  function renderTop() {
    const curMoney = Math.floor(S.money);
    if (lastMoney == null) lastMoney = curMoney;
    else if (curMoney !== lastMoney) {
      spawnMoneyUiParticles(curMoney - lastMoney);
      lastMoney = curMoney;
    }
    document.getElementById('tb-money').textContent = Math.floor(S.money).toLocaleString();
    const pw = document.getElementById('tb-power'); if (pw) pw.textContent = Math.floor(S.powerUsed || 0).toLocaleString() + '/' + Math.floor(S.power || 0).toLocaleString();
    // 우리 안 종류별 수(아이콘+숫자)
    const cnt = penCounts();
    const setCt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setCt('tb-c-adult', cnt.성체실장); setCt('tb-c-child', cnt.자실장); setCt('tb-c-dok', cnt.독라);
    setCt('tb-c-petchild', cnt.새끼사육실장); setCt('tb-c-pet', cnt.사육실장);
    if (G.Factory && G.Factory.laborStatus) { const ls = G.Factory.laborStatus(); setCt('tb-labor', ls.count + '/' + ls.limit); }
    renderFeedStocks();
    renderResearchQueueStrip();
    const rt = document.getElementById('raid-timer');
    if (rt) {
      rt.textContent = raidTimerText();
      rt.classList.toggle('armed', (S.playTime || 0) >= (C.RAID_START || 0));
    }
    renderOptions();
  }

  function afterStateLoad() {
    lastWhSig = ''; lastSoldSig = ''; lastPenSig = ''; lastJfSig = '';
    lastMoney = Math.floor(S.money);
    G.paused = false; updatePauseIndicator();
    closeOptions();
    const root = document.getElementById('overlay-root');
    if (root) root.style.display = 'none';
    document.querySelectorAll('.ovl-panel').forEach(p => p.classList.remove('active'));
    switchScreen(S.screen || 'factory');
    buildPriceEditor();
    renderOverlay();
    renderTop();
  }

  return { init, switchScreen, showCreatureInfo, hideInfo, renderOverlay, renderTop, flash, afterStateLoad };
})();
