"use strict";

const debug = require("debug")("backparse:tests-parser");
const chai = require("chai");
const assert = chai.assert;

const { Wrap } = require("../lib/helper");
const { Grammar } = require("../lib/grammar");
const { Rule, Token, ZeroOrOne, ZeroOrMore, OneOrMore } = require("../lib/predicate");
const { END } = require("../lib/parser");


function test(grammar, input, result) {
  return function() {
    const parser = grammar.parser("r1");
    for(let tk of [...input, END]) {
      parser.accept(tk);
    }
    const msg = `Test failed for input ${input}`;
    if (result !== undefined) {
      assert.equal(parser.status, "ok", msg);
      assert.equal(parser.result(), result, msg);
    }
    else {
      assert.equal(parser.status, "failure", msg);
    }
  };
}

function suite(grammar, tests) {
  for(let [input, result] of tests) {
    it(`${ (result) ? "should match" : "should not match"  } ${input}`, test(grammar, input, result));
  }
}


describe("The parser", function() {
  this.timeout(70);

  it("should accept recursive grammars", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("C")],
      [Token("C")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ Token("B"), Rule("r2") ],
      [ Token("B") ],
      Wrap("r2")
    );

    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "B", "C", END]) {
      parser.accept(tk);
    }
    assert.equal(parser.status, "ok");
    assert.equal(parser.result(), "r1(A,r2(B,r2(B)),C)");
  });


  it("should accept mutually recursive grammars", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2")],
      [Token("A")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ Token("B"), Rule("r1") ],
      Wrap("r2")
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser.status, "ok");
    assert.equal( parser.result(),"r1(A,r2(B,r1(A,r2(B,r1(A)))))");
  });

  it("should follow the longuest sentence", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Rule("r2")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ Token("A"), Rule("r2") ],
      [ Token("B"), Rule("r2") ],
      [ Token("A") ],
      [ Token("B") ],
      Wrap("r2")
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser.status, "ok");
    assert.equal( parser.result(),"r1(r2(A,r2(B,r2(A,r2(B,r2(A))))))");
  });

  it("should detect invalid sentences", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("A")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ Token("B"), Rule("r2") ],
      [ Token("B") ],
      Wrap("r2")
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser.status, "failure");
  });

  it("should accept epsilon-transitions", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("A")],
      [Token("C")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ Token("B"), Rule("r2") ],
      [  ],
      Wrap("r2")
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser.status, "ok");
    assert.equal( parser.result(),"r1(A,r2(B,r2(B,r2())),A)");
  });

  describe("the zero-or-one test grammar AB?C|C", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("C")],
      [Token("C")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ ZeroOrOne(Token("B")) ],
      Wrap("r2")
    );

    suite(grammar, [
      [ [ "C"], "r1(C)" ],
      [ [ "A", "B", "C"], "r1(A,r2(B),C)" ],
      [ [ "A", "C"], "r1(A,r2(undefined),C)" ],
      [ [ "A", "C", "C"] ],
    ]);
  });

  describe("the zero-or-one test grammar AB?B", function() {
    const grammar = new Grammar();
    grammar.define("r1",
      [Token("A"), Rule("r2"), Token("B")],
      Wrap("r1")
    );

    grammar.define("r2",
      [ ZeroOrOne(Token("B")) ],
      Wrap("r2")
    );

    suite(grammar, [
      [ [ "A" ] ],
      [ [ "A", "B" ], "r1(A,r2(undefined),B)" ],
      [ [ "A", "B", "B" ], "r1(A,r2(B),B)" ],
      [ [ "A", "B", "B", "B" ] ],
    ]);
  });

  describe("zero-or-more quantifier", function() {
    let grammar;

    beforeEach(function() {
      grammar = new Grammar();
      grammar.define("r1",
        [Token("A"), ZeroOrMore(Rule("r2")), Token("A")],
        [Token("C")],
        Wrap("r1")
      );

      grammar.define("r2",
        [ Token("B") ],
        [ Token("C") ],
        Wrap("r2")
      );
    });

    it("should accept 0 repetitions", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "A", END]) {
        parser.accept(tk);
      }
      // console.log(JSON.stringify(parser.result(), null, 2));
      assert.equal(parser.status, "ok");

      assert.equal( parser.result(), "r1(A,[],A)");
    });

    it("should accept 1 repetitions", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "B", "A", END]) {
        parser.accept(tk);
      }
      // console.log(JSON.stringify(parser.result(), null, 2));
      assert.equal(parser.status, "ok");

      assert.equal( parser.result(), "r1(A,[r2(B)],A)");
    });

    it("should accept 2 repetitions", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "B", "B", "A", END]) {
        parser.accept(tk);
      }
      // console.log(JSON.stringify(parser.result(), null, 2));
      assert.equal(parser.status, "ok");

      assert.equal( parser.result(), "r1(A,[r2(B),r2(B)],A)" );
    });

    it("should reject bad sentences", function() {
      this.timeout(1000);

      const testCases = [
        ["A", "A", "A", END],
        ["A", "A", "B", END],
        ["A", "B", "A", "B", END],
        ["A", "B", "C", "B", END],
        ["A", "B", "B", "A", "B", END],
        ["A", "B", "B", "B", "A", "B", END],
      ];

      for(let testCase of testCases) {
        const parser = grammar.parser("r1");
        for(let tk of testCase) {
          parser.accept(tk);
        }
        assert.equal(parser.status, "failure", testCase.join(" "));
      }
    });
  });


  describe("one-or-more quantifier", function() {
    let grammar;

    beforeEach(function() {
      grammar = new Grammar();
      grammar.define("r1",
        [Token("A"), OneOrMore(Rule("r2")), Token("A")],
        [Token("C")],
        Wrap("r1")
      );

      grammar.define("r2",
        [ Token("B") ],
        [ Token("C") ],
        Wrap("r2")
      );
    });

    it("should reject 0 repetitions", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "A", END]) {
        parser.accept(tk);
      }
      // console.log(JSON.stringify(parser.result(), null, 2));
      assert.equal(parser.status, "failure");
    });

    it("should accept 1 repetitions", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "B", "A", END]) {
        parser.accept(tk);
      }
      // console.log(JSON.stringify(parser.result(), null, 2));
      assert.equal(parser.status, "ok");

      assert.equal( parser.result(), "r1(A,[r2(B)],A)");
    });

    it("should accept 2 repetitions", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "B", "B", "A", END]) {
        parser.accept(tk);
      }
      // console.log(JSON.stringify(parser.result(), null, 2));
      assert.equal(parser.status, "ok");

      assert.equal( parser.result(), "r1(A,[r2(B),r2(B)],A)" );
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
        const parser = grammar.parser("r1");
        for(let tk of testCase) {
          parser.accept(tk);
        }
        assert.equal(parser.status, "failure", testCase.join(" "));
      }
    });
  });

  describe("backtracking", function() {

    it("should backtrack in quantifiers", function() {
      const grammar = new Grammar();
      grammar.define("r1",
        [ ZeroOrMore(Token("A")), Token("A"), Token("A") ] ,
        Wrap("r1")
      );

      const parser = grammar.parser("r1");
      parser.accept("A", "A", "A", "A", END);

      assert.equal(parser.status, "ok");

      assert.equal( parser.result(), "r1([A,A],A,A)" );
    });

  });

  describe("complex cases", function() {

    it("deep grammar", function() {
      this.timeout(1000);

      const grammar = new Grammar();
      grammar.define("r1", [Token("A"), ZeroOrOne(Rule("r2"))], [Token("B"), ZeroOrOne(Rule("r2"))]);
      grammar.define("r2", [Token("A"), ZeroOrOne(Rule("r3"))], [Token("B"), ZeroOrOne(Rule("r3"))]);
      grammar.define("r3", [Token("A"), ZeroOrOne(Rule("r4"))], [Token("B"), ZeroOrOne(Rule("r4"))]);
      grammar.define("r4", [Token("A"), ZeroOrOne(Rule("r5"))], [Token("B"), ZeroOrOne(Rule("r5"))]);
      grammar.define("r5", [Token("A"), ZeroOrOne(Rule("r6"))], [Token("B"), ZeroOrOne(Rule("r6"))]);
      grammar.define("r6", [Token("A")], [Token("B")]);

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
        const parser = grammar.parser("r1");
        for(let tk of testCase) {
          parser.accept(tk);
        }
        assert.equal(parser.status, "ok", testCase.join(" "));
      }
    });

    it("nested quantifiers", function() {
      this.timeout(1000);

      const grammar = new Grammar();
      grammar.define("r1", [Token("A"), ZeroOrMore(Rule("r2"))]);
      grammar.define("r2", [Token("B"), OneOrMore(Rule("r3"))]);
      grammar.define("r3", [Token("C")]);

      const testCases = [
        ["A", END],
        ["A", "B", "C", END],
        ["A", "B", "C", "B", "C",END],
        ["A", "B", "C", "C", "B", "C", END],
      ];

      for(let testCase of testCases) {
        const parser = grammar.parser("r1");
        for(let tk of testCase) {
          parser.accept(tk);
        }
        assert.equal(parser.status, "ok", testCase.join(" "));
      }
    });

  });
});

