'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var gradeSchema = Schema( {
  name: String,
  email: String,
  courseId: {type:ObjectId,index:true},
  examId: {type:ObjectId,index:true,ref:'ProblemSet'},
  createdAt: Date,
  skillsMastered: [String],
  skillsSkipped: [String],
  grades: mongoose.Schema.Types.Mixed,
//  gradesUpdateTime: Date
} );

module.exports = mongoose.model( 'PostedGrades', gradeSchema );
