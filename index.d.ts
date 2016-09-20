export const NONASCII_STRING: string;
export const INJECTION_STRING: string;

export function getOS(): string;

declare namespace http {
    interface Headers {
        [key: string]: string;
    }
}

interface Http {
    getReason(statusCode: number | string): string;
    lowerCaseHeaders(headers: http.Headers): http.Headers;
    getCharsetFromContentType(value: string): string | void;
}

export let http: Http;

declare namespace sut {
    interface StartServerOptions {
        command: string;
        args?: string[];
        env?: any;
        cwd?: string;
        startupMessages?: string | string[] | void;
    }

    export interface Server {
        pid: number;
        stdout: NodeJS.ReadableStream;
        stderr: NodeJS.ReadableStream;
        stdin: NodeJS.WritableStream;
        readStdout: string;
        readStderr: string;
        exitCode: number;
        signal: string;
    }

    interface KillProcessesOptions {
        name?: string;
        args?: string;
        exact?: boolean;
        invert?: boolean;
        children?: boolean;
    }
}

interface Sut {
    renderConfigFile(templateConfigFile: string, outputConfigFile: string, baseConfig: Object, additionalConfig?: Object);
    startServer(serverOpts: sut.StartServerOptions, timeout: number, cb: (err: Error, server: sut.Server) => any);
    startServer(serverOpts: sut.StartServerOptions, cb: (err: Error, server: sut.Server) => any);
    stopServer(pid: number, signal?: string| number);
    killServersByTcpPorts(ports: number | number[], signal: string | number, cb: (err: Error) => any);
    killServersByTcpPorts(ports: number | number[], cb: (err: Error) => any);
    killProcesses(opts: sut.KillProcessesOptions, signal: string, cb: (err: Error) => any);
    killProcesses(opts: sut.KillProcessesOptions, cb: (err: Error) => any);
}

export let sut: Sut;
export let server: Sut;

declare global {
    interface Error {
        stdout?: string;
        stderr?: string;
    }
}
