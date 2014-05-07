module.exports = {
	sanitizeRendererView: function(html, selectorPrefix) {
        var outputArray = [];
        makeHtmlSanitizer(rendererView.policy, sanitizeStyles.bind(null, selectorPrefix))(html, outputArray);
        return outputArray.join('');
	}
};

// Views rendered by plugins
var rendererView = {
	allowedTags: [ // https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5/HTML5_element_list
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

var ampRe = /&/g;
var looseAmpRe = /&([^a-z#]|#(?:[^0-9x]|x(?:[^0-9a-f]|$)|$)|$)/gi;
var ltRe = /[<]/g;
var gtRe = />/g;
var quotRe = /\"/g;
function escapeAttrib(s) {
    return ('' + s).replace(ampRe, '&amp;').replace(ltRe, '&lt;')
        .replace(gtRe, '&gt;').replace(quotRe, '&#34;');
}

function sanitizeStyles(selectorPrefix, styles) {
	try {
		var ast = rework.parse(styles);
		removeUnsafeRules(ast);
		prefixSelectors(ast, selectorPrefix);
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