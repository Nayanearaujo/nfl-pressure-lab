/* app.js — bootstrap: carrega o índice, popula o seletor, orquestra os módulos.
 *
 * Consome apenas os JSONs já gerados (app/data/*), nunca os CSVs originais.
 * A UI descobre as jogadas a partir de plays_index.json (RNF4).
 */
(function () {
  "use strict";

  const els = {};
  let field, playback, stats, chart;
  let snapFrameId = null;

  function $(id) { return document.getElementById(id); }

  function setStatus(msg, isError) {
    els.status.textContent = msg;
    els.status.classList.toggle("error", !!isError);
  }

  function setControlsEnabled(on) {
    ["btnPlay", "btnPrev", "btnNext", "slider", "speed"].forEach((k) => {
      if (els[k]) els[k].disabled = !on;
    });
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar ${url}`);
    return res.json();
  }

  // ---- Carrega o índice e popula o seletor (RF1) ----
  async function init() {
    field = new FieldRenderer($("field"));
    stats = new StatsPanel({
      geoCurrent: $("geo-current"),
      geoMin: $("geo-min"),
      geoTime: $("geo-time"),
      pff: $("pff-body"),
      result: $("result-body"),
      context: $("context-body"),
    });
    chart = new DistChart($("dist-chart"));
    playback = new PlaybackController({
      onFrame: onFrame,
      onStateChange: (playing) => { els.btnPlay.textContent = playing ? "⏸ Pause" : "▶ Play"; },
    });

    wireControls();

    try {
      setStatus("Carregando índice de jogadas…");
      const index = await fetchJSON("data/plays_index.json");
      const plays = (index && index.plays) || [];
      if (!plays.length) {
        showEmpty("Nenhuma jogada disponível. Rode o pré-processamento Python primeiro.");
        return;
      }
      els.selector.innerHTML = "";
      plays.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.file;
        const dd = p.down != null ? `${p.down}ª&${p.yardsToGo}` : "";
        opt.textContent = `${p.possessionTeam}×${p.defensiveTeam} · Q${p.quarter} ${dd} · ${p.description || p.id}`;
        els.selector.appendChild(opt);
      });
      els.selector.disabled = plays.length <= 1;
      await loadPlay(plays[0].file);
    } catch (err) {
      showEmpty("Falha ao carregar o índice: " + err.message +
        ". Sirva a pasta app/ por HTTP (ex.: python3 -m http.server).");
    }
  }

  function showEmpty(msg) {
    setStatus(msg, true);
    setControlsEnabled(false);
    els.emptyState.textContent = msg;
    els.emptyState.style.display = "block";
  }

  // ---- Carrega uma jogada específica ----
  async function loadPlay(file) {
    try {
      setStatus("Carregando jogada…");
      setControlsEnabled(false);
      const doc = await fetchJSON("data/" + file);

      if (!doc.frames || !doc.frames.length) {
        showEmpty("Jogada sem frames de tracking.");
        return;
      }
      els.emptyState.style.display = "none";

      snapFrameId = doc.events && doc.events.snap ? doc.events.snap.frame : null;
      field.initPlayers(doc);
      stats.load(doc);
      chart.load(doc);
      playback.load(doc.frames, doc.meta && doc.meta.frameRateHz);
      playback.setSpeed(parseFloat(els.speed.value));

      renderEventMarkers(doc);
      renderWarnings(doc);

      els.slider.min = 0;
      els.slider.max = doc.frames.length - 1;
      els.slider.value = 0;
      setControlsEnabled(true);

      const nRush = doc.players.filter((p) => p.isPassRusher).length;
      const qb = doc.players.find((p) => p.isQB);
      setStatus(`Jogada ${doc.meta.id} — ${doc.frames.length} frames · QB ${qb ? qb.displayName : "?"} · ${nRush} pass rushers`);
    } catch (err) {
      showEmpty("Falha ao carregar a jogada: " + err.message);
    }
  }

  // ---- Callback central de frame ----
  function onFrame(index, frame) {
    if (!frame) return;
    field.renderFrame(frame);
    stats.updateGeometric(frame);
    chart.setCursor(frame);
    els.slider.value = index;

    // HUD de distância (Fase 4): mesmo valor do JSON, em jardas, fora do campo.
    const d = frame.geometric_min_distance_yd;
    if (d != null) {
      els.hudValue.classList.remove("na");
      els.hudValue.innerHTML = `${d.toFixed(2)} <span class="unit">yd</span>`;
    } else {
      els.hudValue.classList.add("na");
      els.hudValue.textContent = "não disponível";
    }

    // Estado temporal: "Pré-snap" antes do snap (Fase 5).
    let temporal = "";
    if (snapFrameId != null) {
      if (frame.frameId < snapFrameId) temporal = " · Pré-snap";
    }
    els.frameReadout.innerHTML =
      `frame <strong>${frame.frameId}</strong> / ${playback.frameCount()}` +
      temporal +
      (frame.event ? ` · <em>${frame.event}</em>` : "");
  }

  // ---- Alterna modo de enquadramento sem reiniciar a reprodução (Fase 2) ----
  function setMode(mode) {
    const pocket = mode === "pocket";
    field.setMode(mode);                       // reenquadra usando o frame atual
    els.field.classList.toggle("pocket", pocket);
    els.modePocket.classList.toggle("is-active", pocket);
    els.modeFull.classList.toggle("is-active", !pocket);
    els.modePocket.setAttribute("aria-pressed", String(pocket));
    els.modeFull.setAttribute("aria-pressed", String(!pocket));
  }

  // ---- Marcadores de evento na timeline (RF7 / requisito 4) ----
  function renderEventMarkers(doc) {
    const box = els.eventMarkers;
    box.innerHTML = "";
    const total = doc.frames.length;
    const firstId = doc.frames[0].frameId;
    const addMarker = (ev, cls, label) => {
      if (!ev || ev.frame == null) return; // ausência: NÃO cria marcador artificial
      const idx = ev.frame - firstId;
      const pct = total > 1 ? (idx / (total - 1)) * 100 : 0;
      const m = document.createElement("div");
      m.className = "marker " + cls;
      m.style.left = pct + "%";
      const auto = ev.source === "autoevent" ? ` <span class="auto-badge">(auto)</span>` : "";
      m.innerHTML = label + auto;
      box.appendChild(m);
    };
    addMarker(doc.events.snap, "snap", "Snap");
    addMarker(doc.events.throw, "throw", "Lançamento");
    addMarker(doc.events.end, "end", "Fim");
  }

  function renderWarnings(doc) {
    const w = (doc.meta && doc.meta.warnings) || [];
    const missing = [];
    if (!doc.events.throw) missing.push("lançamento não registrado (possível sack/scramble)");
    if (!doc.events.end) missing.push("encerramento não registrado no tracking");
    const all = w.concat(missing);
    if (all.length) {
      els.warnBanner.style.display = "block";
      els.warnBanner.innerHTML = "⚠ " + all.join(" · ");
    } else {
      els.warnBanner.style.display = "none";
    }
  }

  // ---- Controles ----
  function wireControls() {
    els.btnPlay.addEventListener("click", () => playback.toggle());
    els.btnPrev.addEventListener("click", () => playback.step(-1));
    els.btnNext.addEventListener("click", () => playback.step(1));
    els.slider.addEventListener("input", (e) => { playback.pause(); playback.seek(parseInt(e.target.value, 10)); });
    els.speed.addEventListener("change", (e) => playback.setSpeed(parseFloat(e.target.value)));
    els.selector.addEventListener("change", (e) => loadPlay(e.target.value));
    els.modeFull.addEventListener("click", () => setMode("full"));
    els.modePocket.addEventListener("click", () => setMode("pocket"));
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); playback.toggle(); }
      else if (e.code === "ArrowRight") { e.preventDefault(); playback.step(1); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); playback.step(-1); }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    els.status = $("status");
    els.selector = $("play-selector");
    els.field = $("field");
    els.modeFull = $("modeFull");
    els.modePocket = $("modePocket");
    els.hudValue = $("hud-value");
    els.btnPlay = $("btnPlay");
    els.btnPrev = $("btnPrev");
    els.btnNext = $("btnNext");
    els.slider = $("slider");
    els.speed = $("speed");
    els.frameReadout = $("frame-readout");
    els.eventMarkers = $("event-markers");
    els.warnBanner = $("warn-banner");
    els.emptyState = $("empty-state");
    init();
  });
})();
