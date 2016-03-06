(function () {
    'use strict';

    /**
     * define factory of `device`
     */
    angular
        .module('core')
        .factory('device', device);

    /**
     * API of `device`
     * @ngInject
     */
    function device($q, $window, $timeout, $log) {

        /**
         * cache the value of `is device ready`
         */
        var _isReady;

        return {
            /**
             * event of Cordova ready, means that the cordova plugins are ready to use.
             * @returns {promise}
             */
            ready: function () {
                var defer = $q.defer(),
                    timeout = 10 * 1000;

                if (_isReady) {
                    defer.resolve();
                } else {
                    $window.document.addEventListener("deviceready", function () {
                        $log.log('device is ready');
                        _isReady = true;
                        defer.resolve();
                    }, false);

                    $timeout(function () {
                        if (!_isReady) {
                            $log.error('ready: device was not ready after ' + timeout / 1000 + 's.');
                            defer.reject('device ready timeout');
                        }
                    }, timeout);
                }

                return defer.promise;
            }
        };
    }

})();


