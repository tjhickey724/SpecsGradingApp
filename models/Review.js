'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var reviewSchema = Schema( {
  reviewerId: {type:ObjectId,ref:'User',index:true}, // also track problemId!
  courseId: {type:ObjectId,index:true},
  psetId: ObjectId,
  //psetProbId:{type:ObjectId,index:true}, // need to update this when going to v3
  problemId: {type:ObjectId,index:true}, // should also track reviwerId!
  answerId: {type:ObjectId,index:true},
  studentId: {type:ObjectId,index:true},
  review: String,
  points: Number,
  skills:[{type:ObjectId,ref:'Skill'}],
  upvoters: [Schema.Types.ObjectId],
  downvoters: [Schema.Types.ObjectId],
  createdAt: Date,
} );
/*
upvoters and downvoters are the lists of users who
upvoted or downvoted that review.
*/

module.exports = mongoose.model( 'Review', reviewSchema );
