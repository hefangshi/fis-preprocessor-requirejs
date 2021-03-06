var esprima = require('esprima');
var parse = require('./vendor/parse.js');

//本文件修改自https://github.com/jrburke/r.js/blob/master/build/jslib/transform.js

/**
 * 处理AMD模块依赖解析与规范化工作
 * @param  {[type]} file 当前处理文件，用于获取匿名模块ID与添加依赖关系
 * @param  {[type]} contents 处理的脚本内容（对于HTML文件，一个文件可能传入多个内嵌脚本）
 * @param  {[type]} idNormalizer ID规范化函数
 * @return {[type]}
 */
function transform(file, contents, idNormalizer, asyncList, conf){
    var astRoot, contentLines, modLine,
        foundAnon,
        scanCount = 0,
        scanReset = false,
        defineInfos = [],
        ids = [],
        moduleName = file.getId();

    asyncList = asyncList || [],
    idNormalizer = idNormalizer || function(path){
        return path;
    };

    try {
        astRoot = esprima.parse(contents, {
            loc: true
        });
    } catch (e) {
        fis.log.notice('toTransport skipping ' + file.realpath + ': ' +
                     e.toString());
        return contents;
    }

    //Find the define calls and their position in the files.
    parse.traverse(astRoot, function (node) {
        var args, firstArg, firstArgLoc, factoryNode,
            needsId, depAction, foundId, init,
            sourceUrlData, range, needsNormalize;

        // If a bundle script with a define declaration, do not
        // parse any further at this level. Likely a built layer
        // by some other tool.
        if (node.type === 'VariableDeclarator' &&
            node.id && node.id.name === 'define' &&
            node.id.type === 'Identifier') {
            init = node.init;
            if (init && init.callee &&
                init.callee.type === 'CallExpression' &&
                init.callee.callee &&
                init.callee.callee.type === 'Identifier' &&
                init.callee.callee.name === 'require' &&
                init.callee.arguments && init.callee.arguments.length === 1 &&
                init.callee.arguments[0].type === 'Literal' &&
                init.callee.arguments[0].value &&
                init.callee.arguments[0].value.indexOf('amdefine') !== -1) {
                // the var define = require('amdefine')(module) case,
                // keep going in that case.
            } else {
                return false;
            }
        }

        //识别require('path/to/module')与require(['path/to/module'])
        if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require'){
            args = node.arguments;
            if (args && args.length) {
                firstArg = args[0];
                if (firstArg.type === 'Literal' && typeof firstArg.value === 'string'){
                    //require('path/to/module')
                    ids.push(firstArg);
                }else if (firstArg.type === 'ArrayExpression' && firstArg.elements.length !== 0){
                    //require(['path/to/module'])
                    firstArg.elements.forEach(function(element){
                        element.async = true;
                        ids.push(element);
                    });
                }
            }
        }

        if (parse.isDefineNodeWithArgs(node)) {
            //The arguments are where its at.
            args = node.arguments;
            if (!args || !args.length) {
                return;
            }

            firstArg = args[0];
            firstArgLoc = firstArg.loc;

            if (args.length === 1) {
                needsNormalize = false;
                if (firstArg.type === 'Identifier') {
                    //The define(factory) case, but
                    //only allow it if one Identifier arg,
                    //to limit impact of false positives.
                    needsId = true;
                    depAction = 'empty';
                } else if (firstArg.type === 'FunctionExpression') {
                    //define(function(){})
                    factoryNode = firstArg;
                    needsId = true;
                    depAction = 'scan';
                } else if (firstArg.type === 'ObjectExpression') {
                    //define({});
                    needsId = true;
                    depAction = 'skip';
                } else if (firstArg.type === 'Literal' &&
                           typeof firstArg.value === 'number') {
                    //define('12345');
                    needsId = true;
                    depAction = 'skip';
                } else if (firstArg.type === 'UnaryExpression' &&
                           firstArg.operator === '-' &&
                           firstArg.argument &&
                           firstArg.argument.type === 'Literal' &&
                           typeof firstArg.argument.value === 'number') {
                    //define('-12345');
                    needsId = true;
                    depAction = 'skip';
                } else if (firstArg.type === 'MemberExpression' &&
                           firstArg.object &&
                           firstArg.property &&
                           firstArg.property.type === 'Identifier') {
                    //define(this.key);
                    needsId = true;
                    depAction = 'empty';
                }
            } else if (firstArg.type === 'ArrayExpression') {
                //define([], ...);
                needsId = true;
                depAction = 'skip';
                firstArg.elements.forEach(function(element){
                    element.async = true;
                    ids.push(element);
                });
            } else if (firstArg.type === 'Literal' &&
                       typeof firstArg.value === 'string') {
                //define('string', ....)
                //Already has an ID.
                needsId = false;
                needsNormalize = [firstArg];
                if (args.length === 2 &&
                    args[1].type === 'FunctionExpression') {
                    //Needs dependency scanning.
                    factoryNode = args[1];
                    depAction = 'scan';
                } else {
                    depAction = 'skip';
                }
            } else {
                //Unknown define entity, keep looking, even
                //in the subtree for this node.
                return;
            }

            range = {
                foundId: foundId,
                needsNormalize: needsNormalize,
                needsId: needsId,
                depAction: depAction,
                node: node,
                defineLoc: node.loc,
                firstArgLoc: firstArgLoc,
                factoryNode: factoryNode,
                sourceUrlData: sourceUrlData
            };

            //Only transform ones that do not have IDs. If it has an
            //ID but no dependency array, assume it is something like
            //a phonegap implementation, that has its own internal
            //define that cannot handle dependency array constructs,
            //and if it is a named module, then it means it has been
            //set for transport form.
            if (range.needsNormalize){
                ids = ids.concat(range.needsNormalize);
            }
            if (range.needsId) {
                if (foundAnon) {
                    logger.trace(file.realpath + ' has more than one anonymous ' +
                        'define. May be a built file from another ' +
                        'build system like, Ender. Skipping normalization.');
                    defineInfos = [];
                    return false;
                } else {
                    foundAnon = range;
                    defineInfos.push(range);
                }
            } else if (depAction === 'scan') {
                scanCount += 1;
                if (scanCount > 1) {
                    //Just go back to an array that just has the
                    //anon one, since this is an already optimized
                    //file like the phonegap one.
                    if (!scanReset) {
                        defineInfos =  foundAnon ? [foundAnon] : [];
                        scanReset = true;
                    }
                } else {
                    defineInfos.push(range);
                }
            }
        }
    });


    if (!defineInfos.length && !ids.length) {
        return contents;
    }

    //Reverse the matches, need to start from the bottom of
    //the file to modify it, so that the ranges are still true
    //further up.
    defineInfos.reverse();

    contentLines = contents.split('\n');

    modLine = function (loc, contentInsertion) {
        var startIndex = loc.start.column,
        //start.line is 1-based, not 0 based.
        lineIndex = loc.start.line - 1,
        line = contentLines[lineIndex];
        contentLines[lineIndex] = line.substring(0, startIndex) +
                                   contentInsertion +
                                   line.substring(startIndex,
                                                      line.length);
    };

    ids.reverse();

    //反向进行ID标准化
    ids.forEach(function (id){
        var loc = id.loc,
        startIndex = loc.start.column,
        endIndex = loc.end.column,
        //start.line is 1-based, not 0 based.
        lineIndex = loc.start.line - 1,
        line = contentLines[lineIndex];
        var idWithNs = idNormalizer(file, id.value, conf);
        contentLines[lineIndex] = line.substring(0, startIndex+1) + idWithNs + line.substring(endIndex-1, line.length);
        if (id.async && /^(http|https):\/\//i.test(idWithNs) === false && ['module','require','exports'].indexOf(idWithNs) === -1){
            asyncList.push(idWithNs);
        }
    });

    defineInfos.forEach(function (info) {
        var deps,
            contentInsertion = '',
            depString = '';

        //Do the modifications "backwards", in other words, start with the
        //one that is farthest down and work up, so that the ranges in the
        //defineInfos still apply. So that means deps, id, then namespace.
        if (info.needsId && moduleName) {
            contentInsertion += "'" + moduleName + "',";
        }

        if (info.depAction === 'scan') {
            deps = parse.getAnonDepsFromNode(info.factoryNode);
            deps = deps.filter(function(value, index, self){
                return self.indexOf(value) === index;
            });
            if (deps.length) {
                depString = '[' + deps.map(function (dep) {
                    //将依赖项替换为ID
                    dep = idNormalizer(file, dep, conf);
                    return "'" + dep + "'";
                }) + ']';
            } else {
                depString = '[]';
            }
            depString +=  ',';

            if (info.factoryNode) {
                //Already have a named module, need to insert the
                //dependencies after the name.
                modLine(info.factoryNode.loc, depString);
            } else {
                contentInsertion += depString;
            }
        }

        if (contentInsertion) {
            modLine(info.firstArgLoc, contentInsertion);
        }
    });

    contents = contentLines.join('\n');

    return contents;
}

module.exports = transform;