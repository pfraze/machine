var fs = require('fs');
module.exports = {
	motd: '',
	guipage: '',
	guipart_editorform_owner: '',
	guipart_editorform_anon: '',
	load: function(config) {
		var port = config.downstream_port || config.port;
		this.motd = fs.readFileSync('./motd.html').toString()
			.replace(/\{HOSTLABEL\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{HOSTDOMAIN\}/g, config.url);
		this.guipage = fs.readFileSync('./static/guipage.html').toString()
			.replace(/\{HOSTLABEL\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{HOSTDOMAIN\}/g, config.url);
		this.guipart_editorform_owner = fs.readFileSync('./static/guipart_editorform_owner.html').toString()
			.replace(/\{HOSTLABEL\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{HOSTDOMAIN\}/g, config.url);
		this.guipart_editorform_anon = fs.readFileSync('./static/guipart_editorform_anon.html').toString()
			.replace(/\{HOSTLABEL\}/g, ucfirst(config.hostname)+((port != 80 && port != 443)?':'+port:''))
			.replace(/\{HOSTDOMAIN\}/g, config.url);
	}
};

function ucfirst(str) {
	return str.slice(0,1).toUpperCase() + str.slice(1);
}