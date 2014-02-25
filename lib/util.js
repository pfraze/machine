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

module.exports.serializeLinkObject = function (link) {
	var linkParts = ['<'+link.href+'>'];
	for (var attr in link) {
		if (attr == 'href') {
			continue;
		}
		if (typeof link[attr] == 'boolean') {
			linkParts.push(attr);
		} else {
			linkParts.push(attr+'="'+link[attr]+'"');
		}
	}
	return linkParts.join('; ');
};

(function() {
	// http://www.beausmith.com/mt/2009/07/dirify-function-in-javascript.php
	module.exports.dirify = function (s,d) {
		if (!d)
			d = "-";
		s = s.replace(/<[^>]+>/g, '');
		for (var p in dirify_table)
			if (s.indexOf(p) != -1)
				s = s.replace(new RegExp(p, "g"), dirify_table[p]);
		s = s.toLowerCase();
		s = s.replace(/&[^;\s]+;/g, '');
		s = s.replace(/[^-a-z0-9_ ]/g, '');
		s = s.replace(/\s+/g, '_');
		s = s.replace(/_+$/, '');
		s = s.replace(/_+/g, d);
		return s;
	};
	var dirify_table = {
		"\u0026": 'and',  // ampersand
		"\u00C0": 'A',    // A`
		"\u00E0": 'a',    // a`
		"\u00C1": 'A',    // A'
		"\u00E1": 'a',    // a'
		"\u00C2": 'A',    // A^
		"\u00E2": 'a',    // a^
		"\u0102": 'A',    // latin capital letter a with breve
		"\u0103": 'a',    // latin small letter a with breve
		"\u00C6": 'AE',   // latin capital letter AE
		"\u00E6": 'ae',   // latin small letter ae
		"\u00C5": 'A',    // latin capital letter a with ring above
		"\u00E5": 'a',    // latin small letter a with ring above
		"\u0100": 'A',    // latin capital letter a with macron
		"\u0101": 'a',    // latin small letter a with macron
		"\u0104": 'A',    // latin capital letter a with ogonek
		"\u0105": 'a',    // latin small letter a with ogonek
		"\u00C4": 'A',    // A:
		"\u00E4": 'a',    // a:
		"\u00C3": 'A',    // A~
		"\u00E3": 'a',    // a~
		"\u00C8": 'E',    // E`
		"\u00E8": 'e',    // e`
		"\u00C9": 'E',    // E'
		"\u00E9": 'e',    // e'
		"\u00CA": 'E',    // E^
		"\u00EA": 'e',    // e^
		"\u00CB": 'E',    // E:
		"\u00EB": 'e',    // e:
		"\u0112": 'E',    // latin capital letter e with macron
		"\u0113": 'e',    // latin small letter e with macron
		"\u0118": 'E',    // latin capital letter e with ogonek
		"\u0119": 'e',    // latin small letter e with ogonek
		"\u011A": 'E',    // latin capital letter e with caron
		"\u011B": 'e',    // latin small letter e with caron
		"\u0114": 'E',    // latin capital letter e with breve
		"\u0115": 'e',    // latin small letter e with breve
		"\u0116": 'E',    // latin capital letter e with dot above
		"\u0117": 'e',    // latin small letter e with dot above
		"\u00CC": 'I',    // I`
		"\u00EC": 'i',    // i`
		"\u00CD": 'I',    // I'
		"\u00ED": 'i',    // i'
		"\u00CE": 'I',    // I^
		"\u00EE": 'i',    // i^
		"\u00CF": 'I',    // I:
		"\u00EF": 'i',    // i:
		"\u012A": 'I',    // latin capital letter i with macron
		"\u012B": 'i',    // latin small letter i with macron
		"\u0128": 'I',    // latin capital letter i with tilde
		"\u0129": 'i',    // latin small letter i with tilde
		"\u012C": 'I',    // latin capital letter i with breve
		"\u012D": 'i',    // latin small letter i with breve
		"\u012E": 'I',    // latin capital letter i with ogonek
		"\u012F": 'i',    // latin small letter i with ogonek
		"\u0130": 'I',    // latin capital letter with dot above
		"\u0131": 'i',    // latin small letter dotless i
		"\u0132": 'IJ',   // latin capital ligature ij
		"\u0133": 'ij',   // latin small ligature ij
		"\u0134": 'J',    // latin capital letter j with circumflex
		"\u0135": 'j',    // latin small letter j with circumflex
		"\u0136": 'K',    // latin capital letter k with cedilla
		"\u0137": 'k',    // latin small letter k with cedilla
		"\u0138": 'k',    // latin small letter kra
		"\u0141": 'L',    // latin capital letter l with stroke
		"\u0142": 'l',    // latin small letter l with stroke
		"\u013D": 'L',    // latin capital letter l with caron
		"\u013E": 'l',    // latin small letter l with caron
		"\u0139": 'L',    // latin capital letter l with acute
		"\u013A": 'l',    // latin small letter l with acute
		"\u013B": 'L',    // latin capital letter l with cedilla
		"\u013C": 'l',    // latin small letter l with cedilla
		"\u013F": 'l',    // latin capital letter l with middle dot
		"\u0140": 'l',    // latin small letter l with middle dot
		"\u00D2": 'O',    // O`
		"\u00F2": 'o',    // o`
		"\u00D3": 'O',    // O'
		"\u00F3": 'o',    // o'
		"\u00D4": 'O',    // O^
		"\u00F4": 'o',    // o^
		"\u00D6": 'O',    // O:
		"\u00F6": 'o',    // o:
		"\u00D5": 'O',    // O~
		"\u00F5": 'o',    // o~
		"\u00D8": 'O',    // O/
		"\u00F8": 'o',    // o/
		"\u014C": 'O',    // latin capital letter o with macron
		"\u014D": 'o',    // latin small letter o with macron
		"\u0150": 'O',    // latin capital letter o with double acute
		"\u0151": 'o',    // latin small letter o with double acute
		"\u014E": 'O',    // latin capital letter o with breve
		"\u014F": 'o',    // latin small letter o with breve
		"\u0152": 'OE',   // latin capital ligature oe
		"\u0153": 'oe',   // latin small ligature oe
		"\u0154": 'R',    // latin capital letter r with acute
		"\u0155": 'r',    // latin small letter r with acute
		"\u0158": 'R',    // latin capital letter r with caron
		"\u0159": 'r',    // latin small letter r with caron
		"\u0156": 'R',    // latin capital letter r with cedilla
		"\u0157": 'r',    // latin small letter r with cedilla
		"\u00D9": 'U',    // U`
		"\u00F9": 'u',    // u`
		"\u00DA": 'U',    // U'
		"\u00FA": 'u',    // u'
		"\u00DB": 'U',    // U^
		"\u00FB": 'u',    // u^
		"\u00DC": 'U',    // U:
		"\u00FC": 'u',    // u:
		"\u016A": 'U',    // latin capital letter u with macron
		"\u016B": 'u',    // latin small letter u with macron
		"\u016E": 'U',    // latin capital letter u with ring above
		"\u016F": 'u',    // latin small letter u with ring above
		"\u0170": 'U',    // latin capital letter u with double acute
		"\u0171": 'u',    // latin small letter u with double acute
		"\u016C": 'U',    // latin capital letter u with breve
		"\u016D": 'u',    // latin small letter u with breve
		"\u0168": 'U',    // latin capital letter u with tilde
		"\u0169": 'u',    // latin small letter u with tilde
		"\u0172": 'U',    // latin capital letter u with ogonek
		"\u0173": 'u',    // latin small letter u with ogonek
		"\u00C7": 'C',    // ,C
		"\u00E7": 'c',    // ,c
		"\u0106": 'C',    // latin capital letter c with acute
		"\u0107": 'c',    // latin small letter c with acute
		"\u010C": 'C',    // latin capital letter c with caron
		"\u010D": 'c',    // latin small letter c with caron
		"\u0108": 'C',    // latin capital letter c with circumflex
		"\u0109": 'c',    // latin small letter c with circumflex
		"\u010A": 'C',    // latin capital letter c with dot above
		"\u010B": 'c',    // latin small letter c with dot above
		"\u010E": 'D',    // latin capital letter d with caron
		"\u010F": 'd',    // latin small letter d with caron
		"\u0110": 'D',    // latin capital letter d with stroke
		"\u0111": 'd',    // latin small letter d with stroke
		"\u00D1": 'N',    // N~
		"\u00F1": 'n',    // n~
		"\u0143": 'N',    // latin capital letter n with acute
		"\u0144": 'n',    // latin small letter n with acute
		"\u0147": 'N',    // latin capital letter n with caron
		"\u0148": 'n',    // latin small letter n with caron
		"\u0145": 'N',    // latin capital letter n with cedilla
		"\u0146": 'n',    // latin small letter n with cedilla
		"\u0149": 'n',    // latin small letter n preceded by apostrophe
		"\u014A": 'N',    // latin capital letter eng
		"\u014B": 'n',    // latin small letter eng
		"\u00DF": 'ss',   // double-s
		"\u015A": 'S',    // latin capital letter s with acute
		"\u015B": 's',    // latin small letter s with acute
		"\u0160": 'S',    // latin capital letter s with caron
		"\u0161": 's',    // latin small letter s with caron
		"\u015E": 'S',    // latin capital letter s with cedilla
		"\u015F": 's',    // latin small letter s with cedilla
		"\u015C": 'S',    // latin capital letter s with circumflex
		"\u015D": 's',    // latin small letter s with circumflex
		"\u0218": 'S',    // latin capital letter s with comma below
		"\u0219": 's',    // latin small letter s with comma below
		"\u0164": 'T',    // latin capital letter t with caron
		"\u0165": 't',    // latin small letter t with caron
		"\u0162": 'T',    // latin capital letter t with cedilla
		"\u0163": 't',    // latin small letter t with cedilla
		"\u0166": 'T',    // latin capital letter t with stroke
		"\u0167": 't',    // latin small letter t with stroke
		"\u021A": 'T',    // latin capital letter t with comma below
		"\u021B": 't',    // latin small letter t with comma below
		"\u0192": 'f',    // latin small letter f with hook
		"\u011C": 'G',    // latin capital letter g with circumflex
		"\u011D": 'g',    // latin small letter g with circumflex
		"\u011E": 'G',    // latin capital letter g with breve
		"\u011F": 'g',    // latin small letter g with breve
		"\u0120": 'G',    // latin capital letter g with dot above
		"\u0121": 'g',    // latin small letter g with dot above
		"\u0122": 'G',    // latin capital letter g with cedilla
		"\u0123": 'g',    // latin small letter g with cedilla
		"\u0124": 'H',    // latin capital letter h with circumflex
		"\u0125": 'h',    // latin small letter h with circumflex
		"\u0126": 'H',    // latin capital letter h with stroke
		"\u0127": 'h',    // latin small letter h with stroke
		"\u0174": 'W',    // latin capital letter w with circumflex
		"\u0175": 'w',    // latin small letter w with circumflex
		"\u00DD": 'Y',    // latin capital letter y with acute
		"\u00FD": 'y',    // latin small letter y with acute
		"\u0178": 'Y',    // latin capital letter y with diaeresis
		"\u00FF": 'y',    // latin small letter y with diaeresis
		"\u0176": 'Y',    // latin capital letter y with circumflex
		"\u0177": 'y',    // latin small letter y with circumflex
		"\u017D": 'Z',    // latin capital letter z with caron
		"\u017E": 'z',    // latin small letter z with caron
		"\u017B": 'Z',    // latin capital letter z with dot above
		"\u017C": 'z',    // latin small letter z with dot above
		"\u0179": 'Z',    // latin capital letter z with acute
		"\u017A": 'z'     // latin small letter z with acute
	};
})();