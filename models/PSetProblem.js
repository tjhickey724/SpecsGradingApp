'use strict';
/*
  this lists the skills required for a course.
  The skills can be created by other people
  in their courses and add to this course.
*/
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var pSetProblemSchema = Schema( {
  psetId: {type:ObjectId,index:true,ref:'ProblemSet'},
  problemId: {type:ObjectId,index:true,ref:'Problem'},
  createdAt: Date,
} );

module.exports = mongoose.model( 'PSetProblem', pSetProblemSchema );
