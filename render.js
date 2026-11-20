/* =========================================================================
 *  던전 크루세이더 — render.js
 *  픽셀 도트 배경 · 스프라이트 · 이펙트 렌더러
 * ========================================================================= */
(function () {
  "use strict";
  const G = window.G;

  /* --------------------------------------------------------------- themes */
  const THEMES = {
    plain: {
      sky: ["#4a86c4", "#8fc2e0", "#d8ebdc"],
      far: "#3f6a76",
      far2: "#2e5560",
      ground: "#41704b",
      ground2: "#335a3c",
      ground3: "#284a31",
      sun: "#ffe9a8",
      night: false,
      deco: "tree",
      amb: "leaf",
      ambColor: "#bfe6a8",
      fog: "rgba(207,227,214,0.20)",
    },
    forest: {
      sky: ["#1d3b46", "#2d5c5a", "#6f9a74"],
      far: "#2a4a3c",
      far2: "#1d3830",
      ground: "#2b5136",
      ground2: "#214028",
      ground3: "#18321f",
      sun: "#dff3c0",
      night: false,
      deco: "deepforest",
      amb: "firefly",
      ambColor: "#c8ff9a",
      fog: "rgba(111,154,116,0.18)",
    },
    grave: {
      sky: ["#191428", "#2b2340", "#4a3d63"],
      far: "#2a2340",
      far2: "#1d1830",
      ground: "#2f2a40",
      ground2: "#241f33",
      ground3: "#191527",
      sun: "#e8e3ff",
      night: true,
      deco: "grave",
      amb: "dust",
      ambColor: "#b9a7ff",
      fog: "rgba(74,61,99,0.30)",
    },
    canyon: {
      sky: ["#4a2338", "#8f4638", "#d98a52"],
      far: "#7a3f36",
      far2: "#59302c",
      ground: "#8a5433",
      ground2: "#6b3f27",
      ground3: "#4d2d1c",
      sun: "#ffd08a",
      night: false,
      deco: "canyon",
      amb: "dust",
      ambColor: "#ffd08a",
      fog: "rgba(217,138,82,0.20)",
    },
    camp: {
      sky: ["#2a1420", "#5a2b28", "#9c5b33"],
      far: "#4a2a26",
      far2: "#331d1c",
      ground: "#5b3a28",
      ground2: "#432a1e",
      ground3: "#2f1d15",
      sun: "#ffb56b",
      night: false,
      deco: "camp",
      amb: "ember",
      ambColor: "#ff9a4d",
      fog: "rgba(156,91,51,0.22)",
    },
    lava: {
      sky: ["#160710", "#3d0d14", "#8f2618"],
      far: "#3a0f14",
      far2: "#26080d",
      ground: "#3d1a18",
      ground2: "#2a1010",
      ground3: "#1a0909",
      sun: "#ff6b2b",
      night: true,
      deco: "lava",
      amb: "ember",
      ambColor: "#ff7a32",
      fog: "rgba(143,38,24,0.28)",
    },
    ice: {
      sky: ["#0f2338", "#1e4361", "#6f9ab8"],
      far: "#2a4a63",
      far2: "#1b3348",
      ground: "#436a86",
      ground2: "#31506a",
      ground3: "#223a4f",
      sun: "#d8f2ff",
      night: true,
      deco: "ice",
      amb: "snow",
      ambColor: "#e8f7ff",
      fog: "rgba(111,154,184,0.22)",
    },
    abyss: {
      sky: ["#0a0614", "#1a0d2c", "#3a1b52"],
      far: "#1e1030",
      far2: "#140a22",
      ground: "#241534",
      ground2: "#1a0f27",
      ground3: "#110a1a",
      sun: "#c39cff",
      night: true,
      deco: "abyss",
      amb: "void",
      ambColor: "#c39cff",
      fog: "rgba(58,27,82,0.30)",
    },
  };

  // 시드 난수 (배경을 매번 같게)
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------- painting */
  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawBackground(g, W, H, themeKey, seed, gY) {
    const T = THEMES[themeKey] || THEMES.plain;
    const R = mulberry(seed);
    const horizon = Math.round(H * 0.56);

    // 하늘
    const grd = g.createLinearGradient(0, 0, 0, horizon + 10);
    grd.addColorStop(0, T.sky[0]);
    grd.addColorStop(0.55, T.sky[1]);
    grd.addColorStop(1, T.sky[2]);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, horizon + 10);

    // 별
    if (T.night) {
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(R() * W);
        const y = Math.floor(R() * horizon * 0.72);
        const a = 0.25 + R() * 0.7;
        g.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")";
        g.fillRect(x, y, 1, 1);
      }
    }

    // 해 / 달
    const sx = Math.round(W * 0.78);
    const sy = Math.round(horizon * 0.32);
    const sr = Math.round(W * 0.072);
    const glow = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.4);
    glow.addColorStop(0, "rgba(255,240,190,0.34)");
    glow.addColorStop(0.45, "rgba(255,236,180,0.10)");
    glow.addColorStop(1, "rgba(255,236,180,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, W, horizon + 10);
    // 픽셀 원
    for (let y = -sr; y <= sr; y++) {
      const half = Math.floor(Math.sqrt(Math.max(0, sr * sr - y * y)));
      px(g, sx - half, sy + y, half * 2, 1, T.sun);
      px(g, sx - half, sy + y, half * 2, 1, T.sun);
    }
    if (T.night) {
      // 달 크레이터
      g.globalAlpha = 0.09;
      px(g, sx - sr * 0.45, sy - sr * 0.3, sr * 0.38, sr * 0.38, "#000");
      px(g, sx + sr * 0.1, sy + sr * 0.2, sr * 0.26, sr * 0.24, "#000");
      g.globalAlpha = 1;
    } else {
      // 낮은 해: 위쪽만 밝게
      g.globalAlpha = 0.25;
      for (let y = -sr; y <= 0; y++) {
        const half = Math.floor(Math.sqrt(Math.max(0, sr * sr - y * y)));
        px(g, sx - half, sy + y, half * 2, 1, "#fff6d8");
      }
      g.globalAlpha = 1;
    }

    // 구름 (가로 줄무늬)
    const cloudC = T.night ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.30)";
    const cloudC2 = T.night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.16)";
    for (let i = 0; i < 5; i++) {
      const cx = R() * W * 0.9;
      const cy = 14 + R() * horizon * 0.55;
      const cw = 30 + R() * 46;
      const chh = 4 + R() * 3;
      px(g, cx, cy, cw, chh, cloudC);
      px(g, cx + cw * 0.2, cy - chh * 0.8, cw * 0.45, chh * 0.9, cloudC);
      px(g, cx + cw * 0.15, cy + chh, cw * 0.7, chh * 0.6, cloudC2);
    }

    // 원경 산맥 (2겹)
    function ridge(color, baseY, amp, step, jag) {
      g.beginPath();
      g.moveTo(0, H);
      g.lineTo(0, baseY);
      let x = 0;
      let y = baseY;
      while (x < W + step) {
        x += step * (0.6 + R() * 0.9);
        y = baseY - Math.abs(Math.sin(x * jag + R())) * amp - R() * amp * 0.35;
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = color;
      g.fill();
    }
    ridge(T.far, horizon - 16, H * 0.16, W * 0.14, 0.02);
    ridge(T.far2, horizon - 4, H * 0.1, W * 0.1, 0.03);

    // 원경 성
    if (themeKey === "plain" || themeKey === "forest" || themeKey === "camp" || themeKey === "grave") {
      drawCastle(g, Math.round(W * 0.2), horizon + 1, 1.5, T.far2, T.night ? "rgba(255,190,120,0.55)" : "rgba(255,226,170,0.30)");
    }
    // 새
    if (!T.night) {
      g.fillStyle = "rgba(20,20,30,0.35)";
      for (let i = 0; i < 4; i++) {
        const bx = W * (0.55 + i * 0.09) + R() * 10;
        const by = 26 + R() * 60;
        g.fillRect(bx, by, 2, 1);
        g.fillRect(bx + 3, by, 2, 1);
        g.fillRect(bx + 1, by - 1, 1, 1);
        g.fillRect(bx + 4, by - 1, 1, 1);
      }
    }

    // 땅
    const groundGrd = g.createLinearGradient(0, horizon, 0, H);
    groundGrd.addColorStop(0, T.ground);
    groundGrd.addColorStop(0.45, T.ground2);
    groundGrd.addColorStop(1, T.ground3);
    g.fillStyle = groundGrd;
    g.fillRect(0, horizon, W, H - horizon);
    // 지평선 하이라이트
    px(g, 0, horizon, W, 1, "rgba(255,255,255,0.14)");

    // 바닥 텍스처 (픽셀 점묘)
    for (let i = 0; i < Math.round((W * (H - horizon)) / 190); i++) {
      const x = Math.floor(R() * W);
      const y = horizon + Math.floor(R() * (H - horizon));
      const w = 1 + Math.floor(R() * 3);
      g.fillStyle = R() > 0.5 ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.10)";
      g.fillRect(x, y, w, 1);
    }

    // 흙길 (캐릭터가 서는 자리)
    if (gY) {
      const pathG = g.createLinearGradient(0, gY - 46, 0, gY + 30);
      pathG.addColorStop(0, "rgba(0,0,0,0)");
      pathG.addColorStop(0.45, "rgba(168,136,86,0.20)");
      pathG.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = pathG;
      g.fillRect(0, gY - 46, W, 76);
      g.fillStyle = "rgba(255,240,200,0.05)";
      g.fillRect(0, gY - 2, W, 2);
    }

    // 잔디 · 자갈
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(R() * W);
      const dpt = R();
      const y = Math.floor(horizon + 10 + dpt * (H - horizon));
      const s = 0.7 + dpt * 0.9;
      drawTuft(g, x, y, s, "rgba(255,255,255,0.10)");
    }
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(R() * W);
      const y = Math.floor(horizon + 18 + R() * (H - horizon - 24));
      const s = 0.5 + R() * 0.6;
      px(g, x, y, 4 * s, 2 * s, "rgba(0,0,0,0.18)");
      px(g, x, y, 3 * s, 1 * s, "rgba(255,255,255,0.07)");
    }

    // 테마별 장식
    const deco = T.deco;
    if (deco === "tree" || deco === "deepforest") {
      const n = deco === "deepforest" ? 14 : 7;
      for (let i = 0; i < n; i++) {
        const tx = R() * W;
        const depth = R();
        const ty = horizon - depth * 6 + 4 + R() * (H - horizon) * 0.55;
        const s = (deco === "deepforest" ? 1.1 : 0.8) * (0.7 + depth * 0.6) * (0.8 + R() * 0.5);
        drawTree(g, tx, ty, s, deco === "deepforest" ? "#16301f" : "#1f3f2a", "#0d1f13");
      }
    } else if (deco === "grave") {
      for (let i = 0; i < 9; i++) {
        const gx = R() * W;
        const gy = horizon + 6 + R() * (H - horizon) * 0.7;
        drawGrave(g, gx, gy, 0.7 + R() * 0.6);
      }
      // 죽은 나무
      drawDeadTree(g, W * 0.12, horizon + 4, 1.1, "#191426");
      drawDeadTree(g, W * 0.9, horizon + 10, 0.9, "#191426");
    } else if (deco === "canyon") {
      for (let i = 0; i < 5; i++) {
        const rx = R() * W;
        const ry = horizon + 8 + R() * (H - horizon) * 0.6;
        drawRock(g, rx, ry, 0.8 + R() * 0.9, "#4d2d1c", "#7a4a2c");
      }
      px(g, 0, horizon, W, 2, "rgba(255,208,138,0.10)");
    } else if (deco === "camp") {
      for (let i = 0; i < 3; i++) {
        drawTent(g, R() * W, horizon + 8 + R() * (H - horizon) * 0.45, 0.8 + R() * 0.4);
      }
      for (let i = 0; i < 6; i++) drawRock(g, R() * W, horizon + 12 + R() * (H - horizon) * 0.6, 0.5 + R() * 0.5, "#2f1d15", "#54382a");
    } else if (deco === "lava") {
      for (let i = 0; i < 7; i++) {
        const lx = R() * W;
        const ly = horizon + 6 + R() * (H - horizon) * 0.8;
        const lw = 12 + R() * 34;
        g.globalAlpha = 0.22;
        px(g, lx - lw / 2, ly, lw, 5, "#ff6b2b");
        g.globalAlpha = 0.55;
        px(g, lx - lw / 2 + 2, ly + 1, lw - 4, 2, "#ffb347");
        g.globalAlpha = 1;
      }
      drawRock(g, W * 0.2, horizon + 20, 1.4, "#1a0909", "#3d1a18");
      drawRock(g, W * 0.78, horizon + 34, 1.1, "#1a0909", "#3d1a18");
    } else if (deco === "ice") {
      for (let i = 0; i < 6; i++) drawSpike(g, R() * W, horizon + 8 + R() * (H - horizon) * 0.6, 0.6 + R() * 0.8);
      for (let i = 0; i < 4; i++) {
        g.globalAlpha = 0.1;
        px(g, R() * W, horizon + R() * (H - horizon) * 0.7, 20 + R() * 30, 2, "#d8f2ff");
        g.globalAlpha = 1;
      }
    } else if (deco === "abyss") {
      for (let i = 0; i < 4; i++) drawPillar(g, 12 + i * (W / 4.2), horizon + 2, 0.8 + R() * 0.5);
      for (let i = 0; i < 5; i++) {
        g.globalAlpha = 0.12;
        px(g, R() * W, horizon + R() * (H - horizon), 30 + R() * 50, 3, "#c39cff");
        g.globalAlpha = 1;
      }
    }

    // 안개 / 비네트
    const fog = g.createLinearGradient(0, horizon - 30, 0, horizon + 50);
    fog.addColorStop(0, "rgba(0,0,0,0)");
    fog.addColorStop(0.7, T.fog);
    fog.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fog;
    g.fillRect(0, horizon - 30, W, 80);

    // 앞쪽 잔디 실루엣 (깊이감)
    const fgC = T.ground3;
    for (let i = 0; i < 26; i++) {
      const x = R() * W;
      const h = 6 + R() * 12;
      g.fillStyle = fgC;
      g.beginPath();
      g.moveTo(x, H + 2);
      g.lineTo(x + 3, H - h);
      g.lineTo(x + 7, H + 2);
      g.closePath();
      g.fill();
    }
    px(g, 0, H - 3, W, 3, "rgba(0,0,0,0.35)");

    const vig = g.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.55, W / 2, H * 0.55, Math.max(W, H) * 0.95);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.22)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
    // 위쪽 어둡게 (HUD와 연결)
    const topShade = g.createLinearGradient(0, 0, 0, 34);
    topShade.addColorStop(0, "rgba(8,6,14,0.35)");
    topShade.addColorStop(1, "rgba(8,6,14,0)");
    g.fillStyle = topShade;
    g.fillRect(0, 0, W, 34);
  }

  function drawTuft(g, x, y, s, c) {
    g.fillStyle = c;
    g.fillRect(x, y - 3 * s, 1, 3 * s);
    g.fillRect(x + 2 * s, y - 4 * s, 1, 4 * s);
    g.fillRect(x - 2 * s, y - 2 * s, 1, 2 * s);
  }

  function drawCastle(g, x, baseY, s, c, lit) {
    // 중앙 탑
    px(g, x - 5 * s, baseY - 26 * s, 10 * s, 26 * s, c);
    px(g, x - 7 * s, baseY - 30 * s, 14 * s, 5 * s, c);
    // 좌우 탑
    px(g, x - 15 * s, baseY - 17 * s, 8 * s, 17 * s, c);
    px(g, x - 16 * s, baseY - 21 * s, 10 * s, 4 * s, c);
    px(g, x + 7 * s, baseY - 20 * s, 8 * s, 20 * s, c);
    px(g, x + 6 * s, baseY - 24 * s, 10 * s, 4 * s, c);
    // 창문 불빛
    if (lit) {
      g.fillStyle = lit;
      g.fillRect(x - 3 * s, baseY - 20 * s, 2 * s, 3 * s);
      g.fillRect(x + 1 * s, baseY - 12 * s, 2 * s, 3 * s);
      g.fillRect(x - 13 * s, baseY - 12 * s, 2 * s, 2 * s);
      g.fillRect(x + 10 * s, baseY - 14 * s, 2 * s, 2 * s);
    }
  }

  function drawTree(g, x, y, s, c1, c2) {
    const w = 3 * s;
    px(g, x - 1, y - 16 * s, 2, 16 * s, c2);
    for (let i = 0; i < 3; i++) {
      const ty = y - 6 * s - i * 7 * s;
      const tw = w + (2 - i) * 4 * s;
      g.fillStyle = c1;
      g.beginPath();
      g.moveTo(x, ty - 12 * s);
      g.lineTo(x + tw, ty);
      g.lineTo(x - tw, ty);
      g.closePath();
      g.fill();
    }
    px(g, x - w / 2, y - 3 * s, w, 3 * s, c2);
  }

  function drawGrave(g, x, y, s) {
    px(g, x - 6 * s, y - 14 * s, 12 * s, 14 * s, "#2f2a44");
    px(g, x - 6 * s, y - 14 * s, 12 * s, 2 * s, "#3d3657");
    px(g, x - 1.5 * s, y - 11 * s, 3 * s, 7 * s, "#3d3657");
    px(g, x - 4 * s, y - 9 * s, 8 * s, 2.5 * s, "#3d3657");
    px(g, x - 7 * s, y, 14 * s, 2 * s, "rgba(0,0,0,0.35)");
  }

  function drawDeadTree(g, x, y, s, c) {
    px(g, x - 2 * s, y - 34 * s, 4 * s, 34 * s, c);
    px(g, x, y - 24 * s, 12 * s, 2.5 * s, c);
    px(g, x + 9 * s, y - 32 * s, 2.5 * s, 9 * s, c);
    px(g, x, y - 16 * s, -10 * s, 2.5 * s, c);
    px(g, x - 10 * s, y - 24 * s, 2.5 * s, 9 * s, c);
  }

  function drawRock(g, x, y, s, c1, c2) {
    // 아래가 넓은 바위 형태
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(x + 2 * s, y + 2 * s, 11 * s, 3 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c1;
    g.beginPath();
    g.moveTo(x - 11 * s, y);
    g.lineTo(x - 8 * s, y - 9 * s);
    g.lineTo(x - 2 * s, y - 12 * s);
    g.lineTo(x + 5 * s, y - 11 * s);
    g.lineTo(x + 10 * s, y - 5 * s);
    g.lineTo(x + 9 * s, y);
    g.closePath();
    g.fill();
    g.fillStyle = c2;
    g.beginPath();
    g.moveTo(x - 7 * s, y - 8 * s);
    g.lineTo(x - 1 * s, y - 11 * s);
    g.lineTo(x + 4 * s, y - 10 * s);
    g.lineTo(x + 1 * s, y - 7 * s);
    g.lineTo(x - 4 * s, y - 6 * s);
    g.closePath();
    g.fill();
  }

  function drawTent(g, x, y, s) {
    g.fillStyle = "#4a2a1c";
    g.beginPath();
    g.moveTo(x, y - 20 * s);
    g.lineTo(x + 16 * s, y);
    g.lineTo(x - 16 * s, y);
    g.closePath();
    g.fill();
    px(g, x - 3 * s, y - 8 * s, 6 * s, 8 * s, "#20120c");
    px(g, x - 16 * s, y, 33 * s, 2 * s, "rgba(0,0,0,0.3)");
  }

  function drawSpike(g, x, y, s) {
    g.fillStyle = "#8fc9e8";
    g.beginPath();
    g.moveTo(x, y - 26 * s);
    g.lineTo(x + 7 * s, y);
    g.lineTo(x - 7 * s, y);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.beginPath();
    g.moveTo(x, y - 26 * s);
    g.lineTo(x + 3 * s, y - 4 * s);
    g.lineTo(x - 1 * s, y - 4 * s);
    g.closePath();
    g.fill();
  }

  function drawPillar(g, x, y, s) {
    px(g, x - 6 * s, y - 44 * s, 12 * s, 44 * s, "#1e1030");
    px(g, x - 9 * s, y - 48 * s, 18 * s, 6 * s, "#2a1745");
    px(g, x - 9 * s, y - 2 * s, 18 * s, 3 * s, "#2a1745");
    px(g, x - 6 * s, y - 40 * s, 2 * s, 34 * s, "rgba(195,156,255,0.12)");
  }

  /* --------------------------------------------------------------- utility */
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function textOut(g, txt, x, y, size, color, align, weight, strokeW) {
    g.font = (weight || 900) + " " + size + 'px "Noto Sans CJK KR","Noto Sans KR",system-ui,sans-serif';
    g.textAlign = align || "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.miterLimit = 2;
    g.strokeStyle = "#120c1c";
    g.lineWidth = strokeW || Math.max(2.5, size * 0.22);
    g.strokeText(txt, x, y);
    g.fillStyle = color;
    g.fillText(txt, x, y);
  }

  /* --------------------------------------------- 흰색 실루엣 (피격 플래시) */
  const whiteCache = new Map();
  function whiteOf(key, scale, tint) {
    const id = key + "|" + scale + "|" + (tint ? "t" : "");
    if (whiteCache.has(id)) return whiteCache.get(id);
    const src = G.sprite(key, scale, tint || null);
    if (!src) return null;
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const g2 = c.getContext("2d");
    g2.imageSmoothingEnabled = false;
    g2.drawImage(src, 0, 0);
    g2.globalCompositeOperation = "source-in";
    g2.fillStyle = "#ffffff";
    g2.fillRect(0, 0, c.width, c.height);
    whiteCache.set(id, c);
    return c;
  }
  G.whiteSprite = whiteOf;

  /* ----------------------------------------------------------------- Scene */
  class Scene {
    constructor(canvas, opts) {
      this.cv = canvas;
      this.g = canvas.getContext("2d");
      this.opts = opts || {};
      this.W = 300;
      this.H = 300;
      this.dpr = 1;
      this.theme = "plain";
      this.seed = 12345;
      this.t = 0;
      this.shake = 0;
      this.hitstop = 0;
      this.flash = 0;
      this.flashColor = "255,255,255";
      this.slowmo = 0;
      this.fx = [];
      this.amb = [];
      this.heroKey = "hero";
      this.auraColor = "255,226,120";
      this.hero = {
        x: 0,
        y: 0,
        scale: 3,
        lunge: 0,
        hurt: 0,
        bob: 0,
        atkAnim: 0,
        dead: 0,
        alpha: 1,
      };
      // 동행 펫 — 공주 옆을 따라다니며 함께 공격한다
      this.pet = { key: null, scale: 2.3, x: 0, y: 0, atk: 0, alpha: 1 };
      this.enemy = {
        key: "slime",
        name: "",
        x: 0,
        y: 0,
        scale: 3,
        hp: 1,
        maxHp: 1,
        flash: 0,
        hurt: 0,
        spawn: 1,
        dead: 0,
        alpha: 1,
        showBar: true,
        boss: false,
        elite: false,
        tint: null,
        knock: 0,
        knockDir: 1,
        shield: 0,
        shieldMax: 0,
      };
      this.bg = document.createElement("canvas");
      this.bgCtx = this.bg.getContext("2d");
      this.bgDirty = true;
      this.guard = 0;
      this.hurtFlash = 0;
      this.resize();
    }

    resize() {
      const rect = this.cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const W = Math.max(120, Math.round(rect.width));
      const H = Math.max(120, Math.round(rect.height));
      if (W === this.W && H === this.H && dpr === this.dpr) return;
      this.W = W;
      this.H = H;
      this.dpr = dpr;
      this.cv.width = Math.round(W * dpr);
      this.cv.height = Math.round(H * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.g.imageSmoothingEnabled = false;
      this.bg.width = Math.round(W * dpr);
      this.bg.height = Math.round(H * dpr);
      this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.bgDirty = true;
      this.layout();
    }

    layout() {
      const W = this.W;
      const H = this.H;
      const gy = Math.round(H * (this.opts.groundRatio || 0.8));
      const heroX = Math.round(W * (this.opts.heroX || 0.29));
      const enX = Math.round(W * (this.opts.enemyX || 0.72));
      this.hero.x = heroX;
      this.hero.y = gy;
      this.enemy.x = enX;
      this.enemy.y = gy;
      this.groundY = gy;
      this.pet.x = Math.max(20, heroX - Math.round(W * 0.115));
      this.pet.y = gy + 1;
    }

    setHero(key, auraColor) {
      this.heroKey = key || "hero";
      if (auraColor) this.auraColor = auraColor;
    }

    setPet(key, scale) {
      this.pet.key = key || null;
      if (scale) this.pet.scale = scale;
    }

    setTheme(key, seed) {
      this.theme = key;
      this.seed = seed || 1234;
      this.bgDirty = true;
      this.amb = [];
      const T = THEMES[key] || THEMES.plain;
      const n = 22;
      for (let i = 0; i < n; i++) {
        this.amb.push({
          x: Math.random() * this.W,
          y: Math.random() * this.H,
          vx: (Math.random() - 0.5) * 8,
          vy: -(4 + Math.random() * 12),
          s: 1 + Math.random() * 2,
          p: Math.random() * 6.28,
          c: T.ambColor,
        });
      }
    }

    rebuildBg() {
      this.bgCtx.save();
      this.bgCtx.clearRect(0, 0, this.W, this.H);
      drawBackground(this.bgCtx, this.W, this.H, this.theme, this.seed, this.groundY);
      this.bgCtx.restore();
      this.bgDirty = false;
    }

    /* ---- effects ---- */
    damage(x, y, amount, crit, colorOverride) {
      this.fx.push({
        type: "text",
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 10,
        vy: crit ? -46 : -30,
        life: crit ? 0.86 : 0.62,
        max: crit ? 0.86 : 0.62,
        txt: String(amount),
        color: colorOverride || (crit ? "#ffce54" : "#ffffff"),
        size: crit ? 27 : 16.5,
        crit: !!crit,
        bounce: !!crit,
      });
    }

    /* ---------------- 타격감 (Juice) ---------------- */
    // 짧은 히트스톱: 렌더 갱신을 순간 멈춰 타격을 묵직하게
    hitStop(sec) {
      this.hitstop = Math.max(this.hitstop, sec);
    }
    shakeAdd(v) {
      this.shake = Math.max(this.shake, v);
    }
    screenFlash(color, a) {
      this.flashColor = color || "255,255,255";
      this.flash = Math.max(this.flash, a == null ? 0.5 : a);
    }
    // 여러 갈래의 검기 궤적
    arcs(x1, y1, x2, y2, color, n) {
      n = n || 3;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 9;
        this.fx.push({
          type: "slash",
          x1: x1,
          y1: y1 + off * 0.7,
          x2: x2,
          y2: y2 + off,
          life: 0.22 + i * 0.045,
          max: 0.22 + i * 0.045,
          color: color || "#dff3ff",
          bend: 22 + i * 12,
          delay: i * 0.035,
        });
      }
    }
    // 치명타 별·스파크 폭발
    critBurst(x, y, color) {
      color = color || "#ffd479";
      this.burst(x, y, color, 12 + Math.floor(Math.random() * 9), 170);
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 130;
        this.fx.push({
          type: "star",
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.42 + Math.random() * 0.3,
          max: 0.72,
          color: i % 2 ? "#fff6c8" : color,
          s: 5 + Math.random() * 4,
          spin: Math.random() * 6,
        });
      }
      this.fx.push({ type: "ring", x: x, y: y, life: 0.34, max: 0.34, color: color, w: 4 });
    }
    // 불꽃 입자
    embers(x, y, n, spread) {
      n = n || 16;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
        const sp = (spread || 120) * (0.4 + Math.random());
        this.fx.push({
          type: "ember",
          x: x + (Math.random() - 0.5) * 22,
          y: y + (Math.random() - 0.5) * 12,
          vx: Math.cos(a) * sp * 0.6,
          vy: Math.sin(a) * sp,
          life: 0.36 + Math.random() * 0.42,
          max: 0.78,
          color: Math.random() < 0.45 ? "#ffd06a" : "#ff7a32",
          s: 2 + Math.random() * 2.5,
        });
      }
    }
    // 궁극기 — 직업별 연출 (holy / meteor / sakura / doom)
    ultFx(x, y, style) {
      style = style || "holy";
      if (style === "meteor") return this.ultMeteor(x, y);
      if (style === "sakura") return this.ultSakura(x, y);
      if (style === "doom") return this.ultDoom(x, y);
      this.screenFlash("255,240,190", 0.85);
      this.shakeAdd(26);
      this.hitStop(0.085);
      for (let i = 0; i < 7; i++) {
        this.fx.push({
          type: "beam",
          x: x + (i - 3) * 26,
          w: 10 + Math.random() * 22,
          life: 0.55 + Math.random() * 0.3,
          max: 0.85,
          delay: i * 0.02,
          color: i % 2 ? "#fff6c8" : "#ffe066",
        });
      }
      this.fx.push({ type: "blast", x: x, y: y, life: 0.72, max: 0.72, color: "#fff2b0" });
      this.fx.push({ type: "ring", x: x, y: y, life: 0.7, max: 0.7, color: "#ffe066", w: 6 });
      this.fx.push({ type: "ring", x: x, y: y, life: 0.95, max: 0.95, color: "#fff6c8", w: 3 });
      this.burst(x, y, "#ffd479", 26, 220);
      this.critBurst(x, y - 10, "#fff2b0");
    }
    /* ☄️ 메테오 스트라이크 : 하늘에서 운석이 쏟아진다 */
    ultMeteor(x, y) {
      this.screenFlash("255,170,110", 0.8);
      this.shakeAdd(28);
      this.hitStop(0.09);
      for (let i = 0; i < 5; i++) {
        this.fx.push({
          type: "meteor",
          x: x + (i - 2) * 34,
          y: y,
          ty: y + 34 + (i % 3) * 8,
          life: 0.62 + i * 0.06,
          max: 0.62 + i * 0.06,
          delay: i * 0.07,
          color: i % 2 ? "#ffb347" : "#ff6b2b",
        });
      }
      this.fx.push({ type: "blast", x: x, y: y, life: 0.8, max: 0.8, color: "#ffd08a" });
      this.fx.push({ type: "ring", x: x, y: y, life: 0.8, max: 0.8, color: "#ff8a3d", w: 6 });
      this.embers(x, y, 34, 210);
      this.burst(x, y, "#ffb347", 26, 230);
      this.critBurst(x, y - 6, "#ffe9a8");
    }

    /* 🌸 천본앵 · 난무 : 꽃잎이 흩날리며 난도질 */
    ultSakura(x, y) {
      this.screenFlash("255,200,230", 0.5);
      this.shakeAdd(20);
      this.hitStop(0.07);
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 130;
        this.fx.push({
          type: "petal",
          x: x + (Math.random() - 0.5) * 60,
          y: y + (Math.random() - 0.5) * 60,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
          life: 0.5 + Math.random() * 0.6,
          max: 1.1,
          color: Math.random() < 0.5 ? "#ffb3d9" : "#ff8ec4",
          spin: Math.random() * 6,
        });
      }
      for (let i = 0; i < 7; i++) {
        this.fx.push({
          type: "slash",
          x1: x - 46 + i * 14,
          y1: y - 30 + (i % 2 ? 24 : -8),
          x2: x + 46 - i * 10,
          y2: y + 18 - (i % 3) * 22,
          life: 0.3 + i * 0.05,
          max: 0.3 + i * 0.05,
          color: i % 2 ? "#ffe0f0" : "#ff8ec4",
          bend: 30,
          delay: i * 0.045,
        });
      }
      this.fx.push({ type: "blast", x: x, y: y, life: 0.66, max: 0.66, color: "#ffd0e8" });
      this.fx.push({ type: "ring", x: x, y: y, life: 0.75, max: 0.75, color: "#ff8ec4", w: 5 });
      this.burst(x, y, "#ffb3d9", 22, 190);
    }

    /* 💥 파멸의 일격 : 핏빛 충격파 */
    ultDoom(x, y) {
      this.screenFlash("255,70,60", 0.85);
      this.shakeAdd(32);
      this.hitStop(0.1);
      this.fx.push({ type: "blast", x: x, y: y, life: 0.8, max: 0.8, color: "#ff6a4a" });
      this.fx.push({ type: "ring", x: x, y: y, life: 0.55, max: 0.55, color: "#ff2a2a", w: 7 });
      this.fx.push({ type: "ring", x: x, y: y, life: 0.9, max: 0.9, color: "#ffb03a", w: 4 });
      for (let i = 0; i < 3; i++) {
        this.fx.push({
          type: "slash",
          x1: x - 40,
          y1: y - 40 + i * 18,
          x2: x + 40,
          y2: y + 24 - i * 16,
          life: 0.34,
          max: 0.34,
          color: "#ff5a4a",
          bend: 26,
          delay: i * 0.06,
        });
      }
      this.embers(x, y, 28, 190);
      this.burst(x, y, "#ff3a2a", 24, 210);
      this.critBurst(x, y - 8, "#ffb03a");
    }

    drawProj(g, f) {
      const k = 1 - f.life / f.max;
      const x = lerp(f.x, f.tx, k);
      const y = lerp(f.y, f.ty, k) - Math.sin(k * Math.PI) * 26;
      g.save();
      g.globalCompositeOperation = "lighter";
      const r = 5 + Math.sin(k * Math.PI) * 5;
      const grd = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
      grd.addColorStop(0, "rgba(255,255,255,0.95)");
      grd.addColorStop(0.35, f.color);
      grd.addColorStop(1, "rgba(255,220,140,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r * 2.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    drawMeteor(g, f) {
      if (f.delay > 0) {
        f.delay -= 0.016;
        return;
      }
      const k = 1 - f.life / f.max;
      const ease = Math.pow(k, 1.6);
      const x = lerp(f.x + 60, f.x - 10, ease);
      const y = lerp(-40, f.ty, ease);
      g.save();
      g.globalCompositeOperation = "lighter";
      const grd = g.createLinearGradient(x + 40, y - 90, x, y);
      grd.addColorStop(0, "rgba(255,180,90,0)");
      grd.addColorStop(1, f.color);
      g.strokeStyle = grd;
      g.lineWidth = 8 * (1 - k * 0.5);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x + 46, y - 96);
      g.lineTo(x, y);
      g.stroke();
      g.fillStyle = "rgba(255,240,190," + (0.85 - k * 0.3) + ")";
      g.beginPath();
      g.arc(x, y, 7 - k * 3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    text(x, y, txt, color, size, life) {
      this.fx.push({
        type: "text",
        x,
        y,
        vy: -28,
        life: life || 1.1,
        max: life || 1.1,
        txt,
        color: color || "#fff",
        size: size || 15,
      });
    }
    slash(x1, y1, x2, y2, color) {
      this.fx.push({ type: "slash", x1, y1, x2, y2, life: 0.26, max: 0.26, color: color || "#dff3ff" });
    }
    burst(x, y, color, n, spread) {
      n = n || 10;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (spread || 90) * (0.35 + Math.random());
        this.fx.push({
          type: "spark",
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 20,
          life: 0.4 + Math.random() * 0.35,
          max: 0.75,
          color: color || "#ffd479",
          s: 2 + Math.random() * 2,
        });
      }
    }
    ring(x, y, color) {
      this.fx.push({ type: "ring", x, y, life: 0.6, max: 0.6, color: color || "#ffe9a8" });
    }
    coins(n, fromX, fromY) {
      for (let i = 0; i < n; i++) {
        this.fx.push({
          type: "coin",
          x: fromX,
          y: fromY,
          tx: 18,
          ty: 12,
          delay: i * 0.07,
          life: 0.85,
          max: 0.85,
          wob: Math.random() * 6.28,
        });
      }
    }
    guardFx(on) {
      this.guard = on ? 1 : 0;
    }

    /* ---------------- 펫 추가 공격 (투사체) ---------------- */
    petStrike(tx, ty, color) {
      if (!this.pet.key) return;
      this.pet.atk = 1;
      this.fx.push({
        type: "proj",
        x: this.pet.x,
        y: this.pet.y - 30,
        tx: tx,
        ty: ty,
        life: 0.36,
        max: 0.36,
        color: color || "#ffd479",
      });
    }

    drawPet(g) {
      const p = this.pet;
      if (!p.key || p.alpha <= 0) return;
      const spr = G.sprite(p.key, Math.max(1, Math.round(p.scale)), null);
      if (!spr) return;
      const follow = Math.sin(this.t * 1.7) * 3.2;
      const jump = p.atk > 0 ? Math.sin((1 - p.atk) * Math.PI) : 0;
      const x = Math.round(p.x + follow + jump * 22);
      const y = Math.round(p.y + Math.sin(this.t * 3.3 + 1.4) * 2.2 - jump * 12);
      this.drawShadow(g, x, y - 1, spr.width * 0.62);
      g.save();
      g.globalAlpha = p.alpha * 0.28;
      const glow = g.createRadialGradient(x, y - spr.height * 0.5, 2, x, y - spr.height * 0.5, spr.width * 0.9);
      glow.addColorStop(0, "rgba(255,240,190,0.55)");
      glow.addColorStop(1, "rgba(255,240,190,0)");
      g.fillStyle = glow;
      g.fillRect(x - spr.width, y - spr.height * 1.5, spr.width * 2, spr.height * 2);
      g.globalAlpha = p.alpha;
      g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height + 2));
      g.restore();
      // 펫 반짝임
      if (Math.sin(this.t * 3.1) > 0.6) {
        g.save();
        g.globalCompositeOperation = "lighter";
        this.sparkle(g, x + spr.width * 0.34, y - spr.height * 0.8, 1.6, 0.7);
        g.restore();
      }
    }

    /* ---- update ---- */
    update(dt) {
      // 히트스톱: 이 프레임 동안 연출을 얼려 타격 순간을 강조
      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - dt);
        return;
      }
      this.t += dt;
      this.hero.bob = Math.sin(this.t * 3.4) * 1.2;
      if (this.pet.atk > 0) this.pet.atk = Math.max(0, this.pet.atk - dt * 3.2);
      if (this.hero.lunge > 0) this.hero.lunge = Math.max(0, this.hero.lunge - dt * 4.2);
      if (this.hero.hurt > 0) this.hero.hurt = Math.max(0, this.hero.hurt - dt * 3);
      if (this.enemy.flash > 0) this.enemy.flash = Math.max(0, this.enemy.flash - dt * 5);
      if (this.enemy.hurt > 0) this.enemy.hurt = Math.max(0, this.enemy.hurt - dt * 3);
      if (this.enemy.spawn > 0) this.enemy.spawn = Math.max(0, this.enemy.spawn - dt * 2.2);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
      if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.6);
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 3.4);
      if (this.enemy.knock > 0) this.enemy.knock = Math.max(0, this.enemy.knock - dt * 4.2);

      const T = THEMES[this.theme] || THEMES.plain;
      for (const p of this.amb) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.p += dt * 2;
        if (p.y < -4) {
          p.y = this.H + 4;
          p.x = Math.random() * this.W;
        }
        if (p.x < -4) p.x = this.W + 4;
        if (p.x > this.W + 4) p.x = -4;
      }

      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.life -= dt;
        if (f.type === "text") {
          f.y += f.vy * dt;
          f.vy *= 1 - dt * 1.9;
        } else if (f.type === "spark") {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vy += 240 * dt;
        } else if (f.type === "star") {
          f.x += f.vx * dt * Math.max(0, f.life / f.max);
          f.y += f.vy * dt * Math.max(0, f.life / f.max);
          f.spin += dt * 7;
        } else if (f.type === "ember") {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vy -= 40 * dt;
          f.vx *= 1 - dt * 2.4;
        } else if (f.type === "coin") {
          if (f.delay > 0) f.delay -= dt;
        } else if (f.type === "petal") {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vy += 26 * dt;
          f.spin += dt * 6;
        } else if (f.type === "meteor") {
          if (f.delay > 0) f.delay -= dt;
        }
        if (f.life <= 0) this.fx.splice(i, 1);
      }
    }

    /* ---- draw ---- */
    draw() {
      const g = this.g;
      const W = this.W;
      const H = this.H;
      if (this.bgDirty) this.rebuildBg();
      g.save();
      if (this.shake > 0.2) {
        const s = this.shake;
        g.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        if (s > 8) g.rotate(((Math.random() - 0.5) * s) / 900);
      }
      g.clearRect(-40, -40, W + 80, H + 80);
      g.drawImage(this.bg, 0, 0, W, H);

      this.drawAmbient(g);
      // 궁극기 빛기둥 — 스프라이트 뒤에서 쏟아진다
      for (const f of this.fx) {
        if (f.type === "beam") this.drawBeam(g, f);
      }
      this.drawEnemy(g);
      this.drawPet(g);
      this.drawHero(g);

      // 이펙트 (스프라이트 위)
      for (const f of this.fx) {
        if (f.type === "coin") this.drawCoin(g, f);
      }
      for (const f of this.fx) {
        if (f.type === "slash") this.drawSlash(g, f);
      }
      for (const f of this.fx) {
        if (f.type === "proj") this.drawProj(g, f);
        if (f.type === "meteor") this.drawMeteor(g, f);
        if (f.type === "petal") {
          g.save();
          g.globalAlpha = Math.max(0, f.life / f.max);
          g.translate(f.x, f.y);
          g.rotate(f.spin);
          px(g, -2, -1, 4, 2.4, f.color);
          g.restore();
        }
      }
      for (const f of this.fx) {
        if (f.type === "blast") this.drawBlast(g, f);
        if (f.type === "star") {
          g.save();
          g.globalAlpha = Math.max(0, f.life / f.max);
          g.translate(f.x, f.y);
          g.rotate(f.spin);
          g.fillStyle = f.color;
          const s = f.s;
          g.beginPath();
          g.moveTo(0, -s);
          g.lineTo(s * 0.28, -s * 0.28);
          g.lineTo(s, 0);
          g.lineTo(s * 0.28, s * 0.28);
          g.lineTo(0, s);
          g.lineTo(-s * 0.28, s * 0.28);
          g.lineTo(-s, 0);
          g.lineTo(-s * 0.28, -s * 0.28);
          g.closePath();
          g.fill();
          g.restore();
        }
        if (f.type === "ember") {
          g.globalAlpha = Math.min(1, f.life / f.max) * 0.95;
          px(g, f.x, f.y, f.s, f.s, f.color);
          g.globalAlpha = 1;
        }
        if (f.type === "spark") {
          g.globalAlpha = Math.max(0, f.life / f.max);
          px(g, f.x, f.y, f.s, f.s, f.color);
          g.globalAlpha = 1;
        }
        if (f.type === "ring") {
          const k = 1 - f.life / f.max;
          g.globalAlpha = 1 - k;
          g.strokeStyle = f.color;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(f.x, f.y, 8 + k * 46, 0, Math.PI * 2);
          g.stroke();
          g.globalAlpha = 1;
        }
        if (f.type === "text") {
          const k = 1 - f.life / f.max;
          const pop = k < 0.16 ? 0.7 + (k / 0.16) * 0.42 : 1.12 - Math.min(0.12, (k - 0.16) * 0.2);
          g.save();
          g.globalAlpha = f.life < 0.3 ? f.life / 0.3 : 1;
          g.translate(f.x, f.y);
          g.scale(pop, pop);
          textOut(g, f.txt, 0, 0, f.size, f.color, "center", 900, Math.max(3, f.size * 0.26));
          g.restore();
        }
      }
      if (this.hurtFlash > 0) {
        const hf = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
        hf.addColorStop(0, "rgba(200,20,30,0)");
        hf.addColorStop(1, "rgba(200,20,30," + (this.hurtFlash * 0.5).toFixed(3) + ")");
        g.fillStyle = hf;
        g.fillRect(0, 0, W, H);
      }
      // 타격 순간 화면 번쩍임 (치명타·궁극기)
      if (this.flash > 0.01) {
        g.fillStyle = "rgba(" + this.flashColor + "," + Math.min(0.62, this.flash).toFixed(3) + ")";
        g.fillRect(-40, -40, W + 80, H + 80);
      }
      g.restore();
    }

    drawBeam(g, f) {
      if (f.delay > 0) {
        f.delay -= 0.016;
        return;
      }
      const H = this.H;
      const k = 1 - f.life / f.max;
      const a = Math.min(1, f.life / f.max * 2);
      g.save();
      g.globalCompositeOperation = "lighter";
      const grd = g.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "rgba(255,246,200," + (a * 0.9) + ")");
      grd.addColorStop(0.7, "rgba(" + (f.color === "#ffe066" ? "255,224,102" : "255,246,200") + "," + (a * 0.55) + ")");
      grd.addColorStop(1, "rgba(255,240,180,0)");
      g.fillStyle = grd;
      const w = f.w * (1 + k * 0.5);
      g.fillRect(f.x - w / 2, 0, w, H);
      g.fillStyle = "rgba(255,255,255," + (a * 0.55) + ")";
      g.fillRect(f.x - w * 0.18, 0, w * 0.36, H);
      g.restore();
    }

    drawBlast(g, f) {
      const k = 1 - f.life / f.max;
      const r = 12 + k * 190;
      const a = 1 - k;
      g.save();
      g.globalCompositeOperation = "lighter";
      const grd = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      grd.addColorStop(0, "rgba(255,255,255," + (a * 0.85) + ")");
      grd.addColorStop(0.32, "rgba(255,240,160," + (a * 0.6) + ")");
      grd.addColorStop(0.7, "rgba(255,180,80," + (a * 0.25) + ")");
      grd.addColorStop(1, "rgba(255,140,40,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(f.x, f.y, r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    drawAmbient(g) {
      const T = THEMES[this.theme] || THEMES.plain;
      g.save();
      for (const p of this.amb) {
        if (T.amb === "snow") {
          g.globalAlpha = 0.5;
          px(g, p.x, p.y, 2, 2, "#eaf7ff");
        } else if (T.amb === "ember") {
          g.globalAlpha = 0.35 + Math.sin(p.p) * 0.25;
          px(g, p.x, p.y, 2, 2, p.c);
        } else if (T.amb === "firefly") {
          const a = 0.25 + Math.abs(Math.sin(p.p)) * 0.6;
          g.globalAlpha = a;
          px(g, p.x, p.y, 2, 2, p.c);
          g.globalAlpha = a * 0.25;
          px(g, p.x - 2, p.y - 2, 6, 6, p.c);
        } else {
          g.globalAlpha = 0.18 + Math.abs(Math.sin(p.p)) * 0.22;
          px(g, p.x, p.y, 1.5, 1.5, p.c);
        }
      }
      g.globalAlpha = 1;
      g.restore();
    }

    drawShadow(g, x, y, w) {
      g.globalAlpha = 0.28;
      g.fillStyle = "#000";
      g.beginPath();
      g.ellipse(x, y + 1, w * 0.5, Math.max(2, w * 0.14), 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    // 십자 반짝임
    sparkle(g, x, y, r, a) {
      g.globalAlpha = 0.25 + a * 0.75;
      g.fillStyle = "#fff6c8";
      const w = Math.max(1, Math.round(r));
      g.fillRect(Math.round(x) - w, Math.round(y), w * 2 + 1, 1);
      g.fillRect(Math.round(x), Math.round(y) - w, 1, w * 2 + 1);
      g.globalAlpha = 1;
    }

    drawHero(g) {
      const h = this.hero;
      if (h.alpha <= 0) return;
      const spr = G.sprite(this.heroKey, Math.round(h.scale));
      if (!spr) return;
      const lunge = Math.sin((1 - h.lunge) * Math.PI) * (h.lunge > 0 ? 26 : 0);
      const x = Math.round(h.x + lunge + (h.hurt > 0 ? -Math.sin(h.hurt * 22) * 3 : 0));
      const y = Math.round(h.y + h.bob);
      this.drawShadow(g, x, y, spr.width * 0.68);

      // 빛의 공주 오라
      const cy = y - spr.height * 0.52;
      const aura = g.createRadialGradient(x, cy, 3, x, cy, spr.width * 0.95);
      aura.addColorStop(0, "rgba(" + this.auraColor + ",0.20)");
      aura.addColorStop(0.55, "rgba(" + this.auraColor + ",0.07)");
      aura.addColorStop(1, "rgba(" + this.auraColor + ",0)");
      g.fillStyle = aura;
      g.fillRect(x - spr.width, cy - spr.height, spr.width * 2, spr.height * 2);

      g.save();
      g.globalAlpha = h.alpha;
      if (h.dead > 0) {
        g.translate(x, y);
        g.rotate(h.dead * 1.4);
        g.translate(-x, -y);
      }
      g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height + 2));
      if (h.hurt > 0) {
        const ws = whiteOf(this.heroKey, Math.round(h.scale), null);
        if (ws) {
          g.globalAlpha = Math.min(1, h.hurt) * 0.7;
          g.drawImage(ws, Math.round(x - ws.width / 2), Math.round(y - ws.height + 2));
        }
      }
      g.restore();

      // 티아라 반짝임
      if (h.alpha > 0.9) {
        const top = y - spr.height + 4;
        const tw = (Math.sin(this.t * 2.6) + 1) / 2;
        const tw2 = (Math.cos(this.t * 3.4) + 1) / 2;
        g.save();
        g.globalCompositeOperation = "lighter";
        this.sparkle(g, x - spr.width * 0.26, top + 6, 2 + tw * 1.6, tw);
        this.sparkle(g, x + spr.width * 0.28, top + 2, 1.6 + tw2 * 1.4, tw2);
        g.restore();
      }

      if (this.guard > 0) {
        g.save();
        g.globalAlpha = 0.55;
        g.strokeStyle = "#8fd8ff";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x, y - spr.height * 0.5, spr.width * 0.72, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 0.12;
        g.fillStyle = "#8fd8ff";
        g.fill();
        g.restore();
      }
    }

    drawEnemy(g) {
      const e = this.enemy;
      if (!e.key || e.alpha <= 0) return;
      const spr = G.sprite(e.key, Math.round(e.scale), e.tint || null);
      if (!spr) return;
      const bob = Math.sin(this.t * 2.2 + 1) * (e.boss ? 1.6 : 1.2);
      const sp = e.spawn > 0 ? 1 - e.spawn : 1;
      const hurtOff = e.hurt > 0 ? Math.sin(e.hurt * 26) * 4 : 0;
      // 넉백: 맞은 방향(플레이어 반대쪽)으로 밀렸다 부드럽게 복귀
      const knockOff = e.knock > 0 ? Math.sin(Math.min(1, e.knock) * Math.PI) * 26 * (e.knockDir || 1) : 0;
      const x = Math.round(e.x + hurtOff + knockOff);
      const y = Math.round(e.y + bob);
      if (e.boss) {
        const cy = y - spr.height * 0.5;
        const glow = g.createRadialGradient(x, cy, 4, x, cy, spr.width * 1.0);
        glow.addColorStop(0, "rgba(255,90,60,0.20)");
        glow.addColorStop(1, "rgba(255,90,60,0)");
        g.fillStyle = glow;
        g.fillRect(x - spr.width, cy - spr.height, spr.width * 2, spr.height * 2);
      }
      if (e.elite) {
        const cy = y - spr.height * 0.5;
        const eg = g.createRadialGradient(x, cy, 4, x, cy, spr.width * 0.95);
        eg.addColorStop(0, "rgba(255,140,60,0.24)");
        eg.addColorStop(1, "rgba(255,140,60,0)");
        g.fillStyle = eg;
        g.fillRect(x - spr.width, cy - spr.height, spr.width * 2, spr.height * 2);
      }
      g.save();
      g.globalAlpha = e.alpha * Math.min(1, sp * 1.6);
      g.translate(x, y);
      g.scale(1, 0.6 + 0.4 * sp);
      this.drawShadow(g, 0, 0, spr.width * 0.8);
      g.drawImage(spr, Math.round(-spr.width / 2), Math.round(-spr.height + 2));
      // 피격 시 순백색으로 번쩍
      if (e.flash > 0) {
        const ws = whiteOf(e.key, Math.round(e.scale), e.tint || null);
        if (ws) {
          g.globalAlpha = Math.min(1, e.flash) * 0.95;
          g.drawImage(ws, Math.round(-ws.width / 2), Math.round(-ws.height + 2));
        }
      }
      g.restore();

      // 보스 방어막
      if (e.shieldMax > 0 && e.shield > 0) {
        const cy = y - spr.height * 0.48;
        const r = spr.width * 0.78;
        g.save();
        g.globalAlpha = 0.28 + Math.sin(this.t * 5) * 0.08;
        g.fillStyle = "#7fd8ff";
        g.beginPath();
        g.arc(x, cy, r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 0.85;
        g.strokeStyle = "#bff0ff";
        g.lineWidth = 2;
        g.stroke();
        g.restore();
      }

      if (e.showBar && e.maxHp > 0) {
        const bw = e.boss ? 86 : 58;
        const bh = 6;
        const bx = Math.round(x - bw / 2);
        const by = Math.round(y - spr.height - (e.boss ? 22 : 16));
        // 이름 + 바 뒤 판넬
        g.fillStyle = "rgba(8,6,16,0.55)";
        roundRect(g, bx - 5, by - (e.name ? 15 : 3), bw + 10, bh + (e.name ? 19 : 6), 4);
        g.fill();
        g.fillStyle = "rgba(6,4,12,0.75)";
        g.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        g.fillStyle = "#2a1420";
        g.fillRect(bx, by, bw, bh);
        const ratio = Math.max(0, e.hp / e.maxHp);
        g.fillStyle = e.boss ? "#ff6a4a" : "#e0413f";
        g.fillRect(bx, by, Math.round(bw * ratio), bh);
        g.fillStyle = "rgba(255,255,255,0.28)";
        g.fillRect(bx, by, Math.round(bw * ratio), 2);
        if (e.name) {
          textOut(g, e.name, x, by - 7, 9.5, "#efe9ff", "center", 800, 2.5);
        }
      }
    }

    drawSlash(g, f) {
      if (f.delay > 0) {
        f.delay -= 0.016;
        return;
      }
      const k = 1 - f.life / f.max;
      g.save();
      g.globalAlpha = Math.min(1, f.life / f.max * 1.6);
      g.strokeStyle = f.color;
      g.lineWidth = 4.4 * (1 - k * 0.5);
      g.beginPath();
      const mx = (f.x1 + f.x2) / 2;
      const my = (f.y1 + f.y2) / 2 - (f.bend == null ? 24 : f.bend);
      const t = Math.min(1, k * 1.8);
      g.moveTo(f.x1, f.y1);
      g.quadraticCurveTo(mx, my, lerp(f.x1, f.x2, t), lerp(f.y1, f.y2, t));
      g.stroke();
      g.globalAlpha *= 0.6;
      g.strokeStyle = "#fff";
      g.lineWidth = 1.8;
      g.stroke();
      g.restore();
    }

    drawCoin(g, f) {
      if (f.delay > 0) return;
      const k = 1 - f.life / f.max;
      const ease = k * k * (3 - 2 * k);
      const x = lerp(f.x, f.tx, ease) + Math.sin(k * 9 + f.wob) * 10 * (1 - k);
      const y = lerp(f.y, f.ty, ease) - Math.sin(k * Math.PI) * 60;
      const spr = G.sprite("coin", 1);
      g.globalAlpha = Math.min(1, f.life / f.max * 2);
      if (spr) g.drawImage(spr, Math.round(x) - 6, Math.round(y) - 6);
      g.globalAlpha = 1;
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  G.Scene = Scene;
  G.THEMES = THEMES;
})();
