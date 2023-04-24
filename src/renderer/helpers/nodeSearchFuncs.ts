import init, { RRegex } from 'rregex';
import { NodeSchema } from '../../common/common-types';
import { log } from '../../common/log';
import { lazy } from '../../common/util';

// This is not good, but I can't think of a better way.
// We are racing loading the wasm module and using it.
init().catch(log.error);

const isLetter = lazy(() => new RRegex('(?is)^[a-z]$'));
export const createSearchPredicate = (query: string): ((name: string) => boolean) => {
    if (!query) return () => true;

    const pattern = new RRegex(
        `(?is)^${[...query]
            .map((char) => {
                const hex = `\\u{${char.codePointAt(0)!.toString(16)}}`;
                const before = isLetter().isMatch(char) ? `[^a-z]` : `.`;
                return `(?:.*${before})?${hex}`;
            })
            .join('')}`
    );
    return (name) => pattern.isMatch(name);
};

export const byCategory = (nodes: readonly NodeSchema[]): Map<string, NodeSchema[]> => {
    const map = new Map<string, NodeSchema[]>();
    nodes.forEach((node) => {
        let list = map.get(node.category);
        if (list === undefined) map.set(node.category, (list = []));
        list.push(node);
    });
    return map;
};

/**
 * Returns a map that maps for sub category name to all nodes of that sub category.
 */
export const getSubcategories = (nodes: readonly NodeSchema[]) => {
    const map = new Map<string, NodeSchema[]>();
    nodes.forEach((n) => {
        const list = map.get(n.subcategory) ?? [];
        map.set(n.subcategory, list);
        list.push(n);
    });
    return map;
};

export const getMatchingNodes = (searchQuery: string, schemata: readonly NodeSchema[]) => {
    const matchesSearchQuery = createSearchPredicate(searchQuery);
    const matchingNodes = !searchQuery
        ? schemata
        : schemata.filter(
              (n) =>
                  matchesSearchQuery(`${n.category} ${n.name}`) ||
                  matchesSearchQuery(`${n.subcategory} ${n.name}`)
          );

    return matchingNodes;
};

export const getNodesByCategory = (matchingNodes: readonly NodeSchema[]) => {
    const byCategories: Map<string, NodeSchema[]> = byCategory(
        matchingNodes.filter((e) => e.nodeType !== 'iteratorHelper')
    );
    return byCategories;
};
