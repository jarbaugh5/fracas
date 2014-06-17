'use strict';

var _ = require('lodash');
var scrypt = require('scrypt');
var codex = require('../codex');

var User = codex.model({
  index: 'user',
  type: 'user',

  classMethods: {
    findByUsername: function (username, callback) {
      return User.search({
        body: {
          query: {
            'constant_score': {
              filter: {
                term: {
                  // use un-analyzed version of the field for case-sensitive matching
                  'username.raw': username
                }
              }
            }
          }
        }
      }, function (err, response) {
        if (err) {
          return callback(err);
        }

        var results = response.hits.hits;

        if (results.length > 1) {
          // TODO use boom
          return callback(new Error('Existing records violate unique constraint'));
        } else if (results.length === 0) {
          return callback(null, null);
        } else {
          return callback(null, results[0]);
        }
      });
    },

    hashPassword: function (password, callback) {
      if (!Buffer.isBuffer(password)) {
        password = new Buffer(password, 'utf8');
      }

      scrypt.params(0.1, function (err, scryptParameters) {
        if (err) {
          return callback(err);
        }

        scrypt.hash(password, scryptParameters, callback);
      });
    }
  },

  instanceMethods: {
    isAdmin: function () {
      return this.roles && this.roles.indexOf('admin') !== -1;
    },
    hasAllDistricts: function () {
      return this.roles && this.roles.indexOf('district_all') !== -1;
    },

    hasRightsToDocument: function (doc) {
      if (!doc) {
        return true;
      }

      var facility = doc.medicalFacility;
      if (!facility) {
        // no facility, so no access control necessary
        return true;
      }

      var district = facility.district;
      if (!district || !this.districts) {
        return true;
      }

      return this.hasAllDistricts() || this.districts.indexOf(district) !== -1;
    },

    canCreateUser: function (doc) {
      if (this.isAdmin()) {
        return true;
      }

      var myRoles = this.roles || [];
      if (doc.roles) {
        if (!doc.roles.every(function (r) { return myRoles.indexOf(r) !== -1; })) {
          // can't give user a role you don't have
          return false;
        }
      }

      // TODO check districts, or are districts just roles?
    },

    checkPassword: function (password, callback) {
      scrypt.verify(this.password, password, function (err, result) {
        /*jshint camelcase:false */
        if (err && err.scrypt_err_code === 11) {
          // convert scrypt's "password is incorrect" error into a false return value
          callback(null, false);
        } else {
          callback(err, result);
        }
      });
    }
  },

  preInsert: function (doc, callback) {
    if (doc.password) {
      User.hashPassword(doc.password, function (err, password) {
        if (err) {
          return callback(err);
        }

        return callback(null, _.assign({}, doc, {password: password}));
      });
    } else {
      callback(null, new Error('Cannot create user without password'));
    }
  },

  postGet: function (esRequest, esResponse, callback) {
    delete esResponse._source.password;
    callback(null, esResponse);
  },

  postSearch: function (esRequest, esResponse, callback) {
    esResponse.hits.hits.forEach(function (h) {
      delete h._source.password;
    });
    callback(null, esResponse);
  }
});

module.exports = User;