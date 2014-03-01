var fs = require('fs');
module.exports = {
	index: '',
	directory: '',
	directory_list_partial: '',
	directory_link_list_partial: '',

	room: '',

	test_directories: '',
	load: function(config) {
		var port = config.downstream_port || config.port;
		this.index = fs.readFileSync('./static/index.html').toString()
			.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{\{HOSTURL\}\}/g, config.url);
		this.directory = fs.readFileSync('./static/directory.html').toString()
			.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{\{HOSTURL\}\}/g, config.url);
		this.room = fs.readFileSync('./static/room.html').toString()
			.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{\{HOSTURL\}\}/g, config.url);
		this.directory_list_partial = fs.readFileSync('./static/directory_list_partial.html').toString();
		this.directory_link_list_partial = fs.readFileSync('./static/directory_link_list_partial.html').toString();
		this.test_directories = fs.readFileSync('./static/test/directories.html').toString();
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