module.exports = { setup: setup };
function setup() {
	web.httpHeaders.register('pragma',
		function serialize_pragma(obj) {
			var str, strs = [];
			for (var k in obj) {
				str = k;
				if (obj[k] !== true) {
					str += '="'+obj[k]+'"';
				}
				strs.push(str);
			}
			return strs.join(' ');
		},
		function parse_pragma(str) {
			//             "key"     "="      \""val\""    "val"
			//         -------------- -       ---------   -------
			var re = /([\-a-z0-9_\.]+)=?(?:(?:"([^"]+)")|([^;\s]+))?/g;
			var match, obj = {};
			while ((match = re.exec(str))) {
				obj[match[1]] = match[2] || match[3];
			}
			return obj;
		}
	);
}