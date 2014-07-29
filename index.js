var transform = require('./lib/transform.js');
var idNormalizer = require('./lib/idNormalizer.js');

function extHtml(file, content, opt){
    var reg = /(<script(?:(?=\s)[\s\S]*?["'\s\w\/\-]>|>))([\s\S]*?)(?=<\/script\s*>|$)|<!--(?!\[)([\s\S]*?)(-->|$)/ig;
    var replace = function(m, $1, $2, $3, $4, $5, $6, $7, $8){
        if($1){//<script>
            if (/(\ssrc\s*=\s*)('[^']+'|"[^"]+"|[^\s\/>]+)/ig.test($1) === false){
                if(!/\s+type\s*=/i.test($1) || /\s+type\s*=\s*(['"]?)text\/javascript\1/i.test($1)) {
                    //处理内嵌脚本
                    m = $1 + extJs(file ,$2, opt);
                }
            }
        }
        return m;
    };
    return content.replace(reg, replace);
}

function extJs(file, content,  opt){
    var asyncList = [];
    content = transform(file, content, idNormalizer, asyncList);
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

module.exports = function (content, file, opt) {
    if (file.isHtmlLike) {
        content = extHtml(file, content, opt);
    }else if (file.isJsLike){
        content = extJs(file, content, opt);
    }
    return content;
};

module.exports.extJs = extJs;
module.exports.transform = transform;
module.exports.idNormalizer = idNormalizer;
