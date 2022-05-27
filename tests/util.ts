import * as p from '../package.json';

export const getVersion = (): string => {
    return p.version;
};
