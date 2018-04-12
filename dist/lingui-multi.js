#! /usr/bin/env node

"use strict";

const compile = require("@lingui/cli/api/compile");
const commander = require("commander");
const extract = require('@lingui/cli/api/extract');
const tmp = require('tmp');
const rimraf = require('rimraf');
const _ = require('lodash');

const path = require("path");
const util = require("util");
const fs = require("fs");

var packageFile = undefined;
var localeDir = undefined;

commander.version(require("../package.json").version);
commander.command('extract [packageFile] [localeDirectory]').action(function (packageFile, localeDir)
{
    if (typeof packageFile === 'undefined')
    {
        console.info('No package.json path supplied, using default: ./package.json');
        packageFile = './package.json';
    }

    console.info('Package json: ' + path.resolve(packageFile));

    if (fs.existsSync(packageFile) === false)
    {
        console.error('ERROR: package.json does not exist');
        process.exit(1);
    }

    var packageObject = JSON.parse(fs.readFileSync(packageFile));

    if (typeof localeDir === 'undefined')
    {
        console.info('No locale directory path supplied, using default: ./locale');
        localeDir = './locale';
    }

    console.info('Locale directory: ' + path.resolve(localeDir));

    if (fs.existsSync(localeDir) === false)
    {
        console.error('ERROR: locale directory does not exist');
        process.exit(1);
    }

    var locales = fs.readdirSync(localeDir);

    if (!('lingui' in packageObject))
    {
        console.error('ERROR: No lingui config found');
        process.exit(1);
    }

    if (!('lingui-multi' in packageObject))
    {
        console.error('ERROR: No lingui-multi bundles config found');
        process.exit(1);
    }



    // The directory where we are going to do the extract/collect
    console.info("Creating temporary build directory");
    const targetDir = tmp.dirSync().name;

    let buildDir = targetDir + '/_build';

    // Create build dir if not exist
    if (fs.existsSync(buildDir) === false)
        fs.mkdirSync(buildDir);

    console.info('Build scratchpad directory: ' + path.resolve(buildDir));

    // Remove build dir contents on each run
    rimraf.sync(buildDir + '/*');

    let options = Object.assign({}, packageObject.lingui);

    let srcPathDirs = packageObject.lingui.srcPathDirs;

    // Dirty patch for <rootDir>
    options.srcPathDirs = [];

    srcPathDirs.forEach(function (dir)
    {
        options.srcPathDirs.push(dir.replace('<rootDir>', path.dirname(packageFile)));
    });


    // Convert from CLI to API keys
    if ('srcPathIgnorePatterns' in options)
    {
        options.ignore = options.srcPathIgnorePatterns;
    }

    // Discard the old key name (api doesn't use it)
    delete options.srcPathIgnorePatterns;

    // Extract list of translation keys
    extract.extract(options.srcPathDirs, targetDir, options);

    let linguiCatalog = extract.collect(targetDir);

    // Again, using strict mode so declare this beforehand
    let key;

    // Prepopulate with empty translations
    for (key in linguiCatalog)
    {
        // New keys will be with empty translation
        linguiCatalog[key]['translation'] = '';
    }

    // Go over each locale
    locales.forEach(function (locale)
    {
        // Just ignore the build directory if it pops up by mistake.
        if (locale === "_build") return;

        // Only continue if locale is a directory
        if (fs.lstatSync(path.resolve(localeDir, locale)).isDirectory() === false)
        {
            return;
        }

        let filePath = util.format('%s/%s/messages.json', localeDir, locale);
        if (fs.existsSync(filePath) === false)
        {
            console.info(util.format('INFO: File not found for conversion: %s', filePath));
            return;
        }

        let complexCatalog = {};
        complexCatalog = Object.assign(linguiCatalog, JSON.parse(fs.readFileSync(filePath)));

        let minimalCatalog = {};
        for (key in complexCatalog)
        {
            minimalCatalog[key] = complexCatalog[key]['translation'];
        }

        let targetComplexFile = util.format('%s/%s/messages.json', localeDir, locale);
        let targetMinimalFile = util.format('%s/%s/minimal.messages.json', localeDir, locale);

        fs.writeFileSync(targetComplexFile, JSON.stringify(complexCatalog, null, 2));
        fs.writeFileSync(targetMinimalFile, JSON.stringify(minimalCatalog, null, 2));

        console.info(util.format('%s %d', locale, Object.keys(minimalCatalog).length));
    });
});

commander.command('compile [packageFile] [localeDirectory]').option('-s, --strict', 'Strict compilation').action(function (packageFile, localeDir, args)
{
    if (typeof packageFile === "undefined")
    {
        console.info("No package.json path supplied, using default: ./package.json");
        packageFile = "./package.json";
    }

    if (fs.existsSync(packageFile) === false)
    {
        console.error("ERROR: package.json does not exist");
        process.exit(1);
    }

    var packageObject = JSON.parse(fs.readFileSync(packageFile));

    if (typeof localeDir === "undefined")
    {
        console.info("No locale directory path supplied, using default: ./locale");
        localeDir = "./locale";
    }

    if (fs.existsSync(localeDir) === false)
    {
        console.error("ERROR: locale directory does not exist");
        process.exit(1);
    }

    var locales = fs.readdirSync(localeDir);

    if (!("lingui" in packageObject))
    {
        console.error("ERROR: No lingui config found");
        process.exit(1);
    }

    if (!("lingui-multi" in packageObject))
    {
        console.error("ERROR: No lingui-multi bundles config found");
        process.exit(1);
    }

    // This is to replace the actual `lingui compile` workflow:
    // introduce a messages.js, file as well
    packageObject["lingui-multi"]["__replacement"] = {};

    // Using strict so implicit vars won"t work
    let bundle;

    // Iterate the language bundles
    for (bundle in packageObject["lingui-multi"])
    {
        console.info(util.format("\n\nCatalog: %s", bundle));
        console.info("================")

        let options = Object.assign({}, packageObject.lingui);

        // Convert from CLI to API keys
        if ("srcPathIgnorePatterns" in options)
        {
            options.ignore = options.srcPathIgnorePatterns;
        }

        if ("srcPathIgnorePatterns" in packageObject["lingui-multi"][bundle])
        {
            options.ignore = (options.ignore || []).concat(packageObject["lingui-multi"][bundle]["srcPathIgnorePatterns"]);
        }

        delete options.srcPathIgnorePatterns;

        // Grab the ignore patterns
        let ignorePattern = options.ignore.length ? new RegExp(options.ignore.join("|"), "i") : null;

        let keyCount = null;

        // Go over each locale
        locales.forEach(function (locale)
        {
            // Just ignore the build directory if it pops up by mistake.
            if (locale === "_build") return;

            // Only continue if locale is a directory
            if (fs.lstatSync(path.resolve(localeDir, locale)).isDirectory() === false)
            {
                return;
            }

            let filePath = util.format("%s/%s/messages.json", localeDir, locale);
            if (fs.existsSync(filePath) === false)
            {
                console.info(util.format("INFO: File not found for conversion: %s", filePath));
                return;
            }

            let messagesObject = {};
            messagesObject = Object.assign(messagesObject, JSON.parse(fs.readFileSync(filePath)));

            let key;
            let screenedKeys = [];
            for (key in messagesObject)
            {
                let required = false;
                
                let origin;

                messagesObject[key]["origin"].forEach(function (origin)
                {
                    // Filter out ignore patterns
                    if (ignorePattern && ignorePattern.test(origin[0])) return;
                    
                    required = true
                });
                

                // Gather the keys of interest
                if (required)
                    screenedKeys.push(key);
            }

            let localeTranslationsCount = Object.keys(screenedKeys).length;

            console.info(util.format("%s:  %d", locale, localeTranslationsCount));

            // Initialize the first time
            if (keyCount == null)
                keyCount = localeTranslationsCount;

            // Check if all locales have the same count
            if (keyCount != localeTranslationsCount)
            {
                console.error("Translations mismatch between locales.");
                process.exit(1);
            }

            let minimalCatalogPath = util.format("%s/%s/minimal.messages.json", localeDir, locale);
            if (fs.existsSync(filePath) === false)
            {
                console.info(util.format("INFO: File not found for conversion: %s", filePath));
                return;
            }

            // Grab hold of the minimal format catalog
            let minimalCatalogObject = JSON.parse(fs.readFileSync(minimalCatalogPath));

            if (args.strict && 'sourceLocale' in packageObject.lingui && locale != packageObject.lingui.sourceLocale)
            {
                let missingTranslations = [];
                for (key in minimalCatalogObject)
                {
                    if (minimalCatalogObject[key] == '')
                    {
                        missingTranslations.push(key);
                    }
                }

                if (missingTranslations.length > 0)
                {
                    console.error(util.format("\n\nMissing %d translations in locale %s", missingTranslations.length, locale));
                    missingTranslations.forEach(function (key)
                    {
                        console.error(key);
                    });

                    process.exit(1);
                }
            }    

            // Pull out translations of interest
            let screenedCatalogObject = _.pick(minimalCatalogObject, screenedKeys);

            // Compile the catalog js data
            let jsData = compile.createCompiledCatalog(locale, screenedCatalogObject);

            let targetFile;
            
            // @lingui/cli compile replacement
            if (bundle === '__replacement')
                targetFile = util.format("%s/%s/messages.js", localeDir, locale);
            else
            // @sector-labs/lingui-multi compile workflow    
                targetFile = util.format("%s/%s/%s.messages.js", localeDir, locale, bundle);

            // Write, and done
            fs.writeFileSync(targetFile, jsData);

        });

    }

});

commander.parse(process.argv);
