'use strict';

var angular = require('angular');
var moment = require('moment');
var controllers = require('../../modules').controllers;

angular.module(controllers.name).controller('WeeklyReportCtrl', function ($scope, $window, gettextCatalog, user, //
                                                                          visualization, OutpatientVisitResource) {

  $scope.userString = gettextCatalog.getString('Created by') + ': ' + user.getUser().username;
  $scope.todayString = gettextCatalog.getString('Date of Report') + ': ' + moment().format('D MMMM YYYY');

  $scope.report = $window.opener.report;
  $scope.report.week = moment($scope.report.endDate).format('W'); // ISO week
  $scope.report.year = moment($scope.report.endDate).format('GGGG'); // ISO year
  $scope.report.endDateString = moment($scope.report.endDate).format('D MMMM YYYY');
  $scope.report.startDate = moment($scope.report.endDate).subtract('weeks', 1).toDate();
  var dateFormat = 'YYYY-MM-DD';
  var startDate = moment($scope.report.startDate).format(dateFormat);
  var endDate = moment($scope.report.endDate).format(dateFormat);
  var dateString = 'reportDate: [' + startDate + ' TO ' + endDate + ']';
  $scope.getSymptomCount = function (symptomsAll, symptom) {
    var result = symptomsAll.find(function (val) {
      if (val.name === symptom) {
        return true;
      }
      return false;
    });
    return result ? result.count : '';
  };

  OutpatientVisitResource.get({
      q: dateString,
      size: 100,
      sort: 'medicalFacility.district:desc'
    },
    function (response) {
      $scope.$data = response.results;
    }
  );
});
