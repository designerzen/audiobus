import Settings from '../settings';
import FindFiles from '../../utilities/tools/FindFiles';
import glob from 'glob';

// this "reads" files that it considers as entry points.
// for the sake of easy management, it is just looking for index.ejs files

const startPath = Settings.folders.source;

// // @see https://webpack.js.org/configuration/entry-context/#entry
// const entryGlob = function () {
//   return glob.sync(startPath+'/**/*.+(js|pug)', {
//     absolute: true, // Receive absolute paths for matched files.
//     cwd: Settings.folders.root, // The current working directory in which to search.
//     matchBase: true, // Perform a basename-only match.
//     nodir: true, // Do not match directories, only files.
//     nosort: true // Don't sort the results.
//   });
// }
// module.exports = entryGlob;

const entryPoints = {};

const filter = ".js";

const matches = FindFiles( startPath, filter );

// match output = {
//   folder:dir,
//   file:filename,
//   name:name
// };
// now convert our matches to entry points :)
matches.forEach( (match)=>{
  console.log("match",match);
  const folderName = match.folder;
  const appName = "audiobus-"+ match.name;
  entryPoints[appName] = match.file;
})

// hard coded ones
entryPoints.app  = Settings.files.index;

module.exports = entryPoints;
