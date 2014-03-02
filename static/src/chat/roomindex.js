var links = [];
var naReltypesRegex = /(^|\b)(self|via|up)(\b|$)/g;

function addLink(link) {
	// Strip non-applicable reltypes
	link.rel = link.rel.replace(naReltypesRegex, '');

	// Add to the front of the registry
	links.unshift(link);
}

module.exports = {
	addLink: addLink,
	getLinks: function() { return links; }
};