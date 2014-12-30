# This plugin is a heavily modified version of Brian M. Clappers imgpopup plugin
# (http://brizzled.clapper.org/blog/2012/02/05/a-simple-octopress-image-popup-plugin/)
# It assumes the both full size and thumbnail images already exist and does not rely on the browser to resize

# This plugin uses Mini Magick to generate a scaled down, inline image (really,
# it just uses Mini Magick to calculate the appropriate size; the real image is
# scaled by the browser), and then generates a popup with the full-size image,
# using jQuery UI Dialog. The printer-friendly view just uses the full-size
# image.
#
# This plugin is useful when you have to display an image that's too wide for
# the blog.
#
# USAGE:
#
#     imgpopup /relative/path/to/small/image /relative/path/to/fullsize/image [title]
#
#     The image path is relative to "source". The third parameter is a title for the popup.
#
#
# PREREQUISITES:
#
# To use this plugin, you'll need:
#
# - erubis installed (via rubygems)
# - jQuery (in source/javascripts and in your head.html)
# - jQuery UI (in source/javascripts and in your head.html)
#
# EXAMPLE:
#
#     {% imgpopup /images/my-small-image.png /images/my-big-image.png Check this out %}
#
# Released under a standard BSD license.

require 'rubygems'
require 'erubis'

module Jekyll

  class ImgPopup < Liquid::Tag

    @@id = 0

    TEMPLATE_NAME = 'img_popup.html.erb'

    def initialize(tag_name, markup, tokens)
      args = markup.strip.split(/\s+/, 3)
      raise "Usage: imgpopup path_full path_small [title]" unless [2, 3].include? args.length

      @path_small = args[0]
      @path_full = args[1]

      template_file = Pathname.new(__FILE__).dirname + TEMPLATE_NAME
      @template = Erubis::Eruby.new(File.open(template_file).read)

      @title = args[2]
      super
    end

    def render(context)

      @@id += 1
      vars = {
        'id'      => @@id.to_s,
        'image_full'   => @path_full,
        'image_small'   => @path_small,
        'title'   => @title
      }

      @template.result(vars)
    end
  end
end

Liquid::Template.register_tag('imgpopup', Jekyll::ImgPopup)
