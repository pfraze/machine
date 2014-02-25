var config = require('../../lib/config');
var util = require('../../lib/util');
var mosql = require('mongo-sql');
var winston = require('winston');
var uuid = require('node-uuid');

module.exports = function(req, res, next) {
	// Assemble columns
	var columns = [
		'id', 'doc', 'created_at', 'edited_at',
		{ expression: 'count(guis.id) OVER()', as: 'total' },
		{ type: 'conditional', conditional: { '"gui_jsons"."owner_cap"': (req.query.cap||0) }, as: 'is_owner' }
	];

	// Assemble where
	var where = {
		$and: [
			{ gui_id: req.param('gui') },
			{ $or: [
				{ select_perms: { $bitmatch: '10000000' } }, // groups :TODO:
				{ $and: [ // owner
					{ select_perms: { $bitmatch: '00000001' } },
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

	// Assemble order
	var order =  { id: 'asc' };
	if (req.query.order) {
		// Parse ?order
		try { order = JSON.parse(req.query.order); }
		catch (e) { return res.send(400, 'Parse error - ?order must be valid json.'); }

		// Sanitize
		if (!order) { order = { id: 'asc' }; }
		else if (typeof order == 'object') {
			var keys = Object.keys(order);
			if (keys.length !== 1) { return res.send(400, 'Request error - ?order can only have one attribute.'); }

			var order_column = keys[0];
			if (!util.isColumnSafe(order_column)) { return res.send(400, 'Request error - ?order column "'+order_column+'" is invalid.'); }

			if (order[order_column].toLowerCase() != 'asc' && order[order_column].toLowerCase() != 'desc') {
				return res.send(400, 'Request error - ?order direction "'+order[order_column]+'" is invalid.');
			}

			// Prefix the column
			var order_column2 = util.prefixNonstandardColumn(order_column);
			if (order_column != order_column2) {
				order[order_column2] = order[order_column];
				delete order[order_column];
			}
		} else {
			return res.send(400, 'Request error - ?order must be an object.');
		}
	}

	// Generate query
	var limit = +req.query.limit || 20;
	var q = mosql.sql({
		type: 'select',
		table: 'gui_jsons',
		columns: columns,
		joins: [{ type: 'inner', target: 'guis', on: 'guis.id = gui_jsons.gui_id' }],
		where: where,
		order: order,
		limit: (limit < 50) ? limit : 50,
		offset: +req.query.offset || 0,
	});

	// Run query
	req.pg.query(q.toString(), q.values, function(err, dbres) {
		if (err) {
			if (err.code == 42703 // Invalid column
				|| err.code == '22P02' // Invalid value
				|| err.code == 42601) { // Syntax error (usually means invalid column)
				return res.send(400, err.toString());
			}
			console.error(err);
			winston.error('Failed to load rows from DB', { error: err, inputs: [q.toString(), q.values], request: util.formatReqForLog(req) });
			return res.send(500);
		}
		res.locals.rows = dbres.rows;
		next();
	});
};