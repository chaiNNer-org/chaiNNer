import https from 'https';
import semver from 'semver';

export interface LatestVersion {
    version: string;
    releaseUrl: string;
    body: string;
}

export const getLatestVersion = () =>
    new Promise<LatestVersion>((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/joeyballentine/chaiNNer/releases/latest',
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
                    const latest = JSON.parse(response) as {
                        tag_name: string;
                        html_url: string;
                        body: string;
                    };

                    const releaseUrl = latest.html_url;
                    const latestVersionNum = semver.coerce(latest.tag_name)!;
                    const { body } = latest;
                    resolve({
                        version: latestVersionNum.version,
                        releaseUrl,
                        body,
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
