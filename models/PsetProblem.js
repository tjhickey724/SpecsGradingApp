'use strict';
/*
  this lists the skills required for a course.
  The skills can be created by other people
  in their courses and add to this course.
*/
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId; 

var psetProblemSchema = Schema( {
  courseId: {type:ObjectId,index:true,ref:'Course'},
  psetId: {type:ObjectId,index:true,ref:'ProblemSet'},
  problemId: {type:ObjectId,ref:'Problem',index:true},
  pendingReviews: mongoose.Schema.Types.Mixed, // used to fairly distribute reviewing
  allowAnswers: Boolean, // default value
  visible: {type:Boolean, default: true}, //default value, actual value in PsetProblem
  submitable: {type:Boolean,default:true}, // default value
  answerable: {type:Boolean, default:true}, // default value
  peerReviewable:{type:Boolean, default:true}, // default value
  createdAt: Date,
});

module.exports = mongoose.model( 'PsetProblem', psetProblemSchema );

/*
  pendingReviews is a list of JSON objects of the form:
   {answerId,reviewerId,timeSent}
  before saving changes we need to run the command:
    problem.markModified(pendingReviews)
  or Mongoose won't update the change...
*/