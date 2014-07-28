var transform = require('./lib/transform.js');

module.exports = function (content, file, opt) {

    function idNormalizer(file, path){
        var namespace = fis.config.get('namespace'),
            connector = fis.config.get('namespaceConnector', ':'),
            id;
        if (path.indexOf('.') !== -1){
            return fis.file.wrap(file.dirname + '/' + path + '.js').getId();
        }else if (['require','module','exports'].indexOf(path) !== -1){
            return path;
        }else if (/^(http|https):\/\//i.test(path)){
            //外部链接直接使用原路径
            return path;
        }else if (namespace && path.split(connector).length === 1){
            //指定依赖不包含namespace时添加namespace
            return namespace + connector + path;
        }else{
            return path;
        }
    }

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
        return transform(file, content, idNormalizer);
    }

    if (file.isHtmlLike) {
        content = extHtml(file, content, opt);
    }else if (file.isJsLike){
        content = extJs(file, content, opt);
    }

    return content;
};