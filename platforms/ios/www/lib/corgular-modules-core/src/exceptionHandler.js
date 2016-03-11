(function () {
    'use strict';

    var __logger,
        __config;

    /**
     * init `exceptionHandler`
     */
    angular
        .module('core')
        .provider('exceptionHandler', exceptionHandlerProvider)
        .run(handleWindowError)
        .config(handleAngularError)
        .config(handleHttpError);

    /**
     * configure `exceptionHandler`
     */
    function exceptionHandlerProvider() {
        var _self = this; // jshint ignore:line

        /**
         * default http result error decider
         *
         * if http response JSON of {error_code:XX} that will be logged
         * @returns {string}
         */
        _self.isHttpResultError = function (httpResult) {
            return httpResult && httpResult.error_code;
        };

        /**
         * content
         * @type {{}}
         */
        _self.$get = {};

        /**
         * make accessible
         * @private
         */
        __config = _self;
    }

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
                        /**
                         * error logger function
                         * @param type {string}
                         *
                         *  Enum:
                         *  'window.error' - all of uncaught exception
                         *
                         *  'angular.error' - all of angular or called $log.error exception
                         *
                         *  `http.result.error` - all of http server response
                         *                        with {error_code:'something'} exception
                         *
                         *  'http.status.error' - all of http response status code
                         *                        aren't 200 exception,include timeout
                         *
                         * @param exception {Object} the object of error
                         * @param exception.message {string} exception message string
                         * @param {string} [exception.file] exception file path
                         * @param {number} [exception.line] exception file line number
                         * @param {string} [exception.remark] addition information
                         */
                        error: function (type, exception) {
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
            injectLogger($injector).error(
                'window.error',
                {message: errorMsg, file: file, line: lineNumber}
            );

            // call origin window.onerror
            if (oldOnError) {
                return oldOnError.call(this, arguments);
            }

            // keep origin invoke
            return false;
        };
    }

    /**
     * handle all the angular error. handle the errors called by $log.error(),
     * include all the angular inner error and manually invoked $log.error.
     * @param $provide
     * @ngInject
     */
    function handleAngularError($provide) {

        /**
         * decorate $log to handle $log.error call
         *
         * DESC：$exceptionHandler will call $log.error at last，so just need decorate $log
         */
        $provide.decorator("$log", $logDecorator);

        /**
         * doing decorator
         * @param $delegate
         * @param $injector
         * @returns {*}
         * @ngInject
         */
        function $logDecorator($delegate, $injector) {

            var oldError = $delegate.error;

            $delegate.error = function () {

                var exception,
                    messages = [],
                    messageSeparator = ' ';

                var toStr = function (o) {
                    return typeof o === 'string' ? o : JSON.stringify(o);
                };

                // 1.call origin window.onerror
                oldError.apply($delegate, arguments);

                // 2.concat error messages
                //  rules:
                //      1)concat multiple messages in sequence
                //      2)other properties based on the first object
                //          which own `message` property
                angular.forEach(arguments, function (arg) {

                    if (exception) {
                        exception.message += messageSeparator + toStr(arg);
                    } else if (angular.isObject(arg) && ('message' in arg)) {
                        exception = arg;
                        messages.push(exception.message);
                        exception.message = messages.join(messageSeparator);
                    } else {
                        messages.push(toStr(arg));
                    }

                });

                // 3.build error object
                if (!exception) {
                    exception = {message: messages.join(messageSeparator)};
                }

                // 4.call the logger
                injectLogger($injector).error('angular.error', exception);
            };

            return $delegate;
        }
    }

    /**
     * handle error of $http
     * @param $httpProvider
     * @ngInject
     */
    function handleHttpError($httpProvider) {

        $httpProvider.interceptors.push($httpInterceptor);

        /**
         * intercept http error
         * @param $q
         * @param $window
         * @param $injector
         * @returns {*}
         * @ngInject
         */
        function $httpInterceptor($q, $window, $injector) {
            return {
                /**
                 * record the time before request to help calc times cost
                 * @param config
                 * @returns {*}
                 */
                request: function (config) {
                    config._time_start = (new Date()).getTime();
                    return config;
                },
                /**
                 * log http result error
                 * if server return object with `error_code` property,
                 * we say it's an error
                 * @param response
                 * @param response.data
                 * @param response.data.error_code
                 * @param response.config
                 * @returns {*}
                 */
                response: function (response) {
                    var exception;
                    if (__config.isHttpResultError(response.data)) {
                        exception = {
                            file: response.config.url,
                            message: $window.JSON.stringify(response.data),
                            remark: $window.JSON.stringify({config: response.config})
                        };

                        // call the logger
                        injectLogger($injector).error('http.result.error', exception);
                    }
                    return response;
                },
                /**
                 * log http status error
                 * @param rejection
                 * @returns {promise}
                 */
                responseError: function (rejection) {
                    var exception,
                        time_end,
                        time_duration,
                        message,
                        remark;

                    // 1.format status error message
                    message = rejection.status || '';
                    if (rejection.statusText) {
                        message += '(' + rejection.statusText + ') ';
                    }
                    message = message || 'unknown';

                    // 1.1.if request was timeout, concat `timeout` into message
                    if (rejection.config._time_start) {
                        time_end = (new Date()).getTime();
                        time_duration = time_end - rejection.config._time_start;

                        if (rejection.config.timeout
                            && rejection.config.timeout != -1
                            && time_duration >= rejection.config.timeout) {
                            message += 'timeout';
                        }
                    }

                    // 2.addition information
                    remark = (time_duration ? 'duration: ' + time_duration + 'ms ' : '');
                    remark += $window.JSON.stringify(rejection);

                    // 3.build error object
                    exception = {
                        file: rejection.config.url,
                        message: message,
                        remark: remark
                    };

                    // 4.call the logger
                    injectLogger($injector).error('http.status.error', exception);

                    // 5.keep return
                    return $q.reject(rejection);
                }
            };
        }
    }

})();
