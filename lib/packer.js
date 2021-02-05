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
}

class FlatPacker {
  rule(name, ...children) {
    return `${name}(${children.join(",")})`;
  }

  token(tk) {
    return tk;
  }
}

module.exports = {
  DefaultPacker: DefaultPacker,
  FlatPacker: FlatPacker,
};
