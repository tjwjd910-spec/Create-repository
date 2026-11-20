/* =========================================================================
 *  던전 크루세이더 — pets.js
 *  펫 · 상자깡(소환) · 조각 합성 · 승급 화면
 * ========================================================================= */
(function () {
  "use strict";
  const G = window.G;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));

  const S = () => G.getState();
  const stats = () => G.getStats();
  const fmt = G.fmt;

  const R = (i) => G.RARITY[i];
  const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

  function buffText(p, rank) {
    const mul = 1 + (rank || 0) * 0.2;
    const out = [];
    if (p.atkPct) out.push("공격 +" + (p.atkPct * mul).toFixed(1) + "%");
    if (p.hpPct) out.push("체력 +" + (p.hpPct * mul).toFixed(1) + "%");
    if (p.crit) out.push("치명 +" + (p.crit * mul).toFixed(1) + "%");
    if (p.critDmg) out.push("치피 +" + (p.critDmg * mul).toFixed(0) + "%");
    if (p.goldPct) out.push("골드 +" + (p.goldPct * mul).toFixed(0) + "%");
    if (p.dropPct) out.push("드랍 +" + (p.dropPct * mul).toFixed(0) + "%");
    return out.join(" · ");
  }

  function makePetCanvas(p, scale) {
    const c = G.makeCanvas(p.sprite, scale);
    c.className = "pc-canvas";
    return c;
  }

  /* ------------------------------------------------------------- 동행 펫 */
  function renderEquip() {
    const box = $("#petEquipBox");
    if (!box) return;
    const s = S();
    const st = stats();
    const pet = st.pet;
    box.innerHTML = "";
    const shardLabel = $("#petShardLabel");
    if (shardLabel) shardLabel.textContent = "펫 조각 " + fmt(s.shards || 0);

    if (!pet || !pet.id) {
      const empty = document.createElement("div");
      empty.className = "pet-empty";
      empty.innerHTML = "아직 동행 펫이 없습니다.<br /><b>상자깡</b>으로 첫 펫을 만나 보세요!";
      box.appendChild(empty);
      return;
    }
    const def = G.PETS_BY_ID[pet.id];
    const row = document.createElement("div");
    row.className = "pe-row";
    row.style.setProperty("--rc", R(def.rarity).color);
    row.innerHTML =
      '<div class="pe-ic"></div>' +
      '<div class="pe-mid">' +
      '<div class="pe-nm">' + def.name + ' <span class="pe-stars">' + stars(pet.rank) + "</span></div>" +
      '<div class="pe-rar" style="color:' + R(def.rarity).color + '">' + R(def.rarity).name + " · 승급 ★" + pet.rank + "</div>" +
      '<div class="pe-buff">' + buffText(def, pet.rank) + "</div>" +
      '<div class="pe-skill">' + (G.PET_SKILLS[def.skill] ? G.PET_SKILLS[def.skill].icon + " " + G.PET_SKILLS[def.skill].name + " — " + G.PET_SKILLS[def.skill].desc : "") + "</div>" +
      "</div>";
    const ic = row.querySelector(".pe-ic");
    ic.appendChild(makePetCanvas(def, 3.2));
    const off = document.createElement("button");
    off.className = "btn sm ghost pe-off";
    off.textContent = "해제";
    off.onclick = () => {
      G.equipPet(null);
      G.setStats(G.computeStats());
      G.applyPetVisuals();
      G.refreshAll();
      render();
      G.toast("펫을 해제했습니다");
    };
    row.appendChild(off);
    box.appendChild(row);

    const extra = document.createElement("div");
    extra.className = "pe-extra";
    extra.innerHTML =
      "추가 공격 <b>" + Math.round(pet.hit * 100) + "%</b> · " +
      (pet.turns <= 1 ? "매 턴" : pet.turns + "턴마다") + " 공격 · 3번째 공격마다 보조 스킬";
    box.appendChild(extra);
  }

  /* ------------------------------------------------------------- 상자깡 */
  function renderGacha() {
    const wrap = $("#gachaRow");
    if (!wrap) return;
    const s = S();
    wrap.innerHTML = "";
    G.CHESTS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "g-card ch-" + c.id;
      card.innerHTML =
        '<div class="gc-ico">' + c.icon + "</div>" +
        '<div class="gc-nm">' + c.name + "</div>" +
        '<div class="gc-note">' + c.note + "</div>" +
        '<div class="gc-cost">' + (c.cur === "gold" ? "💰 " : "💎 ") + fmt(c.cost) + "</div>" +
        '<div class="gc-btns">' +
        '<button class="btn sm gold gc-1">1회</button>' +
        '<button class="btn sm purple gc-10">10회</button>' +
        "</div>";
      const cur = c.cur === "gold" ? s.gold : s.gems;
      const b1 = card.querySelector(".gc-1");
      const b10 = card.querySelector(".gc-10");
      b1.disabled = cur < c.cost;
      b10.disabled = cur < Math.round(c.cost * 9);
      b1.onclick = () => pull(c.id, 1);
      b10.onclick = () => pull(c.id, 10);
      wrap.appendChild(card);
    });
  }

  function pull(chestId, count) {
    if (animating) return;
    const s = S();
    const chest = G.chest(chestId);
    const price = Math.round(chest.cost * count * (count >= 10 ? 0.9 : 1));
    const cur = chest.cur === "gold" ? s.gold : s.gems;
    if (cur < price) {
      G.toast(chest.cur === "gold" ? "골드가 부족합니다" : "보석이 부족합니다");
      return;
    }
    if (chest.cur === "gold") s.gold -= price;
    else s.gems -= price;

    const results = [];
    for (let i = 0; i < count; i++) {
      const id = G.rollPetId(chest.rates);
      const got = G.grantPet(id);
      if (got) results.push(got);
    }
    s.stats.petsPulled = (s.stats.petsPulled || 0) + count;
    G.save();
    playGacha(chest, results);
  }

  /* --------------------------------------------------------- 연출 + 결과 */
  let animating = false;
  let pending = null;

  function playGacha(chest, results) {
    animating = true;
    pending = results;
    const root = $("#gacha");
    const stage = $("#gStage");
    const chestEl = $("#gChest");
    const burst = $("#gBurst");
    const title = $("#gTitle");
    const res = $("#gResult");
    const done = $("#btnGachaDone");
    if (!root) return;
    root.classList.add("on");
    root.classList.remove("reveal");
    stage.classList.remove("open");
    chestEl.textContent = chest.icon;
    chestEl.className = "g-chest ch-" + chest.id;
    burst.style.opacity = "0";
    title.textContent = chest.name + " 여는 중…";
    res.innerHTML = "";
    done.hidden = true;
    G.sfx("chestShake");

    const best = results.reduce((m, r) => Math.max(m, r.pet.rarity), 0);
    const timer = setTimeout(() => reveal(chest, results, best), 980);
    stage.onclick = () => {
      clearTimeout(timer);
      reveal(chest, results, best);
    };
  }

  function reveal(chest, results, best) {
    const root = $("#gacha");
    const stage = $("#gStage");
    const burst = $("#gBurst");
    const title = $("#gTitle");
    const res = $("#gResult");
    const done = $("#btnGachaDone");
    if (!root) return;
    root.classList.add("reveal");
    stage.classList.add("open");
    burst.style.opacity = "1";
    title.innerHTML =
      best >= 4
        ? '<span style="color:#ff5ce0">✦ 전설의 펫이 응답했습니다! ✦</span>'
        : best >= 3
        ? '<span style="color:#ffb02e">영웅급 펫 획득!</span>'
        : "펫을 만났습니다!";
    if (best >= 4) G.sfx("gachaLegend");
    else if (best >= 3) G.sfx("gachaRare");
    else G.sfx("chestOpen");

    res.innerHTML = "";
    const cols = Math.min(5, Math.max(1, results.length));
    res.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    res.classList.toggle("few", results.length < 3);
    results.forEach((r, i) => {
      const def = r.pet;
      const card = document.createElement("div");
      card.className = "g-res r" + def.rarity + (r.isNew ? " new" : "");
      card.style.setProperty("--rc", R(def.rarity).color);
      card.style.animationDelay = i * 55 + "ms";
      card.innerHTML =
        '<div class="gr-ic"></div>' +
        '<div class="gr-nm">' + def.name + "</div>" +
        '<div class="gr-rar">' + R(def.rarity).name + "</div>" +
        '<div class="gr-tag">' + (r.isNew ? "NEW" : r.shards ? "조각 +" + r.shards : "승급 ★" + r.rank) + "</div>";
      card.querySelector(".gr-ic").appendChild(makePetCanvas(def, 2.2));
      res.appendChild(card);
    });
    done.hidden = false;
    done.onclick = closeGacha;
  }

  function closeGacha() {
    const root = $("#gacha");
    if (root) root.classList.remove("on");
    animating = false;
    pending = null;
    G.setStats(G.computeStats());
    G.applyPetVisuals();
    G.refreshAll();
    render();
  }

  /* ----------------------------------------------------------- 조각 합성 */
  function synthCost(rarity) {
    return G.SHARD_COST[rarity] || 90;
  }

  function renderShards() {
    const wrap = $("#shardRow");
    if (!wrap) return;
    const s = S();
    const lab = $("#shardLabel");
    if (lab) lab.textContent = "조각 " + fmt(s.shards || 0);
    wrap.innerHTML = "";
    G.RARITY.forEach((r, i) => {
      const cost = synthCost(i);
      const b = document.createElement("button");
      b.className = "shard-btn r" + i;
      b.style.setProperty("--rc", r.color);
      b.innerHTML = "<b>" + r.name + " 펫</b><small>" + cost + " 조각</small>";
      b.disabled = (s.shards || 0) < cost;
      b.onclick = () => {
        if ((s.shards || 0) < cost) return G.toast("펫 조각이 부족합니다");
        s.shards -= cost;
        const id = G.rollPetId(G.RARITY.map((_, k) => (k === i ? 100 : 0)));
        const got = G.grantPet(id);
        G.save();
        G.sfx("petSkill");
        G.setStats(G.computeStats());
        G.applyPetVisuals();
        G.refreshAll();
        render();
        G.toast("합성 성공 · " + got.pet.name + (got.isNew ? " (NEW!)" : got.levelUp ? " 승급 ★" + got.rank : " 조각 +" + got.shards), "gold");
      };
      wrap.appendChild(b);
    });
  }

  /* ------------------------------------------------------------- 펫 목록 */
  function renderGrid() {
    const wrap = $("#petGrid");
    if (!wrap) return;
    const s = S();
    const cnt = $("#petCount");
    const owned = G.PETS.filter((p) => s.pets && s.pets[p.id]);
    if (cnt) cnt.textContent = owned.length + " / " + G.PETS.length;
    wrap.innerHTML = "";
    G.PETS.forEach((p) => {
      const has = !!(s.pets && s.pets[p.id]);
      const rank = has ? s.pets[p.id].rank || 0 : 0;
      const equipped = s.pet === p.id;
      const card = document.createElement("div");
      card.className = "pet-card" + (has ? " on" : " off") + (equipped ? " eq" : "");
      card.style.setProperty("--rc", R(p.rarity).color);
      card.innerHTML =
        '<div class="pc-ic"></div>' +
        '<div class="pc-nm">' + (has ? p.name : "???") + "</div>" +
        '<div class="pc-rar">' + R(p.rarity).name + "</div>" +
        (has ? '<div class="pc-stars">' + stars(rank) + "</div>" : '<div class="pc-stars dim">미보유</div>') +
        (has ? '<div class="pc-buff">' + buffText(p, rank) + "</div>" : "");
      const ic = card.querySelector(".pc-ic");
      ic.appendChild(makePetCanvas(p, 2.1));
      if (!has) {
        card.onclick = () => G.toast("아직 만나지 못한 펫입니다 · 상자깡으로 획득하세요");
        wrap.appendChild(card);
        return;
      }
      const btns = document.createElement("div");
      btns.className = "pc-btns";
      const eq = document.createElement("button");
      eq.className = "btn sm " + (equipped ? "ghost" : "gold");
      eq.textContent = equipped ? "장착 중" : "장착";
      eq.disabled = equipped;
      eq.onclick = () => {
        G.equipPet(p.id);
        G.setStats(G.computeStats());
        G.applyPetVisuals();
        G.refreshAll();
        render();
        G.sfx("on");
        G.toast(p.name + " 동행 시작!", "gold");
      };
      btns.appendChild(eq);
      const upCost = Math.round(synthCost(p.rarity) * 0.7);
      const up = document.createElement("button");
      up.className = "btn sm purple";
      up.innerHTML = rank >= 5 ? "MAX" : "승급<small>" + upCost + " 조각</small>";
      up.disabled = rank >= 5 || (s.shards || 0) < upCost;
      up.onclick = () => {
        if (rank >= 5) return;
        if ((s.shards || 0) < upCost) return G.toast("펫 조각이 부족합니다");
        s.shards -= upCost;
        s.pets[p.id].rank = rank + 1;
        G.save();
        G.sfx("petSkill");
        G.setStats(G.computeStats());
        G.applyPetVisuals();
        G.refreshAll();
        render();
        G.toast(p.name + " 승급! ★" + (rank + 1), "gold");
      };
      btns.appendChild(up);
      card.appendChild(btns);
      wrap.appendChild(card);
    });
  }

  function bindAd() {
    const btn = $("#btnGachaAd");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.onclick = () => {
      if (animating) return;
      G.Ads.show("reward_gacha", () => {
        const chest = G.chest("gold");
        const id = G.rollPetId(chest.rates);
        const got = G.grantPet(id);
        G.save();
        playGacha(chest, got ? [got] : []);
      });
    };
  }

  function render() {
    if (!S()) return;
    renderEquip();
    renderGacha();
    renderShards();
    renderGrid();
    bindAd();
  }

  G.PetsUI = { render: render, pull: pull, playGacha: playGacha };
  window.PetsUI = G.PetsUI;
})();
