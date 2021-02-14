"use strict";

function Alternatives(...alternatives) {
  const result = [];
  let i = 0;


  for(let alternative of alternatives) {
    alternative = alternative.flat(Infinity);

    if (i++ > 0) {
      result.push(
        "jump", alternative.length+2,
      );
    }

    result.push(
      "failpoint", alternative.length+2,
      ...alternative
    );
  }

  result.push(
    "jump", +2,
    "fail", undefined,
  );

  return result;
}

function Routine(...args) {
  let epilog;

  if ("call" in args[args.length-1]) {
    epilog = [
      "pack", args.splice(-1)[0]
    ];
  }
  else {
    epilog = [
      "pack", undefined
    ];
  }

  return [
    "frame", undefined,
    ...Alternatives(...args),
    ...epilog,
    "ret", undefined,
  ];
}

/*
  Push a constant. Useful as a hint or for default values:

  define("initializer",
    [ '=' Token(INT) ],
    [ Const(0) ]
  );
*/
function Const(value) {
  return [
    "pushd", value
  ];
}

function Test(fct) {
  return [
    "test", fct
  ];
}

function Token(value) {
  return Test((tk, fail) => (tk === value) ? tk : fail);
}

function Rule(name) {
  return [
    "jsr", name,
  ];
}

function ZeroOrMore(code) {
  return [
    "frame", undefined,
    "failpoint", code.length+2,
    ...code,
    "jump", -code.length-4,
    "pack", undefined,
  ];
}

function OneOrMore(code) {
  return [
    "frame", undefined,
    ...code,
    "failpoint", +2,
    "jump", -code.length-4,
    "pack", undefined,
  ];
}

function ZeroOrOne(code) {
  return [
    "failpoint", code.length+2,
    ...code,
    "jump", +2,
    "pushd", undefined,
  ];
}

module.exports = {
  Const,
  Test,
  Token,
  Rule,
  Routine,
  ZeroOrMore,
  OneOrMore,
  ZeroOrOne,
  Alternatives,
};
