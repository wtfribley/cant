/**
 *  cant - ErrorFactory 
 *  @license MIT
 */

var EOL = require('os').EOL;
var fs = require('fs');
var tty = require('tty');
var net = require('net');
var nstream = require('stream');
var util = require('util');

/**
 *  ErrorFactory
 *  ============
 *
 *  The ErrorFactory generates custom CantErrors using a pretty, semantic API of
 *  chained method calls.
 *
 *  ```js
 *
 *  var errorFactory = new ErrorFactory();
 *  
 *  var CustomError = errorFactory.cant('do %s action')
 *    .because('%s went wrong')
 *    .http(501)
 *    .level('error')
 *    .stream(fs.createWriteStream('/var/log/errors'))
 *    .create();
 *
 *  // later
 *
 *  throw new CustomError('this', 'that');
 *  
 *  ```
 *
 *  @constructor
 */
var ErrorFactory = function() {
  
  /**
   *  The name of the generated CantError.
   *  @private
   *  @type {string}
   */
  this._name = 'Error';

  /**
   *  A format string (see `util.format`) for creating the "Cant x" clause.
   *  @private
   *  @type {string}
   */
  this._cant = '';

  /**
   *  A format string (see `util.format`) for creating the "because y" clause.
   *  @private
   *  @type {string}
   */
  this._because = '';

  /**
   *  An optional HTTP status code (e.g. 404 or 500).
   *  @private
   *  @type {number}
   */
  this._http = null;

  /**
   *  A short, descriptive string indicating the severity of the error.
   *  @private
   *  @type {string}
   */
  this._level = null;

  /**
   *  A writable stream to which to log the error.
   *  @private
   *  @type {stream}
   */
  this._stream = process.stderr;
};

/**
 *  ErrorFactory.validateStreams
 *  ===========================
 *
 *  Use this static method to validate a variable as a writable stream.
 *
 *  A string my also be provided, in which case it's used as a file path and
 *  converted to a stream via fs.createWriteStream.
 *
 *  @static
 *  @param {stream|Array|string} stream - A stream to validate (or string to use
 *  with fs.createWriteStream).
 *  @returns {stream|Array} Returns a writable stream or an array of such.
 *  @throws Will throw a TypeError if an incorrectly-typed argument is
 *  encountered.
 */
ErrorFactory.validateStreams = function validateStreams(stream) {
  var typeofStream = typeof stream;

  if (stream instanceof nstream.Writable) return stream;
  if (stream instanceof tty.WriteStream) return stream;
  if (stream instanceof net.Socket) return stream;
  if (typeofStream == 'string') return fs.createWriteStream(stream);

  if (Array.isArray(stream)) return stream.map(ErrorFactory.validateStreams);

  throw new TypeError(
    'Can\'t validate stream because ' +
    stream + ' must be a stream or string (' +
    typeofStream + ' given)'
  );
}

/** @method */
ErrorFactory.prototype.name = function name(string) {
  this._name = string;
  return this;
};

/**
 *  ErrorFactory#cant
 *  =================
 *
 *  Provide a format string for the "Cant x" clause.
 *
 *  This string will be used by Node's `util.format` to construct the final
 *  "Cant" clause of the error.
 *
 *  @method
 *  @param {string} format
 *  @returns {ErrorFactory}
 */
ErrorFactory.prototype.cant = function cant(format) {
  this._cant = format;
  return this;
};

/**
 *  ErrorFactory#because
 *  ====================
 *
 *  Provide a format string (as in ErrorFactory#cant), OR the Error constructor
 *  for the "because y" clause.
 *
 *  Passing `Error` allows for combining error messages.
 *
 *  ```js
 *
 *  var SpecificActionError = (new ErrorFactory())
 *    .cant('do a specific action')
 *    .because(Error)
 *    .create();
 *
 *  var SpecificReasonError = (new ErrorFactory())
 *    .cant('do a generic action')
 *    .because('a specific thing went wrong')
 *    .create();
 *
 *  throw new SpecificActionError(new SpecificReasonError());
 *
 *  ```
 *
 *  Here you can see how this enables a combination of two kinds of errors -
 *  those that are specific about the desired action that cannot be performed,
 *  and those that are specific about the reason for the error.
 *
 *  This can be helpful in a typical application, where information about the
 *  desired action and the root cause of an error may not be available in the
 *  same location.
 *
 *  @method
 *  @param {string} format
 *  @returns {ErrorFactory}
 */
ErrorFactory.prototype.because = function because(format) {
  if (format === Error) {
    format = '%s';
    this._becauseIsError = true;
  }

  this._because = format;
  return this;
};

/** @method */
ErrorFactory.prototype.http = function http(status) {
  this._http = status;
  return this;
};

/** @method */
ErrorFactory.prototype.level = function level(severity) {
  this._level = severity;
  return this;
};

/**
 *  ErrorFactory#streams
 *  ====================
 *
 *  Add a writable stream (or an array of such), allowing the generated error to
 *  log to a custom location.
 *
 *  Uses the {@link ErrorFactory.validateStreams} static method to validate the
 *  argument as a writable stream, a string (which will be converted to a
 *  stream), or an Array of either.
 *
 *  This method also ensures that an Array is stored ErrorFactory#._streams, so
 *  the error's log function can be made simpler.
 *
 *  @method
 *  @see ErrorFactory.validateStreams
 *  @param {stream|string|Array} writableStreams
 *  @returns {ErrorFactory}
 */
ErrorFactory.prototype.streams = function streams(writableStreams) {
  this._streams = ErrorFactory.validateStreams(writableStreams);
  if (!Array.isArray(this._streams)) this._streams = [this._streams];
  return this;
};

/**
 *  ErrorFactory#create
 *  ===================
 *
 *  Creates a new custom CantError.
 *
 *  Call this method **last**, after defining your custom error using the
 *  ErrorFactory API.
 *
 *  @method
 *  @return {CantError}
 */
ErrorFactory.prototype.create = function() {
  var error = this;

  // match valid `util.format` placeholders, counting the number of placeholders
  // in the format strings for the "Cant" and "because" clauses.
  var cantArgc = this._countPlaceholders(error._cant);
  var becauseArgc = this._countPlaceholders(error._because);
  var argc = cantArgc + becauseArgc;

  /**
   *  CantError
   *  =========
   *
   *  Each ErrorFactory generates a unique CantError constructor, used to throw
   *  (or otherwise instantiate) new custom errors.
   *
   *  The CantError accepts arguments which will be used to format a message
   *  given the ErrorFactory's "Cant" and "because" format strings, using
   *  Node's `util.format`.
   *
   *  Unlike plain `util.format`, extra arguments will be ignored. Omitted
   *  arguments will be replaced with an empty string.
   *
   *  @constructor
   *  @param {*}
   */
  var CantError = function() {
    if (Error.captureStackTrace) Error.captureStackTrace(this, CantError);

    var argv = Array.prototype.slice.call(arguments);
    var k = argv.length;

    // fill missing arguments with an empty string.
    if (k < argc) {
      while (k < argc) {
        argv[k] = '';
        k++;
      }
    }

    var cantArgv = argv.slice(0, cantArgc);
    var becauseArgv = argv.slice(cantArgc, argc);

    // this allows "chaining" of errors, with the deepest error's "because"
    // clause bubbling up to the top error - along with its level and status.
    if (error._becauseIsError) {
      var becauseError = becauseArgv[0];

      if (becauseError.level) error._level = becauseError.level
      if (becauseError.status) error._http = becauseError.status;

      if (becauseError._isCantError === true) {
        becauseArgv[0] = becauseError.message.split('because ')[1];
      }
      else if (becauseError.message) {
        becauseArgv[0] = becauseError.message;
      }
    }
    
    if (error._level) this.level = error._level;
    if (error._http) this.status = error._http;

    // unshift the format strings, preparing the Argv arrays for `util.format`.
    cantArgv.unshift(error._cant);
    becauseArgv.unshift(error._because);

    this.message = 'Can\'t ' +
      util.format.apply(null, cantArgv) +
      ' because ' +
      util.format.apply(null, becauseArgv);
    
    // remove extra whitespace.
    this.message = this.message.trim();
    this.message = this.message.replace(/[\s\xA0]+/g, ' ');
  };

  CantError.prototype = Object.create(Error.prototype, {
    constructor: {value: CantError}
  });

  CantError.prototype._isCantError = true;

  CantError.prototype.name = error._name;

  /**
   *  CantError#log
   *  =============
   *
   *  Using the stream(s) configured in the ErrorFactory, write out JSON string
   *  log entry.
   *
   *  @method
   *  @param {boolean} stack - Add the error's stack trace to logged output.
   */
  CantError.prototype.log = function log(stack) {
    var info = {
      level: this.level,
      status: this.status,
      message: this.message,
      date: new Date()
    };

    if (stack && this.stack) info.stack = this.stack;

    error._streams.forEach(function(stream) {
      stream.write(JSON.stringify(info, null, '') + EOL);
    });
  };

  return CantError;
};

/**
 *  ErrorFactory#_countPlaceholders
 *  ===============================
 *
 *  Count the number of valid `util.format` placeholder substrings exist in the
 *  given format string.
 *
 *  @private
 *  @param {string} format
 */
ErrorFactory.prototype
._countPlaceholders = function _countPlaceholders(format) {
  var formatRE = /%[sdj]/g;
  var matches = format.match(formatRE);
  return matches === null ? 0 : matches.length;
};

module.exports = ErrorFactory;
