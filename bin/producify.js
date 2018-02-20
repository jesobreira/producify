#!/usr/bin/env node --harmony

'use strict';

const cmdline = require('node-cmdline-parser');
const fs = require('fs-extra');
const tmp = require('tmp');

const lib = require('../lib');

if (cmdline.keyexists('help') || !cmdline.getvalbyindex(2)) {
    lib.showHelp();
} else {
    var folder = process.cwd() + '/' + cmdline.getvalbyindex(2);

    if (!fs.pathExistsSync(folder)) {
        console.log("E: Folder not found: PATH");
        process.exit(1);
    }

    if (!cmdline.keyexists('serve') && !cmdline.keyexists('server') && !cmdline.keyexists('build')) {
        console.log("E: Missing required parameter: OPTIONS");
        process.exit(1);
    }

    if (cmdline.keyexists('build')) {
        var build_location = cmdline.get('build');
        if (!build_location) {
            console.log("E: Missing required parameter: FOLDER");
            process.exit(1);
        } else {
            console.log("Building to: " + build_location);
        }
    } else { // --serve or --server (the latter for avoiding loss of time)
        var build_location = tmp.dirSync({ prefix: 'producify_' }).name;
        lib.registerOnExit(build_location);
        console.log("Building to: " + build_location);
    }

    var main = function(overwrite = false, startserver = true) {
        lib.build(folder, build_location, {
            minifyHtml: !cmdline.flagdisabled('H'),
            minifyJs: !cmdline.flagdisabled('U'),
            minifyCss: !cmdline.flagdisabled('C'),
            concatJs: cmdline.flagenabled('J'),
            concatCss: cmdline.flagenabled('P'),
            parseIncludes: !cmdline.flagdisabled('I'),
            overwrite: overwrite
        }).then(function() {
            console.log("Building complete!");
            if (startserver) var server = lib.startHTTP(build_location, cmdline.get('port'));
        }).then(function() {
            if (startserver) {
                lib.startWatcher(folder, function(evt, changedFile) {
                    if (evt != 'addDir') {
                        console.log("File " + changedFile + " modified (" + evt + "), rebuilding...");
                        main(true, false);
                    }
                });
            }
        }).catch(function(e) {
            console.log("E: " + e);
            process.exit(1);
        });
    }

    main((cmdline.keyexists('y') || cmdline.keyexists('serve') || cmdline.keyexists('server')) && (!cmdline.keyexists('build') || cmdline.keyexists('y')), cmdline.keyexists('serve') || cmdline.keyexists('server'));
}