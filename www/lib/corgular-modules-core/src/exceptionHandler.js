(function () {
    'use strict';

    var __logger;

    /**
     * init `exceptionHandler`
     */
    angular
        .module('core')
        .run(handleWindowError);

    /**
     * dynamic inject logger service to make logger can be custom by actual requirements
     * @param $injector {Object}
     * @returns {Object}
     */
    function injectLogger($injector) {
        var serviceName = 'logger';
        return __logger || (
                __logger = $injector.has(serviceName) &&
                    $injector.get(serviceName) || {
                        error: function () {
                            console.warn(
                                'exceptionHandler: Implement `logger.error()` to log the error. ',
                                arguments
                            );
                        }
                    }
            );
    }

    /**
     * handle window.onerror event
     * @ngInject
     */
    function handleWindowError($injector) {

        var oldOnError = window.onerror;
        window.onerror = function (errorMsg, file, lineNumber) {

            // handler window error
            injectLogger($injector).error('window.error', errorMsg, file, lineNumber);

            if (oldOnError) {
                // call origin window.onerror
                return oldOnError(errorMsg, file, lineNumber);
            }

            // keep origin invoke
            return false;
        };
    }

})();
