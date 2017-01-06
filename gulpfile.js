/*

FOR USING IN OTHER PROJECTS ====================================================

    release/


FOR TESTING ====================================================================

    build/
        audiobus.min.js
        audiobus.js
        audiobus.js.map
        polyfills.js
        examples/example.html
        examples/assets/

    dist/
        audiobus.min.js
        audiobus.js
        polyfills.js
        Readme
        license

*/

// Load in tasks and modifiers
var
  config      = require('./config'),
  gulp        = require('gulp'),
  gulpif      = require('gulp-if'),
  ts          = require('gulp-typescript'),
  concat      = require('gulp-concat'),
  uglify      = require('gulp-uglify'),
  rename      = require('gulp-rename'),
  sourcemap   = require('gulp-sourcemaps');


// Settings
var debug = true;
var sourcemaps = true;

// EXAMPLES ====================================================================

////////////////////////////////////////////////////////////////////////////////
// Verbose logging just to ensure that everything fits accordingly
////////////////////////////////////////////////////////////////////////////////
gulp.task('test', function(){
    console.log("Testing Configuration...");
    console.log(config);
    // check paths exist...
});

////////////////////////////////////////////////////////////////////////////////
// Copy example midi files from the source folder to the destination midi folder
////////////////////////////////////////////////////////////////////////////////
gulp.task('examples-midi', function(){
    return gulp.src( config.source.midi )
      .pipe(gulp.dest( config.destination.midi ));
})

////////////////////////////////////////////////////////////////////////////////
// Compile our styles.
// There are two sets of styles, one set is always loaded in
// the other set are only loaded per project
////////////////////////////////////////////////////////////////////////////////
gulp.task('examples-styles', function () {

    var postcss       = require('gulp-postcss');
    var less          = require('gulp-less');
    var autoprefixer  = require('autoprefixer');
    var cssnano       = require('cssnano');

    var processors = [
        autoprefixer( {browsers: ['last 1 version']} ),
        cssnano(),
    ];

    return gulp.src( config.source.style )
      .pipe( gulpif( sourcemaps, sourcemap.init() ) )
      .pipe( less().on('error', function(err){
        // catch errors without breaking watch streams
        console.log(err);
        this.emit('end');
      }) )
      .pipe( postcss(processors) )
      .pipe( gulpif( sourcemaps, sourcemap.write( config.destination.style ) ) )
      .pipe( gulp.dest( config.destination.style ) );
});


////////////////////////////////////////////////////////////////////////////////
// This compiles down all code in the typescript/examples folder
////////////////////////////////////////////////////////////////////////////////
gulp.task('examples-code', function () {
    var tsResult = gulp.src([
          // definitions
          './typings/audiobus.d.ts',
          "./typings/index.d.ts",
          // example source files
          './src/typescript/examples/**/**.ts'
      ])
     .pipe( gulpif( sourcemaps, sourcemap.init() ))       // This means sourcemaps will be generated
     .pipe( ts() );

    return tsResult.js
      //.pipe(concat('output.js')) // You can use other plugins that also support gulp-sourcemaps
      // Now the sourcemaps are added to the .js file
      .pipe( gulpif( sourcemaps,sourcemap.write() ))
      .pipe( gulp.dest( config.destination.scripts ));
});

////////////////////////////////////////////////////////////////////////////////
// Straight copy of markup html to
////////////////////////////////////////////////////////////////////////////////
gulp.task('examples-markup', function(){
    return gulp.src( config.source.markup )
      .pipe(gulp.dest( config.destination.examples ));
});

////////////////////////////////////////////////////////////////////////////////
// Do all of the example files together
////////////////////////////////////////////////////////////////////////////////
gulp.task('examples', ['examples-code','examples-markup', 'examples-midi','examples-styles'], function(cb){
    cb();
});


// static files simple copy to destination
// .htaccess
// https://github.com/h5bp/server-configs-apache/blob/master/dist/.htaccess
gulp.task('static', function(){
    return gulp.src( config.source.static )
      .pipe(gulp.dest( config.destination.build ));
});

// TYPESCRIPT ========================

////////////////////////////////////////////////////////////////////////////////
// TASK : LINT
// Ensure that the code is good and proper
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint', function () {
    var tslint = require('gulp-tslint');
    return gulp.src( config.source.typescript )
        .pipe( tslint({
            formatter: "verbose"
            //formatter: "prose"
        }) )
        .pipe( tslint.report( {
            emitError: false,
            summarizeFailureOutput: true,
            reportLimit: 20
        } ));
});

////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////
gulp.task('polyfills', function(){
    // Now add polyfilla
    return gulp.src( config.source.polyfills )
        .pipe( uglify() )
        .pipe( concat( config.names.polyfills + '.js' ) )
        .pipe( gulp.dest( config.destination.build ) )
        .pipe( gulp.dest( config.destination.release ) );
        //.pipe( gulp.dest(destination.distribute) );
});

////////////////////////////////////////////////////////////////////////////////
// save typed definitions locally...
////////////////////////////////////////////////////////////////////////////////
gulp.task('compile-definition', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {
        declaration : true,
        declarationFiles : true
    });

    var tsResult = gulp.src( config.source.typescript ).pipe( tsProject() );
    return  tsResult.dts.pipe( gulp.dest( config.typings ) );
});


////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////
gulp.task('compile-file', function () {

    // if this lives outside of this closure then you can incrementally compile :)
    var tsProject = ts.createProject( 'tsconfig.json', {
        outFile: config.names.library + '.js',
        //declarationFiles : true,
        allowJs : true,
        removeComments : !debug
    });

    var tsResult = tsProject.src(['./typings/**/**.ts','./src/typescript/audiobus/**/**.ts'])
        .pipe( gulpif( sourcemaps,sourcemap.init() ) ) // This means sourcemaps will be generated
        .pipe( tsProject() );

    // save .d.ts file definitions
    //tsResult.dts.pipe(gulp.dest(config.typings ));


    // save big file
    return tsResult.js
        //.pipe( concat("audiobus.js")) // You can use other plugins that also support gulp-sourcemaps
        .pipe( gulpif( sourcemaps,sourcemap.write('.')) ) // Now the sourcemaps are added to the .js file
        .pipe( gulp.dest(config.destination.build));
        //.pipe( gulp.dest(destination.distribute));
});

// RELEASE =====================================================================
gulp.task('compile-release', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {
        outFile : config.names.library + '.js',
        declarationFiles : true,
        allowJs : true,
        removeComments : true
    });

    var tsResult = tsProject.src( config.source.typescript ).pipe( ts(tsProject) );
    // save big file
    return tsResult.js.pipe( gulp.dest( config.destination.release ));
});

// Compresss all of the javascript files and uglify
gulp.task('minify', ['compile-release'], function(){
    return gulp.src( config.destination.release+'/'+config.names.library + '.js')
        .pipe( uglify() )
        .pipe( rename(config.names.library + 'min.js') )
        .pipe( gulp.dest( config.destination.release ) );
});




// This creates a folder of individual libs - not one long javascript
gulp.task('compile-folder', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {} );
    var tsResult = tsProject.src( config.source.typescript )
        .pipe( gulpif( sourcemaps,sourcemap.init() ) ) // This means sourcemaps will be generated
        .pipe( ts(tsProject) );

    return tsResult.js
        //.pipe( concat("audiobus.js")) // You can use other plugins that also support gulp-sourcemaps
        .pipe( gulpif( sourcemaps,sourcemap.write( config.destination.build )) ) // Now the sourcemaps are added to the .js file
        .pipe( gulp.dest( config.destination.build ) );
});




////////////////////////////////////////////////////////////////////////////////
// TASK : Serve
// Create a local server and open it in our browser
////////////////////////////////////////////////////////////////////////////////
gulp.task('serve', ['lint','compile-file'], function () {

    gulp.watch([config.source.typescript], ['compile-file']);
    gulp.watch([config.source.style], ['examples-styles']);
    gulp.watch(['src/typescript/examples/**/**.ts'], ['examples-code']);

    var browserSync = require('browser-sync').create();
    browserSync.init({
        server: {
			// Serve up our build folder
			baseDir: destination.build,
            directory: true,
            index: "test.html",
            logPrefix: "AudioBus::",
            ghostMode: {
                clicks: false,
                forms: false,
                scroll: false
            },
            //files: [ '**/*.js', '**/*.css', '**/*.html'],
            files: [ '**/*.js', '**/*.css','**/*.html'],
            injectChanges: true,
            logFileChanges: false,
            //logLevel: 'silent',
            notify: true,
            reloadDelay: 0,
            browser: "google chrome"
        }
	});
});


// FOLDER_RELEASE ==============================================================

// 1. Compiles AudioBus to individual files
// 2. Copies minified audiobus.js
// 3. Copies License and Readme
// 4. Copies examples folder

var callback = function (cb) { cb(); };

////////////////////////////////////////////////////////////////////////////////
// This creates all of our files for use during development :)
////////////////////////////////////////////////////////////////////////////////
gulp.task('build', ['lint','polyfills','compile-folder'], callback );

////////////////////////////////////////////////////////////////////////////////
// This creates all of our files for use in production :)
////////////////////////////////////////////////////////////////////////////////
gulp.task('release', ['lint','polyfills','minify'], callback );

////////////////////////////////////////////////////////////////////////////////
// DEFAULT TASK : Do the following sequence of events
////////////////////////////////////////////////////////////////////////////////
gulp.task('default', ['build','examples','serve'], callback );
