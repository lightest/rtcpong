var requestAnimFrame = 
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;

function Paddle(isLeft){
    this.x  = 0;
    this.y  = 0;
    this.w  = 0;
    this.h  = 0;
    this.el = null;
    this.isLeft = isLeft || false;
    this.controlledByUser = isLeft;
    this.init();
};

Paddle.prototype.init = function() {
    if(this.isLeft){
        this.el = $('.paddle.left');
    } else {
        this.el = $('.paddle.right');
    }
    this.w = parseInt(this.el.outerWidth());
    this.h = parseInt(this.el.outerHeight());
    this.y = field.h * .5 - this.h * .5;
    if(!this.isLeft){
        this.x = field.w - this.w;
    }
};

Paddle.prototype.getSyncData = function(){
    return {
        x: this.x,
        y: this.y,
        isLeft: this.isLeft
    };
};

Paddle.prototype.update = function(dt) {
    if(this.controlledByUser){
        this.y = Math.min(mouse.y, field.h);
    }
};

Paddle.prototype.sync = function(paddleData){
    this.x = paddleData.x;
    this.y = paddleData.y;
    this.isLeft = paddleData.isLeft;
};

Paddle.prototype.collides = function(l, t, r, b){
    var pr = this.x + this.w;
    var pb = this.y + this.h;

    if(l > this.x && l < pr &&
       t > this.y && t < pb ||
       r < pr && r > this.x &&
       b < pb && b > this.y) {
        return true;
    }
    return false;
}

Paddle.prototype.resolveCollision = function(ball){
    if(this.isLeft) {
        ball.x = this.x + this.w;
    } else {
        ball.x = this.x - ball.size;
    }

    ball.vx *= -1;

    var halfPaddle = Math.floor(this.h * .5);
    var ballCenter = Math.floor(ball.y + ball.size * .5);
    var paddleCenter = this.y + halfPaddle;
    var dist = Math.floor(Math.abs(ballCenter - paddleCenter));
    var ratio = Math.min(1, dist / halfPaddle);
    console.log(dist, ratio);
    ball.vy = ball.vx * ratio;
}

Paddle.prototype.render = function() {
    this.el.css({
        'transform': 'translate3d('+ this.x +'px, '+ this.y +'px, 0)'
    });
}

var game = {
    lastTime: null,

    init: function(){
        this.lastTime = new Date();
    }
};

var mouse = {
    x: 0,
    y: 0,

    init: function(){
        window.addEventListener('mousemove', mouse.onMove.bind(this));
    },

    onMove: function(e){
        this.y = e.pageY;
    }
};

var field = {
    w:  0,
    h:  0,
    el: null,

    init: function(){
        this.el = $('.game-field');
        this.w  = parseInt( this.el.outerWidth() );
        this.h  = parseInt( this.el.outerHeight() );
    }
};

var paddleLeft = null;
var paddleRight = null;

var ball = {
    x:  0,
    y:  0,
    vx: 100,
    vy: 100,
    el: null,
    size: 0,

    init: function(){
        this.el = $('#ball');
        this.size = parseInt(this.el.outerWidth());
    },

    update: function(dt){
        if(!config.imhost){ return; }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    },

    getSyncData: function(){
        return {
            x: this.x,
            y: this.y
        };
    },

    sync: function(data){
        this.x = data.x;
        this.y = data.y;
    },

    render: function(){
        this.el.css({
            transform: 'translate3d('+ Math.floor(this.x) +'px, '+ Math.floor(this.y) +'px, 0)'
        });
    }
};

function handleCollisions(){
    var bx = Math.floor(ball.x);
    var by = Math.floor(ball.y);
    var br = bx + ball.size;
    var bb = by + ball.size;

    if(bx < 0){
        ball.vx *= -1;
        ball.x = 0;
        console.log('left wall coll')
    }

    if(bx + ball.size > field.w){
        ball.vx *= -1;  
        ball.x = field.w - ball.size;
        console.log('right wall coll')
    }

    if(by < 0){
        ball.vy *= -1;
        ball.y = 0;
        console.log('ceil wall coll')
    }

    if(by + ball.size > field.h){
        ball.vy *= -1;
        ball.y = field.h - ball.size;
        console.log('floor wall coll')
    }

    if(paddleLeft.collides(bx, by, br, bb)){
        console.log('lp collision');
        paddleLeft.resolveCollision(ball);
    } else if(paddleRight.collides(bx, by, br, bb)){
        console.log('rp collision');
        paddleRight.resolveCollision(ball);
    }
}

function update(dt){
    ball.update(dt);
    paddleLeft.update();
    paddleRight.update();
}

function updateRemoteParty(){
    var msg = [];
    var paddle = null;

    if(config.imhost){
        paddle = paddleLeft.getSyncData();
        var ballData = ball.getSyncData();
        msg.push({
            object: 'ball',
            data: ballData
        });
    } else {
        paddle = paddleRight.getSyncData();
    }
    
    msg.push({
        object: 'paddle',
        data: paddle
    });

    socket.sendMessage( JSON.stringify(msg) );
};

function render(){
    ball.render();
    paddleLeft.render();
    paddleRight.render();
}

function mainLoop(){
    requestAnimFrame(mainLoop);
    var curTime = new Date();
    var dt = ( curTime - game.lastTime ) / 1000;
    update(dt);
    handleCollisions();
    updateRemoteParty();
    render();
    game.lastTime = curTime;
}

function init(){
    game.init();
    mouse.init();
    field.init();
    ball.init();
    paddleLeft = new Paddle(true);
    paddleRight = new Paddle(false);
    socket.init();
    mainLoop();
}

var peerConnection = new webkitRTCPeerConnection({'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }]});
var dataChannel = peerConnection.createDataChannel('dc', {
    ordered: false,
    maxRetransmitTime: 3000
});

dataChannel.onerror = function(err){
    console.log('DC error', err);
};

dataChannel.onmessage = function(e){
    console.log('DC got message:', e.data);
}

dataChannel.onopen = function(){
    dataChannel.send('Hello World!');
};

dataChannel.onclose = function(){
    console.log('dc closed');
};


var socket = {
    conn: null,
    
    init: function(){
        this.conn = new WebSocket('ws://192.168.1.154:8080');
        this.conn.onopen = function(){
            console.log('connection opened');
        };

        this.conn.onmessage = function(e){
            var msg = JSON.parse(e.data);
            for(var i = msg.length - 1; i >= 0; i--){
                switch(msg[i].object){
                    case 'paddle':
                        var paddle = msg[i].data;
                        if(paddle.isLeft){
                            paddleLeft.sync(paddle);
                        } else {
                            paddleRight.sync(paddle);
                        }
                    break;
                    case 'ball':
                        ball.sync(msg[i].data);
                    break;
                }
            }
        };
    },

    sendMessage: function(msg){
        if(!this.conn || this.conn.readyState != 1) { return; }

        this.conn.send(msg);
    }
};

function notHost(){
    config.imhost = false;
    paddleLeft.controlledByUser = false;
    paddleRight.controlledByUser = true;
};

$(function(){
    console.log('hello');
    init();
});