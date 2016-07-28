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
var gulp = require('gulp');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var less = require('gulp-less');
var sourcemaps = require('gulp-sourcemaps');

var OUTPUT_FILE_NAME_LIBRARY            = "audiobus.js";
var OUTPUT_FILE_NAME_LIBRARY_MINIFIED   = "audiobus.min.js";
var OUTPUT_FILE_NAME_POLYFILLS          = "polyfills.js";

var SOURCE_CODE_TYPESCRIPT  = ['src/typescript/audiobus/*.ts','src/typescript/typings/*.ts','src/typescript/examples/*.ts'];

// Where do these folders live?
var folders             = {};
folders.source          = 'src/';
folders.build           = 'build';
folders.release         = 'release';
folders.distribute      = 'dist';
folders.examples        = folders.build+'/examples/';

// Where are the files from in the beginning?
var source              = {};
source.polyfills        = folders.source+'javascript/polyfillers/**/**.js';
source.markup           = folders.source+'markup/**/**.+(md|html|htm)';
source.midi             = folders.source+'midi/**/**.+(mid|midi)';
source.style            = folders.source+'styles/style.less';
source.typescript       = [folders.source+'typescript/audiobus/**/**.ts',folders.source+'typescript/typings/**/**.ts'];

// Where do the files ends up in the end?
var destination         = {};
destination.examples    = folders.examples;
destination.midi        = folders.examples+'assets/midi';
destination.style       = folders.examples+'assets/style/';
destination.scripts     = folders.examples+'assets/scripts/';
destination.build       = folders.build;
destination.release     = folders.release;
destination.distribute  = folders.distribute;

// EXAMPLES ====================================================================



gulp.task('examples-midi', function(){
    return gulp.src(source.midi)
    .pipe(gulp.dest(destination.midi));
})

// Compile our styles
gulp.task('examples-styles', function () {
    return gulp.src( source.style )
    .pipe(sourcemaps.init())
    .pipe(less({
      paths:[ 'src/styles/' ]
    }))
    .pipe( sourcemaps.write(destination.style) )
    .pipe( gulp.dest(destination.style) );
});

// This compiles down all code in the typescript/examples folder
gulp.task('examples-code', function () {
    var tsResult = gulp.src([
            'src/typescript/audiobus.d.ts',
            "src/typescript/typings/**/**.ts",
            'src/typescript/examples/**/**.ts'
        ])
       .pipe(sourcemaps.init()) // This means sourcemaps will be generated
       .pipe(ts({
           sortOutput: true,
           noExternalResolve:true
       }));

    return tsResult.js
                //.pipe(concat('output.js')) // You can use other plugins that also support gulp-sourcemaps
                .pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file
                .pipe(gulp.dest(destination.scripts));
});

gulp.task('examples-markup', function(){
    return gulp.src(source.markup)
    .pipe(gulp.dest(destination.examples));
})

gulp.task('examples', ['examples-code','examples-markup', 'examples-midi','examples-styles'], function(cb){
    cb();
})



// TYPESCRIPT ========================
gulp.task('lint', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {} );
    return tsProject.src( source.typescript )
        .pipe( tslint(tsProject) )
        .pipe( tslint.report('prose', {
            emitError: false
        }));
});

gulp.task('polyfills', function(){
    // Now add polyfilla
    return gulp.src( source.polyfills )
        .pipe( uglify() )
        .pipe( concat(OUTPUT_FILE_NAME_POLYFILLS) )
        .pipe( gulp.dest(destination.build) )
        .pipe( gulp.dest(destination.release) )
        //.pipe( gulp.dest(destination.distribute) );
});





// This creates all of our files :)
gulp.task('build', ['lint','polyfills','compile-folder'],function (cb) {
    cb();
});


gulp.task('compile-file', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {
        sortOutput: true,
        outFile:OUTPUT_FILE_NAME_LIBRARY,
        declarationFiles :true,
        allowJs :true,
        removeComments :true
    });

    var tsResult = tsProject.src(['src/typescript/typings/**/**.ts','src/typescript/audiobus/**/**.ts'])
        .pipe( sourcemaps.init() ) // This means sourcemaps will be generated
        .pipe( ts(tsProject) );

    // save .d.ts file definitions
    //tsResult.dts.pipe(gulp.dest('src/typescript/'));
    tsResult.dts.pipe(gulp.dest(destination.build));
    //tsResult.dts.pipe(gulp.dest(destination.release));

    //console.log( tsResult.dts );

    // save big file
    return tsResult.js
        //.pipe( concat("audiobus.js")) // You can use other plugins that also support gulp-sourcemaps
        .pipe( sourcemaps.write('.') ) // Now the sourcemaps are added to the .js file
        .pipe( gulp.dest(destination.build));
        //.pipe( gulp.dest(destination.distribute));
});

// RELEASE =====================================================================
gulp.task('compile-release', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {
        sortOutput: true,
        outFile:OUTPUT_FILE_NAME_LIBRARY,
        declarationFiles :true,
        allowJs :true,
        removeComments :true
    });

    var tsResult = tsProject.src(source.typescript).pipe( ts(tsProject) );
    // save big file
    return tsResult.js.pipe( gulp.dest(destination.release));
});

// Compresss all of the javascript files and uglify
gulp.task('minify', ['compile-release'], function(){
    return gulp.src( destination.release+'/'+OUTPUT_FILE_NAME_LIBRARY)
        .pipe( uglify() )
        .pipe( rename(OUTPUT_FILE_NAME_LIBRARY_MINIFIED) )
        .pipe( gulp.dest(destination.release) );
});
// This creates all of our files :)
gulp.task('release', ['lint','polyfills','minify'],function (cb) {
    cb();
});




// This creates a folder of individual libs - not one long javascript
gulp.task('compile-folder', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {} );
    var tsResult = tsProject.src(source.typescript)
        .pipe( sourcemaps.init() ) // This means sourcemaps will be generated
        .pipe( ts(tsProject) );

    return tsResult.js
        //.pipe( concat("audiobus.js")) // You can use other plugins that also support gulp-sourcemaps
        .pipe( sourcemaps.write(destination.build) ) // Now the sourcemaps are added to the .js file
        .pipe( gulp.dest(destination.build) );
});


// FOLDER_RELEASE =====================================================================

// 1. Compiles AudioBus to individual files
// 2. Copies minified audiobus.js
// 3. Copies License and Readme
// 4. Copies examples folder



// Create a local server and open it in our browser
gulp.task('serve', ['lint','compile-file'], function () {
    var browserSync = require('browser-sync').create();
    gulp.watch([source.typescript], ['compile-file']);
    gulp.watch([source.style], ['examples-styles']);
    gulp.watch(['src/typescript/examples/**/**.ts'], ['examples-code']);
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

// 'lint',
gulp.task('default', ['build','examples','serve'] );