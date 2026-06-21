/* =========================================================================
 * assets.js  —  이미지 / 효과음 로더 (없으면 자동으로 플레이스홀더 사용)
 * ========================================================================= */
window.G = window.G || {};

G.Assets = (function () {
  const images = {};   // path -> {img, ok}
  const sounds = {};   // path -> Audio
  const bgm = { index: 0, audio: null, started: false, unlockBound: false, mode: null, modeIndex: 0, fade: null, introPlayed: false, volumeMult: 1 };
  const ambience = { audio: null, path: null, active: false };

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
  function audioSettings() {
    return (G.State && G.State.audio) || { bgm: 0.35, sfx: 1 };
  }
  function setBgmVolume(v) {
    const a = audioSettings();
    a.bgm = Math.max(0, Math.min(1, v));
    if (bgm.fade) bgm.fade.target = a.bgm;
    else if (bgm.audio) bgm.audio.volume = a.bgm * (bgm.volumeMult == null ? 1 : bgm.volumeMult);
    if (ambience.audio) ambience.audio.volume = a.bgm;
  }
  function setSfxVolume(v) {
    audioSettings().sfx = Math.max(0, Math.min(1, v));
  }

  // 효과음: 파일이 있으면 재생, 없으면 조용히 무시
  function playSfx(key, opts) {
    if (bgm.masterMuted) return;
    const path = G.SFX[key];
    if (!path) return;
    try {
      let a = sounds[path];
      if (!a) { a = new Audio(path); sounds[path] = a; }
      const volume = (opts && opts.volume != null) ? opts.volume : 0.5;
      a.volume = Math.max(0, Math.min(1, volume * (audioSettings().sfx == null ? 1 : audioSettings().sfx)));
      a.currentTime = 0;
      a.play().catch(() => {}); // 파일 없음/자동재생 차단 무시
    } catch (e) { /* noop */ }
  }
  function nextBgmPath() {
    const list = G.BGM || [];
    if (!list.length) return null;
    const path = list[bgm.index % list.length];
    bgm.index = (bgm.index + 1) % list.length;
    return path;
  }
  // 한 곡 재생. loop=true면 반복(오버라이드용), 아니면 끝나면 재생목록 다음 곡으로.
  function playTrack(path, loop) {
    if (!path) return;
    try {
      if (bgm.audio) { bgm.audio.pause(); bgm.audio.onended = null; }
      const a = new Audio(path);
      bgm.audio = a;
      a.volume = bgm.fade ? 0 : (audioSettings().bgm == null ? 0.35 : audioSettings().bgm) * (bgm.volumeMult == null ? 1 : bgm.volumeMult);
      a.loop = !!loop;
      a.onended = loop ? null : playNextBgm;
      const p = a.play();
      if (p && p.catch) p.catch(bindBgmUnlock);
    } catch (e) {
      bindBgmUnlock();
    }
  }
  function resumeCurrentMode() {
    if (Array.isArray(bgm.mode)) {
      const list = bgm.mode;
      if (!list.length) return;
      const path = list[bgm.modeIndex % list.length];
      bgm.modeIndex = (bgm.modeIndex + 1) % list.length;
      playTrack(path, false);
      return;
    }
    if (bgm.mode) { playTrack(bgm.mode, true); return; }
    if (!bgm.introPlayed) { bgm.introPlayed = true; playTrack(G.BGM_WELCOME, false); return; }   // 시작/초기화 후 welcome 1회
    playNextBgm();
  }
  function playNextBgm() {
    if (Array.isArray(bgm.mode)) { resumeCurrentMode(); return; }
    if (bgm.mode) { playTrack(bgm.mode, true); return; }   // 오버라이드 중이면 그 곡 유지
    playTrack(nextBgmPath(), false);
  }
  // 게임 초기화/새 시작: 다음에 다시 welcome부터 재생되도록 리셋
  function restartIntroBgm() {
    bgm.introPlayed = false;
    bgm.index = 0;
    bgm.mode = null;
    bgm.modeIndex = 0;
    bgm.volumeMult = 1;
    if (bgm.started) resumeCurrentMode();
  }
  // 배경음 모드 설정: path(문자열)=그 곡을 반복 재생, null=일반 재생목록 복귀.
  function setBgmMode(path) {
    const desired = path || null;
    if (bgm.mode === desired) return;
    bgm.mode = desired;
    if (!bgm.started) return;   // 시작 전이면 startBgm에서 적용
    resumeCurrentMode();
  }
  function setBgmPlaylist(paths) {
    bgm.mode = Array.isArray(paths) ? paths.slice() : null;
    bgm.modeIndex = 0;
    if (bgm.started) resumeCurrentMode();
  }
  function setBgmVolumeMultiplier(mult) {
    bgm.volumeMult = Math.max(0, Math.min(1, mult == null ? 1 : mult));
    if (bgm.audio) bgm.audio.volume = (audioSettings().bgm == null ? 0.35 : audioSettings().bgm) * bgm.volumeMult;
  }
  function setAudioMuted(muted) {
    bgm.masterMuted = !!muted;
    if (bgm.masterMuted) {
      if (bgm.audio) bgm.audio.pause();
      if (ambience.audio) ambience.audio.pause();
      for (const path in sounds) if (sounds[path] && sounds[path].pause) sounds[path].pause();
    } else if (bgm.started) {
      if (bgm.audio) bgm.audio.play().catch(bindBgmUnlock);
      else resumeCurrentMode();
      if (ambience.active && ambience.audio) ambience.audio.play().catch(() => {});
    }
  }
  function setAmbience(path, active) {
    const enabled = !!active && !!path;
    ambience.active = enabled;
    if (!enabled) {
      if (ambience.audio) ambience.audio.pause();
      return;
    }
    if (!ambience.audio || ambience.path !== path) {
      if (ambience.audio) ambience.audio.pause();
      ambience.path = path;
      ambience.audio = new Audio(path);
      ambience.audio.loop = true;
    }
    ambience.audio.volume = audioSettings().bgm == null ? 0.35 : audioSettings().bgm;
    if (!bgm.masterMuted) ambience.audio.play().catch(() => {});
  }
  function bindBgmUnlock() {
    if (bgm.unlockBound) return;
    bgm.unlockBound = true;
    const retry = () => {
      bgm.unlockBound = false;
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
      if (!bgm.audio || bgm.audio.paused) resumeCurrentMode();
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
  }
  function startBgm(opts) {
    if (bgm.started) return;
    bgm.started = true;
    if (opts && opts.fadeIn) {
      bgm.fade = { t: 0, dur: Math.max(0.1, opts.fadeIn), target: audioSettings().bgm == null ? 0.35 : audioSettings().bgm };
    }
    resumeCurrentMode();
  }
  function stopBgm() {
    if (bgm.audio) { bgm.audio.pause(); bgm.audio.onended = null; bgm.audio = null; }
    bgm.started = false;
    bgm.fade = null;
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
  function tick(dt) {
    animT += dt;
    if (bgm.fade && bgm.audio) {
      bgm.fade.t += Math.max(0, dt || 0);
      const p = Math.min(1, bgm.fade.t / bgm.fade.dur);
      const e = p * p * (3 - 2 * p);
      bgm.audio.volume = Math.max(0, Math.min(1, bgm.fade.target * e * (bgm.volumeMult == null ? 1 : bgm.volumeMult)));
      if (p >= 1) {
        bgm.audio.volume = bgm.fade.target * (bgm.volumeMult == null ? 1 : bgm.volumeMult);
        bgm.fade = null;
      }
    }
  }
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
  function drawDeviceSprite(ctx, type, x, y, w, h, frameIdx) {
    const cols = (type === 'warehouse' || type === 'largewarehouse') ? 1 : (type === 'packer' ? 8 : 4);
    const fi = frameIdx == null ? Math.floor(animT * (G.CONFIG.ANIM_FPS || 4)) % cols : frameIdx;
    return drawFrame(ctx, deviceImg(type), x, y, w, h, fi, 0, cols, 1);
  }
  // 파일명을 직접 지정해 장치 스프라이트(가로 4프레임) 그리기 (예: birthing_ready.png)
  function drawDeviceSpriteNamed(ctx, fileName, x, y, w, h, frameIdx) {
    return drawFrame(ctx, loadImage('assets/images/devices/' + fileName), x, y, w, h, frameIdx == null ? frame() : frameIdx, 0, 4, 1);
  }
  // 파일명 + 가로 프레임 수(cols)를 지정해 한 프레임 그리기 (예: techica.png 8프레임)
  function drawDeviceSheetFrame(ctx, fileName, x, y, w, h, frameIdx, cols) {
    const n = cols || 4;
    return drawFrame(ctx, loadImage('assets/images/devices/' + fileName), x, y, w, h, ((frameIdx == null ? 0 : frameIdx) % n + n) % n, 0, n, 1);
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

  return { loadImage, creatureImg, deviceImg, productImg, bgImg, drawOrPlaceholder, playSfx, setBgmVolume, setSfxVolume, startBgm, stopBgm, setBgmMode, setBgmPlaylist, setBgmVolumeMultiplier, setAudioMuted, setAmbience, restartIntroBgm, preload, tick, frame, dirRow, drawCreatureSprite, drawCreatureNative, drawDeviceSprite, drawDeviceSpriteNamed, drawDeviceSheetFrame, drawDeviceFit, drawProductImage };
})();
