var config = require('../../lib/config');
var util = require('../../lib/util');
var mosql = require('mongo-sql');
var winston = require('winston');
var uuid = require('node-uuid');

module.exports = function(req, res, next) {
	// Assemble where
	var where = {
		$and: [
			{ gui_id: req.param('gui') },
			{ 'guis.id': req.param('gui') },
			{ $or: [
				{ delete_perms: { $bitmatch: '10000000' } }, // groups :TODO:
				{ $and: [ // owner
					{ delete_perms: { $bitmatch: '00000001' } },
					{ owner_cap: req.query.cap }
				] },
				{ 'guis.edit_cap': req.query.cap } // admin
			] }
		]
	};
	if (req.query.where) {
		// Parse ?where
		var query_where;
		try { query_where = JSON.parse(req.query.where); }
		catch (e) { return res.send(400, 'Parse error - ?where must be valid json.'); }

		// Sanitize and add to the query
		try { where.$and.push(util.sanitizeMosql(query_where)); }
		catch (e) { return res.send(400, e.toString()); }
	}

	// Generate query
	var q = mosql.sql({
		type: 'select',
		table: 'updated_ids',
		columns: ['id'],
		with: {
			updated_ids: {
				type: 'delete-using',
				table: 'gui_jsons',
				using: 'guis',
				where: where,
				returning: ['id']
			}
		}
	});

	// Run PG query
	req.pg.query(q.toString(), q.values, function(err, dbres) {
		if (err) {
			if (err.code == 42703 // Invalid column
				|| err.code == '22P02' // Invalid value
				|| err.code == 42601) { // Syntax error (usually means invalid column)
				return res.send(400, err.toString());
			}
			console.error(err);
			winston.error('Failed to delete JSON record from DB', { error: err, inputs: [q.toString(), q.values], request: util.formatReqForLog(req) });
			return res.send(500);
		}
		res.send(200, { count: dbres.rows.length, ids: dbres.rows.map(function(row) { return row.id; }) }); // ok
	});
};