
var path = require('path');
var fs = require('fs');
//var zlib = require('zlib');
// Webpack + Plugins
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const { CheckerPlugin } = require('awesome-typescript-loader');
const nodeExternals = require('webpack-node-externals');

/**
 * Damit aus der command line Parameter uebergeben werde koennen, muss der export als function
 * aufgebaut werden. Die function liefert das config.Object zurueck.
 *
 * Der Funktions-Parameter "env" enthaelt alle per --env.par="blah" definierten Variablen.
 * z.B.:
 * ... --env.release --env.test1="blah"
 * -> env = { release: true, test1: "blah" }
 *
 */
module.exports = function(env) {

  env = env || {};
  var release = env.release || false;
  var SPK = env.spk || false;  // build f. SPK-Umgebung

  var ENV = process.env.NODE_ENV = process.env.ENV = release ? 'production' : 'development';

// Pfade/Dateinamen
  var libName = "lib-server";

  var cwd = process.cwd();
  var npmRoot = cwd + "/node_modules";
  var sourceDir = cwd + "/src";
  var filesTarget = 'resource'; // targetDir + "/resource"; -> copy-webpack-plugin (s.u.)
  var filesDir = sourceDir + '/' + filesTarget;
  var bootstrapFile = sourceDir + '/index.ts';
  var sonstDir = cwd + "/div";
  var targetDir = cwd + "/dist";
  var packageFile = cwd + '/package.json';

// package.json holen und buildnumber setzen
  var PACKAGE = getPackage(packageFile, ENV);

// index.html-metadata & app-var metadata
  var builddate = new Date().toLocaleString();
  var metadata = {
    'VERSIONSTR': PACKAGE.name + ' ' + PACKAGE.version + ' (build ' + PACKAGE.buildnumber + '/ ' + builddate + ' ' + ENV + ')',
    'NAME'      : PACKAGE.name,
    'VERSION'   : PACKAGE.version,
    'BUILD'     : PACKAGE.buildnumber,
    'DESC'      : PACKAGE.description,
    'COPY'      : PACKAGE.copyright,
    'ENV'       : ENV,
    'NODE_ENV'  : ENV,
//    'CONFIG'    : require(configFile),
//    'CONFIGFILE': appConfigFile,
  };
//TODO package.json f. NW.js generieren
//     f. nw muss auch baseurl angepasst werden

  /*
   * Webpack configuration
   *
   * See: http://webpack.github.io/docs/configuration.html#cli
   */
  return {

    // for faster builds use 'eval'
    devtool: release ? 'source-map' : 'cheap-module-eval-source-map',
    // target : 'web',  // alt.: node || node-webkit -> BaseUrl!!

    /*
     * The entry point for the bundle
     * Our Angular.js app
     *
     * See: http://webpack.github.io/docs/configuration.html#entry
     */
    entry: bootstrapFile,

    externals: [nodeExternals()], // in order to ignore all modules in node_modules folder

    /**
     * Options affecting the output of the compilation.
     *
     * See: http://webpack.github.io/docs/configuration.html#output
     */
    output: {
      /**
       * The output directory as absolute path (required).
       *
       * See: http://webpack.github.io/docs/configuration.html#output-path
       */
      path             : targetDir,
      publicPath       : metadata.BASEURL,
      /**
       * Specifies the name of each output file on disk.
       * IMPORTANT: You must not specify an absolute path here!
       *
       * See: http://webpack.github.io/docs/configuration.html#output-filename
       */
      filename         : libName + '.js',
      /**
       * The filename of the SourceMaps for the JavaScript files.
       * They are inside the output.path directory.
       *
       * See: http://webpack.github.io/docs/configuration.html#output-sourcemapfilename
       */
      sourceMapFilename: '[file].map',  // [file] enthaelt .js|.css dadurch verschiedene mapS f. js und css

      library: libName,
      libraryTarget: "umd",
      umdNamedDefine: true,
    },

    /*
     * Options affecting the resolving of modules.
     *
     * See: http://webpack.github.io/docs/configuration.html#resolve
     */
    resolve      : {
      // remove other default values
      // modulesDirectories: ['node_modules'],
      /*
       * An array of extensions that should be used to resolve modules.
       *
       * See: http://webpack.github.io/docs/configuration.html#resolve-extensions
       */
      extensions: ['.ts', '.js', '.json', '.css', '.html', 'png', 'jpg', 'gif', 'scss', 'svg', 'woff', 'ttf', 'eot', 'otf', 'svg'],

      // An array of directory names to be resolved to the current directory (absolute path!)
      modules: [ npmRoot ],

    },

    /*
     * Options affecting the normal modules.
     *
     * See: http://webpack.github.io/docs/configuration.html#module
     */
    module: {

      /*
       * An array of automatically applied loaders.
       *
       * IMPORTANT: The loaders here are resolved relative to the resource which they are applied to.
       * This means they are not resolved relative to the configuration file.
       *
       * See: http://webpack.github.io/docs/configuration.html#module-loaders
       */
      loaders: [

        /*
         * Typescript loader support for .ts and Angular 2 async routes via .async.ts
         *
         * See: https://github.com/s-panferov/awesome-typescript-loader
         */
        {
          test   : /\.ts$/,
          loaders: [
            // falls Fehlermeldungen stoeren sollten...
            // 'awesome-typescript-loader?{ignoreDiagnostics:[2688]}',
            'awesome-typescript-loader',
            'angular2-template-loader'
          ],
          exclude: [/\.(spec|e2e)\.ts$/]
        },

        {
          test  : /\.(png|jpg|gif)$/,
          loader: "url-loader?limit=50000&name=[path][name].[ext]"
        },

        /*
         * Json loader support for *.json files.
         *
         * See: https://github.com/webpack/json-loader
         */
        {
          test  : /\.json$/,
          loader: 'json-loader'
        },

        {
          test  : /^(?!.*\.min\.css$).*\.css$/,
          // loaders: ["style-loader", "css-loader"]
          loader: ExtractTextPlugin.extract({
                                              fallbackLoader: "style-loader",
                                              loader        : "css-loader?sourceMap"
                                            })
        },

        {
          test   : /\.scss$/,
          loaders: ['style-loader',
            ExtractTextPlugin.extract({
                                        fallbackLoader: "style-loader",
                                        loader        : "css-loader?sourceMap"
                                      }),
            'sass-loader' + '?outputStyle=expanded' + '&' + 'root=' + sourceDir
            + '&' + 'includePaths[]' + npmRoot + '&' + 'includePaths[]' + sourceDir
          ]
        },

        /* Raw loader support for *.html
         * Returns file content as string
         *
         * See: https://github.com/webpack/raw-loader
         */
        {
          test   : /\.html$/,
          loader : 'raw-loader',
        },

        // w/ font awesome-loader + bootstrap-loader
        {
          test  : /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          loader: "url-loader?limit=10000&minetype=application/font-woff"
        },

        {
          test  : /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          loader: "file-loader"
        }

      ],

      noParse: [
        sonstDir,
        /\.min\.js/,
        npmRoot + '/zone.js/dist',
      ]
    },

    /*
     * Add additional plugins to the compiler.
     *
     * See: http://webpack.github.io/docs/configuration.html#plugins
     */
    plugins: [
      /*
       * Plugin: ForkCheckerPlugin
       * Description: Do type checking in a separate process, so webpack don't need to wait.
       *
       * See: https://github.com/s-panferov/awesome-typescript-loader#forkchecker-boolean-defaultfalse
       */
      new CheckerPlugin(),

      /*
       * Plugin: CopyWebpackPlugin
       * Description: Copy files and directories in webpack.
       *
       * Copies project static assets.
       *
       * See: https://www.npmjs.com/package/copy-webpack-plugin
       */
      // new CopyWebpackPlugin([
      //   {
      //     from  : filesDir,  // + text files etc.
      //     to    : filesTarget,
      //     toType: 'dir'
      //   },
      // ]),

      /*
       * Plugin: ExtractTextPlugin
       * Description: It moves every require("style.css") in entry chunks into a separate css output file.
       * So your styles are no longer inlined into the javascript, but separate in a css bundle file (styles.css).
       * If your total stylesheet volume is big, it will be faster because the stylesheet bundle is loaded in
       * parallel to the javascript bundle.
       *
       * See: https://github.com/webpack/extract-text-webpack-plugin
       */
      new ExtractTextPlugin("[name].css"),

      /**
       * Plugin: DefinePlugin
       * Description: Define free variables.
       * Useful for having development builds with debug logging or adding global constants.
       *
       * Environment helpers
       *
       * See: https://webpack.github.io/docs/list-of-plugins.html#defineplugin
       */
      // NOTE: when adding more properties make sure you include them in custom-typings.d.ts
      new webpack.DefinePlugin({
        // Environment helpers
        'WEBPACK_DATA': {
          'metadata': JSON.stringify(metadata),
        }
      }),

      /**
       * Plugin: UglifyJsPlugin
       * Description: Minimize all JavaScript output of chunks.
       * Loaders are switched into minimizing mode.
       *
       * See: https://webpack.github.io/docs/list-of-plugins.html#uglifyjsplugin
       */
      new webpack.optimize.UglifyJsPlugin({
        beautify: release ? false : true,
        // TODO bug ab RC5 https://github.com/angular/angular/issues/10618
        // TODO  -> mangle: { screw_ie8: true, keep_fnames: true}
        mangle  : release ? {screw_ie8: true, keep_fnames: true} : false,
        compress: release ? {screw_ie8: true}
          : {screw_ie8: true, keep_fnames: true, drop_debugger: false, dead_code: false, unused: false,},
        comments: release ? false : true,
        // dead_code: release ? true : false,
        // unused: release ? true : false,
        // deadCode: release ? true : false
      }),


      /**
       * Plugin LoaderOptionsPlugin (experimental)
       *
       * See: https://gist.github.com/sokra/27b24881210b56bbaff7
       */
      new webpack.LoaderOptionsPlugin({
        debug: !release,
        options: {
          context: cwd,
          output: { path :  targetDir },

          /**
           * Static analysis linter for TypeScript advanced options configuration
           * Description: An extensible linter for the TypeScript language.
           *
           * See: https://github.com/wbuchwalter/tslint-loader
           */
          tslint: {
            emitErrors: true,
            failOnHint: release,
            resourcePath: 'src'
          },


          /**
           * Html loader advanced options
           *
           * See: https://github.com/webpack/html-loader#advanced-options
           */
          // TODO: Need to workaround Angular 2's html syntax => #id [bind] (event) *ngFor
          htmlLoader: {
            minimize: release,
            removeAttributeQuotes: false,
            caseSensitive: true,
            customAttrSurround: [
              [/#/, /(?:)/],
              [/\*/, /(?:)/],
              [/\[?\(?/, /(?:)/]
            ],
            customAttrAssign: [/\)?\]?=/]
          },

        }
      }),
    ],

    /*
     * Include polyfills or mocks for various node stuff
     * Description: Node configuration
     *
     * See: https://webpack.github.io/docs/configuration.html#node
     */
    node: {
      global        : true,
      crypto        : 'empty',
      fs            : 'empty',  // f. browser build
      net           : 'empty',  // ~
      tls           : 'empty',  // ~
      process       : release ? false : true,
      module        : false,
      clearImmediate: false,
      setImmediate  : false
    }
  }; // config
}; // function

/**
 * package.json holen und buildnumber++ eintragen
 */
function getPackage(package_json, env) {
  // TODO getrennte build-Zaehler f. prod. und dev. ??
  var package = require(package_json);
  if (package) {
    // buildnumber aus package.json holen (default 0)
    var buildnumber = package.buildnumber || 0;
    // +1
    package.buildnumber = ++buildnumber;
    // package.json mit der neuen buildnumber zurueckschreiben
    fs.writeFileSync(package_json, JSON.stringify(package, null, 2));
    return package;
  } else {
    throw "ERROR getting package.json";
  }
}

/* -> compressionPlugin
 function gzipMaxLevel(buffer, callback) {
 return zlib['gzip'](buffer, {level: 9}, callback)
 }
 */
