import { constants } from 'fs';
import fs from 'fs/promises';

// eslint-disable-next-line import/prefer-default-export
export const checkFileExists = (file: string): Promise<boolean> =>
  fs.access(file, constants.F_OK).then(
    () => true,
    () => false
  );
