import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { log } from './log';

export const compressFile = async (_input, _output) => {
  try {
    await new Promise((resolve, reject) => {
      const stream = createReadStream(_input);

      stream
        .pipe(createGzip())
        .pipe(createWriteStream(_output))
        .on('finish', () => resolve(true))
        .on('error', (err) => {
          reject(err);
        });
    });

    return true;
  } catch (e) {
    log.error(e, `gzip -> compressFile`);
  }
};
