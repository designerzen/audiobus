// create

var path = require('path');

// Where do these folders live?
var folders             = {};
folders.root            = __dirname;
folders.source          = path.resolve(__dirname, 'src/');
folders.typings         = path.resolve(__dirname, 'typings/');
folders.build           = path.resolve(__dirname, 'build/');
folders.release         = path.resolve(__dirname, 'release/');
folders.distribute      = path.resolve(__dirname, 'dist/');

// Where are the files from in the beginning?
var source              = {};
source.polyfills        = path.resolve(folders.source, 'javascript/polyfillers/**/**.js');
source.markup           = path.resolve(folders.source, 'markup/**/**.+(md|html|htm)');
source.midi             = path.resolve(folders.source, 'midi/**/**.+(mid|midi)');
source.static           = path.resolve(folders.source, 'static');
source.style            = path.resolve(folders.source, 'styles/style.less');
source.typescript       = [folders.source+'typescript/audiobus/**/**.ts', './typings/**/**.ts'];

// Where do the files ends up in the end?
var destination = function( folder )
{
  var output = {};
  output.midi        = path.resolve(folder,'assets/midi');
  output.static      = path.resolve(folder);
  output.scripts     = path.resolve(folder,'assets/scripts/');
  output.style       = path.resolve(folder,'assets/style/');
  output.examples    = path.resolve(folder,'examples/');
  return output;
}


// expose
module.exports = {
  folders         : folders,
  source          : source,
  typings         : folders.typings,
  build           : destination( folders.build ),
  release         : destination( folders.release ),
  distribute      : destination( folders.distribute ),
  destination     : destination( folders.build ),
  names           : {
    library       : "audiobus",
    polyfills     : "polyfills"
  }
}
