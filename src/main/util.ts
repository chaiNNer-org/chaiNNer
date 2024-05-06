import { constants } from 'fs';
import fs from 'fs/promises';
import path from 'path';

export const checkFileExists = (file: string): Promise<boolean> =>
    fs.access(file, constants.F_OK).then(
        () => true,
        () => false
    );

export const getAllFiles = async (dirPath: string, fileList: string[] = []) => {
    const files = await fs.readdir(dirPath);

    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                await getAllFiles(filePath, fileList);
            } else {
                fileList.push(filePath);
            }
        })
    );

    return fileList;
};
