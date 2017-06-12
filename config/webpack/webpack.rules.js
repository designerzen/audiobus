import path from 'path';
import Settings from '../settings';

// https://github.com/webpack-contrib/extract-text-webpack-plugin
import ExtractTextPlugin from 'extract-text-webpack-plugin';

const destination = Settings.destinations.build;
const useSourceMaps = true;

// RULES -------------------------------------------------------------------
const ruleTypeScriptHappyPack = {
  test: /\.(tsx|ts)?$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  loader: 'happypack/loader?id=ts'
};
const ruleTypeScript = {
  test: /\.(tsx|ts)?$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  loader: 'ts-loader',
  options:{
    configFileName :'tsconfig.json'
  }
};

console.log(ruleTypeScript);

const ruleJavaScript = {
  test: /\.js$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  use: [
    {
      loader: 'babel-loader?minified=false&comments=true'
    }
  ]
};


// FONTS ===============================================================

/*
// FIXME : Not working for the MBIcon font
// Base64 Integrated fonts (prevents one file request - only used on small files)
// Font Definitions inline (become base64 encoded and inline the stylesheet)...
{ test: /\.svg$/, include: [ Paths.folderPaths.fonts ], loader: 'url-loader?limit='+Config.limits.fonts+'&mimetype=image/svg+xml&name=assets/fonts/[name].[ext]' },
{ test: /\.woff$/, include: [ Paths.folderPaths.fonts ], loader: 'url-loader?limit='+Config.limits.fonts+'&mimetype=application/font-woff&name=assets/fonts/[name].[ext]' },
{ test: /\.woff2$/, include: [ Paths.folderPaths.fonts ], loader: 'url-loader?limit='+Config.limits.fonts+'&mimetype=application/font-woff2&name=assets/fonts/[name].[ext]' },
{ test: /\.[ot]tf$/, include: [ Paths.folderPaths.fonts ], loader: 'url-loader?limit='+Config.limits.fonts+'&mimetype=application/octet-stream&name=assets/fonts/[name].[ext]' },
{ test: /\.eot$/, include: [ Paths.folderPaths.fonts ], loader: 'url-loader?limit='+Config.limits.fonts+'&mimetype=application/vnd.ms-fontobject&name=assets/fonts/[name].[ext]' },
*/

// Fonts as files...
const ruleFonts = {
  test: /\.(eot|svg|ttf|otf|woff|woff2)$/,
  include: [ Settings.folders.fonts ],
  exclude: [ Settings.folders.images ],
  //loader: 'file-loader?name='+Paths.destination.fonts
  loader: 'file-loader?name='+destination.fonts
};


// Extract Text Plugin
// https://github.com/webpack-contrib/extract-text-webpack-plugin
const extractStyles = new ExtractTextPlugin({
  filename: path.resolve(destination.style, '[name].css'),
  disable: false,
  allChunks: true,
  ignoreOrder:false
});

const ruleStyles = {
  test: /\.css$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  use : [
    { loader: 'style-loader'},
    { loader: 'css-loader', options: { modules: false, sourceMaps: false, importLoaders:2, localIdentName:'[name]__[local]___[hash:base64:5]' } },
    { loader: 'postcss-loader' }
  ]
};
//
// const ruleStylesExtracted = {
//   test: /\.css$/,
//   exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
//   use: extractStyles.extract({
//       fallback: 'style-loader',
//       use: [
//         //{ loader: 'raw-loader' },
//         // TODO :SET MODULES TO TRUE
//         { loader: 'css-loader', query: { modules: false, sourceMaps: useSourceMaps, importLoaders:2, localIdentName:'[name]__[local]___[hash:base64:5]' } },
//         { loader: 'postcss-loader' }
//       ]
//   })
// };
const ruleLESS = {
  test: /\.less$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  use : [
    { loader: 'style-loader'},
    { loader: 'css-loader', options: { modules: false, sourceMaps: false, importLoaders:2, localIdentName:'[name]__[local]___[hash:base64:5]' } },
    { loader: 'postcss-loader' },
    { loader: 'less-loader', query: { sourceMaps: useSourceMaps } }
  ]
};


const ruleLESSExtracted = {
  test: /\.less$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  use: extractStyles.extract({
      fallback: 'style-loader',
      use: [
        //{ loader: 'raw-loader' },
        // TODO :SET MODULES TO TRUE
        { loader: 'css-loader', query: { modules: false, sourceMaps: useSourceMaps, importLoaders:2, localIdentName:'[name]__[local]___[hash:base64:5]' } },
        { loader: 'postcss-loader' },
        { loader: 'less-loader', query: { sourceMaps: useSourceMaps } }
      ]
  })
};

// Images...
const ruleImages = {
  test: /\.(png|svg|jpeg|jpg|gif|webp)$/,
  include: [ Settings.folders.images ],
  exclude: [ Settings.folders.fonts ],
  // [sha512:hash:base64:7].[ext]
  loader: 'file-loader?name='+destination.images
};

const ruleVideos = {
  test: /\.(mp4|webm)(\?.*)?$/,
  loader: 'file-loader?name='+destination.videos
};
const ruleMidi = {
  test: /\.(midi|mid)$/,
  loader: 'file-loader?name='+destination.midi
};

module.exports = {
  typescript:ruleTypeScript,
  javascript:ruleJavaScript,
  fonts:ruleFonts,
  styles:ruleStyles,
  //less:ruleLESSExtracted,
  less:ruleLESS,
  stylePlugin:extractStyles,
  images:ruleImages,
  videos:ruleVideos,
  midi:ruleMidi
}
