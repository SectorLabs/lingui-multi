const swc = require('@swc/core')
const { Visitor } = require('@swc/core/Visitor')

class MyVisitor extends Visitor {
    constructor() {
        super();

        this.translatableStrings = [];
    }

    visitTaggedTemplateExpression(n) {
        const expr = super.visitTaggedTemplateExpression(n);
        if (expr.tag.object.type !== 'Identifier' || expr.tag.object.value !== 'i18n') {
            return expr;
        }

        const str = this.parseTextFromTemplateLiteral(expr.template);
        this.translatableStrings.push(str.replace('  ', ' ').trim());
        return expr;
    }

    visitTsType(n) {
    }

    cleanIdentifier(value) {
        if (value.startsWith('min') || value.startsWith('max')) {
            return `_${value}`;
        }

        return value;
    }

    visitJSXElement(n) {
        const expr = super.visitJSXElement(n);
        if (expr.opening.name.value !== 'T') {
            return expr;
        }

        const str = this.parseTextFromJSXElement(expr, { elementIndex: 0, unknownIndex: 0 });
        this.translatableStrings.push(str.replace('  ', ' ').trim());

        return expr;
    }

    cleanText(value) {
        const result = value.replace('\r', '').replace('\n', '').replace(/\s+/g, ' ');
        return result;
    }

    parseTextFromTemplateLiteral(expr) {
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
                str += `{${this.cleanIdentifier(element.value)}}`;
            } else if (element.type === 'TemplateElement') {
                str += element.raw;
            } else {
                str += `{${unknownParamIndex}}`;
                unknownParamIndex++;
            }
        });

        return str;
    }

    parseTextFromJSXElement(element, context = { elementIndex: 0, unknownIndex: 0 }, isRoot = true) {
        let str = "";

        if (element.type === 'JSXText') {
            const value = this.cleanText(element.value);
            if (value) {
                str += value;
            }
        } else if (element.type === 'JSXElement') {
            const elementIndex = context.elementIndex;

            if (element.opening && !isRoot) {
                if (!element.closing) {
                    str += `<${elementIndex}/>`;
                } else {
                    str += `<${elementIndex}>`;
                }
                context.elementIndex++;
            }

            if (element.children) {
                element.children.forEach(child => {
                    str += this.parseTextFromJSXElement(child, context, false);
                });
            }

            if (element.closing && !isRoot) {
                str += `</${elementIndex}>`;
                if (!element.opening) {
                    context.elementIndex++;
                }
            }
        } else if (element.type === 'JSXExpressionContainer') {
            if (element.expression.type === 'Identifier') {
                str += `{${this.cleanIdentifier(element.expression.value)}}`;
            } else if (element.expression.type === 'StringLiteral') {
                str += element.expression.value;
            } else if (element.expression.type === 'TemplateLiteral') {
                str += this.parseTextFromTemplateLiteral(element.expression);
            } else {
                str += `{${context.unknownIndex}}`;
                context.unknownIndex++;
            }
        } else {
            console.log("OH NEE 2", element);
        }

        return str;
    }
}

// const filename = "strat/searchHistory/renderSubtitle.ts";
// const filename = "dubizzle-lb/dubizzle-lb/adDetails/components/requestDeliveryDescription.tsx";
// const filename = "horizontal/horizontal/adManagement/analytics.tsx";
// const filename = "horizontal/horizontal/payment/providerCashPayment/providerCashPaymentBody.tsx";
// const filename = "explorer/explorer/leaderboard/activity/activityTypeData.tsx";
// const filename = "strat/reporting/adPerformance/adImpressionsChart.tsx";
//
const fileList = [
    "strat/strat/searchHistory/renderSubtitle.ts",
    "dubizzle-lb/dubizzle-lb/adDetails/components/requestDeliveryDescription.tsx",
    "horizontal/horizontal/adManagement/analytics.tsx",
    "horizontal/horizontal/payment/providerCashPayment/providerCashPaymentBody.tsx",
    "explorer/explorer/leaderboard/activity/activityTypeData.tsx",
    "strat/strat/reporting/adPerformance/adImpressionsChart.tsx",
];

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

  const visitor = new MyVisitor();
  visitor.visitProgram(module);

    return visitor.translatableStrings;
};

module.exports = { extractFromFile };

// console.log(extractFromFile('horizontal/horizontal/savedSearches/savedSearchesCardFilters.tsx'));
