import Rules from './webpack.rules';
import Settings from '../settings';

// Libs
import webpack from 'webpack';
import HappyPack from 'happypack';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';


// https://github.com/jantimon/html-webpack-plugin
import HtmlWebpackPlugin from 'html-webpack-plugin';

// https://github.com/jantimon/resource-hints-webpack-plugin
import ResourceHintWebpackPlugin from 'resource-hints-webpack-plugin';

//
import ExtractTextPlugin from 'extract-text-webpack-plugin';

// https://github.com/lettertwo/appcache-webpack-plugin
// Offline usage for android and iOs
import AppCachePlugin from 'appcache-webpack-plugin';

// title: The title to use for the generated HTML document.
// filename: The file to write the HTML to. Defaults to index.html. You can specify a subdirectory here too (eg: assets/admin.html).
// template: Webpack require path to the template. Please see the docs for details.
// inject: true | 'head' | 'body' | false Inject all assets into the given template or templateContent - When passing true or 'body' all javascript resources will be placed at the bottom of the body element. 'head' will place the scripts in the head element.
// favicon: Adds the given favicon path to the output html.
// minify: {...} | false Pass html-minifier's options as object to minify the output.
// hash: true | false if true then append a unique webpack compilation hash to all included scripts and CSS files. This is useful for cache busting.
// cache: true | false if true (default) try to emit the file only if it was changed.
// showErrors: true | false if true (default) errors details will be written into the HTML page.
// chunks: Allows you to add only some chunks (e.g. only the unit-test chunk)
// chunksSortMode: Allows to control how chunks should be sorted before they are included to the html. Allowed values: 'none' | 'auto' | 'dependency' | {function} - default: 'auto'
// excludeChunks: Allows you to skip some chunks (e.g. don't add the unit-test chunk)
// xhtml: true | false If true render the link tags as self-closing, XHTML compliant. Default is false
// generates html from our templates :)
const html = new HtmlWebpackPlugin({
  title: 'audioBus',
  template:Settings.files.template,
  inject: 'body',
  hash: true,
    minify: {
    removeComments: true,
    collapseWhitespace: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeStyleLinkTypeAttributes: true,
    keepClosingSlash: true,
    minifyJS: true,
    minifyCSS: true,
    minifyURLs: true
  }
});

// https://github.com/jantimon/resource-hints-webpack-plugin
// https://www.w3.org/TR/resource-hints/
// It adds automatically resource-hints to your html files to improve your load time.
const resourceHint = new ResourceHintWebpackPlugin();


  // https://github.com/lettertwo/appcache-webpack-plugin
  // Offline usage for android and iOs
const appCache = new AppCachePlugin({
  cache: ['someOtherAsset.jpg'],
  network: null,  // No network access allowed!
  fallback: ['failwhale.jpg'],
  settings: ['prefer-online'],
  exclude: ['file.txt', /.*\.js$/],  // Exclude file.txt and all .js files
  output: 'audiobus.appcache'
});


// speed up builds
const forkTsChecker = new ForkTsCheckerWebpackPlugin();

// CommonChunksPlugin will now extract all the common modules from main bundles
const chunksCommon = 
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
       //But since there are no more common modules between them we end up with just the runtime code included in the manifest file
       filename: 'common.js'
  });

// PLUGINS -----------------------------------------------------------------
const plugins = [

  // multi thread ts
  // new HappyPack({
  //     id: 'ts',
  //     threads: 2,
  //     loaders: [
  //         {
  //             path: 'ts-loader',
  //             query: { happyPackMode: true }  ,
  //             options: { configFileName :path.resolve(__dirname,'../typescript','tsconfig.json') }
  //         }
  //     ]
  // }),


  // // Reduces bundles total size by renaming variables and mashing up the code
  // // new webpack.optimize.UglifyJsPlugin({
  // // https://webpack.js.org/plugins/uglifyjs-webpack-plugin/
  // new webpack.optimize.UglifyJsPlugin({
  //   compress: false,
  //   beautify: true,
  //   sourceMap: true,
  //   exclude: [/vendor/, /node_modules/, /bower_components/ ],
  //   mangle: {
  //     // You can specify all variables that should not be mangled.
  //     // For example if your vendor dependency doesn't use modules
  //     // and relies on global variables.
  //     except: ['$super', '$', 'exports', 'require', 'angular','react']
  //   }
  // })


  ,

  // https://webpack.js.org/guides/code-splitting/
  // https://webpack.github.io/docs/code-splitting.html
  // https://webpack.js.org/plugins/commons-chunk-plugin/
  // Automatically move all modules defined outside of application directory to vendor bundle.
  // If you are using more complicated project structure, consider to specify common chunks manually.
  new webpack.optimize.CommonsChunkPlugin({
    // The chunk name of the commons chunk. An existing chunk can be selected by passing a name of an existing chunk.
    // If an array of strings is passed this is equal to invoking the plugin multiple times for each chunk name.
    // If omitted and `options.async` or `options.children` is set all chunks are used,
    // otherwise `options.filename` is used as chunk name.
    name: 'vendor',
    // async: true,
    filename: 'vendor.[chunkhash].js',
    // between how many scripts must there be commonality?
    minChunks: function (module, count) {
      // this assumes your vendor imports exist in the node_modules directory
      return module.context && module.context.indexOf('node_modules') !== -1;
      //return module.resource && module.resource.indexOf( Paths.folderNames.routes ) === -1;
    }
    // minChunks: Infinity
  }),



  // This is the extract text plugin instance for styles..

];

module.exports = {
  appCache,
  forkTsChecker,
  html,
  resourceHint,
  styles:Rules.stylesPlugin,
  less:Rules.lessPlugin,
  chunksCommon
}
