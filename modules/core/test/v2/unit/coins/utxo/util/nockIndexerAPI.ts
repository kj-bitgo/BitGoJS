/**
 * @prettier
 */
import * as nock from 'nock';
import * as utxolib from '@bitgo/utxo-lib';

import { AbstractUtxoCoin } from '../../../../../../src/v2/coins';
import { PublicUnspent, Unspent } from '../../../../../../src/v2/coins/utxo/unspent';
import { ExplorerTxInfo } from '../../../../../../src/v2/coins/utxo/recovery/crossChainRecovery';

import { nockBitGo } from './nockBitGo';

export function nockBitGoPublicTransaction(
  coin: AbstractUtxoCoin,
  tx: utxolib.bitgo.UtxoTransaction,
  unspents: Unspent[]
): nock.Scope {
  const payload: ExplorerTxInfo = {
    input: unspents.map((u) => ({ address: u.address })),
    outputs: tx.outs.map((o) => ({ address: utxolib.address.fromOutputScript(o.script, coin.network) })),
  };
  return nockBitGo().get(`/api/v2/${coin.getChain()}/public/tx/${tx.getId()}`).reply(200, payload);
}

export function nockBitGoPublicAddressUnspents(
  coin: AbstractUtxoCoin,
  txid: string,
  address: string,
  outputs: utxolib.TxOutput[]
): nock.Scope {
  const payload: PublicUnspent[] = outputs.map(
    (o, vout: number): PublicUnspent => ({
      id: `${txid}:${vout}`,
      address: utxolib.address.fromOutputScript(o.script, coin.network),
      value: o.value,
      valueString: String(o.value),
      blockHeight: 1001,
    })
  );
  return nockBitGo().get(`/api/v2/${coin.getChain()}/public/addressUnspents/${address}`).reply(200, payload);
}
