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

'use strict';

var os = require('os');
var fs = require('fs');

/**
 * Guess the OS you are running, taking into account different Linux distributions.
 * @return {?String}
 */
function getOS() {
  switch (os.platform()) {
    case 'linux':
      // There is no a standard way of detecting Linux distributions inside Node.js
      try {
        // Try Redhat
        fs.readFileSync('/etc/redhat-release', {encoding: 'utf-8'});
        return 'redhat';
      } catch (errRedhat) {
        try {
          // Try Ubuntu
          var release = fs.readFileSync('/etc/lsb-release', {encoding: 'utf-8'});
          if (release.split(os.EOL)[0].match(/ubuntu/i)) {
            return 'ubuntu';
          }
        } catch (errUbuntu) {
          return null;
        }
      }
      break;
    case 'darwin':
      return 'osx';
    default:
      return null;
  }
}

module.exports = {
  NONASCII_STRING: 'ÁÉÍÓÚÄËÏÖÜÂÊÎÔÛÀÈÌÒÙÑÇáéíóúäëïöüâêîôûàèìòùñç',
  INJECTION_STRING: '<>{}()[]%&\'"=\\/?*.,;',

  getOS: getOS
};
