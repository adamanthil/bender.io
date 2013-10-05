---
layout: post
title: Embedding a Twitter feed using API v1.1
---
Back in June of this year, Twitter [discontinued their public REST API version 1.0](https://dev.twitter.com/blog/api-v1-retirement-final-dates), which made it impossible to anonymously pull twitter feeds directly into other websites. As of API version 1.1, all access to tweets must take place through authenticated applications over the OAuth protocol. This had the effect of breaking numerous sites that relied on a twitter feed for news updates and embedded contact information. Our [company website](http://simplecampushousing.com) was one such site affected by this change, and it rendered a [popular jQuery plugin](http://tweet.seaofclouds.com/) entirely useless. I still find quite a few sites around the web with embedded twitter feeds that are perpetually "loading" due to the old API closing down. The only simple solution provided by Twitter is to use their pre-styled [embedded timeline](https://dev.twitter.com/docs/embedded-timelines) widget, which is distinctively twitter branded. Fortunately, there is another way around this problem.

Twitter's API version 1.1 allows registered applications to query for tweets, and anyone can register an application. All you have to do is create an "application" for your website on Twitter's developer site ([dev.twitter.com](http://dev.twitter.com)), and set up a little boilerplate server-side code to handle the OAuth authentication and pull in the feed. You can then pass this information along to the frontend javascript or render it on the page directly.

I wrote a simple php script for this very purpose, which you can grab over on github:

[http://github.com/adamanthil/php-twitter-proxy](https://github.com/adamanthil/php-twitter-proxy)

This program takes a twitter handle and tweet count as query parameters, and returns the resulting posts in JSON. With some basic javascript you should be able to replace the jQuery "tweet" plugin, and have a custom styled twitter feed on your site. It makes use of the [codebird-php](https://github.com/jublonet/codebird-php) library to handle the OAuth details. Status updates from of a user's timeline are returned as plain text & html (with working links) along with the relative timestamp.

For example, the following query:

`get-tweets.php?screen_name=adamanthil&count=2`

Will return this:
{% highlight javascript %}
[{
  "tweet_text": "Tracking email opens with an image is just like the Halting Problem.
  	You might know the msg was opened, or you might never know either way",
  "tweet_html": "Tracking email opens with an image is just like the Halting Problem.
  	You might know the msg was opened, or you might never know either way",
  "time": "2 days ago"
},
{
  "tweet_text": "Incredible talk by @richhickey on simplifying software development.
  	Cant recommend it enough http://t.co/B9TMdNjau1 /via @rtfeldman",
  "tweet_html": "Incredible talk by @richhickey on simplifying software development.
  	Cant recommend it enough <a href='http://t.co/B9TMdNjau1' target='_blank'>
  	infoq.com/presentations/…</a> /via @rtfeldman",
  "time": "3 days ago"
}]
{% endhighlight %}

I'm using this code in my footer here, and we've got it running over at [simplecampushousing.com](http://simplecampushousing.com) as well. Feel free to fork the project and make any changes if you like. It's pretty basic right now, but it works dandy.
