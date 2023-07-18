import { Octokit } from '@octokit/rest';
import semver from 'semver';

const octokit = new Octokit();

const getLatestRelease = async () => {
    return octokit.rest.repos.getLatestRelease({
        owner: 'chaiNNer-org',
        repo: 'chaiNNer',
    });
};

const getAllReleases = async () => {
    return octokit.rest.repos.listReleases({
        owner: 'chaiNNer-org',
        repo: 'chaiNNer',
    });
};

const getReleasesAfterVersion = async (version: string) => {
    const releases = await getAllReleases();
    const releasesAfterVersion = releases.data.filter((release) => {
        return semver.gt(release.tag_name, version);
    });
    return releasesAfterVersion;
};

export type GitHubRelease = (typeof getLatestRelease extends () => Promise<infer U>
    ? U
    : never)['data'];

const computeChangelog = (releases: GitHubRelease[]) => {
    const computedChangelog = releases.reduce((acc: string, curr) => {
        return `${acc}\n\n# ${curr.name ?? ''}\n${curr.body ?? ''}\n\n---\n\n`;
    }, '');
    return computedChangelog;
};

export const getLatestVersionIfUpdateAvailable = async (version: string) => {
    const latestRelease = await getLatestRelease();
    if (semver.gt(latestRelease.data.tag_name, version)) {
        const releases = await getReleasesAfterVersion(version);
        const changelog = computeChangelog(releases);
        return { version: latestRelease.data, changelog };
    }
    return null;
};
