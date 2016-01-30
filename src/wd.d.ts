/**
 * @see https://github.com/admc/wd
 */

interface WebDriverInitConfig {
    browserName?: string;
    platform?: string;
    version?: string;
    deviceName?: string;
    name: string;
    build: string;
    "public": string;
    "tunnel-identifier": string;
}

interface PromiseChainWebdriver {
    init(
        conf: WebDriverInitConfig,
        fn: (err: Error, sessionId: string) => void
    ): void;
    quit(): Q.Promise<void>;
    get(url: string): Q.Promise<void>;
}

interface Webdriver {
    promiseChainRemote (
        hostname: string, port: number,
        user: string, pwd: string
    ): PromiseChainWebdriver;
}

declare module "wd" {
    var wd: Webdriver;
    export = wd;
}
