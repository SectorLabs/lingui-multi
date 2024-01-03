const swc = require('@swc/core')
const { Visitor } = require('@swc/core/Visitor')
const { omit } = require('lodash');
const {
    parseCallPlurals,
    parseTextFromJSXElement,
    parseJSXPlurals,
    parseTextFromTemplateLiteral,
} = require('./parser');

// replace whitespace before/after newline with single space
const nlRe = /\s*(?:\r\n|\r|\n)+\s*/g
// remove whitespace before/after tag
const nlTagRe = /(?:(>)(?:\r\n|\r|\n)+\s+|(?:\r\n|\r|\n)+\s+(?=<))/g

class ExtractVisitor extends Visitor {
    constructor() {
        super();

        this.localTransComponentName = 'Trans';
        this.localSelectOrdinalImportName = 'SelectOrdinal';
        this.localPluralImportName = 'Plural';
        this.translatableStrings = {};
        this.visitedStrings = {};
    }

    visitTaggedTemplateExpression(n) {
        const expr = super.visitTaggedTemplateExpression(n);
        if (expr.tag.object.type !== 'Identifier' || expr.tag.object.value !== 'i18n') {
            return expr;
        }

        const str = this.cleanText(parseTextFromTemplateLiteral(expr.template));
        this.translatableStrings[str.trim()] = true;
        return expr;
    }

    visitTsType(n) {
    }

    visitImportDeclaration(node) {
        const moduleName = node.source.value
        if ("@lingui/react" !== moduleName) return

        const importDeclarations = {}
          node.specifiers.forEach((specifier) => {
              if(specifier.imported && specifier.imported.value) {
                  importDeclarations[specifier.imported.value] =
                      specifier.local.value
              }
          })

          this.localTransComponentName = importDeclarations["Trans"] || "Trans";
          this.localSelectOrdinalImportName = importDeclarations["SelectOrdinal"] || "SelectOrdinal";
          this.localPluralImportName = importDeclarations["Plural"] || "Plural";
    }

    visitJSXElement(n) {
        const expr = super.visitJSXElement(n);
        if(expr.opening.name.value === this.localSelectOrdinalImportName || expr.opening.name.value === this.localPluralImportName) {
            const str = this.cleanText(parseJSXPlurals(expr, { index: 0, localTransComponentName: this.localTransComponentName, visitedStrings: this.visitedStrings }));
            if(str) {
                this.translatableStrings[str] = true;
            }
        }  else if (expr.opening.name.value === this.localTransComponentName) {
            const str = this.cleanText(parseTextFromJSXElement(expr, { elementIndex: 0, unknownIndex: 0, localTransComponentName: this.localTransComponentName, visitedStrings: this.visitedStrings }));
            if(str) {
                this.translatableStrings[str] = true;
            }
        }

        return expr;
    }

    visitCallExpression(n) {
        const expr = super.visitCallExpression(n);
        if(!expr.callee.object || !expr.callee.property){
            return expr;
        }
        if(expr.callee.object.type !== 'Identifier' || expr.callee.object.value !== 'i18n' || expr.callee.property.value !== 'plural'){
            return expr;
        }
        const str = this.cleanText(parseCallPlurals(expr));
        this.translatableStrings[str] = true;
        return expr;
    }

    getCleanedStrings() {
        return Object.keys(omit(this.translatableStrings, Object.keys(this.visitedStrings)));
    }

    cleanText(value) {
        return value.replace(nlTagRe, "$1").replace(nlRe, " ").trim();
    }
}

const extractFromFile = (filename) =>  {
    const module = swc
      .parseFileSync(filename, {
        syntax: "typescript", // "ecmascript" | "typescript"
        comments: false,
        script: true,
        tsx: true,

        // Defaults to es3
        target: "es5",
        // Input source code are treated as module by default
        isModule: true,
      });

    const visitor = new ExtractVisitor();
    visitor.visitProgram(module);

    return visitor.getCleanedStrings();
};

module.exports = { extractFromFile };
