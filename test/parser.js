"use strict";

const debug = require("debug")("backparse:tests-parser");
const chai = require("chai");
const assert = chai.assert;

const { Parser, rule, token, END } = require("../lib/parser");

describe("The parser", function() {
  this.timeout(50);

  it("should accept recursive grammars", function() {
    const parser = new Parser("r1");
    parser.define("r1",
      [token("A"), rule("r2"), token("A")],
      [token("C")]
    );

    parser.define("r2",
      [ token("B"), rule("r2") ],
      [ token("B") ]
    );

    for(let tk of ["A", "B", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
            parser.ast(),
            {
              "trace": "R:r1",
              "children": [
                {
                  "trace": "T:A",
                  "children": []
                },
                {
                  "trace": "R:r2",
                  "children": [
                    {
                      "trace": "T:B",
                      "children": []
                    },
                    {
                      "trace": "R:r2",
                      "children": [
                        {
                          "trace": "T:B",
                          "children": []
                        }
                      ]
                    }
                  ]
                },
                {
                  "trace": "T:A",
                  "children": []
                }
              ]
            }
    );
  });


  it("should accept mutually recursive grammars", function() {
    const parser = new Parser("r1");
    parser.define("r1",
      [token("A"), rule("r2")],
      [token("A")]
    );

    parser.define("r2",
      [ token("B"), rule("r1") ],
    );


    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
            parser.ast(),
            {
              "trace": "R:r1",
              "children": [
                {
                  "trace": "T:A",
                  "children": []
                },
                {
                  "trace": "R:r2",
                  "children": [
                    {
                      "trace": "T:B",
                      "children": []
                    },
                    {
                      "trace": "R:r1",
                      "children": [
                        {
                          "trace": "T:A",
                          "children": []
                        },
                        {
                          "trace": "R:r2",
                          "children": [
                            {
                              "trace": "T:B",
                              "children": []
                            },
                            {
                              "trace": "R:r1",
                              "children": [
                                {
                                  "trace": "T:A",
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
    const parser = new Parser("r1");
    parser.define("r1",
      [rule("r2")]
    );

    parser.define("r2",
      [ token("A"), rule("r2") ],
      [ token("B"), rule("r2") ],
      [ token("A") ],
      [ token("B") ]
    );


    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    let ast = parser.ast();
    assert.deepEqual(
            parser.ast(),
            {
              "trace": "R:r1",
              "children": [
                {
                  "trace": "R:r2",
                  "children": [
                    {
                      "trace": "T:A",
                      "children": []
                    },
                    {
                      "trace": "R:r2",
                      "children": [
                        {
                          "trace": "T:B",
                          "children": []
                        },
                        {
                          "trace": "R:r2",
                          "children": [
                            {
                              "trace": "T:A",
                              "children": []
                            },
                            {
                              "trace": "R:r2",
                              "children": [
                                {
                                  "trace": "T:B",
                                  "children": []
                                },
                                {
                                  "trace": "R:r2",
                                  "children": [
                                    {
                                      "trace": "T:A",
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
    const parser = new Parser("r1");
    parser.define("r1",
      [token("A"), rule("r2"), token("A")]
    );

    parser.define("r2",
      [ token("B"), rule("r2") ],
      [ token("B") ]
    );


    for(let tk of ["A", "B", "A", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "failure");
  });

  it("should accept epsilon-transitions", function() {
    const parser = new Parser("r1");
    parser.define("r1",
      [token("A"), rule("r2"), token("A")],
      [token("C")]
    );

    parser.define("r2",
      [ token("B"), rule("r2") ],
      [  ]
    );


    for(let tk of ["A", "B", "B", "A", END]) {
      parser.accept(tk);
    }
    assert.equal(parser._status, "success");
    assert.deepEqual(
            parser.ast(),
            {
              "trace": "R:r1",
              "children": [
                {
                  "trace": "T:A",
                  "children": []
                },
                {
                  "trace": "R:r2",
                  "children": [
                    {
                      "trace": "T:B",
                      "children": []
                    },
                    {
                      "trace": "R:r2",
                      "children": [
                        {
                          "trace": "T:B",
                          "children": []
                        },
                        {
                          "trace": "R:r2",
                          "children": []
                        }
                      ]
                    }
                  ]
                },
                {
                  "trace": "T:A",
                  "children": []
                }
              ]
            }
    );
  });


});

