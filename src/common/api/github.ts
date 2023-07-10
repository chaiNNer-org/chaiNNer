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
        return `${acc}\n# ${curr.name ?? ''}\n${curr.body ?? ''}`;
    }, '');
    return computedChangelog;
};

export const hasUpdateAvailable = async (version: string) => {
    const latestRelease = await getLatestRelease();
    return semver.gt(latestRelease.data.tag_name, version);
};
