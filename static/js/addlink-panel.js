(function() {
	var changeTimeoutId, lookupReq;
	var curLink;

	// Input change handler
	$('.addlink-panel input[type=url]').on('keyup', function() {
		// "Debounce"
		if (changeTimeoutId) clearTimeout(changeTimeoutId);

		var url = $(this).val();
		if (url) {
			var $form = $(this).parents('form');
			// Give a sec for the user to stop editing
			changeTimeoutId = setTimeout(fetchLinkCB(url, $form), 500);
		}
	});

	// Link post click handler
	$('.addlink-panel form').on('submit', function(e) {
		e.preventDefault();
		if (!curLink) return;

		// Add to dir's links
		$page.POST(curLink).always(function(res) {
			if (res.status == 201) {
				window.location.reload();
			} else if (res.status == 403) {
				alert('Sorry! You must own the directory to add links to it.');
			} else {
				alert('Unexpected error: '+res.status+' '+res.reason);
			}
		});

		// Clear form
		this.reset();
		$(this).find('button').attr('disabled', 'disabled').removeClass('btn-primary').text('Post');
		$(this).find('.fetch-result').text('');
	});

	function fetchLinkCB(url, $form) {
		return function() {
			curLink = null; // reset current link

			// Tell user we're checking it out
			$form.find('button').attr('disabled', 'disabled').removeClass('btn-primary').text('Fetching...');
			$form.find('.fetch-result').text('');

			// Fetch URL
			lookup(url).always(function(res) {
				// Clear process vars
				lookupReq = null;
				changeTimeoutId = null;

				// Try to get the self link
				curLink = local.queryLinks(res, { rel: 'self' })[0];
				if (curLink) {
					// Sanitize reltype
					curLink.rel = (curLink.rel||'')
						.split(' ')
						.filter(function(rel) { return rel.indexOf('.') !== -1; }) // filter out non-URI reltypes
						.join(' ');
				} else {
					// Create a meta-less stand-in if the URL is good
					if (res.status >= 200 && res.status < 300) {
						curLink = { href: url };
					}
					// :TODO: follow redirects
				}

				if (curLink) {
					// Success, build description
					var desc = '';
					if (curLink.title || curLink.id) { desc += '"'+(curLink.title || curLink.id)+'"'; }
					if (curLink.rel) { desc = '{'+curLink.rel.replace(/(^|\b)self(\b|$)/g, '').trim()+'} '; }
					if (!desc) desc = 'no metadata provided';

					// Update UI
					$form.find('button').attr('disabled', false).addClass('btn-primary').text('Post');
					$form.find('.fetch-result').text('URL Found: ' + desc);
				} else {
					// Failure
					$form.find('button').attr('disabled', 'disabled').text('Failure');
					$form.find('.fetch-result').text(res.status + ' ' + res.reason);
				}
			});
		};
	}

	function lookup(url) {
		var p = local.promise();
		var urld = local.parseUri(url);
		if (!urld || !urld.authority) {
			p.fulfill(false); // bad url, dont even try it!
			return p;
		}

		var attempts = [new local.Request({ method: 'HEAD', url: url })]; // first attempt, as given
		if (!urld.protocol) {
			// No protocol? Two more attempts - 1 with https, then one with plain http
			attempts.push(new local.Request({ method: 'HEAD', url: 'https://'+urld.authority+urld.relative }));
			attempts.push(new local.Request({ method: 'HEAD', url: 'http://'+urld.authority+urld.relative }));
		}

		function makeAttempt() {
			if (lookupReq) lookupReq.close();
			lookupReq = attempts.shift();
			local.dispatch(lookupReq).always(function(res) {
				if (res.status >= 200 && res.status < 300) {
					p.fulfill(res); // Done!
				} else {
					// No dice, any attempts left?
					if (attempts.length) {
						makeAttempt(); // try the next one
					} else {
						p.fulfill(res); // no dice
					}
				}
			});
			lookupReq.end();
		}
		makeAttempt();

		return p;
	}
})();