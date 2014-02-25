module.exports.formatReqForLog = function(req) {
	return {
		path: req.path,
		headers: req.headers,
		body: req.body
	};
};

module.exports.logQuery = function(q, values) {
	values.forEach(function(v, i) {
		q = q.replace('$'+(i+1), v);
	});
	console.log(q);
};

var lbracket_regex = /</g;
var rbracket_regex = />/g;
module.exports.makeSafe = function(str, opts) {
	opts = opts || {};
	str = ''+str;
	str = str.replace(lbracket_regex, '&lt;').replace(rbracket_regex, '&gt;');
	if (opts.noQuotes) {
		str = str.replace(/"/g, '&quot;');
	}
	return str;
};

var nonalpha_regex = /\W/g;
module.exports.stripNonAlpha = function(str) {
	return str.replace(nonalpha_regex, '');
};

var mosql_disallowedchars_regex = /[^-\w>#\.:]|--/;
module.exports.isColumnSafe = function(column) {
	switch (column) {
		case '$or':
		case '$equals':
		case '$ne':
		case '$gt':
		case '$gte':
		case '$lt':
		case '$lte':
		case '$null':
		case '$notNull':
			return true;

		default:
			if (!mosql_disallowedchars_regex.test(column)) {
				return true;
			}
	}
	return false;
};

module.exports.isColumnStandard = function(column) {
	switch (column) {
		case 'id':
		case 'created_at':
		case 'edited_at':
			return true;
	}
	return false;
};

module.exports.prefixNonstandardColumn = function(column) {
	var column2;
	if (column.charAt(0) !== '$' && !module.exports.isColumnStandard(column)) {
		// Add prefix
		if (column.indexOf('>') === -1) // no json dereferences?
			column2 = 'doc->>'+column;
		else
			column2 = 'doc->'+column;

		// Cast? Pre-quote so mongo-sql wont handle (it behaves incorrectly when json derefs are used)
		// (by default, you'll get "gui_jsons"."doc"->>'foo::integer' when you need "gui_jsons"."doc"->>'foo'::integer)
		if (column2.indexOf('::') !== -1) {
			column2 = '("gui_jsons".'+column2.replace(/(->>?)([^:->]*)(::)/, function(v, a, b, c) { return a+'\''+b+'\')'+c; });
		}
	} else {
		column2 = column;
	}
	return column2;
};

module.exports.sanitizeMosql = function(obj, depth) {
	var obj2 = {}, k2;
	depth = depth || 0;

	// Limit to 3 deep, 5 wide
	if (depth >= 3 || Object.keys(obj).length > 5) {
		return obj2;
	}

	// Iterate attributes
	for (var k in obj) {
		// Only allow accepted key names (values will be sanitized with postgres parameterization)
		if (!module.exports.isColumnSafe(k)) {
			throw "Invalid column name: "+k;
		}

		// Recurse on objects
		if (typeof obj[k] == 'object') {
			obj[k] = module.exports.sanitizeMosql(obj[k], depth + 1);
		}

		// Reassign keys
		k2 = module.exports.prefixNonstandardColumn(k);
		obj2[k2] = obj[k];
	}

	return obj2;
};

(function() {
	// based on https://github.com/dpweb/time-ago
	var milliseconds_ina = [
		['second', 1000],
		['minute', 60*1000],
		['hour', 60*1000*60],
		['day', 24*60*1000*60],
		['week', 7*24*60*1000*60],
		['month', 30*24*60*1000*60],
		['year', 365*24*60*1000*6]
	];

	var format = function(unit, amt) {
		return amt + ' ' + unit + ((amt > 1) ? 's' : '') + ' ago';
	};

	module.exports.timeago = function(v){
		var time_delta = new Date().getTime() - new Date(v).getTime();

		var unit, duration;
		var last_unit = 'millisecond', last_duration = 1;
		for (var i=0; i < milliseconds_ina.length; i++) {
			unit = milliseconds_ina[i][0];
			duration = milliseconds_ina[i][1];

			if (time_delta < duration) {
				return format(last_unit, Math.round(time_delta/last_duration));
			}

			last_unit = unit;
			last_duration = duration;
		}

		return format(last_unit, Math.round(time_delta/last_duration));
	};
})();