"use strict";

const debug = require("debug")("backparse:tests-parser-advanced");
const chai = require("chai");
const assert = chai.assert;

const { flatBuilder } = require("../lib/helper");
const { Grammar } = require("../lib/grammar");
const { Const, Rule, Token, ZeroOrOne, ZeroOrMore } = require("../lib/predicate");
const { END } = require("../lib/parser");

describe("parser (advanced)", function() {
  this.timeout(70);

  describe("rejection at semantic level", function() {
    let block = true;
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("D")],
    );

    grammar.define("r2",
      [ Token("B") ],
      [ Token("C") ],
      function(fail, tk) {
        return (block && (tk === "B")) ? fail : tk;
      }
    );

    const sentences = [
      ["A", "B", "D", END ],
      ["A", "C", "D", END ]
    ];

    it("sanity check", function() {
      block = false;
      for(let sentence of sentences) {
        const parser = grammar.parser("r1", flatBuilder);

        for(let tk of sentence) {
          parser.accept(tk);
        }
        assert.equal(parser.status, "ok");
        assert.deepEqual(parser.result(), sentence.slice(0,3));
      }
    });

    it("should reject a sentence if the builder refuses a rule", function() {
      block = true;
      const parser = grammar.parser("r1");
      parser.accept(...sentences[0]);
      assert.equal(parser.status, "failure");
    });

    it("should accept a sentence if the builder accepts it", function() {
      block = true;
      const parser = grammar.parser("r1");
      parser.accept(...sentences[1]);
      assert.equal(parser.status, "ok");
    });

  });

  describe("late rejection side-effect", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("D")],
    );

    let block = false;
    grammar.define("r2",
      [ Rule("r3") ],
      [ Rule("r4") ],
      function(fail, tk) {
        return (block && (tk[1] === "r3")) ? fail : tk;
      }
    );

    // the grammar is ambiguous.
    // a rejection rule on "r2" can't resolve the ambiguity
    grammar.define("r3", [Token("B"), Const("r3")]);
    grammar.define("r4", [Token("B"), Const("r4")]);

    const sentence = ["A", "B", "D", END ];

    it("sanity check", function() {
      block = false;
      const parser = grammar.parser("r1");
      parser.accept(...sentence);
      assert.equal(parser.status, "ok");
      assert.deepEqual(parser.result(), [ "A", [ "B", "r3" ], "D" ]);
    });

    it("backtracking is possible", function() {
      block = true;
      const parser = grammar.parser("r1");
      parser.accept(...sentence);
      assert.equal(parser.status, "ok");
      assert.deepEqual(parser.result(),  [ "A", [ "B", "r4" ], "D" ]);
    });

  });

});

