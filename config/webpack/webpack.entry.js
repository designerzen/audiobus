import Settings from '../settings';
import FindFiles from '../../utilities/tools/FindFiles';

// this "reads" files that it considers as entry points.
// for the sake of easy management, it is just looking for index.ejs files

const entryPoints = {};

const startPath = Settings.folders.source;
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
  const appName = "ab-"+ match.name;
  entryPoints[appName] = match.file;
})

// hard coded ones
//entryPoints.app  = Settings.files.index;

module.exports = entryPoints;
