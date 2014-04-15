var util = require('../lib/util');
module.exports = function(ctx) {
	return util.merge(
		util.condensable(ctx),
		require('./thing.json.js')(ctx),
		{
			__self: 'http://schema.org/CreativeWork',
			about: null,                // Thing - The subject matter of the content.
			accessibilityAPI: null,     // Text - Indicates that the resource is compatible with the referenced accessibility API (WebSchemas wiki lists possible values).
			accessibilityControl: null, // Text - Identifies input methods that are sufficient to fully control the described resource (WebSchemas wiki lists possible values).
			accessibilityFeature: null, // Text - Content features of the resource, such as accessible media, alternatives and supported enhancements for accessibility (WebSchemas wiki lists possible values).
			accessibilityHazard: null,  // Text - A characteristic of the described resource that is physiologically dangerous to some users. Related to WCAG 2.0 guideline 2.3. (WebSchemas wiki lists possible values)
			accountablePerson: null,    // Person - Specifies the Person that is legally accountable for the CreativeWork.
			aggregateRating: null,      // AggregateRating - The overall rating, based on a collection of reviews or ratings, of the item.
			alternativeHeadline: null,  // Text - A secondary title of the CreativeWork.
			associatedMedia: null,      // MediaObject - The media objects that encode this creative work. This property is a synonym for encodings.
			audience: null,             // Audience - The intended audience of the item, i.e. the group for whom the item was created.
			audio: null,                // AudioObject - An embedded audio object.
			author: null,               // Person or Organization - The author of this content. Please note that author is special in that HTML 5 provides a special mechanism for indicating authorship via the rel tag. That is equivalent to this and may be used interchangeably.
			award: null,                // Text - An award won by this person or for this creative work. Supercedes awards.
			citation: null,             // CreativeWork or Text - A citation or reference to another creative work, such as another publication, web page, scholarly article, etc.
			comment: null,              // Comment or UserComments - Comments, typically from users, on this CreativeWork.
			commentCount: 0,            // Integer - The number of comments this CreativeWork (e.g. Article, Question or Answer) has received. This is most applicable to works published in Web sites with commenting system; additional comments may exist elsewhere.
			contentLocation: null,      // Place - The location of the content.
			contentRating: null,        // Text - Official rating of a piece of content—for example,'MPAA PG-13'.
			contributor: null,          // Person or Organization - A secondary contributor to the CreativeWork.
			copyrightHolder: null,      // Person or Organization - The party holding the legal copyright to the CreativeWork.
			copyrightYear: 0,           // Number - The year during which the claimed copyright for the CreativeWork was first asserted.
			creator: null,              // Person or Organization - The creator/author of this CreativeWork or UserComments. This is the same as the Author property for CreativeWork.
			dateCreated: null,          // Date - The date on which the CreativeWork was created.
			dateModified: null,         // Date - The date on which the CreativeWork was most recently modified.
			datePublished: null,        // Date - Date of first broadcast/publication.
			discussionUrl: null,        // URL - A link to the page containing the comments of the CreativeWork.
			editor: null,               // Person - Specifies the Person who edited the CreativeWork.
			educationalAlignment: null, // AlignmentObject - An alignment to an established educational framework.
			educationalUse: null,       // Text - The purpose of a work in the context of education; for example, 'assignment', 'group work'.
			encoding: null,             // MediaObject - A media object that encode this CreativeWork. Supercedes encodings.
			genre: null,                // Text - Genre of the creative work
			headline: null,             // Text - Headline of the article
			inLanguage: null,           // Text - The language of the content. please use one of the language codes from the IETF BCP 47 standard.
			interactionCount: null,     // Text - A count of a specific user interactions with this item—for example, 20 UserLikes, 5 UserComments, or 300 UserDownloads. The user interaction type should be one of the sub types of UserInteraction.
			interactivityType: null,    // Text - The predominant mode of learning supported by the learning resource. Acceptable values are 'active', 'expositive', or 'mixed'.
			isBasedOnUrl: null,         // URL - A resource that was used in the creation of this resource. This term can be repeated for multiple sources. For example, http://example.com/great-multiplication-intro.html
			isFamilyFriendly: null,     // Boolean - Indicates whether this content is family friendly.
			keywords: null,             // Text - The keywords/tags used to describe this content.
			learningResourceType: null, // Text - The predominant type or kind characterizing the learning resource. For example, 'presentation', 'handout'.
			mentions: null,             // Thing - Indicates that the CreativeWork contains a reference to, but is not necessarily about a concept.
			offers: null,               // Offer - An offer to sell this item—for example, an offer to sell a product, the DVD of a movie, or tickets to an event.
			provider: null,             // Person or Organization - The organization or agency that is providing the service.
			publisher: null,            // Organization - The publisher of the creative work.
			publishingPrinciples: null, // URL - Link to page describing the editorial principles of the organization primarily responsible for the creation of the CreativeWork.
			review: null,               // Review - A review of the item. Supercedes reviews.
			sourceOrganization: null,   // Organization - The Organization on whose behalf the creator was working.
			text: null,                 // Text - The textual content of this CreativeWork.
			thumbnailUrl: null,         // URL - A thumbnail image relevant to the Thing.
			timeRequired: null,         // Duration - Approximate or typical time it takes to work with or through this learning resource for the typical intended target audience, e.g. 'P30M', 'P1H25M'.
			typicalAgeRange: null,      // Text - The typical expected age range, e.g. '7-9', '11-'.
			version: null,              // Number - The version of the CreativeWork embodied by a specified resource.
			video: null,                // VideoObject - An embedded video object.
			Properties: null,           // from - hing
			additionalType: null,       // URL - An additional type for the item, typically used for adding more specific types from external vocabularies in microdata syntax. This is a relationship between something and a class that the thing is in. In RDFa syntax, it is better to use the native RDFa syntax - the 'typeof' attribute - for multiple types. Schema.org tools may have only weaker understanding of extra types, in particular those defined externally.
			alternateName: null,        // Text - An alias for the item.
			description: null,          // Text - A short description of the item.
			image: null,                // URL - URL of an image of the item.
			name: null,                 // Text - The name of the item.
			sameAs: null,               // URL - URL of a reference Web page that unambiguously indicates the item's identity. E.g. the URL of the item's Wikipedia page, Freebase page, or official website.
			url: null,                  // URL - URL of the item.
		}
	);
};