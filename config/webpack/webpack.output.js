import path from 'path';
import Settings from '../settings';

// where to compile to...
const destination = Settings.destinations.build;

// https://webpack.js.org/configuration/output/
const output = {
   // [hash] - The hash of the module identifier
   // [chunkhash] - The hash of the chunk content
   // [name] - The module name
   // [id] - The module identifier
   // [file] - The module filename
   // [filebase] - The module basename
   // [query] - The module query, i.e., the string following ? in the filename
   //
   // The lengths of [hash] and [chunkhash] can be specified using [hash:16] (defaults to 20).
   // Alternatively, specify output.hashDigestLength to configure the length globally.
   // Note this option is called filename but you are still allowed to something
   // like "js/[name]/bundle.js" to create a folder structure.
   //filename: path.join('assets','scripts','[name].[hash:8].js'),
   filename: destination.scripts,

   //  chunkFilename: '[chunkhash].js',
   chunkFilename: '[name].js?[chunkhash]',
   // chunkFilename: "[id].js",
   // chunkFilename: "[chunkhash].js", // for long term caching
   // the filename template for additional chunks

  // The output directory as an absolute path.
  // eg. path: path.resolve(__dirname, 'dist/assets')
  // Note that [hash] in this parameter will be replaced with an hash of the compilation.
  // See the Caching guide for details.
  path: path.resolve(destination.root, 'test'),
  //path.resolve(destination.root),

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
}

module.exports = output;
