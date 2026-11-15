// Figures in posts (styles in css/figures.css, usage in the README).
//
// Charts: each <figure class="fig"> made by _includes/chart.html carries
// its data as JSON; every panel in it is drawn here as an inline SVG sized
// to the column, and redrawn when the column changes width. Four panel
// types: "stages" (a series of points with intervals, grouped into
// phases), "lines" (several series over a shared x axis, with a list of
// rows that highlight them), "dots" (rates with intervals, one row per
// agent) and "pool" (one measurement against the same one pooled, over a
// histogram of the individual measurements). A figure with data-expand gets a button that opens it over
// the window, where its charts are drawn larger.
//
// Embeds: _includes/embed.html shows a poster image that is swapped for
// the live iframe as it nears the viewport. The framed page asks to be
// expanded over the window, or collapsed again, by postMessage.
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function html(tag, cls, parent, inner) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (inner != null) e.innerHTML = inner;
    if (parent) parent.appendChild(e);
    return e;
  }
  // Signed number with a true minus sign
  function signed(v, d) {
    var s = Math.abs(v).toFixed(d == null ? 2 : d);
    return (v > 0 ? "+" : v < 0 ? "−" : "") + s;
  }
  function int(v) {
    return v.toLocaleString("en-US");
  }
  function niceTicks(lo, hi, step) {
    var out = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step)
      out.push(Math.round(t * 1000) / 1000);
    return out;
  }

  // Charts in a figure that has been opened over the window draw larger
  function isBig(host) {
    return !!host.closest(".fig.expanded");
  }

  function makeTip(host) {
    var tip = html("div", "fig-tip", host);
    return {
      show: function (inner, ev) {
        tip.innerHTML = inner;
        var box = host.getBoundingClientRect();
        var x = ev.clientX - box.left + 14;
        if (x + tip.offsetWidth > box.width) x = ev.clientX - box.left - tip.offsetWidth - 14;
        tip.style.left = Math.max(0, x) + "px";
        tip.style.top = Math.max(0, ev.clientY - box.top - tip.offsetHeight - 10) + "px";
        tip.style.opacity = 1;
      },
      hide: function () {
        tip.style.opacity = 0;
      },
    };
  }

  // ------------------------------------------------------------------
  // stages: one series through ordered stages, grouped into phases
  // ------------------------------------------------------------------
  function drawStages(host, p) {
    var W = host.clientWidth;
    var narrow = W < 520;
    var big = isBig(host);
    var m = { l: big ? 54 : 44, r: narrow ? 10 : 14, t: big ? 46 : 36, b: big ? 60 : 46 };
    var H = narrow ? 300 : big ? Math.max(420, Math.min(680, window.innerHeight - 300)) : 360;
    var pts = p.points;
    var vals = pts.reduce(function (a, q) { return a.concat([q.lo, q.hi]); }, []);
    var y0 = Math.floor(Math.min.apply(null, vals) * 10) / 10;
    var y1 = Math.ceil(Math.max.apply(null, vals) * 10) / 10;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": p.aria }, host);
    // A small gap between phases, so each reads as its own block
    var gap = narrow ? 8 : 14;
    var nGaps = p.phases.length - 1;
    var step = (W - m.l - m.r - gap * nGaps) / pts.length;
    var xs = pts.map(function (q, i) { return m.l + q.phase * gap + step * (i + 0.5); });
    var y = function (v) { return m.t + (y1 - v) / (y1 - y0) * (H - m.t - m.b); };
    var color = function (ph) { return "var(--fig-" + p.phases[ph].color + ")"; };

    niceTicks(y0, y1, 0.2).forEach(function (t) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: t === 0 ? "var(--fig-axis)" : "var(--fig-grid)", "stroke-width": 1 }, svg);
      el("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", class: "tick" }, svg, signed(t, 1));
    });

    // Phase blocks: a name on top, a coloured rule and the unit beneath
    p.phases.forEach(function (ph, pi) {
      var idx = pts.map(function (q, i) { return q.phase === pi ? i : -1; }).filter(function (i) { return i >= 0; });
      var a = xs[idx[0]] - step / 2, b = xs[idx[idx.length - 1]] + step / 2;
      el("text", { x: a + 2, y: big ? 15 : 12, class: "phase-label" }, svg, ph.name);
      el("rect", { x: a + 2, y: H - m.b + (big ? 30 : 22), width: b - a - 4, height: 2, rx: 1, fill: color(pi), opacity: 0.55 }, svg);
      el("text", { x: (a + b) / 2, y: H - 6, "text-anchor": "middle", class: "axis-label" }, svg, ph.unit);
    });

    // Reference agent: a band for its interval and a line for its mean
    if (p.ref) {
      el("rect", { x: m.l, y: y(p.ref.hi), width: W - m.l - m.r, height: y(p.ref.lo) - y(p.ref.hi), fill: "var(--fig-ref)", opacity: 0.08 }, svg);
      el("line", { x1: m.l, x2: W - m.r, y1: y(p.ref.v), y2: y(p.ref.v), stroke: "var(--fig-ref)", "stroke-width": 1.25 }, svg);
      el("text", { x: m.l + 6, y: y(p.ref.hi) - 6, class: "val" }, svg, p.ref.label + " " + signed(p.ref.v));
    }

    el("polyline", {
      points: pts.map(function (q, i) { return xs[i] + "," + y(q.v); }).join(" "),
      fill: "none", stroke: "var(--fig-axis)", "stroke-width": 1.5, "stroke-linejoin": "round",
    }, svg);

    // Label every stage where there is room, otherwise every 2nd or 3rd
    var every = pts.map(function (q) {
      var widest = pts.reduce(function (w, r) { return r.phase === q.phase ? Math.max(w, r.label.length) : w; }, 0);
      return Math.max(1, Math.ceil((widest * (big ? 8.5 : 7) + 10) / step));
    });
    pts.forEach(function (q, i) {
      var c = color(q.phase);
      el("line", { x1: xs[i], x2: xs[i], y1: y(q.lo), y2: y(q.hi), stroke: c, "stroke-width": big ? 2.5 : 2, "stroke-linecap": "round" }, svg);
      el("circle", { cx: xs[i], cy: y(q.v), r: narrow ? 4 : big ? 6 : 4.5, fill: c, stroke: "var(--fig-surface)", "stroke-width": 2 }, svg);
      // Counted from the end of each phase, so its final stage always
      // keeps its label
      var last = i === pts.length - 1 || pts[i + 1].phase !== q.phase;
      var fromEnd = 0;
      for (var j = i; j < pts.length - 1 && pts[j + 1].phase === q.phase; j++) fromEnd++;
      if (last || fromEnd % every[i] === 0)
        el("text", { x: xs[i], y: H - m.b + (big ? 21 : 16), "text-anchor": "middle", class: "tick" }, svg, q.label);
    });
    // Direct labels: where the run starts and where it ends
    var first = pts[0], end = pts[pts.length - 1];
    el("text", { x: xs[0] + 9, y: y(first.v) + 4, class: "val" }, svg, signed(first.v));
    el("text", { x: xs[pts.length - 1], y: y(end.hi) - 9, "text-anchor": "middle", class: "val strong" }, svg, signed(end.v));

    var tip = makeTip(host);
    var guide = el("line", { y1: m.t, y2: H - m.b, stroke: "var(--fig-axis)", "stroke-width": 1, visibility: "hidden" }, svg);
    svg.insertBefore(guide, svg.querySelector("polyline"));
    var hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b + 20, fill: "transparent" }, svg);
    function move(ev) {
      var px = ev.clientX - svg.getBoundingClientRect().left;
      var best = 0;
      xs.forEach(function (x, i) { if (Math.abs(x - px) < Math.abs(xs[best] - px)) best = i; });
      var q = pts[best], ph = p.phases[q.phase];
      guide.setAttribute("x1", xs[best]);
      guide.setAttribute("x2", xs[best]);
      guide.setAttribute("visibility", "visible");
      var vsRef = p.ref ? '<div class="k">' + signed(q.v - p.ref.v) + " vs the " + p.ref.label + "</div>" : "";
      tip.show(
        '<div><span class="fig-key" style="--c:' + color(q.phase) + '"></span><b>' + ph.long.replace("{}", q.label) + "</b></div>" +
        "<div><b>" + signed(q.v, 3) + '</b> <span class="k">per hand, 95% interval ' + signed(q.lo, 3) + " to " + signed(q.hi, 3) + "</span></div>" + vsRef, ev);
    }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerdown", move);
    hit.addEventListener("pointerleave", function () { tip.hide(); guide.setAttribute("visibility", "hidden"); });
  }

  // ------------------------------------------------------------------
  // lines: several series over a shared x axis. Two are emphasised; the
  // rest are quiet context until a row in the list below (or the line
  // itself) is hovered, focused or tapped.
  // ------------------------------------------------------------------
  function drawLines(host, p, state) {
    var W = host.clientWidth;
    var narrow = W < 520;
    var big = isBig(host);
    var m = { l: big ? 54 : 44, r: big ? 42 : 34, t: 10, b: big ? 58 : 44 };
    var H = narrow ? 320 : big ? Math.max(440, Math.min(660, window.innerHeight - 280)) : 400;
    var all = [];
    p.series.forEach(function (s) { s.seeds.forEach(function (sd) { all = all.concat(sd); }); });
    var y0 = Math.floor(Math.min.apply(null, all) * 10) / 10;
    var y1 = Math.ceil(Math.max.apply(null, all) * 10) / 10;
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": p.aria }, host);
    var x = function (i) { return m.l + 8 + i * (W - m.l - m.r - 8) / (p.x.length - 1); };
    var y = function (v) { return m.t + (y1 - v) / (y1 - y0) * (H - m.t - m.b); };

    niceTicks(y0, y1, 0.2).forEach(function (t) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: t === 0 ? "var(--fig-axis)" : "var(--fig-grid)", "stroke-width": 1 }, svg);
      el("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", class: "tick" }, svg, signed(t, 1));
    });
    p.x.forEach(function (v, i) {
      el("text", { x: x(i), y: H - m.b + (big ? 24 : 18), "text-anchor": "middle", class: "tick" }, svg, v + (p.xsuffix || ""));
    });
    el("text", { x: (m.l + W - m.r) / 2, y: H - 6, "text-anchor": "middle", class: "axis-label" }, svg, p.xlabel);

    var path = function (vals) { return vals.map(function (v, i) { return x(i) + "," + y(v); }).join(" "); };
    var seedLayer = el("g", {}, svg);
    var marks = {};
    // Draw quiet lines first so the emphasised ones sit on top
    var order = p.series.slice().sort(function (a, b) {
      return (p.emphasis.indexOf(a.n) >= 0) - (p.emphasis.indexOf(b.n) >= 0);
    });
    order.forEach(function (s) {
      var g = el("g", {}, svg);
      marks[s.n] = {
        s: s, g: g,
        line: el("polyline", { points: path(s.mean), fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round" }, g),
        dot: el("circle", { cx: x(p.x.length - 1), cy: y(s.mean[s.mean.length - 1]), r: big ? 5 : 4, stroke: "var(--fig-surface)", "stroke-width": 2 }, g),
      };
    });

    // End labels: the rung numbers, nudged apart where lines finish close
    var ends = p.series.map(function (s) { return { n: s.n, y: y(s.mean[s.mean.length - 1]) }; })
      .sort(function (a, b) { return a.y - b.y; });
    var apart = big ? 16 : 13;
    for (var i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < apart) ends[i].y = ends[i - 1].y + apart;
    ends.forEach(function (e) {
      marks[e.n].label = el("text", { x: W - m.r + (big ? 13 : 10), y: e.y + (big ? 5 : 4), class: "end-label" }, svg, e.n);
    });

    function colorOf(n) {
      if (state.active === n) return "var(--fig-search)";
      if (p.emphasis.indexOf(n) === 0) return "var(--fig-ref)";
      if (p.emphasis.indexOf(n) === 1) return "var(--fig-boot)";
      return "var(--fig-context)";
    }
    function paint() {
      seedLayer.innerHTML = "";
      p.series.forEach(function (s) {
        var k = marks[s.n], on = state.active === s.n, emph = p.emphasis.indexOf(s.n) >= 0;
        var c = colorOf(s.n);
        k.line.setAttribute("stroke", c);
        k.line.setAttribute("stroke-width", (on ? 3 : emph ? 2.5 : 1.5) * (big ? 1.25 : 1));
        k.dot.setAttribute("fill", c);
        k.label.setAttribute("class", "end-label" + (on || emph ? " on" : ""));
        if (on) {
          svg.appendChild(k.g);
          s.seeds.forEach(function (sd) {
            el("polyline", { points: path(sd), fill: "none", stroke: c, "stroke-width": big ? 1.25 : 1, opacity: 0.4 }, seedLayer);
          });
        }
      });
      state.rows.forEach(function (b) {
        var n = +b.dataset.n;
        b.setAttribute("aria-pressed", String(state.active === n));
        b.querySelector(".swatch").style.setProperty("--c", colorOf(n));
      });
    }
    state.paint = paint;
    paint();

    // Hover: the nearest line at the nearest x
    var tip = makeTip(host);
    var hit = el("rect", { x: m.l, y: m.t, width: W - m.l, height: H - m.t - m.b, fill: "transparent" }, svg);
    function move(ev) {
      var box = svg.getBoundingClientRect();
      var px = ev.clientX - box.left, py = ev.clientY - box.top;
      var xi = 0;
      p.x.forEach(function (_, i) { if (Math.abs(x(i) - px) < Math.abs(x(xi) - px)) xi = i; });
      var best = p.series[0];
      p.series.forEach(function (s) { if (Math.abs(y(s.mean[xi]) - py) < Math.abs(y(best.mean[xi]) - py)) best = s; });
      if (!state.pinned) { state.active = best.n; paint(); }
      var s = state.pinned ? marks[state.active].s : best;
      tip.show(
        '<div><span class="fig-key" style="--c:' + colorOf(s.n) + '"></span><b>' + s.n + ". " + s.name + "</b></div>" +
        "<div><b>" + signed(s.mean[xi], 3) + '</b> <span class="k">per hand at ' + p.x[xi] + (p.xsuffix || "") + " hands</span></div>" +
        '<div class="k">seeds ' + s.seeds.map(function (sd) { return signed(sd[xi]); }).join(", ") + "</div>", ev);
    }
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerleave", function () {
      tip.hide();
      if (!state.pinned) { state.active = null; paint(); }
    });
    hit.addEventListener("click", function (ev) {
      if (state.pinned) { state.pinned = false; state.active = null; paint(); tip.hide(); }
      else { move(ev); state.pinned = true; }
    });
  }

  function buildLadder(panelEl, p, state) {
    var ul = html("ul", "fig-ladder", panelEl);
    p.series.forEach(function (s) {
      var li = html("li", "", ul);
      var b = html("button", "", li,
        '<span class="num">' + s.n + '</span><span class="swatch"></span>' +
        '<span class="name"><b>' + s.name + "</b> <span>" + s.note + "</span></span>" +
        '<span class="end">' + signed(s.mean[s.mean.length - 1]) + "</span>");
      b.type = "button";
      b.dataset.n = s.n;
      b.setAttribute("aria-pressed", "false");
      var set = function (n, pin) {
        state.active = n;
        state.pinned = pin;
        if (state.paint) state.paint();
      };
      b.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" && !state.pinned) set(s.n, false); });
      b.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && !state.pinned) set(null, false); });
      b.addEventListener("focus", function () { if (!state.pinned) set(s.n, false); });
      b.addEventListener("blur", function () { if (!state.pinned) set(null, false); });
      b.addEventListener("click", function () {
        if (state.pinned && state.active === s.n) set(null, false);
        else set(s.n, true);
      });
      state.rows.push(b);
    });
  }

  // ------------------------------------------------------------------
  // dots: a rate with its interval, one row per agent, in labelled groups
  // ------------------------------------------------------------------
  function agentMark(a) {
    return { c: "var(--fig-" + a.style + ")", ring: a.style === "ref" };
  }
  function drawDots(host, p, agents) {
    var W = host.clientWidth;
    var narrow = W < 520;
    var labelled = p.groups.some(function (g) { return g.rows.some(function (r) { return r.label; }); });
    var big = isBig(host);
    var left = labelled ? (narrow ? 150 : big ? 310 : 250) : (narrow ? 96 : big ? 190 : 150);
    var right = 18, top = 4, sub = (labelled ? 30 : 22) * (big ? 1.35 : 1), gap = 10, pad = 8;
    var gh = function (g) { return g.rows.length * sub + pad * 2; };
    var plotH = p.groups.reduce(function (s, g) { return s + gh(g) + gap; }, -gap);
    var H = top + plotH + (big ? 32 : 26);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": p.aria }, host);
    var x = function (v) { return left + (v - p.domain[0]) / (p.domain[1] - p.domain[0]) * (W - left - right); };
    var bottom = top + plotH;

    var gy = top;
    if (p.groups.length > 1)
      p.groups.forEach(function (g, gi) {
        if (gi % 2 === 0) el("rect", { x: 0, y: gy, width: W, height: gh(g), rx: 2, fill: "#fafafa" }, svg);
        gy += gh(g) + gap;
      });
    p.ticks.forEach(function (t) {
      el("line", { x1: x(t), x2: x(t), y1: top, y2: bottom, stroke: "var(--fig-grid)", "stroke-width": 1 }, svg);
    });
    // Thin the tick labels where they would touch, keeping the last one
    var tickStep = Math.ceil((big ? 54 : 44) / (x(p.ticks[1]) - x(p.ticks[0])));
    p.ticks.forEach(function (t, i) {
      if ((p.ticks.length - 1 - i) % tickStep === 0)
        el("text", { x: x(t), y: bottom + (big ? 22 : 17), "text-anchor": "middle", class: "tick" }, svg, t + "%");
    });

    var tip = makeTip(host);
    gy = top;
    p.groups.forEach(function (g) {
      var h = gh(g);
      if (g.label) {
        // Wrap a two-word group label onto two lines on narrow screens
        var words = g.label.split(" ");
        if (narrow && words.length > 2) {
          var cut = Math.ceil(words.length / 2);
          el("text", { x: 6, y: gy + h / 2 - 3, class: "row-label" + (g.strong ? " strong" : "") }, svg, words.slice(0, cut).join(" "));
          el("text", { x: 6, y: gy + h / 2 + 14, class: "row-label" + (g.strong ? " strong" : "") }, svg, words.slice(cut).join(" "));
        } else {
          el("text", { x: 6, y: gy + h / 2 + 5, class: "row-label" + (g.strong ? " strong" : "") }, svg, g.label);
        }
      }
      g.rows.forEach(function (row, ri) {
        var a = agents.filter(function (q) { return q.key === row.agent; })[0];
        var mk = agentMark(a);
        var r = row.v[0], lo = row.v[1], hi = row.v[2];
        var cy = gy + pad + ri * sub + sub / 2;
        if (row.label) el("text", { x: 6, y: cy + 5, class: "row-label" }, svg, a.name);
        el("line", { x1: x(lo), x2: x(hi), y1: cy, y2: cy, stroke: mk.c, "stroke-width": big ? 2.5 : 2, "stroke-linecap": "round" }, svg);
        if (mk.ring) el("circle", { cx: x(r), cy: cy, r: big ? 5.5 : 4.5, fill: "var(--fig-surface)", stroke: mk.c, "stroke-width": 2 }, svg);
        else el("circle", { cx: x(r), cy: cy, r: big ? 6.5 : 5.5, fill: mk.c, stroke: "var(--fig-surface)", "stroke-width": 2 }, svg);
        var room = W - right - x(hi) > (big ? 70 : 58);
        el("text", { x: room ? x(hi) + 10 : x(lo) - 10, y: cy + 4.5, "text-anchor": room ? "start" : "end", class: "val" + (g.strong ? " strong" : "") }, svg, r.toFixed(2) + "%");
        var hit = el("rect", { x: 0, y: cy - sub / 2, width: W, height: sub, fill: "transparent" }, svg);
        var show = function (ev) {
          tip.show(
            '<div><span class="fig-key' + (mk.ring ? " ring" : "") + '" style="--c:' + mk.c + '"></span><b>' + a.name + "</b></div>" +
            (g.label ? '<div class="k">' + g.label + "</div>" : "") +
            "<div><b>" + r.toFixed(2) + '%</b> <span class="k">95% interval ' + lo.toFixed(2) + " to " + hi.toFixed(2) + "</span></div>" +
            '<div class="k">' + int(row.v[3]) + " of " + int(row.v[4]) + " " + p.unit + "</div>", ev);
        };
        hit.addEventListener("pointermove", show);
        hit.addEventListener("pointerdown", show);
        hit.addEventListener("pointerleave", tip.hide);
      });
      gy += h + gap;
    });
  }

  // ------------------------------------------------------------------
  // pool: one noisy measurement against the same measurement pooled over
  // many cases. Rows with intervals on top; beneath them, on the same
  // axis, a histogram of the individual measurements.
  // ------------------------------------------------------------------
  function drawPool(host, p) {
    var W = host.clientWidth;
    var narrow = W < 520;
    var big = isBig(host);
    var left = narrow ? 8 : big ? 250 : 190;
    var right = narrow ? 12 : 18, top = 6;
    var rowH = narrow ? 48 : big ? 48 : 36;
    var histTop = top + p.rows.length * rowH + (narrow ? 22 : 16);
    var histH = narrow ? 130 : big ? Math.max(220, Math.min(380, window.innerHeight - 470)) : 170;
    var base = histTop + histH;
    var H = base + (big ? 52 : 44);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": p.aria }, host);
    var d0 = p.domain[0], d1 = p.domain[1];
    var x = function (v) { return left + (v - d0) / (d1 - d0) * (W - left - right); };
    var fmt = function (v) { return v === 0 ? "0" : signed(v, 2); };

    var tickStep = Math.ceil((big ? 58 : 48) / (x(p.ticks[1]) - x(p.ticks[0])));
    var zeroAt = p.ticks.indexOf(0);
    p.ticks.forEach(function (t, i) {
      el("line", { x1: x(t), x2: x(t), y1: top, y2: base, stroke: t === 0 ? "var(--fig-axis)" : "var(--fig-grid)", "stroke-width": t === 0 ? 1.5 : 1 }, svg);
      if ((i - zeroAt) % tickStep === 0)
        el("text", { x: x(t), y: base + (big ? 22 : 17), "text-anchor": "middle", class: "tick" }, svg, fmt(t));
    });
    el("line", { x1: left, x2: W - right, y1: base, y2: base, stroke: "var(--fig-axis)", "stroke-width": 1 }, svg);
    el("text", { x: (left + W - right) / 2, y: H - 5, "text-anchor": "middle", class: "axis-label" }, svg, narrow ? p.xshort : p.xlabel);

    var tip = makeTip(host);
    p.rows.forEach(function (row, i) {
      var c = "var(--fig-" + row.style + ")";
      var cy = top + i * rowH + (narrow ? rowH - 14 : rowH / 2);
      if (narrow) el("text", { x: left, y: cy - 16, class: "row-label" }, svg, row.name + "  " + row.text);
      else el("text", { x: 6, y: cy + 5, class: "row-label" }, svg, row.name);
      el("line", { x1: x(row.v - row.half), x2: x(row.v + row.half), y1: cy, y2: cy, stroke: c, "stroke-width": big ? 2.5 : 2, "stroke-linecap": "round" }, svg);
      if (row.style === "ref") el("circle", { cx: x(row.v), cy: cy, r: big ? 5.5 : 4.5, fill: "var(--fig-surface)", stroke: c, "stroke-width": 2 }, svg);
      else el("circle", { cx: x(row.v), cy: cy, r: big ? 6.5 : 5.5, fill: c, stroke: "var(--fig-surface)", "stroke-width": 2 }, svg);
      if (!narrow) el("text", { x: x(row.v + row.half) + 12, y: cy + 4.5, class: "val strong" }, svg, row.text);
      var hit = el("rect", { x: 0, y: top + i * rowH, width: W, height: rowH, fill: "transparent" }, svg);
      var show = function (ev) {
        tip.show('<div><span class="fig-key' + (row.style === "ref" ? " ring" : "") + '" style="--c:' + c + '"></span><b>' + row.name + "</b></div>" +
          "<div><b>" + row.text + '</b> <span class="k">' + p.unit + "</span></div>" +
          row.tip.map(function (t) { return '<div class="k">' + t + "</div>"; }).join(""), ev);
      };
      hit.addEventListener("pointermove", show);
      hit.addEventListener("pointerdown", show);
      hit.addEventListener("pointerleave", tip.hide);
    });

    // Histogram of the individual measurements
    var h = p.hist, total = h.counts.reduce(function (s, n) { return s + n; }, 0);
    var peak = Math.max.apply(null, h.counts);
    var bh = function (n) { return n / peak * (histH - (narrow ? 34 : 14)); };
    var negTop = base;
    h.counts.forEach(function (n, i) {
      var lo = h.start + i * h.width, hi = lo + h.width;
      var neg = hi <= 1e-9;
      var x0 = x(lo) + 1, x1 = x(hi) - 1;
      if (n) {
        el("rect", { x: x0, y: base - bh(n), width: Math.max(1, x1 - x0), height: bh(n), fill: neg ? "var(--fig-ref)" : "var(--fig-context)" }, svg);
        if (neg) negTop = Math.min(negTop, base - bh(n));
      }
      var last = i === h.counts.length - 1;
      var hit = el("rect", { x: x(lo), y: histTop, width: x(hi) - x(lo), height: histH, fill: "transparent" }, svg);
      var show = function (ev) {
        tip.show("<div><b>" + fmt(Math.round(lo * 100) / 100) + (last ? " or more" : " to " + fmt(Math.round(hi * 100) / 100)) + '</b> <span class="k">' + p.unit + "</span></div>" +
          "<div><b>" + int(n) + '</b> <span class="k">of ' + int(total) + " searches (" + (100 * n / total).toFixed(1) + "%)</span></div>", ev);
      };
      hit.addEventListener("pointermove", show);
      hit.addEventListener("pointerdown", show);
      hit.addEventListener("pointerleave", tip.hide);
    });
    if (narrow) {
      el("text", { x: left, y: histTop + 12, class: "row-label" }, svg, h.name);
    } else {
      el("text", { x: 6, y: histTop + 20, class: "row-label" }, svg, h.name);
      el("text", { x: 6, y: histTop + (big ? 44 : 39), class: "val" }, svg, h.note);
    }
    if (narrow) el("text", { x: left, y: negTop - 8, class: "val" }, svg, h.negshort);
    else el("text", { x: x(0) - 8, y: negTop - 8, "text-anchor": "end", class: "val" }, svg, h.neg);
  }

  function setupChart(fig) {
    var src = fig.querySelector('script[type="application/json"]');
    if (!src) return;
    var data = JSON.parse(src.textContent);
    var panels = [];
    fig.querySelectorAll(".fig-panel").forEach(function (panelEl, i) {
      var p = data.panels[i];
      var host = panelEl.querySelector(".fig-chart");
      var state = { active: null, pinned: false, rows: [] };
      if (p.type === "dots" && p.legend) {
        var ul = document.createElement("ul");
        ul.className = "fig-legend";
        data.agents.forEach(function (a) {
          var mk = agentMark(a);
          html("li", "", ul,
            '<span class="fig-key' + (mk.ring ? " ring" : "") + '" style="--c:' + mk.c + '"></span>' +
            "<span>" + a.name + ' <span class="fig-note">' + a.note + "</span></span>");
        });
        panelEl.insertBefore(ul, host);
      }
      if (p.type === "lines") {
        panelEl.classList.add("has-ladder");
        buildLadder(panelEl, p, state);
      }
      panels.push(function () {
        host.innerHTML = "";
        if (p.type === "stages") drawStages(host, p);
        else if (p.type === "pool") drawPool(host, p);
        else if (p.type === "lines") drawLines(host, p, state);
        else drawDots(host, p, data.agents);
      });
    });
    var width = 0;
    var draw = function () {
      var w = fig.clientWidth;
      if (!w || w === width) return;
      width = w;
      panels.forEach(function (f) { f(); });
    };
    draw();
    if (window.ResizeObserver) new ResizeObserver(draw).observe(fig);
    else window.addEventListener("resize", draw);
    // Web fonts change text widths after the first draw
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(function () { width = 0; draw(); });
    if (fig.hasAttribute("data-expand")) setupExpand(fig, function () { width = 0; draw(); });
  }

  // A button that opens the figure over the window and closes it again.
  // A spacer holds the figure's place in the page while it is open.
  function setupExpand(fig, redraw) {
    var btn = html("button", "fig-expand", fig,
      '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M10 2h4v4M6 14H2v-4M14 2 9.5 6.5M2 14l4.5-4.5"/></svg><span>Close</span>');
    btn.type = "button";
    var spacer = null;
    function set(on) {
      if (on) {
        spacer = html("div", "fig-spacer");
        spacer.style.height = fig.offsetHeight + "px";
        fig.parentNode.insertBefore(spacer, fig);
      } else if (spacer) {
        spacer.remove();
        spacer = null;
      }
      fig.classList.toggle("expanded", on);
      document.documentElement.classList.toggle("fig-open", on);
      btn.setAttribute("aria-label", on ? "Close the larger view" : "Open a larger view of this chart");
      btn.title = on ? "" : "Larger view";
      fig.scrollTop = 0;
      redraw();
    }
    set(false);
    btn.addEventListener("click", function () { set(!fig.classList.contains("expanded")); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && fig.classList.contains("expanded")) set(false);
    });
  }

  // ------------------------------------------------------------------
  // Embeds
  // ------------------------------------------------------------------
  function setupEmbed(fig) {
    var stage = fig.querySelector(".fig-stage");
    var src = stage.getAttribute("data-src");
    if (!src) return;
    var frame = null;
    function load() {
      if (frame) return;
      frame = document.createElement("iframe");
      frame.title = stage.getAttribute("data-title") || "";
      frame.setAttribute("allow", "fullscreen");
      frame.addEventListener("load", function () { stage.classList.add("live"); });
      frame.src = src;
      stage.appendChild(frame);
    }
    function setExpanded(on) {
      stage.classList.toggle("expanded", on);
      document.documentElement.classList.toggle("fig-open", on);
    }
    // The poster links to the standalone page; with scripting on, a click
    // before the frame has loaded waits for it instead
    stage.addEventListener("click", function (e) {
      if (e.target.closest("a")) { e.preventDefault(); load(); }
    });
    window.addEventListener("message", function (e) {
      if (!frame || e.source !== frame.contentWindow || !e.data) return;
      if (e.data.type === "sheepshead-viz:expand") setExpanded(!!e.data.expanded);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && frame && stage.classList.contains("expanded"))
        frame.contentWindow.postMessage({ type: "sheepshead-viz:collapse" }, "*");
    });
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { load(); io.disconnect(); }
      }, { rootMargin: "600px 0px" });
      io.observe(stage);
    } else load();
  }

  function init() {
    document.querySelectorAll("figure.fig[data-fig='chart']").forEach(setupChart);
    document.querySelectorAll("figure.fig[data-fig='embed']").forEach(setupEmbed);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
