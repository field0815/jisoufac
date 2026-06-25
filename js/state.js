/* =========================================================================
 * state.js  —  전역 게임 상태
 * ========================================================================= */
window.G = window.G || {};

(function () {
  const C = G.CONFIG;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function freshState(opts) {
    opts = opts || {};
    // 가격 계수 깊은 복사 (런타임에 통계창에서 수정)
    const prices = clone(G.PRICE_DEFAULTS);
    const difficulty = opts.difficulty || 'park';
    return {
    money: difficulty === 'breeding' ? 50000 : C.START_MONEY,
    difficulty,
    tutorial: {
      enabled: !!opts.tutorial, step: 0, hidden: false, flags: {}, reviewing: false,
      completed: false, cancelled: false, completedSteps: {}, enteredStep: -1, explained: {},
      conditional: { wildShown: false, wildMoved: false, raidWarnShown: false, turretResponseShown: false },
    },

    // 공원
    park: [],
    parkItems: [],    // 공원에 설치한 아이템 {id,type,x,y}
    captureBoxes: [{ targetPenId: null }], // 포획 상자(기본 1개) — targetPenId=보낼 우리(null=자동)
    parkSpawnTimer: 0,
    captureProgress: 0,
    autoCapture: false,
    autoCaptureTimer: 0,

    // 옵션
    audio: { bgm: 0.35, sfx: 1 },
    autoSave: true,
    weather: { rollIn: C.WEATHER_ROLL_SEC || 60, rainLeft: 0 },
    linggal: true,    // 링갈 ON/OFF — OFF면 실장석이 단순 대사만 함

    // 퀘스트(무전)
    quests: [],          // 활성 퀘스트 {id, org, item, n, stat, delivered, accepted, rewardText, reward}
    questTimer: 0,       // 다음 퀘스트 생성까지 누적 시간
    questIntro: {},      // 단체별 첫 자기소개 출력 여부 { orgKey: true }
    openingDone: false,  // 새 게임 시작 인트로 연출 완료 여부
    seafoodMidoriShown: false,  // 첫 수산물 채취 시 미도리 대사 출력 여부
    electronicPartsMidoriShown: false, // 첫 전자부품 발굴 대사 출력 여부
    chaosMaggotMidoriShown: false, // 첫 카오스 구더기 발굴 대사 출력 여부
    redzoneWarehouseWarned: false, // 적색지대 창고 설치 경고 대사 출력 여부
    introDone: false,    // 세계관 인트로 + 첫 퀘스트 발생 여부(콜로니 T1 트리거)
    researchBonus: 0,    // 위석연구소 보상: 영구 연구력 가산
    powerBonus: 0,       // 낙원컬트/위석연구소 보상: 영구 전력 가산
    buyPrice: { 성체실장: C.BUY_ADULT, 자실장: C.BUY_CHILD },  // 거래창 실장석 구매가(살 때마다 +1)
    market: {},          // 시장 포화도(제품별 누적 판매량, 시간에 따라 회복) → 판매 단가 하락
    autoBuyFood: { on: false, threshold: 50, batch: 100 },  // 실장푸드 자동구매 옵션

    // 자원 (실장석은 이제 우리(펜) 건물 안 또는 배회 상태로만 존재)
    food: C.START_FOOD || 0,  // 실장푸드 재고(사료) — 시작 보유량
    jissoFood: 0,     // 짓소산 푸드 재고(특수 사료)
    umaiFood: 0,      // 우마이푸드 재고(특수 사료)
    dietFood: 0,      // 다이어트푸드 재고(특수 사료)
    unchi: 0,         // 운치 재고
    power: 0,         // 전력(자원, 화물로 추출 불가 — 상단 ⚡ 표시)
    powerUsed: 0,     // 현재 소비 전력
    seasoning: 0,     // 조미료 재고(조리실 재료)
    seasoningPrice: C.SEASONING_BASE, // 조미료 현재가(1분마다 변동)
    seasoningTimer: 0,
    foodDemandPerMin: 0,
    unchiPerMin: 0,
    penSeq: 0,        // 우리 이름 번호 카운터
    playTime: 0,      // 누적 플레이 시간(초) — 약탈 시작 판정
    intrudeIn: 0,     // 외부 가족 리젠까지 남은 시간(0=미예약)
    raidIn: 0,        // 다음 약탈까지 남은 시간(0=미예약)
    raidNum: 0,       // 지금까지 발생한 레이드 수(규모/HP 스케일링)
    upgrades: { 애호파: 0, 학대파: 0, 기초교육: 0, 필라테스: 0, 실장푸드뿌리기: 0 }, // 공원 업그레이드 레벨
    researchQueue: [],        // 예약된 연구 {key, name, cost, targetLevel}
    currentResearch: null,    // 진행 중인 연구
    researchCancelHold: false, // 취소 직후 다음 예약의 즉시 승격 방지
    researchProgress: 0,      // 현재 연구 누적 연구력
    researchProgressBank: {}, // 취소한 진행 중 연구의 저장 진행도: "key|level" -> progress
    colonyTier: 0,    // 콜로니 센터 티어(0~4, T4=엔딩 메가프로젝트)
    colonyUpgrade: null,  // 진행 중인 티어 승급: { target, remain, total } 또는 null
    ending: {
      stage: -1, offered: false, accepted: false, gridKey: null, launchpadId: null,
      eventTimer: 0, event: '', scrap: 0, products: 0, concentrate: 0, electronics: 0, charge: 0,
      halfShown: false, raidCount: 0, choiceShown: false,
    },
    endingSaveLocked: false,
    landEnvironmentOverrides: {},

    // 공장
    buildings: [],    // 펜(우리)도 buildings에 포함: {type:'penbox', creatures:[]}
    buildInstallCounts: {}, // 설치할 때마다 증가하는 자재 비용용 누적 설치 횟수
    walls: {},        // 셀 경계 벽: 'V|X|R' / 'H|C|Y' → 남은 HP(숫자)
    wallLevel: 0,     // 벽 업그레이드 레벨(0~20) — 최대 체력 = WALL_HP × 2^레벨
    doors: {},        // 셀 경계 문: 'V|X|R' / 'H|C|Y' → 문 그룹 id. 노동석만 통과, 적은 막힘
    cargo: [],
    wanderers: [],    // 배회하는 생물 {data, gx, gy, vx, vy, t, flee}
    particles: [],    // 파티클 {x,y,vx,vy,life,max,color}
    stains: [],       // 바닥 자국 {x,y,dots:[{dx,dy,r,color}]}
    selection: [],    // 선택된 건물 id 목록
    ownedLand: {},    // 구매한 외부 토지 그리드: "gx|gy" -> true
    landBought: 0,
    landSeed: Math.floor(Math.random() * 0x7fffffff), // 환경 배정용 월드 시드
    environmentFeatures: {}, // 고정 시설 생성 완료 기록
    ambientInvaderTimers: {}, // 환경별 상시 침입 생성 타이머
    environmentResidentsSeeded: {}, // 적색지대 기본 침입 개체 최초 배치 기록
    ruins: [],        // 채취 가능한 유적/폐허/잔해 {id,type,col,row,w,h,scrap}
    ruinGrids: {},    // 유적 생성 완료 그리드

    // 창고/판매
    warehouse: {},    // 콜로니센터(플레이어) 인벤토리. 일반 난이도에서는 공유 창고 재고.
    autoSell: {},     // 생산품명 -> true (입고 즉시 자동 판매)
    sold: {},         // 생산품명 -> 누적 판매 수
    soldValueByType: {}, // 생산품명 -> 누적 판매액
    soldValue: 0,     // 누적 매출
    produceLog: [],   // 판매 시각 기록 (분당 판매량)
    achievementStats: { pets: 0, creatures: 0, labor: 0, meat: 0, products: 0, chaosMaggots: 0, powerUsed: 0, unchi: 0, productTypes: {} },
    monumentsUnlocked: {},
    monumentsNotified: {},

    // 가격
    prices,

    nextId: 1,
    screen: 'factory',   // 베이스 화면: 'park' | 'factory'
      overlay: null,       // 오버레이: null | 'shop' | 'research' | 'stats'
    };
  }

  function normalizeState(saved) {
    const base = freshState();
    if (!saved || typeof saved !== 'object') return base;
    const hadBuildInstallCounts = Object.prototype.hasOwnProperty.call(saved, 'buildInstallCounts');
    Object.keys(saved).forEach(k => {
      if (k in base) base[k] = saved[k];
    });
    base.prices = Object.assign(clone(G.PRICE_DEFAULTS), base.prices || {});
    if (base.prices.사육실장 && base.prices.사육실장.크기역 != null) base.prices.사육실장 = clone(G.PRICE_DEFAULTS.사육실장);
    base.upgrades = Object.assign(freshState().upgrades, base.upgrades || {});
    base.upgrades.카오스연구 = Math.max(0, Math.min(10, Math.floor(base.upgrades.카오스연구 || 0)));
    if (!Array.isArray(base.researchQueue)) base.researchQueue = [];
    if (!base.currentResearch || typeof base.currentResearch !== 'object') base.currentResearch = null;
    base.researchCancelHold = false;
    base.researchProgress = Math.max(0, base.researchProgress || 0);
    if (!base.researchProgressBank || typeof base.researchProgressBank !== 'object') base.researchProgressBank = {};
    base.colonyTier = Math.max(0, Math.min(4, Math.floor(base.colonyTier || 0)));
    if (base.colonyUpgrade && typeof base.colonyUpgrade === 'object') {
      const cu = base.colonyUpgrade;
      const target = Math.max(1, Math.min(4, Math.floor(cu.target || 0)));
      const total = +cu.total > 0 ? +cu.total : 60;
      const remain = Math.max(0, Math.min(total, +cu.remain || 0));
      base.colonyUpgrade = target ? { target, remain, total } : null;
    } else { base.colonyUpgrade = null; }
    base.ending = Object.assign(freshState().ending, (base.ending && typeof base.ending === 'object') ? base.ending : {});
    base.ending.stage = Math.max(-1, Math.min(4, Math.floor(base.ending.stage == null ? -1 : base.ending.stage)));
    base.ending.infinite = !!base.ending.infinite;
    base.endingSaveLocked = !!base.endingSaveLocked;
    for (const key of ['scrap', 'products', 'concentrate', 'electronics', 'charge', 'eventTimer', 'raidCount']) base.ending[key] = Math.max(0, +base.ending[key] || 0);
    if (!hadBuildInstallCounts || !base.buildInstallCounts || typeof base.buildInstallCounts !== 'object') {
      base.buildInstallCounts = {};
      for (const b of (base.buildings || [])) base.buildInstallCounts[b.type] = (base.buildInstallCounts[b.type] || 0) + 1;
    }
    if (!base.landEnvironmentOverrides || typeof base.landEnvironmentOverrides !== 'object') base.landEnvironmentOverrides = {};
    base.powerUsed = Math.max(0, base.powerUsed || 0);
    if (!Number.isFinite(+base.landSeed)) base.landSeed = Math.floor(Math.random() * 0x7fffffff);
    base.landSeed = Math.abs(Math.floor(+base.landSeed)) || 1;
    if (!base.environmentFeatures || typeof base.environmentFeatures !== 'object') base.environmentFeatures = {};
    if (!base.ambientInvaderTimers || typeof base.ambientInvaderTimers !== 'object') base.ambientInvaderTimers = {};
    if (!base.environmentResidentsSeeded || typeof base.environmentResidentsSeeded !== 'object') base.environmentResidentsSeeded = {};
    if (!base.soldValueByType || typeof base.soldValueByType !== 'object') base.soldValueByType = {};
    if (!Array.isArray(base.produceLog) || base.produceLog.length > 2000) base.produceLog = [];
    base.achievementStats = Object.assign(freshState().achievementStats, base.achievementStats || {});
    if (!base.achievementStats.productTypes || typeof base.achievementStats.productTypes !== 'object') base.achievementStats.productTypes = {};
    if (!base.monumentsUnlocked || typeof base.monumentsUnlocked !== 'object') base.monumentsUnlocked = {};
    if (!base.monumentsNotified || typeof base.monumentsNotified !== 'object') base.monumentsNotified = {};
    if (!base.difficulty) base.difficulty = 'park';
    if (!['breeding', 'park', 'dokura'].includes(base.difficulty)) base.difficulty = 'park';
    if (!base.tutorial || typeof base.tutorial !== 'object') base.tutorial = { enabled: false, step: 0, hidden: false };
    base.tutorial.enabled = !!base.tutorial.enabled;
    base.tutorial.step = Math.max(0, Math.floor(base.tutorial.step || 0));
    base.tutorial.hidden = !!base.tutorial.hidden;
    if (!base.tutorial.flags || typeof base.tutorial.flags !== 'object') base.tutorial.flags = {};
    base.tutorial.reviewing = !!base.tutorial.reviewing;
    base.tutorial.completed = !!base.tutorial.completed;
    base.tutorial.cancelled = !!base.tutorial.cancelled;
    if (!base.tutorial.completedSteps || typeof base.tutorial.completedSteps !== 'object') base.tutorial.completedSteps = {};
    if (!base.tutorial.explained || typeof base.tutorial.explained !== 'object') base.tutorial.explained = {};
    base.tutorial.enteredStep = Number.isFinite(+base.tutorial.enteredStep) ? Math.floor(base.tutorial.enteredStep) : -1;
    base.tutorial.conditional = Object.assign({
      wildShown: false, wildMoved: false, raidWarnShown: false, turretResponseShown: false,
    }, base.tutorial.conditional || {});
    base.audio = Object.assign({ bgm: 0.35, sfx: 1 }, base.audio || {});
    if (typeof base.autoSave !== 'boolean') base.autoSave = true;
    if (typeof base.linggal !== 'boolean') base.linggal = true;
    base.umaiFood = Math.max(0, base.umaiFood || 0);
    base.dietFood = Math.max(0, base.dietFood || 0);
    base.electronicPartsMidoriShown = !!base.electronicPartsMidoriShown;
    base.chaosMaggotMidoriShown = !!base.chaosMaggotMidoriShown;
    base.redzoneWarehouseWarned = !!base.redzoneWarehouseWarned;
    if (!Array.isArray(base.quests)) base.quests = [];
    base.quests.forEach(q => { q.delivered = Math.max(0, Math.floor(q.delivered || 0)); });
    if (!base.questIntro || typeof base.questIntro !== 'object') base.questIntro = {};
    base.questTimer = base.questTimer || 0;
    base.openingDone = !!base.openingDone;
    base.introDone = !!base.introDone;
    base.researchBonus = Math.max(0, base.researchBonus || 0);
    if (!base.buyPrice || typeof base.buyPrice !== 'object') base.buyPrice = {};
    base.buyPrice.성체실장 = Math.max(1, Math.floor(base.buyPrice.성체실장 || C.BUY_ADULT));
    base.buyPrice.자실장 = Math.max(1, Math.floor(base.buyPrice.자실장 || C.BUY_CHILD));
    if (!base.market || typeof base.market !== 'object') base.market = {};
    base.autoBuyFood = Object.assign({ on: false, threshold: 50, batch: 100 }, base.autoBuyFood || {});
    base.powerBonus = Math.max(0, base.powerBonus || 0);
    base.unchi = Math.min(C.UNCHI_MAX || 100000, Math.max(0, base.unchi || 0));
    if (!base.doors || typeof base.doors !== 'object') base.doors = {};
    if (!Array.isArray(base.ruins)) base.ruins = [];
    base.ruins.forEach(r => { if (r) r.chaosMaggotFound = !!r.chaosMaggotFound; });
    if (!base.ruinGrids || typeof base.ruinGrids !== 'object') base.ruinGrids = {};
    if (base.warehouse && base.warehouse['풍요로운 만찬']) {
      if (!base.warehouse['호화로운 만찬']) base.warehouse['호화로운 만찬'] = [];
      base.warehouse['풍요로운 만찬'].forEach(d => {
        if (d) d.type = '호화로운 만찬';
        base.warehouse['호화로운 만찬'].push(d);
      });
      delete base.warehouse['풍요로운 만찬'];
    }
    if (base.difficulty === 'dokura') {
      for (const b of (base.buildings || [])) {
        if (!b || (b.type !== 'warehouse' && b.type !== 'largewarehouse')) continue;
        if (!b.inventory || typeof b.inventory !== 'object') b.inventory = {};
        b.storageLevel = Math.max(0, Math.floor(b.storageLevel || 0));
        for (const type of Object.keys(b.inventory)) {
          const list = Array.isArray(b.inventory[type]) ? b.inventory[type].filter(Boolean) : [];
          // amount 스택 보존(개별 폭발 금지). 합치기는 factory.compactWarehouses가 처리.
          for (const data of list) {
            data.amount = Math.max(1, Math.floor(data.amount || 1));
            if (data.id == null) data.id = base.nextId++;
            if (!data.stats || typeof data.stats !== 'object') data.stats = { 크기: 0 };
          }
          b.inventory[type] = list;
        }
      }
    }
    normalizeWalls(base);
    normalizeCreatureStats(base);
    base.selection = [];
    base.overlay = null;
    return base;
  }

  // 벽: 레거시 세이브의 true=가득 → HP 값으로 변환. 잘못된 값은 제거.
  function normalizeWalls(base) {
    const max = ((C && C.WALL_HP) || 50) * Math.pow(2, Math.max(0, base.wallLevel || 0));
    const walls = base.walls;
    if (!walls || typeof walls !== 'object') { base.walls = {}; return; }
    for (const k in walls) {
      const v = walls[k];
      if (v === true) walls[k] = max;
      else if (typeof v === 'number' && v > 0) walls[k] = Math.min(max, v);
      else delete walls[k];
    }
    const doors = base.doors;
    if (!doors || typeof doors !== 'object') { base.doors = {}; return; }
    for (const k in doors) {
      const d = doors[k];
      if (!d || typeof d !== 'object') { delete doors[k]; continue; }
      d.hp = d.hp == null ? max : Math.min(max, Math.max(1, +d.hp || 0));
    }
  }

  function normalizeCreatureStats(root) {
    const sizeMax = (C && C.SIZE_MAX) || 50;
    const statMax = (C && C.STAT_MAX) || 200;
    const seen = new Set();
    function visit(v) {
      if (!v || typeof v !== 'object' || seen.has(v)) return;
      seen.add(v);
      if (v.type && G.CREATURES && G.CREATURES[v.type] && v.stats) {
        v.stats.육질 = Math.max(0, Math.min(statMax, Math.floor(v.stats.육질 || 0)));
        v.stats.개념 = Math.max(0, Math.min(statMax, Math.floor(v.stats.개념 || 0)));
        v.stats.크기 = Math.max(1, Math.min(sizeMax, Math.floor(v.stats.크기 || 1)));
        v.growth = 0;
      }
      if (Array.isArray(v)) v.forEach(visit);
      else Object.keys(v).forEach(k => visit(v[k]));
    }
    visit(root);
  }

  function replaceState(next) {
    const normalized = normalizeState(next);
    Object.keys(G.State).forEach(k => delete G.State[k]);
    Object.assign(G.State, normalized);
    if (G.Assets) {
      if (G.Assets.setBgmVolume) G.Assets.setBgmVolume(G.State.audio.bgm);
      if (G.Assets.setSfxVolume) G.Assets.setSfxVolume(G.State.audio.sfx);
    }
  }

  G.createFreshState = freshState;
  G.resetRuntimeState = function (opts) { replaceState(freshState(opts)); };
  G.applySavedState = replaceState;

  G.State = freshState();

  G.uid = function () { return G.State.nextId++; };
  G.EndingRecords = (function () {
    const KEY = 'siljang_factory_endings_v1';
    function get() {
      try { return Object.assign({}, JSON.parse(localStorage.getItem(KEY) || '{}')); }
      catch (e) { return {}; }
    }
    function unlock(id) {
      const records = get();
      records[id] = { unlocked: true, at: Date.now() };
      localStorage.setItem(KEY, JSON.stringify(records));
      return records;
    }
    return { get, unlock };
  })();

  G.Save = (function () {
    const KEY = 'siljang_factory_save_v1';          // 자동저장(게임 시작 시 자동 로드)
    const SLOTS = 4;
    let lastError = '';
    function slotKey(n) { return KEY + '_slot' + n; }
    function metaKey(key) { return key + '_meta'; }
    function fail(message, e) {
      lastError = message || '저장 처리 실패';
      if (e && console && console.warn) console.warn('[Save]', lastError, e);
      return false;
    }

    const SAVE_RUNTIME_KEYS = new Set([
      '_vitalInfo', '_feedType', '_fedRatio', '_feedSource', '_feedMult',
      '_claim', '_path', '_pathGoal', '_pathRetry', '_tgt', '_dead',
      'speech', 'speechT', 'speechTone',
    ]);
    function stripRuntimeFields(v) {
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v)) { v.forEach(stripRuntimeFields); return; }
      for (const k of Object.keys(v)) {
        if (SAVE_RUNTIME_KEYS.has(k)) { delete v[k]; continue; }
        stripRuntimeFields(v[k]);
      }
    }
    function stateForSave() {
      const s = clone(G.State);
      stripRuntimeFields(s);
      s.produceLog = [];
      s.particles = [];
      s.selection = [];
      return s;
    }
    function payload() {
      return {
        version: 1,
        savedAt: Date.now(),
        state: stateForSave(),
        factoryRuntime: G.Factory && G.Factory.exportRuntimeState ? G.Factory.exportRuntimeState() : null,
      };
    }
    const LZ_PREFIX = 'LZv1:';
    function encode(obj) {
      const json = JSON.stringify(obj);
      if (G.LZ && G.LZ.compressToUTF16) {
        const c = G.LZ.compressToUTF16(json);
        if (c && c.length < json.length) return LZ_PREFIX + c;  // 압축이 실제로 작을 때만
      }
      return json;
    }
    function decode(raw) {
      if (raw == null) return null;
      if (raw.slice(0, LZ_PREFIX.length) === LZ_PREFIX) {
        if (!(G.LZ && G.LZ.decompressFromUTF16)) throw new Error('압축 해제 모듈 없음');
        return JSON.parse(G.LZ.decompressFromUTF16(raw.slice(LZ_PREFIX.length)));
      }
      return JSON.parse(raw);  // 구버전 평문 JSON 호환
    }
    function saveTo(key, force) {
      if (G.State.endingSaveLocked && !force) return fail('엔딩 선택 이후에는 저장할 수 없습니다.');
      try {
        lastError = '';
        const data = payload();
        localStorage.setItem(key, encode(data));
        localStorage.setItem(metaKey(key), JSON.stringify({ savedAt: data.savedAt }));
        return true;
      } catch (e) {
        return fail(e && e.name === 'QuotaExceededError' ? '저장 공간 부족' : '저장 실패', e);
      }
    }
    function loadFrom(key, silent) {
      try {
        lastError = '';
        const raw = localStorage.getItem(key);
        if (!raw) return fail('저장 슬롯 없음');
        const data = decode(raw);
        G.applySavedState(data.state || data);
        if (G.Factory && G.Factory.importRuntimeState) G.Factory.importRuntimeState(data.factoryRuntime || data.factory || null);
        if (!silent) {
          if (G.Factory && G.Factory.reloadState) G.Factory.reloadState();
          if (G.UI && G.UI.afterStateLoad) G.UI.afterStateLoad();
        }
        return true;
      } catch (e) {
        return fail('로드 실패', e);
      }
    }
    function savedAtOf(key) {
      try {
        const meta = JSON.parse(localStorage.getItem(metaKey(key)) || 'null');
        if (meta && meta.savedAt) return meta.savedAt;
      } catch (e) {}
      return null;
    }

    // 자동저장 API (기존 호환)
    function save() { return saveTo(KEY); }
    function load(silent) { return loadFrom(KEY, silent); }
    function hasSave() { return !!localStorage.getItem(KEY); }
    function savedAt() { return savedAtOf(KEY); }
    function reset(opts) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(metaKey(KEY));
      G.resetRuntimeState(opts || {});
      if (G.Factory && G.Factory.importRuntimeState) G.Factory.importRuntimeState(null);
      if (G.Factory && G.Factory.reloadState) G.Factory.reloadState({ setupStart: true });
      if (G.UI && G.UI.afterStateLoad) G.UI.afterStateLoad();
      return true;
    }

    // 슬롯 API (옵션창에서 수동 저장/로드). 슬롯 저장 시 자동저장에도 반영.
    function saveSlot(n) { const ok = saveTo(slotKey(n)); if (ok && G.State.autoSave !== false) saveTo(KEY); return ok; }
    function loadSlot(n) { return loadFrom(slotKey(n), false); }
    function hasSlot(n) { return !!localStorage.getItem(slotKey(n)); }
    function slotSavedAt(n) { return savedAtOf(slotKey(n)); }
    function slotCount() { return SLOTS; }
    function error() { return lastError; }

    // 파일로 내보내기/불러오기 (디스크에 직접 저장 — 용량 제한 없음)
    function exportFile() {
      if (G.State.endingSaveLocked) return fail('엔딩 선택 이후에는 저장 파일을 만들 수 없습니다.');
      try {
        lastError = '';
        const data = encode(payload());
        const compressed = data.slice(0, LZ_PREFIX.length) === LZ_PREFIX;
        const blob = new Blob([data], { type: compressed ? 'text/plain' : 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date();
        const p2 = n => ('0' + n).slice(-2);
        const ts = '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
        a.href = url;
        a.download = 'siljang_save_' + ts + (compressed ? '.sjz' : '.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      } catch (e) { return fail('파일 내보내기 실패', e); }
    }
    function saveEndingCheckpoint() {
      if (G.State.endingSaveLocked) return true;
      const ok = saveTo(KEY, true);
      if (ok) G.State.endingSaveLocked = true;
      return ok;
    }
    function unlockEndingSaves() { G.State.endingSaveLocked = false; }
    function importFile(file, cb) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          lastError = '';
          const raw = String(reader.result || '');
          const data = raw.slice(0, LZ_PREFIX.length) === LZ_PREFIX ? decode(raw) : JSON.parse(raw);
          G.applySavedState(data.state || data);
          if (G.Factory && G.Factory.importRuntimeState) G.Factory.importRuntimeState(data.factoryRuntime || data.factory || null);
          if (G.Factory && G.Factory.reloadState) G.Factory.reloadState();
          if (G.UI && G.UI.afterStateLoad) G.UI.afterStateLoad();
          saveTo(KEY);  // 불러온 상태를 자동저장에도 반영
          if (cb) cb(true);
        } catch (e) { fail('파일 불러오기 실패', e); if (cb) cb(false); }
      };
      reader.onerror = function () { fail('파일 읽기 실패', reader.error); if (cb) cb(false); };
      reader.readAsText(file);
    }

    return { save, load, reset, hasSave, savedAt, saveSlot, loadSlot, hasSlot, slotSavedAt, slotCount, error, exportFile, importFile, saveEndingCheckpoint, unlockEndingSaves };
  })();
})();
