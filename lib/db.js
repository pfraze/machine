var util    = require('./util');
var level   = require('level');
var sub     = require('level-sublevel');

var db = null;
var idCounter = null;

function setup(dbpath) {
	db = sub(level(dbpath, {valueEncoding: 'json'}));
	db.get('idCounter', function(err, v) {
		if (err) { idCounter = 0; }
		else { idCounter = v; }
		// :NOTE: we're not currently signalling that this is done before starting server
		// I figure it will be fast enough not to matter ~pfrazee
        // ^ famous last words ~pfrazee on a latter date
		console.log('DB Initialized');
	});
}

function allocateSerialID() {
	if (idCounter === null) {
		throw "Database setup() hasn't run yet";
	}
	var id = util.pad0(++idCounter, 16);
	db.put('idCounter', idCounter);
	return id;
}

function allocateSerialIDs(n) {
	if (n == 1) {
		return [allocateSerialID()];
	}
	if (idCounter === null) {
		throw "Database setup() hasn't run yet";
	}
	var ids = [];
	for (var i=0; i < n; i++) {
		ids.push(util.pad0(++idCounter, 16));
	}
	db.put('idCounter', idCounter);
	return ids;
}

module.exports = {
	setup: setup,
	getMainDB: function() { return db; },
	getMetaDB: function() { return db.sublevel('main\xffmeta'); }, // \xff is 255, it sorts last
	getDocsDB: function() { return db.sublevel('main\xffdocs'); }, // \xff is 255, it sorts last
	allocateSerialID: allocateSerialID,
	allocateSerialIDs: allocateSerialIDs
};