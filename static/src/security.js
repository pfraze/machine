// Items rendered in the directory by plugins
var renderedItem = {
	allowedTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
		// metadata
		'link',

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
		'img', 'video', 'audio', 'source', 'track',

		// tabular data
		'table', 'caption', 'colgroup', 'col',
		'tbody', 'thead', 'tfoot',
		'tr', 'td', 'th',

		// forms
		'form', 'fieldset', 'legend',
		'label', 'input', 'button', 'select',
		'datalist', 'optgroup', 'option',
		'textarea', 'keygen', 'output',
		'progress', 'meter'
	],
	disallowedClasses: [
		// Boostrap
		// because of position: fixed or position: absolute
		'affix', 'dropdown-backdrop', 'navbar-fixed-top', 'navbar-fixed-bottom',
		'modal', 'modal-backdrop',
		'carousel-control', 'carousel-indicators',
		'next', 'prev', // these are from .carousel-inner > .next

		// Custom
		'addlink-panel', 'config-panel'
	],

	urlsPolicy: function(url) { return url; }, // allow all
	tokensPolicy: function(token) {
		if (renderedItem.disallowedClasses.indexOf(token) == -1) {
			return token;
		}
		console.warn('Removed disallowed id/class:', token);
	},
	policy: function(tagName, attribs) {
		var ri = renderedItem;
		if (ri.allowedTags.indexOf(tagName) !== -1) {
			return {attribs: window.html.sanitizeAttribs(tagName, attribs, ri.urlsPolicy, ri.tokensPolicy)};
		} else {
			console.warn('Removed disallowed tag:', tagName);
		}
	}
};

module.exports = {
	sanitizeRenderedItem: function(html) {
		return window.html.sanitizeWithPolicy(html, renderedItem.policy);
	}
};