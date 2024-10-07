'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseMemberSchema = Schema( {
  studentId: {type:ObjectId,index:true,ref:"User"},
  courseId: {type:ObjectId,index:true},
  section: String,
  createdAt: Date,
  status: String, // I think we can delete this field!!
  role: {
    type: String,
    enum: ['dropped','guest','audit','student', 'ta', 'instructor', 'owner'],
    default: 'student'
    }
  }
);

module.exports = mongoose.model( 'CourseMember', courseMemberSchema );
