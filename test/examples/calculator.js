"use strict";

const debug = require("debug")("backparse:example-calculator");
const chai = require("chai");
const assert = chai.assert;

const { Grammar } = require("../../lib/grammar");
const { Test, Token, Rule } = require("../../lib/predicate");
const { Parser, END } = require("../../lib/parser");

// Tokens as they could be returned from a typical tokenizer
const Integer = (str) => ({ value: str, tag: "int"});
const Plus = () => ("+");
const Mul = () => ("*");
const LPar = () => ("(");
const RPar = () => (")");

function MyLexeme(tag) {
  return Test((tk, fail) => (tk.tag == tag ? tk.value : fail));
}

// A grammar for basic arithmetic operations
const grammar = new Grammar();
grammar.define("expr",
  [ Rule("sum") ],
  (fail,expr) => expr
);
grammar.define("sum", 
  [ Rule("product"), Token("+"), Rule("expr") ],
  [ Rule("product") ],
  function(fail,a,op,b) {
    return (op) ? a+b : a;
  }
);
grammar.define("product", 
  [ Rule("term"), Token("*"), Rule("product") ],
  [ Rule("term") ],
  function(fail,a,op,b) {
    return (op) ? a*b : a;
  }
);
grammar.define("term", 
  [ Rule("parenthesis") ],
  [ Rule("int") ],
  function(fail,value) {
    return value;
  }
);
grammar.define("parenthesis", 
  [ Token("("), Rule("expr"), Token(")") ],
  function(fail,lpar, expr, rpar) {
    return expr;
  }
);
grammar.define("int",
  [ MyLexeme("int") ],
  function(fail,i) {
    return parseInt(i);
  }
);


describe("calculator (example)", function() {

  it("precedence", function() {
    const parser = grammar.parser("expr");
    parser.accept(Integer("2"), Plus(), Integer("3"), Mul(), Integer("4"), END);

    assert.equal(parser.status, "ok");
    assert.equal(parser.result(), 14);
  });

  it("parenthesis", function() {
    const parser = grammar.parser("expr");
    parser.accept(LPar(), Integer("2"), Plus(), Integer("3"), RPar(), Mul(), Integer("4"), END);

    assert.equal(parser.status, "ok");
    assert.equal(parser.result(), 20);
  });

});

