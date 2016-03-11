/**
 * logger module
 */
angular.module('core')
    .config(exceptionHandlerConfigure);

/**
 * config exceptionHandler
 * @returns {*}
 * @ngInject
 */
function exceptionHandlerConfigure(exceptionHandlerProvider) {
    exceptionHandlerProvider.isHttpResultError = function (httpResult) {
        return httpResult === "0";
    };
}