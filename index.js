var transform = require('./lib/transform.js');
var idNormalizer = require('./lib/idNormalizer.js');
var pathCache;
function extHtml(file, content, opt, normalizer){
    var reg = /(<script(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>))([\s\S]*?)(?=<\/script\s*>|$)|<!--(?!\[)([\s\S]*?)(-->|$)/ig;
    var replace = function(m, $1, $2, $3, $4, $5, $6, $7, $8){
        if($1){//<script>
            if (/(\ssrc\s*=\s*)('[^']+'|"[^"]+"|[^\s\/>]+)/ig.test($1) === false){
                if(!/\s+type\s*=/i.test($1) || /\s+type\s*=\s*(['"]?)text\/javascript\1/i.test($1)) {
                    //处理内嵌脚本
                    m = $1 + extJs(file ,$2, opt, normalizer);
                }
            }
        }
        return m;
    };
    return content.replace(reg, replace);
}

function extJs(file, content, opt, normalizer){
    var asyncList = [];
    content = transform(file, content, normalizer, asyncList);
    if (asyncList.length){
        if (file.extras.requirejs && file.extras.requirejs.syncLoad){
            asyncList.forEach(function(id){
                file.addRequire(id);
            });
        }else{
            file.extras.async = file.extras.async || [];
            file.extras.async = file.extras.async.concat(asyncList);
        }
    }
    return content;
}

function initPathCache(opt){
    if (pathCache)
        return;
    pathCache = {};
    var paths = opt.paths || {};
    var url = opt.baseUrl || ".";
    fis.util.map(paths, function(key, path){
        var file = fis.util(fis.project.getProjectPath(), url + "/" + path + ".js");
        if (file){
            pathCache[file] = key;
        }
    });
}

module.exports = function (content, file, opt) {
    initPathCache(opt);
    if (pathCache[file.realpath]){
        file.id = pathCache[file.realpath];
    }
    var normalizer = idNormalizer(opt, pathCache);
    if (file.isHtmlLike) {
        content = extHtml(file, content, opt, normalizer);
    }else if (file.isJsLike){
        content = extJs(file, content, opt, normalizer);
    }
    return content;
};

module.exports.extJs = extJs;
module.exports.transform = transform;
module.exports.idNormalizer = idNormalizer;
