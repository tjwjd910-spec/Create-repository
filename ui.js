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
    if (lv >= 25) return "전설의 용사";
    if (lv >= 18) return "심연의 정복자";
    if (lv >= 12) return "정식 기사";
    if (lv >= 6) return "견습 기사";
    return "초보 모험가";
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

  /* ------------------------------------------------------------------ HUD */
  function renderHud() {
    const hpPct = clamp((S.hp / stats.maxHp) * 100, 0, 100);
    $("#hudLv").textContent = S.lv;
    $("#hudTitle").textContent = titleFor(S.lv);
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
    const spr = G.sprite("hero", 5);
    if (spr) {
      // 상반신만 크게
      g.drawImage(spr, 18, 0, 64, 64, 0, 0, 96, 96);
    }
  }

  /* --------------------------------------------------------------- 사냥터 */
  const Field = {
    mob: null,
    atkTimer: 0,
    mobTimer: 0,
    respawn: 0,
    spawnDelay: 0,
    clearBanner: 0,
    paused: false,

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
      const key = this.mobKey();
      const m = G.MOBS[key];
      const hp = G.fieldMobHp(S.stage, key);
      this.mob = {
        key,
        name: m.name,
        hp,
        maxHp: hp,
        atk: G.fieldMobAtk(S.stage, key),
        interval: m.interval,
        atkTimer: m.interval * 0.8,
      };
      fieldScene.enemy.key = m.sprite;
      fieldScene.enemy.scale = Math.round(m.scale * 1.35 * 10) / 10;
      fieldScene.enemy.name = m.name;
      fieldScene.enemy.hp = hp;
      fieldScene.enemy.maxHp = hp;
      fieldScene.enemy.spawn = 1;
      fieldScene.enemy.alpha = 1;
      fieldScene.enemy.boss = false;
      fieldScene.enemy.showBar = true;
      this.mobTimer = 0;
      renderField();
    },

    attack() {
      const m = this.mob;
      if (!m || m.hp <= 0) return;
      const crit = Math.random() * 100 < stats.crit;
      let dmg = stats.atk * (0.92 + Math.random() * 0.16);
      if (crit) dmg *= stats.critDmg / 100;
      dmg = Math.max(1, Math.round(dmg));
      m.hp -= dmg;
      fieldScene.hero.lunge = 1;
      fieldScene.slash(
        fieldScene.hero.x + 16,
        fieldScene.groundY - 34,
        fieldScene.enemy.x - 14,
        fieldScene.groundY - 26,
        crit ? "#ffe08a" : "#dff3ff"
      );
      const ex = fieldScene.enemy.x + rnd(-6, 6);
      const ey = fieldScene.groundY - 26 + rnd(-4, 4);
      fieldScene.damage(ex, ey, dmg, crit);
      fieldScene.enemy.flash = 1;
      fieldScene.enemy.hurt = 0.25;
      fieldScene.shake = crit ? 6 : 3;
      if (crit) fieldScene.burst(ex, ey, "#ffe08a", 8, 70);
      if (m.hp <= 0) this.kill();
    },

    kill() {
      const m = this.mob;
      this.mob = null;
      S.kills++;
      S.totalKills = (S.totalKills || 0) + 1;
      const buffMul = Date.now() < buffUntil ? 2 : 1;
      const gold = Math.round(G.fieldGold(S.stage) * stats.goldMul * buffMul * (0.9 + Math.random() * 0.2));
      const exp = Math.round(G.fieldExp(S.stage) * buffMul);
      S.gold += gold;
      fieldScene.enemy.dead = 1;
      fieldScene.enemy.alpha = 0.9;
      fieldScene.burst(fieldScene.enemy.x, fieldScene.groundY - 26, "#ffd479", 14, 110);
      fieldScene.damage(fieldScene.enemy.x - 34, fieldScene.groundY - 40, gold, false, "#ffd479");
      fieldScene.coins(Math.min(5, 2 + Math.floor(gold / 12)), fieldScene.enemy.x, fieldScene.groundY - 30);
      G.addExp(exp);
      // 드랍
      if (Math.random() < 0.075) {
        const it = G.rollItem(S.stage, undefined);
        G.addItem(it);
        fieldScene.text(fieldScene.enemy.x + 10, fieldScene.groundY - 88, "장비 획득!", G.RARITY[it.rarity].color, 13);
        bagDot(true);
        if (S.inv.length <= 60) renderBag();
      } else if (Math.random() < 0.05 && S.pots < 9) {
        S.pots++;
        fieldScene.text(fieldScene.enemy.x, fieldScene.groundY - 76, "포션 +1", "#7bffa0", 12);
      }
      if (S.kills >= G.KILLS_PER_STAGE) {
        this.clearStage();
      } else {
        this.spawnDelay = 0.5;
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
      this.atkTimer -= dt;
      if (this.atkTimer <= 0) {
        this.atkTimer = 1 / stats.aspd;
        this.attack();
      }
      if (!this.mob) return;
      this.mobTimer += dt;
      if (this.mobTimer >= m.interval) {
        this.mobTimer = 0;
        this.hitPlayer(m);
      }
    },

    hitPlayer(m) {
      let dmg = Math.max(1, Math.round(m.atk * (0.9 + Math.random() * 0.2) - stats.def * 0.5));
      S.hp -= dmg;
      fieldScene.hero.hurt = 1;
      fieldScene.hurtFlash = 1;
      fieldScene.damage(fieldScene.hero.x + 26 + rnd(-4, 4), fieldScene.groundY - 44, dmg, false, "#ff8a7a");
      fieldScene.shake = 2;
      if (S.hp <= 0) {
        S.hp = 0;
        this.playerDown();
      }
      renderHud();
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
    cds: { smash: 0, flame: 0 },
    busy: false,
    guarding: false,
    burn: 0,
    burnDmg: 0,
    runPotions: 0,
    logLines: [],

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
      Field.paused = true;
      this.wave = 0;
      this.turn = 1;
      this.cds = { smash: 0, flame: 0 };
      this.burn = 0;
      this.busy = false;
      this.guarding = false;
      this.logLines = [];
      this.runPotions = 0;
      S.hp = stats.maxHp;
      $("#battle").classList.add("on");
      requestAnimationFrame(() => battleScene.resize());
      battleScene.setTheme(["grave", "grave", "camp", "lava", "abyss"][idx], 900 + idx * 13);
      battleScene.enemy.scale = 4.1;
      this.spawnWave();
      this.log("sys", "던전 입장 · " + f.name);
      renderBattle();
      renderHud();
    },

    spawnWave() {
      const f = this.floor();
      const isBoss = this.wave >= f.waves;
      let key, name, hp, atk;
      if (isBoss) {
        key = f.boss.key;
        name = f.boss.name;
        hp = f.boss.hp;
        atk = f.boss.atk;
      } else {
        const st = G.STAGES[Math.min(3 + this.floorIdx, G.STAGES.length - 1)];
        key = G.pick(st.mobs);
        name = G.MOBS[key].name;
        hp = Math.round(f.hp * (1 + this.wave * 0.16));
        atk = Math.round(f.atk * (1 + this.wave * 0.06));
      }
      this.enemy = {
        key,
        name,
        hp,
        maxHp: hp,
        atk,
        boss: isBoss,
        enraged: false,
        flash: 0,
      };
      battleScene.enemy.key = G.MOBS[key].sprite;
      battleScene.enemy.name = isBoss ? name : "";
      battleScene.enemy.scale = isBoss ? 5.2 : 4.0;
      battleScene.enemy.hp = hp;
      battleScene.enemy.maxHp = hp;
      battleScene.enemy.spawn = 1;
      battleScene.enemy.alpha = 1;
      battleScene.enemy.boss = isBoss;
      battleScene.enemy.showBar = false;
      this.intent = this.makeIntent();
      if (isBoss) this.log("sys", "보스 등장! " + name);
      renderBattle();
    },

    makeIntent() {
      const e = this.enemy;
      if (!e) return { type: "attack", mult: 1, label: "공격" };
      const heavyChance = e.boss ? 0.45 : 0.3;
      if (Math.random() < heavyChance) {
        return { type: "heavy", mult: e.boss ? 1.7 : 1.5, label: "강타" };
      }
      if (e.boss && Math.random() < 0.2) {
        return { type: "buff", mult: 0, label: "기 합성" };
      }
      return { type: "attack", mult: 1, label: "베기" };
    },

    log(kind, text) {
      const el = $("#bLog");
      const p = document.createElement("p");
      if (kind === "dmg") p.className = "hl";
      else if (kind === "crit") p.className = "crit";
      else if (kind === "heal") p.className = "heal";
      else if (kind === "sys") p.className = "sys";
      p.innerHTML = text;
      el.appendChild(p);
      while (el.children.length > 40) el.removeChild(el.firstChild);
      el.scrollTop = el.scrollHeight;
    },

    playerDamage(mult) {
      const crit = Math.random() * 100 < stats.crit;
      let dmg = stats.atk * mult * (0.93 + Math.random() * 0.14);
      if (crit) dmg *= stats.critDmg / 100;
      return { dmg: Math.max(1, Math.round(dmg)), crit };
    },

    act(kind) {
      if (!this.active || this.busy || !this.enemy || this.enemy.hp <= 0) return;
      const e = this.enemy;
      this.busy = true;
      this.guarding = false;
      battleScene.guardFx(false);
      let dmg = 0;
      let crit = false;

      if (kind === "attack") {
        const r = this.playerDamage(1);
        dmg = r.dmg;
        crit = r.crit;
        battleScene.hero.lunge = 1;
        battleScene.slash(battleScene.hero.x + 18, battleScene.groundY - 40, battleScene.enemy.x - 18, battleScene.groundY - 30, crit ? "#ffe08a" : "#dff3ff");
      } else if (kind === "smash") {
        if (this.cds.smash > 0) return (this.busy = false);
        const r = this.playerDamage(2.1);
        dmg = r.dmg;
        crit = r.crit;
        this.cds.smash = 3;
        battleScene.hero.lunge = 1;
        battleScene.shake = 10;
        battleScene.slash(battleScene.hero.x + 18, battleScene.groundY - 46, battleScene.enemy.x - 14, battleScene.groundY - 24, "#ffd479");
        battleScene.burst(battleScene.enemy.x, battleScene.groundY - 30, "#ffd479", 12, 120);
      } else if (kind === "flame") {
        if (this.cds.flame > 0) return (this.busy = false);
        const r = this.playerDamage(1.5);
        dmg = r.dmg;
        crit = r.crit;
        this.cds.flame = 3;
        this.burn = 3;
        this.burnDmg = Math.max(1, Math.round(stats.atk * 0.32));
        battleScene.hero.lunge = 1;
        battleScene.slash(battleScene.hero.x + 18, battleScene.groundY - 40, battleScene.enemy.x - 16, battleScene.groundY - 26, "#ff8a3d");
        battleScene.burst(battleScene.enemy.x, battleScene.groundY - 30, "#ff7a32", 16, 130);
      } else if (kind === "guard") {
        this.guarding = true;
        battleScene.guardFx(true);
        this.log("sys", "방어 태세! 다음 공격 피해 70% 감소 + 반격");
        renderBattle();
        setTimeout(() => this.enemyTurn(), 320);
        return;
      } else if (kind === "potion") {
        if (S.pots <= 0) {
          this.log("sys", "포션이 없습니다");
          this.busy = false;
          renderBattle();
          return;
        }
        S.pots--;
        const heal = Math.round(stats.maxHp * 0.45);
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + heal);
        battleScene.burst(battleScene.hero.x, battleScene.groundY - 26, "#7bffa0", 14, 70);
        battleScene.text(battleScene.hero.x, battleScene.groundY - 62, "+" + Math.round(S.hp - before), "#7bffa0", 16);
        this.log("heal", "포션 사용 · 체력 <b>+" + Math.round(S.hp - before) + "</b>");
        renderHud();
        renderBattle();
        setTimeout(() => this.enemyTurn(), 380);
        return;
      }

      e.hp -= dmg;
      e.flash = 1;
      battleScene.enemy.flash = 1;
      battleScene.enemy.hurt = 0.28;
      battleScene.damage(battleScene.enemy.x + rnd(-8, 8), battleScene.groundY - 40, dmg, crit);
      if (kind === "smash") battleScene.text(battleScene.enemy.x, battleScene.groundY - 64, "강타!", "#ffd479", 14);
      if (kind === "flame") battleScene.text(battleScene.enemy.x, battleScene.groundY - 64, "화염!", "#ff8a3d", 14);
      this.log(crit ? "crit" : "dmg", (crit ? "치명타! " : "") + e.name + "에게 <b>" + fmt(dmg) + "</b> 피해");
      renderBattle();
      if (e.boss && !e.enraged && e.hp <= e.maxHp * 0.5 && e.hp > 0) {
        e.enraged = true;
        e.atk = Math.round(e.atk * 1.3);
        battleScene.ring(battleScene.enemy.x, battleScene.groundY - 40, "#ff5a4a");
        battleScene.text(battleScene.enemy.x, battleScene.groundY - 78, "광폭화!", "#ff5a4a", 16);
        this.log("crit", e.name + "이 광폭화했습니다!");
      }
      if (e.hp <= 0) {
        e.hp = 0;
        setTimeout(() => this.enemyDown(), 420);
        return;
      }
      setTimeout(() => this.enemyTurn(), 520);
    },

    enemyTurn() {
      if (!this.active) return;
      const e = this.enemy;
      if (!e || e.hp <= 0) return;
      const it = this.intent;
      // 화상 지속 피해
      if (this.burn > 0) {
        e.hp = Math.max(0, e.hp - this.burnDmg);
        this.burn--;
        battleScene.damage(e.x || battleScene.enemy.x, battleScene.groundY - 50, this.burnDmg, false, "#ff8a3d");
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
        this.log("sys", e.name + "이 기를 모아 공격력이 상승했습니다");
        this.finishTurn();
        return;
      }
      let raw = Math.round(e.atk * it.mult * (0.9 + Math.random() * 0.2));
      let dmg = Math.max(1, Math.round(raw - stats.def * 0.6));
      if (this.guarding) dmg = Math.max(1, Math.round(dmg * 0.3));
      S.hp -= dmg;
      battleScene.hero.hurt = 1;
      battleScene.hurtFlash = 1;
      battleScene.shake = it.type === "heavy" ? 9 : 4;
      battleScene.damage(battleScene.hero.x + rnd(-5, 5), battleScene.groundY - 48, dmg, false, "#ff8a7a");
      battleScene.enemy.lunge = 0;
      this.log("dmg", (it.type === "heavy" ? "강타! " : "") + e.name + "의 공격 <b>" + fmt(dmg) + "</b> 피해" + (this.guarding ? " (방어)" : ""));
      if (this.guarding) {
        const c = Math.max(1, Math.round(stats.atk * 0.8));
        e.hp = Math.max(0, e.hp - c);
        battleScene.enemy.flash = 1;
        battleScene.damage(battleScene.enemy.x, battleScene.groundY - 40, c, false, "#8fd8ff");
        battleScene.slash(battleScene.enemy.x, battleScene.groundY - 36, battleScene.enemy.x - 40, battleScene.groundY - 20, "#8fd8ff");
        this.log("dmg", "반격! <b>" + fmt(c) + "</b> 피해");
        if (e.hp <= 0) {
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
      if (this.cds.smash > 0) this.cds.smash--;
      if (this.cds.flame > 0) this.cds.flame--;
      this.intent = this.makeIntent();
      renderBattle();
    },

    enemyDown() {
      const e = this.enemy;
      battleScene.enemy.alpha = 0.15;
      battleScene.burst(battleScene.enemy.x, battleScene.groundY - 30, "#ffd479", 20, 150);
      const isBoss = this.wave >= this.floor().waves;
      if (!isBoss) {
        this.wave++;
        this.turn++;
        this.busy = false;
        this.cds.smash = Math.max(0, this.cds.smash - 1);
        this.cds.flame = Math.max(0, this.cds.flame - 1);
        const heal = Math.round(stats.maxHp * 0.18);
        const before = S.hp;
        S.hp = Math.min(stats.maxHp, S.hp + heal);
        if (S.hp > before) {
          battleScene.burst(battleScene.hero.x, battleScene.groundY - 28, "#7bffa0", 10, 60);
          this.log("heal", "웨이브 클리어 · 체력 <b>+" + (S.hp - before) + "</b> 회복");
        } else {
          this.log("sys", "적 처치! 다음 상대가 등장합니다");
        }
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
      const rarity = this.floorIdx >= 3 ? 2 : this.floorIdx === 2 ? 1 : 0;
      const it = G.rollItem(this.floorIdx + 2, Math.min(3, rarity + (Math.random() < 0.25 ? 1 : 0)));
      G.addItem(it);
      this.active = false;
      Field.paused = false;
      $("#battle").classList.remove("on");
      battleScene.enemy.alpha = 1;
      save();
      const rows = [
        '<div class="reward gold"><span class="ico"></span>' + fmt(f.reward.gold) + '<span class="rl">골드</span></div>',
        '<div class="reward dc"><span class="ico"></span>' + f.reward.dc + '<span class="rl">던전코인</span></div>',
        '<div class="reward gem"><span class="ico"></span>' + f.reward.gem + '<span class="rl">보석</span></div>',
        '<div class="reward stone"><span class="ico"></span>' + f.reward.stone + '<span class="rl">강화석</span></div>',
      ].join("");
      const itemLine =
        '<div class="item-head" style="margin-top:10px"><div style="flex:1">' +
        '<div class="ih-n" style="color:' + G.RARITY[it.rarity].color + '">' + it.name + "</div>" +
        '<div class="ih-r" style="color:' + G.RARITY[it.rarity].color + '">' + G.RARITY[it.rarity].name + " · " + it.slot + "</div></div></div>";
      openModal({
        icon: "🏆",
        title: this.floorIdx === 4 ? "심연 정복!" : f.floor + "층 클리어!",
        sub: (this.floorIdx < 4 ? "다음 층이 개방되었습니다" : "모든 층을 정복했습니다") + " · " + (first ? "첫 클리어 보상" : "재도전 보상"),
        bodyHTML:
          '<div class="reward-grid">' + rows + "</div>" +
          '<div style="font-size:10.5px;color:var(--dim);text-align:center;margin-bottom:6px">획득 장비</div>' +
          '<div style="text-align:center;font-weight:800;color:' + G.RARITY[it.rarity].color + ';font-size:12.5px">' +
          it.name + ' <span style="color:var(--gold);font-family:var(--mono)">[' + G.RARITY[it.rarity].name + "]</span></div>",
        buttons: [
          {
            label: "계속 사냥하기",
            cls: "gold",
            onClick: () => {
              renderAll();
              switchTab("field");
            },
          },
        ],
      });
      renderAll();
      maybeDot();
    },

    die() {
      this.busy = true;
      this.log("sys", "쓰러졌습니다...");
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
      this.active = false;
      Field.paused = false;
      this.busy = false;
      $("#battle").classList.remove("on");
      battleScene.hero.alpha = 1;
      battleScene.guardFx(false);
      toast("던전에서 나왔습니다");
      renderAll();
    },
  };

  function renderBattle() {
    const e = Dungeon.enemy;
    if (!e) return;
    const isBoss = Dungeon.wave >= Dungeon.floor().waves;
    $("#bEnemyName").textContent = (isBoss ? "👑 " : "") + e.name;
    $("#bTurn").textContent = "TURN " + Dungeon.turn + " · " + (isBoss ? "BOSS" : "WAVE " + (Dungeon.wave + 1) + "/" + Dungeon.floor().waves);
    $("#bHpNum").textContent = Math.ceil(Math.max(0, S.hp)) + "/" + stats.maxHp;
    $("#bHpFill").style.width = clamp((S.hp / stats.maxHp) * 100, 0, 100).toFixed(1) + "%";
    $("#bEhpNum").textContent = Math.max(0, Math.ceil(e.hp)) + "/" + e.maxHp;
    $("#bEhFill").style.width = clamp((e.hp / e.maxHp) * 100, 0, 100).toFixed(1) + "%";
    const intent = Dungeon.intent;
    const el = $("#intent");
    if (intent) {
      const dmgTxt = intent.type === "buff" ? "공격력 ↑" : "약 " + Math.round(e.atk * intent.mult) + " 피해";
      el.className = "intent" + (intent.type === "heavy" ? " heavy" : "");
      el.innerHTML =
        '<span class="ii">' +
        (intent.type === "heavy" ? "⚠️" : intent.type === "buff" ? "✨" : "🗡️") +
        "</span> 다음: " +
        intent.label +
        " · " +
        dmgTxt;
    }
    $("#potCount").textContent = S.pots;
    $("#actPotion").disabled = S.pots <= 0 || Dungeon.busy;
    $("#actAttack").disabled = Dungeon.busy;
    $("#actSmash").disabled = Dungeon.busy || Dungeon.cds.smash > 0;
    $("#actFlame").disabled = Dungeon.busy || Dungeon.cds.flame > 0;
    $("#actGuard").disabled = Dungeon.busy;
    const cdS = $("#cdSmash");
    cdS.textContent = Dungeon.cds.smash || "";
    cdS.style.display = Dungeon.cds.smash > 0 ? "grid" : "none";
    const cdF = $("#cdFlame");
    cdF.textContent = Dungeon.cds.flame || "";
    cdF.style.display = Dungeon.cds.flame > 0 ? "grid" : "none";
    battleScene.enemy.hp = e.hp;
    battleScene.enemy.maxHp = e.maxHp;
  }

  function renderDungeon() {
    const wrap = $("#floorList");
    wrap.innerHTML = "";
    G.FLOORS.forEach((f, i) => {
      const fs = G.floorState(i);
      const div = document.createElement("div");
      div.className = "floor" + (!fs.unlocked ? " locked" : "") + (fs.cleared ? " cleared" : "");
      const lockedNote = !fs.unlocked;
      div.innerHTML =
        '<div class="ficon"></div>' +
        '<div class="finfo">' +
        '<div class="fname"><span class="fl">' + f.floor + "F</span> " + (lockedNote ? "???" : f.name) +
        (fs.cleared ? ' <span class="tagmini ok">클리어</span>' : "") +
        (!lockedNote && !fs.cleared && i > 0 && !S.floors[i] ? ' <span class="tagmini boss">NEW</span>' : "") +
        "</div>" +
        '<div class="fmeta">' +
        "<span>권장 Lv." + f.rec + "</span>" +
        "<span>보스 " + (lockedNote ? "???" : f.boss.name) + "</span>" +
        "<span>보상 " + f.reward.dc + "코인</span>" +
        "</div></div>" +
        '<div class="fgo">' + (lockedNote ? "잠김" : fs.cleared ? "재도전" : "입장") + "</div>";
      const iconWrap = div.querySelector(".ficon");
      if (!lockedNote) {
        const spr = G.sprite(G.MOBS[f.boss.key].sprite, 2);
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
  }

  /* ---------------------------------------------------------------- 가방 */
  function itemStatsText(it) {
    const m = 1 + (it.lvl || 0) * 0.1;
    const parts = [];
    if (it.atk) parts.push("공격 +" + Math.round(it.atk * m));
    if (it.hp) parts.push("체력 +" + Math.round(it.hp * m));
    if (it.def) parts.push("방어 +" + (it.def * m).toFixed(1));
    if (it.crit) parts.push("치명 " + (it.crit * m).toFixed(1) + "%");
    if (it.critDmg) parts.push("치피 +" + Math.round(it.critDmg * m) + "%");
    return parts.join(" · ");
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
        (it ? '<div class="sl-plus">+' + (it.lvl || 0) + "</div>" : "");
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
    const list = $("#invList");
    list.innerHTML = "";
    if (S.inv.length === 0) {
      list.innerHTML = '<div class="empty-note">가방이 비어 있습니다.<br />사냥터와 던전에서 장비가 자동으로 드랍됩니다.</div>';
      return;
    }
    const sorted = S.inv.slice().sort((a, b) => G.itemPower(b) - G.itemPower(a));
    sorted.slice(0, 40).forEach((it) => {
      const row = document.createElement("div");
      row.className = "item-row r" + it.rarity;
      row.innerHTML =
        '<div class="ir-ico"></div>' +
        '<div class="ir-mid"><div class="ir-name">' + it.name +
        (it.lvl ? " <span style='color:var(--gold);font-family:var(--mono)'>+" + it.lvl + "</span>" : "") +
        '</div><div class="ir-stat">' + itemStatsText(it) + "</div></div>" +
        '<div class="ir-lv">' + G.SLOTS[it.slot].name + "</div>";
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
    const cur = S.eq[it.slot];
    const m = 1 + (it.lvl || 0) * 0.1;
    const delta = G.itemPower(it) - (cur && cur !== it ? G.itemPower(cur) : 0);
    const lines = [];
    if (it.atk) lines.push(["공격력", "+" + Math.round(it.atk * m)]);
    if (it.hp) lines.push(["최대 체력", "+" + Math.round(it.hp * m)]);
    if (it.def) lines.push(["방어력", "+" + (it.def * m).toFixed(1)]);
    if (it.crit) lines.push(["치명타 확률", "+" + (it.crit * m).toFixed(1) + "%"]);
    if (it.critDmg) lines.push(["치명타 피해", "+" + Math.round(it.critDmg * m) + "%"]);
    const c = G.enhanceCost(it);
    openModal({
      title: "",
      bodyHTML:
        '<div class="item-head"><div style="flex:1"><div class="ih-n" style="color:' + G.RARITY[it.rarity].color + '">' +
        it.name + (it.lvl ? " +" + it.lvl : "") + "</div>" +
        '<div class="ih-r" style="color:' + G.RARITY[it.rarity].color + '">' + G.RARITY[it.rarity].name + " · " +
        G.SLOTS[it.slot].name + " · Lv." + it.ilvl + "</div></div></div>" +
        '<div class="stat-lines">' +
        lines.map((l) => "<div><span>" + l[0] + "</span><b class='good'>" + l[1] + "</b></div>").join("") +
        "</div>" +
        (cur && cur !== it
          ? '<div class="cmp">현재 장착 대비 전투력 <b class="' + (delta < 0 ? "down" : "") + '">' + (delta >= 0 ? "+" : "") + delta + "</b></div>"
          : "") +
        '<div class="cmp">강화 ' + (it.lvl || 0) + "/10 · 다음 강화 강화석 " + c.stones + "개 · 골드 " + fmt(c.gold) + "</div>",
      rows: equipped
        ? [
            [
              { label: "강화하기", cls: "purple", keepOpen: false, onClick: () => {
                  const r = G.enhance(it);
                  if (!r.ok) return toast(r.msg);
                  stats = G.computeStats();
                  save();
                  renderAll();
                  toast(it.name + " +" + it.lvl + " 강화 성공!", "gold");
                } },
              { label: "벗기", cls: "ghost", onClick: () => { G.unequip(it.slot); stats = G.computeStats(); renderAll(); save(); } },
            ],
            [{ label: "닫기", cls: "ghost" }],
          ]
        : [
            [
              { label: "장착", cls: "gold", onClick: () => { G.equipItem(it); stats = G.computeStats(); renderAll(); toast(it.name + " 장착!"); } },
              { label: "분해", cls: "red", onClick: () => {
                  const idx = S.inv.indexOf(it);
                  if (idx >= 0) S.inv.splice(idx, 1);
                  G.salvageOne(it);
                  renderAll();
                  save();
                } },
            ],
            [{ label: "닫기", cls: "ghost" }],
          ],
    });
    const head = document.querySelector(".item-head");
    if (head) {
      head.insertBefore(makeCanvas(G.SLOTS[it.slot].icon, 3.5), head.firstChild);
    }
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
    }
    if (name === "dungeon") {
      renderDungeon();
      battleScene.resize();
      if (Dungeon.active) battleScene.draw();
    }
    if (name === "grow") renderGrow();
    if (name === "bag") {
      renderBag();
      bagDot(false);
    }
  }

  function bagDot(on) {
    $("#dotBag").classList.toggle("show", !!on);
  }

  function maybeDot() {
    let show = false;
    for (let i = 0; i < 5; i++) {
      const fs = G.floorState(i);
      if (fs.unlocked && !S.floors[i] && S.lv >= G.FLOORS[i].rec - 3) show = true;
    }
    $("#dotDungeon").classList.toggle("show", show && tab !== "dungeon");
    const canUp = G.UPGRADES.some((u) => (S.up[u.id] || 0) < u.max && S.gold >= upgradeCost(u.id));
    $("#dotGrow").classList.toggle("show", canUp && tab !== "grow");
  }

  function renderAll() {
    stats = G.computeStats();
    S.hp = clamp(S.hp, 0, stats.maxHp);
    renderHud();
    renderField();
    renderDungeon();
    renderGrow();
    renderBag();
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
      sub: G.fmtTime(capped) + " 동안 용사가 혼자 사냥했습니다 (" + kills + "마리)",
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
    $("#btnSort").onclick = () => {
      S.inv.sort((a, b) => G.itemPower(b) - G.itemPower(a));
      renderBag();
      toast("전투력 순으로 정렬했습니다");
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
    $("#actSmash").onclick = () => Dungeon.act("smash");
    $("#actFlame").onclick = () => Dungeon.act("flame");
    $("#actGuard").onclick = () => Dungeon.act("guard");
    $("#actPotion").onclick = () => Dungeon.act("potion");

    document.addEventListener("keydown", (e) => {
      if (!Dungeon.active) return;
      if (e.key === "1") Dungeon.act("attack");
      if (e.key === "2") Dungeon.act("smash");
      if (e.key === "3") Dungeon.act("flame");
      if (e.key === "4") Dungeon.act("guard");
      if (e.key === "5") Dungeon.act("potion");
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

    S.playtime += dt;
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
    toast("레벨 업! Lv." + S.lv + " · 체력 회복", "gold");
    renderHud();
    renderGrow();
  };

  /* ----------------------------------------------------------------- 초기화 */
  function init() {
    S = G.load();
    const isNew = !S;
    if (!S) S = G.defaultState();
    G.setState(S);
    S.pots = S.pots === undefined ? 3 : S.pots;
    stats = G.computeStats();
    S.hp = S.hp <= 0 ? stats.maxHp : Math.min(S.hp, stats.maxHp);

    fieldScene = new G.Scene($("#scene"), { groundRatio: 0.88, heroX: 0.27, enemyX: 0.73 });
    fieldScene.hero.scale = 4;
    battleScene = new G.Scene($("#battleScene"), { groundRatio: 0.88, heroX: 0.26, enemyX: 0.72 });
    battleScene.hero.scale = 4.6;
    fieldScene.setTheme(Field.stage().theme, 1000 + S.stage * 37);
    Field.spawn();
    Field.atkTimer = 0.4;

    renderAvatar();
    renderAll();
    bind();
    switchTab("field");

    if (isNew) {
      setTimeout(() => {
        openModalRows({
          icon: "⚔️",
          title: "던전 크루세이더",
          sub: "사냥터는 자동으로 사냥하고,<br />던전은 직접 턴을 골라 공략하는 하이브리드 RPG입니다.",
          bodyHTML:
            '<div style="font-size:11px;line-height:1.7;color:#bdb4d8">' +
            "· <b style='color:#f5c451'>사냥터</b> : 켜두면 알아서 사냥하며 골드·경험치·장비를 모읍니다.<br />" +
            "· <b style='color:#f5c451'>던전</b> : 1~5층 보스를 수동 턴제로 공략합니다.<br />" +
            "· <b style='color:#f5c451'>성장</b> : 골드로 스탯을, 강화석으로 장비를 강화합니다.</div>",
          rows: [[{ label: "모험 시작!", cls: "gold", onClick: () => {} }]],
        });
      }, 350);
    } else {
      const away = (Date.now() - (S.lastSeen || Date.now())) / 1000;
      save();
      setTimeout(() => checkOffline(away), 450);
    }

    requestAnimationFrame(loop);
    // 자동 저장
    setInterval(() => save(), 15000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 개발용 훅
  window.Game = {
    get state() {
      return S;
    },
    stats: () => G.computeStats(),
    save,
    tab: switchTab,
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
    reset() {
      localStorage.removeItem(G.SAVE_KEY);
      location.reload();
    },
  };
})();
