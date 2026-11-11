# frozen_string_literal: true

source "https://rubygems.org"

git_source(:github) { |repo_name| "https://github.com/#{repo_name}" }

gem "jekyll", "~> 4.3"

# webrick is no longer bundled with Ruby 3.0+, but is needed by `jekyll serve`
gem "webrick", "~> 1.8"

# Generates /sitemap.xml for search engines
gem "jekyll-sitemap", "~> 1.4"

# Server-side KaTeX rendering of $$...$$ math in kramdown (needs a JS
# runtime via ExecJS; Node is available locally and on the CI runner)
gem "kramdown-math-katex", "~> 1.0"
