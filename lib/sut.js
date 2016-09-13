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

var fs = require('fs');
var mustache = require('mustache');
var _ = require('lodash');
var os = require('os');
var cp = require('child_process');
var tartareUtil = require('./util');
var which = require('which');

/**
 * Read a configuration file containing mustache placeholders, replace them with baseConfig and additionalConfig,
 * and write the resulting configuration file.
 *
 * @param {string} templateConfigFile Configuration template filename containing mustache placeholders.
 * @param {string} outputConfigFile Resulting file after having applied configurations over templateConfigFile.
 * @param {Object} baseConfig Configuration object to be applied over templateConfigFile's mustache placeholders.
 * @param {?Object} additionalConfig The same that the former parameter. Properties in this object will
 *          overwrite the ones in baseConfig with the same name. This allows using a basic configuration in
 *          baseConfig and some more specific configuration in additionalConfig.
 */
function renderConfigFile(templateConfigFile, outputConfigFile, baseConfig, additionalConfig) {
  var configTemplate = fs.readFileSync(templateConfigFile, {encoding: 'utf-8'});
  var config = {};
  _.assign(config, baseConfig, additionalConfig);
  var outputConfig = mustache.render(configTemplate, config);
  fs.writeFileSync(outputConfigFile, outputConfig, {encoding: 'utf-8'});
}

/**
 * Run an instance of a generic server and optionally wait for something to be written in stdout or stderr to consider
 * that the server has correctly started.
 *
 * @param {Object} serverOpts Object with the following information about the server:
 *          - {string} command The server executable command.
 *          - {?string[]} args Array of arguments to be passed to the server.
 *          - {?Object} env Environment key-value pairs.
 *          - {?string} cwd Current working directory of the child process.
 *          - {?(string|string[])} startupMessages Messages to be searched in stdout or stderr to consider that
 *              the served has started. If it doesn't exist or is null this function will wait for the server to exit,
 *              or for the timeout to expire.
 * @param {?number} timeout Max time (in ms) to wait for the server to start (Defaults to 5000).
 * @param {Function} cb The callback function will be called with the error and an object with the following parameters:
 *          - {number} pid The process' pid (only if it has been started).
 *          - {Stream} stdout A Readable Stream that represents the process' stdout (only if it has been started).
 *          - {Stream} stderr A Readable Stream that represents the process' stderr (only if it has been started).
 *          - {Stream} stdin A Writable Stream that represents the child process' stdin (only if it has been started).
 *          - {string} readStdout What the process has already written to stdout.
 *          - {string} readStderr What the process has already written to stderr.
 *          - {number} exitCode Exit code returned by the process, in case it has exited.
 *          - {string} signal Signal that terminated the process, in case it has exited.
 */
function startServer(serverOpts, timeout, cb) {
  if (!cb && (timeout instanceof Function)) {
    cb = timeout;
    timeout = null;
  }
  timeout = timeout || 5000;

  if (serverOpts.startupMessages) {
    if (!Array.isArray(serverOpts.startupMessages)) {
      serverOpts.startupMessages = [serverOpts.startupMessages];
    } else if (!serverOpts.startupMessages.length) {
      serverOpts.startupMessages = null;  // An empty array of startupMessages is like nothing
    }
  }
  var startupMessagesFound = serverOpts.startupMessages ?
      serverOpts.startupMessages.map(function() {
        return false;
      }) :
      null;

  var server = cp.spawn(serverOpts.command, serverOpts.args, {cwd: serverOpts.cwd, env: serverOpts.env});

  var readStderr = '';
  var readStdout = '';

  var timeoutId = setTimeout(function() {
    // Just in case the server does not start properly after some time
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    if (serverOpts.startupMessages) {
      // If there is some startupMessage, exiting by timeout is an error
      server.kill();
      var err = new Error('The Server couldn\'t be started before ' + timeout + ' milliseconds');
      err.stderr = readStderr;
      err.stdout = readStdout;
      cb(err);
    } else {
      // If there is not any startupMessage, exiting by timeout is ok (start and wait)
      cb(null, {
        pid: server.pid,
        stdout: server.stdout,
        stderr: server.stderr,
        stdin: server.stdin,
        readStdout: readStdout,
        readStderr: readStderr
      });
    }
  }, timeout);

  server.on('error', function(err) {
    clearTimeout(timeoutId);
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    cb(err);
  });
  server.on('exit', function(code, signal) {
    clearTimeout(timeoutId);
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    if (serverOpts.startupMessages) {
      // If there is some startupMessage and the process exits before finding such messages, it is an error
      var err = new Error('Server finished with exit code "' + code + '" and signal "' + signal + '"');
      err.stdout = readStdout;
      err.stderr = readStderr;
      cb(err);
    } else {
      // If there is not any startupMessage and the process exits, it is ok
      cb(null, {
        readStdout: readStdout,
        readStderr: readStderr,
        code: code,
        signal: signal
      });
    }
  });

  function _checkStartupMessages() {
    serverOpts.startupMessages.forEach(function(startupMsg, index) {
      if (readStdout.indexOf(startupMsg) !== -1 || readStderr.indexOf(startupMsg) !== -1) {
        startupMessagesFound[index] = true;
      }
    });
    if (startupMessagesFound.reduce(function(previousValue, currentValue) {
      return previousValue && currentValue;
    }, true)) {
      // When all startupMessages have been found
      clearTimeout(timeoutId);
      server.removeAllListeners();
      server.stdout.removeAllListeners('data');
      server.stderr.removeAllListeners('data');
      cb(null, {
        pid: server.pid,
        stdout: server.stdout,
        stderr: server.stderr,
        stdin: server.stdin,
        readStdout: readStdout,
        readStderr: readStderr
      });
    }
  }
  server.stderr.on('data', function(chunk) {
    readStderr += chunk.toString();
    if (serverOpts.startupMessages) {
      _checkStartupMessages();
    }
  });
  server.stdout.on('data', function(chunk) {
    readStdout += chunk.toString();
    if (serverOpts.startupMessages) {
      _checkStartupMessages();
    }
  });
}

/**
 * Stop a process by its PID.
 * @param {number} pid
 * @param {(string|number)} signal Defaults to SIGTERM.
 */
function stopServer(pid, signal) {
  try {
    if (pid) {
      process.kill(pid, signal);
    }
  } catch (err) {
    // Already killed
  }
}

/**
 * Kill all processes that are listening to the TCP ports passed as arguments.
 *
 * @param {(number|number[])} ports
 * @param {(string|number)} signal
 * @param {Function} cb
 */
function killServersByTcpPorts(ports, signal, cb) {
  if (!cb && signal instanceof Function) {
    cb = signal;
    signal = undefined;
  }
  if (!Array.isArray(ports)) {
    ports = [ports];
  }

  _getPidsByTcpPorts(ports, function(err, pids) {
    if (err) {
      return cb(err);
    }

    for (var i = 0; i < pids.length; i++) {  // Using for loop to allow returning cb(err)
      try {
        process.kill(pids[i], signal);
      } catch (e) {
        if (e.errno !== 'ESRCH') {
          return cb(e);
        }
        // else: Already killed
      }
    }
    cb();
  });
}

/**
 * Choose the better method to get pids from TCP ports depending on the OS and command availability:
 *   - Redhat, Ubuntu and OSX support lsof, so use it if it is installed.
 *   - Else, for Redhat and Ubuntu use netstat (OSX does not show the pid in netstat output).
 *
 * @param {number|number[]} ports
 * @param {Function} cb
 * @private
 */
function _getPidsByTcpPorts(ports, cb) {
  function _which(command) {
    try {
      which.sync(command);
      return true;
    } catch (err) {
      return false;
    }
  }

  var getPidsByTcpPortsFn = null;
  if (_which('lsof')) {
    getPidsByTcpPortsFn = _getPidsByTcpPortsUsingLsof;
  } else if (_which('netstat')) {
    getPidsByTcpPortsFn = _getPidsByTcpPortsUsingNetstat;
  } else {
    return cb(new Error('This OS does not support neither lsof nor netstat commands'));
  }

  getPidsByTcpPortsFn(ports, cb);
}

function _getPidsByTcpPortsUsingLsof(ports, cb) {
  // Use lsof command to get listening ports
  var cmd = 'lsof -n -P -iTCP -sTCP:LISTEN';
  cp.exec(cmd, function(err, stdout, stderr) {
    // When lsof does not find any file matching the specified options, it returns 1, what makes cp.exec to
    // emit an error, although this is an ok response for us: the list of processes listening to some port is empty.
    if (err && (stderr || stdout)) {
      return cb(err);
    }

    var pids = [];
    // Parse lsof output to get port number and pid
    var lines = stdout.split(os.EOL).slice(1, -1);
    lines.forEach(function(line) {
      line = line.split(/\s+/);
      var port = parseInt(line[8].substring(line[8].lastIndexOf(':') + 1), 10);
      var pid = parseInt(line[1], 10);

      if (ports.indexOf(port) !== -1) {
        if (isNaN(pid)) {
          return cb(new Error('No PID available for port ' + port));
        }
        // Several ports could have the same pid
        // (one server listening to several ports will be listed several times by lsof)
        if (pids.indexOf(pid) === -1) {
          pids.push(pid);
        }
      }
    });
    cb(null, pids);
  });
}

function _getPidsByTcpPortsUsingNetstat(ports, cb) {
  // Use netstat command to get listening ports
  var cmd = null;
  switch (tartareUtil.getOS()) {
    case 'redhat':
      cmd = 'netstat --listening --numeric --program --notrim -t';
      break;
    case 'ubuntu':
      cmd = 'netstat --listening --numeric --program --wide -t';
      break;
    case 'osx':
      return cb(new Error('OSX is not supported'));
    default:
      return cb(new Error('Unsupported OS'));
  }

  cp.exec(cmd, function(err, stdout, stderr) {
    if (err) {
      return cb(err);
    }

    var pids = [];
    // Parse netstat output to get protocol, port number and pid
    var lines = stdout.split(os.EOL).slice(2, -1);
    lines.forEach(function(line) {
      line = line.split(/\s+/);
      var protocol = line[0];
      var port = parseInt(line[3].substring(line[3].lastIndexOf(':') + 1), 10);
      var pid = line[6][0] === '-' ? null : parseInt(line[6].split('/')[0], 10);

      if (protocol === 'tcp' && ports.indexOf(port) !== -1) {
        if (!pid) {
          return cb(new Error('No PID available for port ' + port));
        }
        // Several ports could have the same pid
        // (one server listening to several ports will be listed several times by netstat)
        if (pids.indexOf(pid) === -1) {
          pids.push(pid);
        }
      }
    });
    cb(null, pids);
  });
}

/**
 * Kill processes that match the options using the given signal.
 *
 * @param {Object} opts Options used to match the processes to be killed:
 *          - {string} name The name of the process to be killed.
 *          - {string} args Args passed to the process through the command line.
 *          - {boolean} exact Whether the matching is done exactly or not (Defaults to true).
 *          - {boolean} invert Negates the matching (Defaults to false).
 *          - {boolean} children Also kills children processes (Defaults to false).
 * @param {string} signal Signal used to kill the processes (Defaults to SIGTERM).
 * @param {Function} cb
 */
function killProcesses(opts, signal, cb) {
  if (!cb && signal instanceof Function) {
    cb = signal;
    signal = undefined;
  }
  if (!signal) {
    signal = 'SIGTERM';
  }
  if (!('exact' in opts)) {
    opts.exact = true;
  }

  var pArgs = [];
  if (opts.args) {
    pArgs.push('-f');
  }
  if (opts.invert) {
    pArgs.push('-v');
  }
  if (opts.exact) {
    pArgs.push('-x');
  }
  var pattern = [];
  if (opts.name) {
    pattern.push(opts.name);
  }
  if (opts.args) {
    pattern.push(opts.args);
  }
  pArgs.push(pattern.join(' '));

  if (opts.children) {
    // Get pids of the matching processes
    cp.execFile('pgrep', pArgs, function(err1, agentPids) {
      if (err1 && err1.code !== 1) {
        return cb(err1);
      }
      if (err1 && err1.code === 1) {
        return cb();  // No processes matched
      }
      var pids = agentPids.slice(0, -1).split('\n');
      // Get pids of the children processes
      cp.execFile('pgrep', ['-P', pids.join(',')], function(err2, checksPids) {
        if (err2 && err2.code !== 1) {
          return cb(err2);
        }
        // if (err2 && err2.code === 1) ==> no children found
        if (!err2) {
          pids = pids.concat(checksPids.slice(0, -1).split('\n'));
        }
        // Kill all the pids
        cp.execFile('kill', ['-' + signal].concat(pids), function(err3) {
          if (err3 && err3.code === 1) {
            err3 = null;  // No processes matched, not an error for us
          }
          cb(err3);
        });
      });
    });
  } else {
    // Kill all the matching processes
    cp.execFile('pkill', ['-' + signal].concat(pArgs), function(err) {
      if (err && err.code === 1) {
        err = null;  // No processes matched, not an error for us
      }
      cb(err);
    });
  }
}

module.exports = {
  renderConfigFile: renderConfigFile,
  startServer: startServer,
  stopServer: stopServer,
  killServersByTcpPorts: killServersByTcpPorts,
  killProcesses: killProcesses
};
