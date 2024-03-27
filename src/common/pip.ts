import { PyPiPackage } from './common-types';

export const getFindLinks = (dependencies: readonly PyPiPackage[]): string[] => {
    const links = new Set<string>();
    for (const p of dependencies) {
        if (p.findLink) {
            links.add(p.findLink);
        }
    }
    return [...links];
};
