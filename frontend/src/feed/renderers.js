var util = require('../util');

// Thing renderer
local.at('#thing-renderer', function(req, res) {
	GET(req.params.target).always(function(targetRes) {
		res.s200().ContentType('html');
		var desc = [];
		var url = (targetRes.body.url) ? util.escapeHTML(targetRes.body.url) : '#';
		if (targetRes.body.description) { desc.push(util.escapeHTML(targetRes.body.description)); }
		if (targetRes.body.url) { desc.push('<a href="'+url+'">Link</a>'); }
		var html = [
			'<div class="media">',
				'<div class="media-body">',
					'<h4 class="media-heading">'+util.escapeHTML(targetRes.body.name)+'</h4>',
					((desc.length) ? '<p>'+desc.join('<br>')+'</p>' : ''),
				'</div>',
			'</div>'
		].join('');
		res.end(html);
	});
});

// Default renderer
local.at('#about-renderer', function(req, res) {
	HEAD(req.params.target)
		.forceLocal() // force local so that, if the scheme is public (http/s), we'll go through the virtual proxy at #http or #https
					  // ...happens automatically in workers
		.always(function(targetRes) {
			var selfLink = targetRes.links.first('self');
			if (!selfLink) {
				return res.s502().ContentType('html').end('Bad target');
			}

			res.s200().ContentType('html');
			var html = '';

			if (selfLink.rel == 'self stdrel.com/media') {
				// Raw media file, tell the shorthand type (.json, .html, .xml, etc)
				var mime = selfLink.type || 'text/plain';
				if (mime == 'text/plain') mime = 'plain-text';
				else mime = mime.split('/')[1];
				html += '<p>Raw media (.'+mime+') - nothing else is known about this file.</p>';
			} else if (selfLink.is('stdrel.com/rel')) {
				// Summarize reltypes
				html += '<p>This is a "relation type." It explains how a location on the Web behaves, and is the basis of Layer1\'s structure.</p>';
			}

			// Render a small table of common attributes
			if (selfLink.id) { html += '<small class="text-muted">ID</small> '+util.escapeHTML(selfLink.id)+'<br>'; }
			if (selfLink.rel) {
				html += '<small class="text-muted">TYPE</small> '+util.decorateReltype(selfLink.rel);
				if (selfLink.type) { html += ' '+util.escapeHTML(selfLink.type); }
				html += '<br>';
			}
			if (selfLink.href) { html += '<small class="text-muted">HREF</small> <a href="'+util.escapeHTML(selfLink.href)+'" target=_blank>'+util.escapeHTML(selfLink.href)+'</a><br>'; }
			if (selfLink.created_at) { html += '<small class="text-muted">ADDED</small> '+((new Date(+selfLink.created_at)).toLocaleTimeString())+'<br>'; }

			res.end(html);
		});
});

// Test renderer
local.at('#test-renderer', function(req, res) {
	res.s200().ContentType('html').end('<strong>This renderer does fucking nothing, totally useless.</strong><br><img src=/img/Turkish_Van_Cat.jpg>');
});

// Hacker news renderer
local.at('#hn-renderer', function(req, res) {
	GET(req.params.target)
		.forceLocal() // force local so that, if the scheme is public (http/s), we'll go through the virtual proxy at #http or #https
		              // ...happens automatically in workers
		.always(function (targetRes) {
			var selfLink = targetRes.links.first('self');
			if (!selfLink) return res.s502('could not load target').end();
			if (selfLink.href.indexOf('https://news.ycombinator.com') !== 0) {
				return res.s418('I only understand URLs from https://news.ycombinator.com').end();
			}

			if (targetRes.ContentType.indexOf('text/html') !== 0) {
				console.warn(targetRes);
				return res.s415('expected html, got '+targetRes.ContentType).end();
			}

			if (!targetRes.body) {
				return res.s422('no content in target').end();
			}

			var $html = $(targetRes.body);
			if (/^https\:\/\/news\.ycombinator\.com\/?$/.test(selfLink.href)) {
				var $top = $html.find('.title a').eq(0);
				return res.s200().html('<p>Top Story: <a target="_top" href="'+$top.attr('href')+'">'+$top.text()+'</a></p>').end();
			}
			var $title = $html.find('.title a').eq(0);
			var $comments = $html.find('table table table');
			var $commenters = $comments.find('a[href^=user]');
			var $commentersGrouped = {};
			$commenters.each(function(i, a) {
				var $a = $(a);
				if ($commentersGrouped[$a.attr('href')]) {
					$commentersGrouped[$a.attr('href')].count++;
				} else {
					$commentersGrouped[$a.attr('href')] = $a;
					$a.count = 1;
				}
			});

			res.s200().html('');

			res.write('<p>')
				.write('<a target="_top" href="'+$title.attr('href')+'">'+$title.text()+'</a><br>')
				.write('<small><a target="_top" href="'+selfLink.href+'">'+$comments.length+' comments</a></small>')
				.write('</p>');

			res.write('<ul>');
			for (var url in $commentersGrouped) {
				res.write('<li>');
				res.write('<a target="_top" href="https://news.ycombinator.com/' + $commentersGrouped[url].attr('href') + '">');
				res.write($commentersGrouped[url].text());
				res.write('</a>');
				res.write(' ('+$commentersGrouped[url].count+')');
				res.write('</li>');
			}
			res.write('</ul>');

			res.end();
		});
});