import { AbstractUtxoCoin, getWalletKeys } from '@bitgo/abstract-utxo';
import {
  HalfSignedUtxoTransaction,
  IInscriptionBuilder,
  IWallet,
  KeyIndices,
  PrebuildTransactionResult,
  PreparedInscriptionRevealData,
  SubmitTransactionResponse,
  xprvToRawPrv,
  xpubToCompressedPub,
} from '@bitgo/sdk-core';
import * as utxolib from '@bitgo/utxo-lib';
import {
  createPsbtForSingleInscriptionPassingTransaction,
  DefaultInscriptionConstraints,
  InscriptionOutputs,
  inscriptions,
  parseSatPoint,
  isSatPoint,
  findOutputLayoutForWalletUnspents,
} from '@bitgo/utxo-ord';
import assert from 'assert';

export class InscriptionBuilder implements IInscriptionBuilder {
  private readonly wallet: IWallet;
  private readonly coin: AbstractUtxoCoin;

  constructor(wallet: IWallet, coin: AbstractUtxoCoin) {
    this.wallet = wallet;
    this.coin = coin;
  }

  async prepareReveal(inscriptionData: Buffer, contentType: string): Promise<PreparedInscriptionRevealData> {
    const user = await this.wallet.baseCoin.keychains().get({ id: this.wallet.keyIds()[KeyIndices.USER] });
    assert(user.pub);

    const derived = this.coin.deriveKeyWithSeed({ key: user.pub, seed: inscriptionData.toString() });
    const compressedPublicKey = xpubToCompressedPub(derived.key);
    const xOnlyPublicKey = utxolib.bitgo.outputScripts.toXOnlyPublicKey(Buffer.from(compressedPublicKey, 'hex'));

    return inscriptions.createInscriptionRevealData(xOnlyPublicKey, contentType, inscriptionData, this.coin.network);
  }

  /**
   * Build a transaction to send an inscription
   * @param satPoint Satpoint you want to send
   * @param recipient Address you want to send to
   * @param feeRateSatKB Fee rate for transaction
   * @param signer first signer of the transaction
   * @param cosigner second signer of the transaction
   * @param inscriptionConstraints.minChangeOutput (optional) the minimum size of the change output
   * @param inscriptionConstraints.minInscriptionOutput (optional) the minimum number of sats of the output containing the inscription
   * @param inscriptionConstraints.maxInscriptionOutput (optional) the maximum number of sats of the output containing the inscription
   * @param changeAddressType Address type of the change address
   */
  async prepareTransfer(
    satPoint: string,
    recipient: string,
    feeRateSatKB: number,
    {
      signer = 'user',
      cosigner = 'bitgo',
      inscriptionConstraints = DefaultInscriptionConstraints,
      changeAddressType = 'p2wsh',
    }: {
      signer?: utxolib.bitgo.KeyName;
      cosigner?: utxolib.bitgo.KeyName;
      inscriptionConstraints?: {
        minChangeOutput?: bigint;
        minInscriptionOutput?: bigint;
        maxInscriptionOutput?: bigint;
      };
      changeAddressType?: utxolib.bitgo.outputScripts.ScriptType2Of3;
    }
  ): Promise<PrebuildTransactionResult> {
    assert(isSatPoint(satPoint));

    const rootWalletKeys = await getWalletKeys(this.coin, this.wallet);
    const parsedSatPoint = parseSatPoint(satPoint);
    const transaction = await this.wallet.getTransaction({ txHash: parsedSatPoint.txid });
    // TODO(BG-70900): allow supplemental unspents
    const unspents = [transaction.outputs[parsedSatPoint.vout]];
    unspents[0].value = BigInt(unspents[0].value);
    const txInfo = { unspents };

    const changeAddress = await this.wallet.createAddress({
      chain: utxolib.bitgo.getInternalChainCode(changeAddressType),
    });
    const outputs: InscriptionOutputs = {
      inscriptionRecipient: recipient,
      changeOutputs: [
        { chain: changeAddress.chain, index: changeAddress.index },
        { chain: changeAddress.chain, index: changeAddress.index },
      ],
    };

    const psbt = createPsbtForSingleInscriptionPassingTransaction(
      this.coin.network,
      {
        walletKeys: rootWalletKeys,
        signer,
        cosigner,
      },
      unspents,
      satPoint,
      outputs,
      { feeRateSatKB, ...inscriptionConstraints }
    );
    const outputLayout = findOutputLayoutForWalletUnspents(unspents, satPoint, outputs, {
      feeRateSatKB,
      ...inscriptionConstraints,
    });
    if (!outputLayout) {
      throw new Error(`could not output layout for inscription passing transaction`);
    }

    return {
      walletId: this.wallet.id(),
      txHex: psbt.getUnsignedTx().toHex(),
      txInfo,
      feeInfo: { fee: Number(outputLayout.layout.feeOutput), feeString: outputLayout.layout.feeOutput.toString() },
    };
  }

  /**
   *
   * @param walletPassphrase
   * @param tapLeafScript
   * @param commitAddress
   * @param unsignedCommitTx
   * @param commitTransactionUnspents
   * @param recipientAddress
   * @param inscriptionData
   */
  async signAndSendReveal(
    walletPassphrase: string,
    tapLeafScript: utxolib.bitgo.TapLeafScript,
    commitAddress: string,
    unsignedCommitTx: Buffer,
    commitTransactionUnspents: utxolib.bitgo.WalletUnspent[],
    recipientAddress: string,
    inscriptionData: Buffer
  ): Promise<SubmitTransactionResponse> {
    const userKeychain = await this.wallet.baseCoin.keychains().get({ id: this.wallet.keyIds()[KeyIndices.USER] });
    const xprv = await this.wallet.getUserPrv({ keychain: userKeychain, walletPassphrase });

    const halfSignedCommitTransaction = (await this.wallet.signTransaction({
      prv: xprv,
      txPrebuild: {
        txHex: unsignedCommitTx.toString('hex'),
        txInfo: { unspents: commitTransactionUnspents },
      },
    })) as HalfSignedUtxoTransaction;

    const derived = this.coin.deriveKeyWithSeed({ key: xprv, seed: inscriptionData.toString() });
    const prv = xprvToRawPrv(derived.key);

    const fullySignedRevealTransaction = await inscriptions.signRevealTransaction(
      Buffer.from(prv, 'hex'),
      tapLeafScript,
      commitAddress,
      recipientAddress,
      Buffer.from(halfSignedCommitTransaction.txHex, 'hex'),
      this.coin.network
    );

    return this.wallet.submitTransaction({
      halfSigned: {
        txHex: halfSignedCommitTransaction.txHex,
        signedChildPsbt: fullySignedRevealTransaction.toHex(),
      },
    });
  }

  /**
   * Sign and send a transaction that transfers an inscription
   * @param walletPassphrase passphrase to unlock your keys
   * @param txPrebuild this is the output of `inscription.prepareTransfer`
   */
  async signAndSendTransfer(
    walletPassphrase: string,
    txPrebuild: PrebuildTransactionResult
  ): Promise<SubmitTransactionResponse> {
    const userKeychain = await this.wallet.baseCoin.keychains().get({ id: this.wallet.keyIds()[KeyIndices.USER] });
    const prv = this.wallet.getUserPrv({ keychain: userKeychain, walletPassphrase });

    const halfSigned = (await this.wallet.signTransaction({ prv, txPrebuild })) as HalfSignedUtxoTransaction;
    return this.wallet.submitTransaction({ halfSigned });
  }
}
