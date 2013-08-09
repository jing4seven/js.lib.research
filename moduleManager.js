// MODULE MANAGER
// Translate and Copy from www.facebook.com
;(function(gbl) {
    if (gbl.require) return;
    var modules  = {},
    modRefCount  = {},
    waitingDict  = {},
    aysNumbers   = 0, // use for anonymous module names.
    // load mode flag:
    // cooperate with module's 'special' field.
    // if 'special & flag' equal to true as well as current module
    // has no waiting modules, callback method will be invoked
    // immediately, otherwise, it will be run at the time it be
    // invoked explicitly, such as 'require("modulename")'.
    flag         = 1,
    specialValue = 2,
    hasProp      = Object.prototype.hasOwnProperty,
    toStr        = Object.prototype.toString;

    // Resolve a moudle which will also load all dependencies
    // @modName : module's name.
    function require(modName) {
        var modObj = modules[modName],
        depModName,i,errMsg;
        if (!modules[modName]) {
            errMsg = 'Requiring unknown module"' + modName + '"';
            throw new Error(errMsg);
        }
        if (modObj.hasError) throw new Error('Requiring module "'
                + modName+ '" which threw an exception');
        if (modObj.waiting) {
            errMsg = 'Requiring module "' + modName
                + '" with unresolved dependencies';
            throw new Error(errMsg);
        }

        if (!modObj.exports) {
            var epts = modObj.exports = {},
            foo = modObj.factory;
            if (toStr.call(foo) === '[object Function]') {
                var deps = modObj.dependencies,
                depsLength = deps.length,
                depArray = [],
                wrapFactory;
                if (modObj.special & specialValue) {
                    depsLength = Math.min(depsLength, foo.length)
                }
                try {
                    for (i=0;i<depsLength;i++) {
                        depModName = deps[i];
                        depArray.push(depModName === 'module'? modObj : (depModName === 'exports' ? epts : require(depModName)));
                    }
                    wrapFactory = foo.apply(modObj.context || gbl, depArray);
                } catch (err) {
                    modObj.hasError = true;
                    throw err;
                }
                if (wrapFactory) modObj.exports = wrapFactory;
            } else modObj.exports = foo;
        }
        if (modObj.refcount--===1) delete modules[modName];
        return modObj.exports;
    }

    // Define a module and register it to closure.
    // so it will be shared between all other modules.
    //
    // @modName : module's name.
    // @deps    : dependencies array, such as ['module1', 'module2']
    // @factory : factory method that define `exports` for
    //  current module.
    // @context : module's run context.
    // @refcount: reference module count, if current module depend on 1 other
    // module, it's value will be 1, if 2 then 2; contrarily, if it was referenced
    // by another module once, it's value will be -1.
    function define(modName, deps, factory, special, context, refcount) {
        // If only one argument provide,
        // we believe it is a factory method.
        if (deps === undefined) {
            deps = [];
            factory = modName;
            modName = getAnonymousModulename();
        // If two arguments provide
        } else if ( factory === undefined) {
            factory = deps;
            // First one argument is an instance of
            // object array, we seems it as `deps`
            if (toStr.call(modName) === '[object Array]') {
                deps = modName;
                modName = getAnonymousModulename();
            // If it's not an instance of object array,
            // we seems it as module name.
            } else deps = [];
        }

        var expts = {
            cancel: undefine.bind(this, modName)
        }, modObj = modules[modName];

        if (modObj) {
            if (refcount) modObj.refcount += refcount;
            return expts;
        } else if (!deps && !factory && refcount) {
            modRefCount[modName] = (modRefCount[modName]||0) + refcount;
            return expts;
        } else {
            modObj = {
                id: modName
            };
            modObj.refcount = (modRefCount[modName]||0)+(refcount||0);
            delete modRefCount[modName];
        }

        modObj.factory      = factory;
        modObj.dependencies = deps;
        modObj.context      = context;
        modObj.special      = special;
        modObj.waitingMap   = {};
        modObj.waiting      = 0;
        modObj.hasError     = false;
        modules[modName]    = modObj;
        loadModule(modName);
        return expts;
    }

    // Undefine a module.
    // @modName : module's name.
    function undefine(modName) {
        if (!modules[modName]) return;

        var modObj = modules[modName];
        delete modules[modName];
        for (var tempModName in modObj.waitingMap) {
            if (modObj.waitingMap[tempModName])
                delete waitingDict[tempModName][modName]
        }
        for (var i=0; i< modObj.dependencies.length; i++) {
            tempModName = modObj.dependencies[i];
            if (modules[tempModName]) {
                if (modules[tempModName].refcount-- === 1)
                    undefine(tempModName);
            } else if (modRefCount[tempModName]) {
                modRefCount[tempModName]--;
            }
        }
    }

    // Register Module
    // @modName:  module's name.
    // @factory:  factory moethod.
    function registerModule(modName, factory) {
        modules[modName] = {
            id: modName,
            exports: factory
        };
    }

    function requireLazy(modName, deps, context) {
        return define(modName, deps, undefined, flag, context, 1);
    }

    // Get anonymous module name
    function getAnonymousModulename() {
        return '__mod__' +  aysNumbers++;
    }

    // Add dependent module' name into current module's wating dict.
    // @modObj: current module object
    // @depModName: the dependent module's name that need to be added.
    function addIntoWaitingDict(modObj, depModName) {
        if (!modObj.waitingMap[depModName] && modObj.id != depModName) {
            // if current module need wait other modules, count it;
            modObj.waiting++;
            // set dependent module's name into `watingMap` prop of current
            // module, make it equal to 1.
            modObj.waitingMap[depModName] = 1;
            // set dependent module's name into closure variable
            // `waitingDict`, which store like that:
            // {
            //      'depModuleName':
            //      {
            //          'originalModuleName': 1
            //      }
            // }
            // That means: as a global view, 'originalModuleName' depends on
            // 'depModuleName'.
            waitingDict[depModName] || (waitingDict[depModName] = {});
            waitingDict[depModName][modObj.id] = 1;
        }
    }

    // Load module and it's dependencies;
    // @modName: the module's name which to be load.
    function loadModule(modName) {
        var modArray = [],
        modObj = modules[modName],
        tempModName, idx, waitingModName;

        for ( idx = 0; idx < modObj.dependencies.length; idx++) {
            tempModName = modObj.dependencies[idx];
            if (!modules[tempModName]) {
                addIntoWaitingDict(modObj, tempModName);
            } else if (modules[tempModName].waiting) {
                for (waitingModName in modules[tempModName].waitingMap) {
                    if (modules[waitingModName])
                        addIntoWaitingDict(modObj, waitingModName);
                }
            }
        }

        if (modObj.waiting === 0 && modObj.special & flag ) modArray.push(modName);
        if (waitingDict[modName]) {
            var watingModNameDict = waitingDict[modName],
            waitingModObj;
            waitingDict[modName] = undefined;
            for (tempModName in watingModNameDict) {
                waitingModObj = modules[tempModName];
                for (waitingModName in modObj.waitingMap)
                    if (modObj.waitingMap[waitingModName])
                        addIntoWaitingDict(waitingModObj, waitingModName);
                if (waitingModObj.waitingMap[modName]) {
                    waitingModObj.waitingMap[modName] = undefined;
                    waitingModObj.waiting--;
                }
                if (waitingModObj.waiting === 0 && waitingModObj.special & flag ) modArray.push(tempModName);
            }
        }

        // Invoke callback function for each modules.
        for (idx =0;idx<modArray.length; idx++) {
            require(modArray[idx]);
        }
    }

    // Register default modules.
    registerModule('module', 0);
    registerModule('exports', 0);
    registerModule('global', gbl);
    registerModule('define', define);
    registerModule('require', require);
    registerModule('requireDynamic', require);
    registerModule('requireLazy', requireLazy);

    // Make main function public in global.
    gbl.define         = define;
    gbl.require        = require;
    gbl.requireDynamic = require;
    gbl.requireLazy    = requireLazy;

    require.__debug = {
        modules: modules,
        deps: waitingDict
    };

    var defineWraper = function (modName, deps, factory, context) {
        define(modName, deps, factory, context || specialValue );
    }
    gbl.__d = function(modName, deps, factory, context) {
        deps = ['global', 'require', 'requireDynamic', 'requireLazy', 'module', 'exports'].concat(deps);
        defineWraper(modName, deps, factory, context)
    };

})(this);


