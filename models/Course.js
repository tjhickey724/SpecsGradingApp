'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseSchema = Schema( {
  name: String,
  ownerId: {type:ObjectId,index:true},
  coursePin: {type:Number,index:true},
  createdAt: Date,
  startDate: Date,
  stopDate: Date,
  nonGrading: Boolean, // if true, grading will be done in an external app 
  mathCourseId: {type:ObjectId,index:true,ref:"MathCourse"},
} );

module.exports = mongoose.model( 'Course', courseSchema );
