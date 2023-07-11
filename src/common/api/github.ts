import { Octokit } from '@octokit/rest';
import semver from 'semver';

const octokit = new Octokit();

export const getLatestRelease = async () => {
    return octokit.rest.repos.getLatestRelease({
        owner: 'chaiNNer-org',
        repo: 'chaiNNer',
    });
};

export const getAllReleases = async () => {
    return octokit.rest.repos.listReleases({
        owner: 'chaiNNer-org',
        repo: 'chaiNNer',
    });
};

export const getReleasesAfterVersion = async (version: string) => {
    const releases = await getAllReleases();
    const releasesAfterVersion = releases.data.filter((release) => {
        return semver.gt(release.tag_name, version);
    });
    return releasesAfterVersion;
};

export const getComputedChangelogAfterVersion = async (version: string) => {
    const releasesAfterVersion = await getReleasesAfterVersion(version);
    const computedChangelog = releasesAfterVersion.reduce((acc: string, curr) => {
        return `${acc}\n\n# ${curr.name ?? ''}\n${curr.body ?? ''}\n\n---\n\n`;
    }, '');
    return computedChangelog;
};

export type LatestReleaseType = (typeof getLatestRelease extends () => Promise<infer U>
    ? U
    : never)['data'];

export const getLatestVersionIfUpdateAvailable = async (version: string) => {
    const latestRelease = await getLatestRelease();
    if (semver.gt(latestRelease.data.tag_name, version)) {
        const changelog = await getComputedChangelogAfterVersion(version);
        return { version: latestRelease.data, changelog };
    }
    return null;
};
