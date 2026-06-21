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
  const sizeMax = () => C.SIZE_MAX || 50;
  function bornQuality(v) { return clamp(Math.max(10, Math.round(v || 0)), 1, statMax()); }
  function sizeRange(type) {
    return (C.SIZE_BIRTH_RANGE && C.SIZE_BIRTH_RANGE[type]) || [1, sizeMax()];
  }
  function newSize(type) {
    const r = sizeRange(type);
    return clamp(ri(r[0], r[1]), 1, sizeMax());
  }
  function stageMin(type) {
    const r = sizeRange(type);
    return r[0] || 1;
  }
  function normalizeSize(creature) {
    if (!creature || !creature.stats) return;
    creature.stats.크기 = clamp(Math.floor(creature.stats.크기 || 1), 1, sizeMax());
  }

  // 체력/행복 바이탈: 최대 체력 = 크기(×hpScale, 침입 레이드 보정용), 행복 0~100
  const happyMax = () => C.CREATURE_HAPPY_MAX || 100;
  function hpMaxOf(data) {
    const sz = (data && data.stats && data.stats.크기) || 1;
    return Math.max(1, Math.floor(sz * (data && data.hpScale ? data.hpScale : 1)));
  }
  function ensureVitals(data) {
    if (!data) return data;
    const hm = hpMaxOf(data);
    data.hp = (data.hp == null) ? hm : clamp(data.hp, 0, hm);
    data.행복 = (data.행복 == null) ? happyMax() : clamp(data.행복, 0, happyMax());
    return data;
  }
  // 행복이 0이 되면 행복회로가 고정된다. 콘페이토 같은 명시적 치료만 상태를 해제한다.
  function changeHappy(data, amount) {
    if (!data) return;
    ensureVitals(data);
    data.행복 = clamp((data.행복 || 0) + amount, 0, happyMax());
    if (data.행복 <= 0) {
      data.행복 = 0;
      if (!data.happyCircuit) {
        data.happyCircuit = true;
        if (data.stats) data.stats.개념 = 0;     // 개념이 0으로 떨어짐
      }
    }
  }
  // 체력 회복(최대=크기×hpScale). 실장푸드/짓소산 푸드 섭취 시 호출.
  function recoverHp(data, amount) {
    if (!data || amount <= 0) return;
    const hm = hpMaxOf(data);
    data.hp = clamp((data.hp == null ? hm : data.hp) + amount, 0, hm);
  }
  function tickHappyCircuit(data, dt) {
    if (!data || !data.happyCircuit || dt <= 0) return 0;
    ensureVitals(data);
    const drain = Math.min(data.hp || 0, (C.HAPPY_CIRCUIT_HP_DRAIN || 8) * dt);
    data.hp = Math.max(0, (data.hp || 0) - drain);
    data.행복 = clamp((data.행복 || 0) + drain, 0, happyMax());
    return drain;
  }
  const DOKURA_BECOME_LINES = {
    adult: ['독라가 되어버린데스...', '오로롱...', '이것이 현실일리 없는데스', '와, 와타시의 세레브한 옷이!'],
    child: ['독라가 되어버린테치...', '오로롱...', '이것이 현실일리 없는테치', '와, 와타시의 세레브한 옷이!'],
  };
  function becomeDokura(data, type) {
    if (!data) return data;
    data.type = type || ((G.CREATURES[data.type] && G.CREATURES[data.type].isAdult) ? '독라' : '새끼독라');
    ensureVitals(data);
    data.행복 = Math.min(data.행복, 30);
    const lines = data.type === '새끼독라' ? DOKURA_BECOME_LINES.child : DOKURA_BECOME_LINES.adult;
    data.speech = lines[Math.floor(Math.random() * lines.length)];
    data.speechT = 2.5;
    return data;
  }

  function newAdult() {
    return ensureVitals({
      id: G.uid(), type: '성체실장',
      stats: {
        육질: bornQuality(ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX)),
        개념: ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX),
        크기: newSize('성체실장'),
      },
      growth: 0,
    });
  }

  // 공원에서 등장하는 야생 실장석 (업그레이드 보너스 반영)
  function newWild(type) {
    const u = G.State.upgrades || {};
    const lvlBonus = (lvl) => { let b = 0; for (let i = 0; i < (lvl || 0); i++) b += ri(3, 5); return b; };
    return ensureVitals({
      id: G.uid(), type: type || '성체실장',
      stats: {
        육질: bornQuality(ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX) + lvlBonus(u.필라테스)),
        개념: clamp(ri(C.ADULT_STAT_MIN, C.ADULT_STAT_MAX) + lvlBonus(u.기초교육), 1, statMax()),
        크기: clamp(newSize(type || '성체실장') + lvlBonus(u.실장푸드뿌리기), 1, sizeMax()),
      },
      growth: 0,
    });
  }

  // 출산: 부모 등급이 높을수록 양의 변이 확률과 상승폭이 감소한다.
  function breed(parentStats, childType) {
    const v = C.BREED_VARIANCE;
    const grade = gradeOfStats(parentStats);
    const gradeIdx = Math.max(0, (G.GRADES || []).indexOf(grade));
    const upChance = (C.BREED_UP_CHANCE_BY_GRADE || [1])[gradeIdx] ?? 0.1;
    const upMult = (C.BREED_UP_MULT_BY_GRADE || [1])[gradeIdx] ?? 0.1;
    const inherit = value => {
      const positive = Math.random() < upChance;
      const delta = positive ? rnd(0, v * upMult) : rnd(-v, 0);
      return value + delta;
    };
    return ensureVitals({
      id: G.uid(), type: childType,
      stats: {
        육질: bornQuality(inherit(parentStats.육질)),
        개념: clamp(Math.round(inherit(parentStats.개념)), 1, statMax()),
        크기: newSize(childType),
      },
      growth: 0,
    });
  }

  // 점액덩어리 숙성: 10초 지나면 구더기로 변함 (cargo/배회/우리 어디서든 호출)
  function ageSlime(data, dt) {
    if (!data || data.type !== '점액덩어리') return;
    data.slimeAge = (data.slimeAge || 0) + dt;
    if (data.slimeAge >= C.SLIME_TIME) {
      data.type = '구더기';
      data.stats = data.stats || {};
      data.stats.육질 = bornQuality(data.stats.육질);
      data.stats.크기 = newSize('구더기');
      data.slimeAge = 0;
      data.sizeGrowT = 0;
      data.growth = 0;
    }
  }

  // 세면대 분류: 1/3씩 구더기/엄지/자실장. 크기 재설정. (구더기/점액덩어리 입력)
  function washClassify(maggot) {
    const r = Math.random();
    const newType = r < 1 / 3 ? '구더기' : (r < 2 / 3 ? '엄지' : '자실장');
    const line = (G.LINES && G.LINES.wash[newType]) || '';
    return ensureVitals({
      id: G.uid(), type: newType,
      stats: {
        육질: bornQuality(maggot.stats.육질), 개념: maggot.stats.개념,
        크기: newSize(newType),
      },
      growth: 0,
      speech: line, speechT: line ? 2.0 : 0,
    });
  }

  // 성장: 크기가 다음 단계 최소치에 닿으면 타입만 다음 단계로 변경.
  function grow(creature) {
    const next = C.GROWTH_NEXT[creature.type];
    if (!next) return false;
    const wasYoung = creature.type;
    creature.stats = creature.stats || {};
    creature.type = next;
    creature.stats.크기 = clamp(Math.max(creature.stats.크기 || 1, stageMin(next)), 1, sizeMax());
    creature.growth = 0;
    creature.sizeGrowT = 0;
    // 자실장→성체로 진화하면 일정 시간 새끼를 잡아먹지 않음
    if (wasYoung === '자실장' && next === '성체실장') creature.noEatT = C.GROWN_ADULT_NO_EAT || 30;
    ensureVitals(creature);   // 크기 변동에 맞춰 최대 체력 갱신
    return true;
  }

  function tryEvolveBySize(creature) {
    if (!creature || !creature.stats) return false;
    normalizeSize(creature);
    const at = C.SIZE_EVOLVE_AT && C.SIZE_EVOLVE_AT[creature.type];
    if (!at || (creature.stats.크기 || 0) < at) return false;
    return grow(creature);
  }

  function feedGrowth(creature, seconds) {
    if (!creature || !creature.stats || seconds <= 0) return false;
    normalizeSize(creature);
    if ((creature.stats.크기 || 0) >= sizeMax()) return tryEvolveBySize(creature);
    creature.sizeGrowT = (creature.sizeGrowT || 0) + seconds;
    const growTime = C.SIZE_GROW_TIME || 20;
    let evolved = false;
    while (creature.sizeGrowT >= growTime && (creature.stats.크기 || 0) < sizeMax()) {
      creature.sizeGrowT -= growTime;
      creature.stats.크기 = clamp((creature.stats.크기 || 0) + 1, 1, sizeMax());
      if (tryEvolveBySize(creature)) evolved = true;
    }
    creature.growth = 0;
    return evolved;
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
    if (product && product.sellPrice != null) return product.sellPrice;   // 자원(농축운치 등) 정가
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

  // 창고 화물 1개의 판매가 (생산품=고유가, 비생산품=정가 sellPrice 또는 기본 2)
  function cargoPrice(d) {
    if (!d) return 0;
    if (d.isProduct) return d.price || 1;
    const p = G.PRODUCTS[d.type];
    return (p && p.sellPrice != null) ? p.sellPrice : 2;
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

  return { newAdult, newWild, breed, ageSlime, washClassify, grow, tryEvolveBySize, feedGrowth, priceOf, cargoPrice, makeProduct, gradeOf, gradeOfStats, ensureVitals, hpMaxOf, changeHappy, recoverHp, tickHappyCircuit, becomeDokura };
})();
