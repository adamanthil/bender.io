$(document).ready(function() {
    var primaryTitles = ['entrepreneur', 'computer scientist'];
    var titles = ['videographer', 'pseudo-designer', 'product manager', 
      'second bass', 'tea-drinker', 'violinist', 'ballroom dancer', 'software developer', 'movie-maker'];

    var titles = $('#header .titles');
    var activeTitle = $('#header .title.active');

    var switchTitle = function() {
      var titleList = titles.children('.title');
      var titleIndex = Math.floor(Math.random() * titleList.length);
      var title = $(titleList[titleIndex]);
      
      activeTitle.fadeToggle(600);
      title.fadeToggle(600);
      activeTitle = title;
    };
    
    setInterval(switchTitle, 3200);
    
 });