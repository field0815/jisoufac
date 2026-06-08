/* =========================================================================
 * ui.js  —  상단바 / 베이스화면(공원·공장) / 오버레이(상점·연구·통계) / 치트
 * ========================================================================= */
window.G = window.G || {};

G.UI = (function () {
  const S = G.State;
  const C = G.CONFIG;
  const BASE = [{ id: 'park', label: '① 공원' }, { id: 'factory', label: '③ 공장' }];
  const OVL = [{ id: 'shop', label: '② 거래' }, { id: 'research', label: '④ 연구' }, { id: 'stats', label: '⑤ 통계' }];
  let lastWhSig = '', lastSoldSig = '', lastPenSig = '';   // 재고/판매/우리 목록 갱신 시그니처
  const PEN_SELL_TYPES = ['사육실장', '새끼사육실장', '독라', '새끼독라'];

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
      <div class="tb-res">🥩 사료 <span id="tb-food">0</span></div>
      <div class="tb-res">💩 운치 <span id="tb-unchi">0</span></div>
      <div class="tb-res">🧂 조미료 <span id="tb-seasoning">0</span></div>
      <div class="tb-res">🐾 성체 <span id="tb-adult">0</span></div>
      <div class="tb-res">🍼 새끼 <span id="tb-young">0</span></div>
      <div class="tb-tabs" id="tb-tabs"></div>
      <button class="tb-cheat" id="tb-cheat" title="치트">\`\`\`</button>`;
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
    document.getElementById('tb-cheat').addEventListener('click', doCheat);
  }

  function switchScreen(id) {
    if (id !== 'park' && id !== 'factory') return;
    S.screen = id;
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    const bt = document.getElementById('blueprint-tab'); if (bt) bt.style.display = (id === 'factory') ? 'block' : 'none'; // 청사진은 공장에서만
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
      if (e.key === '`' || e.code === 'Backquote') { e.preventDefault(); doCheat(); }
      else if (e.key === 'Escape' && S.overlay) closeOverlay();
    });
  }

  /* ---- 치트 ----------------------------------------------------------- */
  function doCheat() {
    S.money += C.CHEAT_MONEY;
    for (let i = 0; i < C.CHEAT_CREATURES; i++) {
      const c = G.Creatures.newAdult();
      G.Factory.dropToFactory(c);
    }
    G.Assets.playSfx('click');
    flash('치트! 💰+' + C.CHEAT_MONEY.toLocaleString() + ' / 성체 ' + C.CHEAT_CREATURES + '마리');
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
      const pct = Math.floor((c.growth || 0) / G.CONFIG.GROW_TIME * 100);
      growthRow = `<div class="ci-row"><span>성장</span><b>${pct}%</b></div>`;
    }
    const grd = c.stats ? G.Creatures.gradeOfStats(c.stats) : null;
    const gradeRow = grd ? `<div class="ci-row"><span>등급</span><b style="color:${grd.color}">${grd.label}</b></div>` : '';
    infoEl.innerHTML = `
      <div class="ci-head" style="border-color:${def.color}">#${c.id} · ${def.label}</div>
      ${gradeRow}
      <div class="ci-row"><span>육질</span><b>${Math.floor(c.stats.육질)}</b></div>
      <div class="ci-row"><span>개념</span><b>${Math.floor(c.stats.개념)}</b></div>
      <div class="ci-row"><span>크기</span><b>${Math.floor(c.stats.크기)}</b></div>${growthRow}`;
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
        <div class="stat-big">보유금 💰<b id="shop-money">0</b> · 사료 🥩<b id="shop-food">0</b></div>
        <h3>🥩 실장푸드 구매 (개당 ₩${C.FOOD_PRICE})</h3>
        <div class="shop-buy" id="shop-buy-food"></div>
        <h3>🧂 조미료 구매 (개당 💰<span id="shop-seasoning-price">0</span> · 1분마다 변동)</h3>
        <div class="shop-buy" id="shop-buy-seasoning"></div>
        <h3>🐾 실장석 구매</h3>
        <div class="shop-buy" id="shop-buy-cre"></div>
        <h3>🏠 우리 실장석 판매 <span class="muted">(사육실장=개념↑·크기↓ / 독라=육질·크기)</span></h3>
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
      b.innerHTML = `+${n}개<small>₩${(n * C.FOOD_PRICE).toLocaleString()}</small>`;
      b.addEventListener('click', () => buyFood(n));
      buyF.appendChild(b);
    });
    const buyS = document.getElementById('shop-buy-seasoning');
    [1, 10, 50].forEach(n => {
      const b = document.createElement('button');
      b.className = 'shop-btn'; b.dataset.season = n;
      b.innerHTML = `+${n}개<small>₩0</small>`;
      b.addEventListener('click', () => buySeasoning(n));
      buyS.appendChild(b);
    });
    const buyC = document.getElementById('shop-buy-cre');
    [['성체실장', C.BUY_ADULT], ['자실장', C.BUY_CHILD]].forEach(([t, cost]) => {
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.innerHTML = `${G.CREATURES[t].label}<small>₩${cost.toLocaleString()}</small>`;
      b.addEventListener('click', () => buyCreature(t, cost));
      buyC.appendChild(b);
    });
    // 자동판매 토글(생산품마다)
    const asWrap = document.getElementById('autosell-list');
    Object.keys(G.PRODUCTS).filter(p => G.PRODUCTS[p].isProduct).forEach(t => {
      const b = document.createElement('button');
      b.className = 'autosell-btn'; b.dataset.type = t; b.textContent = t;
      b.addEventListener('click', () => {
        S.autoSell[t] = !S.autoSell[t];
        if (S.autoSell[t]) G.Factory.sellSomeType(t, Infinity);   // 켜는 즉시 기존 재고 판매
        b.classList.toggle('on', !!S.autoSell[t]);
        G.Assets.playSfx('click');
      });
      asWrap.appendChild(b);
    });

    // ④ 연구소 — 공원 업그레이드
    document.getElementById('ovl-research').innerHTML = `
      <div class="ovl-head">④ 연구소 (공원 업그레이드) <button class="ovl-close">✕</button></div>
      <div class="ovl-body"><div class="research-grid" id="research-list"></div></div>`;
    const rlist = document.getElementById('research-list');
    G.UPGRADES.forEach(u => {
      const card = document.createElement('div');
      card.className = 'research-card'; card.dataset.key = u.key;
      card.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>
        <div class="rc-foot">Lv.<b class="rc-lv">0</b> <button class="rc-buy">₩${u.cost}</button></div>`;
      card.querySelector('.rc-buy').addEventListener('click', () => buyUpgrade(u));
      rlist.appendChild(card);
    });

    // ⑤ 통계 (판매는 거래탭으로 이동)
    document.getElementById('ovl-stats').innerHTML = `
      <div class="ovl-head">⑤ 통계 <button class="ovl-close">✕</button></div>
      <div class="ovl-body">
        <div class="stat-big">분당 판매 <b id="stat-rate">0.0</b> · 누적매출 💰<b id="stat-sales">0</b></div>
        <div class="stat-sub">화물 <span id="stat-cargo">0</span> · 배회 <span id="stat-wander">0</span> · 장치 <span id="stat-build">0</span>
          · 사료수요 <span id="stat-demand">0</span>/분 · 운치 <span id="stat-unchi">0</span>/분</div>
        <div class="stat-sub">자원 — 🥩 사료 <b id="stat-food">0</b> · 💩 운치 <b id="stat-unchistock">0</b></div>
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
    buildPriceEditor();
  }

  function buyFood(n) {
    const cost = n * C.FOOD_PRICE;
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.food += n; G.Assets.playSfx('click');
    flash('사료 +' + n + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buySeasoning(n) {
    const cost = n * Math.round(S.seasoningPrice || C.SEASONING_BASE);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.seasoning += n; G.Assets.playSfx('click');
    flash('조미료 +' + n + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buyCreature(type, cost) {
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    const c = G.Creatures.newWild(type);
    G.Factory.dropToFactory(c);
    S.money -= cost; G.Assets.playSfx('click');
    flash(G.CREATURES[type].label + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buyUpgrade(u) {
    const lv = S.upgrades[u.key] || 0;
    if (u.maxLevel && lv >= u.maxLevel) { flash('이미 연구 완료됨'); return; }
    const cost = u.costMult ? Math.round(u.cost * Math.pow(u.costMult, lv)) : u.cost * (lv + 1);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.upgrades[u.key] = lv + 1; G.Assets.playSfx('click');
    flash(u.name + (u.maxLevel === 1 ? ' 연구 완료' : ' Lv.' + (lv + 1)) + ' (💰-' + cost.toLocaleString() + ')');
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
      const g = groups[t]; const col = (G.CREATURES[t] && G.CREATURES[t].color) || '#888';
      const unit = Math.round(g.val / g.n);
      const label = { 사육실장: '사육실장 성체', 새끼사육실장: '사육실장 새끼', 독라: '독라 성체', 새끼독라: '독라 새끼' }[t] || t;
      return `<div class="wh-item"><span class="wh-dot" style="background:${col}"></span><span class="wh-name">${label} ×${g.n} <small class="unit">개당 💰${unit.toLocaleString()}</small></span><b>💰${g.val.toLocaleString()}</b>
        <span class="sell-mini"><button data-pensell="1" data-type="${t}">1</button><button data-pensell="10" data-type="${t}">10</button><button data-pensell="100" data-type="${t}">100</button><button data-pensell="all" data-type="${t}">전부</button></span></div>`;
    }).join('');
    document.getElementById('pen-sell-list').innerHTML = rows || '<div class="muted">우리에 판매할 사육실장/독라 없음</div>';
  }

  function renderShop() {
    document.getElementById('shop-food').textContent = Math.floor(S.food);
    document.getElementById('shop-money').textContent = Math.floor(S.money).toLocaleString();
    const sp = Math.round(S.seasoningPrice || C.SEASONING_BASE);
    document.getElementById('shop-seasoning-price').textContent = sp.toLocaleString();
    document.querySelectorAll('#shop-buy-seasoning .shop-btn').forEach(b => {
      const n = +b.dataset.season;
      b.querySelector('small').textContent = '₩' + (n * sp).toLocaleString();
    });
    renderPenSell();
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
        const col = (G.PRODUCTS[k] && G.PRODUCTS[k].color) || (G.CREATURES[k] && G.CREATURES[k].color) || '#888';
        return `<div class="wh-item"><span class="wh-dot" style="background:${col}"></span><span class="wh-name">${k} ×${list.length} <small class="unit">개당 💰${unit.toLocaleString()}</small></span><b>💰${val.toLocaleString()}</b>
          <span class="sell-mini"><button data-sell="1" data-type="${k}">1</button><button data-sell="10" data-type="${k}">10</button><button data-sell="100" data-type="${k}">100</button><button data-sell="all" data-type="${k}">전부</button></span></div>`;
      }).join('');
      document.getElementById('warehouse-list').innerHTML = whHtml || '<div class="muted">재고 없음 (도축기 등으로 생산)</div>';
    }
  }

  function renderResearch() {
    document.querySelectorAll('#research-list .research-card').forEach(card => {
      const u = G.UPGRADES.find(x => x.key === card.dataset.key); if (!u) return;
      const lv = S.upgrades[u.key] || 0; const cost = u.costMult ? Math.round(u.cost * Math.pow(u.costMult, lv)) : u.cost * (lv + 1);
      card.querySelector('.rc-lv').textContent = lv;
      const done = u.maxLevel && lv >= u.maxLevel;
      const btn = card.querySelector('.rc-buy'); btn.textContent = done ? '완료' : '₩' + cost.toLocaleString();
      btn.classList.toggle('owned', !!done);
      btn.classList.toggle('afford', !done && S.money >= cost);
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
    document.getElementById('stat-unchistock').textContent = Math.floor(S.unchi);
    const soldSig = Object.keys(S.sold).filter(k => S.sold[k]).map(k => k + ':' + S.sold[k]).join('|');
    if (soldSig !== lastSoldSig) {
      lastSoldSig = soldSig;
      document.getElementById('sold-list').innerHTML = Object.keys(S.sold).filter(k => S.sold[k]).map(k => {
        const col = (G.PRODUCTS[k] && G.PRODUCTS[k].color) || (G.CREATURES[k] && G.CREATURES[k].color) || '#888';
        return `<div class="wh-item"><span class="wh-dot" style="background:${col}"></span><span class="wh-name">${k}</span><b>${S.sold[k]}</b></div>`;
      }).join('') || '<div class="muted">판매 기록 없음</div>';
    }
  }

  function renderTop() {
    document.getElementById('tb-money').textContent = Math.floor(S.money).toLocaleString();
    document.getElementById('tb-food').textContent = Math.floor(S.food);
    document.getElementById('tb-unchi').textContent = Math.floor(S.unchi);
    document.getElementById('tb-seasoning').textContent = Math.floor(S.seasoning);
    document.getElementById('tb-adult').textContent = G.Pens.totalAdults();
    document.getElementById('tb-young').textContent = G.Pens.totalYoung();
  }

  return { init, switchScreen, showCreatureInfo, hideInfo, renderOverlay, renderTop, flash };
})();
