/**
 * @see https://www.npmjs.com/package/cleankill
 */
declare module "cleankill" {

    interface ICleankill {
        onInterrupt( fn: ( done: () => void ) => void ): void;
        close( done: () => void ): void;
    }

    var cleankill: ICleankill;
    export = cleankill;
}

