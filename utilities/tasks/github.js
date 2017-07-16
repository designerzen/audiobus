/*
options: Object
Return: Object (stream.Transform)
options.remoteUrl

Type: String
Default: URL for the remote of the current dir (assumes a git repository)

By default gulp-gh-pages assumes the current working directory is a git repository
and uses its remote url. If your gulpfile.js is not in a git repository, or if you
want to push to a different remote url, you can specify it.
Ensure you have write access to the repository.
options.origin

Type: String
Default: "origin"

Git remote.
options.branch

Type: String
Default: "gh-pages"

The branch where deploy will by done. Change to "master" for username.github.io projects.
options.cacheDir

Type: String
Default: .publish

Set the directory path to keep a cache of the repository. If it doesn't exist, gulp-gh-pages automatically create it.
options.push

Type: Boolean
Default: true

Allow you to make a build on the defined branch without pushing it to master. Useful for dry run.
options.force

Type: Boolean
Default: false

Force adding files to the gh-pages branch, even if they are ignored by .gitignore or .gitignore_global.
options.message

Type: String
Default: "Update [timestamp]"

Edit commit message.
*/

// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import gulp             from 'gulp';
import ghPages          from 'gulp-gh-pages';

// fetch the version number...
// bump it up!
const remoteUrl = "";
const message = "Github push at [timestamp]";

////////////////////////////////////////////////////////////////////////////////
// Copy example midi files from the source folder to the destination midi folder
////////////////////////////////////////////////////////////////////////////////
gulp.task('deploy', function() {
  return gulp.src('./dist/**/*')
    .pipe(ghPages({
      remoteUrl,
      messages
    }));
});
