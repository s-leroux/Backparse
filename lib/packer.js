"use strict";

/*
  The default implementation simply wrap the children into a new
  object.
*/
class DefaultPacker {
  rule(name, ...children) {
    return {
      name: name,
      children: children,
    };
  }

  token(tk) {
    return tk;
  }

  match(actual, expected) {
    return actual == expected;
  }
}

class FlatPacker {
  rule(name, ...children) {
    return `${name}(${children.join(",")})`;
  }

  token(tk) {
    return tk;
  }

  match(actual, expected) {
    return actual == expected;
  }
}

module.exports = {
  DefaultPacker: DefaultPacker,
  FlatPacker: FlatPacker,
};
