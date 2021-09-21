'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var problemSetSchema = Schema( {
  courseId: {type:ObjectId,index:true},
  name: String,
  createdAt: Date,
  visible: Boolean,
} );

module.exports = mongoose.model( 'ProblemSet', problemSetSchema );
