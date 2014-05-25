// Policies for HTML rendered from untrusted sources
var policies = {

	// HTML Policies
	// =============
	allowedHtmlTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
		// metadata
		'style',

		// sections
		'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
		'header', 'footer', 'section', 'nav', 'article', 'aside', 'address',

		// grouping
		'hr', 'p', 'pre', 'blockquote',
		'ol', 'ul', 'li', 'dl', 'dt', 'dd',
		'figure', 'figcaption',
		'div',

		// text-level semantics
		'a', 'em', 'strong', 'small', 's',
		'cite', 'q', 'dfn', 'abbr',
		'data', 'time', 'code', 'var', 'samp', 'kbd',
		'sub', 'sup', 'i', 'b', 'u',
		'mark', 'ruby', 'rt', 'rp', 'bdi', 'bdo',
		'span', 'br', 'wbr',

		// edits
		'ins', 'del',

		// embedded content
		'img', 'object', 'video', 'audio', 'source', 'track',

		// tabular data
		'table', 'caption', 'colgroup', 'col',
		'tbody', 'thead', 'tfoot',
		'tr', 'td', 'th',

		// forms
		'form', 'fieldset', 'legend',
		'label', 'input', 'button', 'select',
		'datalist', 'optgroup', 'option',
		'textarea', 'keygen', 'output',
		'progress', 'meter',

		// crummy old tags that really shouldnt be used anymore
		'center'
	],
	disallowedClasses: [
		// Bootstrap
		// because of position: fixed or position: absolute
		'affix', 'dropdown-backdrop', 'navbar-fixed-top', 'navbar-fixed-bottom',
		'modal', 'modal-backdrop',
		'carousel-control', 'carousel-indicators',
		'next', 'prev', // these are from .carousel-inner > .next

		// Custom
		'addlink-panel', 'config-panel'
	],
	urlsPolicy: function(url) { return url; }, // allow all (for now)
	tokensPolicy: function(token) {
		if (policies.disallowedClasses.indexOf(token) == -1) {
			return token;
		}
		console.warn('Removed disallowed id/class:', token);
	},
	htmlTagPolicy: function(tagName, attribs) {
		if (policies.allowedHtmlTags.indexOf(tagName) !== -1) {
			return {
				attribs: require('./security').sanitizeHtmlAttribs(
					tagName,
					attribs,
					policies.urlsPolicy,
					policies.tokensPolicy,
					policies.cssPropertyPolicy,
					policies.cssValuePolicy
				)
			};
		} else {
			console.warn('Removed disallowed tag:', tagName);
		}
	},

	// CSS Policies
	// ============
	cssPropertyPolicy: function(decl) {
		var is = function(str) { return decl.property == str; };
		var starts = function(str) { return decl.property.indexOf(str) === 0; };
		var contains = function(str) { return decl.property.indexOf(str) !== -1; };

		if (contains('@')) return false;
		if (starts('background')) return true;
		if (starts('border')) return true;
		if (is('box-shadow')) return true;
		if (is('clear')) return true;
		if (is('color')) return true;
		if (is('content')) return true;
		if (is('display')) return true;
		if (is('direction')) return true;
		if (is('display')) return true;
		if (is('float')) return true;
		if (starts('font')) return true;
		if (is('height')) return true;
		if (is('letter-spacing')) return true;
		if (is('line-height')) return true;
		if (starts('list-style')) return true;
		if (starts('margin')) return true;
		if (starts('max-')) return true;
		if (starts('min-')) return true;
		if (is('opacity')) return true;
		if (starts('outline')) return true;
		if (starts('overflow')) return true;
		if (starts('padding')) return true;
		if (is('pointer-events')) return true;
		if (is('resize')) return true;
		if (is('table-layout')) return true;
		if (starts('text-')) return true;
		if (is('vertical-align')) return true;
		if (is('visibility')) return true;
		if (is('white-space')) return true;
		if (is('width')) return true;
		if (starts('word-')) return true;

		return false;
	},
	cssValuePolicy: function(decl) {
		var is = function(str) { return decl.value == str; };
		var starts = function(str) { return decl.value.indexOf(str) === 0; };
		var contains = function(str) { return decl.value.indexOf(str) !== -1; };

		if (contains('url')) return false;

		return true;
	}
};
module.exports = policies;