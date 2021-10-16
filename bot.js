import http from 'http';
import ethers from 'ethers';
import express from 'express';
import chalk from 'chalk';
import fs from 'fs';
import fetch from 'node-fetch'


const app = express();
const httpServer = http.createServer(app);
var data;

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

const run = async () => {
  let capturestate = true
  let tokenAddress
  let Liqudity_BNB_AMOUNT
  var checkingState = true
  var checkingverify = true
  const pairCreated = new ethers.Contract(data.factory, ['event PairCreated(address indexed token0, address indexed token1, address pair, uint pairNums)'], account);
  pairCreated.on('PairCreated', async (token0Addr, token1Addr, pairAddr, pairNums) => {

    let pairAddress = pairAddr;
    if (pairAddress !== null && pairAddress !== undefined) {
      if (pairAddress.toString().indexOf('0x0000000000000') > -1) {
        //console.log(chalk.red(`pairAddress ${pairAddress} not detected. Restart me!`));
        return;
      }
    }

    if (token0Addr !== data.WBNB && token1Addr !== data.WBNB) {
      //console.log(chalk.red(" \n [BAD]___it isn't bnb pair!!"))
      return;
    }
    let initialLiquidityDetected = false;
    const pair = new ethers.Contract(pairAddress, ['event Sync(uint112 reserve1, uint112 reserve2)'], account);
//==============================================================================================================
//============================================== detect add liqudity event =====================================

    pair.on('Sync', async (amount0, amount1) => {
      if (capturestate == true) {
        capturestate = false

        if (initialLiquidityDetected === true) {
          capturestate = true
          return;
        }

        token0Addr == data.WBNB ? tokenAddress = token1Addr : tokenAddress = token0Addr
        token0Addr == data.WBNB ? Liqudity_BNB_AMOUNT = amount1 : Liqudity_BNB_AMOUNT = amount0

        console.log(chalk.greenBright("\nAdd Liqudity Detected Token Address :", tokenAddress));

        console.log('\n checking token contract...  address is ', tokenAddress)
//==============================================================================================================
//============================================== token checking ================================================

        const url = 'https://api.bscscan.com/api?module=contract&action=getsourcecode&address=' + tokenAddress + '&apikey=GAXZGCUB6WF4QQZIUJKH3VA7UWXRQDTQEE';
        await fetch(url)
          .then(res => res.json())
          .then(
            async (res) => {
              //-----------------checking verify state
              if (data.verifyset) {
                console.log(chalk.yellow('\n Step 1 : verify checking result : '))
                if (res['result']['0']['ABI'] == "Contract source code not verified") {
                  checkingState = false
                  checkingverify = false
                  console.log(chalk.red("  [BAD]___contract isn't verified"))
                } else {
                  console.log(chalk.green("  [OK]___contract is verified"))
                }
              }

              //-----------------checking mint state
              if (data.mintset) {
                console.log(chalk.yellow('\n Step 2 : mint flag checking result : '))
                if (checkingverify) {
                  if (res['result']['0']['SourceCode'].includes('mint')) {
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
        if (data.renounceset) {
          console.log(chalk.yellow('\n Step 3 : Token owner  renounce checking result : '))
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
        if (data.liqudityset) {
          console.log(chalk.yellow('\n Step 4 : Liqudity Lock Check result : '))
          const url = 'https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=' + tokenAddress + '&address=0x0000000000000000000000000000000000000000&tag=latest&apikey=GAXZGCUB6WF4QQZIUJKH3VA7UWXRQDTQEE';
          await fetch(url)
            .then(res => res.json())
            .then(
              (res) => {
                if (res['result'] > 0) {
                  checkingState = false

                  console.log(chalk.red("  [BAD]___contract is liquidity locked"))
                } else {
                  console.log(chalk.green("  [OK]___contract is not locked"))
                }
          })
        }
        //-----------------checking honeypot state and tax fee             
        if (data.honeypotset) {
          console.log(chalk.yellow('\n Step 5 : HoneyPot checking result : '))
            let honeypot_url = 'https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=' + tokenAddress + '&chain=bsc'
            await fetch(honeypot_url)
            .then(res => res.json())
            .then(
              async (res) => {
                if (res.status=='OK'|| res.status == 'MEDIUM_FEE') {
                  console.log(chalk.green("  [OK]___This token isn't a honeypot now."))
                } else if (res.status == 'SWAP_FAILED'){
                  console.log(chalk.red("  [BAD]___RugDoc Honeypot check result is failed."))
                  checkingState = false 
                } 
         })
       }
        //---------------------- checking tax state        
        if (data.taxset) {
          console.log(chalk.yellow('\n Step 6 : Check tax fee result'))
          let honeypot_url = 'https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=' + tokenAddress + '&chain=bsc'
          await fetch(honeypot_url)
          .then(res => res.json())
          .then(
            async (res) => {
              if (res.status=='OK'){
                console.log(chalk.green("  [OK]___Sell and Buy Tax fees are below than 10%"))
              } else if (res.status == 'SWAP_FAILED'){
                console.log(chalk.red("  [BAD]___This token is a Honeypot, So Can't catch a tax"))
                checkingState = false 
              } else if (res.status == 'MEDIUM_FEE'){
                console.log(chalk.yellow(" [BAD]___Sell and Buy Tax fees are over 10%"))
                checkingState = false 
              }
            })
        }
        
//==============================================================================================================
//============================================== Buy and Sell ================================================

        //------------------------run for buy & sell
        if (checkingState) {
          console.log(chalk.green("\n\n  [CHECKING RESULT : GOOD]"))
          initialLiquidityDetected = true;
          capturestate = true
          console.log()
          buy(tokenAddress, Liqudity_BNB_AMOUNT)
        } 
        else {
          console.log(chalk.red("\n\n  [CHECKING RESULT : BAD]"))
          console.log(chalk.yellow("\n\n  Listening for new Create pair & add liqudity token..."))
          capturestate = true
        }
      }
    })
  })
}




const buy = async(tokenAddress, Liqudity_BNB_AMOUNT) => {
  const tokenIn = data.WBNB;
  const tokenOut = tokenAddress;
  
  let   walletBalance;
  let   amountIn
  walletBalance = parseInt(await provider.getBalance(data.recipient + '')) ;

//==================check mode and balance

  if(data.buyMode == 'FIXED_MODE') {
    if (walletBalance < data.AMOUNT_OF_WBNB * 1000000000000000000){
      console.log(chalk.red("Please check wallet balance"))
      return 
    } 
    else {
      amountIn =  ethers.BigNumber.from(data.AMOUNT_OF_WBNB * 1000000000000000000)
      console.log(chalk.green("there is enough balance")) 
    }
  } 

  else if (data.buyMode == 'PERCENT_MODE'){
    if (walletBalance < Liqudity_BNB_AMOUNT * data.PERCENT_OF_WBNB * 0.01){
      console.log(chalk.red("Please check wallet balance"))
      return 
    } else {
      console.log(Liqudity_BNB_AMOUNT)
      amountIn = ethers.BigNumber.from(parseInt(Liqudity_BNB_AMOUNT * data.PERCENT_OF_WBNB * 0.01)+'')
      console.log(chalk.green("there is enough balance")) 
    }
  } else {
    console.log(chalk.red("please check buy mode variable."))
  }

  const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);

//=============================================================================
  const amountOutMin =  amounts[1] * data.Slippage/ 100;

  console.log(chalk.green.inverse(`\n Buy token`));
  console.log( "this is ", data.buyMode," will buy", amountOutMin ,"token with ", amountIn/1000000000000000000,"BNB" )
  
  
  let price = amountIn / amountOutMin;
  console.log('Processing Transaction.....');
  if (botStatus === true) {
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
      console.log('BUY token failed...')
    });
    console.log("Buy success")
    await tx.wait();
   
    const tokenContract = new ethers.Contract(tokenAddress, ['function approve(address spenderYHOT, uint tokens) public virtual returns (bool success)'], account)
    const approve       = await tokenContract.approve(data.router, ethers.BigNumber.from('0xffffffffffffffff'), 
                                                      {
                                                        'gasLimit': data.gasLimit,
                                                        'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei'),
                                                      }).catch((err) => {
                                                        console.log('Token Approve failed...')
                                                      });
                                                      console.log("Approve success")
                                                      await approve.wait();
                                                      sell(tokenAddress, amountIn, amountOutMin, price)
  }
}



const sell = async (tokenIn, amountIn, amountOutMin, price) => {
  console.log("start to sell")
  let flag = true
  if(flag){
    let cur_amounts = await router.getAmountsOut(amountIn, [data.WBNB, tokenIn]);
    let cur_price = amountIn / cur_amounts[1];
    console.log(cur_price, price, amountOutMin)
    if (cur_price > (price * data.profit / 100)) 
    {
       console.log(chalk.green.inverse(`\n Selling tokens`));
       const tx_sell = await router.swapExactTokensForETH(
        ethers.BigNumber.from(amountOutMin+ ''),
        0,
        [tokenIn, data.WBNB],
        data.recipient,
        Date.now() + 1000 * 60 * 10, //10 minutes
        {
          'gasLimit': data.gasLimit,
          'gasPrice': ethers.utils.parseUnits(`${data.gasPrice}`, 'gwei')
        }).catch((err) => {
        console.log(err)
        console.log('transaction failed...')
      });
      flag = false;
      await tx_sell.wait();
      console.log("success")
    }
  }
}


buy('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 10000000000000000);
const PORT = 5000;

httpServer.listen(PORT, (console.log(chalk.yellow(data.logo))));