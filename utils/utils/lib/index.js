'use strict';

module.exports = { isObject };
console.log('utils');
function isObject(o) {
  return Object.prototype.toString.call(o) === '[object Object]';
}
