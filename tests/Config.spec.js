'use strict'

const Program = require('../dist/lingui-multi')
const expect = require('chai').expect

describe('Configuration', () => {
  describe('loadPackageConfig', () => {
    it('should export a function', () => {
      expect(Program.loadPackageConfig).to.be.a('Function')
    })

    it('should read test configuration', () => {
      const loadedConfig = Program.loadPackageConfig('./tests/resources/package.json')

      expect(loadedConfig).to.be.an.instanceOf(Object)
      expect(loadedConfig.lingui).to.be.an.instanceOf(Object)
      expect(loadedConfig['lingui-multi']).to.be.an.instanceOf(Object)
      expect(loadedConfig['lingui-multi']['sub-catalog']).to.be.an.instanceOf(Object)
      expect(loadedConfig['lingui-multi']['sub-catalog'].srcPathIgnorePatterns).to.be.an.instanceOf(Array)
    })

    it('should throw error on nonexistent file', () => {
      expect(() => Program.loadPackageConfig('./tests/resources/non-existent-package.json')).to.throw('package.json does not exist')
    })

    it('should throw error on malformed file', () => {
      expect(() => Program.loadPackageConfig('./tests/resources/src/test-code.jsx')).to.throw('package.json is not a valid JSON file')
    })
  })

  describe('validatePackageConfig', () => {
    it('should export a function', () => {
      expect(Program.validatePackageConfig).to.be.a('Function')
    })

    it('should validate test configuration', () => {
      const loadedConfig = Program.loadPackageConfig('./tests/resources/package.json')
      expect(() => Program.validatePackageConfig(loadedConfig)).to.not.throw()
    })

    it('should throw error on invalid configuration', () => {
      expect(() => Program.validatePackageConfig({})).to.throw('no lingui config found')
      expect(() => Program.validatePackageConfig({ lingui: {} })).to.throw('no source locale in lingui config')
      expect(() => Program.validatePackageConfig({ lingui: { sourceLocale: 'en' } })).to.throw('no lingui-multi config found')
      expect(() => Program.validatePackageConfig({ lingui: { sourceLocale: 'en' }, 'lingui-multi': [] })).to.throw('no lingui-multi sub-catalog config found')
    })

    it('should throw error on malformed file', () => {
      expect(() => Program.loadPackageConfig('./tests/resources/src/test-code.jsx')).to.throw('package.json is not a valid JSON file')
    })
  })
})
