'use strict'

const bluebird = require('bluebird');
global.Promise = bluebird;

const env = process.env.NODE_ENV || 'development';

const express = require('express');
const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const moment = require('moment');

const app = express();
module.exports = app;

app.set('view engine', 'ejs');

app.use('/static', express.static('static'));

function config_parser(json,domain) {
	return new Promise((resolve, reject) => {

		// adding global fields
		json.portal = {
			"name": "CSV APIs de Curitiba",
			"url": process.env.DOMAIN || "http://opencuritiba.herokuapp.com"
		}

	    const xml_url = json.xml;

	    if (xml_url !== undefined && xml_url) {
	    	// load xml file with config (Prefeitura de Curitiba specific)
	      try {

	        request(xml_url, function (error, response, body) {

	          if (!error && response.statusCode == 200) {
	            var parseString = require('xml2js').parseString;
	            parseString(body, function (err, result) {

	              if (!json.hasOwnProperty('name')) json.name = result.dadosabertos.conjunto[0].titulo[0].trim();
	              if (!json.hasOwnProperty('description')) json.description = result.dadosabertos.conjunto[0].descricao[0].trim();

	              ["orgaoresponsavel","responsavel","frequenciaatualizacao","espectrotemporal","grupos","campos","observacoes"].forEach((key) => {
	              	json[key] = result.dadosabertos.conjunto[0][key][0].trim()
	              });

	              let tmp = xml_url.split('/');
	              tmp.pop();
	              const dados_path = tmp.join('/');

	              json.csv = _.map(result.dadosabertos.conjunto[0].dados[0].dado, (dado) => {

	                dado = dado['$'];

	                const name_split = dado.nome.split('-');
	                const type = name_split.pop().trim();
//	                const ext = 

	                if (type.toUpperCase() == "BASE DE DADOS".toUpperCase()) {
	                  const base_name = name_split.shift().trim();
	                  const table_name = (name_split.length > 0) ? name_split[0].trim() : base_name;
	                  return {
	                    slug: table_name.toLowerCase().replace(/[^\w]+/g,''),
	                    name: dado.nome.trim(),
	                    url: dados_path + "/" + dado.arquivo /*,
	                    docs: ""*/
	                  };
	                }
	              }).filter( (value) => { return value !== undefined; });

	              json.refs = _.map(result.dadosabertos.conjunto[0].dados[0].dado, (dado) => {

	                dado = dado['$'];

	                const name_split = dado.nome.split(' - ');
	                const type = name_split.pop();

	                if (type != "Base de Dados") {
	                  return {
	                    name: dado.nome,
	                    url: dados_path + "/" + dado.arquivo
	                  };
	                }
	              }).filter( (value) => { return value !== undefined; });

//	              let base_str = JSON.stringify(base, null, 2);
//	              console.log(`Base config from adaptor ${base.name}:\n${base_str}`);
	              return resolve(json);
	            });
	          } else {
	            console.log(error,response);
	            return reject(error);
	          }
	        });

	      } catch (err) {
	        console.log(err);
	        return reject(err);
	      }
	    } else {
	    	// standard json config file
	    	return resolve(json);
	    }
    })
}

const base_dir = __dirname + '/bases';
var bases = [];
var parsing = [];

function sync() {
	console.log("Starting sync at " + moment().format('LLLL'));
	fs.readdir(base_dir, (err, files) => {
		if (!err) {
			Promise.map(files, filename => {
				try {
					console.log('Parsing: ' + filename);
					parsing[filename] = true;
					let base = fs.readFileSync(base_dir + "/" + filename, "utf-8");
					config_parser(JSON.parse(base)).then((result) => {
						setTimeout(() => {
							console.log(`Base ${result.name} OK`);
							bases[filename] = result;
							delete parsing[filename];
						}, 10000);
					});
				} catch (err) {
					console.log(err);
				}
				return true;
			})
			.catch(err => {
			  console.error(`Error on ${req.path}, err: ${err}`);
			});;
		} else {
		  console.error(`Error on ${req.path}, err: ${err}`);
		}
	})
}

sync();

app.get('/sync', (req,res) => {
	sync();
	res.send("Sync started at" + moment().format('LLLL'));
});

app.get('/bases/:file', (req,res) => {
	if (bases.hasOwnProperty(req.params.file)) {
		res.setHeader('Content-Type', 'application/json');
	    res.send(JSON.stringify(bases[req.params.file], null, 3));
	} else {
		res.status(404).end();
	}
});

app.get('/', (req, res) => {
	var keys = Object.keys(bases);
	var values = keys.map(function(v) { return bases[v]; });
	var ready = (Object.keys(parsing).length == 0);
	console.log(Object.keys(parsing).length);
	console.log(ready);

	res.render('pages/index', {
		bases: values,
		ready: ready
	});
});

const port = process.env.PORT  || 8081; // set our port
app.listen(port, err => {
	if (err) return console.error(`Ops ${err}`);
	console.log('Access on port ' + port);
});

