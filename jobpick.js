/* =========================================================================
 *  던전 크루세이더 — jobpick.js
 *  직업(공주 클래스) 선택 · 무료 전직 화면
 * ========================================================================= */
(function () {
  "use strict";
  const G = window.G;
  const $ = (s) => document.querySelector(s);

  let picked = null;
  let mode = "start";

  function statBar(label, v, color) {
    return (
      '<div class="jp-bar"><span>' + label + '</span><i><b style="width:' + v + "%;background:" + color + '"></b></i></div>'
    );
  }

  function build() {
    const list = $("#jpList");
    if (!list) return;
    list.innerHTML = "";
    G.JOB_LIST.forEach((id) => {
      const j = G.JOBS[id];
      const card = document.createElement("button");
      card.type = "button";
      card.className = "jp-card" + (picked === id ? " sel" : "");
      card.style.setProperty("--jc", j.color);
      card.innerHTML =
        '<div class="jc-top">' +
        '<div class="jc-art"></div>' +
        '<div class="jc-title"><div class="jc-nm">' + j.icon + " " + j.name + "</div>" +
        '<div class="jc-tags">' + j.tags.map((t) => '<span class="jp-tag">' + t + "</span>").join("") + "</div></div>" +
        "</div>" +
        '<div class="jc-desc">' + j.desc + "</div>" +
        '<div class="jc-bars">' +
        statBar("공격", j.bars.atk, "linear-gradient(90deg,#ff8a4a,#ffd479)") +
        statBar("체력", j.bars.hp, "linear-gradient(90deg,#e0413f,#ff8a7a)") +
        statBar("치명", j.bars.crit, "linear-gradient(90deg,#55a8ff,#8fe0ff)") +
        statBar("속도", j.bars.spd, "linear-gradient(90deg,#5ddc7c,#c8ff9a)") +
        "</div>" +
        '<div class="jc-skills">' +
        j.skills
          .map((s) => '<div class="jc-skill"><span>' + s.icon + "</span><b>" + s.name + "</b><em>" + s.short + "</em></div>")
          .join("") +
        '<div class="jc-skill ult"><span>' + j.ult.icon + "</span><b>" + j.ult.name + "</b><em>" + j.ult.short + "</em></div>" +
        "</div>";
      const art = card.querySelector(".jc-art");
      const cv = G.makeCanvas("job:" + id, 2.6);
      art.appendChild(cv);
      card.onclick = () => {
        picked = id;
        G.sfx("click");
        build();
        const ok = $("#btnJobOk");
        if (ok) {
          ok.disabled = false;
          ok.textContent = mode === "start" ? j.name + "(으)로 시작" : j.name + "(으)로 전직";
        }
      };
      list.appendChild(card);
    });
  }

  function open(opt) {
    opt = opt || {};
    mode = opt.mode || "start";
    const st = G.getState();
    picked = opt.mode === "change" && st ? st.job : null;
    const root = $("#jobpick");
    if (!root) return;
    const title = $("#jpTitle");
    const sub = $("#jpSub");
    if (title) title.textContent = mode === "start" ? "공주님의 길을 선택하세요" : "전직할 직업을 선택하세요";
    if (sub) {
      sub.innerHTML =
        mode === "start"
          ? "직업마다 전용 스킬 · 궁극기 · 기본 스탯이 다릅니다.<br />언제든 <b>무료로 전직</b>할 수 있어요."
          : "직업을 바꾸면 스킬과 기본 스탯 성향이 바뀝니다. <b>비용은 없습니다.</b>";
    }
    const cancel = $("#btnJobCancel");
    if (cancel) {
      cancel.hidden = mode !== "change";
      cancel.onclick = close;
    }
    const ok = $("#btnJobOk");
    if (ok) {
      ok.disabled = !picked;
      ok.textContent = picked ? (mode === "start" ? G.JOBS[picked].name + "(으)로 시작" : G.JOBS[picked].name + "(으)로 전직") : "직업을 선택하세요";
      ok.onclick = confirmPick;
    }
    build();
    root.classList.add("on");
    setTimeout(() => {
      const sel = root.querySelector(".jp-card.sel");
      if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
    }, 60);
  }

  function close() {
    const root = $("#jobpick");
    if (root) root.classList.remove("on");
  }

  function confirmPick() {
    if (!picked) return;
    const st = G.getState();
    if (!st) return;
    const changed = st.job !== picked;
    // 던전 도중 전직하면 스킬이 어긋나므로 안전하게 나간다
    if (changed && window.Game && window.Game.dungeon && window.Game.dungeon.active) {
      window.Game.dungeon.flee();
    }
    G.setJob(picked);
    st.seenJobs = true;
    G.save();
    G.setStats(G.computeStats());
    G.applyJobVisuals();
    G.refreshAll();
    if (window.Game && window.Game.renderBattle) window.Game.renderBattle();
    close();
    if (changed) {
      G.sfx("jobChange");
      G.toast("전직 완료 · " + G.JOBS[picked].name + "!", "gold");
    } else {
      G.sfx("on");
    }
    if (mode === "start") {
      setTimeout(
        () => G.toast("공주 " + G.playerName() + " · " + G.JOBS[picked].name + "로 모험 시작!", "gold"),
        520
      );
    }
  }

  G.JobPick = { open: open, close: close, get picked() { return picked; } };
  window.JobPick = G.JobPick;
})();
