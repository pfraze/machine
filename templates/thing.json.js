var util = require('../lib/util');
module.exports = function(ctx) {
	return util.merge(
		util.condensable(ctx),
		{
			__self: 'http://schema.org/Thing',
			additionalType: null, // URL - An additional type for the item, typically used for adding more specific types from external vocabularies in microdata syntax. This is a relationship between something and a class that the thing is in. In RDFa syntax, it is better to use the native RDFa syntax - the 'typeof' attribute - for multiple types. Schema.org tools may have only weaker understanding of extra types, in particular those defined externally.
			alternateName: null,  // Text - An alias for the item.
			description: null,    // Text - A short description of the item.
			image: null,          // URL - URL of an image of the item.
			name: null,           // Text - The name of the item.
			sameAs: null,         // URL - URL of a reference Web page that unambiguously indicates the item's identity. E.g. the URL of the item's Wikipedia page, Freebase page, or official website.
			url: null,            // URL - URL of the item.
		}
	);
};