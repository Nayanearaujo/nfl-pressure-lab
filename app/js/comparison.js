/* comparison.js — tabela "Comparação entre jogadas" (visão agregada).
 *
 * Módulo independente e opcional: carrega app/data/aggregate.json e monta uma
 * tabela ordenável com as jogadas lado a lado. Não interfere no Pocket Replay
 * nem em nenhum módulo existente; se o arquivo não existir, a seção é ocultada.
 */
(function () {
  "use strict";

  const COLUMNS = [
    { key: "matchup", numeric: false },
    { key: "minDistanceYd", numeric: true },
    { key: "distanceAtThrowYd", numeric: true },
    { key: "passResultLabel", numeric: false },
    { key: "pffTotal", numeric: true },
  ];

  let rows = [];
  let sortKey = "minDistanceYd";
  let sortDir = 1; // 1 asc, -1 desc

  function fmtYd(v) {
    return v == null ? "—" : v.toFixed(2);
  }

  function compare(a, b) {
    const va = a[sortKey];
    const vb = b[sortKey];
    // Valores ausentes vão sempre para o fim, independente da direção.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") {
      return (va - vb) * sortDir;
    }
    return String(va).localeCompare(String(vb), "pt-BR") * sortDir;
  }

  function render() {
    const body = document.getElementById("comparison-body");
    if (!body) return;
    const sorted = rows.slice().sort(compare);
    body.innerHTML = "";
    sorted.forEach((p) => {
      const tr = document.createElement("tr");
      const cells = [
        p.matchup || "—",
        fmtYd(p.minDistanceYd),
        fmtYd(p.distanceAtThrowYd),
        p.passResultLabel || "—",
        String(p.pffTotal != null ? p.pffTotal : "—"),
      ];
      cells.forEach((text, i) => {
        const td = document.createElement("td");
        if (COLUMNS[i].numeric) td.className = "num";
        td.textContent = text;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // Indicadores de ordenação nos cabeçalhos.
    document.querySelectorAll("#comparison-table th").forEach((th) => {
      const key = th.getAttribute("data-key");
      th.setAttribute("aria-sort",
        key === sortKey ? (sortDir === 1 ? "ascending" : "descending") : "none");
      const btn = th.querySelector(".th-sort");
      if (btn) {
        const arrow = key === sortKey ? (sortDir === 1 ? " ▲" : " ▼") : "";
        btn.dataset.arrow = arrow;
      }
    });
  }

  function wireHeaders() {
    document.querySelectorAll("#comparison-table th .th-sort").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.closest("th").getAttribute("data-key");
        if (key === sortKey) {
          sortDir = -sortDir;
        } else {
          sortKey = key;
          // Numéricos começam ascendente (menor primeiro); texto também asc.
          sortDir = 1;
        }
        render();
      });
    });
  }

  async function init() {
    const section = document.querySelector(".comparison-wrap");
    if (!section) return;
    try {
      const res = await fetch("data/aggregate.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      rows = (data && data.plays) || [];
      if (!rows.length) {
        section.style.display = "none";
        return;
      }
      wireHeaders();
      render();
    } catch (err) {
      // Falha silenciosa: a tabela é um complemento, não bloqueia o app.
      section.style.display = "none";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
