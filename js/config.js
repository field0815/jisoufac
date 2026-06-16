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

  // 탄생 직후 크기 범위와 크기 기반 진화
  SIZE_BIRTH_RANGE: {
    점액덩어리: [1, 5], 구더기: [1, 5], 엄지: [1, 5],
    자실장: [10, 20], 성체실장: [30, 50],
    새끼사육실장: [10, 20], 사육실장: [30, 50],
    새끼독라: [10, 20], 독라: [30, 50],
  },
  SIZE_EVOLVE_AT: { 구더기: 5, 엄지: 10, 자실장: 30, 새끼사육실장: 30, 새끼독라: 30 },
  SIZE_GROW_TIME: 20,       // 실장푸드를 먹은 시간 20초당 크기 +1

  SLIME_TIME: 10,           // 점액덩어리 → 구더기 자동 변환(초)

  // 장치 동작 수치
  BIRTH_INTERVAL: 10,       // 출산대: 구더기 생산 주기(초) — 10초로 하향
  BIRTH_LIFESPAN: 180,
  WASH_TIME: 3,
  GRABBER_INTERVAL: 1.0,
  BELT_SPEED: 1.1,
  BELT_CAP: 2,
  TUNNEL_TIME: 0.4,         // 터널 통과 시간(초)
  TUNNEL_CAP: 8,            // 터널 동시 수용

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
  RESEARCH_QUEUE_MAX: 5,        // 연구 예약 최대 수
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
  },
  CHAOS_FUEL_TIME: { 대형위석: 60, 중형위석: 40, 소형위석: 30 },
  RUIN_TYPES: {
    ruin: { name: '유적', w: 5, h: 5, base: 1, scrap: [30000, 50000], color: '#69717b' },
    wreck: { name: '폐허', w: 4, h: 4, base: 3, scrap: [2000, 3000], color: '#7a6f62' },
    debris: { name: '잔해', w: 2, h: 2, base: 7, scrap: [200, 500], color: '#87827a' },
  },

  // ---- 거래(상점) -------------------------------------------------------
  FOOD_PRICE: 1,            // 실장푸드 1개 구매가
  BUY_ADULT: 120,           // 성체실장 구매가
  BUY_CHILD: 40,            // 자실장 구매가
  SEASONING_BASE: 30,       // 조미료 시작 가격
  SEASONING_MIN: 5,         // 조미료 최소 가격
  SEASONING_TICK: 60,       // 조미료 가격 변동 주기(초)
  SEASONING_SWING: 4,      // 조미료 가격 변동폭(±1~SWING)
  SEASONING_MAX: 50,        // 조리실 조미료 비축 최대치

  // ---- 매지컬 테치카 / 배경음 -------------------------------------------
  TECHICA_ZOOM_BGM: 1.3,    // 가동 중인 매지컬 테치카가 화면에 있고 줌이 이 값 이상이면 techica.mp3
  RAID_BGM_FADEOUT: 5,      // 침입 실장 전멸 후 원래 음악으로 돌아오기까지(초)

  // ---- 특수 사료(배합기 산출) ------------------------------------------
  UMAI_GROWTH_MULT: 3,      // 우마이푸드: 성장 배수
  UMAI_HAPPY_RATE: 0.3,     // 우마이푸드: 초당 행복 상승
  DIET_GROWTH_MULT: 0.5,    // 다이어트푸드: 성장 배수(둔화)
  DIET_CONCEPT_CHANCE: 0.01,// 다이어트푸드: 식사 시 개념 +1 확률(초당, 1%)
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

/* ---- 방향 정의 (0:상 1:우 2:하 3:좌) ------------------------------------ */
G.DIR = {
  vec: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
  name: ['상', '우', '하', '좌'],
};

/* ---- 실장석 종류 ------------------------------------------------------- */
G.CREATURES = {
  성체실장:     { img: 'adult.png',       color: '#d98a8a', label: '성체',    isAdult: true,  ai: 'predator', baby: '구더기' },
  점액덩어리:   { img: 'slime.png',       color: '#bfe3b0', label: '점액',    isAdult: false }, // 출산 직후, 10초 후 구더기
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
  분쇄육:   { color: '#a55', img: 'minced.png', isProduct: true,  flatPrice: 5 },   // 분쇄기 산출 / 배합기 재료
  실장푸드: { color: '#7a4', img: 'food.png',   isProduct: false, size: 0 }, // 자원(사료)
  '짓소산 푸드': { color: '#6fd690', img: 'jisso_food.png', isProduct: false, size: 0 }, // 자원(특수 사료)
  우마이푸드: { color: '#e8b54a', img: 'umai_food.png', isProduct: false, size: 0 }, // 자원(특수 사료: 성장3배·행복+0.3/s)
  다이어트푸드: { color: '#9ad0e0', img: 'diet_food.png', isProduct: false, size: 0 }, // 자원(특수 사료: 성장0.5배·개념 상승)
  운치:     { color: '#964', img: 'unchi.png',  isProduct: false, size: 10 }, // 자원(배설물)
  // 위석(도축 부산물) — 도축한 실장석 종류에 따라 크기가 다름. 분쇄기에 넣으면 조미료 산출.
  소형위석: { color: '#8fa6b2', img: 'bezoar_s.png', isProduct: false, size: 10, grindSeasoning: 1 },
  중형위석: { color: '#6f8f9f', img: 'bezoar_m.png', isProduct: false, size: 10, grindSeasoning: 3 },
  대형위석: { color: '#52707f', img: 'bezoar_l.png', isProduct: false, size: 10, grindSeasoning: 5 },
  짓소산:   { color: '#6ee0b6', img: 'jisso_acid.png', isProduct: false, size: 10 },
  조미료:   { color: '#e8d37a', img: 'seasoning.png', isProduct: false, size: 0 },
  철조각:   { color: '#9aa3ad', img: 'scrap.png', isProduct: true, flatPrice: 8 }, // 화물(고철)
  콘페이토: { color: '#ff8fd8', img: 'candy_cpt.png', isProduct: false, size: 0, shopPrice: 100 },
  도돈파:   { color: '#d69045', img: 'candy_ddp.png', isProduct: false, size: 0, shopPrice: 300 },
  코로리:   { color: '#86c2ff', img: 'candy_cll.png', isProduct: false, size: 0, shopPrice: 500 },
  도로리:   { color: '#bb79ff', img: 'candy_drr.png', isProduct: false, size: 0, shopPrice: 500 },

  // 조리실 요리 (실장육보다 비싼 고급 화물, 기본가 + 재료 육질 보너스)
  꼬치훈제: { color: '#c8862a', img: 'skewer.png',  isProduct: true, flatPrice: 280, qualityPrice: true },
  통조림:   { color: '#9aa6b0', img: 'can.png',     isProduct: true, flatPrice: 320, qualityPrice: true },
  진공포장: { color: '#7aa0c0', img: 'vacuum.png',  isProduct: true, flatPrice: 300, qualityPrice: true },
  실장젓갈: { color: '#b06a6a', img: 'jeotgal.png', isProduct: true, flatPrice: 260, qualityPrice: true },
  실장무침: { color: '#c89a4a', img: 'muchim.png',  isProduct: true, flatPrice: 290, qualityPrice: true },
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
  crossbelt: { cat: 'logistics', name: '횡단 벨트',     w: 3, h: 1, img: 'crossbelt.png', color: '#6a6f7a', rotatable: true, unlock: '횡단벨트', desc: '1칸을 건너 뛰고 화물을 보낸다.' },
  sorter:    { cat: 'logistics', name: '분류기',        w: 1, h: 2, img: 'sorter.png',    color: '#7a6a3a', rotatable: true,  desc: '2칸 분배기. 화살표(앞)로 출력. 무필터=교대, 필터=지정 칸으로 배출.' },
  grabber:   { cat: 'logistics', name: '집게',          w: 3, h: 1, img: 'grabber.png',   color: '#8a5a3a', rotatable: true,  desc: '화물을 집어 반대편에 배치한다. 필터가 없는 경우 랜덤하게 집는다.' },
  longgrabber: { cat: 'logistics', name: '긴팔 집게',    w: 5, h: 1, img: 'grabber.png', color: '#9a6a3a', rotatable: true, unlock: '긴팔집게', tier: 1, powerUse: 0, desc: '2칸 너머에 있는 물체→잡아서 반대쪽에 놓음.' },
  tunnel:    { cat: 'logistics', name: '터널',          w: 5, h: 1, img: 'tunnel.png',    color: '#46506a', rotatable: true, unlock: '터널', desc: '3칸을 건너뛰고 화물을 보낸다.' },
  warehouse: { cat: 'logistics', name: '창고',          w: 3, h: 3, img: 'warehouse.png', color: '#3a5a4a', rotatable: false, desc: '어디든 연결하면 화물을 저장할 수 있다.' },

  penbox:    { cat: 'production', name: '우리',          w: 3, h: 3, img: 'penbox.png',    color: '#4a6a3a', rotatable: false, variable: true, desc: '드래그로 설치/확장. 여러 번 확장하면 비정형 가능. 1칸당 성체5/새끼10 수용. 클릭=이름. X를 누른 채 드래그하면 그 범위의 우리 칸을 철거.' },
  birthing:  { cat: 'production', name: '출산대',        w: 2, h: 2, img: 'birthing.png',  color: '#7a3a5a', rotatable: true,  desc: '성체실장이 새끼를 낳도록 돕는다.' },
  reformer:  { cat: 'production', name: '노동 교화소', w: 2, h: 2, img: 'reformer.png',  color: '#4a5a7a', rotatable: true, unlock: '노동교화소', tier: 1, powerUse: 10, powerRequired: true, accept: ['독라'],
               desc: '독라 성체 → 노동석. 클릭=명령(회수/방어/대기/채취)· 대기 시 가까운 교화소 인근에서 머묾. 노동석의 최대치는 노동교화소 수에 비례한다' },

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
  mixer:      { cat: 'processing', name: '배합기',   w: 2, h: 2, img: 'mixer.png',      color: '#6a4a7a', rotatable: true, unlock: '배합기', tier: 1, powerUse: 0, desc: '분쇄육1+운치10→실장푸드50. 짓소산1+실장푸드50→짓소산푸드50. 조미료1+실장푸드50→우마이푸드50. 철조각1+실장푸드50→다이어트푸드50. 일꾼 슬롯3.',
                worker: true, accept: ['분쇄육', '운치', '짓소산', '실장푸드', '조미료', '철조각'], time: 2 },
  cookery:    { cat: 'processing', name: '조리실',   w: 3, h: 2, img: 'cookery.png',    color: '#b5723a', rotatable: true, unlock: '조리실', tier: 1, powerUse: 0, desc: '구더기/엄지3+조미료→꼬치훈제, 구더기/엄지3+짓소산→실장무침, 분쇄육2+짓소산→실장젓갈. 일꾼 슬롯3.',
                worker: true,
                accept: ['구더기', '분쇄육', '엄지', '짓소산', '조미료'],
                cook: {
                  구더기: { n: 3, out: '꼬치훈제', seasoning: '조미료' },
                  엄지: { n: 3, out: '꼬치훈제', seasoning: '조미료' },
                  '구더기+짓소산': { n: 3, mat: '구더기', out: '실장무침', seasoning: '짓소산' },
                  '엄지+짓소산': { n: 3, mat: '엄지', out: '실장무침', seasoning: '짓소산' },
                  분쇄육: { n: 2, out: '실장젓갈', seasoning: '짓소산' },
                },
                time: 3 },
  acidgen:    { cat: 'processing', name: '짓소산 생성기', w: 3, h: 3, img: 'acidgen.png', color: '#2f8f75', rotatable: true, unlock: '짓소산생성기', tier: 2, powerUse: 30, powerRequired: true, desc: '성체실장 1마리의 행복을 5씩 짜낸다. 행복 5가 떨어질 때마다 짓소산 1개, 행복이 0이 되면 분쇄육 1개를 만든다.',
                accept: ['성체실장'], time: 10 },

  // ---- 특수 장치 (1x1, 영향 범위 range) -------------------------------
  speaker: { cat: 'special', name: '태교 스피커', w: 1, h: 1, img: 'speaker.png', color: '#4a7ab5', rotatable: false, range: { w: 3, h: 3 }, special: 'nurture', unlock: '태교스피커', desc: '3×3 범위 안 출산대에서 태어난 실장석의 육질/개념을 확률적으로 +1.' },
  wall: { cat: 'defense', name: '벽', w: 1, h: 1, img: 'wall.png', color: '#d6a85a', rotatable: false, desc: '타일 모서리 점에서 시작해 수평/수직 직선으로 설치. 체력 50' },
  turret: { cat: 'defense', name: '자동 포탑', w: 1, h: 1, img: 'turret.PNG', color: '#b5524a', rotatable: false, special: 'turret', tier: 0, powerUse: 0, desc: '사거리 안 침입/외부 실장석을 자동 사격.' },
  sniper: { cat: 'defense', name: '저격 포탑', w: 1, h: 1, img: 'sniper.png', color: '#7a8fb5', rotatable: false, special: 'turret', sniper: true, unlock: '저격터렛', tier: 2, powerUse: 45, powerRequired: true, desc: '자동 포탑보다 느리지만 강하고 먼 거리를 쏜다.' },
  mine: { cat: 'defense', name: '지뢰', w: 1, h: 1, img: 'mine.png', color: '#5b4a38', rotatable: false, special: 'mine', unlock: '지뢰', tier: 1, powerUse: 0, desc: '침입 실장석이 밟으면 폭발해 주변 5타일 크기 원형에 피해를 준다.' },
  mortar: { cat: 'defense', name: '박격포', w: 1, h: 1, img: 'canon.png', color: '#6b6f7a', rotatable: false, special: 'turret', mortar: true, unlock: '박격포', tier: 3, powerUse: 100, powerRequired: true, desc: '5초마다 포탄을 발사. 포탄은 날아가 3타일 크기 원형에 피해를 준다.' },
  door: { cat: 'defense', name: '문', w: 1, h: 3, img: 'door.png', color: '#a98a5a', rotatable: false, special: 'door', edgeBuilt: true, desc: '벽 위(연속 3칸)에만 설치. 설치하면 그 자리 벽이 문이 된다. 노동석만 통과 가능, 외부·침입 실장석은 막힌다. 노동석은 벽에 막히면 문을 경유해 이동.' },
  pointer: { cat: 'special', name: '레드 포인터', w: 1, h: 1, img: 'pointer.png', color: '#d23a3a', rotatable: true, range: { w: 1, h: 5 }, special: 'birth', unlock: '레드포인터', desc: '바라보는 방향 앞쪽 5칸 범위 출산대의 출산 속도 ↑(R로 방향 전환).' },
  catcher: { cat: 'special', name: '포획기', w: 1, h: 1, img: 'catcher.png', color: '#3a8a6a', rotatable: true, range: { w: 5, h: 5 }, special: 'catch', filterable: true, unlock: '포획기', tier: 2, powerUse: 15, powerRequired: true, desc: '5×5 범위 배회 실장석을 출력칸으로 모음(필터).' },
  skewer: { cat: 'special', name: '꼬챙이', w: 1, h: 1, img: 'skewer_dev.png', color: '#9a6a2a', rotatable: false, inPen: true, range: { w: 5, h: 5 }, special: 'skewer', unlock: '꼬챙이', tier: 1, powerUse: 0, desc: '우리 안에도 설치 가능. 자실장/성체실장만 올리면 고정. 1분 후 파괴. 주변 5×5 범위 개념 상승(확률).' },
  feeder: { cat: 'special', name: '사료분배기', w: 1, h: 1, img: 'feeder.png', color: '#7a8a3a', rotatable: false, inPen: true, range: { w: 5, h: 5 }, special: 'feed', desc: '우리 안에도 설치 가능. 주변 5×5 실장석에게 선택한 사료(실장푸드/짓소산 푸드/운치)를 배급한다. 실장석은 사료가 없어도 보통 속도로 성장하고, 배급받으면 성장 2배 및 사료별 효과를 받는다.' },
  techica: { cat: 'special', name: '매지컬 테치카', w: 1, h: 1, img: 'techica.png', color: '#c86ab0', rotatable: false, inPen: true, range: { w: 7, h: 7 }, special: 'techica', accept: ['새끼사육실장'], unlock: '매지컬테치카', tier: 2, powerUse: 35, powerRequired: true, desc: '우리 안에도 설치 가능(1칸). 사육실장 새끼만 장착. 주변 7×7 실장석의 행복 0.5/초·육질 0.1/초 상승 및 유인. 1분 후 장착 개체는 개념 0으로 배출.' },
  lab: { cat: 'special', name: '연구소', w: 3, h: 3, img: 'lab_ready.png', color: '#5e78a8', rotatable: false, special: 'lab', accept: '*', desc: '실장석 최대 8마리 장착. 예약된 연구가 있으면 연구력을 생산한다. 연구소 설치비는 지을 때마다 2배, 4개째부터 철조각도 필요.' },
  // 콜로니 센터: 게임 시작 시 기본 배치(메뉴에 없음). 이동 가능·철거 불가·창고 기능.
  colony: { cat: 'production', name: '콜로니 센터', w: 5, h: 5, img: 'colony.png', color: '#5a6a8a', rotatable: false, colony: true, desc: '공장의 중심. 티어를 올리는데 필요하다. 창고처럼 기능하기도 한다.' },
  // 포장기: 가공 탭. 철조각을 곁들여 통조림/진공포장 가공.
  packer: { cat: 'processing', name: '포장기', w: 3, h: 3, img: 'packer.png', color: '#7b6a42', rotatable: true, tier: 2, powerUse: 25, powerRequired: true,
            accept: ['분쇄육', '실장육', '철조각'], time: 1.5,
            desc: '분쇄육1+철조각1→통조림1. 실장육1+철조각1→진공포장1.' },
  // 물류센터: 물류 탭. 화물/실장석을 넣으면 즉시 판매(옛 포장기 역할).
  salecenter: { cat: 'logistics', name: '물류센터', w: 4, h: 4, img: 'salecenter.png', color: '#3a5a7a', rotatable: false, special: 'pack', upgradable: true, unlock: '물류센터', tier: 2, powerUse: 30, powerRequired: true, desc: '판매 가능한 화물·실장석이 들어오는 즉시 판매됨.' },
  jisoucharge: { cat: 'power', name: '실장력 발전소', w: 2, h: 2, img: 'jisoucharge.png', color: '#6a9a72', rotatable: false, tier: 0, power: 20, accept: ['성체실장'], desc: '성체실장 장착 시 초당 전력 20. 장착 개체 HP가 초당 0.1 감소, 소진 시 실장육 배출.' },
  firecharge: { cat: 'power', name: '화력 발전소', w: 3, h: 3, img: 'firecharge.png', color: '#a65a3a', rotatable: false, unlock: '화력발전소', tier: 2, power: 150, desc: '실장석/운치/분쇄육/실장육을 태워 초당 전력 150.' },
  chaoscharge: { cat: 'power', name: '카오스 발전소', w: 4, h: 4, img: 'chaoscharge.png', color: '#7b4faf', rotatable: false, unlock: '카오스발전소', tier: 3, power: 480, desc: '위석을 연료로 쓰며, 성체실장 12마리 장착 후 시동.' },
  woodpole: { cat: 'power', name: '나무 전봇대', w: 1, h: 1, img: 'woodpole.png', color: '#9a7244', rotatable: false, tier: 0, pole: true, desc: '5×5 전력 보급, 11×11 범위 안 전력망에 연결.' },
  ironpole: { cat: 'power', name: '철 전봇대', w: 1, h: 1, img: 'ironpole.png', color: '#8c9aa6', rotatable: false, unlock: '철전봇대', tier: 2, pole: true, desc: '9×9 전력 보급, 21×21 범위 안 전력망에 연결.' },
  chaospole: { cat: 'power', name: '카오스 전봇대', w: 1, h: 1, img: 'chaospole.png', color: '#7f5cc0', rotatable: false, unlock: '카오스전봇대', tier: 3, pole: true, desc: '17×17 전력 보급, 48×48 범위 안 전력망에 연결.' },
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
  lab: 500,
  salecenter: 3000,
  turret: 1000,
  sniper: 2500,
  mine: 200,
  mortar: 10000,
  packer: 3000,
  wall: 100,
  door: 500,
  jisoucharge: 100,
  firecharge: 2000,
  chaoscharge: 5000,
  woodpole: 100,
  ironpole: 500,
  chaospole: 2000,
};

/* ---- 공원 설치 아이템 (실장석이 가져가면 출산 확률 ↑) ------------------ */
G.PARK_ITEMS = {
  박스:     { cost: 30, label: '📦 박스', color: '#b9844a' },
  실장푸드: { cost: 10, label: '🥩 실장푸드', color: '#7a4' },
  물병:     { cost: 20, label: '💧 물병', color: '#5ad' },
};

/* ---- 공원 업그레이드 (연구 탭) ----------------------------------------- */
G.UPGRADES = [
  { key: '애호파', name: '애호파 공원', desc: '사육실장 등장 확률 ↑', cost: 350 },
  { key: '학대파', name: '학대파 공원', desc: '독라 등장 확률 ↑', cost: 350 },
  { key: '기초교육', name: '기초교육', desc: '등장 실장석 개념 +3~5/레벨', cost: 250 },
  { key: '필라테스', name: '필라테스', desc: '등장 실장석 육질 +3~5/레벨', cost: 250 },
  { key: '실장푸드뿌리기', name: '실장푸드 뿌리기', desc: '등장 실장석 크기 +3~5/레벨', cost: 250 },
  { key: '가드레일벨트', name: '가드레일 벨트', desc: '물류 탭에 가드레일 벨트를 해금합니다.', cost: 1000, maxLevel: 1 },
  { key: '횡단벨트', name: '횡단벨트', desc: '물류 탭에 횡단벨트를 해금합니다.', cost: 200, maxLevel: 1 },
  { key: '터널', name: '터널', desc: '물류 탭에 터널을 해금합니다.', cost: 1000, maxLevel: 1 },
  { key: '긴팔집게', name: '긴팔 집게', desc: '물류 탭에 긴팔 집게를 해금합니다.', cost: 1000, maxLevel: 1, tier: 1 },
  { key: '노동교화소', name: '노동 교화소', desc: '생산 탭에 노동 교화소를 해금합니다.', cost: 6000, maxLevel: 1, tier: 1 },
  { key: '교정시설', name: '교정시설', desc: '가공 탭에 교정시설을 해금합니다.', cost: 2000, maxLevel: 1, tier: 1 },
  { key: '배합기', name: '배합기', desc: '가공 탭에 배합기를 해금합니다.', cost: 1000, maxLevel: 1, tier: 1 },
  { key: '조리실', name: '조리실', desc: '가공 탭에 조리실을 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '짓소산생성기', name: '짓소산 생성기', desc: '가공 탭에 짓소산 생성기를 해금합니다.', cost: 10000, maxLevel: 1, tier: 2 },
  { key: '태교스피커', name: '태교스피커', desc: '특수 탭에 태교스피커를 해금합니다.', cost: 2000, maxLevel: 1, tier: 1 },
  { key: '레드포인터', name: '레드포인터', desc: '특수 탭에 레드포인터를 해금합니다.', cost: 4000, maxLevel: 1, tier: 1 },
  { key: '포획기', name: '포획기', desc: '특수 탭에 포획기를 해금합니다.', cost: 4000, maxLevel: 1, tier: 2 },
  { key: '꼬챙이', name: '꼬챙이', desc: '특수 탭에 꼬챙이를 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '매지컬테치카', name: '매지컬 테치카', desc: '특수 탭에 매지컬 테치카를 해금합니다.', cost: 8000, maxLevel: 1, tier: 2 },
  { key: '저격터렛', name: '저격 터렛', desc: '방어 탭에 저격 터렛을 해금합니다.', cost: 10000, maxLevel: 1, tier: 2 },
  { key: '지뢰', name: '지뢰', desc: '방어 탭에 지뢰를 해금합니다.', cost: 5000, maxLevel: 1, tier: 1 },
  { key: '박격포', name: '박격포', desc: '방어 탭에 박격포를 해금합니다.', cost: 50000, maxLevel: 1, tier: 3 },
  { key: '총알개조', name: '총알 개조', desc: '모든 터렛 공격력 +10/레벨', cost: 2000, costMult: 2, maxLevel: 20, tier: 1 },
  { key: '레일속도', name: '레일 속도 증가', desc: '컨베이어 벨트 속도 +30%/레벨', cost: 500, costMult: 2, maxLevel: 20, tier: 1 },
  { key: '집게속도', name: '집게 속도 증가', desc: '집게 속도 +30%/레벨', cost: 500, costMult: 2, maxLevel: 20, tier: 1 },
  { key: '카오스연구', name: '카오스 연구', desc: '연구소 장착 실장석 1마리당 연구력 +1/초/레벨', cost: 2000, costMult: 2, tier: 2 },
  { key: '물류센터', name: '물류센터', desc: '물류 탭에 물류센터를 해금합니다.', cost: 5000, maxLevel: 1, tier: 2 },
  { key: '화력발전소', name: '화력 발전소', desc: '전력 탭에 화력 발전소를 해금합니다.', cost: 20000, maxLevel: 1, tier: 2 },
  { key: '카오스발전소', name: '카오스 발전소', desc: '전력 탭에 카오스 발전소를 해금합니다.', cost: 50000, maxLevel: 1, tier: 3 },
  { key: '철전봇대', name: '철 전봇대', desc: '전력 탭에 철 전봇대를 해금합니다.', cost: 10000, maxLevel: 1, tier: 2 },
  { key: '카오스전봇대', name: '카오스 전봇대', desc: '전력 탭에 카오스 전봇대를 해금합니다.', cost: 50000, maxLevel: 1, tier: 3 },
];

/* ---- 실장석 대사 ------------------------------------------------------- */
G.LINES = {
  // 세면대 분류 직후 외치는 대사
  wash:   { 구더기: '레후~', 엄지: '레치!', 자실장: '테치~!' },
  // 컨베이어 벨트 위에서 간헐적으로
  belt:   { 구더기: '프니프니는 아직인레후?', 엄지: '우마우마한 것을 대령하는 레치~', 자실장: '사육실장으로 가는 레드로드테치',
    성체실장: ['이 길은 어디로 가는데스', '실려가는 기분이 묘한데스', '컨베이어는 편한데스~', '도착지가 도축장은 아닌데스?', '바람을 가르는데스'] },
  // 배회 중 간헐적으로
  wander: { 구더기: '핀치레후', 엄지: '도망가는레치', 자실장: '자유를 찾아떠나는테치',
    성체실장: ['우마우마한것을 찾는데스', '심심해 죽겠는데스', '닝겐은 어디있는데스', '세레브한 삶을 원하는데스', '운치 냄새가 진동하는데스', '오늘도 평화로운데스', '배가 고픈데스…', '자실장들은 잘 크고 있는데스?', '와타시가 제일 우마우마한데스'] },
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
  // 행복이 0이 되어 행복회로에 빠졌을 때 머리 위 표시
  happyCircuit: '행복회로!',
};

/* ---- 교정시설 수치 ----------------------------------------------------- */
G.CORRECTION = { LINE_MIN: 1.5, LINE_MAX: 3.5, ESCAPE_CONCEPT: 20, ESCAPE_CHANCE: 0.3, GRAD_CONCEPT: 30, GRAD_TIME: 30 };

/* ---- 자동 포탑 개별 업그레이드 (포탑 클릭 → 업그레이드 창) --------------
 *  비용 = base × (현재레벨 + 1) */
G.TURRET_UP = {
  dmg:   { label: '공격력', base: 300, max: 20 },
  rate:  { label: '연사',   base: 300, max: 10 },
  range: { label: '사거리', base: 400, max: 8 },
};

/* 카테고리별 하위메뉴 */
G.MENU = {
  logistics:  { label: '물류', items: ['belt', 'guardbelt', 'crossbelt', 'tunnel', 'sorter', 'grabber', 'longgrabber', 'warehouse', 'salecenter'] },
  defense:     { label: '방어', items: ['wall', 'door', 'turret', 'sniper', 'mine', 'mortar'] },
  production:  { label: '생산', items: ['penbox', 'birthing', 'reformer', 'washbasin'] },
  processing:  { label: '가공', items: ['washbasin', 'slaughter', 'deshell', 'grinder', 'correction', 'mixer', 'cookery', 'acidgen', 'packer'] },
  special:     { label: '특수', items: ['speaker', 'pointer', 'catcher', 'skewer', 'feeder', 'techica', 'lab'] },
  power:       { label: '전력', items: ['jisoucharge', 'firecharge', 'chaoscharge', 'woodpole', 'ironpole', 'chaospole'] },
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
  research: 'assets/sounds/sfx/11.mp3',
};
G.BGM = [
  'assets/sounds/bgm/fight.mp3',
  'assets/sounds/bgm/maze.mp3',
  'assets/sounds/bgm/quiet.mp3',
];
G.BGM_RAID = 'assets/sounds/bgm/raid.mp3';        // 침입(레이드) 중 배경음
G.BGM_TECHICA = 'assets/sounds/bgm/techica.mp3';  // 매지컬 테치카 가동 + 확대 중 배경음
G.BG = {
  park: 'assets/images/backgrounds/park.png',       // 공원 배경(전체 1장, 권장 1440x786)
  factory: 'assets/images/backgrounds/factory.png', // 공장 전체 배경(화면 고정, 1152x720 권장)
  tile: 'assets/images/backgrounds/tile.png',        // 공장 바닥 타일(칸마다 반복, 정사각 권장 48x48/96x96…)
};
