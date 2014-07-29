function idNormalizer(conf){
    var requirejs = require("./require.js");
    requirejs.config(conf);

    return function(file, moduleName){
        var id, realpath,
            root = fis.project.getProjectPath(),
            syms, parentModule, parentPath;
        if (moduleName.indexOf('.') === 0){
            //尝试添加.js后缀用于符合requirejs标准
            realpath = file.dirname + '/' + moduleName + '.js';
            if (!fis.util.exists(realpath)){
                //添加.js后缀后找不到资源，按原始路径处理
                realpath = file.dirname + '/' + moduleName;
            }
            return fis.file.wrap(realpath).getId();
        }else if (moduleName.indexOf('/') === 0){
            //尝试添加.js后缀用于符合requirejs标准
            realpath = fis.project.getProjectPath() + moduleName + '.js';
            if (!fis.util.exists(realpath)){
                //添加.js后缀后找不到资源，按原始路径处理
                realpath = fis.project.getProjectPath() + moduleName;
            }
            return fis.file.wrap(realpath).getId();
        }else if (['require','module','exports'].indexOf(moduleName) !== -1){
            return moduleName;
        }else if (/^(http|https):\/\//i.test(moduleName)){
            //外部链接直接使用原路径
            return moduleName;
        }else{
            var relativePath = requirejs.toUrl(moduleName);
            realpath = fis.project.getProjectPath() + '/' + relativePath + '.js';
            if (!fis.util.exists(realpath)){
                //添加.js后缀后找不到资源，按原始路径处理
                realpath = fis.project.getProjectPath() + '/' + relativePath;
                if (!fis.util.exists(realpath)){
                    return moduleName;
                }
            }
            return fis.file.wrap(realpath).getId();
        }
    };
}

module.exports = idNormalizer;