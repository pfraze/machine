var _js_compiling = false;
var _js_watching = false;

var fs = require('fs');
var path = require('path');

module.exports = {
	feed: '',
	secTest: '',
	load: function(config) {

		// :TODO: sheez what a pain
		/*fs.watch(path.normalize('./frontend/src/feed'), { persistent: false }, function(eventName) {
			if (eventName == 'change') {
				console.log(arguments);
				return;
				require('child_process').spawn('browserify',
					[
						path.normalize('./frontend/src/feed/main.js'),
						'-o', path.normalize('./frontend/js/feed.js')
					],
					{ stdio: 'inherit' })
					.on('close', report('frontend/js/feed.js'));
			}
		});*/
	}
};

function report(file) {
	return function(code) {
		if (code === 0) {
			console.log(String.fromCharCode(0x2713), file); // checkmark
		} else {
			console.log(String.fromCharCode(0x2620), file); // skull and crossbones
		}
	};
}