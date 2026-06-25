// Lightweight, dependency-free image lightbox for {% imgpopup %} thumbnails.
// Clicking a link with class "imgpopup" opens its full-size image (the href)
// in a modal overlay. Close by clicking the overlay or pressing Escape.
(function () {
  "use strict";

  var overlay, overlayImg, lastFocused;

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.className = "imgpopup-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.hidden = true;

    overlayImg = document.createElement("img");
    overlayImg.className = "imgpopup-overlay-img";
    overlayImg.alt = "";
    overlay.appendChild(overlayImg);

    overlay.addEventListener("click", close);
    document.body.appendChild(overlay);
  }

  function open(href, alt) {
    if (!overlay) buildOverlay();
    lastFocused = document.activeElement;
    overlayImg.src = href;
    overlayImg.alt = alt || "";
    overlay.hidden = false;
    document.body.classList.add("imgpopup-open");
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    overlayImg.removeAttribute("src");
    document.body.classList.remove("imgpopup-open");
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.addEventListener("click", function (e) {
    var link = e.target.closest("a.imgpopup");
    if (!link) return;
    e.preventDefault();
    var img = link.querySelector("img");
    open(link.getAttribute("href"), link.getAttribute("title") || (img && img.alt));
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });
})();
