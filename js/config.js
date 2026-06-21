/* =========================================================================
 * config.js  —  게임 전역 설정 / 정의 / 에셋 경로 매니페스트
 * -------------------------------------------------------------------------
 *  - 모든 수치(밸런스)와 에셋 경로를 이 파일에 모았습니다.
 *  - 그래픽/효과음은 assets/ 폴더에 "파일만 넣으면" 자동 적용됩니다.
 * ========================================================================= */
window.G = window.G || {};

G.CONFIG = {
  GAME_W: 1440,
  GAME_H: 960,

  CELL: 48,            // 그리드 한 칸 크기(px)
  GRID_COLS: 624,    // 공장 전체 가로 칸 수 (대형 필드)
  GRID_ROWS: 624,   // 공장 전체 세로 칸 수
  GIVEN_COLS: 48,     // 시작 시 주어지는 영역(정중앙)
  GIVEN_ROWS: 48,
  LAND_GRID_SIZE: 48,  // 시작 필드 바깥 토지 구매 단위
  RUIN_CLEARANCE_BY_TYPE: { debris: 0, wreck: 64, ruin: 96 }, // 시작 그리드 끝에서 자원 오브젝트가 나오기 시작하는 최소 거리(타일)
  LAND_BASE_COST: 1000,
  LAND_COST_STEPS: [1000, 5000, 10000],
  LAND_COST_MULT: 2,
  LAND_DISTANCE_COST_PER_GRID: 0.22, // 시작 지점에서 그리드 1칸 멀어질 때마다 토지가 +22%
  VIEW_W: 1440,        // 공장 캔버스(뷰포트) 픽셀 크기
  VIEW_H: 720,
  ZOOM_MIN: 0.25,
  ZOOM_MAX: 2.5,

  TOPBAR_H: 44,
  MID_H: 720,
  BOTTOM_H: 196,
  PEN_DOCK_W: 288,

  // 공원
  PARK_SPAWN_INTERVAL: 30,
  PARK_MAX: 24,
  CAPTURE_TIME: 2.0,
  AUTO_CAPTURE_TIME: 3.0,
  PARK_SPEED: 46,           // 공원 실장석 배회 속도(px/s)
  PARK_BIRTH_BASE: 0.012,   // 초당 출산 확률(아이템 미섭취)
  PARK_BIRTH_BOOST: 0.03,   // 섭취 아이템 1개당 출산 확률 가산
  PARK_BIRTH_MAX: 0.15,     // 출산 확률 상한

  // 실장석 스탯 범위 (성체)
  ADULT_STAT_MIN: 10,
  ADULT_STAT_MAX: 50,
  STAT_MAX: 999,
  SIZE_MAX: 50,
  BREED_VARIANCE: 10,
  BREED_UP_CHANCE_BY_GRADE: [1, 0.8, 0.55, 0.3, 0.12],
  BREED_UP_MULT_BY_GRADE: [1, 0.7, 0.4, 0.2, 0.1],
  HAPPY_CIRCUIT_HP_DRAIN: 8,

  // 탄생 직후 크기 범위와 크기 기반 진화
  SIZE_BIRTH_RANGE: {
    점액덩어리: [1, 5], 구더기: [1, 5], 엄지: [1, 5],
    자실장: [10, 20], 성체실장: [30, 50],
    새끼사육실장: [10, 20], 사육실장: [30, 50],
    새끼독라: [10, 20], 독라: [30, 50],
  },
  SIZE_EVOLVE_AT: { 구더기: 5, 엄지: 10, 자실장: 30, 새끼사육실장: 30, 새끼독라: 30 },
  SIZE_GROW_TIME: 20,       // 실장푸드를 먹은 시간 20초당 크기 +1

  SLIME_TIME: 30,           // 점액덩어리 → 구더기 자동 변환(초)

  // 장치 동작 수치
  BIRTH_INTERVAL: 10,       // 출산대: 구더기 생산 주기(초) — 10초로 하향
  BIRTH_LIFESPAN: 180,
  WASH_TIME: 3,
  GRABBER_INTERVAL: 1.0,
  BELT_SPEED: 1.1,
  BELT_CAP: 2,
  TUNNEL_TIME: 0.4,         // 터널 통과 시간(초)
  TUNNEL_CAP: 8,            // 터널 동시 수용
  CONSTRUCTION_TIME: { 0: 0, 1: 5, 2: 15, 3: 30 },
  WEATHER_ROLL_SEC: 60,
  WEATHER_RAIN_CHANCE: 0.20,
  WEATHER_RAIN_DURATION: 60,

  // ---- 우리(사육) 시스템 ------------------------------------------------
  PEN_ADULT_PER_CELL: 1,    // 우리 1칸당 성체 수용
  PEN_YOUNG_PER_CELL: 3,    // 우리 1칸당 새끼 수용

  // ---- 일꾼(가공기 속도) -----------------------------------------------
  WORKER_SLOTS: 3,          // 가공기당 일꾼 슬롯
  WORKER_SPEED: 0.3,        // 일꾼 1마리당 속도 +30%

  // ---- 특수 장치 -------------------------------------------------------
  TECHICA_HAPPY_RATE: 0.5,  // 매지컬 테치카: 7×7 범위 초당 행복 +0.5
  TECHICA_QUALITY_RATE: 0.1, // 매지컬 테치카: 7×7 범위 초당 육질 +0.1
  TECHICA_ATTRACT_CHANCE: 0.45, // 매지컬 테치카: 범위 내 실장석 유인 확률(초당)
  TECHICA_TALK_CHANCE: 0.04,    // 매지컬 테치카에 모인 실장석 대사 확률(초당)
  NURTURE_CHANCE: 0.35,     // (레거시) 태교 스피커 초당 스탯 +1 확률
  NURTURE_BIRTH_CHANCE: 0.5, // 태교 스피커 범위 출산대: 출산 시 육질/개념 각각 +1 확률
  SKEWER_CHANCE: 0.2,       // 꼬챙이: 초당 개념 +1 확률
  BIRTH_BOOST: 2,           // 레드 포인터: 출산 속도 배수
  FEED_GROWTH_MULT: 2,      // 사료분배기: 성장/사료 소모 배수
  FEEDER_COLLIDE_RAD: 0.42, // 사료분배기 충돌 반경(칸) — 실장석이 위에 겹치지 않음
  SPECIAL_COLLIDE_RAD: 0.42, // 꼬챙이/매지컬 테치카 충돌 반경(칸)
  FOOD_LOW_QUALITY_RECOVER: 0.1, // 실장푸드 섭취 시 육질 10 이하이면 초당 회복량
  FOOD_LOW_HAPPY_RECOVER: 0.2,   // 실장푸드 섭취 시 행복 50 이하이면 초당 회복량
  JISSO_FOOD_QUALITY_CHANCE: 0.01, // 짓소산 푸드 섭취 시 초당 육질 +1 확률(1%)
  JISSO_FOOD_HAPPY_CHANCE: 0.05,   // 짓소산 푸드 섭취 시 초당 행복 +1 확률(5%)
  FOOD_QUALITY_CHANCE: 0.005,      // 실장푸드 섭취 시 초당 육질 +1 확률
  UNCHI_HAPPY_DOWN_CHANCE: 0.04,   // 운치 섭취 시 초당 행복 -1 확률(4% — 기존 2배)
  CLEAN_HAPPY_RATE: 0.02,          // 청결한 우리(오염도<30) 초당 행복 +1 확률(=10초당 0.2)
  CLEAN_QUALITY_RATE: 0.005,       // 청결한 우리 초당 육질 +1 확률(=10초당 0.05)
  CLEAN_POLLUTION_MAX: 30,         // 이 오염도% 미만이면 '청결' 버프 적용
  UNCHI_GROWTH_MULT: 1.1,          // 운치를 먹으면 성장 속도 ×1.1
  FOOD_HP_RECOVER: 4,              // 실장푸드/짓소산 푸드 섭취 시 초당 체력 회복량
  JISSO_FOOD_PRICE: 5,             // 짓소산 푸드 판매가(개당)
  CATCH_INTERVAL: 1.0,      // 포획기: 수거 주기(초)
  CATCH_ARM_SPEED: 14,      // 포획기 집게팔 이동 속도(칸/초)
  CATCH_RANGE_PER_LV: 1,    // 포획기 범위 업그레이드 1레벨당 사방 +1칸
  CATCH_UP_COST: 800,       // 포획기 범위 업그레이드 기본 비용(×(레벨+1))
  CATCH_UP_MAX: 8,          // 포획기 범위 업그레이드 최대 레벨

  // ---- 침입 / 약탈 / 포탑 ------------------------------------------------
  WANDER_EAT_CHANCE: 0.012,     // 배회 실장석이 근처 벨트 음식을 먹을 확률(초당, 아주 가끔)
  WANDER_EAT_COOLDOWN: 25,      // 한 번 먹은 뒤 다시 먹기까지 대기(초)
  EAT_REACH: 0.9,               // 음식을 먹을 수 있는 거리(칸)
  INTRUDE_INTERVAL_MIN: 150,    // 외부 실장석 가족 리젠 간격(초) 최소
  INTRUDE_INTERVAL_MAX: 360,    //                                최대
  INTRUDE_WANDER_CAP: 80,       // 배회 개체가 이 수를 넘으면 가족 리젠 중단
  RAID_START: 1200,             // 약탈 시작 시각(게임 시작 후 초) = 20분
  RAID_INTERVAL_MIN: 600,       // 약탈 간격(초) 5분
  RAID_INTERVAL_MAX: 900,       //              10분
  RAID_BASE_COUNT: 5,           // 첫 레이드 성체 수
  RAID_COUNT_STEP: 3,           // 레이드마다 성체 수 증가
  RAID_MAX_COUNT: 50,           // 성체 수 상한(새끼 제외). 이후엔 HP만 증가
  RAID_HP_STEP: 0.15,           // 수 상한 도달 후, 레이드마다 침입 HP +15%
  RAID_DURATION: 75,            // 약탈자가 머무는 시간(초). 지나면 이탈
  RAID_EAT_MAX: 3,              // 약탈자 1마리가 먹고 떠나는 음식 수
  RAID_SPAWN_MIN_DIST: 20,      // 플레이어 소유 그리드와 최소 이격 거리(타일)
  RAID_SPAWN_INTERVAL: 0.35,    // 레이드 개체 순차 등장 간격(초)
  RAID_SPAWN_SPREAD: 5,         // 레이드 등장 지점 주변 분산 폭(타일)

  // ---- 외부 침입 단계(0~4) — 소유한 그리드 수에 비례해 강해짐 ---------------
  //  소유 그리드 1개=0단계, 2개=1단계, 4개=2단계, 7개=3단계, 10개=4단계
  //  (소유 그리드 = 시작 필드 1 + 구매한 외부 그리드 수)
  INVADE_GRID_THRESHOLDS: [2, 4, 7, 10], // 소유 그리드가 이 수에 도달할 때마다 단계 +1
  INVADE_STAT_PER_LV: 18,       // 단계당 육질/개념/크기 보너스
  INVADE_HP_PER_LV: 50,         // 단계당 추가 HP
  INVADE_REACH: 0.9,            // 침입 실장석이 새끼/화물을 덮치는 거리(칸)
  INVADE_EAT_MAX: 6,            // 침입 1마리가 먹어치우고 떠나는 수
  INVADE_ATK: 12,              // 침입 실장석이 우리 안 실장석을 공격하는 피해
  INVADE_ATK_INTERVAL: 0.8,    // 우리 안 실장석 공격 간격(초)
  INVADE_BABY_MIN: 1,           // 0단계 성체에 동행하는 새끼 수
  INVADE_BABY_MAX: 3,

  TURRET_INTERVAL: 0.8,         // 자동 포탑 기본 발사 주기(초)
  TURRET_DMG: 20,               // 기본 공격력
  TURRET_RANGE: 8,            // 기본 사거리(칸, 반경)
  TURRET_DMG_PER_LV: 8,         // 공격력 업그레이드 1레벨당 +
  TURRET_BULLET_DMG_PER_LV: 10, // 총알 개조 1레벨당 모든 터렛 공격력 +
  TURRET_RATE_PER_LV: 0.15,     // 연사 1레벨당 발사속도 +15%
  TURRET_RANGE_PER_LV: 0.75,    // 사거리 1레벨당 +0.75칸
  TURRET_HP_BASE: 10,           // 실장석 HP = 기본 + 크기
  TURRET_TURN_SPEED: 9,         // 포신 조준 회전 속도(rad/s)
  TURRET_IDLE_SPIN: 0.7,        // 적 없을 때 느린 회전 속도(rad/s)

  // ---- 저격 터렛(방어 탭) — 자동 포탑 대비 데미지 2배·사거리 3배·발사 3배 느림 ----
  SNIPER_DMG: 40,               // 기본 공격력(=TURRET_DMG×2)
  SNIPER_RANGE: 17,           // 기본 사거리(=TURRET_RANGE×3)
  SNIPER_INTERVAL: 3.6,         // 기본 발사 주기(=TURRET_INTERVAL×3)

  MORTAR_DMG: 120,              // 박격포 기본 광역 피해
  MORTAR_RANGE: 21,             // 박격포 사거리(칸)
  MORTAR_INTERVAL: 5,           // 박격포 발사 주기(초)
  MORTAR_RADIUS: 1.5,           // 착탄 피해 반경(3타일 지름)
  MORTAR_SHELL_TIME: 0.9,       // 포탄 비행 시간(초)
  MAGGOT_MISSILE_RANGE: 144,
  MAGGOT_MISSILE_TIME: 3,
  MAGGOT_MISSILE_RADIUS: 3.5,
  MAGGOT_MISSILE_DMG: 480,
  CHAOS_BARREL_RANGE_PER_LV: 0.05,
  CHAOS_MAG_RATE_PER_LV: 0.05,
  CHAOS_TURRET_DMG: 70,         // 카오스 포탑 첫 대상 피해
  CHAOS_TURRET_INTERVAL: 1.8,
  CHAOS_TURRET_RANGE: 12,
  CHAOS_TURRET_CHAIN_RANGE: 5,
  CHAOS_TURRET_CHAIN_BASE: 3,
  CHAOS_TURRET_CHAIN_MAX: 8,
  MINE_DMG: 120,                // 지뢰 폭발 피해
  MINE_RADIUS: 2.5,             // 지뢰 피해 반경(5타일 지름)

  // ---- 벽 / 침입 전투 -------------------------------------------------
  WALL_HP: 50,                  // 벽 1칸 기본 체력(레벨 0)
  INVADE_WALL_DMG: 8,           // 침입자가 벽을 가로막힐 때 초당 입히는 피해
  WALL_UP_MAX: 20,              // 벽 업그레이드 최대 레벨
  WALL_UP_COST_MULT: 2,         // 벽 업그레이드 1레벨당 비용 배수(벽 가격×2^레벨)
  DEFENSE_DANGER_RANGE: 18,     // 방어 건물은 침입 실장석 주변 이 반경 안에 설치 불가(칸)
  // 레벨 n 벽 최대 체력 = WALL_HP × 2^n, 업그레이드 비용 = 벽 가격 × 2^(레벨+1)

  // ---- 짓소산 생성기(행복 기반) --------------------------------------
  ACID_HAPPY_DRAIN: 5,          // 짓소산 생성기: 초당 행복 감소량
  ACID_HAPPY_PER_ACID: 5,       // 행복 5 감소마다 짓소산 1개 생성

  // ---- 공원 포획 상자 --------------------------------------------------
  CAPTURE_BOX_COST: 600,        // 추가 포획 상자 1개 가격
  CAPTURE_BOX_MAX: 5,           // 최대 상자 수(기본1 + 추가4)

  // ---- 노동석 (교화소 산출, 명령 수행 독라) -------------------------------
  LABOR_REFORM_TIME: 10,         // 교화 시간(초)
  LABOR_ATK: 8,                 // 방어 모드 공격력
  LABOR_ATK_INTERVAL: 1.0,      // 공격 간격(초)
  LABOR_ATK_RANGE: 1.1,         // 공격 거리(칸)
  LABOR_SIGHT: 60,              // 회수/방어 목표 탐색 반경(칸)
  LABOR_REACH: 1.0,             // 화물/실장석 줍는 거리(칸) — 충돌분리 최대거리(0.92)보다 커야 함
  LABOR_MAX: 50,                // 동시에 운용 가능한 노동석 최대 수
  LABOR_PER_REFORMER: 10,       // 노동교화소 1개당 노동석 상한
  REFORMER_MAX: 10,             // 노동교화소 최대 건설 수
  LAB_SLOTS: 8,                 // 연구소 장착 슬롯
  LAB_HP_DRAIN: 0.01,           // 연구 중 장착 실장석 체력 소모량(초당=10초당 0.1)
  LAB_UP_MONEY: 1000,           // 연구소 개별 업그레이드 기본 비용
  LAB_UP_PARTS: 1,              // 연구소 개별 업그레이드 기본 전자부품 비용
  LAB_UP_MULT: 1.3,             // 연구소 업그레이드당 연구력/전력 배수
  RESEARCH_QUEUE_MAX: 5,        // 연구 예약 최대 수
  COLONY_UPGRADE_SEC_PER_TIER: 60,  // 콜로니 티어 승급 소요시간(초) = 목표 티어 × 이 값 (T1~T4)

  // ---- 시장 포화 (같은 제품을 많이 팔수록 단가↓, 시간이 지나면 회복) -----
  MARKET_DROP: 0.006,       // 시장지수 1당 단가 배율 변동량 (배율 = 1 - m×DROP)
  MARKET_FLOOR: 0.3,        // 단가 배율 하한 (쏟아부어도 이 비율까지만 떨어짐)
  MARKET_CEIL: 1.3,         // 단가 배율 상한 (오래 안 팔면 최대 +30%까지 상승)
  MARKET_RECOVER: 0.5,      // 초당 시장지수 회복 속도(포화 → 0으로)
  MARKET_SCARCITY_RATE: 0.1, // 초당 희소 프리미엄 누적 속도(0 → 음수로, 오래 안 팔수록 상승)
  MARKET_SCARCITY_MAX: 50,  // 희소 프리미엄 한계 (= (CEIL-1)/DROP, +30% 도달 지점)
  POWER_BOOST: 1.5,             // 전기 공급 시 가공/방어/특수 건물 효율 배수
  POWER_PLANT_RANGE: 9,         // 발전소 자체 보급 범위(타일)
  POWER_PLANT_RANGE_BY_TYPE: { chaoscharge: 10 },
  POWER_POLE_LINK: { woodpole: 14, ironpole: 24, chaospole: 48 },
  POWER_POLE_RANGE: { woodpole: 5, ironpole: 9, chaospole: 17 },
  POWER_HP_DRAIN: 0.1,          // 실장력 발전소 성체 체력 소모량(초당)
  FIRE_FUEL_TIME: {
    구더기: 10, 엄지: 10, 자실장: 30, 새끼독라: 30, 새끼사육실장: 30,
    성체실장: 60, 독라: 60, 사육실장: 60,
    운치: 10, 분쇄육: 15, 실장육: 40,
    농축운치: 30, 고농축운치: 120, 초고농축운치: 300,   // 농축 운치 연료(30초/2분/5분)
  },
  MIX_CONCENTRATE: 5,           // 배합기: 운치 5 → 농축 운치 1 (각 단계 5:1)
  CHAOS_FUEL_TIME: { 대형위석: 20, 중형위석: 10, 소형위석: 5 },
  RUIN_TYPES: {
    ruin: { name: '유적', w: 5, h: 5, base: 1, scrap: [30000, 50000], color: '#69717b' },
    wreck: { name: '폐허', w: 4, h: 4, base: 3, scrap: [2000, 3000], color: '#7a6f62' },
    debris: { name: '잔해', w: 2, h: 2, base: 7, scrap: [200, 500], color: '#87827a' },
    aquafarm: { name: '버려진 양식장', w: 3, h: 3, base: 0, scrap: [300, 300], color: '#4e8995', persistent: true, resource: '수산물', max: 300, regen: 0.1 },
  },
  WAREHOUSE_RUIN_CLEARANCE: 8,  // 창고는 잔해/폐허/유적에서 최소 이 타일 수만큼 떨어져야 설치 가능(양식장 제외)

  // ---- 거래(상점) -------------------------------------------------------
  FOOD_PRICE: 1,            // 실장푸드 1개 구매가
  BUY_ADULT: 10,            // 성체실장 초기 구매가 (살 때마다 +1)
  BUY_CHILD: 1,             // 자실장 초기 구매가 (살 때마다 +1)
  SEASONING_BASE: 30,       // 조미료 시작 가격
  SEASONING_MIN: 5,         // 조미료 최소 가격
  SEASONING_TICK: 60,       // 조미료 가격 변동 주기(초)
  SEASONING_SWING: 4,      // 조미료 가격 변동폭(±1~SWING)
  SEASONING_MAX: 200,       // 조리실 조미료 비축 최대치(조미료가 10개 묶음이라 상향)

  // ---- 매지컬 테치카 / 배경음 -------------------------------------------
  TECHICA_ZOOM_BGM: 1.3,    // 가동 중인 매지컬 테치카가 화면에 있고 줌이 이 값 이상이면 techica.mp3
  RAID_BGM_FADEOUT: 5,      // 침입 실장 전멸 후 원래 음악으로 돌아오기까지(초)

  // ---- 특수 사료(배합기 산출) ------------------------------------------
  UMAI_GROWTH_MULT: 3,      // 우마이푸드: 성장 배수
  UMAI_HAPPY_RATE: 0.3,     // 우마이푸드: 초당 행복 상승
  DIET_GROWTH_MULT: 0.5,    // 다이어트푸드: 성장 배수(둔화)
  MIX_UMAI: 50,             // 배합기: 조미료1+실장푸드50 → 우마이푸드50
  MIX_DIET: 50,             // 배합기: 철조각1+실장푸드50 → 다이어트푸드50
  SALECENTER_UP_COST: 5000, // 물류센터 업그레이드(판매가 +10%/레벨) 비용

  // ---- 포식 ------------------------------------------------------------
  EAT_CHANCE: 0.06,         // 성체가 근처 새끼를 잡아먹거나 사육실장을 공격할 확률(초당)
  EAT_RANGE: 1.1,           // 포식/공격/도망 반응 거리(칸)
  FLEE_TIME: 2.0,           // '테챠아!' 도망 지속(초)
  ATTACK_DMG: 5,            // 사육실장 공격당 육질 데미지 (0 되면 독라로 변함)

  FOOD_RATE: { 성체실장: 5, 자실장: 3, 엄지: 2, 구더기: 1, 사육실장: 5, 새끼사육실장: 3, 독라: 5, 새끼독라: 3 }, // 분당 실장푸드 소모
  UNCHI_MAX: 100000,        // 운치 자원(창고) 최대 저장량
  UNCHI_MULT: 2,            // 먹은 푸드 *2 만큼 운치 배설(우리 바닥에 누적)
  UNCHI_BUNDLE: 10,         // 운치는 10개 1묶음 단위로 집게가 추출
  PEN_UNCHI_MAX: 1000,      // (레거시) 우리 1개당 운치 누적 상한 — 이제 칸당 환산 사용
  PEN_UNCHI_PER_CELL: 110,  // 우리 1칸당 운치 수용량(오염도% 환산 기준, 3×3≈990)
  PEN_STAIN_MAX: 100,       // 우리당 녹색 얼룩 최대 수
  PEN_STAINS_PER_CELL: 4,   // 오염도 100%일 때 칸당 얼룩 수(오염도에 비례 표시)
  POLLUTION_QUALITY_DOWN: 0.06, // 오염도 100%일 때 초당 육질 -1 확률(오염도에 비례)
  UNCHI_FEED_STAT_DOWN_CHANCE: 0.08, // 운치 사료(분배기) 섭취 시 초당 육질/개념 -1 확률
  UNCHI_FEED_SIZE_UP_CHANCE: 0.20,   // 운치 사료(분배기) 섭취 시 초당 크기 +1 확률
  UNCHI_EAT_QUALITY_DOWN: 0.03,      // 사료분배기 없이 운치(똥)를 먹을 때 초당 육질 -1 확률(3%)
  CREATURE_HAPPY_MAX: 100,           // 행복 스탯 최대치
  GROWN_ADULT_NO_EAT: 30,            // 자실장→성체 진화 후 새끼를 안 잡아먹는 시간(초)
  GROW_TIME: 180,           // 구버전 저장 호환용. 진화 조건에는 더 이상 사용하지 않음.
  PET_SIZE_RATE: 0.15,      // 구버전 저장 호환용. 성체 자동 크기 증가는 사용하지 않음.
  GROWTH_NEXT: { 구더기: '엄지', 엄지: '자실장', 자실장: '성체실장', 새끼사육실장: '사육실장', 새끼독라: '독라' },

  // ---- 분쇄기 / 배합기 -------------------------------------------------
  GRIND_TARGET: 25,        // 무게 25 채우면 분쇄육 1개
  UNCHI_WEIGHT: 5,
  MIX_FOOD: 50,             // 배합기: 분쇄육1 + 운치10 → 실장푸드 50
  MIX_UNCHI: 10,           // 배합기 실장푸드 1회 산출에 필요한 운치(=1묶음)
  MIX_FOOD_NEED: 50,        // 배합기 짓소산 푸드 산출에 필요한 실장푸드 수

  // 배회 개체 속도 (칸/초): 성체 빠르고 어릴수록 느림
  WANDER_SPEED: { 성체실장: 1.6, 자실장: 1.1, 엄지: 0.8, 구더기: 0.5, 점액덩어리: 0.4, 독라: 1.5, 새끼독라: 1.0, 사육실장: 1.2, 새끼사육실장: 0.9 },
  MOVE_SCALE: 2 / 3,        // 모든 실장석 이동속도 배수
  // 표시 크기 배율(성체=1 기준): 자실장 2/3, 엄지·구더기·점액 1/2
  DISPLAY_SCALE: { 자실장: 2 / 3, 엄지: 1 / 2, 구더기: 1 / 2, 점액덩어리: 1 / 2, 새끼사육실장: 2 / 3, 새끼독라: 2 / 3 },

  // 애니메이션 (모든 에셋 4프레임)
  ANIM_FPS: 6,              // 초당 프레임(4프레임 순환)

  // 치트
  CHEAT_MONEY: 9999999,
  CHEAT_CREATURES: 10,
  START_MONEY: 10000,
  START_FOOD: 1000,         // 게임 시작 시 실장푸드 보유량
};

// 토지 환경 정의. 현재는 구매 정보와 지역 조회에만 사용하며 실제 효과는 추후 연결한다.
// scope: local=건물/우리 중심점이 해당 그리드에 있을 때, owned=하나라도 소유하면 전역 적용.
G.LAND_ENVIRONMENTS = {
  wasteland: {
    name: '황무지', icon: '◇', rarity: '일반', scope: 'local',
    buff: '없음',
    debuff: '없음',
    future: '비시작 지역에는 잔해가 일부 배치됨.',
    effects: {},
  },
  park: {
    name: '공원', icon: '♧', rarity: '보통', scope: 'local',
    buff: '이 지역 우리의 행복 회복량 증가.',
    debuff: '야생 실장석 가족 출현 빈도와 운치 발생량 증가.',
    future: '잔해 소량.',
    effects: { penHappyRecovery: 1.2, wildSpawnInterval: 0.7, penUnchi: 1.25 },
  },
  farmland: {
    name: '농지·목초지', icon: '♨', rarity: '보통', scope: 'local',
    buff: '이 지역 우리의 성장 속도와 사료 효율 증가.',
    debuff: '육질 보너스 없음.',
    future: '잔해 소량. 식물성 사료 원료 채취는 추후 추가.',
    effects: { penGrowth: 1.25, feedEfficiency: 1.2 },
  },
  powerplant: {
    name: '발전소', icon: '⚡', rarity: '희귀', scope: 'local',
    buff: '이 지역 발전소 출력과 전봇대 송전 범위 증가.',
    debuff: '이 지역 우리 실장석의 육질과 개념이 서서히 감소.',
    future: '연료가 필요한 고정 화력발전소와 풍부한 폐허.',
    effects: { powerOutput: 1.3, poleSupplyRange: 1.25, penQualityDrain: 1, penConceptDrain: 1, fixedFueledPlant: true },
  },
  downtown: {
    name: '번화가', icon: '▦', rarity: '희귀', scope: 'owned',
    buff: '소유 시 시장 시세 회복과 거래 효율 증가.',
    debuff: '야생 출현과 레이드 빈도 증가.',
    future: '폐허 풍부, 유적 1개.',
    effects: { marketRecovery: 1.5, salePrice: 1.05, wildSpawnInterval: 0.8, raidIntervalSeconds: -60 },
  },
  mudflat: {
    name: '갯벌', icon: '≈', rarity: '희귀', scope: 'local',
    buff: '이 지역 조리와 육질 관련 보너스.',
    debuff: '없음.',
    future: '버려진 양식장 3곳에서 노동석이 수산물을 채취할 수 있으며 잔해가 소량 배치됨.',
    effects: { cookingSpeed: 1.2, cookedQualityBonus: 1, laborGathering: ['수산물'] },
  },
  redzone: {
    name: '적색지대', icon: '☣', rarity: '전설', scope: 'local',
    buff: '이 지역 카오스·짓소산 효율과 위석 산출 증가.',
    debuff: '실장석과 노동석의 체력이 지속 감소하며 돌연변이 위험. 레이드와 별개인 침입 개체 출현.',
    future: '위석 채취 유적 3개와 풍부한 폐허.',
    effects: { chaosEfficiency: 1.5, acidEfficiency: 1.5, bezoarYield: 1.25, healthDrain: 1, mutation: true, ambientInvaders: true },
  },
  bunker: {
    name: '무너진 방공호', icon: '▣', rarity: '전설', scope: 'owned',
    buff: '소유 시 의뢰와 거래 보상 증가.',
    debuff: '고레벨 침입 개체가 출현하며 약탈 표적이 됨.',
    future: '철조각 대량, 고정 방어 타워, 유적 3개와 풍부한 폐허.',
    effects: { questReward: 1.2, tradeReward: 1.2, ambientInvaders: true, ambientInvaderLevel: 5, fixedDefenseTowers: true },
  },
};

/* ---- 방향 정의 (0:상 1:우 2:하 3:좌) ------------------------------------ */
G.DIR = {
  vec: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
  name: ['상', '우', '하', '좌'],
};

/* ---- 실장석 종류 ------------------------------------------------------- */
G.CREATURES = {
  성체실장:     { img: 'adult.png',       color: '#d98a8a', label: '성체',    isAdult: true,  ai: 'predator', baby: '구더기' },
  점액덩어리:   { img: 'slime.png',       color: '#bfe3b0', label: '점액',    isAdult: false }, // 출산 직후, 30초 후 구더기
  구더기:       { img: 'maggot.png',      color: '#e8d9a0', label: '구더기',  isAdult: false },
  엄지:         { img: 'thumb.png',       color: '#c8a0e8', label: '엄지',    isAdult: false },
  자실장:       { img: 'child.png',       color: '#a0c8e8', label: '자실장',  isAdult: false },
  // 사육실장(=pet): 피동 AI(새끼 공격 안 함), 상품이지만 생물
  사육실장:     { img: 'pet_adult.png',   color: '#6ad0a0', label: '사육성체', isAdult: true,  ai: 'passive',  tag: '사육', baby: '새끼사육실장', product: true },
  새끼사육실장: { img: 'pet_child.png',   color: '#9fe0c0', label: '사육새끼', isAdult: false, tag: '사육', product: true },
  // 독라(=slave, 옛 노예석): 포식자 AI, 도축 대상
  독라:         { img: 'slave_adult.png', color: '#8a8a8a', label: '독라',    isAdult: true,  ai: 'predator', tag: '독라', baby: '새끼독라', product: true },
  새끼독라:     { img: 'slave_child.png', color: '#b0b0b0', label: '새끼독라', isAdult: false, tag: '독라', product: true },
};

/* ---- 생산품 / 자원 -----------------------------------------------------
 *  isProduct: 창고에 들어가면 즉시 판매되는 화물
 *  size: 분쇄기 무게 환산용(크기 스탯을 그대로 쓰는 화물은 useStatSize:true)
 * ----------------------------------------------------------------------- */
G.PRODUCTS = {
  실장육:   { color: '#c46', img: 'meat.png',   isProduct: true,  useStatSize: true },
  분쇄육:   { color: '#a55', img: 'minced.png', isProduct: true,  flatPrice: 150 },   // 분쇄기 산출 / 배합기 재료 (스탯 무관 개당 150)
  실장푸드: { color: '#7a4', img: 'food.png',   isProduct: false, size: 0 }, // 자원(사료)
  '짓소산 푸드': { color: '#6fd690', img: 'jisso_food.png', isProduct: false, size: 0 }, // 자원(특수 사료)
  우마이푸드: { color: '#e8b54a', img: 'umai_food.png', isProduct: false, size: 0 }, // 자원(특수 사료: 성장3배·행복+0.3/s)
  다이어트푸드: { color: '#9ad0e0', img: 'diet_food.png', isProduct: false, size: 0 }, // 자원(특수 사료: 체력 회복·성장0.5배)
  운치:     { color: '#964', img: 'unchi.png',  isProduct: false, size: 10 }, // 자원(배설물)
  농축운치:   { color: '#7a5a2a', img: 'unchi_c1.png', isProduct: false, size: 10, fuel: true, sellPrice: 10 }, // 연료(화력발전 30초)
  고농축운치: { color: '#5a3f18', img: 'unchi_c2.png', isProduct: false, size: 10, fuel: true, sellPrice: 50 }, // 연료(화력발전 2분)
  초고농축운치: { color: '#3a2710', img: 'unchi_c3.png', isProduct: false, size: 10, fuel: true, sellPrice: 100 }, // 연료(화력발전 5분)
  // 위석(도축 부산물) — 도축한 실장석 종류에 따라 크기가 다름. 분쇄기에 넣으면 조미료 산출.
  소형위석: { color: '#8fa6b2', img: 'bezoar_s.png', isProduct: false, size: 10, grindSeasoning: 1, sellPrice: 10 },
  중형위석: { color: '#6f8f9f', img: 'bezoar_m.png', isProduct: false, size: 10, grindSeasoning: 3, sellPrice: 30 },
  대형위석: { color: '#52707f', img: 'bezoar_l.png', isProduct: false, size: 10, grindSeasoning: 5, sellPrice: 50 },
  짓소산:   { color: '#6ee0b6', img: 'jisso_acid.png', isProduct: false, size: 10 },
  조미료:   { color: '#e8d37a', img: 'seasoning.png', isProduct: false, size: 0 },
  수산물:   { color: '#72b9cf', img: 'seasoning.png', isProduct: false, size: 0, sellPrice: 20 },
  철조각:   { color: '#9aa3ad', img: 'scrap.png', isProduct: true, flatPrice: 30, sellPrice: 30 }, // 화물(고철), 판매 개당 30
  전자부품: { color: '#76b8d8', img: 'eletricparts.png', isProduct: false, size: 0 },
  '카오스 구더기': { color: '#b47cff', img: 'chaosmargot.png', isProduct: false, size: 0, sellPrice: 30000 },
  '구더기 탄도미사일': { color: '#9bcf72', img: '../creatures/maggot.png', isProduct: false, size: 0 },
  콘페이토: { color: '#ff8fd8', img: 'candy_cpt.png', isProduct: false, size: 0, shopPrice: 100, sellPrice: 50 },  // 판매가=구매가/2
  도돈파:   { color: '#d69045', img: 'candy_ddp.png', isProduct: false, size: 0, shopPrice: 300, sellPrice: 150 },
  코로리:   { color: '#86c2ff', img: 'candy_cll.png', isProduct: false, size: 0, shopPrice: 500, sellPrice: 250 },
  도로리:   { color: '#bb79ff', img: 'candy_drr.png', isProduct: false, size: 0, shopPrice: 500, sellPrice: 250 },

  // 조리실 요리 (실장육보다 비싼 고급 화물, 기본가 + 재료 육질 보너스)
  꼬치훈제: { color: '#c8862a', img: 'skewer.png',  isProduct: true, flatPrice: 280, qualityPrice: true },
  통조림:   { color: '#9aa6b0', img: 'can.png',     isProduct: true, flatPrice: 320, qualityPrice: true },
  진공포장: { color: '#7aa0c0', img: 'vacuum.png',  isProduct: true, flatPrice: 300, qualityPrice: true },
  실장젓갈: { color: '#b06a6a', img: 'jeotgal.png', isProduct: true, flatPrice: 260, qualityPrice: true },
  실장무침: { color: '#c89a4a', img: 'muchim.png',  isProduct: true, flatPrice: 290, qualityPrice: true },

  // 수산물 요리 (버려진 양식장 수산물 가공) — 가격 = flatPrice + 육질 보너스(qualityPrice)에 시장 배율 적용
  '참치 통조림': { color: '#8fb6c4', img: 'recipe_tuna.png', isProduct: true, flatPrice: 500, qualityPrice: true },
  '호화로운 만찬': { color: '#d9a24a', img: 'recipe_fishfork.png', isProduct: true, flatPrice: 600, qualityPrice: true },
  해물찜: { color: '#c46a5a', img: 'recipe_fishstew.png', isProduct: true, flatPrice: 700, qualityPrice: true },
};

/* 등급: 3스탯 중 최고값 기준 */
G.GRADES = [
  { max: 50, label: '최하', color: '#9aa' },
  { max: 150, label: '하',   color: '#7c9' },
  { max: 350, label: '중',   color: '#5bf' },
  { max: 700, label: '상',   color: '#fb5' },
  { max: Infinity, label: '특상', color: '#f7a' },
];

/* ---- 가격 공식 계수 (게임 중 통계창에서 수정 가능) ---------------------- */
G.PRICE_DEFAULTS = {
  // 실장육(도축기 산출): 육질·크기 비례
  실장육:   { base: 10, 육질: 2,  크기: 2 },
  // 사육실장(우리 판매): 새끼=기본가+개념 비례, 성체=새끼 가격의 절반. 크기는 가격에 영향 없음.
  사육실장: { base: 500, 개념: 5 },
  // 독라(우리 판매): 육질·크기 비례. 새끼독라도 이 계수 사용.
  독라:     { base: 8,  육질: 2,  크기: 1 },
};

/* ---- 장치 정의 --------------------------------------------------------- */
G.DEVICES = {
  belt:      { cat: 'logistics', name: '컨베이어 벨트', w: 1, h: 1, img: 'belt.png',      color: '#5a5f6a', rotatable: true,  desc: '대량 생산의 기초. 화물 운반에 사용된다. 드래그=경로대로 꺾임.' },
  guardbelt: { cat: 'logistics', name: '가드레일 벨트', w: 1, h: 1, img: 'belt.png',      color: '#4f778a', rotatable: true, unlock: '가드레일벨트', desc: '실장석이 정체되어도 밖으로 빠져나가지 않는 벨트.' },
  crossbelt: { cat: 'logistics', name: '횡단 벨트',     w: 1, h: 1, img: 'crossbelt.png', color: '#6a6f7a', rotatable: true, unlock: '횡단벨트', desc: '드래그한 직선 방향으로 최대 5칸 떨어진 출구까지 화물을 즉시 보낸다. 출구가 막히면 입구에서 받지 않는다.' },
  sorter:    { cat: 'logistics', name: '분류기',        w: 1, h: 2, img: 'sorter.png',    color: '#7a6a3a', rotatable: true,  desc: '2칸 분배기. 화살표(앞)로 출력. 무필터=교대, 필터=지정 칸으로 배출.' },
  grabber:   { cat: 'logistics', name: '집게',          w: 3, h: 1, img: 'grabber.png',   color: '#8a5a3a', rotatable: true, powerUse: 1, desc: '화물을 집어 반대편에 배치한다. 작동 중 전력 1을 사용한다.' },
  longgrabber: { cat: 'logistics', name: '긴팔 집게',    w: 5, h: 1, img: 'grabber.png', color: '#9a6a3a', rotatable: true, unlock: '긴팔집게', tier: 1, powerUse: 1, desc: '2칸 너머의 물체를 옮긴다. 작동 중 전력 1을 사용한다.' },
  tunnel:    { cat: 'logistics', name: '구형 터널',      w: 5, h: 1, img: 'tunnel.png',    color: '#46506a', rotatable: true, unlock: '횡단벨트', desc: '기존 저장 호환용 장치.' },
  // 이미지: assets/images/devices/chaos_gate.png (192×48, 48×48 프레임 4장 가로 시트, 기본 방향 →)
  chaosgate: { cat: 'logistics', name: '카오스 게이트', w: 1, h: 1, img: 'chaos_gate.png', color: '#8b62c6', rotatable: false, unlock: '카오스게이트', tier: 3, gate: true, powerUse: 100, powerRequired: true, desc: '전력 100. 드래그 하여 입구와 출구를 동시에 설치하세요. 최대 48×48 범위, 카오스 구더기 1개 필요.' },
  warehouse: { cat: 'logistics', name: '창고',          w: 3, h: 3, img: 'warehouse.png', color: '#3a5a4a', rotatable: false, storage: 1000, desc: '어디든 연결하면 화물을 저장할 수 있다.' },

  penbox:    { cat: 'production', name: '우리',          w: 3, h: 3, img: 'penbox.png',    color: '#4a6a3a', rotatable: false, variable: true, desc: '드래그로 설치/확장. 여러 번 확장하면 비정형 가능. 1칸당 성체5/새끼10 수용. 클릭=이름. X를 누른 채 드래그하면 그 범위의 우리 칸을 철거.' },
  birthing:  { cat: 'production', name: '출산대',        w: 2, h: 2, img: 'birthing.png',  color: '#7a3a5a', rotatable: true,  desc: '성체실장이 새끼를 낳도록 돕는다.' },
  reformer:  { cat: 'production', name: '노동 교화소', w: 2, h: 2, img: 'reformer.png',  color: '#4a5a7a', rotatable: true, unlock: '노동교화소', tier: 1, powerUse: 10, powerRequired: true, accept: ['독라'],
               desc: '독라 성체 → 노동석. 클릭=명령(회수/방어/대기/채취)· 대기 시 가까운 교화소 인근에서 머묾. 노동석의 최대치는 노동교화소 수에 비례한다' },
  driller:   { cat: 'production', name: '드릴러', w: 3, h: 3, img: 'driller.png', color: '#6d665c', rotatable: false, range: { w: 17, h: 17 },
                unlock: '드릴러', tier: 2, powerUse: 60, powerRequired: true,
                desc: '전력 60. 전자부품 비용은 첫 설치 2개이며 설치할 때마다 2배가 된다. 주변 17×17 범위의 잔해·폐허·유적을 자동 채취해 최대 100개까지 내부에 쌓는다.' },
  // 이미지: assets/images/devices/large_warehouse.png (권장 192×192, 정적 1프레임)
  largewarehouse: { cat: 'production', name: '대형 비축고', w: 4, h: 4, img: 'large_warehouse.png', color: '#496b5b', rotatable: true, unlock: '대형비축고', tier: 3, warehouse: true, storage: 10000, powerUse: 80, powerRequired: true, desc: '전자부품 4개 필요. 출력 중 전력 80. 필터로 지정한 화물을 선택한 한쪽 면의 4칸에서 출력한다.' },

  washbasin:  { cat: 'processing', name: '세면대',   w: 2, h: 1, img: 'washbasin.png',  color: '#3a5a7a', rotatable: true, tier: 0, powerUse: 0, desc: '점액덩어리 세척→구더기/엄지/자실장(1/3). 구더기는 변환하지 않음. 일꾼 슬롯3.',
                worker: true, accept: ['점액덩어리'], time: 3 },
  slaughter:  { cat: 'processing', name: '도축기',   w: 3, h: 3, img: 'slaughter.png',  color: '#a23a3a', rotatable: true, tier: 0, powerUse: 10, desc: '독라/새끼독라→실장육(크기10당 1개)+위석. 구더기·엄지→소형위석, 자실장→중형위석, 성체실장→대형위석. 일꾼 슬롯3.',
                worker: true, accept: ['독라', '새끼독라', '구더기', '엄지', '자실장', '성체실장'], output: '실장육', time: 3 },
  deshell:    { cat: 'processing', name: '탈복기',   w: 4, h: 2, img: 'deshell.png',    color: '#7a7a3a', rotatable: true, tier: 0, powerUse: 10, desc: '성체실장/사육실장→독라, 자실장/새끼사육→새끼독라. 일꾼 슬롯3.',
                worker: true, accept: ['성체실장', '자실장', '사육실장', '새끼사육실장'], convert: { 성체실장: '독라', 자실장: '새끼독라', 사육실장: '독라', 새끼사육실장: '새끼독라' }, time: 4 },
  grinder:    { cat: 'processing', name: '분쇄기',   w: 2, h: 2, img: 'grinder.png',    color: '#5a5a5a', rotatable: true, tier: 0, powerUse: 10, desc: '모든 실장석·실장육→분쇄육. 소형위석→조미료1 / 중형→3 / 대형→5. (노동석은 드래그로 넣을 때만)',
                accept: ['성체실장', '자실장', '엄지', '구더기', '점액덩어리', '사육실장', '새끼사육실장', '독라', '새끼독라', '실장육', '소형위석', '중형위석', '대형위석'], output: '분쇄육', time: 0.2 },
  correction: { cat: 'processing', name: '교정시설', w: 3, h: 3, img: 'correction.png', color: '#3a7a6a', rotatable: true, unlock: '교정시설', desc: '자실장·성체실장 6마리 수용. 사육실장 성체 장착 시 개념이 높을수록 교육 효율 증가. 육질0→실장육, 개념30↑·30초↑→사육실장 계열.',
                accept: ['자실장', '성체실장'], hold: 6 },
  mixer:      { cat: 'processing', name: '배합기',   w: 2, h: 2, img: 'mixer.png',      color: '#6a4a7a', rotatable: true, unlock: '배합기', tier: 1, powerUse: 0, desc: '메뉴를 선택해 배합. 선택한 메뉴의 재료가 모이면 배합을 시작한다. 일꾼 슬롯3.',
                worker: true, accept: ['분쇄육', '운치', '짓소산', '실장푸드', '조미료', '철조각'], time: 2,
                // 메뉴(키=산출물). 조리실처럼 메뉴를 골라야 배합 시작.
                mix: {
                  실장푸드:   { out: '실장푸드',   desc: '분쇄육 1 + 운치 10' },
                  '짓소산 푸드': { out: '짓소산 푸드', desc: '짓소산 1 + 실장푸드 50' },
                  우마이푸드: { out: '우마이푸드', desc: '조미료 1 + 실장푸드 50' },
                  다이어트푸드: { out: '다이어트푸드', desc: '철조각 1 + 실장푸드 50' },
                  농축운치:   { out: '농축운치',   desc: '운치 5' },
                  고농축운치: { out: '고농축운치', desc: '농축운치 5' },
                  초고농축운치: { out: '초고농축운치', desc: '고농축운치 5' },
                } },
  cookery:    { cat: 'processing', name: '조리실',   w: 3, h: 2, img: 'cookery.png',    color: '#b5723a', rotatable: true, unlock: '조리실', tier: 1, powerUse: 0, desc: '메뉴를 선택해 조리. 선택한 메뉴의 재료가 모이면 조리를 시작한다. 일꾼 슬롯3.',
                worker: true,
                accept: ['구더기', '엄지', '분쇄육', '실장육', '짓소산', '수산물', '조미료', '콘페이토', '농축운치', '코로리', '도돈파'],
                // ing: {any:[재료들], n:개수, stat:true(품질 반영), seasoning:true(전역 조미료 비축에서 소모)}
                cook: {
                  꼬치훈제: { out: '꼬치훈제', desc: '구더기 또는 엄지 3 + 조미료 1', ing: [{ any: ['구더기', '엄지'], n: 3, stat: true }, { any: ['조미료'], n: 1, seasoning: true }] },
                  실장무침: { out: '실장무침', desc: '구더기 또는 엄지 3 + 짓소산 1', ing: [{ any: ['구더기', '엄지'], n: 3, stat: true }, { any: ['짓소산'], n: 1 }] },
                  실장젓갈: { out: '실장젓갈', desc: '분쇄육 2 + 짓소산 1', ing: [{ any: ['분쇄육'], n: 2, stat: true }, { any: ['짓소산'], n: 1 }] },
                  콘페이토: { out: '콘페이토', desc: '조미료 3', ing: [{ any: ['조미료'], n: 3, seasoning: true }] },
                  도돈파:   { out: '도돈파',   desc: '콘페이토 1 + 농축운치 1', ing: [{ any: ['콘페이토'], n: 1 }, { any: ['농축운치'], n: 1 }] },
                  코로리:   { out: '코로리',   desc: '짓소산 5', ing: [{ any: ['짓소산'], n: 5 }] },
                  도로리:   { out: '도로리',   desc: '코로리 1 + 도돈파 1', ing: [{ any: ['코로리'], n: 1 }, { any: ['도돈파'], n: 1 }] },
                  '호화로운 만찬': { out: '호화로운 만찬', desc: '수산물 1 + 실장육 1', ing: [{ any: ['수산물'], n: 1 }, { any: ['실장육'], n: 1, stat: true }] },
                  해물찜:   { out: '해물찜',   desc: '수산물 1 + 짓소산 1', ing: [{ any: ['수산물'], n: 1 }, { any: ['짓소산'], n: 1 }] },
                  '구더기 탄도미사일': { out: '구더기 탄도미사일', desc: '구더기 1 + 도돈파 1', unlock: '구더기탄도미사일', ing: [{ any: ['구더기'], n: 1 }, { any: ['도돈파'], n: 1 }] },
                },
                time: 3 },
  acidgen:    { cat: 'processing', name: '짓소산 생성기', w: 3, h: 3, img: 'acidgen.png', color: '#2f8f75', rotatable: true, unlock: '짓소산생성기', tier: 2, powerUse: 30, powerRequired: true, desc: '성체실장 1마리의 행복을 5씩 짜낸다. 행복 5가 떨어질 때마다 짓소산 1개, 행복이 0이 되면 분쇄육 1개를 만든다.',
                accept: ['성체실장'], time: 10 },

  // ---- 특수 장치 (1x1, 영향 범위 range) -------------------------------
  speaker: { cat: 'special', name: '태교 스피커', w: 1, h: 1, img: 'speaker.png', color: '#4a7ab5', rotatable: false, range: { w: 3, h: 3 }, special: 'nurture', unlock: '태교스피커', desc: '3×3 범위 안 출산대에서 태어난 실장석의 육질/개념을 확률적으로 +1.' },
  wall: { cat: 'defense', name: '벽', w: 1, h: 1, img: 'wall.png', color: '#d6a85a', rotatable: false, desc: '타일 모서리 점에서 시작해 수평/수직 직선으로 설치. 체력 50' },
  turret: { cat: 'defense', name: '자동 포탑', w: 1, h: 1, img: 'turret.PNG', color: '#b5524a', rotatable: false, special: 'turret', tier: 0, powerUse: 0, desc: '사거리 안 침입/외부 실장석을 자동 사격.' },
  sniper: { cat: 'defense', name: '저격 포탑', w: 1, h: 1, img: 'sniper.png', color: '#7a8fb5', rotatable: false, special: 'turret', sniper: true, unlock: '저격터렛', tier: 1, powerUse: 10, desc: '자동 포탑보다 느리지만 강하고 먼 거리를 쏜다. 전기가 없어도 작동하지만 전력이 끊기면 연사 속도가 절반이 된다.' },
  mine: { cat: 'defense', name: '독라지뢰', w: 1, h: 1, img: 'mine.png', color: '#5b4a38', rotatable: false, special: 'mine', unlock: '지뢰', tier: 1, powerUse: 0, desc: '침입 실장석이 밟으면 폭발해 주변 5타일 크기 원형에 피해를 준다.' },
  mortar: { cat: 'defense', name: '박격포', w: 1, h: 1, img: 'canon.png', color: '#6b6f7a', rotatable: false, special: 'turret', mortar: true, unlock: '박격포', tier: 2, powerUse: 30, powerRequired: true, desc: '전자부품 1개 필요. 5초마다 포탄을 발사해 3타일 크기 원형에 피해를 준다. 선택 후 지면을 우클릭하면 강제공격을 시작하고, 다시 우클릭하면 중단한다.' },
  // 이미지: assets/images/devices/chaos_turret.png (권장 384×96, 96×96 프레임 4장 가로 시트)
  chaosturret: { cat: 'defense', name: '카오스 포탑', w: 2, h: 2, img: 'chaos_turret.png', color: '#8a58bd', rotatable: false, special: 'turret', chaosChain: true, unlock: '카오스포탑', tier: 3, powerUse: 120, powerRequired: true, desc: '카오스 구더기 1개 필요. 최소 3마리, 최대 8마리를 체인 공격하며 다음 대상으로 넘어갈 때마다 피해가 10% 감소한다.' },
  door: { cat: 'defense', name: '문', w: 1, h: 3, img: 'door.png', color: '#a98a5a', rotatable: false, special: 'door', edgeBuilt: true, desc: '벽 위(연속 3칸)에만 설치. 설치하면 그 자리 벽이 문이 된다. 노동석만 통과 가능, 외부·침입 실장석은 막힌다. 노동석은 벽에 막히면 문을 경유해 이동.' },
  pointer: { cat: 'special', name: '레드 포인터', w: 1, h: 1, img: 'pointer.png', color: '#d23a3a', rotatable: true, range: { w: 1, h: 5 }, special: 'birth', unlock: '레드포인터', desc: '바라보는 방향 앞쪽 5칸 범위 출산대의 출산 속도 ↑(R로 방향 전환).' },
  catcher: { cat: 'special', name: '포획기', w: 1, h: 1, img: 'catcher.png', color: '#3a8a6a', rotatable: true, range: { w: 5, h: 5 }, special: 'catch', filterable: true, unlock: '포획기', tier: 2, powerUse: 15, powerRequired: true, desc: '5×5 범위 배회 실장석을 출력칸으로 모음(필터).' },
  skewer: { cat: 'special', name: '꼬챙이', w: 1, h: 1, img: 'skewer_dev.png', color: '#9a6a2a', rotatable: false, inPen: true, range: { w: 5, h: 5 }, special: 'skewer', unlock: '꼬챙이', tier: 1, powerUse: 0, desc: '우리 안에도 설치 가능. 자실장/성체실장만 올리면 고정. 1분 후 파괴. 주변 5×5 범위 개념 상승(확률).' },
  feeder: { cat: 'special', name: '사료분배기', w: 1, h: 1, img: 'feeder.png', color: '#7a8a3a', rotatable: false, inPen: true, range: { w: 5, h: 5 }, special: 'feed', desc: '우리 안에도 설치 가능. 주변 5×5 실장석에게 선택한 사료(실장푸드/짓소산 푸드/운치)를 배급한다. 실장석은 사료가 없어도 보통 속도로 성장하고, 배급받으면 성장 2배 및 사료별 효과를 받는다.' },
  techica: { cat: 'special', name: '매지컬 테치카', w: 1, h: 1, img: 'techica.png', color: '#c86ab0', rotatable: false, inPen: true, range: { w: 7, h: 7 }, special: 'techica', accept: ['새끼사육실장'], unlock: '매지컬테치카', tier: 2, powerUse: 35, powerRequired: true, desc: '우리 안에도 설치 가능(1칸). 사육실장 새끼만 장착. 주변 7×7 실장석의 행복 0.5/초·육질 0.1/초 상승 및 유인. 1분 후 장착 개체는 개념 0으로 배출.' },
  wrongchaosmargot: { cat: 'special', name: '잘못된 카오스 구더기', w: 2, h: 2, img: 'wrong_chaosmargot.png', color: '#a77bd1', rotatable: false, special: 'wrongchaosmargot', unlock: '잘못된카오스구더기', tier: 4,
                desc: '카오스 구더기 1개 필요. 운치 또는 푸드 1,000개로 프니프니 가챠를 시작하고, 본체를 10번 클릭해 아이템을 1개씩 떨어뜨린다.' },
  terrarium: { cat: 'production', name: '인공분대 인큐베이터', w: 5, h: 5, img: 'terrarium.png', color: '#66865f', rotatable: false, special: 'terrarium', unlock: '인공분대인큐베이터', tier: 4, accept: '*', powerUse: 300, powerRequired: true,
                desc: '전자부품 20개 필요. 작동 중 전력 100을 사용한다. 성체실장·사육실장 성체·독라 성체를 DNA로 소모하며, 출산대 5개 분량의 출산·성장·먹이 공급을 내부에서 자동 처리한다.' },
  lab: { cat: 'special', name: '연구소', w: 3, h: 3, img: 'lab_ready.png', color: '#5e78a8', rotatable: false, special: 'lab', accept: '*', desc: '실장석 최대 8마리 장착. 예약된 연구가 있으면 연구력을 생산한다. 전자부품으로 개별 강화할 수 있다. 연구소 설치비는 지을 때마다 2배, 4개째부터 철조각도 필요.' },
  // 콜로니 센터: 게임 시작 시 기본 배치(메뉴에 없음). 이동 가능·철거 불가·창고 기능.
  colony: { cat: 'production', name: '콜로니 센터', w: 5, h: 5, img: 'colony.png', color: '#5a6a8a', rotatable: false, colony: true, desc: '공장의 중심. 티어를 올리는데 필요하다. 창고처럼 기능하기도 한다.' },
  launchpad: { cat: 'production', name: '버려진 발사대', w: 5, h: 5, img: 'rocket_stay.png', color: '#5f6670', rotatable: false, fixed: true, desc: '인류의 마지막 탈출선. 철조각·상품·초고농축 운치와 막대한 전력을 요구한다.' },
  // 포장기: 가공 탭. 철조각을 곁들여 통조림/진공포장 가공.
  packer: { cat: 'processing', name: '포장기', w: 3, h: 3, img: 'packer.png', color: '#7b6a42', rotatable: true, unlock: '포장기', tier: 1, powerUse: 25, powerRequired: true,
            accept: ['분쇄육', '실장육', '수산물', '철조각'], time: 1.5,
            desc: '분쇄육1+철조각1→통조림1. 실장육1+철조각1→진공포장1. 수산물1+철조각1→참치 통조림1.' },
  // 물류센터: 물류 탭. 화물/실장석을 넣으면 즉시 판매(옛 포장기 역할).
  salecenter: { cat: 'logistics', name: '물류센터', w: 4, h: 4, img: 'salecenter.png', color: '#3a5a7a', rotatable: false, special: 'pack', upgradable: true, unlock: '물류센터', tier: 2, powerUse: 30, powerRequired: true, desc: '판매 가능한 화물·실장석이 들어오는 즉시 판매됨.' },
  jisoucharge: { cat: 'power', name: '실장력 발전소', w: 2, h: 2, img: 'jisoucharge.png', color: '#6a9a72', rotatable: false, tier: 0, power: 20, accept: ['성체실장'], desc: '성체실장 장착 시 초당 전력 20. 장착 개체 HP가 초당 0.1 감소, 소진 시 실장육 배출.' },
  firecharge: { cat: 'power', name: '화력 발전소', w: 3, h: 3, img: 'firecharge.png', color: '#a65a3a', rotatable: false, unlock: '화력발전소', tier: 2, power: 150, desc: '전자부품 비용은 첫 설치 1개이며 설치할 때마다 2배가 된다. 연료를 태워 초당 전력 150.' },
  chaoscharge: { cat: 'power', name: '카오스 발전소', w: 4, h: 4, img: 'chaoscharge.png', color: '#7b4faf', rotatable: false, unlock: '카오스발전소', tier: 3, power: 840, desc: '건설 시 카오스 구더기 1개가 필요하다. 위석을 연료로 쓰며, 성체실장 12마리 장착 후 시동.' },
  woodpole: { cat: 'power', name: '나무 전봇대', w: 1, h: 1, img: 'woodpole.png', color: '#9a7244', rotatable: false, tier: 0, pole: true, desc: '5×5 전력 보급, 11×11 범위 안 전력망에 연결.' },
  ironpole: { cat: 'power', name: '철 전봇대', w: 1, h: 1, img: 'ironpole.png', color: '#8c9aa6', rotatable: false, unlock: '철전봇대', tier: 2, pole: true, desc: '9×9 전력 보급, 21×21 범위 안 전력망에 연결.' },
  chaospole: { cat: 'power', name: '카오스 전봇대', w: 1, h: 1, img: 'chaospole.png', color: '#7f5cc0', rotatable: false, unlock: '카오스전봇대', tier: 3, pole: true, desc: '17×17 전력 보급, 48×48 범위 안 전력망에 연결.' },
  relic_techica: { cat: 'monument', name: '테치카 기념상', w: 1, h: 1, img: 'relic_techica.png', color: '#69b8cf', monument: true, desc: '해당 그리드 교정시설의 개념 추가 상승 확률 +10%.' },
  relic_arts: { cat: 'monument', name: '튼튼한 똥벌레상', w: 1, h: 1, img: 'relic_arts.png', color: '#8eb35d', monument: true, desc: '해당 그리드 우리 실장석 성장 속도 +10%.' },
  relic_slave: { cat: 'monument', name: '노동은 노동을 낳는다상', w: 1, h: 1, img: 'relic_slave.png', color: '#ba9b62', monument: true, desc: '해당 그리드 노동석 효율 +15%.' },
  relic_sister: { cat: 'monument', name: '사이좋은 자매상', w: 1, h: 1, img: 'relic_sister.png', color: '#db8094', monument: true, desc: '해당 그리드 우리 실장석 육질 추가 상승 확률 +10%.' },
  relic_dainagon: { cat: 'monument', name: '실장 다이나곤상', w: 1, h: 1, img: 'relic_dainagon.png', color: '#d4aa42', monument: true, desc: '해당 그리드 제품 추가 생산 확률 +10%.' },
  relic_bigmargot: { cat: 'monument', name: '거대구더기상', w: 1, h: 1, img: 'relic_bigmargot.png', color: '#a977c9', monument: true, desc: '해당 그리드 카오스 구더기 발굴 확률 +0.05%.' },
  relic_home: { cat: 'monument', name: '그리운 나의집상', w: 1, h: 1, img: 'relic_home.png', color: '#73a6cf', monument: true, desc: '해당 그리드 발전소 출력 +10%.' },
  relic_candy: { cat: 'monument', name: '콘페이토상', w: 1, h: 1, img: 'relic_candy.png', color: '#f0c65c', monument: true, animated4: true, desc: '해당 그리드 상품 생산속도 +10%.' },
  relic_margot: { cat: 'monument', name: '프니프니상', w: 1, h: 1, img: 'relic_margot.png', color: '#9bc36a', monument: true, animated4: true, desc: '해당 그리드 우리 운치 생산량 +20%.' },
};

G.BUILD_COST = {
  belt: 10,
  guardbelt: 50,
  crossbelt: 50,
  tunnel: 100,
  sorter: 20,
  grabber: 30,
  longgrabber: 60,
  warehouse: 500,
  largewarehouse: 20000,
  driller: 30000,
  penboxCell: 30,
  birthing: 200,
  reformer: 800,
  washbasin: 100,
  slaughter: 500,
  deshell: 300,
  grinder: 500,
  correction: 1000,
  mixer: 500,
  cookery: 2000,
  acidgen: 5000,
  speaker: 1000,
  pointer: 2000,
  catcher: 2000,
  skewer: 3000,
  feeder: 500,
  techica: 4000,
  wrongchaosmargot: 100000,
  terrarium: 150000,
  lab: 500,
  salecenter: 3000,
  turret: 1000,
  sniper: 2500,
  mine: 200,
  mortar: 10000,
  chaosturret: 30000,
  packer: 3000,
  wall: 100,
  door: 500,
  jisoucharge: 100,
  firecharge: 2000,
  chaoscharge: 10000,
  woodpole: 100,
  ironpole: 500,
  chaospole: 2000,
  chaosgate: 15000,
  relic_techica: 0, relic_arts: 0, relic_slave: 0, relic_sister: 0, relic_dainagon: 0,
  relic_bigmargot: 0, relic_home: 0, relic_candy: 0, relic_margot: 0,
};

/* ---- 공원 설치 아이템 (실장석이 가져가면 출산 확률 ↑) ------------------ */
G.PARK_ITEMS = {
  박스:     { cost: 30, label: '📦 박스', color: '#b9844a' },
  실장푸드: { cost: 10, label: '🥩 실장푸드', color: '#7a4' },
  물병:     { cost: 20, label: '💧 물병', color: '#5ad' },
};

/* ---- 공원 업그레이드 (연구 탭) ----------------------------------------- */
G.UPGRADES = [
  { key: '애호파', name: '애호파 공원', desc: '사육실장 등장 확률 ↑', cost: 350, tier: 0, fixedTier: true },
  { key: '학대파', name: '학대파 공원', desc: '독라 등장 확률 ↑', cost: 350, tier: 0, fixedTier: true },
  { key: '기초교육', name: '기초교육', desc: '등장 실장석 개념 +3~5/레벨', cost: 250, tier: 0, fixedTier: true },
  { key: '필라테스', name: '필라테스', desc: '등장 실장석 육질 +3~5/레벨', cost: 250, tier: 0, fixedTier: true },
  { key: '실장푸드뿌리기', name: '실장푸드 뿌리기', desc: '등장 실장석 크기 +3~5/레벨', cost: 250, tier: 0, fixedTier: true },
  { key: '가드레일벨트', name: '가드레일 벨트', desc: '물류 탭에 가드레일 벨트를 해금합니다.', cost: 1000, maxLevel: 1 },
  { key: '횡단벨트', name: '횡단벨트', desc: '물류 탭에 횡단벨트를 해금합니다.', cost: 200, maxLevel: 1 },
  { key: '긴팔집게', name: '긴팔 집게', desc: '물류 탭에 긴팔 집게를 해금합니다.', cost: 1000, maxLevel: 1, tier: 1 },
  { key: '노동교화소', name: '노동 교화소', desc: '생산 탭에 노동 교화소를 해금합니다.', cost: 6000, maxLevel: 1, tier: 1 },
  { key: '교정시설', name: '교정시설', desc: '가공 탭에 교정시설을 해금합니다.', cost: 2000, maxLevel: 1, tier: 1 },
  { key: '배합기', name: '배합기', desc: '가공 탭에 배합기를 해금합니다.', cost: 1000, maxLevel: 1, tier: 1 },
  { key: '조리실', name: '조리실', desc: '가공 탭에 조리실을 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '포장기', name: '포장기', desc: '가공 탭에 포장기를 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '짓소산생성기', name: '짓소산 생성기', desc: '가공 탭에 짓소산 생성기를 해금합니다.', cost: 10000, maxLevel: 1, tier: 2 },
  { key: '태교스피커', name: '태교스피커', desc: '특수 탭에 태교스피커를 해금합니다.', cost: 2000, maxLevel: 1, tier: 1 },
  { key: '레드포인터', name: '레드포인터', desc: '특수 탭에 레드포인터를 해금합니다.', cost: 4000, maxLevel: 1, tier: 1 },
  { key: '포획기', name: '포획기', desc: '특수 탭에 포획기를 해금합니다.', cost: 4000, maxLevel: 1, tier: 2 },
  { key: '꼬챙이', name: '꼬챙이', desc: '특수 탭에 꼬챙이를 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '매지컬테치카', name: '매지컬 테치카', desc: '특수 탭에 매지컬 테치카를 해금합니다.', cost: 8000, maxLevel: 1, tier: 2 },
  { key: '저격터렛', name: '저격 터렛', desc: '방어 탭에 저격 터렛을 해금합니다.', cost: 10000, maxLevel: 1, tier: 1 },
  { key: '지뢰', name: '독라지뢰', desc: '방어 탭에 독라지뢰를 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '박격포', name: '박격포', desc: '방어 탭에 박격포를 해금합니다.', cost: 50000, maxLevel: 1, tier: 2 },
  { key: '드릴러', name: '드릴러', desc: '생산 탭에 드릴러를 해금합니다. 작동 중 전력 60을 사용합니다.', cost: 20000, maxLevel: 1, tier: 2 },
  { key: '총알개조', name: '총알 개조', desc: '모든 터렛 공격력 +10/레벨', cost: 2000, costMult: 2, maxLevel: 20, tier: 2, fixedTier: true },
  { key: '레일속도', name: '레일 속도 증가', desc: '컨베이어 벨트 속도 +30%/레벨', cost: 500, costMult: 2, maxLevel: 20, tier: 2, fixedTier: true },
  { key: '집게속도', name: '집게 속도 증가', desc: '집게 속도 +30%/레벨', cost: 500, costMult: 2, maxLevel: 20, tier: 2, fixedTier: true },
  { key: '카오스연구', name: '카오스 연구', desc: '카오스 발전소 출력과 연구소 효율 +10%/레벨', cost: 20000, costMult: 2, maxLevel: 10, tier: 3 },
  { key: '초고농축가속', name: '초고농축 가속', desc: '배합기 농축 단계 속도 +20%, 추가 산출 확률 +10%/레벨', cost: 20000, costMult: 2, maxLevel: 10, tier: 3 },
  { key: '대량가공강화', name: '대량 가공 강화', desc: '도축기·분쇄기·조리실 처리 속도 +20%/레벨', cost: 25000, costMult: 2, maxLevel: 10, tier: 3 },
  { key: '노동석강화', name: '노동석 강화', desc: '노동석 이동·채취·방어 효율 +15%/레벨', cost: 20000, costMult: 2, maxLevel: 10, tier: 3 },
  { key: '대형비축고', name: '대형 비축고', desc: '생산 탭에 대형 비축고를 해금합니다. 출력 중 전력 80을 사용합니다.', cost: 50000, maxLevel: 1, tier: 3 },
  { key: '카오스포탑', name: '카오스 포탑', desc: '방어 탭에 카오스 포탑을 해금합니다.', cost: 60000, maxLevel: 1, tier: 3 },
  { key: '카오스게이트', name: '카오스 게이트', desc: '물류 탭에 카오스 게이트를 해금합니다.', cost: 50000, maxLevel: 1, tier: 3 },
  { key: '물류센터', name: '물류센터', desc: '물류 탭에 물류센터를 해금합니다.', cost: 5000, maxLevel: 1, tier: 2 },
  { key: '화력발전소', name: '화력 발전소', desc: '전력 탭에 화력 발전소를 해금합니다.', cost: 20000, maxLevel: 1, tier: 2 },
  { key: '카오스발전소', name: '카오스 발전소', desc: '전력 탭에 카오스 발전소를 해금합니다.', cost: 50000, maxLevel: 1, tier: 3 },
  { key: '철전봇대', name: '철 전봇대', desc: '전력 탭에 철 전봇대를 해금합니다.', cost: 10000, maxLevel: 1, tier: 2 },
  { key: '카오스전봇대', name: '카오스 전봇대', desc: '전력 탭에 카오스 전봇대를 해금합니다.', cost: 50000, maxLevel: 1, tier: 3 },
  { key: '잘못된카오스구더기', name: '잘못된 카오스 구더기', desc: '특수 탭에 잘못된 카오스 구더기를 해금합니다.', cost: 250000, maxLevel: 1, tier: 4, materials: { 대형위석: 500 } },
  { key: '인공분대인큐베이터', name: '인공분대 인큐베이터', desc: '특수 탭에 출산·성장·먹이 공급을 통합한 인공분대 인큐베이터를 해금합니다.', cost: 300000, maxLevel: 1, tier: 4, materials: { 전자부품: 40 } },
  { key: '카오스총신', name: '카오스 총신', desc: '모든 포탑의 사거리 +5%/레벨', cost: 50000, costMult: 1.35, maxLevel: 20, tier: 4, fixedTier: true },
  { key: '카오스탄창', name: '카오스 탄창', desc: '모든 포탑의 연사속도 +5%/레벨', cost: 50000, costMult: 1.35, maxLevel: 20, tier: 4, fixedTier: true },
  { key: '구더기탄도미사일', name: '구더기 탄도미사일', desc: '조리실에서 구더기와 도돈파로 박격포용 초장거리 탄환을 제작합니다.', cost: 100000, maxLevel: 1, tier: 4, materials: { 전자부품: 10 } },
];

/* ---- 실장석 대사 ------------------------------------------------------- */
G.LINES = {
  // 세면대 분류 직후 외치는 대사
  wash:   { 구더기: '레후~', 엄지: '레치!', 자실장: '테치~!' },
  // 컨베이어 벨트 위에서 간헐적으로
  belt:   { 구더기: '프니프니는 아직인레후?', 엄지: '우마우마한 것을 대령하는 레치~', 자실장: '사육실장으로 가는 레드로드테치',
    성체실장: ['이 길은 어디로 가는데스', '실려가는 기분이 묘한데스', '컨베이어는 편한데스~', '도착지가 도축장은 아닌데스?', '바람을 가르는데스'],
    독라: ['와타시가 독라일리 없는데스', '자고 일어나면 옷과 머리가 생기는데스', '추운데스', '와타시는 노예가 아닌데스!'] },
  // 배회 중 간헐적으로
  wander: { 구더기: '핀치레후', 엄지: '도망가는레치', 자실장: '자유를 찾아떠나는테치',
    성체실장: ['우마우마한것을 찾는데스', '심심해 죽겠는데스', '닝겐은 어디있는데스', '세레브한 삶을 원하는데스', '운치 냄새가 진동하는데스', '오늘도 평화로운데스', '배가 고픈데스…', '자실장들은 잘 크고 있는데스?', '와타시가 제일 우마우마한데스'],
    독라: ['와타시가 독라일리 없는데스', '자고 일어나면 옷과 머리가 생기는데스', '추운데스', '와타시는 노예가 아닌데스!'] },
  // 벨트 음식을 먹어치웠을 때 (성장 상태별 어미)
  eat: { 성체실장: '우마우마한데스', 사육실장: '우마우마한데스', 독라: '우마우마한데스', 자실장: '우마우마한테치', 새끼사육실장: '우마우마한테치', 새끼독라: '우마우마한테치', 엄지: '우마우마한레치', 구더기: '우마우마한레후' },
  // 교정시설 자실장 대사
  correction: ['주인님께 반항하면 안되는테치', '운치를 잘 관리하는테치', '세상은 무서운테치'],
  correctionEscape: '똥닝겐은 스시와 스테이크를 대령하는테치',
  // 외부 침입 실장석(약탈/포식) 대사
  invade: ['새끼를 내놓는데스!', '우마우마한 냄새가 나는데스', '사육분충들은 죽는데스!', '먹어치우는데스'],
  petThreat: ['세레브한 옷을 내놓는데스', '사육실장은 와타시 것인데스'],
  petAttacked: '데갸악! 분충인데스!',
  // 짓소산 생성기에서 행복을 짜낼 때(짓소산 1개 생성 시)
  acidgen: ['데갸악!', '이것이 와타시의 삶일리없는데스', '거짓말인데샤악!'],
  reformer: ['데갸갸갸갸', '복종하는데스!', '와타시는 노예데스'],
  power: {
    jisoucharge: ['이 빙글빙글은 언제 끝나는데스!', '힘들어 죽는데스!', '괴로운 고행길인데스'],
    firecharge: ['뜨거운{suffix}!', '지옥의 열기인{suffix}!', '맛있어지는{suffix}!'],
    chaoscharge: ['저곳은... 낙원인데스?', '콘페이토 별이 기다리는데스...', '오오... 오오데스...', '남편사마가 저기있는데스...'],
  },
  labor: '주인님의 명령에 복종하는데스',
  pen: {
    dokura: ['와타시가 독라일리 없는데스', '자고 일어나면 옷과 머리가 생기는데스', '추운데스', '와타시는 노예가 아닌데스!'],
    maggot: ['프니프니레후?', '프니프니 타이밍레후', '팔다리 긴긴 하고싶은레후', '레후우~!', '노예는 어디레후'],
    low: [
      { text: '노예는 먹을 것을 내놓는{suffix}', suffix: ['테치', '레치'] },
      { text: '이 운치굴에서 꺼내주는{suffix}!', suffix: ['테치', '레치'] },
      { text: '똥벌레들이 잔뜩인데스', suffix: ['데스'] },
      { text: '여긴 너무 더러운데스', suffix: ['데스'] },
      { text: '배가 고파 죽겠는데스', suffix: ['데스'] },
      { text: '닝겐은 와타시를 굶기는데스', suffix: ['데스'] },
      { text: '냄새가 지독한데스…', suffix: ['데스'] },
    ],
    mid: [
      { text: '먹어도 배가 고픈{suffix}', suffix: ['테치', '레치'] },
      { text: '심심한{suffix}', suffix: ['테치', '레치'] },
      { text: '자들이 보고싶은데스', suffix: ['데스'] },
      { text: '오늘은 좀 살만한데스', suffix: ['데스'] },
      { text: '우마우마한 사료를 원하는데스', suffix: ['데스'] },
      { text: '와타시도 사육실장이 되고싶은데스', suffix: ['데스'] },
      { text: '낮잠이나 자는데스~', suffix: ['데스'] },
    ],
    high: [
      { text: '닝겐들은 우리를 보살펴주는{suffix}?', suffix: ['테치', '레치'] },
      { text: '공원에 비하면 천국인{suffix}', suffix: ['테치', '레치'] },
      { text: '살아남으려면 노력하는테치', suffix: ['테치'] },
      { text: '이곳이 와타시의 낙원인데스', suffix: ['데스'] },
      { text: '세레브한 기분인데스☆', suffix: ['데스'] },
      { text: '닝겐에게 감사하는데스', suffix: ['데스'] },
      { text: '와타시는 특상품인데스', suffix: ['데스'] },
      { text: '우아하게 사는데스', suffix: ['데스'] },
    ],
  },
  // 독라지뢰: 설치 후 평상시 중얼거림
  mine: ['정말 이렇게만 있으면 사육실장이 되는데스?', '뭔가 실수한 것 같은데스...', '움직일 수 없는데스...', '분충은 소리만 지르면 도망친다고 한데스'],
  // 독라지뢰: 폭발 직전
  minePreExplode: ['분충은 죽는데스!', '낙원으로 가는데스!', '남편사마가 기다리는데스!'],
  // 자동 포탑: 평상시
  turret: ['빙글빙글 어지러운데스', '와타시는 폭력의 권리를 누리는데스'],
  // 자동 포탑: 공격 시
  turretAttack: ['분충은 죽는데스!', '일가실각샷인데스!', '쿠이쿠이!'],
  // 출산대: 출산 시 ({n}=랜덤 숫자)
  birthing: ['뎃데로게~', '데갹! 와타시의 {n}번째 자가!', '자들은 건강하게만 태어나는데스'],
  // 세면대: 세척 중
  washbasin: ['슬슬 손이 아픈데스...', '이 자들은 어디로 가는데스?'],
  // 탈복기 투입 직후. adult=성체실장, child=자실장
  deshellNormal: {
    adult: ['프로포즈도 없이 옷부터 벗기는뎃승♡', '데갸악! 와타시 옷을 돌려주는데스!', '머리씨 돌아오는데스~!', '독라는 안되는데스!', '안 되는 데스! 옷씨는 안 되는 데스!', '제발 찢지 마는 데스!', '독라는 싫은 데스!', '머리카락씨 다 뽑히는 데스!', '지금이라면 알몸 도게자로 용서해주는데스!'],
    child: ['프로포즈도 없이 옷부터 벗기는뎃승♡', '데갸악! 와타시 옷을 돌려주는테치!', '머리씨 돌아오는테치~!', '독라는 안되는테치!', '안 되는 테치! 옷씨는 안 되는 테치!', '제발 찢지 마는 테치!', '독라는 싫은 테치!', '머리카락씨 다 뽑히는 테치!', '지금이라면 알몸 도게자로 용서해주는테치!'],
  },
  // 탈복기 사육실장 투입 직후
  deshellPet: {
    adult: ['키운다고 했던데스! 키운다고 했던데스!', '사육실장의 꿈이!', '이럴 줄 알았던데스', '실생은 운치인데스', '미래의 남편사마가 복수할것인데스!', '닌겐상, 분홍옷 뺏지 마는 데스!', '훈육 다 했는데 왜 찢는 데스!', '엘리트의 옷인 데스!', '소중하게 가꾼 머리카락씨를!', '와타시의 머리카락은 국가적 보배인데스!'],
    child: ['키운다고 했던테치! 키운다고 했던테치!', '사육실장의 꿈이!', '이럴 줄 알았던테치', '실생은 운치인테치', '미래의 남편사마가 복수할것인테치!', '닌겐상, 분홍옷 뺏지 마는 테치!', '훈육 다 했는데 왜 찢는 테치!', '엘리트의 옷인 테치!', '소중하게 가꾼 머리카락씨를!', '와타시의 머리카락은 국가적 보배인테치!'],
  },
  // 도축기 독라 투입 직후
  slaughterSlave: {
    adult: ['데갸아아악!', '와타시 섬섬옥수가!', '소중한 돌씨 뺏지 마는데스!', '데보오오옥'],
    child: ['데갸아아악!', '와타시 섬섬옥수가!', '소중한 돌씨 뺏지 마는테치!', '데보오오옥'],
  },
  // 배합기: 배합 중(자실장 어미)
  mixer: ['빙글빙글 어지러운테치', '이건 아동착취인테치', '실장권 위반인테치야!'],
  // 행복이 0이 되어 행복회로에 빠졌을 때 머리 위 표시
  happyCircuit: '행복회로!',
};

/* ---- 교정시설 수치 ----------------------------------------------------- */
G.CORRECTION = { LINE_MIN: 1.5, LINE_MAX: 3.5, ESCAPE_CONCEPT: 20, ESCAPE_CHANCE: 0.3, GRAD_CONCEPT: 30, GRAD_TIME: 30 };

/* ---- 대사/이벤트 텍스트 -------------------------------------------------
 *  - 배열에 줄을 추가하면 대화창에서 순서대로 표시됩니다.
 *  - 문자열 대신 { text, emotion, name, long } 형태로 줄마다 표정/이름/표시시간을 바꿀 수 있습니다.
 *  - 미도리 감정: normal, laziness, mad, sad, shy, laugh, sleep, wrong
 * ----------------------------------------------------------------------- */
G.DIALOGUES = {
  openingMidori: [
    { emotion: 'normal', text: '드디어 왔네, 공장장. 나는 실장인 미도리야.' },
    { emotion: 'laziness', text: '실장석 출신이지만 알건 다 알아. 네 비서니까 귀찮아도 기본 운영법 정도는 설명해줄게.' },
    { emotion: 'normal', text: '우선 이 콜로니 센터가 공장의 심장이야. 여기서 티어를 올리고, 의뢰와 생산을 이어가게 될 거야.' },
    { emotion: 'normal', text: '알다시피 생물재앙으로 지구상에는 인류와 실장석 말고는 대부분의 생물들이 멸종했어.' },
    { emotion: 'laugh', text: '인간들은 방공호에 숨어 실장석을 먹고 버티고 있지. 공장장이 제대로 못하면 방공호의 인류는 멸종할거란 뜻이야.' },
    { emotion: 'laziness', text: '멍하니 보고만 있으면 아무것도 안 굴러가니까, 설명은 짧게 할게. 잘 들어.' },
  ],
    firstVault44Quest: {
    item: '실장육',
    n: 30,
    rewardMoney: 8000,
    rewardText: '💰 8,000',
    line: '44방공호다. 실장육 30개를 서둘러 보내라. 사람들이 굶고 있다.',
  },
  colonyTier1Midori: [
    { emotion: 'mad', text: '…어이없을 정도로 일방적인 요구네. 방공호 녀석들은 자기들이 갑인줄 안다니까.' },
    { emotion: 'shy', text: '우리가 없으면 자기들끼리 잡아먹어야 하는 주제에 말이야.' },
    { emotion: 'laziness', text: '어쨌든 돈은 벌어야하니까 빨리 납품하자. 이런 긴급요청은 단가가 좋거든!' },
  ],
  colonyTier2Midori: [
    { emotion: 'laugh', text: '티어 2 달성! 슬슬 공장다워지는데?' },
    { emotion: 'normal', text: '이제 짓소산 생성기, 포획기, 매지컬 테치카, 화력 발전소 같은 고급 시설을 연구할 수 있어.' },
    { emotion: 'normal', text: '단, 여기서부턴 거의 다 전력이 필요해. 발전소랑 전봇대로 전력망을 깔아두지 않으면 시설들이 멈춰버릴 거야.' },
    { emotion: 'laziness', text: '게으름 피우지 말고 전력부터 챙겨두라구.' },
  ],
  colonyTier3Midori: [
    { emotion: 'wrong', text: '티어 3이라니… 드디어 여기까지 왔네.' },
    { emotion: 'shy', text: '여기서부터는 카오스 파워의 영역이야. 실장석의 가장 엉터리같고도 강력한 힘이지.' },
    { emotion: 'normal', text: '카오스 발전소로 어마어마한 전력을 뽑고, 카오스 전봇대로 멀리까지 보낼 수 있어.' },
    { emotion: 'laugh', text: '이 힘을 제대로 다루면… 후후, 더는 무서울 게 없겠어.' },
  ],
  colonyTier4Midori: [
    { emotion: 'amaze', text: '드디어 여기까지 왔구나...!' },
    { emotion: 'normal', text: '정말 많은 일들이 있었네. 이렇게까지 공장을 크게 키우게 될 줄은 꿈에도 몰랐어.' },
    { emotion: 'shy', text: '대단해, 공장장. 처음 봤을 때 속으로 허접이라고 생각해서 미안해.' },
    { emotion: 'laugh', text: '앞으로도 같이 더 큰 실장석을 팔아서 부자가 되자!' },
  ],
  endingVaultOffer: [
    '듣고 있나, 공장장?',
    '최근 탐사대가 공장 인근에서 버려진 발사대와 우주선을 발견했다고 한다...',
    '과거 대재앙이 발생했을 때 부자들만 탈출하고 남은 탈출선이야. 우리에게 남겨진 마지막 희망인 셈이지.',
    '하지만 발사대가 방공호로부터 너무 멀어서 손을 쓰기가 어려워.',
    '그러니 부탁이다. 우리 대신 우주선 발사를 준비해줘.',
    '다른 놈들이 탈출한 행성에는 희망이 있는지는 모르겠지만... 가봐야 알겠지.',
    '의뢰를 승낙한다면 해당 부지는 무료로 넘겨주겠네.',
  ],
  endingMidoriWarning: [
    { emotion: 'shy', text: '...공장장, 이건 위험한 의뢰야.' },
    { emotion: 'wrong', text: '44방공호 사람들이 탈출선을 타고 나가버리면 우리는 더이상 장사할 사람이 없어.' },
    { emotion: 'wrong', text: '게다가 해당 지역은 최근 적색지대가 됐어. 오염이 강해졌다는 뜻이야.' },
    { emotion: 'shy', text: '거기에 창고를 지으면 보급품 전체가 오염될 수 있기 때문에 지을 수 없어. 일일이 컨베이어 벨트로 옮겨야한다는거지.' },
    { emotion: 'wrong', text: '아마 그 냄새를 맡고 어마어마한 분충들이 몰려들거야. 신중하게 생각해.' },
  ],
  endingAcceptedMidori: [
    { emotion: 'sad', text: '...그래, 결국 그렇게 하기로 했구나.' },
    { emotion: 'normal', text: '맞아. 돈이 아무리 좋아도 마지막 희망을 버릴 순 없지.' },
    { emotion: 'laugh', text: '좋아! 마지막까지 힘내보자!' },
  ],
  endingHalfVault: [
    '어렵게 진행중이라는 이야기 들었다. 공장장.',
    '미안하지만 지금 방공호 상황도 여의치가 않아. 물자가 탈출선에 쏠리면서 사람들이 굶주리고 있어...',
    '하지만 어떻게든 버텨보고 있다. 희망을 눈앞에 두고 무너질 순 없지.',
    '다만 당신이 데리고 있는 실장인 비서말인데...',
    '...우리 중에는 실장석이 역병의 근원이라고 믿는 사람들이 많아.',
    '실장석과 실장인은 다르고... 우리는 모두 면역이 있지만, 혹시 모르잖나.',
    '다른 행성에 갔을 때 또다시 역병이 발병할지도 몰라. 아무래도 실장석 출신이잖나.',
    "게다가 희망하는 사람들도 전부 다 못타는데 '사람이 아닌 것'을 태우기는 어려울 것 같다.",
    '부디 우리 입장을 이해해주면 좋겠군.',
    '하지만 당신이라면 얼마든지 타도 좋아. 인류의 구원자로 대접해주지.',
  ],
  endingReadyVault: [
    '훌륭해! 이제 발사만 남았군.',
    '이제 시동을 걸려면 엄청난 전력이 필요해. 최대한 전력을 충전해주게!',
  ],
  endingChoice1Midori: [
    { emotion: 'laugh', text: '...후후, 걱정마. 허접 공장장 오기 전부터 공장은 내가 관리했었다구.' },
    { emotion: 'normal', text: '공장은 걱정말고 평화롭고 행복한 낙원으로 가버리라구.' },
    { emotion: 'sad', text: '아마 거기서도 가끔은... 두고 온 똥벌레들 생각이 날걸?' },
  ],
  endingChoice2Midori: [
    { emotion: 'amaze', text: '뭐? 미쳤어?' },
    { emotion: 'mad', text: '뭐라는거야, 이 멍청하고 허접한 공장장아. 지금이 이 똥벌레 행성에서 도망칠 유일한 기회라고!' },
    { emotion: 'wrong', text: '...공장장은 공장과 비서를 버리지 않는다고?' },
    { emotion: 'sad', text: '혹시 운치를 퍼나르다보니 뇌에 운치가 찼나?' },
    { emotion: 'laugh', text: '...정말 어쩔 수 없네! 공장장은 허접이니까, 내가 옆에서 도와주지 않으면 안된다는거지?' },
  ],
  endingChoice2Vault: [
    '...진심인가. 남겠다고?',
    '남기로 결정한 사람이 자네만은 아니니 이해 못할건 아니지만...',
    '그래. 어쩔 수 없군. 44방공호에도 꽤 많이 남기로 했어. 티파티도, 프릭쇼 놈들도...',
    '...실장석을 두고 떠날 수 없다나...',
    '그 벌레들에게 대체 무슨 매력이 있는지 모르겠지만... 어쩔 수 없지.',
    '부디 평화와 건강을 빌겠네.',
  ],
  endingChoice3MidoriBefore: [
    { emotion: 'amaze', text: '어? 뭐라고?' },
    { emotion: 'shy', text: '우리 둘만 탈출하자고? 사람들도 두고?' },
  ],
  endingChoice3MidoriAfter: [
    { emotion: 'shy', text: '그, 그렇게 말해주는건 고맙지만...' },
    { emotion: 'wrong', text: '하지만 사람들의 원망은... 엑, 그런거 신경 안써?' },
    { emotion: 'amaze', text: '...완전 똥벌레잖아?' },
    { emotion: 'shy', text: '...하지만 나도 똥벌레인건 마찬가지지.' },
    { emotion: 'laugh', text: '좋아, 공장장. 한번 세상 끝까지 같이 가보자구.' },
  ],
  endingStayVaultAfter: [
    '반갑다. 공장장. 나는 새 방공호 대표다...',
    '자네가 여기 남기로 했다고 들었어.',
    '자네처럼 모두가 탈출선을 탈 수는 없었지. 나도 남겨진 사람들을 지키기 위해 남았다...',
    '...그리고 공장장이 요리해주는 실장석을 잊을 수 없을 거 같아서 말이야.',
    '앞으로도 잘 부탁한다고, 공장장.',
  ],

};

/* ---- 퀘스트(무전) ------------------------------------------------------
 *  - 의뢰 주체 5단체. 단체별 요청 품목 풀 / 보상 종류 / 등장 최소 티어.
 *  - reqs[].item: 요청 품목 1종(이름+아이콘). qty: 기준 수량(티어로 스케일, 끝자리 0).
 *    stat: {key, min}=살아있는 실장석 스탯 조건. unit: 보상 환산 기준 단가.
 *    research: 연구 키 또는 연구 키 배열. 해당 연구를 완료해야 요청 후보에 포함.
 *  - reward: 'money' | 'money_big' | 'money_meat' | 'research' | 'power' | 'money_power'
 * ----------------------------------------------------------------------- */
G.QUEST_CONFIG = {
  SPAWN_INTERVAL: 180,   // 3분마다 1개 생성
  MAX_ACTIVE: 3,         // 최대 3개 누적
  STATIC_TIME: 1.6,      // 무전 직전 치지직 효과 시간(초). 대사창 클릭 시 즉시 스킵
  TYPE_SPEED: 18,        // 대사 한 글자 출력 간격(ms). 타이핑 중 클릭 시 즉시 전체 표시
};
G.QUEST_ORGS = {
  vault44: {
    name: '44방공호', short: '44', color: '#c9a24a', minTier: 0, reward: 'money', weight: 40,
    intro: '인류 최대 거주지. 실장석은 그저 식량이자 연료다. 질보다 양.',
    introLines: [
      '…응답하라. 여기는 44방공호. 인류 최후의 보루다.',
      '지상은 죽었고, 살아남은 인간은 전부 이 둥지 안에 있다. 우리가 무너지면 인류도 끝이야.',
      '많은 입을 먹여 살려야 한다. 질은 아무래도 상관없어. 양만 많이 보내도록 해. 돈은 후하게 쳐주지.',
    ],
    reqs: [
      { item: '실장육', qty: 50, unit: 22 }, { item: '분쇄육', qty: 60, unit: 8 },
      { item: '통조림', qty: 30, unit: 600, research: '포장기' }, { item: '진공포장', qty: 30, unit: 800, research: '포장기' },
      { item: '운치', qty: 200, unit: 3, tier: 1 }, { item: '농축운치', qty: 30, unit: 18, tier: 1, research: '배합기' },
      { item: '고농축운치', qty: 20, unit: 90, tier: 2, research: '배합기' },
    ],
    lines: ['방공호의 보급이 끊겼다. 최대한 많이 부탁해.', '사람이 굶고 있다. 빨리 보내주면 좋겠군.', '화로가 식고있다. 뭐든 태울 것 좀 보내라.'],
    done: ['살았다. 다음도 부탁한다.', '덕분에 한숨 돌렸다. 고맙군.'],
  },
  bezoar: {
    name: '위석 연구소', short: '위석', color: '#6f8f9f', minTier: 0, reward: 'research_power', weight: 10, rare: true,
    intro: '실장석의 기이한 생명력을 연구한다. 고통엔 둔감하다.',
    introLines: [
      '…여기는 위석 연구소입니다. 실장석을 연구하고 있지요.',
      '이 엉터리 생물이 인간과 함께 살아남았다는 사실은 참으로 흥미롭지지요. 어쩌면 인류를 구원할 열쇠가 될지도 몰라요.',
      '연구를 위해 살아있는 표본이 필요합니다. 신선할수록 좋아요.',
    ],
    reqs: [
      { item: '구더기', qty: 20, unit: 0 }, { item: '엄지', qty: 20, unit: 0 },
      { item: '자실장', qty: 10, unit: 0, stat: { key: '육질', min: 30 } },
      { item: '성체실장', qty: 10, unit: 0, stat: { key: '육질', min: 50 }, tier: 1 },
      { item: '카오스 구더기', qty: 1, unit: 90000, fixedQty: 1, fixedMoney: 90000 },
    ],
    lines: ['살아있는 표본이 필요해요. 신선할수록 좋아요.', '실험체를 보내주세요. 튼튼한 녀석이면 좋겠군요.'],
    done: ['흥미로운 결과에요. 연구가 한단계 진척됐습니다...', '표본 양호. 인류는 또 한걸음 앞으로 나아갑니다.'],
  },
  teaparty: {
    name: '참피맘 티파티', short: '티파티', color: '#ff8fd8', minTier: 1, reward: 'money_big', weight: 20,
    intro: '실장석을 아끼고 사랑하는 모임. 까다롭지만 후하게 쳐준다.',
    introLines: [
      '안녕하세요♡ 저희는 참피맘 티파티예요.',
      '실장석은 인류의 소중한 동반자랍니다. 그 아이들을 아끼고 사랑하는 마음만이 잃어버린 인간성을 되찾아주죠.',
      '부디 품위 있는 아이로 부탁드려요♡',
    ],
    reqs: [
      { item: '사육실장', qty: 10, unit: 600, stat: { key: '개념', min: 60 }, research: '교정시설' },
      { item: '새끼사육실장', qty: 10, unit: 700, stat: { key: '개념', min: 40 }, research: '교정시설' },
      { item: '콘페이토', qty: 20, unit: 120, research: '조리실' }, { item: '우마이푸드', qty: 100, unit: 6, research: '배합기' },
      { item: '다이어트푸드', qty: 100, unit: 6, research: '배합기' },
    ],
    lines: ['우리 아이들에게 줄 좋은 친구가 필요해요♡', '품위 있는 아이로 부탁해요.', '달콤한 간식도 잊지 마세요!'],
    done: ['어머, 완벽해요! 사례는 두둑이♡', '아이들이 좋아하겠네요.'],
  },
  freakshow: {
    name: '참피 프릭쇼', short: '프릭쇼', color: '#a23a3a', minTier: 1, reward: 'money_meat', weight: 20,
    intro: '실장석을 학대·조롱하는 막장 방송. 비틀린 욕망을 채운다.',
    introLines: [
      '헤헤… 여긴 참피 프릭쇼다! 망해버린 세상의 유일한 쇼프로 채널이지!',
      '인간에게 남은 즐거움이라곤 이 똥벌레들을 갖고 노는 것뿐이야. 이게 또 끝내주게 재밌거든!',
      '쇼에 올릴 놈들을 보내라. 종류는 안 가려!',
    ],
    reqs: [
      { item: '구더기', qty: 30, unit: 4 }, { item: '엄지', qty: 30, unit: 6 }, { item: '자실장', qty: 20, unit: 10 },
      { item: '성체실장', qty: 20, unit: 14 }, { item: '독라', qty: 20, unit: 14 },
      { item: '사육실장', qty: 10, unit: 500, research: '교정시설' },   // 사육실장은 더 후한 보상
      { item: '도돈파', qty: 10, unit: 200, tier: 2, research: '조리실' }, { item: '코로리', qty: 10, unit: 240, tier: 2, research: '조리실' }, { item: '도로리', qty: 10, unit: 360, tier: 3, research: '조리실' },
    ],
    lines: ['쇼에 내보낼 놈들이 필요해! 종류 불문!', '관객이 피를 원한다. 많이 보내!', '오늘 밤 메인 무대를 채워라!'],
    done: ['시청률 대박이다! 사례다!', '관객이 환장했어. 고기로도 쳐주지.'],
  },
  cult: {
    name: '낙원 컬트', short: '컬트', color: '#7b4faf', minTier: 2, reward: 'scrap_power', weight: 10,
    intro: '실장석의 카오스 파워에 집착하는 자들. 제물로 바친다.',
    introLines: [
      '…우리는 낙원 컬트. 세계의 비밀을 엿보는 집단이다.',
      '인류가 구원받을 길은 단 하나. 실장석에 깃든 미스터리한 힘, 카오스 파워를 연구하는 것뿐이다.',
      '깨달은 제물을 바쳐라. 낙원이 가까워진다.',
    ],
    reqs: [
      { item: '독라', qty: 10, unit: 16, stat: { key: '개념', min: 80 } },
      { item: '대형위석', qty: 10, unit: 40 }, { item: '중형위석', qty: 20, unit: 24 }, { item: '소형위석', qty: 20, unit: 16 },
    ],
    lines: ['깨달은 제물을 바쳐라. 낙원이 가까워진다.', '카오스 실장석이 우리를 구원하리라.'],
    done: ['오오… 낙원이 응답했다. 힘을 나누마.', '제물은 별에 닿는 토대가 되리라.'],
  },
};

/* ---- 자동 포탑 개별 업그레이드 (포탑 클릭 → 업그레이드 창) --------------
 *  비용 = base × (현재레벨 + 1) */
G.TURRET_UP = {
  dmg:   { label: '공격력', base: 300, max: 20 },
  rate:  { label: '연사',   base: 300, max: 10 },
  range: { label: '사거리', base: 400, max: 8 },
};

/* 카테고리별 하위메뉴 */
G.MENU = {
  logistics:  { label: '물류', items: ['belt', 'guardbelt', 'crossbelt', 'chaosgate', 'sorter', 'grabber', 'longgrabber', 'warehouse', 'salecenter'] },
  defense:     { label: '방어', items: ['wall', 'door', 'turret', 'sniper', 'mine', 'mortar', 'chaosturret'] },
  production:  { label: '생산', items: ['penbox', 'birthing', 'reformer', 'washbasin', 'driller', 'largewarehouse', 'terrarium'] },
  processing:  { label: '가공', items: ['washbasin', 'slaughter', 'deshell', 'grinder', 'correction', 'mixer', 'cookery', 'acidgen', 'packer'] },
  special:     { label: '특수', items: ['speaker', 'pointer', 'catcher', 'skewer', 'feeder', 'techica', 'wrongchaosmargot', 'lab'] },
  power:       { label: '전력', items: ['jisoucharge', 'firecharge', 'chaoscharge', 'woodpole', 'ironpole', 'chaospole'] },
  monument:    { label: '기념물', items: ['relic_techica', 'relic_arts', 'relic_slave', 'relic_sister', 'relic_dainagon', 'relic_bigmargot', 'relic_home', 'relic_candy', 'relic_margot'] },
};

/* ---- 효과음 / 배경 ----------------------------------------------------- */
G.SFX = {
  capture: 'assets/sounds/sfx/capture.mp3', place: 'assets/sounds/sfx/place.mp3',
  rotate: 'assets/sounds/sfx/rotate.mp3', birth: 'assets/sounds/sfx/birth.mp3',
  wash: 'assets/sounds/sfx/wash.mp3', sell: 'assets/sounds/sfx/sell.mp3',
  click: 'assets/sounds/sfx/click.mp3', remove: 'assets/sounds/sfx/remove.mp3',
  grow: 'assets/sounds/sfx/grow.mp3', turret: 'assets/sounds/sfx/gunshot.mp3',
  sniper: 'assets/sounds/sfx/gunshot.mp3',
  canon: 'assets/sounds/sfx/canon.mp3',
  explosion: 'assets/sounds/sfx/explosion.mp3',
  research: 'assets/sounds/sfx/11.mp3',
  upgrade: 'assets/sounds/sfx/upgrade.mp3',
  thunder: 'assets/sounds/sfx/thunder.mp3',
};
G.RAIN_SOUND = 'assets/sounds/bgm/rain.mp3';
G.BGM_WELCOME = 'assets/sounds/bgm/welcome.mp3'; // 게임 초기화/시작 후 무조건 가장 먼저 1회 재생
G.BGM = [
  'assets/sounds/bgm/fight.mp3',
  'assets/sounds/bgm/maze.mp3',
  'assets/sounds/bgm/quiet.mp3',
  'assets/sounds/bgm/koneko.mp3',
  'assets/sounds/bgm/metal.mp3',
  'assets/sounds/bgm/slowlife.mp3',
];
G.BGM_RAID = 'assets/sounds/bgm/raid.mp3';        // 침입(레이드) 중 배경음
G.BGM_TECHICA = 'assets/sounds/bgm/techica.mp3';  // 매지컬 테치카 가동 + 확대 중 배경음
G.BGM_CLIMAX = [
  'assets/sounds/bgm/climax1.mp3',
  'assets/sounds/bgm/climax2.mp3',
  'assets/sounds/bgm/climax3.mp3',
];
G.BGM_EXIT = 'assets/sounds/bgm/exit.mp3';
G.BGM_END_ALONE = 'assets/sounds/bgm/end_alone.mp3';
G.BGM_END_TOGETHER = 'assets/sounds/bgm/end_together.mp3';
G.BGM_END_STAY = 'assets/sounds/bgm/slowlife.mp3';
G.BG = {
  park: 'assets/images/backgrounds/park.png',       // 공원 배경(전체 1장, 권장 1440x786)
  factory: 'assets/images/backgrounds/factory.png', // 공장 전체 배경(화면 고정, 1152x720 권장)
  tile: 'assets/images/backgrounds/tile.png',        // 공장 바닥 타일(칸마다 반복, 정사각 권장 48x48/96x96…)
};
