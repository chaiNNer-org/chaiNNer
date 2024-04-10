import path from 'path';

export const getCacheLocation = (userDataPath: string, cacheKey: string) => {
    return path.join(userDataPath, '/cache/', cacheKey);
};
