(function ()
{
  'use strict';

  //console.log('in ng-ajaxutils.js');
  angular.module('ng-ajaxutils', []);

  angular.module('ng-ajaxutils')
    .service('AjaxUtilsService', AjaxUtilsService);

  // float_re is incomplete, but close enough for my purposes
  let int_re   = /^-?\d+$/;
  let float_re = /^-?\d+\.\d+$/;

  // When JSON is passed over Ajax, scalar value arrives as a string.
  // This function traverses the object and converts everything that
  // looks like a number to a number.
  function parseNumbers(value)
  {
    if (undefined === value) return value;
    if (null === value) return value;
    if ('number' === typeof value) return value;

    // note arrays are objects, so we must do this test first
    if (Array.isArray(value))
    {
      for (let i = 0; i < value.length; i++)
        value[i] = parseNumbers(value[i]);
      return value;
    }

    // it's probably a bad idea to pass an object to this function if it
    // has a case where object.hasOwnProperty(key) is false
    if (typeof value === 'object')
    {
      for (let key in value)
        value[key] = parseNumbers(value[key]);
      return value;
    }

    if ('string' !== typeof value)
      return value;

    // We can't just call parseFloat(value) and check if that's a number, because
    // parseFloat('2018-04-01') === 2018, which would result in lost data
    if (int_re.exec(value))
      return parseInt(value);
    if (float_re.exec(value))
      return parseFloat(value);
    return value;
  } // parseNumbers

  // This will probably not do what you want if you pass it something other than
  // an object containing key/scalar value pairs
  function formUrlEncode(object)
  {
    let parms = [];
    for (let key in object)
    {
      // maybe this should throw an exception? probably will yield unexpected
      // results to silently ignore
      if (!object.hasOwnProperty(key)) continue;
      parms.push(encodeURIComponent(key) + '=' + encodeURIComponent(object[key]));
    }

    return parms.join('&');
  }

  AjaxUtilsService.$inject = ['$http', '$q', 'AjaxStatusService'];
  function AjaxUtilsService($http, $q, AjaxStatusService)
  {
    let service = this;

    service.ajaxGet = function(context, config)
    {
      config.method = 'GET';
      if (typeof context !== 'string') throw 'context must be a string';
      AjaxStatusService.broadcastLoading(context)
      return $http(config).then(function(response) {
        AjaxStatusService.broadcastSuccess(context)
        return parseNumbers(response.data);
      })
      .catch (function (info) {
        console.log('in catch, info=', info);
        AjaxStatusService.broadcastError(context, info);
      });
    }

    service.ajaxPost = function(context, config)
    {
      if (typeof context !== 'string') throw 'context must be a string';
      AjaxStatusService.broadcastLoading(context);
      // for some reason $http doesn't take care of form encoding automatically,
      // so we must do it ourselves
      let post = {
        method: 'POST',
        url: config.url,
        data: formUrlEncode(config.data),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };
      return $http(post).then(function(response) {
        AjaxStatusService.broadcastSuccess(context);
        return parseNumbers(response.data);
      })
      .catch (function (error) {
        AjaxStatusService.broadcastError(context, error);
      });
    }

    // wrap a value in a promise, useful for cached data
    service.promisify = function(value)
    {
      let deferred = $q.defer();
      deferred.resolve(value);
      return deferred.promise;
    };
  }

  angular.module('ng-ajaxutils')
  .service('AjaxStatusService', AjaxStatusService);

  AjaxStatusService.$inject = ['$rootScope'];
  function AjaxStatusService($rootScope)
  {
    let $service = this;

    $service.broadcastLoading = function(clientContext)
    {
      $rootScope.$broadcast('ajax:status', { status: 'loading', context: clientContext });
    }

    $service.broadcastSuccess = function(clientContext)
    {
      $rootScope.$broadcast('ajax:status', { status: 'success', context: clientContext });
    }
    $service.broadcastError = function(clientContext, clientInfo)
    {
      $rootScope.$broadcast('ajax:status', { status: 'error', context: clientContext, info: clientInfo});
    }

    $service.onStatus = function(handlerFn)
    {
      return $rootScope.$on('ajax:status', handlerFn)
    }
  }

})();
