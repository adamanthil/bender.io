---
layout: post
title: Dynamic Pivot Tables with JSON and PostgreSQL
---
Pivoting data is a useful technique in reporting, allowing you to present data in columns that is stored as rows. Assuming you're using a relational database, you can construct such queries using the SQL Server [PIVOT operator](https://msdn.microsoft.com/en-us/library/ms177410.aspx) or Postgres [crosstab function](http://www.vertabelo.com/blog/technical-articles/creating-pivot-tables-in-postgresql-using-the-crosstab-function). However, these queries are limited in that all pivot columns must be explicitly defined in the query.

In the relational model, rows give you flexibility while columns are static. Ideally, we could use the data-driven flexibility of rows to define our pivot table dynamically. The static typing of SQL generally makes this challenging, but the [JSON datatype](https://www.postgresql.org/docs/current/static/datatype-json.html) and related functions available natively in PostgreSQL provide a compelling solution. We can use the strong declarative syntax of SQL to dynamically create JSON objects with properties derived from the rows in our database.

#### Example Schema
Consider the following schema for storing book sales:
{% highlight sql %}
CREATE TABLE book (
  book_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publication_year INTEGER NOT NULL,
  genre TEXT NOT NULL,
  price MONEY NOT NULL
);

CREATE TABLE customer (
  customer_id INTEGER PRIMARY KEY,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  state CHAR(2) NOT NULL
);

CREATE TABLE sale (
  sale_id INTEGER PRIMARY KEY,
  book_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  sale_date DATE NOT NULL
);
{% endhighlight %}

[Populate it](https://gist.github.com/Adamanthil/ddd75cfbcbbc333913f3261c03740c0c) with data for our queries, and we're ready to play around with pivots.

#### Crosstab Solution
First, let's look at the traditional `crosstab` method from PostgreSQL's [tablefunc](https://www.postgresql.org/docs/9.5/static/tablefunc.html) module.
{% highlight sql %}
CREATE EXTENSION IF NOT EXISTS tablefunc;

SELECT * FROM crosstab(
  $$
    SELECT
      date_part('year', sale_date) AS year,
      date_part('month', sale_date) AS month,
      COUNT(*)
    FROM sale
    GROUP BY sale_date
    ORDER BY 1
  $$,
  $$ SELECT m FROM generate_series(1,12) m $$
) AS (
  year int,
  "Jan" int,
  "Feb" int,
  "Mar" int,
  "Apr" int,
  "May" int,
  "Jun" int,
  "Jul" int,
  "Aug" int,
  "Sep" int,
  "Oct" int,
  "Nov" int,
  "Dec" int
);
{% endhighlight %}

This query will return data that looks something like this:
{% highlight sql %}
year | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec
-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----+-----
2010 |   6 |   2 |   5 |   3 |   4 |   7 |   6 |   5 |   2 |   6 |   2 |   1
2011 |   2 |   7 |   1 |   7 |   5 |   4 |   1 |   5 |   1 |  10 |   1 |   1
2012 |   4 |   4 |   7 |   4 |   5 |   3 |   3 |   4 |   2 |   6 |   3 |   3
2013 |   7 |   4 |   7 |   3 |   2 |   6 |   5 |   4 |   2 |   2 |   2 |   6
2014 |   4 |   3 |   6 |   3 |   1 |   4 |   3 |   4 |   4 |   7 |   5 |   3
2015 |   2 |   3 |   3 |   4 |   2 |   3 |   3 |   5 |   3 |   4 |   1 |   4
2016 |   5 |   5 |   6 |   8 |   2 |   5 |   4 |   4 |   6 |   1 |   3 |   6
{% endhighlight %}

The details of exactly what's going on here are not intuitive. Essentially the `crosstab` function is matching the 2nd column of the first query to the 1st column of the second and aggregating values into the appropriate 'year' and 'month' bins behind the scenes. It has the advantage of being fairly compact, but the logic is extremely opaque and it feels a bit like magic. What's possible in a `crosstab` query is limited to input queries formatted in a very specific way, and all output columns have to be expressly defined in advance. As the Postgres docs say: `The crosstab function is declared to return setof record, so the actual names and types of the output columns must be defined in the FROM clause of the calling SELECT statement`.

#### JSON Solution
Let's see if we can improve this. PostgreSQL added a native JSON datatype [back in version 9.2](https://wiki.postgresql.org/wiki/What's_new_in_PostgreSQL_9.2#JSON_datatype) and as of 9.5 has [extended the support](https://www.postgresql.org/docs/9.5/static/functions-json.html) with enhanced functions, operators, and better performance. Using this functionality provides a great solution that is a bit more readable and also completely dynamic:

{% highlight sql %}
WITH month_total AS (
  SELECT
    date_part('year', sale_date) AS year,
    to_char(sale_date, 'Mon') AS month,
    COUNT(*) AS total
  FROM sale
  GROUP BY date_part('year', sale_date), to_char(sale_date, 'Mon')
)

SELECT
  year,
  jsonb_object_agg(month,total) AS months
FROM month_total
GROUP BY year
ORDER BY year;
{% endhighlight %}

Let's unpack this a bit. First, our month_total [CTE](https://www.postgresql.org/docs/current/static/queries-with.html) looks very similar to the first query in the `crosstab` example. Here we are aggregating the total sales for each month. This CTE returns a set with one row per month (e.g. 2014 January, 2014 February, etc) and the total sales for that month. We then use the `jsonb_object_agg` function to dynamically build JSON objects for each year where the keys are months and the values are sales totals. The output should look like this:

{% highlight sql %}
year |                                  months
-----+--------------------------------------------------------------------------------
2014 | {"Jan": "132", "Feb": "109", "Mar": "118", "Apr": "126", "May": "131", "Jun": "111", ... }
2015 | {"Jan": "103", "Feb": "115", "Mar": "113", "Apr": "137", "May": "113", "Jun": "128", ... }
2012 | {"Jan": "110", "Feb": "109", "Mar": "115", "Apr": "109", "May": "126", "Jun": "96", ... }
2013 | {"Jan": "122", "Feb": "121", "Mar": "120", "Apr": "120", "May": "106", "Jun": "128", ... }
2011 | {"Jan": "128", "Feb": "121", "Mar": "109", "Apr": "116", "May": "120", "Jun": "104", ... }
2010 | {"Jan": "124", "Feb": "111", "Mar": "120", "Apr": "111", "May": "115", "Jun": "112", ... }
2016 | {"Jan": "118", "Feb": "122", "Mar": "116", "Apr": "111", "May": "112", "Jun": "111", ... }
{% endhighlight %}

Using a library like [node-postgres](https://github.com/brianc/node-postgres) to interface with PostgreSQL will return the data to our javascript code almost identically as the earlier table. In both cases, the results are returned as an array where each row is its own object with the column names as properties. Using PostgreSQL's native JSON functionality, however, allows us to write a more elegant query where the columns (or object properties) are determined dynamically at execution time.

#### Extending this Technique
Let's explore how simple this makes it to adjust which slice of our little OLAP cube we're viewing:
{% highlight sql %}
WITH state_total AS (
  SELECT
    c.state,
    b.genre,
    COUNT(*) AS total
  FROM sale s
  INNER JOIN book b USING(book_id)
  INNER JOIN customer c USING(customer_id)
  GROUP BY c.state, b.genre
)

SELECT
  state,
  jsonb_object_agg(genre, total) AS months
FROM state_total
GROUP BY state
ORDER BY state;
{% endhighlight %}

This query will return sales data grouped by state on the vertical axis and genre on the horizontal. From here you can imagine slicing the data any way you want with relatively minimal changes.

This same technique can also be used when properties of a particular entity are not explicitly defined as columns, but the data is stored as rows (imagine a key value store for item properties or a tagging system, etc). In these cases, the dynamic properties can define the fields returned in the output just as the reporting dimensions do in these examples.
