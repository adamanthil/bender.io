/* The ISMCTS walkthrough figure (_includes/sheepshead/search-walkthrough.html).
   Replays one traced committee search from search-trace.json:

     cards / prior      the six legal cards and the network's policy over them
     p, k, v            every simulation of the first search: the agent's own
                        cards chosen in the tree (indices into cards), whether
                        it reached the end of the hand ("e") or a critic
                        estimate ("c"), and its value x 10000
     detail             a few simulations in full (deal, tricks, outcome)
     samples            a few of the sampled deals, with how often each was used
     q, n               final value and visit count per card for all 3 searches

   Values are game score / 12 from the agent's side. */
(function () {
  "use strict";

  var SUIT = { S: "♠︎", H: "♥︎", D: "♦︎", C: "♣︎" };
  var SVG = "http://www.w3.org/2000/svg";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVG, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function label(c) {
    return c.slice(0, -1) + SUIT[c.slice(-1)];
  }
  function isRed(c) {
    var s = c.slice(-1);
    return s === "H" || s === "D";
  }
  function card(c, cls) {
    var n = el("span", "sw-c" + (cls ? " " + cls : ""));
    if (c) {
      n.textContent = label(c);
      if (isRed(c)) n.classList.add("red");
    }
    return n;
  }
  // Hands are shown in the order of DECK in the sheepsheadai game engine:
  // trump from the queen of clubs down, then clubs, spades and hearts.
  var DECK = (
    "QC QS QH QD JC JS JH JD AD 10D KD 9D 8D 7D " +
    "AC 10C KC 9C 8C 7C AS 10S KS 9S 8S 7S AH 10H KH 9H 8H 7H"
  ).split(" ");
  function sorted(hand) {
    return hand.slice().sort(function (a, b) {
      return DECK.indexOf(a) - DECK.indexOf(b);
    });
  }
  function signed(x, d) {
    var s = Math.abs(x).toFixed(d == null ? 3 : d);
    return (x < 0 ? "−" : "+") + s;
  }
  function num(x) {
    return x.toLocaleString("en-US");
  }

  function init(root, D) {
    var cards = D.cards;
    var A = cards.length;
    var N = D.iters;
    var step = 1;
    var sample = 0;
    var shown = 0; // index into D.detail
    var count = 1; // simulations completed, for step 4
    var raf = 0;

    var table = root.querySelector(".sw-table");
    var play = root.querySelector(".sw-play");
    var grow = root.querySelector(".sw-grow");
    var board = root.querySelector(".sw-board");
    var slider = grow.querySelector("input");
    var out = grow.querySelector("output");
    var runBtn = grow.querySelector("[data-run]");
    var treeHost = root.querySelector(".sw-tree");
    var where = root.querySelector(".sw-nav .where");

    /* ---- running statistics: visits and value sum per card after i sims ---- */
    var cn = [];
    var cs = [];
    for (var a = 0; a < A; a++) {
      cn.push(new Int32Array(N + 1));
      cs.push(new Float64Array(N + 1));
    }
    for (var i = 0; i < N; i++) {
      var first = D.p[i] === "" ? -1 : +D.p[i][0];
      for (a = 0; a < A; a++) {
        cn[a][i + 1] = cn[a][i] + (a === first ? 1 : 0);
        cs[a][i + 1] = cs[a][i] + (a === first ? D.v[i] / 10000 : 0);
      }
    }

    /* ---- the search tree: one node per sequence of the agent's own cards ---- */
    var tree = { kids: {}, order: [], hits: [], depth: 0 };
    var nodes = [];
    for (i = 0; i < N; i++) {
      var at = tree;
      for (var j = 0; j < D.p[i].length; j++) {
        var c = D.p[i][j];
        if (!at.kids[c]) {
          at.kids[c] = { kids: {}, order: [], hits: [], depth: j + 1, card: +c, up: at };
          at.order.push(c);
          nodes.push(at.kids[c]);
        }
        at = at.kids[c];
        at.hits.push(i);
      }
    }
    // Tidy layout: leaves take equal slots, parents sit over their children.
    var slot = 0;
    (function place(n) {
      var ks = Object.keys(n.kids).sort();
      if (!ks.length) {
        n.x = slot++;
        return;
      }
      ks.forEach(function (k) {
        place(n.kids[k]);
      });
      n.x = (n.kids[ks[0]].x + n.kids[ks[ks.length - 1]].x) / 2;
    })(tree);
    var slots = slot;
    function hitsBy(n, upto) {
      // number of entries of the sorted list n.hits that are < upto
      var lo = 0;
      var hi = n.hits.length;
      while (lo < hi) {
        var mid = (lo + hi) >> 1;
        if (n.hits[mid] < upto) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    /* ---- the deal: five seats and the bury ---- */
    function seatName(s) {
      if (s === D.seat) return ["The agent", "seat " + s];
      if (s === D.picker) return ["Seat " + s, "picker"];
      return ["Seat " + s, ""];
    }
    function drawTable(world, flip) {
      table.textContent = "";
      table.appendChild(el("p", "sw-h", world ? "One imagined deal" : "What the agent can see"));
      var mine = sorted(cards);
      var buried = world ? sorted(world.bury) : [];
      for (var s = 1; s <= 5; s++) {
        var hand = world ? sorted(world.h[s - 1]) : [];
        var row = el("div", "sw-seat");
        var who = el("span", "who", seatName(s)[0]);
        var sub = seatName(s)[1];
        if (world && s === world.partner) sub = "partner";
        if (sub) who.appendChild(el("small", "", sub));
        row.appendChild(who);
        for (var k = 0; k < 6; k++) {
          var n;
          if (s === D.seat) n = card(mine[k]);
          else if (!world) n = card("", "back");
          else {
            n = card(hand[k], hand[k] === D.called ? "ace" : "");
            if (flip) {
              n.classList.add("flip");
              n.style.setProperty("--d", (s - 2) * 60 + k * 25);
            }
          }
          row.appendChild(n);
        }
        table.appendChild(row);
      }
      var bury = el("div", "sw-seat");
      var bw = el("span", "who", "Buried");
      bw.appendChild(el("small", "", "by seat " + D.picker));
      bury.appendChild(bw);
      for (k = 0; k < 2; k++) {
        var b = world ? card(buried[k]) : card("", "back");
        if (world && flip) {
          b.classList.add("flip");
          b.style.setProperty("--d", 260 + k * 25);
        }
        bury.appendChild(b);
      }
      table.appendChild(bury);
      if (step === 2) {
        var bar = el("div", "sw-dealbar");
        var again = el("button", "sw-btn", "Deal again");
        again.type = "button";
        again.addEventListener("click", function () {
          sample = (sample + 1) % D.samples.length;
          render(true);
        });
        bar.appendChild(again);
        var u = world.used;
        bar.appendChild(
          el(
            "span",
            "",
            u === 0
              ? "Never used: seat " + D.picker + " would rarely pick with this hand."
              : "Used for " + u + " of the " + num(N) + " simulations."
          )
        );
        table.appendChild(bar);
        var key = el("div", "sw-key");
        var k1 = el("span");
        k1.appendChild(el("i", "ace"));
        k1.appendChild(document.createTextNode("the called ace"));
        key.appendChild(k1);
        table.appendChild(key);
      }
    }

    /* ---- one simulation, trick by trick ---- */
    function drawPlay(d) {
      play.textContent = "";
      var pick = el("div", "sw-sims");
      pick.appendChild(el("span", "", "Simulation"));
      D.detail.forEach(function (s, idx) {
        if (idx > 0 && s.i !== D.detail[idx - 1].i + 1) pick.appendChild(el("span", "dots", "…"));
        var b = el("button", "", num(s.i + 1));
        b.type = "button";
        b.setAttribute("aria-pressed", idx === shown ? "true" : "false");
        b.addEventListener("click", function () {
          shown = idx;
          render(true);
        });
        pick.appendChild(b);
      });
      play.appendChild(pick);

      // The simulation as a flow: one block per trick, cards in the order
      // they were played, ending in the value that is backed up.
      var me = D.seat;
      var flow = el("div", "sw-flow");
      function played(c, seat, cls) {
        var cell = el("span", "sw-pc" + (seat === me ? " me" : ""));
        cell.appendChild(card(c, cls));
        cell.appendChild(el("small", "", seat === me ? "agent" : "seat " + seat));
        return cell;
      }
      function block(ti, result) {
        var b = el("div", "sw-t");
        b.style.setProperty("--d", ti * 170);
        var h = el("div", "sw-th");
        h.appendChild(el("b", "", "Trick " + (ti + 1)));
        if (result) h.appendChild(el("span", "", result));
        b.appendChild(h);
        var row = el("div", "sw-tc");
        b.appendChild(row);
        flow.appendChild(b);
        return row;
      }
      var steps = 0;
      d.tricks.forEach(function (t, ti) {
        var done = t.win > 0;
        var row = block(
          ti,
          done ? (t.win === me ? "the agent" : "seat " + t.win) + " takes it \u00b7 " + t.pts + " pts" : ""
        );
        for (var k = 0; k < 5; k++) {
          var seat = ((t.lead - 1 + k) % 5) + 1;
          var c = t.c[seat - 1];
          if (!c) {
            // an unfinished trick stops at the agent's turn
            var q = played("", me, "todo");
            q.firstChild.textContent = "?";
            row.appendChild(q);
            break;
          }
          var cls = [];
          if (seat === me && ti < d.path.length) cls.push("tree");
          if (t.win === seat) cls.push("win");
          row.appendChild(played(c, seat, cls.join(" ")));
        }
        steps = ti + 1;
      });
      var last = d.tricks[d.tricks.length - 1];
      if (d.kind !== "end" && last.win > 0) {
        // the agent took the last trick shown, so its next turn is a lead
        var lead = played("", me, "todo");
        lead.firstChild.textContent = "?";
        block(steps, "").appendChild(lead);
        steps++;
      }
      play.appendChild(flow);

      var o = el("p", "sw-out");
      o.style.setProperty("--d", steps * 170);
      var led = label(d.path[0]);
      if (d.kind === "end") {
        o.innerHTML =
          "The hand is over. The agent scored <b>" +
          signed(Math.round(d.v * 12), 0) +
          "</b>, which is <b>" +
          signed(d.v) +
          "</b> on the search's scale. Credited to <b>" +
          led +
          "</b>.";
      } else {
        o.innerHTML =
          "The search hasn't been down this line before, so it stops here. The oracle critic, seeing every card, estimates <b>" +
          signed(d.v) +
          "</b>, a score of about <b>" +
          signed(d.v * 12, 1) +
          "</b>. Credited to <b>" +
          led +
          "</b>.";
      }
      play.appendChild(o);

      var key = el("div", "sw-key");
      [
        ["tree", "the agent's card, chosen by the search"],
        ["plain", "played by the network"],
        ["win", "took the trick"],
      ].forEach(function (kv) {
        var sp = el("span");
        sp.appendChild(el("i", kv[0]));
        sp.appendChild(document.createTextNode(kv[1]));
        key.appendChild(sp);
      });
      play.appendChild(key);
    }

    /* ---- the tree as it has grown after `upto` simulations ---- */
    function drawTree(upto) {
      var W = Math.max(280, treeHost.clientWidth || 640);
      var top = 30;
      var gap = W < 480 ? 34 : 40;
      var H = top + gap * 6 + 22;
      var left = W < 480 ? 6 : 74;
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img" });
      s.setAttribute("aria-label", "The search tree after " + upto + " simulations");
      var X = function (n) {
        return left + ((n.x + 0.5) / slots) * (W - left - 6);
      };
      var Y = function (n) {
        return top + gap * n.depth;
      };
      if (left > 20) {
        ["", "1st card", "2nd card", "3rd", "4th", "5th", "6th"].forEach(function (t, dpt) {
          if (!t) return;
          var tx = svg("text", { x: 0, y: top + gap * dpt + 4 });
          tx.textContent = t;
          s.appendChild(tx);
        });
      }
      var edges = svg("g", { fill: "none", stroke: "var(--fig-search)", "stroke-linecap": "round" });
      var dots = svg("g", { fill: "var(--fig-search)" });
      nodes.forEach(function (n) {
        var h = hitsBy(n, upto);
        if (!h) return;
        var x0 = X(n.up);
        var y0 = Y(n.up);
        var x1 = X(n);
        var y1 = Y(n);
        var w = Math.max(0.6, Math.sqrt(h) * 0.42);
        edges.appendChild(
          svg("path", {
            d: "M" + x0.toFixed(1) + " " + y0 + "C" + x0.toFixed(1) + " " + (y0 + gap * 0.55) + " " + x1.toFixed(1) + " " + (y1 - gap * 0.55) + " " + x1.toFixed(1) + " " + y1,
            "stroke-width": w.toFixed(2),
            "stroke-opacity": n.depth === 1 ? 0.55 : 0.4,
          })
        );
        dots.appendChild(svg("circle", { cx: x1.toFixed(1), cy: y1, r: Math.max(1.2, Math.min(5, Math.sqrt(h) * 0.3)).toFixed(2) }));
      });
      s.appendChild(edges);
      s.appendChild(dots);
      s.appendChild(svg("circle", { cx: X(tree).toFixed(1), cy: top, r: 5, fill: "var(--fig-heading)" }));
      var rt = svg("text", { x: X(tree).toFixed(1), y: top - 11, "text-anchor": "middle" });
      rt.textContent = "this decision";
      s.appendChild(rt);
      // Name the six first cards beside their nodes, busiest first; a name
      // that would run into one already placed moves up a row.
      var placed = [];
      Object.keys(tree.kids)
        .map(function (k) {
          return tree.kids[k];
        })
        .sort(function (p, q) {
          return q.hits.length - p.hits.length;
        })
        .forEach(function (n) {
          if (!hitsBy(n, upto)) return;
          var x = X(n);
          var rightSide = x > X(tree);
          var lx = x + (rightSide ? 8 : -8);
          var mid = lx + (rightSide ? 13 : -13);
          var row = 0;
          while (
            placed.some(function (q) {
              return q.row === row && Math.abs(q.mid - mid) < 30;
            })
          )
            row++;
          placed.push({ mid: mid, row: row });
          var t = svg("text", {
            x: lx.toFixed(1),
            y: Y(n) - 3 - row * 14,
            "text-anchor": rightSide ? "start" : "end",
            class: "card" + (isRed(cards[n.card]) ? " red" : ""),
          });
          t.textContent = label(cards[n.card]);
          s.appendChild(t);
        });
      treeHost.textContent = "";
      treeHost.appendChild(s);
    }

    /* ---- the scoreboard ---- */
    var rows = [];
    var axis;
    (function buildBoard() {
      var head = el("div", "sw-row head");
      head.appendChild(el("span", "", "Card"));
      head.appendChild(el("span", "h-prior", "Network's instinct"));
      head.appendChild(el("span", "h-n", "Simulations"));
      head.appendChild(el("span", "h-q", "Average result"));
      board.appendChild(head);
      cards.forEach(function (c) {
        var row = el("div", "sw-row");
        row.appendChild(card(c));
        var pr = el("div", "sw-m prior");
        var pi = el("i");
        var ps = el("span");
        pr.appendChild(pi);
        pr.appendChild(ps);
        var nn = el("div", "sw-m n");
        var ni = el("i");
        var ns = el("span");
        nn.appendChild(ni);
        nn.appendChild(ns);
        var q = el("div", "sw-q");
        var track = el("div", "sw-track");
        var qb = el("b");
        q.appendChild(track);
        q.appendChild(qb);
        row.appendChild(pr);
        row.appendChild(nn);
        row.appendChild(q);
        board.appendChild(row);
        rows.push({ row: row, pi: pi, ps: ps, ni: ni, ns: ns, n: nn, q: q, track: track, qb: qb });
      });
      var foot = el("div", "sw-row");
      foot.appendChild(el("span"));
      foot.appendChild(el("span"));
      foot.appendChild(el("span"));
      var fq = el("div", "sw-q");
      axis = el("div", "sw-axis");
      fq.appendChild(axis);
      fq.appendChild(el("span"));
      foot.appendChild(fq);
      board.appendChild(foot);
      board.appendChild(el("div", "sw-key"));
    })();

    function drawBoard(upto, hit) {
      var committee = step === 5;
      // The committee view is drawn in advantage units: every value is
      // measured from the average of the six cards, which sits at zero.
      var lo = committee ? -0.08 : -0.2;
      var hi = committee ? 0.08 : 0.3;
      var ticks = committee ? [-0.05, 0, 0.05] : [-0.2, -0.1, 0, 0.1, 0.2, 0.3];
      var pos = function (v) {
        return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
      };
      var mean = [];
      var visits = [];
      for (var a = 0; a < A; a++) {
        if (committee) {
          mean.push((D.q[0][a] + D.q[1][a] + D.q[2][a]) / 3);
          visits.push(Math.round((D.n[0][a] + D.n[1][a] + D.n[2][a]) / 3));
        } else {
          visits.push(cn[a][upto]);
          mean.push(visits[a] ? cs[a][upto] / visits[a] : null);
        }
      }
      var centre = committee
        ? mean.reduce(function (x, y) {
            return x + y;
          }, 0) / A
        : 0;
      var maxN = committee || step === 4 ? N * 0.75 : Math.max(8, Math.max.apply(null, visits) * 1.15);
      board.querySelector(".h-q").textContent = committee ? "Advantage over the average card" : "Average result";
      board.querySelector(".h-n").textContent = committee ? "Simulations per search" : "Simulations";
      rows.forEach(function (r, a) {
        r.pi.style.width = Math.max(0.5, D.prior[a] * 78) + "%";
        r.ps.textContent = D.prior[a] < 0.005 ? "<1%" : Math.round(D.prior[a] * 100) + "%";
        var live = step >= 3;
        r.n.classList.toggle("sw-dim", !live);
        r.q.classList.toggle("sw-dim", !live);
        r.ni.style.width = live ? Math.min(78, (visits[a] / maxN) * 78) + "%" : "0";
        r.ns.textContent = live ? num(visits[a]) : "–";
        r.row.classList.toggle("hit", hit === a);
        r.track.textContent = "";
        var z = el("span", committee ? "avg" : "zero");
        z.style.left = pos(0) + "%";
        r.track.appendChild(z);
        if (!live || mean[a] == null) {
          r.qb.textContent = "–";
          return;
        }
        var pt = el("span", "pt");
        pt.style.left = pos(mean[a] - centre) + "%";
        r.track.appendChild(pt);
        if (committee) {
          for (var k = 0; k < 3; k++) {
            var rp = el("span", "pt rep");
            rp.style.left = pos(D.q[k][a] - centre) + "%";
            r.track.appendChild(rp);
          }
        }
        r.qb.textContent = signed(mean[a] - centre);
      });
      axis.textContent = "";
      if (axis.clientWidth < 150) ticks = committee ? [-0.05, 0, 0.05] : [-0.2, 0, 0.2];
      ticks.forEach(function (t) {
        var sp = el("span", "", t === 0 ? "0" : signed(t, committee ? 2 : 1));
        sp.style.left = pos(t) + "%";
        axis.appendChild(sp);
      });
      var key = board.querySelector(".sw-key");
      key.textContent = "";
      if (committee) {
        [
          ["rep", "each search"],
          ["mean", "average of the three"],
          ["avg", "average card"],
        ].forEach(function (kv) {
          var sp = el("span");
          sp.appendChild(el("i", kv[0]));
          sp.appendChild(document.createTextNode(kv[1]));
          key.appendChild(sp);
        });
      }
    }

    function setCount(n) {
      count = n;
      slider.value = n;
      out.textContent = num(n) + " of " + num(N);
      drawTree(n);
      drawBoard(n, -1);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      root.classList.remove("running");
      runBtn.textContent = count >= N ? "Run again" : "Run the search";
    }
    function run() {
      if (raf) return stop();
      var from = count >= N ? 1 : count;
      var t0 = null;
      var dur = 9000 * (1 - (from - 1) / N);
      root.classList.add("running");
      runBtn.textContent = "Pause";
      (function tick(t) {
        if (t0 == null) t0 = t;
        var f = Math.min(1, (t - t0) / dur);
        // start slowly so the first few simulations can be followed
        setCount(Math.round(from + (N - from) * f * f));
        if (f < 1) raf = requestAnimationFrame(tick);
        else stop();
      })(performance.now());
    }

    function render(flip) {
      stop();
      root.dataset.step = step;
      root.querySelectorAll(".sw-steps button").forEach(function (b) {
        if (+b.dataset.go === step) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
      root.querySelectorAll(".sw-say").forEach(function (p) {
        p.classList.toggle("on", +p.dataset.step === step);
      });
      root.querySelector("[data-prev]").disabled = step === 1;
      var next = root.querySelector("[data-next]");
      next.disabled = step === 5;
      where.textContent = step + " of 5";
      var d = D.detail[shown];
      root.querySelector(".sw-deal").hidden = step > 3;
      play.hidden = step !== 3;
      grow.hidden = step !== 4;
      if (step === 1) drawTable(null, false);
      if (step === 2) drawTable(D.samples[sample], flip);
      if (step === 3) {
        drawTable(d.world, flip);
        drawPlay(d);
        drawBoard(d.i + 1, cards.indexOf(d.path[0]));
      } else if (step === 4) setCount(count);
      else drawBoard(N, -1);
    }

    root.querySelectorAll("[data-go]").forEach(function (b) {
      b.addEventListener("click", function () {
        step = +b.dataset.go;
        render(true);
      });
    });
    root.querySelector("[data-prev]").addEventListener("click", function () {
      step = Math.max(1, step - 1);
      render(true);
    });
    root.querySelector("[data-next]").addEventListener("click", function () {
      step = Math.min(5, step + 1);
      render(true);
    });
    slider.max = N;
    slider.addEventListener("input", function () {
      stop();
      setCount(+slider.value);
      stop();
    });
    runBtn.addEventListener("click", run);
    if (window.ResizeObserver) {
      var lastW = 0;
      new ResizeObserver(function () {
        var w = treeHost.clientWidth;
        if (step === 4 && w && Math.abs(w - lastW) > 4) {
          lastW = w;
          drawTree(count);
        }
      }).observe(root);
    }

    root.classList.add("ready");
    render(false);
  }

  function boot() {
    document.querySelectorAll(".sw[data-src]").forEach(function (root) {
      fetch(root.dataset.src)
        .then(function (r) {
          return r.json();
        })
        .then(function (D) {
          init(root, D);
        })
        .catch(function () {
          /* the static table stays in place */
        });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
