import {
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
} from "@solana/web3.js";
import base58 from "bs58";
import dotnet from 'dotenv'

import buyToken from "./pumputils/utils/buyToken";
import { Metaplex } from "@metaplex-foundation/js";
import WebSocket = require("ws");
import { BUY_AMOUNT, CHECK_DEV_BUY, GEYSER_RPC, MAYHEM_MODE_ONLY, MIN_DEV_BUY_AMOUNT, PRIVATE_KEY, RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT, SLIPPAGE, STOP_LOSS, TAKE_PROFIT, TIME_OUT } from "./constants";
import { getSellPrice } from "./pumputils/utils/getSellPrice";
import { getMC } from "./pumputils/utils/getMarketCapSol";
import sellToken from "./pumputils/utils/sellToken";
import { saveToJSONFile } from "./utils";
import isMayhemMode from "./pumputils/utils/isMayhemMode";

interface IToken {
    mint: string;
    bondingCurve: string;
    bondingCurveAta: string;
    tx: number;
}

const tokens: IToken[] = [];

dotnet.config();

const ws = new WebSocket(GEYSER_RPC);
const connection = new Connection(RPC_ENDPOINT, { wsEndpoint: RPC_WEBSOCKET_ENDPOINT, commitment: "processed" });
const payerKeypair = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
const TP = BUY_AMOUNT * (100 + TAKE_PROFIT) / 100;
const LS = BUY_AMOUNT * (100 - STOP_LOSS) / 100;

const withGaser = () => {

    console.log('Your Pub Key => ', payerKeypair.publicKey.toString());

    // let isbuying = false;

    function sendRequest(ws: WebSocket) {
        const request = {
            jsonrpc: "2.0",
            id: 420,
            method: "transactionSubscribe",
            params: [
                {
                    failed: false,
                    accountInclude: ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"]
                },
                {
                    commitment: "processed",
                    encoding: "jsonParsed",
                    transactionDetails: "full",
                    maxSupportedTransactionVersion: 0
                }
            ]
        };
        ws.send(JSON.stringify(request));
    }

    ws.on('open', function open() {
        console.log('WebSocket is open');
        sendRequest(ws);  // Send a request once the WebSocket is open
    });

    ws.on('message', async function incoming(data: WebSocket.Data) {
        const messageStr = data.toString('utf8');
        try {
            const messageObj = JSON.parse(messageStr);

            const result = messageObj.params.result;
            const logs = result.transaction.meta.logMessages;
            const signature = result.signature; // Extract the signature
            const accountKeys = result.transaction.transaction.message.accountKeys.map((ak: { pubkey: any; }) => ak.pubkey);
            const instructions = result.transaction.meta.innerInstructions;

            if (logs && logs.some((log: string | string[]) => log.includes('Program log: Instruction: InitializeMint2'))) {
                // if (isbuying) return
                // isbuying = true;

                // if (positionCount >= POSITION_NUMBER) return
                // positionCount ++;

                const firstTime = Date.now();

                const dev = accountKeys[0];
                const mint = accountKeys[1];
                const bondingCurve = accountKeys[2];
                const bondingCurveAta = accountKeys[3];

                console.log("New signature => ", `https://solscan.io/tx/${signature}`);

                console.log('New token => ', `https://solscan.io/token/${mint.toString()}`)

                const mintPub = new PublicKey(mint);
                const bondingCurvePub = new PublicKey(bondingCurve);
                const bondingCurveAtaPub = new PublicKey(bondingCurveAta);

                // Check for Mayhem Mode
                const isMayhem = await isMayhemMode(mintPub, connection);
                if (isMayhem) {
                    console.log('🔥 MAYHEM MODE DETECTED! 🔥');
                } else {
                    console.log('📊 Normal token (not Mayhem Mode)');
                }

                // Filter by Mayhem Mode if enabled
                if (MAYHEM_MODE_ONLY && !isMayhem) {
                    console.log('⏭️  Skipping non-Mayhem Mode token (MAYHEM_MODE_ONLY=true)');
                    return;
                }

                let buySolAmount = 0;
                let buyTokenAmount = 0;

                for (let i = 0; i < instructions.length; i++) {
                    const instructs = instructions[i].instructions;
                    for (let j = 0; j < instructs.length; j++) {
                        const isBuyInsctruct = instructs[j];
                        try {
                            if (isBuyInsctruct.parsed.info.destination === bondingCurve && isBuyInsctruct.parsed.info.source === dev) {

                                buySolAmount = Number(isBuyInsctruct.parsed.info.lamports) / LAMPORTS_PER_SOL;
                                buyTokenAmount = Number(instructs[j - 1].parsed.info.amount) / 10 ** 6;
                                break;
                            }
                        } catch (error) {
                            continue
                        }
                    }
                }

                // if (buySolAmount === 0 || buyTokenAmount === 0) return isbuying = false;

                // const slot = await connection.getSlot();
                // console.log("Current slot => ", slot)
                // saveToJSONFile(result)

                if (CHECK_DEV_BUY) {
                    if (buySolAmount >= MIN_DEV_BUY_AMOUNT) {
                        console.log(`Dev bought token with more than ${MIN_DEV_BUY_AMOUNT} sol`)
                        if (isMayhem) {
                            console.log('🔥 Executing buy on Mayhem Mode token!')
                        }
                        console.log("Going to Buy!", Date.now() - firstTime)
                        const sig = await buyToken(mintPub, connection, payerKeypair, BUY_AMOUNT, SLIPPAGE, bondingCurvePub, bondingCurveAtaPub, result.transaction.transaction.message.recentBlockhash);
                        if (!sig) {
                            console.log("Transaction failed!")
                        } else {
                            console.log('Buy Success: ', `https://solscan.io/tx/${sig.sig}\n`);
                            const sellResult = await monitorSellPosition(sig.tokenAmount, bondingCurvePub);
                            if (sellResult) {
                                const blockhash = (await connection.getLatestBlockhash()).blockhash
                                const sellSig = await sellToken(mintPub, connection, payerKeypair, sig.tokenAmount, bondingCurveAtaPub, blockhash)
                                console.log("Sell Success: ", `https://solscan.io/tx/${sellSig}\n`);
                            }
                        }
                    } else {
                        tokens.push({
                            mint,
                            bondingCurve,
                            bondingCurveAta,
                            tx: 0
                        })
                    }
                } else {
                    // If not checking dev buy, we can still buy Mayhem Mode tokens immediately
                    // or add to monitoring list for later buy signals
                    if (isMayhem && MAYHEM_MODE_ONLY) {
                        console.log('🔥 Mayhem Mode token detected - Buying immediately!')
                        console.log("Going to Buy!", Date.now() - firstTime)
                        const sig = await buyToken(mintPub, connection, payerKeypair, BUY_AMOUNT, SLIPPAGE, bondingCurvePub, bondingCurveAtaPub, result.transaction.transaction.message.recentBlockhash);
                        if (!sig) {
                            console.log("Transaction failed!")
                        } else {
                            console.log('Buy Success: ', `https://solscan.io/tx/${sig.sig}\n`);
                            const sellResult = await monitorSellPosition(sig.tokenAmount, bondingCurvePub);
                            if (sellResult) {
                                const blockhash = (await connection.getLatestBlockhash()).blockhash
                                const sellSig = await sellToken(mintPub, connection, payerKeypair, sig.tokenAmount, bondingCurveAtaPub, blockhash)
                                console.log("Sell Success: ", `https://solscan.io/tx/${sellSig}\n`);
                            }
                        }
                    } else if (!MAYHEM_MODE_ONLY) {
                        // Add to monitoring list if not Mayhem Mode only mode
                        tokens.push({
                            mint,
                            bondingCurve,
                            bondingCurveAta,
                            tx: 0
                        })
                    }
                }
            } else if (logs && logs.some((log: string | string[]) => log.includes('Program log: Instruction: Buy'))) {
                const mainInstructions = result.transaction.transaction.message.instructions;
                const mainstruct = mainInstructions.filter((item: { program: string; }) => item.program === 'spl-associated-token-account');
                if (mainstruct && mainstruct.length !== 0) {
                    const mint = mainstruct[0].parsed.info.mint;
                    const tokenIndex = tokens.findIndex((token) => token.mint === mint);
                    if (tokenIndex !== -1) {
                        const buySolAmount = getBuySolAmount(instructions, tokens[tokenIndex].bondingCurve);
                        console.log("🚀 ~ incoming ~ buySolAmount:", buySolAmount)
                        const mintPub = new PublicKey(mint);
                        const bondingCurvePub = new PublicKey(tokens[tokenIndex].bondingCurve);
                        const bondingCurveAtaPub = new PublicKey(tokens[tokenIndex].bondingCurveAta);
                        if (buySolAmount >= MIN_DEV_BUY_AMOUNT) {
                            // Buy Part
                            const sig = await buyToken(mintPub, connection, payerKeypair, BUY_AMOUNT, SLIPPAGE, bondingCurvePub, bondingCurveAtaPub, result.transaction.transaction.message.recentBlockhash);
                            if (!sig) {
                                console.log("Transaction failed!")
                            } else {
                                console.log('Buy Success: ', `https://solscan.io/tx/${sig.sig}\n`);
                                const sellResult = await monitorSellPosition(sig.tokenAmount, bondingCurvePub);
                                if (sellResult) {
                                    const blockhash = (await connection.getLatestBlockhash()).blockhash
                                    const sellSig = await sellToken(mintPub, connection, payerKeypair, sig.tokenAmount, bondingCurveAtaPub, blockhash)
                                    console.log("Sell Success: ", `https://solscan.io/tx/${sellSig}\n`);
                                }
                            }
                            tokens.splice(tokenIndex, 1);
                        } else if (tokens[tokenIndex].tx === 1) {
                            tokens.splice(tokenIndex, 1);
                            console.log("Not our target! Removed from list!");
                        } else {
                            tokens[tokenIndex].tx = 1;
                            console.log("First buy!")
                        }
                    } else {
                        return
                    }
                }
            }
        } catch (e) {
            console.log("🚀 ~ incoming ~ e:", e);
            saveToJSONFile(JSON.parse(messageStr))
        }
    });
}

const getBuySolAmount = (instructions: any, bondingCurve: string) => {
    let buySolAmount = 0;
    for (let i = 0; i < instructions.length; i++) {
        const instructs = instructions[i].instructions;
        for (let j = 0; j < instructs.length; j++) {
            const isBuyInsctruct = instructs[j];
            try {
                if (isBuyInsctruct.parsed.info.destination === bondingCurve) {
                    buySolAmount = Number(isBuyInsctruct.parsed.info.lamports) / LAMPORTS_PER_SOL;
                    break;
                }
            } catch (error) {
                continue
            }
        }
    }
    return buySolAmount;
}

const monitorSellPosition = async (tokenAmount: number, bondingCurvePub: PublicKey): Promise<number> => {
    console.log("Monitoring token price");
    let totalTime = 0;
    return new Promise((resolve) => {
        const monitor = setInterval(async () => {
            const outAmount = await getSellPrice(connection, bondingCurvePub, SLIPPAGE, tokenAmount);
            console.log("Output sol", outAmount)
            if (Number(outAmount) >= TP) {
                console.log("Take Profit Point! Going to sell", outAmount);
                clearInterval(monitor);
                resolve(outAmount)
            } else if (Number(outAmount) <= LS) {
                console.log("Stop Loss Point! Going to sell", outAmount);
                clearInterval(monitor);
                resolve(outAmount)
            }
            totalTime += 500;
            if ((totalTime / 1000) >= TIME_OUT) {
                console.log("Time Out! Going to sell!")
                clearInterval(monitor);
                resolve(outAmount)
            }
        }, 500);
    })
}

// const monitorMarketCap = (bondingCurvePub: PublicKey): Promise<boolean> => {
//     console.log("Monitoring MarketCap...")
//     let totalTime = 0;
//     return new Promise((resolve) => {
//         const monitor = setInterval(async () => {
//             const mc = await getMC(connection, bondingCurvePub);
//             console.log("🚀 Current Market Cap Sol:", mc)
//             if (mc >= MARKET_CAP) {
//                 clearInterval(monitor);
//                 resolve(true); // Resolve the promise when the market cap condition is met
//             }
//             totalTime += 500;
//             if ((totalTime / 1000) >= TIME_OUT) {
//                 console.log("Time Out! Going to skip this token!")
//                 clearInterval(monitor);
//                 resolve(false);
//             }
//         }, 500);
//     });
// }

// const getTokenMetadata = async (mintAddress: string, connection: Connection, retries: number = 5, delay: number = 100): Promise<any> => {
//     const metaplex = Metaplex.make(connection);
//     const mintPublicKey = new PublicKey(mintAddress);

//     // Helper function for delay
//     const delayFunction = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

//     for (let attempt = 1; attempt <= retries; attempt++) {
//         try {
//             const nft = await metaplex.nfts().findByMint({ mintAddress: mintPublicKey });
//             return nft.json;  // Returns the token's ticker/symbol
//         } catch (error) {
//             if (attempt < retries) {
//                 await delayFunction(delay);
//             } else {
//                 return false;
//             }
//         }
//     }
// };


const runBot = () => {
    console.log('--------------- Pump.fun Mayhem Mode Sniper is running! ---------------');
    if (MAYHEM_MODE_ONLY) {
        console.log('🔥 MAYHEM MODE ONLY: Enabled - Only sniping Mayhem Mode tokens\n');
    } else {
        console.log('📊 Mode: All tokens (including Mayhem Mode)\n');
    }
    withGaser();
}

runBot()