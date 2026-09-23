/* field-renderer.js — desenha o campo SVG e atualiza posições por frame.
 *
 * Coordenadas: usa DIRETAMENTE o sistema do dataset (x: 0–120, y: 0–53.3).
 * O viewBox do SVG é "0 0 120 53.3". O eixo Y do SVG cresce para baixo,
 * então invertemos y (53.3 - y) para orientar o campo de forma natural.
 * Isso preserva a correspondência exata tracking <-> tela (RF2, requisito
 * "manter a correspondência entre coordenadas do tracking e o SVG").
 */
(function (global) {
  "use strict";

  const SVGNS = "http://www.w3.org/2000/svg";
  const FIELD_LEN = 120;
  const FIELD_WID = 53.3;

  function el(name, attrs) {
    const node = document.createElementNS(SVGNS, name);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // Inverte Y para o SVG (tracking Y=0 fica embaixo).
  function fy(y) { return FIELD_WID - y; }

  // Modo FULL FIELD (viewBox do campo inteiro).
  const FULL_VIEWBOX = { x: 0, y: 0, w: FIELD_LEN, h: FIELD_WID };
  // POCKET FOCUS: meia-largura da janela ao redor do QB (jardas). Mantém a
  // proporção do campo (largura : altura = FIELD_LEN : FIELD_WID).
  const POCKET_HALF_W = 15; // 30 jd de largura -> margem p/ ver rushers próximos

  function FieldRenderer(svg) {
    this.svg = svg;
    this.playerNodes = new Map();   // nflId(string) -> <circle>
    this.labelNodes = new Map();    // nflId(string) -> <text>
    this.ballNode = null;
    this.approachLine = null;
    this.approachLabel = null;
    this.qbId = null;
    this.mode = "full";             // "full" | "pocket"
    this.lastFrame = null;          // usado ao alternar de modo sem mudar frame
    this._buildField();
  }

  FieldRenderer.prototype._buildField = function () {
    const svg = this.svg;
    svg.setAttribute("viewBox", `0 0 ${FIELD_LEN} ${FIELD_WID}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // Gramado
    svg.appendChild(el("rect", { x: 0, y: 0, width: FIELD_LEN, height: FIELD_WID, fill: "#0f4d2a" }));
    // End zones (0–10 e 110–120)
    svg.appendChild(el("rect", { x: 0, y: 0, width: 10, height: FIELD_WID, fill: "#0a3a1f" }));
    svg.appendChild(el("rect", { x: 110, y: 0, width: 10, height: FIELD_WID, fill: "#0a3a1f" }));

    // Linhas de jarda a cada 5 jardas (10–110), números a cada 10.
    for (let x = 10; x <= 110; x += 5) {
      const major = (x - 10) % 10 === 0;
      svg.appendChild(el("line", {
        x1: x, y1: 0, x2: x, y2: FIELD_WID,
        stroke: "#ffffff", "stroke-width": major ? 0.18 : 0.09, opacity: major ? 0.55 : 0.3,
      }));
    }
    // Números das jardas (10,20,...,50,...,10) — escala do futebol
    const yardNumbers = [
      [20, "10"], [30, "20"], [40, "30"], [50, "40"], [60, "50"],
      [70, "40"], [80, "30"], [90, "20"], [100, "10"],
    ];
    yardNumbers.forEach(function (pair) {
      const t = el("text", {
        x: pair[0], y: fy(6), fill: "#ffffff", opacity: 0.4,
        "font-size": 2.4, "text-anchor": "middle", "font-weight": 700,
      });
      t.textContent = pair[1];
      svg.appendChild(t);
    });

    // Grupos (ordem de pintura): linha de aproximação -> jogadores -> bola -> labels
    this.gLine = el("g", {});
    this.gPlayers = el("g", {});
    this.gBall = el("g", {});
    this.gLabels = el("g", {});
    svg.appendChild(this.gLine);
    svg.appendChild(this.gPlayers);
    svg.appendChild(this.gBall);
    svg.appendChild(this.gLabels);

    // Halo do pass rusher mais próximo (pintado sob os jogadores).
    this.closestHalo = el("circle", { class: "closest-halo", r: 1.7, cx: -10, cy: -10, visibility: "hidden" });
    this.gLine.appendChild(this.closestHalo);

    // Linha de aproximação (criada uma vez, escondida até haver dados)
    this.approachLine = el("line", { class: "approach-line", visibility: "hidden" });
    this.gLine.appendChild(this.approachLine);
    // approachLabel mantido por compatibilidade, porém NÃO é mais desenhado
    // sobre o campo (a distância passou a ser exibida em HUD/painel — Fase 4).
    this.approachLabel = el("text", { class: "approach-label", visibility: "hidden" });
  };

  // Alterna o modo de enquadramento sem alterar o frame atual (Fase 2).
  FieldRenderer.prototype.setMode = function (mode) {
    this.mode = mode === "pocket" ? "pocket" : "full";
    if (this.lastFrame) this._applyViewBox(this.lastFrame);
  };

  // Calcula e aplica o viewBox conforme o modo, centrando no QB no pocket.
  FieldRenderer.prototype._applyViewBox = function (frame) {
    let vb = FULL_VIEWBOX;
    if (this.mode === "pocket") {
      const qb = this.qbId && frame.positions ? frame.positions[this.qbId] : null;
      if (qb && qb.x != null && qb.y != null) {
        const aspect = FIELD_LEN / FIELD_WID;
        const halfW = POCKET_HALF_W;
        const halfH = halfW / aspect;      // preserva a proporção do campo
        let x = qb.x - halfW;
        let y = fy(qb.y) - halfH;
        // mantém a janela dentro dos limites do campo
        x = Math.max(0, Math.min(FIELD_LEN - halfW * 2, x));
        y = Math.max(0, Math.min(FIELD_WID - halfH * 2, y));
        vb = { x: x, y: y, w: halfW * 2, h: halfH * 2 };
      }
    }
    this.svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    // Fator de zoom: 1 no full, <1 no pocket (ex.: 0.25 => 4x de zoom).
    // Os círculos/halo são desenhados em unidades de usuário (jardas); ao
    // ampliar o viewBox eles apareceriam 1/scale maiores na tela. Para manter
    // o tamanho aparente constante, multiplicamos os raios por "scale".
    const scale = vb.w / FIELD_LEN;
    this.svg.style.setProperty("--zoom-scale", scale);
    this._applyMarkerScale(scale);
  };

  // Reescala raios dos jogadores, bola e halo para tamanho de tela estável.
  // NÃO altera posições (cx/cy) nem coordenadas do tracking.
  FieldRenderer.prototype._applyMarkerScale = function (scale) {
    this.playerNodes.forEach((node) => {
      const base = parseFloat(node.dataset.baseR);
      if (!isNaN(base)) node.setAttribute("r", (base * scale).toFixed(3));
    });
    if (this.ballNode) this.ballNode.setAttribute("r", (0.55 * scale).toFixed(3));
    if (this.closestHalo) this.closestHalo.setAttribute("r", (1.7 * scale).toFixed(3));
  };

  // Cria os elementos dos jogadores uma única vez (reusados a cada frame).
  FieldRenderer.prototype.initPlayers = function (playDoc) {
    // limpa estado anterior (troca de jogada)
    this.playerNodes.forEach((n) => n.remove());
    this.labelNodes.forEach((n) => n.remove());
    this.playerNodes.clear();
    this.labelNodes.clear();
    if (this.ballNode) { this.ballNode.remove(); this.ballNode = null; }

    this.qbId = null;
    playDoc.players.forEach((p) => {
      let cls = "player ";
      if (p.isQB) { cls += "qb"; this.qbId = String(p.nflId); }
      else if (p.isPassRusher) cls += "rusher";
      else if (p.side === "offense") cls += "offense";
      else cls += "defense";

      const baseR = p.isQB ? 1.25 : 1.1;
      const c = el("circle", { class: cls, r: baseR, cx: -10, cy: -10 });
      c.dataset.baseR = baseR;
      const title = el("title", {});
      title.textContent = `${p.displayName || "?"} (#${p.jerseyNumber ?? "?"}) · ${p.position || "?"} · ${p.pffRole || "?"}`;
      c.appendChild(title);
      this.gPlayers.appendChild(c);
      this.playerNodes.set(String(p.nflId), c);

      const label = el("text", { class: "jersey-label", x: -10, y: -10 });
      label.textContent = p.jerseyNumber != null ? String(p.jerseyNumber) : "";
      this.gLabels.appendChild(label);
      this.labelNodes.set(String(p.nflId), label);
    });

    // bola
    this.ballNode = el("circle", { class: "ball-marker", r: 0.55, cx: -10, cy: -10 });
    const bt = el("title", {}); bt.textContent = "Bola"; this.ballNode.appendChild(bt);
    this.gBall.appendChild(this.ballNode);
  };

  // Atualiza posições para um frame (não recria nós — só move cx/cy).
  FieldRenderer.prototype.renderFrame = function (frame) {
    this.lastFrame = frame;
    const positions = frame.positions || {};
    this.playerNodes.forEach((node, nflId) => {
      const pos = positions[nflId];
      const label = this.labelNodes.get(nflId);
      if (pos && pos.x != null && pos.y != null) {
        node.setAttribute("cx", pos.x);
        node.setAttribute("cy", fy(pos.y));
        node.setAttribute("visibility", "visible");
        if (label) {
          label.setAttribute("x", pos.x);
          label.setAttribute("y", fy(pos.y));
          label.setAttribute("visibility", "visible");
        }
      } else {
        node.setAttribute("visibility", "hidden");
        if (label) label.setAttribute("visibility", "hidden");
      }
    });

    // bola
    if (frame.ball && frame.ball.x != null) {
      this.ballNode.setAttribute("cx", frame.ball.x);
      this.ballNode.setAttribute("cy", fy(frame.ball.y));
      this.ballNode.setAttribute("visibility", "visible");
    } else {
      this.ballNode.setAttribute("visibility", "hidden");
    }

    this._renderApproach(frame);
    this._applyViewBox(frame);
  };

  // Linha QB <-> pass rusher mais próximo (somente rushers — RF6.2/P5).
  // A distância NÃO é mais desenhada sobre o campo (Fase 4): apenas a linha e
  // o halo do rusher mais próximo. O valor é exibido em HUD/painel.
  FieldRenderer.prototype._renderApproach = function (frame) {
    const positions = frame.positions || {};
    const qb = this.qbId ? positions[this.qbId] : null;
    const rusherId = frame.closest_rusher_nflId != null ? String(frame.closest_rusher_nflId) : null;
    const rusher = rusherId ? positions[rusherId] : null;
    const d = frame.geometric_min_distance_yd;

    if (qb && rusher && d != null) {
      this.approachLine.setAttribute("x1", qb.x);
      this.approachLine.setAttribute("y1", fy(qb.y));
      this.approachLine.setAttribute("x2", rusher.x);
      this.approachLine.setAttribute("y2", fy(rusher.y));
      this.approachLine.setAttribute("visibility", "visible");

      this.closestHalo.setAttribute("cx", rusher.x);
      this.closestHalo.setAttribute("cy", fy(rusher.y));
      this.closestHalo.setAttribute("visibility", "visible");
    } else {
      this.approachLine.setAttribute("visibility", "hidden");
      this.closestHalo.setAttribute("visibility", "hidden");
    }
  };

  global.FieldRenderer = FieldRenderer;
})(window);
