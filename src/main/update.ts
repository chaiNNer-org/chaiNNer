import https from 'https';
import semver from 'semver';

export interface LatestVersion {
    version: string;
    releaseUrl: string;
}

export const getLatestVersion = () =>
    new Promise<LatestVersion>((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/joeyballentine/chaiNNer/releases',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'chaiNNer',
            },
        };
        const req = https.request(options, (res) => {
            let response = '';

            res.on('data', (data) => {
                response += String(data);
            });

            res.on('close', () => {
                try {
                    const releases = JSON.parse(response) as {
                        tag_name: string;
                        html_url: string;
                    }[];
                    if (!releases.length) {
                        reject(new Error('Unable to find any releases'));
                        return;
                    }

                    const latestVersion = releases.reduce((greatest, curr) =>
                        semver.gt(curr.tag_name, greatest.tag_name) ? curr : greatest
                    );

                    const releaseUrl = latestVersion.html_url;
                    const latestVersionNum = semver.coerce(latestVersion.tag_name)!;
                    resolve({
                        version: latestVersionNum.version,
                        releaseUrl,
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });

export const hasUpdate = async (currentVersion: string): Promise<LatestVersion | undefined> => {
    const latest = await getLatestVersion();
    if (!semver.gt(latest.version, currentVersion)) {
        return undefined;
    }
    return latest;
};
