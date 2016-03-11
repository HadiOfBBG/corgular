/**
 * logger module
 */
angular.module('logger', [])
    .factory('logger', logger);

/**
 * logger factory
 * @returns {*}
 * @ngInject
 */
function logger() {
    return {
        error: function () {
            console.log(
                'my logger:',
                arguments
            );
        }
    }
}