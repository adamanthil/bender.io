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
