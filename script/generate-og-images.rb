#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Generates per-post Open Graph share images (1200x630) from the post title,
# the site wordmark, and the author's Gravatar. One PNG per post is written to
# images/og/<slug>.png, matching `page.slug` so _includes/header.html can pick
# it up automatically. Output is git-ignored and regenerated at build time.
#
# Usage:  ruby script/generate-og-images.rb
# Requires: a Chrome/Chromium binary (auto-detected, or set CHROME_BIN).

require 'yaml'
require 'json'
require 'cgi'
require 'fileutils'
require 'open-uri'
require 'openssl'

ROOT      = File.expand_path('..', __dir__)
POSTS_DIR = File.join(ROOT, '_posts')
OUT_DIR   = File.join(ROOT, 'images', 'og')
TMP_DIR   = File.join(ROOT, '.og-tmp')
AVATAR_FILE = File.join(TMP_DIR, 'avatar.jpg')

CONFIG = YAML.safe_load_file(File.join(ROOT, '_config.yml'))
GRAVATAR_USER = CONFIG.dig('author', 'gravatar') or
  abort 'Set author.gravatar (Gravatar username) in _config.yml'

CHROME = ENV['CHROME_BIN'] || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'
].find { |p| File.executable?(p) }
abort 'No Chrome/Chromium found (set CHROME_BIN)' unless CHROME

# ImageMagick 7 ships `magick`; 6 (still common on CI) ships `convert`. Run the
# lookup through a shell so `command -v` is the POSIX builtin — the multi-arg
# `system('command', ...)` form skips the shell and tries to exec a nonexistent
# `command` binary, which silently fails on Linux even when ImageMagick is present.
MAGICK = ['magick', 'convert'].find { |c| system("command -v #{c} > /dev/null 2>&1") }
abort 'No ImageMagick (magick/convert) found' unless MAGICK

FileUtils.mkdir_p(OUT_DIR)
FileUtils.mkdir_p(TMP_DIR)

# Resolve the avatar from the public Gravatar username (no email/hash in the
# repo), pulling fresh each run so a changed avatar flows through.
warn "Fetching Gravatar for @#{GRAVATAR_USER}..."
begin
  profile = JSON.parse(URI.open("https://gravatar.com/#{GRAVATAR_USER}.json").read)
  avatar_url = profile.dig('entry', 0, 'thumbnailUrl') or
    abort "No avatar found for Gravatar user '#{GRAVATAR_USER}'"
  URI.open("#{avatar_url}?s=512&d=mp") do |io|
    File.binwrite(AVATAR_FILE, io.read)
  end
rescue OpenURI::HTTPError, SocketError, OpenSSL::SSL::SSLError, JSON::ParserError => e
  abort "Could not fetch Gravatar: #{e.message}"
end

def file_uri(path) = "file://#{path}"

# Deterministic type scale: short titles read big and confident, long titles
# step down so they still wrap to at most ~3 balanced lines.
def title_size(title)
  n = title.length
  return 80 if n <= 24
  return 70 if n <= 32
  return 60 if n <= 42
  return 52 if n <= 52
  46
end

def card_html(title)
  <<~HTML
    <!DOCTYPE html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="#{file_uri(File.join(ROOT, 'css', 'MyFontsWebfontsKit.css'))}">
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { width:1200px; height:630px; }
      body {
        position:relative; display:flex; flex-direction:column;
        padding:80px 90px 76px;
        background:#f5f3ef url("#{file_uri(File.join(ROOT, 'images', 'body-background.jpg'))}") repeat;
        font-family:TransatStandard, -apple-system, sans-serif;
        color:#4a4a4a; overflow:hidden;
      }
      body::after {            /* grounding accent bar in the theme colour */
        content:""; position:absolute; left:0; right:0; bottom:0; height:14px;
        background:#2b2b2b;
      }
      /* Masthead */
      .masthead {
        display:flex; align-items:center; justify-content:space-between;
        padding-bottom:28px; border-bottom:1px solid #dcd8d2;
      }
      /* The wordmark SVG's ink is top-weighted in its viewBox (~41 of 140
         units are empty below it), so its optical centre sits ~9px above the
         image box centre. Nudge down to align with the bender.io baseline. */
      .wordmark { height:66px; width:auto; opacity:0.92; transform:translateY(9px); }
      .site-url { font-size:28px; letter-spacing:1px; color:#a59f97; }
      /* Hero title */
      .hero { flex:1; display:flex; flex-direction:column; justify-content:center; }
      .accent { width:54px; height:5px; background:#2b2b2b; margin-bottom:30px; opacity:0.85; }
      .title {
        width:100%;
        font-family:TransatBold, -apple-system, sans-serif;
        color:#34312d; line-height:1.12; letter-spacing:-0.5px;
        font-size:#{title_size(title)}px;
        display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;
        overflow:hidden;
      }
      /* Byline */
      .byline { display:flex; align-items:center; gap:24px; }
      .avatar {
        width:94px; height:94px; border-radius:50%; object-fit:cover;
        border:4px solid #fff; box-shadow:0 4px 14px rgba(0,0,0,0.16); flex:none;
      }
      .byline-text .name {
        font-family:TransatBold, sans-serif; font-size:34px; color:#3a3a3a; line-height:1.2;
      }
      .byline-text .tag { font-size:28px; color:#999; margin-top:2px; }
    </style></head>
    <body>
      <div class="masthead">
        <img class="wordmark" src="#{file_uri(File.join(ROOT, 'images', 'the-gradual-steep.svg'))}" alt="The Gradual Steep">
        <span class="site-url">bender.io</span>
      </div>
      <div class="hero">
        <div class="accent"></div>
        <h1 class="title">#{CGI.escapeHTML(title)}</h1>
      </div>
      <div class="byline">
        <img class="avatar" src="#{file_uri(AVATAR_FILE)}" alt="">
        <div class="byline-text">
          <div class="name">Andrew Bender</div>
          <div class="tag">personal technology blog</div>
        </div>
      </div>
    </body></html>
  HTML
end

# Collect posts: parse YAML front matter for the title; slug = filename minus date.
posts = Dir[File.join(POSTS_DIR, '*.{md,markdown,html}')].sort.map do |path|
  raw = File.read(path)
  fm  = raw[/\A---\s*\n(.*?)\n---\s*\n/m, 1]
  next nil unless fm
  data = YAML.safe_load(fm) || {}
  base = File.basename(path).sub(/\.\w+\z/, '')
  slug = base.sub(/\A\d{4}-\d{2}-\d{2}-/, '')
  { slug: slug, title: data['title'].to_s }
end.compact

puts "Generating #{posts.size} OG images -> images/og/"
posts.each do |post|
  html_path = File.join(TMP_DIR, "#{post[:slug]}.html")
  hi_path   = File.join(TMP_DIR, "#{post[:slug]}@2x.png")
  out_path  = File.join(OUT_DIR, "#{post[:slug]}.jpg")
  File.write(html_path, card_html(post[:title]))
  rendered = system(
    CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2',           # render 2x for crisp text
    '--virtual-time-budget=4000',
    '--window-size=1200,630',
    "--screenshot=#{hi_path}",
    file_uri(html_path),
    %i[out err] => File::NULL
  )
  # Downscale 2400x1260 -> the standard 1200x630 and encode as JPEG.
  scaled = rendered && system(
    MAGICK, hi_path, '-resize', '1200x630', '-strip',
    '-quality', '88', '-sampling-factor', '4:2:0', out_path,
    %i[out err] => File::NULL
  )
  puts(scaled ? "  ok  #{post[:slug]}" : "  FAIL #{post[:slug]}")
end

FileUtils.rm_rf(TMP_DIR)
