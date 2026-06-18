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
    linggal: true,    // 링갈 ON/OFF — OFF면 실장석이 단순 대사만 함

    // 퀘스트(무전)
    quests: [],          // 활성 퀘스트 {id, org, item, n, stat, accepted, rewardText, reward}
    questTimer: 0,       // 다음 퀘스트 생성까지 누적 시간
    openingDone: false,  // 새 게임 시작 인트로 연출 완료 여부
    introDone: false,    // 세계관 인트로 + 첫 퀘스트 발생 여부(콜로니 T1 트리거)
    researchBonus: 0,    // 위석연구소 보상: 영구 연구력 가산
    powerBonus: 0,       // 낙원컬트/위석연구소 보상: 영구 전력 가산

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
    researchProgress: 0,      // 현재 연구 누적 연구력
    researchProgressBank: {}, // 취소한 진행 중 연구의 저장 진행도: "key|level" -> progress
    colonyTier: 0,    // 콜로니 센터 티어(0~3)
    colonyUpgrade: null,  // 진행 중인 티어 승급: { target, remain, total } 또는 null

    // 공장
    buildings: [],    // 펜(우리)도 buildings에 포함: {type:'penbox', creatures:[]}
    walls: {},        // 셀 경계 벽: 'V|X|R' / 'H|C|Y' → 남은 HP(숫자)
    wallLevel: 0,     // 벽 업그레이드 레벨(0~20) — 최대 체력 = WALL_HP × 2^레벨
    doors: {},        // 셀 경계 문: 'V|X|R' / 'H|C|Y' → 문 그룹 id. 노동석만 통과, 적은 막힘
    cargo: [],
    wanderers: [],    // 배회하는 생물 {data, gx, gy, vx, vy, t, flee}
    particles: [],    // 파티클 {x,y,vx,vy,life,max,color}
    stains: [],       // 바닥 자국 {x,y,dots:[{dx,dy,r,color}]}
    selection: [],    // 선택된 건물 id 목록
    ownedLand: {},    // 구매한 외부 40x40 그리드: "gx|gy" -> true
    landBought: 0,
    ruins: [],        // 채취 가능한 유적/폐허/잔해 {id,type,col,row,w,h,scrap}
    ruinGrids: {},    // 유적 생성 완료 그리드

    // 창고/판매
    warehouse: {},    // 생산품명 -> [data,...] 재고(판매 대기)
    autoSell: {},     // 생산품명 -> true (입고 즉시 자동 판매)
    sold: {},         // 생산품명 -> 누적 판매 수
    soldValueByType: {}, // 생산품명 -> 누적 판매액
    soldValue: 0,     // 누적 매출
    produceLog: [],   // 판매 시각 기록 (분당 판매량)

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
    Object.keys(saved).forEach(k => {
      if (k in base) base[k] = saved[k];
    });
    base.prices = Object.assign(clone(G.PRICE_DEFAULTS), base.prices || {});
    if (base.prices.사육실장 && base.prices.사육실장.크기역 != null) base.prices.사육실장 = clone(G.PRICE_DEFAULTS.사육실장);
    base.upgrades = Object.assign(freshState().upgrades, base.upgrades || {});
    if (!Array.isArray(base.researchQueue)) base.researchQueue = [];
    if (!base.currentResearch || typeof base.currentResearch !== 'object') base.currentResearch = null;
    base.researchProgress = Math.max(0, base.researchProgress || 0);
    if (!base.researchProgressBank || typeof base.researchProgressBank !== 'object') base.researchProgressBank = {};
    base.colonyTier = Math.max(0, Math.min(3, Math.floor(base.colonyTier || 0)));
    if (base.colonyUpgrade && typeof base.colonyUpgrade === 'object') {
      const cu = base.colonyUpgrade;
      const target = Math.max(1, Math.min(3, Math.floor(cu.target || 0)));
      const total = +cu.total > 0 ? +cu.total : 60;
      const remain = Math.max(0, Math.min(total, +cu.remain || 0));
      base.colonyUpgrade = target ? { target, remain, total } : null;
    } else { base.colonyUpgrade = null; }
    base.powerUsed = Math.max(0, base.powerUsed || 0);
    if (!base.soldValueByType || typeof base.soldValueByType !== 'object') base.soldValueByType = {};
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
    if (typeof base.linggal !== 'boolean') base.linggal = true;
    base.umaiFood = Math.max(0, base.umaiFood || 0);
    base.dietFood = Math.max(0, base.dietFood || 0);
    if (!Array.isArray(base.quests)) base.quests = [];
    base.questTimer = base.questTimer || 0;
    base.openingDone = !!base.openingDone;
    base.introDone = !!base.introDone;
    base.researchBonus = Math.max(0, base.researchBonus || 0);
    base.powerBonus = Math.max(0, base.powerBonus || 0);
    base.unchi = Math.min(C.UNCHI_MAX || 100000, Math.max(0, base.unchi || 0));
    if (!base.doors || typeof base.doors !== 'object') base.doors = {};
    if (!Array.isArray(base.ruins)) base.ruins = [];
    if (!base.ruinGrids || typeof base.ruinGrids !== 'object') base.ruinGrids = {};
    normalizeWalls(base);
    normalizeCreatureStats(base);
    base.selection = [];
    base.overlay = null;
    return base;
  }

  // 벽: 레거시 세이브의 true=가득 → HP 값으로 변환. 잘못된 값은 제거.
  function normalizeWalls(base) {
    const max = (C && C.WALL_HP) || 50;
    const walls = base.walls;
    if (!walls || typeof walls !== 'object') { base.walls = {}; return; }
    for (const k in walls) {
      const v = walls[k];
      if (v === true) walls[k] = max;
      else if (typeof v === 'number' && v > 0) walls[k] = Math.min(max, v);
      else delete walls[k];
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

  G.Save = (function () {
    const KEY = 'siljang_factory_save_v1';          // 자동저장(게임 시작 시 자동 로드)
    const SLOTS = 4;
    let lastError = '';
    function slotKey(n) { return KEY + '_slot' + n; }
    function fail(message, e) {
      lastError = message || '저장 처리 실패';
      if (e && console && console.warn) console.warn('[Save]', lastError, e);
      return false;
    }

    function payload() {
      return {
        version: 1,
        savedAt: Date.now(),
        state: clone(G.State),
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
    function saveTo(key) {
      try {
        lastError = '';
        localStorage.setItem(key, encode(payload()));
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
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try { return decode(raw).savedAt || null; } catch (e) { return null; }
    }

    // 자동저장 API (기존 호환)
    function save() { return saveTo(KEY); }
    function load(silent) { return loadFrom(KEY, silent); }
    function hasSave() { return !!localStorage.getItem(KEY); }
    function savedAt() { return savedAtOf(KEY); }
    function reset(opts) {
      localStorage.removeItem(KEY);
      G.resetRuntimeState(opts || {});
      if (G.Factory && G.Factory.importRuntimeState) G.Factory.importRuntimeState(null);
      if (G.Factory && G.Factory.reloadState) G.Factory.reloadState({ setupStart: true });
      if (G.UI && G.UI.afterStateLoad) G.UI.afterStateLoad();
      return true;
    }

    // 슬롯 API (옵션창에서 수동 저장/로드). 슬롯 저장 시 자동저장에도 반영.
    function saveSlot(n) { const ok = saveTo(slotKey(n)); if (ok) saveTo(KEY); return ok; }
    function loadSlot(n) { return loadFrom(slotKey(n), false); }
    function hasSlot(n) { return !!localStorage.getItem(slotKey(n)); }
    function slotSavedAt(n) { return savedAtOf(slotKey(n)); }
    function slotCount() { return SLOTS; }
    function error() { return lastError; }

    // 파일로 내보내기/불러오기 (디스크에 직접 저장 — 용량 제한 없음)
    function exportFile() {
      try {
        lastError = '';
        const data = JSON.stringify(payload());
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date();
        const p2 = n => ('0' + n).slice(-2);
        const ts = '' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '_' + p2(d.getHours()) + p2(d.getMinutes());
        a.href = url;
        a.download = 'siljang_save_' + ts + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      } catch (e) { return fail('파일 내보내기 실패', e); }
    }
    function importFile(file, cb) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          lastError = '';
          const data = JSON.parse(reader.result);
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

    return { save, load, reset, hasSave, savedAt, saveSlot, loadSlot, hasSlot, slotSavedAt, slotCount, error, exportFile, importFile };
  })();
})();
