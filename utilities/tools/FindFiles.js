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

  if (!fs.existsSync(startPath))
  {
      console.log("No startPath specified or path invalid");
      return;
  }
  const folder = path.dirname(startPath);
  const dir = /[^/]*$/.exec(folder)[0];
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
    else if (filename.indexOf(filter)>=0) 
    {
      const output = {
        folder:dir,
        file:filename,
        name:name
      };
      results.push(output);
    }
  }
  return results;
}

export default FindFiles;
