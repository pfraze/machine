var config = require('../../lib/config');
var util = require('../../lib/util');
var mosql = require('mongo-sql');
var winston = require('winston');
var uuid = require('node-uuid');

module.exports = function(req, res, next) {
	// Assemble values
	var values = {
		gui_id: req.param('gui'),
		doc: req.body.row,
		author_ipaddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress
	};
	if (req.body.perms) {
		if (typeof req.body.perms.select != 'undefined') { values.select_perms = to_bitstring(req.body.perms.select); }
		if (typeof req.body.perms.update != 'undefined') { values.update_perms = to_bitstring(req.body.perms.update); }
		if (typeof req.body.perms.delete != 'undefined') { values.delete_perms = to_bitstring(req.body.perms.delete); }
	}
	// if (req.query.cap) { values.owner_cap = req.query.cap; } // :TODO: owner cap - not sure how this is coordinated yet
	values.owner_cap = uuid.v4(); // junk value to avoid accidental hits

	// :TODO: where and exists

	// Generate query
	var q = mosql.sql({
		type: 'insert',
		table: 'gui_jsons',
		values: values,
		returning: ['id']
	});

	// Run PG query
	req.pg.query(q.toString(), q.values, function(err, dbres) {
		if (err) {
			console.error(err);
			winston.error('Failed to insert JSON record into DB', { error: err, inputs: [q.toString(), q.values], request: util.formatReqForLog(req) });
			return res.send(500);
		}
		res.set('Location', config.url + '/' + req.param('gui') + '/db/' + dbres.rows[0].id);
		res.send(201, { id: dbres.rows[0].id }); // created
	});
};

function to_bitstring(number) {
	return ('00000000'+number.toString(2)).slice(-8);
}