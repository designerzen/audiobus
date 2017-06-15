// Other config files
import Package from '../package.json';

import server from './config.server';

import path from 'path';

// SETTINGS!
// You can change things here and they will have an effect on how the
// build scripts operate
//const ROOT = __dirname; // this is the root dir of the project (audiobus/)
const ROOT = path.join(__dirname, "../");

// Where do these folders live?
const folders             = {};
  folders.root            = ROOT;
  folders.config          = path.resolve(folders.root, 'config');
  folders.source          = path.resolve(folders.root, 'source');
  folders.code            = path.resolve(folders.source, 'code');
  folders.typescript      = path.resolve(folders.code, 'typescript');
  folders.assets          = path.resolve(folders.source, 'assets');
  folders.fonts           = path.resolve(folders.assets, 'fonts');
  folders.images          = path.resolve(folders.assets, 'images');
  folders.styles          = path.resolve(folders.assets, 'styles');
  folders.markup          = path.resolve(folders.source, 'markup');
  folders.typings         = path.resolve(folders.root, 'typings');
  folders.build           = path.resolve(folders.root, 'build');
  folders.release         = path.resolve(folders.root, 'release');
  folders.distribution    = path.resolve(folders.root, 'dist');
  folders.utilities       = path.resolve(folders.root, 'utilities');
  folders.jobs            = path.resolve(folders.utilities, 'jobs');
  folders.tasks           = path.resolve(folders.utilities, 'tasks');

// Where are the files from in the beginning?
const source              = {};
  source.polyfills        = path.resolve(folders.code, 'javascript/polyfillers/**/**.js');
  source.markup           = path.resolve(folders.markup, '**/**.+(md|html|htm|pug|jade)');
  source.midi             = path.resolve(folders.assets, 'midi/**/**.+(mid|midi)');
  source.static           = path.resolve(folders.source, 'static');
  source.style            = path.resolve(folders.styles, 'style.less');
  source.typescript       = [
    path.join(folders.typescript,'audiobus/**/**.ts'),
    path.join(folders.typings ,'**/**.ts')
  ];

// These are all of the files by name...
const files = {};
  //files.index = path.resolve(folders.typescript,'index.ts');
  files.index = path.resolve(folders.code,'index.js');
  files.webpackConfig = path.resolve(folders.config,'webpack','webpack.config.js');
  files.tsConfig = path.resolve(folders.config,'typescript','tsconfig.json');
  files.template = path.resolve(folders.markup, 'template.pug');


// Where do the files ends up in the end?
const destination = function( folder )
{
  const output = {};
    output.root        = path.resolve(folder);
    output.midi        = path.resolve(folder,'assets/midi/[name].[ext]?[hash]-[name]');
    output.static      = path.resolve(folder);
    output.scripts     = path.resolve(folder,'assets/scripts/');
    output.style       = path.resolve(folder,'assets/style/[name].[ext]?[hash]-[name]');
    output.examples    = path.resolve(folder,'examples/');
  return output;
}

const destinations = {
    build           : destination( folders.build ),
    release         : destination( folders.release ),
    distribution    : destination( folders.distribution ),
    destination     : destination( folders.build ),
}


module.exports = {
  folders,
  files,
  source,
  destinations,
  server
}
