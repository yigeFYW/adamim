var config = {
    debug: true,
    AppName: 'Mr.Adam IM', //项目名字
    Version:'0.0.1',//版本
    description: '在线聊天系统', //项目的描述
    keywords: 'nodejs, express, connect, socket.io',//项目的关键字
    listen:9000,
    database:{
        mysql:{
            host:"",
            dbname:"",
            username:"",
            password:"",
            port:3306
        },
        redis:{
            host:"118.193.131.21",
            password:"huanghe",
            port:6379,
            select:14
        }
    }
};
module.exports = config;