"use strict";

const debug = require("debug")("backparse:tests-parser");
const chai = require("chai");
const assert = chai.assert;

const { Grammar, rule, token, opt, END } = require("../lib/parser");

describe("The parser", function() {
  this.timeout(70);

  it("should accept recursive grammars", function() {
    const grammar = new Grammar("r1");
    grammar.define("r1",
      [token("A"), rule("r2"), token("C")],
      [token("C")]
    );

    grammar.define("r2",
      [ token("B"), rule("r2") ],
      [ token("B") ]
    );

    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "B", "C", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
      parser.ast(),
      {
        "value": "r1",
        "children": [
          {
            "value": "A",
            "children": []
          },
          {
            "value": "r2",
            "children": [
              {
                "value": "B",
                "children": []
              },
              {
                "value": "r2",
                "children": [
                  {
                    "value": "B",
                    "children": []
                  }
                ]
              }
            ]
          },
          {
            "value": "C",
            "children": []
          }
        ]
      }
    );
  });


  it("should accept mutually recursive grammars", function() {
    const grammar = new Grammar("r1");
    grammar.define("r1",
      [token("A"), rule("r2")],
      [token("A")]
    );

    grammar.define("r2",
      [ token("B"), rule("r1") ],
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
      parser.ast(),
      {
        "value": "r1",
        "children": [
          {
            "value": "A",
            "children": []
          },
          {
            "value": "r2",
            "children": [
              {
                "value": "B",
                "children": []
              },
              {
                "value": "r1",
                "children": [
                  {
                    "value": "A",
                    "children": []
                  },
                  {
                    "value": "r2",
                    "children": [
                      {
                        "value": "B",
                        "children": []
                      },
                      {
                        "value": "r1",
                        "children": [
                          {
                            "value": "A",
                            "children": []
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    );
  });

  it("should follow the longuest sentence", function() {
    const grammar = new Grammar("r1");
    grammar.define("r1",
      [rule("r2")]
    );

    grammar.define("r2",
      [ token("A"), rule("r2") ],
      [ token("B"), rule("r2") ],
      [ token("A") ],
      [ token("B") ]
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
      parser.ast(),
      {
        "value": "r1",
        "children": [
          {
            "value": "r2",
            "children": [
              {
                "value": "A",
                "children": []
              },
              {
                "value": "r2",
                "children": [
                  {
                    "value": "B",
                    "children": []
                  },
                  {
                    "value": "r2",
                    "children": [
                      {
                        "value": "A",
                        "children": []
                      },
                      {
                        "value": "r2",
                        "children": [
                          {
                            "value": "B",
                            "children": []
                          },
                          {
                            "value": "r2",
                            "children": [
                              {
                                "value": "A",
                                "children": []
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    );
  });

  it("should detect invalid sentences", function() {
    const grammar = new Grammar("r1");
    grammar.define("r1",
      [token("A"), rule("r2"), token("A")]
    );

    grammar.define("r2",
      [ token("B"), rule("r2") ],
      [ token("B") ]
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "failure");
  });

  it("should accept epsilon-transitions", function() {
    const grammar = new Grammar("r1");
    grammar.define("r1",
      [token("A"), rule("r2"), token("A")],
      [token("C")]
    );

    grammar.define("r2",
      [ token("B"), rule("r2") ],
      [  ]
    );


    const parser = grammar.parser("r1");
    for(let tk of ["A", "B", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
      parser.ast(),
      {
        "value": "r1",
        "children": [
          {
            "value": "A",
            "children": []
          },
          {
            "value": "r2",
            "children": [
              {
                "value": "B",
                "children": []
              },
              {
                "value": "r2",
                "children": [
                  {
                    "value": "B",
                    "children": []
                  },
                  {
                    "value": "r2",
                    "children": []
                  }
                ]
              }
            ]
          },
          {
            "value": "A",
            "children": []
          }
        ]
      }
    );
  });

  describe("optional path", function() {
    let grammar;

    beforeEach(function() {
      grammar = new Grammar("r1");
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
      const parser = grammar.parser("r1");
      for(let tk of ["A", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.deepEqual(
        parser.ast(),
        {
          "value": "r1",
          "children": [
            {
              "value": "A",
              "children": []
            },
            {
              "value": "A",
              "children": []
            }
          ]
        }
      );
    });

    it("should accept optional paths (1st)", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "B", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      assert.equal(parser._status, "success");

      assert.deepEqual(
        parser.ast(),
        {
          "value": "r1",
          "children": [
            {
              "value": "A",
              "children": []
            },
            {
              "value": "r2",
              "children": [
                {
                  "value": "B",
                  "children": []
                }
              ]
            },
            {
              "value": "A",
              "children": []
            }
          ]
        }
      );
    });

    it("should accept optional paths (2nd)", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "C", "A", END]) {
        parser.accept(tk);
      }
      console.log(JSON.stringify(parser.ast(), null, 2));
      console.log(parser.ast());
      assert.equal(parser._status, "success");
      assert.deepEqual(
        parser.ast(),
        {
          "value": "r1",
          "children": [
            {
              "value": "A",
              "children": []
            },
            {
              "value": "r2",
              "children": [
                {
                  "value": "C",
                  "children": []
                }
              ]
            },
            {
              "value": "A",
              "children": []
            }
          ]
        }
      );
    });

    it("should detect bad token in the optional paths", function() {
      const parser = grammar.parser("r1");
      for(let tk of ["A", "D", "A", END]) {
        parser.accept(tk);
      }
      assert.equal(parser._status, "failure");

    });
  });

});

