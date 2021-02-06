"use strict";

const debug = require("debug")("backparse:tests-builder");
const chai = require("chai");
const assert = chai.assert;

const { flatBuilder } = require("../lib/builder");

describe("flat-builder", function() {
  const builder = flatBuilder;

  it("should pack the terminals as atoms", function() {
    assert.equal("A()", builder("A"));
  });

  it("should pack the non-terminals as calls", function() {
    assert.equal("r(A,B)", builder("r", "A","B"));
  });

});

