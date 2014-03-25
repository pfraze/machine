var level   = require('level');
var sub     = require('level-sublevel');
// var search  = require('level-search'); :TODO:

var db = null;
var idCounter = null;
var dirIDList = null;

function setup(dbpath) {
	db = sub(level(dbpath, {valueEncoding: 'json'}));
	db.get('idCounter', function(err, v) {
		if (err) { idCounter = 0; }
		else { idCounter = v; }
		db.get('dirIDList', function(err, v) {
			if (err) { dirIDList = []; }
			else { dirIDList = v; }

			// :NOTE: we're not currently signalling that this is done before starting server
			// I figure it will be fast enough not to matter ~pfrazee
			console.log('DB Initialized');
		});
	});
}

function allocateSerialID() {
	if (idCounter === null) {
		throw "Database setup() hasn't run yet";
	}
	var id = ++idCounter;
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
		ids.push(++idCounter);
	}
	db.put('idCounter', idCounter);
	return ids;
}

function allocateDirID(dirId) {
	if (dirIDList === null) {
		throw "Database setup() hasn't run yet";
	}
	dirIDList.push(dirId);
	db.put('dirIDList', dirIDList);
	return dirId;
}

function deallocateDirID(dirId) {
	if (dirIDList === null) {
		throw "Database setup() hasn't run yet";
	}
	var index = dirIDList.indexOf(dirId);
	if (index !== -1) {
		dirIDList.splice(index, 1);
		db.put('dirIDList', dirIDList);
	}
	return dirId;
}


module.exports = {
	setup: setup,
	getMainDB: function() { return db; },
	getDirMetaDB: function(dirId) { return db.sublevel(dirId+'\xffmeta'); }, // \xff is 255, it sorts last
	getDirDocsDB: function(dirId) { return db.sublevel(dirId+'\xffdocs'); }, // \xff is 255, it sorts last
	isDirectoryIDTaken: function(dirId) { return dirIDList.indexOf(dirId) !== -1; },
	getDir: function(dirId, cb) { return db.get(dirId, cb); },
	getDirList: function() { return dirIDList; },
	allocateSerialID: allocateSerialID,
	allocateSerialIDs: allocateSerialIDs,
	allocateDirID: allocateDirID,
	deallocateDirID: deallocateDirID
};