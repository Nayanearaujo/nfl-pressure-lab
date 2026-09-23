/* dist-chart.js — gráfico SVG simples da evolução da distância QB↔pass rusher.
 *
 * Plota geometric_min_distance_yd por frameId. Marca snap e lançamento.
 * Um cursor vertical é sincronizado com o frame atual da reprodução.
 * NÃO adiciona previsões nem classificações arbitrárias de pressão.
 */
(function (global) {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  // Coordenadas do gráfico. Margens maiores para acomodar rótulos dos eixos
  // sem cortes; a proporção é preservada (não usamos preserveAspectRatio=none,
  // que distorcia o texto).
  const W = 760, H = 240;
  const M = { top: 16, right: 20, bottom: 44, left: 58 };

  function el(name, attrs) {
    const n = document.createElementNS(SVGNS, name);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function DistChart(svg) {
    this.svg = svg;
    this.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    this.cursor = null;
    this.points = [];
    this.frameIndexToX = [];
  }

  DistChart.prototype.load = function (doc) {
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    this.frameIndexToX = [];

    const frames = doc.frames;
    const withVals = frames.filter((f) => f.geometric_min_distance_yd != null);
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;

    const firstId = frames[0].frameId;
    const lastId = frames[frames.length - 1].frameId;
    const spanId = Math.max(1, lastId - firstId);
    const maxD = Math.max(5, Math.ceil(Math.max.apply(null, withVals.map((f) => f.geometric_min_distance_yd)) || 5));

    const xOf = (frameId) => M.left + ((frameId - firstId) / spanId) * plotW;
    const yOf = (d) => M.top + plotH - (d / maxD) * plotH;
    this._xOf = xOf;

    // Grades horizontais + ticks e rótulos do eixo Y (jardas), alinhados à
    // direita, junto ao eixo. Os valores correspondem à mesma escala da curva.
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const val = (maxD / steps) * i;
      const y = yOf(val);
      this.svg.appendChild(el("line", { class: "chart-grid", x1: M.left, y1: y, x2: W - M.right, y2: y }));
      this.svg.appendChild(el("line", { class: "chart-axis", x1: M.left - 4, y1: y, x2: M.left, y2: y })); // tick
      const t = el("text", { class: "chart-tick", x: M.left - 8, y: y + 4, "text-anchor": "end" });
      t.textContent = val.toFixed(1);
      this.svg.appendChild(t);
    }
    // Eixos
    this.svg.appendChild(el("line", { class: "chart-axis", x1: M.left, y1: M.top, x2: M.left, y2: H - M.bottom }));
    this.svg.appendChild(el("line", { class: "chart-axis", x1: M.left, y1: H - M.bottom, x2: W - M.right, y2: H - M.bottom }));

    // Ticks e rótulos do eixo X (frame) a cada 5 frames
    for (let fid = firstId; fid <= lastId; fid += 5) {
      const x = xOf(fid);
      this.svg.appendChild(el("line", { class: "chart-axis", x1: x, y1: H - M.bottom, x2: x, y2: H - M.bottom + 4 }));
      const t = el("text", { class: "chart-tick", x: x, y: H - M.bottom + 16, "text-anchor": "middle" });
      t.textContent = fid;
      this.svg.appendChild(t);
    }

    // Título do eixo X centralizado abaixo dos números
    const xlab = el("text", { class: "chart-axis-title", x: M.left + plotW / 2, y: H - 8, "text-anchor": "middle" });
    xlab.textContent = "frame";
    this.svg.appendChild(xlab);
    // Título do eixo Y rotacionado, indicando a unidade (jardas)
    const ycx = 16, ycy = M.top + plotH / 2;
    const ylab = el("text", { class: "chart-axis-title", x: ycx, y: ycy, "text-anchor": "middle", transform: `rotate(-90 ${ycx} ${ycy})` });
    ylab.textContent = "distância (yd)";
    this.svg.appendChild(ylab);

    // Marcadores de evento (linhas verticais) com rótulo legível no topo
    const evLabel = (x, text, cls, anchor) => {
      const t = el("text", { class: "chart-evlabel " + cls, x: x + (anchor === "end" ? -4 : 4), y: M.top + 11, "text-anchor": anchor });
      t.textContent = text;
      this.svg.appendChild(t);
    };
    ["snap", "throw"].forEach((key) => {
      const ev = doc.events && doc.events[key];
      if (ev && ev.frame != null) {
        const x = xOf(ev.frame);
        this.svg.appendChild(el("line", { class: "chart-evline " + key, x1: x, y1: M.top, x2: x, y2: H - M.bottom }));
        const nearRight = x > W - 120;
        evLabel(x, (key === "snap" ? "Snap" : "Lançamento") + " (f" + ev.frame + ")", key, nearRight ? "end" : "start");
      }
    });

    // Polilinha da distância (só frames com valor; quebra em ausências)
    let dAttr = "";
    let pen = false;
    frames.forEach((f) => {
      const d = f.geometric_min_distance_yd;
      if (d == null) { pen = false; return; }
      const x = xOf(f.frameId), y = yOf(d);
      dAttr += (pen ? " L" : " M") + x + "," + y;
      pen = true;
    });
    if (dAttr) this.svg.appendChild(el("path", { class: "chart-line", d: dAttr.trim() }));

    // Cursor vertical (frame atual)
    this.cursor = el("line", { class: "chart-cursor", x1: M.left, y1: M.top, x2: M.left, y2: H - M.bottom });
    this.svg.appendChild(this.cursor);

    this._frameIds = frames.map((f) => f.frameId);
  };

  DistChart.prototype.setCursor = function (frame) {
    if (!this.cursor || !frame) return;
    const x = this._xOf(frame.frameId);
    this.cursor.setAttribute("x1", x);
    this.cursor.setAttribute("x2", x);
  };

  global.DistChart = DistChart;
})(window);
