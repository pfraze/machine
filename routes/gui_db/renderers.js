var config = require('../../lib/config');
var util = require('../../lib/util');
var mosql = require('mongo-sql');
var winston = require('winston');
var uuid = require('node-uuid');

// Response Renderers
// ==================
function construct_links(req, rows) {
	return rows.map(function(row) {
		var meta = row.doc.meta || {};
		meta.id = row.doc.id;
		meta.rel = ('item guipedia.com/rel/db/row ' + (meta.rel || '')).trim();

		// Construct href
		var link = '<'+((meta.href) ? meta.href : ('/'+req.param('gui')+'/db/'+meta.id))+'{?cap,columns}>';

		// Add attributes
		for (var k in meta) {
			link += '; '+util.stripNonAlpha(k);
			if (meta[k] !== true) {
				link += '="'+util.makeSafe(meta[k])+'"';
			}
		}

		return link;
	}).join(', ');
}

module.exports.list_link = function(req, res, next) {
	// Build index links if retrieved
	var index_links = '';
	if (req.query.index == 'full' && res.locals.rows) {
		// Add selected links
		index_links = construct_links(req, res.locals.rows);
	} else {
		index_links = '</'+req.param('gui')+'/db?index=full>; rel="collection guipedia.com/rel/db"; title="Full Database Listing"';
	}
	index_links += ', </'+req.param('gui')+'/db/{id}{?cap,columns}>; rel="item guipedia.com/rel/db/row"; title="Database Row by ID"; hidden';

	// Set header
	res.setHeader('Link', [
		'</>; rel="via service guipedia.com/rel/self"; title="'+config.hostname+'"',
		'</'+req.param('gui')+'{?cap}>; rel="up guipedia.com/rel/program"; title="'+req.param('gui')+'"; id="'+req.param('gui')+'"',
		'</'+req.param('gui')+'/db{?cap,index,where,order,limit,offset,columns}>; rel="self collection guipedia.com/rel/db"; id="db"; title="'+req.param('gui')+' Database"',
		// '</'+req.param('gui')+'/db/cfg{?cap}>; rel="item guipedia.com/rel/db/cfg"; id="cfg"; title="Database Settings"', :TODO: ./cfg
		index_links
	].join(', '));
	next();
};

module.exports.row_link = function(req, res, next) {
	// Build index links if retrieved
	var self_link;
	if (res.locals.rows) {
		// Add self link
		var row = res.locals.rows[0];
		var orgmeta = row.doc.meta;
		row.doc.meta = (row.doc.meta) ? JSON.parse(JSON.stringify(row.doc.meta)) : {};
		row.doc.meta.rel = (row.doc.meta.rel || '') + ' self';
		self_link = construct_links(req, res.locals.rows);
		row.doc.meta = orgmeta;
	}

	// Set header
	res.setHeader('Link', [
		'</>; rel="via service guipedia.com/rel/self"; title="'+config.hostname+'"',
		'</'+req.param('gui')+'/db{?cap,index,where,order,limit,offset,columns}>; rel="up collection guipedia.com/rel/db"; id="db"; title="'+req.param('gui')+' Database"',
		self_link
	].join(', '));
	next();
};

function create_output_row(row) {
	var out = row.doc;
	out.id = out.id || row.id;
	out.created_at = row.created_at;
	out.edited_at = row.edited_at;
	return out;
}

module.exports.list = function(req, res, next) {
	return res.format({
		'application/json': function() {
			var row0 = res.locals.rows[0];
			res.json({ total: (row0) ? row0.total : 0, rows: res.locals.rows.map(create_output_row) });
		}
	});
};

module.exports.row = function(req, res, next) {
	return res.format({
		'application/json': function() {
			res.json({ row: create_output_row(res.locals.rows[0]) });
		}
	});
};