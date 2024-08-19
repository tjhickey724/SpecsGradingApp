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
  createdAt: Date,
} );

module.exports = mongoose.model( 'PsetProblem', psetProblemSchema );
