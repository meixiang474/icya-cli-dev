'use strict';

module.exports = { isObject };

function isObject(o) {
  return Object.prototype.toString.call(o) === '[object Object]';
}
