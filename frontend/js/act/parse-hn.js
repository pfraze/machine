importScripts('/js/local.js');

function main(req, res) {
	if (req.path != '/') {
		return run(req, res, req.path.slice(1));
	}

	res.header('Link', [{ href: '/', rel: 'self layer1.io/action', title: 'Parse HN Thread' }]);
	res.header('Content-Type', 'application/json');

	if (req.method == 'HEAD') {
		return res.writeHead(204).end();
	}
	res.writeHead(200).end({
		behavior: ['read-selected', 'add-multiple-items'],
		targets: [{
			rel:'stdrel.com/media',
			type:'text/html',
			origin: { starts: 'https://news.ycombinator.com/item?id=' }
		}]
	});
}

function run(req, res, id) {
	if (req.method == 'POST') {
		local.GET('host.env/selection', { Exec_ID: id })
		.fail(function(err) { res.writeHead(502).end('Failed to fetch selection'); })
		.then(function(res) {
			var i, ps = [];
			var items = res.body;
			for (i=0; i < items.length; i++) {
				items[i].parsed = parseArticle(items[i]);
				if (!items[i].parsed) {
					return res.writeHead(422).end('Selection contained invalid HTML');
				}
			}
			return local.promise.bundle(items.map(createArticle));
		})
		.fail(function(err) { res.writeHead(502).end('Failed to create new documents'); })
		.then(function() { res.writeHead(204).end(); });
	} else {
		res.writeHead(405).end();
	}
}

function parseArticle(item) {
	var html = item.doc;
	var oParser = new DOMParser();
	var oDOM = oParser.parseFromString('<div>'+html+'</div>', "text/html");
	if (!oDom) { return null; }

	function safe(cb) { try { return cb(); } catch (e) { return null; } }
	function text(sel) { try { return oDOM.querySelector(sel).innerText; } catch (e) { return null; } }
	function href(sel) { try { return oDOM.querySelector(sel).attributes.getNamedItem('href').value; } catch (e) { return null; } }

	var comments = [];
	var commentTables = safe(function() { return oDOM.querySelectorAll('table tr:nth-child(3) table'); });
	if (commentTables) {
		commentTables = Array.prototype.slice.call(commentTables);
		commentTables.shift(); // drop first table, it's the comment input box
		parseComments(commentTables);
	}

	// http://schema.org/Comment
	function parseComments(commentTables) {
		for (var i=0; i < commentTables.length; i++) {
			// :TODO:
		}
	}

	// schema.org/Article
	var title = text('td.title');
	return {
		about: { name: title, url: href('td.title a') },
		audience: { audienceType: 'hackers' },
		author: { name: text('td.subtext a') },
		comment: comments,
		commentCount: comments.length,
		name: title + '| Hacker News',
		sameAs: item.meta.href
	};
}

function createArticle(item) {
	return local.POST(item.parsed, {
		url: 'host.env/feed',
		query: {
			rel: 'stdrel.com/media schema.org/Article',
			type: 'application/json',
			id: local.isAbsUri(item.meta.id) ? item.meta.id : item.meta.href
		}
	});
}