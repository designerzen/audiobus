// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import gulp             from 'gulp';
import gutil            from 'gulp-util';
import path             from 'path';

////////////////////////////////////////////////////////////////////////////////
// TASK : The default task to run if gulp is not provided any arguments
////////////////////////////////////////////////////////////////////////////////
gulp.task('default', ['webpack:debug'], (cb) => {
  // load in the text file from docs and display...
  //const readme = require( '../../docs/readme.txt' );
  //console.log("Welcome to audioBUS");
  cb();
});
