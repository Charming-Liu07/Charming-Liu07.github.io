---
title: 'Visual Studio Code C++配置方法'
date: 2021-05-05 12:44:41
tags: []
published: true
hideInList: false
feature: 
isTop: false
---
# Visual Studio Code C++配置方法

------------

### 第一次写博客，如有不周还请见谅！！
### 因为不想用Dev-C++了，还有就是~~Dev-C++太丑了！~~，想配置VSC.
## · 你要有一个VS code ！
#### 首先，去vscode官网下载vscode：[VScode官网](https://code.visualstudio.com/)，下载和安装就不用解释了。
## · 你还要有一个MinGW-W64  ！
#### mingw官网下载：[mingw官网](https://sourceforge.net/projects/mingw-w64/files/)，向下拉找到MinGW-W64 GCC-8.1.0，下载x86_64-posix-seh。
## · 你还要有一个环境变量  ！
#### 将MinGW-W64的压缩包解压，将其中的bin文件夹添加为环境变量。如果不知道如何添加，请自行搜索！
#### 如果添加好了环境变量，按 win+R 输入cmd进入控制台，输入g++.
#### g++: fatal error: no input files
#### compilation terminated.
#### 若是出现上面的字代表安装成功了 ！
## · 安装 VS code 插件  ！
#### 1.C/C++
#### 2.Chinese (Simplified) Language Pack for Visual Studio Code (选装)
## · 配置launch.json 和 tasks.json ！
```
{
	  //launch.json
    // 使用 IntelliSense 了解相关属性。 
    // 悬停以查看现有属性的描述。
    // 欲了解更多信息，请访问: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "2.0.0",
    "configurations": [
        {
            "name": "g++.exe build and debug active file",
            "type": "cppdbg",
            "request": "launch",
            "program": "${fileDirname}\\${fileBasenameNoExtension}.exe",
            "args": [],
            "stopAtEntry": false,
            "cwd": "${workspaceFolder}",
            "environment": [],
            "externalConsole": false,
            "MIMode": "gdb",
            "miDebuggerPath": "gdb.exe的位置",
            "setupCommands": [
                {
                    "description": "为 gdb 启用整齐打印",
                    "text": "-enable-pretty-printing",
                    "ignoreFailures": true
                }
            ]
            "preLaunchTask": "task g++"
        }
    ]
}
```
