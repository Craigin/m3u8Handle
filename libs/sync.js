/**
 * Created by lilixin on 2017/1/18.
 */

var sync = function (fn) {
    var pending=[];
    var busy=false;
    var createCallack = function (callback) {
        return function () {
            callback.apply(this,arguments);
            busy=false;
            if(pending.length>0){
                busy=true;
                fn.apply(this,pending.shift());
            }
        }
    }
    return function () {
        for(var i =0;i<arguments.length;i++){
            if(typeof arguments[i]=='function'){
                arguments[i] = createCallack(arguments[i]);
                break;
            }

        }
        if(busy){
            pending.push(arguments);
            return;
        }
        busy=true;
        fn.apply(this,arguments);
    }
};

module.exports = sync;

/*var delaySay = function (name,callback) {
    setTimeout(function () {
        console.log('hello'+name);
        callback(name);
    },1000);
};


 delaySay = sync(delaySay);
var arr = new Array(0,1,2);
var result = '';
for(var i =0;i<arr.length;i++){
    delaySay(arr[i],function (res) {
        console.log(res);
        result = result.concat(res);
        console.log(result);
    });
}
console.log('result:'+result);*/

