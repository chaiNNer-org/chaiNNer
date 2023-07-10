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
