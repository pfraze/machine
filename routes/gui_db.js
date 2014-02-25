var config = require('../lib/config');
var util = require('../lib/util');
var express = require('express');
var winston = require('winston');
var mosql = require('mongo-sql');
var uuid = require('node-uuid');

// Simple rate limiting algorithm
var usage = {
	MAX_INSERTS: 60,
	MAX_UPDATES: 200,
	MAX_DELETES: 60,
	inserts: {/* ip -> # this hour */},
	updates: {/* ip -> # this hour */},
	deletes: {/* ip -> # this hour */}
};
setInterval(function() {
	// Reset usage trackers
	usage.inserts = {};
	usage.updates = {};
	usage.deletes = {};
}, 1000*60*60); // once per hour

// Submodules
var render = require('./gui_db/renderers');
var select = require('./gui_db/select');
var row_insert = require('./gui_db/insert');
var selective_replace = require('./gui_db/replace');
var selective_delete = require('./gui_db/delete');

// GUI Database
// ============
module.exports = function(server) {
	// Add conditional column support
	var conditionBuilder = require('mongo-sql/lib/condition-builder');
	mosql.registerQueryType('conditional', '{conditional}');
	mosql.registerQueryHelper('conditional', function(val, values, query) {
		return conditionBuilder(val, query.__defaultTable, values);
	});

	// Add perms query support
	mosql.conditionalHelpers.add('$bitmatch', function(column, value, values, table) {
		// return "("+column+" & B'"+to_bitstring(value)+"')::integer != 0";
		return "("+column+" & "+value+")::integer != 0";
	});

	// Add DELETE USING support
	mosql.registerQueryHelper('using', function(table, values, query){
		return 'using "' + table + '"';
	});
	mosql.registerQueryType('delete-using', '{with} delete from {table} {using} {where} {returning}');

	// List Page
	// =========
	server.head('/:gui/db',
		select_if_index_requested,
		render.list_link,
		function(req, res) { res.send(204); }
	);
	server.get('/:gui/db',
		select,
		render.list_link,
		render.list
	);
	server.post('/:gui/db',
		ratelimit_inserts,
		validate_body,
		row_insert
	);
	server.put('/:gui/db',
		ratelimit_updates,
		validate_body,
		selective_replace
	);
	server.delete('/:gui/db',
		ratelimit_deletes,
		selective_delete
	);

	// Item Page
	// =========
	server.head('/:gui/db/:id',
		set_row_query,
		select,
		render.row_link,
		function(req, res) { res.send(204); }
	);
	server.get('/:gui/db/:id',
		set_row_query,
		select,
		send404_if_notfound,
		render.row_link,
		render.row
	);
	server.put('/:gui/db/:id',
		ratelimit_updates,
		validate_body,
		set_row_query,
		selective_replace
	);
	server.delete('/:gui/db/:id',
		ratelimit_deletes,
		set_row_query,
		selective_delete
	);

	// Helpers
	// =======
	function select_if_index_requested(req, res, next) {
		// If requested, do a select
		if (req.query.index == 'full') {
			return select(req, res, next);
		}
		next();
	}

	function set_row_query(req, res, next) {
		req.query.where = '{"id":"'+req.param('id')+'"}';
		next();
	}

	function send404_if_notfound(req, res, next) {
		if (!res.locals.rows[0]) { res.send(404); }
		else { next(); }
	}

	// Validation
	// ==========
	function validate_body(req, res, next) {
		// Content negotiation
		if (!req.is('json')) {
			return res.send(415);
		}

		// Validate body
		var body = req.body, errors = {};
		if (!body) { return res.send(422, {error: 'Body required.'}); }
		if (!body.row) { errors.row = 'Required.'; }
		else {
			// Validate perms
			if (body.row.perms) {
				var perms = body.row.perms;
				if (typeof perms != 'object') { errors.perms = 'Must be an object'; }
				else {
					var perms_errors = {};
					var valid_types = ['undefined', 'number'];
					if (valid_types.indexOf(typeof perms.select) === -1)  { perms_errors.select = 'Must be a number.'; }
					if (valid_types.indexOf(typeof perms.meta) === -1)    { perms_errors.meta = 'Must be a number.'; }
					if (valid_types.indexOf(typeof perms.update) === -1)  { perms_errors.update = 'Must be a number.'; }
					if (valid_types.indexOf(typeof perms.delete) === -1)  { perms_errors.delete = 'Must be a number.'; }
					if (Object.keys(errors).length) { errors.perms = perms_errors; }
				}
				body.perms = perms; // move out of row to keep available in the queries
			}

			// Strip standard columns
			delete body.row.id;
			delete body.row.created_at;
			delete body.row.edited_at;

			// Serialize
			body.row = JSON.stringify(body.row);
			if (body.row.length > 1048576 /* 1 MB */) { errors.row = 'Must be less than 1048576 bytes.'; }
		}
		if (Object.keys(errors).length) {
			return res.send(422, { errors: errors });
		}

		next();
	}

	// Rate Limiters
	// =============
	function ratelimit_inserts(req, res, next) {
		// Check how many times this IP has inserted
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		usage.inserts[ip] = usage.inserts[ip] || 0;
		if (usage.inserts[ip]+1 > usage.MAX_INSERTS) {
			return res.send(420, 'Sorry, we put an hourly limit of '+usage.MAX_INSERTS+' new database rows per IP, and you hit it.');
		}
		usage.inserts[ip]++;

		next();
	}
	function ratelimit_updates(req, res, next) {
		// Check how many times this IP has updated
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		usage.updates[ip] = usage.updates[ip] || 0;
		if (usage.updates[ip]+1 > usage.MAX_UPDATES) {
			return res.send(420, 'Sorry, we put an hourly limit of '+usage.MAX_UPDATES+' database updates per IP, and you hit it.');
		}
		usage.updates[ip]++;

		next();
	}
	function ratelimit_deletes(req, res, next) {
		// Check how many times this IP has deleted
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		usage.deletes[ip] = usage.deletes[ip] || 0;
		if (usage.deletes[ip]+1 > usage.MAX_DELETES) {
			return res.send(420, 'Sorry, we put an hourly limit of '+usage.MAX_DELETES+' database row deletions per IP, and you hit it.');
		}
		usage.deletes[ip]++;

		next();
	}
};