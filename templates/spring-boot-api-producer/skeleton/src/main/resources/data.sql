DROP TABLE IF EXISTS employee;

CREATE TABLE employee (
  id INT IDENTITY NOT NULL  PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  age INT NOT NULL
);


INSERT INTO employee (name, age) VALUES ('Ben', 34 ),('Thomas', 60),('Joseph', 42)