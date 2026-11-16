Well, my days of not taking you seriously are certainly coming to a middle.

# Building Locally

Generating the static files:
```
bundle exec jekyll build
```


```
bundle exec jekyll serve
```

This builds and serves the assets locally at http://localhost:4000.

# Math (KaTeX)

Math in posts is rendered to HTML at build time by KaTeX (via the
`kramdown-math-katex` gem), so building the site requires Node.js. The
KaTeX stylesheet is only loaded on pages that contain math.

kramdown uses `$$` for both inline and display math:

```
Euler's identity $$e^{i\pi} + 1 = 0$$ renders inline in a sentence.

$$
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
$$
```

- `$$...$$` inside a paragraph renders inline.
- `$$...$$` as its own paragraph (blank lines around it) renders as a
  centered display equation.
- A single `$` is plain text, and `$$` inside code is left alone.
- Write `\$$` for a literal `$$` in prose.

For a key formula, an equation box sets the equation large with its
terms defined in a smaller list underneath (two pairs per row on wide
screens, stacked on phones). Write a blockquote holding a display
equation and a kramdown definition list, then `{: .equation}`:

```
> $$
> \hat{a}_a = \gamma\, y_a + (1 - \gamma)\, m_a
> $$
>
> $$\gamma$$
> : the weight on the node's own search vs the advantage model
>
> $$y_a$$
> : the search label for action $$a$$
{: .equation}
```

- Each term is a line of its own, followed by a line starting with `: `
  for its definition, with a blank `>` line between pairs.
- Keep definitions out of the `$$` block itself: math never wraps, so
  text inside an equation forces a horizontal scrollbar.
- `data-title="..."` adds a small label, as with callouts.

# Quotes and Callouts

Pull quotes and callouts are Markdown blockquotes with a class added on
the line **immediately after** the quote (no blank line in between, or
the class is silently dropped):

```
> A plain quote from a source: grey rule on the left.

> A key sentence from the surrounding text, repeated large.
{: .pullquote}

> A pull quote that floats right; the next paragraph wraps around it.
{: .pullquote .right}

> A takeaway, definition, or aside in a tinted box.
{: .callout}

> The same box with a small uppercase label above it.
{: .callout data-title="The Oma Finke rule"}
```

- `.pullquote .right` goes *before* the paragraph that should wrap
  around it, and that paragraph should be long (8+ lines). It floats only
  at 1024px and wider; narrower screens show the full-width pull quote.
  Headings always start below a float.
- `data-title` is plain text (no Markdown, links, or math). Use single
  quotes around it if the title itself contains a double quote.
- Pull quotes and callouts can hold multiple paragraphs, lists, math, or
  code: continue the `>` on the blank lines between them.
- A Markdown table in a callout is styled as a compact label/number
  list with no header row. Rows after a `> |===` line are the footer:
  the first is set as a total, later ones as muted items apart from it.
- Use them sparingly: a few pull quotes per long post, a few screens
  apart, so each one still stands out.

For small, muted disclaimer text, add `{: .note}` after a regular
paragraph (not a quote):

```
This section is heavier on math and terminology.
{: .note}
```

# Footnotes

Use kramdown footnotes; names are only labels, and notes are numbered
in the order they're referenced:

```
The network usually escaped the always-pass trap eventually.[^watchdog]

[^watchdog]: The training script has an "entropy watchdog" for this.
```

- The reference renders as a true superscript numeral. Tapping it opens
  the note inline, right below that line; tapping again closes it
  (`assets/js/footnotes.js`, loaded only on posts with footnotes).
- The numbered list at the end of the post stays as the fallback for
  RSS readers and browsers without JavaScript.
- Notes can hold links, emphasis, and math; several paragraphs work too
  (indent the continuation lines by four spaces).

# Figures

Charts and embedded interactives are Liquid includes that produce a
`<figure class="fig">`. Their stylesheet (`css/figures.css`) and script
(`assets/js/figures.js`) load only on posts that contain one. Put each
include on a line of its own with a blank line before and after.

**Charts** are drawn in the browser from a data file in `_data/`:

```
{% include chart.html data=site.data.sheepshead.strength caption="..." %}
```

- The data file holds the chart's title, subtitle, series names and
  numbers, plus a table of the same numbers that is rendered into the page
  (so it reads without JavaScript). Edit wording there; edit the caption
  in the post.
- A file has one or more `panels`, each with a `type`: `stages` (one
  series through ordered stages, grouped into phases), `lines` (several
  series over a shared x axis, with a list of rows that highlight them),
  `dots` (rates with intervals, one row per agent) or `pool` (one
  measurement against the same one pooled, over a histogram of the
  individual measurements).
- Colours come from the `--fig-*` variables in `css/figures.css`.
- A panel's `sub` (subtitle) may use inline Markdown, such as `**bold**`.
- Add `expand=true` for a button that opens the figure over the window
  with its charts drawn larger (not shown on small screens).

**Embeds** show a poster image that is replaced by the live page in an
iframe as it nears the viewport; without JavaScript the poster links to
the page:

```
{% include embed.html src="/assets/sheepshead/network.html#preview"
   poster="/images/posts/sheepshead-network.jpg" title="..." caption="..." %}
```

The framed page asks to cover the window, and to return, by posting
`{type: "sheepshead-viz:expand", expanded: true|false}` to its parent.

**Sheepshead post.** `assets/sheepshead/network.html` is a copy of
`visualizations/ppo_architecture_3d.html` from the sheepsheadai
repository, and `_includes/sheepshead/training-program.html` is adapted
from its `visualizations/training_program.html`. Change them there and
copy them over; see that repository's `visualizations/README.md`.

`_includes/sheepshead/search-walkthrough.html` is the step-through replay
of one search. Its wording and style live in the include, its behaviour in
`assets/sheepshead/search-walkthrough.js`, and its data in
`assets/sheepshead/search-trace.json`, a copy of the file written by
`visualizations/dump_search_trace.py` in the sheepsheadai repository.

```liquid
{% include sheepshead/search-walkthrough.html caption="..." %}
```
