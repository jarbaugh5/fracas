'use strict';

var angular = require('angular');
var services = require('../scripts/modules').services;

angular.module(services.name).factory('outpatientAggregation', /*@ngInject*/ function (gettextCatalog) {
  //backend will wrap with "aggs : {"
  var aggregations = {
    sex: {
      terms: {
        field: 'patient.sex',
        order: { '_term': 'asc' }
      }
    },
    symptoms: {
      nested: {
        path: 'symptoms'
      },
      aggs: {
        _name: { //double check that using an underscore is kosher
          terms: {
            field: 'symptoms.name.raw',
            order: { '_term': 'asc' }
          },
          aggs: {
            count: { //calling this doc_count may be cheating a little..
              sum: {
                field: 'symptoms.count'
              }
            }
          }
        }
      }
    },
    diagnoses: {
      terms: {
        field: 'diagnoses.name.raw',
        order: { '_term': 'asc' }
      },
      aggs: {
        count: {
          sum: {
            field: 'diagnoses.count'
          }
        }
      }
    },
    districts: {
      terms: {
        field: 'medicalFacility.district.raw',
        order: { '_term': 'asc' }
      }
    },
    age: {
      range: { // age is actually an age group, b/c that's almost always what you actually want
        field: 'patient.age',
        ranges: [
          {key: '[0 TO 1]', to: 1},
          {key: '[1 TO 5]', from: 1, to: 5},
          {key: '[5 TO 12]', from: 5, to: 12},
          {key: '[12 TO 18]', from: 12, to: 18},
          {key: '[18 TO 45]', from: 18, to: 45},
          {key: '[45 TO 65]', from: 45, to: 65},
          {key: '[65 TO *]', from: 65}
        ]
      }
    }
  };

  return {
    getAggregation: function (name, limit) {
      var copy = angular.copy(aggregations[name]);
      if (limit && copy.terms) {
        copy.terms.size = limit;
      }
      return copy;
    },

    /**
     * Given a bucket from elasticsearch aggregation response, return a key to identify said bucket
     * @param bucket elasticsearch bucket
     */
    bucketToKey: function (bucket) {
      if (bucket.key) {
        return gettextCatalog.getString(bucket.key);
      }

      if (bucket.from && bucket.to) {
        return bucket.from + '-' + bucket.to;
      } else if (bucket.from) {
        return '>' + bucket.from;
      } else if (bucket.to) {
        return '<' + bucket.to;
      } else {
        throw new Error('Cannot make key for bucket ' + bucket);
      }
    }
  };
});
