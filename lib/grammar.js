"use strict";

const { Routine } = require("./predicate");
const { Parser } = require("./parser");

class Grammar {
  constructor() {
    this._grammar = new Map();
  }

  /*
      Define a new rule.

      If a rule with the same name already exists in the
      grammar, it is replaced.
  */
  define(name, ...forms) {
    this._grammar.set(name, Routine(...forms));
  }

  get(rule) {
    return this._grammar.get(rule);
  }

  parser(...args) {
    return new Parser(this, ...args);
  }
}

module.exports = {
  Grammar: Grammar,
};
