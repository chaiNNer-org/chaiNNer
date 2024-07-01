import { Expression, Scope, Type, evaluate } from '@chainner/navi';
import { useCallback, useState } from 'react';
import { log } from '../../common/log';

/**
 * A map of types that can be used as either a ref-like object or a state-like value.
 */
export const useTypeMap = <N, I>(scope: Scope) => {
    const [types, setTypes] = useState(() => ({
        map: new Map<N, Map<I, Type>>(),
    }));

    const setType = useCallback(
        (nodeId: N, outputId: I, expression: Expression | undefined): void => {
            const getType = () => {
                if (expression === undefined) {
                    return undefined;
                }

                try {
                    return evaluate(expression, scope);
                } catch (error) {
                    log.error(error);
                    return undefined;
                }
            };

            setTypes(({ map }) => {
                let inner = map.get(nodeId);
                const type = getType();
                if (type) {
                    if (!inner) {
                        inner = new Map();
                        map.set(nodeId, inner);
                    }

                    inner.set(outputId, type);
                } else {
                    inner?.delete(outputId);
                }
                return { map };
            });
        },
        [setTypes, scope]
    );

    const clear = useCallback(
        (nodes: Iterable<N>): void => {
            setTypes(({ map }) => {
                for (const nodeId of nodes) {
                    map.delete(nodeId);
                }
                return { map };
            });
        },
        [setTypes]
    );

    return [types, setType, clear] as const;
};
