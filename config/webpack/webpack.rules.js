import path from 'path';
import Settings from '../settings';
import Plugins from './webpack.plugins';

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
    // Allows you to specify where to find the TypeScript configuration file.
    // You may provide :
    //  just a file name. The loader then will search for the config file of each entry point in the respective entry point's containing folder. If a config file cannot be found there, it will travel up the parent directory chain and look for the config file in those folders.
    // - a relative path to the configuration file. It will be resolved relative to the respective .ts entry file.
    // - an absolute path to the configuration file.
    configFile :'tsconfig.json',
    // If you want to speed up compilation significantly you can set this flag. However, many of the benefits you get from static type checking between different dependencies in your application will be lost.
    // It's advisable to use transpileOnly alongside the fork-ts-checker-webpack-plugin to get full type checking again. To see what this looks like in practice then either take a look at our simple example. For a more complex setup take a look at our more involved example.
    transpileOnly: false,
    // If you're using HappyPack or thread-loader to parallise your builds then you'll need to set this to true. This implicitly sets *transpileOnly* to true and WARNING! stops registering all errors to webpack.
    happyPackMode:false,

    //Can be info, warn or error which limits the log output to the specified log level. Beware of the fact that errors are written to stderr and everything else is written to stderr (or stdout if logInfoToStdOut is true).
    logLevel:"warn",

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
const ruleStylesExtracted = {
  test: /\.css$/,
  exclude: [/node_modules/, /bower_components/, /\.spec\./ ],
  use: Plugins.extractStyles.extract({
      fallback: 'style-loader',
      use: [
        //{ loader: 'raw-loader' },
        // TODO :SET MODULES TO TRUE
        { loader: 'css-loader', query: { modules: false, sourceMaps: useSourceMaps, importLoaders:2, localIdentName:'[name]__[local]___[hash:base64:5]' } },
        { loader: 'postcss-loader' }
      ]
  })
};
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
  use: Plugins.extractStyles.extract({
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

// Markup...



const ruleHTML = {
  test: /\.(html)$/,
  use:[
    {
      loader: 'file-loader?name='+destination.root
    },
    {
      loader: 'html-loader',
      options: {
        minimize: true,
        removeComments: false,
        collapseWhitespace: false
      }
    }

  ]
};


const ruleHTMLExtracted = {
  test: /\.(html)$/,
  use: Plugins.extractHTML.extract({
      fallback: 'file-loader',

      use: [
        {
          loader: 'html-loader',
          options: {
            minimize: true,
            removeComments: false,
            collapseWhitespace: false
          }
        }
      ]

  })

};

const rulePug = {
  test: /\.(pug|jade)$/,
  use:[
    // {
    //   loader: 'file-loader?name='+destination.root
    // },
    // {
    //   loader: 'html-loader',
    //   options: {
    //     minimize: true,
    //     removeComments: false,
    //     collapseWhitespace: false
    //   }
    // },
    {
      loader: 'pug-loader'
    }
  ]

};
const rulePugExtracted = {
  test: /\.(pug|jade)$/,
  use: Plugins.extractHTML.extract({
      fallback: 'file-loader',

      use: [
        {
          loader: 'html-loader',
          options: {
            minimize: true,
            removeComments: false,
            collapseWhitespace: false
          }
        },

        {
          loader: 'pug-loader'
        }
      ]

  })

};


/*

    [ext] the extension of the resource
    [name] the basename of the resource
    [path] the path of the resource relative to the context query parameter or option.
    [hash] the hash of the content, hex-encoded md5 by default
    [<hashType>:hash:<digestType>:<length>] optionally you can configure
        other hashTypes, i. e. sha1, md5, sha256, sha512
        other digestTypes, i. e. hex, base26, base32, base36, base49, base52, base58, base62, base64
        and length the length in chars
    [N] the N-th match obtained from matching the current file name against the query param regExp

*/

// Images...
const ruleImages = {
  test: /\.(png|svg|jpeg|jpg|gif|webp)$/,
  //include: [ Settings.folders.images ],
  exclude: [ Settings.folders.fonts ],
  // [sha512:hash:base64:7].[ext]
  //loader: 'file-loader?name=[path][name].[ext]'//+destination.images
  loader: 'file-loader?name='+destination.images
};

const ruleVideos = {
  test: /\.(mp4|webm)(\?.*)?$/,
  loader: 'file-loader?name=[path][name].[ext]'//+destination.videos
};
const ruleMidi = {
  test: /\.(midi|mid)$/,
  loader: 'file-loader?name=[path][name].[ext]'//+destination.midi
};

module.exports = {
  typescript:ruleTypeScript,
  javascript:ruleJavaScript,
  html:ruleHTML,
  htmlExtracted:ruleHTMLExtracted,
  pugExtracted:rulePugExtracted,
  pug:rulePug,
  fonts:ruleFonts,
  styles:ruleStyles,
  //styles:ruleStylesExtracted,
  less:ruleLESSExtracted,
  //less:ruleLESS,
  images:ruleImages,
  videos:ruleVideos,
  midi:ruleMidi
}
