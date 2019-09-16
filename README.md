# Lingui Multi
[![CircleCI](https://circleci.com/gh/SectorLabs/lingui-multi/tree/master.svg?style=svg)](https://circleci.com/gh/SectorLabs/lingui-multi/tree/master)

This is a command line utility for generating multiple catalog files from a single (unified) messages JSON file using [js-lingui cli api](https://www.npmjs.com/package/@lingui/cli). Please ensure your application uses js-lingui before attempting to use this utility.

# Setup
Add the following to your project's package.json file:
```json
 "lingui-multi": {
    "sub_catalog_name": {
        "srcPathIgnorePatterns": [
            "<ignore_folder>",
            "<ignore_folder_2>"
            ...
        ]
    },
    "sub_catalog_2_name": {
        "srcPathIgnorePatterns": [
            "<ignore_folder_3>",
            "<ignore_folder_4>"
            ...
        ]
    }
 }
```

Each sub-catalog will include all the i18n translations used in the source paths defined for lingui in the package.json file minus the ignore patterns defined either in the lingui configuration, the lingui-multi sub-catalog configuration or in the environment variable named `LINGUI_MULTI_IGNORE_PATTERNS` (regular expression string, for example `"ignore_folder_2|ignore_folder_3"`).


**Note: Lingui multi requires your existing messages.json file to be in `minimal` format. If it is in any other format please convert to the minimal format before using this utility**

# Usage
You can extract new translations and metadata by executing the command provided by the package like so:
```shell
$ lingui-multi extract [path-to-application-package.json] [path-to-locale-directory]
```

The extract command will extract new messages/translations to your messages.json file as well as create a messages.metadata.json file that is used in translation include/exclude logic during the sub-catalog assembly in the compile command.

Sub-catalog compilation can be done by executing:
```shell
$ lingui-multi compile [path-to-application-package.json] [path-to-locale-directory]
```

The compile command uses messages.metadata.json file to figure out which translations to include/exclude from messages.json file based on the different sub-catalog configurations.

**Please do not edit the messages.metadata.json file manually. All your changes/additions to the translations must only be done in messages.json file. No changes or translations from messages.metadata.json file is carried over to the compiled JS catalogs.**

The default value for package.json path is: `./package.json`

The default value for locales directory is: `./locale`

The utility will pick up lingui configuration and lingui-multi configuration from the package.json file and spit out catalog files in the locale directory with the format `<sub_catalog>.messages.js` for each sub-catalog and a `messages.js` catalog with all translations excluding only those that are defined in the `lingui` settings in `package.json` file of the application.
