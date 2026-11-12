# Liquid filter that builds a table of contents from rendered post HTML.
#
#   {{ content | toc_list }}
#
# Collects the headings that carry an id (kramdown adds one to every
# Markdown heading) and returns a nested <ol> of links to them. Only the
# top two heading levels used in the post are listed, so it works whether
# sections are written as ## / ### or #### / ##### (this blog's
# convention); the second level is nested under the heading before it.
# Returns "" if there are no headings.
module TocFilter
  HEADING = %r{<h([2-6])\s[^>]*\bid="([^"]+)"[^>]*>(.*?)</h\1>}m

  def toc_list(html)
    headings = html.to_s.scan(HEADING).map do |level, id, inner|
      [level.to_i, id, inner.gsub(/<[^>]+>/, '').strip]
    end
    return '' if headings.empty?

    top = headings.map(&:first).min
    headings.select! { |level, _, _| level <= top + 1 }

    out = +'<ol>'
    open_sub = false
    headings.each_with_index do |(level, id, text), i|
      sub = level > top && i.positive?
      if sub
        out << '<ol>' unless open_sub
        open_sub = true
      elsif open_sub
        out << '</ol></li>'
        open_sub = false
      elsif i.positive?
        out << '</li>'
      end
      out << %(<li><a href="##{id}">#{text}</a>)
      out << '</li>' if sub
    end
    out << (open_sub ? '</ol></li>' : '</li>')
    out << '</ol>'
  end
end

Liquid::Template.register_filter(TocFilter)
