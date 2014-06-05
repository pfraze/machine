var watch = require('watch');
var path = require('path');
var fs = require('fs');
var htmlparser = require("htmlparser2");

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
		// :TODO:
	});
}

function deindexHtml(name) {
	// Remove from database and mark file as not indexed
	// :TODO:
}

function reindexHtml(name) {
	deindexHtml(name);
	indexHtml(name);
}