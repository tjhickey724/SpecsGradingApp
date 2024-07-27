'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var examSchema = Schema( {
  name: String,
  filename: String,
  courseId: {type:ObjectId,index:true},
  createdAt: Date,
//  gradeSheet: mongoose.Schema.Types.Mixed,
//  gradesUpdateTime: Date
} );

module.exports = mongoose.model( 'MathExam', examSchema );
