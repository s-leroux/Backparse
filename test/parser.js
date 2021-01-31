const debug = require("debug")("backparse:tests-parser");
const chai = require('chai');
const assert = chai.assert;

const { Parser, rule, token, success, END } = require("../lib/parser");

describe("parser", function() {
    this.timeout(50);

    it("should explore the grammar", function() {
      console.log(Parser);
      const parser = new Parser("r1");
      parser.define("r1",
        [token('A'), rule("r2"), token("A")],
        [token('C')]
      );

      parser.define("r2",
        [ token('B'), rule("r2") ],
        [ token('B') ]
      );


      for(let tk of ['A', 'B', 'B', 'A', END]) {
        parser.accept(tk);
      }
      console.log(parser._state == parser._success);
      console.log(parser._status);
    });

});

