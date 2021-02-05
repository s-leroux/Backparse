"use strict";

const debug = require("debug")("backparse:tests-packer");
const chai = require("chai");
const assert = chai.assert;

const { FlatPacker } = require("../lib/packer");

describe("flat-packer", function() {
  const packer = new FlatPacker;

  it("should pack the terminals as atoms", function() {
    assert.equal("A", packer.token("A"));
  });

  it("should pack the non-terminals as calls", function() {
    assert.equal("r(A,B)", packer.rule("r", "A","B"));
  });

});

