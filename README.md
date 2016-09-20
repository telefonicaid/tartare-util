# tartare-util

**The Tartare family:**
[tartare](https://github.com/telefonicaid/tartare/) |
[tartare-chai](https://github.com/telefonicaid/tartare-chai/) |
[tartare-mock](https://github.com/telefonicaid/tartare-mock/) |
[tartare-collections](https://github.com/telefonicaid/tartare-collections/) |
[tartare-logs](https://github.com/telefonicaid/tartare-logs/) |
[protractor-tartare](https://github.com/telefonicaid/protractor-tartare/)

---

![TypeScript definition](https://img.shields.io/badge/TypeScript%20Definition-%E2%9C%93-blue.svg)

This module offers a set of utils that can help you when making acceptance tests.

## Install
```bash
$ npm install tartare-util
```

## Import
JavaScript:
```js
var tartareUtil = require('tartare-util');
```

TypeScript:
```ts
import * as tartareUtil from 'tartare-util';
```

## API
tartare-util exports both functions and constants that are very handy when making acceptance tests.
Some of that functions are grouped in submodules:
* **http**: functions related to the HTTP protocol.
* **sut**: functions that help you to start and stop the SUT (Subject Under Test).

Some of the functions below use OS commands (such as `lsof`, `pkill`, etc.) so they need to be installed for the
functions to work. Those functions have been tested with the following OSs: RHEL 6, RHEL 7, Ubuntu and OSX.

### NONASCII_STRING
A string constant that contains characters outside of the ASCII-7 set. Useful to test whether a SUT
accepts non-english characters.

### INJECTION_STRING
A string constant that contains characters typically used for performing injection attacks.

### getOS()
Guesses the type of operating system. It is based on the node.js `os.platform()` function but distinguishes among
several Linux distributions.

It returns a string with some of the following values: `'redhat'`, `'ubuntu'` or `'osx'`. It returns `null` when the OS 
cannot be guessed.

### http.getReason(statusCode)
Returns the HTTP reason related to the given status code. It gets the reason messages from the node.js 
`http.STATUS_CODES` array but this function does not fail when it receives a wrong status code, returning the
'Unknown status code' string.

```js
tartareUtil.http.getReason(200);
'OK'
```

### http.lowerCaseHeaders(headers)
* `headers` Object containing HTTP headers. 

Returns the same object with all its properties lower-cased. This is useful to compare HTTP 
headers since they are case-insensitive.

```js
tartareUtil.http.lowerCaseHeaders({
  'Content-Type': 'text/html',
  Date: 'Wed, 20 Jul 2016 08:12:31 GMT'
});

{
  'content-type': 'text/html',
  date: 'Tue, 15 Nov 1994 08:12:31 GMT'
}
```

### http.getCharsetFromContentType(value)
* `value` String containing a typical value for a 'Content-Type' HTTP header, including a charset specification. 

Extract the charset from a typical 'Content-Type' HTTP header.

```js
tartareUtil.http.getCharsetFromContentType('text/html; charset=utf-8');
'utf-8'
```

### sut.renderConfigFile(templateConfigFile, outputConfigFile, baseConfig, [additionalConfig])
* `templateConfigFile` (String) Configuration template filename containing mustache placeholders.
* `outputConfigFile` (String) Resulting file after having applied the configurations over the `templateConfigFile`.
* `baseConfig` (Object) Configuration object to be applied over `templateConfigFile`'s mustache placeholders.
* `additionalConfig` (Object) The same that the former parameter. Properties in this object will
overwrite the ones in `baseConfig` with the same name. This allows using a basic configuration in
`baseConfig` and some more specific configuration in `additionalConfig`.

Reads a configuration file containing [mustache](https://github.com/janl/mustache.js) placeholders, 
replaces them with the values from `baseConfig` and `additionalConfig`, and write the resulting configuration file.
This is useful when testing a SUT against different configurations, to generate different configuration files from
a template and specific values for each test.

**Example:**

Given that there is a template file named `config.mustache` with the following content:
```
{
  "serverPort": {{server.port}},
  "database": {
    "uri": "mongodb://localhost:{{mongoDb.port}}/{{{mongoDb.databaseName}}}"
  }
}
```

When you apply `renderConfigFile`:
```js
var config = {
  server: {
    port: 8008
  },
  mongoDb: {
    port: 5000,
    databaseName: 'test'
  }
}

tartareUtil.sut.renderConfigFile('config.mustache', 'config.json', config);
```

You get a file named `config.json` with the following content:
```json
{
  "serverPort": 8008,
  "database": {
    "uri": "mongodb://localhost:5000/test"
  }
}
```

### sut.startServer(serverOpts, [timeout], cb)
* `serverOpts` Object with the following information about the server:
  * `command` (String) The server executable command.
  * `args` (String[]) Array of arguments to be passed to the server.
  * `env` (Object) Environment key-value pairs.
  * `cwd` (String) Current working directory of the child process.
  * `startupMessages` (String|String[]) Messages to be searched in *stdout* or *stderr* to consider that
    the served has started.
* `timeout` (Number) Max time (in ms) to wait for the server to start (Defaults to 5000).
* `cb` The callback function will be called with the error and an object with some of the following parameters:
  * `pid` (Number) The process' PID (only if it has been started).
  * `stdout` (Stream) A Readable Stream that represents the process' stdout (only if it has been started).
  * `stderr` (Stream) A Readable Stream that represents the process' stderr (only if it has been started).
  * `stdin` (Stream) A Writable Stream that represents the child process' stdin (only if it has been started).
  * `readStdout` (String) What the process has already written to *stdout* at the time the callback is called.
  * `readStderr` (String) What the process has already written to *stderr* at the time the callback is called.
  * `exitCode` (Number) Exit code returned by the process, in case it has exited.
  * `signal` (String) Signal that terminated the process, in case it has exited.

Runs an instance of a generic server and optionally wait for something to be written in *stdout* or *stderr* 
to consider that the server has correctly started.

Depending on how your server behaves, you can use this function in different ways:
* If the server writes something to the *stdout*/*stderr* to signal that it has started 
  (e.g.: "Listening on port 8008") you can pass the string in the `startupMessages` property 
  and the function will wait until the server has writen such a message. Then the callback will be called 
  with different arguments depending on the server behaviour:
  * If everything goes well and the sever writes the message, the callback will be called without error and the second
    parameter will include `pid`, `stdout`, `stderr`, `stdin`, `readStdout` and `readStderr`.
  * If the server exits before writing the message (before the `timeout` expires), the callback will be 
    called with an error.
  * If the server does not write the message before the `timeout` expires (and it keeps running), it will 
    be killed and the callback will be called with an error.
* If the server does not write anything to signal that it has started, call the function without `startupMessages`
  and it will wait for `timeout` ms, and then the callback will be called with `pid`, `stdout`, `stderr`, `stdin`,
  `readStdout` and `readStderr` in the second argument.
* If you expect the server to exit (for instance, because you are testing a wrong configuration), call the function 
  without `startupMessages`, and the callback will be called with `readStdout`, `readStderr`, `exitCode` and `signal` 
  in the second argument when the server exits.

In any other case, the callback will be called with an error if the server cannot be executed or it unexpectedly exits.
Such an error will have the `stdout` and `stderr` properties with the output written by the server. 

Note that you can put an array of strings on `startupMessages` if the server writes several messages to signal 
that it has started (e.g.: listening on several ports, listening on a port and connected to the database, etc.).

Example: Start a server and wait for it to write "Listening on port 8008" on the *stdout*:
```js
var serverOpts = {
  command: './bin/myserver',
  args: ['--config', 'config.json'],
  startupMessages: 'Listening on port 8008'
};

tartareUtil.sut.startServer(serverOpts, 3000, function(err, server) {
  // As soon as the server writes the message
  if (err) {
    err.message += '\n\nstderr:' + err.stderr + '\n\nstdout:' + err.stdout;
    return cb(err);
  }
  cb(null, server.pid);
});
```

Example: Start a server that does not write anything to the *stdout* or *stderr* and wait 3 seconds:
```js
var serverOpts = {
  command: './bin/myserver',
  args: ['--config', 'config.json']
};

tartareUtil.sut.startServer(serverOpts, 3000, function(err, server) {
  // After 3 seconds
  if (err) {
    err.message += '\n\nstderr:' + err.stderr + '\n\nstdout:' + err.stdout;
    return cb(err);
  }
  cb(null, server.pid);
});
```

With TypeScript you can use the `tartareUtil.sut.Server` type for the `server` parameter of the callback.

### sut.stopServer(pid, [signal])
* `pid` (Number) The PID of the process to stop.
* `signal` (String|Number) The signal sent to the process (defaults to SIGTERM).

Stops a server (or any process) by its PID. The difference with `process.kill()` is that this function
does not fail if the process does not exist.

### sut.killServersByTcpPorts(ports, [signal], cb)
* `ports` (Number|Number[]) Ports whose processes are going to be killed.
* `signal` (String|Number) The signal sent to the processes (defaults to SIGTERM).
* `cb` Function called when the processes have been killed.
  * `err` Error.

Finds all the processes that are listening on the given list of ports and kill them using the given signal. 
This function uses the `lsof` or `netstat` commands to find the process that listen on a port, so some of
them needs to be installed (`lsof` is more compatible and should be enough if it is available for you OS).
It does not fail if no processes are found.

### sut.killProcesses(opts, [signal], cb)
* `opts` Object with options used to match the processes to be killed:
  * `name` (String) The name of the process to be killed.
  * `args` (String) Args passed to the process through the command line.
  * `exact` (Boolean) Whether the matching is done exactly or not (Defaults to `true`).
  * `invert` (Boolean) Negates the matching (Defaults to `false`).
  * `children` (Boolean) Also kills children processes (Defaults to `false`).
* `signal` (String|Number) The signal sent to the processes (defaults to SIGTERM).
* `cb` Function called when the processes have been killed.
  * `err` Error.

Kills processes that match the options using the given signal. This function uses the `pgrep`, `pkill` and `kill`
commands, so they need to be installed. It does not fail if there are no processes matching the options.

