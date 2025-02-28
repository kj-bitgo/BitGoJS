/**
 * @prettier
 */
import * as utxolib from '@bitgo/utxo-lib';
import { bip32, BIP32Interface, bitgo } from '@bitgo/utxo-lib';
import * as assert from 'assert';
import * as bitcoinMessage from 'bitcoinjs-message';
import { randomBytes } from 'crypto';
import * as debugLib from 'debug';
import * as _ from 'lodash';
import BigNumber from 'bignumber.js';

import { backupKeyRecovery, RecoverParams } from './recovery/backupKeyRecovery';
import {
  CrossChainRecoverySigned,
  CrossChainRecoveryUnsigned,
  forCoin,
  recoverCrossChain,
  RecoveryProvider,
} from './recovery';

import {
  AddressCoinSpecific,
  AddressTypeChainMismatchError,
  BaseCoin,
  BitGoBase,
  ExtraPrebuildParamsOptions,
  HalfSignedUtxoTransaction,
  IBaseCoin,
  InvalidAddressDerivationPropertyError,
  InvalidAddressError,
  InvalidAddressVerificationObjectPropertyError,
  IRequestTracer,
  ITransactionExplanation as BaseTransactionExplanation,
  IWallet,
  Keychain,
  KeychainsTriplet,
  KeyIndices,
  P2shP2wshUnsupportedError,
  P2trMusig2UnsupportedError,
  P2trUnsupportedError,
  P2wshUnsupportedError,
  ParsedTransaction as BaseParsedTransaction,
  ParseTransactionOptions as BaseParseTransactionOptions,
  PrecreateBitGoOptions,
  PresignTransactionOptions,
  promiseProps,
  RequestTracer,
  sanitizeLegacyPath,
  SignedTransaction,
  SignTransactionOptions as BaseSignTransactionOptions,
  SupplementGenerateWalletOptions,
  TransactionParams as BaseTransactionParams,
  TransactionPrebuild as BaseTransactionPrebuild,
  TransactionRecipient,
  Triple,
  UnexpectedAddressError,
  UnsupportedAddressTypeError,
  VerificationOptions,
  VerifyAddressOptions as BaseVerifyAddressOptions,
  VerifyTransactionOptions as BaseVerifyTransactionOptions,
  Wallet,
  WalletData,
} from '@bitgo/sdk-core';
import { CustomChangeOptions, parseOutput } from './parseOutput';

const debug = debugLib('bitgo:v2:utxo');

import ScriptType2Of3 = utxolib.bitgo.outputScripts.ScriptType2Of3;
import { isReplayProtectionUnspent } from './replayProtection';
import { signAndVerifyWalletTransaction } from './sign';
import { supportedCrossChainRecoveries } from './config';

const { getExternalChainCode, isChainCode, scriptTypeForChain, outputScripts, toOutput, verifySignatureWithUnspent } =
  bitgo;
type Unspent<TNumber extends number | bigint = number> = bitgo.Unspent<TNumber>;

type RootWalletKeys = bitgo.RootWalletKeys;
export interface VerifyAddressOptions extends BaseVerifyAddressOptions {
  chain: number;
  index: number;
}

export interface Output {
  address: string;
  amount: string | number;
  external?: boolean;
  needsCustomChangeKeySignatureVerification?: boolean;
}

export interface TransactionExplanation extends BaseTransactionExplanation<string, string> {
  locktime: number;
  outputs: Output[];
  changeOutputs: Output[];

  /**
   * Number of input signatures per input.
   */
  inputSignatures: number[];

  /**
   * Highest input signature count for the transaction
   */
  signatures: number;
}

export interface TransactionInfo<TNumber extends number | bigint = number> {
  /** Maps txid to txhex. Required for offline signing. */
  txHexes?: Record<string, string>;
  changeAddresses?: string[];
  unspents: Unspent<TNumber>[];
}

export interface ExplainTransactionOptions<TNumber extends number | bigint = number> {
  txHex: string;
  txInfo?: TransactionInfo<TNumber>;
  feeInfo?: string;
  pubs?: Triple<string>;
}

export type UtxoNetwork = utxolib.Network;

export interface TransactionPrebuild<TNumber extends number | bigint = number> extends BaseTransactionPrebuild {
  txInfo?: TransactionInfo<TNumber>;
  blockHeight?: number;
}

export interface TransactionParams extends BaseTransactionParams {
  walletPassphrase?: string;
  changeAddress?: string;
}

// parseTransactions' return type makes use of WalletData's type but with customChangeKeySignatures as required.
export interface AbstractUtxoCoinWalletData extends WalletData {
  customChangeKeySignatures: {
    user: string;
    backup: string;
    bitgo: string;
  };
}

export class AbstractUtxoCoinWallet extends Wallet {
  public _wallet: AbstractUtxoCoinWalletData;

  constructor(bitgo: BitGoBase, baseCoin: IBaseCoin, walletData: any) {
    super(bitgo, baseCoin, walletData);
  }
}

export interface ParseTransactionOptions<TNumber extends number | bigint = number> extends BaseParseTransactionOptions {
  txParams: TransactionParams;
  txPrebuild: TransactionPrebuild<TNumber>;
  wallet: AbstractUtxoCoinWallet;
  verification?: VerificationOptions;
  reqId?: IRequestTracer;
}

export interface ParsedTransaction<TNumber extends number | bigint = number> extends BaseParsedTransaction {
  keychains: {
    user?: Keychain;
    backup?: Keychain;
    bitgo?: Keychain;
  };
  keySignatures: {
    backupPub?: string;
    bitgoPub?: string;
  };
  outputs: Output[];
  missingOutputs: Output[];
  explicitExternalOutputs: Output[];
  implicitExternalOutputs: Output[];
  changeOutputs: Output[];
  explicitExternalSpendAmount: TNumber;
  implicitExternalSpendAmount: TNumber;
  needsCustomChangeKeySignatureVerification: boolean;
  customChange?: CustomChangeOptions;
}

export interface GenerateAddressOptions {
  addressType?: ScriptType2Of3;
  keychains: {
    pub: string;
    aspKeyId?: string;
  }[];
  threshold?: number;
  chain?: number;
  index?: number;
  segwit?: boolean;
  bech32?: boolean;
}

export interface AddressDetails {
  address: string;
  chain: number;
  index: number;
  coin: string;
  coinSpecific: AddressCoinSpecific;
  addressType?: string;
}

export interface SignTransactionOptions<TNumber extends number | bigint = number> extends BaseSignTransactionOptions {
  /** Transaction prebuild from bitgo server */
  txPrebuild: {
    txHex: string;
    txInfo: TransactionInfo<TNumber>;
  };
  /** xprv of user key or backup key */
  prv: string;
  /** xpubs triple for wallet (user, backup, bitgo) */
  pubs: Triple<string>;
  /** xpub for cosigner (defaults to bitgo) */
  cosignerPub?: string;
  /**
   * When true, creates full-signed transaction without placeholder signatures.
   * When false, creates half-signed transaction with placeholder signatures.
   */
  isLastSignature?: boolean;
}

export interface MultiSigAddress {
  outputScript: Buffer;
  redeemScript?: Buffer;
  witnessScript?: Buffer;
  address: string;
}

export interface RecoverFromWrongChainOptions {
  txid: string;
  recoveryAddress: string;
  wallet: string;
  walletPassphrase?: string;
  xprv?: string;
  apiKey?: string;
  /** @deprecated */
  coin?: AbstractUtxoCoin;
  recoveryCoin?: AbstractUtxoCoin;
  signed?: boolean;
}

export interface VerifyKeySignaturesOptions {
  userKeychain?: Keychain;
  keychainToVerify?: Keychain;
  keySignature?: string;
}

export interface VerifyUserPublicKeyOptions {
  userKeychain?: Keychain;
  disableNetworking: boolean;
  txParams: TransactionParams;
}

export interface VerifyTransactionOptions<TNumber extends number | bigint = number>
  extends BaseVerifyTransactionOptions {
  txPrebuild: TransactionPrebuild<TNumber>;
  wallet: AbstractUtxoCoinWallet;
}

export abstract class AbstractUtxoCoin extends BaseCoin {
  public altScriptHash?: number;
  public supportAltScriptDestination?: boolean;
  public readonly amountType: 'number' | 'bigint';
  private readonly _network: utxolib.Network;

  protected constructor(bitgo: BitGoBase, network: utxolib.Network, amountType: 'number' | 'bigint' = 'number') {
    super(bitgo);
    if (!utxolib.isValidNetwork(network)) {
      throw new Error(
        'invalid network: please make sure to use the same version of ' +
          '@bitgo/utxo-lib as this library when initializing an instance of this class'
      );
    }
    this.amountType = amountType;
    this._network = network;
  }

  get network() {
    return this._network;
  }

  sweepWithSendMany(): boolean {
    return true;
  }

  /** @deprecated */
  static get validAddressTypes(): ScriptType2Of3[] {
    return [...outputScripts.scriptTypes2Of3];
  }

  /**
   * Returns the factor between the base unit and its smallest subdivison
   * @return {number}
   */
  getBaseFactor() {
    return 1e8;
  }

  /**
   * @deprecated
   */
  getCoinLibrary() {
    return utxolib;
  }

  /**
   * Check if an address is valid
   * @param address
   * @param param
   */
  isValidAddress(address: string, param?: { anyFormat: boolean } | /* legacy parameter */ boolean): boolean {
    if (typeof param === 'boolean' && param) {
      throw new Error('deprecated');
    }

    const formats = param && param.anyFormat ? undefined : ['default' as const];
    try {
      utxolib.addressFormat.toOutputScriptTryFormats(address, this.network, formats);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Return boolean indicating whether input is valid public key for the coin.
   *
   * @param {String} pub the pub to be checked
   * @returns {Boolean} is it valid?
   */
  isValidPub(pub: string) {
    try {
      return bip32.fromBase58(pub).isNeutered();
    } catch (e) {
      return false;
    }
  }

  /**
   * Get the latest block height
   * @param reqId
   */
  async getLatestBlockHeight(reqId?: RequestTracer): Promise<number> {
    if (reqId) {
      this.bitgo.setRequestTracer(reqId);
    }
    const chainhead = await this.bitgo.get(this.url('/public/block/latest')).result();
    return (chainhead as any).height;
  }

  /**
   * Run custom coin logic after a transaction prebuild has been received from BitGo
   * @param prebuild
   */
  async postProcessPrebuild<TNumber extends number | bigint>(
    prebuild: TransactionPrebuild<TNumber>
  ): Promise<TransactionPrebuild<TNumber>> {
    if (_.isUndefined(prebuild.txHex)) {
      throw new Error('missing required txPrebuild property txHex');
    }
    const transaction = this.createTransactionFromHex<TNumber>(prebuild.txHex);
    if (_.isUndefined(prebuild.blockHeight)) {
      prebuild.blockHeight = (await this.getLatestBlockHeight()) as number;
    }
    return _.extend({}, prebuild, { txHex: transaction.toHex() });
  }

  /**
   * Find outputs that are within expected outputs but not within actual outputs, including duplicates
   * @param expectedOutputs
   * @param actualOutputs
   * @returns {Array}
   */
  protected static findMissingOutputs(expectedOutputs: Output[], actualOutputs: Output[]): Output[] {
    const keyFunc = ({ address, amount }: Output): string => `${address}:${amount}`;
    const groupedOutputs = _.groupBy(expectedOutputs, keyFunc);

    actualOutputs.forEach((output) => {
      const group = groupedOutputs[keyFunc(output)];
      if (group) {
        group.pop();
      }
    });

    return _.flatten(_.values(groupedOutputs));
  }

  /**
   * Determine an address' type based on its witness and redeem script presence
   * @param addressDetails
   */
  static inferAddressType(addressDetails: { chain: number }): ScriptType2Of3 | null {
    return isChainCode(addressDetails.chain) ? scriptTypeForChain(addressDetails.chain) : null;
  }

  createTransactionFromHex<TNumber extends number | bigint = number>(
    hex: string
  ): utxolib.bitgo.UtxoTransaction<TNumber> {
    return utxolib.bitgo.createTransactionFromHex<TNumber>(hex, this.network, this.amountType);
  }

  /**
   * Extract and fill transaction details such as internal/change spend, external spend (explicit vs. implicit), etc.
   * @param params
   * @returns {*}
   */
  async parseTransaction<TNumber extends number | bigint = number>(
    params: ParseTransactionOptions<TNumber>
  ): Promise<ParsedTransaction<TNumber>> {
    const { txParams, txPrebuild, wallet, verification = {}, reqId } = params;

    if (!_.isUndefined(verification.disableNetworking) && !_.isBoolean(verification.disableNetworking)) {
      throw new Error('verification.disableNetworking must be a boolean');
    }
    const disableNetworking = verification.disableNetworking;

    const fetchKeychains = async (wallet: IWallet): Promise<VerificationOptions['keychains']> => {
      return promiseProps({
        user: this.keychains().get({ id: wallet.keyIds()[KeyIndices.USER], reqId }),
        backup: this.keychains().get({ id: wallet.keyIds()[KeyIndices.BACKUP], reqId }),
        bitgo: this.keychains().get({ id: wallet.keyIds()[KeyIndices.BITGO], reqId }),
      });
    };

    // obtain the keychains and key signatures
    let keychains: VerificationOptions['keychains'] | undefined = verification.keychains;
    if (!keychains) {
      if (disableNetworking) {
        throw new Error('cannot fetch keychains without networking');
      }
      keychains = await fetchKeychains(wallet);
    }

    if (!keychains || !keychains.user || !keychains.backup || !keychains.bitgo) {
      throw new Error('keychains are required, but could not be fetched');
    }

    const keychainArray: Triple<Keychain> = [keychains.user, keychains.backup, keychains.bitgo];

    const keySignatures = _.get(wallet, '_wallet.keySignatures', {});

    if (_.isUndefined(txPrebuild.txHex)) {
      throw new Error('missing required txPrebuild property txHex');
    }
    // obtain all outputs
    const explanation: TransactionExplanation = await this.explainTransaction<TNumber>({
      txHex: txPrebuild.txHex,
      txInfo: txPrebuild.txInfo,
      pubs: keychainArray.map((k) => k.pub) as Triple<string>,
    });

    const allOutputs = [...explanation.outputs, ...explanation.changeOutputs];

    // verify that each recipient from txParams has their own output
    const expectedOutputs = _.get(txParams, 'recipients', [] as TransactionRecipient[]).map((output) => {
      return { ...output, address: this.canonicalAddress(output.address) };
    });

    const missingOutputs = AbstractUtxoCoin.findMissingOutputs(expectedOutputs, allOutputs);

    // get the keychains from the custom change wallet if needed
    let customChange: CustomChangeOptions | undefined;
    const { customChangeWalletId = undefined } = wallet.coinSpecific() || {};
    if (customChangeWalletId) {
      // fetch keychains from custom change wallet for deriving addresses.
      // These keychains should be signed and this should be verified in verifyTransaction
      const customChangeKeySignatures = wallet._wallet.customChangeKeySignatures;
      const customChangeWallet: Wallet = await this.wallets().get({ id: customChangeWalletId });
      const customChangeKeys = await fetchKeychains(customChangeWallet);

      if (!customChangeKeys) {
        throw new Error('failed to fetch keychains for custom change wallet');
      }

      if (customChangeKeys.user && customChangeKeys.backup && customChangeKeys.bitgo && customChangeWallet) {
        const customChangeKeychains: [Keychain, Keychain, Keychain] = [
          customChangeKeys.user,
          customChangeKeys.backup,
          customChangeKeys.bitgo,
        ];

        customChange = {
          keys: customChangeKeychains,
          signatures: [
            customChangeKeySignatures.user,
            customChangeKeySignatures.backup,
            customChangeKeySignatures.bitgo,
          ],
        };
      }
    }

    /**
     * Loop through all the outputs and classify each of them as either internal spends
     * or external spends by setting the "external" property to true or false on the output object.
     */
    const allOutputDetails: Output[] = await Promise.all(
      allOutputs.map((currentOutput) => {
        return parseOutput({
          currentOutput,
          coin: this,
          txPrebuild,
          verification,
          keychainArray,
          wallet,
          txParams,
          customChange,
          reqId,
        });
      })
    );

    const needsCustomChangeKeySignatureVerification = allOutputDetails.some(
      (output) => output.needsCustomChangeKeySignatureVerification
    );

    const changeOutputs = _.filter(allOutputDetails, { external: false });

    // these are all the outputs that were not originally explicitly specified in recipients
    const implicitOutputs = AbstractUtxoCoin.findMissingOutputs(allOutputDetails, expectedOutputs);

    const explicitOutputs = AbstractUtxoCoin.findMissingOutputs(allOutputDetails, implicitOutputs);

    // these are all the non-wallet outputs that had been originally explicitly specified in recipients
    const explicitExternalOutputs = _.filter(explicitOutputs, { external: true });

    // this is the sum of all the originally explicitly specified non-wallet output values
    const explicitExternalSpendAmount = utxolib.bitgo.toTNumber<TNumber>(
      explicitExternalOutputs.reduce((sum: bigint, o: Output) => sum + BigInt(o.amount), BigInt(0)) as bigint,
      this.amountType
    );

    /**
     * The calculation of the implicit external spend amount pertains to verifying the pay-as-you-go-fee BitGo
     * automatically applies to transactions sending money out of the wallet. The logic is fairly straightforward
     * in that we compare the external spend amount that was specified explicitly by the user to the portion
     * that was specified implicitly. To protect customers from people tampering with the transaction outputs, we
     * define a threshold for the maximum percentage of the implicit external spend in relation to the explicit
     * external spend.
     */

    // make sure that all the extra addresses are change addresses
    // get all the additional external outputs the server added and calculate their values
    const implicitExternalOutputs = _.filter(implicitOutputs, { external: true });
    const implicitExternalSpendAmount = utxolib.bitgo.toTNumber<TNumber>(
      implicitExternalOutputs.reduce((sum: bigint, o: Output) => sum + BigInt(o.amount), BigInt(0)) as bigint,
      this.amountType
    );

    return {
      keychains,
      keySignatures,
      outputs: allOutputDetails,
      missingOutputs,
      explicitExternalOutputs,
      implicitExternalOutputs,
      changeOutputs,
      explicitExternalSpendAmount,
      implicitExternalSpendAmount,
      needsCustomChangeKeySignatureVerification,
      customChange,
    };
  }

  /**
   * Decrypt the wallet's user private key and verify that the claimed public key matches
   * @param {VerifyUserPublicKeyOptions} params
   * @return {boolean}
   * @protected
   */
  protected verifyUserPublicKey(params: VerifyUserPublicKeyOptions): boolean {
    const { userKeychain, txParams, disableNetworking } = params;
    if (!userKeychain) {
      throw new Error('user keychain is required');
    }

    const userPub = userKeychain.pub;

    // decrypt the user private key so we can verify that the claimed public key is a match
    let userPrv = userKeychain.prv;
    if (_.isEmpty(userPrv)) {
      const encryptedPrv = userKeychain.encryptedPrv;
      if (encryptedPrv && !_.isEmpty(encryptedPrv)) {
        // if the decryption fails, it will throw an error
        userPrv = this.bitgo.decrypt({
          input: encryptedPrv,
          password: txParams.walletPassphrase,
        });
      }
    }

    if (!userPrv) {
      const errorMessage = 'user private key unavailable for verification';
      if (disableNetworking) {
        console.log(errorMessage);
        return false;
      } else {
        throw new Error(errorMessage);
      }
    } else {
      const userPrivateKey = bip32.fromBase58(userPrv);
      if (userPrivateKey.toBase58() === userPrivateKey.neutered().toBase58()) {
        throw new Error('user private key is only public');
      }
      if (userPrivateKey.neutered().toBase58() !== userPub) {
        throw new Error('user private key does not match public key');
      }
    }

    return true;
  }

  /**
   * Verify signatures produced by the user key over the backup and bitgo keys.
   *
   * If set, these signatures ensure that the wallet keys cannot be changed after the wallet has been created.
   * @param {VerifyKeySignaturesOptions} params
   * @return {{backup: boolean, bitgo: boolean}}
   */
  protected verifyKeySignature(params: VerifyKeySignaturesOptions): boolean {
    // first, let's verify the integrity of the user key, whose public key is used for subsequent verifications
    const { userKeychain, keychainToVerify, keySignature } = params;
    if (!userKeychain) {
      throw new Error('user keychain is required');
    }

    if (!keychainToVerify) {
      throw new Error('keychain to verify is required');
    }

    if (!keySignature) {
      throw new Error('key signature is required');
    }

    // verify the signature against the user public key
    assert(userKeychain.pub);
    const publicKey = bip32.fromBase58(userKeychain.pub).publicKey;
    const signingAddress = utxolib.address.toBase58Check(
      utxolib.crypto.hash160(publicKey),
      utxolib.networks.bitcoin.pubKeyHash,
      this.network
    );

    // BG-5703: use BTC mainnet prefix for all key signature operations
    // (this means do not pass a prefix parameter, and let it use the default prefix instead)
    assert(keychainToVerify.pub);
    try {
      return bitcoinMessage.verify(keychainToVerify.pub, signingAddress, Buffer.from(keySignature, 'hex'));
    } catch (e) {
      debug('error thrown from bitcoinmessage while verifying key signature', e);
      return false;
    }
  }

  /**
   * Verify signatures against the user private key over the change wallet extended keys
   * @param {ParsedTransaction} tx
   * @param {Keychain} userKeychain
   * @return {boolean}
   * @protected
   */
  protected verifyCustomChangeKeySignatures<TNumber extends number | bigint>(
    tx: ParsedTransaction<TNumber>,
    userKeychain: Keychain
  ): boolean {
    if (!tx.customChange) {
      throw new Error('parsed transaction is missing required custom change verification data');
    }

    if (!Array.isArray(tx.customChange.keys) || !Array.isArray(tx.customChange.signatures)) {
      throw new Error('customChange property is missing keys or signatures');
    }

    for (const keyIndex of [KeyIndices.USER, KeyIndices.BACKUP, KeyIndices.BITGO]) {
      const keychainToVerify = tx.customChange.keys[keyIndex];
      const keySignature = tx.customChange.signatures[keyIndex];
      if (!keychainToVerify) {
        throw new Error(`missing required custom change ${KeyIndices[keyIndex].toLowerCase()} keychain public key`);
      }
      if (!keySignature) {
        throw new Error(`missing required custom change ${KeyIndices[keyIndex].toLowerCase()} keychain signature`);
      }
      if (!this.verifyKeySignature({ userKeychain, keychainToVerify, keySignature })) {
        debug('failed to verify custom change %s key signature!', KeyIndices[keyIndex].toLowerCase());
        return false;
      }
    }

    return true;
  }

  /**
   * Get the maximum percentage limit for pay-as-you-go outputs
   *
   * @protected
   */
  protected getPayGoLimit(allowPaygoOutput?: boolean): number {
    // allowing paygo outputs needs to be the default behavior, so only disallow paygo outputs if the
    // relevant verification option is both set and false
    if (!_.isNil(allowPaygoOutput) && !allowPaygoOutput) {
      return 0;
    }
    // 150 basis points is the absolute permitted maximum if paygo outputs are allowed
    return 0.015;
  }

  /**
   * Verify that a transaction prebuild complies with the original intention
   *
   * @param params
   * @param params.txParams params object passed to send
   * @param params.txPrebuild prebuild object returned by server
   * @param params.txPrebuild.txHex prebuilt transaction's txHex form
   * @param params.wallet Wallet object to obtain keys to verify against
   * @param params.verification Object specifying some verification parameters
   * @param params.verification.disableNetworking Disallow fetching any data from the internet for verification purposes
   * @param params.verification.keychains Pass keychains manually rather than fetching them by id
   * @param params.verification.addresses Address details to pass in for out-of-band verification
   * @returns {boolean}
   */
  async verifyTransaction<TNumber extends number | bigint = number>(
    params: VerifyTransactionOptions<TNumber>
  ): Promise<boolean> {
    const { txParams, txPrebuild, wallet, verification = { allowPaygoOutput: true }, reqId } = params;
    const disableNetworking = !!verification.disableNetworking;
    const parsedTransaction: ParsedTransaction<TNumber> = await this.parseTransaction<TNumber>({
      txParams,
      txPrebuild,
      wallet,
      verification,
      reqId,
    });

    const keychains = parsedTransaction.keychains;

    // verify that the claimed user public key corresponds to the wallet's user private key
    let userPublicKeyVerified = false;
    try {
      // verify the user public key matches the private key - this will throw if there is no match
      userPublicKeyVerified = this.verifyUserPublicKey({ userKeychain: keychains.user, disableNetworking, txParams });
    } catch (e) {
      debug('failed to verify user public key!', e);
    }

    // let's verify these keychains
    const keySignatures = parsedTransaction.keySignatures;
    if (!_.isEmpty(keySignatures)) {
      const verify = (key, pub) =>
        this.verifyKeySignature({ userKeychain: keychains.user, keychainToVerify: key, keySignature: pub });
      const isBackupKeySignatureValid = verify(keychains.backup, keySignatures.backupPub);
      const isBitgoKeySignatureValid = verify(keychains.bitgo, keySignatures.bitgoPub);
      if (!isBackupKeySignatureValid || !isBitgoKeySignatureValid) {
        throw new Error('secondary public key signatures invalid');
      }
      debug('successfully verified backup and bitgo key signatures');
    } else if (!disableNetworking) {
      // these keys were obtained online and their signatures were not verified
      // this could be dangerous
      console.log('unsigned keys obtained online are being used for address verification');
    }

    if (parsedTransaction.needsCustomChangeKeySignatureVerification) {
      if (!keychains.user || !userPublicKeyVerified) {
        throw new Error('transaction requires verification of user public key, but it was unable to be verified');
      }
      const customChangeKeySignaturesVerified = this.verifyCustomChangeKeySignatures(parsedTransaction, keychains.user);
      if (!customChangeKeySignaturesVerified) {
        throw new Error(
          'transaction requires verification of custom change key signatures, but they were unable to be verified'
        );
      }
      debug('successfully verified user public key and custom change key signatures');
    }

    const missingOutputs = parsedTransaction.missingOutputs;
    if (missingOutputs.length !== 0) {
      // there are some outputs in the recipients list that have not made it into the actual transaction
      throw new Error('expected outputs missing in transaction prebuild');
    }

    const intendedExternalSpend = parsedTransaction.explicitExternalSpendAmount;

    // this is a limit we impose for the total value that is amended to the transaction beyond what was originally intended
    const payAsYouGoLimit = new BigNumber(this.getPayGoLimit(verification.allowPaygoOutput)).multipliedBy(
      intendedExternalSpend.toString()
    );

    /*
    Some explanation for why we're doing what we're doing:
    Some customers will have an output to BitGo's PAYGo wallet added to their transaction, and we need to account for
    it here. To protect someone tampering with the output to make it send more than it should to BitGo, we define a
    threshold for the output's value above which we'll throw an error, because the paygo output should never be that
    high.
     */

    // make sure that all the extra addresses are change addresses
    // get all the additional external outputs the server added and calculate their values
    const nonChangeAmount = new BigNumber(parsedTransaction.implicitExternalSpendAmount.toString());

    debug(
      'Intended spend is %s, Non-change amount is %s, paygo limit is %s',
      intendedExternalSpend.toString(),
      nonChangeAmount.toString(),
      payAsYouGoLimit.toString()
    );

    // the additional external outputs can only be BitGo's pay-as-you-go fee, but we cannot verify the wallet address
    if (nonChangeAmount.gt(payAsYouGoLimit)) {
      // there are some addresses that are outside the scope of intended recipients that are not change addresses
      throw new Error('prebuild attempts to spend to unintended external recipients');
    }

    const allOutputs = parsedTransaction.outputs;
    if (!txPrebuild.txHex) {
      throw new Error(`txPrebuild.txHex not set`);
    }
    const transaction = this.createTransactionFromHex<TNumber>(txPrebuild.txHex);
    const transactionCache = {};
    const inputs = await Promise.all(
      transaction.ins.map(async (currentInput) => {
        const transactionId = (Buffer.from(currentInput.hash).reverse() as Buffer).toString('hex');
        const txHex = txPrebuild.txInfo?.txHexes?.[transactionId];
        if (txHex) {
          const localTx = this.createTransactionFromHex<TNumber>(txHex);
          if (localTx.getId() !== transactionId) {
            throw new Error('input transaction hex does not match id');
          }
          const currentOutput = localTx.outs[currentInput.index];
          const address = utxolib.address.fromOutputScript(currentOutput.script, this.network);
          return {
            address,
            value: currentOutput.value,
            valueString: currentOutput.value.toString(),
          };
        } else if (!transactionCache[transactionId]) {
          if (disableNetworking) {
            throw new Error('attempting to retrieve transaction details externally with networking disabled');
          }
          if (reqId) {
            this.bitgo.setRequestTracer(reqId);
          }
          transactionCache[transactionId] = await this.bitgo.get(this.url(`/public/tx/${transactionId}`)).result();
        }
        const transactionDetails = transactionCache[transactionId];
        return transactionDetails.outputs[currentInput.index];
      })
    );

    // coins (doge) that can exceed number limits (and thus will use bigint) will have the `valueString` field
    const inputAmount = inputs.reduce(
      (sum: bigint, i) => sum + BigInt(this.amountType === 'bigint' ? i.valueString : i.value),
      BigInt(0)
    );
    const outputAmount = allOutputs.reduce((sum: bigint, o: Output) => sum + BigInt(o.amount), BigInt(0));
    const fee = inputAmount - outputAmount;

    if (fee < 0) {
      throw new Error(
        `attempting to spend ${outputAmount} satoshis, which exceeds the input amount (${inputAmount} satoshis) by ${-fee}`
      );
    }

    return true;
  }

  /**
   * Make sure an address is valid and throw an error if it's not.
   * @param params.address The address string on the network
   * @param params.addressType
   * @param params.keychains Keychain objects with xpubs
   * @param params.coinSpecific Coin-specific details for the address such as a witness script
   * @param params.chain Derivation chain
   * @param params.index Derivation index
   * @throws {InvalidAddressError}
   * @throws {InvalidAddressDerivationPropertyError}
   * @throws {UnexpectedAddressError}
   */
  async isWalletAddress(params: VerifyAddressOptions): Promise<boolean> {
    const { address, addressType, keychains, coinSpecific, chain, index } = params;

    if (!this.isValidAddress(address)) {
      throw new InvalidAddressError(`invalid address: ${address}`);
    }

    if ((_.isUndefined(chain) && _.isUndefined(index)) || !(_.isFinite(chain) && _.isFinite(index))) {
      throw new InvalidAddressDerivationPropertyError(
        `address validation failure: invalid chain (${chain}) or index (${index})`
      );
    }

    if (!_.isObject(coinSpecific)) {
      throw new InvalidAddressVerificationObjectPropertyError(
        'address validation failure: coinSpecific field must be an object'
      );
    }

    if (!keychains) {
      throw new Error('missing required param keychains');
    }

    const expectedAddress = this.generateAddress({
      addressType: addressType as ScriptType2Of3,
      keychains,
      threshold: 2,
      chain,
      index,
    });

    if (expectedAddress.address !== address) {
      throw new UnexpectedAddressError(
        `address validation failure: expected ${expectedAddress.address} but got ${address}`
      );
    }

    return true;
  }

  /**
   * Indicates whether coin supports a block target
   * @returns {boolean}
   */
  supportsBlockTarget() {
    return true;
  }

  /**
   * @param addressType
   * @returns true iff coin supports spending from unspentType
   */
  supportsAddressType(addressType: ScriptType2Of3): boolean {
    return utxolib.bitgo.outputScripts.isSupportedScriptType(this.network, addressType);
  }

  /**
   * @param chain
   * @return true iff coin supports spending from chain
   */
  supportsAddressChain(chain: number): boolean {
    return isChainCode(chain) && this.supportsAddressType(utxolib.bitgo.scriptTypeForChain(chain));
  }

  keyIdsForSigning(): number[] {
    return [KeyIndices.USER, KeyIndices.BACKUP, KeyIndices.BITGO];
  }

  /**
   * TODO(BG-11487): Remove addressType, segwit, and bech32 params in SDKv6
   * Generate an address for a wallet based on a set of configurations
   * @param params.addressType {string}   Deprecated
   * @param params.keychains   {[object]} Array of objects with xpubs
   * @param params.threshold   {number}   Minimum number of signatures
   * @param params.chain       {number}   Derivation chain (see https://github.com/BitGo/unspents/blob/master/src/codes.ts for
   *                                                 the corresponding address type of a given chain code)
   * @param params.index       {number}   Derivation index
   * @param params.segwit      {boolean}  Deprecated
   * @param params.bech32      {boolean}  Deprecated
   * @returns {{chain: number, index: number, coin: number, coinSpecific: {outputScript, redeemScript}}}
   */
  generateAddress(params: GenerateAddressOptions): AddressDetails {
    const { keychains, threshold, chain, index, segwit = false, bech32 = false } = params;
    let derivationChain = getExternalChainCode('p2sh');
    if (_.isNumber(chain) && _.isInteger(chain) && isChainCode(chain)) {
      derivationChain = chain;
    }

    function convertFlagsToAddressType(): ScriptType2Of3 {
      if (isChainCode(chain)) {
        return utxolib.bitgo.scriptTypeForChain(chain);
      }
      if (_.isBoolean(segwit) && segwit) {
        return 'p2shP2wsh';
      } else if (_.isBoolean(bech32) && bech32) {
        return 'p2wsh';
      } else {
        return 'p2sh';
      }
    }

    const addressType = params.addressType || convertFlagsToAddressType();

    if (addressType !== utxolib.bitgo.scriptTypeForChain(derivationChain)) {
      throw new AddressTypeChainMismatchError(addressType, derivationChain);
    }

    if (!this.supportsAddressType(addressType)) {
      switch (addressType) {
        case 'p2sh':
          throw new Error(`internal error: p2sh should always be supported`);
        case 'p2shP2wsh':
          throw new P2shP2wshUnsupportedError();
        case 'p2wsh':
          throw new P2wshUnsupportedError();
        case 'p2tr':
          throw new P2trUnsupportedError();
        case 'p2trMusig2':
          throw new P2trMusig2UnsupportedError();
        default:
          throw new UnsupportedAddressTypeError();
      }
    }

    let signatureThreshold = 2;
    if (_.isInteger(threshold)) {
      signatureThreshold = threshold as number;
      if (signatureThreshold <= 0) {
        throw new Error('threshold has to be positive');
      }
      if (signatureThreshold > keychains.length) {
        throw new Error('threshold cannot exceed number of keys');
      }
    }

    let derivationIndex = 0;
    if (_.isInteger(index) && (index as number) > 0) {
      derivationIndex = index as number;
    }

    const path = '0/0/' + derivationChain + '/' + derivationIndex;
    const hdNodes = keychains.map(({ pub }) => bip32.fromBase58(pub));
    const derivedKeys = hdNodes.map((hdNode) => hdNode.derivePath(sanitizeLegacyPath(path)).publicKey);

    const { outputScript, redeemScript, witnessScript, address } = this.createMultiSigAddress(
      addressType,
      signatureThreshold,
      derivedKeys
    );

    return {
      address,
      chain: derivationChain,
      index: derivationIndex,
      coin: this.getChain(),
      coinSpecific: {
        outputScript: outputScript.toString('hex'),
        redeemScript: redeemScript && redeemScript.toString('hex'),
        witnessScript: witnessScript && witnessScript.toString('hex'),
      },
      addressType,
    };
  }

  /**
   * Assemble keychain and half-sign prebuilt transaction
   * @param params - {@see SignTransactionOptions}
   * @returns {Promise<SignedTransaction | HalfSignedUtxoTransaction>}
   */
  async signTransaction<TNumber extends number | bigint = number>(
    params: SignTransactionOptions<TNumber>
  ): Promise<SignedTransaction | HalfSignedUtxoTransaction> {
    const txPrebuild = params.txPrebuild;
    const userPrv = params.prv;

    if (_.isUndefined(txPrebuild) || !_.isObject(txPrebuild)) {
      if (!_.isUndefined(txPrebuild) && !_.isObject(txPrebuild)) {
        throw new Error(`txPrebuild must be an object, got type ${typeof txPrebuild}`);
      }
      throw new Error('missing txPrebuild parameter');
    }
    const transaction = this.createTransactionFromHex<TNumber>(txPrebuild.txHex);

    if (transaction.ins.length !== txPrebuild.txInfo.unspents.length) {
      throw new Error('length of unspents array should equal to the number of transaction inputs');
    }

    let isLastSignature = false;
    if (_.isBoolean(params.isLastSignature)) {
      // if build is called instead of buildIncomplete, no signature placeholders are left in the sig script
      isLastSignature = params.isLastSignature;
    }

    if (_.isUndefined(userPrv) || !_.isString(userPrv)) {
      if (!_.isUndefined(userPrv)) {
        throw new Error(`prv must be a string, got type ${typeof userPrv}`);
      }
      throw new Error('missing prv parameter to sign transaction');
    }

    if (!params.pubs || params.pubs.length !== 3) {
      throw new Error(`must provide xpub array`);
    }

    const signerKeychain = bip32.fromBase58(userPrv, utxolib.networks.bitcoin);
    if (signerKeychain.isNeutered()) {
      throw new Error('expected user private key but received public key');
    }
    debug(`Here is the public key of the xprv you used to sign: ${signerKeychain.neutered().toBase58()}`);

    const cosignerPub = params.cosignerPub ?? params.pubs[2];
    const keychains = params.pubs.map((pub) => bip32.fromBase58(pub)) as Triple<BIP32Interface>;
    const cosignerKeychain = bip32.fromBase58(cosignerPub);

    const signedTransaction = signAndVerifyWalletTransaction(
      transaction,
      txPrebuild.txInfo.unspents,
      new bitgo.WalletUnspentSigner<RootWalletKeys>(keychains, signerKeychain, cosignerKeychain),
      { isLastSignature }
    );

    return {
      txHex: signedTransaction.toBuffer().toString('hex'),
    };
  }

  /**
   * @param unspent
   * @returns {boolean}
   */
  isBitGoTaintedUnspent<TNumber extends number | bigint>(unspent: Unspent<TNumber>): boolean {
    return isReplayProtectionUnspent<TNumber>(unspent, this.network);
  }

  /**
   * @deprecated - use utxolib.bitgo.getDefaultSigHash(network) instead
   * @returns {number}
   */
  get defaultSigHashType(): number {
    return utxolib.bitgo.getDefaultSigHash(this.network);
  }

  /**
   * @deprecated - use utxolib.bitcoin.verifySignature() instead
   */
  verifySignature(
    transaction: any,
    inputIndex: number,
    amount: number,
    verificationSettings: {
      signatureIndex?: number;
      publicKey?: string;
    } = {}
  ): boolean {
    if (transaction.network !== this.network) {
      throw new Error(`network mismatch`);
    }
    return utxolib.bitgo.verifySignature(transaction, inputIndex, amount, {
      signatureIndex: verificationSettings.signatureIndex,
      publicKey: verificationSettings.publicKey ? Buffer.from(verificationSettings.publicKey, 'hex') : undefined,
    });
  }

  /**
   * Decompose a raw transaction into useful information, such as the total amounts,
   * change amounts, and transaction outputs.
   * @param params
   */
  async explainTransaction<TNumber extends number | bigint = number>(
    params: ExplainTransactionOptions<TNumber>
  ): Promise<TransactionExplanation> {
    const txHex = _.get(params, 'txHex');
    if (!txHex || !_.isString(txHex) || !txHex.match(/^([a-f0-9]{2})+$/i)) {
      throw new Error('invalid transaction hex, must be a valid hex string');
    }

    let transaction;
    try {
      transaction = this.createTransactionFromHex(txHex);
    } catch (e) {
      throw new Error('failed to parse transaction hex');
    }

    const id = transaction.getId();
    let spendAmount = utxolib.bitgo.toTNumber<TNumber>(0, this.amountType);
    let changeAmount = utxolib.bitgo.toTNumber<TNumber>(0, this.amountType);
    const explanation = {
      displayOrder: ['id', 'outputAmount', 'changeAmount', 'outputs', 'changeOutputs'],
      id: id,
      outputs: [] as Output[],
      changeOutputs: [] as Output[],
    } as TransactionExplanation;

    const { changeAddresses = [], unspents = [] } = params.txInfo ?? {};

    transaction.outs.forEach((currentOutput) => {
      const currentAddress = utxolib.address.fromOutputScript(currentOutput.script, this.network);
      const currentAmount = currentOutput.value;

      if (changeAddresses.includes(currentAddress)) {
        // this is change
        changeAmount += currentAmount;
        explanation.changeOutputs.push({
          address: currentAddress,
          amount: currentAmount.toString(),
        });
        return;
      }

      spendAmount += currentAmount;
      explanation.outputs.push({
        address: currentAddress,
        amount: currentAmount.toString(),
      });
    });
    explanation.outputAmount = spendAmount.toString();
    explanation.changeAmount = changeAmount.toString();

    // add fee info if available
    if (params.feeInfo) {
      explanation.displayOrder.push('fee');
      explanation.fee = params.feeInfo;
    }

    if (_.isInteger(transaction.locktime) && transaction.locktime > 0) {
      explanation.locktime = transaction.locktime;
      explanation.displayOrder.push('locktime');
    }

    const prevOutputs = params.txInfo?.unspents.map((u) => toOutput<TNumber>(u, this.network));

    // if keys are provided, prepare the keys for input signature checking
    const keys = params.pubs?.map((xpub) => bip32.fromBase58(xpub));
    const walletKeys = keys && keys.length === 3 ? new bitgo.RootWalletKeys(keys as Triple<BIP32Interface>) : undefined;

    // get the number of signatures per input
    const inputSignatureCounts = transaction.ins.map((input, idx): number => {
      if (unspents.length !== transaction.ins.length) {
        return 0;
      }

      if (!prevOutputs) {
        throw new Error(`invalid state`);
      }

      if (!walletKeys) {
        // no pub keys or incorrect number of pub keys
        return 0;
      }

      try {
        return verifySignatureWithUnspent<TNumber>(transaction, idx, unspents, walletKeys).filter((v) => v).length;
      } catch (e) {
        // some other error occurred and we can't validate the signatures
        return 0;
      }
    });

    explanation.inputSignatures = inputSignatureCounts;
    explanation.signatures = _.max(inputSignatureCounts) as number;
    return explanation;
  }

  /**
   * Create a multisig address of a given type from a list of keychains and a signing threshold
   * @param addressType
   * @param signatureThreshold
   * @param keys
   */
  createMultiSigAddress(addressType: ScriptType2Of3, signatureThreshold: number, keys: Buffer[]): MultiSigAddress {
    const {
      scriptPubKey: outputScript,
      redeemScript,
      witnessScript,
    } = utxolib.bitgo.outputScripts.createOutputScript2of3(keys, addressType);

    return {
      outputScript,
      redeemScript,
      witnessScript,
      address: utxolib.address.fromOutputScript(outputScript, this.network),
    };
  }

  /**
   * @deprecated - use {@see backupKeyRecovery}
   * Builds a funds recovery transaction without BitGo
   * @param params - {@see backupKeyRecovery}
   */
  async recover(params: RecoverParams): ReturnType<typeof backupKeyRecovery> {
    return backupKeyRecovery(this, this.bitgo, params);
  }

  /**
   * Recover coin that was sent to wrong chain
   * @param params
   * @param params.txid The txid of the faulty transaction
   * @param params.recoveryAddress address to send recovered funds to
   * @param params.wallet the wallet that received the funds
   * @param params.recoveryCoin the coin type of the wallet that received the funds
   * @param params.signed return a half-signed transaction (default=true)
   * @param params.walletPassphrase the wallet passphrase
   * @param params.xprv the unencrypted xprv (used instead of wallet passphrase)
   * @param params.apiKey for utxo coins other than [BTC,TBTC] this is a Block Chair api key
   * @returns {*}
   */
  async recoverFromWrongChain<TNumber extends number | bigint = number>(
    params: RecoverFromWrongChainOptions
  ): Promise<CrossChainRecoverySigned<TNumber> | CrossChainRecoveryUnsigned<TNumber>> {
    const { txid, recoveryAddress, wallet, walletPassphrase, xprv, apiKey } = params;

    // params.recoveryCoin used to be params.coin, backwards compatibility
    const recoveryCoin = params.coin || params.recoveryCoin;
    if (!recoveryCoin) {
      throw new Error('missing required object recoveryCoin');
    }
    // signed should default to true, and only be disabled if explicitly set to false (not undefined)
    const signed = params.signed !== false;

    const sourceCoinFamily = this.getFamily();
    const recoveryCoinFamily = recoveryCoin.getFamily();
    const supportedRecoveryCoins = supportedCrossChainRecoveries[sourceCoinFamily];

    if (_.isUndefined(supportedRecoveryCoins) || !supportedRecoveryCoins.includes(recoveryCoinFamily)) {
      throw new Error(`Recovery of ${sourceCoinFamily} balances from ${recoveryCoinFamily} wallets is not supported.`);
    }

    return await recoverCrossChain<TNumber>(this.bitgo, {
      sourceCoin: this,
      recoveryCoin,
      walletId: wallet,
      txid,
      recoveryAddress,
      walletPassphrase: signed ? walletPassphrase : undefined,
      xprv: signed ? xprv : undefined,
      apiKey,
    });
  }

  /**
   * Generate bip32 key pair
   *
   * @param seed
   * @returns {Object} object with generated pub and prv
   */
  generateKeyPair(seed: Buffer): { pub: string; prv: string } {
    if (!seed) {
      // An extended private key has both a normal 256 bit private key and a 256
      // bit chain code, both of which must be random. 512 bits is therefore the
      // maximum entropy and gives us maximum security against cracking.
      seed = randomBytes(512 / 8);
    }
    const extendedKey = bip32.fromSeed(seed);
    return {
      pub: extendedKey.neutered().toBase58(),
      prv: extendedKey.toBase58(),
    };
  }

  async getExtraPrebuildParams(buildParams: ExtraPrebuildParamsOptions): Promise<any> {
    return {};
  }

  preCreateBitGo(params: PrecreateBitGoOptions): void {
    return;
  }

  async presignTransaction(params: PresignTransactionOptions): Promise<any> {
    return params;
  }

  async supplementGenerateWallet(
    walletParams: SupplementGenerateWalletOptions,
    keychains: KeychainsTriplet
  ): Promise<any> {
    return walletParams;
  }

  transactionDataAllowed(): boolean {
    return false;
  }

  valuelessTransferAllowed(): boolean {
    return false;
  }

  getRecoveryProvider(apiToken?: string): RecoveryProvider {
    return forCoin(this.getChain(), apiToken);
  }
}
