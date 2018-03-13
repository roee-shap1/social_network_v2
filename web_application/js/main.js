'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const express = require('express');
const Promise = require('bluebird');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo')(session);
const logger = require('morgan');
const Limiter = require('express-rate-limit');

const app = express();
const [HOST, PORT] = ['127.0.0.1', process.env.PORT || 3001];

const dbURI = 'mongodb://social:qwerty_123@ds211289.mlab.com:11289/sessions';
// const dbURI = 'mongodb://127.0.0.1:27017/sessions';

mongoose.connect(dbURI)
	.then(() => {console.log('You have been successfully connected to the database.')})
	.catch((err) => console.error(`connection error: ${err}`));
const db = mongoose.connection;
db.on('error', (err) => console.error(`connection error: ${err}`));

app.use(new Limiter({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 200, // limit each IP to 100 requests per windowMs
	delayMs: 2 * 1000, // disable delaying - full speed until the max limit is reached
	delayAfter: 5
}));

const accessLogStream = fs.createWriteStream(path.join(__dirname, '../localData/logStream.log'), {flags: 'a'});
app.use(logger('dev', {stream: accessLogStream}));
app.use(logger('dev'));

app.use(session({
	secret: crypto.randomBytes(32).toString('hex'),
	resave: true,
	saveUninitialized: false,
	store: new MongoStore({
		mongooseConnection: db
	})
}));

app.use((req, res, next) => {
	res.locals.currentUser = req.session.userId;
	next();
});

// parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// view engine setup
app.set('view engine', 'pug');
app.set('views', __dirname + '/../views');

app.use('/', require('./routes'));

app.use((req, res, next) => {
	let err = new Error('File Not Found');
	err.status = 404;
	next(err);
});

app.use((err, req, res, next) => {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

http
	.createServer(app)
	.listen(PORT, () => console.log(`Express is now running on http://${HOST}:${PORT}`))
	.on('error', function(err) {
		console.error(`connection error: ${err}`);
		this.close(() => {
			console.error(`The connection has been closed.`);
			process.exit(-2);
		});
	});
// https
// 	.createServer({
// 		key: fs.readFileSync(__dirname + '/serverOptions/privatekey.pem'),
// 		ca: fs.readFileSync(__dirname + '/serverOptions/certauthority.pem'),
// 		cert: fs.readFileSync(__dirname + '/serverOptions/certificate.pem')
// 	}, app)
// 	.listen(PORT+1, () => console.log(`Express is now running on https://${HOST}:${PORT+1}`))
// 	.on('error', function(err) {
// 		console.error(`connection error: ${err}`);
// 		this.close(() => {
// 			console.error(`The connection has been closed.`);
// 			process.exit(-2);
// 		});
// 	});