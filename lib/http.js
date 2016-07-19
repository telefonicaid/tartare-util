/*

 Copyright 2015-2016 Telefonica Investigación y Desarrollo, S.A.U

 This file is part of Tartare.

 Tartare is free software: you can redistribute it and/or modify it under the
 terms of the Apache License as published by the Apache Software Foundation,
 either version 2.0 of the License, or (at your option) any later version.
 Tartare is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the Apache License for more details.

 You should have received a copy of the Apache License along with Tartare.
 If not, see http://www.apache.org/licenses/LICENSE-2.0

 For those usages not covered by the Apache License please contact with:
 joseantonio.rodriguezfernandez@telefonica.com

 */

/**
 * This module has several HTTP utils
 */

'use strict';

var http = require('http');

function getReason(statusCode) {
  return (statusCode in http.STATUS_CODES ? http.STATUS_CODES[statusCode] : 'Unknown status code');
}

/**
 * Return the same object passed as parameter with all its properties lower-cased.
 * Useful with HTTP headers since they are case-insensitive.
 *
 * @param {Object} headers
 * @return {Object}
 */
function lowerCaseHeaders(headers) {
  var lowerCasedHeaders = {};

  Object.keys(headers || {}).forEach(function(headerName) {
    lowerCasedHeaders[headerName.toLowerCase()] = headers[headerName];
  });

  return lowerCasedHeaders;
}

/**
 * Return the charset (if any) from a Content-Type header value.
 * @param {string} value
 * @return {?string}
 */
function getCharsetFromContentType(value) {
  if (!value) {
    return null;
  }
  var charsetRegexp = /^.*;\s*charset=["']?([A-Za-z0-9\-_.:()]+)["']?(?:;.*)*$/i;
  var matches = value.match(charsetRegexp);
  return (matches ? matches[1].toLowerCase() : null);
}

module.exports = {
  getReason: getReason,
  lowerCaseHeaders: lowerCaseHeaders,
  getCharsetFromContentType: getCharsetFromContentType
};
