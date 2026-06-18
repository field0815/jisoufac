/* =========================================================================
 * pens.js  —  우리(펜) 시스템: 펜별 수용/사료/성장/운치/포식/우리내 배회
 *   - 실장석은 'penbox' 건물의 creatures[] 안에서 산다(밖이면 S.wanderers).
 * ========================================================================= */
window.G = window.G || {};

G.Pens = (function () {
  const C = G.CONFIG;
  const S = G.State;

  function allPens() { return S.buildings.filter(b => b.type === 'penbox'); }
  function penCells(pen) {
    if (Array.isArray(pen.cells) && pen.cells.length) return pen.cells;
    const cells = [];
    for (let r = 0; r < pen.h; r++) for (let c = 0; c < pen.w; c++) cells.push({ c, r });
    return cells;
  }
  function cells(pen) { return penCells(pen).length; }
  function capAdult(pen) { return cells(pen) * C.PEN_ADULT_PER_CELL; }
  function capYoung(pen) { return cells(pen) * C.PEN_YOUNG_PER_CELL; }
  // 우리 운치 수용량(칸 비례) / 오염도% / 청결도 라벨
  function penUnchiMax(pen) { return Math.max(1, cells(pen) * (C.PEN_UNCHI_PER_CELL || 110)); }
  function penPollution(pen) { return Math.max(0, Math.min(100, (pen.unchi || 0) / penUnchiMax(pen) * 100)); }
  function cleanlinessLabel(pollution) {
    if (pollution >= 90) return { label: '오염', color: '#c0392b' };
    if (pollution >= 60) return { label: '불결', color: '#e08a2a' };
    if (pollution >= 30) return { label: '보통', color: '#d8c44a' };
    return { label: '청결', color: '#5bc46a' };
  }
  function cleanlinessOf(pen) { return cleanlinessLabel(penPollution(pen)); }
  function isAdult(c) { return G.CREATURES[c.type] && G.CREATURES[c.type].isAdult; }
  function countAdult(pen) { return pen.creatures.filter(isAdult).length; }
  function countYoung(pen) { return pen.creatures.length - countAdult(pen); }
  const SPECIAL_TREATS = new Set(['콘페이토', '도돈파', '코로리', '도로리']);
  function hasCell(pen, c, r) { return penCells(pen).some(cell => cell.c === c && cell.r === r); }
  function playPenSfx(key, pen, c) {
    const gx = pen.col + ((c && c.px != null) ? c.px : 0.5);
    const gy = pen.row + ((c && c.py != null) ? c.py : 0.5);
    if (G.Factory && G.Factory.playSfxAt) G.Factory.playSfxAt(key, gx, gy);
    else G.Assets.playSfx(key);
  }
  function applyFoodRecovery(c, dt, ratio) {
    if (!c || !c.stats || ratio <= 0) return;
    const statMax = C.STAT_MAX || 999;
    if ((c.stats.육질 || 0) <= 10) c.stats.육질 = Math.min(statMax, (c.stats.육질 || 0) + (C.FOOD_LOW_QUALITY_RECOVER || 0.1) * dt * ratio);
    G.Creatures.ensureVitals(c);
    if ((c.행복 || 0) <= 50) G.Creatures.changeHappy(c, (C.FOOD_LOW_HAPPY_RECOVER || 0.2) * dt * ratio);
  }
  function speechSuffix(type) {
    if (type === '구더기') return '레후';
    if (type === '엄지') return '레치';
    if (type === '자실장' || type === '새끼사육실장' || type === '새끼독라') return '테치';
    return '데스';
  }
  function penCrowded(pen) {
    return cells(pen) > 12 && pen.creatures.length >= (capAdult(pen) + capYoung(pen)) * 0.8;
  }
  function pickCrowdedSpeech(c) {
    const suffix = speechSuffix(c.type);
    const arr = ['좁은{suffix}', '똥벌레가 왜이리 많은{suffix}'];
    return arr[Math.floor(Math.random() * arr.length)].replace('{suffix}', suffix);
  }
  function pickPenSpeech(c, pen) {
    if (pen && penCrowded(pen) && Math.random() < 0.35) {
      G.Creatures.changeHappy(c, -1);
      return pickCrowdedSpeech(c);
    }
    const lines = G.LINES && G.LINES.pen;
    if (!lines) return '';
    if (c.type === '구더기') {
      const arr = lines.maggot || [];
      return arr.length ? arr[Math.floor(Math.random() * arr.length)] : '';
    }
    const concept = c.stats ? (c.stats.개념 || 0) : 0;
    const group = concept <= 50 ? lines.low : (concept <= 100 ? lines.mid : lines.high);
    const suffix = speechSuffix(c.type);
    const choices = (group || []).filter(x => x.suffix && x.suffix.includes(suffix));
    if (!choices.length) return '';
    return choices[Math.floor(Math.random() * choices.length)].text.replace('{suffix}', suffix);
  }
  function nearestPointInPen(pen, px, py) {
    let best = null, bd = Infinity;
    for (const cell of penCells(pen)) {
      const x = Math.max(cell.c + 0.3, Math.min(cell.c + 0.7, px));
      const y = Math.max(cell.r + 0.3, Math.min(cell.r + 0.7, py));
      const d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best || { x: 0.5, y: 0.5 };
  }
  function randomPointInPen(pen) {
    const list = penCells(pen);
    const cell = list[Math.floor(Math.random() * list.length)] || { c: 0, r: 0 };
    return { x: cell.c + 0.3 + Math.random() * 0.4, y: cell.r + 0.3 + Math.random() * 0.4 };
  }

  function entryPointInPen(pen, worldCell) {
    if (!worldCell) return null;
    const px = worldCell.c - pen.col + 0.5;
    const py = worldCell.r - pen.row + 0.5;
    if (hasCell(pen, Math.floor(px), Math.floor(py))) {
      return {
        x: Math.max(Math.floor(px) + 0.25, Math.min(Math.floor(px) + 0.75, px + (Math.random() - 0.5) * 0.25)),
        y: Math.max(Math.floor(py) + 0.25, Math.min(Math.floor(py) + 0.75, py + (Math.random() - 0.5) * 0.25)),
      };
    }
    return nearestPointInPen(pen, px, py);
  }
  function placeIn(pen, c, worldCell) {
    if (c.px == null || worldCell) {
      const p = entryPointInPen(pen, worldCell) || randomPointInPen(pen);
      c.px = p.x; c.py = p.y;
      const a = Math.random() * 6.28; c.pvx = Math.cos(a); c.pvy = Math.sin(a);
    }
    pen.creatures.push(c);
  }
  function addToPen(pen, c, worldCell) {
    if (isAdult(c)) { if (countAdult(pen) >= capAdult(pen)) return false; }
    else { if (countYoung(pen) >= capYoung(pen)) return false; }
    placeIn(pen, c, worldCell); return true;
  }
  // 아무 우리에나 수용. 실패하면 false(→배회 처리)
  function addToAny(c) {
    for (const pen of allPens()) if (addToPen(pen, c)) return true;
    return false;
  }
  function addToPreferred(c) {
    const pens = allPens().slice().sort((a, b) => a.id - b.id);
    const first = pens.find(p => (p.name || '').trim() === '1번 우리');
    const order = first ? [first].concat(pens.filter(p => p !== first)) : pens;
    for (const pen of order) if (addToPen(pen, c)) return true;
    return false;
  }

  function totalAdults() { let n = 0; allPens().forEach(p => n += countAdult(p)); return n; }
  function totalYoung() { let n = 0; allPens().forEach(p => n += countYoung(p)); return n; }

  function update(dt) {
    const pens = allPens();
    const penned = [];
    pens.forEach(p => p.creatures.forEach(c => penned.push(c)));
    const loose = S.wanderers.map(w => w.data);

    // 사료 수요 — 사료분배기 범위 안: 선택 사료를 2배 소모(전역 자원). 범위 밖: 우리 바닥 운치(똥) 섭취.
    let demandPerMin = 0, unchiPerMin = 0;
    const feedInfo = (gx, gy) => (G.Factory.feedZoneInfo ? G.Factory.feedZoneInfo(gx, gy) : { inZone: false, type: '실장푸드', mult: 1 });
    const difficultyFoodMult = S.difficulty === 'breeding' ? 0.5 : 1;
    pens.forEach(p => p.creatures.forEach(c => {
      const fi = feedInfo(p.col + (c.px || 0.5), p.row + (c.py || 0.5));
      if (fi.inZone) { c._feedSource = 'global'; c._feedType = fi.type || '실장푸드'; c._feedMult = fi.mult || C.FEED_GROWTH_MULT || 2; }
      else { c._feedSource = 'pen'; c._feedType = '운치'; c._feedMult = 1; }   // 사료분배기 없음 → 똥 먹음
      c._fedRatio = 1;
      demandPerMin += (C.FOOD_RATE[c.type] || 0) * c._feedMult * difficultyFoodMult;
    }));
    // 운치는 우리 안 개체만 배설(바닥에 누적). 배회 개체는 배설 안 함.
    penned.forEach(c => { unchiPerMin += (C.FOOD_RATE[c.type] || 0) * C.UNCHI_MULT * difficultyFoodMult; });
    S.foodDemandPerMin = demandPerMin; S.unchiPerMin = unchiPerMin;

    function takeFeed(type, amount) {
      if (amount <= 0) return 1;
      if (type === '운치') { const got = Math.min(amount, S.unchi || 0); S.unchi -= got; return got / amount; }
      if (type === '짓소산 푸드') { const got = Math.min(amount, S.jissoFood || 0); S.jissoFood -= got; return got / amount; }
      const got = Math.min(amount, S.food || 0); S.food -= got; return got / amount;
    }
    pens.forEach(p => p.creatures.forEach(c => {
      const need = (C.FOOD_RATE[c.type] || 0) * (c._feedMult || 1) * difficultyFoodMult / 60 * dt;
      if (c._feedSource === 'pen') {                    // 우리 바닥 운치(똥) 소모
        if (need <= 0) { c._fedRatio = 1; }
        else { const got = Math.min(need, p.unchi || 0); p.unchi -= got; c._fedRatio = got / need; }
      } else {
        c._fedRatio = takeFeed(c._feedType || '실장푸드', need);
      }
    }));
    // 운치 자원(S.unchi)은 더 이상 자동 누적되지 않음 — 우리에서 집게로 추출→창고 입고 시에만 누적

    function applyUnchiFeedEffect(c, ratio, dt, pen) {
      if (!c || !c.stats || ratio <= 0) return;
      if (Math.random() < (C.UNCHI_FEED_STAT_DOWN_CHANCE || 0.08) * dt * ratio) {
        c.stats.육질 = Math.max(0, (c.stats.육질 || 0) - 1);
      }
      if (Math.random() < (C.UNCHI_FEED_STAT_DOWN_CHANCE || 0.08) * dt * ratio) {
        c.stats.개념 = Math.max(0, (c.stats.개념 || 0) - 1);
      }
      if (Math.random() < (C.UNCHI_FEED_SIZE_UP_CHANCE || 0.10) * dt * ratio) {
        c.stats.크기 = Math.min(C.SIZE_MAX || 50, (c.stats.크기 || 0) + 1);
        if (G.Creatures.tryEvolveBySize(c)) playPenSfx('grow', pen, c);
      }
    }

    // 펜별: 성장 + 우리내 배회 + 포식
    for (const pen of pens) {
      const list = pen.creatures;
      // 운치 누적: 우리 안 개체의 식욕에 비례. 상한=칸 비례 수용량. 오염도에 비례해 얼룩 표시.
      let penUnchiRate = 0;
      for (const c of list) penUnchiRate += (C.FOOD_RATE[c.type] || 0) * C.UNCHI_MULT * difficultyFoodMult;
      pen.unchi = Math.min(penUnchiMax(pen), (pen.unchi || 0) + penUnchiRate / 60 * dt);
      reconcilePenStains(pen);
      const pollution = penPollution(pen);   // 오염도%(0~100)
      // 성장 + 점액덩어리 숙성
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        G.Creatures.ageSlime(c, dt);
        if (c.noEatT > 0) c.noEatT -= dt;   // 자실장→성체 진화 직후 포식 금지 타이머
        const fed = c._fedRatio == null ? 1 : c._fedRatio;
        if (c.type === '독라' || c.type === '새끼독라') G.Creatures.changeHappy(c, -0.2 * dt);
        // 기본 성장은 사료가 없어도 진행. 사료를 실제로 먹으면 종류별 성장 배수/부가효과가 붙음.
        const isUnchi = c._feedSource === 'pen' || c._feedType === '운치';
        const growsViaFeed = isUnchi || c._feedType === '실장푸드' || c._feedType === '짓소산 푸드';
        let growthSeconds = dt;
        if (growsViaFeed && fed > 0) {
          const growthMult = isUnchi ? (C.UNCHI_GROWTH_MULT || 1.1) : 1;
          growthSeconds = Math.max(growthSeconds, dt * fed * (c._feedMult || 1) * growthMult);
        }
        if (G.Creatures.feedGrowth(c, growthSeconds)) playPenSfx('grow', pen, c);
        if (c._feedSource === 'pen') {       // 우리 바닥 운치(똥) → 3% 확률 육질 하락
          if (fed > 0 && c.stats && Math.random() < (C.UNCHI_EAT_QUALITY_DOWN || 0.03) * dt) c.stats.육질 = Math.max(0, (c.stats.육질 || 0) - 1);
        } else if (c._feedType === '짓소산 푸드') {  // 육질 1% / 행복 5% 확률 상승 + 체력 회복
          if (fed > 0 && c.stats && Math.random() < (C.JISSO_FOOD_QUALITY_CHANCE || 0.01) * dt * fed) c.stats.육질 = Math.min(C.STAT_MAX || 200, (c.stats.육질 || 0) + 1);
          if (fed > 0 && Math.random() < (C.JISSO_FOOD_HAPPY_CHANCE || 0.05) * dt * fed) G.Creatures.changeHappy(c, 1);
        } else if (c._feedType === '실장푸드') {  // 실장푸드도 육질 상승 확률 제공
          if (fed > 0) applyFoodRecovery(c, dt, fed);
          if (fed > 0 && c.stats && Math.random() < (C.FOOD_QUALITY_CHANCE || 0.005) * dt * fed) c.stats.육질 = Math.min(C.STAT_MAX || 200, (c.stats.육질 || 0) + 1);
        } else if (c._feedType === '운치') {  // 사료분배기로 운치(자원) 급여
          applyUnchiFeedEffect(c, fed, dt, pen);
        }
        // 청결한 우리(오염도 낮음) → 행복/육질 서서히 상승
        if (c.stats && pollution < (C.CLEAN_POLLUTION_MAX || 30)) {
          if (Math.random() < (C.CLEAN_HAPPY_RATE || 0.02) * dt) G.Creatures.changeHappy(c, 1);
          if (Math.random() < (C.CLEAN_QUALITY_RATE || 0.005) * dt) c.stats.육질 = Math.min(C.STAT_MAX || 200, (c.stats.육질 || 0) + 1);
        }
        // 운치(똥/자원) 섭취 → 2% 확률 행복 하락(0이면 행복회로)
        if (isUnchi && fed > 0 && Math.random() < (C.UNCHI_HAPPY_DOWN_CHANCE || 0.02) * dt * fed) G.Creatures.changeHappy(c, -1);
        // 실장푸드/짓소산 푸드 섭취 → 체력 회복
        if ((c._feedType === '실장푸드' || c._feedType === '짓소산 푸드') && c._feedSource !== 'pen' && fed > 0) G.Creatures.recoverHp(c, (C.FOOD_HP_RECOVER || 4) * dt * fed);
        // 오염도가 높을수록 육질이 떨어질 확률↑. 오염으로 육질이 0이 되면 분쇄육이 된다.
        if (c.stats && pollution > 0 && (c.stats.육질 || 0) > 0 &&
            Math.random() < (C.POLLUTION_QUALITY_DOWN || 0.06) * dt * (pollution / 100)) {
          c.stats.육질 = Math.max(0, (c.stats.육질 || 0) - 1);
          if (c.stats.육질 <= 0) { convertToMinced(pen, c, list, i); continue; }
        }
        G.Creatures.ensureVitals(c);          // 크기 변동 → 최대 체력 갱신, 행복 보장
      }
      // 우리내 배회 + 도망 이동
      for (const c of list) {
        tryEatSpecialTreat(pen, c);
        if (list.includes(c)) wander(c, pen, dt);
      }
      separate(pen);   // 충돌 분리(겹침 방지)
      // 포식: 성체가 근처 새끼를 잡아먹음
      eatPass(pen, dt);
    }
  }

  // 운치 얼룩: 운치 10당 1개(우리당 최대 PEN_STAIN_MAX). 위치는 우리 셀 안 무작위.
  function makeStainDots() {
    const n = 1 + Math.floor(Math.random() * 3), dots = [];
    for (let i = 0; i < n; i++) dots.push({ dx: (Math.random() - 0.5) * 0.42, dy: (Math.random() - 0.5) * 0.42, r: 1.6 + Math.random() * 2.6 });
    return dots;
  }
  function reconcilePenStains(pen) {
    // 얼룩 수는 오염도%에 비례(우리 크기 비례). 칸당 최대 PEN_STAINS_PER_CELL개.
    const maxStains = Math.min(C.PEN_STAIN_MAX || 100, Math.ceil(cells(pen) * (C.PEN_STAINS_PER_CELL || 4)));
    const target = Math.floor((penPollution(pen) / 100) * maxStains);
    if (!pen.unchiStains) pen.unchiStains = [];
    const arr = pen.unchiStains;
    let guard = 0;
    while (arr.length < target && guard++ < 600) { const p = randomPointInPen(pen); arr.push({ x: p.x, y: p.y, dots: makeStainDots() }); }
    if (arr.length > target) arr.length = target;
  }
  // 우리 안 개체가 오염으로 육질 0 → 분쇄육 화물로 변환(우리에서 제거).
  function convertToMinced(pen, c, list, i) {
    if (i >= 0 && i < list.length) list.splice(i, 1);
    const gx = pen.col + (c.px || 0.5), gy = pen.row + (c.py || 0.5);
    const minced = G.Creatures.makeProduct('분쇄육', c);
    if (G.Factory.burstAt) G.Factory.burstAt(gx, gy);
    if (G.Factory.stainAt) G.Factory.stainAt(gx, gy);
    if (G.Factory.floatText) G.Factory.floatText('육질이 0이 되어 살이 녹아내렸다!', gx, gy - 0.4, '#ff4a4a');
    if (G.Factory.dropFloorCargo) G.Factory.dropFloorCargo(minced, Math.floor(gx), Math.floor(gy));
  }

  const BASE_YOUNG = ['구더기', '엄지', '자실장'];

  // 우리 내 개체 충돌 분리(서로 겹치지 않게)
  function collRad(type) { return 0.34 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[type]) || 1); }
  function separate(pen) {
    const list = pen.creatures, n = list.length;
    if (n > 1) {
      // 공간 해시: 같은/인접 셀끼리만 비교 (최대 분리거리 0.68 < 1칸) — 대형 우리 O(n²) 방지
      const buckets = new Map();
      for (let i = 0; i < n; i++) {
        const k = Math.floor(list[i].px || 0) + '|' + Math.floor(list[i].py || 0);
        const a = buckets.get(k);
        if (a) a.push(i); else buckets.set(k, [i]);
      }
      for (let i = 0; i < n; i++) {
        const a = list[i];
        const c = Math.floor(a.px || 0), r = Math.floor(a.py || 0);
        for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
          const lst = buckets.get((c + dc) + '|' + (r + dr));
          if (!lst) continue;
          for (const j of lst) {
            if (j <= i) continue;
            const b = list[j];
            const dx = (b.px || 0) - (a.px || 0), dy = (b.py || 0) - (a.py || 0); const d = Math.hypot(dx, dy);
            const min = collRad(a.type) + collRad(b.type);
            if (d > 0.0001 && d < min) {
              const push = (min - d) / 2, ux = dx / d, uy = dy / d;
              a.px -= ux * push; a.py -= uy * push; b.px += ux * push; b.py += uy * push;
            }
          }
        }
      }
    }
    const lo = 0.3, hiX = pen.w - 0.3, hiY = pen.h - 0.3;
    const pushFeeders = G.Factory && G.Factory.pushOutOfFeeders;
    for (const c of list) {
      // 사료분배기 충돌: 우리 내부에 설치된 분배기 몸체 밖으로 밀어냄
      if (pushFeeders) { const pw = G.Factory.pushOutOfFeeders(pen.col + (c.px || 0.5), pen.row + (c.py || 0.5), collRad(c.type)); c.px = pw.x - pen.col; c.py = pw.y - pen.row; }
      c.px = Math.max(lo, Math.min(hiX, c.px || 0.5)); c.py = Math.max(lo, Math.min(hiY, c.py || 0.5));
      if (!hasCell(pen, Math.floor(c.px), Math.floor(c.py))) { const p = nearestPointInPen(pen, c.px, c.py); c.px = p.x; c.py = p.y; }
    }
  }

  function wander(c, pen, dt) {
    if (c.scream > 0) c.scream -= dt;   // '데챠앗!' 표시 시간 감소
    if (c.speechT > 0) c.speechT -= dt; // 말풍선 시간 감소
    else {
      c.penTalkT = (c.penTalkT == null ? 5 + Math.random() * 8 : c.penTalkT) - dt;
      if (c.penTalkT <= 0) {
        c.penTalkT = 12 + Math.random() * 18;
        const line = pickPenSpeech(c, pen);
        if (line) { c.speech = line; c.speechT = 2.3; }
      }
    }
    if (c.happyCircuit) return;         // 행복회로: 그 자리에서 움직이지 않음
    const treat = nearestSpecialTreat(pen, c, 4.5);
    if (treat) {
      const tx = treat.gx - pen.col, ty = treat.gy - pen.row;
      const dx = tx - (c.px || 0.5), dy = ty - (c.py || 0.5);
      const d = Math.hypot(dx, dy);
      if (d > 0.001) { c.pvx = dx / d; c.pvy = dy / d; c._t = 0.25; }
      if (d <= 0.65) tryEatSpecialTreat(pen, c);
    }
    const sp = (C.WANDER_SPEED[c.type] || 0.8) * 0.6 * C.MOVE_SCALE;
    const oldX = c.px || 0.5, oldY = c.py || 0.5;
    if (c.flee && c.flee.t > 0) {
      c.flee.t -= dt;
      c.px += c.flee.vx * sp * 1.8 * dt; c.py += c.flee.vy * sp * 1.8 * dt;
    } else {
      if (c.flee) c.flee = null;
      c._t = (c._t || 0) - dt;
      if (c._t <= 0) { const a = Math.random() * 6.28; c.pvx = Math.cos(a); c.pvy = Math.sin(a); c._t = 0.4 + Math.random() * 1.6; }
      c.px += (c.pvx || 0) * sp * dt; c.py += (c.pvy || 0) * sp * dt;
    }
    const lo = 0.3, hiX = pen.w - 0.3, hiY = pen.h - 0.3;
    if (c.px < lo) { c.px = lo; if (c.pvx) c.pvx = Math.abs(c.pvx); if (c.flee) c.flee.vx = Math.abs(c.flee.vx); }
    if (c.px > hiX) { c.px = hiX; if (c.pvx) c.pvx = -Math.abs(c.pvx); if (c.flee) c.flee.vx = -Math.abs(c.flee.vx); }
    if (c.py < lo) { c.py = lo; if (c.pvy) c.pvy = Math.abs(c.pvy); if (c.flee) c.flee.vy = Math.abs(c.flee.vy); }
    if (c.py > hiY) { c.py = hiY; if (c.pvy) c.pvy = -Math.abs(c.pvy); if (c.flee) c.flee.vy = -Math.abs(c.flee.vy); }
    if (!hasCell(pen, Math.floor(c.px), Math.floor(c.py))) {
      const p = nearestPointInPen(pen, oldX, oldY);
      c.px = p.x; c.py = p.y;
      c.pvx = -(c.pvx || 0); c.pvy = -(c.pvy || 0);
      if (c.flee) { c.flee.vx = -(c.flee.vx || 0); c.flee.vy = -(c.flee.vy || 0); }
    }
  }

  function nearestSpecialTreat(pen, c, range) {
    let best = null, bd = range == null ? 4.5 : range;
    const gx = pen.col + (c.px || 0.5), gy = pen.row + (c.py || 0.5);
    for (const cg of S.cargo) {
      if (!SPECIAL_TREATS.has(cg.data.type)) continue;
      if (Math.abs(cg.gx - gx) > bd || Math.abs(cg.gy - gy) > bd) continue;
      const d = Math.hypot(cg.gx - gx, cg.gy - gy);
      if (d < bd) { bd = d; best = cg; }
    }
    return best;
  }
  function tryEatSpecialTreat(pen, c) {
    const cg = nearestSpecialTreat(pen, c, 0.7);
    if (!cg) return false;
    const idx = S.cargo.indexOf(cg);
    if (idx >= 0) S.cargo.splice(idx, 1);
    cg._dead = true;
    const gx = pen.col + (c.px || 0.5), gy = pen.row + (c.py || 0.5);
    const type = cg.data.type;
    if (type === '콘페이토') {
      G.Creatures.ensureVitals(c);
      c.행복 = C.CREATURE_HAPPY_MAX || 100;
      c.happyCircuit = false;
      c.speech = '달콤한데스!';
      c.speechT = 2.2;
      return true;
    }
    if (type === '도돈파') {
      pen.unchi = Math.min(penUnchiMax(pen), (pen.unchi || 0) + 100);
      c.speech = '운치가 나오는테치!';
      c.speechT = 2.2;
      return true;
    }
    if (type === '코로리' || type === '도로리') {
      const list = pen.creatures;
      const i = list.indexOf(c);
      if (i >= 0) list.splice(i, 1);
      if (G.Factory) {
        if (G.Factory.burstAt) {
          const n = type === '도로리' ? 3 : 1;
          for (let k = 0; k < n; k++) G.Factory.burstAt(gx + (Math.random() - 0.5), gy + (Math.random() - 0.5));
        }
        if (G.Factory.stainAt) G.Factory.stainAt(gx, gy);
        if (G.Factory.dropFloorCargo) G.Factory.dropFloorCargo(G.Creatures.makeProduct(type === '코로리' ? '실장육' : '분쇄육', c), Math.floor(gx), Math.floor(gy));
      }
      return true;
    }
    return true;
  }

  // 포식자(성체실장/독라) 행동: 근처 사육실장 공격(→독라 변환) / 기본새끼 포식
  function eatPass(pen, dt) {
    const list = pen.creatures;
    for (const a of list) {
      const adef = G.CREATURES[a.type];
      if (!adef || adef.ai !== 'predator') continue;
      if (a.noEatT > 0) continue;   // 갓 성체가 된 개체는 일정 시간 새끼를 노리지 않음
      if (Math.random() > C.EAT_CHANCE * dt) continue;

      // 1순위: 근처 '사육' 태그 공격 → 육질 데미지, 0이면 독라로 변함
      let target = null, td = C.EAT_RANGE;
      for (const c of list) {
        if (c === a) continue;
        const cd = G.CREATURES[c.type];
        if (!cd || cd.tag !== '사육') continue;
        const d = Math.hypot((c.px || 0) - (a.px || 0), (c.py || 0) - (a.py || 0));
        if (d < td) { td = d; target = c; }
      }
      if (target) {
        if (a.type === '성체실장' && a.speechT <= 0) {
          const L = G.LINES && G.LINES.petThreat;
          if (L && L.length) { a.speech = L[Math.floor(Math.random() * L.length)]; a.speechT = 2.0; }
        }
        target.speech = (G.LINES && G.LINES.petAttacked) || '데갸악! 분충인데스!';
        target.speechT = 2.0;
        target.stats.육질 = Math.max(0, (target.stats.육질 || 0) - C.ATTACK_DMG);
        target.hit = 0.3;
        if (target.stats.육질 <= 0) {
          target.type = G.CREATURES[target.type].isAdult ? '독라' : '새끼독라'; // 데챠앗! 변신
          target.scream = 1.2;
          if (G.Factory.burstAt) G.Factory.burstAt(pen.col + (target.px || 0.5), pen.row + (target.py || 0.5));
        }
        continue;
      }

      // 2순위: 근처 기본새끼(구더기/엄지/자실장) 포식
      let prey = null, pd = C.EAT_RANGE;
      for (const c of list) {
        if (c === a || !BASE_YOUNG.includes(c.type)) continue;
        const d = Math.hypot((c.px || 0) - (a.px || 0), (c.py || 0) - (a.py || 0));
        if (d < pd) { pd = d; prey = c; }
      }
      if (prey) {
        const i = list.indexOf(prey); if (i >= 0) list.splice(i, 1);
        const gx = pen.col + (prey.px || 0.5), gy = pen.row + (prey.py || 0.5);
        if (G.Factory.burstAt) G.Factory.burstAt(gx, gy);
        if (G.Factory.stainAt) G.Factory.stainAt(gx, gy);
        for (const c of list) {  // 주변 기본새끼 도망(테챠아!)
          if (!BASE_YOUNG.includes(c.type)) continue;
          const dx = (c.px || 0) - (a.px || 0), dy = (c.py || 0) - (a.py || 0); const d = Math.hypot(dx, dy) || 1;
          if (d < C.EAT_RANGE * 2.2) c.flee = { vx: dx / d, vy: dy / d, t: C.FLEE_TIME };
        }
      }
    }
  }

  return { allPens, capAdult, capYoung, countAdult, countYoung, isAdult, addToPen, addToAny, addToPreferred, totalAdults, totalYoung, update, penPollution, cleanlinessOf, cleanlinessLabel };
})();
