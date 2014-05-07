'use strict';

var angular = require('angular');
var controllers = require('../modules').controllers;

// `controllers.controller` breaks ngmin, see https://github.com/btford/ngmin#references
angular.module(controllers.name).controller('LoginCtrl', function ($scope, $location, login) {
  $scope.$on('login', function () {
    $location.path('/');
  });

  $scope.promptForLogin = function () {
    login.prompt();
  };

  $scope.submit = function () {
    // TODO login
  };
});
