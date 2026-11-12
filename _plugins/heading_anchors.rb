# Makes every heading in a post linkable: once the Markdown has been
# converted to HTML, the text of each <h2>-<h6> that has an id (kramdown
# gives every Markdown heading one) is wrapped in a link to that id. CSS
# shows a "#" marker on hover; clicking puts the section URL in the
# address bar, ready to copy.
module HeadingAnchors
  HEADING = %r{<h([2-6])(\s[^>]*\bid="([^"]+)"[^>]*)>(.*?)</h\1>}m

  def self.link(html)
    html.gsub(HEADING) do
      level, attrs, id, inner = Regexp.last_match.captures
      next Regexp.last_match[0] if inner.include?('<a ')

      %(<h#{level}#{attrs}><a class="heading-link" href="##{id}">#{inner}</a></h#{level}>)
    end
  end
end

Jekyll::Hooks.register :posts, :post_convert do |post|
  post.content = HeadingAnchors.link(post.content)
end
