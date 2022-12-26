var KiteTicker = require("kiteconnect").KiteTicker;
var KiteConnect = require("kiteconnect").KiteConnect;
const https = require('https')

let bot = {
    token: '5569385327:AAHVZ8VdrQ9B9akjRKwxmM9T5jTNXzvNc6Y',
    chatId: '-892422505'
}


var ticker = new KiteTicker({
    api_key: "556jieo94zf7e2ma",
    access_token: "Sa2wv2KzP1ConkwjpmOyxV1q3cRtW7GO"
});

var kc = new KiteConnect({
    api_key: "556jieo94zf7e2ma",
    access_token: "Sa2wv2KzP1ConkwjpmOyxV1q3cRtW7GO"
});

let instrumentTokens = [];

let Ce_Pe_Loss = [];

ticker.autoReconnect(true, 20, 2)

ticker.connect();
ticker.on('ticks', onTicks);
ticker.on('connect', subscribe);
ticker.on('disconnect', onDisconnect);
ticker.on('error', onError);
ticker.on('close', onClose);
ticker.on('order_update', onTrade);

ticker.on("reconnect", function(reconnect_count, reconnect_interval) {
    console.log("Reconnecting: attempt - ", reconnect_count, " interval - ", reconnect_interval);
});

// init();

function onTicks(ticks) {
	 console.log("Ticks", ticks);
}

function sendMsg(msg) {
    https.get(`https://api.telegram.org/bot${bot.token}/sendMessage?chat_id=${bot.chatId}&text=${msg}`)
 }

function subscribe(itemsVal) {
	// var items = instrumentTokens || [14952706, 21891074,
    //     10336514, 22004994,
    //     12311042,  9252354,
    //     22005506];
    var items = [63548423];
    console.log('subscribing tokens', items);
	ticker.subscribe(items);
	ticker.setMode(ticker.modeFull, items);
}

function onDisconnect(error) {
	console.log("Closed connection on disconnect", error);
}

function onError(error) {
	console.log("Closed connection on error", error);
}

function onClose(reason) {
	console.log("Closed connection on close", reason);
}

function getMargins() {
    return kc.getMargins()
    .then(function (response) {
      console.log('response...', response.commodity.net);
      return response.commodity.net
    })
    .catch(function (err) {
      // Something went wrong.
      console.log('err..', err);
    });
}

async function init() {
  initialMargin = await getMargins();
}

async function clearAllTriggers() {
   Ce_Pe_Loss = [];
   const ordersList = await getOrders();

   if(ordersList.length > 0) {
       const pendingTriggers = ordersList.filter(item => item.status == 'TRIGGER PENDING');

       if(pendingTriggers.length > 0) {
           pendingTriggers.forEach(item => {
            try{
                cancelTrigger(item.order_id)
            } catch {
                let itemFailed = item;
                (setTimeout((itemFailed) => {
                    cancelTrigger(itemFailed.order_id)
                }, 3000))(itemFailed)
            }
            
           })
       }
   }
}

function setInstrumentToken(positions) {
    if(positions) {
        instrumentTokens = positions.net.map(item => item.instrument_token);
        subscribe(instrumentTokens);
    }
}
 
async function onTrade(order) {
    let allPositions;
    let sellOrders;
    if(order.status == 'COMPLETE') {
       clearAllTriggers();
        allPositions = await getPositions();

        setInstrumentToken(allPositions);
        
        sellOrders = allPositions.net.filter(item => item.quantity < 0);

        console.log('sellOrders', sellOrders);


        if(sellOrders.length > 0) {
            sellOrders.forEach(async item => {
                let remainingQuantity = Math.abs(item.quantity);

                const multiplier = await getMultiplier(item);

                const avgPrice = item.average_price;
                const triggerPrice = avgPrice * multiplier;

                const maxLoss = (triggerPrice) * remainingQuantity;
                Ce_Pe_Loss.push({
                    [item.tradingsymbol]: maxLoss
                });

                console.log('multiplier fetched', multiplier);
                console.log('CE_PE_LOSS', Ce_Pe_Loss, maxLoss)
            
                while(remainingQuantity) {
                    if(remainingQuantity > 900) {
                        console.log('placing order 900')
                        placeOrder(item, Math.round(item.average_price * 7), 'BUY', 900)
                        remainingQuantity = remainingQuantity - 900
                    } else {
                        console.log('placing rest of order ', remainingQuantity);
                        placeOrder(item, Math.round(item.average_price * 7), 'BUY', remainingQuantity)
                        remainingQuantity = 0;
                    }
                    
                }
            })

            
        } 
    }

    console.log('CE and PE Loss', Ce_Pe_Loss);
    if(Ce_Pe_Loss) {
      sendMsg(JSON.stringify(Ce_Pe_Loss))
    }
    
}

function getPositions() {
    return kc.getPositions()
      .then(function (response) {
        return response
        
      })
      .catch(function (err) {
        // Something went wrong.
        console.log('err..', err);
    });

}

function placeOrder(order, price, type, quantity) {
   kc.placeOrder(order.variety || 'regular', {
        "exchange": order.exchange,
        "tradingsymbol": order.tradingsymbol,
        "transaction_type": type,
        "quantity": quantity,
        "product": order.product,
        "order_type": "SL",
        "price": price,
        "trigger_price": price
    }).then(function(resp) {
        console.log(resp);
    }).catch(e => console.log(e))
}

function getOrders() {
    return kc.getOrders()
    .then(function (response) {
      return response
      
    })
    .catch(function (err) {
      // Something went wrong.
      console.log('err..', err);
    });
}

function cancelTrigger(order_id) {
    kc.cancelOrder('regular', order_id)
    .then(function(resp) {
        console.log(resp);
    }).catch(function(err) {
        console.log(err);
    });
}

function isTriggerOrderUpdate(order) {
    return !!order.trigger_price
}

function modifyTriggerPending(order_id, quantity) {
    kc.modifyOrder('regular', order_id, {
        quantity: quantity
    }).then(function(resp) {
        console.log(resp);
    }).catch(function(err) {
        console.log(err);
    });
}

function getMultiplier (order) {
    return kc.getQuote("NSE:NIFTY BANK").then(function(response) {
		console.log(response);
        let lastPrice = response['NSE:NIFTY BANK'].last_price;

        let strikePrice = order.tradingsymbol.slice(14,19);

        let strikePriceParsed = parseInt(strikePrice);

        console.log('strikePrice', strikePrice, lastPrice);
        let difference = Math.abs(lastPrice - strikePriceParsed);

        let multiplier = Math.ceil((difference/200) + 2);

        console.log('difference', difference)
        console.log('multiplier', Math.ceil((difference/200) + 2)) ;

        return multiplier;
        
	}).catch(function(err) {
		console.log(err);
	})
}


