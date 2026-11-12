// Table of contents enhancements for posts with `toc: true`. The TOC markup
// is rendered at build time; this only adds:
//  - highlighting the section currently being read (aria-current)
//  - showing that section's title in the collapsed mobile bar
//  - closing the mobile dropdown after a link is chosen
(function () {
  "use strict";

  var navs = document.querySelectorAll(".toc");
  if (!navs.length) return;

  var links = document.querySelectorAll(".toc li > a[href^='#']");
  var headings = [];
  var seen = {};
  links.forEach(function (link) {
    var id = decodeURIComponent(link.hash.slice(1));
    if (seen[id]) return;
    var el = document.getElementById(id);
    if (el) {
      seen[id] = true;
      headings.push(el);
    }
  });
  if (!headings.length) return;

  var current = document.querySelector(".toc-inline .toc-current");
  var sidebarScroll = document.querySelector(".toc-sidebar .toc-sticky");
  var details = document.querySelector(".toc-inline details");
  var activeId = null;
  var ticking = false;

  function update() {
    ticking = false;
    // The active section is the last heading that has scrolled past a line
    // a little below the top of the viewport.
    var line = Math.min(window.innerHeight * 0.25, 160);
    var active = null;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - line <= 0) {
        active = headings[i];
      } else {
        break;
      }
    }
    // At the very bottom of the page, the last section is active even if
    // its heading never reaches the line.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = headings[headings.length - 1];
    }

    var id = active ? active.id : null;
    if (id === activeId) return;
    activeId = id;

    links.forEach(function (link) {
      if (id && decodeURIComponent(link.hash.slice(1)) === id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    if (current) current.textContent = active ? active.textContent : "";

    // Keep the highlighted entry visible if the sidebar list scrolls.
    if (sidebarScroll) {
      var activeLink = sidebarScroll.querySelector("a[aria-current]");
      if (activeLink) {
        var box = sidebarScroll.getBoundingClientRect();
        var r = activeLink.getBoundingClientRect();
        if (r.top < box.top) sidebarScroll.scrollTop -= box.top - r.top + 8;
        else if (r.bottom > box.bottom) sidebarScroll.scrollTop += r.bottom - box.bottom + 8;
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  if (details) {
    details.addEventListener("click", function (e) {
      if (e.target.closest("a")) details.open = false;
    });
  }
})();
