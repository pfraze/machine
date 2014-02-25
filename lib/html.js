var fs = require('fs');
module.exports = {
	index: '',
	load: function(config) {
		var port = config.downstream_port || config.port;
		this.index = fs.readFileSync('./static/index.html').toString()
			.replace(/\{\{HOSTLABEL\}\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{\{HOSTURL\}\}/g, config.url);
	}
};

function ucfirst(str) {
	return str.slice(0,1).toUpperCase() + str.slice(1);
}