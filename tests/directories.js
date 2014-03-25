var assert = require('assert');
var request = require('request');

var baseURL = 'http://localhost:9000';
function url(path) { return baseURL + path; }

describe('Web API', function() {
	// Captured vars for use across tests (too lazy to setup consistent scaffolds)
	var docUrl1, docUrl2;

	// '/'

	describe('POST / (well-formed)', function() {
		it('should respond 201 with the location of the new directory', function(done) {
			request.post({ url: url('/'), json: { id: 'test' } }, function(err, res) {
				assert(!err);
				assert.equal(201, res.statusCode);
				assert.equal(url('/test'), res.headers.location);
				done();
			});
		});
	});
	describe('POST / (mal-formed body)', function() {
		it('should respond 422 with error doc', function(done) {
			request.post({ url: url('/'), json: { foo: 0 } }, function(err, res) {
				assert(!err);
				assert.equal(422, res.statusCode);
				request.post({ url: url('/'), json: { id: '!@#$' } }, function(err, res) {
					assert(!err);
					assert.equal(422, res.statusCode);
					done();
				});
			});
		});
	});
	describe('POST / (conflicting id)', function() {
		it('should respond 409', function(done) {
			request.post({ url: url('/'), json: { id: 'test' } }, function(err, res) {
				assert(!err);
				assert.equal(409, res.statusCode);
				done();
			});
		});
	});

	// '/:directory'

	describe('GET /:directory (well-formed)', function() {
		it('should respond 200 with JSON', function(done) {
			request({ url: url('/test'), headers: { Accept: 'application/json' } }, function(err, res) {
				assert(!err);
				assert.equal(200, res.statusCode);
				assert.equal('application/json', res.headers['content-type']);
				done();
			});
		});
		it('should respond 200 with HTML', function(done) {
			request({ url: url('/test'), headers: { Accept: 'text/html' } }, function(err, res) {
				assert(!err);
				assert.equal(200, res.statusCode);
				assert.equal('text/html', res.headers['content-type']);
				done();
			});
		});
	});
	describe('GET /:directory (invalid id)', function() {
		it('should respond 404', function(done) {
			request({ url: url('/not-found'), headers: { Accept: 'application/json' } }, function(err, res) {
				assert(!err);
				assert.equal(404, res.statusCode);
				done();
			});
		});
	});
	describe('POST /:directory (well-formed w/body)', function() {
		it('should respond 201 with the location of the new document', function(done) {
			request.post({ url: url('/test'), qs: { rel: 'stdrel.com/media', type: 'application/json' }, json: { foo: 'bar' } }, function(err, res) {
				assert(!err);
				assert.equal(201, res.statusCode);

				var lastSlash = res.headers.location.lastIndexOf('/');
				var id = res.headers.location.slice(lastSlash+1);
				assert(+id == id); // is numeric

				docUrl1 = res.headers.location; // save for latter test
				done();
			});
		});
	});
	describe('POST /:directory (well-formed w/href)', function() {
		it('should respond 201 with the location of the new document', function(done) {
			request.post({ url: url('/test'), qs: { href: url('/'), rel: 'service', title: 'Test Server' } }, function(err, res, resBody) {
				assert(!err);
				assert.equal(201, res.statusCode);

				var lastSlash = res.headers.location.lastIndexOf('/');
				var id = res.headers.location.slice(lastSlash+1);
				assert(+id == id); // is numeric

				docUrl2 = res.headers.location; // save for latter test
				done();
			});
		});
	});
	describe('POST /:directory (invalid dir id)', function() {
		it('should respond 404', function(done) {
			request.post({ url: url('/not-found'), qs: { rel: 'stdrel.com/media', type: 'application/json' }, json: { foo: 'bar' } }, function(err, res) {
				assert(!err);
				assert.equal(404, res.statusCode);
				done();
			});
		});
	});
	describe('POST /:directory (no body or href)', function() {
		it('should respond 422', function(done) {
			request.post({ url: url('/test'), qs: { rel: 'stdrel.com/media', type: 'application/json' } }, function(err, res) {
				assert(!err);
				assert.equal(422, res.statusCode);
				done();
			});
		});
	});
	describe('POST /:directory (both body and href)', function() {
		it('should respond 422', function(done) {
			request.post({ url: url('/test'), qs: { href: url('/'), rel: 'stdrel.com/media', type: 'application/json' }, json: { foo: 'bar' } }, function(err, res) {
				assert(!err);
				assert.equal(422, res.statusCode);
				done();
			});
		});
	});
	describe('DELETE /:directory/:document (well-formed)', function() {
		it('should respond 204', function(done) {
			// docUrl1 is from previous create test
			request.del({ url: docUrl1 }, function(err, res) {
				assert(!err);
				assert.equal(204, res.statusCode);
				done();
			});
		});
	});
	describe('DELETE /:directory/:document (invalid doc id)', function() {
		it('should respond 204', function(done) { // No check is done, so this is expected behavior
			request.del({ url: url('/test/123456789') }, function(err, res) {
				assert(!err);
				assert.equal(204, res.statusCode);
				done();
			});
		});
	});
	describe('DELETE /:directory/:document (invalid dir id)', function() {
		it('should respond 404', function(done) {
			request.del({ url: url('/not-found/123456789') }, function(err, res) {
				assert(!err);
				assert.equal(404, res.statusCode);
				done();
			});
		});
	});

	// '/:directory/:document'

	describe('DELETE /:directory (well-formed)', function() {
		it('should respond 204', function(done) {
			request.del({ url: url('/test') }, function(err, res) {
				assert(!err);
				assert.equal(204, res.statusCode);
				done();
			});
		});
	});
	describe('DELETE /:directory (invalid id)', function() {
		it('should respond 404', function(done) {
			request.del({ url: url('/not-found') }, function(err, res) {
				assert(!err);
				assert.equal(404, res.statusCode);
				done();
			});
		});
	});
});