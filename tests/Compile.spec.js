'use strict'

const exec = require('child_process').exec;

const chai = require('chai');
const tmp = require('tmp');
const path = require('path');
const fs = require('fs');
const expect = chai.expect;

const lingui = './dist/lingui-multi.js';
const linguiCompile = './dist/lingui-multi.js compile';

// Creates a temporary folder to store the compiled catalogs, autoremoved at the the process exit.
const createResultsFolder = () => {
    const tmpFolder = tmp.dirSync({
        unsafeCleanup: true,
    });

    fs.mkdirSync(path.join(tmpFolder.name, 'ar'));
    fs.mkdirSync(path.join(tmpFolder.name, 'en'));

    return tmpFolder;
}

describe('lingui-multi cli', () => {
    it('shows a help text, when --help is provided', (done) => {
        exec([lingui, '--help'].join(' '), function(error, stdout, stderr) {
            expect(error).to.be.null;
            expect(stdout).to.contain('Usage: lingui-multi [options] [command]');
            expect(stdout).to.contain('compile');
            expect(stdout).to.contain('extract');
            done();
        });
    });

    describe('Compile', () => {
        it('shows a help text, when --help is provided', (done) => {
            exec([linguiCompile, '--help'].join(' '), function(error, stdout, stderr) {
                expect(error).to.be.null;
                expect(stdout).to.contain('Usage: compile [options] [packageFile] [localesFolder]');
                expect(stdout).to.contain('--removeIdentityPairs');
                expect(stdout).to.contain('--targetFolder');
                expect(stdout).to.contain('--strict');
                done();
            });
        });

        it('creates valid compiled catalogs', (done) => {
            const tmpFolder = createResultsFolder();

            exec([
                    linguiCompile,
                    `--targetFolder=${tmpFolder.name}`,
                    './tests/resources/package.json',
                    './tests/resources/locale',
                ].join(' '),
            function(error, stdout, stderr) {
                expect(error).to.be.null;

                const catalogEn = require(path.join(`${tmpFolder.name}`, 'en/messages.js'));
                const catalogAr = require(path.join(`${tmpFolder.name}`, 'ar/messages.js'));
                const subCatalogEn = require(path.join(`${tmpFolder.name}`, 'en/sub-catalog.messages.js'));
                const subCatalogAr = require(path.join(`${tmpFolder.name}`, 'ar/sub-catalog.messages.js'));

                expect(catalogEn.messages).to.eql({
                    'Test Heading': 'Test Heading',
                    'Test Paragraph': 'Test Paragraph',
                    'Test Excluded Heading': 'Test Excluded Heading',
                    'Test Excluded Paragraph': 'Test Excluded Paragraph'
                });

                expect(subCatalogEn.messages).to.eql({
                    'Test Heading': 'Test Heading',
                    'Test Paragraph': 'Test Paragraph',
                });

                expect(catalogAr.messages).to.eql({
                    'Test Heading': 'Arabic Test Heading',
                    'Test Paragraph': 'Arabic Test Paragraph',
                    'Test Excluded Heading': 'Arabic Test Excluded Heading',
                    'Test Excluded Paragraph': 'Arabic Test Excluded Paragraph'
                });

                expect(subCatalogAr.messages).to.eql({
                    'Test Heading': 'Arabic Test Heading',
                    'Test Paragraph': 'Arabic Test Paragraph',
                });

                done();
            });
        });

        it('creates valid, smaller compiled catalogs with --removeIdentityPairs', (done) => {
            const tmpFolder = createResultsFolder();

            exec([
                    linguiCompile,
                    `--targetFolder=${tmpFolder.name}`,
                    '--removeIdentityPairs',
                    './tests/resources/package.json',
                    './tests/resources/locale',
                ].join(' '),
            function(error, stdout, stderr) {
                expect(error).to.be.null;

                const catalogEn = require(path.join(`${tmpFolder.name}`, 'en/messages.js'));
                const catalogAr = require(path.join(`${tmpFolder.name}`, 'ar/messages.js'));

                expect(catalogEn.messages).to.eql({});

                expect(catalogAr.messages).to.eql({
                    'Test Heading': 'Arabic Test Heading',
                    'Test Paragraph': 'Arabic Test Paragraph',
                    'Test Excluded Heading': 'Arabic Test Excluded Heading',
                    'Test Excluded Paragraph': 'Arabic Test Excluded Paragraph'
                });

                done();
            });
        });

        it('takes LINGUI_MULTI_IGNORE_PATTERNS into account when creating the catalogs', (done) => {
            const tmpFolder = createResultsFolder();
            process.env.LINGUI_MULTI_IGNORE_PATTERNS = 'test-code-excluded.jsx';

            exec([
                    linguiCompile,
                    `--targetFolder=${tmpFolder.name}`,
                    './tests/resources/package.json',
                    './tests/resources/locale',
                ].join(' '),
            function(error, stdout, stderr) {
                expect(error).to.be.null;

                const catalogEn = require(path.join(`${tmpFolder.name}`, 'en/messages.js'));
                const catalogAr = require(path.join(`${tmpFolder.name}`, 'ar/messages.js'));

                expect(catalogEn.messages).to.eql({
                    'Test Heading': 'Test Heading',
                    'Test Paragraph': 'Test Paragraph',
                });

                expect(catalogAr.messages).to.eql({
                    'Test Heading': 'Arabic Test Heading',
                    'Test Paragraph': 'Arabic Test Paragraph',
                });

                process.env.LINGUI_MULTI_IGNORE_PATTERNS = undefined;
                done();
            });
        });
    });
});
