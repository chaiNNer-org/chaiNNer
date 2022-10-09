import semver from 'semver';
import { Version } from './common-types';

export const parse = (v: string): Version => {
    const version = semver.coerce(v);
    if (!version) {
        throw new SyntaxError(`Invalid version '${v}'`);
    }
    return version.version as Version;
};

export const versionLt = (lhs: Version, rhs: Version): boolean => {
    try {
        return semver.lt(parse(lhs), parse(rhs));
    } catch {
        return false;
    }
};

export const versionLte = (lhs: Version, rhs: Version): boolean => {
    try {
        return semver.lte(parse(lhs), parse(rhs));
    } catch {
        return false;
    }
};

export const versionGt = (lhs: Version, rhs: Version): boolean => {
    try {
        return semver.gt(parse(lhs), parse(rhs));
    } catch {
        return false;
    }
};

export const versionGte = (lhs: Version, rhs: Version): boolean => {
    try {
        return semver.gte(parse(lhs), parse(rhs));
    } catch {
        return false;
    }
};
