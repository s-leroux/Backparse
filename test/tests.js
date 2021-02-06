"use strict";

const debug = require("debug")("asciishaman:tests");

const assert = require("chai").assert;

describe("module", function() {
  let shaman = null;

  it("should be loadable", function() {
    const gp = require("../index.js");
  });
});

require("./builder");
require("./parser");
require("./parser-advanced");

require("./examples/calculator");
