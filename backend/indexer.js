var watch = require('watch');
var path = require('path');
var fs = require('fs');
var htmlparser = require("htmlparser2");
var db = require('./lib/db').get();
var util = require('./lib/util');

// Files Watcher
// =============
function isHtml(name) { return name.indexOf('.html', name.length - 5) !== -1; }
watch.createMonitor(
	path.normalize('./files'),
	{
		ignoreDotFiles: true,
		filter: function(name, stat) { return stat.isDirectory() || isHtml(name); }
	},
	function(monitor) {
		// Check if any indexed files have changed since last load
		// :TODO:

		// Hook up monitoring events
		monitor.on('created', function(name, stat) {
			if (isHtml(name)) {
				console.log(name, 'detected - indexing');
				indexHtml(name);
			}
		});
		monitor.on('changed', function(name, stat) {
			if (isHtml(name)) {
				console.log(name, 'changed - reindexing');
				reindexHtml(name);
			}
		});
		monitor.on('removed', function(name, stat) {
			if (isHtml(name)) {
				console.log(name, 'removed - deindexing');
				deindexHtml(name);
			}
		});
	});

function indexHtml(name) {
	// Check if file is already indexed
	// :TODO:

	// Read file
	fs.readFile(name, { encoding: 'utf8' }, function(err, data) {
		if (err) {
			console.error('Failed to read for indexing. File: ', name, ' Error: ', err);
			return;
		}

		// Parse HTML
		var links = [];
		var parser = new htmlparser.Parser({
			onopentag: function(name, attribs){
				if (name == "link") {
					links.push(attribs);
				}
			}
		});
		parser.write(data);
		parser.end();

		// Store links and mark file as indexed
		var anchor = makeAnchor(name);
		links.forEach(function(link) {
			if (!link.href) return;
			if (!link.rel) return;
			var attributes = util.serializeLinkObject(link);
			var values = [anchor, link.href, link.rel, link.type||'', attributes];
			db.run('INSERT INTO links (anchor, href, rel, type, attributes) VALUES(?, ?, ?, ?, ?)', values, function(err) {
				if (err) {
					console.error('Failed to insert link during indexing', err);
				}
			});
		});
	});
}

function deindexHtml(name, cb) {
	// Remove from database and mark file as not indexed
	var anchor = makeAnchor(name);
	db.run('DELETE FROM links WHERE anchor = ?', [anchor], function(err) {
		if (err) {
			console.error('Failed to delete link during indexing', err);
			return;
		}
		cb();
	});
}

function reindexHtml(name) {
	deindexHtml(name, indexHtml.bind(null, name));
}

function makeAnchor(name) {
	return name.replace(/(\\)|\//g, '/').replace(/^files/, '');
}