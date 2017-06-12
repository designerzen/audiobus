// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import gulp             from 'gulp';

////////////////////////////////////////////////////////////////////////////////
// Copy example midi files from the source folder to the destination midi folder
////////////////////////////////////////////////////////////////////////////////
gulp.task('examples-midi', function(){
    return gulp.src( Settings.source.midi )
      .pipe(gulp.dest( Settings.destination.midi ));
})
