'use strict'

const bluebird = require('bluebird');
global.Promise = bluebird;

const env = process.env.NODE_ENV || 'development';

const express = require('express');

const app = express();
module.exports = app;

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('pages/index', {
  });
});

const port = process.env.PORT  || 8081; // set our port
app.listen(port, err => {
	if (err) return console.error(`Ops ${err}`);
	console.log('Access on port ' + port);
});

