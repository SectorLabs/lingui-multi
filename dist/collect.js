const { extractFromFile } = require('./extract');
const fs = require('fs');
const path = require('path');

const _mergeCatalogs = (a, b) => {
    const c = {};

    [a, b].forEach(catalog => {
        Object.entries(catalog).forEach(([str, options]) => {
            if (c[str]) {
                c[str].origin.push(...options.origin);
            } else {
                c[str] = {
                    translation: '',
                    origin: [...options.origin],
                };
            }
        });
    });

    return c;
};

const collectFromFiles = (srcPaths, ignore = []) => {
  const ignorePattern = ignore.length ? new RegExp(ignore.join("|"), "i") : null
  let translatableStrings = {};

  srcPaths.forEach(srcFilename => {
    if (
      !fs.existsSync(srcFilename) ||
      (ignorePattern && ignorePattern.test(srcFilename))
    )
      return

    if (fs.statSync(srcFilename).isDirectory()) {
      const subdirs = fs
        .readdirSync(srcFilename)
        .map(filename => path.join(srcFilename, filename))

      translatableStrings = _mergeCatalogs(translatableStrings, collectFromFiles(subdirs, ignore));
        return
    }

  if (!srcFilename.endsWith('.ts') && !srcFilename.endsWith('.tsx')) {
      return;
  }

    extractFromFile(srcFilename).forEach(str => {
        if (!translatableStrings[str]) {
            translatableStrings[str] = {
                translation: "",
                origin: [
                    [srcFilename, 0],
                ],
            };
        } else {
            translatableStrings[str].origin.push([srcFilename, 0]);
        }
    });
  });

    return translatableStrings;
};

module.exports = { collectFromFiles };
