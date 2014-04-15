var util = require('../lib/util');
module.exports = function(ctx) {
	return util.merge(
		util.condensable(ctx),
		{
			__self: 'http://schema.org/Comment',
			downvoteCount: 0, // Integer - The number of downvotes this question has received from the community.
			parentItem: null, // Question - The parent of a question, answer or item in general.
			upvoteCount: 0,   // Integer - The number of upvotes this question has received from the community.
		}
	);
};