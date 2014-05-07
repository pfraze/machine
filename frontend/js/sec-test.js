(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var sec = require('../security');

// Load preset styles
var presetStyles = document.getElementById('preset-styles').innerHTML;
$(document.body).append('<style>'+presetStyles+'</style>');

// Load and sanitize test styles
var testStyles = document.getElementById('test-styles').innerHTML;
testStyles = sec.sanitizeStyles(testStyles, '#sandbox');
document.getElementById('sanitized-styles').innerHTML = testStyles;
$(document.body).append('<style>'+testStyles+'</style>');
},{"../security":2}],2:[function(require,module,exports){
module.exports = {
	sanitizeRendererView: function(html) {
		return window.html.sanitizeWithPolicy(html, rendererView.policy);
	},

	sanitizeStyles: function(styles, selectorPrefix) {
		try {
			var ast = rework.parse(styles);
			removeUnsafeRules(ast);
			prefixSelectors(ast, selectorPrefix);
			return rework.stringify(ast);
		} catch(e) {
			return '';
		}
	}
};

// Views rendered by plugins
var rendererView = {
	allowedTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
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
		if (rendererView.disallowedClasses.indexOf(token) == -1) {
			return token;
		}
		console.warn('Removed disallowed id/class:', token);
	},
	policy: function(tagName, attribs) {
		var rV = rendererView;
		if (rV.allowedTags.indexOf(tagName) !== -1) {
			return {attribs: window.html.sanitizeAttribs(tagName, attribs, rV.urlsPolicy, rV.tokensPolicy)};
		} else {
			console.warn('Removed disallowed tag:', tagName);
		}
	}
};


function prefixSelectors(ast, prefix) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.selectors = rule.selectors.map(function(sel) { return prefix + ' ' + sel; });
	});
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference
function removeUnsafeRules(ast) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.declarations = rule.declarations.filter(function(decl) {
			if (!isPropertySafe(decl)) {
				console.warn('Stripping',decl,'due to unsafe property');
				return false;
			}
			if (!isValueSafe(decl)) {
				console.warn('Stripping',decl,'due to unsafe value');
				return false;
			}
			return true;
		});
	});
}

function isPropertySafe(decl) {
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
}

function isValueSafe(decl) {
	var is = function(str) { return decl.value == str; };
	var starts = function(str) { return decl.value.indexOf(str) === 0; };
	var contains = function(str) { return decl.value.indexOf(str) !== -1; };

	if (contains('url')) return false;

	return true;
}
},{}]},{},[1])