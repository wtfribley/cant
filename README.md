Literally Can't
===============

A [wise man](http://inessential.com/2014/05/05/error_messages) once said:

> Error messages should be of the form "Can't x because of y."

This package provides a clean API for creating errors with this format. These
custom errors can also be associated with a particular stream to alter logging
behavior based on severity.

    $ npm install cant


Like. Really. Literally Can't
-----------------------------

**Cant** is designed for you to create a whole bunch of custom errors, all in
one place, which you then use throughout your application.

```js

// errors.js

var Cant = require('cant');

var errors = Cant.errors({

  SheTotally: Cant('say %s to her').because('she\'s so %s')
    .streams(process.stderr),

  HeDidWhat: Cant('even believe %s').because('he is such a %s')

});

module.exports = errors;

// dosomethingcool.js

var errors = require('./errors');
var ughWhat = new errors.SheTotally('anything', 'stupid');

// now you can
ughWhat.log();

// or
throw ughWhat;

```

Error Levels and Streams
------------------------

Before creating your errors with `Cant.errors`, you can map severity levels to
output streams using `Cant.streams`

```js

Cant.streams({
  'info': process.stdout,
  'warn': [process.stdout, '/var/log/warn.log'],
  'error': '/var/log/error.log',
  'totes_ugh': process.stderr
});

```

Severity levels are arbitrary (but "info", "warn" and "error" are pretty
standard). Each level maps to a stream (or a file path which is turned into a
stream), or an array of streams.

Then, when creating errors with `Cant.errors`, each custom error will be
assigned output streams based on their level.

```js

var errors = Cant.errors({

  AccessDenied: Cant('access the %s').because('your %s was declined')
    .level('warn')

});

var ohNo = new errors.AccessDenied('mainframe', 'username');
ohNo.log();

// or, to print a stack trace:
ohNo.log(true);

```

This would print an error message to stdout and /var/log/warn.log.

Currently any `tty.WriteStream`, `stream.Writable` or `net.Socket` will be
supported as an output stream.

Combining Errors
----------------

When writing large, asynchronous applications in Node there's are many times
when you don't have all the information to construct an informative error
message at the same time.

Instead, you may know details about the desired action in one place, and details
about the cause of error in another.

Well, Cant ***can*** help!

Let's take an example from a typical Express/Mongoose app:

```js

var Cant = require('cant');

var RegisterError = Cant('register user %s')
  .because(Error)
  .name('RegisterError')
  .level('error')
  .http(500)
  .create();

var NotUniqueError = Cant('save Model')
  .because('%s is not unique')
  .name('NotUniqueError')
  .create();


route.get(function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;

  User.register(username, password, function(err) {
    if (err) return next(new RegisterError(username, err));
    
    res.status(201).send('registered!');
  });

});

User.statics.register = function register(username, password, callback) {

  User.findOne({username: username}, function(err, user) {
    if (user) return callback(new NotUniqueError('username'));
  });
};

```

If a user gives a non-unique username "bob", the resulting error message will be
a combination of the two errors: "Can't register user bob because username is
not unique."

When combining errors like this, the deeper "source" error **does not** have to
be a custom Cant error. So you could do something like this:

```js

var DBSaveError = Cant('save instance of model %s')
  .because(Error)
  .name('DBSaveError')
  .level('error')
  .http(500)
  .create();

User.save(function(err) {
  if (err) throw new DBSaveError('User', err);
});

```

Another module (like Mongoose) generates `err`, whose message is then used as
the "because y" clause of the custom DBSaveError.

Cant ErrorFactory API
---------------------

Here's all the options you have when defining your custom Cant errors.

### ErrorFactory#name

Set the name of the custom error.

```js

var ErrorFactory = require('cant').ErrorFactory;
var factory = new ErrorFactory();

var CantError = factory.name('CantError').create();

```

### ErrorFactory#cant

Provide a format string for the "Cant x" clause.

This string will be used by Node's `util.format` to construct the final
"Cant" clause of the error.

```js

var CantError = factory.cant('do action %s').create();

throw new CantError('find');

// "Can't do action find"

```

### ErrorFactory#because

Provide a format string (as in ErrorFactory#cant), OR the Error constructor
for the "because y" clause.

Passing `Error` allows for combining error messages.

```js

var SpecificActionError = factory.cant('do a specific action')
  .because(Error)
  .create();

var SpecificReasonError = factory.cant('do a generic action')
  .because('a specific thing went wrong')
  .create();

throw new SpecificActionError(new SpecificReasonError());

// "Can't do a specific action because a specific thing went wrong."

```

Here you can see how this enables a combination of two kinds of errors -
those that are specific about the desired action that cannot be performed,
and those that are specific about the reason for the error.

This can be helpful in a typical application, where information about the
desired action and the root cause of an error may not be available in the
same location.

### ErrorFactory#http

Set an HTTP status code for the error.

```js

var ServerError = factory.http(500).create();

```

### ErrorFactory#level

Set a short severity level string.

```js

var WarnError = factory.level('warn').create();

```

### ErrorFactory#streams

Add a writable stream (or an array of such), allowing the generated error to log
to a custom location.

Any `tty.WriteStream`, `stream.Writable` or `net.Socket` will be supported as an
output stream.

```js

var StreamError = factory.streams(process.stderr).create();

```

### ErrorFactory#create

Creates a new custom CantError. Call this method **last**, after defining your
custom error using the previous methods.

-----

&copy; 2014 Weston Fribley

This software is MIT licensed - please see `LICENSE` for details.
