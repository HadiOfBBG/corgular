
angular
    .module('core')
    .config(localDBConfigure);

/**
 * config localDB
 * @returns {*}
 * @ngInject
 */
function localDBConfigure(localDBProvider){
    var i = 0;
    localDBProvider.getDefaultDBName = function () {
        return 'app' + (i = i + 1);
    }
}