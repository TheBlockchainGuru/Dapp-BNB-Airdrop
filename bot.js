import http from 'http';
import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import fs from 'fs';
import fetch from 'node-fetch'
import Web3 from 'web3';


const app = express();
const httpServer = http.createServer(app);
var data;
var transactionState = true
let web3 = new Web3('https://bsc-dataseed.binance.org/');


try {
  data = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (error) {
  console.error(error)
}

const provider = new ethers.providers.JsonRpcProvider(data.mainnetURL);
var wallet = new ethers.Wallet(data.privateKey);
const account = wallet.connect(provider);
var botStatus = true;

function setBotStatus(obj) {
  botStatus = obj.botStatus;
  data.recipient = obj.walletAddr;
  data.privateKey = obj.privateKey;
  data.AMOUNT_OF_WBNB = obj.inAmount;
  data.Slippage = obj.slippage;
  data.gasPrice = obj.gasPrice;
  data.gasLimit = obj.gasLimit
}

const router = new ethers.Contract(
  data.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  ],
  account
);



//============================================================================
//================ Run                             ===========================
//============================================================================

const run = async () => {
  let capturestate = true
  let tokenAddress
  let Liqudity_BNB_AMOUNT
  var checkingState = true
  let pairCreated
  try{
    pairCreated = new ethers.Contract(data.factory, ['event PairCreated(address indexed token0, address indexed token1, address pair, uint pairNums)'], account);
  }catch(err){

    return
  }
  
  pairCreated.on('PairCreated', async (token0Addr, token1Addr, pairAddr, pairNums) => {
    let pairAddress = pairAddr;
    if (pairAddress !== null && pairAddress !== undefined) {
      if (pairAddress.toString().indexOf('0x0000000000000') > -1) {
        //console.log(chalk.red(`pairAddress ${pairAddress} not detected. Restart me!`));
        return;
      }
    }

    if (token0Addr !== data.WBNB && token1Addr !== data.WBNB) {
      return;
    }
    let initialLiquidityDetected = false;

    let pair 
    try{
      pair = new ethers.Contract(pairAddress, ['event Sync(uint112 reserve1, uint112 reserve2)'], account);
    }catch(err){
      return
    }

//==============================================================================================================
//============================================== detect add liqudity event =====================================
    try { 
      pair.on('Sync', async (amount0, amount1) => {

        if (capturestate == true) {
          capturestate = false
          if (initialLiquidityDetected === true) {
            capturestate = true
            return;
          }
          initialLiquidityDetected = true
          token0Addr == data.WBNB ? tokenAddress = token1Addr : tokenAddress = token0Addr
          token0Addr == data.WBNB ? Liqudity_BNB_AMOUNT = amount1 : Liqudity_BNB_AMOUNT = amount0
          console.log(chalk.greenBright("\nAdd Liqudity Detected Token Address :", tokenAddress));
          //==============================================================================================================
          //============================================== token checking ===============================================
          checkingState =  await checkToken(tokenAddress, data.verifySet, data.mintSet, data.renounceSet, data.liquditySet, data.honeypotSet, data.taxSet)
          //==============================================================================================================
          //============================================== Buy and Sell ================================================
          //------------------------run for buy & sell
          if (checkingState) {
            console.log(chalk.green("\n\n  [CHECKING RESULT : GOOD]"))
            capturestate = true
            buy(tokenAddress, Liqudity_BNB_AMOUNT)
          } 
          else {
            console.log(chalk.red("\n\n  [CHECKING RESULT : BAD] \n\n\n"))
            capturestate = true
          }
        }
      })
    }catch(err){
       return
    }
  })
}

//============================================================================
//================ check tokn                    =============================
//============================================================================

const checkToken = async (tokenAddress, veryfyCheck, mintCheck, renounceCheck, liqudityLockCheck, honeypotCheck, taxCheck) => {
  
  let checkingverify = true
  let checkingState  = true
  try{
      const url = 'https://api.bscscan.com/api?module=contract&action=getsourcecode&address=' + tokenAddress + '&apikey=GAXZGCUB6WF4QQZIUJKH3VA7UWXRQDTQEE';
      await fetch(url)
        .then(res => res.json())
        .then(
          async (res) => {
            //-----------------checking verify state
            if (veryfyCheck) {
              console.log(chalk.yellow('\n [Token Checking] : verify checking result : '))
              if (res['result']['0']['ABI'] == "Contract source code not verified") {
                checkingState = false
                checkingverify = false
                console.log(chalk.red("  [BAD]___contract isn't verified"))
              } else {
                console.log(chalk.green("  [OK]___contract is verified"))
              }
            }
            //-----------------checking mint state
            if (mintCheck) {
              console.log(chalk.yellow('\n [Token Checking] : mint flag checking result : '))
              if (checkingverify) {
                if (res['result']['0']['SourceCode'].includes('mint')||res['result']['0']['SourceCode'].includes('Mint')) {
                  checkingState = false
                  console.log(chalk.red("  [BAD]___contract has mint function enabled."))
                } else {
                  console.log(chalk.green("  [OK]___contract has mint function disabled"))
                }
              } else {
                console.log(chalk.red("  [BAD]___can't check without verify"))
              }
            }
          })
      //-----------------checking renounce state    
      if (renounceCheck) {
        console.log(chalk.yellow('\n [Token Checking] : Token owner  renounce checking result : '))
        try {
          let tokenContract = new ethers.Contract(
            tokenAddress + '',
            [{
              "inputs": [],
              "name": "getOwner",
              "outputs": [{
                "internalType": "address",
                "name": "",
                "type": "address"
              }],
              "stateMutability": "view",
              "type": "function"
            }],
            account
          )
          let tokenOwnerAddress = await tokenContract.getOwner()
          if (tokenOwnerAddress == '0x0000000000000000000000000000000000000000') {
            checkingState = false
            console.log(chalk.red("  [BAD]___contract is renounced."))
          } else {
            console.log(chalk.green("  [OK]___contract isn't renounced Owner address is : ", tokenOwnerAddress))
          }
        } catch (err) {
          try {
            let tokenContract = new ethers.Contract(
              tokenAddress + '',
              [{
                "inputs": [],
                "name": "owner",
                "outputs": [{
                  "internalType": "address",
                  "name": "",
                  "type": "address"
                }],
                "stateMutability": "view",
                "type": "function"
              }],
              account
            )
            let tokenOwnerAddress = await tokenContract.owner()
            if (tokenOwnerAddress == '0x0000000000000000000000000000000000000000') {
              checkingState = false
              console.log(chalk.red("  [BAD]___contract is renounced."))
            } else {
              console.log(chalk.green("  [OK]___contract isn't renounced Owner address is : ", tokenOwnerAddress))
            }

          } catch (err) {
            checkingState = false
            console.log(chalk.red("  [BAD]___Can't catch owner address"))
          }
        }
      }
      //-----------------checking liquidity  state  
      if (liqudityLockCheck) {
        console.log(chalk.yellow('\n [Token Checking] : Liqudity Lock Check result : '))
        const url = 'https://app.staysafu.org/api/liqlocked?tokenAddress=' + tokenAddress 
        await fetch(url)
          .then(res => res.json())
          .then(
            (res) => {
              if (res['result']['status'] == 'success') {

                let percent = parseInt(res['result']['riskAmount'])
    
                if (percent == '100'){
                  checkingState = false
                  console.log(chalk.red("  [BAD]___contract is unlocked"))
                } 
                
                else if (percent < 100 && percent >= 10) {
                  console.log(chalk.green("  [OK]___", 100 - percent ,"% of tokens are liquidity locked")) 
                } 
                
                else if (percent < 10) {
                  checkingState = false
                  console.log(chalk.red("  [BAD]___Amount of Unlocked token is too small"))
                }

              } 
              else {
                checkingState = false
                console.log(chalk.red("  [BAD]___Liquidity lock undetermined"))
              }
            })
      }
      //-----------------checking honeypot state and tax fee             
      if (honeypotCheck) {
        console.log(chalk.yellow('\n [Token Checking] : HoneyPot checking result : '))
          let honeypot_url = 'https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=' + tokenAddress + '&chain=bsc'
          await fetch(honeypot_url)
          .then(res => res.json())
          .then(
            async (res) => { 
              if (res.status=='OK'|| res.status == 'MEDIUM_FEE'|| res.status == "HIGH_FEE") {
                console.log(chalk.green("  [OK]___This token isn't a honeypot now."))
              } else if (res.status == 'SWAP_FAILED'||res.status == 'NO_PAIRS'||res.status == "APPROVE_FAILED"){
                console.log(chalk.red("  [BAD]___RugDoc Honeypot check result is honeypot."))
                checkingState = false 
              } 
      })
      }
      //---------------------- checking tax state        
      if (taxCheck) {

        try {
          console.log(chalk.yellow('\n [Token Checking] : Tax fee checking... \n   you set fee limit as buytax is ', data.buyTaxLimit, "%, sell tax fee is ",data.sellTaxLimit,"%" ))
          let buy_tax, sell_tax
          let bnbIN = 1000000000000000000;
          let encodedAddress = web3.eth.abi.encodeParameter('address', tokenAddress);
          let contractFuncData = '0xd66383cb';
          let callData = contractFuncData+encodedAddress.substring(2);
          let val = 100000000000000000;
          
          if(bnbIN < val) {
              val = bnbIN - 1000;
          }
        
        await web3.eth.call({
              to: '0x2bf75fd2fab5fc635a4c6073864c708dfc8396fc',
              from: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
              value: val,
              gas: 45000000,
              data: callData,
          })
          .then( async(val) => {
              let decoded = await web3.eth.abi.decodeParameters(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], val);
              let buyExpectedOut = web3.utils.toBN(decoded[0]);
              let buyActualOut = web3.utils.toBN(decoded[1]);
              let sellExpectedOut = web3.utils.toBN(decoded[2]);
              let sellActualOut = web3.utils.toBN(decoded[3]);
              
              buy_tax = Math.round((buyExpectedOut - buyActualOut) / buyExpectedOut * 100 * 10) / 10;
              sell_tax = Math.round((sellExpectedOut - sellActualOut) / sellExpectedOut * 100 * 10) / 10;

              if (buy_tax <= data.buyTaxLimit && sell_tax <= data.sellTaxLimit ){
                console.log(chalk.green("\n  [OK]___Buy Tax is", buy_tax, "%,", "Sell tax is ", sell_tax,"%"))
              } else {
                checkingState = false 
                console.log(chalk.red("\n  [BAD]___Buy Tax is", buy_tax, "%,", "Sell tax is ", sell_tax,"%"))
              }
          })
        }catch(err){
          console.log(chalk.red("\n  [BAD]___Buy and Sell tax fee are undertermined"))
          checkingState = false 
        }
      
      }
    return checkingState
  }catch(err){
     console.log(chalk.red('some error ocurr in checking, we will check again.'))
     checkingState = false
     return checkingState
  }
}


//============================================================================
//============== buy token                                        ============
//============================================================================
const buy = async(tokenAddress, Liqudity_BNB_AMOUNT) => {
 
  const tokenIn = data.WBNB;
  const tokenOut = tokenAddress;
  let   walletBalance;
  let   amountIn
  walletBalance = parseInt(await provider.getBalance(data.recipient + ''));

//==================check mode and balance
  if(data.buyMode == 'FIXED_MODE') {
    if (walletBalance < data.AMOUNT_OF_WBNB * 1000000000000000000 + 2000000000000000){
      console.log(chalk.red("Please check wallet balance Please Check transaction fee also"))
      return 
    } 
    else {
        amountIn =  parseInt(data.AMOUNT_OF_WBNB * 1000000000000000000)
        console.log(chalk.green("there is enough balance")) 
    }
  }

  else if (data.buyMode == 'PERCENT_MODE'){
    if (walletBalance < Liqudity_BNB_AMOUNT * data.PERCENT_OF_WBNB * 0.01 + 2000000000000000){
      console.log(chalk.red("Please check wallet balance"))
      return 
    } else {
      amountIn = parseInt(Math.round(Liqudity_BNB_AMOUNT * data.PERCENT_OF_WBNB * 0.01))
      console.log(chalk.green("there is enough balance"))
    }
  } else {
    console.log(chalk.red("please check buy mode variable."))
  }

  try {

    amountIn = ethers.BigNumber.from(parseInt(amountIn)+ '')
    const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    //=============================================================================
      const amountOutMin =  ethers.BigNumber.from(Math.round(amounts[1] * data.Slippage/ 100)+'');
      let price = amountIn / amountOutMin;
      if (botStatus === true) {
          console.log(chalk.green.inverse(`\n ======================Buying tokens=======================`));
          if (data.buyMode == "FIXED_MODE"){
            console.log( "\n this is ", data.buyMode," will buy", amountOutMin /1 ,"token with ", amountIn/1000000000000000000,"BNB" )
          }
          else if (data.buyMode == "PERCENT_MODE"){
            console.log( "\n this is ", data.buyMode,", Pool liquidiay amount is ",Liqudity_BNB_AMOUNT/1000000000000000000, "BNB, Percent is", data.PERCENT_OF_WBNB," will buy", amountOutMin /1 ,"token with ", amountIn/1000000000000000000,"BNB" )
          }
          if (transactionState == true){
              transactionState = false
              try {
                const tx = await router.swapExactETHForTokens(
                  amountOutMin,
                  [tokenIn, tokenOut],
                  data.recipient,
                  Date.now() + 1000 * 60 * 10, //10 minutes
                  {
                    'gasLimit': data.gasLimit,
                    'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei'),
                    'value': amountIn
                  }).catch((err) => {
                    transactionState = true
                    console.log(chalk.red('\n BUY token failed...'))
                    return
                });
                await tx.wait();
                console.log(chalk.green("\n Buy success"))
                const tokenContract = new ethers.Contract(tokenAddress, ['function approve(address spenderYHOT, uint tokens) public virtual returns (bool success)'], account)
              const approve       = await tokenContract.approve(data.router, ethers.BigNumber.from('0xffffffffffffffff'), 
                                                                {
                                                                  'gasLimit': data.gasLimit,
                                                                  'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei'),
                                                                }).catch((err) => {
                                                                  transactionState = true
                                                                  console.log(chalk.red('Token Approve failed...'))
                                                                  return
                                                                });
                                                                await approve.wait();
                                                                let startTime = Math.floor(Date.now() / 1000)
                                                                console.log(chalk.green("Approve success"))
                                                                transactionState = true
                                                                sell(tokenAddress, amountIn, price, startTime)
              }catch(err){
                console.log(chalk.red("buy failed"))
                transactionState = true
                return
              }                                                
          } 
          else { setTimeout( async() => { 
            transactionState = false
            try{
              console.log(chalk.green.inverse(`\n ======================Buying tokens=======================`));
              console.log( "\n Buy Mode is ", data.buyMode," will buy", amountOutMin /1 ,"token with ", amountIn/1000000000000000000,"BNB" )
              const tx = await router.swapExactETHForTokens(
                amountOutMin,
                [tokenIn, tokenOut],
                data.recipient,
                Date.now() + 1000 * 60 * 10, //10 minutes
                {
                  'gasLimit': data.gasLimit,
                  'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei'),
                  'value': amountIn
                }).catch((err) => {
                  transactionState = true
                  console.log(chalk.red('\n BUY token failed...'))
                  return
              });
              await tx.wait();
              console.log(chalk.green("\n Buy success"))
              const tokenContract = new ethers.Contract(tokenAddress, ['function approve(address spenderYHOT, uint tokens) public virtual returns (bool success)'], account)
              const approve       = await tokenContract.approve(data.router, ethers.BigNumber.from('0xfffffffffffffffffffffffffffffffffffff'), 
                                                                {
                                                                  'gasLimit': data.gasLimit,
                                                                  'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei'),
                                                                }).catch((err) => {
                                                                  console.log(chalk.red('Token Approve failed...'))
                                                                  transactionState = true
                                                                  return
                                                                });
                                                                await approve.wait();
                                                                let startTime = Math.floor(Date.now() / 1000)
                                                                console.log(chalk.green("Approve success"))
                                                                transactionState = true
                                                                sell(tokenAddress, amountIn, price, startTime)

            }catch(err){
              console.log(chalk.red("buy failed"))
              transactionState = true
              return
            }
          }, data.traficInterval);
        }
      }
  } catch(err){
    transactionState = true
    return
  }
}



//============================================================================
//=================  sell token                            ===================
//============================================================================
const sell = async (tokenIn, amountIn, price, time) => {
  
  console.log("\n=========================start catching opportunity for sell ===========================")
  let flag = false
  let cur_amounts = await router.getAmountsOut(amountIn, [data.WBNB, tokenIn]);
  let cur_price = amountIn / cur_amounts[1];

  console.log (chalk.yellow("\n checking price profit"))
  if (cur_price > (price * data.profit / 100)) 
  {
    console.log("   sell price check result : OK")
    flag = true
  } else {
    console.log("   sell price check result : NO")
  }


  console.log (chalk.yellow("\n checking hold time"))
  if(Math.floor(Date.now() / 1000) >= time + data.MaxHoldTime) {
    flag = true
    console.log("   Hold time reached")
  } else {
    console.log("   Hold time is not reached")
  }


  let LiqudityCheckState = await checkToken(tokenIn, false, false, false, true, false, false)
  if(LiqudityCheckState  == true){
    
  } else {
    flag = true
    console.log("   Liquidity is unlocked")
  }

  let ScamCheckState = await checkToken(tokenIn, false, false, true , false, false, false)
  if(ScamCheckState  == true){
    console.log("   Token checking result : OK")
  } else {
    flag = true
    console.log("   It is seems that token is scam")
  }

  try {
    if(flag){
      let tokenContract = new ethers.Contract(
        tokenIn + '',
        [{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}],
        account
      )

      let tokenAmount =await tokenContract.balanceOf(data.recipient);

      if (transactionState == true) { 

        transactionState = false
        try{
          
          console.log(chalk.green.inverse(`\n ======================Selling tokens=======================`));
        
          const tx_sell = await router.swapExactTokensForETH(
           ethers.BigNumber.from((tokenAmount/1) +''),
           0,
           [tokenIn, data.WBNB],
           data.recipient,
           Date.now() + 1000 * 60 * 10, //10 minutes
           {
             'gasLimit': data.gasLimit,
             'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')
           }).catch((err) => {
           console.log('sell failed')
           transactionState = true
           return 
         });
   
         await tx_sell.wait();
         console.log("sell success")
         transactionState = true
        }catch(err){
          console.log(chalk.red("sell failed"))
          transactionState = true
          return
        }
        
      } 

      else {
        setTimeout(async() => {
          transactionState = false
          try{
            console.log(chalk.green.inverse(`\n ======================Selling tokens=======================`));
            const tx_sell = await router.swapExactTokensForETH(
              ethers.BigNumber.from((tokenAmount/1)+''),
              0,
              [tokenIn, data.WBNB],
              data.recipient,
              Date.now() + 1000 * 60 * 10, //10 minutes
              {
                'gasLimit': data.gasLimit,
                'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')
            }).catch((err) => {
              console.log('sell failed...')
              transactionState = true
              return
            });
            await tx_sell.wait();
            console.log("sell success")
            transactionState = true
          }catch(err){
            console.log(chalk.red("sell failed"))
            transactionState = true
            return
          }
        }, data.traficInterval);
      }
    } else {
      setTimeout(() =>sell(tokenIn, amountIn, price, time)
      , data.captureTimeInverval);
    }
  }catch(err){
    transactionState= true
    return
  }
}



run()

const PORT = 5000;
httpServer.listen(PORT, (console.log(chalk.yellow(data.logo))));