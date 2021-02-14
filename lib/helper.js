"use strict";

function Wrap(name) {
  return function(fail, ...children) {
    children = children.map((item) => (Array.isArray(item) ? "[" + item.join(",") + "]": item));
    children = children.map((item) => (item === undefined ? "undefined" : item));
    return `${name}(${children.join(",")})`;
  };
}
module.exports = {
  Wrap,
};
