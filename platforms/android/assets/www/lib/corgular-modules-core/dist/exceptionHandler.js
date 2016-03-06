(function () {
    'use strict';

    var __logger;

    /**
     * define provider of `localDB`
     */
    angular
        .module('exceptionHandler', [])
        .run(handleWindowError);

    /**
     * dynamic inject logger service to make logger can be custom by actual requirements
     * @returns {Object}
     */
    function injectLogger() {
        return __logger || (
                __logger = $injector.get('logger') || {
                        error: function () {
                            console.log('exceptionHandler: ', JSON.stringify(arguments));
                        }
                    }
            );
    }

    /**
     * handle window.onerror event
     */
    function handleWindowError() {

        var oldOnError = window.onerror;
        window.onerror = function (errorMsg, file, lineNumber) {

            // handler window error
            injectLogger.error('window.error', errorMsg, file, lineNumber);

            if (oldOnError) {
                // call origin window.onerror
                return oldOnError(errorMsg, file, lineNumber);
            }

            // keep origin invoke
            return false;
        };
    }

})();
