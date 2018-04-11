#! /usr/bin/env node

"use strict";

const compile = require("@lingui/cli/api/compile");
const extract = require("@lingui/cli/api/extract");
const commander = require("commander");

const path = require("path");
const util = require("util");
const fs = require("fs");

var packageFile = undefined;
var localeDir = undefined;

commander.version(require("../package.json").version).arguments("[package-json]  [locale-dir]")
    .action(function (packageJson, localeDirectory)
{
    packageFile = packageJson;
    localeDir = localeDirectory;
}).parse(process.argv);


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
        let screenedMessages = {};
        for (key in messagesObject)
        {
            // Filter out ignore patterns
            if (ignorePattern && ignorePattern.test(messagesObject[key]["origin"][0])) continue;

            // Gather the translations of interest
            screenedMessages[key] = messagesObject[key]["translation"];
        }

        let localeTranslationsCount = Object.keys(screenedMessages).length;

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

        let jsData = compile.createCompiledCatalog(locale, screenedMessages);

        let targetFile = util.format("%s/%s/%s.messages.js", localeDir, locale, bundle);

        fs.writeFileSync(targetFile, jsData);

    });

}

console.info("\n\nDone");

