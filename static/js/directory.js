;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var globals = require('./globals');

module.exports = {
	setup: function() {
		if (globals.session.user) {
			$('.profile-btn').text(globals.session.user).css('display', 'inline-block');
			$('.show-on-authed').show();
			$('.auth-btn').text('Logout').on('click', function() {
				// :TODO:
			});
		} else {
			$('.auth-btn').removeClass('btn-default').addClass('btn-success').on('click', function() {
				// :TODO:
			});
		}

		if (globals.session.isPageAdmin) {
			$('.show-on-admin').show();
		}
	}
};
},{"./globals":6}],2:[function(require,module,exports){
module.exports = {
	get: getExecution,
	runAction: runAction
};

// Executor
// ========
var _executions = {};

// EXPORTED
// execution lookup, validates against domain
function getExecution(domain, id) {
	var exec = _executions[id];
	if (exec && exec.domain === domain)
		return exec;
}

// EXPORTED
// create "action" execution
function runAction(url, meta, reqBody) {
	var execid = allocId();
	var urld = local.parseUri(url);
	var domain = urld.protocol + '://' + urld.authority;

	// allocate execution and gui space
	var exec = createExecution(execid, domain, meta);
	createActionGui(exec);

	// setup and dispatch request
	var req = new local.Request({
		method: 'POST',
		url: local.joinUri(url, execid),
		Accept: 'text/html'
	});
	exec.req = req;
	exec.res_ = local.dispatch(req);
	exec.res_.always(handleActionRes(exec.id));
	req.end(reqBody);

	return exec;
}

// produces callback to handle the response of an action
function handleActionRes(execid) {
	return function(res) {
		var exec = _executions[execid];
		if (!exec) { return console.error('Execution not in masterlist when handling response', execid, res); }
		// ^ this should never happen, if it does the flow is broken somehow

		// render response and destroy the execution
		var gui = res.body;
		if (!gui) {
			gui = '';
			if (exec.meta && exec.meta.title) gui += exec.meta.title+' ';
			if (res.status >= 200 && res.status < 400) gui += 'Finished';
			else gui += 'Failed';
		}
		exec.setGui(gui);
		exec.stop();
	};
}

// allocate unused id
function allocId() {
	var execid;
	do {
		execid = Math.round(Math.random()*1000000000); // :TODO: pretty weak PNRG, is that a problem?
	} while(execid in _executions);
	return execid;
}

// create execution base-structure, store in masterlist
function createExecution(execid, domain, meta) {
	_executions[execid] = {
		meta: meta,
		domain: domain,
		id: execid,
		el: null,

		stop: stopExecution,
		setGui: setExecutionGui
	};
	return _executions[execid];
}

// Execution-object Methods
// ========================

// closes request, removes self from masterlist
function stopExecution(fastRemove) {
	if (this.id in _executions) {
		this.req.close();
		delete _executions[this.id];

		if (fastRemove) {
			$(this.el).remove();
		} else {
			// remove gui in 3 seconds
			var el = this.el;
			setTimeout(function() { $(el).remove(); }, 3000);
		}
	}
}

// updates self's gui
function setExecutionGui(v) {
	var html = (v && typeof v == 'object') ? JSON.stringify(v) : (''+v);
	if (html && this.el)
		this.el.querySelector('.execgui-inner').innerHTML = html;
}

// Action-specific Methods
// =======================

// create gui-segment for an action to use
function createActionGui(execution) {
	var title = execution.domain;
	if (execution.meta && execution.meta.title) {
		title = execution.meta.title;
	}
	var $el = $(
		'<div id="execgui-'+execution.id+'" class="execgui actiongui">'+
			'<div class="actiongui-title"><small>'+title+' <a href="#" class="glyphicon glyphicon-remove"></a></small></div>'+
			'<div class="execgui-inner">Loading...</div>'+
		'</div>'
	);
	$('#action-guis').append($el);
	execution.el = $el[0];
	execution.el.addEventListener('request', onActionGuiRequest.bind(execution));
	execution.el.querySelector('.actiongui-title .glyphicon-remove').addEventListener('click', onActionGuiClose.bind(execution));
}

// handle request-event from an action's gui
function onActionGuiRequest(e) {
	var req = e.detail;
	var body = req.body; delete req.body;

	// audit request
	// :TODO: only to self

	// prep request
	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req = (req instanceof local.Request) ? req : (new local.Request(req));
	if (!local.isAbsUri(req.url)) {
		req.url = local.joinUri(this.domain, req.url);
	}

	// dispatch, render response
	var self = this;
	local.dispatch(req).always(function(res) {
		if (res.body) {
			self.setGui(res.body);
		}
	});
	req.end(body);
}

// handle titlebar close button click
function onActionGuiClose(e) {
	this.stop(true);
}
},{}],3:[function(require,module,exports){
// Environment Setup
// =================
local.logAllExceptions = true;
require('../pagent').setup();
require('../auth').setup();
var util = require('../util');
var sec = require('../security');

// ui
require('../widgets/addlink-panel').setup();
require('../widgets/directory-links-list').setup();
require('../widgets/directory-delete-btn').setup();

// plugin execution
local.addServer('worker-bridge', require('./worker-bridge')());
var exec = require('./executor');


// Actions
// =======

// :DEBUG:
$('#debug-stopwatch').on('click', function() {
	var execution = exec.runAction(
		'local://grimwire.com:8000(js/act/stopwatch.js)/',
		{title:'StopWatch'}
	);
	// setTimeout(function() { execution.stop(); }, 500);
	console.log(execution.req.url);
});



// Rendering
// =========

// Active renderers
require('./renderers');
var rendererQueries = {
	// :TODO: load from persistant storage
	'local://thing-renderer': { rel: 'schema.org/Thing' },
	'local://default-renderer': { rel: 'stdrel.com/media' }
};

// Do render
var mediaLinks = local.queryLinks(document, { rel: 'stdrel.com/media' });
renderFeed();

// :TEMP:
local.addServer('todo', function(req, res) { alert('Todo'); res.writeHead(204).end(); });

// Item meta-update handler
local.addServer('meta', function(req, res) {
	req.on('end', function() {
		var id = req.path.slice(1);
		if (!id || !mediaLinks[id]) { return res.writeHead(404).end(); }
		$('#meta-msg-'+id).text('');

		if (req.method == 'PUT')    { putItemMeta(req, res, id); }
		if (req.method == 'DELETE') { deleteItem(req, res, id); }
		else                        { res.writeHead(405).end(); }
	});
});
function putItemMeta(req, res, id) {
	var meta;
	try { meta = util.parseRawMeta(req.body.link); }
	catch (e) {
		$('#meta-msg-'+id).text(e.toString());
		return res.writeHead(422).end();
	}

	local.PUT(meta, { url: mediaLinks[id].href+'/meta' })
		.then(function(res2) {
			res.writeHead(204).end();

			// update locally
			meta.href = mediaLinks[id].href; // preserve, since href was stripped earlier
			mediaLinks[id] = meta;
			findRenderersForLinks([mediaLinks[id]]);

			// redraw
			$('#slot-'+id+' .edit-meta').popover('toggle');
			$('#meta-msg-'+id).text('Updated');
			renderItem(id);
			local.util.nextTick(function() {
				$('#slot-'+id+' .edit-meta').popover({
					html: true,
					content: renderItemEditmeta,
					container: 'body',
					placement: 'bottom'
				});
			});
		})
		.fail(function(res2) {
			switch (res2.status) {
				case 422:
					$('#meta-msg-'+id).text(res2.body.error);
					return res.writeHead(422).end();
				case 401:
				case 403:
					$('#meta-msg-'+id).text('You\'re not authorized to edit this directory.');
					return res.writeHead(403).end();
			}
			res.writeHead(502).end();
		});
}
function deleteItem(req, res, id) {
	if (!confirm('Delete this item?')) return;

	local.DELETE(mediaLinks[id].href)
		.then(function(res2) {
			res.writeHead(204).end();

			// update locally
			delete mediaLinks[id];

			// redraw
			$('#slot-'+id+' .edit-meta').popover('toggle');
			$('#slot-'+id).remove();
		})
		.fail(function(res2) {
			switch (res2.status) {
				case 401:
				case 403:
					$('#meta-msg-'+id).text('You\'re not authorized to edit this directory.');
					return res.writeHead(403).end();
			}
			res.writeHead(502).end();
		});
}

function findRenderersForLinks(links) {
	for (var url in rendererQueries) {
		var matches = local.queryLinks(links, rendererQueries[url]);
		for (var i=0; i < matches.length; i++) {
			if (!matches[i].__renderers) {
				Object.defineProperty(matches[i], '__renderers', { enumerable: false, value: [] });
			}
			matches[i].__renderers.push(url);
		}
	}
}

function renderFeed() {
	// Collect renderers for each link
	findRenderersForLinks(mediaLinks);

	// Render the medias
	var renderPromises = [];
	for (var i = 0; i < mediaLinks.length; i++) {
		renderPromises.push(renderItem(i));
	}

	local.promise.bundle(renderPromises).then(function() {
		$('.edit-meta').popover({
			html: true,
			content: renderItemEditmeta,
			container: 'body',
			placement: 'bottom'
		});
	});
}

function renderItem(i) {
	var link = mediaLinks[i];
	var url = link.__renderers[0] || 'local://default-renderer';
	var json = $('#slot-'+i).data('doc') || null;
	var req = { url: url, query: link, Accept: 'text/html' };
	if (json) req.Content_Type = 'application/json';

	function renderTemplateResponse(link, i) {
		return function(res) {
			var html = sec.sanitizeRenderedItem(''+res.body);
			$('#slot-'+i).html([
				'<div class="directory-item-header">'+renderItemHeader(link)+'</div>',
				((res.body) ? ('<div class="directory-item-content">'+html+'</div>') : '')
			].join(''));
		};
	}
	function handleTemplateFailure(link, i) {
		return function(res) {
			console.error('Failed to render item', i, link, res);
			$('#slot-'+i).html('Failed to render :( '+util.escapeHTML(res.status+' '+res.reason));
		};
	}
	return local.POST(json, req)
		.then(
			renderTemplateResponse(link, i),
			handleTemplateFailure(link, i)
		);
}

function renderItemHeader(link) {
	var title = util.escapeHTML(link.title || link.id || 'Untitled');
	if (link.type) { title += ' ('+util.escapeHTML(link.type)+')'; }

	return [
		'<a target="_top" href="'+util.escapeHTML(link.href)+'">'+title+'</a> &middot; ',
		'<a target="_top" class="edit-meta" href="javascript:void(0)">meta</a>'
	].join('');
}

function renderItemEditmeta() {
	var $slot = $(this).parents('.directory-item-slot');
	var id = $slot.attr('id').slice(5);
	return [
		'<form action="local://meta/'+id+'" method="PUT">',
			'<textarea name="link" rows="10">'+util.escapeHTML(util.serializeRawMeta(mediaLinks[id]))+'</textarea>',
			'<input type="submit" class="btn btn-primary" value="Update">',
			' &nbsp; <span id="meta-msg-'+id+'"></span>',
			'<input type="submit" class="pull-right btn btn-default" value="Delete" formmethod="DELETE">',
		'</form>'
	].join('');
}
},{"../auth":1,"../pagent":8,"../security":9,"../util":10,"../widgets/addlink-panel":11,"../widgets/directory-delete-btn":12,"../widgets/directory-links-list":13,"./executor":2,"./renderers":4,"./worker-bridge":5}],4:[function(require,module,exports){
var util = require('../util');

// Thing renderer
local.addServer('thing-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		var desc = [];
		var url = (req.body.url) ? util.escapeHTML(req.body.url) : '#';
		if (req.body.description) { desc.push(util.escapeHTML(req.body.description)); }
		if (req.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
		var html = [
			'<div class="media">',
				((req.body.image) ? '<a target="_top" href="'+url+'" class="pull-left"><img class="media-object" src="'+util.escapeHTML(req.body.image)+'" alt="'+util.escapeHTML(req.body.name)+'" height="64"></a>' : ''),
				'<div class="media-body">',
					'<h4 class="media-heading">'+util.escapeHTML(req.body.name)+'</h4>',
					((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
				'</div>',
			'</div>'
		].join('');
		res.end(html);
	});
});

// Default renderer
local.addServer('default-renderer', function(req, res) {
	req.on('end', function() {
		res.writeHead(200, 'OK', {'Content-Type': 'text/html'});
		res.end('<p><a target="_top" href="'+util.escapeHTML(req.query.href)+'">Link</a></p>');
		/*var html = JSON.stringify(req.query);
		if (req.body) {
			html += '<br><strong>'+JSON.stringify(req.body)+'</strong>';
		}
		res.end(html);*/
	});
});
},{"../util":10}],5:[function(require,module,exports){
var exec = require('./executor');

module.exports = function(config) {
	// toplevel
	function root(req, res, worker) {
		var links = [];
		links.push({ href: '/', rel: 'self service via', title: 'Host Page' });
		// :TODO: add hosts

		// Respond
		res.setHeader('Link', links);
		res.writeHead(204).end();
	}

	// gui service
	function gui(req, res, worker) {
		var execid = req.path.slice(5);

		// fetch worker's execution
		var execution = exec.get(worker.getUrl(), execid);
		if (!execution) {
			return res.writeHead(404, 'id not attached to worker').end();
		}

		if (req.method == 'PUT') {
			req.on('end', function() {
				execution.setGui(req.body);
				res.writeHead(204).end();
			});
		} else {
			res.writeHead(405, 'only accepts PUT').end();
		}
	}

	// server starting-point
	return function(req, res, worker) {
		if (req.path == '/') {
			root(req, res, worker);
		} else if(req.path.indexOf('/gui') === 0) {
			gui(req, res, worker);
		} else {
			res.writeHead(404).end();
		}
	};
};
},{"./executor":2}],6:[function(require,module,exports){
var hostUA = local.agent(window.location.protocol + '//' + window.location.host);
window.globals = module.exports = {
	session: {
		user: $('body').data('user') || null,
		isPageAdmin: $('body').data('user-is-admin') == '1'
	},
	hostUA: hostUA,
	pageUA: local.agent(window.location.toString()),
	authUA: hostUA.follow({ rel: 'service', id: 'auth' }),
	meUA: hostUA.follow({ rel: 'item', id: '.me' }),
	fetchProxyUA: hostUA.follow({ rel: 'service', id: '.fetch' }),
};
},{}],7:[function(require,module,exports){
//
// mimetype.js - A catalog object of mime types based on file extensions
//
// @author: R. S. Doiel, <rsdoiel@gmail.com>
// copyright (c) 2012 all rights reserved
//
// Released under New the BSD License.
// See: http://opensource.org/licenses/bsd-license.php
//

(function (self) {
	var path;

	// If we're NodeJS I can use the path module.
	// If I'm MongoDB shell, not available.
	if (require !== undefined) {
		path = require('path');
	} else {
		path = {
			extname: function (filename) {
				var start = filename.lastIndexOf(".");
				if (start > 0) {
					var end = filename.indexOf('?');
					if (end == -1) end = filename.indexOf('#');
					if (end == -1) end = undefined;
					return filename.slice(start, end);
				}
			}
		};
	}

	if (exports === undefined) {
		exports = {};
	}

	MimeType = {
		charset: 'UTF-8',
		catalog: {},
		lookup: function (fname, include_charset, default_mime_type) {
			var ext, charset = this.charset;

			if (include_charset === undefined) {
				include_charset = false;
			}

			if (typeof include_charset === "string") {
				charset = include_charset;
				include_charset = true;
			}

			if (path.extname !== undefined) {
				ext = path.extname(fname).toLowerCase();
			} else if (fname.lastIndexOf('.') > 0) {
				ext = fname.substr(fname.lastIndexOf('.')).toLowerCase();
			} else {
				ext = fname;
			}

			// Handle the special cases where their is no extension
			// e..g README, manifest, LICENSE, TODO
			if (ext == "") {
				ext = fname;
			}

			if (this.catalog[ext] !== undefined) {
				if (include_charset === true &&
					this.catalog[ext].indexOf('text/') === 0 &&
					this.catalog[ext].indexOf('charset') < 0) {
					return this.catalog[ext] + '; charset=' + charset;
				} else {
					return this.catalog[ext];
				}
			} else if (default_mime_type !== undefined) {
				if (include_charset === true &&
					default_mime_type.indexOf('text/') === 0) {
					return default_mime_type + '; charset=' + charset;
				}
				return default_mime_type;
			}
			return false;
		},
		set: function (exts, mime_type_string) {
			var result = true, self = this;
			if (exts.indexOf(',')) {
				exts.split(',').forEach(function (ext) {
					ext = ext.trim();
					self.catalog[ext] = mime_type_string;
					if (self.catalog[ext] !== mime_type_string) {
						result = false;
					}
				});
			} else {
				result = (self.catalog[exts] === mime_type_string);
			}
			return result;
		},
		del: function (ext) {
			delete this.catalog[ext];
			return (this.catalog[ext] === undefined);
		},
		forEach: function (callback) {
			var self = this, ext;
			// Mongo 2.2. Shell doesn't support Object.keys()
			for (ext in self.catalog) {
				if (self.catalog.hasOwnProperty(ext)) {
					callback(ext, self.catalog[ext]);
				}
			}
			return self.catalog;
		}
	};

	// From Apache project's mime type list.
	MimeType.set(".ez", "application/andrew-inset");
	MimeType.set(".aw", "application/applixware");
	MimeType.set(".atom", "application/atom+xml");
	MimeType.set(".atomcat", "application/atomcat+xml");
	MimeType.set(".atomsvc", "application/atomsvc+xml");
	MimeType.set(".ccxml", "application/ccxml+xml");
	MimeType.set(".cu", "application/cu-seeme");
	MimeType.set(".davmount", "application/davmount+xml");
	MimeType.set(".ecma", "application/ecmascript");
	MimeType.set(".emma", "application/emma+xml");
	MimeType.set(".epub", "application/epub+zip");
	MimeType.set(".pfr", "application/font-tdpfr");
	MimeType.set(".stk", "application/hyperstudio");
	MimeType.set(".jar", "application/java-archive");
	MimeType.set(".ser", "application/java-serialized-object");
	MimeType.set(".class", "application/java-vm");
	MimeType.set(".js", "application/javascript");
	MimeType.set(".json", "application/json");
	MimeType.set(".lostxml", "application/lost+xml");
	MimeType.set(".hqx", "application/mac-binhex40");
	MimeType.set(".cpt", "application/mac-compactpro");
	MimeType.set(".mrc", "application/marc");
	MimeType.set(".ma,.nb,.mb", "application/mathematica");
	MimeType.set(".mathml", "application/mathml+xml");
	MimeType.set(".mbox", "application/mbox");
	MimeType.set(".mscml", "application/mediaservercontrol+xml");
	MimeType.set(".mp4s", "application/mp4");
	MimeType.set(".doc,.dot", "application/msword");
	MimeType.set(".mxf", "application/mxf");
	MimeType.set(".oda", "application/oda");
	MimeType.set(".opf", "application/oebps-package+xml");
	MimeType.set(".ogx", "application/ogg");
	MimeType.set(".onetoc,.onetoc2,.onetmp,.onepkg", "application/onenote");
	MimeType.set(".xer", "application/patch-ops-error+xml");
	MimeType.set(".pdf", "application/pdf");
	MimeType.set(".pgp", "application/pgp-encrypted");
	MimeType.set(".asc,.sig", "application/pgp-signature");
	MimeType.set(".prf", "application/pics-rules");
	MimeType.set(".p10", "application/pkcs10");
	MimeType.set(".p7m,.p7c", "application/pkcs7-mime");
	MimeType.set(".p7s", "application/pkcs7-signature");
	MimeType.set(".cer", "application/pkix-cert");
	MimeType.set(".crl", "application/pkix-crl");
	MimeType.set(".pkipath", "application/pkix-pkipath");
	MimeType.set(".pki", "application/pkixcmp");
	MimeType.set(".pls", "application/pls+xml");
	MimeType.set(".ai,.eps,.ps", "application/postscript");
	MimeType.set(".cww", "application/prs.cww");
	MimeType.set(".rdf", "application/rdf+xml");
	MimeType.set(".rif", "application/reginfo+xml");
	MimeType.set(".rnc", "application/relax-ng-compact-syntax");
	MimeType.set(".rl", "application/resource-lists+xml");
	MimeType.set(".rld", "application/resource-lists-diff+xml");
	MimeType.set(".rs", "application/rls-services+xml");
	MimeType.set(".rsd", "application/rsd+xml");
	MimeType.set(".rss", "application/rss+xml");
	MimeType.set(".rtf", "application/rtf");
	MimeType.set(".sbml", "application/sbml+xml");
	MimeType.set(".scq", "application/scvp-cv-request");
	MimeType.set(".scs", "application/scvp-cv-response");
	MimeType.set(".spq", "application/scvp-vp-request");
	MimeType.set(".spp", "application/scvp-vp-response");
	MimeType.set(".sdp", "application/sdp");
	MimeType.set(".setpay", "application/set-payment-initiation");
	MimeType.set(".setreg", "application/set-registration-initiation");
	MimeType.set(".shf", "application/shf+xml");
	MimeType.set(".smi,.smil", "application/smil+xml");
	MimeType.set(".rq", "application/sparql-query");
	MimeType.set(".srx", "application/sparql-results+xml");
	MimeType.set(".gram", "application/srgs");
	MimeType.set(".grxml", "application/srgs+xml");
	MimeType.set(".ssml", "application/ssml+xml");
	MimeType.set(".plb", "application/vnd.3gpp.pic-bw-large");
	MimeType.set(".psb", "application/vnd.3gpp.pic-bw-small");
	MimeType.set(".pvb", "application/vnd.3gpp.pic-bw-var");
	MimeType.set(".tcap", "application/vnd.3gpp2.tcap");
	MimeType.set(".pwn", "application/vnd.3m.post-it-notes");
	MimeType.set(".aso", "application/vnd.accpac.simply.aso");
	MimeType.set(".imp", "application/vnd.accpac.simply.imp");
	MimeType.set(".acu", "application/vnd.acucobol");
	MimeType.set(".atc,.acutc", "application/vnd.acucorp");
	MimeType.set(".air", "application/vnd.adobe.air-application-installer-package+zip");
	MimeType.set(".xdp", "application/vnd.adobe.xdp+xml");
	MimeType.set(".xfdf", "application/vnd.adobe.xfdf");
	MimeType.set(".azf", "application/vnd.airzip.filesecure.azf");
	MimeType.set(".azs", "application/vnd.airzip.filesecure.azs");
	MimeType.set(".azw", "application/vnd.amazon.ebook");
	MimeType.set(".acc", "application/vnd.americandynamics.acc");
	MimeType.set(".ami", "application/vnd.amiga.ami");
	MimeType.set(".apk", "application/vnd.android.package-archive");
	MimeType.set(".cii", "application/vnd.anser-web-certificate-issue-initiation");
	MimeType.set(".fti", "application/vnd.anser-web-funds-transfer-initiation");
	MimeType.set(".atx", "application/vnd.antix.game-component");
	MimeType.set(".mpkg", "application/vnd.apple.installer+xml");
	MimeType.set(".swi", "application/vnd.arastra.swi");
	MimeType.set(".aep", "application/vnd.audiograph");
	MimeType.set(".mpm", "application/vnd.blueice.multipass");
	MimeType.set(".bmi", "application/vnd.bmi");
	MimeType.set(".rep", "application/vnd.businessobjects");
	MimeType.set(".cdxml", "application/vnd.chemdraw+xml");
	MimeType.set(".mmd", "application/vnd.chipnuts.karaoke-mmd");
	MimeType.set(".cdy", "application/vnd.cinderella");
	MimeType.set(".cla", "application/vnd.claymore");
	MimeType.set(".c4g,.c4d,.c4f,.c4p,.c4u", "application/vnd.clonk.c4group");
	MimeType.set(".csp", "application/vnd.commonspace");
	MimeType.set(".cdbcmsg", "application/vnd.contact.cmsg");
	MimeType.set(".cmc", "application/vnd.cosmocaller");
	MimeType.set(".clkx", "application/vnd.crick.clicker");
	MimeType.set(".clkk", "application/vnd.crick.clicker.keyboard");
	MimeType.set(".clkp", "application/vnd.crick.clicker.palette");
	MimeType.set(".clkt", "application/vnd.crick.clicker.template");
	MimeType.set(".clkw", "application/vnd.crick.clicker.wordbank");
	MimeType.set(".wbs", "application/vnd.criticaltools.wbs+xml");
	MimeType.set(".pml", "application/vnd.ctc-posml");
	MimeType.set(".ppd", "application/vnd.cups-ppd");
	MimeType.set(".car", "application/vnd.curl.car");
	MimeType.set(".pcurl", "application/vnd.curl.pcurl");
	MimeType.set(".rdz", "application/vnd.data-vision.rdz");
	MimeType.set(".fe_launch", "application/vnd.denovo.fcselayout-link");
	MimeType.set(".dna", "application/vnd.dna");
	MimeType.set(".mlp", "application/vnd.dolby.mlp");
	MimeType.set(".dpg", "application/vnd.dpgraph");
	MimeType.set(".dfac", "application/vnd.dreamfactory");
	MimeType.set(".geo", "application/vnd.dynageo");
	MimeType.set(".mag", "application/vnd.ecowin.chart");
	MimeType.set(".nml", "application/vnd.enliven");
	MimeType.set(".esf", "application/vnd.epson.esf");
	MimeType.set(".msf", "application/vnd.epson.msf");
	MimeType.set(".qam", "application/vnd.epson.quickanime");
	MimeType.set(".slt", "application/vnd.epson.salt");
	MimeType.set(".ssf", "application/vnd.epson.ssf");
	MimeType.set(".es3,.et3", "application/vnd.eszigno3+xml");
	MimeType.set(".ez2", "application/vnd.ezpix-album");
	MimeType.set(".ez3", "application/vnd.ezpix-package");
	MimeType.set(".fdf", "application/vnd.fdf");
	MimeType.set(".mseed", "application/vnd.fdsn.mseed");
	MimeType.set(".seed,.dataless", "application/vnd.fdsn.seed");
	MimeType.set(".gph", "application/vnd.flographit");
	MimeType.set(".ftc", "application/vnd.fluxtime.clip");
	MimeType.set(".fm,.frame,.maker,.book", "application/vnd.framemaker");
	MimeType.set(".fnc", "application/vnd.frogans.fnc");
	MimeType.set(".ltf", "application/vnd.frogans.ltf");
	MimeType.set(".fsc", "application/vnd.fsc.weblaunch");
	MimeType.set(".oas", "application/vnd.fujitsu.oasys");
	MimeType.set(".oa2", "application/vnd.fujitsu.oasys2");
	MimeType.set(".oa3", "application/vnd.fujitsu.oasys3");
	MimeType.set(".fg5", "application/vnd.fujitsu.oasysgp");
	MimeType.set(".bh2", "application/vnd.fujitsu.oasysprs");
	MimeType.set(".ddd", "application/vnd.fujixerox.ddd");
	MimeType.set(".xdw", "application/vnd.fujixerox.docuworks");
	MimeType.set(".xbd", "application/vnd.fujixerox.docuworks.binder");
	MimeType.set(".fzs", "application/vnd.fuzzysheet");
	MimeType.set(".txd", "application/vnd.genomatix.tuxedo");
	MimeType.set(".ggb", "application/vnd.geogebra.file");
	MimeType.set(".ggt", "application/vnd.geogebra.tool");
	MimeType.set(".gex,.gre", "application/vnd.geometry-explorer");
	MimeType.set(".gmx", "application/vnd.gmx");
	MimeType.set(".kml", "application/vnd.google-earth.kml+xml");
	MimeType.set(".kmz", "application/vnd.google-earth.kmz");
	MimeType.set(".gqf,.gqs", "application/vnd.grafeq");
	MimeType.set(".gac", "application/vnd.groove-account");
	MimeType.set(".ghf", "application/vnd.groove-help");
	MimeType.set(".gim", "application/vnd.groove-identity-message");
	MimeType.set(".grv", "application/vnd.groove-injector");
	MimeType.set(".gtm", "application/vnd.groove-tool-message");
	MimeType.set(".tpl", "application/vnd.groove-tool-template");
	MimeType.set(".vcg", "application/vnd.groove-vcard");
	MimeType.set(".zmm", "application/vnd.handheld-entertainment+xml");
	MimeType.set(".hbci", "application/vnd.hbci");
	MimeType.set(".les", "application/vnd.hhe.lesson-player");
	MimeType.set(".hpgl", "application/vnd.hp-hpgl");
	MimeType.set(".hpid", "application/vnd.hp-hpid");
	MimeType.set(".hps", "application/vnd.hp-hps");
	MimeType.set(".jlt", "application/vnd.hp-jlyt");
	MimeType.set(".pcl", "application/vnd.hp-pcl");
	MimeType.set(".pclxl", "application/vnd.hp-pclxl");
	MimeType.set(".sfd-hdstx", "application/vnd.hydrostatix.sof-data");
	MimeType.set(".x3d", "application/vnd.hzn-3d-crossword");
	MimeType.set(".mpy", "application/vnd.ibm.minipay");
	MimeType.set(".afp,.listafp,.list3820", "application/vnd.ibm.modcap");
	MimeType.set(".irm", "application/vnd.ibm.rights-management");
	MimeType.set(".sc", "application/vnd.ibm.secure-container");
	MimeType.set(".icc,.icm", "application/vnd.iccprofile");
	MimeType.set(".igl", "application/vnd.igloader");
	MimeType.set(".ivp", "application/vnd.immervision-ivp");
	MimeType.set(".ivu", "application/vnd.immervision-ivu");
	MimeType.set(".xpw,.xpx", "application/vnd.intercon.formnet");
	MimeType.set(".qbo", "application/vnd.intu.qbo");
	MimeType.set(".qfx", "application/vnd.intu.qfx");
	MimeType.set(".rcprofile", "application/vnd.ipunplugged.rcprofile");
	MimeType.set(".irp", "application/vnd.irepository.package+xml");
	MimeType.set(".xpr", "application/vnd.is-xpr");
	MimeType.set(".jam", "application/vnd.jam");
	MimeType.set(".rms", "application/vnd.jcp.javame.midlet-rms");
	MimeType.set(".jisp", "application/vnd.jisp");
	MimeType.set(".joda", "application/vnd.joost.joda-archive");
	MimeType.set(".ktz,.ktr", "application/vnd.kahootz");
	MimeType.set(".karbon", "application/vnd.kde.karbon");
	MimeType.set(".chrt", "application/vnd.kde.kchart");
	MimeType.set(".kfo", "application/vnd.kde.kformula");
	MimeType.set(".flw", "application/vnd.kde.kivio");
	MimeType.set(".kon", "application/vnd.kde.kontour");
	MimeType.set(".kpr,.kpt", "application/vnd.kde.kpresenter");
	MimeType.set(".ksp", "application/vnd.kde.kspread");
	MimeType.set(".kwd,.kwt", "application/vnd.kde.kword");
	MimeType.set(".htke", "application/vnd.kenameaapp");
	MimeType.set(".kia", "application/vnd.kidspiration");
	MimeType.set(".kne,.knp", "application/vnd.kinar");
	MimeType.set(".skp,.skd,.skt,.skm", "application/vnd.koan");
	MimeType.set(".sse", "application/vnd.kodak-descriptor");
	MimeType.set(".lbd", "application/vnd.llamagraphics.life-balance.desktop");
	MimeType.set(".lbe", "application/vnd.llamagraphics.life-balance.exchange+xml");
	MimeType.set(".123", "application/vnd.lotus-1-2-3");
	MimeType.set(".apr", "application/vnd.lotus-approach");
	MimeType.set(".pre", "application/vnd.lotus-freelance");
	MimeType.set(".nsf", "application/vnd.lotus-notes");
	MimeType.set(".org", "application/vnd.lotus-organizer");
	MimeType.set(".scm", "application/vnd.lotus-screencam");
	MimeType.set(".lwp", "application/vnd.lotus-wordpro");
	MimeType.set(".portpkg", "application/vnd.macports.portpkg");
	MimeType.set(".mcd", "application/vnd.mcd");
	MimeType.set(".mc1", "application/vnd.medcalcdata");
	MimeType.set(".cdkey", "application/vnd.mediastation.cdkey");
	MimeType.set(".mwf", "application/vnd.mfer");
	MimeType.set(".mfm", "application/vnd.mfmp");
	MimeType.set(".flo", "application/vnd.micrografx.flo");
	MimeType.set(".igx", "application/vnd.micrografx.igx");
	MimeType.set(".mif", "application/vnd.mif");
	MimeType.set(".daf", "application/vnd.mobius.daf");
	MimeType.set(".dis", "application/vnd.mobius.dis");
	MimeType.set(".mbk", "application/vnd.mobius.mbk");
	MimeType.set(".mqy", "application/vnd.mobius.mqy");
	MimeType.set(".msl", "application/vnd.mobius.msl");
	MimeType.set(".plc", "application/vnd.mobius.plc");
	MimeType.set(".txf", "application/vnd.mobius.txf");
	MimeType.set(".mpn", "application/vnd.mophun.application");
	MimeType.set(".mpc", "application/vnd.mophun.certificate");
	MimeType.set(".xul", "application/vnd.mozilla.xul+xml");
	MimeType.set(".cil", "application/vnd.ms-artgalry");
	MimeType.set(".cab", "application/vnd.ms-cab-compressed");
	MimeType.set(".xls,.xlm,.xla,.xlc,.xlt,.xlw", "application/vnd.ms-excel");
	MimeType.set(".xlam", "application/vnd.ms-excel.addin.macroenabled.12");
	MimeType.set(".xlsb", "application/vnd.ms-excel.sheet.binary.macroenabled.12");
	MimeType.set(".xlsm", "application/vnd.ms-excel.sheet.macroenabled.12");
	MimeType.set(".xltm", "application/vnd.ms-excel.template.macroenabled.12");
	MimeType.set(".eot", "application/vnd.ms-fontobject");
	MimeType.set(".chm", "application/vnd.ms-htmlhelp");
	MimeType.set(".ims", "application/vnd.ms-ims");
	MimeType.set(".lrm", "application/vnd.ms-lrm");
	MimeType.set(".cat", "application/vnd.ms-pki.seccat");
	MimeType.set(".stl", "application/vnd.ms-pki.stl");
	MimeType.set(".ppt,.pps,.pot", "application/vnd.ms-powerpoint");
	MimeType.set(".ppam", "application/vnd.ms-powerpoint.addin.macroenabled.12");
	MimeType.set(".pptm", "application/vnd.ms-powerpoint.presentation.macroenabled.12");
	MimeType.set(".sldm", "application/vnd.ms-powerpoint.slide.macroenabled.12");
	MimeType.set(".ppsm", "application/vnd.ms-powerpoint.slideshow.macroenabled.12");
	MimeType.set(".potm", "application/vnd.ms-powerpoint.template.macroenabled.12");
	MimeType.set(".mpp,.mpt", "application/vnd.ms-project");
	MimeType.set(".docm", "application/vnd.ms-word.document.macroenabled.12");
	MimeType.set(".dotm", "application/vnd.ms-word.template.macroenabled.12");
	MimeType.set(".wps,.wks,.wcm,.wdb", "application/vnd.ms-works");
	MimeType.set(".wpl", "application/vnd.ms-wpl");
	MimeType.set(".xps", "application/vnd.ms-xpsdocument");
	MimeType.set(".mseq", "application/vnd.mseq");
	MimeType.set(".mus", "application/vnd.musician");
	MimeType.set(".msty", "application/vnd.muvee.style");
	MimeType.set(".nlu", "application/vnd.neurolanguage.nlu");
	MimeType.set(".nnd", "application/vnd.noblenet-directory");
	MimeType.set(".nns", "application/vnd.noblenet-sealer");
	MimeType.set(".nnw", "application/vnd.noblenet-web");
	MimeType.set(".ngdat", "application/vnd.nokia.n-gage.data");
	MimeType.set(".n-gage", "application/vnd.nokia.n-gage.symbian.install");
	MimeType.set(".rpst", "application/vnd.nokia.radio-preset");
	MimeType.set(".rpss", "application/vnd.nokia.radio-presets");
	MimeType.set(".edm", "application/vnd.novadigm.edm");
	MimeType.set(".edx", "application/vnd.novadigm.edx");
	MimeType.set(".ext", "application/vnd.novadigm.ext");
	MimeType.set(".odc", "application/vnd.oasis.opendocument.chart");
	MimeType.set(".otc", "application/vnd.oasis.opendocument.chart-template");
	MimeType.set(".odb", "application/vnd.oasis.opendocument.database");
	MimeType.set(".odf", "application/vnd.oasis.opendocument.formula");
	MimeType.set(".odft", "application/vnd.oasis.opendocument.formula-template");
	MimeType.set(".odg", "application/vnd.oasis.opendocument.graphics");
	MimeType.set(".otg", "application/vnd.oasis.opendocument.graphics-template");
	MimeType.set(".odi", "application/vnd.oasis.opendocument.image");
	MimeType.set(".oti", "application/vnd.oasis.opendocument.image-template");
	MimeType.set(".odp", "application/vnd.oasis.opendocument.presentation");
	MimeType.set(".ods", "application/vnd.oasis.opendocument.spreadsheet");
	MimeType.set(".ots", "application/vnd.oasis.opendocument.spreadsheet-template");
	MimeType.set(".odt", "application/vnd.oasis.opendocument.text");
	MimeType.set(".otm", "application/vnd.oasis.opendocument.text-master");
	MimeType.set(".ott", "application/vnd.oasis.opendocument.text-template");
	MimeType.set(".oth", "application/vnd.oasis.opendocument.text-web");
	MimeType.set(".xo", "application/vnd.olpc-sugar");
	MimeType.set(".dd2", "application/vnd.oma.dd2+xml");
	MimeType.set(".oxt", "application/vnd.openofficeorg.extension");
	MimeType.set(".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
	MimeType.set(".sldx", "application/vnd.openxmlformats-officedocument.presentationml.slide");
	MimeType.set(".ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow");
	MimeType.set(".potx", "application/vnd.openxmlformats-officedocument.presentationml.template");
	MimeType.set(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
	MimeType.set(".xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template");
	MimeType.set(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
	MimeType.set(".dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template");
	MimeType.set(".dp", "application/vnd.osgi.dp");
	MimeType.set(".pdb,.pqa,.oprc", "application/vnd.palm");
	MimeType.set(".str", "application/vnd.pg.format");
	MimeType.set(".ei6", "application/vnd.pg.osasli");
	MimeType.set(".efif", "application/vnd.picsel");
	MimeType.set(".plf", "application/vnd.pocketlearn");
	MimeType.set(".pbd", "application/vnd.powerbuilder6");
	MimeType.set(".box", "application/vnd.previewsystems.box");
	MimeType.set(".mgz", "application/vnd.proteus.magazine");
	MimeType.set(".qps", "application/vnd.publishare-delta-tree");
	MimeType.set(".ptid", "application/vnd.pvi.ptid1");
	MimeType.set(".qxd,.qxt,.qwd,.qwt,.qxl,.qxb", "application/vnd.quark.quarkxpress");
	MimeType.set(".mxl", "application/vnd.recordare.musicxml");
	MimeType.set(".musicxml", "application/vnd.recordare.musicxml+xml");
	MimeType.set(".cod", "application/vnd.rim.cod");
	MimeType.set(".rm", "application/vnd.rn-realmedia");
	MimeType.set(".link66", "application/vnd.route66.link66+xml");
	MimeType.set(".see", "application/vnd.seemail");
	MimeType.set(".sema", "application/vnd.sema");
	MimeType.set(".semd", "application/vnd.semd");
	MimeType.set(".semf", "application/vnd.semf");
	MimeType.set(".ifm", "application/vnd.shana.informed.formdata");
	MimeType.set(".itp", "application/vnd.shana.informed.formtemplate");
	MimeType.set(".iif", "application/vnd.shana.informed.interchange");
	MimeType.set(".ipk", "application/vnd.shana.informed.package");
	MimeType.set(".twd,.twds", "application/vnd.simtech-mindmapper");
	MimeType.set(".mmf", "application/vnd.smaf");
	MimeType.set(".teacher", "application/vnd.smart.teacher");
	MimeType.set(".sdkm,.sdkd", "application/vnd.solent.sdkm+xml");
	MimeType.set(".dxp", "application/vnd.spotfire.dxp");
	MimeType.set(".sfs", "application/vnd.spotfire.sfs");
	MimeType.set(".sdc", "application/vnd.stardivision.calc");
	MimeType.set(".sda", "application/vnd.stardivision.draw");
	MimeType.set(".sdd", "application/vnd.stardivision.impress");
	MimeType.set(".smf", "application/vnd.stardivision.math");
	MimeType.set(".sdw", "application/vnd.stardivision.writer");
	MimeType.set(".vor", "application/vnd.stardivision.writer");
	MimeType.set(".sgl", "application/vnd.stardivision.writer-global");
	MimeType.set(".sxc", "application/vnd.sun.xml.calc");
	MimeType.set(".stc", "application/vnd.sun.xml.calc.template");
	MimeType.set(".sxd", "application/vnd.sun.xml.draw");
	MimeType.set(".std", "application/vnd.sun.xml.draw.template");
	MimeType.set(".sxi", "application/vnd.sun.xml.impress");
	MimeType.set(".sti", "application/vnd.sun.xml.impress.template");
	MimeType.set(".sxm", "application/vnd.sun.xml.math");
	MimeType.set(".sxw", "application/vnd.sun.xml.writer");
	MimeType.set(".sxg", "application/vnd.sun.xml.writer.global");
	MimeType.set(".stw", "application/vnd.sun.xml.writer.template");
	MimeType.set(".sus,.susp", "application/vnd.sus-calendar");
	MimeType.set(".svd", "application/vnd.svd");
	MimeType.set(".sis,.sisx", "application/vnd.symbian.install");
	MimeType.set(".xsm", "application/vnd.syncml+xml");
	MimeType.set(".bdm", "application/vnd.syncml.dm+wbxml");
	MimeType.set(".xdm", "application/vnd.syncml.dm+xml");
	MimeType.set(".tao", "application/vnd.tao.intent-module-archive");
	MimeType.set(".tmo", "application/vnd.tmobile-livetv");
	MimeType.set(".tpt", "application/vnd.trid.tpt");
	MimeType.set(".mxs", "application/vnd.triscape.mxs");
	MimeType.set(".tra", "application/vnd.trueapp");
	MimeType.set(".ufd,.ufdl", "application/vnd.ufdl");
	MimeType.set(".utz", "application/vnd.uiq.theme");
	MimeType.set(".umj", "application/vnd.umajin");
	MimeType.set(".unityweb", "application/vnd.unity");
	MimeType.set(".uoml", "application/vnd.uoml+xml");
	MimeType.set(".vcx", "application/vnd.vcx");
	MimeType.set(".vsd,.vst,.vss,.vsw", "application/vnd.visio");
	MimeType.set(".vis", "application/vnd.visionary");
	MimeType.set(".vsf", "application/vnd.vsf");
	MimeType.set(".wbxml", "application/vnd.wap.wbxml");
	MimeType.set(".wmlc", "application/vnd.wap.wmlc");
	MimeType.set(".wmlsc", "application/vnd.wap.wmlscriptc");
	MimeType.set(".wtb", "application/vnd.webturbo");
	MimeType.set(".wpd", "application/vnd.wordperfect");
	MimeType.set(".wqd", "application/vnd.wqd");
	MimeType.set(".stf", "application/vnd.wt.stf");
	MimeType.set(".xar", "application/vnd.xara");
	MimeType.set(".xfdl", "application/vnd.xfdl");
	MimeType.set(".hvd", "application/vnd.yamaha.hv-dic");
	MimeType.set(".hvs", "application/vnd.yamaha.hv-script");
	MimeType.set(".hvp", "application/vnd.yamaha.hv-voice");
	MimeType.set(".osf", "application/vnd.yamaha.openscoreformat");
	MimeType.set(".osfpvg", "application/vnd.yamaha.openscoreformat.osfpvg+xml");
	MimeType.set(".saf", "application/vnd.yamaha.smaf-audio");
	MimeType.set(".spf", "application/vnd.yamaha.smaf-phrase");
	MimeType.set(".cmp", "application/vnd.yellowriver-custom-menu");
	MimeType.set(".zir,.zirz", "application/vnd.zul");
	MimeType.set(".zaz", "application/vnd.zzazz.deck+xml");
	MimeType.set(".vxml", "application/voicexml+xml");
	MimeType.set(".hlp", "application/winhlp");
	MimeType.set(".wsdl", "application/wsdl+xml");
	MimeType.set(".wspolicy", "application/wspolicy+xml");
	MimeType.set(".abw", "application/x-abiword");
	MimeType.set(".ace", "application/x-ace-compressed");
	MimeType.set(".aab,.x32,.u32,.vox", "application/x-authorware-bin");
	MimeType.set(".aam", "application/x-authorware-map");
	MimeType.set(".aas", "application/x-authorware-seg");
	MimeType.set(".bcpio", "application/x-bcpio");
	MimeType.set(".torrent", "application/x-bittorrent");
	MimeType.set(".bz", "application/x-bzip");
	MimeType.set(".bz2,.boz", "application/x-bzip2");
	MimeType.set(".vcd", "application/x-cdlink");
	MimeType.set(".chat", "application/x-chat");
	MimeType.set(".pgn", "application/x-chess-pgn");
	MimeType.set(".cpio", "application/x-cpio");
	MimeType.set(".csh", "application/x-csh");
	MimeType.set(".deb,.udeb", "application/x-debian-package");
	MimeType.set(".dir,.dcr,.dxr,.cst,.cct,.cxt,.w3d,.fgd,.swa", "application/x-director");
	MimeType.set(".wad", "application/x-doom");
	MimeType.set(".ncx", "application/x-dtbncx+xml");
	MimeType.set(".dtb", "application/x-dtbook+xml");
	MimeType.set(".res", "application/x-dtbresource+xml");
	MimeType.set(".dvi", "application/x-dvi");
	MimeType.set(".bdf", "application/x-font-bdf");
	MimeType.set(".gsf", "application/x-font-ghostscript");
	MimeType.set(".psf", "application/x-font-linux-psf");
	MimeType.set(".otf", "application/x-font-otf");
	MimeType.set(".pcf", "application/x-font-pcf");
	MimeType.set(".snf", "application/x-font-snf");
	MimeType.set(".ttf,.ttc", "application/x-font-ttf");
	MimeType.set(".pfa,.pfb,.pfm,.afm", "application/x-font-type1");
	MimeType.set(".spl", "application/x-futuresplash");
	MimeType.set(".gnumeric", "application/x-gnumeric");
	MimeType.set(".gtar", "application/x-gtar");
	MimeType.set(".hdf", "application/x-hdf");
	MimeType.set(".jnlp", "application/x-java-jnlp-file");
	MimeType.set(".latex", "application/x-latex");
	MimeType.set(".prc,.mobi", "application/x-mobipocket-ebook");
	MimeType.set(".application", "application/x-ms-application");
	MimeType.set(".wmd", "application/x-ms-wmd");
	MimeType.set(".wmz", "application/x-ms-wmz");
	MimeType.set(".xbap", "application/x-ms-xbap");
	MimeType.set(".mdb", "application/x-msaccess");
	MimeType.set(".obd", "application/x-msbinder");
	MimeType.set(".crd", "application/x-mscardfile");
	MimeType.set(".clp", "application/x-msclip");
	MimeType.set(".exe,.dll,.com,.bat,.msi", "application/x-msdownload");
	MimeType.set(".mvb,.m13,.m14", "application/x-msmediaview");
	MimeType.set(".wmf", "application/x-msmetafile");
	MimeType.set(".mny", "application/x-msmoney");
	MimeType.set(".pub", "application/x-mspublisher");
	MimeType.set(".scd", "application/x-msschedule");
	MimeType.set(".trm", "application/x-msterminal");
	MimeType.set(".wri", "application/x-mswrite");
	MimeType.set(".nc,.cdf", "application/x-netcdf");
	MimeType.set(".p12,.pfx", "application/x-pkcs12");
	MimeType.set(".p7b,.spc", "application/x-pkcs7-certificates");
	MimeType.set(".p7r", "application/x-pkcs7-certreqresp");
	MimeType.set(".rar", "application/x-rar-compressed");
	MimeType.set(".sh", "application/x-sh");
	MimeType.set(".shar", "application/x-shar");
	MimeType.set(".swf", "application/x-shockwave-flash");
	MimeType.set(".xap", "application/x-silverlight-app");
	MimeType.set(".sit", "application/x-stuffit");
	MimeType.set(".sitx", "application/x-stuffitx");
	MimeType.set(".sv4cpio", "application/x-sv4cpio");
	MimeType.set(".sv4crc", "application/x-sv4crc");
	MimeType.set(".tar", "application/x-tar");
	MimeType.set(".tcl", "application/x-tcl");
	MimeType.set(".tex", "application/x-tex");
	MimeType.set(".tfm", "application/x-tex-tfm");
	MimeType.set(".texinfo,.texi", "application/x-texinfo");
	MimeType.set(".ustar", "application/x-ustar");
	MimeType.set(".src", "application/x-wais-source");
	MimeType.set(".der,.crt", "application/x-x509-ca-cert");
	MimeType.set(".fig", "application/x-xfig");
	MimeType.set(".xpi", "application/x-xpinstall");
	MimeType.set(".xenc", "application/xenc+xml");
	MimeType.set(".xhtml,.xht", "application/xhtml+xml");
	MimeType.set(".xml,.xsl", "application/xml");
	MimeType.set(".dtd", "application/xml-dtd");
	MimeType.set(".xop", "application/xop+xml");
	MimeType.set(".xslt", "application/xslt+xml");
	MimeType.set(".xspf", "application/xspf+xml");
	MimeType.set(".mxml,.xhvml,.xvml,.xvm", "application/xv+xml");
	MimeType.set(".zip", "application/zip");
	MimeType.set(".adp", "audio/adpcm");
	MimeType.set(".au,.snd", "audio/basic");
	MimeType.set(".mid,.midi,.kar,.rmi", "audio/midi");
	MimeType.set(".mp4a", "audio/mp4");
	MimeType.set(".m4a,.m4p", "audio/mp4a-latm");
	MimeType.set(".mpga,.mp2,.mp2a,.mp3,.m2a,.m3a", "audio/mpeg");
	MimeType.set(".oga,.ogg,.spx", "audio/ogg");
	MimeType.set(".eol", "audio/vnd.digital-winds");
	MimeType.set(".dts", "audio/vnd.dts");
	MimeType.set(".dtshd", "audio/vnd.dts.hd");
	MimeType.set(".lvp", "audio/vnd.lucent.voice");
	MimeType.set(".pya", "audio/vnd.ms-playready.media.pya");
	MimeType.set(".ecelp4800", "audio/vnd.nuera.ecelp4800");
	MimeType.set(".ecelp7470", "audio/vnd.nuera.ecelp7470");
	MimeType.set(".ecelp9600", "audio/vnd.nuera.ecelp9600");
	MimeType.set(".aac", "audio/x-aac");
	MimeType.set(".aif,.aiff,.aifc", "audio/x-aiff");
	MimeType.set(".m3u", "audio/x-mpegurl");
	MimeType.set(".wax", "audio/x-ms-wax");
	MimeType.set(".wma", "audio/x-ms-wma");
	MimeType.set(".ram,.ra", "audio/x-pn-realaudio");
	MimeType.set(".rmp", "audio/x-pn-realaudio-plugin");
	MimeType.set(".wav", "audio/x-wav");
	MimeType.set(".cdx", "chemical/x-cdx");
	MimeType.set(".cif", "chemical/x-cif");
	MimeType.set(".cmdf", "chemical/x-cmdf");
	MimeType.set(".cml", "chemical/x-cml");
	MimeType.set(".csml", "chemical/x-csml");
	MimeType.set(".xyz", "chemical/x-xyz");
	MimeType.set(".bmp", "image/bmp");
	MimeType.set(".cgm", "image/cgm");
	MimeType.set(".g3", "image/g3fax");
	MimeType.set(".gif", "image/gif");
	MimeType.set(".ief", "image/ief");
	MimeType.set(".jp2", "image/jp2");
	MimeType.set(".jpeg,.jpg,.jpe", "image/jpeg");
	MimeType.set(".pict,.pic,.pct", "image/pict");
	MimeType.set(".png", "image/png");
	MimeType.set(".btif", "image/prs.btif");
	MimeType.set(".svg,.svgz", "image/svg+xml");
	MimeType.set(".tiff,.tif", "image/tiff");
	MimeType.set(".psd", "image/vnd.adobe.photoshop");
	MimeType.set(".djvu,.djv", "image/vnd.djvu");
	MimeType.set(".dwg", "image/vnd.dwg");
	MimeType.set(".dxf", "image/vnd.dxf");
	MimeType.set(".fbs", "image/vnd.fastbidsheet");
	MimeType.set(".fpx", "image/vnd.fpx");
	MimeType.set(".fst", "image/vnd.fst");
	MimeType.set(".mmr", "image/vnd.fujixerox.edmics-mmr");
	MimeType.set(".rlc", "image/vnd.fujixerox.edmics-rlc");
	MimeType.set(".mdi", "image/vnd.ms-modi");
	MimeType.set(".npx", "image/vnd.net-fpx");
	MimeType.set(".wbmp", "image/vnd.wap.wbmp");
	MimeType.set(".xif", "image/vnd.xiff");
	MimeType.set(".ras", "image/x-cmu-raster");
	MimeType.set(".cmx", "image/x-cmx");
	MimeType.set(".fh,.fhc,.fh4,.fh5,.fh7", "image/x-freehand");
	MimeType.set(".ico", "image/x-icon");
	MimeType.set(".pntg,.pnt,.mac", "image/x-macpaint");
	MimeType.set(".pcx", "image/x-pcx");
	//MimeType.set(".pic,.pct", "image/x-pict");
	MimeType.set(".pnm", "image/x-portable-anymap");
	MimeType.set(".pbm", "image/x-portable-bitmap");
	MimeType.set(".pgm", "image/x-portable-graymap");
	MimeType.set(".ppm", "image/x-portable-pixmap");
	MimeType.set(".qtif,.qti", "image/x-quicktime");
	MimeType.set(".rgb", "image/x-rgb");
	MimeType.set(".xbm", "image/x-xbitmap");
	MimeType.set(".xpm", "image/x-xpixmap");
	MimeType.set(".xwd", "image/x-xwindowdump");
	MimeType.set(".eml,.mime", "message/rfc822");
	MimeType.set(".igs,.iges", "model/iges");
	MimeType.set(".msh,.mesh,.silo", "model/mesh");
	MimeType.set(".dwf", "model/vnd.dwf");
	MimeType.set(".gdl", "model/vnd.gdl");
	MimeType.set(".gtw", "model/vnd.gtw");
	MimeType.set(".mts", "model/vnd.mts");
	MimeType.set(".vtu", "model/vnd.vtu");
	MimeType.set(".wrl,.vrml", "model/vrml");
	MimeType.set(".ics,.ifb", "text/calendar");
	MimeType.set(".css", "text/css");
	MimeType.set(".csv", "text/csv");
	MimeType.set(".html,.htm", "text/html");
	MimeType.set(".txt,.text,.conf,.def,.list,.log,.in", "text/plain");
	MimeType.set(".dsc", "text/prs.lines.tag");
	MimeType.set(".rtx", "text/richtext");
	MimeType.set(".sgml,.sgm", "text/sgml");
	MimeType.set(".tsv", "text/tab-separated-values");
	MimeType.set(".t,.tr,.roff,.man,.me,.ms", "text/troff");
	MimeType.set(".uri,.uris,.urls", "text/uri-list");
	MimeType.set(".curl", "text/vnd.curl");
	MimeType.set(".dcurl", "text/vnd.curl.dcurl");
	MimeType.set(".scurl", "text/vnd.curl.scurl");
	MimeType.set(".mcurl", "text/vnd.curl.mcurl");
	MimeType.set(".fly", "text/vnd.fly");
	MimeType.set(".flx", "text/vnd.fmi.flexstor");
	MimeType.set(".gv", "text/vnd.graphviz");
	MimeType.set(".3dml", "text/vnd.in3d.3dml");
	MimeType.set(".spot", "text/vnd.in3d.spot");
	MimeType.set(".jad", "text/vnd.sun.j2me.app-descriptor");
	MimeType.set(".wml", "text/vnd.wap.wml");
	MimeType.set(".wmls", "text/vnd.wap.wmlscript");
	MimeType.set(".s,.asm", "text/x-asm");
	MimeType.set(".c,.cc,.cxx,.cpp,.h,.hh,.dic", "text/x-c");
	MimeType.set(".f,.for,.f77,.f90", "text/x-fortran");
	MimeType.set(".p,.pas", "text/x-pascal");
	MimeType.set(".java", "text/x-java-source");
	MimeType.set(".etx", "text/x-setext");
	MimeType.set(".uu", "text/x-uuencode");
	MimeType.set(".vcs", "text/x-vcalendar");
	MimeType.set(".vcf", "text/x-vcard");
	MimeType.set(".3gp", "video/3gpp");
	MimeType.set(".3g2", "video/3gpp2");
	MimeType.set(".h261", "video/h261");
	MimeType.set(".h263", "video/h263");
	MimeType.set(".h264", "video/h264");
	MimeType.set(".jpgv", "video/jpeg");
	MimeType.set(".jpm,.jpgm", "video/jpm");
	MimeType.set(".mj2,.mjp2", "video/mj2");
	MimeType.set(".mp4,.mp4v,.mpg4,.m4v", "video/mp4");
	MimeType.set(".mpeg,.mpg,.mpe,.m1v,.m2v", "video/mpeg");
	MimeType.set(".ogv", "video/ogg");
	MimeType.set(".qt,.mov", "video/quicktime");
	MimeType.set(".fvt", "video/vnd.fvt");
	MimeType.set(".mxu,.m4u", "video/vnd.mpegurl");
	MimeType.set(".pyv", "video/vnd.ms-playready.media.pyv");
	MimeType.set(".viv", "video/vnd.vivo");
	MimeType.set(".dv,.dif", "video/x-dv");
	MimeType.set(".f4v", "video/x-f4v");
	MimeType.set(".fli", "video/x-fli");
	MimeType.set(".flv", "video/x-flv");
	//MimeType.set(".m4v", "video/x-m4v");
	MimeType.set(".asf,.asx", "video/x-ms-asf");
	MimeType.set(".wm", "video/x-ms-wm");
	MimeType.set(".wmv", "video/x-ms-wmv");
	MimeType.set(".wmx", "video/x-ms-wmx");
	MimeType.set(".wvx", "video/x-ms-wvx");
	MimeType.set(".avi", "video/x-msvideo");
	MimeType.set(".movie", "video/x-sgi-movie");
	MimeType.set(".ice", "x-conference/x-cooltalk");
	MimeType.set(".webm", "video/webm");

	// Not really sure about these...
	MimeType.set(".epub", "application/epub+zip");
	MimeType.set(".mobi", "application/x-mobipocket-ebook");

	// Here's some common special cases without filename extensions
	MimeType.set("README,LICENSE,COPYING,TODO,ABOUT,AUTHORS,CONTRIBUTORS",
		"text/plain");
	MimeType.set("manifest,.manifest,.mf,.appcache", "text/cache-manifest");
	if (exports !== undefined) {
		exports.charset = MimeType.charset;
		exports.catalog = MimeType.catalog;
		exports.lookup = MimeType.lookup;
		exports.set = MimeType.set;
		exports.del = MimeType.del;
		exports.forEach = MimeType.forEach;
	}

	self.MimeType = MimeType;
	return self;
}(this));
},{"path":15}],8:[function(require,module,exports){
// Page Agent (PAgent)
// ===================
// Standard page behaviors
var util = require('./util');

function setup() {
	// Traffic logging
	local.setDispatchWrapper(function(req, res, dispatch) {
		var res_ = dispatch(req, res);
		res_.then(
			function() { console.log(req, res); },
			function() { console.error(req, res); }
		);
	});

	// Request events
	try { local.bindRequestEvents(document.body); }
	catch (e) { console.error('Failed to bind body request events.', e); }
	document.body.addEventListener('request', function(e) {
		console.log('toplevel request event', e); // :TODO:
		// var target = e.target;
		// dispatchRequest(e.detail, ((region) ? $(region) : null), $(target));
	});
}

function dispatchRequest(req, $region, $target) {
	var body = req.body; delete req.body;

	if (!req.headers) { req.headers = {}; }
	if (req.headers && !req.headers.accept) { req.headers.accept = 'text/html, */*'; }
	req = (req instanceof local.Request) ? req : (new local.Request(req));

	// Relative link? Make absolute
	if (!local.isAbsUri(req.url)) {
		var baseurl = ($region && $region.data('domain'))
			? $region.data('domain')
			: (window.location.protocol + '//' + window.location.host);
		req.url = local.joinUri(baseurl, req.url);
	}

	// Handle request based on target and origin
	var res_;
	req.urld = req.urld || local.parseUri(req.url);
	var newOrigin = (req.urld.protocol != 'data') ? (req.urld.protocol || 'local')+'://'+req.urld.authority : null;
	if ($iframe && (!target || target == '_self')) {
		// In-place update
		res_ = local.dispatch(req);
		res_.always(function(res) {
			$iframe.data('origin', newOrigin);
			renderIframe($iframe, util.renderResponse(req, res));
		});
	} else if (target == '_child') {
		throw "target=_child Not yet implemented";
		// New iframe
		res_ = local.dispatch(req);
		res_.always(function(res) {
			var $newIframe = createIframe($('todo'), newOrigin); // :TODO: - container
			renderIframe($newIframe, util.renderResponse(req, res));
			return res;
		});
	} else if ((!$iframe && !target) || target == '_null') {
		// Null target, simple dispatch
		res_ = local.dispatch(req);
	} else {
		console.error('Invalid request target', target, req, origin);
		return null;
	}

	req.end(body);
	return res_;
}


module.exports = {
	setup: setup,
	dispatchRequest: dispatchRequest
};
},{"./util":10}],9:[function(require,module,exports){
// Items rendered in the directory by plugins
var renderedItem = {
	allowedTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
		// sections
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'header', 'footer', 'section', 'nav', 'article', 'aside', 'address',

		// grouping
		'hr', 'p', 'pre', 'blockquote',
		'ol', 'ul', 'li', 'dl', 'dt', 'dd',
		'figure', 'figcaption',
		'div',

		// text-level semantics
		'a', 'em', 'strong', 'small', 's',
		'cite', 'q', 'dfn', 'abbr',
		'data', 'time', 'code', 'var', 'samp', 'kbd',
		'sub', 'sup', 'i', 'b', 'u',
		'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo',
		'span', 'br', 'wbr',

		// edits
		'ins', 'del',

		// embedded content
		'img', 'video', 'audio', 'source', 'track',

		// tabular data
		'table', 'caption', 'colgroup', 'col',
		'tbody', 'thead', 'tfoot',
		'tr', 'td', 'th',

		// forms
		'form', 'fieldset', 'legend',
		'label', 'input', 'button', 'select',
		'datalist', 'optgroup', 'option',
		'textarea', 'keygen', 'output',
		'progress', 'meter'
	],
	disallowedClasses: [
		// Boostrap
		// because of position: fixed or position: absolute
		'affix', 'dropdown-backdrop', 'navbar-fixed-top', 'navbar-fixed-bottom',
		'modal', 'modal-backdrop',
		'carousel-control', 'carousel-indicators',
		'next', 'prev', // these are from .carousel-inner > .next

		// Custom
		'addlink-panel', 'config-panel'
	],

	urlsPolicy: function(url) { return url; }, // allow all
	tokensPolicy: function(token) {
		if (renderedItem.disallowedClasses.indexOf(token) == -1) {
			return token;
		}
		console.warn('Removed disallowed id/class:', token);
	},
	policy: function(tagName, attribs) {
		var ri = renderedItem;
		if (ri.allowedTags.indexOf(tagName) !== -1) {
			return {attribs: window.html.sanitizeAttribs(tagName, attribs, ri.urlsPolicy, ri.tokensPolicy)};
		} else {
			console.warn('Removed disallowed tag:', tagName);
		}
	}
};

module.exports = {
	sanitizeRenderedItem: function(html) {
		return window.html.sanitizeWithPolicy(html, renderedItem.policy);
	}
};
},{}],10:[function(require,module,exports){
var globals = require('./globals');

var lbracket_regex = /</g;
var rbracket_regex = />/g;
function escapeHTML(str) {
	return (''+str).replace(lbracket_regex, '&lt;').replace(rbracket_regex, '&gt;');
}

var quoteRegex = /"/g;
function escapeQuotes(str) {
	return (''+str).replace(quoteRegex, '&quot;');
}

var sanitizeHtmlRegexp = /<script(.*?)>(.*?)<\/script>/g;
function stripScripts (html) {
	// CSP stops inline or remote script execution, but we still want to stop inclusions of scripts on our domain
	// :TODO: this approach probably naive in some important way
	return html.replace(sanitizeHtmlRegexp, '');
}

function renderResponse(req, res) {
	if (res.body !== '') {
		if (typeof res.body == 'string') {
			if (res.header('Content-Type').indexOf('text/html') !== -1)
				return res.body;
			if (res.header('Content-Type').indexOf('image/') === 0) {
				return '<img src="'+req.url+'">';
				// :HACK: it appears that base64 encoding cant occur without retrieving the data as a binary array buffer
				// - this could be done by first doing a HEAD request, then deciding whether to use binary according to the reported content-type
				// - but that relies on consistent HEAD support, which is unlikely
				// return '<img src="data:'+res.header('Content-Type')+';base64,'+btoa(res.body)+'">';
			}
			if (res.header('Content-Type').indexOf('javascript') !== -1)
				return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(res.body)+'</code></pre>';
			return '<pre>'+escapeHTML(res.body)+'</pre>';
		} else {
			return '<link href="css/prism.css" rel="stylesheet"><pre><code class="language-javascript">'+escapeHTML(JSON.stringify(res.body))+'</code></pre>';
		}
	}
	return res.status + ' ' + res.reason;
}

function serializeRawMeta(obj) {
	var parts = [];
	for (var k in obj) {
		if (k == 'href') continue;
		parts.push(k+': '+obj[k]);
	}
	return parts.join('\n');
}

function parseRawMeta(str) {
	var obj = {};
	var re = /^([^:]*): ?(.*)/;
	str.split('\n').forEach(function(line, i) {
		var parse = re.exec(line);
		if (!parse) throw {line: 5, error: 'Bad line'};
		obj[parse[1]] = parse[2];
	});
	return obj;
}

var lookupReq;
var lookupAttempts;
function fetch(url, useHead) {
	if (url === null) {
		if (lookupReq) lookupReq.close();
		lookupAttempts = null;
		return;
	}

	var method = (useHead) ? 'HEAD' : 'GET';
	var p = local.promise();
	var urld = local.parseUri(url);
	if (!urld || !urld.authority) {
		p.fulfill(false); // bad url, dont even try it!
		return p;
	}

	var triedProxy = false;
	var attempts = lookupAttempts = [new local.Request({ method: method, url: url, binary: true })]; // first attempt, as given
	if (!urld.protocol) {
		// No protocol? Two more attempts - 1 with https, then one with plain http
		attempts.push(new local.Request({ method: method, url: 'https://'+urld.authority+urld.relative, binary: true }));
		attempts.push(new local.Request({ method: method, url: 'http://'+urld.authority+urld.relative, binary: true }));
	}

	function makeAttempt() {
		if (lookupReq) lookupReq.close();
		if (lookupAttempts != attempts) { // have we started a new set of attempts?
			console.log('Aborting lookup attempts');
			return;
		}
		lookupReq = attempts.shift();
		local.dispatch(lookupReq).always(handleAttempt);
		lookupReq.end();
	}
	makeAttempt();

	function handleAttempt(res) {
		if (res.status >= 200 && res.status < 300) {
			p.fulfill(res); // Done!
		} else if (!attempts.length && res.status === 0 && !triedProxy) {
			// May be a CORS issue, try the proxy
			triedProxy = true;
			globals.fetchProxyUA.resolve({ nohead: true }).always(function(proxyUrl) {
				if (!urld.protocol) {
					if (useHead) {
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative } }));
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative } }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					} else {
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'https://'+urld.authority+urld.relative }, binary: true }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: 'http://'+urld.authority+urld.relative }, binary: true }));
					}
				} else {
					if (useHead) {
						attempts.push(new local.Request({ method: 'HEAD', url: proxyUrl, query: { url: url } }));
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: url }, binary: true }));
					} else {
						attempts.push(new local.Request({ method: 'GET', url: proxyUrl, query: { url: url }, binary: true }));
					}
				}
				makeAttempt();
			});
		} else {
			// No dice, any attempts left?
			if (attempts.length) {
				makeAttempt(); // try the next one
			} else {
				p.fulfill(res); // no dice
			}
		}
	}

	return p;
}

module.exports = {
	escapeHTML: escapeHTML,
	makeSafe: escapeHTML,
	escapeQuotes: escapeQuotes,
	stripScripts: stripScripts,
	renderResponse: renderResponse,

	serializeRawMeta: serializeRawMeta,
	parseRawMeta: parseRawMeta,

	fetch: fetch,
	fetchMeta: function(url) { return fetch(url, true); }
};
},{"./globals":6}],11:[function(require,module,exports){
var globals   = require('../globals');
var util      = require('../util');
var mimetypes = require('../mimetypes');

var changeTimeoutId;
var curLink, curResponse;

function reset() {
	// Abort any fetch requests
	util.fetch(null);
	curLink = curResponse = null; // reset current link

	// Reset the UI
	var $form = $('.addlink-panel form');
	$form[0].reset();
	$form.find('#post-btns').attr('disabled', 'disabled').addClass('hidden');
	$form.find('.fetch-result').addClass('hidden').text('');
}

function onURLInputChange() {
	// "Debounce"
	if (changeTimeoutId) clearTimeout(changeTimeoutId);

	var url = $(this).val();
	if (url) {
		var $form = $(this).parents('form');
		// Give a sec for the user to stop editing
		changeTimeoutId = setTimeout(fetchLinkCB(url, $form), 500);
	} else {
		reset();
	}
}

function onPostDoc(e) {
	e.preventDefault();
	if (!curLink) return;

	// Add to dir's docs
	var link = local.util.deepClone(curLink);
	delete link.href;
	globals.pageUA.POST(curResponse.body, { query: link, Content_Type: curLink.type })
		.always(handlePostResponse);
}

function onPostLink(e) {
	e.preventDefault();
	if (!curLink) return;

	// Add to dir's links
	globals.pageUA.POST(null, { query: curLink })
		.always(handlePostResponse);
}

function handlePostResponse(res) {
	if (res.status == 201) {
		window.location.reload();
	} else if (res.status == 403) {
		alert('Sorry! You must own the directory to add links to it.');
	} else {
		alert('Unexpected error: '+res.status+' '+res.reason);
	}
}

function fetchLinkCB(url, $form) {
	return function() {
		curLink = curResponse = null; // reset current link
		changeTimeoutId = null;

		// Tell user we're checking it out
		$form.find('.fetch-result').removeClass('hidden').text('Fetching...');

		// Fetch URL
		util.fetch(url).always(function(res) {
			// :TODO: follow redirects?
			curResponse = res;

			// Try to get the self link
			curLink = local.queryLinks(res, { rel: 'self' })[0];
			if (!curLink) {
				// Create a meta-less stand-in if the URL is good
				if (res.status >= 200 && res.status < 300) {
					curLink = { href: url };
				}
			}

			// Try to establish the mimetype
			var mimeType = res.header('Content-Type');
			if (!mimeType) {
				mimeType = mimetypes.lookup(url) || 'application/octet-stream';
			}
			var semicolonIndex = mimeType.indexOf(';');
			if (semicolonIndex !== -1) {
				mimeType = mimeType.slice(0, semicolonIndex); // strip the charset
			}

			// Do basic re-classification
			if (!curLink.type) { curLink.type = mimeType; }
			if (!curLink.rel) { curLink.rel = 'stdrel.com/media'; }
			else if (!local.queryLink(curLink, { rel: 'stdrel.com/media' })) {
				curLink.rel += ' stdrel.com/media';
			}

			if (curLink) {
				// Success, build description
				var desc = local.util.deepClone(curLink);
				delete desc.href;
				desc.rel = desc.rel.split(' ').filter(function(v) { return v.indexOf('.') !== -1; }).join(' '); // strip non-extension rels
				desc = JSON.stringify(desc);

				// Update UI
				$form.find('#post-btns').attr('disabled', false).removeClass('hidden');
				$form.find('.fetch-result').removeClass('hidden').text('Meta: ' + desc);
			} else {
				// Failure
				$form.find('#post-btns').attr('disabled', 'disabled').addClass('hidden');
				$form.find('.fetch-result').removeClass('hidden').text(res.status + ' ' + res.reason);
			}
		});
	};
}

module.exports = {
	setup: function() {
		// Register event handlers
		$('.addlink-panel input[type=url]').on('keyup', onURLInputChange);
		$('.addlink-panel #post-doc-btn').on('click', onPostDoc);
		$('.addlink-panel #post-link-btn').on('click', onPostLink);
	}
};
},{"../globals":6,"../mimetypes":7,"../util":10}],12:[function(require,module,exports){
var globals = require('../globals');

module.exports = {
	setup: function() {
		if (globals.session.isPageAdmin) {
			$('.directory-delete-btn').on('click', function() {
				if (!confirm('Delete this directory. Are you sure?')) return false;
				globals.pageUA.DELETE()
					.then(function(res) {
						window.location = '/';
					})
					.fail(function(res) {
						alert('Unexpected error: ' + res.status +' '+res.reason);
					});
				return false;
			});
		}
	}
};
},{"../globals":6}],13:[function(require,module,exports){
var globals = require('../globals');

module.exports = {
	setup: function() {
		$('.center-pane').on('click', function(e) {
			if (!e.ctrlKey) {
				// unselect current selection if ctrl isnot held down
				$('.directory-links-list .selected').removeClass('selected');
			}

			var slotEl = local.util.findParentNode.byClass(e.target, 'directory-item-slot');
			if (slotEl) {
				slotEl.classList.add('selected');
			}
		});
	}
};
},{"../globals":6}],14:[function(require,module,exports){


//
// The shims in this file are not fully implemented shims for the ES5
// features, but do work for the particular usecases there is in
// the other modules.
//

var toString = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

// Array.isArray is supported in IE9
function isArray(xs) {
  return toString.call(xs) === '[object Array]';
}
exports.isArray = typeof Array.isArray === 'function' ? Array.isArray : isArray;

// Array.prototype.indexOf is supported in IE9
exports.indexOf = function indexOf(xs, x) {
  if (xs.indexOf) return xs.indexOf(x);
  for (var i = 0; i < xs.length; i++) {
    if (x === xs[i]) return i;
  }
  return -1;
};

// Array.prototype.filter is supported in IE9
exports.filter = function filter(xs, fn) {
  if (xs.filter) return xs.filter(fn);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    if (fn(xs[i], i, xs)) res.push(xs[i]);
  }
  return res;
};

// Array.prototype.forEach is supported in IE9
exports.forEach = function forEach(xs, fn, self) {
  if (xs.forEach) return xs.forEach(fn, self);
  for (var i = 0; i < xs.length; i++) {
    fn.call(self, xs[i], i, xs);
  }
};

// Array.prototype.map is supported in IE9
exports.map = function map(xs, fn) {
  if (xs.map) return xs.map(fn);
  var out = new Array(xs.length);
  for (var i = 0; i < xs.length; i++) {
    out[i] = fn(xs[i], i, xs);
  }
  return out;
};

// Array.prototype.reduce is supported in IE9
exports.reduce = function reduce(array, callback, opt_initialValue) {
  if (array.reduce) return array.reduce(callback, opt_initialValue);
  var value, isValueSet = false;

  if (2 < arguments.length) {
    value = opt_initialValue;
    isValueSet = true;
  }
  for (var i = 0, l = array.length; l > i; ++i) {
    if (array.hasOwnProperty(i)) {
      if (isValueSet) {
        value = callback(value, array[i], i, array);
      }
      else {
        value = array[i];
        isValueSet = true;
      }
    }
  }

  return value;
};

// String.prototype.substr - negative index don't work in IE8
if ('ab'.substr(-1) !== 'b') {
  exports.substr = function (str, start, length) {
    // did we get a negative start, calculate how much it is from the beginning of the string
    if (start < 0) start = str.length + start;

    // call the original function
    return str.substr(start, length);
  };
} else {
  exports.substr = function (str, start, length) {
    return str.substr(start, length);
  };
}

// String.prototype.trim is supported in IE9
exports.trim = function (str) {
  if (str.trim) return str.trim();
  return str.replace(/^\s+|\s+$/g, '');
};

// Function.prototype.bind is supported in IE9
exports.bind = function () {
  var args = Array.prototype.slice.call(arguments);
  var fn = args.shift();
  if (fn.bind) return fn.bind.apply(fn, args);
  var self = args.shift();
  return function () {
    fn.apply(self, args.concat([Array.prototype.slice.call(arguments)]));
  };
};

// Object.create is supported in IE9
function create(prototype, properties) {
  var object;
  if (prototype === null) {
    object = { '__proto__' : null };
  }
  else {
    if (typeof prototype !== 'object') {
      throw new TypeError(
        'typeof prototype[' + (typeof prototype) + '] != \'object\''
      );
    }
    var Type = function () {};
    Type.prototype = prototype;
    object = new Type();
    object.__proto__ = prototype;
  }
  if (typeof properties !== 'undefined' && Object.defineProperties) {
    Object.defineProperties(object, properties);
  }
  return object;
}
exports.create = typeof Object.create === 'function' ? Object.create : create;

// Object.keys and Object.getOwnPropertyNames is supported in IE9 however
// they do show a description and number property on Error objects
function notObject(object) {
  return ((typeof object != "object" && typeof object != "function") || object === null);
}

function keysShim(object) {
  if (notObject(object)) {
    throw new TypeError("Object.keys called on a non-object");
  }

  var result = [];
  for (var name in object) {
    if (hasOwnProperty.call(object, name)) {
      result.push(name);
    }
  }
  return result;
}

// getOwnPropertyNames is almost the same as Object.keys one key feature
//  is that it returns hidden properties, since that can't be implemented,
//  this feature gets reduced so it just shows the length property on arrays
function propertyShim(object) {
  if (notObject(object)) {
    throw new TypeError("Object.getOwnPropertyNames called on a non-object");
  }

  var result = keysShim(object);
  if (exports.isArray(object) && exports.indexOf(object, 'length') === -1) {
    result.push('length');
  }
  return result;
}

var keys = typeof Object.keys === 'function' ? Object.keys : keysShim;
var getOwnPropertyNames = typeof Object.getOwnPropertyNames === 'function' ?
  Object.getOwnPropertyNames : propertyShim;

if (new Error().hasOwnProperty('description')) {
  var ERROR_PROPERTY_FILTER = function (obj, array) {
    if (toString.call(obj) === '[object Error]') {
      array = exports.filter(array, function (name) {
        return name !== 'description' && name !== 'number' && name !== 'message';
      });
    }
    return array;
  };

  exports.keys = function (object) {
    return ERROR_PROPERTY_FILTER(object, keys(object));
  };
  exports.getOwnPropertyNames = function (object) {
    return ERROR_PROPERTY_FILTER(object, getOwnPropertyNames(object));
  };
} else {
  exports.keys = keys;
  exports.getOwnPropertyNames = getOwnPropertyNames;
}

// Object.getOwnPropertyDescriptor - supported in IE8 but only on dom elements
function valueObject(value, key) {
  return { value: value[key] };
}

if (typeof Object.getOwnPropertyDescriptor === 'function') {
  try {
    Object.getOwnPropertyDescriptor({'a': 1}, 'a');
    exports.getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  } catch (e) {
    // IE8 dom element issue - use a try catch and default to valueObject
    exports.getOwnPropertyDescriptor = function (value, key) {
      try {
        return Object.getOwnPropertyDescriptor(value, key);
      } catch (e) {
        return valueObject(value, key);
      }
    };
  }
} else {
  exports.getOwnPropertyDescriptor = valueObject;
}

},{}],15:[function(require,module,exports){
var process=require("__browserify_process");// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util');
var shims = require('_shims');

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (!util.isString(path)) {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(shims.filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = shims.substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(shims.filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(shims.filter(paths, function(p, index) {
    if (!util.isString(p)) {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

},{"__browserify_process":17,"_shims":14,"util":16}],16:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var shims = require('_shims');

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  shims.forEach(array, function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = shims.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = shims.getOwnPropertyNames(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }

  shims.forEach(keys, function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = shims.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }

  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (shims.indexOf(ctx.seen, desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = shims.reduce(output, function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return shims.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) && objectToString(e) === '[object Error]';
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.binarySlice === 'function'
  ;
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = shims.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = shims.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

},{"_shims":14}],17:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[3])
;