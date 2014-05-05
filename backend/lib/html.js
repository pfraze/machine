
var fs = require('fs');
module.exports = {
	feed: '',
	load: function(config) {
		var port = config.downstream_port || config.port;
		this.feed = fs.readFileSync('./frontend/feed.html').toString()
			.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{\{HOSTURL\}\}/g, config.url);
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