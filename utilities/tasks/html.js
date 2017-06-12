// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import gulp             from 'gulp';

////////////////////////////////////////////////////////////////////////////////
// Straight copy of markup html to
////////////////////////////////////////////////////////////////////////////////
gulp.task('html', function(){
    return gulp.src( Settings.source.markup )
      .pipe(gulp.dest( Settings.destination.examples ));
});
