'use strict';

var angular = require('angular');
var moment = require('moment');

// @ngInject
module.exports = function ($scope, gettextCatalog, $window, visualization, user, DistrictResource) {

  $scope.userString = gettextCatalog.getString('Created by') + ': ' + user.getUser().username;
  $scope.todayString = gettextCatalog.getString('Date of Report') + ': ' + moment().format('D MMMM YYYY');

  $scope.report = $window.opener.report;
  $scope.report.startDate = moment($scope.report.endDate).subtract('years', 1).toDate();
  $scope.report.week = moment($scope.report.endDate).format('W'); // ISO week
  $scope.report.year = moment($scope.report.endDate).format('GGGG'); // ISO year
  $scope.report.endDateString = moment($scope.report.endDate).format('D MMMM YYYY');
  var dateFormat = 'YYYY-MM-DD';
  var startDate = moment($scope.report.startDate).format(dateFormat);
  var endDate = moment($scope.report.endDate).format(dateFormat);
  $scope.report.dateString = 'reportDate: [' + startDate + ' TO ' + endDate + ']';

  var fixReportDate = function (query) {
    var result = query;
    var startPosition = 0;
    var i = -1;

    while (startPosition !== -1) {
      startPosition = result.indexOf('reportDate:', i + 1);
      if (startPosition === -1) {
        break;
      }
      var endPosition = result.indexOf(']', startPosition + 1);
      result = result.substr(0, startPosition) + $scope.report.dateString + result.substr(endPosition + 1);
      i = startPosition;
    }
    return result;
  };

  var fixVisualization = function (viz) {

    // fix date in queryString
    viz.state.queryString = fixReportDate(viz.state.queryString);

    // fix date filters
    if (viz.state.filters) {
      for (var ix = 0; ix < viz.state.filters.length; ix++) {
        // Update date filters
        if (viz.state.filters[ix].type === 'date') {
          viz.state.filters[ix].from = $scope.report.startDate; //new Date(viz.filters[ix].from);
          viz.state.filters[ix].to = $scope.report.endDate; // new Date(viz.filters[ix].to);
        }
      }
    }
    return viz;
  };

  var fixCountry = function (viz, country) {
    // fix queryString and replace country name
    viz.state.queryString = viz.state.queryString.replace('"Country A"', '"' + country + '"');

    // fix district filter and replace country name
    if (viz.state.filters) {
      for (var ix = 0; ix < viz.state.filters.length; ix++) {
        // Update date filters
        if (viz.state.filters[ix].filterId === 'districts') {
          viz.state.filters[ix].value[0] = country;
          viz.state.filters[ix].queryString = viz.state.filters[ix].queryString.replace('"Country A"', '"' + country + '"');
        }
      }
    }
    return viz;
  };

  var pluckName = function (r) {
    return r._source.name;
  };

  visualization.resource.get({q: 'name:"DistrictWeeklyData"'}, function (data) {
    var vizTemplate = fixVisualization(data.results[0]._source);

    var searchParams = {
      size: 30,  //TODO: get data for all district/country
      sort: 'name'
    };

    DistrictResource.get(searchParams, function (response) {
      var districts = response.results.map(pluckName);
      var rows = [
        []
      ];

      districts.forEach(function (district, i) {
        var v = angular.copy(vizTemplate);
        v = fixCountry(v, district);
        v.name = district;
        rows[rows.length - 1].push(v);
        if (i % 3 === 2) {
          rows.push([]);
        }
      });

      $scope.rows = rows;
    });
  });
};
