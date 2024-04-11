import semver from 'semver';
import type { RestEndpointMethodTypes } from '@octokit/rest';

const repository = 'chaiNNer-org/chaiNNer';

const fetchApi = async <T>(url: string): Promise<T> => {
    // fetch data from GitHub REST API
    const response = await fetch(`https://api.github.com${url}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}`);
    }
    const data: unknown = await response.json();
    return data as T;
};

const getLatestRelease = async () => {
    const data: RestEndpointMethodTypes['repos']['getLatestRelease']['response']['data'] =
        await fetchApi(`/repos/${repository}/releases/latest`);
    return data;
};

const getAllReleases = async () => {
    const data: RestEndpointMethodTypes['repos']['listReleases']['response']['data'] =
        await fetchApi(`/repos/${repository}/releases?per_page=10`);
    return data;
};

const getReleasesAfterVersion = async (version: string) => {
    const releases = await getAllReleases();
    const releasesAfterVersion = releases.filter((release) => {
        return semver.gt(release.tag_name, version);
    });
    return releasesAfterVersion;
};

export type GitHubRelease =
    RestEndpointMethodTypes['repos']['getLatestRelease']['response']['data'];

const computeChangelog = (releases: GitHubRelease[]) => {
    const computedChangelog = releases.reduce((acc: string, curr) => {
        return `${acc}\n\n# ${curr.name ?? ''}\n${curr.body ?? ''}\n\n---\n\n`;
    }, '');
    return computedChangelog;
};

export const getLatestVersionIfUpdateAvailable = async (version: string) => {
    const latestRelease = await getLatestRelease();
    if (semver.gt(latestRelease.tag_name, version)) {
        const releases = await getReleasesAfterVersion(version);
        const changelog = computeChangelog(releases);
        return { version: latestRelease, changelog };
    }
    return null;
};
