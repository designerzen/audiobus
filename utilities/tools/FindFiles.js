import path from 'path';
import fs from 'fs';

/**
 * Find all files recursively in specific folder containing the filter

 * @param  {String} startPath    Path relative to this file or other file which requires this files
 * @param  {String} filter       Extension name, e.g: '.html'
 * @return {Array}               Result files with path string in an array
 */
const FindFiles = (startPath,filter) =>
{
  let results = [];

  // if filter is a string, convert it to an array...
  if ( typeof filter === "string" )
  {
    filter = [filter];
  }

  if (!fs.existsSync(startPath))
  {
      console.log("No startPath specified or path invalid");
      return;
  }


  const files=fs.readdirSync(startPath);

  for(let i=0, l=files.length; i<l; i++)
  {
    const filename = path.join(startPath,files[i]);
    const name = path.basename(filename);
    const stat = fs.lstatSync(filename);

    if (stat.isDirectory())
    {
      results = results.concat(FindFiles(filename,filter)); //recurse
    }
    else
    {
      const ext = filename.substring(filename.lastIndexOf('.')+1, filename.length);
      if (filter.indexOf(ext)>=0)
      {
        const folder = path.dirname(filename);
        const dir = /[^/]*$/.exec(folder)[0];
        const output = {
          folder:dir,
          file:filename,
          name:name,
          ext:ext,
          id:name.substring(0, name.lastIndexOf('.'))
        };
        results.push(output);
      }

    }
  }
  return results;
}

export default FindFiles;
