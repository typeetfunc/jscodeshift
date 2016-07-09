/*global jest, defined, it, expect, beforeEach*/

'use strict';

var _taggedTemplateLiteral = require('babel-runtime/helpers/tagged-template-literal')['default'];

var _slicedToArray = require('babel-runtime/helpers/sliced-to-array')['default'];

var _templateObject = _taggedTemplateLiteral(['alert(', ')'], ['alert(', ')']),
    _templateObject2 = _taggedTemplateLiteral(['\n            ', ';\n            while (', ') {\n              ', '\n              ', '\n            }'], ['\n            ', ';\n            while (', ') {\n              ', '\n              ', '\n            }']),
    _templateObject3 = _taggedTemplateLiteral(['function foo(', ', c) {}'], ['function foo(', ', c) {}']),
    _templateObject4 = _taggedTemplateLiteral(['function(', ', c) {}'], ['function(', ', c) {}']),
    _templateObject5 = _taggedTemplateLiteral(['', ' => {}'], ['', ' => {}']),
    _templateObject6 = _taggedTemplateLiteral(['(', ', c) => {}'], ['(', ', c) => {}']),
    _templateObject7 = _taggedTemplateLiteral(['var ', ', ', ';'], ['var ', ', ', ';']),
    _templateObject8 = _taggedTemplateLiteral(['[', ', c]'], ['[', ', c]']),
    _templateObject9 = _taggedTemplateLiteral(['{', ', c: 42}'], ['{', ', c: 42}']),
    _templateObject10 = _taggedTemplateLiteral(['bar(', ', c)'], ['bar(', ', c)']);

jest.autoMockOff();

var jscodeshift = require('../core');

describe('Templates', function () {
  var statements = undefined;
  var statement = undefined;
  var expression = undefined;

  beforeEach(function () {
    var _require = require('../template');

    expression = _require.expression;
    statement = _require.statement;
    statements = _require.statements;
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

    var expected = 'var i = 0;\n\nwhile (i < 10) {\n  console.log(i);\n  console.log(i / 2);\n  i++;\n}';

    expect(jscodeshift(input).find('ForStatement').replaceWith(function (_ref) {
      var node = _ref.node;
      return statements(_templateObject2, node.init, node.test, node.body.body, node.update);
    }).toSource()).toEqual(expected);
  });

  describe('explode arrays', function () {

    it('explodes arrays in function definitions', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo = function foo(a, b, c) {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (_ref2) {
        var node = _ref2.node;
        return expression(_templateObject3, node.elements);
      }).toSource()).toEqual(expected);

      expected = 'var foo = function(a, b, c) {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (_ref3) {
        var node = _ref3.node;
        return expression(_templateObject4, node.elements);
      }).toSource()).toEqual(expected);

      expected = 'var foo = (a, b) => {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (_ref4) {
        var node = _ref4.node;
        return expression(_templateObject5, node.elements);
      }).toSource()).toEqual(expected);

      expected = 'var foo = (a, b, c) => {};';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (_ref5) {
        var node = _ref5.node;
        return expression(_templateObject6, node.elements);
      }).toSource()).toEqual(expected);
    });

    it('explodes arrays in variable declarations', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo, a, b;';
      expect(jscodeshift(input).find('VariableDeclaration')
      // Need to use a block here because the arrow doesn't seem to be
      // compiled with a line break after the return statement. Can't repro
      // outside here though
      .replaceWith(function (_ref6) {
        var _ref6$node$declarations = _slicedToArray(_ref6.node.declarations, 1);

        var node = _ref6$node$declarations[0];

        return statement(_templateObject7, node.id, node.init.elements);
      }).toSource()).toEqual(expected);
    });

    it('explodes arrays in array expressions', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo = [a, b, c];';
      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (_ref7) {
        var node = _ref7.node;
        return expression(_templateObject8, node.elements);
      }).toSource()).toEqual(expected);
    });

    it('explodes arrays in object expressions', function () {
      var input = 'var foo = {a, b};';
      var expected = /var foo = \{\s*a,\s*b,\s*c: 42\s*};/;
      expect(jscodeshift(input).find('ObjectExpression').replaceWith(function (_ref8) {
        var node = _ref8.node;
        return expression(_templateObject9, node.properties);
      }).toSource()).toMatch(expected);
    });

    it('explodes arrays in call expressions', function () {
      var input = 'var foo = [a, b];';
      var expected = 'var foo = bar(a, b, c);';

      expect(jscodeshift(input).find('ArrayExpression').replaceWith(function (_ref9) {
        var node = _ref9.node;
        return expression(_templateObject10, node.elements);
      }).toSource()).toEqual(expected);
    });
  });
});