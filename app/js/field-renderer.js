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

  function FieldRenderer(svg) {
    this.svg = svg;
    this.playerNodes = new Map();   // nflId(string) -> <circle>
    this.labelNodes = new Map();    // nflId(string) -> <text>
    this.ballNode = null;
    this.approachLine = null;
    this.approachLabel = null;
    this.qbId = null;
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

    // Linha de aproximação (criada uma vez, escondida até haver dados)
    this.approachLine = el("line", { class: "approach-line", visibility: "hidden" });
    this.gLine.appendChild(this.approachLine);
    this.approachLabel = el("text", { class: "approach-label", visibility: "hidden" });
    this.gLabels.appendChild(this.approachLabel);
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

      const c = el("circle", { class: cls, r: p.isQB ? 1.25 : 1.1, cx: -10, cy: -10 });
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
  };

  // Linha QB <-> pass rusher mais próximo (somente rushers — RF6.2/P5).
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

      this.approachLabel.setAttribute("x", (qb.x + rusher.x) / 2);
      this.approachLabel.setAttribute("y", fy((qb.y + rusher.y) / 2) - 0.6);
      this.approachLabel.textContent = d.toFixed(2) + " yd";
      this.approachLabel.setAttribute("visibility", "visible");
    } else {
      this.approachLine.setAttribute("visibility", "hidden");
      this.approachLabel.setAttribute("visibility", "hidden");
    }
  };

  global.FieldRenderer = FieldRenderer;
})(window);
