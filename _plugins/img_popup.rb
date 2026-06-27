# A small Liquid tag that renders a thumbnail which opens the full-size image
# in a lightbox overlay. Behaviour lives in assets/js/lightbox.js (vanilla JS);
# styling lives in css/imgpopup.css. No jQuery / jQuery UI required.
#
# Originally based on Brian M. Clapper's Octopress imgpopup plugin, but
# rewritten to be dependency-free.
#
# USAGE:
#   {% imgpopup /path/to/thumb.jpg /path/to/full.jpg Optional title %}
#
# The first argument is the thumbnail, the second the full-size image, and the
# optional remainder is used as the title/caption.

require "cgi"

module Jekyll
  class ImgPopup < Liquid::Tag
    def initialize(tag_name, markup, tokens)
      args = markup.strip.split(/\s+/, 3)
      unless [2, 3].include?(args.length)
        raise "Usage: {% imgpopup path_thumb path_full [title] %}"
      end

      @path_small = args[0]
      @path_full = args[1]
      @title = args[2]
      super
    end

    def render(context)
      small = CGI.escapeHTML(@path_small)
      full = CGI.escapeHTML(@path_full)
      title_attr = @title ? %( title="#{CGI.escapeHTML(@title)}") : ""
      alt = CGI.escapeHTML(@title || "Click to zoom")

      <<~HTML
        <a class="imgpopup" href="#{full}"#{title_attr}>
          <img src="#{small}" alt="#{alt}" loading="lazy" />
        </a>
      HTML
    end
  end
end

Liquid::Template.register_tag("imgpopup", Jekyll::ImgPopup)
