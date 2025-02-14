import { RequestAddStake, RequestWithdrawStakedSui } from '../../src/lib/iface';
import { DUMMY_SUI_GAS_PRICE } from '../../src/lib/constants';
import { Recipient } from '@bitgo/sdk-core';

export const AMOUNT = 100;

export const privateKeys = {
  prvKey1: '43e8594854cb53947c4a1a2fab926af11e123f6251dcd5bd0dfb100604186430',
  prvKey2: 'c0c3b9dc09932121ee351b2448c50a3ae2571b12951245c85f3bd95d5e7a06f8',
  prvKey3: '3d6822bf14115f47a5724b68c85160221eacbe664e892a4a9dd3b4dd64016ece',
  prvKey4: 'ba4c313bcf830b825adaa3ae08cfde86e79e15a84e6fdc3b1fe35a6bb82d9f22',
  prvKey5: 'fdb9ea1bb7f0120ce6eb7b047ac6744c4298f277756330e18dbd5419590a1ef2',
};

export const addresses = {
  validAddresses: [
    '0xf941ae3cbe5645dccc15da8346b533f7f91f202089a5521653c062b2ff10b304',
    '0x77c3b5b21129793c4a5602220a4b970007c54d4a996de941e5b713719a42f8fe',
  ],
  invalidAddresses: [
    'randomString',
    '0xc4173a804406a365e69dfb297ddfgsdcvf',
    '5ne7phA48Jrvpn39AtupB8ZkCCAy8gLTfpGihZPuDqen',
  ],
};

export const sender = {
  address: '0x9882188ba3e8070a9bb06ae9446cf607914ee8ee58ed8306a3e3afff5a1bbb71',
  publicKey: 'AQIDBAUGBwgJAAECAwQFBgcICQABFwQFBk4BAgMEBQY=',
  signatureHex:
    'AETvicGY1HwWjQokRg2HgbQeu+QQZP4ejZQGjmfWvPUd2WkzBudVlaSzjiS1btS2/34Laf6rfkNKYD540crafAxzTVAmV/9J1skZyoX4AWkJM/R4Y1FfV36atFLbCwUVqQ==',
};

export const recipients: Recipient[] = [
  {
    address: addresses.validAddresses[0],
    amount: AMOUNT.toString(),
  },
  {
    address: addresses.validAddresses[1],
    amount: AMOUNT.toString(),
  },
];

export const coinsGasPayment = [
  {
    objectId: '0x09c40522aed54bcecfa483605c5da5821b171ac1aa1b615971fb8dfe27ed13fd',
    version: 1105,
    digest: 'DGVhYjk6YHwdPdZBgBN8czavy8LvbrshkbxF963EW7mB',
  },
  {
    objectId: '0x27dd00e7fccdc87b4d95b6384b739119b91f2a81a16baedea7f4e0068e529437',
    version: 217,
    digest: 'DoJwXuz9oU5Y5v5vBRiTgisVTQuZQLmHZWeqJzzD5QUE',
  },
];

export const coinsWithoutGasPayment = [
  {
    objectId: '0x57bedec931e87beebebd5a375fae5e969965dba710e3c8652814ab1750b9e301',
    version: 32,
    digest: '82LZWnJwxRpZPLyFvPdLWBTyEu9J5aEZQFrTva9QPLzJ',
  },
  {
    objectId: '0xa90fdca6a9b7e8363d5825fb41c0456fc85ab3f47ddf5bbc19f320c82acbc62a',
    version: 32,
    digest: 'EFcXPoBtcHKZK3NhBHULZASAu61aZb5ab9JCXKEb5eMC',
  },
];

export const txInputs = [
  {
    kind: 'Input',
    value: 100,
    index: 0,
    type: 'pure',
  },
  {
    kind: 'Input',
    value: '0xf941ae3cbe5645dccc15da8346b533f7f91f202089a5521653c062b2ff10b304',
    index: 1,
    type: 'object',
  },
  {
    kind: 'Input',
    value: 100,
    index: 2,
    type: 'pure',
  },
  {
    kind: 'Input',
    value: '0x77c3b5b21129793c4a5602220a4b970007c54d4a996de941e5b713719a42f8fe',
    index: 3,
    type: 'object',
  },
];
export const txTransactions = [
  {
    kind: 'SplitCoins',
    coin: {
      kind: 'GasCoin',
    },
    amounts: [
      {
        kind: 'Input',
        value: 100,
        index: 0,
        type: 'pure',
      },
    ],
  },
  {
    kind: 'TransferObjects',
    objects: [
      {
        kind: 'Result',
        index: 0,
      },
    ],
    address: {
      kind: 'Input',
      value: '0xf941ae3cbe5645dccc15da8346b533f7f91f202089a5521653c062b2ff10b304',
      index: 1,
      type: 'object',
    },
  },
  {
    kind: 'SplitCoins',
    coin: {
      kind: 'GasCoin',
    },
    amounts: [
      {
        kind: 'Input',
        value: 100,
        index: 2,
        type: 'pure',
      },
    ],
  },
  {
    kind: 'TransferObjects',
    objects: [
      {
        kind: 'Result',
        index: 2,
      },
    ],
    address: {
      kind: 'Input',
      value: '0x77c3b5b21129793c4a5602220a4b970007c54d4a996de941e5b713719a42f8fe',
      index: 3,
      type: 'object',
    },
  },
];

export const txInputsAddStake = [
  {
    kind: 'Input',
    value: '20000000',
    index: 0,
    type: 'pure',
  },
  {
    kind: 'Input',
    value: {
      Object: {
        Shared: {
          objectId: '0x0000000000000000000000000000000000000000000000000000000000000005',
          initialSharedVersion: 1,
          mutable: true,
        },
      },
    },
    index: 1,
    type: 'object',
  },
  {
    kind: 'Input',
    value: {
      Pure: [
        68, 177, 179, 25, 226, 52, 149, 153, 95, 200, 55, 218, 253, 40, 252, 106, 248, 182, 69, 237, 221, 255, 15, 193,
        70, 127, 26, 214, 49, 54, 44, 35,
      ],
    },
    index: 2,
    type: 'pure',
  },
];
export const txTransactionsAddStake = [
  {
    kind: 'SplitCoins',
    coin: {
      kind: 'GasCoin',
    },
    amounts: [
      {
        kind: 'Input',
        value: '20000000',
        index: 0,
        type: 'pure',
      },
    ],
  },
  {
    kind: 'MoveCall',
    target: '0x3::sui_system::request_add_stake',
    arguments: [
      {
        kind: 'Input',
        value: {
          Object: {
            Shared: {
              objectId: '0x0000000000000000000000000000000000000000000000000000000000000005',
              initialSharedVersion: 1,
              mutable: true,
            },
          },
        },
        index: 1,
        type: 'object',
      },
      {
        kind: 'Result',
        index: 0,
      },
      {
        kind: 'Input',
        value: {
          Pure: [
            68, 177, 179, 25, 226, 52, 149, 153, 95, 200, 55, 218, 253, 40, 252, 106, 248, 182, 69, 237, 221, 255, 15,
            193, 70, 127, 26, 214, 49, 54, 44, 35,
          ],
        },
        index: 2,
        type: 'pure',
      },
    ],
    typeArguments: [],
  },
];

export const txInputWithdrawStaked = [
  {
    kind: 'Input',
    value: {
      Object: {
        Shared: {
          objectId: '0x0000000000000000000000000000000000000000000000000000000000000005',
          initialSharedVersion: 1,
          mutable: true,
        },
      },
    },
    index: 0,
    type: 'object',
  },
  {
    kind: 'Input',
    value: {
      Object: {
        ImmOrOwned: {
          objectId: 'ee6dfc3da32e21541a2aeadfcd250f8a0a23bb7abda9c8988407fc32068c3746',
          version: '1121',
          digest: 'EZ5yqap5XJJy9KhnW3dsbE73UmC5bd1KBEx7eQ5k4HNT',
        },
      },
    },
    index: 1,
    type: 'pure',
  },
];
export const txTransactionsWithdrawStaked = [
  {
    kind: 'MoveCall',
    target: '0x3::sui_system::request_withdraw_stake',
    arguments: [
      {
        kind: 'Input',
        value: {
          Object: {
            Shared: {
              objectId: '0x0000000000000000000000000000000000000000000000000000000000000005',
              initialSharedVersion: 1,
              mutable: true,
            },
          },
        },
        index: 0,
        type: 'object',
      },
      {
        kind: 'Input',
        value: {
          Object: {
            ImmOrOwned: {
              objectId: 'ee6dfc3da32e21541a2aeadfcd250f8a0a23bb7abda9c8988407fc32068c3746',
              version: '1121',
              digest: 'EZ5yqap5XJJy9KhnW3dsbE73UmC5bd1KBEx7eQ5k4HNT',
            },
          },
        },
        index: 1,
        type: 'pure',
      },
    ],
    typeArguments: [],
  },
];

export const GAS_BUDGET = 20000000;

export const gasData = {
  payment: coinsGasPayment,
  owner: sender.address,
  price: DUMMY_SUI_GAS_PRICE,
  budget: GAS_BUDGET,
};

export const gasDataWithoutGasPayment = {
  owner: sender.address,
  price: DUMMY_SUI_GAS_PRICE,
  budget: GAS_BUDGET,
};

export const invalidGasOwner = {
  payment: coinsGasPayment,
  owner: addresses.invalidAddresses[0],
  price: DUMMY_SUI_GAS_PRICE,
  budget: GAS_BUDGET,
};

export const invalidGasBudget = {
  payment: coinsGasPayment,
  owner: sender.address,
  price: DUMMY_SUI_GAS_PRICE,
  budget: -1,
};

export const payTxWithGasPayment = {
  coins: coinsGasPayment,
  recipients,
  amounts: [AMOUNT],
};

export const payTxWithoutGasPayment = {
  coins: coinsWithoutGasPayment,
  recipients,
  amounts: [AMOUNT],
};

export const txIds = {
  id1: 'rAraxzR2QeTU/bULpEUWjv+oCY/8YnHS9Oc/IhkoaCM=',
};

export const TRANSFER =
  'AAAEAAhkAAAAAAAAAAAg+UGuPL5WRdzMFdqDRrUz9/kfICCJpVIWU8Bisv8QswQACGQAAAAAAAAAACB3w7WyESl5PEpWAiIKS5cAB8VNSplt6UHltxNxmkL4/gQCAAEBAAABAQIAAAEBAAIAAQECAAEBAgIAAQMAmIIYi6PoBwqbsGrpRGz2B5FO6O5Y7YMGo+Ov/1obu3ECCcQFIq7VS87PpINgXF2lghsXGsGqG2FZcfuN/iftE/1RBAAAAAAAACC2RGfJXC7cVwfXSDKdKwQB/rPC0/3tdlzDSomluG57sifdAOf8zch7TZW2OEtzkRm5HyqBoWuu3qf04AaOUpQ32QAAAAAAAAAgvik+0ypZjmC8kkbE4BtuQpN/FomQiDpqIFB6wsFNJyeYghiLo+gHCpuwaulEbPYHkU7o7ljtgwaj46//Whu7cegDAAAAAAAAAC0xAQAAAAAA';
export const INVALID_RAW_TX =
  'AAAAAAAAAAAAA6e7361637469bc4a58e500b9e64cb6547ee9b403000000000000002064ba1fb2f2fbd2938a350015d601f4db89cd7e8e2370d0dd9ae3ac4f635c1581111b8a49f67370bc4a58e500b9e64cb6462e39b802000000000000002064ba1fb2f2fbd2938a350015d601f4db89cd7e8e2370d0dd9ae3ac47aa1ff81f01c4173a804406a365e69dfb297d4eaaf002546ebd016400000000000000cba4a48bb0f8b586c167e5dcefaa1c5e96ab3f0836d6ca08f2081732944d1e5b6b406a4a462e39b8030000000000000020b9490ede63215262c434e03f606d9799f3ba704523ceda184b386d47aa1ff81f01000000000000006400000000000000';
export const ADD_STAKE =
  'AAADAAgALTEBAAAAAAEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUBAAAAAAAAAAEAIESxsxniNJWZX8g32v0o/Gr4tkXt3f8PwUZ/GtYxNiwjAgIAAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwpzdWlfc3lzdGVtEXJlcXVlc3RfYWRkX3N0YWtlAAMBAQACAAABAgCYghiLo+gHCpuwaulEbPYHkU7o7ljtgwaj46//Whu7cQIJxAUirtVLzs+kg2BcXaWCGxcawaobYVlx+43+J+0T/VEEAAAAAAAAILZEZ8lcLtxXB9dIMp0rBAH+s8LT/e12XMNKiaW4bnuyJ90A5/zNyHtNlbY4S3ORGbkfKoGha67ep/TgBo5SlDfZAAAAAAAAACC+KT7TKlmOYLySRsTgG25Ck38WiZCIOmogUHrCwU0nJ5iCGIuj6AcKm7Bq6URs9geRTujuWO2DBqPjr/9aG7tx6AMAAAAAAAAALTEBAAAAAAA=';
export const WITHDRAW_STAKED_SUI =
  'AAACAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQEAAAAAAAAAAQEA7m38PaMuIVQaKurfzSUPigoju3q9qciYhAf8MgaMN0ZhBAAAAAAAACDJYCWUFis6HawzxGyErvRT03pYayRliLki0kYsV0XCBAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMKc3VpX3N5c3RlbRZyZXF1ZXN0X3dpdGhkcmF3X3N0YWtlAAIBAAABAQCYghiLo+gHCpuwaulEbPYHkU7o7ljtgwaj46//Whu7cQIJxAUirtVLzs+kg2BcXaWCGxcawaobYVlx+43+J+0T/VEEAAAAAAAAILZEZ8lcLtxXB9dIMp0rBAH+s8LT/e12XMNKiaW4bnuyJ90A5/zNyHtNlbY4S3ORGbkfKoGha67ep/TgBo5SlDfZAAAAAAAAACC+KT7TKlmOYLySRsTgG25Ck38WiZCIOmogUHrCwU0nJ5iCGIuj6AcKm7Bq6URs9geRTujuWO2DBqPjr/9aG7tx6AMAAAAAAAAALTEBAAAAAAA=';

export const invalidRecipients: Recipient[] = [
  {
    address: addresses.invalidAddresses[0],
    amount: AMOUNT.toString(),
  },
  {
    address: addresses.validAddresses[0],
    amount: 'NAN',
  },
];

export const STAKING_AMOUNT = 20000000;

export const VALIDATOR_ADDRESS = '0x44b1b319e23495995fc837dafd28fc6af8b645edddff0fc1467f1ad631362c23';

export const requestAddStake: RequestAddStake = {
  amount: STAKING_AMOUNT,
  validatorAddress: VALIDATOR_ADDRESS,
};

export const requestWithdrawStakedSui: RequestWithdrawStakedSui = {
  stakedSui: {
    objectId: '0xee6dfc3da32e21541a2aeadfcd250f8a0a23bb7abda9c8988407fc32068c3746',
    version: 1121,
    digest: 'EZ5yqap5XJJy9KhnW3dsbE73UmC5bd1KBEx7eQ5k4HNT',
  },
};
