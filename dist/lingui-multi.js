#! /usr/bin/env node

const compile = require('@lingui/cli/api/compile');
const extract = require('@lingui/cli/api/extract');
const commander = require('commander');
const rimraf = require('rimraf');
const tmp = require('tmp');
const _ = require('lodash');

const path = require('path');
const util = require('util');
const fs = require('fs');

commander.version(require("../package.json").version).arguments("[package-json]  [locale-dir]"
).action(function (packageJson, localeDirectory)
{
    package = packageJson;
    localeDir = localeDirectory;
}).parse(process.argv);



if (typeof package === 'undefined')
{
    console.info('No package.json path supplied, using default: ./package.json');
    package = './package.json';
}

console.info('Package json: ' + path.resolve(package));

if (fs.existsSync(package) === false)
{
    console.error('ERROR: package.json does not exist');
    process.exit(1);
}

packageObject = JSON.parse(fs.readFileSync(package));

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

locales = fs.readdirSync(localeDir);

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
// const targetDir = './lingui-multi';
console.info("Creating temporary build directory");
const targetDir = tmp.dirSync().name;

let buildDir = targetDir + '/_build';

// Create build dir if not exist
if (fs.existsSync(buildDir) === false)
    fs.mkdirSync(buildDir);

console.info('Build scratchpad directory: ' + path.resolve(buildDir));

// Iterate the language bundles
for (bundle in packageObject['lingui-multi'])
{
    console.info(util.format("Building %s language bundle", bundle));
    // Remove build dir contents on each run
    rimraf.sync(buildDir + '/*');

    let options = Object.assign({}, packageObject.lingui);

    let srcPathDirs = packageObject.lingui.srcPathDirs;

    // Dirty patch for <rootDir>
    options.srcPathDirs = [];

    srcPathDirs.forEach(function (dir)
    {
        options.srcPathDirs.push(dir.replace('<rootDir>', path.dirname(package)));
    });


    // Convert from CLI to API keys
    if ('srcPathIgnorePatterns' in options)
    {
        options.ignore = options.srcPathIgnorePatterns;
    }

    if ('srcPathIgnorePatterns' in packageObject['lingui-multi'][bundle])
    {
        options.ignore = (options.ignore || []).concat(packageObject['lingui-multi'][bundle]['srcPathIgnorePatterns']);
    }

    delete options.srcPathIgnorePatterns;

    extract.extract(options.srcPathDirs, targetDir, options);

    let catalogObject = extract.collect(buildDir);

    let keys = Object.keys(catalogObject);

    // Go over each locale
    locales.forEach(function (locale)
    {
        let messagesObject = {};

        // Only continue if locale is a directory
        if (fs.lstatSync(path.resolve(localeDir, locale)).isDirectory() === false)
        {
            return;
        }

        filePath = util.format('%s/%s/messages.json', localeDir, locale);
        if (fs.existsSync(filePath) === false)
        {
            console.info(util.format('INFO: File not found for conversion: %s', filePath));
            return;
        }

        messagesObject = Object.assign(messagesObject, JSON.parse(fs.readFileSync(filePath)));

        screenedMessages = _.pick(messagesObject, keys);

        jsData = compile.createCompiledCatalog(locale, screenedMessages);

        targetFile = util.format('%s/%s/%s.js', localeDir, locale, bundle);

        fs.writeFileSync(targetFile, jsData);

        console.info(util.format('Wrote %d messages to %s/%s.messages.js', Object.keys(screenedMessages).length, locale, bundle));
    });

}

console.info("Done");

