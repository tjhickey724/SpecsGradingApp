'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseMemberSchema = Schema( {
  studentId: {type:ObjectId,index:true,ref:"User"},
  courseId: {type:ObjectId,index:true},
  createdAt: Date,
  status: String,
} );

module.exports = mongoose.model( 'CourseMember', courseMemberSchema );
