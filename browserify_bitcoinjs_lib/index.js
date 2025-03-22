const bitcoinjs = require('bitcoinjs-lib')
bitcoinjs.bigi = require('bigi')
bitcoinjs.tiny_secp256k1 = require('@bitcoinerlab/secp256k1')
bitcoinjs.ecpairfactory = require('ecpair').ECPairFactory
bitcoinjs.Buffer = require('safe-buffer').Buffer
window.bitcoinjs = bitcoinjs
module.exports = bitcoinjs
