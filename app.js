var config = require(__dirname+"/env");//引入配置文件
var express = require("express");
var app = require("express")();
var path = require("path");
var server = require("http").Server(app);
var io = require("socket.io")(server);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var multer = require('multer');
var Redis = require("ioredis");
var redis = new Redis({
    port:config.database.redis.port || 6379,
    host:config.database.redis.host || "127.0.0.1",
    family:4,
    password:config.database.redis.password || null,
    db:config.database.redis.select || 0
});
server.listen(config.listen);
//静态文件库
app.use(express.static('public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
var router =  express.Router();

app.set('views', path.join(__dirname, 'views'));  
app.set('view engine', 'ejs');


//定义链接
var socket_list = {};
var names = {};
var user_list = {};

var index_item = {title:config.AppName,version:config.Version};

//路由
router.get("/",function(req,res){
    // redis.keys('*',function(err,result){
    //     console.log(result);
    // });
    //判断是否有cookie,有cookie跳到手机端
    if(req.cookies && req.cookies.nick_name){
        res.redirect("mobile");
        return false;
    }
    //选择头像
    var headimg = Math.floor(Math.random()*10)+1;
    index_item.headimg = "/images/headimg/"+headimg+".jpg";
    res.render("index",index_item);
});

//测试路由
router.get("/test",function(req,res){

});

router.post("/register",function(req,res){
    //读取参数
    res.cookie("nick_name",req.body.nick_name);
    res.cookie("headimg",req.body.headimg);
    res.cookie("motto",req.body.motto);
    //生成user_id

    res.redirect("mobile");
});

router.get("/mobile",function(req,res){
    //没有cookie跳转到首页
    if(!req.cookies.nick_name){
        res.redirect("/");
        return false;
    }
    res.render("mobile",index_item);
});

router.post("/init",function(req,res){
    console.log(req.body);
});


app.use("/",router);

io.on("connection",function(socket){
    //对于没有认证的不做任何事情
    socket_list[socket.id] = socket;
    
    console.log(socket.id);


    socket.on('init', function (data, back) {
        //data.sid   data.nick_name    data.headimg   data.motto    data.user_id
        socket_list[socket.id].nick_name = data.nick_name;

        var r_data = {};

        if(data.user_id >0){
            //储存用户的socket链接
            user_list[data.user_id] = socket.id;
            socket_list[socket.id].user_id = data.user_id;
            //第N次登陆
            //把该user_id加入上线好友中
            redis.sadd("online",data.user_id);
            redis.smove("offline","online",data.user_id);
            r_data.user_id = data.user_id;
            getOnlineUser(function(online){
                r_data.online = online;
                getNotOnline(function(offline){
                    r_data.offline = offline;
                    //给除自己外所有人发消息,我上线了
                    redis.hgetall("user_info:"+data.user_id,function(err,res){
                        var d = {
                            type: 'friend' //列表类型，只支持friend和group两种
                            ,avatar: res.headimg //好友头像
                            ,username: res.nick_name //好友昵称
                            ,groupid: 1 //所在的分组id
                            ,id: res.user_id //好友id
                            ,sign: res.motto //好友签名
                        };
                        socket.broadcast.emit('someoneOnline',d);
                    });
                    back(r_data);
                });
            });
        }else if(data.user_id == 0){
            //第一次登陆   去储存用户信息  返回user_id
            redis.incr("user_id",function(err,r){
                var user_id = r;
                //设置用户的id与昵称
                socket_list[socket.id].user_id = r;
                //储存用户信息
                user_list[user_id] = socket.id;
                var u_key = "user_info:"+user_id;
                redis.hmset(u_key,{nick_name:data.nick_name,motto:data.motto,headimg:data.headimg,user_id:user_id});
                //把该user_id加入上线好友中
                redis.sadd("online",user_id);

                r_data.user_id = user_id;
                getOnlineUser(function(online){
                    r_data.online = online;
                    getNotOnline(function(offline){
                        r_data.offline = offline;
                        back(r_data);
                    });
                });
            });
        }
    });

    //监听用户发送消息
    socket.on("getOneMsg",function(msg){
        console.log(msg);
        /*
         obj = {
             username: To.name
             ,avatar: To.avatar
             ,id: To.id
             ,type: To.type
             ,content: autoReplay[Math.random()*9|0]
         }
        */

    });

    //监听用户发送群组消息
    socket.on("getOneGroupMsg",function(msg){
        console.log(msg);
    });

    //监听下线事件
    socket.on("disconnect",function(){
        //将用户从上线移入下线集合中
        redis.smove("online","offline",socket_list[socket.id].user_id);

        //给除自己外所有人发消息,我下线了
        redis.hgetall("user_info:"+socket_list[socket.id].user_id,function(err,res){
            var d = {
                type: 'friend' //列表类型，只支持friend和group两种
                ,avatar: res.headimg //好友头像
                ,username: res.nick_name //好友昵称
                ,groupid: 2 //所在的分组id
                ,id: res.user_id //好友id
                ,sign: res.motto, //好友签名,
                status:"offline"
            };
            socket.broadcast.emit('someoneOffline',d);
        });

        //将用户从user_list中移除
        delete user_list[socket_list[socket.id].user_id];
        delete socket_list[socket.id];//删除用户
    });


});

//返回上线的人的信息
function getOnlineUser(callback){
    var list = [];
    var u_length = 0;
    for(var i in user_list){
        u_length+=1;
    }
    var u = 0;
    if(!u_length){
        callback(list);
    }
    for(let k in user_list){
        redis.hgetall("user_info:"+k,function(err,res){
            var arr = {
                username:res.nick_name,
                id:res.user_id,
                avatar:res.headimg,
                sign:res.motto,
                status:"online"
            };
            list.push(arr);
            u++;
            if(u == u_length){
                callback(list);
            }
        });
    }
}
//获取没上线的人的信息
function getNotOnline(callback){
    var list = [];
    redis.smembers("offline",function(err,res){
        if(res.length == 0){
            callback(list);
        }
        var n = 0;
        var p = res.length;
        for(let i = 0;i<res.length;i++){

            redis.hgetall("user_info:"+res[i],function(err,res){
                var arr = {
                    username:res.nick_name,
                    id:res.user_id,
                    avatar:res.headimg,
                    sign:res.motto,
                    status:"offline"
                };
                list.push(arr);
                n++;
                if(n == p){
                    callback(list);
                }
            });
        }
    });
}

//返回群组的信息
function getOnlineGroup(){

}