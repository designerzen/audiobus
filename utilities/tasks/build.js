'use strict';

// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import fs               from 'fs';
import gulp             from 'gulp';
import gutil            from 'gulp-util';
import path             from 'path';
import webpack          from 'webpack';

////////////////////////////////////////////////////////////////////////////////
// TASK : Run the test server and ensure that the files are valid and good
// uses webpack.config.dev.js to build modules into memory
////////////////////////////////////////////////////////////////////////////////
gulp.task('build', ["webpack:compile"], (cb) => {
  // load in the text file from docs and display...
  //const readme = require( '../../docs/readme.txt' );
  //console.log("Welcome to audioBUS");
  cb();
});
