var _index_watching     = false, _index_loading     = false;
var _feed_watching      = false, _feed_loading      = false;
var _sec_test_watching  = false, _sec_test_loading  = false;

var fs = require('fs');
var path = require('path');

module.exports = {
	index: '',
	feed: '',
	secTest: '',
	load: function(config) {
		var port = config.downstream_port || config.port;

		var loadIndex = (function() {
			if (_feed_loading) return;
			_feed_loading = true;
			fs.readFile('./frontend/index.html', { encoding: 'utf8' }, (function(err, index) {
				_feed_loading = false;
				if (err)
					return console.log((new Date()).toLocaleTimeString() + ' - index.html failed to load', err);
				this.index = index
					.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
					.replace(/\{\{HOSTURL\}\}/g, config.url);
				console.log((new Date()).toLocaleTimeString() + ' - index.html loaded');
			}).bind(this));
		}).bind(this);
		loadIndex();

		var loadFeed = (function() {
			if (_feed_loading) return;
			_feed_loading = true;
			fs.readFile('./frontend/feed.html', { encoding: 'utf8' }, (function(err, feed) {
				_feed_loading = false;
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
			if (_sec_test_loading) return;
			_sec_test_loading = true;
			fs.readFile('./frontend/sec-test.html', { encoding: 'utf8' }, (function(err, secTest) {
				_sec_test_loading = false;
				if (err)
					return console.log((new Date()).toLocaleTimeString() + ' - sec-test.html failed to load', err);
				this.secTest = secTest
					.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
					.replace(/\{\{HOSTURL\}\}/g, config.url);
				console.log((new Date()).toLocaleTimeString() + ' - sec-test.html loaded');
			}).bind(this));
		}).bind(this);
		loadSecTest();

		if (!_index_watching)
			_index_watching = fs.watch(path.normalize('./frontend/index.html'), { persistent: false }, loadIndex), true;
		if (!_feed_watching)
			_feed_watching = fs.watch(path.normalize('./frontend/feed.html'), { persistent: false }, loadFeed), true;
		if (!_sec_test_watching)
			_sec_test_watching = fs.watch(path.normalize('./frontend/sec-test.html'), { persistent: false }, loadSecTest), true;
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