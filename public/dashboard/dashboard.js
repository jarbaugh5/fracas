'use strict';

var angular = require('angular');
var directives = require('../scripts/modules').directives;

angular.module(directives.name).directive('dashboard', /*@ngInject*/ function (gettextCatalog, $modal, visualization, Dashboard,
                                                                 $location, dateFilter) {
  return {
    restrict: 'E',
    template: require('./dashboard.html'),
    scope: {
      dashboardId: '=?'
    },
    compile: function () {
      return {
        pre: function (scope) {
          scope.gridsterOptions = {
            margins: [10, 10],
            columns: 12,
            draggable: {
              enabled: true
            },
            resizable: {
              enabled: true
            }
          };

          /**
           * The dashboard date window is a rolling window that calculates the difference in the start
           * and the end dates that a user sets and creates a date interval starting from today going "x" number of days
           * back. This is done automatically every time a saved dashboard is open, and when a new widget is added. When
           * the date interval is changed the widget reflects the current interval change but then reverts to the rolling
           * configuration of "x" number of days back from today depending on the the new date range that was selected.
           */

          var getDaysDifference = function (start, end){
            var date1 = new Date(start);
            var date2 = new Date(end);
            var timeDiff = Math.abs(date2.getTime() - date1.getTime());
            return Math.ceil(timeDiff / (1000 * 3600 * 24));
          };

          var getQueryString = function (queryString, start, end) {
            var index = queryString.indexOf('reportDate');
            var returnQuery;
            var dateFormat = 'yyyy-MM-dd';
            start = dateFilter(start, dateFormat)  || '*';
            end = dateFilter(end, dateFormat)  || '*';
            if (index === -1) {
              if (queryString.length > 0) {
                returnQuery = queryString + ' AND reportDate: [' + start + ' TO ' + end + ']';
              } else {
                returnQuery = queryString + 'reportDate: [' + start + ' TO ' + end + ']';
              }
            } else {
              var regexp = /\w+\:\s\[\d+\-\d+\-\d+\s\w+\s\d+\-\d+\-\d+\]/;
              returnQuery = queryString.replace(regexp, 'reportDate: [' + start + ' TO ' + end + ']');
            }
            return returnQuery;
          };

          var checkFilters = function (f) {
            return f.type === 'date-range';
          };

          // set dashboard data and make the date window rolling
          if (scope.dashboardId) {
            Dashboard.get(scope.dashboardId, function (data) {
              scope.dashboard = data._source;

              scope.dashboard.widgets.forEach(function (widget) {
                var dateFilters = widget.content.filters.filter(checkFilters);
                var interval = getDaysDifference(dateFilters[0].from, dateFilters[0].to);
                var x = widget.content.filters.indexOf(dateFilters[0]);
                var today = new Date();
                today.setDate(today.getDate() - interval);
                var start = today;
                var end = new Date();
                widget.content.filters[x].from = start;
                widget.content.filters[x].to = end;
                var queryString = getQueryString(widget.content.queryString, start, end);
                widget.content.filters[x].queryString = queryString;
                widget.content.queryString = queryString;
              });
            });
          } else {
            scope.dashboard = {
              name: '',
              widgets: []
            };
          }

          scope.addWidget = function () {
            // TODO we don't need a modal with a single field
            $modal.open({
              template: require('./add-widget.html'),
              controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {
                // TODO this will only bring back 10 visualizations, we need paging
                visualization.resource.get(function (visualizations) {
                  $scope.visualizations = visualizations.results;
                });
                $scope.widget = {};

                $scope.cancel = function () {
                  $modalInstance.dismiss('cancel');
                };

                $scope.submit = function (form) {
                  // grab name and url
                  if (form.$invalid) {
                    $scope.yellAtUser = true;
                    return;
                  }
                  $modalInstance.close({
                    visualization: $scope.visualizations.filter(function (viz) {
                      return viz._id === $scope.widget.visualization;
                    })[0]._source
                  });
                };
              }]
            }).result.then(function (widget) {
                // create widget with name and visualization
                //creating a date filter if there is not one already, if there is use that one
                var dateFilters = widget.visualization.state.filters.filter(checkFilters);
                var from = new Date();
                from.setDate(from.getDate() - 90);
                var to = new Date();
                var queryString = getQueryString(widget.visualization.state.queryString, from, to);
                if (dateFilters.length === 0) {
                  widget.visualization.state.filters.push({
                    field: 'reportDate',
                    filterId: 'date',
                    from: from,
                    name: 'Date',
                    queryString: queryString,
                    to: to,
                    type: 'date-range'
                  });
                  widget.visualization.state.queryString = queryString;
                } else {
                  var x = widget.visualization.state.filters.indexOf(dateFilters[0]);
                  var interval = getDaysDifference(widget.visualization.state.filters[x].from, widget.visualization.state.filters[x].to);
                  from = new Date();
                  from.setDate(from.getDate() - interval);
                  widget.visualization.state.filters[x].from = from;
                  widget.visualization.state.filters[x].to = to;
                  widget.visualization.state.filters[x].queryString = getQueryString(widget.visualization.state.queryString, from, to);
                  widget.visualization.state.queryString = getQueryString(widget.visualization.state.queryString, from, to);
                }
                scope.dashboard.widgets.push({
                  name: widget.visualization.name,
                  sizeX: 6,
                  sizeY: 4,
                  content: widget.visualization.state
                });
              });
          };
          scope.clear = function () {
            scope.dashboard.widgets = [];
          };

          scope.export = function () {
            if (scope.dashboardId) {
              Dashboard.update(Dashboard.state(scope.dashboard), scope.dashboardId);
            } else {
              Dashboard.save(Dashboard.state(scope.dashboard));
            }
          };

          scope.clickthrough = function (widget) {
            var savedWidget = {};
            savedWidget[widget.name] = widget.content;
            sessionStorage.setItem('visualization', JSON.stringify(savedWidget));
            $location.path('/workbench/').search('visualization', widget.name);
          };
        }
      };
    }
  };
});
