"use strict";

const debug = require("debug")("backparse:tests-parser-advanced");
const chai = require("chai");
const assert = chai.assert;

const { FlatPacker } = require("../lib/packer");
const { Grammar, Rule, Token, Opt, Several, END } = require("../lib/parser");

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

    class RejectTokenPacker extends FlatPacker {
      token(name) {
        return (name === "B") ? undefined : super.token(name);
      }
    };

    class RejectRulePacker extends FlatPacker {
      rule(name, ...args) {
        if ((name === "r2") && (args[0] === "B")) {
          return undefined;
        }

        return super.rule(name, ...args);
      }
    };

    it("should accept the test sentence with the default packer", function() {
      for(let sentence of sentences) {
        const parser = grammar.parser("r1", new FlatPacker);

        for(let tk of sentence) {
          parser.accept(tk);
        }
        assert.equal(parser._status, "success");
        assert.equal(parser.ast(), `r1(${sentence[0]},r2(${sentence[1]}),${sentence[2]})`);
      }
    });

    it("should reject a sentence if the packer refuses a token", function() {
      const parser = grammar.parser("r1", new RejectTokenPacker);
      parser.accept(...sentences[0]);
      assert.equal(parser._status, "failure");
    });

    it("should accept a sentence if the packer accepts it", function() {
      const parser = grammar.parser("r1", new RejectTokenPacker);
      parser.accept(...sentences[1]);
      assert.equal(parser._status, "success");
    });

    it("should reject a sentence if the packer refuses a rule", function() {
      const parser = grammar.parser("r1", new RejectRulePacker);
      parser.accept(...sentences[0]);
      assert.equal(parser._status, "failure");
    });

    it("should accept a sentence if the packer accepts it", function() {
      const parser = grammar.parser("r1", new RejectRulePacker);
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

    class RejectRulePackerR2 extends FlatPacker {
      rule(name, ...args) {
        if ((name === "r2") && (args[0] === "r3(B)")) {
          return undefined;
        }

        return super.rule(name, ...args);
      }
    };

    class RejectRulePackerR1 extends FlatPacker {
      rule(name, ...args) {
        if ((name === "r1") && (args[1] === "r2(r3(B))")) {
          return undefined;
        }

        return super.rule(name, ...args);
      }
    };

    it("sanity check", function() {
      const parser = grammar.parser("r1", new FlatPacker);
      parser.accept(...sentence);
      assert.equal(parser._status, "success");
    });

    it("backtracking is possible at the current level or above", function() {
      const parser = grammar.parser("r1", new RejectRulePackerR2);
      parser.accept(...sentence);
      assert.equal(parser._status, "success");
    });

    it("can't backtrack below the current level", function() {
      const parser = grammar.parser("r1", new RejectRulePackerR1);
      parser.accept(...sentence);
      assert.equal(parser._status, "failure");
    });

  });

});

