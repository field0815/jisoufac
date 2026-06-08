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
  GRID_COLS: 1008,    // 공장 전체 가로 칸 수 (대형 필드)
  GRID_ROWS: 1008,   // 공장 전체 세로 칸 수
  GIVEN_COLS: 48,     // 시작 시 주어지는 영역(정중앙)
  GIVEN_ROWS: 48,
  LAND_GRID_SIZE: 48,  // 시작 필드 바깥 토지 구매 단위
  LAND_BASE_COST: 1000,
  LAND_COST_MULT: 1.5,
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
  BREED_VARIANCE: 10,

  // 크기 유전 비율 (성체 크기 대비)
  SIZE_RATIO: { 점액덩어리: 0.25, 구더기: 0.25, 엄지: 1 / 3, 자실장: 0.5, 성체실장: 1.0, 새끼사육실장: 0.4, 사육실장: 1.0, 새끼독라: 0.4, 독라: 1.0 },

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
  NURTURE_CHANCE: 0.35,     // 태교 스피커: 초당 스탯 +1 확률
  SKEWER_CHANCE: 0.4,       // 꼬챙이: 초당 육질 +1 확률
  BIRTH_BOOST: 2,           // 레드 포인터: 출산 속도 배수
  FEED_GROWTH_MULT: 2,      // 사료분배기: 성장/사료 소모 배수
  CATCH_INTERVAL: 1.0,      // 포획기: 수거 주기(초)

  // ---- 거래(상점) -------------------------------------------------------
  FOOD_PRICE: 1,            // 실장푸드 1개 구매가
  BUY_ADULT: 120,           // 성체실장 구매가
  BUY_CHILD: 40,            // 자실장 구매가
  SEASONING_BASE: 30,       // 조미료 시작 가격
  SEASONING_MIN: 5,         // 조미료 최소 가격
  SEASONING_TICK: 60,       // 조미료 가격 변동 주기(초)
  SEASONING_SWING: 10,      // 조미료 가격 변동폭(±1~SWING)

  // ---- 포식 ------------------------------------------------------------
  EAT_CHANCE: 0.06,         // 성체가 근처 새끼를 잡아먹거나 사육실장을 공격할 확률(초당)
  EAT_RANGE: 1.1,           // 포식/공격/도망 반응 거리(칸)
  FLEE_TIME: 2.0,           // '테챠아!' 도망 지속(초)
  ATTACK_DMG: 5,            // 사육실장 공격당 육질 데미지 (0 되면 독라로 변함)

  FOOD_RATE: { 성체실장: 5, 자실장: 3, 엄지: 2, 구더기: 1, 사육실장: 5, 새끼사육실장: 3, 독라: 5, 새끼독라: 3 }, // 분당 실장푸드 소모
  UNCHI_MULT: 2,            // 먹은 푸드 *2 만큼 운치 배설
  GROW_TIME: 180,           // 3분마다 한 단계 성장
  PET_SIZE_RATE: 0.15,      // 사육실장(성체) 크기 증가 속도/초 (최대 100)
  GROWTH_NEXT: { 구더기: '엄지', 엄지: '자실장', 자실장: '성체실장', 새끼사육실장: '사육실장', 새끼독라: '독라' },

  // ---- 분쇄기 / 배합기 -------------------------------------------------
  GRIND_TARGET: 50,        // 무게 50 채우면 분쇄육 1개
  UNCHI_WEIGHT: 10,
  MIX_FOOD: 50,             // 배합기: 분쇄육1 + 운치10 → 실장푸드 50
  MIX_UNCHI: 10,            // 배합기 1회 산출에 필요한 운치 개수

  // 배회 개체 속도 (칸/초): 성체 빠르고 어릴수록 느림
  WANDER_SPEED: { 성체실장: 1.6, 자실장: 1.1, 엄지: 0.8, 구더기: 0.5, 점액덩어리: 0.4 },
  MOVE_SCALE: 2 / 3,        // 모든 실장석 이동속도 배수
  // 표시 크기 배율(성체=1 기준): 자실장 2/3, 엄지·구더기·점액 1/2
  DISPLAY_SCALE: { 자실장: 2 / 3, 엄지: 1 / 2, 구더기: 1 / 2, 점액덩어리: 1 / 2, 새끼사육실장: 2 / 3, 새끼독라: 2 / 3 },

  // 애니메이션 (모든 에셋 4프레임)
  ANIM_FPS: 6,              // 초당 프레임(4프레임 순환)

  // 치트
  CHEAT_MONEY: 999999,
  CHEAT_CREATURES: 10,
  START_MONEY: 5000,
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
  운치:     { color: '#964', img: 'unchi.png',  isProduct: false, size: 10 }, // 자원(배설물)
  // 조리실 요리 (실장육보다 비싼 고급 화물, 고정가)
  꼬치훈제: { color: '#c8862a', img: 'skewer.png',  isProduct: true, flatPrice: 280 },
  통조림:   { color: '#9aa6b0', img: 'can.png',     isProduct: true, flatPrice: 320 },
  진공포장: { color: '#7aa0c0', img: 'vacuum.png',  isProduct: true, flatPrice: 300 },
  실장젓갈: { color: '#b06a6a', img: 'jeotgal.png', isProduct: true, flatPrice: 260 },
  실장무침: { color: '#c89a4a', img: 'muchim.png',  isProduct: true, flatPrice: 290 },
};

/* 등급: 3스탯 중 최고값 기준 */
G.GRADES = [
  { max: 25, label: '최하', color: '#9aa' },
  { max: 50, label: '하',   color: '#7c9' },
  { max: 75, label: '중',   color: '#5bf' },
  { max: 99, label: '상',   color: '#fb5' },
  { max: Infinity, label: '특상', color: '#f7a' },
];

/* ---- 가격 공식 계수 (게임 중 통계창에서 수정 가능) ---------------------- */
G.PRICE_DEFAULTS = {
  // 실장육(도축기 산출): 육질·크기 비례
  실장육:   { base: 10, 육질: 2,  크기: 2 },
  // 사육실장(우리 판매): 개념 비례 + 크기 반비례(작을수록 비쌈). 새끼사육실장도 이 계수 사용.
  사육실장: { base: 20, 개념: 2,  크기역기준: 60, 크기역: 1 },
  // 독라(우리 판매): 육질·크기 비례. 새끼독라도 이 계수 사용.
  독라:     { base: 8,  육질: 2,  크기: 1 },
};

/* ---- 장치 정의 --------------------------------------------------------- */
G.DEVICES = {
  belt:      { cat: 'logistics', name: '컨베이어 벨트', w: 1, h: 1, img: 'belt.png',      color: '#5a5f6a', rotatable: true,  desc: '화물 운반. 클릭=연장 / 드래그=경로대로 꺾임.' },
  guardbelt: { cat: 'logistics', name: '가드레일 벨트', w: 1, h: 1, img: 'belt.png',      color: '#4f778a', rotatable: true, unlock: '가드레일벨트', desc: '실장석이 정체되어도 밖으로 빠져나가지 않는 벨트.' },
  crossbelt: { cat: 'logistics', name: '횡단 벨트',     w: 3, h: 1, img: 'crossbelt.png', color: '#6a6f7a', rotatable: true, unlock: '횡단벨트', desc: '입구에서 출구로 화물을 순간이동시켜 중간 칸을 건너뜀.' },
  sorter:    { cat: 'logistics', name: '분류기',        w: 1, h: 2, img: 'sorter.png',    color: '#7a6a3a', rotatable: true,  desc: '2칸 분배기. 화살표(앞)로 출력. 무필터=교대, 필터=지정 칸으로 배출.' },
  grabber:   { cat: 'logistics', name: '집게',          w: 3, h: 1, img: 'grabber.png',   color: '#8a5a3a', rotatable: true,  desc: '□에 조건 맞는 물체→잡아서 △에 놓음(△가 빈 바닥이면 풀어줌).' },
  tunnel:    { cat: 'logistics', name: '터널',          w: 5, h: 1, img: 'tunnel.png',    color: '#46506a', rotatable: true, unlock: '터널', desc: '입구에서 출구로 화물을 순간이동시킴. 중간 칸에는 건설 가능.' },
  warehouse: { cat: 'logistics', name: '창고',          w: 3, h: 3, img: 'warehouse.png', color: '#3a5a4a', rotatable: false, desc: '도착 화물 저장. 거래창에서 판매. 사방이 입구.' },

  penbox:    { cat: 'production', name: '우리',          w: 3, h: 3, img: 'penbox.png',    color: '#4a6a3a', rotatable: false, variable: true, desc: '드래그로 크기 지정. 1칸당 성체5/새끼10 수용. 클릭=이름.' },
  birthing:  { cat: 'production', name: '출산대',        w: 2, h: 2, img: 'birthing.png',  color: '#7a3a5a', rotatable: true,  desc: '성체실장→10초마다 구더기(수명 180초).' },

  washbasin:  { cat: 'processing', name: '세면대',   w: 2, h: 1, img: 'washbasin.png',  color: '#3a5a7a', rotatable: true, desc: '점액덩어리 세척→구더기/엄지/자실장(1/3). 구더기는 변환하지 않음. 일꾼 슬롯3.',
                worker: true, accept: ['점액덩어리'], time: 3 },
  slaughter:  { cat: 'processing', name: '도축기',   w: 3, h: 3, img: 'slaughter.png',  color: '#a23a3a', rotatable: true, desc: '독라 태그만→실장육. 일꾼 슬롯3.',
                worker: true, accept: ['독라', '새끼독라'], output: '실장육', time: 3 },
  deshell:    { cat: 'processing', name: '탈복기',   w: 4, h: 2, img: 'deshell.png',    color: '#7a7a3a', rotatable: true, desc: '성체실장/사육실장→독라, 자실장/새끼사육→새끼독라. 일꾼 슬롯3.',
                worker: true, accept: ['성체실장', '자실장', '사육실장', '새끼사육실장'], convert: { 성체실장: '독라', 자실장: '새끼독라', 사육실장: '독라', 새끼사육실장: '새끼독라' }, time: 4 },
  grinder:    { cat: 'processing', name: '분쇄기',   w: 2, h: 2, img: 'grinder.png',    color: '#5a5a5a', rotatable: true, desc: '실장석류·실장육→분쇄육(0.2초당 1마리, 무게 100=1개).',
                accept: ['성체실장', '자실장', '엄지', '구더기', '사육실장', '새끼사육실장', '독라', '새끼독라', '실장육'], output: '분쇄육', time: 0.2 },
  correction: { cat: 'processing', name: '교정시설', w: 3, h: 3, img: 'correction.png', color: '#3a7a6a', rotatable: true, unlock: '교정시설', desc: '자실장·성체실장 6마리 수용. 사육실장 성체 장착 시 개념이 높을수록 교육 효율 증가. 육질0→실장육, 개념30↑·30초↑→사육실장 계열.',
                accept: ['자실장', '성체실장'], hold: 6 },
  mixer:      { cat: 'processing', name: '배합기',   w: 2, h: 2, img: 'mixer.png',      color: '#6a4a7a', rotatable: true, unlock: '배합기', desc: '분쇄육1 + 운치10 → 실장푸드 50. 일꾼 슬롯3.',
                worker: true, accept: ['분쇄육', '운치'], time: 2 },
  cookery:    { cat: 'processing', name: '조리실',   w: 3, h: 2, img: 'cookery.png',    color: '#b5723a', rotatable: true, unlock: '조리실', desc: '재료+조미료→요리. 구더기5=꼬치훈제 / 실장육2=통조림 / 독라1=진공포장 / 분쇄육2=실장젓갈 / 엄지·자실장3=실장무침. 일꾼 슬롯3.',
                worker: true,
                accept: ['구더기', '실장육', '독라', '분쇄육', '엄지', '자실장'],
                cook: { 구더기: { n: 5, out: '꼬치훈제' }, 실장육: { n: 2, out: '통조림' }, 독라: { n: 1, out: '진공포장' }, 분쇄육: { n: 2, out: '실장젓갈' }, 엄지: { n: 3, out: '실장무침' }, 자실장: { n: 3, out: '실장무침' } },
                time: 3 },

  // ---- 특수 장치 (1x1, 영향 범위 range) -------------------------------
  speaker: { cat: 'special', name: '태교 스피커', w: 1, h: 1, img: 'speaker.png', color: '#4a7ab5', rotatable: false, range: { w: 3, h: 3 }, special: 'nurture', unlock: '태교스피커', desc: '3×3 범위 실장석의 육질/개념/크기를 확률적으로 +1.' },
  wall: { cat: 'special', name: '벽', w: 1, h: 1, img: 'wall.png', color: '#d6a85a', rotatable: false, desc: '타일 모서리 점에서 시작해 수평/수직 직선으로 설치. 드래그 선택 후 Del=삭제.' },
  pointer: { cat: 'special', name: '레드 포인터', w: 1, h: 1, img: 'pointer.png', color: '#d23a3a', rotatable: true, range: { w: 1, h: 5 }, special: 'birth', unlock: '레드포인터', desc: '1×5 범위 출산대의 출산 속도 ↑(R로 방향 전환).' },
  catcher: { cat: 'special', name: '포획기', w: 1, h: 1, img: 'catcher.png', color: '#3a8a6a', rotatable: true, range: { w: 5, h: 5 }, special: 'catch', filterable: true, unlock: '포획기', desc: '5×5 범위 배회 실장석을 출력칸으로 모음(필터).' },
  skewer: { cat: 'special', name: '꼬챙이', w: 1, h: 1, img: 'skewer_dev.png', color: '#9a6a2a', rotatable: false, range: { w: 3, h: 3 }, special: 'skewer', unlock: '꼬챙이', desc: '실장석을 올리면 고정(테겍 테겍). 1분 후 파괴. 3×3 범위 육질 상승(확률).' },
  feeder: { cat: 'special', name: '사료분배기', w: 1, h: 1, img: 'feeder.png', color: '#7a8a3a', rotatable: true, range: { w: 3, h: 5 }, special: 'feed', unlock: '사료분배기', desc: '3×5 범위 실장석 성장 2배(사료도 2배 소모, R로 방향 전환).' },
  packer: { cat: 'special', name: '포장기', w: 3, h: 3, img: 'warehouse.png', color: '#7b6a42', rotatable: true, special: 'pack', desc: '판매 가능한 물자가 들어오는 즉시 판매됨.' },
};

G.BUILD_COST = {
  belt: 10,
  guardbelt: 50,
  crossbelt: 50,
  tunnel: 100,
  sorter: 20,
  grabber: 30,
  warehouse: 500,
  penboxCell: 30,
  birthing: 200,
  washbasin: 100,
  slaughter: 500,
  deshell: 300,
  grinder: 200,
  correction: 1000,
  mixer: 500,
  cookery: 2000,
  speaker: 1000,
  pointer: 2000,
  catcher: 2000,
  skewer: 3000,
  feeder: 3000,
  packer: 3000,
  wall: 10,
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
  { key: '교정시설', name: '교정시설', desc: '가공 탭에 교정시설을 해금합니다.', cost: 2000, maxLevel: 1 },
  { key: '배합기', name: '배합기', desc: '가공 탭에 배합기를 해금합니다.', cost: 1000, maxLevel: 1 },
  { key: '조리실', name: '조리실', desc: '가공 탭에 조리실을 해금합니다.', cost: 5000, maxLevel: 1 },
  { key: '태교스피커', name: '태교스피커', desc: '특수 탭에 태교스피커를 해금합니다.', cost: 2000, maxLevel: 1 },
  { key: '레드포인터', name: '레드포인터', desc: '특수 탭에 레드포인터를 해금합니다.', cost: 4000, maxLevel: 1 },
  { key: '포획기', name: '포획기', desc: '특수 탭에 포획기를 해금합니다.', cost: 4000, maxLevel: 1 },
  { key: '꼬챙이', name: '꼬챙이', desc: '특수 탭에 꼬챙이를 해금합니다.', cost: 5000, maxLevel: 1 },
  { key: '사료분배기', name: '사료분배기', desc: '특수 탭에 사료분배기를 해금합니다.', cost: 5000, maxLevel: 1 },
  { key: '레일속도', name: '레일 속도 증가', desc: '컨베이어 벨트 속도 +30%/레벨', cost: 500, costMult: 2, maxLevel: 20 },
  { key: '집게속도', name: '집게 속도 증가', desc: '집게 속도 +30%/레벨', cost: 500, costMult: 2, maxLevel: 20 },
];

/* ---- 실장석 대사 ------------------------------------------------------- */
G.LINES = {
  // 세면대 분류 직후 외치는 대사
  wash:   { 구더기: '레후~', 엄지: '레치!', 자실장: '테치~!' },
  // 컨베이어 벨트 위에서 간헐적으로
  belt:   { 구더기: '프니프니는 아직인레후?', 엄지: '우마우마한 것을 대령하는 레치~', 자실장: '사육실장으로 가는 레드로드테치', 성체실장: '이 길은 어디로 가는데스' },
  // 배회 중 간헐적으로
  wander: { 구더기: '핀치레후', 엄지: '도망가는레치', 자실장: '자유를 찾아떠나는테치', 성체실장: '우마우마한것을 찾는데스' },
  // 교정시설 자실장 대사
  correction: ['주인님께 반항하면 안되는테치', '운치를 잘 관리하는테치', '세상은 무서운테치'],
  correctionEscape: '똥닝겐은 스시와 스테이크를 대령하는테치',
};

/* ---- 교정시설 수치 ----------------------------------------------------- */
G.CORRECTION = { LINE_MIN: 1.5, LINE_MAX: 3.5, ESCAPE_CONCEPT: 20, ESCAPE_CHANCE: 0.3, GRAD_CONCEPT: 30, GRAD_TIME: 30 };

/* 카테고리별 하위메뉴 */
G.MENU = {
  logistics:  { label: '물류', items: ['belt', 'guardbelt', 'crossbelt', 'tunnel', 'sorter', 'grabber', 'warehouse'] },
  production:  { label: '생산', items: ['penbox', 'birthing'] },
  processing:  { label: '가공', items: ['washbasin', 'slaughter', 'deshell', 'grinder', 'correction', 'mixer', 'cookery'] },
  special:     { label: '특수', items: ['wall', 'speaker', 'pointer', 'catcher', 'skewer', 'feeder', 'packer'] },
};

/* ---- 효과음 / 배경 ----------------------------------------------------- */
G.SFX = {
  capture: 'assets/sounds/sfx/capture.mp3', place: 'assets/sounds/sfx/place.mp3',
  rotate: 'assets/sounds/sfx/rotate.mp3', birth: 'assets/sounds/sfx/birth.mp3',
  wash: 'assets/sounds/sfx/wash.mp3', sell: 'assets/sounds/sfx/sell.mp3',
  click: 'assets/sounds/sfx/click.mp3', remove: 'assets/sounds/sfx/remove.mp3',
  grow: 'assets/sounds/sfx/grow.mp3',
};
G.BG = {
  park: 'assets/images/backgrounds/park.png',
  factory: 'assets/images/backgrounds/factory.png',
};
