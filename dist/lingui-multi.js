#! /usr/bin/env node

'use strict'

const compile = require('@sector-labs/lingui-cli/api/compile')
const commander = require('commander')
const extract = require('@sector-labs/lingui-cli/api/extract')
const tmp = require('tmp')

const path = require('path')
const fs = require('fs')

// Set up version command
commander.version(require('../package.json').version)

// Set up extract command
commander
  .command('extract [packageFile] [localesFolder]')
  .option('--clean', 'Removes obsolete messages from catalogs')
  .option('--upwardBabelRoot', 'Search for babel configs in the parent dirs')
  .action((packageFile = './package.json', localesDir = './locale', args = {}) => {
    try {
      const packageObject = loadPackageConfig(packageFile)

      const locales = loadLocales(localesDir)

      extractCatalogs(packageFile, packageObject, localesDir, locales, args)
    } catch (error) {
      console.error(error.message)
      process.exit(1)
    }
  })

// Set up compile command
commander
  .command('compile [packageFile] [localesFolder]')
  .option('-s, --strict', 'Strict compilation')
  .option('--removeIdentityPairs', 'Reduces the catalog size by removing the entries that have a translation identical with the translation')
  .option('--targetFolder <folder>', 'The path where to store the compiled catalogs. Defaults to [localesFolder]')
  .action(function(packageFile = './package.json', localesDir = './locale', args = {}) {
    try {
      // 1. Load the config from package.json
      // 2. Validate the configuration
      // 3. Inject a special sub-catalog bundle so that a complete
      //    catalog is generated alongside the sub-catalogs
      var packageObject = loadPackageConfig(packageFile)

      var locales = loadLocales(localesDir)

      compileCatalogs(packageObject, localesDir, locales, args)
    } catch (error) {
      console.error(error.message)
      process.exit(1)
    }
  })

const extractCatalogs = (packageFile, packageObject, localesDir, locales, args) => {
  // The directory where we are going to do the extract/collect
  const targetDir = createTempDirectory()

  const options = Object.assign({}, packageObject.lingui, {
    srcPathDirs: packageObject.lingui.srcPathDirs
      .map(srcPath => srcPath.replace('<rootDir>', path.dirname(packageFile))),
    ignore: packageObject.lingui.srcPathIgnorePatterns || []
  })

  if (args.upwardBabelRoot) {
    options.babelOptions = { "rootMode": "upward" };
  }
  extract.extract(options.srcPathDirs, targetDir, options)

  const rawCatalog = extract.collect(targetDir)

  // Prepopulate with empty translations
  const linguiCatalog = Object.keys(rawCatalog).reduce((final, key) => Object.assign(final, {
    [key]: Object.assign({
      translation: ''
    }, rawCatalog[key])
  }), {})

  // Remove the occurance line numbers and flatten the origin list
  const simplifiedCatalog = simplifyComplexCatalog(linguiCatalog)

  // Go over each locale
  locales.forEach((locale) => {
    // Just ignore the build directory if it pops up by mistake.
    if (locale === '_build') return

    // Only continue if locale is a directory
    if (fs.lstatSync(path.resolve(localesDir, locale)).isDirectory() === false) {
      return
    }

    const translationOnlyCatalog = filterTranslationOnly(loadLinguiCatalog(localesDir, locale))
    const complexCatalog = Object.keys(simplifiedCatalog)
      .reduce((finalCatalog, translationKey) => Object.assign(finalCatalog, {
        [translationKey]: Object.assign(simplifiedCatalog[translationKey], translationOnlyCatalog[translationKey])
      }), {})

    let minimalCatalog;
    if(args.clean) {
      const existingMinimalCatalog = loadMinimalCatalogBypassErrors(localesDir, locale)
      minimalCatalog = createMinimalCatalog(complexCatalog)
      Object.keys(existingMinimalCatalog).forEach(function(key) {
        if(key in minimalCatalog) {
          minimalCatalog[key] = existingMinimalCatalog[key]
        }
      })
    } else {
      minimalCatalog = Object.assign(createMinimalCatalog(complexCatalog), loadMinimalCatalogBypassErrors(localesDir, locale))
    }

    writeMinimalCatalog(sortObjectKeys(minimalCatalog), localesDir, locale)

    // Write metadata catalog only to source locale directory
    if (locale === options.sourceLocale) {
      writeMetadataCatalog(sortObjectKeys(complexCatalog), localesDir, locale)
    }

    console.info(`${locale} ${Object.keys(minimalCatalog).length}`)
  })
}

const compileCatalogs = (packageObject, localesDir, locales, args) => {
  // Iterate the language catalogs
  Object.keys(packageObject['lingui-multi']).forEach(catalogName => {
    console.info(`\n\nCatalog: ${catalogName}`)
    console.info('================')

    // Grab the ignore patterns
    const ignorePattern = getSubCatalogIgnoreRegex(packageObject, catalogName)

    // Go over each locale
    locales.forEach(function (locale) {
      // Just ignore the build directory if it pops up by mistake.
      if (locale === '_build') return

      // Only continue if locale is a directory
      if (fs.lstatSync(path.resolve(localesDir, locale)).isDirectory() === false) {
        return
      }

      // We only pick up the metadata catalog from source locale directory
      const messagesObject = loadLinguiCatalog(localesDir, packageObject.lingui.sourceLocale)

      const screenedKeys = getScreenedKeys(messagesObject, ignorePattern)

      // Grab hold of the minimal format catalog
      const minimalCatalogObject = loadMinimalCatalog(localesDir, locale)

      // Strict mode checking for missing translations
      if (args.strict && 'sourceLocale' in packageObject.lingui &&
        locale !== packageObject.lingui.sourceLocale) {
        verifyNoMissingTranslations(minimalCatalogObject, locale)
      }

      // Pull out translations of interest
      const screenedCatalogObject = filterProperties(minimalCatalogObject, screenedKeys)

      // Compile the catalog js data
      const jsData = compile.createCompiledCatalog(locale, screenedCatalogObject, false, 'cjs', packageObject.lingui.pseudoLocale, args.removeIdentityPairs)

      // Catalog: __lingui-multi is for complete catalog
      const targetFile = catalogName === '__lingui-multi' ?
        getCatalogTargetFilePath(args.targetFolder || localesDir, locale) :
        getSubCatalogTargetFilePath(args.targetFolder || localesDir, locale, catalogName)

      fs.writeFileSync(targetFile, jsData)

      console.info(`${locale} ${Object.keys(screenedCatalogObject).length}`)
    })
  })
}

const loadPackageConfig = filename => {
  if (fs.existsSync(filename) === false) {
    throw new Error(`${filename} does not exist`)
  }

  try {
    const parsedConfig = JSON.parse(fs.readFileSync(filename))

    // Validate the config and then inject main
    // catalog settings so that a complete catalog
    // is generated alongside sub-catalogs, then
    // return the resulting configuration object
    return injectMainCatalogConfig(validatePackageConfig(parsedConfig))
  } catch (error) {
    throw new Error(`${filename} is not a valid JSON file`)
  }
}

const validatePackageConfig = config => {
  if (!('lingui' in config)) {
    throw new Error('no lingui config found')
  }

  if (!('sourceLocale' in config.lingui)) {
    throw new Error('no source locale in lingui config')
  }

  if (!('lingui-multi' in config)) {
    throw new Error('no lingui-multi config found')
  }

  if (Object.keys(config['lingui-multi']).length === 0) {
    throw new Error('no lingui-multi sub-catalog config found')
  }

  return config
}

const injectMainCatalogConfig = config => Object.assign({}, config, {
  'lingui-multi': Object.assign(config['lingui-multi'], {
    '__lingui-multi': {}
  })
})

const loadLocales = directory => {
  if (fs.existsSync(directory) === false) {
    throw new Error('locale directory does not exist')
  }

  return fs.readdirSync(directory)
}


const getSubCatalogIgnoreRegex = (config, catalogName) => {
  const globalIgnorePattern = process.env.LINGUI_MULTI_IGNORE_PATTERNS
    ? [ process.env.LINGUI_MULTI_IGNORE_PATTERNS ]
    : []

  const ignorePatterns = (config.lingui.srcPathIgnorePatterns || [])
    .concat(config['lingui-multi'][catalogName].srcPathIgnorePatterns || [])
    .concat(globalIgnorePattern)

  return ignorePatterns.length ? new RegExp(ignorePatterns.join('|'), 'i') : null
}

const loadMinimalCatalog = (directory, locale) => _loadCatalog(directory, locale)

const loadMinimalCatalogBypassErrors = (directory, locale) => {
  try {
    return _loadCatalog(directory, locale)
  } catch (error) {
    return {}
  }
}

const loadLinguiCatalog = (directory, locale) => {
  try {
    return _loadCatalog(directory, locale, '.metadata')
  } catch (error) {
    return {}
  }
}

const _loadCatalog = (directory, locale, suffix = '') => {
  const filePath = _getJsonFilePath(directory, locale, suffix)

  try {
    return Object.assign({}, JSON.parse(fs.readFileSync(filePath)))
  } catch (error) {
    throw new Error(`file is corrupted: ${filePath}`)
  }
}

const verifyNoMissingTranslations = (catalog, locale) => {
  const missingTranslations = Object.keys(catalog).filter(key => catalog[key] === '')

  if (missingTranslations.length > 0) {
    throw new Error(`Missing ${missingTranslations.length} translations in ${locale}`)
  }
}

const createTempDirectory = () => tmp.dirSync().name

const getCatalogTargetFilePath = (directory, locale) => _getTargetFilePath(directory, locale)

const getSubCatalogTargetFilePath = (directory, locale, catalogName) => _getTargetFilePath(directory, locale, `${catalogName}.`)

const _getTargetFilePath = (directory, locale, prefix = '') => `${directory}/${locale}/${prefix}messages.js`

const _getJsonFilePath = (directory, locale, suffix = '') => {
  const jsonFile = `${directory}/${locale}/messages${suffix}.json`
  if (fs.existsSync(jsonFile) === false) {
    throw new Error(`file missing: ${jsonFile}`)
  }
  return jsonFile
}

const sortObjectKeys = (obj) => {
  const sortedObj = {};
  Object.keys(obj).sort().forEach(function(key) {
    sortedObj[key] = obj[key];
  });
  return sortedObj;
}

const createMinimalCatalog = (complexCatalog) =>
  Object.keys(complexCatalog)
    .reduce((final, key) => Object.assign(final, {
      [key]: complexCatalog[key].translation
    }), {})

const writeMinimalCatalog = (catalog, directory, locale) =>
  fs.writeFileSync(`${directory}/${locale}/messages.json`, JSON.stringify(catalog, null, 2))

const writeMetadataCatalog = (catalog, directory, locale) =>
  fs.writeFileSync(`${directory}/${locale}/messages.metadata.json`, JSON.stringify(catalog, null, 2))

const getScreenedKeys = (messages, ignorePattern) => Object.keys(messages).filter(key =>
  messages[key].origin.every(origin => ignorePattern.test(origin)) === false)

const filterProperties = (obj, properties) =>
  Object.keys(obj)
    .filter(key => properties.includes(key))
    .reduce((final, filteredKey) => Object.assign(final, {
      [filteredKey]: obj[filteredKey]
    }), {})

const filterTranslationOnly = catalog =>
  Object.keys(catalog)
    .reduce((finalCatalog, translationKey) => Object.assign(finalCatalog, {
      [translationKey]: filterProperties(catalog[translationKey], ['translation'])
    }), {})

const simplifyComplexCatalog = catalog =>
  Object.keys(catalog)
    .reduce((simplifiedCatalog, key) => Object.assign(simplifiedCatalog, {
      [key]: Object.assign(catalog[key], {
        origin: catalog[key].origin.map(originArray => originArray.shift())
      })
    }), {})

module.exports = {
  loadLinguiCatalog,
  loadMinimalCatalog,
  _loadCatalog,
  _getTargetFilePath,
  _getJsonFilePath,
  loadPackageConfig,
  verifyNoMissingTranslations,
  createMinimalCatalog,
  validatePackageConfig
}

commander.parse(process.argv)
