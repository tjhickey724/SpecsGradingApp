'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var regradeRequestSchema = Schema( {
  reviewId: {type:ObjectId,index:true}, // also track problemId!
  courseId: {type:ObjectId,index:true},
  answerId: {type:ObjectId,index:true},
  problemId: {type:ObjectId,index:true}, // should also track reviwerId!
  psetId: ObjectId,
  studentId: {type:ObjectId,index:true},
  reason: String,
  reply: String,
  completed: {type:Boolean, index:true},
  createdAt: Date,
} );
/*
upvoters and downvoters are the lists of users who
upvoted or downvoted that review.
*/

module.exports = mongoose.model( 'RegradeRequest', regradeRequestSchema );
