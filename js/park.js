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

  let boxesWrap, boxEls = [], penSig = '';

  function init() {
    root = document.getElementById('screen-park');
    let buildBtns = '';
    Object.keys(G.PARK_ITEMS).forEach(t => {
      const it = G.PARK_ITEMS[t];
      buildBtns += `<button class="park-build-btn" data-item="${t}">${it.label}<small>₩${it.cost}</small></button>`;
    });
    root.innerHTML = `
      <div class="park-field" id="park-field">
        <div class="capture-boxes" id="capture-boxes"></div>
      </div>
      <div class="capture-panel">
        <div class="capture-info">공원 실장석: <span id="park-count">0</span> / ${C.PARK_MAX}
          · <span class="muted">실장석을 포획 상자로 드래그 · 상자의 ▾로 보낼 우리 지정</span></div>
        <div class="park-build" id="park-build">${buildBtns}
          <button class="park-build-btn cap-buy" id="cap-buy" title="포획 상자 추가">🎯 상자 추가<small>₩${C.CAPTURE_BOX_COST}</small></button>
        </div>
      </div>`;
    fieldEl = document.getElementById('park-field');
    countEl = document.getElementById('park-count');
    boxesWrap = document.getElementById('capture-boxes');

    if (!Array.isArray(S.captureBoxes) || !S.captureBoxes.length) S.captureBoxes = [{ targetPenId: null }];
    rebuildBoxes();

    // 아이템 설치 메뉴
    root.querySelectorAll('.park-build-btn[data-item]').forEach(b => {
      b.addEventListener('click', () => {
        placeMode = (placeMode === b.dataset.item) ? null : b.dataset.item;
        root.querySelectorAll('.park-build-btn').forEach(x => x.classList.toggle('active', x.dataset.item === placeMode));
      });
    });
    // 포획 상자 추가 구매
    document.getElementById('cap-buy').addEventListener('click', () => {
      if (S.captureBoxes.length >= C.CAPTURE_BOX_MAX) { G.UI.flash && G.UI.flash('포획 상자는 최대 ' + C.CAPTURE_BOX_MAX + '개까지'); return; }
      if (S.money < C.CAPTURE_BOX_COST) { G.UI.flash && G.UI.flash('돈 부족!'); return; }
      S.money -= C.CAPTURE_BOX_COST;
      S.captureBoxes.push({ targetPenId: null });
      penSig = '';
      rebuildBoxes();
      G.Assets.playSfx('place');
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

  // 우리 목록(공장 buildings의 penbox) → 옵션 시그니처
  function penList() { return (S.buildings || []).filter(b => b.type === 'penbox'); }
  function penOptionsHtml(selectedId) {
    let html = `<option value="">자동(가까운 우리)</option>`;
    penList().forEach(p => {
      const sel = (selectedId && p.id === selectedId) ? ' selected' : '';
      html += `<option value="${p.id}"${sel}>${(p.name || (p.id + '번 우리'))}</option>`;
    });
    return html;
  }
  // 포획 상자 DOM 재구성 (개수 변동/초기화 시)
  function rebuildBoxes() {
    if (!boxesWrap) return;
    boxesWrap.innerHTML = '';
    boxEls = [];
    S.captureBoxes.forEach((box, idx) => {
      const el = document.createElement('div');
      el.className = 'capture-box'; el.dataset.boxidx = idx;
      el.style.top = (16 + idx * 86) + 'px';
      el.innerHTML = `<div class="cb-title">🎯 포획 #${idx + 1}</div>
        <select class="cb-pen"></select>`;
      const sel = el.querySelector('.cb-pen');
      sel.innerHTML = penOptionsHtml(box.targetPenId);
      sel.addEventListener('mousedown', (e) => e.stopPropagation());   // 드래그 시작 방지
      sel.addEventListener('change', () => { box.targetPenId = +sel.value || null; G.Assets.playSfx('click'); });
      boxesWrap.appendChild(el);
      boxEls.push(el);
    });
    penSig = penList().map(p => p.id + ':' + (p.name || '')).join('|');
  }
  // 커서 위치의 포획 상자 인덱스(없으면 -1)
  function boxIndexAt(clientX, clientY) {
    for (let i = 0; i < boxEls.length; i++) {
      const r = boxEls[i].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return i;
    }
    return -1;
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

  // 포획: 1마리 → 지정 상자의 우리(없으면 자동/가득이면 공장 바닥 배회)
  function capture(c, boxIdx) {
    const i = S.park.indexOf(c); if (i < 0) return;
    S.park.splice(i, 1);
    delete c.x; delete c.y; delete c.vx; delete c.vy; delete c.role; delete c.familyId;
    const box = (boxIdx != null && boxIdx >= 0) ? S.captureBoxes[boxIdx] : null;
    if (box && box.targetPenId) {
      const pen = penList().find(p => p.id === box.targetPenId);
      if (pen && G.Pens && G.Pens.addToPen && G.Pens.addToPen(pen, c)) {
        if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('parkCaptured');
        G.Assets.playSfx('capture');
        return;
      }
      G.Factory.dropToFactory(c, box.targetPenId, true);
      if (G.UI && G.UI.flash) G.UI.flash((pen ? (pen.name || '지정 우리') + '가 가득 차서' : '지정한 우리를 찾을 수 없어') + ' 공장 바닥에 풀어놓았습니다.');
    } else {
      G.Factory.dropToFactory(c);
    }
    if (G.UI && G.UI.markTutorialAction) G.UI.markTutorialAction('parkCaptured');
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

  function highlightBox(idx) {
    boxEls.forEach((el, i) => el.classList.toggle('hot', i === idx));
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
        highlightBox(boxIndexAt(ev.clientX, ev.clientY));
      }
    };
    const up = (ev) => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
      el.classList.remove('dragging'); highlightBox(-1);
      if (!dragging) { G.UI.showCreatureInfo(c, ev.clientX, ev.clientY); return; }
      const idx = boxIndexAt(ev.clientX, ev.clientY);
      if (idx >= 0) capture(c, idx);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  }

  let bgApplied = false;
  function render() {
    if (S.screen !== 'park') return;
    countEl.textContent = S.park.length;

    // 공원 배경(park.png): 로드되면 필드에 깔기(없으면 기본 그라데이션 유지)
    if (!bgApplied && fieldEl) {
      const pbg = G.Assets.bgImg('park');
      if (pbg && pbg.ok && pbg.img.width) {
        fieldEl.style.backgroundImage = `url(${pbg.img.src})`;
        fieldEl.style.backgroundSize = 'cover';
        fieldEl.style.backgroundPosition = 'center';
        bgApplied = true;
      }
    }

    // 상자 개수 변동 시 DOM 재구성
    if (boxEls.length !== S.captureBoxes.length) { penSig = ''; rebuildBoxes(); }
    // 우리 목록 변동 시 셀렉트 옵션 갱신(포커스 중이 아닐 때만)
    const sig = penList().map(p => p.id + ':' + (p.name || '')).join('|');
    if (sig !== penSig) {
      penSig = sig;
      boxEls.forEach((el, idx) => {
        const sel = el.querySelector('.cb-pen');
        if (sel && document.activeElement !== sel) sel.innerHTML = penOptionsHtml(S.captureBoxes[idx].targetPenId);
      });
    }
    const buy = document.getElementById('cap-buy');
    if (buy) buy.classList.toggle('disabled', S.captureBoxes.length >= C.CAPTURE_BOX_MAX);

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
