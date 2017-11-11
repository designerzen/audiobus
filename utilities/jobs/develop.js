// Config
import Package      from '../../package';
import Config       from '../config/app.config';

import gulp         from 'gulp';
import gutil        from 'gulp-util';

// Lint everything at once!
gulp.task('develop', ['serve'], ()=>{
    gutil.log( gutil.colors.grey("[DEVELOPING...]", gutil.colors.grey("Complete") ) );
  }
);
