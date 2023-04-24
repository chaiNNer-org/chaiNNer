import { useEffect } from 'react';
import { log } from '../../common/log';
import { noop } from '../../common/util';

/**
 * An object that can tell whether the current operation has been canceled.
 */
export interface CancellationToken {
    /**
     * Whether the operation has been canceled.
     *
     * Once an operation has been canceled, it can **never** be un-canceled again.
     */
    readonly isCanceled: boolean;
    /**
     * A simply utility function that will throw a {@link CancellationError} if the operation has
     * been canceled.
     *
     * @throws {CancellationError}
     */
    readonly checkCanceled: () => void;
    /**
     * Causes an effect.
     *
     * The given function is allowed to have side effects, but it MUST be synchronous.
     * Asynchronous effects are not supported.
     *
     * This utility function is equivalent to:
     *
     * ```
     * checkCanceled();
     * fn();
     * ```
     *
     * @throws {CancellationError}
     */
    readonly causeEffect: (fn: () => void) => void;
}

export class CancellationError extends Error {}

/**
 * An object that controls and holds whether an operation has been changed.
 *
 * The controller also implements the {@link CancellationToken} interface. You can pass the controller directly into
 * function that need a token. TypeScript will ensure that the token is used correctly.
 */
export class CancellationController implements CancellationToken {
    isCanceled = false;

    readonly checkCanceled = (): void => {
        if (this.isCanceled) {
            throw new CancellationError();
        }
    };

    readonly causeEffect = (fn: () => void) => {
        this.checkCanceled();
        fn();
    };

    /**
     * A simple utility function that will set `isCanceled` to `true`.
     */
    readonly cancel = (): void => {
        this.isCanceled = true;
    };
}

export type UseAsyncEffectOptions<T> = void extends T
    ? ((token: CancellationToken) => Promise<void>) | ObjectUseAsyncEffectOptions<T>
    : ObjectUseAsyncEffectOptions<T>;

interface ObjectUseAsyncEffectOptions<T> {
    supplier: (token: CancellationToken) => Promise<T>;
    successEffect: (value: T) => void;
    catchEffect?: (error: unknown) => void;
    finallyEffect?: () => void;
}

const noopPromise = async (): Promise<void> => {};

/**
 * This is an async replacement for `useEffect`.
 *
 * The supplier must not cause effects, except as a callback in `token.effect`.
 * The `successEffect`, `catchEffect`, and `finallyEffect` functions are allowed to cause effects
 * and must be executing synchronously.
 *
 * This whole operation is roughly equivalent to:
 *
 * ```
 * supplier().then(successEffect).catch(catchEffect ?? log.error).finally(finallyEffect)
 * ```
 */
export const useAsyncEffect = <T>(
    optionsFn: () => UseAsyncEffectOptions<T> | void | undefined,
    dependencies: readonly unknown[]
) => {
    const options = optionsFn() ?? (noopPromise as () => Promise<T & void>);
    const objOptions: ObjectUseAsyncEffectOptions<T> =
        typeof options === 'function' ? { supplier: options, successEffect: noop } : options;
    const { supplier, successEffect, catchEffect, finallyEffect } = objOptions;

    useEffect(() => {
        const controller = new CancellationController();

        const cEffect = (reason: unknown) => {
            if (catchEffect) {
                try {
                    catchEffect(reason);
                } catch (error) {
                    log.error('catchEffect unexpectedly threw an error:', error);
                }
            } else {
                log.error(reason);
            }
        };
        const fEffect = () => {
            try {
                finallyEffect?.();
            } catch (error) {
                log.error('finallyEffect unexpectedly threw an error:', error);
            }
        };

        supplier(controller).then(
            (result) => {
                if (controller.isCanceled) return;
                try {
                    successEffect(result);
                } catch (error) {
                    cEffect(error);
                }
                fEffect();
            },
            (reason) => {
                if (controller.isCanceled) return;
                cEffect(reason);
                fEffect();
            }
        );

        return controller.cancel;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
};
