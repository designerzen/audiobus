// Config
import Package          from '../../package';
import Config           from '../../config/settings';

// Dependencies
import gulp             from 'gulp';
import gutil            from 'gulp-util';
import tslint           from 'gulp-tslint';

////////////////////////////////////////////////////////////////////////////////
// TASK : LINT
// Ensure that the code is good and proper
////////////////////////////////////////////////////////////////////////////////
gulp.task('lint', (cb) => {

    return gulp.src( Config.source.typescript )
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
