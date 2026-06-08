/* =========================================================================
 * pens.js  —  우리(펜) 시스템: 펜별 수용/사료/성장/운치/포식/우리내 배회
 *   - 실장석은 'penbox' 건물의 creatures[] 안에서 산다(밖이면 S.wanderers).
 * ========================================================================= */
window.G = window.G || {};

G.Pens = (function () {
  const C = G.CONFIG;
  const S = G.State;

  function allPens() { return S.buildings.filter(b => b.type === 'penbox'); }
  function cells(pen) { return pen.w * pen.h; }
  function capAdult(pen) { return cells(pen) * C.PEN_ADULT_PER_CELL; }
  function capYoung(pen) { return cells(pen) * C.PEN_YOUNG_PER_CELL; }
  function isAdult(c) { return G.CREATURES[c.type] && G.CREATURES[c.type].isAdult; }
  function countAdult(pen) { return pen.creatures.filter(isAdult).length; }
  function countYoung(pen) { return pen.creatures.length - countAdult(pen); }

  function placeIn(pen, c) {
    if (c.px == null) { c.px = 0.4 + Math.random() * (pen.w - 0.8); c.py = 0.4 + Math.random() * (pen.h - 0.8); const a = Math.random() * 6.28; c.pvx = Math.cos(a); c.pvy = Math.sin(a); }
    pen.creatures.push(c);
  }
  function addToPen(pen, c) {
    if (isAdult(c)) { if (countAdult(pen) >= capAdult(pen)) return false; }
    else { if (countYoung(pen) >= capYoung(pen)) return false; }
    placeIn(pen, c); return true;
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

    // 사료 수요(우리 안 개체만) / 운치(모든 개체) — 사료분배기 범위 개체는 사료 2배 소모
    let demandPerMin = 0, unchiPerMin = 0;
    const fz = (gx, gy) => (G.Factory.feedZoneMult ? G.Factory.feedZoneMult(gx, gy) : 1);
    pens.forEach(p => p.creatures.forEach(c => { c._feedMult = fz(p.col + (c.px || 0.5), p.row + (c.py || 0.5)); demandPerMin += (C.FOOD_RATE[c.type] || 0) * c._feedMult; }));
    penned.concat(loose).forEach(c => { unchiPerMin += (C.FOOD_RATE[c.type] || 0) * C.UNCHI_MULT; });
    S.foodDemandPerMin = demandPerMin; S.unchiPerMin = unchiPerMin;

    const demand = demandPerMin / 60 * dt;
    const consumed = Math.min(demand, S.food);
    S.food -= consumed;
    S.unchi += unchiPerMin / 60 * dt;
    const fedRatio = demand > 0 ? consumed / demand : 1;

    // 펜별: 성장 + 우리내 배회 + 포식
    for (const pen of pens) {
      const list = pen.creatures;
      // 성장 + 점액덩어리 숙성
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        G.Creatures.ageSlime(c, dt);
        // 사육실장(성체)은 오래 살수록 크기 증가(최대 100, 정수 단위로만 증가)
        if (c.type === '사육실장' && c.stats && (c.stats.크기 || 0) < 100) {
          c._sizeAcc = (c._sizeAcc || 0) + (C.PET_SIZE_RATE || 0.15) * dt;
          if (c._sizeAcc >= 1) { const inc = Math.floor(c._sizeAcc); c.stats.크기 = Math.min(100, (c.stats.크기 || 0) + inc); c._sizeAcc -= inc; }
        }
        if (C.GROWTH_NEXT[c.type]) {
          c.growth = (c.growth || 0) + dt * fedRatio * (c._feedMult || 1); // 사료분배기 범위면 성장 2배
          if (c.growth >= C.GROW_TIME) { G.Creatures.grow(c); G.Assets.playSfx('grow'); }
        }
      }
      // 우리내 배회 + 도망 이동
      for (const c of list) wander(c, pen, dt);
      separate(pen);   // 충돌 분리(겹침 방지)
      // 포식: 성체가 근처 새끼를 잡아먹음
      eatPass(pen, dt);
    }
  }

  const BASE_YOUNG = ['구더기', '엄지', '자실장'];

  // 우리 내 개체 충돌 분리(서로 겹치지 않게)
  function collRad(type) { return 0.34 * ((C.DISPLAY_SCALE && C.DISPLAY_SCALE[type]) || 1); }
  function separate(pen) {
    const list = pen.creatures, n = list.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = list[i], b = list[j];
      const dx = (b.px || 0) - (a.px || 0), dy = (b.py || 0) - (a.py || 0); const d = Math.hypot(dx, dy);
      const min = collRad(a.type) + collRad(b.type);
      if (d > 0.0001 && d < min) {
        const push = (min - d) / 2, ux = dx / d, uy = dy / d;
        a.px -= ux * push; a.py -= uy * push; b.px += ux * push; b.py += uy * push;
      }
    }
    const lo = 0.3, hiX = pen.w - 0.3, hiY = pen.h - 0.3;
    for (const c of list) { c.px = Math.max(lo, Math.min(hiX, c.px || 0.5)); c.py = Math.max(lo, Math.min(hiY, c.py || 0.5)); }
  }

  function wander(c, pen, dt) {
    if (c.scream > 0) c.scream -= dt;   // '데챠앗!' 표시 시간 감소
    if (c.speechT > 0) c.speechT -= dt; // 말풍선 시간 감소
    const sp = (C.WANDER_SPEED[c.type] || 0.8) * 0.6 * C.MOVE_SCALE;
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
  }

  // 포식자(성체실장/독라) 행동: 근처 사육실장 공격(→독라 변환) / 기본새끼 포식
  function eatPass(pen, dt) {
    const list = pen.creatures;
    for (const a of list) {
      const adef = G.CREATURES[a.type];
      if (!adef || adef.ai !== 'predator') continue;
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

  return { allPens, capAdult, capYoung, countAdult, countYoung, isAdult, addToPen, addToAny, addToPreferred, totalAdults, totalYoung, update };
})();
