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

jest.autoMockOff();

var testUtils = require('../../utils/testUtils');

var createTransformWith = testUtils.createTransformWith;
var createTempFileWith = testUtils.createTempFileWith;
var getFileContent = testUtils.getFileContent;

describe('Worker API', function () {
  var worker = undefined;

  beforeEach(function () {
    worker = require('../Worker');
  });

  it('transforms files', function (done) {
    var transformPath = createTransformWith('return fileInfo.source + " changed";');
    var sourcePath = createTempFileWith('foo');
    var emitter = worker([transformPath]);

    emitter.send({ files: [sourcePath] });
    emitter.once('message', function (data) {
      expect(data.status).toBe('ok');
      expect(data.msg).toBe(sourcePath);
      expect(getFileContent(sourcePath)).toBe('foo changed');
      done();
    });
  });

  describe('custom parser', function () {
    function getTransformForParser(parser) {
      return createTempFileWith('function transform(fileInfo, api) {\n          api.jscodeshift(fileInfo.source);\n          return "changed";\n         }\n         ' + (parser ? 'transform.parser = \'' + parser + '\';' : '') + '\n         module.exports = transform;\n        ');
    }
    function getSourceFile() {
      // This code cannot be parsed by Babel v5
      return createTempFileWith('const x = (a: Object, b: string): void => {}');
    }

    it('errors if new flow type code is parsed with babel v5', function (done) {
      var transformPath = createTransformWith('api.jscodeshift(fileInfo.source); return "changed";');
      var sourcePath = getSourceFile();
      var emitter = worker([transformPath]);

      emitter.send({ files: [sourcePath] });
      emitter.once('message', function (data) {
        expect(data.status).toBe('error');
        expect(data.msg).toMatch('SyntaxError');
        done();
      });
    });

    it('uses babylon if configured as such', function (done) {
      var transformPath = getTransformForParser('babylon');
      var sourcePath = getSourceFile();
      var emitter = worker([transformPath]);

      emitter.send({ files: [sourcePath] });
      emitter.once('message', function (data) {
        expect(data.status).toBe('ok');
        expect(getFileContent(sourcePath)).toBe('changed');
        done();
      });
    });

    it('uses flow if configured as such', function (done) {
      var transformPath = getTransformForParser('flow');
      var sourcePath = getSourceFile();
      var emitter = worker([transformPath]);

      emitter.send({ files: [sourcePath] });
      emitter.once('message', function (data) {
        expect(data.status).toBe('ok');
        expect(getFileContent(sourcePath)).toBe('changed');
        done();
      });
    });
  });
});