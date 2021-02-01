const debug = require("debug")("backparse:tests-parser");
const chai = require('chai');
const assert = chai.assert;

const { Parser, rule, token, success, END } = require("../lib/parser");

describe("The parser", function() {
    this.timeout(50);

    it("should accept recursive grammars", function() {
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
      assert.equal(parser._status, "success");
      let ast = parser.ast();
      console.log(JSON.stringify(ast, null, 2));
    });


    it("should accept mutually recursive grammars", function() {
      const parser = new Parser("r1");
      parser.define("r1",
        [token('A'), rule("r2")],
        [token('A')]
      );

      parser.define("r2",
        [ token('B'), rule("r1") ],
      );


      for(let tk of ['A', 'B', 'A', 'B', 'A', 'B', 'A', END]) {
        parser.accept(tk);
      }
      assert.equal(parser._status, "success");
    });

    it("should follow the longuest sentence", function() {
      const parser = new Parser("r1");
      parser.define("r1",
        [rule("r2")]
      );

      parser.define("r2",
        [ token('A'), rule("r2") ],
        [ token('B'), rule("r2") ],
        [ token('A') ],
        [ token('B') ]
      );


      for(let tk of ['A', 'B', 'A', 'B', 'A', END]) {
        parser.accept(tk);
      }
      assert.equal(parser._status, "success");
      let ast = parser.ast();
      console.log(JSON.stringify(ast, null, 2));
    });

    it("should detect invalid sentences", function() {
      const parser = new Parser("r1");
      parser.define("r1",
        [token("A"), rule("r2"), token("A")]
      );

      parser.define("r2",
        [ token('B'), rule("r2") ],
        [ token('B') ]
      );


      for(let tk of ['A', 'B', 'A', 'B', 'A', END]) {
        parser.accept(tk);
      }
      assert.equal(parser._status, "failure");
      let ast = parser.ast();
      console.log(JSON.stringify(ast, null, 2));
    });

    it("should accept epsilon-transitions", function() {
      const parser = new Parser("r1");
      parser.define("r1",
        [token('A'), rule("r2"), token("A")],
        [token('C')]
      );

      parser.define("r2",
        [ token('B'), rule("r2") ],
        [  ]
      );


      for(let tk of ['A', 'B', 'B', 'A', END]) {
        parser.accept(tk);
      }
      assert.equal(parser._status, "success");
      let ast = parser.ast();
      console.log(JSON.stringify(ast, null, 2));
    });


    it("should ...", function() {
      const parser = new Parser("text");
      parser.define("text",
        [token('word'), rule("em")],
        [token('word'), rule("text")],
        [token('word')],
      );

      parser.define("em",
        [ token('em'), token('word'), token("em") ],
      );


      for(let tk of ['word', 'word', 'em', 'word', 'em', END]) {
        parser.accept(tk);
      }
      assert.equal(parser._status, "success");
    });

    it("should ...", function() {
      const parser = new Parser("r1");
      parser.define("r1",
        [token('A'), rule("r2")],
      );
      parser.define("r2",
        [token('B'), rule("r3")],
      );
      parser.define("r3",
        [token('C'), rule("r4")],
        [token('E')],
      );
      parser.define("r4",
        [token('D')],
      );


      for(let tk of ['A', 'B', 'E', END]) {
        parser.accept(tk);
      }

      let ast = parser.ast();
      console.log(JSON.stringify(ast, null, 2));
      assert.equal(parser._status, "success");
    });

});

