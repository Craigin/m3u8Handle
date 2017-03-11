/**
 * Created by gqs on 2017/1/16.
 */
module.exports = function(log){
    var ffmpeg = require('fluent-ffmpeg');
    var fs = require('fs');
    var Parser = require('mpeg2ts-parser');
    var indexExecutor = require('./index')();
    return {
        trans2ts: function(srcFilePath, destFilePath, callback){
            var ffmpegCommand = ffmpeg();
            var writeableStream = fs.createWriteStream(destFilePath);
            ffmpegCommand.setFfmpegPath('ffmpeg')
                .input(srcFilePath)
                .outputOptions(['-codec','copy','-bsf:v','h264_mp4toannexb','-f','mpegts'])
                .output(writeableStream)
                .on('end',function(){
                    console.log('ffmpeg process end');
                    writeableStream.end();
                }).on('start',function(cmd){
                parseFile(destFilePath, ffmpegCommand.ffmpegProc.stdout, function(err, result){
                    console.log('parse file end');
                    if(callback){
                        callback(err, result);
                    }
                });
            }).on('error',function(err){
                console.log(err);
                // callback(err);
            }).on('stderr', function(stderrLine) {
                // console.log('Stderr output: ' + stderrLine);
            }).on('progress', function(progress) {
                // console.log('Processing: ' + progress.percent + '% done');
            }).run();
        },
        parse: function(srcFilePath, callback){
            var readableStream = fs.createReadStream(srcFilePath);
            parseFile(srcFilePath, readableStream, function(err, result){
                callback(err,result);
            });
        },
        concat: function(srcFilePath, readableStream,callback){
            parseFile(srcFilePath, readableStream, function(err, result){
                callback(err,result);
            });
        }
    }
    function parseFile(srcFilePath, readableStream, callback){
        var indexFile = srcFilePath.substr(0,srcFilePath.lastIndexOf('.')).concat('.idx');
        var dataArray = new Array();
        var packetPosition = 0;
        var startTimestamp = -1;
        var lastTimestamp = -1;
        var startPts = -1;
        var starDts = -1;
        var lastFrameTime = -1;
        readableStream.on('close',function(err){
            // var buffer = Buffer.alloc((dataArray.length+2)*4);
            var buffer = new Buffer((dataArray.length+2)*4);
            var index = 0;
            buffer.writeUInt32BE(dataArray[0] & 0xffffffff, index);
            index = index +4;
            buffer.writeUInt32BE(dataArray[1] & 0xffffffff,index);
            index = index +4;
            buffer.writeUInt32BE((lastTimestamp+lastFrameTime) & 0xffffffff,index);
            index = index +4;
            buffer.writeUInt32BE(packetPosition & 0xffffffff,index);
            index = index +4;
            for(var i = 2;i<dataArray.length;i++){
                buffer.writeUInt32BE(dataArray[i] & 0xffffffff,index);
                index = index +4;
            }
            indexExecutor.writeIndex(indexFile,buffer,function(err,result){
                if(err){
                    callback({'success':false});
                }else{
                    callback(err, {'success':true});
                }
            });
        }).on('error',function(err){
            console.log(err);
        });
        var pat_pid;
        var pmt_pid;
        var video_pid;
        var patPos;
        var pmtPos;
        var parser = new Parser();
        parser.on('data', function(data) {
            var pid = data.pid;
            if(pid === 0){
                patPos = packetPosition;
                // console.log(patTypeSet);
                var payload = data.payload;
                // console.log(data);
                // var buf = jDataView.createBuffer(payload)；
                // var combinedStream = CombinedStream.create();
                var index = 0;

                // var buffer = Buffer.from(payload);
                var buffer = new Buffer(payload);
                var table_id = buffer.readUInt8(index) & 0xff;
                index++;
                var section_sybtax_inducator = (buffer.readUInt16BE(index) >>> 15)& 0x1 ;
                var section_length = (buffer.readUInt16BE(index)) & 0xfff ;
                index = index + 2;
                var position = index;
                var transport_stream_id = buffer.readUInt16BE(index);
                index = index +2;
                var version_number = (buffer.readUInt8(index) >>> 1) & 0x1f;
                var current_next_indicator = buffer.readUInt8(index) & 0x01;
                index++;
                var section_number = buffer.readUInt8(index) & 0xff;
                index++;
                var last_section_number = buffer.readUInt8(index) & 0xff;
                index++;
                // console.log('table_id:'+table_id);
                // console.log('section_sybtax_inducator:'+section_sybtax_inducator);
                // console.log('section_length:'+section_length);
                // console.log('transport_stream_id:'+transport_stream_id);
                // console.log('version_number:'+version_number);
                // console.log('current_next_indicator:'+current_next_indicator);
                // console.log('section_number:'+section_number);
                // console.log('last_section_number:'+last_section_number);
                while(position+section_length-4>index){
                    var program_number = buffer.readUInt16BE(index) & 0xff;
                    index = index +2;
                    var program_map_pid = buffer.readUInt16BE(index) & 0x1fff;
                    index = index +2;
                    // console.log('program_number:'+program_number);
                    // console.log('program_map_pid:'+program_map_pid);
                    pmt_pid = program_map_pid;
                }
                var crc_32 = buffer.readUInt32BE(index) & 0xffffffff;
                index = index +4;
                // console.log("crc_32:"+crc_32);
                // console.log('buffer length:'+buffer.length);
                // console.log('index:'+index);
                // console.log('/***********************************/');
                // var section_length = buffer.readUInt16BE(0) ;
            }
            if(pmt_pid  && pid === pmt_pid){
                pmtPos = packetPosition;
                var payload = data.payload;
                // console.log(data);
                // var buf = jDataView.createBuffer(payload)；
                // var combinedStream = CombinedStream.create();
                var index = 0;
                // var buffer = Buffer.from(payload);
                var buffer = new Buffer(payload);
                var table_id = buffer.readUInt8(index) & 0xff;
                index++;
                var section_sybtax_inducator = (buffer.readUInt16BE(index)>>> 15) & 0x1 ;
                var section_length = buffer.readUInt16BE(index) & 0xfff ;
                index = index + 2;
                var position = index;
                var transport_stream_id = buffer.readUInt16BE(index);
                index = index +2;
                var version_number =( buffer.readUInt8(index) >>> 1) & 0x1f;
                var current_next_indicator = buffer.readUInt8(index) & 0x01;
                index++;
                var section_number = buffer.readUInt8(index) & 0xff;
                index++;
                var last_section_number = buffer.readUInt8(index) & 0xff;
                index++;
                var pcr_pid = buffer.readUInt16BE(index) & 0x1fff;
                index = index +2;
                var program_info_length = buffer.readUInt16BE(index) & 0x0fff;
                index = index +2;
                // console.log('table_id:'+table_id);
                // console.log('section_sybtax_inducator:'+section_sybtax_inducator);
                // console.log('section_length:'+section_length);
                // console.log('transport_stream_id:'+transport_stream_id);
                // console.log('version_number:'+version_number);
                // console.log('current_next_indicator:'+current_next_indicator);
                // console.log('section_number:'+section_number);
                // console.log('last_section_number:'+last_section_number);
                // console.log('pcr_pid:'+pcr_pid);
                // console.log('program_info_length:'+program_info_length);
                // console.log(buffer.length);
                // console.log(index);
                while(buffer.length-4>index){
                    var stream_type = buffer.readUInt8(index) & 0xff;
                    index++;
                    var elementary_pid = buffer.readUInt16BE(index) & 0x1fff;
                    index = index +2;
                    var es_info_length = buffer.readUInt16BE(index) & 0x0fff;
                    index = index +2;
                    for(var i=0;i<es_info_length;i++){
                        buffer.readUInt8(index);
                        index++;
                    }
                    if(stream_type === 27 ){
                        video_pid = elementary_pid;
                    }
                    // console.log('stream_type:'+stream_type);
                    // console.log('elementary_pid:'+elementary_pid);
                    // console.log('es_info_length:'+es_info_length);
                }
                var crc_32 = buffer.readUInt32BE(index);
                // console.log('crc_32:'+crc_32);
                // console.log('/***********************************/')
            }
            /************** PES Header *****************/
            if(video_pid && video_pid === data.pid){

                // console.log(data);
                // console.log(data.payload);
                if(data.payload_unit_start_indicator ===1){
                    var buffer = new Buffer(data.payload);
                    var index = 0;
                    var adaptation_field_control = data.adaptation_field_control;
                    if(adaptation_field_control > 1){
                        if(data.adaptation_field){
                            var adaptation_field_length = data.adaptation_field.adaptation_field_length;
                            index = adaptation_field_length;
                        }
                    }
                    var packet_start_code_prefix = (buffer.readUInt32BE(index)>>> 7 )& 0xffffff;
                    var stream_id = buffer.readUInt32BE(index) & 0x000000ff;
                    if(adaptation_field_control <2){
                        packet_start_code_prefix = (buffer.readUInt16BE(index))& 0xffff;
                        index = index +2;
                        stream_id = buffer.readUInt8(index) & 0xff;
                        index++;
                    }else{
                        index = index +4;
                    }
                    var pes_pacgket_length = buffer.readUInt16BE(index) & 0xffff;
                    index = index +2;
                    var pes_scrambling_control = (buffer.readUInt8(index) >>> 4)& 0x03 ;
                    var pes_priority =( buffer.readUInt8(index)>>> 3) & 0x01 ;
                    var data_alignment_indicator = (buffer.readUInt8(index) >>> 2)& 0x01 ;
                    var copyright = (buffer.readUInt8(index)  >>>1)& 0x01;
                    var original_or_copy = buffer.readUInt8(index);
                    index++;
                    var pts_dts_flags = (buffer.readUInt8(index) >>> 6)& 0x03 ;
                    var escr_flag = (buffer.readUInt8(index) >>> 5)& 0x1 ;
                    var es_rate_flag = (buffer.readUInt8(index) >>> 4)& 0x1 ;
                    var dsm_trick_mode_flag = (buffer.readUInt8(index)>>> 3) & 0x01 ;
                    var additional_copy_info_flag = (buffer.readUInt8(index)>>> 2) &0x01 ;
                    var pes_crc_flag = (buffer.readUInt8(index) >>> 1) & 0x01;
                    var pes_extension_flag = buffer.readUInt8(index) &0x01;
                    index++;
                    var pes_header_data_length = buffer.readUInt8(index) & 0xff;
                    index++;
                    // console.log('packet_start_code_prefix:'+packet_start_code_prefix);
                    // console.log('stream_id:'+stream_id);
                    // console.log('pes_pacgket_length:'+pes_pacgket_length);
                    // console.log('pes_scrambling_control:'+pes_scrambling_control);
                    // console.log('pes_priority:'+pes_priority);
                    // console.log('data_alignment_indicator:'+data_alignment_indicator);
                    // console.log('copyright:'+copyright);
                    // console.log('original_or_copy:'+original_or_copy);
                    // console.log('pts_dts_flags:'+pts_dts_flags);
                    // console.log('escr_flag:'+escr_flag);
                    // console.log('es_rate_flag:'+es_rate_flag);
                    // console.log('dsm_trick_mode_flag:'+dsm_trick_mode_flag);
                    // console.log('additional_copy_info_flag:'+additional_copy_info_flag);
                    // console.log('pes_crc_flag:'+pes_crc_flag);
                    // console.log('pes_extension_flag:'+pes_extension_flag);
                    // console.log('pes_header_data_length:'+pes_header_data_length);
                    var endPosition = pes_header_data_length + index;
                    if(pts_dts_flags === 2){
                        var pts_1 = (buffer.readUInt8(index) >>> 1) & 0x7;
                        index++;
                        var pts_2 = (buffer.readUInt16BE(index)>>>1) & 0x7fff ;
                        index = index +2;
                        var pts_3 = (buffer.readUInt16BE(index) >>> 1) & 0x7fff;
                        index = index +2;
                        var pts = (pts_1 << 30) + (pts_2 << 15)+ pts_3;
                        // console.log('pts:'+pts);
                        if(startPts===-1){
                            startPts = pts;
                            dataArray.push(Math.round(startPts/90));
                        }
                        if(starDts ===-1){
                            starDts = dts;
                            dataArray.push(Math.round(starDts/90));
                        }
                        timestamp = Math.round((pts-startPts)/90);
                        if(startTimestamp===-1){
                            startTimestamp = timestamp;
                        }
                        lastFrameTime = timestamp - lastTimestamp;
                        lastTimestamp = timestamp;
                    }else if(pts_dts_flags === 3){
                        var pts_1 = (buffer.readUInt8(index) >>> 1) & 0x7;
                        index++;
                        var pts_2 = (buffer.readUInt16BE(index)>>>1) & 0x7fff ;
                        index = index +2;
                        var pts_3 = (buffer.readUInt16BE(index)>>>1) & 0x7fff ;
                        index = index +2;
                        var pts = (pts_1 << 30) + (pts_2 << 15)+ pts_3;
                        var dts_1 = (buffer.readUInt8(index) >>> 1) & 0x7;
                        index++;
                        var dts_2 = (buffer.readUInt16BE(index)>>>1) & 0x7fff ;
                        index = index +2;
                        var dts_3 = (buffer.readUInt16BE(index)>>>1) & 0x7fff ;
                        index = index +2;
                        var dts = (dts_1 << 30)+ (dts_2 <<15)+ dts_3;
                        // console.log('pts:'+pts);
                        // console.log('dts:'+dts);
                        if(startPts===-1){
                            startPts = pts;
                            dataArray.push(Math.round(startPts/90));
                        }
                        if(starDts ===-1){
                            starDts = dts;
                            dataArray.push(Math.round(starDts/90));
                        }
                        timestamp = Math.round((pts-startPts)/90);
                        if(startTimestamp===-1){
                            startTimestamp = timestamp;
                        }
                        lastFrameTime = timestamp - lastTimestamp;
                        lastTimestamp = timestamp;
                    }
                    if(escr_flag === 1){
                        buffer.readUInt16BE(index);
                        index = index +2;
                        buffer.readUInt32BE(index);
                        index = index +4;
                    }
                    if(es_rate_flag === 1){
                        buffer.readUInt8(index);
                        index++;
                        buffer.readUInt16BE(index);
                        index = index +2;
                    }
                    if(dsm_trick_mode_flag === 1){
                        buffer.readUInt8(index);
                        index++;
                    }
                    if(additional_copy_info_flag === 1){
                        buffer.readUInt8(index);
                        index++;
                    }
                    if(pes_crc_flag === 1){
                        buffer.readUInt16BE(index);
                        index = index +2;
                    }
                    if(pes_extension_flag === 1){
                        var pes_private_data_flag = (buffer.readUInt8(index)>>> 7) & 0x1 ;
                        var pack_header_field_flag = (buffer.readUInt8(index)>>> 6) & 0x1 ;
                        var program_packet_sequence_counter_flag = (buffer.readUInt8(index)>>> 5) & 0x1 ;
                        var p_std_buffer_flag = (buffer.readUInt8(index)>>> 4) & 0x1 ;
                        var pes_extension_flag_2 = buffer.readUInt8(index) & 0x01;
                        index++;
                        if(pes_private_data_flag === 1){
                            buffer.readUInt32BE(index);
                            index = index +4;
                            buffer.readUInt32BE(index);
                            index = index +4;
                            buffer.readUInt32BE(index);
                            index = index +4;
                            buffer.readUInt32BE(index);
                            index = index +4;
                        }
                        if(pack_header_field_flag === 1){
                            buffer.readUInt8(index);
                            index++;
                        }
                        if(program_packet_sequence_counter_flag === 1){
                            buffer.readUInt16BE(index);
                            index = index +2;
                        }
                        if(p_std_buffer_flag === 1){
                            buffer.readUInt16BE(index);
                            index = index +2;
                        }
                        if(pes_extension_flag_2 === 1){
                            var pes_extension_field_length = buffer.readUInt8(index) & 0x7f;
                            var stream_id_extension_flag = buffer.readUInt8(index) & 0x80 >>> 7;
                            if(stream_id_extension_flag === 0){
                                var stream_id_extension = buffer.readUInt8(index) & 0x7f;
                                for(var i=0;i<pes_extension_field_length;i++){
                                    buffer.readUInt8(index);
                                    index++;
                                }
                            }
                        }
                    }
                    index = endPosition;
                    /************** PES Packet ***********/
                    // process.exit(0);
                    /************** H264 Nalu **********/
                    while(buffer.length>index){
                        var nalu_start_flag_1 = buffer.readUInt8(index);
                        index++;
                        if(nalu_start_flag_1!==0){
                            continue;
                        }
                        var nalu_start_flag_2 = buffer.readUInt8(index);
                        index++;
                        if(nalu_start_flag_2 !== 0){
                            continue
                        }
                        var nalu_start_flag_3 = buffer.readUInt8(index);
                        index++;
                        if(nalu_start_flag_1 === 0 && nalu_start_flag_2 === 0){
                            if(nalu_start_flag_3 === 0){
                                var nalu_start_flag_4 = buffer.readUInt8(index) & 0xff;
                                index++;
                                if(nalu_start_flag_4 === 1){
                                    var h264_type = buffer.readUInt8(index) & 0x1f ;
                                    index++;
                                    if(h264_type === 5 || h264_type === 7 || h264_type === 8){
                                        // console.log('find keyframe');
                                        // process.exit(0);
                                        // console.log('packetPosition:'+packetPosition);
                                        // indexFile.write(JSON.stringify({'timestamp':timestamp,'position':packetPosition*188}));
                                        // indexFile.write('\n');
                                        // console.log('timestamp:'+Math.round(timestamp));
                                        dataArray.push(Math.round(timestamp));
                                        // console.log(packetPosition)
                                        // console.log(patPos);
                                        // console.log(pmtPos);
                                        if(packetPosition-patPos==2 && packetPosition-pmtPos==1){
                                            // console.log('position:'+patPos*188);
                                            dataArray.push(patPos);
                                        }else{
                                            // console.log('position:'+packetPosition*188);
                                            dataArray.push(packetPosition);
                                        }
                                        // console.log('/**********************************/');
                                        // return;
                                        break;
                                    }else if(h264_type === 9){
                                        /*buffer.readUInt8(index);
                                         index++;*/
                                        // console.log('find nalu type 9');
                                    }else if(h264_type === 1){
                                        // console.log('find p frame');
                                        break;
                                    }else if(h264_type === 6){
                                        // console.log('find nalu type 6');
                                    }
                                }
                            }else if(nalu_start_flag_3 === 1){
                                var h264_type = buffer.readUInt8(index) & 0x1f ;
                                index++;
                                if(h264_type === 5 || h264_type === 7 || h264_type === 8){
                                    // console.log('find keyframe');
                                    // process.exit(0);
                                    // console.log('packetPosition:'+packetPosition);
                                    // indexFile.write(JSON.stringify({'timestamp':timestamp,'position':packetPosition*188}));
                                    // indexFile.write('\n');
                                    // console.log('timestamp:'+Math.round(timestamp));
                                    dataArray.push(Math.round(timestamp));
                                    if(packetPosition-patPos==2 && packetPosition-pmtPos==1){
                                        // console.log('position:'+patPos*188);
                                        dataArray.push(patPos);
                                    }else{
                                        // console.log('position:'+packetPosition*188);
                                        dataArray.push(packetPosition);
                                    }
                                    //console.log('/**********************************/');
                                    // return;
                                    break;
                                }else if(h264_type === 9){
                                    /*buffer.readUInt8(index);
                                     index++;*/
                                    // console.log('find nalu type 9');
                                }else if(h264_type === 1){
                                    // console.log('find p frame');
                                    // process.exit(0);
                                    // return;
                                    break;
                                }else if(h264_type === 6){
                                    // console.log('find nalu type 6');
                                }
                            }
                        }
                    }
                }
                // console.log('/*********************************************/')
                // process.exit(0);
                // console.log(lastFrameTime)
            }
            packetPosition++;
        });
        readableStream.pipe(parser);
    }
}