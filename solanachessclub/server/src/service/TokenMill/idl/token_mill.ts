/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/token_mill.json`.
 */
export type TokenMillType = {
  "address": "JoeaRXgtME3jAoz5WuFXGEndfv4NPH9nBxsLq44hk9J",
  "metadata": {
    "name": "tokenMill",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "acceptConfigOwnership",
      "discriminator": [
        6,
        212,
        14,
        48,
        229,
        38,
        62,
        241
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "pendingAuthority",
          "signer": true
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": []
    },
    {
      "name": "claimCreatorFees",
      "discriminator": [
        0,
        23,
        125,
        234,
        156,
        118,
        134,
        89
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "quoteTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "creatorQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "quoteTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": []
    },
    {
      "name": "claimReferralFees",
      "discriminator": [
        208,
        216,
        137,
        78,
        36,
        103,
        162,
        49
      ],
      "accounts": [
        {
          "name": "referralAccount"
        },
        {
          "name": "quoteTokenMint"
        },
        {
          "name": "referralAccountQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "referralAccount"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "referrerQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "referrer"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "referrer",
          "signer": true,
          "relations": [
            "referralAccount"
          ]
        },
        {
          "name": "quoteTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": []
    },
    {
      "name": "claimStakingRewards",
      "discriminator": [
        229,
        141,
        170,
        69,
        111,
        94,
        6,
        72
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "relations": [
            "staking",
            "stakePosition"
          ]
        },
        {
          "name": "staking",
          "writable": true
        },
        {
          "name": "stakePosition",
          "writable": true
        },
        {
          "name": "quoteTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user",
          "signer": true,
          "relations": [
            "stakePosition"
          ]
        },
        {
          "name": "quoteTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [],
      "returns": "u64"
    },
    {
      "name": "createConfig",
      "discriminator": [
        201,
        207,
        243,
        114,
        75,
        111,
        47,
        189
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "authority",
          "type": "pubkey"
        },
        {
          "name": "protocolFeeRecipient",
          "type": "pubkey"
        },
        {
          "name": "protocolFeeShare",
          "type": "u16"
        },
        {
          "name": "referralFeeShare",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ]
          }
        },
        {
          "name": "baseTokenMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "quoteTokenBadge",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ]
          }
        },
        {
          "name": "quoteTokenMint"
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "totalSupply",
          "type": "u64"
        },
        {
          "name": "creatorFeeShare",
          "type": "u16"
        },
        {
          "name": "stakingFeeShare",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createMarketWithSpl",
      "discriminator": [
        75,
        117,
        88,
        13,
        142,
        106,
        70,
        82
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ]
          }
        },
        {
          "name": "baseTokenMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "baseTokenMetadata",
          "writable": true
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "quoteTokenBadge",
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ]
          }
        },
        {
          "name": "quoteTokenMint"
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "totalSupply",
          "type": "u64"
        },
        {
          "name": "creatorFeeShare",
          "type": "u16"
        },
        {
          "name": "stakingFeeShare",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createQuoteAssetBadge",
      "discriminator": [
        224,
        76,
        142,
        221,
        109,
        134,
        164,
        74
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "quoteAssetBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": []
    },
    {
      "name": "createReferralAccount",
      "discriminator": [
        235,
        55,
        82,
        230,
        52,
        35,
        56,
        210
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "referralAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  102,
                  101,
                  114,
                  114,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "arg",
                "path": "referrer"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "referrer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "createStakePosition",
      "discriminator": [
        92,
        168,
        96,
        133,
        102,
        121,
        86,
        138
      ],
      "accounts": [
        {
          "name": "market"
        },
        {
          "name": "stakePosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createStaking",
      "discriminator": [
        184,
        219,
        61,
        66,
        140,
        212,
        112,
        133
      ],
      "accounts": [
        {
          "name": "market"
        },
        {
          "name": "staking",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116,
                  95,
                  115,
                  116,
                  97,
                  107,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createVestingPlan",
      "discriminator": [
        243,
        11,
        234,
        132,
        14,
        178,
        152,
        158
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "relations": [
            "staking",
            "stakePosition"
          ]
        },
        {
          "name": "staking",
          "writable": true
        },
        {
          "name": "stakePosition",
          "writable": true
        },
        {
          "name": "vestingPlan",
          "writable": true,
          "signer": true
        },
        {
          "name": "baseTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true,
          "relations": [
            "stakePosition"
          ]
        },
        {
          "name": "baseTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "start",
          "type": "i64"
        },
        {
          "name": "vestingAmount",
          "type": "u64"
        },
        {
          "name": "vestingDuration",
          "type": "i64"
        },
        {
          "name": "cliffDuration",
          "type": "i64"
        }
      ]
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "relations": [
            "staking",
            "stakePosition"
          ]
        },
        {
          "name": "staking",
          "writable": true
        },
        {
          "name": "stakePosition",
          "writable": true
        },
        {
          "name": "baseTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user",
          "signer": true,
          "relations": [
            "stakePosition"
          ]
        },
        {
          "name": "baseTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "freeMarket",
      "discriminator": [
        34,
        200,
        207,
        18,
        230,
        44,
        219,
        138
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "swapAuthorityBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  97,
                  112,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "swapAuthority"
              }
            ]
          }
        },
        {
          "name": "swapAuthority",
          "signer": true
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": []
    },
    {
      "name": "lockMarket",
      "discriminator": [
        107,
        8,
        184,
        91,
        223,
        13,
        180,
        38
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "swapAuthorityBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  97,
                  112,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "arg",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "authority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "permissionedSwap",
      "discriminator": [
        61,
        253,
        14,
        229,
        240,
        137,
        225,
        39
      ],
      "accounts": [
        {
          "name": "config",
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "swapAuthorityBadge",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  119,
                  97,
                  112,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "swapAuthority"
              }
            ]
          }
        },
        {
          "name": "baseTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "quoteTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "marketQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userBaseTokenAccount",
          "writable": true
        },
        {
          "name": "userQuoteTokenAccount",
          "writable": true
        },
        {
          "name": "protocolQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config.protocol_fee_recipient",
                "account": "tokenMillConfig"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "referralTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "swapAuthority",
          "signer": true
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "baseTokenProgram"
        },
        {
          "name": "quoteTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "swapType",
          "type": {
            "defined": {
              "name": "swapType"
            }
          }
        },
        {
          "name": "swapAmountType",
          "type": {
            "defined": {
              "name": "swapAmountType"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "otherAmountThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "release",
      "discriminator": [
        253,
        249,
        15,
        206,
        28,
        127,
        193,
        241
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "relations": [
            "staking",
            "stakePosition"
          ]
        },
        {
          "name": "staking",
          "writable": true
        },
        {
          "name": "stakePosition",
          "writable": true,
          "relations": [
            "vestingPlan"
          ]
        },
        {
          "name": "vestingPlan",
          "writable": true
        },
        {
          "name": "baseTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user",
          "signer": true,
          "relations": [
            "stakePosition"
          ]
        },
        {
          "name": "baseTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [],
      "returns": "u64"
    },
    {
      "name": "setMarketPrices",
      "discriminator": [
        39,
        123,
        107,
        117,
        49,
        29,
        21,
        159
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "bidPrices",
          "type": {
            "array": [
              "u64",
              11
            ]
          }
        },
        {
          "name": "askPrices",
          "type": {
            "array": [
              "u64",
              11
            ]
          }
        }
      ]
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "config",
          "relations": [
            "market"
          ]
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "baseTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "quoteTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "marketQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userBaseTokenAccount",
          "writable": true
        },
        {
          "name": "userQuoteTokenAccount",
          "writable": true
        },
        {
          "name": "protocolQuoteTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config.protocol_fee_recipient",
                "account": "tokenMillConfig"
              },
              {
                "kind": "account",
                "path": "quoteTokenProgram"
              },
              {
                "kind": "account",
                "path": "quoteTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "referralTokenAccount",
          "writable": true,
          "optional": true
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "baseTokenProgram"
        },
        {
          "name": "quoteTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "swapType",
          "type": {
            "defined": {
              "name": "swapType"
            }
          }
        },
        {
          "name": "swapAmountType",
          "type": {
            "defined": {
              "name": "swapAmountType"
            }
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "otherAmountThreshold",
          "type": "u64"
        }
      ]
    },
    {
      "name": "transferConfigOwnership",
      "discriminator": [
        53,
        124,
        67,
        226,
        108,
        130,
        19,
        12
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "pendingAuthority",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "updateCreator",
      "discriminator": [
        39,
        221,
        251,
        213,
        194,
        161,
        31,
        207
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "newCreator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateDefaultFeeShares",
      "discriminator": [
        115,
        93,
        80,
        199,
        54,
        219,
        32,
        85
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "newDefaultProtocolFeeShare",
          "type": "u16"
        },
        {
          "name": "newReferralFeeShare",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateMarketFeeShares",
      "discriminator": [
        233,
        190,
        64,
        95,
        167,
        94,
        190,
        251
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "creator",
          "signer": true,
          "relations": [
            "market"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "newCreatorFeeShare",
          "type": "u16"
        },
        {
          "name": "newStakingFeeShare",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateProtocolFeeRecipient",
      "discriminator": [
        213,
        60,
        21,
        106,
        42,
        67,
        60,
        162
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "newProtocolFeeRecipient",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updateQuoteAssetBadge",
      "discriminator": [
        42,
        12,
        208,
        17,
        29,
        174,
        196,
        103
      ],
      "accounts": [
        {
          "name": "config"
        },
        {
          "name": "quoteAssetBadge",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  113,
                  117,
                  111,
                  116,
                  101,
                  95,
                  116,
                  111,
                  107,
                  101,
                  110,
                  95,
                  98,
                  97,
                  100,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ]
          }
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "status",
          "type": {
            "defined": {
              "name": "quoteTokenBadgeStatus"
            }
          }
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "relations": [
            "staking",
            "stakePosition"
          ]
        },
        {
          "name": "staking",
          "writable": true
        },
        {
          "name": "stakePosition",
          "writable": true
        },
        {
          "name": "baseTokenMint",
          "relations": [
            "market"
          ]
        },
        {
          "name": "marketBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userBaseTokenAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "account",
                "path": "baseTokenProgram"
              },
              {
                "kind": "account",
                "path": "baseTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "user",
          "signer": true,
          "relations": [
            "stakePosition"
          ]
        },
        {
          "name": "baseTokenProgram"
        },
        {
          "name": "eventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "program"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    },
    {
      "name": "marketStaking",
      "discriminator": [
        17,
        179,
        11,
        222,
        30,
        156,
        211,
        86
      ]
    },
    {
      "name": "quoteTokenBadge",
      "discriminator": [
        52,
        32,
        57,
        85,
        7,
        186,
        76,
        229
      ]
    },
    {
      "name": "referralAccount",
      "discriminator": [
        237,
        162,
        80,
        78,
        196,
        233,
        91,
        2
      ]
    },
    {
      "name": "stakePosition",
      "discriminator": [
        78,
        165,
        30,
        111,
        171,
        125,
        11,
        220
      ]
    },
    {
      "name": "swapAuthorityBadge",
      "discriminator": [
        48,
        16,
        168,
        83,
        237,
        197,
        86,
        237
      ]
    },
    {
      "name": "tokenMillConfig",
      "discriminator": [
        28,
        200,
        141,
        206,
        141,
        183,
        203,
        16
      ]
    },
    {
      "name": "vestingPlan",
      "discriminator": [
        220,
        100,
        188,
        22,
        177,
        159,
        229,
        3
      ]
    }
  ],
  "events": [
    {
      "name": "tokenMillConfigCreationEvent",
      "discriminator": [
        50,
        202,
        6,
        29,
        20,
        37,
        228,
        174
      ]
    },
    {
      "name": "tokenMillConfigOwnershipTransferEvent",
      "discriminator": [
        142,
        146,
        167,
        218,
        16,
        195,
        187,
        19
      ]
    },
    {
      "name": "tokenMillCreatorFeeClaimEvent",
      "discriminator": [
        214,
        148,
        70,
        12,
        177,
        8,
        84,
        13
      ]
    },
    {
      "name": "tokenMillCreatorUpdateEvent",
      "discriminator": [
        235,
        58,
        31,
        188,
        37,
        43,
        196,
        232
      ]
    },
    {
      "name": "tokenMillDefaultFeeSharesUpdateEvent",
      "discriminator": [
        134,
        7,
        59,
        17,
        81,
        156,
        3,
        203
      ]
    },
    {
      "name": "tokenMillMarketCreationEvent",
      "discriminator": [
        117,
        160,
        179,
        86,
        1,
        166,
        221,
        229
      ]
    },
    {
      "name": "tokenMillMarketFeeSharesUpdateEvent",
      "discriminator": [
        254,
        221,
        151,
        0,
        24,
        107,
        239,
        123
      ]
    },
    {
      "name": "tokenMillMarketFreedEvent",
      "discriminator": [
        32,
        84,
        45,
        213,
        19,
        63,
        232,
        117
      ]
    },
    {
      "name": "tokenMillMarketLockedEvent",
      "discriminator": [
        114,
        180,
        107,
        31,
        174,
        31,
        194,
        23
      ]
    },
    {
      "name": "tokenMillMarketPriceSetEvent",
      "discriminator": [
        78,
        89,
        8,
        96,
        104,
        219,
        106,
        200
      ]
    },
    {
      "name": "tokenMillProtocolFeeRecipientUpdateEvent",
      "discriminator": [
        26,
        204,
        145,
        154,
        147,
        19,
        68,
        68
      ]
    },
    {
      "name": "tokenMillQuoteTokenBadgeEvent",
      "discriminator": [
        188,
        131,
        206,
        42,
        251,
        59,
        117,
        144
      ]
    },
    {
      "name": "tokenMillReferralFeeClaimEvent",
      "discriminator": [
        43,
        54,
        124,
        31,
        106,
        39,
        251,
        234
      ]
    },
    {
      "name": "tokenMillStakingDepositEvent",
      "discriminator": [
        210,
        175,
        200,
        81,
        173,
        187,
        59,
        109
      ]
    },
    {
      "name": "tokenMillStakingRewardsClaimEvent",
      "discriminator": [
        5,
        50,
        127,
        252,
        17,
        238,
        224,
        111
      ]
    },
    {
      "name": "tokenMillStakingWithdrawalEvent",
      "discriminator": [
        243,
        221,
        108,
        99,
        156,
        58,
        127,
        252
      ]
    },
    {
      "name": "tokenMillSwapEvent",
      "discriminator": [
        24,
        77,
        125,
        69,
        61,
        180,
        248,
        89
      ]
    },
    {
      "name": "tokenMillVestingPlanCreationEvent",
      "discriminator": [
        129,
        55,
        66,
        26,
        250,
        189,
        32,
        20
      ]
    },
    {
      "name": "tokenMillVestingPlanReleaseEvent",
      "discriminator": [
        56,
        240,
        43,
        96,
        116,
        83,
        237,
        21
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "pricesAlreadySet"
    },
    {
      "code": 6001,
      "name": "bidAskMismatch"
    },
    {
      "code": 6002,
      "name": "decreasingPrices"
    },
    {
      "code": 6003,
      "name": "priceTooHigh"
    },
    {
      "code": 6004,
      "name": "invalidTotalSupply"
    },
    {
      "code": 6005,
      "name": "invalidAmount"
    },
    {
      "code": 6006,
      "name": "mathError"
    },
    {
      "code": 6007,
      "name": "invalidAuthority"
    },
    {
      "code": 6008,
      "name": "invalidConfig"
    },
    {
      "code": 6009,
      "name": "invalidQuoteAssetBadge"
    },
    {
      "code": 6010,
      "name": "invalidFeeShare"
    },
    {
      "code": 6011,
      "name": "amountThresholdNotMet"
    },
    {
      "code": 6012,
      "name": "insufficientStakeAmount"
    },
    {
      "code": 6013,
      "name": "invalidMarket"
    },
    {
      "code": 6014,
      "name": "invalidMintAccount"
    },
    {
      "code": 6015,
      "name": "invalidReferralAccount"
    },
    {
      "code": 6016,
      "name": "invalidQuoteTokenMint"
    },
    {
      "code": 6017,
      "name": "unsupportedTokenMint"
    },
    {
      "code": 6018,
      "name": "invalidConfigAccount"
    },
    {
      "code": 6019,
      "name": "invalidStakePosition"
    },
    {
      "code": 6020,
      "name": "invalidVestingDuration"
    },
    {
      "code": 6021,
      "name": "invalidVestingStartTime"
    },
    {
      "code": 6022,
      "name": "unauthorizedMarket"
    },
    {
      "code": 6023,
      "name": "invalidMarketState"
    }
  ],
  "types": [
    {
      "name": "market",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "baseTokenMint",
            "type": "pubkey"
          },
          {
            "name": "quoteTokenMint",
            "type": "pubkey"
          },
          {
            "name": "baseReserve",
            "type": "u64"
          },
          {
            "name": "bidPrices",
            "type": {
              "array": [
                "u64",
                11
              ]
            }
          },
          {
            "name": "askPrices",
            "type": {
              "array": [
                "u64",
                11
              ]
            }
          },
          {
            "name": "widthScaled",
            "type": "u64"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "fees",
            "type": {
              "defined": {
                "name": "marketFees"
              }
            }
          },
          {
            "name": "quoteTokenDecimals",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "isPermissioned",
            "type": "u8"
          },
          {
            "name": "space",
            "type": {
              "array": [
                "u8",
                5
              ]
            }
          }
        ]
      }
    },
    {
      "name": "marketFees",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakingFeeShare",
            "docs": [
              "staking_fee_share + creator_fee_share + protocol_fee_share = 100%"
            ],
            "type": "u16"
          },
          {
            "name": "creatorFeeShare",
            "type": "u16"
          },
          {
            "name": "space",
            "type": "u32"
          },
          {
            "name": "pendingStakingFees",
            "type": "u64"
          },
          {
            "name": "pendingCreatorFees",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "marketStaking",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "amountStaked",
            "type": "u64"
          },
          {
            "name": "totalAmountVested",
            "type": "u64"
          },
          {
            "name": "accRewardAmountPerShare",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "quoteTokenBadge",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "quoteTokenBadgeStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "quoteTokenBadgeStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "disabled"
          },
          {
            "name": "enabled"
          }
        ]
      }
    },
    {
      "name": "referralAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "referrer",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "stakePosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amountStaked",
            "type": "u64"
          },
          {
            "name": "totalAmountVested",
            "type": "u64"
          },
          {
            "name": "pendingRewards",
            "type": "u64"
          },
          {
            "name": "accRewardAmountPerShare",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "swapAmountType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "exactInput"
          },
          {
            "name": "exactOutput"
          }
        ]
      }
    },
    {
      "name": "swapAuthorityBadge",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "swapType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "buy"
          },
          {
            "name": "sell"
          }
        ]
      }
    },
    {
      "name": "tokenMillConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "pendingAuthority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "protocolFeeRecipient",
            "type": "pubkey"
          },
          {
            "name": "defaultProtocolFeeShare",
            "type": "u16"
          },
          {
            "name": "referralFeeShare",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "tokenMillConfigCreationEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "defaultProtocolFeeShare",
            "type": "u16"
          },
          {
            "name": "referralFeeShare",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "tokenMillConfigOwnershipTransferEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenMillCreatorFeeClaimEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "feesDistributed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenMillCreatorUpdateEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "newCreator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenMillDefaultFeeSharesUpdateEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "newDefaultProtocolFeeShare",
            "type": "u16"
          },
          {
            "name": "newReferralFeeShare",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "tokenMillMarketCreationEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "baseTokenMint",
            "type": "pubkey"
          },
          {
            "name": "quoteTokenMint",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "protocolFeeShare",
            "type": "u16"
          },
          {
            "name": "referralFeeShare",
            "type": "u16"
          },
          {
            "name": "creatorFeeShare",
            "type": "u16"
          },
          {
            "name": "stakingFeeShare",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "tokenMillMarketFeeSharesUpdateEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "newCreatorFeeShare",
            "type": "u16"
          },
          {
            "name": "newStakingFeeShare",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "tokenMillMarketFreedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenMillMarketLockedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "swapAuthority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenMillMarketPriceSetEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "bidPrices",
            "type": {
              "array": [
                "u64",
                11
              ]
            }
          },
          {
            "name": "askPrices",
            "type": {
              "array": [
                "u64",
                11
              ]
            }
          }
        ]
      }
    },
    {
      "name": "tokenMillProtocolFeeRecipientUpdateEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "newProtocolFeeRecipient",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenMillQuoteTokenBadgeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "quoteTokenMint",
            "type": "pubkey"
          },
          {
            "name": "quoteAssetBadgeStatus",
            "type": {
              "defined": {
                "name": "quoteTokenBadgeStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "tokenMillReferralFeeClaimEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "referrer",
            "type": "pubkey"
          },
          {
            "name": "quoteTokenMint",
            "type": "pubkey"
          },
          {
            "name": "feesDistributed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenMillStakingDepositEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenMillStakingRewardsClaimEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amountDistributed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenMillStakingWithdrawalEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenMillSwapEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "swapType",
            "type": {
              "defined": {
                "name": "swapType"
              }
            }
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "quoteAmount",
            "type": "u64"
          },
          {
            "name": "referralTokenAccount",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "creatorFee",
            "type": "u64"
          },
          {
            "name": "stakingFee",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "referralFee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokenMillVestingPlanCreationEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "vestingPlan",
            "type": "pubkey"
          },
          {
            "name": "vestingAmount",
            "type": "u64"
          },
          {
            "name": "start",
            "type": "i64"
          },
          {
            "name": "vestingDuration",
            "type": "i64"
          },
          {
            "name": "cliffDuration",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "tokenMillVestingPlanReleaseEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vestingPlan",
            "type": "pubkey"
          },
          {
            "name": "amountReleased",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "vestingPlan",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakePosition",
            "type": "pubkey"
          },
          {
            "name": "amountVested",
            "type": "u64"
          },
          {
            "name": "amountReleased",
            "type": "u64"
          },
          {
            "name": "start",
            "type": "i64"
          },
          {
            "name": "cliffDuration",
            "type": "i64"
          },
          {
            "name": "vestingDuration",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
