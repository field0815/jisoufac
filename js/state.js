/* =========================================================================
 * state.js  —  전역 게임 상태
 * ========================================================================= */
window.G = window.G || {};

(function () {
  const C = G.CONFIG;

  // 가격 계수 깊은 복사 (런타임에 통계창에서 수정)
  const prices = JSON.parse(JSON.stringify(G.PRICE_DEFAULTS));

  G.State = {
    money: C.START_MONEY,

    // 공원
    park: [],
    parkItems: [],    // 공원에 설치한 아이템 {id,type,x,y}
    parkSpawnTimer: 0,
    captureProgress: 0,
    autoCapture: false,
    autoCaptureTimer: 0,

    // 자원 (실장석은 이제 우리(펜) 건물 안 또는 배회 상태로만 존재)
    food: 0,          // 실장푸드 재고(사료)
    unchi: 0,         // 운치 재고
    seasoning: 0,     // 조미료 재고(조리실 재료)
    seasoningPrice: C.SEASONING_BASE, // 조미료 현재가(1분마다 변동)
    seasoningTimer: 0,
    foodDemandPerMin: 0,
    unchiPerMin: 0,
    penSeq: 0,        // 우리 이름 번호 카운터
    upgrades: { 애호파: 0, 학대파: 0, 기초교육: 0, 필라테스: 0, 실장푸드뿌리기: 0 }, // 공원 업그레이드 레벨

    // 공장
    buildings: [],    // 펜(우리)도 buildings에 포함: {type:'penbox', creatures:[]}
    walls: {},        // 셀 경계 벽: 'V|X|R'(수직선 x=X,행R) / 'H|C|Y'(수평선 y=Y,열C) → true
    cargo: [],
    wanderers: [],    // 배회하는 생물 {data, gx, gy, vx, vy, t, flee}
    particles: [],    // 파티클 {x,y,vx,vy,life,max,color}
    stains: [],       // 바닥 자국 {x,y,dots:[{dx,dy,r,color}]}
    selection: [],    // 선택된 건물 id 목록
    ownedLand: {},    // 구매한 외부 40x40 그리드: "gx|gy" -> true
    landBought: 0,

    // 창고/판매
    warehouse: {},    // 생산품명 -> [data,...] 재고(판매 대기)
    autoSell: {},     // 생산품명 -> true (입고 즉시 자동 판매)
    sold: {},         // 생산품명 -> 누적 판매 수
    soldValue: 0,     // 누적 매출
    produceLog: [],   // 판매 시각 기록 (분당 판매량)

    // 가격
    prices,

    nextId: 1,
    screen: 'factory',   // 베이스 화면: 'park' | 'factory'
    overlay: null,       // 오버레이: null | 'pen' | 'research' | 'stats'
  };

  G.uid = function () { return G.State.nextId++; };
})();
