/* eslint-disable @typescript-eslint/no-loop-func */
import * as fs from 'fs';
import * as path from 'path';
import { RawSaveFile, SaveFile } from '../../src/common/SaveFile';

const dataDir = path.join(__dirname, '..', 'data');

for (const file of fs.readdirSync(dataDir)) {
    const filePath = path.join(dataDir, file);

    test(`Read save file ${file}`, async () => {
        const parsed = await SaveFile.read(filePath);
        expect(parsed).toMatchSnapshot();
    });
    test(`Write save file ${file}`, async () => {
        const json = SaveFile.stringify(await SaveFile.read(filePath), '');
        const obj = JSON.parse(json) as RawSaveFile;
        obj.timestamp = '';
        expect(obj).toMatchSnapshot();
    });
}
