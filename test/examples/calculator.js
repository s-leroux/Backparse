"use strict";

const debug = require("debug")("backparse:example-calculator");
const chai = require("chai");
const assert = chai.assert;

const { Grammar, rule, token, opt, several, END } = require("../../lib/parser");

// Tokens as they could be returned from a typical tokenizer
const Integer = (str) => ({ str: str, tag: "int"});
const Plus = () => ({ str: "+", tag: "+"});
const Mul = () => ({ str: "*", tag: "*"});
const LPar = () => ({ str: "(", tag: "(" });
const RPar = () => ({ str: ")", tag: ")" });

// A grammar for basic arithmetic operations
const grammar = new Grammar();
grammar.define("expr", [ rule("sum") ]);
grammar.define("sum", 
  [ rule("product"), token('+'), rule("expr") ],
  [ rule("product") ]
);
grammar.define("product", 
  [ rule("term"), token('*'), rule("product") ],
  [ rule("term") ]
);
grammar.define("term", 
  [ rule('parenthesis') ],
  [ token("int") ]
);
grammar.define("parenthesis", 
  [ token('('), rule("expr"), token(')') ]
);

class Packer {
  token(tk) {
    if (tk.tag == "int")
      return parseInt(tk.str);
    else
      return tk;
  }

  rule(name, ...args) {
    switch(name) {
      case 'expr': return args[0];
      case 'sum': return args[0] + (args[2] ?? 0);
      case 'product': return args[0] * (args[2] ?? 1);
      case 'term': return args[0];
      case 'parenthesis': return args[1];
    }
  }

  match({str, tag}, expected) {
    return tag == expected;
  }
};


describe("calculator (example)", function() {

  it("precedence", function() {
    const parser = grammar.parser("expr" ,new Packer);
    parser.accept(Integer("2"), Plus(), Integer('3'), Mul(), Integer("4"), END);

    assert.equal(parser._status, "success");
    assert.equal(parser.ast(), 14);
  });

  it("parenthesis", function() {
    const parser = grammar.parser("expr" ,new Packer);
    parser.accept(LPar(), Integer("2"), Plus(), Integer('3'), RPar(), Mul(), Integer("4"), END);

    assert.equal(parser._status, "success");
    assert.equal(parser.ast(), 20);
  });

});
