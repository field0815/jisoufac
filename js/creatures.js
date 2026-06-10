/* =========================================================================
 * creatures.js  —  실장석 생성 / 번식 / 성장 / 가격 / 생산품
 * ========================================================================= */
window.G = window.G || {};

G.Creatures = (function () {
  const C = G.CONFIG;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const statMax = () => C.STAT_MAX || 200;
  const sizeMax = () => C.SIZE_MAX || 100;

  function newAdult() {
    return {
      id: G.uid(), type: '성체실장',
      stats: {
        육질: ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX),
        개념: ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX),
        크기: ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX),
      },
      growth: 0,
    };
  }

  // 공원에서 등장하는 야생 실장석 (업그레이드 보너스 반영)
  function newWild(type) {
    const u = G.State.upgrades || {};
    const lvlBonus = (lvl) => { let b = 0; for (let i = 0; i < (lvl || 0); i++) b += ri(3, 5); return b; };
    return {
      id: G.uid(), type: type || '성체실장',
      stats: {
        육질: clamp(ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX) + lvlBonus(u.필라테스), 1, statMax()),
        개념: clamp(ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX) + lvlBonus(u.기초교육), 1, statMax()),
        크기: clamp(ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX) + lvlBonus(u.실장푸드뿌리기), 1, sizeMax()),
      },
      growth: 0,
    };
  }

  // 출산: 부모 ±10, 크기는 type별 비율
  function breed(parentStats, childType) {
    const ratio = C.SIZE_RATIO[childType] || 0.25;
    const v = C.BREED_VARIANCE;
    return {
      id: G.uid(), type: childType,
      stats: {
        육질: clamp(Math.round(parentStats.육질 + rnd(-v, v)), 1, statMax()),
        개념: clamp(Math.round(parentStats.개념 + rnd(-v, v)), 1, statMax()),
        크기: clamp(Math.round(parentStats.크기 * ratio), 1, sizeMax()),
      },
      growth: 0,
    };
  }

  // 점액덩어리 숙성: 10초 지나면 구더기로 변함 (cargo/배회/우리 어디서든 호출)
  function ageSlime(data, dt) {
    if (!data || data.type !== '점액덩어리') return;
    data.slimeAge = (data.slimeAge || 0) + dt;
    if (data.slimeAge >= C.SLIME_TIME) { data.type = '구더기'; data.slimeAge = 0; }
  }

  // 세면대 분류: 1/3씩 구더기/엄지/자실장. 크기 재설정. (구더기/점액덩어리 입력)
  function washClassify(maggot) {
    const r = Math.random();
    const newType = r < 1 / 3 ? '구더기' : (r < 2 / 3 ? '엄지' : '자실장');
    const baseSize = (maggot.stats.크기 || 1) / (C.SIZE_RATIO[maggot.type] || C.SIZE_RATIO['구더기']);
    const ratio = C.SIZE_RATIO[newType] || 0.25;
    const line = (G.LINES && G.LINES.wash[newType]) || '';
    return {
      id: G.uid(), type: newType,
      stats: {
        육질: maggot.stats.육질, 개념: maggot.stats.개념,
        크기: clamp(Math.round(baseSize * ratio), 1, sizeMax()),
      },
      growth: 0,
      speech: line, speechT: line ? 2.0 : 0,
    };
  }

  // 성장: 다음 단계로. 크기를 새 비율로 환산.
  function grow(creature) {
    const next = C.GROWTH_NEXT[creature.type];
    if (!next) return false;
    const curRatio = C.SIZE_RATIO[creature.type] || 0.25;
    const baseSize = (creature.stats.크기 || 1) / curRatio;
    const newRatio = C.SIZE_RATIO[next] || 1;
    creature.type = next;
    creature.stats.크기 = clamp(Math.round(baseSize * newRatio), 1, sizeMax());
    creature.growth = 0;
    return true;
  }

  // 등급: 3스탯 중 최고값 기준
  function gradeOf(value) {
    for (const g of G.GRADES) if (value <= g.max) return g;
    return G.GRADES[G.GRADES.length - 1];
  }
  function gradeOfStats(stats) {
    return gradeOf(Math.max(stats.육질 || 0, stats.개념 || 0, stats.크기 || 0));
  }

  // 생산품 가격 계산 (스탯 기반, 계수는 S.prices)
  function priceOf(productType, stats) {
    const product = G.PRODUCTS[productType];
    if (product && product.flatPrice != null) {
      if (product.qualityPrice) {
        const meatPrice = G.State.prices.실장육 || { 육질: 2 };
        return Math.max(1, Math.round(product.flatPrice + (stats.육질 || 0) * (meatPrice.육질 || 0)));
      }
      return product.flatPrice;
    }
    if (productType === '사육실장' || productType === '새끼사육실장') {
      const p = G.State.prices.사육실장 || { base: 500, 개념: 5 };
      const base = p.크기역 != null ? 500 : (p.base != null ? p.base : 500);
      const concept = p.개념 != null ? p.개념 : 5;
      const childPrice = Math.max(1, Math.round(base + (stats.개념 || 0) * concept));
      return productType === '사육실장' ? Math.max(1, Math.round(childPrice / 2)) : childPrice;
    }
    // 새끼독라는 성체 독라 가격계수를 공유
    const key = (productType === '새끼독라') ? '독라' : productType;
    const p = G.State.prices[key];
    if (!p) return 10;
    let v = p.base || 0;
    if (key === '실장육') v += (stats.육질 || 0) * p.육질 + (stats.크기 || 0) * p.크기;
    else if (key === '독라') v += (stats.육질 || 0) * p.육질 + (stats.크기 || 0) * p.크기;
    return Math.max(1, Math.round(v));
  }

  // 가공기 출력 화물(생산품) 생성
  function makeProduct(productType, srcCreature) {
    const stats = srcCreature.stats || { 육질: 0, 개념: 0, 크기: 0 };
    return {
      id: G.uid(), type: productType, isProduct: true,
      stats: { 육질: stats.육질, 개념: stats.개념, 크기: stats.크기 },
      price: priceOf(productType, stats),
    };
  }

  return { newAdult, newWild, breed, ageSlime, washClassify, grow, priceOf, makeProduct, gradeOf, gradeOfStats };
})();
