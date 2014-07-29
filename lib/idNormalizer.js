function idNormalizer(file, path){
    var namespace = fis.config.get('namespace'),
        connector = fis.config.get('namespaceConnector', ':'),
        id, realpath;
    if (path.indexOf('.') === 0){
        //尝试添加.js后缀用于符合requirejs标准
        realpath = file.dirname + '/' + path + '.js';
        if (!fis.util.exists(realpath)){
            //添加.js后缀后找不到资源，按原始路径处理
            realpath = file.dirname + '/' + path;
        }
        return fis.file.wrap(realpath).getId();
    }else if (path.indexOf('/') === 0){
        //尝试添加.js后缀用于符合requirejs标准
        realpath = fis.project.getProjectPath() + path + '.js';
        if (!fis.util.exists(realpath)){
            //添加.js后缀后找不到资源，按原始路径处理
            realpath = fis.project.getProjectPath() + path;
        }
        return fis.file.wrap(realpath).getId();
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

module.exports = idNormalizer;