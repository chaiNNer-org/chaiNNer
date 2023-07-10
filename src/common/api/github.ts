export interface Author {
    avatar_url: string;
    events_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    gravatar_id: string;
    html_url: string;
    id: number;
    login: string;
    node_id: string;
    organizations_url: string;
    received_events_url: string;
    repos_url: string;
    site_admin: boolean;
    starred_url: string;
    subscriptions_url: string;
    type: string;
    url: string;
}

export interface ReleaseAsset {
    browser_download_url: string;
    content_type: string;
    created_at: string;
    download_count: number;
    id: number;
    label: string;
    name: string;
    size: number;
    state: string;
    node_id: string;
    updated_at: string;
    uploader: Author;
    url: string;
}

export interface GithubRelease {
    assets: ReleaseAsset[];
    assets_url: string;
    author: Author;
    body: string;
    created_at: string;
    draft: boolean;
    html_url: string;
    id: number;
    name: string;
    node_id: string;
    prerelease: boolean;
    published_at: string;
    tag_name: string;
    tarball_url: string;
    target_commitish: string;
    upload_url: string;
    url: string;
    zipball_url: string;
}

const cache = new Map<string, Promise<unknown>>();
const fetchCached = async <T>(url: string): Promise<T | undefined> => {
    let cached = cache.get(url);
    if (cached === undefined) {
        cached = fetch(url)
            .then(async (res) => (await res.json()) as T | { message?: string })
            .then((json) => {
                if (
                    json != null &&
                    typeof json === 'object' &&
                    'message' in json &&
                    typeof json.message === 'string' &&
                    json.message.includes('API rate limit exceeded')
                ) {
                    return undefined;
                }
                return json;
            });
        cache.set(url, cached);
    }
    return (await cached) as T | undefined;
};

export const getLatestVersion = async (): Promise<GithubRelease | undefined> => {
    return fetchCached('https://api.github.com/repos/chaiNNer-org/chaiNNer/releases/latest');
};

export const getAllVersions = async (): Promise<GithubRelease[] | undefined> => {
    return fetchCached('https://api.github.com/repos/chaiNNer-org/chaiNNer/releases');
};

export const getRepoInfo = async (): Promise<any | undefined> => {
    return fetchCached('https://api.github.com/repos/chaiNNer-org/chaiNNer');
};
