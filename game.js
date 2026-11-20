/* =========================================================================
 *  던전 크루세이더 — game.js
 *  데이터 · 픽셀 스프라이트 · 세이브 · 스탯 · 사냥터/던전 시뮬레이션
 * ========================================================================= */
(function () {
  "use strict";

  const G = (window.G = window.G || {});
  G.VER = 4;
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

  /* ------------------------------------------------------- 직업 (공주 클래스)
   * stat  : 기본 스탯 성향 배율 (직업마다 뚜렷한 개성)
   * skills: 던전 액티브 스킬 2종 — effect 로 전투 로직이 갈린다
   * ult   : 직업 전용 궁극기 — style 로 연출이 갈린다
   */
  G.JOBS = {
    paladin: {
      id: "paladin",
      name: "성기사 공주",
      short: "성기사",
      icon: "⚔️",
      color: "#ffd479",
      desc: "성검과 방패로 왕국을 지키는 빛의 수호자. 단단한 체력과 방어로 오래 버티는 안정형입니다.",
      tags: ["높은 체력", "방어 특화", "안정적"],
      stat: { atkMul: 1.0, hpMul: 1.2, critAdd: 0, critDmgAdd: 0, aspdMul: 1.0, defAdd: 2 },
      bars: { atk: 55, hp: 95, crit: 45, spd: 55 },
      tint: null,
      aura: "255,226,120",
      skills: [
        { id: "s1", name: "신성 베기", icon: "✨", short: "220% · 신성 폭발", mult: 2.2, cd: 3, effect: "holy", sfx: "holy" },
        { id: "s2", name: "성역 수호", icon: "🛡️", short: "회복 28% + 방어", cd: 4, effect: "healguard", heal: 0.28, sfx: "sanctuary" },
      ],
      ult: { name: "성광 폭격", icon: "✨", short: "공격 9배 + 회복 25%", mult: 9, hpScale: 0.8, heal: 0.25, style: "holy", sfx: "ult" },
    },
    mage: {
      id: "mage",
      name: "원소 마도사 공주",
      short: "마도사",
      icon: "🔥",
      color: "#8fd8ff",
      desc: "불과 얼음을 다루는 왕립 마도사. 체력은 낮지만 압도적인 마법 화력과 화상·빙결로 적을 무너뜨립니다.",
      tags: ["폭발적 화력", "화상·빙결", "낮은 체력"],
      stat: { atkMul: 1.24, hpMul: 0.84, critAdd: 3, critDmgAdd: 20, aspdMul: 0.94, defAdd: 0 },
      bars: { atk: 96, hp: 48, crit: 60, spd: 45 },
      aura: "140,210,255",
      tint: { c: "#57c9c2", C: "#2b6f78", p: "#a98cf5", P: "#5a3fa8", h: "#cbb2ff", H: "#8b6cf2", g: "#9ff0e6", G: "#2f8a84", m: "#a98cf5", M: "#6a4fd0", d: "#4a3f86" },
      skills: [
        { id: "s1", name: "파이어볼", icon: "🔥", short: "190% + 3턴 화상", mult: 1.9, cd: 3, effect: "burn", burn: 3, burnRate: 0.4, sfx: "flame" },
        { id: "s2", name: "빙결 파동", icon: "❄️", short: "160% + 1턴 빙결", mult: 1.6, cd: 4, effect: "freeze", freeze: 1, sfx: "frost" },
      ],
      ult: { name: "메테오 스트라이크", icon: "☄️", short: "공격 11배 + 화상", mult: 11, hpScale: 0.4, heal: 0, burn: 3, style: "meteor", sfx: "meteor" },
    },
    ranger: {
      id: "ranger",
      name: "그림자 레인저 공주",
      short: "레인저",
      icon: "🗡️",
      color: "#8fe07a",
      desc: "쌍단검과 그림자를 다루는 추적자. 빠른 공격 속도와 치명타, 다중 타격으로 순식간에 적을 찢습니다.",
      tags: ["치명타 특화", "다중 타격", "빠른 속도"],
      stat: { atkMul: 1.06, hpMul: 0.94, critAdd: 8, critDmgAdd: 30, aspdMul: 1.12, defAdd: 1 },
      bars: { atk: 70, hp: 55, crit: 95, spd: 90 },
      aura: "150,230,130",
      tint: { c: "#3f7a52", C: "#22472f", p: "#6b5a30", P: "#332a10", h: "#33402e", H: "#1c281a", g: "#a8e07a", G: "#4a7a3a", m: "#cfe8d0", M: "#6a8f74", d: "#3a5442" },
      skills: [
        { id: "s1", name: "연속 급소 찌르기", icon: "⚡", short: "2연타 · 각 125%", mult: 1.25, hits: 2, cd: 3, effect: "multi", sfx: "stab" },
        { id: "s2", name: "그림자 분신", icon: "👥", short: "4턴간 추가 타격 65%", cd: 5, effect: "shadow", shadow: 4, shadowMult: 0.65, sfx: "shadow" },
      ],
      ult: { name: "천본앵 · 난무", icon: "🌸", short: "6연격 · 각 190%", mult: 1.9, hits: 6, hpScale: 0, heal: 0, style: "sakura", sfx: "sakura" },
    },
    berserker: {
      id: "berserker",
      name: "광전사 공주",
      short: "광전사",
      icon: "🪓",
      color: "#ff8a7a",
      desc: "왕국의 분노를 몸에 새긴 광전사. 체력을 대가로 최강의 한 방을 내지르고, 피를 마시며 버팁니다.",
      tags: ["최강의 한 방", "흡혈", "체력 소모"],
      stat: { atkMul: 1.3, hpMul: 1.02, critAdd: 2, critDmgAdd: 10, aspdMul: 0.94, defAdd: 0 },
      bars: { atk: 99, hp: 62, crit: 55, spd: 50 },
      aura: "255,120,100",
      tint: { c: "#c8352f", C: "#7a1414", p: "#ffb03a", P: "#a35a10", h: "#ff7a3d", H: "#c04a18", g: "#ffd166", G: "#b8862a", m: "#e8e0d0", M: "#8a7a6a", d: "#4a3a30" },
      skills: [
        { id: "s1", name: "광폭 참격", icon: "🪓", short: "250% · 체력 6% 소모", mult: 2.5, cd: 3, effect: "rage", selfHp: 0.06, sfx: "rage" },
        { id: "s2", name: "피의 갈증", icon: "🩸", short: "4턴 공격 +40% · 흡혈", cd: 5, effect: "bloodrage", buff: 4, buffAtk: 0.4, lifesteal: 0.25, sfx: "blood" },
      ],
      ult: { name: "파멸의 일격", icon: "💥", short: "공격 10배 · 잃은 체력 비례", mult: 10, hpScale: 0, lowHpBonus: 0.8, heal: 0.12, style: "doom", sfx: "doom" },
    },
  };
  G.JOB_LIST = ["paladin", "mage", "ranger", "berserker"];
  G.job = function (id) {
    return G.JOBS[id] || G.JOBS.paladin;
  };

  /* ---------------------------------------------------------------- 펫
   * rarity 0~4 (일반~전설). rank 1당 능력치 +20%.
   * atkPct/hpPct/crit/critDmg/goldPct/dropPct : 상시 버프
   * hit    : 펫 추가 공격의 공격력 계수
   * every  : 사냥터 추가 공격 주기(초) / turns: 던전 추가 공격 주기(턴)
   * skill  : 3번째 공격마다 발동하는 펫 전용 보조 스킬
   */
  G.PET_SKILLS = {
    burn: { name: "화염 숨결", desc: "적에게 3턴 화상", icon: "🔥" },
    heal: { name: "회복의 빛", desc: "최대 체력 6% 회복", icon: "💚" },
    defDown: { name: "방어력 감소", desc: "4턴간 적이 받는 피해 +18%", icon: "🩹" },
    atkBuff: { name: "공격력 버프", desc: "4턴간 공격력 +18%", icon: "📣" },
  };

  G.PETS = [
    { id: "slime", name: "아기 슬라임", rarity: 0, sprite: "pet_slime", atkPct: 3, hpPct: 2, goldPct: 3, hit: 0.3, every: 3.0, turns: 2, skill: "defDown", desc: "말랑말랑 끈적하게 적을 붙잡는 새끼 슬라임." },
    { id: "bat", name: "박쥐 콩", rarity: 0, sprite: "pet_bat", atkPct: 2, crit: 2, hit: 0.32, every: 2.6, turns: 2, skill: "atkBuff", desc: "초음파로 공주의 사기를 북돋우는 아기 박쥐." },
    { id: "chick", name: "노랑 병아리", rarity: 0, sprite: "pet_chick", atkPct: 2, goldPct: 5, hit: 0.28, every: 3.2, turns: 3, skill: "heal", desc: "골드 냄새를 맡고 따라오는 삐약이." },
    { id: "fox", name: "숲 여우", rarity: 1, sprite: "pet_fox", crit: 3, critDmg: 8, hit: 0.38, every: 2.6, turns: 2, skill: "defDown", desc: "영리한 눈으로 적의 약점을 찾아내는 여우." },
    { id: "aqua", name: "물의 정령", rarity: 1, sprite: "pet_aqua", atkPct: 2, hpPct: 5, hit: 0.34, every: 2.8, turns: 2, skill: "heal", desc: "맑은 물방울로 상처를 씻어 주는 정령." },
    { id: "starfox", name: "별빛 여우", rarity: 2, sprite: "pet_starfox", atkPct: 6, crit: 3, critDmg: 12, hit: 0.42, every: 2.4, turns: 2, skill: "atkBuff", desc: "별가루를 흩뿌리며 달리는 은빛 여우." },
    { id: "dragon", name: "아기 드래곤", rarity: 2, sprite: "pet_dragon", atkPct: 7, critDmg: 16, hit: 0.46, every: 3.0, turns: 3, skill: "burn", desc: "아직 불을 잘 못 뿜지만 화상은 확실한 아기용." },
    { id: "snow", name: "눈토끼", rarity: 2, sprite: "pet_snow", hpPct: 6, crit: 2, hit: 0.36, every: 2.8, turns: 2, skill: "heal", desc: "얼음 성채에서 굴러온 폭신한 눈토끼." },
    { id: "owl", name: "천사 부엉이", rarity: 3, sprite: "pet_owl", atkPct: 8, hpPct: 6, critDmg: 20, hit: 0.5, every: 2.6, turns: 2, skill: "heal", desc: "성광의 깃털로 공주를 감싸는 수호 부엉이." },
    { id: "gold", name: "황금 슬라임", rarity: 3, sprite: "pet_gold", atkPct: 4, goldPct: 18, dropPct: 8, hit: 0.36, every: 3.0, turns: 3, skill: "defDown", desc: "골드와 보물을 끌어당기는 반짝이는 슬라임." },
    { id: "hound", name: "지옥 사냥개", rarity: 4, sprite: "pet_hound", atkPct: 11, crit: 4, critDmg: 26, hit: 0.62, every: 2.0, turns: 1, skill: "burn", desc: "심연의 불꽃을 물고 달리는 사냥개." },
    { id: "phoenix", name: "불사조", rarity: 4, sprite: "pet_phoenix", atkPct: 10, hpPct: 8, crit: 5, critDmg: 18, hit: 0.55, every: 2.2, turns: 2, skill: "heal", desc: "불꽃 날개로 공주를 되살리는 전설의 새." },
  ];
  G.PETS_BY_ID = {};
  G.PETS.forEach((p) => (G.PETS_BY_ID[p.id] = p));

  /* ------------------------------------------------- 장비 잠재옵션 (제련)
   * 강화(+N)와 별개로 붙는 옵션. 기본 스탯 비교에 포함된다.
   */
  G.POT = [
    { k: "atkPct", name: "공격력", base: 3, step: 1.4, dec: 0, sign: "%" },
    { k: "hpPct", name: "체력", base: 3, step: 1.4, dec: 0, sign: "%" },
    { k: "crit", name: "치명타 확률", base: 1.1, step: 0.5, dec: 1, sign: "%" },
    { k: "critDmg", name: "치명타 피해", base: 6, step: 2.2, dec: 0, sign: "%" },
    { k: "lifesteal", name: "흡혈", base: 1.1, step: 0.5, dec: 1, sign: "%" },
    { k: "bossDmg", name: "보스 피해", base: 5, step: 2.4, dec: 0, sign: "%" },
    { k: "goldPct", name: "골드 획득", base: 4, step: 1.6, dec: 0, sign: "%" },
  ];
  G.POT_BY_KEY = {};
  G.POT.forEach((p) => (G.POT_BY_KEY[p.k] = p));
  G.optText = function (o) {
    const p = G.POT_BY_KEY[o.k];
    if (!p) return "";
    return p.name + " +" + o.v.toFixed(p.dec) + p.sign;
  };

  /* ---------------------------------------------------------------- 도감 */
  // 장비 도감 : 슬롯 × 등급 15칸 / 펫 도감 : 펫 12종
  G.CODEX_ITEM_KEYS = [];
  ["weapon", "armor", "acc"].forEach((slot) => {
    for (let r = 0; r < 5; r++) G.CODEX_ITEM_KEYS.push(slot + "_" + r);
  });
  G.CODEX_REWARD = { atkPct: 0.5, hpPct: 0.5, petAtkPct: 0.3, petCrit: 0.3, petCritDmg: 0.4 };

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
    /* ---------------- 펫 도트 (12종) ---------------- */
    /* pet_slime */
    pet_slime: [
      "..............",
      "..............",
      "..............",
      "..............",
      "...kkkkkkkk...",
      "..kvvvvvvvvk..",
      ".kvvvvvvvvvvk.",
      "kvvvwwvvwwvvvk",
      "kvvvevvvvevvvk",
      "kvvvvveevvvvvk",
      "kvvvvvvvvvvvvk",
      ".kvvvvvvvvvvvk",
      "..kvvvvvvvvkk.",
      "...kkkkkkkk..."
    ],
    /* pet_bat */
    pet_bat: [
      "..............",
      ".k..........k.",
      "kpk........kpk",
      "pppk......kppp",
      "pppk.kkkk.kppp",
      "kpppkppppkpppk",
      ".kppppppppppk.",
      "..kppwppwppk..",
      "...kpeppepk...",
      "...kppppppk...",
      "...kppppppk...",
      "....kppppk....",
      ".....kkkk.....",
      ".............."
    ],
    /* pet_chick */
    pet_chick: [
      "..............",
      "..............",
      "..............",
      "......kk......",
      "....kkyykk....",
      "...kyyyyyyk...",
      "..kyyyyyyyyk..",
      "..kywwyywwyk..",
      ".kyyeyyyyeyyk.",
      "..kyyyooyyyk..",
      "..kyyyyyyyyk..",
      "...koyyyyok...",
      "...okkyykko...",
      "......kk......"
    ],
    /* pet_fox */
    pet_fox: [
      "..k........k..",
      ".kok......kok.",
      ".kook....kook.",
      "..kookkkkook..",
      "...kooooook...",
      "..kooooooook..",
      "..kowwoowwok..",
      ".kooeooooeook.",
      ".kooooeeooook.",
      ".kooooooooook.",
      ".koooowwooook.",
      "..kooooooook..",
      "...kkooookk...",
      ".....kkkk....."
    ],
    /* pet_aqua */
    pet_aqua: [
      "......kk......",
      ".....kttk.....",
      "....kttttk....",
      "...kttttttk...",
      "...kttttttk...",
      "...kttttttk...",
      "..kttttttttk..",
      "..kttttttttk..",
      ".kttwwttwwttk.",
      ".kttettttettk.",
      "..kttttttttk..",
      "..kttttttttk..",
      "...kttttttk...",
      "....kkkkkk...."
    ],
    /* pet_starfox */
    pet_starfox: [
      "..d........d..",
      ".dmd......dmd.",
      ".dmmd....dmmd.",
      "...mmddddmmd..",
      "...dmmyymmd...",
      "...mmyyyymmd..",
      "...mwwyywwmd..",
      ".dmmemmmmemmd.",
      ".dmmmmmmmmmmd.",
      ".dmmmmmmmmmmd.",
      ".dmmmmmmmmmmd.",
      "..dmmmmmmmmd..",
      "...ddmmmmdd...",
      ".....dddd....."
    ],
    /* pet_dragon */
    pet_dragon: [
      "........k.k...",
      ".......kRkRk..",
      "........kRk...",
      ".k......kRk...",
      "krk....kRRk...",
      "krk..kkRRRRk..",
      "krrkkRRRweRRk.",
      ".krrRRRRRRoRk.",
      ".kRRRRRRRRRk..",
      ".kRRRRRRRRRk..",
      "kRRRRRRRRRRk..",
      "kRRRRRRRRRk...",
      "RkkkkRRRkk....",
      "k....kkk......"
    ],
    /* pet_snow */
    pet_snow: [
      "....dd..dd....",
      "...dmmddmmd...",
      "...dmmddmmd...",
      "...dwmddmwd...",
      "...dwmddmwd...",
      "....dd..dd....",
      "....dddddd....",
      "...dmmmmmmd...",
      "..dmwwmmwwmd..",
      "..dmemmmmemd..",
      "..dmmmoommmd..",
      "..dmmmmmmmmd..",
      "...dmmmmmmd...",
      "....dddddd...."
    ],
    /* pet_owl */
    pet_owl: [
      "..............",
      "..yyyyyyyyyy..",
      ".y..........y.",
      "....kkkkkk....",
      "...kMMMMMMk...",
      "..kMMMMMMMMk..",
      "kkMMwwMMMwwMkk",
      "wwMweewMeewwww",
      "wwMMwwMMMwwMww",
      "wwMMMMooMMMMww",
      "kkMMMMMMMMMMkk",
      "..kMMMMMMMMk..",
      "...kMMMMMMk...",
      "....kkkkkk...."
    ],
    /* pet_gold */
    pet_gold: [
      "....y.yy.y....",
      "....yyyyyy....",
      "..............",
      "..............",
      "....GGGGGG....",
      "..GGggggggGG..",
      ".GggggggggggG.",
      "GgggwwggwwgggG",
      "GgggeggggegggG",
      "GgggggeegggggG",
      "GggggggggggggG",
      ".GgggggggggggG",
      "..GGggggggGGG.",
      "....GGGGGG...."
    ],
    /* pet_hound */
    pet_hound: [
      "..............",
      "..............",
      "..........kk..",
      ".........kzzk.",
      "........kkkzk.",
      "y.o....kzzzzk.",
      ".o.kkkkzzrzrzk",
      "o.kzzzzzzzzzzk",
      ".rzzzzzzzzRzzk",
      "kzzzzzzzzzzzk.",
      ".kzzzzzzzkkk..",
      "..kzzzzzk.kzk.",
      "..kzkkkzk.kzk.",
      "...k...k...k.."
    ],
    /* pet_phoenix */
    pet_phoenix: [
      "......kk......",
      ".....kyyk.....",
      "....kyyk......",
      ".kk..kkkk..kk.",
      "kRRkkyyyykkRRk",
      "kRkkkeyyekkkRk",
      ".kRRkyyyykRRk.",
      "..kRRooooRRk..",
      "...kooooook...",
      "....kooook....",
      "....kooook....",
      "....koook.....",
      "....koyok.....",
      ".....kkk......"
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

  /* ------------------------------------------------------- 직업별 공주 스프라이트
   * 기본 공주 도트에 직업 팔레트(tint) + 무기/방어구 오버레이를 합성한다.
   */
  const JOB_OVERLAY = {
    /* paladin */
    paladin: [
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "..kkkkkk..............",
      ".kggyygk..............",
      "kgywwygk..............",
      "kgywwygk..............",
      "kgyyyygk..............",
      ".kgyyygk..............",
      "..kgyygk..............",
      "...kkkkk..............",
      "......................",
      "......................",
      "......................"
    ],
    /* mage */
    mage: [
      "..........kkk.........",
      "........kpppk.........",
      ".......kpppppk........",
      "......kpppppppk.......",
      ".....kpppyppppk.......",
      "..kkpppppppppppppppkk.",
      "...kPPPPPPPPPPPPPPPPPk",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................"
    ],
    /* ranger */
    ranger: [
      "......................",
      "........kkkk..........",
      "......kkVVVVkk........",
      "....kkVVVVVVVVkk......",
      "..kkVVVVVVVVVVVVkk....",
      ".kVVVVVVVVVVVVVVVVk...",
      ".kVVVVVVVvVVvVVVVVVk..",
      "...kv...........vk....",
      "...kv...........vk....",
      "...kv...........vk....",
      ".w.kv...........vk....",
      ".wMkv...........vk....",
      ".mMkv...........vk....",
      ".mMkv...........vk....",
      ".mMkv...........vk....",
      ".mMkv...........vk....",
      "kbMkv...........vk....",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................",
      "......................"
    ],
    /* berserker */
    berserker: [
      "......................",
      "......................",
      "......................",
      "...................bB.",
      "...................bB.",
      "...................bB.",
      "...................bB.",
      "......................",
      "...................kkk",
      ".................kkmmm",
      "................kmmwwm",
      "................kmmmmm",
      ".................kkmmm",
      "...................kkk",
      "......................",
      ".kkkkk.............bB.",
      "kRRRRRk............bB.",
      "kRrRRRk............bB.",
      ".kRRRk.............bB.",
      "..kkk..............bB.",
      "...................bB.",
      "...................bB.",
      "...................bB.",
      "...................bB.",
      "...................bB.",
      "...................bB.",
      "...................bB."
    ],
  };

  const jobCache = new Map();
  function jobSprite(id, scale) {
    const key = "job|" + id + "|" + scale;
    if (jobCache.has(key)) return jobCache.get(key);
    const job = G.job(id);
    const base = buildSprite(SPR.hero, scale, job.tint || null);
    const ov = JOB_OVERLAY[id];
    if (!ov) {
      jobCache.set(key, base);
      return base;
    }
    const o = buildSprite(ov, scale, null);
    const c = document.createElement("canvas");
    c.width = Math.max(base.width, o.width);
    c.height = Math.max(base.height, o.height);
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(base, 0, 0);
    g.drawImage(o, 0, 0);
    jobCache.set(key, c);
    return c;
  }
  G.jobSprite = jobSprite;

  function sprite(key, scale, tintMap) {
    const sk = 1;
    // "job:<id>" 는 직업 합성 스프라이트
    if (typeof key === "string" && key.indexOf("job:") === 0) return jobSprite(key.slice(4), scale);
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
    it.opt = rollOptions(it.rarity, ilvl);
    return it;
  }

  /* 잠재옵션(제련) — 강화와 별개로 붙는 추가 옵션. 기본 스탯 비교에 포함된다. */
  function rollOptions(rarity, ilvl) {
    const out = [];
    if (rarity < 1) return out;
    let n = 0;
    if (Math.random() < 0.1 + rarity * 0.15) n = 1;
    if (rarity >= 2 && Math.random() < 0.22) n++;
    if (rarity >= 3 && Math.random() < 0.26) n++;
    if (rarity >= 4 && Math.random() < 0.3) n++;
    n = Math.min(3, n);
    const pool = G.POT.slice();
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const p = pool.splice(idx, 1)[0];
      const f = 1 + (ilvl - 1) * 0.05 + rarity * 0.2;
      let v = (p.base + Math.random() * p.step * 2.2) * f;
      v = p.dec ? Math.round(v * 10) / 10 : Math.round(v);
      if (v > 0) out.push({ k: p.k, v: v });
    }
    return out;
  }
  G.rollOptions = rollOptions;

  function refineCost(it) {
    return { dc: 3 + (it.rarity || 0) * 2, gold: Math.round(240 * ((it.rarity || 0) + 1) * (1 + (it.ilvl || 1) * 0.12)) };
  }
  G.refineCost = refineCost;

  // 제련 : 잠재옵션을 통째로 다시 뽑는다 (던전코인 + 골드)
  function rerollOptions(it) {
    const c = refineCost(it);
    if ((state.dc || 0) < c.dc) return { ok: false, msg: "던전코인이 부족합니다 (" + c.dc + "개 필요)" };
    if (state.gold < c.gold) return { ok: false, msg: "골드가 부족합니다" };
    state.dc -= c.dc;
    state.gold -= c.gold;
    it.opt = rollOptions(it.rarity, it.ilvl);
    state.stats.refines = (state.stats.refines || 0) + 1;
    save();
    return { ok: true, opt: it.opt };
  }
  G.rerollOptions = rerollOptions;

  function defaultState() {
    return {
      ver: G.VER,
      name: "서쟈",
      playerName: "서쟈",
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
      // v4 : 직업 · 펫 · 도감 · 무한의 시련
      job: "paladin",
      pets: {},
      pet: null,
      shards: 0,
      codex: { items: {}, pets: {} },
      rushBest: 0,
      seenJobs: false,
      floors: new Array(G.FLOOR_COUNT).fill(false),
      quest: { idx: 0, prog: 0, done: false },
      ult: 0,
      haptics: true,
      lastSeen: Date.now(),
      playtime: 0,
      adsSeen: 0,
      stats: { kills: 0, dungeons: 0, salvaged: 0, crits: 0, combos: 0, bestCombo: 0, quests: 0, goldGoblins: 0, mimics: 0, ults: 0, petsPulled: 0, refines: 0, rushBoss: 0 },
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
      // 부분 업그레이드/전적 필드가 있는 구버전 세이브도 NaN 없이 복원
      merged.up = Object.assign({ atk: 0, hp: 0, crit: 0, critDmg: 0, speed: 0, gold: 0 }, s.up || {});
      merged.eq = Object.assign({ weapon: null, armor: null, acc: null }, s.eq || {});
      merged.stats = Object.assign(
        { kills: 0, dungeons: 0, salvaged: 0, crits: 0, combos: 0, bestCombo: 0, quests: 0, goldGoblins: 0, mimics: 0, ults: 0, petsPulled: 0, refines: 0, rushBoss: 0 },
        s.stats || {}
      );
      // --- v4 마이그레이션 : 직업 · 펫 · 도감 (구버전 세이브는 성기사로 이어서 시작) ---
      if (!G.JOBS[merged.job]) merged.job = "paladin";
      if (!merged.pets || typeof merged.pets !== "object" || Array.isArray(merged.pets)) merged.pets = {};
      if (typeof merged.shards !== "number" || !isFinite(merged.shards)) merged.shards = 0;
      if (typeof merged.rushBest !== "number" || !isFinite(merged.rushBest)) merged.rushBest = 0;
      if (!merged.codex || typeof merged.codex !== "object") merged.codex = { items: {}, pets: {} };
      if (!merged.codex.items || typeof merged.codex.items !== "object") merged.codex.items = {};
      if (!merged.codex.pets || typeof merged.codex.pets !== "object") merged.codex.pets = {};
      (merged.inv || []).forEach((it) => {
        if (!it) return;
        if (!Array.isArray(it.opt)) it.opt = [];
        if (it.slot && typeof it.rarity === "number") merged.codex.items[it.slot + "_" + it.rarity] = 1;
      });
      Object.keys(merged.eq).forEach((slot) => {
        const it = merged.eq[slot];
        if (!it) return;
        if (!Array.isArray(it.opt)) it.opt = [];
        if (it.slot && typeof it.rarity === "number") merged.codex.items[it.slot + "_" + it.rarity] = 1;
      });
      Object.keys(merged.pets).forEach((id) => {
        if (G.PETS_BY_ID[id]) {
          merged.codex.pets[id] = 1;
          merged.pets[id] = Object.assign({ rank: 0 }, merged.pets[id]);
        } else {
          delete merged.pets[id];
        }
      });
      if (merged.pet && !G.PETS_BY_ID[merged.pet]) merged.pet = null;
      // --- 구버전(ver1/ver2: 5층) 세이브 마이그레이션 ---
      if (!Array.isArray(merged.floors)) merged.floors = [];
      if (merged.floors.length !== G.FLOOR_COUNT) {
        const nf = new Array(G.FLOOR_COUNT).fill(false);
        for (let i = 0; i < Math.min(merged.floors.length, G.FLOOR_COUNT); i++) nf[i] = !!merged.floors[i];
        merged.floors = nf;
      }
      if (!merged.quest || typeof merged.quest.idx !== "number") merged.quest = d.quest;
      // --- 닉네임 마이그레이션 : playerName 이 없으면 기존 name(기본 "서쟈")을 승계 ---
      const oldName = typeof merged.name === "string" ? merged.name.trim().slice(0, 10) : "";
      const newName = typeof merged.playerName === "string" ? merged.playerName.trim().slice(0, 10) : "";
      merged.playerName = newName || oldName || "서쟈";
      merged.name = merged.playerName;
      if (typeof merged.ult !== "number" || !isFinite(merged.ult)) merged.ult = 0;
      merged.ult = clamp(merged.ult, 0, 100);
      merged.ver = G.VER;
      if (!Array.isArray(merged.inv)) merged.inv = [];
      return merged;
    } catch (e) {
      return null;
    }
  }

  /* ---------------------------------------------------------------- stats
   * baseOnly:true → 강화(+N) 보너스를 뺀 순수 기본 스탯으로 계산.
   * 장비 비교(▲ UP · 추천 장착 · 가방 알림)는 모두 이 기준을 쓴다.
   */
  const EQ_SLOTS = ["weapon", "armor", "acc"];

  function eqTotals(baseOnly) {
    const t = { atk: 0, hp: 0, def: 0, crit: 0, critDmg: 0, atkPct: 0, hpPct: 0, lifesteal: 0, bossDmg: 0, goldPct: 0 };
    EQ_SLOTS.forEach((slot) => {
      const it = state.eq[slot];
      if (!it) return;
      const m = baseOnly ? 1 : 1 + (it.lvl || 0) * 0.1;
      t.atk += (it.atk || 0) * m;
      t.hp += (it.hp || 0) * m;
      t.def += (it.def || 0) * m;
      t.crit += (it.crit || 0) * m;
      t.critDmg += (it.critDmg || 0) * m;
      (it.opt || []).forEach((o) => {
        if (o.k === "atkPct") t.atkPct += o.v;
        else if (o.k === "hpPct") t.hpPct += o.v;
        else if (o.k === "lifesteal") t.lifesteal += o.v;
        else if (o.k === "bossDmg") t.bossDmg += o.v;
        else if (o.k === "goldPct") t.goldPct += o.v;
        else if (o.k === "crit") t.crit += o.v;
        else if (o.k === "critDmg") t.critDmg += o.v;
      });
    });
    return t;
  }
  G.eqTotals = eqTotals;

  // 하위 호환용 (강화 포함 단일 스탯 합)
  function eqSum(key) {
    return eqTotals(false)[key] || 0;
  }
  G.eqSum = eqSum;

  /* --------------------------------------------------------- 펫 · 도감 버프 */
  function petBuffs(id) {
    const pid = id === undefined ? state.pet : id;
    const out = { id: null, name: "", atkPct: 0, hpPct: 0, crit: 0, critDmg: 0, goldPct: 0, dropPct: 0, lifesteal: 0, hit: 0, every: 3, turns: 3, skill: null, rank: 0, mul: 1 };
    const p = pid ? G.PETS_BY_ID[pid] : null;
    if (!p) return out;
    const rank = (state.pets[pid] && state.pets[pid].rank) || 0;
    const mul = 1 + rank * 0.2;
    out.id = pid;
    out.name = p.name;
    out.rank = rank;
    out.mul = mul;
    out.rarity = p.rarity;
    out.sprite = p.sprite;
    out.atkPct = (p.atkPct || 0) * mul;
    out.hpPct = (p.hpPct || 0) * mul;
    out.crit = (p.crit || 0) * mul;
    out.critDmg = (p.critDmg || 0) * mul;
    out.goldPct = (p.goldPct || 0) * mul;
    out.dropPct = (p.dropPct || 0) * mul;
    out.hit = (p.hit || 0) * mul;
    out.every = p.every || 3;
    out.turns = p.turns || 3;
    out.skill = p.skill;
    return out;
  }
  G.petBuffs = petBuffs;

  function codexBuffs() {
    const c = state.codex || { items: {}, pets: {} };
    const items = c.items || {};
    const pets = c.pets || {};
    const nEq = G.CODEX_ITEM_KEYS.filter((k) => items[k]).length;
    const nPet = G.PETS.filter((p) => pets[p.id]).length;
    const R = G.CODEX_REWARD;
    const b = {
      nEq: nEq,
      nPet: nPet,
      atkPct: nEq * R.atkPct + nPet * R.petAtkPct,
      hpPct: nEq * R.hpPct,
      crit: nPet * R.petCrit,
      critDmg: nPet * R.petCritDmg,
      fullEq: nEq >= G.CODEX_ITEM_KEYS.length,
      fullPet: nPet >= G.PETS.length,
    };
    if (b.fullEq) {
      b.atkPct += 5;
      b.hpPct += 5;
    }
    if (b.fullPet) {
      b.crit += 3;
      b.critDmg += 10;
    }
    return b;
  }
  G.codexBuffs = codexBuffs;

  function computeStats(opt) {
    const baseOnly = !!(opt && opt.baseOnly);
    const lv = state.lv;
    const up = state.up;
    const job = G.job(state.job);
    const t = eqTotals(baseOnly);
    const pet = petBuffs();
    const col = codexBuffs();
    const atkRaw = 5 + lv * 2.1 + up.atk * 4 + up.atk * up.atk * 0.35 + t.atk;
    const atk = Math.round(atkRaw * job.stat.atkMul * (1 + (t.atkPct + pet.atkPct + col.atkPct) / 100));
    const hpRaw = 60 + lv * 14 + up.hp * 14 + up.hp * up.hp * 1.2 + t.hp;
    const maxHp = Math.round(hpRaw * job.stat.hpMul * (1 + (t.hpPct + pet.hpPct + col.hpPct) / 100));
    const crit = clamp(5 + up.crit * 1.6 + t.crit + job.stat.critAdd + pet.crit + col.crit, 0, 80);
    const critDmg = 150 + up.critDmg * 12 + t.critDmg + job.stat.critDmgAdd + pet.critDmg + col.critDmg;
    const aspd = 1.0 * (1 + up.speed * 0.11) * job.stat.aspdMul;
    const goldMul = (1 + up.gold * 0.14 + t.goldPct / 100) * (1 + pet.goldPct / 100);
    const def = t.def + job.stat.defAdd;
    const lifesteal = (t.lifesteal + pet.lifesteal) / 100;
    const bossDmg = t.bossDmg / 100;
    const dropBonus = pet.dropPct / 100;
    const dps = atk * aspd * (1 + (crit / 100) * (critDmg / 100 - 1));
    return {
      atk,
      maxHp,
      crit,
      critDmg,
      aspd,
      goldMul,
      def,
      dps,
      lifesteal,
      bossDmg,
      dropBonus,
      atkPct: t.atkPct,
      hpPct: t.hpPct,
      pet: pet,
      codex: col,
      jobId: job.id,
      power: Math.round(atk * 3 + maxHp * 0.9 + crit * 6 + (critDmg - 150) * 2 + def * 12 + (aspd - 1) * 400 + lifesteal * 600 + bossDmg * 300),
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

  // 강화(+N)를 뺀 순수 기본 스탯의 전투력 — 장비 비교의 기준값
  function basePower(it) {
    return Math.round((it.atk || 0) * 3 + (it.hp || 0) * 0.5 + (it.def || 0) * 8 + (it.crit || 0) * 4 + (it.critDmg || 0) * 1.5);
  }
  G.basePower = basePower;

  // 강화(+N)가 실제로 붙여준 수치 (비교와 별개로 보여주기용)
  function enhanceBonus(it) {
    const m = (it.lvl || 0) * 0.1;
    return {
      lvl: it.lvl || 0,
      pct: Math.round(m * 100),
      atk: Math.round((it.atk || 0) * m),
      hp: Math.round((it.hp || 0) * m),
      def: Math.round((it.def || 0) * m * 10) / 10,
    };
  }
  G.enhanceBonus = enhanceBonus;

  // 장비를 갈아입었을 때의 스탯·전투력 미리보기 (실제 착용 상태는 그대로 둔다)
  function previewStats(it, opt) {
    const slot = it.slot;
    const prev = state.eq[slot];
    if (prev === it) return computeStats(opt);
    state.eq[slot] = it;
    const st = computeStats(opt);
    state.eq[slot] = prev;
    return st;
  }
  G.previewStats = previewStats;

  // 같은 슬롯에 착용 중인 장비 대비 — 강화(+N) 제외, 순수 기본 스탯(원판 + 잠재옵션) 비교
  function compareItem(it) {
    const cur = state.eq[it.slot] || null;
    if (cur === it) return { cur: cur, equipped: true, power: 0, better: false, deltas: [], baseOnly: true };
    const now = computeStats({ baseOnly: true });
    const next = previewStats(it, { baseOnly: true });
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
      baseOnly: true,
      nowPower: now.power,
      nextPower: next.power,
    };
  }
  G.compareItem = compareItem;

  /* -------------------------------------------------------------- 도감 등록 */
  function registerItem(it) {
    if (!it || !it.slot) return false;
    if (!state.codex) state.codex = { items: {}, pets: {} };
    if (!state.codex.items) state.codex.items = {};
    const key = it.slot + "_" + it.rarity;
    if (state.codex.items[key]) return false;
    state.codex.items[key] = 1;
    return true;
  }
  G.registerItem = registerItem;

  /* ------------------------------------------------------------------ 펫 */
  function petRank(id) {
    return (state.pets[id] && state.pets[id].rank) || 0;
  }
  G.petRank = petRank;

  // 펫 획득 : 새 펫이면 등록, 중복이면 승급(★), ★5 중복은 조각으로 전환
  function grantPet(id) {
    const p = G.PETS_BY_ID[id];
    if (!p) return null;
    if (!state.pets) state.pets = {};
    if (!state.codex) state.codex = { items: {}, pets: {} };
    if (!state.codex.pets) state.codex.pets = {};
    if (!state.pets[id]) {
      state.pets[id] = { rank: 0 };
      state.codex.pets[id] = 1;
      if (!state.pet) state.pet = id;
      return { id: id, pet: p, isNew: true, rank: 0, shards: 0 };
    }
    const cur = state.pets[id].rank || 0;
    if (cur < 5) {
      state.pets[id].rank = cur + 1;
      return { id: id, pet: p, isNew: false, rank: cur + 1, levelUp: true, shards: 0 };
    }
    const sh = 10 + p.rarity * 12;
    state.shards = (state.shards || 0) + sh;
    return { id: id, pet: p, isNew: false, rank: 5, levelUp: false, shards: sh };
  }
  G.grantPet = grantPet;

  function equipPet(id) {
    if (id && !state.pets[id]) return { ok: false, msg: "보유하지 않은 펫입니다" };
    state.pet = id || null;
    save();
    return { ok: true };
  }
  G.equipPet = equipPet;

  /* ----------------------------------------------------------- 상자깡(소환) */
  G.CHESTS = [
    { id: "wood", name: "나무 상자", icon: "🧰", cur: "gold", cost: 1500, rates: [58, 28, 11, 3, 0], note: "일반 ~ 희귀" },
    { id: "gold", name: "황금 상자", icon: "🎁", cur: "gems", cost: 30, rates: [16, 36, 34, 12, 2], note: "고급 ~ 영웅" },
    { id: "legend", name: "전설 상자", icon: "👑", cur: "gems", cost: 110, rates: [0, 0, 34, 46, 20], note: "희귀 ~ 전설" },
  ];
  G.chest = function (id) {
    return G.CHESTS.find((c) => c.id === id) || G.CHESTS[0];
  };
  // 조각으로 원하는 등급의 펫을 확정 소환
  G.SHARD_COST = [25, 45, 90, 180, 360];
  G.rollPetId = function (rates) {
    let x = Math.random() * 100;
    let acc = 0;
    let r = 0;
    for (let i = 0; i < rates.length; i++) {
      acc += rates[i];
      if (x < acc) {
        r = i;
        break;
      }
    }
    const pool = G.PETS.filter((p) => p.rarity === r);
    if (!pool.length) return G.PETS[0].id;
    return pick(pool).id;
  };

  /* --------------------------------------------------------------- 직업 */
  G.jobSkills = function () {
    return G.job(state.job).skills;
  };
  G.setJob = function (id) {
    if (!G.JOBS[id]) return false;
    state.job = id;
    save();
    return true;
  };


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
    registerItem(it);
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
    registerItem(it);
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
