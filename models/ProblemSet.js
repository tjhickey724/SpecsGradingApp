'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var problemSetSchema = Schema( {
  courseId: {type:ObjectId,index:true},
  name: String,
  createdAt: Date,
  visible: Boolean,
  makeupOf: {type: ObjectId, ref:'MathExam' } // if this is a makeup set, this is the original set; else it is null
} );

module.exports = mongoose.model( 'ProblemSet', problemSetSchema );
