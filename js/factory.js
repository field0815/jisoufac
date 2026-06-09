/* =========================================================================
 * factory.js  —  공장 (메인): 그리드/설치/시뮬레이션
 *  - 벨트: 클릭 연장 / 드래그 경로대로 좌우 꺾임
 *  - 건물: 드래그 영역선택, 클릭 선택, 더블클릭 동종선택, Delete 삭제(회수), M 이동
 *  - 고스트 중앙 정렬 / 신규 가공기 / 창고 즉시판매
 * ========================================================================= */
window.G = window.G || {};

G.Factory = (function () {
  const C = G.CONFIG;
  const S = G.State;
  const DIR = G.DIR;
  const CELL = C.CELL, COLS = C.GRID_COLS, ROWS = C.GRID_ROWS;
  const COLLIDE = 10 / CELL;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let canvas, ctx, menuEl;
  let currentTool = null;
  let ghostDir = 1;
  let mouseCell = null;
  let mouseGX = 0, mouseGY = 0;   // 마우스 격자 소수 좌표(벽 경계 판정용)
  let dropHoverId = null;

  // 카메라(대형 필드 뷰포트). x,y=월드픽셀 좌상단, zoom=배율
  const cam = { x: 0, y: 0, zoom: 1 };
  let panning = false, panStart = null;
  const moveKeys = { w: false, a: false, s: false, d: false };

  // Undo 스택(스냅샷)
  const undoStack = [];
  // 복사/청사진
  let pasteMode = false, pasteClip = null;
  const blueprints = {};   // 숫자키 → 클립 배열

  // 벽(경계) 그리기 모드
  let wallDragging = false, wallErase = false;
  let wallStartPoint = null, wallEndPoint = null;
  let wallSelection = [];

  // 벨트 드래그
  let beltDragging = false, beltPath = [];
  // 우리(펜) 드래그 배치
  let penDragStart = null;
  // 호버 중인 건물(R 회전용)
  let hoverBuilding = null;
  // 영역 선택
  let pendingSelect = false, selDragging = false, selStartCell = null, selDownClient = null;
  // 이동 모드
  let moveMode = false, moving = [];
  // 필터 패널 대상(단일 선택된 분류기/집게)
  let filterTarget = null;
  let filterPanelSuppressedKey = '';
  let penTarget = null;   // 이름 패널 대상(단일 선택된 우리)
  let birthTarget = null; // 출산대 정보 패널 대상
  let selectedPenCreature = null;
  let landPromptEl = null;
  let deviceInfoEl = null;
  let deviceInfoAnchor = null;
  const FILTER_TYPES = Array.from(new Set(Object.keys(G.CREATURES).concat(Object.keys(G.PRODUCTS))));
  const FILTER_LABEL = { 사육실장: '사육실장 성체', 새끼사육실장: '사육실장 새끼', 독라: '독라 성체', 새끼독라: '독라 새끼' };
  const SORTER_BUF = 4;   // 분류기 내부 버퍼 용량

  const occ = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const beltGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  /* ---- 초기화 / DOM ---------------------------------------------------- */
  function init() {
    const screen = document.getElementById('screen-factory');
    screen.innerHTML = `
      <div id="factory-canvas-wrap">
        <canvas id="factory-canvas" width="${C.VIEW_W}" height="${C.VIEW_H}"></canvas>
      </div>
      <div id="factory-menu"></div>`;
    canvas = document.getElementById('factory-canvas');
    ctx = canvas.getContext('2d');
    centerCamera();
    menuEl = document.getElementById('factory-menu');
    buildMenu();
    bindCanvas();
    bindKeys();
    buildFilterPanel();
    buildPenPanel();
    buildBirthingPanel();
    buildBlueprintTab();
    if (!S.buildings.length) setupStart();
  }
  function buildPenPanel() {
    const pp = document.createElement('div');
    pp.id = 'pen-panel'; pp.style.display = 'none';
    pp.innerHTML = `<div class="fp-title">우리 이름</div><input id="pen-name-input" type="text" maxlength="16" placeholder="우리 이름">
      <button class="pen-nosell" id="pen-nosell">판매금지</button>`;
    document.getElementById('game').appendChild(pp);
    pp.querySelector('#pen-name-input').addEventListener('input', (e) => { if (penTarget) penTarget.name = e.target.value; });
    pp.querySelector('#pen-nosell').addEventListener('click', () => { if (penTarget) { penTarget.noSell = !penTarget.noSell; G.Assets.playSfx('click'); } });
  }
  function updatePenPanel() {
    const pp = document.getElementById('pen-panel'); if (!pp) return;
    const one = (S.selection.length === 1) ? S.buildings.find(b => b.id === S.selection[0]) : null;
    penTarget = (one && one.type === 'penbox') ? one : null;
    if (!penTarget || S.overlay || S.screen !== 'factory') { pp.style.display = 'none'; return; }
    pp.style.display = 'block';
    pp.style.left = clamp(worldToGameX((penTarget.col + penTarget.w) * CELL) + 6, 4, C.GAME_W - 180) + 'px';
    pp.style.top = clamp(worldToGameY(penTarget.row * CELL), 46, C.GAME_H - 90) + 'px';
    const inp = pp.querySelector('#pen-name-input');
    if (document.activeElement !== inp) inp.value = penTarget.name || '';
    const ns = pp.querySelector('#pen-nosell');
    ns.classList.toggle('on', !!penTarget.noSell);
    ns.textContent = penTarget.noSell ? '판매금지 (해제하려면 클릭)' : '판매금지';
    repositionDeviceInfo();
  }

  /* ---- 출산대 정보 패널 ----------------------------------------------- */
  function buildBirthingPanel() {
    const bp = document.createElement('div');
    bp.id = 'birthing-panel'; bp.className = 'info-panel'; bp.style.display = 'none';
    bp.innerHTML = `<div class="fp-title">출산대</div><div class="bp-body" id="bp-body"></div>
      <button class="bp-remove" id="bp-remove">장착 개체 제거(→실장육)</button>`;
    document.getElementById('game').appendChild(bp);
    bp.querySelector('#bp-remove').addEventListener('click', () => {
      const b = birthTarget; if (!b || !b.worker) return;
      const prod = G.Creatures.makeProduct('실장육', b.worker);
      if (!emitAtCell(outputCell(b), prod)) S.cargo.push(makeCargo(prod, b.col, b.row));
      b.worker = null; b.lifeTimer = 0; b.birthTimer = 0; b.state = 'idle';
      G.Assets.playSfx('sell');
    });
  }

  function showLandPrompt(cell, clientX, clientY) {
    if (isOwnedCell(cell.col, cell.row)) return false;
    const key = landKeyForCell(cell.col, cell.row);
    if (!landPromptEl) {
      landPromptEl = document.createElement('div');
      landPromptEl.id = 'land-prompt';
      document.getElementById('game').appendChild(landPromptEl);
    }
    const cost = landCost();
    const parts = key.split('|');
    landPromptEl.innerHTML = `
      <div class="lp-title">외부 그리드 구매</div>
      <div class="lp-body">40×40칸 구역 (${parts[0]}, ${parts[1]})</div>
      <div class="lp-price">₩${cost.toLocaleString()}</div>
      <div class="lp-actions"><button data-buy="1">구매</button><button data-buy="0">취소</button></div>`;
    landPromptEl.querySelector('[data-buy="1"]').onclick = () => buyLand(key);
    landPromptEl.querySelector('[data-buy="0"]').onclick = hideLandPrompt;
    positionMiniPanel(landPromptEl, clientX, clientY);
    landPromptEl.style.display = 'block';
    return true;
  }
  function hideLandPrompt() { if (landPromptEl) landPromptEl.style.display = 'none'; }
  function buyLand(key) {
    const cost = landCost();
    if (S.money < cost) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost;
    S.ownedLand[key] = true;
    S.landBought = (S.landBought || 0) + 1;
    hideLandPrompt();
    G.Assets.playSfx('place');
    G.UI.flash && G.UI.flash('외부 그리드 구매 완료 ₩-' + cost.toLocaleString());
  }
  function updateBirthingPanel() {
    const bp = document.getElementById('birthing-panel'); if (!bp) return;
    const one = (S.selection.length === 1) ? S.buildings.find(b => b.id === S.selection[0]) : null;
    birthTarget = (one && one.type === 'birthing') ? one : null;
    if (!birthTarget || S.overlay || S.screen !== 'factory') { bp.style.display = 'none'; return; }
    bp.style.display = 'block';
    bp.style.left = clamp(worldToGameX((birthTarget.col + birthTarget.w) * CELL) + 6, 4, C.GAME_W - 196) + 'px';
    bp.style.top = clamp(worldToGameY(birthTarget.row * CELL), 46, C.GAME_H - 150) + 'px';
    const w = birthTarget.worker;
    const body = bp.querySelector('#bp-body');
    if (w) {
      const left = Math.max(0, C.BIRTH_LIFESPAN - (birthTarget.lifeTimer || 0));
      const def = G.CREATURES[w.type];
      body.innerHTML = `<div class="bp-row"><span>장착</span><b>${def ? def.label : w.type}</b></div>
        <div class="bp-row"><span>육질/개념/크기</span><b>${w.stats.육질}/${w.stats.개념}/${w.stats.크기}</b></div>
        <div class="bp-row"><span>남은 수명</span><b>${left.toFixed(0)}s</b></div>
        <div class="bp-row"><span>출산 수</span><b>${birthTarget.births || 0}</b></div>`;
      bp.querySelector('#bp-remove').style.display = 'block';
    } else {
      body.innerHTML = `<div class="muted">성체 실장석을 투입하세요.</div>`;
      bp.querySelector('#bp-remove').style.display = 'none';
    }
    repositionDeviceInfo();
  }

  // 게임 시작: 필드 정중앙 3x3 우리 + 성체 5마리
  function setupStart() {
    const col = Math.floor(COLS / 2) - 1, row = Math.floor(ROWS / 2) - 1; // 중앙 3x3
    const pen = makePen(col, row, 3, 3, { free: true });
    if (pen) for (let i = 0; i < 5; i++) G.Pens.addToPen(pen, G.Creatures.newAdult());
  }
  function makePen(col, row, w, h, opts) {
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      if (!isOwnedCell(col + dc, row + dr) || occ[row + dr][col + dc] || hasBelt(col + dc, row + dr)) return null;
    }
    const cost = buildCost('penbox', w, h);
    if (!(opts && opts.free) && !spend(cost)) return null;
    const b = { id: G.uid(), type: 'penbox', col, row, w, h, dir: 1, name: (++S.penSeq) + '번 우리', creatures: [], cost: (opts && opts.free) ? 0 : cost };
    attach(b);
    return b;
  }
  // 기존 우리를 드래그 영역까지 확장
  function expandPen(pen, c2, r2, w2, h2) {
    const minC = Math.min(pen.col, c2), minR = Math.min(pen.row, r2);
    const maxC = Math.max(pen.col + pen.w - 1, c2 + w2 - 1), maxR = Math.max(pen.row + pen.h - 1, r2 + h2 - 1);
    for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) {
      const inPen = c >= pen.col && c < pen.col + pen.w && r >= pen.row && r < pen.row + pen.h;
      if (inPen) continue;
      if (!isOwnedCell(c, r) || occAt(c, r) || hasBelt(c, r)) return false; // 다른 것에 막힘
    }
    const oldCells = pen.w * pen.h, newCells = (maxC - minC + 1) * (maxR - minR + 1);
    const addCost = Math.max(0, newCells - oldCells) * (G.BUILD_COST.penboxCell || 0);
    if (!spend(addCost)) return false;
    const dCol = pen.col - minC, dRow = pen.row - minR;
    detach(pen);
    pen.creatures.forEach(cr => { cr.px = (cr.px || 0.5) + dCol; cr.py = (cr.py || 0.5) + dRow; });
    pen.col = minC; pen.row = minR; pen.w = maxC - minC + 1; pen.h = maxR - minR + 1;
    pen.cost = (pen.cost || 0) + addCost;
    attach(pen);
    return true;
  }

  /* ---- 필터 패널 (분류기/집게 선택 시) ------------------------------- */
  function buildFilterPanel() {
    const fp = document.createElement('div');
    fp.id = 'filter-panel'; fp.style.display = 'none';
    fp.innerHTML = `<div class="fp-title">필터</div><div class="fp-hint">품목 선택(없으면 전체)</div><div class="fp-btns"></div>
      <div class="fp-stat" id="fp-stat"><span>스탯 조건</span>
        <div class="fp-stat-row">
          <button class="fp-st" data-stat="">없음</button>
          <button class="fp-st" data-stat="육질">육질</button>
          <button class="fp-st" data-stat="개념">개념</button>
          <button class="fp-st" data-stat="크기">크기</button>
        </div>
        <div class="fp-stat-row">
          <button class="fp-op" data-op=">=">이상</button>
          <button class="fp-op" data-op="<=">이하</button>
          <input type="number" id="fp-statval" value="50" min="1" max="200">
        </div></div>
      <div class="fp-lane" id="fp-lane"><span>일치 화물 출력칸</span>
        <button class="fp-lane-btn" data-lane="1">1번칸</button>
        <button class="fp-lane-btn" data-lane="2">2번칸</button></div>`;
    document.getElementById('game').appendChild(fp);
    fp.querySelectorAll('.fp-lane-btn').forEach(btn => {
      btn.addEventListener('click', () => { if (filterTarget) { filterTarget.filterLane = +btn.dataset.lane; G.Assets.playSfx('click'); } });
    });
    fp.querySelectorAll('.fp-st').forEach(btn => btn.addEventListener('click', () => {
      if (!filterTarget) return;
      const s = btn.dataset.stat;
      if (!s) filterTarget.statFilter = null;
      else if (!filterTarget.statFilter) filterTarget.statFilter = { stat: s, op: '>=', value: parseInt(fp.querySelector('#fp-statval').value, 10) || 50 };
      else filterTarget.statFilter.stat = s;
      G.Assets.playSfx('click');
    }));
    fp.querySelectorAll('.fp-op').forEach(btn => btn.addEventListener('click', () => {
      if (filterTarget && filterTarget.statFilter) { filterTarget.statFilter.op = btn.dataset.op; G.Assets.playSfx('click'); }
    }));
    fp.querySelector('#fp-statval').addEventListener('change', () => {
      if (filterTarget && filterTarget.statFilter) { const v = parseInt(fp.querySelector('#fp-statval').value, 10); if (!isNaN(v)) filterTarget.statFilter.value = v; }
    });
    const btns = fp.querySelector('.fp-btns');
    FILTER_TYPES.forEach(t => {
      const color = (G.CREATURES[t] && G.CREATURES[t].color) || (G.PRODUCTS[t] && G.PRODUCTS[t].color) || '#888';
      const b = document.createElement('button');
      b.className = 'fp-btn'; b.dataset.type = t;
      b.innerHTML = `<span class="fp-dot" style="background:${color}"></span>${FILTER_LABEL[t] || t}`;
      b.addEventListener('click', () => {
        if (!filterTarget) return;
        if (!filterTarget.filter) filterTarget.filter = [];
        const i = filterTarget.filter.indexOf(t);
        if (i >= 0) filterTarget.filter.splice(i, 1); else filterTarget.filter.push(t);
        G.Assets.playSfx('click');
      });
      btns.appendChild(b);
    });
  }
  function updateFilterPanel() {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    const one = (S.selection.length === 1) ? S.buildings.find(b => b.id === S.selection[0]) : null;
    const selKey = S.selection.join('|');
    filterTarget = (one && (one.type === 'sorter' || one.type === 'grabber' || one.type === 'catcher')) ? one : null;
    if (!filterTarget || S.overlay || S.screen !== 'factory' || filterPanelSuppressedKey === selKey) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    panel.querySelector('.fp-title').textContent = (G.DEVICES[filterTarget.type].name) + ' 필터';
    // 위치: 장치 오른쪽. 화면 아래 1/3 지점이면 위쪽으로 펼침(바닥 넘침 방지)
    const left = worldToGameX((filterTarget.col + filterTarget.w) * CELL) + 6;
    const anchorTop = worldToGameY(filterTarget.row * CELL);
    const ph = panel.offsetHeight || 280;
    let top = anchorTop;
    if (anchorTop > C.GAME_H / 3) top = Math.max(46, worldToGameY((filterTarget.row + filterTarget.h) * CELL) - ph); // 위로 펼침
    top = Math.min(top, C.GAME_H - ph - 4);
    panel.style.left = clamp(left, 4, C.GAME_W - 230) + 'px';
    panel.style.top = Math.max(46, top) + 'px';
    if (deviceInfoEl && deviceInfoEl.style.display !== 'none' && deviceInfoAnchor) {
      positionMiniPanel(deviceInfoEl, deviceInfoAnchor.x, deviceInfoAnchor.y, avoidInfoPanels(deviceInfoEl));
    }
    const f = filterTarget.filter || [];
    panel.querySelectorAll('.fp-btn').forEach(btn => btn.classList.toggle('active', f.includes(btn.dataset.type)));
    const sf = filterTarget.statFilter;
    panel.querySelectorAll('.fp-st').forEach(btn => btn.classList.toggle('active', (sf ? sf.stat : '') === btn.dataset.stat));
    panel.querySelectorAll('.fp-op').forEach(btn => btn.classList.toggle('active', !!sf && sf.op === btn.dataset.op));
    const valInput = panel.querySelector('#fp-statval');
    if (sf && document.activeElement !== valInput) valInput.value = sf.value;
    const laneRow = panel.querySelector('#fp-lane');
    if (filterTarget.type === 'sorter') {
      laneRow.style.display = 'flex';
      laneRow.querySelectorAll('.fp-lane-btn').forEach(btn => btn.classList.toggle('active', +btn.dataset.lane === (filterTarget.filterLane || 1)));
    } else laneRow.style.display = 'none';
  }

  /* ---- 하단 메뉴 ------------------------------------------------------- */
  let activeCat = 'logistics';
  const hotkeys = {};          // 숫자키('1'~'9','0') → 도구 type
  let hoveredMenuType = null;  // 마우스 올린 메뉴 항목
  function buildMenu() {
    menuEl.innerHTML = `
      <div class="menu-hotkeys" id="menu-hotkeys"></div>
      <div class="menu-cats" id="menu-cats"></div>
      <div class="menu-items" id="menu-items"></div>
      <div class="menu-status" id="menu-status">장치 선택 · 빈손: 드래그=영역선택, 클릭=선택, 더블클릭=동종선택, Del=삭제, M=이동 · 메뉴에 올리고 숫자키=단축키 지정</div>`;
    const catRow = document.getElementById('menu-cats');
    Object.keys(G.MENU).forEach(cat => {
      const b = document.createElement('button');
      b.className = 'cat-btn'; b.textContent = G.MENU[cat].label; b.dataset.cat = cat;
      b.addEventListener('click', () => { activeCat = cat; renderMenuItems(); highlightCat(); });
      catRow.appendChild(b);
    });
    renderMenuItems(); highlightCat();
  }
  function highlightCat() {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === activeCat));
  }
  function renderMenuItems() {
    const wrap = document.getElementById('menu-items');
    wrap.innerHTML = '';
    const items = G.MENU[activeCat].items.filter(type => {
      const def = G.DEVICES[type];
      return def && isUnlocked(type);
    });
    if (!items.length) { wrap.innerHTML = '<div class="menu-empty">추후 추가 예정</div>'; return; }
    items.forEach(type => {
      const def = G.DEVICES[type];
      const b = document.createElement('button');
      b.className = 'item-btn'; b.dataset.type = type;
      const rec = G.Assets.deviceImg(type);
      const thumb = (rec && rec.ok)
        ? `<span class="item-thumb" style="background-image:url(${rec.img.src});background-size:400% 100%;background-position:0 0"></span>`
        : `<span class="item-thumb" style="background:${def.color}"></span>`;
      b.innerHTML = `${thumb}<span class="item-name">${def.name} <small>${def.w}×${def.h}</small><small>${costLabel(type)}</small></span><span class="item-hk"></span>`;
      b.addEventListener('click', (e) => { selectTool(type); showDeviceInfoForType(type, e.clientX, e.clientY); });
      b.addEventListener('mouseenter', () => { hoveredMenuType = type; });
      b.addEventListener('mouseleave', () => { if (hoveredMenuType === type) hoveredMenuType = null; });
      wrap.appendChild(b);
    });
    refreshHotkeyBadges();
  }
  function typeForKey(k) { return hotkeys[k]; }
  function refreshHotkeyBadges() {
    const rev = {}; Object.keys(hotkeys).forEach(d => { rev[hotkeys[d]] = d; });
    document.querySelectorAll('.item-btn').forEach(b => { const hk = b.querySelector('.item-hk'); if (hk) hk.textContent = rev[b.dataset.type] || ''; });
    renderHotkeyBar();
  }
  function renderHotkeyBar() {
    const bar = document.getElementById('menu-hotkeys'); if (!bar) return;
    const order = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].filter(d => hotkeys[d]);
    if (!order.length) { bar.innerHTML = '<span class="hk-hint">단축키 미지정 — 메뉴 항목에 마우스를 올리고 1~0 키를 누르세요</span>'; return; }
    bar.innerHTML = order.map(d => { const t = hotkeys[d]; const def = G.DEVICES[t]; return `<button class="hk-chip" data-type="${t}"><b>${d}</b> ${def ? def.name : t}</button>`; }).join('');
    bar.querySelectorAll('.hk-chip').forEach(c => c.addEventListener('click', () => selectTool(c.dataset.type)));
  }
  function assignHotkey(k, type) {
    Object.keys(hotkeys).forEach(d => { if (hotkeys[d] === type) delete hotkeys[d]; }); // 타입당 1개
    hotkeys[k] = type;
    refreshHotkeyBadges();
    G.Assets.playSfx('click');
  }
  function selectTool(type) {
    if (!isUnlocked(type)) {
      const def = G.DEVICES[type];
      G.UI.flash && G.UI.flash((def ? def.name : type) + ' 연구가 필요합니다.');
      return;
    }
    closeAuxPanels();
    cancelMove();
    const cat = G.DEVICES[type] && G.DEVICES[type].cat;
    if (cat && cat !== activeCat) { activeCat = cat; renderMenuItems(); highlightCat(); }  // 해당 탭으로 전환
    currentTool = type; ghostDir = 1; S.selection = []; selectedPenCreature = null;
    G.Assets.playSfx('click');
    document.querySelectorAll('.item-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    setStatus(`설치 중: <b>${G.DEVICES[type].name}</b> (R=회전, 우클릭=취소, 좌클릭=설치)`);
  }
  function cancelTool() {
    closeAuxPanels();
    currentTool = null; beltDragging = false; beltPath = []; wallDragging = false; wallStartPoint = null; wallEndPoint = null;
    document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
    setStatus('장치 선택 · 빈손: 드래그=영역선택, 클릭=선택, 더블클릭=동종선택, Del=삭제, M=이동');
  }
  function setStatus(html) { const s = document.getElementById('menu-status'); if (s) s.innerHTML = html; }
  function buildCost(type, w, h) {
    if (type === 'penbox') return (w || 1) * (h || 1) * (G.BUILD_COST.penboxCell || 0);
    return (G.BUILD_COST && G.BUILD_COST[type]) || 0;
  }
  function costLabel(type) {
    if (type === 'penbox') return '₩' + (G.BUILD_COST.penboxCell || 0).toLocaleString() + '/칸';
    if (type === 'wall') return '₩' + (G.BUILD_COST.wall || 0).toLocaleString() + '/칸';
    const c = buildCost(type);
    return c ? '₩' + c.toLocaleString() : '';
  }
  function spend(cost) {
    if (!cost) return true;
    if (S.money < cost) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return false; }
    S.money -= cost;
    return true;
  }
  function refund(cost) {
    if (cost > 0) S.money += cost;
  }
  function isUnlocked(type) {
    const def = G.DEVICES[type];
    return !!(def && (!def.unlock || (S.upgrades && S.upgrades[def.unlock])));
  }

  function ensureDeviceInfo() {
    if (deviceInfoEl) return deviceInfoEl;
    deviceInfoEl = document.createElement('div');
    deviceInfoEl.id = 'device-info';
    document.getElementById('game').appendChild(deviceInfoEl);
    document.addEventListener('mousedown', (e) => {
      if (deviceInfoEl && deviceInfoEl.style.display !== 'none' && !deviceInfoEl.contains(e.target) && !e.target.closest('.item-btn')) hideDeviceInfo();
    });
    return deviceInfoEl;
  }
  function showDeviceInfoForType(type, clientX, clientY, b) {
    const def = G.DEVICES[type]; if (!def) return;
    const el = ensureDeviceInfo();
    const rot = def.rotatable ? '<span>회전 가능</span>' : '';
    const range = def.range ? `<span>범위 ${def.range.w}×${def.range.h}</span>` : '';
    const workers = def.worker ? `<span>일꾼 ${C.WORKER_SLOTS}칸</span>` : '';
    const state = b ? deviceStateLine(b) : '';
    const details = b ? deviceInfoDetails(b) : deviceTypeDetails(type);
    el.innerHTML = `
      <div class="di-head"><b>${def.name}</b><button class="di-close">×</button></div>
      <div class="di-meta"><span>${def.w}×${def.h}</span>${rot}${range}${workers}</div>
      <div class="di-desc">${def.desc || ''}</div>${state}${details}`;
    el.querySelector('.di-close').onclick = hideDeviceInfo;
    el.style.display = 'block';
    deviceInfoAnchor = { x: clientX, y: clientY };
    positionMiniPanel(el, clientX, clientY, avoidInfoPanels(el));
  }
  function showDeviceInfoForBuilding(b, clientX, clientY) { if (b) showDeviceInfoForType(b.type, clientX, clientY, b); }
  function hideDeviceInfo() { if (deviceInfoEl) deviceInfoEl.style.display = 'none'; deviceInfoAnchor = null; }
  function repositionDeviceInfo() {
    if (deviceInfoEl && deviceInfoEl.style.display !== 'none' && deviceInfoAnchor) {
      positionMiniPanel(deviceInfoEl, deviceInfoAnchor.x, deviceInfoAnchor.y, avoidInfoPanels(deviceInfoEl));
    }
  }
  function avoidInfoPanels(self) {
    return ['filter-panel', 'pen-panel', 'birthing-panel', 'land-prompt']
      .map(id => document.getElementById(id))
      .filter(el => el && el !== self && el.style.display !== 'none');
  }
  function closeAuxPanels() {
    hideDeviceInfo();
    if (landPromptEl) landPromptEl.style.display = 'none';
    const panel = document.getElementById('filter-panel');
    if (panel) panel.style.display = 'none';
    filterPanelSuppressedKey = S.selection.join('|');
  }
  function allowAuxPanels() { filterPanelSuppressedKey = ''; }
  function deviceStateLine(b) {
    if (b.type === 'penbox') return `<div class="di-state">이름: ${b.name || '우리'} · 수용 ${b.creatures ? b.creatures.length : 0}마리</div>`;
    if (b.type === 'warehouse') return '<div class="di-state">창고 재고는 거래창에서 판매합니다.</div>';
    if (b.type === 'correction') {
      const t = b.teacher && b.teacher.stats ? Math.floor(b.teacher.stats.개념 || 0) : null;
      return `<div class="di-state">교사 ${t == null ? '없음' : '개념 ' + t + '%'} · 수용 ${b.inmates ? b.inmates.length : 0}/${G.DEVICES.correction.hold}</div>`;
    }
    if (b.type === 'sorter' || b.type === 'grabber' || b.type === 'catcher') {
      const n = b.filter ? b.filter.length : 0;
      return `<div class="di-state">필터 ${n ? n + '종 선택됨' : '전체 통과'}</div>`;
    }
    return '';
  }
  function infoRows(rows) {
    return '<div class="di-extra">' + rows.filter(Boolean).map(r => `<div class="di-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + '</div>';
  }
  function itemLabel(data) { return data ? (FILTER_LABEL[data.type] || (G.CREATURES[data.type] && G.CREATURES[data.type].label) || data.type) : '없음'; }
  function listText(list) { return list && list.length ? list.join(', ') : '없음'; }
  function progressText(n, total) {
    if (!total) return '대기';
    return Math.floor(clamp(n || 0, 0, total) / total * 100) + '%';
  }
  function deviceTypeDetails(type) {
    const def = G.DEVICES[type]; if (!def) return '';
    if (type === 'belt' || type === 'guardbelt') return infoRows([['기능', '화물 운반'], ['출력', '방향 화살표']]);
    if (type === 'sorter') return infoRows([['기능', '필터 조건에 따라 2칸 분류'], ['필터 없음', '1번/2번 교대 출력']]);
    if (type === 'grabber') return infoRows([['기능', '□에서 집어 △에 놓음'], ['필터', '품목/스탯 조건']]);
    if (type === 'warehouse') return infoRows([['기능', '화물 저장'], ['판매', '거래창에서 판매']]);
    if (type === 'penbox') return infoRows([['기능', '실장석 사육'], ['수용', `1칸당 성체${C.PEN_ADULT_PER_CELL}/새끼${C.PEN_YOUNG_PER_CELL}`]]);
    if (type === 'birthing') return infoRows([['필요', '성체 실장석'], ['산출', '점액덩어리']]);
    if (type === 'washbasin') return infoRows([['필요', '점액덩어리'], ['산출', '구더기/엄지/자실장']]);
    if (type === 'slaughter') return infoRows([['필요', '독라/새끼독라'], ['산출', '실장육']]);
    if (type === 'deshell') return infoRows([['필요', '실장석/사육실장 계열'], ['산출', '독라 계열']]);
    if (type === 'grinder') return infoRows([['필요', '실장석류/실장육'], ['산출', '분쇄육']]);
    if (type === 'correction') return infoRows([['필요', '자실장/성체실장'], ['산출', '사육실장 계열 또는 실장육']]);
    if (type === 'mixer') return infoRows([['필요', `분쇄육1 + 운치${C.MIX_UNCHI}`], ['산출', `실장푸드${C.MIX_FOOD}`]]);
    if (type === 'cookery') return infoRows([['필요', '재료 + 조미료'], ['산출', '요리 생산품']]);
    if (type === 'tunnel' || type === 'crossbelt') return infoRows([['기능', '입구에서 출구로 순간이동'], ['중간', '건설 가능']]);
    if (type === 'packer') return infoRows([['기능', '판매 가능 물자 즉시 판매'], ['저장', '하지 않음']]);
    return infoRows([['기능', def.desc || '']]);
  }
  function deviceInfoDetails(b) {
    const def = G.DEVICES[b.type]; if (!def) return '';
    if (b.type === 'penbox') return infoRows([
      ['기능', '실장석 사육/성장'],
      ['성체', `${G.Pens.countAdult(b)}/${G.Pens.capAdult(b)}`],
      ['새끼', `${G.Pens.countYoung(b)}/${G.Pens.capYoung(b)}`],
      ['판매금지', b.noSell ? '켜짐' : '꺼짐'],
    ]);
    if (b.type === 'birthing') return infoRows([
      ['장착', itemLabel(b.worker)],
      ['만드는 중', b.worker ? '점액덩어리' : '없음'],
      ['진행', progressText(b.birthTimer, C.BIRTH_INTERVAL)],
      ['출력 대기', b.output ? itemLabel(b.output) : '없음'],
    ]);
    if (b.type === 'washbasin') return infoRows([
      ['필요', '점액덩어리'],
      ['투입물', itemLabel(b.item)],
      ['만드는 중', b.item ? '구더기/엄지/자실장 중 하나' : '없음'],
      ['진행', progressText(b.washTimer, C.WASH_TIME / workerMult(b))],
      ['출력 대기', b.output ? itemLabel(b.output) : '없음'],
    ]);
    if (b.type === 'slaughter') return infoRows([
      ['필요', listText(def.accept)],
      ['투입물', itemLabel(b.item)],
      ['만드는 중', b.item ? `실장육 ${Math.floor(((b.item.stats && b.item.stats.크기) || 0) / 10)}개` : '없음'],
      ['진행', progressText(b.timer, def.time / workerMult(b))],
      ['출력 대기', b.outputs && b.outputs.length ? b.outputs.length + '개' : '없음'],
    ]);
    if (b.type === 'deshell') return infoRows([
      ['필요', listText(def.accept)],
      ['투입물', itemLabel(b.item)],
      ['만드는 중', b.item ? (def.convert && def.convert[b.item.type] || '변환') : '없음'],
      ['진행', progressText(b.timer, def.time / workerMult(b))],
    ]);
    if (b.type === 'grinder') return infoRows([
      ['필요', '실장석류/실장육'],
      ['투입물', itemLabel(b.item)],
      ['만드는 중', (b.item || (b.weight || 0) >= C.GRIND_TARGET) ? '분쇄육' : '없음'],
      ['축적 무게', `${Math.floor(b.weight || 0)}/${C.GRIND_TARGET}`],
    ]);
    if (b.type === 'correction') return infoRows([
      ['필요', listText(def.accept)],
      ['교사', b.teacher ? '개념 ' + Math.floor((b.teacher.stats && b.teacher.stats.개념) || 0) + '%' : '없음'],
      ['교육 중', `${b.inmates ? b.inmates.length : 0}/${def.hold}`],
      ['산출', '사육실장 계열 / 실장육'],
    ]);
    if (b.type === 'mixer') return infoRows([
      ['필요', `분쇄육1 + 운치${C.MIX_UNCHI}`],
      ['분쇄육', b.slotMeat ? '있음' : '없음'],
      ['운치', `${b.unchiN || 0}/${C.MIX_UNCHI}`],
      ['만드는 중', (b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI) ? `실장푸드${C.MIX_FOOD}` : '없음'],
      ['출력 대기', b.outputFood ? '실장푸드' : '없음'],
    ]);
    if (b.type === 'cookery') return infoRows([
      ['필요', '재료 + 조미료1'],
      ['만드는 중', b.cooking ? (def.cook[b.cooking].out) : '없음'],
      ['재료', b.mats ? Object.keys(b.mats).filter(k => b.mats[k]).map(k => k + ' ' + b.mats[k]).join(', ') || '없음' : '없음'],
      ['조미료', Math.floor(S.seasoning)],
    ]);
    if (b.type === 'sorter') return infoRows([
      ['기능', '화물을 2개 레인으로 분류'],
      ['필터', b.filter && b.filter.length ? b.filter.length + '종' : '전체 통과'],
      ['필터 레인', (b.filterLane || 1) + '번'],
      ['버퍼', b.buffer && b.buffer.length ? b.buffer.length + '개' : '없음'],
    ]);
    if (b.type === 'grabber') return infoRows([
      ['기능', '□에서 집어 △에 놓음'],
      ['들고 있음', itemLabel(b.holding)],
      ['필터', b.filter && b.filter.length ? b.filter.length + '종' : '전체 통과'],
    ]);
    if (b.type === 'warehouse') return infoRows([
      ['기능', '화물 저장'],
      ['재고 종류', Object.keys(S.warehouse).filter(k => S.warehouse[k] && S.warehouse[k].length).length + '종'],
      ['판매', '거래창'],
    ]);
    if (b.type === 'tunnel' || b.type === 'crossbelt') return infoRows([
      ['기능', '화물 순간이동'],
      ['대기열', b.queue && b.queue.length ? b.queue.length + '개' : '없음'],
      ['출구', '점선 표시 위치'],
    ]);
    if (b.type === 'catcher') return infoRows([
      ['기능', '범위 안 배회 실장석 수거'],
      ['필터', b.filter && b.filter.length ? b.filter.length + '종' : '전체 통과'],
      ['출력', '앞쪽 출구'],
    ]);
    if (b.type === 'skewer') return infoRows([
      ['기능', '실장석 고정 후 1분 뒤 파괴'],
      ['장착', itemLabel(b.held)],
      ['남은 시간', b.held ? Math.max(0, Math.ceil(60 - (b.heldT || 0))) + '초' : '없음'],
    ]);
    if (b.type === 'packer') return infoRows([['기능', '판매 가능 물자 즉시 판매'], ['현재', '대기']]);
    return deviceTypeDetails(b.type);
  }

  /* ---- 좌표 ------------------------------------------------------------ */
  /* ---- 카메라 / 좌표 변환 -------------------------------------------- */
  function centerCamera() {
    const cx = (COLS / 2) * CELL, cy = (ROWS / 2) * CELL;
    cam.zoom = 1;
    cam.x = cx - (C.VIEW_W / 2) / cam.zoom;
    cam.y = cy - (C.VIEW_H / 2) / cam.zoom;
  }
  // 클라이언트 좌표 → 월드(타일 소수). 캔버스 밖이면 null
  function screenToWorld(clientX, clientY) {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    const cpx = (clientX - r.left) * (canvas.width / r.width);
    const cpy = (clientY - r.top) * (canvas.height / r.height);
    return { wx: (cam.x + cpx / cam.zoom) / CELL, wy: (cam.y + cpy / cam.zoom) / CELL };
  }
  function screenToCell(clientX, clientY) {
    const w = screenToWorld(clientX, clientY);
    if (!w) return null;
    const col = Math.floor(w.wx), row = Math.floor(w.wy);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }
  // 월드 픽셀 → #game(오버레이) px. 캔버스는 #game (0,44)에 1:1 표시.
  function worldToGameX(wpx) { return (wpx - cam.x) * cam.zoom; }
  function worldToGameY(wpy) { return 44 + (wpy - cam.y) * cam.zoom; }
  function panelBox(el) {
    if (!el || el.style.display === 'none') return null;
    const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
    const x = parseFloat(el.style.left) || 0, y = parseFloat(el.style.top) || 0;
    return { x, y, w, h, r: x + w, b: y + h };
  }
  function overlaps(a, b, gap) {
    if (!a || !b) return false;
    const g = gap || 0;
    return !(a.r + g <= b.x || a.x >= b.r + g || a.b + g <= b.y || a.y >= b.b + g);
  }
  function positionMiniPanel(el, clientX, clientY, avoidEl) {
    const g = document.getElementById('game').getBoundingClientRect();
    const sc = g.width / C.GAME_W;
    const w = el.offsetWidth || 220, h = el.offsetHeight || 120;
    let x = (clientX - g.left) / sc + 12;
    let y = (clientY - g.top) / sc + 12;
    x = clamp(x, 8, C.GAME_W - w - 8);
    y = clamp(y, 48, C.GAME_H - h - 8);
    const avoids = (Array.isArray(avoidEl) ? avoidEl : [avoidEl]).map(panelBox).filter(Boolean);
    if (avoids.length) {
      const candidates = [
        { x, y },
        ...avoids.flatMap(avoid => [
          { x: avoid.x - w - 10, y },
          { x: avoid.r + 10, y },
          { x, y: avoid.b + 10 },
          { x, y: avoid.y - h - 10 },
          { x: avoid.x - w - 10, y: avoid.y },
          { x: avoid.r + 10, y: avoid.y },
        ]),
        { x: 8, y: 52 },
        { x: C.GAME_W - w - 8, y: 52 },
        { x: 8, y: C.GAME_H - h - 8 },
        { x: C.GAME_W - w - 8, y: C.GAME_H - h - 8 },
      ].map(p => ({
        x: clamp(p.x, 8, C.GAME_W - w - 8),
        y: clamp(p.y, 48, C.GAME_H - h - 8),
      }));
      const found = candidates.find(p => avoids.every(avoid => !overlaps({ x: p.x, y: p.y, w, h, r: p.x + w, b: p.y + h }, avoid, 8)));
      if (found) { x = found.x; y = found.y; }
    }
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
  function clampCamera() {
    const maxX = COLS * CELL - C.VIEW_W / cam.zoom, maxY = ROWS * CELL - C.VIEW_H / cam.zoom;
    cam.x = clamp(cam.x, 0, Math.max(0, maxX));
    cam.y = clamp(cam.y, 0, Math.max(0, maxY));
  }
  function zoomAt(clientX, clientY, factor) {
    const before = screenToWorld(clientX, clientY); if (!before) return;
    cam.zoom = clamp(cam.zoom * factor, C.ZOOM_MIN, C.ZOOM_MAX);
    // 커서 아래 월드점 고정
    const r = canvas.getBoundingClientRect();
    const cpx = (clientX - r.left) * (canvas.width / r.width);
    const cpy = (clientY - r.top) * (canvas.height / r.height);
    cam.x = before.wx * CELL - cpx / cam.zoom;
    cam.y = before.wy * CELL - cpy / cam.zoom;
    clampCamera();
  }

  /* ---- 풋프린트/역할 -------------------------------------------------- */
  function footprint(type, col, row, dir) {
    const def = G.DEVICES[type];
    let w = def.w, h = def.h;
    if (dir === 0 || dir === 2) { w = def.h; h = def.w; }
    const cells = [];
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) cells.push({ c: col + dc, r: row + dr });
    return { w, h, cells };
  }
  // 고스트 중앙이 마우스에 오도록 보정한 좌상단
  function ghostOrigin(type, cell, dir) {
    const fp = footprint(type, 0, 0, dir);
    return { col: cell.col - Math.floor((fp.w - 1) / 2), row: cell.row - Math.floor((fp.h - 1) / 2) };
  }
  function deviceCells(b) {
    if (b.type === 'penbox') { const a = []; for (let dr = 0; dr < b.h; dr++) for (let dc = 0; dc < b.w; dc++) a.push({ c: b.col + dc, r: b.row + dr }); return a; }
    if (b.type === 'tunnel' || b.type === 'crossbelt') { const e = transportEnds(b); return [e.back, e.front]; }
    return footprint(b.type, b.col, b.row, b.dir).cells;
  }
  function footprintCellsOf(b) {
    if (b.type === 'belt' || b.type === 'guardbelt') return [{ c: b.col, r: b.row }];
    if (b.type === 'grabber') { const g = grabberRoles(b); return [g.pickup, g.mid, g.drop]; }
    return deviceCells(b);
  }
  function grabberRoles(b) {
    const cells = footprint('grabber', b.col, b.row, b.dir).cells;
    let o;
    if (b.dir === 1) o = cells.slice().sort((a, z) => a.c - z.c);
    else if (b.dir === 3) o = cells.slice().sort((a, z) => z.c - a.c);
    else if (b.dir === 2) o = cells.slice().sort((a, z) => a.r - z.r);
    else o = cells.slice().sort((a, z) => z.r - a.r);
    return { pickup: o[0], mid: o[1], drop: o[2] };
  }
  function washInputCell(b) {
    if (b.dir === 1) return { c: b.col, r: b.row };
    if (b.dir === 3) return { c: b.col + 1, r: b.row };
    if (b.dir === 2) return { c: b.col, r: b.row };
    return { c: b.col, r: b.row + 1 };
  }
  function outputCell(b) {
    const fp = footprint(b.type, b.col, b.row, b.dir);
    const v = DIR.vec[b.dir];
    let base;
    if (b.dir === 1) base = { c: b.col + fp.w - 1, r: b.row };
    else if (b.dir === 3) base = { c: b.col, r: b.row };
    else if (b.dir === 2) base = { c: b.col, r: b.row + fp.h - 1 };
    else base = { c: b.col, r: b.row };
    return { c: base.c + v.x, r: base.r + v.y };
  }
  // 특수장치 영향 범위 사각형(셀 단위, 장치 중심 기준). rotatable이면 dir 홀수에서 가로/세로 전환.
  function rangeRect(type, col, row, dir) {
    const rg = G.DEVICES[type] && G.DEVICES[type].range; if (!rg) return null;
    let rw = rg.w, rh = rg.h;
    if (G.DEVICES[type].rotatable && (dir % 2 === 1)) { const t = rw; rw = rh; rh = t; }
    const cx = col + 0.5, cy = row + 0.5;
    return { x0: cx - rw / 2, y0: cy - rh / 2, x1: cx + rw / 2, y1: cy + rh / 2 };
  }
  function inRect(r, gx, gy) { return r && gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1; }
  function specialList(special) { return S.buildings.filter(b => G.DEVICES[b.type] && G.DEVICES[b.type].special === special); }
  // 사료분배기 범위 배수(우리 시스템에서 사용)
  function feedZoneMult(gx, gy) {
    for (const f of specialList('feed')) if (inRect(rangeRect(f.type, f.col, f.row, f.dir), gx, gy)) return C.FEED_GROWTH_MULT;
    return 1;
  }

  // 분류기 2칸의 레인 정보: [{cell, out(앞칸)}] (lane1, lane2 순서)
  function laneInfo(b) {
    const cells = footprint('sorter', b.col, b.row, b.dir).cells.slice();
    if (b.dir === 1 || b.dir === 3) cells.sort((a, z) => a.r - z.r); // 수직: 위=1번
    else cells.sort((a, z) => a.c - z.c);                            // 수평: 좌=1번
    const v = DIR.vec[b.dir];
    return cells.map(c => ({ cell: c, out: { c: c.c + v.x, r: c.r + v.y } }));
  }

  /* ---- 격자 헬퍼 ------------------------------------------------------ */
  function inGrid(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
  function startFieldRect() {
    const c0 = Math.floor((COLS - C.GIVEN_COLS) / 2);
    const r0 = Math.floor((ROWS - C.GIVEN_ROWS) / 2);
    return { c0, r0, c1: c0 + C.GIVEN_COLS, r1: r0 + C.GIVEN_ROWS };
  }
  function isStartFieldCell(c, r) {
    const f = startFieldRect();
    return c >= f.c0 && c < f.c1 && r >= f.r0 && r < f.r1;
  }
  function landKeyForCell(c, r) {
    const n = C.LAND_GRID_SIZE || 40;
    return Math.floor(c / n) + '|' + Math.floor(r / n);
  }
  function isOwnedCell(c, r) {
    return inGrid(c, r) && (isStartFieldCell(c, r) || !!S.ownedLand[landKeyForCell(c, r)]);
  }
  function footprintOwned(cells) {
    return cells.every(cell => isOwnedCell(cell.c, cell.r));
  }
  function landCost() {
    return Math.round((C.LAND_BASE_COST || 1000) * Math.pow(C.LAND_COST_MULT || 1.5, S.landBought || 0));
  }
  function occAt(c, r) { return inGrid(c, r) ? occ[r][c] : 'OOB'; }
  function beltCell(c, r) { return inGrid(c, r) ? beltGrid[r][c] : null; }
  function hasBelt(c, r) { const b = beltCell(c, r); return !!(b && (b.h || b.v)); }
  function deviceAt(c, r) {
    const id = occAt(c, r);
    if (!id || id === 'OOB') return null;
    return S.buildings.find(b => b.id === id) || null;
  }
  function accepts(def, type) {
    return def.accept === '*' || (Array.isArray(def.accept) && def.accept.includes(type));
  }
  function isWorkerType(type) { return type === '성체실장' || type === '독라'; }       // 일꾼 가능
  function workerMult(b) { return 1 + (b.workers ? b.workers.length : 0) * C.WORKER_SPEED; } // 속도 배수
  function upgradeMult(key) { return 1 + ((S.upgrades && S.upgrades[key]) || 0) * 0.3; }
  function beltSpeed() { return C.BELT_SPEED * upgradeMult('레일속도'); }
  function grabberInterval() { return C.GRABBER_INTERVAL / upgradeMult('집게속도'); }
  function addWorker(dev, data) {
    if (isWorkerType(data.type) && dev.workers && dev.workers.length < C.WORKER_SLOTS) { dev.workers.push(data); G.Assets.playSfx('click'); return true; }
    return false;
  }

  /* ---- 설치 가능 판정 ------------------------------------------------- */
  function canPlace(type, col, row, dir) {
    const fp = footprint(type, col, row, dir);
    for (const cell of fp.cells) if (!inGrid(cell.c, cell.r)) return false;
    const placeCells = (type === 'tunnel' || type === 'crossbelt') ? deviceCells({ type, col, row, dir, w: fp.w, h: fp.h }) : fp.cells;
    if (!footprintOwned(placeCells)) return false;
    if (type === 'belt' || type === 'guardbelt') { const cell = fp.cells[0]; return !occAt(cell.c, cell.r); }
    if (type === 'grabber') {
      const { mid } = grabberRoles({ col, row, dir });
      return !(occAt(mid.c, mid.r) || hasBelt(mid.c, mid.r));
    }
    for (const cell of placeCells) {
      if (occAt(cell.c, cell.r)) return false;
      if (type !== 'sorter' && hasBelt(cell.c, cell.r)) return false; // 분류기는 벨트 위 설치 가능(벨트 제거됨)
    }
    return true;
  }
  function removeBeltAtCell(c, r) {
    const bc = beltGrid[r][c];
    if (bc && (bc.h || bc.v)) {
      ['h', 'v'].forEach(ax => { if (bc[ax]) { const i = S.buildings.indexOf(bc[ax]); if (i >= 0) S.buildings.splice(i, 1); } });
      beltGrid[r][c] = null;
    }
  }

  /* ---- attach / detach ------------------------------------------------ */
  function attach(b) {
    if (b.type === 'belt' || b.type === 'guardbelt') {
      b.axis = (b.dir === 1 || b.dir === 3) ? 'h' : 'v';
      removeBeltAtCell(b.col, b.row);
      if (!beltGrid[b.row][b.col]) beltGrid[b.row][b.col] = { h: null, v: null };
      beltGrid[b.row][b.col][b.axis] = b;
    } else if (b.type === 'grabber') {
      const { mid } = grabberRoles(b); occ[mid.r][mid.c] = b.id;
    } else {
      for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r)) { removeBeltAtCell(cell.c, cell.r); occ[cell.r][cell.c] = b.id; }
    }
    if (!S.buildings.includes(b)) S.buildings.push(b);
  }
  /* ---- Undo (명령 단위 스냅샷) --------------------------------------- */
  function snapshot() {
    undoStack.push({
      buildings: JSON.parse(JSON.stringify(S.buildings)),
      walls: Object.assign({}, S.walls),
      cargo: JSON.parse(JSON.stringify(S.cargo)),
      wanderers: JSON.parse(JSON.stringify(S.wanderers)),
      penSeq: S.penSeq,
      money: S.money,
    });
    if (undoStack.length > 25) undoStack.shift();
  }
  function rebuildGrids() {
    for (let r = 0; r < ROWS; r++) { occ[r].fill(null); beltGrid[r].fill(null); }
    for (const b of S.buildings) {
      if (b.type === 'belt' || b.type === 'guardbelt') {
        b.axis = (b.dir === 1 || b.dir === 3) ? 'h' : 'v';
        if (!beltGrid[b.row][b.col]) beltGrid[b.row][b.col] = { h: null, v: null };
        beltGrid[b.row][b.col][b.axis] = b;
      } else if (b.type === 'grabber') { const { mid } = grabberRoles(b); if (inGrid(mid.c, mid.r)) occ[mid.r][mid.c] = b.id; }
      else { for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r)) occ[cell.r][cell.c] = b.id; }
    }
  }
  function reloadState(opts) {
    currentTool = null; ghostDir = 1; mouseCell = null; dropHoverId = null;
    panning = false; panStart = null; moveKeys.w = moveKeys.a = moveKeys.s = moveKeys.d = false;
    undoStack.length = 0; pasteMode = false; pasteClip = null;
    wallDragging = false; wallErase = false; wallStartPoint = null; wallEndPoint = null; wallSelection = [];
    beltDragging = false; beltPath = []; penDragStart = null; hoverBuilding = null;
    pendingSelect = false; selDragging = false; selStartCell = null; selDownClient = null;
    moveMode = false; moving = []; filterTarget = null; penTarget = null; birthTarget = null; selectedPenCreature = null;
    S.selection = [];
    if (landPromptEl) landPromptEl.style.display = 'none';
    if (deviceInfoEl) deviceInfoEl.style.display = 'none';
    rebuildGrids();
    centerCamera();
    if (opts && opts.setupStart) {
      setupStart();
      rebuildGrids();
    }
    renderMenuItems();
    updateFilterPanel();
    updatePenPanel();
    updateBirthingPanel();
  }
  function undo() {
    if (!undoStack.length) { setStatus('취소할 작업이 없습니다.'); return; }
    const s = undoStack.pop();
    S.buildings = s.buildings; S.walls = s.walls; S.cargo = s.cargo; S.wanderers = s.wanderers; S.penSeq = s.penSeq; S.money = s.money;
    S.selection = []; cancelMove(); cancelTool();
    rebuildGrids();
    G.Assets.playSfx('remove'); setStatus('실행 취소됨 (Ctrl+Z)');
  }
  /* ---- 복사 / 청사진 ------------------------------------------------- */
  function clipFromBuildings(builds) {
    let minC = Infinity, minR = Infinity;
    builds.forEach(b => { minC = Math.min(minC, b.col); minR = Math.min(minR, b.row); });
    return builds.map(b => ({ type: b.type, dc: b.col - minC, dr: b.row - minR, dir: b.dir, w: b.w, h: b.h }));
  }
  function copySelection() {
    closeAuxPanels();
    const builds = S.selection.map(id => S.buildings.find(b => b.id === id)).filter(Boolean);
    if (!builds.length) { setStatus('복사할 건물을 먼저 드래그 선택하세요.'); return; }
    pasteClip = clipFromBuildings(builds);
    pasteMode = true; currentTool = null; cancelMove(); S.selection = [];
    setStatus('복사됨 (' + pasteClip.length + '개) · 클릭=붙여넣기 / Ctrl+숫자=청사진 저장 / 우클릭=취소');
  }
  function pasteAt(col, row) {
    closeAuxPanels();
    snapshot();
    for (const it of pasteClip) {
      const c = col + it.dc, r = row + it.dr;
      if (it.type === 'penbox') makePen(c, r, it.w, it.h);   // 점유 시 makePen이 실패(덮어쓰기 X)
      else if (it.type === 'belt' || it.type === 'guardbelt') placeBelt(c, r, it.dir, it.type);
      else placeDevice(it.type, c, r, it.dir);
    }
    G.Assets.playSfx('place');
  }
  function saveBlueprint(k) {
    if (!pasteClip || !pasteClip.length) { setStatus('Ctrl+C로 먼저 복사한 뒤 Ctrl+숫자로 청사진 저장.'); return; }
    blueprints[k] = pasteClip.map(it => Object.assign({}, it));
    renderBlueprintTab();
    setStatus('청사진 ' + k + '번 저장됨.');
  }
  function loadBlueprint(k) {
    if (!blueprints[k]) return;
    closeAuxPanels();
    pasteClip = blueprints[k].map(it => Object.assign({}, it));
    pasteMode = true; currentTool = null; cancelMove(); S.selection = [];
    setStatus('청사진 ' + k + ' 불러옴 · 클릭=붙여넣기 / 우클릭=취소');
  }
  function buildBlueprintTab() {
    const t = document.createElement('div');
    t.id = 'blueprint-tab'; t.innerHTML = `<div class="bt-title">📐 청사진</div><div class="bt-list" id="bt-list"></div>`;
    document.getElementById('game').appendChild(t);
    renderBlueprintTab();
  }
  function renderBlueprintTab() {
    const list = document.getElementById('bt-list'); if (!list) return;
    const keys = Object.keys(blueprints).sort();
    if (!keys.length) { list.innerHTML = '<span class="bt-hint">Ctrl+C 복사 후 Ctrl+숫자로 저장</span>'; return; }
    list.innerHTML = keys.map(k => `<button class="bt-chip" data-k="${k}"><b>${k}</b> ${blueprints[k].length}개</button>`).join('');
    list.querySelectorAll('.bt-chip').forEach(c => c.addEventListener('click', () => loadBlueprint(c.dataset.k)));
  }

  function detach(b) {
    if (b.type === 'belt' || b.type === 'guardbelt') {
      const bc = beltGrid[b.row][b.col];
      if (bc) { if (bc.h === b) bc.h = null; if (bc.v === b) bc.v = null; if (!bc.h && !bc.v) beltGrid[b.row][b.col] = null; }
    } else if (b.type === 'grabber') {
      const { mid } = grabberRoles(b); if (occ[mid.r][mid.c] === b.id) occ[mid.r][mid.c] = null;
    } else {
      for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r) && occ[cell.r][cell.c] === b.id) occ[cell.r][cell.c] = null;
    }
    const i = S.buildings.indexOf(b); if (i >= 0) S.buildings.splice(i, 1);
  }

  function placeBelt(col, row, dir, type) {
    const beltType = type || 'belt';
    if (!isUnlocked(beltType)) return false;
    if (!canPlace(beltType, col, row, dir)) return false;
    const cost = buildCost(beltType);
    const oldRefund = beltRefundAt(col, row);
    if (S.money + oldRefund < cost) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return false; }
    refund(oldRefund);
    S.money -= cost;
    attach({ id: G.uid(), type: beltType, col, row, w: 1, h: 1, dir, cost });
    return true;
  }
  function beltRefundAt(c, r) {
    const bc = beltGrid[r][c]; if (!bc) return 0;
    let v = 0;
    if (bc.h) v += bc.h.cost || buildCost(bc.h.type);
    if (bc.v && bc.v !== bc.h) v += bc.v.cost || buildCost(bc.v.type);
    return v;
  }
  // 타일 위 타일: 대상 칸의 기존 건물/벨트를 먼저 제거(덮어쓰기)
  function clearArea(cells) {
    const ids = new Set();
    for (const cell of cells) {
      if (!inGrid(cell.c, cell.r)) continue;
      const id = occ[cell.r][cell.c]; if (id) ids.add(id);
      const bc = beltGrid[cell.r][cell.c]; if (bc) { if (bc.h) ids.add(bc.h.id); if (bc.v) ids.add(bc.v.id); }
    }
    ids.forEach(id => { const b = S.buildings.find(x => x.id === id); if (b) deleteBuilding(b); });
  }
  function placeDevice(type, col, row, dir) {
    if (!isUnlocked(type)) return false;
    const fp0 = footprint(type, col, row, dir);
    for (const cell of fp0.cells) if (!inGrid(cell.c, cell.r)) return false;  // 격자 밖은 불가
    // 기본은 덮어쓰기 금지(점유 시 실패). 단, 분류기는 동종(분류기) 위에만 교체 허용.
    if (type === 'sorter') {
      const ids = new Set(); let blockedByOther = false;
      for (const cell of fp0.cells) { const id = occ[cell.r][cell.c]; if (id) { const ex = S.buildings.find(b => b.id === id); if (ex && ex.type === 'sorter') ids.add(id); else blockedByOther = true; } }
      const oldRefund = Array.from(ids).reduce((s, id) => { const b = S.buildings.find(x => x.id === id); return s + (b ? (b.cost || buildCost(b.type, b.w, b.h)) : 0); }, 0);
      if (!blockedByOther && S.money + oldRefund < buildCost(type)) { G.UI.flash && G.UI.flash('돈 부족! (₩' + buildCost(type).toLocaleString() + ')'); return false; }
      if (!blockedByOther) ids.forEach(id => { const b = S.buildings.find(x => x.id === id); if (b) deleteBuilding(b); });
    }
    if (!canPlace(type, col, row, dir)) return false;
    const cost = buildCost(type);
    if (!spend(cost)) return false;
    const fp = footprint(type, col, row, dir);
    const b = { id: G.uid(), type, col, row, w: fp.w, h: fp.h, dir, cost };
    if (type === 'birthing') { b.worker = null; b.state = 'idle'; b.birthTimer = 0; b.lifeTimer = 0; }
    else if (type === 'washbasin') { b.state = 'idle'; b.item = null; b.washTimer = 0; }
    else if (type === 'grabber') { b.holding = null; b.cd = 0; b.filter = []; }
    else if (type === 'sorter') { b.toggle = 0; b.filter = []; b.filterLane = 1; b.buffer = []; }
    else if (['slaughter', 'deshell', 'grinder'].includes(type)) { b.item = null; b.timer = 0; b.state = 'idle'; b.weight = 0; b.outputs = []; }
    else if (type === 'correction') { b.inmates = []; b.state = 'idle'; }
    else if (type === 'mixer') { b.slotMeat = null; b.unchiN = 0; b.timer = 0; b.state = 'idle'; }
    else if (type === 'cookery') { b.mats = {}; b.cooking = null; b.timer = 0; b.state = 'idle'; }
    else if (type === 'catcher') { b.filter = []; b.cd = 0; }
    else if (type === 'skewer') { b.held = null; }
    else if (type === 'tunnel' || type === 'crossbelt') { b.queue = []; }
    if (G.DEVICES[type].worker) b.workers = [];  // 일꾼 슬롯 (속도 부스트)
    attach(b);
    return true;
  }

  /* ---- 회수/삭제 ------------------------------------------------------ */
  function buildingCenter(b) {
    const cells = footprintCellsOf(b);
    let sx = 0, sy = 0; cells.forEach(c => { sx += c.c + 0.5; sy += c.r + 0.5; });
    return { gx: sx / cells.length, gy: sy / cells.length };
  }
  function spawnWanderer(data, gx, gy, boardCd) {
    const a = Math.random() * Math.PI * 2;
    S.wanderers.push({ data, gx: clamp(gx, 0.5, COLS - 0.5), gy: clamp(gy, 0.5, ROWS - 0.5), vx: Math.cos(a), vy: Math.sin(a), t: 0.4 + Math.random(), boardCd: boardCd || 0 });
  }
  function deleteBuilding(b) {
    refund(b.cost || buildCost(b.type, b.w, b.h));
    const ctr = buildingCenter(b);
    const release = (d) => { if (d && !d.isProduct && G.CREATURES[d.type]) spawnWanderer(d, ctr.gx + (Math.random() - 0.5), ctr.gy + (Math.random() - 0.5)); };
    // 집게: 들고 있던 것만 처리(겹친 칸의 화물은 건드리지 않음)
    if (b.type === 'grabber') { release(b.holding); detach(b); return; }
    release(b.worker); release(b.item); release(b.holding); release(b.teacher);
    release(b.slotMeat); release(b.slotUnchi); release(b.held);
    if (b.buffer) b.buffer.forEach(release);
    if (b.workers) b.workers.forEach(release);     // 일꾼도 배회로 방출
    if (b.inmates) b.inmates.forEach(release);     // 교정시설 수용 개체 방출
    if (b.queue) b.queue.forEach(q => release(q.data)); // 터널 내 화물(생물) 방출
    if (b.creatures) b.creatures.forEach(release); // 우리 삭제 → 안의 실장석 배회
    // 셀 위 화물 중 생물은 배회, 그 외(생산품)는 폐기
    const cells = footprintCellsOf(b);
    const keyset = new Set(cells.map(c => c.c + ',' + c.r));
    S.cargo = S.cargo.filter(cg => {
      if (keyset.has(Math.floor(cg.gx) + ',' + Math.floor(cg.gy))) { release(cg.data); return false; }
      return true;
    });
    detach(b);
  }
  // 바닥에 떨어진 화물/배회 개체를 해당 칸에서 제거
  function deleteFloorAt(cell) {
    let removed = 0;
    S.cargo = S.cargo.filter(cg => { if (Math.floor(cg.gx) === cell.col && Math.floor(cg.gy) === cell.row) { removed++; return false; } return true; });
    S.wanderers = S.wanderers.filter(w => { if (Math.floor(w.gx) === cell.col && Math.floor(w.gy) === cell.row) { removed++; return false; } return true; });
    if (removed) G.Assets.playSfx('remove');
  }
  function deleteSelection() {
    closeAuxPanels();
    if (wallSelection.length) {
      refund(wallSelection.length * (G.BUILD_COST.wall || 0));
      wallSelection.forEach(k => { delete S.walls[k]; });
      wallSelection = [];
      G.Assets.playSfx('remove');
      return;
    }
    if (!S.selection.length) return;
    const builds = S.selection.map(id => S.buildings.find(b => b.id === id)).filter(Boolean);
    builds.forEach(deleteBuilding);
    S.selection = [];
    G.Assets.playSfx('remove');
  }

  /* ---- 이동 ----------------------------------------------------------- */
  function enterMove() {
    if (!S.selection.length || currentTool) return;
    closeAuxPanels();
    const builds = S.selection.map(id => S.buildings.find(b => b.id === id)).filter(Boolean);
    if (!builds.length) return;
    snapshot();   // 이동 전 상태 기록(Undo)
    // 선택 묶음의 중심을 마우스에 맞춤 (고스트 정중앙)
    let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    builds.forEach(b => footprintCellsOf(b).forEach(c => { minC = Math.min(minC, c.c); minR = Math.min(minR, c.r); maxC = Math.max(maxC, c.c); maxR = Math.max(maxR, c.r); }));
    const anchorCol = minC + Math.floor((maxC - minC) / 2), anchorRow = minR + Math.floor((maxR - minR) / 2);
    moving = builds.map(b => ({ b, offC: b.col - anchorCol, offR: b.row - anchorRow, oc: b.col, or: b.row, od: b.dir }));
    builds.forEach(detach);
    moveMode = true; S.selection = [];
    setStatus('이동 중: 좌클릭=배치 / R=회전 / Esc·우클릭=취소');
  }
  function tryDropMove() {
    closeAuxPanels();
    if (!mouseCell) return;
    const targets = moving.map(m => ({ m, col: mouseCell.col + m.offC, row: mouseCell.row + m.offR }));
    const ok = targets.every(t => canPlaceMoved(t.m.b, t.col, t.row));
    if (!ok) { G.Assets.playSfx('remove'); return; }
    targets.forEach(t => { t.m.b.col = t.col; t.m.b.row = t.row; attach(t.m.b); });
    moveMode = false; moving = []; G.Assets.playSfx('place');
    setStatus('이동 완료.');
  }
  function canPlaceMoved(b, col, row) {
    if (b.type !== 'penbox') return canPlace(b.type, col, row, b.dir);
    for (let dr = 0; dr < b.h; dr++) for (let dc = 0; dc < b.w; dc++) {
      if (!isOwnedCell(col + dc, row + dr) || occAt(col + dc, row + dr) || hasBelt(col + dc, row + dr)) return false;
    }
    return true;
  }
  function cancelMove() {
    closeAuxPanels();
    if (!moveMode) return;
    moving.forEach(m => { m.b.col = m.oc; m.b.row = m.or; m.b.dir = m.od; attach(m.b); });
    moveMode = false; moving = [];
  }
  // 호버 중인 건물 제자리 회전
  function rotateBuilding(b) {
    closeAuxPanels();
    if (!b || !G.DEVICES[b.type] || !G.DEVICES[b.type].rotatable) return;
    const od = b.dir, ow = b.w, oh = b.h;
    detach(b);
    b.dir = (b.dir + 1) % 4;
    if (b.type !== 'penbox') { const fp = footprint(b.type, b.col, b.row, b.dir); b.w = fp.w; b.h = fp.h; }
    if (canPlace(b.type, b.col, b.row, b.dir)) { attach(b); G.Assets.playSfx('rotate'); }
    else { b.dir = od; b.w = ow; b.h = oh; attach(b); }
  }

  /* ---- 선택 ----------------------------------------------------------- */
  function buildingAtCell(cell) {
    const d = deviceAt(cell.col, cell.row);
    if (d) return d;
    const bc = beltCell(cell.col, cell.row);
    if (bc && (bc.h || bc.v)) return bc.h || bc.v;
    // 집게 끝(○/▷)은 occ에 없으므로 별도 탐색
    for (const b of S.buildings) if (b.type === 'grabber') {
      const g = grabberRoles(b);
      if ([g.pickup, g.mid, g.drop].some(c => c.c === cell.col && c.r === cell.row)) return b;
    }
    for (const b of S.buildings) {
      if (b.type === 'skewer' && cell.col === b.col && cell.row >= b.row - 1 && cell.row <= b.row) return b;
    }
    return null;
  }
  function selectAt(cell, clientX, clientY) {
    allowAuxPanels();
    if (!cell) { S.selection = []; wallSelection = []; closeAuxPanels(); return; }
    const b = buildingAtCell(cell);
    S.selection = b ? [b.id] : [];
    wallSelection = [];
    if (b) selectedPenCreature = null;
    if (b && clientX != null && clientY != null) {
      updateFilterPanel();
      showDeviceInfoForBuilding(b, clientX, clientY);
    } else closeAuxPanels();
  }
  function selectInRect(a, b) {
    allowAuxPanels();
    closeAuxPanels();
    const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
    const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
    S.selection = S.buildings.filter(bd =>
      footprintCellsOf(bd).some(c => c.c >= minC && c.c <= maxC && c.r >= minR && c.r <= maxR)
    ).map(bd => bd.id);
    wallSelection = wallsInRect(a, b);
    filterPanelSuppressedKey = S.selection.join('|');
  }
  function selectSameType(cell) {
    allowAuxPanels();
    closeAuxPanels();
    const b = buildingAtCell(cell);
    wallSelection = [];
    if (!b) { S.selection = []; filterPanelSuppressedKey = ''; return; }
    S.selection = S.buildings.filter(x => x.type === b.type).map(x => x.id);
    filterPanelSuppressedKey = S.selection.join('|');
  }

  /* ---- 투입 (드래그/집게 공용) --------------------------------------- */
  function dropInto(dev, data) {
    if (!dev) return false;
    const def = G.DEVICES[dev.type];
    const isAdult = G.CREATURES[data.type] && G.CREATURES[data.type].isAdult;
    switch (dev.type) {
      case 'birthing':
        if (!dev.worker && isAdult) { dev.worker = data; dev.state = 'producing'; dev.birthTimer = 0; dev.lifeTimer = 0; G.Assets.playSfx('birth'); return true; }
        return false;
      case 'washbasin':
        if (data.type === '점액덩어리' && accepts(def, data.type) && !dev.item) { dev.item = data; dev.washTimer = 0; dev.state = 'producing'; return true; }
        return addWorker(dev, data);
      case 'slaughter': case 'deshell':
        if (accepts(def, data.type) && !dev.item && !(dev.outputs && dev.outputs.length)) { dev.item = data; dev.timer = 0; dev.state = 'producing'; return true; }
        return addWorker(dev, data);
      case 'correction':
        if (data.type === '사육실장' && !dev.teacher) { dev.teacher = data; return true; }
        if (accepts(def, data.type) && (dev.inmates ? dev.inmates.length : 0) < def.hold) { if (!dev.inmates) dev.inmates = []; dev.inmates.push(data); return true; }
        return false;
      case 'grinder':
        if (accepts(def, data.type) && !dev.item) { dev.item = data; dev.timer = 0; dev.state = 'producing'; return true; }
        return false;
      case 'sorter':
        if (!dev.buffer) dev.buffer = [];
        if (dev.buffer.length < SORTER_BUF) { dev.buffer.push(data); return true; }
        return false;
      case 'mixer':
        if (data.type === '분쇄육' && !dev.slotMeat) { dev.slotMeat = data; return true; }
        if (data.type === '운치' && (dev.unchiN || 0) < C.MIX_UNCHI) { dev.unchiN = (dev.unchiN || 0) + 1; return true; }
        return addWorker(dev, data);
      case 'cookery':
        if (def.cook[data.type]) { if (!dev.mats) dev.mats = {}; dev.mats[data.type] = (dev.mats[data.type] || 0) + 1; return true; }
        return addWorker(dev, data);
      case 'skewer':
        if (G.CREATURES[data.type] && !dev.held) { dev.held = data; dev.heldT = 0; return true; } // 실장석을 꽂음(고정)
        return false;
      case 'packer':
        if (data.isProduct) { sellCargo(data); return true; }
        return false;
      case 'tunnel': case 'crossbelt':
        if (emitAtCell(transportEnds(dev).exit, data)) return true;
        if (!dev.queue) dev.queue = [];
        if (dev.queue.length < C.TUNNEL_CAP) { dev.queue.push({ data: data, t: 0 }); return true; }
        return false;
      case 'penbox':
        if (G.CREATURES[data.type]) return G.Pens.addToPen(dev, data); // 성체/새끼 수용량 체크
        return false;
      case 'warehouse':
        if (G.CREATURES[data.type]) return false; // 생물은 창고에 안 들어감
        warehouseIntake(data); return true;
      default: return false;
    }
  }
  // 필터 일치 판정: 타입 필터 + 스탯 조건(이상/이하) 모두 만족
  function matchItem(b, data) {
    const f = b.filter || [];
    const typeOK = !f.length || f.includes(data.type);
    let statOK = true;
    const sf = b.statFilter;
    if (sf && sf.stat) {
      const v = (data.stats && data.stats[sf.stat]) || 0;
      statOK = (sf.op === '<=') ? (v <= sf.value) : (v >= sf.value);
    }
    return typeOK && statOK;
  }
  function resourceCargoData(type) {
    return { id: G.uid(), type, isProduct: false, stats: { 크기: (G.PRODUCTS[type] && G.PRODUCTS[type].size) || 0 } };
  }
  const CREATURE_TYPES = ['성체실장', '자실장', '엄지', '구더기'];
  // 특정 우리에서 필터에 맞는 생물 1마리 추출
  function takeFromPen(pen, b) {
    for (let i = 0; i < pen.creatures.length; i++) if (matchItem(b, pen.creatures[i])) return pen.creatures.splice(i, 1)[0];
    return null;
  }
  // 창고에서 "화물만" 추출 (생물 제외). 생산품 재고 + 자원(운치/실장푸드)
  function extractFromWarehouse(b) {
    const f = b.filter || [];
    for (const type of Object.keys(S.warehouse)) {
      if (CREATURE_TYPES.includes(type)) continue;       // 생물은 못 꺼냄
      const list = S.warehouse[type]; if (!list || !list.length) continue;
      if (f.length && !f.includes(type)) continue;
      const idx = list.findIndex(d => matchItem(b, d));
      if (idx >= 0) return list.splice(idx, 1)[0];
    }
    if ((!f.length || f.includes('운치')) && S.unchi >= 1) { S.unchi -= 1; return resourceCargoData('운치'); }
    if ((!f.length || f.includes('실장푸드')) && S.food >= 1) { S.food -= 1; return resourceCargoData('실장푸드'); }
    return null;
  }
  // 창고 입고: 실장푸드/운치=자원 재고, 그 외(생산품/생물)=판매 대기 재고에 저장(즉시판매 X)
  function warehouseIntake(data) {
    if (data.type === '실장푸드') { S.food += data.amount || 1; return; }
    if (data.type === '운치') { S.unchi += 1; return; }
    if (S.autoSell[data.type]) { sellCargo(data); return; }   // 자동판매: 입고 즉시 판매
    if (!S.warehouse[data.type]) S.warehouse[data.type] = [];
    S.warehouse[data.type].push(data);
  }
  // 통계창 "판매" 버튼: 창고 재고 전량 판매
  function sellAllWarehouse() {
    let gained = 0, count = 0;
    for (const type of Object.keys(S.warehouse)) {
      const list = S.warehouse[type];
      for (const d of list) { const p = d.isProduct ? (d.price || 1) : 2; gained += p; count++; S.sold[type] = (S.sold[type] || 0) + 1; S.produceLog.push(performance.now()); }
      S.warehouse[type] = [];
    }
    S.money += gained; S.soldValue += gained;
    if (count) G.Assets.playSfx('sell');
    return { gained, count };
  }
  // 종류별 n개 판매 (n=Infinity → 전부)
  function sellSomeType(type, n) {
    const list = S.warehouse[type]; if (!list || !list.length) return { gained: 0, count: 0 };
    const k = Math.min(n, list.length); let gained = 0, count = 0;
    for (let i = 0; i < k; i++) { const d = list.shift(); const p = d.isProduct ? (d.price || 1) : 2; gained += p; count++; S.sold[type] = (S.sold[type] || 0) + 1; S.produceLog.push(performance.now()); }
    S.money += gained; S.soldValue += gained; if (count) G.Assets.playSfx('sell');
    return { gained, count };
  }
  // 우리(펜) 안의 사육실장/독라(성체·새끼) 판매. type별 n마리, n=Infinity→전부.
  function sellPenCreatures(type, n) {
    let gained = 0, count = 0;
    for (const pen of G.Pens.allPens()) {
      if (pen.noSell) continue;   // 판매금지 우리는 제외
      for (let i = pen.creatures.length - 1; i >= 0 && count < n; i--) {
        const c = pen.creatures[i];
        if (c.type !== type) continue;
        gained += G.Creatures.priceOf(type, c.stats); count++;
        pen.creatures.splice(i, 1);
        S.sold[type] = (S.sold[type] || 0) + 1; S.produceLog.push(performance.now());
      }
      if (count >= n) break;
    }
    S.money += gained; S.soldValue += gained; if (count) G.Assets.playSfx('sell');
    return { gained, count };
  }
  function sellPenCreatureRef(ref) {
    if (!ref || !ref.pen || !ref.creature || ref.pen.noSell) return null;
    const i = ref.pen.creatures.indexOf(ref.creature);
    if (i < 0) return null;
    const c = ref.creature;
    if (c.type !== '사육실장' && c.type !== '새끼사육실장') return null;
    const price = G.Creatures.priceOf(c.type, c.stats);
    ref.pen.creatures.splice(i, 1);
    S.money += price; S.soldValue += price;
    S.sold[c.type] = (S.sold[c.type] || 0) + 1;
    S.produceLog.push(performance.now());
    G.Assets.playSfx('sell');
    return { gained: price, type: c.type };
  }
  // 우리에 넣고, 가득이면 필드 중앙 근처에 배회로 투입(치트/구매/포획 공용)
  function dropToFactory(data) {
    const add = G.Pens.addToPreferred || G.Pens.addToAny;
    if (add(data)) return;
    spawnWanderer(data, COLS / 2 + (Math.random() * 6 - 3), ROWS / 2 + (Math.random() * 6 - 3));
  }
  function tryLoadCreature(col, row, creature) { return dropInto(deviceAt(col, row), creature); }
  function hoverDropTarget(cx, cy) {
    const cell = screenToCell(cx, cy);
    const dev = cell ? deviceAt(cell.col, cell.row) : null;
    dropHoverId = null;
    if (dev) {
      const def = G.DEVICES[dev.type];
      const ok = ['birthing', 'washbasin', 'slaughter', 'deshell', 'correction', 'mixer', 'cookery', 'grinder', 'warehouse', 'penbox', 'skewer'].includes(dev.type);
      if (ok) dropHoverId = dev.id;
    }
  }
  function clearDropHover() { dropHoverId = null; }

  /* ---- 화물 ----------------------------------------------------------- */
  function makeCargo(data, col, row) {
    return { id: G.uid(), data, gx: col + 0.5, gy: row + 0.5, dir: 1, axis: 'h', sorterDir: null, sorterCell: null };
  }
  function cellOf(cg) { return { c: Math.floor(cg.gx), r: Math.floor(cg.gy) }; }
  function countCargoInCell(c, r, except) {
    let n = 0;
    for (const cg of S.cargo) { if (cg === except) continue; if (Math.floor(cg.gx) === c && Math.floor(cg.gy) === r) n++; }
    return n;
  }
  function isBeltLike(c, r) { return hasBelt(c, r); }
  function hasGuardBelt(c, r) {
    const bc = beltCell(c, r);
    return !!(bc && ((bc.h && bc.h.type === 'guardbelt') || (bc.v && bc.v.type === 'guardbelt')));
  }
  function entryKind(c, r, cargo) {
    if (!inGrid(c, r)) return false;
    if (isBeltLike(c, r)) return countCargoInCell(c, r, cargo) < C.BELT_CAP ? 'belt' : false;
    const d = deviceAt(c, r);
    if (!d) return false;
    const data = cargo.data, def = G.DEVICES[d.type];
    if (d.type === 'warehouse') return G.CREATURES[data.type] ? false : 'warehouse'; // 생물은 창고 불가
    if (d.type === 'sorter') return (d.buffer && d.buffer.length < SORTER_BUF) ? 'sorter' : false;
    if (d.type === 'washbasin') {
      // 일꾼 없이도 작동, 풋프린트 아무 칸으로 입고
      if (!d.item && data.type === '점액덩어리' && accepts(def, data.type)) return 'washIn';
      return false;
    }
    if (d.type === 'penbox') {
      if (G.CREATURES[data.type]) {
        const adult = G.CREATURES[data.type].isAdult;
        const cur = adult ? G.Pens.countAdult(d) : G.Pens.countYoung(d);
        const cap = adult ? G.Pens.capAdult(d) : G.Pens.capYoung(d);
        if (cur < cap) return 'penbox';
      }
      return false;
    }
    if (d.type === 'mixer') {
      if (data.type === '분쇄육' && !d.slotMeat) return 'mixMeat';
      if (data.type === '운치' && (d.unchiN || 0) < C.MIX_UNCHI) return 'mixUnchi';
      return false;
    }
    if (d.type === 'tunnel' || d.type === 'crossbelt') { const e = transportEnds(d); return (c === e.back.c && r === e.back.r && (d.queue ? d.queue.length : 0) < C.TUNNEL_CAP) ? 'transport' : false; }
    if (d.type === 'packer') return data.isProduct ? 'pack' : false;
    if (d.type === 'cookery') return def.cook[data.type] ? 'cook' : false;
    if (d.type === 'correction') {
      if (data.type === '사육실장' && !d.teacher) return 'teacher';
      return (accepts(def, data.type) && (d.inmates ? d.inmates.length : 0) < def.hold) ? 'correct' : false;
    }
    if (['slaughter', 'deshell', 'grinder'].includes(d.type)) {
      if (accepts(def, data.type) && !d.item && !(d.outputs && d.outputs.length)) return 'process';
      return false;
    }
    return false;
  }
  function chooseDir(cargo, c, r) {
    const bc = beltCell(c, r);
    if (!bc) return null;
    if (bc[cargo.axis]) return { dir: bc[cargo.axis].dir, axis: cargo.axis };
    if (bc.h) return { dir: bc.h.dir, axis: 'h' };
    if (bc.v) return { dir: bc.v.dir, axis: 'v' };
    return null;
  }

  /* ---- 시뮬레이션 ----------------------------------------------------- */
  function update(dt) { updateCameraKeys(dt); tickEconomy(dt); updateCargo(dt); updateDevices(dt); updateWanderers(dt); updateParticles(dt); updateStains(dt); }
  function updateCameraKeys(dt) {
    const x = (moveKeys.d ? 1 : 0) - (moveKeys.a ? 1 : 0);
    const y = (moveKeys.s ? 1 : 0) - (moveKeys.w ? 1 : 0);
    if (!x && !y) return;
    const speed = 720 / cam.zoom;
    const len = Math.hypot(x, y) || 1;
    cam.x += x / len * speed * dt;
    cam.y += y / len * speed * dt;
    clampCamera();
  }

  // 조미료 가격: 1분마다 직전가격 ±1~SWING 변동
  function tickEconomy(dt) {
    S.seasoningTimer = (S.seasoningTimer || 0) + dt;
    if (S.seasoningTimer >= C.SEASONING_TICK) {
      S.seasoningTimer -= C.SEASONING_TICK;
      const d = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * C.SEASONING_SWING));
      S.seasoningPrice = Math.max(C.SEASONING_MIN, (S.seasoningPrice || C.SEASONING_BASE) + d);
    }
  }

  // 실장석 대사: 말하는 중이면 시간만 감소, 아니면 간헐적으로 table에서 대사 선택
  function tickTalk(data, dt, table) {
    if (data.speechT > 0) { data.speechT -= dt; return; }
    if (!table) return;
    data.speakCd = (data.speakCd != null ? data.speakCd : 3 + Math.random() * 5) - dt;
    if (data.speakCd <= 0) {
      data.speakCd = 5 + Math.random() * 7;
      const line = table[data.type];
      if (line) { data.speech = line; data.speechT = 2.2; }
    }
  }

  /* ---- 파티클 ---------------------------------------------------------- */
  function spawnParticle(x, y, color) {
    const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.2;
    S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5, life: 0.5 + Math.random() * 0.4, max: 0.9, color });
  }
  function updateParticles(dt) {
    if (!S.particles.length) return;
    for (const p of S.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.life -= dt; }
    S.particles = S.particles.filter(p => p.life > 0);
  }
  function drawParticles() {
    for (const p of S.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  // 빨강+초록 파티클 분출 (gx,gy = 그리드 좌표)
  function burstAt(gx, gy) {
    for (let i = 0; i < 14; i++) spawnParticle(gx * CELL, gy * CELL, (i % 2) ? '#3ad24a' : '#e23a2a');
  }
  // 바닥에 초록+빨간 자국 남김
  function stainAt(gx, gy) {
    const dots = []; const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) dots.push({ dx: (Math.random() - 0.5) * 26, dy: (Math.random() - 0.5) * 26, r: 2 + Math.random() * 4, color: (i % 2) ? '#2f9e3a' : '#a8302a' });
    S.stains.push({ x: gx * CELL, y: gy * CELL, dots, life: 30, max: 30 });
    if (S.stains.length > 300) S.stains.shift();
  }
  function updateStains(dt) {
    if (!S.stains.length) return;
    for (const s of S.stains) {
      if (s.life == null) { s.life = 30; s.max = 30; }
      s.life -= dt;
    }
    S.stains = S.stains.filter(s => s.life > 0);
  }
  function drawStains() {
    for (const s of S.stains) {
      ctx.globalAlpha = 0.5 * (s.life == null ? 1 : Math.max(0, s.life / (s.max || 30)));
      for (const d of s.dots) { ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(s.x + d.dx, s.y + d.dy, d.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  // 배회 개체: 자유 이동 + 가공시설 진입 시 처리
  function updateWanderers(dt) {
    if (!S.wanderers.length) return;
    const PROC = ['slaughter', 'deshell', 'correction', 'grinder', 'washbasin', 'mixer', 'cookery'];
    const consumed = [];
    for (const w of S.wanderers) {
      G.Creatures.ageSlime(w.data, dt);  // 점액덩어리 숙성
      tickTalk(w.data, dt, G.LINES.wander);  // 배회 대사
      const sp = (C.WANDER_SPEED[w.data.type] || 0.6) * C.MOVE_SCALE;
      if (w.boardCd > 0) w.boardCd -= dt;
      w.t -= dt;
      if (w.t <= 0) { const a = Math.random() * Math.PI * 2; w.vx = Math.cos(a); w.vy = Math.sin(a); w.t = 0.5 + Math.random() * 1.5; }
      const ox = w.gx, oy = w.gy, inx = ox + w.vx * sp * dt, iny = oy + w.vy * sp * dt;
      const nb = wallBlock(ox, oy, inx, iny);
      if (nb.x !== inx) w.vx = -w.vx;   // 벽에 막히면 반사
      if (nb.y !== iny) w.vy = -w.vy;
      w.gx = nb.x; w.gy = nb.y;
      if (w.gx < 0.5) { w.gx = 0.5; w.vx = Math.abs(w.vx); }
      if (w.gx > COLS - 0.5) { w.gx = COLS - 0.5; w.vx = -Math.abs(w.vx); }
      if (w.gy < 0.5) { w.gy = 0.5; w.vy = Math.abs(w.vy); }
      if (w.gy > ROWS - 0.5) { w.gy = ROWS - 0.5; w.vy = -Math.abs(w.vy); }
      const c = Math.floor(w.gx), r = Math.floor(w.gy);
      const dev = deviceAt(c, r);
      // 새끼가 우리 안으로 배회해 들어오면 흡수 (성체는 못 들어감)
      if (dev && dev.type === 'penbox') {
        const isAdult = G.CREATURES[w.data.type] && G.CREATURES[w.data.type].isAdult;
        if (!isAdult && G.Pens.countYoung(dev) < G.Pens.capYoung(dev)) { G.Pens.addToPen(dev, w.data); consumed.push(w); continue; }
      }
      if (dev && PROC.includes(dev.type) && dropInto(dev, w.data)) { consumed.push(w); continue; }
      // 배회 중 벨트에 올라가면 화물이 되어 자동 이동 (도망 직후 잠시 제외)
      if (w.boardCd <= 0 && isBeltLike(c, r) && countCargoInCell(c, r) < C.BELT_CAP) { S.cargo.push(makeCargo(w.data, c, r)); consumed.push(w); continue; }
    }
    if (consumed.length) S.wanderers = S.wanderers.filter(w => !consumed.includes(w));
    separateWanderers();
  }
  // 배회 개체 충돌 분리(서로 겹치지 않게 밀어냄)
  function collRad(type) { return 0.46 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[type]) || 1); }
  function separateWanderers() {
    const ws = S.wanderers; const n = ws.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = ws[i], b = ws[j];
      const dx = b.gx - a.gx, dy = b.gy - a.gy; const d = Math.hypot(dx, dy);
      const min = collRad(a.data.type) + collRad(b.data.type);
      if (d > 0.0001 && d < min) {
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        a.gx -= ux * push; a.gy -= uy * push; b.gx += ux * push; b.gy += uy * push;
      }
    }
    for (const w of ws) { w.gx = clamp(w.gx, 0.5, COLS - 0.5); w.gy = clamp(w.gy, 0.5, ROWS - 0.5); }
  }

  function updateCargo(dt) {
    const remove = [];
    for (const cargo of S.cargo) {
      G.Creatures.ageSlime(cargo.data, dt);  // 점액덩어리 숙성
      if (G.CREATURES[cargo.data.type]) tickTalk(cargo.data, dt, G.LINES.belt);  // 벨트 대사
      const cell = cellOf(cargo);
      if (cargo.sorterCell && (cargo.sorterCell.c !== cell.c || cargo.sorterCell.r !== cell.r)) { cargo.sorterCell = null; cargo.sorterDir = null; }
      const choice = chooseDir(cargo, cell.c, cell.r);
      if (!choice) continue;
      cargo.dir = choice.dir; cargo.axis = choice.axis;
      const v = DIR.vec[cargo.dir];
      const adv = beltSpeed() * dt;
      if (cargo.axis === 'h') cargo.gy += clamp((cell.r + 0.5) - cargo.gy, -adv, adv);
      else cargo.gx += clamp((cell.c + 0.5) - cargo.gx, -adv, adv);

      let along = (cargo.axis === 'h') ? cargo.gx : cargo.gy;
      const idx = (cargo.axis === 'h') ? cell.c : cell.r;
      const sign = (cargo.axis === 'h') ? v.x : v.y;
      let target = along + sign * adv;
      const nextC = cell.c + v.x, nextR = cell.r + v.y;
      const kind = entryKind(nextC, nextR, cargo);
      const center = idx + 0.5;
      // 다음 벨트가 2마리로 가득 → 생물은 벨트 옆으로 도망(배회)
      if (!kind && G.CREATURES[cargo.data.type] && isBeltLike(nextC, nextR) && !hasGuardBelt(cell.c, cell.r) && !hasGuardBelt(nextC, nextR) && countCargoInCell(nextC, nextR) >= C.BELT_CAP && Math.random() < dt * 0.9) {
        const off = [{ c: cell.c, r: cell.r - 1 }, { c: cell.c, r: cell.r + 1 }, { c: cell.c - 1, r: cell.r }, { c: cell.c + 1, r: cell.r }].find(o => inGrid(o.c, o.r) && !isBeltLike(o.c, o.r) && !deviceAt(o.c, o.r));
        const sp = off || cell;
        spawnWanderer(cargo.data, sp.c + 0.5, sp.r + 0.5, 1.5); remove.push(cargo); continue;
      }
      if (!kind) target = sign > 0 ? Math.min(target, center) : Math.max(target, center);
      const ahead = nearestAhead(cargo);
      if (ahead != null) target = sign > 0 ? Math.min(target, ahead - 0.5) : Math.max(target, ahead + 0.5);
      if (cargo.axis === 'h') cargo.gx = target; else cargo.gy = target;

      const nc = cellOf(cargo);
      if ((nc.c !== cell.c || nc.r !== cell.r) && kind && kind !== 'belt') {
        // 장치 칸으로 진입 → dropInto로 일괄 처리(가공/우리/창고/분류기/배합기/조리실/교정/터널 등)
        const d = deviceAt(nc.c, nc.r);
        if (d && dropInto(d, cargo.data)) remove.push(cargo);
      }
    }
    if (remove.length) S.cargo = S.cargo.filter(c => !remove.includes(c));
  }

  function nearestAhead(cargo) {
    const v = DIR.vec[cargo.dir];
    let best = null;
    for (const o of S.cargo) {
      if (o === cargo) continue;
      const dx = o.gx - cargo.gx, dy = o.gy - cargo.gy;
      if (cargo.axis === 'h') {
        if (Math.abs(dy) > 0.4) continue;
        if (Math.sign(dx) !== Math.sign(v.x) || dx === 0) continue;
        if (Math.abs(dx) > 1.6) continue;
        if (best == null || (v.x > 0 ? o.gx < best : o.gx > best)) best = o.gx;
      } else {
        if (Math.abs(dx) > 0.4) continue;
        if (Math.sign(dy) !== Math.sign(v.y) || dy === 0) continue;
        if (Math.abs(dy) > 1.6) continue;
        if (best == null || (v.y > 0 ? o.gy < best : o.gy > best)) best = o.gy;
      }
    }
    return best;
  }

  function sellCargo(data) {
    const price = data.isProduct ? (data.price || 1) : 2;
    const type = data.type;
    S.sold[type] = (S.sold[type] || 0) + 1;
    S.money += price; S.soldValue += price;
    S.produceLog.push(performance.now());
    G.Assets.playSfx('sell');
  }

  function updateDevices(dt) {
    for (const b of S.buildings) {
      if (b.speechT > 0) b.speechT -= dt;   // 장치 말풍선 시간 감소
      if (b.type === 'birthing') updateBirthing(b, dt);
      else if (b.type === 'washbasin') updateWashbasin(b, dt);
      else if (b.type === 'grabber') updateGrabber(b, dt);
      else if (b.type === 'sorter') updateSorter(b, dt);
      else if (b.type === 'tunnel' || b.type === 'crossbelt') updateTunnel(b, dt);
      else if (b.type === 'mixer') updateMixer(b, dt);
      else if (b.type === 'cookery') updateCookery(b, dt);
      else if (G.DEVICES[b.type] && G.DEVICES[b.type].special) updateSpecial(b, dt);
      else if (b.type === 'correction') updateCorrection(b, dt);
      else if (['slaughter', 'deshell', 'grinder'].includes(b.type)) updateProcessor(b, dt);
    }
  }

  // 특수장치 효과 ---------------------------------------------------------
  function eachInRange(b, fn) {
    const r = rangeRect(b.type, b.col, b.row, b.dir); if (!r) return;
    for (const pen of G.Pens.allPens()) for (const c of pen.creatures) {
      if (inRect(r, pen.col + (c.px || 0.5), pen.row + (c.py || 0.5))) fn(c);
    }
    for (const w of S.wanderers) if (inRect(r, w.gx, w.gy)) fn(w.data);
  }
  function nurtureZone(b, dt, stats, chance) {
    eachInRange(b, c => {
      if (!c.stats) return;
      if (Math.random() < chance * dt) { const s = stats[Math.floor(Math.random() * stats.length)]; c.stats[s] = Math.min(200, (c.stats[s] || 0) + 1); }
    });
  }
  function updateSpecial(b, dt) {
    const sp = G.DEVICES[b.type].special;
    if (sp === 'nurture') nurtureZone(b, dt, ['육질', '개념', '크기'], C.NURTURE_CHANCE);
    else if (sp === 'skewer') {
      if (b.held) {
        b.heldT = (b.heldT || 0) + dt;
        if (b.heldT >= 60) {
          burstAt(b.col + 0.5, b.row + 0.5);
          stainAt(b.col + 0.5, b.row + 0.5);
          b.held = null; b.heldT = 0;
          G.Assets.playSfx('remove');
          return;
        }
        if (b.speechT <= 0 && Math.random() < dt * 0.7) { b.speech = '테겍 테겍'; b.speechT = 1.3; }
        nurtureZone(b, dt, ['육질'], C.SKEWER_CHANCE);
      }
    } else if (sp === 'catch') {
      b.cd = (b.cd || 0) + dt;
      if (b.cd >= C.CATCH_INTERVAL) {
        b.cd = 0;
        const r = rangeRect(b.type, b.col, b.row, b.dir);
        const caught = S.wanderers.filter(w => inRect(r, w.gx, w.gy) && isOwnedCell(Math.floor(w.gx), Math.floor(w.gy)) && matchItem(b, w.data));
        for (const w of caught) { S.wanderers = S.wanderers.filter(x => x !== w); if (!emitCreature(b, w.data)) spawnWanderer(w.data, clamp(outputCell(b).c + 0.5, 0.5, COLS - 0.5), clamp(outputCell(b).r + 0.5, 0.5, ROWS - 0.5)); }
      }
    }
    // 'birth'(레드포인터), 'feed'(사료분배기)는 각각 updateBirthing / pens가 범위를 조회
  }
  // 출산대 위치를 덮는 레드포인터가 있으면 출산 가속 배수
  function birthBoost(b) {
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2;
    for (const p of specialList('birth')) if (inRect(rangeRect(p.type, p.col, p.row, p.dir), cx, cy)) return C.BIRTH_BOOST;
    return 1;
  }

  // 생물 산출: 출구가 벨트면 화물, 장치면 투입, 빈 바닥/격자밖이면 풀어줘 배회. (못 내보내면 false=보류)
  function emitCreature(b, data) {
    const out = outputCell(b);
    if (!inGrid(out.c, out.r)) { spawnWanderer(data, clamp(out.c + 0.5, 0.5, COLS - 0.5), clamp(out.r + 0.5, 0.5, ROWS - 0.5)); return true; }
    const dev = deviceAt(out.c, out.r);
    if (dev) return dropInto(dev, data);                 // 장치 있음 → 투입(바쁘면 false=대기)
    if (isBeltLike(out.c, out.r)) {                       // 벨트 → 화물(가득이면 false=대기)
      if (countCargoInCell(out.c, out.r) < C.BELT_CAP) { S.cargo.push(makeCargo(data, out.c, out.r)); return true; }
      return false;
    }
    spawnWanderer(data, out.c + 0.5, out.r + 0.5); return true;  // 빈 바닥 → 풀어줌(배회)
  }

  // 장치 footprint 바깥, dir 방향 인접 셀(중앙 라인)
  function sideCell(b, dir) {
    const fp = footprint(b.type, b.col, b.row, b.dir);
    const midC = b.col + Math.floor(fp.w / 2), midR = b.row + Math.floor(fp.h / 2);
    if (dir === 0) return { c: midC, r: b.row - 1 };
    if (dir === 2) return { c: midC, r: b.row + fp.h };
    if (dir === 3) return { c: b.col - 1, r: midR };
    return { c: b.col + fp.w, r: midR };
  }
  // 터널/횡단벨트 입구(back)/출구(exit) 셀
  function transportEnds(b) {
    const fp = footprint(b.type, b.col, b.row, b.dir), v = DIR.vec[b.dir];
    let back, front;
    if (b.dir === 1) { back = { c: b.col, r: b.row }; front = { c: b.col + fp.w - 1, r: b.row }; }
    else if (b.dir === 3) { back = { c: b.col + fp.w - 1, r: b.row }; front = { c: b.col, r: b.row }; }
    else if (b.dir === 2) { back = { c: b.col, r: b.row }; front = { c: b.col, r: b.row + fp.h - 1 }; }
    else { back = { c: b.col, r: b.row + fp.h - 1 }; front = { c: b.col, r: b.row }; }
    return { back, front, exit: { c: front.c + v.x, r: front.r + v.y } };
  }
  function tunnelEnds(b) { return transportEnds(b); }
  function updateTunnel(b, dt) {
    if (!b.queue || !b.queue.length) return;
    const exit = transportEnds(b).exit;
    for (let i = 0; i < b.queue.length; i++) {
      const q = b.queue[i]; q.t += dt;
      if (q.t >= 0) { if (emitAtCell(exit, q.data)) { b.queue.splice(i, 1); i--; } }
    }
  }
  // 특정 셀로 산출(장치/벨트/바닥/격자밖). 못 내보내면 false.
  function emitAtCell(cell, data) {
    if (!inGrid(cell.c, cell.r)) { spawnWanderer(data, clamp(cell.c + 0.5, 0.5, COLS - 0.5), clamp(cell.r + 0.5, 0.5, ROWS - 0.5)); return true; }
    const dev = deviceAt(cell.c, cell.r);
    if (dev) return dropInto(dev, data);
    if (isBeltLike(cell.c, cell.r)) { if (countCargoInCell(cell.c, cell.r) < C.BELT_CAP) { S.cargo.push(makeCargo(data, cell.c, cell.r)); return true; } return false; }
    if (G.CREATURES[data.type]) { spawnWanderer(data, cell.c + 0.5, cell.r + 0.5); return true; }
    S.cargo.push(makeCargo(data, cell.c, cell.r)); return true;
  }
  // 교정시설: 자실장 6마리 수용. 대사마다 육질-1/개념+1. 졸업(사육실장)/도축(실장육)/탈출.
  function updateCorrection(b, dt) {
    if (!b.inmates) b.inmates = [];
    const CR = G.CORRECTION;
    const grad = sideCell(b, b.dir), meat = sideCell(b, (b.dir + 2) % 4);
    const teachConcept = b.teacher && b.teacher.stats ? clamp(b.teacher.stats.개념 || 0, 0, 200) : 0;
    const conceptGain = 1 + teachConcept / 100;
    for (let i = b.inmates.length - 1; i >= 0; i--) {
      const m = b.inmates[i];
      if (m.speechT > 0) m.speechT -= dt;
      if (m.meatReady) { if (emitAtCell(meat, G.Creatures.makeProduct('실장육', m))) b.inmates.splice(i, 1); continue; }
      if (m.gradReady) { m.type = m.gradType || '새끼사육실장'; m.growth = 0; if (emitAtCell(grad, m)) b.inmates.splice(i, 1); continue; }
      m.corrT = (m.corrT || 0) + dt;
      m.lineT = (m.lineT != null ? m.lineT : CR.LINE_MIN + Math.random() * (CR.LINE_MAX - CR.LINE_MIN)) - dt;
      if (m.lineT <= 0) {
        m.lineT = CR.LINE_MIN + Math.random() * (CR.LINE_MAX - CR.LINE_MIN);
        if ((m.stats.개념 || 0) <= CR.ESCAPE_CONCEPT && Math.random() < CR.ESCAPE_CHANCE) {
          m.speech = G.LINES.correctionEscape; m.speechT = 2.4;
          b.inmates.splice(i, 1);
          spawnWanderer(m, clamp(grad.c + 0.5, 0.5, COLS - 0.5), clamp(grad.r + 0.5, 0.5, ROWS - 0.5));
          G.Assets.playSfx('wash');
          continue;
        }
        const ls = G.LINES.correction; m.speech = ls[Math.floor(Math.random() * ls.length)]; m.speechT = 1.9;
        m.stats.육질 = Math.max(0, (m.stats.육질 || 0) - 1);
        m.stats.개념 = Math.min(200, (m.stats.개념 || 0) + conceptGain);
        if (m.stats.육질 <= 0) m.meatReady = true;
        else if (m.stats.개념 >= CR.GRAD_CONCEPT && m.corrT >= CR.GRAD_TIME) { m.gradReady = true; m.gradType = (m.type === '성체실장') ? '사육실장' : '새끼사육실장'; }
      }
    }
    b.state = b.inmates.length ? 'producing' : 'idle';
  }

  function updateBirthing(b, dt) {
    if (!b.worker) { b.state = 'idle'; return; }
    if (b.output) { if (emitCreature(b, b.output)) b.output = null; else return; } // 보류 산출 먼저
    b.state = 'producing';
    b.lifeTimer += dt;
    if (b.lifeTimer >= C.BIRTH_LIFESPAN) { b.worker = null; b.state = 'idle'; b.birthTimer = 0; return; }
    b.birthTimer += dt * birthBoost(b);   // 레드포인터 범위면 가속
    if (b.birthTimer >= C.BIRTH_INTERVAL) {
      // 모든 부모(성체실장/독라/사육실장)는 점액 덩어리를 낳음
      const child = G.Creatures.breed(b.worker.stats, '점액덩어리');
      b.birthTimer = 0; if (!emitCreature(b, child)) b.output = child;
      b.births = (b.births || 0) + 1;
      b.speech = '뎃데로게~'; b.speechT = 1.6; G.Assets.playSfx('birth');
    }
  }
  function updateWashbasin(b, dt) {
    if (b.output) { if (emitCreature(b, b.output)) b.output = null; else return; } // 보류 산출 먼저
    if (!b.item) { b.state = 'ready'; return; }
    b.state = 'producing'; b.washTimer += dt;
    if (b.washTimer >= C.WASH_TIME / workerMult(b)) {
      const res = G.Creatures.washClassify(b.item);
      b.item = null; b.washTimer = 0; b.state = 'ready';
      if (!emitCreature(b, res)) b.output = res; G.Assets.playSfx('wash');
    }
  }
  function updateProcessor(b, dt) {
    const def = G.DEVICES[b.type];
    if (b.outputs && b.outputs.length) {
      b.state = 'ready';
      if (emitAtCell(outputCell(b), b.outputs[0])) b.outputs.shift();
      return;
    }
    if (b.type === 'grinder') {
      if (b.item) {
        b.state = 'producing'; b.timer += dt;
        // 가동 중 빨강+초록 파티클
        for (let k = 0; k < 3; k++) if (Math.random() < dt * 18) spawnParticle((b.col + Math.random() * b.w) * CELL, (b.row + Math.random() * b.h) * CELL, Math.random() < 0.5 ? '#e23a2a' : '#3ad24a');
        if (b.timer >= def.time) { b.weight += (b.item.stats ? (b.item.stats.크기 || 0) : 0); b.item = null; b.timer = 0; b.state = 'ready'; }
      } else b.state = b.weight >= C.GRIND_TARGET ? 'ready' : 'idle';
      // 무게 100 이상 → 분쇄육(화물) 생산 (출구가 비어 있을 때)
      if (b.weight >= C.GRIND_TARGET) {
        const out = outputCell(b);
        if (inGrid(out.c, out.r) && countCargoInCell(out.c, out.r) === 0) {
          b.weight -= C.GRIND_TARGET;
          S.cargo.push(makeCargo(G.Creatures.makeProduct('분쇄육', { stats: { 육질: 0, 개념: 0, 크기: 0 } }), out.c, out.r));
        }
      }
      return;
    }
    if (!b.item) { b.state = 'idle'; return; }
    b.state = 'producing'; b.timer += dt;
    if (b.timer >= def.time / workerMult(b)) {
      if (def.convert) {
        // 생물로 변환 (탈복기/교정시설) → 벨트/우리/바닥으로 배출
        const nt = def.convert[b.item.type];
        if (nt) {
          const s = b.item.stats || {};
          const res = { id: G.uid(), type: nt, stats: { 육질: s.육질, 개념: s.개념, 크기: s.크기 }, growth: 0 };
          if (emitCreature(b, res)) { b.item = null; b.timer = 0; b.state = 'ready'; G.Assets.playSfx('wash'); }
        } else { b.item = null; b.timer = 0; }
      } else {
        // 생산품 출력 (도축기 등)
        const products = processorProducts(b, def);
        b.item = null; b.timer = 0; b.state = 'ready'; b.outputs = products;
        G.Assets.playSfx('sell');
      }
    }
  }
  function processorProducts(b, def) {
    if (b.type === 'slaughter') {
      const size = b.item && b.item.stats ? Math.max(0, b.item.stats.크기 || 0) : 0;
      const n = Math.floor(size / 10);
      return Array.from({ length: n }, () => G.Creatures.makeProduct(def.output, b.item));
    }
    return [G.Creatures.makeProduct(def.output, b.item)];
  }

  function updateMixer(b, dt) {
    if (b.outputFood) { if (emitAtCell(outputCell(b), b.outputFood)) b.outputFood = null; else return; }
    if (b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI) {
      b.state = 'producing'; b.timer += dt;
      if (b.timer >= G.DEVICES.mixer.time / workerMult(b)) {
        b.outputFood = makeFoodCargo(b.slotMeat);
        b.slotMeat = null; b.unchiN = 0; b.timer = 0; b.state = 'ready';
        G.Assets.playSfx('wash');
      }
    } else { b.state = (b.slotMeat || (b.unchiN || 0)) ? 'ready' : 'idle'; b.timer = 0; }
  }
  function makeFoodCargo(meat) {
    const q = meat && meat.stats ? Math.max(0, meat.stats.육질 || 0) : 0;
    const amount = C.MIX_FOOD;
    return {
      id: G.uid(), type: '실장푸드', isProduct: true, amount,
      stats: { 육질: q, 개념: 0, 크기: 0 },
      price: Math.max(1, Math.round(amount * (1 + q / 100))),
    };
  }

  // 조리실: 재료 N개 + 조미료 1 → 요리. 재료 종류에 따라 출력 화물이 다름.
  function updateCookery(b, dt) {
    const def = G.DEVICES.cookery;
    if (!b.mats) b.mats = {};
    if (!b.cooking) {
      for (const mat in def.cook) {
        if ((b.mats[mat] || 0) >= def.cook[mat].n && S.seasoning >= 1) { b.cooking = mat; b.timer = 0; break; }
      }
    }
    if (b.cooking) {
      const r = def.cook[b.cooking];
      if ((b.mats[b.cooking] || 0) < r.n || S.seasoning < 1) { b.cooking = null; b.timer = 0; b.state = 'idle'; return; }
      b.state = 'producing'; b.timer += dt;
      if (b.timer >= def.time / workerMult(b)) {
        const out = outputCell(b);
        if (inGrid(out.c, out.r) && countCargoInCell(out.c, out.r) === 0) {
          b.mats[b.cooking] -= r.n; S.seasoning -= 1;
          S.cargo.push(makeCargo(G.Creatures.makeProduct(r.out, { stats: { 육질: 0, 개념: 0, 크기: 0 } }), out.c, out.r));
          b.cooking = null; b.timer = 0; b.state = 'ready'; G.Assets.playSfx('sell');
        }
      }
    } else b.state = 'idle';
  }

  function updateSorter(b, dt) {
    if (!b.buffer || !b.buffer.length) return;
    const lanes = laneInfo(b);
    // 컨베이어처럼 출력칸으로 강제 배출: 장치면 투입, 벨트/빈칸이면 화물로 밀어냄(가득이면 대기)
    const emit = (out, data) => {
      if (!inGrid(out.c, out.r)) return false;
      const dev = deviceAt(out.c, out.r);
      if (dev) return dropInto(dev, data);
      if (countCargoInCell(out.c, out.r) < C.BELT_CAP) { S.cargo.push(makeCargo(data, out.c, out.r)); return true; }
      return false;
    };
    const remaining = [];
    const hasFilter = (b.filter && b.filter.length) || (b.statFilter && b.statFilter.stat);
    for (const data of b.buffer) {
      let order;
      if (hasFilter) {
        const fl = (b.filterLane === 2) ? 1 : 0;            // 필터 출력칸(0=1번,1=2번)
        order = [matchItem(b, data) ? fl : (1 - fl)];       // 지정 칸만(막히면 대기)
      } else {
        const pref = b.toggle % 2;                          // 무필터: 교대(막히면 반대칸)
        order = [pref, 1 - pref];
      }
      let emitted = false;
      for (const li of order) {
        if (emit(lanes[li].out, data)) { if (!hasFilter) b.toggle++; emitted = true; break; }
      }
      if (!emitted) remaining.push(data);
    }
    b.buffer = remaining;
  }

  function updateGrabber(b, dt) {
    b.cd += dt;
    if (b.cd < grabberInterval()) return;
    const roles = grabberRoles(b);
    if (b.holding) {
      const drop = roles.drop;   // △ 위치
      const dev = deviceAt(drop.c, drop.r);
      if (dev) {
        if (dropInto(dev, b.holding)) { b.holding = null; b.cd = 0; } // 장치가 받음 (못 받으면 대기)
      } else if (isBeltLike(drop.c, drop.r)) {
        if (countCargoInCell(drop.c, drop.r) < C.BELT_CAP) { S.cargo.push(makeCargo(b.holding, drop.c, drop.r)); b.holding = null; b.cd = 0; } // 벨트(가득이면 대기)
      } else {
        // △ 자리에 아무것도 없음 → 풀어줌(생물=배회, 생산품=바닥에 놓음)
        if (G.CREATURES[b.holding.type]) spawnWanderer(b.holding, drop.c + 0.5, drop.r + 0.5);
        else S.cargo.push(makeCargo(b.holding, drop.c, drop.r));
        b.holding = null; b.cd = 0;
      }
    } else {
      const pk = roles.pickup;
      const dev = deviceAt(pk.c, pk.r);
      if (dev && dev.type === 'penbox') {            // 우리에서 생물 추출(필터)
        const ex = takeFromPen(dev, b); if (ex) { b.holding = ex; b.cd = 0; }
      } else if (dev && dev.type === 'warehouse') {  // 창고에서 화물 추출(필터)
        const ex = extractFromWarehouse(b); if (ex) { b.holding = ex; b.cd = 0; }
      } else {
        let found = null;
        for (const cg of S.cargo) if (Math.floor(cg.gx) === pk.c && Math.floor(cg.gy) === pk.r && matchItem(b, cg.data)) { found = cg; break; }
        if (found) { b.holding = found.data; S.cargo = S.cargo.filter(x => x !== found); b.cd = 0; }
      }
    }
  }

  /* ---- 입력 ----------------------------------------------------------- */
  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (S.screen !== 'factory' || S.overlay) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // 입력창 입력 중엔 단축키 무시
      const k = e.key;
      if (e.ctrlKey || e.metaKey) {   // Ctrl 단축키
        if (k === 'z' || k === 'Z') { e.preventDefault(); undo(); }
        else if (k === 'c' || k === 'C') { e.preventDefault(); copySelection(); }
        else if (/^[0-9]$/.test(k)) { e.preventDefault(); saveBlueprint(k); }
        return;
      }
      const lk = k.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(lk)) {
        e.preventDefault();
        closeAuxPanels();
        moveKeys[lk] = true;
        return;
      }
      if (k === 'r' || k === 'R') {
        closeAuxPanels();
        if (currentTool && G.DEVICES[currentTool].rotatable) { ghostDir = (ghostDir + 1) % 4; G.Assets.playSfx('rotate'); }
        else if (moveMode) { moving.forEach(m => { if (G.DEVICES[m.b.type].rotatable) { m.b.dir = (m.b.dir + 1) % 4; const fp = footprint(m.b.type, m.b.col, m.b.row, m.b.dir); m.b.w = fp.w; m.b.h = fp.h; } }); G.Assets.playSfx('rotate'); }
        else if (hoverBuilding) rotateBuilding(hoverBuilding);  // 호버 중 R로 회전
      } else if (k === 'Escape') {
        closeAuxPanels();
        if (pasteMode) { pasteMode = false; } else if (currentTool) cancelTool(); else if (moveMode) cancelMove(); else { S.selection = []; wallSelection = []; }
      } else if (k === 'Delete' || k === 'Backspace') {
        e.preventDefault();
        closeAuxPanels();
        if (selectedPenCreature) {
          const sold = sellPenCreatureRef(selectedPenCreature);
          selectedPenCreature = null;
          if (sold && G.UI.flash) G.UI.flash('개체 판매 ₩+' + sold.gained.toLocaleString());
        } else if (S.selection.length || wallSelection.length) { snapshot(); deleteSelection(); }
        else if (mouseCell) { snapshot(); deleteFloorAt(mouseCell); }   // 바닥 화물/배회 제거
      } else if (k === 'm' || k === 'M') {
        e.preventDefault(); closeAuxPanels(); enterMove();
      } else if (k === 'e' || k === 'E') {
        e.preventDefault(); closeAuxPanels(); activeCat = 'logistics'; renderMenuItems(); highlightCat(); selectTool('belt');
      } else if (k === 'q' || k === 'Q') {
        e.preventDefault(); closeAuxPanels(); selectTool('wall'); setStatus('벽 모드: 모서리 점에서 시작해 수평/수직으로 드래그 설치. 드래그 선택 후 Del=벽 삭제.');
      } else if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        if (hoveredMenuType) assignHotkey(k, hoveredMenuType);   // 메뉴에 올린 채 숫자 = 지정
        else if (typeForKey(k)) selectTool(typeForKey(k));        // 그냥 숫자 = 선택
      }
    });
    window.addEventListener('keyup', (e) => {
      const lk = e.key.toLowerCase();
      if (moveKeys.hasOwnProperty(lk)) moveKeys[lk] = false;
    });
  }

  /* ---- 벽(셀 경계) ---------------------------------------------------- */
  function edgeAt(gx, gy) {
    const c = Math.floor(gx), r = Math.floor(gy), fx = gx - c, fy = gy - r;
    const cand = [['V|' + c + '|' + r, fx], ['V|' + (c + 1) + '|' + r, 1 - fx], ['H|' + c + '|' + r, fy], ['H|' + c + '|' + (r + 1), 1 - fy]];
    cand.sort((a, b) => a[1] - b[1]);
    return cand[0][0];
  }
  function wallPointAt(gx, gy) {
    return { c: clamp(Math.round(gx), 0, COLS), r: clamp(Math.round(gy), 0, ROWS) };
  }
  function wallLineKeys(a, b) {
    if (!a || !b) return [];
    const keys = [];
    const dc = Math.abs(b.c - a.c), dr = Math.abs(b.r - a.r);
    if (dc >= dr) {
      const r = a.r, c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
      for (let c = c0; c < c1; c++) if (inGrid(c, r - 1) || inGrid(c, r)) keys.push('H|' + c + '|' + r);
    } else {
      const c = a.c, r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
      for (let r = r0; r < r1; r++) if (inGrid(c - 1, r) || inGrid(c, r)) keys.push('V|' + c + '|' + r);
    }
    return keys;
  }
  function commitWallLine() {
    const keys = wallLineKeys(wallStartPoint, wallEndPoint || wallStartPoint).filter(k => !S.walls[k]);
    const cost = keys.length * (G.BUILD_COST.wall || 0);
    if (!spend(cost)) return;
    keys.forEach(k => { S.walls[k] = true; });
    if (keys.length) G.Assets.playSfx('place');
  }
  function wallsInRect(a, b) {
    const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
    const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
    return Object.keys(S.walls).filter(k => {
      const p = k.split('|'), x = +p[1], y = +p[2];
      if (p[0] === 'V') return x >= minC && x <= maxC + 1 && y >= minR && y <= maxR;
      return x >= minC && x <= maxC && y >= minR && y <= maxR + 1;
    });
  }
  // (ox,oy)→(nx,ny) 이동 시 벽을 통과하면 경계 직전으로 막음
  function wallBlock(ox, oy, nx, ny) {
    if (nx !== ox) {
      for (const key in S.walls) {
        if (!S.walls[key] || key[0] !== 'V') continue;
        const p = key.split('|'), X = +p[1], R = +p[2];
        const cy = clamp(oy, R, R + 1);
        if (Math.abs(oy - cy) > COLLIDE) continue;
        if (ox <= X - COLLIDE && nx > X - COLLIDE) { nx = X - COLLIDE; break; }
        if (ox >= X + COLLIDE && nx < X + COLLIDE) { nx = X + COLLIDE; break; }
      }
    }
    if (ny !== oy) {
      for (const key in S.walls) {
        if (!S.walls[key] || key[0] !== 'H') continue;
        const p = key.split('|'), C0 = +p[1], Y = +p[2];
        const cx = clamp(nx, C0, C0 + 1);
        if (Math.abs(nx - cx) > COLLIDE) continue;
        if (oy <= Y - COLLIDE && ny > Y - COLLIDE) { ny = Y - COLLIDE; break; }
        if (oy >= Y + COLLIDE && ny < Y + COLLIDE) { ny = Y + COLLIDE; break; }
      }
    }
    for (const key in S.walls) {
      if (!S.walls[key]) continue;
      const p = key.split('|'), A = +p[1], B = +p[2];
      if (p[0] === 'V') {
        const cy = clamp(ny, B, B + 1);
        if (Math.abs(ny - cy) <= COLLIDE && Math.abs(nx - A) < COLLIDE) nx = (ox < A) ? A - COLLIDE : A + COLLIDE;
      } else {
        const cx = clamp(nx, A, A + 1);
        if (Math.abs(nx - cx) <= COLLIDE && Math.abs(ny - B) < COLLIDE) ny = (oy < B) ? B - COLLIDE : B + COLLIDE;
      }
    }
    for (const pen of G.Pens.allPens()) {
      const x0 = pen.col - COLLIDE, x1 = pen.col + pen.w + COLLIDE;
      const y0 = pen.row - COLLIDE, y1 = pen.row + pen.h + COLLIDE;
      if (nx <= x0 || nx >= x1 || ny <= y0 || ny >= y1) continue;
      const wasInside = ox > x0 && ox < x1 && oy > y0 && oy < y1;
      if (wasInside) continue;
      const dx0 = Math.abs(nx - x0), dx1 = Math.abs(x1 - nx), dy0 = Math.abs(ny - y0), dy1 = Math.abs(y1 - ny);
      const m = Math.min(dx0, dx1, dy0, dy1);
      if (m === dx0) nx = x0;
      else if (m === dx1) nx = x1;
      else if (m === dy0) ny = y0;
      else ny = y1;
    }
    return { x: nx, y: ny };
  }

  function bindCanvas() {
    canvas.addEventListener('mousemove', (e) => {
      if (panning && panStart) {
        cam.x = panStart.camx - (e.clientX - panStart.x) * (canvas.width / canvas.getBoundingClientRect().width) / cam.zoom;
        cam.y = panStart.camy - (e.clientY - panStart.y) * (canvas.height / canvas.getBoundingClientRect().height) / cam.zoom;
        clampCamera();
      }
      mouseCell = screenToCell(e.clientX, e.clientY);
      const w = screenToWorld(e.clientX, e.clientY);
      if (w) { mouseGX = w.wx; mouseGY = w.wy; }
      if (wallDragging) wallEndPoint = wallPointAt(mouseGX, mouseGY);
      if (beltDragging && mouseCell) extendBeltPath(mouseCell);
      if (pendingSelect && !selDragging && selDownClient &&
          (Math.abs(e.clientX - selDownClient.x) > 5 || Math.abs(e.clientY - selDownClient.y) > 5)) selDragging = true;
      hoverBuilding = (!currentTool && !moveMode && mouseCell) ? buildingAtCell(mouseCell) : null;
    });
    canvas.addEventListener('mouseleave', () => { mouseCell = null; hoverBuilding = null; });

    // 휠 스크롤=확대/축소, 휠(중간)버튼 드래그=화면 이동
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); closeAuxPanels(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); closeAuxPanels(); panning = true; panStart = { x: e.clientX, y: e.clientY, camx: cam.x, camy: cam.y }; return; }
      if (e.button !== 0) return;
      const cell = screenToCell(e.clientX, e.clientY);
      if (!cell) return;
      if (pasteMode) { pasteAt(cell.col, cell.row); return; }   // 붙여넣기
      if (moveMode) { tryDropMove(); return; }
      if (currentTool && !isOwnedCell(cell.col, cell.row)) { closeAuxPanels(); showLandPrompt(cell, e.clientX, e.clientY); return; }
      if (currentTool === 'wall') { closeAuxPanels(); snapshot(); wallDragging = true; wallStartPoint = wallPointAt(mouseGX, mouseGY); wallEndPoint = wallStartPoint; return; }
      if (currentTool === 'belt' || currentTool === 'guardbelt') { closeAuxPanels(); snapshot(); beltDragging = true; beltPath = [{ col: cell.col, row: cell.row }]; }
      else if (currentTool === 'penbox') { closeAuxPanels(); snapshot(); penDragStart = cell; }
      else if (currentTool === 'crossbelt') { closeAuxPanels(); snapshot(); const o = ghostOrigin('crossbelt', cell, ghostDir); if (placeDevice('crossbelt', o.col, o.row, ghostDir)) G.Assets.playSfx('place'); }
      else if (currentTool) { closeAuxPanels(); snapshot(); const o = ghostOrigin(currentTool, cell, ghostDir); if (placeDevice(currentTool, o.col, o.row, ghostDir)) G.Assets.playSfx('place'); }
      else {
        closeAuxPanels();
        const hit = creatureAtClient(e.clientX, e.clientY);  // 벨트 위/배회 생물 집기·정보
        if (hit) { startCreatureDrag(hit, e); return; }
        pendingSelect = true; selDragging = false; selStartCell = cell; selDownClient = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1 || panning) { panning = false; panStart = null; }
      if (wallDragging) { commitWallLine(); wallDragging = false; wallStartPoint = null; wallEndPoint = null; return; }
      if (beltDragging) {
        commitBelts();
        beltDragging = false; beltPath = [];
        return;
      }
      if (penDragStart) {
        const end = mouseCell || penDragStart;
        const col = Math.min(penDragStart.col, end.col), row = Math.min(penDragStart.row, end.row);
        const w = Math.abs(end.col - penDragStart.col) + 1, h = Math.abs(end.row - penDragStart.row) + 1;
        const existing = deviceAt(penDragStart.col, penDragStart.row);
        if (existing && existing.type === 'penbox') { if (expandPen(existing, col, row, w, h)) G.Assets.playSfx('place'); }
        else if (makePen(col, row, w, h)) G.Assets.playSfx('place');
        penDragStart = null;
        return;
      }
      if (pendingSelect) {
        const cell = screenToCell(e.clientX, e.clientY) || selStartCell;
        if (selDragging) selectInRect(selStartCell, cell || selStartCell);
        else {
          if (cell && !buildingAtCell(cell)) showLandPrompt(cell, e.clientX, e.clientY);
          selectAt(cell, e.clientX, e.clientY);
        }
        pendingSelect = false; selDragging = false; selStartCell = null; selDownClient = null;
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      if (currentTool || moveMode) return;
      const cell = screenToCell(e.clientX, e.clientY);
      if (cell) selectSameType(cell);
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      closeAuxPanels();
      if (pasteMode) { pasteMode = false; setStatus('붙여넣기 취소.'); return; }
      if (currentTool) { cancelTool(); return; }
      if (moveMode) { cancelMove(); return; }
      S.selection = []; wallSelection = [];
    });
  }

  // 캔버스 위 생물(화물/배회/우리 안) 히트테스트 → {data, remove(), fgx,fgy}
  function creatureAtClient(cx, cy) {
    const w = screenToWorld(cx, cy); if (!w) return null;
    const gx = w.wx, gy = w.wy;
    let best = null, bd = 0.5;
    // 우리 안 생물
    for (const pen of S.buildings) {
      if (pen.type !== 'penbox') continue;
      for (const c of pen.creatures) {
        const wx = pen.col + (c.px || 0.5), wy = pen.row + (c.py || 0.5);
        const d = Math.hypot(wx - gx, wy - gy);
        if (d < bd) { bd = d; best = { data: c, pen, fgx: wx, fgy: wy, remove: () => { const i = pen.creatures.indexOf(c); if (i >= 0) pen.creatures.splice(i, 1); } }; }
      }
    }
    for (const w of S.wanderers) {
      if (!G.CREATURES[w.data.type] || !isOwnedCell(Math.floor(w.gx), Math.floor(w.gy))) continue;
      const d = Math.hypot(w.gx - gx, w.gy - gy);
      if (d < bd) { bd = d; best = { data: w.data, fgx: w.gx, fgy: w.gy, remove: () => { S.wanderers = S.wanderers.filter(x => x !== w); } }; }
    }
    for (const cg of S.cargo) {
      if (!G.CREATURES[cg.data.type] || !isOwnedCell(Math.floor(cg.gx), Math.floor(cg.gy))) continue;
      const d = Math.hypot(cg.gx - gx, cg.gy - gy);
      if (d < bd) { bd = d; best = { data: cg.data, fgx: cg.gx, fgy: cg.gy, remove: () => { S.cargo = S.cargo.filter(x => x !== cg); } }; }
    }
    return best;
  }
  function startCreatureDrag(hit, e) {
    const data = hit.data;
    let sx = e.clientX, sy = e.clientY, dragging = false, ghost = null;
    const move = (ev) => {
      if (!dragging && (Math.abs(ev.clientX - sx) > 5 || Math.abs(ev.clientY - sy) > 5)) {
        dragging = true; hit.remove();
        ghost = document.createElement('div'); ghost.className = 'drag-ghost';
        ghost.textContent = '#' + data.id + ' ' + (G.CREATURES[data.type] ? G.CREATURES[data.type].label : data.type);
        document.body.appendChild(ghost);
      }
      if (dragging && ghost) { ghost.style.left = (ev.clientX + 12) + 'px'; ghost.style.top = (ev.clientY + 12) + 'px'; hoverDropTarget(ev.clientX, ev.clientY); }
    };
    const up = (ev) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      clearDropHover();
      if (!dragging) {
        selectedPenCreature = hit.pen ? { pen: hit.pen, creature: data } : null;
        G.UI.showCreatureInfo(data, ev.clientX, ev.clientY);
        return;
      }
      selectedPenCreature = null;
      if (ghost) ghost.remove();
      const cell = screenToCell(ev.clientX, ev.clientY);
      if (cell && isOwnedCell(cell.col, cell.row)) dropCreatureAt(cell, data);
      else spawnWanderer(data, hit.fgx, hit.fgy);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  function dropCreatureAt(cell, data) {
    const dev = deviceAt(cell.col, cell.row);
    if (dev && dropInto(dev, data)) return;            // 우리/장치에 투입(dropInto가 penbox 처리)
    if (isBeltLike(cell.col, cell.row) && countCargoInCell(cell.col, cell.row) < C.BELT_CAP) { S.cargo.push(makeCargo(data, cell.col, cell.row)); return; }
    spawnWanderer(data, cell.col + 0.5, cell.row + 0.5); // 빈 바닥 → 배회
  }

  // 벨트 경로 확장 (드래그 방향대로 꺾임)
  function extendBeltPath(cur) {
    const last = beltPath[beltPath.length - 1];
    if (cur.col === last.col && cur.row === last.row) return;
    if (beltPath.length >= 2) {
      const prev = beltPath[beltPath.length - 2];
      if (cur.col === prev.col && cur.row === prev.row) { beltPath.pop(); return; }
    }
    let c = last.col, r = last.row;
    while ((c !== cur.col || r !== cur.row) && beltPath.length < 500) {
      if (c !== cur.col) c += Math.sign(cur.col - c);
      else r += Math.sign(cur.row - r);
      beltPath.push({ col: c, row: r });
    }
  }
  function pathWithDirs() {
    const p = beltPath;
    return p.map((cell, i) => {
      let dir;
      if (i < p.length - 1) dir = dirFromTo(p[i], p[i + 1]);
      else dir = p.length > 1 ? dirFromTo(p[i - 1], p[i]) : ghostDir;
      return { col: cell.col, row: cell.row, dir };
    });
  }
  function commitBelts() {
    const beltType = currentTool === 'guardbelt' ? 'guardbelt' : 'belt';
    if (beltPath.length === 1) {
      // 단일 클릭: 현재 칸에 1칸 설치(기존 벨트는 attach에서 삭제 후 대체)
      const cell = beltPath[0];
      if (placeBelt(cell.col, cell.row, ghostDir, beltType)) G.Assets.playSfx('place');
      return;
    }
    let placed = false;
    for (const seg of pathWithDirs()) if (placeBelt(seg.col, seg.row, seg.dir, beltType)) placed = true;
    if (placed) G.Assets.playSfx('place');
  }
  function dirFromTo(a, b) {
    if (b.col > a.col) return 1; if (b.col < a.col) return 3;
    if (b.row > a.row) return 2; if (b.row < a.row) return 0; return 1;
  }
  // 횡단벨트: 3칸 벨트를 한 번에 (가운데를 다른 벨트가 교차 가능)
  function placeCrossbelt(cell, dir) {
    const o = ghostOrigin('crossbelt', cell, dir);
    let placed = false;
    for (const c of footprint('crossbelt', o.col, o.row, dir).cells) if (placeBelt(c.c, c.r, dir)) placed = true;
    if (placed) G.Assets.playSfx('place');
  }

  /* ---- 렌더 ----------------------------------------------------------- */
  function drawGivenBorder() {
    const x = ((COLS - C.GIVEN_COLS) / 2) * CELL, y = ((ROWS - C.GIVEN_ROWS) / 2) * CELL;
    ctx.strokeStyle = 'rgba(120,200,255,0.45)'; ctx.lineWidth = 3 / cam.zoom; ctx.setLineDash([14 / cam.zoom, 9 / cam.zoom]);
    ctx.strokeRect(x, y, C.GIVEN_COLS * CELL, C.GIVEN_ROWS * CELL); ctx.setLineDash([]);
  }
  function drawLandGrid(vx0, vy0, vx1, vy1) {
    const n = C.LAND_GRID_SIZE || 40;
    const gc0 = Math.floor(vx0 / n), gc1 = Math.floor(vx1 / n);
    const gr0 = Math.floor(vy0 / n), gr1 = Math.floor(vy1 / n);
    ctx.save();
    for (let gy = gr0; gy <= gr1; gy++) for (let gx = gc0; gx <= gc1; gx++) {
      const x = gx * n * CELL, y = gy * n * CELL, key = gx + '|' + gy;
      const owned = !!S.ownedLand[key];
      if (owned) {
        ctx.fillStyle = 'rgba(100,180,120,0.035)';
        ctx.fillRect(x, y, n * CELL, n * CELL);
      }
      ctx.strokeStyle = owned ? 'rgba(120,220,160,0.28)' : 'rgba(255,217,100,0.18)';
      ctx.lineWidth = (owned ? 2 : 1.5) / cam.zoom;
      ctx.strokeRect(x, y, n * CELL, n * CELL);
    }
    ctx.restore();
  }
  function render() {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = G.Assets.bgImg('factory');
    if (bg && bg.ok) ctx.drawImage(bg.img, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = '#23262e'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    ctx.save();
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom, -cam.y * cam.zoom);

    // 가시 셀 범위
    const vx0 = cam.x / CELL, vy0 = cam.y / CELL;
    const vx1 = (cam.x + canvas.width / cam.zoom) / CELL, vy1 = (cam.y + canvas.height / cam.zoom) / CELL;
    const c0 = Math.max(0, Math.floor(vx0)), c1 = Math.min(COLS, Math.ceil(vx1));
    const r0 = Math.max(0, Math.floor(vy0)), r1 = Math.min(ROWS, Math.ceil(vy1));

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1 / cam.zoom;
    for (let c = c0; c <= c1; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, r0 * CELL); ctx.lineTo(c * CELL, r1 * CELL); ctx.stroke(); }
    for (let r = r0; r <= r1; r++) { ctx.beginPath(); ctx.moveTo(c0 * CELL, r * CELL); ctx.lineTo(c1 * CELL, r * CELL); ctx.stroke(); }
    drawLandGrid(vx0, vy0, vx1, vy1);
    drawGivenBorder();

    const vis = (b) => !(b.col > vx1 || b.col + b.w < vx0 || b.row > vy1 || b.row + b.h < vy0);
    drawStains();
    for (const b of S.buildings) if ((b.type === 'belt' || b.type === 'guardbelt') && vis(b)) drawBelt(b);
    for (const b of S.buildings) if (b.type !== 'belt' && b.type !== 'guardbelt' && b.type !== 'grabber' && vis(b)) drawDevice(b);
    for (const b of S.buildings) if (b.type === 'grabber' && vis(b)) drawGrabber(b);
    // 바닥 위 개체(화물+배회): y 큰(아래) 쪽을 나중에 그림(입체감)
    const floor = [];
    for (const cg of S.cargo) if (cg.gx > vx0 - 1 && cg.gx < vx1 + 1 && cg.gy > vy0 - 1 && cg.gy < vy1 + 1) floor.push({ y: cg.gy, d: drawCargo, a: cg });
    for (const w of S.wanderers) if (w.gx > vx0 - 1 && w.gx < vx1 + 1 && w.gy > vy0 - 1 && w.gy < vy1 + 1) floor.push({ y: w.gy, d: drawWanderer, a: w });
    floor.sort((p, q) => p.y - q.y);
    for (const f of floor) f.d(f.a);
    drawParticles();
    drawWalls();
    drawSelection();
    drawGhost();
    drawMoveGhost();
    drawSelectRect();
    ctx.restore();

    updateFilterPanel();
    updatePenPanel();
    updateBirthingPanel();
  }

  function drawBelt(b) {
    const x = b.col * CELL, y = b.row * CELL;
    const curve = beltCurveInfo(b);
    let ok = false;
    ctx.save(); ctx.translate(x + CELL / 2, y + CELL / 2);
    if (curve) {
      ctx.rotate(curve.rot * Math.PI / 2);
      if (curve.flip) ctx.scale(-1, 1);
      ok = G.Assets.drawDeviceSpriteNamed(ctx, 'belt_curve.png', -CELL / 2, -CELL / 2, CELL, CELL);
    } else {
      ctx.rotate((b.dir - 1) * Math.PI / 2);
      ok = G.Assets.drawDeviceSprite(ctx, 'belt', -CELL / 2, -CELL / 2, CELL, CELL);
    }
    ctx.restore();
    if (!ok) {
      ctx.fillStyle = G.DEVICES[b.type].color; ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      // 흐름 표현: 화살표가 진행방향으로 살짝 이동
      const v = DIR.vec[b.dir], off = (G.Assets.frame() - 1.5) * 6;
      drawArrow(x + CELL / 2 + v.x * off, y + CELL / 2 + v.y * off, b.dir, '#cdd');
    }
    if (b.type === 'guardbelt') {
      ctx.save();
      ctx.strokeStyle = '#9ee6ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
      if (b.axis === 'h') {
        ctx.beginPath(); ctx.moveTo(x + 5, y + 9); ctx.lineTo(x + CELL - 5, y + 9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 5, y + CELL - 9); ctx.lineTo(x + CELL - 5, y + CELL - 9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x + 9, y + 5); ctx.lineTo(x + 9, y + CELL - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + CELL - 9, y + 5); ctx.lineTo(x + CELL - 9, y + CELL - 5); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function beltAt(c, r) {
    const bc = beltCell(c, r);
    return bc ? (bc.h || bc.v) : null;
  }
  function beltCurveInfo(b) {
    let incoming = null;
    for (let d = 0; d < 4; d++) {
      const v = DIR.vec[d], nb = beltAt(b.col - v.x, b.row - v.y);
      if (nb && nb.dir === d) { incoming = d; break; }
    }
    if (incoming == null || incoming === b.dir || (incoming + 2) % 4 === b.dir) return null;
    if ((incoming + 1) % 4 === b.dir) return { rot: (incoming - 1 + 4) % 4, flip: false };
    if ((incoming + 3) % 4 === b.dir) return { rot: (incoming - 3 + 4) % 4, flip: true };
    return null;
  }
  function drawArrow(cx, cy, dir, color) {
    const v = DIR.vec[dir], len = 13;
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - v.x * len, cy - v.y * len); ctx.lineTo(cx + v.x * len, cy + v.y * len); ctx.stroke();
    const ang = Math.atan2(v.y, v.x);
    ctx.beginPath(); ctx.moveTo(cx + v.x * len, cy + v.y * len);
    ctx.lineTo(cx + v.x * len - 7 * Math.cos(ang - 0.5), cy + v.y * len - 7 * Math.sin(ang - 0.5));
    ctx.lineTo(cx + v.x * len - 7 * Math.cos(ang + 0.5), cy + v.y * len - 7 * Math.sin(ang + 0.5));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawTransport(b) {
    const def = G.DEVICES[b.type], e = transportEnds(b);
    ctx.save();
    [e.back, e.front].forEach((cell, i) => {
      const x = cell.c * CELL, y = cell.r * CELL;
      ctx.fillStyle = def.color;
      ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
      ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.25)' : '#fc5';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 5, y + 5, CELL - 10, CELL - 10);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 8, y + CELL / 2 - 8, CELL - 16, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(i === 0 ? '입' : '출', x + CELL / 2, y + CELL / 2);
    });
    drawArrow(e.back.c * CELL + CELL / 2, e.back.r * CELL + CELL / 2, b.dir, '#cfe');
    if (b.queue && b.queue.length) {
      ctx.fillStyle = '#ffd964'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('●' + b.queue.length, e.front.c * CELL + CELL / 2, e.front.r * CELL + CELL - 4);
    }
    ctx.restore();
  }

  function drawDevice(b) {
    if (b.type === 'tunnel' || b.type === 'crossbelt') { drawTransport(b); return; }
    const x = b.col * CELL, y = b.row * CELL, w = b.w * CELL, h = b.h * CELL;
    const def = G.DEVICES[b.type];
    const frameIdx = (def && def.cat === 'processing' && !isDeviceAnimating(b)) ? 0 : null;
    // 우리(penbox)는 9분할 울타리(아래 drawPen). 출산대는 장착 여부에 따라 birthing_ready/birthing.
    let drawn = false;
    if (b.type === 'penbox') drawn = true;
    else if (b.type === 'birthing') drawn = G.Assets.drawDeviceSpriteNamed(ctx, b.worker ? 'birthing.png' : 'birthing_ready.png', x + 1, y + 1, w - 2, h - 2);
    else if (b.type === 'correction') {
      drawn = b.teacher
        ? G.Assets.drawDeviceSpriteNamed(ctx, 'correction_teacher.png', x + 1, y + 1, w - 2, h - 2, frameIdx)
        : G.Assets.drawDeviceSprite(ctx, b.type, x + 1, y + 1, w - 2, h - 2, frameIdx);
    }
    else if (b.type === 'pointer') drawn = drawRotatedDeviceSprite(b, x, y, w, h);
    else if (b.type === 'skewer') drawn = drawSkewerDevice(b, x, y);
    else drawn = G.Assets.drawDeviceSprite(ctx, b.type, x + 1, y + 1, w - 2, h - 2, frameIdx);
    if (!drawn) {
      ctx.fillStyle = def.color; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = Math.max(9, Math.floor((h - 2) * 0.18)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.name + (b.type === 'birthing' && !b.worker ? '(빈)' : ''), x + w / 2, y + h / 2);
    }
    if (dropHoverId === b.id) { ctx.strokeStyle = '#7fe'; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); }

    if (b.type === 'washbasin') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.washTimer / (C.WASH_TIME / workerMult(b)), b.state); drawWorkerSlots(b, x, y, w);
    } else if (b.type === 'birthing') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.birthTimer / C.BIRTH_INTERVAL, b.state);
      if (b.worker) drawProgressBar(x, y + h - 12, w, 1 - b.lifeTimer / C.BIRTH_LIFESPAN, 'life');
      // 장착 실장석은 표시하지 않음(birthing/birthing_ready 스프라이트로 상태 구분)
    } else if (['slaughter', 'deshell'].includes(b.type)) {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.item ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      drawItem(b, x, y); drawWorkerSlots(b, x, y, w);
    } else if (b.type === 'correction') {
      markEdge(sideCell(b, b.dir), '사육출', '#9f9'); markEdge(sideCell(b, (b.dir + 2) % 4), '육출', '#f99');
      drawCorrection(b, x, y, w, h);
    } else if (b.type === 'grinder') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, (b.weight || 0) / C.GRIND_TARGET, 'life');
      drawItem(b, x, y);
      ctx.fillStyle = '#dfd'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('무게 ' + Math.floor(b.weight || 0), x + w / 2, y + h - 14);
    } else if (b.type === 'mixer') {
      drawProgressBar(x, y + h - 6, w, (b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI) ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('분쇄육 ' + (b.slotMeat ? '✓' : '·'), x + w / 2, y + h / 2 + 2);
      ctx.fillText('운치 ' + (b.unchiN || 0) + '/' + C.MIX_UNCHI, x + w / 2, y + h / 2 + 16);
      drawWorkerSlots(b, x, y, w);
    } else if (b.type === 'cookery') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.cooking ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const cook = def.cook; let li = 0;
      for (const mat in cook) {
        const have = (b.mats && b.mats[mat]) || 0;
        if (have > 0) { ctx.fillText(mat + ' ' + have + '/' + cook[mat].n, x + 4, y + 11 + li * 10); li++; }
      }
      ctx.textAlign = 'center';
      ctx.fillText('🧂' + Math.floor(S.seasoning), x + w / 2, y + h / 2);
      drawWorkerSlots(b, x, y, w);
    } else if (b.type === 'penbox') {
      drawPen(b, x, y, w, h);
    } else if (b.type === 'warehouse') {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★ 창고 ★', x + w / 2, y + h / 2);
      ctx.font = '9px sans-serif'; ctx.fillText('통계창서 판매', x + w / 2, y + h / 2 + 14);
    } else if (b.type === 'sorter') {
      const lanes = laneInfo(b);
      lanes.forEach((ln, i) => {
        const cx = ln.cell.c * CELL + CELL / 2, cy = ln.cell.r * CELL + CELL / 2;
        drawArrow(cx, cy, b.dir, '#6cf');
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText((i + 1) + '번', ln.cell.c * CELL + 3, ln.cell.r * CELL + 3);
      });
      const n = b.buffer ? b.buffer.length : 0;
      if (n) { ctx.fillStyle = '#ffd964'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('●' + n, x + w - 3, y + h - 3); }
    } else if (b.type === 'tunnel') {
      const e = tunnelEnds(b);
      markEdge(e.exit, '출', '#fc5');
      const n = b.queue ? b.queue.length : 0;
      if (n) { ctx.fillStyle = '#ffd964'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('●' + n, (b.col + b.w / 2) * CELL, (b.row + b.h / 2) * CELL); }
    } else if (def.special) {
      if (S.selection.includes(b.id)) drawRangeOverlay(rangeRect(b.type, b.col, b.row, b.dir), '#ffd24a', 0.10); // 선택 시 영향 범위
      if (def.special === 'catch') markEdge(outputCell(b), '출', '#fc5');
      if (def.special === 'skewer') {
        drawSkewerDevice(b, x, y);
      }
      if (def.special === 'skewer' && b.held && !skewerLoadedSpriteExists()) {
        const cd = G.CREATURES[b.held.type];
        if (!G.Assets.drawCreatureNative(ctx, b.held.type, x + w / 2, y + h / 2, 0)) { ctx.fillStyle = cd ? cd.color : '#fff'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✚', x + w / 2, y + 4);
      }
    }
    if (b.speechT > 0 && b.speech) drawBubble(x + w / 2, y - 2, b.speech);
  }
  function isDeviceAnimating(b) {
    if (b.state === 'producing') return true;
    if (b.type === 'washbasin') return !!b.item;
    if (b.type === 'grinder') return !!b.item;
    if (b.type === 'mixer') return !!(b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI);
    if (b.type === 'cookery') return !!b.cooking;
    if (b.type === 'correction') return !!(b.inmates && b.inmates.length);
    if (b.type === 'slaughter' || b.type === 'deshell') return !!b.item;
    return false;
  }
  function drawRotatedDeviceSprite(b, x, y, w, h) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((b.dir - 1) * Math.PI / 2); // 기본 스프라이트 방향: →
    const ok = G.Assets.drawDeviceSprite(ctx, b.type, -w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
    ctx.restore();
    return ok;
  }
  function skewerLoadedSpriteExists() {
    const rec = G.Assets.loadImage('assets/images/devices/skewer_dev_loaded.png');
    return !!(rec && rec.ok);
  }
  function drawSkewerDevice(b, x, y) {
    const fileName = b.held ? 'skewer_dev_loaded.png' : 'skewer_dev.png';
    const dw = 48, dh = 96;
    const dx = x, dy = y + CELL - dh;
    const ok = G.Assets.drawDeviceSpriteNamed(ctx, fileName, dx, dy, dw, dh);
    if (!ok && b.held) return G.Assets.drawDeviceSpriteNamed(ctx, 'skewer_dev.png', dx, dy, dw, dh);
    if (ok) return true;
    ctx.save();
    ctx.fillStyle = G.DEVICES.skewer.color;
    ctx.fillRect(dx + 2, dy + 8, dw - 4, dh - 16);
    ctx.strokeStyle = '#ffd9a0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(dx + 8, dy + dh / 2);
    ctx.lineTo(dx + dw - 8, dy + dh / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.held ? '장착' : '꼬챙이', x + CELL / 2, y + CELL / 2);
    ctx.restore();
    return true;
  }
  function drawRangeOverlay(r, color, alpha) {
    if (!r) return;
    const x = r.x0 * CELL, y = r.y0 * CELL, w = (r.x1 - r.x0) * CELL, h = (r.y1 - r.y0) * CELL;
    ctx.save();
    ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
    ctx.restore();
  }
  // 말풍선 (장치/실장석 공용) — 캔버스 좌표
  function drawBubble(cx, topY, text) {
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const padX = 5, tw = ctx.measureText(text).width, bw = tw + padX * 2, bh = 16;
    const bx = cx - bw / 2, by = topY - bh - 4;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); }
    else ctx.fillRect(bx, by, bw, bh);
    ctx.beginPath(); ctx.moveTo(cx - 4, by + bh); ctx.lineTo(cx + 4, by + bh); ctx.lineTo(cx, by + bh + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillText(text, cx, by + bh / 2);
  }
  function drawWorkerSlots(b, x, y, w) {
    if (!b.workers) return;
    const n = C.WORKER_SLOTS, sz = 10, gap = 2;
    const startX = x + w - n * (sz + gap) - 2, sy = y + 2;
    for (let i = 0; i < n; i++) {
      const sx = startX + i * (sz + gap), wk = b.workers[i];
      if (wk) { if (!G.Assets.drawCreatureSprite(ctx, wk.type, sx, sy, sz, sz, 0)) { const d = G.CREATURES[wk.type]; ctx.fillStyle = d ? d.color : '#fff'; ctx.fillRect(sx, sy, sz, sz); } ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sz - 1, sz - 1); }
      else { ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sz - 1, sz - 1); }
    }
  }
  function drawWorker(b, x, y) {
    if (!b.worker) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('성체 투입', x + 26, y + 13); return; }
    const def = G.CREATURES[b.worker.type];
    const cx = (b.col + b.w / 2) * CELL, cy = (b.row + b.h / 2) * CELL;   // 본연 스프라이트(중앙)
    if (!G.Assets.drawCreatureNative(ctx, b.worker.type, cx, cy, 0)) { ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill(); }
  }
  function drawItem(b, x, y) {
    if (!b.item) return;
    const cx = (b.col + b.w / 2) * CELL, cy = (b.row + b.h / 2) * CELL;
    if (G.CREATURES[b.item.type]) { if (G.Assets.drawCreatureNative(ctx, b.item.type, cx, cy, 0)) return; } // 장착 실장석은 본연 스프라이트
    const d = G.CREATURES[b.item.type] || G.PRODUCTS[b.item.type];
    ctx.fillStyle = d ? d.color : '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  }
  function markCell(cell, label, color) {
    const x = cell.c * CELL, y = cell.r * CELL;
    ctx.fillStyle = color; ctx.globalAlpha = 0.25; ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(label, x + CELL / 2, y + 3);
  }
  function markEdge(cell, label, color) {
    if (!inGrid(cell.c, cell.r)) return;
    const x = cell.c * CELL, y = cell.r * CELL;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6); ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(label, x + CELL / 2, y + 3);
  }
  function drawProgressBar(x, y, w, ratio, state) {
    ratio = clamp(ratio, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 2, y, w - 4, 5);
    let col = '#6cf'; if (state === 'life') col = '#e85'; else if (state === 'ready') col = '#9b9';
    ctx.fillStyle = col; ctx.fillRect(x + 2, y, (w - 4) * ratio, 5);
  }
  function markFootprint(b, label, color) {
    const x = b.col * CELL, y = b.row * CELL;
    ctx.fillStyle = color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(label, x + 4, y + 3);
  }
  // 우리 울타리: 144x144 png를 48x48 9분할(모서리/변/중앙)해 칸마다 타일 배치(무애니)
  function drawPenFence(b, x, y, w, h) {
    const rec = G.Assets.deviceImg('penbox');
    if (rec && rec.ok && rec.img.width) {
      const aw = rec.img.width / 3, ah = rec.img.height / 3;
      for (let rr = 0; rr < b.h; rr++) for (let cc = 0; cc < b.w; cc++) {
        const ac = (b.w === 1) ? 1 : (cc === 0 ? 0 : cc === b.w - 1 ? 2 : 1);
        const ar = (b.h === 1) ? 1 : (rr === 0 ? 0 : rr === b.h - 1 ? 2 : 1);
        ctx.drawImage(rec.img, ac * aw, ar * ah, aw, ah, (b.col + cc) * CELL, (b.row + rr) * CELL, CELL, CELL);
      }
    } else {
      // 플레이스홀더: 울타리 느낌(반투명 채움 + 칸 격자 기둥)
      ctx.fillStyle = 'rgba(74,106,58,0.16)'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#7aa055'; ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = 'rgba(150,190,120,0.35)'; ctx.lineWidth = 1;
      for (let cc = 1; cc < b.w; cc++) { ctx.beginPath(); ctx.moveTo((b.col + cc) * CELL, y); ctx.lineTo((b.col + cc) * CELL, y + h); ctx.stroke(); }
      for (let rr = 1; rr < b.h; rr++) { ctx.beginPath(); ctx.moveTo(x, (b.row + rr) * CELL); ctx.lineTo(x + w, (b.row + rr) * CELL); ctx.stroke(); }
    }
  }
  function drawPen(b, x, y, w, h) {
    drawPenFence(b, x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(x + 1, y + 1, w - 2, 15);
    ctx.fillStyle = '#cfe'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(b.name || '우리', x + 4, y + 3);
    ctx.fillStyle = '#ffd964'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('성' + G.Pens.countAdult(b) + '/' + G.Pens.capAdult(b) + ' 새' + G.Pens.countYoung(b) + '/' + G.Pens.capYoung(b), x + w - 4, y + 3);
    const sorted = b.creatures.slice().sort((p, q) => (p.py || 0) - (q.py || 0)); // 아래쪽 우선(입체감)
    for (const c of sorted) drawPennedCreature((b.col + (c.px || 0.5)) * CELL, (b.row + (c.py || 0.5)) * CELL, c);
  }
  // 교정시설: 자실장들이 줄 서서 위를 바라봄(dirRow 3) + 스탯/말풍선
  function drawCorrection(b, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 1, y + 1, w - 2, 13);
    ctx.fillStyle = '#cfe'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('교정시설 ' + (b.inmates ? b.inmates.length : 0) + '/' + G.DEVICES.correction.hold, x + 4, y + 3);
    ctx.textAlign = 'right';
    ctx.fillStyle = b.teacher ? '#9fe' : '#899';
    ctx.fillText(b.teacher ? ('교사 ' + Math.floor((b.teacher.stats && b.teacher.stats.개념) || 0) + '%') : '교사 없음', x + w - 4, y + 3);
    const list = b.inmates || []; const cols = 3;
    for (let i = 0; i < list.length; i++) {
      const m = list[i]; const gc = i % cols, gr = Math.floor(i / cols);
      const cx = x + (gc + 0.5) * (w / cols), cy = y + 20 + gr * 22 + 8 + 48;
      if (!G.Assets.drawCreatureNative(ctx, m.type, cx, cy, 3)) { const d = G.CREATURES[m.type]; ctx.fillStyle = d ? d.color : '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 15, cy + 7, 30, 9);
      ctx.fillStyle = '#fff'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.floor(m.stats.육질 || 0) + '/' + Math.floor(m.stats.개념 || 0), cx, cy + 11.5);
      if (m.speechT > 0 && m.speech) drawBubble(cx, cy - 8, m.speech);
    }
  }
  function drawPennedCreature(cx, cy, c) {
    const sz = 18 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[c.type]) || 1), def = G.CREATURES[c.type];
    let vx = c.pvx || 0, vy = c.pvy || 0; if (c.flee && c.flee.t > 0) { vx = c.flee.vx; vy = c.flee.vy; }
    if (!G.Assets.drawCreatureNative(ctx, c.type, cx, cy, G.Assets.dirRow(vx, vy))) {  // 원본크기
      ctx.fillStyle = def ? def.color : '#fff'; ctx.beginPath(); ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2); ctx.fill();
    }
    const g = G.Creatures.gradeOfStats(c.stats); ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(cx + 7, cy - 6, 3, 0, Math.PI * 2); ctx.fill();
    // 하단 스탯 표시 (육질/개념/크기)
    if (c.stats) {
      const sy = cy + sz / 2 + 1;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 16, sy, 32, 9);
      ctx.fillStyle = '#fff'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(Math.floor(c.stats.육질 || 0) + '/' + Math.floor(c.stats.개념 || 0) + '/' + Math.floor(c.stats.크기 || 0), cx, sy + 4.5);
    }
    if (c.scream > 0) { ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('데챠앗!', cx, cy - 11); }
    else if (c.flee && c.flee.t > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('테챠아!', cx, cy - 11); }
    else if (c.speechT > 0 && c.speech) drawBubble(cx, cy - 12, c.speech);
  }

  function inoutBadge(cell, label, color) {
    const x = cell.c * CELL, y = cell.r * CELL;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 1, y + 1, 16, 12);
    ctx.fillStyle = color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(label, x + 3, y + 2);
  }
  function drawGrabber(b) {
    const roles = grabberRoles(b);
    const cx = roles.mid.c * CELL + CELL / 2, cy = roles.mid.r * CELL + CELL / 2;
    // 그래픽은 1x3 (가로 4프레임 시트) — 동쪽(→)기준 스프라이트를 방향에 맞게 회전(원본 비율 유지)
    // 화물을 옮기는 중(holding)에만 애니메이션, 대기 상태면 0프레임 고정
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((b.dir - 1) * Math.PI / 2);
    const ok = G.Assets.drawDeviceFit(ctx, 'grabber', 0, 0, 3 * CELL, b.holding ? null : 0);
    ctx.restore();
    if (!ok) {  // 플레이스홀더: 3칸 □·△
      [roles.pickup, roles.mid, roles.drop].forEach((cell, i) => {
        const x = cell.c * CELL, y = cell.r * CELL;
        ctx.save(); ctx.globalAlpha = (i === 1) ? 0.95 : 0.7; ctx.fillStyle = G.DEVICES.grabber.color;
        if (i === 1) ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i === 0 ? '□' : (i === 1 ? '·' : '△'), x + CELL / 2, y + CELL / 2); ctx.restore();
      });
    }
    // 출 위치 표시
    inoutBadge(roles.drop, '출', '#fc5');
    if (b.holding) {
      const isCre = G.CREATURES[b.holding.type];
      const drawn = isCre ? G.Assets.drawCreatureNative(ctx, b.holding.type, cx, cy, 0) : G.Assets.drawProductImage(ctx, b.holding.type, cx, cy, 30);
      if (!drawn) {
        const def = isCre || G.PRODUCTS[b.holding.type];
        ctx.fillStyle = def ? def.color : '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCargo(cg) {
    const x = cg.gx * CELL, y = cg.gy * CELL, sz = 26 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[cg.data.type]) || 1);
    const def = G.CREATURES[cg.data.type];   // 생물이면 def 존재
    if (def) {
      const v = DIR.vec[cg.dir] || { x: 1, y: 0 };
      if (!G.Assets.drawCreatureNative(ctx, cg.data.type, x, y, G.Assets.dirRow(v.x, v.y))) {  // 원본크기
        const bob = (G.Assets.frame() % 2) ? -2 : 0;
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(x, y + bob, sz / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.label, x, y + bob);
      }
      drawCreatureBadge(x, y, cg.data);
      if (cg.data.speechT > 0 && cg.data.speech) drawBubble(x, y - 24, cg.data.speech);
    } else {  // 생산품/자원(실장육·분쇄육·요리·실장푸드·운치) — 아이콘=맵 그래픽(무애니)
      if (!G.Assets.drawProductImage(ctx, cg.data.type, x, y, 34)) {
        const pd = G.PRODUCTS[cg.data.type];
        ctx.fillStyle = pd ? pd.color : '#fff'; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        lbl((cg.data.type || '?')[0]);
      }
    }
    function lbl(t) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }
  }

  function drawWanderer(w) {
    const x = w.gx * CELL, y = w.gy * CELL, sz = 24 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[w.data.type]) || 1);
    const def = G.CREATURES[w.data.type];
    if (!G.Assets.drawCreatureNative(ctx, w.data.type, x, y, G.Assets.dirRow(w.vx, w.vy))) {  // 원본크기
      ctx.fillStyle = def ? def.color : '#fff'; ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, sz / 2 + 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    drawCreatureBadge(x, y, w.data);
    if (w.data.speechT > 0 && w.data.speech) drawBubble(x, y - 24, w.data.speech);
  }

  // 스프라이트 위 등급 + 스탯 표기
  function drawCreatureBadge(cx, cy, data) {
    if (!data.stats) return;
    const g = G.Creatures.gradeOfStats(data.stats);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 13, cy - 24, 26, 11);
    ctx.fillStyle = g.color; ctx.fillText(g.label, cx, cy - 18);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(cx - 21, cy + 13, 42, 10);
    ctx.fillStyle = '#fff'; ctx.fillText(Math.floor(data.stats.육질) + '/' + Math.floor(data.stats.개념) + '/' + Math.floor(data.stats.크기), cx, cy + 18);
  }

  /* 선택 외곽선 */
  function drawSelection() {
    if (!S.selection.length) return;
    ctx.save(); ctx.strokeStyle = '#ffd964'; ctx.lineWidth = 2;
    for (const id of S.selection) {
      const b = S.buildings.find(x => x.id === id); if (!b) continue;
      for (const cell of footprintCellsOf(b)) ctx.strokeRect(cell.c * CELL + 1, cell.r * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.restore();
  }
  function drawSelectRect() {
    if (!selDragging || !selStartCell || !mouseCell) return;
    const minC = Math.min(selStartCell.col, mouseCell.col), maxC = Math.max(selStartCell.col, mouseCell.col);
    const minR = Math.min(selStartCell.row, mouseCell.row), maxR = Math.max(selStartCell.row, mouseCell.row);
    ctx.save(); ctx.fillStyle = 'rgba(255,217,100,0.12)'; ctx.strokeStyle = '#ffd964'; ctx.setLineDash([5, 3]); ctx.lineWidth = 1.5;
    ctx.fillRect(minC * CELL, minR * CELL, (maxC - minC + 1) * CELL, (maxR - minR + 1) * CELL);
    ctx.strokeRect(minC * CELL, minR * CELL, (maxC - minC + 1) * CELL, (maxR - minR + 1) * CELL);
    ctx.setLineDash([]); ctx.restore();
  }

  function drawWalls() {
    const selected = new Set(wallSelection);
    ctx.save(); ctx.lineWidth = 10; ctx.lineCap = 'round';
    for (const key in S.walls) {
      if (!S.walls[key]) continue;
      const p = key.split('|'), A = +p[1], B = +p[2];
      ctx.strokeStyle = selected.has(key) ? '#ffd964' : '#d6a85a';
      ctx.beginPath();
      if (p[0] === 'V') { ctx.moveTo(A * CELL, B * CELL); ctx.lineTo(A * CELL, (B + 1) * CELL); }
      else { ctx.moveTo(A * CELL, B * CELL); ctx.lineTo((A + 1) * CELL, B * CELL); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawWallGhost() {
    const p = wallDragging ? (wallStartPoint || wallPointAt(mouseGX, mouseGY)) : wallPointAt(mouseGX, mouseGY);
    const q = wallDragging ? (wallEndPoint || p) : p;
    ctx.save(); ctx.strokeStyle = '#ffe08a'; ctx.fillStyle = '#ffe08a'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.globalAlpha = 0.72;
    ctx.beginPath(); ctx.arc(p.c * CELL, p.r * CELL, 5, 0, Math.PI * 2); ctx.fill();
    for (const key of wallLineKeys(p, q)) {
      const a = key.split('|'), A = +a[1], B = +a[2];
      ctx.beginPath();
      if (a[0] === 'V') { ctx.moveTo(A * CELL, B * CELL); ctx.lineTo(A * CELL, (B + 1) * CELL); }
      else { ctx.moveTo(A * CELL, B * CELL); ctx.lineTo((A + 1) * CELL, B * CELL); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawPasteGhost() {
    if (!pasteClip || !mouseCell) return;
    for (const it of pasteClip) {
      const col = mouseCell.col + it.dc, row = mouseCell.row + it.dr;
      const fp = (it.type === 'penbox') ? { w: it.w, h: it.h } : footprint(it.type, col, row, it.dir);
      for (let rr = 0; rr < fp.h; rr++) for (let cc = 0; cc < fp.w; cc++) {
        const x = (col + cc) * CELL, y = (row + rr) * CELL;
        const ok = isOwnedCell(col + cc, row + rr);
        ctx.fillStyle = ok ? 'rgba(120,200,255,0.32)' : 'rgba(230,90,90,0.32)';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }
  function drawGhost() {
    if (moveMode) return;
    if (pasteMode) { drawPasteGhost(); return; }
    if (currentTool === 'wall') { if (mouseCell) drawWallGhost(); return; }
    if (currentTool === 'penbox') { drawPenGhost(); return; }
    if (!currentTool || !mouseCell) { if (beltDragging) drawBeltGhostPath(); return; }
    if (currentTool === 'belt' || currentTool === 'guardbelt') { if (beltDragging) drawBeltGhostPath(); else drawSingleGhost(currentTool, mouseCell.col, mouseCell.row, ghostDir); return; }
    if (currentTool === 'crossbelt') {
      const o = ghostOrigin('crossbelt', mouseCell, ghostDir);
      drawSingleGhost('crossbelt', o.col, o.row, ghostDir);
      return;
    }
    const o = ghostOrigin(currentTool, mouseCell, ghostDir);
    drawSingleGhost(currentTool, o.col, o.row, ghostDir);
  }
  function drawPenGhost() {
    if (!mouseCell && !penDragStart) return;
    let col, row, w, h;
    if (penDragStart) {
      const end = mouseCell || penDragStart;
      col = Math.min(penDragStart.col, end.col); row = Math.min(penDragStart.row, end.row);
      w = Math.abs(end.col - penDragStart.col) + 1; h = Math.abs(end.row - penDragStart.row) + 1;
    } else { col = mouseCell.col; row = mouseCell.row; w = 1; h = 1; }
    let ok = true;
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) { if (!isOwnedCell(col + dc, row + dr) || occAt(col + dc, row + dr) || hasBelt(col + dc, row + dr)) ok = false; }
    ctx.fillStyle = ok ? 'rgba(120,220,160,0.3)' : 'rgba(230,90,90,0.3)';
    ctx.fillRect(col * CELL + 2, row * CELL + 2, w * CELL - 4, h * CELL - 4);
    ctx.strokeStyle = ok ? '#8fd' : '#f88'; ctx.lineWidth = 2;
    ctx.strokeRect(col * CELL + 2, row * CELL + 2, w * CELL - 4, h * CELL - 4);
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('우리 ' + w + '×' + h + ' (성체' + (w * h * C.PEN_ADULT_PER_CELL) + '/새끼' + (w * h * C.PEN_YOUNG_PER_CELL) + ')', col * CELL + w * CELL / 2, row * CELL + h * CELL / 2);
  }
  function drawBeltGhostPath() {
    const beltType = currentTool === 'guardbelt' ? 'guardbelt' : 'belt';
    for (const seg of pathWithDirs()) {
      const ok = canPlace(beltType, seg.col, seg.row, seg.dir);
      const x = seg.col * CELL, y = seg.row * CELL;
      ctx.fillStyle = ok ? 'rgba(120,220,160,0.4)' : 'rgba(230,90,90,0.4)';
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      drawArrow(x + CELL / 2, y + CELL / 2, seg.dir, ok ? '#cff' : '#fcc');
    }
    if (beltPath.length) {
      const last = pathWithDirs().slice(-1)[0];
      if (last) drawGhostOutputs(beltType, last.col, last.row, last.dir);
    }
  }
  function drawSingleGhost(type, col, row, dir) {
    const fp = footprint(type, col, row, dir);
    const ok = canPlace(type, col, row, dir);
    const cells = (type === 'tunnel' || type === 'crossbelt') ? deviceCells({ type, col, row, dir, w: fp.w, h: fp.h }) : fp.cells;
    for (const cell of cells) {
      const x = cell.c * CELL, y = cell.r * CELL;
      ctx.fillStyle = ok ? 'rgba(120,220,160,0.35)' : 'rgba(230,90,90,0.35)';
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
    }
    if (G.DEVICES[type].range) drawRangeOverlay(rangeRect(type, col, row, dir), '#ffd24a', 0.18); // 영향 범위 미리보기
    if (type === 'skewer') {
      ctx.save();
      ctx.globalAlpha = 0.62;
      drawSkewerDevice({ type: 'skewer', held: null }, col * CELL, row * CELL);
      ctx.restore();
    }
    if (type === 'grabber') {
      const roles = grabberRoles({ col, row, dir });
      gLabel(roles.pickup, '입□'); gLabel(roles.mid, '·'); gLabel(roles.drop, '출△');
    } else if (G.DEVICES[type].rotatable) {
      drawArrow((col + fp.w / 2) * CELL, (row + fp.h / 2) * CELL, dir, ok ? '#cff' : '#fcc');
    }
    drawGhostOutputs(type, col, row, dir);
    function gLabel(cell, t) { ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, cell.c * CELL + CELL / 2, cell.r * CELL + CELL / 2); }
  }
  function drawGhostOutputs(type, col, row, dir) {
    const def = G.DEVICES[type]; if (!def) return;
    const fp = footprint(type, col, row, dir);
    const b = { type, col, row, dir, w: fp.w, h: fp.h };
    if (type === 'penbox' || type === 'warehouse' || type === 'wall' || type === 'packer') return;
    if (type === 'tunnel' || type === 'crossbelt') { drawGhostOutputCell(transportEnds(b).exit, '출'); return; }
    if (type === 'grabber') { drawGhostOutputCell(grabberRoles(b).drop, '출'); return; }
    if (type === 'sorter') { laneInfo(b).forEach(ln => drawGhostOutputCell(ln.out, '출')); return; }
    if (type === 'correction') {
      drawGhostOutputCell(sideCell(b, dir), '사육출');
      drawGhostOutputCell(sideCell(b, (dir + 2) % 4), '육출');
      return;
    }
    if (type === 'speaker' || type === 'pointer' || type === 'skewer' || type === 'feeder') return;
    drawGhostOutputCell(outputCell(b), '출');
  }
  function drawGhostOutputCell(cell, label) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd24a';
    ctx.fillStyle = 'rgba(255,210,74,0.12)';
    const x = cell.c * CELL, y = cell.r * CELL;
    ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
    ctx.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffe8a8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + CELL / 2, y + CELL / 2);
    ctx.restore();
  }
  function drawMoveGhost() {
    if (!moveMode || !mouseCell) return;
    for (const m of moving) {
      const col = mouseCell.col + m.offC, row = mouseCell.row + m.offR;
      const fp = m.b.type === 'penbox' ? { cells: Array.from({ length: m.b.w * m.b.h }, (_, i) => ({ c: col + (i % m.b.w), r: row + Math.floor(i / m.b.w) })) } : footprint(m.b.type, col, row, m.b.dir);
      const ok = canPlaceMoved(m.b, col, row);
      for (const cell of fp.cells) {
        const x = cell.c * CELL, y = cell.r * CELL;
        ctx.fillStyle = ok ? 'rgba(120,180,240,0.45)' : 'rgba(230,90,90,0.45)';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }

  return { init, update, render, reloadState, screenToCell, tryLoadCreature, hoverDropTarget, clearDropHover, sellAllWarehouse, sellSomeType, sellPenCreatures, spawnWanderer, dropToFactory, burstAt, stainAt, feedZoneMult };
})();
