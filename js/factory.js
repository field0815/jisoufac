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
  const CROSSBELT_MAX_DISTANCE = 7;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const statMax = () => C.STAT_MAX || 200;
  const sizeMax = () => C.SIZE_MAX || 50;
  const unchiMax = () => C.UNCHI_MAX || 100000;
  function addStat(stats, key, amount) {
    if (!stats) return;
    stats[key] = Math.min(key === '크기' ? sizeMax() : statMax(), (stats[key] || 0) + amount);
  }
  function changeStat(stats, key, amount) {
    if (!stats) return;
    const max = key === '크기' ? sizeMax() : statMax();
    stats[key] = clamp((stats[key] || 0) + amount, 0, max);
  }

  let canvas, ctx, menuEl;
  let floorPattern = null, floorPatternImg = null;   // 공장 바닥 타일(tile.png) 패턴 캐시
  let outFloorPattern = null, outFloorPatternImg = null; // 외부 바닥 타일(out_tile.png) 패턴 캐시
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

  function cloneData(v) { return JSON.parse(JSON.stringify(v)); }

  // 벽(경계) 그리기 모드
  let wallDragging = false, wallErase = false;
  let wallStartPoint = null, wallEndPoint = null;
  let wallSelection = [];
  let doorSelection = [];   // 선택된 문 edge key 목록(그룹 단위)
  let penEraseKey = false;  // X 키 누르는 중(우리 철거 모드)
  let penEraseStart = null; // 우리 철거 드래그 시작 셀

  // 벨트 드래그
  let beltDragging = false, beltPath = [], beltDragAxis = null;
  // 우리(펜) 드래그 배치
  let penDragStart = null;
  // 카오스 게이트 A(입구)→B(출구) 드래그 배치
  let chaosGateDragStart = null;
  // 횡단벨트 입구→출구 직선 드래그 배치
  let crossbeltDragStart = null;
  // 호버 중인 건물(R 회전용)
  let hoverBuilding = null;
  // 영역 선택
  let pendingSelect = false, selDragging = false, selStartCell = null, selDownClient = null;
  // 이동 모드
  let moveMode = false, moving = [];
  // 필터 패널 대상(단일 선택된 분류기/집게)
  let filterTarget = null;
  let ghostFilterDraft = null; // 설치 전 집게 고스트에 적용할 필터 설정
  let filterPanelSuppressedKey = '';
  let penTarget = null;   // 이름 패널 대상(단일 선택된 우리)
  let birthTarget = null; // 출산대 정보 패널 대상
  let selectedPenCreature = null;
  let landPromptEl = null;
  let deviceInfoEl = null;
  let deviceInfoAnchor = null;
  let deviceInfoBuilding = null;   // 현재 정보창에 표시 중인 건물(콜로니 승급 진행 갱신용)
  const FILTER_TYPES = Array.from(new Set(Object.keys(G.CREATURES).concat(Object.keys(G.PRODUCTS))));
  const FILTER_LABEL = { 사육실장: '사육실장 성체', 새끼사육실장: '사육실장 새끼', 독라: '독라 성체', 새끼독라: '독라 새끼' };
  // 필터 패널 카테고리: 실장석 / 자재 / 상품
  const FILTER_CATEGORIES = [
    { label: '실장석', types: ['성체실장', '점액덩어리', '구더기', '엄지', '자실장', '사육실장', '새끼사육실장', '독라', '새끼독라'] },
    { label: '자재', types: ['실장육', '분쇄육', '실장푸드', '짓소산 푸드', '우마이푸드', '다이어트푸드', '운치', '농축운치', '고농축운치', '초고농축운치', '소형위석', '중형위석', '대형위석', '짓소산', '조미료', '수산물', '철조각', '전자부품', '구더기 탄도미사일'] },
    { label: '상품', types: ['콘페이토', '도돈파', '코로리', '도로리', '꼬치훈제', '통조림', '진공포장', '실장젓갈', '실장무침', '참치 통조림', '호화로운 만찬', '해물찜'] },
  ];
  const ENDING_PRODUCTS = new Set(['콘페이토', '도돈파', '코로리', '도로리', '꼬치훈제', '통조림', '진공포장', '실장젓갈', '실장무침', '참치 통조림', '호화로운 만찬', '해물찜']);
  const ENDING_NEED_DEFAULT = { scrap: 50000, products: 10000, concentrate: 5000, electronics: 300, charge: 500000 };
  function endingNeed() {
    if (S.difficulty === 'breeding') return { scrap: 15000, products: 5000, concentrate: 1000, electronics: 100, charge: 500000 };
    if (S.difficulty === 'park') return { scrap: 30000, products: 10000, concentrate: 2000, electronics: 300, charge: 500000 };
    return ENDING_NEED_DEFAULT;
  }
  let endingNearbyBeltCargo = [];
  // 카테고리별 그룹(존재하는 타입만). 어느 카테고리에도 없는 타입은 '기타'로 묶어 누락 방지.
  function filterCategoryGroups() {
    const seen = new Set();
    const groups = FILTER_CATEGORIES.map(c => {
      const types = c.types.filter(t => FILTER_TYPES.includes(t));
      types.forEach(t => seen.add(t));
      return { label: c.label, types };
    });
    const rest = FILTER_TYPES.filter(t => !seen.has(t));
    if (rest.length) groups.push({ label: '기타', types: rest });
    return groups.filter(g => g.types.length);
  }
  // 카테고리 헤더 + 아이콘·이름 버튼을 container에 채운다. onToggle(type, button)으로 토글 처리.
  function buildCategorizedFilterButtons(container, onToggle) {
    filterCategoryGroups().forEach(g => {
      const head = document.createElement('div');
      head.className = 'fp-cat'; head.textContent = g.label;
      container.appendChild(head);
      g.types.forEach(t => {
        const b = document.createElement('button');
        b.className = 'fp-btn'; b.dataset.type = t;
        b.innerHTML = `${deviceInfoItemIcon(t)}<span class="fp-btn-name">${FILTER_LABEL[t] || t}</span>`;
        b.addEventListener('click', () => onToggle(t, b));
        container.appendChild(b);
      });
    });
  }
  const FEED_TYPES = ['운치', '실장푸드', '짓소산 푸드', '우마이푸드', '다이어트푸드'];
  const WRONG_CHAOS_MOODS = {
    1: { label: '평상시', lines: ['레후우우~!', '오네챠 작아진레후?', '프니프니 타이밍인 레후'] },
    2: { label: '기분좋음', lines: ['구더기쨩 팔다리 긴긴대신 커진레후', '운치 대신 푸드먹는레후', '프니프니 좋은레후'] },
    3: { label: '졸림', lines: ['레후우... 레후우...', '프니후... 프니후...', '레후... 운치도 좋은레후...'] },
    4: { label: '무서움', lines: ['떨어지는 꿈을 꾼 레후! 무서운레후!', '오네챠들 프니프니가 시원찮아진레후', '무서우니 프니프니를 요구하는레후!'] },
  };
  // 설치 메뉴 버튼에 1프레임 이미지를 통째로 쓰는 장치(시트가 아님)
  const MENU_1FRAME = new Set(['grabber', 'longgrabber', 'turret', 'sniper', 'mortar', 'warehouse', 'largewarehouse', 'driller', 'wall', 'door',
    'relic_techica', 'relic_arts', 'relic_slave', 'relic_sister', 'relic_dainagon', 'relic_bigmargot', 'relic_home']);
  const FEED_LABEL = { 운치: '운치', 실장푸드: '실장푸드', '짓소산 푸드': '짓소산 실장푸드', 우마이푸드: '우마이푸드', 다이어트푸드: '다이어트푸드' };
  // 사료별 효과 설명 (사료분배기 선택 / 배합기 메뉴에서 표시)
  const FEED_DESC = {
    운치: '공짜 사료(똥). 성장 ×1.1로 빠르지만 육질·개념이 깎이고 크기만 커진다.',
    실장푸드: '기본 사료. 성장을 촉진하고 육질·행복·체력을 회복시킨다.',
    '짓소산 푸드': '특수 사료. 체력을 회복하고 식사 시 육질·행복이 오를 확률이 있다.',
    우마이푸드: '특수 사료. 체력을 회복하고 성장 ×3에 행복이 꾸준히 상승한다.',
    다이어트푸드: '특수 사료. 체력을 회복시키고 성장 속도를 ×0.5로 억제한다.',
  };
  const SORTER_BUF = 4;   // 분류기 내부 버퍼 용량
  const POWER_PLANTS = new Set(['jisoucharge', 'firecharge', 'chaoscharge']);
  const POWER_POLES = new Set(['woodpole', 'ironpole', 'chaospole']);
  const POWERED_CATS = new Set(['logistics', 'production', 'processing', 'defense', 'special']);
  // 배회/약탈 실장석이 먹어치우는 음식 화물
  const SPECIAL_TREATS = new Set(['콘페이토', '도돈파', '코로리', '도로리']);
  const EDIBLE = new Set(['실장푸드', '짓소산 푸드', '실장육', '분쇄육', '꼬치훈제', '통조림', '진공포장', '실장젓갈', '실장무침', '콘페이토', '도돈파', '코로리', '도로리']);
  let turretTarget = null;   // 포탑 업그레이드 패널 대표 대상
  let turretTargetsSelected = [];
  let laborTarget = null;    // 노동석 명령 패널 대상(생물 data)
  let selectedWorkers = [];  // 드래그 선택된 노동석 data 목록
  let inventoryWarehouse = null;
  let warehouseInventoryEl = null;
  let playerInventoryEl = null;
  let inventoryRenderT = 0;
  let playerInventorySig = '';
  let warehouseInventorySig = '';
  let logTrimT = 0;          // produceLog 정리 타이머
  let autoBuyCd = 0;         // 실장푸드 자동구매 쿨다운
  const coinEffects = [];
  const mortarShells = [];
  const explosionEffects = [];
  const overlayBadges = [];
  const overlayBubbles = [];

  /* ---- 성능: 건물 id 맵 / 프레임 캐시 / 화물 공간 인덱스 ----------------
   *  - buildingById: deviceAt()의 O(건물수) 배열 탐색 제거
   *  - cargoIdx: 셀 키 → 화물 목록. countCargoInCell/nearestAhead의 O(화물수²) 제거.
   *    매 프레임 재구축 + makeCargo/셀 이동 시 증분 추가. 제거된 화물은 _dead 표시.
   *  - frameCache: 매 프레임 1회만 buildings를 분류(우리/창고/사료분배기/레드포인터) */
  const buildingById = new Map();
  let cargoIdx = new Map();
  const SPATIAL_BUCKET = 8;
  let wanderSpatial = new Map();
  let cargoSpatial = new Map();
  let renderView = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const frameCache = {
    pens: [],
    warehouses: [],
    feedZones: [],
    feedZoneRects: [],
    birthZones: [],
    birthZoneRects: [],
    specialColliders: [],
    penCellMap: new Map(),
    feedCellCache: new Map(),
  };
  function spatialKey(gx, gy) { return Math.floor(gx / SPATIAL_BUCKET) + '|' + Math.floor(gy / SPATIAL_BUCKET); }
  function spatialAdd(map, obj, gx, gy) {
    const k = spatialKey(gx, gy), list = map.get(k);
    if (list) list.push(obj); else map.set(k, [obj]);
  }
  function rebuildWanderSpatial() {
    wanderSpatial = new Map();
    for (const w of S.wanderers) if (!w._dead) spatialAdd(wanderSpatial, w, w.gx, w.gy);
  }
  function querySpatial(map, gx, gy, range) {
    const out = [];
    const bx0 = Math.floor((gx - range) / SPATIAL_BUCKET), bx1 = Math.floor((gx + range) / SPATIAL_BUCKET);
    const by0 = Math.floor((gy - range) / SPATIAL_BUCKET), by1 = Math.floor((gy + range) / SPATIAL_BUCKET);
    for (let bx = bx0; bx <= bx1; bx++) for (let by = by0; by <= by1; by++) {
      const list = map.get(bx + '|' + by);
      if (list) out.push(...list);
    }
    return out;
  }
  function nearbyWanderers(gx, gy, range) { return querySpatial(wanderSpatial, gx, gy, range); }
  function nearbyCargo(gx, gy, range) { return querySpatial(cargoSpatial, gx, gy, range); }
  function rebuildCargoSpatial() {
    cargoSpatial = new Map();
    for (const cg of S.cargo) if (!cg._dead) spatialAdd(cargoSpatial, cg, cg.gx, cg.gy);
  }
  function rebuildCargoIndex() {
    cargoIdx = new Map();
    for (const cg of S.cargo) if (!cg._dead) cargoIdxAdd(cg);
  }
  function cargoIdxAdd(cg) {
    const k = Math.floor(cg.gx) + '|' + Math.floor(cg.gy);
    const a = cargoIdx.get(k);
    if (a) a.push(cg); else cargoIdx.set(k, [cg]);
  }
  function rebuildFrameCaches() {
    frameCache.pens.length = 0; frameCache.warehouses.length = 0;
    frameCache.feedZones.length = 0; frameCache.feedZoneRects.length = 0;
    frameCache.birthZones.length = 0; frameCache.birthZoneRects.length = 0;
    frameCache.specialColliders.length = 0;
    frameCache.penCellMap.clear();
    frameCache.feedCellCache.clear();
    for (const b of S.buildings) {
      const def = G.DEVICES[b.type];
      if (!def) continue;
      if (b.type === 'penbox') {
        frameCache.pens.push(b);
        for (const cell of penAbsCells(b)) frameCache.penCellMap.set(cell.c + '|' + cell.r, b);
      }
      else if (b.type === 'warehouse' || b.type === 'largewarehouse' || b.type === 'colony') frameCache.warehouses.push(b);
      else if (def.special === 'feed') {
        frameCache.feedZones.push(b);
        frameCache.feedZoneRects.push({ b, rect: rangeRect(b.type, b.col, b.row, b.dir) });
      }
      else if (def.special === 'birth') {
        frameCache.birthZones.push(b);
        frameCache.birthZoneRects.push({ b, rect: rangeRect(b.type, b.col, b.row, b.dir) });
      }
      if (b.type === 'techica' && (b.w !== 1 || b.h !== 1)) { b.w = 1; b.h = 1; }   // 1×1 보정(구버전 호환)
      if (b.type === 'skewer' || b.type === 'techica') frameCache.specialColliders.push(b);
    }
    rebuildCargoIndex();
    rebuildCargoSpatial();
    rebuildWanderSpatial();
  }

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
    buildTurretPanel();
    buildLaborPanel();
    buildWallPanel();
    buildBlueprintTab();
    buildLinggalButton();
    buildInventoryPanels();
    if (!S.buildings.length) setupStart();
    generateRuinsNearOwned();
    ensureEnvironmentFeatures();
    refreshUnacceptedQuestRewards();
  }
  function buildInventoryPanels() {
    const game = document.getElementById('game');
    warehouseInventoryEl = document.createElement('div');
    warehouseInventoryEl.id = 'warehouse-inventory-panel';
    warehouseInventoryEl.className = 'inventory-panel inventory-left';
    warehouseInventoryEl.style.display = 'none';
    warehouseInventoryEl.innerHTML = '<div class="inventory-head"><b>창고</b><button data-inv-close="warehouse">×</button></div><div class="inventory-summary"></div><div class="inventory-items"></div><button class="inventory-upgrade">용량 업그레이드</button>';
    playerInventoryEl = document.createElement('div');
    playerInventoryEl.id = 'player-inventory-panel';
    playerInventoryEl.className = 'inventory-panel inventory-right';
    playerInventoryEl.style.display = 'none';
    playerInventoryEl.innerHTML = '<div class="inventory-head"><b>콜로니센터 인벤토리</b><button data-inv-close="player">×</button></div><div class="inventory-summary">건설·연구·거래에 사용하는 플레이어 재고</div><div class="inventory-items"></div>';
    game.appendChild(warehouseInventoryEl);
    game.appendChild(playerInventoryEl);
    game.addEventListener('click', e => {
      const close = e.target.closest('[data-inv-close]');
      if (close) {
        if (close.dataset.invClose === 'warehouse') { warehouseInventoryEl.style.display = 'none'; inventoryWarehouse = null; }
        else playerInventoryEl.style.display = 'none';
        return;
      }
      if (e.target.closest('.inventory-upgrade') && inventoryWarehouse) upgradeLocalWarehouse(inventoryWarehouse);
    });
    [warehouseInventoryEl, playerInventoryEl].forEach(panel => {
      panel.addEventListener('dragover', e => e.preventDefault());
      panel.addEventListener('drop', e => {
        e.preventDefault();
        const raw = e.dataTransfer && e.dataTransfer.getData('application/x-siljang-inventory');
        if (!raw) return;
        let payload; try { payload = JSON.parse(raw); } catch (_) { return; }
        const dest = panel === warehouseInventoryEl ? 'warehouse' : 'player';
        transferInventoryStack(payload, dest);
      });
      panel.addEventListener('dragstart', e => {
        const item = e.target.closest('[data-inv-type]');
        if (!item || !e.dataTransfer) return;
        e.dataTransfer.setData('application/x-siljang-inventory', JSON.stringify({
          source: item.dataset.invSource, type: item.dataset.invType, max: +item.dataset.invCount || 1,
        }));
        e.dataTransfer.effectAllowed = 'move';
      });
    });
    canvas.addEventListener('dragover', e => e.preventDefault());
    canvas.addEventListener('drop', e => {
      e.preventDefault();
      const raw = e.dataTransfer && e.dataTransfer.getData('application/x-siljang-inventory');
      if (!raw) return;
      let payload; try { payload = JSON.parse(raw); } catch (_) { return; }
      if (payload.source !== 'player') return;
      const cell = screenToCell(e.clientX, e.clientY);
      if (!cell) return;
      const n = askInventoryAmount(payload.max, '배치할 수량');
      if (n <= 0) return;
      const items = takePlayerInventory(payload.type, n);
      const dev = deviceAt(cell.col, cell.row);
      items.forEach((data, i) => {
        if (dev) {
          if (!dropInto(dev, data, cell)) putPlayerInventory([data]);
        } else dropFloorCargo(data, cell.col + (i % 3), cell.row + Math.floor(i / 3));
      });
      renderInventoryPanels(true);
    });
  }
  function askInventoryAmount(max, label) {
    const raw = window.prompt(`${label} (1~${max})`, String(max));
    if (raw == null) return 0;
    return clamp(Math.floor(+raw || 0), 0, max);
  }
  function playerResourceAmount(type) {
    if (type === '실장푸드') return Math.floor(S.food || 0);
    if (type === '짓소산 푸드') return Math.floor(S.jissoFood || 0);
    if (type === '우마이푸드') return Math.floor(S.umaiFood || 0);
    if (type === '다이어트푸드') return Math.floor(S.dietFood || 0);
    if (type === '운치') return Math.floor(S.unchi || 0);
    if (type === '조미료') return Math.floor(S.seasoning || 0);
    return 0;
  }
  function playerStackCount(type) {
    return playerResourceAmount(type) + ((S.warehouse[type] && S.warehouse[type].length) || 0);
  }
  function playerInventoryCapacity() {
    return Infinity;
  }
  function playerInventoryCount() {
    return playerInventoryTypes().reduce((sum, type) => sum + playerStackCount(type), 0);
  }
  function playerInventoryRoom() {
    return Infinity;
  }
  function playerInventoryTypes() {
    const set = new Set(Object.keys(S.warehouse || {}).filter(t => S.warehouse[t] && S.warehouse[t].length));
    ['실장푸드', '짓소산 푸드', '우마이푸드', '다이어트푸드', '운치', '조미료'].forEach(t => { if (playerResourceAmount(t) > 0) set.add(t); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }
  function takePlayerInventory(type, n) {
    const out = [];
    const resourceMap = { 실장푸드: 'food', '짓소산 푸드': 'jissoFood', 우마이푸드: 'umaiFood', 다이어트푸드: 'dietFood', 운치: 'unchi', 조미료: 'seasoning' };
    const key = resourceMap[type];
    if (key) {
      const count = Math.min(n, Math.floor(S[key] || 0));
      S[key] -= count;
      if (count > 0) {
        const data = resourceCargoData(type);
        data.amount = count;
        out.push(data);
      }
      return out;
    }
    const list = S.warehouse[type] || [];
    return list.splice(0, Math.min(n, list.length));
  }
  function putPlayerInventory(items) {
    const rejected = [];
    const colony = S.buildings.find(b => b.type === 'colony') || null;
    items.forEach(data => { if (!warehouseIntake(data, colony)) rejected.push(data); });
    return rejected;
  }
  function transferInventoryStack(payload, dest) {
    if (!payload || !payload.type || payload.source === dest) return;
    const available = payload.source === 'player'
      ? playerStackCount(payload.type)
      : (inventoryWarehouse && inventoryOf(inventoryWarehouse)[payload.type] ? inventoryOf(inventoryWarehouse)[payload.type].length : 0);
    const max = Math.min(payload.max || 100, available);
    if (!max) return;
    const n = askInventoryAmount(max, '옮길 수량');
    if (n <= 0) return;
    if (payload.source === 'player' && dest === 'warehouse') {
      if (!inventoryWarehouse) return;
      const room = warehouseCapacity(inventoryWarehouse) - inventoryCount(inventoryOf(inventoryWarehouse));
      const items = takePlayerInventory(payload.type, Math.min(n, room));
      items.forEach(data => {
        if (!warehouseIntake(data, inventoryWarehouse)) putPlayerInventory([data]);
      });
    } else if (payload.source === 'warehouse' && dest === 'player' && inventoryWarehouse) {
      const inv = inventoryOf(inventoryWarehouse);
      const moveN = Math.min(n, playerInventoryRoom());
      if (moveN <= 0) { G.UI.flash && G.UI.flash('콜로니센터 인벤토리가 가득 찼습니다.'); return; }
      const items = (inv[payload.type] || []).splice(0, moveN);
      const rejected = putPlayerInventory(items);
      if (rejected.length) inv[payload.type].unshift(...rejected);
    }
    G.Assets.playSfx('click');
    renderInventoryPanels(true);
  }
  function inventoryItemsHtml(types, countFn, source, capacity) {
    const slots = [];
    types.forEach(type => {
      const n = countFn(type);
      if (n <= 0) return;
      slots.push(`<div class="inventory-item" draggable="true" title="${escAttr(FILTER_LABEL[type] || type)} ×${n.toLocaleString()}" data-inv-source="${source}" data-inv-type="${escAttr(type)}" data-inv-count="${n}">${deviceInfoItemIcon(type)}<span>${FILTER_LABEL[type] || type}</span><b>${n.toLocaleString()}</b></div>`);
    });
    // 저장 용량과 슬롯 수는 별개다. 같은 품목은 수량 전체를 한 슬롯에 합쳐 표시한다.
    const slotLimit = Math.max(slots.length, 8);
    while (slots.length < slotLimit) slots.push('<div class="inventory-empty-slot" aria-hidden="true"></div>');
    return slots.join('');
  }
  function renderInventoryPanels(force) {
    inventoryRenderT -= force ? 999 : 1 / 60;
    if (!force && inventoryRenderT > 0) return;
    inventoryRenderT = 0.2;
    if (playerInventoryEl && playerInventoryEl.style.display !== 'none') {
      const types = playerInventoryTypes();
      playerInventoryEl.querySelector('.inventory-summary').textContent =
        `저장 ${playerInventoryCount().toLocaleString()} · 무제한`;
      const sig = `${S.colonyTier}|` + types.map(t => `${t}:${playerStackCount(t)}`).join('|');
      if (force || sig !== playerInventorySig) {
        playerInventorySig = sig;
        playerInventoryEl.querySelector('.inventory-items').innerHTML = inventoryItemsHtml(types, playerStackCount, 'player', playerInventoryCapacity());
      }
    }
    if (warehouseInventoryEl && warehouseInventoryEl.style.display !== 'none') {
      if (!inventoryWarehouse || !S.buildings.includes(inventoryWarehouse)) {
        warehouseInventoryEl.style.display = 'none'; inventoryWarehouse = null; return;
      }
      const inv = inventoryOf(inventoryWarehouse);
      const count = inventoryCount(inv), cap = warehouseCapacity(inventoryWarehouse);
      warehouseInventoryEl.querySelector('.inventory-head b').textContent = G.DEVICES[inventoryWarehouse.type].name;
      warehouseInventoryEl.querySelector('.inventory-summary').textContent = `저장 ${count.toLocaleString()} / ${cap.toLocaleString()}`;
      const types = Object.keys(inv).filter(t => inv[t] && inv[t].length);
      const sig = `${inventoryWarehouse.id}|${cap}|` + types.map(t => `${t}:${inv[t].length}`).join('|');
      if (force || sig !== warehouseInventorySig) {
        warehouseInventorySig = sig;
        warehouseInventoryEl.querySelector('.inventory-items').innerHTML = inventoryItemsHtml(types, t => inv[t].length, 'warehouse', cap);
      }
      const up = warehouseInventoryEl.querySelector('.inventory-upgrade');
      up.style.display = inventoryWarehouse.type === 'warehouse' ? '' : 'none';
      up.textContent = `용량 +500 · ₩${warehouseUpgradeCost(inventoryWarehouse).toLocaleString()}`;
    }
  }
  function openPlayerInventory() {
    playerInventoryEl.style.display = playerInventoryEl.style.display === 'none' ? 'flex' : 'none';
    renderInventoryPanels(true);
  }
  function openWarehouseInventory(b) {
    if (!isLocalWarehouse(b)) return;
    inventoryWarehouse = b;
    warehouseInventoryEl.style.display = 'flex';
    playerInventoryEl.style.display = 'flex';
    renderInventoryPanels(true);
  }
  function upgradeLocalWarehouse(b) {
    const cost = warehouseUpgradeCost(b);
    if (S.money < cost) { G.UI.flash && G.UI.flash(`돈 부족! ₩${cost.toLocaleString()} 필요`); return; }
    S.money -= cost;
    b.storageLevel = (b.storageLevel || 0) + 1;
    G.Assets.playSfx('upgrade');
    G.UI.flash && G.UI.flash(`창고 용량 ${warehouseCapacity(b).toLocaleString()}으로 증가`);
    renderInventoryPanels(true);
  }
  function buildPenPanel() {
    const pp = document.createElement('div');
    pp.id = 'pen-panel'; pp.style.display = 'none';
    pp.innerHTML = `<div class="fp-title">우리 이름</div><input id="pen-name-input" type="text" maxlength="16" placeholder="우리 이름">
      <div class="pen-clean" id="pen-clean"></div>
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
    const cleanEl = pp.querySelector('#pen-clean');
    if (cleanEl && G.Pens.cleanlinessOf) {
      const poll = G.Pens.penPollution(penTarget), cl = G.Pens.cleanlinessOf(penTarget);
      cleanEl.innerHTML = `청결도: <b style="color:${cl.color}">${cl.label}</b> <span class="pen-clean-pct">(오염 ${Math.round(poll)}%)</span>`;
    }
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
      if (!bufferCargo(b, prod)) { G.UI.flash && G.UI.flash('출산대 화물 적체가 가득 찼습니다'); return; }
      b.worker = null; b.lifeTimer = 0; b.birthTimer = 0; b.state = 'idle';
      G.Assets.playSfx('sell');
    });
  }

  /* ---- 자동 포탑 업그레이드 패널 -------------------------------------- */
  function buildTurretPanel() {
    const tp = document.createElement('div');
    tp.id = 'turret-panel'; tp.style.display = 'none';
    const rows = Object.keys(G.TURRET_UP).map(k =>
      `<div class="tp-row"><span>${G.TURRET_UP[k].label}</span><b class="tp-lv" data-lv="${k}"></b><button class="tp-buy" data-up="${k}"></button></div>`).join('');
    tp.innerHTML = `<div class="fp-title">자동 포탑</div>
      <div class="tp-info" id="tp-info"></div>
      <div class="tp-rows">${rows}</div>
      <div class="tp-mode"><span>목표 설정</span>
        <button class="tp-mode-btn" data-mode="raider">약탈자만</button>
        <button class="tp-mode-btn" data-mode="wild">외부 출신</button>
        <button class="tp-mode-btn" data-mode="all">전부</button></div>
      <button class="tp-all" id="tp-all">모든 터렛에 같은 목표 적용</button>`;
    document.getElementById('game').appendChild(tp);
    tp.querySelector('#tp-all').addEventListener('click', () => {
      const b = turretTarget; if (!b) return;
      const mode = b.mode || 'raider';
      let n = 0;
      for (const t of S.buildings) if (isTurretLike(t)) { t.mode = mode; n++; }
      G.Assets.playSfx('place');
      G.UI.flash && G.UI.flash('모든 터렛(' + n + ') 목표를 「' + ({ raider: '약탈자만', wild: '외부 출신', all: '전부' }[mode]) + '」(으)로 적용');
    });
    tp.querySelectorAll('.tp-buy').forEach(btn => btn.addEventListener('click', () => {
      if (!turretTargetsSelected.length) return;
      const k = btn.dataset.up, u = G.TURRET_UP[k];
      const targets = turretTargetsSelected.filter(b => turretLv(b, k) < u.max);
      const cost = targets.reduce((sum, b) => sum + u.base * (turretLv(b, k) + 1), 0);
      if (!targets.length || !spend(cost)) return;
      for (const b of targets) {
        if (!b.up) b.up = { dmg: 0, rate: 0, range: 0 };
        b.up[k] = turretLv(b, k) + 1;
      }
      G.Assets.playSfx('place');
    }));
    tp.querySelectorAll('.tp-mode-btn').forEach(btn => btn.addEventListener('click', () => {
      if (turretTargetsSelected.length) {
        turretTargetsSelected.forEach(b => { b.mode = btn.dataset.mode; });
        G.Assets.playSfx('click');
      }
    }));
  }
  function updateTurretPanel() {
    const tp = document.getElementById('turret-panel'); if (!tp) return;
    const selected = S.selection.map(id => S.buildings.find(b => b.id === id)).filter(Boolean);
    const sameType = selected.length && selected.every(b => isTurretLike(b) && b.type === selected[0].type);
    turretTargetsSelected = sameType ? selected : [];
    turretTarget = turretTargetsSelected[0] || null;
    if (!turretTarget || S.overlay || S.screen !== 'factory') { tp.style.display = 'none'; return; }
    const b = turretTarget;
    const count = turretTargetsSelected.length;
    tp.style.display = 'block';
    tp.querySelector('.fp-title').textContent = (G.DEVICES[b.type] ? G.DEVICES[b.type].name : '자동 포탑') + (count > 1 ? ' ×' + count : '');
    tp.style.left = clamp(worldToGameX((b.col + 1) * CELL) + 6, 4, C.GAME_W - 220) + 'px';
    tp.style.top = clamp(worldToGameY(b.row * CELL), 46, C.GAME_H - 240) + 'px';
    tp.querySelector('#tp-info').innerHTML = count > 1
      ? `같은 종류 <b>${count}</b>기 선택 · 총 처치 <b>${turretTargetsSelected.reduce((sum, t) => sum + (t.kills || 0), 0)}</b>`
      : `피해 <b>${turretDmg(b)}</b> · ${(1 / turretInterval(b)).toFixed(1)}발/초 · 사거리 <b>${turretRange(b).toFixed(1)}</b>칸 · 처치 <b>${b.kills || 0}</b>${isMortar(b) ? ` · 미사일 <b>${b.missileAmmo || 0}/5</b>` : ''}`;
    tp.querySelectorAll('.tp-lv').forEach(el => {
      const levels = turretTargetsSelected.map(t => turretLv(t, el.dataset.lv));
      const min = Math.min(...levels), max = Math.max(...levels);
      el.textContent = min === max ? 'Lv.' + min : 'Lv.' + min + '~' + max;
    });
    tp.querySelectorAll('.tp-buy').forEach(btn => {
      const k = btn.dataset.up, u = G.TURRET_UP[k];
      const targets = turretTargetsSelected.filter(t => turretLv(t, k) < u.max);
      if (!targets.length) { btn.textContent = 'MAX'; btn.disabled = true; }
      else {
        const cost = targets.reduce((sum, t) => sum + u.base * (turretLv(t, k) + 1), 0);
        btn.textContent = (count > 1 ? targets.length + '기 ' : '') + '₩' + cost.toLocaleString();
        btn.disabled = S.money < cost;
      }
    });
    tp.querySelectorAll('.tp-mode-btn').forEach(btn => {
      const mode = btn.dataset.mode;
      btn.classList.toggle('active', turretTargetsSelected.every(t => (t.mode || 'raider') === mode));
    });
    repositionDeviceInfo();
  }

  /* ---- 벽 업그레이드 패널 --------------------------------------------- */
  let wallPanelKey = null;   // 현재 선택된 벽 key(패널 표시용)
  function wallUpCost() { return (G.BUILD_COST.wall || 10) * Math.pow(C.WALL_UP_COST_MULT || 2, (S.wallLevel || 0) + 1); }
  function buildWallPanel() {
    const wp = document.createElement('div');
    wp.id = 'wall-panel'; wp.className = 'turret-panel'; wp.style.display = 'none';
    wp.innerHTML = `<div class="fp-title">벽</div>
      <div class="tp-info" id="wp-info"></div>
      <button class="tp-all" id="wp-up"></button>
      <div class="wp-hint">업그레이드는 모든 벽에 적용(체력 2배)</div>`;
    document.getElementById('game').appendChild(wp);
    wp.querySelector('#wp-up').addEventListener('click', () => {
      const lv = S.wallLevel || 0;
      if (lv >= (C.WALL_UP_MAX || 20)) return;
      const cost = wallUpCost();
      if (!spend(cost)) return;
      S.wallLevel = lv + 1;
      const max = wallMaxHp();
      // 모든 벽 체력 2배(새 최대치까지)
      for (const k in S.walls) { if (S.walls[k]) S.walls[k] = Math.min(max, wallHp(k) * 2); }
      G.Assets.playSfx('place');
      G.UI.flash && G.UI.flash('벽 강화 Lv.' + (lv + 1) + ' (체력 2배)');
    });
  }
  function selectWall(key, clientX, clientY) {
    wallSelection = [key]; doorSelection = []; S.selection = []; selectedPenCreature = null;
    closeAuxPanels(); allowAuxPanels();
    wallPanelKey = key;
  }
  function selectDoor(key) {
    const dr = S.doors[key]; if (!dr) return;
    const gid = dr.gid;
    doorSelection = Object.keys(S.doors).filter(k => S.doors[k] && S.doors[k].gid === gid);
    wallSelection = []; S.selection = []; selectedPenCreature = null;
    closeAuxPanels();
    G.UI.flash && G.UI.flash('문 선택 — Del로 삭제');
  }
  function updateWallPanel() {
    const wp = document.getElementById('wall-panel'); if (!wp) return;
    const key = (wallSelection.length === 1) ? wallSelection[0] : null;
    if (!key || !S.walls[key] || S.overlay || S.screen !== 'factory') { wp.style.display = 'none'; wallPanelKey = null; return; }
    wallPanelKey = key;
    const p = wallKeyPoint(key);
    wp.style.display = 'block';
    wp.style.left = clamp(worldToGameX(p.x * CELL) + 10, 4, C.GAME_W - 220) + 'px';
    wp.style.top = clamp(worldToGameY(p.y * CELL), 46, C.GAME_H - 160) + 'px';
    const lv = S.wallLevel || 0, max = wallMaxHp();
    wp.querySelector('#wp-info').innerHTML = `강화 <b>Lv.${lv}/${C.WALL_UP_MAX || 20}</b> · 체력 <b>${Math.round(wallHp(key))}/${Math.round(max)}</b>`;
    const up = wp.querySelector('#wp-up');
    if (lv >= (C.WALL_UP_MAX || 20)) { up.textContent = 'MAX'; up.disabled = true; }
    else { const cost = wallUpCost(); up.textContent = '강화 ₩' + cost.toLocaleString(); up.disabled = S.money < cost; }
    repositionDeviceInfo();
  }

  /* ---- 노동석 명령 패널 ------------------------------------------------ */
  const LABOR_MODES = [['hold', '대기'], ['retrieve', '회수'], ['defend', '방어'], ['clean', '청소'], ['mine', '채취']];
  let laborPenSig = '';   // 우리 select 갱신 판별용
  function buildLaborPanel() {
    const lp = document.createElement('div');
    lp.id = 'labor-panel'; lp.style.display = 'none';
    const modeBtns = LABOR_MODES.map(([m, label]) => `<button class="lb-mode" data-mode="${m}">${label}</button>`).join('');
    lp.innerHTML = `<div class="fp-title" id="lb-title">노동석</div>
      <div class="lb-carry" id="lb-stats"></div>
      <div class="lb-carry" id="lb-carry"></div>
      <div class="lb-modes">${modeBtns}</div>
      <div class="lb-sec"><span>회수 필터 (다중 선택, 없으면 전체)</span><div class="fp-btns" id="lb-filter"></div></div>
      <div class="lb-sec"><span>회수한 실장석을 보낼 우리</span><select id="lb-pen"><option value="">자동 (가까운 우리)</option></select></div>
      <button class="lb-all" id="lb-all">모든 노동석에 같은 명령 적용</button>`;
    document.getElementById('game').appendChild(lp);
    lp.querySelectorAll('.lb-mode').forEach(btn => btn.addEventListener('click', () => {
      if (laborTarget) {
        laborTarget.laborMode = btn.dataset.mode;
        if (btn.dataset.mode === 'mine' && S.tutorial && S.tutorial.flags) { S.tutorial.flags.laborMineUsed = true; S.tutorial.flags.laborMineHint = false; }
        const w = S.wanderers.find(x => x.data === laborTarget);
        if (w) { w.laborTgt = null; w.goal = null; }
        if (btn.dataset.mode === 'mine' && !gatherTargetExists(laborTarget)) { laborTarget.speech = '가져올만한 것이 근처에 없는데스'; laborTarget.speechT = 2.6; }
        else sayLaborCommand(laborTarget);
        G.Assets.playSfx('click');
      }
    }));
    const fb = lp.querySelector('#lb-filter');
    buildCategorizedFilterButtons(fb, (t) => {
      if (!laborTarget) return;
      if (!laborTarget.laborFilter) laborTarget.laborFilter = [];
      const i = laborTarget.laborFilter.indexOf(t);
      if (i >= 0) laborTarget.laborFilter.splice(i, 1); else laborTarget.laborFilter.push(t);
      G.Assets.playSfx('click');
    });
    lp.querySelector('#lb-pen').addEventListener('change', (e) => {
      if (laborTarget) { laborTarget.laborPenId = +e.target.value || null; G.Assets.playSfx('click'); }
    });
    lp.querySelector('#lb-all').addEventListener('click', () => {
      if (!laborTarget) return;
      const noGather = laborTarget.laborMode === 'mine' && !gatherTargetExists(laborTarget);
      const announce = (data) => {
        if (noGather) { data.speech = '가져올만한 것이 근처에 없는데스'; data.speechT = 2.6; }
        else sayLaborCommand(data);
      };
      announce(laborTarget);
      for (const w of S.wanderers) {
        if (!w.data.labor || w.data === laborTarget) continue;
        w.data.laborMode = laborTarget.laborMode;
        w.data.laborFilter = (laborTarget.laborFilter || []).slice();
        w.data.laborPenId = laborTarget.laborPenId;
        announce(w.data);
        w.laborTgt = null; w.goal = null;
      }
      G.Assets.playSfx('place');
      G.UI.flash && G.UI.flash('모든 노동석에 명령 적용됨');
    });
  }
  // 채취 대상(폐허/잔해/유적)이 근처에 있는지 — 해당 노동석 기준 탐색 반경 안에서 확인
  function gatherTargetExists(data) {
    const w = S.wanderers.find(x => x.data === data);
    if (w) return !!nearestRuin(w);
    return (S.ruins || []).some(ruinHarvestable);
  }
  function showLaborPanel(data, clientX, clientY) {
    laborTarget = data;
    laborPenSig = '';   // 우리 목록 강제 갱신
    const lp = document.getElementById('labor-panel');
    if (!lp) return;
    lp.style.display = 'block';
    updateLaborPanel();
    if (clientX == null || clientY == null) {
      const w = S.wanderers.find(x => x.data === data);
      if (w) { clientX = worldToGameX(w.gx * CELL); clientY = worldToGameY(w.gy * CELL); }
      else { clientX = C.GAME_W / 2; clientY = C.GAME_H / 2; }
      const g = document.getElementById('game').getBoundingClientRect();
      const sc = g.width / C.GAME_W;
      clientX = g.left + clientX * sc; clientY = g.top + clientY * sc;
    }
    positionMiniPanel(lp, clientX, clientY, avoidInfoPanels(lp));
  }
  function updateLaborPanel() {
    const lp = document.getElementById('labor-panel'); if (!lp) return;
    if (!laborTarget || S.overlay || S.screen !== 'factory' || !S.wanderers.some(w => w.data === laborTarget)) {
      lp.style.display = 'none'; if (laborTarget && !S.wanderers.some(w => w.data === laborTarget)) laborTarget = null;
      return;
    }
    const d = laborTarget;
    lp.querySelector('#lb-title').textContent = `노동석 #${d.id} (${G.CREATURES[d.type] ? G.CREATURES[d.type].label : d.type})`;
    const st = d.stats || {};
    const statsEl = lp.querySelector('#lb-stats');
    if (statsEl) statsEl.innerHTML = `개념 <b>${Math.floor(st.개념 || 0)}</b> · 육질 ${Math.floor(st.육질 || 0)} · 크기 ${Math.floor(st.크기 || 0)} · 운반 ${laborCarryCap(d)}`;
    const carry = lp.querySelector('#lb-carry');
    if (d.carry && d.carry.kind === 'cargo') carry.textContent = '들고 있음: 화물 ' + laborCarryCount(d) + '/' + laborCarryCap(d);
    else carry.textContent = d.carry ? '들고 있음: ' + itemLabel(d.carry.data) : '들고 있음: 없음';
    lp.querySelectorAll('.lb-mode').forEach(btn => btn.classList.toggle('active', (d.laborMode || 'free') === btn.dataset.mode));
    // 첫 노동석 튜토리얼: '채취' 명령 버튼 강조 (한 번 누르면 해제)
    const mineHint = !!(S.tutorial && S.tutorial.flags && S.tutorial.flags.laborMineHint && !S.tutorial.flags.laborMineUsed);
    const mineBtn = lp.querySelector('.lb-mode[data-mode="mine"]');
    if (mineBtn) mineBtn.classList.toggle('tutorial-focus', mineHint);
    const f = d.laborFilter || [];
    lp.querySelectorAll('#lb-filter .fp-btn').forEach(btn => btn.classList.toggle('active', f.includes(btn.dataset.type)));
    // 우리 목록 (이름·id) — 바뀔 때만 옵션 재구축
    const sel = lp.querySelector('#lb-pen');
    const sig = frameCache.pens.map(p => p.id + ':' + (p.name || '')).join('|');
    if (sig !== laborPenSig) {
      laborPenSig = sig;
      sel.innerHTML = '<option value="">자동 (가까운 우리)</option>' +
        frameCache.pens.map(p => `<option value="${p.id}">${p.name || (p.id + '번 우리')}</option>`).join('');
    }
    if (document.activeElement !== sel) sel.value = d.laborPenId ? String(d.laborPenId) : '';
  }

  function showLandPrompt(cell, clientX, clientY) {
    if (isOwnedCell(cell.col, cell.row)) return false;
    const key = landKeyForCell(cell.col, cell.row);
    if (S.ending && S.ending.gridKey === key && !S.ending.accepted) {
      G.UI.flash && G.UI.flash('44방공호의 특별 의뢰를 수락해야 인계받을 수 있는 부지입니다.');
      return false;
    }
    if (!landConnected(key)) { G.UI.flash && G.UI.flash('소유 영토와 연결된 그리드만 구매 가능'); return false; }
    if (!landPromptEl) {
      landPromptEl = document.createElement('div');
      landPromptEl.id = 'land-prompt';
      document.getElementById('game').appendChild(landPromptEl);
    }
    const cost = landCost(key);
    const parts = key.split('|');
    const env = landEnvironment(key);
    const distance = landDistance(key);
    const distancePct = Math.round((landDistanceMultiplier(key) - 1) * 100);
    const scopeLabel = env.scope === 'owned' ? '소유형 · 보유 시 전역 적용' : '지역형 · 중심점이 이 그리드에 있을 때 적용';
    const gridSize = C.LAND_GRID_SIZE || 48;
    landPromptEl.innerHTML = `
      <div class="lp-title">외부 그리드 구매</div>
      <div class="lp-body">${gridSize}×${gridSize}칸 구역 (${parts[0]}, ${parts[1]}) · 거리 ${distance} · 할증 +${distancePct}%</div>
      <div class="lp-env">
        <div class="lp-env-head"><b>${env.icon} ${env.name}</b><span>${env.rarity}</span></div>
        <div class="lp-env-scope">${scopeLabel}</div>
        <div class="lp-env-buff"><b>버프</b> ${env.buff}</div>
        <div class="lp-env-debuff"><b>디버프</b> ${env.debuff}</div>
        <div class="lp-env-future">${env.future}</div>
      </div>
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
    if (S.ending && S.ending.gridKey === key && !S.ending.accepted) {
      G.UI.flash && G.UI.flash('특별 의뢰 수락 전에는 이 부지를 구매할 수 없습니다.');
      hideLandPrompt();
      return;
    }
    if (!landConnected(key)) { G.UI.flash && G.UI.flash('소유 영토와 연결된 그리드만 구매 가능'); hideLandPrompt(); return; }
    const cost = landCost(key);
    if (S.money < cost) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost;
    S.ownedLand[key] = true;
    S.landBought = (S.landBought || 0) + 1;
    generateRuinsNearOwned();
    ensureEnvironmentFeatures();
    refreshUnacceptedQuestRewards();
    hideLandPrompt();
    G.Assets.playSfx('place');
    const env = landEnvironment(key);
    G.UI.flash && G.UI.flash(env.name + ' 그리드 구매 완료 ₩-' + cost.toLocaleString());
    if (G.UI && G.UI.onGridBought) G.UI.onGridBought();
  }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function ruinClearance(typeKey) {
    const map = C.RUIN_CLEARANCE_BY_TYPE || {};
    if (Object.prototype.hasOwnProperty.call(map, typeKey)) return map[typeKey];
    return C.RUIN_START_CLEARANCE || 0;
  }
  function ruinFitsClearance(col, row, w, h, typeKey) {
    const minStartDist = ruinClearance(typeKey);
    return [
      [col, row],
      [col + w - 1, row],
      [col, row + h - 1],
      [col + w - 1, row + h - 1],
    ].every(p => startFieldClearance(p[0], p[1]) >= minStartDist);
  }
  function ruinDistanceFactor(gx, gy) {
    const starts = startLandKeys();
    let best = Infinity;
    for (const key in starts) {
      const p = parseLandKey(key);
      best = Math.min(best, Math.abs(gx - p.gx) + Math.abs(gy - p.gy));
    }
    return 1 + Math.max(0, best - 1) * 0.35;
  }
  function placeRuinInGrid(gx, gy, typeKey, def) {
    const n = C.LAND_GRID_SIZE || 40;
    for (let tries = 0; tries < 40; tries++) {
      const col = gx * n + randInt(1, Math.max(1, n - def.w - 1));
      const row = gy * n + randInt(1, Math.max(1, n - def.h - 1));
      if (col < 0 || row < 0 || col + def.w >= COLS || row + def.h >= ROWS) continue;
      if (isStartFieldCell(col, row) || isStartFieldCell(col + def.w - 1, row + def.h - 1)) continue;
      if (!ruinFitsClearance(col, row, def.w, def.h, typeKey)) continue;
      const overlapsRuin = (S.ruins || []).some(r => !(col + def.w <= r.col || col >= r.col + r.w || row + def.h <= r.row || row >= r.row + r.h));
      if (overlapsRuin) continue;
      S.ruins.push({
        id: G.uid(), type: typeKey, variant: randInt(1, 3), flipX: Math.random() < 0.5,
        col, row, w: def.w, h: def.h, scrap: randInt(def.scrap[0], def.scrap[1]),
        persistent: !!def.persistent, resourceType: def.resource || null,
        resourceMax: def.max || null, resourceRegen: def.regen || 0,
      });
      return true;
    }
    return false;
  }
  function generateRuinsNearOwned() {
    if (!S.ruins) S.ruins = [];
    if (!S.ruinGrids) S.ruinGrids = {};
    S.ruins = S.ruins.filter(r => {
      if (!r || (!r.persistent && (r.scrap || 0) <= 0)) return false;
      return ruinFitsClearance(r.col, r.row, r.w, r.h, r.type);
    });
    const seeds = Object.assign({}, startLandKeys(), S.ownedLand || {});
    const todo = {};
    for (const key in seeds) {
      if (!seeds[key]) continue;
      const p = parseLandKey(key);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) todo[(p.gx + dx) + '|' + (p.gy + dy)] = true;
    }
    for (const key in todo) {
      if (startLandKeys()[key]) continue;
      const p = parseLandKey(key);
      const defs = C.RUIN_TYPES || {};
      if (S.ruinGrids[key] === true) S.ruinGrids[key] = {}; // 이전 세이브 호환: 그리드 단위 완료 기록을 타입별 기록으로 전환
      if (!S.ruinGrids[key]) S.ruinGrids[key] = {};
      const envKey = landEnvironmentKey(key);
      for (const tk of Object.keys(defs)) {
        if (S.ruinGrids[key][tk]) continue;
        const def = defs[tk];
        const count = environmentRuinCount(envKey, tk, def.base || 0);
        const existing = S.ruins.filter(r => {
          const centerCol = r.col + r.w / 2;
          const centerRow = r.row + r.h / 2;
          return r.type === tk && landKeyForCell(centerCol, centerRow) === key;
        }).length;
        let total = existing;
        for (let i = existing; i < count; i++) if (placeRuinInGrid(p.gx, p.gy, tk, def)) total++;
        if (total >= count || count === 0) S.ruinGrids[key][tk] = true;
      }
    }
  }
  function environmentRuinCount(envKey, type, base) {
    const table = {
      wasteland: { debris: 3, wreck: 0, ruin: 0 },
      park: { debris: 2, wreck: 1, ruin: 0 },
      farmland: { debris: 2, wreck: 1, ruin: 0 },
      powerplant: { debris: 5, wreck: 6, ruin: 1 },
      downtown: { debris: 5, wreck: 6, ruin: 1 },
      mudflat: { debris: 2, wreck: 0, ruin: 0, aquafarm: 3 },
      redzone: { debris: 7, wreck: 7, ruin: 3 },
      bunker: { debris: 8, wreck: 7, ruin: 3 },
    };
    const row = table[envKey];
    return Math.max(0, row && row[type] != null ? row[type] : base);
  }
  function ensureEnvironmentFeatures() {
    if (!S.environmentFeatures) S.environmentFeatures = {};
    for (const key of Object.keys(S.ownedLand || {})) {
      if (!S.ownedLand[key] || S.environmentFeatures[key]) continue;
      const envKey = landEnvironmentKey(key);
      let made = 0;
      if (envKey === 'powerplant') made += placeFixedEnvironmentDevice(key, 'firecharge', 0, 0) ? 1 : 0;
      if (envKey === 'bunker') {
        made += placeFixedEnvironmentDevice(key, 'sniper', -4, 0) ? 1 : 0;
        made += placeFixedEnvironmentDevice(key, 'mortar', 4, 0) ? 1 : 0;
      }
      if (envKey !== 'powerplant' && envKey !== 'bunker') S.environmentFeatures[key] = true;
      else if ((envKey === 'powerplant' && made >= 1) || (envKey === 'bunker' && made >= 2)) S.environmentFeatures[key] = true;
    }
  }
  function placeFixedEnvironmentDevice(key, type, offC, offR) {
    if (S.buildings.some(b => b.fixedEnvironment && b.environmentGridKey === key && b.type === type)) return true;
    const p = parseLandKey(key), n = C.LAND_GRID_SIZE || 48, def = G.DEVICES[type];
    if (!def) return false;
    const centerC = p.gx * n + Math.floor(n / 2) + (offC || 0);
    const centerR = p.gy * n + Math.floor(n / 2) + (offR || 0);
    let spot = null;
    for (let radius = 0; radius < 12 && !spot; radius++) {
      for (let dy = -radius; dy <= radius && !spot; dy++) for (let dx = -radius; dx <= radius && !spot; dx++) {
        const col = centerC + dx - Math.floor(def.w / 2), row = centerR + dy - Math.floor(def.h / 2);
        const fp = footprint(type, col, row, 1);
        const insideGrid = fp.cells.every(cell => landKeyForCell(cell.c, cell.r) === key && isOwnedCell(cell.c, cell.r));
        const clear = fp.cells.every(cell => !occAt(cell.c, cell.r) && !hasBelt(cell.c, cell.r));
        const overlapsRuin = (S.ruins || []).some(r => !(col + fp.w <= r.col || col >= r.col + r.w || row + fp.h <= r.row || row >= r.row + r.h));
        if (insideGrid && clear && !overlapsRuin) spot = { col, row, fp };
      }
    }
    if (!spot) return false;
    const b = {
      id: G.uid(), type, col: spot.col, row: spot.row, w: spot.fp.w, h: spot.fp.h, dir: 1,
      cost: 0, fixedEnvironment: true, environmentGridKey: key,
    };
    if (type === 'firecharge') Object.assign(b, { state: 'idle', worker: null, fuel: null, fuelT: 0, fuelMax: 0, chaosVictims: [], outBuffer: [] });
    if (type === 'sniper' || type === 'mortar') Object.assign(b, { cd: 0, up: { dmg: 0, rate: 0, range: 0 }, kills: 0, mode: 'raider', aim: -Math.PI / 2 });
    attach(b);
    return true;
  }
  function ruinAtCell(cell) {
    if (!cell || !S.ruins) return null;
    return S.ruins.find(r => cell.col >= r.col && cell.col < r.col + r.w && cell.row >= r.row && cell.row < r.row + r.h) || null;
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
    // 중앙에 콜로니 센터(5x5) 기본 배치
    const ccol = Math.floor(COLS / 2) - 2, crow = Math.floor(ROWS / 2) - 2;
    if (!S.buildings.some(b => b.type === 'colony')) placeColony(ccol, crow);
    // 콜로니 아래에 시작 우리(3x3)
    const pcol = Math.floor(COLS / 2) - 1, prow = crow + 6;
    const pen = makePen(pcol, prow, 3, 3, { free: true });
    if (pen) for (let i = 0; i < 5; i++) G.Pens.addToPen(pen, G.Creatures.newAdult());
    seedStartPark();
  }
  function seedStartPark() {
    if (!G.Creatures || (S.park && S.park.length)) return;
    const w = C.GAME_W || 1440, h = (C.GAME_H || 960) - 174;
    for (let i = 0; i < 5; i++) {
      const c = G.Creatures.newWild('성체실장');
      c.x = 80 + Math.random() * Math.max(1, w - 160);
      c.y = 80 + Math.random() * Math.max(1, h - 160);
      S.park.push(c);
    }
  }
  // 콜로니가 없으면 시작 필드의 빈 5x5 자리에 배치(기존 세이브 복구용)
  function ensureColony() {
    if (S.buildings.some(b => b.type === 'colony')) return;
    const f = startFieldRect();
    for (let row = f.r0; row + 5 <= f.r1; row++) for (let col = f.c0; col + 5 <= f.c1; col++) {
      let ok = true;
      for (let r = row; r < row + 5 && ok; r++) for (let c = col; c < col + 5 && ok; c++) { if (!isOwnedCell(c, r) || occ[r][c] || hasBelt(c, r)) ok = false; }
      if (ok) { placeColony(col, row); return; }
    }
  }
  // 콜로니 센터 배치(메뉴 외 — 시작/복구용)
  function placeColony(col, row) {
    const b = { id: G.uid(), type: 'colony', col, row, w: 5, h: 5, dir: 1, colony: true, outBuffer: [] };
    S.buildings.push(b); buildingById.set(b.id, b);
    for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r)) occ[cell.r][cell.c] = b.id;
    return b;
  }
  function rectRelCells(w, h) {
    const cells = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push({ c, r });
    return cells;
  }
  function penRelCells(pen) { return Array.isArray(pen.cells) && pen.cells.length ? pen.cells : rectRelCells(pen.w, pen.h); }
  function penAbsCells(pen, col, row) {
    const bc = col == null ? pen.col : col, br = row == null ? pen.row : row;
    return penRelCells(pen).map(cell => ({ c: bc + cell.c, r: br + cell.r }));
  }
  function penCellCount(pen) { return penRelCells(pen).length; }
  function penHasRel(pen, c, r) { return penRelCells(pen).some(cell => cell.c === c && cell.r === r); }
  function normalizeRelCells(absCells) {
    let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    absCells.forEach(cell => { minC = Math.min(minC, cell.c); minR = Math.min(minR, cell.r); maxC = Math.max(maxC, cell.c); maxR = Math.max(maxR, cell.r); });
    const seen = new Set();
    const cells = absCells.map(cell => ({ c: cell.c - minC, r: cell.r - minR }))
      .filter(cell => { const k = cell.c + '|' + cell.r; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => a.r - b.r || a.c - b.c);
    return { col: minC, row: minR, w: maxC - minC + 1, h: maxR - minR + 1, cells };
  }
  function makePen(col, row, w, h, opts) {
    const cells = (opts && opts.cells) ? opts.cells.map(cell => ({ c: cell.c, r: cell.r })) : rectRelCells(w, h);
    for (const cell of cells) {
      const c = col + cell.c, r = row + cell.r;
      if (!inGrid(c, r) || !isOwnedCell(c, r) || occ[r][c] || hasBelt(c, r)) return null;
    }
    const cost = cells.length * (G.BUILD_COST.penboxCell || 0);
    if (!(opts && opts.free) && !spend(cost)) return null;
    const b = { id: G.uid(), type: 'penbox', col, row, w, h, cells, dir: 1, name: (++S.penSeq) + '번 우리', creatures: [], cost: (opts && opts.free) ? 0 : cost };
    attach(b);
    return b;
  }
  // 우리 칸 위에 올라간 inPen 장치(사료분배기/꼬챙이/매지컬 테치카 등) 찾기
  function inPenDeviceAt(c, r) {
    const id = occAt(c, r);
    if (id && id !== 'OOB') { const b = buildingById.get(id); if (b && G.DEVICES[b.type] && G.DEVICES[b.type].inPen) return b; }
    // occ가 우리로 덮인 경우(이론상 없음)에도 대비해 직접 탐색
    for (const b of S.buildings) if (G.DEVICES[b.type] && G.DEVICES[b.type].inPen && b.col === c && b.row === r) return b;
    return null;
  }
  // 우리를 detach/attach로 재구성한 뒤, 우리 칸 위 inPen 장치의 occ·그리기 순서를 복구.
  // (attach가 우리 occ로 덮어쓰고 우리를 buildings 끝으로 옮기므로, 장치를 그 뒤로 다시 보내 바닥에 가려지지 않게 함)
  function reassertInPenDevices(pen) {
    const onPen = new Set(penAbsCells(pen).map(cell => cell.c + '|' + cell.r));
    for (const b of S.buildings.slice()) {
      if (!(G.DEVICES[b.type] && G.DEVICES[b.type].inPen)) continue;
      if (!onPen.has(b.col + '|' + b.row)) continue;
      if (inGrid(b.col, b.row)) occ[b.row][b.col] = b.id;     // 우리 occ에 덮인 칸을 장치로 복구
      const i = S.buildings.indexOf(b);                        // 우리(끝)보다 뒤로 옮겨 바닥 위에 그려지게
      if (i >= 0) { S.buildings.splice(i, 1); S.buildings.push(b); }
    }
  }
  // X+드래그: 사각 범위 안의 우리 칸을 철거. 전부 철거되면 우리 삭제(개체는 바닥에 풀어줌)
  // 철거되는 칸 위의 inPen 장치(사료분배기/꼬챙이/매지컬 테치카 등)도 함께 제거(장착 개체는 방출).
  function demolishPensInRect(a, b) {
    if (!a || !b) return;
    const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
    const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
    const inRectCell = (cell) => cell.c >= minC && cell.c <= maxC && cell.r >= minR && cell.r <= maxR;
    let removedCells = 0;
    for (const pen of G.Pens.allPens().slice()) {
      const abs = penAbsCells(pen);
      const keep = abs.filter(cell => !inRectCell(cell));
      if (keep.length === abs.length) continue;
      // 철거되는 칸 위의 시설은 제거
      abs.filter(inRectCell).forEach(cell => { const dev = inPenDeviceAt(cell.c, cell.r); if (dev) deleteBuilding(dev); });
      removedCells += abs.length - keep.length;
      detach(pen);
      if (!keep.length) {   // 우리 전체 철거 → 개체를 바닥으로
        const cx = pen.col + pen.w / 2, cy = pen.row + pen.h / 2;
        pen.creatures.slice().forEach(cr => spawnWanderer(cr, cx + (Math.random() - 0.5), cy + (Math.random() - 0.5)));
        pen.creatures = [];
        S.buildings = S.buildings.filter(x => x !== pen);
        buildingById.delete(pen.id);
      } else {              // 일부 철거 → 우리 재구성(개체는 다음 프레임 우리 안으로 클램프됨)
        const norm = normalizeRelCells(keep);
        const dCol = pen.col - norm.col, dRow = pen.row - norm.row;
        pen.creatures.forEach(cr => { cr.px = (cr.px || 0.5) + dCol; cr.py = (cr.py || 0.5) + dRow; });
        pen.col = norm.col; pen.row = norm.row; pen.w = norm.w; pen.h = norm.h; pen.cells = norm.cells;
        attach(pen);
        reassertInPenDevices(pen);   // 남은 칸 위 시설 보존
      }
    }
    if (removedCells) { refund(removedCells * (G.BUILD_COST.penboxCell || 0)); G.Assets.playSfx('remove'); }
  }
  // 기존 우리를 드래그 영역까지 확장
  function expandPen(pen, c2, r2, w2, h2) {
    const oldAbs = penAbsCells(pen);
    const abs = oldAbs.slice();
    const oldSet = new Set(oldAbs.map(cell => cell.c + '|' + cell.r));
    const existing = new Set(oldSet);
    for (let r = r2; r < r2 + h2; r++) for (let c = c2; c < c2 + w2; c++) {
      const k = c + '|' + r;
      if (!existing.has(k)) abs.push({ c, r });
      existing.add(k);
    }
    for (const cell of abs) {
      if (oldSet.has(cell.c + '|' + cell.r)) continue;
      if (!inGrid(cell.c, cell.r) || !isOwnedCell(cell.c, cell.r) || occAt(cell.c, cell.r) || hasBelt(cell.c, cell.r)) return false;
    }
    const norm = normalizeRelCells(abs);
    const oldCells = penCellCount(pen), newCells = norm.cells.length;
    const addCost = Math.max(0, newCells - oldCells) * (G.BUILD_COST.penboxCell || 0);
    if (!spend(addCost)) return false;
    const dCol = pen.col - norm.col, dRow = pen.row - norm.row;
    detach(pen);
    pen.creatures.forEach(cr => { cr.px = (cr.px || 0.5) + dCol; cr.py = (cr.py || 0.5) + dRow; });
    pen.col = norm.col; pen.row = norm.row; pen.w = norm.w; pen.h = norm.h; pen.cells = norm.cells;
    pen.cost = (pen.cost || 0) + addCost;
    attach(pen);
    reassertInPenDevices(pen);   // 확장 후에도 우리 칸 위 시설(사료분배기/꼬챙이/테치카) 보존
    if (newCells > oldCells && G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('penExpanded');
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
          <button class="fp-op" data-op="==">정수</button>
          <button class="fp-op" data-op="max">최고</button>
          <button class="fp-op" data-op="min">최저</button>
          <input type="number" id="fp-statval" value="50" min="1" max="200">
        </div></div>
      <div class="fp-lane" id="fp-lane"><span>일치 화물 출력칸</span>
        <button class="fp-lane-btn" data-lane="1">1번칸</button>
        <button class="fp-lane-btn" data-lane="2">2번칸</button></div>
      <div class="fp-prio" id="fp-prio"><span>우선순위 (1=먼저 잡음)</span>
        <div class="fp-prio-row">
          <button class="fp-prio-btn" data-prio="1">1</button>
          <button class="fp-prio-btn" data-prio="2">2</button>
          <button class="fp-prio-btn" data-prio="3">3</button>
          <button class="fp-prio-btn" data-prio="4">4</button>
          <button class="fp-prio-btn" data-prio="5">5</button>
        </div></div>`;
    document.getElementById('game').appendChild(fp);
    fp.querySelectorAll('.fp-lane-btn').forEach(btn => {
      btn.addEventListener('click', () => { if (filterTarget) { filterTarget.filterLane = +btn.dataset.lane; G.Assets.playSfx('click'); } });
    });
    fp.querySelectorAll('.fp-prio-btn').forEach(btn => {
      btn.addEventListener('click', () => { if (filterTarget && isGrabberType(filterTarget.type)) { filterTarget.priority = +btn.dataset.prio; G.Assets.playSfx('click'); } });
    });
    fp.querySelectorAll('.fp-st').forEach(btn => btn.addEventListener('click', () => {
      if (!filterTarget) return;
      const s = btn.dataset.stat;
      if (!s) filterTarget.statFilter = null;
      else {
        const raw = filterTarget.statFilter ? filterTarget.statFilter.value : (parseInt(fp.querySelector('#fp-statval').value, 10) || 50);
        const max = s === '크기' ? sizeMax() : statMax();
        if (!filterTarget.statFilter) filterTarget.statFilter = { stat: s, op: '>=', value: clamp(raw, 1, max) };
        else { filterTarget.statFilter.stat = s; filterTarget.statFilter.value = clamp(raw, 1, max); }
      }
      G.Assets.playSfx('click');
    }));
    fp.querySelectorAll('.fp-op').forEach(btn => btn.addEventListener('click', () => {
      if (filterTarget && filterTarget.statFilter) { filterTarget.statFilter.op = btn.dataset.op; G.Assets.playSfx('click'); }
    }));
    fp.querySelector('#fp-statval').addEventListener('change', () => {
      if (filterTarget && filterTarget.statFilter) {
        const v = parseInt(fp.querySelector('#fp-statval').value, 10);
        const max = filterTarget.statFilter.stat === '크기' ? sizeMax() : statMax();
        if (!isNaN(v)) filterTarget.statFilter.value = clamp(v, 1, max);
      }
    });
    const btns = fp.querySelector('.fp-btns');
    buildCategorizedFilterButtons(btns, (t) => {
      if (!filterTarget) return;
      if (!filterTarget.filter) filterTarget.filter = [];
      const i = filterTarget.filter.indexOf(t);
      if (i >= 0) filterTarget.filter.splice(i, 1);
      else if (filterTarget.type === 'largewarehouse') filterTarget.filter = [t];
      else filterTarget.filter.push(t);
      if (i < 0 && G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('filter:' + t);
      G.Assets.playSfx('click');
    });
  }
  function updateFilterPanel() {
    const panel = document.getElementById('filter-panel');
    if (!panel) return;
    const one = (S.selection.length === 1) ? S.buildings.find(b => b.id === S.selection[0]) : null;
    const selKey = S.selection.join('|');
    const ghostTarget = isGrabberType(currentTool) ? ghostFilterDraft : null;
    filterTarget = ghostTarget || ((one && (one.type === 'sorter' || isGrabberType(one.type) || one.type === 'catcher' || one.type === 'largewarehouse')) ? one : null);
    if (!filterTarget || S.overlay || S.screen !== 'factory' || (!ghostTarget && filterPanelSuppressedKey === selKey)) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const pw = panel.offsetWidth || 348;
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('filterOpened');
    panel.querySelector('.fp-title').textContent = (G.DEVICES[filterTarget.type].name) + ' 필터';
    // 위치: 장치 오른쪽. 화면 아래 1/3 지점이면 위쪽으로 펼침(바닥 넘침 방지)
    const ghostOriginCell = ghostTarget && mouseCell ? ghostOrigin(currentTool, mouseCell, ghostDir) : null;
    if (ghostTarget && !ghostOriginCell) {
      panel.style.left = (C.GAME_W - pw - 4) + 'px';
      panel.style.top = '54px';
    }
    const targetCol = ghostOriginCell ? ghostOriginCell.col : filterTarget.col;
    const targetRow = ghostOriginCell ? ghostOriginCell.row : filterTarget.row;
    const targetFootprint = ghostOriginCell ? footprint(currentTool, targetCol, targetRow, ghostDir) : filterTarget;
    const left = ghostTarget && !ghostOriginCell ? C.GAME_W - pw - 4 : worldToGameX((targetCol + targetFootprint.w) * CELL) + 6;
    const anchorTop = ghostTarget && !ghostOriginCell ? 54 : worldToGameY(targetRow * CELL);
    const ph = panel.offsetHeight || 280;
    let top = anchorTop;
    if (anchorTop > C.GAME_H / 3) top = Math.max(46, worldToGameY((targetRow + targetFootprint.h) * CELL) - ph); // 위로 펼침
    top = Math.min(top, C.GAME_H - ph - 4);
    panel.style.left = clamp(left, 4, C.GAME_W - pw - 4) + 'px';
    panel.style.top = Math.max(46, top) + 'px';
    if (deviceInfoEl && deviceInfoEl.style.display !== 'none' && deviceInfoAnchor) {
      positionMiniPanel(deviceInfoEl, deviceInfoAnchor.x, deviceInfoAnchor.y, avoidInfoPanels(deviceInfoEl));
    }
    const f = filterTarget.filter || [];
    panel.querySelectorAll('.fp-btn').forEach(btn => btn.classList.toggle('active', f.includes(btn.dataset.type)));
    const sf = filterTarget.statFilter;
    const statRow = panel.querySelector('#fp-stat');
    if (statRow) statRow.style.display = filterTarget.type === 'largewarehouse' ? 'none' : 'block';
    panel.querySelectorAll('.fp-st').forEach(btn => btn.classList.toggle('active', (sf ? sf.stat : '') === btn.dataset.stat));
    panel.querySelectorAll('.fp-op').forEach(btn => btn.classList.toggle('active', !!sf && sf.op === btn.dataset.op));
    const valInput = panel.querySelector('#fp-statval');
    valInput.max = sf && sf.stat === '크기' ? sizeMax() : statMax();
    valInput.disabled = !!(sf && rankedStatOp(sf.op));
    if (sf && document.activeElement !== valInput) valInput.value = sf.value;
    const laneRow = panel.querySelector('#fp-lane');
    if (filterTarget.type === 'sorter') {
      laneRow.style.display = 'flex';
      laneRow.querySelectorAll('.fp-lane-btn').forEach(btn => btn.classList.toggle('active', +btn.dataset.lane === (filterTarget.filterLane || 1)));
    } else laneRow.style.display = 'none';
    const prioRow = panel.querySelector('#fp-prio');
    if (prioRow) {
      if (isGrabberType(filterTarget.type)) {
        prioRow.style.display = 'block';
        prioRow.querySelectorAll('.fp-prio-btn').forEach(btn => btn.classList.toggle('active', +btn.dataset.prio === (filterTarget.priority || 3)));
      } else prioRow.style.display = 'none';
    }
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
      // 버튼 썸네일: 1프레임 스프라이트는 전체를, 4프레임(또는 N프레임)은 첫 프레임만 표시.
      const oneFrame = MENU_1FRAME.has(type);
      const frames = oneFrame ? 1 : (type === 'packer' ? 8 : 4);   // 가로 프레임 수
      // N프레임이면 가로를 N배로 늘리고 좌측(첫 프레임)을 보여줌
      const bgStyle = (frames <= 1)
        ? 'background-size:contain;background-position:center'
        : `background-size:${frames * 100}% 100%;background-position:left center`;
      const thumb = (rec && rec.ok)
        ? `<span class="item-thumb" style="background-image:url(${rec.img.src});${bgStyle};background-repeat:no-repeat"></span>`
        : `<span class="item-thumb" style="background:${def.color}"></span>`;
      const requiredPower = def.powerRequired ? `<span class="item-power-required" title="작동에 전력이 필요합니다">⚡</span>` : '';
      b.innerHTML = `${thumb}<span class="item-name">${def.name} <small>${def.w}×${def.h}</small><span class="item-cost">${costLabel(type)}</span></span>${requiredPower}<span class="item-hk"></span>`;
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
    if (type) hotkeys[k] = type;
    else delete hotkeys[k];
    refreshHotkeyBadges();
    G.Assets.playSfx('click');
  }
  function hotkeyBindings() { return cloneData(hotkeys); }
  function hotkeyToolOptions() {
    const out = [];
    for (const cat of Object.keys(G.MENU)) {
      for (const type of G.MENU[cat].items) {
        const def = G.DEVICES[type];
        if (!def || !isUnlocked(type) || out.some(x => x.type === type)) continue;
        out.push({ type, name: def.name, category: G.MENU[cat].label });
      }
    }
    return out;
  }
  function setBuildHotkey(key, type) {
    if (!/^[0-9]$/.test(String(key))) return false;
    if (type && !isUnlocked(type)) return false;
    assignHotkey(String(key), type || null);
    return true;
  }
  function exportRuntimeState() {
    return { hotkeys: cloneData(hotkeys), blueprints: cloneData(blueprints) };
  }
  function importRuntimeState(data) {
    data = data || {};
    Object.keys(hotkeys).forEach(k => delete hotkeys[k]);
    Object.assign(hotkeys, data.hotkeys || {});
    Object.keys(blueprints).forEach(k => delete blueprints[k]);
    Object.assign(blueprints, data.blueprints || {});
    refreshHotkeyBadges();
    renderBlueprintTab();
  }
  function refreshMenu() {
    renderMenuItems();
    highlightCat();
    refreshHotkeyBadges();
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
    const listedInActiveCat = !!(G.MENU[activeCat] && G.MENU[activeCat].items.includes(type));
    if (cat && cat !== activeCat && !listedInActiveCat) { activeCat = cat; renderMenuItems(); highlightCat(); }  // 현재 탭에 없는 장치만 기본 탭으로 전환
    currentTool = type; ghostDir = 1; S.selection = []; selectedPenCreature = null;
    ghostFilterDraft = isGrabberType(type)
      ? { type, filter: [], statFilter: null, priority: 3, _ghost: true }
      : null;
    G.Assets.playSfx('click');
    document.querySelectorAll('.item-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    setStatus(type === 'chaosgate'
      ? '드래그 하여 입구와 출구를 동시에 설치하세요'
      : type === 'crossbelt'
      ? `직선으로 드래그하여 최대 ${CROSSBELT_MAX_DISTANCE}칸 안에 출구를 설치하세요`
      : `설치 중: <b>${G.DEVICES[type].name}</b> (R=회전, 우클릭=취소, 좌클릭=설치)`);
  }
  function cancelTool() {
    closeAuxPanels();
    currentTool = null; beltDragging = false; beltPath = []; beltDragAxis = null; chaosGateDragStart = null; crossbeltDragStart = null; wallDragging = false; wallStartPoint = null; wallEndPoint = null;
    ghostFilterDraft = null;
    document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('active'));
    setStatus('장치 선택 · 빈손: 드래그=영역선택, 클릭=선택, 더블클릭=동종선택, Del=삭제, M=이동');
  }
  function setStatus(html) { const s = document.getElementById('menu-status'); if (s) s.innerHTML = html; }
  function buildCost(type, w, h) {
    if (type === 'penbox') return (w || 1) * (h || 1) * (G.BUILD_COST.penboxCell || 0);
    if (type === 'lab') return (G.BUILD_COST.lab || 500) * Math.pow(2, labCount());
    return (G.BUILD_COST && G.BUILD_COST[type]) || 0;
  }
  function constructionTime(type) {
    const def = G.DEVICES[type] || {};
    if (POWER_POLES.has(type)) return 0;
    if (type === 'warehouse' || type === 'largewarehouse') return 30;
    const times = C.CONSTRUCTION_TIME || {};
    const tier = def.tier || 0;
    const fallback = Object.keys(times).reduce((best, key) => Math.max(best, +key || 0), 0);
    return Math.max(0, times[tier] != null ? times[tier] : (times[fallback] || 0));
  }
  function startConstruction(b) {
    const total = constructionTime(b.type);
    if (total <= 0) return b;
    b.constructionTotal = total;
    b.constructionLeft = total;
    b.state = 'constructing';
    return b;
  }
  function isConstructing(b) { return !!(b && (b.constructionLeft || 0) > 0); }
  function constructionAlpha(b) {
    if (!isConstructing(b)) return 1;
    return 0.5 + 0.5 * (1 - b.constructionLeft / Math.max(0.001, b.constructionTotal || 1));
  }
  function labCount() { return S.buildings.filter(b => b.type === 'lab').length; }
  function labScrapCost() {
    const n = labCount();
    return n >= 3 ? 100 * Math.pow(2, n - 3) : 0;
  }
  function buildScrapCost(type) {
    if (type === 'lab') return labScrapCost();
    if (type === 'salecenter') return 100;
    if (type === 'techica') return 100;
    if (type === 'sniper') return 300;
    if (type === 'mortar') return 500;
    if (type === 'acidgen') return 100;
    if (type === 'firecharge') return 500;
    if (type === 'chaoscharge') return 2000;
    if (type === 'ironpole') return 10;
    if (type === 'chaospole') return 100;
    if (type === 'driller') return 100;
    if (type === 'largewarehouse') return 200;
    return 0;
  }
  function buildElectronicPartsCost(type) {
    const counts = S.buildInstallCounts || {};
    if (type === 'largewarehouse') return 4;
    if (type === 'terrarium') return 20;
    if (type === 'driller') return 2 * Math.pow(2, counts.driller || 0);
    if (type === 'firecharge') return Math.pow(2, counts.firecharge || 0);
    if (type === 'mortar') return 1;
    return 0;
  }
  function costLabel(type) {
    if (type === 'penbox') return moneyCostHtml(G.BUILD_COST.penboxCell || 0) + '<em>/칸</em>';
    if (type === 'wall') return moneyCostHtml(G.BUILD_COST.wall || 0) + '<em>/칸</em>';
    const c = buildCost(type);
    const scrap = buildScrapCost(type);
    const electronicParts = buildElectronicPartsCost(type);
    const chaosMaggot = ['chaoscharge', 'chaosturret', 'chaosgate', 'wrongchaosmargot'].includes(type) ? 1 : 0;
    return (c ? moneyCostHtml(c) : '') +
      (scrap ? resourceCostHtml('철조각', scrap) : '') +
      (electronicParts ? resourceCostHtml('전자부품', electronicParts) : '') +
      (chaosMaggot ? resourceCostHtml('카오스 구더기', chaosMaggot) : '');
  }
  function moneyCostHtml(n) { return '<span class="cost-money">₩' + (n || 0).toLocaleString() + '</span>'; }
  function resourceCostHtml(type, n) {
    const def = G.PRODUCTS[type];
    const icon = def && def.img
      ? `<span class="cost-icon" style="background-image:url('assets/images/products/${def.img}')"></span>`
      : '<span class="cost-icon cost-scrap"></span>';
    return '<span class="cost-res">' + icon + (n || 0).toLocaleString() + '</span>';
  }
  function spend(cost) {
    if (!cost) return true;
    if (S.money < cost) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return false; }
    S.money -= cost;
    return true;
  }
  function refund(cost, ratio) {
    if (cost > 0) S.money += Math.floor(cost * (ratio == null ? 0.75 : ratio));
  }
  function warehouseCount(type) {
    const list = S.warehouse[type];
    return list ? list.length : 0;
  }
  function takeWarehouse(type, n) {
    const list = S.warehouse[type];
    if (!list || list.length < n) return false;
    list.splice(0, n);
    return true;
  }
  function isLocalWarehouse(b) {
    return S.difficulty === 'dokura' && b && (b.type === 'warehouse' || b.type === 'largewarehouse');
  }
  function inventoryOf(b) {
    if (!isLocalWarehouse(b)) return S.warehouse;
    if (!b.inventory || typeof b.inventory !== 'object') b.inventory = {};
    return b.inventory;
  }
  function inventoryCount(inv) {
    return Object.keys(inv || {}).reduce((n, type) => n + ((inv[type] && inv[type].length) || 0), 0);
  }
  function warehouseCapacity(b) {
    if (!isLocalWarehouse(b)) return Infinity;
    if (b.type === 'warehouse') return 1000 + 500 * Math.max(0, b.storageLevel || 0);
    return (G.DEVICES[b.type] && G.DEVICES[b.type].storage) || 10000;
  }
  function warehouseUpgradeCost(b) { return 500 * Math.pow(2, Math.max(0, b && b.storageLevel || 0)); }
  function inventoryRoomFor(b) {
    return isLocalWarehouse(b)
      ? Math.max(0, warehouseCapacity(b) - inventoryCount(inventoryOf(b)))
      : playerInventoryRoom();
  }
  function isUnlocked(type) {
    const def = G.DEVICES[type];
    if (def && def.monument) return !!(S.monumentsUnlocked && S.monumentsUnlocked[type]);
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
    deviceInfoBuilding = b || null;
    const el = ensureDeviceInfo();
    const rot = def.rotatable ? '<span>회전 가능</span>' : '';
    const range = def.range ? `<span>범위 ${def.range.w}×${def.range.h}</span>` : '';
    const workers = def.worker ? `<span>일꾼 ${C.WORKER_SLOTS}칸</span>` : '';
    const buildSec = constructionTime(type);
    const buildMeta = `<span>건설 ${buildSec ? buildSec + '초' : '즉시'}</span>`;
    const env = b ? environmentForBuilding(b) : null;
    const envMeta = env ? `<span title="${env.scope === 'owned' ? '소유형' : '지역형'}">${env.icon} ${env.name}</span>` : '';
    const fixedMeta = b && b.fixedEnvironment ? '<span>환경 고정 시설</span>' : '';
    const state = b ? deviceStateLine(b) : '';
    const details = (b ? deviceInfoDetails(b) : deviceTypeDetails(type)) + devicePowerInfo(type, b);
    const actions = b ? deviceInfoActions(b) : '';
    el.innerHTML = `
      <div class="di-head"><b>${def.name}</b><button class="di-close">×</button></div>
      <div class="di-meta"><span>${def.w}×${def.h}</span>${rot}${range}${workers}${buildMeta}${envMeta}${fixedMeta}</div>
      <div class="di-desc">${def.desc || ''}</div>${state}${details}${actions}`;
    el.querySelector('.di-close').onclick = hideDeviceInfo;
    const detachTeacherBtn = el.querySelector('[data-action="detach-teacher"]');
    if (detachTeacherBtn) detachTeacherBtn.onclick = () => {
      snapshot();
      detachCorrectionTeacher(b);
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    };
    el.querySelectorAll('[data-feed-type]').forEach(btn => btn.onclick = () => {
      if (!b || b.type !== 'feeder') return;
      b.feedType = btn.dataset.feedType;
      G.Assets.playSfx('click');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    const feedAllBtn = el.querySelector('[data-feed-all]');
    if (feedAllBtn) feedAllBtn.onclick = () => {
      if (!b || b.type !== 'feeder') return;
      const ft = b.feedType || '실장푸드';
      for (const f of S.buildings) if (f.type === 'feeder') f.feedType = ft;
      G.Assets.playSfx('place');
      G.UI.flash && G.UI.flash('모든 사료분배기에 ' + (FEED_LABEL[ft] || ft) + ' 적용');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    };
    const catchUpBtn = el.querySelector('[data-catch-up]');
    if (catchUpBtn) catchUpBtn.onclick = () => {
      if (!b || b.type !== 'catcher') return;
      if (!b.up) b.up = { range: 0 };
      if (b.up.range >= (C.CATCH_UP_MAX || 8)) return;
      if (!spend(catchUpCost(b))) return;
      b.up.range += 1;
      G.Assets.playSfx('place');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    };
    const saleUpBtn = el.querySelector('[data-sale-up]');
    if (saleUpBtn) saleUpBtn.onclick = () => {
      if (!b || b.type !== 'salecenter') return;
      if (!spend(C.SALECENTER_UP_COST || 5000)) return;
      b.up = (b.up || 0) + 1;
      G.Assets.playSfx('place');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    };
    el.querySelectorAll('[data-wrong-chaos-gacha]').forEach(btn => btn.onclick = () => {
      if (!b || b.type !== 'wrongchaosmargot') return;
      startWrongChaosGacha(b, btn.dataset.wrongChaosGacha);
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-terrarium-feed]').forEach(btn => btn.onclick = () => {
      if (!b || b.type !== 'terrarium') return;
      b.feedType = btn.dataset.terrariumFeed;
      G.Assets.playSfx('click');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    const labUpBtn = el.querySelector('[data-lab-up]');
    if (labUpBtn) labUpBtn.onclick = () => {
      if (!b || b.type !== 'lab') return;
      const cost = labUpgradeCost(b);
      if (S.money < cost.money) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.money.toLocaleString() + ')'); return; }
      if (warehouseCount('전자부품') < cost.parts) { G.UI.flash && G.UI.flash('전자부품 부족! (' + cost.parts.toLocaleString() + '개 필요)'); return; }
      snapshot();
      S.money -= cost.money;
      takeWarehouse('전자부품', cost.parts);
      b.labLevel = (b.labLevel || 0) + 1;
      G.Assets.playSfx('upgrade');
      G.UI.flash && G.UI.flash('연구소 Lv.' + b.labLevel + ' 강화 완료');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    };
    const colonyTierBtn = el.querySelector('[data-colony-tier-up]');
    if (colonyTierBtn) colonyTierBtn.onclick = () => {
      if (!b || b.type !== 'colony') return;
      upgradeColonyTier();
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    };
    const endingAcceptBtn = el.querySelector('[data-ending-accept]');
    if (endingAcceptBtn) endingAcceptBtn.onclick = () => acceptEndingQuest(false);
    el.querySelectorAll('[data-quest-accept]').forEach(btn => btn.onclick = () => {
      acceptQuest(+btn.dataset.questAccept);
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-quest-reject]').forEach(btn => btn.onclick = () => {
      rejectQuest(+btn.dataset.questReject);
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-quest-complete]').forEach(btn => btn.onclick = () => {
      completeQuest(+btn.dataset.questComplete);
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-quest-deliver]').forEach(btn => btn.onclick = () => {
      deliverQuest(+btn.dataset.questDeliver);
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-reformer-mode]').forEach(btn => btn.onclick = () => {
      if (!b || b.type !== 'reformer') return;
      b.defaultMode = btn.dataset.reformerMode;
      G.Assets.playSfx('click');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-cook-menu]').forEach(btn => btn.onclick = () => {
      if (!b || b.type !== 'cookery') return;
      b.menu = (b.menu === btn.dataset.cookMenu) ? null : btn.dataset.cookMenu;   // 다시 누르면 해제
      b.cooking = null; b.timer = 0;
      G.Assets.playSfx('click');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.querySelectorAll('[data-mix-menu]').forEach(btn => btn.onclick = () => {
      if (!b || b.type !== 'mixer') return;
      b.menu = (b.menu === btn.dataset.mixMenu) ? null : btn.dataset.mixMenu;   // 다시 누르면 해제
      b.timer = 0;
      G.Assets.playSfx('click');
      showDeviceInfoForBuilding(b, deviceInfoAnchor ? deviceInfoAnchor.x : clientX, deviceInfoAnchor ? deviceInfoAnchor.y : clientY);
    });
    el.style.display = 'block';
    deviceInfoAnchor = { x: clientX, y: clientY };
    positionMiniPanel(el, clientX, clientY, avoidInfoPanels(el));
  }
  function showDeviceInfoForBuilding(b, clientX, clientY) { if (b) showDeviceInfoForType(b.type, clientX, clientY, b); }
  function hideDeviceInfo() { if (deviceInfoEl) deviceInfoEl.style.display = 'none'; deviceInfoAnchor = null; deviceInfoBuilding = null; }
  function repositionDeviceInfo() {
    if (deviceInfoEl && deviceInfoEl.style.display !== 'none' && deviceInfoAnchor) {
      positionMiniPanel(deviceInfoEl, deviceInfoAnchor.x, deviceInfoAnchor.y, avoidInfoPanels(deviceInfoEl));
    }
  }
  function avoidInfoPanels(self) {
    return ['filter-panel', 'pen-panel', 'birthing-panel', 'turret-panel', 'labor-panel', 'land-prompt']
      .map(id => document.getElementById(id))
      .filter(el => el && el !== self && el.style.display !== 'none');
  }
  function closeAuxPanels() {
    hideDeviceInfo();
    if (landPromptEl) landPromptEl.style.display = 'none';
    const panel = document.getElementById('filter-panel');
    if (panel) panel.style.display = 'none';
    const lp = document.getElementById('labor-panel');
    if (lp) { lp.style.display = 'none'; }
    laborTarget = null;
    filterPanelSuppressedKey = S.selection.join('|');
  }
  function allowAuxPanels() { filterPanelSuppressedKey = ''; }
  function deviceStateLine(b) {
    if (isConstructing(b)) return `<div class="di-state">건설 중 · ${Math.ceil(b.constructionLeft)}초 남음</div>`;
    if (powerBlocked(b)) return `<div class="di-state">${b.powerConnected ? '전력 부족' : '전력 연결 안됨'}</div>`;
    if (b.type === 'penbox') return `<div class="di-state">이름: ${b.name || '우리'} · 수용 ${b.creatures ? b.creatures.length : 0}마리</div>`;
    if (b.type === 'warehouse') {
      if (isLocalWarehouse(b)) return `<div class="di-state">독립 재고 ${inventoryCount(inventoryOf(b)).toLocaleString()}/${warehouseCapacity(b).toLocaleString()}</div>`;
      return '<div class="di-state">공유 재고는 거래창에서 판매합니다.</div>';
    }
    if (b.type === 'largewarehouse') {
      const out = b.filter && b.filter[0];
      const side = ['위', '오른쪽', '아래', '왼쪽'][b.dir == null ? 1 : b.dir];
      return `<div class="di-state">${side} 면 출력 필터: ${out ? (FILTER_LABEL[out] || out) : '미선택'}</div>`;
    }
    if (b.type === 'wrongchaosmargot') {
      const mood = WRONG_CHAOS_MOODS[b.mood || 1] || WRONG_CHAOS_MOODS[1];
      const gacha = b.gachaRemaining > 0 ? ` · 가챠 ${10 - b.gachaRemaining}/10회` : '';
      return `<div class="di-state">기분: ${mood.label}${gacha}</div>`;
    }
    if (b.type === 'terrarium') {
      const n = (b.incubatorCreatures || []).length;
      return `<div class="di-state">DNA ${b.dnaStats ? '등록됨' : '없음'} · 배양 ${n}/100 · 운치 ${Math.floor(b.incubatorUnchi || 0).toLocaleString()}</div>`;
    }
    if (b.type === 'launchpad') {
      const e = endingState();
      if (e.stage < 2) return `<div class="di-state">철조각 ${Math.floor(e.scrap).toLocaleString()}/${endingNeed().scrap.toLocaleString()} · 상품 ${Math.floor(e.products).toLocaleString()}/${endingNeed().products.toLocaleString()} · 초고농축 운치 ${Math.floor(e.concentrate).toLocaleString()}/${endingNeed().concentrate.toLocaleString()} · 전자부품 ${Math.floor(e.electronics || 0).toLocaleString()}/${endingNeed().electronics.toLocaleString()}</div>`;
      return `<div class="di-state">전력 충전 ${Math.floor(e.charge).toLocaleString()}/${endingNeed().charge.toLocaleString()} · 철조각 ${Math.floor(e.scrap).toLocaleString()}/${endingNeed().scrap.toLocaleString()}</div>`;
    }
    if (b.type === 'correction') {
      const t = b.teacher && b.teacher.stats ? Math.floor(b.teacher.stats.개념 || 0) : null;
      return `<div class="di-state">교사 ${t == null ? '없음' : '개념 ' + t + '%'} · 수용 ${b.inmates ? b.inmates.length : 0}/${G.DEVICES.correction.hold}</div>`;
    }
    if (b.type === 'sorter' || isGrabberType(b.type) || b.type === 'catcher') {
      const n = b.filter ? b.filter.length : 0;
      return `<div class="di-state">필터 ${n ? n + '종 선택됨' : '전체 통과'}</div>`;
    }
    return '';
  }
  function infoRows(rows) {
    return '<div class="di-extra">' + rows.filter(Boolean).map(r => `<div class="di-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + '</div>';
  }
  function devicePowerInfo(type, b) {
    const def = G.DEVICES[type];
    if (!def || !(def.powerUse > 0)) return '';
    const mode = def.powerRequired ? '필수' : '보조';
    if (!b) return infoRows([['전력 소모', `작동 중 ${def.powerUse} (${mode})`]]);
    const active = deviceWantsPower(b);
    const actual = active && b.powered ? basePowerUse(b) : 0;
    return infoRows([
      ['전력 소모', `작동 중 ${def.powerUse} (${mode})`],
      ['현재 전력', active ? `${actual}/${def.powerUse}` : `0/${def.powerUse} · 대기`],
    ]);
  }
  function deviceInfoActions(b) {
    if (b.type === 'colony') {
      const up = S.colonyUpgrade;
      const next = (S.colonyTier || 0) + 1;
      let html = '';
      if (up) {
        const sec = Math.max(0, Math.ceil(up.remain));
        const pct = Math.floor(clamp(1 - up.remain / up.total, 0, 1) * 100);
        html += `<div class="di-row"><span>티어 ${up.target} 승급 중</span><b>${fmtMMSS(sec)} 남음</b></div>`;
        html += `<div class="di-actions"><button disabled>승급 진행 중... ${pct}%</button></div>`;
      } else if (next <= 4) {
        const c = colonyTierCost(next);
        const lock = colonyTierLockReason(next);
        const mins = Math.round(colonyUpgradeDuration(next) / 60);
        if (lock) {
          html += `<div class="di-actions"><button disabled>티어 ${next} 승급 — ${lock}</button></div>`;
        } else {
          html += `<div class="di-actions"><button data-colony-tier-up="1">티어 ${next} 승급 (${moneyCostHtml(c.money)}${c.scrap ? ' ' + resourceCostHtml('철조각', c.scrap) : ''}${c.electronics ? ' ' + resourceCostHtml('전자부품', c.electronics) : ''}) · ${mins}분 소요</button></div>`;
        }
      }
      html += questBoardHtml();
      return html;
    }
    if (b.type === 'correction' && b.teacher) return '<div class="di-actions"><button data-action="detach-teacher">교사 해제</button></div>';
    if (b.type === 'feeder') {
      const cur = b.feedType || '실장푸드';
      const btns = FEED_TYPES.map(t => `<button class="cook-menu-btn ${cur === t ? 'active' : ''}" data-feed-type="${t}" title="${escAttr((FEED_LABEL[t] || t) + ' — ' + (FEED_DESC[t] || ''))}">${deviceInfoItemIcon(t)}<small>${FEED_LABEL[t] || t}</small></button>`).join('');
      return '<div class="di-row"><span>사료 선택</span><b>' + (FEED_LABEL[cur] || cur) + '</b></div>' +
        `<div class="di-desc-sub">${FEED_DESC[cur] || ''}</div>` +
        '<div class="di-actions cook-menu">' + btns + '</div>' +
        '<div class="di-actions"><button data-feed-all="1">모든 사료분배기에 적용</button></div>';
    }
    if (b.type === 'catcher') {
      const lv = (b.up && b.up.range) || 0, max = C.CATCH_UP_MAX || 8;
      const base = (G.DEVICES.catcher && G.DEVICES.catcher.range && G.DEVICES.catcher.range.w) || 5;
      const side = base + lv * (C.CATCH_RANGE_PER_LV || 1) * 2;
      const label = lv >= max ? '범위 MAX' : ('범위 +1 (₩' + catchUpCost(b).toLocaleString() + ')');
      return `<div class="di-row"><span>범위</span><b>${side}×${side} · Lv.${lv}/${max}</b></div>` +
        `<div class="di-actions"><button data-catch-up="1" ${lv >= max ? 'disabled' : ''}>${label}</button></div>`;
    }
    if (b.type === 'salecenter') {
      const lv = b.up || 0;
      return `<div class="di-row"><span>판매가</span><b>+${lv * 10}% · Lv.${lv}</b></div>` +
        `<div class="di-actions"><button data-sale-up="1">판매가 +10% (₩${(C.SALECENTER_UP_COST || 5000).toLocaleString()})</button></div>`;
    }
    if (b.type === 'wrongchaosmargot') {
      const active = (b.gachaRemaining || 0) > 0;
      const buttons = FEED_TYPES.map(type => {
        const have = Math.floor(feedResourceAmount(type));
        return `<button data-wrong-chaos-gacha="${type}" ${active ? 'disabled' : ''}>${deviceInfoItemIcon(type)}${FEED_LABEL[type] || type} 1,000 <small>(보유 ${have.toLocaleString()})</small></button>`;
      }).join('');
      return `<div class="di-row"><span>프니프니 가챠</span><b>${active ? '본체를 클릭하세요 (' + b.gachaRemaining + '회 남음)' : '먹이 1,000개 필요'}</b></div>` +
        '<div class="di-desc-sub">한 번 시작하면 본체를 10번 클릭하며, 클릭할 때마다 아이템 1개가 떨어집니다.</div>' +
        '<div class="di-actions cook-menu">' + buttons + '</div>';
    }
    if (b.type === 'terrarium') {
      const cur = b.feedType || '실장푸드';
      const buttons = FEED_TYPES.map(type =>
        `<button class="cook-menu-btn ${cur === type ? 'active' : ''}" data-terrarium-feed="${type}">${deviceInfoItemIcon(type)}<small>${FEED_LABEL[type] || type}</small></button>`
      ).join('');
      return '<div class="di-row"><span>내부 공급 사료</span><b>' + (FEED_LABEL[cur] || cur) + '</b></div>' +
        `<div class="di-desc-sub">전역 재고에서 소비합니다. 현재 보유 ${Math.floor(feedResourceAmount(cur)).toLocaleString()}개</div>` +
        '<div class="di-actions cook-menu">' + buttons + '</div>';
    }
    if (b.type === 'lab') {
      const lv = b.labLevel || 0;
      const cost = labUpgradeCost(b);
      const pct = Math.round((Math.pow(C.LAB_UP_MULT || 1.3, lv) - 1) * 100);
      const title = '이 연구소가 생산하는 연구력 +30%, 소비 전력 +30%. 비용은 업그레이드할 때마다 2배가 됩니다.';
      return `<div class="di-row"><span>연구소 강화</span><b>Lv.${lv} · 연구력/전력 +${pct}%</b></div>` +
        `<div class="di-actions"><button data-lab-up="1" title="${escAttr(title)}">강화 (${moneyCostHtml(cost.money)} ${resourceCostHtml('전자부품', cost.parts)})</button></div>`;
    }
    if (b.type === 'reformer') {
      const cur = b.defaultMode || 'hold';
      return '<div class="di-row"><span>기본 명령</span><b>갓 생산된 노동석에 적용</b></div>' +
        '<div class="di-actions">' + LABOR_MODES.map(([m, label]) => `<button data-reformer-mode="${m}" class="${cur === m ? 'active' : ''}">${label}</button>`).join('') + '</div>';
    }
    if (b.type === 'cookery') {
      const cook = G.DEVICES.cookery.cook;
      const cur = b.menu || '';
      const btns = Object.keys(cook).filter(key => !cook[key].unlock || (S.upgrades && S.upgrades[cook[key].unlock])).map(key => {
        const r = cook[key];
        return `<button class="cook-menu-btn ${cur === key ? 'active' : ''}" data-cook-menu="${key}" title="${escAttr(r.out + ' — ' + r.desc)}">${deviceInfoItemIcon(r.out)}<small>${r.out}</small></button>`;
      }).join('');
      return '<div class="di-row"><span>메뉴 선택</span><b>' + (cur ? cook[cur].out : '없음') + '</b></div>' +
        (cur ? `<div class="di-desc-sub">${cook[cur].desc}</div>` : '<div class="di-desc-sub">메뉴를 골라야 조리를 시작합니다.</div>') +
        '<div class="di-actions cook-menu">' + btns + '</div>';
    }
    if (b.type === 'mixer') {
      const mix = G.DEVICES.mixer.mix;
      const cur = b.menu || '';
      const btns = Object.keys(mix).map(key => {
        const r = mix[key];
        return `<button class="cook-menu-btn ${cur === key ? 'active' : ''}" data-mix-menu="${key}" title="${escAttr(r.out + ' — ' + r.desc)}">${deviceInfoItemIcon(r.out)}<small>${r.out}</small></button>`;
      }).join('');
      const effDesc = cur && FEED_DESC[mix[cur].out] ? `<div class="di-desc-sub">효과: ${FEED_DESC[mix[cur].out]}</div>` : '';
      return '<div class="di-row"><span>메뉴 선택</span><b>' + (cur ? mix[cur].out : '없음') + '</b></div>' +
        (cur ? `<div class="di-desc-sub">재료: ${mix[cur].desc}</div>` : '<div class="di-desc-sub">메뉴를 골라야 배합을 시작합니다.</div>') +
        effDesc +
        '<div class="di-actions cook-menu">' + btns + '</div>';
    }
    return '';
  }
  function catchUpCost(b) { return (C.CATCH_UP_COST || 800) * (((b.up && b.up.range) || 0) + 1); }
  function labUpgradeCost(b) {
    const lv = Math.max(0, (b && b.labLevel) || 0);
    return {
      money: Math.round((C.LAB_UP_MONEY || 1000) * Math.pow(2, lv)),
      parts: Math.round((C.LAB_UP_PARTS || 1) * Math.pow(2, lv)),
    };
  }
  // 콜로니 패널의 퀘스트 보드 HTML
  function questBoardHtml() {
    const qs = questsForUI();
    let html = '<div class="di-quest-head">📻 무전 의뢰</div>';
    if (!qs.length && !(S.ending && S.ending.offered)) { return html + '<div class="di-desc-sub">대기 중인 의뢰가 없습니다.</div>'; }
    for (const q of qs) {
      const statTxt = q.stat ? ` <small>(${q.stat.key}≥${q.stat.min})</small>` : '';
      // 누적 납품량 표시 (보유분은 괄호로)
      const filled = q.delivered >= q.n;
      const prog = q.accepted ? ` <b class="${filled ? 'q-ok' : 'q-no'}">${q.delivered}/${q.n}</b>${q.have ? ` <small>(보유 ${q.have})</small>` : ''}` : '';
      const canDeliver = q.accepted && q.delivered < q.n && q.have > 0;
      const btn = q.accepted
        ? `<button data-quest-deliver="${q.id}" ${canDeliver ? '' : 'disabled'}>납품</button><button data-quest-complete="${q.id}" ${q.ready ? '' : 'disabled'}>퀘스트 완료</button>`
        : `<button data-quest-accept="${q.id}">퀘스트 수락</button><button data-quest-reject="${q.id}">거절</button>`;
      html += `<div class="di-quest" style="border-left-color:${q.color}">` +
        `<div class="di-quest-org" style="color:${q.color}">${q.org}</div>` +
        `<div class="di-quest-req">${deviceInfoItemIcon(q.item)}<span>${(FILTER_LABEL[q.item] || q.item)} ×${q.n}${statTxt}</span>${prog}</div>` +
        `<div class="di-quest-reward">보상 ${q.rewardText}</div>` +
        `<div class="di-actions">${btn}</div></div>`;
    }
    const e = endingState();
    if (e.offered) {
      const pct = Math.min(100, Math.floor(endingProgress() * 100));
      const status = !e.accepted
        ? '<button data-ending-accept="1">특별 의뢰 수락</button>'
        : `<b class="${e.stage >= 2 ? 'q-ok' : 'q-no'}">${pct}%</b>`;
      html += `<div class="di-quest ending-quest" style="border-left-color:#ffcf55">
        <div class="di-quest-org" style="color:#ffcf55">44방공호 · 특별 의뢰</div>
        <div class="di-quest-req"><span>탈출선 발사 준비</span></div>
        <div class="di-desc-sub">철조각 ${endingNeed().scrap.toLocaleString()} · 상품 ${endingNeed().products.toLocaleString()} · 초고농축 운치 ${endingNeed().concentrate.toLocaleString()} · 전자부품 ${endingNeed().electronics.toLocaleString()}</div>
        <div class="di-actions">${status}</div></div>`;
    }
    return html;
  }
  function colonyTierCost(tier) {
    if (tier === 1) return { money: 10000, scrap: 0 };
    if (tier === 2) return { money: 50000, scrap: 100 };
    if (tier === 3) return { money: 200000, scrap: 1000, electronics: 5 };
    if (tier === 4) return { money: 1000000, scrap: 10000, electronics: 25 };
    return { money: 0, scrap: 0 };
  }
  // 티어 승급 소요시간(초): 목표 티어 × 설정값 (T1=1분 ... T4=4분)
  function colonyUpgradeDuration(tier) { return Math.max(1, tier) * (C.COLONY_UPGRADE_SEC_PER_TIER || 60); }
  // 승급 잠금 사유(없으면 ''). 티어 1은 연구소+도축기 건설 필요.
  function colonyTierLockReason(tier) {
    if (tier === 1) {
      const hasLab = S.buildings.some(b => b.type === 'lab');
      const hasSlaughter = S.buildings.some(b => b.type === 'slaughter');
      if (!hasLab || !hasSlaughter) return '연구소/도축기 필요';
    }
    if (tier === 4 && !S.buildings.some(b => b.type === 'chaoscharge')) return '카오스 발전소 필요';
    return '';
  }
  function fmtMMSS(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }
  function focusColonyCenter() {
    const c = S.buildings.find(b => b.type === 'colony');
    if (c) { const ctr = buildingCenter(c); focusCameraOnGrid(ctr.gx, ctr.gy); }
  }
  function refreshColonyPanelIfOpen() {
    if (!deviceInfoEl || deviceInfoEl.style.display === 'none') return;
    if (!deviceInfoBuilding || deviceInfoBuilding.type !== 'colony') return;
    showDeviceInfoForBuilding(deviceInfoBuilding, deviceInfoAnchor ? deviceInfoAnchor.x : 0, deviceInfoAnchor ? deviceInfoAnchor.y : 0);
  }
  function upgradeColonyTier() {
    if (G.UI && G.UI.isBasicTutorialActive && G.UI.isBasicTutorialActive()) {
      G.UI.flash && G.UI.flash('기초 튜토리얼 중에는 콜로니 티어를 올릴 수 없습니다.');
      return false;
    }
    if (S.colonyUpgrade) { G.UI.flash && G.UI.flash('이미 승급이 진행 중입니다.'); return false; }
    const next = (S.colonyTier || 0) + 1;
    if (next > 4) { G.UI.flash && G.UI.flash('콜로니 센터 티어 MAX'); return false; }
    const lock = colonyTierLockReason(next);
    if (lock) { G.UI.flash && G.UI.flash('승급 잠김: ' + lock); return false; }
    const cost = colonyTierCost(next);
    if (S.money < cost.money) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.money.toLocaleString() + ')'); return false; }
    if (cost.scrap && warehouseCount('철조각') < cost.scrap) { G.UI.flash && G.UI.flash('철조각 부족! (' + cost.scrap.toLocaleString() + '개 필요)'); return false; }
    if (cost.electronics && warehouseCount('전자부품') < cost.electronics) { G.UI.flash && G.UI.flash('전자부품 부족! (' + cost.electronics.toLocaleString() + '개 필요)'); return false; }
    snapshot();
    S.money -= cost.money;
    if (cost.scrap) takeWarehouse('철조각', cost.scrap);
    if (cost.electronics) takeWarehouse('전자부품', cost.electronics);
    const dur = colonyUpgradeDuration(next);
    S.colonyUpgrade = { target: next, remain: dur, total: dur };
    G.Assets.playSfx('place');
    G.UI.flash && G.UI.flash('콜로니 센터 티어 ' + next + ' 승급 시작 (' + Math.round(dur / 60) + '분 소요)');
    return true;
  }
  // 티어 승급 타이머 진행 → 완료 시 티어 적용 + 카메라를 콜로니 센터로 이동
  function updateColonyUpgrade(dt) {
    const up = S.colonyUpgrade;
    if (!up) return;
    up.remain -= dt;
    if (up.remain <= 0) {
      const target = up.target;
      S.colonyUpgrade = null;
      S.colonyTier = target;
      G.Assets.playSfx('upgrade');
      G.UI.flash && G.UI.flash('🏛 콜로니 센터 티어 ' + target + ' 승급 완료!');
      if (G.UI && G.UI.notify) G.UI.notify('콜로니 센터 티어 ' + target + ' 승급 완료!', '새로운 연구·시설·의뢰가 열렸습니다.');
      if (target === 1) triggerIntro();   // T1 달성 → 세계관 인트로 + 첫 퀘스트
      else if (target === 2 && G.UI && G.UI.midoriRadio) G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.colonyTier2Midori) || [], { emotion: 'laziness' });
      else if (target === 3 && G.UI && G.UI.midoriRadio) G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.colonyTier3Midori) || [], { emotion: 'laziness' });
      else if (target === 4) beginTier4Ending();
      focusColonyCenter();
      refreshColonyPanelIfOpen();
      return;
    }
    const sec = Math.ceil(up.remain);
    if (sec !== up._lastSec) { up._lastSec = sec; refreshColonyPanelIfOpen(); }   // 초가 바뀔 때만 패널 갱신
  }
  function endingState() {
    if (!S.ending || typeof S.ending !== 'object') S.ending = {
      stage: -1, offered: false, accepted: false, gridKey: null, launchpadId: null,
      eventTimer: 0, event: '', scrap: 0, products: 0, concentrate: 0, electronics: 0, charge: 0,
      halfShown: false, raidCount: 0, choiceShown: false,
    };
    return S.ending;
  }
  function endingLaunchpad() {
    const e = endingState();
    return S.buildings.find(b => b.id === e.launchpadId || b.type === 'launchpad') || null;
  }
  function endingProgress() {
    const e = endingState();
    return ((e.scrap || 0) / endingNeed().scrap + (e.products || 0) / endingNeed().products +
      (e.concentrate || 0) / endingNeed().concentrate + (e.electronics || 0) / endingNeed().electronics) / 4;
  }
  function beginTier4Ending() {
    const e = endingState();
    if (e.stage >= 0) return;
    e.stage = 0; e.event = ''; e.eventTimer = 0;
    focusColonyCenter();
    if (G.UI && G.UI.midoriRadio) {
      G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.colonyTier4Midori) || [], {
        emotion: 'normal',
        onComplete: () => { const cur = endingState(); cur.event = 'vaultOffer'; cur.eventTimer = 30; },
      });
    } else { e.event = 'vaultOffer'; e.eventTimer = 30; }
  }
  function endingCandidateGrid() {
    const owned = Object.assign({}, startLandKeys(), S.ownedLand || {});
    const seen = new Set(Object.keys(owned).filter(k => owned[k]));
    let frontier = Array.from(seen);
    for (let ring = 1; ring <= 8; ring++) {
      const candidates = [];
      const next = [];
      for (const key of frontier) {
        const p = parseLandKey(key);
        for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nk = (p.gx + d[0]) + '|' + (p.gy + d[1]);
          if (seen.has(nk)) continue;
          seen.add(nk); next.push(nk);
          if (landKeyInWorld(nk) && !isOwnedLandKey(nk)) candidates.push(nk);
        }
      }
      if (candidates.length) {
        candidates.sort((a, b) => landDistance(a) - landDistance(b) || landHash(a + ':ending') - landHash(b + ':ending'));
        return candidates[0];
      }
      frontier = next;
    }
    return null;
  }
  function createEndingLaunchpad() {
    const e = endingState();
    let pad = endingLaunchpad();
    if (pad) return pad;
    const key = e.gridKey || endingCandidateGrid();
    if (!key) { G.UI.flash && G.UI.flash('발사대를 배치할 미소유 그리드를 찾지 못했습니다.'); return null; }
    const p = parseLandKey(key), n = C.LAND_GRID_SIZE || 48;
    const col = p.gx * n + Math.floor((n - 5) / 2), row = p.gy * n + Math.floor((n - 5) / 2);
    e.gridKey = key;
    if (!S.landEnvironmentOverrides) S.landEnvironmentOverrides = {};
    S.landEnvironmentOverrides[key] = 'redzone';
    S.ruins = (S.ruins || []).filter(r => r.col + r.w <= col || r.col >= col + 5 || r.row + r.h <= row || r.row >= row + 5);
    pad = {
      id: G.uid(), type: 'launchpad', col, row, w: 5, h: 5, dir: 0, cost: 0,
      fixedEnvironment: true, environmentGridKey: key, state: 'idle',
    };
    S.buildings.push(pad); e.launchpadId = pad.id;
    rebuildGrids(); rebuildFrameCaches();
    return pad;
  }
  function showEndingVaultOffer() {
    const e = endingState(), pad = createEndingLaunchpad();
    if (!pad) return;
    e.offered = true; e.event = ''; e.eventTimer = 0;
    focusColonyCenter();
    window.setTimeout(() => focusCameraOnGrid(pad.col + pad.w / 2, pad.row + pad.h / 2), 350);
    G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingVaultOffer) || [], {
      name: '44방공호', midori: false, orgKey: 'vault44',
      onComplete: () => { const cur = endingState(); cur.event = 'midoriWarning'; cur.eventTimer = 3; },
    });
    refreshColonyPanelIfOpen();
  }
  function showEndingMidoriWarning() {
    const e = endingState(); e.event = ''; e.eventTimer = 0;
    G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingMidoriWarning) || [], { emotion: 'sad' });
  }
  function acceptEndingQuest(skipDialogue) {
    const e = endingState();
    if (!e.offered || e.accepted) return;
    const apply = () => {
      const cur = endingState();
      cur.accepted = true; cur.stage = 1; cur.raidCount = 0;
      cur.siegeSpawnT = 0;
      S.ownedLand[cur.gridKey] = true;
      S.landBought = (S.landBought || 0) + 1;
      S.environmentResidentsSeeded[cur.gridKey] = false;
      S.ambientInvaderTimers[cur.gridKey] = 5;
      S.playTime = Math.max(S.playTime || 0, raidStartTime());
      scheduleNextRaid(300);
      ensureEnvironmentFeatures(); generateRuinsNearOwned();
      endingBgmStage = 'climax';
      if (G.Assets && G.Assets.setBgmPlaylist) G.Assets.setBgmPlaylist(G.BGM_CLIMAX || []);
      if (!skipDialogue && G.UI && G.UI.midoriRadio) G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingAcceptedMidori) || [], { emotion: 'normal' });
      refreshColonyPanelIfOpen();
    };
    if (skipDialogue) apply();
    else if (G.UI && G.UI.showEndingConfirm) G.UI.showEndingConfirm(apply);
  }
  function completeEndingMaterials(skipDialogue) {
    const e = endingState();
    if (e.stage !== 1) return;
    e.stage = 2;
    e.siegeTime = 0;
    e.siegeSpawnT = 0;
    S.raidIn = 0; S.raidWarned = false; S.raidSpawnQueue = null; S.raidSpawnT = 0;
    const pad = endingLaunchpad();
    if (pad) { pad.state = 'ready'; focusCameraOnGrid(pad.col + pad.w / 2, pad.row + pad.h / 2); }
    G.Assets.playSfx('upgrade');
    endingBgmStage = 'exit';
    if (G.Assets.setBgmMode) G.Assets.setBgmMode(G.BGM_EXIT);
    if (!skipDialogue) {
      G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingReadyVault) || [], {
        name: '44방공호', midori: false, orgKey: 'vault44',
        onComplete: () => G.UI.midoriRadio(['마지막이에요! 전력을 최대한 발사대쪽으로 돌리죠!'], { emotion: 'amaze' }),
      });
    }
    refreshColonyPanelIfOpen();
  }
  function finishEndingCharge() {
    const e = endingState();
    if (e.stage !== 2) return;
    e.stage = 3; e.charge = endingNeed().charge;
    e.finalPromptShown = true;
    e.choiceModalShown = false;
    if (G.UI && G.UI.resumeSimulation) G.UI.resumeSimulation();
    else { G.paused = false; G.dialogPaused = false; G.openingPaused = false; }
    const pad = endingLaunchpad(); if (pad) pad.state = 'charged';
    for (const w of S.wanderers) {
      if (!w.endingRaid || w._dead) continue;
      w.endingCinematic = true; w.raidT = 1e9; w.ate = 0; w._tgt = null;
      const a = Math.random() * Math.PI * 2, radius = 3.5 + Math.random() * 5;
      if (pad) w.goal = { x: pad.col + pad.w / 2 + Math.cos(a) * radius, y: pad.row + pad.h / 2 + Math.sin(a) * radius };
    }
    G.Assets.playSfx('upgrade');
    spawnEndingCrowd();
    showEndingFinalPrompt();
  }
  function showEndingFinalPrompt() {
    G.UI.midoriRadio(['좋아! 이제 탑승할 준비가 됐다. 공장장.'], {
      name: '44방공호', midori: false, orgKey: 'vault44',
      onComplete: () => G.UI.midoriRadio([{ text: '...이제 가는거야, 공장장?', emotion: 'sad' }], {
        emotion: 'sad',
        onComplete: () => {
          if (G.Assets.setBgmVolumeMultiplier) G.Assets.setBgmVolumeMultiplier(0.5);
          openEndingChoice();
        },
      }),
    });
  }
  function openEndingChoice() {
    const e = endingState();
    e.choiceShown = true;
    e.choiceModalShown = false;
    const saved = !G.Save || !G.Save.saveEndingCheckpoint || G.Save.saveEndingCheckpoint();
    if (!saved) {
      G.UI.flash && G.UI.flash('엔딩 선택지 자동저장에 실패했습니다. 저장 공간을 확인해주세요.');
      return;
    }
    e.choiceModalShown = true;
    if (G.UI.showEndingChoice) G.UI.showEndingChoice(chooseEnding);
  }
  function spawnEndingCrowd() {
    const pad = endingLaunchpad(); if (!pad) return;
    const e = endingState();
    const alive = S.wanderers.filter(w => w.endingCinematic && !w._dead).length;
    for (let i = alive; i < 50; i++) {
      const a = Math.random() * Math.PI * 2, radius = 6 + Math.random() * 12;
      const data = makeInvaderAdult(Math.min(5, 2 + Math.floor(i / 20)));
      spawnIntruder(data, pad.col + pad.w / 2 + Math.cos(a) * radius, pad.row + pad.h / 2 + Math.sin(a) * radius, {
        wild: false, raider: true, invade: true, formalRaid: true, endingRaid: true, endingCinematic: true,
        invadeLvl: 5, home: { x: pad.col, y: pad.row }, raidT: 1e9, ate: 0,
        goal: { x: pad.col + pad.w / 2, y: pad.row + pad.h / 2 }, allowOwnedSpawn: true,
      });
    }
    e.crowdSpawned = true;
  }
  function spawnEndingSiegeInvader() {
    const e = endingState(), pad = endingLaunchpad();
    const cap = e.stage >= 2 ? 100 : 10;
    if (!pad || S.wanderers.filter(w => w.endingRaid && !w._dead).length >= cap) return;
    const p = e.stage >= 2 ? endingRedzoneSpawnPoint() : raidSpawnPoint();
    const lvl = Math.min(5, 2 + Math.floor((e.siegeTime || 0) / 120));
    const data = makeInvaderAdult(lvl);
    data.hpScale = 1 + (e.raidCount || 0) * 0.5 + (e.siegeTime || 0) / 60 + (e.stage >= 2 ? 2 : 0);
    G.Creatures.ensureVitals(data);
    data.hp = G.Creatures.hpMaxOf(data);
    spawnIntruder(data, p.x, p.y, {
      wild: false, raider: true, invade: true, formalRaid: true, endingRaid: true, invadeLvl: lvl,
      home: { x: p.x, y: p.y }, raidT: 1e9, ate: 0,
      goal: { x: pad.col + pad.w / 2, y: pad.row + pad.h / 2 }, allowOwnedSpawn: true,
    });
  }
  function endingRedzoneSpawnPoint() {
    const e = endingState(), key = e.gridKey;
    if (!key) return raidSpawnPoint();
    const p = parseLandKey(key), n = C.LAND_GRID_SIZE || 48;
    const side = Math.floor(Math.random() * 4), inset = 1.5;
    let x, y;
    if (side === 0) { x = p.gx * n + inset + Math.random() * (n - inset * 2); y = p.gy * n + inset; }
    else if (side === 1) { x = (p.gx + 1) * n - inset; y = p.gy * n + inset + Math.random() * (n - inset * 2); }
    else if (side === 2) { x = p.gx * n + inset + Math.random() * (n - inset * 2); y = (p.gy + 1) * n - inset; }
    else { x = p.gx * n + inset; y = p.gy * n + inset + Math.random() * (n - inset * 2); }
    return { x: clamp(x, 0.5, COLS - 0.5), y: clamp(y, 0.5, ROWS - 0.5), side };
  }
  function updateEnding(dt) {
    const e = endingState();
    endingNearbyBeltCargo = [];
    if (e.accepted && e.stage >= 1 && e.stage <= 2) {
      const pad = endingLaunchpad();
      if (pad) {
        const area = { c0: pad.col - 8, r0: pad.row - 8, c1: pad.col + pad.w + 8, r1: pad.row + pad.h + 8 };
        endingNearbyBeltCargo = S.cargo.filter(cg =>
          !cg._dead && isBeltLike(Math.floor(cg.gx), Math.floor(cg.gy)) && distToRect(cg.gx, cg.gy, area) <= 0
        );
      }
    }
    if ((S.colonyTier || 0) >= 4 && e.stage < 0) { beginTier4Ending(); return; }
    if (e.stage === 0 && !e.offered && !e.event && !G.dialogPaused) { e.event = 'vaultOffer'; e.eventTimer = 1; }
    if (e.stage === 3 && !e.finalPromptShown) { e.finalPromptShown = true; showEndingFinalPrompt(); return; }
    if (e.stage === 3 && e.choiceShown && !e.choice && !e.choiceModalShown) {
      if (G.Assets.setBgmVolumeMultiplier) G.Assets.setBgmVolumeMultiplier(0.5);
      openEndingChoice();
      return;
    }
    if (e.event && e.eventTimer > 0) {
      e.eventTimer -= dt;
      if (e.eventTimer <= 0) {
        const ev = e.event; e.event = '';
        if (ev === 'vaultOffer') showEndingVaultOffer();
        else if (ev === 'midoriWarning') showEndingMidoriWarning();
        else if (ev === 'stayVault') G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingChoice2Vault) || [], {
          name: '44방공호', midori: false, orgKey: 'vault44',
          onComplete: () => G.UI.runEndingCinematic && G.UI.runEndingCinematic('stay'),
        });
      }
    }
    if (e.stage === 1) {
      e.siegeTime = (e.siegeTime || 0) + dt;
      e.siegeSpawnT = (e.siegeSpawnT || 0) - dt;
      if (e.siegeSpawnT <= 0) {
        e.siegeSpawnT = 10;
        spawnEndingSiegeInvader();
      }
      if (!e.halfShown && endingProgress() >= 0.5) {
        e.halfShown = true;
        G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingHalfVault) || [], { name: '44방공호', midori: false, orgKey: 'vault44' });
      }
      if (e.scrap >= endingNeed().scrap && e.products >= endingNeed().products &&
          e.concentrate >= endingNeed().concentrate && (e.electronics || 0) >= endingNeed().electronics) completeEndingMaterials();
    } else if (e.stage === 2) {
      e.siegeTime = (e.siegeTime || 0) + dt;
      e.siegeSpawnT = (e.siegeSpawnT || 0) - dt;
      if (e.siegeSpawnT <= 0) {
        e.siegeSpawnT = Math.max(2, 4 - e.siegeTime / 300);
        spawnEndingSiegeInvader();
      }
      const hostiles = S.wanderers.filter(w => !w._dead && (w.invade || w.raider));
      if (hostiles.length > 100) {
        const excess = new Set(hostiles.slice(100));
        S.wanderers = S.wanderers.filter(w => !excess.has(w));
      }
      const draw = Math.max(0, e.chargePower || 0);
      if (draw > 0) e.charge = Math.min(endingNeed().charge, (e.charge || 0) + draw * dt);
      if (e.charge >= endingNeed().charge && e.scrap >= endingNeed().scrap) finishEndingCharge();
    }
  }
  function endingCheat(stage) {
    const e = endingState();
    if (stage >= 0) {
      S.colonyTier = Math.max(4, S.colonyTier || 0);
      if (e.stage < 0) beginTier4Ending();
    }
    if (stage >= 1) {
      if (!endingLaunchpad()) createEndingLaunchpad();
      e.offered = true;
      if (!e.accepted) acceptEndingQuest(true);
      e.scrap = endingNeed().scrap; e.products = endingNeed().products; e.concentrate = endingNeed().concentrate; e.electronics = endingNeed().electronics;
      if (e.stage === 1) completeEndingMaterials(stage >= 2);
    }
    if (stage >= 2) {
      if (e.stage < 2) completeEndingMaterials();
      e.charge = endingNeed().charge;
      if (e.stage === 2) finishEndingCharge();
    }
    G.UI.flash && G.UI.flash('엔딩 ' + stage + '단계 치트 적용');
  }
  function chooseEnding(choice) {
    const e = endingState();
    e.choice = choice;
    e.choiceShown = true;
    e.choiceModalShown = false;
    if (G.Assets.setBgmVolumeMultiplier) G.Assets.setBgmVolumeMultiplier(1);
    if (choice === 1) {
      G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingChoice1Midori) || [], {
        emotion: 'normal', onComplete: () => G.UI.runEndingCinematic && G.UI.runEndingCinematic('alone'),
      });
      return;
    }
    if (choice === 2) {
      G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingChoice2Midori) || [], {
        emotion: 'mad',
        onComplete: () => {
          e.event = 'stayVault'; e.eventTimer = 1;
        },
      });
      return;
    }
    G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingChoice3MidoriBefore) || [], {
      emotion: 'amaze',
      onComplete: () => G.UI.showEndingSubChoice && G.UI.showEndingSubChoice(() => {
        G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingChoice3MidoriAfter) || [], {
          emotion: 'shy',
          onComplete: () => G.UI.midoriRadio(['잠깐, 공장장! 지금 뭐하는거야!'], {
            name: '44방공호', midori: false, orgKey: 'vault44',
            onComplete: () => G.UI.runEndingCinematic && G.UI.runEndingCinematic('together'),
          }),
        });
      }),
    });
  }
  function endingCinematicShot(index, destroyPen) {
    const gridCounts = {};
    for (const b of S.buildings) {
      if (b.type === 'launchpad') continue;
      const key = landKeyForCell(b.col + b.w / 2, b.row + b.h / 2);
      gridCounts[key] = (gridCounts[key] || 0) + 1;
    }
    const grids = Object.keys(gridCounts).sort((a, b) => gridCounts[b] - gridCounts[a]);
    const pens = frameCache.pens.slice().sort((a, b) => (b.creatures || []).length - (a.creatures || []).length);
    let target = null;
    if (destroyPen && pens.length) {
      target = pens[index % pens.length];
      const creatures = (target.creatures || []).slice();
      target.creatures = [];
      creatures.forEach((data, i) => spawnWanderer(data, target.col + target.w / 2 + (i % 5 - 2) * 0.35, target.row + target.h / 2 + (Math.floor(i / 5) % 5 - 2) * 0.35, 1));
      destroyBuildingNoRefund(target);
    } else if (index % 2 && pens.length) target = pens[index % pens.length];
    else if (grids.length) {
      const p = parseLandKey(grids[index % grids.length]), n = C.LAND_GRID_SIZE || 48;
      focusCameraOnGrid(p.gx * n + n / 2, p.gy * n + n / 2);
      return;
    }
    if (target) focusCameraOnGrid(target.col + target.w / 2, target.row + target.h / 2);
  }
  function endingCountdownFinale() {
    const pad = endingLaunchpad();
    if (!pad) return;
    focusCameraOnGrid(pad.col + pad.w / 2, pad.row + pad.h / 2);
    const seen = new Set();
    const addExplosion = (gx, gy, scale) => {
      const key = Math.floor(gx * 2) + '|' + Math.floor(gy * 2);
      if (seen.has(key)) return;
      seen.add(key);
      spawnExplosionEffect(gx, gy, scale || 0.45);
    };
    for (const w of S.wanderers) if (!w._dead && w.data && G.CREATURES[w.data.type]) addExplosion(w.gx, w.gy, 0.45);
    for (const pen of frameCache.pens) {
      for (const c of (pen.creatures || [])) addExplosion(pen.col + (c.px || 0.5), pen.row + (c.py || 0.5), 0.4);
    }
    for (const cg of S.cargo) {
      if (!cg._dead && cg.data && G.CREATURES[cg.data.type]) addExplosion(cg.gx, cg.gy, 0.4);
    }
    playWorldSfx('explosion', pad.col + pad.w / 2, pad.row + pad.h / 2, { force: true, volume: 0.9 });
    G.paused = true;
    G.dialogPaused = false;
    G.openingPaused = false;
  }
  function endingCinematicTick(dt) {
    updateExplosionEffects(dt);
    updateParticles(dt);
  }
  function endingLaunchStart() {
    const e = endingState(), pad = endingLaunchpad();
    if (!pad) return;
    pad.rocketPhase = 'launch';
    focusCameraOnGrid(pad.col + pad.w / 2, pad.row + pad.h / 2);
    const radius = 48;
    for (const w of S.wanderers) {
      if (Math.hypot(w.gx - (pad.col + 2.5), w.gy - (pad.row + 2.5)) > radius) continue;
      w._dead = true; burstAt(w.gx, w.gy);
    }
    S.wanderers = S.wanderers.filter(w => !w._dead);
    for (const pen of frameCache.pens) {
      const cx = pen.col + pen.w / 2, cy = pen.row + pen.h / 2;
      if (Math.hypot(cx - (pad.col + 2.5), cy - (pad.row + 2.5)) <= radius) {
        for (const c of pen.creatures || []) burstAt(cx, cy);
        pen.creatures = [];
      }
    }
    for (const cg of S.cargo) {
      if (!G.CREATURES[cg.data && cg.data.type]) continue;
      if (Math.hypot(cg.gx - (pad.col + 2.5), cg.gy - (pad.row + 2.5)) <= radius) {
        cg._dead = true; burstAt(cg.gx, cg.gy);
      }
    }
    S.cargo = S.cargo.filter(cg => !cg._dead);
  }
  function endingLaunchFrame(progress) {
    const pad = endingLaunchpad(); if (!pad) return;
    const p = clamp(progress || 0, 0, 1);
    cam.zoom = clamp(1 - p * 0.94, C.ZOOM_MIN, 1);
    focusCameraOnGrid(pad.col + pad.w / 2 + (Math.random() - 0.5) * p, pad.row + pad.h / 2 + (Math.random() - 0.5) * p);
  }
  function finishStayEnding() {
    const e = endingState(), pad = endingLaunchpad();
    if (pad) destroyBuildingNoRefund(pad);
    for (const w of S.wanderers) {
      if (w.endingRaid || w.endingCinematic) w._dead = true;
      else { w.endingRaid = false; w.endingCinematic = false; }
    }
    S.wanderers = S.wanderers.filter(w => !w._dead);
    e.stage = 4; e.accepted = false; e.infinite = true; e.launchpadId = null;
    if (S.landEnvironmentOverrides && e.gridKey) delete S.landEnvironmentOverrides[e.gridKey];
    if (S.ambientInvaderTimers && e.gridKey) delete S.ambientInvaderTimers[e.gridKey];
    if (S.environmentResidentsSeeded && e.gridKey) delete S.environmentResidentsSeeded[e.gridKey];
    S.raidSpawnQueue = null; S.raidWarned = false; S.raidIn = 600;
    G.paused = false; G.dialogPaused = false; G.openingPaused = false;
    if (G.Assets.setAudioMuted) G.Assets.setAudioMuted(false);
    if (G.Assets.setBgmVolumeMultiplier) G.Assets.setBgmVolumeMultiplier(1);
    if (G.Assets.setBgmMode) G.Assets.setBgmMode(G.BGM_END_STAY);
    if (G.Save && G.Save.unlockEndingSaves) G.Save.unlockEndingSaves();
    if (G.Save) G.Save.save();
    window.setTimeout(() => G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.endingStayVaultAfter) || [], {
      name: '44방공호', midori: false, orgKey: 'vault44',
    }), 10000);
  }
  function itemLabel(data) { return data ? (FILTER_LABEL[data.type] || (G.CREATURES[data.type] && G.CREATURES[data.type].label) || data.type) : '없음'; }
  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
  function deviceInfoItemIcon(type) {
    if (G.PRODUCTS[type] && G.PRODUCTS[type].img) return `<span class="di-item-icon" style="background-image:url('assets/images/products/${escAttr(G.PRODUCTS[type].img)}')"></span>`;
    if (G.CREATURES[type] && G.CREATURES[type].img) return `<span class="di-item-icon creature-ui-icon" style="background-image:url('assets/images/creatures/${escAttr(G.CREATURES[type].img)}');background-size:400% 400%;background-position:0 0"></span>`;
    const color = (G.PRODUCTS[type] && G.PRODUCTS[type].color) || (G.CREATURES[type] && G.CREATURES[type].color) || '#888';
    return `<span class="di-item-icon" style="background:${color}"></span>`;
  }
  function warehouseInventoryHtml() {
    const keys = Object.keys(S.warehouse || {}).filter(k => S.warehouse[k] && S.warehouse[k].length).sort((a, b) => a.localeCompare(b, 'ko'));
    if (!keys.length) return '<div class="di-inv-empty">재고 없음</div>';
    return '<div class="di-inv-grid">' + keys.map(k => `<div class="di-inv-item">${deviceInfoItemIcon(k)}<span>${FILTER_LABEL[k] || k}</span><b>${S.warehouse[k].length.toLocaleString()}</b></div>`).join('') + '</div>';
  }
  function listText(list) { return list && list.length ? list.join(', ') : '없음'; }
  function deviceCargoCount(b) { return b && b.outBuffer ? b.outBuffer.length : 0; }
  function progressText(n, total) {
    if (!total) return '대기';
    return Math.floor(clamp(n || 0, 0, total) / total * 100) + '%';
  }
  function deviceTypeDetails(type) {
    const def = G.DEVICES[type]; if (!def) return '';
    if (type === 'belt' || type === 'guardbelt') return infoRows([['기능', '화물 운반'], ['출력', '방향 화살표']]);
    if (type === 'sorter') return infoRows([['기능', '필터 조건에 따라 2칸 분류'], ['필터 없음', '1번/2번 교대 출력']]);
    if (isGrabberType(type)) return infoRows([['기능', '□에서 집어 △에 놓음'], ['필터', '품목/스탯 조건']]);
    if (type === 'warehouse' || type === 'largewarehouse') return infoRows([['기능', type === 'largewarehouse' ? '대량 비축·한 면 4칸 출력' : '화물 저장'], ['비축 용량', (G.DEVICES[type].storage || 0).toLocaleString()], ['판매', '거래창에서 판매']]);
    if (type === 'driller') return infoRows([['기능', '주변 폐허 자동 채취'], ['범위', '건물 중심 17×17'], ['지정', '선택 후 대상 우클릭'], ['적재', '최대 100개, 집게로 회수']]);
    if (type === 'penbox') return infoRows([['기능', '실장석 사육'], ['수용', `1칸당 성체${C.PEN_ADULT_PER_CELL}/새끼${C.PEN_YOUNG_PER_CELL}`]]);
    if (type === 'birthing') return infoRows([['필요', '성체 실장석'], ['산출', '점액덩어리']]);
    if (type === 'reformer') return infoRows([['필요', '독라 성체'], ['산출', '노동석 (회수/방어/대기 명령)'], ['최대', `${S.wanderers.filter(w => w.data && w.data.labor).length}/${laborLimit()}`], ['특징', '벨트·포획기에 안 잡힘, 도축 가능']]);
    if (type === 'washbasin') return infoRows([['필요', '점액덩어리'], ['산출', '구더기/엄지/자실장']]);
    if (type === 'slaughter') return infoRows([['필요', '독라(실장육+위석) / 구더기·엄지·자실장·성체실장(위석)'], ['산출', '실장육 + 소/중/대형 위석']]);
    if (type === 'deshell') return infoRows([['필요', '실장석/사육실장 계열'], ['산출', '독라 계열']]);
    if (type === 'grinder') return infoRows([['필요', '실장석류/실장육/위석'], ['산출', '분쇄육 · 위석→조미료']]);
    if (type === 'correction') return infoRows([['필요', '자실장/성체실장'], ['산출', '사육실장 계열 또는 실장육']]);
    if (type === 'mixer') return infoRows([['필요', `분쇄육1+운치${C.MIX_UNCHI} / 짓소산1+실장푸드${C.MIX_FOOD_NEED || 50}`], ['산출', `실장푸드${C.MIX_FOOD} / 짓소산 푸드50`]]);
    if (type === 'cookery') return infoRows([['필요', '재료 + 조미료'], ['산출', '요리 생산품']]);
    if (type === 'acidgen') return infoRows([['필요', '성체실장'], ['산출', '2초마다 짓소산, 10초 후 분쇄육'], ['적체', '최대 10개']]);
    if (type === 'tunnel' || type === 'crossbelt' || type === 'chaosgate') return infoRows([['기능', '입구에서 출구로 순간이동'], ['중간', '건설 가능']]);
    if (type === 'packer') return infoRows([['필요', '분쇄육/실장육 + 철조각'], ['산출', '통조림 / 진공포장']]);
    if (type === 'salecenter') return infoRows([['기능', '판매 가능 물자 즉시 판매'], ['업그레이드', '판매가 +10%/레벨']]);
    if (type === 'turret') return infoRows([['기능', '사거리 안 대상 자동 사격'], ['전리품', '실장육'], ['업그레이드', '설치 후 클릭']]);
    if (type === 'sniper') return infoRows([['기능', '장거리 자동 사격(데미지2배·사거리3배·발사3배 느림)'], ['전리품', '실장육'], ['업그레이드', '설치 후 클릭']]);
    if (type === 'mine') return infoRows([['기능', '침입자가 밟으면 폭발'], ['피해', `${C.MINE_DMG || 120} / 3타일 원형`], ['주의', '1회용']]);
    if (type === 'mortar') return infoRows([['기능', '장거리 광역 포격'], ['강제 공격', '지면 우클릭으로 시작/중단'], ['일반탄', `${C.MORTAR_DMG || 150} 피해 / 3타일 원형`], ['탄도미사일', '사거리 144 · 피해 480 · 7타일 원형 · 최대 5발']]);
    if (type === 'jisoucharge') return infoRows([['필요', '성체실장 장착'], ['출력', '전력 10'], ['소모', 'HP 0.1/초']]);
    if (type === 'firecharge') return infoRows([['필요', '연료 재료'], ['출력', '전력 150'], ['보급', '자체 ' + (((C.POWER_PLANT_RANGE_BY_TYPE && C.POWER_PLANT_RANGE_BY_TYPE[type]) || C.POWER_PLANT_RANGE || 9)) + '×' + (((C.POWER_PLANT_RANGE_BY_TYPE && C.POWER_PLANT_RANGE_BY_TYPE[type]) || C.POWER_PLANT_RANGE || 9))]]);
    if (type === 'chaoscharge') return infoRows([['연료', '소/중/대형 위석'], ['시동', '성체실장 12마리 장착'], ['출력', '전력 480'], ['보급', '자체 ' + (((C.POWER_PLANT_RANGE_BY_TYPE && C.POWER_PLANT_RANGE_BY_TYPE[type]) || C.POWER_PLANT_RANGE || 9)) + '×' + (((C.POWER_PLANT_RANGE_BY_TYPE && C.POWER_PLANT_RANGE_BY_TYPE[type]) || C.POWER_PLANT_RANGE || 9))]]);
    if (POWER_POLES.has(type)) return infoRows([['기능', '전력망 연결/보급'], ['보급', ((C.POWER_POLE_RANGE && C.POWER_POLE_RANGE[type]) || 9) + '×' + ((C.POWER_POLE_RANGE && C.POWER_POLE_RANGE[type]) || 9)], ['연결', ((C.POWER_POLE_LINK && C.POWER_POLE_LINK[type]) || 0) + '×' + ((C.POWER_POLE_LINK && C.POWER_POLE_LINK[type]) || 0)]]);
    return infoRows([['기능', def.desc || '']]);
  }
  function deviceInfoDetails(b) {
    const def = G.DEVICES[b.type]; if (!def) return '';
    if (b.type === 'penbox') {
      const poll = G.Pens.penPollution ? G.Pens.penPollution(b) : 0;
      const cl = G.Pens.cleanlinessOf ? G.Pens.cleanlinessOf(b) : { label: '-', color: '#fff' };
      return infoRows([
        ['기능', '실장석 사육/성장'],
        ['성체', `${G.Pens.countAdult(b)}/${G.Pens.capAdult(b)}`],
        ['새끼', `${G.Pens.countYoung(b)}/${G.Pens.capYoung(b)}`],
        ['청결도', `<span style="color:${cl.color}">${cl.label} (오염도 ${Math.round(poll)}%)</span>`],
        ['운치', `${Math.floor(b.unchi || 0)} (집게 필터로 추출)`],
        ['판매금지', b.noSell ? '켜짐' : '꺼짐'],
      ]);
    }
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
    if (b.type === 'reformer') return infoRows([
      ['필요', '독라 성체'],
      ['투입물', itemLabel(b.item)],
      ['진행', progressText(b.timer, C.LABOR_REFORM_TIME || 6)],
      ['노동석 수', `${S.wanderers.filter(w => w.data.labor).length}/${laborLimit()}`],
    ]);
    if (b.type === 'slaughter') {
      const tag = b.item && G.CREATURES[b.item.type] && G.CREATURES[b.item.type].tag;
      const meatN = (b.item && tag === '독라') ? Math.floor(((b.item.stats && b.item.stats.크기) || 0) / 10) : 0;
      return infoRows([
        ['필요', '독라계열(실장육) / 구더기·엄지·자실장·성체실장(위석)'],
        ['투입물', itemLabel(b.item)],
        ['만드는 중', b.item ? (tag === '독라' ? `실장육 ${meatN}개 + 위석` : bezoarForType(b.item.type)) : '없음'],
        ['진행', progressText(b.timer, def.time / workerMult(b))],
        ['적체 화물', `${deviceCargoCount(b)}/10`],
      ]);
    }
    if (b.type === 'deshell') return infoRows([
      ['필요', listText(def.accept)],
      ['투입물', itemLabel(b.item)],
      ['만드는 중', b.item ? (def.convert && def.convert[b.item.type] || '변환') : '없음'],
      ['진행', progressText(b.timer, def.time / workerMult(b))],
    ]);
    if (b.type === 'grinder') return infoRows([
      ['필요', '실장석류/실장육/위석'],
      ['투입물', itemLabel(b.item)],
      ['만드는 중', b.item && bezoarSeasoning(b.item.type) > 0 ? `조미료 ${bezoarSeasoning(b.item.type)}개` : ((b.item || (b.weight || 0) >= C.GRIND_TARGET) ? '분쇄육' : '없음')],
      ['축적 무게', `${Math.floor(b.weight || 0)}/${C.GRIND_TARGET}`],
    ]);
    if (b.type === 'correction') return infoRows([
      ['필요', listText(def.accept)],
      ['교사', b.teacher ? '개념 ' + Math.floor((b.teacher.stats && b.teacher.stats.개념) || 0) + '%' : '없음'],
      ['교육 중', `${b.inmates ? b.inmates.length : 0}/${def.hold}`],
      ['산출', '사육실장 계열 / 실장육'],
    ]);
    if (b.type === 'mixer') {
      const recipeA = b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI;
      const recipeB = b.slotAcid && (b.foodN || 0) >= (C.MIX_FOOD_NEED || 50);
      return infoRows([
        ['실장푸드', `분쇄육1 + 운치${C.MIX_UNCHI} → 실장푸드${C.MIX_FOOD}`],
        ['짓소산 푸드', `짓소산1 + 실장푸드${C.MIX_FOOD_NEED || 50} → 짓소산 푸드50`],
        ['분쇄육/운치', `${b.slotMeat ? '✓' : '·'} / ${b.unchiN || 0}/${C.MIX_UNCHI}`],
        ['짓소산/실장푸드', `${b.slotAcid ? '✓' : '·'} / ${b.foodN || 0}/${C.MIX_FOOD_NEED || 50}`],
        ['만드는 중', recipeA ? `실장푸드${C.MIX_FOOD}` : (recipeB ? '짓소산 푸드50' : '없음')],
      ['적체 화물', `${deviceCargoCount(b)}/10`],
      ]);
    }
    if (b.type === 'cookery') return infoRows([
      ['필요', '재료 + 조미료1'],
      ['만드는 중', (b.cooking && def.cook[b.cooking]) ? def.cook[b.cooking].out : '없음'],
      ['재료', b.mats ? Object.keys(b.mats).filter(k => b.mats[k]).map(k => k + ' ' + b.mats[k]).join(', ') || '없음' : '없음'],
      ['조미료', `${Math.floor(b.seasoning || 0)}/${C.SEASONING_MAX || 200}`],
    ]);
    if (b.type === 'mortar') return infoRows([
      ['강제 공격', b.manualTarget ? `진행 중 · 우클릭으로 중단` : '지면 우클릭으로 시작'],
      ['일반 사거리', Math.round(turretRange(Object.assign({}, b, { missileAmmo: 0 }))) + '타일'],
      ['구더기 탄도미사일', `${b.missileAmmo || 0}/5발`],
      ['미사일 사거리', Math.round((C.MAGGOT_MISSILE_RANGE || 144) * (1 + ((S.upgrades && S.upgrades.카오스총신) || 0) * (C.CHAOS_BARREL_RANGE_PER_LV || 0.05))) + '타일'],
      ['미사일 피해', `${C.MAGGOT_MISSILE_DMG || 480} / 7타일 원형`],
    ]);
    if (b.type === 'acidgen') return infoRows([
      ['필요', '성체실장'],
      ['투입물', itemLabel(b.item)],
      ['남은 행복', b.item ? Math.floor(b.item.행복 != null ? b.item.행복 : 0) + '/' + (C.CREATURE_HAPPY_MAX || 100) : '—'],
      ['산출', '행복 5↓당 짓소산1, 행복0→분쇄육'],
      ['적체 화물', `${deviceCargoCount(b)}/10`],
    ]);
    if (b.type === 'feeder') return infoRows([
      ['사료', FEED_LABEL[b.feedType || '실장푸드'] || '실장푸드'],
      ['범위', '5×5'],
      ['상태', b.noFeed ? '사료 없음' : '배급 가능'],
      ...FEED_TYPES.map(t => ['재고 ' + (FEED_LABEL[t] || t), Math.floor(feedResourceAmount(t))]),
      ['배급 효과', (b.feedType || '실장푸드') === '짓소산 푸드'
        ? '성장 2배 + 체력/육질/행복 상승 확률'
        : (b.feedType || '실장푸드') === '운치'
          ? '성장 2배×운치보정 + 육질/개념/행복 하락, 크기 상승 확률'
          : (b.feedType || '실장푸드') === '우마이푸드'
            ? '성장 3배 + 체력/행복 회복'
            : (b.feedType || '실장푸드') === '다이어트푸드'
              ? '체력 회복 + 성장 0.5배'
              : '성장 2배 + 체력 회복'],
    ]);
    if (b.type === 'techica') return infoRows([
      ['장착', itemLabel(b.worker)],
      ['범위', '7×7'],
      ['효과', b.worker ? '행복 +0.5/초 · 육질 +0.1/초 · 주변 유인' : '사육실장 장착 필요'],
      ['배출', b.worker ? Math.max(0, 60 - (b.workT || 0)).toFixed(0) + '초 후 개념 0 배출' : '-'],
    ]);
    if (b.type === 'wrongchaosmargot') return infoRows([
      ['현재 기분', wrongChaosMoodInfo(b).label],
      ['다음 기분 변화', Math.max(0, Math.ceil(b.moodT == null ? 60 : b.moodT)) + '초'],
      ['가챠 먹이', b.gachaFeed ? (FEED_LABEL[b.gachaFeed] || b.gachaFeed) : '미선택'],
      ['남은 클릭', b.gachaRemaining || 0],
    ]);
    if (b.type === 'terrarium') {
      const list = b.incubatorCreatures || [];
      const counts = ['구더기', '엄지', '자실장', '성체실장'].map(type => `${type} ${list.filter(c => c.type === type).length}`).join(' · ');
      const dna = b.dnaStats ? `육질 ${Math.floor(b.dnaStats.육질 || 0)} / 개념 ${Math.floor(b.dnaStats.개념 || 0)} / 크기 ${Math.floor(b.dnaStats.크기 || 0)}` : '원본 실장석 필요';
      return infoRows([
        ['DNA', dna],
        ['내부 개체', `${list.length}/100`],
        ['단계', counts],
        ['내부 운치', Math.floor(b.incubatorUnchi || 0).toLocaleString()],
        ['다음 배양', b.dnaStats ? Math.max(0, Math.ceil((C.BIRTH_INTERVAL || 10) - (b.incubatorBirthT || 0))) + '초' : '-'],
      ]);
    }
    if (b.type === 'lab') {
      const cur = S.currentResearch;
      const need = cur ? (cur.cost || 0) : 0;
      const prog = cur ? Math.min(100, Math.floor(((S.researchProgress || 0) / Math.max(1, need)) * 100)) : 0;
      return infoRows([
        ['장착', (b.workers ? b.workers.length : 0) + '/' + (C.LAB_SLOTS || 8)],
        ['강화', 'Lv.' + (b.labLevel || 0)],
        ['이 연구소 연구력', labResearchPower(b).toFixed(1) + '/초'],
        ['이 연구소 전력', labPowerUse(b).toFixed(1)],
        ['진행', cur ? (Math.floor(S.researchProgress || 0) + '/' + need.toLocaleString() + ' (' + prog + '%)') : '예약 없음'],
        ['연구', cur ? cur.name : '-'],
      ]);
    }
    if (b.type === 'jisoucharge') return infoRows([
      ['상태', b.worker ? '작동중' : '대기'],
      ['출력', b.worker ? Math.round((G.DEVICES[b.type].power || 0) * (environmentEffectsForBuilding(b).powerOutput || 1)) : 0],
      ['장착', itemLabel(b.worker)],
      ['HP', b.worker ? Math.floor(b.worker.hp || 0) + '/' + G.Creatures.hpMaxOf(b.worker) : '-'],
      ['적체 화물', `${deviceCargoCount(b)}/10`],
    ]);
    if (b.type === 'firecharge') return infoRows([
      ['상태', (b.fuelT || 0) > 0 ? '작동중' : '대기'],
      ['출력', (b.fuelT || 0) > 0 ? Math.round((G.DEVICES[b.type].power || 0) * (environmentEffectsForBuilding(b).powerOutput || 1)) : 0],
      ['연료', itemLabel(b.fuel)],
      ['남은 시간', (b.fuelT || 0).toFixed(1) + '초'],
    ]);
    if (b.type === 'chaoscharge') {
      const n = b.chaosVictims ? b.chaosVictims.length : 0;
      const active = isPowerPlantActive(b);
      return infoRows([
        ['상태', active ? '작동중' : (b.chaosStarted ? '시동됨' : (n ? '충전중' : '대기'))],
        ['출력', active ? Math.round((G.DEVICES[b.type].power || 0) * (environmentEffectsForBuilding(b).powerOutput || 1) * (environmentEffectsForBuilding(b).chaosEfficiency || 1) * (1 + ((S.upgrades && S.upgrades.카오스연구) || 0) * 0.1)) : 0],
        ['성체실장', n + '/12'],
        ['연료', itemLabel(b.fuel)],
        ['남은 시간', (b.fuelT || 0).toFixed(1) + '초'],
        ['제물 파괴', b.chaosStarted ? (60 - (b.chaosVictimT || 0)).toFixed(0) + '초마다 10%' : '시동 전'],
      ]);
    }
    if (POWER_POLES.has(b.type)) return infoRows([
      ['상태', b.powered ? '연결됨' : '미연결'],
      ['보급', (Math.round(powerSupplySizeFor(b.type, b.col, b.row, b.w, b.h) * 10) / 10) + '×' + (Math.round(powerSupplySizeFor(b.type, b.col, b.row, b.w, b.h) * 10) / 10)],
    ]);
    if (b.type === 'colony') return infoRows([
      ['기능', '창고(저장·판매)'],
      ['이동', '가능 (M)'], ['철거', '불가'],
    ]);
    if (b.type === 'sorter') return infoRows([
      ['기능', '화물을 2개 레인으로 분류'],
      ['필터', b.filter && b.filter.length ? b.filter.length + '종' : '전체 통과'],
      ['필터 레인', (b.filterLane || 1) + '번'],
      ['버퍼', b.buffer && b.buffer.length ? b.buffer.length + '개' : '없음'],
    ]);
    if (isGrabberType(b.type)) return infoRows([
      ['기능', '□에서 집어 △에 놓음'],
      ['들고 있음', itemLabel(b.holding)],
      ['필터', b.filter && b.filter.length ? b.filter.length + '종' : '전체 통과'],
      ['우선순위', String(b.priority || 3)],
    ]);
    if (b.type === 'warehouse' || b.type === 'largewarehouse') return infoRows([
      ['기능', b.type === 'largewarehouse' ? '대량 비축·한 면 4칸 출력' : '화물 저장'],
      ['비축 용량', (isLocalWarehouse(b) ? warehouseCapacity(b) : (def.storage || 0)).toLocaleString()],
      ['재고 종류', Object.keys(inventoryOf(b)).filter(k => inventoryOf(b)[k] && inventoryOf(b)[k].length).length + '종'],
      b.type === 'largewarehouse' ? ['출력 품목', b.filter && b.filter[0] ? (FILTER_LABEL[b.filter[0]] || b.filter[0]) : '미선택'] : null,
      ['재고 방식', isLocalWarehouse(b) ? '창고별 독립' : '전역 공유'],
    ]) + (isLocalWarehouse(b) ? '' : warehouseInventoryHtml());
    if (b.type === 'driller') return infoRows([
      ['범위', '17×17'],
      ['상태', b.state === 'full' ? '적재 한도 도달' : (b.state === 'producing' ? '채취 중' : (b.state === 'moving' ? '헤드 이동 중' : '대기'))],
      ['내부 화물', deviceCargoCount(b).toLocaleString() + '/100개'],
      ['우선 목표', b.drillPriorityId ? '지정됨' : '자동'],
    ]);
    if (b.type === 'tunnel' || b.type === 'crossbelt' || b.type === 'chaosgate') return infoRows([
      ['기능', '화물 순간이동'],
      ['대기열', b.queue && b.queue.length ? b.queue.length + '개' : '없음'],
      ['출구', '점선 표시 위치'],
    ]);
    if (b.type === 'catcher') return infoRows([
      ['기능', '범위 안 배회 실장석 수거'],
      ['범위 내 대상', catcherTargets(b).length],
      ['필터', b.filter && b.filter.length ? b.filter.length + '종' : '전체 통과'],
      ['출력', '앞쪽 출구'],
    ]);
    if (b.type === 'skewer') return infoRows([
      ['기능', '실장석 고정 후 1분 뒤 파괴'],
      ['장착', itemLabel(b.held)],
      ['남은 시간', b.held ? Math.max(0, Math.ceil(60 - (b.heldT || 0))) + '초' : '없음'],
    ]);
    if (b.type === 'salecenter') return infoRows([
      ['기능', '판매 가능 화물·실장석 즉시 판매'],
      ['판매가 보너스', '+' + ((b.up || 0) * 10) + '% (Lv.' + (b.up || 0) + ')'],
    ]);
    if (b.type === 'packer') return infoRows([
      ['레시피', '분쇄육+철→통조림 / 실장육+철→진공포장'],
      ['철조각', (b.scrapN || 0) + '개'],
      ['분쇄육', ((b.minced && b.minced.length) || 0) + '개'],
      ['실장육', ((b.meat && b.meat.length) || 0) + '개'],
    ]);
    if (isTurretLike(b)) {
      const modeLabel = { raider: '약탈자만', wild: '외부 출신', all: '전부' };
      const rows = [
        ['공격력', turretDmg(b)],
        ['연사', (1 / turretInterval(b)).toFixed(1) + '발/초'],
        ['사거리', turretRange(b).toFixed(1) + '칸'],
        ['목표', modeLabel[b.mode || 'raider']],
        ['처치 수', b.kills || 0],
      ];
      if (isChaosTurret(b)) rows.splice(3, 0, ['체인 대상', Math.min(C.CHAOS_TURRET_CHAIN_MAX || 8, (C.CHAOS_TURRET_CHAIN_BASE || 3) + turretLv(b, 'range')) + '마리']);
      return infoRows(rows);
    }
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
  function colonyCenterPx() {
    const b = S.buildings.find(x => x.type === 'colony') || S.buildings.find(x => x.colony);
    if (b) return { x: (b.col + (b.w || 1) / 2) * CELL, y: (b.row + (b.h || 1) / 2) * CELL };
    return { x: (COLS / 2) * CELL, y: (ROWS / 2) * CELL };
  }
  function focusCameraOn(px, py, zoom) {
    cam.zoom = clamp(zoom, C.ZOOM_MIN, C.ZOOM_MAX);
    cam.x = px - (C.VIEW_W / 2) / cam.zoom;
    cam.y = py - (C.VIEW_H / 2) / cam.zoom;
    clampCamera();
  }
  function playOpeningIntro(force) {
    if (!force && S.openingDone) return;
    if (!canvas) return;
    S.openingDone = true;
    G.openingPaused = true;
    G.dialogPaused = false;
    if (G.Assets && G.Assets.stopBgm) G.Assets.stopBgm();
    if (G.Assets && G.Assets.restartIntroBgm) G.Assets.restartIntroBgm();   // 새 시작 → welcome부터 재생
    const game = document.getElementById('game');
    let ov = document.getElementById('opening-vignette');
    if (!ov) { ov = document.createElement('div'); ov.id = 'opening-vignette'; game.appendChild(ov); }
    ov.style.display = 'block';
    ov.style.opacity = '1';
    const center = colonyCenterPx();
    const farZoom = C.ZOOM_MIN || 0.25;
    const nearZoom = 1;
    focusCameraOn(center.x, center.y, farZoom);
    const started = performance.now();
    const hold = 1000, zoomDur = 4200;
    function smooth(t) { return t * t * (3 - 2 * t); }
    function step(now) {
      const elapsed = now - started;
      if (elapsed < hold) {
        ov.style.opacity = '1';
        focusCameraOn(center.x, center.y, farZoom);
        requestAnimationFrame(step);
        return;
      }
      const p = Math.min(1, (elapsed - hold) / zoomDur);
      const e = smooth(p);
      const z = farZoom + (nearZoom - farZoom) * e;
      focusCameraOn(center.x, center.y, z);
      ov.style.opacity = String(1 - e);
      if (p < 1) requestAnimationFrame(step);
      else {
        ov.style.display = 'none';
        G.openingPaused = false;
        if (G.Assets && G.Assets.startBgm) G.Assets.startBgm({ fadeIn: 4.5 });
        if (G.UI && G.UI.midoriRadio) {
          G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.openingMidori) || ['반가운데스, 사장님. 와타시는 미도리데스.'], { long: true, emotion: 'laziness' });
        }
      }
    }
    requestAnimationFrame(step);
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
  function sfxVolumeAt(gx, gy) {
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return 0;
    if (!canvas) return 0.5;
    const sx = gx * CELL - cam.x, sy = gy * CELL - cam.y;
    const px = sx * cam.zoom, py = sy * cam.zoom;
    if (px < 0 || py < 0 || px > canvas.width || py > canvas.height) return 0;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const d = Math.hypot(px - cx, py - cy);
    const mid = Math.hypot(cx, cy) * 0.5, edge = Math.hypot(cx, cy);
    if (d <= mid) return 0.5 - 0.15 * (d / mid);
    return Math.max(0, 0.35 * (1 - ((d - mid) / Math.max(1, edge - mid))));
  }
  function playWorldSfx(key, gx, gy, opts) {
    const force = opts && opts.force;
    const volume = force ? ((opts && opts.volume != null) ? opts.volume : 0.5) : sfxVolumeAt(gx, gy);
    if ((!Number.isFinite(volume) || volume <= 0) && !force) return;
    G.Assets.playSfx(key, { volume });
  }
  function playDeviceSfx(key, b) {
    if (!b) return;
    playWorldSfx(key, b.col + (b.w || 1) / 2, b.row + (b.h || 1) / 2);
  }
  function spawnPackerCoinBurst(gx, gy, count) {
    const game = document.getElementById('game'); if (!game) return;
    const from = { x: worldToGameX(gx * CELL), y: worldToGameY(gy * CELL) };
    if (from.x < -40 || from.x > C.GAME_W + 40 || from.y < -40 || from.y > C.GAME_H + 40) return;
    const n = Math.max(3, Math.min(10, count || 5));
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'coin-fx';
      game.appendChild(el);
      const dx = (Math.random() - 0.5) * 72;
      const dy = 18 + Math.random() * 34;
      coinEffects.push({
        el, t: 0, dur: 0.55 + Math.random() * 0.25,
        sx: from.x + (Math.random() - 0.5) * 28,
        sy: from.y + (Math.random() - 0.5) * 22,
        tx: from.x + dx,
        ty: from.y + dy,
        arc: 34 + Math.random() * 32,
      });
    }
  }
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
    const b = cameraLandBounds();
    const minX = b.c0 * CELL, minY = b.r0 * CELL;
    const maxX = b.c1 * CELL - C.VIEW_W / cam.zoom, maxY = b.r1 * CELL - C.VIEW_H / cam.zoom;
    cam.x = clamp(cam.x, minX, Math.max(minX, maxX));
    cam.y = clamp(cam.y, minY, Math.max(minY, maxY));
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
    if (b.type === 'penbox') return penAbsCells(b);
    if (b.type === 'tunnel' || b.type === 'crossbelt' || b.type === 'chaosgate') { const e = transportEnds(b); return [e.back, e.front]; }
    return footprint(b.type, b.col, b.row, b.dir).cells;
  }
  function footprintCellsOf(b) {
    if (b.type === 'belt' || b.type === 'guardbelt') return [{ c: b.col, r: b.row }];
    if (isGrabberType(b.type)) { const g = grabberRoles(b); return [g.pickup, g.mid, g.drop]; }
    return deviceCells(b);
  }
  function isGrabberType(type) { return type === 'grabber' || type === 'longgrabber'; }
  function grabberRoles(b) {
    const cells = footprint(b.type || 'grabber', b.col, b.row, b.dir).cells;
    let o;
    if (b.dir === 1) o = cells.slice().sort((a, z) => a.c - z.c);
    else if (b.dir === 3) o = cells.slice().sort((a, z) => z.c - a.c);
    else if (b.dir === 2) o = cells.slice().sort((a, z) => a.r - z.r);
    else o = cells.slice().sort((a, z) => z.r - a.r);
    return { pickup: o[0], mid: o[Math.floor(o.length / 2)], drop: o[o.length - 1] };
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
    if (type === 'pointer') {
      const v = DIR.vec[dir] || DIR.vec[1];
      let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
      for (let i = 1; i <= 5; i++) {
        const c = col + v.x * i, r = row + v.y * i;
        minC = Math.min(minC, c); minR = Math.min(minR, r);
        maxC = Math.max(maxC, c); maxR = Math.max(maxR, r);
      }
      return { x0: minC, y0: minR, x1: maxC + 1, y1: maxR + 1 };
    }
    let rw = rg.w, rh = rg.h;
    if (G.DEVICES[type].rotatable && (dir % 2 === 1)) { const t = rw; rw = rh; rh = t; }
    const fp = footprint(type, col, row, dir);
    const cx = type === 'driller' ? col + fp.w / 2 : col + 0.5;
    const cy = type === 'driller' ? row + fp.h / 2 : row + 0.5;
    return { x0: cx - rw / 2, y0: cy - rh / 2, x1: cx + rw / 2, y1: cy + rh / 2 };
  }
  function inRect(r, gx, gy) { return r && gx >= r.x0 && gx < r.x1 && gy >= r.y0 && gy < r.y1; }
  // 건물 단위 유효 범위(포획기는 업그레이드로 확장)
  function effRangeRect(b) {
    const r = rangeRect(b.type, b.col, b.row, b.dir);
    if (!r) return r;
    if (b.type === 'catcher' && b.up && b.up.range) {
      const ex = (b.up.range || 0) * (C.CATCH_RANGE_PER_LV || 1);
      return { x0: r.x0 - ex, y0: r.y0 - ex, x1: r.x1 + ex, y1: r.y1 + ex };
    }
    return r;
  }
  function specialList(special) { return S.buildings.filter(b => G.DEVICES[b.type] && G.DEVICES[b.type].special === special); }
  // 사료분배기 범위 배수(우리 시스템에서 개체마다 호출 — 프레임 캐시 사용)
  function feedZoneInfo(gx, gy) {
    const key = Math.floor(gx) + '|' + Math.floor(gy);
    const cached = frameCache.feedCellCache.get(key);
    if (cached) return cached;
    for (const z of frameCache.feedZoneRects) {
      const f = z.b;
      if (inRect(z.rect, gx, gy)) {
        const hit = { inZone: true, mult: (C.FEED_GROWTH_MULT || 1) * electricMult(f), type: f.feedType || '실장푸드' };
        frameCache.feedCellCache.set(key, hit);
        return hit;
      }
    }
    const miss = { inZone: false, mult: 1, type: '실장푸드' };
    frameCache.feedCellCache.set(key, miss);
    return miss;
  }
  function feedZoneMult(gx, gy) {
    return feedZoneInfo(gx, gy).mult;
  }
  function applyFoodRecovery(data, dt, ratio) {
    if (!data || !data.stats || ratio <= 0) return;
    if ((data.stats.육질 || 0) <= 10) data.stats.육질 = Math.min(statMax(), (data.stats.육질 || 0) + (C.FOOD_LOW_QUALITY_RECOVER || 0.1) * dt * ratio);
    G.Creatures.ensureVitals(data);
    if ((data.행복 || 0) <= 50) G.Creatures.changeHappy(data, (C.FOOD_LOW_HAPPY_RECOVER || 0.2) * dt * ratio);
  }
  function takeFeedResource(type, amount) {
    if (amount <= 0) return 1;
    if (type === '운치') { const got = Math.min(amount, S.unchi || 0); S.unchi -= got; return got / amount; }
    if (type === '짓소산 푸드') { const got = Math.min(amount, S.jissoFood || 0); S.jissoFood -= got; return got / amount; }
    if (type === '우마이푸드') { const got = Math.min(amount, S.umaiFood || 0); S.umaiFood -= got; return got / amount; }
    if (type === '다이어트푸드') { const got = Math.min(amount, S.dietFood || 0); S.dietFood -= got; return got / amount; }
    const got = Math.min(amount, S.food || 0); S.food -= got; return got / amount;
  }
  function feedResourceAmount(type) {
    if (type === '운치') return S.unchi || 0;
    if (type === '짓소산 푸드') return S.jissoFood || 0;
    if (type === '우마이푸드') return S.umaiFood || 0;
    if (type === '다이어트푸드') return S.dietFood || 0;
    return S.food || 0;
  }
  function wrongChaosMoodInfo(b) {
    return WRONG_CHAOS_MOODS[(b && b.mood) || 1] || WRONG_CHAOS_MOODS[1];
  }
  function speakWrongChaos(b) {
    const mood = wrongChaosMoodInfo(b);
    b.speech = mood.lines[Math.floor(Math.random() * mood.lines.length)];
    b.speechT = 2.5;
    b.speechTone = '레후';
  }
  function setWrongChaosMood(b, mood) {
    b.mood = mood || (1 + Math.floor(Math.random() * 4));
    b.moodT = 60;
    b.wrongTalkT = 5 + Math.random() * 7;
    speakWrongChaos(b);
  }
  function startWrongChaosGacha(b, feedType) {
    if (!b || b.type !== 'wrongchaosmargot' || b.gachaRemaining > 0 || !FEED_TYPES.includes(feedType)) return false;
    if (feedResourceAmount(feedType) < 1000) {
      G.UI.flash && G.UI.flash((FEED_LABEL[feedType] || feedType) + ' 부족! (1,000개 필요)');
      return false;
    }
    takeFeedResource(feedType, 1000);
    b.gachaFeed = feedType;
    b.gachaRemaining = 10;
    b.sparkleT = 0;
    G.Assets.playSfx('upgrade');
    G.UI.flash && G.UI.flash('프니프니 가챠 시작 · 본체를 10번 클릭하세요');
    return true;
  }
  function weightedChoice(list, bias) {
    if (!list.length) return null;
    if (!bias) return list[Math.floor(Math.random() * list.length)];
    const weights = list.map((_, i) => Math.exp((((i / Math.max(1, list.length - 1)) * 2) - 1) * bias * 0.55));
    let roll = Math.random() * weights.reduce((a, n) => a + n, 0);
    for (let i = 0; i < list.length; i++) { roll -= weights[i]; if (roll <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function averageCreatureStats() {
    const all = [];
    for (const pen of frameCache.pens) for (const c of (pen.creatures || [])) if (c && c.stats) all.push(c.stats);
    for (const w of S.wanderers) if (!w._dead && w.data && w.data.stats && G.CREATURES[w.data.type]) all.push(w.data.stats);
    for (const cg of S.cargo) if (!cg._dead && cg.data && cg.data.stats && G.CREATURES[cg.data.type]) all.push(cg.data.stats);
    if (!all.length) return { 육질: 10, 개념: 10, 크기: 10 };
    const sum = all.reduce((a, s) => ({ 육질: a.육질 + (s.육질 || 0), 개념: a.개념 + (s.개념 || 0), 크기: a.크기 + (s.크기 || 0) }), { 육질: 0, 개념: 0, 크기: 0 });
    return { 육질: Math.round(sum.육질 / all.length), 개념: Math.round(sum.개념 / all.length), 크기: Math.round(sum.크기 / all.length) };
  }
  function wrongChaosCreature(type, averageStats) {
    const data = G.Creatures.newWild(type);
    data.stats = Object.assign({}, averageStats || averageCreatureStats());
    G.Creatures.ensureVitals(data);
    return data;
  }
  function wrongChaosCargo(type, averageStats) {
    if (G.CREATURES[type]) return wrongChaosCreature(type, averageStats);
    if (G.PRODUCTS[type] && G.PRODUCTS[type].isProduct) return G.Creatures.makeProduct(type, { stats: averageStats || averageCreatureStats() });
    return resourceCargoData(type);
  }
  function wrongChaosRoll(b, averageStats) {
    const moodBias = b.mood === 2 ? 1.5 : (b.mood === 4 ? -1.5 : 0);
    const feedBias = { 운치: -1, 실장푸드: 0, '짓소산 푸드': 1, 다이어트푸드: 2, 우마이푸드: 3 }[b.gachaFeed] || 0;
    const bias = moodBias + feedBias;
    const roll = Math.random();
    if (roll < 0.30) return resourceCargoData('운치');
    if (roll < 0.60) return wrongChaosCreature(weightedChoice(FILTER_CATEGORIES[0].types, bias), averageStats);
    if (roll < 0.82) {
      const materials = FILTER_CATEGORIES[1].types.filter(t => !['운치', '전자부품'].includes(t));
      return wrongChaosCargo(weightedChoice(materials, bias), averageStats);
    }
    if (roll < 0.96) return wrongChaosCargo(weightedChoice(FILTER_CATEGORIES[2].types, bias), averageStats);
    if (roll < 0.99) return resourceCargoData('전자부품');
    return resourceCargoData('카오스 구더기');
  }
  function clickWrongChaosGacha(b) {
    if (!b || b.type !== 'wrongchaosmargot' || b.gachaRemaining <= 0) return false;
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2;
    const averageStats = averageCreatureStats();
    const data = wrongChaosRoll(b, averageStats);
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.4 + Math.random() * 1.8;
    dropFloorCargo(data, Math.floor(cx + Math.cos(angle) * radius), Math.floor(cy + Math.sin(angle) * radius));
    for (let i = 0; i < 18; i++) spawnParticle(cx * CELL, cy * CELL, i % 2 ? '#fff3a6' : '#c98cff');
    b.gachaRemaining--;
    playWorldSfx('upgrade', cx, cy, { force: true, volume: 0.55 });
    if (b.gachaRemaining <= 0) {
      b.gachaRemaining = 0;
      b.gachaFeed = null;
      setWrongChaosMood(b);
      G.UI.flash && G.UI.flash('프니프니 가챠 종료 · 기분이 바뀌었습니다');
    } else {
      speakWrongChaos(b);
      G.UI.flash && G.UI.flash('아이템 1개 · ' + b.gachaRemaining + '회 남음');
    }
    return true;
  }
  function updateWrongChaosMaggot(b, dt) {
    b.moodT = (b.moodT == null ? 60 : b.moodT) - dt;
    b.wrongTalkT = (b.wrongTalkT == null ? 5 : b.wrongTalkT) - dt;
    if (b.moodT <= 0) setWrongChaosMood(b);
    else if ((b.speechT || 0) <= 0 && b.wrongTalkT <= 0) {
      speakWrongChaos(b);
      b.wrongTalkT = 10 + Math.random() * 10;
    }
    if (b.gachaRemaining > 0) {
      b.sparkleT = (b.sparkleT || 0) - dt;
      if (b.sparkleT <= 0) {
        b.sparkleT = 0.08;
        spawnParticle((b.col + Math.random() * b.w) * CELL, (b.row + Math.random() * b.h) * CELL, Math.random() < 0.5 ? '#fff8c4' : '#cf9cff');
      }
    }
  }
  function terrariumGrowthMult(feedType, fedRatio) {
    if (fedRatio <= 0) return 1;
    if (feedType === '우마이푸드') return Math.max(1, fedRatio * (C.UMAI_GROWTH_MULT || 3));
    if (feedType === '다이어트푸드') return 1 - fedRatio * (1 - (C.DIET_GROWTH_MULT || 0.5));
    if (feedType === '운치') return Math.max(1, fedRatio * (C.UNCHI_GROWTH_MULT || 1.1));
    return Math.max(1, fedRatio * (C.FEED_GROWTH_MULT || 2));
  }
  function makeTerrariumChild(b) {
    const stages = ['구더기', '엄지', '자실장'];
    const type = stages[Math.floor(Math.random() * stages.length)];
    const child = {
      id: G.uid(),
      type,
      stats: Object.assign({}, b.dnaStats),
      growth: 0,
      incubatorGrowthT: 0,
    };
    G.Creatures.ensureVitals(child);
    recordCreatureProduced(child);
    return child;
  }
  function updateTerrarium(b, dt) {
    const list = b.incubatorCreatures || (b.incubatorCreatures = []);
    if (!b.dnaStats) { b.state = 'idle'; return; }
    b.state = 'producing';
    b.incubatorBirthT = (b.incubatorBirthT || 0) + dt;
    const birthInterval = C.BIRTH_INTERVAL || 10;
    while (b.incubatorBirthT >= birthInterval && list.length < 100) {
      b.incubatorBirthT -= birthInterval;
      const batch = Math.min(5, 100 - list.length);
      for (let i = 0; i < batch; i++) list.push(makeTerrariumChild(b));
      playDeviceSfx('birth', b);
    }
    if (list.length >= 100) b.incubatorBirthT = Math.min(b.incubatorBirthT, birthInterval);
    const feedType = b.feedType || '실장푸드';
    const difficultyFoodMult = S.difficulty === 'breeding' ? 0.5 : 1;
    const demandPerMin = list.reduce((sum, c) => sum + (C.FOOD_RATE[c.type] || 0) * difficultyFoodMult, 0);
    S.foodDemandPerMin = (S.foodDemandPerMin || 0) + demandPerMin;
    if (feedType !== '운치') S.unchiPerMin = (S.unchiPerMin || 0) + demandPerMin * (C.UNCHI_MULT || 2);
    for (const c of list) {
      const need = (C.FOOD_RATE[c.type] || 0) * difficultyFoodMult / 60 * dt;
      const fedRatio = takeFeedResource(feedType, need);
      if (feedType !== '운치') {
        const made = need * fedRatio * (C.UNCHI_MULT || 2);
        b.incubatorUnchi = (b.incubatorUnchi || 0) + made;
        achievementStats().unchi += made;
      }
      c.incubatorGrowthT = (c.incubatorGrowthT || 0) + dt * terrariumGrowthMult(feedType, fedRatio);
      const stageTime = C.SIZE_GROW_TIME || 20;
      while (c.type !== '성체실장' && c.incubatorGrowthT >= stageTime) {
        c.incubatorGrowthT -= stageTime;
        c.type = c.type === '구더기' ? '엄지' : (c.type === '엄지' ? '자실장' : '성체실장');
        c.stats = Object.assign({}, c.stats || b.dnaStats);
        G.Creatures.ensureVitals(c);
      }
    }
  }
  function applyUnchiFeedEffect(data, ratio, dt) {
    if (!data || !data.stats || ratio <= 0) return false;
    let evolved = false;
    if (Math.random() < (C.UNCHI_FEED_STAT_DOWN_CHANCE || 0.08) * dt * ratio) changeStat(data.stats, '육질', -1);
    if (Math.random() < (C.UNCHI_FEED_STAT_DOWN_CHANCE || 0.08) * dt * ratio) changeStat(data.stats, '개념', -1);
    if (Math.random() < (C.UNCHI_FEED_SIZE_UP_CHANCE || 0.10) * dt * ratio) {
      changeStat(data.stats, '크기', 1);
      evolved = G.Creatures.tryEvolveBySize(data);
    }
    return evolved;
  }
  function feedCreatureInZone(data, gx, gy, dt) {
    if (!data || !G.CREATURES[data.type]) return;
    const fi = feedZoneInfo(gx, gy);
    let growthSeconds = dt;
    if ((fi.mult || 1) <= 1) {
      if (G.Creatures.feedGrowth(data, growthSeconds)) playWorldSfx('grow', gx, gy);
      return;
    }
    const need = (C.FOOD_RATE[data.type] || 0) * fi.mult / 60 * dt;
    const ratio = takeFeedResource(fi.type || '실장푸드', need);
    if (fi.type === '실장푸드' || fi.type === '짓소산 푸드') {
      if (ratio > 0) {
        growthSeconds = Math.max(growthSeconds, dt * ratio * fi.mult);
        G.Creatures.recoverHp(data, (C.FOOD_HP_RECOVER || 4) * dt * ratio);   // 체력 회복
        if (fi.type === '실장푸드') applyFoodRecovery(data, dt, ratio);
      }
    }
    if (fi.type === '짓소산 푸드' && ratio > 0) {   // 육질 1% / 행복 5% 확률 상승
      if (data.stats && Math.random() < (C.JISSO_FOOD_QUALITY_CHANCE || 0.01) * dt * ratio) addStat(data.stats, '육질', 1);
      if (Math.random() < (C.JISSO_FOOD_HAPPY_CHANCE || 0.05) * dt * ratio) G.Creatures.changeHappy(data, 1);
    }
    if (fi.type === '실장푸드' && ratio > 0 && data.stats && Math.random() < (C.FOOD_QUALITY_CHANCE || 0.005) * dt * ratio) addStat(data.stats, '육질', 1);
    if (fi.type === '운치' && ratio > 0) {   // 성장 1.1배 + 운치 효과 + 행복 2% 하락
      growthSeconds = Math.max(growthSeconds, dt * ratio * fi.mult * (C.UNCHI_GROWTH_MULT || 1.1));
      applyUnchiFeedEffect(data, ratio, dt);
      if (Math.random() < (C.UNCHI_HAPPY_DOWN_CHANCE || 0.02) * dt * ratio) G.Creatures.changeHappy(data, -1);
    }
    if (fi.type === '우마이푸드' && ratio > 0) {   // 성장 3배 + 행복 +0.3/초
      growthSeconds = Math.max(growthSeconds, dt * ratio * (C.UMAI_GROWTH_MULT || 3));
      G.Creatures.recoverHp(data, (C.FOOD_HP_RECOVER || 4) * dt * ratio);
      G.Creatures.changeHappy(data, (C.UMAI_HAPPY_RATE || 0.3) * dt * ratio);
    }
    if (fi.type === '다이어트푸드') {   // 체력 회복 + 성장 최대 0.5배로 억제
      if (ratio > 0) {
        const mult = C.DIET_GROWTH_MULT || 0.5;
        growthSeconds = dt * (1 - ratio * (1 - mult));
        G.Creatures.recoverHp(data, (C.FOOD_HP_RECOVER || 4) * dt * ratio);
      }
    }
    if (G.Creatures.feedGrowth(data, growthSeconds)) playWorldSfx('grow', gx, gy);
  }
  function pushOutOfDeviceRect(gx, gy, b, pad) {
    const x0 = b.col - pad, y0 = b.row - pad;
    const x1 = b.col + (b.w || 1) + pad, y1 = b.row + (b.h || 1) + pad;
    if (gx <= x0 || gx >= x1 || gy <= y0 || gy >= y1) return { x: gx, y: gy };
    const dl = Math.abs(gx - x0), dr = Math.abs(x1 - gx), dtp = Math.abs(gy - y0), db = Math.abs(y1 - gy);
    const m = Math.min(dl, dr, dtp, db);
    if (m === dl) return { x: x0, y: gy };
    if (m === dr) return { x: x1, y: gy };
    if (m === dtp) return { x: gx, y: y0 };
    return { x: gx, y: y1 };
  }
  // 특수 장치 충돌: (gx,gy)의 점을 장치 몸체 밖으로 밀어냄(footprint+selfRad)
  function pushOutOfFeeders(gx, gy, selfRad) {
    let x = gx, y = gy;
    const devices = frameCache.feedZones.concat(frameCache.specialColliders);
    for (const f of devices) {
      const p = pushOutOfDeviceRect(x, y, f, selfRad || 0);
      x = p.x; y = p.y;
    }
    return { x, y };
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
  function startFieldClearance(c, r) {
    const f = startFieldRect();
    const dx = Math.max(f.c0 - c, 0, c - (f.c1 - 1));
    const dy = Math.max(f.r0 - r, 0, r - (f.r1 - 1));
    return Math.hypot(dx, dy);
  }
  function isStartFieldCell(c, r) {
    const f = startFieldRect();
    return c >= f.c0 && c < f.c1 && r >= f.r0 && r < f.r1;
  }
  function landKeyForCell(c, r) {
    const n = C.LAND_GRID_SIZE || 40;
    return Math.floor(c / n) + '|' + Math.floor(r / n);
  }
  function parseLandKey(key) { const p = String(key).split('|'); return { gx: +p[0], gy: +p[1] }; }
  function startLandKeys() {
    const n = C.LAND_GRID_SIZE || 40, f = startFieldRect(), out = {};
    for (let gx = Math.floor(f.c0 / n); gx <= Math.floor((f.c1 - 1) / n); gx++) {
      for (let gy = Math.floor(f.r0 / n); gy <= Math.floor((f.r1 - 1) / n); gy++) out[gx + '|' + gy] = true;
    }
    return out;
  }
  function landDistance(key) {
    const p = parseLandKey(key);
    let best = Infinity;
    const starts = startLandKeys();
    for (const startKey in starts) {
      const s = parseLandKey(startKey);
      best = Math.min(best, Math.abs(p.gx - s.gx) + Math.abs(p.gy - s.gy));
    }
    return Number.isFinite(best) ? best : 0;
  }
  function landHash(key) {
    const text = String(S.landSeed || 1) + ':' + key;
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }
  function mudflatSeed(key) {
    return landDistance(key) >= 2 && landHash(key + ':mudflat-seed') < 0.025;
  }
  function mudflatCompanionKey(seedKey) {
    const p = parseLandKey(seedKey);
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]].filter(d => {
      const key = (p.gx + d[0]) + '|' + (p.gy + d[1]);
      return landKeyInWorld(key) && landDistance(key) >= 2 && !startLandKeys()[key];
    });
    if (!dirs.length) return null;
    const d = dirs[Math.floor(landHash(seedKey + ':mudflat-side') * dirs.length)];
    return (p.gx + d[0]) + '|' + (p.gy + d[1]);
  }
  function isClusteredMudflat(key) {
    if (mudflatSeed(key) && mudflatCompanionKey(key)) return true;
    const p = parseLandKey(key);
    return [[1,0],[-1,0],[0,1],[0,-1]].some(d => {
      const neighbor = (p.gx + d[0]) + '|' + (p.gy + d[1]);
      return mudflatSeed(neighbor) && mudflatCompanionKey(neighbor) === key;
    });
  }
  function landEnvironmentKey(key) {
    if (S.landEnvironmentOverrides && S.landEnvironmentOverrides[key]) return S.landEnvironmentOverrides[key];
    if (startLandKeys()[key]) return 'wasteland';
    if (isClusteredMudflat(key)) return 'mudflat';
    const d = landDistance(key);
    const weights = [
      ['wasteland', Math.max(8, 48 - d * 5)],
      ['park', Math.max(12, 24 - d)],
      ['farmland', Math.max(12, 24 - d)],
      ['powerplant', d >= 2 ? 5 + d * 1.4 : 1],
      ['downtown', d >= 2 ? 5 + d * 1.3 : 1],
      ['redzone', d >= 4 ? (d - 3) * 2.4 : 0],
      ['bunker', d >= 4 ? (d - 3) * 2.1 : 0],
    ];
    const total = weights.reduce((sum, item) => sum + item[1], 0);
    let roll = landHash(key) * total;
    for (const item of weights) {
      roll -= item[1];
      if (roll <= 0) return item[0];
    }
    return 'wasteland';
  }
  function landEnvironment(key) {
    const envKey = landEnvironmentKey(key);
    return Object.assign({ key: envKey }, (G.LAND_ENVIRONMENTS && G.LAND_ENVIRONMENTS[envKey]) || G.LAND_ENVIRONMENTS.wasteland);
  }
  function environmentAtPoint(gx, gy) {
    return landEnvironment(landKeyForCell(Math.floor(gx), Math.floor(gy)));
  }
  function environmentForBuilding(b) {
    if (!b) return landEnvironment('0|0');
    return environmentAtPoint(b.col + (b.w || 1) / 2, b.row + (b.h || 1) / 2);
  }
  function hasOwnedEnvironment(envKey) {
    const keys = Object.assign({}, startLandKeys(), S.ownedLand || {});
    return Object.keys(keys).some(key => keys[key] && landEnvironmentKey(key) === envKey);
  }
  function environmentEffectsForBuilding(b) {
    const env = environmentForBuilding(b);
    const effects = Object.assign({}, (env && env.effects) || {});
    const key = landKeyForCell(b.col + (b.w || 1) / 2, b.row + (b.h || 1) / 2);
    const relic = S.buildings.find(x => G.DEVICES[x.type] && G.DEVICES[x.type].monument &&
      landKeyForCell(x.col + 0.5, x.row + 0.5) === key);
    if (!relic) return effects;
    const addMult = (k, n) => { effects[k] = (effects[k] == null ? 1 : effects[k]) * n; };
    if (relic.type === 'relic_techica') effects.correctionConceptChance = (effects.correctionConceptChance || 0) + 0.10;
    else if (relic.type === 'relic_arts') addMult('penGrowth', 1.10);
    else if (relic.type === 'relic_slave') addMult('laborEfficiency', 1.15);
    else if (relic.type === 'relic_sister') effects.penQualityChance = (effects.penQualityChance || 0) + 0.10;
    else if (relic.type === 'relic_dainagon') effects.extraProductChance = (effects.extraProductChance || 0) + 0.10;
    else if (relic.type === 'relic_bigmargot') effects.chaosMaggotChance = (effects.chaosMaggotChance || 0) + 0.0005;
    else if (relic.type === 'relic_home') addMult('powerOutput', 1.10);
    else if (relic.type === 'relic_candy') addMult('productSpeed', 1.10);
    else if (relic.type === 'relic_margot') addMult('penUnchi', 1.20);
    return effects;
  }
  function monumentEffectsAtPoint(gx, gy) {
    return environmentEffectsForBuilding({ col: gx - 0.5, row: gy - 0.5, w: 1, h: 1 });
  }
  function ownedEnvironmentEffect(envKey, effectKey, fallback) {
    if (!hasOwnedEnvironment(envKey)) return fallback == null ? 1 : fallback;
    const env = G.LAND_ENVIRONMENTS && G.LAND_ENVIRONMENTS[envKey];
    const value = env && env.effects && env.effects[effectKey];
    return value == null ? (fallback == null ? 1 : fallback) : value;
  }
  function landDistanceMultiplier(key) {
    const d = key ? landDistance(key) : 1;
    return 1 + Math.max(0, d - 1) * (C.LAND_DISTANCE_COST_PER_GRID || 0);
  }
  function isOwnedLandKey(key) { return !!(S.ownedLand[key] || startLandKeys()[key]); }
  function landConnected(key) {
    if (isOwnedLandKey(key)) return true;
    const p = parseLandKey(key);
    return [[1,0],[-1,0],[0,1],[0,-1]].some(d => isOwnedLandKey((p.gx + d[0]) + '|' + (p.gy + d[1])));
  }
  function revealedLandKeys() {
    const out = Object.assign({}, startLandKeys(), S.ownedLand || {});
    const seeds = Object.keys(out).filter(key => out[key]);
    for (const key of seeds) {
      const p = parseLandKey(key);
      for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) out[(p.gx + d[0]) + '|' + (p.gy + d[1])] = true;
    }
    return out;
  }
  function landKeyInWorld(key) {
    const p = parseLandKey(key), n = C.LAND_GRID_SIZE || 48;
    return p.gx >= 0 && p.gy >= 0 && p.gx * n < COLS && p.gy * n < ROWS;
  }
  function cameraLandBounds() {
    const n = C.LAND_GRID_SIZE || 40, keys = Object.assign({}, startLandKeys(), S.ownedLand || {});
    let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (const key in keys) {
      if (!keys[key]) continue;
      const p = parseLandKey(key);
      minGx = Math.min(minGx, p.gx); minGy = Math.min(minGy, p.gy);
      maxGx = Math.max(maxGx, p.gx); maxGy = Math.max(maxGy, p.gy);
    }
    if (!Number.isFinite(minGx)) return { c0: 0, r0: 0, c1: COLS, r1: ROWS };
    return {
      c0: clamp((minGx - 1) * n, 0, COLS),
      r0: clamp((minGy - 1) * n, 0, ROWS),
      c1: clamp((maxGx + 2) * n, 0, COLS),
      r1: clamp((maxGy + 2) * n, 0, ROWS),
    };
  }
  function ownedLandRectCells(extra) {
    const n = C.LAND_GRID_SIZE || 40, keys = Object.assign({}, startLandKeys(), S.ownedLand || {});
    let minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (const key in keys) {
      if (!keys[key]) continue;
      const p = parseLandKey(key);
      minGx = Math.min(minGx, p.gx); minGy = Math.min(minGy, p.gy);
      maxGx = Math.max(maxGx, p.gx); maxGy = Math.max(maxGy, p.gy);
    }
    const pad = extra || 0;
    if (!Number.isFinite(minGx)) return startFieldRect();
    return {
      c0: clamp(minGx * n - pad, 0, COLS),
      r0: clamp(minGy * n - pad, 0, ROWS),
      c1: clamp((maxGx + 1) * n + pad, 0, COLS),
      r1: clamp((maxGy + 1) * n + pad, 0, ROWS),
    };
  }
  function isOwnedCell(c, r) {
    return inGrid(c, r) && (isStartFieldCell(c, r) || !!S.ownedLand[landKeyForCell(c, r)]);
  }
  function isOwnedPoint(gx, gy) {
    return isOwnedCell(Math.floor(gx), Math.floor(gy));
  }
  function footprintOwned(cells) {
    return cells.every(cell => isOwnedCell(cell.c, cell.r));
  }
  function landCost(key) {
    const bought = S.landBought || 0;
    const steps = C.LAND_COST_STEPS || [C.LAND_BASE_COST || 1000];
    let base;
    if (bought < steps.length) base = steps[bought];
    else {
      const last = steps[steps.length - 1] || (C.LAND_BASE_COST || 1000);
      base = Math.round(last * Math.pow(C.LAND_COST_MULT || 2, bought - steps.length + 1));
    }
    return Math.round(base * landDistanceMultiplier(key));
  }
  function occAt(c, r) { return inGrid(c, r) ? occ[r][c] : 'OOB'; }
  function beltCell(c, r) { return inGrid(c, r) ? beltGrid[r][c] : null; }
  function hasBelt(c, r) { const b = beltCell(c, r); return !!(b && (b.h || b.v)); }
  function deviceAt(c, r) {
    const id = occAt(c, r);
    if (!id || id === 'OOB') return null;
    return buildingById.get(id) || null;
  }
  function accepts(def, type) {
    return def.accept === '*' || (Array.isArray(def.accept) && def.accept.includes(type));
  }
  function isWorkerType(type) { return type === '성체실장' || type === '독라'; }       // 일꾼 가능
  function hasElectricBoost(b) {
    return !!(b && b.powered && canUseElectricity(b) && !needsRequiredPower(b));
  }
  function workerMult(b) {
    const base = 1 + (b.workers ? b.workers.length : 0) * C.WORKER_SPEED;
    const powered = hasElectricBoost(b) ? base * (C.POWER_BOOST || 1.5) : base;
    const productSpeed = (b && (b.type === 'cookery' || b.type === 'packer')) ? (environmentEffectsForBuilding(b).productSpeed || 1) : 1;
    return powered * productSpeed;
  } // 속도 배수
  function massProcessingMult(b) {
    if (!b || !['slaughter', 'grinder', 'cookery'].includes(b.type)) return 1;
    return 1 + ((S.upgrades && S.upgrades.대량가공강화) || 0) * 0.2;
  }
  function concentrationMult() { return 1 + ((S.upgrades && S.upgrades.초고농축가속) || 0) * 0.2; }
  function laborUpgradeMult() { return 1 + ((S.upgrades && S.upgrades.노동석강화) || 0) * 0.15; }
  function upgradeMult(key) { return 1 + ((S.upgrades && S.upgrades[key]) || 0) * 0.3; }
  function beltSpeed() { return C.BELT_SPEED * upgradeMult('레일속도'); }
  function grabberInterval(b) { return C.GRABBER_INTERVAL / (upgradeMult('집게속도') * (b ? electricMult(b) : 1)); }
  function reformerCount() { return S.buildings.filter(b => b.type === 'reformer' && !powerBlocked(b)).length; }
  function laborLimit() { return Math.min(C.LABOR_MAX || 50, reformerCount() * (C.LABOR_PER_REFORMER || 10)); }
  function addWorker(dev, data) {
    if (isWorkerType(data.type) && dev.workers && dev.workers.length < C.WORKER_SLOTS) { dev.workers.push(data); playDeviceSfx('click', dev); return true; }
    return false;
  }

  /* ---- 설치 가능 판정 ------------------------------------------------- */
  // 방어 탭 건물은 침입 실장석 주변 위험지역(18칸)에 설치 불가
  function isDefenseType(type) { return G.DEVICES[type] && G.DEVICES[type].cat === 'defense'; }
  function defenseDangerBlocked(type, cells) {
    if (!isDefenseType(type)) return false;
    const range = C.DEFENSE_DANGER_RANGE || 18;
    for (const w of S.wanderers) {
      if (!w.invade) continue;
      for (const cell of cells) if (Math.hypot((cell.c + 0.5) - w.gx, (cell.r + 0.5) - w.gy) <= range) return true;
    }
    return false;
  }
  // 창고는 잔해/폐허/유적(비-persistent 유적)에서 일정 타일 이상 떨어져야 한다.
  // 버려진 양식장(persistent)은 채취용이라 제외한다.
  function warehouseRuinTooClose(col, row, w, h) {
    const margin = C.WAREHOUSE_RUIN_CLEARANCE || 8;
    const c0 = col, r0 = row, c1 = col + w, r1 = row + h;
    return (S.ruins || []).some(r => !r.persistent &&
      !(c1 + margin <= r.col || c0 >= r.col + r.w + margin || r1 + margin <= r.row || r0 >= r.row + r.h + margin));
  }
  function warehouseRedzoneBlocked(type, col, row, w, h) {
    if (type !== 'warehouse' && type !== 'largewarehouse') return false;
    return environmentAtPoint(col + w / 2, row + h / 2).key === 'redzone';
  }
  function canPlace(type, col, row, dir) {
    const fp = footprint(type, col, row, dir);
    for (const cell of fp.cells) if (!inGrid(cell.c, cell.r)) return false;
    const placeCells = (type === 'tunnel' || type === 'crossbelt') ? deviceCells({ type, col, row, dir, w: fp.w, h: fp.h }) : fp.cells;
    if (!footprintOwned(placeCells)) return false;
    if (defenseDangerBlocked(type, placeCells)) return false;   // 위험지역
    if (warehouseRedzoneBlocked(type, col, row, fp.w, fp.h)) return false;
    if ((type === 'warehouse' || type === 'largewarehouse') && warehouseRuinTooClose(col, row, fp.w, fp.h)) return false;   // 잔해/폐허/유적 근접 금지
    if (type === 'reformer' && reformerCount() >= (C.REFORMER_MAX || 10)) return false;
    if (G.DEVICES[type] && G.DEVICES[type].monument) {
      if (S.buildings.some(b => b.type === type)) return false;
      const key = landKeyForCell(col + fp.w / 2, row + fp.h / 2);
      if (S.buildings.some(b => G.DEVICES[b.type] && G.DEVICES[b.type].monument &&
          landKeyForCell(b.col + 0.5, b.row + 0.5) === key)) return false;
    }
    if (type === 'belt' || type === 'guardbelt') { const cell = fp.cells[0]; return !occAt(cell.c, cell.r); }
    if (isGrabberType(type)) {
      const { mid } = grabberRoles({ type, col, row, dir });
      return !(occAt(mid.c, mid.r) || hasBelt(mid.c, mid.r));
    }
    // inPen 장치: 우리 칸 위에도 설치 가능(벨트는 불가)
    if (G.DEVICES[type] && G.DEVICES[type].inPen) {
      const cell = fp.cells[0];
      if (hasBelt(cell.c, cell.r)) return false;
      const id = occAt(cell.c, cell.r);
      if (id && id !== 'OOB') { const ex = buildingById.get(id); if (!ex || ex.type !== 'penbox') return false; }
      return true;
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
      ['h', 'v'].forEach(ax => { if (bc[ax]) { const i = S.buildings.indexOf(bc[ax]); if (i >= 0) S.buildings.splice(i, 1); buildingById.delete(bc[ax].id); } });
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
    } else if (isGrabberType(b.type)) {
      const { mid } = grabberRoles(b); occ[mid.r][mid.c] = b.id;
    } else {
      for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r)) { removeBeltAtCell(cell.c, cell.r); occ[cell.r][cell.c] = b.id; }
    }
    if (!S.buildings.includes(b)) S.buildings.push(b);
    buildingById.set(b.id, b);
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
      warehouse: JSON.parse(JSON.stringify(S.warehouse || {})),
      buildInstallCounts: Object.assign({}, S.buildInstallCounts || {}),
    });
    if (undoStack.length > 25) undoStack.shift();
  }
  function rebuildGrids() {
    for (let r = 0; r < ROWS; r++) { occ[r].fill(null); beltGrid[r].fill(null); }
    buildingById.clear();
    // 구버전 세이브 호환: 매지컬 테치카는 이제 1×1 (예전 2×2 데이터 보정)
    for (const b of S.buildings) if (b.type === 'techica' && (b.w !== 1 || b.h !== 1)) { b.w = 1; b.h = 1; }
    for (const b of S.buildings) buildingById.set(b.id, b);
    for (const b of S.buildings) {
      if (b.type === 'belt' || b.type === 'guardbelt') {
        b.axis = (b.dir === 1 || b.dir === 3) ? 'h' : 'v';
        if (!beltGrid[b.row][b.col]) beltGrid[b.row][b.col] = { h: null, v: null };
        beltGrid[b.row][b.col][b.axis] = b;
      } else if (isGrabberType(b.type)) { const { mid } = grabberRoles(b); if (inGrid(mid.c, mid.r)) occ[mid.r][mid.c] = b.id; }
      else { for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r)) occ[cell.r][cell.c] = b.id; }
    }
  }
  function reloadState(opts) {
    currentTool = null; ghostDir = 1; mouseCell = null; dropHoverId = null;
    panning = false; panStart = null; moveKeys.w = moveKeys.a = moveKeys.s = moveKeys.d = false;
    undoStack.length = 0; pasteMode = false; pasteClip = null;
    wallDragging = false; wallErase = false; wallStartPoint = null; wallEndPoint = null; wallSelection = []; doorSelection = [];
    beltDragging = false; beltPath = []; beltDragAxis = null; chaosGateDragStart = null; crossbeltDragStart = null; penDragStart = null; hoverBuilding = null;
    pendingSelect = false; selDragging = false; selStartCell = null; selDownClient = null;
    moveMode = false; moving = []; filterTarget = null; penTarget = null; birthTarget = null; selectedPenCreature = null; selectedWorkers = [];
    S.selection = [];
    if (landPromptEl) landPromptEl.style.display = 'none';
    if (deviceInfoEl) deviceInfoEl.style.display = 'none';
    if (S.upgrades && S.upgrades.터널 && !S.upgrades.횡단벨트) S.upgrades.횡단벨트 = S.upgrades.터널;
    // 구형 터널은 같은 위치/방향의 신규 횡단벨트로 자동 승계한다.
    for (const b of S.buildings) {
      if (b.type !== 'tunnel') continue;
      const ends = transportEnds(b);
      b.type = 'crossbelt';
      b.gateA = { c: ends.back.c, r: ends.back.r };
      b.gateB = { c: ends.front.c, r: ends.front.r };
      b.col = ends.back.c; b.row = ends.back.r; b.w = 1; b.h = 1;
      b.cost = G.BUILD_COST.crossbelt || b.cost;
    }
    rebuildGrids();
    if (!S.weather) S.weather = { rollIn: C.WEATHER_ROLL_SEC || 60, rainLeft: 0 };
    if (!S.buildInstallCounts || typeof S.buildInstallCounts !== 'object') S.buildInstallCounts = {};
    G.Assets.setAmbience && G.Assets.setAmbience(G.RAIN_SOUND, S.weather.rainLeft > 0);
    if (S.buildings.length) ensureColony();   // 기존 세이브에도 콜로니 보장
    centerCamera();
    if (opts && opts.setupStart) {
      setupStart();
      rebuildGrids();
    }
    generateRuinsNearOwned();
    ensureEnvironmentFeatures();
    refreshUnacceptedQuestRewards();
    renderMenuItems();
    updateFilterPanel();
    updatePenPanel();
    updateBirthingPanel();
    renderLinggalButton();
  }
  function undo() {
    if (!undoStack.length) { setStatus('취소할 작업이 없습니다.'); return; }
    const s = undoStack.pop();
    S.buildings = s.buildings; S.walls = s.walls; S.cargo = s.cargo; S.wanderers = s.wanderers; S.penSeq = s.penSeq; S.money = s.money;
    if (s.warehouse) S.warehouse = s.warehouse;
    S.buildInstallCounts = Object.assign({}, s.buildInstallCounts || {});
    S.selection = []; cancelMove(); cancelTool();
    rebuildGrids();
    renderMenuItems();
    G.Assets.playSfx('remove'); setStatus('실행 취소됨 (Ctrl+Z)');
  }
  /* ---- 복사 / 청사진 ------------------------------------------------- */
  function clipFromBuildings(builds) {
    let minC = Infinity, minR = Infinity;
    builds.forEach(b => { minC = Math.min(minC, b.col); minR = Math.min(minR, b.row); });
    return builds.map(b => ({
      type: b.type, dc: b.col - minC, dr: b.row - minR, dir: b.dir, w: b.w, h: b.h,
      cells: b.type === 'penbox' ? penRelCells(b).map(cell => ({ c: cell.c, r: cell.r })) : undefined,
      // 분류기·집게·포획기의 필터 설정도 함께 복사
      filter: Array.isArray(b.filter) ? b.filter.slice() : undefined,
      statFilter: b.statFilter ? Object.assign({}, b.statFilter) : undefined,
      filterLane: b.filterLane,
      priority: isGrabberType(b.type) ? grabberPriority(b) : undefined,
      gateA: b.gateA ? { c: b.gateA.c - minC, r: b.gateA.r - minR } : undefined,
      gateB: b.gateB ? { c: b.gateB.c - minC, r: b.gateB.r - minR } : undefined,
    }));
  }
  function copySelection() {
    closeAuxPanels();
    const builds = S.selection.map(id => S.buildings.find(b => b.id === id)).filter(Boolean);
    if (!builds.length) { setStatus('복사할 건물을 먼저 드래그 선택하세요.'); return; }
    pasteClip = clipFromBuildings(builds);
    pasteMode = true; currentTool = null; cancelMove(); S.selection = [];
    setStatus('복사됨 (' + pasteClip.length + '개) · 클릭=붙여넣기 / Ctrl+숫자=청사진 저장 / 우클릭=취소');
  }
  function rotatePasteClip() {
    if (!pasteClip || !pasteClip.length) return;
    let groupH = 0;
    for (const it of pasteClip) {
      const fp = footprint(it.type, 0, 0, it.dir);
      const h = it.type === 'penbox' ? it.h : fp.h;
      groupH = Math.max(groupH, it.dr + h);
    }
    pasteClip = pasteClip.map(it => {
      const out = Object.assign({}, it);
      const fp = footprint(it.type, 0, 0, it.dir);
      const oldW = it.type === 'penbox' ? it.w : fp.w;
      const oldH = it.type === 'penbox' ? it.h : fp.h;
      out.dc = groupH - (it.dr + oldH);
      out.dr = it.dc;
      if (it.type === 'penbox' && Array.isArray(it.cells)) {
        out.cells = it.cells.map(cell => ({ c: oldH - 1 - cell.r, r: cell.c }));
        out.w = oldH; out.h = oldW;
      } else if (G.DEVICES[it.type] && G.DEVICES[it.type].rotatable) {
        out.dir = (it.dir + 1) % 4;
        const nfp = footprint(it.type, 0, 0, out.dir);
        out.w = nfp.w; out.h = nfp.h;
      }
      if ((it.type === 'crossbelt' || it.type === 'chaosgate') && it.gateA && it.gateB) {
        out.gateA = { c: groupH - 1 - it.gateA.r, r: it.gateA.c };
        out.gateB = { c: groupH - 1 - it.gateB.r, r: it.gateB.c };
      }
      return out;
    });
    setStatus('복사 배치를 회전했습니다. 클릭=붙여넣기 / R=회전 / 우클릭=취소');
  }
  function pasteAt(col, row) {
    closeAuxPanels();
    snapshot();
    for (const it of pasteClip) {
      const c = col + it.dc, r = row + it.dr;
      if (it.type === 'penbox') makePen(c, r, it.w, it.h, { cells: it.cells });   // 점유 시 makePen이 실패(덮어쓰기 X)
      else if (it.type === 'belt' || it.type === 'guardbelt') placeBelt(c, r, it.dir, it.type);
      else if (it.type === 'crossbelt' && it.gateA && it.gateB) placeCrossbelt(
        { col: col + it.gateA.c, row: row + it.gateA.r },
        { col: col + it.gateB.c, row: row + it.gateB.r });
      else if (it.type === 'chaosgate' && it.gateA && it.gateB) placeChaosGate(
        { col: col + it.gateA.c, row: row + it.gateA.r },
        { col: col + it.gateB.c, row: row + it.gateB.r });
      else placeDevice(it.type, c, r, it.dir, it);   // it에 filter/statFilter/filterLane 포함
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
  // 링갈 버튼: 우하단 청사진 위쪽(48×72). ON이 기본. OFF면 실장석이 단순 대사만 함.
  function buildLinggalButton() {
    const btn = document.createElement('button');
    btn.id = 'linggal-btn';
    btn.style.backgroundImage = "url('assets/images/ui/linggal.png')";
    btn.addEventListener('click', () => {
      S.linggal = !S.linggal;
      renderLinggalButton();
      G.Assets.playSfx('click');
      if (G.UI && G.UI.flash) G.UI.flash('링갈 ' + (S.linggal ? 'ON' : 'OFF'));
    });
    document.getElementById('game').appendChild(btn);
    renderLinggalButton();
  }
  function renderLinggalButton() {
    const btn = document.getElementById('linggal-btn'); if (!btn) return;
    const on = S.linggal !== false;
    btn.classList.toggle('off', !on);
    btn.title = '링갈 ' + (on ? 'ON (켜짐)' : 'OFF (꺼짐)');
  }

  function detach(b) {
    if (b.type === 'belt' || b.type === 'guardbelt') {
      const bc = beltGrid[b.row][b.col];
      if (bc) { if (bc.h === b) bc.h = null; if (bc.v === b) bc.v = null; if (!bc.h && !bc.v) beltGrid[b.row][b.col] = null; }
    } else if (isGrabberType(b.type)) {
      const { mid } = grabberRoles(b); if (occ[mid.r][mid.c] === b.id) occ[mid.r][mid.c] = null;
    } else {
      for (const cell of deviceCells(b)) if (inGrid(cell.c, cell.r) && occ[cell.r][cell.c] === b.id) occ[cell.r][cell.c] = null;
    }
    const i = S.buildings.indexOf(b); if (i >= 0) S.buildings.splice(i, 1);
    buildingById.delete(b.id);
  }

  function placeBelt(col, row, dir, type) {
    const beltType = type || 'belt';
    if (!isUnlocked(beltType)) return false;
    if (!canPlace(beltType, col, row, dir)) return false;
    const cost = buildCost(beltType);
    const oldRefund = beltRefundAt(col, row);
    if (S.money + oldRefund < cost) { G.UI.flash && G.UI.flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return false; }
    refund(oldRefund, 1);
    S.money -= cost;
    attach(startConstruction({ id: G.uid(), type: beltType, col, row, w: 1, h: 1, dir, cost }));
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('built:' + beltType);
    return true;
  }
  function beltRefundAt(c, r) {
    const bc = beltGrid[r][c]; if (!bc) return 0;
    let v = 0;
    if (bc.h) v += Math.floor((bc.h.cost || buildCost(bc.h.type)) * 0.75);
    if (bc.v && bc.v !== bc.h) v += Math.floor((bc.v.cost || buildCost(bc.v.type)) * 0.75);
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
  function placeDevice(type, col, row, dir, opts) {
    if (!isUnlocked(type)) return false;
    const fp0 = footprint(type, col, row, dir);
    for (const cell of fp0.cells) if (!inGrid(cell.c, cell.r)) return false;  // 격자 밖은 불가
    if (warehouseRedzoneBlocked(type, col, row, fp0.w, fp0.h)) {
      if (G.UI && G.UI.onRedzoneWarehouseBlocked) G.UI.onRedzoneWarehouseBlocked();
      return false;
    }
    if (G.DEVICES[type] && G.DEVICES[type].monument) {
      if (S.buildings.some(b => b.type === type)) { G.UI.flash && G.UI.flash('각 기념물은 한 번만 설치할 수 있습니다.'); return false; }
      const gridKey = landKeyForCell(col + 0.5, row + 0.5);
      if (S.buildings.some(b => G.DEVICES[b.type] && G.DEVICES[b.type].monument &&
          landKeyForCell(b.col + 0.5, b.row + 0.5) === gridKey)) {
        G.UI.flash && G.UI.flash('한 그리드에는 기념물을 하나만 설치할 수 있습니다.');
        return false;
      }
    }
    // 기본은 덮어쓰기 금지(점유 시 실패). 단, 분류기는 동종(분류기) 위에만 교체 허용.
    if (type === 'sorter') {
      const ids = new Set(); let blockedByOther = false;
      for (const cell of fp0.cells) { const id = occ[cell.r][cell.c]; if (id) { const ex = S.buildings.find(b => b.id === id); if (ex && ex.type === 'sorter') ids.add(id); else blockedByOther = true; } }
      const oldRefund = Array.from(ids).reduce((s, id) => {
        const b = S.buildings.find(x => x.id === id);
        return s + (b ? Math.floor((b.cost || buildCost(b.type, b.w, b.h)) * 0.75) : 0);
      }, 0);
      if (!blockedByOther && S.money + oldRefund < buildCost(type)) { G.UI.flash && G.UI.flash('돈 부족! (₩' + buildCost(type).toLocaleString() + ')'); return false; }
      if (!blockedByOther) ids.forEach(id => { const b = S.buildings.find(x => x.id === id); if (b) deleteBuilding(b); });
    }
    if (!canPlace(type, col, row, dir)) return false;
    const cost = buildCost(type);
    const scrapCost = buildScrapCost(type);
    const electronicPartsCost = buildElectronicPartsCost(type);
    const chaosMaggotCost = ['chaoscharge', 'chaosturret', 'wrongchaosmargot'].includes(type) ? 1 : 0;
    if (scrapCost && warehouseCount('철조각') < scrapCost) { G.UI.flash && G.UI.flash('철조각 부족! (' + scrapCost.toLocaleString() + '개 필요)'); return false; }
    if (electronicPartsCost && warehouseCount('전자부품') < electronicPartsCost) { G.UI.flash && G.UI.flash('전자부품 부족! (' + electronicPartsCost.toLocaleString() + '개 필요)'); return false; }
    if (chaosMaggotCost && warehouseCount('카오스 구더기') < chaosMaggotCost) { G.UI.flash && G.UI.flash('카오스 구더기 부족! (1개 필요)'); return false; }
    if (!spend(cost)) return false;
    if (scrapCost) takeWarehouse('철조각', scrapCost);
    if (electronicPartsCost) takeWarehouse('전자부품', electronicPartsCost);
    if (chaosMaggotCost) takeWarehouse('카오스 구더기', chaosMaggotCost);
    const fp = footprint(type, col, row, dir);
    const b = { id: G.uid(), type, col, row, w: fp.w, h: fp.h, dir, cost, scrapCost, electronicPartsCost, chaosMaggotCost };
    if (type === 'birthing') { b.worker = null; b.state = 'idle'; b.birthTimer = 0; b.lifeTimer = 0; }
    else if (type === 'reformer') { b.item = null; b.timer = 0; b.state = 'idle'; }
    else if (type === 'washbasin') { b.state = 'idle'; b.item = null; b.washTimer = 0; }
    else if (isGrabberType(type)) { b.holding = null; b.cd = 0; b.filter = []; }
    else if (type === 'sorter') { b.toggle = 0; b.filter = []; b.filterLane = 1; b.buffer = []; }
    else if (['slaughter', 'deshell', 'grinder'].includes(type)) { b.item = null; b.timer = 0; b.state = 'idle'; b.weight = 0; b.outputs = []; b.outBuffer = []; if (type === 'slaughter') b.sideOutputs = []; }
    else if (type === 'correction') { b.inmates = []; b.state = 'idle'; }
    else if (type === 'mixer') { b.slotMeat = null; b.unchiN = 0; b.slotAcid = null; b.foodN = 0; b.timer = 0; b.state = 'idle'; b.outBuffer = []; }
    else if (type === 'cookery') { b.mats = {}; b.seasoning = 0; b.cooking = null; b.timer = 0; b.state = 'idle'; b.outBuffer = []; }
    else if (type === 'acidgen') { b.item = null; b.output = null; b.timer = 0; b.acidTick = 0; b.acidProgress = 0; b.state = 'idle'; b.outBuffer = []; }
    else if (type === 'catcher') { b.filter = []; b.cd = 0; b.up = { range: 0 }; b.phase = 'idle'; b.arm = null; b.holding = null; b.target = null; }
    else if (type === 'skewer') { b.held = null; }
    else if (type === 'feeder') { b.feedType = '실장푸드'; }
    else if (type === 'driller') {
      const ctr = { gx: col + fp.w / 2, gy: row + fp.h / 2 };
      b.outBuffer = []; b.drillTargetId = null; b.drillPriorityId = null; b.drillCd = 0;
      b.drillHeadX = ctr.gx; b.drillHeadY = ctr.gy; b.state = 'idle';
    }
    else if (type === 'largewarehouse') {
      b.filter = []; b.outputCd = 0;
      if (S.difficulty === 'dokura') { b.inventory = {}; b.storageLevel = 0; }
    }
    else if (type === 'warehouse') {
      if (S.difficulty === 'dokura') { b.inventory = {}; b.storageLevel = 0; }
    }
    else if (type === 'techica') { b.worker = null; }
    else if (type === 'wrongchaosmargot') { b.mood = 1; b.moodT = 60; b.gachaRemaining = 0; b.gachaFeed = null; }
    else if (type === 'terrarium') { b.dnaStats = null; b.dnaSourceType = null; b.incubatorCreatures = []; b.incubatorUnchi = 0; b.incubatorBirthT = 0; b.feedType = '실장푸드'; }
    else if (type === 'lab') { b.workers = []; b.state = 'idle'; b.labLevel = 0; }
    else if (type === 'colony') { b.outBuffer = []; }
    else if (type === 'turret' || type === 'sniper' || type === 'mortar' || type === 'chaosturret') { b.cd = 0; b.up = { dmg: 0, rate: 0, range: 0 }; b.kills = 0; b.mode = 'raider'; b.aim = -Math.PI / 2; if (type === 'mortar') b.missileAmmo = 0; }
    else if (type === 'mine') { b.armed = true; speakFrom(b, G.LINES && G.LINES.mine, 2.2); b.talkT = 3 + Math.random() * 4; }
    else if (type === 'salecenter') { b.state = 'idle'; b.packT = 0; b.up = 0; }
    else if (type === 'packer') { b.state = 'idle'; b.minced = []; b.meat = []; b.scrapN = 0; }
    else if (type === 'tunnel' || type === 'crossbelt') { b.queue = []; }
    else if (POWER_PLANTS.has(type)) { b.state = 'idle'; b.worker = null; b.fuel = null; b.fuelT = 0; b.fuelMax = 0; b.chaosVictims = []; b.outBuffer = []; }
    else if (POWER_POLES.has(type)) { b.state = 'idle'; b.powered = false; }
    if (G.DEVICES[type].worker) b.workers = [];  // 일꾼 슬롯 (속도 부스트)
    // 복사/청사진 붙여넣기: 필터 설정 적용
    if (opts && (type === 'sorter' || isGrabberType(type) || type === 'catcher' || type === 'largewarehouse')) {
      if (Array.isArray(opts.filter)) b.filter = opts.filter.slice();
      if (opts.statFilter) b.statFilter = Object.assign({}, opts.statFilter);
      if (opts.filterLane != null && type === 'sorter') b.filterLane = opts.filterLane;
      if (opts.priority != null && isGrabberType(type)) b.priority = opts.priority;
    }
    attach(startConstruction(b));
    if (!S.buildInstallCounts) S.buildInstallCounts = {};
    S.buildInstallCounts[type] = (S.buildInstallCounts[type] || 0) + 1;
    if (electronicPartsCost && (type === 'driller' || type === 'firecharge')) renderMenuItems();
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('built:' + type);
    return true;
  }
  function chaosGateDir(a, b) {
    const dx = b.col - a.col, dy = b.row - a.row;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
    return dy >= 0 ? 2 : 0;
  }
  function placeChaosGate(a, z) {
    if (!a || !z || !isUnlocked('chaosgate')) return false;
    if (!inGrid(a.col, a.row) || !inGrid(z.col, z.row) || !isOwnedCell(a.col, a.row) || !isOwnedCell(z.col, z.row)) return false;
    if (Math.abs(z.col - a.col) > 48 || Math.abs(z.row - a.row) > 48) {
      G.UI.flash && G.UI.flash('카오스 게이트 최대 연결 범위는 48×48입니다.');
      return false;
    }
    if ((a.col === z.col && a.row === z.row) || occAt(a.col, a.row) || occAt(z.col, z.row) || hasBelt(a.col, a.row) || hasBelt(z.col, z.row)) return false;
    const cost = buildCost('chaosgate');
    if (warehouseCount('카오스 구더기') < 1) { G.UI.flash && G.UI.flash('카오스 구더기 부족! (1개 필요)'); return false; }
    if (!spend(cost)) return false;
    takeWarehouse('카오스 구더기', 1);
    const b = {
      id: G.uid(), type: 'chaosgate', col: a.col, row: a.row, w: 1, h: 1,
      dir: chaosGateDir(a, z), gateA: { c: a.col, r: a.row }, gateB: { c: z.col, r: z.row },
      gateAngle: Math.atan2(z.row - a.row, z.col - a.col),
      cost, chaosMaggotCost: 1, queue: [],
    };
    attach(startConstruction(b));
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('built:chaosgate');
    G.Assets.playSfx('place');
    return true;
  }
  function straightTransportEnd(a, z, maxDistance) {
    const dc = z.col - a.col, dr = z.row - a.row;
    const horizontal = Math.abs(dc) >= Math.abs(dr);
    const distance = Math.max(1, Math.min(maxDistance, horizontal ? Math.abs(dc) : Math.abs(dr)));
    return horizontal
      ? { col: a.col + Math.sign(dc || 1) * distance, row: a.row }
      : { col: a.col, row: a.row + Math.sign(dr || 1) * distance };
  }
  function placeCrossbelt(a, rawEnd) {
    if (!a || !rawEnd || !isUnlocked('crossbelt')) return false;
    const z = straightTransportEnd(a, rawEnd, CROSSBELT_MAX_DISTANCE);
    if (!inGrid(a.col, a.row) || !inGrid(z.col, z.row)) return false;
    if (!isOwnedCell(a.col, a.row) || !isOwnedCell(z.col, z.row)) return false;
    if (occAt(a.col, a.row) || occAt(z.col, z.row) || hasBelt(a.col, a.row) || hasBelt(z.col, z.row)) return false;
    const cost = buildCost('crossbelt');
    if (!spend(cost)) return false;
    const dir = chaosGateDir(a, z);
    const b = {
      id: G.uid(), type: 'crossbelt', col: a.col, row: a.row, w: 1, h: 1, dir,
      gateA: { c: a.col, r: a.row }, gateB: { c: z.col, r: z.row },
      cost, queue: [],
    };
    attach(startConstruction(b));
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('built:crossbelt');
    G.Assets.playSfx('place');
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
    S.wanderers.push({
      data, gx: clamp(gx, 0.5, COLS - 0.5), gy: clamp(gy, 0.5, ROWS - 0.5),
      vx: Math.cos(a), vy: Math.sin(a), t: 0.4 + Math.random(), boardCd: boardCd || 0,
      wild: !!(data && data.externalOrigin),
    });
  }
  function enforceLaborLimit() {
    const limit = laborLimit();
    const workers = S.wanderers.filter(w => w.data && w.data.labor);
    for (let i = workers.length - 1; i >= limit; i--) {
      const w = workers[i];
      w.data.labor = false; w.data.laborMode = 'free'; w.data.carry = null;
      G.Creatures.becomeDokura(w.data, '독라');
    }
  }
  function deleteBuilding(b) {
    if (b.colony || b.type === 'colony') { G.UI.flash && G.UI.flash('콜로니 센터는 철거할 수 없습니다'); return; }   // 철거 불가
    if (b.fixedEnvironment) { G.UI.flash && G.UI.flash('환경 고정 시설은 철거할 수 없습니다'); return; }
    if (G.DEVICES[b.type] && G.DEVICES[b.type].monument) { G.UI.flash && G.UI.flash('기념물은 철거할 수 없습니다. 이동만 가능합니다.'); return; }
    refund(b.cost || buildCost(b.type, b.w, b.h));
    if (b.scrapCost) {
      if (!S.warehouse['철조각']) S.warehouse['철조각'] = [];
      const returned = Math.floor(b.scrapCost * 0.75);
      for (let i = 0; i < returned; i++) S.warehouse['철조각'].push(resourceCargoData('철조각'));
    }
    if (b.electronicPartsCost) {
      if (!S.warehouse['전자부품']) S.warehouse['전자부품'] = [];
      const returned = Math.floor(b.electronicPartsCost * 0.75);
      for (let i = 0; i < returned; i++) S.warehouse['전자부품'].push(resourceCargoData('전자부품'));
    }
    if (b.chaosMaggotCost) {
      if (!S.warehouse['카오스 구더기']) S.warehouse['카오스 구더기'] = [];
      for (let i = 0; i < b.chaosMaggotCost; i++) S.warehouse['카오스 구더기'].push(resourceCargoData('카오스 구더기'));
    }
    const ctr = buildingCenter(b);
    const release = (d) => { if (d && !d.isProduct && G.CREATURES[d.type]) spawnWanderer(d, ctr.gx + (Math.random() - 0.5), ctr.gy + (Math.random() - 0.5)); };
    if (b.type === 'lab') {
      const n = b.workers ? b.workers.length : 0;
      for (let i = 0; i < n; i++) {
        const data = G.Creatures.makeProduct('분쇄육', { stats: { 육질: 0, 개념: 0, 크기: 0 } });
        const dc = (i % 3) - 1, dr = Math.floor(i / 3) - 1;
        S.cargo.push(makeCargo(data, clamp(Math.floor(ctr.gx) + dc, 0, COLS - 1), clamp(Math.floor(ctr.gy) + dr, 0, ROWS - 1)));
      }
      b.workers = [];
      if (n && G.UI.flash) G.UI.flash('연구소 장착 개체 ' + n + '마리 → 분쇄육 ' + n + '개');
    }
    if (b.type === 'chaoscharge' && b.chaosVictims && b.chaosVictims.length) {
      const n = b.chaosVictims.length;
      b.chaosVictims.forEach(v => chaosVictimToMinced(b, v));
      b.chaosVictims = [];
      b.chaosStarted = false;
      b.chaosVictimT = 0;
      if (G.UI.flash) G.UI.flash('카오스 발전소 제물 ' + n + '마리 → 분쇄육 ' + n + '개');
    }
    if (b.type === 'mortar' && (b.missileAmmo || 0) > 0) {
      for (let i = 0; i < b.missileAmmo; i++) {
        S.cargo.push(makeCargo(resourceCargoData('구더기 탄도미사일'), Math.floor(ctr.gx), Math.floor(ctr.gy)));
      }
      b.missileAmmo = 0;
    }
    if (b.inventory && typeof b.inventory === 'object') {
      let i = 0;
      for (const type of Object.keys(b.inventory)) {
        for (const data of (b.inventory[type] || [])) {
          S.cargo.push(makeCargo(data, Math.floor(ctr.gx) + (i % 3) - 1, Math.floor(ctr.gy) + Math.floor(i / 3)));
          i++;
        }
      }
      b.inventory = {};
    }
    // 집게: 들고 있던 것만 처리(겹친 칸의 화물은 건드리지 않음)
    if (isGrabberType(b.type)) { release(b.holding); detach(b); return; }
    release(b.worker); release(b.item); release(b.holding); release(b.teacher); release(b.fuel);
    release(b.slotMeat); release(b.slotUnchi); release(b.held);
    if (b.buffer) b.buffer.forEach(release);
    if (b.workers) b.workers.forEach(release);     // 일꾼도 배회로 방출
    if (b.inmates) b.inmates.forEach(release);     // 교정시설 수용 개체 방출
    if (b.type === 'terrarium') b.incubatorCreatures = []; // 철거 시 내부 개체는 전부 소멸
    else if (b.incubatorCreatures) b.incubatorCreatures.forEach(release);
    if (b.queue) b.queue.forEach(q => release(q.data)); // 터널 내 화물(생물) 방출
    if (b.creatures) b.creatures.forEach(release); // 우리 삭제 → 안의 실장석 배회
    // 셀 위 화물 중 생물은 배회, 그 외(생산품)는 폐기
    const cells = footprintCellsOf(b);
    const keyset = new Set(cells.map(c => c.c + ',' + c.r));
    S.cargo = S.cargo.filter(cg => {
      if (keyset.has(Math.floor(cg.gx) + ',' + Math.floor(cg.gy))) { cg._dead = true; release(cg.data); return false; }
      return true;
    });
    detach(b);
    // inPen 장치가 우리 위에 있었으면 그 칸을 우리에게 되돌려줌
    if (G.DEVICES[b.type] && G.DEVICES[b.type].inPen) restorePenOcc(b.col, b.row);
    if (b.type === 'reformer') enforceLaborLimit();
  }
  function destroyBuildingNoRefund(b) {
    detach(b);
    if (G.DEVICES[b.type] && G.DEVICES[b.type].inPen) restorePenOcc(b.col, b.row);
  }
  // 특정 칸을 덮는 우리가 있으면 occ를 그 우리로 복원(inPen 장치 제거 후)
  function restorePenOcc(c, r) {
    if (!inGrid(c, r) || occ[r][c]) return;
    for (const pen of G.Pens.allPens()) {
      if (penAbsCells(pen).some(cell => cell.c === c && cell.r === r)) { occ[r][c] = pen.id; return; }
    }
  }
  // 바닥에 떨어진 화물/배회 개체를 해당 칸에서 제거
  function deleteFloorAt(cell) {
    let removed = 0;
    S.cargo = S.cargo.filter(cg => { if (Math.floor(cg.gx) === cell.col && Math.floor(cg.gy) === cell.row) { cg._dead = true; removed++; return false; } return true; });
    S.wanderers = S.wanderers.filter(w => { if (!w.invade && Math.floor(w.gx) === cell.col && Math.floor(w.gy) === cell.row) { removed++; return false; } return true; });
    if (removed) G.Assets.playSfx('remove');
  }
  function storeNearbyCargo() {
    let best = null, bd = Infinity;
    for (const cg of S.cargo) {
      if (cg._dead || G.CREATURES[cg.data.type]) continue;
      const d = Math.hypot(cg.gx - mouseGX, cg.gy - mouseGY);
      if (d < bd) { bd = d; best = cg; }
    }
    if (!best || bd > 0.9) { if (G.UI.flash) G.UI.flash('근처에 창고로 보낼 화물 없음'); return; }
    if (!warehouseIntake(best.data, null)) {
      if (G.UI.flash) G.UI.flash('콜로니센터 인벤토리가 가득 찼습니다.');
      return;
    }
    best._dead = true;
    S.cargo = S.cargo.filter(cg => cg !== best);
    G.Assets.playSfx('click');
    if (G.UI.flash) G.UI.flash(best.data.type + ' 창고 입고');
  }
  function deleteSelection() {
    closeAuxPanels();
    if (doorSelection.length) {
      refund(G.BUILD_COST.door || 500);   // 문 1개(그룹) 환불
      doorSelection.forEach(k => { delete S.doors[k]; });
      doorSelection = [];
      G.Assets.playSfx('remove');
      return;
    }
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
    if (builds.some(b => b.fixedEnvironment)) { G.UI.flash && G.UI.flash('환경 고정 시설은 이동할 수 없습니다'); return; }
    if (builds.some(b => b.type === 'chaosgate' || b.type === 'crossbelt')) { G.UI.flash && G.UI.flash('입구와 출구가 있는 운송 장치는 철거 후 다시 설치해야 합니다.'); return; }
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
    const monumentGrids = new Set();
    const ok = targets.every(t => {
      if (!canPlaceMoved(t.m.b, t.col, t.row)) return false;
      if (!(G.DEVICES[t.m.b.type] && G.DEVICES[t.m.b.type].monument)) return true;
      const key = landKeyForCell(t.col + 0.5, t.row + 0.5);
      if (monumentGrids.has(key)) return false;
      monumentGrids.add(key);
      return true;
    });
    if (!ok) { G.Assets.playSfx('remove'); return; }
    targets.forEach(t => { t.m.b.col = t.col; t.m.b.row = t.row; attach(t.m.b); });
    moveMode = false; moving = []; G.Assets.playSfx('place');
    setStatus('이동 완료.');
  }
  function canPlaceMoved(b, col, row) {
    if (b.type !== 'penbox') return canPlace(b.type, col, row, b.dir);
    for (const cell of penAbsCells(b, col, row)) {
      if (!isOwnedCell(cell.c, cell.r) || occAt(cell.c, cell.r) || hasBelt(cell.c, cell.r)) return false;
    }
    return true;
  }
  function centeredOriginFor(type, center, dir) {
    const fp = footprint(type, 0, 0, dir);
    return { col: center.c - Math.floor((fp.w - 1) / 2), row: center.r - Math.floor((fp.h - 1) / 2) };
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
    if (b && b.fixedEnvironment) { G.UI.flash && G.UI.flash('환경 고정 시설은 회전할 수 없습니다'); return; }
    if (!b || !G.DEVICES[b.type] || !G.DEVICES[b.type].rotatable) return;
    const od = b.dir, ow = b.w, oh = b.h, oc = b.col, or = b.row;
    const center = isGrabberType(b.type) ? grabberRoles(b).mid : null;
    detach(b);
    b.dir = (b.dir + 1) % 4;
    if (isGrabberType(b.type)) {
      const o = centeredOriginFor(b.type, center, b.dir);
      b.col = o.col; b.row = o.row;
    }
    if (b.type !== 'penbox') { const fp = footprint(b.type, b.col, b.row, b.dir); b.w = fp.w; b.h = fp.h; }
    if (canPlace(b.type, b.col, b.row, b.dir)) { attach(b); G.Assets.playSfx('rotate'); }
    else { b.dir = od; b.w = ow; b.h = oh; b.col = oc; b.row = or; attach(b); }
  }

  /* ---- 선택 ----------------------------------------------------------- */
  function buildingAtCell(cell) {
    const d = deviceAt(cell.col, cell.row);
    if (d) return d;
    const bc = beltCell(cell.col, cell.row);
    if (bc && (bc.h || bc.v)) return bc.h || bc.v;
    // 집게 끝(○/▷)은 occ에 없으므로 별도 탐색
    for (const b of S.buildings) if (isGrabberType(b.type)) {
      const g = grabberRoles(b);
      if ([g.pickup, g.mid, g.drop].some(c => c.c === cell.col && c.r === cell.row)) return b;
    }
    for (const b of S.buildings) {
      if (b.type === 'skewer' && cell.col === b.col && cell.row >= b.row - 1 && cell.row <= b.row) return b;
    }
    return null;
  }
  function workerAtCell(cell) {
    if (!cell) return null;
    let best = null, bd = Infinity;
    for (const w of S.wanderers) {
      if (!w.data || !w.data.labor || w._dead) continue;
      const d = Math.hypot(w.gx - (cell.col + 0.5), w.gy - (cell.row + 0.5));
      if (Math.floor(w.gx) === cell.col && Math.floor(w.gy) === cell.row && d < bd) { bd = d; best = w; }
    }
    return best;
  }
  function workersInRect(a, b) {
    const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
    const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
    return S.wanderers.filter(w => w.data && w.data.labor && !w._dead &&
      Math.floor(w.gx) >= minC && Math.floor(w.gx) <= maxC &&
      Math.floor(w.gy) >= minR && Math.floor(w.gy) <= maxR
    ).map(w => w.data);
  }
  function selectAt(cell, clientX, clientY) {
    allowAuxPanels();
    if (!cell) { S.selection = []; wallSelection = []; doorSelection = []; selectedWorkers = []; closeAuxPanels(); return; }
    const worker = workerAtCell(cell);
    if (worker) {
      S.selection = []; wallSelection = []; doorSelection = []; selectedWorkers = [worker.data];
      showLaborPanel(worker.data, clientX, clientY);
      return;
    }
    const b = buildingAtCell(cell);
    S.selection = b ? [b.id] : [];
    wallSelection = []; doorSelection = []; selectedWorkers = [];
    if (b) selectedPenCreature = null;
    if (b && clientX != null && clientY != null) {
      if (b.type === 'wrongchaosmargot' && b.gachaRemaining > 0) clickWrongChaosGacha(b);
      if (b.type === 'warehouse' || b.type === 'largewarehouse') openWarehouseInventory(b);
      else if (b.type === 'colony') { playerInventoryEl.style.display = 'flex'; renderInventoryPanels(true); }
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
    selectedWorkers = workersInRect(a, b);
    if (selectedWorkers.length) {
      S.selection = [];
      if (selectedWorkers.length === 1) showLaborPanel(selectedWorkers[0], null, null);
    }
    wallSelection = wallsInRect(a, b);
    doorSelection = doorsInRect(a, b);
    filterPanelSuppressedKey = S.selection.join('|');
  }
  function selectSameType(cell) {
    allowAuxPanels();
    closeAuxPanels();
    const b = buildingAtCell(cell);
    wallSelection = [];
    selectedWorkers = [];
    if (!b) { S.selection = []; filterPanelSuppressedKey = ''; return; }
    S.selection = S.buildings.filter(x => x.type === b.type).map(x => x.id);
    filterPanelSuppressedKey = S.selection.join('|');
  }

  /* ---- 투입 (드래그/집게 공용) --------------------------------------- */
  function dropInto(dev, data, entryCell) {
    const ok = dropIntoCore(dev, data, entryCell);
    // 운반 중이던 노동석이 장치/우리에 들어가면 들고 있던 것을 장치 옆에 내려놓음(유실 방지)
    if (ok && data && data.labor && data.carry) {
      const c = data.carry; data.carry = null;
      const ctr = buildingCenter(dev);
      if (c.kind === 'creature') spawnWanderer(c.data, ctr.gx, ctr.gy, 1.0);
      else laborCargoItems(c).forEach((it, i) => S.cargo.push(makeCargo(it, Math.floor(ctr.gx + (i % 2) * 0.2), Math.floor(ctr.gy + Math.floor(i / 2) * 0.2))));
    }
    return ok;
  }
  function dropIntoCore(dev, data, entryCell) {
    if (!dev) return false;
    if (isConstructing(dev)) return false;
    if (dev.type === 'chaosgate' && (!dev.powerConnected || !dev.powered)) return false;
    const def = G.DEVICES[dev.type];
    const isAdult = G.CREATURES[data.type] && G.CREATURES[data.type].isAdult;
    switch (dev.type) {
      case 'launchpad': {
        const e = endingState();
        if (!e.accepted || (e.stage !== 1 && e.stage !== 2) || !data) return false;
        const amount = Math.max(1, data.amount || 1);
        if (data.type === '철조각') {
          if (e.scrap >= endingNeed().scrap || amount > endingNeed().scrap - e.scrap) return false;
          e.scrap += amount; return true;
        }
        if (e.stage !== 1) return false;
        if (data.type === '전자부품') {
          if ((e.electronics || 0) >= endingNeed().electronics || amount > endingNeed().electronics - (e.electronics || 0)) return false;
          e.electronics = (e.electronics || 0) + amount; return true;
        }
        if (data.type === '초고농축운치') {
          if (e.concentrate >= endingNeed().concentrate || amount > endingNeed().concentrate - e.concentrate) return false;
          e.concentrate += amount; return true;
        }
        if (ENDING_PRODUCTS.has(data.type)) {
          if (e.products >= endingNeed().products || amount > endingNeed().products - e.products) return false;
          e.products += amount; return true;
        }
        return false;
      }
      case 'birthing':
        if (!dev.worker && isAdult) {
          dev.worker = data; dev.state = 'producing'; dev.birthTimer = 0; dev.lifeTimer = 0;
          if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('loaded:birthing');
          playDeviceSfx('birth', dev); return true;
        }
        return false;
      case 'washbasin':
        if (data.type === '점액덩어리' && accepts(def, data.type) && !dev.item) { dev.item = data; dev.washTimer = 0; dev.state = 'producing'; return true; }
        return addWorker(dev, data);
      case 'slaughter': case 'deshell':
        if (accepts(def, data.type) && !dev.item && (dev.type === 'deshell' || outRoom(dev) > 0)) {
          dev.item = data; dev.timer = 0; dev.state = 'producing';
          processorIntakeSpeech(dev, data);
          return true;
        }
        return addWorker(dev, data);
      case 'correction':
        if (data.type === '사육실장' && !dev.teacher) { dev.teacher = data; return true; }
        if (accepts(def, data.type) && (dev.inmates ? dev.inmates.length : 0) < def.hold) { if (!dev.inmates) dev.inmates = []; dev.inmates.push(data); return true; }
        return false;
      case 'grinder':
        if (accepts(def, data.type) && !dev.item && outRoom(dev) > 0) {
          dev.item = data; dev.timer = 0; dev.state = 'producing';
          processorIntakeSpeech(dev, data);
          return true;
        }
        return false;
      case 'reformer':
        if (data.type === '독라' && !data.labor && !dev.item && S.wanderers.filter(w => w.data && w.data.labor).length < laborLimit()) { dev.item = data; dev.timer = 0; dev.state = 'producing'; return true; }
        return false;
      case 'sorter':
        if (!dev.buffer) dev.buffer = [];
        if (dev.buffer.length < SORTER_BUF) { dev.buffer.push(data); return true; }
        return false;
      case 'mixer': {
        const conc = C.MIX_CONCENTRATE || 5;
        if (data.type === '분쇄육' && !dev.slotMeat) { dev.slotMeat = data; return true; }
        if (data.type === '운치' && (dev.unchiN || 0) < C.MIX_UNCHI) { dev.unchiN = Math.min(C.MIX_UNCHI, (dev.unchiN || 0) + (data.amount || 1)); return true; }
        if (data.type === '짓소산' && !dev.slotAcid) { dev.slotAcid = data; return true; }
        if (data.type === '조미료' && !dev.slotSeasoning) { dev.slotSeasoning = data; return true; }  // 우마이푸드 재료
        if (data.type === '철조각' && !dev.slotScrap) { dev.slotScrap = data; return true; }          // 다이어트푸드 재료
        if (data.type === '농축운치' && (dev.cA || 0) < conc) { dev.cA = (dev.cA || 0) + (data.amount || 1); return true; }   // → 고농축운치
        if (data.type === '고농축운치' && (dev.cB || 0) < conc) { dev.cB = (dev.cB || 0) + (data.amount || 1); return true; } // → 초고농축운치
        if (data.type === '실장푸드' && (dev.foodN || 0) < (C.MIX_FOOD_NEED || 50)) { dev.foodN = Math.min(C.MIX_FOOD_NEED || 50, (dev.foodN || 0) + (data.amount || 1)); return true; }
        return addWorker(dev, data);
      }
      case 'cookery':
        if (data.type === '조미료') {
          const amount = Math.max(1, data.amount || 1);
          if ((dev.seasoning || 0) + amount > (C.SEASONING_MAX || 200)) return false;
          dev.seasoning = (dev.seasoning || 0) + amount;
          playDeviceSfx('click', dev);
          return true;
        }
        if (accepts(def, data.type)) {   // 메뉴 재료 비축(잘못된 재료여도 받아두되, 선택 메뉴가 충족돼야 조리)
          if (!dev.mats) dev.mats = {};
          if (!dev.matStats) dev.matStats = {};
          if (!Array.isArray(dev.matStats[data.type])) dev.matStats[data.type] = [];
          dev.mats[data.type] = (dev.mats[data.type] || 0) + 1;
          dev.matStats[data.type].push(Object.assign({ 육질: 0, 개념: 0, 크기: 0 }, data.stats || {}));
          return true;
        }
        return addWorker(dev, data);
      case 'acidgen':
        if (data.type === '성체실장' && !dev.item && !dev.output) { dev.item = data; dev.timer = 0; dev.state = 'producing'; return true; }
        return false;
      case 'skewer':
        if ((data.type === '자실장' || data.type === '성체실장') && !dev.held) { dev.held = data; dev.heldT = 0; return true; } // 자실장/성체실장만 꽂음
        return false;
      case 'techica':
        if (dev.output) return false;
        if (data.type === '새끼사육실장' && !dev.worker) { dev.worker = data; dev.workT = 0; return true; }  // 사육실장 새끼만 장착
        return false;
      case 'terrarium':
        if (!['성체실장', '사육실장', '독라'].includes(data.type)) return false;
        dev.dnaStats = Object.assign({}, data.stats || { 육질: 10, 개념: 10, 크기: 10 });
        dev.dnaSourceType = data.type;
        dev.incubatorBirthT = 0;
        dev.speech = '몸이 녹아내리는데스으읏!';
        dev.speechT = 2.8;
        dev.speechTone = '데스데스';
        for (let i = 0; i < 30; i++) spawnParticle((dev.col + dev.w / 2) * CELL, (dev.row + dev.h / 2) * CELL, i % 2 ? '#a7e47c' : '#c98cff');
        playWorldSfx('remove', dev.col + dev.w / 2, dev.row + dev.h / 2, { force: true, volume: 0.55 });
        return true;
      case 'mortar':
        if (data.type === '구더기 탄도미사일' && (dev.missileAmmo || 0) < 5) {
          dev.missileAmmo = (dev.missileAmmo || 0) + 1;
          playDeviceSfx('click', dev);
          return true;
        }
        return false;
      case 'lab':
        if (G.CREATURES[data.type] && dev.workers && dev.workers.length < (C.LAB_SLOTS || 8)) { dev.workers.push(data); return true; }
        return false;
      case 'salecenter':
        if (canPackerSell(data)) { sellCargo(data, dev); dev.state = 'producing'; dev.packT = 0.35; return true; }
        return false;
      case 'jisoucharge':
        if (data.type === '성체실장' && !dev.worker) { dev.worker = data; dev.state = 'producing'; return true; }
        return false;
      case 'firecharge': {
        const t = C.FIRE_FUEL_TIME && C.FIRE_FUEL_TIME[data.type];
        if (t && !dev.fuel && !dev.fuelT) { dev.fuel = data; dev.fuelT = t; dev.fuelMax = t; dev.state = 'producing'; return true; }
        return false;
      }
      case 'chaoscharge': {
        if (data.type === '성체실장' && (!dev.chaosVictims || dev.chaosVictims.length < 12)) {
          if (!dev.chaosVictims) dev.chaosVictims = [];
          dev.chaosVictims.push(data);
          if (dev.chaosVictims.length >= 12) dev.chaosStarted = true;
          dev.state = isPowerPlantActive(dev) ? 'producing' : 'ready';
          return true;
        }
        const t = C.CHAOS_FUEL_TIME && C.CHAOS_FUEL_TIME[data.type];
        if (t && !dev.fuel && !dev.fuelT) { dev.fuel = data; dev.fuelT = t; dev.fuelMax = t; dev.state = isPowerPlantActive(dev) ? 'producing' : 'ready'; return true; }
        return false;
      }
      case 'packer':   // 포장기(가공): 분쇄육+철조각→통조림 / 실장육+철조각→진공포장 / 수산물+철조각→참치 통조림
        if (data.type === '철조각') { dev.scrapN = (dev.scrapN || 0) + (data.amount || 1); return true; }
        if (data.type === '분쇄육') { (dev.minced = dev.minced || []).push(data); return true; }
        if (data.type === '실장육') { (dev.meat = dev.meat || []).push(data); return true; }
        if (data.type === '수산물') { (dev.seafood = dev.seafood || []).push(data); return true; }
        return false;
      case 'tunnel': case 'crossbelt': case 'chaosgate':
        if (dev.type === 'chaosgate') {
          const e = transportEnds(dev);
          if (!entryCell || entryCell.c !== e.back.c || entryCell.r !== e.back.r) return false;
          if (!chaosGateExitAvailable(dev, data)) return false;
          return emitAtCell(e.exit, data);
        }
        if (dev.type === 'crossbelt') {
          const e = transportEnds(dev);
          if (!entryCell || entryCell.c !== e.back.c || entryCell.r !== e.back.r) return false;
          if (!transportExitAvailable(dev, data)) return false;
          return emitAtCell(e.exit, data);
        }
        if (emitAtCell(transportEnds(dev).exit, data)) return true;
        if (!dev.queue) dev.queue = [];
        if (dev.queue.length < C.TUNNEL_CAP) { dev.queue.push({ data: data, t: 0 }); return true; }
        return false;
      case 'penbox':
        if (G.CREATURES[data.type]) {
          const added = G.Pens.addToPen(dev, data, entryCell);
          if (added && G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('penReceived:' + data.type);
          return added;
        }
        return false;
      case 'warehouse': case 'largewarehouse': case 'colony':
        if (G.CREATURES[data.type]) return false; // 생물은 창고에 안 들어감
        return warehouseIntake(data, dev);
      default: return false;
    }
  }
  function statValue(data, stat) {
    const v = data && data.stats && data.stats[stat];
    return Number.isFinite(+v) ? +v : 0;
  }
  function rankedStatOp(op) {
    return op === 'max' || op === 'min';
  }
  function filterTypeOK(b, data) {
    if (!data || !data.type) return false;
    const f = b.filter || [];
    return !f.length || f.includes(data.type);
  }
  function statFilterBasicOK(sf, data) {
    if (!sf || !sf.stat) return true;
    const v = statValue(data, sf.stat);
    if (sf.op === '<=') return v <= sf.value;
    if (sf.op === '==') return Math.floor(v) === Math.floor(sf.value);
    if (sf.op === '!=') return v !== sf.value;
    if (rankedStatOp(sf.op)) return true;
    return v >= sf.value;
  }
  function rankedPool(b, pool) {
    const sf = b.statFilter;
    if (!sf || !sf.stat || !rankedStatOp(sf.op)) return null;
    const list = (pool || []).filter(data => filterTypeOK(b, data) && data && data.stats);
    if (!list.length) return null;
    let best = statValue(list[0], sf.stat);
    for (const data of list) {
      const v = statValue(data, sf.stat);
      best = sf.op === 'min' ? Math.min(best, v) : Math.max(best, v);
    }
    return { stat: sf.stat, value: best };
  }
  // 필터 일치 판정: 타입 필터 + 스탯 조건(이상/이하/제외/최고/최저) 모두 만족
  function matchItem(b, data, pool) {
    const typeOK = filterTypeOK(b, data);
    const sf = b.statFilter;
    let statOK = statFilterBasicOK(sf, data);
    if (typeOK && sf && sf.stat && rankedStatOp(sf.op)) {
      const rank = rankedPool(b, (pool && pool.length) ? pool : [data]);
      statOK = !!rank && data && data.stats && statValue(data, sf.stat) === rank.value;
    }
    return typeOK && statOK;
  }
  function resourceCargoData(type) {
    const amount = (type === '실장푸드' || type === '짓소산 푸드') ? 50 : (type === '운치' ? (C.UNCHI_BUNDLE || 10) : (type === '조미료' ? 10 : 1));
    return { id: G.uid(), type, isProduct: false, amount, stats: { 크기: (G.PRODUCTS[type] && G.PRODUCTS[type].size) || 0 } };
  }
  // 운치는 상한에 도달해도 창고 입고 자체는 계속 성공한다.
  // 초과분은 물류 적체를 막기 위해 소모하고, 표시 재고는 최대값으로 유지한다.
  function storeUnchi(amount) {
    S.unchi = Math.min(unchiMax(), Math.max(0, S.unchi || 0) + Math.max(0, amount || 0));
    return true;
  }
  function makeSpecialTreatCargo(type) {
    return { id: G.uid(), type, isProduct: false, amount: 1, stats: { 크기: 0 } };
  }
  function outBuffer(b) {
    if (!b.outBuffer) b.outBuffer = [];
    return b.outBuffer;
  }
  function deviceBufferCapacity(b) { return b && b.type === 'driller' ? 100 : 10; }
  function outRoom(b) { return deviceBufferCapacity(b) - outBuffer(b).length; }
  function bufferCargo(b, data) {
    if (!data || G.CREATURES[data.type] || outRoom(b) <= 0) return false;
    outBuffer(b).push(data);
    recordProducedCargo(b, data);
    const effects = environmentEffectsForBuilding(b);
    if (data.isProduct && effects.extraProductChance && Math.random() < effects.extraProductChance && outRoom(b) > 0) {
      const extra = Object.assign({}, data, { id: G.uid(), stats: Object.assign({}, data.stats || {}) });
      outBuffer(b).push(extra);
      recordProducedCargo(b, extra);
    }
    return true;
  }
  function bufferMany(b, list) {
    if (!list || !list.length) return true;
    const buf = outBuffer(b);
    if (buf.length >= 10) return false;
    // 생산 1회의 산출 묶음은 상한을 넘어도 전부 보존한다.
    // 초과 적체가 10개 미만으로 내려오기 전까지 장치가 새 재료를 받지 않는다.
    const effects = environmentEffectsForBuilding(b);
    for (const data of list) if (data && !G.CREATURES[data.type]) {
      buf.push(data); recordProducedCargo(b, data);
      if (data.isProduct && effects.extraProductChance && Math.random() < effects.extraProductChance) {
        const extra = Object.assign({}, data, { id: G.uid(), stats: Object.assign({}, data.stats || {}) });
        buf.push(extra); recordProducedCargo(b, extra);
      }
    }
    return true;
  }
  function achievementStats() {
    if (!S.achievementStats) S.achievementStats = { pets: 0, creatures: 0, labor: 0, meat: 0, products: 0, chaosMaggots: 0, powerUsed: 0, unchi: 0, productTypes: {} };
    if (!S.achievementStats.productTypes) S.achievementStats.productTypes = {};
    return S.achievementStats;
  }
  function recordProducedCargo(b, data) {
    if (!data) return;
    const a = achievementStats(), n = Math.max(1, data.amount || 1);
    if (data.type === '실장육') a.meat += n;
    if (data.isProduct) { a.products += n; a.productTypes[data.type] = true; }
  }
  function recordCreatureProduced(data) {
    const a = achievementStats();
    a.creatures++;
    if (data && (data.type === '사육실장' || data.type === '새끼사육실장')) a.pets++;
  }
  const MONUMENT_ACHIEVEMENTS = [
    ['relic_techica', a => a.pets >= 100],
    ['relic_arts', a => a.creatures >= 1000],
    ['relic_slave', a => a.labor >= 50],
    ['relic_sister', a => a.meat >= 1000],
    ['relic_dainagon', a => a.products >= 10000],
    ['relic_bigmargot', a => a.chaosMaggots >= 3],
    ['relic_home', a => a.powerUsed >= 1000],
    ['relic_candy', a => ENDING_PRODUCTS.size && Array.from(ENDING_PRODUCTS).every(t => a.productTypes[t])],
    ['relic_margot', a => a.unchi >= 100000],
  ];
  function tickMonumentAchievements() {
    if (G.dialogPaused) return;
    const a = achievementStats();
    if (!S.monumentsUnlocked) S.monumentsUnlocked = {};
    if (!S.monumentsNotified) S.monumentsNotified = {};
    if (S.monumentIntroShown == null) S.monumentIntroShown = Object.keys(S.monumentsNotified).length > 0;
    for (const [type, done] of MONUMENT_ACHIEVEMENTS) {
      if (S.monumentsUnlocked[type] || !done(a)) continue;
      S.monumentsUnlocked[type] = true;
      renderMenuItems();
      G.UI.flash && G.UI.flash('업적 달성: ' + G.DEVICES[type].name + ' 기념물 개방!');
      if (!S.monumentsNotified[type] && G.UI && G.UI.midoriRadio) {
        S.monumentsNotified[type] = true;
        if (!S.monumentIntroShown) {
          S.monumentIntroShown = true;
          G.UI.midoriRadio([
            '축하해, 공장장! 우리가 업적을 세워서 44방공호에서 기념물을 보내줬어.',
            '공짜로 해당 그리드 전체에 추가 버프를 주는 거니까 꼭 설치하라구.',
            '단, 그리드 당 하나밖에 설치못하고, 한번 지으면 옮기는 건 할 수 있지만 철거는 못해.',
            '그러니까 해당 그리드에 특화된 기념물을 짓는게 좋겠지?',
          ], { emotion: 'laugh' });
        } else {
          G.UI.midoriRadio([
            '또 하나의 기념물을 획득했어, 공장장!',
            '이대로 계속 가자구~!',
          ], { emotion: 'laugh' });
        }
      }
      break;
    }
  }
  function extractFromDevice(dev, b) {
    if (dev.type === 'terrarium') {
      const filter = b.filter || [];
      const bundle = C.UNCHI_BUNDLE || 10;
      if (filter.includes('운치') && (dev.incubatorUnchi || 0) >= bundle) {
        dev.incubatorUnchi -= bundle;
        return resourceCargoData('운치');
      }
      const list = dev.incubatorCreatures || (dev.incubatorCreatures = []);
      const idx = list.findIndex(data => matchItem(b, data, list));
      return idx >= 0 ? list.splice(idx, 1)[0] : null;
    }
    const buf = outBuffer(dev);
    if (!buf.length) return null;
    const idx = buf.findIndex(d => matchItem(b, d, buf));
    if (idx < 0) return null;
    return buf.splice(idx, 1)[0];
  }
  const CREATURE_TYPES = ['성체실장', '자실장', '엄지', '구더기'];
  const GLOBAL_WAREHOUSE_RESOURCES = {
    운치: { state: 'unchi', bundle: () => C.UNCHI_BUNDLE || 10 },
    실장푸드: { state: 'food', bundle: () => 50 },
    '짓소산 푸드': { state: 'jissoFood', bundle: () => 50 },
    우마이푸드: { state: 'umaiFood', bundle: () => 50 },
    다이어트푸드: { state: 'dietFood', bundle: () => 50 },
    조미료: { state: 'seasoning', bundle: () => 10 },
  };
  // 특정 우리에서 필터에 맞는 생물 1마리 추출
  function takeFromPen(pen, b) {
    const pool = pen.creatures.slice();
    for (let i = 0; i < pen.creatures.length; i++) if (matchItem(b, pen.creatures[i], pool)) return pen.creatures.splice(i, 1)[0];
    return null;
  }
  // 우리 바닥의 운치를 10개 묶음으로 추출(집게 필터에 '운치'가 있어야 함). 얼룩도 감소.
  function takeUnchiFromPen(pen, b) {
    const f = b.filter || [];
    if (!f.includes('운치')) return null;          // 운치는 필터에 명시해야만 추출
    const bundle = C.UNCHI_BUNDLE || 10;
    if ((pen.unchi || 0) < bundle) return null;
    pen.unchi -= bundle;
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('extracted:운치');
    // 얼룩은 다음 프레임 reconcilePenStains가 오염도%에 맞춰 재조정함
    return resourceCargoData('운치');
  }
  // 창고에서 "화물만" 추출 (생물 제외). 생산품 재고 + 자원(운치/실장푸드)
  function extractFromWarehouse(grabber, source) {
    const inv = inventoryOf(source);
    const f = grabber.filter || [];
    for (const type of Object.keys(inv)) {
      if (G.CREATURES[type]) continue;                   // 창고는 화물 전용: 모든 생물 타입 제외
      const list = inv[type]; if (!list || !list.length) continue;
      if (f.length && !f.includes(type)) continue;
      const idx = list.findIndex(d => matchItem(grabber, d, list));
      if (idx >= 0) return list.splice(idx, 1)[0];
    }
    if (isLocalWarehouse(source)) return null;
    for (const [type, info] of Object.entries(GLOBAL_WAREHOUSE_RESOURCES)) {
      if (f.length && !f.includes(type)) continue;
      const available = Math.floor(S[info.state] || 0);
      if (available <= 0) continue;
      const amount = Math.min(info.bundle(), available);
      S[info.state] -= amount;
      const data = resourceCargoData(type);
      data.amount = amount;
      return data;
    }
    return null;
  }
  // 창고 입고: 실장푸드/운치=자원 재고, 그 외(생산품/생물)=판매 대기 재고에 저장(즉시판매 X)
  function warehouseIntake(data, source) {
    if (data && data.type && G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('stored:' + data.type);
    if (data && data.type === '카오스 구더기' && !data._achievementChaosCounted) {
      data._achievementChaosCounted = true;
      achievementStats().chaosMaggots++;
    }
    if (isLocalWarehouse(source)) {
      const inv = inventoryOf(source);
      const units = Math.max(1, Math.floor(data.amount || 1));
      if (inventoryCount(inv) + units > warehouseCapacity(source)) return false;
      if (!inv[data.type]) inv[data.type] = [];
      for (let i = 0; i < units; i++) inv[data.type].push(Object.assign({}, data, {
        id: i === 0 ? data.id : G.uid(), amount: 1,
        stats: data.stats ? Object.assign({}, data.stats) : { 크기: 0 },
      }));
      return true;
    }
    if (S.autoSell[data.type] && !['실장푸드', '짓소산 푸드', '우마이푸드', '다이어트푸드', '운치', '조미료'].includes(data.type)) {
      sellCargo(data, source);
      return true;
    }
    const playerUnits = Math.max(1, Math.floor(data.amount || 1));
    if (playerInventoryRoom() < playerUnits) return false;
    if (data.type === '실장푸드') { S.food += data.amount || 1; return true; }
    if (data.type === '짓소산 푸드') { S.jissoFood = (S.jissoFood || 0) + (data.amount || 1); return true; }
    if (data.type === '우마이푸드') { S.umaiFood = (S.umaiFood || 0) + (data.amount || 1); return true; }
    if (data.type === '다이어트푸드') { S.dietFood = (S.dietFood || 0) + (data.amount || 1); return true; }
    if (data.type === '운치') { storeUnchi(data.amount || 1); return true; }
    if (data.type === '조미료') { S.seasoning = (S.seasoning || 0) + (data.amount || 1); return true; }
    if (!S.warehouse[data.type]) S.warehouse[data.type] = [];
    S.warehouse[data.type].push(data);
    return true;
  }
  /* ---- 시장 포화: 같은 제품을 많이 팔면 단가가 떨어지고, 시간이 지나면 회복 ---- */
  function marketMult(type) {
    const m = (S.market && S.market[type]) || 0;   // >0 포화(하락), <0 희소(상승)
    return clamp(1 - m * (C.MARKET_DROP || 0.006), C.MARKET_FLOOR || 0.3, C.MARKET_CEIL || 1.3);
  }
  // 원래 단가 대비 현재 시세 변동률(%) — 양수=상승, 음수=하락
  function marketPct(type) { return Math.round((marketMult(type) - 1) * 100); }
  function addMarketSale(type, count) {
    if (!S.market) S.market = {};
    S.market[type] = (S.market[type] || 0) + (count || 1);
  }
  // 현재 시세를 반영한 1개 판매가(최소 1). 판매 처리 시 호출하면 누적 포화도 함께 올린다.
  function marketSell(type, base) {
    const downtown = ownedEnvironmentEffect('downtown', 'salePrice', 1);
    const bunker = ownedEnvironmentEffect('bunker', 'tradeReward', 1);
    const p = Math.max(1, Math.round(base * marketMult(type) * downtown * bunker));
    addMarketSale(type, 1);
    return p;
  }
  // 통계창 "판매" 버튼: 창고 재고 전량 판매
  function recordSale(type, price, count) {
    if (!type) return;
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('sold:' + type);
    if (G.UI && G.UI.onFirstSale) G.UI.onFirstSale();   // 첫 거래 후 미도리 시장 설명
    const n = count == null ? 1 : count;
    S.sold[type] = (S.sold[type] || 0) + n;
    if (!S.soldValueByType || typeof S.soldValueByType !== 'object') S.soldValueByType = {};
    S.soldValueByType[type] = (S.soldValueByType[type] || 0) + (price || 0);
    S.produceLog.push(performance.now());
  }
  function sellAllWarehouse() {
    let gained = 0, count = 0;
    for (const type of Object.keys(S.warehouse)) {
      const list = S.warehouse[type];
      for (const d of list) { const p = marketSell(type, G.Creatures.cargoPrice(d)); gained += p; count++; recordSale(type, p); }
      S.warehouse[type] = [];
    }
    const jissoCount = Math.floor(S.jissoFood || 0);
    if (jissoCount > 0) {
      let jissoGained = 0;
      const unit = C.JISSO_FOOD_PRICE || 5;
      for (let i = 0; i < jissoCount; i++) jissoGained += marketSell('짓소산 푸드', unit);
      S.jissoFood -= jissoCount;
      gained += jissoGained;
      count += jissoCount;
      recordSale('짓소산 푸드', jissoGained, jissoCount);
    }
    S.money += gained; S.soldValue += gained;
    if (count) G.Assets.playSfx('sell');
    return { gained, count };
  }
  // 종류별 n개 판매 (n=Infinity → 전부)
  function sellSomeType(type, n) {
    const list = S.warehouse[type]; if (!list || !list.length) return { gained: 0, count: 0 };
    const k = Math.min(n, list.length); let gained = 0, count = 0;
    for (let i = 0; i < k; i++) { const d = list.shift(); const p = marketSell(type, G.Creatures.cargoPrice(d)); gained += p; count++; recordSale(type, p); }
    S.money += gained; S.soldValue += gained; if (count) G.Assets.playSfx('sell');
    return { gained, count };
  }
  // 짓소산 푸드 자원(S.jissoFood) 판매. n=Infinity→전부. 개당 JISSO_FOOD_PRICE(5원).
  function sellJissoFood(n) {
    const have = Math.floor(S.jissoFood || 0);
    const count = Math.min(have, n === Infinity ? have : Math.max(0, Math.floor(n)));
    if (count <= 0) return { gained: 0, count: 0 };
    const unit = C.JISSO_FOOD_PRICE || 5;
    let gained = 0;
    for (let i = 0; i < count; i++) gained += marketSell('짓소산 푸드', unit);
    S.jissoFood -= count;
    S.money += gained; S.soldValue += gained;
    recordSale('짓소산 푸드', gained, count);
    G.Assets.playSfx('sell');
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
        const price = marketSell(type, G.Creatures.priceOf(type, c.stats));
        gained += price; count++;
        pen.creatures.splice(i, 1);
        recordSale(type, price);
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
    const price = marketSell(c.type, G.Creatures.priceOf(c.type, c.stats));
    ref.pen.creatures.splice(i, 1);
    S.money += price; S.soldValue += price;
    recordSale(c.type, price);
    G.Assets.playSfx('sell');
    return { gained: price, type: c.type };
  }
  // 우리에 넣고, 가득이면 필드 중앙 근처에 배회로 투입(치트/구매/포획 공용)
  // penId 지정 시 해당 우리에 먼저 넣어본다.
  function dropToFactory(data, penId, strictPen) {
    if (penId) {
      const pen = G.Pens.allPens().find(p => p.id === penId);
      if (pen && G.Pens.addToPen(pen, data)) return;
      if (strictPen) {
        spawnWanderer(data, COLS / 2 + (Math.random() * 6 - 3), ROWS / 2 + (Math.random() * 6 - 3));
        return;
      }
    }
    const add = G.Pens.addToPreferred || G.Pens.addToAny;
    if (add(data)) return;
    spawnWanderer(data, COLS / 2 + (Math.random() * 6 - 3), ROWS / 2 + (Math.random() * 6 - 3));
  }
  function tryLoadCreature(col, row, creature) { return dropInto(deviceAt(col, row), creature, { c: col, r: row }); }
  function hoverDropTarget(cx, cy) {
    const cell = screenToCell(cx, cy);
    const dev = cell ? deviceAt(cell.col, cell.row) : null;
    dropHoverId = null;
    if (dev) {
      const def = G.DEVICES[dev.type];
      const ok = ['birthing', 'washbasin', 'slaughter', 'deshell', 'correction', 'mixer', 'cookery', 'acidgen', 'grinder', 'warehouse', 'largewarehouse', 'colony', 'launchpad', 'penbox', 'skewer', 'techica', 'terrarium', 'mortar', 'packer', 'salecenter', 'jisoucharge', 'firecharge', 'chaoscharge', 'chaosgate'].includes(dev.type);
      if (ok) dropHoverId = dev.id;
    }
  }
  function clearDropHover() { dropHoverId = null; }

  /* ---- 화물 ----------------------------------------------------------- */
  function makeCargo(data, col, row) {
    if (data && data.type && G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('made:' + data.type);
    const cg = { id: G.uid(), data, gx: col + 0.5, gy: row + 0.5, dir: 1, axis: 'h', sorterDir: null, sorterCell: null };
    cargoIdxAdd(cg);   // 같은 프레임 내 수용량 판정에 즉시 반영
    spatialAdd(cargoSpatial, cg, cg.gx, cg.gy);
    return cg;
  }
  function cargoUnitCount(cg) {
    const list = Array.isArray(cg && cg.stack) ? cg.stack : (cg && cg.data ? [cg.data] : []);
    return list.reduce((sum, data) => sum + Math.max(1, Math.floor((data && data.amount) || 1)), 0);
  }
  function cargoStackList(cg) {
    if (!Array.isArray(cg.stack) || !cg.stack.length) cg.stack = cg.data ? [cg.data] : [];
    return cg.stack;
  }
  function takeCargoUnit(cg) {
    if (!cg || cg._dead) return null;
    const stack = cargoStackList(cg);
    const data = stack.pop();
    if (stack.length) {
      cg.data = stack[stack.length - 1];
      cg.stack = stack;
    } else {
      cg._dead = true;
      cg.stack = null;
    }
    return data || null;
  }
  function removeCargoRef(cg) {
    if (!cg) return;
    cg._dead = true;
    S.cargo = S.cargo.filter(x => x !== cg);
  }
  function stackableFloorCargo(cg) {
    if (!cg || cg._dead || !cg.data || !cg.data.type) return false;
    if (G.CREATURES[cg.data.type]) return false;
    const c = Math.floor(cg.gx), r = Math.floor(cg.gy);
    if (!inGrid(c, r) || isBeltLike(c, r) || deviceAt(c, r)) return false;
    return true;
  }
  function compactFloorCargoStacks() {
    const groups = new Map(), keep = [];
    for (const cg of S.cargo) {
      if (!stackableFloorCargo(cg)) { keep.push(cg); continue; }
      const key = Math.floor(cg.gx) + '|' + Math.floor(cg.gy) + '|' + cg.data.type;
      const head = groups.get(key);
      if (!head) {
        groups.set(key, cg);
        cargoStackList(cg);
        keep.push(cg);
      } else {
        head.stack = cargoStackList(head).concat(cargoStackList(cg));
        head.data = head.stack[head.stack.length - 1];
        cg._dead = true;
      }
    }
    if (keep.length !== S.cargo.length) S.cargo = keep;
  }
  function cellOf(cg) { return { c: Math.floor(cg.gx), r: Math.floor(cg.gy) }; }
  // 외부(우리 등)에서 화물을 바닥에 떨어뜨림(벨트/장치로 운반 가능)
  function dropFloorCargo(data, col, row) {
    if (!data) return null;
    const c = clamp(col, 0, COLS - 1), r = clamp(row, 0, ROWS - 1);
    const cg = makeCargo(data, c, r);
    S.cargo.push(cg);
    return cg;
  }
  // cargoIdx 버킷 기반(O(버킷 크기)). 좌표 재검증으로 프레임 중 이동/_dead 화물 제외.
  function countCargoInCell(c, r, except) {
    const list = cargoIdx.get(c + '|' + r);
    if (!list) return 0;
    let n = 0;
    for (const cg of list) { if (cg === except || cg._dead) continue; if (Math.floor(cg.gx) === c && Math.floor(cg.gy) === r) n++; }
    return n;
  }
  function isCellCargoEmpty(c, r, except) { return countCargoInCell(c, r, except) <= 0; }
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
    if (isConstructing(d)) return false;
    const data = cargo.data, def = G.DEVICES[d.type];
    if (d.type === 'launchpad') {
      const e = endingState(), amount = Math.max(1, data.amount || 1);
      if (!e.accepted || (e.stage !== 1 && e.stage !== 2)) return false;
      if (data.type === '철조각') return amount <= endingNeed().scrap - e.scrap ? 'launchpad' : false;
      if (e.stage !== 1) return false;
      if (data.type === '전자부품') return amount <= endingNeed().electronics - (e.electronics || 0) ? 'launchpad' : false;
      if (data.type === '초고농축운치') return amount <= endingNeed().concentrate - e.concentrate ? 'launchpad' : false;
      if (ENDING_PRODUCTS.has(data.type)) return amount <= endingNeed().products - e.products ? 'launchpad' : false;
      return false;
    }
    if (d.type === 'warehouse' || d.type === 'largewarehouse' || d.type === 'colony') return G.CREATURES[data.type] ? false : 'warehouse'; // 생물은 창고 불가
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
    if (d.type === 'terrarium') return ['성체실장', '사육실장', '독라'].includes(data.type) ? 'terrarium' : false;
    if (d.type === 'mortar') return data.type === '구더기 탄도미사일' && (d.missileAmmo || 0) < 5 ? 'mortarAmmo' : false;
    if (d.type === 'mixer') {
      if (data.type === '분쇄육' && !d.slotMeat) return 'mixMeat';
      if (data.type === '운치' && (d.unchiN || 0) < C.MIX_UNCHI) return 'mixUnchi';
      if (data.type === '짓소산' && !d.slotAcid) return 'mixAcid';
      if (data.type === '조미료' && !d.slotSeasoning) return 'mixSeasoning';
      if (data.type === '철조각' && !d.slotScrap) return 'mixScrap';
      if (data.type === '농축운치' && (d.cA || 0) < (C.MIX_CONCENTRATE || 5)) return 'mixCA';
      if (data.type === '고농축운치' && (d.cB || 0) < (C.MIX_CONCENTRATE || 5)) return 'mixCB';
      if (data.type === '실장푸드' && (d.foodN || 0) < (C.MIX_FOOD_NEED || 50)) return 'mixFood';
      return false;
    }
    if (d.type === 'chaosgate') {
      const e = transportEnds(d);
      return c === e.back.c && r === e.back.r && d.powerConnected && d.powered && chaosGateExitAvailable(d, data) ? 'transport' : false;
    }
    if (d.type === 'crossbelt') {
      const e = transportEnds(d);
      return c === e.back.c && r === e.back.r && transportExitAvailable(d, data) ? 'transport' : false;
    }
    if (d.type === 'tunnel') { const e = transportEnds(d); return (c === e.back.c && r === e.back.r && (d.queue ? d.queue.length : 0) < C.TUNNEL_CAP) ? 'transport' : false; }
    if (d.type === 'salecenter') return canPackerSell(data) ? 'pack' : false;
    if (d.type === 'jisoucharge') return (data.type === '성체실장' && !d.worker) ? 'power' : false;
    if (d.type === 'firecharge') return ((C.FIRE_FUEL_TIME && C.FIRE_FUEL_TIME[data.type]) && !d.fuel && !d.fuelT) ? 'power' : false;
    if (d.type === 'chaoscharge') {
      if (data.type === '성체실장' && (!d.chaosVictims || d.chaosVictims.length < 12)) return 'power';
      return ((C.CHAOS_FUEL_TIME && C.CHAOS_FUEL_TIME[data.type]) && !d.fuel && !d.fuelT) ? 'power' : false;
    }
    if (d.type === 'packer') return (data.type === '철조각' || data.type === '분쇄육' || data.type === '실장육') ? 'pack' : false;
    if (d.type === 'cookery') {
      if (data.type === '조미료') return (d.seasoning || 0) + Math.max(1, data.amount || 1) <= (C.SEASONING_MAX || 200) ? 'cook' : false;
      return accepts(def, data.type) ? 'cook' : false;
    }
    if (d.type === 'acidgen') return (data.type === '성체실장' && !d.item && !d.output) ? 'acidgen' : false;
    if (d.type === 'correction') {
      if (data.type === '사육실장' && !d.teacher) return 'teacher';
      return (accepts(def, data.type) && (d.inmates ? d.inmates.length : 0) < def.hold) ? 'correct' : false;
    }
    if (['slaughter', 'deshell', 'grinder'].includes(d.type)) {
      if (accepts(def, data.type) && !d.item && (d.type === 'deshell' || outRoom(d) > 0)) return 'process';
      return false;
    }
    if (d.type === 'reformer') return (data.type === '독라' && !data.labor && !d.item && S.wanderers.filter(w => w.data && w.data.labor).length < laborLimit()) ? 'reform' : false;
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
  function update(dt) { rebuildFrameCaches(); tickEconomy(dt); tickWeather(dt); tickInvasion(dt); updateRenewableRuins(dt); updateCargo(dt); compactFloorCargoStacks(); rebuildCargoIndex(); rebuildCargoSpatial(); updateDevices(dt); updateResearch(dt); updateColonyUpgrade(dt); updateEnding(dt); updateWanderers(dt); updateMortarShells(dt); updateExplosionEffects(dt); updateParticles(dt); updateFloatTexts(dt); updateCoinEffects(dt); updateStains(dt); updateBgmMode(dt); tickQuests(dt); renderInventoryPanels(false); achievementStats().powerUsed += Math.max(0, S.powerUsed || 0) * dt; tickMonumentAchievements(); }
  function tickWeather(dt) {
    if (!S.weather) S.weather = { rollIn: C.WEATHER_ROLL_SEC || 60, rainLeft: 0 };
    const w = S.weather;
    if ((w.rainLeft || 0) > 0) {
      w.rainLeft = Math.max(0, w.rainLeft - dt);
      G.Assets.setAmbience && G.Assets.setAmbience(G.RAIN_SOUND, w.rainLeft > 0);
      return;
    }
    w.rollIn = (w.rollIn == null ? (C.WEATHER_ROLL_SEC || 60) : w.rollIn) - dt;
    if (w.rollIn > 0) return;
    w.rollIn += C.WEATHER_ROLL_SEC || 60;
    if (Math.random() < (C.WEATHER_RAIN_CHANCE || 0.2)) {
      w.rainLeft = C.WEATHER_RAIN_DURATION || 60;
      G.Assets.setAmbience && G.Assets.setAmbience(G.RAIN_SOUND, true);
    }
  }
  function updateRenewableRuins(dt) {
    for (const r of (S.ruins || [])) {
      if (!r.persistent || !(r.resourceMax > 0) || !(r.resourceRegen > 0)) continue;
      r.scrap = Math.min(r.resourceMax, Math.max(0, r.scrap || 0) + r.resourceRegen * dt);
    }
  }
  // 배경음 전환: 침입(레이드) > 매지컬 테치카(확대 시) > 일반.
  let raidFadeT = 0;   // 침입자 전멸 후 원래 음악 복귀까지 남은 시간
  let endingBgmStage = '';
  function updateBgmMode(dt) {
    const ending = endingState();
    if (ending.infinite) {
      if (endingBgmStage !== 'stay') {
        endingBgmStage = 'stay';
        G.Assets.setBgmMode(G.BGM_END_STAY);
      }
      return;
    }
    if (ending.accepted && ending.stage >= 1) {
      const desired = ending.stage >= 2 ? 'exit' : 'climax';
      if (endingBgmStage !== desired) {
        endingBgmStage = desired;
        if (desired === 'exit') G.Assets.setBgmMode(G.BGM_EXIT);
        else if (G.Assets.setBgmPlaylist) G.Assets.setBgmPlaylist(G.BGM_CLIMAX || []);
      }
      return;
    }
    endingBgmStage = '';
    const invaders = S.wanderers.some(w => !w._dead && w.formalRaid);
    if (invaders) raidFadeT = C.RAID_BGM_FADEOUT || 5;
    else if (raidFadeT > 0) raidFadeT = Math.max(0, raidFadeT - dt);
    let mode = null;
    if (invaders || raidFadeT > 0) mode = G.BGM_RAID;
    else if (techicaBgmActive()) mode = G.BGM_TECHICA;
    G.Assets.setBgmMode(mode);
  }
  // 가동 중(장착됨)인 매지컬 테치카가 현재 화면 안에 있고 충분히 확대되었는가
  function techicaBgmActive() {
    if (cam.zoom < (C.TECHICA_ZOOM_BGM || 1.3)) return false;
    const vx0 = cam.x / CELL, vy0 = cam.y / CELL;
    const vx1 = (cam.x + canvas.width / cam.zoom) / CELL, vy1 = (cam.y + canvas.height / cam.zoom) / CELL;
    for (const b of S.buildings) {
      if (b.type !== 'techica' || !b.worker) continue;
      if (b.col + 1 >= vx0 && b.col <= vx1 && b.row + 1 >= vy0 && b.row <= vy1) return true;
    }
    return false;
  }
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
  function penVisualActive(pen, margin) {
    if (!canvas || !pen) return true;
    const pad = margin == null ? 3 : margin;
    const vx0 = cam.x / CELL - pad;
    const vy0 = cam.y / CELL - pad;
    const vx1 = (cam.x + canvas.width / cam.zoom) / CELL + pad;
    const vy1 = (cam.y + canvas.height / cam.zoom) / CELL + pad;
    return !(pen.col > vx1 || pen.col + pen.w < vx0 || pen.row > vy1 || pen.row + pen.h < vy0);
  }
  function focusCameraOnGrid(gx, gy) {
    cam.x = gx * CELL - canvas.width / (2 * cam.zoom);
    cam.y = gy * CELL - canvas.height / (2 * cam.zoom);
    clampCamera();
  }
  function forceTutorialGrowth() {
    const pens = G.Pens.allPens();
    const pen = pens[1] || pens[0];
    if (!pen || !pen.creatures) return false;
    const child = pen.creatures.find(c => c.type === '자실장') || pen.creatures.find(c => c.type === '엄지') || pen.creatures.find(c => c.type === '구더기');
    if (!child) return false;
    let guard = 0;
    while (child.type !== '성체실장' && guard++ < 5 && G.Creatures.grow(child)) {}
    if (child.type === '성체실장') {
      child.noEatT = Math.max(child.noEatT || 0, 120);
      if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('tutorialAdultGrown');
      return true;
    }
    return false;
  }
  function tutorialGrowthLineConnected() {
    const pens = G.Pens.allPens();
    const adultPen = pens[0], childPen = pens[1];
    if (!adultPen || !childPen) return false;
    const candidates = S.buildings.filter(b => isGrabberType(b.type) && (b.filter || []).includes('성체실장'));
    for (const grabber of candidates) {
      const roles = grabberRoles(grabber);
      if (deviceAt(roles.pickup.c, roles.pickup.r) !== childPen) continue;
      const queue = [{ c: roles.drop.c, r: roles.drop.r }];
      const seen = new Set();
      while (queue.length) {
        const cell = queue.shift();
        const key = cell.c + '|' + cell.r;
        if (seen.has(key) || !inGrid(cell.c, cell.r)) continue;
        seen.add(key);
        const here = deviceAt(cell.c, cell.r);
        if (here === adultPen) return true;
        const bc = beltCell(cell.c, cell.r);
        if (!bc) continue;
        const belts = [];
        if (bc.h) belts.push(bc.h);
        if (bc.v && bc.v !== bc.h) belts.push(bc.v);
        for (const belt of belts) {
          const v = DIR.vec[belt.dir];
          const next = { c: cell.c + v.x, r: cell.r + v.y };
          if (deviceAt(next.c, next.r) === adultPen) return true;
          if (hasBelt(next.c, next.r)) queue.push(next);
        }
      }
    }
    return false;
  }

  /* ===================== 퀘스트(무전) ===================== */
  const QCFG = G.QUEST_CONFIG || { SPAWN_INTERVAL: 180, MAX_ACTIVE: 3, STATIC_TIME: 1.6 };
  function round10(n) { return Math.max(10, Math.round(n / 10) * 10); }
  function colonyTier() { return S.colonyTier || 0; }
  function statOK(data, sf) {
    if (!sf) return true;
    return ((data && data.stats && data.stats[sf.key]) || 0) >= sf.min;
  }
  // 납품 가능 수량 집계 (자원 카운터 / 창고 화물 / 우리 속 실장석)
  function deliverableCount(item, sf) {
    if (item === '실장푸드') return Math.floor(S.food || 0);
    if (item === '짓소산 푸드') return Math.floor(S.jissoFood || 0);
    if (item === '우마이푸드') return Math.floor(S.umaiFood || 0);
    if (item === '다이어트푸드') return Math.floor(S.dietFood || 0);
    if (item === '운치') return Math.floor(S.unchi || 0);
    if (item === '조미료') return Math.floor(S.seasoning || 0);
    if (G.CREATURES[item]) {
      let n = 0;
      for (const pen of G.Pens.allPens()) for (const c of pen.creatures) if (c.type === item && statOK(c, sf)) n++;
      return n;
    }
    const list = S.warehouse[item];
    return list ? list.filter(d => statOK(d, sf)).length : 0;
  }
  function consumeDeliverable(item, n, sf) {
    const counters = { 실장푸드: 'food', '짓소산 푸드': 'jissoFood', 우마이푸드: 'umaiFood', 다이어트푸드: 'dietFood', 운치: 'unchi', 조미료: 'seasoning' };
    if (counters[item]) { S[counters[item]] = Math.max(0, (S[counters[item]] || 0) - n); return; }
    if (G.CREATURES[item]) {
      let left = n;
      for (const pen of G.Pens.allPens()) {
        pen.creatures = pen.creatures.filter(c => { if (left > 0 && c.type === item && statOK(c, sf)) { left--; return false; } return true; });
        if (left <= 0) break;
      }
      return;
    }
    const list = S.warehouse[item];
    if (list) { let left = n; S.warehouse[item] = list.filter(d => { if (left > 0 && statOK(d, sf)) { left--; return false; } return true; }); }
  }
  // 단체/티어에 맞는 퀘스트 1개 생성
  const QUEST_LOW_CREATURE_CAP = new Set(['자실장', '엄지', '구더기']);
  function questRequestUnlocked(req, tier) {
    if (!req || (req.tier || 0) > tier) return false;
    if (!req.research) return true;
    const keys = Array.isArray(req.research) ? req.research : [req.research];
    return keys.every(key => ((S.upgrades && S.upgrades[key]) || 0) > 0);
  }
  function questPool(orgKey) {
    const org = G.QUEST_ORGS[orgKey];
    return org ? org.reqs.filter(req => questRequestUnlocked(req, colonyTier())) : [];
  }
  function makeQuest(orgKey) {
    const org = G.QUEST_ORGS[orgKey]; if (!org) return null;
    const tier = colonyTier();
    const pool = questPool(orgKey);
    if (!pool.length) return null;
    const req = pool[Math.floor(Math.random() * pool.length)];
    const scale = 1 + tier * 1.0;   // 티어가 오를수록 요구량이 가파르게 증가(잉여 생산 흡수)
    let n = req.fixedQty || round10((req.qty || 10) * scale * (0.85 + Math.random() * 0.4));
    // 자실장/엄지/구더기(저급 실장석)는 최대 30마리까지만 요구
    if (QUEST_LOW_CREATURE_CAP.has(req.item)) n = Math.min(n, 30);
    // 44방공호는 스탯 무관(개수로만). 그 외는 티어가 오를수록 요구 스탯도 상승.
    const sf = (orgKey !== 'vault44' && req.stat) ? { key: req.stat.key, min: Math.round(req.stat.min * (1 + tier * 0.5)) } : null;
    const reward = computeReward(org, req, n, tier, orgKey);
    const line = pickDialogue(org.lines);
    return {
      id: G.uid(), org: orgKey, item: req.item, n, stat: sf,
      delivered: 0, accepted: false, rewardText: reward.text, reward,
      line: line.text,
    };
  }
  function pickDialogue(list, fallback) {
    const arr = Array.isArray(list) ? list : [];
    const picked = arr.length ? arr[Math.floor(Math.random() * arr.length)] : fallback;
    if (picked && typeof picked === 'object') return { text: picked.text || '' };
    return { text: String(picked || '') };
  }
  // 요구 물자 1개당 판매가(기준 스탯). 보상 하한 계산용.
  function questItemSellUnit(item, req) {
    const questUnit = G.QUEST_ITEM_UNITS && G.QUEST_ITEM_UNITS[item];
    if (questUnit != null) return Math.max(1, Math.round(questUnit));
    if (req && req.unit > 0) return Math.max(1, Math.round(req.unit));
    const p = (G.Creatures && G.Creatures.priceOf) ? G.Creatures.priceOf(item, {}) : 0;
    return Math.max(1, Math.round(p || 0));
  }
  const QUEST_MIN_MONEY = 3000;   // 금전 보상 최소액
  // 44방공호 매입가: 가공 난이도를 반영한 고정 단가(스탯 무관, 개수로만)
  function vault44Unit(item, fallback) {
    const questUnit = G.QUEST_ITEM_UNITS && G.QUEST_ITEM_UNITS[item];
    if (questUnit != null) return Math.max(1, Math.round(questUnit));
    if (item === '실장육') return 250;
    if (item === '분쇄육') return 180;
    if (item === '통조림') return 460;
    if (item === '진공포장') return 500;
    return fallback;
  }
  function refreshUnacceptedQuestRewards() {
    for (const q of (S.quests || [])) {
      if (!q || q.accepted) continue;
      const org = G.QUEST_ORGS[q.org];
      if (!org) continue;
      const req = org.reqs.find(r => r.item === q.item) || { item: q.item, unit: 8 };
      const reward = computeReward(org, req, q.n, colonyTier(), q.org);
      q.reward = reward;
      q.rewardText = reward.text;
    }
  }
  // 보상 = (단체별 물질 보상) + (돈). 44방공호는 돈만, 가장 후함. 그 외는 돈을 적게 주는 대신 물질 보상.
  function computeReward(org, req, n, tier, orgKey) {
    const tierMult = 1 + tier * 0.4;
    const unit = req.unit || 8;
    if (req.fixedMoney) {
      const money = Math.max(1, Math.round(req.fixedMoney));
      return { kind: 'money', money, text: '💰 ' + money.toLocaleString() };
    }
    if (orgKey === 'vault44') {
      const money = Math.max(QUEST_MIN_MONEY, Math.round(n * vault44Unit(req.item, unit) * tierMult));
      return { kind: 'money', money, text: '💰 ' + money.toLocaleString() };
    }
    // 그 외 단체: 돈(44방공호보다 적게, 최소 3000) + 물질 보상
    const sellUnit = Math.max(1, questItemSellUnit(req.item, req));
    const money = Math.max(QUEST_MIN_MONEY, Math.round(n * sellUnit * 1.2 * tierMult));
    const rw = { kind: 'mixed', money };
    const parts = [];
    switch (org.reward) {
      case 'research_power':
        if (Math.random() < 0.5) { rw.research = 1 + tier + Math.floor(Math.random() * 3); parts.push('🔬 연구력 영구 +' + rw.research); }
        else { rw.power = 10 + tier * 10; parts.push('⚡ 전력 영구 +' + rw.power); }
        break;
      case 'money_meat':
        rw.meatType = '실장육'; rw.meatN = round10(n * 0.8); parts.push('🍖 실장육 ' + rw.meatN + '개');
        break;
      case 'scrap_power':
        rw.scrap = Math.max(10, round10(n * 2 * tierMult)); rw.power = 10 + tier * 10;
        parts.push('🔩 철조각 ' + rw.scrap + '개'); parts.push('⚡ 전력 영구 +' + rw.power);
        break;
      case 'money_big':
        rw.scrap = Math.max(10, round10(n * 1.5 * tierMult)); parts.push('🔩 철조각 ' + rw.scrap + '개');
        break;
      default: break;
    }
    parts.push('💰 ' + money.toLocaleString());
    rw.text = parts.join(' · ');
    return rw;
  }
  // 단체별 연락 해금 조건 (만족해야 의뢰가 오기 시작)
  function orgUnlocked(orgKey) {
    const tier = colonyTier();
    switch (orgKey) {
      case 'vault44': return tier >= 1;                                        // T1 승급
      case 'bezoar':  return tier >= 1 && S.buildings.filter(b => b.type === 'lab').length >= 3;  // T1 + 연구소 3개
      case 'freakshow': return (S.sold && S.sold['실장육'] || 0) >= 100;       // 실장육 100개 판매
      case 'teaparty': {                                                        // 교정시설 + 사육실장 5마리
        if (!S.buildings.some(b => b.type === 'correction')) return false;
        let pets = 0;
        for (const pen of G.Pens.allPens()) for (const c of pen.creatures) if (c.type === '사육실장' || c.type === '새끼사육실장') pets++;
        return pets >= 5;
      }
      case 'cult': return tier >= 2 && S.buildings.some(b => b.type === 'acidgen');  // T2 + 짓소산 생성기
      default: return (G.QUEST_ORGS[orgKey].minTier || 0) <= tier;
    }
  }
  // 첫 의뢰 전 자기소개 + 의뢰 대사를 단체 무전으로 출력
  function radioOrgIntro(orgKey, q) {
    const org = G.QUEST_ORGS[orgKey]; if (!org) return;
    if (!S.questIntro) S.questIntro = {};
    const first = !S.questIntro[orgKey];
    if (first && org.introLines && org.introLines.length) {
      S.questIntro[orgKey] = true;
      const lines = org.introLines.concat([{ text: q.line, item: q.item, n: q.n }]);
      if (G.UI && G.UI.midoriRadio) G.UI.midoriRadio(lines, { name: org.name, midori: false, orgKey });
    } else {
      S.questIntro[orgKey] = true;
      radioIn(org.name + ': ' + q.line, orgKey, q.item, q.n);
    }
  }
  function spawnQuest() {
    if (S.quests.length >= (QCFG.MAX_ACTIVE || 3)) return;
    const keys = Object.keys(G.QUEST_ORGS).filter(k => {
      if (!orgUnlocked(k)) return false;
      if (!questPool(k).length) return false;
      return k === 'vault44' || !(S.quests || []).some(q => q.org === k);
    });
    if (!keys.length) return;
    // 가중 랜덤(rare 단체는 weight 낮음)
    let totalW = 0; for (const k of keys) totalW += (G.QUEST_ORGS[k].weight || 1);
    let r = Math.random() * totalW, pick = keys[0];
    for (const k of keys) { r -= (G.QUEST_ORGS[k].weight || 1); if (r <= 0) { pick = k; break; } }
    const q = makeQuest(pick);
    if (q) { S.quests.push(q); radioOrgIntro(pick, q); }
  }
  function tickQuests(dt) {
    if (S.screen !== 'factory' && S.screen !== 'park') return;
    if (!S.introDone) return;   // 인트로(콜로니 T1) 전에는 퀘스트 없음
    S.questTimer = (S.questTimer || 0) + dt;
    if (S.questTimer >= (QCFG.SPAWN_INTERVAL || 180)) {
      S.questTimer = 0;
      if (S.quests.length < (QCFG.MAX_ACTIVE || 3)) spawnQuest();
    }
  }
  function acceptQuest(id) {
    const q = S.quests.find(x => x.id === id); if (!q || q.accepted) return;
    q.accepted = true; G.Assets.playSfx('click');
  }
  function rejectQuest(id) {
    const q = S.quests.find(x => x.id === id); if (!q || q.accepted) return;
    S.quests = S.quests.filter(x => x !== q);
    G.Assets.playSfx('remove');
  }
  // 남은 요구량 = 총 요구 - 누적 납품
  function questRemaining(q) { return Math.max(0, q.n - (q.delivered || 0)); }
  // 완료 가능 = 누적 납품 + 현재 보유로 남은 요구를 채울 수 있음
  function questReady(q) { return (q.delivered || 0) + deliverableCount(q.item, q.stat) >= q.n; }
  // 분할 납품: 지금 보유한 만큼(남은 요구 한도) 납품하여 누적
  function deliverQuest(id) {
    const q = S.quests.find(x => x.id === id); if (!q) return;
    if (!q.accepted) { G.UI.flash && G.UI.flash('먼저 수락하세요'); return; }
    const remain = questRemaining(q);
    if (remain <= 0) { G.UI.flash && G.UI.flash('이미 다 모았습니다. 완료하세요'); return; }
    const k = Math.min(remain, deliverableCount(q.item, q.stat));
    if (k <= 0) { G.UI.flash && G.UI.flash('납품할 ' + (FILTER_LABEL[q.item] || q.item) + '이(가) 없습니다'); return; }
    consumeDeliverable(q.item, k, q.stat);
    q.delivered = (q.delivered || 0) + k;
    G.Assets.playSfx('sell');
    if (questRemaining(q) <= 0) {
      finalizeQuest(q);   // 누적으로 다 채워지면 즉시 완료
    } else {
      G.UI.flash && G.UI.flash('납품 ' + q.delivered + '/' + q.n + ' (' + k + '개 전달)');
    }
  }
  function completeQuest(id) {
    const q = S.quests.find(x => x.id === id); if (!q) return;
    if (!q.accepted) { G.UI.flash && G.UI.flash('먼저 수락하세요'); return; }
    // 보유분으로 남은 요구를 마저 납품
    const remain = questRemaining(q);
    if (remain > 0) {
      const k = Math.min(remain, deliverableCount(q.item, q.stat));
      if (k > 0) { consumeDeliverable(q.item, k, q.stat); q.delivered = (q.delivered || 0) + k; }
    }
    if (questRemaining(q) > 0) { G.UI.flash && G.UI.flash('납품 재료가 부족합니다 (' + (q.delivered || 0) + '/' + q.n + ')'); return; }
    finalizeQuest(q);
  }
  function finalizeQuest(q) {
    applyQuestReward(q.reward);
    S.quests = S.quests.filter(x => x !== q);
    const org = G.QUEST_ORGS[q.org];
    const done = pickDialogue(org && org.done, '고맙다.').text;
    radioIn((org ? org.name : '') + ': ' + done, q.org);
    G.Assets.playSfx('sell');
  }
  function applyQuestReward(rw) {
    if (!rw) return;
    const questMult = ownedEnvironmentEffect('bunker', 'questReward', 1);
    if (rw.money) {
      const money = Math.round(rw.money * questMult);
      S.money += money; S.soldValue = (S.soldValue || 0) + money;
    }
    if (rw.power) S.powerBonus = (S.powerBonus || 0) + Math.max(1, Math.round(rw.power * questMult));
    if (rw.research) S.researchBonus = (S.researchBonus || 0) + Math.max(1, Math.round(rw.research * questMult));
    if (rw.scrap) {
      if (!S.warehouse['철조각']) S.warehouse['철조각'] = [];
      const scrapN = Math.round(rw.scrap * questMult);
      for (let i = 0; i < scrapN; i++) S.warehouse['철조각'].push(resourceCargoData('철조각'));
    }
    if (rw.meatN) {
      if (!S.warehouse[rw.meatType]) S.warehouse[rw.meatType] = [];
      const meatN = Math.round(rw.meatN * questMult);
      for (let i = 0; i < meatN; i++) S.warehouse[rw.meatType].push(G.Creatures.makeProduct(rw.meatType, { stats: { 육질: 30, 개념: 0, 크기: 10 } }));
    }
  }
  // 단체 무전: 치지직 효과 후 하단 대사창 출력
  function radioIn(text, orgKey, item, n) {
    const org = orgKey && G.QUEST_ORGS ? G.QUEST_ORGS[orgKey] : null;
    if (G.UI && G.UI.showRadio) G.UI.showRadio(text, { name: org ? org.name : '무전', midori: false, orgKey, item, n });
    else if (G.UI && G.UI.midoriRadio) G.UI.midoriRadio(text);
  }
  // 콜로니 T1 달성 시 인트로 + 첫 퀘스트(44방공호 실장육 50). 44방공호 자기소개 포함.
  function triggerIntro() {
    if (S.introDone) return;
    S.introDone = true; S.questTimer = 0;
    const n = 50, req = { item: '실장육', qty: n };
    const reward = computeReward(G.QUEST_ORGS.vault44, req, n, colonyTier(), 'vault44');
    const q = { id: G.uid(), org: 'vault44', item: '실장육', n, stat: null, delivered: 0, accepted: false,
      reward, rewardText: reward.text,
      line: '첫 거래다. 실장육 ' + n + '개를 보내라. 둥지가 굶고 있다.' };
    S.quests.push(q);
    radioOrgIntro('vault44', q);   // 자기소개 + 첫 의뢰
    window.setTimeout(() => {
      if (G.UI && G.UI.midoriRadio) G.UI.midoriRadio((G.DIALOGUES && G.DIALOGUES.colonyTier1Midori) || [], { long: true, emotion: 'laziness' });
    }, 8500);
  }
  function questOrgName(q) { const o = G.QUEST_ORGS[q.org]; return o ? o.name : q.org; }
  function questHasAny() { return (S.quests || []).length > 0; }
  function questsForUI() {
    const out = (S.quests || []).map(q => ({
      id: q.id, org: questOrgName(q), color: (G.QUEST_ORGS[q.org] || {}).color || '#ccc',
      item: q.item, n: q.n, delivered: (q.delivered || 0), have: deliverableCount(q.item, q.stat), stat: q.stat,
      accepted: q.accepted, ready: questReady(q), rewardText: q.rewardText, line: q.line,
    }));
    const e = endingState();
    if (e.accepted) out.push({
      id: 'ending', org: '44방공호', color: '#ffcf55',
      item: e.stage >= 2 ? '발사대 전력' : '탈출선 물자', n: 100,
      delivered: e.stage >= 2 ? Math.floor((e.charge || 0) / endingNeed().charge * 100) : Math.floor(endingProgress() * 100),
      have: 0, accepted: true, ready: e.stage >= 3, rewardText: '',
    });
    return out;
  }

  // 조미료 가격: 1분마다 직전가격 ±1~SWING 변동
  function tickEconomy(dt) {
    // 판매 기록은 분당 판매량 표시에만 쓰임 — 5초마다 60초 이전 기록 정리(무한 증가 방지)
    logTrimT += dt;
    if (logTrimT >= 5) {
      logTrimT = 0;
      const now = performance.now();
      while (S.produceLog.length && now - S.produceLog[0] > 60000) S.produceLog.shift();
    }
    S.seasoningTimer = (S.seasoningTimer || 0) + dt;
    if (S.seasoningTimer >= C.SEASONING_TICK) {
      S.seasoningTimer -= C.SEASONING_TICK;
      const d = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * C.SEASONING_SWING));
      S.seasoningPrice = Math.max(C.SEASONING_MIN, (S.seasoningPrice || C.SEASONING_BASE) + d);
    }
    // 실장푸드 자동구매: 재고가 기준치 이하면 일정량 구매 (쿨다운 1초)
    autoBuyCd -= dt;
    const ab = S.autoBuyFood;
    if (ab && ab.on && autoBuyCd <= 0 && (S.food || 0) < (ab.threshold || 0)) {
      autoBuyCd = 1.0;
      const batch = Math.max(1, Math.floor(ab.batch || 100));
      const cost = batch * (C.FOOD_PRICE || 1);
      if (S.money >= cost && playerInventoryRoom() >= batch) { S.money -= cost; S.food = (S.food || 0) + batch; }
    }
    // 시장 시세: 포화는 0으로 빠르게 회복, 그 후엔 천천히 희소 프리미엄(음수)으로 상승.
    // 창고에 쌓인(오래 안 판) 품목은 시장지수를 0으로 초기화해 프리미엄 누적 대상으로 삼는다.
    if (!S.market) S.market = {};
    const rec = (C.MARKET_RECOVER || 0.5) * ownedEnvironmentEffect('downtown', 'marketRecovery', 1) * dt;
    const scar = (C.MARKET_SCARCITY_RATE || 0.1) * dt;
    const scarMax = C.MARKET_SCARCITY_MAX || 50;
    for (const t in S.warehouse) { if (S.warehouse[t] && S.warehouse[t].length && S.market[t] == null) S.market[t] = 0; }
    for (const k in S.market) {
      let v = S.market[k];
      if (v > 0) v = Math.max(0, v - rec);              // 포화 회복
      else v = Math.max(-scarMax, v - scar);            // 희소 프리미엄 누적
      S.market[k] = v;
    }
    if (!(G.UI && G.UI.isBasicTutorialActive && G.UI.isBasicTutorialActive())) updateRaidSpawnQueue(dt);
  }

  /* ---- 외부 침입(가족 리젠) / 약탈 ------------------------------------ */
  function raidStartTime() {
    return S.difficulty === 'breeding' ? 2400 : (C.RAID_START || 1200);
  }
  function raidCountMult() {
    return S.difficulty === 'breeding' ? 0.5 : 1;
  }
  function tickInvasion(dt) {
    if (G.UI && G.UI.isBasicTutorialActive && G.UI.isBasicTutorialActive()) return;
    S.playTime = (S.playTime || 0) + dt;
    // 외부 실장석 가족 리젠: 가끔 밖에서 기어들어와 배회 실장석이 됨
    const wildIntervalMult = Math.min(
      ownedEnvironmentEffect('park', 'wildSpawnInterval', 1),
      ownedEnvironmentEffect('downtown', 'wildSpawnInterval', 1)
    );
    if (!S.intrudeIn) S.intrudeIn = (C.INTRUDE_INTERVAL_MIN + Math.random() * (C.INTRUDE_INTERVAL_MAX - C.INTRUDE_INTERVAL_MIN)) * wildIntervalMult;
    S.intrudeIn -= dt;
    if (S.intrudeIn <= 0) {
      S.intrudeIn = (C.INTRUDE_INTERVAL_MIN + Math.random() * (C.INTRUDE_INTERVAL_MAX - C.INTRUDE_INTERVAL_MIN)) * wildIntervalMult;
      if (S.wanderers.length < C.INTRUDE_WANDER_CAP) spawnIntruderFamily();
    }
    tickAmbientEnvironmentInvaders(dt);
    // 약탈: 10분 경과 후 5~10분 간격으로 무리가 몰려옴
    if (S.playTime >= raidStartTime() && (endingState().stage < 2 || endingState().infinite)) {
      if (!S.raidIn) scheduleNextRaid(30 + Math.random() * 90);   // 첫 약탈은 곧바로
      if (!S.raidPoint) S.raidPoint = raidSpawnPoint();
      if (S.raidIn > 30 && S.raidWarned) S.raidWarned = false;
      S.raidIn -= dt;
      if (!S.raidWarned && S.raidIn > 0 && S.raidIn <= 30) {
        S.raidWarned = true;
        if (G.UI && G.UI.onTutorialRaidWarning) G.UI.onTutorialRaidWarning();
        if (G.UI.flash) G.UI.flash('⚠ ' + raidDirectionText(S.raidPoint) + '에서 침입 분충들 대량 발생중!');
      }
      if (S.raidIn <= 0) {
        spawnRaid();
        const ending = endingState();
        if (ending.accepted && ending.stage === 1) scheduleNextRaid(Math.max(60, 300 - (ending.raidCount || 0) * 60));
        else if (ending.infinite) scheduleNextRaid(600);
        else if (ending.stage < 2) scheduleNextRaid(Math.max(60, C.RAID_INTERVAL_MIN + Math.random() * (C.RAID_INTERVAL_MAX - C.RAID_INTERVAL_MIN) + ownedEnvironmentEffect('downtown', 'raidIntervalSeconds', 0)));
      }
    }
  }
  function scheduleNextRaid(seconds) {
    S.raidIn = seconds;
    S.raidPoint = raidSpawnPoint();
    S.raidWarned = false;
  }
  function triggerRaidCountdown() {
    if (G.UI && G.UI.isBasicTutorialActive && G.UI.isBasicTutorialActive()) {
      G.UI.flash && G.UI.flash('기초 튜토리얼 중에는 레이드가 시작되지 않습니다.');
      return;
    }
    S.playTime = Math.max(S.playTime || 0, raidStartTime());
    scheduleNextRaid(30);
    S.raidWarned = true;
    if (G.UI && G.UI.onTutorialRaidWarning) G.UI.onTutorialRaidWarning();
    if (G.UI.flash) G.UI.flash('⚠ ' + raidDirectionText(S.raidPoint) + '에서 침입 분충들 대량 발생중!');
  }
  // 치트: 모든 침입/약탈 실장석을 즉시 소멸(대기 중인 레이드 스폰도 취소). 소멸 수 반환.
  function clearInvaders() {
    let n = 0;
    S.wanderers = S.wanderers.filter(w => {
      if (w.invade || w.raider) { w._dead = true; burstAt(w.gx, w.gy); n++; return false; }
      return true;
    });
    if (S.raidSpawnQueue) { n += (S.raidSpawnQueue.entries ? S.raidSpawnQueue.entries.length : 0); S.raidSpawnQueue = null; S.raidSpawnT = 0; }
    return n;
  }
  function raidDirectionText(p) {
    const dirs = ['북쪽', '동쪽', '남쪽', '서쪽'];
    if (p && dirs[p.side]) return dirs[p.side];
    if (p) {
      const f = startFieldRect();
      const d = [
        Math.abs(p.y - f.r0),
        Math.abs(p.x - f.c1),
        Math.abs(p.y - f.r1),
        Math.abs(p.x - f.c0),
      ];
      let bi = 0;
      for (let i = 1; i < d.length; i++) if (d[i] < d[bi]) bi = i;
      return dirs[bi];
    }
    return '외곽';
  }
  function equipmentBounds() {
    const f = startFieldRect();
    let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    for (const b of S.buildings) {
      const cells = b.type === 'penbox' ? penAbsCells(b) : footprintCellsOf(b);
      for (const cell of cells) {
        minC = Math.min(minC, cell.c); minR = Math.min(minR, cell.r);
        maxC = Math.max(maxC, cell.c + 1); maxR = Math.max(maxR, cell.r + 1);
      }
    }
    if (!Number.isFinite(minC)) return { c0: f.c0, r0: f.r0, c1: f.c1, r1: f.r1 };
    return { c0: minC, r0: minR, c1: maxC, r1: maxR };
  }
  function distToRect(gx, gy, rect) {
    const dx = Math.max(rect.c0 - gx, 0, gx - rect.c1);
    const dy = Math.max(rect.r0 - gy, 0, gy - rect.r1);
    return Math.hypot(dx, dy);
  }
  function distToPlayerEquipment(gx, gy) {
    let best = Infinity;
    for (const b of S.buildings) {
      const cells = b.type === 'penbox' ? penAbsCells(b) : footprintCellsOf(b);
      for (const cell of cells) {
        best = Math.min(best, distToRect(gx, gy, { c0: cell.c, r0: cell.r, c1: cell.c + 1, r1: cell.r + 1 }));
      }
    }
    return best;
  }
  function raidSpawnPoint() {
    const minDist = C.RAID_SPAWN_MIN_DIST || 20;
    const b = ownedLandRectCells(0);
    const pad = minDist;
    let fallback = null;
    for (let tries = 0; tries < 80; tries++) {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      if (side === 0) { x = b.c0 + Math.random() * Math.max(1, b.c1 - b.c0); y = b.r0 - pad; }
      else if (side === 1) { x = b.c1 + pad; y = b.r0 + Math.random() * Math.max(1, b.r1 - b.r0); }
      else if (side === 2) { x = b.c0 + Math.random() * Math.max(1, b.c1 - b.c0); y = b.r1 + pad; }
      else { x = b.c0 - pad; y = b.r0 + Math.random() * Math.max(1, b.r1 - b.r0); }
      const p = { x: clamp(x, 0.5, COLS - 0.5), y: clamp(y, 0.5, ROWS - 0.5), side };
      fallback = fallback || p;
      if (distToRect(p.x, p.y, b) >= minDist) return p;
    }
    return fallback || edgeSpawnPoint();
  }
  function validRaidSpawnPoint(p) {
    return !!(p && Number.isFinite(p.x) && Number.isFinite(p.y) && distToRect(p.x, p.y, ownedLandRectCells(0)) >= (C.RAID_SPAWN_MIN_DIST || 20));
  }
  // 시작 필드 가장자리 바깥의 등장 지점
  function edgeSpawnPoint() {
    const f = ownedLandRectCells(0);
    let fallback = null;
    for (let tries = 0; tries < 80; tries++) {
      const side = Math.floor(Math.random() * 4);
      const off = 3 + Math.random() * 8;
      let p;
      if (side === 0) p = { x: f.c0 + Math.random() * (f.c1 - f.c0), y: f.r0 - off };
      else if (side === 1) p = { x: f.c1 + off, y: f.r0 + Math.random() * (f.r1 - f.r0) };
      else if (side === 2) p = { x: f.c0 + Math.random() * (f.c1 - f.c0), y: f.r1 + off };
      else p = { x: f.c0 - off, y: f.r0 + Math.random() * (f.r1 - f.r0) };
      const out = { x: clamp(p.x, 0.5, COLS - 0.5), y: clamp(p.y, 0.5, ROWS - 0.5), side };
      fallback = fallback || out;
      if (!isOwnedPoint(out.x, out.y)) return out;
    }
    return fallback;
  }
  // 시작 필드 안쪽의 목표 지점
  function insideGoal() {
    const f = startFieldRect();
    return { x: f.c0 + 6 + Math.random() * (f.c1 - f.c0 - 12), y: f.r0 + 6 + Math.random() * (f.r1 - f.r0 - 12) };
  }
  // 외부 출신 개체 생성. 야생 가족은 wild=true, 적대 침입은 wild=false + invade=true.
  function spawnIntruder(data, x, y, opts) {
    const a = Math.random() * Math.PI * 2;
    if (data) data.externalOrigin = !(opts && (opts.invade || opts.raider));
    if (data && opts && opts.invade && S.difficulty === 'dokura' && !data._dokuraHpApplied) {
      data._dokuraHpApplied = true;
      data.hpScale = (data.hpScale || 1) * 2;
      G.Creatures.ensureVitals(data);
      data.hp = G.Creatures.hpMaxOf(data);
    }
    if (!(opts && opts.allowOwnedSpawn) && isOwnedPoint(x, y)) {
      const p = edgeSpawnPoint();
      x = p.x; y = p.y;
    }
    S.wanderers.push(Object.assign({
      data, gx: clamp(x, 0.5, COLS - 0.5), gy: clamp(y, 0.5, ROWS - 0.5),
      vx: Math.cos(a), vy: Math.sin(a), t: 0, boardCd: 0, wild: true,
    }, opts || {}));
  }
  // 외부 실장석 가족: 성체 1 + 새끼 1~3마리가 안으로 기어들어옴 → 일반 배회 실장석
  function spawnIntruderFamily() {
    const envKeys = Object.keys(S.ownedLand || {}).filter(key => {
      const e = landEnvironmentKey(key);
      return S.ownedLand[key] && (e === 'park' || e === 'downtown');
    });
    let p, goal;
    if (envKeys.length) {
      const key = envKeys[Math.floor(Math.random() * envKeys.length)], gp = parseLandKey(key), n = C.LAND_GRID_SIZE || 48;
      p = { x: gp.gx * n + 1.5, y: gp.gy * n + 1.5, side: 0 };
      goal = { x: gp.gx * n + n / 2, y: gp.gy * n + n / 2 };
    } else {
      p = edgeSpawnPoint(); goal = insideGoal();
    }
    const adult = G.Creatures.newWild('성체실장');
    const members = [adult];
    const kidTypes = ['자실장', '엄지', '구더기'];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) members.push(G.Creatures.breed(adult.stats, kidTypes[Math.floor(Math.random() * kidTypes.length)]));
    members.forEach(m => { m.externalOrigin = true; });
    members.forEach(m => spawnIntruder(m, p.x + (Math.random() - 0.5) * 2, p.y + (Math.random() - 0.5) * 2, {
      goal: { x: goal.x + (Math.random() - 0.5) * 4, y: goal.y + (Math.random() - 0.5) * 4 },
    }));
    if (G.UI && G.UI.onTutorialWildIntrusion) G.UI.onTutorialWildIntrusion(p);
    if (G.UI.flash) G.UI.flash('야생 실장석 가족이 공장 안으로 기어들어옵니다…');
  }
  function tickAmbientEnvironmentInvaders(dt) {
    if (!S.ambientInvaderTimers) S.ambientInvaderTimers = {};
    for (const key of Object.keys(revealedLandKeys())) {
      if (!landKeyInWorld(key)) continue;
      const envKey = landEnvironmentKey(key);
      if (envKey !== 'redzone' && envKey !== 'bunker') continue;
      if (S.ending && S.ending.gridKey === key && !S.ending.accepted) continue;
      if (envKey === 'redzone') maintainRedzoneResidents(key);
      let timer = +S.ambientInvaderTimers[key];
      if (!(timer > 0)) timer = envKey === 'redzone' ? 70 + Math.random() * 80 : 100 + Math.random() * 100;
      timer -= dt;
      if (timer <= 0) {
        spawnAmbientEnvironmentInvader(key, envKey);
        timer = envKey === 'redzone' ? 70 + Math.random() * 80 : 100 + Math.random() * 100;
      }
      S.ambientInvaderTimers[key] = timer;
    }
  }
  function maintainRedzoneResidents(key) {
    if (!S.environmentResidentsSeeded) S.environmentResidentsSeeded = {};
    if (S.environmentResidentsSeeded[key]) return;
    spawnAmbientEnvironmentInvader(key, 'redzone', { count: 3, resident: true, silent: true });
    S.environmentResidentsSeeded[key] = true;
  }
  function spawnAmbientEnvironmentInvader(key, envKey, opts) {
    opts = opts || {};
    const p = parseLandKey(key), n = C.LAND_GRID_SIZE || 48;
    const lvl = envKey === 'bunker' ? 5 : Math.max(1, Math.min(5, 2 + Math.floor(landDistance(key) / 2)));
    let count = opts.count || (envKey === 'bunker' ? 2 : 1 + Math.floor(Math.random() * 2));
    if (envKey === 'redzone') {
      const current = S.wanderers.filter(w =>
        !w._dead && w.ambient && w.environmentGridKey === key
      ).length;
      count = Math.min(count, Math.max(0, 10 - current));
    }
    for (let i = 0; i < count; i++) {
      const data = makeInvaderAdult(lvl);
      const x = p.gx * n + 2 + Math.random() * Math.max(1, n - 4);
      const y = p.gy * n + 2 + Math.random() * Math.max(1, n - 4);
      spawnIntruder(data, x, y, {
        wild: false, raider: true, invade: true, ambient: true, formalRaid: false, invadeLvl: lvl,
        environmentResident: !!opts.resident, environmentGridKey: key,
        home: { x, y }, raidT: opts.resident ? 1e9 : C.RAID_DURATION * 3, ate: 0,
        goal: opts.resident ? { x: p.gx * n + n / 2, y: p.gy * n + n / 2 } : insideGoal(),
        allowOwnedSpawn: true,
      });
    }
  }
  // 현재 침입 단계(0~5) — 누적 매출이 임계값을 넘을 때마다 +1
  // 소유한 그리드 수 (시작 필드 1 + 구매한 외부 그리드)
  function ownedGridCount() {
    let n = 1;
    for (const k in S.ownedLand) if (S.ownedLand[k]) n++;
    return n;
  }
  function invasionMaxLevel() {
    const n = ownedGridCount(), th = C.INVADE_GRID_THRESHOLDS || [2, 4, 7, 10];
    let lvl = 0;
    for (const t of th) if (n >= t) lvl++;
    return Math.min(5, lvl);
  }
  const INVADE_BABY_TYPES = ['자실장', '엄지', '구더기'];
  const BABY_TYPES = new Set(['구더기', '엄지', '자실장', '새끼사육실장', '새끼독라']);
  // 단계 보너스를 적용한 침입 성체
  function makeInvaderAdult(lvl) {
    const data = G.Creatures.newWild('성체실장');
    const sb = (C.INVADE_STAT_PER_LV || 18) * lvl;
    data.stats.육질 = clamp((data.stats.육질 || 0) + sb, 1, statMax());
    data.stats.개념 = clamp((data.stats.개념 || 0) + sb, 1, statMax());
    data.stats.크기 = clamp((data.stats.크기 || 0) + sb, 1, sizeMax());
    data.invadeTag = '침입';
    return data;
  }
  // 침입 개체 1마리 배치(성체/새끼 공용). 최대 체력 = 크기×hpScale(레이드 누적 보정).
  function spawnOneInvader(data, x, y, lvl, p, hpScale) {
    data.hpScale = hpScale || 1;
    G.Creatures.ensureVitals(data);
    data.hp = G.Creatures.hpMaxOf(data);
    const ending = endingState();
    const pad = endingLaunchpad();
    const endingRaid = !!(ending.accepted && ending.stage >= 1 && ending.stage <= 2 && pad);
    spawnIntruder(data, x, y, {
      wild: false, raider: true, invade: true, formalRaid: true, invadeLvl: lvl,
      endingRaid,
      home: { x: p.x, y: p.y }, raidT: C.RAID_DURATION * 2, ate: 0,
      goal: endingRaid ? { x: pad.col + pad.w / 2, y: pad.row + pad.h / 2 } : insideGoal(),
      allowOwnedSpawn: true,
    });
  }
  function makeRaidSpawnEntry(p, maxLvl, hpScale) {
    const lvl = Math.floor(Math.random() * (maxLvl + 1));
    const adult = makeInvaderAdult(lvl);
    const entries = [{ data: adult, lvl, hpScale }];
    if (lvl === 0) {
      const bn = (C.INVADE_BABY_MIN || 1) + Math.floor(Math.random() * ((C.INVADE_BABY_MAX || 3) - (C.INVADE_BABY_MIN || 1) + 1));
      for (let k = 0; k < bn; k++) {
        const bt = INVADE_BABY_TYPES[Math.floor(Math.random() * INVADE_BABY_TYPES.length)];
        const baby = G.Creatures.breed(adult.stats, bt);
        baby.invadeTag = '침입';
        entries.push({ data: baby, lvl: 0, hpScale });
      }
    }
    return entries;
  }
  function updateRaidSpawnQueue(dt) {
    const q = S.raidSpawnQueue;
    if (!q || !q.entries || !q.entries.length) return;
    S.raidSpawnT = (S.raidSpawnT || 0) - dt;
    if (S.raidSpawnT > 0) return;
    S.raidSpawnT = C.RAID_SPAWN_INTERVAL || 0.35;
    const e = q.entries.shift();
    const p = q.point || raidSpawnPoint();
    const spread = C.RAID_SPAWN_SPREAD || 5;
    const ax = p.x + (Math.random() - 0.5) * spread;
    const ay = p.y + (Math.random() - 0.5) * spread;
    spawnOneInvader(e.data, ax, ay, e.lvl || 0, p, e.hpScale || 1);
    if (!q.entries.length) { S.raidSpawnQueue = null; S.raidSpawnT = 0; }
  }
  // 레이드 규모: 첫 5마리 → 레이드마다 +STEP, 최대 50. 상한 도달 후엔 수 대신 HP만 증가.
  function raidScale() {
    const num = S.raidNum || 0;
    const base = C.RAID_BASE_COUNT || 5, step = C.RAID_COUNT_STEP || 3, max = C.RAID_MAX_COUNT || 50;
    const count = Math.max(1, Math.ceil(Math.min(max, base + num * step) * raidCountMult()));
    const rampRaids = Math.ceil((max - base) / step);          // 수가 상한에 닿는 데 걸리는 레이드 수
    const extra = Math.max(0, num - rampRaids);                 // 상한 이후 추가 레이드 수
    const hpScale = 1 + extra * (C.RAID_HP_STEP || 0.15);
    return { count, hpScale };
  }
  function colonyGoal() {
    const c = S.buildings.find(b => b.type === 'colony') || S.buildings.find(b => b.colony);
    return c ? { x: c.col + c.w / 2, y: c.row + c.h / 2 } : insideGoal();
  }
  // 침입 무리: 0~현재단계 성체가 섞여 옴. 새끼는 0단계 성체에만 동행. 새끼·음식을 노림.
  function spawnRaid() {
    const p = (S.raidWarned && S.raidPoint) ? S.raidPoint : (validRaidSpawnPoint(S.raidPoint) ? S.raidPoint : raidSpawnPoint());
    const maxLvl = invasionMaxLevel();
    const sc = raidScale();
    const endingActive = endingState().accepted && endingState().stage === 1;
    const n = endingActive ? Math.min(12, sc.count) : sc.count;
    const raidHpScale = sc.hpScale * (endingActive ? 1 + (endingState().raidCount || 0) * 0.5 : 1);
    const entries = [];
    for (let i = 0; i < n; i++) {
      makeRaidSpawnEntry(p, maxLvl, raidHpScale).forEach(e => entries.push(e));
    }
    S.raidNum = (S.raidNum || 0) + 1;
    if (endingState().accepted && endingState().stage === 1) endingState().raidCount = (endingState().raidCount || 0) + 1;
    S.raidSpawnQueue = { point: p, entries };
    S.raidSpawnT = 0;
    if (G.UI.flash) G.UI.flash('⚠ ' + entries.length + '마리의 분충들이 침입중!');
  }
  // 우리 안에 새끼가 있는지
  function penHasBaby(pen) {
    for (const c of pen.creatures) if (BABY_TYPES.has(c.type)) return true;
    return false;
  }
  function penHasCreature(pen) { return pen.creatures && pen.creatures.length > 0; }
  // 침입 AI: 배회/벨트 위 새끼 또는 벨트 음식을 노림. 없으면 새끼 든 우리로 침입(경계 무시).
  function updateInvaderAI(w, dt, consumed) {
    if (w.endingCinematic) {
      if (!w.goal) {
        const pad = endingLaunchpad();
        if (pad) {
          const a = Math.random() * Math.PI * 2, radius = 3.5 + Math.random() * 4;
          w.goal = { x: pad.col + pad.w / 2 + Math.cos(a) * radius, y: pad.row + pad.h / 2 + Math.sin(a) * radius };
        }
      }
      return;
    }
    w.seekCd = (w.seekCd || 0) - dt;
    let tgt = w._tgt, valid = false;
    if (tgt) {
      if (tgt.kind === 'wander') valid = !tgt.ref._dead && S.wanderers.includes(tgt.ref);
      else if (tgt.kind === 'cargo') valid = !tgt.ref._dead && S.cargo.includes(tgt.ref);
      else if (tgt.kind === 'pen') valid = S.buildings.includes(tgt.ref) && penHasCreature(tgt.ref);
      else if (tgt.kind === 'launchpad') valid = S.buildings.includes(tgt.ref) && endingState().stage < 3;
    }
    if (!valid || w.seekCd <= 0) { w.seekCd = 0.5 + Math.random() * 0.5; tgt = findInvaderTarget(w); w._tgt = tgt; }
    if (w.atkCd > 0) w.atkCd -= dt;
    if (!tgt) { w.goal = w.endingRaid ? endingGoal() : colonyGoal(); w.t = Math.min(w.t, 0.2); return; }   // 표적 없음 → 목표 시설 압박
    let tx, ty;
    if (tgt.kind === 'pen') {
      // 우리 안 가장 가까운 실장석을 추격(작은 우리에서 빠져나가지 않도록)
      const pn = tgt.ref; let best = null, bd = Infinity;
      for (const c of pn.creatures) { const d = Math.hypot((pn.col + (c.px || 0.5)) - w.gx, (pn.row + (c.py || 0.5)) - w.gy); if (d < bd) { bd = d; best = c; } }
      if (best) { tx = pn.col + (best.px || 0.5); ty = pn.row + (best.py || 0.5); }
      else { tx = pn.col + pn.w / 2; ty = pn.row + pn.h / 2; }
    }
    else if (tgt.kind === 'launchpad') { tx = tgt.ref.col + tgt.ref.w / 2; ty = tgt.ref.row + tgt.ref.h / 2; }
    else { tx = tgt.ref.gx; ty = tgt.ref.gy; }
    w.goal = { x: tx, y: ty }; w.t = Math.min(w.t, 0.2);
    const reach = C.INVADE_REACH || 0.9;
    const near = (tgt.kind === 'pen') ? pointInPen(tgt.ref, w.gx, w.gy)
      : (tgt.kind === 'launchpad' ? distToRect(w.gx, w.gy, { c0: tgt.ref.col, r0: tgt.ref.row, c1: tgt.ref.col + tgt.ref.w, r1: tgt.ref.row + tgt.ref.h }) <= reach
        : Math.hypot(tx - w.gx, ty - w.gy) <= reach);
    if (near) {
      if (tgt.kind === 'pen' || tgt.kind === 'launchpad') { if ((w.atkCd || 0) <= 0) { invaderEat(w, tgt, consumed); w.atkCd = C.INVADE_ATK_INTERVAL || 0.8; } }
      else invaderEat(w, tgt, consumed);
    }
  }
  function pointInPen(pen, gx, gy) {
    const c = Math.floor(gx), r = Math.floor(gy);
    return penAbsCells(pen).some(cell => cell.c === c && cell.r === r);
  }
  function findInvaderTarget(w) {
    const sight = C.LABOR_SIGHT || 60;
    let best = null, bd = sight, br = Infinity;
    function rankAt(gx, gy) { return isOwnedCell(Math.floor(gx), Math.floor(gy)) ? 0 : 1; }
    function consider(kind, ref, gx, gy) {
      const d = Math.hypot(gx - w.gx, gy - w.gy);
      if (d > sight) return;
      const r = rankAt(gx, gy);
      if (r < br || (r === br && d < bd)) { br = r; bd = d; best = { kind, ref }; }
    }
    if (w.endingRaid) {
      const pad = endingLaunchpad();
      if (pad) {
        if (endingState().stage === 2) {
          consider('launchpad', pad, pad.col + pad.w / 2, pad.row + pad.h / 2);
          return best;
        }
        for (const cg of endingNearbyBeltCargo) {
          if (cg._dead) continue;
          consider('cargo', cg, cg.gx, cg.gy);
        }
        consider('launchpad', pad, pad.col + pad.w / 2, pad.row + pad.h / 2);
        return best;
      }
    }
    // 1) 배회 중인 새끼(노동석/침입 제외)
    for (const t of nearbyWanderers(w.gx, w.gy, bd)) {
      if (t === w || t._dead || t.invade || t.data.labor) continue;
      if (!BABY_TYPES.has(t.data.type)) continue;
      consider('wander', t, t.gx, t.gy);
    }
    // 2) 벨트 위 새끼/음식 화물
    for (const cg of nearbyCargo(w.gx, w.gy, sight)) {
      if (cg._dead) continue;
      const isBaby = BABY_TYPES.has(cg.data.type), isFood = EDIBLE.has(cg.data.type);
      if (isFood && cg.data.raidMeat) continue;
      if (!isBaby && !isFood) continue;
      consider('cargo', cg, cg.gx, cg.gy);
    }
    // 3) 실장석이 있는 가장 가까운 우리(경계 무시하고 침입해 공격)
    for (const b of frameCache.pens) {
      if (!penHasCreature(b)) continue;
      consider('pen', b, b.col + b.w / 2, b.row + b.h / 2);
    }
    return best;
  }
  // 침입 개체가 표적을 덮침: 배회/벨트 새끼는 잡아먹고, 음식은 약탈, 우리 안 실장석은 공격
  function invaderEat(w, tgt, consumed) {
    if (tgt.kind === 'wander') {
      const t = tgt.ref; t._dead = true; consumed.push(t);
      burstAt(t.gx, t.gy); stainAt(t.gx, t.gy);
      w.ate = (w.ate || 0) + 1; w._tgt = null; w.goal = null; w.seekCd = 0;
      w.data.speech = '우마우마한데스!'; w.data.speechT = 1.6;
    } else if (tgt.kind === 'cargo') {
      const cg = tgt.ref;
      takeCargoUnit(cg);
      if (cg._dead) { const i = S.cargo.indexOf(cg); if (i >= 0) S.cargo.splice(i, 1); }
      burstAt(cg.gx, cg.gy);
      w.ate = (w.ate || 0) + 1; w._tgt = null; w.goal = null; w.seekCd = 0;
      w.data.speech = '우마우마한데스!'; w.data.speechT = 1.6;
    } else if (tgt.kind === 'pen') {
      const pen = tgt.ref;
      if (!pen.creatures.length) { w._tgt = null; w.goal = null; return; }
      // 가장 가까운 우리 안 실장석을 공격
      let best = null, bd = Infinity, bi = -1;
      for (let i = 0; i < pen.creatures.length; i++) {
        const c = pen.creatures[i];
        const d = Math.hypot((pen.col + (c.px || 0.5)) - w.gx, (pen.row + (c.py || 0.5)) - w.gy);
        if (d < bd) { bd = d; best = c; bi = i; }
      }
      G.Creatures.ensureVitals(best); best.hit = 0.3;
      best.hp = (best.hp || 0) - (C.INVADE_ATK || 12);
      const gx = pen.col + (best.px || 0.5), gy = pen.row + (best.py || 0.5);
      for (let k = 0; k < 5; k++) spawnParticle(gx * CELL, gy * CELL, '#e23a2a');
      if (best.hp <= 0) { pen.creatures.splice(bi, 1); burstAt(gx, gy); stainAt(gx, gy); w.ate = (w.ate || 0) + 1; }
      w.data.speech = '분충들을 먹어치우는데스!'; w.data.speechT = 1.4;
      // 타깃(우리) 유지 — updateInvaderAI가 다음 프레임 가장 가까운 실장석으로 재조준
    } else if (tgt.kind === 'launchpad') {
      const e = endingState();
      if (e.stage < 3) e.scrap = Math.max(0, Number(e.scrap || 0) - (1 + Math.floor(Math.random() * 3)));
      w.data.speech = '낙원으로 가는 배는 와타시것인데스!'; w.data.speechT = 1.4;
    }
  }
  function endingGoal() {
    const pad = endingLaunchpad();
    return pad ? { x: pad.col + pad.w / 2, y: pad.row + pad.h / 2 } : colonyGoal();
  }
  // 가장 가까운 음식 화물
  function nearestEdibleCargo(gx, gy, eater) {
    let best = null, bd = C.LABOR_SIGHT || 60;
    for (const cg of nearbyCargo(gx, gy, bd)) {
      if (!EDIBLE.has(cg.data.type)) continue;
      if (SPECIAL_TREATS.has(cg.data.type) && (Math.abs(cg.gx - gx) > 4.5 || Math.abs(cg.gy - gy) > 4.5)) continue;
      if ((eater && (eater.raider || eater.invade)) && cg.data.raidMeat) continue;
      const d = Math.hypot(cg.gx - gx, cg.gy - gy);
      if (d < bd) { bd = d; best = cg; }
    }
    return best;
  }
  function nearestSpecialTreatCargo(gx, gy, range) {
    let best = null, bd = range == null ? 4.5 : range;
    for (const cg of nearbyCargo(gx, gy, bd)) {
      if (!SPECIAL_TREATS.has(cg.data.type)) continue;
      if (Math.abs(cg.gx - gx) > bd || Math.abs(cg.gy - gy) > bd) continue;
      const d = Math.hypot(cg.gx - gx, cg.gy - gy);
      if (d < bd) { bd = d; best = cg; }
    }
    return best;
  }
  function applySpecialTreatEffect(data, type, gx, gy) {
    if (!data || !SPECIAL_TREATS.has(type)) return false;
    if (type === '콘페이토') {
      G.Creatures.ensureVitals(data);
      data.행복 = C.CREATURE_HAPPY_MAX || 100;
      data.happyCircuit = false;
      data.speech = '달콤한데스!';
      data.speechT = 2.2;
      for (let k = 0; k < 8; k++) spawnParticle(gx * CELL, gy * CELL, '#ff8fd8');
      return false;
    }
    if (type === '도돈파') {
      data.speech = '운치가 나오는테치!';
      data.speechT = 2.2;
      for (let i = 0; i < 10; i++) dropFloorCargo(resourceCargoData('운치'), Math.floor(gx + (Math.random() - 0.5) * 2), Math.floor(gy + (Math.random() - 0.5) * 2));
      return false;
    }
    if (type === '코로리') {
      const meat = G.Creatures.makeProduct('실장육', data);
      dropFloorCargo(meat, Math.floor(gx), Math.floor(gy));
      burstAt(gx, gy); stainAt(gx, gy);
      return true;
    }
    if (type === '도로리') {
      const minced = G.Creatures.makeProduct('분쇄육', data);
      for (let k = 0; k < 34; k++) spawnParticle(gx * CELL, gy * CELL, k % 2 ? '#bb79ff' : '#a55');
      dropFloorCargo(minced, Math.floor(gx), Math.floor(gy));
      stainAt(gx, gy);
      return true;
    }
    return false;
  }
  // 근처 음식 화물 1개를 먹어치움 → "우마우마한~" (성장 상태별 어미)
  function tryEatNearby(w, range) {
    for (const cg of nearbyCargo(w.gx, w.gy, range)) {
      if (cg._dead) continue;
      if (!EDIBLE.has(cg.data.type)) continue;
      if ((w.raider || w.invade) && cg.data.raidMeat) continue;
      if (Math.hypot(cg.gx - w.gx, cg.gy - w.gy) > range) continue;
      const eaten = takeCargoUnit(cg);
      if (cg._dead) {
        const i = S.cargo.indexOf(cg);
        if (i >= 0) S.cargo.splice(i, 1);
      }
      if (!eaten) continue;
      const killed = applySpecialTreatEffect(w.data, eaten.type, w.gx, w.gy);
      if (killed) { w._dead = true; return true; }
      const line = (G.LINES.eat && (G.LINES.eat[w.data.type] || G.LINES.eat.성체실장)) || '우마우마한데스';
      w.data.speech = line; w.data.speechT = 2.2;
      for (let k = 0; k < 6; k++) spawnParticle(cg.gx * CELL, cg.gy * CELL, '#e8d37a');
      return true;
    }
    return false;
  }

  // 실장석 대사: 말하는 중이면 시간만 감소, 아니면 간헐적으로 table에서 대사 선택
  function tickTalk(data, dt, table) {
    if (data.speechT > 0) { data.speechT -= dt; return; }
    if (!table) return;
    data.speakCd = (data.speakCd != null ? data.speakCd : 3 + Math.random() * 5) - dt;
    if (data.speakCd <= 0) {
      data.speakCd = 5 + Math.random() * 7;
      let line = table[data.type];
      if (Array.isArray(line)) line = line[Math.floor(Math.random() * line.length)];   // 다양한 대사 중 랜덤
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
  // 월드 좌표 위로 떠오르는 일회성 텍스트(예: 분쇄육 변신 대사)
  const floatTexts = [];
  function floatText(text, gx, gy, color) {
    floatTexts.push({ text, x: gx * CELL, y: gy * CELL, life: 1.8, max: 1.8, color: color || '#fff' });
  }
  function updateFloatTexts(dt) {
    if (!floatTexts.length) return;
    for (const f of floatTexts) { f.y -= 22 * dt; f.life -= dt; }
    for (let i = floatTexts.length - 1; i >= 0; i--) if (floatTexts[i].life <= 0) floatTexts.splice(i, 1);
  }
  function drawFloatTexts() {
    if (!floatTexts.length) return;
    ctx.save(); ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3;
    for (const f of floatTexts) {
      const gx = f.x / CELL, gy = f.y / CELL;
      if (gx < renderView.x0 - 1 || gx > renderView.x1 + 1 || gy < renderView.y0 - 1 || gy > renderView.y1 + 1) continue;
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
  function updateCoinEffects(dt) {
    for (let i = coinEffects.length - 1; i >= 0; i--) {
      const c = coinEffects[i];
      c.t += dt;
      const u = clamp(c.t / c.dur, 0, 1);
      const ease = 1 - Math.pow(1 - u, 3);
      const x = c.sx + (c.tx - c.sx) * ease;
      const y = c.sy + (c.ty - c.sy) * ease - Math.sin(u * Math.PI) * c.arc;
      c.el.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.25 * u})`;
      c.el.style.opacity = String(1 - Math.max(0, u - 0.72) / 0.28);
      if (u >= 1) {
        c.el.remove();
        coinEffects.splice(i, 1);
      }
    }
  }
  function drawParticles() {
    for (const p of S.particles) {
      const gx = p.x / CELL, gy = p.y / CELL;
      if (gx < renderView.x0 - 1 || gx > renderView.x1 + 1 || gy < renderView.y0 - 1 || gy > renderView.y1 + 1) continue;
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
      const gx = s.x / CELL, gy = s.y / CELL;
      if (gx < renderView.x0 - 1 || gx > renderView.x1 + 1 || gy < renderView.y0 - 1 || gy > renderView.y1 + 1) continue;
      ctx.globalAlpha = 0.5 * (s.life == null ? 1 : Math.max(0, s.life / (s.max || 30)));
      for (const d of s.dots) { ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(s.x + d.dx, s.y + d.dy, d.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }

  function laborEdgeBlocked(c, r, nc, nr) {
    if (nc > c) return !!S.walls['V|' + (c + 1) + '|' + r];
    if (nc < c) return !!S.walls['V|' + c + '|' + r];
    if (nr > r) return !!S.walls['H|' + c + '|' + (r + 1)];
    if (nr < r) return !!S.walls['H|' + c + '|' + r];
    return false;
  }
  function laborStraightBlocked(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist * 4));
    let c = Math.floor(x0), r = Math.floor(y0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, nx = x0 + (x1 - x0) * t, ny = y0 + (y1 - y0) * t;
      const nc = Math.floor(nx), nr = Math.floor(ny);
      if (nc !== c) {
        const stepC = c + Math.sign(nc - c);
        if (laborEdgeBlocked(c, r, stepC, r)) return true;
        c = stepC;
      }
      if (nr !== r) {
        const stepR = r + Math.sign(nr - r);
        if (laborEdgeBlocked(c, r, c, stepR)) return true;
        r = stepR;
      }
    }
    return false;
  }
  function laborPathfind(w, goal) {
    const sc = clamp(Math.floor(w.gx), 0, COLS - 1), sr = clamp(Math.floor(w.gy), 0, ROWS - 1);
    const gc = clamp(Math.floor(goal.x), 0, COLS - 1), gr = clamp(Math.floor(goal.y), 0, ROWS - 1);
    if (!laborStraightBlocked(w.gx, w.gy, goal.x, goal.y)) return [];
    const margin = 12;
    const minC = Math.max(0, Math.min(sc, gc) - margin), maxC = Math.min(COLS - 1, Math.max(sc, gc) + margin);
    const minR = Math.max(0, Math.min(sr, gr) - margin), maxR = Math.min(ROWS - 1, Math.max(sr, gr) + margin);
    const startKey = sc + '|' + sr, goalKey = gc + '|' + gr;
    const open = [];
    const heapPush = node => {
      open.push(node);
      let i = open.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (open[p].f <= node.f) break;
        open[i] = open[p]; i = p;
      }
      open[i] = node;
    };
    const heapPop = () => {
      const root = open[0], tail = open.pop();
      if (open.length && tail) {
        let i = 0;
        while (true) {
          const l = i * 2 + 1, r = l + 1;
          if (l >= open.length) break;
          const child = r < open.length && open[r].f < open[l].f ? r : l;
          if (open[child].f >= tail.f) break;
          open[i] = open[child]; i = child;
        }
        open[i] = tail;
      }
      return root;
    };
    heapPush({ c: sc, r: sr, g: 0, f: Math.abs(gc - sc) + Math.abs(gr - sr) });
    const best = new Map([[startKey, 0]]), came = new Map();
    let expanded = 0;
    while (open.length && expanded < 5000) {
      const cur = heapPop(), curKey = cur.c + '|' + cur.r;
      if (cur.g !== best.get(curKey)) continue;
      if (curKey === goalKey) {
        const cells = [];
        let key = goalKey;
        while (key !== startKey) {
          const p = key.split('|');
          cells.push({ x: +p[0] + 0.5, y: +p[1] + 0.5 });
          key = came.get(key);
          if (!key) return null;
        }
        cells.reverse();
        const path = [];
        let ax = w.gx, ay = w.gy;
        for (let i = 0; i < cells.length; i++) {
          const next = cells[i], after = cells[i + 1];
          if (!after || laborStraightBlocked(ax, ay, after.x, after.y)) {
            path.push(next); ax = next.x; ay = next.y;
          }
        }
        path.push({ x: goal.x, y: goal.y });
        return path;
      }
      expanded++;
      for (const d of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nc = cur.c + d[0], nr = cur.r + d[1];
        if (nc < minC || nc > maxC || nr < minR || nr > maxR) continue;
        if (laborEdgeBlocked(cur.c, cur.r, nc, nr)) continue;
        const nk = nc + '|' + nr, ng = cur.g + 1;
        if (best.has(nk) && best.get(nk) <= ng) continue;
        best.set(nk, ng); came.set(nk, curKey);
        heapPush({ c: nc, r: nr, g: ng, f: ng + Math.abs(gc - nc) + Math.abs(gr - nr) });
      }
    }
    return null;
  }
  function laborNavigationTarget(w, dt) {
    if (!w.goal) { w._path = null; w._pathGoal = null; return null; }
    w._pathRetry = Math.max(0, (w._pathRetry || 0) - dt);
    const goalKey = Math.floor(w.goal.x) + '|' + Math.floor(w.goal.y);
    if (w._pathGoal !== goalKey || (!w._path && w._pathRetry <= 0)) {
      w._path = laborPathfind(w, w.goal);
      w._pathGoal = goalKey;
      w._pathRetry = 2.25 + Math.random() * 0.75;
    }
    while (w._path && w._path.length && Math.hypot(w._path[0].x - w.gx, w._path[0].y - w.gy) < 0.45) w._path.shift();
    return w._path && w._path.length ? w._path[0] : w.goal;
  }

  // 배회 개체: 자유 이동 + 가공시설 진입 시 처리
  function updateWanderers(dt) {
    if (!S.wanderers.length) return;
    const PROC = ['slaughter', 'deshell', 'correction', 'grinder', 'washbasin', 'mixer', 'cookery', 'acidgen'];
    const consumed = [];
    for (const w of S.wanderers) {
      if (w._dead) continue;   // 같은 프레임에 노동석이 회수/처치한 개체
      const envEffects = (environmentAtPoint(w.gx, w.gy).effects || {});
      if (envEffects.healthDrain && G.CREATURES[w.data.type]) {
        G.Creatures.ensureVitals(w.data);
        w.data.hp = Math.max(0, (w.data.hp || 0) - envEffects.healthDrain * dt);
        if (w.data.hp <= 0) {
          w._dead = true;
          S.cargo.push(makeCargo(G.Creatures.makeProduct('분쇄육', { stats: w.data.stats || {} }), Math.floor(w.gx), Math.floor(w.gy)));
          continue;
        }
      }
      if (envEffects.mutation && w.data.stats && Math.random() < 0.002 * dt) {
        const keys = ['육질', '개념', '크기'], key = keys[Math.floor(Math.random() * keys.length)];
        const delta = Math.random() < 0.5 ? -5 : 5;
        w.data.stats[key] = clamp((w.data.stats[key] || 0) + delta, 0, key === '크기' ? sizeMax() : statMax());
      }
      G.Creatures.ageSlime(w.data, dt);  // 점액덩어리 숙성
      if (w.data.happyCircuit) {
        G.Creatures.tickHappyCircuit(w.data, dt);
        if ((w.data.hp || 0) <= 0) {
          w._dead = true;
          S.cargo.push(makeCargo(G.Creatures.makeProduct('분쇄육', { stats: w.data.stats || {} }), Math.floor(w.gx), Math.floor(w.gy)));
          continue;
        }
      }
      if (!w.data.labor && (w.data.type === '독라' || w.data.type === '새끼독라')) G.Creatures.changeHappy(w.data, -0.2 * dt);
      if (!w.raider && !w.invade && !w.data.labor) feedCreatureInZone(w.data, w.gx, w.gy, dt);
      if (!w.data.labor) tickTalk(w.data, dt, G.LINES.wander);  // 배회 대사
      // 행복회로: 그 자리에서 움직이지 않음(적/노동석 제외)
      if (w.data.happyCircuit && !w.raider && !w.invade && !w.data.labor) continue;
      let sp = (C.WANDER_SPEED[w.data.type] || 0.6) * C.MOVE_SCALE;
      if (w.data.labor) sp *= laborSpeedMult(w.data);
      if (w.boardCd > 0) w.boardCd -= dt;
      if (w.data.labor) updateLaborAI(w, dt, consumed);   // 노동석: 명령 수행
      if (!w.data.labor && !w.leaving && !w.endingRaid) {
        w.treatCd = (w.treatCd || 0) - dt;
        const treat = nearestSpecialTreatCargo(w.gx, w.gy, 4.5);
        if (treat) {
          w.goal = { x: treat.gx, y: treat.gy };
          w.t = 0;
          if (w.treatCd <= 0 && tryEatNearby(w, C.EAT_REACH || 0.7)) {
            w.treatCd = 0.4;
            if (w._dead) { consumed.push(w); continue; }
          }
        }
      }
      if (endingState().stage === 2 && (w.raider || w.invade)) {
        w.endingRaid = true;
        w.leaving = false;
        w.raidT = 1e9;
        w.ate = 0;
      }
      // 침입/약탈 AI: 새끼·음식을 노리다 충분히 먹거나 시간이 다 되면 이탈
      if ((w.raider || w.invade) && !w.leaving) {
        if (endingState().stage === 2) {
          if (!w._tgt || w._tgt.kind !== 'launchpad') w._tgt = null;
          w.goal = endingGoal();
        }
        const eatMax = w.invade ? (C.INVADE_EAT_MAX || 6) : C.RAID_EAT_MAX;
        w.raidT = (w.raidT == null ? C.RAID_DURATION : w.raidT) - dt;
        if (!w.endingRaid && !w.environmentResident && (w.raidT <= 0 || (w.ate || 0) >= eatMax)) {
          w.leaving = true; w.leaveT = 45;
          w.goal = w.home ? { x: w.home.x, y: w.home.y } : null;
        } else if (w.invade || w.endingRaid) {
          if (w.data.speechT <= 0 && Math.random() < dt * 0.1) { const L = G.LINES.invade; w.data.speech = L[Math.floor(Math.random() * L.length)]; w.data.speechT = 2.0; }
          updateInvaderAI(w, dt, consumed);
        } else {
          w.seekCd = (w.seekCd || 0) - dt;
          if (w.seekCd <= 0) {
            w.seekCd = 0.8 + Math.random() * 0.6;
            const tgt = nearestEdibleCargo(w.gx, w.gy, w);
            if (tgt) { w.goal = { x: tgt.gx, y: tgt.gy }; w.t = 0; }
            else { w.goal = colonyGoal(); w.t = Math.min(w.t, 0.2); }
          }
          w.biteCd = (w.biteCd || 0) - dt;
          if (w.biteCd <= 0 && tryEatNearby(w, C.EAT_REACH)) { w.biteCd = 1.5; w.ate = (w.ate || 0) + 1; w.goal = null; w.seekCd = 0; if (w._dead) { consumed.push(w); continue; } }
        }
      } else if (w.leaving) {
        w.leaveT = (w.leaveT == null ? 45 : w.leaveT) - dt;
        if (w.leaveT <= 0) { consumed.push(w); continue; }
      }
      w.t -= dt;
      const navTarget = w.data.labor ? laborNavigationTarget(w, dt) : w.goal;
      // 목표 지점이 있으면 그쪽으로 이동(침입/약탈/이탈), 도착하면 해제
      if (navTarget) {
        const dxg = navTarget.x - w.gx, dyg = navTarget.y - w.gy, dg = Math.hypot(dxg, dyg);
        const finalGoal = !w.data.labor || navTarget === w.goal;
        if (dg < (finalGoal ? 0.9 : 0.45)) {
          if (w.data.labor && !finalGoal && w._path && w._path.length) w._path.shift();
          else {
          w.goal = null;
            if (w.data.labor) { w._path = null; w._pathGoal = null; }
          if (w.leaving) { consumed.push(w); continue; }   // 약탈 후 이탈 완료
          }
        } else if (w.t <= 0 || w.data.labor) { w.vx = dxg / dg; w.vy = dyg / dg; w.t = 0.25; }
      }
      if (w.t <= 0) { const a = Math.random() * Math.PI * 2; w.vx = Math.cos(a); w.vy = Math.sin(a); w.t = 0.5 + Math.random() * 1.5; }
      const ox = w.gx, oy = w.gy, inx = ox + w.vx * sp * dt, iny = oy + w.vy * sp * dt;
      if (w.data.labor) {
        // 노동석은 벽과 물리적으로 충돌하지 않고 통과한다. 단, 길찾기(laborPathfind/
        // laborStraightBlocked)는 벽을 막힌 것으로 취급하므로 평소엔 벽을 피해 도는 것처럼
        // 움직이고, 경로를 벗어나도 벽에 끼이지 않는다.
        w.gx = inx; w.gy = iny;
      } else {
        // 침입은 우리 경계 충돌을 무시(벽은 막힘).
        const wallOut = w.invade ? {} : null;
        const nb = wallBlock(ox, oy, inx, iny, w.invade, wallOut, false);
        // 침입 실장석은 벽/문이 가로막으면 공격해 부순다
        if (wallOut && wallOut.hit && w.invade) {
          damageWall(wallOut.hit, (C.INVADE_WALL_DMG || 8) * dt);
          if (w.data.speechT <= 0 && Math.random() < dt * 0.5) { w.data.speech = '벽을 부수는데스!'; w.data.speechT = 1.4; }
          if (Math.random() < dt * 6) spawnParticle(((w.gx + inx) / 2) * CELL, ((w.gy + iny) / 2) * CELL, '#d6a85a');
        }
        if (nb.x !== inx) w.vx = -w.vx;   // 벽에 막히면 반사
        if (nb.y !== iny) w.vy = -w.vy;
        w.gx = nb.x; w.gy = nb.y;
      }
      if (w.gx < 0.5) { w.gx = 0.5; w.vx = Math.abs(w.vx); }
      if (w.gx > COLS - 0.5) { w.gx = COLS - 0.5; w.vx = -Math.abs(w.vx); }
      if (w.gy < 0.5) { w.gy = 0.5; w.vy = Math.abs(w.vy); }
      if (w.gy > ROWS - 0.5) { w.gy = ROWS - 0.5; w.vy = -Math.abs(w.vy); }
      // 일반 배회 실장석도 아주 가끔 근처 벨트 음식을 먹어치움 ("우마우마한~")
      if (!w.raider && !w.data.labor && G.LINES.eat && G.LINES.eat[w.data.type]) {
        w.eatCd = (w.eatCd || 0) - dt;
        if (w.eatCd <= 0 && Math.random() < dt * C.WANDER_EAT_CHANCE && tryEatNearby(w, C.EAT_REACH)) { w.eatCd = C.WANDER_EAT_COOLDOWN; if (w._dead) { consumed.push(w); continue; } }
      }
      // 약탈자/목표 이동 중/노동석은 우리·가공기·벨트에 들어가지 않음
      if (w.raider || w.goal || w.data.labor) continue;
      const c = Math.floor(w.gx), r = Math.floor(w.gy);
      const dev = deviceAt(c, r);
      // 새끼가 우리 안으로 배회해 들어오면 흡수 (성체는 못 들어감)
      if (dev && dev.type === 'penbox') {
        const isAdult = G.CREATURES[w.data.type] && G.CREATURES[w.data.type].isAdult;
        if (!isAdult && G.Pens.countYoung(dev) < G.Pens.capYoung(dev)) { G.Pens.addToPen(dev, w.data, { c, r }); consumed.push(w); continue; }
      }
      if (dev && PROC.includes(dev.type) && dropInto(dev, w.data, { c, r })) { consumed.push(w); continue; }
      // 배회 중 벨트에 올라가면 화물이 되어 자동 이동 (도망 직후 잠시 제외)
      if (w.boardCd <= 0 && isBeltLike(c, r) && countCargoInCell(c, r) < C.BELT_CAP) { S.cargo.push(makeCargo(w.data, c, r)); consumed.push(w); continue; }
    }
    if (consumed.length) {
      const rm = new Set(consumed);
      for (const cw of rm) cw._dead = true;   // 다른 노동석의 목표 무효화
      S.wanderers = S.wanderers.filter(w => !rm.has(w));
    }
    separateWanderers();
  }
  // 배회 개체 충돌 분리(서로 겹치지 않게 밀어냄)
  function collRad(type) { return 0.46 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[type]) || 1); }
  function separateWanderers() {
    const ws = S.wanderers;
    // 개체끼리의 물리 충돌은 침입 실장석 ↔ 노동석 조합에만 적용한다.
    // 일반 실장석끼리 겹치는 것은 허용해 대규모 공장의 충돌 비용을 제거한다.
    rebuildWanderSpatial();
    for (const labor of ws) {
      if (labor._dead || !labor.data || !labor.data.labor) continue;
      for (const invader of nearbyWanderers(labor.gx, labor.gy, 1.2)) {
        if (invader._dead || !invader.invade) continue;
        const dx = invader.gx - labor.gx, dy = invader.gy - labor.gy, d = Math.hypot(dx, dy);
        const min = collRad(labor.data.type) + collRad(invader.data.type);
        if (d <= 0.0001 || d >= min) continue;
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        labor.gx -= ux * push; labor.gy -= uy * push;
        invader.gx += ux * push; invader.gy += uy * push;
      }
    }
    // 특수 장치 충돌: 배회 개체를 분배기/꼬챙이/테치카 몸체 밖으로 밀어냄(노동석/일반 모두)
    if (frameCache.feedZones.length || frameCache.specialColliders.length) {
      for (const w of ws) {
        if (w.raider || w.invade) continue;   // 침입/약탈은 무시(벽으로 막음)
        const p = pushOutOfFeeders(w.gx, w.gy, collRad(w.data.type));
        w.gx = p.x; w.gy = p.y;
      }
    }
    for (const w of ws) { w.gx = clamp(w.gx, 0.5, COLS - 0.5); w.gy = clamp(w.gy, 0.5, ROWS - 0.5); }
  }

  function updateCargo(dt) {
    const remove = [];
    for (const cargo of S.cargo) {
      G.Creatures.ageSlime(cargo.data, dt);  // 점액덩어리 숙성
      if (G.CREATURES[cargo.data.type]) {
        if (cargo.data.happyCircuit) {
          G.Creatures.tickHappyCircuit(cargo.data, dt);
          if ((cargo.data.hp || 0) <= 0) {
            cargo.data = G.Creatures.makeProduct('분쇄육', { stats: cargo.data.stats || {} });
            continue;
          }
        }
        if (G.Creatures.feedGrowth(cargo.data, dt)) playWorldSfx('grow', cargo.gx, cargo.gy);
        tickTalk(cargo.data, dt, G.LINES.belt);  // 벨트 대사
      }
      const cell = cellOf(cargo);
      // 벨트가 아닌 장치 칸에 놓인 바닥 화물(예: 분쇄기 위의 실장육)은 그 장치에 투입 시도
      if (!isBeltLike(cell.c, cell.r)) {
        const devHere = deviceAt(cell.c, cell.r);
        if (devHere && !(devHere.type === 'penbox' && SPECIAL_TREATS.has(cargo.data.type)) && dropInto(devHere, cargo.data, cell)) { cargo._dead = true; remove.push(cargo); continue; }
      }
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
        spawnWanderer(cargo.data, sp.c + 0.5, sp.r + 0.5, 1.5); cargo._dead = true; remove.push(cargo); continue;
      }
      if (!kind) target = sign > 0 ? Math.min(target, center) : Math.max(target, center);
      const ahead = nearestAhead(cargo);
      if (ahead != null) target = sign > 0 ? Math.min(target, ahead - 0.5) : Math.max(target, ahead + 0.5);
      if (cargo.axis === 'h') cargo.gx = target; else cargo.gy = target;

      const nc = cellOf(cargo);
      if (nc.c !== cell.c || nc.r !== cell.r) {
        if (kind && kind !== 'belt') {
          // 장치 칸으로 진입 → dropInto로 일괄 처리(가공/우리/창고/분류기/배합기/조리실/교정/터널 등)
          const d = deviceAt(nc.c, nc.r);
          if (d && !(d.type === 'penbox' && SPECIAL_TREATS.has(cargo.data.type)) && dropInto(d, cargo.data, nc)) { cargo._dead = true; remove.push(cargo); }
        }
        if (!cargo._dead) cargoIdxAdd(cargo);   // 셀을 넘어감 → 새 셀 버킷에 등록
      }
    }
    if (remove.length) { const rm = new Set(remove); S.cargo = S.cargo.filter(c => !rm.has(c)); }
  }

  // 진행 방향 앞 화물 탐색: cargoIdx 주변 버킷만 검사 (|진행축|≤1.6, |수직축|≤0.4 → 전방 3칸 × 수직 3칸)
  function nearestAhead(cargo) {
    const v = DIR.vec[cargo.dir];
    const c0 = Math.floor(cargo.gx), r0 = Math.floor(cargo.gy);
    let best = null;
    for (let step = 0; step <= 2; step++) {
      for (let side = -1; side <= 1; side++) {
        const c = (cargo.axis === 'h') ? c0 + v.x * step : c0 + side;
        const r = (cargo.axis === 'h') ? r0 + side : r0 + v.y * step;
        const list = cargoIdx.get(c + '|' + r);
        if (!list) continue;
        for (const o of list) {
          if (o === cargo || o._dead) continue;
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
      }
    }
    return best;
  }

  function sellCargo(data, source) {
    const type = data.type;
    let base = data.isProduct ? (data.price || 1) : (G.CREATURES[type] ? G.Creatures.priceOf(type, data.stats || {}) : G.Creatures.cargoPrice(data));
    let price = marketSell(type, base);   // 시장 포화 반영
    // 물류센터 업그레이드: 레벨당 판매가 +10%
    if (source && source.type === 'salecenter' && source.up) price = Math.round(price * (1 + source.up * 0.1));
    recordSale(type, price);
    S.money += price; S.soldValue += price;
    if (source) {
      const gx = source.col + (source.w || 1) / 2, gy = source.row + (source.h || 1) / 2;
      playWorldSfx('sell', gx, gy);
      if (source.type === 'salecenter') spawnPackerCoinBurst(gx, gy, 4 + Math.min(6, Math.floor(Math.max(1, price) / 100)));
    } else G.Assets.playSfx('sell');
  }
  function canPackerSell(data) {
    return !!(data && (data.isProduct || data.type === '사육실장' || data.type === '새끼사육실장'));
  }
  function buildingRangeRect(b, size) {
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2;
    const half = (size || 1) / 2;
    return { x: cx - half, y: cy - half, w: size, h: size };
  }
  function powerSupplySizeFor(type, col, row, w, h) {
    let size = POWER_POLES.has(type)
      ? ((C.POWER_POLE_RANGE && C.POWER_POLE_RANGE[type]) || 9)
      : (POWER_PLANTS.has(type) ? ((C.POWER_PLANT_RANGE_BY_TYPE && C.POWER_PLANT_RANGE_BY_TYPE[type]) || C.POWER_PLANT_RANGE || 9) : 0);
    const env = environmentAtPoint(col + (w || 1) / 2, row + (h || 1) / 2);
    if (POWER_POLES.has(type) && env && env.effects && env.effects.poleSupplyRange) size *= env.effects.poleSupplyRange;
    return size;
  }
  function powerSupplyRectFor(type, col, row, w, h) {
    const size = powerSupplySizeFor(type, col, row, w, h);
    if (!size) return null;
    const cx = col + (w || 1) / 2, cy = row + (h || 1) / 2, half = size / 2;
    return { x0: cx - half, y0: cy - half, x1: cx + half, y1: cy + half };
  }
  function rectsTouch(a, b) {
    return !(a.x + a.w <= b.col || a.x >= b.col + b.w || a.y + a.h <= b.row || a.y >= b.row + b.h);
  }
  function powerLinkReach(pole, src) {
    const link = (C.POWER_POLE_LINK && C.POWER_POLE_LINK[pole.type]) || 0;
    if (!link) return false;
    const dx = Math.abs((pole.col + pole.w / 2) - (src.col + src.w / 2));
    const dy = Math.abs((pole.row + pole.h / 2) - (src.row + src.h / 2));
    return dx <= link / 2 && dy <= link / 2;
  }
  function labPowerUse(b) {
    if (b.type !== 'lab') return 0;
    const labs = S.buildings.filter(x => x.type === 'lab').sort((a, c) => a.id - c.id);
    const base = labs.indexOf(b) >= 2 ? ((b.workers && b.workers.length) || 0) * 5 : 0;
    return base * Math.pow(C.LAB_UP_MULT || 1.3, b.labLevel || 0);
  }
  function basePowerUse(b) {
    if (!b) return 0;
    if (b.type === 'lab') return labPowerUse(b);
    if (isGrabberType(b.type)) return 1;
    const def = G.DEVICES[b.type];
    return def ? (def.powerUse || 0) : 0;
  }
  function grabberPriority(b) {
    const n = Number(b && b.priority);
    return Number.isFinite(n) ? clamp(Math.round(n), 1, 5) : 3;
  }
  function grabberPriorityDelay(b) {
    return (grabberPriority(b) - 1) * 0.02;
  }
  function needsRequiredPower(b) {
    if (!b) return false;
    if (b.type === 'lab') return labPowerUse(b) > 0;
    const def = G.DEVICES[b.type];
    return !!(def && def.powerRequired);
  }
  function canUseElectricity(b) {
    const def = b && G.DEVICES[b.type];
    if (!def || POWER_PLANTS.has(b.type) || POWER_POLES.has(b.type)) return false;
    if (!POWERED_CATS.has(def.cat)) return false;
    if (b.type === 'colony' || b.type === 'wall' || b.type === 'door' || b.type === 'warehouse' || b.type === 'penbox') return false;
    if (def.cat === 'logistics' && !isGrabberType(b.type) && b.type !== 'chaosgate') return false;
    return true;
  }
  function deviceWantsPower(b) {
    if (!b) return false;
    if (isGrabberType(b.type)) return !!b.holding || (b.powerActivityT || 0) > 0;
    if (b.type === 'lab') return !!S.currentResearch && !!(b.workers && b.workers.length) && labPowerUse(b) > 0;
    if (b.type === 'reformer') return !!b.item;
    if (b.type === 'acidgen') return !!b.item && outRoom(b) > 0;
    if (b.type === 'techica') return !!b.worker;
    if (b.type === 'catcher') return b.phase !== 'idle' || !!b.target || !!b.holding;
    if (b.type === 'chaosgate') return true;
    if (b.type === 'driller') return outBuffer(b).length < 100 && !!(S.ruins || []).find(r => r.id === b.drillTargetId && ruinInDrillerRange(b, r));
    if (b.type === 'largewarehouse') return largeWarehouseCanOutput(b);
    if (b.type === 'sniper' || b.type === 'mortar' || b.type === 'chaosturret') {
      const cx = b.col + b.w / 2, cy = b.row + b.h / 2, range = turretRange(b);
      if (b.type === 'mortar' && b.manualTarget
        && Math.hypot(b.manualTarget.gx - cx, b.manualTarget.gy - cy) <= range) return true;
      return nearbyWanderers(cx, cy, range).some(w => !w._dead && turretTargets(b, w) && Math.hypot(w.gx - cx, w.gy - cy) <= range);
    }
    if (b.type === 'packer') return outRoom(b) > 0 && !!((b.seafood && b.seafood.length || b.minced && b.minced.length || b.meat && b.meat.length) && (b.scrapN || 0) >= 1);
    if (b.type === 'salecenter') return (b.packT || 0) > 0;
    if (b.type === 'washbasin') return !!b.item && !b.output;
    if (b.type === 'slaughter' || b.type === 'grinder') return !!b.item && outRoom(b) > 0;
    if (b.type === 'deshell') return !!b.item && !b.output;
    if (b.type === 'mixer') return b.state === 'producing';
    if (b.type === 'cookery') return !!b.cooking || b.state === 'producing';
    return b.state === 'producing';
  }
  function bonusPowerUse(b) {
    if (!canUseElectricity(b) || needsRequiredPower(b) || !deviceWantsPower(b)) return 0;
    return isGrabberType(b.type) ? 1 : 10;
  }
  function powerBlocked(b) {
    return !!(b && needsRequiredPower(b) && deviceWantsPower(b) && (!b.powerConnected || !b.powered));
  }
  function isPowerPlantActive(b) {
    if (b.type === 'jisoucharge') return !!b.worker;
    if (b.type === 'firecharge') return (b.fuelT || 0) > 0;
    if (b.type === 'chaoscharge') return !!b.chaosStarted && (b.chaosVictims && b.chaosVictims.length > 0) && (b.fuelT || 0) > 0;
    return false;
  }
  function chaosVictimToMinced(b, victim) {
    const data = G.Creatures.makeProduct('분쇄육', { stats: (victim && victim.stats) || { 육질: 0, 개념: 0, 크기: 0 } });
    if (!bufferCargo(b, data)) {
      dropFloorCargo(data, b.col + Math.floor(b.w / 2), b.row + Math.floor(b.h / 2));
    }
  }
  function powerTalkSuffix(type) {
    if (type === '구더기') return '레후';
    if (type === '엄지') return '레치';
    if (type === '자실장') return '테치';
    return '데스';
  }
  function tickPowerPlantTalk(b, dt) {
    if (b.speechT > 0) return;
    b.powerTalkT = (b.powerTalkT || 0) - dt;
    if (b.powerTalkT > 0) return;
    let lines = null, suffix = '';
    if (b.type === 'jisoucharge' && b.worker) {
      lines = G.LINES && G.LINES.power && G.LINES.power.jisoucharge;
    } else if (b.type === 'firecharge' && (b.fuelT || 0) > 0 && b.fuel && ['구더기', '엄지', '자실장', '성체실장'].includes(b.fuel.type)) {
      lines = G.LINES && G.LINES.power && G.LINES.power.firecharge;
      suffix = powerTalkSuffix(b.fuel.type);
    } else if (b.type === 'chaoscharge' && isPowerPlantActive(b)) {
      lines = G.LINES && G.LINES.power && G.LINES.power.chaoscharge;
    }
    if (!lines || !lines.length) { b.powerTalkT = 2; return; }
    b.speech = lines[Math.floor(Math.random() * lines.length)].replace('{suffix}', suffix);
    b.speechT = 2.1;
    const talker = b.type === 'jisoucharge' ? b.worker : (b.type === 'firecharge' ? b.fuel : null);
    b.speechTone = talker ? linggalLine(talker) : '데스데스';   // 링갈 OFF 어미
    b.powerTalkT = 5 + Math.random() * 6;
  }
  function updatePowerPlant(b, dt) {
    if (b.type === 'jisoucharge') {
      if (!b.worker) { b.state = 'idle'; return; }
      b.state = 'producing';
      tickPowerPlantTalk(b, dt);
      G.Creatures.ensureVitals(b.worker);
      b.worker.hp = Math.max(0, (b.worker.hp || 0) - (C.POWER_HP_DRAIN || 0.1) * dt);
      if (b.worker.hp <= 0) {
        const meat = G.Creatures.makeProduct('실장육', { stats: b.worker.stats || {} });
        if (!bufferCargo(b, meat)) dropFloorCargo(meat, b.col + Math.floor(b.w / 2), b.row + Math.floor(b.h / 2));
        b.worker = null; b.state = 'ready'; playDeviceSfx('sell', b);
      }
      return;
    }
    if (b.type === 'chaoscharge') {
      if (!Array.isArray(b.chaosVictims)) b.chaosVictims = [];
      if (!b.chaosStarted && b.chaosVictims.length >= 12) b.chaosStarted = true;
      if (b.chaosStarted && b.chaosVictims.length > 0) {
        b.chaosVictimT = (b.chaosVictimT || 0) + dt;
        while (b.chaosVictimT >= 60) {
          b.chaosVictimT -= 60;
          if (Math.random() < 0.10 && b.chaosVictims.length) {
            const victim = b.chaosVictims.splice(Math.floor(Math.random() * b.chaosVictims.length), 1)[0];
            chaosVictimToMinced(b, victim);
            if (!b.chaosVictims.length) { b.chaosStarted = false; b.chaosVictimT = 0; break; }
          }
        }
      } else b.chaosVictimT = 0;
      if (isPowerPlantActive(b)) {
        b.fuelT = Math.max(0, b.fuelT - dt);
        if (b.fuelT <= 0) { b.fuel = null; b.fuelMax = 0; }
      }
      b.state = isPowerPlantActive(b) ? 'producing' : (b.chaosStarted ? 'ready' : (b.chaosVictims.length ? 'ready' : 'idle'));
      tickPowerPlantTalk(b, dt);
      return;
    }
    if (b.type === 'firecharge') {
      if ((b.fuelT || 0) > 0) {
        b.state = 'producing';
        tickPowerPlantTalk(b, dt);
        b.fuelT = Math.max(0, b.fuelT - dt);
        if (b.fuelT <= 0) { b.fuel = null; b.fuelMax = 0; b.state = 'idle'; }
      } else b.state = 'idle';
    }
  }
  function updatePowerGrid() {
    let total = (S.powerBonus || 0);   // 퀘스트 보상: 영구 전력 가산
    const sources = [];
    for (const b of S.buildings) {
      b.powered = false;
      b.powerConnected = false;
      b.powerBlocked = false;
      if (!isConstructing(b) && POWER_PLANTS.has(b.type) && isPowerPlantActive(b)) {
        const def = G.DEVICES[b.type];
        const effects = environmentEffectsForBuilding(b);
        let output = def.power || 0;
        if (effects.powerOutput) output *= effects.powerOutput;
        if (b.type === 'chaoscharge') {
          if (effects.chaosEfficiency) output *= effects.chaosEfficiency;
          output *= 1 + ((S.upgrades && S.upgrades.카오스연구) || 0) * 0.1;
        }
        total += Math.round(output);
        sources.push(b);
        b.powered = true;
        b.powerConnected = true;
      }
    }
    const poweredPoles = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of S.buildings) {
        if (!POWER_POLES.has(p.type) || p.powered || isConstructing(p)) continue;
        const connected = sources.concat(poweredPoles).some(src => powerLinkReach(p, src));
        if (connected) { p.powered = true; p.powerConnected = true; poweredPoles.push(p); changed = true; }
      }
    }
    const zones = [];
    for (const src of sources) zones.push(buildingRangeRect(src, powerSupplySizeFor(src.type, src.col, src.row, src.w, src.h)));
    for (const p of poweredPoles) zones.push(buildingRangeRect(p, powerSupplySizeFor(p.type, p.col, p.row, p.w, p.h)));
    for (const b of S.buildings) {
      if (isConstructing(b)) continue;
      if (b.powered) { b.powerConnected = true; continue; }
      const def = G.DEVICES[b.type];
      if (def && (canUseElectricity(b) || needsRequiredPower(b)) && zones.some(z => rectsTouch(z, b))) b.powerConnected = true;
    }
    let used = 0;
    for (const b of S.buildings.filter(x => x.powerConnected && needsRequiredPower(x) && deviceWantsPower(x))) {
      const need = basePowerUse(b);
      if (need <= 0 || used + need <= total) {
        b.powered = true;
        used += need;
      } else {
        b.powered = false;
        b.powerBlocked = true;
      }
    }
    for (const b of S.buildings.filter(x => x.powerConnected && !needsRequiredPower(x) && bonusPowerUse(x) > 0)) {
      const need = bonusPowerUse(b);
      if (used + need <= total) {
        b.powered = true;
        used += need;
      } else {
        b.powered = false;
      }
    }
    const ending = endingState();
    ending.chargePower = 0;
    const pad = endingLaunchpad();
    if (pad) {
      pad.powerConnected = zones.some(z => rectsTouch(z, pad));
      pad.powered = false;
      if (ending.stage === 2 && pad.powerConnected && (ending.charge || 0) < endingNeed().charge) {
        const spare = Math.max(0, total - used);
        ending.chargePower = spare;
        used += spare;
        pad.powered = spare > 0;
      }
    }
    S.power = total;
    S.powerUsed = used;
    if (G.UI && G.UI.onReformerPowered && S.buildings.some(b => b.type === 'reformer' && b.powered)) G.UI.onReformerPowered();
  }
  function powerUsageBreakdown() {
    const use = {}, supply = {};
    for (const b of S.buildings) {
      const def = G.DEVICES[b.type];
      const name = def ? def.name : b.type;
      if (b.powered && !POWER_PLANTS.has(b.type) && !POWER_POLES.has(b.type)) {
        const amount = needsRequiredPower(b) ? basePowerUse(b) : bonusPowerUse(b);
        if (amount > 0) use[name] = (use[name] || 0) + amount;
      }
      if (POWER_PLANTS.has(b.type) && isPowerPlantActive(b)) {
        const effects = environmentEffectsForBuilding(b);
        let amount = (def && def.power) || 0;
        amount *= effects.powerOutput || 1;
        if (b.type === 'chaoscharge') {
          amount *= effects.chaosEfficiency || 1;
          amount *= 1 + ((S.upgrades && S.upgrades.카오스연구) || 0) * 0.1;
        }
        supply[name] = (supply[name] || 0) + Math.round(amount);
      }
    }
    if ((S.powerBonus || 0) > 0) supply['영구 전력'] = Math.round(S.powerBonus || 0);
    if ((endingState().chargePower || 0) > 0) use['버려진 발사대'] = Math.round(endingState().chargePower);
    return { use, supply, used: Math.round(S.powerUsed || 0), total: Math.round(S.power || 0) };
  }

  let powerGridUpdateT = 0;
  let frameGrabbersByPriority = [];
  let frameGrabberSourcePens = new Map();
  function updateDevices(dt) {
    updateConstruction(dt);
    for (const b of S.buildings) if (POWER_PLANTS.has(b.type) && !isConstructing(b)) updatePowerPlant(b, dt);
    powerGridUpdateT -= dt;
    if (powerGridUpdateT <= 0) {
      powerGridUpdateT = 0.125;
      updatePowerGrid();
    }
    // 집게/긴팔집게는 우선순위(priority 1~5, 작을수록 먼저) 순서로 먼저 처리한다.
    // 같은 출처(창고/장치/바닥)에 여러 집게의 요청이 동시에 몰릴 때, 우선순위가
    // 1에 가까운 집게가 먼저 집도록 보장하기 위함.
    const grabbersByPriority = S.buildings.filter(b => isGrabberType(b.type));
    for (const b of grabbersByPriority) b.priority = grabberPriority(b);   // 구버전/비정상 저장값도 1~5로 보정
    grabbersByPriority.sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id)));
    frameGrabbersByPriority = grabbersByPriority;
    frameGrabberSourcePens = new Map();
    for (const b of grabbersByPriority) {
      const pk = grabberRoles(b).pickup;
      const direct = deviceAt(pk.c, pk.r);
      const pen = direct && direct.type === 'penbox'
        ? direct
        : frameCache.penCellMap.get(pk.c + '|' + pk.r);
      if (pen) frameGrabberSourcePens.set(b.id, pen);
    }
    for (const b of grabbersByPriority) {
      if (isConstructing(b)) continue;
      if (b.speechT > 0) b.speechT -= dt;
      if (powerBlocked(b)) { b.state = b.powerConnected ? 'nopower' : 'unpowered'; continue; }
      updateGrabber(b, dt);
    }
    for (const b of S.buildings) {
      if (isGrabberType(b.type)) continue;   // 위에서 우선순위 순으로 이미 처리됨
      if (isConstructing(b)) continue;
      if (b.speechT > 0) b.speechT -= dt;   // 장치 말풍선 시간 감소
      if (POWER_PLANTS.has(b.type) || POWER_POLES.has(b.type)) continue;
      if (powerBlocked(b)) { b.state = b.powerConnected ? 'nopower' : 'unpowered'; continue; }
      if (deviceCanSleep(b)) continue;
      if (b.type === 'birthing') updateBirthing(b, dt);
      else if (b.type === 'reformer') updateReformer(b, dt);
      else if (b.type === 'washbasin') updateWashbasin(b, dt);
      else if (b.type === 'sorter') updateSorter(b, dt);
      else if (b.type === 'tunnel' || b.type === 'crossbelt' || b.type === 'chaosgate') updateTunnel(b, dt);
      else if (b.type === 'mixer') updateMixer(b, dt);
      else if (b.type === 'cookery') updateCookery(b, dt);
      else if (b.type === 'packer') updatePacker(b, dt);
      else if (b.type === 'acidgen') updateAcidGen(b, dt);
      else if (b.type === 'driller') updateDriller(b, dt);
      else if (b.type === 'largewarehouse') updateLargeWarehouse(b, dt);
      else if (G.DEVICES[b.type] && G.DEVICES[b.type].special) updateSpecial(b, dt);
      else if (b.type === 'correction') updateCorrection(b, dt);
      else if (['slaughter', 'deshell', 'grinder'].includes(b.type)) updateProcessor(b, dt);
    }
    frameGrabbersByPriority = [];
    frameGrabberSourcePens = new Map();
  }
  function deviceCanSleep(b) {
    if (b.type === 'birthing') return !b.worker && !b.output;
    if (b.type === 'reformer') return !b.item;
    if (b.type === 'washbasin') return !b.item && !b.output;
    if (b.type === 'sorter') return !(b.buffer && b.buffer.length);
    if (b.type === 'tunnel' || b.type === 'crossbelt') return !(b.queue && b.queue.length);
    if (b.type === 'mixer') return !b.slotMeat && !b.slotAcid && !b.slotSeasoning && !b.slotScrap
      && !(b.unchiN || b.foodN || b.cA || b.cB) && !b.outputFood && !outBuffer(b).length;
    if (b.type === 'cookery') return !b.cooking && !Object.values(b.mats || {}).some(Boolean) && !outBuffer(b).length;
    if (b.type === 'packer') return !(b.minced && b.minced.length) && !(b.meat && b.meat.length)
      && !(b.seafood && b.seafood.length) && !(b.scrapN || 0) && !b.outputCargo && !outBuffer(b).length;
    if (b.type === 'acidgen') return !b.item && !outBuffer(b).length;
    if (b.type === 'correction') return !(b.inmates && b.inmates.length);
    if (b.type === 'slaughter' || b.type === 'deshell') return !b.item && !outBuffer(b).length;
    if (b.type === 'grinder') return !b.item && (b.weight || 0) < C.GRIND_TARGET && !outBuffer(b).length;
    return false;
  }
  function updateConstruction(dt) {
    for (const b of S.buildings) {
      if (!isConstructing(b)) continue;
      b.constructionLeft = Math.max(0, b.constructionLeft - dt);
      if (b.constructionLeft > 0) continue;
      delete b.constructionLeft;
      delete b.constructionTotal;
      if (b.state === 'constructing') b.state = 'idle';
      G.Assets.playSfx('place', { volume: 0.35 });
    }
  }
  function labResearchPower(b) {
    if (!b || b.type !== 'lab' || !b.workers || powerBlocked(b)) return 0;
    return b.workers.length * electricMult(b) * Math.pow(C.LAB_UP_MULT || 1.3, b.labLevel || 0);
  }
  function labWorkers() {
    let n = 0;
    for (const b of S.buildings) n += labResearchPower(b);
    return n;
  }
  function researchPower() {
    return labWorkers() * (1 + ((S.upgrades && S.upgrades.카오스연구) || 0) * 0.1) + (S.researchBonus || 0);
  }
  function emitLabMinced(b, src) {
    const minced = G.Creatures.makeProduct('분쇄육', { stats: (src && src.stats) || { 육질: 0, 개념: 0, 크기: 0 } });
    if (bufferCargo(b, minced)) return;
    const col = b.col + Math.floor(Math.random() * Math.max(1, b.w));
    const row = b.row + Math.floor(Math.random() * Math.max(1, b.h));
    dropFloorCargo(minced, col, row);
  }
  function drainLabWorkers(dt) {
    const rate = C.LAB_HP_DRAIN || 0.01;
    if (rate <= 0) return;
    for (const b of S.buildings) {
      if (b.type !== 'lab' || !Array.isArray(b.workers)) continue;
      for (let i = b.workers.length - 1; i >= 0; i--) {
        const c = b.workers[i];
        G.Creatures.ensureVitals(c);
        c.hp = Math.max(0, (c.hp || 0) - rate * dt);
        if (c.hp <= 0) {
          b.workers.splice(i, 1);
          emitLabMinced(b, c);
          b.state = 'ready';
          playDeviceSfx('sell', b);
        }
      }
    }
  }
  function researchProgressKey(r) {
    return r ? (r.key + '|' + (r.targetLevel || 0)) : '';
  }
  function updateResearch(dt) {
    if (S.researchCancelHold) {
      S.researchCancelHold = false;
      return;
    }
    if (!S.currentResearch && S.researchQueue && S.researchQueue.length) {
      S.currentResearch = S.researchQueue.shift();
      if (!S.researchProgressBank) S.researchProgressBank = {};
      const k = researchProgressKey(S.currentResearch);
      S.researchProgress = Math.max(S.currentResearch.savedProgress || 0, S.researchProgressBank[k] || 0);
    }
    const active = !!S.currentResearch;
    for (const b of S.buildings) if (b.type === 'lab') b.state = active && (b.workers && b.workers.length) ? 'producing' : 'idle';
    if (!active) return;
    const p = researchPower();
    if (p <= 0) return;
    drainLabWorkers(dt);
    S.researchProgress = (S.researchProgress || 0) + p * dt;
    if (S.researchProgress < (S.currentResearch.cost || 0)) return;
    const r = S.currentResearch;
    S.upgrades[r.key] = r.targetLevel || ((S.upgrades[r.key] || 0) + 1);
    if (S.researchProgressBank) delete S.researchProgressBank[researchProgressKey(r)];
    S.currentResearch = null;
    S.researchProgress = 0;
    if (G.Factory && G.Factory.refreshMenu) refreshMenu();
    G.Assets.playSfx('research');
    if (G.UI && G.UI.flash) G.UI.flash(r.name + ' 연구 완료');
    if (G.UI && G.UI.onResearchExplain) G.UI.onResearchExplain(r.key);
  }

  // 특수장치 효과 ---------------------------------------------------------
  function eachInRange(b, fn) {
    const r = rangeRect(b.type, b.col, b.row, b.dir); if (!r) return;
    for (const pen of frameCache.pens) for (const c of pen.creatures) {
      if (inRect(r, pen.col + (c.px || 0.5), pen.row + (c.py || 0.5))) fn(c);
    }
    for (const w of S.wanderers) if (inRect(r, w.gx, w.gy)) fn(w.data);
  }
  function nurtureZone(b, dt, stats, chance) {
    eachInRange(b, c => {
      if (!c.stats) return;
        if (Math.random() < chance * dt) {
          const s = stats[Math.floor(Math.random() * stats.length)];
          addStat(c.stats, s, 1);
          if (s === '크기' && G.Creatures.tryEvolveBySize(c)) playDeviceSfx('grow', b);
      }
    });
  }
  function growthSuffix(type) {
    if (type === '구더기') return '테치';
    if (type === '엄지') return '레치';
    if (type === '자실장' || type === '새끼사육실장' || type === '새끼독라') return '레후';
    return '데스';
  }
  // 링갈 OFF 시 실장석이 종족별 단순 대사만 하도록 변환. 같은 개체는 항상 같은 줄(깜빡임 방지).
  function linggalLine(data) {
    const t = data && data.type;
    if (t === '구더기' || t === '점액덩어리') return (((data && data.id) || 0) % 2 === 0) ? '레후' : '프니프니';
    if (t === '엄지') return '레치레치';
    const def = G.CREATURES[t];
    if (def && def.isAdult) return '데스데스';   // 성체실장/사육실장/독라
    return '테치테치';                           // 자실장/새끼사육실장/새끼독라
  }
  // 말풍선에 표시할 텍스트: 링갈 ON이면 원래 대사, OFF면 단순 대사.
  function linggalText(data) {
    if (S.linggal === false && data && G.CREATURES[data.type]) return linggalLine(data);
    return data ? data.speech : null;
  }
  function processorIntakeSpeech(b, data) {
    if (!b || !data || !G.LINES) return;
    const child = ['자실장', '새끼사육실장', '새끼독라'].includes(data.type);
    const ageKey = child ? 'child' : 'adult';
    let group = null;
    let lineKey = ageKey;
    if (b.type === 'deshell') {
      group = (data.type === '사육실장' || data.type === '새끼사육실장') ? G.LINES.deshellPet : G.LINES.deshellNormal;
    } else if (b.type === 'slaughter' && (data.type === '독라' || data.type === '새끼독라')) {
      group = G.LINES.slaughterSlave;
    } else if (b.type === 'grinder' && G.CREATURES[data.type]) {
      group = G.LINES.grinder;
      if (data.type === '구더기') lineKey = 'maggot';
      else if (data.type === '엄지') lineKey = 'thumb';
    }
    const lines = group && group[lineKey];
    if (!lines || !lines.length) return;
    b.speech = lines[Math.floor(Math.random() * lines.length)];
    b.speechT = 2.5;
    b.speechTone = lineKey === 'maggot' ? '레후' : (lineKey === 'thumb' ? '레치레치' : (child ? '테치테치' : '데스데스'));
  }
  function techicaLine(data) {
    const s = growthSuffix(data && data.type);
    const lines = [
      '테치카 부러운' + s,
      '와타시도 매지컬하고싶은' + s,
      '세레브 테치카' + s,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  // 매지컬 테치카 대사(반복)
  const TECHICA_DEVICE_LINES = ['세레브 파워☆', '매지컬 테치카 얍!', '콘페이토 별로 날아가는테치!'];
  function updateTechica(b, dt) {
    if (!b.worker) { b.workT = 0; b.techAnimT = 0; return; }
    b.workT = (b.workT || 0) + dt;
    // 랜덤 동작: 같은 동작 반복 대신 일정 간격마다 8프레임 중 랜덤 선택
    b.techAnimT = (b.techAnimT || 0) - dt;
    if (b.techAnimT <= 0) { b.techFrame = Math.floor(Math.random() * 8); b.techAnimT = 0.18 + Math.random() * 0.4; }
    if (b.workT >= 60) {
      b.worker.stats = b.worker.stats || {};
      b.worker.stats.개념 = 0;
      const out = b.worker;
      b.worker = null; b.workT = 0;
      if (!emitCreature(b, out)) b.output = out;
      playDeviceSfx('remove', b);
      return;
    }
    const r = rangeRect(b.type, b.col, b.row, b.dir); if (!r) return;
    const cx = b.col + (b.w || 1) / 2, cy = b.row + (b.h || 1) / 2;
    const em = electricMult(b);
    for (const pen of frameCache.pens) for (const c of pen.creatures) {
      const gx = pen.col + (c.px || 0.5), gy = pen.row + (c.py || 0.5);
      if (!inRect(r, gx, gy)) continue;
      if (c.stats) {
        if (Math.random() < (C.TECHICA_HAPPY_RATE || 0.5) * em * dt) G.Creatures.changeHappy(c, 1);
        if (Math.random() < (C.TECHICA_QUALITY_RATE || 0.1) * em * dt) addStat(c.stats, '육질', 1);
      }
      if (Math.random() < (C.TECHICA_ATTRACT_CHANCE || 0.45) * em * dt) {
        const dx = cx - gx, dy = cy - gy, d = Math.hypot(dx, dy) || 1;
        const step = Math.min(0.18 * dt, Math.max(0, d - 0.8));
        c.px += (dx / d) * step; c.py += (dy / d) * step;
      }
      if ((c.speechT || 0) <= 0 && Math.random() < (C.TECHICA_TALK_CHANCE || 0.12) * dt) { c.speech = techicaLine(c); c.speechT = 1.8; }
    }
    const wrx = (r.x0 + r.x1) / 2, wry = (r.y0 + r.y1) / 2;
    const wrr = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2 + 1;
    for (const w of nearbyWanderers(wrx, wry, wrr)) {
      if (!inRect(r, w.gx, w.gy)) continue;
      if (w.data && w.data.stats) {
        if (Math.random() < (C.TECHICA_HAPPY_RATE || 0.5) * em * dt) G.Creatures.changeHappy(w.data, 1);
        if (Math.random() < (C.TECHICA_QUALITY_RATE || 0.1) * em * dt) addStat(w.data.stats, '육질', 1);
      }
      if (Math.random() < (C.TECHICA_ATTRACT_CHANCE || 0.45) * em * dt) { w.goal = { x: cx + (Math.random() - 0.5) * 1.4, y: cy + (Math.random() - 0.5) * 1.4 }; w.t = 0; }
      if (w.data && (w.data.speechT || 0) <= 0 && Math.random() < (C.TECHICA_TALK_CHANCE || 0.12) * dt) { w.data.speech = techicaLine(w.data); w.data.speechT = 1.8; }
    }
    if ((b.speechT || 0) <= 0 && Math.random() < dt * 0.25) {
      b.techLineIdx = ((b.techLineIdx == null ? -1 : b.techLineIdx) + 1) % TECHICA_DEVICE_LINES.length;
      b.speech = TECHICA_DEVICE_LINES[b.techLineIdx]; b.speechT = 1.6;
      b.speechTone = b.worker ? linggalLine(b.worker) : '테치테치';   // 링갈 OFF 어미
    }
  }
  /* ---- 자동 포탑 / 저격 터렛 / 박격포 / 지뢰 ---------------------------- */
  function isSniper(b) { return b.type === 'sniper' || (G.DEVICES[b.type] && G.DEVICES[b.type].sniper); }
  function isMortar(b) { return b.type === 'mortar' || (G.DEVICES[b.type] && G.DEVICES[b.type].mortar); }
  function isChaosTurret(b) { return !!(b && G.DEVICES[b.type] && G.DEVICES[b.type].chaosChain); }
  // 조준/목표 모드를 갖는 터렛류(자동 포탑/저격/박격포)
  function isTurretLike(b) { return !!(b && (b.type === 'turret' || b.type === 'sniper' || b.type === 'mortar' || (G.DEVICES[b.type] && G.DEVICES[b.type].special === 'turret'))); }
  // 터렛 종류별 기본치(저격=자동 포탑 대비 데미지2배·사거리3배·발사3배 느림)
  function turretBaseDmg(b) { return isChaosTurret(b) ? (C.CHAOS_TURRET_DMG || 70) : (isMortar(b) ? (C.MORTAR_DMG || 150) : (isSniper(b) ? (C.SNIPER_DMG || C.TURRET_DMG * 2) : C.TURRET_DMG)); }
  function turretBaseInterval(b) { return isChaosTurret(b) ? (C.CHAOS_TURRET_INTERVAL || 1.8) : (isMortar(b) ? (C.MORTAR_INTERVAL || 5) : (isSniper(b) ? (C.SNIPER_INTERVAL || C.TURRET_INTERVAL * 3) : C.TURRET_INTERVAL)); }
  function turretBaseRange(b) { return isChaosTurret(b) ? (C.CHAOS_TURRET_RANGE || 12) : (isMortar(b) ? (C.MORTAR_RANGE || 18) : (isSniper(b) ? (C.SNIPER_RANGE || C.TURRET_RANGE * 3) : C.TURRET_RANGE)); }
  function turretSfxKey(b) { return isMortar(b) ? 'canon' : (isSniper(b) ? 'sniper' : 'turret'); }
  function turretLv(b, k) { return (b.up && b.up[k]) || 0; }
  function bulletDmgBonus() { return ((S.upgrades && S.upgrades.총알개조) || 0) * (C.TURRET_BULLET_DMG_PER_LV || 10); }
  function electricMult(b) {
    if (b && isSniper(b)) return 1;   // 저격터렛은 전력 부스트 대상 아님. 전력은 연사 유지에만 관여(아래 turretInterval).
    return hasElectricBoost(b) ? (C.POWER_BOOST || 1.5) : 1;
  }
  function turretDmg(b) { return (turretBaseDmg(b) + turretLv(b, 'dmg') * C.TURRET_DMG_PER_LV + bulletDmgBonus()) * electricMult(b); }
  function turretInterval(b) {
    let interval = turretBaseInterval(b) / ((1 + turretLv(b, 'rate') * C.TURRET_RATE_PER_LV) * electricMult(b));
    interval /= 1 + ((S.upgrades && S.upgrades.카오스탄창) || 0) * (C.CHAOS_MAG_RATE_PER_LV || 0.05);
    if (isSniper(b) && !b.powered) interval *= 2;   // 저격터렛: 전력 없으면 연사 속도 1/2
    return interval;
  }
  function turretRange(b) {
    const base = isMortar(b) && (b.missileAmmo || 0) > 0 ? (C.MAGGOT_MISSILE_RANGE || 144) : (turretBaseRange(b) + turretLv(b, 'range') * C.TURRET_RANGE_PER_LV);
    return base * electricMult(b) * (1 + ((S.upgrades && S.upgrades.카오스총신) || 0) * (C.CHAOS_BARREL_RANGE_PER_LV || 0.05));
  }
  function creatureHp(data) { G.Creatures.ensureVitals(data); return data.hp; }   // 최대 체력 = 크기(×hpScale)
  function isExternalOrigin(w) {
    return !!(w && (w.wild || (w.data && w.data.externalOrigin)));
  }
  // 목표 설정: raider=약탈자만 / wild=외부 출신 전부 / all=모든 배회 개체 (노동석은 항상 제외)
  function turretTargets(b, w) {
    if (w.data && w.data.labor) return false;
    if (w.endingCinematic) return false;
    const mode = b.mode || 'raider';
    if (mode === 'raider') return !!w.raider;
    if (mode === 'wild') return !!(w.raider || w.invade || isExternalOrigin(w));
    return true;
  }
  // 각도 a를 목표각 t로 최대 max라디안 회전
  function approachAngle(a, t, max) {
    let d = ((t - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= max) return t;
    return a + Math.sign(d) * max;
  }
  function updateTurret(b, dt) {
    b.shotT = Math.max(0, (b.shotT || 0) - dt);
    if (b.aim == null) b.aim = -Math.PI / 2;
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2, rg = turretRange(b);
    // 매 프레임 사거리 안 가장 가까운 대상 탐색
    let best = null, bd = Infinity;
    for (const w of nearbyWanderers(cx, cy, rg)) {
      if (!turretTargets(b, w)) continue;
      const d = Math.hypot(w.gx - cx, w.gy - cy);
      if (d <= rg && d < bd) { bd = d; best = w; }
    }
    const forced = isMortar(b) && b.manualTarget
      && Math.hypot(b.manualTarget.gx - cx, b.manualTarget.gy - cy) <= rg
      ? b.manualTarget : null;
    if (!best && !forced) {                    // 적/강제 목표 없음 → 포신을 천천히 회전
      b.aim += (C.TURRET_IDLE_SPIN || 0.7) * dt;
      if (b.aim > Math.PI) b.aim -= Math.PI * 2;
      b.cd = 0;
      if (b.type === 'turret') {               // 자동 포탑: 평상시 간헐 대사
        b.talkT = (b.talkT || 0) - dt;
        if ((b.speechT || 0) <= 0 && b.talkT <= 0) { speakFrom(b, G.LINES && G.LINES.turret, 1.6); b.talkT = 4 + Math.random() * 5; }
      }
      return;
    }
    // 조준(부드럽게 회전) 후, 정조준에 가까우면 발사
    const target = forced || best;
    const targetAim = Math.atan2(target.gy - cy, target.gx - cx);
    b.aim = approachAngle(b.aim, targetAim, (C.TURRET_TURN_SPEED || 9) * dt);
    b.cd = (b.cd || 0) - dt;
    const aimed = Math.abs(((targetAim - b.aim + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.25;
    if (b.cd > 0 || !aimed) return;
    b.cd = turretInterval(b);
    b.shotT = 0.12; b.shotX = target.gx; b.shotY = target.gy;
    if (b.type === 'turret' && (b.speechT || 0) <= 0 && Math.random() < 0.5) speakFrom(b, G.LINES && G.LINES.turretAttack, 1.2);  // 자동 포탑: 공격 대사
    playWorldSfx(isChaosTurret(b) ? 'thunder' : turretSfxKey(b), cx, cy, { force: true, volume: 0.55 });
    if (isMortar(b)) {
      const missile = (b.missileAmmo || 0) > 0;
      if (missile) b.missileAmmo--;
      const lines = ['하늘을 나는 레후우우우', '강렬한 프니프니레후우우', '날아가는 레후우우'];
      mortarShells.push({
        sx: cx, sy: cy, tx: target.gx, ty: target.gy, t: 0,
        dur: missile ? (C.MAGGOT_MISSILE_TIME || 3) : (C.MORTAR_SHELL_TIME || 0.9),
        dmg: missile ? (C.MAGGOT_MISSILE_DMG || 480) : turretDmg(b),
        radius: missile ? (C.MAGGOT_MISSILE_RADIUS || 3.5) : (C.MORTAR_RADIUS || 1.5),
        missile, speech: missile ? lines[Math.floor(Math.random() * lines.length)] : '', owner: b.id,
      });
    }
    else if (isChaosTurret(b)) {
      const maxTargets = Math.min(C.CHAOS_TURRET_CHAIN_MAX || 8, (C.CHAOS_TURRET_CHAIN_BASE || 3) + turretLv(b, 'range'));
      const hit = [], points = [];
      let cur = best;
      for (let i = 0; i < maxTargets && cur; i++) {
        hit.push(cur); points.push({ x: cur.gx, y: cur.gy });
        const ox = cur.gx, oy = cur.gy;
        cur = null;
        let nd = C.CHAOS_TURRET_CHAIN_RANGE || 5;
        for (const candidate of nearbyWanderers(ox, oy, C.CHAOS_TURRET_CHAIN_RANGE || 5)) {
          if (hit.includes(candidate) || !turretTargets(b, candidate)) continue;
          const d = Math.hypot(candidate.gx - ox, candidate.gy - oy);
          if (d <= nd) { nd = d; cur = candidate; }
        }
      }
      b.chainShot = points;
      hit.forEach((target, i) => damageWanderer(target, turretDmg(b) * Math.pow(0.9, i), b, '#c477ff'));
    } else damageWanderer(best, turretDmg(b), b, '#ffd24a');
  }

  function damageWanderer(w, dmg, source, color) {
    if (!w || w._dead || w.endingCinematic) return false;
    G.Creatures.ensureVitals(w.data);
    w.data.hp -= dmg;
    spawnParticle(w.gx * CELL, w.gy * CELL, color || '#ffd24a');
    if (w.data.hp > 0) return false;
    w._dead = true;
    S.wanderers = S.wanderers.filter(x => x !== w);
    burstAt(w.gx, w.gy); stainAt(w.gx, w.gy);
    if (source && isChaosTurret(source)) {
      S.cargo.push(makeCargo(resourceCargoData('운치'), Math.floor(w.gx), Math.floor(w.gy)));
    } else {
      const meat = G.Creatures.makeProduct('실장육', w.data);
      if (w.raider || w.invade) meat.raidMeat = true;
      S.cargo.push(makeCargo(meat, Math.floor(w.gx), Math.floor(w.gy)));
    }
    if (source) source.kills = (source.kills || 0) + 1;
    playWorldSfx('remove', w.gx, w.gy);
    return true;
  }

  function spawnExplosionEffect(gx, gy, scale) {
    explosionEffects.push({ gx, gy, scale: scale || 1, t: 0, duration: 0.72 });
  }
  function updateExplosionEffects(dt) {
    for (let i = explosionEffects.length - 1; i >= 0; i--) {
      explosionEffects[i].t += dt;
      if (explosionEffects[i].t >= explosionEffects[i].duration) explosionEffects.splice(i, 1);
    }
  }
  function drawExplosionEffects() {
    if (!explosionEffects.length) return;
    const rec = G.Assets.loadImage('assets/images/ui/explosion1.png');
    if (!rec || !rec.ok || !rec.img.width) return;
    const frameW = 192, frameH = 192, cols = 5, frames = 12;
    for (const e of explosionEffects) {
      const frame = Math.min(frames - 1, Math.floor(e.t / e.duration * frames));
      const sx = (frame % cols) * frameW, sy = Math.floor(frame / cols) * frameH;
      const size = frameW * e.scale;
      ctx.drawImage(rec.img, sx, sy, frameW, frameH, e.gx * CELL - size / 2, e.gy * CELL - size / 2, size, size);
    }
  }
  function explodeAt(gx, gy, radius, dmg, source, effectScale) {
    for (let i = 0; i < 24; i++) spawnParticle(gx * CELL, gy * CELL, i % 2 ? '#ff7b3a' : '#ffd24a');
    spawnExplosionEffect(gx, gy, effectScale);
    playWorldSfx('explosion', gx, gy, { force: true, volume: 0.8 });
    const victims = nearbyWanderers(gx, gy, radius).slice();
    for (const w of victims) {
      if (w._dead || (w.data && w.data.labor)) continue;
      const d = Math.hypot(w.gx - gx, w.gy - gy);
      if (d <= radius) damageWanderer(w, Math.round(dmg * (1 - 0.35 * d / Math.max(0.1, radius))), source, '#ff9a4a');
    }
  }

  function updateMortarShells(dt) {
    for (let i = mortarShells.length - 1; i >= 0; i--) {
      const s = mortarShells[i];
      s.t += dt;
      if (s.t < s.dur) continue;
      const owner = S.buildings.find(b => b.id === s.owner);
      explodeAt(s.tx, s.ty, s.radius || C.MORTAR_RADIUS || 1.5, s.dmg, owner, s.missile ? 1.15 : 0.5);
      mortarShells.splice(i, 1);
    }
  }
  function drawMortarShells() {
    if (!mortarShells.length) return;
    ctx.save();
    for (const s of mortarShells) {
      const u = clamp(s.t / s.dur, 0, 1);
      const x = (s.sx + (s.tx - s.sx) * u) * CELL;
      const y = (s.sy + (s.ty - s.sy) * u) * CELL - Math.sin(u * Math.PI) * CELL * 1.2;
      if (s.missile) {
        const rec = G.Assets.loadImage('assets/images/creatures/maggot.png');
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(s.ty - s.sy, s.tx - s.sx) + Math.PI / 2);
        if (rec && rec.ok && rec.img.width) {
          const fw = rec.img.width / 4, fh = rec.img.height / 4;
          ctx.drawImage(rec.img, 0, 0, fw, fh, -12, -12, 24, 24);
        } else {
          ctx.fillStyle = '#9bcf72'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        if (s.speech) drawBubble(x, y - 16, s.speech);
        continue;
      }
      ctx.fillStyle = '#2a2520';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,120,0.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 7, y + 3); ctx.lineTo(x - 17, y + 8); ctx.stroke();
    }
    ctx.restore();
  }

  function updateMine(b, dt) {
    const cx = b.col + 0.5, cy = b.row + 0.5;
    // 점화 중: 폭발 직전 대사를 띄운 채 짧은 도화선 후 폭발
    if (b.fuseT != null) {
      b.fuseT -= dt;
      if (b.fuseT <= 0) {
        explodeAt(cx, cy, C.MINE_RADIUS || 1.5, C.MINE_DMG || 120, null, 1);
        destroyBuildingNoRefund(b);
      }
      return;
    }
    if (!b.armed) b.armed = true;
    // 근처에 침입자가 들어오면 점화 + 폭발 직전 대사
    const near = nearbyWanderers(cx, cy, 1).find(w => !w._dead && !w.endingCinematic && (w.invade || w.raider) && Math.hypot(w.gx - cx, w.gy - cy) <= 0.9);
    if (near) {
      b.armed = false; b.fuseT = 0.45;
      speakFrom(b, G.LINES && G.LINES.minePreExplode, 1.4);
      return;
    }
    // 평상시 간헐 중얼거림
    b.talkT = (b.talkT || 0) - dt;
    if ((b.speechT || 0) <= 0 && b.talkT <= 0) {
      speakFrom(b, G.LINES && G.LINES.mine, 1.8);
      b.talkT = 4 + Math.random() * 5;
    }
  }
  // 장치 말풍선: 주어진 줄 목록에서 무작위 1줄을 띄운다({n}은 랜덤 숫자로 치환)
  function speakFrom(b, lines, dur, tone) {
    if (!b || !lines || !lines.length) return;
    let s = lines[Math.floor(Math.random() * lines.length)];
    if (typeof s === 'string' && s.indexOf('{n}') >= 0) s = s.replace('{n}', String(1 + Math.floor(Math.random() * 999)));
    b.speech = s; b.speechT = dur; b.speechTone = tone || '데스데스';   // 링갈 OFF 시 표시할 단순 어미
  }
  // 작동 중 장치가 쿨다운마다 간헐적으로 대사를 띄움
  function deviceIdleTalk(b, dt, lines, tone) {
    if (!b || !lines || !lines.length) return;
    b.talkT = (b.talkT || 0) - dt;
    if ((b.speechT || 0) <= 0 && b.talkT <= 0) { speakFrom(b, lines, 1.6, tone); b.talkT = 4 + Math.random() * 4; }
  }

  /* ---- 노동석 교화소 / 노동석 AI -------------------------------------- */
  function updateReformer(b, dt) {
    if (!b.item) { b.state = 'idle'; b.reformTalkT = 0; return; }
    b.state = 'producing';
    b.reformTalkT = (b.reformTalkT || 0) - dt;
    if ((b.speechT || 0) <= 0 && b.reformTalkT <= 0) {
      const L = G.LINES.reformer || [];
      if (L.length) {
        b.speech = L[Math.floor(Math.random() * L.length)];
        b.speechT = 1.6;
        b.speechTone = b.item ? linggalLine(b.item) : '데스데스';   // 링갈 OFF 어미(교화 중인 독라)
        b.reformTalkT = 1.8 + Math.random() * 1.2;
      }
    }
    b.timer = (b.timer || 0) + dt;
    if (b.timer < (C.LABOR_REFORM_TIME || 6)) return;
    const data = b.item;
    b.item = null; b.timer = 0; b.state = 'idle';
    if (S.wanderers.filter(w => w.data && w.data.labor).length >= laborLimit()) {
      spawnWanderer(data, b.col + b.w / 2, b.row + b.h / 2, 1.0);
      G.UI.flash && G.UI.flash('노동석 최대 수에 도달했습니다.');
      return;
    }
    data.labor = true; data.laborMode = b.defaultMode || 'hold'; data.laborFilter = []; data.laborPenId = null;
    data.행복 = C.CREATURE_HAPPY_MAX || 100;
    data.happyCircuit = false;
    achievementStats().labor++;
    data.speech = '노동하는데스…'; data.speechT = 2.2;
    if (G.UI && G.UI.onLaborProduced) G.UI.onLaborProduced();
    const out = outputCell(b);
    // 노동석은 벨트/장치에 안 들어가므로 출구에 바로 풀어줌(배회)
    spawnWanderer(data, clamp(out.c + 0.5, 0.5, COLS - 0.5), clamp(out.r + 0.5, 0.5, ROWS - 0.5));
    playDeviceSfx('grow', b);
  }
  // 노동석 명령 대상 판정
  function matchLaborFilter(d, type) {
    const f = d.laborFilter || [];
    return !f.length || f.includes(type);
  }
  function laborSpeedMult(d) {
    const concept = d && d.stats ? (d.stats.개념 || 0) : 0;
    const w = S.wanderers.find(x => x.data === d);
    const local = w ? (monumentEffectsAtPoint(w.gx, w.gy).laborEfficiency || 1) : 1;
    return (1 + Math.min(0.5, concept / Math.max(1, statMax()) * 0.5)) * laborUpgradeMult() * local;
  }
  function laborCarryCap(d) {
    const concept = d && d.stats ? (d.stats.개념 || 0) : 0;
    return Math.max(1, Math.floor(concept / 20) + Math.floor(((S.upgrades && S.upgrades.노동석강화) || 0) / 2));
  }
  function sayLaborCommand(d) {
    if (!d) return;
      const label = { retrieve: '회수', defend: '방어', hold: '대기', clean: '청소', mine: '채취', free: '배회' }[d.laborMode || 'free'] || '복종';
    d.speech = label + '하는데스';
    d.speechT = 2.0;
    d.laborTalkT = 6 + Math.random() * 4;
  }
  function laborCargoItems(carry) {
    if (!carry || carry.kind !== 'cargo') return [];
    if (Array.isArray(carry.items)) return carry.items;
    return carry.data ? [carry.data] : [];
  }
  function laborCarryCount(d) {
    if (!d || !d.carry) return 0;
    return d.carry.kind === 'cargo' ? laborCargoItems(d.carry).length : 1;
  }
  function setLaborCargoCarry(d, items) {
    d.carry = { kind: 'cargo', items: items.slice(), data: items[0] || null };
  }
  function addLaborCargo(d, data) {
    const items = d.carry && d.carry.kind === 'cargo' ? laborCargoItems(d.carry).slice() : [];
    items.push(data);
    setLaborCargoCarry(d, items);
  }
  // 다른 노동석이 1.5초 안에 선점한 목표인지 (본인 클레임/만료 클레임은 무시)
  function claimedByOther(t, d) {
    return !!(t._claim && t._claim.id !== d.id && (S.playTime - t._claim.t) < 1.5);
  }
  // 바닥(벨트 아님)에 떨어진, 필터에 맞는 가장 가까운 화물
  function nearestFloorCargo(w) {
    const d = w.data;
    let best = null, bd = C.LABOR_SIGHT || 60;
    for (const cg of nearbyCargo(w.gx, w.gy, bd)) {
      if (cg._dead || claimedByOther(cg, d)) continue;
      const c = Math.floor(cg.gx), r = Math.floor(cg.gy);
      if (hasBelt(c, r) || !isOwnedCell(c, r)) continue;
      if (!matchLaborFilter(d, cg.data.type)) continue;
      const dist = Math.hypot(cg.gx - w.gx, cg.gy - w.gy);
      if (dist < bd) { bd = dist; best = cg; }
    }
    return best;
  }
  // 배회 중인 플레이어 소유 실장석(약탈자/노동석 제외) 중 필터에 맞는 가장 가까운 개체
  function nearestLooseCreature(w) {
    const d = w.data;
    let best = null, bd = C.LABOR_SIGHT || 60;
    for (const t of nearbyWanderers(w.gx, w.gy, bd)) {
      if (t === w || t._dead || t.raider || t.leaving || t.data.labor || claimedByOther(t, d)) continue;
      if (!G.CREATURES[t.data.type]) continue;
      if (!isOwnedCell(Math.floor(t.gx), Math.floor(t.gy))) continue;
      if (!matchLaborFilter(d, t.data.type)) continue;
      const dist = Math.hypot(t.gx - w.gx, t.gy - w.gy);
      if (dist < bd) { bd = dist; best = t; }
    }
    return best;
  }
  // 회수한 실장석을 보낼 우리: 지정 우리(laborPenId) 우선, 없으면 수용 가능한 가장 가까운 우리
  function laborTargetPen(w) {
    const d = w.data;
    if (d.laborPenId) {
      const pen = buildingById.get(d.laborPenId);
      if (pen && pen.type === 'penbox') return pen;   // 가득 차면 도착 후 자리 날 때까지 대기
      d.laborPenId = null;                            // 우리가 삭제됨 → 자동으로 전환
    }
    const cr = d.carry && d.carry.data;
    if (!cr) return null;
    const adult = G.CREATURES[cr.type] && G.CREATURES[cr.type].isAdult;
    let best = null, bd = Infinity;
    for (const pen of frameCache.pens) {
      const ok = adult ? G.Pens.countAdult(pen) < G.Pens.capAdult(pen) : G.Pens.countYoung(pen) < G.Pens.capYoung(pen);
      if (!ok) continue;
      const dist = Math.hypot(pen.col + pen.w / 2 - w.gx, pen.row + pen.h / 2 - w.gy);
      if (dist < bd) { bd = dist; best = pen; }
    }
    return best;
  }
  function dropLaborCarry(w) {
    const c = w.data.carry;
    w.data.carry = null; w.goal = null;
    if (!c) return;
    if (c.kind === 'creature') spawnWanderer(c.data, w.gx, w.gy, 1.0);
    else laborCargoItems(c).forEach((it, i) => S.cargo.push(makeCargo(it, Math.floor(w.gx + (i % 2) * 0.2), Math.floor(w.gy + Math.floor(i / 2) * 0.2))));
  }
  // 회수 모드: 줍기 → 화물은 창고, 실장석은 지정 우리로 배달
  function laborRetrieve(w, dt, consumed) {
    const d = w.data;
    if (d.carry) {   // 배달 단계
      if (d.carry.kind === 'cargo') {
        if (laborCarryCount(d) < laborCarryCap(d)) {
          const more = nearestFloorCargo(w);
          if (more) {
            w.goal = { x: more.gx, y: more.gy };
            more._claim = { id: d.id, t: S.playTime };
            if (Math.hypot(more.gx - w.gx, more.gy - w.gy) <= (C.LABOR_REACH || 0.7)) {
              more._claim = null;
              const picked = takeCargoUnit(more);
              if (more._dead) { const mi = S.cargo.indexOf(more); if (mi >= 0) S.cargo.splice(mi, 1); }
              if (picked) addLaborCargo(d, picked);
              playWorldSfx('click', w.gx, w.gy);
            }
            return;
          }
        }
        let best = null, bd = Infinity;
        for (const wh of frameCache.warehouses) {
          const dist = Math.hypot(wh.col + wh.w / 2 - w.gx, wh.row + wh.h / 2 - w.gy);
          if (dist < bd) { bd = dist; best = wh; }
        }
        if (!best) { dropLaborCarry(w); return; }   // 창고 없음 → 내려놓음
        w.goal = { x: best.col + best.w / 2, y: best.row + best.h / 2 };
        if (bd < best.w / 2 + 1.0) {
          const items = laborCargoItems(d.carry);
          const units = items.reduce((sum, it) => sum + Math.max(1, Math.floor(it.amount || 1)), 0);
          if (inventoryRoomFor(best) >= units && items.every(it => warehouseIntake(it, best))) {
            d.carry = null; w.goal = null; playWorldSfx('click', w.gx, w.gy);
          }
        }
      } else {
        const pen = laborTargetPen(w);
        if (!pen) { dropLaborCarry(w); return; }    // 보낼 우리 없음 → 풀어줌
        const px = pen.col + pen.w / 2, py = pen.row + pen.h / 2;
        w.goal = { x: px, y: py };
        if (Math.hypot(px - w.gx, py - w.gy) < Math.max(pen.w, pen.h) / 2 + 1.0) {
          if (G.Pens.addToPen(pen, d.carry.data, { c: Math.floor(w.gx), r: Math.floor(w.gy) })) { d.carry = null; w.goal = null; playWorldSfx('capture', w.gx, w.gy); }
          // 가득 찼으면 그 자리에서 대기(다음 프레임 재시도)
        }
      }
      return;
    }
    // 탐색 단계 (0.7초 간격 재탐색. _claim=다른 노동석과 목표 중복 방지, 1.5초 자동 만료)
    w.seekCd = (w.seekCd || 0) - dt;
    let tgt = w.laborTgt;
    if (tgt && (tgt._dead || w.seekCd <= 0)) tgt = null;
    if (!tgt) {
      w.seekCd = 0.7 + Math.random() * 0.4;
      const cg = nearestFloorCargo(w);
      if (cg) { tgt = cg; w.laborTgtKind = 'cargo'; }
      else { const cr = nearestLooseCreature(w); if (cr) { tgt = cr; w.laborTgtKind = 'creature'; } }
      w.laborTgt = tgt || null;
    }
    if (!tgt) { w.goal = null; return; }   // 할 일 없음 → 자유 배회
    tgt._claim = { id: d.id, t: S.playTime };
    w.goal = { x: tgt.gx, y: tgt.gy };
    if (w.laborTgtKind === 'creature') w.t = Math.min(w.t, 0.3);   // 움직이는 목표는 자주 재조준
    if (Math.hypot(tgt.gx - w.gx, tgt.gy - w.gy) <= (C.LABOR_REACH || 0.7)) {
      tgt._dead = true; tgt._claim = null;
      if (w.laborTgtKind === 'creature') {   // 배회 실장석 줍기
        consumed.push(tgt);
        d.carry = { kind: 'creature', data: tgt.data };
      } else {                               // 바닥 화물 줍기
        const picked = takeCargoUnit(tgt);
        if (tgt._dead) { const i = S.cargo.indexOf(tgt); if (i >= 0) S.cargo.splice(i, 1); }
        if (picked) addLaborCargo(d, picked);
        while (laborCarryCount(d) < laborCarryCap(d)) {
          const extra = nearestFloorCargo(w);
          if (!extra || Math.hypot(extra.gx - w.gx, extra.gy - w.gy) > (C.LABOR_REACH || 0.7)) break;
          extra._claim = null;
          const extraPicked = takeCargoUnit(extra);
          if (extra._dead) { const ei = S.cargo.indexOf(extra); if (ei >= 0) S.cargo.splice(ei, 1); }
          if (extraPicked) addLaborCargo(d, extraPicked);
        }
      }
      w.laborTgt = null; w.goal = null;
      playWorldSfx('click', w.gx, w.gy);
    }
  }
  // 방어 모드: 약탈자를 추격해 공격 (구역 밖으론 못 나감 — 경계에서 요격)
  function laborDefend(w, dt, consumed) {
    let tgt = null, bd = C.LABOR_SIGHT || 60;
    for (const t of nearbyWanderers(w.gx, w.gy, bd)) {
      if (t._dead || !t.raider) continue;
      const dist = Math.hypot(t.gx - w.gx, t.gy - w.gy);
      if (dist < bd) { bd = dist; tgt = t; }
    }
    if (!tgt) { w.goal = null; return; }
    w.goal = { x: tgt.gx, y: tgt.gy };
    w.t = Math.min(w.t, 0.15);   // 움직이는 목표라 자주 재조준
    if (bd <= (C.LABOR_ATK_RANGE || 1.1)) {
      w.atkCd = (w.atkCd || 0) - dt;
      if (w.atkCd <= 0) {
        w.atkCd = C.LABOR_ATK_INTERVAL || 1.0;
        G.Creatures.ensureVitals(tgt.data);
        tgt.data.hp -= (C.LABOR_ATK || 8) * laborUpgradeMult();
        spawnParticle(tgt.gx * CELL, tgt.gy * CELL, '#ff8a6a');
        if (tgt.data.hp <= 0) {
          tgt._dead = true; consumed.push(tgt);
          burstAt(tgt.gx, tgt.gy); stainAt(tgt.gx, tgt.gy);
          S.cargo.push(makeCargo(G.Creatures.makeProduct('실장육', tgt.data), Math.floor(tgt.gx), Math.floor(tgt.gy)));
          w.data.speech = '침입자 퇴치인데스!'; w.data.speechT = 2.0;
          playWorldSfx('remove', tgt.gx, tgt.gy);
        }
      }
    }
  }
  function nearestWarehouse(w) {
    let best = null, bd = Infinity;
    for (const wh of frameCache.warehouses) {
      const dist = Math.hypot(wh.col + wh.w / 2 - w.gx, wh.row + wh.h / 2 - w.gy);
      if (dist < bd) { bd = dist; best = wh; }
    }
    return best;
  }
  // 채취 가능한 유적: 자원이 남아있고 플레이어 영역(소유 그리드) 안에 있어야 함
  function ruinHarvestable(r) {
    const enough = r && r.resourceType ? (r.scrap || 0) >= 1 : r && (r.scrap || 0) > 0;
    return !!r && enough && isOwnedCell(r.col, r.row) && isOwnedCell(r.col + r.w - 1, r.row + r.h - 1);
  }
  function nearestRuin(w) {
    let best = null, bd = C.LABOR_SIGHT || 60;
    for (const r of (S.ruins || [])) {
      if (!ruinHarvestable(r) || claimedByOther(r, w.data)) continue;
      const rx = r.col + r.w / 2, ry = r.row + r.h / 2;
      const dist = Math.hypot(rx - w.gx, ry - w.gy);
      if (dist < bd) { bd = dist; best = r; }
    }
    return best;
  }
  function removeEmptyRuins() {
    S.ruins = (S.ruins || []).filter(r => r.persistent || (r.scrap || 0) > 0);
  }
  function harvestRuinCargo(tgt) {
    if (!ruinHarvestable(tgt)) return null;
    tgt.scrap = Math.max(0, (tgt.scrap || 0) - 1);
    const rare = !tgt.resourceType && Math.random() < 0.01;
    const ruinEnv = environmentAtPoint(tgt.col + tgt.w / 2, tgt.row + tgt.h / 2);
    const redBezoar = !tgt.resourceType && ruinEnv.key === 'redzone' && Math.random() < 0.20;
    const relicChance = monumentEffectsAtPoint(tgt.col + tgt.w / 2, tgt.row + tgt.h / 2).chaosMaggotChance || 0;
    const chaosMaggot = tgt.type === 'ruin' && !tgt.chaosMaggotFound && Math.random() < 0.001 + relicChance;
    const electronicParts = !chaosMaggot && (tgt.type === 'wreck' || tgt.type === 'ruin') && Math.random() < 0.03;
    let mined;
    if (tgt.resourceType === '수산물') {
      if (Math.random() < 0.5) {
        mined = resourceCargoData('수산물');
        if (G.UI && G.UI.onSeafoodHarvested) G.UI.onSeafoodHarvested();
      } else {
        mined = { id: G.uid(), type: '조미료', isProduct: false, amount: 1, stats: { 크기: 0 } };
      }
    } else if (tgt.resourceType) {
      mined = resourceCargoData(tgt.resourceType);
    } else if (chaosMaggot) {
      tgt.chaosMaggotFound = true;
      mined = resourceCargoData('카오스 구더기');
      achievementStats().chaosMaggots++;
      mined._achievementChaosCounted = true;
      if (G.UI && G.UI.onChaosMaggotFound) G.UI.onChaosMaggotFound();
    } else if (electronicParts) {
      mined = resourceCargoData('전자부품');
      if (G.UI && G.UI.onElectronicPartsFound) G.UI.onElectronicPartsFound();
    } else if (redBezoar) {
      mined = resourceCargoData(['소형위석', '중형위석', '대형위석'][Math.floor(Math.random() * 3)]);
    } else {
      mined = rare ? makeSpecialTreatCargo(['콘페이토', '도돈파', '코로리', '도로리'][Math.floor(Math.random() * 4)]) : resourceCargoData('철조각');
    }
    if (!rare && !redBezoar && !chaosMaggot && !electronicParts && G.UI && G.UI.onScrapHarvested) G.UI.onScrapHarvested();
    if (tgt.scrap <= 0) removeEmptyRuins();
    return mined;
  }
  function ruinInDrillerRange(b, r) {
    if (!ruinHarvestable(r)) return false;
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2, half = 8.5;
    return r.col < cx + half && r.col + r.w > cx - half && r.row < cy + half && r.row + r.h > cy - half;
  }
  function findDrillerTarget(b) {
    const ruins = S.ruins || [];
    const priority = ruins.find(r => r.id === b.drillPriorityId);
    if (priority && ruinInDrillerRange(b, priority)) return priority;
    b.drillPriorityId = null;
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2;
    let best = null, bd = Infinity;
    for (const r of ruins) {
      if (!ruinInDrillerRange(b, r)) continue;
      const d = Math.hypot(r.col + r.w / 2 - cx, r.row + r.h / 2 - cy);
      if (d < bd) { best = r; bd = d; }
    }
    return best;
  }
  function updateDriller(b, dt) {
    if (outBuffer(b).length >= 100) {
      b.state = 'full';
      const homeX = b.col + b.w / 2, homeY = b.row + b.h / 2;
      if (!Number.isFinite(b.drillHeadX)) b.drillHeadX = homeX;
      if (!Number.isFinite(b.drillHeadY)) b.drillHeadY = homeY;
      const dx = homeX - b.drillHeadX, dy = homeY - b.drillHeadY, dist = Math.hypot(dx, dy);
      const step = Math.min(dist, dt * 5);
      if (dist > 0.001) { b.drillHeadX += dx / dist * step; b.drillHeadY += dy / dist * step; }
      return;
    }
    let tgt = (S.ruins || []).find(r => r.id === b.drillTargetId);
    if (!tgt || !ruinInDrillerRange(b, tgt) || (b.drillPriorityId && tgt.id !== b.drillPriorityId)) {
      b.drillSearchT = Math.max(0, (b.drillSearchT || 0) - dt);
      if (b.drillSearchT <= 0 || b.drillPriorityId) {
        tgt = findDrillerTarget(b);
        b.drillTargetId = tgt ? tgt.id : null;
        b.drillSearchT = 0.5 + Math.random() * 0.25;
      } else tgt = null;
    }
    const homeX = b.col + b.w / 2, homeY = b.row + b.h / 2;
    const tx = tgt ? tgt.col + tgt.w / 2 : homeX;
    const ty = tgt ? tgt.row + tgt.h / 2 : homeY;
    if (!Number.isFinite(b.drillHeadX)) b.drillHeadX = homeX;
    if (!Number.isFinite(b.drillHeadY)) b.drillHeadY = homeY;
    const dx = tx - b.drillHeadX, dy = ty - b.drillHeadY, dist = Math.hypot(dx, dy);
    const step = Math.min(dist, dt * 5);
    if (dist > 0.001) { b.drillHeadX += dx / dist * step; b.drillHeadY += dy / dist * step; }
    b.state = tgt ? (dist < 0.15 ? 'producing' : 'moving') : 'idle';
    if (!tgt || dist >= 0.15) return;
    b.drillCd = (b.drillCd || 0) - dt;
    if (b.drillCd > 0) return;
    b.drillCd = 0.45;
    const mined = harvestRuinCargo(tgt);
    if (mined) outBuffer(b).push(mined);
    spawnParticle(tx * CELL, ty * CELL, '#aeb6bf');
    if (!(S.ruins || []).includes(tgt) || !ruinHarvestable(tgt)) {
      if (b.drillPriorityId === tgt.id) b.drillPriorityId = null;
      b.drillTargetId = null;
    }
  }
  function largeWarehouseOutputCells(b) {
    const cells = [];
    const dir = b.dir == null ? 1 : b.dir;
    if (dir === 0) for (let c = b.col; c < b.col + b.w; c++) cells.push({ c, r: b.row - 1, dir });
    else if (dir === 2) for (let c = b.col; c < b.col + b.w; c++) cells.push({ c, r: b.row + b.h, dir });
    else if (dir === 3) for (let r = b.row; r < b.row + b.h; r++) cells.push({ c: b.col - 1, r, dir });
    else for (let r = b.row; r < b.row + b.h; r++) cells.push({ c: b.col + b.w, r, dir });
    return cells;
  }
  function largeWarehouseCanOutput(b) {
    const type = b.filter && b.filter[0];
    const inv = inventoryOf(b);
    const data = type && inv[type] && inv[type][0];
    if (!data) return false;
    for (const out of largeWarehouseOutputCells(b)) {
      if (!inGrid(out.c, out.r)) continue;
      const dev = deviceAt(out.c, out.r);
      if (dev && warehouseOutputDeviceReady(dev, data, out)) return true;
      if (!dev && isBeltLike(out.c, out.r) && countCargoInCell(out.c, out.r) < C.BELT_CAP) return true;
    }
    return false;
  }
  function updateLargeWarehouse(b, dt) {
    const type = b.filter && b.filter[0];
    const inv = inventoryOf(b);
    if (!type || !inv[type] || !inv[type].length) return;
    b.outputCd = (b.outputCd || 0) - dt;
    if (b.outputCd > 0) return;
    b.outputCd = 0.25;
    for (const out of largeWarehouseOutputCells(b)) {
      if (!inGrid(out.c, out.r)) continue;
      const data = inv[type][0];
      if (!data) break;
      const dev = deviceAt(out.c, out.r);
      if (dev) {
        if (!warehouseOutputDeviceReady(dev, data, out)) continue;
        if (dropInto(dev, data, out)) inv[type].shift();
        continue;
      }
      if (!isBeltLike(out.c, out.r) || countCargoInCell(out.c, out.r) >= C.BELT_CAP) continue;
      inv[type].shift();
      const cg = makeCargo(data, out.c, out.r);
      cg.dir = out.dir;
      cg.axis = (out.dir === 1 || out.dir === 3) ? 'h' : 'v';
      S.cargo.push(cg);
    }
  }
  function deliverLaborCargoToWarehouse(w) {
    const d = w.data;
    const best = nearestWarehouse(w);
    if (!best) { dropLaborCarry(w); return false; }
    const tx = best.col + best.w / 2, ty = best.row + best.h / 2;
    w.goal = { x: tx, y: ty };
    if (Math.hypot(tx - w.gx, ty - w.gy) < Math.max(best.w, best.h) / 2 + 1.0) {
      const items = laborCargoItems(d.carry);
      const units = items.reduce((sum, it) => sum + Math.max(1, Math.floor(it.amount || 1)), 0);
      if (inventoryRoomFor(best) >= units && items.every(it => warehouseIntake(it, best))) {
        d.carry = null; w.goal = null; playWorldSfx('click', w.gx, w.gy);
        return true;
      }
    }
    return false;
  }
  function laborMine(w, dt) {
    const d = w.data;
    if (d.carry && d.carry.kind === 'cargo') {
      if (laborCarryCount(d) >= laborCarryCap(d)) { deliverLaborCargoToWarehouse(w); return; }
    } else if (d.carry) {
      dropLaborCarry(w);
      return;
    }
    let tgt = w.laborTgt;
    if (!tgt || !ruinHarvestable(tgt) || !(S.ruins || []).includes(tgt)) tgt = null;   // 영역 밖이면 목표 해제
    if (!tgt) {
      tgt = nearestRuin(w);
      w.laborTgt = tgt || null;
    }
    if (!tgt) {
      if (d.carry && d.carry.kind === 'cargo') deliverLaborCargoToWarehouse(w);
      else w.goal = null;
      return;
    }
    tgt._claim = { id: d.id, t: S.playTime };
    const tx = tgt.col + tgt.w / 2, ty = tgt.row + tgt.h / 2;
    w.goal = { x: tx, y: ty };
    if (Math.hypot(tx - w.gx, ty - w.gy) > Math.max(tgt.w, tgt.h) / 2 + 0.8) return;
    w.mineCd = (w.mineCd || 0) - dt;
    if (w.mineCd > 0) return;
    w.mineCd = 0.45 / laborUpgradeMult();
    if (laborCarryCount(d) >= laborCarryCap(d)) { deliverLaborCargoToWarehouse(w); return; }
    const mined = harvestRuinCargo(tgt);
    if (mined) addLaborCargo(d, mined);
    spawnParticle(w.gx * CELL, w.gy * CELL, '#aeb6bf');
    if (!(S.ruins || []).includes(tgt) || !ruinHarvestable(tgt)) w.laborTgt = null;
    if (laborCarryCount(d) >= laborCarryCap(d)) deliverLaborCargoToWarehouse(w);
  }
  // 노동석 프레임 갱신: 기본 성장 + 사료 섭취 + 모드별 AI. 이동은 공통 루프가 처리.
  function updateLaborAI(w, dt, consumed) {
    const d = w.data;
    d.행복 = C.CREATURE_HAPPY_MAX || 100;
    d.happyCircuit = false;
    if (d.speechT > 0) d.speechT -= dt;
    d.laborTalkT = (d.laborTalkT || (5 + Math.random() * 5)) - dt;
    if (d.speechT <= 0 && d.laborTalkT <= 0) {
      const env = environmentAtPoint(w.gx, w.gy);
      const mudflatLines = ['추운데스', '손이 베여서 아픈데스', '너무 힘든데스'];
      d.speech = (d.laborMode === 'mine' && env.key === 'mudflat')
        ? mudflatLines[Math.floor(Math.random() * mudflatLines.length)]
        : ((G.LINES && G.LINES.labor) || '주인님의 명령에 복종하는데스');
      d.speechT = 2.0;
      d.laborTalkT = 8 + Math.random() * 8;
    }
    let growthSeconds = dt;
    const need = (C.FOOD_RATE[d.type] || 3) / 60 * dt;
    if (need > 0 && S.food >= need) {
      S.food -= need;
      G.Creatures.recoverHp(d, (C.FOOD_HP_RECOVER || 4) * dt);
    }
    if (G.Creatures.feedGrowth(d, growthSeconds)) playWorldSfx('grow', w.gx, w.gy);
    const mode = d.laborMode || 'free';
    if (mode === 'hold') {   // 가까운 노동 교화소 인근에서 대기
      let best = null, bd = Infinity;
      for (const rb of S.buildings) {
        if (rb.type !== 'reformer') continue;
        const dist = Math.hypot(rb.col + rb.w / 2 - w.gx, rb.row + rb.h / 2 - w.gy);
        if (dist < bd) { bd = dist; best = rb; }
      }
      if (best && bd > 2.4) { w.goal = { x: best.col + best.w / 2, y: best.row + best.h / 2 }; }
      else { w.goal = null; w.vx = 0; w.vy = 0; w.t = 1; }   // 인근/교화소 없음 → 정지
      return;
    }
    if (mode === 'retrieve') { laborRetrieve(w, dt, consumed); return; }
    if (mode === 'defend') { laborDefend(w, dt, consumed); return; }
    if (mode === 'clean') { laborClean(w, dt); return; }
    if (mode === 'mine') { laborMine(w, dt); return; }
    // free: 일반 배회 (공통 루프)
  }
  // 운치가 충분히 쌓인 가장 가까운 우리
  function nearestUnchiPen(w) {
    const bundle = C.UNCHI_BUNDLE || 10;
    let best = null, bd = C.LABOR_SIGHT || 60;
    for (const pen of frameCache.pens) {
      if ((pen.unchi || 0) < bundle) continue;
      const dist = Math.hypot(pen.col + pen.w / 2 - w.gx, pen.row + pen.h / 2 - w.gy);
      if (dist < bd) { bd = dist; best = pen; }
    }
    return best;
  }
  // 청소 모드: 우리 바닥 운치를 묶음으로 걷어 창고로 옮김
  function laborClean(w, dt) {
    const d = w.data, bundle = C.UNCHI_BUNDLE || 10;
    const pickHere = (pen) => {
      if ((pen.unchi || 0) < bundle) return false;
      pen.unchi -= bundle; addLaborCargo(d, resourceCargoData('운치'));
      playWorldSfx('click', w.gx, w.gy); return true;
    };
    if (d.carry && d.carry.kind === 'cargo') {
      // 적재 여유가 있으면 근처 우리에서 더 걷음
      if (laborCarryCount(d) < laborCarryCap(d)) {
        const pen = nearestUnchiPen(w);
        if (pen) {
          const px = pen.col + pen.w / 2, py = pen.row + pen.h / 2;
          w.goal = { x: px, y: py };
          if (Math.hypot(px - w.gx, py - w.gy) < Math.max(pen.w, pen.h) / 2 + 0.6) pickHere(pen);
          return;
        }
      }
      // 창고로 배달 → 운치 자원 입고
      let best = null, bd = Infinity;
      for (const wh of frameCache.warehouses) { const dist = Math.hypot(wh.col + wh.w / 2 - w.gx, wh.row + wh.h / 2 - w.gy); if (dist < bd) { bd = dist; best = wh; } }
      if (!best) { dropLaborCarry(w); return; }
      w.goal = { x: best.col + best.w / 2, y: best.row + best.h / 2 };
      if (bd < best.w / 2 + 1.0) {
        const items = laborCargoItems(d.carry);
        const units = items.reduce((sum, it) => sum + Math.max(1, Math.floor(it.amount || 1)), 0);
        if (inventoryRoomFor(best) >= units && items.every(it => warehouseIntake(it, best))) {
          d.carry = null; w.goal = null; playWorldSfx('click', w.gx, w.gy);
        }
      }
      return;
    }
    // 빈손: 운치가 쌓인 우리로
    const pen = nearestUnchiPen(w);
    if (!pen) { w.goal = null; return; }
    const px = pen.col + pen.w / 2, py = pen.row + pen.h / 2;
    w.goal = { x: px, y: py };
    if (Math.hypot(px - w.gx, py - w.gy) < Math.max(pen.w, pen.h) / 2 + 0.6) { if (pickHere(pen)) w.goal = null; }
  }

  function updateSpecial(b, dt) {
    if (powerBlocked(b)) { b.state = b.powerConnected ? 'nopower' : 'unpowered'; return; }
    const sp = G.DEVICES[b.type].special;
    if (sp === 'turret') updateTurret(b, dt);
    else if (sp === 'mine') updateMine(b, dt);
    // 태교 스피커는 범위 안 출산대의 출산 결과에 적용됨(updateBirthing의 applySpeakerBirthBuff). 매 프레임 효과 없음.
    else if (sp === 'feed') {
      b.noFeed = feedResourceAmount(b.feedType || '실장푸드') <= 0;
      b.state = b.noFeed ? 'idle' : 'producing';
    }
    else if (sp === 'pack') {
      b.packT = Math.max(0, (b.packT || 0) - dt);
      b.state = b.packT > 0 ? 'producing' : 'idle';
    }
    else if (sp === 'skewer') {
      if (b.held) {
        b.heldT = (b.heldT || 0) + dt;
        if (b.heldT >= 60) {
          burstAt(b.col + 0.5, b.row + 0.5);
          stainAt(b.col + 0.5, b.row + 0.5);
          b.held = null; b.heldT = 0;
          playDeviceSfx('remove', b);
          return;
        }
        if (b.speechT <= 0 && Math.random() < dt * 0.7) { b.speech = '테겍, 테겍!'; b.speechT = 1.3; b.speechTone = b.held ? linggalLine(b.held) : '테치테치'; }
          nurtureZone(b, dt, ['개념'], C.SKEWER_CHANCE);
      }
    } else if (sp === 'catch') {
      updateCatcher(b, dt);
    } else if (sp === 'techica') {
      if (b.output) { if (emitCreature(b, b.output)) b.output = null; else return; }
      updateTechica(b, dt);
    } else if (sp === 'wrongchaosmargot') {
      updateWrongChaosMaggot(b, dt);
    } else if (sp === 'terrarium') {
      updateTerrarium(b, dt);
    }
    // 'birth'(레드포인터), 'feed'(사료분배기)는 각각 updateBirthing / pens가 범위를 조회
  }
  // 포획기: 집게팔이 대상에게 뻗어 한 번에 한 개씩 끌어옴(범위 업그레이드)
  function catcherTargets(b) {
    const r = effRangeRect(b);
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    const radius = Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2 + 1;
    const out = outputCell(b);   // 막 내보낸 개체(출구 칸)는 다시 잡지 않음
    return nearbyWanderers(cx, cy, radius).filter(w => !w._dead && !w.data.labor && !w.invade && inRect(r, w.gx, w.gy) && isOwnedCell(Math.floor(w.gx), Math.floor(w.gy)) && !(Math.floor(w.gx) === out.c && Math.floor(w.gy) === out.r));
  }
  function updateCatcher(b, dt) {
    const cx = b.col + 0.5, cy = b.row + 0.5;
    if (!b.arm) b.arm = { x: cx, y: cy };
    const step = (C.CATCH_ARM_SPEED || 14) * electricMult(b) * dt;
    if (b.phase === 'pull') {                  // 잡은 개체를 출구로 끌어옴
      const dx = cx - b.arm.x, dy = cy - b.arm.y, d = Math.hypot(dx, dy);
      if (d <= step) { b.arm.x = cx; b.arm.y = cy; if (emitCreature(b, b.holding)) { b.holding = null; b.phase = 'idle'; } }
      else { b.arm.x += dx / d * step; b.arm.y += dy / d * step; }
      return;
    }
    if (b.phase === 'reach' && b.target) {      // 대상에게 팔을 뻗음
      const t = b.target;
      if (t._dead || t.data.labor || !S.wanderers.includes(t)) { b.target = null; b.phase = 'retract'; return; }
      const dx = t.gx - b.arm.x, dy = t.gy - b.arm.y, d = Math.hypot(dx, dy);
      if (d <= Math.max(step, 0.35)) {          // 도달 → 포획
        S.wanderers = S.wanderers.filter(x => x !== t); t._dead = true;
        b.holding = t.data; b.arm.x = t.gx; b.arm.y = t.gy; b.target = null; b.phase = 'pull';
        playDeviceSfx('capture', b);
      } else { b.arm.x += dx / d * step; b.arm.y += dy / d * step; }
      return;
    }
    if (b.phase === 'retract') {                // 목표 상실 → 팔 회수
      const dx = cx - b.arm.x, dy = cy - b.arm.y, d = Math.hypot(dx, dy);
      if (d <= step) { b.arm.x = cx; b.arm.y = cy; b.phase = 'idle'; } else { b.arm.x += dx / d * step; b.arm.y += dy / d * step; }
      return;
    }
    // idle: 새 목표 탐색(한 번에 하나)
    b.cd = (b.cd || 0) - dt;
    if (b.cd > 0) return;
    b.cd = 0.25 / electricMult(b);
    const inside = catcherTargets(b);
    const pool = inside.map(w => w.data);
    let best = null, bd = Infinity;
    for (const w of inside) {
      if (!matchItem(b, w.data, pool)) continue;
      const dist = Math.hypot(w.gx - cx, w.gy - cy);
      if (dist < bd) { bd = dist; best = w; }
    }
    if (best) { b.target = best; b.phase = 'reach'; }
  }
  // 출산대 위치를 덮는 레드포인터가 있으면 출산 가속 배수
  function birthBoost(b) {
    const cx = b.col + b.w / 2, cy = b.row + b.h / 2;
    for (const z of frameCache.birthZoneRects) if (inRect(z.rect, cx, cy)) return (C.BIRTH_BOOST || 1) * electricMult(z.b);
    return 1;
  }

  // 생물 산출: 출구가 벨트면 화물, 장치면 투입, 빈 바닥/격자밖이면 풀어줘 배회. (못 내보내면 false=보류)
  function emitCreature(b, data) {
    const out = outputCell(b);
    if (!inGrid(out.c, out.r)) { spawnWanderer(data, clamp(out.c + 0.5, 0.5, COLS - 0.5), clamp(out.r + 0.5, 0.5, ROWS - 0.5)); return true; }
    const dev = deviceAt(out.c, out.r);
    if (dev) return dropInto(dev, data, out);                 // 장치 있음 → 투입(바쁘면 false=대기)
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
    if ((b.type === 'chaosgate' || b.type === 'crossbelt') && b.gateA && b.gateB) {
      const dir = chaosGateDir({ col: b.gateA.c, row: b.gateA.r }, { col: b.gateB.c, row: b.gateB.r });
      const v = DIR.vec[dir];
      return {
        back: { c: b.gateA.c, r: b.gateA.r },
        front: { c: b.gateB.c, r: b.gateB.r },
        exit: { c: b.gateB.c + v.x, r: b.gateB.r + v.y },
      };
    }
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
  function immediateOutputCellAvailable(cell, data, seen) {
    if (!inGrid(cell.c, cell.r) || countCargoInCell(cell.c, cell.r) > 0) return false;
    if (isBeltLike(cell.c, cell.r)) return true;
    const dev = deviceAt(cell.c, cell.r);
    if (!dev) return true;
    if (dev.type === 'chaosgate') {
      const ends = transportEnds(dev);
      return cell.c === ends.back.c && cell.r === ends.back.r && chaosGateExitAvailable(dev, data, seen);
    }
    if (dev.type === 'tunnel' || dev.type === 'crossbelt') {
      const ends = transportEnds(dev);
      return (cell.c === ends.back.c && cell.r === ends.back.r) && transportExitAvailable(dev, data, seen);
    }
    if (dev.type === 'sorter') return sorterExitAvailable(dev, data, seen);
    return !!entryKind(cell.c, cell.r, { data });
  }
  function transportExitAvailable(dev, data, seen) {
    const visited = seen || new Set();
    if (!dev || visited.has(dev.id)) return false;
    visited.add(dev.id);
    return immediateOutputCellAvailable(transportEnds(dev).exit, data, visited);
  }
  function sorterExitAvailable(sorter, data, seen) {
    if (!sorter || (sorter.buffer && sorter.buffer.length >= SORTER_BUF)) return false;
    const visited = new Set(seen || []);
    if (visited.has(sorter.id)) return false;
    visited.add(sorter.id);
    const lanes = laneInfo(sorter);
    const hasFilter = (sorter.filter && sorter.filter.length) || (sorter.statFilter && sorter.statFilter.stat);
    let order;
    if (hasFilter) {
      const fl = sorter.filterLane === 2 ? 1 : 0;
      order = [matchItem(sorter, data) ? fl : 1 - fl];
    } else {
      const pref = (sorter.toggle || 0) % 2;
      order = [pref, 1 - pref];
    }
    return order.some(i => immediateOutputCellAvailable(lanes[i].out, data, new Set(visited)));
  }
  function warehouseOutputDeviceReady(dev, data, entryCell) {
    if (!dev) return false;
    if (dev.type === 'chaosgate') {
      const ends = transportEnds(dev);
      return entryCell.c === ends.back.c && entryCell.r === ends.back.r && dev.powerConnected && dev.powered && chaosGateExitAvailable(dev, data);
    }
    if (dev.type === 'tunnel' || dev.type === 'crossbelt') {
      const ends = transportEnds(dev);
      return entryCell.c === ends.back.c && entryCell.r === ends.back.r && transportExitAvailable(dev, data);
    }
    if (dev.type === 'sorter') return sorterExitAvailable(dev, data);
    return false;
  }
  function chaosGateExitAvailable(gate, data, seen) {
    if (!gate || gate.type !== 'chaosgate' || !gate.powerConnected || !gate.powered) return false;
    const visited = seen || new Set();
    if (visited.has(gate.id)) return false;
    visited.add(gate.id);
    return immediateOutputCellAvailable(transportEnds(gate).exit, data, visited);
  }
  // 특정 셀로 산출(장치/벨트/바닥/격자밖). 못 내보내면 false.
  function emitAtCell(cell, data) {
    if (!inGrid(cell.c, cell.r)) { spawnWanderer(data, clamp(cell.c + 0.5, 0.5, COLS - 0.5), clamp(cell.r + 0.5, 0.5, ROWS - 0.5)); return true; }
    const dev = deviceAt(cell.c, cell.r);
    if (dev) return dropInto(dev, data, cell);
    if (isBeltLike(cell.c, cell.r)) { if (countCargoInCell(cell.c, cell.r) < C.BELT_CAP) { S.cargo.push(makeCargo(data, cell.c, cell.r)); return true; } return false; }
    if (G.CREATURES[data.type]) { spawnWanderer(data, cell.c + 0.5, cell.r + 0.5); return true; }
    S.cargo.push(makeCargo(data, cell.c, cell.r)); return true;
  }
  function detachCorrectionTeacher(b) {
    if (!b || b.type !== 'correction' || !b.teacher) return false;
    const teacher = b.teacher;
    b.teacher = null;
    const out = sideCell(b, b.dir);
    if (!emitAtCell(out, teacher)) spawnWanderer(teacher, b.col + b.w / 2, b.row + b.h / 2);
    G.Assets.playSfx('click');
    return true;
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
      if (m.meatReady) {
        const product = G.Creatures.makeProduct('실장육', m);
        if (emitAtCell(meat, product)) { recordProducedCargo(b, product); b.inmates.splice(i, 1); }
        continue;
      }
      if (m.gradReady) { m.type = m.gradType || '새끼사육실장'; m.growth = 0; m.행복 = C.CREATURE_HAPPY_MAX || 100; G.Creatures.ensureVitals(m); if (emitAtCell(grad, m)) { achievementStats().pets++; b.inmates.splice(i, 1); } continue; }
      m.corrT = (m.corrT || 0) + dt;
      m.lineT = (m.lineT != null ? m.lineT : CR.LINE_MIN + Math.random() * (CR.LINE_MAX - CR.LINE_MIN)) - dt;
      if (m.lineT <= 0) {
        m.lineT = CR.LINE_MIN + Math.random() * (CR.LINE_MAX - CR.LINE_MIN);
        if ((m.stats.개념 || 0) <= CR.ESCAPE_CONCEPT && Math.random() < CR.ESCAPE_CHANCE) {
          m.speech = G.LINES.correctionEscape; m.speechT = 2.4;
          b.inmates.splice(i, 1);
          spawnWanderer(m, clamp(grad.c + 0.5, 0.5, COLS - 0.5), clamp(grad.r + 0.5, 0.5, ROWS - 0.5));
          playDeviceSfx('wash', b);
          continue;
        }
        const ls = G.LINES.correction; m.speech = ls[Math.floor(Math.random() * ls.length)]; m.speechT = 1.9;
        // 주사위: 50% 개념 +1(교사 보정) / 50% HP -1. HP 0 → 실장육.
        G.Creatures.ensureVitals(m);
        if (Math.random() < 0.5) {
          addStat(m.stats, '개념', conceptGain);
          if (Math.random() < (environmentEffectsForBuilding(b).correctionConceptChance || 0)) addStat(m.stats, '개념', 1);
        } else {
          m.hp = Math.max(0, (m.hp || 0) - 1);
          if (m.hp <= 0) m.meatReady = true;
        }
        if (!m.meatReady && m.stats.개념 >= CR.GRAD_CONCEPT && m.corrT >= CR.GRAD_TIME) { m.gradReady = true; m.gradType = (m.type === '성체실장') ? '사육실장' : '새끼사육실장'; }
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
    b.birthTimer += dt * birthBoost(b) * electricMult(b);   // 레드포인터/전력 보너스 범위면 가속
    if (b.birthTimer >= C.BIRTH_INTERVAL) {
      // 모든 부모(성체실장/독라/사육실장)는 점액 덩어리를 낳음
      const child = G.Creatures.breed(b.worker.stats, '점액덩어리');
      recordCreatureProduced(child);
      applySpeakerBirthBuff(b, child);   // 태교 스피커 범위면 육질/개념 확률 +1
      if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('made:점액덩어리');
      b.birthTimer = 0; if (!emitCreature(b, child)) b.output = child;
      b.births = (b.births || 0) + 1;
      speakFrom(b, (G.LINES && G.LINES.birthing) || ['뎃데로게~'], 1.6); playDeviceSfx('birth', b);
    }
  }
  // 태교 스피커: 범위 안 출산대에서 태어난 실장석의 육질/개념을 확률적으로 +1
  function applySpeakerBirthBuff(b, child) {
    if (!child || !child.stats) return;
    const gx = b.col + (b.w || 2) / 2, gy = b.row + (b.h || 2) / 2;
    let covered = false;
    for (const sp of specialList('nurture')) {
      if (inRect(rangeRect(sp.type, sp.col, sp.row, sp.dir), gx, gy)) { covered = true; break; }
    }
    if (!covered) return;
    const ch = C.NURTURE_BIRTH_CHANCE != null ? C.NURTURE_BIRTH_CHANCE : 0.5;
    if (Math.random() < ch) addStat(child.stats, '육질', 1);
    if (Math.random() < ch) addStat(child.stats, '개념', 1);
  }
  function updateWashbasin(b, dt) {
    if (b.output) { if (emitCreature(b, b.output)) b.output = null; else return; } // 보류 산출 먼저
    if (!b.item) { b.state = 'ready'; return; }
    b.state = 'producing'; b.washTimer += dt;
    deviceIdleTalk(b, dt, G.LINES && G.LINES.washbasin);   // 세척 중 간헐 대사
    if (b.washTimer >= C.WASH_TIME / workerMult(b)) {
      const res = G.Creatures.washClassify(b.item);
      if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('made:' + res.type);
      b.item = null; b.washTimer = 0; b.state = 'ready';
      if (!emitCreature(b, res)) b.output = res; playDeviceSfx('wash', b);
    }
  }
  function updateProcessor(b, dt) {
    const def = G.DEVICES[b.type];
    if ((b.outputs && b.outputs.length) || (b.sideOutputs && b.sideOutputs.length)) {
      bufferMany(b, (b.outputs || []).concat(b.sideOutputs || []));
      b.outputs = []; b.sideOutputs = [];
    }
    if (b.type === 'grinder') {
      if (b.item) {
        b.state = 'producing'; b.timer += dt;
        // 가동 중 빨강+초록 파티클
        for (let k = 0; k < 3; k++) if (Math.random() < dt * 18) spawnParticle((b.col + Math.random() * b.w) * CELL, (b.row + Math.random() * b.h) * CELL, Math.random() < 0.5 ? '#e23a2a' : '#3ad24a');
        if (b.timer >= def.time / massProcessingMult(b)) {
          const seas = bezoarSeasoning(b.item.type);
          if (seas > 0) {
            if (outRoom(b) <= 0) { b.state = 'ready'; return; }
            bufferMany(b, Array.from({ length: seas }, () => resourceCargoData('조미료')));
          }
          else b.weight += (b.item.stats ? (b.item.stats.크기 || 0) : 0);
          b.item = null; b.timer = 0; b.state = 'ready';
        }
      } else b.state = b.weight >= C.GRIND_TARGET ? 'ready' : 'idle';
      // 무게 25 이상 → 분쇄육(화물)을 내부 적체
      if (b.weight >= C.GRIND_TARGET) {
        if (outRoom(b) > 0) {
          const minced = G.Creatures.makeProduct('분쇄육', { stats: { 육질: 0, 개념: 0, 크기: 0 } });
          if (bufferCargo(b, minced)) b.weight -= C.GRIND_TARGET;
        }
      }
      return;
    }
    if (!b.item) { b.state = 'idle'; return; }
    b.state = 'producing'; b.timer += dt;
    if (b.timer >= def.time / (workerMult(b) * massProcessingMult(b))) {
      if (def.convert) {
        // 생물로 변환 (탈복기/교정시설) → 벨트/우리/바닥으로 배출
        const nt = def.convert[b.item.type];
        if (nt) {
          const s = b.item.stats || {};
          const res = {
            id: G.uid(), type: nt,
            stats: { 육질: s.육질, 개념: s.개념, 크기: s.크기 },
            growth: 0, 행복: b.item.행복,
          };
          if (nt === '독라' || nt === '새끼독라') G.Creatures.becomeDokura(res, nt);
          if (emitCreature(b, res)) { b.item = null; b.timer = 0; b.state = 'ready'; playDeviceSfx('wash', b); }
        } else { b.item = null; b.timer = 0; }
      } else {
        // 생산품 출력 (도축기 등)
        let products = processorProducts(b, def);
        if (b.type === 'slaughter') {
          const bezoar = bezoarForType(b.item.type);
          products = products.concat(resourceCargoData(bezoar));
          const effects = environmentEffectsForBuilding(b);
          if (effects.bezoarYield && Math.random() < Math.max(0, effects.bezoarYield - 1)) products.push(resourceCargoData(bezoar));
        }
        if (outRoom(b) <= 0) { b.state = 'ready'; return; }
        bufferMany(b, products);
        b.item = null; b.timer = 0; b.state = 'ready'; b.outputs = []; b.sideOutputs = [];
        playDeviceSfx('sell', b);
      }
    }
  }
  function slaughterBezoarCell(b) {
    const out = outputCell(b);
    const side = DIR.vec[(b.dir + 1) % 4];
    return { c: out.c + side.x, r: out.r + side.y };
  }
  function processorProducts(b, def) {
    if (b.type === 'slaughter') {
      // 실장육은 독라 태그만 산출(크기 10당 1개). 비-독라(구더기/엄지/자실장/성체실장)는 위석만.
      const tag = G.CREATURES[b.item.type] && G.CREATURES[b.item.type].tag;
      if (tag !== '독라') return [];
      const size = b.item && b.item.stats ? Math.max(0, b.item.stats.크기 || 0) : 0;
      const n = Math.floor(size / 10);
      return Array.from({ length: n }, () => G.Creatures.makeProduct(def.output, b.item));
    }
    return [G.Creatures.makeProduct(def.output, b.item)];
  }
  // 도축한 실장석 종류 → 위석 크기
  function bezoarForType(t) {
    if (t === '구더기' || t === '엄지' || t === '새끼사육실장') return '소형위석';
    if (t === '자실장' || t === '새끼독라') return '중형위석';
    return '대형위석';   // 성체실장 / 독라 / 사육실장 등
  }
  // 위석 → 분쇄기에서 나오는 조미료 수(없으면 0=일반 분쇄)
  function bezoarSeasoning(t) {
    const p = G.PRODUCTS[t];
    if (p && p.grindSeasoning) return p.grindSeasoning;
    if (t === '위석') return 3;   // 레거시 세이브 호환
    return 0;
  }

  // 배합기 메뉴별 재료 충족 여부
  function mixMenuReady(b, key) {
    const need = C.MIX_FOOD_NEED || 50;
    const conc = C.MIX_CONCENTRATE || 5;
    switch (key) {
      case '실장푸드':     return !!b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI;
      case '짓소산 푸드':  return !!b.slotAcid && (b.foodN || 0) >= need;
      case '우마이푸드':   return !!b.slotSeasoning && (b.foodN || 0) >= need;
      case '다이어트푸드': return !!b.slotScrap && (b.foodN || 0) >= need;
      case '농축운치':     return (b.unchiN || 0) >= conc;
      case '고농축운치':   return (b.cA || 0) >= conc;
      case '초고농축운치': return (b.cB || 0) >= conc;
      default: return false;
    }
  }
  function updateMixer(b, dt) {
    if (b.outputFood) { if (bufferCargo(b, b.outputFood)) b.outputFood = null; else return; }
    const conc = C.MIX_CONCENTRATE || 5;
    const key = b.menu;   // 조리실처럼 메뉴를 직접 선택해야 배합 시작
    const hasMat = b.slotMeat || (b.unchiN || 0) || b.slotAcid || b.slotSeasoning || b.slotScrap || (b.cA || 0) || (b.cB || 0) || (b.foodN || 0);
    if (!key || !(G.DEVICES.mixer.mix && G.DEVICES.mixer.mix[key]) || !mixMenuReady(b, key)) {
      b.state = hasMat ? 'ready' : 'idle'; b.timer = 0; return;
    }
    const concentration = key === '농축운치' || key === '고농축운치' || key === '초고농축운치';
    b.state = 'producing'; b.timer += dt;
    deviceIdleTalk(b, dt, G.LINES && G.LINES.mixer, '테치테치');   // 배합 중 간헐 대사(자실장 어미)
    if (b.timer < G.DEVICES.mixer.time / (workerMult(b) * (concentration ? concentrationMult() : 1))) return;
    if (outRoom(b) <= 0) return;
    const out = key === '실장푸드' ? makeFoodCargo(b.slotMeat)
      : key === '짓소산 푸드' ? makeJissoFoodCargo()
      : key === '우마이푸드' ? makeSpecialFoodCargo('우마이푸드')
      : key === '다이어트푸드' ? makeSpecialFoodCargo('다이어트푸드')
      : makeResourceCargo(key);   // 농축운치/고농축운치/초고농축운치
    if (bufferCargo(b, out)) {
      if (concentration) {
        const chance = Math.min(1, ((S.upgrades && S.upgrades.초고농축가속) || 0) * 0.1);
        if (Math.random() < chance && outRoom(b) > 0) bufferCargo(b, makeResourceCargo(key));
      }
      if (key === '실장푸드') { b.slotMeat = null; b.unchiN = 0; }
      else if (key === '짓소산 푸드') { b.slotAcid = null; b.foodN = 0; }
      else if (key === '우마이푸드') { b.slotSeasoning = null; b.foodN = 0; }
      else if (key === '다이어트푸드') { b.slotScrap = null; b.foodN = 0; }
      else if (key === '농축운치') { b.unchiN = (b.unchiN || 0) - conc; }
      else if (key === '고농축운치') { b.cA = (b.cA || 0) - conc; }
      else { b.cB = (b.cB || 0) - conc; }
      b.timer = 0; b.state = 'ready';
      playDeviceSfx('wash', b);
    }
  }
  function makeSpecialFoodCargo(type) {
    return { id: G.uid(), type, isProduct: false, amount: 50, stats: { 육질: 0, 개념: 0, 크기: 0 } };
  }
  function makeResourceCargo(type) {
    return { id: G.uid(), type, isProduct: false, amount: 1, stats: { 육질: 0, 개념: 0, 크기: 0 } };
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
  function makeJissoFoodCargo() {
    return {
      id: G.uid(), type: '짓소산 푸드', isProduct: false, amount: 50,
      stats: { 육질: 0, 개념: 0, 크기: 0 },
    };
  }
  // 짓소산 생성기: 성체실장의 행복을 5씩 짜낸다. 행복 5 감소마다 짓소산 1개, 행복 0이면 분쇄육.
  function updateAcidGen(b, dt) {
    if (!b.item) { b.state = 'idle'; b.timer = 0; b.acidProgress = 0; return; }
    G.Creatures.ensureVitals(b.item);
    if (b.speechT > 0) b.speechT -= dt;
    if (outRoom(b) <= 0) { b.state = 'ready'; return; }   // 출구 적체 → 대기(행복 보존)
    b.state = 'producing';
    const effects = environmentEffectsForBuilding(b);
    const per = (C.ACID_HAPPY_PER_ACID || 5) / (effects.acidEfficiency || 1);
    const drained = Math.min(b.item.행복 || 0, (C.ACID_HAPPY_DRAIN || 5) * dt);
    b.item.행복 = Math.max(0, (b.item.행복 || 0) - drained);
    b.acidProgress = (b.acidProgress || 0) + drained;
    // 행복 5 감소마다 짓소산 1개 + 랜덤 대사
    while (b.acidProgress >= per && outRoom(b) > 0) {
      if (!bufferCargo(b, resourceCargoData('짓소산'))) break;
      b.acidProgress -= per;
      const L = G.LINES.acidgen; if (L && L.length) { b.speech = L[Math.floor(Math.random() * L.length)]; b.speechT = 1.6; b.speechTone = b.item ? linggalLine(b.item) : '데스데스'; }
      playDeviceSfx('wash', b);
    }
    // 행복 0 → 분쇄육 생성 후 개체 소진
    if ((b.item.행복 || 0) <= 0 && outRoom(b) > 0) {
      if (bufferCargo(b, G.Creatures.makeProduct('분쇄육', { stats: b.item.stats || { 육질: 0, 개념: 0, 크기: 0 } }))) {
        b.item = null; b.timer = 0; b.acidProgress = 0; b.state = 'ready';
        playDeviceSfx('sell', b);
      }
    }
  }

  // 조리실: 재료 N개 + 조미료 1 → 요리. 재료 종류에 따라 출력 화물이 다름.
  function takeCookeryStats(b, mat, n) {
    if (!b.matStats) b.matStats = {};
    const list = Array.isArray(b.matStats[mat]) ? b.matStats[mat] : [];
    const sum = { 육질: 0, 개념: 0, 크기: 0 };
    for (let i = 0; i < n; i++) {
      const stats = list[i] || {};
      sum.육질 += stats.육질 || 0;
      sum.개념 += stats.개념 || 0;
      sum.크기 += stats.크기 || 0;
    }
    if (list.length) list.splice(0, n);
    return {
      육질: sum.육질 / n,
      개념: sum.개념 / n,
      크기: sum.크기 / n,
    };
  }
  // 재료 슬롯(ing)이 충족됐는지 — 조미료는 조리실별 내부 비축, 나머지는 b.mats 합계
  function cookIngAvail(b, ing) {
    if (ing.seasoning) return (b.seasoning || 0) >= ing.n;
    let sum = 0; for (const t of ing.any) sum += (b.mats[t] || 0);
    return sum >= ing.n;
  }
  function cookMenuReady(b, key) {
    const r = G.DEVICES.cookery.cook[key];
    return !!r && (!r.unlock || (S.upgrades && S.upgrades[r.unlock])) && r.ing.every(ing => cookIngAvail(b, ing));
  }
  // ing 소모 + (stat 재료면) 소모한 재료의 평균 스탯 반환
  function consumeCookIng(b, ing) {
    if (ing.seasoning) { b.seasoning = Math.max(0, (b.seasoning || 0) - ing.n); return null; }
    let need = ing.n; const sum = { 육질: 0, 개념: 0, 크기: 0 }; let taken = 0;
    for (const t of ing.any) {
      while (need > 0 && (b.mats[t] || 0) > 0) {
        b.mats[t] -= 1; need -= 1; taken += 1;
        const list = b.matStats && b.matStats[t];
        const s = (list && list.shift()) || {};
        sum.육질 += s.육질 || 0; sum.개념 += s.개념 || 0; sum.크기 += s.크기 || 0;
      }
    }
    if (!ing.stat || taken === 0) return null;
    return { 육질: sum.육질 / taken, 개념: sum.개념 / taken, 크기: sum.크기 / taken };
  }
  function updateCookery(b, dt) {
    const def = G.DEVICES.cookery;
    if (!b.mats) b.mats = {};
    const key = b.menu;   // 메뉴를 직접 선택해야 조리 시작
    if (!key || !def.cook[key] || !cookMenuReady(b, key)) { b.cooking = null; b.state = (key ? 'idle' : 'idle'); b.timer = 0; return; }
    b.cooking = key;
    const effects = environmentEffectsForBuilding(b);
    b.state = 'producing'; b.timer = (b.timer || 0) + dt * (effects.cookingSpeed || 1);
    if (b.timer >= def.time / (workerMult(b) * massProcessingMult(b))) {
      if (outRoom(b) > 0) {
        const r = def.cook[key];
        let stats = { 육질: 0, 개념: 0, 크기: 0 };
        for (const ing of r.ing) { const s = consumeCookIng(b, ing); if (s) stats = s; }
        if (effects.cookedQualityBonus) stats.육질 = Math.min(statMax(), (stats.육질 || 0) + effects.cookedQualityBonus);
        const output = G.PRODUCTS[r.out] && G.PRODUCTS[r.out].isProduct
          ? G.Creatures.makeProduct(r.out, { stats })
          : resourceCargoData(r.out);
        bufferCargo(b, output);
        b.timer = 0; b.cooking = null; b.state = 'ready'; playDeviceSfx('sell', b);
      }
    }
  }

  // 포장기(가공): 분쇄육1+철조각1→통조림1, 실장육1+철조각1→진공포장1
  function updatePacker(b, dt) {
    if (b.outputCargo) { if (bufferCargo(b, b.outputCargo)) b.outputCargo = null; else { b.state = 'ready'; return; } }
    b.minced = b.minced || []; b.meat = b.meat || []; b.seafood = b.seafood || []; b.scrapN = b.scrapN || 0;
    const recipeTuna = b.seafood.length >= 1 && b.scrapN >= 1;  // → 참치 통조림
    const recipeCan = b.minced.length >= 1 && b.scrapN >= 1;    // → 통조림
    const recipeVac = b.meat.length >= 1 && b.scrapN >= 1;      // → 진공포장
    if ((recipeTuna || recipeCan || recipeVac) && outRoom(b) > 0) {
      b.state = 'producing'; b.timer = (b.timer || 0) + dt;
      if (b.timer >= (G.DEVICES.packer.time || 1.5)) {
        let outType, mat;   // 우선순위: 참치 통조림 > 통조림 > 진공포장
        if (recipeTuna) { mat = b.seafood.shift(); outType = '참치 통조림'; }
        else if (recipeCan) { mat = b.minced.shift(); outType = '통조림'; }
        else { mat = b.meat.shift(); outType = '진공포장'; }
        b.scrapN -= 1;
        const out = G.Creatures.makeProduct(outType, { stats: (mat && mat.stats) || { 육질: 0, 개념: 0, 크기: 0 } });
        if (bufferCargo(b, out)) b.outputCargo = null; else b.outputCargo = out;
        b.timer = 0; b.state = 'ready'; playDeviceSfx('sell', b);
      }
    } else { b.state = (b.minced.length || b.meat.length || b.seafood.length || b.scrapN) ? 'ready' : 'idle'; b.timer = 0; }
  }
  function updateSorter(b, dt) {
    if (!b.buffer || !b.buffer.length) return;
    const lanes = laneInfo(b);
    // 컨베이어처럼 출력칸으로 강제 배출: 장치면 투입, 벨트/빈칸이면 화물로 밀어냄(가득이면 대기)
    const emit = (out, data) => {
      if (!inGrid(out.c, out.r)) return false;
      const dev = deviceAt(out.c, out.r);
      if (dev) return dropInto(dev, data, out);
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

  // 출구 칸이 새 화물을 받을 수 있는가(벨트/바닥이 비어 있거나, 장치면 자체 용량 판정)
  function grabberDropReady(b) {
    const drop = grabberRoles(b).drop;
    if (!inGrid(drop.c, drop.r)) return false;
    if (deviceAt(drop.c, drop.r)) return true;   // 장치는 dropInto에서 용량 판정
    return isCellCargoEmpty(drop.c, drop.r);     // 벨트/바닥: 화물 있으면 대기
  }
  function canGrabberDrop(b) {
    if (!b.holding) return false;
    const drop = grabberRoles(b).drop;
    if (!inGrid(drop.c, drop.r)) return false;
    const dev = deviceAt(drop.c, drop.r);
    if (!dev && isBeltLike(drop.c, drop.r)) return isCellCargoEmpty(drop.c, drop.r);
    if (!dev && !isBeltLike(drop.c, drop.r)) return isCellCargoEmpty(drop.c, drop.r);
    return !!entryKind(drop.c, drop.r, { data: b.holding });
  }
  function tryDropFromGrabber(b) {
    const drop = grabberRoles(b).drop;
    const dev = deviceAt(drop.c, drop.r);
    if (dev && dev.type === 'penbox' && SPECIAL_TREATS.has(b.holding.type)) {
      if (!isCellCargoEmpty(drop.c, drop.r)) return false;
      S.cargo.push(makeCargo(b.holding, drop.c, drop.r));
      return true;
    }
    if (dev) return dropInto(dev, b.holding, drop);
    if (isBeltLike(drop.c, drop.r)) {
      if (!isCellCargoEmpty(drop.c, drop.r)) return false;
      S.cargo.push(makeCargo(b.holding, drop.c, drop.r));
      return true;
    }
    if (!isCellCargoEmpty(drop.c, drop.r)) return false;
    if (G.CREATURES[b.holding.type]) spawnWanderer(b.holding, drop.c + 0.5, drop.r + 0.5);
    else S.cargo.push(makeCargo(b.holding, drop.c, drop.r));
    return true;
  }
  function grabberPickupPool(b) {
    const pk = grabberRoles(b).pickup;
    const dev = deviceAt(pk.c, pk.r);
    const sourcePen = frameGrabberSourcePens.get(b.id) || (dev && dev.type === 'penbox' ? dev : null);
    if (sourcePen) {
      const pool = (sourcePen.creatures || []).slice();
      if ((b.filter || []).includes('운치') && (sourcePen.unchi || 0) >= (C.UNCHI_BUNDLE || 10)) {
        pool.push({ type: '운치', amount: C.UNCHI_BUNDLE || 10, stats: { 크기: 0 } });
      }
      return pool;
    }
    if (dev && (dev.type === 'warehouse' || dev.type === 'largewarehouse' || dev.type === 'colony')) {
      const inv = inventoryOf(dev), pool = [];
      for (const type of Object.keys(inv)) {
        if (G.CREATURES[type]) continue;
        if (inv[type] && inv[type].length) pool.push(...inv[type]);
      }
      if (!isLocalWarehouse(dev)) {
        for (const [type, info] of Object.entries(GLOBAL_WAREHOUSE_RESOURCES)) {
          const available = Math.floor(S[info.state] || 0);
          if (available > 0) pool.push({ type, amount: Math.min(info.bundle(), available), stats: { 크기: 0 } });
        }
      }
      return pool;
    }
    if (dev) {
      if (dev.type === 'terrarium') {
        const pool = (dev.incubatorCreatures || []).slice();
        if ((b.filter || []).includes('운치') && (dev.incubatorUnchi || 0) >= (C.UNCHI_BUNDLE || 10)) {
          pool.push({ type: '운치', amount: C.UNCHI_BUNDLE || 10, stats: { 크기: 0 } });
        }
        return pool;
      }
      return (dev.outBuffer || []).slice();
    }
    const pool = (cargoIdx.get(pk.c + '|' + pk.r) || [])
      .filter(cg => !cg._dead && Math.floor(cg.gx) === pk.c && Math.floor(cg.gy) === pk.r)
      .map(cg => cg.data);
    for (const w of nearbyWanderers(pk.c + 0.5, pk.r + 0.5, 1)) {
      if (!w._dead && !w.data.labor && Math.floor(w.gx) === pk.c && Math.floor(w.gy) === pk.r) pool.push(w.data);
    }
    return pool;
  }
  function grabberCanRouteData(b, data) {
    const drop = grabberRoles(b).drop;
    if (!inGrid(drop.c, drop.r) || !data) return false;
    const dev = deviceAt(drop.c, drop.r);
    if (dev && dev.type === 'penbox' && SPECIAL_TREATS.has(data.type)) return isCellCargoEmpty(drop.c, drop.r);
    if (dev) return !!entryKind(drop.c, drop.r, { data });
    return isCellCargoEmpty(drop.c, drop.r);
  }
  function grabberHasPickupCandidate(b) {
    if (!b || b.holding || isConstructing(b)) return false;
    const pool = grabberPickupPool(b);
    return pool.some(data => matchItem(b, data, pool) && grabberCanRouteData(b, data));
  }
  function higherPriorityGrabberClaimsPickup(b) {
    const priority = grabberPriority(b);
    const pickup = grabberRoles(b).pickup;
    const sourcePen = frameGrabberSourcePens.get(b.id);
    for (const other of frameGrabbersByPriority) {
      if (other === b || grabberPriority(other) >= priority) continue;
      if (sourcePen) {
        if (frameGrabberSourcePens.get(other.id) !== sourcePen) continue;
      } else {
        const op = grabberRoles(other).pickup;
        if (op.c !== pickup.c || op.r !== pickup.r) continue;
      }
      // 높은 순위 집게가 비어 있고 지금 집어갈 수 있을 때만 하위 순위를 대기시킨다.
      // 이미 화물을 운송 중인 집게는 점유자로 보지 않아 여러 집게가 병렬로 움직인다.
      if (grabberHasPickupCandidate(other)) return true;
    }
    return false;
  }
  function updateGrabber(b, dt) {
    b.powerActivityT = Math.max(0, (b.powerActivityT || 0) - dt);
    b.cd = (b.cd || 0) + dt;
    // 같은 생산 주기에서도 1→5 순서가 흔들리지 않도록 우선순위마다 0.02초씩 작동 시점을 늦춘다.
    // 1순위=추가 지연 없음, 2순위=0.02초, ... 5순위=0.08초.
    if (b.cd < grabberInterval(b) + grabberPriorityDelay(b)) return;
    const roles = grabberRoles(b);
    if (b.holding) {
      if (tryDropFromGrabber(b)) {
        b.holding = null; b.cd = 0;
        b.powerActivityT = Math.max(0.25, grabberInterval(b));
      }
    } else {
      if (!grabberDropReady(b)) return;   // 출구가 화물로 가득이면 더 이상 옮기지 않음
      // 같은 투입구에 더 높은 우선순위 집게가 잡을 수 있는 화물이 있으면 선점하지 않는다.
      // 높은 순위 집게가 쿨다운 중이어도 우선권을 유지하되, 필터가 맞지 않으면 낮은 순위가 동작한다.
      if (higherPriorityGrabberClaimsPickup(b)) return;
      const pk = roles.pickup;
      const dev = deviceAt(pk.c, pk.r);
      const sourcePen = frameGrabberSourcePens.get(b.id) || (dev && dev.type === 'penbox' ? dev : null);
      if (sourcePen) {                                // 같은 우리 전체를 하나의 우선순위 그룹으로 처리
        let ex = takeUnchiFromPen(sourcePen, b);
        if (!ex) ex = takeFromPen(sourcePen, b);
        if (ex) { b.holding = ex; b.cd = 0; b.powerActivityT = Math.max(0.25, grabberInterval(b)); }
      } else if (dev && (dev.type === 'warehouse' || dev.type === 'largewarehouse' || dev.type === 'colony')) {  // 창고/콜로니에서 화물 추출(필터)
        const ex = extractFromWarehouse(b, dev); if (ex) { b.holding = ex; b.cd = 0; b.powerActivityT = Math.max(0.25, grabberInterval(b)); }
      } else if (dev) {
        const ex = extractFromDevice(dev, b); if (ex) { b.holding = ex; b.cd = 0; b.powerActivityT = Math.max(0.25, grabberInterval(b)); }
      } else {
        const cargoCell = (cargoIdx.get(pk.c + '|' + pk.r) || []).filter(cg => !cg._dead && Math.floor(cg.gx) === pk.c && Math.floor(cg.gy) === pk.r);
        const cargoPool = cargoCell.map(cg => cg.data);
        let found = null;
        for (const cg of cargoCell) if (matchItem(b, cg.data, cargoPool)) { found = cg; break; }
        if (found) {
          const picked = takeCargoUnit(found);
          if (picked) b.holding = picked;
          if (found._dead) S.cargo = S.cargo.filter(x => x !== found);
          b.cd = 0; b.powerActivityT = Math.max(0.25, grabberInterval(b));
        }
        else {
          // 노동석은 집게/긴팔집게에 잡히지 않음
          const wanderCell = nearbyWanderers(pk.c + 0.5, pk.r + 0.5, 1).filter(w => !w._dead && !w.data.labor && Math.floor(w.gx) === pk.c && Math.floor(w.gy) === pk.r);
          const wanderPool = wanderCell.map(w => w.data);
          let wander = null;
          for (const w of wanderCell) if (matchItem(b, w.data, wanderPool)) { wander = w; break; }
          if (wander) {
            // 노동석이 물건을 들고 있었다면 그 자리에 내려놓음(유실 방지)
            if (wander.data.carry) {
              const c = wander.data.carry; wander.data.carry = null;
              if (c.kind === 'creature') spawnWanderer(c.data, wander.gx, wander.gy, 1.0);
              else S.cargo.push(makeCargo(c.data, Math.floor(wander.gx), Math.floor(wander.gy)));
            }
            wander._dead = true;
            b.holding = wander.data; S.wanderers = S.wanderers.filter(x => x !== wander); b.cd = 0; b.powerActivityT = Math.max(0.25, grabberInterval(b));
          }
        }
      }
    }
  }

  /* ---- 입력 ----------------------------------------------------------- */
  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        const ok = G.Save && G.Save.saveSlot(1);
        G.UI.flash && G.UI.flash(ok ? '슬롯 1에 저장했습니다.' : '슬롯 1 저장에 실패했습니다.');
        return;
      }
      const optionsMenu = document.getElementById('options-menu');
      if (optionsMenu && optionsMenu.classList.contains('open')) return;
      if (S.screen !== 'factory' || S.overlay) return;
      if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const k = e.key;
      if (e.ctrlKey || e.metaKey) {   // Ctrl 단축키
        if (k === 'z' || k === 'Z') { e.preventDefault(); undo(); }
        else if (k === 'c' || k === 'C') { e.preventDefault(); copySelection(); }
        else if (/^[0-9]$/.test(k)) { e.preventDefault(); saveBlueprint(k); }
        return;
      }
      const lk = k.toLowerCase();
      if (lk === 'b') {
        e.preventDefault();
        openPlayerInventory();
        return;
      }
      if (['w', 'a', 's', 'd'].includes(lk)) {
        e.preventDefault();
        closeAuxPanels();
        moveKeys[lk] = true;
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('cameraMove');
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('camera:' + lk);
        return;
      }
      if (k === 'f' || k === 'F') {
        e.preventDefault();
        closeAuxPanels();
        storeNearbyCargo();
        return;
      }
      if (k === 'r' || k === 'R') {
        closeAuxPanels();
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('rotateShortcut');
        if (pasteMode && pasteClip && pasteClip.length) { rotatePasteClip(); G.Assets.playSfx('rotate'); }
        else if (currentTool && G.DEVICES[currentTool].rotatable) { ghostDir = (ghostDir + 1) % 4; G.Assets.playSfx('rotate'); }
        else if (moveMode) {
          moving.forEach(m => {
            if (G.DEVICES[m.b.type].rotatable) {
              const center = isGrabberType(m.b.type) ? grabberRoles(m.b).mid : null;
              m.b.dir = (m.b.dir + 1) % 4;
              if (isGrabberType(m.b.type)) {
                const o = centeredOriginFor(m.b.type, center, m.b.dir);
                m.b.col = o.col; m.b.row = o.row;
              }
              const fp = footprint(m.b.type, m.b.col, m.b.row, m.b.dir); m.b.w = fp.w; m.b.h = fp.h;
            }
          });
          G.Assets.playSfx('rotate');
        }
        else if (hoverBuilding) rotateBuilding(hoverBuilding);  // 호버 중 R로 회전
      } else if (k === 'Escape') {
        closeAuxPanels();
        if (pasteMode) { pasteMode = false; } else if (currentTool) cancelTool(); else if (moveMode) cancelMove(); else { S.selection = []; wallSelection = []; }
      } else if (k === 'Delete' || k === 'Backspace') {
        e.preventDefault();
        closeAuxPanels();
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('deleteShortcut');
        if (selectedPenCreature) {
          const sold = sellPenCreatureRef(selectedPenCreature);
          selectedPenCreature = null;
          if (sold && G.UI.flash) G.UI.flash('개체 판매 ₩+' + sold.gained.toLocaleString());
        } else if (S.selection.length || wallSelection.length) { snapshot(); deleteSelection(); }
        else if (mouseCell) { snapshot(); deleteFloorAt(mouseCell); }   // 바닥 화물/배회 제거
      } else if (k === 'm' || k === 'M') {
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('moveShortcut');
        e.preventDefault(); closeAuxPanels(); enterMove();
      } else if (k === 'e' || k === 'E') {
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('buildShortcut');
        e.preventDefault(); closeAuxPanels(); activeCat = 'logistics'; renderMenuItems(); highlightCat(); selectTool('belt');
      } else if (k === 'q' || k === 'Q') {
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('wallShortcut');
        e.preventDefault(); closeAuxPanels(); selectTool('wall'); setStatus('벽 모드: 모서리 점에서 시작해 수평/수직으로 드래그 설치. 드래그 선택 후 Del=벽 삭제.');
      } else if (k === 'x' || k === 'X') {
        if (!penEraseKey) { penEraseKey = true; setStatus('우리 철거: X를 누른 채 드래그한 범위의 우리 칸을 철거합니다.'); }
      } else if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('numberShortcut');
        if (hoveredMenuType) assignHotkey(k, hoveredMenuType);   // 메뉴에 올린 채 숫자 = 지정
        else if (typeForKey(k)) selectTool(typeForKey(k));        // 그냥 숫자 = 선택
      }
    });
    window.addEventListener('keyup', (e) => {
      const lk = e.key.toLowerCase();
      if (moveKeys.hasOwnProperty(lk)) moveKeys[lk] = false;
      if (lk === 'x') { penEraseKey = false; penEraseStart = null; setStatus('장치 선택 · 빈손: 드래그=영역선택, 클릭=선택, 더블클릭=동종선택, Del=삭제, M=이동'); }
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
  // 현재 벽 레벨 최대 체력 = WALL_HP × 2^레벨
  function wallMaxHp() { return (C.WALL_HP || 50) * Math.pow(2, S.wallLevel || 0); }
  // 벽 key의 중심 좌표(칸)
  function wallKeyPoint(key) {
    const seg = key.split('|'), A = +seg[1], B = +seg[2];
    return seg[0] === 'V' ? { x: A, y: B + 0.5 } : { x: A + 0.5, y: B };
  }
  function wallKeyInDanger(key) {
    const range = C.DEFENSE_DANGER_RANGE || 18, p = wallKeyPoint(key);
    for (const w of S.wanderers) { if (w.invade && Math.hypot(p.x - w.gx, p.y - w.gy) <= range) return true; }
    return false;
  }
  function commitWallLine() {
    const keys = wallLineKeys(wallStartPoint, wallEndPoint || wallStartPoint).filter(k => !S.walls[k]);
    if (!keys.length) return;
    if (keys.some(wallKeyInDanger)) { G.UI.flash && G.UI.flash('위험지역에 설치할 수 없습니다'); return; }
    const cost = keys.length * (G.BUILD_COST.wall || 0);
    if (!spend(cost)) return;
    const hp = wallMaxHp();
    keys.forEach(k => { S.walls[k] = hp; });   // 벽 체력(현재 레벨 최대)
    if (keys.length) G.Assets.playSfx('place');
  }
  // 벽 체력 헬퍼(레거시 세이브의 true=가득)
  function wallHp(key) { const v = S.walls[key]; return v === true ? wallMaxHp() : (v || 0); }
  // (gx,gy) 근처의 벽 key(임계 거리 이내). 없으면 null.
  function wallAtPoint(gx, gy) {
    const c = Math.floor(gx), r = Math.floor(gy), fx = gx - c, fy = gy - r;
    const cand = [
      { key: 'V|' + c + '|' + r, d: fx }, { key: 'V|' + (c + 1) + '|' + r, d: 1 - fx },
      { key: 'H|' + c + '|' + r, d: fy }, { key: 'H|' + c + '|' + (r + 1), d: 1 - fy },
    ].filter(o => S.walls[o.key]).sort((a, b) => a.d - b.d);
    return (cand.length && cand[0].d <= 0.3) ? cand[0].key : null;
  }
  // 벽/문에 피해. 0 이하면 파괴.
  function damageWall(key, amount) {
    if (!key) return;
    const seg = key.split('|'), A = +seg[1], B = +seg[2];
    const wx = (seg[0] === 'V') ? A : A + 0.5, wy = (seg[0] === 'V') ? B + 0.5 : B;
    if (S.walls[key]) {
      const hp = wallHp(key) - amount;
      if (hp <= 0) { delete S.walls[key]; burstAt(wx, wy); playWorldSfx('remove', wx, wy); }
      else S.walls[key] = hp;
      return;
    }
    if (S.doors[key]) {                       // 문도 침입자가 부술 수 있음
      const dr = S.doors[key];
      dr.hp = (dr.hp != null ? dr.hp : wallMaxHp()) - amount;
      if (dr.hp <= 0) { delete S.doors[key]; burstAt(wx, wy); playWorldSfx('remove', wx, wy); }
    }
  }
  function doorHp(key) { const d = S.doors[key]; return d ? (d.hp != null ? d.hp : wallMaxHp()) : 0; }
  // (gx,gy) 근처의 문 key. 없으면 null.
  function doorAtPoint(gx, gy) {
    const c = Math.floor(gx), r = Math.floor(gy), fx = gx - c, fy = gy - r;
    const cand = [
      { key: 'V|' + c + '|' + r, d: fx }, { key: 'V|' + (c + 1) + '|' + r, d: 1 - fx },
      { key: 'H|' + c + '|' + r, d: fy }, { key: 'H|' + c + '|' + (r + 1), d: 1 - fy },
    ].filter(o => S.doors[o.key]).sort((a, b) => a.d - b.d);
    return (cand.length && cand[0].d <= 0.3) ? cand[0].key : null;
  }
  // 문 설치: 클릭한 벽 칸 기준 연속 3칸의 벽을 문으로 바꿈
  function doorRun(startKey) {
    const seg = startKey.split('|'), t = seg[0], A = +seg[1], B = +seg[2];
    const runFrom = (a, b) => { const keys = []; for (let i = 0; i < 3; i++) keys.push(t === 'V' ? ('V|' + a + '|' + (b + i)) : ('H|' + (a + i) + '|' + b)); return keys; };
    const tries = t === 'V' ? [runFrom(A, B), runFrom(A, B - 1), runFrom(A, B - 2)] : [runFrom(A, B), runFrom(A - 1, B), runFrom(A - 2, B)];
    for (const keys of tries) if (keys.every(k => S.walls[k])) return keys;
    return null;
  }
  function tryPlaceDoor(gx, gy) {
    const wkey = wallAtPoint(gx, gy);
    if (!wkey) { G.UI.flash && G.UI.flash('문은 벽 위에만 설치할 수 있습니다'); return; }
    const run = doorRun(wkey);
    if (!run) { G.UI.flash && G.UI.flash('연속된 벽 3칸 위에만 설치할 수 있습니다'); return; }
    if (run.some(wallKeyInDanger)) { G.UI.flash && G.UI.flash('위험지역에 설치할 수 없습니다'); return; }
    if (!spend(G.BUILD_COST.door || 500)) return;
    const gid = G.uid(), hp = wallMaxHp();
    run.forEach(k => { delete S.walls[k]; S.doors[k] = { gid, hp }; });   // 벽 → 문
    G.Assets.playSfx('place');
  }
  // 문 그룹 전체 삭제(한 칸 클릭→그룹 전부)
  function removeDoorGroupAt(key) {
    const dr = S.doors[key]; if (!dr) return;
    const gid = dr.gid;
    for (const k in S.doors) if (S.doors[k] && S.doors[k].gid === gid) delete S.doors[k];
  }
  function edgesInRect(map, a, b) {
    const minC = Math.min(a.col, b.col), maxC = Math.max(a.col, b.col);
    const minR = Math.min(a.row, b.row), maxR = Math.max(a.row, b.row);
    return Object.keys(map).filter(k => {
      if (!map[k]) return false;
      const p = k.split('|'), x = +p[1], y = +p[2];
      if (p[0] === 'V') return x >= minC && x <= maxC + 1 && y >= minR && y <= maxR;
      return x >= minC && x <= maxC && y >= minR && y <= maxR + 1;
    });
  }
  function wallsInRect(a, b) { return edgesInRect(S.walls, a, b); }
  function doorsInRect(a, b) { return edgesInRect(S.doors, a, b); }
  // (ox,oy)→(nx,ny) 이동 시 벽을 통과하면 경계 직전으로 막음. out(선택)에 막은 벽 key 기록.
  function wallBlock(ox, oy, nx, ny, ignorePens, out, isLabor) {
    // 막는 경계: 벽은 항상, 문은 노동석이 아닌 경우에만(노동석은 문을 통과)
    const maps = isLabor ? [S.walls] : [S.walls, S.doors];
    if (nx !== ox) {
      v1: for (const map of maps) for (const key in map) {
        if (!map[key] || key[0] !== 'V') continue;
        const p = key.split('|'), X = +p[1], R = +p[2];
        const cy = clamp(oy, R, R + 1);
        if (Math.abs(oy - cy) > COLLIDE) continue;
        if (ox <= X - COLLIDE && nx > X - COLLIDE) { nx = X - COLLIDE; if (out) out.hit = key; break v1; }
        if (ox >= X + COLLIDE && nx < X + COLLIDE) { nx = X + COLLIDE; if (out) out.hit = key; break v1; }
      }
    }
    if (ny !== oy) {
      h1: for (const map of maps) for (const key in map) {
        if (!map[key] || key[0] !== 'H') continue;
        const p = key.split('|'), C0 = +p[1], Y = +p[2];
        const cx = clamp(nx, C0, C0 + 1);
        if (Math.abs(nx - cx) > COLLIDE) continue;
        if (oy <= Y - COLLIDE && ny > Y - COLLIDE) { ny = Y - COLLIDE; if (out) out.hit = key; break h1; }
        if (oy >= Y + COLLIDE && ny < Y + COLLIDE) { ny = Y + COLLIDE; if (out) out.hit = key; break h1; }
      }
    }
    for (const map of maps) for (const key in map) {
      if (!map[key]) continue;
      const p = key.split('|'), A = +p[1], B = +p[2];
      if (p[0] === 'V') {
        const cy = clamp(ny, B, B + 1);
        if (Math.abs(ny - cy) <= COLLIDE && Math.abs(nx - A) < COLLIDE) { nx = (ox < A) ? A - COLLIDE : A + COLLIDE; if (out) out.hit = key; }
      } else {
        const cx = clamp(nx, A, A + 1);
        if (Math.abs(nx - cx) <= COLLIDE && Math.abs(ny - B) < COLLIDE) { ny = (oy < B) ? B - COLLIDE : B + COLLIDE; if (out) out.hit = key; }
      }
    }
    if (!ignorePens) for (const pen of G.Pens.allPens()) {
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
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault(); closeAuxPanels();
      if (G.UI && G.UI.markTutorialAction) {
        G.UI.markTutorialAction('zoom');
        G.UI.markTutorialAction(e.deltaY < 0 ? 'zoomIn' : 'zoomOut');
      }
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); closeAuxPanels(); panning = true; panStart = { x: e.clientX, y: e.clientY, camx: cam.x, camy: cam.y }; return; }
      if (e.button !== 0) return;
      const cell = screenToCell(e.clientX, e.clientY);
      if (!cell) return;
      if (pasteMode) { pasteAt(cell.col, cell.row); return; }   // 붙여넣기
      if (penEraseKey) { closeAuxPanels(); penEraseStart = cell; return; }   // X+드래그 우리 철거
      if (moveMode) { tryDropMove(); return; }
      if (currentTool && !isOwnedCell(cell.col, cell.row)) { closeAuxPanels(); showLandPrompt(cell, e.clientX, e.clientY); return; }
      if (currentTool === 'wall') { closeAuxPanels(); snapshot(); wallDragging = true; wallStartPoint = wallPointAt(mouseGX, mouseGY); wallEndPoint = wallStartPoint; return; }
      if (currentTool === 'door') { closeAuxPanels(); snapshot(); const w = screenToWorld(e.clientX, e.clientY); if (w) tryPlaceDoor(w.wx, w.wy); return; }
      if (currentTool === 'belt' || currentTool === 'guardbelt') { closeAuxPanels(); snapshot(); beltDragging = true; beltDragAxis = null; beltPath = [{ col: cell.col, row: cell.row }]; }
      else if (currentTool === 'chaosgate') { closeAuxPanels(); snapshot(); chaosGateDragStart = cell; }
      else if (currentTool === 'crossbelt') { closeAuxPanels(); snapshot(); crossbeltDragStart = cell; }
      else if (currentTool === 'penbox') { closeAuxPanels(); snapshot(); penDragStart = cell; }
      else if (currentTool) {
        closeAuxPanels(); snapshot(); const o = ghostOrigin(currentTool, cell, ghostDir);
        const fp = footprint(currentTool, o.col, o.row, ghostDir);
        if (defenseDangerBlocked(currentTool, fp.cells)) { G.UI.flash && G.UI.flash('위험지역에 설치할 수 없습니다'); }
        else if (placeDevice(currentTool, o.col, o.row, ghostDir, isGrabberType(currentTool) ? ghostFilterDraft : null)) G.Assets.playSfx('place');
      }
      else {
        closeAuxPanels();
        const wpt = screenToWorld(e.clientX, e.clientY);
        // 문 선(line)을 직접 클릭하면 문 그룹 선택(Del로 삭제)
        const dkey = wpt ? doorAtPoint(wpt.wx, wpt.wy) : null;
        if (dkey) { selectDoor(dkey); return; }
        // 벽 선(line)을 직접 클릭하면 벽 우선 선택(다른 건물과 중첩 시 벽 우선)
        const wkey = wpt ? wallAtPoint(wpt.wx, wpt.wy) : null;
        if (wkey) { selectWall(wkey, e.clientX, e.clientY); return; }
        // 사료분배기는 위에 겹친 실장석보다 우선 선택됨 — 생물 집기를 건너뛰고
        // 일반 선택 경로(mouseup의 selectAt)로 넘겨 사료 선택 창이 정상적으로 뜨게 함
        const devHere = deviceAt(cell.col, cell.row);
        const feederHere = !!(devHere && G.DEVICES[devHere.type] && G.DEVICES[devHere.type].special === 'feed');
        const hit = feederHere ? null : creatureAtClient(e.clientX, e.clientY);  // 벨트 위/배회 생물 집기·정보
        if (hit) { startCreatureDrag(hit, e); return; }
        pendingSelect = true; selDragging = false; selStartCell = cell; selDownClient = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1 || panning) { panning = false; panStart = null; }
      if (penEraseStart) { const end = mouseCell || penEraseStart; snapshot(); demolishPensInRect(penEraseStart, end); penEraseStart = null; return; }
      if (wallDragging) { commitWallLine(); wallDragging = false; wallStartPoint = null; wallEndPoint = null; return; }
      if (beltDragging) {
        commitBelts();
        beltDragging = false; beltPath = []; beltDragAxis = null;
        return;
      }
      if (chaosGateDragStart) {
        const end = mouseCell || chaosGateDragStart;
        if (!placeChaosGate(chaosGateDragStart, end)) G.UI.flash && G.UI.flash('카오스 게이트의 입구와 출구는 비어 있는 소유 타일에 각각 설치해야 합니다.');
        chaosGateDragStart = null;
        return;
      }
      if (crossbeltDragStart) {
        const end = mouseCell || crossbeltDragStart;
        if (!placeCrossbelt(crossbeltDragStart, end)) G.UI.flash && G.UI.flash('횡단벨트는 비어 있는 소유 타일 사이에 직선으로 설치해야 합니다.');
        crossbeltDragStart = null;
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
          // selectAt이 빈 칸에서 closeAuxPanels()로 패널을 닫으므로, 토지 구매창은 그 뒤에 띄움
          selectAt(cell, e.clientX, e.clientY);
          if (cell && !buildingAtCell(cell)) showLandPrompt(cell, e.clientX, e.clientY);
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
      const cell = screenToCell(e.clientX, e.clientY);
      const selected = S.selection.length === 1 ? S.buildings.find(b => b.id === S.selection[0]) : null;
      const selectedMortars = S.selection.map(id => S.buildings.find(b => b.id === id)).filter(b => b && isMortar(b));
      if (cell && selectedMortars.length) {
        const activeMortars = selectedMortars.filter(b => b.manualTarget);
        if (activeMortars.length) {
          activeMortars.forEach(b => { b.manualTarget = null; });
          G.Assets.playSfx('click');
          G.UI.flash && G.UI.flash(`박격포 ${activeMortars.length}대 강제공격 중단`);
          return;
        }
        let assigned = 0;
        const gx = cell.col + 0.5, gy = cell.row + 0.5;
        selectedMortars.forEach(b => {
          const cx = b.col + b.w / 2, cy = b.row + b.h / 2;
          if (Math.hypot(gx - cx, gy - cy) > turretRange(b)) return;
          b.manualTarget = { gx, gy };
          assigned++;
        });
        if (assigned) {
          G.Assets.playSfx('click');
          G.UI.flash && G.UI.flash(`박격포 ${assigned}대 강제공격 시작`);
        } else {
          G.UI.flash && G.UI.flash('선택한 박격포의 사거리 밖입니다.');
        }
        return;
      }
      const ruin = ruinAtCell(cell);
      if (selected && selected.type === 'driller' && ruin) {
        if (!ruinInDrillerRange(selected, ruin)) {
          G.UI.flash && G.UI.flash('드릴러의 17×17 채취 범위를 벗어났습니다.');
          return;
        }
        selected.drillPriorityId = ruin.id;
        selected.drillTargetId = ruin.id;
        G.Assets.playSfx('click');
        G.UI.flash && G.UI.flash('드릴러 우선 채취 대상 지정');
        return;
      }
      if (commandSelectedWorkers(cell)) return;
      S.selection = []; wallSelection = []; doorSelection = []; selectedWorkers = [];
    });
  }

  // 캔버스 위 생물(화물/배회/우리 안) 히트테스트 → {data, remove(), fgx,fgy}
  function creatureVisualRect(type, fx, fy) {
    const scale = (C.DISPLAY_SCALE && C.DISPLAY_SCALE[type]) || 1;
    const rec = G.Assets.creatureImg(type);
    let dw = 0.62 * scale, dh = 0.82 * scale;
    if (rec && rec.ok && rec.img.width) {
      dw = (rec.img.width / 4) * scale / CELL;
      dh = (rec.img.height / 4) * scale / CELL;
    }
    return { x0: fx - dw / 2, x1: fx + dw / 2, y0: fy - dh, y1: fy };
  }
  function hitCreatureSprite(type, fx, fy, gx, gy) {
    const r = creatureVisualRect(type, fx, fy);
    if (gx < r.x0 || gx > r.x1 || gy < r.y0 || gy > r.y1) return null;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    return Math.hypot(cx - gx, cy - gy);
  }
  function creatureAtClient(cx, cy) {
    const w = screenToWorld(cx, cy); if (!w) return null;
    const gx = w.wx, gy = w.wy;
    let best = null, bd = Infinity;
    // 우리 안 생물
    for (const pen of S.buildings) {
      if (pen.type !== 'penbox') continue;
      for (const c of pen.creatures) {
        const wx = pen.col + (c.px || 0.5), wy = pen.row + (c.py || 0.5);
        const d = hitCreatureSprite(c.type, wx, wy, gx, gy);
        if (d == null) continue;
        if (d < bd) { bd = d; best = { data: c, pen, fgx: wx, fgy: wy, remove: () => { const i = pen.creatures.indexOf(c); if (i >= 0) pen.creatures.splice(i, 1); } }; }
      }
    }
    for (const w of S.wanderers) {
      if (w.invade) continue;   // 외부 침입 실장석은 클릭/드래그 불가
      if (!G.CREATURES[w.data.type] || !isOwnedCell(Math.floor(w.gx), Math.floor(w.gy))) continue;
      const d = hitCreatureSprite(w.data.type, w.gx, w.gy, gx, gy);
      if (d == null) continue;
      if (d < bd) { bd = d; best = { data: w.data, wild: isExternalOrigin(w), fgx: w.gx, fgy: w.gy, remove: () => { S.wanderers = S.wanderers.filter(x => x !== w); } }; }
    }
    for (const cg of S.cargo) {
      if (!G.CREATURES[cg.data.type] || !isOwnedCell(Math.floor(cg.gx), Math.floor(cg.gy))) continue;
      const d = hitCreatureSprite(cg.data.type, cg.gx, cg.gy, gx, gy);
      if (d == null) continue;
      if (d < bd) { bd = d; best = { data: cg.data, fgx: cg.gx, fgy: cg.gy, remove: () => { takeCargoUnit(cg); if (cg._dead) S.cargo = S.cargo.filter(x => x !== cg); } }; }
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
        if (data.labor) { showLaborPanel(data, ev.clientX, ev.clientY); return; }   // 노동석 클릭 = 명령 창
        G.UI.showCreatureInfo(data, ev.clientX, ev.clientY);
        return;
      }
      selectedPenCreature = null;
      if (ghost) ghost.remove();
      if (hit.wild) data.externalOrigin = true;
      const cell = screenToCell(ev.clientX, ev.clientY);
      if (cell && isOwnedCell(cell.col, cell.row)) dropCreatureAt(cell, data);
      else spawnWanderer(data, hit.fgx, hit.fgy);
      if (hit.wild && G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('wildMoved');
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }
  function dropCreatureAt(cell, data) {
    const dev = deviceAt(cell.col, cell.row);
    if (dev && dropInto(dev, data, { c: cell.col, r: cell.row })) return;            // 우리/장치에 투입(dropInto가 penbox 처리)
    // 노동석은 벨트에 안 올라감
    if (!data.labor && isBeltLike(cell.col, cell.row) && countCargoInCell(cell.col, cell.row) < C.BELT_CAP) { S.cargo.push(makeCargo(data, cell.col, cell.row)); return; }
    spawnWanderer(data, cell.col + 0.5, cell.row + 0.5); // 빈 바닥 → 배회
  }

  function selectedLiveWorkers() {
    const live = new Set(S.wanderers.filter(w => w.data && w.data.labor && !w._dead).map(w => w.data));
    selectedWorkers = selectedWorkers.filter(d => live.has(d));
    return selectedWorkers;
  }
  function cargoAtCell(cell) {
    if (!cell) return null;
    let best = null, bd = Infinity;
    for (const cg of S.cargo) {
      if (cg._dead) continue;
      const c = Math.floor(cg.gx), r = Math.floor(cg.gy);
      if (c !== cell.col || r !== cell.row) continue;
      const d = Math.hypot(cg.gx - (cell.col + 0.5), cg.gy - (cell.row + 0.5));
      if (d < bd) { bd = d; best = cg; }
    }
    return best;
  }
  function wandererAtCell(cell, pred) {
    if (!cell) return null;
    let best = null, bd = Infinity;
    for (const w of S.wanderers) {
      if (w._dead || !w.data || !G.CREATURES[w.data.type]) continue;
      if (pred && !pred(w)) continue;
      if (Math.floor(w.gx) !== cell.col || Math.floor(w.gy) !== cell.row) continue;
      const d = Math.hypot(w.gx - (cell.col + 0.5), w.gy - (cell.row + 0.5));
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }
  function commandSelectedWorkers(cell) {
    const workers = selectedLiveWorkers();
    if (!workers.length || !cell) return false;
    const ruin = ruinAtCell(cell);
    const dev = buildingAtCell(cell);
    const raider = wandererAtCell(cell, w => !!w.raider || !!w.invade);
    const loose = wandererAtCell(cell, w => !w.raider && !w.invade && !w.data.labor && isOwnedCell(Math.floor(w.gx), Math.floor(w.gy)));
    const cg = cargoAtCell(cell);
    let mode = null, target = null, kind = null;
    if (ruin && ruinHarvestable(ruin)) { mode = 'mine'; target = ruin; kind = 'ruin'; }
    else if (ruin) {   // 플레이어 영역 밖 유적은 채취 불가
      for (const d of workers) { d.speech = '가져올만한 것이 근처에 없는데스'; d.speechT = 2.6; }
      G.Assets.playSfx('click'); return true;
    }
    else if (dev && dev.type === 'reformer') { mode = 'hold'; }
    else if (raider) { mode = 'defend'; target = raider; kind = 'creature'; }
    else if (cg) { mode = 'retrieve'; target = cg; kind = 'cargo'; }
    else if (loose) { mode = 'retrieve'; target = loose; kind = 'creature'; }
    else return false;
    for (const d of workers) {
      d.laborMode = mode;
      const w = S.wanderers.find(x => x.data === d);
      if (!w) continue;
      w.goal = null; w.seekCd = 0; w.mineCd = 0;
      w.laborTgt = target || null;
      w.laborTgtKind = kind || null;
      sayLaborCommand(d);
    }
    if (workers.length === 1) laborTarget = workers[0];
    G.Assets.playSfx('click');
    return true;
  }

  // 벨트 경로 확장: 드래그 시작점에서 가로/세로 한 축으로만 직선 설치.
  function extendBeltPath(cur) {
    const start = beltPath[0];
    if (!start) return;
    const dc = cur.col - start.col, dr = cur.row - start.row;
    if (!beltDragAxis && (dc || dr)) beltDragAxis = Math.abs(dc) >= Math.abs(dr) ? 'h' : 'v';
    const end = beltDragAxis === 'v'
      ? { col: start.col, row: cur.row }
      : { col: cur.col, row: start.row };
    beltPath = [{ col: start.col, row: start.row }];
    let c = start.col, r = start.row;
    while ((c !== end.col || r !== end.row) && beltPath.length < 500) {
      if (beltDragAxis === 'v') r += Math.sign(end.row - r);
      else c += Math.sign(end.col - c);
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
    const starts = startLandKeys();
    ctx.save();
    for (let gy = gr0; gy <= gr1; gy++) for (let gx = gc0; gx <= gc1; gx++) {
      const x = gx * n * CELL, y = gy * n * CELL, key = gx + '|' + gy;
      const owned = !!S.ownedLand[key];
      const visibleInfo = owned || !!starts[key] || landConnected(key);
      const env = visibleInfo ? landEnvironment(key) : null;
      if (owned) {
        ctx.fillStyle = 'rgba(100,180,120,0.035)';
        ctx.fillRect(x, y, n * CELL, n * CELL);
      }
      ctx.strokeStyle = owned ? 'rgba(120,220,160,0.28)' : 'rgba(255,217,100,0.18)';
      ctx.lineWidth = (owned ? 2 : 1.5) / cam.zoom;
      ctx.strokeRect(x, y, n * CELL, n * CELL);
      if (env) {
        const colors = { 일반: '#b7bec8', 보통: '#9ddc8a', 희귀: '#78bfff', 전설: '#ff8e77' };
        const tx = x + 12 / cam.zoom, ty = y + 12 / cam.zoom;
        ctx.font = `bold ${13 / cam.zoom}px sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.strokeStyle = 'rgba(8,10,14,0.9)';
        ctx.fillStyle = colors[env.rarity] || '#dce6f5';
        const label = env.icon + ' ' + env.name;
        ctx.strokeText(label, tx, ty);
        ctx.fillText(label, tx, ty);
      }
    }
    ctx.restore();
  }
  function makeTilePattern(rec, currentPattern, currentImg) {
    if (!rec || !rec.ok || !rec.img.width) return { pattern: currentPattern, img: currentImg };
    if (!currentPattern || currentImg !== rec.img) {
      const oc = document.createElement('canvas'); oc.width = CELL; oc.height = CELL;
      oc.getContext('2d').drawImage(rec.img, 0, 0, CELL, CELL);
      return { pattern: ctx.createPattern(oc, 'repeat'), img: rec.img };
    }
    return { pattern: currentPattern, img: currentImg };
  }
  // 공장 바닥 타일. 바깥은 out_tile.png, 소유 영역은 tile.png.
  function drawFloorTiles(c0, r0, c1, r1) {
    const outRec = G.Assets.loadImage('assets/images/backgrounds/out_tile.png');
    const outP = makeTilePattern(outRec, outFloorPattern, outFloorPatternImg);
    outFloorPattern = outP.pattern; outFloorPatternImg = outP.img;
    if (outFloorPattern) {
      ctx.save();
      ctx.fillStyle = outFloorPattern;
      ctx.fillRect(c0 * CELL, r0 * CELL, (c1 - c0) * CELL, (r1 - r0) * CELL);
      ctx.restore();
    }
    const rec = G.Assets.bgImg('tile');
    if (!rec || !rec.ok || !rec.img.width) return;
    // 48x48로 정규화한 타일로 패턴 생성(캐시) — 소스 크기와 무관하게 한 칸=한 타일
    const p = makeTilePattern(rec, floorPattern, floorPatternImg);
    floorPattern = p.pattern; floorPatternImg = p.img;
    if (!floorPattern) return;
    ctx.save();
    ctx.fillStyle = floorPattern;
    // 소유 그리드(시작 필드 + 구매 토지)만 바닥을 깔아 소유 영역을 구분
    const N = C.LAND_GRID_SIZE || 48;
    const f = startFieldRect();
    const fillRegion = (a, b, c, d) => { // 셀 범위를 가시영역으로 클립 후 fillRect
      const A = Math.max(a, c0), B = Math.max(b, r0), Cc = Math.min(c, c1), D = Math.min(d, r1);
      if (Cc > A && D > B) ctx.fillRect(A * CELL, B * CELL, (Cc - A) * CELL, (D - B) * CELL);
    };
    fillRegion(f.c0, f.r0, f.c1, f.r1);                       // 시작 필드
    for (const key in S.ownedLand) {                          // 구매한 외부 그리드들
      if (!S.ownedLand[key]) continue;
      const p = key.split('|'), gc = +p[0] * N, gr = +p[1] * N;
      fillRegion(gc, gr, gc + N, gr + N);
    }
    ctx.restore();
  }
  // 셀 좌표 기반 결정론적 해시 → [0,1)
  function cellHash(c, r) {
    let h = (2166136261 ^ ((S.landSeed || 1) >>> 0)) >>> 0;
    h = Math.imul(h ^ (c & 0xffff), 16777619);
    h = Math.imul(h ^ (r & 0xffff), 16777619);
    h = Math.imul(h ^ ((c >>> 16) & 0xffff), 16777619);
    h = Math.imul(h ^ ((r >>> 16) & 0xffff), 16777619);
    return (h >>> 0) / 4294967296;
  }
  // 낮은 번호일수록 자주 나오도록 가중(o1=12 … o12=1, 합 78)
  function weightedObjIndex(h) {
    let t = h * 78;
    for (let i = 1; i <= 12; i++) { t -= (13 - i); if (t < 0) return i; }
    return 12;
  }
  const BG_OBJ_DENSITY = 0.05;   // 셀당 장식 오브젝트 등장 확률
  function drawBackgroundObjects(c0, r0, c1, r1) {
    const N = C.LAND_GRID_SIZE || 48;
    // 소유 그리드 + 인접(근처) 그리드만 장식 대상
    const keys = new Set();
    const owned = Object.assign({}, startLandKeys(), S.ownedLand || {});
    for (const k in owned) {
      if (!owned[k]) continue;
      const p = parseLandKey(k);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keys.add((p.gx + dx) + '|' + (p.gy + dy));
    }
    if (!keys.size) return;
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        if (!keys.has(Math.floor(c / N) + '|' + Math.floor(r / N))) continue;
        if (cellHash(c, r) >= BG_OBJ_DENSITY) continue;
        const idx = weightedObjIndex(cellHash(c + 9131, r + 1777));
        const rec = G.Assets.loadImage('assets/images/backgrounds/o' + idx + '.png');
        if (rec && rec.ok && rec.img.width) ctx.drawImage(rec.img, c * CELL, r * CELL, CELL, CELL);
      }
    }
  }
  function drawRuins(vx0, vy0, vx1, vy1) {
    const defs = C.RUIN_TYPES || {};
    const imgPrefix = { ruin: 'ruin', wreck: 'wreck', debris: 'debris', aquafarm: 'aquafarm' };
    ctx.save();
    for (const r of (S.ruins || [])) {
      if (r.col > vx1 || r.col + r.w < vx0 || r.row > vy1 || r.row + r.h < vy0) continue;
      const def = defs[r.type] || { name: r.type, color: '#777' };
      const x = r.col * CELL, y = r.row * CELL, w = r.w * CELL, h = r.h * CELL;
      if (!r.variant) r.variant = randInt(1, 3);
      if (r.flipX == null) r.flipX = Math.random() < 0.5;
      const prefix = imgPrefix[r.type] || r.type;
      const rec = G.Assets.loadImage('assets/images/devices/' + prefix + clamp(r.variant, 1, 3) + '.png');
      if (rec && rec.ok && rec.img.width) {
        if (r.flipX) {
          ctx.save();
          ctx.translate(x + w, y);
          ctx.scale(-1, 1);
          ctx.drawImage(rec.img, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(rec.img, x, y, w, h);
        }
      } else {
        ctx.fillStyle = def.color || '#777';
        ctx.globalAlpha = 0.72;
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(220,230,240,0.5)';
        ctx.lineWidth = 2 / cam.zoom;
        ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
        ctx.fillStyle = '#e6edf5';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(def.name || r.type, x + w / 2, y + h / 2 - 7);
      }
      ctx.fillStyle = 'rgba(20,24,28,0.74)';
      ctx.fillRect(x + 5, y + h - 19, w - 10, 14);
      ctx.fillStyle = '#e6edf5';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const resourceLabel = r.resourceType || '철';
      const maxLabel = r.resourceMax ? '/' + Math.floor(r.resourceMax).toLocaleString() : '';
      ctx.fillText(resourceLabel + ' ' + Math.floor(r.scrap || 0).toLocaleString() + maxLabel, x + w / 2, y + h - 12);
    }
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    overlayBadges.length = 0;
    overlayBubbles.length = 0;
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
    renderView = { x0: vx0, y0: vy0, x1: vx1, y1: vy1 };
    const c0 = Math.max(0, Math.floor(vx0)), c1 = Math.min(COLS, Math.ceil(vx1));
    const r0 = Math.max(0, Math.floor(vy0)), r1 = Math.min(ROWS, Math.ceil(vy1));

    // 공장 바닥 타일(tile.png): 칸(48px) 단위로 반복. 패턴 1회 fillRect로 고속 렌더.
    drawFloorTiles(c0, r0, c1, r1);
    // 바닥 위 배경 장식 오브젝트(o1~12) — 소유/인접 그리드에 결정론적으로 분포
    drawBackgroundObjects(c0, r0, c1, r1);

    // 집게 바닥(레일)은 바닥 타일 바로 위, 그 외 모든 그래픽보다 아래에 깔림
    const visBase = (b) => !(b.col > vx1 || b.col + b.w < vx0 || b.row > vy1 || b.row + b.h < vy0);
    for (const b of S.buildings) if (isGrabberType(b.type) && visBase(b)) drawWithConstruction(b, drawGrabberBase);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1 / cam.zoom;
    for (let c = c0; c <= c1; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, r0 * CELL); ctx.lineTo(c * CELL, r1 * CELL); ctx.stroke(); }
    for (let r = r0; r <= r1; r++) { ctx.beginPath(); ctx.moveTo(c0 * CELL, r * CELL); ctx.lineTo(c1 * CELL, r * CELL); ctx.stroke(); }
    drawLandGrid(vx0, vy0, vx1, vy1);
    drawGivenBorder();
    drawRuins(vx0, vy0, vx1, vy1);
    drawPowerSupplyOverlays();
    drawPowerLinkLines();

    const vis = (b) => !(b.col > vx1 || b.col + b.w < vx0 || b.row > vy1 || b.row + b.h < vy0);
    drawStains();
    for (const b of S.buildings) if ((b.type === 'belt' || b.type === 'guardbelt') && vis(b)) drawWithConstruction(b, drawBelt);
    for (const b of S.buildings) if (b.type !== 'belt' && b.type !== 'guardbelt' && !isGrabberType(b.type) && vis(b)) drawWithConstruction(b, drawDevice);
    // 바닥 위 개체(화물+배회): y 큰(아래) 쪽을 나중에 그림(입체감)
    const floor = [];
    for (const cg of S.cargo) if (cg.gx > vx0 - 1 && cg.gx < vx1 + 1 && cg.gy > vy0 - 1 && cg.gy < vy1 + 1) floor.push({ y: cg.gy, d: drawCargo, a: cg });
    for (const w of S.wanderers) if (w.gx > vx0 - 1 && w.gx < vx1 + 1 && w.gy > vy0 - 1 && w.gy < vy1 + 1) floor.push({ y: w.gy, d: drawWanderer, a: w });
    floor.sort((p, q) => p.y - q.y);
    for (const f of floor) f.d(f.a);
    for (const b of S.buildings) if (b.type === 'penbox' && vis(b)) drawWithConstruction(b, drawPenForeground);
    drawMortarShells();
    drawExplosionEffects();
    drawParticles();
    drawFloatTexts();
    drawWalls();
    drawDoors();
    for (const b of S.buildings) if (isGrabberType(b.type) && vis(b)) drawWithConstruction(b, drawGrabber);
    drawSelection();
    drawGhost();
    drawMoveGhost();
    drawSelectRect();
    drawPenEraseGhost();
    drawRaidWarning();
    drawPersistentPoleWires();
    drawTutorialGuide();
    drawCreatureOverlays();
    ctx.restore();
    drawRainOverlay();

    updateFilterPanel();
    updatePenPanel();
    updateBirthingPanel();
    updateTurretPanel();
    updateLaborPanel();
    updateWallPanel();
  }
  function drawWithConstruction(b, drawFn) {
    ctx.save();
    ctx.globalAlpha *= constructionAlpha(b);
    drawFn(b);
    ctx.restore();
    if (!isConstructing(b)) return;
    const cells = footprintCellsOf(b);
    const minC = Math.min(...cells.map(c => c.c)), maxC = Math.max(...cells.map(c => c.c));
    const minR = Math.min(...cells.map(c => c.r)), maxR = Math.max(...cells.map(c => c.r));
    const x = minC * CELL + 5, y = (maxR + 1) * CELL - 11, w = (maxC - minC + 1) * CELL - 10;
    const p = 1 - b.constructionLeft / Math.max(0.001, b.constructionTotal || 1);
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(x, y, w, 7);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * p), 5);
  }
  function drawRainOverlay() {
    if (!S.weather || !(S.weather.rainLeft > 0)) return;
    const t = performance.now() * 0.001;
    ctx.save();
    ctx.fillStyle = 'rgba(35,55,75,0.13)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(190,220,245,0.48)';
    ctx.lineWidth = 1.2;
    const count = 170;
    for (let i = 0; i < count; i++) {
      const x = ((i * 83 + t * 520) % (canvas.width + 140)) - 70;
      const y = ((i * 137 + t * 850) % (canvas.height + 100)) - 50;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9, y + 27); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTutorialGuide() {
    const guide = G.UI && G.UI.tutorialGuide ? G.UI.tutorialGuide() : null;
    if (!guide || S.screen !== 'factory') return;
    const pulse = 0.65 + Math.abs(Math.sin(performance.now() * 0.005)) * 0.35;
    ctx.save();
    ctx.strokeStyle = '#ffd84d';
    ctx.fillStyle = 'rgba(255,216,77,0.16)';
    ctx.lineWidth = 4 / cam.zoom;
    ctx.setLineDash([10 / cam.zoom, 7 / cam.zoom]);
    ctx.globalAlpha = pulse;
    const types = guide.buildings || [];
    for (const b of S.buildings) {
      if (!types.includes(b.type)) continue;
      ctx.fillRect(b.col * CELL, b.row * CELL, b.w * CELL, b.h * CELL);
      ctx.strokeRect(b.col * CELL + 2, b.row * CELL + 2, b.w * CELL - 4, b.h * CELL - 4);
    }
    if (guide.adjacentPen != null) {
      const pens = G.Pens.allPens();
      const pen = pens[guide.adjacentPen] || pens[0];
      if (pen) {
        const size = guide.size || { w: 1, h: 1 };
        const col = pen.col + pen.w + 1;
        const row = pen.row + Math.max(0, Math.floor((pen.h - size.h) / 2));
        ctx.fillRect(col * CELL, row * CELL, size.w * CELL, size.h * CELL);
        ctx.strokeRect(col * CELL + 2, row * CELL + 2, size.w * CELL - 4, size.h * CELL - 4);
      }
    }
    if (guide.betweenPens) {
      const pens = G.Pens.allPens();
      const a = pens[0], b = pens[1];
      if (a && b) {
        const ac = { x: a.col + a.w / 2, y: a.row + a.h / 2 };
        const bc = { x: b.col + b.w / 2, y: b.row + b.h / 2 };
        const horizontal = Math.abs(bc.x - ac.x) >= Math.abs(bc.y - ac.y);
        let col, row, w, h;
        if (horizontal) {
          w = 3; h = 1;
          col = Math.round((ac.x + bc.x) / 2 - w / 2);
          const overlap0 = Math.max(a.row, b.row), overlap1 = Math.min(a.row + a.h, b.row + b.h);
          row = overlap1 > overlap0 ? Math.floor((overlap0 + overlap1 - 1) / 2) : Math.round((ac.y + bc.y) / 2 - 0.5);
        } else {
          w = 1; h = 3;
          row = Math.round((ac.y + bc.y) / 2 - h / 2);
          const overlap0 = Math.max(a.col, b.col), overlap1 = Math.min(a.col + a.w, b.col + b.w);
          col = overlap1 > overlap0 ? Math.floor((overlap0 + overlap1 - 1) / 2) : Math.round((ac.x + bc.x) / 2 - 0.5);
        }
        ctx.fillRect(col * CELL, row * CELL, w * CELL, h * CELL);
        ctx.strokeRect(col * CELL + 2, row * CELL + 2, w * CELL - 4, h * CELL - 4);
      }
    }
    ctx.restore();
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
      ctx.rotate(b.type === 'chaosgate' && Number.isFinite(b.gateAngle) ? b.gateAngle : (b.dir - 1) * Math.PI / 2);
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
      ctx.save();
      ctx.translate(x + CELL / 2, y + CELL / 2);
      ctx.rotate((b.dir - 1) * Math.PI / 2);
      const ok = G.Assets.drawDeviceSprite(ctx, b.type, -CELL / 2 + 1, -CELL / 2 + 1, CELL - 2, CELL - 2, null);
      ctx.restore();
      if (!ok) {
        ctx.fillStyle = def.color;
        ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
      }
      if (b.type === 'chaosgate') return;
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
    if (b.type !== 'chaosgate') drawArrow(e.back.c * CELL + CELL / 2, e.back.r * CELL + CELL / 2, b.dir, '#cfe');
    if (b.queue && b.queue.length) {
      ctx.fillStyle = '#ffd964'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('●' + b.queue.length, e.front.c * CELL + CELL / 2, e.front.r * CELL + CELL - 4);
    }
    ctx.restore();
  }

  function drawDevice(b) {
    if (b.type === 'tunnel' || b.type === 'crossbelt' || b.type === 'chaosgate') { drawTransport(b); return; }
    const x = b.col * CELL, y = b.row * CELL, w = b.w * CELL, h = b.h * CELL;
    const def = G.DEVICES[b.type];
    const frameIdx = (def && (def.cat === 'processing' || b.type === 'packer' || b.type === 'feeder' || b.type === 'warehouse' || b.type === 'largewarehouse') && !isDeviceAnimating(b)) ? 0 : null;
    // 우리(penbox)는 9분할 울타리(아래 drawPen). 출산대는 장착 여부에 따라 birthing_ready/birthing.
    let drawn = false;
    if (b.type === 'penbox') drawn = true;
    else if (b.type === 'launchpad') {
      const file = b.rocketPhase === 'launch' ? 'rocket_0.png' : (endingState().stage >= 2 ? 'rocket_ready.png' : 'rocket_stay.png');
      const rec = G.Assets.loadImage('assets/images/devices/' + file);
      if (rec && rec.ok) { ctx.drawImage(rec.img, x + 1, y + 1, w - 2, h - 2); drawn = true; }
      if (b.rocketPhase === 'launch') {
        const rocket = G.Assets.loadImage('assets/images/devices/rocket_1.png');
        const lift = Math.min(h * 1.5, ((b.rocketLift || 0) + 0.2) * h);
        if (rocket && rocket.ok) ctx.drawImage(rocket.img, x + 1, y + 1 - lift, w - 2, h - 2);
        b.rocketLift = Math.min(2, (b.rocketLift || 0) + 0.012);
      }
    }
    else if (b.type === 'colony') {
      const tier = Math.max(0, Math.min(4, S.colonyTier || 0));
      const tierImg = G.Assets.loadImage('assets/images/devices/colony_tier' + tier + '.png');
      if (tierImg && tierImg.ok) { ctx.drawImage(tierImg.img, x + 1, y + 1, w - 2, h - 2); drawn = true; }
      if (!drawn) drawn = G.Assets.drawDeviceSprite(ctx, b.type, x + 1, y + 1, w - 2, h - 2, 0);
    }
    else if (def.monument) {
      const rec = G.Assets.loadImage('assets/images/devices/' + def.img);
      if (rec && rec.ok) {
        if (def.animated4) {
          const fw = rec.img.width / 4, frame = Math.floor(G.Assets.frame()) % 4;
          ctx.drawImage(rec.img, frame * fw, 0, fw, rec.img.height, x, y - CELL, CELL, CELL * 2);
        } else ctx.drawImage(rec.img, x, y - CELL, CELL, CELL * 2);
        drawn = true;
      }
    }
    else if (b.type === 'birthing') drawn = G.Assets.drawDeviceSpriteNamed(ctx, b.worker ? 'birthing.png' : 'birthing_ready.png', x + 1, y + 1, w - 2, h - 2);
    else if (b.type === 'correction') {
      drawn = b.teacher
        ? G.Assets.drawDeviceSpriteNamed(ctx, 'correction_teacher.png', x + 1, y + 1, w - 2, h - 2, frameIdx)
        : G.Assets.drawDeviceSprite(ctx, b.type, x + 1, y + 1, w - 2, h - 2, frameIdx);
    }
    else if (b.type === 'reformer') drawn = G.Assets.drawDeviceSpriteNamed(ctx, b.item ? 'reformer.png' : 'reformer_ready.png', x + 1, y + 1, w - 2, h - 2);
    else if (b.type === 'acidgen') drawn = G.Assets.drawDeviceSpriteNamed(ctx, (b.item && b.powered) ? 'acidgen.png' : 'acidgen_ready.png', x + 1, y + 1, w - 2, h - 2, frameIdx);
    else if (b.type === 'jisoucharge') drawn = G.Assets.drawDeviceSpriteNamed(ctx, b.worker ? 'jisoucharge.png' : 'jisoucharge_ready.png', x + 1, y + 1, w - 2, h - 2, frameIdx);
    else if (b.type === 'firecharge') drawn = G.Assets.drawDeviceSpriteNamed(ctx, (b.fuelT || 0) > 0 ? 'firecharge.png' : 'firecharge_ready.png', x + 1, y + 1, w - 2, h - 2, frameIdx);
    else if (b.type === 'chaoscharge') drawn = drawChaosChargeDevice(b, x, y, w, h, frameIdx);
    else if (b.type === 'techica') drawn = drawTechicaDevice(b, x, y);
    else if (b.type === 'wrongchaosmargot') {
      const rec = G.Assets.loadImage('assets/images/devices/wrong_chaosmargot.png');
      if (rec && rec.ok && rec.img.width) {
        const fw = rec.img.width / 4;
        const frame = clamp((b.mood || 1) - 1, 0, 3);
        ctx.save();
        if (b.gachaRemaining > 0) {
          ctx.shadowColor = '#fff4a6';
          ctx.shadowBlur = 14 + Math.sin(performance.now() / 90) * 5;
        }
        ctx.drawImage(rec.img, frame * fw, 0, fw, rec.img.height, x + 1, y + 1, w - 2, h - 2);
        ctx.restore();
        drawn = true;
      }
    }
    else if (b.type === 'terrarium') {
      const rec = G.Assets.loadImage('assets/images/devices/terrarium.png');
      if (rec && rec.ok && rec.img.width) {
        const fw = rec.img.width / 4;
        const frame = b.dnaStats ? (Math.floor(G.Assets.frame() / 2) % 4) : 0;
        const fish = G.Assets.loadImage('assets/images/devices/terrarium_margot.png');
        if (fish && fish.ok && fish.img.width) {
          const angle = -performance.now() / 1800;
          const cx = x + w / 2, cy = y + h / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.drawImage(fish.img, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
        // 내부 생물 레이어를 먼저 그린 뒤 어항 본체가 위에서 덮는다.
        ctx.drawImage(rec.img, frame * fw, 0, fw, rec.img.height, x + 1, y + 1, w - 2, h - 2);
        drawn = true;
      }
    }
    else if (POWER_POLES.has(b.type)) drawn = drawPowerPoleDevice(b, x, y);
    else if (b.type === 'lab') drawn = G.Assets.drawDeviceSpriteNamed(ctx, (b.state === 'producing') ? 'lab_start.png' : 'lab_ready.png', x + 1, y + 1, w - 2, h - 2);
    else if (b.type === 'driller') {
      const rec = G.Assets.loadImage('assets/images/devices/driller.png');
      if (rec && rec.ok) { ctx.drawImage(rec.img, x + 1, y + 1, w - 2, h - 2); drawn = true; }
    }
    else if (b.type === 'pointer' || b.type === 'sorter' || b.type === 'washbasin' || b.type === 'deshell') drawn = drawRotatedDeviceSprite(b, x, y, w, h, frameIdx);
    else if (b.type === 'skewer') drawn = drawSkewerDevice(b, x, y);
    else if (isTurretLike(b)) drawn = drawTurretDevice(b, x, y);
    else drawn = G.Assets.drawDeviceSprite(ctx, b.type, x + 1, y + 1, w - 2, h - 2, frameIdx);
    if (!drawn) {
      ctx.fillStyle = def.color; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = Math.max(9, Math.floor((h - 2) * 0.18)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.name + (b.type === 'birthing' && !b.worker ? '(빈)' : ''), x + w / 2, y + h / 2);
    }
    if (b.type === 'driller' && S.selection.includes(b.id)) drawRangeOverlay(effRangeRect(b), '#ffd24a', 0.10);
    if (dropHoverId === b.id) { ctx.strokeStyle = '#7fe'; ctx.lineWidth = 3; ctx.strokeRect(x + 2, y + 2, w - 4, h - 4); }
    if (b.type === 'colony' && S.colonyUpgrade) {
      drawProgressBar(x, y + h - 6, w, 1 - S.colonyUpgrade.remain / S.colonyUpgrade.total, 'life');
    }
    if (b.type === 'launchpad') {
      const e = endingState();
      ctx.fillStyle = '#ffd964'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      if (e.stage >= 2) ctx.fillText(Math.floor(e.charge || 0).toLocaleString() + '/' + endingNeed().charge.toLocaleString() + ' · 철 ' + Math.floor(e.scrap || 0).toLocaleString(), x + w / 2, y + h - 8);
      else ctx.fillText('철 ' + Math.floor(e.scrap || 0).toLocaleString() + ' · 상품 ' + Math.floor(e.products || 0).toLocaleString() + ' · 농축 ' + Math.floor(e.concentrate || 0).toLocaleString() + ' · 전자 ' + Math.floor(e.electronics || 0).toLocaleString(), x + w / 2, y + h - 8);
    }

    if (b.type === 'washbasin') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.washTimer / (C.WASH_TIME / workerMult(b)), b.state); drawWorkerSlots(b, x, y, w);
    } else if (b.type === 'birthing') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.birthTimer / C.BIRTH_INTERVAL, b.state);
      if (b.worker) drawProgressBar(x, y + h - 12, w, 1 - b.lifeTimer / C.BIRTH_LIFESPAN, 'life');
      if (deviceCargoCount(b)) drawBufferLabel(b, x, y, w, h);
    } else if (b.type === 'slaughter') {
      drawProgressBar(x, y + h - 6, w, b.item ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      drawItem(b, x, y); drawWorkerSlots(b, x, y, w);
      drawBufferLabel(b, x, y, w, h);
    } else if (b.type === 'deshell') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.item ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      drawItem(b, x, y); drawWorkerSlots(b, x, y, w);
    } else if (b.type === 'correction') {
      markEdge(sideCell(b, b.dir), '사육출', '#9f9'); markEdge(sideCell(b, (b.dir + 2) % 4), '육출', '#f99');
      drawCorrection(b, x, y, w, h);
    } else if (b.type === 'lab') {
      drawLabSlots(b, x, y, w, h);
    } else if (b.type === 'grinder') {
      drawProgressBar(x, y + h - 6, w, (b.weight || 0) / C.GRIND_TARGET, 'life');
      drawItem(b, x, y);
      ctx.fillStyle = '#dfd'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('무게 ' + Math.floor(b.weight || 0), x + w / 2, y + h - 14);
      drawBufferLabel(b, x, y, w, h);
    } else if (b.type === 'mixer') {
      const need = C.MIX_FOOD_NEED || 50;
      const ready = b.menu && mixMenuReady(b, b.menu);
      drawProgressBar(x, y + h - 6, w, ready ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      const menuName = (b.menu && def.mix && def.mix[b.menu]) ? def.mix[b.menu].out : '메뉴 미선택';
      ctx.fillStyle = b.menu ? '#ffe9b0' : '#ff9a8a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(menuName, x + w / 2, y + h / 2 - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '8px sans-serif';
      ctx.fillText('분쇄육' + (b.slotMeat ? '✓' : '·') + ' 운치' + (b.unchiN || 0) + '/' + C.MIX_UNCHI, x + w / 2, y + h / 2 + 1);
      ctx.fillText('짓소산' + (b.slotAcid ? '✓' : '·') + ' 푸드' + (b.foodN || 0) + '/' + need + ' 조' + (b.slotSeasoning ? '✓' : '·') + ' 철' + (b.slotScrap ? '✓' : '·'), x + w / 2, y + h / 2 + 11);
      drawWorkerSlots(b, x, y, w);
      drawBufferLabel(b, x, y, w, h);
    } else if (b.type === 'packer') {
      drawProgressBar(x, y + h - 6, w, b.state === 'producing' ? (b.timer || 0) / (def.time || 1.5) : 0, b.state);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('철' + (b.scrapN || 0) + ' 분' + ((b.minced && b.minced.length) || 0) + ' 육' + ((b.meat && b.meat.length) || 0), x + w / 2, y + h / 2);
      drawBufferLabel(b, x, y, w, h);
    } else if (b.type === 'salecenter') {
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💰 물류센터', x + w / 2, y + h / 2);
      if (b.up) { ctx.font = '10px sans-serif'; ctx.fillText('+' + (b.up * 10) + '%', x + w / 2, y + h / 2 + 14); }
    } else if (b.type === 'cookery') {
      drawProgressBar(x, y + h - 6, w, b.cooking ? b.timer / (def.time / workerMult(b)) : 0, b.state);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      // 비축된 재료 종류 표시
      let li = 0;
      for (const t in (b.mats || {})) { const have = b.mats[t] || 0; if (have > 0 && li < 4) { ctx.fillText(t + ' ' + have, x + 4, y + 11 + li * 10); li++; } }
      ctx.textAlign = 'center';
      const menuName = (b.menu && def.cook[b.menu]) ? def.cook[b.menu].out : '메뉴 미선택';
      ctx.fillStyle = b.menu ? '#ffe9b0' : '#ff9a8a'; ctx.font = 'bold 10px sans-serif';
      ctx.fillText('▶ ' + menuName, x + w / 2, y + h / 2 - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '9px sans-serif';
      ctx.fillText('🧂' + Math.floor(b.seasoning || 0) + '/' + (C.SEASONING_MAX || 200), x + w / 2, y + h / 2 + 11);
      drawWorkerSlots(b, x, y, w);
      drawBufferLabel(b, x, y, w, h);
    } else if (b.type === 'acidgen') {
      drawProgressBar(x, y + h - 6, w, b.item ? b.timer / def.time : 0, b.state);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(powerBlocked(b) ? '전력 공급 필요' : (b.item ? '짓소산 생성중' : '성체실장 필요'), x + w / 2, y + h - 14);
      drawBufferLabel(b, x, y, w, h);
    } else if (POWER_PLANTS.has(b.type)) {
      const ratio = b.type === 'jisoucharge'
        ? (b.worker ? ((b.worker.hp || 0) / Math.max(1, G.Creatures.hpMaxOf(b.worker))) : 0)
        : (b.type === 'chaoscharge'
          ? (b.chaosStarted ? ((b.fuelT || 0) / Math.max(1, b.fuelMax || 1)) : Math.min(1, ((b.chaosVictims && b.chaosVictims.length) || 0) / 12))
          : ((b.fuelT || 0) / Math.max(1, b.fuelMax || 1)));
      drawProgressBar(x, y + h - 6, w, ratio, b.state);
      if (b.type !== 'chaoscharge') drawItem(Object.assign({}, b, { item: b.type === 'jisoucharge' ? b.worker : b.fuel, creatureDirRow: b.type === 'jisoucharge' ? 1 : 0 }), x, y);
      drawBufferLabel(b, x, y, w, h);
    } else if (POWER_POLES.has(b.type)) {
    } else if (b.type === 'reformer') {
      markEdge(outputCell(b), '출', '#fc5');
      drawProgressBar(x, y + h - 6, w, b.item ? (b.timer || 0) / (C.LABOR_REFORM_TIME || 6) : 0, b.state);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(b.item ? '교화 중…' : '독라 대기', x + w / 2, y + h - 12);
    } else if (b.type === 'penbox') {
      drawPen(b, x, y, w, h);
    } else if (b.type === 'driller') {
      drawBufferLabel(b, x, y, w, h);
      const head = G.Assets.loadImage('assets/images/devices/drillhead.png');
      if (head && head.ok) {
        const hx = (Number.isFinite(b.drillHeadX) ? b.drillHeadX : b.col + b.w / 2) * CELL;
        const hy = (Number.isFinite(b.drillHeadY) ? b.drillHeadY : b.row + b.h / 2) * CELL;
        const pulse = b.state === 'producing' ? Math.sin(G.Assets.frame() * 16) * 3 : 0;
        ctx.drawImage(head.img, hx - CELL / 2, hy - CELL * 2 + pulse, CELL, CELL * 2);
      }
    } else if (b.type === 'warehouse' || b.type === 'largewarehouse') {
      ctx.fillStyle = 'rgba(3, 3, 3, 0.6)'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.type === 'largewarehouse' ? '대형 비축고' : '창고', x + w / 2, y + h / 2);
      ctx.font = '9px sans-serif';
      if (b.type === 'largewarehouse') {
        const out = b.filter && b.filter[0];
        ctx.fillText(out ? '한 면 출력: ' + (FILTER_LABEL[out] || out) : '출력 필터 미선택', x + w / 2, y + h / 2 + 14);
        if (out) largeWarehouseOutputCells(b).forEach(cell => markEdge(cell, '출', '#fc5'));
      } else ctx.fillText('거래창서 판매', x + w / 2, y + h / 2 + 14);
    } else if (b.type === 'colony') {
      // 미수락 퀘스트가 있으면 중앙에 깜빡이는 느낌표
      if ((S.quests || []).some(q => !q.accepted) || (S.ending && S.ending.offered && !S.ending.accepted)) {
        const cx = x + w / 2, cy = y + h / 2, a = 0.55 + 0.45 * Math.abs(Math.sin(G.Assets.frame() * 1.5));
        ctx.save(); ctx.globalAlpha = a;
        ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 4;
        ctx.strokeText('❗', cx, cy - 6); ctx.fillText('❗', cx, cy - 6);
        ctx.restore();
      }
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
      if (S.selection.includes(b.id)) drawRangeOverlay(effRangeRect(b), '#ffd24a', 0.10); // 선택 시 영향 범위
      if (def.special === 'turret') {
        if (S.selection.includes(b.id)) drawTurretRange(b.col + b.w / 2, b.row + b.h / 2, turretRange(b));
        if (isMortar(b) && b.manualTarget && S.selection.includes(b.id)) {
          const tx = b.manualTarget.gx * CELL, ty = b.manualTarget.gy * CELL;
          ctx.save();
          ctx.strokeStyle = '#ff756b'; ctx.fillStyle = 'rgba(255,80,70,0.12)'; ctx.lineWidth = 2;
          ctx.setLineDash([7, 5]);
          ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx - 18, ty); ctx.lineTo(tx + 18, ty); ctx.moveTo(tx, ty - 18); ctx.lineTo(tx, ty + 18); ctx.stroke();
          ctx.restore();
        }
        if (b.shotT > 0 && b.shotX != null) {   // 사격 트레이서 + 총구 화염
          ctx.save();
          ctx.strokeStyle = isChaosTurret(b) ? '#c477ff' : '#ffe08a'; ctx.lineWidth = isChaosTurret(b) ? 3 : 2; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2);
          if (isChaosTurret(b) && b.chainShot && b.chainShot.length) b.chainShot.forEach(p => ctx.lineTo(p.x * CELL, p.y * CELL));
          else ctx.lineTo(b.shotX * CELL, b.shotY * CELL);
          ctx.stroke();
          ctx.fillStyle = '#fff3b0';
          ctx.beginPath(); ctx.arc(x + w / 2 + Math.cos(b.aim || 0) * 16, y + h / 2 + Math.sin(b.aim || 0) * 16, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
      if (def.special === 'catch') { markEdge(outputCell(b), '출', '#fc5'); drawCatcherArm(b); }
      if (def.special === 'feed') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x + 4, y + h - 17, w - 8, 13);
        ctx.fillStyle = b.noFeed ? '#ff6b5a' : '#f5ffd9'; ctx.font = b.noFeed ? 'bold 9px sans-serif' : '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(FEED_LABEL[b.feedType || '실장푸드'] || '실장푸드', x + w / 2, y + h - 10);
      }
      if (def.special === 'skewer') {
        drawSkewerDevice(b, x, y);
      }
      if (def.special === 'skewer' && b.held && !skewerLoadedSpriteExists()) {
        const cd = G.CREATURES[b.held.type];
        if (!G.Assets.drawCreatureNative(ctx, b.held.type, x + w / 2, y + h / 2, 0)) { ctx.fillStyle = cd ? cd.color : '#fff'; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✚', x + w / 2, y + 4);
      }
    }
    drawDevicePowerBadge(b, x, y, w);
    // 짓소산 생성기 대사는 중심 최상단 기준 아래로 70px 지점에 출력
    if (b.speechT > 0 && b.speech) {
      const txt = (S.linggal === false && b.speechTone) ? b.speechTone : b.speech;   // 링갈 OFF면 데스데스/테치테치
      drawBubble(x + w / 2, b.type === 'acidgen' ? (y + 70) : (b.type === 'techica' ? (y - 42) : (y - 2)), txt);
    }
  }
  function isDeviceAnimating(b) {
    if (b.state === 'producing') return true;
    if (b.type === 'salecenter') return (b.packT || 0) > 0;
    if (b.type === 'packer') return !!((b.minced && b.minced.length || b.meat && b.meat.length) && (b.scrapN || 0) >= 1);
    if (b.type === 'reformer') return !!b.item;
    if (b.type === 'washbasin') return !!b.item;
    if (b.type === 'grinder') return !!b.item;
    if (b.type === 'mixer') return !!((b.slotMeat && (b.unchiN || 0) >= C.MIX_UNCHI) || (b.slotAcid && (b.foodN || 0) >= (C.MIX_FOOD_NEED || 50)));
    if (b.type === 'cookery') return !!b.cooking;
    if (b.type === 'acidgen') return !!b.item;
    if (b.type === 'feeder') return !b.noFeed;
    if (b.type === 'correction') return !!(b.inmates && b.inmates.length);
    if (b.type === 'slaughter' || b.type === 'deshell') return !!b.item;
    return false;
  }
  function drawRotatedDeviceSprite(b, x, y, w, h, frameIdx) {
    const def = G.DEVICES[b.type];
    const baseW = ((def && def.w) || b.w || 1) * CELL;
    const baseH = ((def && def.h) || b.h || 1) * CELL;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (b.dir === 3) ctx.scale(-1, 1);       // 반대 방향은 회전이 아니라 좌우 대칭
    else if (b.dir !== 1) ctx.rotate((b.dir - 1) * Math.PI / 2); // 위/아래만 회전. 기본 스프라이트 방향: →
    const ok = G.Assets.drawDeviceSprite(ctx, b.type, -baseW / 2 + 1, -baseH / 2 + 1, baseW - 2, baseH - 2, frameIdx);
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
  // 매지컬 테치카: 1칸 점유, 그래픽은 48×96(꼬챙이처럼 바닥 기준). techica.png = 8프레임 가로 시트.
  // 같은 동작 반복 대신 b.techFrame(랜덤 선택)로 출력.
  function drawTechicaDevice(b, x, y) {
    const dw = 48, dh = 96;
    const dx = x, dy = y + CELL - dh;
    // 가동 중: techica.png 8프레임 시트에서 랜덤 프레임. 대기: techica_ready.png 전체.
    const ok = b.worker
      ? G.Assets.drawDeviceSheetFrame(ctx, 'techica.png', dx, dy, dw, dh, b.techFrame || 0, 8)
      : drawDeviceImageFile('techica_ready.png', dx, dy, dw, dh);
    if (ok) return true;
    ctx.save();
    ctx.fillStyle = G.DEVICES.techica.color;
    ctx.fillRect(dx + 4, dy + dh / 2, dw - 8, dh / 2 - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('테치카', x + CELL / 2, y + CELL / 2);
    ctx.restore();
    return true;
  }
  function drawChaosChargeDevice(b, x, y, w, h, frameIdx) {
    const active = isPowerPlantActive(b);
    const ok = G.Assets.drawDeviceSpriteNamed(ctx, active ? 'chaoscharge.png' : 'chaoscharge_ready.png', x + 1, y + 1, w - 2, h - 2, frameIdx);
    if (!ok) {
      const def = G.DEVICES.chaoscharge;
      ctx.fillStyle = def.color; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
    drawChaosVictims(b, x, y, w, h);
    return true;
  }
  function drawChaosVictims(b, x, y, w, h) {
    const n = Math.min(12, (b.chaosVictims && b.chaosVictims.length) || 0);
    if (!n) return;
    const rec = G.Assets.loadImage('assets/images/creatures/chaos_victim.png');
    const cx = x + w / 2, cy = y + h / 2;
    const radius = Math.max(16, Math.min(w, h) * 0.34);
    const active = isPowerPlantActive(b);
    const rot = active ? (performance.now() * 0.00028) : 0;
    for (let i = 0; i < n; i++) {
      const a = rot - Math.PI / 2 + i * (Math.PI * 2 / 12);
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + Math.PI / 2);
      if (rec && rec.ok && rec.img.width) {
        const sheet = rec.img.width === rec.img.height && rec.img.width % 4 === 0;
        const cols = sheet ? 4 : 1, rows = sheet ? 4 : 1;
        const cw = rec.img.width / cols, ch = rec.img.height / rows;
        const fi = cols > 1 ? G.Assets.frame() % cols : 0;
        const scale = sheet ? Math.min(0.78, Math.max(0.55, Math.min(w, h) / 256)) : Math.min(0.25, Math.min(w, h) / rec.img.width);
        const dw = cw * scale, dh = ch * scale;
        ctx.drawImage(rec.img, fi * cw, 0, cw, ch, Math.round(-dw / 2), Math.round(-dh / 2), dw, dh);
      } else {
        ctx.fillStyle = '#b7ff78';
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  function drawPowerPoleDevice(b, x, y) {
    const dw = 48, dh = 96;
    const dx = x, dy = y + CELL - dh;
    if (drawDeviceImageFile((G.DEVICES[b.type] && G.DEVICES[b.type].img) || (b.type + '.png'), dx, dy, dw, dh)) return true;
    ctx.save();
    const def = G.DEVICES[b.type] || { color: '#6ee7d8', name: '전봇대' };
    ctx.fillStyle = def.color;
    ctx.fillRect(dx + 18, dy + 14, 12, dh - 18);
    ctx.strokeStyle = 'rgba(20,30,35,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(dx + 7, dy + 24);
    ctx.lineTo(dx + dw - 7, dy + 24);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name.replace(' 전봇대', ''), x + CELL / 2, y + CELL / 2);
    ctx.restore();
    return true;
  }
  function drawDeviceImageFile(fileName, x, y, w, h) {
    const rec = G.Assets.loadImage('assets/images/devices/' + fileName);
    if (!rec || !rec.ok || !rec.img.width) return false;
    ctx.drawImage(rec.img, x, y, w, h);
    return true;
  }
  function drawTurretDevice(b, x, y) {
    const dw = (b.w || 1) * CELL, dh = (b.h || 1) * CELL;
    const cx = x + dw / 2, cy = y + dh / 2;
    const sniper = isSniper(b);
    const mortar = isMortar(b);
    const chaos = isChaosTurret(b);
    // 하부 받침(turret_tile.png) — 회전하지 않음
    const tileOk = chaos
      ? G.Assets.drawDeviceSprite(ctx, b.type, x, y, dw, dh, null)
      : drawDeviceImageFile('turret_tile.png', x, y, dw, dh);
    if (!tileOk) {
      ctx.fillStyle = chaos ? '#5d327d' : (mortar ? '#45484f' : (sniper ? '#2e3850' : '#3a3f4a')); ctx.fillRect(x + 5, y + 5, dw - 10, dh - 10);
      ctx.strokeStyle = '#1e222a'; ctx.lineWidth = 2; ctx.strokeRect(x + 5.5, y + 5.5, dw - 11, dh - 11);
    }
    if (chaos) return true;
    // 상부 포신 — 조준 방향으로 회전. 기본 그래픽 방향은 →(오른쪽)
    const a = b.aim != null ? b.aim : -Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    // 자동포탑/저격터렛: 설치는 1×1이지만 포신 이미지는 96×48, 회전 중심축은 좌상단 기준 (24,24).
    // 회전 원점(=셀 중심, 48px 셀의 24,24)에 이미지의 (24,24) 피벗이 맞도록 (-24,-24)에 96×48로 그린다.
    const BW = 96, BH = 48, PX = 24, PY = 24;
    const turretOk = mortar
      ? (drawDeviceImageFile('canon.png', -dw / 2, -dh / 2, dw, dh) || drawDeviceImageFile('canon.PNG', -dw / 2, -dh / 2, dw, dh))
      : (sniper
        ? (drawDeviceImageFile('sniper.png', -PX, -PY, BW, BH) || drawDeviceImageFile('sniper.PNG', -PX, -PY, BW, BH))
        : (drawDeviceImageFile('turret.png', -PX, -PY, BW, BH) || drawDeviceImageFile('turret.PNG', -PX, -PY, BW, BH)));
    if (!turretOk) {
      ctx.fillStyle = G.DEVICES[b.type] ? G.DEVICES[b.type].color : G.DEVICES.turret.color;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1e222a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = mortar ? '#d7d0bd' : (sniper ? '#b9c6e0' : '#d9dde6'); ctx.lineWidth = mortar ? 7 : (sniper ? 4 : 5); ctx.lineCap = 'round';
      const barrel = mortar ? 14 : (sniper ? 26 : 18);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(barrel, 0); ctx.stroke();
      if (b.shotT > 0) { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(barrel + 2, 0, 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#aeb6c4'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (turretOk && b.shotT > 0) {
      // 포신 끝(머즐): 96×48 포탑/저격은 우측 끝(-24+96), 박격포는 기존 셀 기준.
      const muzzleX = mortar ? (CELL / 2 - 5) : (BW - PX - 6);
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(muzzleX, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return true;
  }
  // 포탑 사거리(원형, 선택/고스트 시 표시)
  function drawTurretRange(gx, gy, range) {
    ctx.save();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(gx * CELL, gy * CELL, range * CELL, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.07; ctx.fillStyle = '#ffd24a'; ctx.fill();
    ctx.restore();
  }
  function drawRangeOverlay(r, color, alpha) {
    if (!r) return;
    const x = r.x0 * CELL, y = r.y0 * CELL, w = (r.x1 - r.x0) * CELL, h = (r.y1 - r.y0) * CELL;
    ctx.save();
    ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.setLineDash([]);
    ctx.restore();
  }
  function drawPowerSupplyOverlays() {
    if (moveMode) return;
    const selected = new Set(S.selection || []);
    for (const b of S.buildings) {
      if (!POWER_PLANTS.has(b.type) && !POWER_POLES.has(b.type)) continue;
      if (!selected.has(b.id)) continue;
      const r = powerSupplyRectFor(b.type, b.col, b.row, b.w, b.h);
      drawRangeOverlay(r, b.powered ? '#6ee7d8' : '#7aa0b8', b.powered ? 0.10 : 0.055);
    }
  }
  function drawPowerLine(a, b, alpha, color) {
    const ax = (a.col + a.w / 2) * CELL, ay = (a.row + a.h / 2) * CELL;
    const bx = (b.col + b.w / 2) * CELL, by = (b.row + b.h / 2) * CELL;
    ctx.save();
    ctx.strokeStyle = color || '#6ee7d8';
    ctx.globalAlpha = alpha == null ? 0.45 : alpha;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  let poleWireCacheSig = '';
  let poleWireCache = [];
  function drawPersistentPoleWires() {
    const poles = S.buildings.filter(b => POWER_POLES.has(b.type) && b.powered);
    const sig = poles.map(p => p.id + ':' + p.type + ':' + p.col + ':' + p.row).sort().join('|');
    if (sig !== poleWireCacheSig) {
      poleWireCacheSig = sig;
      const candidates = [];
      for (let i = 0; i < poles.length; i++) {
        for (let j = i + 1; j < poles.length; j++) {
          const a = poles[i], b = poles[j];
          if (!powerLinkReach(a, b) && !powerLinkReach(b, a)) continue;
          const ax = (a.col + a.w / 2) * CELL, ay = a.row * CELL;
          const bx = (b.col + b.w / 2) * CELL, by = b.row * CELL;
          candidates.push({ a, b, ax, ay, bx, by, d: Math.hypot(bx - ax, by - ay) });
        }
      }
      candidates.sort((a, b) => a.d - b.d);
      const degree = new Map();
      poleWireCache = [];
      for (const edge of candidates) {
        const ad = degree.get(edge.a.id) || 0, bd = degree.get(edge.b.id) || 0;
        if (ad >= 3 || bd >= 3) continue;
        degree.set(edge.a.id, ad + 1);
        degree.set(edge.b.id, bd + 1);
        poleWireCache.push(edge);
      }
    }
    ctx.save();
    ctx.strokeStyle = '#a9c7c8';
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1.5;
    for (const edge of poleWireCache) {
      const sag = Math.min(CELL * 0.35, edge.d * 0.06);
      ctx.beginPath();
      ctx.moveTo(edge.ax, edge.ay);
      ctx.quadraticCurveTo((edge.ax + edge.bx) / 2, (edge.ay + edge.by) / 2 + sag, edge.bx, edge.by);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawPowerLinkLines() {
    if (moveMode) return;
    const selected = new Set(S.selection || []);
    const hasSelectedPower = S.buildings.some(b => selected.has(b.id) && (POWER_PLANTS.has(b.type) || POWER_POLES.has(b.type)));
    if (!hasSelectedPower) return;
    const sources = S.buildings.filter(b => POWER_PLANTS.has(b.type) && isPowerPlantActive(b));
    const poles = S.buildings.filter(b => POWER_POLES.has(b.type) && b.powered);
    for (const p of poles) {
      for (const s of sources) if (powerLinkReach(p, s) && (selected.has(p.id) || selected.has(s.id))) drawPowerLine(p, s, 0.30, '#ffd964');
    }
    for (let i = 0; i < poles.length; i++) {
      for (let j = i + 1; j < poles.length; j++) {
        if (!(selected.has(poles[i].id) || selected.has(poles[j].id))) continue;
        if (powerLinkReach(poles[i], poles[j]) || powerLinkReach(poles[j], poles[i])) drawPowerLine(poles[i], poles[j], 0.34, '#6ee7d8');
      }
    }
  }
  function drawGhostPowerLinks(ghost, exclude, showLinkedRanges) {
    const skip = exclude || new Set();
    const nodes = S.buildings.filter(b => !skip.has(b.id) && ((POWER_POLES.has(b.type) && b.powered) || (POWER_PLANTS.has(b.type) && isPowerPlantActive(b))));
    for (const n of nodes) {
      if (!powerLinkReach(ghost, n)) continue;
      if (showLinkedRanges) drawRangeOverlay(powerSupplyRectFor(n.type, n.col, n.row, n.w, n.h), POWER_POLES.has(n.type) ? '#6ee7d8' : '#ffd964', 0.075);
      drawPowerLine(ghost, n, 0.34, POWER_POLES.has(n.type) ? '#6ee7d8' : '#ffd964');
    }
  }
  function drawGhostPowerConsumers(ghost, exclude) {
    const skip = exclude || new Set();
    const poles = S.buildings.filter(b => !skip.has(b.id) && POWER_POLES.has(b.type));
    for (const p of poles) {
      if (!powerLinkReach(p, ghost)) continue;
      drawRangeOverlay(powerSupplyRectFor(p.type, p.col, p.row, p.w, p.h), p.powered ? '#6ee7d8' : '#7aa0b8', 0.075);
      drawPowerLine(ghost, p, 0.30, p.powered ? '#6ee7d8' : '#7aa0b8');
    }
  }
  // 말풍선 (장치/실장석 공용) — 일단 큐에 모은 뒤 렌더 마지막에 표시
  function drawBubble(cx, topY, text) {
    if (!text) return;
    overlayBubbles.push({ cx, topY, text });
  }
  function drawBubbleNow(cx, topY, text) {
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const padX = 5, tw = ctx.measureText(text).width, bw = tw + padX * 2, bh = 16;
    const bx = cx - bw / 2, by = topY - bh - 4;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); }
    else ctx.fillRect(bx, by, bw, bh);
    ctx.beginPath(); ctx.moveTo(cx - 4, by + bh); ctx.lineTo(cx + 4, by + bh); ctx.lineTo(cx, by + bh + 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillText(text, cx, by + bh / 2);
  }
  function queueCreatureBubble(cx, topY, data, text) {
    const line = text || linggalText(data);
    if (!line) return;
    overlayBubbles.push({ cx, topY, text: line });
  }
  function queueCreatureBadge(cx, cy, data) {
    if (!data || !data.stats) return;
    overlayBadges.push({ cx, cy, data });
  }
  function drawCreatureOverlays() {
    for (const b of overlayBadges) drawCreatureBadgeNow(b.cx, b.cy, b.data);
    for (const b of overlayBubbles) drawBubbleNow(b.cx, b.topY, b.text);
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
    drawMachineCreatureCentered(b.worker, b);
  }
  function drawMachineCreatureCentered(data, b) {
    if (!data || !G.CREATURES[data.type]) return null;
    const cx = (b.col + b.w / 2) * CELL;
    const cy = (b.row + b.h / 2) * CELL;
    const dir = b.creatureDirRow == null ? 0 : b.creatureDirRow;
    const rec = G.Assets.creatureImg(data.type);
    const scale = (C.DISPLAY_SCALE && C.DISPLAY_SCALE[data.type]) || 1;
    let top = cy - 12;
    let drawn = false;
    if (rec && rec.ok && rec.img.width) {
      const ch = rec.img.height / 4;
      top = cy - (ch * scale) / 2;
      drawn = G.Assets.drawCreatureNative(ctx, data.type, cx, cy, dir);
    }
    if (!drawn) {
      const d = G.CREATURES[data.type];
      ctx.fillStyle = d ? d.color : '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    }
    if (data.speechT > 0 && data.speech) queueCreatureBubble(cx, top - 2, data);
    return { drawn, cx, cy, top };
  }
  function drawItem(b, x, y) {
    if (!b.item) return;
    const cx = (b.col + b.w / 2) * CELL, cy = (b.row + b.h / 2) * CELL;
    if (G.CREATURES[b.item.type]) {
      drawMachineCreatureCentered(b.item, b);
      return;
    }
    const d = G.CREATURES[b.item.type] || G.PRODUCTS[b.item.type];
    if (G.Assets.drawProductImage(ctx, b.item.type, cx, cy, 24)) return;
    ctx.fillStyle = d ? d.color : '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  }
  function drawBufferLabel(b, x, y, w, h) {
    const n = deviceCargoCount(b);
    const capacity = deviceBufferCapacity(b);
    const hasMountedCreature =
      (b.item && G.CREATURES[b.item.type]) ||
      (b.worker && G.CREATURES[b.worker.type]) ||
      (b.fuel && G.CREATURES[b.fuel.type]);
    const by = hasMountedCreature ? Math.max(y + 4, y + h - 24) : y + 4;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    const labelW = capacity >= 100 ? 59 : 43;
    ctx.fillRect(x + w - labelW - 5, by, labelW, 14);
    ctx.fillStyle = n >= capacity ? '#ffb0a0' : '#ffe28a';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('화물 ' + n + '/' + capacity, x + w - labelW / 2 - 5, by + 7);
    ctx.restore();
  }
  function drawDevicePowerBadge(b, x, y, w) {
    if ((POWER_POLES.has(b.type) && b.powered) || hasElectricBoost(b) || (needsRequiredPower(b) && b.powered)) drawPowerBadge(x, y, w);
    else if (powerBlocked(b)) drawPowerMissingBadge(x, y, w);
  }
  function drawPowerBadge(x, y, w) {
    if (drawUiBadgeImage('on.png', x, y, '#42f5d7')) return;
    ctx.save();
    ctx.fillStyle = 'rgba(30,70,90,0.82)';
    ctx.fillRect(x + 4, y + 4, 18, 16);
    ctx.fillStyle = '#ffd964';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', x + 13, y + 12);
    ctx.restore();
  }
  function drawPowerMissingBadge(x, y, w) {
    if (drawUiBadgeImage('off.png', x, y, '#ff5a4f')) return;
    ctx.save();
    ctx.fillStyle = 'rgba(90,20,20,0.92)';
    ctx.strokeStyle = '#ff5a4f';
    ctx.lineWidth = 2;
    ctx.fillRect(x + 4, y + 4, 22, 20);
    ctx.strokeRect(x + 4.5, y + 4.5, 21, 19);
    ctx.fillStyle = '#ffe3df';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', x + 15, y + 14);
    ctx.restore();
  }
  function drawUiBadgeImage(fileName, x, y, accent) {
    const rec = G.Assets.loadImage('assets/images/ui/' + fileName);
    if (!rec || !rec.ok || !rec.img.width) return false;
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,18,0.82)';
    ctx.strokeStyle = accent || '#d8f8ff';
    ctx.lineWidth = 2;
    ctx.fillRect(x + 3, y + 3, 26, 26);
    ctx.strokeRect(x + 3.5, y + 3.5, 25, 25);
    ctx.drawImage(rec.img, x + 6, y + 6, 20, 20);
    ctx.restore();
    return true;
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
  function drawPenTileBase(b) {
    const rec = G.Assets.loadImage('assets/images/devices/penbox_tile.png');
    for (const cell of penRelCells(b)) {
      const x = (b.col + cell.c) * CELL, y = (b.row + cell.r) * CELL;
      if (rec && rec.ok && rec.img.width) ctx.drawImage(rec.img, x, y, CELL, CELL);
      else { ctx.fillStyle = 'rgba(74,106,58,0.16)'; ctx.fillRect(x, y, CELL, CELL); }
    }
  }
  // 우리 울타리: penbox.png를 48x48 타일셋처럼 사용. 비정형 모양은 인접 셀 기준으로 가장 맞는 조각을 고름.
  function drawPenFenceLayer(b, onlyBottom) {
    const rec = G.Assets.deviceImg('penbox');
    if (rec && rec.ok && rec.img.width) {
      const aw = rec.img.width / 3, ah = rec.img.height / 3;
      for (const cell of penRelCells(b)) {
        const left = penHasRel(b, cell.c - 1, cell.r), right = penHasRel(b, cell.c + 1, cell.r);
        const up = penHasRel(b, cell.c, cell.r - 1), down = penHasRel(b, cell.c, cell.r + 1);
        if (onlyBottom && down) continue;
        const ac = !left && right ? 0 : (left && !right ? 2 : 1);
        const ar = !up && down ? 0 : (up && !down ? 2 : 1);
        ctx.drawImage(rec.img, ac * aw, ar * ah, aw, ah, (b.col + cell.c) * CELL, (b.row + cell.r) * CELL, CELL, CELL);
      }
    } else {
      ctx.strokeStyle = '#7aa055'; ctx.lineWidth = 2.5;
      for (const cell of penRelCells(b)) {
        const down = penHasRel(b, cell.c, cell.r + 1);
        if (onlyBottom && down) continue;
        const x = (b.col + cell.c) * CELL, y = (b.row + cell.r) * CELL;
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
  }
  function drawPenForeground(b) { drawPenFenceLayer(b, true); }
  function drawPen(b, x, y, w, h) {
    drawPenTileBase(b);
    drawPenUnchiStains(b);
    drawPenFenceLayer(b, false);
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fillRect(x + 1, y + 1, w - 2, 15);
    ctx.fillStyle = '#cfe'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(b.name || '우리', x + 4, y + 3);
    ctx.fillStyle = '#ffd964'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('성' + G.Pens.countAdult(b) + '/' + G.Pens.capAdult(b) + ' 새' + G.Pens.countYoung(b) + '/' + G.Pens.capYoung(b), x + w - 4, y + 3);
    const sorted = b.creatures.slice().sort((p, q) => (p.py || 0) - (q.py || 0)); // 아래쪽 우선(입체감)
    for (const c of sorted) drawPennedCreature((b.col + (c.px || 0.5)) * CELL, (b.row + (c.py || 0.5)) * CELL, c);
  }
  // 우리 바닥의 운치 얼룩(녹색). 운치 10당 1개.
  function drawPenUnchiStains(b) {
    const arr = b.unchiStains; if (!arr || !arr.length) return;
    ctx.save();
    for (const s of arr) {
      const sx = (b.col + s.x) * CELL, sy = (b.row + s.y) * CELL;
      for (const d of (s.dots || [])) {
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = (d.r > 3) ? '#3a7a30' : '#4f9e3a';
        ctx.beginPath(); ctx.arc(sx + d.dx * CELL, sy + d.dy * CELL, d.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
      if (m.speechT > 0 && m.speech) queueCreatureBubble(cx, cy - 8, m);
    }
  }
  function drawLabSlots(b, x, y, w, h) {
    const list = b.workers || [];
    const labRec = G.Assets.loadImage('assets/images/creatures/lab_jisou.png');
    const cols = 4, rows = 2;
    const sw = w * 0.72, sh = h * 0.46;
    const sx = x + (w - sw) / 2, sy = y + (h - sh) / 2;
    ctx.save();
    const maxSlots = C.LAB_SLOTS || 8;
    for (let i = 0; i < maxSlots; i++) {
      const cx = sx + (i % cols + 0.5) * (sw / cols);
      const cy = sy + (Math.floor(i / cols) + 0.5) * (sh / rows) + 8;
      const c = list[i];
      if (c) {
        if (labRec && labRec.ok && labRec.img.width) {
          const cw = labRec.img.width / 4, ch = labRec.img.height / 4;
          const scale = 1;
          const dw = cw * scale, dh = ch * scale;
          ctx.drawImage(labRec.img, G.Assets.frame() * cw, 0, cw, ch, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
        } else if (!G.Assets.drawCreatureNative(ctx, c.type, cx, cy, 0)) {
          const d = G.CREATURES[c.type]; ctx.fillStyle = d ? d.color : '#fff'; ctx.beginPath(); ctx.arc(cx, cy - 4, 8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.fillStyle = '#dff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('연구력 ' + researchPower().toFixed(0) + '/초', x + w / 2, y + 4);
    ctx.restore();
  }
  function creatureFootSprite(type, fx, fy, dirRowIdx, overrideRec) {
    const scale = (C.DISPLAY_SCALE && C.DISPLAY_SCALE[type]) || 1;
    const fallback = 24 * scale;
    const rec = (overrideRec && overrideRec.ok && overrideRec.img.width) ? overrideRec : G.Assets.creatureImg(type);
    if (rec && rec.ok && rec.img.width) {
      const cw = rec.img.width / 4, ch = rec.img.height / 4;
      const dw = cw * scale, dh = ch * scale;
      ctx.drawImage(rec.img, G.Assets.frame() * cw, (dirRowIdx || 0) * ch, cw, ch, Math.round(fx - dw / 2), Math.round(fy - dh), dw, dh);
      return { drawn: true, cx: fx, cy: fy - dh / 2, top: fy - dh, bottom: fy, size: Math.max(dw, dh) };
    }
    return { drawn: false, cx: fx, cy: fy - fallback / 2, top: fy - fallback, bottom: fy, size: fallback };
  }
  function drawPennedCreature(cx, cy, c) {
    const sz = 18 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[c.type]) || 1), def = G.CREATURES[c.type];
    let vx = c.pvx || 0, vy = c.pvy || 0; if (c.flee && c.flee.t > 0) { vx = c.flee.vx; vy = c.flee.vy; }
    const m = creatureFootSprite(c.type, cx, cy, G.Assets.dirRow(vx, vy));
    if (!m.drawn) {
      ctx.fillStyle = def ? def.color : '#fff'; ctx.beginPath(); ctx.arc(m.cx, m.cy, sz / 2, 0, Math.PI * 2); ctx.fill();
    }
    queueCreatureBadge(m.cx, m.cy, c);
    if (c.happyCircuit) drawHappyCircuit(m.cx, m.top - 2);
    else if (c.scream > 0) { ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('데챠앗!', m.cx, m.top - 2); }
    else if (c.flee && c.flee.t > 0) { ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('테챠아!', m.cx, m.top - 2); }
    else if (c.speechT > 0 && c.speech) queueCreatureBubble(m.cx, m.top - 2, c);
  }
  // 행복회로! — 분홍색 텍스트(깜빡임)
  function drawHappyCircuit(cx, topY) {
    const a = 0.55 + 0.45 * Math.abs(Math.sin(G.Assets.frame() * 1.6 + cx * 0.05));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff7ad0';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText((G.LINES && G.LINES.happyCircuit) || '행복회로!', cx, topY);
    ctx.restore();
  }

  function inoutBadge(cell, label, color) {
    const x = cell.c * CELL, y = cell.r * CELL;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 1, y + 1, 16, 12);
    ctx.fillStyle = color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(label, x + 3, y + 2);
  }
  function grabberHeldPoint(b) {
    const roles = grabberRoles(b);
    const interval = Math.max(0.001, grabberInterval(b));
    let t = clamp((b.cd || 0) / interval, 0, 1);
    if (!canGrabberDrop(b)) t = Math.min(t, 2 / 3);
    const sx = roles.pickup.c + 0.5, sy = roles.pickup.r + 0.5;
    const ex = roles.drop.c + 0.5, ey = roles.drop.r + 0.5;
    return { x: (sx + (ex - sx) * t) * CELL, y: (sy + (ey - sy) * t) * CELL };
  }
  function grabberHeadPoint(b) {
    if (b.holding) return grabberHeldPoint(b);
    const mid = grabberRoles(b).mid;
    return { x: mid.c * CELL + CELL / 2, y: mid.r * CELL + CELL / 2 };
  }
  function drawGrabberHeadStatic() {
    const rec = G.Assets.loadImage('assets/images/devices/grabber.png');
    if (!rec || !rec.ok || !rec.img.width) return false;
    let sw = rec.img.width, sh = rec.img.height;
    if (rec.img.width >= rec.img.height * 4) sw = rec.img.width / 4;
    ctx.drawImage(rec.img, 0, 0, sw, sh, -CELL / 2, -CELL / 2, CELL, CELL);
    return true;
  }
  // 포획기: 집게팔(grabber)이 대상에게 뻗는 모습 + 끌려오는 개체
  function drawCatcherArm(b) {
    const cx = (b.col + 0.5) * CELL, cy = (b.row + 0.5) * CELL;
    const arm = b.arm || { x: b.col + 0.5, y: b.row + 0.5 };
    const ax = arm.x * CELL, ay = arm.y * CELL;
    ctx.save();
    ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 4; ctx.lineCap = 'round';   // 팔
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke();
    // grabber 헤드(팔 끝, 대상 방향으로 회전)
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(Math.atan2(ay - cy, ax - cx) + Math.PI);
    if (!drawGrabberHeadStatic()) { ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // 끌고 오는 개체(헤드 위)
    if (b.holding && !G.Assets.drawCreatureNative(ctx, b.holding.type, ax, ay, 0)) {
      const d = G.CREATURES[b.holding.type]; ctx.fillStyle = d ? d.color : '#fff'; ctx.beginPath(); ctx.arc(ax, ay, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // 집게 바닥(레일 + 출 표시) — 다른 그래픽(화물/실장석)보다 하단에 그림
  function drawGrabberBase(b) {
    const roles = grabberRoles(b);
    const cx = roles.mid.c * CELL + CELL / 2, cy = roles.mid.r * CELL + CELL / 2;
    const def = G.DEVICES[b.type] || G.DEVICES.grabber;
    const span = Math.max(def.w || 3, def.h || 1);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((b.dir - 1) * Math.PI / 2);
    const railOk = G.Assets.drawDeviceSpriteNamed(ctx, 'grabber_rail.png', -span * CELL / 2, -CELL / 2, span * CELL, CELL, 0);
    ctx.restore();
    if (!railOk) {  // 플레이스홀더: □·△
      footprint(b.type, b.col, b.row, b.dir).cells.forEach((cell) => {
        const x = cell.c * CELL, y = cell.r * CELL;
        const label = (cell.c === roles.pickup.c && cell.r === roles.pickup.r) ? '□' : ((cell.c === roles.drop.c && cell.r === roles.drop.r) ? '△' : ((cell.c === roles.mid.c && cell.r === roles.mid.r) ? '·' : ''));
        ctx.save(); ctx.globalAlpha = (cell.c === roles.mid.c && cell.r === roles.mid.r) ? 0.95 : 0.7; ctx.fillStyle = def.color;
        if (cell.c === roles.mid.c && cell.r === roles.mid.r) ctx.fillRect(x + 6, y + 6, CELL - 12, CELL - 12);
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (label) ctx.fillText(label, x + CELL / 2, y + CELL / 2); ctx.restore();
      });
    }
    inoutBadge(roles.drop, '출', '#fc5');   // 출 위치 표시
  }
  // 집게 머리(헤드 + 들고 있는 물체) — 화물/실장석 위에 그림
  function drawGrabber(b) {
    const roles = grabberRoles(b);
    const def = G.DEVICES[b.type] || G.DEVICES.grabber;
    const head = grabberHeadPoint(b);
    if (b.holding) {
      const isCre = G.CREATURES[b.holding.type];
      const cm = isCre ? creatureFootSprite(b.holding.type, head.x, head.y, 0) : null;
      const drawn = isCre ? cm.drawn : G.Assets.drawProductImage(ctx, b.holding.type, head.x, head.y, 30);
      if (!drawn) {
        const def = isCre || G.PRODUCTS[b.holding.type];
        const cy = isCre && cm ? cm.cy : head.y;
        ctx.fillStyle = def ? def.color : '#fff'; ctx.beginPath(); ctx.arc(head.x, cy, 8, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate((b.dir - 1) * Math.PI / 2);
    const headOk = drawGrabberHeadStatic();
    ctx.restore();
    if (!headOk) {
      ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(head.x, head.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd9a0'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('집게', head.x, head.y);
    }
  }

  function drawCargo(cg) {
    const x = cg.gx * CELL, y = cg.gy * CELL, sz = 26 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[cg.data.type]) || 1);
    const stackN = cargoUnitCount(cg);
    const def = G.CREATURES[cg.data.type];   // 생물이면 def 존재
    if (def) {
      const v = DIR.vec[cg.dir] || { x: 1, y: 0 };
      const m = creatureFootSprite(cg.data.type, x, y, G.Assets.dirRow(v.x, v.y));
      if (!m.drawn) {
        const bob = (G.Assets.frame() % 2) ? -2 : 0;
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(m.cx, m.cy + bob, sz / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.label, m.cx, m.cy + bob);
      }
      queueCreatureBadge(m.cx, m.cy, cg.data);
      if (cg.data.speechT > 0 && cg.data.speech) queueCreatureBubble(m.cx, m.top - 2, cg.data);
    } else {  // 생산품/자원(실장육·분쇄육·요리·실장푸드·운치) — 아이콘=맵 그래픽(무애니)
      if (!G.Assets.drawProductImage(ctx, cg.data.type, x, y, 34)) {
        const pd = G.PRODUCTS[cg.data.type];
        ctx.fillStyle = pd ? pd.color : '#fff'; ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        lbl((cg.data.type || '?')[0]);
      }
    }
    if (stackN > 1) {
      const text = '(' + stackN.toLocaleString() + ')';
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      const tx = x + 20, ty = y - 22, tw = ctx.measureText(text).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(tx - tw, ty, tw, 15);
      ctx.strokeStyle = 'rgba(255,220,120,0.85)';
      ctx.strokeRect(tx - tw, ty, tw, 15);
      ctx.fillStyle = '#ffe28a';
      ctx.fillText(text, tx - 4, ty + 2);
      ctx.restore();
    }
    function lbl(t) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); }
  }

  function drawWanderer(w) {
    const x = w.gx * CELL, y = w.gy * CELL, sz = 24 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[w.data.type]) || 1);
    const def = G.CREATURES[w.data.type];
    // 침입 성체(1단계↑)는 out_jisou{단계}.png 스프라이트로 표시(없으면 기본 성체 그래픽)
    let override = null;
    if (w.invade && w.invadeLvl >= 1) override = G.Assets.loadImage('assets/images/creatures/out_jisou' + w.invadeLvl + '.png');
    // 노동석은 slave_adult_labor / slave_child_labor 스프라이트(없으면 기본 독라 그래픽)
    else if (w.data.labor) override = G.Assets.loadImage('assets/images/creatures/' + ((G.CREATURES[w.data.type] && G.CREATURES[w.data.type].isAdult) ? 'slave_adult_labor.png' : 'slave_child_labor.png'));
    const m = creatureFootSprite(w.data.type, x, y, G.Assets.dirRow(w.vx, w.vy), override);
    if (!m.drawn) {
      ctx.fillStyle = w.invade ? '#b5524a' : (def ? def.color : '#fff'); ctx.beginPath(); ctx.arc(m.cx, m.cy, sz / 2, 0, Math.PI * 2); ctx.fill();
    }
    // 발밑 링: 노동석=청록, 침입/약탈=빨강, 외부 출신=노랑, 일반=흰색
    ctx.strokeStyle = w.data.labor ? 'rgba(90,210,225,0.9)' : ((w.raider || w.invade) ? 'rgba(255,90,70,0.9)' : (w.wild ? 'rgba(255,200,80,0.75)' : 'rgba(255,255,255,0.5)'));
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, Math.max(5, sz / 3), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    if (w.data.labor) {
      if (w.data === laborTarget || selectedWorkers.includes(w.data)) {   // 명령 창/드래그 선택 노동석 강조
        ctx.strokeStyle = '#5ad2e1'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, Math.max(8, sz / 2), 0, Math.PI * 2); ctx.stroke();
      }
      // 모드 표시 (배회 모드는 무표시)
      const modeLabel = { retrieve: '회수', defend: '방어', hold: '대기', clean: '청소', mine: '채취' }[w.data.laborMode];
      if (modeLabel) {
        ctx.fillStyle = 'rgba(20,70,80,0.8)'; ctx.fillRect(m.cx - 12, m.cy + 24, 24, 11);
        ctx.fillStyle = '#9fe8f2'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(modeLabel, m.cx, m.cy + 30);
      }
      // 운반 중인 화물/실장석 아이콘 (머리 위)
      const carry = w.data.carry;
      if (carry) {
        const cy2 = m.top - 8;
        const shown = carry.kind === 'cargo' ? laborCargoItems(carry)[0] : carry.data;
        if (shown && !G.Assets.drawProductImage(ctx, shown.type, m.cx, cy2, 18)) {
          const cd = G.CREATURES[shown.type], pd = G.PRODUCTS[shown.type];
          ctx.fillStyle = (cd && cd.color) || (pd && pd.color) || '#fff';
          ctx.fillRect(m.cx - 7, cy2 - 7, 14, 14);
          ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(m.cx - 7, cy2 - 7, 14, 14);
        }
        if (carry.kind === 'cargo' && laborCargoItems(carry).length > 1) {
          ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('×' + laborCargoItems(carry).length, m.cx + 12, cy2 - 7);
        }
      }
    }
    queueCreatureBadge(m.cx, m.cy, w.data);
    // 정식 레이드 개체만 머리 위에 해골 표시
    if (w.formalRaid && !w._dead && !w.endingCinematic) {
      ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💀', m.cx, m.top - 24);
    }
    // 침입 표식 (성체는 단계 표시)
    if (w.invade) {
      const lab = (G.CREATURES[w.data.type] && G.CREATURES[w.data.type].isAdult) ? ('침입 Lv.' + (w.invadeLvl || 0)) : '침입';
      ctx.fillStyle = 'rgba(120,20,20,0.85)'; const bw = ctx.measureText(lab).width;
      ctx.font = 'bold 9px sans-serif'; const tw = ctx.measureText(lab).width + 6;
      ctx.fillRect(m.cx - tw / 2, m.top - 13, tw, 11);
      ctx.fillStyle = '#ffd0c0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lab, m.cx, m.top - 7.5);
    }
    // 피격 중이면 HP바
    const hm = G.Creatures.hpMaxOf(w.data);
    if (w.data.hp != null && hm && w.data.hp < hm) {
      const r = clamp(w.data.hp / hm, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(m.cx - 13, m.cy - 32, 26, 4);
      ctx.fillStyle = r > 0.4 ? '#6ad06a' : '#e25a4a'; ctx.fillRect(m.cx - 13, m.cy - 32, 26 * r, 4);
    }
    if (w.data.happyCircuit) drawHappyCircuit(m.cx, m.top - 2);
    else if (w.data.speechT > 0 && w.data.speech) queueCreatureBubble(m.cx, m.top - (w.invade ? 15 : 2), w.data);
  }

  // 스프라이트 위 등급 + 스탯 표기
  function drawCreatureBadgeNow(cx, cy, data) {
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
      if (b.type === 'chaosgate' && b.gateA && b.gateB) {
        ctx.strokeStyle = '#c78cff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.moveTo(b.gateA.c * CELL + CELL / 2, b.gateA.r * CELL + CELL / 2);
        ctx.lineTo(b.gateB.c * CELL + CELL / 2, b.gateB.r * CELL + CELL / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ffd964';
        ctx.lineWidth = 2;
        continue;
      }
      for (const cell of footprintCellsOf(b)) ctx.strokeRect(cell.c * CELL + 1, cell.r * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.restore();
  }
  // 레이드 방향 해골 마크: 레이드 30초 전 경고부터, 약탈자가 전멸할 때까지 유지.
  // 화면 밖이면 가장자리로 클램프해 방향을 가리키고, 화면 안 약탈자는 머리 위 해골로 표시됨.
  function drawRaidWarning() {
    const vx0 = cam.x / CELL, vy0 = cam.y / CELL;
    const vx1 = (cam.x + canvas.width / cam.zoom) / CELL, vy1 = (cam.y + canvas.height / cam.zoom) / CELL;
    let target = null, countdown = false;
    const raiders = S.wanderers.filter(w => !w._dead && w.formalRaid && !w.endingCinematic);
    if (raiders.length) {
      // 화면 밖 약탈자만 가장자리 마커로 안내(화면 안 약탈자는 머리 위 해골이 이미 있음)
      const off = raiders.filter(w => w.gx < vx0 || w.gx > vx1 || w.gy < vy0 || w.gy > vy1);
      if (!off.length) return;
      const ccx = (vx0 + vx1) / 2, ccy = (vy0 + vy1) / 2;
      let best = null, bd = Infinity;
      for (const w of off) { const d = Math.hypot(w.gx - ccx, w.gy - ccy); if (d < bd) { bd = d; best = w; } }
      target = { x: best.gx, y: best.gy };
    } else if (S.raidWarned && S.raidIn > 0 && S.raidPoint) {
      target = S.raidPoint; countdown = true;   // 아직 등장 전: 예고 지점 + 카운트다운
    }
    if (!target) return;
    const sx = clamp(target.x, vx0 + 1, vx1 - 1) * CELL, sy = clamp(target.y, vy0 + 1, vy1 - 1) * CELL;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 240));
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(180,20,20,0.55)'; ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.min(1, pulse + 0.2);
    ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.fillText('☠', sx, sy);
    if (countdown) {
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffd0c0'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(Math.ceil(S.raidIn) + '초', sx, sy + 30);
    }
    ctx.restore();
  }
  function drawPenEraseGhost() {
    if (!penEraseKey || !mouseCell) return;
    const a = penEraseStart || mouseCell;
    const minC = Math.min(a.col, mouseCell.col), maxC = Math.max(a.col, mouseCell.col);
    const minR = Math.min(a.row, mouseCell.row), maxR = Math.max(a.row, mouseCell.row);
    ctx.save();
    ctx.fillStyle = 'rgba(230,80,80,0.20)'; ctx.strokeStyle = '#e65a5a'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.fillRect(minC * CELL, minR * CELL, (maxC - minC + 1) * CELL, (maxR - minR + 1) * CELL);
    ctx.strokeRect(minC * CELL + 1, minR * CELL + 1, (maxC - minC + 1) * CELL - 2, (maxR - minR + 1) * CELL - 2);
    ctx.setLineDash([]); ctx.restore();
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
    const maxHp = wallMaxHp();
    const fallback = G.Assets.deviceImg('wall');
    const WTH = 16;   // 벽 두께(px)
    ctx.save(); ctx.lineCap = 'round';
    for (const key in S.walls) {
      if (!S.walls[key]) continue;
      const p = key.split('|'), A = +p[1], B = +p[2];
      const vertical = p[0] === 'V';
      if (A < renderView.x0 - 1 || A > renderView.x1 + 1 || B < renderView.y0 - 1 || B > renderView.y1 + 1) continue;
      const rec = G.Assets.loadImage('assets/images/devices/' + (vertical ? 'wall_height.png' : 'wall_width.png'));
      const hasImg = !!(rec && rec.ok && rec.img.width);
      const fallbackOk = !!(fallback && fallback.ok && fallback.img.width);
      const frac = clamp(wallHp(key) / maxHp, 0, 1);
      if (hasImg) {
        const dx = vertical ? A * CELL - WTH / 2 : A * CELL;
        const dy = vertical ? B * CELL : B * CELL - WTH / 2;
        const dw = vertical ? WTH : CELL, dh = vertical ? CELL : WTH;
        ctx.save();
        ctx.drawImage(rec.img, dx, dy, dw, dh);
        if (frac < 0.999) { ctx.globalAlpha = (1 - frac) * 0.55; ctx.fillStyle = '#a2302a'; ctx.fillRect(dx, dy, dw, dh); ctx.globalAlpha = 1; }
        if (selected.has(key)) { ctx.strokeStyle = '#ffd964'; ctx.lineWidth = 2; ctx.strokeRect(dx, dy, dw, dh); }
        ctx.restore();
      } else if (fallbackOk) {
        const cx = vertical ? A * CELL : (A + 0.5) * CELL;
        const cy = vertical ? (B + 0.5) * CELL : B * CELL;
        ctx.save(); ctx.translate(cx, cy); if (vertical) ctx.rotate(Math.PI / 2);
        ctx.drawImage(fallback.img, -CELL / 2, -WTH / 2, CELL, WTH);
        if (frac < 0.999) { ctx.globalAlpha = (1 - frac) * 0.55; ctx.fillStyle = '#a2302a'; ctx.fillRect(-CELL / 2, -WTH / 2, CELL, WTH); ctx.globalAlpha = 1; }
        if (selected.has(key)) { ctx.strokeStyle = '#ffd964'; ctx.lineWidth = 2; ctx.strokeRect(-CELL / 2, -WTH / 2, CELL, WTH); }
        ctx.restore();
      } else {
        // 손상될수록 가늘고 붉게(부서지기 직전)
        ctx.lineWidth = 6 + 4 * frac;
        ctx.strokeStyle = selected.has(key) ? '#ffd964' : (frac < 0.999 ? mixWallColor(frac) : '#d6a85a');
        ctx.beginPath();
        if (vertical) { ctx.moveTo(A * CELL, B * CELL); ctx.lineTo(A * CELL, (B + 1) * CELL); }
        else { ctx.moveTo(A * CELL, B * CELL); ctx.lineTo((A + 1) * CELL, B * CELL); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawDoors() {
    const keys = Object.keys(S.doors).filter(k => S.doors[k]);
    if (!keys.length) return;
    const selected = new Set(doorSelection);
    const fallback = G.Assets.deviceImg('door');
    const maxHp = wallMaxHp(), WTH = 18;
    ctx.save(); ctx.lineCap = 'butt';
    for (const key of keys) {
      const p = key.split('|'), A = +p[1], B = +p[2];
      const vertical = p[0] === 'V';
      if (A < renderView.x0 - 1 || A > renderView.x1 + 1 || B < renderView.y0 - 1 || B > renderView.y1 + 1) continue;
      const rec = G.Assets.loadImage('assets/images/devices/' + (vertical ? 'door_height.png' : 'door_width.png'));
      const hasImg = !!(rec && rec.ok && rec.img.width);
      const fallbackOk = !!(fallback && fallback.ok && fallback.img.width);
      const frac = clamp(doorHp(key) / maxHp, 0, 1);
      const cx = vertical ? A * CELL : (A + 0.5) * CELL;
      const cy = vertical ? (B + 0.5) * CELL : B * CELL;
      ctx.save();
      if (hasImg) {
        const dx = vertical ? A * CELL - WTH / 2 : A * CELL;
        const dy = vertical ? B * CELL : B * CELL - WTH / 2;
        const dw = vertical ? WTH : CELL, dh = vertical ? CELL : WTH;
        ctx.drawImage(rec.img, dx, dy, dw, dh);
        if (frac < 0.999) { ctx.globalAlpha = (1 - frac) * 0.5; ctx.fillStyle = '#a2302a'; ctx.fillRect(dx, dy, dw, dh); ctx.globalAlpha = 1; }
        if (selected.has(key)) { ctx.strokeStyle = '#ffd964'; ctx.lineWidth = 2; ctx.strokeRect(dx, dy, dw, dh); }
      } else if (fallbackOk) {
        ctx.translate(cx, cy); if (vertical) ctx.rotate(Math.PI / 2);
        ctx.drawImage(fallback.img, -CELL / 2, -WTH / 2, CELL, WTH);
        if (frac < 0.999) { ctx.globalAlpha = (1 - frac) * 0.5; ctx.fillStyle = '#a2302a'; ctx.fillRect(-CELL / 2, -WTH / 2, CELL, WTH); ctx.globalAlpha = 1; }
        if (selected.has(key)) { ctx.strokeStyle = '#ffd964'; ctx.lineWidth = 2; ctx.strokeRect(-CELL / 2, -WTH / 2, CELL, WTH); }
      } else {   // 플레이스홀더: 갈색 문 + 손잡이
        ctx.translate(cx, cy); if (vertical) ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#a98a5a'; ctx.fillRect(-CELL / 2 + 1, -WTH / 2, CELL - 2, WTH);
        ctx.strokeStyle = '#6e5836'; ctx.lineWidth = 2; ctx.strokeRect(-CELL / 2 + 1, -WTH / 2, CELL - 2, WTH);
        ctx.fillStyle = '#3a2e1c'; ctx.beginPath(); ctx.arc(CELL / 2 - 6, 0, 1.8, 0, Math.PI * 2); ctx.fill();
        if (frac < 0.999) { ctx.globalAlpha = (1 - frac) * 0.5; ctx.fillStyle = '#a2302a'; ctx.fillRect(-CELL / 2, -WTH / 2, CELL, WTH); ctx.globalAlpha = 1; }
        if (selected.has(key)) { ctx.strokeStyle = '#ffd964'; ctx.lineWidth = 2; ctx.strokeRect(-CELL / 2, -WTH / 2, CELL, WTH); }
      }
      ctx.restore();
    }
    ctx.restore();
  }
  // 체력 비율(0~1)에 따라 벽 색을 정상(#d6a85a)→손상(#a23a2a)으로 보간
  function mixWallColor(frac) {
    const a = [0xd6, 0xa8, 0x5a], b = [0xa2, 0x3a, 0x2a];
    const r = Math.round(b[0] + (a[0] - b[0]) * frac);
    const g = Math.round(b[1] + (a[1] - b[1]) * frac);
    const bl = Math.round(b[2] + (a[2] - b[2]) * frac);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
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
  // 문 고스트: 마우스 근처 벽 위 연속 3칸을 미리보기(녹색=가능, 빨강=불가)
  function drawDoorGhost() {
    const wkey = wallAtPoint(mouseGX, mouseGY);
    const run = wkey ? doorRun(wkey) : null;
    if (!run) {
      // 가까운 벽 강조 없음 — 커서에 안내 점
      ctx.save(); ctx.fillStyle = 'rgba(230,90,90,0.6)';
      ctx.beginPath(); ctx.arc(mouseGX * CELL, mouseGY * CELL, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return;
    }
    const danger = run.some(wallKeyInDanger);
    ctx.save(); ctx.strokeStyle = danger ? 'rgba(230,90,90,0.85)' : 'rgba(120,220,140,0.9)'; ctx.lineWidth = 16; ctx.lineCap = 'butt'; ctx.globalAlpha = 0.7;
    for (const key of run) {
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
      const cells = (it.type === 'penbox' && it.cells) ? it.cells.map(cell => ({ c: col + cell.c, r: row + cell.r })) : footprint(it.type, col, row, it.dir).cells;
      for (const cell of cells) {
        const x = cell.c * CELL, y = cell.r * CELL;
        const ok = isOwnedCell(cell.c, cell.r);
        ctx.fillStyle = ok ? 'rgba(120,200,255,0.32)' : 'rgba(230,90,90,0.32)';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }
  function drawGhost() {
    if (moveMode) return;
    if (pasteMode) { drawPasteGhost(); return; }
    if (currentTool === 'wall') { if (mouseCell) drawWallGhost(); return; }
    if (currentTool === 'door') { drawDoorGhost(); return; }
    if (currentTool === 'penbox') { drawPenGhost(); return; }
    if (currentTool === 'chaosgate') { drawChaosGateGhost(); return; }
    if (currentTool === 'crossbelt') { drawCrossbeltGhost(); return; }
    if (!currentTool || !mouseCell) { if (beltDragging) drawBeltGhostPath(); return; }
    if (currentTool === 'belt' || currentTool === 'guardbelt') { if (beltDragging) drawBeltGhostPath(); else drawSingleGhost(currentTool, mouseCell.col, mouseCell.row, ghostDir); return; }
    const o = ghostOrigin(currentTool, mouseCell, ghostDir);
    drawSingleGhost(currentTool, o.col, o.row, ghostDir);
  }
  function drawChaosGateGhost() {
    if (!mouseCell && !chaosGateDragStart) return;
    const a = chaosGateDragStart || mouseCell, z = mouseCell || a;
    const inRange = Math.abs(z.col - a.col) <= 48 && Math.abs(z.row - a.row) <= 48;
    const validStart = isOwnedCell(a.col, a.row) && !occAt(a.col, a.row) && !hasBelt(a.col, a.row);
    const validEnd = inRange && isOwnedCell(z.col, z.row) && !occAt(z.col, z.row) && !hasBelt(z.col, z.row);
    const dir = chaosGateDir(a, z);
    const angle = Math.atan2(z.row - a.row, z.col - a.col);
    ctx.save();
    ctx.globalAlpha = 0.68;
    const ghost = {
      type: 'chaosgate', col: a.col, row: a.row, w: 1, h: 1, dir,
      gateA: { c: a.col, r: a.row }, gateB: { c: z.col, r: z.row }, gateAngle: angle,
    };
    drawTransport(ghost);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = validStart && validEnd ? '#c78cff' : '#f88';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(a.col * CELL + CELL / 2, a.row * CELL + CELL / 2);
    ctx.lineTo(z.col * CELL + CELL / 2, z.row * CELL + CELL / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  function drawCrossbeltGhost() {
    if (!mouseCell && !crossbeltDragStart) return;
    const a = crossbeltDragStart || mouseCell;
    const z = straightTransportEnd(a, mouseCell || a, CROSSBELT_MAX_DISTANCE);
    const validStart = isOwnedCell(a.col, a.row) && !occAt(a.col, a.row) && !hasBelt(a.col, a.row);
    const validEnd = isOwnedCell(z.col, z.row) && !occAt(z.col, z.row) && !hasBelt(z.col, z.row);
    const dir = chaosGateDir(a, z);
    const ghost = {
      type: 'crossbelt', col: a.col, row: a.row, w: 1, h: 1, dir,
      gateA: { c: a.col, r: a.row }, gateB: { c: z.col, r: z.row }, queue: [],
    };
    ctx.save();
    ctx.globalAlpha = 0.68;
    drawTransport(ghost);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = validStart && validEnd ? '#8fe6ff' : '#f88';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(a.col * CELL + CELL / 2, a.row * CELL + CELL / 2);
    ctx.lineTo(z.col * CELL + CELL / 2, z.row * CELL + CELL / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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
    const existing = penDragStart ? deviceAt(penDragStart.col, penDragStart.row) : null;
    for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) {
      const c = col + dc, r = row + dr;
      const ownedByExisting = existing && existing.type === 'penbox' && penAbsCells(existing).some(pc => pc.c === c && pc.r === r);
      if (!isOwnedCell(c, r) || (!ownedByExisting && occAt(c, r)) || hasBelt(c, r)) ok = false;
    }
    ctx.fillStyle = ok ? 'rgba(120,220,160,0.3)' : 'rgba(230,90,90,0.3)';
    ctx.fillRect(col * CELL + 2, row * CELL + 2, w * CELL - 4, h * CELL - 4);
    ctx.strokeStyle = ok ? '#8fd' : '#f88'; ctx.lineWidth = 2;
    ctx.strokeRect(col * CELL + 2, row * CELL + 2, w * CELL - 4, h * CELL - 4);
    ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('우리 +' + (w * h) + '칸 (성체' + (w * h * C.PEN_ADULT_PER_CELL) + '/새끼' + (w * h * C.PEN_YOUNG_PER_CELL) + ')', col * CELL + w * CELL / 2, row * CELL + h * CELL / 2);
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
    if (type === 'feeder') {
      for (const feeder of frameCache.feedZones) {
        drawRangeOverlay(rangeRect(feeder.type, feeder.col, feeder.row, feeder.dir || 0), '#8fd98f', 0.08);
      }
    }
    if (G.DEVICES[type].range) drawRangeOverlay(rangeRect(type, col, row, dir), '#ffd24a', 0.18); // 영향 범위 미리보기
    if (POWER_PLANTS.has(type) || POWER_POLES.has(type)) {
      drawRangeOverlay(powerSupplyRectFor(type, col, row, fp.w, fp.h), '#6ee7d8', 0.16);
      const ghost = { type, col, row, w: fp.w, h: fp.h };
      if (POWER_POLES.has(type)) drawGhostPowerLinks(ghost, null, true);
      if (POWER_PLANTS.has(type)) drawGhostPowerConsumers(ghost);
    }
    if (POWER_POLES.has(type)) {
      ctx.save();
      ctx.globalAlpha = 0.62;
      drawPowerPoleDevice({ type, col, row, w: fp.w, h: fp.h }, col * CELL, row * CELL);
      ctx.restore();
    }
    if (type === 'turret') drawTurretRange(col + 0.5, row + 0.5, C.TURRET_RANGE);                 // 포탑 기본 사거리 미리보기
    if (type === 'sniper') drawTurretRange(col + 0.5, row + 0.5, C.SNIPER_RANGE || C.TURRET_RANGE * 3);   // 저격 터렛 사거리 미리보기
    if (type === 'mortar') drawTurretRange(col + 0.5, row + 0.5, C.MORTAR_RANGE || 18);
    if (type === 'chaosturret') drawTurretRange(col + fp.w / 2, row + fp.h / 2, C.CHAOS_TURRET_RANGE || 12);
    if (type === 'skewer') {
      ctx.save();
      ctx.globalAlpha = 0.62;
      drawSkewerDevice({ type: 'skewer', held: null }, col * CELL, row * CELL);
      ctx.restore();
    }
    if (isGrabberType(type)) {
      const roles = grabberRoles({ type, col, row, dir });
      gLabel(roles.pickup, '입□'); gLabel(roles.mid, '·'); gLabel(roles.drop, '출△');
      drawArrow(roles.mid.c * CELL + CELL / 2, roles.mid.r * CELL + CELL / 2, dir, ok ? '#cff' : '#fcc');
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
    if (type === 'largewarehouse') {
      largeWarehouseOutputCells(b).forEach(cell => drawGhostOutputCell(cell, '출'));
      return;
    }
    if (type === 'penbox' || type === 'warehouse' || type === 'wall' || type === 'packer') return;
    if (type === 'tunnel' || type === 'crossbelt' || type === 'chaosgate') { drawGhostOutputCell(transportEnds(b).exit, '출'); return; }
    if (isGrabberType(type)) { drawGhostOutputCell(grabberRoles(b).drop, '출'); return; }
    if (type === 'sorter') { laneInfo(b).forEach(ln => drawGhostOutputCell(ln.out, '출')); return; }
    if (type === 'correction') {
      drawGhostOutputCell(sideCell(b, dir), '사육출');
      drawGhostOutputCell(sideCell(b, (dir + 2) % 4), '육출');
      return;
    }
    if (type === 'speaker' || type === 'pointer' || type === 'skewer' || type === 'feeder' || type === 'turret' || type === 'sniper' || type === 'mortar' || type === 'chaosturret' || type === 'mine') return;
    if (!['birthing', 'washbasin', 'deshell', 'reformer'].includes(type)) return;
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
    const movingIds = new Set(moving.map(m => m.b.id));
    for (const m of moving) {
      const col = mouseCell.col + m.offC, row = mouseCell.row + m.offR;
      const fp = m.b.type === 'penbox' ? { cells: penAbsCells(m.b, col, row) } : footprint(m.b.type, col, row, m.b.dir);
      const ok = canPlaceMoved(m.b, col, row);
      for (const cell of fp.cells) {
        const x = cell.c * CELL, y = cell.r * CELL;
        ctx.fillStyle = ok ? 'rgba(120,180,240,0.45)' : 'rgba(230,90,90,0.45)';
        ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
      if (POWER_PLANTS.has(m.b.type) || POWER_POLES.has(m.b.type)) {
        const ghost = { id: m.b.id, type: m.b.type, col, row, w: m.b.w, h: m.b.h };
        drawRangeOverlay(powerSupplyRectFor(m.b.type, col, row, m.b.w, m.b.h), ok ? '#6ee7d8' : '#d67a7a', ok ? 0.16 : 0.08);
        if (POWER_POLES.has(m.b.type) && ok) drawGhostPowerLinks(ghost, movingIds, true);
        if (POWER_PLANTS.has(m.b.type) && ok) drawGhostPowerConsumers(ghost, movingIds);
        if (POWER_POLES.has(m.b.type)) {
          ctx.save();
          ctx.globalAlpha = ok ? 0.62 : 0.36;
          drawPowerPoleDevice(ghost, col * CELL, row * CELL);
          ctx.restore();
        }
      }
    }
  }

  function laborStatus() { return { count: S.wanderers.filter(w => w.data && w.data.labor).length, limit: laborLimit() }; }
  return { init, update, updateCamera: updateCameraKeys, penVisualActive, render, reloadState, playOpeningIntro, screenToCell, tryLoadCreature, hoverDropTarget, clearDropHover, sellAllWarehouse, sellSomeType, sellPenCreatures, sellJissoFood, spawnWanderer, dropToFactory, dropFloorCargo, burstAt, stainAt, floatText, playSfxAt: playWorldSfx, triggerRaidCountdown, clearInvaders, endingCheat, chooseEnding, endingCinematicShot, endingCountdownFinale, endingCinematicTick, endingLaunchStart, endingLaunchFrame, finishStayEnding, researchPower, warehouseCount, playerInventoryCapacity, playerInventoryCount, playerInventoryRoom, laborStatus, powerUsageBreakdown, feedZoneMult, feedZoneInfo, pushOutOfFeeders, exportRuntimeState, importRuntimeState, refreshMenu, hotkeyBindings, hotkeyToolOptions, setBuildHotkey, questsForUI, acceptQuest, completeQuest, deliverQuest, questHasAny, marketMult, marketPct, forceTutorialGrowth, focusCameraOnGrid, tutorialGrowthLineConnected, landEnvironment, environmentAtPoint, environmentForBuilding, environmentEffectsForBuilding, hasOwnedEnvironment, recordUnchiProduced: n => { achievementStats().unchi += Math.max(0, n || 0); } };
})();
