'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseMemberSchema = Schema( {
  studentId: {type:ObjectId,index:true},
  courseId: {type:ObjectId,index:true},
  createdAt: Date,
} );

module.exports = mongoose.model( 'CourseMember', courseMemberSchema );
