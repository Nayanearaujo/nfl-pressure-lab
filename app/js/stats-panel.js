/* stats-panel.js — renderiza o painel lateral em TRÊS camadas separadas (P1):
 *   A. Aproximação geométrica (distância atual, mínima, tempo desde o snap)
 *   B. Pressão registrada pela PFF (hits/hurries/sacks)
 *   C. Resultado + contexto da jogada
 * As três NUNCA são combinadas em um único número (P1). Ausências viram
 * "não disponível" (P4). A distância não é rotulada como "pressão" (P5).
 */
(function (global) {
  "use strict";

  function na(text) { return `<span class="na">${text || "não disponível"}</span>`; }
  function fmtYd(v) { return v == null ? na() : `${v.toFixed(2)} <span class="unit">yd</span>`; }

  function StatsPanel(refs) {
    this.refs = refs; // {geoCurrent, geoMin, geoTime, pff, result, context}
    this.doc = null;
    this.minObserved = null;
    this.snapFrameId = null;
    this.frameRateHz = 10;
  }

  StatsPanel.prototype.load = function (doc) {
    this.doc = doc;
    this.frameRateHz = (doc.meta && doc.meta.frameRateHz) || 10;
    this.snapFrameId = doc.events && doc.events.snap ? doc.events.snap.frame : null;

    // Menor distância observada na jogada (sobre frames com valor).
    this.minObserved = null;
    let minFrameId = null;
    doc.frames.forEach((f) => {
      const d = f.geometric_min_distance_yd;
      if (d != null && (this.minObserved == null || d < this.minObserved)) {
        this.minObserved = d;
        minFrameId = f.frameId;
      }
    });
    this._minFrameId = minFrameId;

    this._renderPFF();
    this._renderResultAndContext();
  };

  // Camada A — atualiza a cada frame
  StatsPanel.prototype.updateGeometric = function (frame) {
    const d = frame ? frame.geometric_min_distance_yd : null;
    this.refs.geoCurrent.innerHTML = fmtYd(d);

    if (this.minObserved != null) {
      this.refs.geoMin.innerHTML =
        `${this.minObserved.toFixed(2)} <span class="unit">yd</span>` +
        (this._minFrameId != null ? ` <span class="unit">(frame ${this._minFrameId})</span>` : "");
    } else {
      this.refs.geoMin.innerHTML = na();
    }

    // Tempo desde o snap
    if (this.snapFrameId != null && frame) {
      const dframes = frame.frameId - this.snapFrameId;
      const secs = dframes / this.frameRateHz;
      const sign = secs >= 0 ? "+" : "";
      this.refs.geoTime.innerHTML = `${sign}${secs.toFixed(1)} <span class="unit">s</span>`;
    } else {
      this.refs.geoTime.innerHTML = na("snap não registrado");
    }
  };

  // Camada B — pressão PFF (fixa na jogada)
  StatsPanel.prototype._renderPFF = function () {
    const ps = this.doc.pressureSummary || {};
    let html = "";
    html += `<div class="metric-row"><span class="label">Hurries</span><span class="value">${ps.hurries ?? na()}</span></div>`;
    html += `<div class="metric-row"><span class="label">Hits</span><span class="value">${ps.hits ?? na()}</span></div>`;
    html += `<div class="metric-row"><span class="label">Sacks</span><span class="value">${ps.sacks ?? na()}</span></div>`;

    const byPlayer = ps.byPlayer || [];
    if (byPlayer.length) {
      html += `<ul class="pff-player-list">`;
      byPlayer.forEach((p) => {
        const tags = [];
        if (p.hurry === 1) tags.push("hurry");
        if (p.hit === 1) tags.push("hit");
        if (p.sack === 1) tags.push("sack");
        html += `<li><span>${p.displayName || p.nflId}</span><span>${tags.join(", ")}</span></li>`;
      });
      html += `</ul>`;
    }
    html += `<p class="note">${ps.note || "Avaliação proprietária da PFF — não derivada da geometria."}</p>`;
    this.refs.pff.innerHTML = html;
  };

  // Camada C — resultado + contexto (fixo na jogada)
  StatsPanel.prototype._renderResultAndContext = function () {
    const r = this.doc.result || {};
    const c = this.doc.context || {};
    const label = r.passResultLabel || r.passResult;

    let rhtml = "";
    rhtml += `<div class="metric-row"><span class="label">Resultado da jogada</span><span class="value">${label ? label : na()}</span></div>`;
    rhtml += `<div class="metric-row"><span class="label">Jardas na jogada</span><span class="value">${r.playResult != null ? r.playResult : na()}</span></div>`;
    this.refs.result.innerHTML = rhtml;

    let chtml = "";
    const rows = [
      ["Times", (c.possessionTeam || "?") + " (ataque) × " + (c.defensiveTeam || "?") + " (defesa)"],
      ["Quarter", c.quarter],
      ["Down & distância", c.down != null ? `${c.down}ª & ${c.yardsToGo}` : null],
      ["Formação ataque", c.offenseFormation],
      ["Personnel defesa", c.personnelD],
      ["Cobertura (PFF)", c.pff_passCoverage],
      ["Tipo cobertura", c.pff_passCoverageType],
    ];
    rows.forEach((row) => {
      const v = row[1];
      chtml += `<div class="metric-row"><span class="label">${row[0]}</span><span class="value">${v != null && v !== "" ? v : na()}</span></div>`;
    });
    if (c.playDescription) {
      chtml += `<p class="note">${c.playDescription}</p>`;
    }
    this.refs.context.innerHTML = chtml;
  };

  global.StatsPanel = StatsPanel;
})(window);
