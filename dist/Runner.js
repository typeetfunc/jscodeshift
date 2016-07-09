/*
 *  Copyright (c) 2015-present, Facebook, Inc.
 *  All rights reserved.
 *
 *  This source code is licensed under the BSD-style license found in the
 *  LICENSE file in the root directory of this source tree. An additional grant
 *  of patent rights can be found in the PATENTS file in the same directory.
 *
 */

'use strict';

var _toConsumableArray = require('babel-runtime/helpers/to-consumable-array')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

require('es6-promise').polyfill();

var child_process = require('child_process');
var colors = require('colors/safe');
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var temp = require('temp');
var ignores = require('./ignoreFiles');

var availableCpus = require('os').cpus().length - 1;
var CHUNK_SIZE = 50;

function lineBreak(str) {
  return (/\n$/.test(str) ? str : str + '\n'
  );
}

var log = {
  ok: function ok(msg, verbose) {
    verbose >= 2 && process.stdout.write(colors.white.bgGreen(' OKK ') + msg);
  },
  nochange: function nochange(msg, verbose) {
    verbose >= 1 && process.stdout.write(colors.white.bgYellow(' NOC ') + msg);
  },
  skip: function skip(msg, verbose) {
    verbose >= 1 && process.stdout.write(colors.white.bgYellow(' SKIP ') + msg);
  },
  error: function error(msg, verbose) {
    verbose >= 0 && process.stdout.write(colors.white.bgRed(' ERR ') + msg);
  },
  create: function create(msg, verbose) {
    verbose >= 1 && process.stdout.write(colors.white.bgYellow(' CREATE ') + msg);
  }
};

function showFileStats(fileStats) {
  process.stdout.write('Results: \n' + colors.red(fileStats.error + ' errors\n') + colors.yellow(fileStats.nochange + ' unmodified\n') + colors.yellow(fileStats.skip + ' skipped\n') + colors.green(fileStats.ok + ' ok\n'));
}

function showStats(stats) {
  var names = _Object$keys(stats).sort();
  if (names.length) {
    process.stdout.write(colors.blue('Stats: \n'));
  }
  names.forEach(function (name) {
    return process.stdout.write(name + ': \n', stats[name]);
  });
}

function dirFiles(dir, callback, acc) {
  // acc stores files found so far and counts remaining paths to be processed
  acc = acc || { files: [], remaining: 1 };

  function done() {
    // decrement count and return if there are no more paths left to process
    if (! --acc.remaining) {
      callback(acc.files);
    }
  }

  fs.readdir(dir, function (err, files) {
    // if dir does not exist or is not a directory, bail
    // (this should not happen as long as calls do the necessary checks)
    if (err) throw err;

    acc.remaining += files.length;
    files.forEach(function (file) {
      var name = path.join(dir, file);
      fs.stat(name, function (err, stats) {
        if (err) {
          // probably a symlink issue
          process.stdout.write('Skipping path "' + name + '" which does not exist.\n');
          done();
        } else if (ignores.shouldIgnore(name)) {
          // ignore the path
          done();
        } else if (stats.isDirectory()) {
          dirFiles(name + '/', callback, acc);
        } else {
          acc.files.push(name);
          done();
        }
      });
    });
    done();
  });
}

function getAllFiles(paths, filter) {
  return _Promise.all(paths.map(function (file) {
    return new _Promise(function (resolve, reject) {
      fs.lstat(file, function (err, stat) {
        if (err) {
          process.stderr.write('Skipping path ' + file + ' which does not exist. \n');
          resolve();
          return;
        }

        if (stat.isDirectory()) {
          dirFiles(file, function (list) {
            return resolve(list.filter(filter));
          });
        } else if (ignores.shouldIgnore(file)) {
          // ignoring the file
          resolve([]);
        } else {
          resolve([file]);
        }
      });
    });
  })).then(function (files) {
    var _ref;

    return (_ref = []).concat.apply(_ref, _toConsumableArray(files));
  });
}

function run(transformFile, paths, options) {
  var usedRemoteScript = false;
  var cpus = options.cpus ? Math.min(availableCpus, options.cpus) : availableCpus;
  var extensions = options.extensions && options.extensions.split(',').map(function (ext) {
    return '.' + ext;
  });
  var fileCounters = { error: 0, ok: 0, nochange: 0, skip: 0 };
  var statsCounter = {};
  var startTime = process.hrtime();

  ignores.add(options.ignorePattern);
  ignores.addFromFile(options.ignoreConfig);

  if (/^http/.test(transformFile)) {
    usedRemoteScript = true;
    return new _Promise(function (resolve, reject) {
      // call the correct `http` or `https` implementation
      (transformFile.indexOf('https') !== 0 ? http : https).get(transformFile, function (res) {
        var contents = '';
        res.on('data', function (d) {
          contents += d.toString();
        }).on('end', function () {
          temp.open('jscodeshift', function (err, info) {
            reject(err);
            fs.write(info.fd, contents);
            fs.close(info.fd, function (err) {
              reject(err);
              transform(info.path).then(resolve, reject);
            });
          });
        });
      }).on('error', function (e) {
        reject(e.message);
      });
    });
  } else if (!fs.existsSync(transformFile)) {
    process.stderr.write(colors.white.bgRed('ERROR') + ' Transform file ' + transformFile + ' does not exist \n');
    return;
  } else {
    return transform(transformFile);
  }

  function transform(transformFile) {
    return getAllFiles(paths, function (name) {
      return !extensions || extensions.indexOf(path.extname(name)) != -1;
    }).then(function (files) {
      var numFiles = files.length;

      if (numFiles === 0) {
        process.stdout.write('No files selected, nothing to do. \n');
        return;
      }

      var processes = options.runInBand ? 1 : Math.min(numFiles, cpus);
      var chunkSize = processes > 1 ? Math.min(Math.ceil(numFiles / processes), CHUNK_SIZE) : numFiles;

      var index = 0;
      // return the next chunk of work for a free worker
      function next() {
        if (!options.silent && !options.runInBand && index < numFiles) {
          process.stdout.write('Sending ' + Math.min(chunkSize, numFiles - index) + ' files to free worker...\n');
        }
        return files.slice(index, index += chunkSize);
      }

      if (!options.silent) {
        process.stdout.write('Processing ' + files.length + ' files... \n');
        if (!options.runInBand) {
          process.stdout.write('Spawning ' + processes + ' workers...\n');
        }
        if (options.dry) {
          process.stdout.write(colors.green('Running in dry mode, no files will be written! \n'));
        }
      }

      var args = [transformFile, options.babel ? 'babel' : 'no-babel'];

      var workers = [];
      for (var i = 0; i < processes; i++) {
        workers.push(options.runInBand ? require('./Worker')(args) : child_process.fork(require.resolve('./Worker'), args));
      }

      return workers.map(function (child) {
        child.send({ files: next(), options: options });
        child.on('message', function (message) {
          switch (message.action) {
            case 'status':
              fileCounters[message.status] += 1;
              log[message.status](lineBreak(message.msg), options.verbose);
              break;
            case 'update':
              if (!statsCounter[message.name]) {
                statsCounter[message.name] = 0;
              }
              statsCounter[message.name] += message.quantity;
              break;
            case 'free':
              child.send({ files: next(), options: options });
              break;
          }
        });
        return new _Promise(function (resolve) {
          return child.on('disconnect', resolve);
        });
      });
    }).then(function (pendingWorkers) {
      return _Promise.all(pendingWorkers).then(function () {
        if (!options.silent) {
          var endTime = process.hrtime(startTime);
          process.stdout.write('All done. \n');
          showFileStats(fileCounters);
          showStats(statsCounter);
          process.stdout.write('Time elapsed: ' + (endTime[0] + endTime[1] / 1e9).toFixed(3) + 'seconds \n');
        }
        if (usedRemoteScript) {
          temp.cleanupSync();
        }
        return fileCounters;
      });
    });
  }
}

exports.run = run;