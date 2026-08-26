/* 超高自由度历史人生模拟器 — 前端逻辑 */
(function () {
  "use strict";

  const SYSTEM = window.GAME_SYSTEM_PROMPT || "";
  const LS = { cfg: "hls_cfg", state: "hls_state", history: "hls_history" };

  const defCfg = { base: "https://api.deepseek.com/v1", key: "", model: "deepseek-chat" };
  const lastLifeGuess = ["ta", "你", "此身"];

  // ---------- DOM ----------
  const $ = (s) => document.querySelector(s);
  const els = {
    log: $("#log"), typing: $("#typing"),
    input: $("#input"), send: $("#send"),
    tEra: $("#tEra"), tDate: $("#tDate"), tSeason: $("#tSeason"), tMode: $("#tMode"),
    pnPlayer: $("#pn-player"), pnFamily: $("#pn-family"), pnWorld: $("#pn-world"),
    pnMap: $("#pn-map"), pnStage: $("#pn-stage"), pnCan: $("#pn-can"), pnProgress: $("#pn-progress"),
    tabs: document.querySelectorAll(".tab"), panes: document.querySelectorAll(".tabpane"),
    settings: $("#settings"), cfgBase: $("#cfgBase"), cfgKey: $("#cfgKey"), cfgModel: $("#cfgModel"),
    connStatus: $("#connStatus"), toast: $("#toast"),
    exportSave: $("#exportSave"), importSave: $("#importSave"), resetAll: $("#resetAll"), importFile: $("#importFile"),
    btnNewLife: $("#btnNewLife"), btnSettings: $("#btnSettings"), btnTime: $("#btnTime"),
    btnDrawer: $("#btnDrawer"), closeDrawer: $("#closeDrawer"), drawerOverlay: $("#drawerOverlay"),
    closeSettings: $("#closeSettings"), saveSettings: $("#saveSettings"), testSettings: $("#testSettings"),
  };

  // ---------- State ----------
  let cfg = loadCfg();
  let state = loadState();
  let history = loadHistory();
  let busy = false;

  function loadCfg() {
    try { return Object.assign({}, defCfg, JSON.parse(localStorage.getItem(LS.cfg) || "{}")); }
    catch { return { ...defCfg }; }
  }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(LS.state) || "null") || blankState(); }
    catch { return blankState(); }
  }
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(LS.history) || "[]"); }
    catch { return []; }
  }
  function blankState() {
    return {
      era: null, currentDate: null, season: null, mode: null, phase: null,
      worldProgress: null, player: {}, family: {}, worldEvents: {}, knownMap: null,
      stageFocus: null, actionsNow: null, buildSteps: null, started: false,
    };
  }
  function saveCfg() { localStorage.setItem(LS.cfg, JSON.stringify(cfg)); }
  function saveState() { localStorage.setItem(LS.state, JSON.stringify(state)); }
  function saveHistory() { localStorage.setItem(LS.history, JSON.stringify(history)); }

  // ---------- Rendering ----------
  function kv(label, val, small) {
    if (val === null || val === undefined || val === "") return "";
    return `<div class="kv"><div class="k">${label}</div><div class="v${small ? " small" : ""}">${esc(String(val))}</div></div>`;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function len(val) {
    if (Array.isArray(val)) return val.length;
    if (val && typeof val === "object") return Object.keys(val).length;
    return val ? 1 : 0;
  }

  function renderTime() {
    els.tEra.textContent = state.era ? `朝代：${state.era}` : "朝代：—";
    els.tDate.textContent = state.currentDate ? `纪年：${state.currentDate}` : "纪年：—";
    els.tSeason.textContent = state.season ? `季节/节气：${state.season}` : "季节/节气：—";
    els.tMode.textContent = state.mode ? `模式：${state.mode}` : "模式：—";
  }

  function chips(arr) {
    if (!arr || !arr.length) return "";
    return `<div class="kv-row">${arr.map((c) => `<span class="kv-chip">${esc(c)}</span>`).join("")}</div>`;
  }

  function renderPlayer() {
    const p = state.player || {};
    const keys = [
      ["姓名","name"],["性别","gender"],["年龄","age"],["籍贯","origin"],["出生地","birthPlace"],
      ["现居地","living"],["身份","identity"],["户籍","hukou"],["阶层","class"],["婚姻","marriage"],
      ["子女","children"],["职业","job"],["职业状态","jobStatus"],["教育","education"],["功名","title"],
      ["财富","wealth"],["土地","land"],["住房","house"],["身体状态","body"],["信仰","faith"],
      ["技能","skill"],["文化程度","literacy"],["社会声誉","reputation"],["当前目标","goal"],
      ["当前问题","problem"],["人生趋势","trend"],["语言行为","manner"],
    ];
    if (len(p) === 0) { els.pnPlayer.className = "empty fade"; els.pnPlayer.textContent = "尚未投胎，等待开局。"; return; }
    els.pnPlayer.className = "fade";
    let html = "";
    for (const [label, key] of keys) {
      if (p[key]) html += kv(label, p[key], key === "children" || key === "skill");
    }
    if (p.relations && len(p.relations)) {
      html += `<div class="section-title">社会 / 家族关系</div>` + chips(
        (p.relations.items || Object.values(p.relations)).map((x) => (typeof x === "string" ? x : x.name || JSON.stringify(x)))
      );
    }
    if (!html) html = `<div class="empty">人物关键信息待生成。</div>`;
    els.pnPlayer.innerHTML = html;
  }

  function renderFamily() {
    const f = state.family || {};
    if (len(f) === 0) { els.pnFamily.className = "empty fade"; els.pnFamily.innerHTML = "尚未建立家族。若开启<b>家族连续人生</b>，宗门后代将在此延续。"; return; }
    els.pnFamily.className = "fade";
    const keys = [
      ["姓氏","surname"],["籍贯","origin"],["所在地","where"],["阶层","class"],
      ["祖辈","ancestors"],["父母","parents"],["兄弟姐妹","siblings"],["配偶","spouse"],
      ["子女","children"],["亲族","relatives"],["婚姻关系","marriage"],["土地","land"],
      ["房产","houses"],["产业","industry"],["债务","debt"],["声誉","reputation"],
      ["职业","jobs"],["重要人物","important"],["历史","history"],["与宗族关系","clanRel"],
      ["与官府关系","govRel"],["未来趋势","trend"],
    ];
    let html = "";
    for (const [label, key] of keys) if (f[key]) html += kv(label, f[key], true);
    if (!html) html = `<div class="empty">家族信息待生成。</div>`;
    els.pnFamily.innerHTML = html;
  }

  function renderWorld() {
    const w = state.worldEvents || {};
    const labels = [["本地","local"],["州府/地方","region"],["国家","nation"],["周边地区","surrounding"],["天下","world"],["正在发生","happening"],["近期影响","nearTerm"]];
    if (len(w) === 0) { els.pnWorld.className = "empty fade"; els.pnWorld.textContent = "世界动态尚未生成。"; return; }
    els.pnWorld.className = "fade";
    const srcClass = { "亲眼所见":"src-eyewitness", "亲耳所闻":"src-eyewitness", "可靠消息":"src-official", "官方消息":"src-official", "朋友转述":"src-official", "商人消息":"src-rumor", "地方传言":"src-rumor", "民间故事":"src-rumor", "历史传说":"src-rumor", "未经证实":"src-guess", "玩家猜测":"src-guess" };
    function srcBadge(src) {
      if (!src) return "";
      const c = srcClass[String(src)] || "";
      return `<span class="src-badge ${c}">${esc(src)}</span>`;
    }
    function fmtVal(v) {
      if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? esc(x) + srcBadge("") : esc(x.text || JSON.stringify(x)) + srcBadge(x.source))).join("；");
      if (v && typeof v === "object" && v.text) return esc(v.text) + srcBadge(v.source);
      return esc(v);
    }
    let html = "";
    for (const [label, key] of labels) {
      const v = w[key];
      if (!v) continue;
      html += `<div class="kv"><div class="k">${label}</div><div class="v small">${fmtVal(v)}</div></div>`;
    }
    if (w.hidden) {
      const hidVal = Array.isArray(w.hidden) ? w.hidden : (typeof w.hidden === "string" ? { text: w.hidden, source: "世界后台" } : w.hidden);
      html += `<div class="kv"><div class="k">隐藏信息（后台）</div><div class="v small">${fmtVal(hidVal)}</div></div>`;
    }
    if (!html) html = `<div class="empty">世界动态待生成。</div>`;
    els.pnWorld.innerHTML = html;
  }

  function renderMap() {
    const m = state.knownMap;
    if (!m || !String(m).trim()) { els.pnMap.className = "empty fade"; els.pnMap.textContent = "你尚未为这片土地所认识。地图只显示你所知道的地方。"; return; }
    els.pnMap.className = "fade";
    els.pnMap.innerHTML = `<div class="kv"><div class="k">你已认识的地理</div><div class="v">${esc(m)}</div></div>`;
  }

  function renderStage() {
    els.pnStage.textContent = state.phase || "—";
    els.pnCan.textContent = state.stageFocus || (state.started ? "—" : "等待开局……");
    if (Array.isArray(state.buildSteps) && state.buildSteps.length) {
      let html = `<ul class="checklist">`;
      const idxCur = state.buildSteps.findIndex((s) => s.done === "current" || s.current);
      state.buildSteps.forEach((s, i) => {
        const item = typeof s === "string" ? { step: s } : s;
        const done = item.done === true || item.done === "done" || item.done === "完成";
        const cur = i === idxCur || item.current;
        html += `<li class="${done ? "done" : cur ? "current" : ""}">${esc(item.step || "")}</li>`;
      });
      html += `</ul>`;
      els.pnProgress.innerHTML = html;
    } else if (state.worldProgress && String(state.worldProgress).trim()) {
      els.pnProgress.innerHTML = String(state.worldProgress).replace(/(已完成|☑|✓|完成)/g, '<span class="done">$&</span>');
    } else {
      els.pnProgress.textContent = state.started ? "世界已建立。" : "—";
    }
  }

  function renderAll() { renderTime(); renderPlayer(); renderFamily(); renderWorld(); renderMap(); renderStage(); }

  // ---------- Narrative ----------
  function toHtml(text) {
    const paras = String(text).split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    if (!paras.length) return "";
    return paras.map((p) => {
      let inner = esc(p);
      // 引号内的对话上色
      inner = inner.replace(/「([^」]+)」/g, '<span class="story-quote">「$1」</span>');
      inner = inner.replace(/“([^”]+)”/g, '<span class="story-quote">“$1”</span>');
      return `<p>${inner}</p>`;
    }).join("");
  }
  function addMsg(system, text, cls) {
    const div = document.createElement("div");
    div.className = "msg " + (cls || "msg-engine");
    if (system) {
      div.className = "msg msg-system";
      div.textContent = text;
    } else if (cls === "msg-player") {
      div.innerHTML = `<div class="bubble">${esc(text)}</div>`;
    } else {
      div.innerHTML = `<div class="story">${toHtml(text)}</div>`;
    }
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
    return div;
  }

  // ---------- State snapshot for engine context ----------
  function snapshotText() {
    const p = state.player || {}, f = state.family || {}, w = state.worldEvents || {};
    const parts = [];
    parts.push(`[当前时间] ${state.currentDate || "（未定）"}`);
    if (state.era) parts.push(`[朝代] ${state.era}`);
    if (state.mode) parts.push(`[历史模式] ${state.mode}`);
    if (state.phase) parts.push(`[人生阶段] ${state.phase}`);
    parts.push(`[世界建立进度] ${state.worldProgress || (state.started ? "已完成" : "未开始")}`);
    if (len(p)) parts.push(`[当前人物] ` + keysStr(p));
    if (len(f)) parts.push(`[当前家族] ` + keysStr(f));
    if (len(w)) parts.push(`[当前世界动态] ` + keysStr(w));
    if (state.knownMap) parts.push(`[认识之地] ${state.knownMap}`);
    if (state.stageFocus) parts.push(`[你现在可以做什么] ${state.stageFocus}`);
    if (Array.isArray(state.buildSteps) && state.buildSteps.length) {
      parts.push("[世界建立进度清单] " + state.buildSteps.map((s) => {
        const it = typeof s === "string" ? { step: s, done: false } : s;
        const done = it.done === true || it.done === "done" || it.done === "完成";
        return (done ? "☑" : "☐") + it.step;
      }).join("；"));
    }
    return parts.join("\n");
  }
  function keysStr(obj) {
    return Object.entries(obj).filter(([, v]) => v).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("、") : v}`).join("；");
  }

  // ---------- Parse <<<STATE>>> ----------
  const STATE_KEYS = ["era","currentDate","season","mode","phase","worldProgress","player","family","worldEvents","knownMap","stageFocus","actionsNow","buildSteps"];
  function cleanJson(s) {
    let t = String(s).trim();
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    t = t.replace(/^json\s*/i, "").trim();
    return t;
  }
  function lastJsonObject(s) {
    // 从后往前找最后一个平衡的 {...}，作为状态候选
    let end = -1;
    for (let i = s.length - 1; i >= 0; i--) { if (s[i] === "}") { end = i; break; } }
    if (end < 0) return null;
    let depth = 0, inStr = false, esc = false, start = -1;
    for (let i = end; i >= 0; i--) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') inStr = !inStr;
      if (inStr) continue;
      if (c === "}") depth++;
      else if (c === "{") { depth--; if (depth === 0) { start = i; break; } }
    }
    if (start < 0) return null;
    return { start, end: end + 1, json: s.slice(start, end + 1) };
  }
  function isStateLike(o) {
    if (!o || typeof o !== "object") return false;
    return STATE_KEYS.some((k) => o[k] !== undefined);
  }
  function parseState(text) {
    const s = String(text);
    const m = s.match(/<<<STATE>>>([\s\S]*?)<<<ENDSTATE>>>/);
    let parsed = null;
    let clean = s.trim();
    let hadState = false;
    if (m) {
      try { parsed = JSON.parse(cleanJson(m[1])); hadState = !!parsed; } catch (e) { parsed = null; }
      clean = s.replace(/<<<STATE>>>[\s\S]*?<<<ENDSTATE>>>/g, "").trim();
    } else {
      const cand = lastJsonObject(s);
      if (cand) {
        try {
          const obj = JSON.parse(cleanJson(cand.json));
          if (isStateLike(obj)) { parsed = obj; hadState = true; clean = (s.slice(0, cand.start) + s.slice(cand.end)).trim(); }
        } catch (e) { parsed = null; }
      }
    }
    return { text: clean, state: parsed, hadState };
  }

  function applyState(s) {
    if (!s) return;
    if (s.era !== undefined) state.era = s.era;
    if (s.currentDate !== undefined) state.currentDate = s.currentDate;
    if (s.season !== undefined) state.season = s.season;
    if (s.mode !== undefined) state.mode = s.mode;
    if (s.phase !== undefined) state.phase = s.phase;
    if (s.worldProgress !== undefined) state.worldProgress = s.worldProgress;
    if (s.player !== undefined) state.player = s.player || {};
    if (s.family !== undefined) state.family = s.family || {};
    if (s.worldEvents !== undefined) state.worldEvents = s.worldEvents || {};
    if (s.knownMap !== undefined) state.knownMap = s.knownMap;
    if (s.stageFocus !== undefined) state.stageFocus = s.stageFocus;
    if (s.actionsNow !== undefined) state.actionsNow = s.actionsNow;
    if (s.buildSteps !== undefined) state.buildSteps = s.buildSteps;
    if (s.currentDate && !state.started) state.started = true;
    saveState();
    renderAll();
  }

  // ---------- LLM call ----------
  async function callEngine(userText) {
    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: "【当前世界快照】\n" + snapshotText() },
    ].concat(history.slice(-26));
    messages.push({ role: "user", content: userText });

    const url = cfg.base.replace(/\/+$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.85,
        max_tokens: 2600,
        stream: false,
      }),
    });
    if (!res.ok) {
      let msg = "请求失败 " + res.status;
      try { const j = await res.json(); msg = j.error?.message || JSON.stringify(j).slice(0, 200) || msg; } catch {}
      throw new Error(msg);
    }
    const data = await res.json();
    const out = data.choices?.[0]?.message?.content || "";
    const finish = data.choices?.[0]?.finish_reason || "stop";
    return { content: out, finish };
  }

  function trimHistory() {
    const MAX = 60;
    if (history.length > MAX) {
      history = history.slice(history.length - MAX);
      saveHistory();
    }
  }

  async function sendTurn(userText) {
    if (busy) return;
    if (!cfg.key) { openSettings(true); toast("请先在设置中填写 API Key 才能驱动引擎。"); return; }
    if (!userText || !userText.trim()) return;
    busy = true; els.send.disabled = true; els.input.disabled = true;
    els.typing.classList.remove("hidden");
    addMsg(false, userText, "msg-player");
    history.push({ role: "user", content: userText });
    saveHistory();
    try {
      const { content: raw, finish } = await callEngine(userText);
      const { text, state: newState, hadState } = parseState(raw);
      if (text) addMsg(false, text, "msg-engine");
      applyState(newState);
      if (finish === "length") toast("本轮输出较长被截断，世界状态可能未完整更新。");
      const stored = text || (newState ? "（世界状态已更新。）" : "");
      if (stored) history.push({ role: "assistant", content: stored });
      trimHistory();
      saveHistory();
    } catch (e) {
      addMsg(true, "引擎响应失败：" + e.message, "msg-engine");
      history.pop();
      trimHistory();
      saveHistory();
      toast("连接引擎失败，请检查设置。");
    } finally {
      busy = false; els.send.disabled = false; els.input.disabled = false; els.typing.classList.add("hidden");
      els.input.value = ""; els.input.focus();
    }
  }

  // ---------- New life ----------
  function resetWorld() {
    state = blankState();
    history = [];
    saveState(); saveHistory();
    els.log.innerHTML = "";
    addMsg(true, "新的一世", "msg-system");
    addMsg(false, "天地初开。请选择历史世界模式，然后依照世界建立顺序，一步步把这一方山河与人间立起来。", "msg-engine");
    renderAll();
  }
  async function newLife() {
    if (!cfg.key) { openSettings(true); toast("请先设置 API Key，再开启新一世。"); return; }
    if (history.length && !confirm("开启新一世会清空当前人生与对话，确定吗？")) return;
    resetWorld();
    await sendTurn("开始新的一世。请先让我选择历史世界模式（严格历史 / 历史还原 / 历史传说 / 完全历史架空），然后按第五章世界建立顺序逐步推进，一步步完成世界背景、政治格局、制度、人物，直到创建我的人物、家庭与社会关系，最后正式开始人生。每次推进请清楚说明当前处于哪一步。");
  }

  // ---------- Settings ----------
  function fillCfg() {
    els.cfgBase.value = cfg.base; els.cfgKey.value = cfg.key; els.cfgModel.value = cfg.model;
  }
  function openSettings(auto) {
    fillCfg(); els.settings.classList.remove("hidden");
    if (auto) els.connStatus.textContent = "未配置连接，请填入接口与密钥。";
  }
  function closeSettings() { els.settings.classList.add("hidden"); els.connStatus.textContent = ""; }
  function saveSettings() {
    cfg = { base: els.cfgBase.value.trim() || defCfg.base, key: els.cfgKey.value.trim(), model: els.cfgModel.value.trim() || defCfg.model };
    saveCfg(); closeSettings(); toast("设置已保存。");
  }
  async function testSettings() {
    const old = { ...cfg };
    cfg = { base: els.cfgBase.value.trim() || defCfg.base, key: els.cfgKey.value.trim(), model: els.cfgModel.value.trim() || defCfg.model };
    els.connStatus.textContent = "正在测试……"; els.connStatus.className = "conn-status";
    try {
      const r = await fetch(cfg.base.replace(/\/+$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      els.connStatus.textContent = "连接成功，引擎可用。"; els.connStatus.className = "conn-status ok";
      saveCfg();
    } catch (e) {
      els.connStatus.textContent = "连接失败：" + e.message; els.connStatus.className = "conn-status err";
      cfg = old;
    }
  }

  // ---------- 存档导出 / 导入 / 重置 ----------
  function paintHistory() {
    els.log.innerHTML = "";
    if (history.length) {
      history.forEach((m) => {
        if (m.role === "user" && m.content) addMsg(false, m.content, "msg-player");
        else if (m.role === "assistant" && m.content) addMsg(false, m.content, "msg-engine");
      });
    } else {
      addMsg(true, "超高自由度历史人生模拟器", "msg-system");
      addMsg(false, "点击右上角「🌟 新开一世」开始：先选历史模式，再按世界建立顺序，从这片山河与时代的尽头走向你的一生。", "msg-engine");
    }
  }
  function exportSave() {
    const data = { v: 1, exportedAt: new Date().toISOString(), cfg, state, history };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const t = (state.currentDate || state.era || "存档").replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, "_").slice(-24);
    a.download = "历史人生_" + t + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("存档已导出。");
  }
  async function onImportFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || !data.state) throw new Error("缺少世界状态");
      state = Object.assign(blankState(), data.state || {});
      history = Array.isArray(data.history) ? data.history : [];
      cfg = Object.assign({}, defCfg, data.cfg || {}, { key: cfg.key || (data.cfg && data.cfg.key) || "" });
      saveState(); saveHistory(); saveCfg();
      paintHistory(); renderAll(); fillCfg();
      toast("存档已导入。");
    } catch (err) {
      toast("导入失败：" + err.message);
    }
  }
  function resetAll() {
    if (!confirm("确定清空连接配置、世界与全部对话吗？此操作不可恢复。")) return;
    localStorage.removeItem(LS.cfg); localStorage.removeItem(LS.state); localStorage.removeItem(LS.history);
    cfg = { ...defCfg }; state = blankState(); history = [];
    saveCfg(); saveState(); saveHistory(); fillCfg();
    els.log.innerHTML = "";
    addMsg(true, "已全部重置", "msg-system");
    addMsg(false, "点击右上角「🌟 新开一世」重新开始。", "msg-engine");
    renderAll();
    toast("已重置。");
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    els.toast.textContent = msg; els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
  }

  // ---------- Events ----------
  els.send.addEventListener("click", () => sendTurn(els.input.value));
  els.input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); sendTurn(els.input.value); }
  });
  document.querySelectorAll("[data-advance]").forEach((b) =>
    b.addEventListener("click", () => sendTurn("推进时间：" + b.dataset.advance + "。根据生活状态结算这一段时间里发生的事。"))
  );
  document.querySelectorAll("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => sendTurn(b.dataset.quick))
  );
  els.btnNewLife.addEventListener("click", newLife);
  els.btnSettings.addEventListener("click", () => openSettings(false));
  els.btnTime.addEventListener("click", () => toast(state.currentDate ? `当前：${state.currentDate}` : "时间尚未确定。"));
  function toggleDrawer(open) {
    document.body.classList.toggle("drawer-open", !!open);
  }
  els.btnDrawer.addEventListener("click", () => toggleDrawer(!document.body.classList.contains("drawer-open")));
  els.closeDrawer.addEventListener("click", () => toggleDrawer(false));
  els.drawerOverlay.addEventListener("click", () => toggleDrawer(false));
  els.closeSettings.addEventListener("click", closeSettings);
  els.saveSettings.addEventListener("click", saveSettings);
  els.testSettings.addEventListener("click", testSettings);
  els.exportSave.addEventListener("click", exportSave);
  els.importSave.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", onImportFile);
  els.resetAll.addEventListener("click", resetAll);
  els.tabs.forEach((t) =>
    t.addEventListener("click", () => {
      els.tabs.forEach((x) => x.classList.toggle("active", x === t));
      els.panes.forEach((p) => p.classList.toggle("active", p.dataset.pane === t.dataset.tab));
      if (window.matchMedia("(max-width: 900px)").matches) toggleDrawer(false);
    })
  );

  // ---------- Boot ----------
  function boot() {
    renderAll();
    paintHistory();
    if (!cfg.key) setTimeout(() => openSettings(true), 400);
    els.input.focus();
  }

  boot();
})();
