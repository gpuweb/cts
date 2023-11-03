/* eslint-disable node/no-unpublished-require */
/* eslint-disable prettier/prettier */
/* eslint-disable no-console */

const timer = require('grunt-timer');

const kAllSuites = ['webgpu', 'stress', 'manual', 'unittests', 'demo'];

module.exports = function (grunt) {
  timer.init(grunt);

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: {
      out: ['gen/', 'out/', 'out-wpt/', 'out-node/'],
    },

    run: {
      'generate-version': {
        cmd: 'node',
        args: ['tools/gen_version'],
      },
      'generate-listings': {
        cmd: 'node',
        args: ['tools/gen_listings', 'gen/', ...kAllSuites.map(s => 'src/' + s)],
      },
      validate: {
        cmd: 'node',
        args: ['tools/validate', ...kAllSuites.map(s => 'src/' + s)],
      },
      'validate-cache': {
        cmd: 'node',
        args: ['tools/gen_cache', 'out', 'src/webgpu', '--validate'],
      },
      'write-out-wpt-cts-html': {
        // Note this generates directly into the out-wpt/ directory rather than the gen/ directory.
        cmd: 'node',
        args: ['tools/gen_wpt_cts_html', 'tools/gen_wpt_cfg_unchunked.json'],
      },
      'write-out-wpt-cts-html-chunked2sec': {
        // Note this generates directly into the out-wpt/ directory rather than the gen/ directory.
        cmd: 'node',
        args: ['tools/gen_wpt_cts_html', 'tools/gen_wpt_cfg_chunked2sec.json'],
      },
      'generate-cache': {
        // Note this generates directly into the out/ directory rather than the gen/ directory.
        cmd: 'node',
        args: ['tools/gen_cache', 'out', 'src/webgpu'],
      },
      unittest: {
        cmd: 'node',
        args: ['tools/run_node', 'unittests:*'],
      },
      'build-out': {
        cmd: 'node',
        args: [
          'node_modules/@babel/cli/bin/babel',
          '--extensions=.ts,.js',
          '--source-maps=true',
          '--out-dir=out/',
          'src/',
          // These files will be generated, instead of compiled from TypeScript.
          '--ignore=src/common/internal/version.ts',
          '--ignore=src/*/listing.ts',
        ],
      },
      'build-out-wpt': {
        cmd: 'node',
        args: [
          'node_modules/@babel/cli/bin/babel',
          '--extensions=.ts,.js',
          '--source-maps=false',
          '--delete-dir-on-start',
          '--out-dir=out-wpt/',
          'src/',
          '--only=src/common/',
          '--only=src/external/',
          '--only=src/webgpu/',
          // These files will be generated, instead of compiled from TypeScript.
          '--ignore=src/common/internal/version.ts',
          '--ignore=src/*/listing.ts',
          // These files are only used by non-WPT builds.
          '--ignore=src/common/runtime/cmdline.ts',
          '--ignore=src/common/runtime/server.ts',
          '--ignore=src/common/runtime/standalone.ts',
          '--ignore=src/common/runtime/helper/sys.ts',
          '--ignore=src/common/tools',
        ],
      },
      'build-out-node': {
        cmd: 'node',
        args: [
          'node_modules/typescript/lib/tsc.js',
          '--project', 'node.tsconfig.json',
          '--outDir', 'out-node/',
        ],
      },
      'copy-assets': {
        cmd: 'node',
        args: [
          'node_modules/@babel/cli/bin/babel',
          'src/resources/',
          '--out-dir=out/resources/',
          '--copy-files'
        ],
      },
      'copy-assets-wpt': {
        cmd: 'node',
        args: [
          'node_modules/@babel/cli/bin/babel',
          'src/resources/',
          '--out-dir=out-wpt/resources/',
          '--copy-files'
        ],
      },
      lint: {
        cmd: 'node',
        args: ['node_modules/eslint/bin/eslint', 'src/**/*.ts', '--max-warnings=0'],
      },
      fix: {
        cmd: 'node',
        args: ['node_modules/eslint/bin/eslint', 'src/**/*.ts', '--fix'],
      },
      'autoformat-out-wpt': {
        cmd: 'node',
        // MAINTENANCE_TODO(gpuweb/cts#3128): This autoformat step is broken after a dependencies upgrade.
        args: ['node_modules/prettier/bin/prettier.cjs', '--log-level=warn', '--write', 'out-wpt/**/*.js'],
      },
      tsdoc: {
        cmd: 'node',
        args: ['node_modules/typedoc/bin/typedoc'],
      },
      'tsdoc-treatWarningsAsErrors': {
        cmd: 'node',
        args: ['node_modules/typedoc/bin/typedoc', '--treatWarningsAsErrors'],
      },

      serve: {
        cmd: 'node',
        args: ['node_modules/http-server/bin/http-server', '-p8080', '-a127.0.0.1', '-c-1']
      }
    },

    copy: {
      'gen-to-out': {
        // Must run after generate-common and run:build-out.
        files: [
          { expand: true, dest: 'out/', cwd: 'gen', src: 'common/internal/version.js' },
          { expand: true, dest: 'out/', cwd: 'gen', src: '*/listing.js' },
        ],
      },
      'gen-to-out-wpt': {
        // Must run after generate-common and run:build-out-wpt.
        files: [
          { expand: true, dest: 'out-wpt/', cwd: 'gen', src: 'common/internal/version.js' },
          { expand: true, dest: 'out-wpt/', cwd: 'gen', src: 'webgpu/listing.js' },
        ],
      },
      'htmlfiles-to-out-wpt': {
        // Must run after run:build-out-wpt.
        files: [
          { expand: true, dest: 'out-wpt/', cwd: 'src', src: 'webgpu/**/*.html' },
        ],
      },
    },

    ts: {
      check: {
        tsconfig: {
          tsconfig: 'tsconfig.json',
          passThrough: true,
        },
      },
    },
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-ts');

  const helpMessageTasks = [];
  function registerTaskAndAddToHelp(name, desc, deps) {
    grunt.registerTask(name, deps);
    addExistingTaskToHelp(name, desc);
  }
  function addExistingTaskToHelp(name, desc) {
    helpMessageTasks.push({ name, desc });
  }

  grunt.registerTask('generate-common', 'Generate files into gen/', [
    'run:generate-version',
    'run:generate-listings',
  ]);
  grunt.registerTask('build-standalone', 'Build out/ (no checks; run after generate-common)', [
    'run:build-out',
    'run:copy-assets',
    'copy:gen-to-out',
  ]);
  grunt.registerTask('build-wpt', 'Build out-wpt/ (no checks; run after generate-common)', [
    'run:build-out-wpt',
    'run:copy-assets-wpt',
    'run:autoformat-out-wpt',
    'copy:gen-to-out-wpt',
    'copy:htmlfiles-to-out-wpt',
    'run:write-out-wpt-cts-html',
    'run:write-out-wpt-cts-html-chunked2sec',
  ]);
  grunt.registerTask('build-done-message', () => {
    process.stderr.write('\nBuild completed! Running checks/tests');
  });

  registerTaskAndAddToHelp('pre', 'Run all presubmit checks: standalone+wpt+typecheck+unittest+lint', [
    'clean',
    'generate-common',
    // None of the steps below have interdependencies.
    'build-standalone',
    'build-wpt',
    'run:build-out-node',
    'build-done-message',
    'ts:check',
    'run:validate',
    'run:validate-cache',
    'run:unittest',
    'run:lint',
    'run:tsdoc-treatWarningsAsErrors',
  ]);
  registerTaskAndAddToHelp('standalone', 'Build standalone and typecheck', [
    'generate-common',
    'build-standalone',
    'build-done-message',
    'run:validate',
    'ts:check',
  ]);
  registerTaskAndAddToHelp('wpt', 'Build for WPT and typecheck', [
    'generate-common',
    'build-wpt',
    'build-done-message',
    'run:validate',
    'ts:check',
  ]);
  registerTaskAndAddToHelp('unittest', 'Build standalone, typecheck, and unittest', [
    'standalone',
    'run:unittest',
  ]);
  registerTaskAndAddToHelp('check', 'Just typecheck', [
    'ts:check',
  ]);

  registerTaskAndAddToHelp('serve', 'Serve out/ on 127.0.0.1:8080 (does NOT compile source)', ['run:serve']);
  registerTaskAndAddToHelp('fix', 'Fix lint and formatting', ['run:fix']);

  addExistingTaskToHelp('clean', 'Delete built and generated files');

  grunt.registerTask('default', '', () => {
    console.error('\nAvailable tasks (see grunt --help for info):');
    for (const { name, desc } of helpMessageTasks) {
      console.error(`$ grunt ${name}`);
      console.error(`  ${desc}`);
    }
  });
};
