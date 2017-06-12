'use strict';

// Config
import Package      from '../../package';
import Config       from '../config/app.config';

import gulp         from 'gulp';
import gutil        from 'gulp-util';

// Lint everything at once!
gulp.task('audit',
  // Lint all code, data, markup and logs
  //['lint:code','lint:data','lint:markup', 'lint:logs']
  ['lint'], function completed(){
    gutil.log( gutil.colors.grey("[AUDIT]", gutil.colors.grey("Complete") ) );

  }
);
