import { CategoryMap } from '../CategoryMap';
import { NodeGroup, NodeSchema } from '../common-types';
import { groupBy } from '../util';

const sortGroupNodes = (nodes: readonly NodeSchema[], group: NodeGroup): NodeSchema[] => {
    const ordered: NodeSchema[] = [];
    const unordered: NodeSchema[] = [];

    for (const n of nodes) {
        if (group.order.includes(n.schemaId)) {
            ordered.push(n);
        } else {
            unordered.push(n);
        }
    }

    ordered.sort((a, b) => group.order.indexOf(a.schemaId) - group.order.indexOf(b.schemaId));

    unordered.sort((a, b) => {
        return a.name.localeCompare(b.name);
    });

    return [...ordered, ...unordered];
};

export const sortNodes = (nodes: readonly NodeSchema[], categories: CategoryMap): NodeSchema[] => {
    const byGroup = groupBy(nodes, 'nodeGroup');

    return categories.categories
        .flatMap((c) => c.groups)
        .flatMap((g) => sortGroupNodes(byGroup.get(g.id) ?? [], g));
};
