import { Category, CategoryId, NodeGroup, NodeGroupId } from './common-types';

export class CategoryMap {
    /**
     * An ordered list of all categories supported by the backend.
     *
     * Some categories might be empty.
     */
    readonly categories: readonly Category[];

    private readonly lookup: ReadonlyMap<CategoryId, Category>;

    private readonly lookupGroup: ReadonlyMap<NodeGroupId, NodeGroup>;

    static readonly EMPTY: CategoryMap = new CategoryMap([]);

    constructor(categories: readonly Category[]) {
        // defensive copy
        this.categories = [...categories];
        this.lookup = new Map(categories.map((c) => [c.id, c] as const));
        this.lookupGroup = new Map(
            categories.flatMap((c) => c.groups).map((g) => [g.id, g] as const)
        );
    }

    get(id: CategoryId): Category | undefined {
        return this.lookup.get(id);
    }

    getGroup(id: NodeGroupId): NodeGroup | undefined {
        return this.lookupGroup.get(id);
    }
}
