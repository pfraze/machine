var _feedWatching, _feedLoading;
var _secTestWatching, _secTestLoading;
var fs = require('fs');
var path = require('path');
module.exports = {
	feed: '',
	secTest: '',
	load: function(config) {
		var port = config.downstream_port || config.port;

		var loadFeed = (function() {
			if (_feedLoading) return;
			_feedLoading = true;
			fs.readFile('./frontend/feed.html', { encoding: 'utf8' }, (function(err, feed) {
				_feedLoading = false;
				if (err)
					return console.log((new Date()).toLocaleTimeString() + ' - feed.html failed to load', err);
				this.feed = feed
					.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
					.replace(/\{\{HOSTURL\}\}/g, config.url);
				console.log((new Date()).toLocaleTimeString() + ' - feed.html loaded');
			}).bind(this));
		}).bind(this);
		loadFeed();

		var loadSecTest = (function() {
			if (_secTestLoading) return;
			_secTestLoading = true;
			fs.readFile('./frontend/sec-test.html', { encoding: 'utf8' }, (function(err, secTest) {
				_secTestLoading = false;
				if (err)
					return console.log((new Date()).toLocaleTimeString() + ' - sec-test.html failed to load', err);
				this.secTest = secTest
					.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
					.replace(/\{\{HOSTURL\}\}/g, config.url);
				console.log((new Date()).toLocaleTimeString() + ' - sec-test.html loaded');
			}).bind(this));
		}).bind(this);
		loadSecTest();

		if (!_feedWatching)
			_feedWatching = fs.watch(path.normalize('./frontend/feed.html'), { persistent: false }, loadFeed), true;
		if (!_secTestWatching)
			_secTestWatching = fs.watch(path.normalize('./frontend/sec-test.html'), { persistent: false }, loadSecTest), true;
	},
	render: function(tmplName, ctx) {
		var html = module.exports[tmplName];
		for (var k in ctx) {
			html = html.replace(new RegExp('{{'+k+'}}', 'gi'), ctx[k]);
		}
		return html;
	}
};

function ucfirst(str) {
	return str.slice(0,1).toUpperCase() + str.slice(1);
}