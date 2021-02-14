"use strict";

const debug = require("debug")("backparse:tests-builder");
const chai = require("chai");
const assert = chai.assert;

const { Wrap } = require("../lib/helper");

describe("wrap", function() {
  it("should pack the terminals as atoms", function() {
    assert.equal("A()", Wrap("A")({}));
  });

  it("should pack the non-terminals as calls", function() {
    assert.equal("r(A,B)", Wrap("r")({}, "A","B"));
  });

});

