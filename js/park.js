/* =========================================================================
 * park.js  —  1번 화면: 공원
 *   - 실장석이 자유 배회. 박스/실장푸드/물병을 설치하면 적극적으로 가져가
 *     출산 확률↑. 성체실장은 자실장/엄지/구더기를 낳고, 자실장·엄지는
 *     '가족'처럼 부모를 따라다니며 구더기는 독립 배회.
 *   - 포획: 실장석을 '상자 틀'로 드래그&드롭. 자동 사냥은 종류 안 가림.
 * ========================================================================= */
window.G = window.G || {};

G.Park = (function () {
  const C = G.CONFIG;
  const S = G.State;
  let fieldEl, countEl, boxEl, root;
  let placeMode = null;          // 설치 대기 중인 아이템 타입
  const FIELD_PAD = 50;

  function init() {
    root = document.getElementById('screen-park');
    let buildBtns = '';
    Object.keys(G.PARK_ITEMS).forEach(t => {
      const it = G.PARK_ITEMS[t];
      buildBtns += `<button class="park-build-btn" data-item="${t}">${it.label}<small>₩${it.cost}</small></button>`;
    });
    root.innerHTML = `
      <div class="park-field" id="park-field">
        <div class="capture-box" id="capture-box">🎯 포획 상자<br><small>여기로 드래그</small></div>
      </div>
      <div class="capture-panel">
        <div class="capture-info">공원 실장석: <span id="park-count">0</span> / ${C.PARK_MAX}
          · <span class="muted">실장석을 포획 상자로 드래그해 포획</span></div>
        <div class="park-build" id="park-build">${buildBtns}</div>
      </div>`;
    fieldEl = document.getElementById('park-field');
    countEl = document.getElementById('park-count');
    boxEl = document.getElementById('capture-box');

    // 아이템 설치 메뉴
    root.querySelectorAll('.park-build-btn').forEach(b => {
      b.addEventListener('click', () => {
        placeMode = (placeMode === b.dataset.item) ? null : b.dataset.item;
        root.querySelectorAll('.park-build-btn').forEach(x => x.classList.toggle('active', x.dataset.item === placeMode));
      });
    });
    // 필드 클릭 → 아이템 설치
    fieldEl.addEventListener('click', (e) => {
      if (!placeMode) return;
      if (e.target !== fieldEl) return;              // 빈 바닥만
      const it = G.PARK_ITEMS[placeMode];
      if (S.money < it.cost) { G.UI.flash && G.UI.flash('돈 부족!'); return; }
      const r = fieldEl.getBoundingClientRect();
      const sc = r.width / fieldEl.offsetWidth || 1;
      const x = (e.clientX - r.left) / sc, y = (e.clientY - r.top) / sc;
      S.money -= it.cost;
      S.parkItems.push({ id: G.uid(), type: placeMode, x, y });
      G.Assets.playSfx('place');
    });

  }

  function pickType() {
    const u = S.upgrades || {};
    const w = [['성체실장', 10], ['사육실장', (u.애호파 || 0) * 5], ['독라', (u.학대파 || 0) * 5]];
    const total = w.reduce((s, x) => s + x[1], 0);
    let r = Math.random() * total;
    for (const [t, wt] of w) { if (r < wt) return t; r -= wt; }
    return '성체실장';
  }
  function fieldSize() { return { w: fieldEl.clientWidth || C.GAME_W, h: fieldEl.clientHeight || C.MID_H }; }
  function spawnOne() {
    if (S.park.length >= C.PARK_MAX) return;
    const f = fieldSize();
    const a = G.Creatures.newWild(pickType());
    a.x = FIELD_PAD + Math.random() * (f.w - FIELD_PAD * 2);
    a.y = FIELD_PAD + Math.random() * (f.h - FIELD_PAD * 2);
    S.park.push(a);
  }

  // 포획: 특정/무작위 1마리 → 우리(가득이면 공장 바닥 배회)
  function capture(c) {
    const i = S.park.indexOf(c); if (i < 0) return;
    S.park.splice(i, 1);
    delete c.x; delete c.y; delete c.vx; delete c.vy; delete c.role; delete c.familyId;
    G.Factory.dropToFactory(c);
    G.Assets.playSfx('capture');
  }
  function moveCreature(c, dt, f) {
    // 가족 자식: 부모를 따라다님
    if (c.role === 'child' && c.familyId) {
      const parent = S.park.find(p => p.id === c.familyId);
      if (parent) {
        const tx = parent.x + (c.offX || 0), ty = parent.y + (c.offY || 0), k = Math.min(1, dt * 2.5);
        c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; return;
      }
      c.role = null; c.familyId = null;   // 부모 사라짐 → 독립
    }
    // 아이템으로 적극 이동 → 섭취 시 출산 부스트
    if (S.parkItems.length) {
      let target = null, td = 1e9;
      for (const it of S.parkItems) { const d = Math.hypot(it.x - c.x, it.y - c.y); if (d < td) { td = d; target = it; } }
      if (target) {
        const dx = target.x - c.x, dy = target.y - c.y, d = Math.hypot(dx, dy) || 1;
        c.x += dx / d * C.PARK_SPEED * dt; c.y += dy / d * C.PARK_SPEED * dt;
        if (d < 22) { c.birthBoost = (c.birthBoost || 0) + 1; S.parkItems = S.parkItems.filter(x => x !== target); }
        return;
      }
    }
    // 자유 배회
    c.t = (c.t || 0) - dt;
    if (c.t <= 0) { const a = Math.random() * 6.28; c.vx = Math.cos(a); c.vy = Math.sin(a); c.t = 0.6 + Math.random() * 1.8; }
    c.x += (c.vx || 0) * C.PARK_SPEED * dt; c.y += (c.vy || 0) * C.PARK_SPEED * dt;
    if (c.x < FIELD_PAD) { c.x = FIELD_PAD; c.vx = Math.abs(c.vx || 1); }
    if (c.x > f.w - FIELD_PAD) { c.x = f.w - FIELD_PAD; c.vx = -Math.abs(c.vx || 1); }
    if (c.y < FIELD_PAD) { c.y = FIELD_PAD; c.vy = Math.abs(c.vy || 1); }
    if (c.y > f.h - FIELD_PAD) { c.y = f.h - FIELD_PAD; c.vy = -Math.abs(c.vy || 1); }
  }

  function tryBirth(c, dt) {
    if (c.type !== '성체실장' || S.park.length >= C.PARK_MAX) return;
    const chance = Math.min(C.PARK_BIRTH_MAX, C.PARK_BIRTH_BASE + (c.birthBoost || 0) * C.PARK_BIRTH_BOOST);
    if (Math.random() < chance * dt) {
      const types = ['자실장', '엄지', '구더기'];
      const t = types[Math.floor(Math.random() * types.length)];
      const child = G.Creatures.breed(c.stats, t);
      child.x = c.x + (Math.random() * 30 - 15); child.y = c.y + (Math.random() * 30 - 15);
      if (t !== '구더기') { child.role = 'child'; child.familyId = c.id; child.offX = Math.random() * 44 - 22; child.offY = 24 + Math.random() * 18; }
      S.park.push(child);
      c.birthBoost = Math.max(0, (c.birthBoost || 0) - 1);
    }
  }

  function update(dt) {
    S.parkSpawnTimer += dt;
    if (S.parkSpawnTimer >= C.PARK_SPAWN_INTERVAL) { S.parkSpawnTimer -= C.PARK_SPAWN_INTERVAL; spawnOne(); }

    if (S.screen === 'park') {
      const f = fieldSize();
      for (const c of S.park) { moveCreature(c, dt, f); tryBirth(c, dt); }
    }
  }

  // 포획 상자 위에 떨어뜨렸는지 판정 (필드 좌표)
  function overBox(clientX, clientY) {
    const r = boxEl.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  function startDrag(c, el, e) {
    e.preventDefault();
    let sx = e.clientX, sy = e.clientY, dragging = false;
    const move = (ev) => {
      if (!dragging && (Math.abs(ev.clientX - sx) > 4 || Math.abs(ev.clientY - sy) > 4)) { dragging = true; el.classList.add('dragging'); }
      if (dragging) {
        const r = fieldEl.getBoundingClientRect();
        const sc = r.width / fieldEl.offsetWidth || 1;
        c.x = (ev.clientX - r.left) / sc; c.y = (ev.clientY - r.top) / sc;
        c.role = null; c.familyId = null;  // 드래그 중엔 가족 추종 해제
        boxEl.classList.toggle('hot', overBox(ev.clientX, ev.clientY));
      }
    };
    const up = (ev) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      el.classList.remove('dragging'); boxEl.classList.remove('hot');
      if (!dragging) { G.UI.showCreatureInfo(c, ev.clientX, ev.clientY); return; }
      if (overBox(ev.clientX, ev.clientY)) capture(c);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }

  function render() {
    if (S.screen !== 'park') return;
    countEl.textContent = S.park.length;

    // 아이템 DOM 동기화
    const itEx = {};
    fieldEl.querySelectorAll('.park-item').forEach(el => { itEx[el.dataset.id] = el; });
    S.parkItems.forEach(it => {
      let el = itEx[it.id];
      if (!el) {
        el = document.createElement('div'); el.className = 'park-item'; el.dataset.id = it.id;
        const d = G.PARK_ITEMS[it.type]; el.style.background = d.color; el.textContent = d.label.split(' ')[0];
        fieldEl.appendChild(el);
      }
      el.style.left = it.x + 'px'; el.style.top = it.y + 'px';
      delete itEx[it.id];
    });
    Object.values(itEx).forEach(el => el.remove());

    // 크리처 DOM 동기화
    const existing = {};
    fieldEl.querySelectorAll('.park-creature').forEach(el => { existing[el.dataset.id] = el; });
    S.park.forEach(c => {
      let el = existing[c.id];
      if (!el) {
        el = document.createElement('div'); el.className = 'park-creature'; el.dataset.id = c.id;
        el.addEventListener('mousedown', (e) => { e.stopPropagation(); startDrag(c, el, e); });
        fieldEl.appendChild(el);
      }
      const def = G.CREATURES[c.type];
      const rec = G.Assets.creatureImg(c.type);
      const scale = (C.DISPLAY_SCALE && C.DISPLAY_SCALE[c.type]) || 1;
      el.style.width = el.style.height = Math.round(44 * scale) + 'px';
      // 이동 방향에 맞는 행(앞0/좌1/우2/뒤3)
      const dx = c.x - (c._px == null ? c.x : c._px), dy = c.y - (c._py == null ? c.y : c._py);
      c._px = c.x; c._py = c.y;
      const drow = G.Assets.dirRow(dx, dy);
      if (rec && rec.ok) {
        el.style.backgroundImage = `url(${rec.img.src})`;
        el.style.backgroundSize = '400% 400%';
        el.style.backgroundPosition = (G.Assets.frame() * (100 / 3)) + '% ' + (drow * (100 / 3)) + '%';
        el.textContent = '';
      } else if (!el.dataset.ph) {
        el.dataset.ph = '1'; el.style.background = def.color; el.textContent = def.label;
      }
      el.style.left = c.x + 'px'; el.style.top = c.y + 'px';
      delete existing[c.id];
    });
    Object.values(existing).forEach(el => el.remove());
  }

  return { init, update, render };
})();
