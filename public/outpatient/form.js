'use strict';

var angular = require('angular');
var directives = require('../scripts/modules').directives;

/**
 * A reusable edit form. Currently only used in the modal edit, but could be used in other places.
 */
angular.module(directives.name).directive('outpatientForm', /*@ngInject*/ function (gettextCatalog, OutpatientVisitResource,
                                                                      DistrictResource, DiagnosisResource,
                                                                      SymptomResource) {
  return {
    restrict: 'E',
    template: require('./form.html'),
    transclude: true,
    scope: {
      page: '=',
      onSubmit: '&',
      record: '=?' // to populate fields
    },
    compile: function () {
      return {
        pre: function (scope) {
          scope.page = scope.page || 1;
          scope.record = scope.record || {};
          scope.visit = angular.copy(scope.record._source) || {};

          if (scope.visit.symptoms) {
            scope.visit.symptoms = scope.visit.symptoms.map(function (r){
              return r.name;
            });
          }
          if (scope.visit.diagnoses) {
            scope.visit.diagnoses = scope.visit.diagnoses.map(function (r){
              return r.name;
            });
          }

          scope.agePlaceholder = gettextCatalog.getString('Patient\'s age');
          scope.yellAtUser = false;

          // TODO use multi-get so we only have one XHR request
          var searchParams = {
            size: 9999, // TODO search on demand if response indicates there are more records
            sort: 'name',
            q: 'enabled:true'
          };

          // Construct a set of resources, indexed by their name
          var makeIndex = function (results) {
            return results.reduce(function (prev, current) {
              prev[current._source.name] = current;
              return prev;
            }, {});
          };

          DistrictResource.get({size: 9999, sort: 'name'}, function (response) {
            var districtIndex = makeIndex(response.results);

            // add any districts that are on this record, but not in the ref table, so they show up when you edit the
            // record
            if (scope.visit.district) {
              districtIndex[scope.visit.district] = districtIndex[scope.visit.district] || true;
            }

            scope.districts = Object.keys(districtIndex);
          });
          SymptomResource.get(searchParams, function (response) {
            var symptomIndex = makeIndex(response.results);
            if (scope.visit.symptoms) {
              scope.visit.symptoms.forEach(function (symptom) {
                symptomIndex[symptom] = symptomIndex[symptom] || true;
              });
            }

            scope.symptoms = Object.keys(symptomIndex);
          });
          DiagnosisResource.get(searchParams, function (response) {
            var diagnosisIndex = makeIndex(response.results);
            if (scope.visit.diagnoses) {
              scope.visit.diagnoses.forEach(function (diagnosis) {
                diagnosisIndex[diagnosis] = diagnosisIndex[diagnosis] || true;
              });
            }

            scope.diagnoses = Object.keys(diagnosisIndex);
          });

          scope.isInvalid = function (field) {
            if (!field) {
              // this happens when you switch pages
              return;
            }
            if (scope.yellAtUser) {
              // if the user has already tried to submit, show them all the fields they're required to submit
              return field.$invalid;
            } else {
              // only show a field's error message if the user has already interacted with it, this prevents a ton of
              // red before the user has even interacted with the form
              return field.$invalid && !field.$pristine;
            }
          };

          scope.openReportDate = function ($event) {
            $event.preventDefault();
            $event.stopPropagation();
            scope.reportDateOpened = true;
          };

          scope.submit = function (visitForm) {
            if (visitForm.$invalid) {
              scope.yellAtUser = true;
              return;
            }

            var cleanup = function () {
              scope.yellAtUser = false;
              scope.onSubmit(scope.visitForm);
            };

            var showError = function (data) {
              // if someone else has updated this record before you hit save
              if (data.status === 409) {
                // Get latest record data and update form
                OutpatientVisitResource.get({id: scope.record._id}, function (newData) {
                  scope.conflictError = true;
                  scope.record = newData;
                  scope.visit = scope.record._source;
                  scope.page = 1;
                });
              }
            };

            scope.visit.symptoms = scope.visit.symptoms ? scope.visit.symptoms.map(function (r) {
              return {name: r, count: 1};
            }) : [];

            scope.visit.diagnoses = scope.visit.diagnoses ? scope.visit.diagnoses.map(function (r) {
              return {name: r, count: 1};
            }) : [];

            if (scope.record._id || scope.record._id === 0) { // TODO move this logic to OutpatientVisit
              OutpatientVisitResource.update({
                id: scope.record._id,
                version: scope.record._version
              }, scope.visit, cleanup, showError);
            } else {
              OutpatientVisitResource.save(scope.visit, cleanup, showError);
            }
          };

          scope.$on('next-page', function () {
            scope.yellAtUser = !!scope.visitForm.$invalid;
            if (!scope.yellAtUser) {
              scope.page++;
            }
          });

          scope.$on('previous-page', function () {
            scope.yellAtUser = !!scope.visitForm.$invalid;
            if (!scope.yellAtUser) {
              scope.page--;
            }
          });

          scope.$on('outpatientSave', function () {
            scope.submit(scope.visitForm);
          });
        }
      };
    }
  };
});
