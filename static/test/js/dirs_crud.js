// == SECTION crud

var $host = local.agent(window.location.protocol + '//' + window.location.host);
var $dir, $link;

// create a directory

done = false;
startTime = Date.now();
$host.POST({ name: 'Test Dir 1' })
	.then(function(res) {
		print(res.status);
		print(res.headers.location);
		$dir = local.agent(res.headers.location);
	}, printError)
	.always(finishTest);
wait(function () { return done; });

/* =>
201
http://grimwire.com:8001/test-dir-1
*/

// conflict on used directory id

done = false;
startTime = Date.now();
$host.POST({ name: 'Test Dir 1' })
	.then(printError, function(res) {
		print(res.status);
	})
	.always(finishTest);
wait(function () { return done; });

/* =>
409
*/

// add a link

done = false;
startTime = Date.now();
$dir.POST({ href: 'https://www.google.com', rel: 'service google.com/rel/search', title: 'The Googs' })
	.then(function(res) {
		print(res.status);
		print(res.headers.location);
		$link = local.agent(res.headers.location);
	}, printError)
	.always(finishTest);
wait(function () { return done; });

/* =>
201
http://grimwire.com:8001/test-dir-1/1
*/

// fetch links in a directory

done = false;
startTime = Date.now();
$dir.GET()
	.then(function(res) {
		console.debug('---', res);
		print(res.status);
		print(res.parsedHeaders.link);
		print(res.body);
	}, printError)
	.always(finishTest);
wait(function () { return done; });

/* =>
200
[
  {
    href: "http://grimwire.com:8001/",
    rel: "up via service",
    title: "grimwire.com"
  },
  {
    href: "http://grimwire.com:8001/test-dir-1",
    id: "test-dir-1",
    rel: "self collection"
  },
  {
    href: "https://www.google.com",
    rel: "service google.com/rel/search",
    title: "The Googs"
  }
]
{
  id: "test-dir-1",
  links: [
    {
      href: "https://www.google.com",
      rel: "service google.com/rel/search",
      title: "The Googs"
    }
  ],
  name: "Test Dir 1"
}
*/

// delete a link

done = false;
startTime = Date.now();
$link.DELETE()
	.then(function(res) {
		print(res.status);
	}, printError)
	.always(finishTest);
wait(function () { return done; });

/* =>
204
*/

// delete a directory

done = false;
startTime = Date.now();
$dir.DELETE()
	.then(function(res) {
		print(res.status);
	}, printError)
	.always(finishTest);
wait(function () { return done; });

/* =>
204
*/