/**
 * A value-type representation of a set of numeric ids. The main purpose of this type is to
 * provide a representation of sets that can be memoized by React.
 *
 * This type makes the following assumptions about ids:
 * 1. They are non-negative integers.
 * 2. They are reasonably small integers. They should ideally be below 128 and must be below 65536.
 *
 * {@link IdSet.Builder} makes the same assumptions.
 */
export type IdSet<T extends number> = string & { __inputIdSet: never; __type: T };

// eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-redeclare
export namespace IdSet {
    export const empty: IdSet<never> = '' as IdSet<never>;

    export const isEmpty = <T extends number>(idSet: IdSet<T>): boolean => {
        return idSet.length === 0;
    };

    export const has = <T extends number>(idSet: IdSet<T>, id: T): boolean => {
        const char = String.fromCharCode(id);
        return idSet.includes(char);
    };
    export const toSet = <T extends number>(idSet: IdSet<T>): Set<T> => {
        const set = new Set<T>();
        for (let i = 0; i < idSet.length; i += 1) {
            set.add(idSet.charCodeAt(i) as T);
        }
        return set;
    };

    const fromSorted = <T extends number>(sorted: readonly T[]): IdSet<T> => {
        let s = '';
        let last = -1;
        for (const id of sorted) {
            if (id < 0 || id > 65535 || !Number.isInteger(id)) throw new Error(`Invalid id: ${id}`);

            if (id !== last) {
                last = id;
                s += String.fromCharCode(id);
            }
        }
        return s as IdSet<T>;
    };
    export const from = <T extends number>(iter: Iterable<T>): IdSet<T> => {
        const sorted = Array.from(iter).sort((a, b) => a - b);
        return fromSorted(sorted);
    };
}
