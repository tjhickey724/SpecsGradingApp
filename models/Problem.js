'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var problemSchema = Schema( {
  courseId: {type:ObjectId,index:true},
  psetId: {type:ObjectId,index:true},
  description: String,
  problemText: String,
  points: Number,
  rubric: String,
  pendingReviews: mongoose.Schema.Types.Mixed,
  createdAt: Date,
  allowAnswers: Boolean,
  skills:[{type:ObjectId,ref:'Skill'}],
  visible: {type:Boolean, default: true},
  submitable: {type:Boolean,default:true}, // When it's true, it allows users to submit their answers(For muliple submit).
  answerable: {type:Boolean, default:true}, // When it's true, it means the problem is answerable(For close a problem).
  peerReviewable:{type:Boolean, default:true}
} );
/*
  pendingReviews is a list of JSON objects of the form:
   {answerId,reviewerId,timeSent}
  before saving changes we need to run the command:
    problem.markModified(pendingReviews)
  or Mongoose won't update the change...
*/

module.exports = mongoose.model( 'Problem', problemSchema );
