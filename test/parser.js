"use strict";

const debug = require("debug")("backparse:parser");
const chai = require("chai");
const assert = chai.assert;

const { Grammar } = require("../lib/grammar");
const { Parser } = require("../lib/parser");
const { Rule, Test, ZeroOrMore, OneOrMore, ZeroOrOne, Alternatives } = require("../lib/predicate");



describe("The new parser", function() {
  describe("opcodes and core functions", function() {


    it("should create a parser", function() {
      const parser = new Parser();
    });

    it("should stop", function() {
      const parser = new Parser();

      parser.pc = 0;
      parser.code = [
        "stop", undefined,
      ];

      parser.run();
    });

    it("should execute sequences of test opcodes", function() {
      const parser = new Parser();

      parser.pc = 0;
      parser.code = [
        Test((tk, fail) => (tk == "A") ? tk : fail),
        Test((tk, fail) => (tk == "B") ? tk : fail),
        Test((tk, fail) => (tk == "C") ? tk : fail),
        Test((tk, fail) => (tk == "END") ? tk : fail),
        "stop", undefined,
      ].flat();

      parser.accept("A","B","C", "END");
      parser.run();
    });

    it("should handle alternatives", function() {
      const parser = new Parser();

      parser.pc = 0;
      parser.code = Alternatives([
        Test((tk, fail) => (tk == "A") ? tk : fail),
        Test((tk, fail) => (tk == "END") ? tk : fail),
      ],
      [
        Test((tk, fail) => (tk == "B") ? tk : fail),
        Test((tk, fail) => (tk == "END") ? tk : fail),
      ]);
      parser.code.push("stop", undefined);

      parser.accept("B", "END");
      parser.run();
    });

  });

  describe("grammar and high-level functions", function() {
    function Token(value) {
      return Test((tk, fail) => (tk == value) ? tk : fail);
    }

    it("should accept a grammar", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ Token("A") ],
        [ Token("B") ],
      );

      const parser = grammar.parser("r1");

      parser.accept("B","END");
      parser.run();
    });

    it("should backtrack", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ Token("A"), Token("A") ],
        [ Token("A"), Token("B") ],
      );

      const parser = grammar.parser("r1");

      parser.accept("A", "B","END");
      parser.run();
    });

    it("should branch to other rules", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ Token("A"), Rule("r2") ],
      );
      grammar.define("r2",
        [ Token("B") ],
      );

      const parser = grammar.parser("r1");

      parser.accept("A", "B","END");
      parser.run();
    });

    it("should accept repeat (0-*)", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ Token("A"), ZeroOrMore(Token("B")) ],
      );

      const parser = grammar.parser("r1");

      parser.accept("A", "B", "B", "B", "B", "B","END");
      parser.run();
    });

    it("should accept repeat (1-*)", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ Token("A"), OneOrMore(Token("B")) ],
      );

      const parser = grammar.parser("r1");

      parser.accept("A", "B", "B", "B", "B", "B","END");
      parser.run();
    });

    it("should accept the \"zero or one\" quantifier", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ Token("A"), ZeroOrOne(Token("B")) ],
      );

      const parser = grammar.parser("r1");

      parser.accept("A", "B", "END");
      parser.run();
    });

  });

});

