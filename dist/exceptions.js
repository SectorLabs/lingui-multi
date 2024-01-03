class ValueArgumentErrorMissing extends Error {
    constructor (message) {
        super(message);
        this.name = "Value argument is missing";

        // capturing the stack trace keeps the reference to your error class
        Error.captureStackTrace(this, this.constructor);
      }
}

class InvalidPluralRule extends Error {
    constructor (message) {
        super(message)
        this.name = message

        // capturing the stack trace keeps the reference to your error class
        Error.captureStackTrace(this, this.constructor);
      }
}

class MissingFallbackArgument extends Error {
    constructor (message) {
        super(message)
        this.name = message

        // capturing the stack trace keeps the reference to your error class
        Error.captureStackTrace(this, this.constructor);
      }
}

module.exports = {
    ValueArgumentErrorMissing,
    InvalidPluralRule,
    MissingFallbackArgument
}