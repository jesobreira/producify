'use strict';

const death = require('death');
const recursive = require('recursive-readdir');
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const iif = require('iif-cb');
const readlineSync = require('readline-sync');
const chokidar = require('chokidar');
const uglifycss = require('uglifycss');
const uglifyjs = require('uglify-js-es6');
const minifyhtml = require('html-minifier').minify;

var producifylib = {};

producifylib.regexp = {
    "include": /<include href=['|"]?([^>'"]+)['|"]? ?\/?>/ig,
    "css": /<link(?: ?(?:rel|type)=['"]?(?:stylesheet|text\/css)['"]?)* href=['"]?([^'"]+)(?<!\.min\.css)['"]?(?: ?(?:rel|type)=['"]?(?:stylesheet|text\/css)['"]?)* ?\/?>/ig,
    "js": /<script(?:.*)src=["']([^'">]*)(?<=\.js)(?<!\.min\.js)['"](?:.*)>/ig
}

producifylib.showHelp = function() {
    console.log("Usage: producify [PATH] [OPTIONS] [FLAGS]")
    console.log("Options:")
    console.log("\t--build [FOLDER]\tBuilds [PATH] onto [FOLDER]");
    console.log("\t--serve\t\t\tServes [PATH] as a webserver and watches for changes")
    console.log("\nOptional modifiers:")
    console.log("\t--port [PORT]\t\t\t\tOpens HTTP server on the port [PORT] (default: random port)")
    console.log("\t--concatjsfilename [FILENAME]\t\tSets bundle JS filename (default: bundle.min.js)")
    console.log("\t--concatcssfilename [FILENAME]\t\tSets bundle CSS filename (default: bundle.min.css)")
    console.log("\t--y\t\t\t\t\tAnswers \"y\" to any possible question input, such as overwrite files")
    console.log("\nFlags (prepend + or - to enable or disable them):")
    console.log("\tH\tMinify HTML (default: enabled)")
    console.log("\tU\tMinify Javascript (default: enabled)")
    console.log("\tC\tMinify CSS (default: enabled)")
    console.log("\tJ\tConcatenate Javascript files (default: disabled)")
    console.log("\tP\tConcatenate CSS files (default: disabled)")
    console.log("\tI\tParse <include href=\"\" /> tag (default: enabled)")
    console.log("\nExamples:")
    console.log("\tproducify . --serve\t\t\t\tServes current dir at a random port");
    console.log("\tproducify . --serve -CP\t\t\t\tServes current dir at a random port without minifying or concatenating CSS")
    console.log("\tproducify public_html/ --build www/ --serve +JP\tBuilds public_html to the www folder concatenating CSS and Javascript and serve it")
    console.log("\tproducify public_html/ --build www/\t\tBuilds public_html to the www folder")
    console.log("\nWebsite: https://jesobreira.github.io/producify")
    process.exit(0);
}

producifylib.startHTTP = function(build_location, port) {
    console.log("Starting HTTP server...");
    const app = express();
    app.use(express.static(path.join(build_location)));

    var server = app.listen(port, function() {
        var port = server.address().port;
        console.log('Serving HTTP server on http://localhost:' + port);
    });
    return server;

}
producifylib.registerOnExit = function(build_location) {
    death({
        SIGUSR1: true,
        SIGUSR2: true
    })(function() {
        console.log("\nCleaning up...");
        fs.removeSync(build_location);
        process.exit();
    })
}

producifylib.build = function(origin, target, opts) {
    return new Promise(function(resolve, reject) {
        // copy entire folder
        if (fs.pathExistsSync(target)) {
            if (opts.overwrite || readlineSync.keyInYN('The folder ' + target + ' is not empty. Do you want to DELETE every file on it?')) {
                fs.removeSync(target);
                fs.ensureDirSync(target);
            } else {
                process.exit(1);
            }
        }
        fs.copySync(origin, target);

        // list files
        recursive(target, [function(file, stats) {
                return !(path.basename(file).endsWith('.html') || path.basename(file).endsWith('.htm'))
            }],
            function(err, files) {
                if (err) reject(err);
                var files_to_delete = [];
                var bundleAssets = {
                    css: {},
                    js: {}
                }
                files.forEach(function(file) {
                    if (!fs.pathExistsSync(file)) return;
                    var newfilecontents, filecontents = newfilecontents = fs.readFileSync(file).toString();

                    if (opts.parseIncludes) {
                        do {
                            var include_regexp = RegExp(producifylib.regexp.include.source, producifylib.regexp.include.flags);
                            var incl = include_regexp.exec(newfilecontents);
                            if (incl !== null) {
                                var full_tag = incl[0];
                                var included_file = incl[1];
                                if (!fs.existsSync(included_file)) {
                                    included_file = path.dirname(file) + '/' + included_file;
                                    if (!fs.existsSync(included_file)) {
                                        reject("Included file not found: " + included_file + "\nFile was included by " + file);
                                    }
                                }
                                console.log("Including " + included_file + " into " + file);
                                newfilecontents = newfilecontents.replace(full_tag, fs.readFileSync(included_file).toString());
                                if (path.resolve(included_file).startsWith(path.resolve(origin) + '/')) {
                                    var f2d = path.resolve(included_file).replace(path.resolve(origin), path.resolve(target));
                                    if (!files_to_delete.includes(f2d)) files_to_delete.push(f2d)
                                }
                            }
                        } while (incl !== null);
                    }

                    if (opts.minifyCss) {
                        do {
                            var styles_regexp = RegExp(producifylib.regexp.css.source, producifylib.regexp.css.flags);
                            var csses = styles_regexp.exec(newfilecontents);
                            if (csses !== null) {
                                var full_tag = csses[0];
                                var included_file_raw, included_file = included_file_raw = csses[1];
                                if (!fs.existsSync(included_file)) {
                                    included_file = path.dirname(file) + '/' + included_file;
                                    if (!fs.existsSync(included_file)) {
                                        reject("CSS file not found: " + included_file + "\nFile was referenced by " + file);
                                    }
                                }
                                var new_filename = target + '/' + included_file_raw.substr(0, included_file_raw.length - 3) + 'min.css';
                                files_to_delete.push(target + '/' + included_file_raw);
                                console.log("Minifying " + included_file + " to " + new_filename);
                                var minified_css = uglifycss.processFiles([included_file_raw]);
                                if (opts.concatCss) {
                                    var prop = path.dirname(path.resolve(new_filename));
                                    var prop_rel = path.dirname(new_filename);
                                    if (bundleAssets.css.hasOwnProperty(prop)) {
                                        bundleAssets.css[prop] += "\n" + minified_css;
                                        newfilecontents = newfilecontents.replace(full_tag, "");
                                    } else {
                                        bundleAssets.css[prop] = minified_css;
                                        newfilecontents = newfilecontents.replace(full_tag, full_tag.replace(included_file_raw, prop_rel.replace(target, "") + '/' + (cmdline.get('concatcssfilename') ? cmdline.get('concatcssfilename') : 'bundle.min.css')))
                                    }
                                } else {
                                    fs.writeFileSync(new_filename, minified_css);
                                    newfilecontents = newfilecontents.replace(full_tag, full_tag.replace(included_file_raw, included_file_raw.substr(0, included_file_raw.length - 3) + 'min.css'))
                                }
                            }
                        } while (csses !== null);
                    }

                    if (opts.minifyJs) {
                        do {
                            var styles_regexp = RegExp(producifylib.regexp.js.source, producifylib.regexp.js.flags);
                            var jses = styles_regexp.exec(newfilecontents);
                            if (jses !== null) {
                                var full_tag = jses[0];
                                var included_file_raw, included_file = included_file_raw = jses[1];
                                if (!fs.existsSync(included_file)) {
                                    included_file = path.dirname(file) + '/' + included_file;
                                    if (!fs.existsSync(included_file)) {
                                        reject("JS file not found: " + included_file + "\nFile was referenced by " + file);
                                    }
                                }
                                var new_filename = target + '/' + included_file_raw.substr(0, included_file_raw.length - 2) + 'min.js';
                                files_to_delete.push(target + '/' + included_file_raw);
                                console.log("Minifying " + included_file + " to " + new_filename);
                                var minified_js = uglifyjs.minify(included_file_raw).code;
                                if (opts.concatJs) {
                                    var prop = path.dirname(path.resolve(new_filename));
                                    var prop_rel = path.dirname(new_filename);
                                    if (bundleAssets.js.hasOwnProperty(prop)) {
                                        bundleAssets.js[prop] += "\n" + minified_js;
                                        newfilecontents = newfilecontents.replace(full_tag, "");
                                    } else {
                                        bundleAssets.js[prop] = minified_js;
                                        newfilecontents = newfilecontents.replace(full_tag, full_tag.replace(included_file_raw, prop_rel.replace(target, "") + '/' + (cmdline.get('concatjsfilename') ? cmdline.get('concatjsfilename') : 'bundle.min.js')))
                                    }
                                } else {
                                    fs.writeFileSync(new_filename, minified_js);
                                    newfilecontents = newfilecontents.replace(full_tag, full_tag.replace(included_file_raw, included_file_raw.substr(0, included_file_raw.length - 2) + 'min.js'))
                                }
                            }
                        }
                        while (jses !== null);
                    }

                    // save and delete output files
                    console.log("Saving " + file);
                    var minifyhtml_opts;
                    if (opts.minifyHtml) {
                        minifyhtml_opts = {
                            removeComments: true,
                            collapseWhitespace: true
                        }
                    } else {
                        minifyhtml_opts = {
                            preserveLineBreaks: true
                        }
                    }
                    minifyhtml_opts.keepClosingSlash = true;
                    minifyhtml_opts.minifyCSS = opts.minifyCss;
                    minifyhtml_opts.minifyJS = opts.minifyJs;
                    newfilecontents = minifyhtml(newfilecontents, minifyhtml_opts);
                    fs.writeFileSync(file, newfilecontents);
                });
                var bundlecssfn = (cmdline.get('concatcssfilename') ? cmdline.get('concatcssfilename') : 'bundle.min.css');
                var bundlejsfn = (cmdline.get('concatjsfilename') ? cmdline.get('concatjsfilename') : 'bundle.min.js');

                for (var key in bundleAssets.css) {
                    if (bundleAssets.css.hasOwnProperty(key)) {
                        console.log("Writting CSS bundle file " + key + '/' + bundlecssfn);
                        var code = bundleAssets.css[key];
                        fs.writeFileSync(key + '/' + bundlecssfn, code);
                    }
                }
                for (var key in bundleAssets.js) {
                    if (bundleAssets.js.hasOwnProperty(key)) {
                        console.log("Writting JS bundle file " + key + '/' + bundlejsfn);
                        var code = bundleAssets.js[key];
                        fs.writeFileSync(key + '/' + bundlejsfn, code);
                    }
                }
                files_to_delete.forEach(function(f2d) {
                    console.log("Deleting previously processed file " + f2d);
                    fs.unlinkSync(f2d);
                    recursive(path.dirname(f2d), ['thumbs.db', '.DS_Store', 'desktop.ini'], function(err, files) {
                        if (!err && !files.length) {
                            fs.remove(path.dirname(f2d));
                        }
                    })
                })
                resolve();
            })
    })
}

producifylib.startWatcher = function(folder, cb) {
    console.log("Watching folder " + folder + " for changes");
    chokidar.watch(folder, {
        ignoreInitial: true,
        ignored: /^(\.DS_Store|thumbs.db|desktop\.ini)$/
    }).on('all', cb);
}

module.exports = producifylib;