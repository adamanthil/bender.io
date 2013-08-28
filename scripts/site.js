shuffle = function(o) {
  for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
  return o;
};

range = function (start, end) {
    var array = [];
    for (var i = start; i <= end; i++)
        array.push(i);
    return array;
};


$(document).ready(function() {
    var titles = $('#header .titles');
    var activeTitle = $('#header .title.active');
    var titleList = titles.children('.title');
    var titleOrder = shuffle(range(0, titleList.length - 1));
    var activeIndex = 0;

    var switchTitle = function() {
      var titleIndex = titleOrder[activeIndex];
      var title = $(titleList[titleIndex]);

      activeTitle.fadeToggle(600);
      title.fadeToggle(600);
      activeTitle = title;

      activeIndex = activeIndex >= titleList.length - 1 ? 0 : activeIndex + 1;
    };

    setInterval(switchTitle, 3200);

 });
