/* =========================================================================
 *  던전 크루세이더 — game.js
 *  데이터 · 픽셀 스프라이트 · 세이브 · 스탯 · 사냥터/던전 시뮬레이션
 * ========================================================================= */
(function () {
  "use strict";

  const G = (window.G = window.G || {});
  G.VER = 1;
  G.SAVE_KEY = "dungeonCrusader.save.v1";

  /* ---------------------------------------------------------------- utils */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function fmt(n) {
    n = Math.floor(n || 0);
    const neg = n < 0;
    if (neg) n = -n;
    let s;
    if (n < 10000) s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    else if (n < 1e8) {
      const v = n / 1e4;
      s = (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + "만";
    } else {
      const v = n / 1e8;
      s = (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + "억";
    }
    return (neg ? "-" : "") + s;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + "시간 " + m + "분";
    if (m > 0) return m + "분 " + (sec % 60) + "초";
    return sec + "초";
  }
  G.fmt = fmt;
  G.fmtTime = fmtTime;
  G.clamp = clamp;
  G.rnd = rnd;
  G.chance = chance;
  G.pick = pick;

  /* ------------------------------------------------------------------ data */
  G.STAGES = [
    { name: "초원 평원", theme: "plain", mobs: ["slime", "slime", "bat"] },
    { name: "고블린 숲", theme: "forest", mobs: ["goblin", "goblin", "wolf"] },
    { name: "해골 묘지", theme: "grave", mobs: ["skeleton", "bat", "skeleton"] },
    { name: "늑대 협곡", theme: "canyon", mobs: ["wolf", "wolf", "goblin"] },
    { name: "오크 진영", theme: "camp", mobs: ["orc", "goblin", "orc"] },
    { name: "용암 지대", theme: "lava", mobs: ["imp", "golem", "imp"] },
    { name: "얼음 동굴", theme: "ice", mobs: ["golem", "wolf", "skeleton"] },
    { name: "심연 회랑", theme: "abyss", mobs: ["demon", "imp", "golem"] },
  ];

  // hpMul: 스테이지 기준 체력 배율, atkMul: 공격 배율, interval: 공격 주기(초)
  G.MOBS = {
    slime: { name: "슬라임", sprite: "slime", hpMul: 0.95, atkMul: 0.85, interval: 1.9, scale: 3 },
    bat: { name: "동굴 박쥐", sprite: "bat", hpMul: 0.75, atkMul: 1.0, interval: 1.3, scale: 3 },
    goblin: { name: "고블린", sprite: "goblin", hpMul: 1.0, atkMul: 1.0, interval: 1.7, scale: 3 },
    wolf: { name: "검은 늑대", sprite: "wolf", hpMul: 1.05, atkMul: 1.15, interval: 1.45, scale: 3 },
    skeleton: { name: "해골 병사", sprite: "skeleton", hpMul: 1.1, atkMul: 1.05, interval: 1.8, scale: 3 },
    orc: { name: "오크 전사", sprite: "orc", hpMul: 1.35, atkMul: 1.25, interval: 2.0, scale: 3.4 },
    golem: { name: "돌 골렘", sprite: "golem", hpMul: 1.6, atkMul: 1.1, interval: 2.3, scale: 3.6 },
    imp: { name: "화염 임프", sprite: "imp", hpMul: 0.9, atkMul: 1.35, interval: 1.5, scale: 3 },
    demon: { name: "심연 마귀", sprite: "demon", hpMul: 1.5, atkMul: 1.5, interval: 1.8, scale: 3.6 },
  };

  G.FLOORS = [
    {
      floor: 1, name: "무너진 지하 성당", rec: 3, hp: 70, atk: 6, waves: 3,
      boss: { key: "goblin", name: "고블린 우두머리", hp: 240, atk: 10 },
      reward: { dc: 8, gem: 3, stone: 2, gold: 180 },
    },
    {
      floor: 2, name: "해골의 납골당", rec: 6, hp: 140, atk: 10, waves: 3,
      boss: { key: "skeleton", name: "해골 기사장", hp: 460, atk: 15 },
      reward: { dc: 14, gem: 5, stone: 3, gold: 400 },
    },
    {
      floor: 3, name: "오크의 투기장", rec: 9, hp: 250, atk: 16, waves: 3,
      boss: { key: "orc", name: "오크 대족장", hp: 820, atk: 23 },
      reward: { dc: 22, gem: 8, stone: 5, gold: 800 },
    },
    {
      floor: 4, name: "용암 심층부", rec: 14, hp: 430, atk: 24, waves: 3,
      boss: { key: "imp", name: "화염 군주", hp: 1500, atk: 33 },
      reward: { dc: 34, gem: 12, stone: 8, gold: 1500 },
    },
    {
      floor: 5, name: "심연의 옥좌", rec: 20, hp: 700, atk: 33, waves: 3,
      boss: { key: "demon", name: "심연의 마왕", hp: 2500, atk: 45 },
      reward: { dc: 55, gem: 20, stone: 12, gold: 3000 },
    },
  ];

  G.UPGRADES = [
    { id: "atk", name: "공격력", icon: "⚔️", base: 50, growth: 1.17, max: 200, eff: (l) => "+" + (l * 4 + Math.floor(l * l * 0.35)) + " 공격력" },
    { id: "hp", name: "최대 체력", icon: "❤️", base: 60, growth: 1.17, max: 200, eff: (l) => "+" + (l * 14 + Math.floor(l * l * 1.2)) + " 체력" },
    { id: "crit", name: "치명타 확률", icon: "🎯", base: 220, growth: 1.42, max: 15, eff: (l) => "+" + (l * 1.6).toFixed(1) + "% 확률" },
    { id: "critDmg", name: "치명타 피해", icon: "💢", base: 180, growth: 1.34, max: 20, eff: (l) => "+" + (l * 12) + "% 피해" },
    { id: "speed", name: "사냥 속도", icon: "⚡", base: 320, growth: 1.45, max: 10, eff: (l) => "+" + (l * 11) + "% 속도" },
    { id: "gold", name: "골드 획득", icon: "💰", base: 260, growth: 1.32, max: 20, eff: (l) => "+" + (l * 14) + "% 골드" },
  ];

  G.RARITY = [
    { name: "일반", color: "#c9c6d8", mul: 1.0 },
    { name: "고급", color: "#5ddc7c", mul: 1.38 },
    { name: "희귀", color: "#55a8ff", mul: 1.95 },
    { name: "영웅", color: "#ffb02e", mul: 2.9 },
  ];

  G.SLOTS = {
    weapon: { name: "무기", icon: "sword" },
    armor: { name: "방어구", icon: "armor" },
    acc: { name: "장신구", icon: "ring" },
  };

  G.BASES = {
    weapon: ["낡은 단검", "청동 장검", "강철 대검", "미스릴 블레이드", "용의 송곳니", "심연의 마검"],
    armor: ["가죽 조끼", "사슬 갑옷", "판금 갑주", "성기사 갑옷", "용비늘 갑주", "심연의 판금"],
    acc: ["나무 반지", "은 목걸이", "루비 반지", "고대 부적", "용의 심장", "심연의 성표"],
  };

  /* ------------------------------------------------------------- sprites */
  // 팔레트: 1글자 = 1색. '.' 은 투명
  const PAL = {
    k: "#150f1f", // 외곽선
    w: "#ffffff",
    y: "#ffe9a8",
    g: "#f5c451",
    G: "#b8862a",
    o: "#ff8a3d",
    r: "#e0413f",
    R: "#8f1f22",
    s: "#f3c9a0",
    S: "#cf9a70",
    m: "#c3d5ee",
    M: "#7f96b8",
    d: "#4f6382",
    c: "#4a7fd4",
    C: "#2f4f86",
    p: "#8b6cf2",
    P: "#553f9e",
    v: "#5ddc7c",
    V: "#2f8f4a",
    b: "#7a5230",
    B: "#43301c",
    e: "#1b1420",
    t: "#5fd7c9",
    T: "#2a8a80",
    z: "#70707f",
    Z: "#43434f",
  };

  const SPR = {
    /* ---------------- 용사 (20x20) ---------------- */
    hero: [
      ".....krrrrk.......",
      ".....krrrRRk......",
      "....kmmmmmmk..kk..",
      "....kMMMMMMk.kmMk.",
      "....kMykkyMk.kmMk.",
      "....kkkkkkkk.kmMk.",
      "....kddddddk.kmMk.",
      ".....kBBBBk..kmMk.",
      "...kkcccccckkkmMk.",
      "..kmmmcCCcmmmkmMk.",
      "..kMMMcCCcMMMkmMk.",
      "..kMMccCCccMMkmMk.",
      "..kMMggGGggMMkmMkk",
      "..kBBccCCccBBggggG",
      "..kRRCCCCCCkkkbbkk",
      "..kRRCCCCCCk.kbbk.",
      "..kRRCCCCCCk.kbbk.",
      "...kkCCCCCCk.kGGk.",
      "...kBBBBBBBBk.kk..",
      "....kkkkkkkk......",
    ],
    /* ---------------- 슬라임 (16x16) ---------------- */
    slime: [
      "................",
      "................",
      "......kkkk......",
      "....kkvvvvkk....",
      "...kvvvvvvvvk...",
      "..kvvvvvvvvvvk..",
      "..kvvvvwwvvvvk..",
      ".kvvvvwewwevvvk.",
      ".kvvvvvvvvvvvvk.",
      ".kvvvvvvvvvvvvk.",
      ".kvvvvvvvvvvvvk.",
      ".kVvvvvvvvvvvVk.",
      "..kvvvvvvvvvvk..",
      "...kkvvvvvvkk...",
      ".....kkkkkk.....",
      "................",
    ],
    /* ---------------- 고블린 (16x16) ---------------- */
    goblin: [
      "................",
      "..k..........k..",
      ".kvk..kkkk..kvk.",
      ".kvvk.kvvk.kvvk.",
      "..kvvkvvvvkvvk..",
      "..kvvvvvvvvvvk..",
      "..kvwwvvvvwwvk..",
      "..kvewvvvvwevk..",
      "..kvvvvvvvvvvk..",
      "...kvvvvvvvvk...",
      "..kbbbbbbbbbbk..",
      "..kbBBBBBBBBbk..",
      "...kvvkkkkvvk...",
      "...kvvk..kvvk...",
      "..kbbk....kbbk..",
      "..kkk......kkk..",
    ],
    /* ---------------- 오크 (16x16) ---------------- */
    orc: [
      "................",
      "..kkkkkkkkkkk...",
      ".kvvvvvvvvvvvk..",
      ".kvwwvvvvvwwvk..",
      ".kvewvvvvvwevk..",
      ".kvvvvvvvvvvvk..",
      ".kvwwrrvvrrwwvk.",
      ".kvwwwwvvwwwwvk.",
      "..kvvvvvvvvvvk..",
      ".kvvvvvvvvvvvvk.",
      ".kbvvvvvvvvvvbk.",
      ".kbbbbbbbbbbbbk.",
      "..kbbbbbbbbbbk..",
      "..kvvk....kvvk..",
      ".kvvk......kvvk.",
      ".kkk........kkk.",
    ],
    /* ---------------- 해골 (16x16) ---------------- */
    skeleton: [
      "................",
      "....kkkkkk......",
      "...kwwwwwwk.....",
      "..kwwwwwwwwk....",
      "..kwkkwwkkwk....",
      "..kwkkwwkkwk....",
      "..kwwwwwwwwk....",
      "...kwkwkwkwk....",
      "....kwwwwk......",
      "...kkwwwwkk.....",
      "..kwkwwwwkwk....",
      "..kwkwMMwkwk....",
      "...kwwwwwwk.....",
      "....kwwwwk......",
      "....kwkkwk......",
      "....kk..kk......",
    ],
    /* ---------------- 늑대 (16x16) ---------------- */
    wolf: [
      "................",
      "..kk........kk..",
      ".kzzk......kzzk.",
      ".kzzzkkkkkkzzzk.",
      ".kzzzzzzzzzzzzk.",
      ".kzzewzzzzewzzk.",
      ".kzzzzzzzzzzzzk.",
      "..kzzzzwwzzzzk..",
      "...kzzzkwwkzzk..",
      "....kkk.kkkk....",
      "...kzzzkkzzzk...",
      "...kzzk..kzzk...",
      "..kzzk....kzzk..",
      "..kkk......kkk..",
      "................",
      "................",
    ],
    /* ---------------- 박쥐 (16x16) ---------------- */
    bat: [
      "................",
      "................",
      "................",
      ".kk..........kk.",
      "kppk..kkkk..kppk",
      "kpppk.kppk.kpppk",
      "kppppkppppkppppk",
      ".kppppppppppppk.",
      "..kpppwwwwpppk..",
      "...kppeppeppppk.",
      "....kkkppkkk....",
      "......kkkk......",
      "................",
      "................",
      "................",
      "................",
    ],
    /* ---------------- 골렘 (16x16) ---------------- */
    golem: [
      "................",
      "...kkkkkkkk.....",
      "..kMMMMMMMMk....",
      "..kMeeMMeeMk....",
      "..kMMMMMMMMk....",
      "..kMMwwwwMMk....",
      "...kMMMMMMk.....",
      "..kkMMMMMMkk....",
      ".kMMkMMMMkMMk...",
      ".kMMkMMMMkMMk...",
      ".kMMkkMMkkMMk...",
      "..kk.kMMk.kk....",
      ".....kMMk.......",
      "....kMkkMk......",
      "....kdk.kdk.....",
      "....kkk.kkk.....",
    ],
    /* ---------------- 임프 (16x16) ---------------- */
    imp: [
      "................",
      "................",
      "..k..........k..",
      "..kk..kkkk..kk..",
      "..krk.krrk.krk..",
      "...krkrrrrkrk...",
      "...krrrwwrrrk...",
      "...krrowwrrrk...",
      "...krrrrrrrrk...",
      "....krrrrrrk....",
      "...koorrrrrok...",
      "..koorkrrkroook.",
      "..kk.krrrk.kk...",
      "....kRkkRk......",
      "....kRk kRk.....",
      "....kkk.kkk.....",
    ],
    /* ---------------- 마귀 보스 (16x16) ---------------- */
    demon: [
      "..k..........k..",
      ".krk..kkkk..krk.",
      ".krrk.kppk.krrk.",
      ".krrrkppppkrrrk.",
      "..krrkppppkrrk..",
      "...kkpwwwwpkk...",
      "..kppewwwweppk..",
      "..kppwwwwwwppk..",
      "..kpppwwwwpppk..",
      "...kpppkkpppk...",
      "..krrpppppprrk..",
      ".krrpppppppprrk.",
      ".kkkppppppppkkk.",
      "...kppkkkkppk...",
      "..kppk....kppk..",
      "..kkk......kkk..",
    ],
    /* ---------------- 아이콘 ---------------- */
    sword: [
      "............",
      ".....kk.....",
      "....kmmk....",
      "....kmmk....",
      "....kmmk....",
      "....kmmk....",
      "....kmmk....",
      "...kggggk...",
      "...kgkkGk...",
      "....kbbk....",
      "....kGk.....",
      "............",
    ],
    armor: [
      "............",
      "..kkkkkkkk..",
      ".kMMMMMMMMk.",
      ".kMMkMMkMMk.",
      ".kMMMMMMMMk.",
      ".kMMMMMMMMk.",
      ".kMMMMMMMMk.",
      "..kMMMMMMk..",
      "..kMMMMMMk..",
      "..kMMMMMMk..",
      "...kkkkkk...",
      "............",
    ],
    ring: [
      "............",
      "....kkkk....",
      "...kttttk...",
      "..kgkkkkgk..",
      "..kg....gk..",
      "..kg....gk..",
      "..kg....gk..",
      "...kgGGgk...",
      "....kkkk....",
      "............",
      "............",
      "............",
    ],
    coin: [
      "............",
      "....kkkk....",
      "..kkyyyykk..",
      ".kyyggyggyk.",
      ".kygggGGGgk.",
      ".kyggGGGggk.",
      ".kygggGGGgk.",
      ".kyygggggyk.",
      "..kkyyyykk..",
      "....kkkk....",
      "............",
      "............",
    ],
    gem: [
      "............",
      "....kkkk....",
      "...kttttk...",
      "..kttwwttk..",
      ".kttttttttk.",
      ".kttttttttk.",
      "..kttttttk..",
      "...kttttk...",
      "....kttk....",
      ".....kk.....",
      "............",
      "............",
    ],
    stone: [
      "............",
      "............",
      "....kkkk....",
      "...kmmmmk...",
      "..kmmddmmk..",
      "..kmddddmk..",
      "..kmddddmk..",
      "...kmmmmk...",
      "....kkkk....",
      "............",
      "............",
      "............",
    ],
    potion: [
      "............",
      "....kkkk....",
      "....kbbk....",
      "....kbbk....",
      "...kkkkkk...",
      "..krwwwwrk..",
      "..krwwwwrk..",
      "..krrwwrrk..",
      "..krrrrrrk..",
      "...kkkkkk...",
      "............",
      "............",
    ],
    chest: [
      "............",
      "............",
      "..kkkkkkkk..",
      ".kgyyyyyygk.",
      ".kgyyggyygk.",
      ".kkkkggkkkk.",
      ".kgggggggggk",
      ".kgggggggggk",
      ".kgggkkggggk",
      ".kkkkkkkkkkk",
      "............",
      "............",
    ],
  };

  // 문자열 배열 → 캔버스 (캐시)
  const spriteCache = new Map();
  function buildSprite(rows, scale, tintMap) {
    const h = rows.length;
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const c = document.createElement("canvas");
    c.width = w * scale;
    c.height = h * scale;
    const g = c.getContext("2d");
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        let col = PAL[ch];
        if (tintMap && tintMap[ch]) col = tintMap[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }
  function sprite(key, scale, tintMap) {
    const sk = 1;
    const id = key + "|" + scale + "|" + (tintMap ? JSON.stringify(tintMap) : "");
    if (spriteCache.has(id)) return spriteCache.get(id);
    const rows = SPR[key];
    if (!rows) return null;
    const c = buildSprite(rows, scale * sk, tintMap);
    spriteCache.set(id, c);
    return c;
  }
  G.sprite = sprite;
  G.SPR = SPR;

  /* ---------------------------------------------------------------- state */
  function newItem(slot, rarity, ilvl, baseName) {
    const r = G.RARITY[rarity];
    const lvlF = 1 + (ilvl - 1) * 0.135;
    const it = {
      uid: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      slot,
      rarity,
      lvl: 0,
      ilvl,
      name: baseName || pick(G.BASES[slot]),
      atk: 0,
      hp: 0,
      def: 0,
      crit: 0,
      critDmg: 0,
      aspd: 0,
    };
    const power = r.mul * lvlF;
    if (slot === "weapon") {
      it.atk = Math.round((4 + ilvl * 1.5) * power);
      if (rarity >= 2) it.crit = Math.round(rarity * 1.2 * 10) / 10;
    } else if (slot === "armor") {
      it.hp = Math.round((18 + ilvl * 9) * power);
      it.def = Math.round((1 + ilvl * 0.55) * power * 10) / 10;
    } else {
      it.crit = Math.round((1.5 + ilvl * 0.35) * r.mul * rarity) / 1;
      it.critDmg = Math.round((5 + ilvl * 1.5) * r.mul);
      it.hp = Math.round((8 + ilvl * 3) * power * 0.6);
    }
    return it;
  }

  function defaultState() {
    return {
      ver: G.VER,
      name: "서쟈",
      lv: 1,
      exp: 0,
      gold: 60,
      gems: 10,
      dc: 0,
      stones: 3,
      hp: 60,
      pots: 3,
      up: { atk: 0, hp: 0, crit: 0, critDmg: 0, speed: 0, gold: 0 },
      stage: 1,
      maxStage: 1,
      kills: 0,
      stageKills: 0,
      auto: true,
      inv: [],
      eq: { weapon: null, armor: null, acc: null },
      floors: [false, false, false, false, false],
      lastSeen: Date.now(),
      playtime: 0,
      adsSeen: 0,
      stats: { kills: 0, dungeons: 0, salvaged: 0 },
    };
  }

  let state = null;
  G.getState = () => state;

  function save() {
    if (!state) return;
    state.lastSeen = Date.now();
    try {
      localStorage.setItem(G.SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      /* 저장 공간 부족 등은 무시 */
    }
  }
  G.save = save;

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(G.SAVE_KEY);
    } catch (e) {}
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      const d = defaultState();
      const merged = Object.assign(d, s);
      merged.up = Object.assign(d.up, s.up || {});
      merged.eq = Object.assign(d.eq, s.eq || {});
      merged.stats = Object.assign(d.stats, s.stats || {});
      if (!Array.isArray(merged.floors) || merged.floors.length !== 5) merged.floors = [false, false, false, false, false];
      if (!Array.isArray(merged.inv)) merged.inv = [];
      return merged;
    } catch (e) {
      return null;
    }
  }

  /* ---------------------------------------------------------------- stats */
  function eqSum(key) {
    let v = 0;
    for (const slot of ["weapon", "armor", "acc"]) {
      const it = state.eq[slot];
      if (it && it[key]) v += it[key] * (1 + (it.lvl || 0) * 0.1);
    }
    return v;
  }
  G.eqSum = eqSum;

  function computeStats() {
    const lv = state.lv;
    const up = state.up;
    const atk = Math.round(5 + lv * 2.1 + up.atk * 4 + up.atk * up.atk * 0.35 + eqSum("atk"));
    const maxHp = Math.round(60 + lv * 14 + up.hp * 14 + up.hp * up.hp * 1.2 + eqSum("hp"));
    const crit = clamp(5 + up.crit * 1.6 + eqSum("crit"), 0, 80);
    const critDmg = 150 + up.critDmg * 12 + eqSum("critDmg");
    const aspd = 1.0 * (1 + up.speed * 0.11);
    const goldMul = 1 + up.gold * 0.14;
    const def = eqSum("def");
    const dps = atk * aspd * (1 + (crit / 100) * (critDmg / 100 - 1));
    return {
      atk,
      maxHp,
      crit,
      critDmg,
      aspd,
      goldMul,
      def,
      power: Math.round(atk * 3 + maxHp * 0.9 + crit * 6 + (critDmg - 150) * 2 + def * 12 + (aspd - 1) * 400),
      dps,
    };
  }
  G.computeStats = computeStats;

  function expNeed(lv) {
    return Math.round(16 * Math.pow(lv, 1.42));
  }
  G.expNeed = expNeed;

  function addExp(n) {
    state.exp += n;
    let ups = 0;
    while (state.exp >= expNeed(state.lv) && state.lv < 999) {
      state.exp -= expNeed(state.lv);
      state.lv++;
      ups++;
      const st = computeStats();
      state.hp = st.maxHp; // 레벨업 시 전체 회복
    }
    if (ups > 0) {
      G.onLevelUp && G.onLevelUp(ups);
      save();
    }
    return ups;
  }
  G.addExp = addExp;

  function addGold(n) {
    state.gold += Math.round(n);
  }
  G.addGold = addGold;

  /* ----------------------------------------------------------------- 던전 */
  function floorState(i) {
    return { cleared: !!state.floors[i], unlocked: i === 0 || !!state.floors[i - 1] || !!state.floors[i] };
  }
  G.floorState = floorState;

  /* -------------------------------------------------------------- 아이템 */
  function itemPower(it) {
    const m = 1 + (it.lvl || 0) * 0.1;
    return Math.round(it.atk * m * 3 + it.hp * m * 0.5 + it.def * m * 8 + it.crit * 4 + it.critDmg * 1.5);
  }
  G.itemPower = itemPower;

  function addItem(it) {
    if (state.inv.length >= 60) {
      // 가방이 가득 차면 가장 약한 장비를 자동 분해
      let worst = 0;
      for (let i = 1; i < state.inv.length; i++) if (itemPower(state.inv[i]) < itemPower(state.inv[worst])) worst = i;
      if (itemPower(state.inv[worst]) >= itemPower(it)) {
        salvageOne(it, true);
        return null;
      }
      salvageOne(state.inv[worst], true);
      state.inv.splice(worst, 1);
    }
    state.inv.push(it);
    return it;
  }
  G.addItem = addItem;

  function rollItem(ilvl, forceRarity) {
    let r = 0;
    const x = Math.random() * 100;
    if (x < 3) r = 3;
    else if (x < 14) r = 2;
    else if (x < 38) r = 1;
    else r = 0;
    if (forceRarity !== undefined) r = forceRarity;
    const slot = pick(["weapon", "armor", "acc"]);
    return newItem(slot, r, ilvl);
  }
  G.rollItem = rollItem;

  function salvageOne(it, silent) {
    const stones = 1 + it.rarity + Math.floor((it.lvl || 0) / 2);
    const gold = Math.round(12 * (it.rarity + 1) * (it.ilvl || 1) * (1 + (it.lvl || 0) * 0.15));
    state.stones += stones;
    state.gold += gold;
    state.stats.salvaged++;
    if (!silent) G.toast && G.toast("분해 완료 · 강화석 +" + stones + " · 골드 +" + fmt(gold), "gold");
    return { stones, gold };
  }
  G.salvageOne = salvageOne;

  function equipItem(it) {
    const slot = it.slot;
    const prev = state.eq[slot];
    state.eq[slot] = it;
    const idx = state.inv.indexOf(it);
    if (idx >= 0) state.inv.splice(idx, 1);
    if (prev) state.inv.push(prev);
    const st = computeStats();
    state.hp = Math.min(state.hp, st.maxHp);
    save();
    return prev;
  }
  G.equipItem = equipItem;

  function unequip(slot) {
    const it = state.eq[slot];
    if (!it) return;
    if (state.inv.length >= 60) {
      G.toast && G.toast("가방이 가득 찼습니다");
      return;
    }
    state.eq[slot] = null;
    state.inv.push(it);
    const st = computeStats();
    state.hp = Math.min(state.hp, st.maxHp);
    save();
  }
  G.unequip = unequip;

  function enhanceCost(it) {
    const lv = it.lvl || 0;
    return {
      stones: 1 + Math.floor(lv * 1.5),
      gold: Math.round(60 * Math.pow(lv + 1, 1.7) * (1 + it.rarity * 0.4)),
      max: lv >= 10,
    };
  }
  G.enhanceCost = enhanceCost;

  function enhance(it) {
    const c = enhanceCost(it);
    if (c.max) return { ok: false, msg: "최대 강화 단계입니다" };
    if (state.stones < c.stones) return { ok: false, msg: "강화석이 부족합니다 (" + c.stones + "개 필요)" };
    if (state.gold < c.gold) return { ok: false, msg: "골드가 부족합니다" };
    state.stones -= c.stones;
    state.gold -= c.gold;
    it.lvl = (it.lvl || 0) + 1;
    save();
    return { ok: true };
  }
  G.enhance = enhance;

  /* ------------------------------------------------------------------ 광고 */
  // 실제 출시 시 이 함수 안에서 AdMob / H5 광고 SDK를 호출하고,
  // 시청 완료 콜백에서 onReward() 를 부르면 됩니다.
  const Ads = {
    lastAt: 0,
    show(placement, onReward, label) {
      const now = Date.now();
      state.adsSeen = (state.adsSeen || 0) + 1;
      G.toast("광고 자리 (" + placement + ") · 테스트 보상 적용", "ad");
      const delay = now - this.lastAt < 300 ? 0 : 260;
      this.lastAt = now;
      setTimeout(() => {
        try {
          onReward && onReward();
        } catch (e) {
          console.warn(e);
        }
        save();
      }, delay);
    },
    isReady() {
      return true;
    },
  };
  G.Ads = Ads;
  window.Ads = Ads;

  G.rand = { clamp, lerp, rnd, chance, pick };

  G.newItem = newItem;
  G.defaultState = defaultState;
  G.load = load;
  G.setState = (s) => (state = s);

  /* ------------------------------------------------------------- 사냥터 로직 */
  G.fieldMobHp = function (stage, key) {
    const m = G.MOBS[key];
    const base = 20 * Math.pow(1.33, stage - 1);
    return Math.round(base * m.hpMul);
  };
  G.fieldMobAtk = function (stage, key) {
    const m = G.MOBS[key];
    return Math.max(1, Math.round((3 + stage * 1.9) * m.atkMul * 10) / 10);
  };
  G.fieldGold = function (stage) {
    return Math.round((5 + stage * 2.4) * Math.pow(1.22, stage - 1));
  };
  G.fieldExp = function (stage) {
    return Math.round((4 + stage * 1.6) * Math.pow(1.2, stage - 1));
  };
  G.KILLS_PER_STAGE = 8;
})();
