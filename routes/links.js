var config = require('../lib/config');
var util = require('../lib/util');
var express = require('express');
var winston = require('winston');

module.exports = function(server) {
	server.post('/:dir', addLink); // takes full link JSON, initiates reltype fetches if needed
	server.delete('/:dir/:link', deleteLink);
};