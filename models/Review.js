'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var reviewSchema = Schema( {
  reviewerId: {type:ObjectId,index:true}, // also track problemId!
  courseId: {type:ObjectId,index:true},
  psetId: ObjectId,
  problemId: {type:ObjectId,index:true}, // should also track reviwerId!
  answerId: {type:ObjectId,index:true},
  studentId: {type:ObjectId,index:true},
  review: String,
  points: Number,
  upvoters: [Schema.Types.ObjectId],
  downvoters: [Schema.Types.ObjectId],
  createdAt: Date,
} );
/*
upvoters and downvoters are the lists of users who
upvoted or downvoted that review.
*/

module.exports = mongoose.model( 'Review', reviewSchema );
