/* /////////////////////////////////////////////////////////////////////////////

CONFIG :

  This is the webpack configuration file that is used to decide how the app
  compiles and builds. You shouldn't have to touch any of the things in here
  but feel free to change the configuration variables to match your env.

  https://webpack.js.org/configuration/
  https://webpack.js.org/configuration/devtool/
  http://webpack.github.io/docs/configuration.html

  Filename config: ____________________________________________________________

  [file][filebase][id][chunkhash][name][hash][ext]

  [hash]       The hash of the module identifier
  [chunkhash]  The hash of the chunk content
  [name]       The module name
  [id]         The module identifier
  [file]       The module filename
  [filebase]   The module basename
  [query]      The module query, i.e., the string following ? in the filename

///////////////////////////////////////////////////////////////////////////// */
import Settings from '../settings';
import Rules from './webpack.rules';
import Plugins from './webpack.plugins';
import Entry from './webpack.entry';
import Output from './webpack.output';


console.log( Output );

// Add them together
const rules = [
  Rules.typescript,
  Rules.javascript,
  Rules.htmlExtracted,
  Rules.pug,
  Rules.pugExtracted,
  Rules.fonts,
  Rules.images,
  //Rules.styles,
  Rules.less,
  Rules.videos,
  Rules.midi
];

// Add them together
let plugins = [
  //Plugins.appCache,
  //Plugins.forkTsChecker,
  //Plugins.html,
  //Plugins.resourceHint,
  //Plugins.styles,
  Plugins.chunksCommon,
  Plugins.extractStyles,
  Plugins.extractHTML
];

// merge both...
plugins = plugins.concat( Plugins.markup );
// plugins.push( Plugins.markup[0] );
console.log(Plugins.markup[0] );
// plugins.push( Plugins.markup[1] );
console.log(Plugins.markup[1] );
console.log('******************************');
// WEBPACK -----------------------------------------------------------------
const config = {

  // watch for changes and update if detected
  watch : false,

  // disable/enable caching
  cache: false,

  // For development _________________________________________________________________
  // eval - Each module is executed with eval() and //@ sourceURL. This is pretty fast. The main disadvantage is that it doesn't display line numbers correctly since it gets mapped to transpiled code instead of the original code.
  // inline-source-map - A SourceMap is added as a DataUrl to the bundle.
  // eval-source-map - Each module is executed with eval() and a SourceMap is added as a DataUrl to the eval(). Initially it is slow, but it provides fast rebuild speed and yields real files. Line numbers are correctly mapped since it gets mapped to the original code.
  // cheap-module-eval-source-map - Like eval-source-map, each module is executed with eval() and a SourceMap is added as a DataUrl to the eval(). It is "cheap" because it doesn't have column mappings, it only maps line numbers.
  //
  // For production __________________________________________________________________
  // source-map - A full SourceMap is emitted as a separate file. It adds a reference comment to the bundle so development tools know where to find it.
  // hidden-source-map - Same as source-map, but doesn't add a reference comment to the bundle. Useful if you only want SourceMaps to map error stack traces from error reports, but don't want to expose your SourceMap for the browser development tools.
  // cheap-source-map - A SourceMap without column-mappings ignoring loaded Source Maps.
  // cheap-module-source-map - A SourceMap without column-mappings that simplifies loaded Source Maps to a single mapping per line.
  // nosources-source-map - A SourceMap is created without the sourcesContent in it. It can be used to map stack traces on the client without exposing all of the source code.

  // https://webpack.js.org/configuration/devtool/
  devtool: 'source-map',

  // the environment in which the bundle should run
  // changes chunk loading behavior and available modules
  target:'web',

  // an absolute path, for resolving entry points and loaders from configuration
  //context: Settings.folders.root, // to automatically find tsconfig.json
  context: Settings.folders.source, // to automatically resolve using relative paths

  // entry point(s)...
  entry: Entry,

  // where to compile to...
  // https://webpack.js.org/configuration/output/
  output: Output,

  module: {
    // rules for including assets
    rules: rules
  },

  // plugins to modify outputs
  plugins: plugins,

  // how to deal with files
  resolve: {
    // force extensions
    enforceExtension: false,
    // allow webpack to import files without suffixes
    extensions: ['.ts', '.tsx', '.js', '.jsx','less','mid'],
    // https://decembersoft.com/posts/say-goodbye-to-relative-paths-in-typescript-imports/
    alias: {
      styles:Settings.folders.styles,
      markup:Settings.folders.markup,
      midi:Settings.folders.midi,
      images:Settings.folders.images,
      fonts:Settings.folders.fonts,
      assets:Settings.folders.assets,
      audiobus:Settings.folders.audiobus
    }
  },

  // Statistics to display
  // lets you precisely control what bundle information gets displayed
  stats: {
    //assets: true,
    colors: true,
    //errors: true,
    //errorDetails: true,
    //hash: true
  },
};

module.exports = config;
