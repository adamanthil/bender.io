$(document).ready(function() {

  $.ajax({
    url: 'twitter-proxy/get-tweets.php?screen_name=adamanthil&count=2'
  }).success(function(data) {
    if(data && data.length) {
      var html = '<ul class="tweet_list">';
      for(var i = 0; i < data.length; i++) {
        html += '<li><div class="tweet">' + data[i].tweet_html + '</div><div class="tweet-time">' + data[i].time + '</div></li>';
      }
      html += '</ul>';
      $('#tweets').html(html);
    }
  });

 });
