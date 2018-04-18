'use strict'

const Program = require('../dist/lingui-multi')
const expect = require('chai').expect

describe('Catalog', () => {
  describe('_loadCatalog', () => {
    it('should export a function', () => {
      expect(Program._loadCatalog).to.be.a('Function')
    })

    it('should read lingui catalog file', () => {
      const loadedCatalog = Program._loadCatalog('./tests/resources/locale', 'en')
      verifyLinguiCatalog(loadedCatalog)
    })

    it('should read minimal catalog file', () => {
      const loadedCatalog = Program._loadCatalog('./tests/resources/locale', 'en', 'minimal.')
      verifyMinimalCatalog(loadedCatalog)
    })
  })

  describe('loadLinguiCatalog', () => {
    it('should export a function', () => {
      expect(Program.loadLinguiCatalog).to.be.a('Function')
    })

    it('should read lingui catalog file', () => {
      const loadedCatalog = Program.loadLinguiCatalog('./tests/resources/locale', 'en')
      verifyLinguiCatalog(loadedCatalog)
    })
  })

  describe('loadMinimalCatalog', () => {
    it('should export a function', () => {
      expect(Program.loadMinimalCatalog).to.be.a('Function')
    })

    it('should read minimal catalog file', () => {
      const loadedCatalog = Program.loadMinimalCatalog('./tests/resources/locale', 'en')
      verifyMinimalCatalog(loadedCatalog)
    })
  })

  describe('verifyNoMissingTranslations', () => {
    it('should export a function', () => {
      expect(Program.verifyNoMissingTranslations).to.be.a('Function')
    })

    it('should verify no missing translations', () => {
      expect(() => Program.verifyNoMissingTranslations({ 'key': 'translation' }, 'en')).to.not.throw()
    })

    it('should throw missing translation error', () => {
      expect(() => Program.verifyNoMissingTranslations({'key': ''}, 'en')).to.throw('Missing 1 translations in en')
    })
  })

  describe('createMinimalCatalog', () => {
    it('should export a function', () => {
      expect(Program.createMinimalCatalog).to.be.a('Function')
    })

    it('should create minimal catalog from lingui catalog', () => {
      const linguiCatalog = Program.loadLinguiCatalog('./tests/resources/locale', 'en')
      verifyLinguiCatalog(linguiCatalog)

      const minimalCatalog = Program.createMinimalCatalog(linguiCatalog)
      verifyMinimalCatalog(minimalCatalog)
    })
  })
})

function verifyLinguiCatalog (catalog) {
  expect(catalog).to.be.an.instanceOf(Object)
  expect(catalog['Test Heading']).to.be.an.instanceOf(Object)
  expect(catalog['Test Paragraph']).to.be.an.instanceOf(Object)
  expect(catalog['Test Excluded Heading']).to.be.an.instanceOf(Object)
  expect(catalog['Test Excluded Paragraph']).to.be.an.instanceOf(Object)
}

function verifyMinimalCatalog (catalog) {
  expect(catalog).to.be.an.instanceOf(Object)
  expect(catalog['Test Heading']).to.be.a('String')
  expect(catalog['Test Paragraph']).to.be.a('String')
  expect(catalog['Test Excluded Heading']).to.be.a('String')
  expect(catalog['Test Excluded Paragraph']).to.be.a('String')
}
