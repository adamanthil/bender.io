$(document).ready(function() {
    var primaryTitles = ['entrepreneur', 'computer scientist'];
    var titles = ['videographer', 'pseudo-designer', 'product manager', 
      'second bass', 'tea-drinker', 'violinist', 'ballroom dancer', 'software developer', 'movie-maker'];

    var firstTitle = $('#header .title.first');
    var secondTitle = $('#header .title.second');
    var activeTitle = 0;

    // Weight primary titles twice
    var weight = 2;
    for(i in primaryTitles) {
      var j = 0;
      while(j < weight) {
        titles.push(primaryTitles[i]);
        j++;
      }
    }

    var switchTitle = function() {
      var title = titles[Math.floor(Math.random() * titles.length)];
      if(activeTitle == 0) {
        secondTitle.html(title);
        firstTitle.fadeOut(600);
        secondTitle.fadeIn(600);
        activeTitle = 1;
      } else {
        firstTitle.html(title);
        secondTitle.fadeOut(600);
        firstTitle.fadeIn(600);
        activeTitle = 0;
      }
    };
    
    setInterval(switchTitle, 3200);
    
 });