var gulp = require('gulp');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var less = require('gulp-less');
var sourcemaps = require('gulp-sourcemaps');

var RELEASE  = 'release';
var DISTRIBUTE  = 'dist';
var EXAMPLES  = DISTRIBUTE+'/examples/';
var OUTPUT_FILE_NAME  = "audiobus.js";
var OUTPUT_FOLDER_SETTINGS  = "settings/";
var SOURCE_CODE_TYPESCRIPT  = ['src/typescript/audiobus/*.ts','src/typescript/typings/*.ts','src/typescript/examples/*.ts'];

var POLLYFILLS = 'src/javascrip/pollyfillers/**/*.js';


// EXAMPLES ====================================================================

gulp.task('examples', ['examples-code','midi','examples-styles'], function(){
    return gulp.src('src/markup/**/*.*')
    .pipe(gulp.dest(EXAMPLES));
})

gulp.task('midi', function(){
    return gulp.src('src/midi/**/*.+(mid|midi)')
    .pipe(gulp.dest(EXAMPLES+'assets/midi'));
})

// Compile our styles
gulp.task('examples-styles', function () {
    return gulp.src('src/styles/style.less')
    .pipe(less({
      paths:[ 'src/styles/' ]
    }))
    .pipe( gulp.dest(EXAMPLES+'assets/style/' ));
});
gulp.task('examples-code',['dist'], function () {
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
                .pipe(gulp.dest(EXAMPLES+'scripts'));
});




// TYPESCRIPT ========================
gulp.task('lint', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {} );
    return tsProject.src('src/typescript/**/**.ts')
        .pipe( tslint(tsProject) )
        .pipe( tslint.report('prose', {
            emitError: false
        }));
});

gulp.task('dist', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {
        sortOutput: true,
        outFile:OUTPUT_FILE_NAME,
        declarationFiles :true,
        allowJs :true,
        removeComments :true
    });
    var tsResult = tsProject.src(['!src/typescript/examples/**/**.ts'],['src/typescript/**/**.ts'])
        .pipe( sourcemaps.init() ) // This means sourcemaps will be generated
        .pipe( ts(tsProject) );

    // save .d.ts file definitions
    tsResult.dts.pipe(gulp.dest('src/typescript/'));
    tsResult.dts.pipe(gulp.dest(DISTRIBUTE));
    tsResult.dts.pipe(gulp.dest(RELEASE));

    //console.log( tsResult.dts );

    // save big file
    tsResult.js
        //.pipe( concat("audiobus.js")) // You can use other plugins that also support gulp-sourcemaps
        .pipe( sourcemaps.write('.')) // Now the sourcemaps are added to the .js file
        .pipe( gulp.dest(DISTRIBUTE));

    // Now add polyfilla
    gulp.src( [ POLLYFILLS, DISTRIBUTE+'/'+OUTPUT_FILE_NAME])
        .pipe( concat(OUTPUT_FILE_NAME))
        .pipe( gulp.dest(DISTRIBUTE));

    // Now squish them up!
    return gulp.src(DISTRIBUTE+'/'+OUTPUT_FILE_NAME)
        .pipe( uglify() )
        .pipe( rename("audiobus.min.js") )
        .pipe( gulp.dest(DISTRIBUTE));
});



gulp.task('compile', function () {
    var tsProject = ts.createProject( 'tsconfig.json', {} );
    var tsResult = tsProject.src(SOURCE_CODE_TYPESCRIPT)
        .pipe( ts(tsProject) );

    return tsResult.js.pipe( gulp.dest(RELEASE) );
    //.pipe(gulp.dest('built/local'));
});


// RELEASE =====================================================================
// 1. Compiles AudioBus to individual files
// 2. Copies minified audiobus.js
// 3. Copies License and Readme
// 4. Copies examples folder



// Create a local server and open it in our browser
gulp.task('serve', ['lint','dist'], function () {
    var browserSync = require('browser-sync').create();
    gulp.watch([SOURCE_CODE_TYPESCRIPT], ['dist']);
    gulp.watch(['src/styles/**/**.less'], ['examples-styles']);
    browserSync.init({
        server: {
			// Serve up our build folder
			baseDir: DISTRIBUTE,
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
gulp.task('default', ['lint','examples','compile','serve'] );