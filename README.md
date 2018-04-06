# Lingui Multi
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

Each sub-catalog will include all the i18n translations used in the source paths defined for lingui in the package.json file minus the ignore patterns defined either in the lingui configuration or the lingui-multi sub-catalog configuration.

# Usage
You can run the utility by executing the command provided by the package like so:
```shell
lingui-multi <path-to-application-package.json> <path-to-locale-directory>
```

The utility will pick up lingui configuration and lingui-multi configuration from the package.json file and spit out catalog files in the locale directory with the format `<sub_catalog>.messages.js` for each sub-catalog.

