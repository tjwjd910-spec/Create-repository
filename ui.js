/* =========================================================================
 *  던전 크루세이더 — ui.js
 *  화면 구성 · 사냥터 시뮬레이션 · 턴제 던전 · 저장 · 광고 훅
 * ========================================================================= */
(function () {
  "use strict";
  const G = window.G;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const fmt = G.fmt;
  const rnd = G.rnd;
  const clamp = G.clamp;

  let S = null;
  let stats = null;
  let tab = "field";
  let buffUntil = 0;
  let fieldScene = null;
  let battleScene = null;
  let lastSave = 0;
  let startedAt = Date.now();

  function save() {
    G.save();
  }

  /* --------------------------------------------------------------- helpers */
  function toast(msg, kind) {
    const wrap = $("#toasts");
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 260);
    }, 1900);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
  }
  G.toast = toast;

  function makeCanvas(key, scale, tint) {
    const c = document.createElement("canvas");
    const spr = G.sprite(key, scale, tint);
    if (!spr) return c;
    c.width = spr.width;
    c.height = spr.height;
    c.getContext("2d").drawImage(spr, 0, 0);
    return c;
  }

  function titleFor(lv) {
    if (lv >= 30) return "빛의 공주";
    if (lv >= 22) return "왕실 수호기사";
    if (lv >= 15) return "로열 기사";
    if (lv >= 8) return "견습 기사";
    if (lv >= 3) return "어린 공주";
    return "티아라 견습생";
  }

  function sfx(name) {
    try {
      G.Audio && G.Audio.sfx(name);
    } catch (e) {}
  }
  function bgm(name) {
    try {
      // 타이틀·컷신 화면에서는 BGM을 켜지 않는다 (오프닝 테마가 우선)
      if (G.titleActive) return;
      G.Audio && G.Audio.bgm(name);
    } catch (e) {}
  }
  // 진동 (지원 기기 + 사용자가 한 번 터치한 뒤에만, 옵션 안전 처리)
  let userGestured = false;
  function markGesture() {
    userGestured = true;
  }
  ["pointerdown", "touchstart", "keydown", "click"].forEach((ev) =>
    document.addEventListener(ev, markGesture, true)
  );
  function haptic(p) {
    try {
      if (!S || S.haptics === false || !userGestured) return;
      if (navigator.vibrate) navigator.vibrate(p);
    } catch (e) {}
  }

  /* ------------------------------------------------------------- 콤보 시스템 */
  const Combo = {
    n: 0,
    timer: 0,
    pop: 0,
    add() {
      this.n++;
      this.timer = 4.4;
      this.pop = 1;
      if (S) S.stats.bestCombo = Math.max(S.stats.bestCombo || 0, this.n);
      if (this.n > 1 && this.n % 5 === 0) sfx("combo");
      questAdd("combo", this.n, "max");
      renderCombo();
    },
    reset(silent) {
      if (!silent && this.n >= 8) {
        const who = Dungeon.active ? battleScene : fieldScene;
        if (who) who.text(who.hero.x, who.groundY - 96, "COMBO END", "#9a93b8", 13);
      }
      this.n = 0;
      this.timer = 0;
      renderCombo();
    },
    update(dt) {
      if (this.n <= 0) return;
      this.timer -= dt;
      if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 4);
      if (this.timer <= 0) this.reset();
    },
    atkMul() {
      return 1 + Math.min(0.3, this.n * 0.012);
    },
    goldMul() {
      return 1 + Math.min(0.5, this.n * 0.015);
    },
  };

  function renderCombo() {
    const n = Combo.n;
    const mul = Math.round((Combo.atkMul() - 1) * 100);
    ["#comboField", "#comboBattle"].forEach((sel) => {
      const el = $(sel);
      if (!el) return;
      el.classList.toggle("on", n >= 2);
      el.classList.toggle("hot", n >= 15);
      el.classList.toggle("blaze", n >= 30);
      const b = el.querySelector("b");
      if (b) b.textContent = n;
      const em = el.querySelector("em");
      if (em) em.textContent = "공격 +" + mul + "% · 골드 +" + Math.round((Combo.goldMul() - 1) * 100) + "%";
      if (Combo.pop > 0.6) {
        el.style.transform = "scale(" + (1 + Combo.pop * 0.14) + ")";
      } else {
        el.style.transform = "";
      }
    });
  }

  /* ------------------------------------------------------- 궁극기 [성광 폭격] */
  function ultReady() {
    return (S.ult || 0) >= 100;
  }
  function ultGain(n) {
    if (!S) return;
    S.ult = clamp((S.ult || 0) + n, 0, 100);
    renderUlt();
  }
  function renderUlt() {
    const pct = clamp(Math.round(S.ult || 0), 0, 100);
    const ready = pct >= 100;
    const ult = G.job(S.job).ult;
    const un1 = $("#ultName");
    if (un1) un1.textContent = ult.name;
    const un2 = $("#ultNameField");
    if (un2) un2.textContent = ult.name;
    const busy = Dungeon.active && (Dungeon.busy || !Dungeon.enemy || Dungeon.enemy.hp <= 0);
    const fb = $("#btnUltField");
    if (fb) {
      fb.disabled = !ready || tab !== "field";
      fb.classList.toggle("ready", ready);
      const f = $("#ultFillField");
      if (f) f.style.width = pct + "%";
      const sub = $("#ultSubField");
      if (sub) sub.textContent = ready ? "게이지 100% · 탭해서 발동!" : "게이지 " + pct + "% · 공격·피격으로 충전";
    }
    const bb = $("#btnUlt");
    if (bb) {
      bb.disabled = !ready || busy;
      bb.classList.toggle("ready", ready);
      const f = $("#ultFill");
      if (f) f.style.width = pct + "%";
      const sub = $("#ultSub");
      if (sub) sub.textContent = ready ? "게이지 100% · " + ult.short : "게이지 " + pct + "% · 공격·피격으로 충전";
    }
  }

  /* ------------------------------------------------------- 상단 미션(퀘스트) */
  function questData() {
    if (!S.quest) S.quest = { idx: 0, prog: 0, done: false };
    return G.questTemplate(S.quest.idx || 0);
  }
  function questAdd(kind, n, mode) {
    if (!S || !S.quest || S.quest.done) return;
    const t = questData();
    if (t.kind !== kind) return;
    S.quest.prog = mode === "max" ? Math.max(S.quest.prog, n) : S.quest.prog + n;
    if (S.quest.prog >= t.target) {
      S.quest.prog = t.target;
      S.quest.done = true;
      sfx("quest");
      toast("미션 완료! 상단에서 보상을 받으세요", "gold");
    }
    renderQuest();
  }
  function questClaim() {
    if (!S.quest || !S.quest.done) return;
    const t = questData();
    G.giveReward(t.reward);
    S.stats.quests = (S.stats.quests || 0) + 1;
    toast("미션 보상 · " + t.rewardText, "gold");
    sfx("levelup");
    haptic(12);
    S.quest = { idx: (S.quest.idx || 0) + 1, prog: 0, done: false };
    // 다음 미션 자동 연결 — 이미 달성 중이면 즉시 완료 처리
    renderQuest();
    renderHud();
    save();
  }
  function renderQuest() {
    const bar = $("#questBar");
    if (!bar) return;
    const t = questData();
    const show = tab === "field" || tab === "dungeon";
    bar.classList.toggle("on", show);
    bar.classList.toggle("done", !!S.quest.done);
    const ic = $("#qbIcon");
    if (ic) ic.textContent = t.icon;
    const tx = $("#qbText");
    if (tx) tx.textContent = t.text;
    const pr = $("#qbProg");
    if (pr) pr.textContent = Math.min(S.quest.prog, t.target) + " / " + t.target;
    const rw = $("#qbReward");
    if (rw) rw.textContent = t.rewardText;
    const btn = $("#btnQuest");
    if (btn) {
      btn.textContent = S.quest.done ? "보상 받기" : "진행 중";
      btn.disabled = !S.quest.done;
    }
  }

  /* ------------------------------------------------------- 돌발 이벤트 태그 */
  let eventTagTimer = null;
  function showEventTag(text, kind) {
    const el = $("#eventTag");
    if (!el) return;
    el.textContent = text;
    el.className = "event-tag on" + (kind ? " " + kind : "");
    clearTimeout(eventTagTimer);
    eventTagTimer = setTimeout(() => el.classList.remove("on"), 2800);
  }

  /* ------------------------------------------------------------ modal core */
  let modalEl = null;
  function closeModal() {
    const root = $("#modal-root");
    root.classList.remove("on");
    root.innerHTML = "";
    modalEl = null;
  }
  function openModal(opt) {
    const root = $("#modal-root");
    root.innerHTML = "";
    const m = document.createElement("div");
    m.className = "modal";
    let html = "";
    if (opt.icon) html += '<div class="m-icon">' + opt.icon + "</div>";
    html += "<h2>" + opt.title + "</h2>";
    if (opt.sub) html += '<div class="m-sub">' + opt.sub + "</div>";
    html += '<div class="m-body"></div>';
    html += '<div class="m-btns"></div>';
    m.innerHTML = html;
    if (opt.bodyHTML) m.querySelector(".m-body").innerHTML = opt.bodyHTML;
    if (opt.body) m.querySelector(".m-body").appendChild(opt.body);
    const btns = m.querySelector(".m-btns");
    const makeBtn = (b) => {
      const btn = document.createElement("button");
      btn.className = "btn " + (b.cls || "ghost") + (b.full ? " block" : "");
      btn.innerHTML = b.label;
      btn.onclick = () => {
        if (b.keepOpen !== true) closeModal();
        if (b.onClick) b.onClick();
      };
      return btn;
    };
    if (opt.rows) {
      opt.rows.forEach((row) => {
        const r = document.createElement("div");
        r.className = "row";
        row.forEach((b) => r.appendChild(makeBtn(b)));
        btns.appendChild(r);
      });
    }
    (opt.buttons || []).forEach((b) => btns.appendChild(makeBtn(b)));
    root.appendChild(m);
    root.classList.add("on");
    modalEl = m;
    return m;
  }
  function openModalRows(opt) {
    const root = $("#modal-root");
    root.innerHTML = "";
    const m = document.createElement("div");
    m.className = "modal";
    let html = "";
    if (opt.icon) html += '<div class="m-icon">' + opt.icon + "</div>";
    html += "<h2>" + opt.title + "</h2>";
    if (opt.sub) html += '<div class="m-sub">' + opt.sub + "</div>";
    html += '<div class="m-body"></div><div class="m-btns"></div>';
    m.innerHTML = html;
    if (opt.bodyHTML) m.querySelector(".m-body").innerHTML = opt.bodyHTML;
    const btns = m.querySelector(".m-btns");
    (opt.rows || []).forEach((row) => {
      const r = document.createElement("div");
      r.className = "row";
      row.forEach((b) => {
        const btn = document.createElement("button");
        btn.className = "btn " + (b.cls || "ghost");
        btn.innerHTML = b.label;
        btn.onclick = () => {
          if (b.keepOpen !== true) closeModal();
          if (b.onClick) b.onClick();
        };
        r.appendChild(btn);
      });
      btns.appendChild(r);
    });
    root.appendChild(m);
    root.classList.add("on");
    modalEl = m;
    return m;
  }
  $("#modal-root").addEventListener("click", (e) => {
    if (e.target.id === "modal-root") closeModal();
  });

  /* ------------------------------------------------------------ 공주 닉네임 */
  const DEFAULT_NAME = "서쟈";
  function playerName() {
    const st = G.getState && G.getState();
    const n = st ? st.playerName || st.name : null;
    return typeof n === "string" && n.trim() ? n.trim().slice(0, 10) : DEFAULT_NAME;
  }
  G.playerName = playerName;
  G.DEFAULT_NAME = DEFAULT_NAME;
  G.setPlayerName = function (raw) {
    const nm = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim().slice(0, 10) || DEFAULT_NAME;
    const st = G.getState();
    if (!st) return nm;
    st.playerName = nm;
    st.name = nm;
    if (S) {
      renderHud();
      save();
    }
    return nm;
  };

  /* --------------------------------------------------------------- 타이틀 */
  // 오프닝(타이틀·컷신·닉네임) 동안에는 게임 루프를 멈춘다 — intro.js 가 해제
  G.titleActive = true;

  /* ------------------------------------------------------------------ HUD */
  function renderHud() {
    const hpPct = clamp((S.hp / stats.maxHp) * 100, 0, 100);
    $("#hudLv").textContent = S.lv;
    const hudName = $("#hudName");
    if (hudName) {
      const nm = playerName();
      hudName.textContent = nm;
      hudName.classList.toggle("long", nm.length > 6);
    }
    const job = G.job(S.job);
    $("#hudTitle").textContent = job.short + " · " + titleFor(S.lv);
    $("#hudHpFill").style.width = hpPct.toFixed(1) + "%";
    $("#hudHpText").textContent = Math.ceil(Math.max(0, S.hp)) + " / " + stats.maxHp;
    $("#hudHpBar").classList.toggle("low", hpPct < 30);
    const need = G.expNeed(S.lv);
    $("#hudExpFill").style.width = clamp((S.exp / need) * 100, 0, 100).toFixed(1) + "%";
    $("#hudGold").textContent = fmt(S.gold);
    $("#hudGem").textContent = fmt(S.gems);
    $("#hudDc").textContent = fmt(S.dc);
    const dc2 = $("#hudDc2");
    if (dc2) dc2.textContent = fmt(S.dc);
  }

  function renderAvatar() {
    const cv = $("#avatarCv");
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, cv.width, cv.height);
    const spr = G.jobSprite(S.job, 5);
    if (spr) {
      // 공주 상반신 크롭 (티아라 ~ 어깨)
      const sh = Math.round(spr.height * 0.63);
      const sw = Math.round(spr.width * 0.84);
      const sx = Math.round((spr.width - sw) / 2);
      g.drawImage(spr, sx, 0, sw, sh, 0, 0, cv.width, cv.height);
    }
  }

  function renderSound() {
    const b = $("#btnSound");
    if (!b) return;
    const on = S.sound !== false;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.setAttribute("title", on ? "사운드 끄기" : "사운드 켜기");
  }

  /* --------------------------------------------------------------- 사냥터 */
  function petColor(pet) {
    const r = pet && pet.rarity !== undefined ? pet.rarity : 2;
    return ["#cfe8ff", "#cfe8ff", "#8fe0ff", "#ffd479", "#ff7ae0"][r] || "#cfe8ff";
  }

  const Field = {
    mob: null,
    atkTimer: 0,
    mobTimer: 0,
    respawn: 0,
    spawnDelay: 0,
    clearBanner: 0,
    paused: false,
    petTimer: 0,
    petCount: 0,
    buffT: 0,

    stage() {
      return G.STAGES[Math.min(S.stage, G.STAGES.length) - 1];
    },

    mobKey() {
      return G.pick(this.stage().mobs);
    },

    setStage(n) {
      n = clamp(n, 1, S.maxStage);
      if (n === S.stage) return;
      S.stage = n;
      S.kills = 0;
      this.mob = null;
      this.spawnDelay = 0.25;
      fieldScene.setTheme(this.stage().theme, 1000 + n * 37);
      this.spawn();
      renderField();
      save();
    },

    spawn() {
      // 돌발 이벤트: 가끔 황금 고블린이 나타난다 (도망치기 전에 처치!)
      const golden = Math.random() < 0.055;
      const key = golden ? "goblin" : this.mobKey();
      const m = G.MOBS[key];
      const hp = golden ? Math.max(12, Math.round(G.fieldMobHp(S.stage, key) * 0.55)) : G.fieldMobHp(S.stage, key);
      this.mob = {
        key,
        name: golden ? "황금 고블린" : m.name,
        hp,
        maxHp: hp,
        atk: G.fieldMobAtk(S.stage, key),
        interval: m.interval,
        atkTimer: m.interval * 0.8,
        golden,
        escape: golden ? 9 : 0,
      };
      const sc = fieldScene.enemy;
      sc.key = m.sprite;
      sc.scale = Math.round(m.scale * 1.35 * 10) / 10;
      sc.name = this.mob.name;
      sc.hp = hp;
      sc.maxHp = hp;
      sc.spawn = 1;
      sc.alpha = 1;
      sc.boss = false;
      sc.elite = golden;
      sc.tint = golden ? G.GOLD_TINT : null;
      sc.showBar = true;
      sc.knock = 0;
      this.mobTimer = 0;
      if (golden) {
        showEventTag("🌟 황금 고블린 출현! 9초 안에 처치", "gold");
        sfx("goldgoblin");
        fieldScene.text(52, fieldScene.groundY - 100, "GOLD! 9s", "#ffd479", 14);
      }
      renderField();
    },

    dmgMul() {
      let mul = 1;
      if (this.buffT > 0) mul *= 1.18;
      if (this.mob && this.mob.defDownT > 0) mul *= 1.18;
      return mul;
    },

    attack() {
      const m = this.mob;
      if (!m || m.hp <= 0) return;
      const crit = Math.random() * 100 < stats.crit;
      let dmg = stats.atk * (0.92 + Math.random() * 0.16) * Combo.atkMul() * this.dmgMul();
      if (crit) dmg *= stats.critDmg / 100;
      dmg = Math.max(1, Math.round(dmg));
      m.hp -= dmg;
      fieldScene.hero.lunge = 1;
      fieldScene.arcs(
        fieldScene.hero.x + 16,
        fieldScene.groundY - 40,
        fieldScene.enemy.x - 14,
        fieldScene.groundY - 30,
        crit ? "#ffe08a" : "#dff3ff",
        crit ? 4 : 2
      );
      sfx(crit ? "crit" : "hit");
      const ex = fieldScene.enemy.x + rnd(-6, 6);
      const ey = fieldScene.groundY - (crit ? 46 : 26) + rnd(-4, 4);
      fieldScene.damage(ex, ey, dmg, crit);
      fieldScene.enemy.flash = 1;
      fieldScene.enemy.hurt = 0.25;
      fieldScene.enemy.knock = 1;
      fieldScene.enemy.knockDir = 1;
      if (crit) {
        fieldScene.shakeAdd(9);
        fieldScene.hitStop(0.058);
        fieldScene.screenFlash("255,236,170", 0.18);
        fieldScene.critBurst(ex, ey, "#ffe08a");
        haptic(18);
        questAdd("crit", 1);
      } else {
        fieldScene.shakeAdd(3.4);
        fieldScene.hitStop(0.018);
        fieldScene.burst(ex, ey, "#dfefff", 5, 60);
      }
      Combo.add();
      ultGain(crit ? 9 : 6);
      if (m.hp <= 0) this.kill();
    },

    kill() {
      const m = this.mob;
      this.mob = null;
      S.kills++;
      S.totalKills = (S.totalKills || 0) + 1;
      questAdd("kill", 1);
      ultGain(8);
      const buffMul = Date.now() < buffUntil ? 2 : 1;
      const golden = !!(m && m.golden);
      let gold = Math.round(G.fieldGold(S.stage) * stats.goldMul * buffMul * Combo.goldMul() * (0.9 + Math.random() * 0.2));
      if (golden) {
        gold *= 8;
        const gems = 3 + Math.floor(Math.random() * 5);
        S.gems += gems;
        S.stats.goldGoblins = (S.stats.goldGoblins || 0) + 1;
        fieldScene.text(fieldScene.enemy.x, fieldScene.groundY - 108, "💎 보석 +" + gems, "#57e0c4", 14, 1.4);
        toast("황금 고블린 처치! 골드 +" + fmt(gold) + " · 보석 +" + gems, "gold");
        sfx("quest");
      }
      const exp = Math.round(G.fieldExp(S.stage) * buffMul * (golden ? 3 : 1));
      S.gold += gold;
      fieldScene.enemy.dead = 1;
      fieldScene.enemy.alpha = 0.9;
      fieldScene.burst(fieldScene.enemy.x, fieldScene.groundY - 26, golden ? "#ffd479" : "#ffd479", golden ? 26 : 14, golden ? 170 : 110);
      fieldScene.damage(fieldScene.enemy.x - 34, fieldScene.groundY - 40, gold, false, "#ffd479");
      fieldScene.coins(Math.min(8, 2 + Math.floor(gold / 40)), fieldScene.enemy.x, fieldScene.groundY - 30);
      if (golden) fieldScene.hitStop(0.06);
      G.addExp(exp);
      sfx("coin");
      // 드랍 — 사냥터는 골드·경험치·일반~고급 장비 위주
      if (golden || Math.random() < 0.085) {
        const it = G.rollItem(S.stage, G.fieldDropRarity(S.stage));
        G.addItem(it);
        const rar = G.RARITY[it.rarity];
        fieldScene.text(fieldScene.enemy.x + 10, fieldScene.groundY - 88, rar.name + " " + it.name, rar.color, 12.5);
        sfx("drop");
        bagDot(true);
        if (S.inv.length <= 60) renderBag();
      } else if (Math.random() < 0.05 && S.pots < 9) {
        S.pots++;
        fieldScene.text(fieldScene.enemy.x, fieldScene.groundY - 76, "포션 +1", "#7bffa0", 12);
      }
      if (S.kills >= G.KILLS_PER_STAGE) {
        this.clearStage();
      } else {
        this.spawnDelay = golden ? 0.9 : 0.5;
      }
      renderHud();
      renderField();
      maybeDot();
    },

    clearStage() {
      const el = $("#stageClear");
      el.querySelector("span").textContent = S.stage >= G.STAGES.length ? "MAX STAGE!" : "STAGE CLEAR!";
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 1100);
      fieldScene.ring(fieldScene.hero.x, fieldScene.groundY - 30, "#ffe9a8");
      S.kills = 0;
      if (S.stage >= G.STAGES.length) {
        this.spawnDelay = 1.2;
        renderField();
        return;
      }
      const next = S.stage + 1;
      if (S.auto) {
        setTimeout(() => {
          if (next > S.maxStage) {
            S.maxStage = next;
            toast("새로운 사냥터 개방 · " + G.STAGES[next - 1].name, "gold");
          }
          if (S.stage === next - 1) this.setStage(next);
        }, 950);
      } else {
        if (next > S.maxStage) S.maxStage = next;
        renderField();
        toast("스테이지 클리어! 자동 진행이 꺼져 있습니다");
      }
      save();
    },

    playerDown() {
      this.respawn = 4;
      fieldScene.hero.dead = 0;
      fieldScene.hero.alpha = 0.55;
      toast("쓰러졌습니다 · 4초 후 부활", "ad");
    },

    update(dt) {
      if (this.paused) return;
      if (this.respawn > 0) {
        this.respawn -= dt;
        if (this.respawn <= 0) {
          S.hp = stats.maxHp * 0.6;
          fieldScene.hero.alpha = 1;
          fieldScene.hero.dead = 0;
          fieldScene.ring(fieldScene.hero.x, fieldScene.groundY - 30, "#8fd8ff");
          renderHud();
        }
        return;
      }
      // 체력 자연 회복
      if (S.hp < stats.maxHp) {
        S.hp = Math.min(stats.maxHp, S.hp + stats.maxHp * 0.01 * dt);
        if (Math.random() < dt * 6) renderHud();
      }
      if (!this.mob) {
        this.spawnDelay -= dt;
        if (this.spawnDelay <= 0) this.spawn();
        return;
      }
      const m = this.mob;
      // 황금 고블린은 제한 시간이 지나면 도망간다
      if (m.golden && m.escape > 0) {
        m.escape -= dt;
        if (m.escape <= 0) {
          this.mob = null;
          fieldScene.enemy.alpha = 0;
          fieldScene.text(fieldScene.enemy.x, fieldScene.groundY - 70, "도망쳤다!", "#9a93b8", 14);
          showEventTag("황금 고블린을 놓쳤습니다…", "mimic");
          this.spawnDelay = 0.8;
          renderField();
          return;
        }
      }
      this.atkTimer -= dt;
      if (this.atkTimer <= 0) {
        this.atkTimer = 1 / stats.aspd;
        this.attack();
      }
      if (!this.mob) return;
      // 동행 펫의 추가 공격
      const pet = stats.pet;
      if (pet && pet.id) {
        this.petTimer -= dt;
        if (this.petTimer <= 0) {
          this.petTimer = Math.max(1.1, pet.every || 3);
          this.petAttack();
          if (!this.mob) return;
        }
      }
      if (this.buffT > 0) this.buffT -= dt;
      if (m.defDownT > 0) m.defDownT -= dt;
      this.mobTimer += dt;
      if (this.mobTimer >= m.interval) {
        this.mobTimer = 0;
        this.hitPlayer(m);
      }
    },

    petAttack() {
      const m = this.mob;
      const pet = stats.pet;
      if (!pet || !pet.id || !m || m.hp <= 0) return;
      const dmg = Math.max(1, Math.round(stats.atk * pet.hit));
      m.hp -= dmg;
      fieldScene.petStrike(fieldScene.enemy.x, fieldScene.groundY - 34, petColor(pet));
      sfx("petHit");
      fieldScene.damage(fieldScene.enemy.x + rnd(-12, 6), fieldScene.groundY - 18, dmg, false, petColor(pet));
      fieldScene.enemy.flash = 1;
      this.petCount++;
      if (this.petCount % 3 === 0) this.petSkill();
      ultGain(2);
      if (m.hp <= 0) this.kill();
    },

    petSkill() {
      const pet = stats.pet;
      const sk = pet && pet.skill ? G.PET_SKILLS[pet.skill] : null;
      if (!sk || !this.mob) return;
      sfx("petSkill");
      if (pet.skill === "heal") {
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + Math.round(stats.maxHp * 0.06 * (1 + pet.rank * 0.2)));
        fieldScene.text(fieldScene.hero.x, fieldScene.groundY - 86, "+" + Math.round(S.hp - before), "#7bffa0", 14);
        fieldScene.burst(fieldScene.hero.x, fieldScene.groundY - 30, "#7bffa0", 12, 70);
      } else if (pet.skill === "burn") {
        this.mob.hp -= Math.max(1, Math.round(stats.atk * 0.5));
        fieldScene.embers(fieldScene.enemy.x, fieldScene.groundY - 26, 14, 120);
        fieldScene.text(fieldScene.enemy.x, fieldScene.groundY - 70, "화상!", "#ff8a3d", 12.5);
      } else if (pet.skill === "defDown") {
        this.mob.defDownT = 6;
        fieldScene.text(fieldScene.enemy.x, fieldScene.groundY - 70, "방어 ↓", "#ffd479", 12.5);
      } else if (pet.skill === "atkBuff") {
        this.buffT = 8;
        fieldScene.text(fieldScene.hero.x, fieldScene.groundY - 70, "공격 ↑", "#8fe0ff", 12.5);
        fieldScene.ring(fieldScene.hero.x, fieldScene.groundY - 30, "#8fe0ff");
      }
      fieldScene.text(fieldScene.hero.x - 20, fieldScene.groundY - 104, "🐾 " + sk.name, "#cfe8ff", 11, 1.2);
    },

    hitPlayer(m) {
      let dmg = Math.max(1, Math.round(m.atk * (0.9 + Math.random() * 0.2) - stats.def * 0.5));
      S.hp -= dmg;
      sfx("hurt");
      fieldScene.hero.hurt = 1;
      fieldScene.hurtFlash = 1;
      fieldScene.damage(fieldScene.hero.x + 26 + rnd(-4, 4), fieldScene.groundY - 44, dmg, false, "#ff8a7a");
      fieldScene.shakeAdd(5);
      Combo.reset();
      ultGain(5);
      if (S.hp <= 0) {
        S.hp = 0;
        this.playerDown();
      }
      renderHud();
    },

    /* ---------------- 사냥터 궁극기 ---------------- */
    fireUlt() {
      if (!ultReady()) return;
      // 적이 없는 순간(리스폰 대기)에 눌렀다면 즉시 불러와서 내리친다
      if (!this.mob || this.mob.hp <= 0) {
        this.spawnDelay = 0;
        this.spawn();
      }
      const m = this.mob;
      if (!m) return;
      S.ult = 0;
      S.stats.ults = (S.stats.ults || 0) + 1;
      const job = G.job(S.job);
      const ult = job.ult;
      const ex = fieldScene.enemy.x;
      const ey = fieldScene.groundY - 34;
      fieldScene.ultFx(ex, ey, ult.style);
      fieldScene.hero.lunge = 1;
      sfx(ult.sfx || "ult");
      haptic([0, 28, 40, 70]);
      let dmg = Math.round(stats.atk * ult.mult + stats.maxHp * (ult.hpScale || 0));
      if (ult.lowHpBonus) dmg += Math.round(stats.atk * ult.lowHpBonus * (1 - S.hp / stats.maxHp));
      m.hp -= dmg;
      const before = S.hp;
      S.hp = Math.min(stats.maxHp, S.hp + Math.round(stats.maxHp * (ult.heal || 0)));
      fieldScene.damage(ex, ey, dmg, true);
      if (S.hp > before) fieldScene.text(fieldScene.hero.x, fieldScene.groundY - 72, "+" + (S.hp - before), "#7bffa0", 15);
      Combo.add();
      renderUlt();
      renderHud();
      if (m.hp <= 0) this.kill();
      renderField();
    },
  };

  /* --------------------------------------------------------------- 사냥터 UI */
  function renderField() {
    const st = Field.stage();
    $("#stageName").innerHTML = "<em>STAGE " + String(S.stage).padStart(2, "0") + "</em>" + st.name;
    const mobName = Field.mob ? Field.mob.name : G.MOBS[st.mobs[0]].name;
    $("#stageSub").textContent = mobName + " · 처치 " + S.kills + " / " + G.KILLS_PER_STAGE;
    $("#killText").textContent = "처치 " + S.kills + "/" + G.KILLS_PER_STAGE;
    $("#killFill").style.width = ((S.kills / G.KILLS_PER_STAGE) * 100).toFixed(0) + "%";
    $("#chipAtk").textContent = fmt(stats.atk);
    $("#chipCrit").textContent = stats.crit.toFixed(1) + "%";
    $("#chipAspd").textContent = stats.aspd.toFixed(2);
    $("#badgeStage").innerHTML = "STAGE <b>" + S.stage + "</b>";
    $("#badgeDps").innerHTML = "DPS <b>" + fmt(stats.dps) + "</b>";
    $("#stagePrev").disabled = S.stage <= 1;
    $("#stageNext").disabled = S.stage >= S.maxStage;
    $("#btnAuto").classList.toggle("on", S.auto);
    $("#btnAuto").innerHTML = "자동<br />진행 " + (S.auto ? "ON" : "OFF");
    const buffOn = Date.now() < buffUntil;
    const bd = $("#btnDouble");
    if (buffOn) {
      const left = Math.ceil((buffUntil - Date.now()) / 1000);
      bd.innerHTML = '<span class="ad-ico">2X</span> 보상 2배 적용 중 · ' + left + "초";
      bd.disabled = true;
    } else {
      bd.innerHTML = '<span class="ad-ico">AD</span> 광고 보고 90초간 보상 2배';
      bd.disabled = false;
    }
  }

  /* ---------------------------------------------------------------- 던전 */
  const Dungeon = {
    active: false,
    floorIdx: 0,
    wave: 0,
    turn: 1,
    enemy: null,
    intent: null,
    cds: { s1: 0, s2: 0 },
    busy: false,
    guarding: false,
    burn: 0,
    burnDmg: 0,
    freeze: 0,
    shadow: 0,
    shadowMult: 0.65,
    atkBuff: 0,
    atkBuffMul: 1.18,
    lifestealBuff: 0,
    defDown: 0,
    petTurn: 0,
    petCount: 0,
    rush: false,
    rushLv: 0,
    runPotions: 0,
    logLines: [],
    auto: true,
    autoTimer: null,
    loot: [],
    bossLoot: [],
    lootTimer: null,
    shield: 0,
    shieldMax: 0,
    patternIdx: 0,

    floor() {
      return G.FLOORS[this.floorIdx];
    },

    start(idx) {
      const f = G.FLOORS[idx];
      const fs = G.floorState(idx);
      if (!fs.unlocked) {
        toast("이전 층을 먼저 클리어하세요");
        return;
      }
      this.floorIdx = idx;
      this.active = true;
      this.rush = false;
      this.rushLv = 0;
      Field.paused = true;
      this.wave = 0;
      this.turn = 1;
      this.cds = { s1: 0, s2: 0 };
      this.burn = 0;
      this.freeze = 0;
      this.shadow = 0;
      this.atkBuff = 0;
      this.atkBuffMul = 1.18;
      this.lifestealBuff = 0;
      this.defDown = 0;
      this.petTurn = 0;
      this.petCount = 0;
      this.busy = false;
      this.guarding = false;
      this.logLines = [];
      this.runPotions = 0;
      this.loot = [];
      this.bossLoot = [];
      this.shield = 0;
      this.shieldMax = 0;
      this.patternIdx = 0;
      this.auto = S.autoBattle !== false;
      clearTimeout(this.autoTimer);
      Combo.reset(true);
      S.hp = stats.maxHp;
      if (tab !== "dungeon") switchTab("dungeon");
      const dview = $("#view-dungeon");
      if (dview) dview.scrollTop = 0;
      $("#battle").classList.add("on");
      requestAnimationFrame(() => battleScene.resize());
      battleScene.setTheme(f.theme, 900 + idx * 37);
      battleScene.enemy.tint = G.chapterTint(f.chapterIdx);
      battleScene.enemy.scale = 4.1;
      this.spawnWave();
      this.log("sys", "던전 입장 · " + f.chapter + " " + f.floor + "층 · " + f.name);
      bgm("dungeon");
      renderBattle();
      renderHud();
    },

    /* ---------------- 무한의 시련 (보스 러시) ---------------- */
    startRush() {
      this.floorIdx = 0;
      this.active = true;
      this.rush = true;
      this.rushLv = 0;
      this.wave = 99;
      this.turn = 1;
      this.cds = { s1: 0, s2: 0 };
      this.burn = 0;
      this.freeze = 0;
      this.shadow = 0;
      this.atkBuff = 0;
      this.atkBuffMul = 1.18;
      this.lifestealBuff = 0;
      this.defDown = 0;
      this.petTurn = 0;
      this.petCount = 0;
      this.busy = false;
      this.guarding = false;
      this.shield = 0;
      this.shieldMax = 0;
      this.patternIdx = 0;
      this.auto = S.autoBattle !== false;
      this.logLines = [];
      this.loot = [];
      Field.paused = true;
      clearTimeout(this.autoTimer);
      Combo.reset(true);
      S.hp = stats.maxHp;
      if (tab !== "dungeon") switchTab("dungeon");
      const dview = $("#view-dungeon");
      if (dview) dview.scrollTop = 0;
      $("#battle").classList.add("on");
      requestAnimationFrame(() => battleScene.resize());
      sfx("rush");
      this.log("sys", "⚔️ <b>무한의 시련</b> 시작 — 끝없는 보스 행렬");
      this.spawnRushWave();
      bgm("dungeon");
      renderBattle();
      renderHud();
    },

    spawnRushWave() {
      const lv = this.rushLv;
      const f = G.FLOORS[lv % G.FLOORS.length];
      this.floorIdx = lv % G.FLOORS.length;
      const hp = Math.round(f.boss.hp * Math.pow(1.24, lv));
      const atk = Math.round(f.boss.atk * Math.pow(1.17, lv));
      const name = (lv >= 20 ? "심연의 " : "") + f.boss.name + (lv >= 10 ? " Lv." + (lv + 1) : "");
      this.shield = 0;
      this.shieldMax = Math.round(f.boss.shield * (1 + lv * 0.3));
      this.patternIdx = 0;
      this.enemy = {
        key: f.boss.key,
        name: name,
        hp: hp,
        maxHp: hp,
        atk: atk,
        boss: true,
        elite: false,
        mimic: false,
        golden: false,
        enraged: false,
        flash: 0,
        pattern: f.boss.pattern,
      };
      const sc = battleScene.enemy;
      sc.key = G.MOBS[f.boss.key].sprite;
      sc.name = name;
      sc.scale = 5.2;
      sc.hp = hp;
      sc.maxHp = hp;
      sc.spawn = 1;
      sc.alpha = 1;
      sc.boss = true;
      sc.elite = false;
      sc.showBar = false;
      sc.tint = G.chapterTint(f.chapterIdx);
      sc.shield = 0;
      sc.shieldMax = this.shieldMax;
      sc.knock = 0;
      sc.knockDir = 1;
      battleScene.setTheme(f.theme, 1200 + lv * 53);
      battleScene.enemy.tint = G.chapterTint(f.chapterIdx);
      this.intent = this.makeIntent();
      this.log("sys", "🔥 <b>" + (lv + 1) + "번째 시련</b> · " + name);
      sfx("boss");
      battleScene.shakeAdd(12);
      battleScene.screenFlash("255,120,90", 0.3);
      renderBattle();
      this.maybeAuto(820);
    },

    rushKill() {
      const lv = this.rushLv;
      const f = this.floor();
      const gold = Math.round(f.reward.gold * (1.25 + lv * 0.18));
      const gems = 2 + Math.floor(lv / 2);
      const dc = 3 + lv;
      S.gold += gold;
      S.gems += gems;
      S.dc += dc;
      this.rushLv++;
      S.rushBest = Math.max(S.rushBest || 0, this.rushLv);
      S.stats.rushBoss = (S.stats.rushBoss || 0) + 1;
      let shardTxt = "";
      if (this.rushLv % 5 === 0) {
        S.shards = (S.shards || 0) + 25;
        shardTxt = " · 펫 조각 +25";
      }
      battleScene.burst(battleScene.enemy.x, battleScene.groundY - 30, "#ffd479", 26, 190);
      battleScene.text(battleScene.enemy.x, battleScene.groundY - 100, "시련 돌파 " + this.rushLv + "!", "#ffd479", 16, 1.4);
      this.log("loot", "시련 " + this.rushLv + " 돌파 · 골드 <b>+" + fmt(gold) + "</b> · 보석 <b>+" + gems + "</b> · 코인 <b>+" + dc + "</b>" + shardTxt);
      sfx("clear");
      haptic(20);
      save();
      renderHud();
      setTimeout(() => {
        if (!this.active || !this.rush) return;
        this.spawnRushWave();
      }, 900);
    },

    /* ---------------- 웨이브 / 엘리트 / 미믹 ---------------- */
    spawnWave() {
      const f = this.floor();
      const isBoss = this.wave >= f.waves;
      let key, name, hp, atk, elite = false, mimic = false, golden = false;
      this.shield = 0;
      this.shieldMax = 0;
      if (isBoss) {
        key = f.boss.key;
        name = f.boss.name;
        hp = f.boss.hp;
        atk = f.boss.atk;
        this.patternIdx = 0;
        this.shieldMax = f.boss.shield;
      } else {
        key = G.pick(f.mobs);
        name = G.MOBS[key].name;
        hp = Math.round(f.hp * (1 + this.wave * 0.16));
        atk = Math.round(f.atk * (1 + this.wave * 0.06));
        // 중간 엘리트 몬스터 (3층 이상, 웨이브 중간)
        if (f.floor >= 3 && this.wave === Math.floor(f.waves / 2)) {
          elite = true;
          hp = Math.round(hp * 1.9);
          atk = Math.round(atk * 1.25);
          name = "★ 정예 " + name;
        }
        // 돌발 미믹 보물상자 · 황금 고블린
        if (!elite && this.wave > 0 && Math.random() < 0.09) {
          mimic = true;
          key = "mimic";
          name = "미믹 보물상자";
          hp = Math.max(20, Math.round(f.hp * 0.8));
          atk = Math.round(f.atk * 1.1);
        } else if (!elite && Math.random() < 0.035) {
          golden = true;
          key = "goblin";
          name = "황금 고블린";
          hp = Math.max(25, Math.round(f.hp * 0.6));
          atk = Math.round(f.atk * 1.15);
        }
      }
      this.enemy = {
        key,
        name,
        hp,
        maxHp: hp,
        atk,
        boss: isBoss,
        elite,
        mimic,
        golden,
        enraged: false,
        flash: 0,
        pattern: isBoss ? f.boss.pattern : null,
      };
      const sc = battleScene.enemy;
      sc.key = G.MOBS[key].sprite;
      sc.name = isBoss || elite || mimic ? name : "";
      sc.scale = isBoss ? 5.2 : elite ? 4.8 : mimic ? 4.4 : 4.0;
      sc.hp = hp;
      sc.maxHp = hp;
      sc.spawn = 1;
      sc.alpha = 1;
      sc.boss = isBoss;
      sc.elite = elite || golden;
      sc.showBar = false;
      sc.tint = golden ? G.GOLD_TINT : mimic ? G.GOLD_TINT : elite ? G.ELITE_TINT : G.chapterTint(f.chapterIdx);
      sc.shield = 0;
      sc.shieldMax = isBoss ? this.shieldMax : 0;
      sc.knock = 0;
      sc.knockDir = 1;
      this.intent = this.makeIntent();
      if (isBoss) {
        this.log("sys", "보스 등장! <b>" + name + "</b>");
        sfx("boss");
        battleScene.shakeAdd(10);
        battleScene.screenFlash("255,120,90", 0.28);
      } else if (elite) {
        this.log("sys", "★ 정예 몬스터 출현 — <b>" + name + "</b>");
        sfx("elite");
        showEventTag("★ 정예 출현 · 장비 드랍 2배", "elite");
      } else if (mimic) {
        this.log("sys", "미믹 보물상자! 장비를 토해냅니다");
        sfx("mimic");
        showEventTag("🎁 미믹 보물상자 · 장비 다량 드랍", "mimic");
      } else if (golden) {
        this.log("sys", "🌟 황금 고블린 출현! 골드·보석을 토해냅니다");
        sfx("goldgoblin");
        showEventTag("🌟 황금 고블린 · 골드 8배 · 보석 드랍", "gold");
      }
      renderBattle();
      this.maybeAuto(760);
    },

    makeIntent() {
      const e = this.enemy;
      if (!e) return { type: "attack", mult: 1, label: "공격" };
      if (e.boss && e.pattern && e.pattern.length) {
        const seq = e.pattern;
        let t = seq[this.patternIdx % seq.length];
        this.patternIdx++;
        if (t === "shield" && this.shield > 0) t = "heavy";
        if (t === "shield") return { type: "shield", mult: 0, label: "방어막 전개" };
        if (t === "combo") {
          const hits = this.floor().boss.combo || 2;
          return { type: "combo", mult: 0.62, hits: hits, label: "연속 강타 " + hits + "연격" };
        }
        if (t === "heavy") return { type: "heavy", mult: e.enraged ? 2.0 : 1.75, label: "강타" };
        if (t === "buff") return { type: "buff", mult: 0, label: "기 합성" };
        return { type: "attack", mult: 1, label: "베기" };
      }
      const heavyChance = e.elite ? 0.42 : 0.3;
      if (Math.random() < heavyChance) {
        return { type: "heavy", mult: e.elite ? 1.6 : 1.5, label: "강타" };
      }
      return { type: "attack", mult: 1, label: "베기" };
    },

    log(kind, text) {
      const el = $("#bLog");
      const p = document.createElement("p");
      if (kind === "dmg") p.className = "hl";
      else if (kind === "crit") p.className = "crit";
      else if (kind === "heal") p.className = "heal";
      else if (kind === "loot") p.className = "loot";
      else if (kind === "sys") p.className = "sys";
      p.innerHTML = text;
      el.appendChild(p);
      while (el.children.length > 40) el.removeChild(el.firstChild);
      el.scrollTop = el.scrollHeight;
    },

    playerDamage(mult) {
      const crit = Math.random() * 100 < stats.crit;
      let dmg = stats.atk * mult * (0.93 + Math.random() * 0.14) * Combo.atkMul();
      if (this.atkBuff > 0) dmg *= this.atkBuffMul;
      if (this.defDown > 0) dmg *= 1.18;
      if (this.enemy && this.enemy.boss && stats.bossDmg > 0) dmg *= 1 + stats.bossDmg;
      if (crit) dmg *= stats.critDmg / 100;
      return { dmg: Math.max(1, Math.round(dmg)), crit };
    },

    // 방어막 흡수 → 본체 피해. 실제로 깎인 체력을 돌려준다.
    applyDamage(raw, crit) {
      const e = this.enemy;
      let left = raw;
      if (this.shield > 0) {
        const abs = Math.min(this.shield, left);
        this.shield -= abs;
        left -= abs;
        battleScene.text(battleScene.enemy.x - 26, battleScene.groundY - 62, "🛡 " + fmt(abs), "#8fd8ff", 13);
        if (this.shield <= 0) {
          this.shield = 0;
          battleScene.text(battleScene.enemy.x, battleScene.groundY - 92, "방어막 파괴!", "#bff0ff", 16, 1.2);
          battleScene.critBurst(battleScene.enemy.x, battleScene.groundY - 40, "#8fd8ff");
          battleScene.hitStop(0.055);
          battleScene.shakeAdd(13);
          battleScene.screenFlash("160,220,255", 0.3);
          sfx("shieldBreak");
          haptic(20);
          this.log("crit", "보스의 <b>방어막을 파괴</b>했습니다!");
        } else {
          sfx("shield");
        }
      }
      e.hp = Math.max(0, e.hp - left);
      e.flash = 1;
      battleScene.enemy.flash = 1;
      battleScene.enemy.hurt = 0.3;
      battleScene.enemy.knock = 1;
      battleScene.enemy.knockDir = 1;
      return left;
    },

    skillOf(kind) {
      const list = G.jobSkills();
      return kind === "s1" ? list[0] : list[1];
    },

    act(kind) {
      if (!this.active || this.busy || !this.enemy || this.enemy.hp <= 0) return;
      if (kind === "ult") {
        this.fireUlt();
        return;
      }
      clearTimeout(this.autoTimer);
      const e = this.enemy;
      this.busy = true;
      this.guarding = false;
      battleScene.guardFx(false);
      let dmg = 0;
      let crit = false;
      let mult = 0;

      if (kind === "s1" || kind === "s2") {
        const sk = this.skillOf(kind);
        if (!sk) return (this.busy = false);
        if (this.cds[kind] > 0) return (this.busy = false);
        this.cds[kind] = sk.cd || 3;
        return this.castSkill(kind, sk);
      }

      if (kind === "attack") {
        const r = this.playerDamage(1);
        dmg = r.dmg;
        crit = r.crit;
        mult = 1;
        battleScene.hero.lunge = 1;
        battleScene.arcs(battleScene.hero.x + 18, battleScene.groundY - 46, battleScene.enemy.x - 18, battleScene.groundY - 34, crit ? "#ffe08a" : "#dff3ff", crit ? 4 : 2);
        sfx(crit ? "crit" : "hit");
      } else if (kind === "guard") {
        this.guarding = true;
        battleScene.guardFx(true);
        sfx("guard");
        this.log("sys", "방어 태세! 다음 공격 피해 70% 감소 + 반격");
        renderBattle();
        setTimeout(() => this.enemyTurn(), 320);
        return;
      } else if (kind === "potion") {
        if (S.pots <= 0) {
          this.log("sys", "포션이 없습니다");
          this.busy = false;
          renderBattle();
          this.maybeAuto(400);
          return;
        }
        S.pots--;
        this.runPotions++;
        const heal = Math.round(stats.maxHp * 0.45);
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + heal);
        battleScene.burst(battleScene.hero.x, battleScene.groundY - 26, "#7bffa0", 14, 70);
        battleScene.text(battleScene.hero.x, battleScene.groundY - 62, "+" + Math.round(S.hp - before), "#7bffa0", 16);
        sfx("potion");
        this.log("heal", "포션 사용 · 체력 <b>+" + Math.round(S.hp - before) + "</b>");
        renderHud();
        renderBattle();
        setTimeout(() => this.enemyTurn(), 380);
        return;
      }

      // --- 공격 적중 연출 ---
      const dealt = this.applyDamage(dmg, crit);
      battleScene.damage(battleScene.enemy.x + rnd(-8, 8), battleScene.groundY - 40, dmg, crit);
      if (crit) {
        battleScene.critBurst(battleScene.enemy.x, battleScene.groundY - 42, "#ffe08a");
        battleScene.screenFlash("255,236,170", 0.2);
        battleScene.hitStop(0.06);
        battleScene.shakeAdd(11);
        haptic(18);
        questAdd("crit", 1);
      } else {
        battleScene.hitStop(0.022);
        battleScene.shakeAdd(mult >= 2 ? 8 : 3);
      }
      this.log(crit ? "crit" : "dmg", (crit ? "치명타! " : "") + e.name + "에게 <b>" + fmt(dealt) + "</b> 피해");
      this.lifestealHeal(dealt);
      if (dealt > 0) Combo.add();
      ultGain(crit ? 9 : 6);
      renderBattle();
      this.checkEnrage();
      if (e.hp <= 0) {
        setTimeout(() => this.enemyDown(), 420);
        return;
      }
      setTimeout(() => this.enemyTurn(), 520);
    },

    /* ---------------- 직업 스킬 ---------------- */
    castSkill(kind, sk) {
      const e = this.enemy;
      const x = battleScene.enemy.x;
      const y = battleScene.groundY - 34;
      const hits = sk.hits || 1;
      let total = 0;
      let anyCrit = false;

      // 체력 소모형 (광전사)
      if (sk.selfHp) {
        const cost = Math.max(1, Math.round(S.hp * sk.selfHp));
        S.hp = Math.max(1, S.hp - cost);
        battleScene.damage(battleScene.hero.x, battleScene.groundY - 66, cost, false, "#ff6a5a");
        battleScene.hurtFlash = 0.6;
        this.log("sys", sk.name + " · 체력 <b>-" + cost + "</b> 소모");
      }

      battleScene.hero.lunge = 1;
      if (sk.effect === "healguard") {
        this.guarding = true;
        battleScene.guardFx(true);
        const heal = Math.round(stats.maxHp * (sk.heal || 0.25));
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + heal);
        battleScene.burst(battleScene.hero.x, battleScene.groundY - 30, "#7bffa0", 18, 90);
        battleScene.ring(battleScene.hero.x, battleScene.groundY - 34, "#ffe9a8");
        battleScene.text(battleScene.hero.x, battleScene.groundY - 66, "+" + Math.round(S.hp - before), "#7bffa0", 16);
        battleScene.text(battleScene.hero.x, battleScene.groundY - 94, "성역", "#ffe9a8", 14, 1.2);
        sfx(sk.sfx || "sanctuary");
        this.log("heal", "<b>" + sk.name + "</b> · 체력 <b>+" + Math.round(S.hp - before) + "</b> · 다음 공격 방어");
        renderHud();
        renderBattle();
        setTimeout(() => this.enemyTurn(), 420);
        return;
      }

      for (let i = 0; i < hits; i++) {
        const r = this.playerDamage(sk.mult || 1);
        const dealt = this.applyDamage(r.dmg, r.crit);
        total += dealt;
        anyCrit = anyCrit || r.crit;
        battleScene.damage(x + rnd(-8, 8), y + rnd(-4, 4), r.dmg, r.crit);
      }

      if (sk.effect === "holy") {
        battleScene.arcs(battleScene.hero.x + 18, battleScene.groundY - 52, x - 14, y, "#ffe9a8", 4);
        battleScene.screenFlash("255,240,190", 0.22);
        battleScene.shakeAdd(12);
        battleScene.hitStop(0.05);
        battleScene.burst(x, y, "#ffe9a8", 18, 150);
        battleScene.text(x, y - 34, sk.name + "!", "#ffe9a8", 15, 1.2);
      } else if (sk.effect === "multi") {
        battleScene.arcs(battleScene.hero.x + 18, battleScene.groundY - 46, x - 16, y, "#dff3ff", 3);
        battleScene.arcs(battleScene.hero.x + 18, battleScene.groundY - 36, x - 16, y + 8, "#dff3ff", 3);
        battleScene.shakeAdd(7);
        battleScene.text(x, y - 34, hits + "연타!", "#dff3ff", 14);
      } else if (sk.effect === "burn") {
        battleScene.embers(x, y, 26, 170);
        battleScene.burst(x, y, "#ff7a32", 18, 150);
        battleScene.shakeAdd(9);
        battleScene.text(x, y - 34, "화상!", "#ff8a3d", 15, 1.2);
        this.burn = sk.burn || 3;
        this.burnDmg = Math.max(1, Math.round(stats.atk * (sk.burnRate || 0.35)));
      } else if (sk.effect === "freeze") {
        battleScene.burst(x, y, "#bff0ff", 20, 150);
        battleScene.screenFlash("170,230,255", 0.28);
        battleScene.shakeAdd(8);
        battleScene.text(x, y - 34, "빙결!", "#bff0ff", 15, 1.2);
        this.freeze = (this.freeze || 0) + (sk.freeze || 1);
      } else if (sk.effect === "shadow") {
        this.shadow = sk.shadow || 4;
        this.shadowMult = sk.shadowMult || 0.65;
        battleScene.ring(battleScene.hero.x, battleScene.groundY - 34, "#a8e07a");
        battleScene.burst(battleScene.hero.x, battleScene.groundY - 30, "#8fe07a", 16, 90);
        battleScene.text(battleScene.hero.x, battleScene.groundY - 72, "분신!", "#a8e07a", 14, 1.2);
        this.log("sys", "그림자 분신이 " + this.shadow + "턴간 함께 공격합니다");
      } else if (sk.effect === "rage") {
        battleScene.arcs(battleScene.hero.x + 18, battleScene.groundY - 56, x - 12, y, "#ff5a4a", 4);
        battleScene.screenFlash("255,90,70", 0.28);
        battleScene.shakeAdd(18);
        battleScene.hitStop(0.06);
        battleScene.text(x, y - 34, "광폭!", "#ff6a4a", 16, 1.2);
      } else if (sk.effect === "bloodrage") {
        this.atkBuff = sk.buff || 4;
        this.atkBuffMul = 1 + (sk.buffAtk || 0.4);
        this.lifestealBuff = sk.lifesteal || 0.25;
        battleScene.ring(battleScene.hero.x, battleScene.groundY - 34, "#ff5a4a");
        battleScene.burst(battleScene.hero.x, battleScene.groundY - 30, "#e0413f", 18, 100);
        battleScene.text(battleScene.hero.x, battleScene.groundY - 72, "피의 갈증", "#ff8a7a", 14, 1.2);
        this.log("sys", "피의 갈증 · " + this.atkBuff + "턴 공격력 +40% · 흡혈");
      }

      if (anyCrit) {
        battleScene.critBurst(x, y, "#ffe08a");
        battleScene.hitStop(0.06);
        battleScene.shakeAdd(10);
        haptic(16);
        questAdd("crit", 1);
      }
      sfx(sk.sfx || "hit");
      this.lifestealHeal(total);
      this.log(anyCrit ? "crit" : "dmg", (anyCrit ? "치명타! " : "") + "<b>" + sk.name + "</b> · " + e.name + "에게 <b>" + fmt(total) + "</b> 피해");
      Combo.add();
      ultGain(anyCrit ? 9 : 6);
      renderHud();
      renderBattle();
      this.checkEnrage();
      if (e.hp <= 0) {
        setTimeout(() => this.enemyDown(), 420);
        return;
      }
      setTimeout(() => this.enemyTurn(), 560);
    },

    lifestealHeal(dealt) {
      const ls = stats.lifesteal + (this.lifestealBuff || 0);
      if (ls <= 0 || dealt <= 0) return;
      const before = S.hp;
      S.hp = Math.min(stats.maxHp, S.hp + Math.round(dealt * ls));
      if (S.hp > before) {
        battleScene.text(battleScene.hero.x, battleScene.groundY - 62, "+" + (S.hp - before), "#7bffa0", 13);
        renderHud();
      }
    },

    checkEnrage() {
      const e = this.enemy;
      if (!e) return;
      if (e.boss && !e.enraged && e.hp <= e.maxHp * 0.5 && e.hp > 0) {
        e.enraged = true;
        e.atk = Math.round(e.atk * 1.3);
        battleScene.ring(battleScene.enemy.x, battleScene.groundY - 40, "#ff5a4a");
        battleScene.text(battleScene.enemy.x, battleScene.groundY - 82, "광폭화!", "#ff5a4a", 17, 1.2);
        battleScene.screenFlash("255,80,60", 0.32);
        battleScene.shakeAdd(16);
        sfx("boss");
        this.log("crit", e.name + "이 <b>광폭화</b>했습니다! 공격력 +30%");
      }
    },

    /* ---------------- 동행 펫 공격 ---------------- */
    petAttack() {
      const pet = stats.pet;
      const e = this.enemy;
      if (!pet || !pet.id || !e || e.hp <= 0) return;
      const dmg = Math.max(1, Math.round(stats.atk * pet.hit));
      const dealt = this.applyDamage(dmg, false);
      battleScene.petStrike(battleScene.enemy.x, battleScene.groundY - 36, petColor(pet));
      battleScene.damage(battleScene.enemy.x + rnd(-10, 8), battleScene.groundY - 22, dmg, false, petColor(pet));
      sfx("petHit");
      this.petCount++;
      this.log("dmg", "🐾 " + pet.name + "의 추가 공격 <b>" + fmt(dealt) + "</b>");
      if (this.petCount % 3 === 0 && e.hp > 0) this.petSkill();
      renderBattle();
      // 펫의 일격으로 적이 쓰러지면 전투 흐름을 이어준다
      if (e.hp <= 0) {
        this.busy = true;
        setTimeout(() => this.enemyDown(), 360);
      }
    },

    petSkill() {
      const pet = stats.pet;
      const sk = pet && pet.skill ? G.PET_SKILLS[pet.skill] : null;
      const e = this.enemy;
      if (!sk || !e || e.hp <= 0) return;
      sfx("petSkill");
      battleScene.text(battleScene.hero.x, battleScene.groundY - 106, "🐾 " + sk.name, "#cfe8ff", 12, 1.3);
      if (pet.skill === "heal") {
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + Math.round(stats.maxHp * 0.06 * (1 + pet.rank * 0.2)));
        battleScene.burst(battleScene.hero.x, battleScene.groundY - 30, "#7bffa0", 14, 80);
        battleScene.text(battleScene.hero.x, battleScene.groundY - 66, "+" + Math.round(S.hp - before), "#7bffa0", 14);
        this.log("heal", "펫 <b>" + sk.name + "</b> · 체력 +" + Math.round(S.hp - before));
        renderHud();
      } else if (pet.skill === "burn") {
        this.burn = Math.max(this.burn, 3);
        this.burnDmg = Math.max(this.burnDmg, Math.max(1, Math.round(stats.atk * 0.3)));
        battleScene.embers(battleScene.enemy.x, battleScene.groundY - 26, 14, 120);
        this.log("dmg", "펫 <b>화염 숨결</b> · 3턴 화상");
      } else if (pet.skill === "defDown") {
        this.defDown = 4;
        battleScene.text(battleScene.enemy.x, battleScene.groundY - 70, "방어 ↓", "#ffd479", 13);
        this.log("sys", "펫 <b>방어력 감소</b> · 4턴간 받는 피해 +18%");
      } else if (pet.skill === "atkBuff") {
        this.atkBuff = Math.max(this.atkBuff, 4);
        this.atkBuffMul = 1.18;
        battleScene.ring(battleScene.hero.x, battleScene.groundY - 34, "#8fe0ff");
        this.log("sys", "펫 <b>공격력 버프</b> · 4턴 공격력 +18%");
      }
      renderBattle();
    },
    /* ---------------- 궁극기 [성광 폭격] ---------------- */
    fireUlt() {
      if (!ultReady()) return;
      const e = this.enemy;
      if (!e || e.hp <= 0) return;
      clearTimeout(this.autoTimer);
      this.busy = true;
      S.ult = 0;
      S.stats.ults = (S.stats.ults || 0) + 1;
      this.guarding = false;
      battleScene.guardFx(false);
      const job = G.job(S.job);
      const ult = job.ult;
      const ex = battleScene.enemy.x;
      const ey = battleScene.groundY - 40;
      battleScene.ultFx(ex, ey, ult.style);
      battleScene.hero.lunge = 1;
      sfx(ult.sfx || "ult");
      haptic([0, 28, 40, 70]);
      const hits = ult.hits || 1;
      let dmgTotal = 0;
      let dmg = Math.round(stats.atk * ult.mult + stats.maxHp * (ult.hpScale || 0));
      if (ult.lowHpBonus) dmg += Math.round(stats.atk * ult.lowHpBonus * (1 - S.hp / stats.maxHp));
      const before = S.hp;
      S.hp = Math.min(stats.maxHp, S.hp + Math.round(stats.maxHp * (ult.heal || 0)));
      this.log("crit", (ult.icon || "✨") + " <b>" + ult.name + "!</b>");
      for (let i = 0; i < hits; i++) {
        const part = hits > 1 ? Math.max(1, Math.round(dmg)) : Math.max(1, Math.round(dmg));
        const dealt = this.applyDamage(part, true);
        dmgTotal += dealt;
        battleScene.damage(ex + rnd(-14, 14), ey + rnd(-10, 10), part, true);
      }
      if (S.hp > before) battleScene.text(battleScene.hero.x, battleScene.groundY - 70, "+" + (S.hp - before), "#7bffa0", 15);
      if (ult.burn) {
        this.burn = Math.max(this.burn, ult.burn);
        this.burnDmg = Math.max(this.burnDmg, Math.max(1, Math.round(stats.atk * 0.45)));
        battleScene.embers(ex, ey, 22, 170);
      }
      this.lifestealHeal(dmgTotal);
      this.log("crit", e.name + "에게 <b>" + fmt(dmgTotal) + "</b> 피해" + (S.hp > before ? " · 체력 <b>+" + (S.hp - before) + "</b>" : ""));
      Combo.add();
      renderHud();
      renderUlt();
      renderBattle();
      if (e.hp <= 0) {
        setTimeout(() => this.enemyDown(), 560);
        return;
      }
      setTimeout(() => this.enemyTurn(), 700);
    },

    enemyTurn() {
      if (!this.active) return;
      const e = this.enemy;
      if (!e || e.hp <= 0) return;
      const it = this.intent;
      // 빙결 : 적이 이번 턴 행동하지 못한다
      if (this.freeze > 0) {
        this.freeze--;
        battleScene.burst(battleScene.enemy.x, battleScene.groundY - 36, "#bff0ff", 16, 110);
        battleScene.text(battleScene.enemy.x, battleScene.groundY - 82, "빙결!", "#bff0ff", 15, 1.1);
        sfx("frost");
        this.log("sys", e.name + "이 <b>얼어붙어</b> 움직이지 못합니다");
        this.finishTurn();
        return;
      }
      // 그림자 분신 : 적이 움직이기 전에 추가 타격
      if (this.shadow > 0) {
        this.shadow--;
        const d = Math.max(1, Math.round(stats.atk * this.shadowMult * (0.9 + Math.random() * 0.2)));
        const dealt = this.applyDamage(d, false);
        battleScene.slash(battleScene.enemy.x - 34, battleScene.groundY - 56, battleScene.enemy.x + 6, battleScene.groundY - 28, "#a8e07a");
        battleScene.damage(battleScene.enemy.x, battleScene.groundY - 44, d, false, "#a8e07a");
        this.log("dmg", "그림자 분신의 일격 <b>" + fmt(dealt) + "</b>");
        if (e.hp <= 0) {
          renderBattle();
          setTimeout(() => this.enemyDown(), 380);
          return;
        }
      }
      // 화상 지속 피해
      if (this.burn > 0) {
        e.hp = Math.max(0, e.hp - this.burnDmg);
        this.burn--;
        battleScene.damage(battleScene.enemy.x, battleScene.groundY - 50, this.burnDmg, false, "#ff8a3d");
        battleScene.embers(battleScene.enemy.x, battleScene.groundY - 34, 6, 70);
        this.log("dmg", "화상 피해 <b>" + fmt(this.burnDmg) + "</b>");
        battleScene.enemy.hp = e.hp;
        renderBattle();
        if (e.hp <= 0) {
          setTimeout(() => this.enemyDown(), 380);
          return;
        }
      }
      if (it.type === "buff") {
        e.atk = Math.round(e.atk * 1.25);
        battleScene.ring(battleScene.enemy.x, battleScene.groundY - 40, "#c39cff");
        battleScene.burst(battleScene.enemy.x, battleScene.groundY - 40, "#c39cff", 10, 60);
        this.log("sys", e.name + "이 기를 모아 공격력이 상승했습니다");
        this.finishTurn();
        return;
      }
      if (it.type === "shield") {
        this.shield = this.shieldMax;
        battleScene.enemy.shield = this.shield;
        battleScene.enemy.shieldMax = this.shieldMax;
        battleScene.ring(battleScene.enemy.x, battleScene.groundY - 40, "#8fd8ff");
        battleScene.text(battleScene.enemy.x, battleScene.groundY - 82, "방어막!", "#bff0ff", 15, 1.1);
        battleScene.screenFlash("140,210,255", 0.2);
        sfx("shield");
        this.log("sys", e.name + "이 <b>방어막</b>을 전개했습니다 (🛡 " + fmt(this.shield) + ")");
        renderBattle();
        this.finishTurn();
        return;
      }

      const hits = it.type === "combo" ? it.hits || 2 : 1;
      let total = 0;
      for (let h = 0; h < hits; h++) {
        let raw = Math.round(e.atk * (it.mult || 1) * (0.9 + Math.random() * 0.2));
        let dmg = Math.max(1, Math.round(raw - stats.def * 0.6));
        if (this.guarding) dmg = Math.max(1, Math.round(dmg * 0.3));
        S.hp -= dmg;
        total += dmg;
        battleScene.hero.hurt = 1;
        battleScene.hurtFlash = 1;
        battleScene.damage(battleScene.hero.x + rnd(-5, 5), battleScene.groundY - 54 - h * 10, dmg, false, "#ff8a7a");
      }
      battleScene.enemy.lunge = 0;
      Combo.reset();
      ultGain(5);
      battleScene.shakeAdd(it.type === "combo" ? 14 : it.type === "heavy" ? 11 : 5);
      battleScene.hitStop(it.type === "combo" ? 0.04 : 0);
      if (it.type === "heavy" || it.type === "combo") {
        battleScene.screenFlash("255,90,70", 0.22);
        haptic(14);
      }
      sfx("hurt");
      this.log("dmg", (it.type === "heavy" ? "강타! " : it.type === "combo" ? "연속 강타! " : "") + e.name + "의 공격 <b>" + fmt(total) + "</b> 피해" + (hits > 1 ? " (" + hits + "연격)" : "") + (this.guarding ? " (방어)" : ""));
      if (this.guarding) {
        const c = Math.max(1, Math.round(stats.atk * 0.8));
        const dealt = this.applyDamage(c, false);
        battleScene.damage(battleScene.enemy.x, battleScene.groundY - 40, c, false, "#8fd8ff");
        battleScene.slash(battleScene.enemy.x, battleScene.groundY - 36, battleScene.enemy.x - 40, battleScene.groundY - 20, "#8fd8ff");
        sfx("counter");
        this.log("dmg", "반격! <b>" + fmt(dealt) + "</b> 피해");
        if (this.enemy.hp <= 0) {
          renderBattle();
          renderHud();
          setTimeout(() => this.enemyDown(), 380);
          return;
        }
      }
      this.guarding = false;
      battleScene.guardFx(false);
      renderHud();
      renderBattle();
      if (S.hp <= 0) {
        S.hp = 0;
        this.die();
        return;
      }
      this.finishTurn();
    },

    finishTurn() {
      this.turn++;
      this.busy = false;
      if (this.cds.s1 > 0) this.cds.s1--;
      if (this.cds.s2 > 0) this.cds.s2--;
      if (this.atkBuff > 0) this.atkBuff--;
      if (this.defDown > 0) this.defDown--;
      this.intent = this.makeIntent();
      renderBattle();
      // 동행 펫의 추가 공격 (펫마다 주기 다름)
      const pet = stats.pet;
      if (pet && pet.id && this.enemy && this.enemy.hp > 0) {
        this.petTurn++;
        if (this.petTurn % Math.max(1, pet.turns) === 0) {
          this.petAttack();
          if (!this.enemy || this.enemy.hp <= 0) return;
        }
      }
      this.maybeAuto(560);
    },

    enemyDown() {
      const e = this.enemy;
      // 이전 전투의 지연 콜백이 새 전투에 적용되지 않도록 방어
      if (!this.active || !e || e.hp > 0) return;
      battleScene.enemy.alpha = 0.15;
      battleScene.burst(battleScene.enemy.x, battleScene.groundY - 30, "#ffd479", 22, 170);
      if (this.rush) {
        battleScene.enemy.alpha = 0.15;
        this.busy = false;
        this.rushKill();
        return;
      }
      const f = this.floor();
      const isBoss = this.wave >= f.waves;
      if (!isBoss) {
        questAdd("kill", 1);
        if (e && e.golden) {
          const bonusGold = Math.round(f.reward.gold * 0.9);
          const gems = 4 + Math.floor(Math.random() * 5);
          S.gold += bonusGold;
          S.gems += gems;
          S.stats.goldGoblins = (S.stats.goldGoblins || 0) + 1;
          battleScene.text(battleScene.enemy.x, battleScene.groundY - 100, "💎 보석 +" + gems, "#57e0c4", 15, 1.3);
          this.log("loot", "황금 고블린 처치! 골드 <b>+" + fmt(bonusGold) + "</b> · 보석 <b>+" + gems + "</b>");
          sfx("quest");
        }
        this.wave++;
        this.turn++;
        this.busy = false;
        this.cds.s1 = Math.max(0, this.cds.s1 - 1);
        this.cds.s2 = Math.max(0, this.cds.s2 - 1);
        const heal = Math.round(stats.maxHp * 0.18);
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + heal);
        if (S.hp > before) {
          battleScene.burst(battleScene.hero.x, battleScene.groundY - 28, "#7bffa0", 10, 60);
          this.log("heal", "웨이브 클리어 · 체력 <b>+" + (S.hp - before) + "</b> 회복");
        } else {
          this.log("sys", "적 처치! 다음 상대가 등장합니다");
        }
        questAdd("wave", 1);
        // 웨이브 클리어 = 장비 100% 드랍 (미믹·정예는 추가 드랍)
        const drops = e && e.mimic ? 2 : 1;
        for (let i = 0; i < drops; i++) {
          const it = this.rollWaveLoot(e && e.mimic, i === 1);
          const rc = G.RARITY[it.rarity];
          battleScene.text(battleScene.enemy.x, battleScene.groundY - 96 - i * 18, rc.name + " 장비!", rc.color, 13, 1.5);
          battleScene.burst(battleScene.enemy.x, battleScene.groundY - 40, rc.color, 12, 90);
          this.log("loot", "장비 획득 · <b style='color:" + rc.color + "'>[" + rc.name + "] " + it.name + "</b>");
        }
        sfx("drop");
        bagDot(true);
        renderHud();
        setTimeout(() => this.spawnWave(), 620);
        return;
      }
      this.clearFloor();
    },

    clearFloor() {
      const f = this.floor();
      const first = !S.floors[this.floorIdx];
      S.floors[this.floorIdx] = true;
      S.dc += f.reward.dc;
      S.gems += f.reward.gem;
      S.stones += f.reward.stone;
      S.gold += f.reward.gold;
      S.stats.dungeons++;
      questAdd("boss", 1);
      // 보스 처치 = 다수·고등급 장비 보장
      const items = this.rollBossLoot();
      items.forEach((it) => G.addItem(it));
      this.bossLoot = items;
      this.active = false;
      this.busy = false;
      Field.paused = false;
      clearTimeout(this.autoTimer);
      $("#battle").classList.remove("on");
      battleScene.enemy.alpha = 1;
      battleScene.guardFx(false);
      sfx("clear");
      bgm("field");
      save();
      const rows = [
        '<div class="reward gold"><span class="ico"></span>' + fmt(f.reward.gold) + '<span class="rl">골드</span></div>',
        '<div class="reward dc"><span class="ico"></span>' + f.reward.dc + '<span class="rl">던전코인</span></div>',
        '<div class="reward gem"><span class="ico"></span>' + f.reward.gem + '<span class="rl">보석</span></div>',
        '<div class="reward stone"><span class="ico"></span>' + f.reward.stone + '<span class="rl">강화석</span></div>',
      ].join("");
      const cards = items
        .map((it) => {
          const c = G.RARITY[it.rarity];
          return (
            '<div class="loot-card" style="--lc:' +
            c.color +
            ";--lg:" +
            c.color +
            '44">' +
            '<span class="lc-ic" data-slot="' +
            it.slot +
            '"></span>' +
            '<div class="lc-mid"><div class="lc-n">' +
            it.name +
            (it.lvl ? " +" + it.lvl : "") +
            '</div><div class="lc-s">' +
            itemStatsText(it) +
            "</div></div><div class=\"lc-r\">" +
            c.name +
            "</div></div>"
          );
        })
        .join("");
      const last = this.floorIdx >= G.FLOORS.length - 1;
      const m = openModal({
        icon: "🏆",
        title: last ? "심연 정복!" : f.floor + "층 클리어!",
        sub:
          (last ? "20층 심연의 마왕성을 정복했습니다!" : "다음 층이 개방되었습니다") +
          " · " +
          (first ? "첫 클리어 보상" : "재도전 보상"),
        bodyHTML:
          '<div class="reward-grid">' +
          rows +
          "</div>" +
          '<div class="m-label">획득 장비 <b>' +
          items.length +
          "개</b> <span>던전 전용 파밍</span></div>" +
          '<div class="loot-list">' +
          cards +
          "</div>",
        rows: [
          [
            {
              label: "계속 사냥하기",
              cls: "gold",
              onClick: () => {
                renderAll();
                switchTab("field");
              },
            },
          ],
        ],
      });
      if (m) {
        m.querySelectorAll(".lc-ic").forEach((el, i) => {
          if (items[i]) el.appendChild(makeCanvas(G.SLOTS[items[i].slot].icon, 2.4));
        });
      }
      renderAll();
      maybeDot();
    },

    /* ---------------- 자동 전투 ---------------- */
    toggleAuto(force) {
      this.auto = force === undefined ? !this.auto : !!force;
      S.autoBattle = this.auto;
      save();
      renderBattle();
      if (this.auto) {
        sfx("on");
        toast("자동 전투 ON · 상황에 맞춰 스킬을 고릅니다", "gold");
        this.maybeAuto(420);
      } else {
        sfx("off");
        clearTimeout(this.autoTimer);
        toast("자동 전투 OFF · 직접 조작하세요");
      }
    },

    maybeAuto(delay) {
      clearTimeout(this.autoTimer);
      if (!this.auto || !this.active) return;
      this.autoTimer = setTimeout(() => this.autoAct(), delay == null ? 600 : delay);
    },

    autoChoose() {
      const e = this.enemy;
      if (!e) return "attack";
      const ratio = S.hp / stats.maxHp;
      const it = this.intent || { type: "attack", mult: 1 };
      // 궁극기: 위기 · 보스 · 방어막 상황에서 자동 발동
      if (ultReady()) {
        if (e.boss || this.shield > 0 || ratio < 0.5 || it.type === "combo") return "ult";
      }
      const raw = it.type === "buff" || it.type === "shield" ? 0 : e.atk * (it.mult || 1) * (it.hits || 1);
      const incoming = Math.max(1, raw - stats.def * 0.6);
      if (raw > 0 && S.hp <= incoming * 1.2) {
        if (S.pots > 0 && ratio < 0.55) return "potion";
        return "guard";
      }
      if (ratio < 0.32 && S.pots > 0) return "potion";
      if ((it.type === "heavy" || it.type === "combo") && ratio < 0.55) return "guard";
      // 직업 스킬 : 쿨이 돌면 사용, 회복·버프형은 상황을 보고
      const sks = G.jobSkills();
      const s2 = sks[1];
      if (s2 && this.cds.s2 === 0) {
        if (s2.effect === "healguard") {
          if (ratio < 0.72) return "s2";
        } else if (s2.effect === "bloodrage") {
          if (ratio > 0.4 && this.atkBuff === 0) return "s2";
        } else if (s2.effect === "shadow") {
          if (this.shadow === 0) return "s2";
        } else return "s2";
      }
      if (sks[0] && this.cds.s1 === 0) return "s1";
      return "attack";
    },

    autoAct() {
      if (!this.active || this.busy) return;
      if (!this.enemy || this.enemy.hp <= 0) return;
      this.act(this.autoChoose());
    },

    /* ---------------- 장비 드랍 ---------------- */
    rollWaveLoot(bonus, extra) {
      const f = this.floorIdx;
      const ilvl = f + 2;
      const x = Math.random() * 100;
      let r;
      if (f >= 12) r = x < 22 ? 4 : x < 55 ? 3 : x < 88 ? 2 : 1;
      else if (f >= 8) r = x < 12 ? 4 : x < 42 ? 3 : x < 75 ? 2 : 1;
      else if (f >= 3) r = x < 6 ? 4 : x < 25 ? 3 : x < 62 ? 2 : 1;
      else if (f >= 1) r = x < 7 ? 3 : x < 45 ? 2 : 1;
      else r = x < 35 ? 2 : 1;
      if (bonus) r = Math.max(r, 3);
      if (extra) r = Math.max(r, 4);
      const it = G.rollItem(ilvl, r);
      G.addItem(it);
      this.pushLoot(it);
      return it;
    },

    rollBossLoot() {
      const f = this.floorIdx;
      const ilvl = f + 3;
      const plan = [
        Math.random() * 100 < 12 + f * 4 ? 4 : 3,
        Math.random() * 100 < 6 + f * 5 ? 4 : 2,
        Math.random() * 100 < 45 + f * 3 ? 3 : 2,
        Math.random() * 100 < f * 3 ? 4 : 3,
      ];
      return plan.map((r) => G.rollItem(ilvl, Math.min(4, r)));
    },

    pushLoot(it) {
      this.loot.push(it);
      if (this.loot.length > 6) this.loot.shift();
      this.showLootChip(it);
    },

    showLootChip(it) {
      const el = $("#bLoot");
      if (!el) return;
      const c = G.RARITY[it.rarity];
      el.innerHTML = "";
      const chip = document.createElement("div");
      chip.className = "loot-chip";
      chip.style.setProperty("--lc", c.color);
      chip.appendChild(makeCanvas(G.SLOTS[it.slot].icon, 1.6));
      const sp = document.createElement("span");
      sp.innerHTML = "<b>" + c.name + "</b> " + it.name;
      chip.appendChild(sp);
      el.appendChild(chip);
      el.classList.add("on");
      clearTimeout(this.lootTimer);
      this.lootTimer = setTimeout(() => el.classList.remove("on"), 3200);
    },

    die() {
      this.busy = true;
      clearTimeout(this.autoTimer);
      Combo.reset();
      this.log("sys", "쓰러졌습니다...");
      if (this.rush) {
        const lv = this.rushLv;
        S.rushBest = Math.max(S.rushBest || 0, lv);
        const best = S.rushBest;
        this.rush = false;
        this.active = false;
        Field.paused = false;
        $("#battle").classList.remove("on");
        battleScene.hero.alpha = 1;
        S.hp = Math.max(1, Math.round(stats.maxHp * 0.3));
        sfx("off");
        openModal({
          icon: "💀",
          title: "무한의 시련 종료",
          sub: "보스 <b>" + lv + "연속</b> 돌파 · 최고 기록 <b>" + best + "보스</b>",
          bodyHTML:
            '<div class="reward-grid"><div class="reward gem"><span class="ico"></span>' + fmt(lv) +
            '<span class="rl">돌파 보스</span></div><div class="reward dc"><span class="ico"></span>' + best +
            '<span class="rl">최고 기록</span></div></div>' +
            '<div class="m-label">시련은 장비·펫을 키운 뒤 다시 도전할수록 멀리 갑니다.</div>',
          rows: [[{ label: "확인", cls: "gold", onClick: () => { renderAll(); switchTab("dungeon"); } }]],
        });
        save();
        renderAll();
        return;
      }
      openModal({
        icon: "💀",
        title: "쓰러졌습니다",
        sub: "던전에서 패배했습니다. 체력 60%로 부활하거나 포기할 수 있어요.",
        buttons: [
          {
            label: '광고 보고 부활 <span class="ad-ico">AD</span>',
            cls: "gold",
            onClick: () => {
              G.Ads.show("dungeon_revive", () => {
                S.hp = Math.round(stats.maxHp * 0.6);
                this.busy = false;
                this.guarding = false;
                battleScene.hero.alpha = 1;
                battleScene.burst(battleScene.hero.x, battleScene.groundY - 30, "#8fd8ff", 16, 80);
                this.log("heal", "부활! 체력 60% 회복");
                this.intent = this.makeIntent();
                this.finishTurn();
                renderHud();
                renderBattle();
              });
            },
          },
          {
            label: "포기하고 나가기",
            cls: "ghost",
            onClick: () => {
              this.active = false;
              Field.paused = false;
              this.busy = false;
              $("#battle").classList.remove("on");
              S.hp = Math.max(1, Math.round(stats.maxHp * 0.3));
              battleScene.hero.alpha = 1;
              renderAll();
            },
          },
        ],
      });
    },

    flee() {
      if (this.rush) {
        S.rushBest = Math.max(S.rushBest || 0, this.rushLv);
        this.rush = false;
      }
      this.active = false;
      Field.paused = false;
      this.busy = false;
      clearTimeout(this.autoTimer);
      Combo.reset();
      $("#battle").classList.remove("on");
      battleScene.hero.alpha = 1;
      battleScene.guardFx(false);
      bgm("field");
      toast("던전에서 나왔습니다");
      renderAll();
    },
  };

  // 직업에 맞춰 스킬 버튼 라벨 · 아이콘 · 쿨다운 표시
  function setSkillLabels() {
    const jb = G.job(S.job);
    [["s1", "#actSkill1", "#cdS1"], ["s2", "#actSkill2", "#cdS2"]].forEach((row, i) => {
      const sk = jb.skills[i];
      const btn = $(row[1]);
      if (!btn || !sk) return;
      const em = btn.querySelector(".em");
      const b = btn.querySelector(".at b");
      const sm = btn.querySelector(".at small");
      if (em) em.textContent = sk.icon;
      if (b) b.textContent = sk.name;
      if (sm) sm.textContent = sk.short;
      btn.disabled = Dungeon.busy || Dungeon.cds[row[0]] > 0;
      btn.classList.toggle("oncd", Dungeon.cds[row[0]] > 0);
      btn.title = sk.name + " · " + sk.short;
      const cd = $(row[2]);
      if (cd) {
        cd.textContent = Dungeon.cds[row[0]] || "";
        cd.style.display = Dungeon.cds[row[0]] > 0 ? "grid" : "none";
      }
    });
  }

  function renderBattle() {
    const e = Dungeon.enemy;
    if (!e) return;
    const isBoss = Dungeon.rush ? true : Dungeon.wave >= Dungeon.floor().waves;
    setSkillLabels();
    const ab = $("#btnAutoBattle");
    if (ab) {
      ab.classList.toggle("on", !!Dungeon.auto);
      ab.textContent = "⚡ 자동 전투 " + (Dungeon.auto ? "ON" : "OFF");
    }
    $("#bEnemyName").textContent = (isBoss ? "👑 " : "") + e.name;
    $("#bTurn").textContent = Dungeon.rush
      ? "TURN " + Dungeon.turn + " · 시련 " + (Dungeon.rushLv + 1)
      : "TURN " + Dungeon.turn + " · " + (isBoss ? "BOSS" : "WAVE " + (Dungeon.wave + 1) + "/" + Dungeon.floor().waves);
    $("#bHpNum").textContent = Math.ceil(Math.max(0, S.hp)) + "/" + stats.maxHp;
    $("#bHpFill").style.width = clamp((S.hp / stats.maxHp) * 100, 0, 100).toFixed(1) + "%";
    $("#bEhpNum").textContent = Math.max(0, Math.ceil(e.hp)) + "/" + e.maxHp;
    $("#bEhFill").style.width = clamp((e.hp / e.maxHp) * 100, 0, 100).toFixed(1) + "%";
    const intent = Dungeon.intent;
    const el = $("#intent");
    if (intent) {
      let dmgTxt = "약 " + Math.round(e.atk * (intent.mult || 0)) + " 피해";
      let ico = "🗡️";
      if (intent.type === "buff") {
        dmgTxt = "공격력 ↑";
        ico = "✨";
      } else if (intent.type === "shield") {
        dmgTxt = "피해 흡수 " + fmt(Dungeon.shieldMax);
        ico = "🛡️";
      } else if (intent.type === "combo") {
        dmgTxt = "약 " + Math.round(e.atk * intent.mult) + " × " + (intent.hits || 2) + "연격";
        ico = "⚡";
      } else if (intent.type === "heavy") {
        ico = "⚠️";
      }
      el.className = "intent" + (intent.type === "heavy" || intent.type === "combo" ? " heavy" : "");
      el.innerHTML = '<span class="ii">' + ico + "</span> 다음: " + intent.label + " · " + dmgTxt;
    }
    // 보스 방어막
    const sh = $("#bShield");
    if (sh) {
      const on = Dungeon.shieldMax > 0;
      sh.classList.toggle("on", on);
      if (on) {
        $("#bShieldFill").style.width = clamp((Dungeon.shield / Math.max(1, Dungeon.shieldMax)) * 100, 0, 100).toFixed(0) + "%";
        $("#bShieldTxt").textContent = "🛡 방어막 " + fmt(Math.max(0, Math.round(Dungeon.shield)));
      }
      battleScene.enemy.shield = Dungeon.shield;
      battleScene.enemy.shieldMax = Dungeon.shieldMax;
    }
    renderUlt();
    $("#potCount").textContent = S.pots;
    $("#actPotion").disabled = S.pots <= 0 || Dungeon.busy;
    $("#actAttack").disabled = Dungeon.busy;
    $("#actGuard").disabled = Dungeon.busy;
    battleScene.enemy.hp = e.hp;
    battleScene.enemy.maxHp = e.maxHp;
  }

  Dungeon.render = renderBattle;

  function renderRush() {
    const el = $("#rushCard");
    if (!el) return;
    const best = S.rushBest || 0;
    el.querySelector(".rc-best b").textContent = best;
    el.querySelector(".rc-sub").textContent =
      best > 0 ? "최고 " + best + "보스 · 다음 도전에서 더 강한 보스를 만납니다" : "20층 너머 끝없는 보스 행렬에 도전하세요";
    const btn = el.querySelector(".rc-go");
    if (btn) {
      btn.disabled = Dungeon.active;
      btn.textContent = Dungeon.active && Dungeon.rush ? "진행 중" : "도전";
    }
  }

  function renderDungeon() {
    renderRush();
    const wrap = $("#floorList");
    wrap.innerHTML = "";
    let lastChapter = -1;
    G.FLOORS.forEach((f, i) => {
      const fs = G.floorState(i);
      const lockedNote = !fs.unlocked;
      // 챕터(테마) 구분 헤더 — 4층마다 배경·몬스터·보스가 바뀐다
      if (f.chapterIdx !== lastChapter) {
        lastChapter = f.chapterIdx;
        const h = document.createElement("div");
        h.className = "floor-chapter";
        h.style.setProperty("--cc", f.color);
        h.innerHTML = "<i></i><em>" + f.chapter + "</em><span>" + f.floor + "~" + (f.floor + 3) + "F</span>";
        wrap.appendChild(h);
      }
      const div = document.createElement("div");
      div.className = "floor" + (!lockedNote ? " unlocked" : " locked") + (fs.cleared ? " cleared" : "");
      div.style.setProperty("--tint", f.color + "77");
      div.innerHTML =
        '<div class="ficon"></div>' +
        '<div class="finfo">' +
        '<div class="fname"><span class="fl" style="color:' + f.color + '">' + f.floor + "F</span> " + (lockedNote ? "???" : f.name) +
        (fs.cleared ? ' <span class="tagmini ok">클리어</span>' : "") +
        (!lockedNote && !fs.cleared && i > 0 && !S.floors[i] ? ' <span class="tagmini boss">NEW</span>' : "") +
        "</div>" +
        '<div class="fmeta">' +
        "<span>권장 Lv." + f.rec + "</span>" +
        "<span>보스 " + (lockedNote ? "???" : f.boss.name) + "</span>" +
        '<span class="tagmini wave">' + f.waves + "웨이브</span>" +
        "<span>보상 " + f.reward.dc + "코인</span>" +
        "</div></div>" +
        '<div class="fgo">' + (lockedNote ? "잠김" : fs.cleared ? "재도전" : "입장") + "</div>";
      const iconWrap = div.querySelector(".ficon");
      if (!lockedNote) {
        const spr = G.sprite(G.MOBS[f.boss.key].sprite, 2, G.chapterTint(f.chapterIdx));
        if (spr) {
          const c = document.createElement("canvas");
          c.width = spr.width;
          c.height = spr.height;
          c.getContext("2d").drawImage(spr, 0, 0);
          iconWrap.appendChild(c);
        }
      }
      if (!lockedNote && !Dungeon.active) {
        div.onclick = () => {
          if (S.lv < f.rec - 3) {
            openModal({
              icon: "⚠️",
              title: "조금 위험해 보입니다",
              sub: "권장 레벨은 Lv." + f.rec + " 입니다. 지금 입장하면 매우 어려울 수 있어요.",
              buttons: [
                { label: "그래도 입장", cls: "red", onClick: () => Dungeon.start(i) },
                { label: "사냥 더 하기", cls: "ghost", onClick: () => switchTab("field") },
              ],
            });
          } else {
            Dungeon.start(i);
          }
        };
      }
      wrap.appendChild(div);
    });
  }

  /* ---------------------------------------------------------------- 성장 */
  function upgradeCost(id) {
    const u = G.UPGRADES.find((x) => x.id === id);
    const l = S.up[id] || 0;
    return Math.round(u.base * Math.pow(u.growth, l));
  }

  function renderGrow() {
    $("#growLv").textContent = S.lv;
    $("#growExp").textContent = "경험치 " + fmt(S.exp) + " / " + fmt(G.expNeed(S.lv));
    $("#growExpFill").style.width = clamp((S.exp / G.expNeed(S.lv)) * 100, 0, 100).toFixed(1) + "%";
    $("#growGold").textContent = fmt(S.gold);
    $("#powerLabel").textContent = "전투력 " + fmt(stats.power);

    const list = [
      ["공격력", fmt(stats.atk)],
      ["최대 체력", fmt(stats.maxHp)],
      ["치명타 확률", stats.crit.toFixed(1) + "%"],
      ["치명타 피해", stats.critDmg + "%"],
      ["공격 속도", stats.aspd.toFixed(2) + "/s"],
      ["방어력", stats.def.toFixed(1)],
    ];
    $("#statSummary").innerHTML = list
      .map((x) => '<div class="sline"><span>' + x[0] + "</span><b>" + x[1] + "</b></div>")
      .join("");

    const up = $("#upList");
    up.innerHTML = "";
    G.UPGRADES.forEach((u) => {
      const lv = S.up[u.id] || 0;
      const cost = upgradeCost(u.id);
      const maxed = lv >= u.max;
      const row = document.createElement("div");
      row.className = "up-row";
      row.innerHTML =
        '<div class="up-ico">' + u.icon + "</div>" +
        '<div class="up-mid">' +
        '<div class="un">' + u.name + ' <span class="lvl">Lv.' + lv + (maxed ? " MAX" : "") + "</span></div>" +
        '<div class="ue">' + (maxed ? "최대 강화 완료" : "다음: <b>" + u.eff(lv + 1) + "</b>") + "</div>" +
        "</div>" +
        '<div class="up-buy"></div>';
      const b = document.createElement("button");
      b.className = "btn " + (maxed ? "maxed" : "gold");
      b.innerHTML = maxed ? "MAX" : "강화<small>" + fmt(cost) + " 골드</small>";
      b.disabled = maxed || S.gold < cost;
      b.onclick = () => {
        if (S.gold < cost) {
          toast("골드가 부족합니다");
          return;
        }
        S.gold -= cost;
        S.up[u.id] = lv + 1;
        stats = G.computeStats();
        if (u.id === "hp") S.hp = Math.min(stats.maxHp, S.hp + 14);
        save();
        renderGrow();
        renderHud();
        renderField();
        toast(u.name + " 강화! Lv." + (lv + 1), "gold");
      };
      row.querySelector(".up-buy").appendChild(b);
      up.appendChild(row);
    });

    // 장비 강화 목록
    $("#stoneLabel").textContent = "강화석 " + S.stones;
    const enh = $("#enhList");
    enh.innerHTML = "";
    let any = false;
    ["weapon", "armor", "acc"].forEach((slot) => {
      const it = S.eq[slot];
      if (!it) return;
      any = true;
      const c = G.enhanceCost(it);
      const row = document.createElement("div");
      row.className = "up-row";
      row.style.marginBottom = "0";
      row.innerHTML =
        '<div class="up-ico" style="border-color:' + G.RARITY[it.rarity].color + '55">' +
        (slot === "weapon" ? "🗡️" : slot === "armor" ? "🛡️" : "💍") +
        "</div>" +
        '<div class="up-mid"><div class="un" style="color:' + G.RARITY[it.rarity].color + '">' + it.name +
        ' <span class="lvl" style="color:var(--gold)">+' + (it.lvl || 0) + "</span></div>" +
        '<div class="ue">' + (c.max ? "최대 강화" : "다음 +1 · 강화석 " + c.stones + "개 · " + fmt(c.gold) + " 골드") + "</div></div>" +
        '<div class="up-buy"></div>';
      const b = document.createElement("button");
      b.className = "btn " + (c.max ? "maxed" : "purple");
      b.innerHTML = c.max ? "MAX" : "강화";
      b.disabled = c.max || S.stones < c.stones || S.gold < c.gold;
      b.onclick = () => {
        const r = G.enhance(it);
        if (!r.ok) {
          toast(r.msg);
          return;
        }
        stats = G.computeStats();
        toast(it.name + " +" + it.lvl + " 강화 성공!", "gold");
        save();
        renderGrow();
        renderBag();
        renderHud();
      };
      row.querySelector(".up-buy").appendChild(b);
      enh.appendChild(row);
    });
    if (!any) {
      enh.innerHTML = '<div class="empty-note">착용 중인 장비가 없습니다.<br />가방에서 장비를 장착해 보세요.</div>';
    }
    renderJobCard();
    renderCodex();
  }

  /* ------------------------------------------------------------ 직업 카드 */
  function renderJobCard() {
    const jb = G.job(S.job);
    const ic = $("#jobIcon");
    if (ic) ic.textContent = jb.icon;
    const nm = $("#jobName");
    if (nm) {
      nm.textContent = jb.name;
      nm.style.color = jb.color;
    }
    const tg = $("#jobTags");
    if (tg) tg.innerHTML = jb.tags.map((t) => '<span class="jp-tag">' + t + "</span>").join("");
    const list = $("#jobSkills");
    if (!list) return;
    const rows = jb.skills
      .map((s) => '<div class="js-row"><span>' + s.icon + "</span><b>" + s.name + "</b><em>" + s.short + "</em></div>")
      .join("");
    list.innerHTML =
      rows + '<div class="js-row ult"><span>' + jb.ult.icon + "</span><b>" + jb.ult.name + "</b><em>" + jb.ult.short + "</em></div>";
  }

  /* ------------------------------------------------------------- 도감 카드 */
  function renderCodex() {
    const wrap = $("#codexEq");
    if (!wrap) return;
    const c = S.codex || { items: {}, pets: {} };
    wrap.innerHTML = "";
    ["weapon", "armor", "acc"].forEach((slot) => {
      const row = document.createElement("div");
      row.className = "cx-row";
      const lb = document.createElement("span");
      lb.className = "cx-lb";
      lb.textContent = G.SLOTS[slot].name;
      row.appendChild(lb);
      const cells = document.createElement("div");
      cells.className = "cx-cells";
      for (let r = 0; r < 5; r++) {
        const key = slot + "_" + r;
        const owned = !!(c.items && c.items[key]);
        const cell = document.createElement("div");
        cell.className = "cx-cell" + (owned ? " on" : "");
        cell.style.setProperty("--rc", G.RARITY[r].color);
        cell.title = G.SLOTS[slot].name + " · " + G.RARITY[r].name + (owned ? " (등록)" : " (미등록)");
        const cv = makeCanvas(G.SLOTS[slot].icon, 1.3);
        cv.className = owned ? "" : "cx-dot";
        cell.appendChild(cv);
        cells.appendChild(cell);
      }
      row.appendChild(cells);
      wrap.appendChild(row);
    });
    const pw = $("#codexPets");
    if (pw) {
      pw.innerHTML = "";
      G.PETS.forEach((p) => {
        const owned = !!(c.pets && c.pets[p.id]);
        const cell = document.createElement("div");
        cell.className = "cx-pet" + (owned ? " on" : "");
        cell.style.setProperty("--rc", G.RARITY[p.rarity].color);
        const cv = makeCanvas(p.sprite, 1.5);
        cell.appendChild(cv);
        if (!owned) {
          const q = document.createElement("span");
          q.className = "cx-q";
          q.textContent = "?";
          cell.appendChild(q);
        }
        cell.title = owned ? p.name : "???";
        pw.appendChild(cell);
      });
    }
    const b = G.codexBuffs();
    const bl = $("#codexBonus");
    if (bl) bl.textContent = "장비 " + b.nEq + "/15 · 펫 " + b.nPet + "/12";
    const sum = $("#codexSum");
    if (sum) {
      sum.innerHTML =
        '<span>공격 <b>+' + b.atkPct.toFixed(1) + "%</b></span><span>체력 <b>+" + b.hpPct.toFixed(1) +
        "%</b></span><span>치명 <b>+" + b.crit.toFixed(1) + "%</b></span><span>치피 <b>+" + b.critDmg.toFixed(1) + "%</b></span>";
      if (b.fullEq || b.fullPet) {
        sum.innerHTML += '<div class="cx-full">' + (b.fullEq ? "장비 도감 완성 +5% 공격·체력 " : "") + (b.fullPet ? "펫 도감 완성 +3% 치명·+10% 치피" : "") + "</div>";
      }
    }
  }
  G.renderCodex = renderCodex;

  /* ---------------------------------------------------------------- 가방 */
  // 가방 카드에는 강화(+N)를 뺀 순수 기본 스탯과 잠재옵션만 적는다 (비교 기준과 동일)
  function itemStatsText(it) {
    const parts = [];
    if (it.atk) parts.push("공격 +" + Math.round(it.atk));
    if (it.hp) parts.push("체력 +" + Math.round(it.hp));
    if (it.def) parts.push("방어 +" + it.def.toFixed(1));
    if (it.crit) parts.push("치명 " + it.crit.toFixed(1) + "%");
    if (it.critDmg) parts.push("치피 +" + Math.round(it.critDmg) + "%");
    (it.opt || []).forEach((o) => parts.push(G.optText(o)));
    return parts.join(" · ");
  }

  function fmtDiff(v, dec, pct) {
    return Math.abs(v).toFixed(dec) + (pct ? "%" : "");
  }

  // 카드용 비교 칩 — 착용 장비 대비 스탯 증감(초록▲/빨강▼) + 전투력 차이
  function diffChips(it) {
    const cmp = G.compareItem(it);
    const chips = [];
    cmp.deltas.forEach((d) => {
      if (Math.abs(d.val) < (d.dec ? 0.05 : 0.5)) return;
      const up = d.val > 0;
      chips.push(
        '<span class="df ' + (up ? "up" : "down") + '">' + (up ? "▲" : "▼") + d.label + " " +
        (up ? "+" : "-") + fmtDiff(d.val, d.dec, d.pct) + "</span>"
      );
    });
    if (cmp.power) {
      const up = cmp.power > 0;
      chips.push('<span class="df pw ' + (up ? "up" : "down") + '">전투력 ' + (up ? "+" : "-") + fmt(Math.abs(cmp.power)) + "</span>");
    } else if (!chips.length) {
      chips.push('<span class="df flat">현재 장비와 동급</span>');
    }
    return { cmp: cmp, html: chips.join("") };
  }

  // 가방에서 슬롯별로 지금 착용 장비보다 좋은 최선의 장비 찾기
  function scanUpgrades() {
    const out = [];
    ["weapon", "armor", "acc"].forEach((slot) => {
      let best = null;
      let bestPw = 0;
      S.inv.forEach((it) => {
        if (it.slot !== slot) return;
        const pw = G.compareItem(it).power;
        if (pw > bestPw) {
          bestPw = pw;
          best = it;
        }
      });
      if (best) out.push({ slot: slot, it: best, power: bestPw });
    });
    return out;
  }

  // 추천 장착 버튼 라벨 + 가방 탭 알림 점 갱신
  function updateBagTools() {
    const ups = scanUpgrades();
    const btn = $("#btnAutoEquip");
    if (btn) {
      btn.innerHTML = "✨ 추천 장착" + (ups.length ? ' <span class="cnt">' + ups.length + "</span>" : "");
      btn.classList.toggle("has", ups.length > 0);
    }
    $("#dotBag").classList.toggle("show", ups.length > 0 && tab !== "bag");
  }

  function renderBag() {
    const grid = $("#eqGrid");
    grid.innerHTML = "";
    ["weapon", "armor", "acc"].forEach((slot) => {
      const it = S.eq[slot];
      const d = document.createElement("div");
      d.className = "eq-slot" + (it ? " filled" : "");
      if (it) d.style.borderColor = G.RARITY[it.rarity].color + "88";
      d.innerHTML =
        '<div class="sl-name">' + G.SLOTS[slot].name + "</div>" +
        '<div class="sl-ico' + (it ? "" : " empty") + '">' + (it ? "" : "＋") + "</div>" +
        '<div class="sl-item" style="' + (it ? "color:" + G.RARITY[it.rarity].color : "") + '">' +
        (it ? it.name : "비어 있음") + "</div>" +
        (it ? '<div class="sl-plus">+' + (it.lvl || 0) + "</div>" : "") +
        (it && it.lvl ? '<div class="sl-enh">강화 ' + it.lvl + " (+" + it.lvl * 10 + "% 기본 스탯)</div>" : "");
      const iconWrap = d.querySelector(".sl-ico");
      if (it) {
        const spr = G.sprite(G.SLOTS[slot].icon, 3);
        if (spr) {
          const c = document.createElement("canvas");
          c.width = spr.width;
          c.height = spr.height;
          c.getContext("2d").drawImage(spr, 0, 0);
          iconWrap.appendChild(c);
        }
        d.onclick = () => showItemModal(it, true);
      } else {
        d.onclick = () => {
          switchTab("bag");
          toast("가방에서 " + G.SLOTS[slot].name + "을 골라 장착하세요");
        };
      }
      grid.appendChild(d);
    });

    $("#bagPower").textContent = "전투력 " + fmt(stats.power);
    $("#bagMeta").textContent = "장비 " + S.inv.length + " / 60 · 강화석 " + S.stones;
    updateBagTools();
    const list = $("#invList");
    list.innerHTML = "";
    if (S.inv.length === 0) {
      list.innerHTML = '<div class="empty-note">가방이 비어 있습니다.<br />사냥터와 던전에서 장비가 자동으로 드랍됩니다.</div>';
      return;
    }
    const sorted = S.inv.slice().sort((a, b) => G.itemPower(b) - G.itemPower(a));
    sorted.slice(0, 40).forEach((it) => {
      const row = document.createElement("div");
      const dc = diffChips(it);
      const hot = dc.cmp.power >= Math.max(40, stats.power * 0.1);
      row.className = "item-row r" + it.rarity + (dc.cmp.better ? " better" + (hot ? " hot" : "") : "");
      row.innerHTML =
        '<div class="ir-ico"></div>' +
        '<div class="ir-mid"><div class="ir-name">' + it.name +
        (it.lvl ? " <span class='enhb'>강화 +" + it.lvl + "</span>" : "") +
        '</div><div class="ir-stat">' + itemStatsText(it) + "</div>" +
        '<div class="ir-diff">' + dc.html + "</div></div>" +
        '<div class="ir-right">' +
        (dc.cmp.better ? '<span class="upb">▲ UP</span>' : "") +
        '<span class="ir-lv">' + G.SLOTS[it.slot].name + "</span></div>";
      const ic = row.querySelector(".ir-ico");
      const spr = G.sprite(G.SLOTS[it.slot].icon, 2.2);
      if (spr) {
        const c = document.createElement("canvas");
        c.width = spr.width;
        c.height = spr.height;
        c.getContext("2d").drawImage(spr, 0, 0);
        ic.appendChild(c);
      }
      row.onclick = () => showItemModal(it, false);
      list.appendChild(row);
    });
    if (sorted.length > 40) {
      const more = document.createElement("div");
      more.className = "empty-note";
      more.textContent = "…외 " + (sorted.length - 40) + "개";
      list.appendChild(more);
    }
  }

  function showItemModal(it, equipped) {
    const cmp = G.compareItem(it);
    const byKey = {};
    cmp.deltas.forEach((d) => (byKey[d.key] = d));
    const enh = G.enhanceBonus(it);
    const curEnh = cmp.cur ? G.enhanceBonus(cmp.cur) : null;
    const deltaTag = (key) => {
      const d = byKey[key];
      if (!d || Math.abs(d.val) < (d.dec ? 0.05 : 0.5)) return "";
      const up = d.val > 0;
      return ' <i class="dl ' + (up ? "up" : "down") + '">' + (up ? "▲+" : "▼-") + fmtDiff(d.val, d.dec, d.pct) + "</i>";
    };
    const nowPw = cmp.equipped ? stats.power : cmp.nowPower || 0;
    const afterPw = cmp.equipped ? stats.power : cmp.nextPower || 0;
    const pwDelta = afterPw - nowPw;
    const cmpBox = () =>
      '<div class="cmp-box ' + (cmp.better ? "up" : pwDelta < 0 ? "down" : "") + '">' +
      '<div class="cmp-name">' +
      (cmp.cur
        ? '착용 중 <b style="color:' + G.RARITY[cmp.cur.rarity].color + '">' + cmp.cur.name + (cmp.cur.lvl ? " +" + cmp.cur.lvl : "") + "</b>"
        : "빈 슬롯 — 장착하면 모든 능력치가 그대로 오릅니다") +
      "</div>" +
      '<div class="cmp-pw">기본 전투력 <b>' + fmt(nowPw) + "</b> → <b class='af'>" + fmt(afterPw) + "</b>" +
      '<span class="pwd ' + (pwDelta > 0 ? "up" : pwDelta < 0 ? "down" : "") + '">' +
      (pwDelta >= 0 ? "▲+" : "▼-") + fmt(Math.abs(pwDelta)) + "</span></div></div>";

    // 잠재옵션 줄
    const pots = (it.opt || [])
      .map((o) => '<div class="pot-row"><span>' + G.POT_BY_KEY[o.k].name + "</span><b>+" + o.v.toFixed(G.POT_BY_KEY[o.k].dec) + G.POT_BY_KEY[o.k].sign + "</b></div>")
      .join("") || '<div class="pot-none">아직 잠재옵션이 없습니다 · 제련으로 붙일 수 있어요</div>';
    const rc = G.refineCost(it);

    const lines = [];
    if (it.atk) lines.push(["공격력", "+" + Math.round(it.atk), "atk"]);
    if (it.hp) lines.push(["최대 체력", "+" + Math.round(it.hp), "hp"]);
    if (it.def) lines.push(["방어력", "+" + it.def.toFixed(1), "def"]);
    if (it.crit) lines.push(["치명타 확률", "+" + it.crit.toFixed(1) + "%", "crit"]);
    if (it.critDmg) lines.push(["치명타 피해", "+" + Math.round(it.critDmg) + "%", "critDmg"]);

    openModal({
      title: "",
      bodyHTML:
        '<div class="item-head"><div style="flex:1"><div class="ih-n" style="color:' + G.RARITY[it.rarity].color + '">' +
        it.name + (it.lvl ? " +" + it.lvl : "") + "</div>" +
        '<div class="ih-r" style="color:' + G.RARITY[it.rarity].color + '">' + G.RARITY[it.rarity].name + " · " +
        G.SLOTS[it.slot].name + " · Lv." + it.ilvl + "</div></div></div>" +
        '<div class="pot-box"><div class="pot-h">잠재옵션 <span>' + (it.opt && it.opt.length ? it.opt.length + "개" : "없음") + "</span></div>" + pots +
        '<div class="pot-cost">제련 비용 · 던전코인 ' + rc.dc + " · 골드 " + fmt(rc.gold) + "</div></div>" +
        '<div class="base-h">기본 스탯 <span>강화 +N 제외 · 비교 기준</span></div>' +
        '<div class="stat-lines">' +
        lines.map((l) => "<div><span>" + l[0] + "</span><b class='good'>" + l[1] + deltaTag(l[2]) + "</b></div>").join("") +
        "</div>" +
        (cmp.equipped ? '<div class="cmp-box"><div class="cmp-name">현재 착용 중인 장비입니다</div></div>' : cmpBox()) +
        (enh.lvl ? '<div class="enh-note">강화 <b>+' + enh.lvl + "</b> 보너스: 공격 +" + enh.atk + " · 체력 +" + enh.hp + " (기본 스탯 비교에서 제외)</div>" : "") +
        (curEnh && curEnh.lvl && !cmp.equipped
          ? '<div class="enh-note cur">착용 장비 <b>+' + curEnh.lvl + "</b> 강화 보너스: 공격 +" + curEnh.atk + " · 체력 +" + curEnh.hp + " (비교에서 제외)</div>"
          : "") +
        '<div class="cmp">강화 ' + (it.lvl || 0) + "/10 · 다음 강화 강화석 " + G.enhanceCost(it).stones + "개 · 골드 " + fmt(G.enhanceCost(it).gold) + "</div>",
      rows: equipped
        ? [
            [
              {
                label: "강화하기",
                cls: "purple",
                onClick: () => {
                  const r = G.enhance(it);
                  if (!r.ok) return toast(r.msg);
                  stats = G.computeStats();
                  save();
                  renderAll();
                  toast(it.name + " +" + it.lvl + " 강화 성공!", "gold");
                },
              },
              { label: "벗기", cls: "ghost", onClick: () => { G.unequip(it.slot); stats = G.computeStats(); renderAll(); save(); } },
            ],
            [
              {
                label: "제련 (잠재옵션 재설정)",
                cls: "gold",
                keepOpen: false,
                onClick: () => {
                  const r = G.rerollOptions(it);
                  if (!r.ok) return toast(r.msg);
                  sfx("refine");
                  stats = G.computeStats();
                  save();
                  renderAll();
                  const txt = (r.opt || []).map((o) => G.optText(o)).join(", ");
                  toast("제련 완료 · " + (txt || "옵션 없음"), "gold");
                },
              },
              { label: "닫기", cls: "ghost" },
            ],
          ]
        : [
            [
              { label: "장착", cls: "gold", onClick: () => { G.equipItem(it); stats = G.computeStats(); renderAll(); toast(it.name + " 장착!"); } },
              {
                label: "분해",
                cls: "red",
                onClick: () => {
                  const idx = S.inv.indexOf(it);
                  if (idx >= 0) S.inv.splice(idx, 1);
                  G.salvageOne(it);
                  renderAll();
                  save();
                },
              },
            ],
            [
              {
                label: "제련 (잠재옵션 재설정)",
                cls: "gold",
                keepOpen: false,
                onClick: () => {
                  const r = G.rerollOptions(it);
                  if (!r.ok) return toast(r.msg);
                  sfx("refine");
                  stats = G.computeStats();
                  save();
                  renderAll();
                  const txt = (r.opt || []).map((o) => G.optText(o)).join(", ");
                  toast("제련 완료 · " + (txt || "옵션 없음"), "gold");
                },
              },
              { label: "닫기", cls: "ghost" },
            ],
          ],
    });
    const head = document.querySelector(".item-head");
    if (head) head.insertBefore(makeCanvas(G.SLOTS[it.slot].icon, 3.5), head.firstChild);
  }

  /* ---------------------------------------------------------------- 탭 */
  function switchTab(name) {
    tab = name;
    $$(".view").forEach((v) => v.classList.remove("active"));
    const v = $("#view-" + name);
    if (v) v.classList.add("active");
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
    if (name === "field") {
      fieldScene.resize();
      renderField();
      bgm("field");
    }
    if (name === "dungeon") {
      renderDungeon();
      battleScene.resize();
      if (Dungeon.active) {
        battleScene.draw();
        bgm("dungeon");
      } else {
        bgm("field");
      }
    }
    if (name === "grow") renderGrow();
    if (name === "bag") {
      renderBag();
      updateBagTools();
    }
    if (name === "pet" && G.PetsUI) G.PetsUI.render();
    renderQuest();
    renderUlt();
  }

  function bagDot() {
    updateBagTools();
  }

  function maybeDot() {
    let show = false;
    for (let i = 0; i < G.FLOORS.length; i++) {
      const fs = G.floorState(i);
      if (fs.unlocked && !S.floors[i] && S.lv >= G.FLOORS[i].rec - 3) show = true;
    }
    $("#dotDungeon").classList.toggle("show", show && tab !== "dungeon");
    const canUp = G.UPGRADES.some((u) => (S.up[u.id] || 0) < u.max && S.gold >= upgradeCost(u.id));
    $("#dotGrow").classList.toggle("show", canUp && tab !== "grow");
    // 펫 : 조각 합성이 가능하거나 10연차를 돌릴 자원이 있으면 알림
    const shardReady = (S.shards || 0) >= G.SHARD_COST[0];
    const gachaReady = S.gems >= G.chest("legend").cost || S.gold >= G.chest("wood").cost * 10;
    const dotPet = $("#dotPet");
    if (dotPet) dotPet.classList.toggle("show", (shardReady || gachaReady) && tab !== "pet");
    bagDot();
  }

  function renderAll() {
    stats = G.computeStats();
    S.hp = clamp(S.hp, 0, stats.maxHp);
    const wantKey = "job:" + G.job(S.job).id;
    if (fieldScene && fieldScene.heroKey !== wantKey) {
      const job = G.job(S.job);
      fieldScene.setHero(wantKey, job.aura);
      battleScene.setHero(wantKey, job.aura);
    }
    const petKey = stats.pet && stats.pet.id ? G.PETS_BY_ID[stats.pet.id].sprite : null;
    if (fieldScene && fieldScene.pet.key !== petKey) {
      if (fieldScene) fieldScene.setPet(petKey, 2.7);
      if (battleScene) battleScene.setPet(petKey, 3.0);
    }
    renderHud();
    renderAvatar();
    setSkillLabels();
    renderField();
    renderDungeon();
    renderGrow();
    renderBag();
    renderQuest();
    renderUlt();
    renderCombo();
    if (tab === "pet" && G.PetsUI) G.PetsUI.render();
    maybeDot();
  }

  /* -------------------------------------------------------------- 오프라인 */
  function checkOffline(gapArg) {
    const gap = gapArg !== undefined ? gapArg : (Date.now() - (S.lastSeen || Date.now())) / 1000;
    if (gap < 90) return;
    const capped = Math.min(gap, 4 * 3600);
    const stage = Math.max(1, S.stage);
    const st = G.computeStats();
    const avgHp = G.fieldMobHp(stage, G.STAGES[stage - 1].mobs[0]);
    const killTime = Math.max(1.1, avgHp / Math.max(1, st.dps));
    const kills = Math.floor((capped * 0.35) / killTime);
    if (kills < 3) return;
    const gold = Math.round(kills * G.fieldGold(stage) * 0.85 * st.goldMul);
    const exp = Math.round(kills * G.fieldExp(stage) * 0.85);
    openModal({
      icon: "🌙",
      title: "오프라인 사냥 보상",
      sub: G.fmtTime(capped) + " 동안 " + playerName() + " 공주님이 혼자 사냥했습니다 (" + kills + "마리)",
      bodyHTML:
        '<div class="reward-grid"><div class="reward gold"><span class="ico"></span>' + fmt(gold) +
        '<span class="rl">골드</span></div><div class="reward exp"><span class="ico"></span>' + fmt(exp) + '<span class="rl">경험치</span></div></div>',
      rows: [
        [
          {
            label: '광고 보고 2배 받기 <span class="ad-ico">AD</span>',
            cls: "gold",
            onClick: () => {
              G.Ads.show("offline_double", () => {
                S.gold += gold * 2;
                G.addExp(exp * 2);
                stats = G.computeStats();
                renderAll();
                save();
                toast("오프라인 보상 2배 지급!", "gold");
              });
            },
          },
        ],
        [
          {
            label: "그냥 받기",
            cls: "ghost",
            onClick: () => {
              S.gold += gold;
              G.addExp(exp);
              stats = G.computeStats();
              renderAll();
              save();
            },
          },
        ],
      ],
    });
  }

  /* --------------------------------------------------------------- 이벤트 */
  function bind() {
    $$(".tab").forEach((t) => {
      t.addEventListener("click", () => switchTab(t.dataset.tab));
    });
    $("#stagePrev").onclick = () => Field.setStage(S.stage - 1);
    $("#stageNext").onclick = () => {
      if (S.stage + 1 > S.maxStage) {
        toast("다음 사냥터는 스테이지를 클리어하면 열립니다");
        return;
      }
      Field.setStage(S.stage + 1);
    };
    $("#btnAuto").onclick = () => {
      S.auto = !S.auto;
      renderField();
      toast("자동 진행 " + (S.auto ? "ON" : "OFF"));
      save();
    };
    $("#btnDouble").onclick = () => {
      G.Ads.show("reward_double", () => {
        buffUntil = Date.now() + 90000;
        renderField();
        toast("90초 동안 골드·경험치 2배!", "gold");
      });
    };
    $("#btnChest").onclick = () => {
      G.Ads.show("reward_chest", () => {
        S.stones += 3;
        renderAll();
        toast("강화석 3개 획득!", "gold");
      });
    };
    $("#btnFreeGem").onclick = () => {
      G.Ads.show("reward_gem", () => {
        S.gems += 10;
        renderHud();
        toast("보석 10개 획득!", "gold");
      });
    };
    const btnJob = $("#btnChangeJob");
    if (btnJob) btnJob.onclick = () => G.JobPick && G.JobPick.open({ mode: "change" });
    const rushGo = document.querySelector("#rushCard .rc-go");
    if (rushGo) {
      rushGo.onclick = () => {
        if (Dungeon.active) return;
        openModal({
          icon: "♾️",
          title: "무한의 시련",
          sub: "끝없이 이어지는 보스 행렬입니다. 쓰러질 때까지 도전하고 최고 기록을 세우세요.<br />보스마다 골드·보석·던전코인, 5보스마다 펫 조각을 줍니다.",
          rows: [
            [
              { label: "도전 시작", cls: "gold", onClick: () => Dungeon.startRush() },
              { label: "취소", cls: "ghost" },
            ],
          ],
        });
      };
    }
    $("#btnSort").onclick = () => {
      S.inv.sort((a, b) => G.itemPower(b) - G.itemPower(a));
      renderBag();
      toast("전투력 순으로 정렬했습니다");
    };
    $("#btnAutoEquip").onclick = () => {
      const before = stats.power;
      let n = 0;
      ["weapon", "armor", "acc"].forEach((slot) => {
        let best = null;
        let bestPw = 0;
        S.inv.slice().forEach((it) => {
          if (it.slot !== slot) return;
          const pw = G.compareItem(it).power;
          if (pw > bestPw) {
            bestPw = pw;
            best = it;
          }
        });
        if (best) {
          G.equipItem(best);
          stats = G.computeStats();
          n++;
        }
      });
      if (!n) {
        toast("이미 가장 좋은 장비를 착용 중입니다");
        return;
      }
      renderAll();
      save();
      sfx("levelup");
      toast("더 좋은 장비 " + n + "개 장착 · 전투력 +" + fmt(stats.power - before), "gold");
    };
    $("#btnSalvage").onclick = () => {
      const rank = { weapon: 0, armor: 1, acc: 2 };
      const cand = S.inv.filter((it) => {
        const eq = S.eq[it.slot];
        return !eq || G.itemPower(it) <= G.itemPower(eq);
      });
      if (cand.length === 0) {
        toast("분해할 장비가 없습니다 (모두 장착보다 좋은 장비)");
        return;
      }
      openModalRows({
        icon: "♻️",
        title: "일괄 분해",
        sub: "장착 중인 장비보다 약한 " + cand.length + "개를 분해합니다.<br />강화석과 골드를 획득합니다.",
        rows: [
          [
            { label: "분해하기", cls: "red", onClick: () => {
                let st = 0, gd = 0;
                cand.forEach((it) => {
                  const r = G.salvageOne(it, true);
                  st += r.stones;
                  gd += r.gold;
                  const i = S.inv.indexOf(it);
                  if (i >= 0) S.inv.splice(i, 1);
                });
                renderAll();
                save();
                toast("분해 완료 · 강화석 +" + st + " · 골드 +" + fmt(gd), "gold");
              } },
            { label: "취소", cls: "ghost" },
          ],
        ],
      });
    };
    $("#btnFlee").onclick = () => {
      if (Dungeon.active) {
        openModalRows({
          title: "던전에서 나갈까요?",
          sub: "진행 상황은 사라집니다.",
          rows: [
            [{ label: "나가기", cls: "red", onClick: () => Dungeon.flee() }, { label: "계속하기", cls: "ghost" }],
          ],
        });
      }
    };
    $("#actAttack").onclick = () => Dungeon.act("attack");
    $("#actSkill1").onclick = () => Dungeon.act("s1");
    $("#actSkill2").onclick = () => Dungeon.act("s2");
    $("#actGuard").onclick = () => Dungeon.act("guard");
    $("#actPotion").onclick = () => Dungeon.act("potion");
    $("#btnAutoBattle").onclick = () => Dungeon.toggleAuto();
    $("#btnUltField").onclick = () => Field.fireUlt();
    $("#btnUlt").onclick = () => Dungeon.act("ult");
    $("#btnQuest").onclick = () => questClaim();
    $("#btnSound").onclick = () => {
      const on = G.Audio ? G.Audio.toggle() : !S.sound;
      S.sound = !!on;
      renderSound();
      save();
    };

    // UI 버튼 클릭음
    document.addEventListener("click", (e) => {
      const t = e.target.closest && e.target.closest(".tab, .btn, .sq, .floor, .hud-sound, .b-exit, .b-auto");
      if (t) sfx("click");
    });

    document.addEventListener("keydown", (e) => {
      if (!Dungeon.active) return;
      if (e.key === "1") Dungeon.act("attack");
      if (e.key === "2") Dungeon.act("s1");
      if (e.key === "3") Dungeon.act("s2");
      if (e.key === "4") Dungeon.act("guard");
      if (e.key === "5") Dungeon.act("potion");
      if (e.key === "6") Dungeon.act("ult");
    });

    window.addEventListener("resize", () => {
      fieldScene.resize();
      battleScene.resize();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) save();
    });
    window.addEventListener("beforeunload", save);
  }

  /* --------------------------------------------------------------- 루프 */
  let lastT = 0;
  function loop(now) {
    if (!lastT) lastT = now;
    const dt = Math.min(0.06, (now - lastT) / 1000);
    lastT = now;

    // 타이틀·컷신·닉네임 화면에서는 게임을 잠시 멈춘다 (시간·사냥·저장 모두 정지)
    if (G.titleActive) {
      requestAnimationFrame(loop);
      return;
    }

    S.playtime += dt;
    Combo.update(dt);
    Field.update(dt);

    if (tab === "field") {
      fieldScene.update(dt);
      fieldScene.draw();
    }
    if (Dungeon.active) {
      battleScene.update(dt);
      battleScene.draw();
    }
    if (now - lastSave > 5000) {
      lastSave = now;
      save();
    }
    requestAnimationFrame(loop);
  }

  // 사냥터 HUD 숫자 주기적 갱신 (버프 타이머 등)
  setInterval(() => {
    if (tab === "field") renderField();
    renderHud();
  }, 1000);

  G.onLevelUp = function (n) {
    stats = G.computeStats();
    fieldScene.ring(fieldScene.hero.x, fieldScene.groundY - 30, "#ffe9a8");
    fieldScene.text(fieldScene.hero.x, fieldScene.groundY - 70, "LEVEL UP!", "#ffe9a8", 18, 1.4);
    fieldScene.burst(fieldScene.hero.x, fieldScene.groundY - 30, "#ffe9a8", 16, 90);
    sfx("levelup");
    toast("레벨 업! Lv." + S.lv + " · 체력 회복", "gold");
    renderHud();
    renderGrow();
  };

  /* ------------------------------------------------- 직업 · 펫 시각 반영 */
  function applyJobVisuals() {
    const job = G.job(S.job);
    const key = "job:" + job.id;
    if (fieldScene) fieldScene.setHero(key, job.aura);
    if (battleScene) battleScene.setHero(key, job.aura);
    renderAvatar();
    const jc = document.querySelector("#jobCard");
    if (jc) jc.style.setProperty("--jc", job.color);
  }

  function applyPetVisuals() {
    const pet = stats && stats.pet;
    const key = pet && pet.id ? G.PETS_BY_ID[pet.id].sprite : null;
    if (fieldScene) fieldScene.setPet(key, 2.7);
    if (battleScene) battleScene.setPet(key, 3.0);
  }
  G.applyJobVisuals = applyJobVisuals;
  G.applyPetVisuals = applyPetVisuals;

  /* ----------------------------------------------------------------- 초기화 */
  function init() {
    S = G.load();
    const isNew = !S;
    if (!S) S = G.defaultState();
    G.setState(S);
    G.hadSave = !isNew;
    S.pots = S.pots === undefined ? 3 : S.pots;
    S.sound = S.sound !== false;
    S.autoBattle = S.autoBattle !== false;
    Dungeon.auto = S.autoBattle;
    if (!S.quest) S.quest = { idx: 0, prog: 0, done: false };
    S.ult = clamp(S.ult || 0, 0, 100);
    S.playerName = playerName();
    stats = G.computeStats();
    S.hp = S.hp <= 0 ? stats.maxHp : Math.min(S.hp, stats.maxHp);

    fieldScene = new G.Scene($("#scene"), { groundRatio: 0.88, heroX: 0.27, enemyX: 0.73 });
    fieldScene.hero.scale = 3.3;
    battleScene = new G.Scene($("#battleScene"), { groundRatio: 0.88, heroX: 0.26, enemyX: 0.72 });
    battleScene.hero.scale = 3.9;
    applyJobVisuals();
    applyPetVisuals();
    fieldScene.setTheme(Field.stage().theme, 1000 + S.stage * 37);
    Field.spawn();
    Field.atkTimer = 0.4;

    renderAvatar();
    renderSound();
    if (G.Audio) G.Audio.setEnabled(S.sound, true);
    renderAll();
    bind();
    switchTab("field");

    // 이어하기일 때 타이틀을 닫은 뒤 오프라인 보상을 보여준다 (저장으로 lastSeen 이 덮이기 전에 먼저 계산)
    G.pendingOffline = isNew ? 0 : (Date.now() - (S.lastSeen || Date.now())) / 1000;

    requestAnimationFrame(loop);
    // 자동 저장 (타이틀·컷신 화면에서는 저장하지 않는다)
    setInterval(() => {
      if (!G.titleActive) save();
    }, 15000);
  }

  /* ---------------------------------------------------- 타이틀 → 게임 진입 */
  // mode: "new"(첫 모험) | "fresh"(처음부터) | "continue"(이어하기)
  G.enterGame = function (mode) {
    G.titleActive = false;
    lastT = 0;
    lastSave = 0;
    S.seenIntro = true;
    if (!S.playerName) S.playerName = playerName();
    switchTab("field");
    bgm("field");
    renderAll();
    save();
    if (mode === "continue") {
      const away = G.pendingOffline || 0;
      if (away > 90) setTimeout(() => checkOffline(away), 420);
    } else if (!(G.JobPick && (mode === "new" || mode === "fresh"))) {
      setTimeout(
        () => toast("공주 " + playerName() + " · Lv.1 모험 시작! 상단 이름을 탭하면 스토리를 다시 볼 수 있어요", "gold"),
        700
      );
    }
    G.pendingOffline = 0;
    applyJobVisuals();
    applyPetVisuals();
    // 새 모험 : 직업 선택 화면 / 이어하기(구버전) : 전직 안내
    if (G.JobPick) {
      if (mode === "new" || mode === "fresh") {
        setTimeout(() => G.JobPick.open({ mode: "start" }), 900);
      } else if (!S.seenJobs) {
        S.seenJobs = true;
        setTimeout(() => toast("⚔️ 직업 시스템이 열렸어요 · 성장 탭에서 무료로 전직할 수 있습니다", "gold"), 1500);
      }
    }
    return mode === "new" || mode === "fresh";
  };

  /* --------------------------------------------------------------- 처음부터 */
  G.resetProgress = function () {
    try {
      localStorage.removeItem(G.SAVE_KEY);
    } catch (e) {}
    if (Dungeon.active) Dungeon.flee();
    S = G.defaultState();
    G.setState(S);
    stats = G.computeStats();
    S.hp = stats.maxHp;
    S.playerName = playerName();
    Combo.reset(true);
    Field.mob = null;
    Field.spawnDelay = 0.25;
    Field.spawn();
    fieldScene.setTheme(Field.stage().theme, 1000 + S.stage * 37);
    applyJobVisuals();
    applyPetVisuals();
    renderAll();
    renderAvatar();
    save();
    return S;
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 개발용 훅
  /* --- 다른 화면 모듈(펫·상자, 직업 선택)이 쓰는 공용 도구 --- */
  G.openModal = openModal;
  G.closeModal = closeModal;
  G.makeCanvas = makeCanvas;
  G.refreshAll = renderAll;
  G.switchTab = switchTab;
  G.getStats = () => stats;
  G.setStats = (s) => (stats = s);
  G.sfx = sfx;
  G.playerTitle = titleFor;
  G.renderHud = renderHud;
  G.renderAvatar = renderAvatar;
  G.renderGrow = renderGrow;
  G.renderBattle = renderBattle;

  window.Game = {
    get state() {
      return S;
    },
    stats: () => G.computeStats(),
    save,
    tab: switchTab,
    combo: Combo,
    quest: { data: questData, add: questAdd, claim: questClaim },
    ult: { get: () => S.ult, gain: ultGain, ready: ultReady, fire: () => (Dungeon.active ? Dungeon.act("ult") : Field.fireUlt()) },
    dungeon: Dungeon,
    field: Field,
    get scene() {
      return fieldScene;
    },
    get battleScene() {
      return battleScene;
    },
    simulateOffline(minutes) {
      checkOffline(minutes * 60);
    },
    refresh() {
      stats = G.computeStats();
      S.hp = clamp(S.hp, 1, stats.maxHp);
      renderAll();
      save();
    },
    toast,
    renderBattle,
    refreshBattle: renderBattle,
    reset() {
      localStorage.removeItem(G.SAVE_KEY);
      location.reload();
    },
  };
})();
