;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var sec = require('../security');
var secPol = require('../security-policies');

// Load preset styles
var presetStyles = document.getElementById('preset-styles').innerHTML;
$(document.body).append('<style>'+presetStyles+'</style>');

// Load and sanitize test styles
var testStyles = document.getElementById('test-styles').innerHTML;
testStyles = sec.sanitizeStyles('#sandbox', secPol.cssPropertyPolicy, secPol.cssValuePolicy, testStyles);
document.getElementById('sanitized-styles').innerHTML = testStyles;
$(document.body).append('<style>'+testStyles+'</style>');
},{"../security":3,"../security-policies":2}],2:[function(require,module,exports){
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
},{"./security":3}],3:[function(require,module,exports){
var policies = require('./security-policies');

module.exports = {
	sanitizeHtml: function(html, selectorPrefix) {
		var sanitize = makeHtmlSanitizer(
			policies.htmlTagPolicy,
			sanitizeStyles.bind(
				null,
				selectorPrefix,
				policies.cssPropertyPolicy,
				policies.cssValuePolicy
			)
		);

		var outputArray = [];
		sanitize(html, outputArray);
		return outputArray.join('');
	},
	sanitizeHtmlAttribs: sanitizeHtmlAttribs,
	sanitizeStyles: sanitizeStyles
};

// HTML sanitation
// ===============
var ampRe = /&/g;
var looseAmpRe = /&([^a-z#]|#(?:[^0-9x]|x(?:[^0-9a-f]|$)|$)|$)/gi;
var ltRe = /[<]/g;
var gtRe = />/g;
var quotRe = /\"/g;
function escapeAttrib(s) {
	return ('' + s).replace(ampRe, '&amp;').replace(ltRe, '&lt;')
		.replace(gtRe, '&gt;').replace(quotRe, '&#34;');
}

// Returns a function that strips unsafe tags and attributes from html.
// - `tagPolicy`: function(string, [string]) -> [string]
//   - A function that takes (tagName, attribs[]), where
//     - `tagName` is a key in html4.ELEMENTS
//     - `attribs` is an array of alternating attribute names and values.
//   - Should return a record (as follows) or null to delete the element.
//   - Can modify the attribs array
//   - Returned record:
//     - `attribs`: (required) Sanitized attributes array.
//     - `tagName`: Replacement tag name.
function makeHtmlSanitizer(tagPolicy, styleSanitizer) {
	var lastTag;
	var stack;
	var ignoring;
	var emit = function (text, out) {
		if (!ignoring) {
			if (lastTag == 'style' && styleSanitizer) {
				text = styleSanitizer(text);
			}
			out.push(text);
		}
	};
	return window.html.makeSaxParser({
		'startDoc': function(_) {
			stack = [];
			ignoring = false;
		},
		'startTag': function(tagNameOrig, attribs, out) {
			if (ignoring) { return; }
			if (!window.html4.ELEMENTS.hasOwnProperty(tagNameOrig)) { return; }
			var eflagsOrig = window.html4.ELEMENTS[tagNameOrig];
			if (eflagsOrig & window.html4.eflags['FOLDABLE']) {
				return;
			}

			var decision = tagPolicy(tagNameOrig, attribs);
			if (!decision) {
				ignoring = !(eflagsOrig & window.html4.eflags['EMPTY']);
				return;
			} else if (typeof decision !== 'object') {
				throw new Error('tagPolicy did not return object (old API?)');
			}
			if ('attribs' in decision) {
				attribs = decision['attribs'];
			} else {
				throw new Error('tagPolicy gave no attribs');
			}
			var eflagsRep;
			var tagNameRep;
			if ('tagName' in decision) {
				tagNameRep = decision['tagName'];
				eflagsRep = window.html4.ELEMENTS[tagNameRep];
			} else {
				tagNameRep = tagNameOrig;
				eflagsRep = eflagsOrig;
			}

			// If this is an optional-end-tag element and either this element or its
			// previous like sibling was rewritten, then insert a close tag to
			// preserve structure.
			if (eflagsOrig & window.html4.eflags['OPTIONAL_ENDTAG']) {
				var onStack = stack[stack.length - 1];
				if (onStack && onStack.orig === tagNameOrig &&
					(onStack.rep !== tagNameRep || tagNameOrig !== tagNameRep)) {
					out.push('<\/', onStack.rep, '>');
				}
			}

			if (!(eflagsOrig & window.html4.eflags['EMPTY'])) {
				stack.push({orig: tagNameOrig, rep: tagNameRep});
			}

			out.push('<', tagNameRep);
			for (var i = 0, n = attribs.length; i < n; i += 2) {
				var attribName = attribs[i],
				value = attribs[i + 1];
				if (value !== null && value !== void 0) {
					out.push(' ', attribName, '="', escapeAttrib(value), '"');
				}
			}
			out.push('>');

			lastTag = tagNameRep;

			if ((eflagsOrig & html4.eflags['EMPTY'])
				&& !(eflagsRep & html4.eflags['EMPTY'])) {
				// replacement is non-empty, synthesize end tag
				out.push('<\/', tagNameRep, '>');
			}
		},
		'endTag': function(tagName, out) {
			if (ignoring) {
				ignoring = false;
				return;
			}
			if (!window.html4.ELEMENTS.hasOwnProperty(tagName)) { return; }
			var eflags = window.html4.ELEMENTS[tagName];
			if (!(eflags & (window.html4.eflags['EMPTY'] | window.html4.eflags['FOLDABLE']))) {
				var index;
				if (eflags & window.html4.eflags['OPTIONAL_ENDTAG']) {
					for (index = stack.length; --index >= 0;) {
						var stackElOrigTag = stack[index].orig;
						if (stackElOrigTag === tagName) { break; }
						if (!(window.html4.ELEMENTS[stackElOrigTag] &
							  window.html4.eflags['OPTIONAL_ENDTAG'])) {
							// Don't pop non optional end tags looking for a match.
							return;
						}
					}
				} else {
					for (index = stack.length; --index >= 0;) {
						if (stack[index].orig === tagName) { break; }
					}
				}
				if (index < 0) { return; }  // Not opened.
				for (var i = stack.length; --i > index;) {
					var stackElRepTag = stack[i].rep;
					if (!(window.html4.ELEMENTS[stackElRepTag] &
						  window.html4.eflags['OPTIONAL_ENDTAG'])) {
						out.push('<\/', stackElRepTag, '>');
					}
				}
				if (index < stack.length) {
					tagName = stack[index].rep;
				}
				stack.length = index;
				out.push('<\/', tagName, '>');
			}
		},
		'pcdata': emit,
		'rcdata': emit,
		'cdata': emit,
		'endDoc': function(out) {
			for (; stack.length; stack.length--) {
				out.push('<\/', stack[stack.length - 1].rep, '>');
			}
		}
	});
}

// Sanitizers attributes on an HTML tag.
// - tagName: string, the HTML tag name in lowercase.
// - attribs: [string], an array of alternating names and values
// - uriPolicy: function(string) -> string, a transform to apply to URI attributes.
//   - Can return a new string value, or null to delete the attribute.
//   - If unspecified, URI attributes are deleted.
// - tokenPolicy: function(string) -> string, A transform to apply to attributes.
//   - Applied to names, IDs, and classes.
//   - Can return a new string value, or null to delete the attribute.
//   - If unspecified, these attributes are kept unchanged.
// - `cssPropertyPolicy`: function(decl) -> bool, return false to strip the declaration
// - `cssValuePolicy`: function(dec;) -> bool, return false to strip the declaration
// - returns [string], The sanitized attributes as a list of alternating names and values,
//                     where a null value means to omit the attribute.
function sanitizeHtmlAttribs(tagName, attribs, uriPolicy, tokenPolicy, cssPropertyPolicy, cssValuePolicy) {
	for (var i = 0; i < attribs.length; i += 2) {
		var attribName = attribs[i];
		var value = attribs[i + 1];
		var oldValue = value;

		// Look up the attribute key
		var atype = null;
		var attribKey = tagName + '::' + attribName;
		if (!html4.ATTRIBS.hasOwnProperty(attribKey)) {
			attribKey = '*::' + attribName;
			if (!html4.ATTRIBS.hasOwnProperty(attribKey)) {
				attribKey = null;
			}
		}

		// Look up attribute type by key
		if (attribKey) {
			atype = html4.ATTRIBS[attribKey];
		} else {
			// Type not known, scrub
			attribs[i + 1] = null;
			console.warn('Removed disallowed attribute', attribName);
			continue;
		}

		// Sanitize by type
		switch (atype) {
				// sanitize with style policy
			case html4.atype['STYLE']:
				value = '* {\n'+value+'\n}';
				value = sanitizeStyles(null, cssPropertyPolicy, cssValuePolicy, value);
				value = value.slice(3,-1);
				break;

				// sanitize with token policy
			case html4.atype['GLOBAL_NAME']:
			case html4.atype['LOCAL_NAME']:
			case html4.atype['CLASSES']:
				value = tokenPolicy ? tokenPolicy(value) : value;
				break;

				// sanitize with uri policy
			case html4.atype['URI']:
				value = uriPolicy(value);
				break;

				// allowed
			case html4.atype['FRAME_TARGET']:
				break;

				// disallowed
			case html4.atype['NONE']:
			case html4.atype['SCRIPT']:
			case html4.atype['ID']:
			case html4.atype['IDREF']:
			case html4.atype['IDREFS']:
			default:
				console.warn('Removed disallowed attribute', attribName);
				value = null;
				break;
		}
		attribs[i + 1] = value;
	}
	return attribs;
}

// CSS Sanitation
// ==============

// Scopes all styles under a selector prefix and strips rules deemed unsafe
// - `selectorPrefix`: optional string, selector to scope the output selectors with
// - `propertyPolicy`: function(decl) -> bool, return false to strip the declaration
// - `valuePolicy`: function(decl) -> bool, return false to strip the declaration
// - `styles`: string, the styles to sanitize
// - returns string, the sanitized styles
function sanitizeStyles(selectorPrefix, propertyPolicy, valuePolicy, styles) {
	try {
		var ast = rework.parse(styles);
		removeUnsafeRules(ast, propertyPolicy, valuePolicy);
		if (selectorPrefix) {
			prefixSelectors(ast, selectorPrefix);
		}
		return rework.stringify(ast);
	} catch(e) {
		return '';
	}
}

function prefixSelectors(ast, prefix) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.selectors = rule.selectors.map(function(sel) { return prefix + ' ' + sel; });
	});
}

// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference
function removeUnsafeRules(ast, propertyPolicy, valuePolicy) {
	ast.stylesheet.rules.forEach(function(rule) {
		rule.declarations = rule.declarations.filter(function(decl) {
			var description = '"'+decl.property+': '+decl.value+'"';
			if (!propertyPolicy(decl)) {
				console.warn('Removed disallowed style', description, 'due to unsafe property', '('+decl.property+')');
				return false;
			}
			if (!valuePolicy(decl)) {
				console.warn('Removed disallowed style', description, 'due to unsafe value', '('+decl.value+')');
				return false;
			}
			return true;
		});
	});
}
},{"./security-policies":2}]},{},[1])
;