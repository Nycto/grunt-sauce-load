
declare module SauceLabs {

    /**
     * The saucelabs Tunnel object: https://github.com/jmreidy/sauce-tunnel
     */
    class Tunnel {
        start( fn: (status: boolean) => void );
        stop( fn: () => void );
        identifier: string;
    }

    /** Constructors a new Tunnel */
    export interface TunnelCtor {
        new (
            username: string, accessKey: string, tunnelId: string,
            tunneled: boolean, extraFlags: string[]
        ): Tunnel;
    }
}

