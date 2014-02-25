var config = require('../lib/config');
var util = require('../lib/util');
var templates = require('../lib/html');
var express = require('express');
var winston = require('winston');
var uuid = require('node-uuid');

// Worker wrapper code
var whitelist = [ // a list of global objects which are allowed in the worker
	'null', 'self', 'console', 'atob', 'btoa',
	'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'Proxy',
	'importScripts', 'navigator',
	'postMessage', 'addEventListener', 'removeEventListener',
	'onmessage', 'onerror', 'onclose',
	'dispatchEvent'
];
var blacklist = [ // a list of global objects which are not allowed in the worker, and which dont enumerate on `self` for some reason
	'XMLHttpRequest', 'WebSocket', 'EventSource',
	'Worker'
];
var whitelistAPIs_src = [ // nullifies all toplevel variables except those listed above in `whitelist`
	'(function() {',
		'var nulleds=[];',
		'var whitelist = ["'+whitelist.join('", "')+'"];',
		'for (var k in self) {',
			'if (whitelist.indexOf(k) === -1) {',
				'Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
				'nulleds.push(k);',
			'}',
		'}',
		'var blacklist = ["'+blacklist.join('", "')+'"];',
		'blacklist.forEach(function(k) {',
			'Object.defineProperty(self, k, { value: null, configurable: false, writable: false });',
			'nulleds.push(k);',
		'});',
		'if (typeof console != "undefined") { console.log("Nullified: "+nulleds.join(", ")); }',
	'})();\n'
].join('');
var importScriptsPatch_src = [ // patches importScripts() to allow relative paths
	'(function() {',
		'var orgImportScripts = importScripts;',
		'importScripts = function() {',
			'return orgImportScripts.apply(null, Array.prototype.map.call(arguments, function(v, i) {',
				'return (v.charAt(0) == \'/\') ? (\''+config.url+'\'+v) : v;',
			'}));',
		'};',
	'})();\n'
].join('');
var bootstrap_src = whitelistAPIs_src + importScriptsPatch_src;

// Simple rate limiting algorithm
var usage = {
	MAX_CREATES: 5,
	creates: {/* ip -> # this hour */}
};
setInterval(function() {
	// Reset usage tracker
	usage.creates = {};
}, 1000*60*60); // once per hour

// GUIs
// ====
module.exports = function(server) {

	// Front page
	// ==========
	server.head('/',
		frontpage_get_index,
		frontpage_link,
		function(req, res) { res.send(204); }
	);
	server.get('/',
		frontpage_link,
		frontpage_redirect
	);
	function frontpage_get_index(req, res, next) {
		if (req.query.index == 'full') {
			var q = 'SELECT * FROM guis WHERE is_public=\'t\' ORDER BY id DESC LIMIT 20';
			req.pg.query(q, function(err, dbres) {
				if (err) {
					console.error(err);
					winston.error('Failed to load GUIs from DB', { error: err, inputs: [q], request: util.formatReqForLog(req) });
					return res.send(500);
				}
				res.locals.guis = dbres.rows;
				next();
			});
		} else {
			next();
		}
	}
	function frontpage_link(req, res, next) {
		var index_links;
		if (req.query.index == 'full' && res.locals.guis) {
			index_links = res.locals.guis.map(function(gui) {
				return '</{id}>; rel="item guipedia.com/rel/program"; id="{id}"; title="{title}"'
					.replace(/\{id\}/g, gui.id)
					.replace('{title}', gui.title)
				;
			}).join(', ');
		} else {
			index_links = '</?index=full>; rel="service guipedia.com"; title="Full Program Listing"';
		}
		res.setHeader('Link', [
			'</{?index}>; rel="self via service guipedia.com"; title="'+config.hostname+'"',
			index_links,
			'</{id}{?cap}>; rel="item guipedia.com/rel/program"; title="Program by ID"; hidden',
			'</status>; rel="service"; id="status"; title="Host Status"; hidden'
		].join(', '));
		next();
	}
	function frontpage_redirect(req, res, next) {
		res.setHeader('Location', '/hello-world');
		res.send(302);
	}


	// New GUI page
	// ============
	server.get('/new',
		newguipage_get,
		guipage_render
	);
	server.put('/new',
		guipage_put_validate,
		newguipage_put_ratelimit,
		guipage_put_permcheck,
		newguipage_put_write
	);
	function newguipage_get(req, res, next) {
		// Attached fixed data
		res.locals.gui = { title: '', author: '', src: '' };
		res.locals.is_owner = true;
		res.locals.dne = true;
		next();
	}
	function newguipage_put_ratelimit(req, res, next) {
		// Check how many times this IP has created a GUI lately
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		usage.creates[ip] = usage.creates[ip] || 0;
		if (usage.creates[ip]+1 > usage.MAX_CREATES) {
			return res.send(420, 'Sorry, we put an hourly limit of '+usage.MAX_CREATES+' new GUIs per IP, and you hit it.');
		}
		usage.creates[ip]++;

		next();
	}
	function newguipage_put_write(req, res, next) {
		// Run PG query
		var edit_cap = uuid.v4();
		var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		var q = 'INSERT INTO guis (id, edit_cap, title, author, src, is_public, author_ipaddress) VALUES ($1,$2,$3,$4,$5,$6,$7)';
		var values = [req.body.id, edit_cap, req.body.title, req.body.author||null, req.body.src, req.body.is_public||false, ip];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				winston.error('Failed to insert GUI record into DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}
			res.set('Location', config.url + '/' + req.body.id + '?show=editor&cap=' + edit_cap);
			res.send(201, { edit_cap: edit_cap }); // created
		});
	}


	// GUI page
	// ========
	server.head('/:gui',
		guipage_link,
		function(req, res) { res.send(204); }
	);
	server.get('/:gui',
		guipage_get,
		guipage_link,
		guipage_render
	);
	server.put('/:gui',
		guipage_put_validate,
		guipage_put_permcheck,
		guipage_put_write
	);
	server.delete('/:gui', function(req, res, next) {
		res.send(501); // not implemented
	});
	function guipage_link(req, res, next) {
		res.setHeader('Link', [
			'</>; rel="up via service guipedia.com"; title="'+config.hostname+'"',
			'</'+req.param('gui')+'{?cap}>; rel="self item"; id="'+req.param('gui')+'"; title="'+req.param('gui')+'"',
			'</'+req.param('gui')+'/db{?cap}>; rel="collection guipedia.com/rel/db"; id="db"; title="'+req.param('gui')+' Database"',
		].join(', '));
		next();
	}
	function guipage_get(req, res, next) {
		// Accept override (because browsers seem to have given up on type negotiation)
		if (req.query.fmt) {
			req.headers.accept = req.query.fmt;
		}

		// Run PG query
		var q = 'SELECT * FROM guis WHERE id=$1';
		var values = [req.param('gui')];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				winston.error('Failed to get GUI record from DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}

			// 404?
			if (!dbres.rows[0]) {
				if (req.accepts('html')) {
					// Instead of a 404, give an interface prompting to create
					res.locals.gui = {
						id: req.param('gui'),
						title: req.param('gui'),
						author: '',
						src: '',
						created_at: false,
						is_public: false,
					};
					req.query.show = 'editor';
					res.locals.dne = true;
					res.locals.is_owner = true;
					res.locals.editor_msg = '404 - Available for a new program.';
					res.locals.editor_savebtn_label = 'Create';
					return next();
				}
				return res.send(404);
			}

			// Attach
			res.locals.gui = dbres.rows[0];
			res.locals.is_owner = (req.query.cap === res.locals.gui.edit_cap);
			next();
		});
	}
	function guipage_render(req, res, next) {
		// Wrapper code
		if (req.query.include_wrapper) {
			res.locals.gui.src = bootstrap_src+'(function(){'+res.locals.gui.src+'})();';
		}

		return res.format({
			'text/plain': function() { res.set('Content-Type', 'text/plain'); res.send(res.locals.gui.src); },
			'text/javascript': function() { res.set('Content-Type', 'text/javascript'); res.send(res.locals.gui.src); },
			'application/javascript': function() { res.set('Content-Type', 'application/javascript'); res.send(res.locals.gui.src); },
			'text/html': function() {
				// Render partials
				var anon_url = config.url + '/' + req.param('gui');
				var editcap_url = anon_url + '?cap=' + req.query.cap;
				var partials = {
					editorform: ''
				};
				var editorform_tmpl = (res.locals.is_owner) ? templates.guipart_editorform_owner : templates.guipart_editorform_anon;
				partials.editorform = editorform_tmpl
					.replace('{TITLE}', util.makeSafe(res.locals.gui.title||'', { noQuotes: true }))
					.replace('{AUTHOR}', util.makeSafe(res.locals.gui.author||'', { noQuotes: true }))
					.replace('{CREATED_AT}', (res.locals.gui.created_at) ? util.timeago(res.locals.gui.created_at) : '')
					.replace('{IS_PUBLIC_CHECKED}', (res.locals.gui.is_public) ? ' checked ' : '')
					.replace('{SAVEBTN_LABEL}', res.locals.editor_savebtn_label || (res.locals.is_owner?'Save':'Clone'))
					.replace('{MSG}', res.locals.editor_msg || '')
				;

				// Render page html
				var capabilities = (res.locals.is_owner) ? '[admin page] ' : '';
				var modemsg = (res.locals.is_owner && !res.locals.dne) ? ('<span class="text-danger">Admin - bookmark, but do not share the current URL!</span> <a href="'+anon_url+'" target="_top">Share This Link</a>') : '';
				var html = templates.guipage
					.replace(/\{ID\}/g, res.locals.gui.id)
					.replace(/\{MAIN_SRC\}/g, res.locals.gui.src)
					.replace(/\{PAGE_TITLE\}/g, util.makeSafe(res.locals.gui.title||res.locals.gui.id||'new') + ' ' + capabilities)
					.replace(/\{HEADER_TITLE\}/g, util.makeSafe(res.locals.gui.title||res.locals.gui.id||'new'))
					.replace(/\{AUTHOR\}/g, util.makeSafe(res.locals.gui.author||'anon', { noQuotes: true }))
					.replace(/\{POSTED_WHEN\}/g, (!res.locals.dne) ? util.timeago(new Date(res.locals.gui.created_at)) : '&ndash;')
					.replace(/\{HEADER_MODEMSG\}/g, modemsg)
					.replace(/\{EDITORFORM_PARTIAL\}/g, partials.editorform)
					.replace(/\{EDITOR_VIEWSTATE\}/g, (req.query.show == 'editor')  ? 'active' : '')
					.replace(/\{PAGESTATE_CLASSES\}/g, (res.locals.is_owner && !res.locals.dne) ? 'is_owner' : '')
				;

				// Respond
				res.send(html);
			},
			'application/json': function() { res.json({ gui: res.locals.gui, is_owner: res.locals.is_owner }); }
		});
	}
	function guipage_put_validate(req, res, next) {
		// Content negotiation
		if (!req.is('json')) {
			return res.send(415);
		}

		// Validate body
		var body = req.body, errors = {};
		if (!body) { return res.send(422, {errors:{form:'{src:} is required.'}}); }
		if (!body.src) { errors.src = 'Required.'; }
		else if (typeof body.src != 'string') { errors.src = 'Must be a string.'; }
		else if (body.src.length > 1048576 /* 1 MB */) { errors.src = 'Must be less than 1048576 characters.'; }
		if (body.title) {
			if (typeof body.title != 'string') { errors.title = 'Must be a string.'; }
			else if (!/^[-a-z0-9_]+$/i.test(body.title)) { errors.title = 'Must only contain letters, numbers, dashes and underscores. No spaces!'; }
			else if (body.title.length > 64) { errors.title = 'Must be 64 characters or less.'; }
			else if (body.title.length < 4) { errors.title = 'Must be at least 4 characters.'; }
			else if (body.title.toLowerCase() == 'new') { errors.title = 'Seat\'s taken.'; }
		}
		if (body.author) {
			if (typeof body.author != 'string') { errors.author = 'Must be a string.'; }
			else if (body.author.length > 64) { errors.author = 'Must be 64 characters or less.'; }
		}
		if (typeof body.is_public != 'undefined' && body.is_public !== '') {
			body.is_public = !!body.is_public;
		} else {
			delete body.is_public;
		}
		if (Object.keys(errors).length) {
			return res.send(422, { errors: errors });
		}

		// Fill in generated values
		if (!body.title) {
			body.title = uuid.v4();
		}
		body.id = body.title.toLowerCase();
		next();
	}
	function guipage_put_permcheck(req, res, next) {
		// Check system names
		if (req.body.id == 'new') {
			return res.send(403);
		}

		// :NOTE:
		// here we fetch DB state
		// we will reason about the state
		// and then make updates
		// the db can/will change in the interim
		// but I dont think it has to be atomic
		// we reason about:
		// - renaming: if a collision occurs, PG will abort due to the UNIQUE constraint
		// - perms: (within a small window before the update) it makes no difference when the perms are read

		// Run PG query
		var q = 'SELECT * FROM guis WHERE id=$1';
		var values = [req.body.id];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				winston.error('Failed to get GUI record from DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}

			// 404?
			if (!dbres.rows[0]) {
				// Not occupied...
				// If renaming, check perms on the original
				if (req.path != '/new' && req.param('gui') != req.body.id) {
					values = [req.param('gui')];
					// Fetch original
					return req.pg.query(q, values, function(err, dbres) {
						if (err) {
							winston.error('Failed to get GUI record from DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
							return res.send(500);
						}

						// 404?
						if (!dbres.rows[0]) {
							// An original was expected
							return res.send(404);
						}

						// Attach
						res.locals.gui = dbres.rows[0];
						res.locals.is_owner = (req.query.cap === res.locals.gui.edit_cap);

						// Correct caps?
						if (!res.locals.is_owner) {
							return res.send(403);
						}
						next();
					});
				} else {
					// New entry
					res.locals.gui = false;
					res.locals.is_owner = true;

					return next();
				}
			}

			// Attach
			res.locals.gui = dbres.rows[0];
			res.locals.is_owner = (req.query.cap === res.locals.gui.edit_cap);

			// Correct caps?
			if (!res.locals.is_owner) {
				return res.send(403);
			}
			next();
		});
	}
	function guipage_put_write(req, res, next) {
		// Run PG query
		var q = 'UPDATE guis SET id=$2, title=$3, author=$4, src=$5, is_public=$6 WHERE id=$1';
		var values = [
			req.param('gui'),
			req.body.id || res.locals.gui.id,
			req.body.title || res.locals.gui.title,
			req.body.author || res.locals.gui.author,
			req.body.src || res.locals.gui.src,
			(typeof req.body.is_public != 'undefined') ? req.body.is_public : res.locals.gui.is_public
		];
		req.pg.query(q, values, function(err, dbres) {
			if (err) {
				// :TODO: recognize id conflicts and send back a 409
				winston.error('Failed to update GUI record in DB', { error: err, inputs: [q, values], request: util.formatReqForLog(req) });
				return res.send(500);
			}

			if (req.param('gui') != req.body.id) {
				// Rename
				res.set('Location', config.url + '/' + req.body.id + '?show=editor&cap=' + req.query.cap);
				res.send(201); // created (probably should be redirect, but the browser interprets 303s...)
			} else {
				res.send(204);
			}
		});
	}
};