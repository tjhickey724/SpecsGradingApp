'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;

var updateSchema = Schema( {
  version: String,
  createdAt: Date,
} );

module.exports = mongoose.model( 'Update', updateSchema );
