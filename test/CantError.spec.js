var should = require('should');
var ErrorFactory = require('../lib/ErrorFactory');

describe('new CantError()', function() {

  describe('ErrorFactory#cant and #because are given strings', function() {

    var errors = {
      s: (new ErrorFactory())
        .cant('do thing %s').because('reason %s').create(),

      d: (new ErrorFactory())
        .cant('do thing %d').because('reason %d').create(),

      j: (new ErrorFactory())
        .cant('do thing %j').because('reason %j').create(),
    };

    it('should remove placeholders from the format strings if too few ' +
    'arguments are given', function() {

      var zero = new errors.s();
      zero.message.should.equal('Can\'t do thing because reason');
      
      var one = new errors.s('one');
      one.message.should.equal('Can\'t do thing one because reason');

    });

    it('should use `util.format` to replace format strings with given ' +
    'arguments', function() {

      var s = new errors.s('one', 'two');
      s.message.should.equal('Can\'t do thing one because reason two');
      var sd = new errors.s(1, 2);
      sd.message.should.equal('Can\'t do thing 1 because reason 2');
      var sj = new errors.s({one: 1}, {two: 2});
      sj.message.should.equal(
        'Can\'t do thing [object Object] because reason [object Object]'
      );

      var d = new errors.d(1, 2);
      d.message.should.equal('Can\'t do thing 1 because reason 2');
      var ds = new errors.d('one', 'two');
      ds.message.should.equal('Can\'t do thing NaN because reason NaN');
      var dj = new errors.d({one: 1}, {two: 2});
      dj.message.should.equal('Can\'t do thing NaN because reason NaN');

      var j = new errors.j({one: 1}, {two: 2});
      j.message.should.equal(
        'Can\'t do thing {"one":1} because reason {"two":2}'
      );
      var js = new errors.j('one', 'two');
      js.message.should.equal('Can\'t do thing "one" because reason "two"');
      var jd = new errors.j(1, 2);
      jd.message.should.equal('Can\'t do thing 1 because reason 2');
    
    });

    it('should ignore extra arguments (i.e. those without corresponding ' +
    'placeholders in the format strings)', function() {

      var three = new errors.s('one', 'two', 'three');
      three.message.should.equal('Can\'t do thing one because reason two');
    
    });
  });

  describe('ErrorFactory#cant is given a string, #because is given Error',
  function() {

    var errors = {
      chainA: (new ErrorFactory())
        .cant('do specific thing').because(Error)
        .level('info').http(400).create(),

      chainB: (new ErrorFactory())
        .cant('do generic thing').because('specific reason')
        .level('error').http(500).create()
    };

    var b = new errors.chainB();
    var a = new errors.chainA(b);

    it('should use the provided error\'s "because" clause in place of its own',
    function() {

      b.message.should.equal('Can\'t do generic thing because specific reason');
      a.message.should.equal(
        'Can\'t do specific thing because specific reason'
      );

    });

    it('should use the provided error\'s level and http status in place of ' +
    'its own', function() {

      a.level.should.equal('error');
      a.status.should.equal(500);

    });
  });
});

describe('CantError#log', function() {

  var Writable = require('stream').Writable;
  var util = require('util');

  function StreamMock(options) {
    Writable.call(this, options);
  }

  util.inherits(StreamMock, Writable);

  it('should write a JSON-formatted info string to the streams assigned by ' +
  'ErrorFactory#streams', function() {

    StreamMock.prototype._write = function(chunk) {
      var data = JSON.parse(chunk.toString());
      data.message.should.equal('Can\'t do a thing because of a reason');
      (typeof data.stack).should.equal('undefined');
    };

    var One = (new ErrorFactory())
      .cant('do a thing')
      .because('of a reason')
      .streams(new StreamMock())
      .create();

    var one = new One();
    one.log();

    var Two = (new ErrorFactory())
      .cant('do a thing')
      .because('of a reason')
      .streams([new StreamMock(), new StreamMock()])
      .create();

    var two = new Two();
    two.log();
  });

  it('should include a stacktrace if given a single truthy argument',
  function() {

    StreamMock.prototype._write = function(chunk) {
      var data = JSON.parse(chunk.toString());
      data.stack.should.be.a.String;
    };

    var Stack = (new ErrorFactory())
      .cant('do a thing')
      .because('of a reason')
      .streams(new StreamMock())
      .create();

    var stack = new Stack();
    stack.log(true);

  });
});
