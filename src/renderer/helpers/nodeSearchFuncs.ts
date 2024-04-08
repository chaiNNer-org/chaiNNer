import { RRegex } from 'rregex/lib/browser';
import { CategoryMap } from '../../common/CategoryMap';
import { NodeSchema } from '../../common/common-types';
import { lazy } from '../../common/util';

const isLetter = lazy(() => new RRegex('(?is)^[a-z]$'));
const createSearchPredicate = (query: string): ((name: string) => boolean) => {
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

export const getMatchingNodes = (
    searchQuery: string,
    schemata: readonly NodeSchema[],
    categories: CategoryMap
) => {
    const matchesSearchQuery = createSearchPredicate(searchQuery);
    const matchingNodes = !searchQuery
        ? schemata
        : schemata.filter((n) => {
              const category = categories.get(n.category)?.name ?? n.category;
              const nodeGroup = categories.getGroup(n.nodeGroup)?.name ?? n.nodeGroup;
              return (
                  matchesSearchQuery(`${category} ${n.name}`) ||
                  matchesSearchQuery(`${nodeGroup} ${n.name}`)
              );
          });

    return matchingNodes;
};
