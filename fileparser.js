/**
 * Created by gqs on 2017/1/16.
 */
var Index = require('./libs/index');
var TsParser = require('./libs/tsparser');
var sync = require('./libs/sync');
var fs = require('fs');
/**
 * 索引文件工具类
 */
var index;
/**
 * ts文件解析类
 */
var tsparser;
/**
 * m3u8索引切片大小
 */
var segmentDuartion;
/**
 *
 */
var global_app;
var slice;
var segment;
var FileParser = function(app){
    index = new Index();
    tsparser = new TsParser();
    global_app = app;
    slice = sync(sliceFile);
    segment = sync(makeSegment);
}
/**
 * 获取索引文件
 * @param filePath
 * @param start
 * @param end
 * @param callback
 */
var makeSegment = function(filePath, start, end,callback){
    segmentDuartion = /*global_app.get('hls_duration')||*/6;
    var maxDuration = -1;
    var m3u8Body = '';
    var duration;
    var indexFilePath = filePath.substr(0,filePath.lastIndexOf('.')).concat('.idx');
    index.readIndex(indexFilePath,function(err,result){
        if(err){
            callback({'success':false,'error':'can not find idx file'});
            return;
        }
        var time = result.time;
        var length = result.length;
        var st_ed_time = getTime(result.timestamp, start, end);
        if(st_ed_time instanceof Array){
            var timestamp;
            var position;
            var startIndex = st_ed_time[0];
            var endIndex = st_ed_time[1];
            if(start ===-1 && end === -1){
                timestamp = result.timestamp.slice(st_ed_time[0], st_ed_time[1]+1);
                position = result.position.slice(st_ed_time[0],st_ed_time[1]+1);
                timestamp.push(time);
                position.push(length);
            }else{
                if(startIndex === endIndex){
                    if(endIndex<result.timestamp.length-1){
                        var si = Number(startIndex);
                        var ei= Number(endIndex) +1;
                        timestamp = result.timestamp.slice(si, ei+1);
                        position = result.position.slice(si,ei+1);
                    }else{
                        timestamp = result.timestamp.slice(st_ed_time[0], st_ed_time[1]+1);
                        position = result.position.slice(st_ed_time[0],st_ed_time[1]+1);
                        timestamp.push(time);
                        position.push(length);
                    }
                }else{
                    timestamp = result.timestamp.slice(st_ed_time[0], st_ed_time[1]+1);
                    position = result.position.slice(st_ed_time[0],st_ed_time[1]+1);
                }
            }
            var nexttime = timestamp[0] + segmentDuartion*1000 ;
            var segmentCount;
            var startPos = position[0]*188;
            var startTime = timestamp[0];
            for(var i=0;i<timestamp.length;i++){
                if((timestamp[i])>=nexttime){
                    /* console.log('find segment');
                     console.log('curTime:'+(timestamp[i]));
                     console.log('nextTime:'+nexttime);
                     console.log('startPos:'+startPos);
                     console.log('curPos:'+position[i]);
                     console.log('startTime:'+startTime);
                     console.log('curTime:'+(timestamp[i]));
                     console.log('-------');*/
                    m3u8Body = m3u8Body.concat(m3u8Segment(filePath,startPos,position[i]*188,timestamp[i]-startTime));
                    if(maxDuration==-1){
                        maxDuration = timestamp[i]-startTime;
                    }else{
                        var curDuration = timestamp[i]-startTime;
                        if(curDuration>maxDuration){
                            maxDuration = curDuration;
                        }
                    }
                    nexttime += segmentDuartion*1000;
                    startPos = position[i]*188;
                    startTime = timestamp[i];
                    segmentCount = 0;
                }else{
                    segmentCount++;
                }
            }
            if(segmentCount!==0){
                var curDuration;
                if(start ==-1 && end ==-1){
                    m3u8Body = m3u8Body.concat(m3u8Segment(filePath,startPos,
                        length*188,time-startTime));
                    curDuration = time - startTime;
                }else{
                    m3u8Body = m3u8Body.concat(m3u8Segment(filePath,startPos,
                        position[position.length-1]*188,timestamp[timestamp.length-1]-startTime));
                    curDuration = timestamp[timestamp.length-1]-startTime;
                }
                if(curDuration>maxDuration){
                    maxDuration = curDuration;
                }
            }
            duration = timestamp[timestamp.length-1] - timestamp[0];
            m3u8Body = m3u8Body.concat(m3u8Separator()).concat('\n');
            callback(null,{'m3u8body':m3u8Body,'duration':maxDuration,'time':duration});
        }else{
            if(callback){
                callback({'success':false,'error':st_ed_time})
            }
        }
    })
}
/**
 * 获取关键帧时间
 * @param timestamp
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns {Array} 开始和结束序号
 */
var getTime = function(timestamp,startTime, endTime, time){
    var start = -1;
    var end = -1;
    if(startTime === -1 && endTime ===-1){
        start = 0;
        end = timestamp.length - 1;
    }else{
        var st = timestamp[0];
        var et = timestamp[timestamp.length-1];
        if(startTime >= et || endTime<=st){
            if(time && st > time){
                return 'check params [start] or [end]';
            }else{
                start = end = timestamp.length - 1;
            }
        }
        timestamp.forEach(function(time,index){
            /*console.log('curtime:'+time);
             console.log('starttime:'+startTime);
             console.log('endtime:'+endTime);
             console.log('*********************')*/
            if(time>=startTime){
                if(start === -1){
                    start = index;
                }
            }
            if(time>endTime){
                if(end === -1){
                    end = index;
                }
            }
        });
    }
    if(start === -1){
        start = 0;
    }
    if(end === -1){
        end = timestamp.length -1;
    }
    // console.log(start);
    // console.log(end);
    return new Array(start,end);
}
/**
 * m3u8索引头部
 * @param duration 切片最大间隔
 * @returns {string} 索引头部
 */
var m3u8Header = function(duration){
    var header = ''.concat('#EXTM3U').concat('\n')
        .concat('#EXT-X-VERSION:3').concat('\n')
        .concat('#EXT-X-TARGETDURATION:').concat(duration).concat('\n')
        .concat('#EXT-X-MEDIA-SEQUENCE:0').concat('\n')
        .concat('#EXT-X-PLAYLIST-TYPE:VOD').concat('\n');
    return header;
}
/**
 * 获取分段m3u8索引
 * @param filePath 文件地址
 * @param startPos 开始位置
 * @param endPos 结束位置
 * @param duration m3u8切片大小
 * @returns {string} 索引文件
 */
var m3u8Segment = function(filePath, startPos, endPos, duration){
    console.log(filePath);
    var newFilePath = '/hls'+filePath.slice(13,filePath.lastIndexOf('.'))
            .concat('_').concat(startPos).concat('_').concat(endPos).concat('.ts');
    console.log(newFilePath);
    var segment = ''.concat('#EXTINF:').concat(duration/1000).concat(',\n')
        .concat(newFilePath)
        .concat('\n');
    return segment;
}
/**
 * m3u8索引分段合并分隔标识
 * @returns {string}
 */
var m3u8Separator = function(){
    return '#EXT-X-DISCONTINUITY';
}
/**
 * m3u8索引结束标识
 * @returns {string}
 */
var m3u8Footer = function(){
    return '#EXT-X-ENDLIST';
}
/**
 * 文件切分：截取指定位置的文件数据
 * @param filePath 源文件
 * @param storePath 目标文件地址
 * @param start 截取开始位置
 * @param end 截取结束位置
 * @param callback 结果回调
 */
var sliceFile = function(filePath, storePath, start, end, callback){
    index.readIndex(filePath.substr(0,filePath.lastIndexOf('.')).concat('.idx'),function(err,result){
        if(err){
            callback(err);
        }else{
            var st_ed_time = getTime(result.timestamp, start, end, result.time);
            if(st_ed_time instanceof  Array){
                var startIndex = st_ed_time[0];
                var endIndex = st_ed_time[1];
                var startPos;
                var endPos;
                if(startIndex === endIndex){
                    startPos = result.position[startIndex];
                    if(endIndex<result.position.length-1){
                        endPos = result.position[startIndex+1];
                    }else{
                        endPos = result.length;
                    }
                }else{
                    startPos = result.position[startIndex];
                    endPos = result.position[endIndex];
                }
                var readStream = fs.createReadStream(filePath, {'start':parseInt(startPos*188),'end':parseInt(endPos*188)});
                if(storePath){
                    var writeStream = fs.createWriteStream(storePath);
                    var sliceResult = {};
                    readStream.pipe(writeStream);
                    writeStream.on('close',function(){
                        // console.log('writer close');
                        sliceResult.storePath = storePath;
                        sliceResult.filePath = filePath;
                        if(callback){
                            callback(null, sliceResult);
                        }
                    }).on('error',function(err){
                        sliceResult.filePath = filePath;
                        sliceResult.success = false;
                        if(callback){
                            callback(sliceResult);
                        }
                    });
                }else{
                    callback(null, readStream);
                }
            }else{
                if(callback){
                    callback({'success':false,'error':st_ed_time});
                }
            }
        }
    });
}
/**
 * 文件转码：支持将MP4文件转为ts文件，并找出文件关键帧
 * @param srcFilePath 源文件地址
 * @param destFilePath 目标文件地址
 * @param callback 结果回调
 */
FileParser.prototype.trans2ts = function(srcFilePath, destFilePath, callback){
    tsparser.trans2ts(srcFilePath,destFilePath,function(err, result){
        callback(err, result);
    });
}
/**
 * 文件分析：分析ts文件结构，找出关键帧
 * @param srcFilePath
 * @param callback
 */
FileParser.prototype.parse = function(srcFilePath, callback){
    tsparser.parse(srcFilePath,function(err, result){
        callback(err ,result);
    });
}
/**
 * 拼接文件分析
 * @param params
 * @param callback
 */
FileParser.prototype.concat = function (srcFilePath, readStream, callback) {
    tsparser.concat(srcFilePath, readStream,function(err, result){
        callback(err, result);
    });
}
/**
 * 获取ts文件的m3u8索引文件
 * @param params 执行参数 结构为：[{'filePath':'','startTime':'','endTime':''},{},...]
 * @param callback 结果回调
 */
FileParser.prototype.getIndexFile =function(params,callback){
    var segmentCount = 0;
    var m3u8Body = '';
    var maxDuration = -1;
    var time = 0;
    if(params instanceof Array){
        var errResult;
        params.forEach(function(playInfo, i){
            var filePath = playInfo.filePath;
            var start = playInfo.startTime;
            var end = playInfo.endTime;
            segment(filePath,start,end,function(err,result){
                segmentCount++;
                if(err){
                    errResult = err;
                }else{
                    time = time + result.time;
                    m3u8Body = m3u8Body.concat(result.m3u8body);
                    var curDuration = result.duration;
                    if(curDuration>maxDuration){
                        maxDuration = curDuration;
                    }
                }
                if(segmentCount=== params.length){
                    if(errResult){
                        callback(errResult);
                    }else{
                        var m3u8Index = m3u8Header(Math.ceil(maxDuration/1000)).concat(m3u8Body).concat(m3u8Footer());
                        callback(null, {'index':m3u8Index,'time':time});
                    }
                }
            });
        });
    }else{
        callback({'error':'check params,need array'});
    }
}
/**
 * 文件剪切
 * @param params 执行参数 结构为：{'filePath':'','storePath':'','startTime':'','endTime':''}
 * @param callback 结果回调 结构为：成功：{'filePath':'','storePath':''} 失败：{'success':false,'filePath',''}
 */
FileParser.prototype.cut = function(params, callback){
    // params.forEach(function(sliceInfo, index){
    var filePath = params.filePath;
    var start = params.startTime;
    var end = params.endTime;
    var storePath = params.storePath;
    slice(filePath,storePath,start,end,function(err, result){
        if(callback){
            callback(err,result);
        }
    })
    // })
}
/**
 * 文件合并
 * @param params 执行参数 结构为：{'storePath':'','sliceInfo':[{'filePath':'','startTime':'','endTime':''},{},...]}
 * @param callback 结果回调
 */
FileParser.prototype.merge = function(params, callback){
    var storePath = params.storePath;
    var sliceInfos = params.sliceInfos;
    var writeStream = fs.createWriteStream(storePath,{'end':false});
    var resultArray = {};
    var i = 0;
    sliceInfos.forEach(function(sliceInfo, index){
        var filePath = sliceInfo.filePath;
        var start = sliceInfo.startTime;
        var end = sliceInfo.endTime;
        slice(filePath,null,start,end,function(err, stream){
            if(err){
                callback({'success':false});
            }else{
                stream.pipe(writeStream,{'end':false});
                stream.on('close',function(){
                    i++;
                    // console.log('reader close');
                    if(i === sliceInfos.length){
                        writeStream.end();
                    }
                })
            }
        })
    })
    writeStream.on('close',function(){
        // console.log('writer close')
        resultArray.storePath=storePath;
        if(callback){
            callback(null, resultArray);
        }
    }).on('error',function(err){
        if(callback){
            callback({'success':false});
        }
    });
}
module.exports = function(app){
    return new FileParser(app);
}