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

    // Grupos (ordem de pintura): linha de aproximação -> jogadores -> bola ->
    // linhas-guia dos rótulos -> labels
    this.gLine = el("g", {});
    this.gPlayers = el("g", {});
    this.gBall = el("g", {});
    this.gLeaders = el("g", {});
    this.gLabels = el("g", {});
    svg.appendChild(this.gLine);
    svg.appendChild(this.gPlayers);
    svg.appendChild(this.gBall);
    svg.appendChild(this.gLeaders);
    svg.appendChild(this.gLabels);

    // Halo do pass rusher mais próximo (pintado sob os jogadores).
    this.closestHalo = el("circle", { class: "closest-halo", r: 2.5, cx: -10, cy: -10, visibility: "hidden" });
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
    if (this.lastFrame) {
      this._applyViewBox(this.lastFrame);
      this._updateLabels(this.lastFrame); // recalcula rótulos/linhas-guia p/ o novo modo
    }
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
    this.lastVb = vb;
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
    if (this.ballNode) this.ballNode.setAttribute("r", (0.7 * scale).toFixed(3));
    if (this.closestHalo) this.closestHalo.setAttribute("r", (2.5 * scale).toFixed(3));
  };

  // Cria os elementos dos jogadores uma única vez (reusados a cada frame).
  FieldRenderer.prototype.initPlayers = function (playDoc) {
    // limpa estado anterior (troca de jogada)
    this.playerNodes.forEach((n) => n.remove());
    this.labelNodes.forEach((n) => n.remove());
    if (this.leaderNodes) this.leaderNodes.forEach((n) => n.remove());
    this.playerNodes.clear();
    this.labelNodes.clear();
    this.leaderNodes = new Map();
    if (this.ballNode) { this.ballNode.remove(); this.ballNode = null; }

    this.qbId = null;
    playDoc.players.forEach((p) => {
      let cls = "player ";
      if (p.isQB) { cls += "qb"; this.qbId = String(p.nflId); }
      else if (p.isPassRusher) cls += "rusher";
      else if (p.side === "offense") cls += "offense";
      else cls += "defense";

      const baseR = p.isQB ? 1.9 : 1.65;
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

      // linha-guia curta usada quando o rótulo precisa ficar fora do círculo
      const leader = el("line", { class: "leader-line", visibility: "hidden" });
      this.gLeaders.appendChild(leader);
      this.leaderNodes = this.leaderNodes || new Map();
      this.leaderNodes.set(String(p.nflId), leader);
    });

    // bola
    this.ballNode = el("circle", { class: "ball-marker", r: 0.7, cx: -10, cy: -10 });
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
          // a visibilidade final é decidida em _updateLabels (adaptativo)
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
    this._updateLabels(frame);
  };

  // Rotulagem: TODOS os jogadores com número disponível são identificados.
  // O rótulo começa centrado no círculo; se colidir com um rótulo já colocado,
  // é deslocado para fora (com uma linha-guia curta), em vez de ser ocultado.
  // Nunca move a posição real do jogador (cx/cy). Prioridade de colocação:
  // QB e pass rusher mais próximo primeiro, para garantirem a melhor posição.
  FieldRenderer.prototype._updateLabels = function (frame) {
    const positions = frame.positions || {};
    const closestId = frame.closest_rusher_nflId != null ? String(frame.closest_rusher_nflId) : null;

    // Estratégia única de rótulos, com dois comportamentos coerentes:
    // - FULL FIELD: círculos pequenos e muitos jogadores agrupados na linha de
    //   scrimmage. O número começa centrado; se colidiria com outro já colocado,
    //   é deslocado para a posição livre MAIS PRÓXIMA, com uma linha-guia curta.
    // - POCKET FOCUS: os círculos são grandes e comportam o número; mantemos os
    //   números centrados (deslocar "descolaria" o número do círculo no zoom).
    // A colisão é medida em ESPAÇO DE TELA (o número tem tamanho fixo em px) e
    // convertida para jardas pela escala atual do viewBox, para ser consistente
    // nos dois modos.
    const isPocket = this.mode === "pocket";
    const svgPxW = this.svg.getBoundingClientRect().width || 1000;
    const vbW = (this.lastVb && this.lastVb.w) ? this.lastVb.w : FIELD_LEN;
    const ydPerPx = vbW / svgPxW;                  // jardas por pixel de tela
    const MIN_SEP_PX = isPocket ? 0 : 26;          // separação mínima na tela
    const labelRadius = (MIN_SEP_PX / 2) * ydPerPx;

    // Ordem de colocação: QB e rusher mais próximo primeiro (têm prioridade de
    // posição), depois os demais ORDENADOS por proximidade ao QB — assim o nó
    // mais congestionado (linha de scrimmage) é resolvido primeiro, com folga.
    const qbPos = this.qbId ? positions[this.qbId] : null;
    const distToQb = (nflId) => {
      const p = positions[nflId];
      if (!p || !qbPos) return Infinity;
      const dx = p.x - qbPos.x, dy = p.y - qbPos.y; return dx * dx + dy * dy;
    };
    const others = [];
    this.playerNodes.forEach((_n, nflId) => {
      if (nflId !== this.qbId && nflId !== closestId && positions[nflId]) others.push(nflId);
    });
    others.sort((a, b) => distToQb(a) - distToQb(b));
    const ids = [];
    if (this.qbId && positions[this.qbId]) ids.push(this.qbId);
    if (closestId && closestId !== this.qbId && positions[closestId]) ids.push(closestId);
    ids.push(...others);

    const placed = []; // {x,y} centros dos rótulos já colocados
    const freeAt = (x, y) => {
      const minD = labelRadius * 2;
      for (let i = 0; i < placed.length; i++) {
        const dx = placed[i].x - x, dy = placed[i].y - y;
        if (dx * dx + dy * dy < minD * minD) return false;
      }
      return true;
    };
    // 16 direções; procuramos a posição livre mais próxima (menor anel), para
    // que as linhas-guia fiquem curtas e limpas.
    const dirs = [];
    for (let a = 0; a < 16; a++) { const t = (a / 16) * 2 * Math.PI; dirs.push([Math.sin(t), -Math.cos(t)]); }
    const ringStep = MIN_SEP_PX * 0.85 * ydPerPx;

    ids.forEach((nflId, idx) => {
      const label = this.labelNodes.get(nflId);
      const leader = this.leaderNodes.get(nflId);
      const pos = positions[nflId];
      if (!label || !pos || pos.x == null) {
        if (label) label.setAttribute("visibility", "hidden");
        if (leader) leader.setAttribute("visibility", "hidden");
        return;
      }
      if (idx < 2) label.classList.add("priority"); else label.classList.remove("priority");

      const cx = pos.x, cy = fy(pos.y);
      let lx = cx, ly = cy, external = false;
      if (!isPocket && !freeAt(cx, cy)) {
        // menor anel livre => linha-guia curta
        let found = null;
        for (let ring = 1; ring <= 8 && !found; ring++) {
          for (let di = 0; di < dirs.length; di++) {
            const tx = cx + dirs[di][0] * ringStep * ring;
            const ty = cy + dirs[di][1] * ringStep * ring;
            if (freeAt(tx, ty)) { found = { x: tx, y: ty }; break; }
          }
        }
        if (found) { lx = found.x; ly = found.y; external = true; }
      }

      label.setAttribute("x", lx);
      label.setAttribute("y", ly);
      label.setAttribute("visibility", "visible");
      // rótulos externos ficam sobre o gramado; marcamos com classe para dar
      // contraste (texto claro com contorno escuro), em vez de texto escuro.
      if (external) label.classList.add("external"); else label.classList.remove("external");
      placed.push({ x: lx, y: ly });

      if (external && leader) {
        leader.setAttribute("x1", cx);
        leader.setAttribute("y1", cy);
        leader.setAttribute("x2", lx);
        leader.setAttribute("y2", ly);
        leader.setAttribute("visibility", "visible");
      } else if (leader) {
        leader.setAttribute("visibility", "hidden");
      }
    });
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
