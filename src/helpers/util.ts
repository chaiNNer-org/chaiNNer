import { constants } from 'fs';
import fs from 'fs/promises';

export const checkFileExists = (file: string): Promise<boolean> =>
  fs.access(file, constants.F_OK).then(
    () => true,
    () => false
  );

export const assertNever = (value: never): never => {
  throw new Error(`Unreachable code path. The value ${String(value)} is invalid.`);
};
