/* =========================================================================
 * ui.js  —  상단바 / 베이스화면(공원·공장) / 오버레이(상점·연구·통계) / 옵션
 * ========================================================================= */
window.G = window.G || {};

G.UI = (function () {
  const S = G.State;
  const C = G.CONFIG;
  const BASE = [{ id: 'park', label: '① 공원' }, { id: 'factory', label: '③ 공장' }];
  const OVL = [{ id: 'shop', label: '② 거래' }, { id: 'research', label: '④ 연구' }, { id: 'stats', label: '⑤ 통계' }];
  let lastWhSig = '', lastSoldSig = '', lastPenSig = '', lastInventorySig = '', lastBuyPenSig = '';   // 재고/판매/우리 목록 갱신 시그니처
  let lastEndingRecordsSig = '';
  let endingGalleryOpen = false;
  const PEN_SELL_TYPES = ['사육실장', '새끼사육실장', '독라', '새끼독라'];
  let optionsEl;
  let optionsTab = 'save';
  let optionsMessage = '';
  let lastSaveSlotSig = '';
  let resetArmedUntil = 0;
  let hiddenCheatCount = 0;
  let hiddenCheatTimer = 0;
  let lastMoney = null;
  let newGameEl;
  let pendingDifficulty = 'park';
  let tutorialEl;
  let tutorialAdvanceTimer = 0;
  let titleTooltipEl;
  let tooltipOwner = null;
  const topDomSig = {};
  let lastResearchStripSig = '';
  let lastPowerDetailSig = '';

  function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
  function productIcon(type, cls) {
    const def = G.PRODUCTS[type];
    if (!def || !def.img) return `<span class="${cls}" style="background:${def ? def.color : '#888'}"></span>`;
    return `<span class="${cls}" style="background-image:url('assets/images/products/${escAttr(def.img)}');background-size:contain;background-position:center;"></span>`;
  }
  function setTextIfChanged(idOrEl, value) {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return;
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
  }
  function setHtmlIfChanged(el, html) {
    if (!el || el.dataset.htmlSig === html) return;
    el.dataset.htmlSig = html;
    el.innerHTML = html;
  }
  function creatureIcon(type, cls) {
    const def = G.CREATURES[type];
    if (!def || !def.img) return `<span class="${cls}" style="background:${def ? def.color : '#888'}"></span>`;
    return `<span class="${cls} creature-ui-icon" style="background-image:url('assets/images/creatures/${escAttr(def.img)}');background-size:400% 400%;background-position:0 0;"></span>`;
  }
  function itemIcon(type, cls) {
    if (G.PRODUCTS[type]) return productIcon(type, cls);
    if (G.CREATURES[type]) return creatureIcon(type, cls);
    return `<span class="${cls}" style="background:#888"></span>`;
  }
  function creatureLabel(type) {
    if (type === '성체실장') return '성체실장석';
    if (type === '자실장') return '자실장';
    return (G.CREATURES[type] && G.CREATURES[type].label) || type;
  }

  function init() {
    buildTopbar();
    buildOverlays();
    buildMidori();
    buildQuestTracker();
    buildTitleTooltip();
    bindKeys();
    switchScreen(S.screen);
  }

  function buildTitleTooltip() {
    titleTooltipEl = document.createElement('div');
    titleTooltipEl.id = 'midori-tooltip';
    titleTooltipEl.innerHTML = `<div class="mt-portrait" style="background-image:url('${midoriImage('normal')}')"></div><div class="mt-text"></div>`;
    document.getElementById('game').appendChild(titleTooltipEl);
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest('[title]');
      if (!el || el === titleTooltipEl || titleTooltipEl.contains(el)) return;
      if (el.closest('button, input, select, label, .tab-btn, .tb-options, #linggal-btn, .opt-tab, .opt-slider')) return;
      const text = el.getAttribute('title');
      if (!text) return;
      if (tooltipOwner && tooltipOwner !== el) hideTitleTooltip();
      tooltipOwner = el;
      el.dataset.nativeTitle = text;
      el.removeAttribute('title');
      titleTooltipEl.querySelector('.mt-text').textContent = text;
      titleTooltipEl.style.display = 'flex';
      positionTitleTooltip(e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', (e) => {
      if (!tooltipOwner) return;
      // 소유 요소가 재렌더(innerHTML 교체)로 DOM에서 떨어져 나갔거나, 커서가 더 이상 그 위에
      // 있지 않으면 숨긴다. (재렌더 시 mouseout이 발생하지 않아 툴팁이 남는 문제 방지)
      if (!tooltipOwner.isConnected ||
          !(e.target === tooltipOwner || (tooltipOwner.contains && tooltipOwner.contains(e.target)))) {
        hideTitleTooltip();
        return;
      }
      positionTitleTooltip(e.clientX, e.clientY);
    });
    document.addEventListener('mouseout', (e) => {
      if (!tooltipOwner) return;
      if ((e.target === tooltipOwner || (tooltipOwner.contains && tooltipOwner.contains(e.target))) &&
          !(e.relatedTarget && tooltipOwner.contains && tooltipOwner.contains(e.relatedTarget))) hideTitleTooltip();
    });
  }
  function positionTitleTooltip(clientX, clientY) {
    if (!titleTooltipEl || titleTooltipEl.style.display === 'none') return;
    const g = document.getElementById('game').getBoundingClientRect();
    const sc = g.width / C.GAME_W;
    const w = titleTooltipEl.offsetWidth || 220, h = titleTooltipEl.offsetHeight || 72;
    let x = (clientX - g.left) / sc + 16;
    let y = (clientY - g.top) / sc + 16;
    x = Math.max(8, Math.min(C.GAME_W - w - 8, x));
    y = Math.max(48, Math.min(C.GAME_H - h - 8, y));
    titleTooltipEl.style.left = x + 'px';
    titleTooltipEl.style.top = y + 'px';
  }
  function hideTitleTooltip() {
    if (tooltipOwner && tooltipOwner.dataset.nativeTitle) {
      tooltipOwner.setAttribute('title', tooltipOwner.dataset.nativeTitle);
      delete tooltipOwner.dataset.nativeTitle;
    }
    tooltipOwner = null;
    if (titleTooltipEl) titleTooltipEl.style.display = 'none';
  }

  /* ---- 무전/미도리(비서) + 퀘스트 추적 -------------------------------- */
  let midoriHideT = null;
  let radioQueue = [];
  let radioPhase = 'idle';   // 'idle' | 'static'(치지직) | 'typing'(타이핑 중) | 'done'(전체 표시됨)
  let pendingRadio = null;   // 치지직 동안 대기 중인 대사
  let staticTimer = null;
  let typeTimer = null;
  let typeFull = '';
  let typeOpts = null;
  let typeIndex = 0;
  let radioComplete = null;
  function buildMidori() {
    const game = document.getElementById('game');
    const stat = document.createElement('div'); stat.id = 'radio-static'; game.appendChild(stat);
    const m = document.createElement('div'); m.id = 'midori-panel';
    m.innerHTML = `<div class="midori-bubble"><div class="midori-name" id="midori-name">미도리</div><div class="midori-text" id="midori-text"></div></div>` +
      `<div class="radio-request-icon" id="radio-request-icon"></div>` +
      `<button class="midori-close" id="midori-close">×</button>`;
    game.appendChild(m);
    const portrait = document.createElement('div');
    portrait.id = 'midori-portrait';
    portrait.className = 'midori-portrait';
    portrait.style.backgroundImage = "url('assets/images/ui/midori.png')";
    game.appendChild(portrait);
    game.addEventListener('click', (e) => {
      if (radioPhase === 'idle') return;
      if (e.target.closest && e.target.closest('.midori-close')) return;
      onRadioClick();
    });
    m.querySelector('#midori-close').addEventListener('click', (e) => { e.stopPropagation(); dismissRadio(); });
  }
  function setRadioStatic(on) {
    const stat = document.getElementById('radio-static');
    if (stat) stat.classList.toggle('dialog', !!on);
  }
  function hideMidori(keepQueue) {
    const m = document.getElementById('midori-panel');
    if (m) m.classList.remove('show');
    setPortraitVisible(false);
    const req = document.getElementById('radio-request-icon');
    if (req) req.classList.remove('show');
    if (!keepQueue) radioQueue = [];
    clearTimeout(midoriHideT);
    clearTimeout(staticTimer);
    clearInterval(typeTimer);
    typeTimer = null;
    radioPhase = 'idle';
    pendingRadio = null;
    setRadioStatic(false);
    G.dialogPaused = false;
  }
  function dismissRadio() { radioComplete = null; hideMidori(false); }
  // 대사창 클릭: 치지직 → 타이핑 → 전체표시 → 다음 줄/종료 (한 단계씩 스킵)
  function onRadioClick() {
    if (radioPhase === 'static') { revealRadio(); return; }      // 치지직 스킵
    if (radioPhase === 'typing') { finishTypewriter(); return; }  // 타이핑 스킵 → 전체 표시
    if (radioPhase === 'done') {
      if (radioQueue.length) {
        const next = radioQueue.shift();
        showRadio(next.text, next.opts);
      } else {
        const done = radioComplete;
        radioComplete = null;
        hideMidori(false);
        if (done) setTimeout(done, 0);
      }
    }
  }
  function midoriImage(emotion) {
    const key = emotion || '';
    const files = {
      wrong: 'midori_wrong.png',
      sleep: 'midori_sleep.png',
      shy: 'midori_shy.png',
      sad: 'midori_sad.png',
      mad: 'midori_mad.png',
      laziness: 'midori_laziness.png',
      laugh: 'midori_laugh.png',
      normal: 'midori_normal.png',
      midori_normal: 'midori_normal.png',
      amaze: 'midori_amaze.png',
      midori_amaze: 'midori_amaze.png',
      greed: 'midori_greed.png',
      midori_greed: 'midori_greed.png',
      lol: 'midori_lol.png',
      midori_lol: 'midori_lol.png',
    };
    return 'assets/images/ui/' + (files[key] || files.normal);
  }
  function requestItemImage(type) {
    if (G.PRODUCTS && G.PRODUCTS[type] && G.PRODUCTS[type].img) return 'assets/images/products/' + G.PRODUCTS[type].img;
    if (G.CREATURES && G.CREATURES[type] && G.CREATURES[type].img) return 'assets/images/creatures/' + G.CREATURES[type].img;
    return '';
  }
  function orgImage(orgKey) {
    const files = {
      vault44: 'org_vault44.png',
      bezoar: 'org_bezoar.png',
      teaparty: 'org_teaparty.png',
      freakshow: 'org_freakshow.png',
      cult: 'org_cult.png',
    };
    return files[orgKey] ? 'assets/images/ui/' + files[orgKey] : '';
  }
  function setPortraitVisible(show) {
    const portrait = document.getElementById('midori-portrait');
    if (portrait) portrait.classList.toggle('show', !!show);
  }
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function radioTextHtml(text, opts) {
    let html = escHtml(text);
    if (opts && opts.item) {
      const req = escHtml((opts.itemLabel || opts.item) + (opts.n ? ' ×' + opts.n : ''));
      html += `<div class="radio-request-text">요구: ${req}</div>`;
    }
    return html;
  }
  function endingDialogueRunsLive() {
    return !!(S.ending && S.ending.stage >= 3);
  }
  // 무전: 하단 대사창을 즉시 열고 한 글자씩 타이핑 출력
  function showRadio(text, opts) {
    opts = opts || {};
    const m = document.getElementById('midori-panel');
    if (!m) return;
    G.dialogPaused = !endingDialogueRunsLive();
    radioPhase = 'static';
    pendingRadio = { text: String(text == null ? '' : text), opts };
    clearTimeout(staticTimer);
    clearInterval(typeTimer);
    setRadioStatic(false);
    revealRadio();
  }
  // 치지직을 끝내고 초상화/대사창을 띄운 뒤 타이핑 시작
  function revealRadio() {
    if (radioPhase !== 'static' || !pendingRadio) return;
    clearTimeout(staticTimer);
    const text = pendingRadio.text, opts = pendingRadio.opts;
    const m = document.getElementById('midori-panel'); if (!m) return;
    const stat = document.getElementById('radio-static');
    if (stat) { clearTimeout(stat._t); stat.classList.remove('on'); }
    const name = document.getElementById('midori-name'); if (name) name.textContent = opts.name || '미도리';
    const portrait = document.getElementById('midori-portrait');
    if (portrait) {
      const isOrg = opts.midori === false;
      const img = opts.portrait || (opts.midori === false ? orgImage(opts.orgKey) : midoriImage(opts.emotion));
      portrait.style.backgroundImage = img ? `url('${img}')` : '';
      portrait.classList.toggle('midori-raw', !isOrg);
      setPortraitVisible(!!img);
    }
    const req = document.getElementById('radio-request-icon');
    if (req) req.classList.remove('show');
    m.classList.add('show');
    clearTimeout(midoriHideT);
    startTypewriter(text, opts);
  }
  function startTypewriter(text, opts) {
    typeFull = text;
    typeOpts = opts;
    typeIndex = 0;
    radioPhase = 'typing';
    const t = document.getElementById('midori-text');
    if (!t) { finishTypewriter(); return; }
    t.textContent = '';
    const speed = (G.QUEST_CONFIG && G.QUEST_CONFIG.TYPE_SPEED) || 18;   // 글자당 ms
    clearInterval(typeTimer);
    // 시간 기반 타이핑: 프레임이 밀려도(렉) 경과한 실제 시간만큼 글자를 한꺼번에 진행시켜
    // 출력 속도가 FPS에 묶이지 않게 한다. (틱 1회 = 1글자가 아니라, 누적 경과시간으로 목표 글자수 계산)
    const startAt = performance.now();
    typeTimer = setInterval(() => {
      const target = Math.min(typeFull.length, Math.floor((performance.now() - startAt) / speed));
      if (target <= typeIndex) return;
      typeIndex = target;
      const t2 = document.getElementById('midori-text');
      if (t2) t2.textContent = typeFull.slice(0, typeIndex);
      if (typeIndex >= typeFull.length) finishTypewriter();
    }, speed);
  }
  // 타이핑 즉시 완료: 전체 텍스트(+요구 항목) 표시
  function finishTypewriter() {
    clearInterval(typeTimer);
    typeTimer = null;
    const t = document.getElementById('midori-text');
    if (t) t.innerHTML = radioTextHtml(typeFull, typeOpts);
    radioPhase = 'done';
  }
  function showRadioLines(lines, opts) {
    const arr = Array.isArray(lines) ? lines : [lines];
    const normalized = arr.map(line => {
      if (line && typeof line === 'object') return { text: line.text || '', opts: Object.assign({}, opts || {}, line) };
      return { text: String(line || ''), opts: Object.assign({}, opts || {}) };
    }).filter(x => x.text);
    if (!normalized.length) return;
    radioComplete = opts && typeof opts.onComplete === 'function' ? opts.onComplete : null;
    radioQueue = normalized.slice(1);
    showRadio(normalized[0].text, normalized[0].opts);
  }
  function midoriRadio(text, opts) {
    opts = Object.assign({ name: '미도리', emotion: 'laziness' }, opts || {});
    showRadioLines(text, opts);
  }
  let lastQuestSig = '';
  function renderQuestTracker() {
    const el = document.getElementById('quest-tracker'); if (!el) return;
    const qs = (G.Factory && G.Factory.questsForUI) ? G.Factory.questsForUI().filter(q => q.accepted) : [];
    const sig = qs.map(q => q.id + ':' + q.delivered + '/' + q.n + ':' + q.have + ':' + q.ready).join('|');
    if (sig === lastQuestSig) return;
    lastQuestSig = sig;
    if (!qs.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'block';
    el.innerHTML = '<div class="qt-title">📻 진행 의뢰</div>' + qs.map(q =>
      `<div class="qt-row"><span class="qt-org" style="color:${q.color}">${q.org}</span>` +
      `<span class="qt-item">${q.item} <b class="${(q.delivered >= q.n) ? 'q-ok' : 'q-no'}">${q.delivered}/${q.n}</b>${q.have ? ` <small>(보유 ${q.have})</small>` : ''}</span></div>`
    ).join('');
  }
  function buildQuestTracker() {
    const el = document.createElement('div'); el.id = 'quest-tracker'; el.style.display = 'none';
    document.getElementById('game').appendChild(el);
  }

  /* ---- 상단바 --------------------------------------------------------- */
  function buildTopbar() {
    const bar = document.getElementById('topbar');
    bar.innerHTML = `
      <div class="tb-res tb-money" title="공장을 굴리는 돈이야. 의뢰랑 판매로 벌어서 건물·연구·티어 승급에 쏟아붓는 거지. 인류가 망해도 돈은 돌더라?">💰 <span id="tb-money">0</span></div>
      <div class="tb-res tb-power" title="전력 사용량/생산량이야. 노동교화소 같은 건 전기가 없으면 안 돌아가고, 다른 건물도 전력을 받으면 효율이 50% 올라. 발전소는 실장석을 굴려서 돌린다구.">⚡ <span id="tb-power">0</span></div>
      <div class="tb-res tb-scrap" title="철조각 보유량이야. 폐허에서 노동석으로 채취하거나 의뢰 보상으로 얻어. 고급 건물·콜로니 티어 승급에 쓰여.">${productIcon('철조각', 'res-icon')}<span id="tb-scrap">0</span></div>
      <div class="tb-counts">
        <span class="tb-ct" title="다 자란 실장석. 멸망한 세상에서 인류의 식량이자 연료이자 노리갯감이지. 도축하면 실장육이 나와.">${creatureIcon('성체실장', 'res-icon')}<b id="tb-c-adult">0</b></span>
        <span class="tb-ct" title="실장석 새끼야. 아직 덜 자랐지만 키우면 성체가 돼. 성체는 새끼를 잡아먹으니까 우리를 따로 떼어놔야 해.">${creatureIcon('자실장', 'res-icon')}<b id="tb-c-child">0</b></span>
        <span class="tb-ct" title="학대받고 비뚤어진 실장석, 독라야. 노동교화소에 넣으면 노동석으로 부려먹을 수 있어. 개념이 높을수록 일을 잘하지.">${creatureIcon('독라', 'res-icon')}<b id="tb-c-dok">0</b></span>
        <span class="tb-ct" title="애호파 인간들이 떠받드는 고급 품종 사육실장, 그 새끼야. 새끼를 안 잡아먹고 개념도 높아서 비싸게 팔려.">${creatureIcon('새끼사육실장', 'res-icon')}<b id="tb-c-petchild">0</b></span>
        <span class="tb-ct" title="곱게 자란 사육실장 성체. 티파티 같은 애호가들이 환장하는 비싼 상품이지.">${creatureIcon('사육실장', 'res-icon')}<b id="tb-c-pet">0</b></span>
        <span class="tb-ct tb-labor" title="독라로 만든 일꾼, 노동석이야 (현재/최대). 아이템 회수·방어·청소·철조각 채취를 시킬 수 있고, 최대치는 노동교화소 수에 비례해.">${creatureIcon('독라', 'res-icon')}🔨<b id="tb-labor">0/0</b></span>
      </div>
      <div class="tb-feeds" id="tb-feeds"></div>
      <div class="research-queue-strip" id="research-queue-strip"></div>
      <div class="tb-tabs" id="tb-tabs"></div>
      <button class="tb-tutorial" id="tb-tutorial" title="튜토리얼 설명 다시 보기">T</button>
      <button class="tb-options" id="tb-options" title="옵션">...</button>
      <div class="options-menu" id="options-menu"></div>
      <div class="raid-timer" id="raid-timer">다음 레이드 --:--</div>`;
    const tabs = document.getElementById('tb-tabs');
    BASE.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tab-btn'; b.textContent = t.label; b.dataset.base = t.id;
      b.addEventListener('click', () => switchScreen(t.id));
      tabs.appendChild(b);
    });
    OVL.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tab-btn ovl-btn'; b.textContent = t.label; b.dataset.ovl = t.id;
      b.addEventListener('click', () => toggleOverlay(t.id));
      tabs.appendChild(b);
    });
    const raidTimer = document.getElementById('raid-timer');
    if (raidTimer) raidTimer.addEventListener('click', () => {
      if (G.Factory && G.Factory.triggerRaidCountdown) {
        G.Factory.triggerRaidCountdown();
        G.Assets.playSfx('click');
        renderTop();
      }
    });
    const rq = document.getElementById('research-queue-strip');
    if (rq) rq.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-cancel-top-research]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.cancelTopResearch === 'current') cancelResearch('current');
      else cancelResearch('queue', +btn.dataset.idx);
    });
    const powerEl = bar.querySelector('.tb-power');
    if (powerEl) powerEl.addEventListener('click', () => { fireMidoriExplain('tab:power'); });
    const tutBtn = document.getElementById('tb-tutorial');
    if (tutBtn) tutBtn.addEventListener('click', (e) => { e.stopPropagation(); openTutorialResetDialog(); G.Assets.playSfx('click'); });
    buildOptionsMenu();
    buildNewGameDialog();
    buildTutorialResetDialog();
    buildTutorialPanel();
  }

  let tutorialResetEl;
  function buildTutorialResetDialog() {
    tutorialResetEl = document.createElement('div');
    tutorialResetEl.id = 'tutorial-reset-dialog';
    tutorialResetEl.style.display = 'none';
    tutorialResetEl.innerHTML = `
      <div class="trd-card">
        <div class="trd-portrait" style="background-image:url('${midoriImage('laziness')}')"></div>
        <div class="trd-body">
          <div class="trd-name">미도리</div>
          <div class="trd-text">튜토리얼을 다시 설명할까?</div>
          <div class="trd-actions">
            <button data-trd="yes">응, 다시 들을게</button>
            <button data-trd="no">됐어</button>
          </div>
        </div>
      </div>`;
    document.getElementById('game').appendChild(tutorialResetEl);
    tutorialResetEl.addEventListener('click', (e) => {
      if (e.target === tutorialResetEl) { closeTutorialResetDialog(); return; }
      const btn = e.target.closest('[data-trd]'); if (!btn) return;
      if (btn.dataset.trd === 'yes') resetTutorialExplanations();
      closeTutorialResetDialog();
      G.Assets.playSfx('click');
    });
  }
  function openTutorialResetDialog() {
    if (!tutorialResetEl) buildTutorialResetDialog();
    tutorialResetEl.style.display = 'flex';
  }
  function closeTutorialResetDialog() {
    if (tutorialResetEl) tutorialResetEl.style.display = 'none';
  }

  function switchScreen(id) {
    if (id !== 'park' && id !== 'factory') return;
    S.screen = id;
    if (id === 'park') markTutorialAction('screenPark');
    else {
      if (tutorialFlag('screenPark')) markTutorialAction('screenFactoryAfterPark');
      markTutorialAction('screenFactory');
    }
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    const bt = document.getElementById('blueprint-tab'); if (bt) bt.style.display = (id === 'factory') ? 'block' : 'none'; // 청사진은 공장에서만
    const lg = document.getElementById('linggal-btn'); if (lg) lg.style.display = (id === 'factory') ? 'block' : 'none'; // 링갈도 공장에서만
    refreshTabs(); hideInfo();
  }
  function toggleOverlay(id) {
    S.overlay = (S.overlay === id) ? null : id;
    if (S.overlay) { markTutorialAction('overlay' + S.overlay); fireMidoriExplain('tab:' + S.overlay); }
    document.getElementById('overlay-root').style.display = S.overlay ? 'flex' : 'none';
    document.querySelectorAll('.ovl-panel').forEach(p => p.classList.toggle('active', p.id === 'ovl-' + S.overlay));
    refreshTabs(); hideInfo();
  }
  function closeOverlay() { if (S.overlay) toggleOverlay(S.overlay); }
  function refreshTabs() {
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.base) b.classList.toggle('active', b.dataset.base === S.screen && !S.overlay);
      if (b.dataset.ovl) b.classList.toggle('active', b.dataset.ovl === S.overlay);
    });
  }

  function bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (e.key === '`' || e.code === 'Backquote') {
        e.preventDefault();
        const now = performance.now();
        hiddenCheatCount = (now - hiddenCheatTimer < 900) ? hiddenCheatCount + 1 : 1;
        hiddenCheatTimer = now;
        if (hiddenCheatCount >= 3) {
          hiddenCheatCount = 0;
          doHiddenCheat();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (optionsEl && optionsEl.classList.contains('open')) { closeOptions(); return; }
        if (S.overlay) closeOverlay();
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    });
  }

  function togglePause() {
    if (endingGalleryOpen) return;
    G.paused = !G.paused;
    updatePauseIndicator();
    G.Assets.playSfx('click');
  }
  let pauseEl;
  function updatePauseIndicator() {
    if (!pauseEl) {
      pauseEl = document.createElement('div');
      pauseEl.id = 'pause-indicator';
      pauseEl.textContent = '⏸ 일시정지 (Space)';
      document.getElementById('game').appendChild(pauseEl);
    }
    pauseEl.style.display = G.paused ? 'block' : 'none';
  }

  // 치트 메뉴(`을 3번 누르면 열림) — 4가지 치트 선택창
  let cheatEl;
  const CHEATS = [
    { id: 'money', label: '💰 돈 +' + (C.CHEAT_MONEY || 9999999).toLocaleString() },
    { id: 'scrap', label: '🔩 철조각 +9,999' },
    { id: 'electronics', label: '⚙ 전자부품 +999' },
    { id: 'chaosmaggot', label: '🟣 카오스 구더기 +99' },
    { id: 'achievements', label: '🏆 모든 업적·기념물 개방' },
    { id: 'creatures', label: '🐾 실장석 +' + (C.CHEAT_CREATURES || 10) + '마리' },
    { id: 'research', label: '🔬 연구 즉시 완료' },
    { id: 'killinvaders', label: '☠ 모든 침입 실장석 소멸' },
    { id: 'ending0', label: '🚀 엔딩 0단계: T4 도달' },
    { id: 'ending1', label: '🚀 엔딩 1단계: 물자 완성' },
    { id: 'ending2', label: '🚀 엔딩 2단계: 전력 완충' },
  ];
  CHEATS.splice(CHEATS.findIndex(c => c.id === 'ending0'), 0, { id: 'togglefps', label: 'FPS 표시 켜기/끄기' });
  function doHiddenCheat() { toggleCheatMenu(); }
  function buildCheatMenu() {
    cheatEl = document.createElement('div');
    cheatEl.id = 'cheat-menu'; cheatEl.style.display = 'none';
    cheatEl.innerHTML = `<div class="cheat-title">치트</div>` +
      CHEATS.map(c => `<button class="cheat-btn" data-cheat="${c.id}">${c.label}</button>`).join('') +
      `<button class="cheat-close" data-cheat="close">닫기</button>`;
    document.getElementById('game').appendChild(cheatEl);
    cheatEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cheat]'); if (!b) return;
      applyCheat(b.dataset.cheat);
    });
    document.addEventListener('mousedown', (e) => {
      if (cheatEl.style.display === 'none') return;
      if (!cheatEl.contains(e.target)) cheatEl.style.display = 'none';
    });
  }
  function toggleCheatMenu() {
    if (!cheatEl) buildCheatMenu();
    cheatEl.style.display = (cheatEl.style.display === 'none') ? 'block' : 'none';
    G.Assets.playSfx('click');
  }
  function applyCheat(id) {
    if (id === 'close') { cheatEl.style.display = 'none'; return; }
    if (id === 'money') {
      S.money += C.CHEAT_MONEY || 9999999;
      flash('💰+' + (C.CHEAT_MONEY || 9999999).toLocaleString());
    } else if (id === 'scrap') {
      if (!S.warehouse['철조각']) S.warehouse['철조각'] = [];
      for (let i = 0; i < 9999; i++) S.warehouse['철조각'].push({ type: '철조각', isProduct: false, amount: 1, stats: { 크기: 0 } });
      lastWhSig = ''; lastInventorySig = '';
      flash('철조각 +9,999');
    } else if (id === 'chaosmaggot') {
      if (!S.warehouse['카오스 구더기']) S.warehouse['카오스 구더기'] = [];
      for (let i = 0; i < 99; i++) S.warehouse['카오스 구더기'].push({ id: G.uid(), type: '카오스 구더기', isProduct: false, amount: 1, stats: { 크기: 0 } });
      lastWhSig = ''; lastInventorySig = '';
      flash('카오스 구더기 +99');
    } else if (id === 'electronics') {
      if (!S.warehouse['전자부품']) S.warehouse['전자부품'] = [];
      for (let i = 0; i < 999; i++) S.warehouse['전자부품'].push({ id: G.uid(), type: '전자부품', isProduct: false, amount: 1, stats: { 크기: 0 } });
      lastWhSig = ''; lastInventorySig = '';
      flash('전자부품 +999');
    } else if (id === 'achievements') {
      const stats = S.achievementStats || (S.achievementStats = {});
      Object.assign(stats, { pets: 100, creatures: 1000, labor: 50, meat: 1000, products: 10000, chaosMaggots: 3, powerUsed: 1000, unchi: 100000 });
      stats.productTypes = stats.productTypes || {};
      Object.keys(G.PRODUCTS || {}).forEach(type => { stats.productTypes[type] = true; });
      S.monumentsUnlocked = S.monumentsUnlocked || {};
      S.monumentsNotified = S.monumentsNotified || {};
      ((G.MENU.monument && G.MENU.monument.items) || []).forEach(type => {
        S.monumentsUnlocked[type] = true;
        S.monumentsNotified[type] = true;
      });
      if (G.Factory && G.Factory.refreshMenu) G.Factory.refreshMenu();
      flash('모든 업적 달성 · 기념물 개방');
    } else if (id === 'creatures') {
      for (let i = 0; i < (C.CHEAT_CREATURES || 10); i++) G.Factory.dropToFactory(G.Creatures.newAdult());
      flash('성체 ' + (C.CHEAT_CREATURES || 10) + '마리 추가');
    } else if (id === 'research') {
      (G.UPGRADES || []).forEach(u => { S.upgrades[u.key] = u.maxLevel || (u.costMult ? (u.maxLevel || 20) : 5); });
      if (G.Factory && G.Factory.refreshMenu) G.Factory.refreshMenu();
      renderResearch();
      flash('연구 즉시 완료');
    } else if (id === 'killinvaders') {
      const n = (G.Factory && G.Factory.clearInvaders) ? G.Factory.clearInvaders() : 0;
      flash('침입 실장석 ' + n + '마리 소멸');
    } else if (id === 'togglefps') {
      S.showFps = !S.showFps;
      updateFpsDisplay(S.showFps ? 0 : null, true);
      flash(S.showFps ? 'FPS 표시 ON' : 'FPS 표시 OFF');
    } else if (/^ending[012]$/.test(id)) {
      const stage = +id.slice(-1);
      if (G.Factory && G.Factory.endingCheat) G.Factory.endingCheat(stage);
    }
    G.Assets.playSfx('click');
  }

  let endingModalEl = null;
  function ensureEndingModal() {
    if (endingModalEl) return endingModalEl;
    endingModalEl = document.createElement('div');
    endingModalEl.id = 'ending-modal';
    endingModalEl.style.display = 'none';
    document.getElementById('game').appendChild(endingModalEl);
    return endingModalEl;
  }
  function closeEndingModal() {
    if (endingModalEl) endingModalEl.style.display = 'none';
    G.dialogPaused = false;
  }
  function showEndingConfirm(onYes) {
    const el = ensureEndingModal();
    G.dialogPaused = true;
    el.innerHTML = `<div class="ending-modal-box"><h3>경고</h3>
      <p>이 의뢰는 엔딩으로 진행하는 마지막 의뢰입니다.<br>의뢰를 수행하는 동안 많은 어려움이 있으며, 되돌릴 수 없습니다.</p>
      <div class="ending-modal-actions"><button data-ending-answer="yes">예</button><button data-ending-answer="no">아니오</button></div></div>`;
    el.style.display = 'flex';
    el.querySelector('[data-ending-answer="yes"]').onclick = () => { closeEndingModal(); if (onYes) onYes(); };
    el.querySelector('[data-ending-answer="no"]').onclick = closeEndingModal;
  }
  function showEndingChoice(onChoose) {
    const el = ensureEndingModal();
    G.dialogPaused = !endingDialogueRunsLive();
    el.innerHTML = `<div class="ending-modal-box ending-choice-box"><h3>마지막 선택</h3>
      <div class="ending-choice-list">
        <button data-ending-choice="1">공장을 잘 부탁해, 미도리.</button>
        <button data-ending-choice="2">나도 여기 남을거야.</button>
        <button data-ending-choice="3">탈출할 자격이 있는건 너와 나 뿐이지.</button>
      </div></div>`;
    el.style.display = 'flex';
    el.querySelectorAll('[data-ending-choice]').forEach(btn => btn.onclick = () => {
      const choice = +btn.dataset.endingChoice;
      closeEndingModal();
      if (onChoose) onChoose(choice);
    });
  }
  function showEndingSubChoice(onChoose) {
    const el = ensureEndingModal();
    G.dialogPaused = !endingDialogueRunsLive();
    el.innerHTML = `<div class="ending-modal-box ending-choice-box"><h3>미도리와 함께 탈출한다</h3>
      <div class="ending-choice-list">
        <button data-ending-sub="1">이 모든 걸 준비한건 우리 둘이잖아.</button>
        <button data-ending-sub="2">네 공이 큰데 너를 두고 가는건 말도 안돼.</button>
      </div></div>`;
    el.style.display = 'flex';
    el.querySelectorAll('[data-ending-sub]').forEach(btn => btn.onclick = () => {
      closeEndingModal();
      if (onChoose) onChoose(+btn.dataset.endingSub);
    });
  }
  let endingCinematicEl = null;
  function ensureEndingCinematic() {
    if (endingCinematicEl) return endingCinematicEl;
    endingCinematicEl = document.createElement('div');
    endingCinematicEl.id = 'ending-cinematic';
    endingCinematicEl.style.display = 'none';
    endingCinematicEl.innerHTML = `<div class="ending-count"></div><img class="ending-earth"><img class="ending-art"><div class="ending-caption"></div><button class="ending-finish"></button>`;
    document.getElementById('game').appendChild(endingCinematicEl);
    return endingCinematicEl;
  }
  function waitMs(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  async function runEndingCinematic(kind) {
    const el = ensureEndingCinematic();
    const count = el.querySelector('.ending-count'), earth = el.querySelector('.ending-earth'), art = el.querySelector('.ending-art');
    const caption = el.querySelector('.ending-caption'), finish = el.querySelector('.ending-finish');
    G.paused = false; G.dialogPaused = false; G.openingPaused = false; updatePauseIndicator();
    G.Assets.setAudioMuted && G.Assets.setAudioMuted(true);
    el.className = ''; el.style.display = 'flex'; count.style.display = 'block'; earth.className = 'ending-earth'; art.className = 'ending-art';
    earth.style.display = art.style.display = finish.style.display = 'none'; caption.textContent = '';
    for (let n = 5; n >= 1; n--) {
      count.textContent = n;
      if (n === 1) {
        if (G.Factory && G.Factory.endingCountdownFinale) G.Factory.endingCountdownFinale();
      } else if (G.Factory && G.Factory.endingCinematicShot) {
        G.Factory.endingCinematicShot(5 - n, kind === 'together');
      }
      const countStarted = performance.now();
      while (performance.now() - countStarted < 1000) {
        if (n === 1 && G.Factory && G.Factory.endingCinematicTick) G.Factory.endingCinematicTick(0.05);
        await waitMs(50);
      }
    }
    count.style.display = 'none';
    el.classList.add('launching');
    if (G.Factory && G.Factory.endingLaunchStart) G.Factory.endingLaunchStart();
    const started = performance.now();
    while (performance.now() - started < 3200) {
      const p = (performance.now() - started) / 3200;
      if (G.Factory && G.Factory.endingLaunchFrame) G.Factory.endingLaunchFrame(p);
      if (G.Factory && G.Factory.endingCinematicTick) G.Factory.endingCinematicTick(0.05);
      await waitMs(50);
    }
    el.classList.add('blackout');
    await waitMs(5000);
    const id = kind === 'alone' ? 'alone' : (kind === 'stay' ? 'stay' : 'together');
    if (G.EndingRecords) G.EndingRecords.unlock(id);
    if (kind !== 'stay') {
      earth.src = 'assets/images/ui/end_earth.png';
      earth.style.display = 'block';
      requestAnimationFrame(() => earth.classList.add('show'));
      await waitMs(10000);
      earth.classList.remove('show'); await waitMs(1000); earth.style.display = 'none';
    }
    const data = {
      alone: { img: 'ending_alone.png', bgm: G.BGM_END_ALONE, title: '엔딩 1. 고마워 미도리.' },
      stay: { img: 'ending_stay.png', bgm: G.BGM_END_STAY, title: '엔딩 2. 체류.' },
      together: { img: 'ending_together.png', bgm: G.BGM_END_TOGETHER, title: '엔딩 3. 세상 끝까지 함께.' },
    }[kind];
    G.Assets.setAudioMuted && G.Assets.setAudioMuted(false);
    G.Assets.setBgmVolumeMultiplier && G.Assets.setBgmVolumeMultiplier(1);
    G.Assets.setBgmMode && G.Assets.setBgmMode(data.bgm);
    art.src = 'assets/images/ui/' + data.img; art.style.display = 'block';
    caption.textContent = data.title;
    requestAnimationFrame(() => art.classList.add('show'));
    finish.textContent = kind === 'stay' ? '계속 플레이' : '새 게임';
    finish.style.display = 'block';
    finish.onclick = () => {
      el.style.display = 'none'; el.className = ''; art.className = 'ending-art'; G.openingPaused = false;
      if (kind === 'stay') {
        if (G.Factory && G.Factory.finishStayEnding) G.Factory.finishStayEnding();
      } else openNewGameDialog();
    };
  }
  // 통계창에서 다시 보는 엔딩은 게임 UI와 분리된 최상위 오버레이로 표시한다.
  function showEndingGallery(id) {
    const map = {
      alone: ['ending_alone.png', G.BGM_END_ALONE, '엔딩 1. 고마워 미도리.'],
      stay: ['ending_stay.png', G.BGM_END_STAY, '엔딩 2. 체류.'],
      together: ['ending_together.png', G.BGM_END_TOGETHER, '엔딩 3. 세상 끝까지 함께.'],
    };
    const d = map[id];
    if (!d) return;
    const prev = document.getElementById('ending-gallery-overlay');
    if (prev) prev.remove();
    const wasPaused = !!G.paused;
    endingGalleryOpen = true;
    G.paused = true;
    updatePauseIndicator();

    const g = document.createElement('div');
    g.id = 'ending-gallery-overlay';
    g.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;isolation:isolate;overflow:hidden;';
    const img = document.createElement('img');
    img.src = 'assets/images/ui/' + d[0];
    img.alt = d[2];
    img.style.cssText = 'position:relative;z-index:1;display:block;width:100vw;height:100vh;object-fit:contain;';
    img.onerror = () => console.warn('[엔딩] 이미지 로드 실패', img.src);
    const cap = document.createElement('div');
    cap.textContent = d[2];
    cap.style.cssText = 'position:absolute;left:50%;bottom:28px;z-index:2;transform:translateX(-50%);color:#fff;font-size:24px;font-weight:700;text-shadow:0 3px 10px #000;white-space:nowrap;';
    const close = document.createElement('button');
    close.textContent = '닫기';
    close.style.cssText = 'position:absolute;right:28px;top:24px;z-index:3;padding:10px 20px;border:1px solid #fff;background:rgba(0,0,0,.72);color:#fff;font-size:16px;cursor:pointer;';
    g.appendChild(img); g.appendChild(cap); g.appendChild(close);
    document.body.appendChild(g);

    G.Assets.setAudioMuted && G.Assets.setAudioMuted(false);
    G.Assets.setBgmVolumeMultiplier && G.Assets.setBgmVolumeMultiplier(1);
    G.Assets.setBgmMode && G.Assets.setBgmMode(d[1]);
    G.Assets.startBgm && G.Assets.startBgm();

    const closeFn = () => {
      if (!endingGalleryOpen) return;
      endingGalleryOpen = false;
      g.remove();
      G.paused = wasPaused;
      updatePauseIndicator();
      const ending = S.ending || {};
      if (ending.infinite) G.Assets.setBgmMode && G.Assets.setBgmMode(G.BGM_END_STAY);
      else if (ending.accepted && ending.stage >= 2) G.Assets.setBgmMode && G.Assets.setBgmMode(G.BGM_EXIT);
      else if (ending.accepted && ending.stage >= 1) G.Assets.setBgmPlaylist && G.Assets.setBgmPlaylist(G.BGM_CLIMAX || []);
      else G.Assets.setBgmMode && G.Assets.setBgmMode(null);
    };
    close.onclick = closeFn;
  }

  /* ---- 옵션 ----------------------------------------------------------- */
  function buildOptionsMenu() {
    optionsEl = document.getElementById('options-menu');
    const btn = document.getElementById('tb-options');
    optionsEl.innerHTML = `
      <div class="opt-title">옵션</div>
      <div class="opt-tabs">
        <button class="opt-tab" data-opt-tab="save">저장</button>
        <button class="opt-tab" data-opt-tab="audio">음량</button>
        <button class="opt-tab" data-opt-tab="keys">단축키</button>
      </div>
      <div class="opt-pane" data-pane="save">
        <div class="opt-slots" id="opt-slots"></div>
        <div class="opt-file-row">
          <button data-opt="export">📤 파일로 저장</button>
          <button data-opt="import">📥 파일 불러오기</button>
        </div>
        <button data-opt="reset">초기화</button>
        <div class="opt-message" id="opt-message"></div>
        <div class="opt-save-time" id="opt-save-time"></div>
        <input type="file" id="opt-import-input" accept="application/json,.json" style="display:none">
      </div>
      <div class="opt-pane" data-pane="audio">
        <label class="opt-slider">BGM <input type="range" min="0" max="100" step="1" data-volume="bgm"><b id="opt-bgm-val">0%</b></label>
        <label class="opt-slider">효과음 <input type="range" min="0" max="100" step="1" data-volume="sfx"><b id="opt-sfx-val">0%</b></label>
      </div>
      <div class="opt-pane opt-keys-pane" data-pane="keys">
        <div class="opt-key-section">
          <b>건설 단축키</b>
          <div id="opt-build-hotkeys"></div>
        </div>
        <div class="opt-key-section">
          <b>공장 조작</b>
          <div class="opt-fixed-keys">
            <span><kbd>W A S D</kbd><em>카메라 이동</em></span>
            <span><kbd>마우스 휠</kbd><em>확대·축소</em></span>
            <span><kbd>휠 드래그</kbd><em>화면 이동</em></span>
            <span><kbd>E</kbd><em>컨베이어 벨트</em></span>
            <span><kbd>Q</kbd><em>벽 건설</em></span>
            <span><kbd>R</kbd><em>건물·복사 배치 회전</em></span>
            <span><kbd>M</kbd><em>선택 건물 이동</em></span>
            <span><kbd>F</kbd><em>주변 화물 정리</em></span>
            <span><kbd>B</kbd><em>플레이어 인벤토리</em></span>
            <span><kbd>X + 드래그</kbd><em>우리 철거</em></span>
            <span><kbd>Delete / Backspace</kbd><em>선택 대상 삭제</em></span>
            <span><kbd>Esc / 우클릭</kbd><em>현재 작업 취소</em></span>
          </div>
        </div>
        <div class="opt-key-section">
          <b>편집·저장</b>
          <div class="opt-fixed-keys">
            <span><kbd>Ctrl + Z</kbd><em>실행 취소</em></span>
            <span><kbd>Ctrl + C</kbd><em>선택 건물 복사</em></span>
            <span><kbd>Ctrl + 0~9</kbd><em>복사 배치를 청사진으로 저장</em></span>
            <span><kbd>Ctrl + S</kbd><em>슬롯 1 즉시 저장</em></span>
            <span><kbd>Space</kbd><em>일시정지·재개</em></span>
          </div>
        </div>
      </div>`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleOptions(); });
    optionsEl.addEventListener('click', onOptionClick);
    optionsEl.addEventListener('input', onOptionInput);
    optionsEl.addEventListener('change', onOptionChange);
    const importInput = document.getElementById('opt-import-input');
    if (importInput) importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      G.Save.importFile(file, (ok) => {
        optionsMessage = ok ? ('파일 불러오기 완료: ' + file.name) : ('파일 불러오기 실패' + (G.Save.error ? ' (' + G.Save.error() + ')' : ''));
        lastSaveSlotSig = '';
        renderOptions();
        flash(optionsMessage);
        if (ok) closeOptions();
      });
      e.target.value = '';  // 같은 파일 다시 선택 가능하도록 초기화
    });
    document.addEventListener('mousedown', (e) => {
      if (!optionsEl.classList.contains('open')) return;
      if (!optionsEl.contains(e.target) && e.target !== btn) closeOptions();
    });
    renderOptions();
  }
  function toggleOptions() {
    optionsEl.classList.toggle('open');
    renderOptions();
  }
  function closeOptions() { if (optionsEl) optionsEl.classList.remove('open'); }
  function renderOptions() {
    if (!optionsEl || !optionsEl.classList.contains('open')) return;
    renderSaveSlots();
    const t = G.Save && G.Save.savedAt ? G.Save.savedAt() : null;
    const line = document.getElementById('opt-save-time');
    if (line) line.textContent = t ? ('최근 자동저장: ' + formatTime(t)) : '자동저장 없음';
    const msg = document.getElementById('opt-message');
    if (msg) {
      msg.textContent = optionsMessage;
      msg.classList.toggle('show', !!optionsMessage);
      msg.classList.toggle('error', optionsMessage.includes('실패'));
    }
    optionsEl.querySelectorAll('.opt-tab').forEach(b => b.classList.toggle('active', b.dataset.optTab === optionsTab));
    optionsEl.querySelectorAll('.opt-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === optionsTab));
    const audio = S.audio || (S.audio = { bgm: 0.35, sfx: 1 });
    const bgm = optionsEl.querySelector('[data-volume="bgm"]');
    const sfx = optionsEl.querySelector('[data-volume="sfx"]');
    if (bgm) bgm.value = Math.round((audio.bgm == null ? 0.35 : audio.bgm) * 100);
    if (sfx) sfx.value = Math.round((audio.sfx == null ? 1 : audio.sfx) * 100);
    const bv = document.getElementById('opt-bgm-val'); if (bv && bgm) bv.textContent = bgm.value + '%';
    const sv = document.getElementById('opt-sfx-val'); if (sv && sfx) sv.textContent = sfx.value + '%';
    renderHotkeyOptions();
  }
  function renderHotkeyOptions() {
    const wrap = document.getElementById('opt-build-hotkeys');
    if (!wrap || !G.Factory || !G.Factory.hotkeyBindings || !G.Factory.hotkeyToolOptions) return;
    const bindings = G.Factory.hotkeyBindings();
    const tools = G.Factory.hotkeyToolOptions();
    const grouped = {};
    for (const tool of tools) {
      if (!grouped[tool.category]) grouped[tool.category] = [];
      grouped[tool.category].push(tool);
    }
    const choices = Object.keys(grouped).map(cat =>
      `<optgroup label="${cat}">${grouped[cat].map(t => `<option value="${t.type}">${t.name}</option>`).join('')}</optgroup>`
    ).join('');
    wrap.innerHTML = ['1','2','3','4','5','6','7','8','9','0'].map(key =>
      `<label class="opt-key-bind"><kbd>${key}</kbd><select data-build-hotkey="${key}"><option value="">미지정</option>${choices}</select></label>`
    ).join('');
    wrap.querySelectorAll('[data-build-hotkey]').forEach(select => { select.value = bindings[select.dataset.buildHotkey] || ''; });
  }
  function onOptionChange(e) {
    const select = e.target.closest('select[data-build-hotkey]');
    if (!select || !G.Factory || !G.Factory.setBuildHotkey) return;
    const ok = G.Factory.setBuildHotkey(select.dataset.buildHotkey, select.value);
    optionsMessage = ok ? (select.value ? `${select.dataset.buildHotkey}번 단축키 변경` : `${select.dataset.buildHotkey}번 단축키 해제`) : '단축키 변경 실패';
    renderOptions();
    flash(optionsMessage);
  }
  function renderSaveSlots() {
    const wrap = document.getElementById('opt-slots'); if (!wrap || !G.Save || !G.Save.slotCount) return;
    const n = G.Save.slotCount();
    let sig = '';
    let html = '';
    for (let i = 1; i <= n; i++) {
      const t = G.Save.slotSavedAt(i);
      sig += i + ':' + (t || 0) + '|';
      const info = t ? formatDateTime(t) : '';
      html += `<div class="opt-slot-row"><span class="opt-slot-name">슬롯 ${i}</span><span class="opt-slot-time">${info}</span>` +
        `<button data-slot-save="${i}">저장</button>` +
        `<button data-slot-load="${i}" ${t ? '' : 'disabled'}>로드</button></div>`;
    }
    if (sig === lastSaveSlotSig) return;
    lastSaveSlotSig = sig;
    wrap.innerHTML = html;
  }
  function formatTime(t) {
    const d = new Date(t);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  function formatDateTime(t) {
    const d = new Date(t);
    return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) + ' ' + formatTime(t);
  }
  function onOptionClick(e) {
    const tab = e.target.closest('[data-opt-tab]');
    if (tab) { optionsTab = tab.dataset.optTab; renderOptions(); G.Assets.playSfx('click'); return; }
    const saveBtn = e.target.closest('button[data-slot-save]');
    if (saveBtn) {
      const n = +saveBtn.dataset.slotSave;
      const ok = G.Save.saveSlot(n);
      optionsMessage = ok ? ('슬롯 ' + n + ' 저장 완료') : ('슬롯 ' + n + ' 저장 실패' + (G.Save.error ? ' (' + G.Save.error() + ')' : ''));
      renderOptions();
      flash(optionsMessage);
      G.Assets.playSfx('click'); return;
    }
    const loadBtn = e.target.closest('button[data-slot-load]');
    if (loadBtn) {
      const n = +loadBtn.dataset.slotLoad;
      if (!G.Save.hasSlot(n)) { flash('슬롯 ' + n + ' 비어 있음'); return; }
      const ok = G.Save.loadSlot(n);
      optionsMessage = ok ? ('슬롯 ' + n + ' 로드 완료') : ('슬롯 ' + n + ' 로드 실패' + (G.Save.error ? ' (' + G.Save.error() + ')' : ''));
      renderOptions();
      flash(optionsMessage);
      if (ok) closeOptions();
      G.Assets.playSfx('click'); return;
    }
    const b = e.target.closest('button[data-opt]'); if (!b) return;
    const opt = b.dataset.opt;
    if (opt === 'export') {
      const ok = G.Save.exportFile();
      optionsMessage = ok ? '세이브를 파일로 저장했습니다' : ('파일 저장 실패' + (G.Save.error ? ' (' + G.Save.error() + ')' : ''));
      renderOptions();
      flash(optionsMessage);
      G.Assets.playSfx('click'); return;
    }
    if (opt === 'import') {
      const input = document.getElementById('opt-import-input');
      if (input) input.click();
      G.Assets.playSfx('click'); return;
    }
    if (opt === 'reset') {
      const now = performance.now();
      if (now < resetArmedUntil) {
        resetArmedUntil = 0;
        openNewGameDialog();
      } else {
        resetArmedUntil = now + 4000;
        optionsMessage = '초기화를 한 번 더 누르면 진행';
        renderOptions();
      }
    G.Assets.playSfx('click'); return;
    }
    closeOptions();
    G.Assets.playSfx('click');
  }

  function buildNewGameDialog() {
    newGameEl = document.createElement('div');
    newGameEl.id = 'new-game-dialog';
    newGameEl.style.display = 'none';
    newGameEl.innerHTML = `
      <div class="ng-card">
        <div class="ng-title">새 게임</div>
        <div class="ng-sub">난이도를 선택하세요.</div>
        <div class="ng-choices">
          <button data-difficulty="breeding"><b>사육</b><span>쉬움 · 시작 자금 ₩50,000 · 사료 소모 1/2 · 침입 40분 후 · 침입 규모 1/2</span></button>
          <button data-difficulty="park"><b>공원</b><span>보통 · 현재 기본 규칙</span></button>
          <button data-difficulty="dokura"><b>독라</b><span>어려움 · 튜토리얼 없음 · 침입 체력 2배 · 창고별 독립 인벤토리</span></button>
        </div>
        <div class="ng-actions"><button data-ng-cancel="1">취소</button></div>
      </div>`;
    document.getElementById('game').appendChild(newGameEl);
    newGameEl.addEventListener('click', (e) => {
      if (e.target === newGameEl || e.target.closest('[data-ng-cancel]')) { closeNewGameDialog(); return; }
      const tut = e.target.closest('[data-tutorial-choice]');
      if (tut) { startNewGame(tut.dataset.tutorialChoice === 'yes'); G.Assets.playSfx('click'); return; }
      const btn = e.target.closest('[data-difficulty]');
      if (!btn || btn.disabled) return;
      pendingDifficulty = btn.dataset.difficulty || 'park';
      if (pendingDifficulty === 'dokura') startNewGame(false);
      else showTutorialChoice();
      G.Assets.playSfx('click');
    });
  }
  function openNewGameDialog() {
    if (!newGameEl) buildNewGameDialog();
    pendingDifficulty = 'park';
    closeOptions();
    newGameEl.style.display = 'flex';
    newGameEl.classList.remove('tutorial-choice');
    newGameEl.querySelector('.ng-title').textContent = '새 게임';
    newGameEl.querySelector('.ng-sub').textContent = '난이도를 선택하세요.';
    newGameEl.querySelector('.ng-choices').innerHTML = `
      <button data-difficulty="breeding"><b>사육</b><span>쉬움 · 시작 자금 ₩50,000 · 사료 소모 1/2 · 침입 40분 후 · 침입 규모 1/2</span></button>
      <button data-difficulty="park"><b>공원</b><span>보통 · 현재 기본 규칙</span></button>
      <button data-difficulty="dokura"><b>독라</b><span>어려움 · 튜토리얼 없음 · 침입 체력 2배 · 창고별 독립 인벤토리</span></button>`;
  }
  function closeNewGameDialog() {
    if (newGameEl) newGameEl.style.display = 'none';
  }
  function showTutorialChoice() {
    const label = pendingDifficulty === 'breeding' ? '사육' : (pendingDifficulty === 'dokura' ? '독라' : '공원');
    newGameEl.classList.add('tutorial-choice');
    newGameEl.querySelector('.ng-title').textContent = label + ' 난이도';
    newGameEl.querySelector('.ng-sub').textContent = '튜토리얼을 켜고 시작할까요?';
    newGameEl.querySelector('.ng-choices').innerHTML = `
      <button data-tutorial-choice="yes"><b>예</b><span>설명서를 바탕으로 다음 목표를 안내합니다.</span></button>
      <button data-tutorial-choice="no"><b>아니오</b><span>안내 없이 바로 시작합니다.</span></button>`;
  }
  function startNewGame(tutorial) {
    const label = pendingDifficulty === 'breeding' ? '사육' : (pendingDifficulty === 'dokura' ? '독라' : '공원');
    if (pendingDifficulty === 'dokura') tutorial = false;
    G.Save.reset({ difficulty: pendingDifficulty, tutorial: !!tutorial });
    optionsMessage = label + ' 난이도로 새 게임 시작';
    lastSaveSlotSig = '';
    closeNewGameDialog();
    renderOptions();
    renderTutorial();
    flash(optionsMessage + (tutorial ? ' · 튜토리얼 ON' : ''));
    if (G.Factory && G.Factory.playOpeningIntro) G.Factory.playOpeningIntro(true);
  }

  // 튜토리얼 미도리 표정:
  // dialogueEmotion / enterDialogueEmotion은 해당 대사 묶음의 기본 표정이다.
  // 특정 문장만 바꾸려면 문자열 대신 { text: '대사', emotion: 'laugh' } 형태로 작성한다.
  // 사용 가능: normal, midori_normal, laziness, laugh, mad, sad, shy, sleep, wrong, amaze, greed, lol
  const TUTORIAL_STEPS = [
    { title: '1. 화면 조종', body: 'W, A, S, D를 전부 사용해 공장 화면을 움직이세요.', tip: '네 방향을 모두 사용해야 넘어갑니다.', done: () => ['w','a','s','d'].every(k => tutorialFlag('camera:' + k)) },
    { title: '2. 확대와 축소', body: '마우스 휠로 확대와 축소를 각각 한 번씩 사용하세요.', done: () => tutorialFlag('zoomIn') && tutorialFlag('zoomOut'),
      dialogueEmotion: 'laugh',
      dialogue: ['좋아. 카메라 기초 조작법은 숙지했네. 그정도는 당연히 해야지.', '다음으로 넘어갈게. 생산의 기초 라인이야.'] },
    { title: '3-1. 출산대 설치', body: '생산 탭의 출산대를 1번 성체 우리 한 칸 옆 표시 위치에 설치하세요.', guide: { cat: 'production', item: 'birthing', adjacentPen: 0, size: { w: 2, h: 2 }, buildings: ['penbox'] }, done: () => tutorialFlag('built:birthing') },
    { title: '3-2. 성체 장착', body: '우리 안 성체실장을 드래그해 출산대에 장착하세요.', guide: { buildings: ['birthing', 'penbox'] }, done: () => tutorialFlag('loaded:birthing') },
    { title: '3-3. 세면대 설치', body: '점액덩어리가 나오면 생산 탭에서 세면대를 설치하세요.', guide: { cat: 'production', item: 'washbasin', buildings: ['birthing'] }, done: () => tutorialFlag('made:점액덩어리') && tutorialFlag('built:washbasin'),
      dialogueEmotion: 'laziness',
      dialogue: ['점막덩어리는 방치하면 30초 뒤에 구더기로 바뀌어.', '구더기는 가공하지 않으면 가장 상품성이 없으니까, 일부러 구더기를 만들려는게 아니라면 세면대를 꼭 설치해야해.'] },
    { title: '3-4. 새끼 우리', body: '구더기, 엄지 또는 자실장이 나오면 새 우리를 설치해 성체와 분리하세요.', guide: { cat: 'production', item: 'penbox', buildings: ['washbasin'] }, done: () => (tutorialFlag('made:구더기') || tutorialFlag('made:엄지') || tutorialFlag('made:자실장')) && countBuildings('penbox') >= 2,
      dialogueEmotion: 'mad',
      dialogue: ['실장석들은 탐욕스럽고 약자에게 잔인한 종이야.', '교육받지 않은 성체는 새끼를 잡아먹으니까 반드시 분리해야해.'] },
    { title: '3-5. 출산 자동 장착', body: '1번 성체 우리와 출산대 사이에 집게를 설치하세요. 집게가 성체를 출산대에 자동 장착합니다.', guide: { cat: 'logistics', item: 'grabber', buildings: ['penbox', 'birthing'] }, done: () => grabberCount() >= 1 },
    { title: '3-6. 성장 회수 집게', body: '1번 성체 우리와 2번 새끼 우리 사이의 강조 위치에 두 번째 집게를 설치하세요.', guide: { cat: 'logistics', item: 'grabber', betweenPens: true, buildings: ['penbox'] }, done: () => grabberCount() >= 2 },
    { title: '3-7. 성체 필터', body: '두 번째 집게를 선택하고 필터에서 성체실장을 지정하세요.', guide: { filter: '성체실장', buildings: ['grabber', 'longgrabber'] }, done: () => tutorialFlag('filter:성체실장') },
    { title: '3-8. 성장 운송선', body: '성체 필터 집게의 출구에서 컨베이어 벨트를 1번 성체 우리까지 이어주세요.', guide: { cat: 'logistics', item: 'belt', buildings: ['penbox', 'grabber', 'longgrabber'] }, done: () => !!(G.Factory && G.Factory.tutorialGrowthLineConnected && G.Factory.tutorialGrowthLineConnected()) },
    { title: '3-9. 강제 성장 확인', body: '연결이 확인되었습니다. 새끼 우리의 자실장 한 마리를 성체로 성장시킵니다.', enter: () => { if (G.Factory && G.Factory.forceTutorialGrowth) G.Factory.forceTutorialGrowth(); }, guide: { buildings: ['penbox'] }, done: () => tutorialFlag('tutorialAdultGrown') || !!(G.Factory && G.Factory.forceTutorialGrowth && G.Factory.forceTutorialGrowth()) },
    { title: '3-10. 번식 루틴 완성', body: '성장한 성체가 집게와 벨트를 거쳐 1번 성체 우리에 도착할 때까지 기다리세요.', enter: t => { delete t.flags['penReceived:성체실장']; }, guide: { buildings: ['penbox', 'grabber', 'longgrabber', 'belt'] }, done: () => tutorialFlag('penReceived:성체실장'), reward: 2000,
      dialogueEmotion: 'laugh',
      dialogue: ['잘했어! 이게 식실장 공장의 가장 중요한 루틴이야. 탄생/성장/상품화 공정이지.', '단, 실장석들은 살아있는 생명체라는걸 명심해.', '기본 컨베이어 벨트는 2마리 이상 쌓이면 밖으로 도망칠 수도 있어!'] },
    { title: '4. 우리 확장', body: '생산 탭의 우리를 선택한 뒤 기존 우리에 대고 드래그해 우리를 확장하세요.', guide: { cat: 'production', item: 'penbox', buildings: ['penbox'] },
      enter: t => { t.flags.tutorialPenBaseline = maxPenCells(); },
      done: () => tutorialFlag('penExpanded') || maxPenCells() > 9 },
    { title: '4-1. 사료분배기', body: '특수 탭에서 사료분배기를 골라 새끼 우리에 설치하세요.', guide: { cat: 'special', item: 'feeder', buildings: ['penbox'] }, done: () => tutorialFlag('built:feeder'), reward: 500,
      dialogueEmotion: 'laziness',
      dialogue: ['사료분배기는 반 필수적이야. 실장석들은 사료가 없어도 운치를 먹으니 죽지는 않지만...', '그래도 빨리빨리 키우려면 사료 분배기를 설치해서 운치든 사료든 주는게 좋아.', '만약 특별한 사료를 공급한다면, 육질이나 개념을 올리는데 도움이 된다구?'] },
    { title: '5. 공원 이동', body: '공원으로 이동해 새로운 실장석을 잡아올 준비를 하세요.', done: () => S.screen === 'park',
      dialogueEmotion: 'laugh',
      dialogue: ['여기는 공원이야. 실장석들은 어째선지 공원에 모여사는걸 좋아하지...', '어차피 살아봤자 쓸모없는 똥벌레들이니까 납치해서 식재료로 쓰자!'] },
    { title: '5-1. 포획 방법', body: '실장석 한 마리를 드래그해 아래 포획 통에 담으세요.', done: () => tutorialValue('parkCaptured') >= 1 },
    { title: '5-2. 다섯 마리 포획', body: '같은 방법으로 포획 통에 총 5마리를 담으세요.', done: () => tutorialValue('parkCaptured') >= 5, reward: 500 },
    { title: '6-1. 운치 필터', body: '공장으로 돌아와 집게를 선택하고 필터에 운치를 지정하세요.', guide: { cat: 'logistics', item: 'grabber', filter: '운치', buildings: ['penbox', 'grabber', 'longgrabber'] }, done: () => tutorialFlag('filter:운치'),
      dialogueEmotion: 'mad',
      dialogue: ['윽, 운치 냄새... 실장석들은 식량을 1 먹으면 배설물을 2만큼 싸는 말그대로 똥벌레야.', '이 운치를 빼내지 않아 더러워지면 육질과 행복이 떨어지니까 집게로 치우는게 좋아.'] },
    { title: '6-2. 운치 배출', body: '집게로 우리 안의 운치를 밖으로 빼내세요.', guide: { buildings: ['penbox', 'grabber', 'longgrabber'] }, done: () => tutorialFlag('extracted:운치') },
    { title: '6-3. 운치 보관', body: '빼낸 운치를 창고 또는 콜로니 센터에 넣어 공정을 완성하세요.', guide: { buildings: ['warehouse', 'colony', 'grabber', 'longgrabber'] }, done: () => tutorialFlag('stored:운치') || (S.unchi || 0) > 0, reward: 500,
      dialogueEmotion: 'laugh',
      dialogue: ['잘했어. 육질이 0이 되면 실장석들은 살이 녹아내려서 죽어버려...', '만약 그렇게 분쇄육이 되어버리면, 마우스를 대고 F키를 눌러서 치울 수 있으니까 걱정마.'] },
    { title: '7. 탈복기 설치', body: '성체 우리 한 칸 옆에 가공 탭의 탈복기를 설치하세요.', guide: { cat: 'processing', item: 'deshell', adjacentPen: 0, size: { w: 2, h: 2 }, buildings: ['penbox'] }, enterDialogueEmotion: 'laugh', enterDialogue: ['그럼 이제 돈을 벌어보자!', '실장석은 그대로 팔 수 없어. 제대로 손질해야 손님이 받아줘.'], done: () => tutorialFlag('built:deshell') },
    { title: '7-1. 도축기 설치', body: '탈복기 옆에 도축기를 설치하세요.', guide: { cat: 'processing', item: 'slaughter', buildings: ['deshell'] }, done: () => tutorialFlag('built:slaughter') },
    { title: '7-2. 도축 화물 배출', body: '도축기 안의 화물을 꺼내도록 집게를 설치하세요.', guide: { cat: 'logistics', item: 'grabber', buildings: ['slaughter'] }, done: () => grabberCount() >= 3 },
    { title: '7-3. 보관 라인 연결', body: '실장육이 창고 또는 콜로니 센터로 들어가도록 집게나 컨베이어를 연결하세요.', guide: { cat: 'logistics', buildings: ['slaughter', 'warehouse', 'colony'] }, done: () => tutorialFlag('stored:실장육') },
    { title: '7-4. 실장육 생산', body: '자유롭게 공정을 조작해 실장육 10개를 쌓으세요.', done: () => warehouseCount('실장육') >= 10 },
    { title: '7-5. 거래창 판매', body: '거래창으로 들어가 보관한 실장육을 판매하세요.', guide: { top: 'shop' }, done: () => tutorialFlag('sold:실장육') },
    { title: '7-6. 기초라인 완료', body: '생산과 판매의 기초라인을 완성했습니다.', done: () => true, reward: 1000,
      dialogueEmotion: 'greed',
      dialogue: ['드디어 돈을 벌었네. 이제 속으로 허접공장장이라고 부르지 않아도 되겠어.', '이대로 잔뜩 실장석을 가공해서 어마어마한 돈을 벌어봅시다! 콘페이토를 산처럼 쌓아보자구!'] },
  ];
  const TUTORIAL_CONDITIONAL_DIALOGUES = {
    wildIntrusion: {
      emotion: 'laziness',
      lines: [
        '가끔 이렇게 공장 밖에서 똥벌레들이 기어들어와.',
        '위험하진 않은데, 가끔 이 놈들이 컨베이어 벨트나 공정 사이에 끼어들어서 공장 자체를 멈추게 하기도 해.',
        '방어시설로 처리해버릴수도 있긴한데, 지금은 실장석 한마리도 아까우니까 우리로 보내버리자.',
        '아니면 분쇄기에 던져서 분쇄육으로 만들거나!',
      ],
    },
    raidWarning: {
      emotion: 'mad',
      lines: [
        '공장 근처에 대량의 똥벌레가 발생했다는 보고야!',
        '이 똥벌레들은 우리를 넘어서 새끼나 성체를 공격할 수 있어. 빨리 대비해야해.',
        '자동포탑을 우리 근처에 설치하거나, 오는 동선을 예측해서 설치하자.',
      ],
    },
    raidPrepared: {
      emotion: 'amaze',
      lines: ['벌써 설치를 끝냈다고?', '으음... 역시 허접은 아니구나. 위험에 대비가 되어 있어.'],
    },
    raidTurretBuilt: {
      emotion: 'lol',
      lines: ['좋아. 벌레 사냥을 해보자구~!.', '침입 실장석들을 잡으면 실장육이 나와. 그럼 맛있게 조리해보자!'],
    },
  };

  // 미도리 설치/연구/탭 설명 대사 (말투: 다소 건방진 반말)
  // 키: tab:<overlay|power>, build:<deviceType>, research:<upgradeKey>, reformerPowered
  // 각 항목은 한 번씩만 발생하며, T 버튼으로 초기화하면 다시 들을 수 있다.
  const MIDORI_EXPLAIN = {
    'tab:shop': { emotion: 'normal', lines: [
      "여기서는 공장에서 생산한 제품을 팔거나 필요한 물건을 살 수 있어.",
      "실장석도 살 수 있긴한데, 정말 급한 상황 아니면 굳이 그럴 필요 있을까...?",
      { text: "물론 산 다음 가공해서 판다면 그것도 효율적이긴 해!", emotion: 'laugh' },
    ] },
    'tab:research': { emotion: 'normal', lines: [
      "여긴 연구소가 모아준 연구력으로 새로운 시설을 해금하는 곳이야.",
      "뭘 먼저 풀지는 네 마음이지만... 돈 되는 가공시설부터 푸는 게 머리 좀 쓰는 거겠지?",
      { text: "연구력이 부족하면? 연구소에 똥벌레를 더 쑤셔넣으면 되잖아.", emotion: 'lol' },
    ] },
    'tab:stats': { emotion: 'normal', lines: [
      "여긴 공장이 얼마나 잘 굴러가는지 한눈에 보는 곳이야.",
      "수입이며 생산량이며... 숫자가 줄고 있으면 네가 뭔가 잘못하고 있다는 뜻이지.",
      { text: "뭐, 가끔은 들여다보라구. 설마 숫자도 못 읽는 건 아니지?", emotion: 'laziness' },
    ] },
    'tab:power': { emotion: 'normal', lines: [
      "전력은 있으면 좋은데, 지금 당장은 크게 중요하지 않아.",
      "가장 기초적인 실장력 발전소는 실장석을 장착하면, 빙글빙글 돌리면서 전력을 생산하는 구조야.",
      { text: "똥벌레가 쳇바퀴를 빙글빙글 돌리는 걸 보고 있으면 맛있... 아니, 귀엽긴하지.", emotion: 'laugh' },
      { text: "여기서 생산된 전력은 전봇대로 다른 곳으로 송전할 수 있어.", emotion: 'sleep' },
      "전력을 쓰지 않는 건물도 전력을 공급받으면 효율이 50% 상승하니까, 정 급할때에는 발전소를 설치해봐.",
    ] },
    'build:lab': { emotion: 'normal', lines: [
      "연구소는 실장석의 카오스 파워로 필요한 시설을 연구하는 곳이야.",
      "실장석 한마리 당 1의 연구력을 생산하고, 연구소당 최대 8마리를 넣을 수 있지.",
      "하지만 장착된 똥벌레들은 곧잘 파괴되니까 보충해줘야해.",
      { text: "...어? 실장석의 뇌로 연구할 수 있는건데 왜 인간이 모르는거냐고?", emotion: 'amaze' },
      { text: "...모르겠는데?", emotion: 'amaze' },
    ] },
    'build:deshell': { emotion: 'normal', lines: [
      "탈복기는 실장석의 옷과 머리를 벗겨내는 시설이야.",
      "이른바 '독라'라는 상태가 되어버리지. 실장석들은 독라를 노예 취급하기 때문에 아주 반응이 꼴사납다니까?",
      { text: "독라는 나중에 노동석으로도 만들 수 있으니까 기억해두라구?", emotion: 'laugh' },
    ] },
    'build:slaughter': { emotion: 'normal', lines: [
      "도축기는 '독라'를 잘라서 실장육이랑 위석으로 분리하는 시설이야.",
      { text: "실장육은 우리 공장의 초반 주력 상품이지! 돈은 여기서 나와.", emotion: 'greed' },
      "위석은 종류별로 크기가 다른데, 분쇄기에 갈아서 조미료로 만들수도 있고, 여기저기 쓸모가 많아.",
    ] },
    'build:grinder': { emotion: 'normal', lines: [
      "분쇄기는 뭐든지 갈아버리는 시설이야. 실장석, 실장육, 위석 전부.",
      "위석을 갈면 조미료가 나오고, 못 쓰게 된 고기나 실장석은 분쇄육으로 만들 수 있어.",
      { text: "쓸모없어진 똥벌레는 그냥 여기다 넣어버려. 깔끔하지?", emotion: 'lol' },
    ] },
    'build:warehouse': { emotion: 'normal', lines: [
      "창고는 생산한 물건을 보관하는 곳이야. 어디든 연결하면 화물이 쌓이지.",
      "여기 쌓인 재고는 거래창에서 한꺼번에 팔 수 있어.",
      { text: "생산 라인 끝에 하나쯤 붙여두면 물건이 바닥에 굴러다니지 않아서 편해.", emotion: 'laziness' },
    ] },
    'gridBought': { emotion: 'normal', lines: [
      "새 그리드를 샀구나. 여기엔 폐허랑 잔해가 묻혀있어서, 노동석으로 철조각을 채취할 수 있어.",
      { text: "그리고 멀리 떨어진 그리드일수록 철조각도 많고, 가끔 희귀한 자원도 튀어나오지.", emotion: 'greed' },
      { text: "돈 좀 모이면 자꾸자꾸 넓혀두라구. 게으름 피우지 말고.", emotion: 'laziness' },
    ] },
    'firstSale': { emotion: 'laugh', lines: [
      "첫 거래 성공! 근데 하나 알아둬. 같은 물건만 잔뜩 쏟아내면 시장이 포화돼서 값이 뚝뚝 떨어져.",
      { text: "값이 떨어진 물건도 시간이 좀 지나면 다시 시세가 회복되니까 너무 걱정은 말고.", emotion: 'normal' },
      { text: "그러니까 한 종류만 들이붓지 말고, 여러 제품을 골고루 파는 게 이익을 극대화하는 길이야. 게으름 피우지 말고 다양하게 굴려보라구.", emotion: 'laziness' },
    ] },
    'firstScrap': { emotion: 'greed', lines: [
      "오, 철조각이다! 이게 은근 쏠쏠하다구.",
      { text: "철조각으로는 그냥 돈으론 못 짓는, 좀 더 고급스러운 건물들을 지을 수 있어.", emotion: 'normal' },
      { text: "콜로니 티어를 올릴 때도 쓰이니까 부지런히 모아두자구.", emotion: 'normal' },
    ] },
    'firstLabor': { emotion: 'laugh', lines: [
      "드디어 노동석이 나왔네! 이제 독라 노예가 너 대신 일해줄 거야.",
      { text: "노동석을 클릭하면 명령을 내릴 수 있어. 바닥 아이템 회수, 도망친 똥벌레 잡기, 방어, 청소... 그리고 철조각 채취까지.", emotion: 'normal' },
      { text: "일단 강조된 '채취' 명령을 눌러봐. 노동석이 알아서 폐허를 뒤져 철조각을 캐올 거야.", emotion: 'normal' },
      { text: "매번 명령 내리기 귀찮으면, 노동교화소에서 기본 명령을 정해두면 갓 만든 노동석이 그대로 따라.", emotion: 'laziness' },
    ] },
    'research:가드레일벨트': { emotion: 'laziness', lines: [
      "실장석들은 레일에 적체되면 도망치려고 해.",
      { text: "그런 똥벌레들이 도망못치게 하는게 가드레일 벨트지.", emotion: 'laugh' },
      { text: "하지만 보통 컨베이어 벨트보다 비싸니까, 화물을 나를 때는 그냥 컨베이어 벨트를 쓰자!", emotion: 'normal' },
    ] },
    'research:횡단벨트': { emotion: 'normal', lines: [
      "횡단벨트는 입구와 출구 사이를 건너뛰어 화물을 바로 보내는 장치야.",
      "직선으로 최대 7칸까지 드래그해서 설치하면 돼.",
      { text: "출구가 막히면 입구에서부터 화물을 받지 않으니까, 막힐 걱정도 덜하겠네.", emotion: 'laugh' },
    ] },
    'research:긴팔집게': { emotion: 'normal', lines: [
      "긴팔 집게는 보통 집게보다 팔이 길어. 멀리 떨어진 화물도 집어올 수 있지.",
      "사이에 벽이나 다른 시설이 끼어있어도 너머로 휙 가져올 수 있어.",
      { text: "게으른 너한테 딱이네. 일일이 라인 안 깔아도 되잖아?", emotion: 'laugh' },
    ] },
    'research:노동교화소': { emotion: 'laugh', lines: [
      "노동교화소를 연구했구나. 드디어 독라 노예들을 부릴 수 있겠어!",
      { text: "하지만 이건 전력이 필수적인 가장 기초적인 시설이야.", emotion: 'normal' },
      { text: "발전소를 짓고 전봇대로 연결해보자. 아니면 발전소 자체에도 전력 송전이 돼.", emotion: 'normal' },
    ] },
    'reformerPowered': { emotion: 'laugh', lines: [
      "좋아. 이제 여기에 '독라'를 투입하면... 노동석으로 쓸 수 있지!",
      { text: "노동석은 바닥에 떨어진 아이템을 줍게하거나, 도망친 똥벌레들을 잡거나, 방어하거나, 철자원을 채취하거나, 쓸 일이 많아.", emotion: 'normal' },
      { text: "개념이 높으면 그만큼 빠르고 줍는 물건도 많아져. 그러니 개념이 높은 사육똥벌레들을 독라노예로 만들어버리는것도 좋겠지?", emotion: 'laugh' },
      { text: "참고로 노동석의 최대 숫자는 노동교화소 숫자에 비례하니까 필요한만큼 짓도록 하자!", emotion: 'laugh' },
    ] },
    'research:교정시설': { emotion: 'laziness', lines: [
      "여긴 사육실장을 키우는 시설이야.",
      { text: "사육실장은 새끼들을 잡아먹지 않아. 그리고 개념도 높아서 애호파 인간들이 좋아하지.", emotion: 'mad' },
      "키우기는 어렵지만 꽤 비싼값에 팔 수 있으니까 한번 키워보자구!",
    ] },
    'research:배합기': { emotion: 'normal', lines: [
      "배합기는 실장육이랑 운치, 짓소산 같은 재료를 섞어서 사료를 만드는 시설이야.",
      "실장푸드를 직접 만들어 먹이면 사료값도 아끼고 육질도 챙길 수 있지.",
      { text: "똥벌레한테 똥벌레로 만든 사료를 먹인다... 효율적이지 않아?", emotion: 'laugh' },
    ] },
    'research:조리실': { emotion: 'normal', lines: [
      "조리실은 재료들을 제대로 된 요리로 만들어내는 곳이야.",
      "그냥 고기보다 조리한 요리가 훨씬 비싸게 팔리니까, 돈 벌고 싶으면 필수지.",
      { text: "레시피대로 재료만 넣으면 되니까 어렵진 않아. 너도 할 수 있겠지?", emotion: 'laugh' },
    ] },
    'research:포장기': { emotion: 'normal', lines: [
      "포장기는 완성된 제품을 박스에 담아서 상품성을 더 끌어올려.",
      "같은 물건이라도 포장 한 번 하면 값이 달라지거든.",
      { text: "박스가 떨어지지 않게만 신경 써. 박스 없으면 포장도 못 하니까.", emotion: 'laziness' },
    ] },
    'research:짓소산생성기': { emotion: 'laugh', lines: [
      "짓소산은 실장석이 괴로워할 때 체내에서 분비되는 일종의 육수야!",
      { text: "짓소산 생성기로 이 짓소산이라는 특별한 소스를 만들어낼 수 있어.", emotion: 'laziness' },
      { text: "짓소산으로는 실장석들의 육질을 높여주는 '짓소산 푸드'나 '콘페이토'를 만들수도 있지.", emotion: 'laziness' },
      "콘페이토는 많으면 많을수록 행복해지는거니까 많이 만들자구~! 물론 돈은 안되지만.",
    ] },
    'research:태교스피커': { emotion: 'laziness', lines: [
      { text: "뎃데로게~ 그리운 목소리네.", emotion: 'sad' },
      "이건 실장석들이 태어날때부터 똥벌레가 될 확률을 줄여주는 스피커야.",
      "출산대 근처에 설치해 두면 육질이나 개념, 크기가 상승한 채로 태어날 확률이 높아져.",
    ] },
    'research:레드포인터': { emotion: 'laugh', lines: [
      "실장석들은 엉터리 생물이라, 녹색 눈이 빨간색으로 물들면 새끼를 낳아.",
      { text: "이미 이 녀석들은 많이 낳고있지만, 지금 우리는 물건이 없어서 못파는 지경이잖아?", emotion: 'laziness' },
      { text: "그러니까 잔뜩잔뜩 낳게하자구~!", emotion: 'greed' },
    ] },
    'research:꼬챙이': { emotion: 'laziness', lines: [
      "똥벌레들은 직접 보지 않으면 교훈을 얻지 못해.",
      { text: "이건 똥벌레를 교육시키는 도구야. 여기에 표본을 걸어두면 주변 녀석들이 교훈을 얻지...", emotion: 'laugh' },
      { text: "그런데 이걸 보고도 '테프프 저녀석은 분충이라걸린 테치 와타치는 안걸리는테치' 하는 놈들도 있다니까?", emotion: 'mad' },
    ] },
    'research:지뢰': { emotion: 'normal', lines: [
      "지뢰는 침입하는 똥벌레들이 밟으면 터지는 일회용 방어시설이야.",
      "침입 동선에 미리 깔아두면 알아서 한 무더기 정리해주지.",
      { text: "한 번 터지면 끝이니까, 아까워하지 말고 길목에 잔뜩 묻어두자구.", emotion: 'lol' },
    ] },
    'research:포획기': { emotion: 'normal', lines: [
      "포획기는 범위 안을 돌아다니는 실장석을 자동으로 붙잡아오는 장치야.",
      "도망친 똥벌레나 밖에서 기어든 녀석들을 일일이 쫓을 필요가 없어지지.",
      { text: "게으름뱅이한테 이만한 물건도 없겠네?", emotion: 'laugh' },
    ] },
    'research:매지컬테치카': { emotion: 'laziness', lines: [
      "실장석들은 화려하고 반짝반짝하는 것만 보면 눈을 뺏겨. 매지컬 테치카 같은걸 보면 아주 환장하지.",
      "매지컬 테치카를 우리 안에 설치해두고, 새끼 사육실장을 걸어두면 공연을 시작해.",
      "그러면 주변 실장석들이 거기에 몰입해서 행복이 잔뜩 높아지지...",
      { text: "단, 공연을 한 새끼 사육실장은 완전 분충이 되니까 조심해. 멍청한 사육실장은 운치값도 못받거든.", emotion: 'mad' },
      { text: "물론 공연 자체는 성체가 될 때까지 몇 번이고 뛰게할 수 있어! 아니면 분쇄기에 갈아버리자구.", emotion: 'laugh' },
    ] },
    'research:물류센터': { emotion: 'normal', lines: [
      "물류센터는 멀리 떨어진 창고끼리 화물을 주고받게 해주는 시설이야.",
      "공장이 넓어지면 한쪽에 쌓인 재료를 반대편으로 옮기는 게 일이거든.",
      { text: "이게 있으면 벨트를 끝도 없이 깔 필요가 없어져. 편하지?", emotion: 'laugh' },
    ] },
    'research:화력발전소': { emotion: 'laugh', lines: [
      "이제야 제대로 된 발전소를 운영할 수 있겠네! 더이상 답답한 실장력 발전소는 끝이야.",
      { text: "화력발전소는 뭐든지 태우기만하면 150의 전력을 생산해. 운치, 실장석들, 분쇄육까지도...", emotion: 'laziness' },
      { text: "이 중에는 아무래도 운치가 제일 효율적이겠지? 운치를 잔뜩 태워서 전기를 만들어보자구.", emotion: 'laziness' },
      { text: "운치부터 고기, 위석, 육수까지... 실장석은 정말 쓸모있는 생물이야.", emotion: 'sad' },
    ] },
    'research:카오스발전소': { emotion: 'laziness', lines: [
      { text: "실장석들은 그 자체로도 엉터리 생물이지만, 카오스 파워는 제일 엉터리같은 힘이야.", emotion: 'wrong' },
      { text: "물론 나도 그 카오스 파워로 실장인이 된거지만...", emotion: 'shy' },
      { text: "어쨌든 카오스 발전소를 운영하려면 실장석 12마리를 제물로 바쳐야 해.", emotion: 'normal' },
      "그 다음 시동이 걸리기 시작하면, '위석'을 투입해서 전력을 생산해. 여기서 생산되는 전력이 상당하지.",
      { text: "단, 카오스 발전소는 돌아가는 동안 제물이 낮은 확률로 파괴되니까 주기적으로 제물을 보충해줘.", emotion: 'sleep' },
    ] },
    'research:카오스게이트': { emotion: 'amaze', lines: [
      { text: '카오스 게이트...! 물류의 치트키!', emotion: 'amaze' },
      { text: '엄청난 거리를 제약없이 보낼 수 있는 사기급 운송장치야.', emotion: 'laugh' },
      { text: '좀 수상쩍은 힘을 쓰는거긴 하지만, 편하니까 상관없잖아?', emotion: 'laziness' },
    ] },
    'research:카오스포탑': { emotion: 'wrong', lines: [
      { text: '드디어 카오스 파워를 무기로 쓰는 때가 와버렸네.', emotion: 'wrong' },
      { text: '사거리 안에 있는 실장석들을 연속 체인 공격하는 무시무시한 무기야.', emotion: 'normal' },
      { text: '똥벌레를 똥으로 바꿔주는 엄청난 힘이 있지... 조심하라구.', emotion: 'laugh' },
    ] },
    'research:구더기탄도미사일': { emotion: 'amaze', lines: [
      { text: '구더기 탄도미사일...! 장난스럽지만 강력한 초장거리 무기야.', emotion: 'amaze' },
      { text: '과거 비와호에서 실장석 로켓 대회가 열렸을 때 만들어졌다는 소문이 있어.', emotion: 'normal' },
      { text: '조리실에서 구더기와 도돈파를 조합하고, 박격포에 장착하면 발사 가능해!', emotion: 'laugh' },
    ] },
  };

  function midoriExplainEnabled() {
    const t = S.tutorial;
    return !!(t && t.enabled && !t.cancelled);
  }
  function fireMidoriExplain(key) {
    const def = MIDORI_EXPLAIN[key];
    if (!def || !midoriExplainEnabled()) return false;
    const t = S.tutorial;
    if (!t.explained) t.explained = {};
    if (t.explained[key]) return false;
    t.explained[key] = true;
    midoriRadio(def.lines, { emotion: def.emotion || 'laziness' });
    return true;
  }
  function onResearchExplain(key) {
    if (!key) return;
    if (key === '구더기탄도미사일') {
      const def = MIDORI_EXPLAIN['research:' + key];
      if (def) midoriRadio(def.lines, { emotion: def.emotion || 'amaze' });
      return;
    }
    fireMidoriExplain('research:' + key);
  }
  function onReformerPowered() { fireMidoriExplain('reformerPowered'); }
  function onGridBought() { fireMidoriExplain('gridBought'); }
  function onScrapHarvested() { fireMidoriExplain('firstScrap'); }
  function onFirstSale() { fireMidoriExplain('firstSale'); }
  function onRedzoneWarehouseBlocked() {
    if (S.redzoneWarehouseWarned) return;
    S.redzoneWarehouseWarned = true;
    midoriRadio([
      { text: '적색지대는 오염지역이라, 여기에 창고를 설치하면 창고 물건이 전부 오염될수도 있어.', emotion: 'normal' },
      { text: '물론 거기서도 똥벌레들을 키우고, 물건을 제작할수도 있지만... 아무래도 불편하겠지?', emotion: 'laziness' },
    ], { emotion: 'normal' });
  }
  function onChaosMaggotFound() {
    if (S.chaosMaggotMidoriShown) return;
    S.chaosMaggotMidoriShown = true;
    midoriRadio([
      { text: '세상에, 카오스 구더기잖아?', emotion: 'amaze' },
      { text: '살아남기 위해 위석으로 온몸을 감싼 카오스 실장석이야. 어떤 존재로든 우화할 수 있는 존재지...', emotion: 'normal' },
      { text: '사용할 수 있는 방법이 아주 많아서 비싸게 팔 수 있을거야.', emotion: 'greed' },
      { text: '아니면 카오스 발전소를 지을 때 쓸수도 있어. 어느쪽이든 공장장 좋을대로 해!', emotion: 'laugh' },
    ], { emotion: 'amaze' });
  }
  function onElectronicPartsFound() {
    if (S.electronicPartsMidoriShown) return;
    S.electronicPartsMidoriShown = true;
    midoriRadio([
      { text: '오, 귀한 부품을 획득했네!', emotion: 'amaze' },
      { text: '이건 더이상 생산되지 않는 부품이야. 폐허랑 유적에서만 찾을 수 있지.', emotion: 'normal' },
      { text: '비싸게 팔수도 있겠지만... 연구소를 업그레이드할 때 쓸수도 있을걸?', emotion: 'laugh' },
    ], { emotion: 'amaze' });
  }
  // 버려진 양식장에서 처음 수산물을 채취하면(튜토리얼 여부 무관) 미도리가 한 번 반응한다.
  function onSeafoodHarvested() {
    if (S.seafoodMidoriShown) return;
    S.seafoodMidoriShown = true;
    midoriRadio([
      { text: '아직도 살아있는 생물이 남아있다고? 진짜? 대체 어디서 얻은거야?', emotion: 'wrong' },
      { text: '후타바... 해산물? 여긴 어디지?', emotion: 'normal' },
      { text: '잘 모르겠는데 혹시 바다에는 아직 생명의 싹이 남아있는걸까? 믿을만한지 모르겠지만...', emotion: 'sad' },
      { text: '어쨌든 이건 진귀한 물건이야! 비싸게 팔 수 있겠어!', emotion: 'laugh' },
    ], { emotion: 'normal' });
  }
  function onLaborProduced() {
    // 첫 노동석 설명이 처음 발동하면 '채취' 명령 강조 힌트를 켠다(채취 한 번 쓰면 꺼짐).
    if (fireMidoriExplain('firstLabor')) {
      if (!S.tutorial.flags) S.tutorial.flags = {};
      if (!S.tutorial.flags['laborMineUsed']) S.tutorial.flags['laborMineHint'] = true;
    }
  }
  // T 버튼: 게임 진행/보상은 유지하고 설명 발생 기록만 초기화한다.
  // 초기화한 설명은 관련 메뉴를 열거나 건물을 설치할 때 다시 나타난다.
  function resetTutorialExplanations() {
    let t = S.tutorial;
    if (!t) t = S.tutorial = { enabled: false, step: 0, hidden: false, flags: {} };
    if (!t.flags) t.flags = {};
    t.enabled = true;
    t.cancelled = false;
    t.hidden = false;
    t.reviewing = false;
    t.explained = {};
    t.conditionMode = null;
    t.conditionCompleting = false;
    const prevMoved = t.conditional ? t.conditional.wildMoved : false;
    t.conditional = { wildShown: false, wildMoved: prevMoved, raidWarnShown: false, turretResponseShown: false };
    tutorialAdvanceTimer = 0;
    renderTutorial();
    flash('설명이 초기화되었습니다. 관련 메뉴와 건물을 사용할 때 다시 표시됩니다.');
  }

  function fireBuildingExplain(type) {
    // 기존 건물 설치 설명은 그대로 먼저 재생한다.
    fireMidoriExplain('build:' + type);

    // 이미 완료된 연구는 연구 완료 이벤트가 다시 발생하지 않으므로,
    // 해당 건물을 설치했을 때 업그레이드 설명을 다시 들을 수 있게 한다.
    const def = G.DEVICES && G.DEVICES[type];
    const unlock = def && def.unlock;
    if (unlock && S.upgrades && S.upgrades[unlock]) {
      fireMidoriExplain('research:' + unlock);
    }
  }

  function tutorialFlag(key) {
    return !!(S.tutorial && S.tutorial.flags && S.tutorial.flags[key]);
  }
  function tutorialValue(key) {
    return (S.tutorial && S.tutorial.flags && +S.tutorial.flags[key]) || 0;
  }
  function markTutorialAction(key) {
    if (!key) return;
    if (!S.tutorial) S.tutorial = { enabled: false, step: 0, hidden: false, flags: {} };
    if (!S.tutorial.flags) S.tutorial.flags = {};
    if (key === 'parkCaptured') S.tutorial.flags[key] = (S.tutorial.flags[key] || 0) + 1;
    else S.tutorial.flags[key] = true;
    S.tutorial.reviewing = false;
    if (key.indexOf('built:') === 0) fireBuildingExplain(key.slice(6));
  }
  function countBuildings(type) {
    return (S.buildings || []).filter(b => b.type === type).length;
  }
  function grabberCount() {
    return countBuildings('grabber') + countBuildings('longgrabber');
  }
  function selectedBuildingType(type) {
    if (!S.selection || !S.selection.length) return false;
    return (S.buildings || []).some(b => b.type === type && S.selection.includes(b.id));
  }
  function maxPenCells() {
    let best = 0;
    (S.buildings || []).forEach(b => {
      if (b.type === 'penbox') best = Math.max(best, Array.isArray(b.cells) ? b.cells.length : ((b.w || 0) * (b.h || 0)));
    });
    return best;
  }
  function warehouseCount(type) {
    if (type === '운치') return Math.floor(S.unchi || 0);
    const list = S.warehouse && S.warehouse[type];
    return list && list.length ? list.length : 0;
  }
  function totalCreatures() {
    let n = 0;
    (S.buildings || []).forEach(b => { if (b.type === 'penbox' && b.creatures) n += b.creatures.length; });
    n += (S.wanderers || []).length;
    return n;
  }
  function buildTutorialPanel() {
    tutorialEl = document.createElement('div');
    tutorialEl.id = 'tutorial-panel';
    tutorialEl.dataset.mode = 'basic';
    tutorialEl.style.display = 'none';
    tutorialEl.innerHTML = `
      <div class="tut-head"><b id="tut-title"></b><span id="tut-progress"></span></div>
      <div class="tut-body" id="tut-body"></div>
      <div class="tut-tip" id="tut-tip"></div>
      <div class="tut-actions">
        <button data-tut-prev="1">이전</button>
        <button data-tut-next="1">다음</button>
        <button data-tut-hide="1">접기</button>
        <button data-tut-off="1">끄기</button>
      </div>`;
    document.getElementById('game').appendChild(tutorialEl);
    tutorialEl.addEventListener('click', (e) => {
      const t = S.tutorial || (S.tutorial = { enabled: false, step: 0, hidden: false });
      if (e.target.closest('[data-tut-prev]')) {
        t.step = Math.max(0, (t.step || 0) - 1);
        t.reviewing = true;
        tutorialAdvanceTimer = 0;
      }
      else if (e.target.closest('[data-tut-next]')) {
        const step = TUTORIAL_STEPS[t.step || 0];
        if (step && step.done && !step.done()) { flash('먼저 현재 행동을 해보세요'); return; }
        completeTutorialStep(t.step || 0);
      }
      else if (e.target.closest('[data-tut-hide]')) t.hidden = true;
      else if (e.target.closest('[data-tut-restore]')) t.hidden = false;
      else if (e.target.closest('[data-tut-off]')) { t.enabled = false; t.cancelled = true; clearTutorialHighlights(); }
      else return;
      renderTutorial();
      G.Assets.playSfx('click');
    });
  }
  function renderTutorialRestoreButton(t) {
    tutorialEl.style.display = 'block';
    tutorialEl.classList.add('collapsed');
    tutorialEl.innerHTML = `<button class="tut-restore" data-tut-restore="1">튜토리얼 보기</button>`;
    const btn = tutorialEl.querySelector('[data-tut-restore]');
    if (btn) btn.onpointerdown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      t.hidden = false;
      renderTutorial();
      G.Assets.playSfx('click');
    };
  }
  function enterTutorialStep(t, step) {
    if (!t || !step || t.enteredStep === t.step) return;
    t.enteredStep = t.step;
    if (step.enter) step.enter(t);
    if (step.enterDialogue) midoriRadio(step.enterDialogue, { emotion: step.enterDialogueEmotion || 'laziness' });
  }
  function completeTutorialStep(index) {
    const t = S.tutorial; if (!t || !t.enabled || t.step !== index) return;
    const step = TUTORIAL_STEPS[index]; if (!step) return;
    if (!t.completedSteps) t.completedSteps = {};
    if (!t.completedSteps[index]) {
      t.completedSteps[index] = true;
      if (step.reward) {
        S.money += step.reward;
        flash('튜토리얼 보상 ₩' + step.reward.toLocaleString());
      }
      if (step.dialogue) midoriRadio(step.dialogue, { emotion: step.dialogueEmotion || 'laziness' });
    }
    t.reviewing = false;
    tutorialAdvanceTimer = 0;
    if (index >= TUTORIAL_STEPS.length - 1) {
      t.completed = true;
      t.conditionMode = null;
      clearTutorialHighlights();
      flash('기초 튜토리얼 완료');
      return;
    }
    t.step = index + 1;
    t.enteredStep = -1;
    renderTutorial();
  }
  function clearTutorialHighlights() {
    document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
  }
  function applyTutorialHighlights(guide) {
    clearTutorialHighlights();
    if (!guide) return;
    if (guide.cat) {
      const el = document.querySelector(`.cat-btn[data-cat="${guide.cat}"]`);
      if (el) el.classList.add('tutorial-focus');
    }
    if (guide.item) {
      const el = document.querySelector(`.item-btn[data-type="${guide.item}"]`);
      if (el) el.classList.add('tutorial-focus');
    }
    if (guide.filter) {
      const el = document.querySelector(`#filter-panel .fp-btn[data-type="${guide.filter}"]`);
      if (el) el.classList.add('tutorial-focus');
    }
    if (guide.top) {
      const el = document.querySelector(`[data-base="${guide.top}"], [data-ovl="${guide.top}"]`);
      if (el) el.classList.add('tutorial-focus');
    }
  }
  function conditionalTutorialStep(t) {
    if (!t || !t.completed || !t.conditionMode) return null;
    if (t.conditionMode === 'wild') return {
      title: '8-2. 외부 실장석 이동',
      body: '외부에서 들어온 실장석을 드래그해 우리나 다른 위치로 옮기세요.',
      done: () => tutorialFlag('wildMoved'),
      guide: { buildings: ['penbox', 'grinder'] },
    };
    if (t.conditionMode === 'raid') return {
      title: '9. 침입 대비',
      body: '방어 탭의 자동포탑을 우리 근처 또는 침입 동선에 설치하세요.',
      done: () => countBuildings('turret') > 0,
      guide: { cat: 'defense', item: 'turret', buildings: ['penbox', 'turret'] },
    };
    return null;
  }
  function renderConditionalTutorial(t) {
    const step = conditionalTutorialStep(t);
    if (!step) { tutorialEl.style.display = 'none'; clearTutorialHighlights(); return true; }
    if (t.hidden) {
      renderTutorialRestoreButton(t);
      return true;
    }
    if (tutorialEl.dataset.mode !== 'conditional' || !tutorialEl.querySelector('#tut-title')) {
      tutorialEl.dataset.mode = 'conditional';
      tutorialEl.innerHTML = `
        <div class="tut-head"><b id="tut-title"></b><span id="tut-progress"></span></div>
        <div class="tut-body" id="tut-body"></div><div class="tut-tip" id="tut-tip"></div>
        <div class="tut-actions"><button data-tut-hide="1">접기</button><button data-tut-off="1">끄기</button></div>`;
    }
    tutorialEl.classList.remove('collapsed');
    tutorialEl.style.display = 'block';
    tutorialEl.querySelector('#tut-title').textContent = step.title;
    tutorialEl.querySelector('#tut-progress').textContent = '조건 튜토리얼';
    tutorialEl.querySelector('#tut-body').textContent = step.body;
    tutorialEl.querySelector('#tut-tip').textContent = step.done() ? '완료' : '조건을 수행하세요.';
    applyTutorialHighlights(step.guide);
    if (step.done() && !t.conditionCompleting) {
      t.conditionCompleting = true;
      setTimeout(() => {
        if (!S.tutorial || S.tutorial.conditionMode !== t.conditionMode) return;
        if (t.conditionMode === 'raid' && !t.conditional.turretResponseShown) {
          t.conditional.turretResponseShown = true;
          const d = TUTORIAL_CONDITIONAL_DIALOGUES.raidTurretBuilt;
          midoriRadio(d.lines, { emotion: d.emotion });
        }
        t.conditionMode = null;
        t.conditionCompleting = false;
        renderTutorial();
      }, 1000);
    }
    return true;
  }
  function isBasicTutorialActive() {
    const t = S.tutorial;
    return !!(t && t.enabled && !t.completed && !t.cancelled);
  }
  function tutorialGuide() {
    const t = S.tutorial;
    if (!t || !t.enabled || t.cancelled) return null;
    if (t.completed) {
      const conditional = conditionalTutorialStep(t);
      return conditional ? conditional.guide : null;
    }
    const step = TUTORIAL_STEPS[Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, t.step || 0))];
    return step && step.guide;
  }
  function onTutorialWildIntrusion(point) {
    const t = S.tutorial;
    if (!t || !t.enabled || !t.completed || t.cancelled || t.conditional.wildShown) return;
    t.conditional.wildShown = true;
    t.conditionMode = 'wild';
    t.hidden = false;
    if (point && G.Factory && G.Factory.focusCameraOnGrid) G.Factory.focusCameraOnGrid(point.x, point.y);
    const d = TUTORIAL_CONDITIONAL_DIALOGUES.wildIntrusion;
    midoriRadio(d.lines, { emotion: d.emotion });
    renderTutorial();
  }
  function onTutorialRaidWarning() {
    const t = S.tutorial;
    if (!t || !t.enabled || !t.completed || t.cancelled || t.conditional.raidWarnShown) return;
    t.conditional.raidWarnShown = true;
    if (S.raidPoint && G.Factory && G.Factory.focusCameraOnGrid) G.Factory.focusCameraOnGrid(S.raidPoint.x, S.raidPoint.y);
    const warning = TUTORIAL_CONDITIONAL_DIALOGUES.raidWarning;
    if (countBuildings('turret') > 0) {
      t.conditional.turretResponseShown = true;
      const prepared = TUTORIAL_CONDITIONAL_DIALOGUES.raidPrepared;
      const lines = warning.lines.map(line => typeof line === 'object' ? line : { text: line, emotion: warning.emotion })
        .concat(prepared.lines.map(line => typeof line === 'object' ? line : { text: line, emotion: prepared.emotion }));
      midoriRadio(lines, { emotion: warning.emotion });
    } else {
      t.conditionMode = 'raid';
      t.hidden = false;
      midoriRadio(warning.lines, { emotion: warning.emotion });
    }
    renderTutorial();
  }
  function renderTutorial() {
    if (!tutorialEl) return;
    const t = S.tutorial || (S.tutorial = { enabled: false, step: 0, hidden: false });
    if (G.openingPaused || G.dialogPaused) { tutorialEl.style.display = 'none'; return; }
    if (!t.enabled) { tutorialEl.style.display = 'none'; clearTutorialHighlights(); return; }
    if (t.completed) { renderConditionalTutorial(t); return; }
    if (t.hidden) {
      renderTutorialRestoreButton(t);
      return;
    }
    if (tutorialEl.dataset.mode !== 'basic' || !tutorialEl.querySelector('#tut-title')) {
      tutorialEl.dataset.mode = 'basic';
      tutorialEl.innerHTML = `
        <div class="tut-head"><b id="tut-title"></b><span id="tut-progress"></span></div>
        <div class="tut-body" id="tut-body"></div>
        <div class="tut-tip" id="tut-tip"></div>
        <div class="tut-actions">
          <button data-tut-prev="1">이전</button>
          <button data-tut-next="1">다음</button>
          <button data-tut-hide="1">접기</button>
          <button data-tut-off="1">끄기</button>
        </div>`;
    }
    tutorialEl.classList.remove('collapsed');
    t.step = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Math.floor(t.step || 0)));
    const step = TUTORIAL_STEPS[t.step];
    enterTutorialStep(t, step);
    const done = step.done && step.done();
    const diff = S.difficulty === 'breeding' ? '사육' : (S.difficulty === 'dokura' ? '독라' : '공원');
    tutorialEl.style.display = 'block';
    tutorialEl.querySelector('#tut-title').textContent = step.title;
    tutorialEl.querySelector('#tut-progress').textContent = diff + ' · ' + (t.step + 1) + '/' + TUTORIAL_STEPS.length + (done ? ' · 완료' : ' · 진행 중');
    tutorialEl.querySelector('#tut-body').textContent = step.body;
    tutorialEl.querySelector('#tut-tip').textContent = done && t.step < TUTORIAL_STEPS.length - 1 ? '완료. 1초 뒤 다음 목표로 넘어갑니다.' : (step.tip || '');
    applyTutorialHighlights(step.guide);
    const nextBtn = tutorialEl.querySelector('[data-tut-next]');
    if (nextBtn) nextBtn.disabled = !done;
    if (done && !step.noAuto && !t.reviewing && tutorialAdvanceTimer !== t.step + 1) {
      tutorialAdvanceTimer = t.step + 1;
      const fromStep = t.step;
      setTimeout(() => {
        const cur = S.tutorial;
        if (!cur || !cur.enabled || cur.hidden || cur.step !== fromStep) return;
        const curStep = TUTORIAL_STEPS[cur.step];
        if (curStep && curStep.done && curStep.done()) {
          completeTutorialStep(fromStep);
        }
      }, 1000);
    }
  }
  function onOptionInput(e) {
    const el = e.target.closest('[data-volume]'); if (!el) return;
    const key = el.dataset.volume;
    const v = Math.max(0, Math.min(100, +el.value || 0)) / 100;
    if (!S.audio) S.audio = { bgm: 0.35, sfx: 1 };
    S.audio[key] = v;
    if (key === 'bgm' && G.Assets.setBgmVolume) G.Assets.setBgmVolume(v);
    if (key === 'sfx' && G.Assets.setSfxVolume) G.Assets.setSfxVolume(v);
    renderOptions();
  }
  let flashEl;
  function flash(msg) {
    if (!flashEl) { flashEl = document.createElement('div'); flashEl.className = 'cheat-flash'; document.getElementById('game').appendChild(flashEl); }
    flashEl.textContent = msg; flashEl.classList.add('show');
    clearTimeout(flashEl._t); flashEl._t = setTimeout(() => flashEl.classList.remove('show'), 1400);
  }
  let notifyEl;
  // 중앙 상단 배너 알림(승급 완료 등 중요 이벤트용)
  function notify(title, sub) {
    if (!notifyEl) { notifyEl = document.createElement('div'); notifyEl.id = 'game-notify'; document.getElementById('game').appendChild(notifyEl); }
    notifyEl.innerHTML = `<b>${escHtml(title)}</b>` + (sub ? `<span>${escHtml(sub)}</span>` : '');
    notifyEl.classList.add('show');
    clearTimeout(notifyEl._t); notifyEl._t = setTimeout(() => notifyEl.classList.remove('show'), 3200);
  }

  /* ---- 정보창 -------------------------------------------------------- */
  let infoEl;
  function showCreatureInfo(c, x, y) {
    if (!infoEl) {
      infoEl = document.createElement('div'); infoEl.className = 'creature-info';
      document.getElementById('game').appendChild(infoEl);
      document.addEventListener('mousedown', (e) => { if (infoEl && !infoEl.contains(e.target)) hideInfo(); });
    }
    const def = G.CREATURES[c.type] || { label: c.type, color: '#999' };
    let growthRow = '';
    if (G.CONFIG.GROWTH_NEXT[c.type]) {
      const at = (G.CONFIG.SIZE_EVOLVE_AT && G.CONFIG.SIZE_EVOLVE_AT[c.type]) || 0;
      if (at) growthRow = `<div class="ci-row"><span>진화 크기</span><b>${Math.floor(c.stats.크기 || 0)}/${at}</b></div>`;
    }
    const grd = c.stats ? G.Creatures.gradeOfStats(c.stats) : null;
    const gradeRow = grd ? `<div class="ci-row"><span>등급</span><b style="color:${grd.color}">${grd.label}</b></div>` : '';
    if (G.Creatures.ensureVitals) G.Creatures.ensureVitals(c);
    const hpMax = G.Creatures.hpMaxOf ? G.Creatures.hpMaxOf(c) : Math.floor(c.stats.크기 || 1);
    const hpRow = `<div class="ci-row"><span>체력</span><b>${Math.floor(c.hp != null ? c.hp : hpMax)}/${hpMax}</b></div>`;
    const happyRow = `<div class="ci-row"><span>행복</span><b>${Math.floor(c.행복 != null ? c.행복 : 100)}/${G.CONFIG.CREATURE_HAPPY_MAX || 100}</b></div>`;
    infoEl.innerHTML = `
      <div class="ci-head" style="border-color:${def.color}">#${c.id} · ${def.label}</div>
      ${gradeRow}
      <div class="ci-row"><span>육질</span><b>${Math.floor(c.stats.육질)}</b></div>
      <div class="ci-row"><span>개념</span><b>${Math.floor(c.stats.개념)}</b></div>
      <div class="ci-row"><span>크기</span><b>${Math.floor(c.stats.크기)}</b></div>
      ${hpRow}${happyRow}${growthRow}`;
    const g = document.getElementById('game').getBoundingClientRect();
    const sc = g.width / C.GAME_W;
    infoEl.style.left = ((x - g.left) / sc + 12) + 'px';
    infoEl.style.top = ((y - g.top) / sc + 12) + 'px';
    infoEl.style.display = 'block';
  }
  function hideInfo() { if (infoEl) infoEl.style.display = 'none'; }

  /* ---- 오버레이 구성 ------------------------------------------------- */
  function buildOverlays() {
    const root = document.createElement('div');
    root.id = 'overlay-root';
    root.innerHTML = `
      <div class="ovl-backdrop"></div>
      <div class="ovl-panel" id="ovl-shop"></div>
      <div class="ovl-panel" id="ovl-research"></div>
      <div class="ovl-panel" id="ovl-stats"></div>`;
    document.getElementById('game').appendChild(root);
    root.querySelector('.ovl-backdrop').addEventListener('click', closeOverlay);

    // ② 거래 (구매 + 판매)
    document.getElementById('ovl-shop').innerHTML = `
      <div class="ovl-head">② 거래 <button class="ovl-close">✕</button></div>
      <div class="ovl-body">
        <div class="stat-big">보유금 💰<b id="shop-money">0</b> · ${productIcon('실장푸드', 'res-icon')}실장푸드 <b id="shop-food">0</b></div>
        <div class="res-bar" id="shop-resbar"></div>
        <h3>🛒 구매</h3>
        <div class="shop-buy-board">
          <div class="shop-buy-row">
            <div class="shop-buy-meta">${productIcon('실장푸드', 'shop-icon')}<span><b>실장푸드</b><small>개당 ₩${C.FOOD_PRICE}</small></span></div>
            <div class="shop-buy" id="shop-buy-food"></div>
            <label class="shop-autobuy shop-buy-option"><input type="checkbox" id="autobuy-on"> 자동구매 · 재고 <input type="number" id="autobuy-threshold" min="0" class="ab-num">개 이하일 때 <input type="number" id="autobuy-batch" min="1" class="ab-num">개</label>
          </div>
          <div class="shop-buy-row">
            <div class="shop-buy-meta">${productIcon('조미료', 'shop-icon')}<span><b>조미료</b><small>개당 ₩<span id="shop-seasoning-price">0</span> · 1분마다 변동</small></span></div>
            <div class="shop-buy" id="shop-buy-seasoning"></div>
          </div>
          <div class="shop-buy-row">
            <div class="shop-buy-meta"><span class="shop-symbol">◆</span><span><b>특수 아이템</b><small>희귀 소비품</small></span></div>
            <div class="shop-buy" id="shop-buy-special"></div>
          </div>
          <div class="shop-buy-row">
            <div class="shop-buy-meta"><span class="shop-symbol">♟</span><span><b>실장석</b><small>구매 즉시 우리로 이동</small></span></div>
            <div class="shop-buy-cre-controls">
              <label class="shop-autobuy">보낼 우리 <select id="buy-cre-pen"><option value="">자동 (가까운 우리)</option></select></label>
              <div class="shop-buy" id="shop-buy-cre"></div>
            </div>
          </div>
        </div>
        <h3>🏠 우리 실장석 판매 <span class="muted">(사육실장=새끼 기본가+개념↑, 성체는 절반 / 독라=육질·크기)</span></h3>
        <div class="warehouse-list" id="pen-sell-list"></div>
        <h3>⚙ 자동판매 (생기는 즉시 판매)</h3>
        <div class="autosell-list" id="autosell-list"></div>
        <h3>📦 창고 판매 (가치 💰<span id="wh-value">0</span>) <button class="sell-btn" id="sell-btn">전량 판매</button></h3>
        <div class="warehouse-list" id="warehouse-list"></div>
      </div>`;
    const buyF = document.getElementById('shop-buy-food');
    [10, 50, 100, 1000].forEach(n => {
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.innerHTML = `${productIcon('실장푸드', 'shop-icon')}+${n}개<small>₩${(n * C.FOOD_PRICE).toLocaleString()}</small>`;
      b.addEventListener('click', () => buyFood(n));
      buyF.appendChild(b);
    });
    const abOn = document.getElementById('autobuy-on');
    const abTh = document.getElementById('autobuy-threshold');
    const abBatch = document.getElementById('autobuy-batch');
    if (abOn) abOn.addEventListener('change', () => { ensureAutoBuy().on = abOn.checked; flash('실장푸드 자동구매 ' + (abOn.checked ? 'ON' : 'OFF')); });
    if (abTh) abTh.addEventListener('change', () => { ensureAutoBuy().threshold = Math.max(0, Math.floor(+abTh.value || 0)); });
    if (abBatch) abBatch.addEventListener('change', () => { ensureAutoBuy().batch = Math.max(1, Math.floor(+abBatch.value || 1)); });
    const buyS = document.getElementById('shop-buy-seasoning');
    [1, 10, 50].forEach(n => {
      const b = document.createElement('button');
      b.className = 'shop-btn'; b.dataset.season = n;
      b.innerHTML = `${productIcon('조미료', 'shop-icon')}+${n}개<small>₩0</small>`;
      b.addEventListener('click', () => buySeasoning(n));
      buyS.appendChild(b);
    });
    const buySp = document.getElementById('shop-buy-special');
    ['콘페이토'].forEach(t => {   // 도돈파·코로리·도로리는 더 이상 거래창에서 팔지 않음(조리실에서 제작)
      const price = (G.PRODUCTS[t] && G.PRODUCTS[t].shopPrice) || 0;
      const b = document.createElement('button');
      b.className = 'shop-btn';
      b.innerHTML = `${productIcon(t, 'shop-icon')}${t}<small>₩${price.toLocaleString()}</small>`;
      b.addEventListener('click', () => buySpecialItem(t));
      buySp.appendChild(b);
    });
    const buyC = document.getElementById('shop-buy-cre');
    ['성체실장', '자실장'].forEach(t => {
      const b = document.createElement('button');
      b.className = 'shop-btn'; b.dataset.buyCre = t;
      b.innerHTML = `${creatureIcon(t, 'shop-icon')}${creatureLabel(t)}<small class="buy-cre-price">₩${creBuyPrice(t).toLocaleString()}</small>`;
      b.addEventListener('click', () => buyCreature(t));
      buyC.appendChild(b);
    });
    // 자동판매 토글(생산품마다)
    const asWrap = document.getElementById('autosell-list');
    Object.keys(G.PRODUCTS).filter(p => G.PRODUCTS[p].isProduct).forEach(t => {
      const b = document.createElement('button');
      b.className = 'autosell-btn'; b.dataset.type = t; b.innerHTML = `${productIcon(t, 'mini-icon')}${t}`;
      b.addEventListener('click', () => {
        S.autoSell[t] = !S.autoSell[t];
        if (S.autoSell[t]) G.Factory.sellSomeType(t, Infinity);   // 켜는 즉시 기존 재고 판매
        b.classList.toggle('on', !!S.autoSell[t]);
        G.Assets.playSfx('click');
      });
      asWrap.appendChild(b);
    });

    // ④ 연구소
    document.getElementById('ovl-research').innerHTML = `
      <div class="ovl-head">④ 연구소 <button class="ovl-close">✕</button></div>
      <div class="ovl-body"><div class="research-status" id="research-status"></div><div class="research-tier-board" id="research-list"></div></div>`;
    const rlist = document.getElementById('research-list');
    for (let t = 0; t <= 4; t++) {
      const sec = document.createElement('section');
      sec.className = 'research-tier-section';
      sec.dataset.tier = t;
      sec.innerHTML = `<h3>콜로니 T${t}</h3><div class="research-grid" data-tier-grid="${t}"></div>`;
      rlist.appendChild(sec);
    }
    G.UPGRADES.forEach(u => {
      const card = document.createElement('div');
      card.className = 'research-card'; card.dataset.key = u.key;
      card.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p><small class="rc-tier">콜로니 T0 연구</small>
        <div class="rc-foot">Lv.<b class="rc-lv">0</b> <button class="rc-buy">₩${u.cost}</button></div>`;
      card.querySelector('.rc-buy').addEventListener('click', () => buyUpgrade(u));
      const grid = rlist.querySelector(`[data-tier-grid="${upgradeTier(u, 1)}"]`) || rlist.querySelector('[data-tier-grid="0"]');
      grid.appendChild(card);
    });
    document.getElementById('research-status').addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('button[data-cancel-research]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.cancelResearch === 'current') cancelResearch('current');
      else cancelResearch('queue', +btn.dataset.idx);
    });

    // ⑤ 통계 (판매는 거래탭으로 이동)
    document.getElementById('ovl-stats').innerHTML = `
      <div class="ovl-head">⑤ 통계 <button class="ovl-close">✕</button></div>
      <div class="ovl-body">
        <div class="stat-big">분당 판매 <b id="stat-rate">0.0</b> · 누적매출 💰<b id="stat-sales">0</b></div>
        <div class="stat-sub">화물 <span id="stat-cargo">0</span> · 배회 <span id="stat-wander">0</span> · 장치 <span id="stat-build">0</span>
          · 실장푸드 수요 <span id="stat-demand">0</span>/분 · 운치 <span id="stat-unchi">0</span>/분</div>
        <div class="stat-sub">자원 — ${productIcon('실장푸드', 'res-icon')}실장푸드 <b id="stat-food">0</b> · ${productIcon('짓소산 푸드', 'res-icon')}짓소산 푸드 <b id="stat-jisso-food">0</b> · ${productIcon('운치', 'res-icon')}운치 <b id="stat-unchistock">0</b></div>
        <h3>🏁 엔딩 기록</h3>
        <div class="ending-records" id="ending-records"></div>
        <h3>📦 소지 물자</h3>
        <div class="warehouse-list" id="inventory-list"></div>
        <h3>📈 누적 판매</h3>
        <div class="warehouse-list" id="sold-list"></div>
        <h3>💲 가격 계수 (데이터 파일에서 수정)</h3>
        <div id="price-editor" class="price-editor"></div>
      </div>`;

    root.querySelectorAll('.ovl-close').forEach(b => b.addEventListener('click', closeOverlay));
    document.getElementById('sell-btn').addEventListener('click', () => {
      const r = G.Factory.sellAllWarehouse();
      flash(r.count ? ('판매! 💰+' + r.gained.toLocaleString() + ' (' + r.count + '개)') : '판매할 재고 없음');
    });
    document.getElementById('ending-records').addEventListener('pointerdown', e => {
      const btn = e.target.closest('[data-ending-record]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      showEndingGallery(btn.dataset.endingRecord);
    });
    document.getElementById('warehouse-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-sell], button[data-jfsell]'); if (!btn) return;
      const isJissoFood = btn.dataset.jfsell != null;
      const raw = isJissoFood ? btn.dataset.jfsell : btn.dataset.sell;
      const n = raw === 'all' ? Infinity : +raw;
      const r = isJissoFood ? G.Factory.sellJissoFood(n) : G.Factory.sellSomeType(btn.dataset.type, n);
      if (r.count) flash('판매 💰+' + r.gained.toLocaleString() + ' (' + r.count + '개)');
    });
    document.getElementById('pen-sell-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-pensell]'); if (!btn) return;
      const n = btn.dataset.pensell === 'all' ? Infinity : +btn.dataset.pensell;
      const r = G.Factory.sellPenCreatures(btn.dataset.type, n);
      flash(r.count ? ('판매 💰+' + r.gained.toLocaleString() + ' (' + r.count + '마리)') : '판매할 실장석 없음');
    });
    buildPriceEditor();
  }

  function ensureAutoBuy() {
    if (!S.autoBuyFood || typeof S.autoBuyFood !== 'object') S.autoBuyFood = { on: false, threshold: 50, batch: 100 };
    return S.autoBuyFood;
  }
  function playerInventoryHasRoom(n) {
    const room = G.Factory && G.Factory.playerInventoryRoom ? G.Factory.playerInventoryRoom() : Infinity;
    if (room >= n) return true;
    flash('콜로니센터 인벤토리 공간 부족! (' + room.toLocaleString() + '칸 남음)');
    return false;
  }
  function buyFood(n) {
    const cost = n * C.FOOD_PRICE;
    if (!playerInventoryHasRoom(n)) return;
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.food += n; G.Assets.playSfx('click');
    flash('실장푸드 +' + n + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function buySeasoning(n) {
    const max = C.SEASONING_MAX || 50;
    n = Math.min(n, Math.max(0, max - (S.seasoning || 0)));
    if (n <= 0) { flash('조미료 비축 최대치(' + max + '개)'); return; }
    if (!playerInventoryHasRoom(n)) return;
    const cost = n * Math.round(S.seasoningPrice || C.SEASONING_BASE);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost; S.seasoning = Math.min(max, (S.seasoning || 0) + n); G.Assets.playSfx('click');
    flash('조미료 +' + n + ' 구매 (💰-' + cost.toLocaleString() + ')');
  }
  function creBuyPrice(type) {
    if (S.buyPrice && S.buyPrice[type] != null) return S.buyPrice[type];
    return type === '성체실장' ? (C.BUY_ADULT || 10) : (C.BUY_CHILD || 1);
  }
  function buyCreature(type) {
    const cost = creBuyPrice(type);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    const c = G.Creatures.newWild(type);
    const penSel = document.getElementById('buy-cre-pen');
    const penId = penSel && penSel.value ? +penSel.value : null;
    G.Factory.dropToFactory(c, penId);
    S.money -= cost;
    if (!S.buyPrice) S.buyPrice = {};
    S.buyPrice[type] = cost + 1;   // 살 때마다 1원 비싸짐
    G.Assets.playSfx('click');
    flash(creatureLabel(type) + ' 구매 (💰-' + cost.toLocaleString() + ') · 다음 ₩' + (cost + 1).toLocaleString());
    renderShop();   // 구매가 라벨 갱신
  }
  function buySpecialItem(type) {
    const def = G.PRODUCTS[type];
    const cost = (def && def.shopPrice) || 0;
    if (!def || !cost) return;
    if (!playerInventoryHasRoom(1)) return;
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    S.money -= cost;
    if (!S.warehouse[type]) S.warehouse[type] = [];
    S.warehouse[type].push({ id: G.uid(), type, isProduct: false, amount: 1, stats: { 크기: 0 } });
    G.Assets.playSfx('click');
    flash(type + ' 구매 (창고 +1, 💰-' + cost.toLocaleString() + ')');
  }
  function queuedLevels(key) {
    let n = 0;
    if (S.currentResearch && S.currentResearch.key === key) n++;
    for (const r of (S.researchQueue || [])) if (r.key === key) n++;
    return n;
  }
  function nextResearchLevel(u) {
    return (S.upgrades[u.key] || 0) + queuedLevels(u.key) + 1;
  }
  function researchCost(u, targetLevel) {
    const lv = targetLevel - 1;
    return u.costMult ? Math.round(u.cost * Math.pow(u.costMult, lv)) : u.cost * targetLevel;
  }
  function researchElectronicPartsCost(u, targetLevel) {
    return upgradeTier(u, targetLevel) === 3 ? 1 : 0;
  }
  function researchMaterialCosts(u, targetLevel) {
    const costs = Object.assign({}, (u && u.materials) || {});
    const electronicParts = researchElectronicPartsCost(u, targetLevel);
    if (electronicParts) costs['전자부품'] = (costs['전자부품'] || 0) + electronicParts;
    return costs;
  }
  function researchMaterialsLabel(costs) {
    return Object.keys(costs || {}).map(type => ` + ${type} ${(costs[type] || 0).toLocaleString()}`).join('');
  }
  function canAffordResearchMaterials(costs) {
    return Object.keys(costs || {}).every(type => materialCount(type) >= costs[type]);
  }
  function materialCount(type) {
    const list = S.warehouse && S.warehouse[type];
    return Array.isArray(list) ? list.length : 0;
  }
  function takeMaterial(type, count) {
    const list = S.warehouse && S.warehouse[type];
    if (!Array.isArray(list) || list.length < count) return false;
    list.splice(0, count);
    return true;
  }
  function returnMaterial(type, count) {
    if (!count) return;
    if (!S.warehouse[type]) S.warehouse[type] = [];
    for (let i = 0; i < count; i++) S.warehouse[type].push({
      id: G.uid(), type, isProduct: false, amount: 1, stats: { 크기: 0 },
    });
  }
  function researchProgressKey(r) {
    return r ? (r.key + '|' + (r.targetLevel || 0)) : '';
  }
  function isLevelResearch(u) {
    return !!(u && (!u.maxLevel || u.maxLevel > 1));
  }
  function levelResearchTier(targetLevel) {
    if (targetLevel <= 5) return 0;
    if (targetLevel <= 10) return 1;
    if (targetLevel <= 15) return 2;
    return 3;
  }
  function upgradeTier(u, targetLevel) {
    const base = Math.max(0, u && u.tier || 0);
    if (u && u.fixedTier) return base;
    if (!isLevelResearch(u)) return base;
    return Math.max(base, levelResearchTier(targetLevel || 1));
  }
  function colonyTierReady(u) {
    return (S.colonyTier || 0) >= upgradeTier(u, nextResearchLevel(u));
  }
  function buyUpgrade(u) {
    if (!S.researchQueue) S.researchQueue = [];
    const needTier = upgradeTier(u, nextResearchLevel(u));
    if ((S.colonyTier || 0) < needTier) { flash('콜로니 센터 T' + needTier + ' 필요'); return; }
    const targetLevel = nextResearchLevel(u);
    if (u.maxLevel && targetLevel > u.maxLevel) { flash('이미 연구 완료/예약됨'); return; }
    if ((S.researchQueue.length + (S.currentResearch ? 1 : 0)) >= (C.RESEARCH_QUEUE_MAX || 5)) { flash('연구 예약은 최대 ' + (C.RESEARCH_QUEUE_MAX || 5) + '개'); return; }
    const cost = researchCost(u, targetLevel);
    const electronicPartsCost = researchElectronicPartsCost(u, targetLevel);
    const materialCosts = researchMaterialCosts(u, targetLevel);
    if (S.money < cost) { flash('돈 부족! (₩' + cost.toLocaleString() + ')'); return; }
    for (const type of Object.keys(materialCosts)) {
      if (materialCount(type) < materialCosts[type]) { flash(type + ' 부족! (' + materialCosts[type].toLocaleString() + '개 필요)'); return; }
    }
    S.money -= cost;
    for (const type of Object.keys(materialCosts)) takeMaterial(type, materialCosts[type]);
    const saved = (S.researchProgressBank && S.researchProgressBank[u.key + '|' + targetLevel]) || 0;
    S.researchQueue.push({ key: u.key, name: u.name, cost, electronicPartsCost, materialCosts, targetLevel, savedProgress: saved });
    G.Assets.playSfx('click');
    flash(u.name + ' Lv.' + targetLevel + ' 연구 예약' + (saved ? ' (진행도 이어서)' : '') + ' (💰-' + cost.toLocaleString() + ')');
  }
  function cancelResearch(which, idx) {
    let r = null;
    if (which === 'current') {
      r = S.currentResearch;
      if (r) {
        if (!S.researchProgressBank) S.researchProgressBank = {};
        const k = researchProgressKey(r);
        S.researchProgressBank[k] = Math.max(S.researchProgressBank[k] || 0, Math.min(r.cost || Infinity, S.researchProgress || 0));
      }
      S.currentResearch = null;
      S.researchProgress = 0;
      S.researchCancelHold = true;
    }
    else if (S.researchQueue && S.researchQueue[idx]) r = S.researchQueue.splice(idx, 1)[0];
    if (!r) return;
    S.money += r.cost || 0;
    if (r.materialCosts) Object.keys(r.materialCosts).forEach(type => returnMaterial(type, r.materialCosts[type]));
    else if (r.electronicPartsCost) returnMaterial('전자부품', r.electronicPartsCost);
    G.Assets.playSfx('click');
    flash(r.name + ' 연구 취소' + (which === 'current' ? ' (진행도 보존)' : '') + ' (💰+' + (r.cost || 0).toLocaleString() + ')');
    renderResearch();
    renderTop();
  }

  function buildPriceEditor() {
    const wrap = document.getElementById('price-editor');
    let html = `<p class="muted">가격 계수는 데이터 파일(js/config.js의 G.PRICE_DEFAULTS)에서 직접 수정하세요. (게임 내 편집 비활성)</p>`;
    Object.keys(S.prices).forEach(prod => {
      const p = S.prices[prod];
      const parts = Object.keys(p).map(key => `${key}: ${p[key]}`).join(' · ');
      html += `<div class="price-row"><b style="color:${G.PRODUCTS[prod] ? G.PRODUCTS[prod].color : '#fff'}">${prod}</b><span class="price-vals">${parts}</span></div>`;
    });
    wrap.innerHTML = html;
  }

  /* ---- 오버레이 동적 갱신 -------------------------------------------- */
  function renderOverlay() {
    if (!S.overlay) return;
    if (S.overlay === 'shop') renderShop();
    else if (S.overlay === 'stats') renderStats();
    else if (S.overlay === 'research') renderResearch();
  }

  // 판매 카드(거래창): 위/아래 두 줄. 위=아이콘+이름+총액, 아래=개당가(+시세)+수량 버튼.
  function sellCardHtml(iconHtml, name, count, total, unit, pctTxt, buttonsHtml) {
    return `<div class="wh-item">
      <div class="wh-top">${iconHtml}<span class="wh-name">${name}</span><small class="wh-count">×${count.toLocaleString()}</small><b class="wh-total">💰${total.toLocaleString()}</b></div>
      <div class="wh-bot"><span class="unit">개당 💰${unit.toLocaleString()}${pctTxt}</span><span class="sell-mini">${buttonsHtml}</span></div>
    </div>`;
  }
  function sellButtonsHtml(attr, type) {
    const t = type != null ? ` data-type="${escAttr(type)}"` : '';
    return ['1', '10', '100', 'all'].map(n => `<button data-${attr}="${n}"${t}>${n === 'all' ? '전부' : n}</button>`).join('');
  }

  function renderPenSell() {
    // 우리 안 사육실장/독라 집계 (판매금지 우리는 제외)
    const groups = {}; PEN_SELL_TYPES.forEach(t => groups[t] = { n: 0, val: 0 });
    G.Pens.allPens().forEach(pen => { if (pen.noSell) return; pen.creatures.forEach(c => {
      const g = groups[c.type]; if (!g) return;
      g.n++; g.val += G.Creatures.priceOf(c.type, c.stats);
    }); });
    const sig = PEN_SELL_TYPES.map(t => t + ':' + groups[t].n + ':' + groups[t].val).join('|');
    if (sig === lastPenSig) return;
    lastPenSig = sig;
    const rows = PEN_SELL_TYPES.filter(t => groups[t].n > 0).map(t => {
      const g = groups[t];
      const unit = Math.round(g.val / g.n);
      const label = { 사육실장: '사육실장 성체', 새끼사육실장: '사육실장 새끼', 독라: '독라 성체', 새끼독라: '독라 새끼' }[t] || t;
      return sellCardHtml(creatureIcon(t, 'wh-icon'), label, g.n, g.val, unit, '', sellButtonsHtml('pensell', t));
    }).join('');
    document.getElementById('pen-sell-list').innerHTML = rows || '<div class="muted">우리에 판매할 사육실장/독라 없음</div>';
  }

  function renderShop() {
    document.getElementById('shop-food').textContent = Math.floor(S.food);
    document.getElementById('shop-money').textContent = Math.floor(S.money).toLocaleString();
    const resbar = document.getElementById('shop-resbar');
    if (resbar) resbar.innerHTML =
      `${productIcon('짓소산 푸드', 'res-icon')}짓소산 푸드 <b>${Math.floor(S.jissoFood || 0)}</b> · ` +
      `${productIcon('운치', 'res-icon')}운치 <b>${Math.floor(S.unchi || 0)}</b> · ` +
      `${productIcon('조미료', 'res-icon')}조미료 <b>${Math.floor(S.seasoning || 0)}</b> · ` +
      `⚡전력 <b>${Math.floor(S.powerUsed || 0).toLocaleString()}/${Math.floor(S.power || 0).toLocaleString()}</b>`;
    const sp = Math.round(S.seasoningPrice || C.SEASONING_BASE);
    document.getElementById('shop-seasoning-price').textContent = sp.toLocaleString();
    document.querySelectorAll('#shop-buy-seasoning .shop-btn').forEach(b => {
      const n = +b.dataset.season;
      b.querySelector('small').textContent = '₩' + (n * sp).toLocaleString();
    });
    renderPenSell();
    const ab = ensureAutoBuy();
    const abOn = document.getElementById('autobuy-on');
    const abTh = document.getElementById('autobuy-threshold');
    const abBatch = document.getElementById('autobuy-batch');
    if (abOn && document.activeElement !== abOn) abOn.checked = !!ab.on;
    if (abTh && document.activeElement !== abTh) abTh.value = ab.threshold;
    if (abBatch && document.activeElement !== abBatch) abBatch.value = ab.batch;
    document.querySelectorAll('#shop-buy-cre .shop-btn').forEach(b => {
      const t = b.dataset.buyCre; if (!t) return;
      const s = b.querySelector('.buy-cre-price'); if (s) s.textContent = '₩' + creBuyPrice(t).toLocaleString();
    });
    // 보낼 우리 목록 (바뀔 때만 갱신)
    const penSel = document.getElementById('buy-cre-pen');
    if (penSel && G.Pens && G.Pens.allPens) {
      const pens = G.Pens.allPens().slice().sort((a, b) => a.id - b.id);
      const sig = pens.map(p => p.id + ':' + (p.name || '')).join('|');
      if (sig !== lastBuyPenSig) {
        lastBuyPenSig = sig;
        const cur = penSel.value;
        penSel.innerHTML = '<option value="">자동 (가까운 우리)</option>' +
          pens.map(p => `<option value="${p.id}">${p.name || (p.id + '번 우리')}</option>`).join('');
        if (cur) penSel.value = cur;
      }
    }
    // 창고 재고(판매) — 변경 시에만 갱신(클릭 무효화 방지). 시세(시장 포화/희소) 반영.
    const mMult = (G.Factory && G.Factory.marketMult) ? (k) => G.Factory.marketMult(k) : () => 1;
    const mPct = (G.Factory && G.Factory.marketPct) ? (k) => G.Factory.marketPct(k) : () => 0;
    const jissoHave = Math.floor(S.jissoFood || 0);
    const jissoUnit = C.JISSO_FOOD_PRICE || 5;
    let total = jissoHave * jissoUnit;
    const whKeys = Object.keys(S.warehouse).filter(k => S.warehouse[k] && S.warehouse[k].length);
    const unitOf = (k) => {
      const list = S.warehouse[k];
      const base = list.reduce((s, d) => s + G.Creatures.cargoPrice(d), 0) / list.length;
      return Math.max(1, Math.round(base * mMult(k)));
    };
    whKeys.forEach(k => { total += unitOf(k) * S.warehouse[k].length; });
    document.getElementById('wh-value').textContent = total.toLocaleString();
    const whSig = '짓소산 푸드:' + jissoHave + '|' + whKeys.map(k => k + ':' + S.warehouse[k].length + ':' + mPct(k)).join('|');
    if (whSig !== lastWhSig) {
      lastWhSig = whSig;
      const jissoHtml = jissoHave > 0
        ? sellCardHtml(productIcon('짓소산 푸드', 'wh-icon'), '짓소산 푸드', jissoHave, jissoHave * jissoUnit, jissoUnit, '', sellButtonsHtml('jfsell'))
        : '';
      const whHtml = jissoHtml + whKeys.map(k => {
        const list = S.warehouse[k];
        const unit = unitOf(k);
        const val = unit * list.length;
        const pct = mPct(k);
        const pctTxt = pct === 0 ? '' : ` <small class="mkt ${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '+' : ''}${pct}%</small>`;
        return sellCardHtml(itemIcon(k, 'wh-icon'), k, list.length, val, unit, pctTxt, sellButtonsHtml('sell', k));
      }).join('');
      document.getElementById('warehouse-list').innerHTML = whHtml || '<div class="muted">판매할 재고 없음</div>';
    }
  }

  function renderResearch() {
    const status = document.getElementById('research-status');
    if (status) {
      const cur = S.currentResearch;
      const need = cur ? (cur.cost || 0) : 0;
      const pct = cur ? Math.min(100, Math.floor(((S.researchProgress || 0) / Math.max(1, need)) * 100)) : 0;
      const curHtml = cur
        ? `<div class="research-current"><b>${cur.name} Lv.${cur.targetLevel}</b><span>${Math.floor(S.researchProgress || 0).toLocaleString()}/${need.toLocaleString()} · ${pct}%</span><button data-cancel-research="current">취소</button></div>`
        : '<div class="muted">진행 중인 연구 없음</div>';
      const qHtml = (S.researchQueue || []).map((r, i) =>
        `<button class="research-chip" data-cancel-research="queue" data-idx="${i}" title="클릭하면 취소">${r.name} Lv.${r.targetLevel}</button>`).join('');
      status.innerHTML = curHtml + `<div class="research-queued">${qHtml || '<span class="muted">예약 없음</span>'}</div>`;
    }
    document.querySelectorAll('#research-list .research-card').forEach(card => {
      const u = G.UPGRADES.find(x => x.key === card.dataset.key); if (!u) return;
      const lv = S.upgrades[u.key] || 0;
      const targetLevel = nextResearchLevel(u);
      const cost = researchCost(u, targetLevel);
      const electronicPartsCost = researchElectronicPartsCost(u, targetLevel);
      const materialCosts = researchMaterialCosts(u, targetLevel);
      card.querySelector('.rc-lv').textContent = lv;
      const done = u.maxLevel && targetLevel > u.maxLevel;
      const needTier = upgradeTier(u, targetLevel);
      const tierGrid = document.querySelector(`#research-list [data-tier-grid="${needTier}"]`);
      if (tierGrid && card.parentElement !== tierGrid) tierGrid.appendChild(card);
      const tierLabel = card.querySelector('.rc-tier');
      if (tierLabel) tierLabel.textContent = '콜로니 T' + needTier + ' 연구';
      const tierLocked = (S.colonyTier || 0) < needTier;
      card.classList.toggle('locked', !!tierLocked);
      const btn = card.querySelector('.rc-buy'); btn.textContent = done ? '완료/예약' : (tierLocked ? ('콜로니 T' + needTier + ' 필요') : '예약 ₩' + cost.toLocaleString() + researchMaterialsLabel(materialCosts));
      btn.classList.toggle('owned', !!done);
      btn.classList.toggle('afford', !done && !tierLocked && S.money >= cost && canAffordResearchMaterials(materialCosts) && ((S.researchQueue || []).length + (S.currentResearch ? 1 : 0)) < (C.RESEARCH_QUEUE_MAX || 5));
    });
  }

  function renderStats() {
    const now = performance.now();
    while (S.produceLog.length && now - S.produceLog[0] > 60000) S.produceLog.shift();
    document.getElementById('stat-rate').textContent = S.produceLog.length.toFixed(1);
    document.getElementById('stat-sales').textContent = Math.floor(S.soldValue).toLocaleString();
    document.getElementById('stat-cargo').textContent = S.cargo.length;
    document.getElementById('stat-wander').textContent = S.wanderers.length;
    document.getElementById('stat-build').textContent = S.buildings.length;
    document.getElementById('stat-demand').textContent = S.foodDemandPerMin.toFixed(0);
    document.getElementById('stat-unchi').textContent = S.unchiPerMin.toFixed(0);
    document.getElementById('stat-food').textContent = Math.floor(S.food);
    const jf = document.getElementById('stat-jisso-food'); if (jf) jf.textContent = Math.floor(S.jissoFood || 0);
    document.getElementById('stat-unchistock').textContent = Math.floor(S.unchi);
    const er = document.getElementById('ending-records');
    if (er) {
      const records = G.EndingRecords ? G.EndingRecords.get() : {};
      const defs = [['alone', '엔딩 1. 고마워 미도리.'], ['stay', '엔딩 2. 체류.'], ['together', '엔딩 3. 세상 끝까지 함께.']];
      const endingRecordsSig = defs.map(d => d[0] + ':' + (records[d[0]] ? 1 : 0)).join('|');
      if (endingRecordsSig !== lastEndingRecordsSig || !er.children.length) {
        lastEndingRecordsSig = endingRecordsSig;
        er.innerHTML = defs.map(d => `<button data-ending-record="${d[0]}" ${records[d[0]] ? '' : 'disabled'}>${records[d[0]] ? d[1] : '???'}</button>`).join('');
      }
    }
    renderInventoryStats();
    const soldSig = Object.keys(S.sold).filter(k => S.sold[k]).map(k => k + ':' + S.sold[k] + ':' + ((S.soldValueByType && S.soldValueByType[k]) || 0)).join('|');
    if (soldSig !== lastSoldSig) {
      lastSoldSig = soldSig;
      document.getElementById('sold-list').innerHTML = Object.keys(S.sold).filter(k => S.sold[k]).map(k => {
        const value = (S.soldValueByType && S.soldValueByType[k]) || 0;
        return `<div class="wh-item">${itemIcon(k, 'wh-icon')}<span class="wh-name">${k} ×${S.sold[k]}</span><b>💰${Math.floor(value).toLocaleString()}</b></div>`;
      }).join('') || '<div class="muted">판매 기록 없음</div>';
    }
  }
  function ownedMaterialCounts() {
    const counts = {};
    const add = (type, n) => {
      n = Math.floor(n || 0);
      if (n > 0) counts[type] = (counts[type] || 0) + n;
    };
    add('실장푸드', S.food);
    add('짓소산 푸드', S.jissoFood);
    add('우마이푸드', S.umaiFood);
    add('다이어트푸드', S.dietFood);
    add('운치', S.unchi);
    add('조미료', S.seasoning);
    Object.keys(S.warehouse || {}).forEach(k => add(k, S.warehouse[k] && S.warehouse[k].length));
    return counts;
  }
  function renderInventoryStats() {
    const el = document.getElementById('inventory-list'); if (!el) return;
    const counts = ownedMaterialCounts();
    const keys = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'ko'));
    const sig = keys.map(k => k + ':' + counts[k]).join('|');
    if (sig === lastInventorySig) return;
    lastInventorySig = sig;
    el.innerHTML = keys.map(k => `<div class="wh-item">${itemIcon(k, 'wh-icon')}<span class="wh-name">${k}</span><b>×${counts[k].toLocaleString()}</b></div>`).join('') || '<div class="muted">소지 물자 없음</div>';
  }

  function fmtTimer(sec) {
    sec = Math.max(0, Math.ceil(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function raidTimerText() {
    if (S.ending && S.ending.stage === 2) return '최종 공세 진행 중';
    if (S.ending && S.ending.stage >= 3) return '발사 준비 완료';
    const raidStart = S.difficulty === 'breeding' ? 2400 : (C.RAID_START || 0);
    const untilUnlock = Math.max(0, raidStart - (S.playTime || 0));
    if (untilUnlock > 0) return '레이드 해금 ' + fmtTimer(untilUnlock);
    if (!S.raidIn || S.raidIn <= 0) return '다음 레이드 예약중';
    return '다음 레이드 ' + fmtTimer(S.raidIn);
  }
  function moneyUiPoint() {
    const game = document.getElementById('game'), money = document.getElementById('tb-money');
    if (!game || !money) return null;
    const gr = game.getBoundingClientRect(), mr = money.getBoundingClientRect();
    const sc = gr.width / C.GAME_W || 1;
    return { x: (mr.left + mr.width / 2 - gr.left) / sc, y: (mr.top + mr.height / 2 - gr.top) / sc };
  }
  function spawnMoneyUiParticles(delta) {
    const game = document.getElementById('game'), pt = moneyUiPoint();
    if (!game || !pt) return;
    const mag = Math.min(12, Math.max(4, Math.floor(Math.log10(Math.abs(delta) + 10) * 3)));
    for (let i = 0; i < mag; i++) {
      const el = document.createElement('div');
      el.className = 'coin-fx money-ui-fx' + (delta < 0 ? ' out' : '');
      const ang = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 38;
      const sx = pt.x + Math.cos(ang) * dist;
      const sy = pt.y + Math.sin(ang) * dist;
      el.style.setProperty('--sx', sx + 'px');
      el.style.setProperty('--sy', sy + 'px');
      el.style.setProperty('--tx', (pt.x + (Math.random() - 0.5) * 8) + 'px');
      el.style.setProperty('--ty', (pt.y + (Math.random() - 0.5) * 8) + 'px');
      el.style.animationDelay = (Math.random() * 0.08) + 's';
      game.appendChild(el);
      window.setTimeout(() => el.remove(), 780);
    }
  }
  // 사료분배기가 사용 중인 사료 종류의 재고를 상단에 아이콘+숫자로 표시
  function feedStock(type) {
    if (type === '운치') return S.unchi || 0;
    if (type === '짓소산 푸드') return S.jissoFood || 0;
    if (type === '우마이푸드') return S.umaiFood || 0;
    if (type === '다이어트푸드') return S.dietFood || 0;
    if (type === '실장푸드') return S.food || 0;
    return 0;
  }
  let lastFeedSig = '';
  function renderFeedStocks() {
    const el = document.getElementById('tb-feeds'); if (!el) return;
    const types = [];
    (S.buildings || []).forEach(b => { if (b.type === 'feeder' && b.feedType && types.indexOf(b.feedType) < 0) types.push(b.feedType); });
    const sig = types.join('|');
    if (sig !== lastFeedSig) {
      lastFeedSig = sig;
      el.innerHTML = types.map(t => `<span class="tb-ct" data-feed="${escAttr(t)}" title="${escAttr(t)} 재고">${productIcon(t, 'res-icon')}<b>0</b></span>`).join('');
    }
    types.forEach(t => { const s = el.querySelector(`[data-feed="${escAttr(t)}"] b`); if (s) setTextIfChanged(s, Math.floor(feedStock(t))); });
  }
  // 우리 안 종류별 개체 수 집계
  function penCounts() {
    const c = { 성체실장: 0, 자실장: 0, 독라: 0, 새끼사육실장: 0, 사육실장: 0 };
    G.Pens.allPens().forEach(p => p.creatures.forEach(cr => { if (c[cr.type] != null) c[cr.type]++; }));
    return c;
  }
  function renderResearchQueueStrip() {
    const el = document.getElementById('research-queue-strip'); if (!el) return;
    const cur = S.currentResearch;
    const q = S.researchQueue || [];
    const sig = (cur ? [cur.key, cur.name, cur.targetLevel, Math.floor(S.researchProgress || 0), cur.cost].join(':') : 'idle') + '|' +
      q.map((r, i) => [i, r.key, r.name, r.targetLevel].join(':')).join('|');
    if (sig === lastResearchStripSig) return;
    lastResearchStripSig = sig;
    if (!cur && !q.length) { el.innerHTML = '<span class="rq-empty">연구 없음</span>'; return; }
    const queueButtons = q.map((r, i) =>
      `<button class="rq-next" data-cancel-top-research="queue" data-idx="${i}" title="클릭하면 예약 취소">${escAttr(r.name)} Lv.${r.targetLevel}</button>`
    ).join('');
    const queueText = queueButtons ? `<span class="rq-queued-top">${queueButtons}</span>` : '';
    if (cur) {
      const need = cur.cost || 1;
      const pct = Math.min(100, Math.floor(((S.researchProgress || 0) / Math.max(1, need)) * 100));
      el.innerHTML = `<div class="rq-main" title="${escAttr(cur.name)} 진행 중">
        <span class="rq-name">연구: ${escAttr(cur.name)} Lv.${cur.targetLevel || ''}</span>
        <span class="rq-pct">${pct}% <button data-cancel-top-research="current" title="진행도 보존 후 취소">취소</button></span>
        <span class="rq-bar"><i style="width:${pct}%"></i></span>
        <span class="rq-num">${Math.floor(S.researchProgress || 0).toLocaleString()}/${need.toLocaleString()}</span>
        ${queueText}
      </div>`;
    } else {
      el.innerHTML = `<div class="rq-main idle"><span class="rq-name">예약</span>${queueText}</div>`;
    }
  }
  function renderTop() {
    const curMoney = Math.floor(S.money);
    if (lastMoney == null) lastMoney = curMoney;
    else if (curMoney !== lastMoney) {
      spawnMoneyUiParticles(curMoney - lastMoney);
      lastMoney = curMoney;
    }
    setTextIfChanged('tb-money', Math.floor(S.money).toLocaleString());
    const pw = document.getElementById('tb-power');
    if (pw) {
      const used = Math.floor(S.powerUsed || 0).toLocaleString();
      const total = Math.floor(S.power || 0).toLocaleString();
      const powerSig = used + '/' + total;
      setTextIfChanged(pw, powerSig);
      const powerBox = pw.closest('.tb-power');
      if (powerBox && (powerSig !== lastPowerDetailSig || tooltipOwner === powerBox)) {
        lastPowerDetailSig = powerSig;
        const info = G.Factory && G.Factory.powerUsageBreakdown ? G.Factory.powerUsageBreakdown() : null;
        const rows = obj => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).map(([name, n]) => name + ' ' + n.toLocaleString());
        const useRows = info ? rows(info.use) : [];
        const supplyRows = info ? rows(info.supply) : [];
        const text = [
          '전력 ' + used + '/' + total,
          '',
          '사용처',
          ...(useRows.length ? useRows : ['없음']),
          '',
          '공급원',
          ...(supplyRows.length ? supplyRows : ['없음']),
        ].join('\n');
        if (powerBox.dataset.nativeTitle !== text) {
          powerBox.setAttribute('title', text);
          powerBox.dataset.nativeTitle = text;
        }
        if (tooltipOwner === powerBox && titleTooltipEl) titleTooltipEl.querySelector('.mt-text').textContent = text;
      }
    }
    const sc = document.getElementById('tb-scrap'); if (sc) sc.textContent = warehouseCount('철조각').toLocaleString();
    // 우리 안 종류별 수(아이콘+숫자)
    const cnt = penCounts();
    const setCt = (id, v) => setTextIfChanged(id, v);
    setCt('tb-c-adult', cnt.성체실장); setCt('tb-c-child', cnt.자실장); setCt('tb-c-dok', cnt.독라);
    setCt('tb-c-petchild', cnt.새끼사육실장); setCt('tb-c-pet', cnt.사육실장);
    if (G.Factory && G.Factory.laborStatus) { const ls = G.Factory.laborStatus(); setCt('tb-labor', ls.count + '/' + ls.limit); }
    renderFeedStocks();
    renderResearchQueueStrip();
    const rt = document.getElementById('raid-timer');
    if (rt) {
      setTextIfChanged(rt, raidTimerText());
      const raidStart = S.difficulty === 'breeding' ? 2400 : (C.RAID_START || 0);
      rt.classList.toggle('armed', (S.playTime || 0) >= raidStart);
    }
    renderOptions();
    renderTutorial();
    renderQuestTracker();
  }

  function afterStateLoad() {
    lastWhSig = ''; lastSoldSig = ''; lastPenSig = '';
    lastMoney = Math.floor(S.money);
    G.paused = false; G.dialogPaused = false; G.openingPaused = false; updatePauseIndicator();
    if (endingModalEl) endingModalEl.style.display = 'none';
    closeOptions();
    const root = document.getElementById('overlay-root');
    if (root) root.style.display = 'none';
    document.querySelectorAll('.ovl-panel').forEach(p => p.classList.remove('active'));
    switchScreen(S.screen || 'factory');
    buildPriceEditor();
    renderOverlay();
    renderTop();
  }

  let fpsEl = null;
  function updateFpsDisplay(fps, force) {
    if (!fpsEl) {
      fpsEl = document.createElement('div');
      fpsEl.id = 'fps-counter';
      fpsEl.style.cssText = 'position:absolute;left:calc(50% + 735px);top:6px;z-index:50;min-width:72px;padding:5px 8px;border:1px solid rgba(120,170,220,.55);background:rgba(8,12,18,.82);color:#9fe8ff;font:700 13px/1.1 monospace;text-align:right;pointer-events:none;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.35)';
      document.body.appendChild(fpsEl);
    }
    fpsEl.style.display = S.showFps ? 'block' : 'none';
    if (!S.showFps) return;
    if (force || fps != null) fpsEl.textContent = 'FPS ' + Math.round(fps || 0);
  }

  return {
    init, switchScreen, showCreatureInfo, hideInfo, renderOverlay, renderTop, flash, notify, afterStateLoad,
    updateFpsDisplay,
    markTutorialAction, midoriRadio, showRadio, showEndingConfirm, showEndingChoice, showEndingSubChoice, runEndingCinematic, isBasicTutorialActive, tutorialGuide,
    resumeSimulation: () => { G.paused = false; G.dialogPaused = false; G.openingPaused = false; updatePauseIndicator(); },
    onTutorialWildIntrusion, onTutorialRaidWarning, onResearchExplain, onReformerPowered,
    onGridBought, onScrapHarvested, onLaborProduced, onFirstSale, onSeafoodHarvested,
    onRedzoneWarehouseBlocked, onChaosMaggotFound, onElectronicPartsFound,
  };
})();
