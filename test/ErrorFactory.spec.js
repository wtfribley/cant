var fs = require('fs');
var net = require('net');
var stream = require('stream');
var should = require('should');
var ErrorFactory = require('../lib/ErrorFactory');

describe('ErrorFactory.validateStream', function() {

  var streamWritable = fs.createWriteStream('/tmp/cant.errors.log');
  var ttyStream = process.stdout;
  var socket = new net.Socket();
  var string = '/tmp/cant.errors.log';
  var arr = [process.stderr, '/tmp/cant.errors.log'];

  var badStream = {i: 'am not a stream'};
  var badArr = [process.stdout, true, 123];

  it('should allow instances of stream.Writable', function() {

    var result = ErrorFactory.validateStreams(streamWritable);
    result.should.equal(streamWritable);

  });

  it('should allow instances of tty.WriteStream', function() {

    var result = ErrorFactory.validateStreams(ttyStream);
    result.should.equal(ttyStream);

  });

  it('should allow instances of net.Socket', function() {

    var result = ErrorFactory.validateStreams(socket);
    result.should.equal(socket);

  });

  it('should allow strings, converting them into writable streams', function() {
    
    var result = ErrorFactory.validateStreams(string);
    result.should.be.an.instanceof(stream.Writable);
  
  });

  it('should allow Arrays composed of allowed types', function() {

    var results = ErrorFactory.validateStreams(arr);
    results.should.have.length(2);
    results[0].should.equal(process.stderr);
    results[1].should.be.an.instanceof(stream.Writable);

  });

  it('should throw if not given a stream or string', function() {

    (function() {
      ErrorFactory.validateStreams(badStream);
    }).should.throw();

  });

  it('should throw if given an Array containing not-allowed types', function() {

    (function() {
      ErrorFactory.validateStreams(badArr);
    }).should.throw();

  });

});

describe('ErrorFactory#because', function() {
  
  it('should accept `Error`, setting the format string to "%s" and ' +
    'ErrorFactory#_becauseIsError to true', function() {

    var factory = new ErrorFactory();

    factory.because(Error);
    factory._because.should.equal('%s');
    factory._becauseIsError.should.be.true;

  });
});

describe('ErrorFactory#streams', function() {
  
  it('should always set ErrorFactory#_streams as an Array', function() {

    var factory = new ErrorFactory();
    factory.streams(process.stderr);
    factory._streams.should.be.an.Array;
    factory._streams.should.have.length(1);

    factory = new ErrorFactory();
    factory.streams([process.stderr, '/tmp/cant.errors.log']);
    factory._streams.should.be.an.Array;
    factory._streams.should.have.length(2);
  });
});

describe('ErrorFactory#create', function() {
  
  it('should return a CantError constructor', function() {
    var factory = new ErrorFactory();
    var error = factory.create();

    error.constructor.should.be.a.Function;
    (new error())._isCantError.should.be.true;
  });
});

describe('ErrorFactory#_countPlaceholders', function() {

  it('should accurately count the number of valid `util.format` placeholders ' +
    'exist in given format strings', function() {

    var factory = new ErrorFactory();

    var zero = 'this has no placeholders';
    var one = 'this has %s one placeholder';
    var two = 'this has %d two placeholders %j';

    factory._countPlaceholders(zero).should.equal(0);
    factory._countPlaceholders(one).should.equal(1);
    factory._countPlaceholders(two).should.equal(2);

  })
});
