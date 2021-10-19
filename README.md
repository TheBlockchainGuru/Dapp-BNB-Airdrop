# BHG-Trading-bot

## Pre Purchase Checks
1. Listen for new contracts and 'liquidity add' events
2. Check contract is verified [configuable feature on/off]
3. Check if contract is honeypot (does it allow trading buy/sell) [configuable feature on/off]
4. Check for minting flag in contract code [configuable feature on/off]
5. Check buy and sell tax limit (pass varible entered by user) [configuable feature on/off]
6. Check if owner is renounced [configuable feature on/off] (may slow entry into new contract?)
7. Check if Liquidity Pool is Locked [configuable feature on/off] (may slow entry into new contract?)

## Execute Purchase of Contract
8. Purchase amount based on percentage of L.P add OR purchase set amount of BNB (predefined by user varible).
Execute Sale of Token/Contract
9. Sell percentage of tokens/position (predefined user varible) if 
⦁ certain percentage profit is reached (predefined user varible) OR
⦁ sell if maximum hold time is reached in seconds, OR
⦁ sell if contract creator unlocks token (or similar possible scam event triggers in contract)

## Usage

1. set metamask wallet address and private key

    
            "recipient": "0x76bD076f18b926407ce1473BBa4c77C047B10FC8",
            "privateKey": "",                                        
            
            "WBNB":       "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
            "factory":    "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
            "router":     "0x10ED43C718714eb63d5aA57B78B54704E256024E",
            "mainnetURL": "https://bsc-dataseed.binance.org/",

            "verifyset":   true,                                                    //  checking enable (false : disable)
            "honeypotset": true,                                                    //  checking enable (false : disable) 
            "mintset":     true,                                                    //  checking enable (false : disable) 
            "taxset":      true,                                                    //  checking enable (false : disable) 
            "renounceset": true,                                                    //  checking enable (false : disable) 
            "liqudityset": true,                                                    //  checking enable (false : disable) 

            "buyMode" : "FIXED_MODE",                                               //  ('FIXED_MODE' : fixed bnb amount, "PERCENT_MODE" : percent of liqudity amount )
            
            "AMOUNT_OF_WBNB": 0.00002,     
            "PERCENT_OF_WBNB" : 0.0000001,
            "Slippage": 100,
            "profit": 200,                                                          // (limit profit for sell)
            "gasPrice": 5,
            "gasLimit": 345684,
            "MaxHoldTime" : 200000,                                                 // (minium holding token time)
            "captureTimeInverval" : 50000,                                          // (time interval checking sell condition capture)

    add wallet address to recipient, privatekey to privateKey.
2. install node.js  
3. Open Cmd in project's folder and run below instruction.
   
   npm install

4. Open Cmd in project's folder and run below instruction.
   
   node bot.js





