// Inline footnotes. kramdown renders footnotes as superscript links to a
// list at the end of the post; that list stays as the no-JS (and RSS)
// fallback. This turns each reference into a toggle that opens the note
// right where it is referenced, so reading it doesn't mean jumping to the
// bottom of a long post and back.
(function () {
  "use strict";

  var refs = document.querySelectorAll(".article-body a.footnote[href^='#']");

  refs.forEach(function (ref) {
    var id = decodeURIComponent(ref.hash.slice(1));
    var item = document.getElementById(id);
    var sup = ref.closest("sup");
    if (!item || !sup) return;

    // The note sits inside the paragraph, so it's built from spans; each
    // paragraph of the footnote becomes a block-level span.
    var note = document.createElement("span");
    note.className = "fn-inline";
    note.id = "inline-" + id.replace(/:/g, "-");
    note.setAttribute("role", "note");
    note.hidden = true;

    Array.prototype.forEach.call(item.children, function (child) {
      var copy = child.cloneNode(true);
      copy.querySelectorAll(".reversefootnote").forEach(function (back) {
        back.remove();
      });
      if (copy.tagName === "P") {
        var para = document.createElement("span");
        para.className = "fn-inline-p";
        while (copy.firstChild) para.appendChild(copy.firstChild);
        copy = para;
      }
      note.appendChild(copy);
    });

    sup.after(note);

    ref.setAttribute("role", "button");
    ref.setAttribute("aria-expanded", "false");
    ref.setAttribute("aria-controls", note.id);
    ref.setAttribute("aria-label", "Footnote " + ref.textContent.trim());

    ref.addEventListener("click", function (event) {
      event.preventDefault();
      var opening = note.hidden;
      note.hidden = !opening;
      ref.setAttribute("aria-expanded", String(opening));
    });
  });

  // Escape closes the note the focused reference opened
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var ref = document.activeElement;
    if (!ref || !ref.matches(".article-body a.footnote[aria-expanded='true']")) return;
    ref.click();
  });
})();
