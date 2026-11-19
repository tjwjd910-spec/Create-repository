/* =========================================================================
 *  던전 크루세이더 — intro.js
 *  타이틀/로딩 화면 · 웅장한 오프닝 테마 · 4장 스토리 컷신 · 공주 닉네임
 *  (모든 그림은 Canvas, 모든 소리는 Web Audio — 외부 리소스 없음)
 * ========================================================================= */
(function () {
  "use strict";
  const G = window.G;
  const A = window.GameAudio;
  const $ = (s) => document.querySelector(s);

  const DEFAULT_NAME = "서쟈";
  const NAME_MAX = 10;
  const SUGGEST = ["서쟈", "루나", "세라", "아리아", "엘리", "미카"];

  const el = {
    boot: $("#boot"),
    bootCv: $("#bootCv"),
    fill: $("#bootFill"),
    pct: $("#bootPct"),
    tip: $("#bootTip"),
    actions: $("#bootActions"),
    start: $("#btnBootStart"),
    fresh: $("#btnBootFresh"),
    save: $("#bootSave"),
    ask: $("#bootAsk"),
    askText: $("#bootAskText"),
    askNo: $("#btnAskNo"),
    askYes: $("#btnAskYes"),

    cut: $("#cut"),
    cutCv: $("#cutCv"),
    step: $("#cutStep"),
    chap: $("#cutChap"),
    text: $("#cutText"),
    dots: $("#cutDots"),
    next: $("#btnCutNext"),
    skip: $("#btnCutSkip"),

    nick: $("#nick"),
    nickTitle: $("#nickTitle"),
    nickSub: $("#nickSub"),
    nickInput: $("#nickInput"),
    nickChips: $("#nickChips"),
    nickOk: $("#btnNickOk"),

    profile: $("#profile"),
    profileName: $("#profileName"),
    profileMeta: $("#profileMeta"),
    profileCv: $("#profileCv"),
    rename: $("#btnRename"),
    replay: $("#btnReplayStory"),
    opening: $("#btnPlayOpening"),
    profileX: $("#btnProfileX"),
  };

  /* ------------------------------------------------------------------ state */
  let mode = null; // "new" | "fresh" | "continue"
  let nameKind = null; // "first" | "change"
  let skipping = false;
  let sceneIdx = 0;
  let lineIdx = 0;
  let typing = false;
  let typeTimer = null;
  let fullText = "";
  let startPressed = false;
  let bootReady = false;
  let needName = false;
  let replaying = false;

  const currentName = () => G.playerName();

  /* =================================================================== ART */
  function lcg(seed) {
    let s = (seed | 0) || 7;
    return function () {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }
  function rgba(r, g, b, a) {
    return "rgba(" + r + "," + g + "," + b + "," + (Math.max(0, Math.min(1, a))).toFixed(3) + ")";
  }
  function sky(g, W, H, stops) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    stops.forEach(([p, c]) => gr.addColorStop(p, c));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  function stars(g, W, H, t, seed, n, alpha) {
    const r = lcg(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      const y = r() * H;
      const sp = 0.5 + r() * 1.6;
      const ph = r() * 6.28;
      const a = alpha * (0.35 + 0.65 * Math.abs(Math.sin(t * sp + ph)));
      const rad = 0.5 + r() * 1.2;
      g.fillStyle = rgba(255, 248, 226, a);
      g.beginPath();
      g.arc(x, y, rad, 0, 6.2832);
      g.fill();
    }
  }
  function moon(g, x, y, r, t, tint) {
    const glow = g.createRadialGradient(x, y, r * 0.2, x, y, r * 4);
    glow.addColorStop(0, tint ? rgba(255, 120, 150, 0.5) : rgba(206, 200, 255, 0.5));
    glow.addColorStop(0.45, tint ? rgba(255, 90, 120, 0.12) : rgba(180, 170, 255, 0.14));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, r * 4, 0, 6.2832);
    g.fill();
    g.fillStyle = tint ? "#e8788f" : "#e9e4ff";
    g.beginPath();
    g.arc(x, y, r, 0, 6.2832);
    g.fill();
    g.fillStyle = rgba(120, 110, 160, 0.25);
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.2, r * 0.28, 0, 6.2832);
    g.arc(x + r * 0.32, y + r * 0.26, r * 0.2, 0, 6.2832);
    g.fill();
  }
  function ridge(g, W, baseY, h, seed, color) {
    const r = lcg(seed);
    const n = 8;
    g.beginPath();
    g.moveTo(0, baseY + h);
    for (let i = 0; i <= n; i++) {
      const x = (W / n) * i + (r() - 0.5) * (W / n) * 0.6;
      const y = baseY - (0.25 + r() * 0.75) * h;
      g.lineTo(x, y);
    }
    g.lineTo(W, baseY + h);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }
  function castle(g, cx, baseY, w, h, opt) {
    opt = opt || {};
    const col = opt.color || "#0b0716";
    const lit = opt.lit == null ? 0.8 : opt.lit;
    const t = opt.t || 0;
    const winCol = opt.win || [255, 205, 120];
    g.fillStyle = col;
    // 성벽
    g.fillRect(cx - w * 0.44, baseY - h * 0.24, w * 0.88, h * 0.24);
    // 본성
    g.fillRect(cx - w * 0.2, baseY - h * 0.56, w * 0.4, h * 0.56);
    for (let i = 0; i < 5; i++) g.fillRect(cx - w * 0.2 + i * w * 0.088, baseY - h * 0.6, w * 0.05, h * 0.045);
    // 탑 4개
    const towers = [
      [-0.4, 0.16, 0.7],
      [-0.14, 0.12, 0.86],
      [0.14, 0.12, 0.86],
      [0.4, 0.16, 0.7],
    ];
    towers.forEach(([f, tw, th], ti) => {
      const x = cx + w * f;
      const ww = w * tw;
      const hh = h * th;
      g.fillStyle = col;
      g.fillRect(x - ww / 2, baseY - hh, ww, hh);
      g.beginPath();
      g.moveTo(x - ww * 0.68, baseY - hh);
      g.lineTo(x, baseY - hh - ww * 0.95);
      g.lineTo(x + ww * 0.68, baseY - hh);
      g.closePath();
      g.fill();
      // 깃발
      const fl = Math.sin(t * 2.2 + ti) * 1.5;
      g.strokeStyle = rgba(120, 110, 150, 0.7);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, baseY - hh - ww * 0.95);
      g.lineTo(x, baseY - hh - ww * 1.5);
      g.stroke();
      g.fillStyle = rgba(200, 170, 90, 0.55);
      g.beginPath();
      g.moveTo(x, baseY - hh - ww * 1.5);
      g.lineTo(x + 7 + fl, baseY - hh - ww * 1.36);
      g.lineTo(x, baseY - hh - ww * 1.22);
      g.closePath();
      g.fill();
      // 창문
      for (let k = 0; k < 3; k++) {
        const wy = baseY - hh * 0.78 + k * hh * 0.22;
        const on = Math.sin(ti * 2.3 + k * 1.9) * 0.5 + 0.5;
        const bright = on < 1 - lit;
        g.fillStyle = bright ? rgba(20, 14, 30, 0.9) : rgba(winCol[0], winCol[1], winCol[2], 0.45 + on * 0.45);
        g.fillRect(x - 1.2, wy, 2.4, 3);
      }
    });
    // 본성 창문
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 2; k++) {
        const on = Math.sin(i * 3.1 + k * 2.2 + t * 0.6) * 0.5 + 0.5;
        g.fillStyle = on < 1 - lit ? rgba(20, 14, 30, 0.9) : rgba(winCol[0], winCol[1], winCol[2], 0.4 + on * 0.5);
        g.fillRect(cx - w * 0.14 + i * w * 0.09, baseY - h * 0.46 + k * h * 0.14, 2.6, 3.4);
      }
    }
    // 성문
    g.fillStyle = rgba(8, 5, 14, 0.95);
    g.beginPath();
    g.moveTo(cx - w * 0.05, baseY);
    g.lineTo(cx - w * 0.05, baseY - h * 0.1);
    g.quadraticCurveTo(cx, baseY - h * 0.16, cx + w * 0.05, baseY - h * 0.1);
    g.lineTo(cx + w * 0.05, baseY);
    g.closePath();
    g.fill();
  }
  function abyssTower(g, cx, baseY, w, h, t, opt) {
    opt = opt || {};
    // 뒤쪽 보랏빛 아우라
    const aura = g.createRadialGradient(cx, baseY - h * 0.7, w * 0.2, cx, baseY - h * 0.6, h * 0.8);
    aura.addColorStop(0, rgba(126, 70, 230, 0.28));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = aura;
    g.fillRect(cx - h, baseY - h * 1.4, h * 2, h * 1.6);

    const seg = 9;
    for (let i = 0; i < seg; i++) {
      const p = i / seg;
      const ww = w * (1 - p * 0.55);
      const yTop = baseY - h * ((i + 1) / seg);
      const hh = h / seg + 1.4;
      g.fillStyle = opt.color || "#07030d";
      g.fillRect(cx - ww / 2, yTop, ww, hh);
      if (i % 2 === 0) {
        g.fillStyle = rgba(150, 90, 255, 0.16 + 0.1 * Math.sin(t * 1.7 + i));
        g.fillRect(cx - ww / 2, yTop, ww, 1.6);
      }
      if (i > 1) {
        for (let k = -1; k <= 1; k += 2) {
          const on = Math.sin(t * 1.9 + i * 2.1 + k) * 0.5 + 0.5;
          g.fillStyle = rgba(255, 70, 110, 0.25 + on * 0.55);
          g.fillRect(cx + k * ww * 0.18 - 1, yTop + hh * 0.5, 2.2, 3.2);
        }
      }
    }
    // 뾰족한 왕관
    g.fillStyle = opt.color || "#07030d";
    for (let i = -2; i <= 2; i++) {
      const half = w * 0.06;
      const top = h * (0.1 + 0.14 * (1 - Math.abs(i) / 3));
      g.beginPath();
      g.moveTo(cx + i * w * 0.1 - half, baseY - h);
      g.lineTo(cx + i * w * 0.1, baseY - h - top);
      g.lineTo(cx + i * w * 0.1 + half, baseY - h);
      g.closePath();
      g.fill();
    }
  }
  function rift(g, cx, topY, len, wid, t) {
    const r = lcg(101);
    const pts = [];
    let x = cx;
    for (let i = 0; i <= 8; i++) {
      const y = topY + (len * i) / 8;
      pts.push([x, y]);
      x = cx + Math.sin(i * 1.7 + t * 0.9) * wid * 0.9 + (r() - 0.5) * wid * 1.6;
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    g.shadowColor = rgba(140, 70, 255, 0.9);
    g.shadowBlur = 24;
    g.strokeStyle = rgba(126, 88, 255, 0.5 + 0.25 * Math.sin(t * 2));
    g.lineWidth = Math.max(2, wid * 0.6);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
    g.shadowBlur = 10;
    g.strokeStyle = rgba(238, 226, 255, 0.9);
    g.lineWidth = Math.max(1.2, wid * 0.16);
    g.stroke();
    g.restore();
  }
  function embers(g, W, H, t, n, seed, col, up) {
    const r = lcg(seed);
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const sp = 12 + r() * 26;
      const ph = r();
      const xb = r() * W;
      const y = up === false ? (ph * H + t * sp) % (H * 1.1) : H - ((ph * H + t * sp) % (H * 1.1));
      const x = xb + Math.sin(t * 0.7 + i) * 9;
      const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.6 + i * 1.3));
      const rad = 0.8 + r() * 1.6;
      g.fillStyle = col + a.toFixed(3) + ")";
      g.beginPath();
      g.arc(x, y, rad, 0, 6.2832);
      g.fill();
    }
    g.restore();
  }
  function rays(g, W, H, t, cx, n, col, alpha) {
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const a = -1.15 + (i / Math.max(1, n - 1)) * 2.3 + Math.sin(t * 0.5 + i) * 0.05;
      const len = Math.max(W, H) * 1.4;
      g.save();
      g.translate(cx, -H * 0.1);
      g.rotate(a);
      const gr = g.createLinearGradient(0, 0, 0, len);
      gr.addColorStop(0, rgba(col[0], col[1], col[2], alpha * (0.6 + 0.4 * Math.sin(t * 1.1 + i * 2))));
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-10, 0);
      g.lineTo(-46, len);
      g.lineTo(46, len);
      g.lineTo(10, 0);
      g.closePath();
      g.fill();
      g.restore();
    }
    g.restore();
  }
  /* 공주 실루엣 캐시 (금빛 림라이트용) */
  const silCache = {};
  function heroSil(scale, color, alpha) {
    const a = alpha == null ? 1 : alpha;
    const key = scale + "|" + color + "|" + a;
    if (silCache[key]) return silCache[key];
    const spr = G.sprite("hero", scale);
    if (!spr) return null;
    const c = document.createElement("canvas");
    c.width = spr.width;
    c.height = spr.height;
    const x = c.getContext("2d");
    x.drawImage(spr, 0, 0);
    x.globalCompositeOperation = a >= 1 ? "source-in" : "source-atop";
    x.globalAlpha = a >= 1 ? 1 : a;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    silCache[key] = c;
    return c;
  }
  function drawHero(g, x, baseY, scale, t, opt) {
    opt = opt || {};
    const bob = Math.sin(t * 2.2) * 1.4;
    const spr = opt.silhouette
      ? heroSil(scale, opt.color || "#08040f", opt.alpha == null ? 1 : opt.alpha)
      : G.sprite("hero", scale);
    if (!spr) return;
    const w = spr.width;
    const h = spr.height;
    // 바닥 그림자
    g.save();
    g.globalAlpha = 0.5;
    g.fillStyle = "#050309";
    g.beginPath();
    g.ellipse(x, baseY - 1, w * 0.36, Math.max(2, w * 0.09), 0, 0, 6.2832);
    g.fill();
    g.restore();
    if (opt.glow) {
      const gr = g.createRadialGradient(x, baseY - h * 0.5, 4, x, baseY - h * 0.5, h * 0.95);
      gr.addColorStop(0, rgba(255, 214, 130, 0.42));
      gr.addColorStop(0.5, rgba(245, 170, 90, 0.16));
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, baseY - h * 0.5, h * 0.95, 0, 6.2832);
      g.fill();
    }
    g.save();
    if (opt.silhouette) {
      g.shadowColor = rgba(255, 196, 96, opt.rim == null ? 0.85 : opt.rim);
      g.shadowBlur = 14;
    }
    g.drawImage(spr, Math.round(x - w / 2), Math.round(baseY - h + bob));
    g.restore();
    if (opt.sparkle !== false) {
      for (let i = 0; i < 5; i++) {
        const a = t * 1.4 + i * 1.7;
        const sx = x + Math.sin(a) * w * 0.5;
        const sy = baseY - h * 0.55 + Math.cos(a * 0.8) * h * 0.42;
        const al = 0.25 + 0.6 * Math.abs(Math.sin(t * 2.4 + i));
        g.fillStyle = rgba(255, 236, 170, al);
        g.fillRect(sx, sy, 2, 2);
      }
    }
  }
  function figure(g, x, baseY, s, color, t, spear) {
    const bob = Math.sin(t * 1.5 + x * 0.03) * s * 0.028;
    g.save();
    g.fillStyle = color;
    // 다리 (걷는 동작)
    const step = Math.sin(t * 2.2 + x * 0.06) * s * 0.06;
    g.fillRect(x - s * 0.13 + step, baseY - s * 0.34, s * 0.085, s * 0.34);
    g.fillRect(x + s * 0.045 - step, baseY - s * 0.34, s * 0.085, s * 0.34);
    // 망토
    g.beginPath();
    g.moveTo(x - s * 0.12, baseY - s * 0.36 + bob);
    g.lineTo(x - s * 0.2, baseY - s * 0.8 + bob);
    g.lineTo(x + s * 0.2, baseY - s * 0.8 + bob);
    g.lineTo(x + s * 0.12, baseY - s * 0.36 + bob);
    g.closePath();
    g.fill();
    // 어깨
    g.fillRect(x - s * 0.23, baseY - s * 0.84 + bob, s * 0.46, s * 0.09);
    // 투구
    g.beginPath();
    g.arc(x, baseY - s * 0.92 + bob, s * 0.145, 0, 6.2832);
    g.fill();
    g.fillRect(x - s * 0.15, baseY - s * 0.97 + bob, s * 0.3, s * 0.05);
    if (spear) {
      g.strokeStyle = color;
      g.lineWidth = Math.max(1.2, s * 0.05);
      g.beginPath();
      g.moveTo(x + s * 0.3, baseY + s * 0.05);
      g.lineTo(x + s * 0.2, baseY - s * 1.35);
      g.stroke();
      g.beginPath();
      g.moveTo(x + s * 0.2, baseY - s * 1.48);
      g.lineTo(x + s * 0.16, baseY - s * 1.3);
      g.lineTo(x + s * 0.24, baseY - s * 1.3);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
  function chain(g, x1, y1, x2, y2, t) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const n = Math.max(3, Math.round(len / 11));
    g.save();
    g.strokeStyle = rgba(150, 140, 175, 0.3);
    g.lineWidth = 1.1;
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const x = x1 + dx * p + Math.sin(t * 1.6 + i * 0.6) * 2.4 * (1 - p * 0.3);
      const y = y1 + dy * p;
      g.beginPath();
      g.ellipse(x, y, 2.1, 3.6, Math.atan2(dy, dx) + Math.PI / 2, 0, 6.2832);
      g.stroke();
    }
    g.restore();
  }
  function vignette(g, W, H, a) {
    const gr = g.createRadialGradient(W * 0.5, H * 0.45, W * 0.2, W * 0.5, H * 0.5, W * 0.95);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, rgba(0, 0, 0, a));
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  /* ============================================================ 타이틀 화면 */
  function drawBoot(g, W, H, t) {
    g.clearRect(0, 0, W, H);
    sky(g, W, H, [
      [0, "#05030f"],
      [0.3, "#150d2b"],
      [0.56, "#291745"],
      [0.68, "#3b1e4c"],
      [0.72, "#24123a"],
    ]);
    stars(g, W, H * 0.55, t, 11, 90, 0.85);
    moon(g, W * 0.18, H * 0.17, Math.min(W, H) * 0.05, t);

    // 균열 → 심연의 탑
    const tx = W * 0.755;
    rift(g, tx, H * 0.02, H * 0.2, W * 0.026, t);
    ridge(g, W, H * 0.63, H * 0.1, 3, "#150d28");
    castle(g, W * 0.24, H * 0.63, W * 0.58, H * 0.2, { t, lit: 0.88, color: "#0c0718" });
    ridge(g, W, H * 0.665, H * 0.07, 8, "#0e0819");
    abyssTower(g, tx, H * 0.665, W * 0.17, H * 0.42, t);

    // 지면
    // 균열에서 내려오는 빛기둥
    g.save();
    g.globalCompositeOperation = "lighter";
    const beam = g.createLinearGradient(tx, H * 0.1, tx, H * 0.72);
    beam.addColorStop(0, rgba(150, 100, 255, 0.16));
    beam.addColorStop(1, "rgba(120,70,220,0)");
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(tx - W * 0.03, H * 0.08);
    g.lineTo(tx + W * 0.03, H * 0.08);
    g.lineTo(tx + W * 0.14, H * 0.74);
    g.lineTo(tx - W * 0.14, H * 0.74);
    g.closePath();
    g.fill();
    g.restore();

    ridge(g, W, H * 0.715, H * 0.05, 5, "#0b0616");
    const gnd = g.createLinearGradient(0, H * 0.71, 0, H);
    gnd.addColorStop(0, "#0c0718");
    gnd.addColorStop(0.45, "#080510");
    gnd.addColorStop(1, "#040207");
    g.fillStyle = gnd;
    g.fillRect(0, H * 0.715, W, H * 0.285);

    // 지면 디테일 — 풀숲 · 바위 · 폐허 기둥
    const rr = lcg(88);
    g.fillStyle = "#0b0616";
    for (let i = 0; i < 16; i++) {
      const x = rr() * W;
      const hh = 2 + rr() * 5;
      g.fillRect(x, H * 0.715 - hh, 1.6, hh);
    }
    g.fillStyle = "#0a0514";
    g.fillRect(W * 0.04, H * 0.7, W * 0.05, H * 0.02);
    g.fillRect(W * 0.6, H * 0.702, W * 0.07, H * 0.016);
    // 공주 발치의 금빛 웅덩이
    const pg2 = g.createRadialGradient(W * 0.29, H * 0.716, 2, W * 0.29, H * 0.716, W * 0.24);
    pg2.addColorStop(0, rgba(255, 206, 130, 0.22));
    pg2.addColorStop(1, "rgba(255,180,90,0)");
    g.fillStyle = pg2;
    g.fillRect(W * 0.05, H * 0.66, W * 0.5, H * 0.09);
    // 지면 위 금빛 잔광
    const gl = g.createLinearGradient(0, H * 0.7, 0, H * 0.79);
    gl.addColorStop(0, rgba(150, 110, 220, 0.16));
    gl.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gl;
    g.fillRect(0, H * 0.7, W, H * 0.09);

    drawHero(g, W * 0.29, H * 0.715, Math.max(3, Math.round(Math.min(W, H) / 100)), t, { glow: true });

    // 지면 안개
    const fog = g.createLinearGradient(0, H * 0.74, 0, H * 0.9);
    fog.addColorStop(0, "rgba(0,0,0,0)");
    fog.addColorStop(0.45, rgba(70, 40, 110, 0.22));
    fog.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = fog;
    g.fillRect(0, H * 0.72, W, H * 0.2);
    // 바닥의 마법 균열
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const cx3 = W * (0.52 + i * 0.14);
      const cy3 = H * (0.755 + i * 0.03);
      const al = 0.16 + 0.12 * Math.sin(t * 1.4 + i);
      g.strokeStyle = rgba(150, 100, 255, al);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(cx3, cy3);
      g.lineTo(cx3 + 9 - i * 3, cy3 + 7);
      g.lineTo(cx3 + 3, cy3 + 12);
      g.lineTo(cx3 + 12, cy3 + 19);
      g.stroke();
    }
    g.restore();
    embers(g, W, H * 0.9, t, 22, 5, "rgba(255,206,130,", true);
    // 탑에서 흘러내리는 보랏빛 연기
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const y = H * 0.16 + ((t * 14 + i * 70) % (H * 0.5));
      const al = 0.05 + 0.05 * Math.sin(t + i);
      g.fillStyle = rgba(140, 80, 230, al);
      g.beginPath();
      g.ellipse(tx + Math.sin(t * 0.4 + i) * 16, y, W * 0.09, H * 0.03, 0, 0, 6.2832);
      g.fill();
    }
    g.restore();
    vignette(g, W, H, 0.45);
  }

  /* ============================================================ 컷신 그림 */
  const ART = {
    /* 1장 — 평화로운 빛의 왕국, 그리고 하늘의 균열 */
    peace(g, W, H, t) {
      const p = Math.min(1, t / 7);
      sky(g, W, H, [
        [0, "#20143f"],
        [0.34, "#5c2a5e"],
        [0.52, "#b0556e"],
        [0.6, "#ff9d63"],
        [0.82, "#2a1330"],
        [1, "#150a1c"],
      ]);
      stars(g, W, H * 0.28, t, 21, 40, 0.5);
      // 노을 태양
      const sunY = H * 0.52;
      const sg = g.createRadialGradient(W * 0.62, sunY, 4, W * 0.62, sunY, W * 0.55);
      sg.addColorStop(0, rgba(255, 216, 150, 0.55));
      sg.addColorStop(0.4, rgba(255, 150, 90, 0.18));
      sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = rgba(255, 231, 180, 0.85);
      g.beginPath();
      g.arc(W * 0.62, sunY, W * 0.055, 0, 6.2832);
      g.fill();

      ridge(g, W, H * 0.55, H * 0.075, 4, "#4a2a52");
      castle(g, W * 0.34, H * 0.56, W * 0.62, H * 0.22, { t, lit: 1, color: "#2a1330" });
      ridge(g, W, H * 0.585, H * 0.03, 12, "#231128");
      // 왕국 마을 불빛
      for (let i = 0; i < 26; i++) {
        const r = lcg(300 + i)();
        const x = r * W;
        const y = H * 0.59 + r * H * 0.03;
        const a = 0.35 + 0.4 * Math.abs(Math.sin(t * 1.6 + i));
        g.fillStyle = rgba(255, 200, 120, a);
        g.fillRect(x, y, 1.6, 1.6);
      }
      ridge(g, W, H * 0.62, H * 0.12, 6, "#150a1c");
      // 앞마당 마을 지붕 · 나무
      const vr = lcg(410);
      g.fillStyle = "#120817";
      for (let i = 0; i < 7; i++) {
        const x = vr() * W;
        const bw = W * (0.05 + vr() * 0.05);
        const by = H * 0.635 + vr() * H * 0.02;
        g.fillRect(x, by - H * 0.014, bw, H * 0.018);
        g.beginPath();
        g.moveTo(x - 2, by - H * 0.014);
        g.lineTo(x + bw / 2, by - H * 0.04);
        g.lineTo(x + bw + 2, by - H * 0.014);
        g.closePath();
        g.fill();
        if (vr() > 0.5) {
          g.fillStyle = rgba(255, 200, 130, 0.4 + 0.3 * Math.sin(t * 1.4 + i));
          g.fillRect(x + bw * 0.4, by - H * 0.006, 2, 2);
          g.fillStyle = "#120817";
        }
      }
      // 소나무
      for (let i = 0; i < 5; i++) {
        const x = W * (0.02 + i * 0.24) + vr() * 12;
        const ty = H * 0.65;
        g.fillStyle = "#0e0614";
        g.beginPath();
        g.moveTo(x - 9, ty);
        g.lineTo(x, ty - H * 0.075);
        g.lineTo(x + 9, ty);
        g.closePath();
        g.fill();
        g.fillRect(x - 1, ty, 2, 5);
      }

      // 균열이 서서히 벌어지고, 탑이 솟아오른다
      if (p > 0.25) {
        const q = Math.min(1, (p - 0.25) / 0.35);
        g.save();
        g.globalAlpha = q;
        rift(g, W * 0.8, H * 0.055, H * 0.13 * q, W * 0.024 * q + 2, t);
        g.restore();
        if (p > 0.55) {
          const tp = Math.min(1, (p - 0.55) / 0.4);
          g.save();
          g.beginPath();
          g.rect(0, 0, W, H * 0.56);
          g.clip();
          abyssTower(g, W * 0.8, H * 0.58, W * 0.14, H * 0.5 * tp, t);
          g.restore();
          // 탑에서 번지는 어둠
          const dg = g.createRadialGradient(W * 0.8, H * 0.42, 6, W * 0.8, H * 0.42, W * 0.9);
          dg.addColorStop(0, rgba(60, 20, 90, 0.3 * tp));
          dg.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = dg;
          g.fillRect(0, 0, W, H);
        }
      }
      embers(g, W, H * 0.62, t, 14, 31, "rgba(255,190,120,", true);
      vignette(g, W, H, 0.42);
    },

    /* 2장 — 꺼져가는 왕국, 끌려가는 수호 기사단 */
    fall(g, W, H, t) {
      sky(g, W, H, [
        [0, "#0a0416"],
        [0.3, "#1b0a28"],
        [0.44, "#390f2e"],
        [0.52, "#52132f"],
        [0.66, "#180a18"],
        [1, "#0a0410"],
      ]);
      stars(g, W, H * 0.3, t, 44, 34, 0.3);
      moon(g, W * 0.2, H * 0.16, W * 0.03, t, true);

      // 탑이 하늘을 찢고 서 있다
      abyssTower(g, W * 0.74, H * 0.6, W * 0.17, H * 0.46, t);
      // 탑에서 내려온 사슬 — 땅에 닿아 있다
      chain(g, W * 0.66, H * 0.42, W * 0.5, H * 0.6, t);
      chain(g, W * 0.7, H * 0.38, W * 0.16, H * 0.6, t);
      chain(g, W * 0.81, H * 0.44, W * 0.94, H * 0.6, t);

      ridge(g, W, H * 0.5, H * 0.05, 9, "#1a0c22");
      castle(g, W * 0.22, H * 0.575, W * 0.46, H * 0.16, { t, lit: 0.14, color: "#100818", win: [255, 116, 96] });

      // 지면
      ridge(g, W, H * 0.6, H * 0.1, 15, "#0c0512");
      g.fillStyle = "#08040e";
      g.fillRect(0, H * 0.62, W, H * 0.2);

      // 끌려가는 기사들 — 오른쪽 탑을 향해
      const baseY = H * 0.615;
      for (let i = 0; i < 5; i++) {
        const x = W * (0.16 + i * 0.085);
        const s = H * 0.078;
        figure(g, x, baseY, s, rgba(5, 3, 9, 0.97), t + i * 0.9, false);
      }
      // 뒤따르는 호위병의 창
      for (let i = 0; i < 2; i++) {
        figure(g, W * (0.1 + i * 0.12), baseY + H * 0.004, H * 0.088, "rgba(3,2,7,1)", t + i * 1.4, true);
      }
      // 바닥 안개
      const fg = g.createLinearGradient(0, H * 0.59, 0, H * 0.68);
      fg.addColorStop(0, "rgba(0,0,0,0)");
      fg.addColorStop(0.45, rgba(80, 34, 100, 0.32));
      fg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = fg;
      g.fillRect(0, H * 0.57, W, H * 0.14);
      embers(g, W, H * 0.7, t, 26, 77, "rgba(255,90,90,", true);
      vignette(g, W, H, 0.5);
    },

    /* 3장 — 왕관과 성검을 든 공주 */
    crown(g, W, H, t) {
      sky(g, W, H, [
        [0, "#0a0616"],
        [0.45, "#1b1130"],
        [0.62, "#2a1740"],
        [1, "#0b0614"],
      ]);
      // 성당 아치 창
      const arch = (cx, w, h, alpha) => {
        g.save();
        g.beginPath();
        g.moveTo(cx - w / 2, H * 0.64);
        g.lineTo(cx - w / 2, H * 0.3);
        g.quadraticCurveTo(cx, H * 0.3 - w * 0.9, cx + w / 2, H * 0.3);
        g.lineTo(cx + w / 2, H * 0.64);
        g.closePath();
        const gr = g.createLinearGradient(0, H * 0.2, 0, H * 0.64);
        gr.addColorStop(0, rgba(150, 120, 255, alpha));
        gr.addColorStop(0.6, rgba(80, 60, 150, alpha * 0.5));
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fill();
        g.strokeStyle = rgba(90, 70, 140, 0.5);
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      };
      arch(W * 0.22, W * 0.16, H * 0.4, 0.5);
      arch(W * 0.5, W * 0.2, H * 0.44, 0.75);
      arch(W * 0.78, W * 0.16, H * 0.4, 0.5);
      rays(g, W, H, t, W * 0.5, 5, [255, 226, 160], 0.1);

      // 바닥
      g.fillStyle = "#0a0614";
      g.fillRect(0, H * 0.63, W, H * 0.37);
      const fl = g.createLinearGradient(0, H * 0.63, 0, H * 0.75);
      fl.addColorStop(0, rgba(180, 150, 255, 0.16));
      fl.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = fl;
      g.fillRect(0, H * 0.63, W, H * 0.12);

      // 공주 — 왕관과 성검
      const hx = W * 0.5;
      const hy = H * 0.66;
      const hScale = Math.max(4, Math.round(Math.min(W, H) / 78));
      // 바닥 반사
      g.save();
      g.globalAlpha = 0.16;
      g.translate(0, hy * 2 + 4);
      g.scale(1, -1);
      drawHero(g, hx, hy, hScale, t, { sparkle: false });
      g.restore();
      drawHero(g, hx, hy, hScale, t, { glow: true, sparkle: false });
      // 떠 있는 왕관
      const cy = hy - H * 0.2 + Math.sin(t * 1.4) * 4;
      g.save();
      g.shadowColor = rgba(255, 220, 140, 0.9);
      g.shadowBlur = 18;
      g.fillStyle = "#f5c451";
      g.beginPath();
      g.moveTo(hx - 15, cy);
      g.lineTo(hx - 15, cy - 9);
      g.lineTo(hx - 7, cy - 3);
      g.lineTo(hx, cy - 13);
      g.lineTo(hx + 7, cy - 3);
      g.lineTo(hx + 15, cy - 9);
      g.lineTo(hx + 15, cy);
      g.closePath();
      g.fill();
      g.restore();
      g.fillStyle = "#ffe9a8";
      g.fillRect(hx - 12, cy - 1.5, 24, 1.6);
      // 왕관 반짝임
      for (let i = 0; i < 10; i++) {
        const a = t * 1.1 + i * 0.9;
        const rr = 20 + (i % 3) * 10;
        const sx = hx + Math.cos(a) * rr;
        const sy = cy - 4 + Math.sin(a) * rr * 0.6;
        const al = 0.3 + 0.7 * Math.abs(Math.sin(t * 2.6 + i));
        g.fillStyle = rgba(255, 240, 190, al);
        g.fillRect(sx, sy, 2, 2);
      }
      // 좌우 촛불
      [-1, 1].forEach((sgn, i) => {
        const cx2 = hx + sgn * W * 0.33;
        const cy2 = hy - H * 0.02;
        const fl = 0.6 + 0.4 * Math.sin(t * 6 + i * 2);
        const cg = g.createRadialGradient(cx2, cy2, 1, cx2, cy2, W * 0.11);
        cg.addColorStop(0, rgba(255, 200, 120, 0.34 * fl));
        cg.addColorStop(1, "rgba(255,170,90,0)");
        g.fillStyle = cg;
        g.fillRect(cx2 - W * 0.12, cy2 - W * 0.12, W * 0.24, W * 0.24);
        g.fillStyle = "#20142c";
        g.fillRect(cx2 - 2.5, cy2, 5, H * 0.035);
        g.fillStyle = rgba(255, 226, 160, 0.95);
        g.fillRect(cx2 - 1.2, cy2 - 5 - fl * 2, 2.4, 6 + fl * 2);
      });
      embers(g, W, H * 0.7, t, 12, 55, "rgba(255,225,170,", true);
      vignette(g, W, H, 0.45);
    },

    /* 4장 — 새벽, 당신의 이야기가 시작된다 */
    dawn(g, W, H, t) {
      sky(g, W, H, [
        [0, "#150d2e"],
        [0.26, "#3a1d4e"],
        [0.42, "#8a3a5e"],
        [0.52, "#e8825c"],
        [0.58, "#ffcf94"],
        [0.63, "#2a1630"],
        [1, "#120a1c"],
      ]);
      stars(g, W, H * 0.26, t, 66, 26, 0.35);
      // 떠오르는 태양
      const sy = H * 0.55;
      const sg = g.createRadialGradient(W * 0.58, sy, 4, W * 0.58, sy, W * 0.8);
      sg.addColorStop(0, rgba(255, 244, 210, 0.75));
      sg.addColorStop(0.26, rgba(255, 176, 110, 0.3));
      sg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = rgba(255, 240, 200, 0.95);
      g.beginPath();
      g.arc(W * 0.58, sy, W * 0.055, 0, 6.2832);
      g.fill();
      rays(g, W, H, t, W * 0.58, 5, [255, 210, 150], 0.075);

      // 먼 왕국과 심연의 탑
      ridge(g, W, H * 0.572, H * 0.045, 13, "#4a2b48");
      castle(g, W * 0.17, H * 0.578, W * 0.32, H * 0.095, { t, lit: 0.45, color: "#3a2340" });
      abyssTower(g, W * 0.87, H * 0.578, W * 0.075, H * 0.19, t, { color: "#2b1830" });
      rift(g, W * 0.87, H * 0.31, H * 0.06, W * 0.011, t);
      ridge(g, W, H * 0.6, H * 0.03, 21, "#241430");

      // 절벽 위의 공주 — 밝은 지평선을 등지고 선 실루엣
      ridge(g, W, H * 0.642, H * 0.028, 33, "#150c20");
      g.fillStyle = "#150c20";
      g.fillRect(0, H * 0.652, W, H * 0.35);
      // 앞쪽 바위 그늘
      ridge(g, W, H * 0.705, H * 0.03, 47, "#0a0512");
      g.fillStyle = "#0a0512";
      g.fillRect(0, H * 0.712, W, H * 0.29);
      const px = W * 0.28;
      const py = H * 0.652;
      // 발밑 바위 — 지평선 빛을 받은 테두리
      g.fillStyle = "#0b0614";
      g.beginPath();
      g.ellipse(px, py + 2, W * 0.135, H * 0.016, 0, 0, 6.2832);
      g.fill();
      g.strokeStyle = rgba(255, 190, 130, 0.22);
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(px, py + 2, W * 0.135, H * 0.016, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      drawHero(g, px, py, Math.max(3, Math.round(Math.min(W, H) / 100)), t, {
        silhouette: true,
        color: "#0a0616",
        alpha: 0.62,
        rim: 0.95,
      });
      // 검 끝의 작은 빛
      g.save();
      g.globalCompositeOperation = "lighter";
      const gl = g.createRadialGradient(px + W * 0.09, py - H * 0.12, 1, px + W * 0.09, py - H * 0.12, W * 0.13);
      gl.addColorStop(0, rgba(255, 236, 180, 0.55));
      gl.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = gl;
      g.fillRect(px - W * 0.06, py - H * 0.28, W * 0.34, H * 0.3);
      g.restore();
      embers(g, W, H * 0.8, t, 18, 91, "rgba(255,220,150,", true);
      vignette(g, W, H, 0.38);
    },
  };

  /* ============================================================== 스토리 */
  const SCENES = [
    {
      chap: "1장 · 빛의 왕국",
      art: "peace",
      lines: [
        "평화롭던 빛의 왕국. 금빛 성벽 위로 노을이 번지고, 광장마다 웃음이 가득했습니다.",
        "그러던 어느 날 — 하늘 한가운데에 심연의 균열이 갈라졌습니다.",
      ],
    },
    {
      chap: "2장 · 스무 개의 계단",
      art: "fall",
      lines: [
        "균열에서 솟아오른 검은 탑. 스무 층 높이에서 마왕의 눈이 떴습니다.",
        "수호 기사단은 탑으로 끌려가고, 왕국의 빛은 한 점씩 꺼져갑니다.",
      ],
    },
    {
      chap: "3장 · 왕관과 성검",
      art: "crown",
      lines: [
        "왕좌는 비었습니다. 남은 것은 한 사람 — 마지막 공주.",
        "왕관을 들고 성검 앞에 선 그녀는 울지 않겠다고, 도망치지 않겠다고 맹세했습니다.",
      ],
    },
    {
      chap: "4장 · 당신의 이야기",
      art: "dawn",
      lines: ["{name} 공주님. 빛의 왕관이 그대의 이름을 새겼습니다.", "이제 당신의 이야기가 시작됩니다."],
    },
  ];

  /* --------------------------------------------------------- canvas helpers */
  const cv = { boot: { el: el.bootCv, W: 390, H: 844, dpr: 1 }, cut: { el: el.cutCv, W: 390, H: 844, dpr: 1 } };
  function fitCanvas(c) {
    const node = c.el;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const W = Math.round(rect.width) || 390;
    const H = Math.round(rect.height) || 844;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.W = W;
    c.H = H;
    c.dpr = dpr;
    if (node.width !== Math.round(W * dpr) || node.height !== Math.round(H * dpr)) {
      node.width = Math.round(W * dpr);
      node.height = Math.round(H * dpr);
    }
  }
  function begin(c) {
    const g = c.el.getContext("2d");
    g.setTransform(c.dpr, 0, 0, c.dpr, 0, 0);
    return g;
  }

  /* ------------------------------------------------------------- boot loop */
  let bootRaf = 0;
  let bootT0 = 0;
  let bootPct = 0;
  const TIPS = [
    [0, "빛의 왕국을 불러오는 중…"],
    [0.24, "심연의 탑을 세우는 중…"],
    [0.48, "공주의 성검을 벼리는 중…"],
    [0.7, "오프닝 테마를 조율하는 중…"],
    [0.9, "성문을 여는 중…"],
    [1, "준비 완료"],
  ];
  function bootFrame(ts) {
    if (!bootT0) bootT0 = ts;
    const t = (ts - bootT0) / 1000;
    fitCanvas(cv.boot);
    drawBoot(begin(cv.boot), cv.boot.W, cv.boot.H, t);

    if (!bootReady) {
      const raw = Math.min(1, Math.max(0, (t - 0.15) / 2.35));
      bootPct = Math.pow(raw, 0.9);
      el.fill.style.width = (bootPct * 100).toFixed(1) + "%";
      el.pct.textContent = Math.round(bootPct * 100) + "%";
      let tip = TIPS[0][1];
      for (const [th, tx] of TIPS) if (bootPct >= th) tip = tx;
      if (el.tip.textContent !== tip) el.tip.textContent = tip;
      if (bootPct >= 1) revealStart();
    }
    bootRaf = requestAnimationFrame(bootFrame);
  }

  function saveInfoHTML() {
    const st = G.getState();
    if (!G.hadSave || !st) return "";
    const cleared = (st.floors || []).filter(Boolean).length;
    return (
      "공주 <b>" +
      G.playerName() +
      "</b> · Lv." +
      st.lv +
      " · 스테이지 " +
      (st.maxStage || 1) +
      " · 던전 " +
      cleared +
      "/20"
    );
  }

  function revealStart() {
    bootReady = true;
    el.fill.style.width = "100%";
    el.pct.textContent = "100%";
    el.tip.textContent = "준비 완료";
    if (G.hadSave) {
      el.start.textContent = "▶ 이어하기";
      el.fresh.hidden = false;
      el.fresh.classList.add("in");
      el.save.innerHTML = saveInfoHTML();
      el.save.hidden = false;
    } else {
      el.start.textContent = "✨ 모험 시작하기";
      el.fresh.hidden = true;
    }
    el.start.hidden = false;
    el.start.classList.add("in");
    el.actions.classList.add("in");
  }

  /* -------------------------------------------------------------- cut loop */
  let cutRaf = 0;
  let cutT0 = 0;
  let sceneT0 = 0;
  function cutFrame(ts) {
    if (!cutT0) cutT0 = ts;
    const st = (ts - sceneT0) / 1000;
    fitCanvas(cv.cut);
    const sc = SCENES[sceneIdx] || SCENES[0];
    const painter = ART[sc.art] || ART.peace;
    painter(begin(cv.cut), cv.cut.W, cv.cut.H, st);
    cutRaf = requestAnimationFrame(cutFrame);
  }
  function startCutLoop() {
    if (cutRaf) return;
    cutT0 = 0;
    sceneT0 = performance.now();
    cutRaf = requestAnimationFrame(cutFrame);
  }
  function stopCutLoop() {
    if (cutRaf) cancelAnimationFrame(cutRaf);
    cutRaf = 0;
  }

  /* ------------------------------------------------------------- typewriter */
  function typeLine(text, instant) {
    clearInterval(typeTimer);
    typeTimer = null;
    fullText = text;
    typing = false;
    el.text.textContent = "";
    if (instant || !text) {
      el.text.textContent = text;
      return;
    }
    const chars = Array.from(text);
    let i = 0;
    typing = true;
    el.text.classList.add("typing");
    typeTimer = setInterval(() => {
      i++;
      el.text.textContent = chars.slice(0, i).join("");
      if (i >= chars.length) {
        clearInterval(typeTimer);
        typeTimer = null;
        typing = false;
        el.text.classList.remove("typing");
      }
    }, 30);
  }
  function finishTyping() {
    clearInterval(typeTimer);
    typeTimer = null;
    typing = false;
    el.text.classList.remove("typing");
    el.text.textContent = fullText;
  }

  /* ---------------------------------------------------------------- story UI */
  function paintDots() {
    if (!el.dots) return;
    el.dots.innerHTML = "";
    SCENES.forEach((s, i) => {
      const d = document.createElement("i");
      if (i < sceneIdx) d.className = "done";
      else if (i === sceneIdx) d.className = "on";
      el.dots.appendChild(d);
    });
  }

  function showScene(i, instant) {
    sceneIdx = Math.max(0, Math.min(SCENES.length - 1, i));
    lineIdx = 0;
    const sc = SCENES[sceneIdx];
    sceneT0 = performance.now();
    el.chap.textContent = sc.chap;
    el.step.textContent = sceneIdx + 1 + " / " + SCENES.length;
    el.next.textContent = sceneIdx === SCENES.length - 1 ? "모험 시작 ▶" : "다음 ▶";
    paintDots();
    el.cut.classList.remove("scene-in");
    void el.cut.offsetWidth;
    el.cut.classList.add("scene-in");
    typeLine(sc.lines[0].replace("{name}", currentName()), instant);
    if (A && A.sfx) A.sfx("page");
  }

  function nextLine() {
    const sc = SCENES[sceneIdx];
    if (typing) {
      finishTyping();
      return;
    }
    if (lineIdx < sc.lines.length - 1) {
      lineIdx++;
      typeLine(sc.lines[lineIdx].replace("{name}", currentName()));
      return;
    }
    // 장면 끝
    if (sceneIdx === SCENES.length - 2 && nameKind !== "change" && needName) {
      openName("first");
      return;
    }
    if (sceneIdx === SCENES.length - 1) {
      endStory();
      return;
    }
    showScene(sceneIdx + 1);
  }

  function openStory(opt) {
    opt = opt || {};
    replaying = !!opt.replay;
    needName = !!opt.needName;
    skipping = false;
    bootReady = true;
    sceneIdx = 0;
    lineIdx = 0;
    G.titleActive = true;
    el.cut.classList.add("on");
    startCutLoop();
    showScene(0);
  }

  function endStory() {
    clearInterval(typeTimer);
    typeTimer = null;
    el.cut.classList.remove("on");
    stopCutLoop();
    if (replaying) {
      replaying = false;
      G.titleActive = false;
      if (G.toast) G.toast("스토리를 다시 봤어요 · 여기서부터 이어집니다", "gold");
      return;
    }
    enterGame();
  }

  function skipStory() {
    if (needName) {
      skipping = true;
      openName("first");
      return;
    }
    endStory();
  }

  function enterGame() {
    el.cut.classList.remove("on");
    stopCutLoop();
    G.titleActive = false;
    G.enterGame(mode || "new");
  }

  /* ------------------------------------------------------------- nickname UI */
  function buildChips() {
    el.nickChips.innerHTML = "";
    SUGGEST.forEach((n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nick-chip" + (el.nickInput.value.trim() === n ? " on" : "");
      b.textContent = n;
      b.onclick = () => {
        el.nickInput.value = n;
        Array.from(el.nickChips.children).forEach((c) => c.classList.remove("on"));
        b.classList.add("on");
        if (A && A.sfx) A.sfx("click");
      };
      el.nickChips.appendChild(b);
    });
  }

  function openName(kind) {
    nameKind = kind;
    if (kind === "first") {
      el.nickTitle.textContent = "공주님의 이름을 정해주세요";
      el.nickSub.innerHTML = "빛의 왕관이 그대의 이름을 새기려 합니다.<br />1~10자 · 비워두면 <b>서쟈</b>로 시작합니다.";
      el.nickOk.textContent = "👑 이 이름으로 출발!";
      el.nickInput.value = "";
    } else {
      el.nickTitle.textContent = "닉네임 변경";
      el.nickSub.innerHTML = "새 이름을 입력해 주세요.<br />1~10자 · 비워두면 <b>서쟈</b>로 바뀝니다.";
      el.nickOk.textContent = "👑 이 이름으로 변경";
      el.nickInput.value = G.playerName();
    }
    buildChips();
    el.nick.classList.add("on");
    setTimeout(() => {
      try {
        el.nickInput.focus();
        el.nickInput.setSelectionRange(el.nickInput.value.length, el.nickInput.value.length);
      } catch (e) {}
    }, 160);
  }

  function confirmName() {
    const nm = G.setPlayerName(el.nickInput.value);
    el.nick.classList.remove("on");
    if (A && A.sfx) A.sfx("crown");
    if (nameKind === "first") {
      nameKind = null;
      needName = false;
      if (skipping) {
        skipping = false;
        endStory();
        return;
      }
      showScene(SCENES.length - 1);
      return;
    }
    nameKind = null;
    if (el.profile.classList.contains("on")) {
      updateProfile();
      G.toast("공주님의 이름이 " + nm + "(으)로 바뀌었습니다", "gold");
    }
  }

  /* -------------------------------------------------------------- profile UI */
  function updateProfile() {
    const st = G.getState();
    if (!st) return;
    el.profileName.textContent = "공주 " + G.playerName();
    const cleared = (st.floors || []).filter(Boolean).length;
    el.profileMeta.textContent = "Lv." + st.lv + " · 최고 스테이지 " + (st.maxStage || 1) + " · 던전 " + cleared + "/20";
    const cvp = el.profileCv;
    if (cvp) {
      const g = cvp.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, cvp.width, cvp.height);
      const spr = G.sprite("hero", 5);
      if (spr) {
        const sh = Math.round(spr.height * 0.63);
        const sw = Math.round(spr.width * 0.84);
        const sx = Math.round((spr.width - sw) / 2);
        g.drawImage(spr, sx, 0, sw, sh, 0, 0, cvp.width, cvp.height);
      }
    }
  }
  function openProfile() {
    updateProfile();
    el.profile.classList.add("on");
  }
  function closeProfile() {
    el.profile.classList.remove("on");
  }

  /* ------------------------------------------------------------------ start */
  function pressStart() {
    if (startPressed || !bootReady) return;
    startPressed = true;
    // 첫 제스처 → AudioContext unlock + 팡파레 + 웅장한 오프닝 테마
    const st = G.getState();
    const soundOn = !st || st.sound !== false;
    if (A) {
      if (soundOn && A.startOpening) A.startOpening();
      else if (A.wake) A.wake();
      if (soundOn && A.sfx) A.sfx("fanfare");
    }
    el.boot.classList.add("out");
    if (bootRaf) cancelAnimationFrame(bootRaf);
    bootRaf = 0;
    setTimeout(() => {
      el.boot.classList.remove("on", "out");
    }, 680);

    if (mode === "continue") {
      setTimeout(() => {
        G.titleActive = false;
        G.enterGame("continue");
      }, 520);
    } else {
      setTimeout(() => openStory({ needName: true }), 430);
    }
  }

  function askFresh() {
    const st = G.getState();
    el.askText.innerHTML =
      "지금까지의 모험 기록이 사라집니다.<br /><b>공주 " +
      G.playerName() +
      " · Lv." +
      (st ? st.lv : 1) +
      " · 스테이지 " +
      (st ? st.maxStage : 1) +
      "</b><br />처음부터 새 모험을 시작할까요?";
    el.ask.hidden = false;
    el.ask.classList.add("on");
  }
  function closeAsk() {
    el.ask.classList.remove("on");
    el.ask.hidden = true;
  }

  function bind() {
    el.start.addEventListener("click", pressStart);
    el.fresh.addEventListener("click", askFresh);
    el.askNo.addEventListener("click", closeAsk);
    el.askYes.addEventListener("click", () => {
      closeAsk();
      mode = "fresh";
      G.resetProgress();
      el.start.textContent = "✨ 모험 시작하기";
      el.save.hidden = true;
      el.fresh.hidden = true;
      pressStart();
    });

    el.next.addEventListener("click", nextLine);
    el.skip.addEventListener("click", (e) => {
      e.stopPropagation();
      skipStory();
    });
    // 장면 탭으로도 진행
    el.cut.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      nextLine();
    });

    el.nickOk.addEventListener("click", confirmName);
    el.nickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmName();
      }
    });
    el.nickInput.addEventListener("input", () => {
      Array.from(el.nickChips.children).forEach((c) =>
        c.classList.toggle("on", c.textContent === el.nickInput.value.trim())
      );
    });

    const hudName = $("#hudNameBox");
    const hudAv = $("#hudAvatar");
    [hudName, hudAv].forEach((n) => {
      if (!n) return;
      n.addEventListener("click", openProfile);
      n.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProfile();
        }
      });
    });
    el.profileX.addEventListener("click", closeProfile);
    el.profile.addEventListener("click", (e) => {
      if (e.target === el.profile) closeProfile();
    });
    el.rename.addEventListener("click", () => {
      closeProfile();
      openName("change");
    });
    el.replay.addEventListener("click", () => {
      closeProfile();
      openStory({ needName: false, replay: true });
    });
    el.opening.addEventListener("click", () => {
      closeProfile();
      location.reload();
    });

    window.addEventListener("resize", () => {
      if (el.boot.classList.contains("on")) {
        fitCanvas(cv.boot);
        drawBoot(begin(cv.boot), cv.boot.W, cv.boot.H, 0);
      }
      if (el.cut.classList.contains("on")) {
        fitCanvas(cv.cut);
        const sc = SCENES[sceneIdx] || SCENES[0];
        (ART[sc.art] || ART.peace)(begin(cv.cut), cv.cut.W, cv.cut.H, 0);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (el.profile.classList.contains("on")) closeProfile();
        if (el.nick.classList.contains("on") && nameKind === "change") el.nick.classList.remove("on");
      }
      if ((e.key === "Enter" || e.key === " ") && el.cut.classList.contains("on") && !el.nick.classList.contains("on")) {
        const ae = document.activeElement;
        if (ae && (ae.tagName === "INPUT" || ae.tagName === "BUTTON" || ae.tagName === "TEXTAREA")) return;
        e.preventDefault();
        if (bootReady) nextLine();
      }
    });
  }

  /* ------------------------------------------------------------------- boot */
  function start() {
    if (!G || !el.boot) return;
    mode = G.hadSave ? "continue" : "new";
    bind();
    fitCanvas(cv.boot);
    if (A && A.setEnabled) A.setEnabled(G.getState() ? G.getState().sound !== false : true, true);
    bootRaf = requestAnimationFrame(bootFrame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  /* 개발용 훅 */
  G.Intro = {
    get booted() {
      return bootReady;
    },
    get startPressed() {
      return startPressed;
    },
    openStory: (o) => openStory(o || {}),
    openName: (k) => openName(k || "first"),
    openProfile,
    pressStart,
    scenes: SCENES,
  };
})();
