/* =========================================================================
 * pen.js  —  공장 좌측 "우리 도크" (성체실장 빠른 접근 / 드래그 투입)
 *   - 클릭: 스탯 정보창
 *   - 드래그 → 공장 장치에 드랍 (출산대/세면대/도축기/탈복기/교정시설/창고)
 *   ※ 전체 우리 관리(수용량/사료/성장)는 상단 "우리" 오버레이에서.
 * ========================================================================= */
window.G = window.G || {};

G.Pen = (function () {
  const S = G.State;
  let dockGrid, dragGhost = null;

  function init() {
    const dock = document.getElementById('pen-dock');
    dock.innerHTML = `
      <div class="pen-title">🐾 성체 우리 <span class="pen-count" id="dock-count">0</span></div>
      <div class="pen-hint">클릭=정보 · 드래그→공장 장치 투입</div>
      <div class="pen-grid" id="dock-grid"></div>`;
    dockGrid = document.getElementById('dock-grid');
  }

  function makeIcon(c) {
    const el = document.createElement('div');
    el.className = 'pen-icon'; el.dataset.id = c.id;
    const def = G.CREATURES[c.type];
    const rec = G.Assets.creatureImg(c.type);
    if (rec && rec.ok) el.style.backgroundImage = `url(${rec.img.src})`;
    else el.style.background = def.color;
    const g = G.Creatures.gradeOfStats(c.stats);
    el.innerHTML = `<span class="pen-grade" style="color:${g.color}">${g.label}</span>` +
      `<span class="pen-stats">${c.stats.육질}/${c.stats.개념}/${c.stats.크기}</span>`;

    let sx, sy, dragging = false;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      sx = e.clientX; sy = e.clientY; dragging = false;
      const move = (ev) => {
        if (!dragging && (Math.abs(ev.clientX - sx) > 5 || Math.abs(ev.clientY - sy) > 5)) { dragging = true; beginDrag(c, ev); }
        if (dragging) moveDrag(ev);
      };
      const up = (ev) => {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        if (dragging) endDrag(c, ev);
        else G.UI.showCreatureInfo(c, ev.clientX, ev.clientY);
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    });
    return el;
  }

  function beginDrag(c, ev) {
    dragGhost = document.createElement('div');
    dragGhost.className = 'drag-ghost';
    dragGhost.textContent = `#${c.id} ${G.CREATURES[c.type].label}`;
    document.body.appendChild(dragGhost); moveDrag(ev);
  }
  function moveDrag(ev) {
    if (!dragGhost) return;
    dragGhost.style.left = (ev.clientX + 12) + 'px';
    dragGhost.style.top = (ev.clientY + 12) + 'px';
    G.Factory.hoverDropTarget(ev.clientX, ev.clientY);
  }
  function endDrag(c, ev) {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    G.Factory.clearDropHover();
    const cell = G.Factory.screenToCell(ev.clientX, ev.clientY);
    if (cell && G.Factory.tryLoadCreature(cell.col, cell.row, c)) {
      const i = S.penAdult.indexOf(c); if (i >= 0) S.penAdult.splice(i, 1);
    }
  }

  let lastSig = '';
  function render() {
    const sig = S.penAdult.map(c => c.id).join(',');
    if (sig !== lastSig) {
      lastSig = sig;
      if (dockGrid) { dockGrid.querySelectorAll('.pen-icon').forEach(el => el.remove()); S.penAdult.forEach(c => dockGrid.appendChild(makeIcon(c))); }
    }
    const dc = document.getElementById('dock-count');
    if (dc) dc.textContent = S.penAdult.length + '/' + S.capAdult;
  }

  return { init, render };
})();
