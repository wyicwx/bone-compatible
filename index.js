var rewire = require('rewire');
var cache = {};
var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var AKOStream = require('AKOStream');
var origin = AKOStream.origin;

function comp(mod, context) {
	var bone = require('bone');
	if(!cache[mod]) {	
		context || (context = {});

		var bonefileStat = null;
		var bonebaseStat = null;
		var cachedFile = {};

		var module = cache[mod] = rewire(mod);
		var bonefs = _.clone(fs);
		bonefs.readFile = function(file, encoding, callback) {
			if(bone.fs.existFile(file, {notFs: true})) {
				file = bone.fs.pathResolve(file);
				if(cachedFile[file]) {
					callback(null, buffer);
				} else {				
					AKOStream.aggreStream(bone.fs.createReadStream(file, encoding)).on('data', function(buffer) {
						callback(null, buffer);
					});
				}
			} else {
				fs.readFile(file, encoding, callback);
			}
		};
		bonefs.createReadStream = function(file) {
			file = bone.fs.pathResolve(file);
			if(cachedFile[file]) {
				return origin(cachedFile[file]);
			} else {
				var args = _.toArray(arguments);
				return bone.fs.createReadStream.apply(bone.fs, args);
			}
		};
		bonefs.readdir = function(p, callback) {
			var result = bone.fs.readDir(p);
			callback(null, result);
		};
		bonefs.stat = function(file, callback) {
			file = bone.fs.pathResolve(file);
			var isFile = bone.fs.existFile(file, {notFs: true});
			var isDir = bone.fs.search(file, {notFs: true}).length > 0;
			var args = _.toArray(arguments);
			var dir = isFile ? path.dirname(file) : file;

			if(isFile) {
				if(!bonefileStat) {
					fs.stat(path.join(bone.fs.base, 'bonefile.js'), function(err, stat) {
						bonefileStat = stat;
						bonefs.stat(file, callback);
					});
				} else {
					AKOStream.aggre(bone.fs.createReadStream(file)).on('data', function(buffer) {
						// todo cache buffer  
						cachedFile[file] = buffer;
						setTimeout(function() {
							delete cachedFile[file];
						}, 50);
						bonefileStat.size = buffer.length;
						callback(null, bonefileStat);
					}).on('end', function() {
						if(!cachedFile[file]) {
							bonefileStat.size = 0;
							callback(null, bonefileStat);
						}
					});
				}
			} else if(isDir) {
				if(!bonebaseStat) {
					fs.stat(bone.fs.base, function(err, stat) {
						bonebaseStat = stat;
						bonefs.stat(file, callback);
					});
				} else {
					callback(null, bonebaseStat);
				}
			} else {
				fs.stat.apply(fs, args);
			}
		};
		context = _.extend({}, context, {
			fs: bonefs
		});
		module.__set__(context);
	}

	return cache[mod];
}

module.exports = comp;