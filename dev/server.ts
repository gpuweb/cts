import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as babel from '@babel/core';
import * as chokidar from 'chokidar';
import * as express from 'express';
import * as morgan from 'morgan';
import * as portfinder from 'portfinder';

import { makeListing } from '../src/common/tools/crawl.js';

// Import the project's babel.config.js. We'll use the same config for the runtime compiler.
const babelConfig = {
  ...require(path.resolve(__dirname, '../babel.config.js'))({
    cache: () => {
      /* not used */
    },
  }),
  sourceMaps: 'inline',
};

// Caches for the generated listing file and compiled TS sources to speed up reloads.
const listingCache = new Map<string, string>();
const compileCache = new Map<string, string>();

const srcDir = path.resolve(__dirname, '../src');

console.log('Watching changes in', srcDir);
const watcher = chokidar.watch(srcDir, {
  persistent: true,
});

/**
 * Handler to dirty the compile cache for changed .ts files.
 */
function dirtyCompileCache(absPath: string, stats?: fs.Stats) {
  const relPath = path.relative(srcDir, absPath);
  if ((stats === undefined || stats.isFile()) && relPath.endsWith('.ts')) {
    const tsUrl = path.sep + relPath;
    if (compileCache.has(tsUrl)) {
      console.debug('Dirtying compile cache', tsUrl);
    }
    compileCache.delete(tsUrl);
  }
}

/**
 * Handler to dirty the listing cache for directory changes and .spec.ts changes.
 * Also dirties the compile cache for changed files.
 */
function dirtyListingAndCompileCache(absPath: string, stats?: fs.Stats) {
  const relPath = path.relative(srcDir, absPath);

  const segments = relPath.split(path.sep);
  // The listing changes if the directories change, or if a .spec.ts file is added/removed.
  const listingChange =
    (path.extname(relPath) === '' || relPath.endsWith('.spec.ts')) && segments.length > 0;
  if (listingChange) {
    const suite = segments[0];
    if (listingCache.has(suite)) {
      console.debug('Dirtying listing cache', suite);
    }
    listingCache.delete(suite);
  }

  dirtyCompileCache(absPath, stats);
}

watcher.on('add', dirtyListingAndCompileCache);
watcher.on('unlink', dirtyListingAndCompileCache);
watcher.on('addDir', dirtyListingAndCompileCache);
watcher.on('unlinkDir', dirtyListingAndCompileCache);
watcher.on('change', dirtyCompileCache);

const app = express();

// Set up logging
app.use(morgan('dev'));

// Serve the standalone runner directory
app.use('/standalone', express.static(path.resolve(srcDir, '../standalone')));

// Serve a suite's listing.js file by crawling the filesystem for all tests.
app.get('/out/:suite/listing.js', async (req, res, next) => {
  const suite = req.params['suite'];

  if (listingCache.has(suite)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(listingCache.get(suite));
    return;
  }

  try {
    const listing = await makeListing(path.resolve(srcDir, suite, 'listing.ts'));
    const result = `export const listing = Promise.resolve(${JSON.stringify(
      listing,
      undefined,
      2
    )})`;

    listingCache.set(suite, result);
    res.setHeader('Content-Type', 'application/javascript');
    res.send(result);
  } catch (err) {
    next(err);
  }
});

// Serve all other .js files by fetching the source .ts file and compiling it.
app.get('/out/**/*.js', async (req, res, next) => {
  const tsUrl = path.relative('/out', req.url).replace(/\.js$/, '.ts');
  if (compileCache.has(tsUrl)) {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(compileCache.get(tsUrl));
    return;
  }

  const absPath = path.join(srcDir, tsUrl);

  try {
    const result = await babel.transformFileAsync(absPath, babelConfig);
    if (result && result.code) {
      compileCache.set(tsUrl, result.code);

      res.setHeader('Content-Type', 'application/javascript');
      res.send(result.code);
    } else {
      throw new Error(`Failed compile ${tsUrl}.`);
    }
  } catch (err) {
    next(err);
  }
});

const host = '0.0.0.0';
const port = 8080;
// Find an available port, starting at 8080.
portfinder.getPort({ host, port }, (err, port) => {
  if (err) {
    throw err;
  }
  watcher.on('ready', () => {
    // Listen on the available port.
    app.listen(port, host, () => {
      console.log('Standalone test runner running at:');
      for (const iface of Object.values(os.networkInterfaces())) {
        for (const details of iface || []) {
          if (details.family === 'IPv4') {
            console.log(`  http://${details.address}:${port}/standalone/`);
          }
        }
      }
    });
  });
});
