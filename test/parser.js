"use strict";

const debug = require("debug")("backparse:tests-parser");
const chai = require("chai");
const assert = chai.assert;

const { FlatPacker } = require("../lib/packer");
const { Grammar, rule, token, opt, several, END } = require("../lib/parser");

describe("The parser", function() {
  this.timeout(70);

  it("should accept recursive grammars", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [token("A"), rule("r2"), token("C")],
      [token("C")]
    );

    grammar.define("r2",
      [ token("B"), rule("r2") ],
      [ token("B") ]
    );

    const parser = grammar.parser("r1", new FlatPacker, new FlatPacker);
    for(let tk of ["A", "B", "B", "C", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.equal(parser.ast(), "r1(A,r2(B,r2(B)),C)");
  });


  it("should accept mutually recursive grammars", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [token("A"), rule("r2")],
      [token("A")]
    );

    grammar.define("r2",
      [ token("B"), rule("r1") ],
    );


    const parser = grammar.parser("r1", new FlatPacker);
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.equal( parser.ast(),"r1(A,r2(B,r1(A,r2(B,r1(A)))))");
  });

  it("should follow the longuest sentence", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [rule("r2")]
    );

    grammar.define("r2",
      [ token("A"), rule("r2") ],
      [ token("B"), rule("r2") ],
      [ token("A") ],
      [ token("B") ]
    );


    const parser = grammar.parser("r1", new FlatPacker);
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.equal( parser.ast(),"r1(r2(A,r2(B,r2(A,r2(B,r2(A))))))");
  });

  it("should detect invalid sentences", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [token("A"), rule("r2"), token("A")]
    );

    grammar.define("r2",
      [ token("B"), rule("r2") ],
      [ token("B") ]
    );


    const parser = grammar.parser("r1", new FlatPacker);
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "failure");
  });

  it("should accept epsilon-transitions", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [token("A"), rule("r2"), token("A")],
      [token("C")]
    );

    grammar.define("r2",
      [ token("B"), rule("r2") ],
      [  ]
    );


    const parser = grammar.parser("r1", new FlatPacker);
    for(let tk of ["A", "B", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.equal( parser.ast(),"r1(A,r2(B,r2(B,r2())),A)");
  });

  describe("optional path", function() {
    let grammar;

    beforeEach(function() {
      grammar = new Grammar();
      grammar.define("r1",
        [token("A"), opt(rule("r2")), token("A")],
        [token("C")]
      );

      grammar.define("r2",
        [ token("B") ],
        [ token("C") ]
      );
    });

    it("should accept optional paths (shortcut)", function() {
      const parser = grammar.parser("r1", new FlatPacker);
      for(let tk of ["A", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.equal( parser.ast(),"r1(A,A)");
    });

    it("should accept optional paths (1st)", function() {
      const parser = grammar.parser("r1", new FlatPacker);
      for(let tk of ["A", "B", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.equal( parser.ast(), "r1(A,r2(B),A)");
    });
  });

  describe("kleene star", function() {
    let grammar;

    beforeEach(function() {
      grammar = new Grammar();
      grammar.define("r1",
        [token("A"), several(rule("r2")), token("A")],
        [token("C")]
      );

      grammar.define("r2",
        [ token("B") ],
        [ token("C") ]
      );
    });

    it("should accept 0 repetitions", function() {
      const parser = grammar.parser("r1", new FlatPacker);
      for(let tk of ["A", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.equal( parser.ast(), "r1(A,*(),A)");
    });

    it("should accept 1 repetitions", function() {
      const parser = grammar.parser("r1", new FlatPacker);
      for(let tk of ["A", "B", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.equal( parser.ast(), "r1(A,*(r2(B)),A)");
    });

    it("should accept 2 repetitions", function() {
      const parser = grammar.parser("r1", new FlatPacker);
      for(let tk of ["A", "B", "B", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.equal( parser.ast(), "r1(A,*(r2(B),r2(B)),A)" );
    });

    it("should reject bad sentences", function() {
      this.timeout(1000);

      const testCases = [
        ["A", "A", "A", END],
        ["A", "A", "B", END],
        ["A", "B", "A", "B", END],
        ["A", "B", "B", "A", "B", END],
        ["A", "B", "B", "B", "A", "B", END],
      ];

      for(let testCase of testCases) {
        const parser = grammar.parser("r1", new FlatPacker);
        for(let tk of testCase) {
          parser.accept(tk);
        }
        assert.equal(parser._status, "failure", testCase.join(" "));
      }
    });
  });

  describe("complex cases", function() {

    it("deep grammar", function() {
      this.timeout(1000);

      const grammar = new Grammar();
      grammar.define("r1", [token("A"), opt(rule("r2"))], [token("B"), opt(rule("r2"))]);
      grammar.define("r2", [token("A"), opt(rule("r3"))], [token("B"), opt(rule("r3"))]);
      grammar.define("r3", [token("A"), opt(rule("r4"))], [token("B"), opt(rule("r4"))]);
      grammar.define("r4", [token("A"), opt(rule("r5"))], [token("B"), opt(rule("r5"))]);
      grammar.define("r5", [token("A"), opt(rule("r6"))], [token("B"), opt(rule("r6"))]);
      grammar.define("r6", [token("A")], [token("B")]);

      const testCases = [
        ["A", "A", "A", "A", "A", "A", END],
        ["A", "A", "A", "A", "A", "B", END],
        ["A", "A", "A", "A", "B", "A", END],
        ["A", "A", "A", "B", "A", "A", END],
        ["A", "A", "B", "A", "A", "A", END],
        ["A", "B", "A", "A", "A", "A", END],
        ["B", "A", "A", "A", "A", "A", END],
        ["B", "B", "B", "B", "B", "B", END],
      ];

      for(let testCase of testCases) {
        const parser = grammar.parser("r1", new FlatPacker);
        for(let tk of testCase) {
          parser.accept(tk);
        }
        assert.equal(parser._status, "success", testCase.join(" "));
      }
    });

  });
});

