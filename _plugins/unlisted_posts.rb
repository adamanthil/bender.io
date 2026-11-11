# Unlisted posts: a post with `unlisted: true` in its front matter is built
# and reachable at its URL, but is left out of every listing on the site
# (homepage, archive, feed, prev/next links) by the templates, and out of
# the sitemap by this generator.
#
# jekyll-sitemap skips any document with `sitemap: false`, and its own
# generator runs at :lowest priority, so setting the flag here first is
# enough to keep unlisted posts out of sitemap.xml.
module UnlistedPosts
  class Generator < Jekyll::Generator
    priority :highest

    def generate(site)
      site.posts.docs.each do |post|
        post.data['sitemap'] = false if post.data['unlisted']
      end
    end
  end
end
