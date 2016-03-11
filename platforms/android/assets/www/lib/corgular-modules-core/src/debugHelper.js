(function () {
    'use strict';

    /**
     * define factory of `debugHelper`
     */
    angular
        .module('core')
        .factory('debugHelper', debugHelper)
        .run(debugHelperRun);

    /**
     * API of `debugHelper`
     * @ngInject
     */
    function debugHelper() {

        return {
            /**
             * get angular service on console
             * @returns {*}
             */
            get: function () {
                var injector = angular.element(document.body).injector();
                return injector.get.apply(injector.get, arguments);
            }
        };
    }

    /**
     * run `debugHelper`
     * @param debugHelper
     * @param $window
     * @ngInject
     */
    function debugHelperRun(debugHelper, $window) {
        $window._debugHelper = debugHelper;
    }

})();


