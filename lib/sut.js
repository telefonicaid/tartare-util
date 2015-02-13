/*

 Copyright 2015 Telefonica Investigación y Desarrollo, S.A.U

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

var fs = require('fs'),
    mustache = require('mustache'),
    _ = require('underscore'),
    os = require('os'),
    cp = require('child_process'),
    tartareUtil = require('./util'),
    which = require('which');

/**
 * Read a configuration file containing mustache placeholders, replace them with baseConfig and additionalConfig,
 * and write the resulting configuration file.
 *
 *
 * @param templateConfigFile Configuration template filename containing mustache placeholders
 * @param outputConfigFile Resulting file after having applied configurations over templateConfigFile
 * @param baseConfig Configuration object to be applied over templateConfigFile's mustache placeholders
 * @param additionalConfig (optional) The same that the former parameter. Properties in this object will overwrite
 *                         the ones in baseConfig with the same name. This allows to use a basic configuration in
 *                         baseConfig and some more specific configuration in additionalConfig.
 */
var renderConfigFile = function renderConfigFile(templateConfigFile, outputConfigFile, baseConfig, additionalConfig) {
  var configTemplate = fs.readFileSync(templateConfigFile, {encoding: 'utf-8'});
  var config = {};
  _.extend(config, baseConfig, additionalConfig);
  var outputConfig = mustache.render(configTemplate, config);
  fs.writeFileSync(outputConfigFile, outputConfig, {encoding: 'utf-8'});
};

/**
 * Run an instance of a generic server and optionally wait for something to be written in stdout or stderr to consider
 * that the server has correctly started.
 * @param serverOpts Object with the following information about the server:
 *                   - command: The server executable command.
 *                   - args: Array of arguments to be passed to the server.
 *                   - env: Object with environment key-value pairs.
 *                   - cwd: String with the current working directory of the child process
 *                   - startupMessages: Messages (String or Array) to be searched in stdout or stderr
 *                                      to consider that the served has started.
 *                                      If it doesn't exist or is null this function will wait for the server to exit
 * @param timeout Max time to wait for the Server to start.
 * @param cb The callback function will be called with the following parameters:
 *           - pid: the process' pid, or null if it cannot be started.
 *           - stdout: what the process has printed to stdout.
 *           - stderr: what the process has printed to stderr.
 *           - exitCode: exit code returned by the process, in case it has exited.
 *           - signal: signal that terminated the process, in case it has exited.
 */
var startServer = function startServer(serverOpts, timeout, cb) {
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
      serverOpts.startupMessages.map(function() { return false; }) :
      null;

  var server = cp.spawn(serverOpts.command, serverOpts.args, {cwd: serverOpts.cwd, env: serverOpts.env});

  var stderr = '',
      stdout = '';

  var timeoutId = setTimeout(function() {
    // Just in case the server does not start properly after some time
    server.removeAllListeners();
    server.stdout.removeAllListeners('data');
    server.stderr.removeAllListeners('data');
    if (serverOpts.startupMessages) {
      // If there is some startupMessage, exiting by timeout is an error
      server.kill();
      var err = new Error('Server couldn\'t be started before ' + timeout + ' milliseconds');
      err.stderr = stderr;
      err.stdout = stdout;
      cb(err);
    } else {
      // If there is not any startupMessage, exiting by timeout is ok (start and wait)
      cb(null, server.pid, stdout, stderr);
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
      err.stdout = stdout;
      err.stderr = stderr;
      cb(err);
    } else {
      // If there is not any startupMessage and the process exits, it is ok
      cb(null, null, stdout, stderr, code, signal);
    }
  });

  function _checkStartupMessages() {
    serverOpts.startupMessages.forEach(function(startupMsg, index) {
      if (stdout.indexOf(startupMsg) !== -1 ||
        stderr.indexOf(startupMsg) !== -1) {
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
      cb(null, server.pid, stdout, stderr);
    }
  }
  server.stderr.on('data', function(chunk) {
    stderr += chunk.toString();
    if (serverOpts.startupMessages) {
      _checkStartupMessages();
    }
  });
  server.stdout.on('data', function(chunk) {
    stdout += chunk.toString();
    if (serverOpts.startupMessages) {
      _checkStartupMessages();
    }
  });
};

var stopServer = function stopServer(pid, signal) {
  try {
    if (pid) {
      process.kill(pid, signal);
    }
  } catch (err) {
    // Already killed
  }
};

/**
 * Kill all processes that are listening to the TCP ports passed as arguments.
 *
 * @param ports
 * @param signal
 * @param cb
 */
var killServersByTcpPorts = function killServersByTcpPorts(ports, signal, cb) {
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
      } catch (err) {
        if (err.errno !== 'ESRCH') {
          return cb(err);
        }
        // else: Already killed
      }
    }
    cb();
  });
};

/**
 * Choose the better method to get pids from TCP ports depending on the OS and command availability:
 *   Redhat supports both lsof and netstat, but not all distributions include lsof out-of-the-box
 *   Ubuntu support both lsof and netstat, go for lsof  because it's more compatible
 *   OSX does not show pid in netstat output, so go for lsof
 *
 * @param ports
 * @param cb
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
      var port = parseInt(line[8].substring(line[8].lastIndexOf(':') + 1)),
          pid = parseInt(line[1]);

      if (ports.indexOf(port) !== -1) {
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

function _getPidsByTcpPortsUsingNetstat(ports, cb) {
  // Use netstat command to get listening ports
  var cmd = null;
  switch (tartareUtil.getOS()) {
    case 'redhat':
      cmd = 'sudo netstat --listening --numeric --program --notrim -t';
      break;
    case 'ubuntu':
      cmd = 'netstat --listening --numeric --program --wide -t';
      break;
    case 'osx':
      return cb(new Error('OSX is not supported'));
  }

  /* eslint-disable no-unused-vars */
  cp.exec(cmd, function(err, stdout, stderr) {
  /* eslint-enable no-unused-vars */
    if (err) {
      return cb(err);
    }

    var pids = [];
    // Parse netstat output to get protocol, port number and pid
    var lines = stdout.split(os.EOL).slice(2, -1);
    lines.forEach(function(line) {
      line = line.split(/\s+/);
      var protocol = line[0],
          port = parseInt(line[3].substring(line[3].lastIndexOf(':') + 1)),
          pid = line[6][0] === '-' ? null : parseInt(line[6].split('/')[0]);

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
 * Kill processes that match the options using the given signal
 * @param opts Object with options used to match the processes to be killed:
 *          - name: the name of the process to be killed
 *          - args: args passed to the process through the command line
 *          - exact: whether the matching is done exactly or not (Defaults to true)
 *          - invert: negates the matching (Defaults to false)
 *          - children: also kills children processes (Defaults to false)
 * @param signal Signal used to kill the processes (Defaults to SIGTERM)
 * @param cb
 */
var killProcesses = function killProcesses(opts, signal, cb) {
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

  if (!opts.children) {
    // Kill all the matching processes
    cp.execFile('pkill', ['-' + signal].concat(pArgs), function(err) {
      if (err && err.code === 1) {
        err = null;  // No processes matched, not an error for us
      }
      cb(err);
    });
  } else {
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
  }
};

module.exports = {
  renderConfigFile: renderConfigFile,
  startServer: startServer,
  stopServer: stopServer,
  killServersByTcpPorts: killServersByTcpPorts,
  killProcesses: killProcesses
};