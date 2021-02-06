"use strict";

const debug = require("debug")("backparse:tests-parser-advanced");
const chai = require("chai");
const assert = chai.assert;

const { flatBuilder } = require("../lib/builder");
const { Grammar } = require("../lib/grammar");
const { Rule, Token, ZeroOrOne, ZeroOrMore, END } = require("../lib/parser");

describe("parser (advanced)", function() {
  this.timeout(70);

  describe("rejection at semantic level", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("D")],
    );

    grammar.define("r2",
      [ Token("B") ],
      [ Token("C") ]
    );

    const sentences = [ ["A", "B", "D", END ],
      ["A", "C", "D", END ] ];

    function rejectRuleBuilder(name, ...args) {
      if ((name === "r2") && (args[0] === "B")) {
        return undefined;
      }

      return flatBuilder(name, ...args);
    }

    it("should accept the test sentence with the default builder", function() {
      for(let sentence of sentences) {
        const parser = grammar.parser("r1", flatBuilder);

        for(let tk of sentence) {
          parser.accept(tk);
        }
        assert.equal(parser._status, "success");
        assert.equal(parser.ast(), `r1(${sentence[0]},r2(${sentence[1]}),${sentence[2]})`);
      }
    });

    it("should reject a sentence if the builder refuses a rule", function() {
      const parser = grammar.parser("r1", rejectRuleBuilder);
      parser.accept(...sentences[0]);
      assert.equal(parser._status, "failure");
    });

    it("should accept a sentence if the builder accepts it", function() {
      const parser = grammar.parser("r1", rejectRuleBuilder);
      parser.accept(...sentences[1]);
      assert.equal(parser._status, "success");
    });

  });

  describe("late rejection side-effect", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("D")],
    );

    grammar.define("r2",
      [ Rule("r3") ],
      [ Rule("r4") ]
    );

    // the grammar is ambiguous.
    // a rejection rule on "r2" can't resolve the ambiguity
    grammar.define("r3", [Token("B")]);
    grammar.define("r4", [Token("B")]);

    const sentence = ["A", "B", "D", END ];

    function rejectRuleBuilderR2(name, ...args) {
      if ((name === "r2") && (args[0] === "r3(B)")) {
        return undefined;
      }

      return flatBuilder(name, ...args);
    }

    function rejectRuleBuilderR1(name, ...args) {
      if ((name === "r1") && (args[1] === "r2(r3(B))")) {
        return undefined;
      }

      return flatBuilder(name, ...args);
    }

    it("sanity check", function() {
      const parser = grammar.parser("r1", flatBuilder);
      parser.accept(...sentence);
      assert.equal(parser._status, "success");
    });

    it("backtracking is possible at the current level or above", function() {
      const parser = grammar.parser("r1", rejectRuleBuilderR2);
      parser.accept(...sentence);
      assert.equal(parser._status, "success");
    });

    it("can't backtrack below the current level", function() {
      const parser = grammar.parser("r1", rejectRuleBuilderR1);
      parser.accept(...sentence);
      assert.equal(parser._status, "failure");
    });

  });

});

