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

const destination = Settings.destinations.build;

// Add them together
const rules = [
  Rules.typescript,
  Rules.javascript,
  Rules.html,
  Rules.pug,
  Rules.fonts,
  Rules.images,
  //Rules.styles,
  Rules.less,
  Rules.videos,
  Rules.midi
];

// Add them together
const plugins = [
  //Plugins.appCache,
  //Plugins.forkTsChecker,
  Plugins.html,
  //Plugins.resourceHint,
  //Plugins.styles,
  Plugins.chunksCommon,
  Rules.stylePlugin,
  //Rules.extractHTML
];

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
  context: Settings.folders.root, // to automatically find tsconfig.json

  // entry point(s)...
  entry: Entry,

  // where to compile to
  output: {
      filename: '[name].js',
      chunkFilename: '[chunkhash].js',
      path: destination.root,

      // library: "MyLibrary", // string,
      // the name of the exported library
      //
      // libraryTarget: "umd", // universal module definition
      //     libraryTarget: "umd2", // universal module definition
      //     libraryTarget: "commonjs2", // exported with module.exports
      //     libraryTarget: "commonjs-module", // exports with module.exports
      //     libraryTarget: "commonjs", // exported as properties to exports
      //     libraryTarget: "amd", // defined with AMD defined method
      //     libraryTarget: "this", // property set on this
      // DEFAULT :
      //libraryTarget: "var", // variable defined in root scope
      //     libraryTarget: "assign", // blind assignment
      //     libraryTarget: "window", // property set to window object
      //     libraryTarget: "global", // property set to global object
      //     libraryTarget: "jsonp", // jsonp wrapper
      // the type of the exported library
      //
      // Advanced output configuration ------------------------------------------
      // show comments in bundles, just to beautify the output of this example.
      // should not be used for production
      // pathinfo: true, // boolean
      // include useful path info about modules, exports, requests, etc. into the generated code
      //
      // chunkFilename: "[id].js",
      // chunkFilename: "[chunkhash].js", // for long term caching
      // the filename template for additional chunks
      //
      // jsonpFunction: "myWebpackJsonp", // string
      // name of the JSONP function used to load chunks
      //
      // sourceMapFilename: "[file].map", // string
      // sourceMapFilename: "sourcemaps/[file].map", // string
      // the filename template of the source map location
      //
      // devtoolModuleFilenameTemplate: "webpack:///[resource-path]", // string
      // the name template for modules in a devtool
      //
      // devtoolFallbackModuleFilenameTemplate: "webpack:///[resource-path]?[hash]", // string
      // the name template for modules in a devtool (used for conflicts)
      //
      // umdNamedDefine: true, // boolean
      // use a named AMD module in UMD library
      //
      // crossOriginLoading: "use-credentials", // enum
      // crossOriginLoading: "anonymous",
      // crossOriginLoading: false,
      // specifies how cross origin request are issued by the runtime

      // the url to the output directory resolved relative to the HTML page
      // publicPath: "/assets/", // string
      // publicPath: "http://cdn.example.com/[hash]/",
      publicPath:'/'
  },

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
    extensions: ['.ts', '.tsx', '.js', '.jsx']
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
