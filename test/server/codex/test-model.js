'use strict';

var chai = require('chai');
chai.use(require('sinon-chai'));
var expect = chai.expect;
var nock = require('nock');

var _ = require('lodash');
var codex = require('../../../server/codex');
var conf = require('../../../server/conf');

describe('model', function () {
  afterEach(function () {
    nock.cleanAll();
  });

  it('should add instanceMethods to prototype', function (done) {
    var Bar = codex.model({
      index: 'foo',
      type: 'bar',
      instanceMethods: {
        sayHello: function () {
          return 'hello';
        }
      }
    });

    expect(new Bar({}).sayHello()).to.equal('hello');

    done();
  });

  it('should add classMethods to class', function (done) {
    var Bar = codex.model({
      index: 'foo',
      type: 'bar',
      classMethods: {
        sayHello: function () {
          return 'hello';
        }
      }
    });

    expect(Bar.sayHello()).to.equal('hello');

    done();
  });

  it('should set classMethods\' `this` to Model class', function (done) {
    var Bar = codex.model({
      index: 'foo',
      type: 'bar',
      classMethods: {
        sayHello: function () {
          expect(this).to.equal(Bar);
          done();
        }
      }
    });

    Bar.sayHello();
  });

  it('instanceMethods should have access to doc fields', function (done) {
    var Bar = codex.model({
      index: 'foo',
      type: 'bar',
      instanceMethods: {
        sayHello: function () {
          return this.doc.hello;
        }
      }
    });

    expect(new Bar({hello: 'hello'}).sayHello()).to.equal('hello');

    done();
  });

  describe('insert()', function () {
    it('should write to elasticsearch', function (done) {
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: 'r@nd0m!d',
        _version: 1,
        created: true
      };

      nock(conf.elasticsearch.host)
        .post('/foo/bar', {
          a: 1
        })
        .reply(201, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      new Bar({a: 1}).insert(function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });

    it('should respect any id passed to it', function (done) {
      var a1 = {a: 1};
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: '1',
        _version: 1,
        created: true
      };
      nock(conf.elasticsearch.host)
        .post('/foo/bar/1', a1)
        .reply(201, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      new Bar(a1, {id: 1}).insert(function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });

    it('should run any preInsert methods', function (done) {
      var a1 = {a: 1};
      var b2 = {b: 2};
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: '1',
        _version: 1,
        created: true
      };

      nock(conf.elasticsearch.host)
        .post('/foo/bar/1', b2)
        .reply(201, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        preInsert: function (model, callback) {
          expect(model).to.deep.equal(new Bar(a1, {id: '1'}));
          callback(null, new Bar(b2, model));
        }
      });

      new Bar({a: 1}, {id: '1'}).insert(function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });

    it('should propagate preInsert errors', function (done) {
      var Bar = codex.model({
        preInsert: function (model, callback) {
          callback(new Error());
        }
      });

      new Bar().insert(function (err, response) {
        expect(err).to.be.instanceof(Error);
        expect(response).to.be.undefined;

        done();
      });
    });

    it('should respect version', function (done) {
      nock(conf.elasticsearch.host)
        .post('/foo/bar?version=5', {})
        .reply(200, {
          _index: 'foo',
          _type: 'bar',
          _id: 'whatever',
          _version: 6,
          created: false
        });
      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      new Bar({}, {version: 5}).insert(done);
    });

    it('should allow passing refresh=true to model definition', function (done) {
      var a1 = {a: 1};
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: 'r@nd0m!d',
        _version: 1,
        created: true
      };
      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        refresh: true
      });

      nock(conf.elasticsearch.host)
        .post('/foo/bar?refresh=true', a1)
        .reply(201, response);

      new Bar(a1).insert(function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });

    it('should allow passing refresh=true to model instance', function (done) {
      var a1 = {a: 1};
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: 'r@nd0m!d',
        _version: 1,
        created: true
      };
      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        refresh: true
      });

      nock(conf.elasticsearch.host)
        .post('/foo/bar?refresh=true', a1)
        .reply(201, response);

      new Bar(a1, {refresh: true}).insert(function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });

    it('should allow passing refresh=true to insert', function (done) {
      var a1 = {a: 1};
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: 'r@nd0m!d',
        _version: 1,
        created: true
      };
      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        refresh: true
      });

      nock(conf.elasticsearch.host)
        .post('/foo/bar?refresh=true', a1)
        .reply(201, response);

      new Bar(a1).insert({refresh: true}, function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });
  });

  describe('search()', function () {
    it('should search elasticsearch', function (done) {
      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });
      var response = {
        took: 5,
        'timed_out': false,
        hits: {
          total: 0,
          'max_score': null,
          hits: []
        }
      };

      nock(conf.elasticsearch.host)
        .post('/foo/bar/_search?version=true&q=a')
        .reply(200, response);

      Bar.search({q: 'a'}, function (err, bars, esResponse) {
        if (err) {
          return done(err);
        }

        expect(bars).to.deep.equal([]);
        expect(esResponse).to.deep.equal(response);

        done();
      });
    });

    it('should respect `version: false`', function (done) {
      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        version: false
      });
      var response = {
        took: 5,
        'timed_out': false,
        hits: {
          total: 0,
          'max_score': null,
          hits: []
        }
      };

      var es = nock(conf.elasticsearch.host)
        .post('/foo/bar/_search?version=false&q=a')
        .reply(200, response);

      Bar.search({q: 'a'}, function (err, bars, esResponse) {
        if (err) {
          return done(err);
        }

        expect(bars).to.deep.equal([]);
        expect(esResponse).to.deep.equal(response);
        expect(es.isDone()).to.be.true;

        done();
      });
    });

    it('should call preSearch', function (done) {
      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        preSearch: function (esRequest, callback) {
          expect(esRequest.q).to.equal('a');
          callback(null, _.assign({}, esRequest, {q: 'b'}));
        }
      });
      var response = {
        took: 5,
        'timed_out': false,
        hits: {
          total: 0,
          'max_score': null,
          hits: []
        }
      };

      nock(conf.elasticsearch.host)
        .post('/foo/bar/_search?version=true&q=b')
        .reply(200, response);

      Bar.search({q: 'a'}, function (err, bars, esResponse) {
        if (err) {
          return done(err);
        }

        expect(bars).to.deep.equal([]);
        expect(esResponse).to.deep.equal(response);

        done();
      });
    });

    it('should call postSearch', function (done) {
      var searchReq = {q: 'a'};
      var response = {
        took: 5,
        'timed_out': false,
        hits: {
          total: 0,
          'max_score': null,
          hits: []
        }
      };
      var postResponse = {
        hits: {
          hits: [
            {
              _source: {
                a: 1
              }
            }
          ]
        }
      };
      nock(conf.elasticsearch.host)
        .post('/foo/bar/_search?version=true&q=a')
        .reply(200, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        postSearch: function (request, resp, callback) {
          expect(resp).to.deep.equal(response);

          callback(null, postResponse);
        }
      });

      Bar.search(searchReq, function (err, bars, resp) {
        if (err) {
          return done(err);
        }

        expect(bars.length).to.equal(1);
        expect(resp).to.deep.equal(postResponse);

        done();
      });
    });

    it('should return model instances', function (done) {
      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });
      var response = {
        took: 5,
        'timed_out': false,
        hits: {
          total: 0,
          'max_score': null,
          hits: [
            {
              _index: 'foo',
              _type: 'bar',
              _id: '1',
              _version: 1,
              _score: 1,
              _source: {
                a: 1
              }
            }
          ]
        }
      };

      nock(conf.elasticsearch.host)
        .post('/foo/bar/_search?version=true')
        .reply(200, response);

      Bar.search(function (err, bars) {
        if (err) {
          return done(err);
        }

        expect(bars).to.have.length(1);
        expect(bars[0].id).to.equal('1');
        expect(bars[0].doc.a).to.equal(1);

        done();
      });
    });
  });

  describe('get()', function () {
    it('should return document', function (done) {
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: '1',
        found: true,
        _source: {}
      };
      nock(conf.elasticsearch.host)
        .get('/foo/bar/1')
        .reply(200, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      Bar.get({id: 1}, function (err, bar, resp) {
        expect(bar.id).to.equal('1');
        // TODO check enumberable props
        expect(resp).to.deep.equal(response);

        done();
      });
    });

    it('should return a model instance', function (done) {
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: '1',
        found: true,
        _source: {}
      };
      nock(conf.elasticsearch.host)
        .get('/foo/bar/1')
        .reply(200, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar',
        instanceMethods: {
          getId: function () {
            return this.id;
          }
        }
      });

      Bar.get({id: 1}, function (err, bar) {
        expect(bar.getId).to.exist;
        expect(bar.getId()).to.equal('1');

        done();
      });
    });

    it('should set properties', function (done) {
      var response = {
        _index: 'foo',
        _type: 'bar',
        _id: '1',
        _version: 2,
        found: true,
        _source: {}
      };
      nock(conf.elasticsearch.host)
        .get('/foo/bar/1')
        .reply(200, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      Bar.get({id: 1}, function (err, bar) {
        expect(bar.id).to.equal('1');
        expect(bar.version).to.equal(2);

        done();
      });
    });

    it('should be insertable', function (done) {
      nock(conf.elasticsearch.host)
        .get('/foo/bar/1')
        .reply(200, {
          _index: 'foo',
          _type: 'bar',
          _id: '1',
          _version: 1,
          found: true,
          _source: {a: 1}
        })
        .post('/foo/bar/1?version=1', {a: 1})
        .reply(200, {
          _index: 'foo',
          _type: 'bar',
          _id: '1',
          _version: 2,
          created: false
        });

      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      Bar.get({id: 1}, function  (err, bar) {
        if (err) {
          return done(err);
        }

        expect(bar.version).to.equal(1);
        expect(bar.insert).to.exist;

        bar.insert(done);
      });
    });
  });

  describe('delete()', function () {
    it('should delete given ID', function (done) {
      var response = {
        found: true,
        _index: 'foo',
        _type: 'bar',
        _id: '1',
        _version: 2
      };
      nock(conf.elasticsearch.host)
        .delete('/foo/bar/1')
        .reply(200, response);

      var Bar = codex.model({
        index: 'foo',
        type: 'bar'
      });

      Bar.delete({id: 1}, function (err, res) {
        if (err) {
          return done(err);
        }

        expect(res).to.deep.equal(response);

        done();
      });
    });
  });
});
