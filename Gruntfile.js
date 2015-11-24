var versionFiles = [
  'package.json'
];
var jsFilesToCheck = [
  'Gruntfile.js',
  'app.js',
  'public/js/main.js',
  'archives/**/*.js',
  'countdown/**/*.js',
  'repos/**/*.js',
  'test/archives/*.js',
  'test/repos/*.js'
];

module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    bump: {
      options: {
        files: versionFiles,
        updateConfigs: [],
        commit: true,
        commitMessage: 'Release v%VERSION%',
        commitFiles: versionFiles,
        createTag: true,
        tagName: 'v%VERSION%',
        tagMessage: 'Version %VERSION%',
        push: true,
        pushTo: 'origin',
        gitDescribeOptions: '--tags --always --abbrev=1'
      }
    },
    clean: [
      'public/css/style.css',
      'public/js/script.js'
    ],
    csslint: {
      options: {
        csslintrc: '.csslintrc'
      },
      strict: {
        options: {
          import: 2
        },
        src: [ 'public/css/style.css' ]
      }
    },
    jscs: {
      src: jsFilesToCheck,
      options: {
        config: '.jscsrc'
      }
    },
    jshint: {
      all: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: jsFilesToCheck
      }
    },
    stylus: {
      dist: {
        options: {
          compress: true
        },
        files: {
          'public/css/style.css': 'public/css/style.styl'
        }
      }
    },
    uglify: {
      production: {
        options: {
          mangle: false,
          compress: true,
          beautify: false
        },
        files: {
          'public/js/script.js': [
            'public/js/vendor/moment/min/moment.min.js',
            'public/js/vendor/fluidvids/dist/fluidvids.min.js',
            'public/js/main.js'
          ]
        }
      }
    },
    jsbeautifier: {
      files: [ 'public/js/main.js' ],
      options: {
        config: '.jsbeautifyrc'
      }
    }
  });

  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-csslint');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jscs');
  grunt.loadNpmTasks('grunt-contrib-stylus');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-jsbeautifier');

  grunt.registerTask('travis', [
    'clean',
    'stylus',
    'jshint',
    'jsbeautifier',
    'jscs',
    'uglify',
    'csslint'
  ]);

  grunt.registerTask('default', [
    'clean',
    'jshint',
    'csslint',
    'jsbeautifier',
    'jscs',
    'uglify',
    'stylus'
  ]);

  grunt.registerTask('build', [
    'jsbeautifier',
    'uglify',
    'stylus'
  ]);

};
