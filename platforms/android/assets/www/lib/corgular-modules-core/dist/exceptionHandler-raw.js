/**
 * 异常捕获
 */

myapp.run(function (log) {
    /**
     * 1.捕获全局js异常
     */
    var handleWindowError = function () {
        var oldOnError = window.onerror;
        window.onerror = function (errorMsg, file, lineNumber) {

            // 写入数据库日志
            errorMsg = 'window.error ' + errorMsg;
            log.log({message: errorMsg, line: lineNumber, file: file});

            if (oldOnError) {
                // 调用原window.onerror
                return oldOnError(errorMsg, file, lineNumber);
            }

            // 保持原处理
            return false;
        };
    };
    handleWindowError();
});

myapp.config(function ($provide, $httpProvider) {
    /**
     * 说明：$exceptionHandler内部会调用$log.error，所以只需要拦截$log，不需要拦截$exceptionHandler
     *
     $provide.decorator("$exceptionHandler", function ($delegate, log) {
            return function (exception, cause) {
                // 写入数据库日志
                log.log(exception);

                // 保持原处理
                $delegate(exception, cause);
            };
        });
     */


    /**
     * 2.捕获angular内异常,包括手动调用$log.error的异常
     */
    $provide.decorator("$log", function ($delegate, logDecorator) {
        return logDecorator($delegate);
    });

    /**
     * 3.捕获http异常
     */
    $httpProvider.interceptors.push(function ($q, $window, log) {
        return {
            /**
             * 请求暂不处理
             * @param config
             * @returns {*}
             */
            request: function (config) {
                config._time_start = (new Date()).getTime();
                return config;
            },
            /**
             * 记录http200的错误信息
             * @param response
             * @returns {*}
             */
            response: function (response) {
                if (response.data && response.data.errmsg) {
                    var exception = {
                        file: response.config.url,
                        message: $window.JSON.stringify(response.data),
                        remark: $window.JSON.stringify({config: response.config})
                    };

                    exception.message = 'http.error resultError: ' + exception.message;
                    console.error('http response result error', exception);

                    // 当异常为未登录时，总是记录为db日志
                    log.log(exception, response.data.errcode === 3002);
                }
                return response;
            },
            /**
             * 记录http错误信息
             * @param rejection
             * @returns {promise}
             */
            responseError: function (rejection) {
                var exception;
                var time_end;
                var time_duration;
                var message;
                var remark;

                // 状态异常消息
                message = rejection.status || '';
                if (rejection.statusText) {
                    message += '(' + rejection.statusText + ') ';
                }

                // 超时异常消息
                if (rejection.config._time_start) {
                    time_end = (new Date()).getTime();
                    time_duration = time_end - rejection.config._time_start;

                    if (rejection.config.timeout
                        && rejection.config.timeout != -1
                        && time_duration >= rejection.config.timeout) {
                        message += 'timeout';
                    }
                }

                // 增加统一处理
                message = 'http.error statusError: ' + (message || 'unknown');
                remark = (time_duration ? 'duration: ' + time_duration + 'ms ' : '');
                remark += $window.JSON.stringify(rejection);

                // 构建exception对象记录日志
                exception = {
                    file: rejection.config.url,
                    message: message,
                    remark: remark
                };
                console.error('http response error', exception);
                log.log(exception);

                return $q.reject(rejection);
            }
        };
    });
});

/**
 * 内置日志装饰器(装饰 $log.error 记录日志)
 */
myapp.factory('logDecorator', function (log) {
    return function ($delegate) {
        var oldError = $delegate.error;
        $delegate.error = function () {
            var exception;
            var messages = [];
            var messageSeparator = ' ';

            var toStr = function (o) {
                return typeof o === 'string' ? o : JSON.stringify(o);
            };

            // 1.执行原error
            oldError.apply($delegate, arguments);

            // 2.整合message
            //  TIP:
            //      1)传递多个参数时,按顺序拼接.
            //      2)以有message属性的参数为主error对象.
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

            // 3.整合error对象
            if (!exception) {
                exception = {message: messages.join(messageSeparator)};
            }
            exception.message = 'angular.error ' + exception.message;

            // 4.记录日志
            log.log(exception);
        };

        return $delegate;
    };
});

/**
 * 记录日志
 */
myapp.factory('log', function ($window, localStorageKeys) {
    var _self;

    /**
     * 设备
     * @type {{ready}}
     * @private
     */
    var _device = (function () {
        var _isReady;
        var _appVersion;

        return {
            /**
             * Cordova插件准备就绪
             * @param finallyCallback
             */
            ready: function (finallyCallback) {
                var timeout = 10 * 1000;

                if (_isReady) {
                    finallyCallback(true);
                } else {
                    $window.document.addEventListener("deviceready", function () {
                        console.log('device is ready');
                        _isReady = true;
                        finallyCallback(true);
                    }, false);
                }

                setTimeout(function () {
                    if (!_isReady) {
                        console.error('device was not ready after ' + timeout / 1000 + 's.');
                        finallyCallback(false);
                    }
                }, timeout);
            },
            /**
             * 获取设备信息（在ready后调用）
             * @returns {*}
             */
            getDeviceInfo: function () {
                return $window.device;
            },
            /**
             * 获取app版本
             * @returns {*}
             */
            getAppVersion: function () {
                var version;
                var webVersion;
                var appVersion;

                if (_appVersion) {
                    return _appVersion;
                }

                appVersion = $window._APP_VERSION;
                if (!appVersion) {
                    return 'unknown';
                }

                version = $window.localStorage.getItem(localStorageKeys.VERSION);
                if (version) {
                    version = JSON.parse(version);
                }
                if (version && appVersion === version.app_version && version.web_version) {
                    webVersion = version.web_version;
                }
                webVersion = webVersion || '00';

                _appVersion = appVersion + webVersion;
                return _appVersion;
            },
            /**
             * 网络
             */
            network: {
                getConnectionType: function () {
                    var type = $window.navigator
                        && $window.navigator.connection
                        && $window.navigator.connection.type;

                    if (type) {
                        return type;
                    } else {
                        console.error('获取网络信息失败');
                        return null;
                    }
                },
                getConnectionEnum: function () {
                    var connection = $window.Connection;

                    if (connection) {
                        return connection;
                    } else {
                        console.error('获取网络信息枚举失败');
                        return {};
                    }
                }
            }
        };
    })();

    /**
     * 获取用户
     * @returns {*}
     * @private
     */
    var _getUser = function () {
        var user = $window.localStorage.getItem(localStorageKeys.CONTEXT_USER);
        if (user) {
            user = $window.JSON.parse(user);
            if (user) {
                return {
                    tenant_code: user.tenant_code,
                    user_code: user.user_code,
                    access_token: user.access_token
                };
            }
        }
        return {};
    };

    /**
     * 获取当前时间
     * @returns {string}
     * @private
     */
    var _getNowTime = function () {
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth() + 1;
        var day = now.getDate();
        var hours = now.getHours();
        var minute = now.getMinutes();
        var second = now.getSeconds();

        if (month < 10) {
            month = '0' + month;
        }

        if (day < 10) {
            day = '0' + day;
        }

        if (hours < 10) {
            hours = '0' + hours;
        }

        if (minute < 10) {
            minute = '0' + minute;
        }

        if (second < 10) {
            second = '0' + second;
        }

        return year + '-' + month + '-' + day + ' ' + hours + ':' + minute + ':' + second;
    };

    /**
     * 结果集行获取为数组
     * @param rows
     * @returns {Array}
     * @private
     */
    var _getRowsToArray = function (rows) {
        rows = rows || [];
        var result = [];
        for (var i = 0, iLen = rows.length; i < iLen; i++) {
            result.push(rows.item(i));
        }
        return result;
    };

    /**
     * 转换为服务器exception对象
     * @param exceptions
     * @returns {Array}
     * @private
     */
    var _convertToServerException = function (exceptions) {
        var serverExceptions = [];
        var serverException;
        var errorObject;
        var deviceInfo;

        angular.forEach(exceptions, function (exception) {
            serverException = {
                tenant_code: exception.tenant_code,
                user_account: exception.user_code,
                occurred_date: exception.time || _getNowTime()
            };

            deviceInfo = angular.extend({}, _device.getDeviceInfo());
            if (deviceInfo) {
                deviceInfo.app_version = _device.getAppVersion();
                deviceInfo.upload_log_network = _device.network.getConnectionType();
                serverException.device_info = JSON.stringify(deviceInfo);
            }

            errorObject = {};
            if (exception.file || exception.sourceURL || exception.fileName) {
                errorObject.file = exception.file || exception.sourceURL || exception.fileName;
            }
            if (exception.line) {
                errorObject.line = exception.line;
            }
            if (exception.column) {
                errorObject.column = exception.column;
            }
            if (exception.message) {
                errorObject.message = exception.message;
            }
            if (exception.stack) {
                errorObject.stack = exception.stack;
            }
            if (exception.remark) {
                errorObject.remark = exception.remark;
            }

            serverException.error_object = JSON.stringify(errorObject);

            serverExceptions.push(serverException);
        });

        return serverExceptions;
    };

    var _db;
    var _dbName = '_log';
    var _sqlCreateTable = ' \
        CREATE TABLE IF NOT EXISTS error ( \
            id INTEGER PRIMARY KEY AUTOINCREMENT,\
            file TEXT,\
            line INTEGER,\
            column INTEGER,\
            message TEXT,\
            stack TEXT,\
            remark TEXT,\
            tenant_code TEXT,\
            user_code TEXT,\
            time datetime default (datetime(\'now\',\'localtime\'))\
        );';

    return _self = {
        /**
         * 初始化日志处理
         * @param successCallback
         * @param finallyCallback
         */
        init: function (successCallback, finallyCallback) {
            if (_db) {
                successCallback && successCallback();
                finallyCallback && finallyCallback(true);
            } else {
                _device.ready(function (ready) {
                    if (ready) {
                        $window.sqlitePlugin.openDatabase(_dbName,
                            function (openedDb) {
                                openedDb.executeSql(_sqlCreateTable, [],
                                    function () {
                                        _db = openedDb;
                                        successCallback && successCallback();
                                        finallyCallback && finallyCallback(true);
                                    }, function (error) {
                                        console.error('log_init_executeSql:error', error && error.message, error);
                                        finallyCallback && finallyCallback(false);
                                    });
                            }, function (error) {
                                console.error('log_init_getDb:error', error && error.message, error);
                                finallyCallback && finallyCallback(false);
                            }
                        );
                    } else {
                        finallyCallback && finallyCallback(false);
                    }
                });
            }
        },

        /**
         * 记录日志
         * @param exception {*|object} 异常对象
         * @param isAlwaysToDB {*|boolean} 可选，是否总是记录到db
         * @param doConsoleError {*|boolean} 可选，是否输出到console.error
         */
        log: function (exception, isAlwaysToDB, doConsoleError) {

            console.log(exception);

            if (doConsoleError) {
                console.error(exception.message || 'error', exception);
            }

            _self.init(function () {
                // 异常信息加入当前用户信息
                var user = _getUser();
                exception.tenant_code = user.tenant_code;
                exception.user_code = user.user_code;

                // 强制db、未登录、非wifi，时均记录到db，否则记录到服务器
                if (isAlwaysToDB || !user.access_token || _device.network.getConnectionType()
                    !== _device.network.getConnectionEnum().WIFI) {

                    _self.logToDb(exception);
                } else {
                    _self.logToServer([exception], null, function () {
                        // 当上传服务器失败时，记录本地数据库
                        _self.logToDb(exception);
                    });
                }
            });
        },

        /**
         * 记录到数据库
         * @param exception
         */
        logToDb: function (exception) {
            _self.init(function () {
                var sql = '\
                    insert into error ( \
                        file,column,line,message,stack,remark,tenant_code,user_code \
                    ) values (\
                        ?,?,?,?,?,?,?,? \
                    )';

                exception.remark = 'db_log_network:' + _device.network.getConnectionType()
                    + ' ' + ( exception.remark || '');

                _db.executeSql(sql, [
                        exception.file || exception.sourceURL || exception.fileName,
                        exception.column, exception.line, exception.message,
                        exception.stack, exception.remark,
                        exception.tenant_code, exception.user_code
                    ],
                    function () {
                        console.log('logToDb:ok');
                    }, function (error) {
                        console.error('logToDb:error', error);
                    });
            });
        },

        /**
         * 记录日志到服务器
         * @param exceptions
         * @param successCallback
         * @param errorCallback
         */
        logToServer: function (exceptions, successCallback, errorCallback) {
            _self.init(null, function (success) {
                if (success) {
                    var xhr;
                    var user = _getUser();

                    if (!user.access_token) {
                        console.warn('logToServer:用户未登录');
                        errorCallback && errorCallback();
                        return;
                    }
                    if (!$window.jQuery || !$window.jQuery.ajax) {
                        _self.log({message: 'logToServer:jQuery.ajax is undefined'}, true, true);
                        errorCallback && errorCallback();
                        return;
                    }

                    console.log('logToServer:start', exceptions.length);

                    // 这里不使用$http，避免循环依赖
                    xhr = $window.jQuery.ajax({
                        url: apiDomain + '/log/upload-log-error-list?access_token=' + user.access_token,
                        method: 'POST',
                        data: JSON.stringify(_convertToServerException(exceptions)),
                        dataType: 'json',
                        timeout: 30000,
                        async: true
                    });

                    xhr.done(function (data) {
                        if (data && !data.errmsg) {
                            console.log('logToServer:ok');
                            successCallback && successCallback();
                        } else {
                            _self.log({message: 'logToServer:' + data.errmsg}, true, true);
                            errorCallback && errorCallback();
                        }
                    });

                    xhr.fail(function (jqXHR, textStatus, errorThrown) {
                        _self.log({message: 'logToServer:' + textStatus + ',' + errorThrown}, true, true);
                        errorCallback && errorCallback();
                    });
                } else {
                    errorCallback && errorCallback();
                }
            });
        },

        /**
         * 上传数据库日志
         * @param {number} [countPerCommit=1000] 每次提交的条数
         */
        uploadDbLog: function (countPerCommit) {
            // NOTE:期间的失败均记录数据库日志，并终止上传

            _self.init(function () {
                var sqlSelect = 'select * from error limit ?';
                var sqlDelete = "delete from error where id in ('?')";

                if (_device.network.getConnectionType()
                    !== _device.network.getConnectionEnum().WIFI) {
                    console.log('uploadDbLog:current is not wifi');
                    return;
                }

                console.log('uploadDbLog:start');

                /**
                 * 取出本地异常数据
                 * @param successCallback
                 */
                var selectExceptions = function (successCallback) {
                    _db.executeSql(sqlSelect, [countPerCommit || 1000],
                        function (result) {
                            var ids = [];
                            var exceptions = [];

                            console.log('uploadDbLog:prepare count ' + result.rows.length);
                            if (result.rows.length) {
                                var item;
                                for (var i = 0, iLen = result.rows.length; i < iLen; i++) {
                                    item = result.rows.item(i);

                                    ids.push(item.id);
                                    exceptions.push(item);
                                }

                                successCallback(ids, exceptions);
                            }
                        }, function (error) {
                            error.remark = 'uploadDbLog';
                            _self.log(error, true, true);
                        });
                };

                /**
                 * 删除本地异常数据
                 * @param ids
                 * @param successCallback
                 */
                var deleteExceptions = function (ids, successCallback) {
                    sqlDelete = sqlDelete.replace('?', ids.join("','"));
                    _db.executeSql(sqlDelete, [],
                        function (result) {
                            if (!result.rowsAffected) {
                                _self.log({message: 'uploadDbLog:delete uploaded record 0 length'}, true, true);
                                return;
                            }
                            console.log('uploadDbLog:delete uploaded record success');
                            successCallback && successCallback();
                        }, function (error) {
                            error.remark = 'uploadDbLog.deleteExceptions';
                            _self.log(error, true, true);
                        });
                };


                // 1.取出最近N个异常
                selectExceptions(function (ids, exceptions) {
                    // 2.记录其id，并上传
                    _self.logToServer(exceptions, function () {
                        // 3.上传成功后，删除这些异常，再次执行1。
                        deleteExceptions(ids, function () {
                            _self.uploadDbLog(countPerCommit);
                        });
                    });
                });
            });
        },

        /**
         * 查询日志
         */
        queryLog: function () {
            _self.init(function () {
                var sql = 'select * from error';
                _db.executeSql(sql, [],
                    function (result) {
                        console.log(_getRowsToArray(result));
                    }, function (error) {
                        console.error('queryLog:error', error);
                    });
            });
        }
    };
});