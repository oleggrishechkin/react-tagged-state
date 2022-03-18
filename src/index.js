'use strict';
exports.__esModule = true;
exports.useSignalEffect =
    exports.useSelector =
    exports.useSignal =
    exports.createEffect =
    exports.createComputed =
    exports.createEvent =
    exports.createSignal =
    exports.sample =
        void 0;

var react_1 = require('react');

var currentSub = null;
var batchedObjsSubs = null;
var scheduleNotify = function (subs) {
    if (batchedObjsSubs) {
        batchedObjsSubs.add(subs);

        return;
    }

    batchedObjsSubs = new Set([subs]);
    Promise.resolve().then(function () {
        var objsSubs = batchedObjsSubs;

        batchedObjsSubs = null;

        // We need to collect all subs to calling each of them once
        var uniqueSubs = new Set();

        objsSubs.forEach(function (objSubs) {
            return objSubs.forEach(function (sub) {
                return uniqueSubs.add(sub);
            });
        });
        uniqueSubs.forEach(function (sub) {
            return sub.__callback();
        });
    });
};
var createSub = function (callback) {
    return {
        __callback: callback,
        __cleanups: new Set()
    };
};
var unsubscribe = function (sub) {
    var cleanups = sub.__cleanups;

    sub.__cleanups = new Set();
    cleanups.forEach(function (cleanup) {
        return cleanup(sub);
    });
};
var autoSubscribe = function (func, sub) {
    var prevCleanups = sub.__cleanups;

    sub.__cleanups = new Set();

    var prevGlobalSub = currentSub;

    currentSub = sub;

    var value = func();

    currentSub = prevGlobalSub;
    // If prev obj has not in next objs we need to unsubscribe from it
    prevCleanups.forEach(function (cleanup) {
        if (sub.__cleanups.has(cleanup)) {
            return;
        }

        cleanup(sub);
    });

    return value;
};
var sample = function (obj) {
    var prevGlobalSub = currentSub;

    currentSub = null;

    var value = obj();

    currentSub = prevGlobalSub;

    return value;
};

exports.sample = sample;

var createSignal = function (initializer) {
    var value = typeof initializer === 'function' ? initializer() : initializer;
    var subs = new Set();
    var cleanup = function (subToDelete) {
        return subs['delete'](subToDelete);
    };
    var signal = Object.assign(
        function () {
            var args = [];

            for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
            }

            if (args.length) {
                var nextValue = typeof args[0] === 'function' ? args[0](value) : args[0];

                if (nextValue === value) {
                    return value;
                }

                value = nextValue;

                // We don't need to add signal to the batchedObjs if signal has no subs
                if (subs.size) {
                    scheduleNotify(subs);
                }

                return value;
            }

            if (currentSub) {
                subs.add(currentSub);
                currentSub.__cleanups.add(cleanup);
            }

            return value;
        },
        {
            on: function (callback) {
                var sub = createSub(function () {
                    return callback(signal());
                });

                autoSubscribe(signal, sub);

                return function () {
                    return unsubscribe(sub);
                };
            }
        }
    );

    return signal;
};

exports.createSignal = createSignal;

var createEvent = function () {
    var callbacks = new Set();
    var event = Object.assign(
        function (payload) {
            callbacks.forEach(function (callback) {
                return callback(payload);
            });

            return payload;
        },
        {
            on: function (callback) {
                callbacks.add(callback);

                return function () {
                    callbacks['delete'](callback);
                };
            }
        }
    );

    return event;
};

exports.createEvent = createEvent;

var createComputed = function (selector) {
    var value;
    var subs = new Set();
    var sub = createSub(function () {
        if (subs.size) {
            var nextValue = autoSubscribe(selector, sub);

            if (nextValue !== value) {
                value = nextValue;
                scheduleNotify(subs);
            }

            return;
        }

        unsubscribe(sub);
    });
    var cleanup = function (subToDelete) {
        return subs['delete'](subToDelete);
    };
    var computed = Object.assign(
        function () {
            if (currentSub) {
                subs.add(currentSub);
                currentSub.__cleanups.add(cleanup);
            }

            if (sub.__cleanups.size) {
                return value;
            }

            value = autoSubscribe(selector, sub);

            return value;
        },
        {
            on: function (callback) {
                var sub = createSub(function () {
                    return callback(computed());
                });

                autoSubscribe(computed, sub);

                return function () {
                    return unsubscribe(sub);
                };
            }
        }
    );

    return computed;
};

exports.createComputed = createComputed;

var createEffect = function (effect) {
    var value;
    var sub = createSub(function () {
        if (typeof value === 'function') {
            value();
        }

        value = autoSubscribe(effect, sub);
    });

    value = autoSubscribe(effect, sub);

    return function () {
        if (typeof value === 'function') {
            value();
        }

        unsubscribe(sub);
    };
};

exports.createEffect = createEffect;

var useSyncExternalStoreShim =
    typeof react_1.useSyncExternalStore === 'undefined'
        ? function (subscribe, getSnapshot) {
              var value = getSnapshot();
              var _a = (0, react_1.useState)({ inst: { value: value, getSnapshot: getSnapshot } }),
                  inst = _a[0].inst,
                  forceUpdate = _a[1];

              (0, react_1.useLayoutEffect)(
                  function () {
                      inst.value = value;
                      inst.getSnapshot = getSnapshot;

                      if (inst.value !== inst.getSnapshot()) {
                          forceUpdate({ inst: inst });
                      }
                      // eslint-disable-next-line react-hooks/exhaustive-deps
                  },
                  [value, getSnapshot]
              );
              (0, react_1.useEffect)(
                  function () {
                      if (inst.value !== inst.getSnapshot()) {
                          forceUpdate({ inst: inst });
                      }

                      return subscribe(function () {
                          if (inst.value !== inst.getSnapshot()) {
                              forceUpdate({ inst: inst });
                          }
                      });
                      // eslint-disable-next-line react-hooks/exhaustive-deps
                  },
                  [subscribe]
              );

              return value;
          }
        : react_1.useSyncExternalStore;
var useSignal = function (obj) {
    return useSyncExternalStoreShim(obj.on, obj);
};

exports.useSignal = useSignal;

var useSignalEffect = function (effect, deps) {
    return (0, react_1.useEffect)(function () {
        return createEffect(effect);
    }, deps);
};

exports.useSignalEffect = useSignalEffect;

var useSelector = function (obj) {
    var vars = (0, react_1.useRef)(null);

    if (vars.current === null) {
        vars.current = {
            sub: createSub(function () {}),
            handleChange: function () {},
            subscribe: function (handleChange) {
                vars.current.handleChange = handleChange;

                return function () {
                    return unsubscribe(vars.current.sub);
                };
            }
        };
    }

    var value = autoSubscribe(obj, vars.current.sub);

    // We need to set sub callback because value and obj can be different during component re-render
    vars.current.sub.__callback = function () {
        value = autoSubscribe(obj, vars.current.sub);
        vars.current.handleChange();
    };

    // We just return value from closure inside getSnapshot because we are already subscribed
    return useSyncExternalStoreShim(vars.current.subscribe, function () {
        return value;
    });
};

exports.useSelector = useSelector;
