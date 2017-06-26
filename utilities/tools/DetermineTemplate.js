import path from 'path';
import fs from 'fs';
import FindFiles from './FindFiles';

const DetermineTemplate = (baseProject, filters, fallback) =>
{
  const location = path.dirname(baseProject);
  const name = path.basename(baseProject,'.js');
  const filter = filters || ["pug","html"];
  const matches = FindFiles( location, filters );

  // match output = {
  //   folder:dir,
  //   file:filename,
  //   name:name,
  //   ext:ext,
  //   id:name without ext
  // };
  console.log("Determining Template",location,name,filter,matches);
  if (matches.length === 0)
  {
    return fallback;

  }else if (matches.length === 1)
  {
    return path.resolve( location, matches[0].name );

  }else{
    // now determine the most appropriate template!
    matches.forEach( (match)=>{
      // first check for files named with template
      if ( match.id.toLowerCase() === "template" )
      {
        return path.resolve( location, match.name );
      }
    });

    matches.forEach( (match)=>{
      // now check for a template file with the same name as the project
      if ( match.id === name )
      {
        return path.resolve( location, match.name );
      }
    });

    matches.forEach( (match)=>{
      // check to see if there is an index file...
      if ( match.id === "index" )
      {
        return path.resolve( location, match.name );
      }
    });

    // loop through filters and find any matches in the preffered order...
    for (let f=0,l=filter.length; f<l;++f)
    {
      const extension = filter[f];
      matches.forEach( (match)=>{
        // check to see if there is an index file...
        if ( match.ext === extension )
        {
          return path.resolve( location, match.name );
        }
      });
    }
    filter.forEach( (f)=>{
      // check ext of matches against them...
    })
    // we have multiples left...
    return path.resolve( location, matches[0].name );
  }

  //const template = Settings.files.template;
  //

  return fallback;
}

export default DetermineTemplate;
