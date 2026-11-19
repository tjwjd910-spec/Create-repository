/* =========================================================================
 *  던전 크루세이더 — game.js
 *  데이터 · 픽셀 스프라이트 · 세이브 · 스탯 · 사냥터/던전 시뮬레이션
 * ========================================================================= */
(function () {
  "use strict";

  const G = (window.G = window.G || {});
  G.VER = 3;
  G.SAVE_KEY = "dungeonCrusader.save.v1";
  G.FLOOR_COUNT = 20;

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
    mimic: { name: "미믹 보물상자", sprite: "chest", hpMul: 0.8, atkMul: 1.1, interval: 1.9, scale: 3.6 },
  };

  /* ------------------------------------------------------------- 던전 20층
   * 4층마다 테마(배경·몬스터 색·보스)가 바뀌고, 고층일수록 웨이브가 늘어난다.
   * boss.pattern = 보스가 순서대로 쓰는 기술 (attack/heavy/combo/shield/buff)
   */
  const FLOOR_PLAN = [
    {
      chapter: "고블린 소굴", tag: "goblin", color: "#7bd88f",
      mobs: ["slime", "goblin", "bat", "wolf"],
      floors: [
        ["무너진 지하 성당", "plain", "goblin", "고블린 우두머리"],
        ["버려진 수로", "forest", "goblin", "고블린 주술사"],
        ["고블린 야영지", "forest", "orc", "고블린 대장"],
        ["초원의 왕좌", "plain", "goblin", "고블린 왕"],
      ],
    },
    {
      chapter: "해골 지하묘지", tag: "grave", color: "#b9a7ff",
      mobs: ["skeleton", "bat", "wolf"],
      floors: [
        ["해골의 납골당", "grave", "skeleton", "해골 기사장"],
        ["잊힌 무덤길", "grave", "skeleton", "망자 사제"],
        ["달빛 성소", "grave", "skeleton", "달의 망령"],
        ["뼈의 왕좌", "grave", "skeleton", "해골 대왕"],
      ],
    },
    {
      chapter: "용암 화염 동굴", tag: "lava", color: "#ff8a4a",
      mobs: ["imp", "golem", "demon"],
      floors: [
        ["용암 협곡", "lava", "imp", "화염 군주"],
        ["재의 회랑", "lava", "imp", "불꽃 마귀"],
        ["심장부 용광로", "lava", "golem", "용암 골렘"],
        ["불의 제단", "lava", "demon", "화염 마신"],
      ],
    },
    {
      chapter: "얼음 수정 성채", tag: "ice", color: "#8fd8ff",
      mobs: ["golem", "wolf", "skeleton"],
      floors: [
        ["얼어붙은 성문", "ice", "golem", "서리 수호자"],
        ["수정 회랑", "ice", "skeleton", "빙결 기사"],
        ["한기의 성소", "ice", "skeleton", "얼음 여왕"],
        ["영원한 빙궁", "ice", "golem", "빙결 군주"],
      ],
    },
    {
      chapter: "심연의 마왕성", tag: "abyss", color: "#c39cff",
      mobs: ["demon", "imp", "golem"],
      floors: [
        ["심연의 문", "abyss", "demon", "심연 파수꾼"],
        ["어둠의 계단", "abyss", "demon", "그림자 군주"],
        ["마왕의 회랑", "abyss", "demon", "타락한 성기사"],
        ["심연의 옥좌", "abyss", "demon", "심연의 마왕"],
      ],
    },
  ];

  const BOSS_PATTERNS = [
    [["attack", "heavy", "attack", "heavy"], ["attack", "heavy", "attack", "heavy"], ["attack", "heavy", "attack", "heavy"], ["attack", "shield", "heavy", "attack", "heavy"]],
    [["attack", "shield", "heavy", "attack", "heavy", "shield"], ["attack", "shield", "heavy", "attack", "heavy", "shield"], ["attack", "shield", "heavy", "attack", "heavy", "shield"], ["shield", "heavy", "attack", "shield", "heavy", "attack"]],
    [["heavy", "attack", "combo", "heavy", "attack"], ["heavy", "attack", "combo", "heavy", "attack"], ["heavy", "combo", "attack", "heavy", "combo"], ["combo", "heavy", "attack", "combo", "heavy"]],
    [["shield", "heavy", "combo", "attack", "shield", "combo"], ["shield", "heavy", "combo", "attack", "shield", "combo"], ["combo", "shield", "heavy", "combo", "attack"], ["shield", "combo", "heavy", "shield", "combo", "heavy"]],
    [["heavy", "combo", "shield", "buff", "combo", "heavy"], ["heavy", "combo", "shield", "buff", "combo", "heavy"], ["combo", "heavy", "shield", "combo", "buff", "heavy"], ["combo", "shield", "buff", "combo", "heavy", "combo"]],
  ];

  function buildFloors() {
    const out = [];
    FLOOR_PLAN.forEach((ch, ci) => {
      ch.floors.forEach((row, i) => {
        const floor = out.length + 1;
        const waves = 4 + (floor >= 6 ? 1 : 0) + (floor >= 12 ? 1 : 0);
        const hp = Math.round(70 * Math.pow(1.3, floor - 1));
        const atk = Math.round(6 * Math.pow(1.17, floor - 1));
        const bossHp = Math.round(hp * (3.4 + ci * 0.22));
        const bossAtk = Math.round(atk * 1.45);
        out.push({
          floor,
          chapter: ch.chapter,
          chapterIdx: ci,
          tag: ch.tag,
          color: ch.color,
          theme: row[1],
          name: row[0],
          mobs: ch.mobs,
          rec: Math.round(3 + (floor - 1) * 2.2),
          hp,
          atk,
          waves,
          boss: {
            key: row[2],
            name: row[3],
            hp: bossHp,
            atk: bossAtk,
            shield: Math.round(bossHp * (0.16 + ci * 0.015)),
            combo: ci >= 3 ? 3 : 2,
            pattern: BOSS_PATTERNS[ci][i],
          },
          reward: {
            dc: Math.round(8 * Math.pow(1.16, floor - 1)),
            gem: Math.round(3 * Math.pow(1.14, floor - 1)),
            stone: Math.round(2 * Math.pow(1.13, floor - 1)),
            gold: Math.round(180 * Math.pow(1.28, floor - 1)),
          },
        });
      });
    });
    return out;
  }

  G.FLOORS = buildFloors();
  G.chapter = function (i) {
    return G.FLOORS[clamp(i, 0, G.FLOORS.length - 1)].chapterIdx;
  };

  // 챕터별 몬스터 색 변조 (용암=붉게, 얼음=푸르게, 심연=보랏빛)
  const CHAPTER_TINT = [
    null,
    { v: "#b9a7e8", V: "#6a539e", b: "#5a4a7a", B: "#2f2544", M: "#a99ac8", m: "#d6ccef" },
    { v: "#ff7a4a", V: "#a8311c", b: "#7a2d1c", B: "#3d140c", M: "#8a4a3a", m: "#c47a5a", z: "#7a4030", Z: "#4a2018" },
    { v: "#7fd4ff", V: "#2f7aa8", b: "#4a6b8a", B: "#2a3f55", M: "#9fc8e0", m: "#cfe9f8", z: "#8fb4c8", Z: "#5a7a8f" },
    { v: "#b07cff", V: "#5a2f9e", b: "#4a2f6a", B: "#26163d", M: "#8f7ac0", m: "#c0b0e8", z: "#6a5a8a", Z: "#3d3355", r: "#ff4a7a", R: "#8f1f3a" },
  ];
  G.chapterTint = function (ci) {
    return CHAPTER_TINT[clamp(ci, 0, 4)] || null;
  };
  G.GOLD_TINT = { v: "#ffd166", V: "#a8761b", w: "#fff8dc", e: "#3a2a00", b: "#9a6b1e", B: "#5a3d0c" };
  G.ELITE_TINT = { v: "#ff9a6a", V: "#b03a20", b: "#8a3a22", B: "#4a1a10" };

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
    { name: "전설", color: "#ff5ce0", mul: 4.1 },
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
    h: "#ffe066", // 공주 금발
    H: "#ddab31", // 금발 그림자
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
    /* -------- 빛의 공주 (금발 장발 · 티아라 · 로열 드레스 · 빛나는 검, 22x27) -------- */
    hero: [
      "",
      "..........kk",
      "........kkyyk.k",
      ".......kgkttkkgk...k",
      "......kytyggyytk..kyk",
      "....kkkggggggggkkkkwk",
      "...khhhGGGGGGGGhhhkmk",
      "...khhhhhhhhhhhhhhkwk",
      "...khhhhhhhhhhhhhhkmk",
      "...khhhhsssssshhhhkwk",
      "...khhHshsssshsHhhkmk",
      "...kyhsswesswesshykwk",
      "...khHsseesseessHhkmk",
      "...khHsSssssssSsHhkwk",
      "...khHssssrrssssHhkmk",
      "...kyHkSSSSSSSSkHykwk",
      "...khHkkksssskkkssyggk",
      "...kPpCCCCCCCCCCsSbkk",
      "...kPpccccggccccpPbk",
      "...kPpcycgppgcycpPgk",
      "...kPpccccPPccccpPk",
      "...kPpggggyyggggpPk",
      "...kPpCcppccppcCpPk",
      "....kcCcppccppcCck",
      "....kcccccccccccck",
      "....kggggggggggggk",
      ".....kkkkBBkBBkkk",
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
    const nameIdx = Math.min(5, rarity + (ilvl >= 6 ? 1 : 0));
    const it = {
      uid: "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      slot,
      rarity,
      lvl: 0,
      ilvl,
      name: baseName || G.BASES[slot][nameIdx] || pick(G.BASES[slot]),
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
      autoBattle: true,
      sound: true,
      inv: [],
      eq: { weapon: null, armor: null, acc: null },
      floors: new Array(G.FLOOR_COUNT).fill(false),
      quest: { idx: 0, prog: 0, done: false },
      ult: 0,
      haptics: true,
      lastSeen: Date.now(),
      playtime: 0,
      adsSeen: 0,
      stats: { kills: 0, dungeons: 0, salvaged: 0, crits: 0, combos: 0, bestCombo: 0, quests: 0, goldGoblins: 0, mimics: 0, ults: 0 },
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
      // --- 구버전(ver1/ver2: 5층) 세이브 마이그레이션 ---
      if (!Array.isArray(merged.floors)) merged.floors = [];
      if (merged.floors.length !== G.FLOOR_COUNT) {
        const nf = new Array(G.FLOOR_COUNT).fill(false);
        for (let i = 0; i < Math.min(merged.floors.length, G.FLOOR_COUNT); i++) nf[i] = !!merged.floors[i];
        merged.floors = nf;
      }
      if (!merged.quest || typeof merged.quest.idx !== "number") merged.quest = d.quest;
      if (typeof merged.ult !== "number" || !isFinite(merged.ult)) merged.ult = 0;
      merged.ult = clamp(merged.ult, 0, 100);
      merged.ver = G.VER;
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

  // 장비를 갈아입었을 때의 스탯·전투력 미리보기 (실제 착용 상태는 그대로 둔다)
  function previewStats(it) {
    const slot = it.slot;
    const prev = state.eq[slot];
    if (prev === it) return computeStats();
    state.eq[slot] = it;
    const st = computeStats();
    state.eq[slot] = prev;
    return st;
  }
  G.previewStats = previewStats;

  // 현재 같은 슬롯에 착용 중인 장비 대비 스탯 증감 + 전투력 차이
  function compareItem(it) {
    const cur = state.eq[it.slot] || null;
    if (cur === it) return { cur: cur, equipped: true, power: 0, better: false, deltas: [] };
    const now = computeStats();
    const next = previewStats(it);
    const r1 = (v) => Math.round(v * 10) / 10;
    const deltas = [
      { key: "atk", label: "공격", val: next.atk - now.atk, dec: 0 },
      { key: "hp", label: "체력", val: next.maxHp - now.maxHp, dec: 0 },
      { key: "def", label: "방어", val: r1(next.def - now.def), dec: 1 },
      { key: "crit", label: "치명", val: r1(next.crit - now.crit), dec: 1, pct: true },
      { key: "critDmg", label: "치피", val: r1(next.critDmg - now.critDmg), dec: 1, pct: true },
    ];
    return {
      cur: cur,
      equipped: false,
      power: next.power - now.power,
      better: next.power > now.power,
      deltas: deltas,
    };
  }
  G.compareItem = compareItem;

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
    if (x < 1) r = 4;
    else if (x < 9) r = 3;
    else if (x < 30) r = 2;
    else if (x < 62) r = 1;
    else r = 0;
    if (forceRarity !== undefined) r = forceRarity;
    const slot = pick(["weapon", "armor", "acc"]);
    return newItem(slot, r, ilvl);
  }
  G.rollItem = rollItem;

  // 사냥터 드랍은 일반~고급 위주 (던전이 장비 파밍의 중심)
  G.fieldDropRarity = function (stage) {
    const x = Math.random() * 100;
    if (stage >= 6 && x < 8) return 2;
    if (x < 26) return 1;
    return 0;
  };

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

  /* ------------------------------------------------------------- 상단 미션
   * 무한 반복 퀘스트: 완료 → 탭해서 수령 → 다음 미션 자동 연결
   */
  const REWARD_NAME = { gems: "보석", dc: "던전코인", stones: "강화석", gold: "골드" };
  const REWARD_UNIT = { gems: "개", dc: "", stones: "개", gold: "" };
  G.rewardName = REWARD_NAME;

  const QUEST_PLAN = [
    { kind: "kill", base: 14, step: 6, rw: "gems", ramt: 5, rstep: 1, icon: "🗡️" },
    { kind: "wave", base: 4, step: 2, rw: "stones", ramt: 2, rstep: 1, icon: "🌊" },
    { kind: "crit", base: 8, step: 3, rw: "dc", ramt: 3, rstep: 1, icon: "💥" },
    { kind: "combo", base: 15, step: 5, rw: "gold", ramt: 300, rstep: 200, icon: "🔥" },
    { kind: "boss", base: 1, step: 1, rw: "gems", ramt: 8, rstep: 2, icon: "👑" },
  ];

  function questText(kind, t) {
    if (kind === "kill") return "몬스터 " + t + "마리 처치";
    if (kind === "wave") return "던전 웨이브 " + t + "회 클리어";
    if (kind === "crit") return "치명타 " + t + "회 적중";
    if (kind === "combo") return t + " 콤보 달성";
    if (kind === "boss") return "보스 " + t + "회 처치";
    return "미션";
  }

  G.questTemplate = function (idx) {
    const p = QUEST_PLAN[idx % QUEST_PLAN.length];
    const loop = Math.floor(idx / QUEST_PLAN.length);
    const target = p.base + p.step * loop;
    const amount = Math.round(p.ramt + p.rstep * loop);
    return {
      idx: idx,
      kind: p.kind,
      icon: p.icon,
      target: target,
      progress: 0,
      reward: { type: p.rw, amount: amount },
      text: questText(p.kind, target),
      rewardText: REWARD_NAME[p.rw] + " " + fmt(amount) + REWARD_UNIT[p.rw],
    };
  };

  G.giveReward = function (reward) {
    if (!reward) return;
    if (reward.type === "gold") state.gold += reward.amount;
    else if (reward.type === "gems") state.gems += reward.amount;
    else if (reward.type === "dc") state.dc += reward.amount;
    else if (reward.type === "stones") state.stones += reward.amount;
  };
})();
