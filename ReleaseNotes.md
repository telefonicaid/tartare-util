# RELEASE NOTES

## v0.5.0 / XXX
* Allow passing a 'signal' to `stopServer` and `killServersByTcpPorts` functions.
* New function `killProcesses` that allows killing processes by name and command line arguments.


## v0.4.0 / 11 Jan 2015
* `tartare-util` is born as an independent package. Previously its functionality was in the `tartare` package.

## v0.3.0 / 22 Jul 2014
* Fixed a bug that made `startServer` function to fail when `startupMessages` parameter is an empty array.
