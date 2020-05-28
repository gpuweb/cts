module.exports = function (grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: {
      constants: ['src/constants.ts', 'src/common/constants.ts'],
      out: ['out/', 'out-wpt'],
    },

    run: {
      'generate-version': {
        cmd: 'node',
        args: ['tools/gen_version'],
      },
      'generate-listings': {
        cmd: 'node',
        args: ['tools/gen_listings', 'webgpu', 'unittests', 'demo'],
      },
      'generate-wpt-cts-html': {
        cmd: 'node',
        args: ['tools/gen_wpt_cts_html', 'out-wpt/cts.html', 'src/common/templates/cts.html'],
      },
      test: {
        cmd: 'node',
        args: ['tools/run', 'unittests:*'],
      },
      'build-out': {
        cmd: 'node',
        args: [
          'node_modules/@babel/cli/bin/babel',
          '--source-maps=true',
          '--extensions=.ts',
          '--out-dir=out/',
          'src/',
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
    },

    watch: {
      src: {
        files: ['src/**/*'],
        tasks: ['run:build-out', 'run:lint'],
        options: {
          spawn: false,
        }
      }
    },

    copy: {
      'webgpu-constants': {
        files: [
          {
            expand: true,
            cwd: 'node_modules/@webgpu/types/src',
            src: 'constants.ts',
            dest: 'src/common/',
          },
        ],
      },
      'out-wpt': {
        files: [
          { expand: true, cwd: '.', src: 'LICENSE.txt', dest: 'out-wpt/' },
          { expand: true, cwd: 'out', src: 'common/constants.js', dest: 'out-wpt/' },
          { expand: true, cwd: 'out', src: 'common/framework/**/*.js', dest: 'out-wpt/' },
          { expand: true, cwd: 'out', src: 'common/runtime/wpt.js', dest: 'out-wpt/' },
          { expand: true, cwd: 'out', src: 'common/runtime/helper/**/*.js', dest: 'out-wpt/' },
          { expand: true, cwd: 'out', src: 'webgpu/**/*.js', dest: 'out-wpt/' },
          { expand: true, cwd: 'src', src: 'webgpu/**/*.html', dest: 'out-wpt/' },
        ],
      },
    },

    'http-server': {
      '.': {
        root: '.',
        port: 8080,
        host: '127.0.0.1',
        cache: -1,
      },
      'background': {
        root: '.',
        port: 8080,
        host: '127.0.0.1',
        cache: -1,
        runInBackground: true,
        logFn: function (req, res, error) {
          // Only log errors to not spam the console.
          if (error) {
            console.error(error);
          }
        },
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
  grunt.loadNpmTasks('grunt-http-server');
  grunt.loadNpmTasks('grunt-run');
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.event.on('watch', function (action, filepath) {
    const buildArgs = grunt.config(['run', 'build-out', 'args']);
    buildArgs[buildArgs.length - 1] = filepath;
    grunt.config(['run', 'build-out', 'args'], buildArgs);

    const lintArgs = grunt.config(['run', 'lint', 'args']);
    lintArgs[lintArgs.length - 1] = filepath;
    grunt.config(['run', 'lint', 'args'], lintArgs);
  });

  const helpMessageTasks = [];
  function registerTaskAndAddToHelp(name, desc, deps) {
    grunt.registerTask(name, deps);
    addExistingTaskToHelp(name, desc);
  }
  function addExistingTaskToHelp(name, desc) {
    helpMessageTasks.push({ name, desc });
  }

  grunt.registerTask('set-quiet-mode', () => {
    grunt.log.write('Running other tasks');
    require('quiet-grunt');
  });

  grunt.registerTask('prebuild', 'Pre-build tasks (clean and re-copy)', [
    'clean',
    'copy:webgpu-constants',
  ]);
  grunt.registerTask('compile', 'Compile and generate (no checks, no WPT)', [
    'run:build-out',
    'run:generate-version',
    'run:generate-listings',
  ]);
  grunt.registerTask('generate-wpt', 'Generate out-wpt/', [
    'copy:out-wpt',
    'run:generate-wpt-cts-html',
  ]);
  grunt.registerTask('compile-done-message', () => {
    process.stderr.write('\nBuild completed! Running checks/tests');
  });

  registerTaskAndAddToHelp('pre', 'Run all presubmit checks: build+typecheck+test+lint', [
    'set-quiet-mode',
    'wpt',
    'run:lint',
  ]);
  registerTaskAndAddToHelp('test', 'Quick development build: build+typecheck+test', [
    'set-quiet-mode',
    'prebuild',
    'compile',
    'compile-done-message',
    'ts:check',
    'run:test',
  ]);
  registerTaskAndAddToHelp('wpt', 'Build for WPT: build+typecheck+test+wpt', [
    'set-quiet-mode',
    'prebuild',
    'compile',
    'generate-wpt',
    'compile-done-message',
    'ts:check',
    'run:test',
  ]);
  registerTaskAndAddToHelp('check', 'Typecheck and lint', [
    'set-quiet-mode',
    'copy:webgpu-constants',
    'ts:check',
    'run:lint',
  ]);
  registerTaskAndAddToHelp('dev', 'Start the dev server, and watch for changes', [
    'http-server:background',
    'watch',
  ]);

  registerTaskAndAddToHelp('serve', 'Serve out/ on 127.0.0.1:8080', ['http-server:.']);
  registerTaskAndAddToHelp('fix', 'Fix lint and formatting', ['run:fix']);

  grunt.registerTask('default', '', () => {
    console.error('\nAvailable tasks (see grunt --help for info):');
    for (const { name, desc } of helpMessageTasks) {
      console.error(`$ grunt ${name}`);
      console.error(`  ${desc}`);
    }
  });
};
