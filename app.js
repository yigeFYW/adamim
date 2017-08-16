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

var index_item = {title:config.AppName,version:config.Version};

//路由
router.get("/",function(req,res){
    // redis.keys('*',function(err,result){
    //     console.log(result);
    // });
    //判断是否有cookie
    if(req.cookies && req.cookies.nick_name){
        res.redirect("mobile");
        return false;
    }
    //选择头像
    let headimg = Math.floor(Math.random()*10)+1;
    index_item.headimg = "/images/headimg/"+headimg+".jpg";
    res.render("index",index_item);
});

router.post("/register",function(req,res){
    //读取参数
    res.cookie("nick_name",req.body.nick_name);
    res.cookie("headimg",req.body.headimg);
    res.cookie("motto",req.body.motto);
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

app.use("/",router);

io.on("connection",function(socket){
    //对于没有认证的不做任何事情
    var sid = socket.id;
    socket_list[sid] = socket;






    socket.on("disconnect",function(){
        console.log("a person is remove");
        delete socket_list[socket.id];//删除用户
    });
});