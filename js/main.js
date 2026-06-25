/* =========================================================================
 * main.js  —  초기화 + 게임 루프
 * ========================================================================= */
(function () {
  function start() {
    G.Assets.preload();
    const loadedSave = !!(G.Save && G.Save.hasSave() && G.Save.load(true));

    // 화면 스케일 (창 크기에 맞춰 1440x960 비율 유지)
    fitScale();
    window.addEventListener('resize', fitScale);

    // 모듈 초기화
    G.UI.init();
    G.Park.init();
    G.Factory.init();
    if (loadedSave) {
      G.Factory.reloadState();
      G.UI.afterStateLoad();
      G.Assets.startBgm && G.Assets.startBgm({ fadeIn: 2.5 });
    } else if (G.Factory.playOpeningIntro) {
      G.Factory.playOpeningIntro();
    }

    setInterval(() => {
      if (G.Save && G.State.autoSave !== false) G.Save.save();
    }, 60000);

    let last = performance.now();
    let fpsT = 0, fpsFrames = 0, fpsValue = 0;
    function loop(now) {
      let dt = (now - last) / 1000;
      last = now;
      fpsT += dt; fpsFrames++;
      if (fpsT >= 0.25) {
        fpsValue = fpsFrames / fpsT;
        fpsT = 0; fpsFrames = 0;
      }
      if (dt > 0.1) dt = 0.1; // 큰 프레임 점프 방지

      if (G.Assets && G.Assets.tick) G.Assets.tick(dt);
      if (!G.paused && !G.dialogPaused && !G.openingPaused && G.Factory.updateCamera) {
        G.Factory.updateCamera(dt);
      }

      // 업데이트 (일시정지 중에는 시뮬레이션 정지, 렌더는 계속)
      if (!G.paused && !G.dialogPaused && !G.openingPaused) {
        G.Park.update(dt);
        G.Pens.update(dt);
        G.Factory.update(dt);
      }

      // 렌더
      G.UI.renderTop();
      G.Park.render();
      G.Factory.render();
      G.UI.renderOverlay();
      if (G.UI.updateFpsDisplay) G.UI.updateFpsDisplay(fpsValue);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function fitScale() {
    const game = document.getElementById('game');
    const sx = window.innerWidth / G.CONFIG.GAME_W;
    const sy = window.innerHeight / G.CONFIG.GAME_H;
    const s = Math.min(sx, sy);
    game.style.transform = `translate(-50%, -50%) scale(${s})`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
