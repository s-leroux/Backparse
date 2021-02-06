"use strict";

/*
  The default implementation simply wrap the children into a new
  object.
*/
function defaultBuilder(name, ...children) {
  return {
    name: name,
    children: children,
  };
}

function flatBuilder(name, ...children) {
  return `${name}(${children.join(",")})`;
}

module.exports = {
  defaultBuilder: defaultBuilder,
  flatBuilder: flatBuilder,
};
