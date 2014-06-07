var util    = require('./util');
var sqlite3 = require('sqlite3').verbose();

var db;
function setup(dbpath) {
	db = new sqlite3.Database(dbpath);
	db.run('CREATE TABLE IF NOT EXISTS links(_id INTEGER PRIMARY KEY, anchor TEXT, href TEXT, rel TEXT, type TEXT, attributes TEXT)');
}

module.exports = {
	setup: setup,
	get: function() { return db; }
};