'use strict'

const bluebird = require('bluebird');
global.Promise = bluebird;

const env = process.env.NODE_ENV || 'development';

const express = require('express');
const fs = require('fs');

const app = express();
module.exports = app;

app.set('view engine', 'ejs');

app.use('/bases', express.static('bases'));
app.use('/static', express.static('static'));

app.get('/', (req, res) => {

	const base_dir = __dirname + '/bases';
	fs.readdir(base_dir, (err, files) => {
		let bases = [];
		if (!err) {
			Promise.map(files, filename => {
				try {
					console.log('Parsing: ' + filename);
					let base = fs.readFileSync(base_dir + "/" + filename, "utf-8");
					bases.push(JSON.parse(base));
				} catch (err) {
					console.log(err);
				}
				return true;
			}).then(result => {
				res.render('pages/index', {
					bases: bases
				});
		    })
			.catch(err => {
			  console.error(`Error on ${req.path}, err: ${err}`);
			  res.status(500).end();
			});;
		} else {
		  console.error(`Error on ${req.path}, err: ${err}`);
		  res.status(500).end();
		}
	})

});

const port = process.env.PORT  || 8081; // set our port
app.listen(port, err => {
	if (err) return console.error(`Ops ${err}`);
	console.log('Access on port ' + port);
});

