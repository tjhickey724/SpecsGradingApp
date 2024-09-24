'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var answerSchema = Schema( {
  studentId: {type:ObjectId, ref:'User'},
  courseId: {type:ObjectId,index:true},
  psetId: {type:ObjectId, ref:'ProblemSet'},
  //psetProbId:{type:ObjectId,index:true}, // need to update this when
  problemId: {type:ObjectId,index:true,ref:'Problem'},
  answer: String,
  imageFilePath: String,
  uploadTarget: String, // "AWS" or "local"/undefined
  reviewers: [Schema.Types.ObjectId],
  numReviews: Number,
  pendingReviewers: [Schema.Types.ObjectId],
  createdAt: Date,
  // when a TA reviews an answer, it becomes
  // the official review and
  // the review, points, skills mastered are
  // copied here. We may need to be careful
  // when a TAs review is deleted to clear these.
  officialReviewId: Schema.Types.ObjectId,
  review: String,
  points: Number,
  skills:[{type:ObjectId,ref:'Skill'}], // skills mastered
} );

module.exports = mongoose.model( 'Answer', answerSchema );
