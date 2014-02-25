// == SECTION crud

var $host = local.agent(window.location.protocol + '//' + window.location.host);
var $dir;

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