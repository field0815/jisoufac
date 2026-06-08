/* =========================================================================
 * assets.js  —  이미지 / 효과음 로더 (없으면 자동으로 플레이스홀더 사용)
 * ========================================================================= */
window.G = window.G || {};

G.Assets = (function () {
  const images = {};   // path -> {img, ok}
  const sounds = {};   // path -> Audio

  function loadImage(path) {
    if (images[path]) return images[path];
    const rec = { img: new Image(), ok: false };
    rec.img.onload = () => { rec.ok = true; };
    rec.img.onerror = () => { rec.ok = false; };
    rec.img.src = path;
    images[path] = rec;
    return rec;
  }

  // 크리처 이미지 가져오기 (없으면 ok=false)
  function creatureImg(type) {
    const def = G.CREATURES[type];
    if (!def) return null;
    return loadImage('assets/images/creatures/' + def.img);
  }
  function deviceImg(type) {
    const def = G.DEVICES[type];
    if (!def) return null;
    return loadImage('assets/images/devices/' + def.img);
  }
  // 생산품/자원 이미지 (단일 정적 이미지, 애니메이션 없음)
  function productImg(type) {
    const def = G.PRODUCTS[type];
    if (!def || !def.img) return null;
    return loadImage('assets/images/products/' + def.img);
  }
  // 화물(생산품/자원) 아이콘을 (cx,cy) 중심 size로 그림. 없으면 false.
  function drawProductImage(ctx, type, cx, cy, size) {
    const rec = productImg(type);
    if (!rec || !rec.ok || !rec.img.width) return false;
    ctx.drawImage(rec.img, Math.round(cx - size / 2), Math.round(cy - size / 2), size, size);
    return true;
  }
  function bgImg(key) {
    if (!G.BG[key]) return null;
    return loadImage(G.BG[key]);
  }

  // 캔버스에 이미지(있으면) 아니면 플레이스홀더(색+라벨) 그리기
  function drawOrPlaceholder(ctx, rec, x, y, w, h, color, label) {
    if (rec && rec.ok) {
      ctx.drawImage(rec.img, x, y, w, h);
    } else {
      ctx.fillStyle = color || '#666';
      ctx.fillRect(x, y, w, h);
      if (label) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.font = Math.max(9, Math.floor(h * 0.28)) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w / 2, y + h / 2);
      }
    }
  }

  // 효과음: 파일이 있으면 재생, 없으면 조용히 무시
  function playSfx(key) {
    const path = G.SFX[key];
    if (!path) return;
    try {
      let a = sounds[path];
      if (!a) { a = new Audio(path); a.volume = 0.5; sounds[path] = a; }
      a.currentTime = 0;
      a.play().catch(() => {}); // 파일 없음/자동재생 차단 무시
    } catch (e) { /* noop */ }
  }

  // 미리 자주 쓰는 이미지 예열
  function preload() {
    Object.keys(G.CREATURES).forEach(creatureImg);
    Object.keys(G.DEVICES).forEach(deviceImg);
    Object.keys(G.PRODUCTS).forEach(productImg);
    Object.keys(G.BG).forEach(bgImg);
  }

  /* ---- 스프라이트 애니메이션 -------------------------------------------
   *  규격:
   *   - 장치 시트: 가로 4프레임 (4열 × 1행). 예) belt.png = [f0][f1][f2][f3]
   *   - 실장석 시트: 4프레임 × 4방향 (4열 × 4행).
   *        행 순서 = 앞(아래)/좌/우/뒤(위)
   *  이미지 크기는 자유(게임이 4등분해서 사용).
   * ----------------------------------------------------------------------- */
  let animT = 0;
  function tick(dt) { animT += dt; }
  function frame() { return Math.floor(animT * (G.CONFIG.ANIM_FPS || 4)) % 4; }

  // 이동 벡터 → 방향 행(0:앞/아래 1:좌 2:우 3:뒤/위)
  function dirRow(vx, vy) {
    if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) return 0;
    if (Math.abs(vy) >= Math.abs(vx)) return vy > 0 ? 0 : 3;
    return vx < 0 ? 1 : 2;
  }

  function drawFrame(ctx, rec, x, y, w, h, col, row, cols, rows) {
    if (!rec || !rec.ok || !rec.img.width) return false;
    const cw = rec.img.width / cols, ch = rec.img.height / rows;
    ctx.drawImage(rec.img, col * cw, row * ch, cw, ch, x, y, w, h);
    return true;
  }
  // 실장석: 현재 프레임 + 방향행. 그렸으면 true, 이미지 없으면 false.
  function drawCreatureSprite(ctx, type, x, y, w, h, dirRowIdx) {
    return drawFrame(ctx, creatureImg(type), x, y, w, h, frame(), dirRowIdx || 0, 4, 4);
  }
  // 실장석: 원본(프레임) 크기 그대로, (cx,cy) 중심에 그림.
  function drawCreatureNative(ctx, type, cx, cy, dirRowIdx) {
    const rec = creatureImg(type);
    if (!rec || !rec.ok || !rec.img.width) return false;
    const cw = rec.img.width / 4, ch = rec.img.height / 4;
    const s = (G.CONFIG.DISPLAY_SCALE && G.CONFIG.DISPLAY_SCALE[type]) || 1; // 새끼는 작게
    const dw = cw * s, dh = ch * s;
    ctx.drawImage(rec.img, frame() * cw, (dirRowIdx || 0) * ch, cw, ch, Math.round(cx - dw / 2), Math.round(cy - dh / 2), dw, dh);
    return true;
  }
  // 장치: 현재 프레임(가로 4). 그렸으면 true.
  function drawDeviceSprite(ctx, type, x, y, w, h) {
    return drawFrame(ctx, deviceImg(type), x, y, w, h, frame(), 0, 4, 1);
  }
  // 파일명을 직접 지정해 장치 스프라이트(가로 4프레임) 그리기 (예: birthing_ready.png)
  function drawDeviceSpriteNamed(ctx, fileName, x, y, w, h) {
    return drawFrame(ctx, loadImage('assets/images/devices/' + fileName), x, y, w, h, frame(), 0, 4, 1);
  }
  // 장치 프레임을 "원본 비율 유지"로 (cx,cy) 중심에 그림. 길이(가로)를 targetW에 맞춤.
  function drawDeviceFit(ctx, type, cx, cy, targetW, frameIdx) {
    const rec = deviceImg(type);
    if (!rec || !rec.ok || !rec.img.width) return false;
    const cw = rec.img.width / 4, ch = rec.img.height;
    const w = targetW, h = targetW * (ch / cw);
    const fi = (frameIdx == null) ? frame() : frameIdx;
    ctx.drawImage(rec.img, fi * cw, 0, cw, ch, cx - w / 2, cy - h / 2, w, h);
    return true;
  }

  return { loadImage, creatureImg, deviceImg, productImg, bgImg, drawOrPlaceholder, playSfx, preload, tick, frame, dirRow, drawCreatureSprite, drawCreatureNative, drawDeviceSprite, drawDeviceSpriteNamed, drawDeviceFit, drawProductImage };
})();
