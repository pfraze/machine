var util = require('../lib/util');
module.exports = function(ctx) {
	return util.merge(
		util.condensable(ctx),
		require('./creative-work.json.js')(ctx),
		{
			__self: 'http://schema.org/Question',
			acceptedAnswer: null,  // Answer - The answer that has been accepted as best, typically on a Question/Answer site. Sites vary in their selection mechanisms, e.g. drawing on community opinion and/or the view of the Question author.
			answerCount: 0,        // Integer - The number of answers this question has received.
			downvoteCount: 0,      // Integer - The number of downvotes this question has received from the community.
			suggestedAnswer: null, // Answer - An answer (possibly one of several, possibly incorrect) to a Question, e.g. on a Question/Answer site, often collected in a QAPage.
			upvoteCount: 0,        // Integer - The number of upvotes this question has received from the community.
		}
	);
};