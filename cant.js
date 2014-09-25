/**
 *  cant - errors and logging in the form "Can't x because y"
 *  @version v0.1.0
 *  @author Weston Fribley <me@westonfribley.com> (http://westonfribley.com)
 *  @license MIT
 */

var fs = require('fs');
var nstream = require('stream');
var tty = require('tty');
var ErrorFactory = require('./lib/ErrorFactory');

/**
 *  Cant
 *  ====
 *
 *  Passing a string creates a new ErrorFactory, using that string as the
 *  argument to {@link ErrorFactory#cant} -- this sets the generated error's
 *  "Can't" format string.
 *
 *  The ErrorFactory is returned, so the rest of the error can be constructed.
 *
 *  ```js
 *
 *  var Cant = require('cant');
 *
 *  var DBUsernameError = Cant('access the %s database')
 *    .because('the username %s isn\'t valid')
 *    .name('DBUsernameError')
 *    .create();
 *
 *  // later
 *
 *  throw new DBUsernameError('production', username);
 *
 *  ```
 *
 *  @see {@link ErrorFactory} for more on its API.
 *  @param {string} format Format string passed to ErrorFactory#cant
 *  @returns {ErrorFactory}
 */
var Cant = function Cant(format) {
  var factory = new ErrorFactory();
  return factory.cant(format);
};

/**
 *  Cant.errors
 *  ===========
 *
 *  This is a convenient way to define a list of errors all at once. Pass an
 *  object, where each property is an ErrorFactory instance. Use the object's
 *  properties to name each error.
 *
 *  ```js
 *
 *  var errors = Cant.errors({
 *    DBUsernameError: Cant('access the %s database')
 *      .because('the username %s isn\'t valid'),
 *
 *    DBPasswordError: Cant('access the %s database')
 *      .because('that password isn\'t valid')
 *  });
 *
 *  ```
 *
 *  In this case, cant takes care of setting the error's name and calling
 *  {@link ErrorFactory#create}.
 *
 *  **Cant** is designed to be used this way, generating all the custom errors
 *  needed in your app in a single module. Any other modules that need to throw
 *  errors can simply `require` your error module.
 *
 *  ```js
 *
 *  // errors.js
 *
 *  module.exports = Cant.errors({
 *    DBUsernameError: Cant('access the %s database')
 *      .because('the username %s isn\'t valid'),
 *
 *    DBPasswordError: Cant('access the %s database')
 *      .because('that password isn\'t valid')
 *  });
 *
 *  // database.js
 *
 *  var errors = require('errors');
 *  var dbName = 'myDatabase';
 *
 *  db.connect(dbName, username, password, function(err) {
 *    if (err.code = 'BADUSERNAME') {
 *      throw new errors.DBUsernameError(dbName, username);
 *    }
 *    if (err.code = 'BADPASSWORD') {
 *      throw new errors.DBPasswordError(dbName);
 *    }
 *  });
 *
 *  ```
 *
 *  @param {Object} obj Properties are ErrorFactory instances, property names
 *  name their respective errors.
 *
 *  @returns {Object} ErrorFactory instances are replaced by actual CantErrors.
 */
Cant.errors = function errors(obj) {
  var name;
  var factory;
  var severity;
  var streamMap = Cant._streamMap || {};

  for (name in obj) {
    factory = obj[name].name(name);
    severity = factory._level;

    // map the error's severity level to a stream, as defined by `Cant#streams`.
    if (severity && streamMap[severity]) {
      factory._stream = streamMap[severity];
    }

    obj[name] = factory.create();
  }

  return obj;
};

/**
 *  Cant.streams
 *  ============
 *
 *  Set up a mapping between error severity and an output stream.
 *
 *  Severity can be indicated by a short descriptive string - most commonly,
 *  **info**, **warn** and **error**. The corresponding output stream should be
 *  an instance of Node's stream.Writable or tty.WriteStream or a file path
 *  string used for `fs.createWriteStream` - OR an Array containing streams
 *  and/or strings.
 *
 *  After calling this method, a call to Cant.errors will lookup an output
 *  stream for each ErrorFactory instance, using the error's severity level to
 *  match against the mapping set up here.
 *
 *  Therefore, this method **must be called before** any calls to Cant.errors.
 *
 *  ```js
 *
 *  Cant.streams({
 *    'info': process.stdout,
 *    'warn': process.stdout,
 *    'error': [process.stderr, '/var/log/errors']
 *  });
 *
 *  var errors = Cant.errors({
 *    DBSaveError: Cant('save %s to database')
 *      .because('something happened')
 *      .level('error')
 *      .http(500)
 *  });
 *
 *  ```
 *
 *  The above `DBSaveError` would log its output to `stderr` and the file
 *  `/var/log/errors`, based on the mapping given to `Cant#streams`.
 *
 *
 *  @param {Object} map - mapping of severity level strings to
 *  output streams.
 *
 *  @throws Will throw an Error if an invalid stream is given.
 */
Cant.streams = function streams(map) {
  var stream;

  for (severity in map) {
    map[severity] = ErrorFactory.validateStreams(map[severity]);
  }

  Cant._streamMap = map;
};

// export ErrorFactory for public use.
Cant.ErrorFactory = ErrorFactory;

module.exports = Cant;
