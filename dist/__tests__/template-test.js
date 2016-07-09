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

/*global jest, describe, it, expect, beforeEach*/

var _taggedTemplateLiteral = require('babel-runtime/helpers/tagged-template-literal')['default'];

var _templateObject = _taggedTemplateLiteral(['alert(', ')'], ['alert(', ')']),
    _templateObject2 = _taggedTemplateLiteral(['\n            ', ';\n            while (', ') {\n              ', '\n              ', ';\n            }'], ['\n            ', ';\n            while (', ') {\n              ', '\n              ', ';\n            }']),
    _templateObject3 = _taggedTemplateLiteral(['1 + ', ''], ['1 + ', '']),
    _templateObject4 = _taggedTemplateLiteral(['function foo(', ', c) {}'], ['function foo(', ', c) {}']),
    _templateObject5 = _taggedTemplateLiteral(['function(', ', c) {}'], ['function(', ', c) {}']),
    _templateObject6 = _taggedTemplateLiteral(['', ' => {}'], ['', ' => {}']),
    _templateObject7 = _taggedTemplateLiteral(['(', ', c) => {}'], ['(', ', c) => {}']),
    _templateObject8 = _taggedTemplateLiteral(['var ', ', ', ';'], ['var ', ', ', ';']),
    _templateObject9 = _taggedTemplateLiteral(['[', ', c]'], ['[', ', c]']),
    _templateObject10 = _taggedTemplateLiteral(['{', ', c: 42}'], ['{', ', c: 42}']),
    _templateObject11 = _taggedTemplateLiteral(['bar(', ', c)'], ['bar(', ', c)']);

jest.autoMockOff();

describe('Templates', function () {
  var statements = undefined;
  var statement = undefined;
  var expression = undefined;
  var jscodeshift = undefined;

  beforeEach(function () {
    jscodeshift = require('../core');
    var template = jscodeshift.template;
    expression = template.expression;
    statement = template.statement;
    statements = template.statements;
  });

  it('interpolates expression nodes with source code', function () {

    var input = 'var foo = bar;\nif(bar) {\n  console.log(42);\n}';

    var expected = 'var foo = alert(bar);\nif(alert(bar)) {\n  console.log(42);\n}';

    expect(jscodeshift(input).find('Identifier', { name: 'bar' }).replaceWith(function (path) {
      return expression(_templateObject, path.node);
    }).toSource()).toEqual(expected);
  });

  it('interpolates statement nodes with source code', function () {
    var input = 'for (var i = 0; i < 10; i++) {\n  console.log(i);\n  console.log(i / 2);\n}';

    var expected = 'var i = 0;\nwhile (i < 10) {\n  console.log(i);\n  console.log(i / 2);\n  i++;\n}';

    expect(jscodeshift(input).find('ForStatement').replaceWith(function (p) {
      return statements(_templateObject2, p.node.init, p.node.test, p.node.body.body, p.node.update);
    }).toSource()).toEqual(expected);
  });

  it('can be used with a different parser', function () {
    var parser = require('flow-parser');
    var template = require('../template')(parser);
    var node = { type: 'Literal', value: 41 };

    expect(jscodeshift(template.expression(_templateObject3, node), { parser: parser }).toSource()).toEqual('1 + 41');
  });

  describe('explode arrays', function () {

    it('explodes arrays in function definitions', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo = function foo(a, b, c) {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (p) {
        return expression(_templateObject4, p.node.elements);
      }).toSource()).toEqual(expected);

      expected = 'var foo = function(a, b, c) {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (p) {
        return expression(_templateObject5, p.node.elements);
      }).toSource()).toEqual(expected);

      expected = 'var foo = (a, b) => {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (p) {
        return expression(_templateObject6, p.node.elements);
      }).toSource()).toEqual(expected);

      expected = 'var foo = (a, b, c) => {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (p) {
        return expression(_templateObject7, p.node.elements);
      }).toSource()).toEqual(expected);
    });

    it('explodes arrays in variable declarations', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo, a, b;';
      expect(jscodeshift(input).find('VariableDeclaration')
      // Need to use a block here because the arrow doesn't seem to be
      // compiled with a line break after the return statement. Can't repro
      // outside here though
      .replaceWith(function (p) {
        var node = p.node.declarations[0];
        return statement(_templateObject8, node.id, node.init.elements);
      }).toSource()).toEqual(expected);
    });

    it('explodes arrays in array expressions', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo = [a, b, c];';
      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (p) {
        return expression(_templateObject9, p.node.elements);
      }).toSource()).toEqual(expected);
    });

    it('explodes arrays in object expressions', function () {
      var input = 'var foo = {a, b};';
      var expected = /var foo = \{\s*a,\s*b,\s*c: 42\s*};/;
      expect(jscodeshift(input).find('ObjectExpression').replaceWith(function (p) {
        return expression(_templateObject10, p.node.properties);
      }).toSource()).toMatch(expected);
    });

    it('explodes arrays in call expressions', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo = bar(a, b, c);';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (p) {
        return expression(_templateObject11, p.node.elements);
      }).toSource()).toEqual(expected);
    });
  });
});