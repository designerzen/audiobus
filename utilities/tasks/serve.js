'use strict';

// Config
import Package          from '../../package';
import Settings         from '../../config/settings';

// Dependencies
import fs               from 'fs';
import gulp             from 'gulp';
import gutil            from 'gulp-util';
import path             from 'path';
import webpack          from 'webpack';

// Server and middleware for HMR
import serve                from 'browser-sync';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import historyApiFallback   from 'connect-history-api-fallback';


////////////////////////////////////////////////////////////////////////////////
// TASK : Run the test server and ensure that the files are valid and good
// uses webpack.config.dev.js to build modules into memory
////////////////////////////////////////////////////////////////////////////////
gulp.task('serve', () => {

  const configPath = Settings.files.webpackConfig;

  const webpackConfig = require( configPath );

  //gutil.log( gutil.colors.red("[SERVE]"), gutil.colors.grey("Webpacking debug") + " using config ", configPath, "config", webpackConfig );
  gutil.log( gutil.colors.red("[SERVE]"), gutil.colors.grey("Webpacking debug") + " using config ", configPath );
  gutil.log( webpackConfig);
  gutil.log( gutil.colors.red("[COMPILING]"), gutil.colors.grey("to"), webpackConfig.output.publicPath );

  //gutil.log( Paths.destination );
  //gutil.log( gutil.colors.grey("Webserver packing assets from",files.webpackDev, paths.root, config) );

  const compiler = webpack(webpackConfig);

  serve({
    port: process.env.PORT || Settings.server.port,
    open: false,
    server: {
      baseDir: Settings.folders.build
    },
    middleware: [
      historyApiFallback(),
      webpackDevMiddleware(compiler, {
        stats: {
          colors: true,
          chunks: false,
          modules: false
        },
        publicPath: webpackConfig.output.publicPath
      }),
      webpackHotMiddleware(compiler)
    ]
  });

});
