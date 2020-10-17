/// <reference no-default-lib="true" />
/// <reference lib="webworker" />

declare var self: ServiceWorkerGlobalScope;

import * as ts from 'typescript';

self.addEventListener('install', () => {
  console.debug('Service worker installing');
  return self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.debug('Service worker activated');
  return self.clients.claim();
});

const tsconfig = require('../tsconfig.json');

const sourceFileRegex = new RegExp(/(\/src(\/[^\/.]+)+.*?)\.(js|ts)/gm)
self.addEventListener('fetch', (event) => {
    console.debug(event.request.url);
    const url = new URL(event.request.url);
    const m = (new RegExp(sourceFileRegex.source, sourceFileRegex.flags)).exec(url.pathname);
    if (m && !m[1].endsWith('listing')) {
        event.respondWith((async () => {
            url.pathname = m[1] + '.ts';
            const filePath = url.toString();

            const request = new Request(filePath, event.request);
            console.debug(' => compiling', request.url);

            const response = await fetch(request);
            const file = await response.text();

            const asModuleKind = (kind?: string) => {
              switch (kind?.toLowerCase()) {
                case 'commonjs':
                  return ts.ModuleKind.CommonJS;
                case 'amd':
                  return ts.ModuleKind.AMD;
                case 'umd':
                  return ts.ModuleKind.UMD;
                case 'system':
                  return ts.ModuleKind.System;
                case 'es2015':
                  return ts.ModuleKind.ES2015;
                case 'es2020':
                  return ts.ModuleKind.ES2020;
                case 'esnext':
                  return ts.ModuleKind.ESNext;
                default:
                  return undefined;
              }
            };

            const asScriptTarget = (target?: string) => {
              switch (target?.toLowerCase()) {
                case 'es3':
                  return ts.ScriptTarget.ES3;
                case 'es5':
                  return ts.ScriptTarget.ES5;
                case 'es2015':
                  return ts.ScriptTarget.ES2015;
                case 'es2016':
                  return ts.ScriptTarget.ES2016;
                case 'es2017':
                  return ts.ScriptTarget.ES2017;
                case 'es2018':
                  return ts.ScriptTarget.ES2018;
                case 'es2019':
                  return ts.ScriptTarget.ES2019;
                case 'es2020':
                  return ts.ScriptTarget.ES2020;
                case 'esnext':
                  return ts.ScriptTarget.ESNext;
                case 'json':
                  return ts.ScriptTarget.JSON;
                case 'latest':
                  return ts.ScriptTarget.Latest;
                default:
                  return undefined;
              }
            };

            const asModuleResolutionKind = (kind?: string) => {
              switch (kind?.toLowerCase()) {
                case 'classic':
                  return ts.ModuleResolutionKind.Classic;
                case 'nodejs':
                  return ts.ModuleResolutionKind.NodeJs;
                default:
                  return undefined;
              }
            };

            const compilerOptions = { ...tsconfig['compilerOptions'] } as ts.CompilerOptions;

            compilerOptions.module = asModuleKind(
              tsconfig['compilerOptions']['module']);
            compilerOptions.target = asScriptTarget(
              tsconfig['compilerOptions']['target'] || 'latest');
            compilerOptions.moduleResolution = asModuleResolutionKind(
              tsconfig['compilerOptions']['moduleResolution']);

            // https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
            const output = ts.transpile(file, compilerOptions);

            return new Response(output, {
              headers: {
                'content-type': 'application/javascript',
              },
            });
        })());
    } else  {
        console.debug(' => ', '(not matched)');
    }
});
