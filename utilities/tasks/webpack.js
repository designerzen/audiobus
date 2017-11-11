// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import gulp             from 'gulp';
import gutil            from 'gulp-util';
import path             from 'path';
import webpack          from 'webpack';
import fs               from 'fs';

const colorsSupported = true;

// Save any string data to the filename specified in logs
const saveLog = function( filename, data )
{
  const prettify = require('js-beautify').js_beautify;

  // now save this out to disc as a log file...
  // create a local dir to save these issues
  if ( !fs.existsSync(Paths.folderPaths.logs) )
  {
    fs.mkdirSync( Paths.folderPaths.logs );
  }
  const logName = path.join( Paths.folderPaths.logs, filename+".log" );
  gutil.log( gutil.colors.red("[LOG:Saving]"), logName );

  const json = JSON.stringify( data );
  const stringified = prettify(json, { indent_size: 2 });

  //gutil.log( gutil.colors.red("[COMPILE:DEBUG]"), data );

  fs.writeFileSync( logName, stringified, {encoding:'utf8'} );
};

////////////////////////////////////////////////////////////////////////////////
// TASK : Run the test server and ensure that the files are valid and good
// uses webpack.config.dev.js to build modules TO DISK
////////////////////////////////////////////////////////////////////////////////
gulp.task('webpack:debug', (cb) => {

  // builds using webpack...
  const configPath = Settings.files.webpackConfig;

  const webpackConfig = require( configPath );

  console.log(configPath);
  console.log(webpackConfig);

  webpack(webpackConfig, (err, stats) => {

      if(err)
      {
        gutil.error( gutil.colors.red("[COMPILATION:FAILED]") )
        throw new gutil.PluginError("webpack", err);
      }

      gutil.log( gutil.colors.red("[COMPILED]"), stats.toString({
        // Add asset Information
        assets: true,
        // Sort assets by a field
        assetsSort: "field",
        // Add information about cached (not built) modules
        cached: true,
        // Add children information
        children: false,
        // Add chunk information (setting this to `false` allows for a less verbose output)
        chunks: false,
        // Add built modules information to chunk information
        //chunkModules: true,
        // Add the origins of chunks and chunk merging info
        //chunkOrigins: true,
        // Sort the chunks by a field
        //chunksSort: "field",
        // Context directory for request shortening
        //context: "../src/",
        // `webpack --colors` equivalent
        colors: colorsSupported,
        // Add errors
        errors: true,
        // Add details to errors (like resolving log)
        errorDetails: false,
        // Add the hash of the compilation
        hash: false,
        // Add built modules information
        modules: false,
        // Sort the modules by a field
        modulesSort: "field",
        // Add public path information
        publicPath: true,
        // Add information about the reasons why modules are included
        reasons: true,
        // Add the source code of modules
        source: false,
        // Add timing information
        timings: false,
        // Add webpack version information
        version: false,
        // Add warnings
        warnings: false
      }));

      gutil.log( gutil.colors.red("[DEBUGGING]"), gutil.colors.grey("From"), "source", gutil.colors.grey("to"), '...' );
      //console.log( cb );

      // we will never want the callback to be called as this is an infinite task
      //cb();
    });

    cb();
});

////////////////////////////////////////////////////////////////////////////////
// use webpack.config.dist.js to build modules into dist
////////////////////////////////////////////////////////////////////////////////
gulp.task('webpack:compile', (cb) => {

  // builds using webpack...
  const configPath = Settings.files.webpackConfig;
  const webpackConfig = require( configPath );

  //gutil.log( gutil.colors.red("[COMPILING]"), gutil.colors.grey("assets") + " using config", configPath );
  //gutil.log( gutil.colors.red("[COMPILING]"), gutil.colors.grey("Config") + " using config", JSON.stringify(webpackConfig, null, 4) );
  console.dir(JSON.stringify(webpackConfig, {colors:true}) );

  //gutil.log( gutil.colors.grey("From"), config, gutil.colors.grey("to"), paths.entry );

  // run webpack--optimize-minimize
  webpack(webpackConfig, (err, stats) => {

    if(err)  {
      throw new gutil.PluginError("webpack", err);
    }

    gutil.log( gutil.colors.red("[COMPILED]"), stats.toString({
      // Add asset Information
      assets: true,
      // Sort assets by a field
      assetsSort: "field",
      // Add information about cached (not built) modules
      cached: true,
      // Add children information
      children: true,
      // Add chunk information (setting this to `false` allows for a less verbose output)
      chunks: false,
      // Add built modules information to chunk information
      //chunkModules: true,
      // Add the origins of chunks and chunk merging info
      //chunkOrigins: true,
      // Sort the chunks by a field
      //chunksSort: "field",
      // Context directory for request shortening
      //context: "../src/",
      // `webpack --colors` equivalent
      colors: colorsSupported,
      // Add errors
      errors: true,
      // Add details to errors (like resolving log)
      errorDetails: true,
      // Add the hash of the compilation
      hash: true,
      // Add built modules information
      modules: true,
      // Sort the modules by a field
      modulesSort: "field",
      // Add public path information
      publicPath: true,
      // Add information about the reasons why modules are included
      reasons: true,
      // Add the source code of modules
      source: true,
      // Add timing information
      timings: true,
      // Add webpack version information
      version: true,
      // Add warnings
      warnings: true
    }));

    gutil.log( gutil.colors.red("[COMPILE]"), gutil.colors.grey("From"), "source", gutil.colors.grey("to"), '...' );
    //console.log( cb );
    cb();
  });
});



// Just a handy way of logging out the config files
gulp.task('compile:debug', (cb) => {
  // load in the config file and save it to root...
  const configName = Paths.fileNames.configDist;
  const configPath = Paths.filePaths.configDist;
  const webpackConfig = require( configPath );

  saveLog( configName, webpackConfig);
  cb();
});

// Just a handy way of logging out the config files
gulp.task('compile:parent', (cb) => {
  // load in the config file and save it to root...
  const configName = Paths.fileNames.configParent;
  const configPath = Paths.filePaths.configParent;
  const webpackConfig = require( configPath );

  saveLog( configName, webpackConfig);
  cb();
});
