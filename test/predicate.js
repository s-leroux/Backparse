"use strict";

const debug = require("debug")("backparse:parser");
const chai = require("chai");
const assert = chai.assert;

const {  Test, ZeroOrMore, Alternatives } = require("../lib/predicate");


describe("The compiler", function() {

  it("should compile tests", function() {
    const sentinel = Symbol();
    const result = Test(sentinel);

    assert.deepEqual(result, [
      /* 00 */ "test", sentinel
    ]);
  });

  it("should compile alternatives", function() {
    const sentinel1 = Symbol();
    const sentinel2 = Symbol();
    const sentinel3 = Symbol();

    const result = Alternatives(
      Test(sentinel1),
      Test(sentinel2),
      Test(sentinel3),
    );

    assert.deepEqual(result, [
      /* 00 */ "failpoint", +4,
      /* 02 */ "test", sentinel1,
      /* 04 */ "jump", +4,
      /* 06 */ "failpoint", +4,
      /* 08 */ "test", sentinel2,
      /* 10 */ "jump", +4,
      /* 12 */ "failpoint", +4,
      /* 14 */ "test", sentinel3,
      /* 16 */ "jump", +2,
      /* 18 */ "fail", undefined,
    ]);
  });

  it("should compile sequences", function() {
    const sentinel1 = Symbol();
    const sentinel2 = Symbol();
    const sentinel3 = Symbol();

    const result = Alternatives(
      [ Test(sentinel1), Test(sentinel2) ],
      Test(sentinel3),
    );

    assert.deepEqual(result, [
      /* 00 */ "failpoint", +6,
      /* 02 */ "test", sentinel1,
      /* 08 */ "test", sentinel2,
      /* 10 */ "jump", +4,
      /* 12 */ "failpoint", +4,
      /* 14 */ "test", sentinel3,
      /* 16 */ "jump", +2,
      /* 18 */ "fail", undefined,
    ]);
  });

  it("should compile repeat", function() {
    const sentinel1 = Symbol();

    const result = ZeroOrMore(Test(sentinel1));

    assert.deepEqual(result, [
      /* 00 */ "frame", undefined,
      /* 02 */ "failpoint", +4,
      /* 04 */ "test", sentinel1,
      /* 06 */ "jump", -6,
      /* 08 */ "pack", undefined,
    ]);
  });

});

