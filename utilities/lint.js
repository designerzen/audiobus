'use strict';

// ----------- LINTING ---------------------------------------------------------

// Config
import Package          from '../../package';
import Config           from '../config/app.config';

// Dependencies
import colorsSupported  from 'supports-color';
import del              from 'del';
import fs               from 'fs';
import gulp             from 'gulp';
import gulpif           from 'gulp-if';
import gutil            from 'gulp-util';
import path             from 'path';
import using            from 'gulp-using';
import sync             from 'run-sequence';
import yargs            from 'yargs';

// LINTING
import jsonlint         from 'gulp-jsonlint';
import eslint           from 'gulp-eslint';     // https://github.com/adametry/gulp-eslint
import htmlhint         from 'gulp-htmlhint';   // https://github.com/bezoerb/gulp-htmlhint

const Paths = Config.paths;
const Globs = Paths.sourceGlobs;
const verbose = Config.options.verbose;

////////////////////////////////////////////////////////////////////////////////
// Test code for validity and style adhesion
// JSON LINT
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint:builder', (cb) => {

  if (verbose) gutil.log( gutil.colors.grey("[LINT] Checking build scripts in", Globs.data, gutil.colors.grey(".") ) );
  return gulp.src( Globs.builder )
    .pipe( gulpif( verbose, using( {prefix:'[LINT] Linting data', path:'relative', color:'blue', filesize:true} ) ) )
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
    .pipe( eslint() )
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe( eslint.format() );
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    //.pipe( eslint.failAfterError() );
});
////////////////////////////////////////////////////////////////////////////////
// Test code for validity and style adhesion
// JSON LINT
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint:data', (cb) => {

  if (verbose) gutil.log( gutil.colors.grey("[LINT] Checking JSON in", Globs.data, gutil.colors.grey(".") ) );
  return gulp.src( Globs.data )
    .pipe( gulpif( verbose, using( {prefix:'[LINT] Linting data', path:'relative', color:'blue', filesize:true} ) ) )
    .pipe( jsonlint() )
    .pipe( jsonlint.reporter() );
});

////////////////////////////////////////////////////////////////////////////////
// Simply tests any log files created to ensure that they are valid
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint:logs', (cb) => {
  if (verbose) gutil.log( gutil.colors.grey("[LINT] Checking JSON in", Globs.logs, gutil.colors.grey(".") ) );
  return gulp.src( Globs.logs )
    .pipe( gulpif( verbose, using( {prefix:'[LINT] Linting logs', path:'relative', color:'blue', filesize:true} ) ) )
    .pipe( jsonlint() )
    .pipe( jsonlint.reporter() );
});

////////////////////////////////////////////////////////////////////////////////
// https://github.com/adametry/gulp-eslint
// ES6 LINT
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint:code', (cb) => {

  if (verbose) gutil.log( gutil.colors.grey("[LINT] Checking JavaScript in", Globs.scripts, gutil.colors.grey(".") ) );

  // ESLint ignores files with "node_modules" paths.
  // So, it's best to have gulp ignore the directory as well.
  // Also, Be sure to return the stream from the task;
  // Otherwise, the task may end before the stream has finished.
  return gulp.src( Globs.scripts )
    .pipe( gulpif( verbose, using( {prefix:'[LINT] Linting code', path:'relative', color:'blue', filesize:true} ) ) )
    // eslint() attaches the lint output to the "eslint" property
    // of the file object so it can be used by other modules.
    .pipe( eslint() )
    // eslint.format() outputs the lint results to the console.
    // Alternatively use eslint.formatEach() (see Docs).
    .pipe( eslint.format() );
    // To have the process exit with an error code (1) on
    // lint error, return the stream and pipe to failAfterError last.
    //.pipe( eslint.failAfterError() );
});

// CHECK HTML CODE -------------------------------------------------------------

////////////////////////////////////////////////////////////////////////////////
// MARKUP LINT
// https://www.npmjs.com/package/gulp-htmlhint
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint:markup', (cb) => {

  if (verbose) gutil.log( gutil.colors.grey("[LINT] Checking MARKUP in", Globs.markup, gutil.colors.grey(". Using"), Paths.filePaths.linterHTML ) );

  return gulp.src( Globs.markup )
    .pipe( gulpif( verbose, using( {prefix:'[LINT] Linting markup', path:'relative', color:'blue', filesize:true} ) ) )
    .pipe( htmlhint( {htmlhintrc:Paths.filePaths.linterHTML} ) )
    .pipe( htmlhint.reporter());
});
