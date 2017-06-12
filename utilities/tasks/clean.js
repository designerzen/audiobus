// Config
import Package          from '../../package';
import Config           from '../../config/settings';

// Dependencies
import del              from 'del';
import gulp             from 'gulp';
import gutil            from 'gulp-util';
import path             from 'path';

////////////////////////////////////////////////////////////////////////////////
// TASK : Clean -> Empty paths.deploy folders of contents
// TESTED : TRUE
// Delete all dirs and empty any precompiled files
// https://github.com/gulpjs/gulp/blob/master/docs/recipes/delete-files-folder.md
////////////////////////////////////////////////////////////////////////////////
gulp.task('clean', (cb) => {

  const dirs = [
    // build dev folder actually resides in memory so we good
    Config.folders.build,
    Config.folders.release,
    Config.folders.distribution
  ];

  gutil.log( gutil.colors.grey("[Clean] Cleaning ") + gutil.colors.blue(dirs.length+ (dirs.length > 1? " dirs..." : " dir...")) );
  // , {force: true}
  return del( dirs, {dot: true} ).then(function (cleaned) {
      dirs.forEach( function(dir){
        gutil.log( gutil.colors.grey("[Clean] Cleaned") , gutil.colors.blue(dir) );
      });
     // no need to callback as returning promise...
  });

});
