---
layout: post
title: Returning Hierarchical Data in a Single SQL Query
---
I am a big proponent of using the right tool for the job. And as far as databases are concerned, I believe that in most cases a relational database is still the correct tool. However, one historical drawback of relational databases has been a difficulty in retrieving hierarchical data in a way that is easily compatible with most programming languages. Fortunately, support for modern data types such as JSON and advanced features including recursive common table expressions (CTEs) provide some excellent ways to tackle this problem.

My relational database of choice is [PostgreSQL](http://postgresql.org), which is open source and feature rich. It is fantastic, and you should definitely be using it. Postgres version 9.3 [was recently released](http://www.postgresql.org/about/news/1481/) with even better support for the JSON data type among its new features. Here are some methods I routinely use to retrieve structured, hierarchical data using raw SQL in a single query.

#### Nested Objects
When working with data in your backend code, you often need quick access to the relationships within your data model. Including nested JSON objects in your result set is a great way to accomplish this naturally. This approach works particularly well if you're interfacing with the database using node.js or another platform with fast JSON decoding.

Imagine the following hypothetical database of projects managed by employees:

{% highlight sql %}
CREATE TABLE employee (
  employee_id INT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE project (
  project_id INT PRIMARY KEY,
  employee_id INT NOT NULL REFERENCES employee(employee_id),
  name text NOT NULL
);
{% endhighlight %}

With some data:
{% highlight sql %}
 employee
--------------------------------
 employee_id |       name
-------------+------------------
           1 | Jon Snow
           2 | Thoren Smallwood
           3 | Samwell Tarley

 project
-----------------------------------------------------------
 project_id | employee_id |              name
------------+-------------+--------------------------------
          1 |           1 | Infiltrate Mance Rayder's Camp
          2 |           3 | Research the Wights
{% endhighlight %}

Suppose we wanted to return a list of projects and the employees responsible for them as an array of nested objects. PostgreSQL provides some useful [JSON functions](http://www.postgresql.org/docs/9.3/static/functions-json.html) for manipulating data, and we will use the `row_to_json` function to nest objects directly in the query results. `row_to_json` provides the ability to turn a database row into a json object, which is the key. Consider the following query:

{% highlight sql %}
SELECT
  p.*,
  row_to_json(e.*) as employee
FROM project p
INNER JOIN employee e USING(employee_id)
{% endhighlight %}

If we're using the [pg node.js library](https://github.com/brianc/node-postgres) to interface with Postgres, this query will return the following directly to our Javascript:
{% highlight javascript %}
[
  {
    "project_id": 1,
    "employee_id": 1,
    "name": "Infiltrate Mance Rayder's Camp",
    "employee": {
      "employee_id": 1,
      "name": "Jon Snow"
    }
  },
  {
    "project_id": 2,
    "employee_id": 3,
    "name": "Research the Wights",
    "employee": {
      "employee_id": 3,
      "name": "Samwell Tarley"
    }
  }
]
{% endhighlight %}
Exactly what we're looking for. It is very natural to work with this kind of data structure in Javascript or any other imperative language.

#### Augmenting Nested Objects
Sometimes it is necessary to return additional fields along with a given object that may not be directly included in the database table (due to normalization or other factors). For example, perhaps we are storing the date a project was assigned but would also like to return the age of that project in days. Let's add to our previous data model:

{% highlight sql %}
ALTER TABLE project ADD COLUMN dateassigned DATE;

UPDATE project SET dateassigned = '2013/09/10' WHERE project_id = 1;
UPDATE project SET dateassigned = '2013/09/16' WHERE project_id = 2;

INSERT INTO project (project_id, employee_id, name, dateassigned)
VALUES (3, 3, 'Send a raven to Kings Landing', '2013/09/21');
INSERT INTO project (project_id, employee_id, name, dateassigned)
VALUES (4, 2, 'Scout wildling movement', '2013/09/01');
{% endhighlight %}

This time we are going to reverse the desired results and query for a list of employees and their respective projects. But let's add the age of each project in days in addition to the date assigned. How can we accomplish this? One approach would be to use a subquery to create a new virtual table, and then use `row_to_json` to transform that virtual table row into JSON. We will do essentially the same thing, but use a [common table expression](http://www.postgresql.org/docs/9.3/static/queries-with.html) to redefine the project table with an additional "age" column. Also note that since employee->project is a one-to-many relationship, we are going to use the `json_agg` aggregate function to return a JSON array of objects instead of a single object as we did previously with `row_to_json`.

{% highlight sql %}
WITH project AS (
  SELECT
    p.*,
    date_part('day', age(now(), dateassigned::timestamp)) as age
  FROM project p
)

SELECT
  e.employee_id,
  e.name,
  json_agg(p.*) as projects
FROM employee e
INNER JOIN project p USING (employee_id)
WHERE employee_id = 3
GROUP BY e.employee_id, e.name
{% endhighlight %}

This query returns the following JSON to our Javascript backend. Note it is filtered to a single employee to reduce the size of the result set:

{% highlight javascript %}
[
  {
    "employee_id": 3,
    "name": "Samwell Tarley",
    "projects": [{
      "project_id": 2,
      "employee_id": 3,
      "name": "Research the Wights",
      "dateassigned": "2013-09-16",
      "age": 6
    },
    {
      "project_id": 3,
      "employee_id": 2,
      "name": "Send a raven to Kings Landing",
      "dateassigned": "2013-09-21",
      "age": 1
    }]
  }
]
{% endhighlight %}

#### Recursive Common Table Expressions
Your dataset may include more complicated relationships in the form of tree structured, hierarchical data as well. For example, tracking the management structure of our sample organization, where each "employee" reports to an immediate superior. This forms a tree of employees with the boss as the root node followed by subordinates. Probably the most common way to model such a tree is using the Adjacency List Model. In this representation, each employee record contains a reference to their immediate superior. If they are the head of the organization, this reference is null.

Let's modify our existing schema once more to reflect this:
{% highlight sql %}
ALTER TABLE employee ADD COLUMN superior_id INT REFERENCES employee(employee_id);

INSERT INTO employee (employee_id, name, superior_id)
VALUES (4, 'Jeor Mormont', null);
UPDATE employee SET superior_id = 4 WHERE employee_id <> 4;

INSERT INTO employee (employee_id, name, superior_id)
VALUES (5, 'Ghost', 1);
INSERT INTO employee (employee_id, name, superior_id)
VALUES (6, 'Iron Emmett', 1);
INSERT INTO employee (employee_id, name, superior_id)
VALUES (7, 'Hareth', 6);
{% endhighlight %}

We can now use a recursive [CTE](http://www.postgresql.org/docs/8.4/static/queries-with.html) (common table expression) to return this tree of data in a single query along with the depth of each node. Recursive CTEs allow you to reference the virtual table within its own definition. They take the form of two queries joined by a union, where one query acts as the terminating condition of the recursion and the other joins to it. Technically they are implemented iteratively in the underlying engine, but it can be useful to think recursively when composing the queries.
{% highlight sql %}
WITH RECURSIVE employeetree AS (
  SELECT e.*, 0 as depth
  FROM employee e
  WHERE e.employee_id = 1

  UNION ALL

  SELECT e.*, t.depth + 1 as depth
  FROM employee e
  INNER JOIN employeetree t
    ON t.employee_id = e.superior_id
)

SELECT * FROM employeetree
{% endhighlight %}
The above query will return all employees subordinate to Jon Snow, `employee_id = 1`, either directly or through the tree. In our small dataset, the result looks like this:
{% highlight sql %}
 employee_id |    name     | superior_id | depth
-------------+-------------+-------------+-------
           1 | Jon Snow    |           4 |     0
           5 | Ghost       |           1 |     1
           6 | Iron Emmett |           1 |     1
           7 | Hareth      |           6 |     2
{% endhighlight %}
This is fairly straightforward in our example, but it can be a powerful tool on larger trees especially when extended and combined with other techniques.

#### Combining Everything
We can use recursive CTEs in conjunction with the JSON functions to produce some really useful results. The following query will return the record for "Hareth", `employee_id = 7`, and a nested list of his superiors up to and including the root node. Each superior will be a complete employee object including their projects.
{% highlight sql %}
WITH RECURSIVE employeetree AS (
  WITH employeeprojects AS (
    SELECT
      p.employee_id,
      json_agg(p.*) as projects
    FROM (
      SELECT
        p.*,
        date_part('day', age(now(), dateassigned::timestamp)) as age
      FROM project p
    ) AS p
    GROUP BY p.employee_id
  )

  SELECT
    e.*,
    null::json as superior,
    COALESCE(ep.projects, '[]') as projects
  FROM employee e
  LEFT JOIN employeeprojects ep
    USING(employee_id)
  WHERE superior_id IS NULL

  UNION ALL

  SELECT
    e.*,
    row_to_json(sup.*) as superior,
    COALESCE(ep.projects, '[]') as projects
  FROM employee e
  INNER JOIN employeetree sup
    ON sup.employee_id = e.superior_id
  LEFT JOIN employeeprojects ep
    ON ep.employee_id = e.employee_id
)

SELECT *
FROM employeetree
WHERE employee_id = 7
{% endhighlight %}

This query returns the following nested objects:
{% highlight javascript %}
{
  "employee_id": 7,
  "name": "Hareth",
  "superior_id": 6,
  "superior": {
     "employee_id": 6,
     "name": "Iron Emmett",
     "superior_id": 1,
     "superior": {
        "employee_id": 1,
        "name": "Jon Snow",
        "superior_id": 4,
        "superior": {
           "employee_id": 4,
           "name": "Jeor Mormont",
           "superior_id": null,
           "superior": null,
           "projects": []
        },
        "projects":[
           {
              "project_id":1,
              "employee_id":1,
              "name":"Infiltrate Mance Rayder's Camp",
              "dateassigned":"2013-09-10",
              "age":12
           }
        ]
     },
     "projects":[]
  },
  "projects": []
}
{% endhighlight %}
This is really just the tip of the iceberg, but as you can see there is considerable power available natively from PostgreSQL. It is great to be able to work with data directly from a database query without having to reformat it, use a mapping layer, or run any additional queries.
