const https = require('https')
require('dotenv').config();

var KiteConnect = require("kiteconnect").KiteConnect;
var kc = new KiteConnect({
    api_key: process.env.API_KEY,
  });


function getRegisteredToken() {
    console.log(kc.getLoginURL());
}

function getAccessToken() {
  kc.generateSession(process.env.REQUEST_TOKEN, process.env.API_SECRET)
  .then(function (response) {
      console.log('acc', response);
  })
  .catch(function (err) {
    console.log(err);
  });
}

 // getRegisteredToken();
  getAccessToken();


// function getInstruments() {
//     kc.getPositions().then(function(response) {
// 		console.log(response);
// 	}).catch(function(err) {
// 		console.log(err);
// 	})
// }

// getInstruments();

// let bot = {
//     token: '5569385327:AAHVZ8VdrQ9B9akjRKwxmM9T5jTNXzvNc6Y',
//     chatId: '-892422505'
// }

// function sendMsg(msg) {
//     https.get(`https://api.telegram.org/bot${bot.token}/sendMessage?chat_id=${bot.chatId}&text=${msg}`)
//  }

//  sendMsg('test');