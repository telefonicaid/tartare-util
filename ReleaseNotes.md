# RELEASE NOTES

## v1.2.0 / 20 Sep 2016
* Added TypeScript declarations.

## v1.1.0 / 13 Sep 2016
* The object passed to the callback of the `startServer` function now includes the stdin stream. 

## v1.0.0 / 22 Jul 2016
* The `killServersByTcpPorts` function no longer invokes `lsof` or `netstat` commands as `sudo`.
* Added API documentation.

## v0.6.0 / 19 Mar 2015
* The `startServer` function now passes an object to the callback that includes the stdout and stderr streams.

## v0.5.0 / 13 Feb 2015
* Allow passing a 'signal' to `stopServer` and `killServersByTcpPorts` functions.
* New function `killProcesses` that allows killing processes by name and command line arguments.

## v0.4.0 / 11 Jan 2015
* `tartare-util` is born as an independent package. Previously its functionality was in the `tartare` package.

## v0.3.0 / 22 Jul 2014
* Fixed a bug that made `startServer` function to fail when `startupMessages` parameter is an empty array.
