/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/dreadtide.json`.
 */
export type Dreadtide = {
  "address": "BNFQudgxvwLNZNhj1aSTVXqzXpBn68jifArJ5xRCGUE4",
  "metadata": {
    "name": "dreadtide",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "acceptStake",
      "discriminator": [
        170,
        19,
        179,
        19,
        105,
        58,
        250,
        255
      ],
      "accounts": [
        {
          "name": "game"
        },
        {
          "name": "stake",
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
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "opponentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "opponent"
              }
            ]
          }
        },
        {
          "name": "opponent",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "auditBoard",
      "discriminator": [
        114,
        140,
        84,
        249,
        110,
        188,
        244,
        120
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "placements",
          "type": {
            "array": [
              {
                "defined": {
                  "name": "shipPlacement"
                }
              },
              4
            ]
          }
        }
      ]
    },
    {
      "name": "buyCoins",
      "discriminator": [
        210,
        116,
        3,
        207,
        17,
        87,
        42,
        11
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "coins",
          "type": "u64"
        }
      ]
    },
    {
      "name": "cancelGame",
      "discriminator": [
        121,
        194,
        154,
        118,
        103,
        235,
        149,
        52
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimDaily",
      "discriminator": [
        13,
        226,
        153,
        154,
        27,
        168,
        111,
        103
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimTimeout",
      "discriminator": [
        130,
        234,
        45,
        53,
        120,
        90,
        86,
        178
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "caller",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "commitBoard",
      "discriminator": [
        55,
        182,
        0,
        25,
        85,
        224,
        122,
        247
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "root",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createGame",
      "discriminator": [
        124,
        69,
        75,
        66,
        184,
        220,
        72,
        206
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "gameId"
              }
            ]
          }
        },
        {
          "name": "creator",
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
          "name": "gameId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createProfile",
      "discriminator": [
        225,
        205,
        234,
        143,
        17,
        186,
        50,
        220
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "player",
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
      "name": "fire",
      "discriminator": [
        42,
        28,
        236,
        248,
        254,
        215,
        141,
        181
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        }
      ]
    },
    {
      "name": "joinGame",
      "discriminator": [
        107,
        112,
        18,
        38,
        56,
        173,
        60,
        128
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "opponent",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "openStake",
      "discriminator": [
        136,
        215,
        163,
        130,
        234,
        194,
        229,
        229
      ],
      "accounts": [
        {
          "name": "game"
        },
        {
          "name": "stake",
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
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "creatorProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "creator",
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
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "respond",
      "discriminator": [
        72,
        65,
        227,
        97,
        42,
        255,
        147,
        12
      ],
      "accounts": [
        {
          "name": "game",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  97,
                  109,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              },
              {
                "kind": "account",
                "path": "game.gameId",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "player",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "isShip",
          "type": "bool"
        },
        {
          "name": "cellSalt",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "siblings",
          "type": {
            "array": [
              {
                "array": [
                  "u8",
                  32
                ]
              },
              6
            ]
          }
        }
      ]
    },
    {
      "name": "settleStake",
      "discriminator": [
        89,
        179,
        109,
        99,
        144,
        236,
        213,
        76
      ],
      "accounts": [
        {
          "name": "game"
        },
        {
          "name": "stake",
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
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game"
              }
            ]
          }
        },
        {
          "name": "creatorProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.creator",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "opponentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "game.opponent",
                "account": "game"
              }
            ]
          }
        },
        {
          "name": "caller",
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "game",
      "discriminator": [
        27,
        90,
        166,
        125,
        74,
        100,
        121,
        18
      ]
    },
    {
      "name": "matchStake",
      "discriminator": [
        135,
        81,
        108,
        247,
        164,
        23,
        131,
        40
      ]
    },
    {
      "name": "playerProfile",
      "discriminator": [
        82,
        226,
        99,
        87,
        164,
        130,
        181,
        80
      ]
    }
  ],
  "events": [
    {
      "name": "auditAccepted",
      "discriminator": [
        177,
        84,
        143,
        2,
        214,
        173,
        209,
        225
      ]
    },
    {
      "name": "auditRejected",
      "discriminator": [
        224,
        140,
        96,
        199,
        139,
        146,
        210,
        98
      ]
    },
    {
      "name": "dCoinsPurchased",
      "discriminator": [
        33,
        238,
        140,
        98,
        40,
        172,
        152,
        119
      ]
    },
    {
      "name": "dailyCoinsClaimed",
      "discriminator": [
        53,
        151,
        43,
        13,
        237,
        9,
        15,
        18
      ]
    },
    {
      "name": "shotVerified",
      "discriminator": [
        59,
        21,
        98,
        237,
        83,
        149,
        248,
        27
      ]
    },
    {
      "name": "stakeSettled",
      "discriminator": [
        171,
        53,
        105,
        171,
        142,
        65,
        236,
        232
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "wrongPhase",
      "msg": "Wrong game phase"
    },
    {
      "code": 6001,
      "name": "deadlinePassed",
      "msg": "Action deadline has passed"
    },
    {
      "code": 6002,
      "name": "deadlineNotPassed",
      "msg": "Action deadline has not passed"
    },
    {
      "code": 6003,
      "name": "notPlayer",
      "msg": "Signer is not a player"
    },
    {
      "code": 6004,
      "name": "wrongPlayer",
      "msg": "Wrong player for this action"
    },
    {
      "code": 6005,
      "name": "selfJoin",
      "msg": "Creator cannot join their own game"
    },
    {
      "code": 6006,
      "name": "alreadyCommitted",
      "msg": "Board already committed"
    },
    {
      "code": 6007,
      "name": "invalidCell",
      "msg": "Cell is outside the grid"
    },
    {
      "code": 6008,
      "name": "duplicateShot",
      "msg": "Cell has already been fired upon"
    },
    {
      "code": 6009,
      "name": "invalidProof",
      "msg": "Merkle proof does not match defender root"
    },
    {
      "code": 6010,
      "name": "noEligibleClaimant",
      "msg": "No committed player can claim this timeout"
    },
    {
      "code": 6011,
      "name": "clockOverflow",
      "msg": "Clock arithmetic overflow"
    },
    {
      "code": 6012,
      "name": "arithmeticOverflow",
      "msg": "D-Coin arithmetic overflow"
    },
    {
      "code": 6013,
      "name": "dailyAlreadyClaimed",
      "msg": "Daily D-Coins have already been claimed today"
    },
    {
      "code": 6014,
      "name": "stakeBelowMinimum",
      "msg": "Stake must be at least 50 D-Coins"
    },
    {
      "code": 6015,
      "name": "insufficientDCoins",
      "msg": "D-Coin balance is too low"
    },
    {
      "code": 6016,
      "name": "stakeAlreadyDeposited",
      "msg": "Stake has already been deposited"
    },
    {
      "code": 6017,
      "name": "stakeNotReady",
      "msg": "Both players must escrow before settlement"
    },
    {
      "code": 6018,
      "name": "stakeAlreadySettled",
      "msg": "Stake has already been settled"
    },
    {
      "code": 6019,
      "name": "matchNotFinished",
      "msg": "Match is not ready for stake settlement"
    }
  ],
  "types": [
    {
      "name": "auditAccepted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "auditRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "claimant",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "dCoinsPurchased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "coins",
            "type": "u64"
          },
          {
            "name": "lamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "dailyCoinsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "coins",
            "type": "u64"
          },
          {
            "name": "day",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "game",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "opponent",
            "type": "pubkey"
          },
          {
            "name": "gameId",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "phase"
              }
            }
          },
          {
            "name": "roots",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                2
              ]
            }
          },
          {
            "name": "committed",
            "type": {
              "array": [
                "bool",
                2
              ]
            }
          },
          {
            "name": "turn",
            "type": "u8"
          },
          {
            "name": "pendingIndex",
            "type": "u8"
          },
          {
            "name": "pendingAttacker",
            "type": "u8"
          },
          {
            "name": "shots",
            "type": {
              "array": [
                "u64",
                2
              ]
            }
          },
          {
            "name": "hits",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "claimant",
            "type": "u8"
          },
          {
            "name": "auditAttempts",
            "type": "u8"
          },
          {
            "name": "auditedWinner",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "matchStake",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "amountPerPlayer",
            "type": "u64"
          },
          {
            "name": "creatorDeposited",
            "type": "bool"
          },
          {
            "name": "opponentDeposited",
            "type": "bool"
          },
          {
            "name": "settled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "phase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "lobby"
          },
          {
            "name": "commit"
          },
          {
            "name": "fire"
          },
          {
            "name": "respond"
          },
          {
            "name": "audit"
          },
          {
            "name": "verifiedFinished"
          },
          {
            "name": "noVerifiedWinner"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "playerProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "lastClaimDay",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "shipPlacement",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "x",
            "type": "u8"
          },
          {
            "name": "y",
            "type": "u8"
          },
          {
            "name": "vertical",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "shotVerified",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "defender",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "isShip",
            "type": "bool"
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "stakeSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "game",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "pot",
            "type": "u64"
          },
          {
            "name": "refunded",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
