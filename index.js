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

function config_parser(json) {
	return new Promise((resolve, reject) => {

	    const xml_url = json.xml;

	    if (xml_url !== undefined && xml_url) {
	    	// load xml file with config (Prefeitura de Curitiba specific)
	      try {

	        request(xml_url, function (error, response, body) {

	          if (!error && response.statusCode == 200) {
	            var parseString = require('xml2js').parseString;
	            parseString(body, function (err, result) {

	              let base = {
	                "name" : result.dadosabertos.conjunto[0].titulo[0],
	                "description" : result.dadosabertos.conjunto[0].descricao[0],
	                "orgaoresponsavel" : result.dadosabertos.conjunto[0].orgaoresponsavel[0],
	                "responsavel" : result.dadosabertos.conjunto[0].responsavel[0],
	                "frequenciaatualizacao" : result.dadosabertos.conjunto[0].frequenciaatualizacao[0],
	                "espectrotemporal" : result.dadosabertos.conjunto[0].espectrotemporal[0],
	                "grupos" : result.dadosabertos.conjunto[0].grupos[0],
	                "campos" : result.dadosabertos.conjunto[0].campos[0],
	                "observacoes" : result.dadosabertos.conjunto[0].observacoes[0],
	                "url" : json.url
	              }

	              let tmp = xml_url.split('/');
	              tmp.pop();
	              const dados_path = tmp.join('/');

	              base.csv = _.map(result.dadosabertos.conjunto[0].dados[0].dado, (dado) => {

	                dado = dado['$'];

	                const name_split = dado.nome.split(' - ');
	                const type = name_split.pop();

	                if (type == "Base de Dados") {
	                  const base_name = name_split.shift();
	                  const table_name = (name_split.length > 0) ? name_split[0] : base_name;
	                  return {
	                    slug: table_name.toLowerCase().replace(/[^\w]+/g,''),
	                    name: dado.nome,
	                    url: dados_path + "/" + dado.arquivo /*,
	                    docs: ""*/
	                  };
	                }
	              }).filter( (value) => { return value !== undefined; });

	              base.refs = _.map(result.dadosabertos.conjunto[0].dados[0].dado, (dado) => {

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
	              return resolve(base);
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

function sync() {
	console.log("Starting sync at " + moment().format('LLLL'));
	fs.readdir(base_dir, (err, files) => {
		if (!err) {
			Promise.map(files, filename => {
				try {
					console.log('Parsing: ' + filename);
					let base = fs.readFileSync(base_dir + "/" + filename, "utf-8");
					config_parser(JSON.parse(base)).then((result) => {
						console.log(`Base ${result.name} OK`);
						bases[filename] = result;
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
	console.log(bases);
	var keys = Object.keys(bases);
	var values = keys.map(function(v) { return bases[v]; });

	res.render('pages/index', {
		bases: values
	});
});

const port = process.env.PORT  || 8081; // set our port
app.listen(port, err => {
	if (err) return console.error(`Ops ${err}`);
	console.log('Access on port ' + port);
});

