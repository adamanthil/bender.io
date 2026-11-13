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
- Use them sparingly: a few pull quotes per long post, a few screens
  apart, so each one still stands out.

For small, muted disclaimer text, add `{: .note}` after a regular
paragraph (not a quote):

```
This section is heavier on math and terminology.
{: .note}
```
