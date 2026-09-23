/* gallery.js — galeria de visualizações complementares com lightbox simples.
 *
 * Abre a imagem ampliada ao clicar em uma miniatura; fecha por botão, clique
 * no fundo ou tecla Escape. Não duplica arquivos: usa o mesmo src das imagens.
 */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    const gallery = document.getElementById("gallery");
    const box = document.getElementById("lightbox");
    const img = document.getElementById("lightbox-img");
    const cap = document.getElementById("lightbox-caption");
    const closeBtn = document.getElementById("lightbox-close");
    if (!gallery || !box) return;

    function open(src, caption, alt) {
      img.src = src;
      img.alt = alt || "";
      cap.textContent = caption || "";
      box.hidden = false;
    }
    function close() {
      box.hidden = true;
      img.src = "";
    }

    gallery.querySelectorAll(".gcard").forEach(function (card) {
      card.setAttribute("tabindex", "0");
      const src = card.getAttribute("data-src");
      const im = card.querySelector("img");
      const fig = card.querySelector("figcaption");
      const caption = fig ? fig.textContent.replace(/\s+/g, " ").trim() : "";
      const openThis = function () { open(src, caption, im ? im.alt : ""); };
      card.addEventListener("click", openThis);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.code === "Space") { e.preventDefault(); openThis(); }
      });
    });

    closeBtn.addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.hidden && e.key === "Escape") close();
    });
  });
})();
