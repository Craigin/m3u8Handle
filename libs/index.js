/**
 * Created by gqs on 2017/1/16.
 */
module.exports = function(log){
    var fs = require('fs');
    return {
        writeIndex:function(filePath, data, callback){
            var writeStream = fs.createWriteStream(filePath);
            writeStream.write(data);
            writeStream.end();
            writeStream.on('close',function(err, result){
                callback(err, result);
            }).on('error',function(err){
                callback(err);
            });
        },
        readIndex:function(filePath,callback){
            var readStream = fs.createReadStream(filePath);
            var timestamp =[];
            var position = [];
            var pts;
            var dts;
            var time;
            var length;
            readStream.on('readable',function(){
                var header = readStream.read(16);
                if(header!==null){
                    pts = header.readUInt32BE(0) & 0xffffffff;
                    dts = header.readUInt32BE(4) & 0xffffffff;
                    time = header.readUInt32BE(8) & 0xffffffff;
                    length = header.readUInt32BE(12) & 0xffffffff;
                }
                var chunk;
                while((chunk = readStream.read(8))!=null){
                    timestamp.push(chunk.readUInt32BE(0) & 0xffffffff);
                    position.push(chunk.readUInt32BE(4) & 0xffffffff);
                    // duration.push(chunk.readUint32BE(index) & 0xffffffff);
                };
            }).on('close',function(){
                callback(null, {'timestamp':timestamp,'position':position,'pts':pts,'dts':dts,'time':time,'length':length});
                // deferred.resolve({'timestamp':timestamp,'position':position,'pts':pts,'dts':dts,'time':time,'length':length});
            }).on('error',function(err){
                callback(err);
            });
        },
        readPTS_DTS:function(filePath, callback){
            var readStream = fs.createReadStream(filePath);
            readStream.on('readable',function(){
                var header = readStream.read(16);
                if(header!==null){
                    var pts = header.readUInt32BE(0) & 0xffffffff;
                    var dts = header.readUInt32BE(4) & 0xffffffff;
                    callback(null, {'pts':pts,'dts':dts});
                }
                return;
            }).on('close',function(){

            });
        }
    }


}