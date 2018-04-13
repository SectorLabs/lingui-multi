#! /usr/bin/env node

'use strict'

const compile = require('@lingui/cli/api/compile')
const commander = require('commander')
const extract = require('@lingui/cli/api/extract')
const tmp = require('tmp')

const path = require('path')
const fs = require('fs')

// Set up version command
commander.version(require('../package.json').version)

// Set up extract command
commander.command('extract [packageFile] [localeDirectory]').action((packageFile = './package.json', localeDir = './locale') => {
  const packageObject = loadPackageConfig(packageFile)

  const locales = loadLocales(localeDir)

  extractCatalogs(packageFile, packageObject, localeDir, locales)
})

// Set up compile command
commander.command('compile [packageFile] [localeDirectory]').option('-s, --strict', 'Strict compilation').action(function (packageFile = './package.json', localeDir = './locale', args = {}) {
  // 1. Load the config from package.json
  // 2. Validate the configuration
  // 3. Inject a special sub-catalog bundle so that a complete
  //    catalog is generated alongside the sub-catalogs
  var packageObject = loadPackageConfig(packageFile)

  var locales = loadLocales(localeDir)

  compileCatalogs(packageFile, packageObject, localeDir, locales, args)
})

function extractCatalogs (packageFile, packageObject, localeDir, locales) {
  // The directory where we are going to do the extract/collect
  const targetDir = createTempDirectory()

  let options = Object.assign({}, packageObject.lingui, { srcPathDirs: packageObject.lingui.srcPathDirs.map(srcPath => srcPath.replace('<rootDir>', path.dirname(packageFile))), ignore: packageObject.lingui.srcPathIgnorePatterns || [] })

  extract.extract(options.srcPathDirs, targetDir, options)

  const rawCatalog = extract.collect(targetDir)

  // Prepopulate with empty translations
  const linguiCatalog = Object.keys(rawCatalog).reduce((final, key) => Object.assign(final, { [key]: Object.assign({ translation: '' }, rawCatalog[key]) }), {})

  // Go over each locale
  locales.forEach((locale) => {
    // Just ignore the build directory if it pops up by mistake.
    if (locale === '_build') return

    // Only continue if locale is a directory
    if (fs.lstatSync(path.resolve(localeDir, locale)).isDirectory() === false) {
      return
    }

    const complexCatalog = Object.assign(linguiCatalog, loadLinguiCatalog(localeDir, locale))

    const minimalCatalog = createMinimalCatalog(complexCatalog)

    writeCatalogs(complexCatalog, minimalCatalog, localeDir, locale)
    console.info(`${locale} ${Object.keys(minimalCatalog).length}`)
  })
}

function compileCatalogs (packageFile, packageObject, localeDir, locales, args) {
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
      if (fs.lstatSync(path.resolve(localeDir, locale)).isDirectory() === false) {
        return
      }

      const messagesObject = loadLinguiCatalog(localeDir, locale)

      const screenedKeys = Object.keys(messagesObject).filter(key => messagesObject[key].origin.every(
        origin => ignorePattern && ignorePattern.test(origin[0]) === false))

      // Grab hold of the minimal format catalog
      const minimalCatalogObject = loadMinimalCatalog(localeDir, locale)

      if (args.strict && 'sourceLocale' in packageObject.lingui && locale !== packageObject.lingui.sourceLocale) {
        verifyNoMissingTranslations(minimalCatalogObject, locale)
      }

      // Pull out translations of interest
      const screenedCatalogObject = screenedKeys.reduce((final, key) =>
        key in minimalCatalogObject ? Object.assign(final, { [key]: minimalCatalogObject[key] }) : final, {})

      // Compile the catalog js data
      const jsData = compile.createCompiledCatalog(locale, screenedCatalogObject)

      // Catalog: __lingui-multi is for complete catalog
      const targetFile = catalogName === '__lingui-multi' ? getCatalogTagetFilePath(localeDir, locale) : getSubCatalogTargetFilePath(localeDir, locale, catalogName)

      fs.writeFileSync(targetFile, jsData)

      console.info(`${locale} ${Object.keys(screenedCatalogObject).length}`)
    })
  })
}

function loadPackageConfig (filename) {
  if (fs.existsSync(filename) === false) {
    throw new Error('package.json does not exists')
  }

  try {
    const parsedConfig = JSON.parse(fs.readFileSync(filename))

    // Validate the config and then inject main
    // catalog settings so that a complete catalog
    // is generated alongside sub-catalogs, then
    // return the resulting configuration object
    return injectMainCatalogConfig(validatePackageConfig(parsedConfig))
  } catch (error) {
    throw new Error('package.json is not a valid JSON file')
  }
}

function validatePackageConfig (config) {
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

function injectMainCatalogConfig (config) {
  return Object.assign({}, config, { 'lingui-multi': Object.assign(config['lingui-multi'], { '__lingui-multi': {} }) })
}

function loadLocales (directory) {
  if (fs.existsSync(directory) === false) {
    throw new Error('locale directory does not exist')
  }

  return fs.readdirSync(directory)
}

function getSubCatalogIgnoreRegex (config, catalogName) {
  const ignorePatterns = [].concat(config.lingui.srcPathIgnorePatterns || [], config['lingui-multi'][catalogName].srcPathIgnorePatterns || [])

  return ignorePatterns.length ? new RegExp(ignorePatterns.join('|'), 'i') : null
}

function loadMinimalCatalog (directory, locale) {
  return _loadCatalog(directory, locale, 'minimal.')
}

function loadLinguiCatalog (directory, locale) {
  return _loadCatalog(directory, locale, '')
}

function _loadCatalog (directory, locale, prefix) {
  const filePath = _getJsonFilePath(directory, locale, prefix)

  try {
    return Object.assign({}, JSON.parse(fs.readFileSync(filePath)))
  } catch (error) {
    throw new Error(`file is corrupted: ${filePath}`)
  }
}

function verifyNoMissingTranslations (catalog, locale) {
  const missingTranslations = Object.keys(catalog).filter(key => catalog[key] === '')

  if (missingTranslations.length > 0) {
    throw new Error(`Missing ${missingTranslations.length} translations in ${locale}`)
  }
}

function createTempDirectory () {
  console.info('Creating temporary build directory')
  return tmp.dirSync().name
}

function getCatalogTagetFilePath (directory, locale) {
  return _getTargetFilePath(directory, locale, '')
}

function getSubCatalogTargetFilePath (directory, locale, catalogName) {
  return _getTargetFilePath(directory, locale, `${catalogName}.`)
}

function _getTargetFilePath (directory, locale, prefix) {
  return `${directory}/${locale}/${prefix}messages.js`
}

function _getJsonFilePath (directory, locale, prefix) {
  let jsonFile = `${directory}/${locale}/${prefix}messages.json`
  if (fs.existsSync(jsonFile) === false) {
    throw new Error(`file missing: ${jsonFile}`)
  }
  return jsonFile
}

function createMinimalCatalog (complexCatalog) {
  return Object.keys(complexCatalog).reduce((final, key) =>
    Object.assign(final, { [key]: complexCatalog[key].translation }), {})
}

function writeCatalogs (complex, minimal, directory, locale) {
  const targetComplexFile = `${directory}/${locale}/messages.json`
  const targetMinimalFile = `${directory}/${locale}/minimal.messages.json`

  fs.writeFileSync(targetComplexFile, JSON.stringify(complex, null, 2))
  fs.writeFileSync(targetMinimalFile, JSON.stringify(minimal, null, 2))
}

commander.parse(process.argv)
