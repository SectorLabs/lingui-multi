const { omit } = require('lodash');
const {ValueArgumentErrorMissing, InvalidPluralRule, MissingFallbackArgument} = require("./exceptions");

const pluralRules = ["zero", "one", "two", "few", "many", "other"];
const commonProps = ["id", "className", "render"];

function parseCallPlurals(element, context = {index: 0}) {
    const choicesType = element.callee.property.value.toLowerCase();
    const args = element.arguments[0].expression.properties || [];
    const choices = {};

    for (const attr of args) {
        let name;
        if (attr.type !== 'KeyValueProperty') {
            name = attr.value;
        } else {
            name = attr.key.type === 'NumericLiteral' ? `=${attr.key.value}` : attr.key.value;
        }

        if (attr.type === 'Identifier') {
            choices[name] = attr.value;
        } else if (attr.type === 'KeyValueProperty') {
            choices[name] = parsePluralElement(attr.value, {}, context);
        }
    }
    return createPluralString(choices, choicesType)
}

function parseJSXPlurals(element, context = { index : 0 }) {
    const choicesType = element.opening.name.value.toLowerCase();
    const choices = {};
    let jsxContext = {elementIndex: 0, unknownIndex: 0, localTransComponentName: context.localTransComponentName, visitedStrings: context.visitedStrings};

    for (const attr of element.opening.attributes) {
        const {
          name: { value: name }
        } = attr

        if (!commonProps.includes(name)) {
            const exp = attr.value.type !== 'JSXExpressionContainer'
            ? attr.value
            : attr.value.expression;
          choices[name.replace("_", "=")] = parsePluralElement(exp, jsxContext, context);
        }
      }
    return createPluralString(choices, choicesType);
}

function createPluralString(choices, choicesType) {
    const value = choices["value"];
    const choicesKeys = Object.keys(omit(choices, 'value'));
    if (!value) {
        throw new ValueArgumentErrorMissing();
      }

      // 'other' choice is required
      if (!choicesKeys.length) {
        throw new MissingFallbackArgument(
          `Missing ${choicesType} choices. At least fallback argument 'other' is required.`
        )
      } else if (!choicesKeys.includes("other")) {
        throw new MissingFallbackArgument(
          `Missing fallback argument 'other'.`
        )
      }

    if (choicesType === "plural" || choicesType === "selectordinal") {
        choicesKeys.forEach(rule => {
          if (!pluralRules.includes(rule) && !/=\d+/.test(rule)) {
              throw new InvalidPluralRule(`Invalid plural rule '${rule}'. Must be ${pluralRules.join(
                ", "
              )} or exact number depending on your source language ('one' and 'other' for English).`);
          }
        })
    }

    const argument = choicesKeys
    .map(form => `${form} {${choices[form]}}`)
    .join(" ");

    return `{${value}, ${choicesType}, ${argument}}`;
}

function parsePluralElement(element, localJSXContext, context) {
      if(element.type === "Identifier" || element.type === "StringLiteral" || element.type === 'NumericLiteral') {
          return element.value.toString();
      } else if(element.type === "JSXElement") {
          return parseTextFromJSXElement(element, localJSXContext, false)
      } else if(element.type === "TemplateLiteral") {
          return parseTextFromTemplateLiteral(element);
      } else {
          return `${context.index ++}`;
      }
}

function parseTextFromJSXElement(element, context = { elementIndex: 0, unknownIndex: 0 }, isRoot = true) {
    let str = "";

    if (element.type === 'JSXText') {
        str += element.value;
    } else if (element.type === 'JSXElement') {
        const elementIndex = context.elementIndex;
        let shouldAddToVisited = false;

        if (element.opening && !isRoot) {
            if(element.opening.name.value === context.localTransComponentName ) {
                shouldAddToVisited = true;
            } else {
                if (!element.closing) {
                    str += `<${elementIndex}/>`;
                } else {
                    str += `<${elementIndex}>`;
                }
                context.elementIndex++;
            }
        }
        let localStr = '';
        if (element.children) {
            element.children.forEach(child => {
                localStr += parseTextFromJSXElement(child, context, false);
            });
        }
        if(shouldAddToVisited){
            context.visitedStrings[localStr] = true;
        }
        str += localStr;

        if (element.closing && !isRoot && element.opening.name.value !== context.localTransComponentName) {
            str += `</${elementIndex}>`;
            if (!element.opening) {
                context.elementIndex++;
            }
        }
    } else if (element.type === 'JSXExpressionContainer') {
        if (element.expression.type === 'Identifier') {
            str += `{${cleanIdentifier(element.expression.value)}}`;
        } else if (element.expression.type === 'StringLiteral') {
            str += element.expression.value;
        } else if (element.expression.type === 'TemplateLiteral') {
            str += parseTextFromTemplateLiteral(element.expression);
        } else if (element.expression.type === 'JSXElement') {
            str += parseTextFromJSXElement(element.expression, context, false);
        } else {
            str += `{${context.unknownIndex}}`;
            context.unknownIndex++;
        }
    } else {
        console.log("OH NEE 2", element);
    }

    return str;
}

function parseTextFromTemplateLiteral(expr) {
    const elements = [
        ...expr.expressions || [],
        ...expr.quasis || [],
    ].sort((a, b) => {
        if (a.span.start < b.span.start) {
            return -1;
        }

        if (a.span.start > b.span.start) {
            return 1;
        }

        return 0;
    });

    let str = "";
    let unknownParamIndex = 0;

    elements.forEach(element => {
        if (element.type === 'Identifier') {
            str += `{${cleanIdentifier(element.value)}}`;
        } else if (element.type === 'TemplateElement') {
            str += element.raw;
        } else {
            str += `{${unknownParamIndex}}`;
            unknownParamIndex++;
        }
    });

    return str;
}

function cleanIdentifier(value) {
    // I am not sure of the rules behind this( it seems that applies for some of the strings and for some, it doesn't
    // if (value.startsWith('min') || value.startsWith('max')) {
    //     return `_${value}`;
    // }

    return value;
}

module.exports = {
    parseCallPlurals,
    parseTextFromJSXElement,
    parseJSXPlurals,
    parseTextFromTemplateLiteral,
}